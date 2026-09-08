---
title: "x & (x-1) clears the lowest set bit and x & -x isolates it — both are three lines of two's-complement arithmetic rather than facts to memorise, and the power-of-two test built on the first is wrong for two inputs unless you guard it"
sidebar_label: "04c · Clearing and isolating the lowest bit"
sidebar_position: 4.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. `Integer.lowestOneBit`'s **documented zero case**, `Integer.MAX_VALUE` and
> `Integer.MIN_VALUE` are quoted verbatim from the JDK 25
> [`Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)
> javadoc. The 32-bit coercion of JavaScript's operands is MDN,
> [Bitwise AND](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_AND).
> The identities `x & (x-1)` and `x & -x` are **derived on this page from `-x == ~x + 1`**, not
> cited. ⚠️ `Math.abs(Integer.MIN_VALUE)` being negative is stated as the *arithmetic consequence*
> of the two quoted constants — the `Integer` page does not say it. **No sandbox run.**
> Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**Two expressions carry most of what people call "bit tricks", and both are three lines of algebra
away from the definition of negation.** `x & (x - 1)` turns off the lowest set bit; `x & -x` returns
that bit alone. From the first you get the power-of-two test and a loop that runs once per set bit
rather than once per bit position; from the second you get the lowest-bit extraction that drives
Fenwick trees and submask work. Derive them once, in front of the interviewer, and you never have
to remember which is which. What you *do* have to remember is what each does on zero — and that is
where the whole family's bugs live. The representation is in [04](04-bit-manipulation.md); the
single-bit idioms are in [04b](04b-the-single-bit-idioms-and-masks.md); counting bits and the
platform methods are in [04d](04d-counting-set-bits-and-the-platform-methods.md).

## `x & (x - 1)` clears the lowest set bit

Write `x` in the only general form it has: some prefix `A`, then the lowest set bit, then `k`
zeros — `A 1 0…0`. Subtracting one borrows through those `k` zeros, turning them into ones and the
lowest set bit into a zero, and leaves `A` untouched because the borrow stops there: `x - 1` is
`A 0 1…1`.

AND them position by position. In the prefix, `A & A` is `A`. At the lowest set bit, `1 & 0` is
`0`. Below it, `0 & 1` is `0` in every position. So `x & (x - 1)` is `A 0 0…0` — **`x` with its
lowest set bit removed and nothing else changed.**

The zero case falls out of the same picture and is the reason peel loops terminate: if `x` is `0`,
then `x - 1` is all ones, and `0 & anything` is `0`, so the expression stays at `0` and a
`while (x !== 0)` loop exits. It also terminates for *negative* operands, because the sign bit is
removed like any other once it is the lowest remaining one — a property the shift-based scan in
[04](04-bit-manipulation.md) does not have.

## `x & -x` isolates the lowest set bit

Same decomposition, `x = A 1 0…0` with `k` trailing zeros. Negation in two's complement is
`~x + 1` ([04](04-bit-manipulation.md)):

- `~x` is `~A 0 1…1` — every bit flipped, so the lowest set bit becomes `0` and the `k` zeros below
  it become ones.
- Adding `1` carries through all `k` ones, resetting them to zero, and lands on the `0` that was
  the lowest set bit, flipping it to `1`. The carry stops there. So `-x` is `~A 1 0…0`.

AND with `x = A 1 0…0`: the prefix contributes `A & ~A`, which is `0` in every position; the lowest
set bit contributes `1 & 1 = 1`; below it everything is `0 & 0`. The result is exactly `1 << k` —
**the lowest set bit, alone.**

And the zero case again: `-0` is `0`, so `0 & -0` is `0`. The JDK documents precisely that, which
is why you should call the method rather than reimplement it in Java:

> *"Returns an `int` value with at most a single one-bit, in the position of the lowest-order ("rightmost") one-bit in the specified `int` value. Returns zero if the specified value has no one-bits ... that is, if it is equal to zero."* — JDK 25, `Integer.lowestOneBit`

The two identities are complementary and worth holding as a pair: `x & -x` **selects** the lowest
set bit, `x & (x - 1)` **removes** it, and `(x & -x) | (x & (x - 1))` reconstructs `x`. A loop that
wants to *visit* each set bit uses both — take `x & -x` as the current bit, then `x &= x - 1` to
advance:

```ts
// visit each set bit of a 32-bit mask, once, in increasing position order
export function forEachSetBit(mask: number, fn: (bit: number) => void): void {
  let m = mask;
  while (m !== 0) {
    const low = m & -m;      // the bit itself, as a value
    fn(low);
    m &= m - 1;              // remove it and continue
  }
}
```

```java
static void forEachSetBit(int mask, java.util.function.IntConsumer fn) {
    for (int m = mask; m != 0; m &= m - 1) fn(Integer.lowestOneBit(m));
}
```

🔴 In JavaScript both identities hold **only within 32 bits**, because the operands are coerced
before the operation — MDN: *"Numbers with more than 32 bits get their most significant bits
discarded."* `x & -x` on a value above 2^31 does not isolate that value's lowest set bit; it
isolates the lowest set bit of its low 32 bits. And when the lowest set bit *is* bit 31, the result
is negative — correct as a pattern, misleading as a number.

## The power-of-two test, and its two zero-shaped bugs

A positive power of two has exactly one set bit, so removing it leaves zero:

```ts
export const isPowerOfTwo = (x: number): boolean => x > 0 && (x & (x - 1)) === 0;
```

```java
static boolean isPowerOfTwo(int x)  { return x > 0 && (x & (x - 1)) == 0; }
static boolean isPowerOfTwo(long x) { return x > 0L && (x & (x - 1L)) == 0L; }
```

The `x > 0` guard is not decoration; it repairs **two** distinct failures, and an interviewer will
ask for both.

**Zero passes without it.** `0 & -1` is `0`, so `(x & (x - 1)) === 0` is true for `x === 0` — and
zero is not a power of two. This is the case people find.

**🔴 `Integer.MIN_VALUE` also passes without it**, and this is the case they do not. `MIN_VALUE` is
`1000…0`: a single set bit, in the sign position. The javadoc pins the values —

> *"A constant holding the minimum value an `int` can have, -2^31."* — JDK 25, `Integer.MIN_VALUE`

> *"A constant holding the maximum value an `int` can have, 2^31-1."* — JDK 25, `Integer.MAX_VALUE`

— and subtracting one from the smallest `int` wraps to the largest, `0111…1`, whose AND with
`1000…0` is `0`. So the naive test reports that −2147483648 is a power of two. The same happens in
JavaScript for a different reason: the subtraction is performed in double precision and produces a
value one below −2^31, which the `&` then coerces back into range as `0111…1`. Both languages, same
wrong answer, two different mechanisms. `x > 0` closes both.

⚠️ The neighbouring arithmetic fact, which the `Integer` page does **not** state and which follows
from the two constants above: the range is asymmetric, so `-MIN_VALUE` is not representable and
`Math.abs(Integer.MIN_VALUE)` is still `Integer.MIN_VALUE` — negative. Any "take the absolute value
then index" step can therefore produce a negative index for exactly one input, which is why hash
bucket selection masks (`h & (buckets - 1)`) rather than taking an absolute value.

The related test, **"is `x` a power of two times a power of two"** — that is, "how many times does
2 divide `x`" — is the trailing-zero count, and it belongs to
[04d](04d-counting-set-bits-and-the-platform-methods.md) along with its documented zero case.

## Gotchas

**★ Symptom: `isPowerOfTwo(0)` returns true.** Cause: `0 - 1` is all ones and `0 & -1` is `0`, so
the "one bit removed leaves nothing" test is vacuously satisfied. Fix:
`x > 0 && (x & (x - 1)) === 0`.

**★ Symptom: `isPowerOfTwo(Integer.MIN_VALUE)` returns true.** Cause: `MIN_VALUE` is a single set
bit in the sign position, and `MIN_VALUE - 1` wraps to `MAX_VALUE`, whose AND with it is zero. Fix:
the same `x > 0` guard — it is doing two jobs, and the interviewer usually only expects one.

**★ Symptom: `x & -x` gives the wrong bit for large values in JavaScript.** Cause: both operands
are coerced to 32 bits before the AND, so a value above 2^31 has already lost its high bits. Fix:
keep such masks in `BigInt` — the identity itself still holds there, since MDN documents no
truncation — or split the value into 32-bit words.

**Symptom: `Integer.lowestOneBit(mask)` in a peel loop appears to work but the loop body never
runs.** Cause: it *"Returns zero if the specified value has no one-bits"*, so an empty mask exits
immediately — correct, and exactly why the loop is safe, but also why an "at least one iteration"
assumption is wrong. Fix: treat the empty mask as a real case, not an impossible one.

**Symptom: `Math.abs(x)` used to make a hash index non-negative still produces a negative index.**
Cause: the `int` range is asymmetric — `-2^31` up to `2^31 - 1` — so the negation of the minimum has
no representation and `Math.abs` returns it unchanged. Fix: mask instead of negate —
`x & 0x7FFF_FFFF`, or `h & (buckets - 1)` when the bucket count is a power of two — so no input has
a special case.

**Symptom: a peel loop over set bits visits the same bit twice or spins.** Cause: the body took
`x & -x` but forgot to advance with `x &= x - 1`, or advanced with `x -= 1`. Fix: the two lines are
a pair — select with `x & -x`, advance with `x &= x - 1`; subtracting one alone does not remove a
bit, it borrows.

## Interview questions

**★ Why is `x & -x` the lowest set bit? Derive it.**
Because negation in two's complement is `~x + 1`. Write `x` as a prefix `A`, then its lowest set
bit, then `k` zeros. `~x` is `~A`, then `0`, then `k` ones. Adding one carries through all `k`
ones, turning them back to zeros, and lands on the `0` that was the lowest set bit, flipping it to
`1`; the carry stops there. So `-x` is `~A 1 0…0`. ANDing with `x` gives zero in every prefix
position, because `A & ~A` is zero bitwise, a `1` at the lowest set bit, and zeros below it — the
result is exactly `1 << k`. On zero it gives zero, which the JDK documents for `lowestOneBit`, and
that is what makes peel loops terminate.

**★ Why does `x & (x - 1)` clear the lowest set bit, and what does that buy you?**
Subtracting one borrows through the trailing zeros: they become ones and the lowest set bit becomes
zero, with the prefix untouched. ANDing keeps the prefix, kills the lowest set bit and kills the
newly-created low ones, so the result is `x` with one bit removed. It buys two things. First the
power-of-two test — a positive power of two has exactly one bit, so removing it leaves zero. Second
a population count whose cost is proportional to the number of set bits rather than the width of
the word, which matters when masks are sparse; and the same recurrence gives the linear DP for
counting bits of every value up to `n`, in
[04d](04d-counting-set-bits-and-the-platform-methods.md).

**★ Write the power-of-two test and name every input it gets wrong without the guard.**
`x > 0 && (x & (x - 1)) === 0`. Without `x > 0` it wrongly accepts **zero**, because `0 & -1` is
zero, and it wrongly accepts **`Integer.MIN_VALUE`**, because that is a single set bit in the sign
position and subtracting one wraps to `MAX_VALUE`, whose AND with it is zero. The second case is
the one that distinguishes a candidate who reasoned about the representation from one who
remembered the formula. In JavaScript the same two inputs fail, for the second one by a different
route: the subtraction happens in floating point and the `&` coerces the result back into the
32-bit range, arriving at the same pattern.

**How do you iterate the set bits of a mask, and why is that faster than scanning 32 positions?**
Take `low = x & -x` as the current bit, do the work, then advance with `x &= x - 1`, looping while
`x !== 0`. The loop runs exactly once per set bit, so a mask with three bits set costs three
iterations regardless of where they are — a scan over positions costs 32 (or 64) every time. It
matters wherever masks are sparse: adjacency masks in a graph problem, a set of active feature
flags, the frontier of a bitset BFS. In Java, `Integer.lowestOneBit` and
`Integer.numberOfTrailingZeros` give you the bit and its index respectively; in JavaScript you write
both, and you check for zero yourself.

**Why does hash bucket selection mask rather than take an absolute value?**
Because `Math.abs` has one input it cannot fix: the most negative `int` has no positive
counterpart, so `Math.abs(Integer.MIN_VALUE)` is negative, and an index derived from it is out of
range for exactly one hash code in four billion — the kind of bug that reproduces once a month in
production and never in a test. Masking with `h & (capacity - 1)` — valid when the capacity is a
power of two, which is why hash tables choose power-of-two capacities — is total: every possible
`int` maps into range, including the minimum, because the AND discards the sign bit rather than
negating it.

{/* FOOTER */}
