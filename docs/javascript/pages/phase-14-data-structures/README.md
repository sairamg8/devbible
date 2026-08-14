---
title: "Phase 14 — Core data structures in JavaScript"
sidebar_label: "Overview"
sidebar_position: 0
---

*17 topics.* Each structure gets a working implementation, the operations table, and the problems
it exists to solve. Where a built-in already covers it (`Map`, `Set`), the page explains the
built-in first and implements it only to show the mechanism.

## Status — **Master tier COMPLETE** (2026-08-14)

**Master tier first.** Phase 14 has **five** Master topics — 01 through 05 — and **all five are
written**. The Understand and Know rows are deferred until the Master tiers of the remaining
phases are done.

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[Dynamic arrays](./01-dynamic-arrays/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[Hash maps and hash sets](./02-hash-maps-and-sets/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03 | **[Frequency maps and grouping](./03-frequency-and-grouping/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 04 | **[Stack](./04-stack/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 05 | **[Queue and deque](./05-queue-and-deque/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 06–14 | Binary trees, singly and doubly linked lists, BSTs, heaps and priority queues, graphs, union-find, tries, matrices and grids | <span className="db-tier t-understand">Understand</span> | deferred |
| 15–17 | Balanced trees in one page, bitsets and circular buffers, persistent and immutable structures | <span className="db-tier t-know">Know</span> | deferred |

## The phase gate

From the syllabus: **you can implement a min-heap and an LRU cache from scratch and state the
complexity of every method.** Both sit in the deferred Understand rows (10 · Heaps, 08 · Doubly
linked list), so the gate is not yet reachable from these pages alone — the Master tier covers the
structures those two are built out of.

## How these pages are verified

**Documentation-validated** against MDN, the specification requirement MDN quotes for `Map`
(access must be **sublinear**, not necessarily O(1)), and the V8 blog for elements kinds. **No page
prints a timing** — no benchmark was run.

## Where this connects

- [Phase 13 · Complexity and JavaScript's real costs](../phase-13-complexity/README.md) — the analysis these structures are chosen by
- [Phase 5 · The built-in library](../phase-5-built-in-library/README.md) — the array, `Map` and `Set` methods themselves
- [Phase 7 · Asynchronous JavaScript](../phase-7-async/README.md) — the event loop's queues

---

Start → [01 · Dynamic arrays](./01-dynamic-arrays/README.md)
