---
title: "Views — naming a query, and their limits"
sidebar_label: "07 · Views"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex46-views-triggers.mjs`.

**A view is a stored query, not stored data.** It gives a name to something you
write repeatedly. It does not make anything faster, it cannot take an argument,
and the planner's willingness to push your `WHERE` clause into it decides whether
it is fast or catastrophic.

Measured against 300 000 orders across 5000 customers.

## It stores nothing, and costs nothing

```sql
CREATE VIEW v_open AS
SELECT id, customer, total, placed_at FROM v_orders WHERE status = 'open';
```

```console
$ node ex46-views-triggers.mjs
=== 1. a view is a named query, not stored data ===
direct       1.13 ms
via view     0.87 ms
  plan through the view:
    Aggregate (actual rows=1.00 loops=1)
    ->  Bitmap Heap Scan on v_orders (actual rows=20.00 loops=1)
    Filter: (status = 'open'::text)
    ->  Bitmap Index Scan on v_orders_customer_idx (actual rows=60.00 loops=1)
    Index Cond: (customer = 'cust-42'::text)
↑ the view was expanded into the query; the predicate reached the index
pg_relation_size(v_open) = 0 bytes ← a view stores nothing
```

Identical timings within noise, and an identical plan. `SELECT ... FROM v_open
WHERE customer = 'cust-42'` was **rewritten** into the underlying query with both
predicates, and the customer predicate reached the index.

**`pg_relation_size` is 0 bytes.** There is nothing on disk. That is the single
most useful fact about views and the one that explains all the rest: a view is
substituted into your query before planning, so the planner sees one combined
query and optimises it as a whole.

## When the predicate cannot be pushed down

This is where views become dangerous, and it is entirely about what sits between
your filter and the base table.

```sql
CREATE VIEW v_totals AS
SELECT customer, sum(total) AS lifetime FROM v_orders GROUP BY customer;
```

Filtering on the **`GROUP BY` key** — the planner pushes it down:

```console
GROUP BY view, filtering on the GROUP BY key:
  0.8 ms
    GroupAggregate (actual rows=1.00 loops=1)
    ->  Bitmap Heap Scan on v_orders (actual rows=60.00 loops=1)
    ->  Bitmap Index Scan on v_orders_customer_idx (actual rows=60.00 loops=1)
    Index Cond: (customer = 'cust-42'::text)
```

60 rows read. Filtering on the **aggregate result** — it cannot:

```console
same view, filtering on the aggregate result:
  135.8 ms
    HashAggregate (actual rows=0.00 loops=1)
    Filter: (sum(v_orders.total) > '100000'::numeric)
    Rows Removed by Filter: 5000
    ->  Seq Scan on v_orders (actual rows=300000.00 loops=1)
```

**0.8 ms against 135.8 ms — 170×.** The whole table was scanned and every
customer's total computed, because `sum(total) > 100000` cannot be evaluated
until the aggregate exists. This is not a view problem as such — the same is true
of the equivalent subquery — but the view *hides* it. The query reads like a
simple filtered lookup.

The predicates that stop pushdown are the ones that create an **optimisation
fence**: aggregates you then filter on, `DISTINCT`, window functions, `LIMIT`
inside the view, and set operations. If your view contains any of them, assume
the whole view is materialised before your filter runs, and check with `EXPLAIN`.

## A view cannot take a parameter

```console
=== 3. a view cannot take parameters ===
CREATE VIEW ... WHERE customer = $1            → 42P02 there is no parameter $1
  ↑ the workaround is a set-returning function, not a view
  a STABLE sql function does take a parameter → 60 rows
```

This is the limit people hit first. The answer is a function, not a view:

```sql
CREATE FUNCTION v_for_customer(c text)
RETURNS TABLE (id bigint, total numeric) AS $$
  SELECT id, total FROM v_orders WHERE customer = c
