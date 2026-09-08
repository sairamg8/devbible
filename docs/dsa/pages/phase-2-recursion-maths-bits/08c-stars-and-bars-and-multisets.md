---
title: "Stars and bars turns 'how many ways to distribute n identical things into k labelled boxes' into a single binomial by encoding the answer as a string of n stars and k−1 bars — and the reason it is worth knowing is that the four distinguishability cases look identical in a problem statement and have completely different answers"
sidebar_label: "08c · Stars and bars, multisets"
sidebar_position: 8.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The bijection, the two variants, the substitution trick and the
> distinguishability table are **mathematics, derived on this page, not cited to a source**. The
> Stirling and partition entries are named as counts that have **no closed form**, which is itself
> the load-bearing fact. Java targets **JDK 25**; TypeScript first, Java second. Builds on
> [08](08-combinatorics-for-counting-problems.md). **No sandbox run.**

**"Distribute `n` identical items into `k` labelled boxes" and "choose `k` items from `n` types with
repetition allowed" and "count the non-negative integer solutions of `x₁ + … + x_k = n`" are the
same question, and the answer is `C(n + k − 1, k − 1)`.** The derivation is a bijection you can draw
in one line, and it is worth being able to draw, because the two-word difference between "identical"
and "distinct" in a problem statement swaps this formula for `k^n`, for a Stirling number, or for a
count with no closed form at all — and nothing about the wording makes that obvious.

## The bijection

Write a distribution as a row of `n` stars and `k − 1` bars. The stars before the first bar go in box
1, those between the first and second bar go in box 2, and so on:

```
n = 7 stars, k = 4 boxes  →  3 bars

  * * | * * * * | | *          means   box1 = 2, box2 = 4, box3 = 0, box4 = 1
```

Every arrangement of the `n + k − 1` symbols is exactly one distribution, and every distribution is
exactly one arrangement — a bijection. So the count is the number of ways to choose which of the
`n + k − 1` positions hold the bars:

```
C(n + k − 1, k − 1)      equivalently      C(n + k − 1, n)
```

Empty boxes are allowed and correspond to two adjacent bars, which is why the formula is for
**non-negative** solutions.

## The three phrasings, and the two variants

| Phrasing | Count |
|---|---|
| `n` identical items into `k` labelled boxes, empties allowed | `C(n + k − 1, k − 1)` |
| non-negative integer solutions of `x₁ + … + x_k = n` | `C(n + k − 1, k − 1)` |
| choose `k` items from `n` types, repetition allowed, order irrelevant | `C(n + k − 1, k)` |
| **every box non-empty** / **strictly positive** solutions | `C(n − 1, k − 1)` |
| box `i` needs at least `Lᵢ` | substitute, then use the first row |

The **positive** variant has its own one-line derivation: put one item in each box first, then
distribute the remaining `n − k` freely — `C((n − k) + k − 1, k − 1) = C(n − 1, k − 1)`. Equivalently,
lay out `n` stars and choose `k − 1` of the `n − 1` internal gaps to place bars in, with no two bars
in the same gap.

**Lower bounds by substitution** is the move that turns most real problems into one of the two
rows. If `xᵢ ≥ Lᵢ`, set `yᵢ = xᵢ − Lᵢ ≥ 0`; the equation becomes `y₁ + … + y_k = n − ΣLᵢ` and the
first row applies. **Upper bounds do not substitute away** — `xᵢ ≤ Uᵢ` needs inclusion–exclusion over
which variables violate their cap, which is [08e](08e-inclusion-exclusion-and-derangements.md).

```ts
// Non-negative solutions of x1 + ... + xk = n, with optional per-variable lower bounds.
export function distributions(n: number, k: number, lower: number[] = []): number {
  const floor = lower.reduce((a, b) => a + b, 0);
  const free = n - floor;                        // substitute yi = xi - Li
  if (free < 0 || k <= 0) return 0;
  return choose(free + k - 1, k - 1);            // `choose` is the multiplicative loop from 08
}
```

