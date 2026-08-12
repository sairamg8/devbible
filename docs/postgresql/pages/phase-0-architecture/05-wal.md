---
title: "WAL — write-ahead log"
sidebar_label: "05 · WAL"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

**Every committed change is recorded in the write-ahead log (WAL) before it is
treated as durable.** That is why crash recovery works, and why “the write cost”
of indexes and heavy updates is not only the table file.

## Why it exists

If PostgreSQL only updated data pages in place and the machine lost power
mid-write, you could not tell which pages were half-written. WAL appends a
sequential log of changes first; after a crash, replay brings data files to a
consistent state.

Durability, concretely: **`COMMIT` succeeds only after the needed WAL is flushed**
(under default synchronous settings).

## The double write (conceptually)

1. You `UPDATE` a row.  
2. PostgreSQL writes a WAL record describing the change.  
3. On commit, WAL is flushed to durable storage.  
4. Data pages in shared buffers are marked dirty and written out **later**
   (checkpoints / background writer).

So a change is “written twice” over its life: once to WAL (immediately for
durability), again to the heap/index files (lazily). That is normal, not a bug.

## See the setting

```console
$ psql -h 127.0.0.1 -p 55432 -U devbible -d devbible -c "show wal_level;"
 wal_level
-----------
 replica
```

> Verified: 2026-08 on **PostgreSQL 18.4**. `replica` is the usual default and
> supports physical replication.

## From Node

```js
// commit.mjs
import pg from 'pg';

const pool = new pg.Pool({
  connectionString:
    'postgresql://devbible:devbible@127.0.0.1:55432/devbible',
});

await pool.query(`
  create table if not exists wal_demo (
    id bigint generated always as identity primary key,
    note text not null
  )
`);

const {rows} = await pool.query(
  `insert into wal_demo (note) values ($1) returning id, note`,
  ['hello wal'],
);
console.log(rows[0]);
await pool.end();
```

```console
$ node commit.mjs
{ id: '1', note: 'hello wal' }
```

When `query` resolves after an `INSERT`, the server has accepted the change under
its durability rules. You do not flush WAL from Node yourself — you **choose
transaction boundaries** and accept the I/O cost of commits.

> Note: `id` arrives as a **string** from `pg` for `bigint`. Type mapping is
> Phase 2 / Phase 7; do not “fix” it with `parseInt` blindly for large values.

## Trade-off

WAL buys crash safety and replication. It costs sequential write I/O on every
commit and disk space for WAL segments. Turning durability off for speed is a
conscious, rare trade (and not the default for production app data).

## Gotchas

**Symptom:** Disk fills with WAL / pg_wal growth  
**Cause:** Replication slot holding WAL, failed archive, or checkpoints lagging  
**Fix:** Ops territory (Phase 13); never delete WAL files by hand

**Symptom:** Many tiny commits from Node feel slow  
**Cause:** Each commit may flush WAL  
**Fix:** Batch work in transactions; bulk-load patterns in Phase 8

## Interview questions

**★ What is WAL?**  
The write-ahead log: a sequential record of changes flushed so the database can
recover after a crash and stream changes to replicas.

**★ Why is a change “written twice”?**  
Once to WAL for durability/order, later to data files via dirty buffers and
checkpoints.

**Does `BEGIN` alone write WAL?**  
Starting a transaction is cheap; **modifying** data generates WAL; **commit**
makes it durable.

**How does this affect a Node API?**  
Prefer sensible transaction size: not one commit per cell update in a loop, and
not multi-minute transactions that hold resources (Phase 11).

---

← [Shared buffers](04-shared-buffers.md) · Next → [Roles](06-roles.md)
