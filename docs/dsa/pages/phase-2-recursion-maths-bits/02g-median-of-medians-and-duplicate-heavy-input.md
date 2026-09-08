---
title: "Quickselect's quadratic worst case has two different causes and therefore two different fixes — an unbalanced split, answered deterministically by median of medians and pragmatically by a random pivot, and an array of duplicates, answered by partitioning into three regions instead of two"
sidebar_label: "02g · Median of medians, and duplicates"
sidebar_position: 2.6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. Median of medians (BFPRT) and the Dutch national flag partition are
> **standard algorithms** with no single primary source; the 3n/10 argument and the recurrence
> T(n) ≤ T(n/5) + T(7n/10) + Θ(n) are derived here rather than cited, and the recurrence is solved
> by substitution because it has two differently-sized recursive calls — a case the master theorem
> of [phase 1 · 08](../phase-1-complexity/08-recurrences-and-the-master-theorem.md) does not cover.
> ⚠️ **No measured constant factor and no timing**: the claim that randomised quickselect is what
> ships is stated as engineering practice and its "large constant" is described as mechanism, never
> as a number. Seventh file of topic 02 — [02f](02f-quickselect.md) is quickselect itself. **No
> sandbox run.**

**Two different inputs break quickselect, and confusing them leads to applying the wrong fix.** A
*sorted* array breaks a deterministic pivot rule because every partition is maximally unbalanced;
the fix is a better pivot, either random (expected linear, no bad inputs) or median-of-medians
(worst-case linear, deterministic). An array of *duplicates* breaks a two-way partition because
everything equal to the pivot lands on one side; no pivot rule helps, because every pivot is the
same value — the fix is a different partition. This page is both, with the arguments that make each
bound believable.

## The deterministic fix: median of medians

If Θ(n²) is unacceptable even with bad luck — a hard real-time bound, or an adversarial setting —
there is a deterministic algorithm with a **worst-case** Θ(n) bound, usually called median of
medians or BFPRT. The sketch, which is what an interview wants:

1. Split the array into groups of five.
2. Find the median of each group directly (five elements: a constant-time sort).
3. Recursively apply the *same selection algorithm* to find the median of those n/5 medians.
4. Use that as the pivot for the partition.

The guarantee is that this pivot is greater than at least 3n/10 elements and less than at least
3n/10, so the partition discards at least 30% of the array however the data is arranged. That gives

**T(n) ≤ T(n/5) + T(7n/10) + Θ(n)**

and because 1/5 + 7/10 = 9/10 < 1, the total work is a geometric series and the recurrence solves to
Θ(n) — in the worst case, not in expectation. Note that this recurrence has two recursive calls of
*different* sizes, which is exactly the shape the master theorem does not handle; it is solved by
the substitution method instead ([phase 1 · 08](../phase-1-complexity/08-recurrences-and-the-master-theorem.md)).

What to say about using it: almost nobody does. The constant factor is large — every level does a
full pass to build the medians array plus a recursive selection on it, on top of the partition — and
a randomised pivot gives expected linear time with a failure probability that shrinks rapidly. The
correct interview answer is to name median-of-medians as the deterministic guarantee, sketch the
groups-of-five and the 3n/10 bound, and say that randomisation is what you would actually ship. ⚠️
Do not quantify "large constant factor" — that is a claim I have not measured.

## Duplicates: the three-way partition

A two-way partition on an array where most elements equal the pivot puts all the equal elements on
one side and degrades toward the bad case. The Dutch national flag partition splits into three
regions — less than, equal to, greater than — in one pass:

```ts
// three-way partition: returns [ltEnd, gtStart] such that a[ltEnd..gtStart-1] all equal the pivot
function partition3(a: number[], lo: number, hi: number, pivot: number): [number, number] {
  let lt = lo, i = lo, gt = hi;
  while (i <= gt) {
    if (a[i] < pivot) { [a[lt], a[i]] = [a[i], a[lt]]; lt++; i++; }
    else if (a[i] > pivot) { [a[gt], a[i]] = [a[i], a[gt]]; gt--; }   // i does NOT advance here
    else i++;
  }
  return [lt, gt + 1];
}
```

