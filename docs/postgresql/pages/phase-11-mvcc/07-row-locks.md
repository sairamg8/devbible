---
title: "Row locks: FOR UPDATE and friends"
sidebar_label: "07 · Row locks FOR UPDATE"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex29-locks.mjs`.

**Four lock strengths, three ways to react when a row is already locked, and one rule:
a row lock is held until the transaction ends, so the length of your transaction is the
length of the outage you impose on everyone else wanting that row.**

## The four modes and what each blocks

```console
$ node ex29-locks.mjs
=== 1. row lock modes — which pairs conflict ===
holder \ requester   UPDATE       NO KEY UPDATE SHARE        KEY SHARE
UPDATE               BLOCKS       BLOCKS        BLOCKS       BLOCKS
NO KEY UPDATE        BLOCKS       BLOCKS        BLOCKS       ok
SHARE                BLOCKS       BLOCKS        ok           ok
KEY SHARE            BLOCKS       ok            ok           ok
```

Read it as a strength ordering — `FOR UPDATE` is the strongest and conflicts with
everything, `FOR KEY SHARE` the weakest and conflicts only with `FOR UPDATE`:

| Mode | Take it when | Conflicts with |
|---|---|---|
| `FOR UPDATE` | you will update or delete the row | everything |
| `FOR NO KEY UPDATE` | you will update non-key columns only | all but `KEY SHARE` |
| `FOR SHARE` | the row must not change while you read it | `UPDATE`, `NO KEY UPDATE` |
| `FOR KEY SHARE` | the row's key must remain (what an FK insert takes) | `UPDATE` only |

The two "key" variants exist so that inserting a child row does not have to block an
unrelated update of the parent — measured below.

## Waiting, failing fast, or skipping

```console
=== 2. the three ways to react to a locked row ===
(a) plain FOR UPDATE  : still waiting after 250 ms, {"wait_event_type":"Lock","wait_event":"transactionid"}
(b) FOR UPDATE NOWAIT : 55P03 could not obtain lock on row in relation "l_row"
(c) FOR UPDATE SKIP LOCKED: no error, rowCount = 0
(a) resumed once the holder committed, total wait 264.8 ms
```

- **Plain** — wait indefinitely. The wait shows in `pg_stat_activity` as
  `wait_event_type = 'Lock'`, `wait_event = 'transactionid'`: it is waiting for the
  *holding transaction to end*, not for a row.
- **`NOWAIT`** — fail immediately with `55P03`. Right when "someone else is editing
  this" is a meaningful answer to give a user.
- **`SKIP LOCKED`** — silently omit locked rows. Returns fewer rows than you asked for,
  never an error. This is a queue primitive, not a general-purpose modifier — see
  [SKIP LOCKED](08-skip-locked.md).

## Bound the wait, always

A plain `FOR UPDATE` waits forever by default. `lock_timeout` bounds it:

```console
=== 3. lock_timeout is the safety net for a blocked writer ===
lock_timeout       → 55P03 canceling statement due to lock timeout after 301.5 ms
statement_timeout  → 57014 canceling statement due to statement timeout after 301.1 ms
```

Both stop the pile-up; they mean different things:

- **`lock_timeout`** — "do not wait more than N for a lock". It does not limit
  execution time, so a legitimately slow query is unaffected. This is the one you want
  on writers.
- **`statement_timeout`** — "do not run more than N in total". It also kills slow-but-
  progressing queries, and it cannot distinguish waiting from working.

```js
// per-transaction, on the client that will take locks
await client.query(`SET LOCAL lock_timeout = '3s'`);
```

`SET LOCAL` scopes it to the transaction. Plain `SET` persists on the pooled connection
for whoever checks it out next — measured:

```console
=== 1b. SET survives release() — the pool hands the setting to the next caller ===
connection returned to the pool with lock_timeout=250ms; next checkout (pid 1144 -> 1144) sees lock_timeout = 250ms
after RESET ALL: 0
```

**`pg` does not reset session state on `release()`.** A stray `SET statement_timeout`
leaks to every later user of that connection. Use `SET LOCAL` inside a transaction, or
`RESET ALL` before release.

## Row locks are not in `pg_locks`

```console
=== 4. inserting a child row locks the parent key ===
locks on the parent tuple while the child insert is open: []
UPDATE of a non-key column: ok (not blocked)
UPDATE of the KEY column   → 55P03 canceling statement due to lock timeout
```

The `pg_locks` query returned **empty** while a row was demonstrably locked. Row locks
live in the row header (`xmax` plus flag bits), not in the lock manager — otherwise
locking a million rows would need a million lock-table entries. `pg_locks` shows only
the *waiters* and the table-level locks.

To find who is blocking whom, use `pg_blocking_pids()` instead:

```sql
SELECT a.pid, a.state, left(a.query, 60) AS query,
       pg_blocking_pids(a.pid) AS blocked_by,
       now() - a.xact_start AS xact_age
