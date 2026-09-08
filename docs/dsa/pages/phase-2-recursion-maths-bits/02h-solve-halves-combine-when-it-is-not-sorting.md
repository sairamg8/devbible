---
title: "The three problems that teach divide and conquer without any sorting — maximum subarray, the closest pair of points, and the majority element — share one structure and one failure mode: the answer either lives inside a half or straddles the midpoint, and every wrong solution is one that forgot the straddling case"
sidebar_label: "02h · Solve halves, combine — without sorting"
sidebar_position: 2.7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. Maximum subarray by divide and conquer, Kadane's algorithm, the closest-pair
> algorithm and Boyer–Moore majority voting are **standard algorithms** with no single primary
> source; the case analyses and the invariants below are derived here rather than cited. The
> closest-pair strip bound (a constant number of neighbours per point) is the textbook packing
> argument, stated as textbook. All recurrences are solved against
> [phase 1 · 08](../phase-1-complexity/08-recurrences-and-the-master-theorem.md). Eighth file of
> topic 02 — [02](02-divide-and-conquer.md) is the template. **No sandbox run.**

**Merge sort makes divide and conquer look like a sorting technique; these three make it obvious
that it is a *case-analysis* technique.** None of them sorts as its purpose, all three have the same
skeleton — solve the left half, solve the right half, handle whatever crosses the midpoint — and in
all three the crossing case is where the algorithm actually lives. Two of them also have a strictly
better linear solution, which makes them excellent interview material: the divide-and-conquer answer
is the one you can derive, and the linear one is the one that shows you kept looking.

## Maximum subarray

Find the contiguous subarray with the largest sum. The three-case split:

1. the best subarray lies **entirely in the left half** — recursive call;
2. entirely in the **right half** — recursive call;
3. it **crosses the midpoint** — so it consists of a suffix of the left half plus a prefix of the
   right half, and each of those can be found greedily in one linear scan outward from the middle.

Disjoint and exhaustive: a contiguous range either contains the boundary between `mid` and
`mid + 1` or it does not, and if it does not it is wholly on one side. Case 3 is the content, and
the reason it is linear is that the best crossing subarray must extend to the midpoint on both
sides, so there is nothing to search — just accumulate outward and keep the running maximum.

```ts
export function maxSubarray(a: number[]): number {
  return go(a, 0, a.length - 1);
}

function go(a: number[], lo: number, hi: number): number {
  if (lo === hi) return a[lo];                        // base: single element, non-empty answer
  const mid = lo + Math.floor((hi - lo) / 2);
  const left = go(a, lo, mid);
  const right = go(a, mid + 1, hi);
  return Math.max(left, right, crossing(a, lo, mid, hi));
}

// best sum that MUST include a[mid] and a[mid + 1] — one scan left, one scan right
function crossing(a: number[], lo: number, mid: number, hi: number): number {
  let sum = 0, bestLeft = -Infinity;
  for (let i = mid; i >= lo; i--) { sum += a[i]; bestLeft = Math.max(bestLeft, sum); }
  sum = 0;
  let bestRight = -Infinity;
  for (let j = mid + 1; j <= hi; j++) { sum += a[j]; bestRight = Math.max(bestRight, sum); }
  return bestLeft + bestRight;                        // both halves are non-empty by construction
}
```

T(n) = 2T(n/2) + Θ(n) = **Θ(n log n)**, with Θ(log n) stack.

**And it is not the right answer, which is the point of asking it.** Kadane's algorithm is Θ(n) and
Θ(1) space, and it is a one-line dynamic program: the best subarray ending at index `i` is either
`a[i]` alone or `a[i]` extended onto the best subarray ending at `i − 1`.

```ts
// Kadane: Θ(n) time, Θ(1) space. best ending here = max(a[i], a[i] + best ending at i-1)
export function maxSubarrayKadane(a: number[]): number {
  let best = a[0], endingHere = a[0];
  for (let i = 1; i < a.length; i++) {
    endingHere = Math.max(a[i], endingHere + a[i]);
    best = Math.max(best, endingHere);
  }
  return best;                                        // all-negative input returns the largest element
}
```

