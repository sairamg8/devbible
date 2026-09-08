---
title: "The sum-over-subsets transform computes an aggregate over every subset of every mask in n passes over the table rather than 3^n pairs, and its in-place update is safe for a reason worth being able to state"
sidebar_label: "09h · Sum over subsets and Möbius"
sidebar_position: 9.7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The transform's correctness invariant, its `Θ(2^n · n)` cost, the
> disjointness argument for the in-place update, and the Möbius inverse are **mathematics derived on
> this page**, not cited. The `3^n` figure it is compared against is derived in
> [04f](04f-submasks-and-the-3-to-the-n-count.md). The 32-bit mask bound is
> [09b](09b-precedence-and-the-32-bit-loop-bound.md)'s, quoted there from MDN. **No sandbox run**;
> nothing below is a measurement. Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**One transform answers an entire class of "for every mask, aggregate over its subsets" questions in
`Θ(2^n · n)` where the definition reads `Θ(3^n)`, and it is five lines.** It is usually called SOS —
sum over subsets — or the zeta transform, and its inverse is the Möbius transform, which is
inclusion–exclusion in a form you can actually run. The partition DP that it rescues is
[09g](09g-submask-dp-and-partitions.md); the submask enumeration it replaces is
[04f](04f-submasks-and-the-3-to-the-n-count.md).

## Sum over subsets: 3^n down to 2^n · n, in five lines

Here is the general problem. Given `a[mask]` for every mask, compute

```
f[mask] = Σ over sub ⊆ mask of a[sub]
```

for **every** mask. The direct evaluation is `3^n`: every mask, every submask. The transform below
is `Θ(2^n · n)`:

```ts
export function sumOverSubsets(a: Float64Array, n: number): Float64Array {
  const f = a.slice();
  for (let i = 0; i < n; i++) {
    for (let mask = 0; mask < (1 << n); mask++) {
      if ((mask & (1 << i)) !== 0) f[mask] += f[mask ^ (1 << i)];
    }
  }
  return f;
}
```

```java
static long[] sumOverSubsets(long[] a, int n) {
    long[] f = a.clone();
    for (int i = 0; i < n; i++)
        for (int mask = 0; mask < (1 << n); mask++)
            if ((mask & (1 << i)) != 0) f[mask] += f[mask ^ (1 << i)];
    return f;
}
```

**Why it is correct.** Let `f_i[mask]` be the value of the array after the outer loop has finished
bit `i`. The invariant is:

```
f_i[mask] = Σ over sub ⊆ mask that agree with mask on bits i+1 … n-1  of  a[sub]
```

Initially (`i = -1`, before any pass) that says `f[mask] = a[mask]`, which is the initialisation.
The step: at bit `i`, a mask with bit `i` clear already has the right value — there is no freedom in
that position — so nothing is written to it. A mask with bit `i` set gets the sum of two disjoint
families: the submasks that keep bit `i` (already in `f_i-1[mask]`) and the submasks that drop it
(exactly `f_i-1[mask ^ (1 << i)]`). Adding them establishes the invariant for `i`. After the last
bit, "agree on bits `n` … `n-1`" is vacuous and `f[mask]` is the sum over all submasks. ∎

🔴 **The in-place update is safe, and the reason is worth having.** Inside the pass for bit `i`, the
only cells *written* are those with bit `i` set, and the only cells *read* are those with bit `i`
clear. The two sets are disjoint, so the inner loop's order does not matter — ascending, descending,
shuffled, all correct. This is the rare in-place DP where you do not have to think about direction,
and knowing *why* is what stops you from adding a defensive copy that doubles the memory.

**The outer loop order does matter in one respect: `i` must be outside and `mask` inside.** Swapping
them computes something else entirely — for each mask you would apply all `n` bits before moving on,
which reads cells that have had a different number of passes applied to them.

## The superset version, and the inverse

Supersets are the mirror image — flip the membership test and the XOR becomes an OR:

```ts
for (let i = 0; i < n; i++)
  for (let mask = 0; mask < (1 << n); mask++)
    if ((mask & (1 << i)) === 0) f[mask] += f[mask | (1 << i)];
```

