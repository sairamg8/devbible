---
title: "XOR is addition modulo two with no carry, and its three algebraic properties — identity, self-inverse, commutativity — are the whole reason the single-number, missing-number and two-single-numbers problems collapse to one linear pass with no extra memory"
sidebar_label: "04e · XOR, and the problems it solves"
sidebar_position: 4.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. The 32-bit coercion that makes the XOR swap unsafe on large JavaScript
> values is quoted from MDN,
> [Bitwise AND](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_AND)
> (*"Numbers with more than 32 bits get their most significant bits discarded."*), whose coercion
> rules hold for every JS bitwise operator including `^`. The algebra of XOR and every problem
> solution below is **mathematics derived on the page**, not cited. ⚠️ Operator precedence is stated
> as **mechanism** — no specification text for it was fetched — and every claim about it is written
> so that the fix (parenthesise) is correct regardless. ⛔ **No performance claim** is made for the
> XOR swap or against it; there is **no sandbox run** behind this page. Version spine: **JDK 25 ·
> MDN as fetched 2026-09-07**.

**XOR is the only bitwise operator with a useful algebra, and three properties generate everything
below: `a ^ 0 === a`, `a ^ a === 0`, and it is commutative and associative.** Put together, they say
that XOR-ing a pile of values gives a result that does not depend on the order and in which any
value appearing an even number of times has vanished. That single sentence solves "find the element
that appears once", "find the missing number", "find the two elements that appear once" and "undo
this transformation" — each in one pass with a single accumulator, where the obvious solution wants
a hash map. It also produces the one bit trick you should be able to write and then argue *against*
using: the swap without a temporary. The representation is in [04](04-bit-manipulation.md); the
`x & -x` this page borrows for partitioning is derived in
[04c](04c-clearing-and-isolating-the-lowest-bit.md).

## What XOR actually is

Per bit, XOR is addition modulo 2: `0+0=0`, `0+1=1`, `1+0=1`, `1+1=0`. Across a word it is therefore
**addition with the carries thrown away**, which is exactly why it loses information that `+` keeps
and why it is reversible in a way `+` is not. Four properties, each one line:

- **Identity.** `a ^ 0 === a` — zero is the neutral element, so an accumulator starts at `0`.
- **Self-inverse.** `a ^ a === 0` — every value is its own inverse, so XOR-ing twice undoes.
- **Commutative and associative.** `a ^ b === b ^ a`, and `(a ^ b) ^ c === a ^ (b ^ c)` — the order
  of a fold does not matter, which is what lets you reason about a stream as a multiset.
- **Cancellation.** From the three above: `a ^ b ^ b === a`. XOR is its own decryption.

⚠️ It is **not** monotonic and it does **not** distribute over `+`. `a ^ b` can be smaller or larger
than either operand, so no comparison, sorting or binary-search argument survives an XOR in the
middle of it — a frequent source of wrong "greedy" reasoning about maximum-XOR problems.

## The single number

*Every element appears exactly twice except one; find it in `O(n)` time and `O(1)` space.*

XOR the whole array. Commutativity lets you reorder it so that the pairs sit together; self-inverse
turns each pair into `0`; identity leaves the unpaired value standing.

```ts
export const singleNumber = (nums: number[]): number => nums.reduce((acc, x) => acc ^ x, 0);
```

```java
static int singleNumber(int[] nums) {
    int acc = 0;
    for (int x : nums) acc ^= x;
    return acc;
}
```

🔴 **The precondition is load-bearing and is what an interviewer probes.** The argument needs *every
other element to appear an even number of times* — twice is the usual statement, but four times
works identically and **three times does not**, because `a ^ a ^ a` is `a`, so a value appearing
three times survives and corrupts the answer. If the problem says "every other element appears three
times", XOR is the wrong tool and the fix is per-position counting modulo three:

