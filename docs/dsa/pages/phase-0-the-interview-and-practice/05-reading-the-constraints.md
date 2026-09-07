---
title: "The constraints tell you the intended solution before you have one — a hundred thousand means n log n, a thousand means quadratic is fine, twenty means exponential is the point — and reading them is the fastest step in the round"
sidebar_label: "05 · Reading the constraints"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. The size-to-class table is **method** — a widely used rule of thumb,
> stated as such; the underlying figure (roughly 10⁸ simple operations per second in a typical
> judge) is folklore, **not measured here**, and the page says so where it uses it. Code is
> TypeScript targeting Node 24 (LTS), written to be runnable; **nothing was run**.

**A problem's constraints are the interviewer telling you the complexity class of the intended
solution, and most candidates read past them.** An input bounded at 10⁵ says the solution is
O(n log n) or better, so a nested loop is the wrong plan before it is written. A bound of 10³
says a quadratic solution is fine and the time spent optimising it is wasted. A bound of 20 says
the intended solution is exponential — enumerate the subsets, the interviewer expects it — and a
candidate looking for a polynomial trick is solving a harder problem than was set. Value ranges
carry information too: values bounded at 10⁵ invite counting arrays; values at 10⁹ force a hash
map and raise the overflow question; a small alphabet invites a fixed-size table. Reading the
constraints takes ten seconds, sets the target for the match step, and rules out half the
patterns before you have started.

## The table: input size to intended class

A rule of thumb, using the folklore figure of roughly a hundred million simple operations per
second and a time limit of a second or two — unverified here, and the *ordering* is what matters:

| n up to | Intended class | The patterns it points to |
|---:|---|---|
| 10–12 | O(n!) | permutations by backtracking |
| 20–25 | O(2ⁿ · n) | subsets, bitmask DP, meet in the middle |
| 100 | O(n⁴) | rarely; usually a triple loop with something inside |
| 500 | O(n³) | Floyd–Warshall, interval DP over all pairs |
| 10³–5·10³ | O(n²) | double loops, 2D DP, brute force over pairs |
| 10⁵–10⁶ | O(n log n) | sort then sweep, heap, binary search, divide and conquer |
| 10⁷–10⁸ | O(n) | one pass, sliding window, hash map, prefix sums, counting |
| 10⁹ and above | O(log n), O(√n), O(1) | binary search on the answer, number theory, a closed form |

Two things the table says beyond the class. First, **when n is tiny, exponential is intended** —
a candidate who sees n ≤ 20 and reaches for DP over subsets has read the constraint; one who
tries to find a polynomial solution has not. Second, **when n is huge, the answer is not
iteration** — n up to 10¹⁸ means the solution is arithmetic, a closed form, or a search over the
answer space, and any loop over n is wrong by inspection.

## The other constraints, and what each one says

| Constraint | What it tells you |
|---|---|
| **values bounded small** (≤ 10⁵, or "lowercase letters") | counting array or bucket sort instead of a hash map; a fixed-size table for the alphabet |
| **values large** (up to 10⁹ or 10¹⁸) | a hash map, not an array; sums and products need `long`, `BigInt`, or a modulus — the overflow question is coming |
| **"the answer fits in a 32-bit integer"** | no `BigInt` needed for the result — but the intermediates may still overflow |
| **"return the answer modulo 10⁹ + 7"** | a counting problem with huge answers — DP or combinatorics, reduce at every step |
| **sorted input** | binary search or two pointers is available; using neither wastes the gift |
| **distinct elements** | no tie-handling; a map from value to index is safe |
| **many queries over one input** (q up to 10⁵) | precompute once (prefix sums, a sparse table, a tree) and answer each in O(log n) or O(1); per-query work over the whole input is too slow |
| **k small relative to n** | a heap of size k, or partial processing; O(n log k) rather than O(n log n) |
| **grid of r × c with r·c ≤ 10⁵–10⁶** | BFS or DFS over cells is fine; the grid is the graph |
| **tree with n ≤ 10⁵** | a recursive DFS may exceed the stack on a path-shaped tree — iterate ([04](04-language-choice-and-runtime-traps.md)) |
| **"in-place" or O(1) extra space** | cyclic sort, index-as-hash, two pointers, or reversing in place — the space constraint is the pattern hint |
| **strings up to 10⁵ over a large alphabet** | a hash map keyed by character; over 26 letters, an array of 26 |

