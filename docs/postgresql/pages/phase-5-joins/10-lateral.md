---
title: "LATERAL"
sidebar_label: "10 · LATERAL"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex35-joins.mjs`.

**`LATERAL` lets a subquery in the FROM clause reference columns from the tables to its
left — so it runs once per driving row. That is what makes "the 3 most recent orders for
each customer" a single statement, and it beat the window-function alternative by 5.6×
here once the comparison was set up honestly.**

## The rule

An ordinary subquery in `FROM` is evaluated once, independently. It cannot see `o.id`:

```sql
-- ERROR: 42P01 invalid reference to FROM-clause entry for table "o"
SELECT o.id, i.sku
FROM j_orders o,
     (SELECT sku FROM j_order_items x WHERE x.order_id = o.id LIMIT 1) i;
```

Add `LATERAL` and the reference is legal. The subquery is then re-evaluated for each row of
the driving side — a correlated subquery that may return **many columns and many rows**,
which is exactly what a scalar subquery in the select list cannot do.

## Top-1 per group

```sql
SELECT o.id AS order_id, i.sku, i.qty
FROM j_orders o
CROSS JOIN LATERAL (SELECT sku, qty FROM j_order_items x
                    WHERE x.order_id = o.id
                    ORDER BY qty DESC LIMIT 1) i
ORDER BY o.id;
```

```console
$ node ex35-joins.mjs
=== 10. LATERAL — top-N per group ===
top 1 item per order     : [{"order_id":10,"sku":"B","qty":2},{"order_id":11,"sku":"A","qty":5},
                            {"order_id":12,"sku":"C","qty":1}]
  ^ CROSS JOIN LATERAL dropped orders with no items (13 and 14)
```

Three rows from five orders. **`CROSS JOIN LATERAL` behaves like an inner join**: when the
subquery returns no rows for a driving row, that driving row is dropped. Orders 13 and 14
have no items and disappeared.

## Keeping the empty ones: LEFT JOIN LATERAL … ON true

```sql
SELECT o.id AS order_id, i.sku
FROM j_orders o
LEFT JOIN LATERAL (SELECT sku FROM j_order_items x
                   WHERE x.order_id = o.id
                   ORDER BY qty DESC LIMIT 1) i ON true
ORDER BY o.id;
```

```console
LEFT JOIN LATERAL keeps them: [{"order_id":10,"sku":"B"},{"order_id":11,"sku":"A"},
                               {"order_id":12,"sku":"C"},{"order_id":13,"sku":null},
                               {"order_id":14,"sku":null}]
```

Five rows, with `sku: null` for the two empty orders. The `ON true` is required syntax, not
decoration — `LEFT JOIN` demands a condition, and the real matching already happened inside
the subquery's `WHERE`. **`LEFT JOIN LATERAL (…) ON true` is the form you want almost
every time**; `CROSS JOIN LATERAL` silently filters.

## Top-N per group, measured

200 000 rows across 500 groups, with an index on `(grp, v DESC)`. Two ways to get the top
3 per group:

```console
top-3-per-group via LATERAL      : Nested Loop (actual time=57.197..69.733 rows=1500.00 loops=1) 69.943 ms
top-3-per-group via row_number() : WindowAgg (actual time=0.058..51.398 rows=1500.00 loops=1) 51.821 ms
  ^ CONFOUNDED: the LATERAL side also has to derive DISTINCT grp from the
    same 200k rows. Re-run it with a real 500-row dimension table:
  LATERAL off a real group table : Nested Loop (actual time=0.090..9.128 rows=1500.00 loops=1) 9.308 ms
```

Read as written, the first two lines say the window function wins — 51.8 ms against
69.9 ms. **That comparison is not measuring what it looks like.** The LATERAL query's
driving side was `(SELECT DISTINCT grp FROM j_lat)`, so it had to scan and aggregate all
200 000 rows *before* the 500 index probes could start. The window function was being
compared against "derive the groups, then probe".

Given a real 500-row group table to drive from — which is what you have in practice, since
groups are normally a customer, tenant, or category table — the same LATERAL runs in
**9.3 ms**: 5.6× faster than the window function, and 7.5× faster than the confounded
version of itself.

The mechanism is straightforward once separated: LATERAL does 500 index probes that each
stop after 3 rows, touching ~1500 rows. `row_number()` must sort and number **every one of
the 200 000 rows** before the outer `WHERE rn <= 3` discards 99 % of them. LATERAL wins
whenever N is small relative to group size and an index supports the per-group `ORDER BY`.
The window function wins when you need something the `LIMIT` cannot express — a rank over
the full partition, or ties resolved by `RANK`/`DENSE_RANK`.

## Other uses

**Reuse a computed expression** without repeating it — LATERAL as a `let` binding:

```sql
SELECT o.id, calc.margin, calc.margin * 0.2 AS tax
FROM j_orders o,
     LATERAL (SELECT o.total - o.cost AS margin) calc;
