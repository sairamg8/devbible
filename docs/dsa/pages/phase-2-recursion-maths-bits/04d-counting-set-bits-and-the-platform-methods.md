---
title: "Kernighan's loop counts set bits in one iteration per bit rather than one per position, Java documents the whole family with its zero cases, and the two methods that return 32 for an empty mask are where an index derived from a bitmask goes out of range"
sidebar_label: "04d · Counting set bits, and the platform methods"
sidebar_position: 4.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. Every Java method description and — 🔴 crucially — every **documented zero
> case** below is quoted verbatim from the JDK 25
> [`Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)
> javadoc: `bitCount`, `highestOneBit`, `lowestOneBit`, `numberOfTrailingZeros`,
> `numberOfLeadingZeros`, `reverse`. JavaScript's 32-bit operand coercion is MDN,
> [Bitwise AND](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_AND).
> The counting recurrences are arithmetic, derived here from
> [04c](04c-clearing-and-isolating-the-lowest-bit.md). ⛔ **No claim is made about what any of these
> compile to** — the javadoc specifies semantics, not instructions, and there is **no sandbox run**
> behind this page. Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**A population count is the one bit operation you will be asked to write from scratch and should
almost never write in production, and the reason is the same in both directions: Java documents the
whole family, including the behaviour on zero that you would otherwise guess wrong.** This chunk is
Kernighan's loop and why its guard must be `!== 0`, the linear DP that counts bits for every value
up to `n`, the six `Integer` methods worth knowing by name with their exact zero cases, and the
JavaScript equivalents you have to write because the language ships only one of them. The
identities underneath — `x & (x - 1)` and `x & -x` — are derived in
[04c](04c-clearing-and-isolating-the-lowest-bit.md).

## Kernighan's loop

Each iteration removes the lowest set bit, so the loop runs once per *set* bit rather than once per
bit position:

```ts
export function popcount(x: number): number {
  let n = 0;
  while (x !== 0) { x &= x - 1; n++; }   // !== 0, not > 0 — see below
  return n;
}
```

```java
static int popcountByHand(int x) {
    int n = 0;
    while (x != 0) { x &= x - 1; n++; }
    return n;
}
```

Two conditions make it correct, and both are asked.

**The guard is `!== 0`, never `> 0`.** A negative operand fails `> 0` on the first evaluation, so
the function returns `0` instead of the true count — a wrong answer rather than a crash, on
precisely the inputs (a mask with bit 31 set, a Java hash code) where you were least likely to have
a test.

**It terminates on negatives.** Each pass strictly reduces the set of one bits, and the sign bit is
removed like any other once it is the lowest remaining one. That is the property the shift-based
scan lacks: `x >>= 1` on a negative operand converges to `-1` and stays there
([04](04-bit-manipulation.md)).

⚠️ **What "the number of set bits" means for a negative operand is a modelling question, not a
bug.** Kernighan's loop on `-1` counts the 32 one bits of the two's-complement pattern. If your mask
conceptually has seven elements and you have let a negative value into it, the count is arithmetically
right and semantically meaningless. Mask down to the width you actually use — `x & 0x7F` for seven
elements — before counting.

**In Java, do not write it at all.** The platform has it, named and specified:

> *"Returns the number of one-bits in the two's complement binary representation of the specified `int` value. This function is sometimes referred to as the population count."* — JDK 25, `Integer.bitCount`

`Long.bitCount` is the 64-bit counterpart, and reaching for it is part of what makes a mask over
more than 32 elements correct in Java — see
[04g](04g-the-32-bit-ceiling-and-what-to-use-instead.md). ⛔ Do not claim these "compile to a single
instruction"; the javadoc specifies what the method returns, not what it becomes, and this page
measures nothing.

## Counting the bits of every value up to n

The identity from [04c](04c-clearing-and-isolating-the-lowest-bit.md) is also a recurrence, and it
turns "popcount for each of `n` values" into one linear table pass. Two spellings, both standard:

```ts
// dp[i] = dp[i with its lowest set bit cleared] + 1
export function countBitsUpTo(n: number): number[] {
  const dp = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= n; i++) dp[i] = dp[i & (i - 1)] + 1;
  return dp;
}

