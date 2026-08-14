---
title: "Phase 6 — Container queries and intrinsic responsive"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-14 against **MDN** and the **W3C CSS Containment Level 3**
> and **Media Queries Level 5** specifications. Sources named per page.
> Baseline data from `web-features` 3.34.3.

**✅ 3 of 3 topics written.** The modern position: most responsive behaviour
should need **no breakpoint at all**. Breakpoints are what you add when intrinsic
sizing runs out.

| # | Page | Tier | One line |
|---|---|---|---|
| 01 | [Container queries](./01-container-queries.md) | <span className="db-tier t-master">Master</span> | A component responds to its own space, not the window |
| 02 | [Layouts that need no query](./02-layouts-that-need-no-query.md) | <span className="db-tier t-master">Master</span> | `auto-fit`, `flex-wrap`, `clamp()` — and when a breakpoint is still right |
| 03 | [User-preference queries](./03-user-preference-queries.md) | <span className="db-tier t-master">Master</span> | The queries that are requirements, not polish |

## The test that decides

> **If only the size or the count changes, no query is needed. If *what is shown*
> changes, use one.**

Columns, type scale and spacing are continuous — `repeat(auto-fit, minmax(…))`,
`flex-wrap` and `clamp()` express them without breakpoints. Navigation becoming a
drawer, a table becoming cards, an element appearing: those are design changes,
and they need a query.

## The trap worth knowing before you start

**A container cannot query itself.** Styles inside `@container` apply to
descendants only, because a container restyling itself could change its own size
and flip the query. Every queryable component therefore needs a wrapper element —
the single most common reason a first attempt does nothing.

## Phase gate

You can drop one card component into a sidebar and a full-width row and have it
change layout correctly — no viewport media query, no props.

## Where this connects

- **← [Phase 5 · Grid](../phase-5-grid/README.md)** — `auto-fit` + `minmax()` and
  container queries are the two halves of layout that adapts without breakpoints.
- **← [Phase 3 · `clamp()`](../phase-3-custom-properties/02-clamp-min-max.md)** —
  swap `vw` for `cqi` and a fluid scale responds to the component instead.
- **→ Phase 8 · Colour and theming** — `prefers-color-scheme` and `color-scheme`
  are where dark mode actually gets implemented.

---

← [Phase 5 · Grid](../phase-5-grid/README.md) · Start → [01 · Container queries](./01-container-queries.md)
