---
title: "Factorisation has exactly two shapes — one number by trial division to its square root, where the line everyone forgets is the leftover after the loop, or every number in a range from a smallest-prime-factor table built by a linear sieve, where each query then costs a logarithm and nothing else"
sidebar_label: "03h · Factorisation and smallest prime factors"
sidebar_position: 3.7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. Unique factorisation, the linear (Euler) sieve and its one-assignment-per-
> composite argument, the divisor-count and divisor-sum formulas and Euler's totient are **textbook
> mathematics, derived on this page rather than cited** — the research bank for this phase records
> that factorisation has no primary source to quote and must be shown as a derivation. Pollard's rho
> is **named, not derived**. **No sandbox run.**

**Every question about the multiplicative structure of a number — how many divisors it has, what
they are, whether two numbers are coprime, what its totient is — is answered from its prime
factorisation, so the only real decision is which of the two factorisation shapes the problem
wants.** One number, possibly large: trial division to `√n`, `Θ(√n)`, constant memory, and one line
after the loop that is omitted more often than any other line in this topic. Every number in a
range: build a table of each number's **smallest prime factor** once, then factorise any of them in
`Θ(log n)` by repeatedly dividing by the table entry. The second shape is what turns "factorise
100,000 numbers below a million" from an afternoon into a single pass, and the linear sieve that
builds the table is the sieve of [03g](03g-the-sieve-of-eratosthenes.md) rearranged so that each
composite is written exactly once. What you then *do* with a factorisation — count the divisors,
sum them, list them, compute a totient — is [03i](03i-divisor-functions-and-the-totient.md).

## Trial division, and the line everyone forgets

Strip each prime factor completely as you find it. Because every factor found is stripped, the
running value only ever shrinks, and the same `√` bound as [03f](03f-primality-by-trial-division.md)
applies to the *current* value: once `p·p` exceeds what is left, what is left is prime.

```ts
// TypeScript — full factorisation of one number. Returns [prime, exponent] pairs.
export function factorise(n: number): Array<[number, number]> {
  if (n < 2) return [];
  const out: Array<[number, number]> = [];
  let rest = n;
  for (let p = 2; p * p <= rest; p++) {
    if (rest % p !== 0) continue;
    let e = 0;
    while (rest % p === 0) { rest /= p; e++; }
    out.push([p, e]);
  }
  if (rest > 1) out.push([rest, 1]);   // 🔴 THE line. Without it, factorise(14) returns only [[2,1]].
  return out;
}
```

🔴 **`if (rest > 1)` is the whole gotcha.** After the loop, `rest` is either 1 — everything was
factored out — or a prime larger than `√n`, because if it had any factor at or below its own square
root the loop would have found it. Every number with a large prime factor loses that factor when the
line is missing: `14` strips its `2`, leaves `7`, and the loop stops because `3·3 > 7`. The result is
a factorisation whose product is not the input, and the failure is silent.

Note `p * p <= rest`, not `p * p <= n`: the bound shrinks as factors are stripped, which is what
makes the loop fast on numbers with small factors. In Java, the same widening rule as
[03f](03f-primality-by-trial-division.md) applies — write `(long) p * p <= rest`, or `p <= rest / p`.

```java
// Java — the same, with the products written so nothing can wrap
static List<long[]> factorise(long n) {
    List<long[]> out = new ArrayList<>();
    long rest = n;
    for (long p = 2; p <= rest / p; p++) {
        if (rest % p != 0) continue;
        int e = 0;
        while (rest % p == 0) { rest /= p; e++; }
        out.add(new long[] { p, e });
    }
    if (rest > 1) out.add(new long[] { rest, 1 });   // 🔴 the leftover is prime
    return out;
}
```

For numbers too large for `Θ(√n)`, the step up is **Pollard's rho**, named here and not derived; it
is the factoring counterpart to Miller–Rabin's primality testing.

