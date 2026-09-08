---
title: "Wrapping arithmetic is legitimate exactly when the value's meaning is already a residue modulo 2^w — which is why Java specifies String.hashCode as computed using int arithmetic, and why a rolling hash may either take a prime modulus or simply let a long wrap"
sidebar_label: "05e · Overflow on purpose"
sidebar_position: 5.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. `String.hashCode`'s formula and the phrase *"using `int` arithmetic"* are
> quoted verbatim from the JDK 25
> [`String`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/String.html)
> javadoc, fetched for this page. `Integer.MAX_VALUE` / `MIN_VALUE` are the JDK 25
> [`Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)
> javadoc; JavaScript's 32-bit coercion is MDN,
> [Bitwise AND](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_AND);
> the safe-integer range is MDN,
> [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER).
> The exactness argument for `(h * 31 + c) | 0` is **arithmetic derived on the page**. ⚠️ `Math.imul`
> is named as JavaScript's 32-bit integer multiplication; its reference page was **not** fetched, so
> nothing beyond that is asserted. ⚠️ The remark about adversarial inputs against a fixed hash is
> **reasoning, not a cited result**. **No sandbox run.** Version spine: **JDK 25 · MDN as fetched
> 2026-09-07**.

**Every previous page in this topic treated overflow as a defect; this one is about the case where
it is the specification.** Wrapping arithmetic is not undefined and not approximate — it is exact
arithmetic modulo 2^32 or 2^64, deterministic, and reproducible. That makes it a perfectly good
*reduction* step for a value whose meaning is already "a number modulo the word size", which is what
a hash code is. Java says so about its own strings, in the javadoc, with the words *"using `int`
arithmetic"* — which makes the overflow part of the specification rather than an accident of the
implementation. This page is that rule, the `String.hashCode` formula it is stated on, the
TypeScript reimplementation that has to force the wrap by hand, and rolling hashes, where the choice
of modulus *is* an overflow decision. The consequence for two services that must agree on the same
number is [05f](05f-the-cross-language-trap.md).

## The rule for when overflow is allowed

**Overflow is acceptable exactly when the value's meaning is a residue.** Ask what the number *is*:

- A count, a total, an index, a length, a quantity, a price, an identifier — these have magnitudes
  that mean something, so wrapping changes the meaning and is a bug. Every page in
  [05d](05d-the-three-silent-overflows.md) is one of these.
- A hash code, a checksum, a fingerprint, a mixing state, a pseudo-random generator's state — these
  are defined modulo the word size in the first place, so wrapping *is* the reduction, and there is
  nothing to check.

The property a hash code has to preserve is that equal inputs give equal codes. Wrapping is a
deterministic function of the inputs, so it preserves that entirely — the wrap is not randomness, it
is the modulus.

⛔ **What wrapping never buys you: uniqueness, ordering or security.** A wrapped hash collides by
construction — 2^32 possible values for unboundedly many inputs — so it can index a bucket and it
cannot identify a row. And `hashCode` is not a cryptographic digest; it is designed to be cheap and
well-distributed, not to resist an adversary.

## Java's `String.hashCode`, and the sentence that makes the wrap official

> *"Returns a hash code for this string. The hash code for a `String` object is computed as `s[0]*31^(n-1) + s[1]*31^(n-2) + ... + s[n-1]` using `int` arithmetic, where `s[i]` is the ith character of the string, `n` is the length of the string, and `^` indicates exponentiation. (The hash value of the empty string is zero.)"* — JDK 25, `String.hashCode`

Three things follow from that one paragraph.

**The formula is a polynomial in 31 over the characters** — the same construction as a rolling hash,
below.

**"using `int` arithmetic" is the specification of the overflow.** A string of any real length
produces a polynomial vastly beyond 2^31, so the value is reduced modulo 2^32 at every step. The
javadoc does not treat that as a caveat; it is the definition. That is what makes the result
*specified* rather than merely *implementation-defined* — the same string gives the same `int` on
every JVM.

**The empty string is zero**, which is stated explicitly and is the base case of any reimplementation.

The Java loop that computes it is the polynomial evaluated by Horner's method, with the wrap left
implicit:

```java
static int javaStringHash(String s) {
    int h = 0;
    for (int i = 0; i < s.length(); i++) h = 31 * h + s.charAt(i);   // wraps, on purpose
    return h;
}
```

## Reproducing it exactly in JavaScript

This is where the topic's two halves meet. JavaScript has no `int`, so the wrap does not happen; the
accumulator grows as an exact double until it passes 2^53 and then starts **rounding**, which is
neither the Java answer nor a stable answer of its own. The fix is to force the 32-bit truncation at
every step, and `| 0` is exactly that operator — MDN: *"For numbers, the operator returns a 32-bit
integer."*

```ts
// bit-for-bit identical to Java's String.hashCode for the same UTF-16 code units
export function javaStringHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;   // the | 0 IS the int arithmetic
  }
  return h;                                // may be negative — that is correct, Java's is too
}
```

🔴 **Why `h * 31` is safe to compute as a double before truncating, derived rather than asserted.**
After each `| 0`, `h` is a 32-bit signed value, so its magnitude is below 2^31. Multiplying by 31
gives a magnitude below 31 × 2^31, which is under 2^36; adding a UTF-16 code unit (below 2^16)
leaves it well under 2^37. That is far inside the exactly-representable range, which MDN puts at
*"integers between -(2^53 – 1) and 2^53 – 1"*, so the double holds the product exactly and the `| 0`
then performs precisely the truncation Java's `int` arithmetic performs. **The derivation depends on
the multiplier being small.**

⚠️ **With a large multiplier it stops being safe.** A general 32-bit multiplication has a product up
to about 2^62 — beyond 2^53 — so `(a * b) | 0` rounds before it truncates and gives the wrong 32-bit
result. JavaScript's answer for that case is `Math.imul`, the 32-bit integer multiplication; this
page names it and asserts nothing further, because its reference page was not fetched. The rule to
carry: **`x * k | 0` is exact only while the product stays under 2^53; otherwise reach for
`Math.imul`.**

## Rolling hashes: overflow as the modulus, or a prime as the modulus

A polynomial rolling hash treats a string as a number in base `B` and reduces it modulo `M`:
`H = s[0]·B^(n-1) + s[1]·B^(n-2) + … + s[n-1] (mod M)`. The point is that a window can be advanced
in constant time — drop the leading term's contribution, shift, add the new character:

```ts
// H(next window) = (H(current) - s[i]*B^(k-1)) * B + s[i+k]   — all modulo M
export function rollingHashes(s: string, k: number, B: bigint, M: bigint): bigint[] {
  if (s.length < k) return [];
  let power = 1n;                                   // B^(k-1) mod M, precomputed once
  for (let i = 1; i < k; i++) power = (power * B) % M;

  let h = 0n;
  for (let i = 0; i < k; i++) h = (h * B + BigInt(s.charCodeAt(i))) % M;

  const out = [h];
  for (let i = k; i < s.length; i++) {
    h = (h - (BigInt(s.charCodeAt(i - k)) * power) % M + M) % M;   // + M: % is a remainder, not a modulus
    h = (h * B + BigInt(s.charCodeAt(i))) % M;
    out.push(h);
  }
  return out;
}
```

Two choices of `M`, and they are the two halves of this topic:

- **An explicit prime near 10^9.** Every multiply produces an intermediate near 10^18, which needs
  Java's `long` and TypeScript's `BigInt` — the second of
  [05d](05d-the-three-silent-overflows.md)'s three overflows, exactly. Precomputing `B^(k-1)` avoids
  needing a modular inverse to remove the leading term; the inverse route belongs to [Fast
  exponentiation and the modular inverse](07-fast-exponentiation-and-the-modular-inverse.md).
- **2^64, by letting a Java `long` wrap.** No `%` at all — the hardware does the reduction. This is
  the fastest formulation and it is deliberate overflow in its purest form. ⚠️ It is also the easiest
  to attack: because the modulus is fixed and public, an adversary who knows the base can construct
  inputs that collide. That is reasoning about determinism, not a cited result — but the practical
  advice it supports is sound and standard: randomise the base per process, or use a prime modulus,
  wherever the input is attacker-controlled.

The `+ M` in the removal step is not about overflow; it is because `%` is a *remainder* and returns
a negative value for a negative left operand, in both languages. That subject — `Math.floorMod` and
`((x % m) + m) % m` — belongs to [Mathematical foundations](03-mathematical-foundations.md).

## Gotchas

**★ Symptom: a JavaScript hash loop produces enormous numbers and then unstable ones.** Cause: no
truncation at all, so the accumulator grew past 2^53 and started rounding to the nearest
representable double. Fix: `| 0` inside the loop, not on the return value; truncating only at the
end truncates a value whose digits are already gone.

**★ Symptom: replacing `31` with a large multiplier in the JavaScript port changes the answer.**
Cause: `(h * k) | 0` is only exact while the product stays under 2^53, which holds for a small `k`
and not for a general 32-bit one — a full 32-by-32 product reaches about 2^62. Fix: `Math.imul`,
JavaScript's 32-bit integer multiplication.

**★ Symptom: a `hashCode` was used as a unique key and rows collided.** Cause: 32 bits of output for
unboundedly many inputs — collisions are guaranteed by counting, not by bad luck, and the wrap is
what makes it a residue rather than an identity. Fix: hash codes select buckets; identifiers come
from a sequence, a UUID or a cryptographic digest.

**★ Symptom: `hash % buckets` produces a negative bucket index.** Cause: a Java hash code can be
negative — `Integer.MIN_VALUE` at the extreme — and `%` is a remainder that keeps the dividend's
sign. Fix: mask with `hash & (buckets - 1)` when the bucket count is a power of two
([04b](04b-the-single-bit-idioms-and-masks.md)), or `Math.floorMod`. Not `Math.abs`, which fails for
`Integer.MIN_VALUE` ([04c](04c-clearing-and-isolating-the-lowest-bit.md)).

**Symptom: a rolling hash with a power-of-two modulus starts colliding on real traffic.** Cause: a
fixed, public modulus and base make collisions constructible by anyone who knows them — reasoning
from determinism, not a cited result, but enough to act on. Fix: randomise the base per process, or
use a prime modulus with a `long` / `BigInt` multiply.

**Symptom: a rolling hash goes negative after the removal step.** Cause: `%` is a remainder, so
subtracting the leading term can leave a negative residue. Fix: `((h - term) % M + M) % M`, which is
the modular-arithmetic idiom rather than an overflow one.

## Interview questions

**★ When is integer overflow acceptable?**
When the value's meaning is already a residue modulo the word size. Hash codes, checksums,
fingerprints and PRNG state are defined that way, so wrapping is the reduction step, not a defect —
it is exact, deterministic and reproducible, which is all a hash needs. Java says this about its own
strings: `String.hashCode` is computed with the polynomial in 31 *"using `int` arithmetic"*, and
that phrase is what makes the overflow part of the specification rather than an accident. It is
never acceptable for a count, a total, an index, a length or an identifier, because those have
magnitudes that mean something and wrapping changes what they mean.

**★ Reimplement Java's `String.hashCode` in TypeScript.**
`let h = 0; for each code unit: h = (h * 31 + s.charCodeAt(i)) | 0; return h;` — and the `| 0` is
the whole answer, because it is what supplies the `int` arithmetic the javadoc specifies. It is
exact for this multiplier and worth being able to show why: after each truncation `h` is below 2^31
in magnitude, so `h * 31` is under 2^36 and the sum with a code unit is under 2^37, comfortably
inside the range where a double represents integers exactly, so the truncation afterwards is the
same truncation Java performs. The result can be negative — Java's is too, and that is correct
rather than something to `Math.abs` away. With a larger multiplier the intermediate would exceed
2^53 and you would need `Math.imul`.

**★ You are writing a rolling hash. What modulus, and why?**
Either a prime near 10^9, or 2^64 by letting a Java `long` wrap — and the choice is an overflow
decision. The prime keeps every intermediate product near 10^18, which fits a `long` and needs
`BigInt` in TypeScript, and it is the version to pick when the input is attacker-controlled, ideally
with a base randomised per process. The power-of-two version does no `%` at all, because the
hardware's wrap is the reduction, which is the fastest formulation and the easiest for someone who
knows your parameters to construct collisions against. Either way, precompute `B^(k-1)` so removing
the leading term needs no modular inverse, and remember `%` is a remainder — add the modulus back
after the subtraction.

**Is `hashCode` good enough for a cache key?**
For an in-process bucket index, yes — that is what it is for. For a shared cache key across
services, no, for two reasons that have nothing to do with speed. It is 32 bits, so collisions are a
counting certainty rather than a risk, and two different carts can map to one cached price. And it
is language-specific: `String.hashCode` is specified, but `Object.hashCode` on your own types is
whatever your implementation does, and nothing outside the JVM reproduces it. A shared key wants a
digest with a written specification and enough output bits that collisions are not a design
consideration.

---

← Prev: [05d · The three silent overflows](05d-the-three-silent-overflows.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [05f · The cross-language trap](05f-the-cross-language-trap.md)
