---
title: "Two things break a bitmask loop that reads correctly on the page — bitwise AND binds looser than equality, so the membership test silently collapses to bit zero, and 1 << n stops being 2^n at exactly n = 31"
sidebar_label: "09b · Precedence and the 32-bit bound"
sidebar_position: 9.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The precedence ordering — additive above bitwise shift, shift above
> relational, relational above equality, equality above bitwise AND, all left-associative — and the
> rule that governs it are quoted verbatim from MDN,
> [Operator precedence](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_precedence)
> (fetched 2026-09-08 for this page). The 32-bit coercion is quoted from MDN,
> [Bitwise AND](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_AND).
> ⚠️ The shift-count-modulo-width behaviour is stated as **mechanism**, not quoted — no
> specification text for the shift operators was fetched, here or in
> [04b](04b-the-single-bit-idioms-and-masks.md), so it is written as a boundary to avoid rather than
> a rule to exploit. ⚠️ Java's operator precedence is stated from the same *shape* as JavaScript's
> and was **not** verified against the JLS; the load-bearing Java claim on this page is the compile
> error, which follows from `int & boolean` having no defined operator. **No sandbox run.**
> Version spine: **JDK 25 · MDN as fetched 2026-09-07 and 2026-09-08**.

**Every line in a bitmask solution is short, and two of them parse differently from how they read.**
One is a precedence accident that turns a membership test into a test of bit zero and produces a
wrong answer with no error anywhere; the other is the moment `1 << n` stops being `2^n`, which
happens at `n = 31` and again, differently, at `n = 32`. Both survive a hand-run on a small example.
Both are what an interviewer means by "would this work in JavaScript?". This page is those two
failures and nothing else — the enumeration itself is [09](09-bitmask-enumeration.md).

## 🔴 Operator precedence: the bug that reads correctly

MDN states the rule that makes this dangerous:

> *"Operator precedence determines how operators are parsed concerning each other. Operators with higher precedence become the operands of operators with lower precedence."*

And the ordering, from MDN's table, highest first, every one left-associative:

| Precedence | Group | Operators |
|---|---|---|
| 11 | additive | `x + y`, `x - y` |
| 10 | bitwise shift | `x << y`, `x >> y`, `x >>> y` |
| 9 | relational | `x < y`, `x <= y`, `x > y`, `x >= y` |
| 8 | equality | `x == y`, `x != y`, `x === y`, `x !== y` |
| 7 | bitwise AND | `x & y` |
| 6 | bitwise XOR | `x ^ y` |
| 5 | bitwise OR | `x \| y` |

🔴 **Read that table once and the shape of every bit bug is visible: the bitwise operators are at
the bottom.** They bind looser than arithmetic, looser than comparison, looser than equality. Which
is the opposite of how they read, because `&` looks like a small tight operator and `!==` looks like
a statement-level one. Four consequences follow.

**1 — `&` binds looser than `===`, so the comparison happens first.**

```ts
if (mask & 1 << i !== 0) { /* ... */ }        // ⛔ parses as: mask & ((1 << i) !== 0)
```

`(1 << i) !== 0` is a boolean, `true` for every `i` from 0 to 30. `mask & true` coerces the boolean
to `1`, so the whole test collapses to `mask & 1` — **it reports bit 0's state for every `i`**. There
is no error, no `NaN`, and no failure from a default lint configuration. The code passes the case
where `i === 0` and every case where the answer happens to agree, which is why it survives being
traced by hand on a two-element example. Write it with both pairs of parentheses:

```ts
if ((mask & (1 << i)) !== 0) { /* ... */ }    // ✅
```

Java refuses to compile the broken form: `mask & ((1 << i) != 0)` is `int & boolean`, and no such
operator exists. **That asymmetry is worth saying out loud in an interview** — the same expression
is a compile error in one language and a silent wrong answer in the other, and it is the reason the
parenthesised habit is not pedantry in JavaScript. (Java's `&` is also defined on two `boolean`s as
a non-short-circuiting AND, so `flagA & flagB` compiles; the mixed `int & boolean` does not.)

**2 — additive binds tighter than shift, so `1 << n - 1` is not `(1 << n) - 1`.**

