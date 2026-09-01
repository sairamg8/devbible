---
title: "Tax is an allocation problem wearing a multiplication costume, and the number of decimal places money has is a property of the currency, not of your schema"
sidebar_label: "10g · Tax, percentages, minor units"
sidebar_position: 106
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`Decimal.quantize`](https://docs.python.org/3.14/library/decimal.html#decimal.Decimal.quantize)
> and [Rounding modes](https://docs.python.org/3.14/library/decimal.html#rounding-modes),
> and the [`decimal` FAQ](https://docs.python.org/3.14/library/decimal.html#decimal-faq)
> on preserving fixed point. Tax rules and currency exponents are cited to
> ISO 4217 and named jurisdictions, not to the Python documentation.
> Version spine: **Python 3.14.7**.

**Two decimal places is not a fact about money; it is a fact about *some*
currencies. Japanese yen has none, Kuwaiti dinar has three, and a system that
hard-codes `Decimal('0.01')` will quantize ¥1,234 to ¥1,234.00 and lose a whole
dinar of precision on KWD. On top of that, every percentage applied to money —
tax, discount, revenue share — produces a value with more places than it started
with, so each one is a rounding decision, and a set of them applied to a set of
lines is an allocation decision. This page is the intersection: getting the scale
from the currency, and getting the percentages to add up.**

## Percentages and tax

A percentage split is an allocation, not a multiplication. "70/30 revenue share on
£10.01" is `allocate(Decimal('10.01'), [70, 30])`, which returns parts summing to
10.01. Computing `10.01 * Decimal('0.7')` and rounding gives 7.01, and `* 0.3`
rounds to 3.00, and the pair sums to 10.01 by luck; on other amounts it will not.

Tax has the same shape with an extra decision nobody documents until it is wrong:
**is the tax computed on the total and then allocated, or computed per line and
summed?** The two differ by cents and both are used in practice.

```python
from decimal import Decimal, ROUND_HALF_UP

CENTS = Decimal('0.01')
VAT = Decimal('0.20')

def tax_on_total(lines: list[Decimal]) -> Decimal:
    return (sum(lines) * VAT).quantize(CENTS, rounding=ROUND_HALF_UP)

def tax_per_line(lines: list[Decimal]) -> Decimal:
    return sum((line * VAT).quantize(CENTS, rounding=ROUND_HALF_UP) for line in lines)
```

Whichever your jurisdiction and your accounting system require, the two must not
be mixed within one document: if line-level tax is *displayed*, the invoice total
must be the sum of the displayed lines, or the invoice does not add up on screen.
When you need both — line-level display and a total computed on the total — use
`allocate` to push the difference back into the lines so the displayed numbers sum
to the computed total.

### Extracting net from gross

Tax-inclusive prices need the reverse operation, and the division makes it
inexact:

```python
def net_from_gross(gross: Decimal, rate: Decimal = VAT) -> tuple[Decimal, Decimal]:
    net = (gross / (1 + rate)).quantize(CENTS, rounding=ROUND_HALF_UP)
    return net, gross - net          # tax is the remainder, never a second rounding
```

Deriving the tax as `gross - net` rather than rounding `net * rate` separately is
the point: it guarantees `net + tax == gross` by construction. Two independent
roundings do not.

## The minor unit is a property of the currency

ISO 4217 assigns each currency an exponent: the number of digits in its minor
unit. Most are 2. JPY, KRW, ISK, VND and CLP are 0. BHD, IQD, JOD, KWD, LYD, OMR
and TND are 3. A few are stranger still — historically, MGA and MRU are
subdivided into fifths, which is not expressible as a decimal exponent at all.

```python
from decimal import Decimal, ROUND_HALF_UP

# Exponents from ISO 4217; keep this in one place, ideally sourced from a library.
EXPONENT = {"USD": 2, "EUR": 2, "GBP": 2, "JPY": 0, "KRW": 0, "KWD": 3, "BHD": 3}

def quantum(currency: str) -> Decimal:
    """The smallest representable amount in this currency, as a quantize target."""
    return Decimal(1).scaleb(-EXPONENT[currency])      # 0.01, 1, 0.001 …

def to_money(value: Decimal, currency: str, rounding=ROUND_HALF_UP) -> Decimal:
    return value.quantize(quantum(currency), rounding=rounding)
```

`scaleb(-n)` builds the target exponent exactly and reads better than a table of
string literals. `quantum("JPY")` is `Decimal('1')` — exponent 0 — and quantizing
to it produces a whole number with no decimal point, which is what a yen amount
should look like everywhere including in the database.

The consequence for the rest of the system is that **currency and amount must
travel together**. A bare `Decimal` cannot be validated, formatted, or summed
safely, because the correct number of places is unknown without the code. This is
the strongest argument for a `Money` value object: it is the only place the pair
can be kept honest.

```python
from dataclasses import dataclass
from decimal import Decimal

@dataclass(frozen=True)
class Money:
    amount: Decimal
    currency: str

    def __post_init__(self):
        if not self.amount.is_finite():
            raise ValueError(f"non-finite amount: {self.amount!r}")
        if not self.amount.same_quantum(quantum(self.currency)):
            raise ValueError(f"{self.amount} is not a whole {self.currency} minor unit")

    def __add__(self, other: "Money") -> "Money":
        if self.currency != other.currency:
            raise ValueError(f"cannot add {self.currency} to {other.currency}")
        return Money(self.amount + other.amount, self.currency)
```

Addition of two same-scale values is exact and preserves the scale
([10c](10c-quantize-and-fixed-point-discipline.md)), so `__add__` needs no
quantize — only the currency check. Multiplication and division do need one, with
the rounding mode chosen by policy ([10e](10e-rounding-modes-for-money.md)).

### Storage follows the currency too

A `NUMERIC(19, 2)` column cannot hold a three-decimal dinar amount without
rounding it on insert — PostgreSQL *"will round the value to the specified number
of fractional digits"* silently ([10l](10l-sql-storage-for-decimal.md)).
A multi-currency ledger therefore stores either the widest scale it will ever
need, or integer minor units plus the currency code, and never a scale chosen from
the developer's own currency.

## Discounts are allocations, not multiplications

A basket discount has the same shape as tax and the same failure. Take 10% off a
basket of three lines and apply it per line, and the discounted lines will not sum
to the discounted total. Compute the discount once on the total, then allocate the
discount across the lines in proportion to their values
([10f](10f-allocating-a-total-without-losing-a-cent.md)):

```python
def apply_basket_discount(lines: list[Decimal], rate: Decimal) -> list[Decimal]:
    total = sum(lines, Decimal('0.00'))
    discount = (total * rate).quantize(CENTS, rounding=ROUND_HALF_UP)
    shares = allocate(discount, [int(line.scaleb(2)) for line in lines])
    return [line - share for line, share in zip(lines, shares)]
```

The discounted lines now sum exactly to `total - discount`, which is what the
customer sees at the bottom of the receipt, and each line's discount is within one
cent of its proportional share.

## Compound and sequential rates

Where two rates apply — a service charge and then tax on the charged total, or a
federal and a local sales tax — the order and the rounding between them are part
of the specification, not an implementation detail.

```python
# Sequential, rounding between steps: each intermediate is a recorded amount.
subtotal = Decimal('100.00')
service  = (subtotal * Decimal('0.125')).quantize(CENTS, rounding=ROUND_HALF_UP)
taxable  = subtotal + service
tax      = (taxable * Decimal('0.20')).quantize(CENTS, rounding=ROUND_HALF_UP)

# Compound, rounding once: only the final amount is recorded.
total = (subtotal * Decimal('1.125') * Decimal('1.20')).quantize(CENTS,
                                                                rounding=ROUND_HALF_UP)
```

The two forms can differ by a cent, and both appear in real rules. Quantize
between steps when the intermediate is itself a figure that gets printed, stored
or reported; quantize once at the end when it is not. That is the same
double-rounding judgement as everywhere else ([09c](09c-double-rounding-and-policy.md)).

## Gotchas

**★ `Decimal('0.01')` hard-coded as "the money quantum" is a currency bug waiting
for its first JPY order.** Quantizing yen to two places produces amounts that are
not representable in the currency, and every display, export and reconciliation
downstream inherits the fiction. Derive the quantum from the currency code.

**★ Zero-decimal currencies break "amount in cents" assumptions in payment APIs.**
Several gateways take amounts as integer minor units; for JPY the minor unit *is*
the yen, so ¥1,000 is `1000`, not `100000`. Multiplying by 100 unconditionally
overcharges by a factor of a hundred. The scale factor is the currency exponent,
not the constant 2.

**★ Three-decimal currencies break the reverse assumption.** KWD 1.234 in integer
minor units is `1234`. A gateway that documents "amount in cents" and a schema
declared `NUMERIC(19, 2)` will both truncate or round the third digit, silently.

**★ A percentage rate is not money and must not be quantized to the money scale.**
`Decimal('0.0725')` quantized to two places is `Decimal('0.07')`, a 3% error in
the tax. Keep rates at their own precision; quantize only the *result* of applying
them.

**★ Tax computed per line and displayed per line must be summed for the total.**
Displaying line taxes and then printing a total computed on the subtotal gives an
invoice whose visible numbers do not add up. Pick one authority and derive the
other from it.

**★ Applying a discount rate per line does not produce the discounted total.** The
per-line roundings will not sum to the rounded discount on the total. Compute the
discount once and allocate it.

**★ Sequential and compound application of two rates give different answers.**
Rounding between the steps is a decision about whether the intermediate is a
recorded figure. Write it down in the code, because the difference will be
questioned eventually and "that is how it was implemented" is not an answer.

**★ `sum(lines)` with no start value returns `int` 0 for an empty basket.** The
comparison `sum([]) == Decimal('0.00')` is `True`, so tests pass, but the value
has no currency scale and `same_quantum` on it raises `AttributeError`. Use
`sum(lines, Decimal('0.00'))`, or better, a `Money.zero(currency)`.

**★ Rounding a rate into the money context by accident.** Any arithmetic on a rate
happens in the current context, so a `prec` low enough to matter — or a
`localcontext` set for money display — can round `0.0725` before it is ever
applied. Rates belong outside any narrowed context.

## Interview questions

**★ Sum of per-line tax, or tax on the sum?**
Both are used, and the choice is a jurisdiction and accounting-policy question,
not an engineering one — so the engineering job is to make sure only one is used
per document and that the displayed numbers add up. If lines show tax, the
invoice total must be the sum of the line taxes; if the total is authoritative,
allocate the total's tax back across the lines so the display sums correctly.
Mixing them produces an invoice that is off by a cent on screen, which is the
single most reported "rounding bug" in billing systems.

**★ How do you compute tax from a tax-inclusive price?**
Divide the gross by `1 + rate` and quantize to get the net, then take the tax as
`gross - net` rather than rounding `net * rate` independently. Subtraction of two
two-place values is exact, so `net + tax == gross` holds by construction; two
independent roundings would only hold by coincidence.

**★ Why is two decimal places the wrong default for a money type?**
Because the number of decimal places is a property of the currency, not of money.
ISO 4217 gives most currencies an exponent of 2, but JPY, KRW and ISK have 0 and
KWD, BHD, OMR and others have 3. Hard-coding `Decimal('0.01')` means yen amounts
carry two meaningless digits and dinar amounts silently lose one, in the
application and in the `NUMERIC(19, 2)` column alike. The quantum has to be
derived from the currency code, which in turn means amount and currency must be
carried together in one value object.

**★ A payment gateway asks for the amount "in cents". What do you send for ¥1,000
and for KWD 1.234?**
`1000` and `1234` respectively. The gateway means integer minor units, and the
minor unit is defined by the currency's ISO 4217 exponent: yen has exponent 0, so
one yen is one minor unit; dinar has exponent 3, so one dinar is a thousand. The
conversion is `int(amount.scaleb(exponent))` with the exponent looked up per
currency — never a hard-coded multiplication by 100, which overcharges
zero-decimal currencies a hundredfold.

**★ How do you apply a 10% basket discount so the line totals still add up?**
Compute the discount once on the basket total and round it once, then allocate
that discount across the lines in proportion to their values with a
remainder-distributing allocation, and subtract each line's share. Applying the
rate per line and rounding each gives per-line discounts whose sum is not the
rounded basket discount, so the printed lines do not reconcile with the printed
total.

**★ Two taxes apply to one order. What questions do you ask before writing the
code?**
Whether they apply sequentially (the second on a base that includes the first) or
in parallel on the same base; in which order; and whether each intermediate is a
recorded, reportable figure or only the final total is. The last question decides
whether you quantize between the steps or once at the end — a difference of a cent
that is fixed by the specification, not by preference. And whether the rates
themselves have a defined precision, because a rate rounded into the money scale
is a much larger error than any of this.

**★ Where does the rounding mode for tax come from?**
From the tax rule, not from `decimal`. Most jurisdictions specify rounding half
away from zero, which is `ROUND_HALF_UP` and not the module default of
`ROUND_HALF_EVEN`; some specify truncation; a few specify rounding at the invoice
level only. The mode should be a named constant next to the rule it implements,
passed explicitly to every `quantize`, so it is auditable and so it does not
inherit whatever the ambient thread context happens to hold.

---

← Prev: [Allocating a total](10f-allocating-a-total-without-losing-a-cent.md) · Index: [Numbers](README.md) · Next → [Decimal and the other numeric types](10h-decimal-and-the-other-numeric-types.md)

{/* FOOTER */}