The subtlety is the middle branch: after swapping in an element from the far end you have not
examined it yet, so `i` must not advance. With three-way partitioning, quickselect on an array of
all-equal elements finishes in one pass, because the entire array lands in the equal region and the
answer is the pivot.

## The same two fixes, in quicksort

Everything above transfers to quicksort, with one addition: quicksort recurses on *both* sides, so a
bad pivot costs it stack depth as well as time. The standard production combination is a randomised
or median-of-three pivot, a three-way partition when duplicates are plausible, recursion on the
smaller side with a loop on the larger (bounding the depth to Θ(log n) whatever the pivots do — see
[01f](01f-converting-recursion-to-an-explicit-stack.md)), and an insertion-sort cut-off at small
sizes. Introsort adds one more: count the recursion depth, and if it exceeds a multiple of log n,
switch to heapsort, which converts quicksort's Θ(n²) worst case into a Θ(n log n) guarantee without
paying median-of-medians' overhead on every call. Naming introsort is a good answer to "how do real
libraries get a worst-case bound?"

## Gotchas

**★ Symptom: an infinite loop on an array where all elements are equal.** Cause: a Hoare-style
partition whose pointers do not both advance past equal elements, or a two-way partition that
returns a boundary equal to `lo` or `hi` so the range never shrinks. Fix: the three-way partition,
or check that each iteration strictly reduces `hi - lo`. It is exactly the "progress toward the base
case" failure of [01b](01b-the-three-ways-the-contract-breaks.md).

**★ Symptom: the middle branch of the three-way partition advances `i` and elements are skipped.**
Cause: after swapping with the element at `gt`, the value now at `i` has not been examined. Fix:
only `lt++/i++` on the less-than branch and `i++` on the equal branch; the greater-than branch
decrements `gt` and leaves `i` alone.

**Symptom: median-of-medians described as the practical choice.** Cause: worst-case bound treated as
the deciding factor. Fix: name it as the deterministic guarantee, say randomised quickselect is what
ships, and do not attach numbers to "the constant factor is large" unless you have measured them.

**★ Symptom: a three-way partition that loses elements, or an array with the wrong multiset of
values afterwards.** Cause: a swap that overwrites rather than exchanges, usually from writing
`a[i] = a[gt]` instead of a true swap on the greater-than branch. Fix: all three branches exchange;
nothing is ever assigned without the displaced value going somewhere.

**★ Symptom: median-of-medians implemented and it is quadratic anyway.** Cause: the median of the
medians found by *sorting* the medians array rather than by a recursive call to the selection
algorithm. Sorting n/5 elements is Θ(n log n) per level. Fix: the pivot-finding step is a recursive
call to the same select function; that is why the recurrence has a T(n/5) term rather than an
Θ(n log n) one.

**★ Symptom: groups of five changed to groups of three "to simplify", and the bound breaks.**
Cause: with groups of three, the guarantee drops to discarding n/3 and the recurrence becomes
T(n) ≤ T(n/3) + T(2n/3) + Θ(n), where the fractions sum to exactly 1 — so the levels no longer
shrink geometrically and the solution is Θ(n log n), not Θ(n). Fix: five is not arbitrary; the
fractions must sum to strictly less than 1.

**Symptom: a duplicate-heavy input handled by "just use a `Set` first".** Cause: deduplication
mistaken for a fix. Fix: it changes the problem — the k-th smallest *distinct* value is not the
k-th smallest value. Only do it if the problem asked for distinct values, and say so.

**Symptom: median-of-three chosen as a defence against an adversary.** Cause: a heuristic mistaken
for a randomisation. Fix: median-of-three is deterministic, so an adversary who knows the rule can
still construct a killer input; it defends against *ordinary* sorted data, not against a chosen
one. Only actual randomness removes the bad input.

## Interview questions

