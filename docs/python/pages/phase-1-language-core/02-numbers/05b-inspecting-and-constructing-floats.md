---
title: "Four documented ways to see the exact value inside a float, the rule for which decimals are exact, and why float.from_number() in 3.14 is the constructor you want at a data boundary"
sidebar_label: "5b · Inspecting and constructing floats"
sidebar_position: 51
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Python 3.14 library reference for
> [Additional Methods on Float](https://docs.python.org/3.14/library/stdtypes.html#additional-methods-on-float)
> (`as_integer_ratio`, `is_integer`, `hex`, `fromhex`, `from_number`),
> [`float()`](https://docs.python.org/3.14/library/functions.html#float),
> [`decimal`](https://docs.python.org/3.14/library/decimal.html#decimal.Decimal.from_float),
> [`fractions`](https://docs.python.org/3.14/library/fractions.html),
> [`json`](https://docs.python.org/3.14/library/json.html),
> and the tutorial appendix
> [Floating-Point Arithmetic](https://docs.python.org/3.14/tutorial/floatingpoint.html).
> Version spine: **Python 3.14.7**; `float.from_number()` **added in 3.14**.

**`print(x)` is the one tool that cannot answer "what is in this float", because
`repr` is defined to be short rather than true. Python ships four constructors
and methods that *are* exact — `as_integer_ratio`, `Decimal(x)`, `x.hex()` and a
17-digit format — and knowing which one to reach for turns a class of unfalsifiable
"the numbers are wrong" tickets into a two-line diagnosis. The same reasoning
runs in reverse for construction: `float()` will accept `"nan"` out of a CSV
cell and silently poison every aggregate downstream, and 3.14's
`float.from_number()` exists precisely so a boundary can refuse that.**

## Four ways to see what is actually stored

**1 · `float.as_integer_ratio()` — the exact rational.**

> *"Return a pair of integers whose ratio is exactly equal to the original
> float. The ratio is in lowest terms and has a positive denominator. Raises
> `OverflowError` on infinities and a `ValueError` on NaNs."*

The tutorial shows `(0.1).as_integer_ratio()` giving
`(3602879701896397, 36028797018963968)` — the fraction from
[05](05-float-and-ieee-754.md) with the denominator written out. The denominator
is always a power of two; that is the definition of the value space, visible.

**2 · `decimal.Decimal(x)` — the exact decimal expansion.**

> *"`Decimal.from_float(0.1)`" →
> "`Decimal('0.1000000000000000055511151231257827021181583404541015625')`"*

Every binary64 value has a *finite* decimal expansion, because a denominator
that is a power of two always terminates in base 10. So this is not an
approximation in either direction — it is the number, fully written out. Since
3.2 the plain constructor does the same thing: the `decimal` docs show
`Decimal(3.14)` as
`Decimal('3.140000000000000124344978758017532527446746826171875')`.

**3 · An explicit 17-digit format.** The tutorial shows `format(0.1, '.17f')`
giving `'0.10000000000000001'`. Seventeen significant decimal digits always
suffice to distinguish two distinct binary64 values — the counterpart to
`sys.float_info.dig == 15` being what survives the trip the other way.

**4 · `float.hex()` — the bit pattern, readably.**

> *"Return a representation of a floating-point number as a hexadecimal string.
> For finite floating-point numbers, this representation will always include a
> leading `0x` and a trailing `p` and exponent."*

> *"the hexadecimal string `0x3.a7p10` represents the floating-point number
> `(3 + 10./16 + 7./16**2) * 2.0**10`, or `3740.0`"*

The exponent is a decimal power of **two**, not sixteen. `float.fromhex()` reads
it back exactly, and the docs note the format is shared with C's `%a` and Java's
`Double.toHexString`, so it is the right wire format for "prove these two
machines hold the identical bits".

```python
from decimal import Decimal
from fractions import Fraction

def dissect(x: float) -> None:
    print("repr            ", repr(x))
    print("exact rational  ", x.as_integer_ratio())
    print("exact decimal   ", Decimal(x))
    print("exact fraction  ", Fraction(x))
    print("hex (bit exact) ", x.hex())
    print("17 sig digits   ", format(x, ".17g"))
```

Keep that function somewhere. A large share of "the numbers are wrong" tickets
end the moment somebody prints `Decimal(x)` instead of `x`.

## Which decimals are exact

A decimal is exact as a `float` exactly when it is a **dyadic rational** whose
numerator fits in 53 bits: `M / 2**k`. In practice:

- `0.5`, `0.25`, `0.125`, `0.75`, `2.25`, `3.5` — exact. The `fractions` docs
  show the clean case: `Fraction(2.25)` is `Fraction(9, 4)`.
- Any integer of magnitude at most 2\*\*53 — exact (see
  [05c](05c-the-float-number-line.md)).
- `0.1`, `0.2`, `0.3`, `1.1`, `19.99`, `0.07` — **not** exact. Any denominator
  with a factor of 5 is out, which is every price, every tax rate and every
  percentage you will ever be handed.

The `fractions` docs draw the contrast in one line: `Fraction(1.1)` is
`Fraction(2476979795053773, 2251799813685248)`, while `Fraction(Decimal('1.1'))`
is `Fraction(11, 10)`. Same three characters of source, two different numbers,
because one route passes through binary and the other does not.

`float.is_integer()` is the cheap membership test for the integral case:

> *"Return `True` if the float instance is finite with integral value, and
> `False` otherwise"*

Note "finite" — `float('inf').is_integer()` is `False`, which is what you want
in a validator and is easy to forget when writing the check by hand as
`x == int(x)` (that raises `OverflowError` on an infinity instead).

## Recovering the decimal you meant

Sometimes you have a float and want the *human* number behind it, not the exact
binary value. `Fraction.limit_denominator` is the documented tool:

> *"Finds and returns the closest `Fraction` to `self` that has denominator at
> most max_denominator."*

> *"`Fraction('3.1415926535897932').limit_denominator(1000)`" →
> "`Fraction(355, 113)`"*

> *"`Fraction(1.1).limit_denominator()`" → "`Fraction(11, 10)`"*

That last line is the useful one: the float that came from the literal `1.1` has
a 2251799813685248-denominator exact form, but the *simplest* fraction within
one float of it is `11/10`, which is what a human wrote. This is a heuristic for
diagnostics and unit recovery, not a serialisation strategy — do not use it to
"clean up" values in a pipeline, because the simplest nearby fraction is not
necessarily the one that was intended.

## Constructing floats

`float()` accepts a number or a string, and the string grammar is specified
precisely: an optional sign, digits with optional `_` separators, an optional
`.` and exponent — or `inf` / `infinity` / `nan`, case-insensitively. The docs
spell out that *"'inf', 'Inf', 'INFINITY', and 'iNfINity' are all acceptable
spellings for positive infinity"*.

> *"Otherwise, if the argument is an integer or a floating-point number, a
> floating-point number with the same value (within Python's floating-point
> precision) is returned. If the argument is outside the range of a Python
> float, an `OverflowError` will be raised."*

> *"For a general Python object `x`, `float(x)` delegates to `x.__float__()`. If
> `__float__()` is not defined then it falls back to `__index__()`."*

Read *"within Python's floating-point precision"* carefully: that clause is the
docs' way of saying **silently rounded**. Only range overflow raises.

Python 3.14 adds a stricter sibling:

> *"`float.from_number(x)`: classmethod to return a floating-point number
> constructed from a number `x`. […] For a general Python object `x`,
> `float.from_number(x)` delegates to `x.__float__()`. If `__float__()` is not
> defined then it falls back to `__index__()`. **Added in version 3.14.**"*

The difference is that `from_number` refuses strings. That is the whole point:
in an ingestion path where a string arriving instead of a number is a *bug*
rather than a value, `from_number` fails at the boundary instead of quietly
parsing `"nan"` from a CSV cell into a NaN that will not equal itself three
functions later.

```python
float("1_000.5")           # 1000.5 - underscores allowed, same rule as literals
float("  -12345\n")        # -12345.0 - surrounding whitespace is stripped
float("NaN")               # a NaN, from a string, with no warning
float.from_number("1.5")   # TypeError - not a number      (3.14+)
float.from_number(10**23)  # fine: an int, rounded to nearest float
float(10**400)             # OverflowError - out of range
```

## Gotchas

**★ `float.hex()` output is not accepted by `float()`.** `float('0x1.8p+1')`
raises `ValueError`; only the classmethod parses it. The docs are explicit that
*"`float.hex()` is an instance method, while `float.fromhex()` is a class
method"*. This bites people who write hex floats into a config file and read
them back with a generic numeric parser.

**★ `float()` accepts `'nan'`, `'inf'` and `'-Infinity'` from untrusted
input.** Every CSV importer, query-string parser and `argparse(type=float)` in
your codebase has this hole. A NaN entering here does not raise anywhere — it
propagates through arithmetic, fails every comparison, and surfaces as a blank
chart or a sort that produced garbage. Validate with `math.isfinite()` at the
boundary, or use `float.from_number` where the input should already be numeric.

**★ `float()` never rejects precision loss.** `float(10**30)` succeeds and
silently rounds; only *range* overflow raises `OverflowError`. There is no flag,
mode or context that makes lossy int→float conversion an error. If you need the
check, write it: `float(n).is_integer() and int(float(n)) == n`.

**★ `Decimal(x)` on a float is exact, which is almost never what the author
wanted.** `Decimal(3.14)` is
`Decimal('3.140000000000000124344978758017532527446746826171875')`, not
`Decimal('3.14')`. The fix is to never let the value be a float: build it from
the string. If you are stuck with a float, `Decimal(str(x))` uses `repr`'s
shortest round-tripping form — see
[12](12-conversions-and-precision-loss.md) for when that is legitimate and when
it is laundering. The `decimal` context can enforce the rule for you:
setting `c.traps[FloatOperation] = True` makes `Decimal(3.14)` raise
`decimal.FloatOperation`.

**★ "Just print more digits to see the real value" only goes so far.**
`format(x, '.17g')` uniquely identifies the float but is still a rounded
decimal; the exact value can need 50+ digits, as `Decimal.from_float(0.1)`
shows. Debugging a rounding boundary needs `Decimal(x)` or
`x.as_integer_ratio()`, not more `%f` digits.

**★ Reading `0.1` from JSON gives the *same* float as writing `0.1` in
source.** Both paths do a correctly-rounded decimal→binary conversion, and
`json` documents that `parse_float` *"by default […] is equivalent to
`float(str)`"*. So "the API sent us a slightly different number" is almost never
true between two IEEE 754 systems — but it *is* frequently true across a
boundary where one side stored a `float32`, a SQL `DECIMAL`, or a JavaScript
value that went through a rounding helper.

**★ `as_integer_ratio()` raises on non-finite values, and the two exceptions
differ.** `OverflowError` for infinities, `ValueError` for NaNs. Code that
dissects arbitrary floats for logging needs both in the `except` clause, or an
`math.isfinite()` guard first — otherwise your diagnostic tool crashes on
exactly the pathological input you built it to diagnose.

**★ `Fraction(x)` on a float is exact and enormous; `Fraction(Decimal('...'))`
is small and human.** Two-and-a-quarter-million-digit denominators are not a bug
in `fractions`, they are the float being shown honestly. If you want `11/10`,
never route through a float literal: `Fraction('1.1')` and
`Fraction(Decimal('1.1'))` both give it directly.

**★ `x == int(x)` is not a safe integrality test.** It raises `OverflowError`
on an infinity and `ValueError` on a NaN. `x.is_integer()` returns `False` for
both, because it is documented as *"finite with integral value"*. Use the
method.

## Interview questions

**★ How do you find out what a float really holds, without guessing?**
`x.as_integer_ratio()` for the exact rational, `Decimal(x)` or
`Decimal.from_float(x)` for the exact decimal expansion, `x.hex()` for the bit
pattern, `format(x, '.17g')` for 17 uniquely-identifying significant digits. All
four are exact or uniquely identifying. `print(x)` is neither.

**★ Why does `Decimal(0.1)` produce a 55-digit number when `Decimal('0.1')`
produces `0.1`?**
Because the first one is handed a float that already lost the information. The
constructor converts that float *losslessly* to decimal — and the float's exact
value is
`0.1000000000000000055511151231257827021181583404541015625`. The second is
handed a string and parses decimal digits directly, so nothing was ever binary.
The lesson generalises: the damage is done by the literal, not by `Decimal`.

**★ When would you use `float.hex()` in production code?**
For a bit-exact wire or log format: reproducing a numerical bug across machines,
snapshotting golden values in a regression test, or storing seeds and
coefficients where a one-ulp difference changes the result. It is the only
stdlib text form that is exact *and* short, and the docs note it interoperates
with C's `%a` and Java's `Double.toHexString`.

**★ What does `float.from_number()` add in 3.14, given `float()` exists?**
It accepts only numbers — delegating to `__float__`, falling back to
`__index__` — and rejects strings. `float()` accepts strings, including
`'nan'`, `'inf'` and `'-Infinity'`. At a parsing boundary that is the difference
between rejecting bad input and admitting a NaN that will not compare equal to
itself anywhere downstream.

**★ Which decimal values are exactly representable as a float?**
Exactly the dyadic rationals `M / 2**k` with `M` fitting in 53 bits: halves,
quarters, eighths, and integers up to 2\*\*53. Any denominator containing a
factor of 5 — that is, essentially every decimal fraction that is not a dyadic —
is excluded, which covers all money and all percentages.

**★ You are given a float and asked to recover "the number the user typed".
How?**
`Fraction(x).limit_denominator()` gives the simplest fraction within a float of
it — the docs' own example is `Fraction(1.1).limit_denominator()` returning
`Fraction(11, 10)`. `repr(x)` gives the shortest decimal that round-trips. Both
are heuristics: they recover the *simplest* candidate, not provably the
original. If the original matters, do not store a float.

**★ Your API validator does `float(value)` and checks the result is a number.
What is wrong with it?**
`float()` produces NaN and infinities from strings, so a payload of `"nan"` or
`"Infinity"` passes. NaN then fails every range check written as
`low <= x <= high` — because *any* ordered comparison with NaN is false, the
value slips through as "not out of range" if the check is inverted, and is
rejected if it is not, so the behaviour depends on how the branch was spelled.
Add `math.isfinite(x)`. See [06](06-nan-inf-and-signed-zero.md).

---

← Prev: [float and IEEE 754](05-float-and-ieee-754.md) · Index: [Numbers](README.md) · Next → [The float number line](05c-the-float-number-line.md)

{/* FOOTER */}
