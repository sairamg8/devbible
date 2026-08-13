---
title: "Idle in transaction"
sidebar_label: "14 · Idle in transaction"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex30-vacuum-horizon.mjs`.

**A connection that sent `BEGIN` and then went quiet. The database is not busy, it is
waiting for your application to say something. It holds a pool slot, every lock it took,
and — if it wrote or is not READ COMMITTED — the vacuum horizon, for as long as your code
takes to get back to it.**

## What it looks like

```console
$ node ex30-vacuum-horizon.mjs
=== 4. idle in transaction — the three timeouts ===
(a) pg_stat_activity      : [{"state":"idle in transaction","wait_event_type":"Client","wait_event":"ClientRead","for_s":"0.3"}]
```

`wait_event = ClientRead` is the diagnosis in one field: **the server is blocked reading
from the client socket.** The database has nothing to do; it is waiting for the
application. Whatever that connection is holding, it holds until the application sends
`COMMIT` or `ROLLBACK`, or the connection dies.

Distinguish the two states:

- **`idle`** — no transaction open. Harmless; this is what a pooled connection looks
  like at rest.
- **`idle in transaction`** — a transaction is open and nothing is happening. This is
  the problem state.

## What it costs

- **A pool connection**, for the whole idle period. With `max: 10`, ten of these is a
  total outage.
- **Every lock the transaction took.** Other writers of those rows wait
  ([row locks](07-row-locks.md)); a DDL statement wanting the table
  [queues everything behind it](10-table-locks-ddl.md).
- **The vacuum horizon** — but only under the conditions
  [measured on the previous page](12-long-transactions.md): if it wrote, or if it is
  REPEATABLE READ. An idle read-only READ COMMITTED transaction does not pin the
  horizon.

The pool cost is unconditional, and it is what usually takes the application down first:

```console
=== 5. an abandoned transaction takes a pool connection with it ===
2 queries on the remaining 2 connections: 2 ok in 13.6 ms
3 more concurrent queries with 1 connection leaked: done in 603.1 ms
  pool: total 3 idle 2 waiting 0
```

With one of three connections leaked, three concurrent 300 ms queries took 603 ms —
they had to run two-then-one instead of all at once. **Throughput fell by a third from a
single leaked transaction.** Leak a few more and requests queue until the pool's
`connectionTimeoutMillis` fires.

## The three timeouts, and which one works

```console
    victim client "error" EVENT: 25P03 terminating connection due to idle-in-transaction timeout
(b) next query on that connection → Client has encountered a connection error and is not queryable

(c) transaction_timeout=500ms: query at 300 ms still fine
    busy client "error" EVENT: 25P04 terminating connection due to transaction timeout
(c) query at 700 ms       → Client has encountered a connection error and is not queryable

(d) statement_timeout=200ms, idle 600 ms in a transaction: still here
```

| Setting | Kills | SQLSTATE |
|---|---|---|
| `idle_in_transaction_session_timeout` | a transaction idle longer than N | `25P03` |
| `transaction_timeout` (PostgreSQL 17+) | any transaction older than N, busy or idle | `25P04` |
| `statement_timeout` | a single statement running longer than N | `57014` |

**`statement_timeout` does not help at all here** — measured, a session idle for 600 ms
with `statement_timeout = 200ms` was still alive and holding its transaction. No
statement is running, so there is nothing for it to cancel. This is the mistake worth
avoiding: `statement_timeout` is not a backstop for abandoned transactions.

`transaction_timeout` is the PostgreSQL 17+ addition that covers the case
`idle_in_transaction_session_timeout` misses: a transaction that is never idle because it
is running statement after statement, but has been open for an hour.

```sql
ALTER SYSTEM SET idle_in_transaction_session_timeout = '60s';
ALTER SYSTEM SET transaction_timeout = '5min';
SELECT pg_reload_conf();
```

## It terminates the connection, not just the transaction

Both timeouts **kill the whole backend**, and `pg` surfaces that as an `'error'` event on
the client, not a rejected promise:

```console
    victim client "error" EVENT: 25P03 terminating connection due to idle-in-transaction timeout
    victim client "error" EVENT: Connection terminated unexpectedly
