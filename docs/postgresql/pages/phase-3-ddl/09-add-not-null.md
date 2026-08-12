---
title: "Adding a NOT NULL column to a large table"
sidebar_label: "09 · Adding NOT NULL safely"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0, on a **200 000-row** table. Script:
> `sandbox/pg-api/ex11-ddl-alter.mjs`.

**The safe sequence exists because the obvious statement holds `ACCESS EXCLUSIVE`
while it scans or rewrites the whole table. The trick is not making the work
smaller — it is doing the long part under a weaker lock.**

## Two different problems

They get confused because both involve `NOT NULL`:

1. **Adding a *new* `NOT NULL` column** — cheap since PostgreSQL 11, as long as the
   default is constant.
2. **Making an *existing* column `NOT NULL`** — needs a full verification scan.

### Adding a new column is already fast

```console
$ node ex11-ddl-alter.mjs
ADD COLUMN flag bool NOT NULL DEFAULT false    no rewrite       4 ms
ADD COLUMN u uuid DEFAULT gen_random_uuid()    REWRITE        902 ms
```

A constant default is stored once in the catalog and applied on read — 4 ms at
200 000 rows. The old advice to add the column nullable, backfill, then set the
default is obsolete for this case.

**The exception is a volatile default.** `gen_random_uuid()` needs a distinct value
per row, so the table is rewritten — 902 ms, linear in row count. For those, the
old three-step dance is still required:

```sql
ALTER TABLE t ADD COLUMN u uuid;                         -- instant
-- backfill in batches, each its own transaction
UPDATE t SET u = gen_random_uuid() WHERE u IS NULL AND id BETWEEN $1 AND $2;
ALTER TABLE t ALTER COLUMN u SET DEFAULT gen_random_uuid();
-- then the NOT NULL, via the sequence below
```

### Making an existing column `NOT NULL` is the real problem

```console
=== 2. adding NOT NULL to an existing column: naive vs NOT VALID ===
direct SET NOT NULL                     36 ms (full scan, ACCESS EXCLUSIVE throughout)
ADD CHECK ... NOT VALID                 3 ms (brief lock)
VALIDATE CONSTRAINT                     25 ms (SHARE UPDATE EXCLUSIVE — reads+writes continue)
```

**Read the lock modes, not the milliseconds.** At 200 000 rows the direct form is
only 36 ms, so the timings alone do not make the case. What matters is that those
36 ms are spent holding `ACCESS EXCLUSIVE` — blocking every read and write — and
that the duration is linear in table size. At 20 million rows that is seconds to
minutes of a fully locked table, and everything that arrives meanwhile queues behind
it ([DDL locks and the blocking they cause](../phase-8-schema-from-node/01-ddl-from-node/02-locks-and-blocking.md)).

The two-step version spends 3 ms under the strong lock and does the 25 ms scan under
`SHARE UPDATE EXCLUSIVE`, which **permits concurrent reads and writes**. The work is
the same; the blocking is not.

## The full safe sequence

```sql
-- 1. add the column, nullable, no default (instant)
ALTER TABLE t ADD COLUMN email text;

-- 2. make new rows correct
ALTER TABLE t ALTER COLUMN email SET DEFAULT '';

-- 3. backfill existing rows in batches, each committing separately
UPDATE t SET email = '' WHERE email IS NULL AND id BETWEEN $1 AND $2;

-- 4. declare the invariant without scanning (brief ACCESS EXCLUSIVE)
ALTER TABLE t ADD CONSTRAINT t_email_nn CHECK (email IS NOT NULL) NOT VALID;

-- 5. verify it under a weak lock — reads and writes continue
ALTER TABLE t VALIDATE CONSTRAINT t_email_nn;

-- 6. optional: convert to a real NOT NULL, now that the CHECK proves it
ALTER TABLE t ALTER COLUMN email SET NOT NULL;
ALTER TABLE t DROP CONSTRAINT t_email_nn;
```

Steps 4 and 5 are the whole technique. `NOT VALID` means "enforce this for new and
changed rows, but do not verify the existing ones" — so the constraint is live
immediately and the expensive verification is deferred to a statement that does not
block traffic.

**Batch the backfill.** One `UPDATE` over 20 million rows is a single long
transaction: it holds row locks, generates enormous WAL, and holds back `VACUUM`'s
cleanup horizon for the whole database. Batches of a few thousand, each committing,
are interruptible and let `VACUUM` keep up.

Step 6 is optional and worth understanding. From PostgreSQL 12 onward,
`SET NOT NULL` can use an existing validated `CHECK (col IS NOT NULL)` as proof and
skip its own scan. A real `NOT NULL` is cheaper for the planner than a `CHECK`, so
converting is usually worth it — but confirm the fast path on your version rather
than assuming, because getting it wrong reintroduces the full scan you just avoided.

