---
title: "as_integer_ratio is the protocol every exact numeric type shares, and a normalised Fraction is hashable — so it groups and keys where a float never can"
sidebar_label: "11b · Inspecting and constructing"
sidebar_position: 114
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`fractions`](https://docs.python.org/3.14/library/fractions.html),
> [Hashing of numeric types](https://docs.python.org/3.14/library/stdtypes.html#hashing-of-numeric-types),
> [`statistics`](https://docs.python.org/3.14/library/statistics.html) and
> [`math`](https://docs.python.org/3.14/library/math.html).
> Version spine: **Python 3.14.7**; `as_integer_ratio()` since **3.8**,
> `is_integer()` since **3.12**, `from_number` new in **3.14**.

**Two properties make `Fraction` useful beyond "it does not round". It exposes its
exact value through `as_integer_ratio()`, the protocol `int`, `float` and `Decimal`
all implement and which the 3.14 constructor now accepts from any type at all. And
because every instance is normalised to lowest terms and documented as immutable and
hashable, two `Fraction`s denoting the same number are equal and hash equally no
matter what arithmetic produced them — so a `Fraction` can key a dict and group a
dataset, which is exactly what a float compared with a tolerance can never do.**

## Inspecting a Fraction

```python
Fraction(9, 4).as_integer_ratio()     # (9, 4)   — 3.8, lowest terms, positive denominator
Fraction(4, 2).is_integer()           # True     — 3.12
float(Fraction(1, 3))                 # 0.3333333333333333 — rounds, once, at the exit
int(Fraction(7, 2))                   # 3        — truncates toward zero
```

`as_integer_ratio()` is the protocol that makes the type interoperable: `int`,
`float`, `Decimal` and `Fraction` all implement it, and from 3.14 the `Fraction`
constructor accepts anything that does. `is_integer()` arrived in 3.12 and is the
honest way to ask — `f.denominator == 1` says the same thing and is one abstraction
lower.

## Hashable, immutable, and safe as a dict key

Instances *"are hashable and should be treated as immutable"* and *"can be used as
dictionary keys"*. This is a real advantage over `float` for grouping work: two
`Fraction`s that denote the same number are `==` and hash the same, whatever
arithmetic produced them, because both were reduced to lowest terms.

```python
{Fraction(1, 2): "half"}[Fraction(2, 4)]      # "half"
```

That is the transitivity that a float tolerance test cannot give you — see
[isclose edge cases](07b-isclose-edge-cases.md). Numeric hashing is defined so that
`Fraction(1, 2)`, `Decimal("0.5")`, `0.5` and any other numeric type denoting the same
value all hash equally, which is why they collide as dict keys across types too.

## The alternative constructors

```python
Fraction.from_float(0.3)              # exact expansion of the float 0.3
Fraction.from_decimal(Decimal('0.3')) # Fraction(3, 10)
Fraction.from_number(0.25)            # 3.14 — number-only, rejects strings
```

`from_float` and `from_decimal` are historical: since 3.2 the plain constructor
accepts both, so they exist mainly to be explicit. The docs make the float one's
behaviour unambiguous — `Fraction.from_float(0.3)` is **not** `Fraction(3, 10)`.

`from_number`, new in 3.14, accepts *"`numbers.Integral`, `numbers.Rational`, `float`,
`decimal.Decimal`, and objects with `as_integer_ratio()` method, but not strings"*.
Its point is exactly that refusal: it is the constructor to use when a string must be
rejected rather than parsed, which makes it the right one behind an API boundary
taking untrusted input.

## Where `Fraction` shows up in the standard library

`statistics` supports it directly, and preserves exactness end to end:

```python
from statistics import mean
mean([Fraction(3, 7), Fraction(1, 21), Fraction(5, 3), Fraction(1, 3)])   # Fraction(13, 21)
```

That is a documented example, and it is the practical case for the type: an average
of rationals that stays a rational instead of becoming a float you then have to
compare with a tolerance.

## Gotchas

### `int(Fraction(-7, 2))` is `-3`, not `-4`
**Symptom.** A conversion rounds toward zero where the surrounding code floors.
**Cause.** `int()` truncates; `//` and `math.floor` floor. They differ for every
negative non-integer.
**Fix.** Say which one you mean.
```python
import math
math.floor(Fraction(-7, 2))      # -4
int(Fraction(-7, 2))             # -3
```

### `from_number` used where a string may arrive
**Symptom.** `TypeError` on input that the plain constructor would have parsed.
**Cause.** `from_number` accepts numbers *"but not strings"* — by design.
**Fix.** That refusal is usually the feature. Parse and validate explicitly, then
build; use the plain constructor only where a string input is intended.

## Interview questions

**Can a `Fraction` be a dict key?**
Yes. Instances are hashable and documented as immutable, and because they are
normalised, two `Fraction`s denoting the same value are equal and hash equally
regardless of how they were built. Numeric hashing also makes them hash equal to the
`int`, `float` and `Decimal` denoting the same value.

**What does the 3.14 constructor accept that earlier ones did not?**
Any object with an `as_integer_ratio()` method, plus the new `Fraction.from_number`
classmethod, which takes numbers of every supported kind but explicitly refuses
strings.

**What is the difference between `int(f)` and `math.floor(f)` on a `Fraction`?**
`int()` truncates toward zero, `math.floor()` floors toward minus infinity. They agree
for positive values and differ for every negative non-integer.

**Which standard library modules understand `Fraction`?**
`statistics` computes over it and returns exact rationals; `math.gcd` underpins its
normalisation; `numbers` classifies it as `Rational`. `json` does not — a `Fraction`
needs an explicit encoder.

**What is `as_integer_ratio()` for?**
It is the shared protocol for "state your exact value as a ratio of integers", and
`int`, `float`, `Decimal` and `Fraction` all implement it. From 3.14 the `Fraction`
constructor accepts anything that does, which makes user-defined exact types
first-class inputs.

**Why is `Fraction.from_float` still in the library if the constructor takes floats?**
History — since 3.2 the plain constructor accepts `float` and `Decimal`, so the
classmethods survive for explicitness and for code that predates the change. The docs
still use `from_float` to make the point that `Fraction.from_float(0.3)` is not
`Fraction(3, 10)`.

**What does `float(Fraction(1, 3))` do, and when should you call it?**
It rounds the exact rational to the nearest binary64 value — one rounding, at the
moment you ask for it. Call it at the boundary where the value leaves your exact
arithmetic, not in the middle of it, so the rounding happens once and where you can
see it.

---

← Prev: [Fraction](11-fraction.md) · Index: [Numbers](README.md) · Next → [Approximation and cost](11c-limit-denominator-and-cost.md)
