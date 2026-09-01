---
title: "Fraction is exact where Decimal is only exact about decimals — it holds 1/3, it normalises to lowest terms on construction, and Fraction(1.1) is not Fraction(11, 10)"
sidebar_label: "11 · Fraction"
sidebar_position: 110
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`fractions`](https://docs.python.org/3.14/library/fractions.html),
> [`numbers`](https://docs.python.org/3.14/library/numbers.html),
> [`decimal`](https://docs.python.org/3.14/library/decimal.html) and
> [`statistics`](https://docs.python.org/3.14/library/statistics.html),
> plus [PEP 3141](https://peps.python.org/pep-3141/) and
> [PEP 515](https://peps.python.org/pep-0515/).
> Version spine: **Python 3.14.7**; `Fraction.from_number` and the
> `as_integer_ratio()` constructor new in **3.14**.

**`Decimal` is exact about decimal fractions and `Fraction` is exact about rational
ones, and the difference is the whole reason both exist: `Decimal` cannot hold `1/3`
any more than `float` can hold `1/10`, while `Fraction(1, 3)` is that number, not an
approximation of it. A `Fraction` is a pair of arbitrary-precision integers
normalised to lowest terms at construction, so it never rounds, never accumulates
error and never needs a tolerance — and it pays for that with denominators that grow
without bound and a `gcd` on every single operation. The trap sitting in front of all
of it is that `Fraction(1.1)` is `Fraction(2476979795053773, 2251799813685248)`,
because the constructor is exactly faithful to a float that was never `1.1`.**

## The three constructors

The class has three documented signatures — `Fraction(numerator=0, denominator=1)`,
`Fraction(number)` and `Fraction(string)`:

```python
from fractions import Fraction

Fraction(16, -10)        # Fraction(-8, 5)   — normalised, sign moved to the numerator
Fraction(123)            # Fraction(123, 1)
Fraction()               # Fraction(0, 1)
Fraction('3/7')          # Fraction(3, 7)
Fraction(' -3/7 ')       # Fraction(-3, 7)   — whitespace is stripped
Fraction('1.414213')     # Fraction(1414213, 1000000)
Fraction('-.125')        # Fraction(-1, 8)
Fraction('7e-6')         # Fraction(7, 1000000)
Fraction(2.25)           # Fraction(9, 4)    — 2.25 is dyadic, so this is exact
```

The string form is *"`[sign] numerator ['/' denominator]`"*, and it also accepts
*"any string representing a finite value accepted by the `float` constructor"* — which
is why `'7e-6'` and `'-.125'` work. `Fraction(x, 0)` raises `ZeroDivisionError`.

The single-number form accepts *"instances of `numbers.Rational`, `float`,
`decimal.Decimal`, or objects with the `as_integer_ratio()` method"*. That last clause
is **new in 3.14** and it is the one that makes the constructor open: any type that can
state its exact value as a ratio of integers can now become a `Fraction` without a
conversion helper.

## Fraction(1.1) is not Fraction(11, 10)

This is the entry in the docs everyone should read before their first `Fraction`:

```python
Fraction(1.1)                    # Fraction(2476979795053773, 2251799813685248)
Fraction(Decimal('1.1'))         # Fraction(11, 10)
Fraction('1.1')                  # Fraction(11, 10)
```

Nothing has gone wrong. The float literal `1.1` is not the number 1.1 — it is the
nearest binary64 value to it, which is exactly
`2476979795053773 / 2251799813685248`, and `Fraction` reports that value faithfully
because being faithful is its entire job. The `Decimal` and string forms give
`Fraction(11, 10)` because those inputs really do denote 1.1.

So the rule is the same one `Decimal` has: **construct from a string or a `Decimal`,
never from a float literal**, unless the float is genuinely the value you mean. The
denominator is a dead giveaway — a power of two that large means a float got in.

```python
2251799813685248 == 2 ** 51      # True — the tell
```

The exact same distinction is worked through for `Decimal` in **Conversions and
precision loss** *(12-conversions-and-precision-loss.md)*.

## Normalisation is not optional and it happens once

*"`numerator`: Numerator of the Fraction in lowest terms."* / *"`denominator`:
Denominator of the Fraction in lowest terms. Guaranteed to be positive."*

Reduction to lowest terms happens in the constructor and in the result of every
operation, so there is no such thing as an unreduced `Fraction`:

```python
f = Fraction(6, 8)
f.numerator, f.denominator       # (3, 4)
Fraction(16, -10)                # Fraction(-8, 5) — the sign lives in the numerator
```

Two consequences. First, you cannot use a `Fraction` to carry "3 parts out of 4 of a
whole originally divided into 8" — the denominator is a *value*, not a unit, and it is
gone. If the original denominator matters, keep it separately. Second, since 3.9
normalisation goes through `math.gcd()` and *"always returns `int`"*, so the
components of a `Fraction` are plain `int` even when you constructed it from
`bool`s or a subclass.

## Arithmetic is exact, and that is the point

Every operation on two `Fraction`s produces the mathematically correct rational and
reduces it. Nothing rounds, so nothing accumulates:

```python
third = Fraction(1, 3)
third + third + third == 1                       # True
sum([Fraction(1, 3)] * 3) == Fraction(1)         # True
```

Compare that with the same computation in the other exact type — `Decimal` has to
round `1/3` to its context precision, so the sum comes back short of one. `Fraction`
is the answer whenever the exactness you need is *rational* rather than *decimal*:
repeated division by three, unit conversions with awkward ratios, tax or dividend
splits that must sum back to the original, probability arithmetic, and anything
involving a ratio of counts.

Mixing types follows the numeric tower described in
[The numeric tower](13c-the-numeric-tower.md):

```python
Fraction(1, 2) + 1                # Fraction(3, 2)  — int widens, stays exact
Fraction(1, 2) + 0.5              # 1.0             — float wins, result is a float
Fraction(1, 2) + Decimal('0.5')   # TypeError
```

The middle line is the one that quietly ends your exactness: a single float anywhere
in an expression converts the `Fraction` and hands back a float. The `Decimal` line
raises instead, because PEP 3141 deliberately left `Decimal` out of the tower —
*"After consultation with its authors it has been decided that the `Decimal` type
should not at this time be made part of the numeric tower."* Convert explicitly at
the boundary if you must cross it.

## Exact division is what `/` already does

`Fraction` is the one numeric type where `/` needs no thought: it is exact, it is
closed, and it never raises except on zero.

```python
Fraction(1, 3) / Fraction(7, 11)      # Fraction(11, 21)
Fraction(1, 3) ** 2                   # Fraction(1, 9)
Fraction(1, 3) ** -1                  # Fraction(3, 1)
Fraction(2) ** 0.5                    # 1.4142135623730951 — a float, necessarily
```

A rational raised to a non-integer power is generally irrational, so the result
leaves the type and comes back as a float. That is not a defect; it is the boundary of
what the type can represent, and it is where a tolerance comparison legitimately
starts.

`//`, `%` and `divmod` work as they do for the other numeric types, floored toward
minus infinity — see
[Floor division and modulo](08-floor-division-and-modulo.md).

## Gotchas

### `Fraction(1.1)` returns an enormous pair of integers
**Symptom.** A `Fraction` built from a literal prints as
`Fraction(2476979795053773, 2251799813685248)` and every downstream denominator is
astronomical.
**Cause.** The float `1.1` is not 1.1, and `Fraction` is exactly faithful to the value
it was given.
**Fix.** Construct from a string or a `Decimal`.
```python
Fraction('1.1')                  # Fraction(11, 10)
Fraction(Decimal('1.1'))         # Fraction(11, 10)
```

### One float in an expression silently ends the exactness
**Symptom.** A pipeline that was exact starts producing values that need a tolerance,
and no line obviously introduced a float.
**Cause.** `Fraction + float` is a `float`; the tower widens toward the less exact
type, and the result type is not annotated anywhere you would notice.
**Fix.** Keep the boundary explicit and convert at it, not through it.
```python
ratio = Fraction(measurement).limit_denominator(10_000)   # in, deliberately
result_as_float = float(total)                            # out, deliberately
```

### Expecting the denominator you constructed with
**Symptom.** `Fraction(6, 8).denominator` is `4`, and code that treated the
denominator as "the number of parts" is wrong.
**Cause.** Normalisation to lowest terms happens in the constructor and after every
operation; it is not optional and it is not reversible.
**Fix.** Store the unit separately from the value.
```python
parts, whole = 6, 8              # keep it if it means something
value = Fraction(parts, whole)   # the value, reduced
```

### `Fraction + Decimal` raises
**Symptom.** `TypeError` at a boundary where both types are "the exact ones".
**Cause.** PEP 3141 deliberately kept `Decimal` out of the numeric tower, so there is
no implicit conversion between them.
**Fix.** Convert explicitly, and pick the direction that does not lose anything —
`Decimal` to `Fraction` is exact, the other way is not in general.
```python
Fraction(Decimal('0.5')) + Fraction(1, 2)     # Fraction(1, 1)
```

### `Fraction ** 0.5` comes back a float
**Symptom.** An exact computation loses its type at a square root.
**Cause.** The root of a rational is generally irrational, and the type cannot hold
it.
**Fix.** Expect it, and treat that point as the exit from exact arithmetic — compare
what follows with `math.isclose`, per
[Comparing floats](07-comparing-floats.md).

## Interview questions

**Why does `Fraction` exist when `Decimal` is already exact?**
They are exact about different things. `Decimal` represents decimal fractions
exactly, so it cannot hold `1/3`; `Fraction` represents any rational exactly, so it
can. Use `Decimal` when the domain is decimal — money, currency, anything specified in
decimal places — and `Fraction` when the exactness you need is rational.

**What is `Fraction(1.1)` and why?**
`Fraction(2476979795053773, 2251799813685248)`. The float literal `1.1` is the nearest
binary64 value to 1.1, not 1.1 itself, and `Fraction` reports that value exactly.
`Fraction('1.1')` and `Fraction(Decimal('1.1'))` both give `Fraction(11, 10)`.

**How would you spot a float that leaked into a `Fraction`?**
The denominator is a large power of two. `2251799813685248` is `2 ** 51`; no decimal
input produces that.

**Are `Fraction`s normalised, and when?**
Always, and at construction as well as after every operation. `numerator` and
`denominator` are documented as being in lowest terms, with the denominator
guaranteed positive — so `Fraction(16, -10)` is `Fraction(-8, 5)`.

**What happens when you add a `Fraction` to a `float`? To a `Decimal`?**
`Fraction + float` widens to `float` and the exactness is gone. `Fraction + Decimal`
raises `TypeError`, because PEP 3141 kept `Decimal` outside the numeric tower.

---

← Prev: [Quantize and fixed-point discipline](10c-quantize-and-fixed-point-discipline.md) · Index: [Numbers](README.md) · Next → [Inspecting and constructing a Fraction](11b-inspecting-and-constructing.md)
