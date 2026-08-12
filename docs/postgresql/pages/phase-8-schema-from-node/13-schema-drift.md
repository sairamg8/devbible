---
title: "Schema drift"
sidebar_label: "13 · Schema drift"
sidebar_position: 13
---

<span className="db-tier t-know">Should Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex10-migrations.mjs`,
> `ex1-ddl-from-node.mjs`.

**Drift is when the live schema and the schema your code assumes stop matching.
Migrations prevent most of it; a boot-time check catches the rest, and turns a
3 a.m. `42703 column does not exist` into a deploy that refuses to start.**

## Where drift comes from

Migrations make the schema reproducible, so drift means something bypassed them:

- **A manual fix during an incident** — someone added an index or widened a column
  in `psql` at 2 a.m. and never wrote the migration.
- **A migration applied to staging but not production**, or applied out of order
  across branches.
- **A rolled-back deploy** that left the new schema in place with old code running.
- **An ORM's `sync`/`push` mode** pointed at a real database.
- **A restored backup** from before a migration.

The common thread: none of these produce an error at the time. The failure comes
later, from whichever query first touches the difference.

## The check

Compare what the code expects against `information_schema`, at boot, and refuse to
start if they disagree.

```js
const EXPECTED = {
  mg_users: {id: 'bigint', email: 'text'},
};

