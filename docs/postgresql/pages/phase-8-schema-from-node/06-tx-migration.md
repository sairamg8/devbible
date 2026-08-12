---
title: "Wrapping a migration in BEGIN/COMMIT"
sidebar_label: "06 · Transactional migration"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex1-ddl-from-node.mjs`,
> `ex10-migrations.mjs`, `ex7-ddl-locks.mjs`.

**PostgreSQL puts DDL inside transactions. That single property is why a failed
migration here leaves nothing behind, and why migrations on MySQL and Oracle need a
manual cleanup procedure that migrations here do not.**

## The property, demonstrated

Two `CREATE TABLE`s succeed, a third fails:

```js
try {
  await client.query('BEGIN');
  await client.query('CREATE TABLE tx_demo_a (id int)');
  await client.query('CREATE TABLE tx_demo_b (id int)');
  await client.query('CREATE TABLE tx_demo_a (id int)'); // deliberate failure
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  console.log('failed on:', err.code, err.message);
}
```

```console
$ node ex1-ddl-from-node.mjs
=== 3. transactional DDL — rollback after a good CREATE ===
failed on: 42P07 relation "tx_demo_a" already exists
tables surviving the rollback: (none)
```

`tx_demo_b` was created successfully and still vanished. In a migration runner the
same property covers the tracking-table insert as well:

```console
$ node ex10-migrations.mjs
=== 2. a failing migration ===
threw: 42701 column "nickname" of relation "mg_users" already exists
mg_users columns after the failure: id, email
recorded in schema_migrations: 0
```

Nothing applied **and** nothing recorded. Those two facts must agree, and one
transaction is what makes them agree — a migration recorded but not applied is
skipped forever; applied but not recorded re-runs and fails.

## What this buys you

Without transactional DDL, a migration that fails on statement five leaves
statements one to four applied. The recovery is manual: work out how far it got,
undo it by hand, fix the file, re-run. Every migration would need a tested reversal
procedure — which is the world MySQL migrations live in, and the reason "down"
migrations feel more necessary there.

Here, the failure mode is: **nothing happened, fix the file, run it again.** That is
also what makes forward-only migrations practical
([Migrations](02-migrations.md)) — you do not need a reversal for the *failure* case,
only for the much rarer "shipped and regretted it" case.

## The statements that cannot participate

Four things cannot run inside a transaction block:

| Statement | Why | What to do instead |
|---|---|---|
| `CREATE INDEX CONCURRENTLY` | Needs multiple transactions internally to build without blocking writes | A file that opts out of the wrapper |
| `DROP INDEX CONCURRENTLY` | Same | Same |
| `VACUUM` / `VACUUM FULL` | Manages its own transactions | Run outside migrations entirely |
| `CREATE DATABASE` / `DROP DATABASE` | Cannot be rolled back at the file-system level | A separate provisioning step |

Inside `BEGIN` they fail with:

```
25001 CREATE INDEX CONCURRENTLY cannot run inside a transaction block
```

`25001` is `active_sql_transaction`. This is the single most common reason a
homegrown runner needs restructuring — see
[Writing a minimal migration runner](08-minimal-runner.md), where it is named as the
line at which sixty lines stops being enough.

The usual design is a per-file directive the runner reads before deciding whether to
wrap:

```sql
-- migrate: no-transaction
CREATE INDEX CONCURRENTLY mg_orders_user_id_idx ON mg_orders (user_id);
```

**A `CONCURRENTLY` build that fails leaves an `INVALID` index behind** — it is not
rolled back, because there is no transaction. The index exists, is not used by the
planner, and still costs write overhead. Find them and drop them explicitly:

```sql
SELECT indexrelid::regclass AS index_name
  FROM pg_index WHERE NOT indisvalid;