And the transform is invertible: running the same loop with `-=` recovers `a` from `f`. That inverse
is the **Möbius transform** (the forward one is the **zeta transform**), and it is what turns "for
each mask, the sum over its subsets" into "for each mask, the count of things exactly equal to it" —
the inclusion–exclusion step, done in `Θ(2^n · n)` rather than by an alternating-sign sum over
`3^n` pairs ([08e](08e-inclusion-exclusion-and-derangements.md)).

```ts
// exact-value recovery: undo a subset-sum transform in place
for (let i = 0; i < n; i++)
  for (let mask = 0; mask < (1 << n); mask++)
    if ((mask & (1 << i)) !== 0) f[mask] -= f[mask ^ (1 << i)];
```

**What it is actually used for**, since the abstract statement lands badly:

- **"For each mask, the best value achievable using only elements of that mask"** — seed `a[mask]`
  with the value of that exact set (or `-Infinity`), replace `+=` with `max`, and one transform fills
  every mask. `max` works because it is associative, commutative and idempotent; **`+` does not
  tolerate the same treatment when `a` is not a per-set value but a per-element one**, which is the
  classic misuse.
- **Counting pairs `(x, y)` with `x & y === 0`** — for each `x`, the compatible partners are the
  submasks of its complement, so one subset-sum transform over the multiset of values answers every
  `x` at once.
- **Storefront**: for each combination of promotion flags, the best bundle price achievable using
  only products whose flags are within that combination — computed once for all `2^n` flag
  combinations rather than per query.

⚠️ **Idempotence matters for the `max` variant and destroys the `+` variant.** With `max`, counting
the same submask twice is harmless. With `+`, it is a wrong answer — which is exactly what happens if
you run the transform twice, or run it over an array you have already transformed. Transform once,
into a clearly named array.

## It works over any monoid, and that is where the reuse comes from

Nothing in the correctness argument used subtraction, or even numbers — only that the fold is
associative and commutative, so the "submasks that keep bit `i`" and "submasks that drop bit `i`"
families can be combined in either order. So the same five lines compute:

| Fold | Identity to initialise with | What `f[mask]` then means |
|---|---|---|
| `+` | `0` | the sum over all submasks |
| `max` | `-Infinity` | the best value achievable using only elements of `mask` |
| `min` | `+Infinity` | the cheapest |
| `\|` | `0` | the OR over all submasks |
| `&` | all ones | the AND over all submasks |
| counting | `0` | how many inputs are subsets of `mask` |

🔴 **Only `+` has an inverse.** `max` and `|` are idempotent and lossy — you cannot recover the
per-mask input from the folded array, so there is no Möbius step for them. The practical consequence
is that inclusion–exclusion is available for the summing variants and not for the optimising ones,
which is the first thing to check when someone proposes "just transform it back".

## What the transform cannot do

It aggregates over the subsets of each mask independently. It does **not** combine two arrays over
*pairs* of disjoint sets — "for every mask, the best split into two halves" — which is the subset-sum
convolution, a genuinely different and harder object. The naive version of that is the `Θ(3^n)`
submask loop in [09g](09g-submask-dp-and-partitions.md); the ranked-zeta algorithm that does it in
`Θ(2^n · n²)` exists and is well past this tier — name it if it comes up, do not attempt it under
time pressure. ⚠️ I have deliberately not written its derivation here, because I could not state it
without more care than a preview page can carry.

The everyday consequence: if your transition needs "the best over all ways of splitting this mask in
two", SOS does not apply directly. If it needs "the best over all subsets of this mask", it does.

## Gotchas

**★ Symptom: the SOS transform's results are too large, roughly doubling each run.** Cause: it was
applied twice to the same array — the transform is not idempotent for `+`, so a second pass sums over
submasks of already-summed values. Fix: transform once, from `a` into a differently named `f`, and
never re-run it on the output.

