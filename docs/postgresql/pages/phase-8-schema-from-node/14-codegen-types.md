---
title: "Generating TypeScript types from the schema"
sidebar_label: "14 · Type generation"
sidebar_position: 14
---

<span className="db-tier t-know">Should Know</span>

> Verified: 2026-08. Runtime behaviour of `pg` measured on **PostgreSQL 18.4**,
> **Node 24.19.0**, `pg` 8.23.0 (`sandbox/pg-api/ex4-soft-delete.mjs`,
> `ex1-ddl-from-node.mjs`). Tool versions from the npm registry on 2026-08-12:
> **drizzle-kit 0.31.10**, **prisma 7.9.1**, **kysely 0.29.5**.

**A hand-written `interface User` is a guess about the database that nothing checks.
Generating it from the live schema makes the compiler catch the mismatch that
otherwise surfaces as `undefined` in production.**

## The problem being solved

```ts
interface User {
  id: number;
  email: string;
  createdAt: Date;   // the column is created_at, and pg returns a string for some types
}

const {rows} = await pool.query<User>('SELECT * FROM users WHERE id = $1', [id]);
```

`pool.query<User>` is an **assertion, not a check.** `pg` does not validate the row
against `User`; the generic only tells TypeScript what to pretend. Drop the column,
rename it, or change its type and this code still compiles. Every one of the drift
scenarios in [Schema drift](13-schema-drift.md) is invisible here.

## What `pg` actually returns — before you type anything

Generated types are only useful if they match runtime reality, and `pg`'s defaults
surprise people:

```console
$ node ex4-soft-delete.mjs
rowCount: 1 | returned: { id: '1', email: 'hard@x.com', name: 'Hard' }
```

**`id` is the string `'1'`, not the number `1`.** `bigint` (int8) is returned as a
string by default because a 64-bit integer does not fit in a JavaScript `number`
without precision loss. A generated type that says `id: number` is *wrong*, and
`user.id + 1` silently produces `'11'`.

The same care applies to:

- **`numeric`/`decimal` → string.** Deliberate: binary floating point cannot
  represent money exactly. `price: number` is a bug waiting to round.
- **`timestamptz` → `Date`**, but `date` also → `Date` with a local-midnight time
  component, which is a common source of off-by-one-day errors.
- **`int8` aggregate results** — `count(*)` returns `bigint`, so it is a string too.
  Hence `count(*)::int` throughout this corpus.
- **Nullable columns.** A column without `NOT NULL` must generate `T | null`, and
  this is where hand-written interfaces are wrong most often.

Any generator worth using is configurable on these mappings. Configure them
deliberately rather than accepting defaults, because the default choice differs
between tools and the wrong one is silent.

## The three approaches

| Approach | Source of truth | Example |
|---|---|---|
| **Introspect the live database** | the database | `drizzle-kit pull`, kanel, `@databases/pg-schema-cli` |
| **Derive from a schema file** | the tool's schema | `prisma generate`, drizzle's TS schema |
| **Infer from the queries** | your SQL | `pgtyped`, `@databases/pg-typed` |

**Introspection** fits this project's raw-SQL path best: migrations remain the
source of truth, and types are a build artefact derived from the result. Run it in
CI after migrations and commit the output, so a schema change appears as a type diff
in review.

**Query inference** is the strongest guarantee, because it types the actual `SELECT`
including joins, aliases and computed columns — `SELECT id, email FROM users`
produces a type with exactly those two fields, not the whole row. It requires
writing SQL in a form the tool can parse, usually `.sql` files
([SQL in `.sql` files](05-sql-files.md)), and it needs a live database at build time.

## Wiring it in

```jsonc
// package.json
{
  "scripts": {
    "db:types": "drizzle-kit pull && npm run lint:fix",
    "db:check": "npm run db:types && git diff --exit-code src/db/schema.ts"
  }
}
```

`db:check` in CI fails when the committed types no longer match the migrated
database — the same job as the boot-time drift check, moved to build time where it
is cheaper and blocks the merge instead of the deploy. Commit the generated file:
it must be reviewable, and the build must not require a database.

## What generated types do not give you

- **They are not runtime validation.** They describe the schema at generation time;
  the running database may differ. Types plus the boot-time check from
  [Schema drift](13-schema-drift.md) cover different moments and you want both.
