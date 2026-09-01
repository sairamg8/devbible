---
title: "There are exactly two defensible ways to represent money in Python, and integer minor units wins wherever the arithmetic is addition and the consumer is another system"
sidebar_label: "10m · Decimal vs minor units"
sidebar_position: 112
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`decimal`](https://docs.python.org/3.14/library/decimal.html) — the module
> introduction, [`Decimal.scaleb`](https://docs.python.org/3.14/library/decimal.html#decimal.Decimal.scaleb)
> and the [FAQ on CPython performance](https://docs.python.org/3.14/library/decimal.html#decimal-faq) —
> [`int`](https://docs.python.org/3.14/library/functions.html#int), and the
> PostgreSQL 18 manual on
> [numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html).
> Version spine: **Python 3.14.7**, PostgreSQL 18.

**`Decimal` is not the only correct answer. The other one is an `int` counting the
smallest unit the currency has — 1999 for $19.99, 1000 for ¥1,000, 1234 for
KWD 1.234 — and it is exact by construction rather than by discipline. Integers
cannot round, cannot carry a wrong scale, cannot be silently converted by a JSON
library, and are the native type of every payment API's wire format. What they
cannot do is divide, hold a rate, or tell you which currency they are. Choosing
between the two is a real decision with a real answer per system, and the worst
outcome is having both in the same codebase without a boundary between them.**

## The two representations

```python
from decimal import Decimal

price_decimal = Decimal('19.99')     # an exact decimal value with an exponent
price_units   = 1999                 # a count of cents; the scale is external
```

The difference is where the scale lives. In `Decimal` the scale is *in the value*
— it is the exponent, and every operation may change it, so you defend it with
`quantize` ([10c](10c-quantize-and-fixed-point-discipline.md)). In minor units the
scale is *in the type's meaning* — "this int is cents" — and no arithmetic can
change it, because integer arithmetic has no exponent to move. You pay for that by
having to know the currency's exponent at every conversion.

## Where integer minor units win

**Exactness is structural, not disciplinary.** `a + b`, `a - b` and `a * n` on
`int` are exact with no context, no `prec`, no rounding mode, no traps, and no way
for a library to change the answer by mutating thread state
([10j](10j-decimal-contexts-across-threads.md)). Whole categories of this topic's
gotchas simply do not exist.

**The wire format is already integers.** Payment gateways and card schemes almost
universally take an integer amount plus a currency code, precisely because it is
unambiguous across languages. If your system's job is to talk to those APIs,
converting to `Decimal` on the way in and back on the way out is two conversions
that can each be wrong.

**JSON survives.** An integer under 2^53 round-trips through JavaScript exactly,
so `{"amount": 1999, "currency": "USD"}` needs no string encoding and no
`parse_float` hook ([10k](10k-json-and-the-wire-format.md)). This is the single
biggest practical advantage in a service architecture with a browser at the end.

**Databases index and aggregate them fast.** `BIGINT` sums, indexes and compares
in the database's fastest path; PostgreSQL's own manual notes that *"calculations
on `numeric` values are very slow compared to the integer types"*. For a ledger
that mostly does `SUM(amount) GROUP BY`, the difference is architectural, not
cosmetic.

**Nothing can silently convert them.** There is no float that an `int` decays into
by accident, no `default=float`, no ORM column type that quietly becomes a double.

## Where `Decimal` wins

**Anything that is not addition.** Interest, tax rates, FX conversion,
amortisation, per-unit pricing and prorating are multiplications and divisions by
non-integers. In minor units you must do those in some other type anyway — and if
that type is `float`, you have lost everything the integers bought you.

**Sub-minor-unit precision.** Fuel prices in tenths of a cent, per-thousand-token
API pricing, unit costs at four or six decimal places: the currency's minor unit
is not the smallest amount the *system* needs. Scaling the integers by another
factor of ten works right up until two parts of the system disagree about the
factor.

**Human-facing values.** `str(Decimal('19.99'))` is `'19.99'`; `str(1999)` needs a
formatter that knows the currency exponent. Every display, every export, every log
line goes through that formatter.

**The value carries its own scale.** A `Decimal` you receive can be *inspected* —
`as_tuple().exponent`, `same_quantum` — while an `int` you receive is
indistinguishable from any other `int`. A function that takes a bare `int` amount
cannot detect that the caller passed dollars.

## The hybrid, which is what most systems actually want

Store integers, compute in `Decimal`, and make the conversion the only place the
currency exponent appears:

```python
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

EXPONENT = {"USD": 2, "EUR": 2, "JPY": 0, "KWD": 3}

@dataclass(frozen=True)
class Money:
    units: int          # minor units — the storage and wire representation
    currency: str

    @property
    def amount(self) -> Decimal:
        """The decimal value, for arithmetic and display."""
        return Decimal(self.units).scaleb(-EXPONENT[self.currency])

    @classmethod
    def from_decimal(cls, value: Decimal, currency: str) -> "Money":
        exp = EXPONENT[currency]
        scaled = value.scaleb(exp)
        units = int(scaled.to_integral_exact(rounding=ROUND_HALF_UP))
        return cls(units, currency)

    def __add__(self, other: "Money") -> "Money":
        if self.currency != other.currency:
            raise ValueError(f"cannot add {self.currency} to {other.currency}")
        return Money(self.units + other.units, self.currency)
```

`scaleb` moves the exponent rather than multiplying, so both conversions are exact
and neither depends on the context's precision. `to_integral_exact` is the
deliberate choice over `int()`: it *signals* `Inexact` when the value was not a
whole number of minor units, so a fractional cent is a detectable event rather
than a truncation ([10i](10i-special-values-and-stdlib-interop.md)). Addition and
subtraction stay in `int`, where they cannot round; multiplication and division go
through `amount`, quantize, and come back through `from_decimal`.

## What decides it

| Question | Points to |
|---|---|
| Is the arithmetic mostly `+`, `-` and `* int`? | minor units |
| Does a browser consume the amounts as JSON numbers? | minor units |
| Does the database do the aggregation? | minor units (`BIGINT`) |
| Are there rates, percentages, or per-unit prices? | `Decimal` |
| Do amounts need more precision than the currency's minor unit? | `Decimal` |
| Is the system multi-currency with different exponents? | either, but the exponent table is mandatory |
| Do humans read the raw values in logs and dumps? | `Decimal` |

What is *not* on this list is `float`, in any row.

## Gotchas

**★ "Amount in cents" is a lie for a third of the world's currencies.** The scale
factor is the currency's ISO 4217 exponent, not 100: yen is 1, dinar is 1000. A
codebase that multiplies by 100 to "convert to cents" overcharges JPY customers a
hundredfold and truncates KWD amounts ([10g](10g-tax-percentages-and-minor-units.md)).

**★ A bare `int` amount is untyped.** Nothing distinguishes 1999 cents from 1999
dollars from 1999 anything. The representation is only safe inside a type that
carries the currency; passing raw ints across a module boundary reintroduces every
unit-confusion bug the exactness was supposed to prevent.

**★ `int(decimal_value * 100)` truncates and can be wrong by a cent.** `int()`
truncates toward zero, so a value that is `19.989999…` for any reason becomes 1998.
Use `scaleb` to move the exponent and `to_integral_exact` (or an explicit
`quantize` first) so the rounding is a decision and a fractional unit is
detectable.

**★ Mixing the two representations without a boundary is worse than either.** A
codebase where some functions take `Decimal` dollars and others take `int` cents
will, eventually, pass one to the other. The type checker cannot help you if both
are `int`/`Decimal` rather than a named `Money`.

**★ `BIGINT` overflows are real for high-inflation currencies.** 2^63 minor units
is a large but finite number, and currencies with large nominal values plus
sub-unit precision reach it sooner than you expect. `numeric` has no such limit —
its declared precision maximum is 1000 digits.

**★ Integers do not stop you rounding wrongly; they stop you rounding
accidentally.** Every division still has to round somewhere, and if that somewhere
is a `float` intermediate you have converted a discipline problem into a
correctness problem. Do the division in `Decimal` and come back.

**★ ORMs will happily map a `NUMERIC` column to `float`.** Whichever
representation you pick, assert the Python type coming back from the database in a
test rather than trusting the mapping — and note that the driver's behaviour is a
property of the driver, not of the column type
([10l](10l-sql-storage-for-decimal.md)).

## Interview questions

**★ Argue for integer minor units over `Decimal`.**
Because exactness becomes structural rather than disciplinary. Integer addition,
subtraction and multiplication by a count cannot round, cannot be affected by a
context that another thread or library changed, and cannot be silently turned into
a double by a JSON encoder or an ORM. The wire format of essentially every payment
API is already an integer plus a currency code, and an integer under 2^53
round-trips through JavaScript exactly, so the browser gets the true value without
string encoding. Databases sum and index `BIGINT` on their fastest path, whereas
PostgreSQL's own manual warns that `numeric` calculations are *"very slow compared
to the integer types"*.

**★ Now argue against it.**
Because money is not only added. The moment there is a tax rate, an interest
accrual, an FX conversion or a per-unit price, you need non-integer arithmetic, and
if the type you reach for at that moment is `float`, the integers bought you
nothing. Minor units also cannot express sub-cent precision without a second,
undocumented scale factor, cannot tell you their own currency, and cannot be
displayed without a formatter that knows the exponent. And a bare `int` is
untyped: 1999 could be anything.

**★ So what do you actually build?**
A `Money` value object storing `int` minor units plus a currency code, exposing a
`Decimal` view for arithmetic that is not addition, with the currency's ISO 4217
exponent appearing in exactly one table. Addition and subtraction stay in integer
space. Multiplication by a rate converts to `Decimal`, applies the rate, quantizes
with an explicit rounding mode, and converts back through a function that signals
rather than truncates when the result is not a whole number of minor units. The
integers are the storage and wire representation; `Decimal` is the arithmetic
representation; nothing else in the codebase sees either one raw.

**★ How do you convert between them without introducing a rounding bug?**
With `scaleb`, not multiplication, because `scaleb` adjusts the exponent and
therefore cannot round: `Decimal(units).scaleb(-exponent)` going out and
`value.scaleb(exponent)` coming in. Then turn the scaled value into an `int` with
`to_integral_exact` and an explicit rounding mode rather than `int()`, so that a
value carrying a fraction of a minor unit signals `Inexact` instead of being
silently truncated toward zero.

**★ Is `Decimal` slow, and does that ever decide the representation?**
Not in the way people assume. The FAQ is explicit that the C implementation is
fast — *"In the CPython and PyPy3 implementations, the C/CFFI versions of the
decimal module integrate the high speed libmpdec library for arbitrary precision
correctly rounded decimal floating-point arithmetic"*, using Karatsuba
multiplication for medium numbers and the Number Theoretic Transform for very
large ones. It is still slower than machine integers, and each operation allocates
an object, so a tight loop over millions of amounts is measurably different from
the same loop over `int`. But the decision is usually made in the database, not in
Python: PostgreSQL's manual notes that `numeric` calculations are *"very slow
compared to the integer types"*, and a ledger that aggregates in SQL feels that far
more than it feels the Python cost. Measure your own workload rather than choosing
on reputation.

**★ A colleague proposes storing money as an integer number of cents in a `FLOAT`
column "because it is always a whole number anyway". What do you say?**
That doubles hold integers exactly only up to 2^53, that any arithmetic the
database does on the column can produce a non-integer that is then stored, and
that the moment anything divides — an average, a share, a report — the value stops
being whole and nothing detects it. The type should be `BIGINT` if the
representation is minor units, or `NUMERIC(p, s)` if it is decimal amounts. There
is no reading of the requirements under which a binary float is the right column.

---

← Prev: [SQL storage for Decimal](10l-sql-storage-for-decimal.md) · Index: [Numbers](README.md) · Next → [Fraction](11-fraction.md)

{/* FOOTER */}
