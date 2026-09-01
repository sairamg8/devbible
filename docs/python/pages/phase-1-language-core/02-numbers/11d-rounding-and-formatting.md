---
title: "Fraction rounds half to even like everything else, and its format spec supports the float presentation types but not zero-fill"
sidebar_label: "11d · Rounding and formatting"
sidebar_position: 116
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`fractions`](https://docs.python.org/3.14/library/fractions.html),
> [`round()`](https://docs.python.org/3.14/library/functions.html#round),
> [`math`](https://docs.python.org/3.14/library/math.html) and the
> [Format Specification Mini-Language](https://docs.python.org/3.14/library/string.html#format-specification-mini-language).
> Version spine: **Python 3.14.7**; float-style formatting since **3.12**,
> general formatting with fill/align/sign/width/grouping since **3.13**.

**Rounding and formatting are where an exact rational meets a world that wants a
decimal, and both are places where the rounding should happen — once, at the boundary,
visibly. `Fraction` implements `__floor__`, `__ceil__` and `__round__`, so the
builtins work on it directly and `__round__` follows the same half-to-even policy as
`float` and as `Decimal`'s default context. Its format spec accepts the float
presentation types since 3.12 and the full general form since 3.13, with two
exceptions worth memorising: `'#'` forces an explicit denominator, and the zero-fill
flag is not supported at all.**

## Rounding a Fraction

`Fraction` implements `__floor__`, `__ceil__` and `__round__`, so the builtins work on
it directly:

```python
import math
from fractions import Fraction

math.floor(Fraction(-7, 2))     # -4   — toward minus infinity
math.ceil(Fraction(-7, 2))      # -3   — toward plus infinity
round(Fraction(-7, 2))          # -4   — ties to even
round(Fraction(1, 3), 2)        # Fraction(33, 100)
```

`__round__` rounds **half to even**, the same policy as `round()` on a float and on a
`Decimal` in the default context — the reasoning is in
[round() and banker's rounding](09-round-and-bankers-rounding.md). The `round()`
builtin's own contract explains the two return types: without `ndigits` it returns an
`int`, and with `ndigits` it returns a value of the argument's type, so
`round(f, 2)` is still a `Fraction`.

The half-to-even case is worth seeing exactly, because with a `Fraction` you can
state a tie precisely and a float often cannot:

```python
round(Fraction(1, 2))           # 0 — ties to even
round(Fraction(3, 2))           # 2 — ties to even
```

## Formatting

Since 3.12 `Fraction` supports the float presentation types, and since 3.13 the
general form supports fill, alignment, sign, width and grouping. The documented
examples cover the surface:

```python
format(Fraction(103993, 33102), '_')        # '103_993/33_102'
format(Fraction(1, 7), '.^+10')             # '...+1/7...'
format(Fraction(3, 1), '')                  # '3'
format(Fraction(3, 1), '#')                 # '3/1'
format(Fraction(1, 7), '.40g')              # '0.1428571428571428571428571428571428571429'
format(Fraction('1234567.855'), '_.2f')     # '1_234_567.86'
f"{Fraction(355, 113):*>20.6e}"             # '******* 3.141593e+00'
```

Two rules to keep. The alternate form `'#'` *"forces explicit denominator even for
integers"*, which is what you want when the output is parsed back or when a bare `3`
would read as an `int`. And the zero-fill flag `'0'` is **not supported** — use an
explicit fill character with an alignment instead.

The percentage form is the one that reads best in a report, and it is a documented
example:

```python
old_price, new_price = 499, 672
"{:.2%} price increase".format(Fraction(new_price, old_price) - 1)   # '34.67% price increase'
```

Note that `.40g` and `.2f` compute a *decimal* rendering of an exact rational — the
formatting rounds, the value does not. That is the right place for rounding to happen:
at the display boundary, once.

## Gotchas

### Zero-fill in a format spec
**Symptom.** `format(Fraction(1, 7), '010')` does not do what the same spec does for
an `int`.
**Cause.** The zero-fill flag is documented as unsupported for `Fraction`.
**Fix.** Use an explicit fill character and alignment: `format(Fraction(1, 7), '0>10')`.

### An integral `Fraction` formats as a bare integer
**Symptom.** `format(Fraction(3, 1), '')` is `'3'`, and a downstream parser that
splits on `/` fails.
**Cause.** The default presentation omits a denominator of 1.
**Fix.** Use the alternate form: `format(Fraction(3, 1), '#')` is `'3/1'`.

### `round(f)` and `round(f, 0)` return different types
**Symptom.** A function returns an `int` sometimes and a `Fraction` other times.
**Cause.** The `round()` builtin returns an `int` when `ndigits` is omitted and the
argument's own type when it is supplied — passing `0` is supplying it.
**Fix.** Omit `ndigits` when you want an `int`, and convert explicitly otherwise.

### Formatting used to carry precision
**Symptom.** A value is rendered with `.2f`, parsed back, and the exactness the
`Fraction` was chosen for is gone.
**Cause.** A presentation type computes a decimal rendering and rounds it; the round
trip is through a decimal string, not through the rational.
**Fix.** Serialise the exact value — `f"{f.numerator}/{f.denominator}"`, or the `'#'`
form — and format for display separately.

## Interview questions

**How does `Fraction` round?**
`__round__` rounds half to even, matching `round()` on floats and `Decimal`'s default
context. `math.floor` and `math.ceil` go to minus and plus infinity respectively, so
they disagree with `round` and with `int()` on negatives.

**Why does `round(f)` give an `int` but `round(f, 2)` give a `Fraction`?**
That is the `round()` builtin's documented contract, not something specific to
`Fraction`: omitting `ndigits` returns an integer, supplying it returns a value of the
argument's type.

**What does the `#` flag do in a `Fraction` format spec?**
It forces an explicit denominator, so `format(Fraction(3, 1), '#')` is `'3/1'` rather
than `'3'`. Useful whenever the output will be parsed back or could be mistaken for an
integer.

**Can you zero-pad a formatted `Fraction`?**
Not with the `'0'` flag — it is documented as unsupported. Use an explicit fill
character with an alignment, such as `'0>10'`.

**Where should a `Fraction` be rounded in a pipeline?**
At the boundary where it leaves exact arithmetic — a display, a report, a wire format
— and once. `.2f` or `.40g` computes a decimal rendering of the exact rational without
touching the value, which is the right division of labour: the value stays exact, the
presentation rounds.

**`math.floor`, `int()` and `round()` on `Fraction(-7, 2)` — what do you get?**
`-4`, `-3` and `-4`. `math.floor` goes to minus infinity, `int()` truncates toward
zero, and `round()` goes to the nearest with ties to even, which for `-3.5` is `-4`.

**How would you serialise a `Fraction` without losing exactness?**
As its two integers — `f"{f.numerator}/{f.denominator}"`, or `format(f, '#')` — and
parse back with `Fraction(s)`. A decimal presentation type rounds, so a round trip
through `.2f` is lossy by construction.

---

← Prev: [Approximation and cost](11c-limit-denominator-and-cost.md) · Index: [Numbers](README.md) · Next → [Conversions and precision loss](12-conversions-and-precision-loss.md)
