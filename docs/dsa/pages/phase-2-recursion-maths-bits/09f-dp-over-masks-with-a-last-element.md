---
title: "When the cost of the next step depends on which element you took last, the set is not a sufficient state — and dp[mask][last] is the smallest possible repair, at the price of an n-fold table and an n-fold transition"
sidebar_label: "09f · dp[mask][last] and the tour"
sidebar_position: 9.5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The state counts, transition counts and byte figures are **arithmetic derived
> on this page** — multiplications you can check, not measurements. The Java `int` overflow behind the
> sentinel warning is quoted in [05d](05d-the-three-silent-overflows.md) from the JDK 25 javadoc; the
> 32-bit mask bound is [09b](09b-precedence-and-the-32-bit-loop-bound.md)'s, quoted there from MDN.
> ⚠️ The flat-array-versus-array-of-arrays argument is stated as **mechanism** (one allocation and
> contiguous memory against `2^n` allocations and an indirection), not as a benchmark. **No sandbox
> run.** Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**`dp[mask]` works whenever the set is a sufficient state
([09e](09e-dp-over-masks-the-shape-and-the-cost.md)). The travelling salesman is the instructive case
where it is not — and the repair is exactly one dimension wide, which is the lesson worth carrying
out of this page.** The set of visited cities does not determine the cost of the next move; the city
you are standing in does. So the state becomes "the set, plus where I am", the table grows by a
factor of `n`, the transition loop grows by a factor of `n`, and the whole cost analysis follows.

## Shape 2 — `dp[mask][last]`, when the last element changes the future

The travelling salesman is the canonical case, and its structure is the reason the second dimension
exists at all: the cost of the *next* move depends on where you are, so the set alone is not a
sufficient state. It is the smallest possible repair — one extra dimension, not a full history.

```
dp[mask][last] = the minimum cost of a path that starts at node 0,
                 visits exactly the nodes in `mask`, and ends at `last`
```

```ts
export function tsp(d: readonly (readonly number[])[]): number {
  const n = d.length;
  const size = 1 << n;
  const INF = Number.POSITIVE_INFINITY;
  const dp = new Float64Array(size * n).fill(INF);   // flattened: dp[mask * n + last]
  dp[(1 << 0) * n + 0] = 0;                          // start at node 0, having visited only node 0

  for (let mask = 1; mask < size; mask++) {
    if ((mask & 1) === 0) continue;                  // every valid path contains node 0
    for (let last = 0; last < n; last++) {
      const here = dp[mask * n + last];
      if (here === INF || (mask & (1 << last)) === 0) continue;
      for (let next = 0; next < n; next++) {
        if ((mask & (1 << next)) !== 0) continue;
        const nm = mask | (1 << next);
        const candidate = here + d[last][next];
        if (candidate < dp[nm * n + next]) dp[nm * n + next] = candidate;
      }
    }
  }

  const full = size - 1;
  let best = INF;
  for (let last = 1; last < n; last++) {
    best = Math.min(best, dp[full * n + last] + d[last][0]);   // close the cycle
  }
  return best;
}
```

```java
static int tsp(int[][] d) {
    int n = d.length, size = 1 << n, INF = 1 << 29;
    int[] dp = new int[size * n];
    Arrays.fill(dp, INF);
    dp[1 * n + 0] = 0;
    for (int mask = 1; mask < size; mask++) {
        if ((mask & 1) == 0) continue;
        for (int last = 0; last < n; last++) {
            int here = dp[mask * n + last];
            if (here >= INF || (mask & (1 << last)) == 0) continue;
            for (int next = 0; next < n; next++) {
                if ((mask & (1 << next)) != 0) continue;
                int nm = mask | (1 << next);
                dp[nm * n + next] = Math.min(dp[nm * n + next], here + d[last][next]);
            }
        }
    }
    int best = INF;
    for (int last = 1; last < n; last++) best = Math.min(best, dp[(size - 1) * n + last] + d[last][0]);
    return best;
}
```

