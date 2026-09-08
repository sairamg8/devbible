---
title: "Reversing an integer is the digit loop with one extra line, and that line is an overflow check performed BEFORE the multiplication — because after it, in Java, the value has already wrapped and there is nothing left to detect"
sidebar_label: "11b · Reversing an integer"
sidebar_position: 11.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the JDK 25 javadocs for
> [`java.lang.Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)
> (`MAX_VALUE` = *"2^31-1"*, `MIN_VALUE` = *"-2^31"*) and
> [`java.lang.Math`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Math.html)
> (`addExact`, `multiplyExact`, `abs(int)`), quoted verbatim; and MDN,
> [`Math.trunc()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc).
> The digit-boundary arithmetic (`2147483647 / 10 = 214748364`, last digit `7`) is **arithmetic
> performed in the text**. The overflow mechanism itself is [05c](05c-javas-int-and-the-checked-arithmetic.md)
> and is linked rather than re-derived. **No sandbox run.** Version spine: **JDK 25 · MDN as fetched
> 2026-09-07**.

**The interview question is "reverse the digits of a 32-bit signed integer, returning 0 if the result
does not fit", and the entire content is those last seven words.** Building the reversed number is
[11](11-number-problems-that-recur.md)'s loop with the accumulator `rev = rev * 10 + d`. Detecting
that it will not fit is the part that separates answers, because the obvious check — compute, then
compare against `Integer.MAX_VALUE` — cannot work in Java: `int` arithmetic wraps silently, so by
the time you compare, the evidence is gone. The check has to happen **before** the multiplication,
and deriving its exact form is the exercise.

## The loop, and where it breaks

```java
// ⛔ The check is in the wrong place.
int rev = 0;
while (n != 0) {
    rev = rev * 10 + n % 10;
    if (rev > Integer.MAX_VALUE) return 0;   // can never be true: rev IS an int
    n /= 10;
}
```

`rev` is an `int`, so `rev > Integer.MAX_VALUE` is a comparison that is false by construction — the
compiler will happily accept it and it can never fire. The multiplication has already wrapped, and
[05c](05c-javas-int-and-the-checked-arithmetic.md) is the page on why Java's `+` and `*` wrap
without complaint. Whatever `rev` holds afterwards is a number in the `int` range that bears no
useful relation to the answer.

## The check, derived

We need to know, *before* evaluating `rev * 10 + d`, whether the result will exceed
`Integer.MAX_VALUE`, which the javadoc gives as *"2^31-1"* — the decimal value `2147483647`.

The result exceeds it if either:

- **`rev > 214748364`**, that is `rev > MAX_VALUE / 10`. Then `rev * 10` alone is at least
  `2147483650`, already past the limit regardless of `d`.
- **`rev == 214748364` and `d > 7`.** Then `rev * 10` is exactly `2147483640`, and adding `d`
  exceeds the limit precisely when `d` is 8 or 9 — because the last digit of `MAX_VALUE` is `7`.

Symmetrically for the negative side, with `MIN_VALUE` = *"-2^31"* = `-2147483648`:
`rev < -214748364`, or `rev == -214748364 && d < -8`.

```java
static int reverse(int n) {
    int rev = 0;
    while (n != 0) {
        int d = n % 10;                                    // sign follows n
        if (rev > Integer.MAX_VALUE / 10) return 0;
        if (rev == Integer.MAX_VALUE / 10 && d > 7) return 0;
        if (rev < Integer.MIN_VALUE / 10) return 0;
        if (rev == Integer.MIN_VALUE / 10 && d < -8) return 0;
        rev = rev * 10 + d;
        n /= 10;
    }
    return rev;
}
```

**Note what this version does not do: it never takes an absolute value.** The digit `d` carries `n`'s
sign, so `rev` accumulates negatively for negative input and the two guards handle each side. That
is what makes `Integer.MIN_VALUE` a non-event here rather than the special case it becomes in any
version that starts with `Math.abs(n)` — whose result for that input is documented to be
*"that same value, which is negative"*, and whose loop then produces a wrong answer with no error.
[11](11-number-problems-that-recur.md) has the general form of that idiom.

## The two branches that can never fire, and why saying so scores

For a valid 32-bit `int` input, **the `d > 7` and `d < -8` branches are unreachable**, and the
argument is worth having ready.

`rev` reaches `214748364` only after nine digits have been consumed, so the input has at least ten
digits. An `int` has at most ten digits, and any ten-digit `int` is at most `2147483647`, so its
**leading** digit is `1` or `2`. That leading digit is the last one the loop consumes, so it is the
`d` being added at the moment `rev == 214748364` — and `1` and `2` are both well under `7`.

