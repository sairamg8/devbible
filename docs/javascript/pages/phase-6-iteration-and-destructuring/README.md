---
title: "Phase 6 — Iteration, destructuring and generators"
sidebar_label: "Overview"
sidebar_position: 0
---

*13 topics.* The protocol layer. Small phase, but it is what lets `for…of`, spread,
destructuring and `Promise.all` all work on the same objects.

## Status — **in progress** (2026-08-13)

**Master tier first.** The three Master topics are **01, 02, 03** — unusually, the first
three in syllabus order. The remaining topics are *deferred*, not forgotten.

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[Destructuring](./01-destructuring/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[`for…of` vs `for…in` vs `forEach`](./02-loop-forms/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03 | Spread with iterables | <span className="db-tier t-master">Master</span> | planned |
| 04 | The iteration protocols | <span className="db-tier t-understand">Understand</span> | deferred |
| 05 | Generators | <span className="db-tier t-understand">Understand</span> | deferred |
| 06 | Async iterators | <span className="db-tier t-understand">Understand</span> | deferred |
| 07 | Paginating an API with an async generator | <span className="db-tier t-understand">Understand</span> | deferred |
| 08 | Early exit inside iteration | <span className="db-tier t-understand">Understand</span> | deferred |
| 09 | Two-way generators | <span className="db-tier t-know">Know</span> | deferred |
| 10 | `yield*` delegation | <span className="db-tier t-know">Know</span> | deferred |
| 11 | Iterator helpers | <span className="db-tier t-know">Know</span> | deferred |
| 12 | Writing a collection class that iterates cleanly | <span className="db-tier t-know">Know</span> | deferred |
| 13 | Driving an iterator by hand | <span className="db-tier t-when">When Needed</span> | deferred |

## Phase gate

**Move on when** you can write a generator that yields pages from a paginated endpoint
and consume it with `for await…of`.

## How these pages are verified

**Documentation-validated** — no new measurement sandboxes. Each page's `> Verified:`
line names the MDN pages it was checked against. **No run means no console block.**

## Where this connects

- [Phase 5 · The built-in library](../phase-5-built-in-library/README.md) — the objects these protocols make iterable
- [Phase 4 · Objects, prototypes and classes](../phase-4-objects-and-classes/README.md) — `Symbol.iterator` is just a well-known-symbol-keyed method
- [Phase 7 · Asynchronous JavaScript](../../syllabus/02-data-and-async.md) — async iteration, and where `for await…of` belongs

---

Start → [01 · Destructuring](./01-destructuring/README.md)
