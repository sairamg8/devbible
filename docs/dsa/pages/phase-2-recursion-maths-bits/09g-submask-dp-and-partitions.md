---
title: "Partition problems transition over submasks rather than single elements, which costs 3^n — and two lines of symmetry breaking plus one reformulation are the difference between that being admissible and not"
sidebar_label: "09g · Submask DP and partitions"
sidebar_position: 9.6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The `3^n` count is derived in
> [04f](04f-submasks-and-the-3-to-the-n-count.md) and restated here; the symmetry-breaking argument
> and the capacity-packing encoding are **mathematics derived on this page**, not cited. The 32-bit mask bound is [09b](09b-precedence-and-the-32-bit-loop-bound.md)'s, quoted
> there from MDN. **No sandbox run**: the exponential figures below are arithmetic, not
> measurements. Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**Some mask DPs do not add one element at a time. They add a whole group — a bin, a team, a
delivery run — and the transition therefore ranges over the submasks of the current state rather
than over its bits.** That single change moves the cost from `Θ(2^n · n)` to `Θ(3^n)`, which is a
different exponential base and usually the difference between admissible and not. This page is that
family: the recurrence, the symmetry breaking that removes a factorial constant from it, and the
reformulation that escapes `3^n` entirely when the group predicate happens to be incremental. The
other escape — the sum-over-subsets transform, which computes an aggregate over every subset of
every mask in `Θ(2^n · n)` — is [09h](09h-sum-over-subsets-and-the-mobius-inverse.md).

The submask iteration itself — `sub = (sub - 1) & mask`, why it is a decrement, why the total is
`3^n` — is [04f](04f-submasks-and-the-3-to-the-n-count.md) and is not re-derived here.

## The shape: a transition over submasks

"Split these `n` tasks into the fewest groups such that each group is feasible" is the archetype.
Precompute feasibility per group, then partition:

```
ok[sub]  = true when the tasks in `sub` can form one valid group
dp[mask] = the fewest groups needed to cover exactly the tasks in `mask`
         = 1 + min over non-empty sub ⊆ mask with ok[sub] of dp[mask ^ sub]
```

```ts
export function minGroups(n: number, ok: readonly boolean[]): number {
  const size = 1 << n;
  const INF = Number.POSITIVE_INFINITY;
  const dp = new Float64Array(size).fill(INF);
  dp[0] = 0;

  for (let mask = 1; mask < size; mask++) {
    const low = mask & -mask;                 // the lowest task in this mask — 04c
    const rest = mask ^ low;
    // every submask of `rest`, each combined with `low`: exactly the submasks containing `low`
    for (let sub = rest; ; sub = (sub - 1) & rest) {
      const group = sub | low;
      if (ok[group] && dp[mask ^ group] + 1 < dp[mask]) dp[mask] = dp[mask ^ group] + 1;
      if (sub === 0) break;                   // the empty submask is visited, then we stop — 04f
    }
  }
  return dp[size - 1];
}
```

```java
static int minGroups(int n, boolean[] ok) {
    int size = 1 << n, INF = 1 << 29;
    int[] dp = new int[size];
    Arrays.fill(dp, INF);
    dp[0] = 0;
    for (int mask = 1; mask < size; mask++) {
        int low = mask & -mask, rest = mask ^ low;
        for (int sub = rest; ; sub = (sub - 1) & rest) {
            int group = sub | low;
            if (ok[group] && dp[mask ^ group] + 1 < dp[mask]) dp[mask] = dp[mask ^ group] + 1;
            if (sub == 0) break;
        }
    }
    return dp[size - 1];
}
```

🔴 **The `low` trick is symmetry breaking, and it is the difference between a correct-but-hopeless
solution and a usable one.** Without it, the loop enumerates every submask of `mask`, and every
partition is then discovered once per ordering of its groups — a partition into `k` groups is found
`k!` times. Forcing the lowest remaining element into the group being formed picks one canonical
ordering: the groups are always discovered in increasing order of their smallest element, so each
partition is built exactly once. It is also *correct*, not merely faster, in the sense that no
partition is lost — the lowest element has to be in some group, and that group is enumerated.