FROM pg_stat_activity a
WHERE cardinality(pg_blocking_pids(a.pid)) > 0;
```

The same output shows the FK behaviour: an open `INSERT` into the child table blocks an
`UPDATE` of the parent's **key** column but not of a **non-key** column, because the
insert holds only `FOR KEY SHARE`. That is the whole reason the weaker modes exist.

## `FOR UPDATE` in practice

```sql
-- lock exactly what you will write, in a deterministic order
SELECT id, balance FROM accounts
WHERE id = ANY($1) ORDER BY id
FOR UPDATE;
```

Three rules this encodes:

- **`ORDER BY` a stable key.** Locking in a consistent order across all code paths is
  what prevents [deadlocks](11-deadlocks.md).
- **Lock only rows you will write.** `FOR UPDATE` on a whole result set serialises far
  more than you meant.
- **With a join, name the table**: `FOR UPDATE OF accounts`, or you lock rows in every
  table in the query.

`FOR UPDATE` is not allowed with aggregates, `GROUP BY`, `DISTINCT`, `UNION` or window
functions — there is no single row to lock. Lock the base rows in a subquery instead.

## Trade-off

**A row lock converts a correctness problem into a queue.** Every other writer of that
row waits for your transaction to end — not for your statement, for your *transaction*.
That makes the cost proportional to how long you hold it, which is why an external API
call inside a lock window is so damaging: 200 ms of HTTP becomes 200 ms of blocking for
every concurrent writer of that row. Measured, plain `FOR UPDATE` beat both optimistic
retry (58 ms vs 337 ms) and SERIALIZABLE (71 ms vs 12.4 s) on contended rows — locking
is usually the cheap answer, provided the window is short.

## Gotchas

**Symptom:** Queries hang forever with `wait_event_type = 'Lock'`
**Cause:** No `lock_timeout`; the default is unlimited waiting
**Fix:** `SET LOCAL lock_timeout = '3s'` on writers, and handle `55P03`

**Symptom:** A timeout set in one request affects a later unrelated one
**Cause:** `SET` persists on the pooled connection after `release()` — measured
**Fix:** `SET LOCAL` inside a transaction, or `RESET ALL` before releasing

**Symptom:** `pg_locks` is empty although a row is clearly locked
**Cause:** Row locks are stored in the row header, not the lock manager
**Fix:** Use `pg_blocking_pids()` and `pg_stat_activity` to find blockers

**Symptom:** Inserting a child row blocks an unrelated update of the parent
**Cause:** The FK takes `FOR KEY SHARE`; you updated the parent's **key** column
**Fix:** Do not update key columns; use surrogate keys that never change

**Symptom:** `FOR UPDATE is not allowed with aggregate functions`
**Cause:** There is no single underlying row to lock
**Fix:** Lock the base rows in a subquery, aggregate outside it

**Symptom:** Throughput collapses after adding `FOR UPDATE`
**Cause:** Locking more rows than needed, or holding the transaction open across slow work
**Fix:** Lock only the rows you write, as late as possible, and do no I/O inside the transaction

## Interview questions

**★ How long is a row lock held?**
Until the transaction commits or rolls back — never released earlier, not even after the
statement finishes. Transaction length is therefore blocking length.

**★ What is the difference between `FOR UPDATE` and `FOR SHARE`?**
`FOR UPDATE` conflicts with every other row lock mode; `FOR SHARE` allows other
`FOR SHARE` and `FOR KEY SHARE` holders but blocks writers. Measured in the conflict
matrix.

**★ Why does `FOR KEY SHARE` exist?**
So an FK insert into a child table does not block ordinary updates of the parent.
Measured: with a child insert open, updating a non-key parent column succeeded and
updating the key column timed out.

**★ `NOWAIT` versus `SKIP LOCKED`?**
`NOWAIT` raises `55P03` immediately if any selected row is locked. `SKIP LOCKED` omits
the locked rows and returns the rest with no error. The first is for "tell the user
someone else is editing"; the second is for job queues.

**★ `lock_timeout` or `statement_timeout` for a blocked writer?**
`lock_timeout` — it bounds only the wait for a lock, leaving genuinely slow queries
alone. `statement_timeout` cannot tell waiting from working.

**Why is `pg_locks` empty for row locks?**
Because they are recorded in the tuple header rather than the lock manager, so locking
many rows costs no shared memory. `pg_locks` shows table-level locks and waiters only.

**How do you avoid deadlocks when locking several rows?**
Lock in a deterministic order — `ORDER BY id` in every code path that takes the locks.
See [Deadlocks](11-deadlocks.md).

---

← [REPEATABLE READ SERIALIZABLE](06-isolation-levels.md) · Next → [SKIP LOCKED](08-skip-locked.md)
