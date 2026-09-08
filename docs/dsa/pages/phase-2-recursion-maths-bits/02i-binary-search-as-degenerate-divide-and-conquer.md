---
title: "Binary search is the degenerate member of the family — one subproblem, no combine — and reading it that way explains three things at once: why the bound is log n without memorising it, why it is the one recursion you should always write as a loop, and why 'binary search on the answer' is the same algorithm with a predicate in place of a comparison"
sidebar_label: "02i · Binary search as degenerate D&C"
sidebar_position: 2.8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. Binary search and the monotone-predicate ("binary search on the answer")
> formulation are **standard technique** with no single primary source; the recurrence
> T(n) = T(n/2) + Θ(1) is solved against
> [phase 1 · 08](../phase-1-complexity/08-recurrences-and-the-master-theorem.md). The Java midpoint
> overflow is real and is stated in one sentence here only — it belongs to [05 · Integer limits and
> overflow](05-integer-limits-and-overflow.md) and is not developed. Ninth and last file of topic 02 —
> [02](02-divide-and-conquer.md) is the template. **No sandbox run.**

**Set `a = 1` and `f(n) = Θ(1)` in T(n) = a·T(n/b) + f(n) and you get binary search: one recursive
call, no combine, constant work at each level, log n levels, Θ(log n).** That framing is worth more
than it looks. It tells you the bound without recalling it; it tells you the recursion is a tail call
and therefore should be a loop with Θ(1) space; and it makes the generalisation obvious — nothing in
the argument required a *sorted array*, only a way to discard half the search space, which is why the
same three lines solve "smallest x such that P(x) is true" over a range of candidate answers that no
array ever materialises.

## The recurrence, and what it buys

| | binary search | quickselect | merge sort |
|---|---|---|---|
| a (recursive calls) | 1 | 1 | 2 |
| b (shrink factor) | 2 | 2 expected | 2 |
| f(n) (divide + combine) | Θ(1) | Θ(n) | Θ(n) |
| recurrence | T(n) = T(n/2) + Θ(1) | T(n) = T(n/2) + Θ(n) | T(n) = 2T(n/2) + Θ(n) |
| result | Θ(log n) | Θ(n) expected | Θ(n log n) |

Reading down the `f(n)` row is the lesson: **with one recursive call, the total is dominated by the
top level's work.** Constant work at the top gives log n levels of constant work; linear work at the
top gives a geometric series summing to 2n. The number of recursive calls sets the shape and the
combine sets the scale.

And because there is no combine — nothing happens after the recursive call returns — binary search
is a **tail recursion**, which converts to a loop by the mechanical substitution of
[01d](01d-tail-position-and-mutual-recursion.md): parameters become mutable locals, the call becomes
an assignment. Θ(log n) space becomes Θ(1) and nothing else changes.

## The two forms worth memorising

The bug rate in hand-written binary search is high enough that having *one* form you never deviate
from is worth more than understanding four. These two cover essentially everything.

**Form 1 — find an exact value.** Inclusive bounds, terminate when they cross.

```ts
export function binarySearch(a: number[], target: number): number {
  let lo = 0, hi = a.length - 1;                 // inclusive on both ends
  while (lo <= hi) {                             // <=, because lo === hi is still a live candidate
    const mid = lo + Math.floor((hi - lo) / 2);  // never (lo + hi) / 2 — see below
    if (a[mid] === target) return mid;
    if (a[mid] < target) lo = mid + 1;           // exclude mid: this is what guarantees progress
    else hi = mid - 1;
  }
  return -1;
}
```

**Form 2 — find the boundary.** The one that actually answers most questions: *the first index at
which a monotone predicate becomes true.* Half-open bounds, terminate when they meet.

```ts
// P must be monotone: false, false, …, false, true, true, …, true
// returns the first index where P holds, or hi if it never does
export function firstTrue(lo: number, hi: number, P: (x: number) => boolean): number {
  while (lo < hi) {                              // <, and hi is EXCLUSIVE
    const mid = lo + Math.floor((hi - lo) / 2);  // rounds down, so mid < hi always
    if (P(mid)) hi = mid;                        // mid might be the answer: keep it
    else lo = mid + 1;                           // mid is definitely not: discard it
  }
  return lo;                                     // lo === hi: the boundary
}
```

