---
title: "INSERT ... ON CONFLICT"
sidebar_label: "06 · ON CONFLICT"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex14-crud.mjs`,
> `ex8-bulk-and-seed.mjs`.

**Upsert in one statement, resolved by the database. It is the only correct way to
write "insert if absent" — the check-then-insert alternative has a race that
produces duplicates with no error at all.**

## The two forms

```sql
INSERT INTO c_items (sku, name, qty, price) VALUES ($1, $2, 1, '1.00')
ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name
RETURNING id, sku, name, (xmax = 0) AS was_insert;
```

```console
$ node ex14-crud.mjs
=== 4. INSERT ... ON CONFLICT ===
new row   → { id: '6', sku: 'c9', name: 'Fresh', was_insert: true }
conflict  → { id: '6', sku: 'c9', name: 'Updated', was_insert: false }
  ↑ xmax = 0 distinguishes an insert from an update
DO NOTHING on conflict → rowCount: 0 (RETURNING gives nothing)
conflict target with no unique index → 42P10 there is no unique or exclusion constraint matching the ON CONFLICT specification
```

- **`DO UPDATE`** writes the row either way, and `RETURNING` gives it to you.
- **`DO NOTHING`** skips the conflicting row — and **returns no row at all**:
  `rowCount: 0`, empty `RETURNING`. Code expecting the existing row back gets
  nothing, which is the most common surprise here.

### `xmax = 0` tells you which happened

`RETURNING (xmax = 0) AS was_insert` — measured `true` for the insert and `false`
for the update. `xmax` is a system column holding the transaction that deleted or
locked the row version; it is 0 for a freshly inserted tuple.

This is the standard trick for "did I create or update?", which the statement
otherwise cannot tell you. It relies on an implementation detail, so treat it as a
useful convention rather than a guarantee — if the distinction is load-bearing, a
`created_at = updated_at` comparison or an explicit `RETURNING` of both timestamps
is more honest.

### Getting the row back from `DO NOTHING`

Since `DO NOTHING` returns nothing, the usual workaround when you need the row:

```sql
-- writes nothing on conflict, but always returns the row
INSERT INTO c_items (sku, name) VALUES ($1, $2)
ON CONFLICT (sku) DO UPDATE SET sku = EXCLUDED.sku   -- no-op update
RETURNING id, sku, name;
```

That performs a write (a new row version, plus index churn and `VACUUM` work) purely
to get a `RETURNING`. On a hot path prefer the two-step: `INSERT … DO NOTHING`, then
a `SELECT` if `rowCount` was 0.

## The conflict target needs a unique index

```console
conflict target with no unique index → 42P10 there is no unique or exclusion constraint matching the ON CONFLICT specification
```

`ON CONFLICT (col)` requires a **unique index or constraint** on exactly those
columns. That is not a limitation — it is the mechanism. The database can only
detect a conflict it has an index to detect, which is the same reason application
pre-checks cannot work.

Targets can be:

```sql
ON CONFLICT (sku)                            -- a unique constraint or index
ON CONFLICT (user_id, tag_id)                -- a composite unique key
ON CONFLICT (email) WHERE deleted_at IS NULL -- matches a PARTIAL unique index
ON CONFLICT ON CONSTRAINT users_email_key    -- by name
ON CONFLICT                                  -- any conflict; only valid with DO NOTHING
```

The partial form matters for soft delete: with the partial unique index from
[delete hard vs soft](../phase-9-api-crud/09-delete-soft-hard.md), the `WHERE` clause
in `ON CONFLICT` must match the index's predicate or PostgreSQL will not use it.

**A deferrable unique constraint cannot be an arbiter** — upsert needs an immediate
check ([Deferrable constraints](../phase-3-ddl/18-deferrable.md)).

## `EXCLUDED`, and referring to the existing row

`EXCLUDED` is the row that *would* have been inserted. The bare table name is the
row already there:

```sql
INSERT INTO stock (sku, qty) VALUES ($1, $2)
ON CONFLICT (sku) DO UPDATE
  SET qty = stock.qty + EXCLUDED.qty,          -- accumulate, not overwrite
      updated_at = now()
