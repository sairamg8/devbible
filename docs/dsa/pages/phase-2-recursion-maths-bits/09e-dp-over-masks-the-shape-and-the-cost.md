---
title: "A DP over masks has two shapes and the first one covers most problems — dp[mask] alone, because the position in the sequence is recoverable from the popcount rather than being information the state has to carry"
sidebar_label: "09e · DP over masks: shape and cost"
sidebar_position: 9.4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The state counts, the transition counts and every complexity figure here are
> **arithmetic derived on this page**, not measurements and not cited. The `int` overflow behaviour
> behind the sentinel warning is quoted in [05c](05c-javas-int-and-the-checked-arithmetic.md) and
> [05d](05d-the-three-silent-overflows.md) from the JDK 25 javadoc; the 32-bit mask bound is
> [09b](09b-precedence-and-the-32-bit-loop-bound.md)'s, quoted there from MDN. **No sandbox run**:
> no timing, no memory measurement, no program output appears below — the byte figures are
> multiplications you can check.
> Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**Dynamic programming as a subject belongs to
[part 6 of the syllabus](../../syllabus/06-backtracking-greedy-and-dp.md); what belongs here is the
narrow fact that makes the mask representation worth having, which is that `dp` can be an array
subscripted by a set.** This page is a preview, deliberately: two state shapes, their transitions,
their costs, and the handful of implementation decisions that turn a correct recurrence into a
program that finishes. It does not teach you to find a recurrence.

The precondition, restated from [09](09-bitmask-enumeration.md): **the state is a set, and the order
in which the set was assembled does not change the future.** Everything below is what to do when
that holds, and what to do when it *almost* holds.

## Shape 1 — `dp[mask]`, when the position is implied by the popcount

The assignment problem is the cleanest instance. You have `n` couriers and `n` pending orders on the
storefront, and `cost[i][j]` is what it costs courier `i` to deliver order `j`. Assign each courier
exactly one order, minimising the total.

The state is *which orders have been assigned*. The insight that removes a whole dimension:
**if couriers are processed in a fixed order, then the number of couriers already assigned is
`popcount(mask)`** — so the "which courier am I on" dimension is not free information, it is
derivable, and the table stays one-dimensional.

```
dp[mask] = the minimum cost of assigning the orders in `mask`
           to couriers 0 … popcount(mask) - 1
```

```ts
export function minAssignmentCost(cost: readonly (readonly number[])[]): number {
  const n = cost.length;
  const size = 1 << n;                       // n <= 30; see 09b
  const INF = Number.POSITIVE_INFINITY;
  const dp = new Float64Array(size).fill(INF);
  dp[0] = 0;

  for (let mask = 0; mask < size; mask++) {
    if (dp[mask] === INF) continue;          // unreachable: nothing to push from
    const i = popcount(mask);                // the courier this step assigns
    if (i === n) continue;
    for (let j = 0; j < n; j++) {
      if ((mask & (1 << j)) !== 0) continue; // order j already taken
      const next = mask | (1 << j);
      const candidate = dp[mask] + cost[i][j];
      if (candidate < dp[next]) dp[next] = candidate;
    }
  }
  return dp[size - 1];
}

const popcount = (m: number): number => {
  let c = 0;
  for (let x = m; x !== 0; x &= x - 1) c++;  // Kernighan — 04d
  return c;
};
```

```java
static int minAssignmentCost(int[][] cost) {
    int n = cost.length, size = 1 << n, INF = 1 << 29;   // headroom, not Integer.MAX_VALUE
    int[] dp = new int[size];
    Arrays.fill(dp, INF);
    dp[0] = 0;
    for (int mask = 0; mask < size; mask++) {
        if (dp[mask] == INF) continue;
        int i = Integer.bitCount(mask);
        if (i == n) continue;
        for (int j = 0; j < n; j++) {
            if ((mask & (1 << j)) != 0) continue;
            int next = mask | (1 << j);
            dp[next] = Math.min(dp[next], dp[mask] + cost[i][j]);
        }
    }
    return dp[size - 1];
}
```

**Cost.** `2^n` states, `Θ(n)` transitions from each, so **`Θ(2^n · n)` time and `Θ(2^n)` memory**.
Note that the popcount call inside the loop does not change the class — it is `Θ(n)` at worst and
sits beside an `n`-iteration loop — but precomputing a popcount table
([04d](04d-counting-set-bits-and-the-platform-methods.md)) removes it, and in Java
`Integer.bitCount` is a single documented method call and needs no table.

The loop above is a **push** formulation: it reads `dp[mask]` and writes forward to `dp[mask | bit]`.
The **pull** version reads backwards and writes once:

```ts
for (let mask = 1; mask < size; mask++) {
  const i = popcount(mask) - 1;                     // the courier that closed this mask
  let best = INF;
  for (let j = 0; j < n; j++) {
    if ((mask & (1 << j)) === 0) continue;
    const prev = mask ^ (1 << j);
    if (dp[prev] !== INF) best = Math.min(best, dp[prev] + cost[i][j]);
  }
  dp[mask] = best;
}
```

