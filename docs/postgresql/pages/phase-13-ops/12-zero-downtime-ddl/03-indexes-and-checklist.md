---
title: "12.3 · Indexes, renames, and the checklist"
sidebar_label: "03 · Indexes & the checklist"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [`CREATE INDEX`](https://www.postgresql.org/docs/18/sql-createindex.html),
> [`DROP INDEX`](https://www.postgresql.org/docs/18/sql-dropindex.html),
> [`ALTER TABLE`](https://www.postgresql.org/docs/18/sql-altertable.html).
> **Not sandbox-measured** — no console output on this page.

**Indexes are where "concurrently" stops being free**, and renames are where the
expand/contract discipline from [chunk 02](02-expand-and-contract.md) is
non-negotiable.

## Indexes

Always `CONCURRENTLY` on a live table:

```sql
CREATE INDEX CONCURRENTLY idx_orders_status ON orders (status);
```

The documentation is explicit that this builds "without taking any locks that
prevent concurrent inserts, updates, or deletes", whereas a plain `CREATE INDEX`
"locks out writes (but not reads) on the table until it's done".

Three restrictions that shape how you use it:

**It cannot run inside a transaction block.** So your migration tool must be told
not to wrap it — most have a flag for this, and forgetting it produces an
immediate error rather than a subtle problem.

**A failure leaves an invalid index behind.** Documented: on deadlock or a
uniqueness violation the command fails "but leave[s] behind an 'invalid' index",
which is ignored for querying "however it will still consume update overhead".
That last clause is the sting — you get an index that costs writes and serves no
reads. Find and fix them:

```sql
SELECT c.relname
  FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
 WHERE NOT i.indisvalid;
```

The documented recovery is to drop the index and retry, or `REINDEX INDEX
CONCURRENTLY`. **Checking for invalid indexes belongs in your post-migration
verification**, because nothing else will tell you.

**It is slower and takes more work** than a regular build — it scans the table
twice and must wait for existing transactions to finish. That is the trade for
staying online.

`DROP INDEX CONCURRENTLY` exists with matching restrictions: not inside a
transaction block, no `CASCADE`, only one index at a time, and not for indexes on
partitioned tables.

## Renaming and type changes

**Do not rename a column in one step.** The rename is instantaneous, but there is
no instant when old and new code agree on the name, so a rolling deploy breaks.
Expand/contract instead:

1. **Expand** — add the new column; add a trigger (or dual writes in code) so both
   stay in sync.
2. **Migrate** — backfill; deploy code reading the new column; verify nothing
   reads the old one.
3. **Contract** — drop the trigger and the old column.

The same applies to a type change that requires a rewrite, such as `int` →
`bigint`: add a new `bigint` column, keep both in sync, backfill in batches, swap
reads, then drop. Longer than `ALTER COLUMN TYPE`, and it never locks the table.

Type changes that are **binary coercible** — `varchar(50)` → `varchar(100)`,
`varchar` → `text` — need no rewrite and can be done directly.

## Dropping things safely

`DROP COLUMN` is catalog-only and fast, but it is a **contract** step and the
sequencing is what matters: deploy the code that stops referencing the column
*first*, confirm nothing does, then drop. Once dropped, old code errors
immediately.

A useful intermediate for nervous drops: rename the object to something obviously
dead (`status_deprecated_20260813`) and wait a release. If something breaks, the
rename is trivially reversible; a drop is not.

## A migration checklist

Before running anything against production:

- [ ] `lock_timeout` set, with retry on `55P03` ([chunk 01](01-the-lock-queue.md))
- [ ] No step scans or rewrites a large table while holding `ACCESS EXCLUSIVE`
- [ ] New constraints added `NOT VALID`, validated separately
- [ ] Indexes created `CONCURRENTLY`, outside a transaction block
- [ ] Backfills batched, with pauses, using `SKIP LOCKED`
- [ ] Every intermediate state works with **both** old and new application code
- [ ] Nothing is dropped in the same deploy that replaces it
- [ ] Post-migration: check for **invalid indexes** and unvalidated constraints
- [ ] A rollback plan that does not require restoring a backup

That last item is the one most often missing. "Roll back the deploy" is only a
plan if the schema change is compatible with the previous code — which is exactly
what expand/contract guarantees and a direct rename or drop does not.

## Trade-off

Expand/contract trades **speed and simplicity for availability**. A rename that
should be one line becomes three deploys spread over days, with dual writes and a
backfill in between — more code, more steps, more chances to leave something
half-finished (a stray `NOT VALID` constraint, an invalid index, a dual-write
trigger nobody removed).

That overhead is only worth paying when downtime is genuinely unacceptable. A
small internal tool with a nightly maintenance window should just take the lock
and do it in one statement — vastly simpler, and simplicity is worth real money
too. The mistake is applying either extreme universally: running blind DDL
against a live high-traffic table, or building a three-phase migration for a
table with four hundred rows.

The deciding question is not table size but **concurrency**: what else is
touching this table while you change it, and what happens to those queries if
they queue for thirty seconds.

## Gotchas

**Symptom:** `CREATE INDEX CONCURRENTLY` failed inside the migration tool
**Cause:** It cannot run in a transaction block, and most tools wrap migrations
in one.
**Fix:** Use the tool's no-transaction flag for that migration.

**Symptom:** An index exists but is never used and slows writes
**Cause:** A failed `CREATE INDEX CONCURRENTLY` left an **invalid** index —
ignored for queries, still maintained on every write.
**Fix:** Find it via `pg_index.indisvalid = false`, then drop and retry, or
`REINDEX INDEX CONCURRENTLY`. Add this check to post-migration verification.

**Symptom:** A rolling deploy broke after a column rename
**Cause:** Old and new code cannot agree on a name at the same instant.
**Fix:** Expand/contract — add, sync, backfill, switch reads, then drop.

**Symptom:** A backfill `UPDATE` bloated the table and slowed everything
**Cause:** One huge `UPDATE` creates a dead tuple per row faster than autovacuum
can reclaim, plus large WAL volume.
**Fix:** Batch with `LIMIT` and `SKIP LOCKED`, commit per batch, pause between
batches, and watch `n_dead_tup`.

**Symptom:** A constraint exists but is not enforced on old rows
**Cause:** It was added `NOT VALID` and never validated.
**Fix:** `VALIDATE CONSTRAINT` — it takes only `SHARE UPDATE EXCLUSIVE`. Audit
`pg_constraint` for `convalidated = false`.

**Symptom:** `int` → `bigint` locked a big table for minutes
**Cause:** Not binary coercible, so a full table and index rewrite.
**Fix:** New column, dual write, batched backfill, swap, drop.

**Symptom:** Rolling back a deploy failed because the schema had moved on
**Cause:** The migration was not backward compatible with the previous release.
**Fix:** That compatibility is the point of expand/contract. Never drop in the
same deploy that replaces.

## Interview questions

**★ What is expand/contract and why is it necessary?**
A three-phase migration — add the new thing additively, migrate data and code,
then remove the old thing in a later deploy. It is necessary because a schema
change and a code deploy are never simultaneous: during a rolling deploy both old
and new code run at once, so every intermediate state must work with both.

**★ How do you add a `NOT NULL` constraint to a large table without downtime?**
Add a `CHECK (col IS NOT NULL) NOT VALID` — which skips the verification scan —
then `VALIDATE CONSTRAINT`, which scans under `SHARE UPDATE EXCLUSIVE` and does
not block reads or writes. Since PostgreSQL 12, `SET NOT NULL` can then use that
validated check as proof and skip its own scan. The direct `SET NOT NULL` scans
the whole table under `ACCESS EXCLUSIVE`.

**★ What happens when `CREATE INDEX CONCURRENTLY` fails?**
It leaves an **invalid** index: ignored for querying because it may be
incomplete, but still maintained on every write — the worst of both. Find it via
`pg_index.indisvalid = false`, then drop and retry or `REINDEX INDEX
CONCURRENTLY`. It also cannot run inside a transaction block.

**★ How do you backfill a large table safely?**
In batches, each its own transaction, using `LIMIT` with `ORDER BY` on an indexed
column and `FOR UPDATE SKIP LOCKED` so it never blocks concurrent writers, with a
pause between batches so autovacuum can reclaim the dead tuples. One large
`UPDATE` bloats the table, generates huge WAL, and loses all its work if it
fails.

**How would you rename a column with zero downtime?**
Not with `RENAME`. Add the new column, keep both in sync via trigger or dual
writes, backfill in batches, deploy code that reads the new column, verify
nothing reads the old, then drop it — with the drop in a later deploy than the
switch.

**When is expand/contract not worth it?**
When downtime is acceptable and concurrency is low. A three-phase migration for a
small table on an internal tool with a maintenance window is pure overhead — take
the lock and do it in one statement. The deciding factor is what else is touching
the table concurrently, not how many rows it has.

---


---

← [Expand and contract](02-expand-and-contract.md) · Next → [Managed PostgreSQL](../13-managed-postgres/README.md)
