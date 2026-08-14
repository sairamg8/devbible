---
title: "02 · Inline styles, custom properties and computed values"
sidebar_label: "02 · Inline styles and custom properties"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`HTMLElement.style`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/style), [`CSSStyleDeclaration`](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleDeclaration), [`CSSStyleDeclaration.setProperty()`](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleDeclaration/setProperty), [`CSSStyleDeclaration.getPropertyValue()`](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleDeclaration/getPropertyValue), [`CSSStyleDeclaration.cssText`](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleDeclaration/cssText), [`Window.getComputedStyle()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle), [Using CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_cascading_variables/Using_CSS_custom_properties), [`Document.adoptedStyleSheets`](https://developer.mozilla.org/en-US/docs/Web/API/Document/adoptedStyleSheets). Documentation-validated; **no timings**.

## `element.style` is the `style` **attribute**, and nothing else

This is the single most misunderstood line in DOM styling:

```js
el.style.color;   // '' — even though the element is visibly red from a stylesheet
```

`element.style` is a `CSSStyleDeclaration` over the element's **inline `style` attribute**. A rule
in a stylesheet is not in it. So `el.style.color` reads back only what *you* (or someone else's
JavaScript) wrote inline, and an empty string is the normal answer for a styled element.

To ask what the element actually looks like, you need `getComputedStyle` — later on this page.

## The property-name mapping, and the one exception

Dashed CSS names become camelCase properties:

```js
el.style.backgroundColor = 'red';    // background-color
el.style.zIndex = '10';              // z-index
el.style.cssFloat = 'left';          // float — reserved word, hence the prefix
```

🔴 **Custom properties are exempt from that mapping and must go through `setProperty`.** There is
no camelCase form of `--brand-color`, and bracket access does not work either:

```js
el.style['--brand'] = 'tomato';                 // ⚠️ does nothing useful
el.style.setProperty('--brand', 'tomato');      // ✅
el.style.getPropertyValue('--brand');           // 'tomato'
el.style.removeProperty('--brand');
```

`setProperty` / `getPropertyValue` / `removeProperty` also accept ordinary dashed names —
`setProperty('background-color', 'red')` — so if you prefer one style of access, that is the one
that covers every case.

## Silent failures, which is what makes this API annoying

CSS is designed to ignore what it cannot parse, and the CSSOM inherits that. **Nothing throws.**

```js
el.style.width = 100;         // ⚠️ ignored — no unit
el.style.width = '100px';     // ✅
el.style.color = 'tomatoe';   // ⚠️ ignored — invalid keyword, silently
```

Numbers are the common one, because most of the time you are computing them:

```js
el.style.width = `${w}px`;    // the template literal is not optional
```

The unitless properties are the exceptions you already know from CSS — `opacity`, `z-index`,
`line-height`, `flex-grow`, `order` — and they take a *string* too, though a number is coerced.

⚠️ **`el.style.cssText = '…'` replaces every inline declaration at once.** It is the fast way to
set several, and the easy way to destroy an inline style someone else depends on. Prefer
individual assignments, or `setProperty`, unless clearing is what you meant.

**`removeProperty('color')` deletes the declaration**; setting it to `''` does the same thing.
Setting it to `'initial'` or `'unset'` does **not** — those are real values that override the
stylesheet, which is a different outcome entirely.

## `!important` from JavaScript

The assignment form cannot express it. `setProperty` can, via a third argument:

```js
el.style.setProperty('display', 'none', 'important');
```

Needing this is usually a signal that something else is fighting you — a third-party stylesheet,
or your own `!important`. It is worth knowing the API exists and worth being reluctant to use it.

## `getComputedStyle` — what the element *actually* looks like

```js
const cs = getComputedStyle(el);
cs.color;                         // 'rgb(255, 0, 0)' — resolved, not 'red'
cs.getPropertyValue('font-size'); // '16px'
```

Four things to know:

**1 · It is read-only.** The returned object is live in the sense that it reflects the current
state, but writing to it does nothing useful.

**2 · Values come back resolved, not as authored.** Colours are `rgb(…)`, lengths are usually in
pixels, and shorthands may be reported as their longhands. Do not string-compare against the value
you wrote in the stylesheet.

**3 · Reading it is not free.** The browser must have up-to-date style and layout information to
answer, so a read that follows a write forces the pending work to happen synchronously. Doing that
in a loop is **layout thrashing** — the subject of **11 · Layout thrashing** *(not written yet)*.
The habit worth forming now: **batch all reads, then all writes.**

**4 · Custom properties come back as written.** MDN notes the value may include leading
whitespace, so:

```js
getComputedStyle(el).getPropertyValue('--gap').trim();   // 🔴 the .trim() is required
```

A custom property's computed value is essentially the token stream you wrote — it is not resolved
to pixels, and it is not validated. `--gap: banana` computes to `banana` quite happily and only
fails where it is *used*.

## The custom-property bridge — the pattern worth taking away

When JavaScript genuinely knows a value the stylesheet cannot — a pointer position, a measured
height, a user-chosen accent — **do not write the styled property. Write a custom property and let
CSS use it.**

```js
// JS writes ONE value
card.style.setProperty('--tilt', `${angle}deg`);
root.style.setProperty('--accent', userColour);
```

```css
/* CSS owns everything about the look */
.card       { transform: rotate(var(--tilt, 0deg)); transition: transform .2s; }
@media (prefers-reduced-motion: reduce) { .card { transition: none; } }
```

This keeps every advantage of the class-first rule while still letting a computed number in. The
design can change what `--tilt` *does* — rotate, skew, shift a gradient — without touching the
JavaScript, and the media query still works because the declaration lives in CSS.

Custom properties **inherit**, so setting one on `document.documentElement` themes the whole page
in one assignment — which is how a runtime theme switcher is built without a stylesheet swap.

## When you need to style many elements at once

Looping over a thousand nodes to set an inline style is the wrong shape. Two better answers:

- **Toggle one class higher up.** `container.classList.add('is-compact')`, and let one CSS rule do
  the work for every descendant. This is nearly always the right answer.
- **Add a rule, not a thousand declarations.** Constructable stylesheets —
  `new CSSStyleSheet()`, `sheet.replaceSync(css)`, then
  `document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]` — let you install real
  CSS at runtime, and they are the supported way to style inside a shadow root.

The older `document.styleSheets[0].insertRule(…)` still exists and still works; the constructable
form is the one to reach for in new code because a sheet can be shared across documents and shadow
roots without being re-parsed.

## Gotchas

**Symptom:** `el.style.color` is `''` on an obviously coloured element
**Cause:** `element.style` reads the inline `style` attribute only, never a stylesheet.
**Fix:** `getComputedStyle(el).color` — and expect `rgb(…)`, not the keyword you wrote.

**Symptom:** Setting a custom property through `el.style['--x']` did nothing
**Cause:** Custom properties have no camelCase mapping and are not exposed as properties.
**Fix:** `el.style.setProperty('--x', value)`.

**Symptom:** A width assignment was silently ignored
**Cause:** A number with no unit — `el.style.width = 100`.
**Fix:** `` el.style.width = `${w}px` ``. CSS ignores what it cannot parse; nothing throws.

**Symptom:** A typo'd colour left the element unstyled with no error
**Cause:** Same rule — an invalid value is dropped silently.
**Fix:** There is no error to catch; verify by reading the value back, which returns `''`.

**Symptom:** Other inline styles vanished
**Cause:** `style.cssText = '…'` replaces the entire inline declaration block.
**Fix:** Assign properties individually, or `setProperty`.

**Symptom:** A custom property read back with a leading space and a comparison failed
**Cause:** `getPropertyValue` on a custom property preserves whitespace, as MDN notes.
**Fix:** `.trim()`.

**Symptom:** `--gap: banana` did not throw anywhere
**Cause:** Custom properties are not validated at declaration time; they fail at use.
**Fix:** Expect the failure downstream, in the property that consumed `var(--gap)`.

**Symptom:** Setting a property to `'initial'` did not restore the stylesheet value
**Cause:** `initial` is a real value that overrides the cascade; it is not "remove".
**Fix:** `removeProperty(name)`, or assign `''`.

**Symptom:** An animation loop that reads `getComputedStyle` is janky
**Cause:** Each read after a write forces synchronous style and layout work.
**Fix:** Batch reads, then writes — and prefer writing a custom property that CSS animates.

**Symptom:** `!important` in the stylesheet beats the inline style you set
**Cause:** Inline beats everything *except* `!important`.
**Fix:** `setProperty(name, value, 'important')` — and treat needing it as a smell.

## Interview questions

**★ What does `element.style` actually contain?**
The element's **inline `style` attribute**, as a `CSSStyleDeclaration`. Nothing from any
stylesheet — so an element styled entirely by CSS reads back `''` for every property.

**★ How do you read or write a CSS custom property from JavaScript?**
`setProperty('--x', v)` and `getPropertyValue('--x')`. There is no camelCase mapping for custom
properties, so `style.--x` and `style['--x']` do not work — and a value read from
`getComputedStyle` may carry leading whitespace, so `.trim()` it.

**★ Why did `el.style.width = 100` do nothing?**
No unit, so the declaration fails to parse — and CSS drops what it cannot parse rather than
throwing. Every length needs a unit string.

**★ `style` versus `getComputedStyle` — when do you need each?**
`style` to read or write **your own** inline declarations; `getComputedStyle` to ask what the
element resolves to after the cascade. The computed values come back resolved (`rgb(…)`, pixels),
and reading them can force synchronous layout, so batch reads away from writes.

**★ You need JavaScript to control an animated value. What is the least bad way?**
Write a **custom property** and let CSS consume it: `el.style.setProperty('--tilt', …)` with
`transform: rotate(var(--tilt))` in the stylesheet. The look, the transition and the
`prefers-reduced-motion` handling stay in CSS, and JavaScript contributes only the number it
alone knows.

**★ How do you style a thousand elements at once?**
Toggle one class on a common ancestor and let a single CSS rule apply — or install a real rule
with a constructable stylesheet (`new CSSStyleSheet()`, `replaceSync`, `adoptedStyleSheets`).
Never a loop of inline assignments.

**How do you set `!important` from JavaScript?**
Only through `setProperty(name, value, 'important')` — the assignment form cannot express
priority.

**Why does setting a property to `'initial'` not undo it?**
Because `initial` is a value, and an inline value still wins over the stylesheet. Removing the
declaration is `removeProperty(name)` or assigning `''`.

---

← [01 · `classList` and the class-first rule](./01-classlist.md) · [Topic index](./README.md) ·
**09 · Forms** *(not written yet)* →
