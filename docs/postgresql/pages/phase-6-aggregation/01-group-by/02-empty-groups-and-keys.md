---
title: "Empty groups and grouping keys"
sidebar_label: "02 · Empty groups and keys"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex36-aggregation.mjs`,
> `sandbox/pg-api/ex36c-agg-checks.mjs`.

**Two things decide the *shape* of an aggregate result rather than its numbers: whether
a query with no matching rows returns one row or none, and what the grouping key does
with `NULL`s and expressions. Both are places where the SQL is right and the API
response is still wrong.**

## One row, or no rows?

```sql
SELECT count(*)::int AS n, sum(total) AS revenue
FROM agg_orders WHERE status = 'refunded';
```

```console
=== C2. one row vs zero rows over an empty selection ===
no GROUP BY  : [{"n":0,"revenue":null}]
with GROUP BY: []
```

Same `WHERE`, same empty selection, two completely different result shapes:

- **No `GROUP BY`** → exactly one row, always, even over an empty table. There is one
  implicit group (everything), and it produces one output row.
- **With `GROUP BY`** → zero rows. There are no groups, so there is nothing to emit.

This decides what your Node code has to check:

```js
// no GROUP BY — rows.length is ALWAYS 1; check the value
const {rows} = await pool.query(
  `SELECT count(*)::int AS n, coalesce(sum(total),0)::int AS revenue
   FROM agg_orders WHERE status = $1`, [status]);
const {n, revenue} = rows[0];          // safe

// with GROUP BY — rows may be empty; check the length
const {rows: byStatus} = await pool.query(
  `SELECT status, count(*)::int AS n FROM agg_orders GROUP BY status`);
if (byStatus.length === 0) { /* genuinely nothing */ }
```

Testing `rows.length` on the first form is the bug: it is 1 whether the table has a million rows or none, so the "no data" branch is unreachable.

## `sum` over nothing is `NULL`, `count` over nothing is `0`

Look at that first result again: `n` is `0`, `revenue` is `null`.

```console
empty set : [{"n":0,"revenue":null,"avg":null}]
  count()=0 but sum()/avg() are NULL, not 0 - coalesce(sum(total),0) if you need 0
```

Mathematically defensible — the average of nothing is undefined — and operationally hostile, because `NULL` propagates. `sum(total) * 1.2` is `NULL`. `sum(total) + shipping` is `NULL`. The JSON field is `null` and the chart renders a gap instead of a zero.

```sql
SELECT coalesce(sum(total), 0)::int AS revenue
FROM agg_orders WHERE status = 'refunded';
-- 0
```

**Do the `coalesce` in SQL, not in JavaScript.** By the time the value reaches JS, any arithmetic in the same select list has already been poisoned:

```sql
-- wrong: shipping is added to NULL, so the whole expression is NULL
SELECT sum(total) + 500 AS with_shipping FROM agg_orders WHERE status='refunded';
-- right
SELECT coalesce(sum(total), 0) + 500 AS with_shipping FROM agg_orders WHERE status='refunded';
```

`count` is the exception that returns `0` rather than `NULL`. The asymmetry is worth
memorising because it flips whether "no data" looks like zero or like missing,
depending purely on which aggregate you reached for. The same asymmetry appears again
with [`bool_and` over an empty set](../ordered-set/), which is `NULL` rather than
the vacuous `true` most people predict.

## `NULL` as a grouping key

```sql
SELECT coupon, count(*)::int AS n FROM agg_orders
GROUP BY coupon ORDER BY coupon NULLS LAST;
```

```console
=== C5. NULL as a grouping key groups with itself ===
[{"coupon":"SPRING","n":1},{"coupon":"WELCOME","n":2},{"coupon":null,"n":3}]
  three NULL coupons collapse into ONE group, unlike NULL = NULL
