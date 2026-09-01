---
title: "math.fsum, math.sumprod, math.fma and math.prod exist because the loop that computes the same quantity rounds at every step, and abs versus math.fabs is a type question rather than an accuracy one"
sidebar_label: "14f · Aggregation and abs"
sidebar_position: 145
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Python 3.14
> [`math`](https://docs.python.org/3.14/library/math.html) reference (`fsum`,
> `sumprod`, `fma`, `prod`, `fabs`) and
> [Built-in Functions](https://docs.python.org/3.14/library/functions.html)
> (`abs`, `sum`, `float`).
> Version spine: **Python 3.14.7**; `sumprod` added in **3.12**, `fma` in
> **3.13**, `prod` in **3.8**.

**The remaining disagreements between `math` and the operators are not about
types at all — they are about *when the rounding happens*. `sum`, a `for` loop
with `*=`, and `sqrt(a*a + b*b)` all round after every step; `math.fsum`,
`math.sumprod`, `math.fma` and `math.hypot` are the same computations with the
intermediate roundings removed. The one genuine type question left is `abs`
versus `math.fabs`, where the built-in preserves the operand's type and the
`math` function narrows it to a float — and that difference matters for exactly
the types you chose *because* they were exact.
[14g](14g-geometry-and-number-theory.md) is the geometric and number-theoretic
functions, and carries the decision table for the whole set.**

## Summation and products: five ways, four different rounding stories

| Call | What it does | Rounding |
|---|---|---|
| `sum(xs)` | built-in; starts from `int` `0` | one per addition |
| `math.fsum(xs)` | *"an accurate floating-point sum"* | tracks exact partial sums |
| `math.prod(xs)` | product, start `1` | one per multiplication; exact for all-`int` |
| `math.sumprod(p, q)` | dot product | extended precision for the intermediates |
| `math.fma(x, y, z)` | `(x * y) + z` | **one** rounding for the whole expression |

The documentation is specific about each. `fsum`:

> *"Return an accurate floating-point sum of values in the iterable. Avoids loss
> of precision by tracking multiple intermediate partial sums."*

with a caveat worth reading before you rely on it as exact:

> *"The algorithm's accuracy depends on IEEE-754 arithmetic guarantees and the
> typical case where the rounding mode is half-even. On some non-Windows builds,
> the underlying C library uses extended precision addition and may occasionally
> double-round an intermediate sum causing it to be off in its least significant
> bit."*

`sumprod`:

> *"Return the sum of products of values from two iterables p and q. Raises
> `ValueError` if the inputs do not have the same length. Roughly equivalent to:
> `sum(map(operator.mul, p, q, strict=True))`. For float and mixed int/float
> inputs, the intermediate products and sums are computed with extended
> precision."*

`fma`:

> *"Fused multiply-add operation. Return `(x * y) + z`, computed as though with
> infinite precision and range followed by a single round to the `float` format.
> This operation often provides better accuracy than the direct expression
> `(x * y) + z`."*

and `prod` — the one with no accuracy claim at all, because it does not need
one for its main use:

> *"Calculate the product of all the elements in the input iterable. The default
> start value for the product is `1`. When the iterable is empty, return the
> start value. This function is intended specifically for use with numeric
> values and may reject non-numeric types."*

`math.prod` over an iterable of `int` is **exact**, because integer
multiplication is exact — it is `functools.reduce(operator.mul, xs, 1)` with
less ceremony and a C loop. Over floats it is an ordinary sequence of roundings;
there is no `fprod`. [05d](05d-accurate-float-arithmetic.md) works through what
each of these buys in practice; the rule for this page is that if you are
writing a loop that accumulates floats, one of these functions already exists.

## `abs()` versus `math.fabs()`

This one is a type question, and the built-in wins on every axis except
"looks mathematical".

> *"`abs(number, /)` — Return the absolute value of a number. The argument may
> be an integer, a floating-point number, or an object implementing
> `__abs__()`. If the argument is a complex number, its magnitude is returned."*

> *"`math.fabs(x)` — Return the absolute value of x."*

— and, per the module-wide rule, *"all return values are floats"*.

| Argument | `abs(x)` | `math.fabs(x)` |
|---|---|---|
| `int`, any size | exact `int` | `float` — lossy above 2\*\*53, raises above the float range |
| `float` | `float` | `float`, identical |
| `Decimal` | `Decimal`, exact | `float`, precision gone |
| `Fraction` | `Fraction`, exact | `float`, precision gone |
| `complex` | its magnitude, a `float` | `TypeError` — `complex` defines neither `__float__` nor `__index__` |
| your class | `__abs__`, your type | `float` if `__float__` exists, else `TypeError` |
| `-0.0` | `0.0` | `0.0` |

`abs` is the default. Reach for `math.fabs` only when you specifically want the
float conversion as part of the operation — which is a rare thing to want, and
worth a comment when you do.

## Gotchas

**★ `abs()` and `math.fabs()` are not interchangeable beyond floats.** `abs`
returns the operand's own type — exact for a big `int`, `Decimal` for a
`Decimal`, the magnitude for a `complex` — while `math.fabs` converts to float
first. Reaching for `fabs` because it looks more mathematical silently
downgrades every exact type you deliberately chose.

**★ `math.fabs(3 + 4j)` raises `TypeError` while `abs(3 + 4j)` returns the
magnitude.** `complex` defines neither `__float__` nor `__index__`, so the
argument conversion fails before `fabs` runs. A generic "take the absolute
value" helper written with `fabs` breaks the moment complex numbers enter, and
the traceback names a conversion rather than the design mistake.

**★ `math.prod` has no accuracy claim, because there is no `fprod`.** `fsum`
tracks exact partial sums; `prod` does not do the multiplicative equivalent. For
an all-`int` iterable it is exact because integer multiplication is; for floats
it rounds at every step, and a long product of small factors underflows to zero
— or to `-0.0` ([06d](06d-where-negative-zero-comes-from.md)). Work in log space
if that matters.

**★ `math.fsum` is documented as accurate, not as infallible.** The docs warn
that on some non-Windows builds extended-precision addition in the C library
*"may occasionally double-round an intermediate sum causing it to be off in its
least significant bit"*. It is dramatically better than `sum`; it is not a
substitute for `Decimal` or `Fraction` when exactness is a requirement rather
than a preference.

**★ `math.sumprod` raises `ValueError` on mismatched lengths where a `zip`
would silently truncate.** The documented equivalent uses `strict=True`. If you
replace a hand-rolled `sum(a * b for a, b in zip(p, q))` with `math.sumprod`, a
latent length mismatch that had been quietly dropping trailing elements becomes
an exception — the correct outcome, and still a behaviour change to expect on
the day of the switch.

**★ `math.fma(0, inf, nan)` is implementation-defined by IEEE 754, and Python
picked a side.** The docs say *"the standard leaves one case
implementation-defined, namely the result of `fma(0, inf, nan)` and
`fma(inf, 0, nan)`. In these cases, `math.fma` returns a NaN, and does not raise
any exception."* If you are porting a kernel that relies on the other choice,
this is a silent divergence rather than a failure.

**★ `sum()` starts from the integer `0`, which is not a neutral choice.** It
means `sum` of an empty iterable is an `int`, `sum` over `Decimal` values
raises unless you pass `start=Decimal(0)`, and `sum` of negative zeros produces
a positive zero ([06e](06e-what-erases-the-sign.md)). `math.fsum` has no start
value and `math.prod`'s is `1`.

**★ `math.fma` is a single operation, not a loop, and it is easy to reach for by
mistake.** It computes `(x * y) + z` with one rounding. Accumulating a dot
product by calling it in a Python loop gives you the extra accuracy per step and
the interpreter overhead of a Python loop — `math.sumprod` is the vectorised
answer and is documented to use extended precision for the intermediates.

## Interview questions

**★ `abs(x)` versus `math.fabs(x)` — when does the choice matter?**
Whenever `x` is not already a float. `abs` returns the operand's own type, so
`abs` of a large `int` is exact, `abs` of a `Decimal` stays a `Decimal`, and
`abs` of a `complex` is its magnitude. `math.fabs` converts to float first, so
it loses precision above 2\*\*53 on an `int`, silently narrows a `Decimal`, and
raises `TypeError` on a `complex` because `complex` defines neither `__float__`
nor `__index__`. For floats the two agree; for everything else `abs` is the
correct default and `fabs` is a narrowing conversion in disguise.

**★ Which of `sum`, `math.fsum`, `math.sumprod` and `math.fma` would you use to
compute a weighted average of floats?**
`math.sumprod(weights, values)` for the numerator and `math.fsum(weights)` for
the denominator. `sumprod` is documented to compute the intermediate products
and sums *"with extended precision"*, which is exactly what a weighted sum
needs, and it raises on mismatched lengths rather than truncating. `sum` rounds
after every addition; `fma` is a single multiply-add, not a loop. See
[05d](05d-accurate-float-arithmetic.md).

**★ `math.prod` is exact for a list of integers but not for floats. Why is there
no `math.fprod`?**
Because the trick `fsum` uses does not transfer. `fsum` works by tracking exact
partial sums — the sum of two floats is exactly representable as the sum of two
floats — and there is no equally cheap exact representation of a product of two
floats as a small set of floats in the general case. The practical answer for
long float products is to work in log space and use `math.fsum` over logarithms,
or to move to `Decimal` or `Fraction` if exactness is a requirement.

**★ Someone proposes replacing every `sum()` in a float pipeline with
`math.fsum()`. What do you say?**
That it is usually right and is not free. `fsum` is documented to avoid
precision loss *"by tracking multiple intermediate partial sums"*, so it costs
more per element than the built-in, and the docs carry an honesty caveat about
double-rounding in extended-precision C libraries on some builds. It matters for
accumulations over many terms of mixed magnitude — money, physics steps,
statistical moments. For a three-element sum it is noise. And if the requirement
is exactness rather than accuracy, neither function is the answer: that is
`Decimal` or `Fraction`.

**★ Why does `math.fma` exist when `(x * y) + z` is right there?**
Because the expression rounds twice — once after the multiplication and once
after the addition — and `fma` is documented to compute the result *"as though
with infinite precision and range followed by a single round to the `float`
format"*. Removing the intermediate rounding is the whole point: it is what
makes error-compensated algorithms, Newton iterations and polynomial evaluation
converge properly. The cost is that it is a single operation, so it is the wrong
tool for an aggregate — that is `sumprod`.

---

← Prev: [Logarithms and exponentials](14e-logarithms-and-exponentials.md) · Index: [Numbers](README.md) · Next → [Geometry and number theory](14g-geometry-and-number-theory.md)

{/* FOOTER */}
