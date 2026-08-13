---
title: "Part 1 — How CSS resolves"
sidebar_label: "1 · How CSS resolves"
sidebar_position: 1
---

> **Phases 0–2 · 35 topics · 14 Master**
> The engine's model, the selectors that changed what is expressible, and
> cascade control with `@layer`.

This part is not a CSS primer. It covers the parts of the model that **advanced
work actually depends on** — why a rule silently vanished, how `:has()` replaces
JavaScript, and how `@layer` ends specificity wars. Basic syntax, the box model
and typography are assumed.

---

## Phase 0 — How CSS runs

*12 topics.* The engine's behaviour, not CSS syntax. The error-recovery row is
the one that stops CSS feeling haunted.

| Topic | Tier |
|---|---|
| **The rendering pipeline** — style → layout → paint → composite, and which stage each property invalidates. Every performance rule later is downstream of this | <span className="db-tier t-master">Master</span> |
| **CSS fails silently** — an invalid declaration is dropped alone, an invalid **selector** discards the whole rule, an unclosed brace eats the next one, and **nothing is reported** | <span className="db-tier t-master">Master</span> |
| **Baseline as a shipping decision** — Widely / Newly / Limited, read from `web-features` rather than memory, and why one engine's `CSS.supports` is not an answer | <span className="db-tier t-master">Master</span> |
| **DevTools as the missing error console** — struck-through declarations, Computed, forced states, the grid and flex overlays | <span className="db-tier t-master">Master</span> |
| What CSS is — declarative and *resolved*, so you debug by asking which rule won, never by tracing | <span className="db-tier t-understand">Understand</span> |
| Getting CSS to the page — `<link>`, `<style>`, inline, and why `@import` costs a full serialised round trip | <span className="db-tier t-understand">Understand</span> |
| Render-blocking CSS — what the first paint waits for, and taking a stylesheet off the critical path with `media` | <span className="db-tier t-understand">Understand</span> |
| `@supports` feature queries — declaration and `selector()` tests, and why the fallback usually needs no query at all | <span className="db-tier t-understand">Understand</span> |
| User-agent stylesheets — where the defaults come from, and how to inspect rather than guess them | <span className="db-tier t-understand">Understand</span> |
| Resets — the handful of lines that matter, each justified against a measured default | <span className="db-tier t-understand">Understand</span> |
| The at-rule map — eleven at-rules, and the fact that an unsupported one drops its **entire block** | <span className="db-tier t-understand">Understand</span> |
| Vendor prefixes in 2026 — mostly dead; the two that are not | <span className="db-tier t-know">Know</span> |

**Gate:** you can say, for a rule that "isn't working", whether it parsed,
whether it matched, and whether it won — without editing it at random.

---

## Phase 1 — Selectors

*16 topics.* Weighted to the modern set. `:has()` and `:is()` changed what is
expressible; nesting is native; `@scope` does something no selector can.

| Topic | Tier |
|---|---|
| **`:has()`** — the parent selector **and** a previous-sibling selector; replacing whole categories of state-toggling JavaScript | <span className="db-tier t-master">Master</span> |
| **`:is()` and `:where()`** — identical matching, opposite specificity; `:where()` as the tool for overridable defaults | <span className="db-tier t-master">Master</span> |
| **Nesting** — native, Baseline since 2023; how it desugars, and the specificity it hides | <span className="db-tier t-master">Master</span> |
| **Pseudo-elements** — boxes with no DOM node behind them; the `content` requirement, and why they are flex/grid items | <span className="db-tier t-master">Master</span> |
| **Combinators** — how one space decides whether a rule leaks into nested components | <span className="db-tier t-master">Master</span> |
| **Selector families** — and the coupling each one creates | <span className="db-tier t-master">Master</span> |
| Selector lists, forgiving and not — one invalid selector discarding six components' styling | <span className="db-tier t-understand">Understand</span> |
| Attribute selectors in full — seven operators, the `i` flag, and why `*=` on `class` is usually a bug | <span className="db-tier t-understand">Understand</span> |
| Structural pseudo-classes — `nth-child` vs `nth-of-type`, and `of S` for striping that survives filtering | <span className="db-tier t-understand">Understand</span> |
| State pseudo-classes — `:focus-visible`, `:focus-within`, and why `:visited` is deliberately crippled | <span className="db-tier t-understand">Understand</span> |
| Form-state pseudo-classes — `:user-invalid` vs `:invalid`, and validation styling with no script | <span className="db-tier t-understand">Understand</span> |
| `:not()`, `:empty`, `:root`, `:lang()`, `:dir()` — including `:not()`'s specificity trap | <span className="db-tier t-understand">Understand</span> |
| Styling hooks — classes for style, `data-*`/`aria-*` for state, test ids for tests, and never crossing them | <span className="db-tier t-understand">Understand</span> |
| `@scope` — donut scoping, and the only proximity rule in the cascade | <span className="db-tier t-know">Know</span> |
| Selector performance — what actually costs, and why the 2011 advice is obsolete | <span className="db-tier t-know">Know</span> |
| Shadow DOM selectors — `:host`, `::part()`, `::slotted()`, and the styling API isolation forces you to design | <span className="db-tier t-know">Know</span> |

**Gate:** you can style a form row's label from its input's validity, with no
JavaScript and no extra markup — and state the resulting specificity.

---

## Phase 2 — Cascade control

*7 topics.* Not a tour of the cascade — the parts you use to **stop fighting
it**. `@layer` is the load-bearing one and the reason this phase exists.

| Topic | Tier |
|---|---|
| **What the cascade compares, in order** — origin and importance, then **layer**, then specificity, then source order. Specificity is the *fourth* tiebreak, and that ordering is why `@layer` works at all | <span className="db-tier t-master">Master</span> |
| **`@layer`** — declaring precedence up front; that **unlayered styles beat every layer**; swallowing a third-party stylesheet into a low layer; and why `!important` **inverts** layer order | <span className="db-tier t-master">Master</span> |
| **Specificity, counted properly** — the (id, class, type) triple; `:where()` at zero; `:is()`, `:not()` and `:has()` taking their most specific argument | <span className="db-tier t-master">Master</span> |
| **The shorthand reset trap** — `background: yellow` wiping `background-image`, `border` resetting `border-color` to `currentcolor`; every shorthand writes **all** its longhands | <span className="db-tier t-master">Master</span> |
| **Custom properties in the cascade** — inherited values resolved at computed-value time, and the invalid-at-computed-value-time rule that turns one bad token into `unset` | <span className="db-tier t-understand">Understand</span> |
| `!important` and the origin ladder — what it really does, why author `!important` beats inline, and the two legitimate uses | <span className="db-tier t-understand">Understand</span> |
| The global keywords — `inherit`, `initial`, `unset`, `revert`, `revert-layer`, and what each reverts *to* | <span className="db-tier t-understand">Understand</span> |

**Gate:** you can design a layer order for an application that imports a
third-party stylesheet, and explain why nothing in it will ever need
`!important`.

---

## Where this connects

- **Phase 0 → Phase 9** — the pipeline stages become the animation cost model.
- **Phase 1 → Phase 11** — `@scope`, shadow DOM and CSS Modules are three
  answers to the same scoping question.
- **Phase 2 → Phase 10** — `@layer` is native cascade control; Sass's `@use` is
  build-time module control. They solve different halves.
- **Phase 2 → Phase 11** — an architecture built on layers is only as good as
  your grasp of the cascade order.

---

← [Overview](../README.md) · Next: [Part 2 — Values and layout](./02-layout.md) →