So the two-part check is *defensive rather than necessary* for this signature. Say that out loud,
and then keep the branches, for two reasons: the argument depends on the input being an `int`, so
the moment the signature becomes `long` or the input arrives as a string
([11g](11g-string-to-integer.md)) the branches become live; and a reviewer reading the code cannot
reconstruct your argument, so removing them makes the code look wrong. **A dead branch that
documents a boundary is cheaper than a comment claiming one.**

## The alternatives, and when each is right

**Accumulate in a `long`.** Because a reversed `int` has at most ten digits, it always fits in a
`long`, so you can compute first and range-check afterwards:

```java
static int reverseViaLong(int n) {
    long rev = 0;
    while (n != 0) { rev = rev * 10 + n % 10; n /= 10; }
    return (rev < Integer.MIN_VALUE || rev > Integer.MAX_VALUE) ? 0 : (int) rev;
}
```

Simpler and correct — **for this signature only**. It works because a wider type exists; the same
trick applied to reversing a `long` has nowhere to go, and that is exactly the follow-up question.
`Math.toIntExact` is the idiomatic finish if you would rather throw than return 0: *"Returns the
value of the `long` argument, throwing an exception if the value overflows an `int`."*

**Use the checked arithmetic.** `Math.multiplyExact` *"Returns the product of the arguments, throwing
an exception if the result overflows an `int`"*, and `addExact` likewise. Wrapping the accumulation
in a `try` and catching `ArithmeticException` is correct, is self-documenting, and moves the
boundary reasoning into the platform:

```java
try {
    rev = Math.addExact(Math.multiplyExact(rev, 10), d);
} catch (ArithmeticException e) {
    return 0;
}
```

The objection is that exceptions for expected control flow read badly, and it is a fair one. The
manual check is what an interviewer usually wants because it demonstrates the boundary arithmetic;
the `Exact` version is what production code should generally contain.

## TypeScript, where the failure is different

```ts
function reverse(n: number): number {
  let rev = 0;
  while (n !== 0) {
    rev = rev * 10 + (n % 10);
    n = Math.trunc(n / 10);
  }
  const INT32_MAX = 2 ** 31 - 1, INT32_MIN = -(2 ** 31);
  return rev < INT32_MIN || rev > INT32_MAX ? 0 : rev;
}
```

Two differences from Java, and both matter.

**The arithmetic does not wrap**, so checking afterwards is genuinely sound here — a double holds
every ten-digit value exactly, far below `Number.MAX_SAFE_INTEGER`
([05](05-integer-limits-and-overflow.md)). The pre-check is not *needed*; it is still the better
habit, because the same code shape applied to a longer input silently loses precision instead of
wrapping, and precision loss has no comparison that detects it.

**The 32-bit range must be imposed by hand**, since JavaScript has no `int`. And the tempting
shortcut for that — `rev | 0` or `rev >>> 0` — is worse than useless: bitwise operators
*"convert both operands to 32-bit integers"* and MDN notes that *"Numbers with more than 32 bits get
their most significant bits discarded"*, so `| 0` performs exactly the silent wrap you were trying to
detect. [04g](04g-the-32-bit-ceiling-and-what-to-use-instead.md) is that trap in full.

## Trailing zeros are information you cannot get back

`reverse(1200)` is `21`, not `0021`, and `reverse(reverse(1200))` is `12`. That is correct
behaviour — a number has no leading zeros — but it means reversal is **not** an involution, and any
problem phrased as "reverse it twice and compare" is wrong for inputs ending in zero. The
palindrome check in [11c](11c-palindromic-numbers.md) has to handle this and does so with an
explicit trailing-zero test, which is the cleanest illustration that these two problems are not the
same problem with a different comparison.

## Gotchas

**★ Symptom: the overflow check never triggers and the function returns a wrapped value.** Cause:
the comparison placed after the multiplication, where in Java the wrap has already happened and
`rev > Integer.MAX_VALUE` is unsatisfiable for an `int`. Fix: check before, against
`MAX_VALUE / 10`, plus the last-digit case.

**★ Symptom: a solution that begins `n = Math.abs(n)` fails on `-2147483648`.** Cause: the
documented behaviour of `Math.abs(int)` at `MIN_VALUE` — the result *"is that same value, which is
negative"*. Fix: do not take an absolute value at all; let `n % 10` carry the sign and guard both
ends of the range.

