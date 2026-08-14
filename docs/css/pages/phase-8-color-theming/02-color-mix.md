---
title: "color-mix()"
sidebar_label: "02 · color-mix()"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [`color-mix()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix)**
> and the **W3C CSS Color Level 5** specification.
> Baseline: **Widely available since 2023-05-09** (`web-features` 3.34.3).

**One brand token can generate an entire state palette.** Hover, active,
disabled, borders and focus rings all derive from a single colour, in CSS, at
runtime — which is what makes theming work without a build step.

## The syntax

```css
color-mix(in oklab, var(--brand) 80%, white)
```

Three parts: the **interpolation space**, the first colour with an optional
percentage, and the second colour. If one percentage is given, the other is the
remainder.

```css
--brand-hover:    color-mix(in oklab, var(--brand) 85%, black);
--brand-active:   color-mix(in oklab, var(--brand) 70%, black);
--brand-subtle:   color-mix(in oklab, var(--brand) 12%, var(--surface));
--brand-border:   color-mix(in oklab, var(--brand) 40%, var(--surface));
--brand-disabled: color-mix(in oklab, var(--brand) 35%, var(--surface));
```

Five derived tokens from one input. Change `--brand` and every one of them
follows — including inside a dark theme, because `--surface` changes too.

## The interpolation space matters

The `in <space>` argument is required, and it changes the result:

```css
color-mix(in srgb,  blue 50%, yellow)   /* muddy grey-green */
color-mix(in oklab, blue 50%, yellow)   /* a cleaner mid-tone */
```

Mixing in sRGB averages the display channels, which passes through desaturated
mud for complementary colours — the same reason `linear-gradient` between blue
and yellow looks grey in the middle by default.

**Use `in oklab` as the default** for mixing towards white, black or another
colour. Use `in oklch` when you want the *hue path* to be interpolated — mixing
two hues in `oklch` travels around the hue wheel, which is right for a rainbow
scale and wrong for a tint.

For hue-based spaces you can also state the direction:

```css
color-mix(in oklch longer hue, red, blue)
```

## Tinting towards the surface, not towards white

A detail that separates a palette that works in dark mode from one that does not:

```css
/* ⚠️ breaks in dark mode */
--brand-subtle: color-mix(in oklab, var(--brand) 12%, white);

/* ✅ follows the theme */
--brand-subtle: color-mix(in oklab, var(--brand) 12%, var(--surface));
```

Mixing towards `white` produces a pale tint that is invisible on a dark
background. Mixing towards the **surface token** produces a subtle tint of
whatever the background currently is — light or dark — with no second set of
values.

**This one substitution is most of what "theme-aware colour" means in practice.**

## Transparency without a second value

`transparent` is a valid operand, which gives alpha variants from the same token:

```css
--brand-a20: color-mix(in oklab, var(--brand) 20%, transparent);
.focus-ring { box-shadow: 0 0 0 3px var(--brand-a20); }
```

This is more maintainable than a parallel set of `rgb(… / 0.2)` values, because
there is still only one source colour.

## Where it beats a preprocessor

Sass's `color.adjust()` and friends do the same arithmetic **at build time**,
which means they cannot see a runtime value. `color-mix()` can:

```css
.theme { --brand: oklch(0.65 0.15 250); }
[data-theme="forest"] { --brand: oklch(0.6 0.14 150); }

.button { background: color-mix(in oklab, var(--brand) 85%, black); }
```

Switching `data-theme` recomputes every derived colour immediately. A Sass
function would have baked one answer into the output, and a user-chosen accent
colour — set from JavaScript — could not work at all.

This is the clearest case in CSS where a native feature genuinely replaced a
preprocessor capability rather than merely duplicating it, and it is worth
remembering for [Phase 10 · SCSS](../phase-10-scss/README.md).

## Trade-off

**Derived colours guarantee consistency and remove per-colour control.** A
generated hover state is right often enough, and occasionally a specific colour
needs to be *chosen* rather than computed — a brand's exact secondary, a state
that must hit a contrast target on one particular background. Derivation gives no
place to put that exception except overriding the derived token, which quietly
breaks the "one source" promise.

The contrast question is the sharper cost: **`color-mix()` guarantees nothing
about legibility.** A 12% tint of a mid-blue on white and the same tint on a dark
surface have very different contrast against their foreground text, and nothing
in the syntax will warn you. Generated palettes still need checking against
foreground pairs — see
[03 · Dark mode properly](./03-dark-mode-properly.md).

The reasonable position: derive the *relationships* — hover is a little darker,
subtle is a light tint — and pin the handful of colours that carry contrast
requirements.

## Gotchas

**The mix comes out muddy.**
*Symptom:* two vivid colours mix to grey.
*Cause:* `in srgb` averages display channels and passes through desaturation.
*Fix:* `in oklab`.

**A subtle tint is invisible in dark mode.**
*Symptom:* the background disappears when the theme flips.
*Cause:* mixing towards `white` rather than towards the surface token.
*Fix:* `color-mix(in oklab, var(--brand) 12%, var(--surface))`.

**The whole declaration is dropped.**
*Symptom:* no colour at all.
*Cause:* the interpolation space is missing — `in <space>` is required — or a
`var()` inside resolved to something that is not a colour.
*Fix:* include the space; give `var()` a colour fallback.

**Percentages do not behave as expected.**
*Symptom:* the mix is the wrong way round.
*Cause:* the percentage attaches to the colour it follows;
`color-mix(in oklab, black 20%, white)` is *20% black*.
*Fix:* read it as "this much of this colour".

**Generated states fail contrast checks.**
*Symptom:* a derived disabled colour is unreadable.
*Cause:* mixing preserves relationships, not contrast ratios.
*Fix:* check foreground/background pairs and pin the ones that must meet a
target.

## Interview questions

**★ What does `color-mix()` let you do that a preprocessor cannot?**
Mix at **runtime**, against values that are not known at build time. Because it
operates on custom properties, changing `--brand` — from a theme attribute or
from JavaScript — recomputes every derived colour immediately. Sass bakes one
result into the output.

**★ Why does the interpolation space matter, and what should you default to?**
Mixing in sRGB averages display channels and passes through desaturated mud for
complementary colours. `in oklab` is perceptually uniform and is the sensible
default for tints and shades; `in oklch` interpolates around the hue wheel, which
suits hue ramps.

**★ Why mix towards `var(--surface)` rather than towards `white`?**
So the tint follows the theme. Mixing towards white gives a pale colour that
vanishes on a dark background; mixing towards the surface token produces a subtle
tint of whatever the current background is, with no second set of values.

**How do you get an alpha variant of a token?**
Mix it with `transparent` — `color-mix(in oklab, var(--brand) 20%, transparent)`
— which keeps a single source colour rather than a parallel set of `rgb(… / α)`
values.

**What does `color-mix()` not guarantee?**
Contrast. It preserves relationships between colours, not legibility against a
foreground, so generated palettes still need checking against the pairs that
carry text.

---

← [01 · `oklch()` and perceptual colour](./01-oklch-and-perceptual-colour.md) · Next: [03 · Dark mode properly](./03-dark-mode-properly.md) →