Form 2 is the one to internalise, because "lower bound", "upper bound", "insertion point", "first
element ≥ x", "last element ≤ x" and every "binary search on the answer" problem are all the same
call with a different `P`. It cannot loop forever, because `mid` is strictly less than `hi` (the
division rounds down), so the `P(mid)` branch strictly decreases `hi` and the other branch strictly
increases `lo` — the [01b](01b-the-three-ways-the-contract-breaks.md) progress clause, satisfied by
construction.

```java
// Java: same two forms. Note the midpoint expression, and note that Arrays.binarySearch exists
// and returns (-(insertion point) - 1) when absent, which is the API's way of giving you form 2.
static int firstTrue(int lo, int hi, java.util.function.IntPredicate p) {
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (p.test(mid)) hi = mid; else lo = mid + 1;
    }
    return lo;
}
```

🔴 **`mid = lo + (hi - lo) / 2`, never `(lo + hi) / 2`.** In Java the addition can overflow `int`
and produce a negative midpoint; `+` wraps silently rather than throwing. That is an integer-limits
story, developed on [05 · Integer limits and overflow](05-integer-limits-and-overflow.md); here it is a habit
applied unconditionally, including in TypeScript where the arithmetic is safe but the muscle memory
is worth having.

## Binary search on the answer

Nothing in form 2 requires an array. It requires a **monotone predicate over a range**: some
threshold below which `P` is false and above which it is true. When a problem asks for a minimum
feasible value — the smallest capacity, the smallest speed, the smallest number of days — and
feasibility is monotone (if capacity `c` works, so does `c + 1`), the answer is form 2 with `P` =
"is `c` feasible", and the search space is the range of candidate answers rather than any array.

```ts
// storefront: split the day's orders into at most `k` picker batches, minimising the largest batch.
// P(cap) = "can these orders be packed into at most k batches, none exceeding cap?" — monotone in cap.
export function minLargestBatch(weights: number[], k: number): number {
  const lo = Math.max(...weights);                    // a batch must hold the biggest single order
  const hi = weights.reduce((s, w) => s + w, 0);      // one batch holding everything always works
  const feasible = (cap: number): boolean => {
    let batches = 1, current = 0;
    for (const w of weights) {
      if (current + w > cap) { batches++; current = 0; }   // greedy: start a new batch
      current += w;
    }
    return batches <= k;
  };
  return firstTrue(lo, hi, feasible);                 // Θ(n log(sum)) — n per check, log(sum) checks
}
```

The complexity to state is **Θ(n · log(range))**: one linear feasibility check per binary-search
step, and log of the *value* range rather than of the array length. That log is over the numeric
range, so a range of 10⁹ costs about thirty checks — the point being that the number of checks is
small enough that a linear check per step is fine.

Three obligations before this is a correct answer, and interviewers ask about all three:

1. **Monotonicity, argued.** If `cap` works then `cap + 1` works, because any packing valid under
   the smaller cap is valid under the larger. Without that argument the binary search is unjustified,
   and the failure mode is a silently wrong answer rather than an error.
2. **The bounds must bracket the answer.** `lo` must be a value that might be feasible or the
   smallest conceivable candidate; `hi` must be known-feasible. Here `lo` is the largest single item
   (nothing smaller can ever work) and `hi` is the total (one batch always works).
3. **The check must be exactly the predicate you claimed.** The greedy packing above is correct
   because starting a new batch as late as possible never uses more batches — that is its own small
   exchange argument, and it is the part a careless answer skips.

## Rotated, unsorted, and other "binary search does not apply" cases

The template survives more than it looks, provided you can still discard half:

| Problem | What replaces "sorted" |
|---|---|
| search in a rotated sorted array | at least one of the two halves around `mid` is sorted; decide which, then test whether the target lies inside it |
| find a peak in an unsorted array | compare `a[mid]` with `a[mid + 1]`; a peak must exist in the ascending direction |
| find the minimum in a rotated array | compare `a[mid]` with `a[hi]` to decide which side holds the rotation point |
| search a sorted matrix | start at a corner where one direction increases and the other decreases — a staircase walk, Θ(rows + cols), not a binary search |
| find the square root, or any monotone numeric inverse | form 2 over the value range, with `P(x) = x * x >= n` |

The unifying requirement is not order — it is a rule that lets you eliminate half the candidates in
constant time. Where no such rule exists (an unsorted array searched for an exact value), binary
search does not apply and the answer is a hash set or a linear scan.

## Gotchas

**★ Symptom: an infinite loop in a hand-written binary search.** Cause: a branch that does not
exclude `mid` — `lo = mid` instead of `lo = mid + 1` — so when `hi === lo + 1` the range stops
shrinking. Fix: in form 1, both branches exclude `mid`; in form 2, only the `false` branch may
advance `lo` past `mid`, and the `true` branch sets `hi = mid` (which still shrinks, because `mid <
hi` when the division rounds down). It is the progress clause of
[01b](01b-the-three-ways-the-contract-breaks.md), and the two-element case is the one to hand-check.

**★ Symptom: in Java, an `ArrayIndexOutOfBoundsException` with a negative index on a very large
array.** Cause: `(lo + hi) / 2` overflowing `int`. Fix: `lo + (hi - lo) / 2`, always. Developed on
[05 · Integer limits and overflow](05-integer-limits-and-overflow.md).

**★ Symptom: the search returns *an* occurrence of a duplicated value rather than the first or the
last.** Cause: form 1, which stops at whichever equal element it happens to hit. Fix: form 2 with
`P(i) = a[i] >= target` for the first occurrence, and `P(i) = a[i] > target` minus one for the last.
Do not try to patch form 1 with a linear scan afterwards — that is Θ(n) on a run of duplicates and
loses the whole point.

**★ Symptom: off-by-one at the boundaries — the answer is one too high or too low, consistently.**
Cause: mixing an inclusive `hi` with a `while (lo < hi)` condition, or the reverse. Fix: pick one
form and never mix them: form 1 is inclusive `hi` with `<=`, form 2 is exclusive `hi` with `<`.
Writing which convention you are using as a comment on the first line costs nothing and prevents
the whole class.

**★ Symptom: "binary search on the answer" gives a plausible but wrong value.** Cause: the predicate
is not monotone over the search range. Fix: state and check monotonicity explicitly before writing
the loop — if `P(x)` can be true, then false, then true again, no binary search is valid on it and
the structure has to change.

**★ Symptom: the answer is outside the searched range.** Cause: bounds that do not bracket the
answer — `lo` set to 0 when no value below the largest element can work, or `hi` set to a value that
is not known to be feasible. Fix: justify both bounds in one sentence each; `hi` must be a value you
can prove works, `lo` a value you can prove is not too large.

**★ Symptom: a binary search over floating-point values that never terminates.** Cause: `lo` and
`hi` converge to adjacent representable doubles and `mid` equals one of them forever. Fix: iterate a
fixed number of times (enough for the precision the problem asks for) rather than until the bounds
meet, or search over integers by scaling.

**Symptom: `Arrays.binarySearch` used on an unsorted array and returning nonsense.** Cause: the
precondition. Fix: the method's contract requires the array to be sorted; on an unsorted array the
result is unspecified rather than an error. Sort first, or use a `HashSet`.

**Symptom: a recursive binary search on a huge range and a stack that is deeper than expected.**
Cause: recursion kept for a tail call. Fix: the loop — there is no combine step, so no frame has
anything to hold. Θ(log n) is a small depth and this is not an overflow risk, but the recursion is
pure overhead.

## Interview questions