```java
static int maxSubarrayKadane(int[] a) {
    int best = a[0], endingHere = a[0];
    for (int i = 1; i < a.length; i++) {
        endingHere = Math.max(a[i], endingHere + a[i]);
        best = Math.max(best, endingHere);
    }
    return best;
}
```

Initialising `best` and `endingHere` to `a[0]` rather than `0` is the whole of the all-negative
handling: with `0` the function returns 0 for an array of negatives, which is only correct if the
empty subarray is allowed. Ask which convention the problem wants; it is the most common follow-up.

The divide-and-conquer version still earns its place, because it generalises where Kadane does not:
when the query is *"maximum subarray sum within a range `[l, r]`"*, asked many times, the
divide-and-conquer decomposition is exactly a segment tree node storing four values (total, best
prefix, best suffix, best subarray), and the `crossing` computation above is that node's merge
function. That is the honest reason to know it.

## Majority element

Find the element appearing more than ⌊n/2⌋ times, if any. The divide-and-conquer version:

1. find the majority of the left half;
2. find the majority of the right half;
3. if they agree, that is the answer; if they disagree, count both over the whole range and pick the
   one that actually exceeds half.

The correctness claim is the load-bearing one and it is worth stating: **if an element is the
majority of the whole, it must be the majority of at least one half.** Suppose not — then it appears
at most half the time in each half, so at most half the time overall, contradiction. That is a clean
proof by contradiction you can produce at a whiteboard.

```ts
export function majority(a: number[]): number | null {
  return go(a, 0, a.length - 1);
}
function go(a: number[], lo: number, hi: number): number | null {
  if (lo === hi) return a[lo];
  const mid = lo + Math.floor((hi - lo) / 2);
  const l = go(a, lo, mid), r = go(a, mid + 1, hi);
  if (l !== null && l === r) return l;                       // agreement: done
  const lc = l === null ? 0 : count(a, lo, hi, l);           // disagreement: count both, Θ(n)
  const rc = r === null ? 0 : count(a, lo, hi, r);
  const half = (hi - lo + 1) / 2;
  if (lc > half) return l;
  if (rc > half) return r;
  return null;
}
function count(a: number[], lo: number, hi: number, x: number): number {
  let c = 0;
  for (let i = lo; i <= hi; i++) if (a[i] === x) c++;
  return c;
}
```

T(n) = 2T(n/2) + Θ(n) = **Θ(n log n)**. And again there is a linear answer — Boyer–Moore majority
voting, Θ(n) time and Θ(1) space:

```ts
// Boyer-Moore: pair off different elements; a true majority survives the pairing
export function majorityVote(a: number[]): number | null {
  let candidate = a[0], count = 0;
  for (const x of a) {
    if (count === 0) candidate = x;
    count += (x === candidate) ? 1 : -1;
  }
  // the candidate is only guaranteed correct if a majority EXISTS — verify it
  let c = 0;
  for (const x of a) if (x === candidate) c++;
  return c > a.length / 2 ? candidate : null;
}
```

The invariant to say out loud: the counter tracks the excess of the current candidate over
everything else seen so far; each cancellation discards one occurrence of the candidate together
with one of something else, and a true majority cannot be exhausted by pairing, because it has more
occurrences than everything else combined. **The second pass is not optional** — without a majority
in the input the algorithm still returns some element, and the verification is what makes the
`null` case correct.

## Closest pair of points

Given n points in the plane, find the two closest. Brute force is Θ(n²); divide and conquer gives
Θ(n log n), and it is the classic demonstration that a clever *combine* is where the difficulty
lives.

