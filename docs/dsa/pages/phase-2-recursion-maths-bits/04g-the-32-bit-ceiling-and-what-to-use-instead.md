---
title: "A bitmask over more than 32 elements is wrong in JavaScript and right in a Java long — the operators truncate with no error and no NaN, so the choice between a number, a BigInt, an array of 32-bit words and a long is a correctness decision made before the first line of code"
sidebar_label: "04g · The 32-bit ceiling, and what to use instead"
sidebar_position: 4.6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. Every JavaScript claim is quoted from MDN —
> [Bitwise AND](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_AND)
> for the 32-bit result, the truncation of higher bits, the `TypeError` on mixing and BigInt's
> absence of truncation, and
> [`BigInt`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)
> for the no-mixing rule, the Number comparison and MDN's own guidance on when to reach for it.
> ⚠️ **MDN makes no performance claim about BigInt and neither does this page** — the cost is stated
> as mechanism (arbitrary precision is not a register operation), never as a figure.
> `java.util.BitSet` and `BigInteger` are named as the Java destinations; **their javadocs were not
> fetched, so no API detail is asserted about them.** **No sandbox run.** Version spine: **JDK 25 ·
> MDN as fetched 2026-09-07**.

**This is the decision the rest of the bit-manipulation topic exists to set up, and it is made
before you write the first line: how many elements will this mask ever hold?** Get it wrong in Java
and the compiler or a `1L` audit catches you. Get it wrong in JavaScript and nothing catches you —
the operators quietly narrow to 32 signed bits, the answers stay right on every small test, and the
failure shows up as a business rule that stopped applying to some of the data. This chunk states the
ceiling from the specification's own words and then lays out the four things to reach for, with the
mechanism behind each. The idiom the decision applies to is in
[04f](04f-submasks-and-the-3-to-the-n-count.md); the representation is in
[04](04-bit-manipulation.md).

## The ceiling, in MDN's words

> *"Numbers with more than 32 bits get their most significant bits discarded."*

> *"For numbers, the operator returns a 32-bit integer."*

> *"The operator operates on the operands' bit representations in two's complement."*

So a mask held in a JavaScript number tops out at 32 bits, bit 31 is the sign bit, and `1 << 31` is
negative. There is no widening mode, no strict-mode error and no warning. 🔴 **A bitmask over more
than 32 elements is wrong in JavaScript and right in a Java `long`** — that is the sentence to be
able to say, and the rest of this page is what to do about it.

Note precisely where the narrowing lives: it is a property of the **operator**, not of the variable.
A plain number holds integers exactly up to 2^53 − 1 ([05](05-integer-limits-and-overflow.md)), so
the value was fine on the line before the `&`. That asymmetry is why the failure is so quiet — the
data looks right in a debugger right up to the operation that ruins it.

## 1 — A `number`, for `n` up to 31

The default, and the right answer for almost every interview problem, because interview bitmask
problems are sized for it. Two rules keep it honest:

- Test with `!== 0`, never `> 0` ([04b](04b-the-single-bit-idioms-and-masks.md)), because bit 31 is
  the sign bit.
- If you want the mask itself to stay non-negative — for a `Map` key, an array index, a printed
  value — cap the enumeration at 30 bits, or normalise with `mask >>> 0` at the boundary.

## 2 — `BigInt`, for arbitrary `n` in TypeScript

The operators keep working and nothing is truncated:

> *"For BigInts, there's no truncation. Conceptually, understand positive BigInts as having an infinite number of leading `0` bits, and negative BigInts having an infinite number of leading `1` bits."*

The price is that it is a separate type with no implicit promotion in either direction:

> *"A `TypeError` is thrown if one operand becomes a BigInt but the other becomes a number."*

> *"A BigInt value cannot be used with methods in the built-in `Math` object and cannot be mixed with a Number value in operations; they must be coerced to the same type."*

> *"A BigInt value is not strictly equal to a Number value, but it is loosely so:"*

