---
title: "Two things the template does not tell you: how big the base case should be, which is a correctness question dressed as an optimisation, and why the whole family is correct, which is one strong induction whose only interesting step is proving the case analysis disjoint and exhaustive"
sidebar_label: "02b · Base cases, induction, and when to reach for it"
sidebar_position: 2.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. Strong induction over the input size and the recurrence solutions are
> **textbook mathematics** (CLRS, *divide-and-conquer*), derived here rather than cited; the master
> theorem itself is [phase 1 · 08](../phase-1-complexity/08-recurrences-and-the-master-theorem.md)
> and is not restated. The insertion-sort cut-off and the sequential threshold in a fork/join sort
> are standard implementation practice, named as mechanism — ⚠️ **no speed-up figure is claimed for
> either, because none was measured.** Second file of topic 02 —
> [02](02-divide-and-conquer.md) is the template and the recurrence. **No sandbox run.**

**The template gives you the skeleton; these two decisions give you a working algorithm.** The base
case size is usually presented as a micro-optimisation and is actually a correctness question — some
combines are undefined below a certain size, and a base case chosen for speed can quietly make the
recursion non-terminating. The induction is what turns a plausible split into an argument, and it
has exactly one interesting step, which is also exactly where every wrong divide-and-conquer
solution is wrong: the case analysis at the boundary.

## The base case is not always size 1

The base case has to be *correct* at whatever size you pick, and there are two reasons to pick
something bigger than 1.

**Correctness.** Some combines need at least two elements to be meaningful — the closest-pair
recursion needs at least three points in a strip before the geometry argument applies, and a
maximum-subarray recursion that must return a non-empty subarray needs `lo === hi` to return
`a[lo]` rather than 0.

**Constant factors.** Real sort implementations stop recursing at a small size and run insertion
sort on the block, because insertion sort's Θ(k²) with a tiny constant beats merge sort's Θ(k log k)
with a large one for small k. This is a genuine, universally used optimisation and it is worth
naming — it does not change the asymptotic class, since the cut-off is a constant:

```ts
const CUTOFF = 16;                                   // a constant: the class is unchanged

function sortRange(a: number[], lo: number, hi: number, aux: number[]): void {
  if (hi - lo + 1 <= CUTOFF) { insertionSort(a, lo, hi); return; }   // base case with real work
  const mid = lo + Math.floor((hi - lo) / 2);
  sortRange(a, lo, mid, aux);
  sortRange(a, mid + 1, hi, aux);
  if (a[mid] <= a[mid + 1]) return;                  // already ordered across the seam — skip the merge
  merge(a, lo, mid, hi, aux);
}
```

The `if (a[mid] <= a[mid + 1]) return;` line is worth knowing separately: if the largest element of
the left half is already at most the smallest of the right, the halves are already in order and the
merge is a no-op. It makes an already-sorted input Θ(n log n) with an almost-free merge at every
level, and it costs one comparison. It does not change the worst case.

## Why the recursion is correct: strong induction

The correctness argument for every divide-and-conquer algorithm is the same three-step induction,
and being able to say it is what converts "I think this works" into an argument:

1. **Base.** The algorithm is correct on inputs of the base size, by inspection.
2. **Inductive hypothesis.** Assume the recursive calls return correct answers for their inputs,
   which are strictly smaller.
3. **Inductive step.** Show the combine produces the correct answer for the whole from correct
   answers for the parts.

Step 3 is where the real content is, and it is exactly where a wrong divide-and-conquer algorithm is
wrong. For merge sort: merging two sorted sequences yields a sorted sequence, because the smallest
remaining element overall is the smaller of the two front elements. For maximum subarray: the best
subarray either lies entirely in the left half, entirely in the right, or crosses the midpoint, and
the crossing case is computed directly — the three cases are exhaustive, which is the load-bearing
claim. For counting inversions: every inversion has its left element in one half and its right
element in the other, or both in the same half, and those three counts are disjoint and exhaustive.

**"Disjoint and exhaustive" is the phrase to reach for.** A divide-and-conquer solution is wrong
precisely when its case analysis misses a case (usually the one that crosses the boundary) or
double-counts one (usually by counting a crossing pair in both halves).

## When to reach for it

The shapes that should make you think "divide and conquer" before you think anything else:

- **The input is an array and the answer for a range can be built from answers for its halves plus
  something about the boundary.** Maximum subarray, counting inversions, the closest pair, segment
  tree construction.