```ts
// every element appears three times except one; count each bit position mod 3
export function singleNumberOfThrees(nums: number[]): number {
  let result = 0;
  for (let bit = 0; bit < 32; bit++) {
    let count = 0;
    for (const x of nums) count += (x >>> bit) & 1;
    if (count % 3 !== 0) result |= 1 << bit;
  }
  return result | 0;                       // keep it a signed 32-bit value
}
```

That loop is `O(32n)` and `O(1)` space, and it generalises to "every other element appears `k`
times" by changing the modulus — which is the answer to "and what if it were five?"

## The missing number

*The array holds `n` distinct values drawn from `0…n` with exactly one missing.*

XOR every index `0…n` and every value. Each present value is XOR-ed exactly twice — once as an index
and once as a value — and cancels; the missing one is XOR-ed only as an index and survives.

```ts
export function missingNumber(nums: number[]): number {
  let acc = nums.length;                   // covers the index n, which has no array slot
  for (let i = 0; i < nums.length; i++) acc ^= i ^ nums[i];
  return acc;
}
```

```java
static int missingNumber(int[] nums) {
    int acc = nums.length;
    for (int i = 0; i < nums.length; i++) acc ^= i ^ nums[i];
    return acc;
}
```

The arithmetic alternative — sum `0…n` with `n(n+1)/2` and subtract — is equally `O(n)` and is the
one an interviewer will ask you to compare against. **The XOR version cannot overflow**; the sum
version can, and that comparison is the whole point of the question. In Java `n(n+1)/2` for a large
`n` overflows an `int` silently; in JavaScript it stays exact only while it is under 2^53. Both
failures are covered in [05](05-integer-limits-and-overflow.md).

## The two single numbers

*Every element appears twice except two, `x` and `y`; find both.*

XOR everything: the pairs cancel and you are left with `x ^ y`. That value is non-zero (the two are
distinct), so it has at least one set bit — and **any set bit in `x ^ y` is a position where `x` and
`y` differ**. Take the lowest one with `x & -x` from
[04c](04c-clearing-and-isolating-the-lowest-bit.md) and use it to split the array into two groups:
those with the bit set and those without. `x` and `y` land in different groups, and every pair lands
wholly inside one group because equal values agree on every bit. XOR each group separately.

```ts
export function twoSingleNumbers(nums: number[]): [number, number] {
  let xorAll = 0;
  for (const v of nums) xorAll ^= v;
  const lowBit = xorAll & -xorAll;         // a position where the two answers differ
  let a = 0, b = 0;
  for (const v of nums) {
    if ((v & lowBit) !== 0) a ^= v; else b ^= v;
  }
  return [a, b];
}
```

Two passes, one accumulator each, constant space. The step people miss is *why* the partition is
sound: it is not that the bit separates the two answers by luck, it is that it separates them by
construction and cannot separate a pair, because a pair is two identical bit patterns.

## Swapping without a temporary — and why it is a trick, not advice

```ts
// works, and you should not ship it
let a = 5, b = 9;
a ^= b;      // a holds a ^ b
b ^= a;      // b holds b ^ (a ^ b) === a
a ^= b;      // a holds (a ^ b) ^ a === b
```

The derivation is pure cancellation and is worth being able to produce on demand. Shipping it is a
different question, and there are four reasons the answer is no:

1. 🔴 **It destroys the value when the two operands are the same storage.** `xorSwap(arr, i, i)` —
   or a swap of a variable with itself through an alias — computes `a ^= a`, which is `0`, and the
   element is gone. A temp-variable swap is a no-op in that case. Any partition or shuffle that can
   pick `i === j` is one such call away from silently zeroing an element, and `i === j` happens
   often in a Fisher–Yates loop and in a Lomuto partition.
2. 🔴 **In JavaScript it truncates.** `^` coerces both operands to 32 bits — *"Numbers with more
   than 32 bits get their most significant bits discarded."* So swapping two values above 2^31 with
   XOR does not swap them; it replaces both with 32-bit remnants. A temp-variable swap has no such
   restriction, because numbers hold integers exactly to 2^53 ([05](05-integer-limits-and-overflow.md)).
