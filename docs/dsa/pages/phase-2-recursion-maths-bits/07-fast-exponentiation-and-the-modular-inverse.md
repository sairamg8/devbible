---
title: "Binary exponentiation is the binary expansion of the exponent read as a plan — square repeatedly, multiply in the powers whose bit is set — which turns n multiplications into about two log n of them, and which works for any associative operation, not just numbers"
sidebar_label: "07 · Binary exponentiation"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against
> [MDN's Bitwise AND page](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_AND)
> (the 32-bit operand coercion, which is true of every JavaScript bitwise operator) and
> [MDN's `Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER),
> both quoted verbatim below. Binary exponentiation itself is **textbook mathematics, derived on
> this page rather than cited** — the research bank for this phase records that it has no primary
> source. **No sandbox run** — this page carries code, never program output.

**Computing `a^n` by multiplying `a` by itself `n − 1` times is `Θ(n)`, and every problem that needs
it needs `n` to be large.** Binary exponentiation reduces that to `Θ(log n)` multiplications by
reading the exponent in binary: `a^13` is `a^8 · a^4 · a^1` because `13` is `1101₂`, and the powers
`a¹, a², a⁴, a⁸` come from repeated squaring at one multiplication each. That is about twice
`log₂ n` multiplications in total, which for a 64-bit exponent is under 130 — a bound so flat that
"the exponent is huge" stops being a consideration at all. The algorithm generalises beyond numbers:
it needs only that the operation is associative and has an identity, which is why the same eight
lines raise a matrix to a power, compose a permutation with itself a billion times, or apply a
linear recurrence. Its companion pages are the modular form, where every multiply must be reduced
and where the intermediate product is the trap
([07b](07b-modular-exponentiation-and-where-the-product-overflows.md)), the modular inverse it makes
possible ([07d](07d-the-modular-inverse.md)), and binomial coefficients under a modulus
([07e](07e-binomial-coefficients-under-a-modulus.md)), and the generalisation to any monoid —
matrices, permutations, min-plus — which is [07f](07f-any-associative-operation.md).

## The derivation

Write `n` in binary: `n = Σ bᵢ · 2ⁱ` with each `bᵢ` in `{0, 1}`. Then

```
a^n = a^(Σ bᵢ 2ⁱ) = Π_{i : bᵢ = 1} a^(2ⁱ)
```

The powers `a^(2ⁱ)` form a chain in which each is the square of the previous:
`a^(2⁰) = a`, and `a^(2^(i+1)) = (a^(2ⁱ))²`. So walk the bits of `n` from least significant to most
significant, maintaining the current `a^(2ⁱ)`, and multiply it into an accumulator whenever the bit
is set.

**Worked, for `n = 13 = 1101₂`:**

| step | bit | accumulator | current square |
|---|---|---|---|
| 0 | 1 | `a¹` | `a¹` |
| 1 | 0 | `a¹` | `a²` |
| 2 | 1 | `a¹·a⁴ = a⁵` | `a⁴` |
| 3 | 1 | `a⁵·a⁸ = a¹³` | `a⁸` |

Three squarings and three multiplications for an exponent of 13, against twelve multiplications for
the naive loop.

## The iterative form

```ts
// TypeScript — exponent handled with % and Math.floor, NOT with & and >>. See the gotcha below.
export function power(base: number, exp: number): number {
  if (!Number.isInteger(exp) || exp < 0) throw new RangeError("exp must be a non-negative integer");
  let result = 1;                    // ✅ the identity, not `base`
  let b = base;
  let e = exp;
  while (e > 0) {
    if (e % 2 === 1) result *= b;    // this bit is set: fold the current square in
    b *= b;                          // ✅ square unconditionally, on every iteration
    e = Math.floor(e / 2);
  }
  return result;
}
```

```java
// Java — the same, with the bit operators, which in Java operate on the full width of the type
static long power(long base, long exp) {
    if (exp < 0) throw new IllegalArgumentException("exp must be non-negative");
    long result = 1L;
    long b = base;
    long e = exp;
    while (e > 0) {
        if ((e & 1L) == 1L) result *= b;
        b *= b;
        e >>= 1;
    }
    return result;
}
```

Two details carry most of the bugs. **`result` starts at the identity, `1`** — starting it at `base`
computes `a^(n+1)`. And **the squaring is unconditional**: it happens on every iteration, inside the
loop but outside the `if`. Moving `b *= b` inside the `if` makes the chain of squares skip the
iterations whose bit is zero, so `a^(2ⁱ)` and the bit index fall out of step.

## The recursive form, and its recurrence

```ts
export function powerRec(base: number, exp: number): number {
  if (exp === 0) return 1;
  const half = powerRec(base, Math.floor(exp / 2));   // ✅ computed ONCE
  const squared = half * half;
  return exp % 2 === 0 ? squared : squared * base;
}
```

The recurrence is `T(n) = T(n/2) + Θ(1)`, whose solution is `Θ(log n)`. In master-theorem terms
that is `a = 1`, `b = 2`, `f(n) = Θ(1)`: `n^(log_b a) = n^0 = 1`, so `f(n) = Θ(n^(log_b a))` and
case 2 applies, giving `Θ(n^(log_b a) · log n) = Θ(log n)` —
[Phase 1 · Recurrences and the master theorem](../phase-1-complexity/08-recurrences-and-the-master-theorem.md)
is where that machinery lives.

🔴 **The one-character version of this that is `Θ(n)` instead:**

```ts
// ⛔ two recursive calls, each recomputing the same value
return exp % 2 === 0
  ? powerRec(base, exp / 2) * powerRec(base, exp / 2)
  : powerRec(base, exp - 1) * base;
```

That is `T(n) = 2·T(n/2) + Θ(1)`, master-theorem case 1 with `n^(log₂ 2) = n`, giving `Θ(n)` — the
whole benefit gone, and the code looks almost identical. Binding the recursive call to a local is
the fix, and it is the same "compute the subproblem once" discipline that
[Phase 1 · Recursion as a tree](../phase-1-complexity/02b-recursion-as-a-tree.md) draws pictures of.

The recursive version uses `Θ(log n)` stack frames, which is never a depth problem; the iterative
version uses `Θ(1)` space. Ship the iterative one, and be able to write either.

## 🔴 The exponent must not be shifted in JavaScript

The Java version above uses `e & 1` and `e >>= 1`. The TypeScript version deliberately does not, and
the reason is that JavaScript's bitwise operators do not operate on the value you gave them:

> *"It performs BigInt AND if both operands become BigInts; otherwise, it converts both operands to
> 32-bit integers and performs number bitwise AND."* — MDN, Bitwise AND

> *"Numbers with more than 32 bits get their most significant bits discarded."* — MDN, Bitwise AND

> *"The operator operates on the operands' bit representations in two's complement."* — MDN,
> Bitwise AND

So `exp & 1` on an exponent above `2^31` is computed on a *truncated, signed, 32-bit* copy of the
exponent. The loop then terminates early or reads the wrong bits, and the result is wrong with no
error. `exp % 2` and `Math.floor(exp / 2)` are ordinary floating-point arithmetic on the full value
and are exact for every integer up to `2^53 − 1`, which is the honest range of a JavaScript
`number`:

> *"The `Number.MAX_SAFE_INTEGER` static data property represents the maximum safe integer in
> JavaScript (2^53 – 1)."* — MDN, `Number.MAX_SAFE_INTEGER`

If the exponent itself needs to exceed that, the whole computation belongs in `BigInt`, whose
bitwise operators are documented not to truncate:

> *"For BigInts, there's no truncation. Conceptually, understand positive BigInts as having an
> infinite number of leading `0` bits, and negative BigInts having an infinite number of leading `1`
> bits."* — MDN, Bitwise AND

The full treatment of JavaScript's bitwise coercion is **04 · Bit manipulation** *(not written
yet)*; here it is enough to know that the exponent of a `power` function is exactly the kind of
value that outgrows 32 bits, and that Java has no equivalent problem because `>>` and `&` on a
`long` operate on all 64 bits.

## Gotchas

**★ Symptom: the "fast" exponentiation is no faster than the naive loop.** Cause: the recursive
version calls itself twice — `pow(a, n/2) * pow(a, n/2)` — so the recurrence is `T(n) = 2T(n/2) + Θ(1)`
and the solution is `Θ(n)`, not `Θ(log n)`. Fix: bind the result once:

```ts
const half = powerRec(base, Math.floor(exp / 2));   // ✅ one call
return exp % 2 === 0 ? half * half : half * half * base;
```

**★ Symptom: in TypeScript, `power` returns a wrong answer only for very large exponents.** Cause:
the loop used `exp & 1` and `exp >>>= 1`, and MDN documents that JavaScript's bitwise operators
convert their operands to 32-bit integers and discard the most significant bits of anything larger.
The exponent is silently truncated. Fix: `exp % 2` and `Math.floor(exp / 2)`, which are exact for
every integer up to `2^53 − 1`; or move the whole computation to `BigInt`, whose bitwise operators
are documented not to truncate. Java has no such problem — `&` and `>>` on a `long` use all 64 bits.

**★ Symptom: the result is `a^(n+1)` — one factor too many.** Cause: the accumulator was initialised
to `base` instead of to the identity `1`. Fix: `let result = 1;`. The tell in testing is that
`power(a, 0)` returns `a` rather than `1`.

**★ Symptom: the result is wrong for exponents with a zero bit, and right for `2^k − 1`.** Cause:
the squaring `b *= b` was placed inside the `if (bit)` branch, so the chain of squares only advances
on set bits and `b` stops being `a^(2ⁱ)` at bit index `i`. Exponents whose bits are all ones happen
to work, which is what makes the bug survive a quick test. Fix: square unconditionally, once per
iteration, outside the `if`.

**★ Symptom: `power(a, 0)` returns `0`, or a negative exponent loops forever.** Cause: no base case
and no guard. `a^0` is `1` for every `a` including `0` under the convention this algorithm needs
(the empty product is the identity), and a negative exponent has no integer answer at all. Fix:
`if (exp < 0) throw` at the entry, and let `while (e > 0)` handle `exp === 0` by returning the
initialised `1`. Under a modulus, a negative exponent *does* have a meaning — it is a power of the
inverse — which is [07d](07d-the-modular-inverse.md).

**★ Symptom: without a modulus, the answer is `Infinity`, or is subtly wrong for a moderate
exponent.** Cause: `a^n` outgrows the exact-integer range almost immediately — `2^54` is already
past `2^53 − 1`, which MDN documents as the largest safely representable integer. Fix: if the true
value is wanted, use `BigInt` / `BigInteger`; if a residue is wanted, use the modular form and
reduce every multiply, which is [07b](07b-modular-exponentiation-and-where-the-product-overflows.md).
Unmodular `power` over `number` is useful only when you know the result is small.

**Symptom: `power` is used where `Math.pow` would do.** Cause: reaching for the algorithm rather
than the requirement. Fix: for floating-point results, the built-in is right. Binary exponentiation
earns its place when the operation is *not* floating-point multiplication — under a modulus, on
matrices, on permutations — or when exactness matters over `BigInt`.

## Interview questions

**★ Derive binary exponentiation and state its complexity.**
Write the exponent in binary, `n = Σ bᵢ 2ⁱ`. Then `a^n = Π_{bᵢ = 1} a^(2ⁱ)`, and the factors
`a^(2ⁱ)` form a chain where each is the square of the previous, so all of them cost one
multiplication each. Walk the bits from least significant upward, squaring the running power every
step and folding it into an accumulator whenever the bit is set. There are `⌊log₂ n⌋ + 1` bits, so
at most that many squarings and at most that many accumulator multiplications — `Θ(log n)`
multiplications, `Θ(1)` extra space in the iterative form. Recursively it is `T(n) = T(n/2) + Θ(1)`,
which the master theorem's second case resolves to `Θ(log n)`.

**★ What is wrong with `return pow(a, n/2) * pow(a, n/2)`?**
It computes the same subproblem twice, so the recurrence becomes `T(n) = 2T(n/2) + Θ(1)`, which is
`Θ(n)` — exactly the naive cost the algorithm was meant to avoid, wrapped in a recursion that looks
clever. The fix is to bind the recursive result to a local and square it. It is the same failure as
naive recursive Fibonacci in miniature, and it is worth being able to name the recurrence for both
versions rather than saying "that's slower".

**★ Your TypeScript version uses `%` and `Math.floor` where the Java version uses `&` and `>>`. Why
not use the bit operators in both?**
Because JavaScript's bitwise operators do not act on the number you pass them. MDN says they convert
both operands to 32-bit integers and that numbers with more than 32 bits have their most significant
bits discarded, with the result interpreted in two's complement. An exponent above `2^31` is
therefore silently truncated and possibly negative, and the loop reads the wrong bits or exits early
— with no error. `exp % 2` and `Math.floor(exp / 2)` are ordinary arithmetic on the full double and
are exact for every integer up to `2^53 − 1`. Java's `&` and `>>` on a `long` operate on all 64
bits, so the idiomatic version there is fine. If the exponent must exceed `2^53 − 1` in JavaScript,
use `BigInt`, whose bitwise operators are documented to have no truncation at all.

**★ Exactly how many multiplications does it perform?**
At most `2·⌊log₂ n⌋ + 1`: one squaring per bit position after the first, plus one accumulator
multiplication per *set* bit. So the exact count is `⌊log₂ n⌋` squarings plus `popcount(n)`
multiplications, and the worst case is an exponent whose bits are all ones. That is worth being able
to say because it makes the practical point concrete: a 64-bit exponent costs under 130
multiplications, which is why "the exponent is enormous" simply stops being a constraint. It is also
*not* the minimum — the shortest addition chain for a given `n` can be shorter, and finding it is
its own hard problem; binary exponentiation is the simple near-optimal one.

**Why must the squaring be outside the `if`?**
Because the running value `b` has to be `a^(2ⁱ)` at bit index `i`, and the bit index advances every
iteration regardless of whether the bit is set. Putting `b *= b` inside the `if` advances the square
chain only on set bits, so `b` desynchronises from the bit position. The bug is invisible for
exponents of the form `2^k − 1`, whose bits are all ones, which is exactly the family of small test
values someone is likely to try.

---

← Prev: [06j · N-Queens and symmetry](06j-n-queens-and-symmetry.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [07b · Modular exponentiation and overflow](07b-modular-exponentiation-and-where-the-product-overflows.md)
