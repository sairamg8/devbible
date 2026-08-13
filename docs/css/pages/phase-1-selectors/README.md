---
title: "Phase 1 — Selectors"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08 in **Firefox 153.0.3**, with Baseline data from
> **`web-features` 3.34.3**. Console blocks come from `sandbox/css/ex09` and
> `ex10`, named on each page.

**16 topics.** How a rule finds its elements. `:has()` and `:is()` changed what
is expressible — patterns that needed a JavaScript class-toggle in 2020 are one
selector now — and both have been Baseline for years.

| # | Page | Tier | One line |
|---|---|---|---|
| 01 | [Selector families](./01-the-selector-families.md) | <span className="db-tier t-master">Master</span> | Five ways to name an element, and the coupling each creates |
| 02 | [Combinators](./02-combinators.md) | <span className="db-tier t-master">Master</span> | One space is the difference between your component and everything nested in it |
| 03 | [Attribute selectors](./03-attribute-selectors.md) | <span className="db-tier t-understand">Understand</span> | Seven operators, and why `*=` on `class` is usually a bug |
| 04 | [Selector lists](./04-selector-lists.md) | <span className="db-tier t-understand">Understand</span> | One bad selector destroys the whole rule — measured |
| 05 | [`:is()` and `:where()`](./05-is-and-where.md) | <span className="db-tier t-master">Master</span> | Identical matching, opposite specificity |
| 06 | [`:has()`](./06-has.md) | <span className="db-tier t-master">Master</span> | The parent selector, and a previous-sibling selector too |
| 07 | [Structural pseudo-classes](./07-structural-pseudo-classes.md) | <span className="db-tier t-understand">Understand</span> | `nth-child` vs `nth-of-type`, and `of S` for filtered striping |
| 08 | [State pseudo-classes](./08-state-pseudo-classes.md) | <span className="db-tier t-understand">Understand</span> | `:focus-visible`, and why `:visited` is crippled |
| 09 | [Form-state pseudo-classes](./09-form-state-pseudo-classes.md) | <span className="db-tier t-understand">Understand</span> | `:user-invalid` — validation styling that isn't red on load |
| 10 | [Pseudo-elements](./10-pseudo-elements.md) | <span className="db-tier t-master">Master</span> | Boxes with no DOM node behind them |
| 11 | [`:not()`, `:empty`, `:root`](./11-not-empty-root.md) | <span className="db-tier t-understand">Understand</span> | Negation, emptiness, the root, and language |
| 12 | [Nesting](./12-nesting.md) | <span className="db-tier t-master">Master</span> | Native now — and the specificity it hides |
| 13 | [Styling hooks](./13-styling-hooks.md) | <span className="db-tier t-understand">Understand</span> | Classes for style, `data-*`/`aria-*` for state, test ids for tests |
| 14 | [`@scope`](./14-scope.md) | <span className="db-tier t-know">Know</span> | Donut scoping, and the only proximity rule in the cascade |
| 15 | [Selector performance](./15-selector-performance.md) | <span className="db-tier t-know">Know</span> | 1.25 ms for `:has()` over 5000 elements — and why that is fine |
| 16 | [Shadow DOM selectors](./16-shadow-dom-selectors.md) | <span className="db-tier t-know">Know</span> | The only real isolation, and the API it forces you to design |

## What the measurements changed

1. **`p:nth-child(2)` and `p:nth-of-type(2)` selected different paragraphs** —
   "first" and "second" respectively. `:nth-child` counts every sibling and then
   checks the type; if the second child were not a `p`, it would match nothing.
2. **An invalid selector in a plain list discards the entire rule.**
   `.c, ::nonsense` left `.c` unstyled and absent from the CSSOM, while
   `:is(.d, ::nonsense)` kept `.d` styled. One typo can disable six components.
3. **`:has()` is a previous-sibling selector too.** `p:has(+ p)` matched only the
   first of two adjacent paragraphs — an expression CSS had no form for before.
4. **`:has()` cost 1.25 ms against 0.15 ms for a class**, over 5000 elements,
   both returning the same 500 rows. 8×, and still about a millisecond — far less
   than the JavaScript it replaces costs to write and get wrong.
5. **`@scope`'s lower bound genuinely holds.** A paragraph inside `.widget` was
   styled; one inside `.slot` was not, though it is also inside `.widget`.
6. **Pseudo-elements are not in the DOM at all** —
   `querySelector('.quote::before')` returned `null`, `childNodes` was unchanged,
   and the generated quote mark was absent from `textContent`, while
   `getComputedStyle(el, '::before')` reported it.
7. **Native nesting handles `.inner &` and nested `@media`** — both desugared and
   applied correctly, so neither needs a preprocessor.

## Where this connects

- **→ Phase 2 — the cascade** — every specificity number
  quoted here is defined there. `:is()`, `:not()` and `:has()` taking their
  argument's specificity is a cascade rule.
- **→ Phase 12 — interaction** — the state and
  form pseudo-classes are the mechanism behind styling native UI with no script.
- **→ Phase 13 — architecture** — `@scope`, shadow
  DOM and CSS Modules are three answers to the same scoping question.
- **→ JavaScript Phase 9 (DOM)** — `querySelectorAll` uses these same selectors;
  `:scope` exists mainly for that side.

## Phase gate

Move on when you can style a form row's label based on its input's validity —
no JavaScript, no extra markup — and say what specificity the result has.

---

← [Phase 0 · How CSS runs](../phase-0-how-css-runs/README.md) · Next: **Phase 2 · The cascade** →