WHERE stock.qty <> stock.qty + EXCLUDED.qty;   -- skip no-op writes
```

Three things worth taking:

- **`stock.qty + EXCLUDED.qty`** accumulates. Plain `SET qty = EXCLUDED.qty`
  overwrites, which is a different operation and frequently the wrong one for
  counters.
- **The `WHERE` on `DO UPDATE`** suppresses writes that would change nothing —
  avoiding dead tuples and unnecessary trigger fires on a high-traffic upsert.
- Qualify with the table name; unqualified `qty` in the `SET` target is the column,
  but in the expression it is ambiguous enough to be worth always qualifying.

## Identity values are consumed regardless

```console
$ node ex8-bulk-and-seed.mjs
run 1 rowCount: 2 | run 2: 0 | run 3: 0
sequence last_value after 3 runs: 6 ← identity is consumed even when ON CONFLICT skips the row
```

Two rows, three runs, sequence at **6**. `ON CONFLICT` evaluates the row — drawing
its identity value — before detecting the conflict, so the number is burned even
when nothing is inserted. Harmless (sequences are not gapless) but surprising, and a
reason not to run an upsert in a tight loop against an `int` identity column.

## Why not check first

```console
=== C. create-then-seed at boot, 20 workers ===
ok: 20 | failed: 0
rows in boot_seed after "idempotent" startup: 20
```

Twenty workers each did "check, then insert". All twenty checked, all twenty saw
nothing, all twenty inserted — **20 duplicates and zero errors**. There is no
application-side fix; only the unique index sees all the attempts.

## `ON CONFLICT` and `MERGE`

`MERGE` (Phase 4's [MERGE](13-merge.md)) is the SQL-standard multi-action form and
can also `DELETE`. But `ON CONFLICT` is the one with the concurrency guarantee:
`MERGE` can still raise a unique violation under concurrent inserts, because it does
not use the index as an arbiter the same way. **For concurrent upsert, use
`ON CONFLICT`**; use `MERGE` for set-based synchronisation where you control
concurrency.

## Trade-off

`ON CONFLICT` gives atomic, concurrency-safe upsert in one round trip. It costs a
unique index on the conflict target — a schema commitment — and it silently turns
what might have been an error into a write, which can hide bugs: an upsert on a key
you did not intend to be a natural key will happily overwrite unrelated rows.

`DO NOTHING` additionally costs you the returned row, which pushes you either into a
no-op update (a real write) or a second query. Neither is free; pick knowingly.

## Gotchas

**Symptom:** `RETURNING` gives nothing on an upsert
**Cause:** `DO NOTHING` returns no row when it skips — measured, `rowCount: 0`.
**Fix:** A no-op `DO UPDATE SET col = EXCLUDED.col`, or a follow-up `SELECT`.

**Symptom:** `42P10 there is no unique or exclusion constraint matching the ON
CONFLICT specification`
**Cause:** No unique index on the target columns, or a partial index whose predicate
the statement does not repeat.
**Fix:** Create the index; for partial indexes, add the matching `WHERE` to
`ON CONFLICT`.

**Symptom:** A counter is overwritten instead of incremented
**Cause:** `SET qty = EXCLUDED.qty` replaces.
**Fix:** `SET qty = tablename.qty + EXCLUDED.qty`.

**Symptom:** Ids skip several values per upsert run
**Cause:** The identity value is drawn before the conflict is detected — measured,
sequence at 6 after inserting 2 rows three times.
**Fix:** Expected; sequences are not gapless.

**Symptom:** Duplicate rows despite a "check if exists" guard
**Cause:** The check and the insert are not atomic — measured, 20 workers produced
20 duplicates with no errors.
**Fix:** A unique index plus `ON CONFLICT`.

**Symptom:** An upsert on a hot row causes table bloat
**Cause:** Every `DO UPDATE` writes a new row version even when nothing changed.
**Fix:** `WHERE` on the `DO UPDATE` to skip no-op writes.

**Symptom:** `ON CONFLICT` fails on a deferrable constraint
**Cause:** Upsert needs an immediate arbiter.
**Fix:** A separate immediate unique index, or do not defer that constraint.

## Interview questions

**★ How do you write an upsert, and why not check first?**
`INSERT … ON CONFLICT (key) DO UPDATE SET … EXCLUDED.…`. Checking first has a race
between the `SELECT` and the `INSERT` — measured with 20 concurrent workers: 20
duplicate rows and zero errors. Only the unique index sees every attempt, which is
why the conflict target must be indexed.

**★ What is `EXCLUDED`?**
The row that would have been inserted. Inside `DO UPDATE` you reference the existing
row by table name and the incoming one as `EXCLUDED` — so
`SET qty = stock.qty + EXCLUDED.qty` accumulates while `SET qty = EXCLUDED.qty`
overwrites.

**★ How do you tell whether a row was inserted or updated?**
`RETURNING (xmax = 0) AS was_insert` — measured `true` then `false`. `xmax` is 0 for
a freshly inserted tuple. It relies on an implementation detail, so if the
distinction matters, compare `created_at` and `updated_at` instead.

**★ Why does `DO NOTHING` return no rows?**
Because nothing was written, and `RETURNING` reports written rows. Measured
`rowCount: 0`. To get the existing row you either do a no-op `DO UPDATE` (a real
write, with bloat) or a second `SELECT`.

**★ `ON CONFLICT` or `MERGE`?**
`ON CONFLICT` for concurrent upsert — it uses the unique index as an arbiter and is
safe under concurrency. `MERGE` for set-based synchronisation with multiple actions
including `DELETE`, where you control concurrency; it can still raise unique
violations under concurrent inserts.

**Why does the conflict target need a unique index?**
Because that index *is* the conflict-detection mechanism. Without it the database
has no way to know a row conflicts — `42P10`. This is the same reason application
pre-checks cannot be made correct.

---

← [`RETURNING`](05-returning.md) · Next → [`UPDATE`](07-update.md)
