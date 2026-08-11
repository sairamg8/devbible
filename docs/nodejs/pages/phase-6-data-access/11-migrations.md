---
title: "Migrations as code, and running them safely at deploy time"
sidebar_label: "11 · Migrations as code"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** — `pg` 8.23.0 against PostgreSQL 17.10.
> The runner below is the one that produced the console output on this page.

**A migration system is four things: an ordered list of files, a table recording
which ran, a lock so two deploys cannot race, and a transaction per file.** That is
about forty lines. Knowing what those forty lines do is what lets you trust — or
debug — whichever tool you end up using.

## The whole runner

```js
// migrate.mjs
import {readdir, readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import pg from 'pg';

const DIR = new URL('./migrations/', import.meta.url);
const LOCK_KEY = 8675309;

const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const client = await pool.connect();

try {
  await client.query(`
    create table if not exists schema_migrations (
      version    text primary key,
      checksum   text not null,
      applied_at timestamptz not null default now()
    )`);

  console.log('waiting for migration lock…');
  const t0 = performance.now();
  await client.query('select pg_advisory_lock($1)', [LOCK_KEY]);
  console.log(`lock acquired after ${Math.round(performance.now() - t0)} ms`);

  const {rows} = await client.query('select version, checksum from schema_migrations');
  const applied = new Map(rows.map((r) => [r.version, r.checksum]));

  const files = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const version = path.basename(file, '.sql');
    const sql = await readFile(new URL(file, DIR), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex').slice(0, 12);

    if (applied.has(version)) {
      if (applied.get(version) !== checksum) {
        throw new Error(
          `${file} was edited after it was applied ` +
          `(${applied.get(version)} -> ${checksum})`);
      }
      console.log(`${version}  already applied`);
      continue;
    }

    await client.query('begin');
    try {
      await client.query(sql);
      await client.query(
        'insert into schema_migrations (version, checksum) values ($1, $2)',
        [version, checksum]);
      await client.query('commit');
      console.log(`${version}  applied`);
    } catch (err) {
      await client.query('rollback');
      throw new Error(`${file} failed: ${err.message}`, {cause: err});
    }
  }
} finally {
  await client.query('select pg_advisory_unlock($1)', [LOCK_KEY]);
  client.release();
  await pool.end();
}
```

```console
$ node migrate.mjs
waiting for migration lock…
lock acquired after 1 ms
001_create_invoices  applied
002_add_invoice_status  applied

$ node migrate.mjs
waiting for migration lock…
lock acquired after 0 ms
001_create_invoices  already applied
002_add_invoice_status  already applied
```

## The four parts, and why each is there

**Ordered files.** `001_`, `002_` — zero-padded numeric prefixes sort correctly as
strings, which timestamps also do. Never renumber a file that has shipped. The name
after the prefix is documentation; only the prefix is identity.

**The ledger table.** `schema_migrations` lives in the database being migrated, so
the database always knows its own version. Nothing else does — not a file, not an
environment variable, not the deploy pipeline.

**The advisory lock.** `pg_advisory_lock` is a whole-session lock on an arbitrary
integer key, held until unlocked or the session ends. It is what makes concurrent
deploys safe. Two runners started at once:

```console
# deploy A                          # deploy B
waiting for migration lock…         waiting for migration lock…
lock acquired after 2 ms            (blocked)
003_add_index  applied
                                    lock acquired after 1306 ms
                                    001_create_invoices  already applied
                                    002_add_invoice_status  already applied
                                    003_add_index  already applied
```

**B waited 1306 ms, then found nothing to do.** Without the lock both would have read
an empty ledger and both would have run `003`. Note the lock is taken *before*
reading the ledger — reading first and locking second reintroduces the race.

**One transaction per file.** PostgreSQL has transactional DDL, which most databases
do not. A migration whose second statement fails leaves nothing behind:

```sql
-- 004_broken.sql
alter table invoices add column currency text;
alter table invoices add column currency text;   -- fails: already exists
```

```console
Error: 004_broken.sql failed: column "currency" of relation "invoices" already exists
$ psql -c '\d invoices'
 id | user_id | total_cents | status        <- unchanged, no stray currency column
```

**The whole file rolled back**, including the first statement. On MySQL the first
statement would have committed and you would be repairing state by hand. This is the
single strongest operational argument for PostgreSQL in a MERN/PERN context.

**The checksum** is the fifth thing, and it is optional in theory only. Editing a
migration that already ran is the most common way a team's environments diverge —
your machine has the new definition, production has the old one, and nothing reports
it:

```console
Error: 001_create_invoices.sql was edited after it was applied
(b98f68f3d6a3 -> 4131454e8d81)
```

An applied migration is **immutable**. Fix it forward with a new file.

## Running them at deploy time

Where the runner executes decides what happens on a bad day.

| Strategy | What breaks |
|---|---|
| On app boot, in-process | Every instance races (the lock saves you); a failed migration crash-loops the app; rollout is blocked on the slowest DDL |
| **Separate step before the new version starts** | Nothing rolls out if it fails, which is what you want. This is the default |
| Manual, by a human | Works until someone forgets, or is asleep |

