---
title: "\\i and \\ir — including SQL files"
sidebar_label: "11 · \\i and \\ir"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **psql 18.4**. Script: `sandbox/pg-api/ex32-psql-io.sh`.

**`\i` resolves paths against the directory you ran psql from. `\ir` resolves them against
the file doing the including. One letter decides whether your seed script works from
anywhere or only from the one directory you happened to test in.**

## The difference, measured

```console
$ ./ex32-psql-io.sh
=== 11. \i uses a path relative to the CWD; \ir relative to the script ===
--- run from /tmp/p1_work (both work) ---
outer using i:
      msg
---------------
 inner.sql ran
(1 row)

outer using ir:
      msg
---------------
 inner.sql ran
(1 row)

--- run from / (only \ir works) ---
outer using i:
psql:/tmp/p1_work/outer_i.sql:2: error: sub/inner.sql: No such file or directory
outer using ir:
      msg
---------------
 inner.sql ran
(1 row)
```

Identical files, identical `sub/inner.sql` path. Run from the script's own directory both
work; run from anywhere else **`\i` breaks and `\ir` does not.**

```sql
-- outer.sql, which lives in /tmp/p1_work
\i  sub/inner.sql     -- looked up as $CWD/sub/inner.sql
\ir sub/inner.sql     -- looked up as /tmp/p1_work/sub/inner.sql
```

**Use `\ir` for anything a file includes.** The only reason to use `\i` is when the path is
deliberately relative to wherever the operator is standing — which is rare, and usually
accidental.

`\ir` nests correctly: a file included by an included file resolves against *its own*
directory, so a tree of seed scripts can be reorganised without rewriting paths.

## Building a seed script

```
db/
├── seed.sql
└── seed/
    ├── 01-schema.sql
    ├── 02-reference-data.sql
    └── 03-demo-users.sql
```

```sql
-- db/seed.sql
\set ON_ERROR_STOP on
\echo '=== seeding' :DBNAME '==='

\ir seed/01-schema.sql
\ir seed/02-reference-data.sql
\ir seed/03-demo-users.sql

\echo '=== done ==='
```

```bash
psql -X -v ON_ERROR_STOP=1 --single-transaction -f db/seed.sql
```

Notes that matter:

- **`ON_ERROR_STOP` applies across includes.** An error inside `02-reference-data.sql`
  stops the whole run — which is what you want, and is not the default
  ([measured](06-scripting.md)).
- **`--single-transaction` wraps every file together**, so a failure in the third leaves
  nothing from the first two.
- **`-X`** so the operator's `.psqlrc` cannot change behaviour.

## Making a script report its own progress

```sql
\timing on
\echo 'loading reference data...'
\ir seed/02-reference-data.sql
\echo '  ' :ROW_COUNT 'rows'
```

`\echo` writes to stdout, `\warn` to stderr — which is the one to use for messages that
should survive a redirect of stdout to a file. With `-q` set, `\echo` output is the only
thing in your log, which is usually the readable choice for long seeds.

## Conditional includes

```sql
SELECT to_regclass('public.p1_orders') IS NULL AS needs_schema
\gset

\if :needs_schema
  \echo 'creating schema'
  \ir seed/01-schema.sql
\else
  \echo 'schema already present'
\endif
```

`to_regclass()` returns `NULL` rather than raising when the table does not exist, which
makes it the right existence test. Combined with [`\gset`](07-query-buffer.md) and
`\if`, a seed script can be safely re-runnable.

## Where this stops being enough

`\i`/`\ir` give you file composition and nothing else — no ordering guarantees beyond the
order you write, no record of what has already run, no checksums, no down migrations. That
is fine for **seed data and local development**, and not fine for schema migrations against
an environment you cannot recreate.

The line to draw: **if losing the database is an inconvenience, psql includes are enough.
If it is an incident, use a migration runner** that records applied versions in a table.
See [migrations from Node](../phase-8-schema-from-node/02-migrations.md) and
[a minimal runner](../phase-8-schema-from-node/08-minimal-runner.md).

## Trade-off

**Include files buy composition without adding a dependency, and stop exactly where state
tracking begins.** A tree of `\ir` files is transparent, diffable, and runs anywhere psql
runs — no runtime, no config, no npm install. What it cannot do is know what it already
did, which means every run must be either destructive (drop and recreate) or written
idempotently by hand. Local development and test fixtures suit the first; production
schema does not suit either.

## Gotchas

**Symptom:** `No such file or directory` when running a script from a different directory
**Cause:** `\i` resolves against the current working directory
**Fix:** `\ir`, which resolves against the including file

**Symptom:** A seed script works locally and fails in CI
**Cause:** CI runs from the repository root, not the script's directory
**Fix:** `\ir` throughout, and `-f` with a full path

**Symptom:** An error in an included file did not stop the run
**Cause:** `ON_ERROR_STOP` was not set — psql continues by default
**Fix:** `-v ON_ERROR_STOP=1`

**Symptom:** Half the seed applied after a failure
**Cause:** Each statement committed separately
**Fix:** `--single-transaction` around the whole entry file

**Symptom:** Re-running the seed fails on duplicate keys
**Cause:** Includes have no memory of previous runs
**Fix:** Write idempotently (`ON CONFLICT DO NOTHING`, `IF NOT EXISTS`), or drop and recreate

**Symptom:** Progress messages vanish when stdout is redirected
**Cause:** `\echo` writes to stdout
**Fix:** `\warn` for messages that must reach the terminal

## Interview questions

**★ What is the difference between `\i` and `\ir`?**
`\i` resolves the path against the current working directory; `\ir` against the directory
of the file containing it. Measured: run from `/`, the `\i` version failed with `No such
file or directory` while `\ir` worked.

**★ Which should a seed script use?**
`\ir` — it makes the script runnable from any directory, and nests correctly through
several levels of includes.

**★ How do you make a multi-file seed atomic?**
`--single-transaction` plus `-v ON_ERROR_STOP=1` on the entry file. Both apply across all
included files.

**★ How do you make an included script re-runnable?**
Test for existing state with `to_regclass()` or a `SELECT … \gset`, branch with
`\if … \endif`, and write the DML idempotently.

**★ When do psql includes stop being appropriate?**
When you need to know what has already been applied. They have no version tracking, no
checksums and no rollback — that is a migration runner's job.

**Why `\warn` instead of `\echo`?**
`\echo` goes to stdout, so it disappears into a redirect. `\warn` goes to stderr and stays
visible.

**Does `ON_ERROR_STOP` apply inside included files?**
Yes — it is a session setting, so it governs the whole run including every `\ir`.

---

← [\timing and \watch](10-timing-watch.md) · Next → [\conninfo \du \dp](12-who-and-privileges.md)
