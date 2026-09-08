---
title: "Merge sort is the divide-and-conquer template with a free divide and all the work in the combine, and the two details that separate a candidate who has memorised it from one who has written it are the single character that makes the merge stable and the auxiliary array allocated once instead of once per level"
sidebar_label: "02c · Merge sort"
sidebar_position: 2.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. Merge sort is **textbook** (CLRS, *divide-and-conquer*) and is derived here
> rather than cited; the recurrence T(n) = 2T(n/2) + Θ(n) is solved by
> [phase 1 · 08](../phase-1-complexity/08-recurrences-and-the-master-theorem.md). The JavaScript
> sort facts are MDN,
> [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort),
> quoted verbatim — including that the sort has been specified as stable *"since version 10 (or
> ECMAScript 2019)"* and the five comparator properties. ⚠️ MDN documents no algorithm and no
> complexity for `Array.prototype.sort`; none is claimed here. Third file of topic 02 —
> [02](02-divide-and-conquer.md) is the template and
> [02d](02d-stability-and-the-comparator-contract.md) is what the two platforms guarantee about
> their own sorts. **No sandbox run.**

**Merge sort is worth writing out in full, in both languages, because it is the one algorithm an
interviewer can ask you to produce from memory with no hints, and because three of its lines carry
ideas the rest of the topic reuses: the `<=` that makes it stable, the single auxiliary array that
keeps the space at Θ(n) instead of Θ(n log n), and the merge loop that
[02e](02e-counting-inversions.md) turns into an inversion counter by adding one statement.** The
algorithm itself is the template with the easiest possible divide — split by index, which costs
nothing — and all the work in the combine. What the *platform's* sort guarantees, and the comparator
contract that makes those guarantees hold, is
[02d](02d-stability-and-the-comparator-contract.md).

## The recurrence, first

Splitting an array by index is Θ(1). Merging two sorted runs of total length n is Θ(n), because
every comparison advances one of the two cursors and there are n advances in total. So:

**T(n) = 2T(n/2) + Θ(n)** → every level costs Θ(n), there are log₂ n levels → **Θ(n log n)**, and
that is the *worst* case, not an average — merge sort makes no assumption about the data.
[Phase 1 · 08](../phase-1-complexity/08-recurrences-and-the-master-theorem.md) solves it formally.
Space is Θ(n) for the auxiliary buffer plus Θ(log n) for the recursion stack, and the buffer
dominates, so the honest answer to "space?" is **Θ(n)**.

## TypeScript, in full

```ts
export function mergeSort(a: number[]): number[] {
  const out = a.slice();                       // sort a copy; the caller's array is untouched
  const aux = new Array<number>(out.length);   // ONE buffer, allocated once (see below)
  sortRange(out, aux, 0, out.length - 1);
  return out;
}

function sortRange(a: number[], aux: number[], lo: number, hi: number): void {
  if (lo >= hi) return;                        // base: 0 or 1 element is already sorted
  const mid = lo + Math.floor((hi - lo) / 2);  // not (lo + hi) / 2 — habit, see the gotchas
  sortRange(a, aux, lo, mid);                  // conquer left
  sortRange(a, aux, mid + 1, hi);              // conquer right
  if (a[mid] <= a[mid + 1]) return;            // already ordered across the seam: skip the merge
  merge(a, aux, lo, mid, hi);                  // combine
}

function merge(a: number[], aux: number[], lo: number, mid: number, hi: number): void {
  for (let k = lo; k <= hi; k++) aux[k] = a[k];   // snapshot the range we are about to overwrite
  let i = lo, j = mid + 1;
  for (let k = lo; k <= hi; k++) {
    if (i > mid) a[k] = aux[j++];                 // left exhausted
    else if (j > hi) a[k] = aux[i++];             // right exhausted
    else if (aux[j] < aux[i]) a[k] = aux[j++];    // strictly less: take from the right
    else a[k] = aux[i++];                         // TIES GO LEFT — this is stability
  }
}
```

The four branches in the merge loop are in that order for a reason: the two exhaustion checks first
so the comparison never reads past a boundary, then the comparison written as `aux[j] < aux[i]` —
**strictly** less — so that on a tie the element from the *left* run is taken. The left run holds
elements that were earlier in the original array, so ties preserve the original order, which is the
definition of a stable sort. Write `aux[j] <= aux[i]` instead and the algorithm still sorts
correctly and is no longer stable. It is one character, it is invisible in a test that only checks
ordering, and it is the detail interviewers ask about.

## Java, in full

