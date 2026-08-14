---
title: "Dark mode properly"
sidebar_label: "03 · Dark mode properly"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [`color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme)**,
> [`prefers-color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
> and [`light-dark()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark),
> and the **W3C CSS Color Adjustment Level 1** specification.
> Baseline: `color-scheme` **widely available**; `light-dark()` **newly available
> since 2024-05-13** (`web-features` 3.34.3).

**Dark mode is a token problem, not a colour problem.** Inverting colours
produces something that technically has a dark background and is unpleasant to
use. The work is in naming things by role rather than by appearance.

## Semantic tokens, not inverted colours

```css
/* ⚠️ appearance-named — cannot be themed */
--grey-100: #f5f5f5;
--blue-600: #2563eb;

/* ✅ role-named — theming is a value change */
--surface:        #ffffff;
--surface-raised: #f7f7f8;
--text:           #16181d;
--text-muted:     #5b616e;
--border:         #d9dce1;
--accent:         #2563eb;
```

Components reference roles only:

```css
.card { background: var(--surface-raised); color: var(--text); border: 1px solid var(--border); }
```

Now a theme is a set of values, and **no component rule changes**:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --surface:        #16181d;
    --surface-raised: #1e2128;
    --text:           #e8e8ea;
    --text-muted:     #9aa1ad;
    --border:         #2c313a;
    --accent:         #60a5fa;
  }
}
```

The three-tier structure — primitives, semantic roles, component tokens — is the
standard arrangement, and the middle tier is the one that makes theming possible.

## `color-scheme` is not optional

```css
:root { color-scheme: light dark; }
```

This declares which schemes the page supports, and it is what makes **native UI**
follow the theme: form controls, scrollbars, the default canvas colour, and the
spellcheck underline. Without it a dark page keeps light scrollbars and white
form fields — the single most common "the dark mode looks broken" report.

It also prevents the flash of a white canvas before your CSS paints, because the
browser knows the page's preferred scheme before applying styles.

## `light-dark()`

Where supported, it keeps both values adjacent instead of splitting them across a
media query:

```css
:root {
  color-scheme: light dark;               /* required for it to work */
  --surface: light-dark(#ffffff, #16181d);
  --text:    light-dark(#16181d, #e8e8ea);
}
```

It resolves using the **used** colour scheme, which is why `color-scheme` must be
declared. Being **newly available (2024-05-13)** rather than widely, it is a
progressive enhancement — a media-query fallback is still needed for older
browsers.

## The explicit override must beat the system

A theme toggle is a user decision and must outrank the OS preference. Two
approaches:

```css
/* system default */
:root { --surface: #ffffff; --text: #16181d; }

@media (prefers-color-scheme: dark) {
  :root { --surface: #16181d; --text: #e8e8ea; }
}

/* explicit override — wins because it is later and more specific */
:root[data-theme="light"] { --surface: #ffffff; --text: #16181d; color-scheme: light; }
:root[data-theme="dark"]  { --surface: #16181d; --text: #e8e8ea; color-scheme: dark; }
```

Note `color-scheme` is set in the override too, so native controls follow the
explicit choice rather than the system.

**Order matters**: the attribute rules must come after the media query, or the
media query wins on source order when specificity ties. This is
[Phase 2 · What the cascade compares](../phase-2-cascade/01-what-the-cascade-compares.md)
in practice — and putting the media query in an early `@layer` is a cleaner way
to guarantee it.

## The flash, and why it needs script

The theme attribute has to be on the element **before first paint**, which CSS
cannot do — a stored preference lives in `localStorage`. The standard fix is a
tiny blocking script in `<head>`:

```html
<script>
  const t = localStorage.getItem('theme');
  if (t) document.documentElement.dataset.theme = t;
</script>
```

Blocking is deliberate here: deferring it guarantees a visible flash. It is one
of the few genuinely justified render-blocking inline scripts.

## Dark mode is not just inversion

Three adjustments that separate a considered dark theme from an inverted one:

- **Reduce saturation.** Vivid colours vibrate against dark backgrounds. Brand
  colours usually need lightening *and* desaturating — `--accent` above went from
  `#2563eb` to a lighter, softer blue.
- **Elevation is lighter, not shadowed.** Shadows are nearly invisible on dark
  backgrounds; raised surfaces read as *lighter* rather than as shadowed, which
  is why `--surface-raised` is above `--surface` in lightness.
- **Pure black and pure white are both wrong.** `#000` with `#fff` text produces
  halation that makes text hard to read. Near-black and near-white are standard.

## Trade-off

**Semantic tokens make theming trivial and add a layer of indirection to every
colour decision.** A developer who wants "a slightly darker border here" must
either use an existing role, invent a new token, or break the system with a raw
value. The first is often not quite right, the second inflates the token set, and
the third is what actually happens under deadline.

Testing cost doubles honestly and more than doubles in practice: every surface
needs checking in both themes, and contrast must be verified in both because a
pair that passes in light can fail in dark. Combined with `prefers-contrast` and
`forced-colors` ([Phase 6](../phase-6-container-queries/03-user-preference-queries.md))
the matrix grows faster than anyone tests it.

The mitigation is the same one that makes the whole thing work: **keep theming at
the token layer**. If no component rule ever mentions a theme, the number of
places a theme can break stays equal to the number of tokens, not the number of
components.

## Gotchas

**Scrollbars and form controls stay light.**
*Symptom:* native UI does not match the theme.
*Cause:* missing `color-scheme`.
*Fix:* `:root { color-scheme: light dark; }`, and set it in explicit overrides
too.

**The theme flashes on load.**
*Symptom:* a white flash before the dark theme applies.
*Cause:* the stored preference is applied after first paint.
*Fix:* a small blocking inline script in `<head>` that sets the attribute.

**The toggle is ignored.**
*Symptom:* the system preference always wins.
*Cause:* the media query comes after the attribute rules and ties on specificity.
*Fix:* order the attribute rules last, or put the media query in an earlier
layer.

**Dark mode looks harsh.**
*Symptom:* text is hard to read, colours vibrate.
*Cause:* pure black and white, and un-desaturated brand colours.
*Fix:* near-black/near-white, and lighten *and* desaturate accents.

**Raised surfaces are invisible.**
*Symptom:* cards do not stand out.
*Cause:* elevation expressed as shadow, which barely shows on dark backgrounds.
*Fix:* make raised surfaces lighter than the base surface.

## Interview questions

**★ Why is dark mode a token problem rather than a colour problem?**
Because it only works if colours are named by **role** — surface, text, border,
accent — rather than by appearance. Then a theme is a change of values at
`:root` and no component rule changes. Appearance-named tokens like `--grey-100`
cannot be themed at all.

**★ What does `color-scheme` do and why is it required?**
It declares which schemes the page supports, so native UI — scrollbars, form
controls, the default canvas — follows the theme. Without it a dark page keeps
light native chrome. It is also what `light-dark()` resolves against.

**★ How do you let a user override the system preference?**
Put the explicit choice in a selector that wins the cascade — typically
`:root[data-theme="dark"]` after the media query — and set `color-scheme` there
too so native controls follow. Because specificity ties, source order or layer
order must favour the override.

**Why does preventing the theme flash require JavaScript?**
The stored preference lives in `localStorage`, which CSS cannot read, and the
attribute must be set before first paint. A small blocking inline script in
`<head>` is the standard and justified solution.

**Name three ways a good dark theme differs from an inverted one.**
Accents are lightened *and* desaturated; elevation is shown by lighter surfaces
rather than shadows; and pure black/white are avoided because the contrast causes
halation.

**What is `light-dark()` and can you rely on it?**
A function that picks between two values based on the used colour scheme, keeping
both adjacent instead of split across a media query. It is newly available
(2024-05-13), so treat it as an enhancement over a media-query fallback.

---

← [02 · `color-mix()`](./02-color-mix.md) · Back to [Phase 8 overview](./README.md)