```ts
const full = 1 << n - 1;      // ⛔ 1 << (n - 1)  — one single bit, at position n-1
const full = (1 << n) - 1;    // ✅ the low n bits, all set
```

The first is the mask for "only the last element"; the second is "all elements". Both are legal,
both look plausible, and a full-set mask that is secretly a singleton produces a program that
terminates with a wrong answer rather than crashing. The same trap hits `1 << i + 1` (parses as
`1 << (i + 1)`, which is sometimes what you wanted and sometimes not) and
`mask ^ 1 << n - 1`, which is two of these compounded.

**3 — `&` binds looser than `<`, so a range test inside a mask expression regroups.**

```ts
if (mask & 1 << i > 0) { /* ... */ }          // ⛔ mask & ((1 << i) > 0) → mask & 1, again
```

Relational (9) also outranks bitwise AND (7). This is the same collapse as case 1 with a different
comparison, and it is why "use `> 0` instead of `!== 0`" is not a fix for anything — it is a second
bug on top of the sign bug that `> 0` already has
([04b](04b-the-single-bit-idioms-and-masks.md): bit 31 makes a mask negative, so `> 0` is false for a
mask whose bit *is* set).

**4 — shift binds tighter than relational, so the loop bound parses the way you meant.**

```ts
for (let mask = 0; mask < 1 << n; mask++)     // parses as mask < (1 << n) — correct
```

This one is *not* a bug: `<<` (10) outranks `<` (9). It is listed because it is the expression
readers add defensive parentheses to while leaving cases 1 and 3 bare, which is exactly backwards.
Parenthesise it anyway — `mask < (1 << n)` — because a reader of your code should not have to know
the table to review it.

⚠️ **The habit that removes all four:** never mix a shift with anything else on one line without
parentheses. Bind the mask to a name and the precedence question stops arising entirely:

```ts
const bit = 1 << i;
if ((mask & bit) !== 0) { /* ... */ }
```

```ts
// or the helpers from 04b, which is the version to have in muscle memory
export const has   = (mask: number, i: number): boolean => (mask & (1 << i)) !== 0;
export const set   = (mask: number, i: number): number  => mask | (1 << i);
export const clear = (mask: number, i: number): number  => mask & ~(1 << i);
```

## 🔴 Where the loop breaks: n = 31 and n = 32

The counter is an ordinary JavaScript number, but `1 << n` has been through a bitwise operator, and
MDN is explicit about what that means:

> *"For numbers, the operator returns a 32-bit integer."*

> *"The operator operates on the operands' bit representations in two's complement."*

> *"Numbers with more than 32 bits get their most significant bits discarded."*

So bit 31 is the sign bit and `1 << 31` is **negative**. Two distinct failures follow, with two
distinct symptoms one value of `n` apart:

| `n` | `1 << n` evaluates to | Symptom |
|---|---|---|
| ≤ 30 | `2^n`, positive | correct |
| 31 | a negative number — bit 31 is the sign bit | `mask < (1 << n)` is false at `mask = 0`: **the loop body never runs** |
| 32 | `1` — the shift count is reduced modulo the operand's width | **the loop runs exactly once**, for `mask = 0` |
| ≥ 33 | `1 << (n mod 32)` | a small wrong bound, silently |

Neither failure throws. The `n = 31` case returns an empty answer; the `n = 32` case returns the
answer for the empty subset only. Both look like a logic bug three layers up, and **testing at
`n = 30` catches neither**, which is what makes them worth memorising as a pair rather than as one
"32-bit problem".

The fixes, in order of preference:

```ts
// 1. Cap n and assert it. Almost every interview bitmask problem is sized well inside this.
if (n > 30) throw new RangeError(`bitmask enumeration needs n <= 30, got ${n}`);

// 2. Compute the bound as a Number rather than a shift. Exponentiation is not a bitwise
//    operator, so it stays exact up to 2^53 - 1 — but see the caution below.
const limit = 2 ** n;
for (let mask = 0; mask < limit; mask++) { /* ... */ }

// 3. Move the mask itself to BigInt, which does not truncate — 04g.
for (let mask = 0n; mask < (1n << BigInt(n)); mask++) { /* ... */ }
```

