---
title: "Float modulo is documented to return a mathematically impossible answer, and the docs say to use math.fmod instead"
sidebar_label: "8e · Float modulo, fmod, remainder"
sidebar_position: 84
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Python 3.14 language reference
> [Binary arithmetic operations](https://docs.python.org/3.14/reference/expressions.html#binary-arithmetic-operations)
> including footnotes 1 and 2, the library reference for
> [`math.fmod` and `math.remainder`](https://docs.python.org/3.14/library/math.html),
> [`divmod()`](https://docs.python.org/3.14/library/functions.html#divmod) and
> [`datetime.timedelta`](https://docs.python.org/3.14/library/datetime.html#timedelta-objects).
> Version spine: **Python 3.14.7**.

**The language reference promises that `abs(x % y) < abs(y)`, and then a
footnote on the same page admits that for floats it is not true — because when
the sign rule and the magnitude rule conflict, Python keeps the sign rule and
lets the magnitude rule break. A second footnote admits that `x // y` on floats
may be one less than `math.floor(x / y)`. The `math` documentation then states,
in one sentence that most Python developers have never read, that
`math.fmod()` *"is generally preferred when working with floats, while Python's
`x % y` is preferred when working with integers."* Python ships three remainder
conventions for floats, and `%` is the wrong one.**

## The remainder that mathematics forbids

The promise, from the language reference:

> *"The modulo operator always yields a result with the same sign as its second
> operand (or zero); the absolute value of the result is strictly smaller than
> the absolute value of the second operand."*

The retraction, footnote 1 on the same page:

> *"While `abs(x%y) < abs(y)` is true mathematically, for floats it may not be
> true numerically due to roundoff. For example, and assuming a platform on
> which a Python float is an IEEE 754 double-precision number, in order that
> `-1e-100 % 1e100` have the same sign as `1e100`, the computed result is
> `-1e-100 + 1e100`, which is numerically exactly equal to `1e100`. The
> function `math.fmod()` returns a result whose sign matches the sign of the
> first argument instead, and so returns `-1e-100` in this case. Which approach
> is more appropriate depends on the application."*

Read that carefully. The mathematically correct remainder is
`-1e-100 + 1e100` — a number a hair below `1e100`. A `double` has 53 bits of
significand; the difference between those two magnitudes is 200 orders of
magnitude, so the sum rounds to `1e100` exactly. Python returns it. The result
is equal to the divisor, which the stated rule says is impossible.

Python chose the sign rule because that is what makes integer modulo useful
(`hash(k) % n` landing in `[0, n)` regardless of sign). On floats, that choice
costs the magnitude guarantee.

## And the quotient side, footnote 2

> *"If `x` is very close to an exact integer multiple of `y`, it's possible for
> `x//y` to be one larger than `(x-x%y)//y` due to rounding. In such cases,
> Python returns the latter result, in order to preserve that
> `divmod(x,y)[0] * y + x % y` be very close to `x`."*

So `x // y == math.floor(x / y)` is **not** an identity for floats. Python
prefers keeping the reconstruction close to `x`.

`divmod()`'s own documentation states the weakened guarantee plainly:

> *"For floating-point numbers the result is `(q, a % b)`, where q is usually
> `math.floor(a / b)` but may be 1 less than that. In any case
> `q * b + a % b` is very close to a, if `a % b` is non-zero it has the same
> sign as b, and `0 <= abs(a % b) < abs(b)`."*

"Usually", "may be 1 less", "very close to". **The exact invariant of
[08](08-floor-division-and-modulo.md) is an integer-domain guarantee.** In the
float domain it is an approximation with two documented ways of being wrong.

## The three conventions

`math.fmod` — the C convention, sign of the **dividend**:

> *"Return the floating-point remainder of `x / y`, as defined by the platform
> C library function `fmod(x, y)`. Note that the Python expression `x % y` may
> not return the same result. The intent of the C standard is that
> `fmod(x, y)` be exactly (mathematically; to infinite precision) equal to
> `x - n*y` for some integer n such that the result has the same sign as x and
> magnitude less than `abs(y)`. Python's `x % y` returns a result with the sign
> of y instead, and may not be exactly computable for float arguments. For
> example, `fmod(-1e-100, 1e100)` is `-1e-100`, but the result of Python's
> `-1e-100 % 1e100` is `1e100-1e-100`, which cannot be represented exactly as
> a float, and rounds to the surprising `1e100`. For this reason, function
> `fmod()` is generally preferred when working with floats, while Python's
> `x % y` is preferred when working with integers."*

`math.remainder` — the IEEE-754 convention, nearest multiple:

> *"Return the IEEE 754-style remainder of x with respect to y. For finite x
> and finite nonzero y, this is the difference `x - n*y`, where n is the
> closest integer to the exact value of the quotient `x / y`. If `x / y` is
> exactly halfway between two consecutive integers, the nearest even integer is
> used for n. The remainder `r = remainder(x, y)` thus always satisfies
> `abs(r) <= 0.5 * abs(y)`."*

and, the sentence that decides the matter for numerical work:

> *"On platforms using IEEE 754 binary floating point, the result of this
> operation is always exactly representable: no rounding error is introduced."*

| Operation | Sign of result | Range | Exactness |
|---|---|---|---|
| `x % y` | sign of `y` | `[0, y)` in principle | can round to `y` itself (footnote 1) |
| `math.fmod(x, y)` | sign of `x` | magnitude `< abs(y)` | exact, per the C standard's intent |
| `math.remainder(x, y)` | either | `abs(r) <= 0.5 * abs(y)` | exact on IEEE-754 platforms |

`math.remainder` also has different edge behaviour: *"Special cases follow IEEE
754: in particular, `remainder(x, math.inf)` is x for any finite x, and
`remainder(x, 0)` and `remainder(math.inf, x)` raise `ValueError` for any
non-NaN x. If the result of the remainder operation is zero, that zero will
have the same sign as x."*

### Which to reach for

```python
import math

# Angle / phase reduction to (-pi, pi]. Exact, centred on zero.
theta = math.remainder(raw_angle, 2 * math.pi)

# Split a float measurement into whole units and a leftover, C semantics.
leftover = math.fmod(elapsed, interval)

# Integer wrap-around. This is what % is for.
slot = counter % len(buckets)
```

`theta % (2 * math.pi)` looks equivalent to the first line and is not: it
introduces the rounding of the subtraction *and* returns a value in
`[0, 2π)` rather than centred on zero, so for angles near a full turn the
answer is a large positive number where you wanted a small negative one.

## `timedelta`: floored, and the constructor floors too

`timedelta` follows the integer convention and states it:

> *"`t1 = t2 // i` or `t1 = t2 // t3` — The floor is computed and the remainder
> (if any) is thrown away. In the second case, an integer is returned."*
> … *"`q, r = divmod(t1, t2)` — Computes the quotient and the remainder:
> `q = t1 // t2` and `r = t1 % t2`. q is an integer and r is a `timedelta`
> object."*

The normalisation of the object itself is floored as well, which is where the
confusion usually starts:

> *"Note that normalization of negative values may be surprising at first. For
> example: `d = dt.timedelta(microseconds=-1)` … `(d.days, d.seconds,
> d.microseconds)` is `(-1, 86399, 999999)`."*

A one-microsecond-negative duration is stored as minus one day plus almost a
whole day, because `seconds` and `microseconds` are constrained to be
non-negative — the same floored decomposition as `divmod` on integers. The docs
flag the resulting attribute trap directly:

> *"It is a somewhat common bug for code to unintentionally use this attribute
> when it is actually intended to get a `total_seconds()` value instead."*

The other floated corner: `timedelta` arithmetic that involves a `float`
rounds, and rounds half to even. *"`t1 = t2 * f` or `t1 = f * t2` — Delta
multiplied by a float. The result is rounded to the nearest multiple of
`timedelta.resolution` using round-half-to-even."* — and the constructor does
the same: *"If any argument is a float and there are fractional microseconds,
the fractional microseconds left over from all arguments are combined and their
sum is rounded to the nearest microsecond using round-half-to-even
tiebreaker."*

## Gotchas

**★ `abs(x % y) < abs(y)` is documented as *not* always true for floats.**
Footnote 1 gives the exact counterexample. If a validation check relies on the
remainder being strictly smaller than the divisor, it can fail on legitimate
input. Use `math.fmod`, which the docs say *"is generally preferred when
working with floats"*.

**★ `x // y` on floats can be one less than `math.floor(x / y)`.** Footnote 2
says Python deliberately returns the smaller value to keep
`divmod(x,y)[0] * y + x % y` close to `x`. A test asserting
`x // y == math.floor(x / y)` will eventually fail on a value very near an
exact multiple, and the failure will look like a platform bug.

**★ Angle reduction with `%` accumulates error; `math.remainder` does not.**
`theta % (2 * math.pi)` involves an inexact `2 * math.pi`, an inexact
multiplication and an inexact subtraction. `math.remainder(theta, 2 * math.pi)`
is *"always exactly representable: no rounding error is introduced"* on
IEEE-754 platforms, and centres the result on zero, which is what trigonometric
identities and phase-unwrapping want.

**★ `math.remainder(x, 0)` raises `ValueError`, but `x % 0.0` raises
`ZeroDivisionError`.** Two different exception types for the same mistake, from
two functions that look interchangeable. Any `except ZeroDivisionError` you
wrote around `%` stops catching the moment you switch.

**★ `math.remainder(math.inf, x)` raises where `%` would too, but
`math.remainder(x, math.inf)` returns `x`.** The asymmetry is IEEE-754's, not
Python's, and it is easy to get backwards when writing a guard.

**★ `math.fmod` delegates to the platform C library.** *"as defined by the
platform C library function `fmod(x, y)`"* — so it is the one operation on this
page whose behaviour is defined by reference to something outside Python. In
practice every platform Python supports uses IEEE-754 and agrees; it is still
worth knowing that the guarantee is inherited rather than specified.

**★ `timedelta(microseconds=-1).seconds` is `86399`, not `-1` or `0`.** The
constructor normalises with floored decomposition. Reading `.seconds` (or
`.days`) on a possibly-negative delta and treating it as a magnitude produces a
number wrong by nearly a full day. Use `.total_seconds()`, which the docs
explicitly recommend for this exact bug.

**★ `timedelta` silently rounds float arithmetic to the microsecond, half to
even.** `td * 0.5` and `timedelta(seconds=1.0000005)` both round, and the
tiebreak is banker's rounding. A "half a duration" computation done twice on a
sub-microsecond value does not necessarily reconstruct the original.

**★ `divmod()` on floats returns a `float` quotient.** `divmod(7.5, 2)` gives a
whole-valued `float`, not an `int`, so the quotient cannot be used as an index
or a loop count without conversion — and the conversion is where the float's
imprecision becomes visible.

## Interview questions

**★ Why does `-1e-100 % 1e100` return `1e100` when the docs say the remainder
must be strictly smaller than the divisor?**
Because the sign rule and the magnitude rule conflict at that input, and Python
keeps the sign rule. The mathematically correct answer is `-1e-100 + 1e100`,
which is not representable as a `double` and rounds to `1e100`. The language
reference documents this in footnote 1 and offers `math.fmod` as the
alternative, which keeps the magnitude rule and gives the dividend's sign —
`-1e-100`.

**★ When should you use `math.fmod` instead of `%`?**
Whenever the operands are floats. The `math` documentation says it outright:
*"function `fmod()` is generally preferred when working with floats, while
Python's `x % y` is preferred when working with integers."* `%` was designed
for the integer semantics that make `hash(k) % n` safe; on floats those
semantics cost exactness.

**★ And when `math.remainder`?**
When you want the remainder relative to the *nearest* multiple rather than the
one below, and you need exactness — angle and phase reduction being the classic
case. It satisfies `abs(r) <= 0.5 * abs(y)` and, on IEEE-754 platforms,
*"the result of this operation is always exactly representable: no rounding
error is introduced."* It raises `ValueError` for a zero divisor and for an
infinite dividend, where `%` raises `ZeroDivisionError`.

**★ Give the three remainder conventions and one language or type that uses
each.**
Sign-of-divisor (floored): Python's `%` on `int` and `float`, Ruby, Haskell's
`mod`. Sign-of-dividend (truncated): C, Java, C#, JavaScript, Python's
`math.fmod`, and `decimal.Decimal`. Nearest-multiple (IEEE): `math.remainder`,
C's `remainder()`, and `Decimal.remainder_near`.

**★ Does `x // y == math.floor(x / y)` hold for floats?**
No. Footnote 2: *"If x is very close to an exact integer multiple of y, it's
possible for `x//y` to be one larger than `(x-x%y)//y` due to rounding. In such
cases, Python returns the latter result, in order to preserve that
`divmod(x,y)[0] * y + x % y` be very close to x."* Python prefers keeping the
reconstruction close to `x` over matching `math.floor`.

**★ Why is `timedelta(microseconds=-1).seconds` equal to `86399`?**
Because `timedelta` normalises with a floored decomposition, exactly like
`divmod` on integers: `days` absorbs the negative sign and `seconds` and
`microseconds` are left non-negative. The docs call the effect *"surprising at
first"* and show this precise example. It is why `.total_seconds()` exists and
why reading `.seconds` on a signed delta is, in the docs' own words, *"a
somewhat common bug"*.

**★ What rounding does `timedelta` use when a float is involved?**
Round-half-to-even, to the nearest microsecond. Both the constructor
(*"rounded to the nearest microsecond using round-half-to-even tiebreaker"*)
and multiplication/division by a float (*"rounded to the nearest multiple of
`timedelta.resolution` using round-half-to-even"*) say so. It is the same
tie-breaking rule as `round()`, and it is a genuine reason not to build
durations out of floats.

---

← Prev: [Decimal truncates, int floors](08d-modulo-on-floats-and-decimals.md) · Index: [Numbers](README.md) · Next → [round() and banker's rounding](09-round-and-bankers-rounding.md)

{/* FOOTER */}