- **The problem is a sort, or reduces to one.** Merge sort, and anything that wants the data ordered
  as a side effect — counting inversions is the canonical example, since it gets the count for free
  while sorting.
- **You need one order statistic, not all of them.** The k-th smallest, the median. That is
  quickselect: the same partition as quicksort, with `a` dropped from 2 to 1, which is the change
  that buys linear expected time ([02f](02f-quickselect.md)).
- **The search space halves on a decision.** Binary search, and the whole family of "binary search on
  the answer" problems. This is degenerate divide and conquer — one subproblem, no combine — and
  framing it that way is what makes the log n obvious ([02i](02i-binary-search-as-degenerate-divide-and-conquer.md)).
- **The work is independent across the halves and you have cores.** Java's fork/join framework
  exists for exactly this shape, and `Arrays.parallelSort` is a parallel merge sort; the recursion's
  independence is the property that makes parallelism possible, and it is a legitimate thing to
  mention as a design consequence rather than as a measured speed-up.

And the shape that looks like divide and conquer and is not: a recursion that splits into pieces of
size n − 1 and 1. That is T(n) = T(n − 1) + f(n), which the master theorem does not apply to at all
and which unrolls to a sum — Θ(n²) when f is linear. Quicksort with the worst possible pivot is
exactly this, and so is "recursively process the first element then the rest".

## Gotchas

**★ Symptom: a case analysis that misses the answer spanning the midpoint.** Cause: "solve the left,
solve the right, take the better" with no crossing case. Fix: the three cases — entirely left,
entirely right, crossing — must be disjoint *and* exhaustive, and the crossing one is computed
directly by the combine. Every maximum-subarray and closest-pair bug is here.

**★ Symptom: a count that is too high, and exactly by the number of pairs on the boundary.** Cause:
double counting — an element or a pair counted both in a half and in the crossing case. Fix: fix the
convention explicitly (crossing means strictly one endpoint in each half) and check it on an input
of size two.

**Symptom: an "optimised" base case at size 1 that recurses into empty ranges and never
terminates.** Cause: `hi - lo + 1 <= 0` never triggering because the guard was written for exactly
1. Fix: base cases are inequalities — `if (lo >= hi) return;` — for the same reason as
[01b](01b-the-three-ways-the-contract-breaks.md)'s third failure.

**Symptom: a parallel fork/join version that is slower than the sequential one.** Cause: forking
below a sensible threshold, so task-creation overhead exceeds the work. Fix: a sequential cut-off in
the base case, exactly as with the insertion-sort cut-off; the threshold is a constant and does not
change the class. ⚠️ Do not claim a speed-up figure — the shape of the argument is what is defensible
without measurement.

**Symptom: the algorithm is correct and the interviewer keeps asking "why is that correct?"**
Cause: the induction never stated. Fix: three sentences — the base is correct by inspection, assume
the recursive calls are correct on strictly smaller inputs, and show the combine builds the right
answer from theirs. Naming the case analysis as disjoint and exhaustive is the part that lands.

**★ Symptom: a divide-and-conquer solution that recomputes the same subproblem over and over and is
exponential.** Cause: the subproblems overlap, which is not the divide-and-conquer shape at all —
naive Fibonacci is `T(n) = T(n-1) + T(n-2) + Θ(1)` and the two calls share almost all of their
work. Fix: overlapping subproblems want a memo or a table, not a split; the test is whether the two
recursive calls can touch the same subproblem, and if they can, it is dynamic programming.
[01e](01e-memoising-a-recursive-function.md) is the memo.

**Symptom: a base case that returns a neutral value which is not neutral for this combine.** Cause:
the identity chosen by habit — 0 for a maximum, an empty array for a "must be non-empty" answer.
Fix: pick the identity from the combine, and where the problem says the answer must be non-empty,
make the base case size 1 rather than 0 so the question does not arise.

**Symptom: a cut-off constant tuned into the code with a comment claiming a measured improvement.**
Cause: a number carried over from someone else's machine. Fix: the cut-off is standard practice and
its *existence* is defensible; a specific value or a speed-up percentage is not, unless you measured
it on the target. State it as "a small constant, typically in the tens".

## Interview questions

