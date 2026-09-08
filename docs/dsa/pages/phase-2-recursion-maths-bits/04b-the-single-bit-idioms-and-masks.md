---
title: "Test, set, clear and toggle are four one-line idioms, and three quarters of the bugs in mask code come from comparing the result against 1 instead of 0, from shifting an int literal into a long, and from a shift count that reaches the operand's width"
sidebar_label: "04b · Single-bit idioms and masks"
sidebar_position: 4.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. The 32-bit signed result of a JavaScript bitwise operator is quoted from
> MDN — [Bitwise AND](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_AND)
> (*"For numbers, the operator returns a 32-bit integer."*). Java's `int` bounds are the JDK 25
> [`Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)
> javadoc. ⚠️ The modulo-width reduction of a shift count is stated as **mechanism and as a caution
> to avoid the case**, not as a quote — no specification text for it was fetched. The idioms
> themselves are arithmetic. **No sandbox run.** Version spine: **JDK 25 · MDN as fetched
> 2026-09-07**.

**Every mask operation you will ever write is one of five lines, and the failure modes are so
consistent that you can review mask code by grepping for three patterns.** This chunk is those
five lines in TypeScript and Java, the mask-construction expressions that go with them, and the
boundary conditions — bit 31 in JavaScript, the missing `L` in Java, and a shift count that reaches
the operand's width — where each one stops being true. The representation and the coercion rules it
all rests on are in [04](04-bit-manipulation.md); the derived identities are in
[04c](04c-clearing-and-isolating-the-lowest-bit.md).

## The four idioms, plus the one that writes a bit

Learn them as sentences: *test* is AND against a single-bit mask, *set* is OR it in, *clear* is AND
with its complement, *toggle* is XOR it. The fifth, *put*, is clear-then-set and is the one people
improvise wrongly.

```ts
// bit i of a 32-bit mask; keep i in 0..30 in JavaScript if you want a non-negative result
export const testBit   = (m: number, i: number): boolean => (m & (1 << i)) !== 0;
export const setBit    = (m: number, i: number): number  => m | (1 << i);
export const clearBit  = (m: number, i: number): number  => m & ~(1 << i);
export const toggleBit = (m: number, i: number): number  => m ^ (1 << i);
export const putBit    = (m: number, i: number, b: 0 | 1): number =>
  (m & ~(1 << i)) | (b << i);          // clear first, then write — order matters
```

```java
final class Bits {
    static boolean test(int m, int i)   { return (m & (1 << i)) != 0; }
    static int     set(int m, int i)    { return m | (1 << i); }
    static int     clear(int m, int i)  { return m & ~(1 << i); }
    static int     toggle(int m, int i) { return m ^ (1 << i); }
    static int     put(int m, int i, int b) { return (m & ~(1 << i)) | (b << i); }

    // 🔴 for a long mask the literal must be 1L — 1 << 40 is an int shift and does not reach bit 40
    static boolean testL(long m, int i) { return (m & (1L << i)) != 0L; }
    static long    setL(long m, int i)  { return m | (1L << i); }
}
```

Three details in that code are the ones people get wrong under pressure.

**The test compares against `!== 0`, never against `1`.** `m & (1 << i)` yields either `0` or
`1 << i` — the bit *in place*, not normalised. `(m & (1 << 3)) === 1` is false whenever the bit is
set. The alternative normalising form, `(m >>> i) & 1`, gives you a clean `0`/`1` and is the one to
use when you want to *sum* bits rather than branch on them:

```ts
// branch on it → use !== 0.  Add it up → normalise first.
const parityOfLowByte = (m: number): number => {
  let p = 0;
  for (let i = 0; i < 8; i++) p ^= (m >>> i) & 1;   // (m & (1 << i)) would add 1,2,4,8…
  return p;
};
```

🔴 **And `(m & (1 << 31)) > 0` is false even when bit 31 is set**, because the surviving value is
exactly the sign bit and is therefore negative — MDN: *"For numbers, the operator returns a 32-bit
integer."* `!== 0` is correct at every index; `> 0` is correct at none of the interesting ones.
This is the single most common way a 32-element bitmask breaks on its last element while passing
every test that used fewer.

**`putBit` clears before it ORs.** Writing `m | (b << i)` cannot turn a bit off, so a "set this flag
to the request's value" helper written that way is a one-way latch — the exact shape of the bug
where unchecking a checkbox in an admin UI appears to save and then comes back checked.

**In Java the mask literal has to match the mask's type.** `1 << i` is an `int` expression: the
literal `1` is an `int`, the shift is an `int` shift, and the widening to `long` happens *after* the
shift has already been performed at 32 bits. `1L << i` is the only correct spelling for a `long`
mask, and nothing warns you.

## Constructing masks

- **All ones:** `~0` in JavaScript and for a Java `int`, `~0L` for a Java `long`. Use this rather
  than trying to shift a 1 off the top.
- **The low `n` bits, for `n` from 0 to 30:** `(1 << n) - 1`.
- **A single bit:** `1 << i` — but see the width caution below.
- **Bits `lo` through `hi` inclusive:** `((1 << (hi - lo + 1)) - 1) << lo`.
- **Clear the low `n` bits:** `x & ~((1 << n) - 1)`.
- **Keep only the low `n` bits:** `x & ((1 << n) - 1)` — the fast `x % 2^n` for non-negative `x`.
- **Union / intersection / difference of two masks:** `a | b`, `a & b`, `a & ~b`.
- **"Is `a` a subset of `b`":** `(a & b) === a`, equivalently `(a & ~b) === 0`. This is the test
  the submask work in [04f](04f-submasks-and-the-3-to-the-n-count.md) leans on.
- **"Do `a` and `b` overlap":** `(a & b) !== 0`.

⚠️ **The shift count is not unbounded, and this is a boundary to avoid rather than exploit.** Both
languages reduce a shift count modulo the operand's width — 32 for a JavaScript bitwise operator and
for a Java `int`, 64 for a Java `long` — so a shift by 32 behaves as a shift by zero, and
`(1 << 32) - 1` is `0` rather than the full mask you intended. I did not verify this against the
specification text for this page, so treat it as the reason to **never write a shift count equal to
or above the width**: build the full 32-bit mask as `~0` and the full 64-bit mask as `~0L`. The
same caution kills the `(1 << n) - 1` formula at `n === 32`; if `n` is variable and can reach the
width, branch on it:

```ts
const lowBits = (n: number): number => (n >= 32 ? ~0 : (1 << n) - 1);
```

```java
static long lowBitsL(int n) { return n >= 64 ? ~0L : (1L << n) - 1L; }
```

## `x & (2^n − 1)` is only `x % 2^n` for non-negative `x`

The masking form and the remainder form agree on non-negative operands and diverge on negative
ones, because `&` operates on the two's-complement *pattern* and always yields a non-negative
result for a positive mask, while `%` is a **remainder** that keeps the sign of the dividend. So
`x & 7` is a legitimate substitution for `x % 8` in a hash-bucket index only if you have already
guaranteed `x >= 0` — and a hash code in Java is an `int` that can perfectly well be negative.
The general signed-modulus fix, `((x % m) + m) % m` and `Math.floorMod`, belongs to
[Mathematical foundations](03j-modular-arithmetic-and-the-remainder-trap.md); what belongs here is the narrower rule: **mask
for modulus only against a power of two and only on a value you know is non-negative.**

## A storefront mask that is a real column

The PERN storefront's `orders` table carries fulfilment state as independent flags rather than a
single status enum, because an order can be simultaneously paid, picked and partially refunded:

```ts
export const enum OrderFlag {
  Paid      = 0,
  Picked    = 1,
  Packed    = 2,
  Shipped   = 3,
  Delivered = 4,
  Refunded  = 5,
  FraudHold = 6,
}

export const has        = (flags: number, f: OrderFlag) => (flags & (1 << f)) !== 0;
export const withFlag   = (flags: number, f: OrderFlag) => flags | (1 << f);
export const withoutFlag= (flags: number, f: OrderFlag) => flags & ~(1 << f);

// "paid, not yet shipped, not on hold" is one AND against a constant, no per-row branching
const DISPATCHABLE = 1 << OrderFlag.Paid;
const BLOCKING     = (1 << OrderFlag.Shipped) | (1 << OrderFlag.FraudHold) | (1 << OrderFlag.Refunded);

export const awaitingDispatch = (flags: number) =>
  (flags & DISPATCHABLE) === DISPATCHABLE && (flags & BLOCKING) === 0;
```

Seven flags is comfortable. Two things decide whether this design survives contact with the
database. First, **the column is not queryable the way a boolean column is** — `WHERE flags & 8 = 8`
cannot use a plain B-tree index on `flags`, so a report filtering on one flag scans; separate
boolean columns, or an expression index per flag, are what an index can serve. Second, **how many
flags will there ever be**, because at 32 the JavaScript side stops working silently and
[04g](04g-the-32-bit-ceiling-and-what-to-use-instead.md) is where that decision is made. A mask earns its
place in an in-memory hot loop far more often than in a schema.

## Gotchas

**★ Symptom: `(mask & (1 << i)) === 1` never matches for `i > 0`.** Cause: the AND returns the bit
*in position* — `1 << i`, not `1`. Fix: compare with `!== 0`, or normalise first with
`(mask >>> i) & 1` when you need a numeric `0`/`1`.

**★ Symptom: a bit test on index 31 reports "not set" for a mask you just set it on.** Cause: the
test was written `> 0`, and bit 31 is the sign bit, so the surviving value is negative. Fix:
`!== 0`. If the mask must be printed, compared or used as an object key, convert it with
`mask >>> 0` first.

**★ Symptom: a Java `long` mask only ever has bits below 32 set.** Cause: `1 << i` with an `int`
literal — the shift is performed at 32 bits and the count is reduced modulo 32, and only then is the
result widened to `long`. Fix: `1L << i`. Grep a codebase for `1 <<` on any line that mentions a
`long` and you will find this.

**★ Symptom: a "set this flag from the request" helper turns a flag on but never off.** Cause:
`m | (b << i)` with `b === 0` is a no-op. Fix: clear then write — `(m & ~(1 << i)) | (b << i)`.

**Symptom: `(1 << n) - 1` produces `0` for a full-width `n`.** Cause: the shift count is reduced
modulo the operand width, so the shift is by zero and `1 - 1` is `0`. Fix: `~0` for a full 32-bit
mask, `~0L` for 64, and an explicit branch — `n >= 32 ? ~0 : (1 << n) - 1` — if `n` is variable.

**Symptom: `x % 8` replaced by `x & 7` changes the answer for negative `x`.** Cause: `&` masks the
two's-complement pattern and yields a non-negative result, while `%` is a remainder that keeps the
sign of the dividend. Fix: use the mask only where the operand is known non-negative; otherwise
normalise the value first.

**Symptom: summing bits with `(m & (1 << i))` gives a huge total.** Cause: the AND is not
normalised, so bit `i` contributes `2^i` rather than 1. Fix: `(m >>> i) & 1`, or count with the
`x &= x - 1` loop in [04c](04c-clearing-and-isolating-the-lowest-bit.md).

**Symptom: a `WHERE flags & 8 = 8` report got slower as the orders table grew.** Cause: an
expression over a column cannot use a plain index on that column, so the predicate is evaluated per
row. Fix: separate boolean columns, a partial or expression index matching the exact predicate, or
accept the scan knowingly — a bitmask is an in-memory optimisation that a schema rarely wants.

**Symptom: `clearBit` appears to work but the mask keeps growing in an unrelated bit.** Cause:
`~(1 << i)` was computed on a `long` in Java from an `int` expression, so the complement was sign
extended from 32 bits and cleared the high half too, or — in JavaScript — the mask had already been
truncated by an earlier bitwise operator. Fix: `~(1L << i)` in Java; in JavaScript, keep the mask
inside 31 bits or move it to `BigInt`.

## Interview questions

**★ Why does the bit test use `!== 0` rather than `=== 1`?**
Because AND does not normalise. `m & (1 << i)` is either `0` or the single-bit value `1 << i`, so
only `i === 0` yields a `1`. Comparing against `1` silently fails for every other index, and
comparing against `> 0` additionally fails at index 31 in JavaScript and in a Java `int`, where the
surviving value is the sign bit and therefore negative. `!== 0` is the only form correct at every
index. If you want a numeric bit rather than a branch — to add into a counter or index an array —
shift first: `(m >>> i) & 1`.

**★ Write "set bit i to a given boolean" without a branch.**
`(m & ~(1 << i)) | (b << i)` — clear the bit unconditionally, then OR in the value. The instinct is
`m | (b << i)`, which is correct only when `b` is 1 and is a silent no-op when it is 0, giving a
flag that can be turned on and never off. The branchless form is also the one that stays correct if
`b` is computed rather than literal. In Java, guard the `b` argument to `0`/`1` — `(b != 0 ? 1 : 0)`
— since OR-ing a `2` in would set the wrong bit.

**★ How do you build a mask of the low `n` bits, and where does that expression break?**
`(1 << n) - 1`, which works for `n` from 0 up to one below the operand width. It breaks exactly at
the width: the shift count is reduced modulo the width, so a shift by 32 on a 32-bit operand acts
as a shift by zero and the expression yields `0` — the empty mask instead of the full one. The safe
spellings are `~0` for all 32 bits, `~0L` for all 64, and a branch when `n` is variable. In Java
the neighbouring trap is the literal: `(1 << n) - 1` assigned to a `long` is still an `int`
computation, so it cannot produce a mask above bit 31 no matter what `n` is.

**★ How do you test whether one mask is a subset of another?**
`(a & b) === a`, or equivalently `(a & ~b) === 0` — "`a` has no bit outside `b`". Both are a single
AND and a compare, which is why subset queries over small sets are the thing bitmasks are actually
good at: a set-containment test that would be a loop over a hash set becomes one instruction. The
same identity is what makes submask enumeration work in
[04f](04f-submasks-and-the-3-to-the-n-count.md).

**Would you store these flags as a bitmask column in Postgres?**
Usually not. A mask column is not indexable by a plain B-tree for a per-flag predicate, it is opaque
to anyone reading the schema, it needs application-side constants to be meaningful, and adding a
flag means a migration of meaning rather than of structure. Separate boolean columns are queryable,
self-describing and individually indexable. The mask earns its place *in memory* — in a hot loop
that unions and intersects sets, or as a compact key for a memo table — and the honest answer in an
interview is to name that boundary rather than defend the mask everywhere.

**In Java, why is `1 << 40` on a `long` wrong, and what does it actually produce?**
Because the expression's type is decided by its operands, not by its destination. Both `1` and `40`
are `int`, so this is an `int` shift; the shift count is reduced modulo 32 to 8, the shift is
performed at 32 bits, and only the resulting `int` is widened to `long` at assignment. The mask you
wanted at bit 40 lands somewhere in the low half instead. `1L << 40` makes the left operand a
`long`, the shift a 64-bit shift and the count reduced modulo 64. It is worth checking every `1 <<`
in a codebase that has `long` masks; the compiler is happy with both.

---

← Prev: [04 · Bit manipulation](04-bit-manipulation.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [04c · Clearing and isolating the lowest bit](04c-clearing-and-isolating-the-lowest-bit.md)
