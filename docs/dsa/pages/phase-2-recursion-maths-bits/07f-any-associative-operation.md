---
title: "Binary exponentiation never used numbers or commutativity — it used associativity and an identity, so the same eight lines raise a matrix to a power, compose a permutation a billion times, or run a min-plus product, and the only thing that changes is which side the accumulator stays on"
sidebar_label: "07f · Any associative operation"
sidebar_position: 7.5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. Monoids, associativity and the generalisation of the squaring schedule are
> **textbook mathematics, derived on this page rather than cited** — the phase's research bank
> records that binary exponentiation has no primary source. The JavaScript arithmetic caveats are
> the same MDN pages quoted on [07](07-fast-exponentiation-and-the-modular-inverse.md) and
> [07b](07b-modular-exponentiation-and-where-the-product-overflows.md). Java targets **JDK 25**;
> TypeScript first, Java second. **No sandbox run** — this page carries code, never program output.

**Go back through the derivation on [07](07-fast-exponentiation-and-the-modular-inverse.md) and
strike out every step that assumed a number: nothing is struck out.** The argument used exactly
two properties — that the operation is **associative**, so regrouping the product into powers of
two is legitimate, and that there is an **identity** to initialise the accumulator with. A set
with an associative operation and an identity is a *monoid*, and every monoid can be exponentiated
in `Θ(log n)` applications of its operation. That is not a curiosity: it is why one function
covers matrix powers, permutation iteration, shortest paths with exactly `k` edges, and
transformation composition, and why recognising the monoid in a problem is often the whole
insight the interviewer is waiting for.

## The generic form

```ts
// TypeScript — binary exponentiation over an arbitrary monoid
export function monoidPower<T>(x: T, n: number, op: (p: T, q: T) => T, identity: T): T {
  let result = identity;
  let base = x;
  let e = n;
  while (e > 0) {
    if (e % 2 === 1) result = op(result, base);
    base = op(base, base);
    e = Math.floor(e / 2);
  }
  return result;
}
```

```java
// Java — the same schedule, with the monoid supplied
static <T> T monoidPower(T x, long n, BinaryOperator<T> op, T identity) {
    T result = identity;
    T base = x;
    long e = n;
    while (e > 0) {
        if ((e & 1) == 1) result = op.apply(result, base);
        base = op.apply(base, base);
        e >>= 1;
    }
    return result;
}
```

🔴 **`op(result, base)` — the accumulator stays on the left, in both languages, always.** When the
operation is commutative the side is irrelevant and the habit costs nothing; when it is not, the
side is the difference between the answer and a different answer that looks equally plausible.
Fixing the convention once means the generic function is correct for every monoid you ever pass
it, rather than correct for the commutative ones and silently wrong for the others.

## The instantiations worth recognising

| Monoid | Operation | Identity | What `x^n` means |
|---|---|---|---|
| integers under `×` | multiplication | `1` | the ordinary power |
| integers mod `m` | multiply then reduce | `1` | [07b](07b-modular-exponentiation-and-where-the-product-overflows.md) |
| `k × k` matrices | matrix product | the identity matrix | [12 · Matrix exponentiation](12-matrix-exponentiation.md) |
| permutations of `n` items | composition | the identity permutation | applying a shuffle `n` times |
| functions `S → S` | composition | `x => x` | iterating a state transition |
| min-plus matrices | `min` of sums | `0` on the diagonal, `∞` elsewhere | shortest path using exactly `k` edges |
| strings | concatenation | `""` | a string repeated `n` times |
| booleans | `&&` or `\|\|` | `true` / `false` | reachability closure |

