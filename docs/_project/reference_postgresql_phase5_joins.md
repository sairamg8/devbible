---
name: devbible-postgresql-phase5-joins
description: The measured dataset behind the 13 PostgreSQL Phase 5 join pages — the confounded LATERAL benchmark and its correction, EXISTS vs JOIN+DISTINCT, the NOT IN NULL trap, and the expression index that did nothing
metadata:
  type: reference
---

# PostgreSQL Phase 5 — joins and set operations (measured)

All from `sandbox/pg-api/ex35-joins.mjs` on **PG 18.4**, Node 24.19.0, `pg` 8.23.0.
Fixture: 4 customers / 4 orders / 4 order items, with **Dee having no orders** and
**order 13 having no items** — both deliberate, and both are what make the traps
reproduce. A NULL-FK order (14) is inserted mid-script for the `NOT IN` demo.

## The one that was confounded — LATERAL vs row_number()

The first run said the window function won. It did not.

```
top-3-per-group via LATERAL      : Nested Loop  69.943 ms
top-3-per-group via row_number() : WindowAgg    51.821 ms
  LATERAL off a real group table : Nested Loop   9.308 ms   ← corrected
```

200k rows, 500 groups, index on `(grp, v DESC)`. The LATERAL query's driving side was
`(SELECT DISTINCT grp FROM j_lat)`, so it had to **scan and aggregate all 200k rows before
the 500 index probes could start** — it was being charged for deriving the group list that
the window function never needed to produce.

Given a real 500-row dimension table to drive from — which is what you have in practice —
LATERAL is **9.3 ms, 5.6× faster** than the window function, and 7.5× faster than the
confounded version of itself. Mechanism: LATERAL probes ~1500 rows; `row_number()` sorts
and numbers all 200 000 before `WHERE rn <= 3` discards 99 %.

Caught by [[devbible-verify-your-own-measurements]] before it reached a page. The tell was
that the "slow" side contained work the "fast" side did not have to do.

## Semi and anti joins

```
EXISTS       : Parallel Hash Semi Join   91.330 ms
IN           : Parallel Hash Semi Join   73.367 ms
JOIN+DISTINCT: HashAggregate            189.980 ms
NOT EXISTS   : Parallel Hash Anti Join   70.651 ms
NOT IN       : Parallel Seq Scan on a    81.261 ms
```

- **`EXISTS` and `IN` produce the identical node.** The 91 vs 73 ms gap is run noise, not a
  syntax property. Choose by readability.
- **`JOIN` + `DISTINCT` costs ~2.5×** the semi join — it materialises every pair then hashes
  the duplicates away. This is what people write when duplicates surprise them.
- **`NOT IN` cannot get an anti-join node** — the planner would have to prove the column is
  NULL-free, so it falls back to a seq scan with a subplan.

**The `NOT IN` trap, measured:** after inserting one order with `customer_id = NULL`,
`NOT EXISTS` still returned `[{"name":"Dee"}]` and **`NOT IN` returned `[]`**. Silent, no
error. `x NOT IN (1,2,3,NULL)` expands to `… AND x <> NULL` → NULL for every x, and `WHERE`
keeps only true. The positive `IN` is a chain of ORs so a NULL branch is harmless — which
is exactly why the bug survives review by people who checked that `IN` works.

## The LEFT JOIN clause bug

```
filter in WHERE : [Ann/10, Bob/12]                          ← 2 rows
filter in ON    : [Ann/10, Bob/12, Cid/null, Dee/null]      ← 4 rows
count trap      : {"count_star":5,"count_col":4}
```

`WHERE o.status='paid'` on a LEFT JOIN dropped **two** customers, not one: Dee (no orders)
*and* Cid (order exists but is `cancelled`). `NULL = 'paid'` is NULL, and `WHERE` keeps only
true.

`count(*)` = 5 vs `count(o.id)` = 4 ungrouped; **grouped, Dee's group reports 1 instead of
0**, which is the version that ships.

## Fan-out

`sum(o.total)` across `j_orders JOIN j_order_items` = **450**, true total **350**. Order 10
has two items so its 100 was added twice. `sum(i.qty)` over the same join is *correct* —
only columns from the multiplied side are over-counted. Diagnostic that always works:
`count(*)` vs `count(DISTINCT parent.id)`.

