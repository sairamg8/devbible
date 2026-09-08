---
title: "For a recurrence somebody has already studied there is usually an identity cheaper than the general matrix — Fibonacci has fast doubling, which is three multiplications per step instead of eight — and it also has Binet's formula, which is exact mathematics and a wrong program"
sidebar_label: "12e · Fast doubling, and not Binet"
sidebar_position: 12.4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08. The fast-doubling identities are **derived on this page** by squaring the
> closed form for `M^n` from [12](12-matrix-exponentiation.md); nothing is cited for them. The
> JavaScript exactness limit behind the Binet argument is quoted verbatim from MDN,
> [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER).
> ⚠️ Whether 5 is a quadratic residue modulo any particular prime is **not** claimed here — it is
> stated as a condition to check, because I could not settle it for `10^9 + 7` without computing it.
> **No sandbox run**; the index near which Fibonacci passes `2^53 − 1` is derived from the growth
> rate `φ^n/√5`, not read from a table.
> Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**The general matrix construction is what you use for a recurrence nobody has named. Fibonacci has
been named rather thoroughly, and it has two well-known alternatives — one that is strictly better
than the matrix and one that is a trap.** Knowing both, and being able to say which is which and
why, is a more useful answer than either the matrix or the formula on its own.

## Fibonacci specifically: fast doubling beats the general machinery

The closed form for the power in [12](12-matrix-exponentiation.md),
`M^n = [[F(n+1), F(n)], [F(n), F(n-1)]]`, can be squared symbolically once and for all. Take
`M^(2k) = (M^k)²` and read the entries:

```
[ F(k+1)  F(k)   ]²    top-left  = F(k+1)² + F(k)²
[ F(k)    F(k-1) ]     top-right = F(k+1)·F(k) + F(k)·F(k-1)
```

The top-left is `F(2k+1)`. The top-right is `F(2k)`, and it simplifies: factor out `F(k)` to get
`F(k)·(F(k+1) + F(k-1))`, then substitute `F(k-1) = F(k+1) - F(k)` to get:

```
F(2k)   = F(k) · ( 2·F(k+1) − F(k) )
F(2k+1) = F(k)² + F(k+1)²
```

Two identities, computed with three multiplications per doubling instead of the eight a 2×2 matrix
multiplication needs, and no matrix type at all:

```ts
// returns [F(n), F(n+1)]
export function fib(n: bigint): [bigint, bigint] {
  if (n === 0n) return [0n, 1n];
  const [a, b] = fib(n / 2n);              // a = F(m), b = F(m+1), m = floor(n/2)
  const c = a * (2n * b - a);              // F(2m)
  const d = a * a + b * b;                 // F(2m+1)
  return (n % 2n === 0n) ? [c, d] : [d, c + d];
}
```

Same `Θ(log n)`, smaller constant, less code to get wrong. **The lesson generalises past Fibonacci:
when a specific recurrence has been studied, a specialised identity usually beats the general
matrix.** The general matrix is what you reach for when the recurrence is one nobody has named.

## Why Binet's formula is not the answer

```
F(n) = ( φ^n − ψ^n ) / √5        with φ = (1+√5)/2,  ψ = (1−√5)/2
```

It is exact mathematics and a poor program, for three separate reasons.

**Floating point.** MDN:

> *"Double precision floating point format only has 52 bits to represent the mantissa, so it can only safely represent integers between -(2^53 – 1) and 2^53 – 1. 'Safe' in this context refers to the ability to represent integers exactly and to compare them correctly."*

`F(n)` grows like `φ^n/√5`, so setting `φ^n/√5 = 2^53 − 1` and solving gives `n ≈ 78` — past which
the *correct answer itself* is not representable, let alone the irrational intermediates. And the
intermediates degrade earlier than the result does, because `φ^n` is computed from a rounded `√5`
and the error compounds with every multiplication.

**No modulus.** Interview and contest versions of this problem ask for `F(n) mod p` for `n` around
`10^18`. Binet cannot be evaluated modulo `p` unless `5` has a square root in the field — that is, `5`
is a quadratic residue mod `p` — and then you need a modular square root and modular powers of `φ`
anyway. ⚠️ **Whether that holds for `10^9 + 7` specifically is not claimed here**; the point is that
it is a condition to check rather than a free move, and checking it costs more than writing the
matrix power.

**It answers a smaller question.** Binet is Fibonacci-only. The matrix construction handles any
linear recurrence you are handed, which is what an interviewer is testing. Mentioning Binet as an
exact closed form and then explaining why you will not use it is a strictly better answer than not
knowing it — but proposing it as the implementation is the trap.

## The addition formula, which fast doubling is a special case of

Fast doubling is one instance of a more general identity, and deriving the general one takes the same
two lines. Split the exponent: `M^(m+n) = M^m · M^n`. Read entry `[0][1]` of both sides using
`M^n = [[F(n+1), F(n)], [F(n), F(n-1)]]` from [12](12-matrix-exponentiation.md):

```
left  : (M^(m+n))[0][1] = F(m+n)
right : (M^m · M^n)[0][1] = F(m+1)·F(n) + F(m)·F(n-1)
```

```
F(m+n) = F(m+1)·F(n) + F(m)·F(n-1)
```

Set `m = n = k` and it collapses to the doubling identity already derived:
`F(2k) = F(k+1)F(k) + F(k)F(k-1) = F(k)·(F(k+1) + F(k-1))`. **Every Fibonacci identity you have seen
is a matrix identity read off in coordinates**, which is a better way to hold them than as a list.

That includes the divisibility results — `gcd(F(m), F(n)) = F(gcd(m, n))` is the well-known one,
provable from the addition formula plus Euclid's algorithm. ⚠️ I state it here **without proving it**;
the induction is longer than this page has room for, and an unproved identity should be labelled as
such rather than presented as derived.

