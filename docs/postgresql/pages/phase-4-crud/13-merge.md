---
title: "MERGE"
sidebar_label: "13 · MERGE"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex14-crud.mjs`.

**`MERGE` is the SQL-standard statement for synchronising one table from another —
insert, update and delete in a single pass. It is not a drop-in replacement for
`ON CONFLICT`, and for concurrent upsert it is the wrong tool.**

## One statement, three actions

```sql
MERGE INTO c_target t USING c_source s ON t.id = s.id
WHEN MATCHED AND s.v IS NULL THEN DELETE
WHEN MATCHED               THEN UPDATE SET v = s.v
WHEN NOT MATCHED           THEN INSERT (id, v) VALUES (s.id, s.v);
```

Target starts as `(1,'old'), (2,'keep')`; source is `(1,'new'), (3,'add'), (2,NULL)`.

```console
$ node ex14-crud.mjs
=== 8. MERGE ===
MERGE command: MERGE | rowCount: 3
┌─────────┬────┬───────┐
│ (index) │ id │ v     │
├─────────┼────┼───────┤
│ 0       │ 1  │ 'new' │
│ 1       │ 3  │ 'add' │
└─────────┴────┴───────┘
```

All three branches fired: id 1 updated, id 3 inserted, **id 2 deleted** because its
source value was NULL. `rowCount` is **3** — the total rows affected across all
branches, with no breakdown by action. If you need to know how many were inserted
versus updated, `MERGE` will not tell you.

`command` is `'MERGE'`, which matters if your code switches on `res.command`.

## The clauses

```sql
WHEN MATCHED [AND condition] THEN UPDATE SET … | DELETE | DO NOTHING
WHEN NOT MATCHED [AND condition] THEN INSERT … | DO NOTHING
```

Order matters: **the first matching branch wins**, so put the more specific
conditions first. Above, `WHEN MATCHED AND s.v IS NULL THEN DELETE` must precede the
bare `WHEN MATCHED`, or every matched row would be updated and nothing deleted.

The `USING` source can be a table, a subquery, or a `VALUES` list — which is how you
merge data sent from the application:

```sql
MERGE INTO stock t
USING (SELECT * FROM unnest($1::text[], $2::int[]) AS s(sku, qty)) s
   ON t.sku = s.sku