Every row is a sentence to say in the understand step: "values go up to a billion, so a map
rather than an array, and I'll watch the sum for overflow."

## Working backwards from the class

The constraint gives the class; the class narrows the patterns; the problem's signals pick one.
Three worked readings:

**"Find two numbers that sum to a target; n ≤ 10⁵; values up to 10⁹."** Class: O(n log n) or
O(n). Brute force is O(n²) — ruled out by inspection, no need to state more than that. Values
large → a hash map, not a counting array. Sorted? Not stated → hash map of complements, O(n).
If it had said sorted → two pointers, O(1) space.

**"Count the subsets whose sum equals a target; n ≤ 20; values up to 10⁶."** Class: O(2ⁿ)
intended — a million subsets is nothing. Enumerate by bitmask, sum each, count. A candidate who
reaches for subset-sum DP has read n but not the values: the DP is O(n · target), and the
target can be 2 × 10⁷, which is *slower* than the enumeration. The constraint said exponential.

**"Answer q queries, each asking the sum of a range; n, q ≤ 10⁵."** Class: per-query work must
be O(log n) or O(1) — O(n) per query is 10¹⁰ total. Prefix sums: O(n) precompute, O(1) per
query. If the array were mutable between queries, a Fenwick tree — O(log n) for both — and the
mutability would be in the constraints.

## The constraint you did not use

A specific check at the end of the plan step: **which constraint did the plan not use?** "Sorted"
unused means a faster solution exists. "Distinct" unused is usually fine. "k ≤ 100" unused when
the plan is O(n log n) means an O(n log k) solution was intended. n ≤ 20 unused — the plan is
polynomial — means either you found something better than intended (say so, and be ready to
defend it) or you misread the problem. Interviewers place constraints deliberately; an unused one
is a question they will ask.

## The estimate in code

For a rough operation count during the plan step — the arithmetic said aloud, not run:

```ts
// the sanity check said aloud at the plan step, made explicit
export function operationsFor(n: number, cls: 'n' | 'nlogn' | 'n2' | 'n3' | '2n'): number {
  switch (cls) {
    case 'n':     return n;
    case 'nlogn': return n * Math.ceil(Math.log2(Math.max(2, n)));
    case 'n2':    return n * n;
    case 'n3':    return n * n * n;
    case '2n':    return 2 ** n;
  }
}
// operationsFor(1e5, 'n2')  → 1e10  : too slow against ~1e8/s — the plan is wrong
// operationsFor(1e5, 'nlogn') → ~1.7e6 : fine
// operationsFor(20, '2n')   → ~1e6  : exponential is intended
```

The threshold — about 10⁸ per second — is the folklore number, and it is stated as such. The
value of the function is not precision; it is the habit of multiplying before typing.

## Gotchas

**★ Symptom: a nested loop on n ≤ 10⁵, and "time limit exceeded" or the interviewer's "how many
operations is that?"** Cause: the constraint was not read; O(n²) at 10⁵ is 10¹⁰. Fix: read the
size aloud at the understand step and name the class it implies before matching; a quadratic
plan at that size is wrong by inspection.

**★ Symptom: n ≤ 20, and ten minutes searching for a polynomial solution.** Cause: a tiny
bound not recognised as the signal that exponential is intended. Fix: n at twenty or below means
enumerate — subsets by bitmask, permutations by backtracking — and say "two to the twenty is a
million; that's the intended approach."

**Symptom: values up to 10⁹ and a counting array.** Cause: the value range read as if it were
the size. Fix: values large → a hash map; values small → an array. Say which and why.