**Cost.** `2^n · n` states, `Θ(n)` transitions each: **`Θ(2^n · n²)` time and `Θ(2^n · n)` memory.**
Both figures matter and the memory one usually binds first
([09i](09i-where-n-stops-fitting.md)).

Three implementation notes that are not decoration:

- **Flatten the table.** `dp[mask * n + last]` in one `Float64Array` / `int[]` rather than a
  `number[][]` or `int[][]`. A rectangular array of arrays is `2^n` separate allocations with `2^n`
  headers and an indirection per read; the flat form is one allocation. This is a mechanism argument
  about allocation and indirection, not a measured claim.
- **Skip masks without node 0.** Half the masks describe paths that never contain the start, and
  they are all unreachable. `if ((mask & 1) === 0) continue;` removes them in one line.
- **`INF` needs headroom in Java.** `Integer.MAX_VALUE + d[last][next]` overflows to a large negative
  number, which then *wins* the `Math.min` and produces a confidently wrong minimum
  ([05d](05d-the-three-silent-overflows.md)). `1 << 29` is a sentinel you can add a real cost to
  without wrapping. In TypeScript, `Infinity + x` is `Infinity`, so the same bug does not exist —
  but `Infinity` in an `Int32Array` becomes `0`, which is a different disaster, so match the sentinel
  to the container.

## Reconstructing the assignment, not just its cost

"Return the minimum cost" is the version that fits on a whiteboard; "return the actual assignment"
is what gets asked next. Store the choice alongside the value:

```ts
const parent = new Int32Array(size * n).fill(-1);
// ... inside the relaxation that improves dp[nm * n + next]:
parent[nm * n + next] = mask * n + last;
```

Then walk backwards from the best final cell, reading off which bit each step added. 🔴 **This
doubles the memory**, which for a table already at the ceiling is exactly the thing that turns a
working solution into an out-of-memory one. The alternative is to re-derive the path by replaying the
recurrence from the final state — at each step, find the predecessor whose value plus the edge cost
equals the current cell — which costs `Θ(n)` per step and no extra memory, and is the version to
propose when the interviewer has just told you `n = 20`.

## The counting variant, and where the modulus goes

Replace `min` with `+` and the same table counts instead of optimises — Hamiltonian paths, orderings
satisfying precedence constraints, valid schedules. The count explodes immediately (it is bounded by
`n!`), so the problem will ask for it modulo a prime
([03l](03l-why-answers-are-taken-modulo-a-large-prime.md)):

```java
dp[nm * n + next] = (dp[nm * n + next] + dp[mask * n + last]) % MOD;
```

⚠️ Take the modulus on **addition**, every time, not at the end — two values below `10^9` sum to
below `2^31`, so a Java `int` survives a single addition and not a second one
([05d](05d-the-three-silent-overflows.md)). In JavaScript the sum of two values below `10^9` is
exact, so a `number` is fine here; it stops being fine the moment the recurrence multiplies
([03j](03j-modular-arithmetic-and-the-remainder-trap.md)).

## When the mask DP is the wrong tool for this problem

Honesty about the assignment problem specifically: **the Hungarian algorithm solves it in `Θ(n³)`**,
which handles `n` in the hundreds where the mask DP dies in the twenties. The mask DP is the right
answer when the objective is *not* a plain sum over a cost matrix — when the cost of adding an
element depends on the whole set chosen so far, when there are side constraints that the polynomial
algorithm cannot express, or when the interviewer has set `n ≤ 20` precisely so that you reach for
the exponential one. **Say the polynomial algorithm exists if you know it does**; proposing an
exponential algorithm without acknowledging a polynomial alternative is the failure mode the question
is testing for.

Equally, if the problem prunes well, a branch-and-bound search over the same states may beat the
table by visiting a tiny fraction of it ([06i](06i-bound-pruning-and-ordering.md)) — at the price of
a worst case that is no better.

## Gotchas

