---
title: "limit_denominator is how you get 11/10 back out of a float, and unbounded denominator growth is what Fraction charges for never rounding"
sidebar_label: "11c · Approximation and cost"
sidebar_position: 112
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`fractions`](https://docs.python.org/3.14/library/fractions.html),
> [`round()`](https://docs.python.org/3.14/library/functions.html#round),
> [`math`](https://docs.python.org/3.14/library/math.html) and
> [Format Specification Mini-Language](https://docs.python.org/3.14/library/string.html#format-specification-mini-language).
> Version spine: **Python 3.14.7**; float-style formatting since **3.12**,
> general formatting with fill/align/sign/width/grouping since **3.13**.

**`Fraction` never rounds, and the bill for that arrives as denominator growth: add
two fractions with unlike denominators and the result's denominator is as large as
their product, every operation runs a `gcd` over arbitrary-precision integers, and a
loop that accumulates rationals can end up carrying numbers with thousands of digits
while representing a perfectly ordinary quantity. `limit_denominator` is the release
valve, and it is also the tool that answers the question the type raises on day one:
given a float that was meant to be a simple ratio, what simple ratio was it?**

## limit_denominator

*"Finds and returns the closest `Fraction` to `self` with denominator at most
`max_denominator`. This method is useful for finding rational approximations to a
given floating-point number."* The default `max_denominator` is `1000000`.

```python
from fractions import Fraction

Fraction('3.1415926535897932').limit_denominator(1000)   # Fraction(355, 113)
Fraction(1.1).limit_denominator()                        # Fraction(11, 10)
```

Both documented examples earn their place. The first is the classical rational
approximation to π — `355/113` is correct to six decimal places and is the best
approximation with a denominator under 113. The second is the answer to the
`Fraction(1.1)` problem from [Fraction](11-fraction.md): the float that is nearly 1.1
has an exact value with a denominator of `2 ** 51`, and asking for the closest
fraction with a denominator under a million recovers the `11/10` that was meant.

That recovery idiom is the practical use:

```python
def intended_ratio(x: float, max_denominator: int = 1000) -> Fraction:
    """The simple ratio a float was probably meant to be."""
    return Fraction(x).limit_denominator(max_denominator)

intended_ratio(0.75)          # Fraction(3, 4)
intended_ratio(1.3333333)     # Fraction(4, 3) at max_denominator=1000
```

It is a *guess*, and it should be treated as one. The bound you pass is the whole of
your prior belief about how simple the answer ought to be: too generous and you get
back the float's own exact monstrosity, too tight and you get a plausible ratio that
is not the one anybody meant. Where the true value is available as a string or a
`Decimal`, use it — `limit_denominator` is for when it is not.

Real uses beyond recovery: aspect ratios (`Fraction(1920, 1080)` is `16/9` by
normalisation alone, but `Fraction(1.7777778).limit_denominator(100)` gets there from
a measurement), gear and pulley ratios, musical intervals, and reducing a measured
rate to a reportable one.

## What it costs to never round

Three costs, in rough order of how often they bite.

**Denominators grow.** Adding `a/b + c/d` produces a fraction over `b*d` before
reduction, and reduction only helps when the denominators share factors. A loop over
values with unrelated denominators grows the representation multiplicatively:

```python
total = Fraction(0)
for k in range(1, 200):
    total += Fraction(1, k)      # denominator approaches lcm(1..199)
```

That is a legitimate exact answer, and it is an integer with well over seventy digits.
Nothing is wrong; it is simply what exactness costs.

**Every operation runs a `gcd`.** Since 3.9 normalisation goes through `math.gcd()`,
which is fast but is not free, and its cost scales with the size of the integers it is
reducing — which the previous point has just made large.

**Arbitrary-precision integers are not machine words.** Arithmetic, comparison and
hashing all cost more than the `float` equivalents, and the gap widens as the
denominators grow. A `Fraction` is the slowest of the four numeric types by a wide
margin, and it is the correct choice anyway whenever the alternative is a wrong
answer.

The mitigation is to bound the denominator at points where you know the precision you
need:

```python
total = Fraction(0)
for value in stream:
    total += value
    if total.denominator > 10 ** 12:
        total = total.limit_denominator(10 ** 12)   # a deliberate, visible rounding
```

Note what that does: it converts an exact computation into an approximate one, at a
line you wrote, with a bound you chose. That is the right shape for the trade-off —
far better than switching the whole computation to `float` and rounding invisibly at
every step.

## When not to use Fraction

- **Money.** The domain is decimal and the arithmetic must match an accounting
  system's, which quantises to the minor unit. Use `Decimal` — see **Decimal for
  money** *(10-decimal-for-money.md)*. `Fraction` gives you exact thirds of a cent,
  which is not what a ledger wants.
- **Anything measured.** A sensor reading has error bars far wider than float
  rounding, so exact rational arithmetic on it is precision theatre.
- **Hot loops and large arrays.** The cost is real and compounds; numeric libraries
  work in float for a reason.
- **Interchange.** No JSON, CSV or SQL type is a rational. Every boundary needs an
  explicit encoding decision — a string like `"3/7"`, a pair of integers, or a
  documented conversion to `Decimal` or `float`.

Use it where the answer is a ratio and must stay one: probability arithmetic, exact
unit conversion, splitting a total into shares that must sum back, symbolic-ish
computation, and test oracles that need an exact expected value to compare a float
implementation against.

## Gotchas

### Denominators explode in a loop
**Symptom.** A summation over rationals slows down as it runs and the accumulator's
`repr` grows to hundreds of digits.
**Cause.** Unlike denominators multiply before reduction, so the representation grows
with the number of distinct denominators seen.
**Fix.** Bound it deliberately at a precision you can defend.
```python
total = total.limit_denominator(10 ** 12)
```

### `limit_denominator` treated as exact
**Symptom.** A ratio recovered from a float is confidently wrong — `Fraction(0.1 + 0.2).limit_denominator(10)`
is a clean-looking fraction that is not the sum of the two exact tenths.
**Cause.** It returns the closest fraction under a bound, which is an approximation
whose quality is entirely determined by the bound you chose.
**Fix.** Where the intended value exists as text, construct from the text and skip the
guess.
```python
Fraction('0.1') + Fraction('0.2') == Fraction(3, 10)     # True, no guessing
```

### The default bound is a million
**Symptom.** `limit_denominator()` with no argument returns something almost as ugly
as the input for a value that is genuinely irrational.
**Cause.** The default `max_denominator` is `1000000`, which is generous — for π it
gives a far less recognisable answer than `limit_denominator(1000)`.
**Fix.** Pass a bound that reflects how simple you believe the answer to be.

### Reaching for `Fraction` on measured data
**Symptom.** A pipeline over sensor readings runs orders of magnitude slower with no
change in the answers anyone acts on.
**Cause.** Exact rational arithmetic on values whose measurement error dwarfs float
rounding buys nothing.
**Fix.** Use `float`, and put the effort into the error model instead.

## Interview questions

**What does `limit_denominator` do, and what is its default?**
Returns the closest `Fraction` to the value with a denominator no larger than
`max_denominator`, which defaults to `1000000`. It is the standard way to get a
rational approximation of a float.

**How do you recover `11/10` from the float `1.1`?**
`Fraction(1.1).limit_denominator()`. The exact value of the float has a denominator of
`2 ** 51`; asking for the closest fraction under a million-denominator bound gives
`Fraction(11, 10)`.

**What is `Fraction('3.1415926535897932').limit_denominator(1000)`?**
`Fraction(355, 113)` — the classical rational approximation to π, and a documented
example.

**Is `limit_denominator` exact?**
No. It is an approximation whose quality is set entirely by the bound you pass. If the
intended value is available as a string or a `Decimal`, construct from that instead of
guessing.

**What does `Fraction` cost compared with `float`?**
Denominator growth — unlike denominators multiply before reduction — a `gcd` on every
operation, and arbitrary-precision integer arithmetic instead of machine words. It is
the slowest numeric type, and it is still the right one when the alternative is a
wrong answer.

**How do you keep a long rational accumulation from exploding?**
Call `limit_denominator` at a bound you choose, at a point in the code you wrote. That
turns an exact computation into an approximate one visibly, rather than rounding
invisibly at every step as `float` would.

**When would you *not* use `Fraction`?**
Money (decimal domain — use `Decimal`), measured data (error dwarfs the precision),
hot loops and large arrays (cost), and interchange (no wire format has a rational
type).

---

← Prev: [Inspecting and constructing a Fraction](11b-inspecting-and-constructing.md) · Index: [Numbers](README.md) · Next → [Rounding and formatting](11d-rounding-and-formatting.md)