**Cost.** Enumerating submasks of every mask is `3^n` ([04f](04f-submasks-and-the-3-to-the-n-count.md)).
Restricting to submasks that contain the lowest bit halves the inner enumeration, so the constant
improves but the class does not: it is still `Θ(3^n)`. At `n = 20` that is 3,486,784,401 iterations —
arithmetic, not a measurement, and enough to say the technique is out of range there. `Θ(3^n)`
problems are sized for `n` in the mid-teens.

## Getting out of 3^n when the groups are constrained

**The submask DP is the general answer, and it is often not the intended one.** For the most common
concrete version — "split into `k` groups each with sum at most `C`", or "into `k` groups of equal
sum" — there is a `Θ(2^n · n)` reformulation, and knowing it is the whole point of the question.

The reformulation adds elements one at a time and carries the *current group's remaining capacity*
as a derived quantity rather than a dimension:

```
dp[mask] = the minimum number of completed groups needed for the items in `mask`,
           tie-broken by the largest remaining capacity in the group under construction
```

Because the two components are ordered lexicographically — fewer groups always beats more, and among
equal group counts more remaining capacity is never worse — they can be packed into one comparable
value and the state stays `dp[mask]`.

```ts
// dp[mask] = groupsUsed * (C + 1) + (C - remainingInCurrentGroup), minimised
export function minBins(weights: readonly number[], C: number): number {
  const n = weights.length, size = 1 << n;
  const dp = new Int32Array(size).fill(0x3fffffff);
  dp[0] = 0;                                        // 0 groups used, a fresh group with full C
  for (let mask = 0; mask < size; mask++) {
    if (dp[mask] === 0x3fffffff) continue;
    const used = Math.floor(dp[mask] / (C + 1));
    const remaining = C - (dp[mask] % (C + 1));
    for (let i = 0; i < n; i++) {
      if ((mask & (1 << i)) !== 0 || weights[i] > C) continue;
      const next = mask | (1 << i);
      const cand = weights[i] <= remaining
        ? (used) * (C + 1) + (C - (remaining - weights[i]))       // fits in the current group
        : (used + 1) * (C + 1) + (C - (C - weights[i]));          // open a new group
      if (cand < dp[next]) dp[next] = cand;
    }
  }
  return Math.floor(dp[size - 1] / (C + 1)) + 1;
}
```

⚠️ **The packing of two quantities into one integer is the fragile part**, not the recurrence.
`groups * (C + 1) + slack` is a valid encoding only while `slack` stays in `0 … C`, which is why the
`weights[i] > C` guard exists — an item that cannot fit any group would produce a negative slack and
silently corrupt the ordering. When in doubt, keep two parallel arrays and compare explicitly; the
encoding is an optimisation, and it is the first thing to remove when the answer is wrong.

**This is the trade to state out loud**: `Θ(3^n)` for the general partition where any group predicate
is allowed, `Θ(2^n · n)` when the predicate is a capacity that can be maintained incrementally. If
`ok[sub]` cannot be maintained as you add elements one at a time — a graph-colouring feasibility, a
"no two of these together" rule spread over the whole group — you are back to `3^n`.

## Gotchas

**★ Symptom: a partition DP is correct on tiny inputs and hopeless at `n = 15`.** Cause: the
transition enumerates every submask of every mask, which is `Θ(3^n)` — 3^15 is 14,348,907 and 3^20 is
3,486,784,401. Fix: there is no fix inside the formulation; either the problem is sized for it, or
the group predicate is incremental and the `Θ(2^n · n)` capacity reformulation applies, or the
technique is wrong for this `n`.

**★ Symptom: the partition DP finds correct answers but takes `k!` times longer than it should.**
Cause: the inner loop enumerates all submasks, so each partition is rediscovered once per ordering of
its groups. Fix: force the lowest set bit of `mask` into the group being formed — iterate submasks of
`mask ^ (mask & -mask)` and OR the low bit back in. Each partition is then built exactly once.

