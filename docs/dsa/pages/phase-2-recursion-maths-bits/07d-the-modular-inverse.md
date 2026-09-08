---
title: "Division under a modulus is multiplication by an inverse, and there are two ways to get one — Fermat's little theorem gives a^(p-2) in one line if the modulus is prime, the extended Euclidean algorithm gives it for any modulus coprime to the value, and the Fermat route returns 0 without complaint for the one input that has no inverse at all"
sidebar_label: "07d · The modular inverse"
sidebar_position: 7.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the **JDK 25**
> [`java.math.BigInteger`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/math/BigInteger.html)
> javadoc (`modInverse`, `modPow`), quoted verbatim below with its documented `ArithmeticException`
> conditions. Fermat's little theorem, Euler's theorem, the batch-inversion trick and the linear
> inverse table are **textbook mathematics, derived on this page rather than cited** — the research
> bank for this phase records that they have no primary source to quote. **No sandbox run.**

**[03j](03j-modular-arithmetic-and-the-remainder-trap.md) showed that integer division does not
survive reduction; this page is what replaces it.** The modular inverse of `a` is the residue `a⁻¹`
with `a · a⁻¹ ≡ 1 (mod m)`, and dividing by `a` means multiplying by it. Everything downstream —
binomial coefficients, probabilities, expected values, averages reported modulo a prime — is a
consumer. Two routes produce it. Fermat's little theorem gives `a⁻¹ ≡ a^(p−2) (mod p)` in a single
call to the `powMod` of [07b](07b-modular-exponentiation-and-where-the-product-overflows.md), and is
what you write when the modulus is the conventional prime. The extended Euclidean algorithm of
[03d](03d-the-extended-euclidean-algorithm-and-bezout.md) gives it for **any** modulus coprime to
`a`, prime or not. The trap is that the Fermat route has two preconditions and enforces neither: it
returns a wrong answer for a composite modulus, and it returns `0` — silently, plausibly — for the
one value that has no inverse.

## Existence

`a` has an inverse modulo `m` **if and only if** `gcd(a, m) = 1`. Both directions are Bézout, and
[03d](03d-the-extended-euclidean-algorithm-and-bezout.md) proves them: if the gcd is 1 there are
`x`, `y` with `a·x + m·y = 1`, so `a·x ≡ 1 (mod m)`; conversely if `a·x ≡ 1 (mod m)` then
`a·x − m·k = 1` for some `k`, and any common divisor of `a` and `m` divides 1.

When `m` is prime, every `a` in `1 … m−1` is automatically coprime to it, so **every non-zero
residue is invertible** — that is what makes `Z/pZ` a field, and it is the reason
[03l](03l-why-answers-are-taken-modulo-a-large-prime.md) says the modulus is chosen prime.

## Fermat's little theorem

**Statement.** If `p` is prime and `p` does not divide `a`, then `a^(p−1) ≡ 1 (mod p)`.

**Proof, in four lines.** Consider the map `x ↦ a·x` on the non-zero residues `{1, 2, …, p−1}`. It
lands inside that set, because `p` is prime and so `a·x ≡ 0` would force `p | a` or `p | x`, neither
of which holds. It is injective, because `a·x ≡ a·y` implies `p | a(x−y)` implies `p | (x − y)`. An
injective map from a finite set to itself is a bijection, so the multiset `{a·1, a·2, …, a·(p−1)}`
is a permutation of `{1, 2, …, p−1}`. Multiply everything together:

```
a^(p−1) · (p−1)!  ≡  (p−1)!   (mod p)
```

`(p−1)!` is a product of non-zero residues, so it is non-zero modulo the prime `p` and can be
cancelled, leaving `a^(p−1) ≡ 1`.

**The inverse falls out.** `a · a^(p−2) = a^(p−1) ≡ 1`, so

```
a⁻¹ ≡ a^(p−2)   (mod p)
```

```ts
// TypeScript — the one-liner, for a PRIME modulus and a not divisible by it
export function inverseFermat(a: bigint, p: bigint): bigint {
  const r = ((a % p) + p) % p;
  if (r === 0n) throw new RangeError("0 has no inverse");   // 🔴 or powModBig returns 0n, silently
  return powModBig(r, p - 2n, p);
}
```

```java
// Java — the same, over long, using the powMod of 07b
static long inverseFermat(long a, long p) {
    long r = Math.floorMod(a, p);
    if (r == 0L) throw new ArithmeticException("0 has no inverse mod " + p);
    return powMod(r, p - 2, p);
}
```

Cost: `Θ(log p)` modular multiplications, from binary exponentiation.

