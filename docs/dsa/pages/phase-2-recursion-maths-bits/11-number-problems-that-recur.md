---
title: "Every digit-manipulation problem is the same three-line loop, and every bug in one is at zero, at a negative input, or at the fact that JavaScript's / is not integer division — so the loop is not the exercise, the boundary is"
sidebar_label: "11 · Number problems that recur"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against MDN,
> [`Math.trunc()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc)
> and the [remainder (`%`) operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Remainder),
> and the JDK 25 javadoc for
> [`java.lang.Math`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Math.html)
> (`floorDiv`, `floorMod`, `abs(int)`) and
> [`java.lang.Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)
> (`MIN_VALUE`) — all quoted verbatim, including the value pairs the javadocs themselves document.
> ⚠️ No exactness guarantee is claimed for `Math.log10` in either language; neither page was fetched.
> Overflow as a subject belongs to [05](05-integer-limits-and-overflow.md) and is linked, not
> re-derived. **No sandbox run**; every value below is quoted from a javadoc or is arithmetic
> performed in the text. Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**There is one loop underneath reverse-an-integer, palindrome-without-strings, digit sum, digital
root, happy numbers, base conversion and Armstrong numbers, and you already know it: take `n % 10`,
divide by 10, repeat.** Which is why none of those is really a question about the loop. The question
is what happens at `0`, at a negative input, at `Integer.MIN_VALUE`, and at the moment a
JavaScript-shaped mind writes `n / 10` and gets `12.3`. This page establishes the loop and then
spends the rest of its length on the four boundaries, because every subsequent page in this topic —
[11b](11b-reversing-an-integer.md) through [11j](11j-base-conversion-and-digit-sums.md) — assumes
you have this one right and goes on to its own boundary.

## The loop, and the one line that differs between languages

```java
// Java: '/' on ints truncates toward zero, so this is integer division already.
int n = 12345, sum = 0;
while (n > 0) {
    int d = n % 10;   // 5, then 4, then 3, …  — digits come out least-significant first
    sum += d;
    n /= 10;
}
```

```ts
// TypeScript: '/' is floating-point division. 12345 / 10 is 1234.5, not 1234.
let n = 12345, sum = 0;
while (n > 0) {
  const d = n % 10;
  sum += d;
  n = Math.trunc(n / 10);   // NOT n / 10, and — see below — not always Math.floor either
}
```

**This is the single most common cross-language transcription bug in the whole area.** In Java the
division is integer division because both operands are `int`. In JavaScript every number is a
double, so `n / 10` produces a fraction and the loop either never terminates or produces nonsense
digits from a fractional `n`. `Math.trunc` is the fix, and MDN describes it exactly:

> *"The `Math.trunc()` static method returns the integer part of a number by removing any fractional
> digits."*

> *"The way `Math.trunc()` works is more straightforward than the other three `Math` methods:
> `Math.floor()`, `Math.ceil()` and `Math.round()`; it truncates (cuts off) the dot and the digits
> to the right of it, no matter whether the argument is a positive or negative number."*

That last clause — *"no matter whether the argument is a positive or negative number"* — is why
`Math.trunc` and not `Math.floor` is the counterpart of Java's `/`.

## The negative case, where the two halves must agree

Both languages' `%` is a **remainder**, not a modulus. MDN:

> *"The remainder (`%`) operator returns the remainder left over when one operand is divided by a
> second operand. It always takes the sign of the dividend."*

So `-123 % 10` is `-3` in both languages. And both languages' truncating division rounds toward
zero, so `-123 / 10` is `-12`. Those two choices are consistent: `-12 · 10 + (-3) = -123`. ✓

The bug appears the moment you mix conventions:

- **`Math.floor(n / 10)` with `n % 10`.** For `n = -123`, `Math.floor(-12.3)` is `-13` while
  `n % 10` is `-3`, and `-13 · 10 + (-3) = -133`, which is not `-123`. The quotient and remainder no
  longer reconstruct the input, so the digit sequence is wrong — and it is wrong only for negative
  inputs, which is why it passes every test someone writes.
