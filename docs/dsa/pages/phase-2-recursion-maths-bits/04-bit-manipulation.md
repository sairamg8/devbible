---
title: "Every bit trick is arithmetic on a two's-complement integer — and in JavaScript that integer is not the number you started with, because every bitwise operator coerces its operands to 32 signed bits and discards everything above them"
sidebar_label: "04 · Bit manipulation"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. JavaScript operand coercion is quoted verbatim from MDN —
> [Bitwise AND](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_AND),
> whose coercion rules hold for every JS bitwise operator. Java's `int` bounds are quoted from the
> JDK 25 [`Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)
> javadoc. The two's-complement identities (`-x == ~x + 1`, and everything derived from it) are
> **arithmetic derived on the page**, not cited. ⚠️ The semantics of `>>` against `>>>` are stated as
> **mechanism**, not quoted — no primary source for the shift operators was fetched for this page.
> **No sandbox run**: this page carries code and derivations, never program output.
> Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**Bit manipulation is not a bag of tricks; it is ordinary arithmetic on a fixed-width
two's-complement integer, and every identity in this topic falls out of one fact — that the negation
of `x` is `~x + 1`.** Learn the representation and `x & (x-1)`, `x & -x` and the power-of-two test
stop being things you memorise. The part that is *not* derivable, and that silently ruins correct
code, is the language layer underneath: a JavaScript number is a double, but the moment you write
`&`, `|`, `^`, `<<`, `>>` or `>>>`, the engine throws away everything above 32 bits and reinterprets
what is left as a signed integer. That truncation does not throw, does not produce `NaN`, and does
not appear in a code review. It is the single reason a bitmask solution that passes on 20 items
returns wrong answers on 40, and it is what an interviewer is probing when they ask "would this
work in JavaScript?"

This page is the representation, the language layer and the operators themselves.
[04b](04b-the-single-bit-idioms-and-masks.md) is test / set / clear / toggle and mask construction.
[04c](04c-clearing-and-isolating-the-lowest-bit.md) is `x & (x-1)`, `x & -x` and the power-of-two
test. [04d](04d-counting-set-bits-and-the-platform-methods.md) is counting set bits and the JDK's
bit methods with their documented zero cases.
[04e](04e-xor-and-the-problems-it-solves.md) is XOR's algebra and the problems that fall out of it.
[04f](04f-submasks-and-the-3-to-the-n-count.md) is submask iteration and its 3^n cost, and
[04g](04g-the-32-bit-ceiling-and-what-to-use-instead.md) is the language decision the 32-bit limit
forces.

## Two's complement, in one paragraph

In a `w`-bit two's-complement integer the top bit carries weight −2^(w−1) and every other bit `i`
carries +2^i. So `0111…1` is the largest positive value, 2^(w−1) − 1, and `1000…0` is the most
negative, −2^(w−1). Three consequences do all the work in this topic:

- **There is exactly one zero**, and therefore one more negative value than positive. For a Java
  `int` the javadoc pins both ends:
  > *"A constant holding the maximum value an `int` can have, 2^31-1."* — JDK 25, `Integer.MAX_VALUE`
  > *"A constant holding the minimum value an `int` can have, -2^31."* — JDK 25, `Integer.MIN_VALUE`
- **Negation is `~x + 1`.** Because the value of a bit pattern read as unsigned is `u` and read as
  signed is `u − 2^w` when the top bit is set, `−x` and `2^w − x` are the same pattern; and
  `2^w − x = (2^w − 1 − x) + 1 = ~x + 1`. Everything in
  [04c](04c-clearing-and-isolating-the-lowest-bit.md) is this line applied twice.
- **Add, subtract and multiply are the *same* bit operations for signed and unsigned operands.**
  Only division, comparison and right shift need to know the sign. This is why overflow wraps
  cleanly and predictably rather than trapping — see
  [05 · Integer limits and overflow](05-integer-limits-and-overflow.md).

Java's `int` is that representation at `w = 32` and `long` at `w = 64`, all the way down. JavaScript
has no integer type at all — which is the next section.

## What JavaScript actually does to your operands

A JavaScript number is an IEEE-754 double. It has no bits to `&` in the sense you mean. So the
specification defines every bitwise operator to *convert first*. MDN, on `&` — and the same
conversion applies to `|`, `^`, `~`, `<<`, `>>` and `>>>`:

> *"It first coerces both operands to numeric values and tests the types of them."*

> *"It performs BigInt AND if both operands become BigInts; otherwise, it converts both operands to 32-bit integers and performs number bitwise AND."*

> *"For numbers, the operator returns a 32-bit integer."*

> *"The operator operates on the operands' bit representations in two's complement."*

🔴 And the sentence this whole topic hangs on:

> *"Numbers with more than 32 bits get their most significant bits discarded."*

Read that as an operational rule, not a warning. `&` on a value of 2^40 does not fail, does not
saturate and does not warn — it **silently keeps the low 32 bits and reinterprets bit 31 as a sign
bit**. A mask tracking 40 items has quietly become a mask tracking 32 of them, with the rest
aliased away. Every downstream answer is wrong, and every test on a small input still passes.

Two more rules from the same page decide what you can and cannot mix:

> *"A `TypeError` is thrown if one operand becomes a BigInt but the other becomes a number."*

> *"For BigInts, there's no truncation. Conceptually, understand positive BigInts as having an infinite number of leading `0` bits, and negative BigInts having an infinite number of leading `1` bits."*

So `BigInt` is the escape hatch — the *only* one in the language that keeps the operators — but it
is all-or-nothing per expression: `mask & 1n` where `mask` is a number throws, and `mask & 1` where
`mask` is a BigInt throws. There is no promotion.
[04g](04g-the-32-bit-ceiling-and-what-to-use-instead.md) turns that into the decision of when to reach for
it.

The practical shape of the truncation, stated without inventing an output: after any bitwise
operator, the result is a value in the signed 32-bit two's-complement range — from −2^31 up to
2^31 − 1 inclusive. So `1 << 31` is **negative** in JavaScript, and any mask whose top bit is set
compares as less than zero. That is not a bug in your code; it is the type.

⚠️ The truncation applies to the *operator*, not to the variable. A plain JavaScript number holds
integers exactly up to 2^53 − 1 (see [05](05-integer-limits-and-overflow.md)); it is only the
bitwise step that narrows it. That asymmetry is what makes the failure so quiet — the value was
fine on the line before.

## The operators, and what each is actually for

- **`&` (AND)** — keep the bits that are set in both. Its job is *masking*: `x & m` clears every
  bit of `x` outside `m`.
- **`|` (OR)** — set the bits that are set in either. Its job is *union*: adding flags.
- **`^` (XOR)** — set the bits that differ. Its job is *toggle* and *difference*; its algebra is
  what [04e](04e-xor-and-the-problems-it-solves.md) is built on.
- **`~` (NOT)** — flip every bit. In two's complement `~x === -x - 1`, which is why `~0` is `-1`
  (all ones) and why `~x` is a compact "not found" sentinel in some APIs.
- **`<<` (left shift)** — multiply by 2^k, discarding bits shifted off the top. Sign is *not*
  preserved: shifting a 1 into bit 31 makes the value negative.
- **`>>` (arithmetic / signed right shift)** — divide by 2^k rounding **towards negative infinity**,
  filling the vacated top bits with copies of the sign bit.
- **`>>>` (logical / unsigned right shift)** — divide by 2^k with the vacated top bits filled with
  **zeros**, treating the operand as unsigned. JavaScript and Java spell it the same way; in Java it
  exists on `int` and `long`.

Java has all seven with identical meanings on `int` and `long`, no coercion step, and no `>>>`
surprises beyond the sign question below. What Java does not have is the truncation: `long`
arithmetic is 64-bit throughout.

One asymmetry worth naming: **`&`, `|` and `^` are commutative and associative; the shifts are
neither.** That is why the identities in [04c](04c-clearing-and-isolating-the-lowest-bit.md) and
[04e](04e-xor-and-the-problems-it-solves.md) can be reordered freely and a shift-based
expression cannot.

## `>>` against `>>>`, and why the difference only shows on negatives

For a non-negative operand the two are indistinguishable — the sign bit is 0, so "copy the sign
bit" and "fill with zero" fill with the same thing. On a negative operand they diverge completely:
`>>` preserves the value's sign and keeps dividing towards −∞, so a negative number shifted right
converges to `-1` and **stays there forever**; `>>>` reinterprets the same bit pattern as an
unsigned 32-bit quantity and marches it down to `0`.

That difference is not academic — it is the difference between a loop terminating and not:

```ts
// 🔴 does not terminate for a negative x: -1 >> 1 is -1, forever
function countBitsBroken(x: number): number {
  let n = 0;
  while (x !== 0) { n += x & 1; x >>= 1; }
  return n;
}

// terminates for every 32-bit value, positive or negative, in at most 32 iterations
function countBitsScan(x: number): number {
  let n = 0;
  while (x !== 0) { n += x & 1; x >>>= 1; }
  return n;
}
```

The two other places `>>>` earns its keep in JavaScript:

- **`x >>> 0` is the idiom for "read this 32-bit pattern as unsigned."** It is a shift by zero, so
  it changes no bits; what it changes is the *interpretation*, mapping the signed range onto
  0 … 2^32 − 1. It is how you print a mask whose top bit is set without seeing a minus sign, and
  how you compare two masks as unsigned quantities.
- **A midpoint that must not go negative** — `(lo + hi) >>> 1` recovers the true midpoint even when
  `lo + hi` has spilled into the sign bit. That trick belongs to overflow and is derived in
  [05d · The three silent overflows](05d-the-three-silent-overflows.md).

⚠️ **The two right shifts also round differently, and not only on the sign bit.** `>>` rounds
towards negative infinity while `/` in Java and `Math.trunc` in JavaScript round towards zero, so
`-3 >> 1` is `-2` where `-3 / 2` truncated is `-1`. Substituting `>> 1` for a division by two is
therefore only safe on non-negative operands — the same precondition the midpoint fix in
[05d](05d-the-three-silent-overflows.md) leans on.

⚠️ In Java there is no `>>> 0` idiom, because there is no unsigned `int` type to convert to; the
equivalents are `Integer.toUnsignedString(x)`, `Integer.toUnsignedLong(x)` and
`Integer.compareUnsigned(a, b)`. Reach for those rather than trying to reproduce the JavaScript
gesture.

## Gotchas

**★ Symptom: a bitmask solution is correct for 25 items and wrong for 35, with no error.** Cause:
JavaScript's bitwise operators converted the mask to 32 bits — *"Numbers with more than 32 bits get
their most significant bits discarded."* Every item above index 31 aliases onto a lower one. Fix:
stop at 31 bits in a JS number; above that use `BigInt`, an array of 32-bit words, or Java's `long`
— the decision is laid out in [04g](04g-the-32-bit-ceiling-and-what-to-use-instead.md).

**★ Symptom: a right-shift loop hangs on some inputs.** Cause: `x >>= 1` on a negative operand
copies the sign bit in, so the value converges to `-1` and the loop condition never becomes false.
Fix: `x >>>= 1` in JavaScript and Java, or iterate a fixed 32 times, or use the `x &= x - 1` loop
from [04c](04c-clearing-and-isolating-the-lowest-bit.md), which terminates for every input
including negatives.

**★ Symptom: mixing a BigInt mask with a numeric bit index throws.** Cause: *"A `TypeError` is
thrown if one operand becomes a BigInt but the other becomes a number."* Fix: keep the whole
expression in BigInt — `mask | (1n << BigInt(i))` — there is no implicit promotion in either
direction, so the index has to be converted too.

**Symptom: replacing `Math.floor(x / 2)` with `x >> 1` changes results for negative `x`.** Cause:
`>>` floors, `Math.floor` on a negative quotient agrees with it, but `Math.trunc` and Java's `/`
do not — `-3 >> 1` is `-2`, `-3 / 2` in Java is `-1`. Fix: use the shift only where the operand is
known non-negative, and say so in a comment at the point of substitution.

**Symptom: a value that was clearly under 2^40 a line ago is suddenly small.** Cause: an
intervening bitwise operator. Numbers hold integers exactly to 2^53 − 1, but `&`, `|`, `^`, `~` and
the shifts narrow to 32 bits at the operator, so `x & 0xFF` on a large `x` reads the low byte of a
*truncated* value. Fix: do not mix arithmetic-range and bitwise-range values in the same variable;
if the value can exceed 2^31, extract digits with `Math.floor(x / 2 ** k) % 2` or move to `BigInt`.

**Symptom: `x >>> 0` used as a "make it positive" helper produces enormous values.** Cause: it does
not take an absolute value; it reinterprets the sign bit as a value bit of weight 2^31. Fix: use it
only for display and unsigned comparison, and `Math.abs` when you actually meant magnitude.

## Interview questions

**★ Does this bitmask solution work in JavaScript?**
Only if the mask fits in 32 bits, and the answer needs the mechanism, not a yes. A JavaScript
number is a double, so it has no bits to operate on directly; every bitwise operator therefore
converts its operands to 32-bit two's-complement integers first, operates, and returns a 32-bit
integer — MDN's words are *"it converts both operands to 32-bit integers"* and *"Numbers with more
than 32 bits get their most significant bits discarded."* So a mask over up to 31 elements is safe
and idiomatic; a mask over 40 elements is silently wrong, because bit 40 is discarded and never
reported. Above 32 the choices are `BigInt` — which MDN says has no truncation, positive values
behaving as if they have infinitely many leading zeros — an array of numbers used as 32-bit words,
or a different language. In Java the same code on a `long` is correct to 64 bits with no coercion
step at all.

**★ What is the difference between `>>` and `>>>`, and when does it matter?**
`>>` fills the vacated high bits with copies of the sign bit, so it preserves sign and behaves like
division by a power of two rounding towards negative infinity. `>>>` fills with zeros, so it
reinterprets the operand as an unsigned 32-bit quantity. On a non-negative operand they are
identical, which is why the difference is invisible in most code and shows up as a hang or a wrong
answer the first time a negative value reaches the loop: `-1 >> 1` is `-1`, so a shift-right loop
guarded by a "not zero" condition never ends. `>>>` also gives JavaScript its "read this as
unsigned" idiom, `x >>> 0`, which changes no bits and only changes the interpretation.

**★ Why is `1 << 31` negative in JavaScript, and what do you do about it?**
Because the operators produce a signed 32-bit two's-complement result, and bit 31 is the sign bit,
carrying weight −2^31. Nothing is corrupted — the bit pattern is exactly the one you wanted — but
every comparison against zero now reads the wrong way. Test set-ness with `!== 0` rather than
`> 0`, and if the value must be printed, compared or used as an object key, convert it with
`mask >>> 0` first so it lands in the 0 … 2^32 − 1 range.

**What is `~x` in arithmetic terms, and why is that useful?**
`~x === -x - 1`, straight from `-x === ~x + 1`. So `~0` is `-1`, the all-ones mask, and `~(1 << i)`
is the "everything except bit `i`" mask that the clear idiom needs. It also explains why some APIs
return `~insertionPoint` for a failed search: the value is negative for any non-negative insertion
point, so a single sign check distinguishes hit from miss, and `~result` recovers the position.

**Why is two's complement the representation everyone settled on, rather than sign-and-magnitude?**
Because addition, subtraction and multiplication of the low `w` bits are then *identical*
operations for signed and unsigned operands — one adder circuit, no sign-handling branch — and
there is a single representation of zero rather than two. The costs are the asymmetric range (one
more negative value than positive, which is why `Integer.MIN_VALUE` has no positive counterpart)
and the need for two distinct right shifts, one that propagates the sign and one that does not.
Every identity in this topic is a consequence of that choice.

**If a JavaScript number can hold integers to 2^53, why do the bitwise operators only give you 32
bits?**
Because they are specified that way: the operands are converted to 32-bit integers before the
operation and the result is a 32-bit integer, so the width is a property of the *operator*, not of
the value. There is no widening mode, no flag and no warning. The language's answer for wider bit
work is `BigInt`, where MDN documents that there is no truncation at all and negative values behave
as if they have infinitely many leading one bits — but BigInt and Number cannot be mixed in a
single bitwise expression without a `TypeError`.

{/* FOOTER */}
