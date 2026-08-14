---
title: "Phase 5 — Grid, deeply"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-14 against the **W3C CSS Grid Layout Level 1/2**
> specifications and the **MDN** grid references. Sources named per page.
> Written at **full Master depth** on the user's instruction.

**✅ 10 of 10 topics written.** The largest phase, and `auto-fit` + `minmax()`
is the highest-leverage single idiom in modern CSS layout.

| # | Page | Tier | State |
|---|---|---|---|
| 01 | [`repeat()`, `minmax()`, `auto-fit` vs `auto-fill`](./01-repeat-minmax-autofit.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 02 | [`fr` and the track sizing algorithm](./02-fr-and-track-sizing.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 03 | [The `minmax(0, 1fr)` fix](./03-the-minmax-zero-fix.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 04 | [Named areas](./04-named-areas.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 05 | [Line-based placement](./05-line-based-placement.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 06 | [Subgrid](./06-subgrid.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 07 | [Grid patterns that carry real applications](./07-grid-patterns.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 08 | [Alignment in grid](./08-alignment-in-grid.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 09 | [Explicit vs implicit grid](./09-explicit-vs-implicit-grid.md) | <span className="db-tier t-understand">Understand</span> | ✅ written |
| 10 | [Grid vs flexbox vs flow](./10-grid-vs-flexbox-vs-flow.md) | <span className="db-tier t-understand">Understand</span> | ✅ written |

## Coverage

| | |
|---|---|
| Topics written | **10 of 10 — COMPLETE** |
| Pages on disk | **10** |
| Depth | full Master |
| Evidence | specification and MDN, named per page; **no console blocks** (no-new-sandboxes rule) |

## The organising idea

Grid sizes **tracks**, not items — and every track carries a hidden content
floor. `1fr` really means `minmax(auto, 1fr)`, so "equal columns" are equal only
until one cell holds something unbreakable. That single fact connects the first
three topics and is the direct counterpart of flexbox's automatic minimum size:

| | The content floor | The override |
|---|---|---|
| Flexbox | `min-width: auto` on the item | `min-width: 0` |
| Grid | the `auto` minimum inside `1fr` | `minmax(0, 1fr)` |

## Phase gate

You can write a card grid that goes four columns to one with **no media
queries**, and a page shell in named areas that rearranges in exactly one —
explaining `auto-fit` vs `auto-fill` from the rendered result.

## Where this connects

- **← [Phase 4 · Flexbox](../phase-4-flexbox/README.md)** — `min-width: 0` and
  `minmax(0, 1fr)` are one problem in two layout systems.
- **→ Phase 6 · Container queries** — `auto-fit` + `minmax()` and container
  queries are the two halves of layout that adapts without breakpoints.

---

← [Phase 4 · Flexbox](../phase-4-flexbox/README.md) · Start → [01 · `repeat()`, `minmax()`, `auto-fit`](./01-repeat-minmax-autofit.md)
