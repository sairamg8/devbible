---
title: "Counting inversions is merge sort with one statement added to the merge, and the reason that works is a case analysis you can derive at the whiteboard — every inverted pair is either inside a half or straddles the midpoint, and the merge already knows exactly when a straddling pair is inverted"
sidebar_label: "02e · Counting inversions"
sidebar_position: 2.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. Counting inversions by merge sort is a **standard algorithm** with no single
> primary source; the derivation below is the content and nothing is cited for it. The recurrence
> T(n) = 2T(n/2) + Θ(n) is solved by
> [phase 1 · 08](../phase-1-complexity/08-recurrences-and-the-master-theorem.md). The overflow
> reasoning for the count in Java rests on `Integer.MAX_VALUE` being 2³¹−1, which is the JDK 25
> `Integer` javadoc quoted in the phase 2 research bank. Fifth file of topic 02 —
> [02c](02c-merge-sort.md) is the merge sort this modifies. **No sandbox run.**

**An inversion is a pair of indices `i < j` with `a[i] > a[j]` — a pair that is out of order — and
counting them is the canonical interview demonstration that divide and conquer is about the
*combine* step rather than about sorting.** The brute force is two loops and Θ(n²). The
divide-and-conquer solution is merge sort with a single added statement, it is Θ(n log n), and the
reason it is correct is a three-case analysis you can derive live rather than recall. It is also the
question that reveals whether a candidate understands merge sort or has memorised it, because the
added line only makes sense if you know what the merge's two cursors mean.

## The derivation

Split the array at the midpoint into `L` and `R`. Take any inverted pair `(i, j)` with `i < j`.
Exactly one of three things is true:

1. **both indices are in `L`** — counted by the recursive call on the left half;
2. **both indices are in `R`** — counted by the recursive call on the right half;
3. **`i` is in `L` and `j` is in `R`** — a *split* inversion, and nobody has counted it yet.

The cases are **disjoint** (an index is in exactly one half) and **exhaustive** (`i < j` means `i`
cannot be in `R` while `j` is in `L`). So:

**inversions(a) = inversions(L) + inversions(R) + splitInversions(L, R)**

and the whole algorithm is the observation that if `L` and `R` are already *sorted* — which they are,
because the recursive call sorted them on its way out — then the split inversions fall out of the
merge for free.

## Why the merge already knows

During the merge, `i` points into the sorted left run and `j` into the sorted right run. When you
take an element from the right run because `R[j] < L[i]`, that element is smaller than `L[i]` — and
because `L` is sorted, it is also smaller than **every remaining element of `L`**, all of which are
at least `L[i]`. Each of those remaining left elements originally sat at an index less than `R[j]`'s
index, so each forms an inverted pair with it.

So the moment you take from the right, you have discovered exactly `(number of elements left in L)`
split inversions, in one step. That is the added statement:

```
count += mid - i + 1;      // when taking a[j] from the right run
```

and `mid - i + 1` is the count of unconsumed elements in the left run. Nothing else changes. The
merge was already doing the comparison; the only new work is an addition, so the combine is still
Θ(n) and the recurrence is still T(n) = 2T(n/2) + Θ(n) = Θ(n log n).

Two consequences worth stating out loud, because they are the follow-up questions:

- **Ties must not count.** `R[j] < L[i]` is a strict comparison, so equal elements do not form an
  inversion. If the problem's definition is `a[i] >= a[j]` instead, the comparison flips to `<=`,
  and — not coincidentally — that is the same character that decides stability in
  [02c](02c-merge-sort.md).
- **The array gets sorted as a side effect.** That is usually harmless and occasionally not: if the
  caller still needs the original order, sort a copy. Say which.

## TypeScript

```ts
export function countInversions(input: number[]): number {
  const a = input.slice();                       // do not disturb the caller's array
  const aux = new Array<number>(a.length);
  return sortCount(a, aux, 0, a.length - 1);
}

function sortCount(a: number[], aux: number[], lo: number, hi: number): number {
  if (lo >= hi) return 0;                        // 0 or 1 element: no pairs, no inversions
  const mid = lo + Math.floor((hi - lo) / 2);
  let count = sortCount(a, aux, lo, mid);        // case 1: both indices left
  count += sortCount(a, aux, mid + 1, hi);       // case 2: both indices right
  count += mergeCount(a, aux, lo, mid, hi);      // case 3: split inversions
  return count;
}

function mergeCount(a: number[], aux: number[], lo: number, mid: number, hi: number): number {
  for (let k = lo; k <= hi; k++) aux[k] = a[k];
  let i = lo, j = mid + 1, count = 0;
  for (let k = lo; k <= hi; k++) {
    if (i > mid) a[k] = aux[j++];
    else if (j > hi) a[k] = aux[i++];
    else if (aux[j] < aux[i]) {
      count += mid - i + 1;                      // ← THE ONE ADDED STATEMENT
      a[k] = aux[j++];
    } else a[k] = aux[i++];
  }
  return count;
}
```

## Java

