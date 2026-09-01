---
title: "Nobody writes -0.0 on purpose; it arrives from negation of a computed zero, from an odd number of negative factors, from silent underflow, and above all from round(x, ndigits) in reporting code"
sidebar_label: "6d · Where negative zero comes from"
sidebar_position: 63
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14
> [Built-in Functions](https://docs.python.org/3.14/library/functions.html)
> reference (`round`, `int`, `float`),
> [`math`](https://docs.python.org/3.14/library/math.html) (`copysign`, `floor`,
> `ceil`, `trunc`, and the CPython implementation-detail note),
> the [Numeric Types](https://docs.python.org/3.14/library/stdtypes.html#numeric-types-int-float-complex)
> note on the result type of `//`,
> [`decimal`](https://docs.python.org/3.14/library/decimal.html) on the
> constructor's lossless float conversion, and
> [PEP 682 — Format Specifier for Signed Zero](https://peps.python.org/pep-0682/).
> Version spine: **Python 3.14.7**.

**A negative zero almost never comes from a literal. It comes from a unary minus
applied to a delta that happened to be zero, from a multiplication whose sign
bits XOR to negative, from a negative value underflowing with no warning at all,
and — by a wide margin the most common route in production — from
`round(x, ndigits)` on a small negative, which is exactly what a report
generator does immediately before printing. PEP 682 exists because of that last
one. This chunk is the production sites; the destruction sites, which are just
as surprising, are [06e](06e-what-erases-the-sign.md).**

## 1 · A unary minus applied to a zero

The "literal" `-0.0` is not a literal: it is the unary minus operator applied to
the float literal `0.0`, and negation flips the sign bit, so the result is a
negative zero. So is `-x` where `x` merely *happens* to be `0.0` at runtime —
which is where it usually comes from in real code, because `x` was a computed
delta.

```python
delta = balance_after - balance_before   # exactly 0.0
adjustment = -delta                      # -0.0, and nobody noticed
```

Nothing about the source line looks numeric-adjacent, which is why this route
survives code review. The negation is there to flip a sign convention, and it
works correctly for every value except the one where the sign has no meaning.

## 2 · Multiplication or division with a negative factor

`-1 * 0.0`, `0.0 * -1`, `0.0 / -3.0`, `-0.5 * 0.0`. The sign of a product or
quotient is the XOR of the operand sign bits regardless of magnitude, so any
zero result reached through an odd number of negative factors is a negative
zero.

```python
quantity = 0.0
signed = quantity * direction            # direction == -1 -> -0.0
```

The same applies to `x / math.inf` for negative finite `x`, and to `x * 0.0` for
any negative finite `x`. Division is only a source when the *divisor* is
non-zero: `0.0 / -0.0` raises `ZeroDivisionError` rather than producing a NaN
the way IEEE 754 would — see [06](06-nan-inf-and-signed-zero.md) for that
deliberate departure.

## 3 · Underflow of a negative value

A negative number too small to represent even as a subnormal rounds to `-0.0`,
not to `0.0`. This is the silent one: Python's float arithmetic does not trap
underflow, so there is no exception, no warning, and — unlike `decimal` — no
sticky flag you can inspect afterwards to learn that it happened.

```python
tiny = -1e-320          # a negative subnormal
tiny * 1e-10            # underflows to -0.0
```

A long product of small negative factors — a likelihood in a naive Bayesian
classifier, a survival curve, a compounding discount — walks down to a subnormal
and then off the end of the number line, and what comes out the far side is a
`-0.0` that is indistinguishable from a genuine zero everywhere except
`math.copysign`. See [05c](05c-the-float-number-line.md) for where the subnormal
range actually ends.

## 4 · `round()` with an explicit `ndigits`

This is worth stating precisely, because it is easy to get backwards. The docs
say:

> *"The return value is an integer if `ndigits` is omitted or `None`. Otherwise,
> the return value has the same type as `number`."*

So `round(-0.4)` returns the **int** `0` — an `int` has no sign bit, and there
is no such thing as a negative integer zero. But `round(-0.4, 0)` returns a
**float**, and that float is `-0.0`. Likewise `round(-0.004, 2)` and every
rounding of a small negative toward zero at an explicit precision.

```python
round(-0.4)        # int 0        - no signed zero possible
round(-0.4, 0)     # float -0.0   - signed zero, silently
round(-0.004, 2)   # float -0.0
```

This is the single largest production source, because it is exactly what
reporting code does: take a float, round it to two places for display, and find
`-0.00` in the output. PEP 682 opens on this case — its motivation shows
`f'{x: .1f}'` over `(.002, -.001, .060)` producing a `-0.0` row, and observes
that

> *"programmers are often looking for a way to suppress negative zero, and
> landing on a variety of workarounds (pre-round, post-regex, etc.)."*

The supported fix is a format option, not a change to the value —
[06f](06f-printing-negative-zero.md).

## 5 · `math.copysign` itself

`math.copysign(0.0, -1)` is `-0.0` by definition, and it is the clearest way to
construct one deliberately when writing a test. Writing `-0.0` in a test file
works too, but `copysign` states the intent and cannot be "tidied up" by a
formatter or a reviewer who thinks the minus is a typo.

## 6 · `Decimal` conversions, in both directions

`decimal.Decimal` has a signed zero of its own — `Decimal('-0')` is a legal
decimal with the sign field set — and `float(Decimal('-0'))` is `-0.0`. Going
the other way, `Decimal(-0.0)` is `Decimal('-0')`, because the constructor is
documented to convert the binary floating-point value losslessly to its exact
decimal equivalent, and the sign is part of that value. So a "clean up the
number by moving to `Decimal`" refactor carries the negative zero straight
through — and makes it *more* visible, because `Decimal` renders its sign field
in `str()` where a float's format spec might have suppressed it.

## 7 · Another runtime

NumPy, a C extension, a database driver, a GPU kernel or a JavaScript client all
follow IEEE 754 without Python's exception-raising divisions, so `-1.0 / inf`
there is `-0.0`, and it arrives in your process as an ordinary float with no
marker on it. [06g](06g-negative-zero-across-a-boundary.md) is that story in
full.

## What does *not* produce one, contrary to expectation

`math.floor(-0.5)`, `math.ceil(-0.5)` and `math.trunc(-0.5)` all return integral
values rather than floats — `math.ceil(-0.5)` and `math.trunc(-0.5)` land on the
**int** `0`, which has no sign — and `int(-0.5)` does the same. Any path that
goes through `int` has already discarded the sign. See
[14](14-math-vs-the-operators.md) for the full catalogue of where `math` and the
operators part company.

By contrast `-0.5 // 1.0` is a **float**, because the documented rule for floor
division is *"For operands of type `float`, the result has type `float`"* — so
`-0.0 // 1.0` is a float zero that keeps its sign while `math.floor(-0.0)` is an
int that does not. Two code paths that "do the same thing" therefore disagree on
both the type and the sign of exactly the zero rows.

## Gotchas

**★ `round(x, 2)` is the production source of `-0.0`, and `round(x)` is not.**
The one-argument form returns an `int` and can never produce a negative zero;
the two-argument form returns a float of the same type as the input and produces
one for every small negative. Any code that rounds for display is generating
negative zeros right now, silently, in production. The fix is the `'z'` format
option — [06f](06f-printing-negative-zero.md) — or `+ 0.0` applied after
rounding, and neither is the default.

**★ Underflow to `-0.0` is completely silent and unobservable after the fact.**
No exception, no warning, no inspectable flag. If underflow matters — long
products of small factors are the classic case — restructure into log space so
underflow becomes a large negative finite number, or move the computation into
`decimal` with the `Underflow` signal trapped, where the condition becomes a
real, catchable event:

```python
from decimal import Decimal, localcontext, Underflow

with localcontext() as ctx:
    ctx.traps[Underflow] = True
    total = Decimal(1)
    for factor in factors:
        total *= Decimal(factor)     # raises instead of quietly reaching -0
```

**★ `-delta` is a negative-zero factory and reads as harmless.** A sign-flip on
a computed difference is the most common route into this, and the source line
gives no hint. If a downstream consumer is sign-sensitive — a formatter, a JSON
payload, a golden-file test — normalise at the point of negation
(`-delta + 0.0`) rather than chasing the value across three modules later.

**★ A negative zero surviving into a `Decimal` becomes *more* visible, not
less.** `Decimal` keeps a sign field and renders it, so a `Decimal` column in a
report prints `-0.00` where the float version might have printed `0.00`
depending on the format spec used. Converting to `Decimal` to "clean the number
up" surfaces the problem rather than fixing it. Normalise before you convert,
not after.

**★ `math.ceil(-0.5)` gives the `int` `0`, while `-0.0 // 1.0` gives the float
`-0.0`.** In a mixed pipeline where one branch uses a `math` function and
another uses the operator, one branch destroys the sign and the other preserves
it — and the branches will disagree on precisely the rows where the value is
zero, which is exactly the set of rows nobody wrote a test for.

**★ Do not assert the sign of a zero coming out of a `math` function unless the
docs specify that case.** The math docs say the module consists *"mostly of thin
wrappers around the platform C math library functions"* and that behaviour in
exceptional cases follows *"Annex F of the C99 standard where appropriate"* —
"where appropriate" is doing real work in that sentence. Assert the magnitude;
assert the sign only for `copysign`, where it is documented.

**★ `-0.0` from another runtime carries no marker.** A NumPy array, a JSON
payload, a driver's `REAL` column — all deliver an ordinary Python float. There
is no dtype, no wrapper and no flag saying "this zero has a sign". If a boundary
is sign-sensitive, normalise on ingest, at the one place where you know a
boundary was crossed.

## Interview questions

**★ Where does `-0.0` come from in a program that never writes `-0.0`?**
Five common routes. Unary negation of a computed zero (`-delta` where `delta`
came out `0.0`). Multiplication or division where the sign bits XOR to negative
and the magnitude is zero (`0.0 * -1`, `x / math.inf` for negative `x`).
Underflow of a negative value, which rounds to `-0.0` with no warning. `round(x,
n)` with an explicit `ndigits` on a small negative — the biggest source by
volume, because reporting code rounds for display. And arrival from another
runtime that follows IEEE 754 without Python's exception-raising divisions.

**★ Does `round(-0.4)` give you a negative zero?**
No — it gives the `int` `0`. The one-argument form of `round` is documented to
return an integer, and `int` has no sign bit. `round(-0.4, 0)` gives the float
`-0.0`, because with an explicit `ndigits` *"the return value has the same type
as `number`"*. The distinction catches people out because both calls read as
"round to zero decimal places", and only one of them can produce the value that
breaks the report.

**★ Is there any way to observe underflow to `-0.0` after the fact?**
Not with floats. Python does not expose the IEEE inexact and underflow status
flags, there is no warning, and the resulting `-0.0` is indistinguishable from a
genuine zero except by `math.copysign` — which tells you the sign but not how it
got there. The two real options are log space, where underflow becomes a large
negative finite number you can see, or `decimal` with the `Underflow` signal
trapped, where it becomes an exception.

**★ `math.floor(-0.4)` and `-0.4 // 1.0`. Same answer?**
No, and in two ways. `math.floor(-0.4)` returns the `int` `-1`; `-0.4 // 1.0`
returns the `float` `-1.0`, because floor division on floats is documented to
return a float. For a value that reaches zero the difference gets worse:
`math.floor(-0.0)` is the `int` `0` with no sign, while `-0.0 // 1.0` is the
`float` `-0.0` with its sign intact. Two code paths that "do the same thing"
disagree on both type and sign for the zero rows.

**★ Why does PEP 682 exist at all — why not just fix `round`?**
Because `round` is not wrong. `round(-0.004, 2)` returning `-0.0` is the
correct, IEEE-consistent answer: the exact result is a small negative quantity,
and the nearest representable value at that precision is the negative zero.
Changing `round` would make the arithmetic lie in order to make the display
pretty. PEP 682 puts the fix where the problem actually is — in the formatting
step — with the `'z'` option, and it deliberately does not extend
`%`-formatting, consistent with the precedent of not adding new options there.

**★ A `Decimal` refactor is proposed to "get rid of the float weirdness" in a
financial report. Does it get rid of negative zero?**
No. `Decimal` has a signed zero of its own; `Decimal(-0.0)` is `Decimal('-0')`
because the float constructor is a documented lossless conversion, and
`Decimal` renders its sign field in `str()`. The refactor makes negative zero
*more* visible, not less, and it does nothing about the underlying question of
whether a signed zero means anything in that domain. Normalise the value at
ingest — `x + 0.0` — and then convert.

---

← Prev: [Signed zero: detecting it](06c-signed-zero-and-serialisation.md) · Index: [Numbers](README.md) · Next → [What erases the sign](06e-what-erases-the-sign.md)

{/* FOOTER */}
