---
title: "pow(x, n) is binary exponentiation plus four boundaries, and the one that fails is n = Integer.MIN_VALUE — because the first line of every negative-exponent implementation is n = -n, which for that single value does nothing at all"
sidebar_label: "11d · Integer pow"
sidebar_position: 11.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the JDK 25 javadoc for
> [`java.lang.Math`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Math.html)
> — `pow(double,double)` special cases and the *"within 1 ulp"* accuracy statement, `abs(int)`,
> `negateExact`, `multiplyExact` — and
> [`java.lang.Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)
> for `MIN_VALUE` / `MAX_VALUE`, plus MDN,
> [`Math.pow()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/pow)
> — all quoted verbatim. **The exponentiation algorithm itself is
> [07](07-fast-exponentiation-and-the-modular-inverse.md)'s subject and is linked, not re-derived**;
> this page owns only the boundaries. **No sandbox run.** Version spine: **JDK 25 · MDN as fetched
> 2026-09-07**.

**Implementing `pow` is asked because everybody knows the halving trick and almost nobody handles
the exponent's sign correctly.** The algorithm — square the base, halve the exponent, multiply in
the base on odd steps — is derived in [07](07-fast-exponentiation-and-the-modular-inverse.md) and
this page will not repeat it. What it repeats is what the algorithm sits on: the negation of a
negative exponent, which overflows for exactly one input; the base of zero, whose behaviour differs
between "zero to a positive power" and "zero to a negative power"; the exact-integer version, which
overflows long before the exponent does; and the accuracy question, which both platforms document
and which decides whether your hand-rolled loop is better or worse than the library call.

## The shape, with the sign handled

```java
static double myPow(double x, int n) {
    long e = n;                   // ← widen FIRST, before any negation
    if (e < 0) { x = 1 / x; e = -e; }
    double result = 1;
    while (e > 0) {
        if ((e & 1) == 1) result *= x;
        x *= x;
        e >>= 1;
    }
    return result;
}
```

**The single line that matters is `long e = n;` and it must come before the negation.** Written the
natural way —

```java
if (n < 0) { x = 1 / x; n = -n; }   // ⛔ wrong for exactly one input
```

— the negation is a no-op when `n` is `Integer.MIN_VALUE`, because the two's-complement `int` range
is asymmetric: the javadoc gives `MIN_VALUE` as *"-2^31"* and `MAX_VALUE` as *"2^31-1"*, so
`-MIN_VALUE` is not representable and the wrap returns `MIN_VALUE` itself. `n` is then still
negative, the `while (n > 0)` loop runs zero times, and the function returns `1.0` for every base.
**No exception, no warning, one wrong answer.** `Math.abs` has the identical hole and its javadoc
says so outright:

> *"Note that if the argument is equal to the value of `Integer.MIN_VALUE`, the most negative
> representable `int` value, the result is that same value, which is negative."*

Three ways to be correct, and they are not equally good:

1. **Widen to `long` before negating** — shown above. Every `int` negated fits in a `long`, the loop
   condition works, and nothing else changes. This is the answer to give.
2. **`Math.negateExact(n)`** — *"Returns the negation of the argument, throwing an exception if the
   result overflows an `int`. The overflow only occurs for the minimum value."* Correct and loud,
   but it turns a valid input into an exception, which is not what the caller wanted.
3. **Peel one factor first**: multiply the result by `1/x` once and use `-(n + 1)`, which is
   representable. Correct, and harder to read than the widening, so keep it as the answer for a
   language with no wider type.

In TypeScript there is no `int` and therefore no such trap — a double negates symmetrically — but
the same code should still widen conceptually, because the problem statement's "32-bit signed
exponent" is a specification the language is not enforcing for you
([05f](05f-the-cross-language-trap.md)).

## Zero, one, and minus one

Four bases have documented or degenerate behaviour and each is a plausible test case.

**`x = 0`.** Zero to a positive power is zero. Zero to a **negative** power is a division by zero,
and the two platforms describe the double result explicitly. Java:

> *"If the first argument is positive zero and the second argument is less than zero, or the first
> argument is positive infinity and the second argument is greater than zero, then the result is
> positive infinity."*

> *"If the first argument is positive zero and the second argument is greater than zero, or the
> first argument is positive infinity and the second argument is less than zero, then the result is
> positive zero."*

So `Math.pow(0.0, -2)` is positive infinity, not an exception. Your hand-rolled version reaches the
same place, because `1 / 0.0` is infinity in IEEE arithmetic — but only if you *let* it: a version
that special-cases `x == 0` with an early `return 0` gets the negative-exponent case wrong.

**`n = 0`.** The result is `1` for every base, including zero. Java:

> *"If the second argument is positive or negative zero, then the result is 1.0."*