```java
static long countInversions(int[] input) {
    int[] a = input.clone();
    int[] aux = new int[a.length];
    return sortCount(a, aux, 0, a.length - 1);
}

private static long sortCount(int[] a, int[] aux, int lo, int hi) {
    if (lo >= hi) return 0L;
    int mid = lo + (hi - lo) / 2;
    long count = sortCount(a, aux, lo, mid);
    count += sortCount(a, aux, mid + 1, hi);
    count += mergeCount(a, aux, lo, mid, hi);
    return count;
}

private static long mergeCount(int[] a, int[] aux, int lo, int mid, int hi) {
    System.arraycopy(a, lo, aux, lo, hi - lo + 1);
    int i = lo, j = mid + 1;
    long count = 0L;
    for (int k = lo; k <= hi; k++) {
        if      (i > mid)         a[k] = aux[j++];
        else if (j > hi)          a[k] = aux[i++];
        else if (aux[j] < aux[i]) { count += mid - i + 1; a[k] = aux[j++]; }
        else                      a[k] = aux[i++];
    }
    return count;
}
```

**The return type is `long`, deliberately.** The maximum possible number of inversions is the number
of pairs, n(n−1)/2, which for a reversed array of 10⁵ elements is about 5 × 10⁹ — larger than
`Integer.MAX_VALUE`, which the JDK documents as 2³¹−1. An `int` accumulator wraps silently and
returns a negative count with no error. This is the single most common wrong answer to this problem
in Java, and it only shows up on the largest test. TypeScript's `number` holds it exactly, since
5 × 10⁹ is far below `Number.MAX_SAFE_INTEGER` — the general integer-precision story is [05 ·
Integer limits and overflow](05-integer-limits-and-overflow.md).

## What else the same trick counts

The pattern is more general than inversions, and recognising it is the actual interview skill: *if
the quantity you want can be computed from a pair of sorted halves in linear time, merge sort will
compute it while sorting.*

| Problem | The added work in the combine | Still Θ(n log n)? |
|---|---|---|
| count inversions | `count += mid - i + 1` when taking from the right | yes — one addition |
| count pairs with `a[i] > 2·a[j]`, `i < j` | a separate two-pointer sweep over the two sorted halves *before* merging | yes — a second linear pass over the same range |
| "count of smaller elements after self" (per index) | carry indices alongside values and credit each left element as it is placed | yes |
| reverse pairs, range-sum counts | the same two-pointer sweep with a different predicate | yes |
| count pairs summing to a target across halves | two-pointer from both ends of the merged halves | yes |

The second row is worth writing out, because "just fold it into the comparison" does **not** work
when the predicate is not the merge's own comparison — `a[i] > 2·a[j]` cannot be read off
`aux[j] < aux[i]`. The fix is a separate linear sweep before the merge:

```ts
// count pairs (i in left, j in right) with a[i] > 2 * a[j], on already-sorted halves
function countReversePairs(a: number[], lo: number, mid: number, hi: number): number {
  let count = 0, j = mid + 1;
  for (let i = lo; i <= mid; i++) {
    while (j <= hi && a[i] > 2 * a[j]) j++;   // j never moves backwards across the whole loop
    count += j - (mid + 1);
  }
  return count;                               // Θ(n) total: each pointer advances at most n times
}
```

The bound on that loop is phase 1's amortised sentence — `j` only advances, so the inner `while`
runs at most `hi - mid` times over the entire outer loop, not per iteration
([phase 1 · 03](../phase-1-complexity/03-amortised-analysis.md)). Keeping the sweep separate from
the merge also means the merge stays the standard one, which is easier to get right.

## Gotchas

**★ Symptom: the count is short by exactly the pairs that straddle the midpoint.** Cause: the split
case never counted — the recursion returns `left + right` and the merge just merges. Fix: the third
case is the whole algorithm; `count += mid - i + 1` when taking from the right run.

**★ Symptom: the count is off by a factor that grows with the input, as if each pair were counted
once instead of many times.** Cause: `count++` instead of `count += mid - i + 1`. Taking one element
from the right resolves an inversion against *every* remaining left element, not one. Fix: add the
number of unconsumed left elements.

**★ Symptom: in Java, a negative inversion count on the largest test.** Cause: an `int` accumulator.
The maximum is n(n−1)/2, which exceeds `Integer.MAX_VALUE` (documented as 2³¹−1) well before n
reaches the constraint limits these problems use. Fix: `long`, everywhere in the chain — the return
type, the local, and the recursive calls' sum.

**★ Symptom: equal elements counted as inversions.** Cause: `aux[j] <= aux[i]` rather than
`aux[j] < aux[i]`. Fix: strict, unless the problem defines inversions non-strictly — read the
definition and say which one you implemented.

**★ Symptom: the answer is right but the caller's array is now sorted.** Cause: the algorithm sorts
in place as a side effect. Fix: `input.slice()` / `input.clone()` at the top, or state that the
input is consumed. This one is easy to miss because the returned count is still correct.

**★ Symptom: a "count pairs with `a[i] > 2·a[j]`" solution that folds the test into the merge
comparison and gives wrong counts.** Cause: the merge's comparison orders elements; the predicate is
a different relation, so the merge's cursor positions do not encode it. Fix: a separate two-pointer
sweep over the two sorted halves before merging, then merge normally.

