---
title: "TEMPORARY and UNLOGGED tables"
sidebar_label: "16 · TEMP and UNLOGGED"
sidebar_position: 16
---

<span className="db-tier t-know">Should Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex13-constraints-rel.mjs`.

**Both trade durability for speed, in different ways. `UNLOGGED` skips the
write-ahead log and is emptied on crash recovery; `TEMPORARY` is private to one
session and disappears with it.**

## The speed difference

100 000 inserts into the same shape of table:

```console
$ node ex13-constraints-rel.mjs
=== 6. TEMP and UNLOGGED ===
LOGGED                      150 ms
UNLOGGED                     98 ms
```

**About 1.5× faster.** Useful, and smaller than people expect — because the WAL
write is sequential and often the cheapest part of an insert. Do not reach for
`UNLOGGED` expecting an order of magnitude; if inserts are slow, the cause is far
more likely to be per-row round trips
([Bulk insert that scales](../phase-8-schema-from-node/04-bulk-insert.md), where the
spread was 240×).

The saving grows with index count and row width, since every index change is WAL
logged too.

## `UNLOGGED` — what "not durable" actually means

- **Not crash-safe.** On an unclean shutdown the table is **truncated**, not
  restored. Not "possibly stale" — empty.
- **Not replicated.** Physical replicas never receive the contents, so an unlogged
  table is empty on every standby, and after a failover.
- Survives a *clean* restart. Only crash recovery truncates it.

That makes it right for data you can regenerate and wrong for anything else:

- **Load staging** — `COPY` into an unlogged table, validate, then insert into the
  real one ([`COPY FROM STDIN`](../phase-8-schema-from-node/09-copy-streams.md)).
- **Derived caches and materialised intermediate results** you rebuild on a schedule.
- **Test fixtures**, where losing the data is the point.

Switching an existing table costs a full rewrite under `ACCESS EXCLUSIVE` —
measured at 230 ms per 200 000 rows in [`ALTER TABLE`](05-alter-table.md):

```sql
ALTER TABLE t SET UNLOGGED;   -- rewrites
ALTER TABLE t SET LOGGED;     -- rewrites, and writes the whole table to WAL
```

The `SET LOGGED` direction is the expensive one — the entire table becomes WAL
traffic at once, which can saturate replication. A trick sometimes used for bulk
loads (`SET UNLOGGED`, load, `SET LOGGED`) usually costs more in the two rewrites
than it saves.

## `TEMPORARY` — private to the session

```console
temp table visible on its own session: 1 row
from another pooled connection → 42P01 relation "tmp_t" does not exist
temp schema for this session: pg_temp_64
```

Each session gets its own schema (`pg_temp_64` here) placed ahead of `public` on the
`search_path`. Two sessions can create `tmp_t` with different columns and neither
sees the other's.

**That name resolution is the sharp edge**: a temp table named `users` shadows the
real `users` table for that session. Every query in that connection silently reads
the temp one. Prefix temp tables distinctly.

### Temp tables and connection pooling

This is the part that breaks in a Node application. `pg` hands you an arbitrary
pooled connection per query, so:

```js
await pool.query('CREATE TEMP TABLE staging (...)');   // connection A
await pool.query('INSERT INTO staging ...');           // connection B → 42P01
```

Measured above as exactly that error from a second pooled connection. Temp tables
require a **checked-out client for their whole lifetime**:

```js
const client = await pool.connect();
try {
  await client.query('CREATE TEMP TABLE staging (...) ON COMMIT DROP');
  await client.query('INSERT INTO staging ...');
  await client.query('INSERT INTO real_table SELECT ... FROM staging');
} finally {
  client.release();
}
```

**`ON COMMIT DROP` matters more than it looks.** A pooled connection is reused, and
a temp table left behind survives into the next unrelated request that borrows that
connection — which is both a correctness problem and a slow leak of temp files. The
options are `ON COMMIT PRESERVE ROWS` (default), `ON COMMIT DELETE ROWS`, and
`ON COMMIT DROP`; in a pooled application, choose `DROP`.

Temp tables also live in `temp_buffers` (default 8 MB) rather than `shared_buffers`,
so a large one spills to disk regardless of how much RAM the server has.

## Which one, or neither

| Need | Use |
|---|---|
| Scratch data for one request, private | `TEMPORARY` on a checked-out client, `ON COMMIT DROP` |
| Regenerable data shared across sessions | `UNLOGGED` |
| Intermediate result inside one query | A CTE or subquery — no table at all |
| Anything a user would miss | A normal table |

The most common mistake is reaching for a temp table where a CTE would do. If the
data is only needed within one statement, `WITH staging AS (…)` avoids the DDL, the
lock, the catalog churn and the pooling problem entirely — and creating temp tables
in a hot path generates real catalog bloat.

## Trade-off

`UNLOGGED` buys ~1.5× on writes and costs you the data on any crash, plus its
absence on every replica. That ratio is only worth it when losing the table is
genuinely fine — and "fine" must include "fine at 3 a.m. after an unplanned
failover", which is where people discover the replica copy was empty all along.

`TEMPORARY` buys real isolation and costs you compatibility with connection pooling,
plus catalog churn if used frequently. In a pooled Node service it is a deliberate
technique requiring a held client, not a convenience.

## Gotchas

**Symptom:** `42P01 relation "staging" does not exist` immediately after creating it
**Cause:** The `CREATE` and the `INSERT` went to different pooled connections —
measured.
**Fix:** `pool.connect()` and use that one client throughout.

**Symptom:** An unrelated request sees leftover temp data
**Cause:** A temp table outlived its request on a reused pooled connection.
**Fix:** `ON COMMIT DROP`, or drop it explicitly before `release()`.

**Symptom:** An unlogged table is empty after a crash
**Cause:** Working as designed — crash recovery truncates unlogged tables.
**Fix:** Only use `UNLOGGED` for regenerable data.

**Symptom:** An unlogged table is empty on the replica
**Cause:** Unlogged tables are not replicated at all.
**Fix:** A normal table if any replica or failover needs the data.

**Symptom:** Queries in one connection read the wrong `users` table
**Cause:** A temp table shadows a permanent one via the temp schema on
`search_path`.
**Fix:** Distinct names for temp tables.

**Symptom:** `SET LOGGED` caused a replication spike
**Cause:** The whole table is rewritten and written to WAL at once.
**Fix:** Expect it; both directions rewrite — measured 230 ms per 200k rows.

**Symptom:** Temp table operations spill to disk on a machine with plenty of RAM
**Cause:** Temp tables use `temp_buffers` (default 8 MB), not `shared_buffers`.
**Fix:** Raise `temp_buffers` for that session, or use a CTE.

## Interview questions

**★ What is the difference between `TEMPORARY` and `UNLOGGED`?**
`TEMPORARY` is visible to one session only and dropped when it ends. `UNLOGGED` is a
normal, shared, permanent table that skips the write-ahead log — it survives a clean
restart but is **truncated** on crash recovery and is never replicated.

**★ How much faster is `UNLOGGED`?**
Measured ~1.5× on 100 000 inserts (150 ms → 98 ms). Less than most people expect,
because WAL writes are sequential. If inserts are slow, per-row round trips are a far
more likely cause — that spread was 240×.

**★ Why do temp tables break under connection pooling?**
Each pooled query may land on a different connection, and a temp table exists only
in the session that created it — measured, a second pooled connection got
`42P01 relation does not exist`. You must hold one checked-out client for the
table's whole lifetime.

**★ What does `ON COMMIT DROP` protect against?**
A temp table surviving on a pooled connection into the next, unrelated request that
borrows it — leaking both data and temp files. In a pooled application it should be
the default choice.

**★ When would you not use either?**
When a CTE or subquery would do. If the intermediate result is needed only within one
statement, `WITH x AS (…)` avoids the DDL, the lock, the catalog churn and the
pooling problem. Creating temp tables in a hot path causes real catalog bloat.

**Is `SET UNLOGGED`, bulk load, `SET LOGGED` a good trick?**
Rarely. Both directions rewrite the table, and `SET LOGGED` writes the entire table
to WAL at once — usually costing more than the load saved, and potentially
saturating replication.

---

← [Generated columns](15-generated-columns.md) · Next → [`COMMENT ON`](17-comments.md)