Both are correct in ascending order for the reason in
[09c](09c-generating-masks-in-a-useful-order.md) — a submask is numerically smaller. Pull writes each
cell exactly once, which makes it the safer default when the cell holds something more complex than a
number; push is easier to read and skips unreachable states cheaply. **Choose one and do not mix
them in the same table**, because a half-pushed cell read as if it were final is a bug that survives
every small test.

## Where the second shape goes

When the set alone is not a sufficient state — when the cost of the next step depends on which
element you took last — the repair is one extra dimension, and that is
[09f](09f-dp-over-masks-with-a-last-element.md): `dp[mask][last]`, the travelling salesman, path
reconstruction, the counting variant and the modulus, and the honest note about when a polynomial
algorithm already solves the problem you are about to spend `2^n` on.

## Gotchas

**★ Symptom: a minimisation over masks returns a large negative number.** Cause: `INF` was
`Integer.MAX_VALUE`, an unreachable state had a cost added to it, and the `int` wrapped
([05d](05d-the-three-silent-overflows.md)). Fix: a sentinel with headroom (`1 << 29`), *and* an
explicit `continue` on unreachable states so the arithmetic never happens.

**★ Symptom: `dp[mask]` for the assignment problem is off by one courier.** Cause: the push form uses
`i = popcount(mask)` (the courier about to be assigned) and the pull form uses
`i = popcount(mask) - 1` (the courier that just was), and the two were mixed. Fix: pick push or pull
for the whole table and derive `i` once, in one place.

**★ Symptom: `new Array(1 << n).fill(...)` of arrays is far heavier than the cell count suggests.**
Cause: `number[][]` allocates `2^n` separate arrays, each with its own header and an indirection per
access. Fix: flatten to `dp[mask * n + last]` in a single typed array, which is one allocation and
one contiguous block.

**Symptom: a `Float64Array` cell holds `0` where `Infinity` was written.** Cause: the container was
an `Int32Array`, which cannot represent `Infinity` and converts it. Fix: match the sentinel to the
container — `Infinity` only in a float array, a large finite integer in an integer array.

**★ Symptom: the assignment DP's answer is `INF` although a valid assignment exists.** Cause:
`dp[size - 1]` was read while the loop stopped short — `mask < size - 1`, or a `continue` on
`i === n` placed before the write rather than before the transitions. Fix: the full mask is
`size - 1`; make sure the loop's last iteration is the one that *writes* it, which means the loop
that reads `dp[mask]` must run to `size - 1` inclusive in the pull form and to `size - 2` in the
push form.

**Symptom: the popcount call dominates the profile of an otherwise correct DP.** Cause: a
Kernighan loop runs inside the innermost loop, so its `Θ(popcount)` is paid `2^n · n` times. Fix:
precompute `pc[m] = pc[m >> 1] + (m & 1)` once in `Θ(2^n)`
([04d](04d-counting-set-bits-and-the-platform-methods.md)), or in Java call `Integer.bitCount`,
which is a single method rather than a loop. This is stated as mechanism — no measurement is
offered.

## Interview questions

**★ Set up the DP for the assignment problem and give its complexity.**
The state is the set of jobs already assigned, held as a mask. The trick that keeps it
one-dimensional is that the number of workers processed so far is `popcount(mask)` — it is implied
by the state, not extra information — so `dp[mask]` is the minimum cost of assigning the jobs in
`mask` to workers `0 … popcount(mask) - 1`. The transition assigns worker `popcount(mask)` to any
job not yet in the mask. That is `2^n` states with `Θ(n)` transitions each: `Θ(2^n · n)` time,
`Θ(2^n)` memory. And the sentence that should follow it unprompted: the Hungarian algorithm does
this in `Θ(n³)`, so the mask DP is justified only by `n ≤ 20` or by an objective that is not a plain
matrix sum.

**★ Push or pull — does it matter?**
Not for correctness, as long as the loop direction matches the dependency: both read strictly
smaller masks in ascending order. It matters for two practical things. Pull writes each cell exactly
once, so the cell is either untouched or final, which is what you want when reading a cell means
something more than a number. Push skips unreachable states cheaply — one `continue` at the top —
and reads more naturally as "having done this, what can I do next". The real rule is not to mix
them, because a partially pushed cell read as final is a bug that passes every small test.

**★ Why does `dp[mask]` alone suffice for assignment?**
Because the worker index is recoverable from the state: if workers are processed in a fixed order,
the number already assigned is exactly `popcount(mask)`. A dimension that is a function of another
dimension is not information, it is duplication, and carrying it would multiply the table by `n` for
nothing. The habit this teaches generalises past bitmasks — before adding a dimension to a DP, ask
whether it is implied by the ones you already have.

{/* FOOTER */}