🔴 **Fix 2 fixes the bound and not the body.** `2 ** 31` is an exact Number, so the loop now *runs* —
but every `mask & (1 << i)` inside it still coerces to 32 signed bits, and `mask` itself exceeds
`2^31` through the whole second half of the range, where the coercion reinterprets it as negative.
It is a genuine fix only when the body does no bitwise arithmetic on the mask, which is rarely what a
bitmask algorithm looks like. The real decision is
[04g](04g-the-32-bit-ceiling-and-what-to-use-instead.md)'s: a `number` for `n ≤ 31`, a `BigInt`, an
array of 32-bit words, or Java's `long`.

Note where the narrowing lives: **it is a property of the operator, not of the variable.** A plain
number holds integers exactly to `2^53 − 1` ([05](05-integer-limits-and-overflow.md)), so the value
was fine on the line before the `&`. That is why the data looks correct in a debugger right up to
the operation that ruins it.

## The same shape one width up, in Java

Java's `int` breaks at 31 and 32 identically — `1 << 31` is `Integer.MIN_VALUE`, and a shift count
is reduced modulo the operand's width, so `1 << 32` is `1`. A `long` moves the boundary to 63 and
64 and does not otherwise change the story:

```java
long full = (1L << n) - 1L;    // ✅ n <= 62 keeps it positive; n == 63 sets the sign bit
```

🔴 **`1L` is not optional the moment the mask is a `long`.**

```java
long mask = 1 << 40;           // ⛔ int shift, count reduced mod 32 → 1 << 8, then widened
long mask = 1L << 40;          // ✅
```

The wrong version compiles without a warning, because widening an `int` to a `long` is a legal
implicit conversion — the shift has already happened by then, at the wrong width. There is no check
for this beyond reading the code: grep the file for `1 <<` whenever the mask type is `long`, and use
`Long.bitCount` / `Long.numberOfTrailingZeros` rather than the `Integer` versions, which silently
take only the low half ([04d](04d-counting-set-bits-and-the-platform-methods.md),
[05f](05f-the-cross-language-trap.md)).

**Why this ceiling almost never binds a DP** — and where it binds instead — is the arithmetic
in [09i](09i-where-n-stops-fitting.md): a bitmask DP dies of state count long before it dies of
32 bits.

## Gotchas

**★ Symptom: a membership test reports the same answer for every bit index.** Cause:
`mask & 1 << i !== 0` parses as `mask & ((1 << i) !== 0)` — MDN puts equality above bitwise AND — so
the boolean coerces to `1` and the expression is `mask & 1`. Fix: `(mask & (1 << i)) !== 0`, with
both pairs of parentheses, or a `has(mask, i)` helper so the expression is written once.

**★ Symptom: the same bug written with `> 0` instead of `!== 0`.** Cause: relational also outranks
bitwise AND, so `mask & 1 << i > 0` is `mask & ((1 << i) > 0)` — the identical collapse. Fix: the
parentheses. And when they are there, keep `!== 0` rather than `> 0`, because a mask with bit 31 set
is negative and `> 0` rejects it ([04b](04b-the-single-bit-idioms-and-masks.md)).

**★ Symptom: the enumeration loop produces nothing at all.** Cause: `n === 31`, so `1 << 31` is
negative and `mask < (1 << n)` is false on the first iteration. Fix: assert `n <= 30`, or take the
bound as `2 ** n`, or move to `BigInt` / a Java `long`
([04g](04g-the-32-bit-ceiling-and-what-to-use-instead.md)).

**★ Symptom: the enumeration loop runs exactly once.** Cause: `n === 32`, and the shift count is
reduced modulo the operand's width, so `1 << 32` is `1`, not `2^32`. Fix: the same three. These are
two different failures one apart in `n`, so a test at `n = 30` and a test at "large `n`" can both
pass while both bugs are live.

**★ Symptom: the full-set mask behaves like a single element.** Cause: `1 << n - 1` was written for
`(1 << n) - 1`; additive outranks shift, so it parses as `1 << (n - 1)`. Fix: parenthesise, or
better, name it — `const FULL = (1 << n) - 1;` once at the top, never re-derived inline.

**★ Symptom: a Java `long` mask silently loses every bit above 31.** Cause: `1 << i` shifts an `int`
literal, reduces the count modulo 32, and *then* widens the wrong answer to `long`. Fix: `1L << i`.
The compiler cannot warn about it because the widening conversion is legal.

