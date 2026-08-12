---
title: "Writing a minimal migration runner"
sidebar_label: "08 · Minimal runner"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex10-migrations.mjs`.

**A correct migration runner is about sixty lines. Writing it once is the best way
to understand what the tools do — and knowing exactly where it stops being enough is
the point of writing it.**

## The whole thing

```js
import {readdir, readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

const LOCK_KEY = 8675309;   // arbitrary but fixed; write it down

export async function migrate(pool, dir, {log = console.log} = {}) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now(),
      checksum   text NOT NULL
    )`);

  const client = await pool.connect();
  const applied = [];
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY]);

    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    const {rows} = await client.query('SELECT version, checksum FROM schema_migrations');
    const done = new Map(rows.map((r) => [r.version, r.checksum]));

    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      const sql = await readFile(join(dir, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex').slice(0, 16);

      if (done.has(version)) {
        if (done.get(version) !== checksum) {
          throw new Error(`migration ${version} was edited after being applied`);
        }
        continue;
      }

      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (version, checksum) VALUES ($1,$2)',
        [version, checksum]);
      applied.push(version);
      log(`applied ${version}`);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return applied;
}
```

## Why each line is there

**`CREATE TABLE IF NOT EXISTS` outside the lock.** It is the bootstrap problem: you
cannot read the tracking table before it exists. This one statement is genuinely
exposed to the race from
[Startup races](./01-ddl-from-node/03-startup-races.md), so if you expect many
simultaneous first-runs, take the advisory lock before it too.

**One `client`, not `pool.query`.** `BEGIN`, the advisory lock and every migration
must be on the same session — a pool would hand different statements to different
connections and the transaction would not contain them.

**The advisory lock inside the transaction.** It serialises the entire
read-then-apply sequence. Taking it after reading the tracking table would leave a
window where two runners both see "nothing applied".

**`.sort()` on filenames**, which is lexical — hence the padding rules in
[Migrations](02-migrations.md).

**`await client.query(sql)` with no parameter array**, which puts `pg` on the simple
query protocol so a file may contain several statements. Passing even an empty array
is fine; a *non-empty* one would fail with `42601 cannot insert multiple commands
into a prepared statement` — see
[Issuing DDL through the driver](./01-ddl-from-node/01-issuing-ddl.md).

**The whole loop in one transaction.** Every pending migration commits together or
none does.

## What it does, measured

```console
$ node ex10-migrations.mjs
=== 1. running the same migrations twice ===
run 1 applied: [ '001-users', '002-orders' ]
run 2 applied: []

=== 2. a failing migration ===
threw: 42701 column "nickname" of relation "mg_users" already exists
mg_users columns after the failure: id, email
recorded in schema_migrations: 0

=== 3. editing an applied migration ===
caught: migration 001-users was edited after being applied

=== 5. two runners starting at once ===
  runner 0: applied [001-users]
  runner 1: applied []
  runner 2: applied []
  runner 3: applied []
  runner 4: applied []
rows in schema_migrations: 1 (must be 1)
```

Idempotent, atomic on failure, tamper-evident, and safe against five concurrent
runners. That is the full set of properties a migration system needs.

## One transaction for all files, or one per file?

The runner above uses **one transaction for the whole batch**. The alternative is a
transaction per file, committing each as it succeeds.

| | One for the batch | One per file |
|---|---|---|
| A failure mid-batch | nothing is applied; state unchanged | earlier files stay applied |
| Re-running after a fix | starts from the beginning | resumes at the failed file |
| Long batches | one long-held lock | locks released between files |
| `CONCURRENTLY` statements | impossible anywhere in the batch | possible in an opt-out file |

For a handful of pending migrations at deploy time, batch is simpler and the
all-or-nothing property is worth more. For a large backlog on a big table, per-file
is kinder to concurrent traffic. Real tools default to per-file.

## Where sixty lines stops being enough

Adopt a tool when you need any of these — each is more than an incremental addition:

- **Per-file transaction opt-out**, for `CREATE INDEX CONCURRENTLY`. Needs the
  runner to parse a directive out of the file and restructure its transaction
  handling.
- **A generator command** that produces correctly timestamped filenames, because
  hand-naming is where ordering bugs come from.
