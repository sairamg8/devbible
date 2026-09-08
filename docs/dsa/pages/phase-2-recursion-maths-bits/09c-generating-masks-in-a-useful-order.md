---
title: "Counting up from zero is already a topological order for any DP whose state depends on its submasks — and once you know why, descending order and popcount layers stop being preferences and become the two answers to questions the ascending loop cannot express"
sidebar_label: "09c · Generating masks in a useful order"
sidebar_position: 9.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. Every ordering claim on this page — that a proper submask is numerically
> smaller, that `i ^ (i >> 1)` is a bijection whose consecutive values differ in one bit, and the
> Gosper next-combination derivation — is **mathematics derived on this page**, not cited. The
> 32-bit bound on every loop below is [09b](09b-precedence-and-the-32-bit-loop-bound.md)'s, quoted
> there from MDN. ⚠️ The remark about sequential versus scattered memory access is stated as
> **mechanism**; no measurement supports it and none is offered. **No sandbox run.**
> Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**The order you generate masks in is not a style choice — for a dynamic program it is a correctness
property, because a state must be finished before anything that reads it starts.** The good news is
that the obvious loop is already right for the common case, and the reason is a one-line proof worth
having: clearing a bit makes a number smaller, so every submask of `mask` is numerically less than
`mask`, so counting up from zero visits dependencies before dependents. The rest of this page is
the three situations where ascending is *not* the order you want, and what to write instead.

## Ascending order is a topological sort of the submask relation

**Claim.** If `sub` is a proper submask of `mask` — `(sub & mask) === sub` and `sub !== mask` — then
`sub < mask`.

**Proof.** `sub` is obtained from `mask` by clearing a non-empty set of set bits. Clearing bit `i`
subtracts `2^i`, which is strictly positive, and no other bit changes. Subtracting a positive
quantity strictly decreases the value. ∎

That is the whole justification for the loop everyone writes without thinking:

```ts
for (let mask = 0; mask < (1 << n); mask++) {
  // every submask of `mask` — every state this one depends on — is already final
}
```

Two immediate corollaries, both used constantly:

- **A "pull" DP whose transition reads `dp[mask ^ bit]` or any `dp[sub]` with `sub ⊆ mask` is safe
  in ascending order**, with no extra bookkeeping and no separate topological sort. Bitmask DP owes
  most of its simplicity to this.
- **A "push" DP that writes `dp[mask | bit]` from `dp[mask]` is also safe in ascending order**, for
  the same reason read the other way: `mask | bit > mask` when the bit was not already set, so every
  write lands strictly ahead of the cursor and is finished by the time the loop reaches it.

🔴 **What is *not* safe is a transition in either direction that crosses the cursor.** If
`dp[mask]` depends on `dp[mask | bit]` — a superset, not a submask — ascending order reads a value
that has not been computed yet, and the failure is a plausible-looking wrong answer rather than a
crash, because the array holds whatever it was initialised with.

## Descending order, for superset dependencies

Superset dependencies are real and common: "the best I can do having *already excluded* this set",
reachability backwards from the full set, and the superset half of the sum-over-subsets transform
([09g](09g-submask-dp-and-partitions.md)). The mirror of the claim above holds — a proper
superset is numerically larger — so:

```ts
for (let mask = (1 << n) - 1; mask >= 0; mask--) {
  // every superset of `mask` is already final
}
```

⚠️ **`mask >= 0` as a loop condition is a bug waiting for `n = 31`**, when the initial value is
negative before the loop starts, and it is also the shape that never terminates if you make `mask`
unsigned in some other language. Keep `n ≤ 30` and this is fine; past that, see
[09b](09b-precedence-and-the-32-bit-loop-bound.md).

## By popcount, and why you would want that

Ascending numeric order already respects the submask relation, so **popcount order is not needed for
correctness** in a standard bitmask DP — that is the first thing to say when someone proposes it.
It is needed for three other reasons:

1. **Memory, by layers.** If every transition adds exactly one element, `dp` over masks with `k`
   bits depends only on masks with `k − 1` bits. Then you never need the whole `2^n` array at once —
   only two consecutive layers, of sizes `C(n, k-1)` and `C(n, k)`. That is a real reduction when
   the answer lives at a specific `k`, and it is the standard escape when the full table does not
   fit ([09i](09i-where-n-stops-fitting.md)). It costs you random access by mask, so it is only
   worth it when the layer structure is genuinely there.
2. **Fixed-size subsets.** "All `k`-element subsets" is one popcount layer, and enumerating only
   that layer is `C(n, k)` masks instead of `2^n` — an enormous difference for small `k`
   ([08](08-combinatorics-for-counting-problems.md)).
