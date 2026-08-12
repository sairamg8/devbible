---
title: "ALTER TABLE"
sidebar_label: "05 · ALTER TABLE"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0, on a **200 000-row** table. Script:
> `sandbox/pg-api/ex11-ddl-alter.mjs`.

**Every `ALTER TABLE` takes an `ACCESS EXCLUSIVE` lock. The only question that
matters is how long it holds it — a catalog-only change is milliseconds, a table
rewrite is proportional to the row count, and both block every reader and writer for
the duration.**

## Measured: which operations rewrite the table

`relfilenode` is the identifier of the table's physical file. If it changes, the
whole table was rewritten.

```console
$ node ex11-ddl-alter.mjs
=== 1. rewrite or not? (200000 rows) ===
ADD COLUMN note text                           no rewrite       4 ms
ADD COLUMN flag bool NOT NULL DEFAULT false    no rewrite       4 ms
ADD COLUMN d timestamptz DEFAULT now()         no rewrite       4 ms
ADD COLUMN u uuid DEFAULT gen_random_uuid()    REWRITE        902 ms
DROP COLUMN vc                                 no rewrite       3 ms
RENAME COLUMN email TO mail                    no rewrite       3 ms
ALTER COLUMN vc TYPE varchar(100)              no rewrite       3 ms
ALTER COLUMN vc TYPE varchar(20)               REWRITE        433 ms
ALTER COLUMN vc TYPE text                      no rewrite       3 ms
ALTER COLUMN n TYPE bigint                     REWRITE        431 ms
ALTER COLUMN amount TYPE numeric(14,2)         no rewrite       4 ms
ALTER COLUMN n SET NOT NULL                    no rewrite       3 ms
ALTER COLUMN amount SET DEFAULT 1              no rewrite       3 ms
ADD CONSTRAINT chk CHECK (n > 0)               no rewrite      25 ms
ADD CONSTRAINT chk CHECK (n>0) NOT VALID       no rewrite       3 ms
SET LOGGED/UNLOGGED                            REWRITE        230 ms
```

**3–4 ms against 431–902 ms at 200 000 rows.** The rewrites scale linearly, so at
20 million rows they are minutes — of total unavailability for that table.

## The rules behind the table

**Adding a column is free — unless the default is volatile.** Since PostgreSQL 11 a
constant default is stored once in the catalog and applied on read, so
`ADD COLUMN … NOT NULL DEFAULT false` is O(1). But `gen_random_uuid()` produces a
*different value per row*, so PostgreSQL must materialise every one: **902 ms and a
full rewrite**. `now()` is the interesting middle case — it is stable within a
statement, so it did *not* rewrite.

This is the exception that catches people who learned "adding a column with a
default is instant in modern PostgreSQL". It is instant for constants only.

**Type changes rewrite when the on-disk representation changes.**

| Change | Rewrite? | Why |
|---|---|---|
| `varchar(50)` → `varchar(100)` | no | Widening a length limit is a constraint change only |
| `varchar(50)` → `varchar(20)` | **yes** | Every value must be re-checked and re-stored |
| `varchar` → `text` | no | Identical representation |
| `int` → `bigint` | **yes** | 4 bytes to 8 bytes on disk |
| `numeric(12,2)` → `numeric(14,2)` | no | `numeric` is variable-length already |

The direction matters: widening is usually free, narrowing is not.

**`DROP COLUMN` is a catalog operation.** 3 ms, no rewrite — the column is marked
dropped and the data stays on disk, invisible. Space is reclaimed only by a later
`VACUUM FULL` or table rewrite. Dropping a column does not shrink the database.

**`SET UNLOGGED` / `SET LOGGED` rewrites** (230 ms), because WAL participation is a
property of the physical file.

## The lock is the real cost

Even a 3 ms `ALTER` can take a table down, because `ACCESS EXCLUSIVE` conflicts with
everything and PostgreSQL grants locks in request order. Measured in
[DDL locks and the blocking they cause](../phase-8-schema-from-node/01-ddl-from-node/02-locks-and-blocking.md):
a **12 ms `ALTER` blocked two plain `SELECT`s for 2.4 seconds** because it queued
behind a long-running read, and everything that arrived after it queued behind it.

So the discipline is the same regardless of rewrite:

```sql
BEGIN;
SET LOCAL lock_timeout = '3s';
ALTER TABLE alt_t ADD COLUMN note text;
COMMIT;
```

Failing with `55P03` and retrying is far better than an unbounded queue.

## Doing the dangerous changes safely

**A type change that rewrites** — add, backfill, swap:

```sql
-- 1. new column, instant
ALTER TABLE alt_t ADD COLUMN n_big bigint;
-- 2. backfill in batches, each its own transaction (not one long lock)
UPDATE alt_t SET n_big = n WHERE id BETWEEN $1 AND $2 AND n_big IS NULL;
-- 3. keep it current while you backfill (trigger), then swap in a short transaction
BEGIN;
SET LOCAL lock_timeout = '3s';
ALTER TABLE alt_t DROP COLUMN n;
ALTER TABLE alt_t RENAME COLUMN n_big TO n;
COMMIT;
```

More steps, but every lock is brief. The alternative is one `ALTER COLUMN … TYPE`
holding `ACCESS EXCLUSIVE` for the whole rewrite.

