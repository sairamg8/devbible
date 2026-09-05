---
title: "A migration is the only thing that makes your database agree with your schema file — and the difference between Prisma Migrate and drizzle-kit is not the SQL they emit, it is how much they check before they emit it"
sidebar_label: "01i · Migrations in each"
sidebar_position: 112
description: "The generate-then-apply shape both tools share, codebase-first versus database-first, and Prisma's shadow database — a temporary second database that exists to catch drift and data loss before you deploy them."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Prisma ORM v7 documentation — [Prisma Migrate](https://www.prisma.io/docs/orm/v7/prisma-migrate), [Shadow database](https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/shadow-database), [PgBouncer](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/pgbouncer) — and the Drizzle ORM documentation — [Migrations](https://orm.drizzle.team/docs/migrations), [`llms-full.txt`](https://orm.drizzle.team/llms-full.txt).
> Documentation-verified; **no sandbox run**.
> Target: **Prisma 7.10.0** · **`drizzle-kit` 0.31.10** (`drizzle-orm` 0.45.2) · PostgreSQL 18.4 · Next.js 16.3.4.

**[01hb](01hb-generated-types-and-inferred-types.md) ended on a ceiling: both tools type your code against the schema *file*, and neither knows anything about the database that is running. This page is the part that closes that gap, and it is the reason the gap is closeable at all. Prisma Migrate and drizzle-kit have the same two-step shape — diff the schema to produce a SQL file, then apply unapplied files against a ledger the database itself keeps — so the interesting differences are not in the SQL. They are in what each tool checks before it hands you that SQL, and in the prototyping shortcut both of them ship, which is the single most reliable way to end up with a production schema no migration can reproduce.**

## The shape both tools share

Prisma states the job plainly:

> *"Prisma Migrate enables you to: Keep your database schema in sync with your Prisma schema as it evolves"* and *"Maintain existing data in your database"*
> *"Prisma Migrate generates a history of `.sql` migration files, and plays a role in both development and production"*
> — [Prisma · Prisma Migrate](https://www.prisma.io/docs/orm/v7/prisma-migrate)

drizzle-kit describes the same two steps as two commands:

> *"`drizzle-kit generate` reads previous migration folders, finds the diff between current and previous schema, prompts for renames if necessary, then generates SQL migration files."*
> *"`drizzle-kit migrate` reads migration.sql files, fetches migration history from the database, picks previously unapplied migrations, and applies new migrations to the database."*
> — [Drizzle · Migrations](https://orm.drizzle.team/docs/migrations)

Read those two `drizzle-kit` sentences carefully, because between them they name every moving part that exists in either tool:

1. **A diff.** The new schema against the last known schema — not against the live database.
2. **A file.** SQL, on disk, in version control, reviewable.
3. **A history in the database.** A ledger table recording which files have run.
4. **An apply step** that consults the ledger and runs only what is missing.

Both tools do all four. Neither invented any of it, and any migration tool that omits one of the four is not a migration tool.

| | Prisma Migrate 7 | drizzle-kit 0.31.10 |
|---|---|---|
| Produce a migration | `prisma migrate dev` | `drizzle-kit generate` |
| Apply pending migrations | `prisma migrate deploy` | `drizzle-kit migrate` |
| Prototyping shortcut, no file | `prisma db push` | `drizzle-kit push` |
| Introspect an existing database | `prisma db pull` | `drizzle-kit pull` |
| Emit SQL for another tool | — | `drizzle-kit export` |
| Start over | `prisma migrate reset` | delete the folder and the ledger by hand |
| Pre-flight checking | **a shadow database** | none |

The last row is the one that matters, and the rest of this page is largely about it.

### Are the SQL files yours to edit?

In Prisma, yes — the documentation describes the approach as having both declarative and imperative elements, with the SQL files *"fully customizable"*. That is more important than it sounds: it is what lets you turn a generated `DROP COLUMN` into a three-step expand-migrate-contract by hand, which is the only safe way to remove a column from a system that is still serving traffic.

drizzle-kit's `generate` writes ordinary `.sql` files too, and the same editing freedom applies. The practical difference is that Prisma's `migrate dev` will notice you edited history and complain; drizzle-kit's ledger is checksum-based in the same spirit. In both, **editing an already-applied migration is the mistake** — edit the one you have not applied yet, or write a new one.

## Codebase-first and database-first

Drizzle names the two postures directly, and the vocabulary is worth adopting whichever tool you use:

> *"**Codebase first** means database schema in your TypeScript codebase is a source of truth and is under version control. You declare and manage your database schema in JavaScript/TypeScript and then you apply that schema to the database."*

> *"**Database first** means your database schema is a source of truth. You manage your database schema either directly on the database or via database migration tools and then you pull your database schema to your codebase."*

`drizzle-kit pull` is the database-first direction — it *"retrieves the current database schema and generates a TypeScript Drizzle schema file from it"* — and `prisma db pull` is Prisma's counterpart.

🔴 **Pick one and mean it.** The failure mode is not choosing wrongly; it is choosing both, which happens by accident far more often than by decision. A team that is codebase-first except when someone runs a quick `ALTER TABLE` in a console has neither posture: the schema file no longer describes the database, and the next generated migration diffs against a file that is already wrong. Everything on the rest of this page is a way of noticing that has happened.

There is also a third posture that is not on Drizzle's list and is common in practice: **the database is owned by someone else.** A read replica, a shared reporting warehouse, a table another service writes. There, database-first is not a preference — it is the only correct posture, and both tools' `pull` commands are how you keep up rather than how you started.

## The shadow database, which is Prisma's real differentiator

This is the largest genuine capability gap between the two tools, and most comparisons do not mention it at all.

> *"The shadow database is a second, *temporary* database that is **created and deleted automatically**"*
> *"primarily used to **detect problems** such as schema drift or potential data loss"*
> — [Prisma · Shadow database](https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/shadow-database)

Two jobs, and they are different jobs:

**Detect schema drift** — *"checking that no **unexpected changes** have been made"*. Prisma replays your migration history into an empty database and compares the result with your actual development database. If they differ, something changed your database outside the migration history: a manual `ALTER TABLE`, an abandoned `db push`, a colleague's hotfix. That is precisely the "chose both postures by accident" failure above, and the shadow database is the only thing in either toolchain that catches it automatically.

**Evaluate data loss** — *"evaluate if those could lead to **data loss** when applied"*. A generated migration that drops a column or narrows a type is flagged before you run it, rather than after.

Three operational facts about it, all load-bearing:

> *"The shadow database is *only* required in a development environment (specifically for the `prisma migrate dev` command)"*
> *"The shadow database is **not** required in production, and is not used by production-focused commands"*

So it costs you nothing at deploy time, and `migrate deploy` neither needs it nor creates one.

> *"Database user must have `CREATE, ALTER, DROP, REFERENCES ON *.*` privileges"*

Which is why it frequently fails on managed and serverless Postgres: the connection you were given may not be permitted to create a database at all. When it cannot be created automatically, you point Prisma at one you made yourself:

> *"Configure the `shadowDatabaseUrl` field in `prisma.config.ts` under the `datasource` object"*

⚠️ **And the warning that comes with it, verbatim:**

> *"Do not use the exact same values for `url` and `shadowDatabaseUrl` as that might delete all the data"*

Read that as what it is: the shadow database is **reset** as part of its job. Pointing `shadowDatabaseUrl` at your development database — or, unthinkably but not impossibly, your production one — is not a misconfiguration that produces an error. It is a configuration that works exactly as designed and destroys the data.

```ts
// prisma.config.ts — the two URLs from 01ga, plus the third
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  datasource: {
    url: env("DIRECT_URL"),                    // CLI commands need a session — see 01ga
    shadowDatabaseUrl: env("SHADOW_DATABASE_URL"),  // a DIFFERENT, disposable database
  },
});
```

**drizzle-kit has no equivalent.** Its `generate` diffs your schema against the previous migration folder, which means it can tell you what changed in *your files* and cannot tell you what changed in *your database*. Drift is invisible to it. That is not a bug — it is the consequence of a design with fewer moving parts — but it means drift detection is a thing you have to do yourself, and [01ia](01ia-push-pooling-and-proving-the-migration-ran.md) covers how.

## Two ledgers, doing the same job

Both tools keep a table in your database recording which migrations have run. Prisma's is `_prisma_migrations`; drizzle-kit's lives in its own migrations schema. The details differ and the contract does not: `migrate deploy` and `drizzle-kit migrate` both *"fetch migration history from the database"* and apply only what is missing, which is what makes them safe to run on every deploy, including deploys that changed nothing.

🔴 **The ledger is in the database, not in your repository, and that is the whole point.** It is the only artifact that knows what a *particular* database has actually had done to it. Your repository knows what migrations exist; only the ledger knows which of them this database has seen. Every question worth asking at deploy time — is this database current, is it ahead of this build, has someone applied something by hand — is a question about the ledger.

## Gotchas

**★ Symptom: `migrate dev` fails complaining it cannot create the shadow database.** Cause: the database user lacks the privileges the shadow database needs — *"`CREATE, ALTER, DROP, REFERENCES ON *.*`"* — which is normal on managed and serverless Postgres, where you are given a database rather than a server. Fix: create a disposable database yourself and name it explicitly, never reusing an existing one:

```ts
datasource: {
  url: env("DIRECT_URL"),
  shadowDatabaseUrl: env("SHADOW_DATABASE_URL"),  // its own empty database
}
```

**★ Symptom: development data disappeared after running `migrate dev`.** Cause: `shadowDatabaseUrl` pointed at a database with data in it. The shadow database is reset as part of its job, and the documentation says so — *"Do not use the exact same values for `url` and `shadowDatabaseUrl` as that might delete all the data"*. Fix: a dedicated, empty, disposable database, and treat any environment variable named `SHADOW_*` as one that will be wiped. Never derive it from the main URL by string manipulation in a script.

**★ Symptom: `migrate dev` reports drift and nobody knows what changed the database.** Cause: something ran outside the migration history — a manual `ALTER TABLE`, an abandoned `db push`, or a restored backup taken at a different migration point. That is the shadow database doing exactly what it exists for. Fix: find the difference before you resolve it. `prisma migrate diff` between your migration history and the live database names the drift; then either fold it into a real migration or revert it. Resetting to make the message go away discards whatever was actually there.

**★ Symptom: a generated migration is about to drop a column and nobody noticed until it ran.** Cause: it was applied without reading it. Prisma will flag the destructive change during `migrate dev`, but the file is applied by `migrate deploy` without asking anything. Fix: review the SQL as code, because it *is* code — and for a column removal in a live system, edit the generated migration into the three-step form rather than shipping the single `DROP`:

```sql
-- migration 1: stop writing it (deploy the code first, then this)
ALTER TABLE boards ALTER COLUMN legacy_slug DROP NOT NULL;
-- migration 2, a release later: nothing reads it any more
ALTER TABLE boards DROP COLUMN legacy_slug;
```

**★ Symptom: two developers generate migrations on the same day and the second one's file is a no-op or a conflict.** Cause: `generate` diffs against the previous migration folder, so a colleague's unmerged migration is invisible to it, and both diffs start from the same ancestor. Fix: rebase before generating, never after — regenerate the migration on top of `main` rather than trying to merge two `.sql` files, which is a merge no tool can help you with.

**★ Symptom: a migration was edited to fix a typo and now every environment disagrees about whether it ran.** Cause: the ledger records a checksum of the file it applied; changing an applied migration makes the recorded history and the repository describe different things. Fix: never edit an applied migration. Write a new one that corrects the mistake — the history is a log of what happened, not a description of what you wish had happened.

**★ Symptom: the schema file and the database agree in development and differ in production.** Cause: the two environments are at different points in the migration history, which is normal between deploys and a defect when it persists. Fix: query the ledger rather than reasoning about it, and make it a deploy gate — the mechanics are in [01ia](01ia-push-pooling-and-proving-the-migration-ran.md).

**★ Symptom: `drizzle-kit generate` produces a migration that renames nothing and instead drops and recreates a column, losing its data.** Cause: a rename and a drop-plus-add look identical in a diff; `generate` *"prompts for renames if necessary"*, and the prompt was answered wrongly or skipped in a non-interactive shell. Fix: run `generate` interactively and answer the rename prompt, then read the emitted SQL before committing it. In CI, generate is the wrong command to be running at all — CI applies migrations, it does not author them.

## Interview questions

**★ Why can neither Prisma's nor Drizzle's type system replace a migration?**
Because types are derived from the schema file and a migration is what makes the database match that file. The compiler has never connected to your database and cannot: it sees a declaration that says a column is `NOT NULL`, not a table that enforces it. This is the ceiling [01hb](01hb-generated-types-and-inferred-types.md) describes, and the migration is the only thing on either side of it that can move.

**★ What is the shadow database for, and why is it not needed in production?**
It is *"a second, temporary database that is created and deleted automatically"* used to *"detect problems such as schema drift or potential data loss"*. Prisma replays the migration history into it and compares, which catches changes made to your database outside the history and warns about destructive operations before you apply them. It is not needed in production because production applies migrations that have already been generated and reviewed — the checking happens at authoring time, which is why it is *"only required in a development environment"*.

**★ What is schema drift, and which of these two tools can detect it?**
Drift is a difference between what your migration history says the database should be and what it actually is — caused by a manual `ALTER TABLE`, an abandoned `db push`, or a restore from a backup at another point in the history. Prisma detects it via the shadow database. drizzle-kit cannot, because `generate` diffs your schema against your previous migration folder and never looks at the live database, so drift detection there is something you build yourself.

**★ Why is `shadowDatabaseUrl` a dangerous setting?**
Because the shadow database is reset as part of its purpose, so whatever it points at is data you are choosing to lose. The documentation's warning is explicit — *"Do not use the exact same values for `url` and `shadowDatabaseUrl` as that might delete all the data"* — and the failure has no error message, because the tool is doing exactly what it was configured to do. It should point at a dedicated empty database and never be constructed by string-editing another URL.

**★ Why does the migration ledger live in the database rather than in the repository?**
Because the question it answers is about a specific database, not about the codebase. Your repository knows which migrations exist; only the ledger knows which ones *this* database has had applied. That is what makes `migrate deploy` and `drizzle-kit migrate` idempotent and safe on every deploy, and it is what lets you ask a production database whether it is current without trusting anything a build told you.

**★ A colleague wants to fix a typo in a migration that has already run in staging. What do you say?**
That the file is history and history does not get edited. The ledger recorded a checksum of what was applied, so changing the file makes staging and the repository describe different pasts, and every environment thereafter disagrees about whether that migration ran. The correction is a new migration. This is the same reasoning as never rewriting a pushed commit, and for the same reason: other systems have already observed the old version.

**★ Codebase-first or database-first — how do you choose?**
By asking who owns the schema. If your application defines it, codebase-first, with the schema file in version control and every change arriving as a migration. If the database is owned elsewhere — a shared warehouse, another service's tables, a replica — database-first, pulling the schema into your codebase as it changes. The wrong answer is not either of those; it is *both*, which is what you have the moment one person runs an `ALTER TABLE` in a console, and which turns every subsequent generated migration into a diff from a file that is already wrong.

**★ Two developers merge migrations generated the same afternoon. What goes wrong and how do you avoid it?**
Each was generated by diffing against the shared ancestor, so neither accounts for the other, and the second to apply is either a no-op or a conflicting change to the same objects. It is not a merge conflict a tool can resolve, because both files are already-valid SQL. The habit that avoids it is to rebase before generating: take `main`, then run `generate`, so the diff starts from what is really there.

---

← [01hc · Ergonomics, size, when each is wrong](01hc-ergonomics-size-and-when-each-is-wrong.md) · Next → [01ia · `push`, pooling and proving it ran](01ia-push-pooling-and-proving-the-migration-ran.md)
