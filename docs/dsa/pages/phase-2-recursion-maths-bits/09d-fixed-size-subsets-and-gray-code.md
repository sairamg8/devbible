---
title: "Two enumerations the ascending counter cannot give you — every k-element subset in increasing order without visiting the other 2^n, and every subset in an order where consecutive masks differ by exactly one element"
sidebar_label: "09d · Fixed-size subsets and Gray code"
sidebar_position: 9.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The Gosper successor derivation, the Gray-code bijection and its
> one-bit-change property, and the combinatorial-number-system ranking are **mathematics derived on
> this page**, not cited. The 32-bit bound on every loop is
> [09b](09b-precedence-and-the-32-bit-loop-bound.md)'s, quoted there from MDN. ⚠️ The claim that
> JavaScript's `/` is exact for these operands rests on the operands being a power of two and its
> exact multiple; it is stated as arithmetic, not quoted. **No sandbox run**: no value below is
> program output, and the small hand-computed Gray values are arithmetic you can redo on paper.
> Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**Ascending numeric order is the right default and answers most questions
([09c](09c-generating-masks-in-a-useful-order.md)), but two enumerations it cannot express are worth
having in your hands.** The first visits exactly the `C(n, k)` masks with `k` bits, in increasing
order, without touching the other `2^n − C(n, k)`; for small `k` that is the difference between a
solution and a timeout. The second visits every mask exactly once with a single bit changing between
consecutive masks, which turns a per-subset re-evaluation into a per-subset *update*. Both are short
enough to derive in an interview, and both have a failure mode that a pasted version hides.

## Fixed-size subsets in numeric order, without bucketing

If you want the `k`-element masks in increasing order and nothing else, there is a closed-form
successor — the "next integer with the same popcount", usually called Gosper's hack. It is worth
deriving rather than pasting, because the derivation is short and the pasted version is
unmaintainable:

```ts
// smallest integer greater than x with the same number of set bits; x > 0
export function nextSamePopcount(x: number): number {
  const c = x & -x;                       // the lowest set bit
  const r = x + c;                        // carry the lowest run of ones up one position
  return (((r ^ x) >>> 2) / c) | r;       // reinsert the ones that the carry consumed
}
```

Walk it. Let the lowest run of ones in `x` have length `L`, starting at the position of `c`. Adding
`c` carries through that whole run: the `L` ones become zeros and a single one appears one position
above them — that is `r`, and it is the smallest value above `x` with a one in that higher position,
but it has `L − 1` fewer set bits than `x`. To restore the popcount *and* stay as small as possible,
those `L − 1` ones must go in the lowest positions available.

`r ^ x` is exactly the set of bits that changed: the `L` cleared ones plus the one new bit, so
`L + 1` ones in a contiguous block starting at `c`'s position. Dividing by `c` slides that block
down to position 0, giving the value `2^(L+1) − 1`. Shifting right by two gives `2^(L-1) − 1` —
precisely `L − 1` ones at the bottom. OR that into `r` and you have the answer.

```java
static int nextSamePopcount(int x) {
    int c = x & -x, r = x + c;
    return (((r ^ x) >>> 2) / c) | r;
}
```

🔴 **Three real cautions.** The division is exact only because `c` is a power of two and the
numerator is a multiple of it — in JavaScript `/` is floating-point division, and it is safe *here*
and not in general, so do not generalise the pattern. `x` must be non-zero, or `c` is zero and the
division is by zero. And the loop that uses it needs its own stop condition, because the successor
eventually exceeds the mask width:

```ts
for (let x = (1 << k) - 1; x < (1 << n); x = nextSamePopcount(x)) {
  // every k-element subset of n items, in increasing numeric order
}
```

The initial value `(1 << k) - 1` is the smallest `k`-bit mask — the low `k` bits — which is the
correct starting point and one more reason to have the `(1 << k) - 1` versus `1 << k - 1`
distinction in your fingers ([09b](09b-precedence-and-the-32-bit-loop-bound.md)).

## Gray code order, when recomputation is the cost

Sometimes the expensive part is not enumerating the subsets but evaluating something for each one —
a sum, a feasibility check, a running score. Ascending numeric order changes many bits between
consecutive masks (`0b0111` to `0b1000` changes four), so each mask is evaluated from scratch, and
the enumeration is `Θ(2^n · n)`. **Binary-reflected Gray code visits every mask exactly once and
changes exactly one bit between consecutive masks**, so an incremental evaluation makes the whole
enumeration `Θ(2^n)`.

```ts
export const gray = (i: number): number => i ^ (i >>> 1);
```

Three properties, all derivable:

- **It is a bijection on `0 … 2^n − 1`.** The inverse is a prefix XOR: given `g`, recover `i` by
  `i = g ^ (g >>> 1) ^ (g >>> 2) ^ …`, which terminates after `log n` doubling steps
  (`g ^= g >>> 1; g ^= g >>> 2; g ^= g >>> 4; …`). A function with a two-sided inverse on a finite
  set is a bijection, so every mask is produced exactly once.
