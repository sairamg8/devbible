---
title: "Phase 8 — Colour and theming"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-14 against **MDN** and the **W3C CSS Color Level 4/5** and
> **CSS Color Adjustment Level 1** specifications. Sources named per page.
> Baseline data from `web-features` 3.34.3.

**✅ 3 of 3 topics written.** Colour left sRGB, and `oklch()` plus `color-mix()`
changed how design systems are built — one brand token can now generate an entire
state palette.

| # | Page | Tier | One line |
|---|---|---|---|
| 01 | [`oklch()` and perceptual colour](./01-oklch-and-perceptual-colour.md) | <span className="db-tier t-master">Master</span> | HSL's lightness lies; OkLCh's does not |
| 02 | [`color-mix()`](./02-color-mix.md) | <span className="db-tier t-master">Master</span> | Derive nine state colours from one brand token, at runtime |
| 03 | [Dark mode properly](./03-dark-mode-properly.md) | <span className="db-tier t-master">Master</span> | Semantic tokens, `color-scheme`, and beating the system preference |

## The through-line

**Name colours by role, generate the rest, and let the theme change the values.**

```css
:root {
  color-scheme: light dark;
  --brand:   oklch(0.65 0.15 250);                              /* 01 */
  --surface: #ffffff;
  --brand-hover:  color-mix(in oklab, var(--brand) 85%, black); /* 02 */
  --brand-subtle: color-mix(in oklab, var(--brand) 12%, var(--surface));
}
```

Mixing towards `var(--surface)` rather than `white` is the single substitution
that makes a palette theme-aware — the derived tints follow whatever the
background currently is.

## The two things most often missed

- **`color-scheme: light dark`** — without it, scrollbars and form controls stay
  light in dark mode, and the page looks half-themed.
- **`color-mix()` guarantees no contrast.** It preserves relationships, not
  legibility. Pairs that carry text still need checking in both themes.

## Phase gate

You can build a themable palette from three OkLCh brand tokens, generate every
state colour with `color-mix()`, and switch to dark mode without writing a second
set of colour values.

## Where this connects

- **← [Phase 3 · Custom properties](../phase-3-custom-properties/README.md)** —
  a theme is custom properties changing value; the component layer never knows.
- **← [Phase 6 · User-preference queries](../phase-6-container-queries/03-user-preference-queries.md)** —
  `prefers-color-scheme`, `prefers-contrast` and `forced-colors`.
- **→ Phase 10 · SCSS** — `color-mix()` is the clearest case of a native feature
  genuinely replacing a preprocessor capability, because it works at runtime.

---

← [Phase 7 · Positioning](../phase-7-positioning/README.md) · Start → [01 · `oklch()` and perceptual colour](./01-oklch-and-perceptual-colour.md)
