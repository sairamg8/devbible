---
title: "Correlated subqueries and what they cost"
sidebar_label: "02 · Correlated subqueries"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex37-cte-subquery.mjs`,
> `sandbox/pg-api/ex37c-correlated-cost.mjs`.

**A correlated subquery references a column from the outer query, so it cannot be computed
once — it is re-executed for each outer row. That is an N+1 query written inside a single
statement: no round trips, but the same shape of work, and the plan says so in one word.**

## The shape

```sql
SELECT c.name,
       (SELECT count(*)::int FROM agg_orders o WHERE o.customer_id = c.id) AS n
FROM agg_customers c
ORDER BY c.name;
```

```console
correlated subquery     : [{"name":"Ann","n":2},{"name":"Bob","n":2},{"name":"Cid","n":1},
                          {"name":"Dee","n":1},{"name":"Eve","n":0}]
  Eve gets 0, not NULL — count() over an empty set is 0
```

`c.id` is the correlation: the subquery cannot run until it knows which customer it is
being asked about. On five customers that is five executions and nobody notices.

## `count()` gives 0, `sum()` gives `NULL`

Eve has no orders, and the answer depends on which aggregate you asked for:

```console
correlated sum vs Eve   : [{"name":"Ann","spend":150},{"name":"Bob","spend":400},
                           {"name":"Cid","spend":0},{"name":"Dee","spend":null},
                           {"name":"Eve","spend":null}]
  but sum() over an empty set is NULL — the two aggregates differ here
```

**`count()` over an empty set is 0; `sum()`, `avg()`, `min()` and `max()` are `NULL`.**
That inconsistency is real and cannot be reasoned away — it has to be remembered.

Note also that Cid and Dee differ for a *second* reason. Cid has one order whose total is
`0`, so the sum is genuinely `0`. Dee has one order whose total is `NULL`, and summing a
single `NULL` gives `NULL`. **Three different situations — no rows, a zero, and a `NULL`
value — collapse into two indistinguishable outputs** unless you handle them:

```sql
coalesce((SELECT sum(o.total) FROM agg_orders o WHERE o.customer_id = c.id), 0) AS spend
```

Wrap in `coalesce` when the API contract says "a number", and keep the `NULL` when the
distinction between "no data" and "zero" matters to the reader. Deciding not to decide is
what puts `null` into a JSON field that the client renders as `NaN`.

## The plan tells you immediately

```console
  -- 11a. the correlated plan — SubPlan re-executed per row
  Subquery Scan on u (actual rows=5000.00 loops=1)
    ->  HashAggregate (actual rows=5000.00 loops=1)
          Group Key: agg_events.user_id
          ->  Parallel Seq Scan on agg_events (actual rows=166666.67 loops=3)
    SubPlan 1
      ->  Aggregate (actual rows=1.00 loops=5000)
            ->  Index Only Scan using agg_ev_user_amt on agg_events e (actual rows=100.00 loops=5000)
                  Index Cond: (user_id = u.user_id)
                  Heap Fetches: 0
                  Index Searches: 5000
```

**`SubPlan` plus `loops=5000` is the entire diagnosis.** `loops=` on a plan node is how
many times that subtree ran, and here it is once per distinct user. `Index Searches: 5000`
counts the index probes. Whenever you see a `SubPlan` with a high `loops`, you are looking
at per-row work — that is the signature to scan for in any slow query's plan.

## What it costs, measured properly

The obvious comparison is the same question asked with one `GROUP BY`:

```sql
SELECT user_id, count(*) AS n FROM agg_events GROUP BY user_id;
```

Measuring this honestly took two attempts. **Two runs of the same correlated query gave
136.85 ms and 889.41 ms** — the plan had flipped between an `Index Only Scan` and a
`Bitmap Heap Scan` reading 500 000 heap blocks, depending on whether the visibility map
happened to be current. Publishing either number alone would have been publishing a coin
flip, so the measurement was redone with that variable controlled:

```console
=== A. visibility map SET (freshly vacuumed) — the best case for the correlated form ===
  after VACUUM
    correlated (5000 probes) : 145.00 ms
    one GROUP BY             : 65.26 ms
    ratio                    : 2.2x
    ->  Index Only Scan using agg_ev_user_amt on agg_events e (actual rows=100.00 loops=5000)
    Heap Fetches: 0

