---
title: "Where windows run"
sidebar_label: "02 · Where windows run"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex36-aggregation.mjs`.

**Window functions are evaluated after `GROUP BY` and after `HAVING`, and before
`DISTINCT` and `ORDER BY`. Two consequences follow mechanically: you cannot filter on a
window result in the same query level, and you *can* build a window over an aggregate.
Both surprise people, in opposite directions.**

## The position in the pipeline

```
FROM → WHERE → GROUP BY → HAVING → SELECT list → WINDOW FUNCTIONS
     → DISTINCT → ORDER BY → LIMIT
```

Everything on this page is that one line read carefully.

## You cannot filter on a window function

```console
window function in WHERE  -> 42P20 window functions are not allowed in WHERE
window function in HAVING -> 42P20 window functions are not allowed in HAVING
```

`42P20` is `windowing_error`, and it has its own code precisely because this is a
frequent mistake. The reason is not arbitrary: `WHERE` decides which rows exist, and a
window function's value depends on which rows exist. Allowing `WHERE row_number() OVER
(ORDER BY id) <= 3` would be circular — removing a row changes the row numbers of the
rows that remain.

`HAVING` fails for the same reason one step later: it runs before windows, so the value
does not exist yet.

### The fix: one more query level

```sql
SELECT id FROM (
  SELECT id, row_number() OVER (ORDER BY id) AS rn FROM agg_orders
) s WHERE rn <= 2;
```

```console
the fix: wrap it in a subquery: [{"id":10},{"id":11}]
```

The inner query level computes the window; the outer one filters on the result. A CTE
reads slightly better and behaves identically here:

```sql
WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn FROM agg_orders
)
SELECT id FROM numbered WHERE rn <= 2;
```

Since PostgreSQL 12 a single-reference CTE is inlined by default, so this is not an
optimisation fence — see [CTEs](../09-ctes.md). Use whichever reads better; the corpus
uses the subquery for two-line cases and a CTE when there are several stages.

**This is not a workaround, it is the shape of the answer.** "Top 3 per group" is
*inherently* two steps: compute a ranking over all rows, then keep the first three.
Writing it as two query levels is the honest expression of that, and the planner has an
optimisation specifically for it — `Run Condition`, which pushes the `rn <= 3` test *into*
the window node so it can stop early. That is measured on
[ranking](../ranking/).

## You *can* build a window over an aggregate

The other direction is legal and much less well known:

```sql
SELECT status, count(*)::int AS n,
       sum(count(*)) OVER ()::int AS all_rows,
       round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct
FROM agg_orders GROUP BY status ORDER BY status;
```

```console
windows run AFTER GROUP BY: [{"status":"cancelled","n":1,"all_rows":6,"pct":"16.7"},
                             {"status":"open",     "n":2,"all_rows":6,"pct":"33.3"},
                             {"status":"paid",     "n":3,"all_rows":6,"pct":"50.0"}]
  count(*) inside a window OVER () - legal, and the usual way to get a percentage of total
```

`sum(count(*)) OVER ()` looks like nonsense on first reading — an aggregate of an
aggregate. It is not: `count(*)` is computed by the `GROUP BY`, producing one value per
group, and *then* `sum(…) OVER ()` runs over those three group rows. The pipeline order
makes it unambiguous.

**This is the standard way to add a "percentage of total" column to a grouped report**,
and the alternative — computing the total in a CTE and joining it back — is more code for
the same plan. Worth recognising on sight, because it is the one window expression that
looks wrong and is not.

The same applies to ranking grouped results:

```sql
SELECT status, count(*)::int AS n,
       rank() OVER (ORDER BY count(*) DESC)::int AS busiest
FROM agg_orders GROUP BY status;
```

And filtering *that* still needs a subquery, because it is still a window.

## `DISTINCT` runs after windows

A subtle consequence of the same ordering: `SELECT DISTINCT` de-duplicates rows **after**
window functions have been computed, so a window value can prevent de-duplication.

```sql
-- these do NOT return the same number of rows
SELECT DISTINCT customer_id FROM agg_orders;
SELECT DISTINCT customer_id, row_number() OVER (ORDER BY id) FROM agg_orders;
```

The second gives every row a unique `row_number`, so nothing is duplicate and nothing is
removed. If you meant to de-duplicate first, that is another query level.

## The named `WINDOW` clause

When two or more expressions share a window definition, name it once:

```sql
SELECT id, sum(total) OVER w ::int AS running, count(*) OVER w AS n
FROM agg_orders WHERE total IS NOT NULL
WINDOW w AS (ORDER BY id)
ORDER BY id;
```

```console
named WINDOW clause : [{"id":10,"running":100,"n":"1"},{"id":11,"running":150,"n":"2"},
                       {"id":12,"running":350,"n":"3"},{"id":13,"running":350,"n":"4"},
                       {"id":14,"running":550,"n":"5"}]
