---
title: "There is no ceiling operator, so you write -(-a // b) — and every route through / instead of // silently drops integer exactness"
sidebar_label: "8b · Ceiling division and exactness"
sidebar_position: 81
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Python 3.14 language reference
> [Binary arithmetic operations](https://docs.python.org/3.14/reference/expressions.html#binary-arithmetic-operations),
> the library reference
> [Numeric Types — int, float, complex](https://docs.python.org/3.14/library/stdtypes.html#numeric-types-int-float-complex)
> and [`math`](https://docs.python.org/3.14/library/math.html).
> Version spine: **Python 3.14.7**.

**Python gives you a floor operator and no ceiling operator, and the two
substitutes people reach for are both broken. `math.ceil(a / b)` leaves the
integer domain — `a / b` is a `float`, so the answer is rounded to 53 bits and
raises `OverflowError` once the operands are big enough. `(a + b - 1) // b` is
only valid for a positive divisor. The correct form is `-(-a // b)`, which is
exact at any magnitude and correct for every sign. The general principle is
worth more than the idiom: `//` never leaves the integer domain and `/` always
does, so any integer computation routed through `/` has already lost, whatever
you do to the result afterwards.**

## Ceiling division, done correctly

```python
def ceil_div(a: int, b: int) -> int:
    """Exact ceiling division for ints of any sign and any magnitude."""
    return -(-a // b)
```

This works because `-⌊-a/b⌋ == ⌈a/b⌉` identically, for every sign combination.
It stays inside integer arithmetic, so it is exact for arbitrarily large
integers — which matters, because `int` has unlimited precision and `float`
does not:

> *"Integers have unlimited precision. Floating-point numbers are usually
> implemented using `double` in C."*

`ceil_div` is what you want for page counts, batch counts, chunk counts, and
anything of the shape "how many buckets do I need":

```python
pages   = ceil_div(total_rows, page_size)
batches = ceil_div(len(items), batch_size)
```

## The two wrong versions, and exactly how they fail

```python
math.ceil(a / b)
```

`a / b` on two `int`s produces a `float` — the language reference is explicit:
*"Division of integers yields a float."* Two consequences follow. First, if the
true quotient needs more than 53 significant bits, the `float` is a rounded
approximation and `math.ceil` faithfully ceilings the *wrong number*. Second, if
the quotient exceeds the range of a `double` at all, the division raises
`OverflowError` before `math.ceil` is even called. Both failures are invisible
in tests written with small numbers, which is every test anyone writes for a
page-count helper.

```python
(a + b - 1) // b
```

This is the classic C idiom, and in Python it is correct only when `b > 0`. For
a negative `b` it computes the wrong value, because adding `b - 1` moves the
numerator the wrong way. (In C it has a second failure mode — `a + b - 1` can
overflow — which Python's unbounded `int` removes, so the Python version is
merely wrong rather than undefined.) If you insist on keeping it, assert its
precondition:

```python
assert b > 0
n = (a + b - 1) // b
```

`-(-a // b)` has no precondition, so there is nothing to assert and nothing to
forget.

## Floor has the same trap

`a // b` is the floor. `math.floor(a / b)` is the bug, for identical reasons.
The `math` functions are for *converting a float you already have*; they are
not the way to combine two integers. From the `math` docs:

> *"Return the floor of x, the largest integer less than or equal to x. If x
> is not a float, delegates to `x.__floor__`, which should return an Integral
> value."*

That delegation is the whole story. `math.floor(Fraction(7, 2))` is exact,
because the `Fraction` handles it itself through `__floor__` and no `float` is
ever constructed. `math.floor(7 / 2)` is *not* exact in general, because the
`float` was constructed before `math` was called. The function is innocent; the
argument expression is the bug.

The same delegation note appears on `math.ceil` (*"delegates to `x.__ceil__`"*)
and `math.trunc` (*"delegates to `x.__trunc__`"*), so all three are safe on
exact types and unsafe on a `/` result.

## Where the 53-bit boundary actually is

`math` spells out the threshold above which a `float` cannot hold a fractional
part at all:

> *"Python floats typically carry no more than 53 bits of precision (the same
> as the platform C `double` type), in which case any float `x` with
> `abs(x) >= 2**52` necessarily has no fractional bits."*

So a `float` quotient stops being able to express "just over" or "just under"
an integer somewhere around 2⁵², and `ceil` and `floor` become no-ops on
values above it. Any code that computes a ceiling of a ratio of large integers
— byte offsets in a multi-terabyte file, nanosecond timestamps, IDs from a
Snowflake-style generator — is inside that range already. Use `-(-a // b)`.

## Gotchas

**★ `math.ceil(a / b)` and `math.floor(a / b)` destroy integer exactness.**
The division happens in `float` before `math` ever sees it, so the result is
rounded to 53 bits, and for large enough operands `a / b` raises
`OverflowError` outright. Use `a // b` and `-(-a // b)`, which stay in the
integer domain and are exact at any magnitude.

**★ `(a + b - 1) // b` is wrong for a negative divisor.** The idiom is valid
only for `b > 0`. Since `-(-a // b)` is the same number of characters and has
no precondition, there is no reason to keep the fragile version — but if you
inherit it, add `assert b > 0` rather than assuming the caller.

**★ The rounding error is silent above 2⁵² and loud above ~1.8 × 10³⁰⁸.**
Two different failures from the same expression: in the middle range you get a
wrong number with no signal, and only at the top of `double`'s range do you get
`OverflowError`. Teams routinely "fix" the `OverflowError` by catching it,
which leaves the silent-wrong-number range untouched.

**★ `math.floor` and `math.ceil` are safe on `Fraction` and `Decimal` and
unsafe on a `/` expression.** The delegation to `__floor__` / `__ceil__` means
the exact type does the work. This makes the *function* look trustworthy and
teaches the wrong lesson; the danger was never `math.floor`, it was the `/`
inside its argument.

**★ `ceil_div` on a `float` input silently becomes float arithmetic.**
`-(-a // b)` with `a` or `b` a `float` returns a whole-valued `float`, not an
`int`, and inherits every float imprecision. If the helper is public, annotate
it `int` and consider `if not isinstance(a, int): raise TypeError` — a type
annotation alone is not enforcement.

## Interview questions

**★ How do you do ceiling division of two integers exactly?**
`-(-a // b)`. It stays in the integer domain, so it is exact for arbitrarily
large operands and correct for every sign combination. `math.ceil(a / b)` first
computes a `float` quotient, which rounds at 53 bits of precision and raises
`OverflowError` once the operands are large enough. `(a + b - 1) // b` is
correct only for `b > 0`.

**★ Why is `math.floor(a / b)` not the same as `a // b`?**
For small ints they agree, and that is exactly what makes it dangerous. `a / b`
converts to `float` first — the reference says *"Division of integers yields a
float"* — so once the exact quotient needs more than 53 significant bits, or
once it exceeds the range of a `double`, `math.floor` is operating on an
approximation or the division has already raised. `a // b` never leaves the
integer domain and is exact at any size.

**★ Then when *is* `math.floor` the right function?**
When you already hold a non-integer value and want an `Integral` from it:
flooring a `float` measurement, or flooring an exact `Fraction` or `Decimal`,
where the docs' delegation to `__floor__` keeps the operation exact. It is the
wrong tool only when its argument is a division you could have written with
`//`.

**★ At roughly what magnitude does `math.ceil(a / b)` stop being able to give
the right answer even in principle?**
Around 2⁵². The `math` docs note that *"any float `x` with `abs(x) >= 2**52`
necessarily has no fractional bits"*, so above that a `float` quotient is
already an integer and `ceil` cannot round it up. Below that the error is
smaller but still present whenever the quotient needs more than 53 significant
bits.

**★ Why does `-(-a // b)` work for negative operands when the `(a + b - 1)`
idiom does not?**
Because negation is exact and floor and ceiling are reflections of each other
through zero: `⌈a/b⌉ == -⌊-a/b⌋` is an algebraic identity with no sign
condition. The `(a + b - 1)` form encodes an *assumption* about which direction
the bias should go, and that assumption is tied to `b` being positive.

---

← Prev: [Floor division and modulo](08-floor-division-and-modulo.md) · Index: [Numbers](README.md) · Next → [Zero divisors, result types and the operator protocol](08c-zero-divisors-and-the-operator-protocol.md)

{/* FOOTER */}
