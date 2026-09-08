---
title: "A binomial coefficient under a prime modulus is three table lookups and two multiplications, and the whole art is in the precompute — factorials forward, inverse factorials backward from a single exponentiation, with the silent failure being that the entire table collapses to zero the moment n reaches the modulus"
sidebar_label: "07e · Binomials under a modulus"
sidebar_position: 7.4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The factorial / inverse-factorial precompute, Lucas's theorem and Pascal's
> recurrence are **textbook mathematics, derived or stated on this page rather than cited** — the
> research bank for this phase records that they have no primary source to quote. The modular
> arithmetic they rest on is [07d](07d-the-modular-inverse.md) and
> [03l](03l-why-answers-are-taken-modulo-a-large-prime.md), both of which do carry primary sources.
> **No sandbox run.**

**`C(n, k) = n! / (k!·(n−k)!)` is a quotient, and there is no division under a modulus — so this is
the page where [07d](07d-the-modular-inverse.md)'s inverse earns its keep.** Precompute factorials
up to the largest `n` you will be asked about, precompute their inverses, and every query is
`fact[n] · invFact[k] · invFact[n−k]` reduced twice. The precompute is `Θ(N)` and — this is the part
people get wrong — needs **exactly one** modular exponentiation, not `N` of them, because
`(i−1)!⁻¹ = i · i!⁻¹`. Two preconditions decide whether this method applies at all: the modulus must
be **prime**, or the inverses may not exist; and `n` must be **less than the modulus**, or `n!` is
congruent to zero and the entire inverse-factorial table collapses to zeros without any error. When
`n` exceeds a small prime, Lucas's theorem is the answer; when the modulus is composite, Pascal's
recurrence is. Combinatorics proper — Catalan numbers, inclusion–exclusion, stars and bars — is
[08 · Combinatorics for counting problems](08-combinatorics-for-counting-problems.md); this page is only the machinery
that makes them computable modulo a prime.

## The precompute

```ts
// TypeScript — factorials and inverse factorials modulo a prime, in Θ(N) plus ONE exponentiation.
export function buildFactorials(N: number, p: number) {
  const fact = new Array<number>(N + 1);
  const invFact = new Array<number>(N + 1);
  fact[0] = 1;
  for (let i = 1; i <= N; i++) fact[i] = Number(BigInt(fact[i - 1]) * BigInt(i) % BigInt(p));
  invFact[N] = Number(powModBig(BigInt(fact[N]), BigInt(p) - 2n, BigInt(p)));   // ✅ ONE inversion
  for (let i = N; i >= 1; i--) {
    invFact[i - 1] = Number(BigInt(invFact[i]) * BigInt(i) % BigInt(p));        // ✅ walk backwards
  }
  return { fact, invFact };
}
```

```java
// Java — the same, over long, where the products fit natively
static long[] fact, invFact;

static void buildFactorials(int N, long p) {
    fact = new long[N + 1];
    invFact = new long[N + 1];
    fact[0] = 1L;
    for (int i = 1; i <= N; i++) fact[i] = fact[i - 1] * i % p;
    invFact[N] = powMod(fact[N], p - 2, p);                   // ✅ the single exponentiation
    for (int i = N; i >= 1; i--) invFact[i - 1] = invFact[i] * i % p;
}

static long nCk(int n, int k, long p) {
    if (k < 0 || k > n || n < 0) return 0L;                   // ✅ out of range is zero, not an error
    return fact[n] * invFact[k] % p * invFact[n - k] % p;      // ✅ reduce between the two multiplies
}
```

**Why one exponentiation suffices.** `(i−1)!⁻¹ = 1/(i−1)! = i/i! = i · (i!)⁻¹`. So having inverted
the largest factorial once, every smaller inverse factorial is one multiplication away, walking
downward. Inverting each factorial separately is `Θ(N log p)`; this is `Θ(N + log p)`. On a table of
a million entries with a 30-bit prime that is a difference of about thirty times the work, and it is
one of the most reliable "have you actually written this" signals there is.

