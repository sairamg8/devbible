---
name: research-dsa-phase2
description: Banked primary-source quotes for docs/dsa/pages/phase-2-recursion-maths-bits/ (13 pages) — MDN bitwise 32-bit coercion, MAX_SAFE_INTEGER, BigInt, Array.prototype.sort comparator contract, Math.random, "too much recursion"; Java 25 javadoc for Math.addExact/multiplyExact/toIntExact/floorMod/floorDiv, Integer bit methods, Collections.shuffle. Fetched once on 2026-09-07 by session 5c396fd0. Do not re-derive, do not re-fetch.
metadata:
  type: reference
---

# Research bank — DSA phase 2, recursion, maths and bits (fetched 2026-09-07, session `5c396fd0`)

**Do not re-fetch.** Algorithms themselves (Euclid, the sieve, binary exponentiation,
Fisher–Yates, Catalan numbers, quickselect, matrix exponentiation, cross products) are
**mathematics and common practice** with no single primary source — write them as such, with the
derivation shown rather than a citation. What IS primary-sourced is the **language behaviour**
that turns a correct algorithm into a wrong program, and that is what this bank holds. Complexity
notation quotes are in [research_dsa_phase1.md](research_dsa_phase1.md); the interview framing is in
[research_dsa_phase0.md](research_dsa_phase0.md).

🔴 **No sandbox.** Nothing here is a measurement. Do not present any figure below as a benchmark.

---

## MDN — Bitwise AND (the operand-coercion rules, true for every JS bitwise operator)
URL: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_AND

- *"It first coerces both operands to numeric values and tests the types of them."*
- *"It performs BigInt AND if both operands become BigInts; otherwise, it converts both operands to 32-bit integers and performs number bitwise AND."*
- *"A `TypeError` is thrown if one operand becomes a BigInt but the other becomes a number."*
- *"For numbers, the operator returns a 32-bit integer."*
- *"The operator operates on the operands' bit representations in two's complement."*
- *"Numbers with more than 32 bits get their most significant bits discarded."*
- *"For BigInts, there's no truncation. Conceptually, understand positive BigInts as having an infinite number of leading `0` bits, and negative BigInts having an infinite number of leading `1` bits."*

🔴 **This is the load-bearing gotcha of the bit-manipulation page:** JavaScript numbers are
doubles, but *bitwise* operators silently truncate to 32 bits and treat the result as signed.
A bitmask over more than 32 elements is wrong in JS and right in Java's `long`. State the
32-bit truncation and the two's-complement sign from these quotes; do **not** invent a printed
value for any specific expression.

⚠️ MDN did **not** return a sentence naming the exact range −2147483648…2147483647 — describe the
range as the two's-complement 32-bit range in prose, unquoted.

## MDN — `Number.MAX_SAFE_INTEGER`
URL: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER

- *"The `Number.MAX_SAFE_INTEGER` static data property represents the maximum safe integer in JavaScript (2^53 – 1)."*
- Value: *"9007199254740991 (9,007,199,254,740,991, or ~9 quadrillion)."*
- *"Double precision floating point format only has 52 bits to represent the mantissa, so it can only safely represent integers between -(2^53 – 1) and 2^53 – 1. 'Safe' in this context refers to the ability to represent integers exactly and to compare them correctly."*
- *"For example, `Number.MAX_SAFE_INTEGER + 1 === Number.MAX_SAFE_INTEGER + 2` will evaluate to true, which is mathematically incorrect."*
- *"For larger integers, consider using `BigInt`."*

## MDN — `BigInt`
URL: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt

- *"A BigInt value cannot be used with methods in the built-in `Math` object and cannot be mixed with a Number value in operations; they must be coerced to the same type."*
- *"Division (`/`) truncates fractional components towards zero, since BigInt is unable to represent fractional quantities."* — documented examples: `4n / 2n` is `2n`; `5n / 2n` is `2n`, not `2.5n`.
- *"A BigInt value is not strictly equal to a Number value, but it is loosely so:"* — documented: `0n === 0` is `false`, `0n == 0` is `true`.
- *"Only use a BigInt value when values greater than 2^53 are reasonably expected."*

⚠️ MDN makes **no performance claim** about BigInt. Do not state one, do not quantify it. "Slower
than a machine word" may be stated as mechanism (arbitrary precision is not a register operation),
never as a measured figure.

## MDN — `Array.prototype.sort()` (the comparator contract)
URL: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort

- *"If `compareFn` is not supplied, all non-`undefined` array elements are sorted by converting them to strings and comparing strings in UTF-16 code units order."*
- The five documented properties, verbatim: *"More formally, the comparator is expected to have the following properties, in order to ensure proper sort behavior:"* — *Pure*: *"The comparator does not mutate the objects being compared or any external state."* · *Stable*: *"The comparator returns the same result with the same pair of input."* · *Reflexive*: `compareFn(a, a) === 0`. · *Anti-symmetric*: *"`compareFn(a, b)` and `compareFn(b, a)` must both be `0` or have opposite signs."* · *Transitive*: *"If `compareFn(a, b)` and `compareFn(b, c)` are both positive, zero, or negative, then `compareFn(a, c)` has the same positivity as the previous two."*
- *"If a comparing function does not satisfy all of purity, stability, reflexivity, anti-symmetry, and transitivity rules, as explained in the description, the program's behavior is not well-defined."*
- *"Due to this implementation inconsistency, you are always advised to make your comparator well-formed by following the five constraints."*
- *"Since version 10 (or ECMAScript 2019), the specification dictates that `Array.prototype.sort` is stable."*

🔴 **Two pages depend on this.** *Randomisation*: `arr.sort(() => Math.random() - 0.5)` violates
**stability** (same pair, different result) and **transitivity**, so the spec puts the program's
behaviour outside what is defined — that is the citation for "the random comparator shuffle is not
a shuffle", and it is stronger and more accurate than any bias percentage. ⚠️ **Do not quote a bias
figure; none was fetched and none is needed.** *Number problems*: the default string sort is why
`[10, 9, 1].sort()` is a classic bug — state it from the first quote, do not print an output array
as if run.

## MDN — Error: "too much recursion" / "Maximum call stack size exceeded"
URL: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion

- *"A function that calls itself is called a recursive function."*
- *"Once a condition is met, the function stops calling itself."* — *"This is called a base case."*
- *"When there are too many function calls, or a function is missing a base case, JavaScript will throw this error."*
- *"In some ways, recursion is analogous to a loop. Both execute the same code multiple times, and both require a condition (to avoid an infinite loop, or rather, infinite recursion in this case)."*
- Error type by engine, verbatim: *"`InternalError` in Firefox; `RangeError` in Chrome and Safari."*

⚠️ **No stack-depth number was fetched, and none exists as a spec guarantee** — the limit is
engine- and platform-dependent. State it that way. ⛔ Never write "Node's limit is about N frames";
that is exactly the fabricated figure rule 3 bans. `docs/dsa/pages/phase-1-complexity/04b-tail-calls-and-the-explicit-stack.md`
already covers the explicit-stack conversion — link it, do not rewrite it.

## MDN — `Math.random()`
URL: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random

- *"The `Math.random()` static method returns a floating-point, pseudo-random number that's greater than or equal to 0 and less than 1, with approximately uniform distribution over that range — which you can then scale to your desired range."*
- *"`Math.random()` does not provide cryptographically secure random numbers. Do not use them for anything related to security. Use the Web Crypto API instead, and more precisely the `Crypto.getRandomValues()` method."*
- *"The implementation selects the initial seed to the random number generation algorithm; it cannot be chosen or reset by the user."*

🔴 The last sentence is the citation for **"you cannot seed `Math.random()`"**, which is why a
randomised algorithm is not reproducible in JS without injecting your own generator — the practical
answer to "how do you write a deterministic test for a randomised solution".

---

## Java 25 — `java.lang.Math` (the overflow-checked arithmetic)
URL: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Math.html

- `addExact(int,int)`: *"Returns the sum of its arguments, throwing an exception if the result overflows an `int`."* — Throws: *"`ArithmeticException` - if the result overflows an int"*
- `multiplyExact(int,int)`: *"Returns the product of the arguments, throwing an exception if the result overflows an `int`."* — same `ArithmeticException`.
- `toIntExact(long)`: *"Returns the value of the `long` argument, throwing an exception if the value overflows an `int`."*
- `floorMod(int,int)`: *"If neither `floorMod(x, y)` nor `x % y` is zero, they differ exactly when the signs of the arguments differ."* — documented values: `floorMod(+4, -3) == -2` and `(+4 % -3) == +1`; `floorMod(-4, +3) == +2` and `(-4 % +3) == -1`.
- `floorDiv(int,int)`: *"If the signs of the arguments are different, `floorDiv` returns the largest integer less than or equal to the quotient while the `/` operator returns the smallest integer greater than or equal to the quotient. They differ if and only if the quotient is not an integer."* — documented: `floorDiv(-4, 3) == -2`, whereas `(-4 / 3) == -1`.

🔴 **`floorMod` is the citation for the single most common modular-arithmetic bug in interviews:**
`%` in Java (and in JavaScript) is a *remainder*, not a mathematical modulus, so it returns a
negative value for a negative left operand — and an index, a hash bucket or an answer taken
"modulo 1e9+7" computed with `%` after a subtraction is then negative. The documented pairs above
are the proof; write `((x % m) + m) % m` or `Math.floorMod(x, m)` and say which.
🔴 **`addExact`/`multiplyExact` are the citation for silent overflow**: Java's `+` and `*` wrap
without complaint, and `Exact` is the opt-in that turns the wrap into an exception. That is what
makes `(lo + hi) / 2` a real bug and `lo + (hi - lo) / 2` the fix — link
`docs/dsa/pages/phase-1-complexity/` for the complexity side and keep the overflow argument here.