**★ How do you prove a divide-and-conquer algorithm correct?**
Strong induction on the input size. The base case is correct by inspection. Assume every recursive
call returns the correct answer for its input, which is strictly smaller — that is the inductive
hypothesis and it is legitimate precisely because the recursion's measure decreases. Then show that
the combine yields the correct answer for the whole from correct answers for the parts. The work is
all in that last step, and the useful discipline is to state the case analysis and check that it is
disjoint and exhaustive: for maximum subarray, the answer is entirely in the left half, entirely in
the right, or crosses the midpoint, and nothing else is possible. Missing the crossing case and
double-counting the boundary are the two ways this goes wrong.

**Why does an insertion-sort cut-off in merge sort not change the complexity?**
Because the cut-off is a constant. Below a fixed size k the algorithm does Θ(k²) work, which is
Θ(1) since k is a constant, and above it the recursion is unchanged; the recursion tree simply stops
a constant number of levels early, which removes a constant number of levels each costing Θ(n) —
that is Θ(n) removed from Θ(n log n). It is a real constant-factor improvement and an asymptotic
non-event, and saying both halves of that is the answer. ⚠️ I would not quote a speed-up figure for
it without measuring.

**Is binary search really divide and conquer?**
Yes, in the degenerate case: one subproblem instead of two, and no combine at all. The recurrence is
T(n) = T(n/2) + Θ(1), which is Θ(log n) — every level does constant work and there are log n levels.
Framing it that way is useful for two reasons. It makes the log n obvious without memorising it, and
it puts binary search in the same family as quickselect, which is the same shape with a linear
divide instead of a constant one and therefore Θ(n) rather than Θ(log n). It also makes clear why
the iterative form is the natural one: with no combine, nothing happens after the recursive call, so
the recursion is tail recursion and converts to a loop with no stack —
[01d](01d-tail-position-and-mutual-recursion.md).

**What makes a problem parallelisable with this shape?**
That the subproblems are independent: neither recursive call reads or writes what the other touches,
so they can run on different threads and only the combine has to wait. That is why fork/join
frameworks are built around exactly this template — fork the two halves, join, combine — and why
`Arrays.parallelSort` is a parallel merge sort rather than a parallel quicksort of the naive kind.
The practical caveat is the same as the insertion-sort cut-off: below some size the cost of creating
a task exceeds the work, so real implementations fall back to a sequential sort in the base case. I
would state that as a design consequence rather than a performance claim, since I have not measured
it.

**★ How do you choose the base case size?**
Correctness first: the smallest input on which the combine is meaningful. For merge sort that is 1,
since a single element is trivially sorted; for a maximum-subarray recursion that must return a
non-empty subarray it is also 1, returning that element rather than 0; for the closest-pair
recursion the geometry argument needs enough points that the strip step makes sense, so the base is
a handful and solved by brute force. Then, on top of a correct base, performance: real sorts stop
recursing at a small constant size and run insertion sort, because insertion sort's quadratic
behaviour with a tiny constant wins on tiny inputs. That second choice is a constant-factor decision
that provably does not change the asymptotic class, so it is safe to mention as standard practice —
I would not attach a number to the improvement without measuring.

**★ How can you tell divide and conquer from dynamic programming when both split the problem?**
By whether the subproblems overlap. Divide and conquer splits into pieces that share nothing — merge
sort's two halves are disjoint ranges, quickselect recurses on one side only — so each subproblem is
solved once and the recursion tree is the whole cost. Dynamic programming's recursion revisits the
same subproblem from different paths, which is why a memo collapses the tree into a table; naive
Fibonacci is what happens when you write a DP problem with a divide-and-conquer skeleton and no
memo. The practical test in an interview is to ask whether two recursive calls can ever be handed
identical arguments. If yes, memoise; if no, the split is genuine and the recurrence is the cost.

**What is the recursion depth of a divide-and-conquer algorithm, and does it overflow?**
Θ(log n) whenever the split is by a constant factor, because the input size is divided by b at each
level and reaches the base case after log_b n of them — so merge sort, binary search and
well-pivoted quicksort are all safe from the stack limits of
[01h](01h-choosing-recursion-and-reading-the-overflow.md) even at large n. The exception is a split
that degenerates: quicksort with consistently bad pivots recurses on n − 1 elements each time and
reaches depth n, which is both Θ(n²) in time and a stack overflow risk, and the standard mitigation
is to recurse on the smaller partition and loop on the larger so the depth is Θ(log n) whatever the
pivots do.

---

← Prev: [02 · Divide and conquer](02-divide-and-conquer.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [02c · Merge sort](02c-merge-sort.md)