**★ Symptom: swapping the SOS loops "for readability" changed the answers.** Cause: the bit loop must
be outside and the mask loop inside; the inverted nesting applies all `n` bits to one mask before
moving on, reading cells that have had a different number of passes applied. Fix: keep `i` outside.
The *inner* loop's direction is genuinely free, because within a pass the cells written (bit `i` set)
and the cells read (bit `i` clear) are disjoint sets.

**Symptom: the Möbius inverse gives values that are off by a sign.** Cause: the inverse must mirror
the forward transform exactly — same bit order, same membership test, `-=` instead of `+=`. A subset
transform undone with the superset inverse is not an inverse at all. Fix: pair them literally, and
write both as functions rather than inline so the mirror is visible.

**Symptom: the `max` variant of SOS returns `0` for masks that should be `-Infinity`.** Cause: the
array was initialised with the container's zero value rather than an identity for `max`. Fix: fill
with a sentinel that is the identity of the operation you are folding — `-Infinity` for `max`, `0`
for `+`, `+Infinity` for `min` — and match it to the container type, since an `Int32Array` cannot
hold `Infinity` ([09e](09e-dp-over-masks-the-shape-and-the-cost.md)).

**★ Symptom: the transform's sums overflow silently.** Cause: `f[mask]` accumulates up to `2^n`
input values, so a per-mask value that fits comfortably can sum to something that does not — a Java
`int` array is the usual victim ([05d](05d-the-three-silent-overflows.md)), and in JavaScript a
`number` stops being exact above `2^53 − 1` with no error at all
([05](05-integer-limits-and-overflow.md)). Fix: size the accumulator for the sum, not the element —
`long[]` in Java — or reduce modulo a prime after every addition if the problem is a count
([03l](03l-why-answers-are-taken-modulo-a-large-prime.md)).

## Interview questions

**★ Explain the sum-over-subsets transform and why it is `2^n · n`.**
You want, for every mask, the aggregate over all of its submasks. Do it one bit at a time: after
processing bits `0 … i`, each cell holds the aggregate over the submasks that may differ from it only
in those bits. The step for bit `i` touches only masks that have bit `i` set, and combines the value
it already has — submasks that keep bit `i` — with the cell at `mask ^ (1 << i)`, which holds
exactly the submasks that drop it. That is `n` passes over `2^n` cells, so `Θ(2^n · n)`, against
`Θ(3^n)` for the direct evaluation. The in-place update is safe because within a pass the written
cells all have bit `i` set and the read cells all have it clear, so they never overlap.

**What is the inverse of the subset-sum transform, and what is it for?**
The same loop with `-=` instead of `+=` — the Möbius transform to the forward zeta transform. It is
inclusion–exclusion, done in `Θ(2^n · n)`: given "how many things are within each mask", it recovers
"how many things are exactly each mask". The pairing matters — a subset transform must be undone by
the subset inverse, not the superset one — and it is worth writing them as two functions so the
mirror is visible rather than inlining both loops.

**★ Why is the in-place version safe when most in-place DPs are not?**
Because within the pass for bit `i`, the set of cells written and the set of cells read are disjoint:
only masks with bit `i` set are written, and only masks with bit `i` clear are read. There is no cell
that is both a source and a destination in the same pass, so the inner loop's direction is irrelevant
— ascending, descending, any order at all. That is unusual and worth saying explicitly, because the
instinct trained by every other in-place mask DP is to worry about direction, and here the worry is
misplaced. The order that *does* matter is the nesting: bits outside, masks inside.

**How would you use it to count pairs of items with no overlapping flags?**
For every value `y` in the input, increment `a[flags(y)]`. Run the subset-sum transform to get
`f[mask] = ` how many items have flags that are a subset of `mask`. Then for each item `x`, the
number of partners with `x.flags & y.flags === 0` is `f[complement(x.flags)]`, where the complement
is `x.flags ^ ((1 << n) - 1)`. That is one transform plus one lookup per item — `Θ(2^n · n + m)` —
against a quadratic pairwise scan. Remember to handle `x` pairing with itself and the double count of
ordered pairs, which is where this answer usually goes wrong rather than in the transform.

{/* FOOTER */}
