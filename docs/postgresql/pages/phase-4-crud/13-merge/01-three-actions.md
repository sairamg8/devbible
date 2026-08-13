---
title: "Three actions in one statement"
sidebar_label: "01 · Three actions"
sidebar_position: 1
---

# Three actions in one statement

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex14-crud.mjs`,
> `sandbox/pg-api/ex55-merge-returning.mjs`.

**One `MERGE` can insert, update and delete in a single pass over the target — and
the order of the `WHEN` branches decides which one a given row gets.**

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
branches, with no breakdown by action.

`command` is `'MERGE'`, which matters if your code switches on `res.command`. The
command tag carries no per-action split either:

```console
$ node ex55-merge-returning.mjs
=== 6. what the command tag says (no RETURNING) ===
command = MERGE  rowCount = 3  → the tag does NOT break down insert/update/delete
```

That breakdown *is* available, but only through `RETURNING` —
[chunk 02](02-returning-and-merge-action.md).

## The clauses

```sql
WHEN MATCHED [AND condition] THEN UPDATE SET … | DELETE | DO NOTHING
WHEN NOT MATCHED [AND condition] THEN INSERT … | DO NOTHING
```

Order matters: **the first matching branch wins**, so put the more specific
conditions first. Above, `WHEN MATCHED AND s.v IS NULL THEN DELETE` must precede the
bare `WHEN MATCHED`, or every matched row would be updated and nothing deleted.

## The `USING` source

The source can be a table, a subquery, or a `VALUES` list — which is how you merge
data sent from the application:

```sql
MERGE INTO stock t
USING (SELECT * FROM unnest($1::text[], $2::int[]) AS s(sku, qty)) s
   ON t.sku = s.sku
WHEN MATCHED THEN UPDATE SET qty = t.qty + s.qty
WHEN NOT MATCHED THEN INSERT (sku, qty) VALUES (s.sku, s.qty);
```

That combines `MERGE` with the array-parameter technique from
[`VALUES` and `unnest`](../19-values-unnest.md) — one statement, one round trip, any
number of rows.

## `WHEN NOT MATCHED BY SOURCE`

PostgreSQL 17 added the third side of a reconcile: rows in the **target** that the
source no longer has.

```console
$ node ex55-merge-returning.mjs
=== 7. WHEN NOT MATCHED BY SOURCE (PG17) ===
WHEN NOT MATCHED BY SOURCE THEN DELETE         → OK
┌─────────┬──────────┬────┐
│ (index) │ action   │ id │
├─────────┼──────────┼────┤
│ 0       │ 'UPDATE' │ 1  │
│ 1       │ 'UPDATE' │ 2  │
│ 2       │ 'DELETE' │ 3  │
└─────────┴──────────┴────┘
```

Id 3 was absent from the source, so it was deleted. Before 17 the same reconcile
needed a separate `DELETE … WHERE NOT EXISTS` in the same transaction.

## Trade-off

Collapsing three statements into one costs you the ability to reason about each in
isolation: a branch condition that is subtly too broad deletes rows you meant to
keep, and there is no intermediate state to inspect. Test the `ON` condition and each
branch predicate as a `SELECT` join before running the `MERGE`.

## Gotchas

**Symptom:** Every matched row was updated; none were deleted
**Cause:** A bare `WHEN MATCHED` preceded the conditional one — first match wins.
**Fix:** Put the more specific branch first.

**Symptom:** Rows are deleted unexpectedly
**Cause:** A `WHEN MATCHED … THEN DELETE` branch whose condition is broader than
intended.
**Fix:** Test the `ON` and branch conditions with a `SELECT` join first.

**Symptom:** `MERGE` is a syntax error
**Cause:** PostgreSQL 14 or earlier.
**Fix:** `ON CONFLICT`, or a CTE-based upsert.

**Symptom:** `WHEN NOT MATCHED BY SOURCE` is a syntax error
**Cause:** PostgreSQL 16 or earlier — it arrived in 17.
**Fix:** A separate `DELETE … WHERE NOT EXISTS` inside the same transaction.

## Interview questions

**★ What does `MERGE` do that `ON CONFLICT` cannot?**
Multiple actions in one pass, including `DELETE`, with per-branch conditions.
Measured: one statement updated a row, inserted a row and deleted a row whose source
value was NULL. `ON CONFLICT` can only insert or update.

**★ How do the `WHEN` branches resolve?**
Top to bottom; the first matching branch fires. So conditional branches must precede
the unconditional one — a bare `WHEN MATCHED` first would swallow every matched row.

**What can the `USING` source be?**
A table, a subquery, or a `VALUES` list. For application data the usual form is
`unnest($1::text[], $2::int[])`, which carries any number of rows through a fixed
number of parameters.

**What is `WHEN NOT MATCHED BY SOURCE` for?**
Rows present in the target but absent from the source — the delete half of a
reconcile. PostgreSQL 17 and later; before that it was a separate `DELETE`.

---

← [Overview](README.md) · Next → [`RETURNING` and `merge_action()`](02-returning-and-merge-action.md)