⚠️ The TypeScript version routes every multiply through `BigInt` because `fact[i-1] * i` with a
modulus near `10^9` reaches about `10^18`, past the exactly-representable range — that is
[07b](07b-modular-exponentiation-and-where-the-product-overflows.md), and
[07c](07c-an-exact-modular-multiply-in-javascript.md) is the menu of alternatives if the `BigInt`
conversions are unwelcome. Keeping the whole table as `bigint[]` is usually cleaner than converting
at every boundary.

## 🔴 The table collapses when `n` reaches `p`

If `N ≥ p`, then `fact[N]` contains `p` as a factor and is congruent to `0`. The single inversion
then computes `0^(p−2) ≡ 0` — which [07d](07d-the-modular-inverse.md) explains returns silently
rather than throwing — and the backward walk propagates that zero to *every* entry, since
`invFact[i-1] = invFact[i] * i` starting from zero is zero forever. Every query returns `0`, and
nothing in the code objects.

```ts
if (N >= p) throw new RangeError("factorial table requires N < p; use Lucas's theorem instead");
```

Guard it. The correct method for `n ≥ p` is Lucas's theorem, below.

## Lucas's theorem, for a small prime and a huge `n`

**Statement.** For a prime `p`, write `n` and `k` in base `p` as `n = (nₘ … n₁ n₀)_p` and
`k = (kₘ … k₁ k₀)_p`. Then

```
C(n, k) ≡ Π C(nᵢ, kᵢ)   (mod p)
```

with the convention that `C(nᵢ, kᵢ) = 0` whenever `kᵢ > nᵢ` — so a single digit of `k` exceeding the
corresponding digit of `n` makes the whole coefficient zero modulo `p`.

```ts
// TypeScript — C(n, k) mod p for a SMALL prime p and arbitrarily large n. Requires small factorial
// tables of size p, built by buildFactorials(p - 1, p).
export function lucas(n: number, k: number, p: number, small: (a: number, b: number) => number): number {
  let result = 1;
  let nn = n;
  let kk = k;
  while (nn > 0 || kk > 0) {
    const ni = nn % p;
    const ki = kk % p;
    if (ki > ni) return 0;                 // ✅ one bad digit zeroes the whole product
    result = result * small(ni, ki) % p;   // small() is nCk with tables of size p
    nn = Math.floor(nn / p);
    kk = Math.floor(kk / p);
  }
  return result;
}
```

The shape to recognise: Lucas is worth it when `p` is **small** — a few thousand, say — and `n` is
enormous, because the factorial tables only need to reach `p − 1` and the loop runs
`⌈log_p n⌉` times. With `p = 10^9 + 7` and `n < p`, Lucas degenerates to a single digit and is just
the ordinary formula. ⚠️ Lucas requires `p` **prime**; the generalisation to prime powers
(Granville's / Andrew Granville's extension) is named here and not derived.

## When the modulus is composite: Pascal's recurrence

`C(n, k) = C(n−1, k−1) + C(n−1, k)` uses only addition, so it works modulo **anything** — no
inverses, no primality:

```ts
// Θ(n·k) time, Θ(k) space, valid for ANY modulus
export function pascalRow(n: number, k: number, m: number): number {
  const row = new Array<number>(k + 1).fill(0);
  row[0] = 1;
  for (let i = 1; i <= n; i++) {
    for (let j = Math.min(i, k); j >= 1; j--) {     // ✅ backwards, or you read the current row
      row[j] = (row[j] + row[j - 1]) % m;
    }
  }
  return row[k];
}
```

The inner loop runs **backwards** for the same reason a one-dimensional knapsack does: `row[j-1]`
must still hold the previous row's value when `row[j]` reads it. Running forwards computes something
else entirely and does so without error.

The alternative for a composite modulus, when `Θ(n·k)` is too slow, is to factor the modulus into
prime powers, solve each with Lucas or its prime-power generalisation, and recombine with
[03e · The Chinese remainder theorem](03e-the-chinese-remainder-theorem.md).

## A single coefficient with small `k` and enormous `n`

If `k` is small and `n` is large but still below `p`, there is no need for a table of size `n` at
all — use the multiplicative form:

```
C(n, k) = Π_{i=1..k} (n − i + 1) / i
```

