---
title: "Phase 2 — Recursion, maths and bits"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-09-07. Language-behaviour claims on every page name their primary source on a
> `> Verified:` line — MDN for JavaScript (bitwise operand coercion to 32 bits, `Number.MAX_SAFE_INTEGER`,
> `BigInt`, the `Array.prototype.sort` comparator contract, `Math.random`, "too much recursion")
> and the JDK 25 API documentation for Java (`Math.addExact` / `multiplyExact` / `floorMod` /
> `floorDiv`, `Integer`'s bit methods, `Collections.shuffle`). The algorithms themselves — Euclid,
> the sieve, binary exponentiation, Fisher–Yates, Catalan numbers, matrix exponentiation, cross
> products — are **mathematics**, derived on the page rather than cited. Solutions are TypeScript
> first, Java second. **No sandbox run**; these pages carry code, never program output, and never
> a timing or a stack-depth figure.

**The foundations the harder phases quietly assume, and the arithmetic that turns a correct
algorithm into a wrong program.** Every later phase recurses — trees, graphs, backtracking, divide
and conquer — so the call stack has to be something you can convert to an explicit stack on
demand. Every counting problem lands on a modulus, and `%` is a remainder rather than a modulus in
both languages, so a subtraction makes the answer negative. Every "subsets of a set" problem wants
a bitmask, and JavaScript's bitwise operators silently truncate to 32 signed bits while Java's
`long` does not. This phase is that layer: recursion and its conversion to iteration, divide and
conquer as a template, the small set of number theory that keeps reappearing, bit manipulation and
where it overflows, integer limits in both languages, and the counting and randomisation
techniques the later phases build on. [Phase 1](../phase-1-complexity/README.md) gave the language
for stating a cost; this phase gives the operations whose cost you will be stating.

🚧 **0 of 13 topics written.**

| # | Page | Tier | State |
|---|---|---|---|
| 01 | Recursion and the call stack | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 02 | Divide and conquer | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 03 | Mathematical foundations | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 04 | Bit manipulation | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 05 | Integer limits and overflow | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 06 | The backtracking skeleton | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 07 | Fast exponentiation and the modular inverse | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 08 | Combinatorics for counting problems | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 09 | Bitmask enumeration | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 10 | Randomisation | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 11 | Number problems that recur | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 12 | Matrix exponentiation | <span className="db-tier t-know">Know</span> | ⬜ not written yet |
| 13 | Geometry basics | <span className="db-tier t-know">Know</span> | ⬜ not written yet |

## Phase gate

Iterative and recursive versions of the same tree walk, a sieve and a modular binomial
coefficient written from memory in TypeScript and Java, and the subsets of a set enumerated by
bitmask — each with its complexity stated.

## Where this connects

- [Part 1 of the syllabus](../../syllabus/01-foundations.md) is the inventory this phase is
  written from; phase 3 there (arrays, hashing and prefix sums) is next.
- [Phase 1 · Space and the recursion stack](../phase-1-complexity/04-space-and-the-recursion-stack.md)
  and [Phase 1 · Tail calls, and the explicit stack](../phase-1-complexity/04b-tail-calls-and-the-explicit-stack.md)
  own the *cost* of recursion; this phase owns writing and converting it.
- [Phase 1 · Recurrences and the master theorem](../phase-1-complexity/08-recurrences-and-the-master-theorem.md)
  is where every divide-and-conquer bound on this phase's pages is solved.
- [Phase 0 · Language choice and runtime traps](../phase-0-the-interview-and-practice/04-language-choice-and-runtime-traps.md)
  carries the language facts the overflow and bit pages build on.
- The [JavaScript track](../../../javascript/README.md) and the [Java track](../../../java/README.md)
  hold the language mechanics in full.
