---
title: "Table locks and DDL"
sidebar_label: "10 · Table locks and DDL"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex29-locks.mjs`.

**Most DDL takes `ACCESS EXCLUSIVE`, which conflicts with everything including plain
`SELECT`. Whether that causes an outage depends on two things: how long the statement
runs, and — far more dangerous — whether it can get the lock at all, because a DDL
statement waiting for a lock blocks every query that arrives behind it.**

## What each statement locks, and for how long

200 000-row table, `lock_timeout = 300ms` on a concurrent reader:

```console
$ node ex29-locks.mjs
=== 6. what DDL locks, and for how long ===
ADD COLUMN (no default)                    0.6 ms | AccessExclusiveLock    | reads BLOCKED (55P03)
ADD COLUMN with a constant default         2.0 ms | AccessExclusiveLock    | reads BLOCKED (55P03)
ADD COLUMN with a volatile default       319.2 ms | AccessExclusiveLock+ShareLock | reads BLOCKED (55P03)
ALTER TYPE int -> bigint                 325.8 ms | AccessExclusiveLock+ShareLock | reads BLOCKED (55P03)
ALTER TYPE int -> text                   344.6 ms | AccessExclusiveLock+ShareLock | reads BLOCKED (55P03)
CREATE INDEX                             103.7 ms | ShareLock              | reads OK
DROP COLUMN                                1.0 ms | AccessExclusiveLock    | reads BLOCKED (55P03)
VALIDATE-free CHECK (NOT VALID)            1.4 ms | AccessExclusiveLock    | reads BLOCKED (55P03)
```

The split that matters is **metadata-only versus table rewrite**:

- **Metadata-only (0.6–2 ms):** `ADD COLUMN`, `ADD COLUMN … DEFAULT 7`, `DROP COLUMN`,
  `ADD CONSTRAINT … NOT VALID`. These take `ACCESS EXCLUSIVE` but hold it for
  milliseconds. Since PostgreSQL 11 a **constant** default is stored as metadata rather
  than written to every row — 2.0 ms here for 200 000 rows.
- **Rewrite (319–345 ms and scaling with table size):** a **volatile** default like
  `random()` must be materialised per row, and any type change that is not
  binary-coercible rewrites the whole table. At 200 000 rows this is a third of a
  second; at 200 million it is an outage.

`CREATE INDEX` is the exception in the other direction: `SHARE` rather than
`ACCESS EXCLUSIVE`, so **reads kept working** — but writes did not. Use
[`CREATE INDEX CONCURRENTLY`](../phase-10-indexes/12-concurrently.md) to keep those
working too.

`DROP COLUMN` at 1.0 ms is worth noting: it does not reclaim space, it marks the column
dropped. The data stays until the rows are rewritten.

## The real danger: the lock queue

A DDL statement that cannot get its lock does not wait politely off to one side. **It
queues, and everything arriving after it queues behind it** — even statements that would
not have conflicted with the current holder:

```console
=== 7. a blocked ALTER queues everything behind it ===
a plain SELECT behind the ALTER → 55P03 canceling statement due to lock timeout after 401.3 ms
  lock queue: [{"mode":"AccessShareLock","granted":true},{"mode":"AccessExclusiveLock","granted":false}]
```

The sequence: one open transaction holds `ACCESS SHARE` from an ordinary `SELECT`; an
`ALTER TABLE` requests `ACCESS EXCLUSIVE` and waits; a new plain `SELECT` arrives — and
is blocked, despite `ACCESS SHARE` being perfectly compatible with the `ACCESS SHARE`
already granted. PostgreSQL will not let it jump the queue ahead of the waiting `ALTER`.

**This is how a two-millisecond `ADD COLUMN` takes a site down.** The migration itself is
instant; it just cannot start, because one long-running query holds the table, and every
request behind it stacks up until the connection pool is empty.

## The safe migration pattern

```sql
SET lock_timeout = '3s';      -- never queue for more than 3 seconds
ALTER TABLE orders ADD COLUMN note text;
```

If the lock does not arrive in 3 seconds, the statement fails with `55P03` and the queue
drains — instead of accumulating for the length of some analytics query. Retry in a loop:

```js
async function migrateWithRetry(pool, sql, tries = 10) {
  for (let i = 1; ; i++) {
    const c = await pool.connect();
    try {
      await c.query(`SET lock_timeout = '3s'`);
      await c.query(sql);
      return;
    } catch (e) {
      if (e.code !== '55P03' || i === tries) throw e;
      await sleep(2000 * i);          // let the blocker finish
    } finally { c.release(); }
  }
}
```

Before running DDL, check what would block it:

```sql
SELECT pid, state, now() - xact_start AS xact_age, left(query, 60) AS query
FROM pg_stat_activity
WHERE datname = current_database() AND pid <> pg_backend_pid()
  AND state <> 'idle'
