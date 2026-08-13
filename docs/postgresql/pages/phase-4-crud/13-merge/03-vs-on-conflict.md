---
title: "Against ON CONFLICT"
sidebar_label: "03 · vs ON CONFLICT"
sidebar_position: 3
---

# Against `ON CONFLICT`

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex14-crud.mjs`,
> `sandbox/pg-api/ex55-merge-returning.mjs`.

**One difference decides between these two statements, and it is not `RETURNING`. It
is that `ON CONFLICT` is arbitrated by a unique index and `MERGE` is not.**

## Why `MERGE` is not the upsert you want

`ON CONFLICT` uses a unique index as an arbiter: when two transactions race, the
loser sees the conflict and takes the `DO UPDATE` branch. `MERGE` evaluates its `ON`
condition against the snapshot it can see, so under concurrent inserts of the same
key it can take the `NOT MATCHED` branch in **both** transactions and then raise a
unique violation (`23505`) — or, without a unique constraint, silently insert a
duplicate.

That is a property of how the statement is specified, not a bug to be tuned around.
No isolation level below `SERIALIZABLE` changes it.

## The rule

| Situation | Use |
|---|---|
| Concurrent upsert from application requests | **`ON CONFLICT`** — index-arbitrated, safe |
| Batch synchronisation you control (ETL, nightly reconcile) | **`MERGE`** |
| Need `DELETE` as part of the same pass | **`MERGE`** — `ON CONFLICT` cannot delete |
| Need to know insert vs update per row | Either — `ON CONFLICT … RETURNING (xmax = 0)` or `MERGE … RETURNING merge_action()` |

Note what is **not** on that list: `RETURNING`. Both statements have it
([chunk 02](02-returning-and-merge-action.md)), so it is not a reason to choose
between them. The real dividing line is concurrency safety, and the second is whether
you need `DELETE`.

## When `MERGE` genuinely wins

- **Multi-action synchronisation.** Reconciling a local table against an upstream
  feed where absent rows must be deleted — `ON CONFLICT` cannot express the delete,
  so the alternative is three statements and a transaction.
- **Complex branch conditions.** `WHEN MATCHED AND t.version < s.version THEN UPDATE`
  reads better than an `ON CONFLICT … DO UPDATE … WHERE` clause once there is more
  than one rule.
- **Portability.** It is the SQL standard; Oracle, SQL Server and others have it.
  `ON CONFLICT` is PostgreSQL-specific.

## Availability

`MERGE` arrived in **PostgreSQL 15**. **17** added `RETURNING`, `merge_action()` and
`WHEN NOT MATCHED BY SOURCE`; **18** added the `old.` / `new.` aliases in
`RETURNING`. On 14 and earlier, use `ON CONFLICT` or a CTE-based upsert.

If you are reading advice that `MERGE` has no `RETURNING`, it predates 17 — a lot of
it is still in circulation, and this very topic repeated it until it was measured.

## The source-duplicate rule

One rule produces a runtime error rather than wrong data: **the source must not
contain two rows matching the same target row.** PostgreSQL raises

```
21000 MERGE command cannot affect row a second time
```

Deduplicate the source first — a `DISTINCT ON (key)` over it
([`DISTINCT ON`](../12-distinct-on.md)) is the usual fix. This is a genuine advantage
over a naive loop, which would silently apply both updates in an arbitrary order.

## Trade-off

`MERGE` collapses a synchronisation that would otherwise be three statements plus a
transaction into one readable pass, and it is the portable choice. What it costs is
**concurrency safety for upsert** — and on a modern server that is the *whole* cost.
`RETURNING` and per-action counts used to belong on this list; PostgreSQL 17 removed
both objections.

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

**Symptom:** Duplicates appear with no error at all
**Cause:** `MERGE` under concurrency with **no** unique constraint on the key — there
is nothing to raise `23505`, so both `NOT MATCHED` branches simply insert.
**Fix:** Add the unique constraint, and use `ON CONFLICT` in the request path.

**Symptom:** Someone "fixed" the race by raising the isolation level
**Cause:** `REPEATABLE READ` does not make `MERGE` index-arbitrated; it converts the
race into a serialization failure at best.
**Fix:** `ON CONFLICT`, or accept `40001` retries under `SERIALIZABLE`.

## Interview questions

**★ Why is `ON CONFLICT` preferred for upsert?**
It uses a unique index as an arbiter, so concurrent transactions are resolved
correctly. `MERGE` evaluates its `ON` condition against its snapshot, so two
concurrent transactions can both take the `NOT MATCHED` branch and produce a `23505`
— or a duplicate if no unique constraint exists. **Concurrency is the only reason;**
`RETURNING` is not, since `MERGE` has had it since PostgreSQL 17.

**★ What is `21000 MERGE command cannot affect row a second time`?**
Two rows in the source match the same target row, so the statement would apply two
actions to it. Deduplicate the source first, typically with `DISTINCT ON (key)`
ordered so the row you want wins.

**When did `MERGE` become available, and what has been added since?**
PostgreSQL **15** introduced it. **17** added `RETURNING`, `merge_action()` and
`WHEN NOT MATCHED BY SOURCE`; **18** added the `old.` / `new.` aliases inside
`RETURNING`. On 14 and earlier, use `ON CONFLICT` or a CTE-based upsert.

**Where would you still reach for `MERGE` over `ON CONFLICT`?**
Batch reconciles you control the concurrency of, especially when rows must also be
deleted, when the branch conditions are more complex than a single `DO UPDATE …
WHERE`, or when the SQL has to run on more than one engine.

---

← [`RETURNING` and `merge_action()`](02-returning-and-merge-action.md) · Next → [`TRUNCATE` vs `DELETE`](../14-truncate.md)
