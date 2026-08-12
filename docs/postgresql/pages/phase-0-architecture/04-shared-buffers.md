---
title: "Shared buffers and the page cache"
sidebar_label: "04 · Shared buffers"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

**When you `SELECT` a row, PostgreSQL almost never reads straight from a bare
disk path into your client.** Data pages pass through **shared buffers** (the
server’s buffer cache) and usually the **OS page cache** as well.

## Why it exists

Disk I/O is slow. Caching hot pages in memory makes repeated reads cheap. You
pay with RAM configuration (`shared_buffers`) and the complexity of knowing that
“the row” has more than one home over its lifetime.

## Where a row lives

| Location | Role |
|---|---|
| **Disk (data files)** | Durable copy of table/index pages |
| **OS page cache** | Kernel caches file pages the server read or wrote |
| **Shared buffers** | PostgreSQL’s own cache of 8 KB pages, shared by backends |
| **Backend private memory** | Sort/hash work (`work_mem`), not the main row cache |
| **Client (`pg` / `psql`)** | Only the result rows you asked for |

A read that is already in shared buffers is a memory hit. A miss may still be
fast if the OS cache has the page. Cold start after reboot is when you feel disk.

## See the setting

```console
$ psql -h 127.0.0.1 -p 55432 -U devbible -d devbible -c "show shared_buffers;"
 shared_buffers
----------------
 128MB
```

> Verified: 2026-08 on **PostgreSQL 18.4** alpine defaults (`128MB` is common in
> small containers — production is tuned higher).

## From Node

You do not configure shared buffers from `pg`. You **observe** effects: first
query after idle vs warm repeat. Pooling does not replace server cache; it only
reuses backends.

```js
// warm-read.mjs — conceptual timing, not a benchmark harness
import pg from 'pg';

const pool = new pg.Pool({
  connectionString:
    'postgresql://devbible:devbible@127.0.0.1:55432/devbible',
});

async function once(label) {
  const t0 = performance.now();
  await pool.query('select count(*) from pg_class');
  console.log(label, (performance.now() - t0).toFixed(2), 'ms');
}

await once('first');
await once('second');
await pool.end();
```

```console
$ node warm-read.mjs
first 44.52 ms
second 2.64 ms
```

> Verified: 2026-08 on this machine. Absolute ms move with load; the **shape**
> matters: second call is cheaper because catalogs (and paths) are warm. Do not
> put micro-benchmarks in production SLOs without a proper harness.

## Trade-off

Larger `shared_buffers` can cut disk reads; too large fights the OS cache and
wastes RAM other processes need. Defaults are a starting point — Phase 13 covers
tuning keys, not Phase 0.

## Gotchas

**Symptom:** “I restarted the container and everything is slow”  
**Cause:** Cold shared buffers + cold OS cache  
**Fix:** Expected after restart; warm with real traffic or a controlled prime

**Symptom:** App memory grows and people blame `pg`  
**Cause:** Confusing Node heap with PostgreSQL’s separate server RAM  
**Fix:** Measure the **server** (`shared_buffers`, RSS of postgres processes), not only the Node process

## Interview questions

**★ What are shared buffers?**  
PostgreSQL’s shared memory cache of table/index pages used by all backends.

**Does a `SELECT` always hit the disk?**  
No. Hot pages are served from shared buffers and/or the OS page cache.

**Who owns the OS page cache?**  
The kernel. PostgreSQL benefits from it but does not manage it as its own API.

**Why does connection pooling not replace shared buffers?**  
Pooling reuses **backends**; shared buffers cache **data pages**. Different layers.

---

← [Namespace](03-namespace.md) · Next → [WAL](05-wal.md)