$$ LANGUAGE sql STABLE;
```

`LANGUAGE sql` and `STABLE` matter: a simple SQL function can be **inlined** into
the calling query, so the planner still sees one query and can use indexes. A
`plpgsql` function is a black box that runs to completion first. More in
[Set-returning functions](10-srf.md) and [PL/pgSQL](12-plpgsql.md).

Very often, though, the right answer is neither — just put the parameter in the
`WHERE` clause at the call site. A view filtered by the caller is simpler than a
function, and it is what the pushdown above is for.

## Writing through a view

```console
=== 4. updatable views, and when they stop being updatable ===
UPDATE through a simple view                   → OK
UPDATE through a GROUP BY view                 → 55000 cannot update view "v_totals"
INSERT a 'shipped' row through a WITH CHECK OPTION view → 44000 new row violates check option for view "v_open_checked"
INSERT an 'open' row through the same view     → OK
```

A view is **automatically updatable** when it is simple enough for PostgreSQL to
map a row back to exactly one base-table row: one table in the `FROM`, no
aggregate, no `DISTINCT`, no `GROUP BY`, no window function, no set operation.
Anything else raises `55000`, and needs an `INSTEAD OF` trigger to define what a
write means.

**`WITH CHECK OPTION` is the part worth adopting.** Without it, you can insert a
row through `v_open` that immediately vanishes from it — a `status = 'shipped'`
row inserted through a view defined as `WHERE status = 'open'`. The write
succeeds, the row exists, and it is invisible through the view that created it.
With the option, that becomes `44000` at insert time.

The same applies to updates that move a row out of the view. If you use a view as
a write boundary at all, add `WITH CHECK OPTION` — otherwise the boundary only
works in one direction.

## Views are hard dependencies

```console
=== 5. dependencies — dropping what a view needs ===
ALTER TABLE ... DROP COLUMN used by a view     → 2BP01 cannot drop column placed_at of table v_orders because other objects depend on it
DROP TABLE with a dependent view               → 2BP01 cannot drop table v_orders because other objects depend on it
```

You cannot drop a column a view selects, and you cannot drop the table.
`CASCADE` will drop the view along with it — silently, which is rarely what a
migration intends.

Two practical consequences:

- **A view makes a column harder to remove.** In a codebase with many views, a
  column cleanup becomes a multi-object migration.
- **`CREATE OR REPLACE VIEW` cannot change the column list** — you may add
  columns at the end, but not remove, rename or reorder them, and not change a
  type. Anything else needs `DROP VIEW` + `CREATE VIEW`, which fails if another
  view depends on *that* one. Nested views turn a small change into a cascade of
  drops and recreates.

## What views are actually good for

Given all of the above, the honest list is shorter than people expect:

- **Naming a predicate you repeat** — `active_users`, `open_orders`. The pushdown
  works, the plan is unchanged, and the definition lives in one place.
- **A stable interface over a changing schema.** Rename a column, keep the view's
  output the same, and consumers do not break.
- **A permission boundary.** Grant `SELECT` on a view exposing three of twenty
  columns instead of on the table. Note that a view runs with the **owner's**
  privileges by default — that is what makes this work, and also why
  `security_invoker = true` (PostgreSQL 15+) exists for when you want the
  caller's own privileges and RLS policies to apply instead.
- **Hiding a join you always write.** Same caveat as above about what happens to
  pushdown once the join has an aggregate above it.

What they are not for is performance. That is
[materialized views](11-matviews.md), which are a different thing with a
different cost.

## Trade-off

A view removes duplication and gives a query a name, and costs nothing at
runtime. What it costs is *indirection*: the SQL a developer reads is no longer
the SQL that runs, and a view over a view over a view is genuinely hard to reason
about — you cannot see the aggregate that turned your indexed lookup into a
sequential scan without expanding the definitions.

They also make schema change harder in exact proportion to how many you have.

Use them for names and boundaries, keep them one level deep, and check `EXPLAIN`
the first time you filter one — especially if the definition contains an
aggregate.

## Gotchas

**Symptom:** A query through a view is dramatically slower than expected
**Cause:** The filter is on an aggregate or sits above `DISTINCT`/a window
function, so it cannot be pushed into the view. Measured: 135.8 ms against 0.8 ms
on the same view, filtering on the aggregate rather than the `GROUP BY` key.
**Fix:** `EXPLAIN` it. Filter on a grouped column, or use a materialized view.

**Symptom:** `42P02 there is no parameter $1`
**Cause:** A view definition cannot contain parameters.
**Fix:** A `LANGUAGE sql STABLE` set-returning function, or filter at the call
site.

**Symptom:** `55000 cannot update view`
**Cause:** The view is not automatically updatable — it has an aggregate, a
`GROUP BY`, `DISTINCT`, a window function or more than one table.
**Fix:** An `INSTEAD OF` trigger, or write to the base table.

**Symptom:** A row inserted through a view is not visible through that view
**Cause:** The row does not satisfy the view's `WHERE`, and no `WITH CHECK
OPTION` was declared. Measured: the `shipped` insert succeeded without it and
raised `44000` with it.
**Fix:** `WITH CHECK OPTION`.

**Symptom:** `2BP01 cannot drop column ... because other objects depend on it`
**Cause:** A view selects it.
**Fix:** Drop and recreate the view around the migration. `CASCADE` drops the
view — check what it takes with it first.

**Symptom:** `CREATE OR REPLACE VIEW` fails on a column change
**Cause:** Replace can only append columns, not remove, rename, reorder or retype
them.
**Fix:** `DROP VIEW` and recreate — and handle any views depending on it.

**Symptom:** A view exposes rows a user's RLS policy should have hidden
**Cause:** Views run with the owner's privileges by default, bypassing the
caller's policies.
**Fix:** `CREATE VIEW ... WITH (security_invoker = true)` on PostgreSQL 15+.

## Interview questions

**★ What does a view actually store?**
Nothing — measured, `pg_relation_size` is 0 bytes. It is a stored *query* that is
substituted into yours before planning, so the planner optimises the combined
query. That is why filtering through a simple view produced an identical plan and
timing to writing the query out.

**★ When is a view slow?**
When your filter cannot be pushed through it. Filtering on a `GROUP BY` key
pushed down and read 60 rows in 0.8 ms; filtering on the aggregate result forced
a full scan of 300 000 rows and computation of all 5000 totals — 135.8 ms, 170×
slower. Aggregates, `DISTINCT`, window functions and `LIMIT` inside a view all
act as fences.

**★ Can a view take a parameter?**
No — `42P02`. Use a `LANGUAGE sql STABLE` set-returning function, which can be
inlined so the planner still sees one query, or simply filter at the call site.

**★ When can you write through a view?**
When PostgreSQL can map a view row back to exactly one base row: a single table,
no aggregate, no `GROUP BY`, no `DISTINCT`, no window function, no set operation.
Otherwise `55000`, and you need an `INSTEAD OF` trigger. Add `WITH CHECK OPTION`
so a write cannot insert a row that the view itself would not show — measured,
without it the mismatched insert succeeded silently.

**Why does a view make schema migrations harder?**
It is a hard dependency: `2BP01` when you drop a column it selects or the table
itself, and `CREATE OR REPLACE VIEW` can only append columns — any rename,
removal, reorder or type change needs a drop and recreate, which cascades through
any views built on it.

**How does a view interact with row-level security?**
By default it runs with the view owner's privileges, so the caller's RLS policies
do not apply — which is what makes a view useful as a permission boundary and
dangerous if you assumed otherwise. `security_invoker = true` (PG 15+) switches
to the caller's privileges.

---

← [pg_trgm similarity](06-pg-trgm.md) · Next → [Triggers](08-triggers.md)
