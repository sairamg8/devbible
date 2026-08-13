---
title: "CROSS JOIN"
sidebar_label: "07 · CROSS JOIN"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex35-joins.mjs`.

**A cross join pairs every left row with every right row. Written deliberately it builds
calendar spines and grids; written by accident — a comma between two tables and a missing
condition — it produces `n × m` rows and no error whatsoever.**

## Deliberate

```sql
SELECT count(*) AS n FROM j_customers CROSS JOIN generate_series(1,3);
```

```console
$ node ex35-joins.mjs
=== 7. CROSS JOIN — deliberate and accidental ===
deliberate cross join    : [{"n":12}]
```

4 customers × 3 series values = **12**. No condition, and none expected — the explicit
`CROSS JOIN` keyword is the signal to a reader that the product is intended.

## Accidental

The comma form is the same operation with nothing to announce it:

```sql
SELECT count(*) AS n FROM j_customers c, j_orders o;
```

```console
the accidental form (comma, no condition): [{"n":20}]
  4 customers x 5 orders = 20 rows and no error at all
```

**20 rows and no error at all.** This is what a forgotten `WHERE o.customer_id = c.id`
produces. On a four-row fixture it is obvious; on two tables of 100 000 rows it is
10 000 000 000 rows, and the query does not fail — it runs until something else gives out.

### The arithmetic is why it is dangerous

A cross join's output is `n × m`. That is unremarkable until you notice how fast it moves:

| Left rows | Right rows | Output rows |
|---|---|---|
| 4 | 5 | 20 |
| 1 000 | 1 000 | 1 000 000 |
| 100 000 | 100 000 | 10 000 000 000 |

The last line is not a query that runs slowly — it is a query that will not finish, while
consuming CPU and filling temporary space. And because each individual row is cheap, there
is no early signal: the query looks healthy for the first several seconds.

The planner does estimate this correctly. `EXPLAIN` on an accidental cross join shows a
`rows=` estimate equal to the product, which is the fastest way to confirm the diagnosis
without running anything.

The comma is legacy syntax that predates the `JOIN` keyword; PostgreSQL treats
`FROM a, b WHERE a.id = b.a_id` as exactly equivalent to `FROM a JOIN b ON b.a_id = a.id`.
The reason to abandon it is not performance, it is that the join condition ends up mixed
into `WHERE` alongside genuine filters, so a missing one is invisible. With explicit
`JOIN … ON`, forgetting the condition is a **syntax error** — the parser demands `ON` or
`USING`. That single property is why this corpus writes `JOIN` everywhere.

The same defence applies at review time: `CROSS JOIN` spelled out is a deliberate act you
can question; a comma is not.

## The real uses

### A calendar spine

The most common legitimate cross join — every entity paired with every day in a range, so
a report has a row even where there is no data:

```sql
SELECT c.name, d::date AS day
FROM j_customers c
CROSS JOIN generate_series('2026-01-01'::date, '2026-01-02'::date, '1 day') d
WHERE c.id <= 2
ORDER BY c.id, day;
```

```console
a real use - a calendar spine: [{"name":"Ann","day":"2025-12-31T18:30:00.000Z"},
                                {"name":"Ann","day":"2026-01-01T18:30:00.000Z"},
                                {"name":"Bob","day":"2025-12-31T18:30:00.000Z"},
                                {"name":"Bob","day":"2026-01-01T18:30:00.000Z"}]
```

Two customers × two days = four rows. `LEFT JOIN` the fact table onto that spine and every
customer-day appears, zero-filled — the gap-filling pattern from
[generate_series](../phase-4-crud/18-generate-series.md).

**Note the dates.** `2026-01-01` came back as `2025-12-31T18:30:00.000Z`. The machine's
`TZ` is Asia/Calcutta (+5:30) and `pg` parses a `date` into a JS `Date` at **local**
midnight, which is the previous day in UTC. The value is not wrong, but `.toISOString()`
on it is off by one. Fix by formatting server-side with `to_char(d,'YYYY-MM-DD')` or
registering `pg.types.setTypeParser(1082, v => v)` —
[type parsing](../phase-7-pg-driver/08-type-parsing.md) has the measurement.

### The complete gap-filling shape

The spine on its own is only half the pattern. The other half is `LEFT JOIN`ing the facts
onto it and being careful with the aggregate:

```sql
SELECT c.name,
       to_char(d, 'YYYY-MM-DD')        AS day,
       count(o.id)::int                AS orders,
       coalesce(sum(o.total), 0)::int  AS revenue
