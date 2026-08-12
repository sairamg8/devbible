---
title: "Client/server model"
sidebar_label: "02 · Client/server model"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Each client connection is backed by its own server process (backend).** That
is why connections are expensive, why idle connections still cost RAM, and why
Node uses a **pool** instead of opening a new connection per request.

## Why it exists

PostgreSQL isolates work per connection: one backend process runs your session’s
queries, holds session state, and can crash without taking down every other
client. The trade-off is process overhead — not a free thread in your app.

## The shape

```
┌─────────────┐         TCP / Unix socket          ┌──────────────────┐
│  Node (pg)  │ ─────────────────────────────────► │  backend process │
│  or psql    │         one connection             │  (one OS process)│
└─────────────┘                                    └────────┬─────────┘
                                                            │
                                                   shared memory / disk
```

- **Client:** issues queries, reads results, holds a socket open.  
- **Backend:** parses SQL, plans, executes, returns rows.  
- **Many clients** ⇒ many backends (up to `max_connections`).

## See it on the server

```console
$ psql -h 127.0.0.1 -p 55432 -U devbible -d devbible -c "show max_connections;"
 max_connections
-----------------
 100

$ psql -h 127.0.0.1 -p 55432 -U devbible -d devbible -c \
  "select backend_type, count(*) from pg_stat_activity group by 1 order by 1;"
         backend_type         | count
------------------------------+-------
 autovacuum launcher          |     1
 background writer            |     1
 checkpointer                 |     1
 client backend               |     1
 io worker                    |     3
 logical replication launcher |     1
 walwriter                    |     1
```

> Verified: 2026-08 on **PostgreSQL 18.4**. Your `psql` session is the
> `client backend` row.

## From Node — two checkouts, two backends

```js
// two-backends.mjs
import pg from 'pg';

const pool = new pg.Pool({
  host: '127.0.0.1',
  port: 55432,
  user: 'devbible',
  password: 'devbible',
  database: 'devbible',
  max: 2,
});

const a = await pool.connect();
const b = await pool.connect();
const {rows} = await a.query(`
  select count(*)::int as client_backends
  from pg_stat_activity
  where usename = current_user
    and backend_type = 'client backend'
`);
console.log(rows[0]);
a.release();
b.release();
await pool.end();
```

```console
$ node two-backends.mjs
{ client_backends: 2 }
```

Two checked-out clients ⇒ two backend processes. A pool of `max: 20` can mean
up to twenty backends **from this app alone** — before other services connect.

## What this means for fullstack apps

| Habit | Cost |
|---|---|
| New `Client` / `Pool` per request | Connection storms; hits `max_connections` |
| Never releasing a client | Pool exhaustion; other requests hang |
| One global `Pool` at module scope | Correct default for a web process |

Pool *sizing* and leak diagnosis live in **Node Phase 6**. Here you only need the
hardware fact: **connection ≈ process**.

## Trade-off

Process-per-connection gives isolation and simpler memory accounting. It costs
startup time and RAM per backend. External poolers (PgBouncer) exist because of
this cost — Phase 13, not Phase 0.

## Gotchas

**Symptom:** Intermittent `sorry, too many clients already`  
**Cause:** More concurrent connections than `max_connections`  
**Fix:** Pool in the app, lower `max`, or put a pooler in front — never open unbounded clients

**Symptom:** App “hangs” under load with no SQL errors  
**Cause:** Pool empty; every request waits for `connect()`  
**Fix:** Release clients in `finally`; size the pool; find leaks (Node Phase 6)

**Symptom:** Connecting with `localhost` fails while `127.0.0.1` works  
**Cause:** Node resolves `localhost` to `::1` first; container published on IPv4  
**Fix:** Use **`127.0.0.1`** for published container ports (sandbox convention)

## Interview questions

**★ Why is a PostgreSQL connection expensive?**  
Each connection is typically a dedicated backend **process** with its own memory,
not a cheap green thread inside one process.

**★ Why does Node use a connection pool?**  
To reuse a small number of backends across many concurrent requests instead of
paying process setup per request.

**What is `max_connections`?**  
Server-wide cap on concurrent backends. Every app, admin session, and tool
shares that budget.

**Does `pool.query()` open a new process every time?**  
No. It borrows a client from the pool, runs one query, returns the client. The
backend process stays up for reuse.

---

← [What PostgreSQL is](01-what-postgresql-is.md) · Next → [Namespace](03-namespace.md)