- **`Math.trunc(n / 10)` with a floor-style modulus.** The mirror image, equally broken.

Java documents the divergence in the javadoc of the methods that exist to fix it:

> *"If the signs of the arguments are different, `floorDiv` returns the largest integer less than or
> equal to the quotient while the `/` operator returns the smallest integer greater than or equal to
> the quotient. They differ if and only if the quotient is not an integer."* — documented:
> `floorDiv(-4, 3) == -2`, whereas `(-4 / 3) == -1`.

> *"If neither `floorMod(x, y)` nor `x % y` is zero, they differ exactly when the signs of the
> arguments differ."* — documented: `floorMod(-4, +3) == +2` and `(-4 % +3) == -1`.

**The rule to carry: pick a pair and never mix them.** `(trunc, %)` in TypeScript matches
`(/, %)` in Java. `(floor, floorMod)` in TypeScript matches `(floorDiv, floorMod)` in Java. Both
pairs satisfy `q · d + r = n`; every cross combination does not.
[03k](03k-the-remainder-trap-in-indices-hashes-and-shards.md) is the full treatment of that trap in
its other habitat — indices, hash buckets and shards.

**For digit extraction specifically, the truncating pair is what you want**, because it makes the
digits of `-123` come out as `-3, -2, -1` — the digits of `123` with a sign attached, which you can
negate individually or handle by taking the absolute value up front. The flooring pair gives
`7, 8, -2`, which are not the digits of anything.

## `abs` is not the safe way to handle a negative

The obvious opening line — `n = Math.abs(n)` — has a documented hole in Java:

> *"Note that if the argument is equal to the value of `Integer.MIN_VALUE`, the most negative
> representable `int` value, the result is that same value, which is negative."* — `Math.abs(int)`

This is not an edge case dreamt up for interviews: the two's-complement `int` range is asymmetric,
`MIN_VALUE` is *"-2^31"* and `MAX_VALUE` is *"2^31-1"*, so the positive counterpart of `MIN_VALUE`
simply does not exist. `Math.abs` on it returns it unchanged, `-n` on it returns it unchanged, and
your `while (n > 0)` loop then runs zero times on a value that plainly has ten digits.

Three ways out, in increasing order of how much you should like them:

1. **`Math.absExact(n)`** — *"Returns the mathematical absolute value of an `int` value if it is
   exactly representable as an `int`, throwing `ArithmeticException` if the result overflows the
   positive `int` range."* This converts a silent wrong answer into a loud failure, which is
   progress but not an answer.
2. **Promote to `long`.** `long m = Math.abs((long) n);` is always correct, because every `int`
   negated fits in a `long`. Cheap, obvious, and the right answer whenever a `long` is available —
   see [05c](05c-javas-int-and-the-checked-arithmetic.md).
3. **Work in the negative domain.** Normalise to `n ≤ 0` and loop while `n != 0`, negating each
   digit as it comes out. Every `int` has a valid negation *into* the negatives, so nothing can
   overflow:

```java
static int digitSum(int n) {
    if (n > 0) n = -n;              // now n <= 0, and MIN_VALUE needed no negation
    int sum = 0;
    while (n != 0) {
        sum += -(n % 10);           // n % 10 is <= 0 here, so negate the digit
        n /= 10;
    }
    return sum;
}
```

**This is the idiom to know**, because it generalises: any problem that needs `|n|` for an `int` is
safer written in the negative half, and the same trick appears in
[11g](11g-string-to-integer.md)'s parser and in every hand-written `Integer.toString`.

In TypeScript `Math.abs` has no such hole — a double has a symmetric range — but the *other*
boundary applies: past `2^53 − 1` a number is no longer an exact integer, so `n % 10` on it is not
the last digit of anything. [05](05-integer-limits-and-overflow.md) is that subject.

## Zero, which is not a special case until it is

