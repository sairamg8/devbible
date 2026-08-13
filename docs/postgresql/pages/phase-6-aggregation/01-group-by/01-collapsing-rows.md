---
title: "Collapsing rows"
sidebar_label: "01 · Collapsing rows"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex36-aggregation.mjs`,
> `sandbox/pg-api/ex36c-agg-checks.mjs`.

**An aggregate takes many values and returns one. `GROUP BY` decides which values go
into each "many". Everything surprising on this page follows from one fact: every
aggregate except `count(*)` skips `NULL` inputs.**

## The model

Without `GROUP BY`, an aggregate query has exactly one group — the whole result of
the `FROM`/`WHERE` — and returns exactly one row:

```sql
SELECT count(*)::int AS n, sum(total)::int AS revenue, round(avg(total),2) AS avg
FROM agg_orders;
```

```console
whole table, no GROUP BY: [{"n":6,"revenue":550,"avg":"110.00"}]
```

With `GROUP BY`, the rows are partitioned by the grouping key and each partition folds
to one output row:

```sql
SELECT status, count(*)::int AS n, sum(total)::int AS revenue,
       round(avg(total),2) AS avg_total, min(total) AS lo, max(total) AS hi
FROM agg_orders
GROUP BY status
ORDER BY status;
```

```console
$ node ex36-aggregation.mjs
=== 1. GROUP BY collapses rows; aggregates fold each group ===
per status : [{"status":"cancelled","n":1,"revenue":0,"avg_total":"0.00","lo":0,"hi":0},
              {"status":"open","n":2,"revenue":50,"avg_total":"50.00","lo":50,"hi":50},
              {"status":"paid","n":3,"revenue":500,"avg_total":"166.67","lo":100,"hi":200}]
```

Read the `open` row carefully, because it is the whole lesson in one line. There are
**two** open orders — order 11 with a total of 50, and order 15 with a total of `NULL`.
And yet:

- `count(*)` says **2** — it counts rows.
- `sum(total)` says **50** — it summed one value.
- `avg(total)` says **50.00**, not 25.00 — it averaged over **one** value, not two.
- `min` and `max` both say 50 — the `NULL` was never a candidate.

The row is present for `count(*)` and absent for everything else. Nobody writes that
deliberately, and it is the most common way an "average order value" dashboard ends up
quietly overstating itself.

### The rule, stated once

> **Every aggregate except `count(*)` ignores `NULL` inputs.** `count(*)` counts rows;
> `count(expr)` counts rows where `expr` is not `NULL`.

So `avg(x)` is not `sum(x) / count(*)`. It is `sum(x) / count(x)`. Measured on the
fixture, with both denominators shown side by side:

```sql
SELECT status, count(*)::int AS rows, count(total)::int AS priced,
       round(avg(total),2)            AS avg_of_known,
       round(avg(coalesce(total,0)),2) AS avg_null_as_zero
FROM agg_orders GROUP BY status ORDER BY status;
```

```console
=== C3. avg vs avg(coalesce()) on the open group ===
[{"status":"cancelled","rows":1,"priced":1,"avg_of_known":"0.00","avg_null_as_zero":"0.00"},
 {"status":"open",     "rows":2,"priced":1,"avg_of_known":"50.00","avg_null_as_zero":"25.00"},
 {"status":"paid",     "rows":3,"priced":3,"avg_of_known":"166.67","avg_null_as_zero":"166.67"}]
```

`open` is the only group where the two disagree — **50.00 against 25.00** — and it
disagrees by a factor of two. Which one is correct is a product question, not a SQL
question: "average value of orders we have priced" and "average value of orders" are
different metrics. Pick one on purpose, and put `count(total)` next to it in the
response so a reader can see the denominator.

Note also that `cancelled` reports `0.00` from both, because order 13's total is `0`
and not `NULL`. That distinction — a known zero versus an unknown — is the reason the
fixture carries both.

## The five aggregates, and their return types

```sql
SELECT pg_typeof(avg(total)) AS avg_t, pg_typeof(sum(total)) AS sum_t,
       pg_typeof(count(*)) AS count_t
