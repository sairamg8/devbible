---
title: "Migrations as plain SQL"
sidebar_label: "02 · Migrations"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against PostgreSQL 17 documentation (advisory locks,
> transactional DDL) and the node-postgres docs. Concept home:
> [PostgreSQL — schema from Node](../../../postgresql/pages/phase-8-schema-from-node/README.md)
> and [Node — migrations](../../../nodejs/pages/phase-6-data-access/11-migrations.md).

## The problem

The [schema](01-the-schema/README.md) has to reach every database — laptop, CI,
production — in the same order, exactly once each, including the copies that
don't exist yet. That is all a migration system is. The storefront's needs are
met by files of plain SQL and ~60 lines of runner; the design choices are what
this chapter is really about.

## The design choices

**Plain SQL files, not a DSL.** Migration DSLs (`table.increments()`, …)
abstract the one thing you want to be looking at — the DDL Postgres will run.
Raw SQL means `EXPLAIN`-able, reviewable statements with nothing lost in
translation, at the cost of writing Postgres-specific files. This app chose
Postgres in Phase 0; portability it will never use is not worth an abstraction
layer it reads every week.

**Forward-only, no `down` migrations.** Down migrations promise reversibility
and deliver it only for the easy cases — `drop column` does not resurrect
data. Production rollback is *restore from backup* or *ship a new forward
migration*; pretending otherwise is how `down` files rot untested. Cost: a bad
migration on a laptop means recreate the dev database — which chapter 03's
seeds make a one-command event.

**One transaction per migration file.** Postgres runs DDL transactionally —
the rare statements that refuse a transaction block (`create index
concurrently`) get their own file with a marker comment, and everything else
is all-or-nothing. Half-applied migrations are the failure mode that costs
weekends.

**A ledger table plus an advisory lock.** The ledger records what ran; the
lock makes two deploying instances take turns instead of racing the same file.

## The implementation

Files live in `db/migrations`, ordered by a numeric prefix:

```text
db/migrations/
├── 001_extensions.sql
├── 002_users_sessions.sql
├── 003_catalog.sql
├── 004_carts_orders.sql
├── 005_reviews_outbox.sql
└── ...
```

```js
// db/migrate.js — the whole runner
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const MIGRATIONS_DIR = new URL('./migrations/', import.meta.url);
const LOCK_KEY = 7145261; // arbitrary app-wide constant — one lock for "migrating"

export async function migrate(databaseUrl) {
  const client = new pg.Client({connectionString: databaseUrl});
  await client.connect();
  try {
    // one instance migrates; concurrent deploys wait here
    await client.query('select pg_advisory_lock($1)', [LOCK_KEY]);

    await client.query(`
      create table if not exists schema_migrations (
        filename   text primary key,
        applied_at timestamptz not null default now()
      )`);

    const {rows} = await client.query('select filename from schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort(); // 001_, 002_ … — the prefix IS the order

    for (const filename of files) {
      if (applied.has(filename)) continue;
      const sql = await readFile(new URL(filename, MIGRATIONS_DIR), 'utf8');

      const noTx = sql.startsWith('-- no-transaction');
      if (!noTx) await client.query('begin');
      try {
        await client.query(sql);
        await client.query(
          'insert into schema_migrations (filename) values ($1)', [filename],
        );
        if (!noTx) await client.query('commit');
        console.log(`applied ${filename}`);
      } catch (err) {
        if (!noTx) await client.query('rollback');
        throw new Error(`migration ${filename} failed`, {cause: err});
      }
    }
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK_KEY]);
    await client.end();
  }
}
```

A file that cannot run in a transaction opts out explicitly:

```sql
-- no-transaction
-- 014_products_search_gin.sql  (chapter 10 adds this)
create index concurrently if not exists products_search_idx
  on products using gin (search);
```

## Using it in the app

The runner is called from two places, both established elsewhere: the
[boot sequence](../../../nodejs/pages/phase-11-deployment/02-boot-sequence.md)
runs it *before* the server listens (migrate → connect pool → listen → ready),
and the [ops CLI](../README.md) exposes it as `cli migrate` for laptops and CI.
Workers do **not** migrate — one owner per concern; they wait on the same
advisory lock only implicitly, by deploying after the API.

Note the runner uses a single `pg.Client`, not the pool: migration is a
one-connection, boot-time activity, and the advisory lock is *session-scoped* —
it must live and die with exactly one connection. The
[pool-vs-client distinction](../../../nodejs/pages/phase-6-data-access/01-connection-pooling.md)
is the concept page's.

## Gotchas

- **Symptom:** deploy hangs at "migrating" forever. **Cause:** another
  process died holding the advisory lock's connection — or is legitimately
  still migrating something slow. **Fix:** session-scoped locks release when
  the connection drops, so a *dead* holder self-heals; a hang means a *live*
  holder. Look for the long-running migration before killing anything.
- **Symptom:** `create index concurrently` fails with *cannot run inside a
  transaction block*. **Cause:** the file lacks the `-- no-transaction` first
  line, so the runner wrapped it. **Fix:** the marker — and remember a failed
  concurrent build leaves an `INVALID` index behind to drop before retrying.
- **Symptom:** two developers' migrations both merged as `009_….sql`.
  **Cause:** numeric prefixes allocate by race. **Fix:** the sort is
  lexicographic, so both run — but review order at merge time; when the team
  outgrows that, timestamps (`20260816_1030_…`) end the collisions. The
  trade-off is uglier names, nothing else.
- **Symptom:** CI databases are missing `citext` but production is fine.
  **Cause:** someone created the extension by hand in production once, and
  the migration ledger never knew. **Fix:** the rule the runner enforces by
  existing — *no hand-run DDL, ever*. If it isn't a numbered file, it didn't
  happen.

## Interview questions

1. **★ Why forward-only migrations?** Because `down` files are a promise the
   easy cases keep and the hard cases break — dropped data does not come back
   from `add column`. Real recovery is a backup or a new forward migration,
   so the honest system only has the mechanism that actually works, and dev
   databases are cheap to rebuild.
2. **★ Why an advisory lock instead of relying on the ledger's primary key?**
   The ledger stops the *same file applying twice*, but two racing runners
   would each run the file's DDL and then one fails on the ledger insert —
   after both executed side effects. The lock serializes the whole run:
   losers wait, see the updated ledger, and do nothing.
3. **Why does the runner use one `Client` rather than the pool?** Advisory
   locks are session-scoped: `pg_advisory_lock` on one pooled connection and
   `unlock` on another is a no-op that leaks the lock. One client, one
   session, lock lifetime = connection lifetime.
4. **Why run migrations at boot rather than as a separate deploy step?** With
   one API instance it removes a whole class of "deployed code, forgot the
   migration" incidents; the advisory lock keeps multi-instance deploys safe.
   The cost: a slow migration delays readiness — which is exactly what the
   readiness probe is for. At bigger scale, a dedicated migration job before
   rollout wins; that boundary is named in the boot-sequence concept page.
5. **What does transactional DDL buy that MySQL users have to script around?**
   A failed migration rolls back to exactly the pre-migration schema — no
   half-created tables to clean up before retrying. It is why the runner can
   simply `rollback` and rethrow.

---

← Prev: [The schema](01-the-schema/README.md) ·
Next → [Seed data and fixtures](03-seeds-and-fixtures.md)