```java
// Java: identical, with the same substitution step made explicit.
public static long distributions(int n, int k, int[] lower) {
    long floor = 0;
    for (int l : lower) floor += l;
    long free = n - floor;
    if (free < 0 || k <= 0) return 0L;
    return choose((int) free + k - 1, k - 1);
}
```

A storefront use: "in how many ways can 12 identical loyalty points be split across a customer's 4
saved carts, with at least 2 on the primary cart?" Substitute away the 2, leaving 10 points across 4
carts: `C(10 + 3, 3)`. The same question with *distinct* points — each point individually
identifiable — is `4^12`, and the two answers differ by orders of magnitude. Which one the business
means is a question worth asking out loud in an interview; it is usually the point of the exercise.

## The four distinguishability cases

This table is the reason the topic matters. The four rows are one word apart in English and are four
different mathematical objects.

| Items | Boxes | Count of distributions |
|---|---|---|
| distinct | labelled | `k^n` — each item independently picks a box |
| identical | labelled | `C(n + k − 1, k − 1)` — stars and bars |
| distinct | unlabelled | `Σ_{j=1..k} S(n, j)` — Stirling numbers of the second kind, **no closed form** |
| identical | unlabelled | integer partitions of `n` into at most `k` parts, **no closed form** |

The bottom two are the ones to recognise rather than to compute. Both are counted by dynamic
programming — the Stirling recurrence `S(n, j) = j·S(n−1, j) + S(n−1, j−1)` (the new item joins an
existing block or starts its own), and the partition recurrence that walks part sizes — and neither
has a usable closed form. **Recognising that a problem has landed in the bottom half of this table is
worth more than any formula**, because it is the moment you stop searching your memory for a binomial
and start writing a DP. That decision is [08f](08f-closed-form-or-dp.md).

## Multiset combinations

"Choose `k` items from `n` types, repetition allowed, order irrelevant" is the second row read the
other way round: the types are the boxes, the chosen items are the identical stars, so the count is
`C(k + n − 1, n − 1) = C(n + k − 1, k)`. Both forms appear; they are the same number by the symmetry
`C(m, r) = C(m, m − r)`, and mixing them up is the standard slip.

The enumeration counterpart is the "reuse allowed" search from
[06d](06d-subsets-and-combinations.md) — recursing on `i` instead of `i + 1` — and the two agree
exactly: that search's start index prevents the same multiset being generated in more than one
order, which is precisely the order-irrelevance the formula assumes.

## Gotchas

**★ Symptom: `C(n + k − 1, k)` used where `C(n + k − 1, k − 1)` was meant, or vice versa.** Cause:
the two phrasings ("items into boxes" and "choose with repetition") swap the roles of `n` and `k`.
Fix: derive from the picture every time — the bars are `k − 1`, the stars are `n`, and you choose the
positions of one of the two out of `n + k − 1`. The sanity check takes seconds: `k = 1` box must give
1, and `n = 1` item into `k` boxes must give `k`.

**★ Symptom: an upper bound handled by the same substitution as a lower bound, and the count is too
high.** Cause: `xᵢ ≥ Lᵢ` substitutes away cleanly because the shifted variable is still unbounded
above; `xᵢ ≤ Uᵢ` does not, because the shifted variable would need to be bounded. Fix:
inclusion–exclusion over the set of variables that exceed their cap — subtract the distributions
where `x₁ ≥ U₁ + 1` (itself a lower-bound substitution), add back the pairs, and so on.

**★ Symptom: `k^n` used for identical items, or stars and bars used for distinct items.** Cause: the
distinguishability of the *items* never checked. Fix: ask whether swapping two items produces a
different outcome. Twelve identifiable gift cards into four accounts is `4^12`; twelve identical
loyalty points into four carts is `C(15, 3)`. The problem statement usually signals it with one
adjective.