- **`--dry-run` and status output**, which is what you want at 2 a.m.
- **Baselining an existing database** — marking migrations as applied without
  running them, for adopting migrations on a database that already exists.
- **Down migrations**, if your team wants them despite
  [Migrations](02-migrations.md)'s argument.
- **Non-SQL migrations** — a data backfill in JavaScript, in the same ordering.

The honest position: write this to understand the mechanism, run it if your needs
are exactly this, and switch to `node-pg-migrate` the first time you need something
above. Migrating from your own runner is easy because the tracking table is the same
idea — see [Migration tools](12-migration-tools.md).

## Trade-off

Your own runner has no dependency, no configuration file, no magic, and you can
read all of it. It also has no tests, no community, and no answer for the case you
have not hit yet — and a migration runner is infrastructure where the unhandled case
is discovered during an incident.

Sixty lines you fully understand beats a tool you have not read, right up until the
first `CONCURRENTLY` index. Know which side of that line you are on.

## Gotchas

**Symptom:** `42601 cannot insert multiple commands into a prepared statement`
**Cause:** The `.sql` file has several statements and was executed with a non-empty
parameter array.
**Fix:** `client.query(sql)` with no parameters.

**Symptom:** The runner reads `res.rows` and gets `undefined`
**Cause:** Multi-statement files return an *array* of results on the simple
protocol.
**Fix:** Check `Array.isArray(res)`.

**Symptom:** Two runners both apply the same migration
**Cause:** The advisory lock was taken after reading the tracking table, or a pool
was used so `BEGIN` and the lock landed on different connections.
**Fix:** One checked-out client; lock immediately after `BEGIN`.

**Symptom:** A migration is recorded but its changes are missing
**Cause:** The `INSERT` into `schema_migrations` committed separately from the
migration body.
**Fix:** Both in the same transaction — that is the whole reason for the wrapper.

**Symptom:** The runner hangs forever on a second deploy
**Cause:** `pg_advisory_lock` (session-scoped) left held by a crashed process.
**Fix:** `pg_advisory_xact_lock`.

**Symptom:** Migrations pass locally and fail in CI with `42P01`
**Cause:** `readdir` order differs; the code relied on it instead of sorting.
**Fix:** Explicit `.sort()` plus a zero-padded or timestamped naming scheme.

## Interview questions

**★ What are the minimum properties a migration runner must have?**
A tracking table so each file runs once, total ordering of files, a transaction per
run so failure leaves nothing applied *and* nothing recorded, and a lock so
concurrent runners cannot interleave. Measured: idempotent second run, a failing
file leaving the table untouched and unrecorded, and 5 concurrent runners producing
1 applied migration.

**★ Where exactly does the advisory lock go, and why?**
Immediately after `BEGIN`, on the same client, before reading the tracking table.
It must cover the whole read-then-apply sequence — locking after the read leaves a
window in which two runners both conclude nothing has been applied.

**★ Why must the migration body and the tracking-table insert share a transaction?**
Otherwise they can diverge: a migration applied but not recorded re-runs and fails,
and a migration recorded but not applied is silently skipped forever. One
transaction makes "applied" and "recorded" the same event.

**★ One transaction for the batch, or one per file?**
Batch gives all-or-nothing and is simpler; a failure leaves the schema exactly as it
was. Per-file lets a long backlog resume from the failure point, releases locks
between files, and is the only way to allow a `CONCURRENTLY` file to opt out. Tools
default to per-file.

**★ When should you stop using your own runner?**
The first time you need `CREATE INDEX CONCURRENTLY` (needs per-file transaction
opt-out), baselining an existing database, dry-run/status output, or JavaScript data
migrations. Each is a structural change rather than an addition.

**Why is `CREATE TABLE IF NOT EXISTS schema_migrations` outside the lock a
compromise?**
It is the bootstrap: the lock protects the tracking table, but the tracking table
must exist first. That single statement carries the race documented in
[Startup races](./01-ddl-from-node/03-startup-races.md), so take the lock before it if
many first-runs may start at once.

---

← [`CREATE TABLE IF NOT EXISTS`](07-if-not-exists.md) · Next → [`COPY FROM STDIN`](09-copy-streams.md)
