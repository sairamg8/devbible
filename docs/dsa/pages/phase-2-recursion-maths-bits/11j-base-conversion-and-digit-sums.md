---
title: "Base conversion is the same digit loop with b in place of 10, and the three traps are the sign of %, a spreadsheet column that is bijective base-26 rather than base-26, and the fact that Java quietly falls back to radix 10 where JavaScript throws"
sidebar_label: "11j · Base conversion and digit sums"
sidebar_position: 11.9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the JDK 25 javadoc for
> [`java.lang.Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)
> (`toString(int,int)`, `toBinaryString(int)`) and
> [`java.lang.Math`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Math.html)
> (`floorMod`), and MDN,
> [`Number.prototype.toString()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toString)
> (the radix range, the `RangeError`, and the negative-number rule with its documented examples) and
> [`parseInt()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt)
> — all quoted verbatim. The digital-root derivation is **elementary modular arithmetic derived on
> this page**; the congruence machinery is [03j](03j-modular-arithmetic-and-the-remainder-trap.md).
> **No sandbox run.** Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**Change the `10` to a `b` and [11](11-number-problems-that-recur.md)'s loop converts to any base;
everything interesting is at the edges.** The sign of `%` reappears with the same consequences. Zero
still needs the `do/while`. And the two platforms' built-in converters disagree in two documented
ways that will bite you: on how a negative number is rendered in binary, and on what happens when
the radix is out of range — JavaScript throws, Java silently uses 10. This page also closes the
loop on digit sums, whose repeated form has a closed formula that falls straight out of the fact
that `10 ≡ 1 (mod 9)`.

## To a base, from a base

```ts
const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

function toBase(n: number, b: number): string {
  if (b < 2 || b > 36) throw new RangeError("radix out of range");
  const negative = n < 0;
  n = Math.abs(n);
  let out = "";
  do {
    out = DIGITS[n % b] + out;          // prepend: digits come out least-significant first
    n = Math.trunc(n / b);
  } while (n > 0);
  return negative ? "-" + out : out;
}

function fromBase(s: string, b: number): number {
  let acc = 0;
  for (const ch of s.toLowerCase()) {
    const d = DIGITS.indexOf(ch);
    if (d < 0 || d >= b) throw new RangeError(`bad digit '${ch}' for base ${b}`);
    acc = acc * b + d;                  // Horner
  }
  return acc;
}
```

Three things in `toBase` are the content. **The sign is stripped once, at the top**, and re-attached
at the end — because `n % b` takes the sign of `n`, so a negative `n` would index `DIGITS` with a
negative number and yield `undefined` in TypeScript or an exception in Java
([11](11-number-problems-that-recur.md), [03k](03k-the-remainder-trap-in-indices-hashes-and-shards.md)).
**The loop is `do/while`**, so `toBase(0, 2)` is `"0"` rather than `""`. And **digits are prepended**,
because the loop produces them least-significant first; building them in an array and reversing is
equivalent and usually cheaper than repeated string concatenation.

`fromBase` is Horner's method — `acc = acc · b + d` — which is the reverse loop and is exactly the
digit-accumulation step of [11g](11g-string-to-integer.md). In a fixed-width type it needs the same
overflow discipline: check before the multiply, or accumulate in a wider type
([05d](05d-the-three-silent-overflows.md)).

In Java the same two functions want `Math.floorMod(n, b)` if you choose *not* to strip the sign,
since *"if neither `floorMod(x, y)` nor `x % y` is zero, they differ exactly when the signs of the
arguments differ"* — but stripping the sign is clearer, and `Math.abs` is safe here only if you have
already handled `Integer.MIN_VALUE` ([11](11-number-problems-that-recur.md)).

## The built-ins disagree, and both disagreements are documented

**Negative numbers in binary.** MDN, on `Number.prototype.toString`:

> *"If the specified number value is negative, the sign is preserved. This is the case even if the
> radix is 2; the string returned is the positive binary representation of the number value preceded
> by a `-` sign, **not** the two's complement of the number value."*

MDN documents the examples `(-10).toString(2)` as `"-1010"` and `(-0xff).toString(2)` as
`"-11111111"`.

Java's `Integer.toString(int, int)` behaves the same way:

> *"If the first argument is negative, the first element of the result is the ASCII minus character
> `'-'` (`'\u002D'`). If the first argument is not negative, no sign character appears in the result.
> The remaining characters of the result represent the magnitude of the first argument."*

But `Integer.toBinaryString` does **not**:

> *"Returns a string representation of the integer argument as an unsigned integer in base 2."*

> *"The unsigned integer value is the argument plus 2^32 if the argument is negative; otherwise it is
> equal to the argument. This value is converted to a string of ASCII digits in binary (base 2) with
> no extra leading `0`s."*

**So Java gives you both conventions under two different method names, and JavaScript gives you only
the sign-magnitude one.** If you want the two's-complement bit pattern in JavaScript you must produce
it yourself — `(n >>> 0).toString(2)` uses the unsigned right shift's 32-bit coercion to do it, which
is the one place that operator is the right tool rather than a trap
([04g](04g-the-32-bit-ceiling-and-what-to-use-instead.md)). Debugging a bitmask by printing
`(-1).toString(2)` and seeing `"-1"` is how people discover this.

**An out-of-range radix.** MDN: the parameter is *"an integer in the range `2` through `36`"* and a
`RangeError` is *"Thrown if `radix` is less than 2 or greater than 36."* Java:

> *"If the radix is smaller than `Character.MIN_RADIX` or larger than `Character.MAX_RADIX`, then the
> radix `10` is used instead."*

**One throws and one silently produces decimal.** A configuration value that arrives as `0` or `1`
gives you a loud failure in one runtime and a plausible wrong string in the other — which is the
worse outcome, and the reason to validate the radix yourself in both.

Reading back, `parseInt`'s radix has a third behaviour again: *"if it's nonzero and outside the range
of [2, 36] after conversion, the function will always return `NaN`"*, and *"if `0` or not provided,
the radix will be inferred"*. Three functions, three answers, all documented
([11h](11h-what-the-platform-parsers-do.md)).

## Digit sums and the digital root

The **digit sum** is the loop with `sum += n % 10`. The **digital root** is the digit sum applied
repeatedly until one digit remains — and it has a closed form, which is worth deriving rather than
memorising.

Since `10 ≡ 1 (mod 9)`, every power of ten is also `≡ 1 (mod 9)`, so a number
`Σ dᵢ · 10^i ≡ Σ dᵢ (mod 9)`. **A number and its digit sum are congruent modulo 9** — which is the
whole of "casting out nines". Iterating preserves the congruence, so the digital root of `n` is the
unique value in `1 … 9` congruent to `n` modulo 9, except that `0` has digital root `0`:

```ts
const digitalRoot = (n: number): number => (n === 0 ? 0 : 1 + ((n - 1) % 9));
```

The `1 + (n − 1) % 9` form exists because the answer's range is `1 … 9` rather than `0 … 8` — a plain
`n % 9` would map every multiple of nine to `0` instead of `9`. **And it is wrong for negative `n`**,
because `%` takes the dividend's sign: guard the domain, or use `Math.floorMod`. This is
[03k](03k-the-remainder-trap-in-indices-hashes-and-shards.md)'s trap arriving in a one-line formula
where nobody looks for it.

Casting out nines is a genuine checksum: if the digital roots of two factors multiply to something
whose digital root differs from the product's, the product is definitely wrong. It cannot prove
correctness — any error that is a multiple of 9, including a transposed pair of digits, is invisible
to it — which is exactly why modern checksums do not use it and why it is a good example of a
one-sided test ([10i](10i-why-add-randomness.md) has the Monte Carlo framing).

## Where base conversion shows up for real

- **Base62 or base58 short ids.** Encoding a numeric id into `[0-9a-zA-Z]` shortens a URL. 🔴 An
  encoded sequential id is still sequential — the encoding is a *rendering*, not a secret, and it is
  reversible by anyone. If the id must be unguessable, the entropy has to come from
  [10e](10e-the-security-boundary.md)'s generator, not from the alphabet.
- **Hex encoding of bytes**, where the fixed two-characters-per-byte padding matters and the general
  `toBase` above does not produce it — you need `padStart(2, "0")` per byte.
- **Spreadsheet column names**, which are the trap below.
- **Base −2 and other exotic bases**, which exist and are a puzzle rather than a tool. Named, not
  derived.

### Spreadsheet columns are bijective base-26, not base-26

`A` is 1, `Z` is 26, `AA` is 27. There is **no digit for zero**, so this is *bijective* base-26 and
the ordinary loop is off by one at every multiple of 26. The correction is to decrement before each
digit extraction:

```ts
function columnName(n: number): string {          // 1 -> "A", 26 -> "Z", 27 -> "AA"
  let out = "";
  while (n > 0) {
    n--;                                          // ← the whole fix
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.trunc(n / 26);
  }
  return out;
}
```

Without the `n--`, `n = 26` gives `n % 26 === 0` and emits `"A"` with a carry, producing `"AA"`
instead of `"Z"`. **Recognising "there is no zero digit" is the entire problem**, and it is the same
recognition behind Roman numerals having no zero ([11f](11f-roman-numerals.md)).

## Gotchas

**★ Symptom: `toBase(-10, 2)` produces `undefined` characters or throws.** Cause: `n % b` is negative
for negative `n`, so it indexes the digit alphabet with a negative number. Fix: strip the sign once
at the top and re-attach it, or use `Math.floorMod`. Never index an array with a raw `%` result.

**★ Symptom: `toBase(0, 2)` returns the empty string.** Cause: `while (n > 0)` never runs. Fix:
`do/while`. Zero is one digit in every base.

**★ Symptom: `(-1).toString(2)` yields a sign-magnitude string where you expected 32 ones.**
Cause: MDN's documented rule — the sign is preserved and the result is *"not the two's complement of
the number value"*.
Fix: `(n >>> 0).toString(2)` for the unsigned 32-bit pattern, and pad it to 32 characters yourself.
In Java, `Integer.toBinaryString` already gives the unsigned form, *"the argument plus 2^32 if the
argument is negative"*.

**★ Symptom: `Integer.toString(n, 1)` returns a decimal string instead of failing.** Cause: the
documented fallback — *"If the radix is smaller than `Character.MIN_RADIX` or larger than
`Character.MAX_RADIX`, then the radix 10 is used instead."* Fix: validate the radix before the call.
JavaScript throws a `RangeError` for the same input, so code ported between them fails in different
places.

**★ Symptom: `digitalRoot(-18)` returns something outside `1 … 9`.** Cause: `%` takes the dividend's
sign, so `(n − 1) % 9` is negative. Fix: define the domain as non-negative and reject the rest, or
use `Math.floorMod`. A one-line formula is exactly where a sign trap survives review.

**★ Symptom: `digitalRoot(9)` returns 0.** Cause: written as `n % 9` instead of `1 + (n − 1) % 9`.
Fix: the result range is `1 … 9`, not `0 … 8`; multiples of nine must map to 9. Zero remains the
sole exception and needs its own branch.

**★ Symptom: spreadsheet column 26 comes out as `"AA"`.** Cause: bijective base-26 treated as ordinary
base-26. Fix: decrement `n` before each digit extraction. The absence of a zero digit is the whole
difference and it only shows at multiples of 26 — which is why 1 to 25 all test correctly.

**★ Symptom: a base-62 short id is treated as unguessable.** Cause: confusing an encoding with a
secret. Fix: encoding is reversible by definition; if unguessability is required, generate the value
from a cryptographic source and then encode it ([10e](10e-the-security-boundary.md)).

**★ Symptom: `fromBase` accepts digits that do not belong to the base.** Cause: looking the character
up in the full 36-character alphabet without checking it against `b`. Fix: reject when the digit
index is at or above the radix. `parseInt("19", 8)` illustrates the platform behaviour — it stops at
the invalid `9` and returns what it read, per MDN's stop-at-first-invalid rule, which is lenience
your own converter probably should not copy.

**★ Symptom: converting a large value loses precision in JavaScript.** Cause: the value exceeded
`Number.MAX_SAFE_INTEGER` before conversion. Fix: `BigInt`, whose `toString(radix)` handles arbitrary
sizes ([05b](05b-bigint-and-when-to-reach-for-it.md)). Converting first and worrying later gives you
a correctly formatted rendering of the wrong number.

## Interview questions

**★ Convert an integer to an arbitrary base, and back.**
Forward: strip and remember the sign, then repeatedly take `n % b` as the least significant digit and
divide by `b`, using a `do/while` so zero produces `"0"`, and prepend each digit or collect and
reverse. Backward: Horner, `acc = acc · b + digit`, validating that each digit is below the radix.
The three edge cases are the sign — because `%` follows the dividend, so a negative `n` would index
the digit alphabet negatively — zero, and, in a fixed-width type, overflow during the Horner
accumulation, which needs the check performed before the multiply.

**★ Why does `(-10).toString(2)` give `"-1010"` and not a two's-complement pattern?**
Because MDN documents that behaviour explicitly: the sign is preserved and the result is the
positive binary representation preceded by `-`, *"not the two's complement of the number value"*.
Java's `Integer.toString(i, 2)` does the same, emitting a `'-'` and then the magnitude. The
two's-complement rendering in Java is a different method, `Integer.toBinaryString`, documented as
producing *"an unsigned integer in base 2"*, the value being *"the argument plus 2^32 if the argument
is negative"*. In JavaScript you get it with `(n >>> 0).toString(2)`, using the unsigned shift's
32-bit coercion.

**★ What is a digital root, and why is there a closed form?**
It is the result of summing digits repeatedly until one digit remains, and the closed form is
`0` for `0` and `1 + (n − 1) mod 9` otherwise. The reason is that `10 ≡ 1 (mod 9)`, so every power of
ten is congruent to 1 and a number is congruent to its digit sum modulo 9 — the congruence is
preserved by every iteration, so the fixed point is the representative of `n mod 9` in the range
`1 … 9`. The `1 + (n − 1)` shift is what moves the range off `0 … 8` so that multiples of nine give
9 rather than 0, and the formula is wrong for negative input because `%` takes the dividend's sign.

**★ Spreadsheet columns: `A` is 1 and `AA` is 27. Convert a number to a column name.**
It is *bijective* base-26 — there is no digit representing zero, so the ordinary conversion is off by
one. Decrement `n` immediately before extracting each digit: `n--`, then take `n % 26` as the letter
and `n / 26` as the carry. Without it, 26 produces a digit of 0 with a carry of 1 and you get `"AA"`
instead of `"Z"`. The general lesson is to check whether a positional system has a zero digit before
assuming the standard loop applies.

**★ Someone proposes base62-encoding the primary key for public URLs. Response?**
It shortens the URL and it changes nothing about guessability, because an encoding is a reversible
rendering — sequential ids stay sequential, so anyone can enumerate them and anyone can measure your
growth rate from two purchases. If unguessability is a requirement, the value must come from a
cryptographic generator and then be encoded; and if the URL is meant to be an access control, the
real fix is an authorisation check, not a longer identifier. That is the same three-part answer as
[10e](10e-the-security-boundary.md)'s order-id question.

**★ What is casting out nines and why is it not used any more?**
It is a checksum built on the digit-sum congruence: since a number is congruent to its digit sum
modulo 9, the digital roots of two operands must combine to the digital root of the result. If they
do not, the arithmetic is definitely wrong. It is a **one-sided** test — it can prove an error and
never correctness — and it is blind to any error that is a multiple of nine, which includes the very
common case of two transposed digits. That combination of cheapness and a large invisible error class
is exactly why it survives as a mental check and not as a data-integrity mechanism.

---

← Prev: [11i · Happy numbers and cycles](11i-happy-numbers-and-cycle-detection.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [12 · Matrix exponentiation](12-matrix-exponentiation.md)