**★ Symptom: `Integer.MIN_VALUE / 10` used as the negative bound and the last-digit test written as
`d < -7`.** Cause: symmetry assumed where none exists. Fix: `MIN_VALUE` is `-2147483648`, whose last
digit is `8`, so the test is `d < -8`. The asymmetry of the two's-complement range shows up in every
one of these problems and always at the last digit.

**★ Symptom: the JavaScript version returns a large wrong number instead of 0.** Cause: the 32-bit
range never imposed, because JavaScript has no `int` to overflow. Fix: compare explicitly against
`2 ** 31 - 1` and `-(2 ** 31)`. The problem statement's "32-bit" is a *specification*, not a
property of the language you are writing in.

**★ Symptom: `rev | 0` used to "make it a 32-bit int".** Cause: reaching for a bitwise operator as a
cast. Fix: `| 0` truncates to 32 bits, discarding the high bits — MDN: *"Numbers with more than 32
bits get their most significant bits discarded"* — which produces the wrap you were detecting. Use
a comparison.

**★ Symptom: reversing works but the result of reversing twice differs from the input.** Cause:
trailing zeros, which vanish. Fix: nothing to fix — it is correct. Fix the *test* that assumed
reversal was its own inverse.

**★ Symptom: a `long`-accumulator solution ported to reverse a `long` and it stops working.** Cause:
the trick relied on a wider type existing. Fix: for a `long` input, the pre-check against
`Long.MAX_VALUE / 10` is the only option, which is why the manual check is the version worth
learning. This is the standard follow-up question and it is designed to catch exactly this.

**★ Symptom: `Math.multiplyExact` used and the exception escapes to the caller.** Cause: the
`try`/`catch` placed around the loop rather than around the accumulation, or omitted. Fix: catch
where you can return the sentinel. And decide deliberately between throwing and returning 0 — a
library should usually throw and let the caller choose; an interview problem that specifies "return
0" wants 0.

## Interview questions

**★ Reverse a 32-bit integer, returning 0 on overflow. Where does the check go?**
Before the multiply. In Java, `rev * 10 + d` wraps silently, so any comparison performed afterwards
is inspecting a value that has already lost the information. The pre-check is `rev > MAX_VALUE / 10`
— since `MAX_VALUE / 10` is `214748364`, anything larger multiplied by ten is already past the
limit — plus the boundary case `rev == 214748364 && d > 7`, because the last digit of `2147483647`
is `7`. The negative side mirrors it with `-214748364` and `d < -8`, the asymmetry coming from
`MIN_VALUE` being `-2^31` while `MAX_VALUE` is `2^31 − 1`.

**★ Can the last-digit branch actually fire?**
Not for an `int` input. `rev` only reaches `214748364` after nine digits, so the input has ten,
and a ten-digit `int` is at most `2147483647`, so its leading digit is 1 or 2 — and that leading
digit is exactly the `d` being added at that moment. Keep the branch anyway: the argument is
specific to the `int` signature, and it becomes live for a `long`, or for a string input where the
digit count is unbounded. Volunteering the argument and *then* keeping the code is a better answer
than either removing it or not noticing.

**★ Why not just accumulate in a `long` and range-check at the end?**
For an `int` input that is correct and simpler, because a reversed `int` always fits in a `long`.
It is worth saying so. But it is a solution that depends on a wider type being available, so it does
not generalise: asked to reverse a `long`, you are back to the pre-check against
`Long.MAX_VALUE / 10`. Give the `long` version as the pragmatic answer and the pre-check as the one
that scales — that ordering shows you know why each exists.

**★ How does the JavaScript version differ?**
The arithmetic does not wrap, so a post-hoc range check is sound; a reversed ten-digit value is far
inside `Number.MAX_SAFE_INTEGER`. But the 32-bit range is not a language feature and must be
imposed by explicit comparison against `2 ** 31 - 1` and `-(2 ** 31)`, and the tempting shortcuts
`| 0` and `>>> 0` are precisely wrong — they truncate to 32 bits, which is the silent wrap you were
detecting. `Math.trunc` is also mandatory on the division. Different language, same number of
boundaries, in different places.

**★ Does reversing twice give you back the input?**
No, whenever the input has trailing zeros: `1200` reverses to `21` and back to `12`. Numbers have no
leading zeros, so the information is genuinely gone. It also fails whenever the first reversal
overflowed and returned the sentinel. This matters because "reverse and compare" is the naive
palindrome test, and it inherits both problems —
[11c](11c-palindromic-numbers.md) is why the half-reversal is the better construction.

---

← Prev: [11 · Number problems that recur](11-number-problems-that-recur.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [11c · Palindromic numbers](11c-palindromic-numbers.md)