```

Three rows with `coupon IS NULL` produced **one** group, not three and not zero. This is the one context in SQL where `NULL` is treated as equal to itself — grouping, `DISTINCT`, `UNION` and window `PARTITION BY` all use *not distinct from* semantics rather than `=`.

Compare with what `=` would do: `NULL = NULL` is `NULL`, which is not true, so a
self-join on `coupon` would match none of these rows. Both behaviours are correct for
their context and the inconsistency is real; the rule is that **grouping-like
operations use equality-with-`NULL`s-equal, predicates use three-valued logic.** Full
treatment on [three-valued logic](../../phase-2-types/06-null.md).

The practical consequence is a label, not a number: your API now has a group whose key
is `null`, and the client must render it as something. Decide in SQL:

```sql
SELECT coalesce(coupon, '(none)') AS coupon, count(*)::int AS n
FROM agg_orders GROUP BY 1 ORDER BY 1;
```

Be careful with that specific trick when the column can legitimately contain the
placeholder string — `coalesce(country, 'unknown')` merges genuine `'unknown'` values
into the `NULL` bucket. When the distinction matters, keep them apart with a boolean
flag, or use [`GROUPING()`](../grouping-sets/), which exists precisely to tell a
data `NULL` from a synthetic one.

## Grouping by more than one column

The grouping key is the whole list, treated as a tuple:

```sql
SELECT c.country, o.status, count(*)::int AS n
FROM agg_orders o JOIN agg_customers c ON c.id = o.customer_id
GROUP BY c.country, o.status
ORDER BY 1, 2;
```

```console
=== C6. two-column GROUP BY on the fixture ===
[{"country":"GB","status":"cancelled","n":1},
 {"country":"GB","status":"open","n":1},
 {"country":"GB","status":"paid","n":1},
 {"country":"IN","status":"open","n":1},
 {"country":"US","status":"paid","n":2}]
```

Five rows out of six orders — only `(US, paid)` had two members. Two things follow:

**Combinations that do not occur do not appear.** There is no `(IN, paid)` row showing `0`. A grid UI that expects `countries × statuses` cells will silently render a ragged table. If you need the full grid you have to manufacture it — a [cross join against a spine](../../phase-5-joins/07-cross-join.md) of the two dimensions, `LEFT JOIN`ed to this result.

**The row count is not predictable from either input.** Six orders became five rows.
Adding a third grouping column can only ever increase the row count towards the number
of input rows; at the limit, grouping by enough columns is just the input back again,
with the aggregate overhead paid for nothing.

## Grouping by an expression

The grouping key does not have to be a column:

```sql
SELECT date_trunc('day', placed_at)::date AS day, count(*)::int AS n
FROM agg_orders GROUP BY 1 ORDER BY 1;
```

```console
=== C4. grouping by day — the three renderings ===
::date       : [{"day":"2026-02-28T18:30:00.000Z","n":2},
                {"day":"2026-03-02T18:30:00.000Z","n":1},
                {"day":"2026-03-03T18:30:00.000Z","n":1},
                {"day":"2026-03-04T18:30:00.000Z","n":2}]
to_char      : [{"day":"2026-03-01","n":2},{"day":"2026-03-03","n":1},
                {"day":"2026-03-04","n":1},{"day":"2026-03-05","n":2}]
AT TIME ZONE : [{"local_day":"2026-03-01","n":2},{"local_day":"2026-03-03","n":1},
                {"local_day":"2026-03-04","n":1},{"local_day":"2026-03-05","n":2}]
