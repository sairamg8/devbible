---
title: "Pascal's rule is a counting argument, not a triangle — split the objects on whether they contain the last element — and the DP table it gives is the only way to compute binomial coefficients using nothing but addition, which is why it survives a modulus and a division-free constraint"
sidebar_label: "08b · Pascal's rule and the DP table"
sidebar_position: 8.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. Pascal's rule, the hockey-stick and parallel-summation identities and the
> binomial theorem are **mathematics, derived on this page, not cited to a source**. The overflow
> thresholds are arithmetic, checked against the constants quoted in
> [08](08-combinatorics-for-counting-problems.md) (MDN `Number.MAX_SAFE_INTEGER`; JDK 25
> `Integer.MAX_VALUE`). Computing binomials **under a modulus**, and the inverse-factorial
> precompute, belong to **Fast exponentiation and the modular inverse** *(not written yet)* — this
> page stops at the table. Java targets **JDK 25**. **No sandbox run.**

**`C(n, k) = C(n−1, k−1) + C(n−1, k)` is not a numerical curiosity; it is the addition principle
applied to one specific question — does the chosen set contain the last element?** Every `k`-subset
of `n` items either contains item `n` (then the rest is a `(k−1)`-subset of the first `n−1`) or does
not (then it is a `k`-subset of the first `n−1`). Those two cases are disjoint and exhaustive, so
the counts add. That single sentence is the derivation, and it also explains why the recursion has
exactly the shape of the include/exclude subsets search in
[06d](06d-subsets-and-combinations.md) — because it *is* that search, counted instead of listed.

## The rule, and the base cases

```
C(n, k) = C(n−1, k−1) + C(n−1, k)          for 0 < k < n
C(n, 0) = C(n, n) = 1
C(n, k) = 0                                for k < 0 or k > n
```

The base cases are the two degenerate counts: there is exactly one way to choose nothing and
exactly one way to choose everything. The out-of-range case matters in code — it is what lets you
write the recurrence without guarding both indices at every call.

## The table

```ts
// Pascal's triangle up to n. Only additions — no division, no factorial, no overflow until the
// VALUES overflow, which is much later than the factorials would.
export function binomialTable(n: number): number[][] {
  const c: number[][] = Array.from({ length: n + 1 }, (_, r) => new Array<number>(r + 1).fill(0));
  for (let r = 0; r <= n; r++) {
    c[r][0] = 1;
    for (let k = 1; k <= r; k++) {
      c[r][k] = c[r - 1][k - 1] + (k <= r - 1 ? c[r - 1][k] : 0);
    }
  }
  return c;                                   // Θ(n²) time, Θ(n²) space
}
```

```java
// Java: the same table, triangular so it allocates half the rectangle.
public static long[][] binomialTable(int n) {
    long[][] c = new long[n + 1][];
    for (int r = 0; r <= n; r++) {
        c[r] = new long[r + 1];
        c[r][0] = 1L;
        for (int k = 1; k <= r; k++) {
            c[r][k] = c[r - 1][k - 1] + (k <= r - 1 ? c[r - 1][k] : 0L);
        }
    }
    return c;                                 // Θ(n²) time, Θ(n²) space
}
```

**One row at a time, in place**, when you only need row `n` — Θ(n) space instead of Θ(n²):

```ts
// Iterate k downwards so c[k] still holds the PREVIOUS row's value when it is read.
export function binomialRow(n: number): number[] {
  const c = new Array<number>(n + 1).fill(0);
  c[0] = 1;
  for (let r = 1; r <= n; r++) {
    for (let k = r; k >= 1; k--) c[k] = c[k] + c[k - 1];   // 🔴 downwards, not upwards
  }
  return c;
}
```

🔴 **The descending inner loop is the entire correctness of the in-place version.** Going upwards,
`c[k − 1]` has already been overwritten with the current row's value when `c[k]` reads it, so the
recurrence silently becomes something else — and it produces plausible, monotonically increasing
nonsense rather than an error. This is the same "which version of the array am I reading" hazard as
the 0/1-knapsack one-dimensional table, and the same fix.

## When the table is the right choice