// dp[i] = dp[i with its lowest bit position dropped] + (the bit that was dropped)
export function countBitsUpToAlt(n: number): number[] {
  const dp = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= n; i++) dp[i] = dp[i >>> 1] + (i & 1);
  return dp;
}
```

```java
static int[] countBitsUpTo(int n) {
    int[] dp = new int[n + 1];
    for (int i = 1; i <= n; i++) dp[i] = dp[i & (i - 1)] + 1;
    return dp;
}
```

Both read the answer off an already-computed *smaller* index — `i & (i - 1)` is strictly less than
`i` for `i > 0`, and so is `i >>> 1` — which is why the table is `O(n)` rather than `n` calls to an
`O(bits)` popcount. Use `>>>` rather than `>>` in the second form even though `i` is non-negative
here: the day someone passes a value that has been through a bitwise operator and landed negative,
`>>` makes the loop index into `dp[-1]`.

## The Java family, and the exact zero case of each

These are the ones worth knowing by name, because reimplementing them is where off-by-ones come
from. Every zero case below is **quoted, not guessed** — that is the entire reason to read the
javadoc for this family rather than reason about it.

> *"Returns an `int` value with at most a single one-bit, in the position of the highest-order ("leftmost") one-bit in the specified `int` value. Returns zero if the specified value has no one-bits in its two's complement binary representation, that is, if it is equal to zero."* — JDK 25, `Integer.highestOneBit`

> *"Returns an `int` value with at most a single one-bit, in the position of the lowest-order ("rightmost") one-bit in the specified `int` value. Returns zero if the specified value has no one-bits ... that is, if it is equal to zero."* — JDK 25, `Integer.lowestOneBit`

> *"Returns the number of zero bits following the lowest-order ("rightmost") one-bit in the two's complement binary representation of the specified `int` value. Returns 32 if the specified value has no one-bits in its two's complement representation, in other words if it is equal to zero."* — JDK 25, `Integer.numberOfTrailingZeros`

> *"Returns the number of zero bits preceding the highest-order ("leftmost") one-bit ... Returns 32 if the specified value has no one-bits in its two's complement representation, in other words if it is equal to zero."* — JDK 25, `Integer.numberOfLeadingZeros`

> *"Returns the value obtained by reversing the order of the bits in the two's complement binary representation of the specified `int` value."* — JDK 25, `Integer.reverse`

🔴 **The two `32`s are the bug.** `numberOfTrailingZeros(0)` is `32` — not `-1`, not a sentinel, not
an exception. So `arr[Integer.numberOfTrailingZeros(mask)]` on an empty mask indexes at 32, and
either throws or, in an array sized for 64 positions, silently reads a neighbouring slot. Check the
mask for zero before deriving an index from it, every single time:

```java
// the safe shape: the zero check is the loop condition, so the index is never taken on an empty mask
static void forEachIndex(int mask, java.util.function.IntConsumer fn) {
    for (int m = mask; m != 0; m &= m - 1) fn(Integer.numberOfTrailingZeros(m));
}
```

The two "returns zero" methods behave differently and more kindly: an empty mask gives an empty
result, which is why `lowestOneBit` in a peel loop is safe while `numberOfTrailingZeros` outside one
is not. **The distinction is between a method that returns a *value* and one that returns an
*index*** — a value can be zero meaningfully, an index cannot.

`numberOfLeadingZeros` is also the floor-log-2 building block: `31 - Integer.numberOfLeadingZeros(x)`
is the index of the top set bit for positive `x`, and yields `-1` at zero, for the same reason.

## The JavaScript equivalents you have to write

The language ships `Math.clz32` — count leading zeros in a 32-bit representation — and nothing else
from this family: no `bitCount`, no `numberOfTrailingZeros`, no `reverse`. Everything below is
derived from the identities in [04c](04c-clearing-and-isolating-the-lowest-bit.md), with the zero
case guarded **explicitly at the call site** rather than trusted, because you have no documented
zero behaviour to lean on — you have your own.

```ts
export const lowestOneBit = (x: number): number => x & -x;

