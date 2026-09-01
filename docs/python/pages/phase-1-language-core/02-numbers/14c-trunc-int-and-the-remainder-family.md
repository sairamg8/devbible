---
title: "Python 3.14 removed int()'s fallback to __trunc__, so int(x) and math.trunc(x) now consult different protocol methods and a class that implements only one of them fails at a call site"
sidebar_label: "14c · trunc, int() and remainders"
sidebar_position: 142
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Python 3.14
> [`math`](https://docs.python.org/3.14/library/math.html) reference (`trunc`,
> `fmod`, `modf`),
> [Built-in Functions](https://docs.python.org/3.14/library/functions.html)
> (`int`, `round`),
> [Emulating numeric types](https://docs.python.org/3.14/reference/datamodel.html#emulating-numeric-types)
> (`__trunc__`, `__int__`, `__index__`, `__round__`), and
> [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html)
> (`int()` and `__trunc__()`, contributed by Mark Dickinson,
> [gh-119743](https://github.com/python/cpython/issues/119743)).
> Version spine: **Python 3.14.7**; the `int()`/`__trunc__` change is **new in
> 3.14**.

**`math.trunc(x)` and `int(x)` used to be near-synonyms: both round toward zero,
and for a custom type `int()` would fall back to `__trunc__` when `__int__` was
missing. Python 3.14 removed that fallback. The two now consult different
methods, so a numeric class written before 3.14 that implemented only
`__trunc__` raises `TypeError` on `int(obj)` — at a call site, not at import,
which is how it survives a test run and appears in production. This chunk is
that change, the four different ways Python turns a number into a whole number,
and the `fmod`/`modf` pair that rounds out the family.**

## `math.trunc` versus `int()`

> *"Return x with the fractional part removed, leaving the integer part. This
> rounds toward 0: `trunc()` is equivalent to `floor()` for positive x, and
> equivalent to `ceil()` for negative x. If x is not a float, delegates to
> `x.__trunc__`, which should return an `Integral` value."*

`int()` truncates too — the built-in docs say *"For floating-point numbers, this
truncates towards zero"* — and for a `float` argument the two agree exactly. For
anything else they now take different routes.

## What 3.14 changed

> *"The `int()` function no longer delegates to `__trunc__()`. Classes that want
> to support conversion to `int()` must implement either `__int__()` or
> `__index__()`."*

and in the same release the data model deprecated part of the other side:

> *"Deprecated since version 3.14: Returning a non-integral value from
> `__trunc__()` is deprecated."*

So the dispatch table is now:

| Call | Protocol consulted |
|---|---|
| `int(x)` | `__int__`, then `__index__` |
| `math.trunc(x)` | `__trunc__` (if `x` is not a float) |
| `operator.index(x)` | `__index__` only |
| `round(x)` | `__round__` |
| `float(x)` | `__float__`, then `__index__` |

A class that implemented **only** `__trunc__` used to satisfy `int()` and now
does not. Because the failure is a `TypeError` raised where the conversion is
attempted, a type used on one rarely-exercised branch can pass a full test run
and fail on the first production request that reaches it.

```python
class Ticks:
    def __init__(self, value):
        self.value = value

    def __trunc__(self):  return int(self.value)   # math.trunc
    def __int__(self):    return int(self.value)   # int() - required from 3.14
    def __index__(self):  return int(self.value)   # bin/hex/oct, slicing, range
    def __floor__(self):  return int(self.value // 1)
    def __ceil__(self):   return -int(-self.value // 1)
```

The `__index__` documentation carries its own consistency rule, and it is worth
obeying rather than discovering:

> *"When `__index__()` is defined, `__int__()` should also be defined, and both
> should return the same value, in order to ensure consistency across different
> numeric conversions."*

`__index__` also means something stronger than "convertible to an integer" — the
docs say *"Presence of this method indicates that the numeric object is an
integer type."* A `Duration` that can hold fractional seconds should define
`__int__` and not `__index__`, because defining `__index__` claims it can be a
list index and a `range` bound, which it cannot meaningfully be.

## The four roundings, side by side

`floor`, `ceil`, `trunc`/`int()` and `round` are four different answers to "make
this a whole number", and only one of them is a rounding in the ordinary sense:

| Input | `floor` | `ceil` | `trunc` / `int()` | `round` |
|---|---|---|---|---|
| `2.5` | `2` | `3` | `2` | `2` (ties to even) |
| `3.5` | `3` | `4` | `3` | `4` (ties to even) |
| `-2.5` | `-3` | `-2` | `-2` | `-2` (ties to even) |
| `-0.4` | `-1` | `0` | `0` | `0` |
| `-0.0` | `0` | `0` | `0` | `0` |

`trunc` matches `ceil` on negatives and `floor` on positives — the docs say
exactly that — which is why "truncate" and "floor" look interchangeable until
the first negative value arrives. `round` is the odd one out twice over: it is
documented to round half to even (see
[09](09-round-and-bankers-rounding.md)), and it is the only one of the four that
takes an `ndigits` argument and can therefore return a `float`
([06d](06d-where-negative-zero-comes-from.md) for why that matters).

Note the last row: every one of the four destroys a negative zero, because all
four return an `int` in this form and `int` has no sign bit
([06e](06e-what-erases-the-sign.md)).

## `math.fmod` versus `%`, and the documented decision rule

The `fmod` entry states the difference and then tells you which to use — a rare
case of the documentation making the call for you:

> *"Note that the Python expression `x % y` may not return the same result. The
> intent of the C standard is that `fmod(x, y)` be exactly (mathematically; to
> infinite precision) equal to `x - n*y` for some integer n such that the result
> has the same sign as x and magnitude less than `abs(y)`. Python's `x % y`
> returns a result with the sign of y instead, and may not be exactly computable
> for float arguments. … For this reason, function `fmod()` is generally
> preferred when working with floats, while Python's `x % y` is preferred when
> working with integers."*

`math.remainder` is the third member of the family, following IEEE 754 rather
than either C's `fmod` or Python's `%`:

> *"Return the IEEE 754-style remainder of x with respect to y. … The remainder
> `r = remainder(x, y)` thus always satisfies `abs(r) <= 0.5 * abs(y)`."*

> *"On platforms using IEEE 754 binary floating point, the result of this
> operation is always exactly representable: no rounding error is introduced."*

Three conventions, three sign rules, and only `%` is an operator.
[08e](08e-float-modulo-fmod-and-remainder.md) works through them with the
documented roundoff example; the decision rule above is what to remember here.

## `math.modf` is not `divmod`

> *"Return the fractional and integer parts of x. Both results carry the sign of
> x and are floats."*

Two **floats**, in that order — fractional part first. It is not `divmod`, which
returns a quotient and a remainder against a divisor, and it is not
`(int(x), x - int(x))`, which loses the sign of the fractional part on a
negative zero. `modf` is also one of the three functions the docs attach the
2\*\*52 warning to, for the same reason: above that magnitude there is no
fractional part left to return.

## Gotchas

**★ A class that implements only `__trunc__` broke in 3.14.** `int()` no longer
falls back to it, so `int(obj)` raises `TypeError` where it used to work, at the
call site rather than at import. Third-party numeric types, internal unit
wrappers and anything modelled on pre-3.12 examples are the likely victims. The
fix is one method:

```python
def __int__(self):
    return self.__trunc__()
```

**★ Returning a non-integral value from `__trunc__` is deprecated as of 3.14.**
The data model says so explicitly. A `__trunc__` that returns a `Decimal` or a
`float` "because it is more convenient for our callers" is now on a removal
path, and the same class almost certainly needs `__int__` added anyway.

**★ `math.trunc` and `int()` agree on floats and can disagree on anything
else.** For a `float` argument the two produce the same integer. For a custom
type they consult different methods, so a class can quite legally define
`__trunc__` and `__int__` to return different values — and a code base that uses
the two interchangeably will not notice until one of them is wrong.

**★ Defining `__index__` is a stronger claim than defining `__int__`.** The docs
say its presence *"indicates that the numeric object is an integer type"*, and
it is what `bin()`, `hex()`, `oct()`, slicing and `range` use. A type that can
hold a fraction should not define it. Conversely, if you do define it, the docs
require `__int__` to exist and return the same value.

**★ `round(x)` is not `math.trunc(x)` and is not `int(x)`.** It rounds half to
even rather than toward zero, so `int(2.5)` is `2` and `round(2.5)` is `2`, but
`int(3.5)` is `3` while `round(3.5)` is `4`. Substituting one for another in a
billing or quota path changes results on exactly the boundary values a test
suite tends not to cover.

**★ `math.modf` returns two floats, fractional part first.** Unpacking it as
`int_part, frac = math.modf(x)` is backwards and silently wrong, and neither
element is an `int`. It is also the one function in this family that preserves a
negative zero, since *"both results carry the sign of x"*.

**★ `x % y` on floats is not exactly computable in general, and the docs give
the example.** `-1e-100 % 1e100` is `1e100-1e-100`, *"which cannot be
represented exactly as a float, and rounds to the surprising `1e100`"*. If you
are reducing an angle or a phase, this is the failure — use `math.remainder`,
which the docs promise introduces *"no rounding error"* on IEEE 754 platforms.

**★ `math.remainder(x, 0)` and `math.remainder(math.inf, x)` raise
`ValueError`.** The special cases are documented and they are not the same as
`%`'s: `x % 0.0` also raises, but as `ZeroDivisionError`, and the two exception
types will not be caught by the same handler. Porting between the two functions
means porting the error handling as well.

## Interview questions

**★ What changed about `int()` and `__trunc__` in 3.14, and how would you notice
it?**
`int()` no longer delegates to `__trunc__()`; a class must implement `__int__()`
or `__index__()`. You notice it as a `TypeError` at a call site — `int(obj)` on
a legacy or third-party numeric type that only defined `__trunc__` — rather than
at import, so it can hide on a rarely-executed path. `math.trunc` still uses
`__trunc__`, which is what makes the break confusing: two calls that used to be
interchangeable now consult different methods, and only one of them broke.

**★ Rank `floor`, `ceil`, `trunc` and `round` for `-2.5`.**
`floor` gives `-3` (toward minus infinity), `ceil` gives `-2` (toward plus
infinity), `trunc` and `int()` give `-2` (toward zero), and `round` gives `-2`
(nearest, ties to even). `trunc` matches `ceil` on negatives and `floor` on
positives — the documentation says exactly that — which is why "truncate" and
"floor" look identical until the first negative value arrives, and why a
formula ported from a language whose integer division truncates changes meaning
in Python ([08](08-floor-division-and-modulo.md)).

**★ When should you use `math.fmod` instead of `%`?**
The documentation answers directly: *"function `fmod()` is generally preferred
when working with floats, while Python's `x % y` is preferred when working with
integers."* The reason is that `%` on floats takes the sign of the divisor and
is computed from the floored quotient, which is not exactly representable in
general — the docs' own example is `-1e-100 % 1e100` rounding to a surprising
`1e100` — whereas `fmod` takes the sign of the dividend and is the exact C
operation. If what you want is the IEEE remainder with `abs(r) <= 0.5*abs(y)`
and no rounding error at all, that is a third function, `math.remainder`.

**★ You are writing a `Duration` type. Which of these methods do you
implement?**
`__int__` if a duration is meaningfully convertible to an integer count of
ticks. `__index__` **only** if it genuinely is an integer type, because the docs
say its presence *"indicates that the numeric object is an integer type"* and it
drives slicing and `range`; and if you define it, define `__int__` to return the
same value. `__trunc__`, `__floor__` and `__ceil__` so the `math` functions work
and stay exact instead of going through a float. `__round__` if `round(d, n)`
should mean something. And build it as a class holding a value rather than as a
subclass of `float`, since the `math` delegation is documented to be skipped for
floats ([14b](14b-floor-ceil-and-trunc.md)).

**★ Why did CPython remove the `__trunc__` fallback rather than leaving it?**
Because it made `int()` mean two different things. `__trunc__` is the hook for
`math.trunc`, whose contract is "remove the fractional part"; `__int__` is the
hook for "convert to an integer", which for many types is not truncation at all.
Falling back from one to the other meant `int(obj)` silently acquired
truncation semantics for any class that had only implemented the `math` hook.
The 3.14 change makes each conversion consult the method that describes it, and
the migration cost is one method on affected classes.

**★ `math.modf(x)` — what does it return, and what is the trap?**
A pair of floats, *"the fractional and integer parts of x"* in that order, both
carrying the sign of `x`. The trap is the order and the types: it is easy to
unpack as integer-then-fraction, and neither element is an `int`, so a caller
expecting `math.trunc`'s return type gets a float. It also inherits the 2\*\*52
warning — above that magnitude a float has no fractional bits, so the fractional
part is always zero.

---

← Prev: [floor and ceil vs //](14b-floor-ceil-and-trunc.md) · Index: [Numbers](README.md) · Next → [Powers, roots and logs](14d-powers-roots-and-logs.md)

{/* FOOTER */}