**Adding a constraint** — `ADD CONSTRAINT … CHECK` scanned the table (25 ms) while
holding the strong lock. `NOT VALID` skips the scan (3 ms), and `VALIDATE
CONSTRAINT` afterwards takes only `SHARE UPDATE EXCLUSIVE`, which permits reads
*and* writes. See [Adding a `NOT NULL` column safely](09-add-not-null.md) for the
full sequence.

**Adding an index** — never plain `CREATE INDEX` on a live table; use
`CONCURRENTLY`, accepting that it cannot run inside a transaction
([Transactional DDL](07-transactional-ddl.md)).

## Several changes in one statement

```sql
ALTER TABLE alt_t
  ADD COLUMN note text,
  ALTER COLUMN amount SET DEFAULT 1,
  ADD CONSTRAINT chk CHECK (n > 0) NOT VALID;
```

One statement means one lock acquisition and at most one rewrite pass rather than
one per change. If several sub-commands would each rewrite, PostgreSQL still does a
single rewrite covering all of them — which is a genuine reason to batch related
changes into one statement rather than one migration per line.

## Trade-off

`ALTER TABLE` is how a schema evolves, and PostgreSQL makes most changes cheap
enough to do casually. That is the trap: the cheap ones and the catastrophic ones
have identical syntax, and nothing in the statement tells you which you wrote. The
same three words are 3 ms on one column and a ten-minute outage on another.

The rule that follows: **know the rewrite table, or check `relfilenode` on a copy
before running it in production.** For anything on a large table, prefer the
add-backfill-swap sequence — it is more work and it is interruptible, which the
single statement is not.

## Gotchas

**Symptom:** `ADD COLUMN … DEFAULT` took minutes on a large table
**Cause:** A volatile default such as `gen_random_uuid()` — each row needs a distinct
value, so the table is rewritten. Measured 902 ms vs 4 ms at 200k rows.
**Fix:** Add the column nullable, backfill in batches, then set the default and
`NOT NULL`.

**Symptom:** A "small" type change locked the table for minutes
**Cause:** The on-disk representation changed — `int`→`bigint` or narrowing a
`varchar`. Measured ~430 ms at 200k rows, linear in row count.
**Fix:** Add-backfill-swap, with a trigger keeping the new column current.

**Symptom:** The database did not shrink after `DROP COLUMN`
**Cause:** It is a catalog operation; the data stays on disk marked invisible.
**Fix:** `VACUUM FULL` or `pg_repack` if the space actually matters — both rewrite.

**Symptom:** A 3 ms `ALTER` caused a multi-second outage
**Cause:** It queued for `ACCESS EXCLUSIVE` behind a long read, and every later
query queued behind it.
**Fix:** `SET LOCAL lock_timeout`; kill long-running reads before migrating.

**Symptom:** `55P03 canceling statement due to lock timeout`
**Cause:** `lock_timeout` working as intended.
**Fix:** Retry — transactional DDL means nothing was left behind.

**Symptom:** `ADD CONSTRAINT` held the lock much longer than expected
**Cause:** It scans the whole table to validate while holding `ACCESS EXCLUSIVE`.
**Fix:** `NOT VALID`, then `VALIDATE CONSTRAINT` under the weaker lock.

**Symptom:** A migration with five `ALTER TABLE` statements rewrote the table five
times
**Cause:** Separate statements each get their own pass.
**Fix:** One `ALTER TABLE` with comma-separated sub-commands.

## Interview questions

**★ Which `ALTER TABLE` operations rewrite the table?**
Type changes where the on-disk representation changes (`int`→`bigint`, narrowing a
`varchar`), `ADD COLUMN` with a *volatile* default, and `SET LOGGED`/`UNLOGGED`.
Measured at 200k rows: rewrites ~430–900 ms, catalog-only changes 3–4 ms. Adding a
column with a constant default, dropping a column, renaming, widening a `varchar`,
`varchar`→`text` and `SET NOT NULL` do not rewrite.

**★ "Adding a column with a default is instant in modern PostgreSQL" — is that true?**
Only for constant defaults, which are stored in the catalog and applied on read.
A volatile default such as `gen_random_uuid()` needs a distinct value per row, so it
rewrites — measured 902 ms against 4 ms. `now()` is stable within a statement and
did not rewrite.

**★ Why can a 3 ms `ALTER TABLE` cause an outage?**
It needs `ACCESS EXCLUSIVE`, which conflicts with every other lock. If anything is
holding the table, the `ALTER` queues — and because locks are granted in request
order, every query arriving afterwards queues behind it. Measured elsewhere: a 12 ms
`ALTER` blocked plain `SELECT`s for 2.4 s.

**★ How do you change a column's type on a large table without a long lock?**
Add a new column (instant), backfill in batches with separate transactions, keep it
current with a trigger, then swap in one short transaction: drop the old column,
rename the new one. Every lock is brief and the backfill is interruptible.

**★ Does `DROP COLUMN` free disk space?**
No. It marks the column dropped in the catalog — 3 ms, no rewrite — and the data
remains on disk, invisible. Space is reclaimed only by something that rewrites the
table, such as `VACUUM FULL`.

**Why batch sub-commands into one `ALTER TABLE`?**
One lock acquisition instead of several, and at most one rewrite pass covering all
the changes rather than one per statement.

---

← [`NOT NULL`, `DEFAULT`, `UNIQUE`, `CHECK`](04-constraints.md) · Next → [Modeling relationships](06-relationships.md)