## Java 25 — `java.lang.Integer` (the bit methods)
URL: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html

- `MAX_VALUE`: *"A constant holding the maximum value an `int` can have, 2^31-1."*
- `MIN_VALUE`: *"A constant holding the minimum value an `int` can have, -2^31."*
- `bitCount(int)`: *"Returns the number of one-bits in the two's complement binary representation of the specified `int` value. This function is sometimes referred to as the population count."*
- `highestOneBit(int)`: *"Returns an `int` value with at most a single one-bit, in the position of the highest-order ("leftmost") one-bit in the specified `int` value. Returns zero if the specified value has no one-bits in its two's complement binary representation, that is, if it is equal to zero."*
- `lowestOneBit(int)`: *"Returns an `int` value with at most a single one-bit, in the position of the lowest-order ("rightmost") one-bit in the specified `int` value. Returns zero if the specified value has no one-bits ... that is, if it is equal to zero."*
- `numberOfTrailingZeros(int)`: *"Returns the number of zero bits following the lowest-order ("rightmost") one-bit in the two's complement binary representation of the specified `int` value. Returns 32 if the specified value has no one-bits in its two's complement representation, in other words if it is equal to zero."*
- `numberOfLeadingZeros(int)`: *"Returns the number of zero bits preceding the highest-order ("leftmost") one-bit ... Returns 32 if the specified value has no one-bits in its two's complement representation, in other words if it is equal to zero."*
- `reverse(int)`: *"Returns the value obtained by reversing the order of the bits in the two's complement binary representation of the specified `int` value."*

🔴 The **zero cases are the gotcha**, and they are documented above rather than guessed: `lowestOneBit(0)`
is `0`, `numberOfTrailingZeros(0)` is `32`. A loop that peels the lowest set bit terminates because of
the first; an index computed from the second on a zero mask is out of range. `MIN_VALUE` has no
positive counterpart, which is why `Math.abs(Integer.MIN_VALUE)` is still negative — ⚠️ that last
claim was **not** in the fetched `Integer` page; if a page states it, state it as the arithmetic
consequence of the two documented constants, not as a quote.

## Java 25 — `java.util.Collections.shuffle` (Fisher–Yates, documented)
URL: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Collections.html

- *"Randomly permutes the specified list using a default source of randomness."*
- *"All permutations occur with approximately equal likelihood."*
- *"The hedge "approximately" is used in the foregoing description because default source of randomness is only approximately an unbiased source of independently chosen bits."*
- *"If it were a perfect source of randomly chosen bits, then the algorithm would choose permutations with perfect uniformity."*
- *"This implementation traverses the list backwards, from the last element up to the second, repeatedly swapping a randomly selected element into the "current position"."*
- *"Elements are randomly selected from the portion of the list that runs from the first element to the current position, inclusive."*
- `shuffle(List, Random)`: *"Randomly permute the specified list using the specified source of randomness."* ⚠️ Its javadoc carries **no** algorithm description or uniformity guarantee — it says only that it *"is equivalent to `shuffle(List, RandomGenerator)` and exists for backward compatibility."*

🔴 This is the **Fisher–Yates page's primary source**, and it is unusually good: the last two
quotes are the algorithm's invariant stated by the platform — swap into the current position from
the prefix *inclusive*. The off-by-one that biases a hand-written shuffle is excluding the current
position (drawing from `[0, i)` instead of `[0, i]`), and the javadoc's "inclusive" is what
settles it.

---

## Not fetched — write these as mathematics or common practice, with the derivation shown

- **Euclid's algorithm, the sieve of Eratosthenes, factorisation, binary exponentiation, the modular inverse by Fermat's little theorem, Catalan numbers, inclusion–exclusion, matrix exponentiation, cross products** — mathematics. Derive them on the page; cite nothing. The complexity claims (sieve `O(n log log n)`, exponentiation `O(log n)`) belong to phase 1's analysis vocabulary.
- **Merge sort, quickselect, counting inversions, the divide-and-conquer template** — standard algorithms; show the recurrence and solve it with phase 1's master theorem page (`../phase-1-complexity/08-recurrences-and-the-master-theorem.md`).
- **Why answers are taken modulo a large prime (10^9+7)** — competition/interview convention. State it as convention plus the arithmetic reason (it fits in an `int` product only via `long`; primality is what makes Fermat's inverse valid). ⛔ Do not attribute it to a specification.
- **Node's actual stack depth, V8's `--stack-size` default, any JIT behaviour** — NOT fetched, and not a spec guarantee. Never state a number.
- **Reservoir sampling** — mathematics; the induction proof is the content. Previewed here, owned by a later phase.
- **`BigInteger` / `BigDecimal` javadoc** — not fetched. Mention `BigInteger` as Java's arbitrary-precision type without quoting API detail.