**Matrix multiplication** turns a `k`-term linear recurrence into `Θ(k³ log n)` work instead of
`Θ(kn)`, which is the entire content of topic 12. **Function composition** makes "apply this
permutation `n` times" cost `Θ(size · log n)` rather than `Θ(size · n)` — though note the special
structure: a permutation decomposes into cycles, and once you have the cycles, `n mod cycleLength`
answers it in `Θ(size)`, which beats the generic method. That is worth saying out loud in an
interview, because reaching for the general tool when the specific structure is right there is the
mistake the question is probing for. **Min-plus product** replaces `(+, ×)` with `(min, +)`, and
because that pair is also associative with an identity, the same schedule computes shortest paths
with exactly `k` edges; it is the cleanest example of the generalisation paying off in a place
nobody expects.

## When the identity is awkward

Some operations are associative but have no natural identity — a semigroup rather than a monoid.
Matrix `min-plus` has one only if you admit `∞`; a "combine two intervals" operation may have
none at all. Two fixes, and the first is almost always right:

1. **Invent the identity** as a sentinel the operation treats correctly — `∞` for `min`, an empty
   interval, `null` with a guard in `op`. This keeps the loop exactly as written.
2. **Seed the accumulator with the first factor** instead: consume one bit before the loop, start
   `result = base`, and require `n ≥ 1`. This avoids the sentinel but adds a precondition the
   caller has to honour, and `n = 0` now has no answer rather than the natural one.

⚠️ **The sentinel must satisfy the identity law under your `op`, not merely look like a blank.**
`null` combined with a value must return that value, and if `op` throws or returns `null` instead,
`x^0` and every subsequent accumulate is wrong — silently, because the loop never inspects the
accumulator.

## What it does *not* need

**Commutativity.** Never used. The regrouping in the derivation only ever moves parentheses, never
reorders factors.

**Invertibility.** Never used, which is why this works for `min-plus` and for boolean-`&&` monoids
where nothing has an inverse.

**A finite set, or numbers at all.** The `Θ(log n)` count is a count of *applications of `op`*. The
cost in real terms is `log n` times the cost of one `op` — cheap for a number, `Θ(k³)` for a `k × k`
matrix, `Θ(size)` for a permutation. Quote the bound as "about `2 log₂ n` applications of the
operation" and let the operation's own cost be a separate factor; that phrasing is what keeps the
matrix case honest.

## Gotchas

**★ Symptom: a matrix or permutation "power" produces the transpose, the inverse, or an unrelated
result.** Cause: the accumulator changed sides — `op(base, result)` in one branch and
`op(result, base)` in another, or a refactor that swapped them. Fix: fix the convention once and
apply it everywhere; for a non-commutative operation the two are genuinely different functions,
and there is no test on a symmetric input that will tell them apart.

**★ Symptom: `x^0` returns garbage, `null`, or throws, while every positive exponent is right.**
Cause: the identity supplied is not an identity under the given `op`. Fix: check the law directly
— `op(identity, x)` and `op(x, identity)` must both be `x` — before trusting the function; it is a
two-line check and it is the only part of the generic version that a caller can get wrong.

**★ Symptom: the generic version is dramatically slower than the numeric one for the same
exponent.** Cause: the bound is `Θ(log n)` *applications of `op`*, and `op` is not `Θ(1)` — a
`k × k` matrix product is `Θ(k³)`, so the real cost is `Θ(k³ log n)`. Fix: state the bound with the
operation's cost as an explicit factor rather than saying "logarithmic", which is the claim an
interviewer will push back on.

**★ Symptom: iterating a permutation `n` times with `monoidPower` is correct but needlessly slow.**
Cause: the general tool applied where specific structure exists. Fix: decompose into cycles and
reduce `n` modulo each cycle's length — `Θ(size)` after the decomposition, against
`Θ(size · log n)`. Recognising this is usually the point of the question.

**Symptom: the boolean or `min-plus` instantiation overflows or saturates.** Cause: `∞` modelled
as a large finite number that is then *added* to another large finite number inside the min-plus
product. Fix: use a sentinel with a guard (`if (a === INF || b === INF) return INF`) rather than a
number chosen to be "big enough" — the addition is what breaks it, not the comparison.