async function checkSchema(pool, expected = EXPECTED) {
  const problems = [];
  for (const [table, cols] of Object.entries(expected)) {
    const {rows} = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1`, [table]);
    if (rows.length === 0) { problems.push(`table ${table} is missing`); continue; }
    const live = new Map(rows.map((r) => [r.column_name, r.data_type]));
    for (const [col, type] of Object.entries(cols)) {
      if (!live.has(col)) problems.push(`${table}.${col} is missing`);
      else if (live.get(col) !== type)
        problems.push(`${table}.${col} is ${live.get(col)}, expected ${type}`);
    }
  }
  return problems;
}
```

```console
$ node ex10-migrations.mjs
=== 6. drift check — does the live schema match what the code expects? ===
matching schema → ok
after a type change → [ 'mg_users.email is character varying, expected text' ]
after a drop → [ 'mg_users.email is missing' ]
```

Both classes are caught, and the message names the table, the column and the actual
type. Compare that with what you get without the check: a `42703 column "email"
does not exist` from whichever endpoint a user happens to hit first.

Fail the process on a non-empty result:

```js
const problems = await checkSchema(pool);
if (problems.length) {
  console.error('schema drift detected:\n  ' + problems.join('\n  '));
  process.exit(1);
}
```

Exiting at boot is the point. A container that will not start is a visible,
immediate failure that a deploy system can roll back; a running container serving
`500`s on one endpoint is not.

## What a naive check misses

`information_schema` reports SQL-standard types, which flattens distinctions that
matter:

- **`numeric(12,2)` reports as `numeric`.** Precision and scale live in
  `numeric_precision` and `numeric_scale`. A migration that changed money from
  `numeric(12,2)` to `numeric(10,2)` passes a `data_type`-only check and silently
  truncates.
- **`varchar(255)` reports as `character varying`**, with the length in
  `character_maximum_length`.
- **Identity columns report `column_default: null`.** As measured in
  [Issuing DDL through the driver](./01-ddl-from-node/01-issuing-ddl.md), identity is a
  separate property (`is_identity`), so dropping `GENERATED ALWAYS AS IDENTITY`
  changes nothing a defaults comparison would see.
- **Constraints, indexes and nullability are separate catalogs.** A dropped `NOT
  NULL`, a dropped unique index, or a missing foreign key are all invisible to a
  column-name check — and a dropped unique index is exactly the kind of thing that
  causes duplicate rows rather than errors.

Extend the query as far as your risk tolerance requires:

```sql
SELECT column_name, data_type, is_nullable, is_identity,
       numeric_precision, numeric_scale, character_maximum_length
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = $1
 ORDER BY ordinal_position;
```

Also note `information_schema` only shows objects the current role can see. A check
running as a restricted application role can report a column missing when it exists
but is not visible — query `pg_catalog` directly if you need the truth regardless of
privileges.

## Keeping the expectation honest

A hand-maintained `EXPECTED` object drifts from the code just as the database drifts
from the migrations. Three ways to avoid that, in increasing order of rigour:

1. **Generate it** from the live schema in CI after migrations run, and commit the
   result. The diff in code review *is* the schema change.
2. **Compare two databases** — apply migrations to a scratch database and diff its
   catalog against production's. This catches everything, including constraints and
   indexes, without maintaining a list.
3. **Generate types from the schema** and let the type checker enforce the column
   set at build time — [Generating TypeScript types](14-codegen-types.md).

Options 2 and 3 are the ones that scale; the hand-written object is fine for a
handful of critical tables and honest about being a smoke test.

## Trade-off

A drift check costs a query per table at boot and a list that must be kept current.
In exchange, schema mismatches fail at deploy time with a precise message instead of
at request time with a generic one.

The cost is real when the list is hand-maintained: a forgotten update makes the
check fail on a *correct* deploy, and a check that cries wolf gets deleted. Generate
it, or restrict it to the few tables whose shape the application genuinely cannot
survive being wrong about.

## Gotchas

**Symptom:** `42703 column "x" does not exist` in production, one endpoint only
**Cause:** Drift — the code expects a column the database does not have.
**Fix:** A boot-time check that exits non-zero, so the deploy fails instead of the
request.

**Symptom:** The drift check passes but money values are being truncated
**Cause:** `data_type` reports `numeric` for every `numeric(p,s)`.
**Fix:** Compare `numeric_precision` and `numeric_scale` as well.

**Symptom:** Duplicate rows appear with no code change
**Cause:** A unique index was dropped manually; column-level checks do not see
indexes.
**Fix:** Include `pg_indexes`/`pg_constraint` in the check, or diff whole catalogs.

**Symptom:** The check reports a column missing that plainly exists
**Cause:** `information_schema` is privilege-filtered and the app role cannot see
it.
**Fix:** Query `pg_catalog`, or grant the role visibility.

**Symptom:** The check fails on a correct deploy
**Cause:** A stale hand-maintained expectation.
**Fix:** Generate the expectation in CI, or narrow it to critical tables.

**Symptom:** Staging and production disagree despite the same migration count
**Cause:** A manual change, or an edited migration file.
**Fix:** Checksums in the tracking table ([Migrations](02-migrations.md)); diff the
two catalogs.

## Interview questions

**★ What is schema drift and how does it happen if you use migrations?**
The live schema no longer matches what the code assumes. With migrations in place it
means something bypassed them: a manual `psql` fix during an incident, a migration
applied to one environment only, a restored backup, an ORM `sync` mode, or a rolled
back deploy. None of these error at the time — the failure surfaces later as
`42703`.

**★ How do you detect it before users do?**
Query `information_schema.columns` at boot, compare against what the code expects,
and `process.exit(1)` on a mismatch. Measured, this names the problem precisely —
`mg_users.email is character varying, expected text` — instead of a generic runtime
error from one endpoint.

**★ What does a column-name-and-type check miss?**
Precision and scale (`numeric(12,2)` reports as `numeric`), string lengths, identity
(`column_default` is null for identity columns), nullability, and everything in
other catalogs: constraints, unique indexes, foreign keys. A dropped unique index
produces duplicate rows rather than an error, and this check will not see it.

**★ Why exit rather than log a warning?**
A container that will not start is visible and rollback-able. A running container
serving errors on one endpoint looks healthy to the deploy system and is discovered
by users.

**How do you stop the expectation from drifting too?**
Generate it from the live schema in CI after migrations, and commit it — so the
schema change shows up as a diff in review. Better still, diff a freshly migrated
scratch database against production, which needs no maintained list at all.

---

← [Migration tools](12-migration-tools.md) · Next → [Generating TypeScript types](14-codegen-types.md)
