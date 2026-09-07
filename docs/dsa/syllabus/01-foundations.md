---
title: "Part 1 — Foundations"
sidebar_label: "1 · Foundations"
sidebar_position: 1
---

> Phases 0–2 · How the coding rounds are graded, how to read complexity honestly, and the recursion, maths and bit tricks everything else is built on

Data structures and algorithms are the rounds no senior loop skips, and the ones most
working engineers under-prepare because the daily job never asks for a heap. This track is
the interview layer: patterns, the method, the problem ladder, and a plan that fits beside a
full-time job. The language-level implementations already live in the
[JavaScript track's DSA part](../../javascript/syllabus/04-dsa-and-machine-coding.md)
(phases 13–17, parked beyond their Master rows) and in
[Java's collections phase](../../java/pages/phase-3-generics-collections/README.md); this
track links to them and never re-teaches them. Solutions are discussed in TypeScript first
and Java second, because those are the two languages this reader interviews in.

---

## Phase 0 — The DSA interview and the practice system

Before any algorithm: what the round actually grades, the method that keeps you moving when
a problem is unfamiliar, and the practice system that turns three months into a result.
Most failed rounds are failures of method, not of knowledge.

| Topic | Tier |
|---|---|
| **What the coding rounds grade** — correctness, complexity, code quality, communication, how you take a hint; the senior twist: the follow-up that changes the constraints after you have solved it | <span className="db-tier t-master">Master</span> |
| **The 45-minute shape** — clarify, examples, brute force, optimise, code, test, state the complexity; the time box for each, and the moment to start typing | <span className="db-tier t-master">Master</span> |
| **The method: understand, match, plan, implement, review, evaluate** — matching the problem to a pattern *before* designing; the "which pattern is this" reflex this whole track exists to build | <span className="db-tier t-master">Master</span> |
| **Language choice and runtime traps** — TypeScript first, Java second: recursion depth limits in Node, no built-in heap or sorted map in JavaScript, comparator and stability in `sort`, `BigInt`, integer overflow and boxing in Java, the cost of immutable strings; choosing per problem | <span className="db-tier t-master">Master</span> |
| **Reading the constraints** — an input of a hundred thousand means n log n, a thousand means quadratic, twenty means exponential is intended; inferring the target solution from the limits | <span className="db-tier t-master">Master</span> |
| **Spaced repetition and the mistake log** — re-solving from a blank editor after three, seven and twenty-one days; logging *why* a problem was missed, not that it was | <span className="db-tier t-master">Master</span> |
| **The "when stuck" protocol** — restate the problem, shrink the example, say the brute force out loud, name the bottleneck, ask for a hint before the silence grows | <span className="db-tier t-master">Master</span> |
| **Testing your own code live** — tracing a small example by hand, the edge cases (empty, one element, duplicates, negatives, overflow), off-by-one hunting at every boundary | <span className="db-tier t-master">Master</span> |
| **The ladders** — the 75-problem core, the 150-problem set, the longer structured sheets; how each maps onto the phases here, and why order matters more than count | <span className="db-tier t-understand">Understand</span> |
| **Mock interviews** — peer mocks graded against the rubric, recording yourself, thinking aloud as a trained habit rather than a hope | <span className="db-tier t-understand">Understand</span> |
| **Communication mechanics** — narrating the plan before the code, naming the invariant, stating the complexity unprompted, saying what you would do with more time | <span className="db-tier t-understand">Understand</span> |
| **Java's collections for interviews** — priority queues, sorted maps and sets, deques, the handful of APIs to know cold; their complexities and their traps | <span className="db-tier t-understand">Understand</span> |
| **How this track relates to the JavaScript track** — phases 13–17 there hold the language-level implementations; this track is the interview layer: patterns, ladders, method. Link, never duplicate | <span className="db-tier t-know">Know</span> |
| **Competitive programming vs interviews** — what transfers (speed, pattern recognition) and what does not (obscure tricks); contests as timed practice, nothing more | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can run the full method on an unfamiliar medium problem in
forty-five minutes — clarify, brute force, optimise, code, test, complexity — while talking,
and your mistake log has its first ten entries.

---

## Phase 1 — Complexity analysis

The language interviewers use to judge every solution, and the one candidates hand-wave
most. Being able to read a bound straight off code, explain amortised cost in a sentence,
and know the cost of the built-ins you call is what makes "can we do better?" answerable.

| Topic | Tier |
|---|---|
| **Big-O, Theta and Omega** — upper, tight and lower bounds; what interviewers actually mean by "complexity"; dropping constants and lower terms, and the moments constants matter anyway | <span className="db-tier t-master">Master</span> |
| **Reading complexity off code** — nested loops, halving, recursion trees; the loop that looks quadratic but is linear (two pointers, a monotonic stack) | <span className="db-tier t-master">Master</span> |
| **Amortised analysis** — dynamic arrays, union-find, "each element is pushed once"; explaining it in one sentence so the interviewer believes the bound | <span className="db-tier t-master">Master</span> |
| **Space and the recursion stack** — auxiliary space, in-place, the depth of a recursive DFS, why tail calls do not save you in V8 | <span className="db-tier t-master">Master</span> |
| **The common classes and what the limits imply** — constant, logarithmic, linear, linearithmic, quadratic, exponential, factorial; the table from input size to intended class | <span className="db-tier t-master">Master</span> |
| **Hidden costs** — string concatenation in a loop, slicing and spreading arrays, `includes` inside a loop, hash collisions, substring copies; the accidental quadratic that fails the large test | <span className="db-tier t-master">Master</span> |
| **Complexity of the built-ins** — sorting, map and set operations, `indexOf`, removing from the front of an array, Java's list implementations; the numbers you must not guess | <span className="db-tier t-master">Master</span> |
| **Recurrences and the master theorem** — the three cases, recognised in merge sort, binary search and tree recursion | <span className="db-tier t-understand">Understand</span> |
| **Best, average and worst** — hashing's average vs worst, quicksort's pivot, which one to state and when | <span className="db-tier t-understand">Understand</span> |
| **Benchmarking vs analysis** — when to measure, cache effects and constant factors, why a linearithmic solution can beat a linear one at real sizes | <span className="db-tier t-know">Know</span> |
| **Proving optimality** — lower bounds such as comparison sorting; answering "can we do better?" with a reason rather than a shrug | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** given any solution you wrote this week, you can state its time
and space bounds, defend them line by line, and name the built-in call that would have
silently made it quadratic.

---

## Phase 2 — Recursion, maths and bits

The foundations the harder phases assume: recursion you can convert to iteration, the small
set of number theory that keeps reappearing, and the bit tricks that turn some exponential
problems into fast ones.

| Topic | Tier |
|---|---|
| **Recursion and the call stack** — base case, progress, the frame; converting to iteration with an explicit stack; Node's default depth limit as a real constraint on deep inputs | <span className="db-tier t-master">Master</span> |
| **Divide and conquer** — merge sort, quickselect, the "solve halves, combine" template, counting inversions | <span className="db-tier t-master">Master</span> |
| **Mathematical foundations** — greatest common divisor and least common multiple by Euclid, primes and the sieve, factorisation, modular arithmetic and why answers are taken modulo a large prime | <span className="db-tier t-master">Master</span> |
| **Bit manipulation** — masks, set, clear and test, XOR tricks (the single number, swapping), counting set bits, the lowest set bit, power-of-two tests, iterating the subsets of a mask | <span className="db-tier t-master">Master</span> |
| **Integer limits and overflow** — JavaScript's safe-integer range and `BigInt`, Java's `int` against `long`, the multiplication that overflowed silently; overflow used on purpose in hashing | <span className="db-tier t-master">Master</span> |
| **The backtracking skeleton** — choose, explore, un-choose; previewed here, mastered in [Part 6](06-backtracking-greedy-and-dp.md) | <span className="db-tier t-understand">Understand</span> |
| **Fast exponentiation and the modular inverse** — binary exponentiation, the inverse through Fermat's little theorem, binomial coefficients under a modulus | <span className="db-tier t-understand">Understand</span> |
| **Combinatorics for counting problems** — permutations, combinations, Catalan numbers (balanced parentheses, binary search trees), inclusion–exclusion; the counting problem that is dynamic programming in disguise | <span className="db-tier t-understand">Understand</span> |
| **Bitmask enumeration** — subsets as integers, the exponential limit where it is intended, dynamic programming over masks previewed | <span className="db-tier t-understand">Understand</span> |
| **Randomisation** — Fisher–Yates, reservoir sampling previewed, the randomised pivot; why shuffling with a random comparator is measurably biased | <span className="db-tier t-understand">Understand</span> |
| **Number problems that recur** — digit manipulation, palindromic numbers, `pow`, integer square root by binary search, Roman numerals, string-to-integer parsing; the boundary details that hide bugs | <span className="db-tier t-understand">Understand</span> |
| **Matrix exponentiation** — linear recurrences in logarithmic time, the matrix as the transition | <span className="db-tier t-know">Know</span> |
| **Geometry basics** — points, distances, cross products for orientation; the few geometry problems that actually appear | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** iterative and recursive versions of the same tree walk, a sieve and
a modular binomial coefficient written from memory in TypeScript and Java, and the subsets
of a set enumerated by bitmask — each with its complexity stated.

---

{/* NAV */}
