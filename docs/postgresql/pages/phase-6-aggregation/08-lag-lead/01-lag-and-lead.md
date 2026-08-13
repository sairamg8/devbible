---
title: "lag and lead"
sidebar_label: "01 · lag and lead"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex36-aggregation.mjs`.

**`lag` and `lead` fetch a value from a row a fixed number of positions away. That makes
"change since last time" a column rather than a self-join — and introduces one failure
mode that produces plausible wrong numbers, which is what happens when a row is missing
entirely.**

## The basics

```sql
SELECT id, total,
       lag(total)  OVER (ORDER BY id) AS prev,
       lead(total) OVER (ORDER BY id) AS next,
       total - lag(total) OVER (ORDER BY id) AS delta
FROM agg_orders WHERE total IS NOT NULL ORDER BY id;
```

```console
lag and lead : [{"id":10,"total":100,"prev":null,"next":50, "delta":null},
                {"id":11,"total":50, "prev":100, "next":200,"delta":-50},
                {"id":12,"total":200,"prev":50,  "next":0,  "delta":150},
                {"id":13,"total":0,  "prev":200, "next":200,"delta":-200},
                {"id":14,"total":200,"prev":0,   "next":null,"delta":200}]
```

The first row has no predecessor and the last has no successor, so both get `NULL`. And
because `NULL` propagates through arithmetic, `delta` is `NULL` on the first row too —
correct, and worth deciding about, since a chart usually wants `0` or a gap rather than a
missing key.

## Offset and default

Both take two optional arguments:

```sql
SELECT id, total, lag(total, 2, -1) OVER (ORDER BY id) AS two_back
FROM agg_orders WHERE total IS NOT NULL ORDER BY id;
```

```console
lag with offset+default : [{"id":10,"total":100,"two_back":-1},
                           {"id":11,"total":50, "two_back":-1},
                           {"id":12,"total":200,"two_back":100},
                           {"id":13,"total":0,  "two_back":50},
                           {"id":14,"total":200,"two_back":200}]
```

The first two rows have no row two positions back, so they get the default `-1` instead of
`NULL`. The usual use of the third argument is `0`:

```sql
total - lag(total, 1, 0) OVER (ORDER BY id) AS delta   -- first row shows its own total
coalesce(lag(total) OVER (ORDER BY id), total)          -- first row shows zero change
```

Which is right depends on whether the first row's "change" means "everything is new" or
"no comparison available". Choose explicitly rather than letting `NULL` decide.

**The offset must be a constant expression per row**, and PostgreSQL enforces that
loosely enough to surprise you:

```console
lag with a non-constant offset  ok  rows=6 [{"lag":null},{"lag":null},{"lag":null}]
```

`lag(total, id)` was **accepted** and returned `NULL` everywhere — the offsets (10 to 15)
all reach past the start of a six-row partition. No error, no warning, a column of
`NULL`s. If you see an all-`NULL` `lag` column, check that the offset is what you think it
is.

## Partitions bound it

```sql
SELECT customer_id, id, total,
       lag(total) OVER (PARTITION BY customer_id ORDER BY id) AS prev
FROM agg_orders WHERE total IS NOT NULL ORDER BY customer_id, id;
```

```console
lag inside a partition : [{"customer_id":1,"id":10,"total":100,"prev":null},
                          {"customer_id":1,"id":11,"total":50, "prev":100},
                          {"customer_id":2,"id":12,"total":200,"prev":null},
                          {"customer_id":2,"id":14,"total":200,"prev":200},
                          {"customer_id":3,"id":13,"total":0,  "prev":null}]
  lag() does NOT cross a partition boundary - first row of each partition is NULL
```

**Three `NULL`s, one per customer.** `lag` never crosses a partition boundary, which is
exactly right for "each customer's previous order" and is the reason you almost always
want `PARTITION BY` here. Without it, customer 2's first order would have compared itself
to customer 1's last — a number with no meaning that no error will ever flag.

## `ORDER BY` is not optional in practice

It is optional in syntax:

```console
lag without ORDER BY  ok  rows=6 [{"id":10,"lag":null},{"id":11,"lag":100},{"id":12,"lag":50}]
  legal, but the "previous row" is whatever order the scan happened to produce