=== B. visibility map STALE — one write is enough to lose the index-only scan ===
  after touching 1 row in every 500
    correlated (5000 probes) : 413.69 ms
    one GROUP BY             : 90.34 ms
    ratio                    : 4.6x
    ->  Index Only Scan using agg_ev_user_amt on agg_events e (actual rows=100.00 loops=5000)
    Heap Fetches: 133359
```

```console
=== C. the point ===
  correlated: 145 ms clean -> 413.69 ms stale  (2.9x worse)
  GROUP BY  : 65.26 ms clean -> 90.34 ms stale
  The GROUP BY barely moves: it reads the heap once either way.
  The correlated form swings, because 5000 probes each pay the heap cost.
```

Three things worth taking from that:

- **The correlated form is 2.2× slower even at its best**, with a perfect index and
  `Heap Fetches: 0`.
- **It degrades 2.9× from a single pass of writes**, because `Heap Fetches` went from 0 to
  133 359 — each of the 5000 probes now visits the heap. The `GROUP BY` moved by 38%,
  because it reads the heap once regardless.
- **So the ratio is not a fixed number**, and a benchmark of this on a freshly loaded table
  flatters the correlated form. Production tables are never freshly vacuumed.

That last point is the practical one: the correlated query's cost is *coupled to table
maintenance state* in a way the set-based query's is not. It is fastest exactly when you
measure it and slowest exactly when you need it.

## Rewriting it

The correlated form and the `GROUP BY` answer the same question:

```sql
-- correlated: one probe per customer
SELECT c.name, (SELECT count(*)::int FROM agg_orders o WHERE o.customer_id = c.id) AS n
FROM agg_customers c;

-- set-based: one pass, then a join
SELECT c.name, coalesce(o.n, 0) AS n
FROM agg_customers c
LEFT JOIN (SELECT customer_id, count(*)::int AS n FROM agg_orders GROUP BY customer_id) o
       ON o.customer_id = c.id;
```

The `LEFT JOIN` version needs `coalesce` to reproduce the correlated version's `0` for a
customer with no orders, because the join produces `NULL` where the correlated `count()`
produced `0`. **That is the same trap as `count(*)` versus `count(o.id)` across a
`LEFT JOIN`** — [measured in the joins phase](../../phase-5-joins/07-cross-join.md), where
`count(*)` reports 1 for an empty group.

When *not* to rewrite:

- **The subquery is uncorrelated.** Then it already runs once and there is nothing to fix.
- **The outer row count is genuinely small** — a handful of rows, as in a detail endpoint.
  Five probes cost nothing and the correlated form reads better.
- **The planner has already un-correlated it.** PostgreSQL can transform some correlated
  subqueries into joins or semi-joins. Read the plan before rewriting: if there is no
  `SubPlan` with a high `loops`, there is nothing to fix.

## It is the same shape as an N+1

A correlated subquery over 5000 rows and an application loop issuing 5000 queries are the
same algorithm; only the round trips differ. The database version is far cheaper —
no network, no parse per statement — which is exactly why it survives review. It is still
`O(outer rows)` index probes where a single pass would do, and it still degrades with table
size in a way the set-based form does not.

If the loop is in JavaScript, [Node's N+1 page](/docs/nodejs/pages/phase-6-data-access/n-plus-1)
covers the fix. If the loop is inside the statement, the fix is on this page.

## In Node

```js
// Correlated: fine for one customer, wrong for a list endpoint.
const {rows} = await pool.query(
  `SELECT c.id, c.name,
          (SELECT count(*)::int FROM agg_orders o WHERE o.customer_id = c.id) AS orders
   FROM agg_customers c WHERE c.id = $1`,
  [id],
);