| Situation | Use |
|---|---|
| one coefficient, exact, moderate `n` | multiplicative loop ([08](08-combinatorics-for-counting-problems.md)) |
| many coefficients, `n` up to a few thousand | **the table** — Θ(n²) once, Θ(1) per query |
| answers wanted modulo a prime | the table (addition survives a modulus) or factorials + inverses |
| `n` large, `k` small | multiplicative loop — Θ(k), no table needed |
| exact values, large `n` | `BigInt` / `BigInteger` with either method |

The table's real advantage is that it **only ever adds**. Under a modulus, addition needs one
conditional subtraction and no inverse at all, so a Θ(n²) table is a complete solution for
`n` in the low thousands without any number theory. Beyond that the Θ(n²) becomes the problem and
you need the factorial-and-inverse precompute, which is topic 07's — this page deliberately stops
at the boundary.

## Identities worth recognising

Each of these is a counting argument, and knowing the argument is more useful than knowing the
formula, because the argument is what transfers to a problem that is *nearly* this shape.

**Row sum: `Σ_k C(n, k) = 2^n`.** Every subset has exactly one size; there are 2^n subsets.

**Alternating row sum: `Σ_k (−1)^k C(n, k) = 0` for `n ≥ 1`.** Subsets of even size and subsets of
odd size are equinumerous — pair each subset with the one that toggles element 1.

**Symmetry: `C(n, k) = C(n, n−k)`.** Choosing what to take is choosing what to leave.

**Absorption: `k · C(n, k) = n · C(n−1, k−1)`.** Both sides count "a committee of `k` with a named
chair": pick the committee then the chair, or pick the chair then the rest.

**Hockey stick: `Σ_{r=k}^{n} C(r, k) = C(n+1, k+1)`.** Classify `(k+1)`-subsets of `{0…n}` by their
largest element `r`; the rest is a `k`-subset of `{0…r−1}`.

**Vandermonde: `Σ_j C(m, j)·C(n, k−j) = C(m+n, k)`.** Choosing `k` from two disjoint pools, split on
how many come from the first — this is the identity behind most "two groups" counting problems.

**Binomial theorem: `(x + y)^n = Σ_k C(n, k) x^k y^(n−k)`.** Expanding the product picks `x` from
`k` of the `n` factors; the number of ways to make that choice is the coefficient. Substituting
`x = y = 1` gives the row sum for free, and `x = −1, y = 1` gives the alternating one — which is why
those two identities never need to be memorised separately.

## The DP table is a counting DP

Worth seeing, because it is the bridge to
[08f](08f-closed-form-or-dp.md): the Pascal table is a dynamic program whose state is
`(items considered, items chosen)` and whose transition is the last item's include/exclude decision.
Every counting DP in an interview has that shape — a state that summarises the history, and a
transition that splits on the last decision. The reason `C(n, k)` *also* has a closed form is that
the constraints happen to be simple enough to collapse; add one obstacle and the closed form goes
away while the table survives unchanged. That asymmetry — closed forms are fragile, tables are not —
is the practical reason to know both.

