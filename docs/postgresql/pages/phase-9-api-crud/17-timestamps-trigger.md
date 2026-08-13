---
title: "created_at and updated_at — trigger or application code"
sidebar_label: "17 · created_at / updated_at"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex41-shaping-mapping.mjs`.

**An `updated_at` maintained by application code is correct only for writes that go
through that code.** Every migration, every `psql` fix-up and every other service
leaves it stale — and a stale timestamp is worse than none, because everything
downstream believes it.

## `created_at` needs no trigger

```sql
created_at timestamptz NOT NULL DEFAULT now()
```

A `DEFAULT` covers every insert path, including `COPY` and manual `INSERT`s, and it
cannot be overwritten by a later `UPDATE` because nothing assigns it. There is no
version of this problem that needs a trigger. The only decision is `timestamptz`
rather than `timestamp` — see
[Phase 2 · timestamptz](../phase-2-types/04-timestamptz.md).

`updated_at` is where the two approaches diverge, because it has to change on
*every* write.

## The measurement

Two identical tables. One has a `BEFORE UPDATE` trigger; the other relies on the
application to set the column. Both get an `UPDATE` that does not mention
`updated_at` — a migration, a support fix, another service:

```console
$ node ex41-shaping-mapping.mjs
=== 4. trigger vs application code for updated_at ===
trigger table, UPDATE that never mentions updated_at:
  changed? true
app-managed table, the same UPDATE:
  changed? false ← the stamp is now a lie
```

The trigger table's `updated_at` moved. The application-managed one did not: the
row changed and its timestamp says it did not.

Everything built on that column is now wrong — incremental sync jobs skip the row,
cache invalidation misses it, "recently modified" lists omit it, and an audit trail
shows the wrong time. The failure is silent and permanent, because nothing ever
recomputes it.

## The trigger

```sql
CREATE OR REPLACE FUNCTION s_touch() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER s_trig_touch BEFORE UPDATE ON s_trig
FOR EACH ROW EXECUTE FUNCTION s_touch();
```

`BEFORE UPDATE`, not `AFTER` — a `BEFORE` trigger can modify `NEW` and have it
written as part of the same row version. An `AFTER` trigger would need a second
`UPDATE`, which would fire the trigger again.

One function serves every table; each table needs its own `CREATE TRIGGER`.

### What it costs

```console
cost of the trigger, 20 000 single-row UPDATEs:
  BEFORE UPDATE trigger     328.9 ms
  SET updated_at = now()    266.8 ms
  trigger overhead: 1.23x