// Set-based: the same answer for a whole page of customers, one pass.
const {rows} = await pool.query(
  `SELECT c.id, c.name, coalesce(o.n, 0) AS orders
   FROM agg_customers c
   LEFT JOIN (SELECT customer_id, count(*)::int AS n
              FROM agg_orders GROUP BY customer_id) o ON o.customer_id = c.id
   ORDER BY c.id LIMIT $1`,
  [limit],
);
```

- **`::int` on the count.** `count()` returns `bigint`, which `pg` hands back as a string to
  avoid precision loss ([phase 7](../../phase-7-pg-driver/09-pg-types.md)). Cast when the
  value is small enough to be a JS number — a page count always is.
- **`coalesce(o.n, 0)`** to keep the API contract stable. Without it the field is `null` for
  a customer with no orders, and the correlated version it replaced returned `0`.
- **The rewrite changes the shape, so re-check the tests** that assert on `0` versus `null`.

## Trade-off

A correlated subquery keeps the per-row question next to the row, needs no join and no
`GROUP BY`, and cannot fan out — for a detail endpoint it is the clearest thing to write.
The cost is `O(outer rows)` executions, a plan whose speed depends on vacuum state, and a
shape that looks identical whether the outer query returns 5 rows or 5 million. Use it
where the outer set is bounded and small by construction; convert to a single pass the
moment the outer side is a list endpoint.

## Gotchas

**Symptom:** a query is slow and the plan shows `SubPlan` with `loops=` in the thousands
**Cause:** a correlated subquery is being re-executed per outer row
**Fix:** rewrite as a `GROUP BY` plus `LEFT JOIN`, or `LATERAL` if the subquery returns
several rows. Measured: 145.00 ms versus 65.26 ms even in the best case

**Symptom:** the same correlated query benchmarks 2× slower one day and 6× slower the next
**Cause:** its cost depends on `Heap Fetches`, which depends on whether the visibility map
is current. Measured: `Heap Fetches` 0 → 133 359 after touching 1 row in 500, and the query
went 145.00 ms → 413.69 ms while the `GROUP BY` moved only 65.26 → 90.34 ms
**Fix:** do not benchmark on a freshly vacuumed table and conclude the correlated form is
fine

**Symptom:** a total is `NULL` for a row with no matches, and the client renders `NaN`
**Cause:** `sum()`/`avg()`/`min()`/`max()` over an empty set are `NULL`; only `count()` is 0
**Fix:** `coalesce(..., 0)` when the contract says "a number"

**Symptom:** rewriting a correlated `count()` as a `LEFT JOIN` turned zeros into nulls
**Cause:** the join produces no row to count, where the correlated `count()` returned 0
**Fix:** `coalesce(o.n, 0)` — and check the tests that assert on the difference

**Symptom:** "no orders", "one order totalling 0" and "one order with a NULL total" all look
the same in the response
**Cause:** two of them produce `NULL` and one produces `0`, and `coalesce` merges the rest
**Fix:** return `count()` alongside the `sum()` if the caller needs to tell them apart

## Interview questions

**★ What makes a subquery correlated, and why does it matter?**
It references a column from the outer query, so it cannot be evaluated once — it is
re-executed per outer row. In the plan that appears as a `SubPlan` with `loops` equal to the
outer row count. It is an N+1 inside a single statement.

**★ How do you spot one in a plan?**
`SubPlan` with a high `loops=` value, and `Index Searches` matching the outer row count.
Measured: `Aggregate (actual rows=1.00 loops=5000)` over an index scan probed 5000 times.

**★ How much does it actually cost versus a `GROUP BY`?**
Measured on 5000 groups over 500 000 rows: 145.00 ms versus 65.26 ms with the visibility map
current, and 413.69 ms versus 90.34 ms after a single pass of writes made it stale. The
correlated form degraded 2.9×; the `GROUP BY` barely moved.

**★ Why does the correlated version degrade so much more?**
Because each of the 5000 probes pays its own heap cost once the index-only scan stops
working — `Heap Fetches` went 0 → 133 359. The `GROUP BY` reads the heap once either way.

**★ `count()` returns 0 for an empty set but `sum()` returns `NULL`. Why does that matter?**
Because rewriting a correlated `count()` as a `LEFT JOIN` silently turns those zeros into
nulls, and a client that expected a number gets `null`. `coalesce(..., 0)` is the fix, and
it has to be applied deliberately.

**When is a correlated subquery the right choice?**
When the outer set is small by construction — a detail endpoint fetching one row — or when
the planner has already flattened it into a join, which the plan will show by having no
`SubPlan` at all.

---

← [Scalar and row subqueries](01-scalar-and-row.md) · Next → [IN, EXISTS and the NOT IN trap](03-in-exists-and-not-in.md)
