---
title: "Extensions"
sidebar_label: "09 · Extensions"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script:
> `sandbox/pg-api/ex48-extensions-partitioning.mjs`.

**An extension is a package of database objects — types, functions, operators,
index methods — that ships with the server but is not active until you install it,
and installing it is per *database*, not per server.** That last point is the one
that produces the confusing bug.

## Available versus installed

```console
$ node ex48-extensions-partitioning.mjs
=== 1. what is available vs what is installed ===
┌─────────┬──────────────────────┬─────────────────┬───────────┐
│ (index) │ name                 │ default_version │ installed │
├─────────┼──────────────────────┼─────────────────┼───────────┤
│ 0       │ 'btree_gin'          │ '1.3'           │ '1.3'     │
│ 1       │ 'citext'             │ '1.8'           │ '1.8'     │
│ 2       │ 'dblink'             │ '1.2'           │ '-'       │
│ 3       │ 'hstore'             │ '1.8'           │ '-'       │
│ 4       │ 'pg_stat_statements' │ '1.12'          │ '1.12'    │
│ 5       │ 'pg_trgm'            │ '1.6'           │ '1.6'     │
│ 6       │ 'pgcrypto'           │ '1.4'           │ '-'       │
│ 7       │ 'postgres_fdw'       │ '1.2'           │ '-'       │
│ 8       │ 'uuid-ossp'          │ '1.1'           │ '-'       │
└─────────┴──────────────────────┴─────────────────┴───────────┘
total available in this image: 60
```

**Available** means the files are on the server's disk — 60 of them in the stock
`postgres:18-alpine` image. **Installed** means `CREATE EXTENSION` has been run in
*this* database.

```sql
SELECT name, default_version, installed_version FROM pg_available_extensions;
SELECT extname, extversion FROM pg_extension;   -- installed here
```

If a name is not in the first list at all, no `CREATE EXTENSION` will help — the
server does not have the files. That is exactly the case with `pgvector`, which is
absent from the stock image and needs a different one entirely; see
[pgvector](17-pgvector.md).

## Installing one

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

```console
=== 2. installing one, and what it brings ===
CREATE EXTENSION pgcrypto                      → OK
objects owned by pgcrypto: 37
digest() now works: 2cf24dba5fb0a30e26e83b2a…
```

**37 objects** from one statement — functions, operators and their supporting
catalog entries, all owned by the extension and all dropped together if you remove
it.

Extensions land in a **schema**, `public` by default:

```console
┌─────────┬──────────────────────┬──────────────┬────────────┐
│ (index) │ extname              │ schema       │ extversion │
├─────────┼──────────────────────┼──────────────┼────────────┤
│ 7       │ 'plpgsql'            │ 'pg_catalog' │ '1.0'      │
└─────────┴──────────────────────┴──────────────┴────────────┘
```

Note `plpgsql` is itself an extension, installed by default into `pg_catalog` —
which is why [PL/pgSQL](12-plpgsql.md) works without you doing anything.

Putting extensions in `public` is the default and a mild smell: it mixes vendor
objects with yours. `CREATE EXTENSION pgcrypto SCHEMA ext` keeps them separate, at
the cost of every caller needing `ext.digest(...)` or `ext` on the `search_path`.

## Per database, not per cluster

This is the one that wastes an afternoon:

```console
=== 3. an extension is per-DATABASE, not per-cluster ===
pgcrypto present in the new database? false
digest() in a database without the extension   → 42883 function digest(unknown, unknown) does not exist
```

`CREATE DATABASE` does **not** carry extensions across. The function exists in one
database and raises `42883 function does not exist` in another on the same server.

Practical consequences:

- **Every migration that needs an extension must create it**, with
  `IF NOT EXISTS`. Do not assume production has it because staging does.
- **Test databases need it too.** A test suite creating a fresh database per worker
  ([testing against real PG](../phase-9-api-crud/16-testing-real-pg.md)) gets a
  database without your extensions unless the template has them.
- `CREATE DATABASE x TEMPLATE y` **does** copy them, because it copies everything —
  which is a good reason to build a template database once.

## Removing one, and what blocks it

```console
=== 4. dependencies and removal ===
DROP EXTENSION hstore with a column using it   → 2BP01 cannot drop extension hstore because other objects depend on it
DROP EXTENSION hstore once nothing uses it     → OK
what depends on hstore: [{"table_name":"ext_users","column_name":"attrs"}]
```

An extension that provides a **type** cannot be dropped while any column uses that
type. `2BP01` is the same dependency error a [view](07-views.md) produces.

The query in that last line is the one to keep — the error tells you *that*
something depends, not *what*:

```sql
SELECT c.relname AS table_name, a.attname AS column_name
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_type t ON t.oid = a.atttypid
 WHERE t.typname = 'hstore' AND c.relkind = 'r';
```

`DROP EXTENSION ... CASCADE` drops the dependent columns too, which is almost never
what a migration intends.

