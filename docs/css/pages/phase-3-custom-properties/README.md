---
title: "Phase 3 — Custom properties and modern values"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-14 against **MDN** and the **W3C CSS Values and Units Level 4**,
> **CSS Custom Properties Level 1** and **CSS Properties and Values API Level 1**
> specifications. Sources named per page. One result is **sandbox-measured** from
> `sandbox/css/ex12-inheritance-and-values.mjs` (Firefox 153.0.3, 2026-08-13).

**4 topics.** Custom properties are not variables; they are inherited runtime
values that participate in the cascade. That is what makes theming, component
APIs and animatable tokens possible.

| # | Page | Tier | One line |
|---|---|---|---|
| 01 | [Custom properties as a component API](./01-custom-properties-as-a-component-api.md) | <span className="db-tier t-master">Master</span> | The rule stays in CSS, the value comes from outside |
| 02 | [`clamp()`, `min()`, `max()`](./02-clamp-min-max.md) | <span className="db-tier t-master">Master</span> | Fluid sizing with no media query — and the `rem` term that keeps it zoomable |
| 03 | [`@property`](./03-at-property.md) | <span className="db-tier t-master">Master</span> | The type is what makes it animatable and what makes bad values fail safely |
| 04 | [Units that matter for layout](./04-units-that-matter.md) | <span className="db-tier t-understand">Understand</span> | `rem` vs `em`, `ch`, `dvh`, and what each percentage resolves against |

## The thread through the phase

A custom property starts as an untyped token stream that inherits. Everything
else here is a consequence:

- Because it **inherits**, it works as a component API — set it on an ancestor
  and the component reads it without either side coupling to the other.
- Because it is **untyped**, a bad value is invalid at computed-value time and
  leaves the property *unset* rather than falling back, and it cannot be
  animated.
- **`@property` supplies the missing type**, which fixes both at once — smooth
  interpolation, and a declared `initial-value` to fall back to.

The units page sits underneath all of it: the values you put *into* a custom
property still resolve by the ordinary rules, and percentages in particular do
not resolve against what most people assume.

## Phase gate

You can build a component whose spacing, colour and variant are all driven by
custom properties a consumer can override — without exposing a single extra
class.

## Where this connects

- **← [Phase 2 · Cascade control](../phase-2-cascade/README.md)** — custom
  properties resolve at computed-value time, one stage after the cascade has
  already picked a winner.
- **→ Phase 8 · Colour and theming** — `color-mix()` over custom properties is
  how one brand token generates a whole state palette.
- **→ Phase 10 · SCSS** — a Sass variable is a compile-time constant, a custom
  property is a runtime value. Knowing which job each does is that phase's
  central distinction.

---

← [Phase 2 · Cascade control](../phase-2-cascade/README.md) · Start → [01 · Custom properties as a component API](./01-custom-properties-as-a-component-api.md)