`0^0 = 1` is a convention chosen by the floating-point specification, not a mathematical truth, and
saying "it is defined as 1 by IEEE 754 and both platforms document it" is a better answer than
arguing about limits.

**`x = 1` and `x = -1` with an enormous `n`.** These are the inputs designed to make a linear
solution time out and to make a naive recursive one recurse `2^31` times. Binary exponentiation
handles them in about 31 iterations like everything else, so they are only a trap for the `O(n)`
loop. Note also the NaN case both platforms document: Java, *"If the absolute value of the first
argument equals 1 and the second argument is infinite, then the result is NaN"*; MDN lists
*"`base` is ±1 and `exponent` is ±`Infinity`"* among its NaN cases. That only arises with a
floating-point exponent, which this problem does not have — but it is the reason `Math.pow` cannot
simply "do the sensible thing".

**A negative base.** With an integer exponent it is fine: the sign follows the parity of `n`. With a
*fractional* exponent MDN is blunt about the library's behaviour:

> *"Due to 'even' and 'odd' roots laying close to each other, and limits in the floating number
> precision, negative bases with fractional exponents always return `NaN`, even when the
> mathematical result is real."*

That is the sentence to remember if you ever try to compute a cube root as `x ** (1/3)`.

## The exact integer version, which overflows almost immediately

If base and exponent are integers and you want an *exact* result, `Math.pow` is the wrong tool: it
returns a `double`, and a double stops representing integers exactly past `2^53 − 1`
([05](05-integer-limits-and-overflow.md)). The exact version is the same loop on integers, with an
overflow check on every multiply:

```java
static long ipow(long base, int exp) {
    if (exp < 0) throw new IllegalArgumentException("negative exponent has no integer result");
    long result = 1;
    while (exp > 0) {
        if ((exp & 1) == 1) result = Math.multiplyExact(result, base);
        exp >>= 1;
        if (exp > 0) base = Math.multiplyExact(base, base);   // guard: skip the last squaring
    }
    return result;
}
```

Two details in four lines. `Math.multiplyExact` *"Returns the product of the arguments, throwing an
exception if the result overflows an `int`"* — the `long` overload behaves the same for `long` —
which converts a silent wrap into an `ArithmeticException`. And the `if (exp > 0)` guard around the
squaring is not cosmetic: on the final iteration the squared base is never used, and squaring it
anyway can overflow on an input whose *answer* fits perfectly. **That is a real bug that only
appears near the top of the range**, which is where it will not be tested.

For results beyond `long`, `BigInteger` has an exact `pow`; in TypeScript, `BigInt` supports `**`
([05b](05b-bigint-and-when-to-reach-for-it.md)). Under a modulus, none of this arises and
[07b](07b-modular-exponentiation-and-where-the-product-overflows.md) is the page.

## Accuracy: is your loop better than `Math.pow`?

Java documents its guarantee:

> *"The computed result must be within 1 ulp of the exact result. Results must be semi-monotonic."*

Your repeated-squaring loop carries **no such guarantee**. It performs about `log2(n)` multiplications
of doubles, and each one rounds, so the errors compound in a way that is bounded but not by 1 ulp.
So for a `double` base, the library call is the more accurate answer and the loop is the interview
answer. ⚠️ MDN states **no** accuracy guarantee for `Math.pow` — it only notes that
*"`Math.pow()` is equivalent to the `**` operator, except `Math.pow()` only accepts numbers"* — so
**no precision claim is made here for JavaScript**, and if exactness matters there, the answer is
integers or `BigInt`, not a more careful float loop.

## Gotchas

**★ Symptom: `myPow(x, Integer.MIN_VALUE)` returns 1.0 for every base.** Cause: `n = -n` is a no-op
at `MIN_VALUE`, so `n` stays negative and the `while (n > 0)` loop never runs. Fix: widen to `long`
before negating. Diagnostic: this is the *only* input that fails, so a test suite without it passes
completely.

**★ Symptom: the same function with `Math.abs(n)` instead of `-n` fails identically.** Cause:
`Math.abs(int)` is documented to return `MIN_VALUE` unchanged. Fix: same — widen first. Reaching for
`abs` instead of negation does not change the arithmetic, only the appearance of safety.

**★ Symptom: `pow(0, -1)` throws or returns 0 instead of infinity.** Cause: an early
`if (x === 0) return 0`. Fix: let the reciprocal happen. IEEE division by zero produces infinity, and
both platforms document the result — Java says *"the result is positive infinity"*. If your API
should reject it instead, reject it explicitly rather than by returning a wrong finite number.

**★ Symptom: `pow(x, 0)` returns 0.** Cause: the accumulator initialised to `0` rather than `1`. Fix:
the identity for multiplication is 1, and it is also the documented answer — *"If the second argument
is positive or negative zero, then the result is 1.0"*, for every base including zero.

