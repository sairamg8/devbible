---
title: "generate_series and helpers"
sidebar_label: "18 · generate_series"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`,
> server `TimeZone: UTC`), **Node 24.19.0** (`TZ: Asia/Calcutta`), `pg` 8.23.0.
> Scripts: `sandbox/pg-api/ex19-series-values.mjs`, `ex14-crud.mjs`.

**`generate_series` invents rows that are not in any table. It is how you seed test data,
number things, and — the use worth learning properly — fill the gaps in a report so days
with no activity still appear.**

## The basic form

```console
$ node ex14-crud.mjs
=== 12. generate_series, VALUES, unnest ===
┌─────────┬───┬────┐
│ (index) │ g │ sq │
├─────────┼───┼────┤
│ 0       │ 1 │ 1  │
│ 1       │ 2 │ 4  │
│ 2       │ 3 │ 9  │
│ 3       │ 4 │ 16 │
└─────────┴───┴────┘
```

```sql
SELECT g, g * g AS sq FROM generate_series(1, 4) g;
```

It is a **set-returning function**: put it in `FROM` and it behaves as a table you can
join, filter and aggregate.

## Steps, direction and endpoints

```console
$ node ex19-series-values.mjs
=== 3. step arguments ===
generate_series(1,10,3)      → 1, 4, 7, 10
generate_series(5,1,-2)      → 5, 3, 1
generate_series(5,1)         → (no rows)
generate_series(1,2,0.5)     → 1, 1.5, 2.0
step of 0                    → 22023 step size cannot equal zero
hourly buckets over one day  → 25 rows (both endpoints included)
```

Four things worth keeping:

- **Both endpoints are inclusive.** One day of hourly buckets is **25 rows**, not 24 —
  midnight appears at each end. For 24, stop at `'23:00'` or use a half-open range with
  `< end`.
- **A descending series needs a negative step.** `generate_series(5, 1)` silently returns
  **no rows** rather than erroring — an empty report where you expected data.
- Non-integer steps work with `numeric`.
- A zero step raises `22023` rather than looping forever.

## Gap filling — the reason it matters

Aggregating a table only produces rows for values that exist. Days with no events vanish,
so a chart draws a line straight from the 1st to the 3rd:

```console
=== 1. gap filling a daily report ===
plain GROUP BY — missing days simply do not exist:
┌─────────┬──────────────────────────┬───┐
│ (index) │ at                       │ n │
├─────────┼──────────────────────────┼───┤
│ 0       │ 2026-02-28T18:30:00.000Z │ 2 │
│ 1       │ 2026-03-02T18:30:00.000Z │ 1 │
│ 2       │ 2026-03-05T18:30:00.000Z │ 3 │
└─────────┴──────────────────────────┴───┘
```

`LEFT JOIN` a generated series and every day is present, zeros included:

```console
LEFT JOIN a generated series — every day present:
┌─────────┬──────────────────────────┬───┐
│ (index) │ day                      │ n │
├─────────┼──────────────────────────┼───┤
│ 0       │ 2026-02-28T18:30:00.000Z │ 2 │
│ 1       │ 2026-03-01T18:30:00.000Z │ 0 │
│ 2       │ 2026-03-02T18:30:00.000Z │ 1 │
│ 3       │ 2026-03-03T18:30:00.000Z │ 0 │
│ 4       │ 2026-03-04T18:30:00.000Z │ 0 │
│ 5       │ 2026-03-05T18:30:00.000Z │ 3 │
│ 6       │ 2026-03-06T18:30:00.000Z │ 0 │
└─────────┴──────────────────────────┴───┘
```

```sql
SELECT d::date AS day, count(e.id)::int AS n
FROM generate_series(date '2026-03-01', date '2026-03-07', interval '1 day') d
LEFT JOIN s_events e ON e.at = d::date
GROUP BY d ORDER BY d;
```

Two details make this work:

- **`count(e.id)`, not `count(*)`.** `count(*)` counts rows produced by the join, which
  is 1 even when nothing matched — every gap would read `1` instead of `0`.
- The series must be on the **left** of the `LEFT JOIN`, so unmatched days survive.

Doing this in JavaScript means building a date array, keying the rows into a map, and
handling time zones in two languages. One join is less code and cannot disagree with
itself.

*(Those timestamps look shifted by a day. That is the next section, and it is not a bug
in the query.)*

## The `date` corruption trap

```console
=== 2. how a date column reaches JavaScript ===
default parser  → 2025-12-31T18:30:00.000Z | 2026-01-01T18:30:00.000Z | 2026-01-02T18:30:00.000Z
  ↑ 2026-01-01 became the previous day in UTC — local midnight, shifted
```

`date '2026-01-01'` arrived in Node as **`2025-12-31T18:30:00.000Z`**. Nothing is wrong
with the database — the server is on UTC and holds a pure calendar date with no time and
no zone. The damage happens in the driver: `pg` turns a `date` into a JavaScript `Date` at
**local midnight**, and this machine runs `Asia/Calcutta` (UTC+5:30), so local midnight is
18:30 the previous day in UTC.

Serialize that to JSON and the API reports the wrong day. It is invisible in UTC
development and appears only for users or servers west of UTC — or, as here, east of it.

Two fixes, both measured:

```console
to_char         → 2026-01-01 | 2026-01-02 | 2026-01-03
setTypeParser   → 2026-01-01 | 2026-01-02 | 2026-01-03
```

```sql
-- 1. never let it become a Date: format it in SQL
SELECT to_char(d, 'YYYY-MM-DD') AS day FROM generate_series(…) d;
```

```js
// 2. or stop the driver converting type 1082 (date) at all — process-wide
pg.types.setTypeParser(1082, v => v);   // '2026-01-01' as a plain string
```

The second is the better default for an application that has calendar dates: a date is a
string of three numbers, and turning it into an instant is the error. Do it once at
startup, before any query. Note this is `date` only — `timestamptz` (1184) is a genuine
instant and its default conversion to `Date` is correct. Related:
[Date/time functions](17-datetime-functions.md) and
[Type parsing](../phase-7-pg-driver/08-type-parsing.md).

## Seeding test data

```sql
INSERT INTO d_big (junk) SELECT repeat('x', 100) FROM generate_series(1, 200000);