```ts
// The same recurrence, memoised top-down: the include/exclude decision made explicit.
export function chooseMemo(n: number, k: number, memo = new Map<string, number>()): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const key = `${n},${k}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const v = chooseMemo(n - 1, k - 1, memo) + chooseMemo(n - 1, k, memo);  // take it / leave it
  memo.set(key, v);
  return v;
}
```

Without the memo this recursion has C(n, k) leaves and is exactly as expensive as enumerating the
subsets it counts — a clean small illustration of what memoisation buys, and of why "count them"
and "list them" have completely different complexities.

## Gotchas

**★ Symptom: the in-place single-row Pascal update produces steadily growing wrong numbers.**
Cause: the inner loop iterates `k` upwards, so `c[k−1]` has already been overwritten with the
current row when `c[k]` reads it. Fix: iterate `k` downwards from `r` to 1. There is no error and
the output is monotonic and plausible, which is why this one survives to production.

**★ Symptom: the recursive `C(n, k)` is unusably slow for moderate n.** Cause: no memo — the
recursion tree has one leaf per `k`-subset, so it is exactly as expensive as enumerating them. Fix:
memoise on `(n, k)`, or build the table bottom-up; both make it Θ(n·k).

**★ Symptom: the table is correct and the program still overflows.** Cause: the table removes the
*intermediate* overflow of factorials, not the overflow of the answer itself — `C(n, n/2)` grows
like `4^n/√n` and passes a `long` not far past `n = 66`. Fix: `BigInteger`, or reduce each addition
modulo the required prime, which is exactly why the additive form is the one that survives a
modulus.

**★ Symptom: `C(n, k)` for `k > n` returns a value instead of zero, or throws.** Cause: the
out-of-range base case omitted, so the recursion walks off the triangle. Fix: return 0 for `k < 0`
or `k > n`; that guard is what lets the recurrence be written without index checks at every call
site.

**Symptom: a triangular `long[][]` indexed as if it were rectangular, and it throws on the upper
half.** Cause: allocating row `r` with `r + 1` entries and then reading `c[r][k]` for `k > r`. Fix:
guard with `k <= r` — the value there is zero by definition, not stored.

**Symptom: an identity applied with the wrong index range and the result is off by one row.**
Cause: recalled rather than derived. Fix: re-derive from the counting argument — hockey stick is
"classify by the largest element", Vandermonde is "split on how many came from the first pool" —
which fixes the range automatically.

**Symptom: a Θ(n²) table built to answer a single query with small `k`.** Cause: reaching for the
familiar tool. Fix: the multiplicative loop is Θ(min(k, n−k)) and allocates nothing; the table earns
its cost only when there are many queries or a modulus is involved.

## Interview questions

**★ Derive Pascal's rule and say what it has to do with the subsets search.**
Split the `k`-subsets of `n` items on whether they contain the last item. If they do, the remainder
is a `(k−1)`-subset of the first `n−1`; if they do not, the whole thing is a `k`-subset of the first
`n−1`. The two cases are disjoint and cover everything, so by the addition principle
`C(n, k) = C(n−1, k−1) + C(n−1, k)`. That is precisely the include/exclude decision the binary
subsets recursion makes at each index — the recurrence is that search with the answers counted
rather than listed, which is also why the unmemoised recursion costs exactly as much as the
enumeration and the memoised one costs Θ(n·k).

**★ Why compute binomial coefficients with a table rather than a formula?**
Because the table only ever adds. It never builds a factorial, so it has no intermediate overflow;
it needs no division, so it works unchanged under a modulus where division would require an inverse;
and it answers every query in Θ(1) after a Θ(n²) build, which pays off the moment there is more than
a handful of queries. The formula wins when there is a single query, `k` is small, or `n` is far too
large to tabulate — the multiplicative loop is Θ(min(k, n−k)) and allocates nothing. The table's
limit is its Θ(n²) build, which caps `n` in the low thousands.

**★ Write the O(n) space version of the table and explain the loop direction.**
Keep one array `c` of length `n+1`, set `c[0] = 1`, and for each row `r` update
`c[k] = c[k] + c[k−1]` for `k` from `r` down to 1. The direction is the whole correctness argument:
`c[k−1]` must still hold the *previous* row's value when it is read, and iterating upwards
overwrites it first. Going the wrong way produces no error and no obviously wrong shape — the values
just grow faster than they should — which is the same hazard as the one-dimensional knapsack table
and has the same fix.

**Which identity would you reach for when a problem splits a selection across two disjoint groups?**
Vandermonde's: `Σ_j C(m, j)·C(n, k−j) = C(m+n, k)`. The counting argument is the useful part —
choosing `k` items from two disjoint pools of sizes `m` and `n`, classified by how many come from
the first — because most interview problems of this shape are not literally Vandermonde but are the
same decomposition with a constraint on `j`, and then the sum over the allowed `j` is the answer and
no closed form exists. Recognising the shape tells you the sum is the answer, which is often the
thing being tested.

**How large can `n` be before a `long` table overflows?**
Not as far as people expect, because the central coefficient grows like `4^n/√(πn)`: `C(n, n/2)`
passes 2^63 not long after `n` reaches the sixties, and every row below that is safe. That is far
better than factorials, which stop at `20!` in a `long`, but it is still small — so any counting
problem with `n` in the hundreds is asking for either `BigInteger` or a modulus, and the phrasing of
the question tells you which.

{/* FOOTER */}