and MDN's own guidance on when to reach for it at all:

> *"Only use a BigInt value when values greater than 2^53 are reasonably expected."*

⚠️ **No performance number is available and none is invented here.** The mechanism is enough to
reason with: an arbitrary-precision integer is not a machine word, so each operation is work over a
variable number of digits rather than a single register operation. That is the reason to keep BigInt
for the masks that need it rather than making it the default type for all of them — not a benchmark
this page does not have.

```ts
export function forEachSubmaskBig(mask: bigint, fn: (sub: bigint) => void): void {
  let sub = mask;
  for (;;) {
    fn(sub);
    if (sub === 0n) break;         // 0n, not 0 — a BigInt is never strictly equal to a Number
    sub = (sub - 1n) & mask;
  }
}

export const hasBig   = (mask: bigint, i: number) => (mask & (1n << BigInt(i))) !== 0n;
export const setBig   = (mask: bigint, i: number) => mask | (1n << BigInt(i));
export const clearBig = (mask: bigint, i: number) => mask & ~(1n << BigInt(i));
```

Every literal in those expressions carries the `n` suffix and every index is converted with
`BigInt(i)`. That is not stylistic: mixing throws, so the conversion has to be somewhere, and
putting it in the helper keeps it out of every call site.

## 3 — An array of 32-bit words, when `n` is large and the operations are set-shaped

A bitset keeps machine-word arithmetic and pays only an index computation. `i >>> 5` is the word
(divide by 32) and `i & 31` is the bit within it (remainder modulo 32) — both exact because 32 is a
power of two, per [04b](04b-the-single-bit-idioms-and-masks.md):

```ts
export class BitSet32 {
  private readonly words: Uint32Array;
  constructor(readonly size: number) { this.words = new Uint32Array((size + 31) >>> 5); }

  has(i: number): boolean { return (this.words[i >>> 5] & (1 << (i & 31))) !== 0; }
  add(i: number): void    { this.words[i >>> 5] |= 1 << (i & 31); }
  remove(i: number): void { this.words[i >>> 5] &= ~(1 << (i & 31)); }

  orInto(other: BitSet32): void {
    for (let w = 0; w < this.words.length; w++) this.words[w] |= other.words[w];
  }
  intersects(other: BitSet32): boolean {
    for (let w = 0; w < this.words.length; w++) if ((this.words[w] & other.words[w]) !== 0) return true;
    return false;
  }
}
```

`(size + 31) >>> 5` is the round-up-then-divide idiom, which is why a bitset of 33 bits allocates two
words. Backing it with a `Uint32Array` rather than a `number[]` keeps every word in the unsigned
range and removes the bit-31 sign question from every method at once — the assignment
`words[w] |= 1 << 31` stores a negative 32-bit result into an unsigned slot, and reading it back
gives the unsigned interpretation.

What a bitset gives up is whole-mask *arithmetic*: there is no "subtract one from the whole set", so
the submask idiom of [04f](04f-submasks-and-the-3-to-the-n-count.md) does not transfer. Bitsets are
for union, intersection, difference and membership over large universes; BigInt is for masks you
need to do arithmetic on.

## 4 — Java's `long`, and what is past it

A `long` is 64-bit two's complement with no coercion step, so every idiom in this topic transfers
unchanged provided two things: the literals are `1L`, and the helpers come from `Long` rather than
`Integer` — `Long.bitCount`, `Long.lowestOneBit`, `Long.numberOfTrailingZeros`
([04d](04d-counting-set-bits-and-the-platform-methods.md)).

```java
// 63 elements in one primitive, no truncation, no coercion
static boolean has(long mask, int i)   { return (mask & (1L << i)) != 0L; }
static long    set(long mask, int i)   { return mask | (1L << i); }
static long    clear(long mask, int i) { return mask & ~(1L << i); }
static int     size(long mask)         { return Long.bitCount(mask); }
```