// index of the lowest set bit; caller must have checked x !== 0
export const trailingZeros = (x: number): number => 31 - Math.clz32(x & -x);

// index of the highest set bit; caller must have checked x !== 0
export const floorLog2 = (x: number): number => 31 - Math.clz32(x);

// smallest power of two >= x, for 1 <= x <= 2^30 — the hash-table capacity idiom
export function nextPowerOfTwo(x: number): number {
  let v = x - 1;
  v |= v >>> 1; v |= v >>> 2; v |= v >>> 4; v |= v >>> 8; v |= v >>> 16;  // smear the top bit down
  return v + 1;
}
```

The smear is worth understanding rather than copying. After `v |= v >>> 1` the top *two* bits are
set; after `>>> 2`, the top four; after `>>> 4`, the top eight — five doublings cover all 32
positions regardless of where the top bit started. The value is then of the form `0…01…1`, and
adding one carries through the whole run to land a single bit one position higher. 🔴 In JavaScript
that carry reaches the sign bit for inputs above 2^30, producing a negative result, so bound the
input, or use a Java `long` with `Long.highestOneBit`, or move to `BigInt`.

## Gotchas

**★ Symptom: a popcount returns 0 for negative inputs.** Cause: the loop was guarded with `x > 0`,
which is false immediately for a negative operand. Fix: `x !== 0` / `x != 0`. The `x &= x - 1` loop
then terminates on negatives too, because each pass removes a set bit including the sign bit.

**★ Symptom: `arr[Integer.numberOfTrailingZeros(mask)]` throws, or reads the wrong slot.** Cause:
the javadoc says it *"Returns 32 if the specified value has no one-bits"* — an empty mask yields an
index of 32, not a sentinel. Fix: make the zero check the loop condition
(`for (int m = mask; m != 0; m &= m - 1)`), so the index is never taken on an empty mask. The same
applies to `numberOfLeadingZeros`, and to `31 - numberOfLeadingZeros(x)` yielding `-1`.

**★ Symptom: `nextPowerOfTwo` returns a negative number.** Cause: the smear-plus-one carried into
bit 31, which is the sign bit in a 32-bit signed result. Fix: bound the input at 2^30, or compute
with `BigInt`, or in Java use a `long` and `Long.highestOneBit`.

**Symptom: `Integer.bitCount` on a value that came from a `long` counts the wrong thing.** Cause:
it takes an `int`; a narrowing cast added to satisfy the compiler discards the high 32 bits. Fix:
`Long.bitCount`. If the compiler accepted the call without a cast, the argument was already an
`int` and the bug is further upstream.

**Symptom: the popcount of a seven-element mask is 32.** Cause: the value went negative — a bitwise
operator set bit 31, or a hash code was stored in the same variable — and Kernighan's loop
faithfully counted all 32 bits of the two's-complement pattern. Fix: mask to the width you actually
use before counting, `x & 0x7F` for seven elements.

**Symptom: `dp[i >> 1]` in the counting DP indexes at `-1`.** Cause: `>>` on a negative `i`
converges towards `-1` rather than `0`. Fix: `>>> 1`, and reject negative `n` at the entry point;
the table is defined only for non-negative indices.

**Symptom: a hand-written `numberOfTrailingZeros` returns 31 for zero rather than 32.** Cause:
`31 - Math.clz32(0 & -0)` is `31 - Math.clz32(0)`, and the derivation assumed a set bit exists.
Fix: guard `x !== 0` at the call site rather than trying to make the expression total — the
guard is one comparison and the expression cannot be repaired without a branch anyway.

**Symptom: bit-reversal reimplemented by hand disagrees with `Integer.reverse` at the edges.**
Cause: a hand-rolled reversal that shifts with `>>` sign-extends, or stops at 31 iterations. Fix:
call `Integer.reverse`, which is specified as *"reversing the order of the bits in the two's
complement binary representation"* — all 32 of them, sign bit included.

## Interview questions

**★ Count the set bits in every integer from 0 to n in linear time.**
Use the identity as a recurrence: `dp[i] = dp[i & (i - 1)] + 1`, since `i & (i - 1)` is a strictly
smaller index whose count is already known and differs by exactly one bit. The equivalent
`dp[i] = dp[i >>> 1] + (i & 1)` reads the answer off the value with the low bit shifted away. Both
are one table pass, `O(n)` time and `O(n)` space, and both beat calling a popcount per value because
each answer is one addition away from an answer you already have. Say which recurrence you are using
and why the index it reads is smaller — that is the entire correctness argument.

**★ Write a population count and defend the loop guard.**
`while (x !== 0) { x &= x - 1; n++; }`. The guard is "not zero", not "greater than zero", because a
negative operand — a mask with bit 31 set, or a Java hash code — fails `> 0` immediately and the
function silently returns zero. The loop terminates for every input because each pass removes one
set bit, sign bit included, so it runs exactly `popcount(x)` times: proportional to the number of
set bits, not to the width of the word. And in Java the real answer is that you would call
`Integer.bitCount`, which the javadoc specifies as the population count, and write the loop only
because the interviewer asked for the mechanism.

**★ What does Java give you here that JavaScript does not, and how do you close the gap?**
Java has the whole family on `Integer` and `Long` — `bitCount`, `lowestOneBit`, `highestOneBit`,
`numberOfTrailingZeros`, `numberOfLeadingZeros`, `reverse` — with the zero behaviour documented,
which is exactly the part you would otherwise get wrong: `lowestOneBit(0)` is `0`, but
`numberOfTrailingZeros(0)` is `32`. JavaScript ships only `Math.clz32`, so you write the rest:
`x & -x` for the lowest bit, `31 - Math.clz32(x & -x)` for its index, `31 - Math.clz32(x)` for the
top bit's index, and Kernighan's loop for the count. Every one of them needs an explicit `x !== 0`
check at the call site, because there is no documented zero case to lean on.

**Is a popcount a single machine instruction?**
That is not a question the javadoc answers and not one this page measures. What is documented is the
semantics — `Integer.bitCount` *"Returns the number of one-bits in the two's complement binary
representation"* — and that is what you should say. The honest engineering answer is that you call
the platform method because it is correct, named and maintained, and that whether a given JVM on a
given CPU turns it into a hardware population count is an implementation detail you would measure
rather than assert. An interviewer who wanted the trick answer will accept the mechanism; one who
wanted the mechanism will not accept the trick.

**Why does `nextPowerOfTwo` shift by 1, 2, 4, 8 and 16 rather than looping?**
Because each OR-with-a-shift doubles the run of ones below the top set bit: after shifting by one
the top two bits are set, after two the top four, after four the top eight, and so on, so five
steps cover 32 positions regardless of where the top bit was. The value is then of the form
`0…01…1`, and adding one carries through the whole run to produce a single bit one position higher.
The `- 1` at the start is what makes an exact power of two map to itself rather than to the next
one. The bound matters: in JavaScript an input above 2^30 carries into the sign bit and the result
is negative.

**Why is `numberOfTrailingZeros` dangerous where `lowestOneBit` is safe?**
Because one returns a *value* and the other an *index*. `lowestOneBit(0)` is `0`, which is a
perfectly meaningful "no bits" answer and makes peel loops terminate naturally.
`numberOfTrailingZeros(0)` is `32`, which is not a position in a 32-bit word at all — it is the
only value that cannot be confused with a real answer, which is a reasonable API choice and a
terrible array index. Any code that turns a mask into an index must check the mask for zero first,
and the cheapest way to guarantee that is to put the check in the loop condition.

---

← Prev: [04c · Clearing and isolating the lowest bit](04c-clearing-and-isolating-the-lowest-bit.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [04e · XOR, and the problems it solves](04e-xor-and-the-problems-it-solves.md)
