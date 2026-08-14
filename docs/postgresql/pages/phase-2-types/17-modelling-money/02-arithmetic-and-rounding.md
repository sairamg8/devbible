---
title: "17.2 · Arithmetic, rounding and currency conversion"
sidebar_label: "02 · Arithmetic & rounding"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [numeric types and rounding](https://www.postgresql.org/docs/18/datatype-numeric.html).
> The `numeric`-arrives-as-a-string behaviour and the rounding direction are
> **sandbox-measured** in [02 · numeric vs float](../02-numeric-vs-float.md)
> (`sandbox/pg-api/ex33-types-core.mjs`). **No console output on this page.**

**Money arithmetic is where correct storage stops being enough.** Every operation
that divides — tax, discounts, splitting a bill, converting a currency —
introduces a fraction that has to go somewhere, and "somewhere" is a decision you
make or a decision that gets made for you.

## Rounding is not one behaviour

PostgreSQL's two numeric families round ties differently, and the documentation
states it directly:

> When rounding values, the `numeric` type rounds ties away from zero, while (on
> most machines) the `real` and `double precision` types round ties to the
> nearest even number.

The documented comparison, which is worth memorising because it explains a whole
category of confusing bug reports:

| x | `numeric` | `double precision` |
|---|---|---|
| 0.5 | **1** | 0 |
| 1.5 | 2 | 2 |
| **2.5** | **3** | **2** |
| 3.5 | 4 | 4 |
| -0.5 | **-1** | -0 |
| -2.5 | **-3** | -2 |

`numeric` rounding **half away from zero** matches what people are taught in
school and what most financial rules expect. `double precision` uses **banker's
rounding** (half to even), which is statistically unbiased over many values and
surprising on any single one.

This is one more reason money is `numeric`: not merely that float is inexact, but
that even its *rounding* follows a different rule from the one your finance team
will describe.

**Where your jurisdiction or contract specifies a rounding rule, implement it
explicitly** rather than relying on the default. `round(x, 2)` on `numeric` gives
half-away-from-zero; anything else — banker's rounding on money, always-round-up
on tax — has to be written out.

## Round once, at the end

The common bug is rounding at every step:

```sql
-- wrong: rounds three times, and the errors accumulate
SELECT round(round(unit_price * qty, 2) * (1 + tax_rate), 2) …
```

Each rounding discards information, and the discarded pieces compound. The rule:
**carry full precision through the calculation and round once, at the point the
amount becomes a real charge.**

```sql
-- better: full precision through, rounded at the boundary
SELECT round(unit_price * qty * (1 + tax_rate), 2) AS line_total
```

The corollary is about storage: store the **inputs** at full precision (unit
price, quantity, tax rate) and the **rounded outputs** you actually charged.
Storing only the inputs means recomputing a historical invoice can produce a
different total after a rounding-rule change; storing only the outputs means you
cannot explain how a figure was derived. Financial records want both.

## The allocation problem

Split £100 evenly three ways.

```
100 / 3 = 33.333…  →  33.33 each  →  99.99 total
```

**A penny has vanished.** No rounding rule fixes this, because the problem is not
rounding — it is that 100 is not divisible by 3 in units of a penny. The money
must go somewhere, and the only question is whether you decide where or discover
later that it went nowhere.

The standard approach is **largest remainder**: give everyone the floor, then
distribute the leftover units one at a time to the largest remainders.

```
100 / 3  →  33.33, 33.33, 33.33  (99.99), remainder 0.01
         →  33.34, 33.33, 33.33  (100.00) ✓
```

Implemented as: compute each share in minor units, floor it, sum the floors,
distribute `total − sum(floors)` single units to the parties with the largest
fractional parts.

Where this matters in practice:

- Splitting a bill, an invoice, or a payout among parties.
- **Allocating an order-level discount across lines** — the discount total must
  equal the sum of the per-line discounts, or the invoice does not add up.
- Distributing tax across lines when tax is computed on the order total.
- Revenue recognition across periods.

The invariant to test, in every case: **the parts must sum exactly to the
whole.** That is the assertion worth writing, and it is the one that catches
allocation bugs immediately.

## Currency conversion

Two rules, and both are about history rather than arithmetic.

**Store the rate you used, with the amount.** An exchange rate at the moment of a
transaction is part of the transaction record, not a lookup that can be redone:

```sql
CREATE TABLE payments (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  amount            numeric(14,2) NOT NULL,
  currency          char(3)       NOT NULL REFERENCES currencies(code),
  base_amount       numeric(14,2) NOT NULL,      -- converted, as charged
  base_currency     char(3)       NOT NULL REFERENCES currencies(code),
  fx_rate           numeric(18,8) NOT NULL,      -- the rate actually applied
  fx_rate_at        timestamptz   NOT NULL,      -- when it was quoted
  …
);
```

Without `fx_rate` and `fx_rate_at`, a report run next year re-converts at today's
rate and produces figures that do not match what the customer was charged — and
nobody can reconstruct why.

**Never convert for comparison on the fly.** Summing a multi-currency column by
converting inside the query gives an answer that changes every time it is run.
Either report per currency, or report the stored `base_amount` that was fixed at
transaction time.

Note the scale difference: `numeric(18,8)` for the rate against `numeric(14,2)`
for amounts. Rates need many digits, and a rate stored at two decimals is
useless.

## Trade-off

Exact money arithmetic trades **convenience for defensibility**. Rounding once at
the end, allocating remainders explicitly and storing the FX rate you used all
add code and columns that a round-as-you-go design does not need — and that
design is genuinely simpler to write.

What you buy is the ability to answer "why is this number what it is" a year
later, and to have the parts sum to the whole every time. For anything a customer
is charged or an auditor may examine, that is not a nice-to-have.

## Gotchas

**Symptom:** Totals differ by a penny from what was charged
**Cause:** Rounding at each step instead of once at the end; the discarded
fractions compound.
**Fix:** Carry full precision through, round once at the charging boundary, and
store both the inputs and the rounded outputs.

**Symptom:** Split amounts do not sum to the total
**Cause:** Even division with rounding — 100 / 3 gives 33.33 × 3 = 99.99.
**Fix:** Largest-remainder allocation: floor each share, distribute the leftover
units to the largest remainders. Assert that the parts sum to the whole.

**Symptom:** `round(2.5)` gives 3 in one place and 2 in another
**Cause:** Documented — `numeric` rounds ties away from zero, `double precision`
rounds ties to even. The value passed through a float somewhere.
**Fix:** Keep money in `numeric` end to end.

**Symptom:** Historical reports change value over time
**Cause:** Converting currencies at query time using today's rate.
**Fix:** Store `fx_rate` and `fx_rate_at` with the transaction and report the
stored converted amount.

**Symptom:** An exchange rate rounds to nothing useful
**Cause:** The rate column was given the same scale as amounts.
**Fix:** Rates need far more scale — `numeric(18,8)` against `numeric(14,2)`.

## Interview questions

**★ How does `numeric` rounding differ from float rounding?**
`numeric` rounds ties **away from zero** (2.5 → 3), while `real` and
`double precision` round ties **to even** (2.5 → 2) — documented, with a
comparison table in the PostgreSQL manual. Beyond float's inexactness, this means
float rounding follows a different rule from the one financial requirements
usually assume, which is a second independent reason money is `numeric`.

**★ You must split £100 three ways. What do you store?**
Not 33.33 three times — that sums to 99.99. Use largest-remainder allocation:
floor each share in minor units, then distribute the leftover units to the
largest fractional remainders, giving 33.34 / 33.33 / 33.33. The invariant to
test is that the parts sum exactly to the whole; no rounding rule alone achieves
it, because the problem is divisibility, not rounding.

**★ Why store the exchange rate with the transaction?**
Because the rate applied at the moment of the transaction is part of the record.
Without `fx_rate` and `fx_rate_at`, a report re-converts at the current rate and
produces figures that do not match what the customer was charged, with no way to
reconstruct the original.

**Why round once rather than at each step?**
Each rounding discards information, and the discarded pieces compound across a
multi-step calculation. Carry full precision through and round at the point the
amount becomes a real charge — then store both the full-precision inputs and the
rounded output, so a historical invoice can be both reproduced and explained.

---

← [Storing money](01-storing-money.md) · Next → [Ledgers and the Node side](03-ledgers-and-node.md)
