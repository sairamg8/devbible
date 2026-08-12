---
title: "DDL locks and the blocking they cause"
sidebar_label: "02 · Locks and blocking"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex7-ddl-locks.mjs`.

**Chapter 2 of [Creating tables from Node](README.md).** Chapter 1 worked because
one process was talking to an idle database. This is what the same statements do to
a table that is being read.

## Which lock does DDL take?

```js
const probe = async (label, sql) => {
  const c = await pool.connect();
  await c.query('BEGIN');
  await c.query(sql);
  const {rows} = await c.query(
    `SELECT mode FROM pg_locks l JOIN pg_class c ON c.oid = l.relation
      WHERE c.relname = 'lk_items' AND l.pid = pg_backend_pid()`,
  );
  console.log(label, rows.map((r) => r.mode).join(', '));
  await c.query('ROLLBACK');
  c.release();
};
```

```console
$ node ex7-ddl-locks.mjs
=== 1. lock modes actually taken ===
SELECT                       AccessShareLock
INSERT                       RowExclusiveLock
ALTER TABLE ADD COLUMN       AccessExclusiveLock
CREATE INDEX                 ShareLock
```

`ACCESS EXCLUSIVE` is the strongest lock PostgreSQL has: it conflicts with *every*
other lock mode, including the `ACCESS SHARE` that a plain `SELECT` takes. While
`ALTER TABLE` holds it, nothing else can read or write that table.

`CREATE INDEX` takes the weaker `ShareLock` — it blocks writes but permits reads.
`CREATE INDEX CONCURRENTLY` weakens it further to permit writes too, at the cost of
two table scans and an inability to run inside a transaction.

## The incident: a 12 ms migration causing a 3-second outage

This is the part that is hard to believe until you have watched it. A long-running
read holds `ACCESS SHARE`. An `ALTER TABLE` arrives and must wait. **And every
query that arrives after the `ALTER` also waits — including plain `SELECT`s that
would not have conflicted with the read at all.**

```js
// A: a long read holds ACCESS SHARE for 3 s
// B: 300 ms later, ALTER TABLE lk_items ADD COLUMN note2 text
// C1, C2: 600 ms later, ordinary SELECT count(*)
```

```console
=== 3. a long read, then an ALTER, then more reads ===
    2 ms  A: long read started, holds ACCESS SHARE
  315 ms  B: ALTER TABLE issued
  617 ms  C1: plain SELECT issued
  617 ms  C2: plain SELECT issued
 1234 ms  sessions waiting on a lock: 3
 3003 ms  A: long read committed
 3015 ms  B: ALTER TABLE done
 3017 ms  C2: plain SELECT returned
 3017 ms  C1: plain SELECT returned
```

Read the timeline carefully:

- The `ALTER` itself took **12 ms** (3003 → 3015). It was never slow.
- `C1` and `C2` are ordinary reads that would happily have run alongside `A` — two
  `ACCESS SHARE` locks do not conflict. They were issued at 617 ms and returned at
  3017 ms: **blocked for 2.4 seconds by a migration that took 12 ms.**
- At 1234 ms, three sessions were waiting on a lock.

The mechanism is the **lock queue**. PostgreSQL grants locks in order of request to
avoid starving strong lockers. Once `ALTER TABLE` is queued for `ACCESS EXCLUSIVE`,
every later request queues behind it, even ones compatible with the lock currently
held. One slow query plus one innocuous migration equals a full table stall — and
in an API, that means every connection in the pool parked on the same table until
the pool is exhausted and the errors become `sorry, too many clients already`,
which points at the pool rather than at the migration that caused it.

### The seatbelt: `lock_timeout`

Never let a migration wait indefinitely for a lock. Bound the wait, fail, and
retry later.

```js
await c2.query(`SET lock_timeout = '500ms'`);
await c2.query('ALTER TABLE lk_items ADD COLUMN note3 text');
```

```console
=== 4. lock_timeout ===
with lock_timeout=500ms → 55P03 | canceling statement due to lock timeout
```

`55P03` is `lock_not_available`. The migration failed and — because of transactional
DDL — left nothing behind, so retrying is safe. This converts an unbounded outage
into a failed deploy step, which is a far better failure. Set it per migration
session, not globally, or you will start cancelling ordinary application queries.

`statement_timeout` is not a substitute: it bounds total execution time, but a
statement waiting on a lock is not executing, and the interaction between the two
is a common source of "the timeout did not fire".

## Gotchas

**Symptom:** A deploy caused a total stall on one table; the migration itself was
milliseconds
**Cause:** The `ALTER` queued behind a long-running read, and every later query
queued behind the `ALTER`. Measured: two plain `SELECT`s blocked 2.4 s by a 12 ms
`ALTER`.
**Fix:** `SET lock_timeout` on the migration session so it fails instead of
queueing; kill long-running reads before migrating.

**Symptom:** `55P03 canceling statement due to lock timeout` during a deploy
**Cause:** `lock_timeout` did its job — something else held a conflicting lock.
**Fix:** This is the good outcome. Retry; transactional DDL means nothing was left
behind. Investigate what held the lock.

**Symptom:** `statement_timeout` did not stop a query blocked on a lock
**Cause:** A statement waiting for a lock is not executing, so the execution-time
budget is not what is being consumed.
**Fix:** Use `lock_timeout` for lock waits; different settings, different problems.

**Symptom:** The pool exhausts during a migration and the errors blame the pool
**Cause:** Every connection parked on the blocked table until
`sorry, too many clients already` — the symptom points away from the cause.
**Fix:** Look for a lock queue (`pg_stat_activity.wait_event_type = 'Lock'`) before
resizing the pool.

## Interview questions

**★ How can a 12 ms `ALTER TABLE` cause a 3-second outage?**
`ALTER TABLE` needs `ACCESS EXCLUSIVE`, which conflicts with everything. If a long
read holds `ACCESS SHARE`, the `ALTER` queues — and because PostgreSQL grants locks
in request order, every query arriving afterwards queues behind the `ALTER`, even
plain reads that would not have conflicted with the original one. Measured: two
`SELECT`s issued at 617 ms returned at 3017 ms; the `ALTER` itself took 12 ms.

**★ What is `lock_timeout` and why isn't `statement_timeout` enough?**
`lock_timeout` bounds how long a statement waits to *acquire* a lock, failing with
`55P03`. `statement_timeout` bounds execution time, and a statement blocked on a
lock is not executing. For migrations you want `lock_timeout`, so a contended
`ALTER` fails fast and can be retried rather than stalling the table.

**★ Which lock does `CREATE INDEX` take, and how do you avoid blocking writes?**
Plain `CREATE INDEX` takes `ShareLock` — reads proceed, writes block.
`CREATE INDEX CONCURRENTLY` permits writes too, at the cost of two table scans, a
slower build, the inability to run inside a transaction block (`25001`), and a
possible `INVALID` index left behind on failure.

**Why does the lock queue block reads that would not have conflicted?**
To stop strong lockers starving. If compatible requests could keep jumping ahead,
an `ACCESS EXCLUSIVE` request on a busy table might never be granted. Ordering the
queue guarantees it eventually runs — at the cost of everything behind it waiting.

---

← [Issuing DDL through the driver](01-issuing-ddl.md) · Next → [Startup races and advisory locks](03-startup-races.md)
