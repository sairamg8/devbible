---
title: "Part 4 — SCSS"
sidebar_label: "4 · SCSS"
sidebar_position: 4
---

> **Phase 10 · 8 topics · 5 Master**
> How to actually use SCSS: setting it up, and each feature that earns its place.

This part is **how to use SCSS and its features** — not a CSS architecture
course. It is scoped to the constructs you will read, write and maintain in a
real stylesheet: the module system, mixins, loops and maps, and the functions
that still do work the browser cannot.

Native CSS took nesting, variables and colour manipulation. That subtraction is
noted where it matters — each feature below says plainly whether native CSS now
does the same job — but the phase teaches the Sass construct rather than
arguing about the stack.

---

## Phase 10 — SCSS, practically

*8 topics.* What a fullstack developer needs to read, write and maintain in a
Sass codebase.

| Topic | Tier |
|---|---|
| **Setting SCSS up and compiling it** — `sass` (dart-sass) on the command line and in a bundler, `.scss` vs `.sass`, partials and the `_name.scss` convention, watching, and source maps that map back to the partial | <span className="db-tier t-master">Master</span> |
| **Nesting and `&`** — how nesting compiles out, `&` for state and modifiers, `&__element` string concatenation (Sass-only, and the reason a BEM codebase cannot simply drop the preprocessor), and the depth at which nesting becomes a specificity problem | <span className="db-tier t-master">Master</span> |
| **Variables — Sass vs CSS custom properties** — `$size` is a compile-time constant, `--size` is an inherited runtime value; the one thing each can do the other cannot (a Sass variable can drive a `@media` condition; a custom property can be themed, scoped and set from script), and how to use both together | <span className="db-tier t-master">Master</span> |
| **`@use` and `@forward`** — the module system that replaced `@import`: namespacing, `as`, `with` for configuration, private members with `-`, and building one entry point from many partials | <span className="db-tier t-master">Master</span> |
| **Mixins — `@mixin`, `@include`, `@content`** — arguments and defaults, the media-query mixin, passing a block with `@content`, and why a mixin duplicates output while a class does not | <span className="db-tier t-master">Master</span> |
| **Loops and maps — generating CSS from data** — `@each`, `@for`, `@while`, map literals and `map.get`; the spacing scale and utility-class generators that are the strongest remaining argument for Sass | <span className="db-tier t-understand">Understand</span> |
| **Sass functions** — the built-in modules (`math`, `string`, `list`, `map`, `color`), writing your own with `@function`, and `math.div` replacing slash division | <span className="db-tier t-understand">Understand</span> |
| **Control flow and `@extend`** — `@if`/`@else` inside a mixin, and what `@extend` really compiles to (selector lists, not copied declarations) plus why placeholders `%name` are the only safe form | <span className="db-tier t-understand">Understand</span> |

**Gate:** you can set up a Sass build from scratch, split it into partials wired
with `@use`/`@forward`, generate a spacing scale from a map with `@each`, and
write a media-query mixin that takes a block with `@content`.

---

## Where this connects

- **Phase 10 → Phase 3** — Sass variables and CSS custom properties solve
  different halves of the same problem; Phase 3 is what makes the distinction
  land.
- **Phase 10 → Phase 2** — Sass has no cascade control. `@layer` is native and
  belongs to the cascade phase.
- **Deliberately not here:** CSS architecture, design-token systems, CSS
  Modules, Tailwind, CSS-in-JS and the build pipeline. **Cut on the user's
  instruction** — this part teaches SCSS usage and features, not how to
  structure an application's styles.

---

← [Part 3 — Adaptive, visual, motion](./03-adaptive-and-visual.md) · Back to [Overview](../README.md)
