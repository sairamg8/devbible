---
title: "`push` is the fastest way to a schema no migration can reproduce, migrations need a session your pooler will not give them, and the only honest answer to \"did it run\" comes from the ledger — plus the Prisma 8 rewrite already visible in the docs"
sidebar_label: "01ia · push, pooling, proving it ran"
sidebar_position: 113
description: "Why the prototyping shortcut in both tools creates unreproducible databases, why the migration runner cannot use your pooled connection, how to gate a deploy on the ledger, and what Prisma 8 changes about all of it."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Prisma ORM v7 documentation — [Prisma Migrate](https://www.prisma.io/docs/orm/v7/prisma-migrate), [PgBouncer](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/pgbouncer), [Database connections](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections) — the Drizzle ORM documentation — [Migrations](https://orm.drizzle.team/docs/migrations) — and the currently-published [Prisma Migrate overview](https://www.prisma.io/docs/orm/prisma-migrate), which documents **Prisma 8**.
> Documentation-verified; **no sandbox run**.
> Target: **Prisma 7.10.0** · **`drizzle-kit` 0.31.10** · PostgreSQL 18.4 · Next.js 16.3.4. ⚠️ The Prisma 8 material at the end is explicitly marked as forward-looking.

**[01i](01i-migrations-in-each.md) covered the shape both tools share and the shadow database only one of them has. This page is the operational half: the prototyping command that quietly makes a database unreproducible, the reason your migration runner cannot use the connection string your application uses, and the one check that actually answers "is this database current" — which is the check [01hb](01hb-generated-types-and-inferred-types.md)'s type-safety ceiling was waiting for. It closes with the Prisma 8 migration model, because it is already the published documentation and anyone reading the Prisma docs today is reading it whether they realise it or not.**

## `push` — what it is for, and what it costs

Both tools ship a command that skips the file entirely.

> *"`drizzle-kit push` pulls current database schema, generates alterations based on diff, and applies migrations to the database directly without creating SQL files."*
> — [Drizzle · Migrations](https://orm.drizzle.team/docs/migrations)

Drizzle is explicit about the intended audience: `push` is *"the best approach for rapid prototyping"*, while `generate` + `migrate` is the workflow for *"monolithic applications when you apply database migrations during zero downtime deployment"*. Prisma frames `db push` the same way — *"If you are prototyping"*.

Both are right, and the command is genuinely good at the job it names. On a branch, against a throwaway database, while the schema is changing every ten minutes, writing a migration file per change is pure ceremony.

🔴 **The cost is that a `push`ed database has a schema with no file and no ledger entry — so nothing can reproduce it, and nothing knows it happened.** Three concrete consequences, in increasing order of how much they hurt:

1. **The next `generate` is wrong.** `generate` diffs your schema against the *previous migration folder*, not against the database. Everything you pushed is absent from that folder, so the migration it emits describes a change from a state your database left long ago.
2. **A fresh environment cannot be built.** Run every migration in order against an empty database and you get a schema that is missing whatever was pushed. Onboarding, CI and disaster recovery all produce a database that does not match staging, and the difference is invisible until something queries the missing column.
3. **Prisma will tell you and Drizzle will not.** A pushed change is exactly the drift the shadow database exists to catch ([01i](01i-migrations-in-each.md)), so `migrate dev` reports it. drizzle-kit never looks at the live database during `generate`, so the divergence is silent and permanent.

The rule that follows is narrow and worth stating exactly: **`push` against a database whose contents you are willing to throw away, and never against one you cannot rebuild from migrations.** In practice that means a local database and a personal branch database, and nothing else — not a shared development database, not preview environments, not staging, and obviously not production.

```jsonc
// package.json — make the distinction structural rather than remembered
{
  "scripts": {
    "db:push": "drizzle-kit push",              // local only, throwaway data
    "db:generate": "drizzle-kit generate",      // authoring a migration
    "db:migrate": "drizzle-kit migrate",        // the ONLY one CI and deploys run
    "db:pull": "drizzle-kit pull"
  }
}
```

## Migrations need a session, and your pooler will not give them one

This is the same constraint [01c](01c-transaction-pooling-and-session-state.md) and [01d](01d-prepared-statements-under-a-pooler.md) establish for application queries, arriving in a place people do not expect it. Prisma is direct about it:

> *"Prisma Migrate uses **database transactions** to check out the current state of the database and the migrations table. However, the Schema Engine is designed to use a **single connection to the database**, and does not support connection pooling with PgBouncer."*
> — [Prisma · PgBouncer](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/pgbouncer)

A transaction-mode pooler hands each statement to whichever backend is free, which is precisely the guarantee the Schema Engine needs and cannot get. Hence the two URLs [01ga](01ga-where-the-prisma-instance-lives.md) sets up, and the reason the second one exists at all:

- `DATABASE_URL` — *"Connection URL to your database using PgBouncer."* The application's.
- `DIRECT_URL` — *"Direct connection URL to the database used for Prisma CLI commands."* And *"Prisma CLI commands always read from this configuration."*

**The same is true of drizzle-kit**, for the same protocol reasons rather than by anything special about Prisma: DDL in a transaction, plus a ledger read and write, needs a stable session. Give the migration runner the direct endpoint:

```ts
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DIRECT_URL! },   // NOT the pooled URL
});
```

⚠️ **And it is true of the serverless HTTP driver too, for a different reason.** The one-shot HTTP transport in [01e](01e-the-http-driver-and-one-shot-queries.md) has no session and no interactive transaction, which is fine for a query and wrong for a migration runner. Migrations run from CI or a deploy hook on an ordinary TCP connection, not from a request handler.

🔴 **A migration that appears to succeed against a transaction pooler has not necessarily done what you think.** The failure is not reliably a clean error — it can be a partially-applied migration with a ledger entry claiming success, which is the worst state a schema can be in, because the next run skips it.

## Proving the migration ran

This is the check that closes [01hb](01hb-generated-types-and-inferred-types.md)'s ceiling, and it is the one most deployments do not have.

The types said `title` is `NOT NULL`. Something has to establish that the database agrees, and the only artifact that knows is the ledger. So ask it, at deploy time, and fail the deploy rather than the request:

```bash
npx prisma migrate status --schema ./prisma/schema.prisma
```

That reports where the database is and what is pending. In a deploy pipeline the sequence is fixed and the order is not negotiable:

```yaml
# apply, verify, then release — never release first
- run: npx prisma migrate deploy      # idempotent; applies only what the ledger lacks
- run: npx prisma migrate status      # non-zero if anything is still pending
- run: npm run deploy:app
```

`migrate deploy` is safe to run on every deploy, including deploys that changed nothing, precisely because it consults the ledger and applies only what is missing.

For drizzle-kit the equivalent is `drizzle-kit migrate`, which *"fetches migration history from the database, picks previously unapplied migrations, and applies new migrations"* — same contract, same idempotence. Drizzle also gives you a programmatic runner, which is what you want when the deploy is a container start rather than a CI step:

```ts
// scripts/migrate.ts — run on release, not on every boot of every instance
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DIRECT_URL, max: 1 });
await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
await pool.end();
```

Note `max: 1` and the explicit `pool.end()`. A migration runner wants exactly one connection and wants to give it back — the lifecycle rule from [01f](01f-websockets-pool-and-the-lifecycle-rule.md) applied to a script rather than a request.

🔴 **Do not run migrations from application startup in a serverless deployment.** Every instance would race to apply the same migration, and instances are created concurrently under load. The ledger and the advisory lock the runner takes will mostly save you, but "mostly" is doing heavy work in that sentence, and the failure mode is a deploy that half-applies under traffic. Migrations run once, from one place, as a release step.

### Building the drift check drizzle-kit does not have

Since `generate` never inspects the live database, the check has to come from outside. `drizzle-kit export` is the lever:

> *"`drizzle-kit export` reads your Drizzle schema and outputs SQL representation to console for use with external tools like Atlas."*

Which makes a CI job possible: apply every migration to a scratch database, export the schema, and compare the two. If they differ, someone changed the database outside the history. It is more work than Prisma's shadow database and it produces the same signal, which is the honest summary of the trade — Drizzle has fewer moving parts and you assemble the missing one yourself.

## ⚠️ The Prisma 8 horizon, already in the published docs

Anyone reading `prisma.io/docs/orm/prisma-migrate` today is reading documentation for a **different migration model** from the one this page targets, and it is worth knowing before it surprises you. The published overview says:

> *"A migration is how Prisma 8 changes your database when your contract changes."*

The contract is *"the schema description you author (a `.prisma` file or TypeScript) plus the `contract.json` artifact it compiles to"*. A migration becomes a directory of three files:

| File | Documented as |
|---|---|
| `migration.ts` | *"The file you edit. It describes the schema and data changes as TypeScript function calls."* |
| `ops.json` | *"The file Prisma runs. It contains the compiled migration operations as JSON."* |
| `migration.json` | schema hashes, creation timestamp and migration hash, for history |

and the commands are renamed and expanded — `migration plan`, `migration new`, `migration show`, `migration list`, `migration graph`, `migration check`, `migration status`, `migration log`, `contract emit`, and `db migrate` to *"Apply pending migrations"*.

The design point behind the split is stated plainly, and it is a good one:

> *"Production never executes your TypeScript. It reads the compiled operations, so no application code runs with production credentials."*

⚠️ **Two honest caveats.** The same page lists under what is early: *"Not built yet: a shadow-database rehearsal, and an apply-time check that `ops.json` still matches `migration.ts`."* So the capability [01i](01i-migrations-in-each.md) identifies as Prisma's differentiator is, at the time of writing, not yet present in the successor. And this corpus targets **7.10.0**, where `migrate dev` / `migrate deploy` and the shadow database are what exists — while the `prisma` CLI's npm `latest` tag pointed at `8.0.0-rc.13` on 2026-09-05, which is why [01h](01h-prisma-and-drizzle-as-models.md) insists on pinning the CLI rather than following the tag.

**Nothing on this page needs re-learning for 8** — a diff, a file, a ledger, a session, and a deploy-time check are the four moving parts either way. The names change.

## Gotchas

**★ Symptom: a fresh environment built from migrations is missing columns that exist in staging.** Cause: someone ran `push` against staging. The change has no migration file, so replaying the history cannot produce it. Fix: reconcile once, then close the door — introspect the real schema, generate a migration that captures the difference, and remove `push` from every script that can reach a shared database:

```bash
npx drizzle-kit pull        # bring the real schema into the codebase
npx drizzle-kit generate    # emit the migration that was never written
```

**★ Symptom: `migrate deploy` hangs or fails with a prepared-statement or `SET` error against the pooled endpoint.** Cause: the Schema Engine *"is designed to use a single connection to the database, and does not support connection pooling with PgBouncer"*, and it was handed the pooled URL. Fix: give the CLI the direct endpoint and leave the application on the pooled one — `DIRECT_URL` exists for exactly this, and *"Prisma CLI commands always read from this configuration."*

**★ Symptom: a migration is recorded as applied but the schema change is not there.** Cause: it ran against a transaction-mode pooler, where the DDL and the ledger write reached different backends, so the ledger committed and the change did not. Fix: repair the ledger by hand — this is one of the few legitimate reasons to write to it — then re-run against a direct connection. Prevent it by making the direct URL the only string the migration runner can see, rather than a variable someone can get wrong.

**★ Symptom: a deploy succeeds and the first request 500s on a column that does not exist.** Cause: the application was released before the migration ran, or the migration failed and nothing checked. Fix: order the steps and gate on the ledger, so the pipeline fails instead of production:

```yaml
- run: npx prisma migrate deploy
- run: npx prisma migrate status   # fails the job if anything is still pending
- run: npm run deploy:app
```

**★ Symptom: under a deploy, several instances try to apply the same migration at once.** Cause: migrations are being run from application startup, and a serverless platform starts instances concurrently. Fix: move them to a release step that runs once. If the platform genuinely has no such hook, take an advisory lock explicitly so the race is decided rather than survived:

```sql
SELECT pg_advisory_lock(727204);  -- any constant; released on session end
```

**★ Symptom: `drizzle-kit generate` in CI produces a migration nobody wrote.** Cause: `generate` authors migrations and it was put in the pipeline instead of `migrate`. It will happily emit a file from whatever diff it finds, and in a non-interactive shell it cannot ask the rename question either. Fix: CI applies, it does not author — `drizzle-kit migrate` in the pipeline, `generate` on a developer's machine, and a check that the migrations folder has no uncommitted changes.

**★ Symptom: the migration runner exhausts connections during a deploy.** Cause: it opened a default-sized pool for a workload that needs one connection, on top of the application instances already connected. Fix: `max: 1` and an explicit `end()` — a migration is a script, not a server:

```ts
const pool = new Pool({ connectionString: process.env.DIRECT_URL, max: 1 });
```

**★ Symptom: a Prisma command from the documentation does not exist in your CLI.** Cause: the published Prisma Migrate documentation describes **Prisma 8** — `migration plan`, `contract emit`, `db migrate` — while you have installed 7.10.0, whose commands are `migrate dev`, `migrate deploy`, `migrate reset` and `migrate status`. Fix: read the versioned path (`/docs/orm/v7/...`) for the version you have, and pin the CLI so the answer stays stable.

**★ Symptom: rolling back a migration is impossible when you need it most.** Cause: neither tool generates a down migration, so "roll back" means writing new forward SQL under pressure. Fix: make destructive changes reversible by construction rather than by rollback — expand first, deploy the code that stops using the old shape, contract in a later release ([01i](01i-migrations-in-each.md)). A migration that only adds things never needs a rollback.

## Interview questions

**★ When is `push` the right command, and when is it the beginning of an outage?**
It is right against a database whose contents you are willing to destroy — your local one, a personal branch database — while the schema is still moving. It is the beginning of an outage the moment it touches a database that has to be reproducible, because it produces a schema with no file and no ledger entry, so nothing can rebuild it and the next generated migration diffs from a state that no longer exists. Both projects say as much: `push` is for *"rapid prototyping"*, `generate` plus `migrate` is for deployment.

**★ Why does a migration need a different connection string from the application?**
Because it needs a session and the application's string points at a transaction-mode pooler that cannot provide one. Prisma says the Schema Engine *"is designed to use a single connection to the database, and does not support connection pooling with PgBouncer"*, and the same is true of any runner doing DDL in a transaction alongside a ledger read and write. That is what `DIRECT_URL` is for, and *"Prisma CLI commands always read from this configuration."*

**★ How do you prove, at deploy time, that a database is at the schema your code expects?**
Ask the ledger. `prisma migrate status` or the equivalent query against the migrations table reports what has been applied and what is pending, and a non-zero exit gates the release. It has to be a gate rather than a log line, because the alternative is discovering the answer from a 500 on the first request. This is the check the type system cannot perform, which is why it belongs in the pipeline rather than in the code.

**★ Why must migrations not run from application startup on a serverless platform?**
Because instances are created concurrently, so every instance in a scale-up races to apply the same migration. Advisory locks and the ledger will usually decide that race correctly, but "usually" is not a property you want on a schema change under load, and a half-applied migration with a committed ledger entry is the worst possible outcome because the next run skips it. Migrations run once, from one place, as a release step.

**★ drizzle-kit cannot detect schema drift. How would you build that check?**
Apply the full migration history to a scratch database in CI, then compare the result with the real one. `drizzle-kit export` gives you the SQL representation of your schema for exactly this kind of external comparison, and a diff that is non-empty means someone changed the database outside the history. It is the shadow database's signal, assembled by hand — which is a fair summary of the whole Drizzle trade: fewer moving parts, and you build the ones you need.

**★ Neither tool generates down migrations. Is that a problem?**
Less than it sounds, because down migrations are mostly a fiction under load: a `DROP COLUMN` reversed by an `ADD COLUMN` does not bring the data back. The real answer is to make changes reversible by construction — expand, deploy code that no longer depends on the old shape, contract in a later release. Under that discipline every individual migration is additive and the rollback is a code deploy, which is a thing you can actually do quickly.

**★ What changes in Prisma 8, and how much of this transfers?**
The vocabulary and the file layout, not the model. A migration becomes a directory holding `migration.ts` (*"The file you edit"*), `ops.json` (*"The file Prisma runs"*) and `migration.json`, the commands are renamed around a "contract", and production applies the compiled operations — *"Production never executes your TypeScript"*, which is a real security improvement. The four moving parts are unchanged: a diff, a file, a ledger, and a session to apply it through. Worth noting that the shadow-database rehearsal is listed as not built yet, so the differentiator this topic identifies has not carried over so far.

**★ You inherit a project where staging cannot be rebuilt from migrations. What is the recovery?**
Introspect and reconcile, once. Pull the real schema into the codebase, generate the migration that captures everything the history is missing, verify it produces an identical database on a scratch instance, and commit it. Then remove the ability to repeat the mistake — take `push` out of every shared script, point the runner at the direct URL, and put a ledger check in the deploy. The reconciliation is a day; leaving it is permanent.

---

← [01i · Migrations in each](01i-migrations-in-each.md) · Next → [02 · Hybrid API design](02-hybrid-api-design-route-handlers-and-server-actions-side-by.md)