## Expression index that changed nothing — then changed everything

```
join on lower(x.code)             : Parallel Hash Join  211.532 ms
same join + expression index      : Parallel Hash Join  212.556 ms   ← no change
50-row driving side, expr index   : Nested Loop           1.109 ms
same 50 rows, index dropped       : Hash Join            65.246 ms   ← 59×
```

200k × 200k. The index is useless when **every row of both tables is needed anyway** — a
sequential hash join is already optimal, and the plan node is identical before and after.
The same index is **59× faster** once the driving side is 50 rows and the planner can probe.
Indexes pay when the query is selective; that is a property of the query, not the index.

The second pair was added specifically because the first pair alone would have supported a
false conclusion ("expression indexes don't help joins").

## Set operations

```
UNION over 2 x 300k     : HashAggregate  491.299 ms   (first row at 334.613)
UNION ALL over the same : Append         142.442 ms   (first row at 0.010)
```

**3.5×**, and `UNION` is *blocking* — it consumes both branches before emitting a row, so it
cannot benefit from a `LIMIT`. Default to `UNION ALL`.

Errors: mismatched column counts → **`42601`**; `SELECT 1 UNION SELECT 'abc'` → **`22P02`**
(not a type-mismatch error — the untyped literal is resolved to `integer` then fails
casting). Column names come from the **first branch only**.

## Aliases and scoping

```
unqualified column in both tables  -> 42702 column reference "id" is ambiguous
alias used in WHERE                -> 42703 column "doubled" does not exist
alias used in ORDER BY             -> ok
alias used in GROUP BY             -> ok  (PostgreSQL extension)
old table name after aliasing      -> 42P01 invalid reference to FROM-clause entry
```

The dangerous case is the *unambiguous* one: a column present in only one table resolves
silently and can be re-bound by a later migration. A stored column always beats an output
alias, so `SELECT total*2 AS total … ORDER BY total` sorts by the stored column, silently.

## NATURAL JOIN, measured failing

Two tables sharing `id` **and** `created_at`. `USING (id)` → 2 rows. `NATURAL JOIN` → **1
row**, because it silently added `created_at` to the condition. Nothing in the query text
mentions that column. With no shared names at all it degenerates to a cross join.

Also visible in that output: **`pg` collapses duplicate column names** — six columns came
back, the JS object had four keys, and `created_at` silently held the *second* table's
value. Alias across joins or use `rowMode: 'array'`.

## Odds and ends

- **CROSS JOIN**: `FROM j_customers c, j_orders o` = 20 rows from 4 and 5, **no error**.
  The explicit `JOIN … ON` form makes the same omission a syntax error.
- **Calendar spine dates**: `2026-01-01` arrived as `2025-12-31T18:30:00.000Z` — the
  `date` → local-midnight conversion with `TZ=Asia/Calcutta`. `to_char` or
  `setTypeParser(1082, …)`.
- **Range join** on `p.valid @> s.sold_at` priced the March sale at 100 and the September
  sale at 120 for the same SKU. Guard with `EXCLUDE USING gist (sku WITH =, valid WITH &&)`
  or overlaps become a fan-out bug on just the affected keys.
- **FULL OUTER** filtered to `c.id IS NULL OR o.id IS NULL` returned exactly the two
  exceptions — Dee, and order 14 with no customer.
- **Recursive CTE** over the 4-row `j_emp` hierarchy produced depth + path correctly;
  `UNION ALL`, never `UNION`, and cycles need `CYCLE … SET … USING` (14+) or a path array.

## Script gotcha worth carrying

`ex35-joins.mjs` initially failed with `SyntaxError: Unexpected identifier 'has'` — two
lines ended `\`);   -- comment`, an SQL comment in JS code. Trivial, but it meant the
script had **never been run** despite being written and looking complete. Run every script
before writing a page from it; a written script is not a verified one.

Related: [[devbible-postgresql-rewrite-handoff]] · [[devbible-verify-your-own-measurements]] ·
[[devbible-never-compress-to-fit-cap]] · [[devbible-postgresql-phase10-indexes]]