🔴 **Two preconditions, neither enforced by the arithmetic.** `p` must be **prime** — with `m = 4`
and `a = 2`, `a^(m−2) = 2² = 4 ≡ 0 (mod 4)`, and `2 · 0 = 0 ≢ 1`, so the formula produces a
non-inverse and nothing objects. And `a` must **not be a multiple of `p`** — if `a ≡ 0`, then
`a^(p−2) ≡ 0`, and the function cheerfully returns `0` as the inverse of `0`. That second one is the
single most damaging bug in this topic, because `0` is a perfectly ordinary value to reach in a
counting recurrence and the returned `0` then annihilates everything it multiplies.

## The extended Euclidean inverse

More general and with no primality requirement:

```ts
// TypeScript — inverse modulo any m coprime to a. Works for composite m.
export function inverseMod(a: number, m: number): number {
  const [g, x] = extGcd(((a % m) + m) % m, m);
  if (g !== 1) throw new RangeError(`${a} is not invertible modulo ${m}`);   // ✅ check g
  return ((x % m) + m) % m;                                                  // ✅ normalise the sign
}
```

Two lines carry the whole page's worth of care. **Check `g`**: when `gcd(a, m) ≠ 1` the algorithm
still returns a perfectly valid Bézout pair — it just is not an inverse — so ignoring `g` produces a
plausible wrong number rather than an error. **Normalise the sign**: Bézout coefficients are
negative in most cases, and `%` is a remainder, so the raw `x` is routinely negative; see
[03k](03k-the-remainder-trap-in-indices-hashes-and-shards.md).

Cost: `Θ(log m)` division steps and no multiplications, against Fermat's `Θ(log p)` multiplications.
Both are logarithmic; the extended algorithm's inner operation is a division rather than a modular
multiply, and it does not depend on the modulus being prime. Choose Fermat when the modulus is the
conventional prime and you already have `powMod`; choose extended Euclid otherwise, and always when
the modulus might be composite.

**Java ships both**, and the `modInverse` javadoc documents the failure condition precisely:

> *"Returns a BigInteger whose value is `(this`⁻¹ `mod m)`."* — Throws: *"`ArithmeticException` -
> `m` ≤ 0, or this BigInteger has no multiplicative inverse mod m (that is, this BigInteger is not
> relatively prime to m)."* — JDK 25, `BigInteger.modInverse(BigInteger)`

> *"Returns a BigInteger whose value is `(this`ˣᵖᵒⁿᵉⁿᵗ `mod m)`. (Unlike `pow`, this method permits
> negative exponents.)"* — JDK 25, `BigInteger.modPow`

The second sentence is a quiet gift: `modPow` with an exponent of `-1` is a modular inverse, and its
documented exception for a negative exponent on a value not relatively prime to `m` is the same
condition `modInverse` names. Between them, `BigInteger` never returns a silent non-inverse — which
is exactly what a hand-rolled Fermat does.

## Euler's theorem, for a composite modulus

The generalisation: if `gcd(a, m) = 1` then `a^φ(m) ≡ 1 (mod m)`, where `φ` is Euler's totient from
[03i](03i-divisor-functions-and-the-totient.md). So `a⁻¹ ≡ a^(φ(m) − 1) (mod m)`. Fermat is the case
`m = p`, where `φ(p) = p − 1`.

It is rarely the tool you want, because computing `φ(m)` requires factorising `m` — and if you can
factorise `m` you could have used extended Euclid, which needs no factorisation at all. Know it for
the theory question and for the related fact that it is what licenses reducing an *exponent* modulo
`φ(m)`, which [03j](03j-modular-arithmetic-and-the-remainder-trap.md) warns you cannot do
unconditionally.

## Inverting many values at once

Two techniques, both replacing `n` exponentiations with one.