3. **It only applies to integers.** Strings, objects, doubles with fractional parts, `null` — none
   of them XOR meaningfully, so the trick cannot be the general swap in your codebase.
4. **The idiomatic swap is shorter anyway.** JavaScript has destructuring — `[a, b] = [b, a]` — and
   Java has a three-line helper that every reader understands at a glance. ⛔ No performance claim is
   available here in either direction: nothing on this page is measured, and "it avoids a temporary"
   is a statement about source text, not about what a compiler emits.

```java
// the version to actually write
static void swap(int[] arr, int i, int j) {
    int tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;      // correct even when i == j
}
```

Say all of that when asked. "I know the XOR swap; I would not use it, because it self-destructs on
aliased operands and, in JavaScript, on values above 32 bits" is a better answer than the trick
itself.

## One more identity worth having: Gray code

`i ^ (i >> 1)` maps `0, 1, 2, 3, …` onto a sequence in which **consecutive entries differ in exactly
one bit**. The reason is direct: the XOR of the value with itself shifted down cancels every run of
equal adjacent bits, so incrementing `i` — which flips a trailing run and one bit above it — changes
exactly one bit of the result. It is the standard construction for enumerating subsets in an order
where each step adds or removes a single element, which is occasionally what makes an incremental
computation over subsets cheap. Use `>>>` in JavaScript so a negative `i` cannot appear.

## Gotchas

**★ Symptom: `2 ^ 3` is `1` rather than `8`.** Cause: `^` is XOR in both JavaScript and Java, never
exponentiation. Fix: `2 ** 3` in JavaScript, `Math.pow(2, 3)` — or a shift, `1 << 3` — in Java. This
is the single most common `^` bug in code written by people who learned the caret elsewhere.

**★ Symptom: `if (a ^ b === c)` behaves as though the XOR never happened.** Cause: `===` binds
tighter than `^` in JavaScript, so the expression parses as `a ^ (b === c)` — the boolean coerces to
`0` or `1` and gets XOR-ed into `a`. Java rejects the same shape at compile time because `int ^
boolean` is not a valid operation, so this is a JavaScript-only silent failure. Fix: parenthesise
every bitwise sub-expression that sits next to a comparison — `if ((a ^ b) === c)` — as a rule,
without checking the precedence table.

**★ Symptom: `if (mask & 1 === 0)` never matches.** Same cause, same fix: it parses as
`mask & (1 === 0)`, that is `mask & false`, which is `0` and therefore falsy for every mask. Write
`if ((mask & 1) === 0)`.

**★ Symptom: the XOR swap zeroes an array element.** Cause: it was called with `i === j`, so the
first step computed `a ^= a` and destroyed the value before it could be recovered. Fix: use a
temporary; if you must keep the trick, guard `if (i !== j)` — but the guard costs exactly what the
temporary would have.

**★ Symptom: the XOR swap corrupts large numbers in JavaScript.** Cause: `^` converts its operands
to 32-bit integers and discards the higher bits, so any value above 2^31 is not what comes back.
Fix: destructuring, `[a, b] = [b, a]`.

**Symptom: the single-number solution returns a wrong value on a valid-looking input.** Cause: the
precondition is *even* multiplicity for every other element, and the input had one appearing three
times. Fix: check the problem statement's multiplicity; for "three times" use per-bit counting
modulo three, for "`k` times" change the modulus.

**Symptom: `missingNumber` is off by one.** Cause: the accumulator was initialised to `0` rather
than to `n`, so the index `n` — which has no array slot to pair with — was never XOR-ed in. Fix:
start the accumulator at `nums.length`, or run a second loop over `0…n` inclusive.

**Symptom: a "maximum XOR of two numbers" greedy argument gives the wrong pair.** Cause: XOR is not
monotonic — a larger operand does not produce a larger XOR — so sorting or binary-searching on the
values proves nothing. Fix: reason bit by bit from the most significant position, which is the trie
approach, not a comparison approach.

