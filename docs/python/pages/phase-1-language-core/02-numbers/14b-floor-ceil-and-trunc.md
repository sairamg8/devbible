---
title: "math.floor and math.ceil return integers and delegate to a protocol method, so they are exact where the // operator is merely type-preserving — and on Decimal they disagree about the value, not just the type"
sidebar_label: "14b · floor and ceil vs //"
sidebar_position: 141
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Python 3.14
> [`math`](https://docs.python.org/3.14/library/math.html) reference (`floor`,
> `ceil`, `modf`, and the note on large-magnitude floats),
> [Built-in Functions](https://docs.python.org/3.14/library/functions.html)
> (`divmod`),
> [Numeric Types](https://docs.python.org/3.14/library/stdtypes.html#numeric-types-int-float-complex)
> note 1 on floor division, and
> [Emulating numeric types](https://docs.python.org/3.14/reference/datamodel.html#emulating-numeric-types)
> (`__floor__`, `__ceil__`).
> Version spine: **Python 3.14.7**.

**`math.floor` and `math.ceil` are two of the three exceptions to everything
[14](14-math-vs-the-operators.md) says about `math`: they return integers rather
than floats, and for a non-float argument they do not convert at all — they call
a method on the object. That makes them exact at any magnitude and makes them an
extension point a custom numeric type can hook. It also means they disagree with
the operator that looks equivalent. `math.floor(x)` returns an `int` where
`x // 1` returns the operand's type; on a `Decimal` the two produce genuinely
different *values* on negatives; and `math.floor(a / b)` is not `a // b` for
large integers, because the `/` already happened.
[14c](14c-trunc-int-and-the-remainder-family.md) is `trunc`, `int()` and the
3.14 protocol change.**

## `math.floor` and `math.ceil` versus `//`

The functions:

> *"Return the floor of x, the largest integer less than or equal to x. If x is
> not a float, delegates to `x.__floor__`, which should return an `Integral`
> value."*

> *"Return the ceiling of x, the smallest integer greater than or equal to x. If
> x is not a float, delegates to `x.__ceil__`, which should return an
> `Integral` value."*

The operator, from the `stdtypes` note on floor division:

> *"For operands of type `int`, the result has type `int`. For operands of type
> `float`, the result has type `float`. In general, the result is a whole
> integer, though the result's type is not necessarily `int`. The result is
> always rounded towards minus infinity: `1//2` is `0`, `(-1)//2` is `-1`,
> `1//(-2)` is `-1`, and `(-1)//(-2)` is `0`."*

Both floor. They differ on **type**, and on **who they ask**:

```python
math.floor(7.5)      # 7    - an int
7.5 // 1             # 7.0  - a float
math.floor(-7.5)     # -8   - an int
-7.5 // 1            # -8.0 - a float

math.floor(Decimal('-7.5'))       # -8, an int, via Decimal.__floor__
Decimal('-7.5') // 1              # Decimal('-7') - Decimal's // truncates
```

That last pair is the one that costs money. `Decimal`'s `//` follows the decimal
arithmetic specification, which truncates toward zero rather than flooring, so
on negatives `math.floor` and `//` give **different values**, not merely
different types — see [08](08-floor-division-and-modulo.md).

There is a precision difference in the other direction too. For a large `int`,
`math.floor(n)` delegates to the integer's own `__floor__` and never touches a
float, so it is exact at any magnitude; `n // 1` is also exact, because it is
integer arithmetic. But `math.floor(n / 1)` is not, because the `/` produced a
float first. **The moment a `/` appears you are in float space**, whatever you
wrap around it.

### The `__floor__` and `__ceil__` protocol

The delegation is a documented extension point, not an implementation
accident:

> *"`object.__floor__(self)` — Called to implement `math.floor()`. Should return
> an `Integral` value."*

> *"`object.__ceil__(self)` — Called to implement `math.ceil()`, and used by
> `math.ceil()`. Should return an `Integral` value."*

So a custom numeric type gets `math.floor` support from one method, and
`Decimal` and `Fraction` both implement these hooks — which is why `math.floor`
on either is exact rather than going through a lossy conversion:

```python
from fractions import Fraction

math.floor(Fraction(10**40, 3))   # exact int - Fraction.__floor__ does the work
float(Fraction(10**40, 3))        # a float; the low-order digits are gone
```

The delegation is documented as happening *"if x is not a float"*, and that
clause has a sharp edge: a **subclass of `float`** is a float, so its
`__floor__` override is not reached. A units-carrying `class Metres(float)` that
defines `__floor__` to preserve the unit will find `math.floor` handing back a
plain `int` anyway. Composition survives this; subclassing `float` does not.

### The 2\*\*52 note, quoted

The docs attach a warning to this family that reads like trivia and is not:

> *"For the `ceil()`, `floor()`, and `modf()` functions, note that *all*
> floating-point numbers of sufficiently large magnitude are exact integers.
> Python floats typically carry no more than 53 bits of precision (the same as
> the platform C double type), in which case any float x with `abs(x) >= 2**52`
> necessarily has no fractional bits."*

So `math.ceil(x) == math.floor(x)` for every float at or above 2\*\*52, and a
"round up to the next whole unit" step becomes a silent no-op on large inputs.
That is a property of binary64, not of the functions —
[08b](08b-ceiling-division-and-integer-edges.md) shows where the boundary lands
in practice.

### And `divmod` is a third answer again

The `divmod` documentation adds a case where the operator and the `math`
function disagree in *value* on ordinary floats:

> *"For floating-point numbers the result is `(q, a % b)`, where q is usually
> `math.floor(a / b)` but may be 1 less than that."*

So `a // b` and `math.floor(a / b)` are not interchangeable even inside float
space, which is easy to miss because the docs phrase it as a property of
`divmod` rather than of `//`.
[08e](08e-float-modulo-fmod-and-remainder.md) works through why.

## Gotchas

**★ `math.floor(x)` returns an `int` and `x // 1` returns the operand type, so
swapping one for the other changes what your function returns.** A helper
documented as returning an `int` starts returning a `float` after an innocuous
refactor, and every caller keeps working until the value is used as an index, a
`range` bound or a dict key — where a float is a `TypeError` or a distinct key.

**★ `math.floor` and `//` disagree in *value*, not just type, on `Decimal`.**
`Decimal`'s `//` truncates toward zero per the decimal arithmetic specification;
`math.floor` floors via `Decimal.__floor__`. On negatives they differ by one. If
a rounding rule is being ported between a float pipeline and a `Decimal`
pipeline, this is exactly where a cent goes missing.

**★ `math.floor(a / b)` is not `a // b` for large integers, and not reliably
even for floats.** For `int`s, the `/` converts to float first and is wrong
above 2\*\*53. For floats, the `divmod` docs say the floored quotient *"may be 1
less"* than `math.floor(a / b)`. Two expressions that read identically have two
different failure modes.

**★ `math.ceil(x) == math.floor(x)` for every float at or above 2\*\*52.** There
are no fractional bits left to round, so a "round up to the next whole unit"
step is a silent no-op on large inputs. The docs state it directly for `ceil`,
`floor` and `modf`, and it is a property of binary64 rather than of the
functions.

**★ `math.floor` is not called for a `float` subclass that overrides
`__floor__`.** The delegation is documented as happening *"if x is not a
float"*, and a `float` subclass **is** a float. A units-carrying class built by
subclassing `float` silently loses its type through `math.floor` and
`math.ceil`. Wrap a float; do not subclass one.

**★ `__floor__` returning a non-`Integral` value is a latent bug the docs warn
about but nothing enforces.** The data model says it *"should return an
`Integral` value"*, and `math.floor` passes through whatever it gets. A
`__floor__` that returns a `Decimal` for convenience makes `math.floor` return a
`Decimal`, which quietly violates every caller's assumption that `math.floor`
gives an `int`.

**★ `math.ceil` has no operator.** There is no ceiling-division operator in
Python, and the two common hand-rolled versions — `math.ceil(a / b)` and
`int(a / b) + 1` — are both wrong for large integers and for negatives
respectively. The correct integer form is `-(-a // b)`, and
[08b](08b-ceiling-division-and-integer-edges.md) shows exactly how the
alternatives fail.

## Interview questions

**★ Why does `math.floor(7.5)` return `7` but `7.5 // 1` return `7.0`?**
Because they answer different questions. `math.floor` is documented to return an
integral value and, for non-floats, to delegate to `__floor__`, which *"should
return an `Integral` value"*. Floor division is an operator dispatched to the
operand's type, and its documented rule is that *"for operands of type `float`,
the result has type `float`"*. The values agree; the types do not, and the type
is what breaks a caller that uses the result as an index.

**★ How does a custom numeric class get `math.floor` support?**
By implementing `__floor__`, documented as *"Called to implement
`math.floor()`"* and required to return an `Integral` value. `math.floor`
delegates to it for any argument that is not a `float`, and `__ceil__` does the
same for `math.ceil`. It only works for a class that is not a `float` subclass,
since the delegation is documented as happening *"if x is not a float"* — so the
design that survives is a wrapper holding a float, not a subclass of one.

**★ Why is `math.floor(Fraction(10**40, 3))` exact when `math.sqrt` of the same
value is not?**
Because `math.floor` never converts. The docs say it delegates to `__floor__`
for a non-float argument, and `Fraction.__floor__` does exact integer
arithmetic on the numerator and denominator. `math.sqrt` has no such hook: it
falls under the module-wide rule that arguments are converted and results are
floats, so the `Fraction` is narrowed to 53 bits before the square root is even
attempted. The presence or absence of a protocol hook is the whole difference.

**★ You need "the number of pages" from `items` and `per_page`, both `int`.
Write it.**
`-(-items // per_page)`. `math.ceil(items / per_page)` converts to float for the
division and is wrong once `items` exceeds 2\*\*53, and it raises `OverflowError`
for genuinely huge counts. The negation trick stays in exact integer arithmetic
because `//` on two `int`s is documented to return an `int` floored toward minus
infinity, and flooring the negation is ceiling the original.

**★ `math.floor` on a `Decimal` and `Decimal // 1` give different answers for
`Decimal('-7.5')`. Which is "right"?**
Both, for their own specification. `math.floor` is defined as the largest
integer less than or equal to `x`, so `-8`. `Decimal`'s `//` implements the
decimal arithmetic specification's `divide-integer`, which truncates toward
zero, so `Decimal('-7')`. The lesson is that "integer division" is not one
operation — `Decimal` deliberately does not match `int` and `float` here, which
is covered in [08](08-floor-division-and-modulo.md), and any code that switches
a pipeline from `float` to `Decimal` inherits the change silently.

---

← Prev: [math vs the operators](14-math-vs-the-operators.md) · Index: [Numbers](README.md) · Next → [trunc, int() and the remainder family](14c-trunc-int-and-the-remainder-family.md)

{/* FOOTER */}
