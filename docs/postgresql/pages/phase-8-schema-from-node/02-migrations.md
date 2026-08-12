---
title: "Migrations"
sidebar_label: "02 · Migrations"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex10-migrations.mjs`.

**A migration is a numbered file that runs exactly once, inside a transaction, with
the fact that it ran recorded in the database itself.** Every property in that
sentence is load-bearing; drop any one and you get a schema nobody can reproduce.

## The tracking table is the whole idea

The database records its own version. Nothing else can be trusted — not the file
system, not the deploy log, not what someone remembers.

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  checksum   text NOT NULL
);
```

```console
$ node ex10-migrations.mjs
=== 1. running the same migrations twice ===
run 1 applied: [ '001-users', '002-orders' ]
run 2 applied: []
┌─────────┬──────────────┬────────────────────┐
│ (index) │ version      │ checksum           │
├─────────┼──────────────┼────────────────────┤
│ 0       │ '001-users'  │ 'f81e6dac4e294e94' │
│ 1       │ '002-orders' │ '6cfbbc39af712d7a' │
└─────────┴──────────────┴────────────────────┘
```

Run it a second time and nothing happens. That is what makes it safe to run on
every deploy, from every machine, without anyone checking first.

`version` is the primary key, which means the "has this run?" question is answered
by a constraint rather than by application logic — the same principle as
[Seeding](03-seeding.md).

## Forward-only, one change per file

**Forward-only.** A "down" migration is a script that must correctly reverse a
change, will be run months later against data that has moved on, and is almost never
tested. `DROP COLUMN` cannot restore the data it deleted. When a deploy goes wrong
the recovery is a *new* forward migration plus a restore from backup — so write the
forward one carefully and skip the fiction.

**One change per file.** Files are the unit of "did this run", so a file combining
three unrelated changes is three things you cannot apply or diagnose separately.

**Never edit a file after it has shipped.** Some database has already run the old
version; editing means two environments have the same `version` and different
schemas, and nothing detects it. That is what the checksum column is for:

```console
=== 3. editing an applied migration ===
caught: migration 001-users was edited after being applied
```

The runner hashes each file and compares it with what was recorded. An edited
migration fails loudly at deploy time instead of silently diverging.

## Ordering: the bug that bites everyone once

Migrations run in filename order, and filename order is *lexical*.

```console
=== 4. file ordering ===
unpadded .sort() → 1-a.sql, 10-c.sql, 11-d.sql, 2-b.sql
padded   .sort() → 001-a.sql, 002-b.sql, 010-c.sql, 011-d.sql
timestamped      → 20251231235959-c.sql, 20260101120000-a.sql, 20260102090000-b.sql
```

**Migration 10 runs before migration 2.** On a fresh database that means a table is
altered before it is created, and the failure is a confusing `42P01 relation does
not exist` rather than anything about ordering. It stays hidden until the tenth
migration, which is late enough that everyone has forgotten the naming decision.

Two fixes, and the choice matters for teams:

| Scheme | Example | Trade-off |
|---|---|---|
| **Zero-padded counter** | `001-users.sql` | Readable, obviously ordered — but two developers on separate branches both write `007-` and collide at merge |
| **UTC timestamp** | `20260101120000-users.sql` | Collisions are essentially impossible; ordering across branches is by authorship time, which may not be dependency order |

Timestamps are what most tools generate, and the branch-collision problem is real
enough that it is usually worth the less readable names. Either way the ordering
must be *total* — the same on every machine — which rules out relying on directory
listing order.

## One transaction per file

PostgreSQL has transactional DDL, so a failed migration can leave nothing behind:

```console
=== 2. a failing migration ===
threw: 42701 column "nickname" of relation "mg_users" already exists
mg_users columns after the failure: id, email
recorded in schema_migrations: 0
```

The file's first statement succeeded and the second failed. The table is untouched —
no `nickname` column — **and the migration is not recorded**, so fixing the file and
re-running does the right thing. Without the transaction you would have a half-applied
migration marked as never-applied, which re-runs and fails differently.

The exceptions are covered in
[Wrapping a migration in `BEGIN`/`COMMIT`](06-tx-migration.md): `CREATE INDEX
CONCURRENTLY`, `VACUUM` and `CREATE DATABASE` cannot run inside a transaction block
and need a per-file opt-out.

## Concurrent deploys

Five application instances rolling out at once all run migrations at startup:

```console
=== 5. two runners starting at once ===
  runner 0: applied [001-users]
  runner 1: applied []
  runner 2: applied []
  runner 3: applied []
  runner 4: applied []
rows in schema_migrations: 1 (must be 1)
```

