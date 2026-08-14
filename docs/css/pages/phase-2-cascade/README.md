---
title: "Phase 2 — Cascade control"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-14 against the **W3C CSS Cascading and Inheritance Level 5**
> and **Selectors Level 4** specifications, and the corresponding **MDN**
> reference pages. Sources are named per page. Baseline data from
> **`web-features` 3.34.3**.

**4 topics.** Not a tour of the cascade — the parts you use to **stop fighting
it**. `@layer` is the load-bearing one and the reason this phase exists.

| # | Page | Tier | One line |
|---|---|---|---|
| 01 | [What the cascade compares](./01-what-the-cascade-compares.md) | <span className="db-tier t-master">Master</span> | Specificity is the fifth criterion, not the first |
| 02 | [`@layer`](./02-layer/README.md) | <span className="db-tier t-master">Master</span> | Declare precedence up front; unlayered is the implicit final layer |
| 03 | [Specificity, counted properly](./03-specificity-counted-properly.md) | <span className="db-tier t-master">Master</span> | Three columns compared left to right — no number of classes beats an id |
| 04 | [The shorthand reset trap](./04-the-shorthand-reset-trap.md) | <span className="db-tier t-master">Master</span> | Every shorthand writes all its longhands, including the ones you omitted |

## How these pages are evidenced

Under the project's **no-new-sandboxes** rule, this phase is **validated against
the specification and MDN**, with the exact source named in every page's
`> Verified:` line. Two claims are additionally marked **sandbox-measured**
because `sandbox/css/ex11-cascade-order.mjs` proved them case by case in Firefox
153.0.3 on 2026-08-13.

**No page in this phase carries a console block**, because no run of those
scripts was captured. A measured finding is stated in prose and attributed; a
result that only documentation supports is attributed to the documentation.
Nothing is reconstructed from memory.

## What the phase adds up to

One sentence carries most of it: **the cascade compares origin and importance,
then context, then inline styles, then layers, then specificity, then source
order** — and the first criterion that separates two declarations ends the
comparison.

Almost every "why isn't my CSS applying" question is a criterion *above*
specificity doing its job. Reaching for a heavier selector when the real
difference was layer or importance is the escalation this phase exists to stop.

## Phase gate

You can design a layer order for an application that imports a third-party
stylesheet, and explain why nothing in it will ever need `!important`.

## Where this connects

- **← Phase 1 · Selectors** — `:where()` and `:is()` are specificity tools; this
  phase is where their weights start to matter.
- **→ Phase 3 · Custom properties** — custom properties resolve at
  computed-value time, one stage after the cascade picks a winner.
- **→ Phase 10 · SCSS** — `@layer` is native cascade control; Sass's `@use` is
  build-time module control. Different halves, and they compose.

---

← [Phase 1 · Selectors](../phase-1-selectors/README.md) · Start → [01 · What the cascade compares](./01-what-the-cascade-compares.md)