```

**Expand a row into rows**: `CROSS JOIN LATERAL unnest(o.tag_ids)`, or
`generate_series(1, o.quantity)` to fan an order line into one row per unit.

**Set-returning functions** are implicitly lateral — `FROM j_orders o, unnest(o.tags) t`
works without the keyword. Writing `CROSS JOIN LATERAL` anyway documents the dependency.

## From Node

```js
const {rows} = await pool.query(
  `SELECT c.id, c.name, recent.id AS order_id, recent.total
   FROM j_customers c
   LEFT JOIN LATERAL (
     SELECT o.id, o.total FROM j_orders o
     WHERE o.customer_id = c.id
     ORDER BY o.created_at DESC
     LIMIT $1
   ) recent ON true
   ORDER BY c.id, recent.total DESC`,
  [n],
);
```

One round trip instead of the N+1 this replaces. The `LIMIT` is parameterised — that is
allowed, unlike an identifier. Index `(customer_id, created_at DESC)` or the per-group
`ORDER BY` degrades into a sort per driving row, which is where a LATERAL query stops being
fast.

## Trade-off

LATERAL turns N+1 round trips into one statement and, with the right index, touches only
the rows it returns. The cost is a nested loop whose inner side runs once per driving row:
if the driving side is large, or the inner `ORDER BY` is unindexed, you are paying a sort
per row and a single-pass window function or a pre-aggregated join will beat it. The rule
of thumb from the measurement — small driving side, indexed per-group ordering, small N —
is also exactly when the plan stays a tight `Nested Loop`.

## Gotchas

**Symptom:** `ERROR: 42P01 invalid reference to FROM-clause entry for table "o"`
**Cause:** The subquery references a left-hand table without `LATERAL`
**Fix:** Add the keyword — or note that set-returning functions do not need it

**Symptom:** Driving rows with no children disappear
**Cause:** `CROSS JOIN LATERAL` acts as an inner join
**Fix:** `LEFT JOIN LATERAL (…) ON true` — three rows became five in the measurement

**Symptom:** `ERROR: 42601 syntax error at or near "ORDER"` on a `LEFT JOIN LATERAL`
**Cause:** The mandatory `ON` clause is missing
**Fix:** `ON true`

**Symptom:** LATERAL is far slower than expected
**Cause:** No index supporting the inner `ORDER BY … LIMIT`, so each iteration sorts; or
the driving side is itself an expensive derived query
**Fix:** Index `(group_col, sort_col DESC)`; drive from a real dimension table —
69.9 ms became 9.3 ms on that change alone

**Symptom:** A benchmark says the window function is faster
**Cause:** The LATERAL side is also computing the group list from the fact table
**Fix:** Measure both against the same driving input, and read the plan rather than the
wall clock — [EXPLAIN](../phase-10-indexes/03-explain.md)

## Interview questions

**★ What does `LATERAL` do?**
It permits a FROM-clause subquery to reference columns of the tables to its left, so the
subquery is evaluated once per driving row instead of once in total. That is what allows a
correlated subquery to return multiple columns and multiple rows.

**★ How do you get the 3 most recent orders per customer in one query?**
`LEFT JOIN LATERAL (SELECT … WHERE o.customer_id = c.id ORDER BY created_at DESC LIMIT 3)
ON true`, with an index on `(customer_id, created_at DESC)`.

**★ `LATERAL` or `row_number()` for top-N per group?**
LATERAL when N is small and an index supports the per-group ordering: 9.3 ms vs 51.8 ms
here, because it probes ~1500 rows while the window function numbers all 200 000. The
window function wins when you need a true rank over the whole partition or tie handling
that `LIMIT` cannot express.

**★ Why `ON true`?**
`LEFT JOIN` requires a join condition, but the correlation is already expressed inside the
subquery's `WHERE`. `ON true` satisfies the grammar and keeps every driving row.

**What is the difference between `CROSS JOIN LATERAL` and `LEFT JOIN LATERAL`?**
`CROSS` drops driving rows whose subquery returns nothing; `LEFT … ON true` keeps them with
NULLs. Measured: 3 rows versus 5 on the same fixture.

**Do set-returning functions need `LATERAL`?**
No — `FROM t, unnest(t.arr)` is implicitly lateral. Writing the keyword is documentation.

---

← [Self joins](09-self-join.md) · Next → [UNION INTERSECT EXCEPT](11-set-ops.md)