## Bound the lock wait regardless

Every step that takes `ACCESS EXCLUSIVE` should be prepared to fail rather than
queue:

```sql
BEGIN;
SET LOCAL lock_timeout = '3s';
ALTER TABLE t ADD CONSTRAINT t_email_nn CHECK (email IS NOT NULL) NOT VALID;
COMMIT;
```

`55P03` and a retry is a good outcome; an unbounded wait behind a long-running query
is how a two-second migration becomes an outage.

## Trade-off

The safe sequence is six statements and a batched backfill instead of one line. It
is more code, more migration files, and more moving parts, and on a small table it
buys nothing measurable — 36 ms is 36 ms.

The threshold is roughly "can this table afford to be completely unavailable for as
long as a full scan takes?" Below a few hundred thousand rows the direct statement is
honest and simpler. Above that, the sequence is the difference between a deploy and
an incident — and the point at which you need it is not the point at which you will
have time to learn it.

## Gotchas

**Symptom:** `SET NOT NULL` locked a large table for minutes
**Cause:** It scans every row to verify, holding `ACCESS EXCLUSIVE` throughout.
**Fix:** `ADD CONSTRAINT … CHECK (col IS NOT NULL) NOT VALID`, then
`VALIDATE CONSTRAINT` under `SHARE UPDATE EXCLUSIVE`.

**Symptom:** `23514 check constraint is violated by some row` on `VALIDATE`
**Cause:** The backfill missed rows, or new NULLs arrived between backfill and
validate.
**Fix:** Re-run the backfill; the `NOT VALID` constraint already prevents *new*
NULLs, so only pre-existing rows can fail.

**Symptom:** `ADD COLUMN … DEFAULT` rewrote the table anyway
**Cause:** A volatile default such as `gen_random_uuid()` — measured 902 ms vs 4 ms.
**Fix:** Add nullable, backfill in batches, then set the default.

**Symptom:** The backfill `UPDATE` caused replication lag and bloat
**Cause:** One enormous transaction: WAL volume plus a held-back `VACUUM` horizon.
**Fix:** Batch it, committing each batch.

**Symptom:** The migration hung and then everything timed out
**Cause:** The `ALTER` queued for `ACCESS EXCLUSIVE`, and all later queries queued
behind it.
**Fix:** `SET LOCAL lock_timeout`, then retry.

**Symptom:** Someone re-ran the old three-step dance for a constant default
**Cause:** Advice predating PostgreSQL 11.
**Fix:** A constant default is 4 ms — just add the column.

## Interview questions

**★ Why is adding a `NOT NULL` column with a default fast now, and when is it not?**
Since PostgreSQL 11 a *constant* default is stored in the catalog and applied on
read, so no rows are touched — measured 4 ms at 200k rows. A *volatile* default such
as `gen_random_uuid()` needs a distinct value per row and rewrites the table —
measured 902 ms.

**★ How do you make an existing column `NOT NULL` without a long lock?**
`ADD CONSTRAINT … CHECK (col IS NOT NULL) NOT VALID` — brief `ACCESS EXCLUSIVE`,
3 ms measured — then `VALIDATE CONSTRAINT`, which does the scan under
`SHARE UPDATE EXCLUSIVE` and allows concurrent reads and writes. Optionally convert
to a real `NOT NULL` afterwards, which can use the validated `CHECK` as proof.

**★ The direct form only took 36 ms. Why bother?**
Because the number is linear in table size and, more importantly, those milliseconds
are spent under `ACCESS EXCLUSIVE`. At 20 million rows it is minutes of a fully
blocked table, with every arriving query queued behind it. The two-step version does
the same work under a lock that permits reads and writes.

**★ What does `NOT VALID` actually mean?**
The constraint is enforced for new and modified rows immediately, but existing rows
are not checked. That makes declaring it nearly free, and defers the expensive
verification to `VALIDATE CONSTRAINT`, which takes a weaker lock.

**★ Why batch the backfill instead of one `UPDATE`?**
One statement over millions of rows is a single long transaction: it generates huge
WAL volume, holds row locks, and holds back `VACUUM`'s cleanup horizon for the whole
database. Batches commit as they go, are interruptible, and let `VACUUM` keep pace.

**What can still fail at `VALIDATE CONSTRAINT` time?**
Only pre-existing rows that violate it, since the `NOT VALID` constraint already
blocks new violations. A `23514` there means the backfill was incomplete — re-run it
and validate again.

---

← [Unique constraints vs unique indexes](08-unique-nulls.md) · Next → [Schemas as namespaces](10-schemas-tenancy.md)
