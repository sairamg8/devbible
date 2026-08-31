---
title: "Rounding twice is not rounding once, and a NUMERIC column is a rounding step you did not write"
sidebar_label: "9c · Double rounding and policy"
sidebar_position: 92
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Python 3.14 library reference for
> [`round()`](https://docs.python.org/3.14/library/functions.html#round),
> [Numeric Types — int, float, complex](https://docs.python.org/3.14/library/stdtypes.html#numeric-types-int-float-complex),
> [`math`](https://docs.python.org/3.14/library/math.html) and the
> [`decimal` FAQ](https://docs.python.org/3.14/library/decimal.html#decimal-faq),
> plus the PostgreSQL 18 manual on
> [numeric types](https://www.postgresql.org/docs/current/datatype-numeric.html).
> Version spine: **Python 3.14.7**.

**Nearest-value rounding does not compose. Rounding to three places and then to
two is not the same operation as rounding to two, because the first step can
push a value onto or across the boundary the second step tests. That is the
mechanism behind almost every "the total is off by a cent" report, and the
hardest instances involve a rounding nobody wrote: a `NUMERIC(12, 2)` column
rounds on insert, so an application that also rounds for display has rounded
twice. The discipline that survives an audit is: round exactly once, at a place
you named, and decide in writing whether you are rounding the lines or the
total.**

## Double rounding: the cent that goes missing

```python
x = 2.4449
round(x, 3)                 # a value at the .445 boundary
round(round(x, 3), 2)       # the second rounding now sees a tie it did not have
round(x, 2)                 # the single-step answer
```

The mechanism: rounding to three places moves a value that was strictly below a
two-place boundary onto it, and the second rounding then applies the tie rule to
a tie that the original number did not have. Formally, the composition of two
nearest-value roundings is not a nearest-value rounding of the original — the
intermediate has destroyed the information the second step needed.

The two places it happens by accident:

- A helper that rounds "to be safe" before returning, whose result is then
  rounded again by the caller for display.
- A value stored in a `NUMERIC(12, 4)` column, read back, and rounded to 2 for a
  report. **The storage step was a rounding.** PostgreSQL's manual: *"If the
  scale of a value to be stored is greater than the declared scale of the
  column, the system will round the value to the specified number of fractional
  digits."*

`decimal`'s answer is to not round intermediates at all. Its FAQ recommends
running the arithmetic at higher precision and rounding once at the end:

> *"A best practice is to re-run calculations using greater precision and with
> various rounding modes. Widely differing results indicate insufficient
> precision, rounding mode issues, ill-conditioned inputs, or a numerically
> unstable algorithm."*

and the module documents the shape directly, as the `localcontext` recipe:

```python
from decimal import localcontext

with localcontext() as ctx:
    ctx.prec = 42   # Perform a high precision calculation
    s = calculate_something()
s = +s  # Round the final result back to the default precision
```

The `s = +s` line is the whole idea in one character: unary plus is an
arithmetic operation, so it applies the *outer* context's precision and rounding
exactly once, to the final value.

## Round-then-sum versus sum-then-round

These are different numbers, and neither is universally right:

```python
lines = [Decimal("1.005"), Decimal("1.005"), Decimal("1.005")]

sum(round(x, 2) for x in lines)     # each line rounded, then added
round(sum(lines), 2)                # added exactly, then rounded once
```

Which one is correct is a **business** question, not a numeric one:

- An invoice that *prints* a rounded amount per line must sum the **rounded**
  lines, or the printed lines will not add up to the printed total, and someone
  will file a bug that is not a bug.
- A tax or interest computation defined on the total must round the **total**,
  because that is what the rule says.

Pick one, write it down, and make the code say which one it is. A function named
`sum_of_rounded_lines` cannot be misread the way `total(lines)` can.

The invariant worth enforcing in tests, whichever you choose: **the displayed
parts must reconstruct the displayed whole.** When they cannot — three ways to
split ten cents — you need an allocation step that distributes the leftover
deliberately rather than letting rounding decide:

```python
from decimal import Decimal, ROUND_DOWN

def allocate(total: Decimal, weights: list[int], places: str = "0.01") -> list[Decimal]:
    """Split total by weight so the parts sum back to exactly total."""
    unit = Decimal(places)
    denom = sum(weights)
    parts = [(total * w / denom).quantize(unit, rounding=ROUND_DOWN) for w in weights]
    remainder = total - sum(parts)
    step = unit.copy_sign(remainder)
    i = 0
    while remainder != 0:
        parts[i] += step
        remainder -= step
        i = (i + 1) % len(parts)
    return parts
```

Round every part *down*, then hand the leftover units out one at a time. The
sum is exact by construction, the bias is explicit rather than emergent, and
the rule ("earlier lines absorb the leftover") is a sentence you can put in a
specification.

## The non-rounding alternatives

When you do not want nearest-value semantics at all, do not configure
`round()` — use the function that says what you mean. All three delegate to a
dunder, so they stay exact on `Fraction` and `Decimal`:

```python
import math

math.floor(x)   # toward -inf   (delegates to x.__floor__)
math.ceil(x)    # toward +inf   (delegates to x.__ceil__)
math.trunc(x)   # toward 0      (delegates to x.__trunc__)
int(x)          # toward 0 for floats
```

The library reference is explicit that `int()` is a truncation, not a rounding:

> *"Conversion from `float` to `int` truncates, discarding the fractional part.
> See functions `math.floor()` and `math.ceil()` for alternative conversions."*

and `math.trunc` states the relationship between all three:

> *"Return x with the fractional part removed, leaving the integer part. This
> rounds toward 0: `trunc()` is equivalent to `floor()` for positive x, and
> equivalent to `ceil()` for negative x."*

## Where to put the single rounding

Three defensible places, in order of preference:

1. **At presentation.** Keep the exact value everywhere and round only in the
   formatter. Correct for reports, wrong the moment the rounded number is
   something the business commits to (a charge, a payment, a tax line).
2. **At the point of commitment.** Round once, when the number becomes a fact —
   the amount actually charged — and store the rounded value. Everything
   downstream reads the committed number and never rounds again.
3. **At the storage boundary, deliberately.** If a column has a scale, quantise
   to that scale in application code *before* the insert, so the rounding is
   visible in a diff and testable, rather than being performed silently by the
   database with its own mode.

The failure mode is having all three without noticing.

## Gotchas

**★ Rounding twice is not rounding once.** Any intermediate `round()` can push a
value across a boundary the single-step rounding would not have crossed. Round
exactly once, at presentation or at commitment, and never in a helper "for
safety".

**★ A `NUMERIC(p, s)` column is a rounding step you did not write.** Values are
rounded to the column's scale on insert — PostgreSQL states this explicitly. If
the application also rounds for display, that is double rounding by
construction, and it is invisible in the Python code because it happens in the
database.

**★ …and if the value does not fit, you get an error rather than a rounding.**
PostgreSQL again: *"Then, if the number of digits to the left of the decimal
point exceeds the declared precision minus the declared scale, an error is
raised."* Scale overflow rounds silently; precision overflow raises. Two
different outcomes from one column definition.

**★ `int(x + 0.5)` is not `round(x)`.** It rounds half away from zero for
positive `x` but toward zero for negative `x`, so it is not even self-consistent,
and the `+ 0.5` introduces its own float error which can push a value just under
a half over it. If you want half-up semantics use `Decimal` with
`ROUND_HALF_UP`; if you want truncation use `math.trunc`.

**★ Summing rounded lines and rounding the summed total give different answers,
and both are defensible.** This is a specification gap, not a bug. Decide it
explicitly, name the function after the decision, and put the decision in a
test.

**★ Naive proportional splitting does not sum back to the total.** Three equal
shares of ten cents rounded independently do not make ten cents. Allocate with
an explicit remainder pass, as above, rather than hoping the rounding errors
cancel — they do not, and the direction they fail in depends on the data.

**★ The remainder in an allocation can be negative.** For a negative total
(a refund), the leftover has the opposite sign, so a loop that adds a fixed
positive unit never terminates. `unit.copy_sign(remainder)` handles it;
`Decimal('0.01')` hard-coded does not.

**★ Rounding at every layer feels defensive and is the opposite.** Each layer
that rounds "so the next one gets a clean number" adds a composition step. The
defensive move is to carry the exact value and round once, as late as the
business rule allows.

## Interview questions

**★ Why is `round(round(x, 3), 2)` not always `round(x, 2)`?**
Because the first rounding can move the value onto or across the two-place
boundary the second rounding tests. Nearest-value rounding is not composable:
the composition of two of them is not a nearest-value rounding of the original.
This is double rounding, and it is the standard explanation for a total that is
off by one cent.

**★ Should you round each invoice line, or round the total?**
It depends on what is printed. If each line is displayed rounded, the total must
be the sum of the rounded lines, or the document does not add up. If the
requirement is defined on the total — many tax rules are — round the total once.
The two produce different numbers; the job is to pick one deliberately and make
the choice visible at the call site.

**★ How does a database column participate in double rounding?**
A `NUMERIC(p, s)` column rounds on insert: *"If the scale of a value to be
stored is greater than the declared scale of the column, the system will round
the value to the specified number of fractional digits."* If the application
rounds for display after reading that value back, there have been two roundings
and the second is operating on a number the first one already moved. Quantise
in application code before the insert so the rounding is in the diff.

**★ How do you split £10.00 three ways so the parts sum back to £10.00?**
Round every part *down* to the target exponent, compute the leftover as
`total - sum(parts)`, and distribute it one minor unit at a time by a stated
rule (first-N lines, largest remainder, or round-robin). The sum is then exact
by construction and the bias is a documented policy rather than an artefact of
which way the rounding happened to fall.

**★ Why is `int(x + 0.5)` a bad substitute for `round(x)`?**
Three reasons. It rounds half away from zero for positive numbers but toward
zero for negative ones, so it is asymmetric. The addition introduces float
error, so values just below a half can be pushed over it. And `int()` truncates
rather than rounds — *"Conversion from `float` to `int` truncates, discarding
the fractional part"* — so the whole construction depends on an addition that is
not exact.

**★ What does `s = +s` do in the `decimal` high-precision recipe, and why is it
there?**
Unary plus is an arithmetic operation, so it applies the current context's
precision and rounding to its operand. Inside a `localcontext(prec=42)` block
the arithmetic runs at 42 digits; the `+s` executes *after* the block, under the
outer context, and is therefore the single deliberate rounding back to the
application's working precision. It is the smallest possible way to say "round
once, here".

**★ Where should the single rounding live in a payment system?**
At the point of commitment — the moment the number becomes something the
business owes or charges. Before that, carry the exact value; after that,
everything reads the committed number and never rounds again. Rounding only at
presentation is wrong for money because two views could then disagree; rounding
in intermediate helpers is wrong because it composes.

---

← Prev: [round() per type](09b-round-per-type-and-double-rounding.md) · Index: [Numbers](README.md) · Next → **Decimal for money** *(not written yet)*

{/* FOOTER */}