## The ones worth knowing

| Extension | For |
|---|---|
| **`pg_stat_statements`** | Which queries actually cost you time. The first thing to enable on any server — [Phase 10](../phase-10-indexes/14-pg-stat-statements.md) |
| **`pg_trgm`** | Fuzzy matching and indexable `ILIKE '%x%'` — [topic 06](06-pg-trgm.md) |
| **`citext`** | Case-insensitive text, so emails compare correctly without `lower()` everywhere |
| **`pgcrypto`** | `digest`, `gen_random_bytes`. Note `gen_random_uuid()` is **built in** since PG 13 and needs no extension |
| **`uuid-ossp`** | Older UUID generation. Usually unnecessary now |
| **`postgres_fdw`** | Query another PostgreSQL server — [topic 16](16-fdw.md) |
| **`btree_gin` / `btree_gist`** | Mix scalar columns into a GIN or GiST index, e.g. an exclusion constraint on `(room, during)` |
| **`pgvector`** | Embeddings — [topic 17](17-pgvector.md). **Not bundled**; needs a server image that has it |

## What a managed provider allows

On RDS, Cloud SQL, Neon or Supabase you get an **allowlist**, not the full 60. The
common extensions above are almost always present; anything needing a shared
library preloaded (`pg_stat_statements` is the usual example) may need a parameter
group change and a restart, and anything compiled from source is generally not
possible at all.

Check before you design around one:

```sql
SELECT name FROM pg_available_extensions ORDER BY name;
```

`pg_stat_statements` also needs `shared_preload_libraries`, which is a server
restart even on your own hardware — worth knowing before an incident is the moment
you first want it.

## Trade-off

An extension is a dependency that lives inside your database. It buys functionality
you would otherwise build badly — nobody should be writing their own trigram
similarity — at the cost of a version to track, a provider that may not offer it,
and a migration path that is separate from your application's.

The version matters more than people expect: `ALTER EXTENSION ... UPDATE` is a
distinct operation from upgrading PostgreSQL, and an extension can lag behind the
server. Pin the version you tested against, and treat adding one as a schema
decision rather than a library import.

## Gotchas

**Symptom:** `42883 function does not exist` in one database and not another
**Cause:** Extensions are per database. Measured: a new database on the same server
had no `pgcrypto`.
**Fix:** `CREATE EXTENSION IF NOT EXISTS` in the migration, and in the test
template.

**Symptom:** `CREATE EXTENSION` fails with "could not open extension control file"
**Cause:** The files are not on the server — it is not in
`pg_available_extensions`.
**Fix:** A different server image or provider. No SQL fixes this.

**Symptom:** `2BP01 cannot drop extension ... because other objects depend on it`
**Cause:** A column still uses a type the extension provides.
**Fix:** Find them with the `pg_attribute` query above; change the columns first.
`CASCADE` would drop the columns.

**Symptom:** Extension functions are not found after a `search_path` change
**Cause:** The extension was installed into a non-default schema.
**Fix:** Qualify the calls or add the schema to `search_path`.

**Symptom:** A fresh test database is missing extensions
**Cause:** `CREATE DATABASE` does not copy them from another database.
**Fix:** Use `TEMPLATE` a database that has them, or create them per test database.

**Symptom:** `pg_stat_statements` is installed but returns nothing
**Cause:** The library is not in `shared_preload_libraries`.
**Fix:** Set it and restart the server. `CREATE EXTENSION` alone is not enough.

## Interview questions

**★ What is the difference between an extension being available and installed?**
Available means the files are on the server — measured, 60 in the stock
`postgres:18-alpine` image. Installed means `CREATE EXTENSION` has been run **in
that database**. `pg_available_extensions` shows the first, `pg_extension` the
second.

**★ Why does a function from an extension work in one database and not another?**
Because extensions are per database, not per cluster. Measured: `digest()` worked
in one database and raised `42883` in a newly created one on the same server. Every
migration must create the extensions it needs, and so must every test database
unless it is cloned from a template.

**★ What blocks dropping an extension?**
Any object depending on it — most often a column using a type it provides.
Measured, `2BP01`. The error does not say what depends, so query `pg_attribute`
joined to `pg_type` to find the columns. `CASCADE` would drop them with it.

**★ Which extensions would you enable on a new project?**
`pg_stat_statements` first — without it you are guessing about which queries cost
you. Then `pg_trgm` if there is any fuzzy search, and `citext` if emails or
usernames need case-insensitive comparison. Note `gen_random_uuid()` is built in
since PG 13, so `pgcrypto` and `uuid-ossp` are usually unnecessary now.

**What limits you on a managed provider?**
An allowlist rather than the full set, and anything needing
`shared_preload_libraries` — `pg_stat_statements` included — may require a
parameter-group change and a restart. Check `pg_available_extensions` before
designing around one.

---

← [Triggers](08-triggers.md) · Next → [Set-returning functions](10-srf.md)
