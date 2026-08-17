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

You do not configure shared buffers from `pg`. You **observe** effects — but
observing them correctly is harder than it looks, and the obvious experiment is
wrong.

**Do not time a first query against a second one.** The first query on a fresh
`Pool` also pays for the TCP connect, the SCRAM authentication round trips, the
backend `fork()`, and the catalog cache that backend builds privately. All of
that is work the second query never repeats, and none of it is the buffer cache.
A wall-clock gap between the two is real, but it is overwhelmingly connection
setup — attributing it to shared buffers is measuring one thing and naming
another.

The buffer cache has its own counters, so ask it directly instead of timing it.
On **one connection that is already warm**, run the same query twice under:

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;
```

and read the `Buffers:` line. A cold run reports `shared read=N` — pages fetched
from the OS or disk. The identical query re-run reports `shared hit=N` — the
same pages found in shared buffers. That `read=` → `hit=` shift *is* the buffer
cache and nothing else, because everything around it is held constant.

`pg_statio_user_tables` gives the same story cumulatively per table
(`heap_blks_read` vs `heap_blks_hit`) if you want it across a workload rather
than one query.

> Verified: 2026-08 against the PostgreSQL 18 documentation for `EXPLAIN`
> (`BUFFERS`) and `pg_statio_all_tables`. **This page carries no measurement of
> its own** — the timing comparison that used to sit here measured connection
> establishment, not the buffer cache, and was removed rather than reinterpreted.

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