Past 63 elements Java's destinations are **`java.util.BitSet`** for set operations and
**`BigInteger`** for arbitrary-precision arithmetic. They are named here as the right places to
look; this page asserts nothing about their APIs, because their javadocs were not consulted for it.

## The decision, as a table

| Elements | TypeScript | Java |
|---|---|---|
| **n ≤ 30** | `number` — the default, mask stays non-negative | `int` |
| **n = 31 or 32** | `number`, but every test is `!== 0` and the value can be negative | `int`, same caveat |
| **33 ≤ n ≤ 63** | 🔴 **not a `number`** — `BigInt`, or a `Uint32Array` bitset | `long`, with `1L` literals and the `Long` methods |
| **n ≥ 64** | `Uint32Array` bitset, or `BigInt` if you need whole-mask arithmetic | `java.util.BitSet`, or `BigInteger` |

## The storefront case that forces the row that matters

A cart-routing rule asks *which of our warehouses can fulfil every line of this order*. That is a set
intersection over as many bits as there are warehouses, run per order, and a mask is genuinely the
right structure for it — one AND per line instead of a set-membership loop.

At seven warehouses it is a `number` and the code is delightful. At forty it is *still* a `number`,
right up until the day the fortieth warehouse row is inserted — at which point the intersection
silently starts ignoring warehouses 32 and above, the router stops offering them, and the symptom
that reaches you is "the Leeds warehouse never gets any orders". Nothing throws, no test fails, and
the git blame lands on a migration that added a row to a table.

The fix is architectural and belongs at the point where the count stops being a constant: **if the
number of bits is data rather than a literal in the source, a JavaScript number is the wrong
container.** Either the mask is a `Uint32Array` from the start, or the warehouse set is a real
`Set<string>` and the mask optimisation is applied only inside a hot loop where the width is
asserted. A one-line assertion at construction — `if (warehouseCount > 31) throw new Error(...)` —
is a legitimate third option and is far better than the silence.

## Gotchas

**★ Symptom: a bitmask solution is correct up to 31 items and quietly wrong at 40.** Cause: the mask
lives in a JavaScript number, and *"Numbers with more than 32 bits get their most significant bits
discarded"* at every bitwise operator. Fix: `BigInt` for whole-mask arithmetic, a `Uint32Array`
bitset for set operations, or a Java `long` with `1L` literals up to 63.

**★ Symptom: `mask | (1n << i)` throws a `TypeError`.** Cause: `i` is a Number and `mask` a BigInt —
*"A `TypeError` is thrown if one operand becomes a BigInt but the other becomes a number."* Fix:
`mask | (1n << BigInt(i))`. Every literal in the expression needs the `n` suffix too, including the
`0n` in a loop's exit test.

**★ Symptom: after switching masks from `number` to `bigint`, every memo lookup misses.** Cause: the
memo `Map` still holds numeric keys, and MDN documents that *"A BigInt value is not strictly equal
to a Number value"* — `0n === 0` is `false` while `0n == 0` is `true`. Fix: key the memo
consistently — convert with `String(mask)`, or make every key a BigInt. Do not lean on `==`; loose
equality is not what a `Map` compares keys with.

**★ Symptom: `Math.max` or `Math.abs` on a BigInt mask throws.** Cause: *"A BigInt value cannot be
used with methods in the built-in `Math` object."* Fix: compare BigInts with the relational
operators, which do work across the two types, and write the two-argument maximum yourself:
`a > b ? a : b`.

**Symptom: a `number[]`-backed bitset returns negative values from a word.** Cause: bit 31 of a word
is the sign bit in a signed 32-bit result. Fix: back it with `Uint32Array`, which stores and returns
the unsigned interpretation; failing that, compare with `!== 0` throughout and never with `> 0`.

**Symptom: converting a BigInt mask to a number for use as an array index loses bits.** Cause:
`Number(mask)` above 2^53 is not exact ([05](05-integer-limits-and-overflow.md)). Fix: index with a
string key, keep the memo keyed by the BigInt itself, or restructure so the index is a small derived
value rather than the mask.

