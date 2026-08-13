---
title: "numeric vs float — money never in float"
sidebar_label: "02 · numeric vs float"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex33-types-core.mjs`.

**`numeric` is exact and slow. `double precision` is fast and approximate. Money is the
case where "approximate" means a ledger that does not balance — and the measured error
appears after only a thousand additions.**

## The measurement that settles it

```console
$ node ex33-types-core.mjs
=== 2. numeric vs double precision — money, and why ===
{"float_sum":0.30000000000000004,"float_equals_point3":false,
 "numeric_sum":"0.3","numeric_equals_point3":true}
1000 x 0.01 summed: {"float_total":"9.999999999999831","numeric_total":"10.00"}
```

**Adding one cent a thousand times gives 9.999999999999831 in `float8` and exactly 10.00 in
`numeric`.** That is not a rounding display artefact — the stored value really is not 10, so
`WHERE total = 10` finds nothing and a reconciliation report shows a discrepancy nobody can
account for.

The cause is binary representation: 0.1, 0.01 and 0.2 have no exact form in base 2, exactly
as ⅓ has none in base 10. Every arithmetic operation compounds the error.

## What each type is for

| Type | Aliases | Storage | Exact? | Use for |
|---|---|---|---|---|
| `numeric(p,s)` | `decimal` | variable | **yes** | money, quantities that must add up, anything a human audits |
| `double precision` | `float8` | 8 bytes | no | measurements, science, statistics, coordinates |
| `real` | `float4` | 4 bytes | no | rarely — half the precision for half the space |
| `bigint` (cents) | | 8 bytes | **yes** | money, when you want integer speed |

```sql
CREATE TABLE invoices (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  total        numeric(12,2) NOT NULL CHECK (total >= 0),  -- exact currency
  tax_rate     numeric(5,4)  NOT NULL,                     -- 0.2000
  weight_kg    double precision,                           -- a measurement; approximate is fine
  latitude     double precision                            -- likewise
);
```

`numeric(12,2)` means **12 total digits, 2 after the point** — up to 9 999 999 999.99.
Choose `p` for the largest value you will ever store, `s` for the currency's minor unit.

## Precision, overflow and rounding

```console
numeric(10,2) given 12345678901                ->  22003 numeric field overflow
rounding: {"num_half":"3","float_half":2,"num_1005":"1.01","float_1005":"1.01"}
```

Two behaviours worth knowing:

- **Exceeding the declared precision is an error** (`22003`), not truncation. Good: you find
  out. Note this is precision, not scale — extra *decimal* places are rounded silently.
- **`numeric` rounds half away from zero: `2.5::numeric(2,0)` gave `3`.** Casting a float to
  `int` gave `2` — banker's rounding, half-to-even. Two different answers for the same
  input, which is exactly the kind of discrepancy that shows up in a monthly total.

`numeric` also accepts values `float` cannot represent at all, and supports `'NaN'` (which
compares equal to itself, unlike the IEEE float `NaN` — a rare case where PostgreSQL
deliberately deviates so that `numeric` can be sorted and indexed).

## The cost of exactness

```console
sum over 300k numeric(12,2): 76.8 ms
sum over 300k float8       : 27.3 ms
sum over 300k bigint cents : 27.7 ms
storage: {"numeric_b":10,"float8_b":8,"bigint_b":8}
```

**`numeric` arithmetic was 2.8× slower than both `float8` and `bigint`**, and its values are
10 bytes against 8. That is the honest price: `numeric` is software arithmetic on a
variable-length decimal representation, while `float8` and `bigint` use CPU instructions.

For an OLTP workload summing a handful of rows per request this is invisible. For an
analytics query summing millions it is real — and the answer there is **integer cents**,
which is exact *and* as fast as float:

```sql
total_cents bigint NOT NULL CHECK (total_cents >= 0)   -- 1999 means £19.99
```

The trade is that every read and write must convert, and a missed conversion is a 100×
error. `numeric` keeps the units visible in the schema; cents keep them in your head and in
every code path. **Default to `numeric`; move to cents when a measurement says you must.**

## From Node: `numeric` arrives as a string

```console
JS types: { n: 'string "1.1"', f: 'number 1.1', r: 'number 1.1', big: 'string "9007199254740993"', i: 'number 42' }
```

**`numeric` comes back as a string, `float8` and `float4` as numbers.** `pg` refuses to
convert `numeric` to a JavaScript number, because doing so would throw away the exactness
you chose the type for.

```js
const {rows} = await pool.query('SELECT total FROM invoices WHERE id = $1', [id]);
rows[0].total            // '1234.56'  ← string