```

The query ran and produced plausible-looking values. "Previous" meant "previous in
whatever order the executor happened to emit rows", which can change with a plan flip, a
vacuum, or a parallel scan. **`lag`/`lead` without `ORDER BY` is always a bug**, and one
that will not announce itself.

The same tiebreaker rule as [ranking](../ranking/) applies: if the `ORDER BY` is not
unique, which of two peer rows is "previous" is arbitrary.

## The day-over-day pattern, and the gap that breaks it

This is the most common use of `lag` and the most common way it goes wrong:

```sql
SELECT day::date, n, n - lag(n) OVER (ORDER BY day) AS change
FROM (SELECT date_trunc('day', placed_at) AS day, count(*)::int AS n
      FROM agg_orders GROUP BY 1) d
ORDER BY day;
```

```console
lag over a gapless series (the day-over-day pattern):
[{"day":"2026-02-28T18:30:00.000Z","n":2,"change":null},
 {"day":"2026-03-02T18:30:00.000Z","n":1,"change":-1},
 {"day":"2026-03-03T18:30:00.000Z","n":1,"change":0},
 {"day":"2026-03-04T18:30:00.000Z","n":2,"change":1}]
  2026-03-02 is missing entirely, so "change" compares 03-01 to 03-03
```

**The fixture has no orders on 2026-03-02, so that day has no row** — and `lag` has no
concept of a missing row. It returns the previous *row*, which is 2026-03-01. The second
output row therefore reports "change: -1" for what is labelled the 3rd, comparing it
against the 1st and quietly skipping a day.

> **`lag` counts rows, not days.** Any time-series comparison over grouped data is wrong
> unless the series is dense.

Nothing errors. The chart draws a continuous line across a gap that exists in the data,
and week-over-week comparisons drift by however many empty days there were.

*(The dates render a day early in JavaScript for the usual reason — `::date` is parsed as
local midnight and this machine is at +5:30. See
[empty groups and grouping keys](../01-group-by/02-empty-groups-and-keys.md).)*

### The fix: generate the spine

Build every day in the range and `LEFT JOIN` the data onto it, so there are no missing
rows for `lag` to skip over:

```sql
WITH days AS (
  SELECT generate_series('2026-03-01'::date, '2026-03-05'::date, interval '1 day')::date AS day
),
counts AS (
  SELECT d.day, count(o.id)::int AS n
  FROM days d
  LEFT JOIN agg_orders o
    ON date_trunc('day', o.placed_at)::date = d.day
  GROUP BY d.day
)
SELECT day, n, n - lag(n) OVER (ORDER BY day) AS change
FROM counts ORDER BY day;
```

Two details carried over from elsewhere in this corpus, both of which are bugs if you get
them wrong:

- **`count(o.id)`, not `count(*)`.** Across the `LEFT JOIN`, `count(*)` reports **1** for
  every empty day — a gap-filled report that looks like a quiet steady week.
  [Measured in the joins phase](../../phase-5-joins/07-cross-join.md).
- **`generate_series` endpoints are inclusive**, so a series over one day at hourly
  resolution produces **25** rows, not 24.
  [Measured in phase 4](../../phase-4-crud/18-generate-series.md).

## In Node

```js
const {rows} = await pool.query(
  `WITH days AS (
     SELECT generate_series($1::date, $2::date, interval '1 day')::date AS day
   ), counts AS (
     SELECT d.day, count(o.id)::int AS n
     FROM days d
     LEFT JOIN agg_orders o ON date_trunc('day', o.placed_at)::date = d.day
     GROUP BY d.day
   )
   SELECT to_char(day, 'YYYY-MM-DD') AS day,
          n,
          n - lag(n) OVER (ORDER BY day)                    AS change,
          round(100.0 * (n - lag(n) OVER (ORDER BY day))
                / nullif(lag(n) OVER (ORDER BY day), 0), 1) AS pct_change
   FROM counts ORDER BY day`,
  [from, to],
);
```

`nullif(lag(n) …, 0)` is the guard that stops a division by zero when yesterday was zero —
`nullif` turns the divisor into `NULL` and the whole expression into `NULL`, which is the
honest answer for "percentage growth from nothing". And `to_char` returns the day as text
so the driver does not re-interpret it.

## Trade-off

`lag`/`lead` turn a self-join into a column: one pass, no join, and the comparison is
right next to the value it compares. The costs are the window's sort — see
[what windows cost](../06-windows-intro/03-what-windows-cost.md) — and a semantics that
counts rows rather than time. Every time-series use therefore carries a hidden
precondition (the series is dense) that the SQL does not state and no error enforces.
Generate the spine whenever the reader will read the result as a timeline.

## Gotchas

**Symptom:** a day-over-day change column is wrong after quiet days
**Cause:** `lag` returns the previous **row**, and days with no data have no row — so it
silently compares across the gap
**Fix:** generate a dense date spine with `generate_series` and `LEFT JOIN` the data onto
it before applying `lag`

**Symptom:** the gap-filled report shows 1 for every empty day
**Cause:** `count(*)` after the `LEFT JOIN` counts the `NULL`-extended row
**Fix:** `count(o.id)`. A uniformly wrong report reads as a quiet steady week, which is
why this survives review

**Symptom:** the first row's change is `NULL` and a chart drops the whole series
**Cause:** `lag` has no previous row, and `NULL` propagates through the subtraction
**Fix:** `lag(n, 1, 0)` or `coalesce(...)` — and decide whether the first period's change
should be zero, its own value, or genuinely absent

**Symptom:** a `lag` column is entirely `NULL`
**Cause:** the offset is larger than the partition — including the case where a
non-constant expression was passed. Measured: `lag(total, id)` was accepted and returned
all `NULL`s
**Fix:** check the offset is the constant you intended

**Symptom:** each customer's first order compares against a different customer's last
**Cause:** no `PARTITION BY`, so the window spans the whole result
**Fix:** `PARTITION BY customer_id`. The first row of each partition then correctly gets
`NULL`

**Symptom:** "previous row" values change between runs
**Cause:** `ORDER BY` omitted from the window, or not unique — both legal, both undefined
**Fix:** always order the window, with a unique tiebreaker

**Symptom:** `division by zero` in a percentage-change column
**Cause:** the previous period was 0
**Fix:** `nullif(lag(n) OVER (…), 0)` as the divisor

## Interview questions

**★ Your day-over-day report is wrong after a quiet weekend. Why?**
`lag` returns the previous **row**, not the previous day, and days with no data produce no
row — so the comparison silently skips the gap. Measured: with 2026-03-02 absent, the
report compared 03-03 against 03-01. Generate a dense date spine and `LEFT JOIN` onto it.

**★ Why is the first row of each partition `NULL` for `lag`?**
There is no preceding row within the partition, and `lag` does not cross partition
boundaries. Supply the third argument — `lag(x, 1, 0)` — if a default is more useful than
`NULL`.

**★ Is `ORDER BY` required inside `OVER` for `lag`?**
Not by the syntax — the query runs. But "previous" then means "previous in whatever order
the executor produced", which can change with the plan. It is always a bug. If the
`ORDER BY` is not unique, which peer is "previous" is also arbitrary.

**★ What are the three arguments to `lag`?**
The expression, the offset (default 1), and the value to return when the offset falls
outside the partition (default `NULL`). Measured: `lag(total, 2, -1)` gave `-1` for the
first two rows.

**How do you compute percentage change safely?**
`100.0 * (n - lag(n) OVER w) / nullif(lag(n) OVER w, 0)` — `100.0` to avoid integer
division, `nullif` to avoid dividing by a zero previous period.

**`lag` versus a self-join — what does the window buy?**
One pass instead of a join, no risk of fan-out, and the comparison expressed next to the
value. The self-join also needs a correct "previous row" predicate, which is hard when the
ordering key is not a dense integer.

---

← [Topic index](README.md) · Next → [first_value, last_value, nth_value](02-first-and-last.md)
