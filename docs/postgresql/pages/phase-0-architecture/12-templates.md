---
title: "template0, template1, and CREATE DATABASE"
sidebar_label: "12 · Templates"
sidebar_position: 12
---

<span className="db-tier t-when">When Needed</span>

**`CREATE DATABASE` copies an existing database as a template.** By default that
is `template1`. `template0` is the pristine factory image you fall back to when
`template1` was customized.

## See the catalog

```console
$ psql -h 127.0.0.1 -p 55432 -U devbible -d devbible -c \
  "select datname, datistemplate, datallowconn
   from pg_database
   where datname in ('template0','template1','postgres')
   order by 1;"
  datname  | datistemplate | datallowconn
-----------+---------------+--------------
 postgres  | f             | t
 template0 | t             | f
 template1 | t             | t
```

> Verified: 2026-08 on **PostgreSQL 18.4**.

| Database | Role |
|---|---|
| **`template1`** | Default source for `CREATE DATABASE`; may hold encodings/extensions you want on every new DB |
| **`template0`** | Clean template; `datallowconn` is usually false — use when `template1` is dirty |
| **`postgres`** | Ordinary DB created for admin connections; not magic beyond convention |

## Creating a database

```sql
CREATE DATABASE shop;                         -- FROM template1
CREATE DATABASE shop2 TEMPLATE template0;     -- explicit clean template
```

Only superusers (or roles with `CREATEDB`) can do this. App runtime roles usually
must **not**.

## From Node

```js
// create-db is admin work — not a per-request path
import pg from 'pg';

const admin = new pg.Pool({
  connectionString:
    'postgresql://devbible:devbible@127.0.0.1:55432/postgres',
});

// Prefer migrations inside one app database over CREATE DATABASE from the app.
const {rows} = await admin.query(`
  select datname from pg_database where datname = 'devbible'
`);
console.log(rows[0]);
await admin.end();
```

```console
$ node -e "/* see create pattern above */"
{ datname: 'devbible' }
```

Day-to-day apps connect to an **existing** database and run migrations (Phase 8).
`CREATE DATABASE` shows up in provisioning scripts and local reset tooling.

## When you need this

- Building a **provisioner** that creates per-tenant databases (uncommon vs
  schema-per-tenant)  
- Repairing a botched `template1`  
- Understanding why a new database already contains unexpected objects

## Gotchas

**Symptom:** New database already has random schemas/extensions  
**Cause:** Someone installed them into `template1`  
**Fix:** Create from `template0`, or clean `template1` carefully

**Symptom:** Cannot connect to `template0`  
**Cause:** `datallowconn = false` by design  
**Fix:** Use it only as `TEMPLATE template0`, not as a working DB

## Interview questions

**★ What does `CREATE DATABASE` copy?**  
Another database used as a template (default `template1`).

**Why does `template0` exist?**  
A known-clean template when `template1` has been modified.

**Should the web app role run `CREATE DATABASE`?**  
Almost never. Provisioning is an admin path; runtime is DML (+ limited DDL via
migrations with a migrator role).

---

← [vs other databases](11-vs-other-databases.md) · [Phase 0 index](README.md)
