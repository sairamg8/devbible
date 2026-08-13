---
title: "Selector performance"
sidebar_label: "15 · Selector performance"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex10-nesting-scope-pseudo.mjs`.

**Selector performance is almost never your problem, and the advice you have
heard about it is from 2011.** What matters now is invalidation — how much of
the tree has to be re-styled when something changes — not how clever an
individual selector is.

## The one measurement worth having

5000 rows, each containing a checkbox, 500 of them checked. Matching them by
class versus by `:has()`:

```console
$ node ex10-nesting-scope-pseudo.mjs
=== Selector cost — :has() vs a class, 5000 elements ===
  querySelectorAll(".is-checked")         0.15
  querySelectorAll(".row:has(:checked)")  1.25
  both return                             500
  note                                    ms per call, mean of 20
```

**8× slower — and 1.25 ms for five thousand elements.** That is the *expensive*
case: a relational selector, on a large tree, evaluated exhaustively.

Now weigh it. The class version requires JavaScript to add and remove
`.is-checked` on every change, which is code to write, test, and get wrong on the
error path. 1.1 ms is not a budget worth spending human attention on.

:::note What this measures, and what it does not
`querySelectorAll` on a static tree, in one engine. It is an order-of-magnitude
indicator of matching cost, **not** a measurement of style invalidation during
live rendering, which is the thing that actually causes jank. Treat it as
"relational selectors cost more, at a scale that is usually irrelevant".
:::

## Why the old advice is obsolete

The rules people repeat — "avoid the universal selector", "never use descendant
selectors", "id selectors are fastest" — come from an era of much slower engines
and much simpler pages. Modern engines:

- **Match right to left**, so the rightmost part determines the candidate set.
  `main > .thing` starts from `.thing`, not from `main`.
- **Bucket rules by key selector**, so an element with `class="btn"` is only ever
  tested against rules whose rightmost part could match a `.btn`.
- **Cache style resolution** for elements with identical relevant state.

The result is that selector matching is a small fraction of style recalculation,
which is itself usually a small fraction of frame time compared with layout and
paint ([Phase 0](../phase-0-how-css-runs/02-the-rendering-pipeline.md)).

## What actually costs something

| Pattern | Why it can matter |
|---|---|
| **`:has()` with a broad subject** — `body:has(...)`, `* :has(...)` | invalidation reaches a huge subtree |
| **An argument that changes every frame** — `:has(:hover)`, `:has([data-scroll])` | re-invalidates continuously during interaction |
| **Very large stylesheets** — tens of thousands of rules | more rules to bucket and match, and more bytes to parse |
| **Frequent DOM mutation high in the tree** | forces restyling of everything beneath |
| **Huge `:is()` / `:not()` lists** applied broadly | each candidate is tested against every argument |

The common thread is **breadth of invalidation**, not selector cleverness.

## How to tell whether it is your problem

Do not guess — the profiler names the stage:

1. Open the Performance panel and record the interaction that feels slow.
2. Look at what dominates: **Recalculate Style**, **Layout**, or **Paint**.
3. Only if *Recalculate Style* is the tall bar is any of this relevant. In
   practice it is Layout or Paint, and the fix is in
   **Phase 14**, not here.

## Practical rules

- **Write the clearest selector.** Optimise for the human until a profile says
  otherwise.
- **Keep `:has()` subjects narrow.** `.row:has(:checked)` rather than
  `body:has(.row :checked)`.
- **Avoid `:has()` on state that changes every frame** — scroll position, hover
  during a drag.
- **Delete unused CSS.** This shrinks parse time, match time and bytes at once,
  and is the only "selector performance" work that reliably pays
  (**Phase 13**).

## Gotchas

**Symptom:** a page becomes janky during scroll after adding a `:has()` rule.
**Cause:** the argument matches something that changes as you scroll, forcing
repeated invalidation of a large subtree.
**Fix:** narrow the subject away from `body`, or drive the state from a class set
once rather than a continuously-changing condition.

**Symptom:** someone rewrites selectors "for performance" and nothing improves.
**Cause:** the bottleneck was layout or paint, not style recalculation.
**Fix:** profile first. The Performance panel names the stage.

**Symptom:** style recalculation genuinely is the tall bar.
**Cause:** usually a mutation high in the tree — toggling a class on `<body>` or
`<html>` — restyling everything beneath it.
**Fix:** move the toggle as low in the tree as the design allows.

## Interview questions

**★ Are CSS selectors a performance concern?**
Rarely. Modern engines match right to left and bucket rules by key selector, so
matching is a small fraction of style recalculation, which is itself usually
small next to layout and paint. The advice to avoid descendant or universal
selectors dates from much slower engines. What can matter is *invalidation
breadth* — how much of the tree must be re-styled when something changes.

**★ Is `:has()` slow?**
It costs more than a class because it forces upward invalidation. Measured on
5000 elements, `querySelectorAll('.row:has(:checked)')` took 1.25 ms against
0.15 ms for a plain class — 8×, and still around a millisecond. It becomes a real
problem only when the subject is a large subtree and the argument changes every
frame, such as `body:has(:hover)` during a drag.

**Why do engines match selectors right to left?**
Because it prunes the candidate set fastest. Starting from the rightmost
compound, the engine has a small set of elements to check and can abandon each
candidate as soon as one ancestor condition fails. Left to right would mean
walking the entire subtree of every potential ancestor.

**How would you determine whether selectors are your bottleneck?**
Record the slow interaction in the Performance panel and look at which stage
dominates. Only a tall "Recalculate Style" bar implicates selectors; a tall
Layout or Paint bar means the fix is elsewhere entirely.

**What is the one selector-related optimisation that reliably pays?**
Deleting unused CSS. It reduces bytes, parse time and the number of rules to be
matched, all at once — unlike rewriting individual selectors, which usually
changes nothing measurable.

---

← [14 · @scope](./14-scope.md) · Next: [16 · Shadow DOM selectors](./16-shadow-dom-selectors.md) →