**★ Symptom: the TSP table gives an answer that is too small, ignoring one city.** Cause: the answer
was read as `min over last of dp[full][last]` without adding the return edge `d[last][0]`, or `full`
was computed as `1 << n` rather than `(1 << n) - 1`
([09b](09b-precedence-and-the-32-bit-loop-bound.md)). Fix: both — write `const full = size - 1;`
once, and close the cycle explicitly.

**★ Symptom: the solution works for `n = 12` and runs out of memory at `n = 22`.** Cause:
`dp[mask][last]` is `2^n · n` entries — at `n = 22` that is `2^22 · 22 = 92,274,688` cells, and at
four bytes each, 369,098,752 bytes. Fix: this is the constraint, not a bug
([09i](09i-where-n-stops-fitting.md)). Drop the second dimension if the problem allows, use a
narrower cell type, or accept that `n` is out of range for this technique.

**Symptom: the counting variant returns a negative count.** Cause: the modulus was applied only at
the end, so the accumulated sum overflowed an `int` first. Fix: reduce after every addition
([03l](03l-why-answers-are-taken-modulo-a-large-prime.md)).

**Symptom: paths that never visit the start node pollute the table.** Cause: masks without bit 0 were
not skipped, so half the table holds states that no valid path reaches. They do not produce wrong
answers if the base case is right, but they double the work. Fix: `if ((mask & 1) === 0) continue;`.

**Symptom: reconstruction produces a path that does not match the reported cost.** Cause: `parent`
was written on every relaxation attempt rather than only on the ones that improved the cell. Fix:
write the parent inside the `if (candidate < dp[next])` branch, never beside it.

**★ Symptom: the tour is correct but the table is `n` times larger than it needs to be.** Cause:
the second dimension was added out of habit rather than necessity — the objective did not actually
depend on the last element. Fix: check the transition. If the cost of adding element `x` does not
mention the previous element, the state is just the set and the table is `2^n`, not `2^n · n`. Every
unnecessary dimension multiplies both the memory and the time.

## Interview questions

**★ Why does TSP need `dp[mask][last]` when assignment does not?**
Because the cost of the next step depends on where you currently are. In assignment, the cost of
giving job `j` to worker `i` does not depend on which job the previous worker took, so the set is a
sufficient state. In TSP the next edge is `d[last][next]`, so two paths covering the same set but
ending at different cities have different futures — the set is not sufficient. Adding the last city
is the *minimum* repair: it captures exactly the part of the history that the future depends on, and
nothing else. That is the general principle worth naming: the state must contain everything the
future depends on, and nothing it does not, because every extra dimension multiplies the table.

**★ What does the TSP mask DP cost, in time and memory, and which one stops you first?**
`2^n · n` states, `Θ(n)` transitions each, so `Θ(2^n · n²)` time and `Θ(2^n · n)` memory. Memory
stops you first, and by a wide margin, because the table must exist all at once while the time is
merely spent. At `n = 20` the table is `2^20 · 20` four-byte cells — 83,886,080 bytes — which is
large but liveable; at `n = 22` it is 369,098,752 bytes, which usually is not. That arithmetic is
the answer to "what is the biggest `n` you would attempt", and it is better than a guess.

**★ How do you recover the actual tour rather than its cost?**
Either store a parent pointer per cell at the moment a relaxation improves it, then walk backwards
from the best final state, or re-derive the path by replaying the recurrence — at each state, look
for the predecessor whose value plus the connecting edge equals the current cell. The first is
`Θ(1)` per step and doubles the memory; the second is `Θ(n)` per step and costs nothing extra. Since
memory is the binding constraint for this family, the replay version is usually the better answer,
and saying *why* you chose it is the point of the question.

**Where does the modulus go in the counting version?**
On every addition, not at the end. Two residues below `10^9` sum to below `2^31`, so a Java `int`
survives one addition and not two — the second one wraps, and a wrapped count is negative or
plausible depending on luck. In JavaScript addition of values that size is exact in a `number`, so
the reduction is about keeping the value in range rather than about precision — until the recurrence
multiplies, at which point the product exceeds `2^53` and a `number` stops being exact with no error
at all.

{/* FOOTER */}
