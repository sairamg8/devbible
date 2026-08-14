---
title: "oklch() and perceptual colour"
sidebar_label: "01 · oklch() and perceptual colour"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [`oklch()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch)**
> and [CSS colors](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_colors),
> and the **W3C CSS Color Level 4** specification.
> Baseline: **Widely available since 2023-05-09** (`web-features` 3.34.3).

**HSL's lightness lies; OkLCh's does not.** Two HSL colours with `L: 50%` can
differ enormously in perceived brightness, which is why hand-built palettes look
uneven and why generated ones went wrong before OkLCh existed.

## The problem with HSL

```css
hsl(60 100% 50%)    /* yellow — looks bright */
hsl(240 100% 50%)   /* blue   — looks dark   */
```

Same lightness value, wildly different perceived brightness. HSL's `L` is a
mathematical midpoint of the sRGB channels, not a measure of how light something
*looks*. Human vision is far more sensitive to green and yellow wavelengths than
to blue.

The consequence for a design system: a token scale built by holding `L` constant
across hues produces a palette where some steps are legible and others are not,
and every fix is by eye.

## What OkLCh changes

```css
oklch(0.7 0.15 60)     /* L  C  H */
```

| Component | Range | Meaning |
|---|---|---|
| **L** — lightness | `0`–`1` (or `0%`–`100%`) | **perceptual** lightness; equal values look equally light |
| **C** — chroma | `0`–~`0.4` | colourfulness; `0` is grey, higher is more saturated |
| **H** — hue | `0`–`360` | the hue angle, as in HSL |

Because `L` is perceptual, `oklch(0.7 0.15 60)` and `oklch(0.7 0.15 240)` are
genuinely the same apparent lightness. That is the whole feature, and it is what
makes a generated scale trustworthy:

```css
:root {
  --brand-100: oklch(0.95 0.03 250);
  --brand-300: oklch(0.85 0.08 250);
  --brand-500: oklch(0.65 0.15 250);
  --brand-700: oklch(0.45 0.13 250);
  --brand-900: oklch(0.25 0.08 250);
}
```

One hue, evenly stepped lightness — and it will look evenly stepped, which the
HSL equivalent would not.

## Chroma is not saturation, and it has no fixed maximum

The one genuine awkwardness. Chroma's usable maximum **depends on the lightness
and hue**: a very light colour cannot also be very colourful, because such a
colour does not exist. Requesting one produces a value outside the display's
gamut, which the browser clamps.

Practical consequences:

- **Reduce chroma at the extremes** of a lightness scale. That is why `--brand-100`
  above has `0.03` and `--brand-500` has `0.15` — not an aesthetic choice but a
  gamut one.
- Values above roughly `0.37` are outside sRGB for most hues.
- Clamping is silent, so two steps can render identically if both were out of
  gamut.

## Wider gamuts, safely

OkLCh can express colours outside sRGB, which modern displays can show:

```css
.accent { background: oklch(0.7 0.28 145); }   /* more vivid than sRGB allows */
```

On a P3 display this is genuinely more saturated; on an sRGB display it is
clamped to the nearest representable colour. That degradation is automatic and
acceptable, but if the exact colour matters, gate it:

```css
.accent { background: #22c55e; }
@supports (color: color(display-p3 0 1 0)) {
  .accent { background: oklch(0.7 0.28 145); }
}
```

## The related notations

`oklch()` is polar (lightness, chroma, hue); `oklab()` is the same space in
Cartesian form (lightness, green–red axis, blue–yellow axis). **`oklch()` is the
one to author in**, because hue as an angle is what you actually want to
manipulate. `oklab()` is easier for interpolation maths, which is why it turns up
as a default interpolation space rather than in stylesheets.

`lch()` and `lab()` are the older CIE versions. OkLab/OkLCh corrected known hue
shifts in CIELAB, particularly in blues — a blue lightened in `lch()` drifts
towards purple, and in `oklch()` it does not. **Prefer the Ok- variants.**

## Trade-off

**OkLCh is correct and unfamiliar, and the numbers are not memorable.** Nobody
recognises `oklch(0.65 0.15 250)` the way they recognise `#3b82f6`, and there is
no equivalent of "just darken it 10%" that a designer can do in their head. Tools
help — every modern picker supports it — but code review is genuinely harder,
because a wrong hue angle looks like a right one.

The gamut coupling between lightness and chroma is the second real cost: a scale
cannot hold chroma constant, so the "one hue, stepped lightness" story is not
quite as clean as it first appears, and getting the chroma curve right still takes
judgement.

Where it clearly pays: **generated palettes and design tokens**, exactly where
evenness matters and where the values are computed rather than read. For a
handful of one-off brand colours, hex is still perfectly reasonable and easier for
everyone to recognise.

## Gotchas

**Two lightness steps look identical.**
*Symptom:* `--brand-400` and `--brand-500` render the same.
*Cause:* both requested a chroma outside the gamut at that lightness, and both
were clamped to the same representable colour.
*Fix:* lower the chroma, especially at very high and very low lightness.

**A light tint looks washed out and grey.**
*Symptom:* the `100` step has no colour.
*Cause:* high lightness supports very little chroma.
*Fix:* accept a low chroma at the light end — that is physically correct — or
shift the hue slightly.

**The colour is more vivid on one monitor than another.**
*Symptom:* inconsistent appearance across displays.
*Cause:* the value is outside sRGB; wide-gamut displays show more of it.
*Fix:* expected. Gate with `@supports` if the exact colour is contractual.

**Percentages and decimals are mixed up.**
*Symptom:* `oklch(70 0.15 250)` produces black or nothing.
*Cause:* lightness is `0`–`1` or `0%`–`100%`; `70` unqualified is out of range.
*Fix:* `0.7` or `70%`.

**A blue lightens towards purple.**
*Symptom:* hue drift when adjusting lightness.
*Cause:* using `lch()`/`lab()` rather than the Ok- variants.
*Fix:* `oklch()`, which corrects exactly this.

## Interview questions

**★ Why is `oklch()` better than `hsl()` for a design system?**
Because OkLCh's lightness is perceptual: two colours with the same `L` look
equally light regardless of hue. HSL's lightness is a mathematical midpoint, so
`hsl(60 100% 50%)` looks far brighter than `hsl(240 100% 50%)`. A token scale
built on HSL is uneven and has to be corrected by eye.

**★ What is chroma and why can it not be held constant across a scale?**
Chroma is colourfulness. Its usable maximum depends on lightness and hue — a very
light colour cannot also be very colourful, because no such colour exists. Values
out of gamut are silently clamped, so a scale must reduce chroma at the light and
dark ends.

**★ What is the difference between `oklch()` and `oklab()`, and between those and
`lch()`/`lab()`?**
`oklch()` is the polar form (lightness, chroma, hue) and is what you author in;
`oklab()` is the same space in Cartesian form, better suited to interpolation.
The `lch()`/`lab()` pair are the older CIE versions, which have hue-shift
problems the Ok- variants fix — most visibly blues drifting purple when
lightened.

**How do you use a wide-gamut colour safely?**
Provide an sRGB fallback and gate the wide-gamut value behind `@supports`.
Without gating, out-of-gamut colours are clamped — usually acceptable, but not if
the exact colour matters.

**Why might two steps of a generated palette look the same?**
Both requested chroma beyond the gamut at their lightness and were clamped to the
same colour.

---

Next: [02 · `color-mix()`](./02-color-mix.md) →
