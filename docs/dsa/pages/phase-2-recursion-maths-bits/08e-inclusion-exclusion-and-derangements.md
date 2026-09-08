---
title: "Inclusion–exclusion exists because the addition principle needs disjoint cases and real constraints overlap — add the singles, subtract the pairs, add the triples — and its cost is 2^k terms, which is exactly why it is the right tool for a handful of constraints and the wrong one for many"
sidebar_label: "08e · Inclusion–exclusion, derangements"
sidebar_position: 8.4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The principle, its proof by counting an element's contributions, the
> derangement derivation and the surjection formula are **mathematics, derived on this page, not
> cited to a source**. The subset-enumeration loop uses a bitmask; **Bitmask enumeration** *(not
> written yet)* owns that technique and this page uses only the part it derives. Java targets
> **JDK 25**; TypeScript first, Java second. Builds on
> [08](08-combinatorics-for-counting-problems.md). **No sandbox run.**

**The addition principle requires disjoint cases, and almost no interesting constraint is
disjoint.** Orders that used a promo and orders that used a gift card overlap; numbers divisible by
2 and numbers divisible by 3 overlap; permutations where item 1 stays put and permutations where
item 2 stays put overlap. Inclusion–exclusion is the correction: add each case, subtract every
pairwise overlap you double-counted, add back every triple overlap you over-subtracted, and
alternate. It is one of the two general-purpose counting tools (the other is a DP), it costs `2^k`
terms for `k` constraints, and that cost is the whole of the decision about when to use it.

## Two sets, three sets, and the general form

```
|A ∪ B|      = |A| + |B| − |A∩B|
|A ∪ B ∪ C|  = |A| + |B| + |C| − |A∩B| − |A∩C| − |B∩C| + |A∩B∩C|

|A₁ ∪ … ∪ A_k| = Σ_{∅ ≠ S ⊆ {1..k}} (−1)^{|S|+1} · |∩_{i∈S} A_i|
```

**The proof is one sentence, and it is the sentence to say in a round.** Take an element that lies
in exactly `m` of the sets, `m ≥ 1`. It is counted once for each of the `C(m, 1)` singletons, minus
`C(m, 2)` pairs, plus `C(m, 3)` triples, and so on — total
`Σ_{j=1}^{m} (−1)^{j+1} C(m, j)`, which is `1 − Σ_{j=0}^{m}(−1)^j C(m, j) = 1 − 0 = 1`. Every
element is counted exactly once, so the formula is exact. The alternating row sum being zero is the
identity from [08b](08b-pascals-rule-and-the-dp-table.md), reused here.

In practice the complement form is more useful, because problems usually ask how many objects satisfy
*none* of the bad properties:

```
|none of them| = N − |A₁ ∪ … ∪ A_k| = Σ_{S ⊆ {1..k}} (−1)^{|S|} · |∩_{i∈S} A_i|
```

with the empty set contributing `+N`. That version is what the code below computes.

## The worked shape: count what none of the constraints hit

The canonical use is "how many integers in `1…N` are divisible by none of these primes", and the
intersection is easy because divisibility by a set of coprime numbers is divisibility by their
product.

```ts
// How many of 1..N are divisible by none of `divisors` (assumed pairwise coprime).
export function countCoprimeTo(N: number, divisors: number[]): number {
  const k = divisors.length;
  let total = 0;
  for (let mask = 0; mask < (1 << k); mask++) {     // every subset of the constraints
    let product = 1, bits = 0;
    for (let i = 0; i < k; i++) {
      if (mask & (1 << i)) { product *= divisors[i]; bits++; }
    }
    const count = Math.floor(N / product);          // multiples of the product, up to N
    total += (bits % 2 === 0 ? count : -count);     // + for even |S|, − for odd
  }
  return total;                                     // Θ(2^k · k)
}
```

```java
// Java: identical. `long` for the product — a handful of primes multiply past an int quickly.
public static long countCoprimeTo(long n, int[] divisors) {
    int k = divisors.length;
    long total = 0L;
    for (int mask = 0; mask < (1 << k); mask++) {
        long product = 1L;
        int bits = 0;
        for (int i = 0; i < k; i++) {
            if ((mask & (1 << i)) != 0) { product *= divisors[i]; bits++; }
        }
        long count = n / product;
        total += (bits % 2 == 0) ? count : -count;
    }
    return total;
}
```

Two things this example teaches beyond the formula. **The intersections must be computable** — the
whole method is useless if `|A_i ∩ A_j|` is as hard as the original problem, and it is easy here only
because coprime divisibility multiplies. And **the sign is the parity of the subset size**, which
makes the bitmask loop the natural implementation: iterate every subset of the constraints, compute
one intersection, add or subtract by the popcount's parity.

🔴 **The product overflows before `2^k` does.** With a handful of primes, `product` passes an `int`
quickly; and once the product exceeds `N` the term is zero anyway, so an early exit on
`product > N` is both an optimisation and an overflow guard.