```

**An unhandled `'error'` event on a Node EventEmitter crashes the process.** The pool
needs a listener, always:

```js
const pool = new pg.Pool({connectionString, max: 10});
pool.on('error', (err) => {
  logger.error({code: err.code}, 'idle pg client error');   // do NOT rethrow
});
```

The next query on that client fails with a `pg`-level message rather than a SQLSTATE —
`Client has encountered a connection error and is not queryable`. Code that switches on
`err.code` must handle `undefined`. Destroy such a client rather than returning it to the
pool:

```js
try {
  await client.query(sql);
} catch (e) {
  const dead = e.code === '25P03' || e.code === '25P04' || e.code === '57P01' || !e.code;
  client.release(dead);        // true = destroy, do not reuse
  throw e;
}
```

## Where they come from

Nearly always one of these:

- **A network call inside the transaction.** `BEGIN`, then `await fetch(...)`, then the
  write. The transaction is idle for the whole HTTP round trip.
- **A missing `release()`.** An exception between `connect()` and `release()` with no
  `finally` — the connection never returns, and if a `BEGIN` was sent it stays open
  forever.
- **`pool.query('BEGIN')`.** [Measured](02-begin-commit.md): the `BEGIN` lands on one
  connection and the `COMMIT` on another, leaving the first permanently in transaction.
- **An ORM holding a transaction across an await it did not expect.**

The fix for the first is structural: do slow work outside the transaction. For the rest
it is the `withTransaction` helper with `release()` in `finally`.

## Trade-off

**Setting `idle_in_transaction_session_timeout` guarantees some transactions get killed
that were merely slow, and the application must handle a connection dying mid-request.**
That is a far better failure mode than the alternative, which is unbounded: connections
disappearing one by one until the pool is empty and every request times out. Set it
generously (30–60s) rather than not at all, and give batch jobs their own role with a
larger value.

## Gotchas

**Symptom:** Pool exhausted, database CPU near zero
**Cause:** Connections stuck `idle in transaction` — the database is waiting on the app
**Fix:** Find them in `pg_stat_activity`; set `idle_in_transaction_session_timeout`

**Symptom:** `statement_timeout` is set but idle transactions still pile up
**Cause:** It only limits running statements — measured, an idle transaction survived it entirely
**Fix:** Use `idle_in_transaction_session_timeout`; add `transaction_timeout` on PostgreSQL 17+

**Symptom:** Node process exits with an unhandled `'error'` event
**Cause:** The server terminated an idle backend and nothing listened on the pool
**Fix:** `pool.on('error', …)` — mandatory in every `pg` application

**Symptom:** Errors with no `code` after a timeout
**Cause:** The connection is gone; the failure is client-side, not a SQLSTATE
**Fix:** Handle `err.code === undefined`, and `release(true)` to destroy the client

**Symptom:** Transactions idle for exactly as long as an upstream API call
**Cause:** The HTTP call is inside the transaction
**Fix:** Fetch first, then open the transaction and write

**Symptom:** A long batch is killed despite never being idle
**Cause:** `transaction_timeout` bounds total transaction age, idle or not
**Fix:** Chunk the batch, or give the batch role a larger value

## Interview questions

**★ What does `idle in transaction` mean?**
A transaction is open and the server is waiting for the client to send something —
`wait_event = ClientRead`. It holds a pool connection, its locks, and possibly the vacuum
horizon until the application responds.

**★ Does `statement_timeout` protect against it?**
No. Measured: a session idle 600 ms with `statement_timeout = 200ms` was untouched. No
statement is running. Use `idle_in_transaction_session_timeout` (`25P03`).

**★ What is `transaction_timeout`?**
PostgreSQL 17+. It kills any transaction older than the limit whether idle or busy —
`25P04`. It covers the long-running-but-always-active case the idle timeout misses.

**★ What happens to the `pg` client when the server kills the backend?**
The connection is terminated and `pg` emits an `'error'` **event**, not a rejected
promise. Unhandled, it crashes the Node process. `pool.on('error', …)` is mandatory.

**★ How much does one leaked transaction cost?**
One pool connection permanently. Measured on a pool of 3: three concurrent 300 ms queries
took 603 ms instead of ~300 ms — a third of the throughput gone from one leak.

**How do you find them?**
`SELECT pid, state, now() - state_change FROM pg_stat_activity WHERE state = 'idle in
transaction' ORDER BY state_change;`

**What is the most common cause?**
An HTTP call or other slow work inside the transaction, and missing `release()` in a
`finally` block.

---

← [VACUUM and bloat](13-vacuum.md) · Next → [Advisory locks](15-advisory-locks.md)