3. **Ordering by cost.** A search that wants to consider cheaper states first, where cost correlates
   with set size, gets a usable priority for free.

Bucketing by popcount is `Θ(2^n)` with the DP-table popcount from
[04d](04d-counting-set-bits-and-the-platform-methods.md), not `Θ(2^n log 2^n)` with a sort:

```ts
export function masksByPopcount(n: number): number[][] {
  const size = 1 << n;
  const pc = new Int8Array(size);
  const buckets: number[][] = Array.from({ length: n + 1 }, () => []);
  buckets[0].push(0);
  for (let m = 1; m < size; m++) {
    pc[m] = pc[m >> 1] + (m & 1);      // one bit shorter, plus the bit that fell off
    buckets[pc[m]].push(m);
  }
  return buckets;
}
```

```java
static List<List<Integer>> masksByPopcount(int n) {
    int size = 1 << n;
    List<List<Integer>> buckets = new ArrayList<>();
    for (int k = 0; k <= n; k++) buckets.add(new ArrayList<>());
    for (int m = 0; m < size; m++) buckets.get(Integer.bitCount(m)).add(m);
    return buckets;
}
```

⚠️ **The Java version boxes every mask into an `Integer`.** At `n = 20` that is a million boxed
objects in the bucket lists, which is exactly the allocation you were trying to avoid by using
masks. If the layer is large, use `int[]` with a counting pass to size each bucket, or iterate all
masks and filter on `Integer.bitCount(m) == k` — one extra pass over `2^n`, no allocation.

## A note on memory order

Ascending mask order walks `dp` sequentially, which is the access pattern hardware is built for.
Popcount-bucketed order and Gray-code order both scatter. This is stated as mechanism and not
quantified — no measurement backs it here — but it is the reason to prefer "ascending plus a
condition" over "reorder the array" when both are available: filtering `Integer.bitCount(m) == k`
inside an ascending loop costs one extra pass and keeps the access pattern, where materialising
buckets costs the pattern and the allocation both.

## When the state has a second dimension, the mask goes in the outer loop

```ts
for (let mask = 0; mask < limit; mask++) {
  for (let last = 0; last < n; last++) {
    // dp[mask][last] reads dp[mask ^ (1 << last)][prev] — a strictly smaller mask
  }
}
```

The whole dependency lives in the mask dimension: every transition reads a mask with one fewer bit,
and within a fixed mask no cell depends on another cell of the same mask. So the inner loop's order
is unconstrained, and the outer loop must be the ascending mask.

🔴 **The rule that generalises: the dimension carrying the dependency goes outermost.** Inverting the
nesting here happens to stay correct, because the mask comparison still holds cell by cell — but it
scatters memory access, and it stops being correct the moment a formulation adds a transition that
stays within the same mask (a "stay put", a "wait a step", a second choice at the same set). Nesting
by the dependency rather than by habit means you do not have to re-derive that each time.

## Skipping masks that cannot occur

Many DPs reach only a fraction of the `2^n` masks — states constrained by precedence, by a capacity
bound, by a popcount ceiling. Filtering inside the ascending loop is free and does not disturb the
order, because skipping a state reorders nothing:

```ts
for (let mask = 0; mask < limit; mask++) {
  if (dp[mask] === INF) continue;      // unreachable: nothing to propagate from here
  // ... transitions
}
```

That guard is also a correctness aid rather than only a speed one. Without it, an unreachable
sentinel gets fed into an arithmetic transition — `INF + cost` — which in Java overflows an `int`
into a large negative number and then *wins* a minimisation
([05d](05d-the-three-silent-overflows.md)). The guard removes the whole class.

## Gotchas

**★ Symptom: a DP over masks returns the initialisation value for many states.** Cause: a
transition reads a *superset* — `dp[mask | bit]` — inside an ascending loop, so it reads a cell the
loop has not reached. Fix: run the loop descending, or reformulate the recurrence to depend on
submasks. Determine which by writing down one transition and asking whether the mask it reads is
numerically larger or smaller than the one it writes; there is no third case.

**★ Symptom: `for (let mask = (1 << n) - 1; mask >= 0; mask--)` never enters the body.** Cause:
`n = 31`, so `(1 << 31) - 1` is computed from a negative value
([09b](09b-precedence-and-the-32-bit-loop-bound.md)). Fix: the `n ≤ 30` cap, and prefer
`for (let mask = limit - 1; mask >= 0; mask--)` with `limit` established once and asserted.

