---
title: "What PostgreSQL is"
sidebar_label: "01 · What PostgreSQL is"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

**PostgreSQL is a free, open-source object-relational database server.** It is
not a library you embed in your process, not a document store, and not “SQL
syntax” alone — it is a long-running program that stores data, enforces rules,
and answers queries over a network protocol.

## Why it exists

Application code is bad at durable multi-user data: concurrent writers, crash
recovery, indexes, and access control. A database server owns those problems so
your Node process can stay a client.

PostgreSQL sits in the **relational** tradition (tables, keys, SQL) and adds
**object-relational** features you will actually use later: custom types,
`jsonb`, arrays, full-text, extensions.

## What you are holding

| Piece | Role |
|---|---|
| **Server process** | Listens for connections, runs queries, writes WAL and data files |
| **Database cluster** | One data directory on disk; may contain many databases |
| **SQL + catalog** | The language and the system tables that describe your schema |
| **Client** | `psql`, `pg` in Node, a GUI — anything speaking the wire protocol |

A one-line version: **PostgreSQL is the process that owns the durable truth;
your app is a guest with a connection.**

## See it running

```console
$ psql -h 127.0.0.1 -p 55432 -U devbible -d devbible -c 'select version();'
                                         version
-----------------------------------------------------------------------------------------
 PostgreSQL 18.4 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
```

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`).

## From Node

```js
// version.mjs
import pg from 'pg';

const pool = new pg.Pool({
  host: '127.0.0.1',
  port: 55432,
  user: 'devbible',
  password: 'devbible',
  database: 'devbible',
});

const {rows} = await pool.query('select version() as v');
console.log(rows[0].v);
await pool.end();
```

```console
$ node version.mjs
PostgreSQL 18.4 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
```

Same fact, two clients. The server does not care whether the client is `psql` or
`pg` — only that the protocol and credentials work.

## License and governance

PostgreSQL uses a permissive **PostgreSQL License** (BSD-style). There is no
single commercial owner of the core project; development is community-driven
with corporate contributors. That matters when you choose a managed host: the
engine is free; the *hosting* is the product.

## Trade-off

You gain ACID, a rich type system, and a planner that can do serious SQL. You
pay with an **external process** to run, back up, and upgrade — not a single
file like SQLite, and not “just documents” like a pure document store.

## Gotchas

**Symptom:** Tutorials treat “Postgres” as synonymous with an ORM  
**Cause:** Course marketing folds schema design into Prisma/Mongoose-shaped stories  
**Fix:** This syllabus is **raw SQL + `psql` + `pg` first**; ORMs stay a comparison in Node Phase 6

**Symptom:** You installed a GUI and never opened `psql`  
**Cause:** Comfort over control  
**Fix:** Phase 1 exists so every later claim is something you can re-run in a shell

## Interview questions

**★ What is PostgreSQL, in one sentence?**  
An open-source object-relational database *server* that stores data, enforces
constraints, and runs SQL for clients over a network protocol.

**★ Is PostgreSQL a language?**  
No. SQL is the query language; PostgreSQL is the server that implements it (with
extensions and its own dialect).

**Why do backends still pick PostgreSQL over “just JSON files”?**  
Concurrency, crash recovery, indexes, constraints, and multi-user access —
problems you re-implement poorly if you own the files yourself.

**What does “object-relational” buy a fullstack app?**  
Native types beyond plain rows (`jsonb`, arrays, custom types) without giving up
relational integrity.

---

← Index: [Phase 0](README.md) · Next → [Client/server model](02-client-server-model.md)