**Symptom: switching the bound to `2 ** n` made the loop run and the answers are still wrong.**
Cause: the bound was never the only problem — the body's `&`, `|` and `<<` on a mask above `2^31`
still truncate to 32 signed bits. Fix: change the representation, not the bound.

**Symptom: `Integer.bitCount(mask)` on a `long` mask returns a count that is too small.** Cause: the
`long` was narrowed to an `int` at the call, keeping only the low 32 bits. Fix: `Long.bitCount`.
This is the same class of error as `1 <<`: the conversion is legal, so nothing complains.

**Symptom: a mask compares unequal to itself across a serialisation boundary.** Cause: it was
normalised with `>>> 0` on one side and not the other, so `-1` and `4294967295` — the same 32-bit
pattern — became two different values. Fix: normalise at exactly one boundary, or keep `n ≤ 30` so
the sign bit is never involved.

## Interview questions

**★ What is wrong with `if (mask & 1 << i !== 0)`?**
It does not test bit `i`. MDN's precedence table puts equality above bitwise AND, so it parses as
`mask & ((1 << i) !== 0)`; the inner comparison is `true` for every sane `i`, `true` coerces to `1`,
and the whole expression is `mask & 1` — bit zero, every time. It is a silent wrong answer in
JavaScript. The same line in Java is `int & boolean` and fails to compile, which is the more
interesting half of the answer: the language difference is exactly why the parenthesised habit
matters in JS and is invisible in Java. The habit that removes the whole class is to never mix a
shift with another operator on one line — bind `const bit = 1 << i;` first.

**★ Your bitmask solution works and then returns nothing when n is 31. Why?**
Every JavaScript bitwise operator converts its operands to a 32-bit two's-complement integer, so
`1 << 31` sets the sign bit and is negative. The loop condition `mask < (1 << n)` is therefore false
before the first iteration and the body never runs. One higher, at `n = 32`, the shift count is
reduced modulo the width so `1 << 32` is `1` and the loop runs exactly once. Neither throws. The fix
is to cap `n` at 30 in a `number`, or move to `BigInt`, a word array, or a Java `long`. And the
follow-up worth volunteering unprompted: for a *DP* over masks this ceiling never binds, because
`2^31` states is unreachable in time and memory long before 32 bits is the problem.

**★ Would you rather have the JavaScript behaviour or the Java behaviour here?**
Java's, and for one specific reason: the two dangerous forms — `int & boolean` and a `long` mask
built from an `int` shift — split cleanly into "compile error" and "silent wrong answer", and the
error is the one you hit first. JavaScript gives you no compile step at all, and the wrongness is
consistent rather than intermittent, so a passing small test is not evidence of anything. The
practical consequence is that JavaScript bitmask code needs the discipline written into the code —
named helpers, an asserted `n` bound — where Java can lean on the type system for half of it.

**★ Why is `2 ** n` not simply the right way to write the loop bound?**
Because it fixes the bound and leaves the body broken. `2 ** 31` is exactly representable — a
Number holds integers to `2^53 − 1` — so the loop runs across the full range, but every `&`, `|`,
`^` and `<<` inside it still coerces to 32 signed bits, and for the whole upper half of the range
the mask no longer survives that coercion. Fixing the comparison while leaving the arithmetic broken
converts an obviously empty output into a subtly wrong one, which is worse. The bound is not the
decision; the representation is.

**Where does the 32-bit ceiling actually bite in practice, if not in a DP?**
In the cases where you hold a large set as a mask but never enumerate all the masks: a permissions
or feature-flag bitfield stored as a column, a visited-set over 40 nodes inside a search that
touches a minuscule fraction of the state space, a bloom-filter-shaped structure. There the mask
width is a data-modelling decision, not an algorithmic one, and the answers are a `long`, a `BigInt`
or an array of 32-bit words — [04g](04g-the-32-bit-ceiling-and-what-to-use-instead.md) has the
trade-off in full.

---

← Prev: [09 · Bitmask enumeration](09-bitmask-enumeration.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [09c · Generating masks in a useful order](09c-generating-masks-in-a-useful-order.md)
