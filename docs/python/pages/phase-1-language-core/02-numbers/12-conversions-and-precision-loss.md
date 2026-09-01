---
title: "Every numeric conversion either preserves the value, rounds it or truncates it — and Python tells you which only sometimes, because only range errors raise"
sidebar_label: "12 · Conversions and precision loss"
sidebar_position: 120
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`int()`](https://docs.python.org/3.14/library/functions.html#int),
> [`float()`](https://docs.python.org/3.14/library/functions.html#float),
> [`round()`](https://docs.python.org/3.14/library/functions.html#round),
> [`math`](https://docs.python.org/3.14/library/math.html),
> [`decimal`](https://docs.python.org/3.14/library/decimal.html) and
> [`fractions`](https://docs.python.org/3.14/library/fractions.html),
> plus the language reference on
> [comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons).
> Version spine: **Python 3.14.7**; `int()` no longer delegating to `__trunc__` is
> **new in 3.14**.

**Python has four numeric types and twelve conversions between them, and each one is
exactly one of three things: value-preserving, rounding, or truncating. Which one it
is depends on the *pair*, not on any general rule about "converting numbers" — going
from `float` to `Decimal` is exact and going back is not; going from `int` to `float`
is exact up to `2**53` and rounds above it. The dangerous asymmetry is in what Python
tells you: a conversion that leaves the *range* of the target raises, and a conversion
that merely loses *precision* is silent. `float(10**400)` is an `OverflowError`;
`float(10**30 + 1)` quietly gives you a different number.**

## The rule underneath all of it

The language reference settles every mixed comparison with one sentence: *"A
comparison between numbers of different types behaves as though the exact values of
those numbers were being compared."*

That is stronger than it looks. Comparing an `int` to a `float` does **not** convert
the `int` to a float and compare; it compares the two exact rational values, so the
answer is mathematically correct even where a conversion would have been lossy:

```python
10**30 + 1 == float(10**30 + 1)      # False — the float rounded, the comparison did not
10**30 + 1 > float(10**30)           # True  — exact, at any magnitude
```

Comparison is exact. **Conversion is not.** Every precision problem in this chunk
lives in that gap.

## The conversion matrix

| From → to | `int` | `float` | `Decimal` | `Fraction` |
|---|---|---|---|---|
| **`int`** | — | exact `< 2**53`, else **rounds**; `OverflowError` if out of range | exact | exact |
| **`float`** | **truncates** toward zero | — | exact *(the binary value, not the decimal you typed)* | exact *(same caveat)* |
| **`Decimal`** | **truncates** toward zero | **rounds** | — | exact |
| **`Fraction`** | **truncates** toward zero | **rounds** | **rounds** (via the context) | — |

Read the "exact" cells carefully. `Decimal(0.1)` is exact — exactly the binary value
the float holds, which is not `0.1`. Faithfulness to the source and agreement with
your intent are different properties, and this table only promises the first.

## int() truncates, and in 3.14 it stopped asking `__trunc__`

*"For floating-point numbers, this truncates towards zero."*

Truncation is not rounding and it is not flooring. For positives the three agree; for
negatives all three differ:

```python
import math
int(-7.5)          # -7   toward zero
math.floor(-7.5)   # -8   toward minus infinity
math.trunc(-7.5)   # -7   toward zero — the explicit spelling
round(-7.5)        # -8   nearest, ties to even
math.ceil(-7.5)    # -7   toward plus infinity
```

`int(-7.5)` and `math.floor(-7.5)` differing by one is the single most common
off-by-one in numeric Python, and it is invisible in any test whose fixtures are all
positive. Say which you mean: `math.floor` when you want the floor, `math.trunc` when
you want truncation and want a reader to see it.

The protocol changed in 3.14:

> *"Changed in version 3.14: `int()` no longer delegates to the `__trunc__()` method."*

`int(x)` now uses `__int__()`, falling back to `__index__()` since 3.8. A custom
numeric type that implemented **only** `__trunc__` used to convert and now raises
`TypeError`. If you own such a type, add `__int__`; if you consume one from a
dependency, this is a real 3.14 upgrade break and it surfaces as a `TypeError` at the
`int()` call, not at the class definition.

```python
class Meters:
    def __init__(self, v): self.v = v
    def __trunc__(self): return int(self.v)     # was enough before 3.14
    def __int__(self): return int(self.v)       # required from 3.14
```

`math.trunc()` still uses `__trunc__` — it is `int()` specifically that stopped.

## int() on the non-finite values

```python
int(float('inf'))     # OverflowError: cannot convert float infinity to integer
int(float('nan'))     # ValueError: cannot convert float NaN to integer
```

Two different exception types for two different failures, and neither is a
`ValueError` you can catch generically alongside a bad-string parse without also
catching the NaN case. Guard with `math.isfinite` before converting — the argument is
in [isclose edge cases](07b-isclose-edge-cases.md).

## int → float: exact to 2\*\*53, then it rounds, then it raises

*"Otherwise, if the argument is an integer or a floating-point number, a
floating-point number with the same value (within Python's floating-point precision)
is returned. If the argument is outside the range of a Python float, an
`OverflowError` will be raised."*

Three regimes, and the middle one is the dangerous one:

```python
float(2**53)          # exact
float(2**53 + 1)      # 9007199254740992.0 — rounded, silently
float(10**400)        # OverflowError: int too large to convert to float
```

Note the parenthetical in the docs — *"within Python's floating-point precision"* —
is doing all the work. That clause is the only warning you get that this conversion
can round, and it never raises for it. Only leaving the *range* raises; leaving the
*precision* does not.

`int` has no maximum, as [`int` never overflows](01-int-never-overflows.md) covers,
so every `int → float` conversion is a narrowing one. That is the whole reason 64-bit
identifiers must never touch a float, worked through in
[Identity and boundaries](01c-identity-and-boundaries.md).

## float.from_number and the strict constructors

3.14 added strict, number-only alternative constructors across the numeric types —
`float.from_number()`, `Decimal.from_number()` and `Fraction.from_number()` — which
accept numeric arguments and refuse strings. The plain constructors accept both, which
is convenient at a REPL and wrong at an API boundary, where a string arriving in a
numeric field is a validation failure rather than something to parse. Use the strict
form where the input is untrusted.

## Gotchas

### `int()` and `math.floor()` differ on every negative non-integer
**Symptom.** An index, a page count or a bucket number is off by one, and only for
negative inputs.
**Cause.** `int()` truncates toward zero; `//` and `math.floor()` floor toward minus
infinity.
**Fix.** Write the one you mean, explicitly.
```python
math.floor(x)     # the floor
math.trunc(x)     # truncation, said out loud
```

### A type with only `__trunc__` stops converting in 3.14
**Symptom.** `TypeError` from an `int()` call that worked on 3.13, in code nobody
changed.
**Cause.** `int()` no longer delegates to `__trunc__()` as of 3.14.
**Fix.** Implement `__int__` (and `__index__` if the value is genuinely integral and
should work as an index).

### `float(big_int)` rounds without a word
**Symptom.** A 19-digit identifier comes back from a computation altered in its last
digits, and nothing raised.
**Cause.** `int → float` is exact only below `2**53`; above it the conversion rounds,
and only an out-of-*range* value raises `OverflowError`.
**Fix.** Keep identifiers as `int` or `str` end to end, and assert the bound where a
float conversion is unavoidable.
```python
if abs(n) > 2**53:
    raise ValueError(f"{n} cannot survive a float round trip")
```

### Catching the wrong exception around `int(x)`
**Symptom.** A NaN slips through a guard written to catch conversion failures.
**Cause.** `int(inf)` raises `OverflowError` while `int(nan)` raises `ValueError` —
different types for the two non-finite cases.
**Fix.** Test finiteness rather than catching.
```python
if not math.isfinite(x):
    raise ValueError(f"non-finite value: {x!r}")
return int(x)
```

### Assuming a comparison converts
**Symptom.** Someone "fixes" `big_int == some_float` by wrapping the int in `float()`,
and changes a correct answer into a wrong one.
**Cause.** Mixed comparisons compare the exact values and are already correct; the
conversion is what introduces the error.
**Fix.** Leave mixed comparisons alone. Convert only when you need a value of the
other type, and at a boundary you chose.

### `Decimal(0.1)` called "exact" and used as if it were `0.1`
**Symptom.** A money value constructed from a float carries fifty-odd digits of
binary expansion.
**Cause.** The conversion is exact *about the float*, which was never `0.1`.
**Fix.** Construct from a string. The full expansion and the `FloatOperation` trap
that catches this are in
[Exact and lossy conversions](12b-exact-and-lossy-conversions.md).

## Interview questions

**Does comparing an `int` to a `float` convert either one?**
No. The language reference says a comparison between numbers of different types
behaves as though the exact values were being compared, so mixed comparisons are
mathematically correct even where the corresponding conversion would round.

**What does `int()` do to a float, exactly?**
Truncates toward zero. That differs from `math.floor` for every negative
non-integer — `int(-7.5)` is `-7`, `math.floor(-7.5)` is `-8`.

**What changed about `int()` in 3.14?**
It no longer delegates to `__trunc__()`. It uses `__int__()`, falling back to
`__index__()`. A type implementing only `__trunc__` now raises `TypeError` on `int(x)`,
though `math.trunc()` still works on it.

**When is `int → float` exact?**
Below `2**53` in absolute value. Above that the conversion rounds silently; beyond the
float range it raises `OverflowError`. Only the range failure raises — precision loss
never does.

**Which conversions raise, and which are silent?**
Range failures raise: `float(10**400)` is an `OverflowError`, `int(inf)` is an
`OverflowError`, `int(nan)` is a `ValueError`. Precision failures are silent:
`float(2**53 + 1)` just returns a different number.

**Why must a 64-bit ID never round-trip through a float?**
Because `int` is unbounded and `float` is not: above `2**53` the conversion rounds and
does not raise, so an ID comes back altered with nothing to catch it. Keep it an `int`
or a string.

**`int(-7.5)`, `math.floor(-7.5)`, `math.trunc(-7.5)`, `round(-7.5)`, `math.ceil(-7.5)`
— what are they?**
`-7`, `-8`, `-7`, `-8`, `-7`. Toward zero, toward minus infinity, toward zero, nearest
with ties to even, toward plus infinity.

**Why prefer `float.from_number` over `float` at an API boundary?**
The plain constructor accepts strings, so a string arriving in a numeric field gets
parsed instead of rejected. The 3.14 `from_number` constructors are number-only, which
turns that into the validation error it should be.

**Is `Decimal(0.1)` lossy?**
Not as a conversion — it is exactly the binary value the float holds. It is lossy
relative to your *intent*, because the float was never `0.1`. Construct from a string
when you mean the decimal number.

---

← Prev: [Rounding and formatting](11d-rounding-and-formatting.md) · Index: [Numbers](README.md) · Next → [Exact and lossy conversions](12b-exact-and-lossy-conversions.md)
