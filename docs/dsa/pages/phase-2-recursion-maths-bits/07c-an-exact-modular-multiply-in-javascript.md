---
title: "There are exactly three ways to multiply two residues near a billion exactly in JavaScript — move to BigInt, choose a modulus below the square root of 2^53, or never form the product at all — and each has a documented cost you should be able to state before choosing"
sidebar_label: "07c · An exact modular multiply in JS"
sidebar_position: 7.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against
> [MDN's `BigInt` page](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)
> (the no-mixing rule, the truncating `/`, and `0n === 0` being `false`) and
> [MDN's `Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER),
> both quoted verbatim below. ⚠️ MDN makes **no performance claim about `BigInt`**, and none is made
> here. The `mulmod` bounds are arithmetic performed in the text, not measurements.
> **No sandbox run.**

**[07b](07b-modular-exponentiation-and-where-the-product-overflows.md) established the problem: a
product of two residues below `10^9 + 7` reaches about `10^18`, and a JavaScript `number` represents
integers exactly only up to `2^53 − 1`, about `9.01 × 10^15` — a hundred times smaller — with no
exception when it rounds.** This page is the three ways out, in the order you should consider them.
`BigInt` is exact for any modulus and carries three documented rules that each correspond to a
specific bug. Choosing a modulus below `√(2^53) ≈ 94906265` makes plain `number` arithmetic exact
again, and is the right answer whenever the modulus is yours to pick. And when neither is available,
a `mulmod` that never forms the big product does the job in plain `number` arithmetic — either by
splitting one operand into 16-bit halves, which is `Θ(1)` for a modulus below `2^31`, or by
multiplication through repeated doubling, which needs only `2m` to be representable and costs a
logarithm per multiply.

## Fix 1 — `BigInt`, and its three documented rules

```ts
// TypeScript — powMod over BigInt. Exact for any modulus.
export function powModBig(base: bigint, exp: bigint, mod: bigint): bigint {
  if (mod <= 0n) throw new RangeError("mod must be positive");
  if (mod === 1n) return 0n;
  let result = 1n;
  let b = ((base % mod) + mod) % mod;      // ✅ BigInt % is a remainder too — normalise the sign
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = result * b % mod; // ✅ 1n, not 1 — mixing throws
    b = b * b % mod;
    e >>= 1n;
  }
  return result;
}
```

Three MDN rules govern that code and each has a matching bug:

> *"A BigInt value cannot be used with methods in the built-in `Math` object and cannot be mixed
> with a Number value in operations; they must be coerced to the same type."* — MDN, `BigInt`

> *"Division (`/`) truncates fractional components towards zero, since BigInt is unable to represent
> fractional quantities."* — MDN, `BigInt`; documented: `4n / 2n` is `2n`, `5n / 2n` is `2n`, not
> `2.5n`.

> *"A BigInt value is not strictly equal to a Number value, but it is loosely so"* — MDN, `BigInt`;
> documented: `0n === 0` is `false`, `0n == 0` is `true`.

The third is the quiet one. A guard written `if (mod === 0)` against a `bigint` never fires, because
`0n === 0` is `false` — so the "modulus is zero" check silently passes and the division happens
anyway. Every literal in a BigInt routine must carry its `n`.

⚠️ MDN makes **no performance claim** about `BigInt` and neither does this page. Arbitrary-precision
arithmetic is not a single register operation, which is mechanism; there is no measured figure here
because none was measured. MDN's guidance on when to use it is a sentence: *"Only use a BigInt value
when values greater than 2^53 are reasonably expected."*

## Fix 2 — choose a modulus whose square is safe

If the problem lets you pick the modulus — a rolling hash, a randomised structure — pick one below
`√(2^53) ≈ 94906265`. Then `M² < 2^53` and plain `number` multiplication is exact. Any prime below
about `9.49 × 10^7` works; the cost is a larger collision probability, which for a hash is a
trade-off you can state rather than a correctness bug.

## Fix 3 — a `mulmod` that never forms the big product

Two ways, both exact, both in plain `number`.

**Splitting**, which is `Θ(1)` and works for any modulus below `2^31`:

```ts
// exact for 0 <= a, b < m < 2^31. Split a into a 16-bit low half and the rest.
export function mulmod(a: number, b: number, m: number): number {
  const hi = Math.floor(a / 65536);
  const lo = a % 65536;
  return ((hi * b % m) * 65536 + lo * b) % m;
}
```

Why every intermediate is exact: `hi < 2^15` and `b < 2^31`, so `hi * b < 2^46`; the reduced
`hi * b % m` is below `2^31`, so multiplying it by `2^16` stays below `2^47`; and `lo * b < 2^47`
likewise. The sum is below `2^48`, comfortably inside `2^53`.

**Doubling** (the "Russian peasant" product), which needs only `2m < 2^53` and is therefore good up
to a modulus around `4.5 × 10^15`, at a cost of `Θ(log b)` additions per multiply — which makes the
whole `powMod` `Θ(log² n)`:

```ts
export function mulmodDoubling(a: number, b: number, m: number): number {
  let result = 0;
  let x = a % m;
  let y = b;
  while (y > 0) {
    if (y % 2 === 1) result = (result + x) % m;   // every intermediate is below 2m
    x = (x + x) % m;
    y = Math.floor(y / 2);
  }
  return result;
}
```

Both are binary exponentiation's own idea applied one level down — a product is a repeated sum
exactly as a power is a repeated product.

## Choosing between them

| Approach | Exact for | Cost per multiply | Choose it when |
|---|---|---|---|
| `BigInt` | any modulus | arbitrary precision, not a register op | the modulus is imposed and large; correctness matters more than the constant |
| modulus below `94906265` | `M² < 2^53` | one `number` multiply | the modulus is yours — a rolling hash, a randomised structure |
| 16-bit split `mulmod` | `M < 2^31` | three `number` multiplies, two reductions | the modulus is imposed, below `2^31`, and `BigInt` is unwanted |
| doubling `mulmod` | `2M < 2^53` | `Θ(log b)` additions | the modulus is large but below about `4.5 × 10^15` |

The row that catches people is the second: if the problem is *yours* — a hash for de-duplicating
storefront product descriptions, a randomised set membership filter — then the modulus is a
parameter, and picking `M < 94906265` removes the entire class of bug at the cost of a stated
collision probability. That is a trade you can defend; a silently rounded product is not.

## Gotchas


**★ Symptom: a `bigint` guard never fires — `if (mod === 0)` passes for a modulus of `0n`.** Cause:
`0n === 0` is documented as `false`; strict equality across the BigInt/Number boundary is always
false. Fix: `0n` in every literal position. The same rule causes `e & 1` to throw `TypeError` where
`e & 1n` works, and MDN states it in one sentence: a BigInt *"cannot be mixed with a Number value in
operations"*.

**Symptom: `BigInt` is adopted and the modulus is now negative or zero without complaint.** Cause:
`BigInt` widens the range and changes nothing about validation. Fix: keep the `mod <= 0n` guard; and
note that `BigInteger.modPow` documents `ArithmeticException` for `m ≤ 0`, so the Java built-in
checks it for you and a hand-written loop does not.


**★ Symptom: the 16-bit split `mulmod` returns wrong answers for a modulus above `2^31`.** Cause:
its exactness argument depends on the operand bounds. With `a, b < m < 2^31`: `hi = ⌊a / 2^16⌋` is
below `2^15`, so `hi * b < 2^46`; the reduced `hi * b % m` is below `2^31`, so multiplying by `2^16`
stays below `2^47`; and `lo * b < 2^16 · 2^31 = 2^47`. The sum is below `2^48`, inside `2^53`. Raise
`m` past `2^31` and each of those bounds moves, and the sum crosses `2^53`. Fix: assert the
precondition, or use the doubling `mulmod`, whose only requirement is `2m < 2^53`.

**Symptom: `Number.isSafeInteger` is used to *detect* the problem after the fact and never fires.**
Cause: the rounded product is still a perfectly ordinary double and is still an integer-valued one;
`isSafeInteger` reports whether a value is within the safe range, and a rounded `10^18` is not
within it — so it *does* fire on the product, but not on `product % mod`, which is small and looks
fine. Fix: check the operands and the modulus up front rather than the result afterwards:
`if (mod > 94906265) throw new RangeError("modulus too large for number arithmetic")`.

## Interview questions


**★ You need `powMod` with a modulus of `10^9 + 7` in TypeScript. What do you write?**
`BigInt`, unless there is a reason not to. The loop is identical with `n`-suffixed literals, and the
three rules to respect are MDN's: a BigInt cannot be mixed with a Number in an operation (so `1n`,
not `1`, and no `Math.*` calls), `/` truncates toward zero, and `0n === 0` is `false` — that last one
silently disables any guard written against a Number literal. If BigInt is unacceptable, the two
alternatives are to pick a modulus below `√(2^53) ≈ 94906265`, so that `M²` is exactly
representable; or to write a `mulmod` that never forms the big product — either the 16-bit split,
which is `Θ(1)` for a modulus below `2^31`, or multiplication by doubling, which needs only
`2m < 2^53` but makes the whole `powMod` `Θ(log² n)`.

**What does `mulmod` by doubling cost, and when is it worth it?**
It replaces one multiplication with `Θ(log b)` additions, each of whose intermediates stays below
`2m` — so it needs only `2m` to be representable, not `m²`. That pushes the usable modulus in
JavaScript from about `9.5 × 10^7` up to about `4.5 × 10^15`. The cost is that `powMod` becomes
`Θ(log² n)` instead of `Θ(log n)`, which for a 64-bit exponent is a few thousand additions rather
than a hundred multiplications — usually fine. It is worth it when `BigInt` is unavailable or
unwanted and the modulus is too large for the 16-bit split trick. It is also a nice thing to
recognise: it is binary exponentiation's own idea applied one level down, since a product is a
repeated sum exactly as a power is a repeated product.


**★ Walk through why the 16-bit split `mulmod` is exact.**
Split `a` into `hi = ⌊a / 2^16⌋` and `lo = a mod 2^16`, so `a·b = hi·b·2^16 + lo·b`. With the
precondition `a, b < m < 2^31`: `hi < 2^15`, so `hi · b < 2^15 · 2^31 = 2^46`, well inside `2^53`.
Reduce that modulo `m`, giving a value below `2^31`; multiplying it by `2^16` gives at most `2^47`.
The other term `lo · b` is at most `2^16 · 2^31 = 2^47`. Their sum is below `2^48`. Every
intermediate is therefore an exactly representable integer, and the final `% m` is exact. The point
of walking the bounds is that the routine is only correct *within its precondition* — it is not a
general-purpose `mulmod`, and stating the precondition is the difference between using it and
copying it.

**Is `BigInt` slow?**
MDN makes no performance claim and I will not invent one. What can be said as mechanism is that
arbitrary-precision arithmetic is not a single machine instruction — the value is a variable-length
representation and every operation walks it — so it cannot be as cheap as a `number` multiply, and
MDN's own guidance reflects that: *"Only use a BigInt value when values greater than 2^53 are
reasonably expected."* If a number matters for a decision, measure it in your own runtime; do not
carry one from a page like this.

---

← Prev: [07b · Modular exponentiation and overflow](07b-modular-exponentiation-and-where-the-product-overflows.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [07d · The modular inverse](07d-the-modular-inverse.md)
