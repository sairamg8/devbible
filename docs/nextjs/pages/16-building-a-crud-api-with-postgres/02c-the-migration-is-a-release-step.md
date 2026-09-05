---
title: "Your schema file is a claim and only an applied migration makes the database agree — so the migration runs once, from one place, on the direct connection, before the new code serves traffic, and a pending migration fails the deploy rather than the first request that touches the new column"
sidebar_label: "02c · Migration as a release step"
sidebar_position: 15
description: "generate versus push versus migrate, why the migration runner needs a session your pooler will not give it, the ledger as the only artefact that knows, why application startup is the wrong place in a serverless deployment, and the four-line pipeline that turns a schema mismatch into a failed deploy."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Drizzle Kit · overview](https://orm.drizzle.team/docs/kit-overview) and [Drizzle · Migrations](https://orm.drizzle.team/docs/migrations), [Neon · Connection pooling](https://neon.com/docs/connect/connection-pooling), [Prisma 7 · PgBouncer](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/pgbouncer) (quoted for the Schema Engine's single-connection requirement, which is the same protocol constraint drizzle-kit is under) and the [PostgreSQL 18 `ALTER TABLE` reference](https://www.postgresql.org/docs/18/sql-altertable.html).
> Target: `drizzle-kit` **0.31.10** · `drizzle-orm` **0.45.2** · **PostgreSQL 18.4** · `pg` **8.23.0** · **Next.js 16.3.4** · Node **24.20.0**.
> Documentation-verified; **no sandbox run, no timings**.

**The `db/schema.ts` in [02](02-the-schema-and-the-migration-story.md) is a TypeScript file. It types your queries, it generates your DTOs, and it has no authority over the database whatsoever. `title` is `NOT NULL` in that file the moment you type it; it is `NOT NULL` in the database only after a migration ran and a row in a ledger says so. Almost every "it works locally" schema incident is that gap — the types and the queries agreed with each other and neither of them had asked the database. This page is about closing it mechanically, so that a schema the database has not applied is a red build rather than a 500 at 3 a.m.**

## The three commands, and which of them a deploy is allowed to run

Drizzle Kit's own descriptions:

> *"`drizzle-kit generate` lets you generate SQL migration files based on your Drizzle schema either upon declaration or on subsequent changes"*

> *"`drizzle-kit migrate` lets you apply generated SQL migration files to your database"*

> *"`drizzle-kit push` lets you push your Drizzle schema to database either upon declaration or on subsequent schema changes"*
> — [Drizzle Kit overview](https://orm.drizzle.team/docs/kit-overview)

and the one that decides where each belongs:

> *"`drizzle-kit push` pulls current database schema, generates alterations based on diff, and applies migrations to the database directly **without creating SQL files**."*
> — [Drizzle · Migrations](https://orm.drizzle.team/docs/migrations)

No file means no ledger entry, no review, no rollback artefact and no way to rebuild the database from scratch. [15 · 01ia](../15-databases-apis-and-full-stack-patterns/01ia-push-pooling-and-proving-the-migration-ran.md) works through what that costs in full; the rule this chapter needs is narrow:

| Command | Where it may run | Why |
|---|---|---|
| `push` | a local database, a personal branch database | A schema with no file cannot be reproduced or reviewed |
| `generate` | a developer's machine, output committed | The SQL is the artefact; it belongs in the diff |
| `migrate` | **CI or the release step, and nowhere else** | It is the only one that consults the ledger |

Make it structural rather than remembered:

```jsonc
// package.json
{
  "scripts": {
    "db:push": "drizzle-kit push",          // local only, throwaway data
    "db:generate": "drizzle-kit generate",  // authoring a change
    "db:migrate": "tsx scripts/migrate.ts", // the ONLY one CI and deploys run
    "db:check": "drizzle-kit check"
  }
}
```

`drizzle-kit check` is worth having in CI on its own: it *"will walk through all generate migrations and check for any race conditions(collisions) of generated migrations"* — which is precisely what two branches that each ran `generate` produce when they merge.

## The runner gets `DIRECT_URL`, and this is not a preference

The application connects through the pooled endpoint. The migration runner must not.

The reason is the same protocol constraint that governs every session feature in [15 · 01c](../15-databases-apis-and-full-stack-patterns/01c-transaction-pooling-and-session-state.md): a transaction-mode pooler hands each transaction to whichever backend is free, and a migration runner needs a *stable* session across a sequence of statements — it reads the ledger, takes a lock, runs DDL, writes the ledger. Prisma states the requirement explicitly for its own engine, and the constraint is the protocol's rather than Prisma's:

> *"Prisma Migrate uses **database transactions** to check out the current state of the database and the migrations table. However, the Schema Engine is designed to use a **single connection to the database**, and does not support connection pooling with PgBouncer."*
> — [Prisma 7 · PgBouncer](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/pgbouncer)

Neon lists schema migrations first among the operations that require a direct connection, alongside `CREATE INDEX CONCURRENTLY`, `LISTEN`/`NOTIFY` and anything using temporary tables or SQL-level prepared statements.

```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DIRECT_URL! },   // NOT DATABASE_URL
})
```

Two variables, two hosts, and the difference between them is seven characters in the middle of a long secret that nobody reads:

```ts
// lib/env.ts — the only module that reads process.env, per the Data Security guide.
import 'server-only'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

/** Runtime traffic. The pooled endpoint, always. */
export const DATABASE_URL = required('DATABASE_URL')

/** Migrations, index builds, dumps. Never used by a request path. */
export const DIRECT_URL = required('DIRECT_URL')

if (DATABASE_URL === DIRECT_URL) {
  throw new Error('DATABASE_URL and DIRECT_URL are identical — one of them is wrong')
}
if (!new URL(DATABASE_URL).hostname.includes('-pooler.')) {
  throw new Error('DATABASE_URL is not a pooled endpoint')
}
```

🔴 **A migration that appears to succeed against a transaction pooler has not necessarily done what you think.** The failure is not reliably a clean error; it can be a partially applied migration with a ledger row claiming success, which is the worst state a schema can be in, because the next run skips it.

## The ledger is the only thing that knows

`drizzle-kit migrate` *"fetches migration history from the database, picks previously unapplied migrations, and applies new migrations"*. That history lives in a table — the default is `__drizzle_migrations__`, configurable via the `migrations.table` setting in `drizzle.config.ts`.

That table is the answer to the only question that matters: **is this database current?** Not the schema file, which is a claim. Not the generated SQL, which is an intention. Not "the deploy said OK", which is a report about a process. The ledger is the database's own record of what it has run.

Which makes the runner idempotent and therefore safe to invoke on every deploy, including deploys that changed nothing — it applies only what the ledger lacks.

## The runner itself

```ts
// scripts/migrate.ts — run on release, never on boot.
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

const url = process.env.DIRECT_URL
if (!url) throw new Error('DIRECT_URL is not set — refusing to migrate')

const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10_000 })

try {
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
} finally {
  await pool.end()
}
```

Every line of that is load-bearing.

- **`max: 1`.** A migration runner wants exactly one connection, on a direct endpoint, for the duration. More would be a second session that cannot see the first's lock or state.
- **`connectionTimeoutMillis`.** `pg`'s default is `0`, which means wait forever. A CI job that hangs on an unreachable database with no output is a job that fails at the pipeline timeout twenty minutes later with nothing useful in the log.
- **`await pool.end()` in a `finally`.** Without it, the open pool keeps handles registered with the event loop and the process does not exit. Locally that looks like a script that "finished"; in CI it is a step that times out while every log line says the migration succeeded.
- **The explicit check on `DIRECT_URL`.** If the variable is absent, `new Pool({ connectionString: undefined })` falls back to `pg`'s environment defaults — `PGHOST`, `PGDATABASE` and friends — and will happily connect somewhere you did not intend. Refuse instead.

## Never from application startup

🔴 **This is the rule with the worst failure mode in the chapter.**

The tempting shape is a module that runs `migrate()` when the server boots, so the schema is always current and nobody has to remember a step. In a single long-lived process it is merely poor practice. In a serverless deployment it is a defect:

- **Instances are created concurrently.** A traffic spike or a rolling deploy starts many at once, and every one of them races to apply the same migration. The ledger and the runner's advisory lock will *mostly* save you, and "mostly" is carrying an enormous amount of weight in a sentence about DDL.
- **The instance holds the pooled connection string**, which is exactly the connection a migration must not use.
- **The failure lands on a request.** A migration that fails at boot fails while a user is waiting, in a code path with no operator watching, and the deploy that caused it has already been reported green.
- **The lock is held during a user request.** DDL takes `ACCESS EXCLUSIVE` (see [02d](02d-the-lock-a-migration-actually-takes.md)), so a migration running inside a request handler blocks every other query on that table while a client's connection is open.

**Migrations run once, from one place, as a release step, before the new code serves traffic.**

## The pipeline

Four steps, and the order is not negotiable:

```yaml
# .github/workflows/deploy.yml — the release job
steps:
  - run: yarn db:check                     # 1. two branches did not both generate 0007_
  - run: yarn db:migrate                   # 2. apply, against DIRECT_URL, idempotent
    env:
      DIRECT_URL: ${{ secrets.DIRECT_URL }}
  - run: yarn db:verify                    # 3. assert nothing is pending — fails the deploy
    env:
      DIRECT_URL: ${{ secrets.DIRECT_URL }}
  - run: yarn deploy:app                   # 4. only now does new code serve traffic
```

Step 3 is the one everybody omits, and it is the only one that converts a schema mismatch from a runtime incident into a red pipeline. `drizzle-kit` has no `migrate status` command of its own, so the assertion is a query against the ledger:

```ts
// scripts/verify-migrations.ts
import { readdirSync } from 'node:fs'
import { Pool } from 'pg'

const url = process.env.DIRECT_URL
if (!url) throw new Error('DIRECT_URL is not set — refusing to verify')

const onDisk = readdirSync('./drizzle').filter((f) => f.endsWith('.sql')).length

const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10_000 })
try {
  const { rows } = await pool.query<{ applied: string }>(
    'SELECT count(*)::text AS applied FROM drizzle.__drizzle_migrations',
  )
  const applied = Number(rows[0].applied)
  if (applied !== onDisk) {
    throw new Error(
      `Migration ledger disagrees with the repository: ${applied} applied, ${onDisk} on disk. Refusing to release.`,
    )
  }
} finally {
  await pool.end()
}
```

⚠️ **Confirm the ledger's schema and table name against your own `drizzle.config.ts` before relying on that query.** The default location is configurable through `migrations.schema` and `migrations.table`, and the value on your project is whatever your config says — the query above assumes the defaults and will fail loudly rather than silently if they differ, which is the correct direction for a verification step to fail in.

The property the whole pipeline buys is one sentence: **the failure mode of a forgotten migration becomes a deploy that does not happen, instead of a request that does not work.**

## Gotchas

**★ Symptom: a query fails in production naming a column that is right there in `db/schema.ts`.** Cause: the migration was generated and never applied — the schema file is a claim, and only the ledger makes it true. Fix: `db:migrate` as a release step and `db:verify` gating the release, so a pending migration is a red pipeline rather than a `42703 undefined_column` on a user's request.

**★ Symptom: two branches merged and the migration folder has two files numbered `0007_`.** Cause: both developers ran `generate` from the same base. Fix: `drizzle-kit check` in CI on every pull request — it *"check[s] for any race conditions(collisions) of generated migrations"* — so the collision is a failed check on the branch rather than a broken `migrate` on main.

**★ Symptom: `migrate` fails against the database the application connects to perfectly well.** Cause: the runner was given `DATABASE_URL`, which is the pooled endpoint, and a transaction pooler cannot give a migration runner the stable session it needs. Fix: `DIRECT_URL` in `drizzle.config.ts` and in the runner script, plus the boot-time assertion that the two variables differ.

**★ Symptom: a migration reports success and the change is not there.** Cause: it ran against a pooler and was partially applied, or it ran against the wrong database entirely because `DIRECT_URL` was unset and `pg` fell back to `PGHOST`. Fix: refuse to start when the variable is missing, as the runner above does, and verify the ledger afterwards rather than trusting the exit code.

**★ Symptom: a deploy is green and the first request after it returns 500.** Cause: the migration runs at application startup, so the deploy's success says nothing about the schema. Fix: move it into the release pipeline ahead of the app deploy. The ordering is what makes the deploy the thing that fails.

**★ Symptom: development schema drifted and nobody can reproduce a bug.** Cause: `push` was used against a shared database, so there is a schema with no file, and the next `generate` diffs against the last migration folder rather than against the live database — producing SQL that describes a change from a state the database left long ago. Fix: `push` only against a database you are willing to discard, and rebuild any environment that has been pushed to from migrations.

**★ Symptom: the CI migration step hangs and the job times out with no error.** Cause: `pg`'s `connectionTimeoutMillis` defaults to `0`, meaning wait forever, and the runner never gave up on an unreachable host. Fix: set it. Ten seconds is generous for a database that is up and immediate for one that is not.

**★ Symptom: the migration script finishes its work and the CI step never exits.** Cause: `pool.end()` was not called, so the open sockets keep the event loop alive. Fix: `finally { await pool.end() }`. This is [15 · 01f](../15-databases-apis-and-full-stack-patterns/01f-websockets-pool-and-the-lifecycle-rule.md)'s lifecycle rule applied to a script rather than a request.

**★ Symptom: a rollback is needed and there is nothing to roll back to.** Cause: migrations are forward-only artefacts and Drizzle does not generate a down migration. Fix: stop planning to roll the schema back and plan to roll the *code* back instead — which is only possible if every migration is backward-compatible with the currently-deployed version. That constraint is the entire subject of [02e](02e-expand-and-contract.md), and it is the reason expand/contract exists.

## Interview questions

**★ Why can the migration runner not use the same connection string as the application?**
Because they need opposite things from the connection. The application wants a transaction-mode pooler, whose entire capacity argument is that it refuses to promise you the same backend twice. A migration runner needs exactly that promise: it reads the ledger, takes a lock, runs DDL and writes the ledger, and those statements must land on one session or the lock protects nothing. Prisma states the requirement plainly for its own engine — the Schema Engine *"is designed to use a single connection to the database, and does not support connection pooling with PgBouncer"* — and the constraint is the protocol's, not that tool's, so drizzle-kit is under it too. Hence two variables. The dangerous part is that pointing the runner at the pooled endpoint does not reliably produce a clean error; it can produce a partially applied migration with a ledger row claiming success, which the next run will skip.

**★ What proves, at deploy time, that the running database matches your schema?**
The ledger, and only the ledger. The schema file is a claim, the generated SQL is an intention, and a green deploy is a report about a process rather than about the database. So the release job counts what the ledger says it has applied and compares it with what the repository ships, and refuses to release on a mismatch. The property that buys you is that a forgotten migration becomes a deploy that does not happen instead of a request that does not work — and the difference between those two is whether the failure lands on an engineer with the context or on a user at 3 a.m.

**★ Why is running migrations at application startup worse in serverless than on a single server?**
Because startup happens many times, concurrently, and at moments you do not choose. A rolling deploy or a traffic spike creates instances in parallel, and each of them runs your startup code, so N instances race to apply the same DDL. The ledger and the runner's advisory lock mostly serialise that, but "mostly" is not a word you want anywhere near DDL, and the failure mode when it does not hold is a half-applied migration under live traffic. Three further problems come free: the instance holds the pooled connection string, which is the connection a migration must not use; the failure surfaces on a user's request rather than in a pipeline; and the `ACCESS EXCLUSIVE` lock DDL takes is now held while a client waits.

**★ Why is `drizzle-kit push` fine locally and forbidden on staging?**
Because it applies a diff without producing a file, so a pushed database has a schema that nothing can reproduce and nothing has recorded. Three things break in increasing order of pain. The next `generate` is wrong, because it diffs against the previous migration folder rather than against the live database, so it emits SQL describing a change from a state the database left long ago. A fresh environment cannot be built, because replaying every migration against an empty database produces a schema missing whatever was pushed — which quietly breaks onboarding, CI and disaster recovery at once. And unlike Prisma, which detects the drift via its shadow database, drizzle-kit never inspects the live database during `generate`, so the divergence is silent and permanent. Against a database you are happy to drop, none of that matters; against one you cannot rebuild, all of it does.

**★ There is no down migration. How do you roll back?**
You roll back the code, not the schema — and that is only possible if every migration was designed to be compatible with the version currently deployed. That is what makes expand/contract a hard requirement rather than a nicety: if a release adds a column and the code that uses it, rolling the code back leaves an unused column, which is harmless. If a release renames a column, rolling the code back leaves the old code looking for a column that no longer exists, and now the only way out is forward. So the answer to "how do you roll back" is decided several days earlier, when someone chose whether the migration was additive. Down migrations are a poor substitute in any case, because they are written speculatively, rarely tested, and cannot undo a data change.

**★ What is `drizzle-kit check` for, and why does it belong on a pull request rather than on the release?**
It walks the generated migrations looking for collisions — two files claiming the same position in the sequence, which is what two branches that each ran `generate` from the same base produce when they merge. It belongs on the pull request because that is where the collision is cheap: one branch regenerates, the diff is small, nobody is deploying. Discovering it on the release job means main is already broken, and the fix has to be made under time pressure by whoever happened to press deploy. It is also a good example of the general shape — the checks worth having are the ones that move a failure earlier, not the ones that describe it better after the fact.

---

← [02b · Constraints as validation](02b-constraints-are-the-first-validation-layer.md) · Next → [02d · The lock a migration actually takes](02d-the-lock-a-migration-actually-takes.md)