```

The `WINDOW` clause sits between `HAVING` and `ORDER BY`. It is purely a naming
convenience — it does **not** cause PostgreSQL to share work that it would not otherwise
share; the planner already merges identical window definitions, as the plans in
[chunk 03](03-what-windows-cost.md) show. What it buys is that the definition exists in
one place, so a change to the partitioning cannot be applied to three expressions and
missed on a fourth.

A named window can also be extended:

```sql
WINDOW w AS (PARTITION BY customer_id), w_ord AS (w ORDER BY id)
```

`w_ord` inherits the partitioning and adds ordering. You may add `ORDER BY` and a frame
to an inherited window; you may not change or add `PARTITION BY`.

Note `n` came back as the string `"1"` — `count(*)` is `bigint`, window or not. Cast it.

## Trade-off

The evaluation order is what makes windows composable — they can see aggregates because
they run later — and it is also why every "filter on a ranking" needs an extra query
level. That extra level is free at plan time (the planner flattens it, and can even push
the filter into the window node), and it is not free at reading time: a three-level
nested query to express "top 3 per customer, then join to their names" is genuinely
harder to read than the imaginary version where `WHERE` could see `row_number()`. Use
CTEs to name the stages when there is more than one.

## Gotchas

**Symptom:** `42P20 window functions are not allowed in WHERE`
**Cause:** windows are evaluated after `WHERE`; allowing it would be circular, since
removing rows changes window values
**Fix:** compute the window in a subquery or CTE and filter in the outer query

**Symptom:** `42P20 … not allowed in HAVING` when trying to keep only the top groups
**Cause:** `HAVING` also runs before windows
**Fix:** same — group in an inner query, rank and filter outside

**Symptom:** `sum(count(*)) OVER ()` looks wrong in review and gets "fixed" into a join
**Cause:** unfamiliarity — it is legal and standard, because the window runs after the
grouping
**Fix:** keep it; it is the shortest correct way to add a percentage-of-total column to
a grouped report

**Symptom:** `SELECT DISTINCT` stopped removing duplicates after a window column was added
**Cause:** `DISTINCT` runs after windows, and a `row_number` makes every row unique
**Fix:** de-duplicate in an inner query, then apply the window outside

**Symptom:** the `WINDOW` clause was added expecting a speed-up and nothing changed
**Cause:** it is a naming convenience; the planner already shares identical window
definitions
**Fix:** keep it for maintainability, not performance. The performance lever is making
windows *compatible* — see chunk 03

**Symptom:** `count(*) OVER (…)` arrives in Node as a string
**Cause:** `count` returns `bigint` in a window exactly as it does in a `GROUP BY`
**Fix:** `count(*) OVER (…)::int`, or a type parser

## Interview questions

**★ Why can't you write `WHERE row_number() OVER (ORDER BY id) <= 3`?**
Because `WHERE` decides which rows exist and the window value depends on which rows
exist — the request is circular. PostgreSQL rejects it with `42P20`. Compute the window
in a subquery or CTE and filter outside.

**★ `HAVING` runs after `GROUP BY`, so why can't it filter a window function either?**
Because windows run *after* `HAVING`, not before. The pipeline is `GROUP BY → HAVING →
SELECT → windows`, so at `HAVING` time the window value does not exist yet. Same `42P20`.

**★ Explain `sum(count(*)) OVER ()`.**
`count(*)` is computed per group by the `GROUP BY`; then the window function sums those
per-group counts across all groups, because windows run after grouping. It is the
standard way to add a percentage-of-total column without a self-join.

**★ Does the `WINDOW` clause make a query faster?**
No — the planner already merges identical window definitions. It makes the definition
exist in one place, which matters when four expressions share it and one gets edited.
The real performance lever is designing windows so they can share a sort.

**Why does adding a window column stop `SELECT DISTINCT` from de-duplicating?**
`DISTINCT` runs after window functions, so a `row_number` — unique per row by
construction — makes every row distinct. De-duplicate at an inner level instead.

**Is wrapping a window in a subquery expensive?**
No. The planner flattens it, and for the `rn <= N` pattern it can push the condition into
the window node as a `Run Condition`, letting the scan stop early. The cost is
readability, not execution.

---

← [OVER keeps the rows](01-over-vs-group-by.md) · Next → [What windows cost](03-what-windows-cost.md)
