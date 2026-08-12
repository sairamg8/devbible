---
title: "Cluster → database → schema → table"
sidebar_label: "03 · Namespace"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**PostgreSQL names objects in four levels: cluster → database → schema →
table (and other objects).** Confusing any two levels is the root of “relation
does not exist” bugs and multi-tenant layout mistakes.

## The four levels

| Level | What it is | Example |
|---|---|---|
| **Cluster** | One data directory / one running server instance | The Podman container’s data volume |
| **Database** | A named catalog inside the cluster; connections pick **one** | `devbible`, `postgres` |
| **Schema** | Namespace *inside* a database | `public`, `app`, `billing` |
| **Relation** | Table, view, sequence, … inside a schema | `public.users` |

You connect **to a database**. You do not “switch cluster” without a new
connection target. Schemas are not separate databases — they are folders of
names inside one database.

## See it

```console
$ psql -h 127.0.0.1 -p 55432 -U devbible -d devbible -c \
  "select current_database(), current_schema(), current_user;"
 current_database | current_schema | current_user
------------------+----------------+--------------
 devbible         | public         | devbible

$ psql -h 127.0.0.1 -p 55432 -U devbible -d devbible -c "show search_path;"
   search_path
-----------------
 "$user", public

$ psql -h 127.0.0.1 -p 55432 -U devbible -d devbible -c \
  "select datname from pg_database order by 1;"
  datname
-----------
 devbible
 postgres
 template0
 template1
```

> Verified: 2026-08 on **PostgreSQL 18.4**.

`search_path` is how unqualified names resolve: first a schema matching the
role name (if it exists), then `public`.

## From Node

```js
// namespace.mjs
import pg from 'pg';

const pool = new pg.Pool({
  connectionString:
    'postgresql://devbible:devbible@127.0.0.1:55432/devbible',
});

const {rows} = await pool.query(`
  select
    current_database() as database,
    current_schema()   as schema,
    current_setting('search_path') as search_path
`);
console.log(rows[0]);
await pool.end();
```

```console
$ node namespace.mjs
{
  database: 'devbible',
  schema: 'public',
  search_path: '"$user", public'
}
```

The database name is in the **connection string**. Schema is session state —
changeable with `SET search_path`, dangerous if an attacker can influence it
(later: least-privilege roles).

## Qualifying names

```sql
-- same table, three ways (schema must exist)
SELECT * FROM public.users;
SELECT * FROM users;              -- via search_path
SET search_path TO app, public;
SELECT * FROM users;              -- now prefers app.users
```

Always qualify in migrations and multi-schema apps: `app.users`, not bare
`users`, so a path change cannot silently hit another table.

## Trade-off

Schemas give cheap namespacing inside one database (extensions, multi-tenant
layouts, `app` vs `audit`). Separate **databases** give stronger isolation but
no cross-database queries in plain SQL without FDW (Phase 12 When Needed).

## Gotchas

**Symptom:** `ERROR: relation "users" does not exist`  
**Cause:** Wrong database, wrong `search_path`, or table in another schema  
**Fix:** `\c` / connection string database; `\dt *.*`; use `schema.table`

**Symptom:** App works in `psql` but Node “cannot find table”  
**Cause:** Node connected to a different database (or role with different path)  
**Fix:** Log `current_database()` and `search_path` at boot from the same pool

**Symptom:** Two apps share a cluster and stomp each other’s tables  
**Cause:** Both use `public` with generic names  
**Fix:** Separate databases **or** dedicated schemas + privileges

## Interview questions

**★ What is the difference between a database and a schema in PostgreSQL?**  
A database is a connection-level catalog. A schema is a namespace *inside* one
database. You pick the database when you connect; you resolve schemas via
`search_path` or qualified names.

**★ What does `search_path` do?**  
It lists schemas checked for **unqualified** object names, in order.

**Can one query join tables in two databases?**  
Not with ordinary SQL on one connection. Use one database with multiple schemas,
or advanced tools (FDW) later.

**Why is `public` special?**  
Default schema where objects land if you never create your own; convenient and
easy to overcrowd.

---

← [Client/server model](02-client-server-model.md) · Next → [Shared buffers](04-shared-buffers.md)