## Smallest prime factors, and the linear sieve

For a range, precompute for every `i` its **smallest prime factor** `spf[i]`. Factorising is then a
loop of table lookups:

```ts
// Θ(log n) per query, once the table exists
export function factoriseFromSpf(n: number, spf: Int32Array): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let rest = n;
  while (rest > 1) {
    const p = spf[rest];
    let e = 0;
    while (rest % p === 0) { rest /= p; e++; }
    out.push([p, e]);
  }
  return out;
}
```

The bound is `Θ(log n)` because every division reduces `rest` by a factor of at least 2, so there
are at most `log₂ n` of them — the same counting argument as
[Phase 1 · Recurrences and the master theorem](../phase-1-complexity/08-recurrences-and-the-master-theorem.md)
uses for a halving recursion, applied to a loop.

The table can be built by the ordinary sieve — set `spf[m] = p` only if it is unset — or by the
**linear (Euler) sieve**, which visits each composite exactly once and is therefore `Θ(n)`:

```ts
// TypeScript — linear sieve: builds spf[] and the prime list in Θ(n).
export function linearSieve(n: number): { spf: Int32Array; primes: number[] } {
  const spf = new Int32Array(n + 1);
  const primes: number[] = [];
  for (let i = 2; i <= n; i++) {
    if (spf[i] === 0) { spf[i] = i; primes.push(i); }
    for (const p of primes) {
      if (p > spf[i] || i * p > n) break;   // ✅ both conditions, and this order
      spf[i * p] = p;
    }
  }
  return { spf, primes };
}
```

**Why each composite is written exactly once.** Take any composite `m`, let `p = spf(m)` and
`i = m / p`. Every prime factor of `i` is at least `p`, so `spf(i) ≥ p`, so when the outer loop
reaches this `i` the inner loop does reach `p` before breaking — and writes `spf[m] = p`. Could `m`
be written by some other pair `(i', p')` with `i'·p' = m`? Only if `p' ≤ spf(i')`, which forces `p'`
to be the smallest prime factor of `i'·p' = m`, that is `p' = p` and hence `i' = i`. So the pair is
unique, one write per composite, `Θ(n)` total.

Whether the linear sieve is worth writing over the plain sieve is a fair question and the honest
answer is "usually not": `Θ(n)` against `Θ(n log log n)` is a small constant in practice, and the
linear version has a break condition that is easy to get subtly wrong. Write it when you need the
`spf` table anyway, which is most of the time — the table, not the linearity, is the payoff.

## Gotchas

**★ Symptom: the returned factorisation does not multiply back to the input, and always for numbers
with one large prime factor.** Cause: the leftover after the trial-division loop was dropped. When
the loop ends, `rest` is either 1 or a prime greater than `√n` — it cannot be composite, because a
composite would have a factor at or below its own square root and the loop would have stripped it.
Fix: `if (rest > 1) out.push([rest, 1]);` after the loop. Test it with `14` and with any prime.

**★ Symptom: factorising every number in a range times out, and the factorisation itself is
correct.** Cause: `Θ(√n)` per query used for a range query — `Θ(n√n)` overall. Fix: build a smallest-
prime-factor table once and factorise each number by table lookups in `Θ(log n)`, for
`Θ(n log log n) + Θ(q log n)` overall. This is the same shape error as calling `isPrime` in a loop,
described in [03g](03g-the-sieve-of-eratosthenes.md).

**★ Symptom: the linear sieve produces a wrong `spf` table, or runs in `Θ(n log log n)` after all.**
Cause: the break condition. `if (p > spf[i] || i * p > n) break;` must test both, and the assignment
must come *after* the break check, not before. The common variant that also works writes
`if (i * p > n) break; spf[i * p] = p; if (i % p === 0) break;` — but mixing the two, or breaking on
`i % p === 0` *before* the assignment, drops the very composite the iteration exists to write. Fix:
pick one formulation and verify it with the uniqueness argument: each composite `m` is written by
the single pair `(m / spf(m), spf(m))`.

