---
title: "MVCC: row versions and snapshots"
sidebar_label: "05 · MVCC snapshots"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex28-mvcc-isolation.mjs`.

**PostgreSQL never overwrites a row. An `UPDATE` writes a new version and marks the old
one as ending; a `DELETE` only marks. Which versions you can see is decided by a
snapshot. That single design choice explains why readers never block writers, why
tables grow when you update them, and why [VACUUM](13-vacuum.md) exists at all.**

## Every row carries its own visibility data

`xmin` is the transaction that created this version, `xmax` the one that ended it,
`ctid` the physical (page, slot) address:

```console
$ node ex28-mvcc-isolation.mjs
=== 1. UPDATE = a new row version, and the old one is only marked dead ===
after INSERT       {"ctid":"(0,1)","xmin":"49683","xmax":"0","v":10}
after UPDATE       {"ctid":"(0,2)","xmin":"49684","xmax":"0","v":20}
after 2nd UPDATE   {"ctid":"(0,3)","xmin":"49685","xmax":"0","v":30}
```

**The `ctid` moves with every `UPDATE`** — `(0,1)` → `(0,2)` → `(0,3)`. Three physical
row versions now exist for one logical row. The first two are dead: invisible to new
transactions, still occupying space until VACUUM reclaims it.

You can query these columns directly, which is the fastest way to see what an update
actually did:

```sql
SELECT ctid, xmin, xmax, * FROM m_row WHERE id = 1;
```

A `DELETE` writes no new version — it only stamps `xmax`:

```console
mid-DELETE, own view : 0 rows
mid-DELETE, other tx : {"ctid":"(0,3)","xmin":"49685","xmax":"49686"} <- xmax set, still visible elsewhere
after ROLLBACK       : 30
```

The deleting transaction sees zero rows; every other session still sees the row, because
`xmax = 49686` refers to a transaction that has not committed. On `ROLLBACK` the row is
simply visible again — nothing had to be restored.

## Why readers never block writers

```console
=== 2. a reader in a transaction does not block a writer (and vice versa) ===
UPDATE while a reader holds an open transaction: 2.8 ms (no wait)
```

The writer creates a *new* version, so it never touches the one the reader is looking
at. There is no shared read lock to conflict with, and no lock escalation. This is the
main practical advantage of MVCC over lock-based isolation, and it is why a long
analytical `SELECT` does not stall your writes.

The flip side, and the whole content of [VACUUM](13-vacuum.md): those old versions have
to be cleaned up by someone, later.

## The snapshot: xmin, xmax, and the in-progress list

A snapshot is three things — the oldest transaction still running, the first id not yet
completed, and the list of ids in progress in between:

```console
=== 3. the snapshot — xmin, xmax and the in-progress list ===
nothing running                    50181:50181:
b (older, xid 50181) open          50181:50181:
b 50181 and c 50182 both open      50181:50181:
c 50182 committed, b 50181 open    50181:50183:50181
both committed                     50183:50183:
  format is xmin:xmax:in-progress. xmax is one past the last COMPLETED
  transaction, so 50182 needed no list entry while it was the newest — but
  once it committed ahead of 50181, the older 50181 had to be listed explicitly.
