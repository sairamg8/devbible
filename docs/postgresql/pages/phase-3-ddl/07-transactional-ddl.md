---
title: "DDL is transactional in PostgreSQL"
sidebar_label: "07 · Transactional DDL"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex1-ddl-from-node.mjs`,
> `ex10-migrations.mjs`.

**`CREATE`, `ALTER` and `DROP` participate in transactions like any other
statement. Roll back and the schema change never happened.** Most engines commit DDL
implicitly; PostgreSQL does not, and that single property changes how you write
migrations and how you experiment.

## The property

```sql
BEGIN;
CREATE TABLE tx_demo_a (id int);
CREATE TABLE tx_demo_b (id int);
CREATE TABLE tx_demo_a (id int);   -- fails: already exists
ROLLBACK;
```

```console
$ node ex1-ddl-from-node.mjs
=== 3. transactional DDL — rollback after a good CREATE ===
failed on: 42P07 relation "tx_demo_a" already exists
tables surviving the rollback: (none)
```

`tx_demo_b` was created successfully and still vanished. There is no half-applied
state to detect and nothing to clean up by hand.

## What it is worth in practice

**Migrations become atomic.** From the runner in
[Migrations](../phase-8-schema-from-node/02-migrations.md):

```console
=== 2. a failing migration ===
threw: 42701 column "nickname" of relation "mg_users" already exists
mg_users columns after the failure: id, email
recorded in schema_migrations: 0
```

Nothing applied **and** nothing recorded — the two facts stay consistent because
they are in the same transaction. Without that, a migration can be applied but
unrecorded (re-runs and fails) or recorded but unapplied (silently skipped forever).

This is also what makes **forward-only migrations** practical. You do not need a
tested reversal for the *failure* case, because failure leaves nothing behind — only
for the much rarer "shipped it and regretted it" case.

**Experiments become safe.** On a clone, this is the closest thing to a dry run:

```sql
BEGIN;
DROP TABLE orders CASCADE;   -- what does this actually take with it?
-- inspect
ROLLBACK;
```

Useful for `DROP … CASCADE`, whose blast radius is otherwise only visible after the
fact ([`DROP`, `CASCADE`, `RESTRICT`](13-drop-cascade.md)).

**Mixed DDL and DML in one unit.** A migration can add a column, backfill it, and
add a constraint, with the whole thing succeeding or failing together:

```sql
BEGIN;
ALTER TABLE orders ADD COLUMN total_cents bigint;
UPDATE orders SET total_cents = round(total * 100);
ALTER TABLE orders ALTER COLUMN total_cents SET NOT NULL;
COMMIT;
```

On an engine with implicit DDL commits this sequence has no safe ordering.

## What it does not give you

**It is not a lock-free change.** The transaction holds `ACCESS EXCLUSIVE` from the
moment of the `ALTER` until commit — so a long transaction holds it *longer*, and
everything queues behind it. Measured in
[DDL locks and the blocking they cause](../phase-8-schema-from-node/01-ddl-from-node/02-locks-and-blocking.md):
a 12 ms `ALTER` blocked plain `SELECT`s for 2.4 s.

Wrapping ten migrations in one transaction is therefore a trade: atomicity for the
whole batch, against holding the first statement's lock until the last one finishes.

**It does not undo everything.** Sequences are deliberately non-transactional — a
rolled-back insert still consumes its id ([Sequences](14-sequences.md), measured as
ids 1 and 4). Files on disk, `NOTIFY` messages delivered at commit, and anything
outside the database are likewise unaffected.

**Long transactions hold back `VACUUM`.** An open transaction pins the cleanup
horizon for the whole database, so a migration that backfills millions of rows inside
its transaction causes bloat everywhere. Change the schema in a short transaction;
backfill in batches with their own.

## The statements that cannot participate

```
25001 CREATE INDEX CONCURRENTLY cannot run inside a transaction block
```

| Statement | Why |
|---|---|
| `CREATE INDEX CONCURRENTLY` | Uses several internal transactions to build without blocking writes |
| `DROP INDEX CONCURRENTLY` | Same |
| `VACUUM` | Manages its own transactions |
| `CREATE DATABASE` / `DROP DATABASE` | Not reversible at the filesystem level |

`25001` is `active_sql_transaction`, and it is the usual reason a hand-written
migration runner needs restructuring — it must let a file opt out of the wrapper
([Writing a minimal migration runner](../phase-8-schema-from-node/08-minimal-runner.md)).

The sharp edge: **a `CONCURRENTLY` build that fails leaves an `INVALID` index
behind**, precisely because there was no transaction to roll it back. It is ignored
by the planner and still maintained on every write:

```sql
SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
```

## Trade-off

Transactional DDL removes a whole class of operational pain — no half-applied
migrations, no manual cleanup procedures, no reversal scripts written for failures
that now cannot happen. It costs nothing at the statement level.

The cost appears at the *batch* level: the longer the transaction, the longer locks
are held and the longer `VACUUM` is held back. So the discipline is not "use
transactions" — that is free — but "keep them short", plus knowing the four
statements that cannot join in.

## Gotchas

**Symptom:** A migration half-applied and is marked as not run
**Cause:** The runner executed statements outside a transaction, or autocommitted.
**Fix:** One `BEGIN`/`COMMIT` per file, covering the tracking-table insert too.

**Symptom:** `25001 … cannot run inside a transaction block`
**Cause:** `CONCURRENTLY`, `VACUUM` or `CREATE DATABASE` inside the wrapper.
**Fix:** A per-file opt-out in the runner.

**Symptom:** An index exists but is never used
**Cause:** A failed `CREATE INDEX CONCURRENTLY` left it `INVALID` — no transaction
to undo it.
**Fix:** `pg_index WHERE NOT indisvalid`, then drop and rebuild.

**Symptom:** Ids are missing after a rolled-back migration
**Cause:** Sequences are non-transactional by design.
**Fix:** Nothing — gaps are expected.

**Symptom:** A long migration caused bloat across unrelated tables
**Cause:** Its open transaction held back `VACUUM`'s cleanup horizon database-wide.
**Fix:** Short schema transactions; batch the backfill separately.

**Symptom:** The whole application stalled during a multi-statement migration
**Cause:** The first `ALTER`'s `ACCESS EXCLUSIVE` lock is held until the final
commit.
**Fix:** Smaller transactions, and `SET LOCAL lock_timeout`.

## Interview questions

**★ What does "DDL is transactional" mean, and why is it unusual?**
`CREATE`, `ALTER` and `DROP` can be rolled back like any statement — measured, a
successfully created table vanished when a later statement in the same transaction
failed. Most engines commit DDL implicitly, so a migration failing partway leaves a
half-changed schema that must be repaired by hand.

**★ How does it change migration design?**
Failure leaves nothing applied *and* nothing recorded, so those two facts cannot
disagree. That removes the need for reversal scripts covering failure, which is what
makes forward-only migrations practical, and it allows DDL and DML to be mixed in one
atomic step.

**★ Which statements cannot run in a transaction, and what breaks?**
`CREATE`/`DROP INDEX CONCURRENTLY`, `VACUUM`, `CREATE`/`DROP DATABASE` — all fail
with `25001`. The consequence is that a failed `CONCURRENTLY` build leaves an
`INVALID` index behind, since nothing rolls it back; it is unused by the planner but
still maintained on every write.

**★ Is a transactional `ALTER TABLE` also non-blocking?**
No — unrelated properties. The transaction holds `ACCESS EXCLUSIVE` from the `ALTER`
until commit, so a longer transaction blocks for longer, and later queries queue
behind it. Measured elsewhere: a 12 ms `ALTER` blocked plain `SELECT`s for 2.4 s.

**★ What is not rolled back?**
Sequence values (deliberately non-transactional, so concurrent inserters never
block), and anything outside the database. A rolled-back insert still consumes its
id — measured, ids 1 and 4 after four attempts.

**Why keep migration transactions short if they are atomic anyway?**
Because locks are held for the transaction's whole duration, and an open transaction
holds back `VACUUM`'s cleanup horizon for the entire database. Atomicity is free;
duration is not.

---

← [Modeling relationships](06-relationships.md) · Next → [Unique constraints vs unique indexes](08-unique-nulls.md)