**Batch inversion (Montgomery's trick)** — for an arbitrary set of `n` values, one inversion plus
about `3n` multiplications:

```ts
// TypeScript — invert every element of xs modulo a prime p, with ONE exponentiation
export function batchInverse(xs: bigint[], p: bigint): bigint[] {
  const n = xs.length;
  const prefix: bigint[] = new Array(n + 1);
  prefix[0] = 1n;
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] * (xs[i] % p) % p;
  let invAll = inverseFermat(prefix[n], p);        // the single inversion
  const out: bigint[] = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    out[i] = prefix[i] * invAll % p;               // inv(x_i) = P_{i-1} · inv(P_i)
    invAll = invAll * (xs[i] % p) % p;             // step invAll from inv(P_i) to inv(P_{i-1})
  }
  return out;
}
```

The identity it runs on: with `Pᵢ = x₁·x₂·…·xᵢ`, we have `xᵢ⁻¹ = Pᵢ₋₁ · Pᵢ⁻¹`, and
`Pᵢ₋₁⁻¹ = Pᵢ⁻¹ · xᵢ`. So a single inversion of the full product, walked backwards, yields every
individual inverse. If any `xᵢ` is `0` the whole product is `0` and there is nothing to invert —
which is a real precondition, not an edge case.

**The linear inverse table** — for the inverses of `1, 2, …, n` modulo a prime `p` with `n < p`,
`Θ(n)` with no exponentiation at all:

```ts
export function inverseTable(n: number, p: number): number[] {
  const inv = new Array<number>(n + 1);
  inv[1] = 1;
  for (let i = 2; i <= n; i++) {
    // p = q·i + r  ⇒  q·i + r ≡ 0 (mod p)  ⇒  i⁻¹ ≡ −q · r⁻¹
    const q = Math.floor(p / i);
    const r = p % i;
    inv[i] = (p - q * inv[r] % p) % p;      // r < i, so inv[r] is already computed
  }
  return inv;
}
```

The derivation is worth carrying: write `p = q·i + r` with `q = ⌊p/i⌋` and `r = p mod i`. Then
`q·i + r ≡ 0 (mod p)`. Multiply through by `i⁻¹·r⁻¹` and rearrange: `i⁻¹ ≡ −q·r⁻¹ (mod p)`. Since
`r < i`, the table is filled in increasing order and `inv[r]` is always ready. The `p - …` in the
code is the sign normalisation, doing the job of `floorMod`.

## Gotchas

**★ Symptom: an answer silently becomes `0` and every subsequent term is `0` too.** Cause: an
inverse was taken of a value congruent to `0` modulo `p`. Fermat's formula gives `0^(p−2) ≡ 0`, so
the routine returns `0` as "the inverse of 0" and the caller multiplies by it. `0` has no inverse —
there is nothing to multiply by 0 to get 1. Fix: reject it explicitly before the exponentiation:
`if (r === 0n) throw new RangeError("0 has no inverse")`. This is the highest-cost bug on this page
because `0` is an ordinary value in a counting recurrence.

**★ Symptom: `a^(m−2) mod m` is used with a composite `m` and the "inverse" does not invert.**
Cause: Fermat's little theorem requires `m` prime — the proof needs `Z/mZ` to have no zero divisors,
which is exactly what primality provides. With `m = 4` and `a = 2`, `2^(4−2) = 4 ≡ 0 (mod 4)`, and
`2 · 0 ≢ 1`. Fix: use extended Euclid, which needs only `gcd(a, m) = 1`, or `BigInteger.modInverse`,
which is documented to throw when no inverse exists.

**★ Symptom: the inverse is off by a factor of `a`.** Cause: the exponent was written `p − 1`
instead of `p − 2`. `a^(p−1) ≡ 1` is the theorem; the inverse is one power lower. The tell is that
multiplying by the "inverse" is a no-op. Fix: `powMod(a, p - 2, p)`, and sanity-check with
`a * inv % p === 1`.

**★ Symptom: an extended-Euclid inverse comes back negative.** Cause: Bézout coefficients are
routinely negative and `%` is a remainder. Fix: `((x % m) + m) % m`, or `Math.floorMod(x, m)`, on
the way out — never return a raw coefficient.

**★ Symptom: an extended-Euclid inverse is wrong for some inputs and right for most.** Cause: the
returned `g` was ignored. When `gcd(a, m) ≠ 1` the algorithm still returns a valid Bézout pair for
that `g`; it simply is not an inverse. Fix: `if (g !== 1) throw`. The advice "extended Euclid works
for any modulus" is true only in the sense of "any modulus *coprime to `a`*".

**★ Symptom: precomputing `n` inverses takes `Θ(n log p)` and dominates the solution.** Cause: one
exponentiation per value. Fix: either batch inversion — prefix products, one exponentiation, walk
backwards — which is `Θ(n)` multiplications plus one `Θ(log p)`; or, if the values are exactly
`1 … n`, the linear inverse table, which uses no exponentiation at all. The second is the one that
matters for factorials, and it is [07e](07e-binomial-coefficients-under-a-modulus.md).

**Symptom: batch inversion returns garbage for every element.** Cause: one of the inputs was `0`,
so the full prefix product is `0` and the single inversion is invalid — and because the technique
threads one value backwards through the whole array, a single bad element corrupts all of them. Fix:
reject zeros up front, or partition them out and handle them separately.

**Symptom: `inverseTable` throws or produces `NaN` for `i` at or above `p`.** Cause: the recurrence
requires `1 ≤ i < p`; at `i = p` the value is `0` modulo `p` and has no inverse, and `p % i` is `0`,
so `inv[0]` is read. Fix: assert `n < p` at entry. It is the same constraint that makes
`n! mod p` uninteresting for `n ≥ p`.

**Symptom: the inverse is recomputed inside a loop.** Cause: treating a `Θ(log p)` operation as
free. Fix: hoist it. An inverse of a loop-invariant divisor is computed once; a factorial-based
binomial computes its inverse factorials once for the whole run.

## Interview questions

**★ State Fermat's little theorem and derive the modular inverse from it.**
If `p` is prime and `p` does not divide `a`, then `a^(p−1) ≡ 1 (mod p)`. Multiply both sides of
`a · a^(p−2) = a^(p−1)` and you get `a · a^(p−2) ≡ 1`, so `a^(p−2) mod p` is the inverse of `a`. The
cost is one binary exponentiation, `Θ(log p)` modular multiplications. The two preconditions matter
and neither is checked by the arithmetic: `p` must be prime, and `a` must not be a multiple of `p`.
If `a ≡ 0`, the formula returns `0`, which is not an inverse of anything — and returns it silently.

**★ Prove Fermat's little theorem.**
Consider multiplication by `a` on the non-zero residues modulo `p`. It stays inside that set:
`a·x ≡ 0` would need `p` to divide `a·x`, and since `p` is prime that forces `p | a` or `p | x`,
neither of which holds. It is injective: `a·x ≡ a·y` gives `p | a(x−y)` and hence `p | (x−y)`. An
injective self-map of a finite set is a bijection, so `{a·1, …, a·(p−1)}` is a permutation of
`{1, …, p−1}`. Multiplying all of them: `a^(p−1)·(p−1)! ≡ (p−1)! (mod p)`, and `(p−1)!` is a product
of non-zero residues modulo a prime, hence non-zero and cancellable. That leaves `a^(p−1) ≡ 1`. The
place primality is used is the "no zero divisors" step, twice.

**★ When do you use extended Euclid instead of Fermat?**
Whenever the modulus is not prime, and by default whenever you are not certain it is. Extended
Euclid needs only `gcd(a, m) = 1` — it produces `x`, `y` with `a·x + m·y = 1`, so `x` is the inverse
— and it costs `Θ(log m)` divisions with no multiplications. Fermat is the shorter code when you
already have a `powMod` and the modulus is the conventional prime. Two things extended Euclid
requires that Fermat does not: checking the returned `g` is 1, because otherwise the pair is valid
Bézout output and not an inverse; and normalising the sign, because Bézout coefficients are usually
negative.

**★ How do you invert a thousand values without doing a thousand exponentiations?**
Batch inversion. Build prefix products `Pᵢ = x₁ … xᵢ`, invert only `Pₙ` — one exponentiation — and
walk backwards using `xᵢ⁻¹ = Pᵢ₋₁ · Pᵢ⁻¹` and `Pᵢ₋₁⁻¹ = Pᵢ⁻¹ · xᵢ`. Total: about `3n`
multiplications and one `Θ(log p)` inversion, instead of `n` inversions. The precondition is that no
input is zero, since a single zero makes the whole product zero. If the values happen to be
`1 … n`, there is something better still: the linear inverse table, from `p = q·i + r` giving
`i⁻¹ ≡ −q·r⁻¹`, which fills the table in `Θ(n)` with no exponentiation at all.

**Why is `0` special, and what should the function do about it?**
Because `0 · x ≡ 0` for every `x`, so nothing multiplies by `0` to give `1` — the inverse does not
exist, in any modulus. What makes it dangerous rather than merely absent is that the Fermat formula
evaluates happily: `0^(p−2) ≡ 0`, so the routine returns `0` with no signal, and downstream every
product involving it collapses to zero. The function should throw. Java's `BigInteger.modInverse`
does exactly that — its javadoc documents `ArithmeticException` when the value is not relatively
prime to `m`, and `0` never is.

**What is Euler's theorem and when would you actually use it?**
`a^φ(m) ≡ 1 (mod m)` whenever `gcd(a, m) = 1`, with `φ` the count of integers below `m` coprime to
it. Fermat is the special case `m = p`, where `φ(p) = p − 1`, so the inverse generalises to
`a^(φ(m) − 1)`. In practice, almost never for inversion, because computing `φ(m)` requires
factorising `m` — and anyone who can factorise `m` could have run extended Euclid, which needs no
factorisation. Where it does earn its place is exponent reduction: `a^b mod m` may have its exponent
reduced modulo `φ(m)` when `gcd(a, m) = 1`, which is the only licence there is for shrinking an
exponent.

---

← Prev: [07c · An exact modular multiply in JS](07c-an-exact-modular-multiply-in-javascript.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [07e · Binomials under a modulus](07e-binomial-coefficients-under-a-modulus.md)