## Fibonacci modulo m is periodic, and you can prove it in three lines

Working modulo `m`, the state is the pair `(F(n), F(n+1)) mod m`, and there are only `m²` such pairs.
So within `m² + 1` steps some pair repeats — pigeonhole. **And the first repeat must be the starting
pair `(0, 1)`**, because the transition is invertible: `det(M) = 1·0 − 1·1 = −1`, which has an inverse
modulo every `m`, so each state has exactly one predecessor and the sequence cannot enter a cycle
part-way and leave a tail behind it. Therefore the sequence of residues is **purely periodic**, with
period at most `m²`.

That period is the Pisano period. ⚠️ **No specific period value is quoted here** — the general bound
`m²` is what the argument gives, and individual values would have to be computed.

The practical consequence is a mild one, and worth stating honestly: knowing the sequence is periodic
does not usually help, because *finding* the period costs as much as walking the sequence, and fast
doubling already answers `F(n) mod m` in `Θ(log n)`. The periodicity matters when you need the answer
for very many different `n` against the same small `m`, where one pass to find the period turns every
query into an array lookup.

## Gotchas

**★ Symptom: a Binet implementation is exact for small inputs and wrong from the high seventies on.**
Cause: `F(n)` passes `2^53 − 1` around `n = 78`, and doubles represent integers exactly only up to
that point; the irrational intermediates are inexact earlier still. Fix: use the matrix power or fast
doubling with `BigInt` / a modulus. Binet is a closed form to *cite*, not to run.

**Symptom: fast doubling recurses forever or returns wrong values for odd `n`.** Cause: the recursion
returns the pair `[F(m), F(m+1)]` and the odd branch must return `[d, c + d]`, not `[c, d]` — the
pairing shifts. Fix: label the returned pair in a comment and verify `n = 1, 2, 3` by hand; the
identities are easy and the bookkeeping is where this goes wrong.

**★ Symptom: fast doubling is slower than the matrix version in a `BigInt` implementation.** Cause:
the recursion recomputes, or the pair is being rebuilt as arrays on every call. Fix: the identity
count is three multiplications per doubling against eight for a 2×2 matrix multiply, so the arithmetic
is not the problem — the allocation around it is. Return a tuple and avoid building intermediate
matrices; this is stated as mechanism, with no measurement offered.

**Symptom: a modular fast-doubling implementation returns a negative value.** Cause:
`2n * b - a` can go negative before the reduction when the values are already reduced residues, and
`%` is a remainder that keeps the sign of the dividend in both languages
([03j](03j-modular-arithmetic-and-the-remainder-trap.md)). Fix: normalise the subtraction —
`((2n*b - a) % MOD + MOD) % MOD`, or `Math.floorMod` in Java — at that one expression.

**★ Symptom: a "reduce `n` modulo the Pisano period first" optimisation gives wrong answers.** Cause:
the period was assumed rather than computed, or computed for a different modulus than the one in use.
Fix: the periodicity argument gives only a bound of `m²`; the actual period must be found by walking
the sequence until the pair `(0, 1)` recurs, and it must be found for exactly the modulus you are
using. Unless you have many queries against one small `m`, skip the optimisation and use fast
doubling.

## Interview questions

**★ Is there anything cheaper than the matrix for Fibonacci specifically?**
Yes — fast doubling. Squaring the closed form `M^n = [[F(n+1), F(n)], [F(n), F(n-1)]]` symbolically
gives `F(2k) = F(k)·(2F(k+1) − F(k))` and `F(2k+1) = F(k)² + F(k+1)²`, so a doubling step is three
multiplications of integers instead of the eight a 2×2 matrix multiplication needs, with no matrix
type at all. Same `Θ(log n)` class, smaller constant, less code to get wrong. The general lesson is
worth stating: for a named recurrence there is usually a specialised identity, and the general matrix
is what you use for the recurrences nobody has named.

**★ Why not use Binet's formula?**
Three reasons, and the first is enough. Doubles represent integers exactly only up to `2^53 − 1`, and
`F(n)` — growing like `φ^n/√5` — passes that around `n = 78`, with the irrational intermediates
degrading earlier because `φ^n` is computed from a rounded `√5`. Second, these problems are asked
modulo a prime for `n` near `10^18`, and Binet needs a square root of 5 in that field, which is an
extra condition to verify and then a modular square root to compute. Third, it only solves Fibonacci,
while the matrix construction solves any linear recurrence you are handed. Naming it and rejecting it
is a better answer than not knowing it.

**Does fast doubling generalise to other recurrences?**
Not directly — the identities came from squaring Fibonacci's specific closed form, and a different
recurrence has a different closed form for its matrix powers, if it has a usable one at all. What
generalises is the *method*: take `M^(2k) = (M^k)²`, write out the entries symbolically, and see
whether they simplify into a small number of scalar identities. When they do you get a cheaper
algorithm; when they do not, the general matrix power is already the answer, and there is nothing
lost by having tried.

**★ Prove that `F(n) mod m` is periodic.**
The pair `(F(n), F(n+1)) mod m` determines the whole future of the sequence, and there are only `m²`
such pairs, so by pigeonhole some pair repeats within `m² + 1` steps. To get *pure* periodicity —
returning to the start rather than to some later point — note that the transition matrix has
determinant `1·0 − 1·1 = −1`, which is invertible modulo every `m`, so every state has exactly one
predecessor and the sequence cannot have a pre-period tail. Hence it is purely periodic with period at
most `m²`. That is the Pisano period. The honest follow-up is that this rarely helps: finding the
period costs a walk of the sequence, and fast doubling already gives `F(n) mod m` in `Θ(log n)`.

{/* FOOTER */}