**Symptom: the submask loop cannot be ported to the bitset.** Cause: a bitset supports set
operations, not whole-value arithmetic, so there is no `sub - 1` to borrow through. Fix: use
`BigInt` if you need the submask idiom above 63 bits — or, far more often, recognise that 3^n at
that size was never going to run ([04f](04f-submasks-and-the-3-to-the-n-count.md)).

**Symptom: a Java `long` mask silently loses everything above bit 31.** Cause: an `int` literal in
the shift — `1 << i` rather than `1L << i` — so the shift happens at 32 bits before the widening.
Fix: `1L`, everywhere, and audit for `Integer.bitCount` calls that should be `Long.bitCount`.

## Interview questions

**★ The problem has 40 items and you were about to write a bitmask. What now?**
Two separate questions, and both need answering. First, does the algorithm still fit — 2^40 subsets,
or 3^40 submask pairs, is not a running program in any language, so if the approach was full
enumeration it is dead regardless of representation. Second, if the mask is a *state* rather than an
enumeration — a set of visited nodes, a set of satisfied constraints — then in Java it is a `long`
and everything transfers with `1L` literals and the `Long` bit methods, up to 63 elements. In
TypeScript it must not be a `number`, because every bitwise operator converts to 32 bits and
discards the rest with no error; the choices are `BigInt`, which MDN documents as having no
truncation, or an array of 32-bit words if the operations are set-shaped rather than arithmetic.

**★ When is `BigInt` the right answer and when is it the wrong one?**
MDN's own line is the one to quote: *"Only use a BigInt value when values greater than 2^53 are
reasonably expected."* It is right when you need whole-mask arithmetic — shifts, additions,
comparisons, the submask decrement — above the range a Number or a Java `long` can hold, and when
correctness matters more than throughput. It is wrong as a blanket replacement for numeric masks,
for two mechanical reasons that need no benchmark: it cannot be mixed with Number in any operation
without a `TypeError`, so it infects every call site, every literal and every memo key; and
arbitrary precision means each operation is work over a variable number of digits rather than one
register operation. For pure set work — union, intersection, membership — an array of 32-bit words
keeps machine arithmetic and is usually the better structure.

**★ Why is this failure mode worse in JavaScript than in Java?**
Because Java tells you and JavaScript does not. In Java the width is in the type: an `int` mask that
needs bit 40 either does not compile, or fails an audit for `1L` literals, and the `Integer` versus
`Long` method names make the width visible at every call. In JavaScript there is no integer type at
all — the width is a property of each operator, applied silently at every use — so the same source
that was correct for 31 elements is incorrect for 33 with no diff, no error and no failing test
unless someone wrote a test at the boundary. The engineering consequence is that the width has to be
asserted by *you*, at construction, because the language will never assert it.

**★ Why `i >>> 5` and `i & 31` in the bitset, rather than `Math.floor(i / 32)` and `i % 32`?**
They are the same values for non-negative `i` — 32 is a power of two, so the division is a shift and
the remainder is a mask of the low five bits — and the shift-and-mask form makes the power-of-two
assumption visible at the point of use, which matters if anyone ever changes the word size. The
important detail is `>>>` rather than `>>`: an index should never be negative, and if one ever is,
the unsigned shift produces an out-of-range index that fails loudly instead of a negative one that
reads the wrong word.

**Would you ever store a mask wider than 32 bits in Postgres and read it into Node?**
Only with the width handled explicitly at the boundary. A `bigint` column read into a JavaScript
number is already suspect above 2^53 ([05](05-integer-limits-and-overflow.md)), and even below that,
any bitwise operation on the value narrows it to 32 bits at the first `&`. The workable shapes are:
keep the set as rows rather than as bits, which is what a relational database is for; or store it as
`bytea` / an array column and reconstruct a bitset in the application; or read the column as a
string and parse it into a `BigInt`. What does not work is reading it as a number and masking it,
which is the shape most people write first.

{/* FOOTER */}
