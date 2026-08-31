---
title: "round(Decimal('3.75')) and round(Decimal('3.75'), 0) can give different answers, because one honours the context's rounding mode and the other does not"
sidebar_label: "9b · round() per type"
sidebar_position: 91
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Python 3.14 library reference for
> [`round()`](https://docs.python.org/3.14/library/functions.html#round),
> [`decimal`](https://docs.python.org/3.14/library/decimal.html) (Decimal
> objects — rounding with `round()`) and
> [`fractions`](https://docs.python.org/3.14/library/fractions.html)
> (`Fraction.__round__`, `Fraction.__format__`).
> Version spine: **Python 3.14.7**.

**`round()` delegates to `__round__`, so "what does `round()` do" has a
different answer for every numeric type — and the `Decimal` answer is genuinely
startling: the no-`ndigits` form ignores the context's rounding mode and always
ties to even, while the with-`ndigits` form respects it. Under a `ROUND_DOWN`
context the documentation shows `round(Decimal('3.75'))` giving `4` and
`round(Decimal('3.75'), 0)` giving `Decimal('3')`. If your application sets a
non-default rounding mode, every bare `round(d)` in the codebase is silently
exempt from it.**

## `Decimal`: two functions wearing one name

The `decimal` documentation specifies `round()` on a `Decimal` in two halves,
and they do not agree with each other:

> *"If ndigits is not given or `None`, returns the nearest `int` to number,
> rounding ties to even, and ignoring the rounding mode of the `Decimal`
> context. Raises `OverflowError` if number is an infinity or `ValueError` if
> it is a (quiet or signaling) NaN."*

> *"If ndigits is an `int`, the context's rounding mode is respected and a
> `Decimal` representing number rounded to the nearest multiple of
> `Decimal('1E-ndigits')` is returned; in this case, `round(number, ndigits)`
> is equivalent to `self.quantize(Decimal('1E-ndigits'))`. Returns
> `Decimal('NaN')` if number is a quiet NaN. Raises `InvalidOperation` if
> number is an infinity, a signaling NaN, or if the length of the coefficient
> after the quantize operation would be greater than the current context's
> precision."*

The docs then demonstrate the divergence directly, with the context's rounding
mode set to `ROUND_DOWN`:

> `round(Decimal('3.75'))` → `4` *"# context rounding ignored"*
> `round(Decimal('3.5'))` → `4` *"# round-ties-to-even"*
> `round(Decimal('3.75'), 0)` → `Decimal('3')` *"# uses the context rounding"*
> `round(Decimal('3.75'), 1)` → `Decimal('3.7')`
> `round(Decimal('3.75'), -1)` → `Decimal('0E+1')`

Three things to take from that block.

**`round(d)` and `round(d, 0)` are different operations, not the same one
written twice.** One is a conversion to `int` with a fixed tie rule; the other
is a `quantize` governed by the ambient context. Under a non-default context
they disagree in *value*, not merely in type.

**`round(d, ndigits)` is `quantize` in disguise.** The docs say so:
*"round(number, ndigits) is equivalent to self.quantize(Decimal('1E-ndigits'))"*.
That means it inherits `quantize`'s failure mode — `InvalidOperation` if the
result would need more digits than the context's precision — which `round()` on
a `float` can never raise.

**The NaN and infinity behaviour also differs between the two forms.** No
`ndigits`: `OverflowError` on infinity, `ValueError` on NaN. With `ndigits`:
`Decimal('NaN')` returned for a quiet NaN, `InvalidOperation` raised for an
infinity or a signalling NaN. Four outcomes across two forms and two special
values.

`round(Decimal('3.75'), -1)` returning `Decimal('0E+1')` rather than `0` is the
other half of the significance story: a `Decimal` remembers the exponent it was
quantised to, and `0E+1` is a zero that knows it is accurate to the tens place.

## `Fraction`: exact, and always ties to even

> *"The first version returns the nearest `int` to self, rounding half to even.
> The second version rounds self to the nearest multiple of
> `Fraction(1, 10**ndigits)` (logically, if ndigits is negative), again
> rounding half toward even. This method can also be accessed through the
> `round()` function."*

No context, no mode, no configuration. `Fraction` is exact, so a tie is always
a *real* tie, and it always resolves to even. This makes `Fraction` the type to
reach for when you want to reason about rounding behaviour without
representation error muddying the experiment: `round(Fraction(5, 2))` is
genuinely the half-to-even case, whereas `round(2.5)` might or might not be,
depending on whether the literal is exactly representable — and you cannot tell
by looking, which is exactly what makes `round(2.675, 2)` confusing.

Formatting a `Fraction` with a float presentation type is documented and exact
on the input side:

> `format(Fraction('1234567.855'), '_.2f')` → `'1_234_567.86'`

The `Fraction` holds `1234567855/1000` exactly, so the formatter really is
rounding a number that ends in `.855`.

## `int`: rounding to a negative number of digits

`round()` on an `int` with `ndigits >= 0` returns the value unchanged — as an
`int`, since *"the return value has the same type as number"*. With a negative
`ndigits` it genuinely rounds, and ties still go to even:

```python
round(1234, -2)     # 1200
round(1250, -2)     # 1200   <- ties to even: 12 is even
round(1350, -2)     # 1400   <- ties to even: 14 is even
round(1234, 2)      # 1234   <- unchanged, still an int
```

`round(1250, -2)` being `1200` while `round(1350, -2)` is `1400` looks
arbitrary until you notice the rule is about the *multiple*, not the digit.

## `complex` and the types that opt out

`complex` implements none of `__round__`, `__floor__`, `__ceil__` or
`__trunc__`, so `round(1+2j)` raises `TypeError`. It is not registered as a
`numbers.Real`, and there is no nearest integer on the complex plane to round
toward. If a value might be complex, round `abs(z)` or `z.real` deliberately.

## Gotchas

**★ `round(Decimal('3.75'))` and `round(Decimal('3.75'), 0)` can return
different values.** Under a `ROUND_DOWN` context the docs show `4` and
`Decimal('3')`. The no-`ndigits` form *"ignor[es] the rounding mode of the
`Decimal` context"* and always ties to even; the with-`ndigits` form is a
`quantize` and honours the context. Setting an application-wide rounding mode
therefore does *not* reach every `round()` call.

**★ `round(d, n)` on a `Decimal` can raise `InvalidOperation`.** It is
`quantize` underneath, so it fails *"if the length of the coefficient after the
quantize operation would be greater than the current context's precision."*
`round()` on a `float` cannot raise this, so error handling written against
floats does not cover the `Decimal` path.

**★ `round()` on a `Decimal` NaN behaves two different ways.** Without
`ndigits` it raises `ValueError`; with `ndigits` it *returns* `Decimal('NaN')`
for a quiet NaN. So a NaN passes silently through `round(d, 2)` and detonates
later at a comparison, or stops immediately at `round(d)` — from the same input
value, depending only on whether an argument was supplied.

**★ `round(Decimal('3.75'), -1)` is `Decimal('0E+1')`, not `Decimal('0')`.**
A quantised `Decimal` keeps its exponent, so the result is a zero at the tens
place. It compares equal to `0`, prints as `0E+1`, and serialises as `0E+1`
under `str()` — which is valid input to `Decimal()` and invalid JSON.

**★ `round(1250, -2)` is `1200` but `round(1350, -2)` is `1400`.** Ties-to-even
applies to the multiple, not the digit. Bucketing code written on the
assumption that halves round consistently upward produces buckets of unequal
population — a sawtooth in a histogram, long before anyone suspects `round`.

**★ `round(x, 2)` does not produce a value with two decimal places.** For a
`float` it produces the nearest `double` to a two-place value, which is still
inexact. Only `Decimal.quantize` gives you a value whose *exponent* is `-2`.

**★ Third-party numeric libraries do not necessarily follow `round()`'s
rule.** NumPy, pandas and database engines each define their own tie behaviour
and precision model. I have not verified their current documented behaviour
here — check the specific library's docs before assuming your Python rounding
matches what the array or the database will do.

## Interview questions

**★ Under a context with `rounding=ROUND_DOWN`, what do `round(Decimal('3.75'))`
and `round(Decimal('3.75'), 0)` return?**
`4` and `Decimal('3')` respectively — the docs give exactly this pair, with the
comments *"context rounding ignored"* and *"uses the context rounding"*. The
no-`ndigits` form is a conversion to `int` that always rounds to nearest with
ties to even and deliberately ignores the context. The with-`ndigits` form is a
`quantize`, so `ROUND_DOWN` truncates toward zero.

**★ What is `round(d, 2)` on a `Decimal`, mechanically?**
`d.quantize(Decimal('1E-2'))` — the docs state the equivalence outright. That
means it uses the context's rounding mode, it sets the result's exponent to
`-2` so trailing zeros are preserved, and it can raise `InvalidOperation` if
the resulting coefficient would exceed the context precision.

**★ Which type would you use to demonstrate half-to-even without argument?**
`Fraction`. Its `__round__` is documented as *"rounding half to even"* with no
context and no configuration, and because a `Fraction` is exact, a tie is
really a tie. With a `float` you can never be certain whether you are observing
the tie rule or representation error — which is exactly the confusion
`round(2.675, 2)` causes.

**★ Why does `round(1250, -2)` give `1200`?**
Because `round()` rounds *"to the closest multiple of 10 to the power minus
ndigits"*, and `1250` is exactly halfway between the multiples `1200` and
`1300`. Ties go to the even multiple, and `12 × 100` is the even one. The same
rule sends `1350` to `1400`.

**★ Why does `round()` raise on a `complex`?**
`complex` does not implement `__round__` and is not a `numbers.Real`. `round()`
is only a dispatcher — *"For a general Python object `number`, `round`
delegates to `number.__round__`"* — so with nothing to delegate to it raises
`TypeError`. There is no total order on the complex plane, so "nearest integer"
has no meaning.

---

← Prev: [round() and banker's rounding](09-round-and-bankers-rounding.md) · Index: [Numbers](README.md) · Next → [Double rounding and rounding policy](09c-double-rounding-and-policy.md)

{/* FOOTER */}