```java
static void mergeSort(int[] a) {
    int[] aux = new int[a.length];              // allocated once, reused at every level
    sortRange(a, aux, 0, a.length - 1);
}

private static void sortRange(int[] a, int[] aux, int lo, int hi) {
    if (lo >= hi) return;
    int mid = lo + (hi - lo) / 2;               // NOT (lo + hi) / 2 — that addition can overflow int
    sortRange(a, aux, lo, mid);
    sortRange(a, aux, mid + 1, hi);
    if (a[mid] <= a[mid + 1]) return;
    merge(a, aux, lo, mid, hi);
}

private static void merge(int[] a, int[] aux, int lo, int mid, int hi) {
    System.arraycopy(a, lo, aux, lo, hi - lo + 1);
    int i = lo, j = mid + 1;
    for (int k = lo; k <= hi; k++) {
        if      (i > mid)        a[k] = aux[j++];
        else if (j > hi)         a[k] = aux[i++];
        else if (aux[j] < aux[i]) a[k] = aux[j++];
        else                      a[k] = aux[i++];   // ties go left → stable
    }
}
```

`mid = lo + (hi - lo) / 2` rather than `(lo + hi) / 2` matters in Java because `int` addition wraps
silently rather than throwing; on an array long enough for `lo + hi` to exceed `Integer.MAX_VALUE`
the midpoint goes negative and the index throws. That is an integer-overflow story rather than a
sorting one, and it belongs to **05 · Integer limits and overflow** *(not written yet)* — here it is
a habit, written the safe way every time.

## The auxiliary array: allocate once, not once per level

The version everyone writes first allocates inside the merge:

```ts
// ✗ allocates a new buffer at every merge — Θ(n) allocations, and garbage proportional to n log n
function mergeAllocating(left: number[], right: number[]): number[] {
  const out: number[] = [];                    // new array per call, at every level
  let i = 0, j = 0;
  while (i < left.length && j < right.length) out.push(left[i] <= right[j] ? left[i++] : right[j++]);
  while (i < left.length) out.push(left[i++]);
  while (j < right.length) out.push(right[j++]);
  return out;
}
```

The *peak* live memory of that version is still Θ(n) — at any instant one path of merges is
outstanding, and the buffers along it sum to a geometric series — so the space bound you would
state is unchanged. What changes is the total number of allocations and the garbage produced,
which is Θ(n log n) worth of array writes into fresh objects instead of Θ(n log n) writes into one
reused buffer. That is a constant-factor and allocator-pressure argument rather than an asymptotic
one, and the correct way to say it is exactly that: *"same Θ(n) space, but one allocation instead
of one per merge, so no garbage per level."* ⚠️ Do not attach a speed-up number to it.

The single-buffer version also composes better: because `merge` writes into `a` and reads from
`aux`, the same buffer serves every level, and a common refinement swaps the roles of the two
arrays per level so the copy at the top of `merge` disappears entirely.

## Bottom-up merge sort: the same algorithm without recursion

Merge sort does not need the call stack at all. Merge every adjacent pair of runs of width 1, then
of width 2, then 4, doubling until the width covers the array:

```ts
// iterative merge sort — same Θ(n log n) time, same Θ(n) buffer, zero recursion depth
export function mergeSortBottomUp(a: number[]): number[] {
  const out = a.slice();
  const n = out.length;
  const aux = new Array<number>(n);
  for (let width = 1; width < n; width *= 2) {                 // log n passes
    for (let lo = 0; lo < n - width; lo += 2 * width) {        // each pass touches n elements
      const mid = lo + width - 1;
      const hi = Math.min(lo + 2 * width - 1, n - 1);          // the last run may be short
      merge(out, aux, lo, mid, hi);
    }
  }
  return out;
}
```

Two details that are easy to get wrong: the outer guard is `lo < n - width`, because a final run
with no partner to merge against must be left alone, and `hi` is clamped to `n - 1` because the
last pair is usually unbalanced. This version is the one to reach for when the recursion depth is a
concern — though for merge sort it never is, since the depth is log n — and it is the standard form
for sorting a linked list, where you cannot index to the midpoint cheaply.

## Gotchas

**★ Symptom: the sort is correct and equal elements come out in a different order than they went
in.** Cause: the merge comparison written as `aux[j] <= aux[i]`, so a tie takes from the right run.
Fix: `aux[j] < aux[i]` — strictly less — so ties take from the left, which is the earlier run.
One character, invisible to a test that only checks ordering.

**★ Symptom: the space bound quoted as Θ(log n) for merge sort.** Cause: only the recursion stack
counted. Fix: the auxiliary buffer is Θ(n) and dominates the Θ(log n) stack; merge sort's space is
Θ(n). It is the one respect in which quicksort beats it.

**★ Symptom: an out-of-bounds read inside the merge loop.** Cause: the comparison evaluated before
the exhaustion checks, so `aux[i]` is read with `i > mid`. Fix: the four branches in order —
left exhausted, right exhausted, compare, else — and the exhaustion checks first.

**★ Symptom: `mid` computed as `(lo + hi) / 2` and an index exception on a very large Java array.**
Cause: `int` overflow in the addition before the division. Fix: `lo + (hi - lo) / 2`, always, as a
habit. Developed on **05 · Integer limits and overflow** *(not written yet)*.

**★ Symptom: a bottom-up merge sort that drops the tail of the array.** Cause: `hi` not clamped, or
the outer loop condition written as `lo < n` so a final unpaired run is "merged" against nothing.
Fix: `for (lo = 0; lo < n - width; lo += 2 * width)` and `hi = Math.min(lo + 2*width - 1, n - 1)`.