```ts
// Θ(k log p) with Fermat inverses, or Θ(k) if you have an inverse table for 1..k
export function nCkSmallK(n: number, k: number, p: bigint): bigint {
  if (k < 0 || k > n) return 0n;
  let num = 1n;
  let den = 1n;
  for (let i = 1; i <= k; i++) {
    num = num * BigInt(n - i + 1) % p;
    den = den * BigInt(i) % p;
  }
  return num * inverseFermat(den, p) % p;      // ✅ one inversion, not k
}
```

Note the single inversion at the end rather than one per term — the same discipline as the inverse
factorial table, applied to a single query.

## Gotchas

**★ Symptom: every binomial coefficient comes back as `0`.** Cause: the factorial table was built
with `N ≥ p`, so `fact[N] ≡ 0`, the single inversion returned `0` (Fermat's formula does that
silently for zero), and the backward walk propagated zero through the whole `invFact` array. Fix:
assert `N < p` when building the table, and use Lucas's theorem when `n` genuinely exceeds the
modulus.

**★ Symptom: the precompute is `Θ(N log p)` and dominates the runtime.** Cause: `invFact[i]` was
computed with a separate exponentiation for each `i`. Fix: invert only `fact[N]`, then walk
downward with `invFact[i-1] = invFact[i] * i % p`, which follows from `(i−1)!⁻¹ = i · (i!)⁻¹`. That
is `Θ(N)` multiplications plus one `Θ(log p)` inversion.

**★ Symptom: `nCk` returns a large wrong number instead of `0` for out-of-range arguments.** Cause:
no guard, so `invFact[n - k]` is read at a negative index — `undefined` in TypeScript, an exception
in Java — or `fact[n]` is read past the table. Mathematically `C(n, k)` is `0` for `k < 0` or
`k > n`, and callers rely on that in recurrences. Fix: `if (k < 0 || k > n || n < 0) return 0;`
as the first line.

**★ Symptom: the table is built for `n` and a query asks for `C(2n, n)`.** Cause: sizing the table
to the problem's `n` rather than to the largest index any formula will touch. Grid paths, Catalan
numbers and "choose from two groups" problems all reach `2n`. Fix: size the table to the maximum
index across every formula in the solution, and assert the bound at query time rather than trusting
it.

**★ Symptom: in TypeScript, `fact[i-1] * i % p` gives wrong values partway through the table.**
Cause: with `p` near `10^9`, `fact[i-1]` is near `10^9` and the product is near `10^18`, which is
about a hundred times past the exactly-representable integer range — so it is silently rounded.
Fix: keep the whole table as `bigint[]`, or apply one of the exact-multiply techniques in
[07c](07c-an-exact-modular-multiply-in-javascript.md). Java's `long` has no such problem for a
modulus below about `3 × 10^9`.

**★ Symptom: `fact[n] * invFact[k] * invFact[n-k] % p` overflows in Java even though everything is
`long`.** Cause: three residues multiplied before any reduction — about `10^27`, far past `2^63`.
Fix: reduce between the multiplications:
`fact[n] * invFact[k] % p * invFact[n - k] % p`. The `%` binds tighter than the following `*`, so
that expression really does reduce in the middle; it is worth reading the precedence rather than
assuming it.

**★ Symptom: Lucas's theorem gives wrong answers and the modulus is `4` or `12`.** Cause: Lucas
requires a **prime** modulus — the proof rests on `(1 + x)^p ≡ 1 + x^p (mod p)`, which is the
freshman's-dream identity and holds only for prime `p`. Fix: for a composite modulus, factor it into
prime powers, apply the prime-power generalisation to each, and recombine with the Chinese remainder
theorem; or use Pascal's recurrence, which needs no primality at all.

**Symptom: Pascal's row computed in place gives values that are too large.** Cause: the inner loop
runs forwards, so `row[j-1]` has already been updated to the current row when `row[j]` reads it, and
each entry accumulates contributions it should not have. Fix: iterate `j` downward from
`min(i, k)`. It is exactly the one-dimensional knapsack direction rule.

**Symptom: a Catalan number computed as `C(2n, n) / (n + 1)` returns nonsense.** Cause: the division
was done as integer division under a modulus. Fix: multiply by the inverse —
`C(2n, n) * inverseFermat(n + 1, p) % p` — which is valid provided `n + 1` is not a multiple of `p`.
The combinatorial content of Catalan numbers belongs to [08 · Combinatorics for counting problems](08-combinatorics-for-counting-problems.md); only the modular mechanics are here.