**Symptom: the generic function is correct in TypeScript and wrong in Java for large `n`.** Cause:
`n` typed as `int` and the shift or the loop counter overflowing, or `e >>= 1` applied to a
negative `n`. Fix: take the exponent as `long`, reject negative exponents explicitly, and remember
that `>>` on a negative value keeps the sign bit and never terminates the loop — `>>>` or an
up-front guard.

## Interview questions

**★ Why does the same algorithm work for matrices, and what does it need from the operation?**
Because the derivation only ever regrouped a product, and regrouping is legitimate for anything
associative. It needs associativity, so that `x^(2k)` really is `(x^k) · (x^k)`, and an identity to
start the accumulator so that `x^0` has an answer. Commutativity is *not* needed and is not
available for matrices, which is why the implementation has to keep the accumulator on one side —
`result = op(result, base)` throughout. Everything else transfers unchanged, including the
`about 2 log₂ n` count; what changes is the cost of a single application, so a `k × k` matrix power
is `Θ(k³ log n)`.

**★ Give an operation that is associative but has no identity, and say what you do about it.**
`min` over a set with no `+∞`, or "merge two overlapping intervals" where an empty interval is not
a legal value. Two options: invent a sentinel identity and teach `op` to handle it, which keeps the
loop unchanged and is what almost everyone does; or seed the accumulator with the base and consume
one bit up front, which avoids the sentinel at the price of requiring `n ≥ 1`. The trap in the
first option is supplying something that looks blank but does not satisfy `op(identity, x) === x`,
in which case `x^0` and every accumulate after it is silently wrong.

**★ You need to apply a permutation of 10⁵ elements 10¹⁸ times. What is your complexity?**
`Θ(size)` after decomposing into cycles — not the `Θ(size · log n)` the generic method gives. Each
element returns to itself after its own cycle length, so applying the permutation `n` times moves
each element forward `n mod len` positions within its cycle, and one pass finds the cycles. The
binary-exponentiation answer is correct and is the right instinct to voice first; the follow-up
they want is that a permutation has structure a general monoid does not, and using it removes the
`log n` entirely.

**★ How would you compute the number of paths of exactly `k` edges between two vertices?**
Raise the adjacency matrix to the `k`-th power with this schedule and read the entry — the
`(i, j)` entry of `A^k` counts the walks of length exactly `k`, because matrix multiplication is
exactly "sum over intermediate vertices of the product of counts", which is the recurrence the
walks satisfy. Cost `Θ(V³ log k)`. Swapping `(+, ×)` for `(min, +)` in the same code turns the
count into a shortest path using exactly `k` edges, which is the same monoid argument applied to a
different pair of operations — and it is the cleanest demonstration that the algorithm never cared
about arithmetic.

**Why must the accumulator stay on the same side, and how would a test miss it?**
Because for a non-commutative operation `op(result, base)` and `op(base, result)` compute different
functions, and both are `Θ(log n)` and both terminate. A test misses it whenever the input happens
to be symmetric — the identity matrix, a symmetric adjacency matrix, an involution, `n = 1`, `n` a
power of two so only one accumulate ever runs. The reliable check is a deliberately asymmetric
`2 × 2` matrix at an exponent with at least two set bits, such as `n = 3` or `n = 5`.

**Is the exponent's own representation ever the bottleneck?**
It can be. The bound is about `2 log₂ n` applications *of `op`*, but if the exponent is itself a
big integer — a `BigInt`, or a `BigInteger` in a cryptographic setting — then `e % 2` and
`e / 2` are not `Θ(1)`, and the loop pays for the exponent's arithmetic as well. In that setting
you iterate over the exponent's bits directly rather than repeatedly halving it, which is what the
platform `modPow` implementations do.

---

← Prev: [07e · Binomials under a modulus](07e-binomial-coefficients-under-a-modulus.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [08 · Counting: the two principles](08-combinatorics-for-counting-problems.md)