**★ Symptom: the popcount-bucketed Java version allocates heavily and slows the whole solution.**
Cause: `List<List<Integer>>` boxes every one of the `2^n` masks. Fix: use `int[]` buckets sized by a
counting pass, or skip bucketing entirely and filter on `Integer.bitCount(m) == k` inside the
ascending loop.

**Symptom: the "layered" memory optimisation gives wrong answers.** Cause: keeping only two popcount
layers is valid only when *every* transition changes the popcount by exactly one. A transition that
adds two elements, or one that keeps the mask the same size, reaches a layer that has been
discarded. Fix: check every transition against that invariant before discarding a layer, and if one
violates it, keep the full table.

**Symptom: `pc[m] = pc[m >> 1] + (m & 1)` produces garbage for large `m`.** Cause: `>>` is the
signed shift, so a mask with bit 31 set stays negative and indexes out of range. Fix: `>>>`, or the
`n ≤ 30` cap that makes the question moot ([04d](04d-counting-set-bits-and-the-platform-methods.md)).

**★ Symptom: a `dp[mask][last]` table gives wrong answers when the loops are nested `last` outside,
`mask` inside.** Cause: the formulation has a transition that stays within the same mask, so the
inner mask loop finishes a mask before all of its same-mask predecessors are done. Fix: nest the
dimension that carries the dependency outermost — the mask — and treat the inner dimension's order
as free only after checking that no transition stays inside one mask.

**Symptom: a minimisation DP returns a large negative number.** Cause: an unreachable state held a
sentinel like `Integer.MAX_VALUE`, a transition added a cost to it, and the `int` wrapped
([05d](05d-the-three-silent-overflows.md)). Fix: skip unreachable states with an explicit
`continue`, and pick a sentinel with headroom — something like `1 << 29` for costs that fit — rather
than the type's maximum.

## Interview questions

**★ Why is `for (mask = 0; mask < (1 << n); mask++)` a valid order for a bitmask DP?**
Because a proper submask is always numerically smaller. Clearing a set bit subtracts a positive
power of two and changes nothing else, so any `sub` with `sub ⊆ mask` and `sub !== mask` satisfies
`sub < mask`. Ascending order therefore visits every dependency before its dependent — it *is* a
topological sort of the submask lattice, for free, with no sort and no explicit ordering pass. The
same statement read backwards is why a push formulation writing `dp[mask | bit]` is equally safe:
the write always lands ahead of the cursor.

**★ When would you iterate masks in decreasing order instead?**
When the dependency points at supersets rather than submasks — `dp[mask]` reads `dp[mask | bit]`.
Since a proper superset is numerically larger, descending order finishes those first. The
sum-over-supersets transform is the standard example, and the mirror-image of the subset-sum one.
The way to decide in the room is mechanical rather than intuitive: write one transition, compare the
mask you read against the mask you write, and let the inequality pick the direction.

**★ Does popcount order ever matter for correctness?**
Not for the standard bitmask DP — ascending numeric order already implies it in the only sense that
matters, because a submask has strictly fewer bits *and* a strictly smaller value. It matters for
**memory**: if every transition adds exactly one element, only two popcount layers are ever live, so
you can hold `C(n, k-1) + C(n, k)` entries instead of `2^n`. That is the trade that rescues a
problem sitting just past the memory ceiling, and its precondition — every transition changes the
popcount by exactly one — has to be checked, not assumed.

**★ You have `dp[mask][last]`. Which loop goes outside?**
The mask, ascending. Every transition reads a mask with one fewer bit set, which is numerically
smaller, and no cell depends on another cell with the same mask — so the mask dimension carries the
entire dependency and the inner dimension's order is free. The general rule to state is "nest by the
dependency, not by the array shape", because a formulation that adds an intra-mask transition —
staying at the same set and changing only the second dimension — silently breaks the inverted
nesting while looking identical.

**Why bother skipping unreachable masks if the loop visits them anyway?**
Two reasons, and the second is the one that matters. It saves the transition work, which is `Θ(n)`
or `Θ(n²)` per skipped state. And it stops a sentinel value being used as a real number: an
unreachable cell holding `Integer.MAX_VALUE` plus any positive cost wraps to a large negative, which
then beats every legitimate answer in a minimisation and produces a confidently wrong result. The
`continue` is a guard against arithmetic on a value that was never meant to be arithmetic.

---

← Prev: [09b · Precedence and the 32-bit bound](09b-precedence-and-the-32-bit-loop-bound.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [09d · Fixed-size subsets and Gray code](09d-fixed-size-subsets-and-gray-code.md)
