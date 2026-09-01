---
title: "round() breaks ties toward even, not upward, and the docs themselves warn that round(2.675, 2) gives 2.67"
sidebar_label: "9 · round() and banker's rounding"
sidebar_position: 90
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Python 3.14 library reference for
> [`round()`](https://docs.python.org/3.14/library/functions.html#round) and
> [Numeric Types — int, float, complex](https://docs.python.org/3.14/library/stdtypes.html#numeric-types-int-float-complex),
> the [`numbers`](https://docs.python.org/3.14/library/numbers.html) module,
> and the tutorial appendix
> [Floating-Point Arithmetic: Issues and Limitations](https://docs.python.org/3.14/tutorial/floatingpoint.html).
> Version spine: **Python 3.14.7**.

**`round()` does two things people do not expect, and they are unrelated to
each other. First, it breaks exact ties toward the *even* neighbour, so
`round(0.5)` is `0` and `round(1.5)` is `2` — the schoolroom rule "0.5 rounds
up" is not what Python implements, and it is not what IEEE-754 implements
either. Second, on floats it frequently is not looking at the number you wrote:
the documentation warns in a note that `round(2.675, 2)` gives `2.67`, because
the `float` nearest to the literal `2.675` is slightly below the true value, so
there was never a tie to break. The first behaviour is deliberate and defensible.
The second is representation error, and no amount of care with `round()` fixes
it — the fix is not to be holding a `float` in the first place.**

## The definition, exactly as written

> *"Return number rounded to ndigits precision after the decimal point. If
> ndigits is omitted or is `None`, it returns the nearest integer to its
> input."*

> *"For the built-in types supporting `round()`, values are rounded to the
> closest multiple of 10 to the power minus ndigits; if two multiples are
> equally close, rounding is done toward the even choice (so, for example, both
> `round(0.5)` and `round(-0.5)` are `0`, and `round(1.5)` is `2`). Any integer
> value is valid for ndigits (positive, zero, or negative). The return value is
> an integer if ndigits is omitted or `None`. Otherwise, the return value has
> the same type as number."*

Four separate rules are packed into that paragraph, and each of them catches
somebody:

1. **Ties go to even**, not away from zero. `round(0.5)` is `0`.
2. **`ndigits` may be negative.** `round(x, -3)` rounds to the nearest thousand.
3. **Omitting `ndigits` returns an `int`.** `round(2.5)` is an `int`.
4. **Passing `ndigits` returns the *same type* as the input.** `round(2.5, 0)`
   is a `float`, and `round(Decimal('2.5'), 0)` is a `Decimal`. Passing `0`
   explicitly is not the same as omitting the argument.

Point 4 is the one that produces a `TypeError` three functions later, when a
value that was supposed to be an index turns out to be `2.0`.

```python
round(2.5)        # int    2
round(2.5, 0)     # float  2.0   <- different type, same value
round(1234, -2)   # int    1200
round(12.5, -1)   # float  10.0  (ties to even: 1 is odd, 0 is even -> 10.0)
```

## Why ties go to even

Rounding half away from zero introduces a systematic upward bias. Over a
column of values whose fractional parts are uniformly distributed, the halves
are the only ties, and always pushing them the same direction means the sum of
the rounded values drifts above the sum of the originals — by half a unit per
tie, forever in the same direction. Round-half-to-even sends ties up and down
roughly equally, so the bias cancels instead of accumulating. This is why it is
called *banker's rounding* and why it is IEEE-754's default rounding mode for
binary floating point.

That is also why it is the wrong rule for a lot of financial work. Accounting
conventions, tax rules and card-network specifications frequently mandate
*round half up* (or *half away from zero*), because a human being must be able
to reproduce the number by hand. Python's default disagrees with them. The
`decimal` module is where you say so explicitly — `ROUND_HALF_UP` is one of its
rounding modes, and `quantize` is how you apply it, covered in
[Decimal for money](10-decimal-for-money.md).

The library reference records the same rule in the numeric-types table, which
is where most people first meet it without noticing:

> *"`round(x[, n])` — x rounded to n digits, rounding half to even. If n is
> omitted, it defaults to 0."*

## The float surprise the docs warn about

Immediately after defining `round()`, the documentation adds a note:

> *"The behavior of `round()` for floats can be surprising: for example,
> `round(2.675, 2)` gives `2.67` instead of the expected `2.68`. This is not a
> bug: it's a result of the fact that most decimal fractions can't be
> represented exactly as a float."*

This is **not** banker's rounding. Banker's rounding only applies to an *exact*
tie, and there is no exact tie here: the `double` nearest the literal `2.675`
is a shade below the true decimal `2.675`, so the nearest two-place multiple is
genuinely `2.67`. `round()` did the correct thing to the number it was given.
The number it was given was not the number in the source code.

The tutorial appendix explains the underlying mechanism and, importantly, that
you cannot pre-round your way out of it:

> *"In base 2, 1/10 is the infinitely repeating fraction
> `0.0001100110011001100110011001100110011001100110011...`"*

> *"Also, since the `0.1` cannot get any closer to the exact value of 1/10 and
> `0.3` cannot get any closer to the exact value of 3/10, then pre-rounding
> with `round()` function cannot help: `round(0.1, 1) + round(0.1, 1) +
> round(0.1, 1) == round(0.3, 1)` … `False`"*

**`round()` is a display and quantisation tool, not an error-correction tool.**
Rounding a float to two places does not give you a value that is exactly two
decimal places; it gives you the nearest `double` to a value that has two
decimal places, which is a different thing and is still not exact.

## When rounding *is* the right comparison tool

The same appendix offers two legitimate uses, and the ordering of its advice
matters:

> *"Though the numbers cannot be made closer to their intended exact values,
> the `math.isclose()` function can be useful for comparing inexact values"*
> … *"Alternatively, the `round()` function can be used to compare rough
> approximations: `round(math.pi, ndigits=2) == round(22 / 7, ndigits=2)` …
> `True`"*

`math.isclose` is the first-line tool because it is relative; `round`-then-compare
is a blunt instrument that is fine when the tolerance is genuinely "to two
decimal places" and wrong when the magnitudes vary. A test that asserts
`round(computed, 2) == round(expected, 2)` passes for `1.0` and `1.004` and
fails for `1.0049999` and `1.005` — a difference ten thousand times smaller.
That is a knife-edge, not a tolerance.

## `__round__`: the protocol underneath

> *"For a general Python object `number`, `round` delegates to
> `number.__round__`."*

`round()` is not a numeric algorithm; it is a dispatcher. `int`, `float`,
`Decimal` and `Fraction` each implement `__round__` with their own semantics,
which is why they do not all behave alike — covered in
[09b](09b-round-per-type-and-double-rounding.md).

The `numbers` ABC makes `__round__` part of what it means to be a real number:

> *"To `Complex`, `Real` adds the operations that work on real numbers. In
> short, those are: a conversion to `float`, `math.trunc()`, `round()`,
> `math.floor()`, `math.ceil()`, `divmod()`, `//`, `%`, `<`, `<=`, `>`, and
> `>=`."*

Implementing it on your own type has one subtlety the built-ins observe and
custom types routinely get wrong: **the no-`ndigits` form must return an `int`,
and the with-`ndigits` form must return your own type.** Signature and
behaviour both:

```python
class Money:
    __slots__ = ("cents",)

    def __init__(self, cents: int) -> None:
        self.cents = cents

    def __round__(self, ndigits=None):
        if ndigits is None:
            # Must return an int, per round()'s contract.
            return round(self.cents / 100)
        # Must return the same type as self.
        step = 10 ** (2 - ndigits)
        if step <= 1:
            return Money(self.cents)
        return Money(round(self.cents / step) * step)
```

If you return a `Money` from the no-argument form, every caller that wrote
`items[round(x)]` breaks, and the error surfaces at the indexing site rather
than at your class.

## `round()` on a `complex` does not exist

`complex` is not a `Real`, and `round()` has nothing to round toward. There is
no `complex.__round__`, so `round(1+2j)` raises `TypeError`. The same applies to
`math.floor`, `math.ceil` and `math.trunc`.

## Gotchas

**★ `round(0.5)` is `0`, and half your test suite assumed `1`.** Ties go to the
even neighbour: `round(0.5)` → `0`, `round(1.5)` → `2`, `round(2.5)` → `2`,
`round(-0.5)` → `0`. This is the documented rule and it is the same rule in
Python 3 for `int` and `float` alike. Code ported from Python 2 is worse off
still — Python 2's `round()` rounded half away from zero, so a 2-to-3 migration
changes results silently at every tie.

**★ `round(2.675, 2)` giving `2.67` is *not* banker's rounding.** It is
representation error: the `double` nearest to `2.675` is below the decimal
`2.675`, so no tie exists. Attributing it to banker's rounding leads people to
"fix" it by switching rounding mode, which does nothing. The only real fix is
not to hold the value as a `float`:

```python
from decimal import Decimal, ROUND_HALF_UP

Decimal("2.675").quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)  # Decimal('2.68')
```

**★ `round(x, 0)` and `round(x)` return different types.** Omitting `ndigits`
returns an `int`; passing `0` returns *"the same type as number"*. A refactor
that adds an explicit `0` "for clarity" changes a return type, and the failure
appears wherever the value is used as an index, a `range()` bound, or a JSON
integer.

**★ Negative `ndigits` is legal and is nobody's first guess.** `round(1234, -2)`
is `1200`. This is genuinely useful for bucketing, and genuinely confusing when
a variable holding a digit count goes negative by accident — there is no error,
just an answer rounded to the nearest hundred.

**★ Ties-to-even applies to negative `ndigits` too.** `round(2500, -3)` rounds
to the even multiple of 1000, which is `2000`, not `3000`. Bucketing code that
assumed "round up on a half" produces a distribution with a visible notch.

**★ `round()` cannot repair accumulated float error, and the tutorial says so.**
*"pre-rounding with `round()` function cannot help."* Rounding each addend to
one place before summing does not make the sum equal the rounded total. If the
invariant matters, the values must be exact — `Decimal` or integer minor units
— before the arithmetic, not after.

**★ `round(computed, 2) == round(expected, 2)` is a knife-edge, not a
tolerance.** Two values a millionth apart can straddle a rounding boundary and
compare unequal. Use `math.isclose(a, b, rel_tol=..., abs_tol=...)`, which the
tutorial recommends first, and reach for round-and-compare only when the
requirement really is stated in decimal places.

**★ A custom `__round__` that ignores the `ndigits=None` contract breaks
callers, not itself.** `round(obj)` must produce an `int`. If yours returns
your own type, the `TypeError` appears at `items[round(obj)]` in code that has
never heard of your class.

**★ `round()` on a `complex` raises `TypeError`.** `complex` is not registered
as a `Real`, so it implements none of `__round__`, `__floor__`, `__ceil__` or
`__trunc__`. If a value might be complex, round `abs(z)` or `z.real`
deliberately.

## Interview questions

**★ What is `round(0.5)`, and why?**
`0`. Python rounds half to even, so ties go to the nearest even multiple rather
than away from zero. The docs give the exact examples: *"both `round(0.5)` and
`round(-0.5)` are `0`, and `round(1.5)` is `2`."* The rationale is bias: always
rounding halves the same direction makes a column of rounded values drift
upward, while sending them alternately up and down cancels.

**★ Explain `round(2.675, 2) == 2.67` to someone who thinks it is a bug.**
It is not a tie, so banker's rounding is irrelevant. The literal `2.675` cannot
be represented exactly as a binary `double`; the nearest representable value is
slightly *below* the true decimal `2.675`, so the closest two-place multiple
really is `2.67`. `round()` answered correctly about the value it was handed.
The documentation calls this out explicitly and says *"This is not a bug."*

**★ How would you get `2.68`?**
Do not use a `float`. `Decimal("2.675").quantize(Decimal("0.01"),
rounding=ROUND_HALF_UP)` gives `Decimal('2.68')`, because `Decimal('2.675')` is
exactly the value written, so the tie is real and the chosen mode resolves it
upward. Note that both changes are needed: the exact type *and* the explicit
mode, since `Decimal`'s default rounding is also half-to-even.

**★ What does `round(x)` return, and what does `round(x, 0)` return?**
`round(x)` returns an `int`; `round(x, 0)` returns *"the same type as number"*,
so a `float` in, a `float` out. Same numeric value, different type, and only
one of them is usable as an index. The docs state both halves of this in the
same sentence, and it is still the most common `round()` surprise after
ties-to-even.

**★ Is `round()` a method or a function, and where does the behaviour actually
live?**
It is a built-in function that dispatches: *"For a general Python object
`number`, `round` delegates to `number.__round__`."* The semantics belong to
the type. That is why `float`, `Decimal` and `Fraction` do not round
identically, and why a custom type can participate at all.

**★ Why does the tutorial say pre-rounding cannot help?**
Because rounding a `float` produces another `float`, and the target value may
be no more representable than the original. `round(0.1, 1)` is still not
exactly one tenth, so summing three of them still does not equal
`round(0.3, 1)` — the docs give exactly that expression and say it is `False`.
Rounding changes which inexact value you hold; it does not make any value
exact.

**★ Python 2's `round()` behaved differently. How?**
Python 2 rounded halves away from zero and always returned a `float`. Python 3
rounds half to even and returns an `int` when `ndigits` is omitted. A 2-to-3
port therefore changes both the value at every tie and the return type of the
common one-argument call, and neither change raises anything.

---

← Prev: [Float modulo, fmod and remainder](08e-float-modulo-fmod-and-remainder.md) · Index: [Numbers](README.md) · Next → [round() per type, and double rounding](09b-round-per-type-and-double-rounding.md)

{/* FOOTER */}