INSERT INTO c_items (sku, name, qty)
SELECT 'sku-' || g, 'Item ' || g, (random() * 100)::int
FROM generate_series(1, 10000) g;
```

One statement, no round trips — this is how every table in this phase's sandbox scripts
gets populated, and it is far faster than looping inserts from the application
([`INSERT`](04-insert.md)).

## Keeping the input order with `WITH ORDINALITY`

```console
=== 4. WITH ORDINALITY — keeping the input order ===
┌─────────┬─────┬─────┐
│ (index) │ val │ pos │
├─────────┼─────┼─────┤
│ 0       │ 'c' │ '1' │
│ 1       │ 'a' │ '2' │
│ 2       │ 'b' │ '3' │
└─────────┴─────┴─────┘
```

```sql
SELECT * FROM unnest(ARRAY['c','a','b']) WITH ORDINALITY AS t(val, pos);
```

Any set-returning function can carry a position column this way. It is how you preserve
a client-supplied order — `ORDER BY pos` restores the array's order, which is otherwise
not guaranteed once the values reach a join.

## Trade-off

Generating rows in SQL keeps the logic next to the data, produces one result the database
can sort and aggregate, and avoids reimplementing calendar arithmetic in the application.
It costs readability — a gap-filled report reads less obviously than a loop — and
`generate_series` over a huge range genuinely materialises those rows, so an unbounded
series is a memory problem.

Bound the range explicitly, and remember the planner has no statistics for a generated
set: it assumes 1000 rows, which can produce a poor join order for large series.

## Gotchas

**Symptom:** A date is one day earlier in the API response than in the database
**Cause:** `pg` converts `date` to a JS `Date` at local midnight — measured,
`date '2026-01-01'` became `2025-12-31T18:30:00.000Z` under `Asia/Calcutta`.
**Fix:** `to_char(d, 'YYYY-MM-DD')`, or `pg.types.setTypeParser(1082, v => v)` at
startup.

**Symptom:** An hourly series returns one row more than expected
**Cause:** Both endpoints are inclusive — measured, 25 rows across one day.
**Fix:** Stop one step short, or filter `< end`.

**Symptom:** A descending series returns nothing
**Cause:** `generate_series(5, 1)` with the default step of `+1` — no error, no rows.
**Fix:** Supply a negative step: `generate_series(5, 1, -2)`.

**Symptom:** Every gap in a gap-filled report shows `1` instead of `0`
**Cause:** `count(*)` counts the join's output row, which exists even with no match.
**Fix:** `count(e.id)` — count a column from the outer-joined table.

**Symptom:** Gap filling still omits days
**Cause:** The series is on the right of the `LEFT JOIN`, or an `e.*` predicate in
`WHERE` turned it back into an inner join.
**Fix:** Series on the left; move conditions on the joined table into the `ON` clause.

**Symptom:** `22023 step size cannot equal zero`
**Cause:** A computed step evaluated to 0.
**Fix:** Validate the step before the query.

**Symptom:** A query with a large series is slow or uses a bad join order
**Cause:** The planner assumes 1000 rows for a set-returning function.
**Fix:** Bound the range, or materialise the series into a temporary table and `ANALYZE`
it.

## Interview questions

**★ How do you produce a report with a row for every day, including days with no data?**
`LEFT JOIN` from `generate_series(start, end, interval '1 day')` to the table, grouping by
the generated day. Two details matter: the series must be the left side, and the
aggregate must be `count(e.id)` rather than `count(*)` — measured, `count(*)` reports 1
for empty days because the outer join still produces a row.

**★ Why does a `date` column come back as the wrong day in Node?**
`pg` converts PostgreSQL `date` into a JavaScript `Date` at **local** midnight. Measured
under `Asia/Calcutta`, `date '2026-01-01'` arrived as `2025-12-31T18:30:00.000Z`, so
serializing to JSON reports the previous day. Fix with `to_char` in SQL, or
`pg.types.setTypeParser(1082, v => v)` so dates stay strings. `timestamptz` is unaffected
— it is a real instant.

**★ How many rows does an hourly `generate_series` over one day return?**
25 — measured. Both endpoints are inclusive, so midnight appears at the start and the
end. Stop at 23:00 or use a half-open range for 24.

**★ What happens with `generate_series(5, 1)`?**
No rows, and no error. The default step is `+1`, which cannot reach a smaller endpoint.
Descending series need an explicit negative step. This is a common cause of a silently
empty report.

**What is `WITH ORDINALITY` for?**
It adds a position column to any set-returning function, so the input order survives —
measured, `unnest(ARRAY['c','a','b']) WITH ORDINALITY` gave positions 1, 2, 3 in array
order. Necessary because row order is otherwise not guaranteed once values pass through a
join.

**How would you seed a million test rows?**
`INSERT INTO t (…) SELECT … FROM generate_series(1, 1000000)` — one statement, computed
server-side, with no round trips.

---

← [Date/time functions](17-datetime-functions.md) · Next → [`VALUES` and `unnest`](19-values-unnest.md)
