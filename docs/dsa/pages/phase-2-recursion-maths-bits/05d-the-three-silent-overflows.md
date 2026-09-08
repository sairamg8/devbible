---
title: "Three arithmetic sites overflow silently in almost every codebase — the binary-search midpoint, the running product under a modulus, and a sum accumulated in the element type — and each has a rewrite that removes the large intermediate rather than checking for it"
sidebar_label: "05d · The three silent overflows"
sidebar_position: 5.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. `Math.addExact` / `multiplyExact` / `toIntExact` and `Integer.MAX_VALUE` /
> `MIN_VALUE` are quoted from the JDK 25
> [`Math`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Math.html) and
> [`Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)
> javadocs; JavaScript's 32-bit bitwise coercion from MDN,
> [Bitwise AND](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_AND);
> the safe-integer range from MDN,
> [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER).
> Every midpoint and product bound below is **arithmetic derived on the page**. ⚠️ `Math.floorDiv`
> is named for the negative-range case; the modular-arithmetic subject in general belongs to
> [Mathematical foundations](03-mathematical-foundations.md). **No sandbox run.** Version spine: **JDK 25 ·
> MDN as fetched 2026-09-07**.

**Overflow is not usually found by auditing every arithmetic expression; it is found by knowing the
three places it lives.** All three share a shape: a perfectly reasonable formula creates an
intermediate that is larger than either the inputs or the answer, and the fix is almost never a
check — it is a rewrite that never builds the large intermediate in the first place. The midpoint
is the one every interviewer knows and this page owns it. The modular product is the one that
separates a Java answer from a JavaScript answer, because the two languages break at different
magnitudes. The accumulating sum is the one that ships to production, because the per-row value is
always fine. The mechanisms are in [05](05-integer-limits-and-overflow.md) for JavaScript and
[05c](05c-javas-int-and-the-checked-arithmetic.md) for Java.

## 1 — The binary-search midpoint

`mid = (lo + hi) / 2` is correct mathematics and a defective program. In Java, `lo` and `hi` are
`int`s that can each approach `Integer.MAX_VALUE` — *"2^31-1"* — so their **sum** can need 32 bits
plus one, wraps to a negative value, and the division by two yields a negative index. The array
access throws, or, in a value-space search where the bounds are magnitudes rather than positions,
the loop simply converges to nonsense.

**The fix is to never form the sum:**

```java
int lo = 0, hi = arr.length - 1;
while (lo <= hi) {
    int mid = lo + ((hi - lo) >> 1);   // hi - lo is non-negative and at most MAX_VALUE
    if (arr[mid] == target) return mid;
    if (arr[mid] < target) lo = mid + 1; else hi = mid - 1;
}
return -1;
```

Why it is safe, in one line each: `hi >= lo` inside the loop, so `hi - lo` is non-negative and no
larger than `hi`, hence in range; half of it is smaller still; and `lo` plus that half is at most
`hi`, which is in range by assumption. **No intermediate is ever larger than a value that was
already valid.** `lo + (hi - lo) / 2` is the same thing with a division, and identical here because
`hi - lo` is non-negative — [04](04-bit-manipulation.md) has the case where `>> 1` and `/ 2` differ.

**The other Java-idiomatic fix is `(lo + hi) >>> 1`,** and it is worth being able to justify rather
than recite. The wrapped sum's *bit pattern* is still the low 32 bits of the true 33-bit sum — two's
complement addition does not lose information, it only reinterprets the top bit as a sign
([04](04-bit-manipulation.md)). The unsigned right shift brings that bit down as an ordinary value
bit instead of replicating a sign, which reconstructs the true midpoint exactly. The precondition is
that `lo` and `hi` are both non-negative; on a search over a signed value range it is wrong, and
`lo + ((hi - lo) >> 1)` is not.

🔴 **In JavaScript the arithmetic is safe and the bit trick reintroduces the bug.** Array indices
cannot approach 2^53, so `(lo + hi) / 2` never leaves the safe range — but writing
`(lo + hi) >> 1`, the habit carried over from Java, coerces the sum to 32 bits and wraps it negative
as soon as `lo + hi` reaches 2^31. That is a real possibility in a value-space search over cents or
timestamps, not in an index search.

```ts
// correct in JavaScript for index searches and for value-space searches alike
const mid = lo + Math.floor((hi - lo) / 2);

// also correct, and only for non-negative bounds below 2^32
const midUnsigned = (lo + hi) >>> 1;

// 🔴 wrong: >> truncates the sum to 32 signed bits
// const midBroken = (lo + hi) >> 1;
```

⚠️ **A binary search over a range that can be negative has a second, unrelated failure.** Both
`/ 2` in Java and `Math.trunc` round *towards zero*, so a midpoint of a negative range rounds
upwards, and the standard `lo = mid + 1` / `hi = mid` loop can stop making progress and spin
forever. Use flooring division there — `Math.floorDiv(lo + hi, 2)` in Java,
`Math.floor((lo + hi) / 2)` in JavaScript — and keep `lo + ((hi - lo) >> 1)` for non-negative
ranges, where `>>` and flooring agree.

## 2 — The running product under a modulus

Counting problems ask for an answer modulo a large prime, conventionally 10^9 + 7. The multiply is
where it breaks:

- **Java `int`:** two values below 10^9 + 7 have a product up to about 10^18, roughly 2^60 — far
  beyond `Integer.MAX_VALUE`. `(a * b) % MOD` with `int` operands wraps before the `%` ever runs and
  produces a plausible small number that is simply wrong.
- **Java `long`:** 10^18 fits comfortably below 2^63 − 1, about 9.2 × 10^18. So `long` is the answer,
  and it is the entire reason the convention picks a modulus near 10^9: it is chosen so the product
  of two residues fits a 64-bit signed integer. The headroom runs out at a modulus near 3.03 × 10^9,
  the square root of 2^63; above that even `long` wraps and you need `BigInteger`.
- **JavaScript `number`:** 10^18 is far above 2^53, so the product loses low digits *before* the
  remainder is taken — and MDN's guarantee only covers *"integers between -(2^53 – 1) and 2^53 – 1"*.
  There is no wider primitive to escape into. `BigInt` is the answer, or a modulus small enough that
  the product stays under 2^53 (which caps the modulus at about 9.4 × 10^7 — usually not the one the
  problem asked for).

```java
static final long MOD = 1_000_000_007L;

// both operands are reduced first, so each is below MOD and the product is below MOD^2 ~ 10^18
static long mulmod(long a, long b) {
    return ((a % MOD) * (b % MOD)) % MOD;
}
```

```ts
export const MOD = 1_000_000_007n;

// BigInt because the intermediate product is ~10^18, three orders of magnitude past 2^53
export const mulmod = (a: bigint, b: bigint): bigint => ((a % MOD) * (b % MOD)) % MOD;
```

🔴 **Reduce before multiplying, not only after.** `(a * b) % MOD` where `a` and `b` have not
themselves been reduced can overflow even in `long`, because the operands may be arbitrarily large;
`((a % MOD) * (b % MOD)) % MOD` bounds both factors first. Using this multiply inside fast
exponentiation belongs to [Fast exponentiation and the modular inverse](07-fast-exponentiation-and-the-modular-inverse.md); the
subtraction case, where `%` yields a negative residue and needs `((x % m) + m) % m` or
`Math.floorMod`, belongs to [Mathematical foundations](03-mathematical-foundations.md).

## 3 — The sum accumulated in the element type

Every individual value fits. The total does not. This is the one that reaches production, because
the per-row assertion is true and everyone checks the per-row assertion.

```java
// wraps once the total passes 2^31 - 1, silently, with no bad row to point at
int wrong = 0;
for (int v : values) wrong += v;

// the accumulator is the wider type from the start
long right = 0L;
for (int v : values) right += v;

// or refuse rather than wrap, with the exception naming the iteration that did it
long checked = 0L;
for (int v : values) checked = Math.addExact(checked, v);
```

Two variants of the same mistake, both common:

- **`IntStream.sum()` sums into an `int`.** `mapToLong(...).sum()` is the fix, and the mapping has to
  happen before the terminal operation ([05c](05c-javas-int-and-the-checked-arithmetic.md)).
- **A prefix-sum array typed as `int[]` over `int` values.** Element `i` holds the sum of the first
  `i` values, so the array's type has to be `long[]` even though the input is `int[]`. A prefix-sum
  array is a sum wearing a different shape.

In JavaScript the same site fails at 2^53 instead of 2^31, and rounds instead of wrapping. For a
storefront that is usually safe — cents summed over any plausible revenue stay far below 9 × 10^15
([05](05-integer-limits-and-overflow.md)) — but a sum of *nanosecond durations*, a sum of 64-bit
hashes, or a count of bytes processed across a long-running job all pass it.

### The same bug in three more disguises

- **`n * (n + 1) / 2`** for the sum of `0…n`. The product overflows an `int` for `n` beyond roughly
  65,000, long before the answer would. The rewrite that avoids the large intermediate: divide the
  even one of `n` and `n + 1` by two *before* multiplying.
- **Segment-tree and heap child indices**, `2 * node + 1`. Fine for realistic sizes and not fine
  when the tree is sized `4 * n` with `n` near 2^29.
- **Hash combination**, `31 * h + x`, which overflows on purpose — that one is
  [05e](05e-overflow-on-purpose.md).

## Gotchas

**★ Symptom: a binary search throws an index-out-of-bounds on a huge array, or a value-space search
returns nonsense.** Cause: `(lo + hi) / 2` formed a sum that exceeded `Integer.MAX_VALUE` and
wrapped negative. Fix: `lo + ((hi - lo) >> 1)`, which never builds an intermediate larger than a
bound that was already valid. `(lo + hi) >>> 1` also works, but only for non-negative bounds.

**★ Symptom: the Java fix `(lo + hi) >> 1` was ported to JavaScript and the search broke on large
bounds.** Cause: `>>` coerces the sum to 32 signed bits, so a sum at or above 2^31 wraps negative —
JavaScript's arithmetic was safe and the bit operator was not. Fix:
`lo + Math.floor((hi - lo) / 2)`, or `(lo + hi) >>> 1` if the bounds are non-negative and below
2^32.

**★ Symptom: a modular answer is wrong but plausible, and only for large inputs.** Cause: the
product of two residues near 10^9 is about 10^18 — beyond an `int` in Java and beyond 2^53 in a
JavaScript number — so the multiply corrupted the value before the `%` ran. Fix: `long` in Java,
`BigInt` in TypeScript, and reduce both operands before multiplying, not only afterwards.

**★ Symptom: a report total is negative while every row is positive.** Cause: the accumulator has
the element's type, and the sum passed 2^31 − 1. Fix: a `long` accumulator, or `Math.addExact` to
turn the wrap into an exception at the iteration that caused it. The same applies to
`IntStream.sum()` and to a prefix-sum array typed like its input.

**★ Symptom: a binary search over a range that includes negative values never terminates.** Cause:
the midpoint rounds *towards zero*, so on a negative range it rounds up, and the `lo = mid + 1` /
`hi = mid` update stops shrinking the interval. Fix: flooring division —
`Math.floorDiv(lo + hi, 2)` in Java, `Math.floor((lo + hi) / 2)` in JavaScript.

**Symptom: `n * (n + 1) / 2` gives a negative triangular number.** Cause: the product overflows an
`int` for `n` past roughly 65,000, even though the final answer would have fit. Fix: halve the even
factor first, or compute in `long`. This is the arithmetic alternative to the XOR missing-number
solution and precisely why the XOR version is preferred in an interview
([04e](04e-xor-and-the-problems-it-solves.md)).

**Symptom: `Math.addExact` was added everywhere and the code became unreadable.** Cause: it was
applied to loop counters and index arithmetic that cannot overflow. Fix: use it where operands are
data-dependent — sums of input values, products of quantities and prices — and use a rewrite that
removes the intermediate where one exists, because a rewrite needs no exception handling at all.

**Symptom: the midpoint fix was applied and the search still fails at the boundary.** Cause: the
loop invariant, not the arithmetic. `lo + ((hi - lo) >> 1)` biases towards `lo`, so a loop that
updates `lo = mid` rather than `lo = mid + 1` can stall; that variant needs the upper midpoint,
`lo + ((hi - lo + 1) >> 1)`. Fix: match the midpoint's bias to the update rule — the overflow fix
and the termination argument are separate concerns and both have to hold.

## Interview questions

**★ What is wrong with `mid = (lo + hi) / 2`?**
The sum. In Java both bounds are `int`s that can approach `Integer.MAX_VALUE`, documented as
*"2^31-1"*, so `lo + hi` needs one more bit than an `int` has; it wraps to a negative value and the
division produces a negative index. The fix is a rewrite rather than a check:
`lo + ((hi - lo) >> 1)`. Inside the loop `hi >= lo`, so `hi - lo` is non-negative and no larger than
`hi`, half of it is smaller still, and adding it to `lo` lands at most at `hi` — no intermediate is
ever bigger than a value that was already valid. `(lo + hi) >>> 1` also works, because two's
complement addition keeps the true sum's low 32 bits and the unsigned shift brings the carried bit
down as a value bit rather than a sign; it requires both bounds to be non-negative.

**★ Does the same bug exist in JavaScript?**
Not in the arithmetic, and yes in the habit. An array index cannot approach 2^53, so `(lo + hi) / 2`
stays inside the safe range and is fine. But `(lo + hi) >> 1`, carried over from Java, coerces the
sum to 32 signed bits — MDN: *"Numbers with more than 32 bits get their most significant bits
discarded"* — so it wraps negative once the sum reaches 2^31, which a search over cents, timestamps
or any value space can easily reach. The JavaScript answer is `lo + Math.floor((hi - lo) / 2)`, and
if you want the shift, it must be `>>>`.

**★ Why is the modulus 10^9 + 7, arithmetically?**
Because it is the largest convenient size for which the *product of two residues* still fits a
64-bit signed integer: two values below 10^9 + 7 multiply to about 10^18, and `long` holds up to
about 9.2 × 10^18. Choose a modulus near 3 × 10^9 or above and even `long` wraps, and you need
`BigInteger`. Its primality is a separate requirement, needed so that Fermat's little theorem gives
a modular inverse. In JavaScript none of that headroom exists — 10^18 is three orders of magnitude
past 2^53 — so the same code needs `BigInt`, and that difference in where the language breaks is
usually the point of the question.

**★ A report shows a negative total and every row is positive. Where do you look?**
At the accumulator's type, first and almost always. The per-row values fit their type by
construction, and the sum is the only value in the computation whose magnitude is unbounded by the
input's shape, so an `int` accumulator over `int` rows is the default suspect — as is
`IntStream.sum()`, which sums into an `int` regardless of what you assign the result to, and a
prefix-sum array typed like its input. In a Node service the same site fails differently: the total
rounds rather than wrapping, so it stays positive and is merely wrong in the low digits, which is
harder to notice and is why the boundary check belongs at the point of accumulation.

**Why prefer a rewrite over `Math.addExact` where both are available?**
Because an exception tells you the computation cannot proceed, while a rewrite means the
computation never had a problem. `lo + ((hi - lo) >> 1)` cannot overflow for any valid bounds, so
there is no error path to design, test or explain; `Math.addExact((lo + hi), 0)` would only convert
a wrong answer into a thrown one. The checked methods are for the places where the large
intermediate is genuinely required — a sum of arbitrary input values, a product of two
data-dependent quantities — and the rewrite is for the places where the formula, not the data, was
the problem.

**Is there a case where you would deliberately let the arithmetic overflow?**
Yes, and it is a different subject rather than an exception to this one: hash functions and rolling
hashes rely on wrapping as their reduction step, and Java's `String.hashCode` is specified as
running *"using `int` arithmetic"*. That is
[05e](05e-overflow-on-purpose.md). The distinction to state is that
deliberate overflow is acceptable exactly when the value's *meaning* is "a number modulo 2^32" —
never when it is a count, a total, an index or an identifier.

---

← Prev: [05c · Java's int, and the checked arithmetic](05c-javas-int-and-the-checked-arithmetic.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [05e · Overflow on purpose](05e-overflow-on-purpose.md)