**Symptom: memory pressure from a merge sort on large inputs.** Cause: a fresh buffer allocated per
merge. Fix: one buffer allocated at the top and passed down; the peak space is the same Θ(n), but
the allocation count drops from Θ(n) to one. ⚠️ Worth saying as a mechanism, not as a measured
improvement.

**Symptom: sorting the caller's array when the caller still needed the original.** Cause: an
in-place API without permission. Fix: say which you are doing — `sort()` mutates in JavaScript and
`toSorted()` copies; `mergeSort` above copies deliberately. Phase 1 ·
[04](../phase-1-complexity/04-space-and-the-recursion-stack.md) has the "in place needs permission"
convention.

## Interview questions

**★ Write merge sort and tell me its complexity and its space.**
Split by index at the midpoint, recurse on both halves, merge the two sorted halves in linear time
using a buffer. The recurrence is T(n) = 2T(n/2) + Θ(n): the divide is free, the merge is linear
because every comparison advances one of the two cursors and there are n advances. Every level costs
Θ(n) and there are log n levels, so Θ(n log n) — and that is the worst case, not an average, because
nothing about the algorithm depends on the data. Space is Θ(n) for the auxiliary buffer plus Θ(log n)
for the recursion stack, so Θ(n) overall; that is the price it pays for the worst-case guarantee and
the reason quicksort is preferred where memory matters.

**★ What makes merge sort stable, and where does that matter?**
The comparison in the merge. When the two front elements are equal, taking from the *left* run
preserves their original relative order, because the left run holds elements that were earlier in
the input; that means writing `right < left` rather than `right <= left`. Stability matters whenever
you sort by a second key after a first and want the first key's order preserved within ties — sort
orders by date, then by total, and equal totals stay in date order. JavaScript's built-in sort has
been specified as stable since ECMAScript 2019, which MDN states explicitly; Java's `Arrays.sort`
is stable for object arrays and not for primitives, which is why a Java answer that needs stability
sorts objects.

**★ Why do you allocate the auxiliary array once instead of inside the merge?**
Because otherwise every merge allocates, which is Θ(n) allocations over the whole sort and produces
garbage proportional to the total merged length, n log n. The peak live memory is Θ(n) either way —
only one path of merges is outstanding at a time — so the stated space bound does not change, which
is exactly why this is a constant-factor and allocator-pressure argument rather than a complexity
one. Saying it that precisely is the point: it is a real improvement and it does not change the
bound, and conflating the two is the mistake.

**★ Merge sort or quicksort?**
Quicksort when memory matters and the average case is what you are optimising: it sorts in place,
its constant factors are smaller because it does no copying, and with a randomised pivot the Θ(n²)
worst case is not something an adversary can force. Merge sort when you need a *guarantee* rather
than an average — its Θ(n log n) is worst-case — when you need stability, or when you are sorting a
linked list, where merge sort needs no random access and quicksort's partition does. Merge sort is
also the natural choice for external sorting, since it streams: you can merge runs that do not fit
in memory, which is why it is what a database's sort spills to disk with.

**★ How would you sort a linked list?**
Bottom-up merge sort, or a recursive merge sort that finds the midpoint with the slow/fast pointer
trick. Merge sort is the right answer here specifically because merging two sorted lists is pointer
rewiring with Θ(1) extra space and no random access, while quicksort's partition wants indexed
access to be efficient. The complexity is Θ(n log n) time; the space is Θ(log n) for the recursion,
or Θ(1) if you write the bottom-up version — which is the only common case where merge sort is not
Θ(n) space, because there is no buffer to allocate.

**Why is merge sort's bound a worst case while quicksort's n log n is an average?**
Because merge sort's split is by position and always exact — the two halves are always n/2, whatever
the data — so the recursion tree has the same shape for every input and the recurrence
T(n) = 2T(n/2) + Θ(n) always holds. Quicksort's split is by *value*, around a pivot, so the shape
depends on the data: a good pivot gives two halves and the same recurrence, a bad pivot gives a
partition of size n − 1 and 0, and T(n) = T(n − 1) + Θ(n) is Θ(n²). The average over random pivots
is Θ(n log n), and randomising the pivot is what converts "bad on sorted input" into "bad only with
bad luck", which is **10 · Randomisation** *(not written yet)*.

**Can merge sort be made in-place?**
There are in-place merge algorithms, but they trade the simple linear merge for something
substantially more intricate and slower in constant factors, and no interview expects one. The
honest answer is that the standard algorithm is not in place — it needs Θ(n) auxiliary space — that
in-place merging is possible in Θ(n log n) with a more complex merge, and that if in-place is a hard
requirement the practical choice is heapsort (Θ(n log n) worst case, Θ(1) space, not stable) or
quicksort (Θ(1) auxiliary beyond the recursion, average Θ(n log n), not stable).

{/* FOOTER */}