1. Sort by x once, up front (Θ(n log n), outside the recursion).
2. Split at the median x into left and right halves; recurse on each, getting `dL` and `dR`.
3. Let `d = min(dL, dR)`. Any closer pair must straddle the dividing line, and both of its points
   must lie within distance `d` of that line — so only points in a vertical **strip** of width `2d`
   can matter.
4. Sort the strip's points by y (or keep a y-sorted list threaded through the recursion) and, for
   each point, compare it only against the next few points in y order. The textbook packing argument
   bounds that "few" by a constant: within a `d × 2d` rectangle no two points can be closer than `d`
   to each other (they are all from the same half, where `d` is already the minimum), so only a
   constant number of points fit, and a constant number of comparisons per point suffices.

That constant is what makes step 4 linear, which makes the combine Θ(n) and the recurrence
T(n) = 2T(n/2) + Θ(n) = **Θ(n log n)**. If the strip is re-sorted by y at every level the combine
becomes Θ(n log n) and the total degrades to Θ(n log² n) — still passing most constraints, and a
legitimate thing to say if you cannot recall the merge-by-y refinement.

The parts to be able to state, since nobody expects the full implementation in 45 minutes: the
strip idea, that a closer pair must straddle the line and lie within `d` of it, that only a constant
number of neighbours in y order need checking, and the resulting recurrence. Naming the algorithm
and reproducing that argument is a full-credit answer.

## Gotchas

**★ Symptom: maximum subarray returns 0 for an array of all negative numbers.** Cause: the
accumulators initialised to 0, which silently allows the empty subarray. Fix: initialise to `a[0]`
(Kadane) or `-Infinity` / `Integer.MIN_VALUE` (the crossing scan), and ask whether the empty
subarray is a legal answer — the two conventions give different results and both appear in problem
statements.

**★ Symptom: the crossing sum computed by taking the best prefix of the right half and the best
suffix of the left half *independently of the midpoint*.** Cause: forgetting that a crossing
subarray must be contiguous through the boundary. Fix: the left scan starts at `mid` and moves
outward, the right scan starts at `mid + 1` and moves outward, and both are forced to be non-empty;
that is what makes their sum a real contiguous subarray.

**★ Symptom: a majority-element solution that returns an element when there is no majority.**
Cause: the Boyer–Moore verification pass omitted. Fix: the voting pass finds a *candidate*; only a
second counting pass proves it is a majority. Without a guarantee in the problem statement that a
majority exists, the second pass is required.

**★ Symptom: a majority divide-and-conquer that returns the wrong element when the halves
disagree.** Cause: picking one of the two by count *within its own half* rather than over the whole
range. Fix: on disagreement, count both candidates across the entire current range and require a
strict majority of that range.

**★ Symptom: a closest-pair implementation that is Θ(n² ) because the strip check compares every
pair in the strip.** Cause: the y-ordering skipped, so the "constant number of neighbours" bound
does not apply — the strip can contain every point. Fix: sort the strip by y and compare each point
only against the following constant number of points; the packing argument is what licenses
stopping.

**★ Symptom: closest pair implemented with a full sort at every level and it is Θ(n log² n).**
Cause: re-sorting inside the recursion. Fix: sort by x once outside, and maintain the y-order by
merging the two halves' y-sorted lists during the combine — the same merge as merge sort. Worth
saying even if you do not implement it.

**Symptom: a segment-tree merge that returns the wrong "maximum subarray in range".** Cause: only
the best subarray stored per node. Fix: each node needs four values — total sum, best prefix, best
suffix, best subarray — because the crossing case at the parent needs the children's suffix and
prefix; that is exactly the `crossing` function above, promoted to a merge.

**Symptom: the divide-and-conquer maximum subarray presented as the answer and the interviewer asks
"can you do better?"** Cause: stopping at the first correct algorithm. Fix: Kadane, Θ(n) and Θ(1)
space — and knowing when the Θ(n log n) version is still the right one, namely when the query is
over arbitrary ranges and you are building a segment tree.

## Interview questions