**★ Symptom: `spf[n]` is read for an `n` larger than the table.** Cause: the table was sized to the
largest query rather than to the largest *value* that will be factorised, and an intermediate — a
product, a sum — exceeded it. In TypeScript this reads `undefined` out of a plain array or `0` out
of an `Int32Array`, and a `spf` of `0` sends `factoriseFromSpf` into an infinite loop, because
`rest % 0` is `NaN` and `NaN === 0` is false forever. Fix: size the table to the maximum value, and
assert: `if (n >= spf.length) throw new RangeError(…)`.

**Symptom: trial-division factorisation is "optimised" by stepping `p` by 2 after 2, and misses a
factor.** Cause: nothing, if the `p = 2` case is stripped first — but the common version starts the
odd loop at 3 without stripping the 2s, so every even number keeps a factor of 2 in `rest` and the
loop never divides it out. Fix: strip 2 completely before the odd loop, exactly as
[03f](03f-primality-by-trial-division.md) handles it, and remember that the wheel changes nothing
about the leftover line.

## Interview questions

**★ Factorise a number. What is the line people forget?**
Trial-divide from 2 while `p·p ≤ rest`, stripping each factor completely and recording its exponent,
and then — the forgotten line — `if (rest > 1)`, push `rest` as a prime factor. After the loop,
`rest` is either 1 or a prime greater than `√n`: it cannot be composite, because a composite has a
factor at or below its own square root and the loop would have stripped it. Without that line, every
number with a large prime factor comes back with an incomplete factorisation whose product is not
the input, and nothing throws. Note also that the loop bound is against the *shrinking* `rest`, not
against the original `n`.

**★ You need the factorisation of 100,000 numbers, all below 10^6. What changes?**
The shape. Per-number trial division is `Θ(√n)` each, so the total is around `10^5 · 10^3`; instead,
build a smallest-prime-factor table for `[2, 10^6]` once, then factorise each query by repeatedly
dividing by `spf[rest]`, which costs `Θ(log n)` because every division at least halves the value.
Total: one sieve plus a logarithm per query. The table can come from the ordinary sieve — write
`spf[m] = p` only when unset — or from the linear sieve, which writes each composite exactly once
and is `Θ(n)`.

**★ What is the linear sieve and why does it visit each composite exactly once?**
For each `i`, it multiplies `i` by the primes `p` in increasing order and stops once `p > spf(i)`,
assigning `spf[i·p] = p`. Any composite `m` is written by the pair `(m / spf(m), spf(m))`: with
`p = spf(m)` and `i = m/p`, every prime factor of `i` is at least `p`, so `spf(i) ≥ p` and the inner
loop reaches `p` before breaking. And it is written by no other pair, because the condition
`p' ≤ spf(i')` forces `p'` to be the smallest prime factor of the product. One write per composite
gives `Θ(n)`. Whether it is worth it over the plain sieve: usually not for the linearity, which is a
small constant against `log log n`, but yes when you want the `spf` table, which the plain sieve
gives you only with an extra "only if unset" condition.

**Your factorisation function is correct but the numbers are 18 digits. Now what?**
`Θ(√n)` is about `10^9` divisions at that size, which is the boundary where trial division stops
being a plan. The step up is Pollard's rho, usually combined with a Miller–Rabin primality test to
decide when to stop splitting — rho finds a non-trivial factor of a composite far faster than trial
division, and Miller–Rabin tells you whether what you have left needs splitting further. I would
name both rather than write them from memory in an interview, and say what each is for: Miller–Rabin
tests, rho splits.

---

← Prev: [03g · The sieve of Eratosthenes](03g-the-sieve-of-eratosthenes.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [03i · Divisor functions and the totient](03i-divisor-functions-and-the-totient.md)
