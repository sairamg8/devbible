---
title: "Phase 7 — Positioning, stacking and overlay"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-14 against **MDN** and the **W3C CSS Positioned Layout
> Level 3** specification. Sources named per page. Baseline data from
> `web-features` 3.34.3.

**✅ 4 of 4 topics written.** Small, and responsible for a disproportionate
share of production bugs: dropdowns clipped by a scroll container, and
`z-index: 9999` that changes nothing.

| # | Page | Tier | One line |
|---|---|---|---|
| 01 | [Stacking contexts](./01-stacking-contexts.md) | <span className="db-tier t-master">Master</span> | A child can never escape its parent's context |
| 02 | [`z-index` in practice](./02-z-index-in-practice.md) | <span className="db-tier t-master">Master</span> | Why `1` works and `9999` does not — and how to organise it |
| 03 | [`position: sticky`](./03-position-sticky.md) | <span className="db-tier t-master">Master</span> | The three conditions that make it silently do nothing |
| 04 | [The clipped-dropdown problem](./04-the-clipped-dropdown-problem.md) | <span className="db-tier t-understand">Understand</span> | Clipping is not stacking, and the top layer is the fix |

## The two failures, told apart

Almost every overlay bug is one of these, and the fixes have nothing in common:

| Symptom | Diagnosis | Fix |
|---|---|---|
| visible but **underneath** | stacking context | `z-index` at the boundary, or the top layer |
| **cut off** at an edge | an ancestor's `overflow` | the top layer, or remove the clip |

## What to reach for

- **`isolation: isolate`** on component roots — states the stacking boundary
  explicitly instead of letting an `opacity: 0.98` create it by accident.
- **The top layer** — `popover`, or `<dialog>` + `showModal()` — for menus and
  modals. It sidesteps both stacking and clipping entirely.
- **`align-self: start`** when sticky will not stick inside a flex or grid
  parent.

## Phase gate

You can explain why a `z-index: 1` element paints over a `z-index: 100` one, by
naming the stacking context each belongs to.

## Where this connects

- **→ Phase 9 · Motion** — `transform`, `opacity` and `will-change` create
  stacking contexts; the two phases describe one mechanism from opposite ends.
- **← [Phase 6 · Container queries](../phase-6-container-queries/README.md)** —
  `container-type` also creates a stacking context, which is newer territory.

---

← [Phase 6 · Container queries](../phase-6-container-queries/README.md) · Start → [01 · Stacking contexts](./01-stacking-contexts.md)