The separate step is `node migrate.mjs` as its own container/job/CI stage, with the
deploy gated on its exit code. It uses a **different database role** from the
application — the app has no `CREATE TABLE` rights, so an injection cannot reach DDL
([page 02](./02-parameterized-queries.md)).

**Expand and contract** is what makes this safe with zero downtime. Old and new code
run simultaneously during a rollout, so a migration must be compatible with both:

1. **Expand** — add the new nullable column, backfill, add the index concurrently.
   Old code ignores it.
2. **Deploy** the code that writes both old and new.
3. **Contract** — in a *later* deploy, drop the old column.

A rename is therefore three deploys, not one `alter table … rename`. Skipping the
dance means the moment the migration lands, the still-running old instances query a
column that no longer exists.

Two DDL statements deserve specific fear on a live table: **`create index`** takes an
`ACCESS EXCLUSIVE`-blocking share lock — use `create index concurrently`, which
cannot run inside a transaction, so it goes in its own file that the runner executes
outside the transaction block. And **`alter table … set not null`** scans the whole
table under a lock; add a `not valid` check constraint and `validate` it separately.

## Down migrations, and why most teams stop writing them

A `down` is a second script to un-apply a change. In production it is almost never
the thing you run: a failed deploy rolls the *code* back while the additive migration
stays (that is what expand-and-contract is for), and a `down` that drops a column
deletes data that the failed release wrote.

Down migrations are genuinely useful in **development**, for hopping between
branches. Write them if the workflow needs them, and treat "roll forward with a new
migration" as the production answer.

## Mongo has migrations too

Schemaless does not mean migration-free. Indexes, a `$rename` across a collection, a
backfilled field, a new validator — all are schema changes. The same runner works;
only the statement executed changes, and there is **no transactional DDL**, so a
partial run is a real state you must make idempotent. This is also why
[page 09](./09-mongoose.md) says to turn `autoIndex` off: index creation belongs in
this ordered, locked, recorded process, not in whichever instance boots first.

## Gotchas

**Symptom:** Two deploys ran the same migration; duplicate index or column errors
**Cause:** No advisory lock, or the lock is taken after reading the ledger.
**Fix:** `pg_advisory_lock` on a fixed key, before reading `schema_migrations`.

**Symptom:** Staging and production have different schemas from the same files
**Cause:** An applied migration was edited.
**Fix:** Checksums in the ledger; fail loudly. Fix forward with a new file.

**Symptom:** A half-applied migration left the schema in an unknown state
**Cause:** No transaction per file — or a database without transactional DDL.
**Fix:** Wrap each file in `begin`/`commit`. On MySQL/Mongo, write each migration to
be re-runnable.

**Symptom:** The whole site 500s during a deploy, then recovers
**Cause:** A destructive migration landed while old instances were still serving.
**Fix:** Expand and contract — additive now, destructive one deploy later.

**Symptom:** `create index` locked writes on a large table for minutes
**Cause:** A plain `create index`.
**Fix:** `create index concurrently`, in its own file, outside a transaction.

**Symptom:** The app crash-loops after a migration fails
**Cause:** Migrations run at application boot.
**Fix:** Run them as a separate gated deploy step.

**Symptom:** `pg_advisory_lock` never releases
**Cause:** The process was killed between lock and unlock — though the session ending
releases it automatically, a pooled connection returned to the pool does **not** end
the session.
**Fix:** Take the lock on a dedicated `client`, release it in `finally`, as above.

## Interview questions

**★ What are the minimum parts of a migration system?**
An ordered list of files, a table in the target database recording which have run, a
lock so concurrent deploys serialise, and one transaction per file. A checksum on
applied files catches the most common divergence — someone editing history.

**★ Why does the migration runner need a lock?**
Because deploys are concurrent. Two instances both read an empty ledger and both
apply `003`. `pg_advisory_lock` on a fixed key serialises them: measured, the second
runner blocked 1306 ms and then found nothing to do. The lock must be acquired before
the ledger is read.

**★ Why is PostgreSQL's transactional DDL a big deal?**
A migration whose second statement fails leaves the schema exactly as it was —
verified: the first `alter table` was rolled back with the failure. On databases
without it, you are repairing a half-applied schema by hand at the worst moment.

**★ How do you rename a column with zero downtime?**
Three deploys — expand, migrate, contract. Add the new column and backfill; deploy
code that writes both and reads the new one; drop the old column in a later deploy.
A single `rename` breaks every old instance still serving traffic during the rollout.

**Should you write down migrations?**
Useful in development for switching branches; rarely the production answer. A failed
release rolls back the code while the additive migration stays, and a `down` that
drops a column destroys data the release wrote. Roll forward with a new migration.

**Where in the deploy should migrations run?**
As a separate step gated before the new version starts, with a database role that has
DDL rights the application itself does not. Running them at app boot means every
instance races and a failure becomes a crash loop.

**Does MongoDB need migrations?**
Yes — indexes, renames, backfills and validators are all schema changes. The
difference is there is no transactional DDL, so each migration must be written to be
safely re-runnable.

---

← Prev: [The repository pattern](./10-repository-pattern.md) · Next → [`node:sqlite`](./12-node-sqlite.md)