## Derangements: the standard worked example

A derangement is a permutation with no fixed point — nobody gets their own gift back. Let `A_i` be
the permutations that fix element `i`. Then `|A_i| = (n−1)!`, `|A_i ∩ A_j| = (n−2)!`, and generally
an intersection over a set of size `j` is `(n−j)!`, because the other `n − j` elements permute
freely. There are `C(n, j)` such sets, so:

```
D_n = Σ_{j=0}^{n} (−1)^j · C(n, j) · (n−j)!  =  n! · Σ_{j=0}^{n} (−1)^j / j!
```

The second form comes from `C(n, j)·(n−j)! = n!/j!`. It shows immediately that `D_n / n!` converges
to `1/e`, so **roughly 37% of permutations are derangements, for every `n` past a few** — a fact
worth knowing because it makes an "is my answer plausible" check instant.

The recurrence is often easier to code and is derived directly:

```
D_0 = 1,  D_1 = 0,  D_n = (n − 1) · (D_{n−1} + D_{n−2})
```

*Why:* element 1 must go to some position `k`, in `n − 1` ways. Either element `k` goes to position 1
— then the remaining `n − 2` elements must be deranged, giving `D_{n−2}` — or it does not, in which
case forbidding element `k` from position 1 makes the rest a derangement of `n − 1` items, giving
`D_{n−1}`. The sequence begins `1, 0, 1, 2, 9, 44, 265`.

```ts
// Both routes. The recurrence is Θ(n) with only integer arithmetic; the sum needs factorials.
export function derangements(n: number): number[] {
  const d = new Array<number>(Math.max(n + 1, 2)).fill(0);
  d[0] = 1; d[1] = 0;
  for (let m = 2; m <= n; m++) d[m] = (m - 1) * (d[m - 1] + d[m - 2]);
  return d.slice(0, n + 1);
}
```

## The other two standard uses

**Surjections.** The number of functions from an `n`-set *onto* a `k`-set: start from all `k^n`
functions and exclude those missing at least one target.

```
Surj(n, k) = Σ_{j=0}^{k} (−1)^j · C(k, j) · (k − j)^n
```

The same object as `k! · S(n, k)` with the Stirling numbers from
[08c](08c-stars-and-bars-and-multisets.md) — which is a useful cross-check: if a problem's answer can
be written both ways, one of them is usually far easier to compute.

**Upper-bounded stars and bars.** [08c](08c-stars-and-bars-and-multisets.md) left this open: to count
solutions of `x₁ + … + x_k = n` with `xᵢ ≤ Uᵢ`, let `A_i` be the solutions with `xᵢ ≥ Uᵢ + 1`.
Each such intersection is a plain lower-bound problem — substitute the excesses away — so
`|∩_{i∈S} A_i| = C(n − Σ_{i∈S}(Uᵢ+1) + k − 1, k − 1)`, zero when the argument goes negative, and the
alternating sum over subsets is the answer.

## The cost, and when to stop

`2^k` terms for `k` constraints. That is fine for `k ≤ 20` or so and hopeless beyond it, and the
crossover is the practical rule:

| `k` (number of overlapping constraints) | Approach |
|---|---|
| 2–3 | write the terms by hand |
| up to ~20 | the bitmask loop, Θ(2^k · cost of one intersection) |
| large, but constraints have structure | a DP over a state that summarises which constraints are live |
| large, unstructured | there is probably no efficient exact count; check whether the problem wants an approximation or has a different decomposition |

The third row is the one that gets missed. When the constraints are ordered — "no two adjacent
positions may both be X" — the right tool is a DP whose state is the last decision, not an
inclusion–exclusion over 2^k subsets. Overlap alone does not mean inclusion–exclusion; overlap plus a
small unstructured constraint set does. That judgement is [08f](08f-closed-form-or-dp.md).

## Gotchas

**★ Symptom: the signs alternate the wrong way and the count is negative or too large.** Cause: the
two forms confused — the *union* form starts with `+` on singletons and has sign `(−1)^{|S|+1}`, while
the *complement* form ("none of them") starts with `+N` for the empty set and has sign `(−1)^{|S|}`.
Fix: pick the complement form and let the empty subset contribute the universe with a plus; then the
sign is just the parity of the subset size and the bitmask loop writes itself.

**★ Symptom: the intersections are as hard to compute as the original problem.** Cause:
inclusion–exclusion applied where the constraints do not intersect cleanly. Fix: the method is only
worth it when `|∩ A_i|` has a formula — coprime divisors multiply, fixed points leave a smaller
factorial, exceeded caps become a lower-bound substitution. If the intersection needs its own search,
you have moved the difficulty rather than removed it.

**★ Symptom: the product of the divisors overflows before the loop finishes.** Cause: multiplying a
subset of constraints without a guard, in a language that wraps silently. Fix: break out of the
subset as soon as `product > N`, since the term is then zero — this bounds the product by `N` and is
also the main practical optimisation.