**Symptom: the per-bit counting solution returns a huge positive number in JavaScript where Java
returns a negative one.** Cause: bit 31 was set with `result |= 1 << bit`, which is correct, but a
subsequent arithmetic use of `result` treats it as the double it is. Fix: finish with `result | 0`
so the value is explicitly the signed 32-bit interpretation, and decide deliberately which one the
problem wants.

## Interview questions

**★ Find the element that appears once when every other appears twice, and prove it.**
Fold the array with XOR starting from `0`. The proof is the algebra: XOR is commutative and
associative, so the fold's value does not depend on order and you may imagine the equal values
adjacent; each such pair is `a ^ a`, which is `0`; and `0` is the identity, so those pairs
contribute nothing and the unpaired element is what remains. `O(n)` time, `O(1)` space, no hash map
and no sort. The precondition to state out loud is *even* multiplicity — the argument breaks
immediately if an element appears three times, because `a ^ a ^ a` is `a`.

**★ Now every other element appears three times. What changes?**
XOR stops working, because self-inverse only cancels pairs. Count instead: for each of the 32 bit
positions, sum that bit across the array; every element appearing three times contributes a multiple
of three to that sum, so the positions where the total is not divisible by three are exactly the
positions where the unique element has a bit set. Rebuild the answer from those positions. `O(32n)`
time and `O(1)` space, and the same code answers "appears `k` times" by changing the modulus to `k`.
In JavaScript, finish with `| 0` so a set bit 31 comes back as the signed value the problem means.

**★ Find the two elements that appear once when every other appears twice.**
XOR everything: the pairs cancel and the result is `x ^ y`. Since `x` and `y` differ, that value has
at least one set bit, and every set bit in it is a position where they disagree. Isolate the lowest
with `x & -x` and use it to partition the array in a second pass — `x` and `y` necessarily fall in
different groups, and every duplicate pair falls entirely inside one group because identical values
agree on every bit. XOR each group to get one answer each. Two passes, constant space.

**★ Find the missing number in `0…n`, and compare it with the summation approach.**
XOR every index from `0` to `n` together with every array value: each present value appears once as a
value and once as an index and cancels, so what remains is the missing index. The summation
alternative computes `n(n+1)/2` and subtracts the array's sum — same time, same space, and it is the
one that breaks first, because the sum overflows a Java `int` for `n` beyond roughly 65,000 and loses
precision in a JavaScript number once it passes 2^53. The XOR version has no accumulator that can
grow, so it cannot overflow at all. Naming that difference is the point of the question.

**★ Show me the XOR swap. Would you use it?**
`a ^= b; b ^= a; a ^= b` — the middle step gives `b` the value `b ^ (a ^ b)`, which cancels to `a`,
and the last gives `a` the value `(a ^ b) ^ a`, which cancels to `b`. And no, I would not use it.
It fails catastrophically when both sides are the same storage, because `a ^= a` is zero and the
value is unrecoverable — and `i === j` genuinely occurs in Fisher–Yates and in a Lomuto partition.
In JavaScript it additionally truncates to 32 bits, so it does not even swap values above 2^31. It
works only on integers, and the idiomatic alternatives — destructuring in JavaScript, a three-line
helper in Java — are clearer. I would not offer a performance argument in either direction, because
I have not measured one.

**What is XOR, arithmetically?**
Addition modulo two in each bit position — that is, addition with every carry discarded. That framing
explains all of its behaviour at once: it is its own inverse because adding a bit to itself modulo
two gives zero; it is commutative and associative because addition is; and it destroys the ordering
information that `+` preserves, which is why no comparison-based or greedy-on-magnitude argument
survives it. It is also why XOR shows up as the cheap reversible mixing step in hash functions and
checksums.

---

← Prev: [04d · Counting set bits, and the platform methods](04d-counting-set-bits-and-the-platform-methods.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [04f · Submasks, and the 3^n count](04f-submasks-and-the-3-to-the-n-count.md)
