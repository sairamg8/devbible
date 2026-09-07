---
title: "DSA — Syllabus"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-09 — the inventory is written against the sources listed under *Sources*
> below; problem names follow the well-known interview ladders. Runtime facts about
> TypeScript and Java are pinned and cited when each explanation page is written.

The complete topic inventory for data structures and algorithms, tiered for **the coding
rounds of the senior loop at product companies**: **21 phases, 301 topics**, split
into 8 parts to stay under the 300-line file cap. Patterns, the method, the problem ladder
and a plan that fits beside a full-time job — with solutions discussed in **TypeScript first
and Java second**, the two languages this reader interviews in.

This is the interview layer, not the language layer. The JavaScript track already holds the
language-level implementations in its
[DSA and machine-coding part](../javascript/syllabus/04-dsa-and-machine-coding.md)
(phases 13–17, parked beyond their Master rows), and Java's
[collections phase](../java/pages/phase-3-generics-collections/README.md) holds the standard
library; this track links to both and never re-teaches them. Its companion is the
[System Design track](../system-design/README.md): the two share Part 13's plan there and
Part 8's plan here.

## Where this sits, as of September 2026

| | |
|---|---|
| Reader | Backend in **Node.js and Java**, frontend in **React**; interviews in TypeScript by default, Java where the loop expects it |
| Target | Two coding rounds at product companies, the design-flavoured coding round at senior level, and the machine-coding round shared with the System Design track |
| Runtime pins | Inherited from the bible: Node's current Active LTS and Java 25 — never restated in a row |
| Not this reader | Python is in the bible but not this reader's interview language; no rows are written around it |

| The mechanics live in | This track adds |
|---|---|
| [JavaScript — DSA and machine coding](../javascript/syllabus/04-dsa-and-machine-coding.md) | the patterns, the recognition signals, the ladder and the method |
| [Java — generics and collections](../java/pages/phase-3-generics-collections/README.md) | which collection an interview expects, and its traps |
| [PostgreSQL](../postgresql/README.md) · [Redis](../redis/README.md) · [Express](../expressjs/README.md) | where the same structures run in production (Part 7) |
| [System Design](../system-design/README.md) | the LLD catalogue and the twelve-week plan the two tracks share |

## Parts

| # | Part | Covers | Phases | Topics |
|---|---|---|---|---|
| 1 | **[Foundations](syllabus/01-foundations.md)** | The rounds and the method, complexity done honestly, recursion, maths and bits | 0–2 | 38 |
| 2 | **[Arrays, strings and hashing](syllabus/02-arrays-strings-and-hashing.md)** | Arrays, hashing, prefix sums, two pointers, sliding window, strings | 3–5 | 42 |
| 3 | **[Linear structures and binary search](syllabus/03-linear-structures-and-binary-search.md)** | Stacks and monotonic structures, linked lists, binary search | 6–8 | 36 |
| 4 | **[Trees, heaps and tries](syllabus/04-trees-heaps-and-tries.md)** | Binary trees and BSTs, heaps, tries, segment and Fenwick trees | 9–11 | 36 |
| 5 | **[Graphs](syllabus/05-graphs.md)** | Traversal, ordering, union-find, shortest paths, the advanced set | 12–13 | 31 |
| 6 | **[Backtracking, greedy and dynamic programming](syllabus/06-backtracking-greedy-and-dp.md)** | Backtracking, greedy with proofs, dynamic programming by family | 14–16 | 53 |
| 7 | **[Design-flavoured problems and applied algorithms](syllabus/07-design-flavoured-and-applied.md)** | Design-flavoured problems, concurrency in Java and Node, the algorithms inside real systems | 17–18 | 33 |
| 8 | **[The ladder and the plan](syllabus/08-the-ladder-and-the-plan.md)** | The problem ladder pattern by pattern, the twelve-week plan, the last two weeks | 19–20 | 32 |

## Explanations

Not started — the syllabus comes first; explanation pages follow once it is approved, phase
by phase in reading order. Status lives in **[Explanations](./pages/README.md)**.

import Progress from '@site/src/components/Progress';

<Progress lang="dsa" compact />

## Tier legend

| Badge | Meaning |
|---|---|
| <span className="db-tier t-master">Master</span> | Solve cold, under time, in both languages, and state the bound unprompted |
| <span className="db-tier t-understand">Understand</span> | Know the pattern and the canonical problem; solve with a hint or a minute of recall |
| <span className="db-tier t-know">Know</span> | Know what it is and when it is the intended tool; details on demand |
| <span className="db-tier t-when">When Needed</span> | Don't study upfront |

## Tier distribution

| Tier | Topics | Share |
|---|---|---|
| <span className="db-tier t-master">Master</span> | 146 | 49% |
| <span className="db-tier t-understand">Understand</span> | 113 | 38% |
| <span className="db-tier t-know">Know</span> | 42 | 14% |
| <span className="db-tier t-when">When Needed</span> | 0 | 0% |
| **Total** | **301** | |

By part: Foundations 38 · Arrays, strings and hashing 42 · Linear structures and binary search 36 · Trees, heaps and tries 36 · Graphs 31 · Backtracking, greedy and dynamic programming 53 · Design-flavoured problems and applied algorithms 33 · The ladder and the plan 32.

Master runs high because an interview track *is* the "solve cold" material: every Master
row is a pattern or a canonical problem that a senior loop asks directly. Nothing is tiered
*When Needed* — the exotic structures (suffix automata, max flow, order-statistic trees)
are listed as *Know* with an honest note on how rarely they appear.

## Prerequisites

Fluency in TypeScript or Java — the [JavaScript](../javascript/README.md) or
[Java](../java/README.md) track through functions, collections and recursion. Part 1 has no
other prerequisites and must be read first.

## Reading order

1. **Part 1 first.** The method and the complexity vocabulary are used in every later gate.
2. **Parts 2 to 6 in order.** Each part's patterns assume the previous one; the ladder in
   Part 8 is sequenced the same way.
3. **Part 7 after Part 4** at the earliest — the design-flavoured problems need heaps and
   linked lists; its applied phase is best read alongside the System Design track.
4. **Part 8 is not last in practice.** Read Phase 20's plan in week one, then work Phase
   19's ladder pattern by pattern as the corresponding part is finished.

## Sources

- Cormen, Leiserson, Rivest and Stein, *Introduction to Algorithms* · Sedgewick and Wayne, *Algorithms* — the reference behind the structures and the bounds
- [The NeetCode roadmap](https://neetcode.io/roadmap) · the original Blind 75 list · [Striver's A2Z sheet](https://takeuforward.org/) — the ladders Phase 19 is mapped onto
- [LeetCode](https://leetcode.com/) — every problem named in this track, by its problem name
- [MDN — JavaScript built-ins](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference) — the costs of the built-ins in Part 1 and Part 2
- [Java SE 25 API — java.util](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/package-summary.html) — the collections named in Part 1 and Part 4
- [PostgreSQL documentation](https://www.postgresql.org/docs/current/) · [Redis documentation](https://redis.io/docs/) — the production algorithms of Part 7