```

The rule the observer applies to every row version: **a version is visible if its
`xmin` committed before the snapshot and is not in the in-progress list, and its `xmax`
is either absent or belongs to a transaction that had not committed.**

The subtlety worth keeping: `xmax` is one past the last *completed* transaction, not the
last *assigned* one. While `50182` was the newest running id it sat above `xmax` and
needed no list entry. Only when it committed ahead of the older `50181` did the list
have to name `50181` explicitly. That is why the in-progress list stays short even on a
busy server: it holds only transactions older than something that already finished.

## HOT updates — the optimisation that decides how fast a table bloats

A new row version normally means a new index entry too, in every index on the table.
**Heap-Only Tuple** updates avoid that: if the new version fits on the same page and no
indexed column changed, PostgreSQL chains it to the old one and leaves the indexes
untouched. Whether that happens is measurable, and mostly under your control:

```console
=== 4. HOT updates — an indexed column changes everything ===
fillfactor 100 (default), no index on v: 4128 kB ->  24 MB | upd 250000 hot 213 (0.1%)
fillfactor 70,             no index on v: 5976 kB ->  13 MB | upd 250000 hot 191547 (76.6%)
fillfactor 70,   index ON the updated col: 5976 kB ->  13 MB | upd 250000 hot 0 (0.0%)
```

50 000 rows, updated five times each. Three results:

- **Default `fillfactor = 100` gives you almost no HOT updates (0.1%)** — pages are
  packed full at load time, so there is no room for a new version beside the old one.
  The table went from 4 MB to 24 MB.
- **`fillfactor = 70` leaves 30% of each page free and 76.6% of the updates became
  HOT** — the same workload ended at 13 MB, nearly half the size.
- **An index on the updated column disables HOT entirely (0%)** — the index must point at
  the new version, so the optimisation cannot apply, whatever the fillfactor.

```sql
-- for a table whose rows are updated often
ALTER TABLE m_hot SET (fillfactor = 70);
VACUUM FULL m_hot;   -- rewrites with the new fillfactor; takes ACCESS EXCLUSIVE
```

The design rule that follows: **do not index a column you update constantly.** A
`last_seen_at` or `status` column with an index on it turns every update into an index
write and forfeits HOT.

## Trade-off

**MVCC buys lock-free reads with disk space and background work.** Every update leaves
a corpse that VACUUM must collect, tables grow faster than their live row count
suggests, and a single long transaction can stop the collection entirely
([measured here](12-long-transactions.md)). `fillfactor` lets you trade space at load
time for far less bloat later — 30% empty pages up front against 24 MB → 13 MB after a
few rounds of updates. Neither setting is free; the default (100) is right for
append-mostly tables and wrong for hot ones.

## Gotchas

**Symptom:** A table is much larger than its row count justifies
**Cause:** Dead row versions from updates; every `UPDATE` writes a whole new row
**Fix:** Check `n_dead_tup`, then [VACUUM](13-vacuum.md); lower `fillfactor` for update-heavy tables

**Symptom:** `UPDATE` on one small column rewrites the entire row
**Cause:** MVCC has no partial update — a new version always contains every column
**Fix:** Split rarely-updated wide columns into their own table if the row is large

**Symptom:** `fillfactor` changed but nothing improved
**Cause:** It only applies to pages written after the change
**Fix:** `VACUUM FULL` or rewrite the table to apply it to existing pages

**Symptom:** HOT update rate is 0% however the table is tuned
**Cause:** One of the updated columns is indexed
**Fix:** Drop the index on the hot column, or accept the index maintenance cost

**Symptom:** `ctid` used as a stable row identifier breaks
**Cause:** `ctid` changes on every update and after `VACUUM FULL`
**Fix:** Use the primary key; `ctid` is only valid within one statement

## Interview questions

**★ What does an `UPDATE` physically do in PostgreSQL?**
Writes a new row version with a new `ctid` and stamps the old version's `xmax`. The old
version stays on disk until VACUUM reclaims it. Measured: `(0,1)` → `(0,2)` → `(0,3)`
across two updates.

**★ Why don't readers block writers?**
The writer creates a new version rather than modifying the one being read, so there is
nothing to contend on. Measured: an `UPDATE` completed in 2.8 ms with a reader holding
an open transaction.

**★ What is in a snapshot?**
`xmin:xmax:in-progress` — the oldest still-running transaction, one past the last
completed one, and the list of ids in between that are still running. A row version is
visible if its creating transaction committed before the snapshot and its deleting
transaction had not.

**★ What is a HOT update and what prevents one?**
An update whose new version fits on the same page and touches no indexed column, so no
index entry is written. It is prevented by a full page (`fillfactor = 100`, measured
0.1% HOT) or by an index on an updated column (measured 0%).

**★ How does `fillfactor` affect update-heavy tables?**
It reserves free space on each page for future versions. Measured: the same 250 000
updates produced a 24 MB table at fillfactor 100 and 13 MB at 70, with HOT rising from
0.1% to 76.6%.

**Is `ctid` a usable row identifier?**
No. It is the physical address and changes on every update and on `VACUUM FULL`. It is
useful for batching within a single statement — nothing else.

**What happens to the new row version if the transaction rolls back?**
Nothing is undone. The version stays on disk with an `xmin` belonging to an aborted
transaction, which makes it invisible to everyone, and VACUUM removes it later.

---

← [Lost update](04-lost-update.md) · Next → [REPEATABLE READ SERIALIZABLE](06-isolation-levels.md)