**★ Symptom: a problem with unlabelled boxes answered with a binomial.** Cause: not noticing that
the boxes are interchangeable — "split the team into 3 groups" versus "assign the team to rooms A, B
and C". Fix: unlabelled boxes put you in the bottom half of the table, where the counts are Stirling
numbers or partitions and there is no closed form; write the DP recurrence instead and say why.

**Symptom: the positive-solutions formula used when zero is allowed.** Cause: reading "distribute"
as "give everyone something". Fix: `C(n + k − 1, k − 1)` allows empties; `C(n − 1, k − 1)` requires
every box non-empty. Deriving the second from the first — hand out one each, then distribute the
rest — means you only have to remember one.

**Symptom: the count is zero for a case that clearly has solutions.** Cause: the lower-bound
substitution left `n − ΣLᵢ` negative and the guard fired, but the bounds were misread — often an
"at most" treated as an "at least". Fix: check the direction of every bound before substituting; a
negative `free` is the correct answer only when the minimum requirement exceeds the supply.

**Symptom: a Θ(n·k) Stirling DP written where the boxes were actually labelled.** Cause: reaching
for the harder tool. Fix: labelled boxes with distinct items is just `k^n`; the DP is only needed
when the boxes are interchangeable.

## Interview questions

**★ Derive the stars-and-bars formula.**
Encode a distribution of `n` identical items into `k` labelled boxes as a row of `n` stars and
`k − 1` bars: the stars before the first bar go into box 1, those between the first and second bar
into box 2, and so on, with two adjacent bars meaning an empty box. Every arrangement of the
`n + k − 1` symbols is exactly one distribution and every distribution exactly one arrangement, so
the map is a bijection and the count is the number of ways to place the bars among the positions:
`C(n + k − 1, k − 1)`. The same argument gives the "at least one per box" variant — put one item in
each box first, then distribute the remaining `n − k` freely, giving `C(n − 1, k − 1)`.

**★ How do you handle constraints like "box 3 must have at least 2" or "box 1 has at most 5"?**
Lower bounds substitute away: set `yᵢ = xᵢ − Lᵢ`, reduce the total by `ΣLᵢ`, and apply the plain
formula to the shifted variables, which are still unbounded above. Upper bounds do not, because the
shifted variable would need a cap of its own — those need inclusion–exclusion over which variables
violate their limit: subtract the distributions in which `x₁ ≥ U₁ + 1` (a lower-bound problem again),
add back the ones where two variables both overflow, and so on. Recognising that lower bounds are
free and upper bounds cost an inclusion–exclusion is the useful half of the answer.

**★ Four ways to phrase "distribute n things into k boxes" give four different answers. What are
they?**
Distinct items into labelled boxes is `k^n` — each item picks a box independently. Identical items
into labelled boxes is stars and bars, `C(n + k − 1, k − 1)`. Distinct items into unlabelled boxes is
a sum of Stirling numbers of the second kind, with the recurrence
`S(n, j) = j·S(n−1, j) + S(n−1, j−1)` and no closed form. Identical items into unlabelled boxes is
the number of integer partitions of `n` into at most `k` parts, also with no closed form. The
practical value is the diagnosis: the moment the boxes are interchangeable, stop looking for a
binomial and write a DP — and say that is what you are doing, because it is the thing being tested.

**How does the multiset-combination formula relate to the "reuse allowed" backtracking search?**
They count the same objects. Choosing `k` items from `n` types with repetition and without regard to
order is `C(n + k − 1, k)`, and the search that enumerates exactly those is the combinations skeleton
recursing on `i` rather than `i + 1`, keeping the current type available for the subtree below it.
The start index in that search is what prevents the same multiset appearing in several orders, which
is precisely the order-irrelevance the formula assumes — so if the search's output count does not
match the formula, one of the two has an off-by-one, and it is usually the recursion using `i + 1`
by habit.

---

← Prev: [08b · Pascal's rule and the DP table](08b-pascals-rule-and-the-dp-table.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [08d · Catalan numbers](08d-catalan-numbers.md)