**★ Symptom: `D_n` computed with the alternating factorial sum and the answer is wrong for larger
n.** Cause: the sum needs `n!` and alternating terms, so it loses exactness in floating point and
overflows in integers earlier than the answer requires. Fix: the recurrence
`D_n = (n−1)(D_{n−1} + D_{n−2})`, which is Θ(n), uses only integer arithmetic, and has no
cancellation.

**★ Symptom: 2^k terms enumerated for a large `k` and the program never finishes.** Cause:
inclusion–exclusion applied to a problem with many constraints. Fix: check whether the constraints
have structure — ordering, adjacency, a bounded resource — in which case a DP over a summarising state
is polynomial. Inclusion–exclusion is for a handful of unstructured constraints.

**Symptom: an element in three of the sets is counted twice.** Cause: stopping the alternation after
the pairwise terms. Fix: every subset size up to `k` contributes; the proof that each element is
counted once is the alternating binomial sum, and truncating it breaks exactly for elements in three
or more sets.

**Symptom: a derangement answer that is not about 37% of `n!`.** Cause: an arithmetic or index slip.
Fix: `D_n/n! → 1/e`, so for any `n` past a few the ratio is close to 0.368 — the fastest sanity check
in this whole topic, and it costs one division.

**Symptom: `C(n, j)·(n−j)!` recomputed inside the loop and it overflows.** Cause: building `n!`-sized
intermediates for a much smaller answer. Fix: it equals `n!/j!`, so the terms can be generated
iteratively — or use the recurrence and avoid factorials entirely.

## Interview questions

**★ State inclusion–exclusion and prove it in one sentence.**
`|A₁ ∪ … ∪ A_k| = Σ_{∅≠S} (−1)^{|S|+1} |∩_{i∈S} A_i|`. The proof: take an element lying in exactly
`m` of the sets; it is counted `C(m,1)` times positively, `C(m,2)` times negatively, `C(m,3)` times
positively, and so on, and that alternating sum equals 1 because the full alternating binomial row sum
is zero. So every element in the union is counted exactly once and every element outside it is counted
zero times. In practice the complement form — `Σ_{S} (−1)^{|S|} |∩_{i∈S} A_i|` with the empty subset
contributing the whole universe — is the one to implement, because problems ask for the objects that
satisfy none of the bad properties.

**★ Derive the number of derangements.**
Let `A_i` be the permutations fixing element `i`. An intersection over a set of `j` indices fixes
those `j` and lets the other `n − j` permute freely, so it has size `(n−j)!`, and there are `C(n, j)`
such sets. Inclusion–exclusion in complement form gives
`D_n = Σ_j (−1)^j C(n, j) (n−j)! = n! Σ_j (−1)^j / j!`, which immediately shows `D_n/n! → 1/e`, so
about 37% of permutations are derangements. For code, the recurrence
`D_n = (n−1)(D_{n−1} + D_{n−2})` is better: element 1 goes to one of `n − 1` positions `k`, and either
element `k` goes to position 1 — leaving a derangement of the other `n − 2` — or it does not, leaving a
derangement of `n − 1`. It is Θ(n), exact in integers, and has no cancellation.

**★ When is inclusion–exclusion the wrong tool even though the constraints overlap?**
When there are many constraints, because the method costs `2^k` terms. Overlap alone does not select
it; overlap plus a *small, unstructured* constraint set does. If the constraints have structure —
adjacency, ordering, a shared budget — a dynamic program whose state summarises which constraints are
still live is polynomial where inclusion–exclusion is exponential. The other disqualifier is when the
intersections are not easy: the whole method rests on `|∩ A_i|` having a formula, and if computing one
intersection is as hard as the original problem you have relocated the difficulty rather than solved
it.

**★ How do you count solutions of `x₁ + … + x_k = n` when each variable has an upper bound?**
Let `A_i` be the solutions violating bound `i`, that is with `xᵢ ≥ Uᵢ + 1`. Each intersection is a
plain *lower*-bound stars-and-bars problem: subtract `Uᵢ + 1` from the total for each `i` in the
subset and apply `C(free + k − 1, k − 1)`, treating a negative remainder as zero. Then alternate over
subsets. Lower bounds substitute away for free and upper bounds cost an inclusion–exclusion — that
asymmetry is the thing to state, because it is what tells you the problem's cost before you write any
code.

**What sanity check do you run on a derangement or inclusion–exclusion answer?**
For derangements, the ratio to `n!` — it should sit close to `1/e ≈ 0.368` for any `n` past a few, and
anything far from that is an index or sign error. For inclusion–exclusion generally, two checks:
the answer must lie between zero and the size of the universe, and setting all the constraint sets to
empty must return the universe exactly. A negative result is almost always the sign convention — the
union form and the complement form differ by one in the exponent, and mixing them produces a value
that is wrong by roughly twice the union.

{/* FOOTER */}