```

## Bound the lock wait

A transactional migration is still a migration: it takes `ACCESS EXCLUSIVE` and can
queue behind a long-running read, blocking everything that arrives after it. From
[DDL locks and the blocking they cause](./01-ddl-from-node/02-locks-and-blocking.md):

```console
=== 4. lock_timeout ===
with lock_timeout=500ms → 55P03 | canceling statement due to lock timeout
```

Set it at the start of the migration transaction:

```sql
BEGIN;
SET LOCAL lock_timeout = '3s';
ALTER TABLE mg_users ADD COLUMN nickname text;
COMMIT;
```

`SET LOCAL` scopes it to the transaction, so it reverts on commit rather than
leaking into whatever the connection does next. Failing with `55P03` is the good
outcome: transactional DDL means nothing was left behind, so the deploy step can
simply retry.

## Long transactions have a cost

Wrapping *many* migrations in one transaction holds every lock until the final
commit. On a busy database that is a growing blast radius: the `ACCESS EXCLUSIVE`
lock from the first `ALTER` is held while the tenth runs.

A long-open transaction also holds back `VACUUM`'s cleanup horizon, so dead tuples
accumulate across the whole database for the duration — usually irrelevant for a
few seconds of DDL, and genuinely harmful for a migration that backfills a large
table row by row inside the same transaction.

Backfills therefore belong outside the schema migration: change the schema in one
short transaction, then backfill in batches with their own transactions.

## Trade-off

One transaction per file gives all-or-nothing per change and is the right default.
One transaction for the whole batch gives all-or-nothing per *deploy*, which is
tidier but holds locks longer and makes a large backlog riskier to apply.

Neither can accommodate `CONCURRENTLY`, so any runner used seriously ends up with a
per-file opt-out. That is not a wart — it is the honest shape of the problem: most
DDL should be atomic, and the statements designed not to block writes are exactly
the ones that cannot be.

## Gotchas

**Symptom:** `25001 … cannot run inside a transaction block`
**Cause:** `CREATE INDEX CONCURRENTLY`, `VACUUM` or `CREATE DATABASE` inside the
runner's `BEGIN`.
**Fix:** A per-file opt-out directive so that file runs unwrapped.

**Symptom:** An index exists but the planner never uses it
**Cause:** A failed `CREATE INDEX CONCURRENTLY` left it `INVALID`; there was no
transaction to roll back.
**Fix:** `SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid`, then
`DROP INDEX` and rebuild.

**Symptom:** A migration is recorded but its changes are missing
**Cause:** The tracking-table insert committed separately from the migration body.
**Fix:** Both inside the same transaction — measured, a failure leaves the table
untouched *and* unrecorded.

**Symptom:** A migration hangs and eventually the pool exhausts
**Cause:** It is queued for `ACCESS EXCLUSIVE` behind a long read, and everything
else is queued behind it.
**Fix:** `SET LOCAL lock_timeout` so it fails fast; retry after.

**Symptom:** `lock_timeout` set in a migration affects later application queries
**Cause:** `SET` rather than `SET LOCAL`, on a pooled connection that was returned
to the pool.
**Fix:** `SET LOCAL`, which reverts at commit.

**Symptom:** Table bloat grows sharply during a long migration
**Cause:** A long-open transaction holds back `VACUUM`'s cleanup horizon.
**Fix:** Keep schema changes short; batch backfills into separate transactions.

## Interview questions

**★ What does transactional DDL change about how you write migrations?**
Failure becomes "nothing happened". Measured: two tables created, a third statement
failed, and all of it rolled back — plus the tracking-table row was never written,
so the migration is not falsely recorded. You do not need a tested reversal
procedure for the failure case, which is what makes forward-only migrations
practical.

**★ Which statements can't be in a transaction, and how do runners cope?**
`CREATE INDEX CONCURRENTLY`, `DROP INDEX CONCURRENTLY`, `VACUUM`, `CREATE DATABASE`
— they fail with `25001`. Runners support a per-file directive that skips the
transaction wrapper for that file.

**★ What is the risk of a `CONCURRENTLY` index build failing?**
It leaves an `INVALID` index behind, since there is no transaction to undo it. The
planner ignores it but every write still maintains it. Find them with
`pg_index WHERE NOT indisvalid` and drop them explicitly.

**★ Why `SET LOCAL lock_timeout` rather than `SET`?**
`SET LOCAL` is scoped to the transaction and reverts at commit. A plain `SET` on a
pooled connection persists after the connection is returned to the pool, so ordinary
application queries inherit a timeout meant only for the migration.

**★ Should the whole batch of migrations share one transaction?**
It gives all-or-nothing per deploy, but holds every lock until the final commit and
prevents any file from opting out for `CONCURRENTLY`. One transaction per file is
the usual default: smaller blast radius, resumable, and compatible with the opt-out.

**Why do backfills not belong in the schema migration?**
A long-running transaction holds its locks and holds back `VACUUM`'s cleanup horizon
for the whole database. Change the schema in a short transaction, then backfill in
batches with their own transactions.

---

← [SQL in `.sql` files](05-sql-files.md) · Next → [`CREATE TABLE IF NOT EXISTS`](07-if-not-exists.md)
