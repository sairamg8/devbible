---
title: "Two sentences in the math module's documentation explain almost every disagreement between math and the built-in operators: everything returns a float, and the module is a thin wrapper over the platform C library"
sidebar_label: "14 · math vs the operators"
sidebar_position: 140
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Python 3.14
> [`math`](https://docs.python.org/3.14/library/math.html) reference (the
> module-wide return-type rule and the CPython implementation-detail note),
> [Built-in Functions](https://docs.python.org/3.14/library/functions.html)
> (`int`, `float`, `pow`, `abs`),
> [Numeric Types](https://docs.python.org/3.14/library/stdtypes.html#numeric-types-int-float-complex),
> and [Emulating numeric types](https://docs.python.org/3.14/reference/datamodel.html#emulating-numeric-types).
> Version spine: **Python 3.14.7**.

**`math.floor(x)` and `x // 1` do not return the same type. `math.pow(2, 3)` and
`2 ** 3` do not return the same type. `math.sqrt` raises where `** 0.5` returns
a complex number. `math.fmod` and `%` disagree about the sign of the result.
None of this is arbitrary — almost all of it follows from two sentences in the
`math` documentation, one about return types and one about what the module
actually is. Learn those two sentences and the whole catalogue becomes
predictable rather than a list to memorise. This chunk states them and derives
the consequences; [14b](14b-floor-ceil-and-trunc.md) is `floor` and `ceil`
against `//`, [14c](14c-trunc-int-and-the-remainder-family.md) is `trunc`,
`int()` and the remainder family, [14d](14d-powers-roots-and-logs.md) is powers
and roots, [14e](14e-logarithms-and-exponentials.md) is logarithms and
exponentials, [14f](14f-aggregation-and-the-rest.md) is summation and absolute
value, and [14g](14g-geometry-and-number-theory.md) is distances and the
number-theoretic functions.**

## The two sentences

First, the return type — a single line sitting above the whole function list:

> *"Except when explicitly noted otherwise, all return values are floats."*

Second, what the module is:

> *"**CPython implementation detail:** The `math` module consists mostly of thin
> wrappers around the platform C math library functions. Behavior in exceptional
> cases follows Annex F of the C99 standard where appropriate. The current
> implementation will raise `ValueError` for invalid operations like
> `sqrt(-1.0)` or `log(0.0)` (where C99 Annex F recommends signaling invalid
> operation or divide-by-zero), and `OverflowError` for results that overflow
> (for example, `exp(1000.0)`)."*

The built-in operators are the opposite of both. They dispatch through the data
model to the operand's own type — `int`, `float`, `Decimal`, `Fraction`,
`complex`, or your class — and they preserve or promote that type rather than
narrowing it.

| | `math` | operator / builtin |
|---|---|---|
| Argument | converted to `float` | dispatched to the type's own method |
| Result type | `float`, unless noted | the operand type, or a promotion of it |
| Out of domain | `ValueError` | may return `complex`, or raise |
| Overflow | `OverflowError` | `int` grows without bound; `float` may reach `inf` |
| Large `int` | loses precision above 2\*\*53 | exact |
| Your own class | ignored, except for four protocol hooks | honours `__add__`, `__pow__`, … |
| `Decimal` / `Fraction` | converted to `float`, precision gone | stays exact |

Every specific disagreement in the following chunks is that table applied to a
particular pair of names.

## Consequence 1: `math` narrows to `float`, so large integers lose precision

Python's `int` is unbounded ([01](01-int-never-overflows.md)) and a `float` has
53 bits of significand. Every `math` function that takes a float argument
converts first, and the conversion is where the information goes. Above
2\*\*53 the conversion silently drops bits; above roughly 1.8e308 it raises,
because the `float()` documentation says *"If the argument is outside the range
of a Python float, an `OverflowError` will be raised."*

```python
n = 10**30

n ** 2               # exact int, 61 digits
math.pow(n, 2)       # a float: 53 bits of significand, and that is all
math.sqrt(n)         # a float whose square is not n
math.isqrt(n)        # exact int - the whole point of isqrt

huge = 10**400
math.floor(huge)     # fine - delegates to __floor__, never becomes a float
math.sqrt(huge)      # OverflowError, raised by the conversion, not the sqrt
```

Note where the `OverflowError` comes from in that last line: converting the
argument, before the square root is attempted. The same call with `10**300`
would not raise — it would return a float that is merely wrong in its low bits.
**The failing case is the safe one; the succeeding case is the dangerous one.**

The exceptions to the narrowing are worth memorising, because they are exactly
the functions you need when the numbers are large: `floor`, `ceil` and `trunc`
(which delegate to protocol methods instead of converting), `isqrt`, `gcd`,
`lcm`, `factorial`, `comb`, `perm`, and `prod` when every element is an `int`.
Everything else in `math` is a float pipeline that happens to accept ints at the
door.

## Consequence 2: `math` raises where the operators return an answer

The implementation note is explicit that `math` raises `ValueError` for invalid
operations — `sqrt(-1.0)`, `log(0.0)` — where C99 Annex F would have signalled
and returned a NaN or an infinity. The operators frequently do neither: `**` on
a negative base with a fractional exponent is documented to *"deliver a complex
result"*, and integer arithmetic simply grows to fit.

```python
(-9) ** 0.5          # a complex number close to 3j - documented behaviour
math.sqrt(-9)        # ValueError
cmath.sqrt(-9)       # 3j, exactly - the module built for this
```

So the same mathematical question gets an exception from one and a value from
the other, and which you want depends on whether a negative input is a bug in
your data or a legitimate case. [14d](14d-powers-roots-and-logs.md) works
through the whole family.

## Consequence 3: only four hooks reach into `math`

The operators are dispatched by the interpreter through the data model, so a
domain type controls what they mean. `math` converts and hands the value to C.
The only places a class can intervene are:

| Call | Protocol consulted |
|---|---|
| `int(x)` | `__int__`, then `__index__` |
| `float(x)` | `__float__`, then `__index__` |
| `math.floor(x)` | `__floor__` (if `x` is not a float) |
| `math.ceil(x)` | `__ceil__` (if `x` is not a float) |
| `math.trunc(x)` | `__trunc__` (if `x` is not a float) |
| `round(x)` | `__round__` |
| `operator.index(x)` | `__index__` only |
| `x ** y`, `x // y`, `x % y`, `abs(x)` | `__pow__`, `__floordiv__`, `__mod__`, `__abs__` |
| every other `math` function | none — the argument is converted to `float` |

That last row is the important one. A `Money`, `Metres` or `Vector` class passed
to `math.pow` or `math.hypot` comes back as a bare `float` with its units,
currency and provenance discarded, and nothing warns you. The four hooks are
covered in [14b](14b-floor-ceil-and-trunc.md) and
[14c](14c-trunc-int-and-the-remainder-family.md).

## Gotchas

**★ Any `math` function applied to a large `int` silently loses precision, and
only the extreme case raises.** Above 2\*\*53 the float conversion drops bits and
returns a plausible-looking answer; only above the float range do you get an
`OverflowError`, and that comes from the conversion rather than from the
mathematics. The silent case is the one that reaches production.

**★ `math.floor(n / d)` is not `n // d` for large integers.** The `/` produces a
float before `floor` ever runs, so the result is wrong above 2\*\*53 even though
both expressions read as "the floor of a quotient". `//` on two `int`s never
leaves integer space. This is the classic silent failure in pagination, sharding
and chunking code — [08b](08b-ceiling-division-and-integer-edges.md).

**★ `math` accepts `int`, `Decimal` and `Fraction` arguments without complaint,
which is why the precision loss is invisible.** There is no `TypeError` to warn
you that an exact type was narrowed. `math.sqrt(Fraction(1, 3))` returns a
float; so does `math.fabs(Decimal('0.1'))`. If the input type was chosen for
exactness, calling `math` on it discards the reason it was chosen.

**★ `math.pow(2, 3)` is `8.0` and `2 ** 3` is `8`, and the difference propagates
into everything downstream.** A float exponent result used as a list index, a
`range` bound or a dict key is a `TypeError` or a distinct key. The `math.pow`
docs say it outright: *"Unlike the built-in `**` operator, `math.pow()` converts
both its arguments to type `float`. Use `**` or the built-in `pow()` function
for computing exact integer powers."*

**★ The operators honour your class; `math` does not.** `__add__`, `__mul__`,
`__pow__`, `__floordiv__` and the rest are dispatched by the interpreter, so a
domain type controls their meaning. `math.pow`, `math.sqrt` and `math.hypot`
convert to float and call into C, so a units-carrying type comes back stripped.
The only four hooks `math` respects are `__floor__`, `__ceil__`, `__trunc__`
and — indirectly, through argument conversion — `__float__` (falling back to
`__index__`).

**★ "It is a thin wrapper over the platform C library" is a portability warning,
not a footnote.** The docs say behaviour in exceptional cases follows *"Annex F
of the C99 standard where appropriate"* — "where appropriate" is doing real
work. For the ordinary domain the functions are well specified; for edge cases
(the sign of a zero result, which NaN comes back, the last-bit accuracy of a
transcendental) the answer comes from the platform. Do not assert bit-exact
results of `math` transcendentals in cross-platform tests.

**★ A NaN argument does not always produce a NaN result.** The same
implementation note: *"A NaN will not be returned from any of the functions
above unless one or more of the input arguments was a NaN; in that case, most
functions will return a NaN, but (again following C99 Annex F) there are some
exceptions to this rule, for example `pow(float('nan'), 0.0)` or
`hypot(float('nan'), float('inf'))`."* So "NaN in, NaN out" is a good default
assumption and a bad invariant to rely on — validate with `math.isfinite` at the
boundary instead ([06b](06b-detecting-nan-and-containers.md)).

**★ `math` gives you no way to opt out of the float conversion.** There is no
`math.sqrt(x, exact=True)`. The integer-exact functions are separate names
(`isqrt`, `gcd`, `comb`), and if the one you want has no integer twin, the
answer is a different library — `decimal`, `fractions`, or an integer algorithm
of your own — not a different argument.

## Interview questions

**★ Give the one-line rule that predicts most `math`-versus-operator
differences.**
`math` converts its arguments to `float` and returns a `float`; the operators
dispatch to the operand's type and preserve it. Everything else follows:
narrowing explains the precision loss on large ints and the `OverflowError`;
returning a float explains why `math.pow(2, 3)` is `8.0` while `2 ** 3` is `8`;
being a thin C wrapper explains the `ValueError` on out-of-domain input where
`**` would deliver a complex number; and `__floor__`, `__ceil__` and `__trunc__`
are the three deliberate exceptions carved out of the narrowing rule.

**★ Which `math` functions are safe on a 200-digit integer?**
The ones documented to work in integer space: `floor`, `ceil` and `trunc`, which
delegate to `__floor__`, `__ceil__` and `__trunc__` rather than converting;
`isqrt`; `gcd` and `lcm`; `factorial`, `comb` and `perm`; and `prod` over
all-integer input. Everything else converts to `float`, which is lossy above
2\*\*53 and raises `OverflowError` above the float range — and since the loss is
silent while the raise is not, the merely-lossy case is the dangerous one.

**★ You need the floor of `a / b` where both are 30-digit integers. What do you
write, and what is wrong with the obvious alternative?**
`a // b`. `math.floor(a / b)` converts both operands to float for the division,
so above 2\*\*53 the quotient is already wrong before `floor` sees it, and above
the float range the division raises `OverflowError`. `//` on two `int`s is exact
integer arithmetic at any magnitude. The same reasoning is why `math.isqrt`
exists alongside `math.sqrt`.

**★ Why does `math.pow` exist at all if `**` is better?**
Because it is a different function, not a worse one. `math.pow` follows IEEE 754
special cases as far as possible — the docs note that *"`pow(1.0, x)` and
`pow(x, 0.0)` always return `1.0`, even when x is a zero or a NaN"* — which is
what you want when you are implementing a numerical algorithm to a standard.
`**` follows Python's own rules, including complex results and exact integer
powers, which is what you want in application code. The mistake is reaching for
`math.pow` because it looks more official.

**★ What does "thin wrapper around the platform C math library" mean for your
test suite?**
That the well-specified behaviour is the documented domain, and the edge cases
are the platform's. Assert domain behaviour, magnitudes and documented
exceptions; do not assert the last bit of a transcendental, the sign of a zero
result, or which NaN comes back, because the docs explicitly defer those to
Annex F *"where appropriate"* and note that Python *"makes no effort to
distinguish signaling NaNs from quiet NaNs"*. A test that pins those will pass on
your laptop and fail in CI on a different libm.

**★ A colleague passes a `Fraction` to `math.sqrt` and is surprised the result
is not exact. Explain.**
`math` converts to `float` before doing anything, per the module-wide rule that
all return values are floats and the fact that the functions are wrappers over C
doubles taking C doubles. So the `Fraction`'s exactness is discarded at the
door, and it is discarded silently — no `TypeError`, no warning. The exact
answer needs a type that can express it: `Fraction` has no square root because
the square root of a rational is generally irrational, so the honest options are
`decimal.Decimal.sqrt` at a chosen precision, or `math.isqrt` on the numerator
and denominator if an integer floor is what is actually wanted.

---

← Prev: [The numeric tower](13c-the-numeric-tower.md) · Index: [Numbers](README.md) · Next → [floor and ceil vs //](14b-floor-ceil-and-trunc.md)

{/* FOOTER */}
