---
title: "Phase 6 — Iteration, destructuring and generators"
sidebar_label: "Overview"
sidebar_position: 0
---

*13 topics.* The protocol layer. Small phase, but it is what lets `for…of`, spread,
destructuring and `Promise.all` all work on the same objects.

## Status — ✅ **COMPLETE — every tier, 13 of 13**

**Every topic is written** — Master 01–03, Understand 04–08, Know 09–12, When Needed 13.
Master landed 2026-08-13; the remaining ten topics were written 2026-08-15 by **chunk B**
of the four-way JavaScript split (phases 6 and 17), which continues with
**Phase 17 · Machine coding**.

**Coverage:** 40 files, 0 over the 300-line cap. Every page carries a tier badge, a
`> Verified:` line naming its MDN sources, Gotchas written symptom → cause → fix, and
Interview questions.

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[Destructuring](./01-destructuring/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[`for…of` vs `for…in` vs `forEach`](./02-loop-forms/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03 | **[Spread with iterables](./03-spread-with-iterables/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 04 | **[The iteration protocols](./04-iteration-protocols/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 05 | **[Generators](./05-generators/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 06 | **[Async iterators](./06-async-iterators/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 07 | **[Paginating an API with an async generator](./07-paginating-an-api/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 08 | **[Early exit inside iteration](./08-early-exit/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 09 | **[Two-way generators](./09-two-way-generators/README.md)** | <span className="db-tier t-know">Know</span> | ✅ |
| 10 | **[`yield*` delegation](./10-yield-delegation/README.md)** | <span className="db-tier t-know">Know</span> | ✅ |
| 11 | **[Iterator helpers](./11-iterator-helpers/README.md)** | <span className="db-tier t-know">Know</span> | ✅ |
| 12 | **[Writing a collection class that iterates cleanly](./12-a-collection-class/README.md)** | <span className="db-tier t-know">Know</span> | ✅ |
| 13 | **[Driving an iterator by hand](./13-driving-by-hand/README.md)** | <span className="db-tier t-when">When Needed</span> | ✅ |

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
