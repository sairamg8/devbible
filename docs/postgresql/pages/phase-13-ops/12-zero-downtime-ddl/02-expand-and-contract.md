---
title: "12.2 · Expand and contract"
sidebar_label: "02 · Expand & contract"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [`ALTER TABLE`](https://www.postgresql.org/docs/18/sql-altertable.html),
> [`CREATE INDEX`](https://www.postgresql.org/docs/18/sql-createindex.html),
> [`DROP INDEX`](https://www.postgresql.org/docs/18/sql-dropindex.html).
> **Not sandbox-measured** — no console output on this page.

**A schema change and a code deploy cannot happen at the same instant.** There is
always a window where old code is running against a new schema, or new code
against an old one — during a rolling deploy, both at once. Expand/contract is
the discipline that makes every intermediate state valid.

## The three phases

| Phase | What happens | Old code | New code |
|---|---|---|---|
| **Expand** | add the new thing, additively | works | works |
| **Migrate** | backfill data; deploy code that writes both, reads new | works | works |
| **Contract** | remove the old thing, once nothing uses it | *gone* | works |

The rule that generates all of it: **every deploy must be compatible with the
schema before and after it, and every migration must be compatible with the code
before and after it.** Nothing is ever removed in the same step that adds its
replacement.

The cost is real — a one-line change becomes three deploys — and it is the price
of not scheduling downtime.

## Adding a NOT NULL column

The unsafe version, which scans and holds `ACCESS EXCLUSIVE` for the duration:

```sql
ALTER TABLE orders ADD COLUMN status text NOT NULL DEFAULT 'pending';  -- risky at scale
```

Actually, since PostgreSQL 11 that *specific* statement is fast — a constant
default is stored in metadata ([chunk 01](01-the-lock-queue.md)). The dangerous
version is adding `NOT NULL` to a column that **already exists**, because
`SET NOT NULL` requires a full scan while holding `ACCESS EXCLUSIVE`.

The safe sequence uses a `CHECK` constraint as a stepping stone:

```sql
-- 1. add the column, nullable, constant default → catalog only
ALTER TABLE orders ADD COLUMN status text DEFAULT 'pending';

-- 2. backfill in batches (see below) so old rows get values

-- 3. add the constraint WITHOUT scanning
ALTER TABLE orders ADD CONSTRAINT orders_status_nn
  CHECK (status IS NOT NULL) NOT VALID;

-- 4. validate it — SHARE UPDATE EXCLUSIVE, does not block reads or writes
ALTER TABLE orders VALIDATE CONSTRAINT orders_status_nn;

-- 5. now SET NOT NULL is cheap: the validated CHECK proves it
ALTER TABLE orders ALTER COLUMN status SET NOT NULL;
ALTER TABLE orders DROP CONSTRAINT orders_status_nn;
```

Why this works: `NOT VALID` tells PostgreSQL to skip the verification scan —
documented as "this potentially-lengthy scan is skipped" — while still enforcing
the constraint on *new* rows. `VALIDATE CONSTRAINT` then does the scan under
`SHARE UPDATE EXCLUSIVE`, which does not block reads or writes. Since PostgreSQL
12, `SET NOT NULL` can use a validated `CHECK (col IS NOT NULL)` as proof and skip
its own scan.

The measured statement-level version of this is
[Phase 3 · Adding NOT NULL safely](../../phase-3-ddl/09-add-not-null.md).

## The same trick for every constraint

`NOT VALID` → `VALIDATE` is the general pattern, not a `NOT NULL` special case:

```sql
ALTER TABLE orders
  ADD CONSTRAINT orders_customer_fk FOREIGN KEY (customer_id)
      REFERENCES customers(id) NOT VALID;

ALTER TABLE orders VALIDATE CONSTRAINT orders_customer_fk;
```

Between the two statements the constraint is enforced for new and modified rows
but existing rows are unverified — which is exactly the tradeoff you want, and
also why you should not leave it in that state indefinitely. `NOT VALID`
constraints are visible in `pg_constraint` where `convalidated = false`; check for
strays after a migration.

## Backfilling in batches

Never `UPDATE` a large table in one statement. It takes a long-lived lock on every
row it touches, generates enormous WAL, bloats the table with dead tuples, and if
it fails at 90% you have done all that work for nothing.

```sql
-- repeat until zero rows are updated
WITH batch AS (
  SELECT id FROM orders
   WHERE status IS NULL
   ORDER BY id
   LIMIT 5000
   FOR UPDATE SKIP LOCKED
)
UPDATE orders o
   SET status = 'pending'
  FROM batch b
 WHERE o.id = b.id;
```

Each batch is its own transaction. Points worth noting:

- **`SKIP LOCKED`** means concurrent workers or application writes never make the
  backfill block. Phase 12's outbox pages use the same primitive.
- **Pause between batches** — a few hundred milliseconds — so autovacuum can keep
  up with the dead tuples the update creates. A backfill that outruns vacuum
  bloats the table badly.
- **`ORDER BY id`** with a `LIMIT` keeps each batch's work bounded and indexable.
- Watch `n_dead_tup` in
  [09 · Monitoring](../09-monitoring/05-database-health.md) while it
  runs; that is the number that tells you the pause is long enough.

## Trade-off

Expand/contract trades **speed and simplicity for availability**. A rename that
should be one line becomes three deploys spread over days, with dual writes and a
backfill in between — more code, more steps, more chances to leave something
half-finished.

That overhead is only worth paying when downtime is genuinely unacceptable. A
small internal tool with a nightly maintenance window should just take the lock
and do it in one statement. The deciding question is not table size but
**concurrency**: what else is touching this table while you change it, and what
happens to those queries if they queue for thirty seconds.

## Gotchas

**Symptom:** A rolling deploy broke after a schema change
**Cause:** The migration was not compatible with both the old and the new
application code, which run simultaneously during the deploy.
**Fix:** Expand/contract — never remove in the same step that adds a
replacement.

**Symptom:** Adding a column with a default was fast in staging, slow in prod
**Cause:** A **volatile** default (or identity/generated/constrained domain)
forces a rewrite; a constant default does not — fast since PG 11.
**Fix:** Add with a constant default or none, and backfill separately.

**Symptom:** A backfill `UPDATE` bloated the table and slowed everything
**Cause:** One huge `UPDATE` creates a dead tuple per row faster than autovacuum
can reclaim, plus large WAL volume.
**Fix:** Batch with `LIMIT` and `SKIP LOCKED`, commit per batch, pause between
batches, and watch `n_dead_tup`.

**Symptom:** A constraint exists but is not enforced on old rows
**Cause:** It was added `NOT VALID` and never validated.
**Fix:** `VALIDATE CONSTRAINT` — it takes only `SHARE UPDATE EXCLUSIVE`. Audit
`pg_constraint` for `convalidated = false`.

**Symptom:** `SET NOT NULL` locked a large table for minutes
**Cause:** It scans the whole table under `ACCESS EXCLUSIVE`.
**Fix:** `CHECK (col IS NOT NULL) NOT VALID` → `VALIDATE CONSTRAINT` →
`SET NOT NULL`, which PG 12+ satisfies from the validated check.

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

**★ How do you backfill a large table safely?**
In batches, each its own transaction, using `LIMIT` with `ORDER BY` on an indexed
column and `FOR UPDATE SKIP LOCKED` so it never blocks concurrent writers, with a
pause between batches so autovacuum can reclaim the dead tuples. One large
`UPDATE` bloats the table, generates huge WAL, and loses all its work if it
fails.

**Why is `NOT VALID` → `VALIDATE` the general pattern rather than a `NOT NULL`
trick?**
Because it applies to any table constraint. `NOT VALID` adds the constraint
instantly — the documentation says the "potentially-lengthy scan is skipped" —
and it is enforced on new and modified rows immediately. `VALIDATE CONSTRAINT`
then checks the existing rows under a lock that does not block reads or writes.

**When is expand/contract not worth it?**
When downtime is acceptable and concurrency is low. A three-phase migration for a
small table on an internal tool with a maintenance window is pure overhead — take
the lock and do it in one statement.

---

← [The lock queue](01-the-lock-queue.md) · Next → [Indexes and the checklist](03-indexes-and-checklist.md)