**★ How do you handle an array that is mostly duplicates?**
A three-way partition — the Dutch national flag — which splits into less-than, equal-to and
greater-than in a single pass, so all the equal elements are removed from consideration at once.
With a two-way partition, an array of identical elements puts everything on one side of the pivot
and the range shrinks by one per pass, which is the Θ(n²) case; with three-way, an all-equal array
finishes in one pass because the whole array becomes the equal region and the pivot is the answer.
The implementation detail worth stating is that on the greater-than branch you swap in an unexamined
element from the far end, so the scanning index must not advance.

**★ Sketch median of medians and say why the pivot is good.**
Split into groups of five, sort each group in constant time and take its median, then recursively
run the same selection algorithm on the n/5 medians to find their median, and use that as the pivot.
The chosen value is at least as large as the medians of half the groups, and in each such group it
is at least as large as three of the five elements, so it is at least as large as roughly 3n/10 of
the array — and symmetrically at least 3n/10 are larger. So the partition always discards at least
30%, whatever the input. The cost recurrence is T(n) ≤ T(n/5) for finding the pivot plus T(7n/10)
for the recursive selection plus Θ(n) for the grouping and partitioning; since 1/5 + 7/10 is less
than 1 the work shrinks geometrically and the total is Θ(n) in the worst case. It has two
different-sized recursive calls, so the master theorem does not apply and it is solved by
substitution.

**★ Why groups of five in median of medians?**
Because the two recursive terms have to sum to strictly less than one for the work to shrink
geometrically. With groups of five, finding the median of the medians costs T(n/5) and the partition
guarantees discarding at least 30% of the array, so the remaining recursion is at most T(7n/10);
1/5 + 7/10 = 9/10 < 1, and the total is Θ(n). With groups of three the guarantee weakens to
discarding about a third, giving T(n/3) + T(2n/3), whose fractions sum to exactly 1 — every level
then costs the same Θ(n) and there are log n of them, so it degrades to Θ(n log n). Groups of seven
also work, and five is the smallest odd group size for which the arithmetic comes out.

**★ If median of medians is worst-case linear, why does anything use a random pivot?**
Because the worst case is not the thing being optimised in most systems. Median of medians pays, at
every level, for building the medians array and for a recursive selection on it, on top of the
partition it was going to do anyway — so its guaranteed linear time has a much larger constant than
randomised quickselect's expected linear time. Randomisation gives a bound that holds for every
input with high probability, and the probability of repeatedly bad luck falls off fast. The
situations that genuinely want the deterministic version are the ones where a tail latency is a
contractual obligation, or where the input is supplied by someone who benefits from making you slow
and can observe or predict your randomness. ⚠️ I would not put a number on the constant-factor gap
without measuring it.

**How does a three-way partition change the recurrence?**
It removes the equal elements from the recursion entirely. With d elements equal to the pivot, the
subproblem is not n − 1 but n − d, so an array with many duplicates shrinks fast rather than by one
per pass. In the extreme where all elements are equal, d = n and the algorithm terminates after a
single Θ(n) partition — the case that is Θ(n²) with a two-way partition. The cost is one extra
pointer and a slightly more intricate loop, and the reason it is not always used is that on data
with few duplicates the extra comparisons buy nothing.

**Can an adversary defeat a randomised quickselect?**
Only by predicting the randomness. The expected-linear bound holds for every input, taken over the
algorithm's own choices, so an adversary who chooses the array cannot force the bad case — they can
only be lucky. Where it breaks down is if the "randomness" is predictable: a seeded generator whose
seed the attacker can guess, or a pivot rule that only looks random. MDN notes that `Math.random()`
*"does not provide cryptographically secure random numbers"* and that the seed *"cannot be chosen
or reset by the user"*, which is a fine combination here — unseedable is what you want for the
adversarial argument, and it is also why a randomised solution is not reproducible in a test unless
you inject the pivot chooser yourself. The hash-collision analogue is the same story with hash
functions, and it is why platform hash maps randomise their seeds.

---

← Prev: [02f · Quickselect](02f-quickselect.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [02h · Solve halves, combine — without sorting](02h-solve-halves-combine-when-it-is-not-sorting.md)
