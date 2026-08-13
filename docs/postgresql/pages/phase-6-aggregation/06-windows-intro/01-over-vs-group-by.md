---
title: "OVER keeps the rows"
sidebar_label: "01 · OVER keeps the rows"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex36-aggregation.mjs`.

**Same aggregate, same numbers, different row count. `GROUP BY` returns one row per
group; `OVER (PARTITION BY …)` returns every original row with the group's value attached
to it. Once you see the two side by side, most "I need a self-join for this" problems
stop being problems.**

## The same numbers, two ways

```sql
SELECT customer_id, sum(total)::int AS spend
FROM agg_orders WHERE total IS NOT NULL
GROUP BY customer_id ORDER BY customer_id;
```

```console
GROUP BY : [{"customer_id":1,"spend":150},{"customer_id":2,"spend":400},
            {"customer_id":3,"spend":0}]
```

```sql
SELECT id, customer_id, total,
       sum(total) OVER (PARTITION BY customer_id)::int AS cust_total
FROM agg_orders WHERE total IS NOT NULL ORDER BY id;
```

```console
OVER (PARTITION BY) : [{"id":10,"customer_id":1,"total":100,"cust_total":150},
                       {"id":11,"customer_id":1,"total":50, "cust_total":150},
                       {"id":12,"customer_id":2,"total":200,"cust_total":400},
                       {"id":13,"customer_id":3,"total":0,  "cust_total":0},
                       {"id":14,"customer_id":2,"total":200,"cust_total":400}]
  same numbers, one row per ORDER retained
```

**Three rows out of the first, five out of the second, and the sums are identical.**
Customer 1's 150 appears once in the grouped result and twice in the windowed one — once
against each of their orders.

The mental model that makes the rest of this topic easy:

> **`PARTITION BY` is `GROUP BY` that does not collapse.** For each row, PostgreSQL finds
> the set of rows sharing its partition key, computes the aggregate over that set, and
> attaches the answer to *that row*.

Everything else in `OVER (…)` narrows which of those partition rows participate.

## `OVER ()` — the whole result as one partition

Omit `PARTITION BY` and every row is in the same partition:

```sql
SELECT id, total,
       sum(total) OVER ()::int AS grand,
       round(100.0 * total / sum(total) OVER (), 1) AS pct
FROM agg_orders WHERE total IS NOT NULL ORDER BY id;
```

```console
OVER () whole result : [{"id":10,"total":100,"grand":550,"pct":"18.2"},
                        {"id":11,"total":50, "grand":550,"pct":"9.1"},
                        {"id":12,"total":200,"grand":550,"pct":"36.4"},
                        {"id":13,"total":0,  "grand":550,"pct":"0.0"},
                        {"id":14,"total":200,"grand":550,"pct":"36.4"}]
```

**This is the canonical use of window functions and the one to internalise first.**
"Each row as a percentage of the total" requires the total, which requires reading every
row — and without windows you would compute it in a subquery, a CTE, or a second query,
and join it back. `sum(total) OVER ()` does it in one pass with no join.

Note `100.0 *` rather than `100 *`: integer division would floor every percentage to zero
before the multiplication. And `pct` comes back as a string because it is `numeric` —
[the same driver rule as everywhere](../01-group-by/01-collapsing-rows.md).

## `ORDER BY` inside `OVER` — running totals

Add an `ORDER BY` inside the window and the aggregate becomes **cumulative**:

```sql
SELECT id, total, sum(total) OVER (ORDER BY id)::int AS running
FROM agg_orders WHERE total IS NOT NULL ORDER BY id;
```

```console
running total (ORDER BY): [{"id":10,"total":100,"running":100},
                           {"id":11,"total":50, "running":150},
                           {"id":12,"total":200,"running":350},
                           {"id":13,"total":0,  "running":350},
                           {"id":14,"total":200,"running":550}]
```

Nothing was added except `ORDER BY id`, and the meaning changed completely — from "the
total of the partition" to "the total so far".

**Why:** an `ORDER BY` inside a window implies a default *frame* of `RANGE BETWEEN
UNBOUNDED PRECEDING AND CURRENT ROW` — "from the start of the partition up to this row".
Without `ORDER BY` the default frame is the whole partition. That default is also the
source of two classic surprises, both covered on [window frames](../frames/): rows
with equal `ORDER BY` values (peers) share a running total, and `last_value` returns the
current row rather than the last one.

The two `ORDER BY`s in that query do different jobs and both are needed:

| Where | Job |
|---|---|
| inside `OVER (ORDER BY id)` | defines accumulation order — changes the **values** |
| the query's final `ORDER BY id` | defines output row order — changes the **presentation** |

Drop the outer one and the running totals are still correct, but they arrive in scan
order, which reads as nonsense. Drop the inner one and you get the partition total on
every row.

## Combining: partition and order

```sql
SELECT customer_id, id, total,
       sum(total) OVER (PARTITION BY customer_id ORDER BY id)::int AS running_for_customer
