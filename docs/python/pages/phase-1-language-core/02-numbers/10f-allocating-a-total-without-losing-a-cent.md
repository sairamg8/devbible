---
title: "Splitting a total three ways and rounding each share loses a cent, so allocation must distribute the remainder rather than round the parts"
sidebar_label: "10f · Allocating a total"
sidebar_position: 105
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`Decimal.quantize`](https://docs.python.org/3.14/library/decimal.html#decimal.Decimal.quantize),
> [`Decimal.as_integer_ratio`](https://docs.python.org/3.14/library/decimal.html#decimal.Decimal.as_integer_ratio),
> [divmod on `Decimal`](https://docs.python.org/3.14/library/decimal.html#decimal.Decimal) and the
> [`decimal` FAQ](https://docs.python.org/3.14/library/decimal.html#decimal-faq).
> The allocation algorithm below is standard practice, not a documented API.
> Version spine: **Python 3.14.7**.

**Rounding is a property of a single number; allocation is a property of a set.
Divide 100.00 into three equal shares and round each, and you have 33.33 three
times — 99.99, with a cent unaccounted for. No rounding mode fixes this, because
every share really is 33.333…; the error is in treating the shares
independently. The correct operation computes the parts so that they sum to the
whole *by construction*, which means working in integer minor units, taking the
floor of each share, and handing out the leftover units one at a time.**

## Why per-share rounding cannot work

```python
from decimal import Decimal, ROUND_HALF_UP

CENTS = Decimal('0.01')
total = Decimal('100.00')

share = (total / 3).quantize(CENTS, rounding=ROUND_HALF_UP)   # Decimal('33.33')
# three of those sum to 99.99 — the business has lost a cent
```

Switching to `ROUND_UP` gives 33.34 three times, which sums to 100.02 — now the
business has invented two cents. Rounding each part is *always* wrong, because the
sum of independently rounded parts is not the rounded sum. What you need is an
operation whose postcondition is `sum(parts) == total`.

## The algorithm: minor units, floor, distribute the remainder

Three properties define a correct allocation:

1. **Exactness.** The parts sum to the total, always.
2. **Fairness.** No part differs from its ideal share by a whole minor unit; the
   maximum discrepancy between any two parts of equal weight is one cent.
3. **Determinism.** The same inputs in the same order produce the same parts, so
   the invoice you show and the invoice you post agree.

```python
from decimal import Decimal

CENTS = Decimal('0.01')

def allocate(total: Decimal, weights: list[int]) -> list[Decimal]:
    """Split `total` (a two-place Decimal) in proportion to integer weights.

    Postcondition: sum(result) == total, exactly.
    """
    if not weights or any(w < 0 for w in weights):
        raise ValueError("weights must be non-empty and non-negative")
    units = int(total.scaleb(2))          # amount in whole cents, exactly
    if units * CENTS != total:            # guard: total was not two-place
        raise ValueError(f"total is not a whole number of cents: {total!r}")
    denom = sum(weights)
    if denom == 0:
        raise ValueError("weights sum to zero")

    parts, allocated = [], 0
    for w in weights:                     # floor of each ideal share
        share = units * w // denom
        parts.append(share)
        allocated += share

    remainder = units - allocated         # 0 <= remainder < len(weights)
    order = sorted(                       # largest fractional part first, then index
        range(len(weights)),
        key=lambda i: (-((units * weights[i]) % denom), i),
    )
    for i in order[:remainder]:
        parts[i] += 1

    return [p * CENTS for p in parts]
```

`scaleb(2)` shifts the exponent by two — it adjusts the exponent rather than
multiplying, so it cannot introduce a rounding of its own — turning
`Decimal('100.00')` (coefficient 10000, exponent -2) into a value with the same
coefficient and exponent 0, whose `int()` is therefore 10000 exactly. Everything after that is integer arithmetic, which cannot round
at all: `units * w // denom` is exact floor division on `int`, and the remainder
is a count of whole cents.

Allocating `Decimal('100.00')` with weights `[1, 1, 1]` gives `33.34`, `33.33`,
`33.33`: 10000 cents, floors of 3333 each, one cent left over, given to the first
index because all three fractional remainders tie. The parts sum to exactly
`Decimal('100.00')` and no part is more than one cent from its ideal share.

### Negative totals work, and must be tested

A refund is a negative amount, and Python's `//` on integers floors toward
negative infinity, so `-10000 * 1 // 3` is `-3334`, not `-3333`. The floors are
therefore *more negative* than the ideal shares and the remainder is positive,
so the loop still distributes correctly and the sum still holds. That is a
property worth asserting rather than assuming:

```python
assert sum(allocate(Decimal('-100.00'), [1, 1, 1])) == Decimal('-100.00')
```

### Allocating by decimal weights

Weights are often percentages or ratios rather than integers. Convert them to
integers exactly before allocating — do not divide:

```python
from decimal import Decimal
from math import lcm

def allocate_ratio(total: Decimal, weights: list[Decimal]) -> list[Decimal]:
    """Weights may be any finite Decimals (percentages, shares); converted exactly."""
    ratios = [w.as_integer_ratio() for w in weights]      # exact (n, d) pairs
    common = lcm(*[d for _, d in ratios]) if ratios else 1
    ints = [n * (common // d) for n, d in ratios]
    return allocate(total, ints)
```

`as_integer_ratio` is documented as *"Return a pair `(n, d)` of integers that
represent the given `Decimal` instance as a fraction, in lowest terms and with a
positive denominator"*, and *"The conversion is exact. Raise `OverflowError` on
infinities and `ValueError` on NaNs."* So the weights reach the integer algorithm
without a rounding step of their own — which matters, because rounding the weights
and then allocating reintroduces exactly the bias you were removing.

## Testing an allocation

The invariants are simple enough to state as properties, which is where
`hypothesis` earns its keep:

```python
from decimal import Decimal
from hypothesis import given, strategies as st

cents = st.integers(min_value=-10**9, max_value=10**9).map(lambda u: u * Decimal('0.01'))
weights = st.lists(st.integers(min_value=0, max_value=10**6), min_size=1, max_size=20)

@given(cents, weights)
def test_allocation_is_exact(total, ws):
    if sum(ws) == 0:
        return
    parts = allocate(total, ws)
    assert sum(parts) == total                       # exactness
    assert all(p.as_tuple().exponent == -2 for p in parts)   # scale preserved
    assert len(parts) == len(ws)
```

The fairness property is worth a second test: for equal weights, the difference
between the largest and smallest part must be at most one cent.

## Gotchas

**★ Rounding the parts is never the fix.** Every rounding mode loses or invents
money on a split, because `sum(round(x_i))` is not `round(sum(x_i))`. If a
function returns rounded shares and its caller sums them, the discrepancy will be
found by an accountant, not by a test.

**★ `int(total * 100)` is not the same as `int(total.scaleb(2))`.** The
multiplication is an arithmetic operation subject to the context — under a reduced
`prec` it can round — while `scaleb` shifts the exponent. Worse, if `total` ever
arrives as a `float`, `int(total * 100)` truncates: a value stored as
`2.99999999...` becomes 299 rather than 300. Convert exactly, and assert that the
conversion round-trips.

**★ The remainder distribution order is a business decision.** Largest fractional
part first is the standard (and the only one that keeps parts within one unit of
their ideal), but "first line gets the extra cent", "last line absorbs it" and
"the house absorbs it" are all real policies. Whatever you choose must be
*deterministic* — a `dict` iteration order or an unstable sort makes an invoice
that re-renders differently.

**★ Ties must break on a stable key.** Equal weights give equal remainders. If the
tie-break is arbitrary, re-running the allocation can move the extra cent to a
different party, and a re-issued invoice will not match the original. The
`(-remainder, index)` sort key above is stable by construction.

**★ Allocating a negative total is not the same as allocating its magnitude and
negating.** Floor division on negatives rounds toward negative infinity, so the
parts differ from `[-p for p in allocate(-total, ws)]` in which party absorbs the
odd cent. For a refund that reverses an earlier charge, allocate the *original*
amounts and negate the parts, so the reversal matches the charge line for line.

**★ Zero weights must yield zero parts, and a zero weight sum must raise.** A
weight of 0 gets a floor share of 0 and a remainder of 0, so it can never receive
a distributed unit — correct. But if *all* weights are zero the ideal shares are
undefined and the remainder loop would hand cents to arbitrary parties; raise
instead.

**★ Allocation does not compose with a second allocation.** Allocating a total to
regions and then allocating each region to branches is fine; re-allocating the
*rounded* regional figures back to a different grouping is not, because the cents
you distributed are now part of the data. Allocate once, from the authoritative
total, at each level.

**★ `sum()` of the parts starts at `int` 0.** That is harmless for exactness —
adding `Decimal('33.34')` to `0` is exact — but the result of summing an empty
list is `int` `0`, not `Decimal('0.00')`. An invariant written `sum(parts) ==
total` then compares `0 == Decimal('0.00')`, which is `True`, while
`sum(parts).as_tuple()` blows up on an `int`. Use `sum(parts, Decimal('0.00'))`
when the type matters.

**★ Splitting by "percentage of total" and then adjusting the last part hides the
error rather than removing it.** The pattern `parts[-1] = total - sum(parts[:-1])`
does make the sum come out, but it dumps the entire accumulated discrepancy on one
party, which for many parts can exceed a cent. Distribute the remainder instead.

## Interview questions

**★ You must split £100.00 three ways. Walk me through what you do and why.**
Not `(total / 3).quantize(...)` three times — that gives 33.33 each and loses a
cent, and rounding up gives 33.34 each and invents two. I convert the total to
whole minor units exactly (`scaleb(2)`, not `* 100`), take the integer floor of
each ideal share, which leaves a remainder strictly less than the number of parts,
and hand out those remaining units one each in order of largest fractional
remainder, breaking ties on index. The postcondition is that the parts sum to the
total exactly and no part is more than one minor unit from its ideal share.

**★ Why work in integers rather than staying in `Decimal` throughout?**
Because integer arithmetic cannot round. Once the amount is a count of cents,
`//`, `%` and `+` are exact by construction, so the exactness property of the
allocation follows from the arithmetic rather than from careful use of contexts
and rounding modes. `Decimal` is used at the two ends — converting in exactly with
`scaleb`, converting out by multiplying by the minor-unit scale — where the
operations are exact anyway.

**★ How do you allocate in proportion to non-integer weights, such as 33.3% /
33.3% / 33.4%?**
Convert the weights to exact integers first, then run the same integer algorithm.
`Decimal.as_integer_ratio()` gives an exact `(n, d)` pair per weight; scaling each
numerator by the least common multiple of the denominators produces integer
weights with the same ratios and no rounding. Rounding the weights instead would
bias the allocation before it started.

**★ What properties would you assert about an allocation function?**
Exactness — the parts sum to the total, for positive, negative and zero totals.
Scale — every part has the money exponent. Cardinality — one part per weight.
Fairness — for equal weights, max part minus min part is at most one minor unit.
Determinism — the same inputs produce the same list, including the placement of
the odd units. And monotonicity if the domain requires it: a larger weight never
receives a smaller part. These are property tests, not example tests; the failures
live at the tie-breaks and at negative totals, which is exactly where hand-written
examples do not go.

---

← Prev: [Rounding modes for money](10e-rounding-modes-for-money.md) · Index: [Numbers](README.md) · Next → [Tax, percentages and minor units](10g-tax-percentages-and-minor-units.md)

{/* FOOTER */}