**★ Is binary search divide and conquer, and what does that framing buy you?**
Yes, in the degenerate case: one subproblem instead of two, and no combine at all, so the recurrence
is T(n) = T(n/2) + Θ(1). Every level does constant work and there are log₂ n levels, so it is
Θ(log n) — derived rather than memorised. The framing buys three things. It puts binary search next
to quickselect, which is the same shape with a linear divide (T(n) = T(n/2) + Θ(n) = Θ(n)), so you
can see that the number of recursive calls sets the shape and the per-level work sets the scale. It
tells you the recursion is a tail call, so the loop form is available and costs Θ(1) space instead
of Θ(log n). And it shows that nothing in the argument used sortedness — only the ability to discard
half the candidates — which is exactly the generalisation to binary search on the answer.

**★ Write a binary search that returns the first index where a predicate becomes true.**
Half-open bounds and a loop that ends when they meet: while `lo < hi`, compute `mid = lo + (hi -
lo) / 2`, and if `P(mid)` set `hi = mid` — because `mid` might itself be the answer — otherwise set
`lo = mid + 1`, because `mid` definitely is not. When the loop ends, `lo === hi` is the boundary.
Termination is guaranteed because the division rounds down, so `mid` is strictly less than `hi`,
making `hi = mid` a strict decrease, and `lo = mid + 1` a strict increase. That single function is
lower bound, upper bound, insertion point, first-element-≥-x, and every binary-search-on-the-answer
problem, with only the predicate changing.

**★ What is "binary search on the answer" and when is it valid?**
It is form 2 applied to the range of possible *answers* rather than to an array. It is valid exactly
when feasibility is monotone in the quantity you are searching: if a capacity of `c` suffices, so
does any larger capacity. Given that, the smallest feasible value is the boundary of a monotone
predicate, so binary search finds it in log(range) evaluations of the feasibility check. The
complexity is the check's cost times log of the numeric range — typically Θ(n log(sum)) — and the
three things to say before writing it are: the monotonicity argument, why the initial bounds bracket
the answer, and why the feasibility check is correct, which is usually a small greedy exchange
argument in its own right.

**★ How do you find the first and last occurrence of a value in a sorted array with duplicates?**
Two calls to form 2. The first occurrence is the boundary of `P(i) = a[i] >= target`; the last is
one before the boundary of `P(i) = a[i] > target`. Both are Θ(log n), and the count of occurrences
is the difference between the two boundaries. The wrong answer is a plain binary search followed by
a linear walk outward, which is Θ(n) when the array is a single repeated value — precisely the input
the interviewer will name.

**★ Why does binary search work on a rotated sorted array?**
Because you can still eliminate half in constant time, which is the only thing the recurrence
needs. At any midpoint, at least one of the two halves `[lo, mid]` and `[mid, hi]` is fully sorted —
comparing `a[lo]` with `a[mid]` tells you which — and for a sorted half you can decide in constant
time whether the target lies inside it. If it does, recurse there; if not, recurse into the other
half. The bound is unchanged at Θ(log n). The condition that breaks it is duplicates: when `a[lo]`,
`a[mid]` and `a[hi]` are all equal you cannot tell which half is sorted, and the worst case degrades
to Θ(n), which is worth volunteering.

**Why write binary search iteratively when the recursion is only log n deep?**
Because there is nothing for the frame to hold. The recursive call is in tail position — no combine
step — so the loop conversion is mechanical and exact: the parameters become mutable locals and the
call becomes an assignment. The space goes from Θ(log n) to Θ(1) and the code gets shorter. It is
not a stack-overflow concern at log n depth; it is that the recursion is pure overhead for no
readability gain, which is the opposite of the trade-off in merge sort, where the recursion *is* the
recurrence and reads better than the bottom-up loop.

**What is the search space when a problem gives no array at all?**
Whatever range the answer lives in, and identifying it is half the work. For "minimum capacity",
`lo` is the largest single item and `hi` is the sum of all items. For "minimum speed to finish in
h hours", `lo` is 1 and `hi` is the largest pile. For an integer square root, `lo` is 0 and `hi` is
the input. In each case `hi` is chosen because it is provably feasible and `lo` because nothing
below it can be, and stating those two reasons is what makes the answer complete rather than a
guess that happened to work.

---

← Prev: [02h · Solve halves, combine — without sorting](02h-solve-halves-combine-when-it-is-not-sorting.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [03 · gcd and Euclid's algorithm](03-mathematical-foundations.md)
