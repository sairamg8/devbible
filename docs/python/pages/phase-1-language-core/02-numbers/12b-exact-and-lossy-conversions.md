---
title: "Decimal(0.1) and Fraction(0.1) are both exact and both wrong — they are faithful to a float that was never 0.1"
sidebar_label: "12b · Exact and lossy conversions"
sidebar_position: 121
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`decimal`](https://docs.python.org/3.14/library/decimal.html),
> [`fractions`](https://docs.python.org/3.14/library/fractions.html) and
> [Numeric Types — int, float, complex](https://docs.python.org/3.14/library/stdtypes.html#numeric-types-int-float-complex),
> plus [PEP 3141](https://peps.python.org/pep-3141/).
> Version spine: **Python 3.14.7**; mixed `Decimal`/float comparisons fully supported
> since **3.2**.

**The most-repeated numeric surprise in Python is `Decimal(0.1)` coming back as fifty
digits, and the surprise is misplaced: the conversion is perfectly exact. What is
inexact is the float it started from. `Decimal` and `Fraction` are both *faithful*
converters — they report precisely the value the float holds — so converting from a
float tells you the truth about a number you did not mean. The directions that lose
information are the ones back the other way, and `Decimal` is deliberately outside the
numeric tower, so it refuses to mix with the rest rather than converting silently.**

## float → Decimal is exact, and that is the problem

*"If value is a float, the binary floating-point value is losslessly converted to its
exact decimal equivalent… `Decimal(float('1.1'))` converts to
`Decimal('1.100000000000000088817841970012523233890533447265625')`."*

```python
from decimal import Decimal

Decimal(3.14)
# Decimal('3.140000000000000124344978758017532527446746826171875')
Decimal.from_float(0.1)
# Decimal('0.1000000000000000055511151231257827021181583404541015625')
Decimal('3.14')
# Decimal('3.14')      — what you meant
```

Every binary64 value *is* a terminating decimal — a fraction over a power of two
always is — which is why the expansion is finite rather than repeating. Its length is
the tell: fifty-plus significant digits means a float got in.

The library gives you a way to make this an error rather than a surprise. The
`FloatOperation` trap is off by default; switch it on and accidental float
contamination raises:

```python
from decimal import getcontext, FloatOperation
getcontext().traps[FloatOperation] = True

Decimal(3.14)              # now raises
Decimal('3.5') < 3.7       # now raises
Decimal('3.5') == 3.5      # still True — equality is exempt
```

*"Explicit conversions with `from_float()` or `create_decimal_from_float()` do not set
the flag"*, so deliberate conversions keep working while accidents stop. Contexts and
traps are covered in the Decimal chunks — **contexts, precision and signals**
*(10b-contexts-precision-and-signals.md)*.

## float → Fraction is exact in the same way

```python
from fractions import Fraction
Fraction(1.1)              # Fraction(2476979795053773, 2251799813685248)
Fraction(Decimal('1.1'))   # Fraction(11, 10)
Fraction('1.1')            # Fraction(11, 10)
```

Same mechanism, different tell: a denominator that is a large power of two rather than
a long string of digits. `2251799813685248` is `2 ** 51`. The recovery tool is
`limit_denominator`, described in [Approximation and cost](11c-limit-denominator-and-cost.md)
— and like every recovery it is a guess, so prefer not losing the value in the first
place.

## Decimal → Fraction is exact; Fraction → Decimal is not

`Fraction(Decimal('1.1'))` is `Fraction(11, 10)` exactly, because every finite decimal
is a rational. The reverse fails for any denominator with a prime factor other than 2
or 5:

```python
Decimal(Fraction(11, 10))     # Decimal('1.1')  — exact
Decimal(Fraction(1, 3))       # rounds to the context precision
```

`1/3` has no finite decimal expansion, so the conversion rounds at the context's
precision — quietly, because rounding to precision is what a `Decimal` context does
rather than an error. If exactness across that boundary matters, carry the pair of
integers instead of converting.

## Decimal → float and Fraction → float both round

```python
float(Decimal('0.1'))         # 0.1  — i.e. the nearest float, not the decimal
float(Fraction(1, 3))         # 0.3333333333333333
```

One rounding, at the moment you ask, to the nearest binary64 value. That is the right
place for it — at a boundary you wrote — and it is exactly why `float()` should appear
once, at the exit from an exact computation, rather than in the middle of one.

## Mixed arithmetic: what widens and what raises

| Expression | Result |
|---|---|
| `int + float` | `float` — widens |
| `int + Decimal` | `Decimal` — exact |
| `int + Fraction` | `Fraction` — exact |
| `Fraction + float` | `float` — exactness lost |
| `Decimal + float` | **`TypeError`** |
| `Decimal + Fraction` | **`TypeError`** |

The two `TypeError`s are deliberate. PEP 3141: *"After consultation with its authors
it has been decided that the `Decimal` type should not at this time be made part of
the numeric tower."* Refusing to mix is what stops a `Decimal` computation from
silently degrading to binary floating point — the failure mode `Fraction + float`
demonstrates on the line above it.

Comparisons are the exception, and have been for a long time:

> *"Changed in version 3.2: Mixed-type comparisons between Decimal instances and other
> numeric types are now fully supported."*

So `Decimal('0.5') == 0.5` is `True` and `Decimal('0.1') == 0.1` is `False` — both
correct, both comparing exact values, per the rule in
[Conversions and precision loss](12-conversions-and-precision-loss.md). Arithmetic
raises; comparison does not.

## Converting at a boundary, deliberately

The shape that survives review is a single conversion at each edge, with the exact
type in the middle:

```python
from decimal import Decimal

def total_cents(rows) -> Decimal:
    # in: strings from the wire, never floats
    return sum((Decimal(r["amount"]) for r in rows), start=Decimal(0))

payload = {"total": str(total_cents(rows))}    # out: a string, not a float
```

Both edges are explicit, neither goes through a float, and the exactness holds across
the whole middle. The version that takes `float(r["amount"])` on the way in is wrong
before any arithmetic happens.

## Gotchas

### `Decimal(0.1)` used for money
**Symptom.** A ledger value with fifty-odd significant digits, and totals that differ
from the accounting system in the last places.
**Cause.** The constructor is exact about the *binary* value, which is not `0.1`.
**Fix.** Construct from a string, and turn the trap on so the mistake raises next
time.
```python
Decimal("0.1")
getcontext().traps[FloatOperation] = True
```

### `FloatOperation` assumed to catch everything
**Symptom.** The trap is enabled and `Decimal('3.5') == 3.5` still returns `True`
without raising.
**Cause.** Equality against a float is documented as exempt; the trap fires on
construction and on ordering comparisons.
**Fix.** Do not rely on the trap as the only guard — keep floats out at the boundary
as well.

### `from_float` believed to be safer than the constructor
**Symptom.** Code switched to `Decimal.from_float(x)` to "avoid the precision
problem", with no change in behaviour.
**Cause.** They do the same conversion. The only difference is that the explicit form
is exempt from the `FloatOperation` trap — it is *more* permissive, not safer.
**Fix.** The fix is not to have a float. Construct from a string or a `Decimal`.

### `Fraction → Decimal` rounding without a signal
**Symptom.** An exact rational becomes a `Decimal` that does not compare equal to it.
**Cause.** `1/3` has no finite decimal form, so the conversion rounds to the context
precision — normal `Decimal` behaviour, not an error.
**Fix.** Stay in `Fraction`, or carry `(numerator, denominator)` across the boundary
and convert once at the end where the rounding is visible.

### Expecting `Decimal + float` to work because the comparison does
**Symptom.** `TypeError` in a code path where an equality check on the same two values
succeeded a few lines earlier.
**Cause.** Comparisons have been fully supported since 3.2; arithmetic is still
refused, because `Decimal` is outside the numeric tower.
**Fix.** Convert explicitly, in the direction that does not lose anything.
```python
Decimal(str(x)) + Decimal("0.5")
```

### A float sneaking into a `Fraction` pipeline
**Symptom.** Exactness disappears partway through with no line obviously at fault, and
denominators become powers of two.
**Cause.** `Fraction + float` widens to `float`; unlike `Decimal`, `Fraction` does not
refuse.
**Fix.** Convert inputs at the boundary and annotate them, so a float cannot arrive
mid-computation unnoticed.

## Interview questions

**What is `Decimal(0.1)` and why is it not a bug?**
`Decimal('0.1000000000000000055511151231257827021181583404541015625')`. The conversion
is documented as lossless: it is the exact decimal equivalent of the binary value the
float holds. The float was never `0.1`.

**Why is the expansion finite rather than repeating?**
Because a binary64 value is a fraction over a power of two, and every such fraction
has a terminating decimal expansion.

**How do you make accidental float→Decimal conversion an error?**
Enable the `FloatOperation` trap on the context. Construction from a float and
ordering comparisons against floats then raise, while `from_float` and
`create_decimal_from_float` stay exempt — and equality against a float is exempt too.

**Is `Decimal.from_float` safer than `Decimal(x)`?**
No — it performs the same conversion, and it is explicitly exempt from the
`FloatOperation` trap, so it is the more permissive of the two. Neither is a fix for
having a float.

**Which conversions among `int`, `float`, `Decimal` and `Fraction` are exact?**
`int` to anything except a `float` above `2**53`; `float` to `Decimal` and to
`Fraction` (faithful to the binary value); `Decimal` to `Fraction`. Everything back
toward `float`, and `Fraction` to `Decimal` when the denominator has a factor other
than 2 or 5, rounds.

**Why does `Decimal + float` raise when `Decimal < float` does not?**
PEP 3141 kept `Decimal` out of the numeric tower, so there is no implicit arithmetic
conversion — that refusal is what stops an exact computation degrading silently.
Mixed-type comparisons were fully supported in 3.2 because comparison can be answered
on exact values without converting anything.

**How would you get from `Fraction(1, 3)` to a `Decimal`?**
You cannot, exactly — `1/3` has no finite decimal expansion, so any conversion rounds
at the context precision. Either stay in `Fraction`, or decide the precision
explicitly and quantise there, where the rounding is visible.

**How do you spot that a float leaked into an exact type?**
`Decimal`: an expansion of fifty-odd significant digits. `Fraction`: a denominator
that is a large power of two. Both are unmistakable once you have seen them once.

**Where should conversions live in a pipeline?**
At the edges — one conversion in, one out, exact type in the middle — with strings
rather than floats on the wire. A conversion in the middle of a computation is where
precision is lost without anybody deciding to lose it.

---

← Prev: [Conversions and precision loss](12-conversions-and-precision-loss.md) · Index: [Numbers](README.md) · Next → [Silent loss and boundaries](12c-silent-loss-and-boundaries.md)