FROM agg_orders WHERE total IS NOT NULL ORDER BY customer_id, id;
```

Per-customer running totals: the accumulation restarts at each new customer, because
`PARTITION BY` bounds it. This is the shape behind account statements, cumulative revenue
by region, and every "running X within Y" report.

## What a window can be built from

Any aggregate works with `OVER`: `sum`, `count`, `avg`, `min`, `max`, `array_agg`,
`jsonb_agg`, `string_agg`, and the [ordered-set aggregates](../ordered-set/). So do
the window-only functions — `row_number`, `rank`, `lag`, `lead` — which exist *only* in
this context and are covered in [ranking](../ranking/) and
[lag/lead](../lag-lead/).

`FILTER` composes too, and the clause order is fixed:

```sql
count(*) FILTER (WHERE status = 'paid') OVER ()
```

Measured on [FILTER](../04-filter-clause/02-when-it-pays.md). `FILTER` before `OVER`; the
reverse is a syntax error.

## In Node

Nothing special — the values come back as ordinary columns:

```js
const {rows} = await pool.query(
  `SELECT id, total,
          sum(total) OVER ()::int                      AS grand_total,
          round(100.0 * total / sum(total) OVER (), 1)::float8 AS pct,
          sum(total) OVER (ORDER BY id)::int           AS running
   FROM agg_orders
   WHERE customer_id = $1 AND total IS NOT NULL
   ORDER BY id`,
  [customerId],
);
```

The `::float8` on `pct` is deliberate: `round()` returns `numeric`, which arrives as a
string. Cast it if the client wants a number, and leave it `numeric` if the value is
money.

One thing worth noticing: **`grand_total` is repeated on every row.** That is inherent —
the window value belongs to each row — and it means a 10 000-row result carries 10 000
copies of the same number. Usually irrelevant; occasionally the reason to run a separate
one-row query for the total instead.

## Trade-off

Window functions replace self-joins and second queries with one pass, and they are the
only way to express per-row context without leaving SQL. The cost is that **every window
needs its input sorted** — measured in [chunk 03](03-what-windows-cost.md) as 530 ms for
one window over 500 000 rows, most of it an external merge sort — and that the aggregate
value is duplicated onto every row of its partition. Neither matters on a page of results;
both matter on a full-table report.

## Gotchas

**Symptom:** every percentage is `0`
**Cause:** integer division — `100 * total / sum(...)` divides before it multiplies, and
both operands are integers
**Fix:** `100.0 * total / sum(total) OVER ()`, forcing numeric arithmetic

**Symptom:** adding `ORDER BY` inside `OVER (…)` changed the numbers, not just the order
**Cause:** an `ORDER BY` inside a window implies a cumulative frame (`UNBOUNDED PRECEDING`
to `CURRENT ROW`); without it the frame is the whole partition
**Fix:** intended behaviour — that is how a running total is written. If you wanted the
partition total, remove the inner `ORDER BY`

**Symptom:** a running total is correct but the rows come out in a strange order
**Cause:** the `ORDER BY` inside `OVER` does not order the result; only the query's own
`ORDER BY` does
**Fix:** write both. They are separate clauses doing separate jobs

**Symptom:** rows with the same `ORDER BY` value share a running total instead of stepping
**Cause:** the default frame is `RANGE`, which includes all peers of the current row
**Fix:** `ROWS UNBOUNDED PRECEDING` for a strict row-by-row accumulation — see
[frames](../frames/)

**Symptom:** `sum(total) OVER (PARTITION BY customer_id)` differs from the `GROUP BY`
version of the same report
**Cause:** it should not — check whether the `GROUP BY` version has a `HAVING`, or whether
one of them is inside a join that fans out
**Fix:** compare row counts first. The windowed form keeps every input row, so a fan-out
is visible there and hidden by the grouping

**Symptom:** the response is large and mostly repeated values
**Cause:** a window aggregate is attached to every row of its partition
**Fix:** if only the total is needed, query it separately; if both, accept it or return
the total once in an envelope

## Interview questions

**★ What is the difference between `sum(x) OVER (PARTITION BY g)` and `GROUP BY g`?**
The values are identical; the row count is not. `GROUP BY` returns one row per group;
the window form returns every input row with its group's value attached. Measured: three
rows against five, same sums.

**★ How do you show each row as a percentage of the total in one query?**
`100.0 * total / sum(total) OVER ()`. `OVER ()` makes the whole result one partition, so
the total is available on every row without a self-join or a second query. Use `100.0`,
not `100`, or integer division floors it to zero.

**★ What does adding `ORDER BY` inside `OVER (…)` do?**
It turns the aggregate cumulative, by implying a frame of `RANGE BETWEEN UNBOUNDED
PRECEDING AND CURRENT ROW`. Measured: the same `sum(total) OVER (…)` went from the
partition total on every row to a running total.

**★ Is the `ORDER BY` inside `OVER` the same as the query's `ORDER BY`?**
No. The inner one defines accumulation order and changes the values; the outer one
defines the order rows are returned in. A query that needs both must write both.

**Which aggregates can be used as window functions?**
All of them — `sum`, `count`, `avg`, `min`, `max`, `array_agg`, `jsonb_agg`, the
ordered-set aggregates. Plus the window-only functions (`row_number`, `rank`, `lag`,
`lead`), which cannot be used without `OVER`.

**Where does `FILTER` go relative to `OVER`?**
Before it: `count(*) FILTER (WHERE …) OVER (…)`. The reverse is a syntax error, and
`FILTER` only attaches to aggregates — not to `row_number` or `rank`.

---

← [Topic index](README.md) · Next → [Where windows run](02-where-windows-run.md)