```

**About 23% on the update itself** — measured again at 1.29× on a second run, so
call it 20–30%. That is the cost of a `plpgsql` call per row.

Worth being honest about the shape of that number: it is 23% of the *update*, and
an update in a real request is a fraction of total request time. For bulk rewrites
of millions of rows the overhead is real and worth measuring against your own data.
For request-serving traffic it is not the deciding factor — correctness is.

## `now()` is the transaction timestamp

```console
=== 5. now() is the transaction timestamp, not the statement timestamp ===
now()            same across the transaction? true
clock_timestamp() same? false (moved 303 ms)
```

`now()` is fixed at the start of the transaction, so **every row written in one
transaction gets an identical `updated_at`**, no matter how far apart the
statements ran.

That is usually exactly what you want: rows changed by one logical operation share
a timestamp, and the ordering of `updated_at` values matches the ordering of
transactions rather than of statements. It is also what makes `updated_at`
unsuitable as an optimistic-concurrency version — two updates in one transaction
share a value, so a conflict goes undetected
([Optimistic concurrency](13-optimistic.md)).

If you genuinely need per-statement time, `clock_timestamp()` is the wall clock and
moved 303 ms within the transaction above. It is the wrong default: it makes rows
from one transaction sort against each other by an ordering that has no meaning to
anyone.

`now()`, `CURRENT_TIMESTAMP` and `transaction_timestamp()` are all the same thing.
`statement_timestamp()` sits between the two.

## Reading it back

A trigger sets the value *server-side*, so the application does not know it until
it asks. Use `RETURNING`:

```sql
UPDATE k_profiles SET city = $2 WHERE id = $1
RETURNING id, city, updated_at
```

Without it the API responds with whatever `updated_at` it read before the write —
which is the previous value, and a client using it as an `If-Match`/version token
will fail its next request.

## The cases a trigger does not cover

- **`INSERT`.** The trigger above is `BEFORE UPDATE` only, so `updated_at` on
  insert comes from `DEFAULT now()`. Set both defaults, or add `BEFORE INSERT` to
  the trigger.
- **A client legitimately supplying `updated_at`** — a data import preserving
  original timestamps. The trigger overwrites it unconditionally. Guard it:
  `IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN NEW.updated_at = now(); END IF;`
- **No-op updates.** `SET city = city` still fires the trigger and moves the
  timestamp, so a redundant `PATCH` looks like a modification. Combined with
  `AND col IS DISTINCT FROM $n` from
  [Partial updates](08-update-partial.md), the write is skipped entirely and the
  problem disappears.
- **`TRUNCATE`** fires no row-level trigger at all.

## Trade-off

The trigger is invisible. Someone reading the application code cannot tell the
column is maintained, and someone debugging "why did this row's timestamp change"
has to know to look in the schema. That is a genuine cost, and it is the honest
argument for doing it in application code: the behaviour is where the developer is
looking.

But it only holds while the application is the sole writer, and that is almost
never true for the lifetime of a table. Migrations write directly, support runs
`UPDATE`s in `psql`, another service is granted access, a bulk import lands. The
application-code version is correct exactly until the first of those, and then it
is quietly wrong forever.

**The trigger usually wins**, because it is a property of the data rather than of
one client of it. Pay the 23% and document the trigger where developers will see
it — in the migration and in the model.

## Gotchas

**Symptom:** `updated_at` is stale for rows changed by a migration
**Cause:** The column is set in application code, which the migration did not go
through. Measured: the app-managed table's timestamp did not move.
**Fix:** A `BEFORE UPDATE` trigger, so it is a property of the table.

**Symptom:** All rows written by one request share an `updated_at` to the microsecond
**Cause:** `now()` is the transaction timestamp, constant across the transaction.
**Fix:** Nothing — this is correct. Use `clock_timestamp()` only if per-statement
time is genuinely needed.

**Symptom:** `updated_at` as an optimistic-locking version misses conflicts
**Cause:** Two updates in one transaction share the same `now()`.
**Fix:** An integer version column.

**Symptom:** The API returns the old `updated_at` after a successful update
**Cause:** The trigger set it server-side and the response used a previously read
value.
**Fix:** `RETURNING updated_at`.

**Symptom:** `updated_at` is null on insert
**Cause:** The trigger is `BEFORE UPDATE` only.
**Fix:** `DEFAULT now()` on the column as well.

**Symptom:** A data import loses its original timestamps
**Cause:** The trigger overwrites `NEW.updated_at` unconditionally.
**Fix:** Only set it when the caller did not.

**Symptom:** Redundant `PATCH`es make rows look recently modified
**Cause:** A no-op `UPDATE` still fires the trigger.
**Fix:** Skip no-op writes with `AND col IS DISTINCT FROM $n`.

## Interview questions

**★ Why does `updated_at` usually belong in a trigger rather than application
code?**
Because the application is not the only writer. Measured: an `UPDATE` that never
mentions `updated_at` — a migration or a `psql` fix — moved the trigger table's
timestamp and left the application-managed one unchanged. A stale timestamp is
worse than none, because sync jobs and cache invalidation trust it.

**★ What does the trigger cost?**
Measured at 1.23–1.29× on the update itself for 20 000 single-row updates — 328.9 ms
against 266.8 ms. That is 20–30% of the update, which is a fraction of a request,
so it rarely decides anything for request traffic. It matters for bulk rewrites.

**★ Why `BEFORE UPDATE` rather than `AFTER`?**
A `BEFORE` trigger can assign `NEW.updated_at` and have it written as part of the
same row version. An `AFTER` trigger would need a second `UPDATE`, which would fire
the trigger again.

**★ Why do all rows in one transaction get the same `updated_at`?**
`now()` is the transaction timestamp, fixed when the transaction starts —
measured, identical across a transaction while `clock_timestamp()` moved 303 ms.
That is usually desirable, and it is why `updated_at` cannot serve as an optimistic
concurrency version.

**How does the application learn the value the trigger wrote?**
`RETURNING updated_at`. The trigger runs server-side, so without it the response
carries the value read before the write.

**Does a trigger cover inserts too?**
Not a `BEFORE UPDATE` one. Give the column `DEFAULT now()` as well, or add
`BEFORE INSERT` to the trigger.

---

← [Testing against a real PostgreSQL](16-testing-real-pg.md) · Next → [snake_case to camelCase](18-snake-camel.md)