FROM agg_orders;
```

```console
avg type : [{"avg_t":"numeric","sum_t":"bigint","count_t":"bigint"}]
```

| Aggregate | Input `int` gives | Why |
|---|---|---|
| `count(*)`, `count(x)` | `bigint` | a table can have more rows than `int` holds |
| `sum(int)` | `bigint` | the sum of ints overflows int |
| `sum(bigint)` | `numeric` | same argument, one level up |
| `avg(int)` | `numeric` | exact decimal, not a float — no drift |
| `min`/`max` | same type as input | it returns one of the inputs |

`avg` returning `numeric` rather than `double precision` is a deliberate PostgreSQL
choice and a good one: an average over money must not accumulate binary
floating-point error. The costs are that it is slower than float arithmetic, and that
it arrives in JavaScript as a string.

`min` and `max` deserve one note of their own: they work on **any** orderable type, not
just numbers. `max(placed_at)` is the most recent order, `min(name)` is alphabetical.
That is useful and occasionally a trap — see `min(coupon)` on
[what you can select](03-what-you-can-select.md), where "a representative value"
turned out to mean "the alphabetically first one".

## What the driver hands JavaScript

This bites on the first aggregate query anyone writes from Node:

```js
const {rows} = await pool.query(
  `SELECT count(*) AS n, sum(total) AS revenue, avg(total) AS avg,
          min(total) AS lo, round(avg(total),2) AS rounded
   FROM agg_orders`,
);
console.log(rows[0]);
```

```console
=== C1. what an UNCAST aggregate row looks like in JS ===
rows[0]: { n: '6', revenue: '550', avg: '110.0000000000000000', lo: 0, rounded: '110.00' }
types  : { n: 'string', revenue: 'string', avg: 'string', lo: 'number', rounded: 'string' }
n + 1  : 61
```

**`n + 1` is `61`.** Four of the five columns are strings, and the one that is not
(`lo`) is only a number because `min(int)` returns `int`. `bigint` and `numeric` both
exceed what a JavaScript `number` represents exactly, so `pg` refuses to guess and
hands you the text. Every comparison against a number after that is a coercion waiting
to be wrong — and `'6' > 10` is `false` while `'60' > 10` is also `false`, so the bug
does not even fail consistently.

Two fixes. This corpus uses the first everywhere:

```sql
-- cast in SQL: the value is small and you know it
SELECT count(*)::int AS n, sum(total)::int AS revenue, avg(total)::float8 AS avg
FROM agg_orders;
```

```console
cast : { n: 6, revenue: 550, avg: 110 } { n: 'number', revenue: 'number', avg: 'number' }
```

```js
// or teach the driver, process-wide — see the phase 7 type-parser page
pg.types.setTypeParser(20, v => parseInt(v, 10));   // 20 = int8 / bigint
```

Note that `round(avg(total),2)` still came back as `"110.00"` — rounding a `numeric`
gives a `numeric`. Only `::float8` or `::int` produces a JS number, and `::float8`
gives up the exactness `numeric` was there for. For money, keep it `numeric`, ship the
string, and format it on the client.

`::int` is safe for a count you know is small and **unsafe** for `sum()` over a large
table — that is exactly the overflow `bigint` existed to prevent. Full type map:
[type mapping to JavaScript](../../phase-7-pg-driver/08-type-parsing.md).

## Trade-off

Aggregating in SQL beats aggregating in JavaScript on every axis that matters at scale
— one pass over the data, no transfer of rows you are about to discard, and the planner
may parallelise it — and loses on one: **the logic now lives somewhere your application
tests probably do not reach.** A `sum()` that silently drops `NULL`s produces a
plausible number, and plausible numbers do not fail assertions. If a metric matters,
test it against a fixture that contains a `NULL` and an empty group, exactly like the
one on this page.

## Gotchas

**Symptom:** the average is higher than every individual value you can see in the table
**Cause:** rows with a `NULL` in the averaged column are excluded from the denominator,
so `avg` is over fewer rows than `count(*)` reports
**Fix:** report `count(col)` next to the average, or use `avg(coalesce(col,0))` if
missing genuinely means zero. Measured here as 50.00 vs 25.00 on the same two rows

**Symptom:** `rows[0].n + 1` produces `"61"` instead of `7`
**Cause:** `count()` returns `bigint`, which `pg` delivers as a **string** because
`bigint` overflows a JS `number`
**Fix:** `count(*)::int` when the count is bounded, or `pg.types.setTypeParser(20, …)`
once at startup. Never `parseInt` at each call site

**Symptom:** a money total is off by fractions of a cent after a few thousand rows
**Cause:** somebody cast to `::float8` to get a JS number out of `numeric`
**Fix:** keep it `numeric`, accept the string in JS, format on the client. `float8` is
for measurements, not for money

**Symptom:** `sum(...)::int` works for months, then throws `22003 integer out of range`
**Cause:** the `::int` cast that made the value convenient in JS also reintroduced the
overflow `bigint` was protecting you from. Measured on `agg_events`:
`sum(amount)::int` → `196842978`, fine; `(sum(amount)*20)::int` → **`22003 integer out
of range`**, while the same expression left as `bigint` returns `3936859560` happily
**Fix:** keep it `bigint` and parse in JS, or cast to `::numeric` — reserve `::int` for
counts and sums you can prove are bounded

**Symptom:** `max(status)` returns something meaningless
**Cause:** `min`/`max` work on any orderable type; over text that means alphabetical
order, which rarely corresponds to anything the domain cares about
**Fix:** use `DISTINCT ON` or a `row_number()` window when you want "the row that wins
by some rule", not `min`/`max` on an unrelated column

## Interview questions

**★ Why is `avg(x)` not the same as `sum(x) / count(*)`?**
Because `sum` and `avg` skip `NULL` inputs while `count(*)` counts rows. `avg(x)` is
`sum(x) / count(x)`. Measured on the fixture's `open` group — two rows, one with
`total` `NULL` — `avg` returned 50.00 where `avg(coalesce(total,0))` returned 25.00.

**★ Why does `count(*)` arrive in Node as a string?**
`count` returns `bigint`, whose range exceeds what a JS `number` represents exactly.
`pg` returns the text rather than silently losing precision. Measured: `rows[0].n + 1`
gives `'61'`. Fix with `::int` in SQL for bounded counts, or a type parser for OID 20
at startup.

**★ Why does `avg` return `numeric` rather than `double precision`?**
To avoid binary floating-point drift over money and other decimal quantities. The
costs are speed, and that it arrives in JavaScript as a string — `round(avg(x),2)` is
still `numeric`, so only an explicit `::float8` or `::int` yields a JS number.

**A column is `NULL` for 30% of rows. Which of `count(*)`, `count(col)`, `sum(col)`,
`avg(col)`, `max(col)` see those rows?**
Only `count(*)`. The other four operate on non-`NULL` inputs, so `avg` divides by 70%
of the row count and `max` cannot return `NULL` unless *every* input was `NULL`.

**When is `sum(x)::int` a bug?**
As soon as the total can exceed 2 147 483 647. `sum(int)` returns `bigint` precisely to
avoid that, and the cast undoes the protection — measured as `22003 integer out of
range`. Safe for bounded counts, not for sums over a growing table.

---

← [Topic index](README.md) · Next → [Empty groups and grouping keys](02-empty-groups-and-keys.md)