`while (n > 0)` runs zero times for `n = 0`. For a digit **sum** that is the right answer by
accident — the sum is 0. For anything that builds a **sequence** it is wrong: zero has one digit,
and a loop that produces an empty list gives an empty string from `toString`, a digit count of 0,
and a palindrome check that returns true on an empty comparison.

The two correct shapes:

```ts
// Sum-like: the initial value is the answer for 0. Guard not needed.
let sum = 0;
while (n > 0) { sum += n % 10; n = Math.trunc(n / 10); }

// Sequence-like: use a do/while so exactly one digit is emitted for 0.
const digits: number[] = [];
do { digits.push(n % 10); n = Math.trunc(n / 10); } while (n > 0);
```

**`do/while` is the fix, not an `if (n === 0)` prefix**, because the guard has to be repeated at
every call site and the loop shape carries the invariant on its own: *at least one digit exists*.

## Digit count, and why the logarithm is a trap

The loop is exact:

```ts
function digitCount(n: number): number {
  n = Math.abs(n);
  let c = 0;
  do { c++; n = Math.trunc(n / 10); } while (n > 0);
  return c;
}
```

The tempting one-liner is `Math.floor(Math.log10(n)) + 1`, and it is correct **only if** the
platform's `log10` returns exactly `k` for `10^k`. A floating-point logarithm that returns a value a
hair below the integer produces a count one too small at every power of ten — the classic
off-by-one-at-a-round-number.

⚠️ **This page makes no claim either way about whether `Math.log10` is exact at powers of ten in
either language**; neither documentation page was fetched here. That is precisely the point: it is a
guarantee you must go and read before depending on it, and the loop needs no guarantee at all. If
you do use the logarithm, an interviewer asking "are you sure at `n = 1000`?" is asking whether you
know this, not whether you know logarithms.

## Gotchas

**★ Symptom: a digit loop in TypeScript never terminates, or produces fractional digits.** Cause:
`n = n / 10` instead of `n = Math.trunc(n / 10)`. Fix: truncate every division. This is the Java
programmer's first JavaScript bug and the JavaScript programmer's first Java surprise, in opposite
directions: in Java `5 / 2` is `2` and people expect `2.5`.

**★ Symptom: digits of a negative number are wrong, and only of negative numbers.** Cause:
`Math.floor` paired with `%`. For `n = -123`, `Math.floor(-12.3) = -13` and `-123 % 10 = -3`, and
`-13 · 10 − 3 = -133 ≠ -123`, so the quotient and remainder no longer reconstruct the input. Fix:
`Math.trunc` with `%`, or `Math.floor` with a flooring modulus — never one of each.

**★ Symptom: `digitSum(0)` returns an empty string, `digitCount(0)` returns 0.** Cause:
`while (n > 0)` with an accumulator that builds a sequence. Fix: `do/while`, so one digit is always
emitted.

**★ Symptom: a Java digit routine returns 0 for `Integer.MIN_VALUE`.** Cause: `Math.abs(n)` returns
the same negative value — documented — so `while (n > 0)` never runs. Fix: promote to `long`, or
normalise into the negative domain and negate each digit as it is extracted.

**★ Symptom: `n % 10` returns something that is not a digit for a large JavaScript number.** Cause:
`n` exceeded `Number.MAX_SAFE_INTEGER`, so it is no longer an exact integer and its "last digit" is
an artefact of the floating-point representation. Fix: `BigInt` ([05b](05b-bigint-and-when-to-reach-for-it.md)),
or parse from the string form. Diagnostic: `Number.isSafeInteger(n)` before the loop.

**★ Symptom: digits come out in the wrong order.** Cause: the loop is inherently
least-significant-first, and the problem wanted most-significant-first. Fix: collect and reverse, or
build the number back up (which is [11b](11b-reversing-an-integer.md)), or divide by the largest
power of ten instead — but note that computing that power is itself a loop, so reversing a small
array is usually simpler and always safer.