**Symptom: the recursion returns the count but the halves were not sorted, so the split count is
wrong.** Cause: a version that counts without sorting, or that counts before recursing. Fix: the
split count is only valid because both halves are already sorted when the merge runs — the sorting
is not incidental, it is the precondition of the counting step.

**Symptom: an off-by-one in `mid - i + 1`.** Cause: the count of remaining left elements written as
`mid - i`. Fix: the remaining elements are indices `i` through `mid` inclusive, so there are
`mid - i + 1` of them; check it on a two-element input where `i === mid`, which must contribute 1.

**Symptom: the brute-force cross-check disagrees on arrays with duplicates only.** Cause: the strict
versus non-strict definition differs between your reference implementation and the merge. Fix: fix
the definition once and use the same comparison in both.

## Interview questions

**★ Count the inversions in an array faster than Θ(n²).**
Merge sort with one added statement, Θ(n log n). Split at the midpoint: every inverted pair has both
indices in the left half, both in the right half, or one in each — disjoint and exhaustive, so the
total is the two recursive counts plus the split count. The recursion sorts the halves on the way
out, and once the halves are sorted the split count is free: during the merge, when you take an
element from the right run because it is strictly smaller than the current left element, it is
smaller than every remaining left element too, since the left run is sorted — so that single step
has just found `mid - i + 1` inversions. Add that number, merge as usual, and the combine is still
linear, so the recurrence is T(n) = 2T(n/2) + Θ(n) and the bound is Θ(n log n).

**★ Why is the count `mid - i + 1` rather than one?**
Because taking one element from the right run resolves its relationship with *all* the left elements
that have not yet been placed. The left run is sorted, so if `R[j] < L[i]` then `R[j]` is also less
than `L[i+1]`, `L[i+2]`, …, `L[mid]`; every one of those sits at an earlier original index than
`R[j]` does, so every one forms an inverted pair with it. There are `mid - i + 1` of them counting
inclusively. Incrementing by one instead counts each right element as being inverted with at most
one left element, which undercounts badly on anything but nearly-sorted input.

**★ What type do you use for the count, and why does it matter?**
`long` in Java, and it matters because the maximum number of inversions is the number of pairs,
n(n−1)/2 — for a reversed array of a hundred thousand elements that is around five billion, which is
past `Integer.MAX_VALUE` at 2³¹−1. Java's `int` arithmetic wraps silently rather than throwing, so
the symptom is a negative count on the largest test and nothing at all on the small ones. In
TypeScript the default `number` is a double and represents integers exactly up to
`Number.MAX_SAFE_INTEGER`, which is 2⁵³−1, so five billion is safe — but the same reasoning is the
one to state, because the answer to "what if n is 10⁹" is different again.

**★ How would you count, for each index, how many elements after it are smaller?**
The same merge sort, carrying indices alongside values so each element keeps its identity through
the sort, and crediting a left element with the number of right-run elements that have already been
placed ahead of it at the moment it is placed. That count is `j - (mid + 1)`. It is the per-element
version of the same argument and it is still Θ(n log n). The common alternative is a Binary Indexed
Tree over value ranks, scanning right to left — also Θ(n log n), with the advantage that it
generalises to "how many are in this value range" and the disadvantage that it needs coordinate
compression first.

**★ Why does the trick work for inversions but not for "pairs with `a[i] > 2·a[j]`"?**
Because the merge's comparison is `R[j] < L[i]`, which is precisely the inversion predicate — so the
cursor positions already encode the answer. `a[i] > 2·a[j]` is a different relation, and the point
at which the merge chooses to take from the right tells you nothing about it. The fix keeps the
structure and moves the counting out of the merge: before merging, run a separate two-pointer sweep
over the two sorted halves, advancing `j` while the predicate holds for the current `i`. That sweep
is linear by the amortised argument — `j` only moves forward across the whole outer loop — so the
combine is Θ(n) plus Θ(n) and the bound is unchanged.

**Is there a way to count inversions without sorting?**
Yes: a Binary Indexed Tree or an order-statistic tree over the values, scanning the array once and
querying "how many values greater than this have I already seen". That is also Θ(n log n) and it
needs coordinate compression when the values are large or non-integral. The merge-sort version is
usually the better interview answer because it needs no auxiliary data structure and because the
correctness argument is the three-case split, which you can derive on the spot; the BIT version is
better when the same structure is already present for other queries or when the elements arrive as
a stream.

**Where does this come up outside an interview?**
As a distance between rankings. The number of inversions between two orderings of the same items is
Kendall's tau distance, which is how you measure how much a re-ranking changed things — a storefront
recomputing search relevance can quantify the disruption to the previous result order by counting
inversions between old and new positions. The Θ(n²) version is fine for a page of results and not
for a catalogue, which is exactly the situation where knowing the Θ(n log n) version pays.

---

← Prev: [02d · Stability and the comparator contract](02d-stability-and-the-comparator-contract.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [02f · Quickselect](02f-quickselect.md)
