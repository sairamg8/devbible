---
title: "Phase 5 — The built-in library"
sidebar_label: "Overview"
sidebar_position: 0
---

*26 topics.* Grouped by object, not by method: array iteration is one page, not
eight. Grouping reduces noise, never coverage — every method still gets its own
example and its own gotcha.

This is the phase you use every day. Phases 3 and 4 explained the language; this one
is the standard library built on top of it.

## Status — **in progress** (2026-08-13)

**Master tier first**, as in phases 3 and 4. The eight Master topics are **01, 02,
04, 05, 06, 07, 09, 10** in syllabus order — the numbering skips Understand and Know
topics deliberately, and those are *deferred*, not forgotten.

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[Array creation and shape](./01-array-creation-and-shape/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | Adding and removing | <span className="db-tier t-master">Master</span> | planned |
| 03 | `slice` vs `splice` vs `at` | <span className="db-tier t-understand">Understand</span> | deferred |
| 04 | Array iteration methods | <span className="db-tier t-master">Master</span> | planned |
| 05 | `reduce` | <span className="db-tier t-master">Master</span> | planned |
| 06 | `sort` | <span className="db-tier t-master">Master</span> | planned |
| 07 | String methods | <span className="db-tier t-master">Master</span> | planned |
| 08 | Template literals | <span className="db-tier t-understand">Understand</span> | deferred |
| 09 | `JSON.parse` and `JSON.stringify` | <span className="db-tier t-master">Master</span> | planned |
| 10 | `Map` vs a plain object | <span className="db-tier t-master">Master</span> | planned |
| 11 | `Number` and `Math` | <span className="db-tier t-understand">Understand</span> | deferred |
| 12 | String searching | <span className="db-tier t-understand">Understand</span> | deferred |
| 13 | Non-mutating array counterparts | <span className="db-tier t-understand">Understand</span> | deferred |
| 14 | `flat`, `flatMap`, `fill`, `copyWithin` | <span className="db-tier t-understand">Understand</span> | deferred |
| 15 | Regular expressions — the syntax | <span className="db-tier t-understand">Understand</span> | deferred |
| 16 | Regular expressions — in practice | <span className="db-tier t-understand">Understand</span> | deferred |
| 17 | `Set` | <span className="db-tier t-understand">Understand</span> | deferred |
| 18 | `Object` statics | <span className="db-tier t-understand">Understand</span> | deferred |
| 19 | `Date` | <span className="db-tier t-understand">Understand</span> | deferred |
| 20 | `Intl` | <span className="db-tier t-understand">Understand</span> | deferred |
| 21 | `structuredClone` | <span className="db-tier t-understand">Understand</span> | deferred |
| 22 | Array-likes and iterables | <span className="db-tier t-understand">Understand</span> | deferred |
| 23 | `WeakMap` and `WeakSet` | <span className="db-tier t-know">Know</span> | deferred |
| 24 | `Temporal` | <span className="db-tier t-know">Know</span> | deferred |
| 25 | Typed arrays, `ArrayBuffer`, `DataView` | <span className="db-tier t-know">Know</span> | deferred |
| 26 | Text encoding | <span className="db-tier t-know">Know</span> | deferred |

Note topic 21 (`structuredClone`) is already covered in depth by
[Phase 4 · 04 · `structuredClone`](../phase-4-objects-and-classes/04-shallow-vs-deep-copy/02-structuredclone.md),
which is where deep copying belongs.

## Phase gate

**Move on when** you can sort an array of objects by two keys, group it into a `Map`,
and say exactly which of those operations mutated the original.

## How these pages are verified

**Documentation-validated** — no new measurement sandboxes. Each page's `> Verified:`
line names the MDN pages it was checked against, with links. **No run means no console
block.**

## Where this connects

- [Phase 4 · Objects, prototypes and classes](../phase-4-objects-and-classes/README.md) — what these built-ins are built on
- [Phase 6 · Iteration, destructuring and generators](../../syllabus/02-data-and-async.md) — the protocol layer that makes spread and `for...of` work on all of them
- [Phase 13 · Complexity](../../syllabus/04-dsa-and-machine-coding.md) — what these operations actually cost

---

Start → [01 · Array creation and shape](./01-array-creation-and-shape/README.md)
