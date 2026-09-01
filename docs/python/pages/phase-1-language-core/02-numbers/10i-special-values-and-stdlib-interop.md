---
title: "A Decimal NaN is never equal to itself, ordering against one raises by default, and every stdlib numeric helper outside decimal quietly converts your exact value to a float"
sidebar_label: "10i · Special values, stdlib interop"
sidebar_position: 108
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`decimal` — Special values](https://docs.python.org/3.14/library/decimal.html#special-values),
> [`Decimal.compare`](https://docs.python.org/3.14/library/decimal.html#decimal.Decimal.compare),
> [`Decimal` objects](https://docs.python.org/3.14/library/decimal.html#decimal-objects),
> [`math`](https://docs.python.org/3.14/library/math.html) and
> [`fractions`](https://docs.python.org/3.14/library/fractions.html).
> Version spine: **Python 3.14.7**.

**`decimal` inherits IEEE's `NaN` semantics for direct comparisons and the General
Decimal Arithmetic Specification's semantics for everything else, and the two
disagree in ways that matter. `NaN` is not equal to itself, so a `NaN` amount
passes every equality test as "different" and every ordering test as an
`InvalidOperation`. `%` and `//` take their signs from the specification, not from
Python's `int` convention, so a helper tested on integers changes behaviour on
negative `Decimal`s. And `math` — every function of it — returns a float.**

## `NaN` comparisons follow IEEE 854, not the decimal specification

> *"The behavior of Python's comparison operators can be a little surprising where
> a `NaN` is involved. A test for equality where one of the operands is a quiet or
> signaling `NaN` always returns `False` (even when doing
> `Decimal('NaN')==Decimal('NaN')`), while a test for inequality always returns
> `True`. An attempt to compare two Decimals using any of the `<`, `<=`, `>` or
> `>=` operators will raise the `InvalidOperation` signal if either operand is a
> `NaN`, and return `False` if this signal is not trapped."*

The docs are explicit about where these rules come from: *"the General Decimal
Arithmetic specification does not specify the behavior of direct comparisons;
these rules for comparisons involving a `NaN` were taken from the IEEE 854
standard"* — and they recommend the alternative: *"To ensure strict
standards-compliance, use the `compare()` and `compare_signal()` methods
instead."*

```python
d = Decimal('NaN')
d == d            # False
d != d            # True
d < Decimal(1)    # raises InvalidOperation (trapped by default)

Decimal(1).compare(d)          # Decimal('NaN') — quiet, returns a value
Decimal(1).compare_signal(d)   # signals: "all NaNs signal"
```

`compare_total` is a third thing again: *"Compare two operands using their abstract
representation rather than their numerical value… Two `Decimal` instances with the
same numeric value but different representations compare unequal in this
ordering"* — the documented example being `Decimal('12.0').compare_total(Decimal('12'))`
returning `Decimal('-1')`. It is the right tool when you need a *total* order for
sorting, including of `NaN`s, and the wrong tool for any numeric question.

Because ordering comparisons raise on `NaN` by default, `sorted()` over a list
containing one raises `InvalidOperation` rather than producing a nonsense order —
which is better than the float behaviour, where the sort silently produces garbage.

## `%` and `//` do not mean what they mean for `int`

> *"When the remainder operator `%` is applied to `Decimal` objects, the sign of
> the result is the sign of the dividend rather than the sign of the divisor"*

```python
(-7) % 4                     # 1
Decimal(-7) % Decimal(4)     # Decimal('-3')

-7 // 4                      # -2
Decimal(-7) // Decimal(4)    # Decimal('-1')
```

> *"The integer division operator `//` behaves analogously, returning the integer
> part of the true quotient (truncating towards zero) rather than its floor, so as
> to preserve the usual identity `x == (x // y) * y + x % y`"*

`Decimal` follows the arithmetic specification (remainder and divide-integer);
`int` follows Python's floor convention. Any helper that computes a remainder and
was written and tested with `int` changes behaviour on negatives when a `Decimal`
is passed in. `divmod` on `Decimal` follows the `Decimal` rules, and
`remainder_near` is available when you want the smallest-magnitude remainder
instead. See [08](08-floor-division-and-modulo.md) for the `int` and `float`
conventions this diverges from.

## `math` gives back floats

> *"Except when explicitly noted otherwise, all return values are floats."*

That sentence is the whole hazard. `math.sqrt(Decimal('2.25'))`, `math.floor`,
`math.fsum` and friends accept a `Decimal` — the conversion goes through
`__float__` — and return a `float`, so the exactness is gone and nothing warns
you. `Decimal` has its own exact-context replacements:

```python
Decimal('2.25').sqrt()             # Decimal, correctly rounded in the context
Decimal(1).exp()
Decimal(100).ln()
Decimal(100).log10()
Decimal(2).fma(3, 5)               # fused multiply-add, no intermediate rounding
```

`math.floor` and `math.ceil` are the exceptions worth knowing: they return `int`
and `Decimal` implements them exactly, so they do not go through `float`. For
everything else, prefer the method on the `Decimal`.

`statistics`, by contrast, is documented to support `Decimal` inputs and preserve
the type for several functions — a rare and useful exception among stdlib numeric
modules.

## `Decimal` is not in the numeric tower

`Decimal` is deliberately not registered with `numbers.Real`, so
`isinstance(Decimal('1'), numbers.Real)` is `False` while
`isinstance(Fraction(1), numbers.Real)` is `True`. Any dispatch built on the ABCs
in `numbers` will not see `Decimal`; see
[13c](13c-the-numeric-tower.md) for the reasoning and
[11](11-fraction.md) for the type that *is* in the tower and is exact for ratios
that `Decimal` cannot represent.

## The special values, and the predicates that detect them

> *"The number system for the decimal module provides special values including
> `NaN`, `sNaN`, `-Infinity`, `Infinity`, and two zeros, `+0` and `-0`."*

Infinities are *"signed (affine) and can be used in arithmetic operations where
they get treated as very large, indeterminate numbers"*, and arrive either from a
literal `Decimal('Infinity')`, from an untrapped `DivisionByZero`, or from an
untrapped `Overflow`. Quiet `NaN` is *"useful for a series of computations that
occasionally have missing inputs — it allows the calculation to proceed while
flagging specific results as invalid"*. Signalling `NaN` is the opposite:
*"A variant is `sNaN` which signals rather than remaining quiet after every
operation. This is a useful return value when an invalid result needs to interrupt
a calculation for special handling."*

The predicates are exhaustive and cheap, and one of them is the guard every money
boundary needs:

```python
d.is_finite()      # False for infinities and NaNs — the one to validate with
d.is_nan()         # quiet or signalling
d.is_qnan()        # quiet only
d.is_snan()        # signalling only
d.is_infinite()
d.is_signed()      # True for -0 as well as negatives
d.is_zero()        # True for both -0 and +0
d.is_normal()      # False for zero, subnormal, infinite or NaN
d.is_subnormal()
d.number_class()   # one of ten strings: '+Normal', '-Zero', 'NaN', 'sNaN', …
```

`number_class()` returns *"one of the following ten strings"* — `"-Infinity"`,
`"-Normal"`, `"-Subnormal"`, `"-Zero"`, `"+Zero"`, `"+Subnormal"`, `"+Normal"`,
`"+Infinity"`, `"NaN"`, `"sNaN"` — which makes it the right thing to put in a log
line when a value is refused.

Signed zeros survive here as they do in binary floating point: *"The signed zeros
can result from calculations that underflow. They keep the sign that would have
resulted if the calculation had been carried out to greater precision… both
positive and negative zeros are treated as equal and their sign is
informational."* A refund that rounds to nothing can therefore print as `-0.00`,
which is a display bug and not an arithmetic one — `+Decimal('-0.00')` will not
fix it, but `abs()` or a `is_zero()` check before formatting will.

There is also more than one zero by *scale*: the docs' own example is that
`1 / Decimal('Infinity')` gives `Decimal('0E-1000026')`, a value equal to zero
with a wildly different exponent, which will fail a `same_quantum` invariant check
while passing `== 0`.

## `max`, `min` and the `NaN` carve-out

`Decimal.max` and `Decimal.min` are not the builtins: *"Like `max(self, other)`
except that the context rounding rule is applied before returning and that `NaN`
values are either signaled or ignored (depending on the context and whether they
are signaling or quiet)."* So `Decimal('1').max(Decimal('NaN'))` follows the
specification's rules rather than raising or propagating, while the builtin
`max()` over a list containing a `NaN` compares operands pairwise and can return
whichever value the ordering happened not to raise on. Use the methods when `NaN`
is a possibility, or filter first with `is_finite()`.

## Gotchas

**★ `Decimal('-0.00')` prints its sign.** Signed zeros are preserved and their
sign is informational, so a rounded-away negative adjustment can render as
`-0.00` on an invoice. Check `is_zero()` before formatting, or normalise with
`abs()` when the sign is meaningless.

**★ Not all zeros are `same_quantum`.** `1 / Decimal('Infinity')` is documented to
give `Decimal('0E-1000026')`. It equals zero, so a `== 0` check passes, but a
fixed-point invariant asserting exponent `-2` fails on it. Validate scale with
`same_quantum` *and* value with `is_finite`, not one or the other.

**★ `Decimal('sNaN')` raises on operations that a quiet `NaN` passes through.**
A signalling `NaN` is designed to interrupt; it signals `InvalidOperation` on
arithmetic even where a quiet `NaN` would simply propagate. If your data source
can emit `sNaN` (some interchange formats can), the failure appears at the first
arithmetic operation rather than at parse time.

**★ The builtin `max()` and `Decimal.max` are different functions.** The builtin
compares pairwise with `>`, which signals `InvalidOperation` on a `NaN`; the
method applies the specification's `NaN` handling and the context's rounding rule.
Picking the largest of a column of amounts that may contain a `NaN` gives
different behaviour depending on which one you reached for.

**★ `'Infinity'`, `'inf'`, `'NaN'` and `'sNaN'` are valid input strings, case
insensitively.** *"Case is not significant, so, for example, `inf`, `Inf`,
`INFINITY`, and `iNfINity` are all acceptable spellings for positive infinity."* A
CSV column containing the literal text `NaN` — a very common export artefact from
pandas or R — becomes `Decimal('NaN')`, not an error. Every downstream comparison
against it is then `False`, including `amount > 0` *and* `amount <= 0`. Reject
non-finite input explicitly with `is_finite()`.

**★ Sorting a list that contains `Decimal('NaN')` raises.** Ordering comparisons
signal `InvalidOperation`, which is trapped by default. This is better than the
float behaviour but it is still a crash in a report generator; filter with
`is_finite()` before sorting data that came from outside.

**★ `Decimal(-7) % Decimal(4)` is `-3`, not `1`.** The sign follows the dividend,
per the arithmetic specification, where `int` follows the divisor. A rounding or
bucketing helper written for `int` silently changes behaviour on negative
`Decimal` inputs.

**★ `math.sqrt(Decimal(...))` compiles, runs and returns a float.** So does
`math.fsum` over `Decimal`s. The stdlib gives no signal that you have left exact
arithmetic. Use `Decimal.sqrt()`, `Decimal.exp()`, `Decimal.ln()`,
`Decimal.log10()` and `Decimal.fma()`.

**★ `Decimal` fails `isinstance(x, numbers.Real)`.** Generic numeric code that
dispatches on the ABCs in `numbers` will fall through to its "not a number" branch
for `Decimal`, often into a `str()` fallback. Dispatch on
`(int, float, Decimal, Fraction)` explicitly, or on `numbers.Number`, which
`Decimal` *is* registered under.

## Interview questions

**★ How do you validate that a `Decimal` coming from outside is usable as money?**
Three checks, and all three are needed. `is_finite()` rejects infinities and both
kinds of `NaN` — this is the one people skip, and it is the one that lets a `NaN`
into a total. `same_quantum` against the currency's quantum asserts the scale.
And a range check, because `Decimal` has no natural bounds and an amount with a
thousand digits is a denial-of-service on whatever formats it. `number_class()`
gives you a precise string for the rejection log.

**★ Someone sorts a list of amounts and gets `InvalidOperation`. What happened?**
One of the amounts is `Decimal('NaN')` — very likely from an untrapped invalid
operation upstream, or from a source string literally containing `NaN`. Ordering
comparisons against a `NaN` signal `InvalidOperation`, which the default context
traps. That is the sound behaviour: with floats, the same sort would have produced
a silently wrong order. The fix is upstream — find why a `NaN` was produced — plus
an `is_finite()` filter or validation at the boundary.

**★ How do you take a square root, or any transcendental function, of a `Decimal`?**
With the `Decimal` method, not the `math` function. `math` documents that *"Except
when explicitly noted otherwise, all return values are floats"*, so
`math.sqrt(d)` converts to a double and hands back a float with all the exactness
gone. `Decimal.sqrt()`, `.exp()`, `.ln()`, `.log10()` and `.fma()` compute in the
current context and return `Decimal`s, correctly rounded to `prec`.

**★ Why is `Decimal(-7) // Decimal(4)` `-1` when `-7 // 4` is `-2`?**
Because they implement different operations. `Decimal` follows the General Decimal
Arithmetic specification's divide-integer and remainder, which truncate toward
zero and take the remainder's sign from the dividend; the docs note this is done
*"so as to preserve the usual identity `x == (x // y) * y + x % y`"*. Python's
`int` uses floor division with the remainder taking the divisor's sign. Both are
self-consistent; they are simply not the same convention, so any bucketing or
period-index helper written against `int` needs re-testing against `Decimal` with
negative inputs.

**★ Is `Decimal` part of the numeric tower?**
No. It is registered under `numbers.Number` but not under `numbers.Real`, so
`isinstance(Decimal('1'), numbers.Real)` is `False`. The reasoning is recorded in
PEP 3141 and covered in [13c](13c-the-numeric-tower.md). The practical effect is
that ABC-based dispatch does not see `Decimal`, so generic numeric code must name
it explicitly.

---

← Prev: [Decimal and the other numeric types](10h-decimal-and-the-other-numeric-types.md) · Index: [Numbers](README.md) · Next → [Decimal contexts across threads](10j-decimal-contexts-across-threads.md)

{/* FOOTER */}