**Symptom: the sum overflowed and the answer was negative.** Cause: values up to 10⁹, n up to
10⁵, a 32-bit accumulator. Fix: the value constraint is the overflow warning — `long` in Java,
watch 2⁵³ in JavaScript, or reduce modulo when the problem says "modulo".

**Symptom: the input was sorted and the plan used a hash map.** Cause: a constraint unused.
Fix: at the end of the plan, ask which constraint went unused; "sorted" unused means two pointers
or binary search would have been cheaper in space or time, and the interviewer will ask.

**Symptom: per-query work over the whole array, with q and n both at 10⁵.** Cause: the query
count not multiplied in. Fix: total work is n × q; precompute once and answer each query in
logarithmic or constant time.

**Symptom: a subset-sum DP that is slower than brute force.** Cause: n read (20) but the target
not (up to 2 × 10⁷). Fix: the class is decided by *all* the constraints; O(n · target) versus
O(2ⁿ) is a comparison to make aloud.

**Symptom: "the answer fits in 32 bits" taken to mean the intermediates do.** Cause: a
constraint on the output read as a constraint on the arithmetic. Fix: intermediates — running
sums, products — are bounded by the inputs, not the output; check them separately.

## Interview questions

**★ What do the constraints tell you before you start solving?**
The complexity class of the intended solution, and therefore which patterns are candidates: n at
10⁵ means O(n log n) or better, so sorting, heaps, binary search and one-pass structures; n at
10³ means quadratic is acceptable; n at 20 means exponential is intended, so enumerate. Value
ranges add more — small values invite counting arrays, large ones force hash maps and raise
overflow; a sorted input offers binary search or two pointers; many queries mean precompute once.
Reading them takes ten seconds and rules out half the patterns before the match step.

**★ n is 20. What does that tell you, and what is the mistake?**
That the intended solution is exponential — two to the twenty is about a million, which is
trivial — so enumerate subsets by bitmask or permutations by backtracking. The mistake is
searching for a polynomial solution to a problem the interviewer set as exponential, or reaching
for a DP whose cost depends on a *value* constraint that is much larger than 2ⁿ. Small n is a
gift; read it as one.

**How do you sanity-check a plan against the constraints?**
Multiply: the class times the size, against roughly a hundred million simple operations per
second as a rule of thumb. O(n²) at 10⁵ is 10¹⁰ — wrong. O(n log n) at 10⁵ is under two
million — fine. O(2ⁿ) at 20 is a million — fine. Then ask which constraint the plan did not use;
an unused "sorted" or a small k usually means a cheaper solution was intended.

**What does a value range of 10⁹ change compared with 10⁵?**
The data structure and the arithmetic. At 10⁵ a counting array or bucket sort is available and
often O(n); at 10⁹ the values cannot index an array, so a hash map is needed, and sums or
products of such values overflow a 32-bit integer — `long` in Java, the 2⁵³ ceiling in
JavaScript, or a modulus when the problem gives one. The value range is where the overflow
follow-up comes from.

**Many queries over one input — what does the constraint imply?**
That per-query work must be logarithmic or constant, because total work is queries times
per-query cost and both counts are large. Precompute once — prefix sums for static range sums,
a Fenwick or segment tree when the array changes between queries, a sparse table for static
range minimum — and the mutability is itself a constraint to read.

**You found a polynomial solution to a problem with n ≤ 20. What do you say?**
That the constraint suggested exponential was intended, that you believe you have something
better, and then defend it — the interviewer will either confirm it or point at the case it
misses. Saying it shows the constraint was read; silently presenting the polynomial solution
leaves the interviewer wondering whether you noticed the bound at all.

---

← Prev: [04b · Java traps and sorting](04b-java-traps-and-sorting.md) · Index: [Phase 0 — The DSA interview and the practice system](README.md) · Next → [06 · Spaced repetition and the log](06-spaced-repetition-and-the-mistake-log.md)
