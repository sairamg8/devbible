---
title: "Decimal refuses to do arithmetic with float and will happily compare with it, and every function in math hands you a float back"
sidebar_label: "10h · Decimal and other numerics"
sidebar_position: 107
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`Decimal` objects](https://docs.python.org/3.14/library/decimal.html#decimal-objects),
> [`FloatOperation`](https://docs.python.org/3.14/library/decimal.html#decimal.FloatOperation),
> [Special values](https://docs.python.org/3.14/library/decimal.html#special-values),
> [`math`](https://docs.python.org/3.14/library/math.html),
> [`fractions`](https://docs.python.org/3.14/library/fractions.html) and
> [Hashing of numeric types](https://docs.python.org/3.14/library/stdtypes.html#hashing-of-numeric-types).
> Version spine: **Python 3.14.7**.

**The type boundary around `Decimal` is deliberately asymmetric. Arithmetic with
`float` raises `TypeError` — the module refuses to guess whether you meant the
decimal value or the binary one. Comparison with `float` is fully supported and
exact, and never raises. Arithmetic with `int` is allowed everywhere. The
asymmetry is defensible, but it means the operation most likely to smuggle a float
into your money — `if amount == 0.0` — is the one the type system does not
police, and `math.sqrt` will convert your exact value to a double and hand back a
float with no complaint at all.**

## `int` yes, `float` no, `Fraction` no

> *"`Decimal` objects cannot generally be combined with floats or instances of
> `fractions.Fraction` in arithmetic operations: an attempt to add a `Decimal` to
> a `float`, for example, will raise a `TypeError`."*

```python
from decimal import Decimal
from fractions import Fraction

Decimal('1.10') * 3            # Decimal('3.30')  — int is exact, always allowed
Decimal('1.10') + 0.1          # TypeError
Decimal('1.10') + Fraction(1, 10)   # TypeError
```

Integers are permitted because they are exact and convert without a decision.
The same holds on the context API: *"Each `Context` method accepts a Python
integer (an instance of `int`) anywhere that a `Decimal` instance is accepted."*
`bool` is an `int` subclass, so `Decimal('1.00') * True` is `Decimal('1.00')` —
legal, and a sign that something upstream lost a type.

`float` and `Fraction` are refused because there is no single right answer:
`Decimal('0.1') + 0.1` could reasonably mean the exact decimal sum or the sum of
the two exact binary values, and the two differ. The module makes you say which by
converting explicitly.

## Comparison is supported, exact, and does not raise

> *"However, it is possible to use Python's comparison operators to compare a
> `Decimal` instance `x` with another number `y`. This avoids confusing results
> when doing equality comparisons between numbers of different types."*

> *"Changed in version 3.2: Mixed-type comparisons between `Decimal` instances and
> other numeric types are now fully supported."*

```python
Decimal('0.1') == 0.1          # False — 0.1 is the binary value, which is larger
Decimal('0.5') == 0.5          # True  — 0.5 is exactly representable in binary
Decimal('1.10') > 1.0          # True
```

Both comparisons are exact: the float is not rounded to the decimal, nor the
decimal to a float. `Decimal('0.1') == 0.1` is `False` because the two really are
different numbers — which is the *correct* answer and a surprising one for anyone
who wrote the float expecting it to mean one tenth.

Equality also holds across the numeric types for hashing:

> *"For numbers `x` and `y`, possibly of different types, it's a requirement that
> `hash(x) == hash(y)` whenever `x == y`"* — and Python's numeric hash *"applies to
> all instances of `int` and `fractions.Fraction`, and all finite instances of
> `float` and `decimal.Decimal`"*.

So a `dict` keyed by amounts behaves consistently across types, and `Decimal('1')`,
`1` and `1.0` collide as one key. Note the qualifier **finite**: the rule is stated
for finite instances, and `Decimal('NaN')` is unhashable-adjacent territory — it
hashes, but it is never equal to itself, so it can be inserted into a `set`
repeatedly.

## Converting deliberately

When a float genuinely is the source of truth — a rate from a scientific library,
a reading from hardware, a legacy JSON number you cannot change — convert
explicitly, so the intent is in the source and the `FloatOperation` flag stays
meaningful:

```python
from decimal import Decimal, Context, ROUND_HALF_UP
import math

rate = 0.0725

Decimal.from_float(rate)          # exact binary expansion, 50+ digits
Context(prec=6, rounding=ROUND_HALF_UP).create_decimal_from_float(rate)   # rounded in
Decimal.from_number(rate)         # 3.14+: accepts float, int or Decimal
```

`create_decimal_from_float` is documented as *"Creates a new `Decimal` instance
from a float `f` but rounding using self as the context. Unlike the
`Decimal.from_float()` class method, the context precision, rounding method, flags,
and traps are applied to the conversion"* — with the documented example that
`Context(prec=5, traps=[Inexact]).create_decimal_from_float(math.pi)` raises
`Inexact`, which is a neat way to say "convert this, but only if it fits".

Going the other way, `float(d)` and `int(d)` both silently discard guarantees:
`float` reintroduces binary representation error, and `int` truncates toward zero.
Neither raises, neither sets a flag.

## `FloatOperation`: making accidental float contact loud

By default, mixing is silent but *recorded*:

> *"If the signal is not trapped (default), mixing floats and Decimals is
> permitted in the `Decimal` constructor, `create_decimal()` and all comparison
> operators. Both conversion and comparisons are exact. Any occurrence of a mixed
> operation is silently recorded by setting `FloatOperation` in the context flags.
> Explicit conversions with `from_float()` or `create_decimal_from_float()` do not
> set the flag. Otherwise (the signal is trapped), only equality comparisons and
> explicit conversions are silent. All other mixed operations raise
> `FloatOperation`."*

Trap it in your test suite and in staging, and you get a hard failure the first
time a float reaches the money layer:

```python
from decimal import getcontext, FloatOperation

getcontext().traps[FloatOperation] = True
# Decimal(3.14)          -> raises FloatOperation (a TypeError subclass)
# Decimal('3.5') < 3.7   -> raises FloatOperation
# Decimal('3.5') == 3.5  -> still True; equality stays silent by design
```

The equality carve-out is deliberate and is the one hole: `==` against a float
never raises even when trapped, so a comparison-based branch can still let a float
through. Everything else — the constructor, ordering comparisons, arithmetic —
raises.

## Gotchas

**★ Trapping `FloatOperation` does not catch `==`.** Equality against a float stays
silent even with the trap set. If a float leaks in through an equality branch —
`if amount == 0.0:` — the trap will not tell you.

**★ `float(some_decimal)` throws the guarantee away silently.** No warning,
no flag, no exception — you get a double and every representation problem
`Decimal` was there to prevent. It usually happens inside a library call you did
not write: `json.dumps(default=float)`, a chart renderer, `numpy`, `math.sqrt`.
Search for the boundary, not for the bug.

**★ `Decimal('2.50') == Decimal('2.5')` is `True`, but they are not
interchangeable.** They are numerically equal and hash equal, so a `set` or `dict`
sees one value. But `str()` differs, `as_tuple()` differs, and `compare_total`
orders them apart. Anything built from `str(amount)` — an idempotency key, a
signature payload, a cache key — diverges between two paths that computed the same
amount. Normalise the *representation* with `quantize`, not just the value.

**★ `Decimal.from_number` is 3.14 or later.** On 3.13 it is an `AttributeError`
raised at call time, not import time, so a rarely-exercised branch passes CI on
3.14 and fails in production on 3.13. If you support both, use `Decimal.from_float`
(3.1+) with an `isinstance` check for the already-a-`Decimal` case.

**★ `IEEEContext(64)` is not "64 bits of precision".** The argument names an IEEE
754 decimal *interchange format* width: `IEEEContext(64)` is `decimal64`, which is
16 significant digits — considerably fewer than the default context's 28. Choosing
it because 64 sounded generous silently reduces precision
([10b](10b-contexts-precision-and-signals.md)).

**★ `bool` passes every `int` check.** `Decimal('10.00') * True` is legal and
returns the amount. A boolean that arrived where a quantity was expected produces
a plausible number instead of an error ([04](04-bool-is-an-int.md)).

## Interview questions

**★ What is `FloatOperation` for, and how would you deploy it?**
It converts accidental float/Decimal mixing from a silent event into a loud one.
Untrapped, mixing is permitted and merely sets a flag; trapped, the constructor,
ordering comparisons and mixed arithmetic all raise — and because
`FloatOperation` subclasses `TypeError` as well as `DecimalException`, it reads
naturally as a type error. Deploy it as `getcontext().traps[FloatOperation] = True`
in your test configuration so CI fails on the first float that reaches the money
layer, while production keeps the flag-only behaviour. Note the carve-out:
equality comparisons and explicit `from_float` conversions stay silent even when
trapped.

**★ Why does `Decimal + float` raise while `Decimal < float` works?**
Because addition would have to pick a meaning and comparison does not.
`Decimal('0.1') + 0.1` could mean the exact decimal sum or the sum of the two
exact underlying values, and the two answers differ; rather than guess, the module
refuses and makes you convert explicitly. Comparison has one correct answer — the
two exact values either are equal or one is larger — so it is fully supported
since 3.2 and is performed exactly, without rounding either operand. The practical
consequence is that the type system stops accidental float arithmetic but not
accidental float *comparison*, which is why `FloatOperation` exists.

**★ Why is `Decimal('0.1') == 0.1` `False` but `Decimal('0.5') == 0.5` `True`?**
Because the comparison is exact and the two floats are different kinds of value.
`0.5` is a binary fraction — one half — so the double is exactly one half and
equals `Decimal('0.5')`. `0.1` is not representable in binary; the double is
slightly larger than one tenth, so it is not equal to the exact decimal one tenth.
The comparison is telling you the truth about the float, which is usually the
first time anyone finds out.

**★ When would you construct a `Decimal` from a float on purpose?**
When a float genuinely is the source of truth and no exact decimal exists upstream
— a rate from a scientific library, a hardware measurement, a JSON number from a
service you do not control. Then use `Decimal.from_float` or
`Context.create_decimal_from_float` so the conversion is explicit in the source
and does not set the `FloatOperation` flag, which you want reserved for
*accidental* contact. Round it at the boundary to the precision the value actually
carries, rather than dragging fifty digits of binary noise through the
calculation.

**★ What is `Decimal.from_number` and how does it differ from `from_float`?**
New in 3.14, it accepts `float`, `int` or `Decimal` — but *"not strings or
tuples"* — and returns a `Decimal`, so passing one through is a no-op. That makes
it the constructor for a normalising helper whose signature promises a number,
with the useful property that it refuses `"19.99"` from a request body.
`from_float` (3.1+) accepts only `float` and `int`, so pre-3.14 code needs an
`isinstance` check to handle the already-a-`Decimal` case.

---

← Prev: [Tax, percentages and minor units](10g-tax-percentages-and-minor-units.md) · Index: [Numbers](README.md) · Next → [Special values and the rest of the stdlib](10i-special-values-and-stdlib-interop.md)

{/* FOOTER */}
