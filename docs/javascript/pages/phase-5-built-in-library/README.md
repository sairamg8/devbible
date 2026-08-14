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

## Status — **Understand tier under way** (2026-08-15)

🚧 **14 of 26 written.** All eight Master topics are done — 01, 02, 04, 05, 06, 07, 09,
10 in syllabus order — and the Master-first plan is finished across every phase, so the
work here is now the **Understand and Know tiers**, in that order.

**Next here: 15 · Regular expressions — the syntax**, then 16–22, then the four
Know topics (23–26).

**Coverage:** Master **8 / 8** ✅ · Understand **6 / 14** · Know **0 / 4**.

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[Array creation and shape](./01-array-creation-and-shape/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[Adding and removing](./02-adding-and-removing/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03 | **[`slice` vs `splice` vs `at`](./03-slice-splice-at.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 04 | **[Array iteration methods](./04-array-iteration-methods/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 05 | **[`reduce`](./05-reduce/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 06 | **[`sort`](./06-sort/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 07 | **[String methods](./07-string-methods/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 08 | **[Template literals](./08-template-literals/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 09 | **[`JSON.parse` and `JSON.stringify`](./09-json/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 10 | **[`Map` vs a plain object](./10-map-vs-object/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 11 | **[`Number` and `Math`](./11-number-and-math/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 12 | **[String searching](./12-string-searching/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 13 | **[Non-mutating array counterparts](./13-non-mutating-counterparts.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 14 | **[`flat`, `flatMap`, `fill`, `copyWithin`](./14-flat-flatmap-fill.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
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
