---
title: "Postmaster, backends, and workers"
sidebar_label: "09 · Process model"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

**A running PostgreSQL instance is a small constellation of processes:** a
supervisor, one backend per client connection, and background workers that write
WAL, checkpoint, vacuum, and more. You rarely manage them by hand — you need to
recognize them when reading `pg_stat_activity` or a host process list.

## The cast

| Process / type | Job |
|---|---|
| **Postmaster** | Parent; accepts connections; starts backends |
| **Client backend** | Your session — runs SQL for one connection |
| **WAL writer** | Helps flush WAL efficiently |
| **Checkpointer** | Writes dirty buffers out; advances checkpoints |
| **Background writer** | Writes dirty buffers between checkpoints |
| **Autovacuum launcher** | Starts workers that clean dead tuples |
| **I/O workers** (v16+) | Assist asynchronous I/O paths |

Names in `pg_stat_activity.backend_type` are the practical labels.

## See it

```console
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

> Verified: 2026-08 on **PostgreSQL 18.4**. Counts vary with load and config.

## From Node

```js
// backends.mjs
import pg from 'pg';

const pool = new pg.Pool({
  connectionString:
    'postgresql://devbible:devbible@127.0.0.1:55432/devbible',
});

const {rows} = await pool.query(`
  select backend_type, count(*)::int as n
  from pg_stat_activity
  group by 1
  order by 1
`);
console.table(rows);
await pool.end();
```

Same catalog view, same truth. Application code almost never starts these
workers — the server does.

## Why Know, not Master

You ship apps without memorizing every worker. You **do** need to know that:

- client backends scale with connections  
- autovacuum is why updates/deletes do not free space instantly (Phase 11)  
- a stuck checkpointer or WAL issue is an ops signal (Phase 13)

## Gotchas

**Symptom:** Host shows dozens of `postgres` processes  
**Cause:** Normal — one per connection plus workers  
**Fix:** Do not kill random PIDs; reduce connections / use a pooler

**Symptom:** Autovacuum “using CPU” after bulk load  
**Cause:** Expected cleanup of dead tuples / stats  
**Fix:** Phase 11; bulk-load patterns reduce churn

## Interview questions

**★ What process runs your SQL?**  
A **client backend** dedicated to your connection.

**What is the postmaster?**  
The supervisor process that listens and forks backends (implementation detail;
managed by the service/container).

**Why can `pg_stat_activity` show non-client backends?**  
Background workers share the view; filter on `backend_type` or `datname`.

---

← [Connections and auth](08-connection-and-auth.md) · Next → [Version policy](10-version-policy.md)