- **`gray(i)` and `gray(i+1)` differ in exactly one bit**, and that bit is at position
  `trailingZeros(i + 1)`. Check the first few by hand: `gray(0)=0`, `gray(1)=1` (bit 0 changed,
  `ctz(1)=0`); `gray(2)=3` (bit 1, `ctz(2)=1`); `gray(3)=2` (bit 0, `ctz(3)=0`); `gray(4)=6`
  (bit 2, `ctz(4)=2`). The general argument is the same carry argument as Gosper's: incrementing `i`
  flips a run of low ones and the bit above them, and XOR-ing with the shifted copy cancels all but
  the top of that run.
- **The changed bit tells you whether the element was added or removed** — look at whether it is set
  in the new mask — which is all an incremental update needs.

```ts
export function forEachSubsetGray(
  n: number,
  add: (i: number) => void,
  remove: (i: number) => void,
  visit: (mask: number) => void,
): void {
  let mask = 0;
  visit(mask);
  for (let i = 1; i < (1 << n); i++) {
    const j = 31 - Math.clz32(i & -i);          // trailingZeros(i) — 04d
    if ((mask & (1 << j)) === 0) { mask |= 1 << j; add(j); }
    else                        { mask &= ~(1 << j); remove(j); }
    visit(mask);
  }
}
```

⚠️ **Gray code is the right answer far less often than it is proposed.** It only pays when the
per-mask evaluation is genuinely incremental and genuinely dominates — a running sum qualifies, a
feasibility check that must re-scan the whole subset does not. And it destroys the submask ordering
property, so **you cannot run a DP in Gray code order**: `gray(i)`'s submasks are scattered
throughout the sequence, before and after it. Use it for enumeration with an accumulator, never for
a table whose entries reference each other.

## Ranking a k-subset: the combinatorial number system

Once you are enumerating one popcount layer, the natural companion is an index *into* that layer —
a bijection between the `C(n, k)` masks with `k` bits and the integers `0 … C(n, k) − 1`. That is
what makes [09c](09c-generating-masks-in-a-useful-order.md)'s layered-memory trick usable: a layer
array indexed by rank is `C(n, k)` entries where a mask-indexed array is `2^n`.

The construction is the combinatorial number system. Write the subset's elements in decreasing order
`c_k > c_{k-1} > … > c_1`; its rank in that ordering is

```
rank = C(c_k, k) + C(c_{k-1}, k-1) + … + C(c_1, 1)
```

This is a bijection because every integer below `C(n, k)` has exactly one such representation —
the greedy choice of the largest `c_k` with `C(c_k, k) <= rank` is forced, and the argument repeats
on the remainder with `k − 1`.

```ts
// mask must have exactly k bits set; C is a precomputed Pascal table (08b)
export function rankSubset(mask: number, k: number, C: number[][]): number {
  let rank = 0, remaining = k;
  for (let i = 31 - Math.clz32(mask); i >= 0 && remaining > 0; i--) {
    if ((mask & (1 << i)) !== 0) { rank += C[i][remaining]; remaining--; }
  }
  return rank;
}
```

⚠️ `C[i][remaining]` is zero whenever `i < remaining`, so the Pascal table must be built with that
convention rather than left undefined ([08b](08b-pascals-rule-and-the-dp-table.md)). The unranking
direction — rank back to mask — is the same loop run greedily downwards, and it is what lets a DP
store its layer compactly and still address it.

**This is a genuine trade and not a free win.** You have swapped an array subscript for a `Θ(n)`
rank computation on every access. It pays only when the memory saving is what stood between you and
running at all, which for `k` near `n/2` it is not — `C(n, n/2)` is a large fraction of `2^n`
([08](08-combinatorics-for-counting-problems.md)).

## Numeric mask order is not lexicographic subset order

A detail that produces "wrong answer" on output-formatted problems: ascending mask order does **not**
list subsets in lexicographic order of their element lists. Mask `0b100` (the subset `[2]`) is `4`
and mask `0b011` (`[0, 1]`) is `3`, so the counter emits `[0, 1]` before `[2]` — correct
lexicographically here — but mask `0b101` (`[0, 2]`) is `5` and comes *after* `0b011`, while
lexicographic order puts `[0, 1]` before `[0, 2]` before `[1]` before `[1, 2]` before `[2]`. The two
orders diverge as soon as `n` is 3.

The mask counter's order is by the *largest differing element*, which is a colexicographic order —
perfectly well-defined and not what a problem statement means by "sorted". If the output must be
lexicographic, either sort the decoded subsets, or generate them by backtracking, which produces
lexicographic order naturally when it iterates candidates in increasing order
([06d](06d-subsets-and-combinations.md)). 🔴 **Do not try to fix this with a different mask
enumeration** — no counter order gives lexicographic subset order, because the subset lengths differ
and lexicographic comparison of unequal-length lists is not a numeric comparison of anything.