**★ Symptom: a digit-sum routine used on a value read from JSON returns `NaN`.** Cause: the value
arrived as a string, and `"123" % 10` coerces while `Math.trunc("123" / 10)` also coerces, so it
half-works until a non-numeric string appears. Fix: parse explicitly at the boundary
([11g](11g-string-to-integer.md)), and type the function's parameter as `number` so TypeScript
refuses the string at the call site.

**★ Symptom: the same loop written for base 2 or base 16 gives wrong digits for negatives.** Cause:
the sign convention argument above applies to every base, and `%` still takes the dividend's sign.
Fix: normalise the sign once, at the top, and record it separately — which is exactly what
[11j](11j-base-conversion-and-digit-sums.md) does.

**★ Symptom: `Math.floor(Math.log10(n)) + 1` reports one digit too few, and only at powers of ten.**
Cause: a floating-point logarithm returning a value marginally below the exact integer. Fix: use the
loop, or verify your platform's exactness guarantee at powers of ten before relying on it. Do not
"fix" it by adding a small epsilon — that just moves the off-by-one to a different input.

## Interview questions

**★ Extract the digits of an integer. What are the edge cases?**
The loop is `d = n % 10; n = n / 10` repeated, giving digits least-significant first. Four edge
cases, and naming them unprompted is the answer: zero, where `while (n > 0)` produces nothing and a
`do/while` is needed; negative input, where `%` yields negative digits because it takes the sign of
the dividend, so you normalise the sign once at the top; `Integer.MIN_VALUE` in Java, where
`Math.abs` is documented to return the value unchanged so the normalisation must be a promotion to
`long` or a loop in the negative domain; and, in JavaScript, `/` being floating-point division, so
every step needs `Math.trunc`.

**★ Why `Math.trunc` and not `Math.floor`?**
Because it must agree with `%`. `%` takes the sign of the dividend, so it is the *truncating*
remainder, and the truncating quotient is its partner: together they satisfy `q · d + r = n` for
negative inputs. `Math.floor` is the flooring quotient, whose partner is a flooring modulus. Mixing
them breaks the identity — for `-123`, floor gives `-13` and `%` gives `-3`, which reconstruct
`-133`. Java documents the same divergence between `/` and `floorDiv`, and between `%` and
`floorMod`, with worked value pairs in the javadoc.

**★ Why is `Math.abs(n)` unsafe in Java and safe in JavaScript?**
Because the two's-complement `int` range is asymmetric: `MIN_VALUE` is `-2^31` and `MAX_VALUE` is
`2^31 − 1`, so there is no positive `int` equal to `|MIN_VALUE|`, and the javadoc says the result
*"is that same value, which is negative"*. JavaScript's numbers are doubles with a symmetric range,
so `Math.abs` has no such hole — but it has the other one, in that integers above `2^53 − 1` are not
exact, so `% 10` stops meaning "last digit". Each language has a boundary; they are just in
different places.

**★ How do you count the digits of an integer?**
By the loop, in a `do/while` so that zero reports one digit. The logarithm form,
`floor(log10(n)) + 1`, is correct only if the platform guarantees an exact result at powers of ten,
which is a guarantee to look up rather than assume — and there is no advantage to it in an
interview, since the loop is three lines and needs no caveat. For a bounded range, a chain of
comparisons against `10`, `100`, `1000` … is exact, needs no loop and needs no guarantee, which
makes it the one form with nothing to caveat.

**★ Which of these problems are really the same problem?**
Digit sum, digital root, happy numbers, Armstrong numbers, palindromic numbers, reverse an integer,
base conversion and the digit part of `atoi` are all the same three-line loop with a different
accumulator and a different termination test. Saying so is worth more than solving any one of them,
because it tells the interviewer you will not be surprised by the variant they ask next — and
because the *boundaries* are shared too, so a candidate who has the zero, negative and `MIN_VALUE`
cases right has them right for all eight.

{/* FOOTER */}