**★ Symptom: an integer `pow` returns a plausible but wrong large number.** Cause: `long`
multiplication wrapping silently. Fix: `Math.multiplyExact`, or a pre-check against
`Long.MAX_VALUE / base`. Related: computing `(long) Math.pow(a, b)` for integers is wrong twice over
— the `double` loses exactness above `2^53 − 1` and the cast then truncates whatever it got.

**★ Symptom: an integer `pow` overflows on an input whose answer fits.** Cause: the final squaring
of the base performed after the last needed multiplication. Fix: guard it — `if (exp > 0)` before
squaring. This is the boundary case that distinguishes a carefully written loop from a transcribed
one.

**★ Symptom: `x ** (1 / 3)` returns `NaN` for a negative `x`.** Cause: MDN's documented behaviour —
*"negative bases with fractional exponents always return `NaN`, even when the mathematical result is
real"*. Fix: compute the root of the magnitude and reapply the sign yourself when the root's index
is odd.

**★ Symptom: a recursive `pow` overflows the stack.** Cause: recursing on `n − 1` instead of on
`n / 2`, making the depth linear in the exponent. Fix: halve. The correct recursion has depth
`Θ(log n)` — about 31 frames for a 32-bit exponent — and never needs converting to a loop for stack
reasons ([01h](01h-choosing-recursion-and-reading-the-overflow.md)).

**★ Symptom: a "fast" `pow` that computes `helper(x, n/2)` twice.** Cause: writing
`return half(n/2) * half(n/2)` instead of binding the result. Fix: bind it. Calling it twice makes
the recurrence `T(n) = 2T(n/2) + O(1)`, which solves to `Θ(n)` — the algorithm is linear again and
looks logarithmic ([08 · recurrences](../phase-1-complexity/08-recurrences-and-the-master-theorem.md)).

## Interview questions

**★ Implement `pow(x, n)` in `O(log n)`. What is the one input that breaks the obvious version?**
`n = Integer.MIN_VALUE`. Every implementation begins by making the exponent positive, and `-n` — or
`Math.abs(n)` — is a no-op for that value, because the `int` range is asymmetric: `MIN_VALUE` is
`-2^31` and there is no `+2^31`. The javadoc for `Math.abs` states it directly. The loop then runs
zero times and the function returns `1.0` for every base. The fix is to widen the exponent to a
`long` before negating; `Math.negateExact` would throw, and peeling one factor with `-(n + 1)` also
works and reads worse.

**★ What should `pow(0, 0)` and `pow(0, -1)` return?**
`1` and positive infinity respectively, and both are documented rather than derived. Java's javadoc
says *"If the second argument is positive or negative zero, then the result is 1.0"* — for every
base — and that positive zero raised to a negative power gives positive infinity. `0^0 = 1` is a
convention adopted by the floating-point specification, so the right answer in an interview is to
name it as a convention with a citation rather than to argue about limits.

**★ Would you use `Math.pow` or your loop in production?**
`Math.pow` for a floating-point base, because Java guarantees the result is *"within 1 ulp of the
exact result"* and my loop, which performs about `log2(n)` roundings, guarantees nothing of the
kind. My loop is the right answer when the values are integers and exactness matters, since a
`double` cannot represent integers exactly past `2^53 − 1` — but then it must be written on
integers with `multiplyExact`, or on `BigInteger`, rather than on doubles. ⚠️ MDN publishes no
accuracy guarantee for JavaScript's `Math.pow`, so I would not make the same claim there.

**★ Write an exact integer `pow`. What breaks?**
The result overflows long before the exponent gets large — `2^63` is reached at an exponent of 63
for a base of 2, and far sooner for bigger bases. So every multiplication needs `Math.multiplyExact`
or a pre-check, and the final squaring of the base must be skipped, because it happens after the
last multiplication that uses it and can overflow on inputs whose answers fit. Beyond `long`, it is
`BigInteger.pow`, or `BigInt` with `**` in TypeScript. Under a modulus the overflow question changes
shape entirely and is
[07b](07b-modular-exponentiation-and-where-the-product-overflows.md)'s subject.

**★ Why is the recursion depth not a problem here?**
Because the exponent halves each time, so the depth is `Θ(log n)` — about 31 frames for a 32-bit
exponent, which no stack notices. The version that *is* a problem recurses on `n − 1`, giving linear
depth and a stack overflow for a large exponent. A related and subtler mistake is calling the
recursive helper twice per level instead of binding its result once: that makes the recurrence
`T(n) = 2T(n/2) + O(1)`, which is `Θ(n)`, so the function is linear while looking logarithmic.

---

← Prev: [11c · Palindromic numbers](11c-palindromic-numbers.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [11e · Integer square root](11e-integer-square-root.md)