- **They do not type your query results** unless you use query inference —
  `SELECT id, email` still yields the full row type, so `user.name` compiles and is
  `undefined`.
- **They do not know about your domain.** `status: string` is technically right and
  useless; a `CHECK` constraint or an enum type is what makes it
  `'active' | 'archived'`.
- **They cannot see business nullability.** A column that is `NOT NULL` in the
  database but only populated after onboarding is `string` to the generator and
  effectively nullable to your code.

## Trade-off

Generated types make schema changes visible at compile time and remove a class of
silently wrong hand-written interfaces. They cost a build step that needs a live
database, a generated file in the repository, and a discipline that the generator is
authoritative — a hand-edit to the generated file is erased on the next run, and
someone will do it.

The cheaper 80 % if a codegen step is not worth it: type each repository function's
return explicitly, keep those types in one module beside the SQL, and rely on the
boot-time drift check to catch divergence. That is a real position, not a
concession — it is what this project's raw-`pg` path does until types earn their
step.

## Gotchas

**Symptom:** `user.id + 1` produces `'11'`
**Cause:** `bigint` is returned as a string by `pg` — measured, `{ id: '1' }`.
**Fix:** Type it `string`, or configure a parser (accepting the precision risk).

**Symptom:** Money is off by fractions of a cent
**Cause:** `numeric` typed and parsed as `number`.
**Fix:** Keep `numeric` as a string and use a decimal library.

**Symptom:** A dropped column still compiles
**Cause:** `pool.query<User>` asserts rather than validates.
**Fix:** Regenerate types in CI and fail on a diff; add a runtime drift check.

**Symptom:** A field is `undefined` at runtime with no type error
**Cause:** The row type describes the whole table, but the `SELECT` listed fewer
columns.
**Fix:** Query-level inference, or type each function's return to its own projection.

**Symptom:** Generated types drift from the database
**Cause:** Generation is a manual step someone forgot.
**Fix:** `db:check` in CI: regenerate and `git diff --exit-code`.

**Symptom:** A dates-only column is off by one day
**Cause:** `date` maps to `Date` at local midnight; a timezone shift crosses the
boundary.
**Fix:** Configure `date` to map to a string, and handle calendar dates as strings.

**Symptom:** Hand edits to the generated file keep disappearing
**Cause:** It is a build artefact.
**Fix:** Change the schema or the generator config; never the output.

## Interview questions

**★ Why is `pool.query<User>()` not type safety?**
It is an assertion. `pg` does not check the returned rows against `User`; the
generic only tells TypeScript what to assume. A dropped or renamed column still
compiles and fails at runtime — which is precisely the drift generated types are
meant to catch.

**★ Why is a generated `id: number` wrong for a `bigint` column?**
`pg` returns `bigint` as a string because 64-bit integers exceed JavaScript's safe
integer range — measured, `{ id: '1' }`. Typing it `number` makes `id + 1` produce
`'11'` through string concatenation. The same applies to `numeric`, which stays a
string to preserve exact decimals.

**★ What are the approaches to generating types, and how do they differ?**
Introspect the live database (types follow migrations), derive from a tool's schema
file (the schema file becomes the source of truth), or infer from the queries
themselves (types match each `SELECT`'s actual projection). Query inference is the
strongest guarantee and needs SQL the tool can parse plus a database at build time.

**★ Why do table-level generated types still let `undefined` through?**
They describe the whole row. `SELECT id, email FROM users` returns two columns, but
the type says every column exists, so `user.name` compiles and is `undefined` at
runtime. Only query-level inference — or hand-typed projections — closes that.

**★ Do generated types replace a runtime drift check?**
No. They reflect the schema at generation time; the database the process connects to
at boot may be different. Codegen with a CI diff catches drift at build time, the
boot check catches it at deploy time, and they fail on different things.

**What is the pragmatic option without a codegen step?**
Type each repository function's return explicitly, keep those types in one module
next to the SQL, and rely on the boot-time drift check. It gets most of the benefit
with no build-time database dependency.

---

← [Schema drift](13-schema-drift.md) · Next → [Phase 9 · CRUD patterns for a real API](../phase-9-api-crud/)
