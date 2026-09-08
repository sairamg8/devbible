---
title: "The Chinese remainder theorem is a Bézout pair wearing a different hat — two coprime congruences determine a value uniquely modulo the product of their moduli, and the construction is four multiplications once the extended Euclidean algorithm has handed you the coefficients"
sidebar_label: "03e · The Chinese remainder theorem"
sidebar_position: 3.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. The Chinese remainder theorem, its constructive proof from Bézout's identity,
> the non-coprime solvability condition and Garner's algorithm are **textbook mathematics, derived
> or named on this page rather than cited** — the research bank for this phase records that there is
> no primary source to quote for them. The language facts are the **JDK 25**
> [`java.lang.Math`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Math.html)
> javadoc (`floorMod`),
> [MDN's `BigInt` page](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt),
> and the **JDK 25**
> [`java.math.BigInteger`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/math/BigInteger.html)
> javadoc (`mod`, `remainder`, `modInverse`, `gcd`), all quoted verbatim below.
> **No sandbox run.**

**Everything the Chinese remainder theorem does, it does with the coefficients
[03d](03d-the-extended-euclidean-algorithm-and-bezout.md) already computed.** Given
`x ≡ r₁ (mod m₁)` and `x ≡ r₂ (mod m₂)` with the moduli coprime, there is exactly one `x` modulo
`m₁·m₂` satisfying both, and the formula for it is a rearrangement of `m₁·p + m₂·q = 1`. That makes
CRT less a theorem to memorise than a two-line consequence to re-derive, which is the right way to
carry it into an interview. The two places it goes wrong in code are both about assumptions the
formula does not state out loud: the moduli must be coprime (and a non-coprime pair produces a
number satisfying neither congruence rather than an error), and the intermediate `r₁·m₂·q` is the
product of three modulus-sized values even though the answer is bounded by `m₁·m₂`, so it leaves the
type long before the answer would.

## The extended Euclid this page depends on

CRT is a consumer of [03d](03d-the-extended-euclidean-algorithm-and-bezout.md); here is the
`BigInt` form the code below calls, so that the page is self-contained.

```ts
// TypeScript — extended Euclid over BigInt. Returns [g, x, y] with a*x + b*y == g.
export function extGcdBig(a: bigint, b: bigint): [bigint, bigint, bigint] {
  let oldR = a, r = b;
  let oldS = 1n, s = 0n;
  let oldT = 0n, t = 1n;
  while (r !== 0n) {
    const q = oldR / r;                     // BigInt division truncates — documented, and matches %
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
    [oldT, t] = [t, oldT - q * t];
  }
  return [oldR, oldS, oldT];
}
```

The quotient and the remainder must come from the same convention, which for `BigInt` they do:

> *"Division (`/`) truncates fractional components towards zero, since BigInt is unable to represent
> fractional quantities."* — MDN, `BigInt`; documented examples: `4n / 2n` is `2n`, `5n / 2n` is
> `2n`, not `2.5n`.

## Two congruences

**Statement.** If `gcd(m₁, m₂) = 1`, then for any residues `r₁`, `r₂` the system

```
x ≡ r₁ (mod m₁)
x ≡ r₂ (mod m₂)
```

has a solution, and it is unique modulo `m₁·m₂`.

**Construction.** Extended Euclid gives `p`, `q` with `m₁·p + m₂·q = 1`. Set

```
x = r₁·m₂·q + r₂·m₁·p     (mod m₁·m₂)
```

Check it: modulo `m₁`, the term `r₂·m₁·p` vanishes and `m₂·q ≡ 1 − m₁·p ≡ 1`, so `x ≡ r₁`. By
symmetry `x ≡ r₂` modulo `m₂`. **Uniqueness:** two solutions differ by a number divisible by both
`m₁` and `m₂`, hence by their lcm, which is `m₁·m₂` precisely because they are coprime. **Existence
without construction**, if you prefer the counting argument: the map from `[0, m₁m₂)` to
`(x mod m₁, x mod m₂)` is injective by that same uniqueness argument, and both sets have `m₁m₂`
elements, so an injection between them is a bijection — every pair of residues is hit.

```ts
// TypeScript — CRT for two coprime moduli. BigInt, because m1*m2 leaves the safe integer range fast.
export function crt2(r1: bigint, m1: bigint, r2: bigint, m2: bigint): bigint {
  const [g, p, q] = extGcdBig(m1, m2);
  if (g !== 1n) throw new RangeError("crt2 requires coprime moduli");
  const m = m1 * m2;
  const x = ((r1 % m1) * m2 % m) * q + ((r2 % m2) * m1 % m) * p;
  return ((x % m) + m) % m;                 // ✅ Bézout coefficients are routinely negative
}
```

The trailing `((x % m) + m) % m` is not optional. `p` and `q` come straight out of extended Euclid
and one of them is negative in essentially every case, so `x` before reduction is signed, and `%`
is a remainder rather than a modulus in both languages — see
[03j · Modular arithmetic and the remainder trap](03j-modular-arithmetic-and-the-remainder-trap.md).

## Many congruences, and the non-coprime case

For more than two congruences with pairwise coprime moduli, fold: solve the first two into a single
congruence modulo `m₁·m₂`, then combine that with the third, and so on. The fold is the reason the
`BigInt` type is not optional — the running modulus is the product of everything merged so far.

```java
// Java — folding CRT over pairwise-coprime moduli, in BigInteger because the running modulus grows
static BigInteger crtAll(BigInteger[] r, BigInteger[] m) {
    BigInteger accR = r[0], accM = m[0];
    for (int i = 1; i < m.length; i++) {
        BigInteger g = accM.gcd(m[i]);
        if (!g.equals(BigInteger.ONE))
            throw new IllegalArgumentException("moduli must be pairwise coprime");
        BigInteger inv = accM.modInverse(m[i]);                 // throws if not relatively prime
        BigInteger diff = r[i].subtract(accR).mod(m[i]);        // mod, not remainder — see below
        BigInteger k = diff.multiply(inv).mod(m[i]);
        accR = accR.add(accM.multiply(k));
        accM = accM.multiply(m[i]);
    }
    return accR.mod(accM);
}
```

The two `BigInteger` methods that carry this code are documented precisely enough that the
coprimality check is almost redundant:

> *"Returns a BigInteger whose value is `(this`⁻¹ `mod m)`."* — Throws: *"`ArithmeticException` -
> `m` ≤ 0, or this BigInteger has no multiplicative inverse mod m (that is, this BigInteger is not
> relatively prime to m)."* — JDK 25, `BigInteger.modInverse(BigInteger)`

> *"Returns a BigInteger whose value is `(this mod m)`. This method differs from `remainder` in that
> it always returns a non-negative BigInteger."* — JDK 25, `BigInteger.mod(BigInteger)`

`modInverse` throwing on a non-coprime modulus means the explicit `gcd` check above is a way of
producing a better message rather than a way of catching something that would otherwise pass. The
`mod` sentence is the one to remember: `remainder` is documented as *"`(this % val)`"* and inherits
`%`'s sign behaviour, while `mod` is documented as always non-negative.

That formulation — `x = accR + accM·k` where `k` solves `accM·k ≡ r_i − accR (mod m_i)` — is worth
preferring over the symmetric two-term formula, because every intermediate is already reduced and
the products stay bounded by roughly `accM · m_i` rather than by a triple product. It is also the
step in **Garner's algorithm**, which is the same idea arranged so that the mixed-radix digits are
computed once and the large accumulator is built only at the end; name it if asked how to make CRT
over many small primes efficient.

**The non-coprime case.** If `g = gcd(m₁, m₂) > 1` the system is solvable **iff**
`r₁ ≡ r₂ (mod g)` — the two congruences have to agree on the part of the modulus they share — and
the solution is then unique modulo `lcm(m₁, m₂)` rather than modulo the product. A CRT that assumes
coprimality and is handed a non-coprime pair silently returns a number satisfying neither
congruence, which is why the check above throws instead of continuing.

## Where it is actually used

**Reconstructing a big answer from small ones.** Run the same computation modulo several distinct
primes, each small enough that every product fits a machine word, then recombine with CRT. The
result is exact for any answer below the product of the moduli, and no arbitrary-precision
arithmetic was needed in the inner loop. This is the standard technique behind large-integer
convolution and determinant computations, and it is why "why would you ever want CRT" has a real
answer.

**Combining periodic constraints.** The batch job runs every 12 minutes and is 5 minutes into its
cycle; the cache expires every 35 minutes and is 9 minutes in. When do both conditions hold?
`x ≡ 5 (mod 12)` and `x ≡ 9 (mod 35)`, with `gcd(12, 35) = 1`, so there is exactly one answer modulo
420 and it repeats every 420 minutes. The naive alternative — simulate minute by minute until they
coincide — is `Θ(m₁·m₂)` where CRT is `Θ(log min(m₁, m₂))`.

**Sharding and rebalancing.** A key placed by `id mod N` on one dimension and `id mod M` on another
occupies a unique slot modulo `lcm(N, M)`; CRT is what tells you which `id` values land in a given
pair of slots, and the coprimality condition is exactly the condition under which every pair of
slots is reachable.

## Gotchas

**★ Symptom: CRT with two moduli returns a value satisfying neither congruence.** Cause: the moduli
were not coprime, and the construction assumed they were — `m₂·q ≡ 1 (mod m₁)` only holds when
Bézout's combination equals 1, and for `g > 1` it equals `g`. Fix: check `gcd(m₁, m₂) === 1` and
throw; or implement the general case, which is solvable iff `r₁ ≡ r₂ (mod gcd(m₁, m₂))` and unique
modulo `lcm(m₁, m₂)` rather than modulo the product:

```ts
export function crt2General(r1: bigint, m1: bigint, r2: bigint, m2: bigint): [bigint, bigint] {
  const [g, p] = extGcdBig(m1, m2);
  if ((r2 - r1) % g !== 0n) throw new RangeError("congruences disagree modulo the shared factor");
  const lcm = m1 / g * m2;                             // ✅ divide first, as in 03c
  const k = ((r2 - r1) / g % (m2 / g)) * p % (m2 / g);
  const x = ((r1 + m1 * k) % lcm + lcm) % lcm;
  return [x, lcm];                                     // solution, and the modulus it is unique under
}
```

**★ Symptom: CRT overflows on moduli that individually fit comfortably in the type.** Cause: the
symmetric formula multiplies `r₁ · m₂ · q`, three values each around the size of a modulus, so the
intermediate is roughly the cube of one of them even though the answer is bounded by `m₁·m₂`. Fix:
either move to `BigInt` / `BigInteger`, or use the incremental form `x = accR + accM·k`, where every
factor is already reduced and the largest product is `accM · m_i`. Note that reducing after each
multiplication still needs *that* multiplication not to overflow, which is
[07b · Modular exponentiation and where the product overflows](07b-modular-exponentiation-and-where-the-product-overflows.md).

**★ Symptom: the CRT result is negative.** Cause: Bézout's coefficients are negative in essentially
every case, so the un-reduced `x` is signed, and `%` is a remainder that preserves the sign of its
dividend in both languages. Fix: finish with `((x % m) + m) % m` in TypeScript or `Math.floorMod` in
Java — and in Java's `BigInteger`, prefer `.mod(m)`, documented as *"always returns a non-negative
BigInteger"*, over `.remainder(m)`, documented only as *"`(this % val)`"*.

**★ Symptom: folding CRT over many moduli produces a wrong answer only when a particular pair is
present.** Cause: the moduli are *pairwise* coprime is a stronger condition than "no modulus divides
another", and the fold checks the accumulated modulus against the next one rather than every pair.
In fact checking `gcd(accM, m_i) == 1` at each step **is** equivalent to pairwise coprimality,
because `accM` is the product of everything merged so far — the bug is when that check is omitted or
moved outside the loop. Fix: check inside the loop, on the accumulated modulus, every iteration.

**Symptom: the answer is right but is reported modulo the wrong number.** Cause: the uniqueness
modulus was assumed to be the product even in the non-coprime case. Fix: return the modulus
alongside the residue, as `crt2General` above does — the solution is unique modulo `lcm(m₁, m₂)`,
which equals the product only when the moduli are coprime, and a caller that reduces by the wrong
modulus discards real solutions.

**Symptom: `BigInteger.remainder` used where `mod` was meant, and a negative residue reaches the
caller.** Cause: the two methods differ exactly as `%` and `Math.floorMod` do — one is a remainder,
one is a modulus. Fix: `mod`. The pattern is identical to the one in
[03i](03j-modular-arithmetic-and-the-remainder-trap.md), and the reason it recurs in `BigInteger`
code specifically is that both methods exist and read as synonyms.

## Interview questions

**★ State the Chinese remainder theorem and construct the solution.**
For coprime moduli `m₁` and `m₂`, the system `x ≡ r₁ (mod m₁)`, `x ≡ r₂ (mod m₂)` has a solution
unique modulo `m₁·m₂`. Construct it from Bézout: extended Euclid gives `p`, `q` with
`m₁·p + m₂·q = 1`; then `x = r₁·m₂·q + r₂·m₁·p` works, because modulo `m₁` the second term vanishes
and `m₂·q ≡ 1 − m₁·p ≡ 1`, leaving `x ≡ r₁`, and symmetrically for `m₂`. Uniqueness follows because
two solutions differ by a common multiple of both moduli, hence by a multiple of their lcm, which
for coprime moduli is the product. Reduce the result into `[0, m₁m₂)` at the end, because the Bézout
coefficients are signed.

**★ What happens if the moduli are not coprime?**
The formula stops working — `m₂·q` is congruent to `g` rather than to 1 modulo `m₁` — and it fails
by returning a plausible number rather than by raising anything, which is the dangerous part. The
correct statement for `g = gcd(m₁, m₂) > 1` is that the system is solvable **iff**
`r₁ ≡ r₂ (mod g)`: the two congruences have to agree on the information they share. When they do,
the solution is unique modulo `lcm(m₁, m₂)`, not modulo the product. So a general CRT returns two
things — the residue and the modulus it is unique under — and a caller that assumes the product
will discard solutions.

**★ Why would a working engineer ever reach for CRT?**
To do arbitrary-precision arithmetic without arbitrary-precision arithmetic. Run the whole
computation modulo several distinct primes, each small enough that a product of two residues fits a
machine word, and recombine at the end; the answer is exact for any true value below the product of
the moduli, and the inner loop never left fixed-width types. That is the technique behind
large-integer convolution and exact linear algebra. The everyday version is combining periodic
constraints — two schedules with periods 12 and 35 and known offsets coincide at exactly one residue
modulo 420 — where the naive answer is to simulate until they line up, which is linear in the
product rather than logarithmic in the moduli.

**How do you extend CRT to many congruences, and what is Garner's algorithm?**
Fold pairwise: merge the first two into a single congruence modulo `m₁·m₂`, then merge that with the
third. Written incrementally as `x = accR + accM·k` with `k ≡ (r_i − accR)·accM⁻¹ (mod m_i)`, every
intermediate is already reduced and the products stay bounded by `accM · m_i`, which is much better
than the symmetric formula's triple product. Garner's algorithm is that same fold organised so the
mixed-radix digits `k` are all computed first, in fixed-width arithmetic, and the large accumulator
is assembled only once at the end — which is what you want when the moduli are many small primes and
the final answer is the only big number in the computation.

**In `BigInteger`, when does `mod` differ from `remainder`, and why does it matter here?**
`remainder` follows the sign of the dividend, exactly as `%` does on primitives; `mod` returns a
non-negative value in `[0, m)`. CRT hits this on every call, because Bézout's coefficients are
signed and so is the un-reduced solution — so `remainder` produces a mathematically correct residue
that is negative, and a caller using it as an index, a shard number or a final answer is wrong. The
rule is the same one as for `%` versus `Math.floorMod` on primitives, and the reason it catches
people more often in `BigInteger` is that both methods exist, are adjacent in the javadoc, and read
as synonyms.

{/* FOOTER */}
