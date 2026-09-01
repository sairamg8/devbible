---
title: "The controls the browser draws, and the ones JavaScript draws"
sidebar_label: "04b · Controls and canvas"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against MDN —
> [`accent-color`](https://developer.mozilla.org/en-US/docs/Web/CSS/accent-color),
> [`scrollbar-color`](https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-color),
> [`::placeholder`](https://developer.mozilla.org/en-US/docs/Web/CSS/::placeholder),
> [`::selection`](https://developer.mozilla.org/en-US/docs/Web/CSS/::selection),
> [`caret-color`](https://developer.mozilla.org/en-US/docs/Web/CSS/caret-color),
> [`forced-colors`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors),
> [`forced-color-adjust`](https://developer.mozilla.org/en-US/docs/Web/CSS/forced-color-adjust),
> [`getComputedStyle`](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle) —
> and **WCAG 2.2** SC 1.4.3 and 1.4.11.
> Concept homes: `color-scheme` is
> [CSS 8·03](../../../../css/pages/phase-8-color-theming/03-dark-mode-properly.md);
> the checkout form this chapter fixes is
> [chapter 4·04](../../phase-4-react-ui/04-useform-and-checkout.md); the admin
> charts are [chapter 4·10](../../phase-4-react-ui/10-the-admin-data-table.md).
> No sandbox, no measured timings.

**Chapter [01](01-three-states-not-two.md) set `color-scheme`, which hands the
browser responsibility for scrollbars, control chrome and the canvas. It is a
smaller grant than it looks.** Four surfaces the browser draws are still wrong
after it, one of them — autofill — ignores the token layer entirely, and
anything drawn in JavaScript never hears about a theme change at all. This is
the residue: the parts of a themed page that CSS custom properties do not reach
by themselves.

## The four `color-scheme` misses

**Checkbox, radio and range tint.** `accent-color` themes a control's filled
state without opting out of the native control:

```css
:root { accent-color: var(--accent); }
```

One declaration on the root, inherited everywhere. Without it, the checkout
form's checkboxes stay the platform blue while every button beside them uses the
themed accent — which reads as an unfinished theme rather than a native control.

**Scrollbar colours**, where a *themed* scrollbar is wanted rather than merely a
dark one:

```css
:root { scrollbar-color: var(--border-strong) transparent; }
```

Both values are required — the property takes thumb then track — and it
overrides what `color-scheme` would have chosen on its own. That makes it
opt-in: `color-scheme` already gives a correct dark scrollbar for free, and this
is only worth writing when the scrollbar should match the palette rather than
the platform.

**Selection.** The UA default is frequently unreadable over `--surface-raised`
in dark mode, because it was chosen against the platform's own light canvas:

```css
::selection { background: var(--accent); color: var(--accent-contrast); }
```

`--accent-contrast` earns its keep here — this is text on the accent, the exact
case [chunk 02](02-the-token-layer.md) introduced it for.

**Placeholder text**, the most common contrast failure in the whole form:

```css
::placeholder { color: var(--text-muted); opacity: 1; }
```

🔴 `opacity: 1` is not cosmetic. Several engines apply a **default opacity** to
placeholder text, so a `--text-muted` value that passes 4.5:1 when measured as a
colour is rendered faded and fails in practice. Setting the colour without
resetting the opacity is exactly how a palette passes review and fails an audit
— the number that was checked is not the number that shipped.

The caret is a fifth, smaller miss: `caret-color: var(--text)` where a themed
input has been given a background dark enough that the platform caret vanishes.

## Autofill, which ignores the token layer entirely

The checkout form in [chapter 4·04](../../phase-4-react-ui/04-useform-and-checkout.md)
is where this shows. An autofilled field renders with the browser's own
background — pale yellow or pale blue — with themed dark text on top of it, and
in dark mode the result can be genuinely unreadable rather than merely ugly.

The background cannot be set with `background-color` on an autofilled field. The
working approach paints over it with a large inset shadow and forces the text
colour:

```css
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 100px var(--surface-raised) inset;
  -webkit-text-fill-color: var(--text);
  caret-color: var(--text);
}
```

`-webkit-text-fill-color` rather than `color` because the autofill styling wins
over `color`; the `100px` inset spread is simply "larger than any field", since
the shadow has to cover the whole box.

**These are non-standard, prefixed selectors — a remediation, not a feature.**
They may stop applying without warning, so the field must remain legible if the
entire block is ignored. That is a real argument for keeping the form's
`--surface-raised` toward the lighter end in dark mode, and against escalating
the block with `!important` when it misbehaves: the fallback has to be
survivable, because one day it will be what renders.

## Charts, canvas and anything drawn in JavaScript

The admin dashboard reads its series colours from the token layer:

```js
const styles = getComputedStyle(document.documentElement);
const series = styles.getPropertyValue('--series-1').trim();
```

That is a **snapshot**. CSS re-resolves on a theme change; a canvas does not, so
the chart keeps the old palette until something redraws it. The listener that
fixes this is [chunk 05](05-persisting-and-syncing.md), but the shape of the bug
belongs here: **anything that copies a token value out of CSS has to be told
when the theme changes.**

```js
// The redraw contract: read at paint time, never at module scope.
function seriesColour(n) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--series-${n}`).trim();
}
```

Reading inside the draw call rather than caching at module scope makes the
component correct as soon as *something* triggers a redraw, which reduces the
listener to "call redraw" instead of "invalidate a cache, then redraw".

**SVG charts that reference `var(--series-1)` directly need no listener at all**
— they participate in the cascade and re-resolve like any other element. On this
dashboard that is a real argument for SVG over canvas, and it is worth making
before the listener is written rather than after.

The `.trim()` is not optional: a custom property's value preserves the
whitespace after the colon, so the string handed to a canvas API is `" #2563eb"`
and silently fails to parse in some contexts.

## Forced colours override all of it

Windows High Contrast, surfaced as the `forced-colors` media feature, replaces
the page's colours with a user-chosen system palette. The token layer is not
consulted at all — this is not a third theme to author, it is the user taking
the decision away, and the correct posture is to make sure nothing *breaks*
rather than to reassert the palette.

```css
@media (forced-colors: active) {
  .product-tile__media { border: 1px solid CanvasText; }   /* keep the edge visible */
  .status-badge        { forced-color-adjust: none; }      /* only where colour IS the data */
}
```

The first rule is the common case: a boundary that was drawn with a themed
background disappears when backgrounds are replaced, so it is redrawn as a
border in a system colour keyword.

`forced-color-adjust: none` opts an element out, and it is a **promise** that
the element's own colours meet the user's needs. The status badges from
[chunk 02](02-the-token-layer.md) are a defensible case *because they carry text
labels* — if colour were their only channel, opting out would be the wrong call
and the fix would be to add the label.

## Gotchas

### Checkboxes stay platform blue
**Symptom.** The checkout form's controls ignore the accent while the buttons
beside them honour it.
**Cause.** `color-scheme` themes control *chrome*, not the fill tint.
**Fix.** `accent-color: var(--accent)` on `:root`.

### Placeholder text fails contrast despite a compliant token
**Symptom.** An audit flags placeholders whose colour was checked and passed.
**Cause.** A UA default opacity is multiplying the colour, so the rendered value
is lighter than the measured one.
**Fix.** `::placeholder { color: var(--text-muted); opacity: 1; }`.

### The text caret is invisible in one theme
**Symptom.** Focused inputs appear to accept no typing until characters appear.
**Cause.** The platform caret colour was chosen against the platform canvas, not
against a themed field background.
**Fix.** `caret-color: var(--text)`.

### Selected text is unreadable
**Symptom.** Highlighting a paragraph in dark mode hides it.
**Cause.** The UA selection colours assume a light canvas.
**Fix.** Theme `::selection` with `--accent` and `--accent-contrast`.

### Autofilled fields are unreadable
**Symptom.** Pale yellow field, themed dark text.
**Cause.** The UA's autofill background is not settable via `background-color`.
**Fix.** The inset `box-shadow` plus `-webkit-text-fill-color`. Treat it as
remediation and make sure the field is still legible without it.

### The autofill fix broke and nobody noticed for a month
**Symptom.** Unreadable fields return after a browser update.
**Cause.** Reliance on non-standard prefixed selectors, escalated with
`!important` so the fallback was never considered.
**Fix.** Choose a field background that is survivable when the block does not
apply. A remediation must degrade to something usable.

### The dashboard chart keeps the old palette after a theme change
**Symptom.** Everything themes except the canvas.
**Cause.** The colours were read once with `getComputedStyle` and cached in a
drawing module.
**Fix.** Read inside the draw call, and redraw on the theme change (chunk 05) —
or use SVG that references the custom properties directly and needs no listener.

### A colour read from a custom property will not parse
**Symptom.** A canvas fill silently does nothing, or draws black.
**Cause.** `getPropertyValue` returns the value with its leading whitespace
intact.
**Fix.** `.trim()`.

### High-contrast mode loses the tile boundaries
**Symptom.** Product tiles run together in Windows High Contrast.
**Cause.** The boundary was a themed background, and forced colours replaced it.
**Fix.** A `forced-colors` block redrawing the edge with a system colour keyword
such as `CanvasText`.

## Interview questions

**`color-scheme` is set correctly and the checkboxes are still blue. Why?**
`color-scheme` governs control chrome and the canvas, not the control's accent
fill. That is `accent-color`, and one declaration on `:root` inherits everywhere.

**Why does `::placeholder` need `opacity: 1`?**
Several engines apply a default opacity to placeholder text, so the rendered
colour is lighter than the token that was contrast-checked. Resetting opacity
makes the audited value the rendered value.

**When is writing `scrollbar-color` worth it?**
Only when the scrollbar should match the palette rather than the platform.
`color-scheme` already produces a correct dark scrollbar, so this property is
opt-in styling, not part of making dark mode work.

**Why `-webkit-text-fill-color` instead of `color` on an autofilled field?**
The autofill styling wins over `color`. `-webkit-text-fill-color` is what
actually takes effect — as is painting the background with a large inset
`box-shadow`, since `background-color` does not apply either.

**What is the risk in the autofill fix, and how is it managed?**
It relies on non-standard prefixed selectors that may stop applying. It is
managed by making the un-remediated field legible anyway, rather than by
escalating the rule with `!important`.

**Why might SVG be preferable to canvas for the admin charts?**
SVG can reference `var(--series-N)` directly and re-resolves with the cascade on
a theme change. Canvas copies values out of CSS at draw time, so it needs an
explicit listener and redraw.

**Why read the token inside the draw call rather than at module scope?**
So the component is correct as soon as anything redraws it. Caching at module
scope turns a theme change into a two-step invalidate-then-redraw problem for no
benefit.

**Is `forced-colors` a third theme to author?**
No. It is the user replacing the palette, and the job is to make sure nothing
breaks — chiefly boundaries that were drawn as backgrounds. Reasserting the
palette with `forced-color-adjust: none` is justified only where colour genuinely
carries data and the element does not rely on colour alone.

---

← Prev: [Images and media](04-images-media-and-controls.md) · Index: [Dark mode](README.md) · Next → [Persisting and syncing](05-persisting-and-syncing.md)
