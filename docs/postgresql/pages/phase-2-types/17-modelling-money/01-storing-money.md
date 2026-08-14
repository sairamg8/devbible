---
title: "17.1 · Storing money"
sidebar_label: "01 · Storing money"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13. The type comparison is **sandbox-measured** in
> [02 · numeric vs float](../02-numeric-vs-float.md)
> (`sandbox/pg-api/ex33-types-core.mjs`, PostgreSQL 18.4, Node 24, `pg`).
> Type semantics are validated against the **PostgreSQL 18 documentation** —
> [numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html),
> [the `money` type](https://www.postgresql.org/docs/18/datatype-money.html).
> **No console output on this page** — the measured output is on
> [02](../02-numeric-vs-float.md).

**"Money is `numeric`" is the right answer to the wrong question.**
[02 · numeric vs float](../02-numeric-vs-float.md) settles the *type* with
measurement. This topic is the modelling: an amount is not a number, arithmetic
on it is not ordinary arithmetic, and the mistakes are the ones that produce
accounts that do not balance.

## An amount alone is not money

```sql
-- incomplete, even though the type is right
total numeric(12,2) NOT NULL
```

`19.99` of what? A money value is **an amount and a currency**, and storing only
the amount means the currency lives somewhere else — in a column on another
table, in an assumption, or in a comment. All three eventually fail, and they
fail by summing values that should never have been added together.

```sql
CREATE TABLE invoices (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  total_amount  numeric(14,2) NOT NULL CHECK (total_amount >= 0),
  currency      char(3)       NOT NULL REFERENCES currencies(code),
  …
);
```

Keeping them adjacent means a `SUM` that crosses currencies is at least
*visible* — you can require a `GROUP BY currency` and notice when it is missing.
It does not prevent the error by itself; nothing at the column level can. What
does help:

- **`GROUP BY currency` as a habit** in every aggregate over money.
- **A single-currency constraint** where a table genuinely should hold only one
  currency per parent — an invoice's lines should all match the invoice.
- **A composite type or domain** if you want the pairing enforced structurally,
  at the cost of more awkward queries.

The single-currency check is worth writing out, because it is the practical
version:

```sql
ALTER TABLE invoice_lines
  ADD CONSTRAINT line_currency_matches_invoice
  FOREIGN KEY (invoice_id, currency) REFERENCES invoices (id, currency);
```

That requires a unique index on `invoices (id, currency)` — trivially satisfiable
since `id` is already unique — and it makes a mismatched line impossible rather
than merely unlikely. This is a good example of a constraint doing work that a
code review cannot.

## Do not use the `money` type

PostgreSQL has a type literally called `money`, and it is the wrong choice. The
documentation's own warnings are the argument:

- **It is locale-dependent.** Fractional precision comes from `lc_monetary`, and
  output formatting follows the locale.
- **Dump and restore can break.** The docs: "it might not work to load `money`
  data into a database that has a different setting of `lc_monetary`… before
  restoring a dump into a new database make sure `lc_monetary` has the same or
  equivalent value as in the database that was dumped."
- **It carries no currency identity** — the locale decides how it is displayed,
  which is not the same as knowing what currency the value is in.
- Fixed 8-byte storage with a range determined by assumed two fractional digits.

A data type whose meaning depends on a server setting, and whose restore can
misinterpret it, is not a type for financial records. **Use `numeric` with an
explicit currency column.** The documentation's own best-practice note says the
same thing.

## Choosing precision and scale

`numeric(p, s)` — `p` total significant digits, `s` digits after the decimal
point. Storage is documented as "two bytes for each group of four decimal digits,
plus three to eight bytes overhead", so precision costs are modest and
predictable.

Different quantities want different scales, and using one everywhere is a common
mistake:

| Quantity | Suggested | Why |
|---|---|---|
| Invoice / order totals | `numeric(14,2)` | the amount actually charged; two decimals |
| Unit prices | `numeric(14,4)` or more | £0.0125 per unit is a real price |
| Exchange rates | `numeric(18,8)` or more | rates need many digits to round-trip |
| Tax rates | `numeric(6,4)` | 0.2000, 0.0825 |
| Percentages / discounts | `numeric(6,4)` | store the rate, not the rounded result |

**The scale of a price and the scale of a total are different decisions.** If
unit prices are `numeric(14,2)`, you have made £0.005 unrepresentable, and a
per-unit price of a third of a penny becomes impossible — a limitation discovered
by a customer, not by a test.

Two further rules:

**Always specify the scale.** Unconstrained `numeric` accepts up to 16 383
fractional digits, so `19.990000001` is storable and will not equal `19.99`. A
declared scale rounds on input and makes equality behave the way people expect.

**Add `CHECK` constraints.** `CHECK (amount >= 0)` on a column that cannot be
negative catches a whole class of sign errors at the boundary. Where negatives
are legitimate — refunds, credits, ledger entries — that is worth being explicit
about rather than incidental.

## `numeric` versus integer cents

[02 · numeric vs float](../02-numeric-vs-float.md) measured this properly:
summing 300k rows, `numeric(12,2)` at **76.8 ms** against **27.7 ms** for
`bigint` cents — **2.8× slower**, at 10 bytes versus 8.

The conclusions from that measurement are worth restating in modelling terms:

**Default to `numeric`.** The units are visible in the schema, the values read
correctly in `psql` and in any reporting tool, and `19.99` is stored as `19.99`.
The 2.8× applies to summing hundreds of thousands of rows — for an application
that reads an invoice total, it is not measurable.

**Move to integer cents when a measurement says you must** — typically an
analytics workload summing millions of rows. The cost is real and permanent: the
units live in your head and in every code path, `1999` must be divided by 100
everywhere it is displayed, and someone will eventually forget. That is a
correctness risk taken deliberately in exchange for speed.

**And if you use cents, name the column for it** — `total_cents`, never `total` —
so the unit is impossible to misread at the call site.

The one thing both approaches share: **never `double precision`.** The measured
result on [02](../02-numeric-vs-float.md) is that summing 1000 × 0.01 in float8
gives **9.999999999999831** rather than 10.00. That is not a rounding display
issue; it is the stored total being wrong.

## Currencies are not all two decimal places

The assumption that every currency has two minor units is wired into a great deal
of software and is incorrect. Under ISO 4217, currencies declare their own number
of minor units: some have **none** (Japanese yen is the common example) and some
have **three**.

The consequences if you assume two:

- Integer-cents storage with a hard-coded ÷100 is wrong for those currencies —
  by a factor of 10 or 100, which is a spectacular class of bug.
- Rounding to two decimals produces amounts that cannot be charged.

If you are single-currency, this does not apply and you should say so explicitly
somewhere. If you are or might become multi-currency, store the minor-unit count
alongside the currency and drive formatting and rounding from it:

```sql
CREATE TABLE currencies (
  code        char(3) PRIMARY KEY,       -- ISO 4217
  minor_units smallint NOT NULL,         -- 2 for USD/GBP/EUR, 0 for JPY, 3 for some
  name        text NOT NULL
);
```

Populate it from the ISO 4217 register rather than from memory — including this
page's examples, which are illustrative rather than a substitute for the
authoritative list.

## Trade-off

Storing money exactly trades **speed and storage for correctness**, and the
measured cost is small enough that the trade is barely a trade: 2.8× on a
large aggregate, 10 bytes against 8, in exchange for totals that are right.
Financial data is the clearest case in this corpus where the exact option is
simply correct.

The genuine trade is in **how much structure to impose**. A bare
`numeric(14,2)` column is easy to query and lets currencies mix silently. A
currency column plus a composite foreign key plus a minor-units table prevents
real bugs and makes every query longer and every join wider. For a
single-currency product, the elaborate version is over-engineering; for anything
handling more than one currency, the bare version is a defect waiting for its
first customer in Tokyo.

Choose by whether multi-currency is in your future, and note that adding a
currency column later is a straightforward migration while *reconstructing* which
currency historical rows were in is not possible at all. That asymmetry argues
for the currency column even when you have only one.

## Gotchas

**Symptom:** Totals are off by tiny amounts
**Cause:** `double precision`. Measured: 1000 × 0.01 sums to
**9.999999999999831**.
**Fix:** `numeric` with an explicit scale, or integer cents. Never float for
money.

**Symptom:** A dump restored with different currency formatting
**Cause:** The `money` type is locale-sensitive; the docs warn that loading it
into a database with a different `lc_monetary` may not work.
**Fix:** Do not use `money`. `numeric` plus a currency column.

**Symptom:** `19.99` does not equal `19.99`
**Cause:** Unconstrained `numeric` stored extra fractional digits — up to 16 383
are permitted.
**Fix:** Always declare the scale: `numeric(14,2)`.

**Symptom:** A sum mixes currencies and nobody noticed
**Cause:** Nothing prevents adding EUR to USD when only the amount is stored.
**Fix:** `GROUP BY currency` as a habit, and a composite foreign key tying child
rows to their parent's currency.

**Symptom:** Amounts for JPY are 100× wrong
**Cause:** Hard-coded ÷100 on integer cents, assuming every currency has two
minor units.
**Fix:** Store `minor_units` per currency from ISO 4217 and drive scaling from
it.

**Symptom:** A unit price cannot be represented
**Cause:** Unit prices declared `numeric(14,2)`, so fractions of a penny are
impossible.
**Fix:** Give prices more scale than totals — they are different decisions.

## Interview questions

**★ How do you store money in PostgreSQL?**
`numeric` with an explicit precision and scale — typically `numeric(14,2)` for
totals — together with a currency column, because an amount without a currency is
incomplete. Never `double precision`: measured, summing 1000 × 0.01 in float8
gives 9.999999999999831. Integer cents in a `bigint` is a valid alternative when
aggregate speed has been measured to matter.

**★ Why not use PostgreSQL's `money` type?**
It is locale-dependent — fractional precision comes from `lc_monetary` — and the
documentation warns that restoring a dump into a database with different
`lc_monetary` may not work. It also carries no currency identity of its own. A
type whose meaning depends on a server setting is unsuitable for financial
records.

**★ What is the measured cost of `numeric` over integer cents?**
Summing 300 000 rows: 76.8 ms for `numeric(12,2)` against 27.7 ms for `bigint`
cents — about 2.8× slower, and 10 bytes against 8. Real for large analytical
aggregates, irrelevant for reading an invoice. Default to `numeric` and move to
cents on evidence, accepting that the units then live in your code rather than
your schema.

**★ Why is assuming two decimal places wrong?**
Because ISO 4217 currencies declare their own minor units: some have none, some
have three. Hard-coding ÷100 for integer cents is then wrong by a factor of 10 or
100. Store the minor-unit count per currency and derive scaling and rounding from
it.

**Why declare the scale rather than using bare `numeric`?**
Unconstrained `numeric` permits up to 16 383 fractional digits, so a value like
`19.990000001` is storable and will not compare equal to `19.99`. Declaring
`numeric(14,2)` rounds on input and makes equality behave as expected.

**Should unit prices and totals have the same scale?**
No. Totals are the amount charged and two decimals suit them; unit prices
routinely need more — a price of £0.0125 per unit is real, and
`numeric(14,2)` makes it unrepresentable. Exchange rates need more still.

---

← [Phase index](../README.md) · Next → [Arithmetic, rounding and currency](02-arithmetic-and-rounding.md)
