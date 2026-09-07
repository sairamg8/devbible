---
title: "Phase 1 — Complexity analysis"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-09-07. Runtime claims on every page name their primary source on a `> Verified:`
> line (MDN for JavaScript, the JDK 25 API documentation for Java); the definitions, the master
> theorem, amortised analysis and the comparison-sort lower bound are textbook (CLRS) and are
> stated as such. Interview-format observations are **tendencies, never statistics**. Solutions
> are TypeScript first, Java second. **No sandbox run**; these pages carry code, never program
> output, and never a timing.

**The language interviewers use to judge every solution, and the one candidates hand-wave most.**
"What's the complexity?" is asked of every solution in every round, and the answer is graded on
three things: that the bound is *right*, that it was *read off the code* rather than guessed
from the pattern's name, and that the candidate can say in one sentence *why* — the loop that
looks quadratic but is linear, the array push that is constant on average, the recursion whose
stack is the space cost. This phase is that language: the notation and what interviewers mean by
it, reading a bound straight off code, amortised cost in a sentence, space and the recursion
stack in Node and on the JVM, the classes and what an input limit implies, the hidden costs that
fail the large test, the cost of every built-in you call, recurrences, best-average-worst, when
to measure instead of analyse, and how to answer "can we do better?" with a reason.
[Phase 0](../phase-0-the-interview-and-practice/README.md) was the method; this is the first
thing the method needs.

🚧 **7 of 11 topics written (11 files: topics 02, 03, 04 and 06 are each split into two).**

| # | Page | Tier | State |
|---|---|---|---|
| 01 | **[Big-O, Theta and Omega](./01-big-o-theta-and-omega.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 02 | **[Reading complexity off code](./02-reading-complexity-off-code.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 02b | **[Recursion as a tree](./02b-recursion-as-a-tree.md)** | <span className="db-tier t-master">Master</span> | ✅ written — 02 and 02b are one topic in two files |
| 03 | **[Amortised analysis](./03-amortised-analysis.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 03b | **[Union-find, and the limits of amortised](./03b-union-find-and-the-limits-of-amortised.md)** | <span className="db-tier t-master">Master</span> | ✅ written — 03 and 03b are one topic in two files |
| 04 | **[Space and the recursion stack](./04-space-and-the-recursion-stack.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 04b | **[Tail calls, and the explicit stack](./04b-tail-calls-and-the-explicit-stack.md)** | <span className="db-tier t-master">Master</span> | ✅ written — 04 and 04b are one topic in two files |
| 05 | **[The common classes and what the limits imply](./05-the-common-classes-and-what-the-limits-imply.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 06 | **[Hidden costs](./06-hidden-costs.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 06b | **[Hash keys, and the test for hidden loops](./06b-hash-keys-and-the-test-for-hidden-loops.md)** | <span className="db-tier t-master">Master</span> | ✅ written — 06 and 06b are one topic in two files |
| 07 | **[Complexity of the built-ins](./07-complexity-of-the-built-ins.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 08 | Recurrences and the master theorem | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 09 | Best, average and worst | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 10 | Benchmarking vs analysis | <span className="db-tier t-know">Know</span> | ⬜ not written yet |
| 11 | Proving optimality | <span className="db-tier t-know">Know</span> | ⬜ not written yet |

## Phase gate

Given any solution you wrote this week, you can state its time and space bound, point at the
line that sets each, explain any amortised claim in one sentence, and say what the input limit
in the problem statement implied about the intended class — before the interviewer asks.

## Where this connects

- [Part 1 of the syllabus](../../syllabus/01-foundations.md) is the inventory this phase is
  written from; phase 2 there (recursion, maths and bits) is next.
- [Phase 0 · Language choice and traps](../phase-0-the-interview-and-practice/04-language-choice-and-runtime-traps.md)
  and [Phase 0 · Java's collections](../phase-0-the-interview-and-practice/12-javas-collections-for-interviews.md)
  carry the runtime facts these pages build on.
- The [JavaScript track](../../../javascript/README.md) and the [Java track](../../../java/README.md)
  hold the language mechanics; the [System Design track's latency ladder](../../../system-design/pages/phase-0-the-interview/05-the-latency-ladder.md)
  is the same idea at the level of a system.