One applied, four correctly did nothing, one row recorded. That is
`pg_advisory_xact_lock` doing its job — without it, the same race measured in
[Startup races and advisory locks](./01-ddl-from-node/03-startup-races.md) applies
here, and several runners execute the same `CREATE TABLE` simultaneously.

The lock is taken *inside* the same transaction that reads the tracking table and
applies the files, so the read and the write cannot be separated by another runner.

## Migrations run as a deploy step, not at boot

Even with the lock, running migrations from inside the application is the wrong
shape:

- A migration that takes an `ACCESS EXCLUSIVE` lock will block live traffic on the
  old instances still serving requests — see
  [DDL locks and the blocking they cause](./01-ddl-from-node/02-locks-and-blocking.md).
- A failed migration should stop the deploy, not crash-loop the app.
- The app's database role should not have `CREATE`/`ALTER` privileges at all.

The standard shape is a separate command — `node migrate.js` — run as a job before
the new version starts, with a different role that owns the schema.

## Trade-off

Migrations buy reproducibility: any database can be brought to a known schema by
replaying files, and "what shape is production?" has an answer you can read. They
cost discipline. Every schema change becomes a file, files cannot be edited once
shipped, and mistakes are corrected by adding another file rather than fixing the
wrong one — which feels wasteful the first few times.

The alternative, changing schemas by hand, is faster exactly once and then leaves
you unable to recreate the database or explain why staging differs from production.

## Gotchas

**Symptom:** `42P01 relation does not exist` running migrations on a fresh database
**Cause:** Lexical ordering — measured, `1, 10, 11, 2`, so migration 10 ran before
migration 2.
**Fix:** Zero-pad (`001-`) or use UTC timestamps. Never rely on directory order.

**Symptom:** Two environments claim the same migration version but have different
schemas
**Cause:** A migration file was edited after being applied somewhere.
**Fix:** Store a checksum and fail when it changes — measured to catch exactly this.
Correct mistakes with a new file.

**Symptom:** A migration half-applied and is marked as not run
**Cause:** The file executed outside a transaction.
**Fix:** One `BEGIN`/`COMMIT` around the whole file; PostgreSQL rolls DDL back.

**Symptom:** `25001 … cannot run inside a transaction block`
**Cause:** `CREATE INDEX CONCURRENTLY`, `VACUUM` or `CREATE DATABASE` inside the
wrapper.
**Fix:** Let the file opt out of the transaction.

**Symptom:** Several instances run migrations simultaneously and collide
**Cause:** No advisory lock around the read-and-apply sequence.
**Fix:** `pg_advisory_xact_lock` inside the same transaction — measured, 5 runners,
1 applied, 4 no-ops.

**Symptom:** A deploy stalls the whole API for the duration of a migration
**Cause:** DDL taking `ACCESS EXCLUSIVE` while old instances still serve traffic.
**Fix:** `SET lock_timeout`; run migrations as a deploy step; prefer
non-blocking forms.

**Symptom:** Two developers' branches both add `007-add-index.sql`
**Cause:** Counter-based naming and parallel branches.
**Fix:** Timestamp-based filenames.

## Interview questions

**★ What makes something a migration rather than a script?**
It is recorded. A tracking table in the same database holds which versions have
been applied, so the migration runs exactly once and any database can report its own
schema version. Add: numbered for total ordering, transactional so failure leaves
nothing, and never edited after shipping.

**★ Why forward-only? What about down migrations?**
Down migrations are rarely tested, run months later against changed data, and
cannot restore what `DROP COLUMN` deleted. Real recovery is a new forward migration
plus a backup restore. Maintaining reversals costs effort and creates false
confidence.

**★ Migration 10 ran before migration 2. Why?**
Filename sorting is lexical, not numeric — measured, `1-a, 10-c, 11-d, 2-b`. Fix
with zero-padding or UTC timestamps. On a fresh database it surfaces as
`42P01 relation does not exist`, which does not point at ordering.

**★ How do you stop five instances from running migrations at once?**
`SELECT pg_advisory_xact_lock($1)` inside the same transaction that reads the
tracking table and applies the files, so no other runner can interleave between the
read and the write. Measured: 5 concurrent runners, 1 applied, 4 no-ops, 1 row
recorded.

**★ What does the checksum column protect against?**
Someone editing a migration after it has been applied. The runner re-hashes each
file and compares; a mismatch fails the deploy rather than letting two environments
diverge with the same recorded version.

**★ Why run migrations as a deploy step rather than at application startup?**
So a failure stops the deploy instead of crash-looping the app, so the application
role does not need `CREATE`/`ALTER` privileges, and so a long lock does not block
old instances that are still serving traffic. Startup migration also multiplies the
concurrency problem by the replica count.

---

← [Creating tables from Node](./ddl-from-node/) · Next → [Seeding](03-seeding.md)
