---
title: "Part 4 — SCSS and architecture"
sidebar_label: "4 · SCSS and architecture"
sidebar_position: 4
---

> **Phases 10–11 · 18 topics · 7 Master**
> What Sass still earns now that nesting, custom properties and colour functions
> are native — and how styles reach a component in a real application.

Native CSS took nesting, variables, colour manipulation and cascade control.
That subtraction is the honest starting point for Sass in 2026: it is still
useful, for a **smaller and sharper** set of reasons than in 2018.

---

## Phase 10 — SCSS in 2026

*9 topics.* Scoped to what a fullstack developer needs to read, maintain and
decide about — not a Sass language course.

| Topic | Tier |
|---|---|
| **What native CSS took, and what Sass still has** — nesting, variables and colour functions are native; **loops, mixins with logic, compile-time partials and the module system are not**. The honest 2026 list, and the decision procedure it implies | <span className="db-tier t-master">Master</span> |
| **Sass variables vs CSS custom properties** — compile-time constant vs inherited runtime value; the one thing each can do that the other cannot (a Sass variable can drive a `@media` condition; a custom property can be themed, scoped and changed from script) | <span className="db-tier t-master">Master</span> |
| **`@use` and `@forward`** — the module system that replaced `@import`; namespacing, `with` for configuration, private members, and why `@import` is deprecated in Sass too | <span className="db-tier t-master">Master</span> |
| **Mixins, and when a mixin beats a class** — `@mixin`/`@include` with arguments and `@content`; the media-query mixin, and the output-duplication cost that `@extend` was supposed to solve and made worse | <span className="db-tier t-understand">Understand</span> |
| **Generating CSS from data** — `@each`, `@for`, maps and `map.get`; the spacing-scale and utility-class generators that are the strongest remaining argument for Sass | <span className="db-tier t-understand">Understand</span> |
| **The hybrid that actually works** — Sass generates the **structure** (tokens, scales, utilities) while custom properties carry the **runtime values** (themes, component APIs). Using either alone is the common mistake | <span className="db-tier t-understand">Understand</span> |
| Sass nesting vs native nesting — `&__element` string concatenation is Sass-only, so a BEM codebase cannot simply drop the preprocessor | <span className="db-tier t-understand">Understand</span> |
| Sass colour functions vs `color-mix()` and relative colour — what moved into the browser, and what `color.adjust` still does at build time | <span className="db-tier t-understand">Understand</span> |
| The build — `sass` vs `dart-sass` in a bundler, source maps, and the deprecation warnings you will meet in an older codebase | <span className="db-tier t-know">Know</span> |

**Gate:** you can look at a Sass file and say, for each construct in it, whether
native CSS now does that job — and migrate the ones that do without changing the
output.

---

## Phase 11 — Architecture and the stack

*9 topics.* CSS has one global namespace and no module boundary. Every approach
here solves that same problem differently, and this is the phase that answers
"so how do I actually style a React component".

| Topic | Tier |
|---|---|
| **`@layer`-based architecture** — reset / base / layout / components / utilities declared in one line at the top of the entry file; the structure that ends specificity wars, including swallowing a third-party stylesheet into a low layer | <span className="db-tier t-master">Master</span> |
| **Design tokens** — three tiers (primitive → semantic → component), naming that survives a rebrand, and why `--color-brand-600` and `--color-surface` are different kinds of thing | <span className="db-tier t-master">Master</span> |
| **CSS Modules** — local scoping by build-time renaming, `composes`, what the output actually looks like, and why it is the lowest-risk default in a React app | <span className="db-tier t-master">Master</span> |
| **Choosing an approach** — a decision table across plain CSS with layers, CSS Modules, Tailwind and CSS-in-JS, scored on team size, design-system maturity and build constraints | <span className="db-tier t-master">Master</span> |
| **Styling React components** — `className` composition, passing dynamic values through custom properties rather than inline styles, and where a `className` prop belongs in a component's API | <span className="db-tier t-understand">Understand</span> |
| **Theming** — multiple themes from one token set, `data-theme`, honouring `prefers-color-scheme` with an explicit override, and avoiding the flash on load | <span className="db-tier t-understand">Understand</span> |
| Tailwind in 2026 — the engine, `@theme` and CSS-first config, arbitrary values, why `@apply` is discouraged, and the honest velocity-versus-readability trade | <span className="db-tier t-understand">Understand</span> |
| The build pipeline — PostCSS, Lightning CSS, what a bundler does with an imported stylesheet, and per-route CSS splitting | <span className="db-tier t-understand">Understand</span> |
| CSS-in-JS — runtime vs zero-runtime, and why runtime CSS-in-JS lost ground with Server Components | <span className="db-tier t-know">Know</span> |

**Gate:** you can start a new React application's styling from an empty file —
layers declared, tokens defined, dark mode working — and give a written reason
for the approach you chose over the other three.

---

## Where this connects

- **Phase 10 → Phase 3** — the hybrid rule in Phase 10 only makes sense once
  custom properties are understood as runtime values.
- **Phase 11 → Phase 2** — an architecture built on `@layer` assumes the cascade
  order completely.
- **Phase 11 → React** — the React syllabus owns component design and
  re-rendering; this phase owns how styles reach the component. They meet at the
  `className` prop.
- **Deliberately not here:** typography, print stylesheets, form-control
  styling and a general accessibility survey. This syllabus is scoped to
  advanced CSS, not to everything CSS can do.

---

← [Part 3 — Adaptive, visual, motion](./03-adaptive-and-visual.md) · Back to [Overview](../README.md)
