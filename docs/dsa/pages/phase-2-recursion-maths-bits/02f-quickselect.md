---
title: "Quickselect is quicksort that recurses into one side instead of two, and that single change turns n log n into expected linear because n + n/2 + n/4 + … sums to 2n — but the expectation is over pivots, so the worst case is still quadratic and an adversary who knows your pivot rule can force it"
sidebar_label: "02f · Quickselect"
sidebar_position: 2.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. Quickselect, Lomuto and Hoare partitioning, the three-way (Dutch national
> flag) partition and the median-of-medians bound are **standard algorithms** with no single primary
> source; the expected-linear argument below is the geometric-series derivation and is shown rather
> than cited. The recurrence is solved against
> [phase 1 · 08](../phase-1-complexity/08-recurrences-and-the-master-theorem.md), and the
> best/average/worst distinction is
> [phase 1 · 09](../phase-1-complexity/09-best-average-and-worst.md). ⚠️ **No timing and no measured
> constant factor.** That `Math.random()` cannot be seeded and is not cryptographically secure is
> MDN, [`Math.random()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random),
> quoted in the phase 2 research bank. Sixth file of topic 02 —
> [02g](02g-median-of-medians-and-duplicate-heavy-input.md) is the worst case and the fixes for it.
> **No sandbox run.**

**"Find the k-th smallest element" has a Θ(n log n) answer (sort, index) and a Θ(n)-expected answer,
and the gap between them is one line: after partitioning, you know which side the answer is on, so
you recurse into one side instead of both.** That is the entire idea, and it is the cleanest possible
demonstration of what `a` does in the recurrence T(n) = a·T(n/b) + f(n). It is also a question with a
sharp follow-up — *"what's the worst case?"* — whose honest answer is Θ(n²), and a second follow-up —
*"can you make it deterministic?"* — whose answer is median-of-medians. Both of those follow-ups,
together with what to do when the array is mostly duplicates, are
[02g](02g-median-of-medians-and-duplicate-heavy-input.md); this page is the algorithm, the
partition, and the expected-linear argument.

## The idea, and the recurrence

Partition the array around a pivot so that everything smaller is on the left and everything larger
on the right; the pivot is then in its final sorted position, at some index `p`. Three cases:

- `p === k` → the pivot **is** the answer; stop.
- `k < p` → the answer is in the left part; recurse left, same k.
- `k > p` → the answer is in the right part; recurse right, same k (the index is absolute, so k does
  not need adjusting if you keep working in the original array's coordinates).

Only one recursive call happens. With a pivot that splits evenly:

**T(n) = T(n/2) + Θ(n)** → n + n/2 + n/4 + n/8 + … < 2n → **Θ(n)**.

Compare merge sort's T(n) = 2T(n/2) + Θ(n) = Θ(n log n). Same split, same linear work per level, one
fewer recursive call — and a whole complexity class. The reason is that with two calls every level
costs the full Θ(n) and there are log n of them; with one call the level costs halve geometrically
and the sum is bounded by twice the first term. **That geometric-series sentence is the answer to
"why is it linear?" and it is worth having word for word.**

With a bad pivot the split is n−1 and 0, giving **T(n) = T(n−1) + Θ(n) = Θ(n²)** — the recurrence
the master theorem does not apply to, unrolled as 1 + 2 + … + n.

## The partition

Two standard schemes. Lomuto is easier to write correctly under pressure; Hoare does fewer swaps and
is what production quicksorts are built on.

```ts
// Lomuto: pivot is the last element; everything < pivot is pushed to the front.
function partition(a: number[], lo: number, hi: number): number {
  const pivot = a[hi];
  let store = lo;                                  // a[lo..store-1] are all < pivot
  for (let i = lo; i < hi; i++) {
    if (a[i] < pivot) { [a[store], a[i]] = [a[i], a[store]]; store++; }
  }
  [a[store], a[hi]] = [a[hi], a[store]];           // pivot into its final position
  return store;
}

export function quickselect(input: number[], k: number): number {
  const a = input.slice();                         // do not mutate the caller's array
  let lo = 0, hi = a.length - 1;
  while (lo < hi) {                                // the recursion is a tail call — write it as a loop
    const r = lo + Math.floor(Math.random() * (hi - lo + 1));   // randomised pivot
    [a[r], a[hi]] = [a[hi], a[r]];                 // move it to the end for Lomuto
    const p = partition(a, lo, hi);
    if (p === k) return a[p];
    if (k < p) hi = p - 1; else lo = p + 1;
  }
  return a[k];
}
```

Note the shape: because the recursive call is in tail position — nothing happens after it — the
whole thing is a `while` loop with Θ(1) stack, by the mechanical conversion in
[01d](01d-tail-position-and-mutual-recursion.md). Quickselect written recursively is correct and
strictly worse; there is no combine step to justify a frame.

```java
static int quickselect(int[] input, int k) {
    int[] a = input.clone();
    int lo = 0, hi = a.length - 1;
    java.util.Random rnd = new java.util.Random();
    while (lo < hi) {
        int r = lo + rnd.nextInt(hi - lo + 1);
        swap(a, r, hi);
        int p = partition(a, lo, hi);
        if (p == k) return a[p];
        if (k < p) hi = p - 1; else lo = p + 1;
    }
    return a[k];
}

private static int partition(int[] a, int lo, int hi) {
    int pivot = a[hi], store = lo;
    for (int i = lo; i < hi; i++) if (a[i] < pivot) swap(a, store++, i);
    swap(a, store, hi);
    return store;
}

private static void swap(int[] a, int i, int j) { int t = a[i]; a[i] = a[j]; a[j] = t; }
```

## Why "expected" linear, and what the expectation is over

The Θ(n) bound is an **expectation over the random pivot choices**, not over the inputs. That
distinction is the whole point of randomising, and it is worth stating precisely, because it is what
[phase 1 · 09](../phase-1-complexity/09-best-average-and-worst.md) calls the difference between
average-case and randomised-worst-case analysis.

With a deterministic pivot rule — "always take the last element" — the input decides the split, so
there exist inputs (a sorted array, for the last-element rule) on which every partition is maximally
unbalanced and the algorithm is Θ(n²). Those inputs are not rare or contrived; sorted and
reverse-sorted data is the most common real input there is, which is why the naive rule fails in
production rather than in theory.

With a uniformly random pivot, **no input is bad**. The expectation is taken over your own coin
flips, so the same array run twice can take different times, and the bound holds for every input:
a pivot lands in the middle half of the range with probability 1/2, which discards at least a
quarter of the elements, so the expected number of partitions before the range shrinks by a constant
factor is a constant, and the expected total work is a geometric series in n. The adversary cannot
choose an input that defeats a coin they cannot see.

Two practical caveats, both real:

- **The randomness has to be unpredictable to whoever supplies the input.** `Math.random()` is not
  seedable and not cryptographically secure — MDN says so directly — which is fine here and matters
  for other things. The details are [10 · Randomisation](10g-the-randomised-pivot.md).
- **`Math.random()` cannot be seeded**, so a randomised algorithm is not reproducible in JavaScript
  without injecting your own generator, which is the practical answer to "how do you write a
  deterministic test for this?": pass the pivot chooser in as a parameter.

## Gotchas

**★ Symptom: quickselect written recursively, and the stack overflows on a large adversarial
input.** Cause: the recursive call is in tail position and was left as a call. Fix: write it as a
`while` loop updating `lo` and `hi`; with no combine step there is nothing for a frame to hold, and
the space drops from Θ(depth) to Θ(1).

**★ Symptom: expected Θ(n) claimed, and the interviewer produces a sorted array that takes Θ(n²).**
Cause: a deterministic pivot — first or last element. Fix: choose the pivot uniformly at random (or
median-of-three as a weaker mitigation) and state that the expectation is over the *pivot choices*,
so no input is bad; then name median-of-medians if a worst-case guarantee is required.

**★ Symptom: off-by-one between "k-th smallest" and "index k".** Cause: 1-based and 0-based mixed.
Fix: fix the convention once at the top — this page's `k` is a 0-based index, so the smallest element
is `k = 0` and the median of an odd-length array is `k = Math.floor(n / 2)` — and restate it when you
present the answer.

**★ Symptom: the input array is reordered after the call.** Cause: partitioning mutates in place.
Fix: copy first, or say the input is consumed. Reordering the caller's data while returning the
right number is a silent, hard-to-find defect.

**★ Symptom: `Math.floor(Math.random() * (hi - lo))` for the pivot index, and the last element is
never chosen.** Cause: the range is inclusive at both ends, so the count is `hi - lo + 1`. Fix:
`lo + Math.floor(Math.random() * (hi - lo + 1))`. Under-covering the range does not break
correctness but it weakens the randomisation exactly where an already-sorted input needs it.

**Symptom: a "find the k largest" solution using quickselect and then claiming the k results are
sorted.** Cause: quickselect only guarantees the k-th element is in its final position and that
everything before it is smaller — not that the prefix is ordered. Fix: sort the prefix afterwards
for Θ(n + k log k), or use a heap if sorted output is the requirement.

## Interview questions

**★ Find the k-th smallest element in an array in better than Θ(n log n).**
Quickselect, expected Θ(n). Partition around a randomly chosen pivot; the pivot ends up at its final
sorted index `p`. If `p` equals `k` the pivot is the answer; if `k` is smaller, the answer is in the
left part and you recurse there; otherwise the right part. Only one side is ever examined, so the
recurrence is T(n) = T(n/2) + Θ(n) with a good pivot, and n + n/2 + n/4 + … is bounded by 2n — that
geometric series is the reason it is linear rather than n log n. Space is Θ(1), because the
recursive call is in tail position and I would write it as a loop. The array is reordered in place,
so I would copy it first if the caller still needs the original order.

**★ What is quickselect's worst case, and what do you do about it?**
Θ(n²), when every partition is maximally unbalanced — with a last-element pivot, a sorted input does
exactly that, giving T(n) = T(n−1) + Θ(n), which unrolls to 1 + 2 + … + n. The mitigation is to
choose the pivot uniformly at random, which does not remove the worst case but makes it independent
of the input: the expectation is over my coin flips rather than over the data, so there is no input
an adversary can supply that is reliably bad. If a genuine worst-case guarantee is required, the
deterministic answer is median of medians — group into fives, take each group's median, recursively
select the median of those medians, and use it as the pivot — which guarantees discarding at least
30% of the array per partition and gives T(n) ≤ T(n/5) + T(7n/10) + Θ(n) = Θ(n) in the worst case.
In practice I would ship the randomised version.

**★ Why is quickselect linear when quicksort is n log n, given the same partition?**
Because of `a` in the recurrence. Quicksort recurses on both sides — T(n) = 2T(n/2) + Θ(n) — so
every level does Θ(n) work and there are log n levels. Quickselect knows which side contains the
answer and recurses on one — T(n) = T(n/2) + Θ(n) — so the work per level halves geometrically and
the total is bounded by twice the first level. It is the clearest illustration that the number of
recursive calls, not the split ratio or the combine cost, is what sets the exponent: n^(log_b a)
with a = 1 is n⁰, so the leaves contribute nothing and the root's linear work is the whole bill.

**★ What does "expected linear" mean, exactly, and expected over what?**
Over the algorithm's own random choices, not over a distribution of inputs. That distinction is the
reason randomising is worth doing. An average-case bound says "if inputs are drawn from this
distribution, the mean cost is X" — and real inputs are not drawn from that distribution; sorted data
is over-represented, which is precisely the bad case for a deterministic pivot. A randomised bound
says "for *every* input, the expected cost over my coin flips is X", so there is no bad input, only
bad luck, and the bad luck is independent across runs. The practical consequence is that the same
input can take different times on different runs, and that an adversary who can choose the input
cannot force the worst case unless they can also predict the randomness.

**How do you find the k largest elements, and when is a heap better?**
Quickselect for the k-th largest, then everything on its larger side is the answer set: Θ(n)
expected, and Θ(n + k log k) if the output must be sorted. A size-k min-heap scanned over the array
is Θ(n log k) and is better in three situations — the data arrives as a stream and cannot be held or
reordered, k is much smaller than n so log k is tiny, or you need a worst-case bound rather than an
expected one. Quickselect also mutates the array, which a heap does not, so if the caller's order
matters the heap avoids a copy.

**Would you ever just sort?**
Yes, and saying so is not a weakness. Sorting is Θ(n log n) against quickselect's expected Θ(n), and
for small n or a single query on data that is about to be sorted anyway, the library sort is simpler,
already debugged, and quite possibly faster in wall-clock terms because its constant factors are
tuned. The case for quickselect is a large n with a single order statistic wanted, or a repeated
selection where the Θ(n) matters. The senior answer names the trade-off rather than reaching for the
cleverer algorithm by reflex.

---

← Prev: [02e · Counting inversions](02e-counting-inversions.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [02g · Median of medians, and duplicates](02g-median-of-medians-and-duplicate-heavy-input.md)