Number(rows[0].total)    // 1234.56 — a double again; you just lost what you paid for
```

The three real options:

```js
// 1. do the arithmetic in SQL — best; the database is already exact
await pool.query(
  `UPDATE invoices SET total = total + $1 WHERE id = $2`, ['10.00', id]);

// 2. a decimal library in JS
import Decimal from 'decimal.js';
const total = new Decimal(rows[0].total).plus('10.00').toFixed(2);

// 3. integer cents in JS, converting at the edges
const cents = Math.round(Number(rows[0].total) * 100);
```

**Option 1 whenever possible.** Every currency calculation done in JavaScript with `Number`
reintroduces the exact problem `numeric` exists to prevent — and the measured
`9.999999999999831` is what that looks like.

Never do this:

```js
pg.types.setTypeParser(1700, parseFloat);   // 1700 = numeric — discards the exactness
```

## Trade-off

**Exactness costs 2.8× on arithmetic, 2 bytes per value, and a string at the driver
boundary.** For money that is not a trade at all — an unbalanced ledger costs more than any
query. For measured quantities the reverse holds: `float8` is faster, smaller, and its
imprecision is smaller than your instrument's. The only genuinely hard case is
high-volume financial analytics, where integer cents buy back the speed at the cost of
making units implicit everywhere.

## Gotchas

**Symptom:** Totals are off by fractions of a cent
**Cause:** Money stored as `float`; binary cannot represent 0.01 exactly
**Fix:** `numeric(12,2)` or integer cents — measured drift after 1000 additions

**Symptom:** `WHERE total = 10.00` matches nothing although the total looks like 10.00
**Cause:** The stored float is 9.999999999999831
**Fix:** `numeric`; never compare floats for equality

**Symptom:** `22003 numeric field overflow`
**Cause:** The value exceeds the declared precision
**Fix:** Widen `numeric(p,s)`; note extra decimal places round silently while precision errors

**Symptom:** Arithmetic in JavaScript on a `numeric` column drifts
**Cause:** `Number('1234.56')` is a double again
**Fix:** Do the arithmetic in SQL, or use a decimal library

**Symptom:** Rounding differs between the database and the application
**Cause:** `numeric` rounds half away from zero (`2.5` → `3`); float-to-int uses half-to-even (`2.5` → `2`)
**Fix:** Round explicitly and in one place

**Symptom:** An analytics `sum()` over `numeric` is slow
**Cause:** Software decimal arithmetic — measured 2.8× slower than `float8`
**Fix:** Integer cents if exactness is required, `float8` if it is not

## Interview questions

**★ Why must money never be `float`?**
Binary floating point cannot represent decimal fractions exactly, and the error compounds.
Measured: 1000 additions of 0.01 gave `9.999999999999831` in `float8` and `10.00` in
`numeric`.

**★ What are the exact alternatives?**
`numeric(p,s)`, or integer cents in a `bigint`. `numeric` keeps the units in the schema;
cents are faster (measured 27.7 ms vs 76.8 ms) but push the scaling into every code path.

**★ What does `numeric` cost?**
About 2.8× on arithmetic and 10 bytes per value against 8. Irrelevant per request, real
across millions of rows.

**★ Why does `pg` return `numeric` as a string?**
Because converting to a JavaScript number would reintroduce the imprecision `numeric`
exists to avoid. `float8` returns a number; `numeric` does not.

**★ Where should currency arithmetic happen?**
In SQL. Doing it in JavaScript with `Number` discards the exactness — use a decimal library
if it must happen in the application.

**What does `numeric(12,2)` mean?**
12 significant digits in total, 2 of them after the decimal point — up to 9 999 999 999.99.
Exceeding the precision raises `22003`; excess scale is rounded.

**Does `numeric` have surprises of its own?**
Yes: it rounds half away from zero, and it supports `'NaN'` which — unlike IEEE `NaN` —
compares equal to itself so that `numeric` can be sorted and indexed.

---

← [Integer types](01-integers.md) · Next → [text vs varchar vs char](03-text.md)