session TimeZone: [{"TimeZone":"UTC"}]  client TZ: Asia/Calcutta
```

Four groups from six orders, and **the `::date` rendering is a day early in
JavaScript**. That is not a grouping bug. `::date` produces a `date`, and `pg` parses a
bare `date` as *local* midnight; this machine runs `TZ=Asia/Calcutta` (+5:30), so
`2026-03-01` becomes `2026-02-28T18:30:00.000Z`. The grouping itself was correct — the
`to_char` row proves it, showing the same four counts on the right days.

**Send the day as text when the client should not reinterpret it.** `to_char(...,
'YYYY-MM-DD')` is the smallest fix and the one this corpus uses. The alternative is
`pg.types.setTypeParser(1082, v => v)` at startup, which changes every `date` column in
the process — fine as a deliberate policy, surprising as a local fix. Full write-up on
[dates, series and the driver](../../phase-4-crud/18-generate-series.md).

### The subtler half: which day is "a day"?

`date_trunc` truncates in the **session** time zone. The server here is `UTC`, so
`date_trunc('day', placed_at)` groups by UTC days — and an order placed at
`2026-03-05 18:00+00` is already past midnight in Delhi. A "daily orders" report built
this way is correct for a UTC reader and wrong for everyone else, in a way that only
shows up in the rows near midnight.

```sql
SELECT to_char(date_trunc('day', placed_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD')
         AS local_day,
       count(*)::int AS n
FROM agg_orders GROUP BY 1 ORDER BY 1;
```

`placed_at AT TIME ZONE 'Asia/Kolkata'` converts the `timestamptz` to a `timestamp`
(no zone) *in that zone*, and truncating that gives local days. On this fixture the
counts happen to match the UTC grouping — none of the six orders straddles the
boundary — which is exactly why this bug survives testing. It needs a row placed
between 18:30 and 24:00 UTC to appear.

Name the zone explicitly in any report that a human reads. Relying on the session
default means the answer depends on which connection ran it.

## Trade-off

Every fix on this page moves work into SQL: `coalesce` in the select list, `to_char`
instead of a date type, an explicit `AT TIME ZONE`. The cost is that the query is now
carrying presentation concerns, and a second consumer of the same query may want
different ones. The alternative — returning raw `NULL`s, `date`s and UTC truncation,
and normalising in each client — is worse in practice, because each client normalises
slightly differently and the discrepancies surface as "the dashboard and the export
disagree". Normalise once, at the edge of the database, and document which zone the
report means.

## Gotchas

**Symptom:** the "no results" branch of an endpoint never runs
**Cause:** an aggregate query without `GROUP BY` always returns exactly one row, so
`rows.length === 0` is never true
**Fix:** check the value (`n === 0`), not the row count. With `GROUP BY` it is the
reverse — check `rows.length`

**Symptom:** `revenue` is `null` in the JSON, and `revenue + shipping` is `null` too
**Cause:** `sum()` over an empty group is `NULL`, not `0`, and `NULL` propagates
through the rest of the expression
**Fix:** `coalesce(sum(total), 0)` in SQL, before any arithmetic. Doing it in JS is
too late — the addition already happened

**Symptom:** a chart shows a `null` category the designer never planned for
**Cause:** `NULL`s in the grouping column form one legitimate group
**Fix:** `coalesce(col, '(none)')` in the query — but not if the column can genuinely
contain that string, in which case use `GROUPING()` or a separate flag

**Symptom:** a `(country, status)` grid renders ragged, missing cells
**Cause:** `GROUP BY` emits only combinations that occur; empty combinations are
absent, not zero
**Fix:** build the spine with a cross join over the two dimensions and `LEFT JOIN` the
aggregate onto it

**Symptom:** the daily chart is off by one day, but only for some readers
**Cause:** two independent causes in the same query — `date_trunc` truncates in the
session time zone, and a `date` column is re-parsed by `pg` as local midnight
**Fix:** `AT TIME ZONE '<the zone the report means>'` in SQL, and return the day as
`to_char(...)` text so the driver cannot reinterpret it

**Symptom:** the time-zone bug does not reproduce in tests
**Cause:** it only appears for rows whose UTC timestamp falls on the other side of
local midnight — with a +5:30 offset, that is 18:30–24:00 UTC
**Fix:** put a row in that window into the fixture deliberately

## Interview questions

**★ An aggregate query over an empty table — how many rows come back?**
One, if there is no `GROUP BY`; there is always exactly one implicit group. Zero, if
there is a `GROUP BY`; there are no groups to emit. Measured both ways. This decides
whether your code checks `rows[0].n` or `rows.length`.

**★ What does `sum()` return over an empty group, and why does it matter?**
`NULL`, not `0` — while `count()` returns `0`. It matters because `NULL` propagates:
`sum(total) * 1.2` becomes `NULL` and the API field becomes `null` rather than `0`.
Wrap it as `coalesce(sum(x), 0)` in SQL, before the arithmetic.

**★ What happens to `NULL`s in the grouping column?**
They form a single group. Grouping, `DISTINCT`, `UNION` and window `PARTITION BY` all
treat `NULL` as *not distinct from* `NULL`, unlike `=`, which returns `NULL`. Measured:
three `NULL` coupons produced one group of 3.

**★ Your daily-orders chart is off by one day for some readers. Where do you look?**
Two independent causes live in that one query. `date_trunc` truncates in the session
time zone, so a UTC server groups by UTC days; and `::date` is re-parsed by `pg` as
local midnight on the client. Fix by truncating with an explicit `AT TIME ZONE` and
returning the day as text.

**Why does a `(country, status)` report have fewer rows than countries × statuses?**
Because `GROUP BY` emits only the combinations present in the data. Missing
combinations are absent rather than zero. Generate the full grid from a cross join of
the dimensions and `LEFT JOIN` the aggregate onto it.

**Is `AT TIME ZONE` converting to or from a zone?**
Both, depending on the input type. Applied to a `timestamptz` it yields a `timestamp`
*in* that zone (what a local clock would read); applied to a `timestamp` it yields a
`timestamptz`, interpreting the input as being in that zone. For daily grouping you
want the first form.

---

← [Collapsing rows](01-collapsing-rows.md) · Next → [What you are allowed to select](03-what-you-can-select.md)