WHEN MATCHED THEN UPDATE SET qty = t.qty + s.qty
WHEN NOT MATCHED THEN INSERT (sku, qty) VALUES (s.sku, s.qty);
```

That combines `MERGE` with the array-parameter technique from
[`VALUES` and `unnest`](19-values-unnest.md) — one statement, one round trip, any
number of rows.

## Why it is not the upsert you want

**`MERGE` is not concurrency-safe the way `ON CONFLICT` is.** `ON CONFLICT` uses a
unique index as an arbiter: when two transactions race, the loser sees the conflict
and takes the `DO UPDATE` branch. `MERGE` evaluates its `ON` condition against the
snapshot it can see, so under concurrent inserts of the same key it can take the
`NOT MATCHED` branch in both transactions and then raise a **unique violation**
(`23505`) — or, without a unique constraint, silently insert a duplicate.

The rule:

| Situation | Use |
|---|---|
| Concurrent upsert from application requests | **`ON CONFLICT`** — index-arbitrated, safe |
| Batch synchronisation you control (ETL, nightly reconcile) | **`MERGE`** |
| Need `DELETE` as part of the same pass | **`MERGE`** — `ON CONFLICT` cannot delete |
| Need to know insert vs update per row | `ON CONFLICT … RETURNING (xmax = 0)` |

`MERGE` also has **no `RETURNING`** in PostgreSQL 18, which rules it out wherever you
need the affected rows back — a significant practical limitation compared with
`INSERT … ON CONFLICT … RETURNING`.

## When `MERGE` genuinely wins

- **Multi-action synchronisation.** Reconciling a local table against an upstream
  feed where absent rows must be deleted — `ON CONFLICT` cannot express the delete,
  so the alternative is three statements and a transaction.
- **Complex branch conditions.** `WHEN MATCHED AND t.version < s.version THEN UPDATE`
  reads better than an `ON CONFLICT … DO UPDATE … WHERE` clause once there is more
  than one rule.
- **Portability.** It is the SQL standard; Oracle, SQL Server and others have it.
  `ON CONFLICT` is PostgreSQL-specific.

## Availability and the source-duplicate rule

`MERGE` arrived in **PostgreSQL 15**; `RETURNING` support is not present in 18. On
14 and earlier, use `ON CONFLICT` or a CTE-based upsert.

One rule that produces a runtime error rather than wrong data: **the source must not
contain two rows matching the same target row.** PostgreSQL raises

```
21000 MERGE command cannot affect row a second time
```

Deduplicate the source first — a `DISTINCT ON (key)` over it
([`DISTINCT ON`](12-distinct-on.md)) is the usual fix. This is a genuine advantage
over a naive loop, which would silently apply both updates in an arbitrary order.

## Trade-off

`MERGE` collapses a synchronisation that would otherwise be three statements plus a
transaction into one readable pass, and it is the portable choice. It costs
concurrency safety for upsert, `RETURNING`, and per-action counts — three things you
usually want in a request path.

The practical division most codebases land on: **`ON CONFLICT` in application
request handlers, `MERGE` in batch jobs.** They are not competitors so much as tools
for different concurrency assumptions.

## Gotchas

**Symptom:** `23505 duplicate key` from a `MERGE` under load
**Cause:** `MERGE` is not index-arbitrated; two concurrent transactions can both take
the `NOT MATCHED` branch.
**Fix:** `INSERT … ON CONFLICT` for anything concurrent.

**Symptom:** `21000 MERGE command cannot affect row a second time`
**Cause:** Two source rows match the same target row.
**Fix:** Deduplicate the source, e.g. `DISTINCT ON (key) … ORDER BY key, updated_at
DESC`.

**Symptom:** Every matched row was updated; none were deleted
**Cause:** A bare `WHEN MATCHED` preceded the conditional one — first match wins.
**Fix:** Put the more specific branch first.

**Symptom:** `RETURNING` is rejected on a `MERGE`
**Cause:** Not supported in PostgreSQL 18.
**Fix:** `INSERT … ON CONFLICT … RETURNING`, or re-query.

**Symptom:** `rowCount` does not say how many rows were inserted
**Cause:** It is the total across all branches — measured, 3 for one update, one
insert and one delete.
**Fix:** Separate statements if the breakdown matters.

**Symptom:** `MERGE` is a syntax error
**Cause:** PostgreSQL 14 or earlier.
**Fix:** `ON CONFLICT`, or a CTE-based upsert.

**Symptom:** Rows are deleted unexpectedly
**Cause:** A `WHEN MATCHED … THEN DELETE` branch whose condition is broader than
intended.
**Fix:** Test the `ON` and branch conditions with a `SELECT` join first.

## Interview questions

**★ What does `MERGE` do that `ON CONFLICT` cannot?**
Multiple actions in one pass, including `DELETE`, with per-branch conditions.
Measured: one statement updated a row, inserted a row and deleted a row whose source
value was NULL. `ON CONFLICT` can only insert or update.

**★ Why is `ON CONFLICT` preferred for upsert?**
It uses a unique index as an arbiter, so concurrent transactions are resolved
correctly. `MERGE` evaluates its `ON` condition against its snapshot, so two
concurrent transactions can both take the `NOT MATCHED` branch and produce a `23505`
— or a duplicate if no unique constraint exists. It also supports `RETURNING`, which
`MERGE` does not in PostgreSQL 18.

**★ What does `rowCount` mean after a `MERGE`?**
Total rows affected across all branches, with no breakdown — measured, 3 for one
update, one insert and one delete. If you need the split, use separate statements.

**★ What is `21000 MERGE command cannot affect row a second time`?**
Two rows in the source match the same target row, so the statement would apply two
actions to it. Deduplicate the source first, typically with `DISTINCT ON (key)`
ordered so the row you want wins.

**★ How do the `WHEN` branches resolve?**
Top to bottom; the first matching branch fires. So conditional branches must precede
the unconditional one — a bare `WHEN MATCHED` first would swallow every matched row.

**When did `MERGE` become available?**
PostgreSQL 15. `RETURNING` support is still absent in 18. On 14 and earlier, use
`ON CONFLICT` or a CTE-based upsert.

---

← [`DISTINCT` and `DISTINCT ON`](12-distinct-on.md) · Next → [`TRUNCATE` vs `DELETE`](14-truncate.md)