**★ Solve maximum subarray by divide and conquer, then improve it.**
Split at the midpoint. The best subarray is entirely in the left half, entirely in the right, or it
crosses the boundary — disjoint and exhaustive, because a contiguous range either contains the
boundary or lies on one side of it. The first two are recursive calls; the crossing case is linear,
because a crossing subarray must include both `a[mid]` and `a[mid + 1]`, so you scan outward from
the middle in each direction keeping the best running sum and add the two. That is
T(n) = 2T(n/2) + Θ(n) = Θ(n log n). Then the improvement: Kadane's algorithm, Θ(n) time and Θ(1)
space — the best subarray ending at `i` is either `a[i]` alone or `a[i]` appended to the best ending
at `i − 1`, so one pass suffices. The divide-and-conquer version is still worth knowing because its
combine step is exactly a segment-tree node merge for range maximum-subarray queries.

**★ Why must a majority element be the majority of one of the halves?**
By contradiction. Suppose an element is the majority of the whole array but is not the majority of
either half — then in each half it appears at most half the time, so across both halves it appears
at most half the time in total, which contradicts it being a majority of the whole. Therefore
checking both halves' majorities is sufficient, and the algorithm only has to resolve the case where
the two halves disagree, which it does by counting both candidates over the full range in linear
time. That gives T(n) = 2T(n/2) + Θ(n) = Θ(n log n).

**★ What is the invariant in Boyer–Moore voting, and why is the second pass necessary?**
The counter tracks the excess of the current candidate's occurrences over all other elements seen so
far; when it hits zero, everything seen has been paired off — each occurrence of the candidate
cancelled against one occurrence of something else — and the algorithm starts fresh from the next
element. An element that appears more than n/2 times cannot be fully cancelled, because there are
not enough other elements to pair with all of its occurrences, so it must be the candidate at the
end. The second pass is necessary because the argument only runs in that direction: if no majority
exists the algorithm still ends with *some* candidate, and only counting it proves whether it
qualifies.

**★ Explain the closest-pair algorithm's combine step.**
After recursing on the two halves you have `d`, the smaller of the two halves' closest distances.
Any pair closer than `d` must have one point in each half, and both points must be within `d` of the
dividing line — otherwise their x-distance alone already exceeds `d`. So the combine only has to
examine the strip of width `2d` around the line. Within the strip, order the points by y; for a
given point, any partner closer than `d` must lie within `d` in y as well, so the search is confined
to a `d × 2d` rectangle, and because every point in that rectangle comes from one of the two halves
where `d` is already the minimum separation, only a constant number of points can fit in it. That is
why a constant number of comparisons per point suffices and the combine is Θ(n), giving
T(n) = 2T(n/2) + Θ(n) = Θ(n log n) with the x-sort done once up front.

**When is the Θ(n log n) divide-and-conquer solution the right answer even though a linear one
exists?**
When the problem is a *range query* rather than a single answer. Kadane computes the maximum
subarray of the whole array in one pass and gives you nothing reusable; the divide-and-conquer
decomposition gives you, at every node, the four values that let you answer "maximum subarray within
`[l, r]`" in Θ(log n) after Θ(n) preprocessing — which is a segment tree. The same is true of
Boyer–Moore versus the divide-and-conquer majority: the linear one answers the whole array, the
recursive one composes. If the interviewer follows the first question with "now answer that a
million times for different ranges", the recursive decomposition is the one that survives.

**What do these three problems have in common that makes them divide and conquer?**
The answer for a range can be assembled from the answers for its halves plus a bounded amount of
work about the boundary — and in each case the boundary work is the algorithm. Maximum subarray:
the crossing subarray, found by two outward scans. Majority: the disagreement case, resolved by two
counts. Closest pair: the strip, resolved by a constant number of y-neighbour comparisons. If you
can state that the case analysis is disjoint and exhaustive and bound the boundary work, you have
both the correctness proof and the recurrence, which is the whole of what the interviewer is
checking.

{/* FOOTER */}
