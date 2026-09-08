---
title: "Once you have a factorisation the divisor functions are one product each — the count is the product of exponents plus one, the sum is a product of geometric series, and the totient is inclusion–exclusion over the distinct primes — but listing the divisors needs no factorisation at all and the number-for-every-number versions are a different algorithm with a different bound"
sidebar_label: "03i · Divisor functions and the totient"
sidebar_position: 3.8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. The divisor-count and divisor-sum formulas, Euler's totient product and
> Euler's theorem are **textbook mathematics, derived on this page rather than cited** — the
> research bank for this phase records that this material has no primary source to quote. One
> language fact is primary-sourced: the default comparator of
> [MDN's `Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort),
> quoted verbatim below. **No sandbox run.**

**A factorisation is not an answer, it is an input, and what an interview actually asks for is one
of four things computed from it.** How many divisors `n` has, what they sum to, what they are, and
how many integers below `n` are coprime to it. Each is a one-line product once
[03h](03h-factorisation-and-smallest-prime-factors.md) has handed you `n = p₁^e₁ · … · p_k^e_k`, and
each has a range version that is a different algorithm with a genuinely different bound — the "for
every number up to `n`" divisor count is `Θ(n log n)` where the primality sieve is
`Θ(n log log n)`, and the one-line difference in the code that separates them is worth being able to
point at. Listing the divisors is the odd one out: it needs no factorisation, runs in `Θ(√n)`, and
carries the boundary bug that makes a perfect square appear twice.

## Divisors

**Counting them.** If `n = p₁^e₁ · p₂^e₂ · … · p_k^e_k`, a divisor is obtained by choosing an
exponent from `0` to `e_i` for each prime, independently. So

```
d(n) = (e₁ + 1)(e₂ + 1) … (e_k + 1)
σ(n) = Π (p_i^(e_i + 1) − 1) / (p_i − 1)        the sum of the divisors
```

The divisor-sum formula is the product of geometric series `1 + p + p² + … + p^e`, one per prime.

**Enumerating them** without factorising: divisors come in pairs `(d, n/d)`, and the smaller of each
pair is at most `√n`.

```ts
export function divisors(n: number): number[] {
  const out: number[] = [];
  for (let d = 1; d * d <= n; d++) {
    if (n % d !== 0) continue;
    out.push(d);
    if (d !== n / d) out.push(n / d);   // ✅ the guard: a perfect square would push √n twice
  }
  return out.sort((a, b) => a - b);     // ✅ numeric comparator; the default sorts as strings
}
```

**Counting them for every number in a range** is a different algorithm and a simpler one — for each
`d`, walk its multiples and increment:

```ts
// divisor counts for 1..n in Θ(n log n) — the harmonic sum n(1 + 1/2 + 1/3 + …)
export function divisorCounts(n: number): Int32Array {
  const cnt = new Int32Array(n + 1);
  for (let d = 1; d <= n; d++) for (let m = d; m <= n; m += d) cnt[m]++;
  return cnt;
}
```

That is `Θ(n log n)`, from `Σ_{d=1}^{n} n/d = n·H_n`, and note the contrast with the sieve's
`Θ(n log log n)`: the sieve sums over *primes* only, this sums over *all* `d`. It is also the
template for any "for every number, aggregate something over its divisors" computation.

## Euler's totient

`φ(n)` counts the integers in `[1, n]` coprime to `n`. From the factorisation, by
inclusion–exclusion over the distinct primes:

```
φ(n) = n · Π (1 − 1/p)      over the distinct primes p dividing n
```

It matters here for one reason: `φ` is the exponent in **Euler's theorem**, the generalisation of
Fermat's little theorem to a composite modulus that
[07d · The modular inverse](07d-the-modular-inverse.md) uses. Computed over a range it is a sieve
with the same shape as the divisor-count one:

```ts
export function totients(n: number): Int32Array {
  const phi = new Int32Array(n + 1);
  for (let i = 0; i <= n; i++) phi[i] = i;
  for (let p = 2; p <= n; p++) {
    if (phi[p] !== p) continue;                      // p is composite: phi[p] was already reduced
    for (let m = p; m <= n; m += p) phi[m] -= phi[m] / p;   // ✅ exact: p divides phi[m] here
  }
  return phi;
}
```

The `phi[p] !== p` test is the primality test — a number still equal to its own index has never been
touched, so no smaller prime divides it. This is the sieve of Eratosthenes wearing the totient's
clothes.

## Gotchas

**★ Symptom: `divisors(36)` contains `6` twice.** Cause: the pairing `(d, n/d)` produces the same
value twice when `d = n/d`, that is, when `n` is a perfect square. Fix: guard the partner push with
`if (d !== n / d)`. The same guard is why the loop condition is `d * d <= n` rather than `d * d < n`
— the square root must be visited once, and exactly once.

**★ Symptom: `divisors(n)` comes back in the order `1, 100, 2, 50, 4, 25, …`.** Cause: the pairs are
generated out of order by construction, and `Array.prototype.sort` was called without a comparator.
MDN is explicit about what the default does:

> *"If `compareFn` is not supplied, all non-`undefined` array elements are sorted by converting them
> to strings and comparing strings in UTF-16 code units order."* — MDN, `Array.prototype.sort()`

Fix: `sort((a, b) => a - b)`. This is a general JavaScript trap rather than a factorisation one, and
it lands here because divisor lists are one of the few places a numeric array is genuinely built out
of order.

**Symptom: `σ(n)` computed with the geometric-series formula overflows or comes back fractional.**
Cause: `(p^(e+1) − 1) / (p − 1)` computes a large power first, and in TypeScript the division is
floating point even though the result is mathematically an integer. Fix: accumulate the series
directly — `let term = 1, sum = 1; for (let k = 0; k < e; k++) { term *= p; sum += term; }` — which
never forms the large power and never divides.

**Symptom: the totient sieve's inner line is written `phi[m] = phi[m] * (p - 1) / p` and drifts.**
Cause: the multiplication is done before the division, so the intermediate is larger than necessary,
and in TypeScript an inexact intermediate makes the division non-integral. Fix:
`phi[m] -= phi[m] / p`, which is exact because at that point `p` divides `phi[m]` — the same
"divide before you multiply" rule as [03c](03c-lcm-and-the-multiplication-order.md).

**Symptom: `divisorCounts(n)` is described as linear and the interviewer disagrees.** Cause: the
outer loop runs for every `d`, not only for primes, so the total is the harmonic sum
`n · Σ_{d=1}^{n} 1/d = Θ(n log n)`, not the sieve's `n · Σ_{p prime} 1/p = Θ(n log log n)`. Fix:
state the harmonic sum. The distinction is not pedantry — `log n` against `log log n` is the
difference the `if (isComposite[p]) continue;` line makes in
[03g](03g-the-sieve-of-eratosthenes.md), and getting it backwards is the tell that the two sieves
have been conflated.

**Symptom: `d(n)` is computed by looping to `n` and testing `n % i === 0`.** Cause: the definition
was transcribed rather than the pairing used. Fix: loop to `√n` and count 2 for each divisor found,
1 if `d === n/d`. That is `Θ(√n)` instead of `Θ(n)`, and it is the same pairing argument as the
divisor listing:

```ts
export function divisorCount(n: number): number {
  let count = 0;
  for (let d = 1; d * d <= n; d++) {
    if (n % d !== 0) continue;
    count += (d === n / d) ? 1 : 2;      // ✅ the square root is counted once
  }
  return count;
}
```

**Symptom: `φ(n)` computed as `n · Π (1 − 1/p)` in floating point comes back as `35.99999999999999`.**
Cause: `1 − 1/p` is not representable exactly for most `p`, and the product accumulates error. Fix:
compute it in integers by rewriting the product as `Π (p − 1) · Π p^(e−1)`, or by the running form
`result = result / p * (p - 1)` applied once per distinct prime — the division first, because `p`
divides the running value at that point, which is the same rule as
[03c](03c-lcm-and-the-multiplication-order.md).

## Interview questions

**★ How many divisors does `n` have, and how do you list them?**
Count from the factorisation: a divisor picks an exponent from `0` to `e_i` independently for each
prime, so `d(n) = Π (e_i + 1)`, and the sum of the divisors is `Π (p^(e+1) − 1)/(p − 1)`, a product
of geometric series. To *list* them without factorising, use the pairing: divisors come in pairs
`(d, n/d)` whose smaller member is at most `√n`, so loop `d` from 1 while `d·d ≤ n`, and on each
divisor push both `d` and `n/d` — guarding `d !== n/d` so a perfect square does not push its root
twice. That is `Θ(√n)`. And if you need divisor counts for *every* number up to `n`, neither: for
each `d`, walk its multiples and increment, which is the harmonic sum `Θ(n log n)`.

**★ Why is the "count divisors for every number" sieve `Θ(n log n)` while the primality sieve is
`Θ(n log log n)`?**
Because of what is being summed over. The primality sieve runs its inner loop only for *prime* `p`,
giving `n · Σ_{p prime} 1/p`, and that sum grows like `ln ln n` (Mertens). The divisor sieve runs its
inner loop for *every* `d`, giving `n · Σ_{d=1}^{n} 1/d`, the harmonic number, which grows like
`ln n`. The one-line difference in the code — whether the outer loop skips composites — is the whole
difference between the bounds, and it is also the most common accidental way to turn the primality
sieve into the slower one.

**What is Euler's totient and why would you compute it?**
`φ(n)` is the count of integers in `[1, n]` coprime to `n`, and from the factorisation it is
`n · Π (1 − 1/p)` over the distinct primes dividing `n`, which is inclusion–exclusion over those
primes. The reason it appears in this topic is Euler's theorem: `a^φ(m) ≡ 1 (mod m)` whenever
`gcd(a, m) = 1`, which generalises Fermat's little theorem to a composite modulus and gives
`a^(φ(m) − 1)` as an inverse. Over a range, `φ` is computed by a sieve of exactly the same shape as
Eratosthenes, initialising `phi[i] = i` and applying `phi[m] -= phi[m] / p` for each prime `p` and
each multiple `m` — the subtraction being exact precisely because `p` divides `phi[m]` at that
point.

**★ Why does a perfect square need a special case in every divisor routine?**
Because the whole approach rests on divisors coming in pairs `(d, n/d)` with the smaller member at
most `√n`, and for a perfect square the pair collapses: `d` and `n/d` are the same number. So the
loop, which visits each smaller member once, produces that value once but the code pushes or counts
two. The guard is `if (d !== n / d)` before pushing the partner, or `count += (d === n/d) ? 1 : 2`
when counting. It is also why the loop condition is `d * d <= n` and not `<`: the square root has to
be visited exactly once, not zero times and not twice.

**★ How large can `d(n)` get, and why does that matter for a solution's complexity?**
Much smaller than `n` — `d(n)` is `n^o(1)`, sub-polynomial, which is textbook and which I would
state that way rather than quote a record-holder from memory. It matters because "iterate over the
divisors of each number in a range" sounds like it could be quadratic and is not: the total number
of `(number, divisor)` pairs below `n` is exactly `Σ_{d≤n} ⌊n/d⌋ = Θ(n log n)`, and that sum *is*
the divisor sieve. So an algorithm that visits every divisor of every number up to `n` is
`Θ(n log n)` overall, which is usually fine, and knowing that is what lets you propose it.

**Why compute `φ` with `phi[m] -= phi[m] / p` rather than with the product formula?**
Because the subtraction form is exact integer arithmetic and the product form is not. At the moment
the sieve applies it, `p` divides `phi[m]` — `phi[m]` is still `m` times a product of factors that
do not cancel `p` — so `phi[m] / p` is an integer and the subtraction implements `phi[m] · (1 − 1/p)`
without ever forming `1/p`. The product formula in floating point accumulates rounding error and
comes back a hair below an integer, which then truncates to the wrong value. It is the same
"divide before you multiply" rule that governs `lcm`, applied to a subtraction.

---

← Prev: [03h · Factorisation and smallest prime factors](03h-factorisation-and-smallest-prime-factors.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [03j · Modular arithmetic as a ring](03j-modular-arithmetic-and-the-remainder-trap.md)
