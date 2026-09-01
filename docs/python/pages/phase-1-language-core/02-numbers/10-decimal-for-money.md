---
title: "float is disqualified for money because binary cannot hold 0.01, and Decimal is the type that can — provided you construct it from a string"
sidebar_label: "10 · Decimal for money"
sidebar_position: 100
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`decimal`](https://docs.python.org/3.14/library/decimal.html) — the module
> introduction, [`Decimal` objects](https://docs.python.org/3.14/library/decimal.html#decimal-objects),
> [`Decimal.from_float`](https://docs.python.org/3.14/library/decimal.html#decimal.Decimal.from_float),
> [`Decimal.from_number`](https://docs.python.org/3.14/library/decimal.html#decimal.Decimal.from_number),
> [`IEEEContext`](https://docs.python.org/3.14/library/decimal.html#decimal.IEEEContext) —
> and the [`decimal` FAQ](https://docs.python.org/3.14/library/decimal.html#decimal-faq).
> Version spine: **Python 3.14.7**.

**Money in a binary float is wrong before you do any arithmetic with it, because
0.01 has no exact binary representation — the literal `0.01` in your source is
already a different number than the one you typed. `Decimal` fixes the
representation problem: a decimal string becomes exactly the value that string
denotes, arithmetic is correctly rounded to a precision you choose, and trailing
zeros survive so that `2.50` stays two decimal places. It fixes nothing else. It
is still floating point, division is still inexact, and every guarantee you get
depends on one habit: construct from `str` or `int`, never from a `float` you did
not deliberately convert.**

## The disqualification

The `decimal` documentation opens by naming the failure directly:

> *"Decimal numbers can be represented exactly. In contrast, numbers like `1.1`
> and `2.2` do not have exact representations in binary floating point. End users
> typically would not expect `1.1 + 2.2` to display as `3.3000000000000003` as it
> does with binary floating point."*

That is the cosmetic half. The half that ends an audit is the next bullet:

> *"The exactness carries over into arithmetic. In decimal floating point,
> `0.1 + 0.1 + 0.1 - 0.3` is exactly equal to zero. In binary floating point, the
> result is `5.5511151231257827e-017`. While near to zero, the differences prevent
> reliable equality testing and differences can accumulate. For this reason,
> decimal is preferred in accounting applications which have strict equality
> invariants."*

Read "strict equality invariants" as what it means in a ledger: *debits equal
credits*, *the sum of the line items equals the invoice total*, *the allocation
sums back to the amount allocated*. Those are equality tests. Under binary floats
they are equality tests against a residue of a few ulps, so the codebase grows a
tolerance — `abs(total - sum(lines)) < 0.005` — and the tolerance is now the
specification. Nobody wrote down what happens when the residue exceeds it.

```python
from decimal import Decimal

# Binary: the invariant is approximately true, which is not true.
0.1 + 0.1 + 0.1 - 0.3          # not 0.0

# Decimal: the invariant is true.
Decimal('0.1') + Decimal('0.1') + Decimal('0.1') - Decimal('0.3')  # Decimal('0.0')
```

Three consequences follow, and they compound:

1. **Equality fails**, so reconciliation code grows tolerances that hide real bugs.
2. **Error accumulates.** One float cent of drift per row is invisible; ten million
   rows of drift is a reconciliation ticket.
3. **`round()` on a float double-rounds**, because the value being rounded is
   already the wrong value — the `round(2.675, 2)` case worked through in
   [09c](09c-double-rounding-and-policy.md). No rounding policy can repair an
   input that was never 2.675.

## What `Decimal` guarantees — and what it does not

The module's own framing is worth quoting because it sets the scope:

> *"Decimal 'is based on a floating-point model which was designed with people in
> mind, and necessarily has a paramount guiding principle – computers must provide
> an arithmetic that works in the same way as the arithmetic that people learn at
> school.'"*

and

> *"The decimal module was designed to support 'without prejudice, both exact
> unrounded decimal arithmetic (sometimes called fixed-point arithmetic) and
> rounded floating-point arithmetic.'"*

**Guaranteed:**

- Any decimal string within the exponent limits is held *exactly*. `Decimal('0.01')`
  is one hundredth, not the nearest double to one hundredth.
- Arithmetic is *correctly rounded* to the context precision, per IBM's General
  Decimal Arithmetic Specification — a single, well-defined rounding step, not a
  cascade.
- Precision is yours: *"the decimal module has a user alterable precision
  (defaulting to 28 places) which can be as large as needed for a given problem"*.
- Significance is preserved: trailing zeros are part of the value, so `1.30 + 1.20`
  is `2.50` ([10c](10c-quantize-and-fixed-point-discipline.md)).
- You can force exactness to be checked rather than hoped for: *"This includes an
  option to enforce exact arithmetic by using exceptions to block any inexact
  operations."* That is the `Inexact` trap, worked in
  [10c](10c-quantize-and-fixed-point-discipline.md).

**Not guaranteed, and each of these has shipped a bug:**

- **It is still floating point.** `Decimal(1) / Decimal(7)` at the default
  precision is a 28-digit approximation. `Decimal` removes *representation* error
  for decimal fractions; it does not remove *round-off* error.
- **Division is not exact.** Any quotient with a non-terminating decimal expansion
  is rounded to `prec` significant digits, and `prec` counts digits of the whole
  number, not digits after the point.
- **It is not a fixed-point type.** Nothing in `Decimal` pins you to two decimal
  places; `Decimal('1.00') / 3` has 28 of them. Holding a scale is a discipline
  you apply with `quantize`, not a property of the type.
- **It does not choose a rounding policy for you.** The default is
  `ROUND_HALF_EVEN`, which is very likely not what your tax authority specifies
  ([10e](10e-rounding-modes-for-money.md)).

`Decimal` is also not the only defensible representation. An `int` counting the
currency's smallest unit — 1999 for $19.99 — is exact by construction rather than
by discipline, and wins outright in some architectures; that trade is argued in
full in [10m](10m-decimal-versus-integer-minor-units.md).

## The model: sign, coefficient, exponent

> *"A decimal number is immutable. It has a sign, coefficient digits, and an
> exponent. To preserve significance, the coefficient digits do not truncate
> trailing zeros. Decimals also include special values such as `Infinity`,
> `-Infinity`, and `NaN`. The standard also differentiates `-0` from `+0`."*

The exponent is the load-bearing part for money. A `Decimal` whose exponent is
`-2` *is* a value in cents; a fixed-point money invariant is precisely "every
amount in this system has exponent `-2`". You can read it:

```python
from decimal import Decimal

Decimal('2.50').as_tuple()    # DecimalTuple(sign=0, digits=(2, 5, 0), exponent=-2)
Decimal('2.5').as_tuple()     # DecimalTuple(sign=0, digits=(2, 5), exponent=-1)

def is_money(d: Decimal) -> bool:
    return d.as_tuple().exponent == -2
```

`adjusted()` gives the other half of the picture — where the most significant
digit sits: the docs note *"`Decimal('321e+5').adjusted()` returns seven"*, i.e.
the exponent the value would have in scientific notation.

Significance — the reason `Decimal('2.50')` keeps its trailing zero, and the
reason multiplication *grows* the number of places — is the hinge on which
fixed-point discipline turns, and is taken apart in
[10c](10c-quantize-and-fixed-point-discipline.md).

## Constructing one

```python
from decimal import Decimal

Decimal('19.99')                 # exact — the only construction you should reach for
Decimal(1999)                    # exact — integers are exact by definition
Decimal((0, (1, 4, 1, 4), -3))   # Decimal('1.414') — sign, digit tuple, exponent
```

The string form is exact because the constructor does not consult the context for
value: *"The context precision does not affect how many digits are stored. That is
determined exclusively by the number of digits in value. For example,
`Decimal('3.00000')` records all five zeros even if the context precision is only
three."* The FAQ calls this "what you type is what you get". The consequence for
precision is the subject of [10b](10b-contexts-precision-and-signals.md).

The `context` argument does not round — it only decides how a bad string fails:

> *"The purpose of the context argument is determining what to do if value is a
> malformed string. If the context traps `InvalidOperation`, an exception is
> raised; otherwise, the constructor returns a new Decimal with the value of
> `NaN`."*

### From a float: almost never, and here is exactly why

> *"If value is a float, the binary floating-point value is losslessly converted
> to its exact decimal equivalent. This conversion can often require 53 or more
> digits of precision. For example, `Decimal(float('1.1'))` converts to
> `Decimal('1.100000000000000088817841970012523233890533447265625')`."*

That is not the constructor being unhelpful — it is the honest answer. The double
nearest to `1.1` *is* that number, and `Decimal(1.1)` shows you the value your
float has always had. The corruption happened at the literal, one step before
`decimal` was involved; converting afterwards cannot undo it.

So: **if a float reaches your money layer, the money is already wrong.** Fix the
boundary — parse the JSON with `parse_float=Decimal`, read the column as
`numeric`, keep the API contract a string
([10k](10k-json-and-the-wire-format.md)) — rather than converting a float
and hoping the rounding hides it. When a float genuinely *is* the source of truth,
there is a sanctioned explicit route (`from_float`, `create_decimal_from_float`)
that also keeps the `FloatOperation` flag meaningful; that mechanism, and the
3.14 additions `Decimal.from_number` and `IEEEContext`, are worked through in
[10h](10h-decimal-and-the-other-numeric-types.md) and
[10b](10b-contexts-precision-and-signals.md).

## Gotchas

**★ `Decimal(0.1)` and `Decimal('0.1')` are different numbers, and the difference is
fifty-five digits long.** The parenthesised float is converted exactly, so you get
`Decimal('0.1000000000000000055511151231257827021181583404541015625')`. Two
records built by the two routes will compare unequal, hash differently, and
serialise differently. The fix is a single boundary function that only ever takes
`str` or `int` — and a lint rule (`flake8`, `ruff`) or a test that greps the
codebase for `Decimal(` followed by a float literal.

**★ A malformed string does not always raise.** `Decimal('12,50')` raises
`InvalidOperation` under the default context because `InvalidOperation` is trapped
by default — but pass a context that does not trap it and you silently get
`Decimal('NaN')`, which then propagates through every subsequent computation
producing more `NaN`s. If you build a permissive context for a batch job, you have
converted parse errors into silent nulls. Validate first, then convert:

```python
from decimal import Decimal, InvalidOperation

def parse_amount(s: str) -> Decimal:
    try:
        return Decimal(s.strip())
    except InvalidOperation as exc:
        raise ValueError(f"not an amount: {s!r}") from exc
```

**★ Non-ASCII digits parse.** *"Other Unicode decimal digits are also permitted
where digit appears above. These include decimal digits from various other
alphabets (for example, Arabic-Indic and Devanāgarī digits) along with the
fullwidth digits `'０'` through `'９'`."* So a user-supplied amount in
Arabic-Indic digits constructs a perfectly valid `Decimal`. `Decimal()` is a
*converter*, not an *input validator* — if your API contract says ASCII digits,
check that yourself before converting.

**★ Underscores are stripped, including in the middle of user input.** *"Changed in
version 3.6: Underscores are allowed for grouping, as with integral and
floating-point literals in code."* `Decimal('1_000.00')` is one thousand. Fine for
source literals; a hole in a validator that assumed a non-digit would fail.

**★ Whitespace is stripped too.** The syntax applies *"after leading and trailing
whitespace characters, as well as underscores throughout, are removed"*. So
`Decimal(' 19.99\n')` works — convenient, and one more reason `Decimal()`
succeeding is not evidence that the input was well-formed.

## Interview questions

**★ Why can a `float` not hold `0.01`, and why does that matter more for money than
for, say, a physics simulation?**
A double is a binary fraction: a sign, a 53-bit significand, and a power of two.
`0.01` is `1/100`, and 100 has the factor 5, so `1/100` has no finite binary
expansion — the stored value is the nearest double, which is slightly off. A
physics simulation tolerates that because its inputs are already measurements with
error bars and its outputs are compared with tolerances. An accounting system does
the opposite: its inputs are *exact by definition* (an invoice really is 19.99,
not 19.99 ± ε) and its outputs are compared with equality — the ledger balances or
it does not. Introducing representation error into exact data and then testing it
for equality is the mismatch.

**★ `Decimal` is exact, so why does `Decimal(1) / Decimal(7)` not give the exact
answer?**
Because `Decimal` removes representation error, not round-off error. It is a
*floating-point* type with a decimal radix: values are a coefficient times a power
of ten, and the coefficient has at most `prec` digits (28 by default). One seventh
has no terminating decimal expansion at any finite precision, so the result is
correctly rounded to 28 significant digits. What `Decimal` guarantees is that
every value you can *write* as a decimal string is held exactly, and that every
operation is correctly rounded exactly once.

**★ Someone shows you `Decimal(1.1)` printing fifty-five digits and calls it a bug in
`decimal`. What do you say?**
It is the opposite of a bug — it is the only honest answer. `1.1` as a float is
not 1.1; it is the nearest double, whose exact value is
`1.100000000000000088817841970012523233890533447265625`. The constructor converts
losslessly, so it shows you that value. `Decimal('1.1')` gives 1.1 because the
string says 1.1. The corruption occurred at the float literal, one step before
`decimal` was involved.

**★ A colleague proposes storing money as `float` but rounding to two places on
every read. Why does that not work?**
Because rounding a wrong value cannot produce the right one, and because the
rounding itself is a second error. The stored double is already not the amount;
`round()` on it is a rounding of the *approximation*, which for values sitting
just under a half-way point (the documented `round(2.675, 2)` case) rounds the
wrong direction. Worse, the invariant checks — sum of lines equals total — happen
on the unrounded values, so they still fail, and you still need tolerances.
Rounding on read moves the error to where you cannot see it.

---

← Prev: [Double rounding and policy](09c-double-rounding-and-policy.md) · Index: [Numbers](README.md) · Next → [Contexts, precision and signals](10b-contexts-precision-and-signals.md)

{/* FOOTER */}