## Interview questions

**★ Compute `C(n, k) mod p` for a million queries with `n` up to a million and `p = 10^9 + 7`. What
do you precompute, and what does it cost?**
Factorials `fact[0..N]` forward in `Θ(N)`, then inverse factorials backward. The key point is that
inverting requires exactly **one** modular exponentiation: invert `fact[N]` with Fermat, then use
`(i−1)!⁻¹ = i · (i!)⁻¹` to fill the rest downward with one multiplication each. So the precompute is
`Θ(N + log p)` and each query is `fact[n] · invFact[k] · invFact[n−k]`, two multiplications with a
reduction between them, in `Θ(1)`. Inverting each factorial separately would be `Θ(N log p)`,
roughly thirty times the work at those sizes, and it is the difference an interviewer is checking
for.

**★ What happens when `n ≥ p`, and what do you do about it?**
`n!` contains `p` as a factor, so `fact[n] ≡ 0`, and the single inversion of a zero returns zero
silently — Fermat's formula evaluates `0^(p−2) ≡ 0` rather than failing. The backward walk then
zeroes the whole inverse-factorial table, and every query returns `0`. The fix in code is an
assertion; the fix in mathematics is Lucas's theorem: write `n` and `k` in base `p` and multiply the
digit-wise binomials, `C(n, k) ≡ Π C(nᵢ, kᵢ) (mod p)`, with any digit of `k` exceeding the
corresponding digit of `n` making the result zero. Lucas is the right tool when `p` is small and `n`
is huge, because the factorial tables only need to reach `p − 1`.

**★ The modulus is composite. Now what?**
The factorial method is unavailable, because the inverses it needs may not exist — modulo `10^9`,
which is `2^9 · 5^9`, no even number is invertible. Two routes. Pascal's recurrence,
`C(n, k) = C(n−1, k−1) + C(n−1, k)`, uses only addition, so it works modulo anything at `Θ(n·k)`
time and `Θ(k)` space if you keep one row and iterate it backwards. Or factor the modulus into prime
powers, compute the coefficient modulo each with Lucas or its prime-power generalisation, and
recombine with the Chinese remainder theorem — which is exact, since the prime powers are pairwise
coprime by construction.

**★ `n` is `10^18` and `k` is `50`, modulo a large prime. What now?**
Not a table — you cannot allocate `10^18` entries and you do not need to. Use the multiplicative
form `C(n, k) = Π_{i=1..k} (n − i + 1) / i`: accumulate the numerator and the denominator separately
under the modulus, `k` multiplications each, and invert the denominator **once** at the end. That is
`Θ(k)` multiplications plus one `Θ(log p)` inversion. The numerator terms `n − i + 1` must be
reduced modulo `p` as they are formed. If `n` also exceeded the modulus in a way that made a factor
vanish, the answer would be zero and Lucas would be the framing — but with `n` below `p` this is
simply the right algorithm.

**★ Why does the inverse-factorial recurrence walk backwards rather than forwards?**
Because the identity is `(i−1)!⁻¹ = i · (i!)⁻¹` — the smaller inverse factorial is derived from the
larger one by multiplying, not dividing. Written forwards you would need `(i!)⁻¹ = (i−1)!⁻¹ / i`,
which is a division and therefore another inversion per step, defeating the whole point. Starting
from the single inverted `fact[N]` and walking down is what makes the precompute linear. It is the
same trick as batch inversion in [07d](07d-the-modular-inverse.md), specialised to the case where
the values happen to be consecutive factorials.

**How do you compute a multinomial coefficient under a modulus?**
Exactly the same machinery: `n! / (k₁! · k₂! · … · k_r!)` becomes
`fact[n] · invFact[k₁] · invFact[k₂] · … · invFact[k_r]`, with a reduction between every
multiplication. The guard is that the `kᵢ` must sum to `n` and each be non-negative, and the same
`n < p` precondition applies. It is worth mentioning because the factorial tables are built once and
serve binomials, multinomials, Catalan numbers and permutation counts alike — the precompute is the
reusable asset, not any individual formula.

---

← Prev: [07d · The modular inverse](07d-the-modular-inverse.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [07f · Any associative operation](07f-any-associative-operation.md)
