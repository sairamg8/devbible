---
title: "Building the test database with `drizzle-kit push` instead of running the migrations means the constraint names in your test database were invented by a diff engine rather than declared in a migration — and this chapter's entire error mapping is keyed on constraint names"
sidebar_label: "12k · Migrations in the test path"
sidebar_position: 83
description: "push versus generate-and-migrate for a test database and the six things push hides, why DIRECT_URL rather than the pooler, migrating once into a template, the drift check drizzle-kit has no command for, seeding through raw SQL versus through the DAL, and .env.test."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Drizzle Kit · overview](https://orm.drizzle.team/docs/kit-overview) and [Drizzle · Migrations](https://orm.drizzle.team/docs/migrations), the PostgreSQL 18 [`CREATE DATABASE`](https://www.postgresql.org/docs/18/sql-createdatabase.html) reference, and the Next.js guide [How to use environment variables](https://nextjs.org/docs/app/guides/environment-variables) (`lastUpdated: 2026-08-25`). Documentation-verified; **no sandbox run, no timings**.
> Target: `drizzle-kit` **0.31.10** · `drizzle-orm` **0.45.2** · **PostgreSQL 18.4** · **Next.js 16.3.4** · Vitest **5.0.0** · Node **24.20.0**.

**There is a fork at the very start of every database test run and it is usually taken without being noticed: how did this database get its schema? Two commands can produce a table that looks identical, and the difference between them is invisible until something in your application depends on a property of the schema that only one of them produces. In this chapter that dependency is concrete and load-bearing. [05ca](05ca-mapping-sqlstate-to-status-codes.md) maps `23505` to a useful `409 duplicate_title` by looking up `pg.constraint` — the constraint's *name* — in a table you wrote by hand, and those names exist because a migration declared them. A test database built by diffing your schema file against an empty database gets names the diff engine chose. The tests pass, because the constraint fires and the SQLSTATE is right; production returns a generic message, because the name is not the one in the map. This page takes the fork deliberately, lists the six things the fast path hides, and then makes the slow path fast again by migrating once and cloning.**

## The two commands, in the documentation's own words

> *"`drizzle-kit generate` lets you generate SQL migration files based on your Drizzle schema either upon declaration or on subsequent changes"*
>
> *"`drizzle-kit migrate` lets you apply generated SQL migration files to your database"*
>
> *"`drizzle-kit push` lets you push your Drizzle schema to database either upon declaration or on subsequent schema changes"*
>
> *"`drizzle-kit push` pulls current database schema, generates alterations based on diff, and applies migrations to the database directly **without creating SQL files**."*
> — [Drizzle Kit · overview](https://orm.drizzle.team/docs/kit-overview), quoted in [02c](02c-the-migration-is-a-release-step.md)

The Drizzle migrations documentation describes `push` as best for rapid prototyping and test databases, and `generate` plus `migrate` as the path for version-controlled SQL and production deployment. That advice is right in general and the question this page asks is narrower: **for a suite whose subject is a database-backed API, is the test database allowed to differ from the production one?**

## The six things `push` hides

### 1 · Constraint names — and this one breaks a feature

`CONSTRAINT_RULES` in [05ca](05ca-mapping-sqlstate-to-status-codes.md) is keyed on `cards_board_title_unique`, `cards_title_not_blank`, `cards_position_finite`. Those names came from a migration that declared them. A schema pushed by diff produces whatever names the generator derives, and if they differ by a character the lookup misses and every constrained failure degrades to the generic branch — `409 conflict` instead of `409 duplicate_title`, with no `field`, so the client cannot highlight the input.

🔴 **The test suite cannot see this**, because the test database has the pushed names and the code has the migration names only in production. The symptom is a support ticket about a form that no longer highlights the offending field.

### 2 · The migration SQL is never executed by anything

`generate` writes SQL files; those files are what runs against production. If one was hand-edited — which [02e](02e-expand-and-contract.md)'s expand-and-contract work routinely requires — nothing in a `push`-based suite ever runs it. The first execution of that SQL is in production, at deploy time, against real data.

### 3 · Data migrations do not exist in a diff

A backfill — populate `position` for existing rows, normalise `''` bodies to `null` — is a `DML` statement inside a migration file. It has no representation in a schema diff, so `push` skips it entirely and any test that depends on the post-backfill state is testing a state production may never reach.

### 4 · Ordering and the `ALTER TYPE` restrictions

`status` is a `pgEnum`, and [02e](02e-expand-and-contract.md) covers the restrictions on `ALTER TYPE … ADD VALUE`. A diff engine reconciles start and end states; it does not reproduce the ordered sequence of steps a real deployment executes, so any constraint on that ordering is untested.

### 5 · The lock a migration takes

[02d](02d-the-lock-a-migration-actually-takes.md) is entirely about the lock each `ALTER TABLE` form acquires and how to avoid an `ACCESS EXCLUSIVE` hold on a live table. A `push` against an empty test database takes those locks on empty tables in milliseconds and tells you nothing.

### 6 · The migration ledger

`drizzle-kit migrate` *"fetches migration history from the database, picks previously unapplied migrations, and applies new migrations"*, and that history lives in a table — default `__drizzle_migrations__`, configurable via `migrations.table` ([02c](02c-the-migration-is-a-release-step.md)). A `push`-built database has no ledger, so the CI step that asserts the deployed schema is at the expected revision has nothing to read.

## The verdict, and how to keep it fast

🔴 **Build the test database the way production is built: `drizzle-kit migrate`.** Then pay for it once.

```ts
// test/global-setup.ts
export default async function setup({ provide }) {
  const admin = new Client({ connectionString: process.env.ADMIN_URL })
  await admin.connect()

  await admin.query('DROP DATABASE IF EXISTS sprintdesk_template WITH (FORCE)')
  await admin.query('CREATE DATABASE sprintdesk_template')
  await admin.end()                                  // 🔴 close BEFORE migrating

  await runMigrations(urlFor('sprintdesk_template')) // drizzle-kit migrate, own client,
                                                     // and it closes its own pool
  await cloneTemplateForEachWorker()                 // 12g — CREATE DATABASE … TEMPLATE
  provide('workerDbPrefix', 'sprintdesk_w')
}
```

The migrations run **once per suite**, into a template, and each worker gets a clone — which the manual's *"no other sessions can be connected to the source database while it is being copied"* rule makes conditional on every migration client being closed first ([12g](12g-truncate-templates-and-schema-per-worker.md)). The result is production's exact DDL, at the cost of one migration run for the whole suite.

⚠️ **`push` is still right for one thing: the inner development loop.** Iterating on a schema locally with throwaway data is what the documentation recommends it for and what [02c](02c-the-migration-is-a-release-step.md) reserves it for. The rule is that the *suite* never uses it, because the suite's job is to be evidence about production.

## `DIRECT_URL`, not the pooler

`drizzle.config.ts` points at `DIRECT_URL` for exactly the reason [02c](02c-the-migration-is-a-release-step.md) sets out — the migration runner needs a single session it keeps, and a transaction-mode pooler does not promise one. The test harness inherits this requirement whole: the same command, the same constraint.

```ts
// drizzle.config.ts — unchanged for tests, only the value of DIRECT_URL changes
export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DIRECT_URL! },   // NOT DATABASE_URL
})
```

And the environment the runner reads is `.env.test`, which Next.js loads for `NODE_ENV=test`:

> *"There is a small difference between `test` environment, and both `development` and `production` that you need to bear in mind: `.env.local` won't be loaded, as you expect tests to produce the same results for everyone."*
> — [Next.js · Environment variables](https://nextjs.org/docs/app/guides/environment-variables)

The load order in the same document lists `.env.local` as *"(Not checked when `NODE_ENV` is `test`.)"* — so a `DATABASE_URL` sitting in your `.env.local` is invisible to the suite, which is the intended behaviour and also a good way to be confused for twenty minutes. `.env.test` is committed; `.env.test.local` is not. Loading it into a runner needs `loadEnvConfig` from `@next/env`, which [ch13 · 3e](../13-testing-and-developer-experience/03e-env-schemas-and-contract-tests.md) covers in full.

🔴 **Add the guard from [02c](02c-the-migration-is-a-release-step.md) to the test path too.** A test run whose `DIRECT_URL` is unset falls back to `pg`'s environment defaults — `PGHOST`, `PGDATABASE` — and will connect *somewhere*. A suite that resets by truncating and connects somewhere unintended is a data-loss incident, not a failing test.

```ts
// test/global-setup.ts, first lines
const url = process.env.DIRECT_URL
if (!url) throw new Error('DIRECT_URL is not set — refusing to run the database suite')
if (!/(_test|_template|_w\d+)$/.test(new URL(url).pathname.slice(1))) {
  throw new Error(`refusing to run destructive setup against ${url}`)
}
```

## The drift check drizzle-kit has no command for

The failure that outlives everything above: the schema file and the migration folder disagree. Someone edited `db/schema.ts`, ran `push` locally, and never generated the migration. The application's types are right, the local database is right, and production will be missing a column.

[02c](02c-the-migration-is-a-release-step.md) already establishes that **`drizzle-kit` has no `migrate status` command of its own**, so the assertion is built rather than invoked. Two pieces, and both belong in CI:

```yaml
- run: yarn drizzle-kit check       # collisions between migrations merged from two branches
- run: yarn db:drift                # schema file vs migration folder
```

`drizzle-kit check` is documented as walking *"through all generate migrations and check for any race conditions(collisions) of generated migrations"* — the two-branches-both-ran-generate case. It does not answer the drift question.

For drift, generate into a scratch directory and assert nothing new appeared:

```jsonc
// package.json
"db:drift": "drizzle-kit generate --out ./.drift && node scripts/assert-no-new-migration.mjs"
```

```js
// scripts/assert-no-new-migration.mjs — pseudo-code for the comparison, real for the check
import { readdirSync, rmSync } from 'node:fs'
const committed = readdirSync('./drizzle').filter((f) => f.endsWith('.sql')).length
const scratch = readdirSync('./.drift').filter((f) => f.endsWith('.sql')).length
rmSync('./.drift', { recursive: true, force: true })
if (scratch > committed) {
  throw new Error('db/schema.ts has changes with no generated migration — run db:generate')
}
```

⚠️ **I could not confirm that `drizzle-kit generate` writes a fresh journal into an arbitrary `--out` directory in the way this comparison assumes**, and the behaviour differs depending on whether the scratch directory starts empty or is a copy of `./drizzle`. Treat the script above as the shape of the check rather than as a recipe, verify it against your own `drizzle-kit` **0.31.10** before trusting it, and if it proves unreliable, fall back on the CI step [02c](02c-the-migration-is-a-release-step.md) already prescribes: query the migration ledger after deploy and assert the applied revision matches the newest committed file.

## Testing a migration itself

Distinct from testing *with* migrations, and it applies to exactly one category: a migration with a backfill.

The obvious approach — create a database at revision N−1, seed old-shaped data, run migration N, assert the new shape — needs a way to apply migrations up to a chosen revision. ⚠️ **I did not find documentation for a "migrate to revision X" option on `drizzle-kit migrate` or on the programmatic `migrate()` from `drizzle-orm/<driver>/migrator`.** The documented behaviour is that it applies all previously unapplied migrations. Do not assume a target flag exists.

What works without one:

**Extract the backfill and test it as SQL.** The `UPDATE` that populates `position` for pre-existing rows is a statement. Seed rows in the old shape, execute that exact statement — read from the migration file, not retyped — and assert the result. This tests the thing that can be wrong (the data transformation) without needing partial migration support.

```ts
it('the position backfill assigns a distinct, finite position per board', async () => {
  await seedRowsWithNullPosition(board.id, 5)
  const sql = readFileSync('drizzle/0007_backfill_position.sql', 'utf8')
  await db.execute(sql)                       // the file, not a copy of it
  const rows = await db.select().from(cards).where(eq(cards.boardId, board.id))
  expect(new Set(rows.map((r) => r.position)).size).toBe(5)
  expect(rows.every((r) => Number.isFinite(r.position))).toBe(true)
})
```

Reading the statement from the file rather than retyping it is the load-bearing detail: a retyped copy tests a string in the test file, and drifts silently from the migration the moment either is edited.

## Seeding: raw SQL or the DAL?

A last decision the harness has to make, and it has a clean rule.

**Seed with raw inserts by default.** A fixture built by calling `createCard` makes every test depend on the create path — so a bug in `createCard` fails the entire suite, including tests about reading and deleting, and the failure report points everywhere at once. Raw inserts also let you construct states the API cannot produce, which is exactly what you need for the interesting cases: a soft-deleted card, a card at `version` 40, two cards with an identical `position`, a row with a `NaN` position.

**Except when the create path is the subject.** A test of `POST` semantics, of the `Location` header, of the idempotency record, or of the sparse-position computation must go through the real function — that is the code under test.

```ts
// test/support/seed.ts — raw, fast, and able to build states the API forbids
export async function seedCard(boardId: string, over: Partial<Card> = {}) {
  const [row] = await db.insert(cards).values({
    boardId, title: 'seeded', status: 'todo', position: 1, version: 1, ...over,
  }).returning()
  return row
}
```

⚠️ **A raw seed bypasses your Zod schemas, not your constraints.** That is the right split: the database still refuses an invalid state, so a fixture that would violate a `CHECK` fails loudly at seed time — which is a useful signal that your test was about to assert something impossible.

## Gotchas

**★ Symptom: a duplicate title returns a generic `409 conflict` in production and `409 duplicate_title` in tests.** Cause: the test database was built with `push`, so its constraint names came from a diff rather than from the migration, and the production name is not a key in `CONSTRAINT_RULES`. Fix: build the test database with `drizzle-kit migrate`. This is the single most consequential item on the list because it silently disables a user-facing feature that the suite reports as working.

**★ Symptom: a migration failed on the first production deploy after passing CI.** Cause: nothing ever executed the migration SQL — `push` reconciles the schema file directly and never opens the files. Fix: migrate the test database. The suite's setup then becomes the rehearsal, and a broken migration file fails the build rather than the deploy.

**★ Symptom: a backfill assertion passes and production rows are still null.** Cause: the backfill is `DML` inside a migration file and has no representation in a schema diff, so `push` skipped it. Fix: migrate, and additionally test the backfill statement directly by reading it from the file.

**★ Symptom: global setup fails with a connection-in-use error on the template.** Cause: the migration client is still open when the first `CREATE DATABASE … TEMPLATE` runs. Fix: the migration runs in a function that owns and closes its own client, and the admin client is closed before it starts.

**★ Symptom: a suite truncated the developer's local application database.** Cause: `DIRECT_URL` was unset or pointed at the dev database, and `pg` happily fell back to environment defaults. Fix: refuse to run unless the URL is set *and* the database name matches the test naming convention. This guard costs four lines and prevents an unrecoverable afternoon.

**★ Symptom: the suite reads a different database than expected and nothing explains why.** Cause: the value is in `.env.local`, which Next.js documents as not being loaded when `NODE_ENV` is `test`. Fix: put test values in the committed `.env.test`, secrets in `.env.test.local`, and load them with `loadEnvConfig` so the runner resolves them the same way the framework does.

**★ Symptom: two branches merged and the migration folder is inconsistent.** Cause: both ran `generate` independently, producing colliding entries. Fix: `drizzle-kit check` in CI, which is documented as detecting exactly that collision, and which is cheap enough to run on every pull request.

**★ Symptom: production is missing a column that exists in `db/schema.ts`.** Cause: a developer ran `push` locally and never generated the migration; nothing in the pipeline compares the schema file to the migration folder. Fix: a drift step in CI. `drizzle-kit` has no command that answers this, so it is built — and if the generate-into-a-scratch-folder approach proves unreliable on your version, assert against the migration ledger after deploy instead.

**★ Symptom: one bug in `createCard` failed ninety tests across every layer.** Cause: every fixture was built by calling the API's own create path. Fix: seed with raw inserts, so a create bug fails the create tests only and the failure report points at one place. Keep the DAL path for tests whose subject *is* creation.

**★ Symptom: a test needs a card with two identical positions and cannot produce one.** Cause: the seed goes through `createCard`, which computes positions and will not produce a collision. Fix: raw inserts. Being able to construct states the API forbids is the main practical argument for raw seeding, and those states are where the interesting assertions live.

## Interview questions

**★ Why is `drizzle-kit push` the wrong way to build a test database for this application specifically?**
Because this application reads constraint *names* at runtime. The SQLSTATE-to-status mapping looks up `pg.constraint` in a hand-written table to turn `23505` into `duplicate_title` with a `field`, and those names exist because a migration declared them. A pushed schema gets names chosen by the diff engine, so the test database and the production database disagree about a value the application depends on — and the disagreement is invisible to the suite, since the constraint still fires and the SQLSTATE is still `23505`. The feature that breaks is a user-facing one, and every test says it works.

**★ Migrating a test database is slower than pushing it. How do you get both?**
Migrate once into a template database at global setup, then clone it per worker with `CREATE DATABASE … TEMPLATE`. The migration cost is paid once for the whole run rather than once per worker or once per file, and every worker gets the exact DDL production will get. The precondition is that no session is connected to the template when the clone starts, so the migration client must be closed explicitly before the first clone — that is the step teams miss, and it presents as an intermittent setup failure rather than as a mistake.

**★ What does a `push`-built test database fail to exercise, beyond constraint names?**
The migration SQL itself, which is never opened, so a hand-edited migration is first executed in production. Data migrations, which have no representation in a schema diff and are skipped entirely. The ordered sequence of an expand-and-contract change, since a diff reconciles endpoints rather than replaying steps. The locks each `ALTER TABLE` form takes, which are meaningless against empty tables. And the migration ledger, so the deploy-time assertion that the schema is at the expected revision has nothing to read.

**★ How do you test a migration that contains a backfill, given no documented way to migrate to a specific revision?**
Test the backfill statement rather than the migration sequence. Seed rows in the old shape with raw inserts, read the exact statement from the migration file, execute it, and assert the resulting data. Reading it from the file rather than retyping it is essential — a retyped copy is a string in a test file that drifts from the migration the first time either is edited. That covers the part that can actually be wrong, which is the data transformation, without depending on partial-migration support that the tooling does not document.

**★ Should test fixtures be created through the Data Access Layer or with raw inserts, and why?**
Raw inserts by default, for two reasons. First, blast radius: a fixture built by calling `createCard` makes every test in the suite depend on the create path, so one bug there fails read tests, delete tests and pagination tests simultaneously and the report points nowhere useful. Second, reachability: the interesting states are the ones the API refuses to produce — a soft-deleted card, two cards at an identical position, a version far ahead of one — and raw inserts can build them. The exception is any test whose subject is the write path itself, which must go through the real function because that function is what is being tested.

**★ Why does the test harness point `drizzle-kit` at `DIRECT_URL`, and what guard belongs next to it?**
Because the migration runner needs a single kept session and a transaction-mode pooler does not promise consecutive statements land on the same one — the same constraint that governs migrations in the deployment pipeline. The guard next to it is a refusal: if `DIRECT_URL` is unset, `pg` falls back to `PGHOST`/`PGDATABASE` environment defaults and connects somewhere, and a harness that resets by truncating will then destroy whatever it found. Assert the variable is present and that the database name matches the test convention before any destructive statement runs.

---

← [12j · Retry loop and idempotency](12j-testing-the-retry-loop-and-the-idempotency-key.md) · [Chapter index](01-explanation.md) · Next → **13 · Project milestone** *(not written yet)*
