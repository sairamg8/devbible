---
title: "A Python float is an IEEE 754 binary64 double, so it stores base-2 fractions and repr shows you the shortest decimal that round-trips rather than the value that is actually there"
sidebar_label: "5 · float and IEEE 754"
sidebar_position: 50
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Python 3.14 tutorial appendix
> [Floating-Point Arithmetic: Issues and Limitations](https://docs.python.org/3.14/tutorial/floatingpoint.html),
> the library reference for
> [`sys.float_info` and `sys.float_repr_style`](https://docs.python.org/3.14/library/sys.html#sys.float_info),
> [Numeric Types](https://docs.python.org/3.14/library/stdtypes.html#numeric-types-int-float-complex),
> the [Format Specification Mini-Language](https://docs.python.org/3.14/library/string.html#format-specification-mini-language),
> and the [`decimal`](https://docs.python.org/3.14/library/decimal.html) module intro.
> Version spine: **Python 3.14.7**.

**A `float` is not "a number with a decimal point". It is one member of a finite
set of base-2 fractions, laid out on the number line at wildly uneven spacing,
and the decimal you typed was silently replaced by the nearest member of that
set before any arithmetic ran. Almost every decimal fraction you care about —
`0.1`, `0.2`, `1.1`, `19.99` — is not in the set. What hides this is `repr`:
since Python 3.1 it prints the *shortest* decimal string that reads back as the
same float, so the display is the tidiest string that round-trips, not the
value. Master this page and the whole family of "floating point is broken" bugs
collapses into one mechanism you can inspect on demand.**

## What the type actually is

The library reference is direct about the C-level type:

> *"Floating-point numbers are usually implemented using **double** in C;
> information about the precision and internal representation of floating-point
> numbers for the machine on which your program is running is available in
> `sys.float_info`."*

The tutorial appendix pins the format:

> *"Since at least 2000, almost all machines use IEEE 754 binary floating-point
> arithmetic, and almost all platforms map Python floats to IEEE 754 binary64
> 'double precision' values. IEEE 754 binary64 values contain 53 bits of
> precision."*

A binary64 value is 64 bits: 1 sign bit, an 11-bit exponent, and 52 stored
significand bits. The 53rd bit of precision is the implicit leading `1` that
normalised values carry for free — which is why the docs say 53 bits of
precision while only 52 are physically stored.

Every finite float is therefore exactly a number of the form

```text
(-1)**sign  *  M / 2**k        with M an integer of at most 53 bits
```

That is the whole value space. If a quantity cannot be written that way, it is
not a `float`, and asking for it gets you the nearest one.

## The machine's own description of itself

`sys.float_info` is the platform's `float.h` exposed to Python. The fields you
will actually reach for:

| Field | `float.h` macro | What it means for you |
|---|---|---|
| `mant_dig` | `DBL_MANT_DIG` | *"the number of base-`radix` digits in the significand"* — 53 on every mainstream build |
| `radix` | `FLT_RADIX` | *"The radix of exponent representation"* — 2, which is the root of every surprise on this page |
| `epsilon` | `DBL_EPSILON` | *"difference between 1.0 and the least value greater than 1.0 that is representable as a float"* — the gap **at 1.0 only**, not a universal error bound |
| `dig` | `DBL_DIG` | *"The maximum number of decimal digits that can be **faithfully** represented in a float"* — 15 |
| `max` / `min` | `DBL_MAX` / `DBL_MIN` | largest finite float; smallest positive **normalised** float. The docs add: *"Use `math.ulp(0.0)` to get the smallest positive denormalized representable float."* |
| `max_10_exp` / `min_10_exp` | | the decimal exponent range, 308 and -307 |
| `rounds` | `FLT_ROUNDS` | the rounding mode at interpreter start: *"`1`: to nearest"* on every normal build |

```python
import sys

assert sys.float_info.radix == 2
assert sys.float_info.mant_dig == 53      # 53 bits of significand
print(sys.float_info.dig)                 # decimal digits that survive a round trip in
```

🔴 `epsilon` is the most misused constant in numerical Python. It is the gap
between `1.0` and its successor. At `1e6` the gap is roughly a billion times
larger; near `1e-300` it is unimaginably smaller. `abs(a - b) < sys.float_info.epsilon`
is a correct test for values near 1 and a badly wrong one everywhere else.
[Comparing floats](07-comparing-floats.md) is about doing this properly.

## Why one tenth is not a float

The tutorial appendix works the arithmetic out in full, and it is worth reading
rather than believing:

> *"1/10 is not exactly representable as a binary fraction. […] on input the
> computer strives to convert 0.1 to the closest fraction it can of the form
> `J`/2\*\*`N` where `J` is an integer containing exactly 53 bits."*

> *"In base 2, 1/10 is the infinitely repeating fraction:
> `0.0001100110011001100110011001100110011001100110011...`"*

Solving for the exponent that leaves the numerator exactly 53 bits wide gives
`N = 56`, and rounding the quotient up (the remainder of `2**56 // 10` is 6,
more than half of 10) gives the best approximation:

> *"Therefore the best possible approximation to 1/10 in IEEE 754 double
> precision is: `7205759403792794 / 2 ** 56`. Dividing both the numerator and
> denominator by two reduces the fraction to: `3602879701896397 / 2 ** 55`."*

> *"Note that since we rounded up, this is actually a little bit larger than
> 1/10; if we had not rounded up, the quotient would have been a little bit
> smaller than 1/10. But in no case can it be **exactly** 1/10!"*

So the literal `0.1` in your source file is a request, not a value. What the
interpreter stores is `3602879701896397 / 2 ** 55`, and every arithmetic
consequence — `0.1 + 0.1 + 0.1 == 0.3` being `False` (the tutorial shows exactly
that), a running total of prices drifting, an accumulator that never hits its
stop condition — follows from that single substitution, not from any flakiness
in the arithmetic. The arithmetic is deterministic and correctly rounded given
its inputs; the inputs are not the ones you wrote.

The tutorial also kills the obvious "just round first" reflex: because *"0.1
cannot get any closer to the exact value of 1/10 and 0.3 cannot get any closer
to the exact value of 3/10, then pre-rounding with `round()` function cannot
help"* — `round(0.1, 1) + round(0.1, 1) + round(0.1, 1) == round(0.3, 1)` is
still `False`. Rounding a value to a decimal place it is already as close to as
a float can get changes nothing.

## repr is a display convention, not the value

This is the part that makes the bug hard to see, because Python actively hides
the problem in the one place you look first.

> *"If the string has value `'short'` then for a finite float `x`, `repr(x)`
> aims to produce a short string with the property that `float(repr(x)) == x`.
> This is the usual behaviour in Python 3.1 and later."* — `sys.float_repr_style`

Round-tripping is the *only* promise. Being the value is not:

> *"Interestingly, there are many different decimal numbers that share the same
> nearest approximate binary fraction. For example, the numbers `0.1` and
> `0.10000000000000001` and
> `0.1000000000000000055511151231257827021181583404541015625` are all
> approximated by `3602879701896397 / 2 ** 55`. Since all of these decimal
> values share the same approximation, any one of them could be displayed while
> still preserving the invariant `eval(repr(x)) == x`."*

Python picks the shortest of that family. `repr` is a **compression** of a whole
interval of decimals down to one representative: many-to-one coming in,
shortest-first going out.

The default format spec inherits the same behaviour, which the Format
Specification Mini-Language states explicitly for the `None` presentation type:

> *"When the precision is not specified, the latter will be as large as needed
> to represent the given value faithfully. […] The overall effect is to match
> the output of `str()` as altered by the other format modifiers."*

```python
x = 1.1 + 2.2
print(x)            # str(): shortest round-tripping form
print(f"{x}")       # identical - the None presentation type
print(f"{x:.2f}")   # 'f' rounds the *stored binary value* to 2 places
print(f"{x:.17f}")  # 17 places always distinguishes two binary64 values
```

The `decimal` module's own introduction uses exactly this case to sell itself:

> *"End users typically would not expect `1.1 + 2.2` to display as
> `3.3000000000000003` as it does with binary floating point."*

Note what happened there: `1.1` and `2.2` are each individually inexact, but each
one's shortest round-tripping string happens to be the pretty one, so both
operands *look* exact. Their sum lands on a float whose shortest round-tripping
string is not pretty, so the concealment fails and the extra digits pop out.
Nothing changed about the arithmetic between the operands and the result — only
whether the shortest round-tripping string happened to look tidy.

## The three questions this answers

- *"Why did my total come out at `.30000000000000004`?"* — it did not; the total
  came out at a specific binary64 value, and that string is merely its shortest
  round-tripping form.
- *"Why does it work on my machine and not in CI?"* — it almost never does.
  Both are binary64 with round-to-nearest; a genuine cross-platform difference
  is far more likely to be a library, an extended-precision accumulator, or a
  different input, and the way to prove it is to compare `x.hex()` on both
  sides (see [05b](05b-inspecting-and-constructing-floats.md)).
- *"Should I just use `Decimal` everywhere?"* — no. Use it where the *domain* is
  decimal (money, tax, invoices, anything a human will audit). Physics,
  statistics and graphics are not decimal domains, and `Decimal` there buys
  slowness and a different set of rounding surprises.

## Gotchas

**★ `str()` does not hide the digits, and neither does a bare f-string.** The
default presentation type is documented to *"match the output of `str()`"*, and
`str` for a float gives the same shortest-round-tripping digits as `repr`. The
only thing that truncates is an explicit precision — `f"{x:.2f}"`. Code that
logs `f"total={total}"` and expects two decimal places will print seventeen
significant digits the first time a sum lands off the shortest form, usually in
front of a customer.

**★ `sys.float_info.dig` (15) and "digits needed to round-trip" (17) are
different numbers pointing in opposite directions.** 15 is how many decimal
digits you can write down and get back unchanged after a trip *through* a float.
17 is how many you must *print* to distinguish any two distinct floats. Using 15
for serialisation silently merges distinct values; using 17 for display is
noise. For serialisation use `repr`, which is defined to round-trip and is
shorter than both.

**★ Two source literals that look different can be the same float.** The
tutorial names three: `0.1`, `0.10000000000000001` and the 55-digit exact
expansion all denote `3602879701896397 / 2 ** 55`. A test asserting that a
config parser "preserved" a long decimal string is asserting nothing — the
information was destroyed at parse time. Compare the strings, or parse to
`Decimal`.

**★ `epsilon` is not "the error in a float".** It is the gap at 1.0. The error
in a stored value is at most half the gap *at that value*, which `math.ulp`
reports and `epsilon` does not. See
[05c](05c-the-float-number-line.md).

**★ Pre-rounding does not rescue an inexact literal.** The tutorial states it
outright: rounding `0.1` to one decimal place cannot move it closer to 1/10,
because it is already the closest float there is. `round(x, 2)` before an
equality test is a no-op dressed up as a fix; you need a tolerance
([Comparing floats](07-comparing-floats.md)) or a different type
(**12** *(not written yet)*).

**★ Numeric literals with `e` are floats even when they look integral.** `1e6`
is a `float`, not an `int` — so `1e6` as a list index or a `range` bound is a
`TypeError`, and `10**23 == 1e23` is `False` because the two sides are genuinely
different numbers. (Covered from the literal side in
[03](03-numeric-literals.md).)

## Interview questions

**★ What exactly is stored when I write `x = 0.1`?**
The nearest binary64 value to one tenth, which the tutorial derives as
`3602879701896397 / 2 ** 55` — a value very slightly *larger* than 1/10, because
the 53-bit quotient rounded up. The decimal string in your source is parsed and
replaced when the module is compiled; there is no stage of the program at which
the value 1/10 exists.

**★ If the stored value is not one tenth, why does printing it show `0.1`?**
Because since Python 3.1 `repr` produces the shortest decimal string that reads
back as the same float, not the value. `sys.float_repr_style` documents the
contract as *"`float(repr(x)) == x`"*. Many decimal strings map to that float;
`0.1` is the shortest, so it is the one displayed.

**★ Why does `1.1 + 2.2` show extra digits when `1.1` and `2.2` do not?**
All three are inexact. The operands happen to have tidy shortest-round-tripping
strings; the sum does not. The error did not appear at the addition — it was in
the operands all along, and the addition merely moved the result to a float
whose shortest form is ugly.

**★ Is floating-point arithmetic non-deterministic?**
No. Each IEEE 754 operation is correctly rounded and fully determined by its
operands and the rounding mode, which `sys.float_info.rounds` reports as
round-to-nearest. What varies is the *order* of operations (addition is not
associative), whether an intermediate was held in extended precision, and which
library computed a transcendental function. "Random" floating-point results are
almost always a reordering, not a nondeterminism.

**★ What is `sys.float_info.epsilon`, and why is it usually the wrong
tolerance?**
It is `DBL_EPSILON`: the difference between 1.0 and the next representable
float. It describes the grid spacing at magnitude 1 only. Since spacing scales
with the exponent, `epsilon` as an absolute tolerance is far too strict above 1
and far too loose below it. Use `math.isclose` with a relative tolerance, or
`math.ulp(x)` for a spacing that tracks the magnitude.

**★ Does Python's `float` differ from Java's `double` or JavaScript's
`Number`?**
Not in value semantics — all three are IEEE 754 binary64 on any mainstream
platform, so the same operations on the same bits produce the same bits. What
differs is display (Python and JavaScript both print the shortest
round-tripping form; Java's `Double.toString` has historically produced longer
strings for some values) and the handling of overflow and division by zero,
which is [06](06-nan-inf-and-signed-zero.md). Cross-language mismatches are
overwhelmingly formatting, not arithmetic.

**★ Someone reports that a value "changed" between writing and reading it back
from JSON. Where do you look first?**
Not at the float. Both ends of a JSON round trip do correctly-rounded
decimal↔binary conversion, so a binary64-to-binary64 trip through `repr` and
`float` is lossless. Look for a `float32` somewhere (NumPy, a Protobuf `float`
field, a GPU), a SQL `DECIMAL` or `NUMERIC` column, a JavaScript rounding
helper, or an explicit `round()`/`%.2f` in a serialiser.

---

← Prev: [Underscores and constructors](03b-underscores-and-constructors.md) · Index: [Numbers](README.md) · Next → [Inspecting and constructing floats](05b-inspecting-and-constructing-floats.md)

{/* FOOTER */}
