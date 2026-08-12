---
title: "CREATE TABLE IF NOT EXISTS, and why it is not a migration system"
sidebar_label: "07 · IF NOT EXISTS"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex2-ddl-edges.mjs`,
> `ex3-advisory-fix.mjs`.

**`IF NOT EXISTS` makes a statement idempotent. It does not make it
concurrency-safe, it does not make it a migration, and it does not check that the
existing table matches the one you are describing.** Three separate gaps, and the
syntax suggests otherwise on all three.

## Gap 1: it is not concurrency-safe

```js
const boot = () => pool.query('CREATE TABLE IF NOT EXISTS race_demo (id int, tag text)');
// 20 connections, 25 rounds
```

```console
$ node ex2-ddl-edges.mjs
=== B. CREATE TABLE IF NOT EXISTS race — 20 connections, 25 rounds ===
succeeded: 272 of 500
  228× 23505 duplicate key value violates unique constraint "pg_type_typname_nsp_index"
```

**228 of 500 failed.** The catalog check and the catalog insert are not one atomic
step, so two sessions can both pass the check and one loses on a system index.

Idempotent means *running it twice in sequence* leaves the same state.
Concurrency-safe means *running it twice at the same time* is also correct.
`IF NOT EXISTS` buys the first only. The full analysis, and the advisory-lock fix
that took the same workload to 500/500, is in
[Startup races and advisory locks](./01-ddl-from-node/03-startup-races.md).

## Gap 2: it does not compare the definition

This is the gap people miss, because it never produces an error.

```sql
CREATE TABLE IF NOT EXISTS users (id bigint PRIMARY KEY, email text);
-- later, someone edits the source to:
CREATE TABLE IF NOT EXISTS users (id bigint PRIMARY KEY, email text, name text NOT NULL);
```

The second statement is a **no-op** on any database where `users` already exists. It
does not add `name`; it does not warn; it reports success. New databases get the
three-column table, existing ones keep two, and the two diverge permanently.

`IF NOT EXISTS` asks "is there a relation with this name?" and nothing else. Not the
columns, not the types, not the constraints, not the indexes. It is a name check.

That is the precise reason it cannot serve as a migration system: **migrations are
about *change*, and `IF NOT EXISTS` is about *absence*.** A schema only ever grows
correctly on a database that did not previously exist, which is to say, on your
laptop and nowhere else. This is a drift generator — see
[Schema drift](13-schema-drift.md).

## Gap 3: there is no record

Nothing anywhere says which version of the schema a database has. You cannot answer
"has this change been applied?" except by inspecting the catalog and comparing it by
eye. A tracking table ([Migrations](02-migrations.md)) exists precisely to make that
question answerable.

## Where it is legitimately useful

The clause is not bad, it is just narrow. Good uses:

- **Bootstrapping the migration tracking table itself.** The chicken-and-egg case:
  the runner cannot read `schema_migrations` before it exists, and there is no
  earlier migration to create it. This is the one place
  [the minimal runner](08-minimal-runner.md) uses it.
- **Test and throwaway fixtures**, where the database is disposable and the schema
  is defined once.
- **`CREATE INDEX IF NOT EXISTS` in a migration you may need to re-run** after a
  partial failure — although with transactional DDL that case is rarer than it
  sounds.
- **`DROP TABLE IF EXISTS`** in teardown scripts, where absence genuinely is the
  only question.

The distinguishing feature: the schema is either disposable, or the statement is
the only thing that will ever define that object.

## The related clauses, and their sharp edges

```sql
ALTER TABLE t ADD COLUMN IF NOT EXISTS note text;      -- same name-only check
CREATE INDEX IF NOT EXISTS t_note_idx ON t (note);     -- name check, not definition
DROP TABLE IF EXISTS t;                                -- fine
```

`ADD COLUMN IF NOT EXISTS` carries the same trap in a sharper form: if the column
exists with a *different type*, the statement is a no-op and you now have a column
your code expects to be `text` and the database says is `integer`. No error, no
warning.

`CREATE INDEX IF NOT EXISTS` compares the index *name*, not its definition. Renaming
the columns in an index definition while keeping the name means the old index
survives and the new definition never applies.

## Trade-off

`IF NOT EXISTS` buys a script you can run twice without an error, for the cost of
never being told when reality differs from your intent. Silence replaces both the
error you wanted and the error you did not.

Migrations invert that: they fail loudly when a database is in an unexpected state,
which is more work up front and the only thing that keeps environments identical.
Use `IF NOT EXISTS` where the database is disposable, and migrations everywhere the
database outlives a single run.

## Gotchas

**Symptom:** `duplicate key value violates unique constraint "pg_type_typname_nsp_index"`
**Cause:** Concurrent `CREATE TABLE IF NOT EXISTS` — measured, 228 of 500 attempts
failed.
**Fix:** `pg_advisory_xact_lock`, or move the DDL into a migration step that runs
once.

**Symptom:** A new column exists on new databases but not on existing ones
**Cause:** `CREATE TABLE IF NOT EXISTS` was edited; it is a no-op wherever the table
already exists.
**Fix:** `ALTER TABLE` in a new migration. Never change an existing `CREATE`
statement and expect it to apply.

**Symptom:** A column has the wrong type and nothing errored
**Cause:** `ADD COLUMN IF NOT EXISTS` matched on name and skipped, despite the type
differing.
**Fix:** A migration with an explicit `ALTER COLUMN … TYPE`, plus a drift check.

**Symptom:** An index change had no effect
**Cause:** `CREATE INDEX IF NOT EXISTS` compares the name, not the definition.
**Fix:** Drop and recreate under a new name in a migration.

**Symptom:** Nobody can say which schema version a database is on
**Cause:** `IF NOT EXISTS` scripts leave no record of what ran.
**Fix:** A `schema_migrations` tracking table.

**Symptom:** Staging works, production fails on a query using a new column
**Cause:** Staging was recreated recently and got the full `CREATE`; production has
existed since before the edit.
**Fix:** Migrations for every change after the first.

## Interview questions

**★ What is the difference between idempotent and concurrency-safe?**
Idempotent: running it twice in sequence leaves the same state. Concurrency-safe:
running it twice simultaneously is also correct. `IF NOT EXISTS` provides the first
only — measured, 228 of 500 concurrent attempts failed with `23505` on a system
index.

**★ Why can't `CREATE TABLE IF NOT EXISTS` replace migrations?**
It checks for a relation with that *name* and nothing else. Editing the statement to
add a column is a silent no-op on every database where the table exists, so new and
existing databases diverge permanently with no error. Migrations express *change*;
`IF NOT EXISTS` expresses *absence*.

**★ Where is `IF NOT EXISTS` the right tool?**
Bootstrapping the migration tracking table (nothing earlier can create it),
disposable test fixtures, and teardown (`DROP … IF EXISTS`). The common thread is
that the schema is disposable or the statement is the sole definition of that object.

**★ What is the trap with `ADD COLUMN IF NOT EXISTS`?**
It matches on column name only. If the column exists with a different type, the
statement silently does nothing and you are left with a type mismatch between the
code's expectation and the database — with no error at any point.

**Why is silence the dangerous part rather than the convenience?**
Because both the error you wanted and the error you did not want are suppressed by
the same clause. A script that cannot fail also cannot tell you that reality has
diverged from your intent.

---

← [Wrapping a migration in `BEGIN`/`COMMIT`](06-tx-migration.md) · Next → [Writing a minimal migration runner](08-minimal-runner.md)