## Gotchas

**★ Symptom: the Gosper loop runs forever, or produces zero.** Cause: it was seeded with `x = 0`,
so `c = x & -x` is `0` and the division is by zero — in JavaScript that is `Infinity` rather than an
exception, and `Infinity | r` coerces to `0`, giving a loop that oscillates instead of throwing. Fix:
seed with `(1 << k) - 1` and assert `k >= 1`; handle `k === 0` as the single mask `0`.

**★ Symptom: a Gray-code enumeration gives wrong DP answers although the masks are all distinct.**
Cause: Gray code is a valid enumeration but not a topological order — a mask's submasks appear both
before and after it. Fix: Gray code is for accumulating over subsets, not for a table whose cells
read each other. If you need a DP, use ascending or descending order.

**Symptom: iterating `k`-subsets by filtering an ascending loop is slower than expected for tiny
`k`.** Cause: it still visits all `2^n` masks to find `C(n, k)` of them, and for `k = 2` that ratio
is enormous. Fix: use the Gosper successor loop, which visits only the `C(n, k)` masks that qualify.

**★ Symptom: subsets are printed in the wrong order and the judge rejects the output.** Cause:
ascending mask order is colexicographic — ordered by the largest element on which two subsets differ
— which is not the lexicographic order a statement means by "in sorted order". Fix: sort the decoded
subsets, or generate them with backtracking, which is lexicographic by construction. No reordering
of the mask counter produces lexicographic order.

**Symptom: `rankSubset` returns a rank outside `0 … C(n, k) − 1`.** Cause: the mask does not have
exactly `k` bits, or the Pascal table returns something other than zero for `C(i, r)` with `i < r`.
Fix: assert the popcount at entry and build the binomial table with the `i < r` cells set to zero
([08b](08b-pascals-rule-and-the-dp-table.md)).

**Symptom: the Gosper loop skips the very first combination.** Cause: it was written as a
`while` that advances before visiting. Fix: the `for` form above visits `(1 << k) - 1` first and
advances afterwards; if you write a `while`, visit at the top of the body.

**Symptom: the Gray-code enumeration's incremental accumulator drifts away from the true value.**
Cause: `add` and `remove` are not exact inverses — floating-point addition and subtraction are not,
and neither is a `Set` update that was already holding the element. Fix: use integer accumulators
where you can; where you cannot, recompute from scratch periodically or abandon the incremental form,
because the whole benefit was the assumption that undoing is exact.

## Interview questions

**★ How would you enumerate exactly the k-element subsets?**
Two options with different profiles. Filtering an ascending loop on `Integer.bitCount(m) == k` is
one line and visits all `2^n` masks. The Gosper successor — `c = x & -x; r = x + c;
(((r ^ x) >>> 2) / c) | r`, seeded at `(1 << k) - 1` — visits exactly the `C(n, k)` masks in
increasing order, which for small `k` is a vastly smaller number. Derive it rather than recite it:
the addition carries the lowest run of ones up one position, `r ^ x` isolates the bits that changed,
dividing by `c` aligns them to the bottom, and shifting right by two leaves exactly the ones the
carry consumed, to be reinserted at the lowest positions.

**★ What does Gray code order buy you, and what does it cost?**
It buys `Θ(2^n)` instead of `Θ(2^n · n)` when the per-subset value can be updated incrementally,
because consecutive masks differ in exactly one bit — so you add or remove one element rather than
re-evaluating the subset. `gray(i) = i ^ (i >> 1)` generates it, it is a bijection (the inverse is a
prefix XOR), and the changed bit between `gray(i)` and `gray(i+1)` is at position
`trailingZeros(i+1)`. It costs you the ordering property: submasks of a given mask are scattered
before and after it in the sequence, so no DP can run in this order. It also only pays when the
evaluation is genuinely incremental, which many are not.

**★ Why is ascending mask order not the same as sorted subset order?**
Because the counter orders subsets by their largest differing element — colexicographic order — and
"sorted" in a problem statement almost always means lexicographic, which compares the smallest
elements first and handles unequal lengths by prefix. They agree for `n` up to 2 and diverge at 3.
There is no mask enumeration that fixes this, because lexicographic comparison of lists of different
lengths is not the comparison of any single integer derived from the sets. Either sort the decoded
output or generate with backtracking, which produces lexicographic order for free when it iterates
candidates in increasing order.

**How would you store a DP that only ever visits masks with exactly k bits?**
Rank them. The combinatorial number system maps a `k`-subset to a unique integer in
`0 … C(n, k) − 1` by summing `C(c_j, j)` over its elements written in decreasing order, and it is a
bijection because the greedy choice at each step is forced. That turns a `2^n` array into a
`C(n, k)` one, which is the difference that matters when `k` is small. State the cost honestly
though: each access now runs a `Θ(n)` rank computation, and for `k` near `n/2` the saving mostly
evaporates because `C(n, n/2)` is already a substantial fraction of `2^n`.

{/* FOOTER */}
