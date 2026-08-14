---
title: "Phase 10 — SCSS, practically"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-14 against the **official Sass documentation**
> (sass-lang.com) and **MDN** where CSS equivalents are compared.
> Sources named per page.

**✅ 8 of 8 topics written.** How to use SCSS and its features — not a CSS
architecture course. Scoped on the user's instruction: design tokens, CSS
Modules, Tailwind and CSS-in-JS are **deliberately not here**.

| # | Page | Tier | One line |
|---|---|---|---|
| 01 | [Setting up and compiling](./01-setting-up-and-compiling.md) | <span className="db-tier t-master">Master</span> | dart-sass, partials, watching, source maps |
| 02 | [Nesting and `&`](./02-nesting-and-ampersand.md) | <span className="db-tier t-master">Master</span> | `&__element` is the one thing native nesting cannot do |
| 03 | [Variables vs custom properties](./03-variables-sass-vs-custom-properties.md) | <span className="db-tier t-master">Master</span> | Compile-time constant vs live runtime value |
| 04 | [`@use` and `@forward`](./04-use-and-forward.md) | <span className="db-tier t-master">Master</span> | The module system that replaced `@import` |
| 05 | [Mixins](./05-mixins.md) | <span className="db-tier t-master">Master</span> | `@content`, and when a mixin should be a class |
| 06 | [Loops and maps](./06-loops-and-maps.md) | <span className="db-tier t-understand">Understand</span> | Generating selectors from data — Sass's strongest remaining case |
| 07 | [Sass functions](./07-sass-functions.md) | <span className="db-tier t-understand">Understand</span> | `math.div`, `sass:color`, and what moved to the browser |
| 08 | [Control flow and `@extend`](./08-control-flow-and-extend.md) | <span className="db-tier t-understand">Understand</span> | Why `@extend` is the one feature to avoid by default |

## What Sass still earns in 2026

Native CSS took nesting, variables and colour manipulation. What it did **not**
take is the honest remaining case:

| Still Sass's job | Why |
|---|---|
| **`@use` / `@forward`** | CSS has no module system |
| **Generating selectors** | `@each` can create class names; `calc()` cannot |
| **Mixins with logic and `@content`** | no CSS equivalent for a parameterised block |
| **Breakpoint variables** | `var()` does not work in a media-query condition |
| **`&__element`** | native `&` is a selector reference, not text |

And what it did take, which you should now use natively:

| Use CSS, not Sass | Because |
|---|---|
| `color-mix()` over `color.mix` | works at **runtime**, so it follows a theme |
| custom properties over `$variables` | themeable, scoped, settable from JS |
| native nesting (unless BEM) | no build step needed |

## The hybrid that works

**Sass generates the structure; custom properties carry the values.** A map feeds
both the `:root` custom properties and the generated utility classes, and the
classes reference the custom properties rather than literals — so a theme can
still override a step at runtime.

## Phase gate

You can set up a Sass build from scratch, split it into partials wired with
`@use`/`@forward`, generate a spacing scale from a map with `@each`, and write a
media-query mixin that takes a block with `@content`.

## Where this connects

- **← [Phase 3 · Custom properties](../phase-3-custom-properties/README.md)** —
  the distinction in topic 03 only lands once custom properties are understood as
  runtime values.
- **← [Phase 2 · `@layer`](../phase-2-cascade/02-layer/README.md)** — `@layer` is
  native cascade control; `@use` is build-time module control. Different halves.
- **← [Phase 8 · `color-mix()`](../phase-8-color-theming/02-color-mix.md)** — the
  clearest case of a native feature genuinely replacing a preprocessor one.

---

← [Phase 9 · Motion](../phase-9-motion/README.md) · Start → [01 · Setting up and compiling](./01-setting-up-and-compiling.md)
