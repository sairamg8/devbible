---
title: "Phase 15 — Algorithmic patterns"
sidebar_label: "Overview"
sidebar_position: 0
---

:::caution Parked — 2026-08-14
⏸ **This phase is parked, not dropped.** On the user's instruction (*"Even algorythms also
park it out not now"*), the unwritten topics are **out of the queue** while the corpus stays
on the **language** itself. They keep their syllabus rows and can be resumed later.

The five written Master topics are unaffected. Parked alongside
[Phase 14 · Core data structures](../phase-14-data-structures/README.md);
[Phase 16 · Dynamic programming](../phase-16-dynamic-programming/README.md) was **dropped**
outright rather than parked.
:::

*20 topics.* Patterns, not problems. Each row is a template you can recognise from a problem
statement, with two or three worked examples in JavaScript.

## Status — **Master tier COMPLETE** (2026-08-14)

**Master tier first.** Phase 15 has **five** Master topics — 01, 02, 03, 04 and 06 — and **all
five are written**. Topic 05 (recursion and the recursion tree) is Understand and deferred with
the rest.

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[Two pointers](./01-two-pointers/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[Sliding window](./02-sliding-window/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03 | **[Binary search](./03-binary-search/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 04 | **[Hash-map patterns](./04-hash-map-patterns/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 05 | Recursion and the recursion tree | <span className="db-tier t-understand">Understand</span> | ⏸ **parked** |
| 06 | **[BFS](./06-bfs/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 07–16 | Prefix sums, sorting algorithms, `sort` in practice, DFS, backtracking, divide and conquer, topological sort, Dijkstra and A\*, greedy, intervals | <span className="db-tier t-understand">Understand</span> | ⏸ **parked** |
| 17–20 | Linear-time sorting, string algorithms, bit manipulation, maths for interviews | <span className="db-tier t-know">Know</span> | ⏸ **parked** |

## The phase gate

From the syllabus: **given an unseen problem you can name the pattern before writing code, and say
why the alternative patterns do not fit.** Each topic therefore ends with a recognition rule, not
just a template — that is the part being tested.

## How these pages are verified

**Documentation-validated.** The algorithms are standard results; every JavaScript-specific claim
is checked against MDN — the numeric coercion traps, `sort`'s default comparator, UTF-16 string
indexing, `MAX_SAFE_INTEGER`. **No page prints a timing**, because no benchmark was run.

## Where this connects

- [Phase 13 · Complexity and JavaScript's real costs](../phase-13-complexity/README.md) — the bounds these patterns are chosen for
- [Phase 14 · Core data structures](../phase-14-data-structures/README.md) — the structures they run on
- [Phase 5 · The built-in library](../phase-5-built-in-library/README.md) — `sort`, `Map`, `Set` and the array methods

---

Start → [01 · Two pointers](./01-two-pointers/README.md)