**★ Symptom: the submask partition DP misses the answer entirely, returning `INF`.** Cause: the
submask loop was written `for (sub = mask; sub > 0; sub = (sub - 1) & mask)`, which never visits the
empty submask ([04f](04f-submasks-and-the-3-to-the-n-count.md)) — and with the `low` trick the empty
submask of `rest` is the group `{low}` alone, a perfectly legitimate singleton group. Fix: the
`for (;;)` form with `if (sub === 0) break;` after the body.

**★ Symptom: the capacity-packed `dp[mask]` encoding produces nonsense for one input.** Cause: an
item heavier than the bin capacity makes the slack component negative, which breaks the ordering the
packing depends on. Fix: reject or special-case items above `C` before the DP, and when debugging,
split the packed value back into two parallel arrays — the encoding is an optimisation, not part of
the recurrence.

**★ Symptom: `ok[sub]` itself is the bottleneck, not the DP.** Cause: feasibility was computed per
submask inside the transition, so an `Θ(n)` or `Θ(n²)` check runs `3^n` times. Fix: precompute `ok`
for all `2^n` masks in one pass before the DP — usually `Θ(2^n · n)` with an incremental
formulation, `ok[mask]` derived from `ok[mask ^ low]` — so the transition is a single array read.

**Symptom: the partition DP double-counts groups when a group may be empty.** Cause: an "empty
group is allowed" reading of the recurrence lets `dp[mask]` reach itself with `sub = 0` and loop
forever or inflate the count. Fix: with the `low` trick this cannot happen — the group always
contains at least the lowest element — which is a second reason to use it beyond the constant factor.

## Interview questions

**★ Why is the partition DP `3^n` and not `4^n`?**
Because `4^n` counts `2^n` masks times `2^n` candidate submasks each, and the submask loop only
visits the ones that qualify. Count the pairs `(mask, sub)` with `sub ⊆ mask` element by element:
each element is outside the mask, inside the mask but outside the submask, or inside both — three
independent choices over `n` elements, so `3^n`. The difference is a change of exponential base
rather than a constant, which is the whole value of the `(sub - 1) & mask` idiom
([04f](04f-submasks-and-the-3-to-the-n-count.md)).

**★ How do you avoid rediscovering the same partition once per group ordering?**
Force the lowest remaining element into the group currently being formed. Take `low = mask & -mask`,
enumerate submasks of `mask ^ low`, and OR `low` back into each one. Every partition then gets
exactly one canonical construction — groups in increasing order of their smallest element — instead
of `k!` of them. It does not change the `3^n` class, because the number of `(mask, sub)` pairs with
the low bit fixed is still exponential in the same base, but it removes a factorial constant, and it
is two lines.

**★ When is the submask DP the wrong answer even though it is correct?**
When the group predicate can be maintained incrementally. "Each group's total weight is at most `C`"
can be tracked as a running capacity while adding items one at a time, which turns the partition
problem into a `Θ(2^n · n)` DP whose state is still just the mask, with the group count and the
remaining capacity packed into the value. That is the intended solution for the equal-sum-subsets
family, and reaching for `3^n` when `2^n · n` exists is exactly the thing the question is checking.
The `3^n` version earns its place when the predicate is genuinely about the whole group — a
colouring, a pairwise-conflict rule — and cannot be maintained one element at a time.

**Where does this family show up outside puzzles?**
Anywhere a fixed small set has to be carved into teams under a predicate that is about the team
rather than its members: scheduling `n` jobs onto shifts with a compatibility rule, splitting a
storefront order into the fewest shipments where a shipment is valid only if its items share a
warehouse and fit a box, colouring a small conflict graph with the fewest colours. The tell is that
feasibility is stated over a *group*, not accumulated per item — and that is also exactly the
condition that stops the `Θ(2^n · n)` reformulation from applying.

---

← Prev: [09f · dp[mask][last] and the tour](09f-dp-over-masks-with-a-last-element.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [09h · Sum over subsets and Möbius](09h-sum-over-subsets-and-the-mobius-inverse.md)
