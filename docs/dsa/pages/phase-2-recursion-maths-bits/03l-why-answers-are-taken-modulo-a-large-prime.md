---
title: "Counting answers outgrow a 64-bit integer somewhere around twenty-one factorial, so problems ask for the answer modulo a fixed number — and the modulus is chosen prime because that is what makes every non-zero residue invertible, and chosen near a billion because that is what keeps the product of two residues inside a signed 64-bit integer"
sidebar_label: "03l · Why modulo a large prime"
sidebar_position: 3.11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against
> [MDN's `Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)
> and the **JDK 25**
> [`java.lang.Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)
> javadoc, both quoted verbatim below. ⛔ The choice of `10^9 + 7` is a **competition and interview
> convention, not a specification**, and is stated as such here — the research bank for this phase
> is explicit that it must not be attributed to any standard. That `Z/pZ` is a field for prime `p`
> is textbook mathematics, derived below. **No sandbox run**; every numeric bound below is
> arithmetic performed in the text.

**"Report the answer modulo 10^9 + 7" is not a formatting request, it is the problem statement
admitting that the real answer does not fit in a machine word — and both halves of that constant
are engineering decisions you should be able to justify.** Counting answers grow factorially or
exponentially: `20!` is about `2.43 × 10^18` and fits a signed 64-bit integer, `21!` is about
`5.11 × 10^19` and does not. Rather than force every solution into arbitrary precision, the problem
fixes a modulus and asks for the residue. **Prime** is chosen because it makes `Z/pZ` a *field* —
every non-zero residue has a multiplicative inverse — which is the only reason binomial
coefficients, probabilities and expected values can be computed at all under a modulus. **Near a
billion** is chosen because the product of two residues is then near `10^18`, which is comfortably
inside a signed 64-bit integer and catastrophically outside JavaScript's exactly-representable
integer range. This page is those two justifications, and the things a modulus destroys that people
forget it destroys.

## Why the answer does not fit

Take the storefront: "how many distinct orders of these 21 line items are there?" The answer is
`21!`, which is about `5.11 × 10^19`. A signed 64-bit integer tops out just above `9.22 × 10^18`, so
the answer overflows — and Java's `*` does not say so. The same shape appears everywhere counting
does: the number of subsets of an `n`-element catalogue filter is `2^n`, which passes 64 bits at
`n = 63`; the number of monotone paths through an `n × n` grid is `C(2n, n)`, which passes it around
`n = 33`; Catalan numbers grow like `4^n`.

The alternatives are arbitrary precision — `BigInteger`, `BigInt` — which works, is slower for
reasons of mechanism rather than measurement (an arbitrary-precision multiply is not a register
instruction), and makes the answer awkward to check automatically; or a fixed modulus, where every
intermediate is bounded, every operation is a machine instruction, and the expected output is a
single number in a known range. Interview and competition problems pick the second, universally.

⛔ It is a **convention**, not a rule from any specification. `10^9 + 7` and `998244353` are simply
the two constants that got adopted.

## Why prime

Two properties, and both matter.

**Every non-zero residue is invertible.** If `p` is prime and `0 < a < p`, then `gcd(a, p) = 1` —
the only divisors of `p` are `1` and `p`. By Bézout there are `x`, `y` with `a·x + p·y = 1`, so
`a·x ≡ 1 (mod p)`, and `x` is `a`'s inverse. That makes `Z/pZ` a **field**: you can divide by
anything non-zero. Since
[03j](03j-modular-arithmetic-and-the-remainder-trap.md) showed that integer division does not
survive reduction, this is the *only* form division takes under a modulus, and without it a binomial
coefficient — a quotient of factorials — cannot be computed modularly at all.

Primality is also the precondition for Fermat's little theorem, which gives the inverse as
`a^(p−2) mod p` and is the fastest way to get one when you are already computing powers; see
[07d · The modular inverse](07d-the-modular-inverse.md).

**There are no zero divisors.** For prime `p`, `a·b ≡ 0 (mod p)` implies `a ≡ 0` or `b ≡ 0` — that
is Euclid's lemma. A composite modulus does not have this: modulo 12, `3 · 4 ≡ 0` with neither
factor zero. The consequence people actually rely on is that a non-zero polynomial of degree `d` has
at most `d` roots modulo a prime, which is what bounds the collision probability of a polynomial
rolling hash. Over a composite modulus that bound is simply false, and a rolling hash modulo `2^64`
(which is what unsigned wraparound gives you) has known adversarial collisions.

**What a composite modulus breaks, concretely.** Choose `M = 10^9` — which is `2^9 · 5^9` — and no
even number has an inverse, so `C(n, k) mod M` cannot be computed by the factorial method for any
`k` whose factorials contain a factor of 2, which is all of them above 1.

## Why near a billion, and not larger

The binding constraint is the **product of two residues**. Every modular multiplication forms
`a · b` before reducing, with `a, b < M`, so the intermediate is up to about `M²`.

- **Java `long`** holds up to `2^63 − 1 ≈ 9.22 × 10^18`. With `M ≈ 10^9`, `M² ≈ 10^18`, which fits
  with an order of magnitude to spare. The largest modulus that still fits is around
  `√(2^63) ≈ 3.04 × 10^9`, so `10^9 + 7` sits deliberately below the cliff.
- **Java `int`** holds up to `2^31 − 1`, documented as such:

  > *"A constant holding the maximum value an `int` can have, 2^31-1."* — JDK 25, `Integer.MAX_VALUE`

  `10^9 + 7` fits in an `int`; the *product* of two of them does not, by nine orders of magnitude.
  This is why every modular routine in Java declares `long` even when the residues are `int`-sized.

- 🔴 **JavaScript `number`** does not fit the product at all:

  > *"Double precision floating point format only has 52 bits to represent the mantissa, so it can
  > only safely represent integers between -(2^53 – 1) and 2^53 – 1."* — MDN, `Number.MAX_SAFE_INTEGER`

  `2^53 − 1` is `9007199254740991`, about `9.01 × 10^15`. A product near `10^18` is roughly a
  hundred times past it, and nothing throws — the value is silently rounded. MDN's own illustration
  of what that means:

  > *"For example, `Number.MAX_SAFE_INTEGER + 1 === Number.MAX_SAFE_INTEGER + 2` will evaluate to
  > true, which is mathematically incorrect."* — MDN, `Number.MAX_SAFE_INTEGER`

  Working backwards: a modulus small enough that `M²` stays exactly representable must satisfy
  `M ≤ √(2^53) ≈ 94906265`. So a modulus below about `9.49 × 10^7` is safe for plain `number`
  arithmetic and `10^9 + 7` is not. What to do instead is
  [07b · Modular exponentiation and where the product overflows](07b-modular-exponentiation-and-where-the-product-overflows.md).

**The two conventional constants.** `10^9 + 7` is prime and just above `2^30`. `998244353` is prime
and equals `119 · 2^23 + 1`, so `p − 1` is divisible by `2^23`; that is what gives it primitive
roots of unity of order `2^k` for `k` up to 23, which is what a number-theoretic transform needs.
If a problem specifies `998244353` rather than `10^9 + 7`, that is usually the reason.

## What the modulus destroys

Reducing throws information away, and three things stop working:

- **Order.** `a < b` says nothing about `a mod M` and `b mod M`. You cannot take a maximum, sort, or
  run any comparison-based dynamic programme on modular values. A DP that *maximises* must carry the
  real value (or its logarithm); only a DP that *counts* may be reduced.
- **Zero-testing.** A residue of `0` means the true answer is a multiple of `M`, which includes but
  is not limited to zero. "There are no valid configurations" cannot be read off a modular result.
- **Exact reporting.** If the caller wants the number, not the number mod something, the modulus is
  the wrong tool and arbitrary precision is the right one.

## Gotchas

**★ Symptom: a maximising dynamic programme returns nonsense once the values get large.** Cause: the
DP values were reduced modulo `M`, and `max` is not defined on residue classes — reduction destroys
order. Fix: only *counting* recurrences may be reduced. For a maximisation, keep the true value in a
`long` / `BigInt`, or maximise a monotone transform such as the logarithm, and reduce only if the
final answer happens to be a count.

**★ Symptom: `C(n, k) mod M` comes out wrong or the inverse computation throws, and `M` is
`1000000000` or `2^32`.** Cause: the modulus is composite, so most residues have no inverse — modulo
`10^9 = 2^9 · 5^9`, no even number is invertible. Fix: use a prime modulus. If the modulus is
imposed and composite, the factorial method does not apply; factor the modulus, work modulo each
prime power, and recombine with [03e](03e-the-chinese-remainder-theorem.md), or use a
Pascal's-triangle recurrence, which needs only addition.

**★ Symptom: in TypeScript, a modular product is off by a small amount and no error was raised.**
Cause: `a * b` with `a, b` near `10^9` is near `10^18`, about a hundred times past `2^53 − 1`, so it
is rounded rather than computed. Fix: `BigInt`, or a modulus below `94906265`, or a
multiplication-by-doubling routine — all three are
[07b](07b-modular-exponentiation-and-where-the-product-overflows.md). ⚠️ The distinguishing symptom
is that the answer is *close* to right: JavaScript rounds, where Java wraps to something unrelated.

**★ Symptom: a modulus larger than about `3 × 10^9` is chosen and the Java `long` answers go
negative.** Cause: `M² > 2^63 − 1`, so the product overflows before the reduction. Fix: keep the
modulus below `√(2^63)`, or use `Math.multiplyHigh`-style 128-bit techniques, or `BigInteger`. The
conventional constants sit below the cliff for exactly this reason.

**★ Symptom: the code concludes "no solutions exist" because the answer is `0`.** Cause: a residue
of zero means the true count is a multiple of `M`, not that it is zero. Fix: if the distinction
matters, the modulus is the wrong representation — compute exactly, or carry a separate boolean
"any solution at all", which a counting DP can maintain alongside the residue at no extra cost.

**Symptom: two different problems are answered with the same rolling hash and one is attacked.**
Cause: a single modulus, especially a non-prime one such as implicit `2^64` wraparound. Fix: a
random prime modulus chosen at run time, or two independent prime moduli compared together — the
collision probability multiplies, and the polynomial-root bound that justifies it needs the modulus
to be prime.

**Symptom: the final answer is negative.** Cause: not this page's — a subtraction and `%`'s sign
rule. Fix: [03k · The remainder trap](03k-the-remainder-trap-in-indices-hashes-and-shards.md). It is
worth listing here because "answer modulo `10^9+7`" problems are precisely where it surfaces, and a
judge rejects `-3` even though it is congruent to the right value.

## Interview questions

**★ Why do counting problems ask for the answer modulo a large number?**
Because the answer does not fit. Counting answers grow factorially or exponentially — `21!` is about
`5.11 × 10^19` against a signed 64-bit ceiling of about `9.22 × 10^18`, and `2^n` passes that at
`n = 63`. The alternatives are arbitrary precision, which works but is slower by mechanism and
awkward to check, or a fixed modulus, under which every intermediate is bounded, every operation is
a single machine instruction, and the expected output is one number in a known range. It is a
convention rather than anything standardised, and the two constants that got adopted are `10^9 + 7`
and `998244353`.

**★ Why is the modulus prime?**
So that every non-zero residue has a multiplicative inverse, which makes `Z/pZ` a field. For prime
`p` and `0 < a < p`, `gcd(a, p) = 1`, so Bézout gives `a·x + p·y = 1` and hence `a·x ≡ 1 (mod p)`.
That matters because integer division does not survive reduction at all, so multiplication by an
inverse is the only division there is — and a binomial coefficient is a quotient of factorials.
Primality is also the precondition for Fermat's little theorem, which supplies the inverse as
`a^(p−2)`. The second reason is the absence of zero divisors: modulo a prime, `ab ≡ 0` forces `a ≡ 0`
or `b ≡ 0`, which is what bounds the collision probability of a polynomial hash. Modulo 12,
`3 · 4 ≡ 0` with neither factor zero, and that bound evaporates.

**★ Why `10^9 + 7` specifically, and not something much larger?**
Because the binding constraint is the product of two residues, not the residues themselves. Every
modular multiply forms `a · b` with both below `M`, so the intermediate reaches about `M²`. With
`M ≈ 10^9` that is about `10^18`, comfortably inside a signed 64-bit integer's `9.22 × 10^18`. The
largest modulus that still fits is around `3.04 × 10^9`, so `10^9 + 7` sits deliberately below the
cliff with room to spare. It is also prime, and it fits in a 32-bit `int` even though its square
does not — which is why Java modular code declares `long` throughout.

**★ What breaks if you use `10^9 + 7` in JavaScript?**
The multiplication. `a * b` with both operands near `10^9` produces about `10^18`, and MDN documents
that a double can only represent integers exactly up to `2^53 − 1`, which is about
`9.01 × 10^15` — roughly a hundred times smaller. Nothing throws; the product is rounded, and
`% MOD` of a rounded value is a wrong answer that is *close* to right, which is much harder to spot
than Java's wrap. Three fixes: switch to `BigInt`, whose only cost is that it cannot be mixed with
`number`; use a modulus below `√(2^53) ≈ 94906265`, if the problem lets you choose; or implement
multiplication by repeated doubling so no intermediate exceeds `2M`.

**★ Can you take a maximum of two values that are stored modulo `M`?**
No. Reduction destroys order — `a < b` implies nothing about their residues — so `max`, `min`,
sorting and any comparison-based recurrence are all invalid on modular values. This is the clean
dividing line: a DP that *counts* may be reduced at every step, because counting uses only `+` and
`×`, which the ring supports; a DP that *maximises* must carry real values. Two related losses are
worth naming: a residue of zero does not mean the true answer is zero, only that it is a multiple of
`M`; and if the caller wants the number rather than the number modulo something, the modulus is
simply the wrong representation.

**What is `998244353` and why would a problem choose it over `10^9 + 7`?**
It is prime and equals `119 · 2^23 + 1`, so `p − 1` is divisible by `2^23`. That means `Z/pZ` has
primitive roots of unity of order `2^k` for every `k` up to 23, which is exactly what a
number-theoretic transform needs to do convolution in `Θ(n log n)` over the integers modulo `p`.
`10^9 + 7` has no such structure. So a problem specifying `998244353` is usually one whose intended
solution involves polynomial multiplication.

**If the modulus is imposed and composite, what do you do?**
Not the factorial method, because the inverses it needs may not exist. Two routes. Factor the
modulus into prime powers, solve the problem modulo each, and recombine with the Chinese remainder
theorem — which is what [03e](03e-the-chinese-remainder-theorem.md) is for, and which requires the
prime powers to be pairwise coprime, as they are by construction. Or avoid division entirely: a
Pascal's-triangle recurrence for binomial coefficients uses only addition, so it works modulo
anything at all, at `Θ(n²)` time and `Θ(n)` space if you keep one row.

{/* FOOTER */}