FROM j_customers c
CROSS JOIN generate_series($1::date, $2::date, '1 day') d
LEFT JOIN j_orders o ON o.customer_id = c.id AND o.created_at::date = d::date
GROUP BY c.id, c.name, d
ORDER BY c.id, d;
```

Ann has orders on 2026-03-01 and 2026-03-03, so 03-02 and 03-04 are the days that exist only
because the spine put them there:

```console
gap-filled report (Ann, 03-01..03-04): [{"name":"Ann","day":"2026-03-01","orders":1,"revenue":100},{"name":"Ann","day":"2026-03-02","orders":0,"revenue":0},{"name":"Ann","day":"2026-03-03","orders":1,"revenue":50},{"name":"Ann","day":"2026-03-04","orders":0,"revenue":0}]
```

Four rows for four days, with `0`/`0` on the two Ann did nothing — which is the entire point
of the pattern, since a plain `GROUP BY created_at::date` would have returned two rows and
left the caller to notice the gaps.

Four details, each of which has its own failure mode covered elsewhere in this phase:

- The date filter is in **`ON`**, not `WHERE` — in `WHERE` it would discard the empty days
  the spine exists to create ([ON vs WHERE](02-left-join/02-on-vs-where.md)).
- **`count(o.id)`**, not `count(*)` — the latter counts the null-extended row, so it reports
  1 for an empty day. Same query, one aggregate changed:

  ```console
    same query with count(*) instead of count(o.id): [{"day":"2026-03-01","wrong_orders":1},{"day":"2026-03-02","wrong_orders":1},{"day":"2026-03-03","wrong_orders":1},{"day":"2026-03-04","wrong_orders":1}]
  ```

  Every day reports exactly one order, including the two with none. Note how plausible that
  looks: no nulls, no zeros, no error — a report that is uniformly wrong reads as a report of
  a quiet, steady week.
- **`coalesce(sum(...), 0)`** — an all-NULL group sums to NULL, not 0.
- **`to_char`** — otherwise the date shifts a day in JSON, as below.

Get any one wrong and the report is subtly wrong rather than obviously broken, which is
what makes gap-filling queries worth writing from a template.

### Other grids

- **Every combination to test**: sizes × colours × warehouses, to find missing SKUs by
  anti-joining the real table against the grid.
- **A tiny lookup applied to every row**: cross joining a one-row table of constants or
  thresholds is cheaper to read than repeating a scalar subquery.
- **Fan a row into N rows**: `CROSS JOIN generate_series(1, quantity)` expands an order
  line into one row per unit. That one is correlated, so it is really a
  [LATERAL](10-lateral.md) — PostgreSQL allows `generate_series` to reference the left
  side without the keyword, but writing `CROSS JOIN LATERAL` states the dependency.

## From Node

```js
const {rows} = await pool.query(
  `SELECT c.id, to_char(d, 'YYYY-MM-DD') AS day,
          coalesce(sum(o.total), 0)::int AS revenue
   FROM j_customers c
   CROSS JOIN generate_series($1::date, $2::date, '1 day') d
   LEFT JOIN j_orders o ON o.customer_id = c.id AND o.created_at::date = d::date
   GROUP BY c.id, d
   ORDER BY c.id, d`,
  [from, to],
);
```

The spine is cross joined, the facts are `LEFT JOIN`ed onto it, and `to_char` sidesteps
the timezone shift above. Bound the series with parameters — an unbounded or
user-controlled range is a denial-of-service in one line.

## Trade-off

A cross join is the only way to materialise combinations that do not exist in the data,
and against a small right side (`generate_series`, a handful of constants) it costs almost
nothing. The danger is entirely in the size: output is the *product*, so it grows
quadratically while the inputs grow linearly, and the planner will not warn you. Treat any
cross join with an unbounded right side as a resource risk and put a `statement_timeout`
behind it ([Phase 11](../phase-11-mvcc/)).

## Gotchas

**Symptom:** A query returns a huge number of rows and never finishes
**Cause:** A missing join condition — the comma form silently produced `n × m`
**Fix:** `EXPLAIN` and look for `Nested Loop` with no join filter, or a `rows=` estimate
that is the product of the inputs. Rewrite with explicit `JOIN … ON`

**Symptom:** Removing one table from a comma-separated FROM changes totals
**Cause:** That table was multiplying every row and inflating aggregates
**Fix:** Join conditions belong in `ON`, filters in `WHERE`, so the two are visibly
different

**Symptom:** Calendar-spine days are off by one in the JSON response
**Cause:** `date` parsed to local midnight, then serialised as UTC
**Fix:** `to_char(d,'YYYY-MM-DD')`, or `setTypeParser(1082, v => v)`

**Symptom:** Gap-filled report shows 1 instead of 0 for empty days
**Cause:** `count(*)` counting the NULL-extended spine row
**Fix:** `count(fact.id)` — the same trap as [LEFT JOIN](left-join/)

## Interview questions

**★ What does `FROM a, b` mean, and why avoid it?**
It is a cross join — every pairing — filtered afterwards by whatever ends up in `WHERE`.
Avoid it because omitting the condition is legal and silent: the measurement produced 20
rows from 4 and 5 with no error. With `JOIN … ON`, the same omission is a syntax error.

**★ Give a legitimate use for `CROSS JOIN`.**
A calendar or category spine: cross join entities with `generate_series` over a date
range, then `LEFT JOIN` the facts so every bucket exists even with no data. Also
combination grids for finding gaps.

**★ How do you spot an accidental cross join in a plan?**
A join node with no condition, and an estimated or actual row count equal to the product
of its inputs. `EXPLAIN (ANALYZE, BUFFERS)` shows both.

**Is `CROSS JOIN` slower than `INNER JOIN`?**
Not per row — it is the row *count* that hurts. A cross join against a three-row series is
trivial; against a large table it is quadratic. The planner has no filter to reduce it.

**Why did the calendar-spine dates come back as the previous day?**
`pg` maps `date` to a JS `Date` at local midnight; with `TZ=Asia/Calcutta` that is 18:30
UTC the day before. Format the date in SQL or override the type parser.

**Write a query that reports revenue per customer per day with no missing days.**
Cross join customers with `generate_series` over the range, `LEFT JOIN` the orders with the
date condition **in `ON`**, then `count(o.id)` and `coalesce(sum(o.total), 0)`. Each of
those four choices has its own failure mode — a `WHERE` date filter deletes the empty days,
`count(*)` reports 1 for them, and a bare `sum` returns NULL.

**How would you bound the risk of a user-supplied date range?**
Parameterise the series endpoints, validate the span in the application, and set a
`statement_timeout`. An unbounded `generate_series` cross joined against a table is a
denial-of-service in one line.

---

← [RIGHT and FULL OUTER](06-outer-joins.md) · Next → [ON vs USING vs NATURAL](08-on-using-natural.md)