ORDER BY xact_start;
```

## Rewriting expensive changes as cheap ones

| Instead of | Do this | Why |
|---|---|---|
| `ADD COLUMN … DEFAULT random()` | `ADD COLUMN`, then backfill in batches, then `SET DEFAULT` | avoids the rewrite (measured 319 ms → 0.6 ms) |
| `ALTER COLUMN … TYPE text` | add a new column, backfill, swap names | avoids a full-table rewrite under `ACCESS EXCLUSIVE` |
| `ADD CONSTRAINT … CHECK (…)` | `ADD CONSTRAINT … NOT VALID`, then `VALIDATE CONSTRAINT` | `NOT VALID` is 1.4 ms; `VALIDATE` scans under a weaker `SHARE UPDATE EXCLUSIVE` |
| `ALTER COLUMN … SET NOT NULL` | add a `CHECK (col IS NOT NULL) NOT VALID`, validate, then `SET NOT NULL` | PostgreSQL 12+ uses the validated check to skip the scan |
| `CREATE INDEX` | `CREATE INDEX CONCURRENTLY` | keeps writes working |

The principle in all five: **split one long lock into a short lock plus work done
without one.**

## Trade-off

**`lock_timeout` converts a possible outage into a failed migration**, and that is the
trade you want — a retryable failure is strictly better than a queue that empties the
connection pool. The cost is migrations that need retry logic and may need several
attempts on a busy system. The cost of the alternative is measured above: one `SELECT`
holding the table turned a 2 ms `ALTER` into a total block on the table.

## Gotchas

**Symptom:** A trivial `ALTER TABLE` caused a site-wide outage
**Cause:** It could not get its lock, and every later query queued behind it
**Fix:** `SET lock_timeout` before all DDL, and retry

**Symptom:** `ADD COLUMN` with a default took minutes on a large table
**Cause:** The default is volatile (`random()`, `now()` in some forms), forcing a rewrite
**Fix:** Add the column without a default, backfill in batches, then `SET DEFAULT`

**Symptom:** `ALTER COLUMN TYPE` locked the table for the whole rewrite
**Cause:** The type change is not binary-coercible, so every row is rewritten
**Fix:** New column, backfill, swap — or accept the outage in a maintenance window

**Symptom:** `DROP COLUMN` freed no disk space
**Cause:** It only marks the column dropped; data stays until rows are rewritten
**Fix:** `VACUUM FULL` or a table rewrite, when the space actually matters

**Symptom:** Reads keep working during `CREATE INDEX` but writes hang
**Cause:** `SHARE` blocks writers, not readers — measured
**Fix:** `CREATE INDEX CONCURRENTLY`

**Symptom:** A migration in a long transaction blocks everything for its full duration
**Cause:** DDL locks are held to commit, like any other lock
**Fix:** One DDL statement per transaction; never bundle a migration with slow work

## Interview questions

**★ Why can a 2 ms `ALTER TABLE` take a site down?**
Because it must wait for `ACCESS EXCLUSIVE`, and while it waits every new query on that
table queues behind it — even `SELECT`s that would not conflict with the current holder.
Measured: a plain `SELECT` blocked and hit `55P03` behind a waiting `ALTER`.

**★ Which DDL rewrites the table?**
Type changes that are not binary-coercible and columns added with a volatile default —
measured 319–345 ms on 200 000 rows. Adding a column with a *constant* default is
metadata-only since PostgreSQL 11 (2.0 ms).

**★ How do you make migrations safe on a busy table?**
`SET lock_timeout` to a few seconds, retry with backoff, and split expensive changes
into a short lock plus unlocked work (`NOT VALID` then `VALIDATE`, backfill then
`SET DEFAULT`, `CREATE INDEX CONCURRENTLY`).

**★ What lock does `CREATE INDEX` take?**
`SHARE` — reads continue, writes block. Measured: concurrent reads succeeded throughout.
`CONCURRENTLY` drops to a lock that permits writes, at the cost of two table scans.

**Does `DROP COLUMN` reclaim space?**
No. It is a catalog change; the data remains in the existing row versions until they are
rewritten.

**How do you find what is blocking your migration?**
`pg_stat_activity` ordered by `xact_start` for the oldest transaction, and
`pg_blocking_pids()` for the direct blocker.

**Why put `SET lock_timeout` in the migration rather than globally?**
A global value affects ordinary queries that legitimately wait for row locks. Migrations
are the case where failing fast is better than waiting.

---

← [Savepoints](09-savepoints.md) · Next → [Deadlocks](11-deadlocks.md)
