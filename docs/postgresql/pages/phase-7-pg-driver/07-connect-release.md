---
title: "pool.connect and release"
sidebar_label: "07 · connect and release"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex20-driver.mjs`.

**`pool.connect()` takes a connection out of the pool and gives it to you. It is yours
until you call `release()` — and if any path through your code misses that call, the
connection never comes back.**

> Leak detection, sizing and the queueing argument are owned by
> [Connection pooling](/docs/nodejs/pages/phase-6-data-access/connection-pooling). This
> page is the checkout mechanics and the transaction helper that falls out of them.

## Checkout and return

```js
const client = await pool.connect();
try {
  await client.query('SELECT …');
} finally {
  client.release();          // ALWAYS in finally
}
```

`release()` returns the connection to the pool for reuse. It does not close it, and it
does not roll anything back — a transaction left open stays open on that connection and
is handed to whoever gets it next.

## The pool as it fills

```console
$ node ex20-driver.mjs
=== 6. pool.connect and release ===
pool max = 3
3 clients checked out → idle: 0 total: 3 waiting: 0
a 4th query queued    → waitingCount: 1
after release         → idle: 3 waiting: 0
```

Three counters worth knowing:

| Counter | Meaning |
|---|---|
| `totalCount` | Connections the pool has open |
| `idleCount` | Of those, how many are free |
| `waitingCount` | Requests queued for a connection |

A fourth request against a `max: 3` pool **waits** — it does not error. That is why a
leak presents as latency, not as an exception: requests queue behind connections that
will never be returned, until `connectionTimeoutMillis` finally rejects them.

Exporting these makes the failure visible before it is an outage:

```js
setInterval(() => {
  metrics.gauge('db.pool.total', pool.totalCount);
  metrics.gauge('db.pool.idle', pool.idleCount);
  metrics.gauge('db.pool.waiting', pool.waitingCount);
}, 10_000);
```

**Sustained `waitingCount > 0` is the signal.** Either the pool is too small for the
workload, queries are too slow, or something is leaking.

## The leak

```js
const client = await pool.connect();
const {rows} = await client.query('SELECT …');   // throws → release() never runs
client.release();
```

One thrown error and that connection is gone for the process's lifetime. Do it `max`
times and every subsequent request hangs. The `finally` is not stylistic.

Better: never write the checkout by hand. Wrap it once.

```js
export async function withClient(fn) {
  const client = await pool.connect();
  try { return await fn(client); }
  finally { client.release(); }
}
```

## The transaction helper

Transactions are the main reason to check a client out at all — `BEGIN` and `COMMIT` must
run on the same connection ([`Pool` vs `Client`](02-pool-vs-client.md)):

```js
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    try { await client.query('ROLLBACK'); }
    catch { /* connection may already be dead — do not mask the original error */ }
    throw err;
  } finally {
    client.release();
  }
}
```

```js
await withTransaction(async (tx) => {
  const {rows: [order]} = await tx.query(
    `INSERT INTO orders (user_id, total) VALUES ($1, $2) RETURNING id`, [userId, total]);
  await tx.query(`INSERT INTO order_items (order_id, sku) VALUES ($1, $2)`, [order.id, sku]);
});
```

Two details that matter: the `ROLLBACK` is itself wrapped, because if the connection died
the rollback throws and would replace the real error with a misleading one; and `release()`
is in `finally`, so it runs on every path. Propagating that `tx` object through service
layers is
[Transaction propagation](/docs/nodejs/pages/phase-6-data-access/transactions).

## `release(true)` destroys the connection

```console
release(true) → totalCount 3 → 2 (connection destroyed)
```

Passing a truthy argument discards the connection instead of returning it to the pool.
The pool opens a fresh one on demand. Use it when the connection may be in an unknown
state:

- After a `FATAL` error, where the connection is already dead
- After a client-side `query_timeout`, where a statement may still be running server-side
  ([Timeouts](11-timeouts.md))
- After any error that leaves session state you cannot account for — a temp table, a
  `SET`, an open transaction

Returning a connection in an unknown state to the pool is how one bad request poisons
later, unrelated requests. Discarding costs one reconnect.

## What a released connection remembers

`release()` does not reset the session. Whatever you did to it persists for the next
borrower:

```js
const client = await pool.connect();
await client.query(`SET search_path = tenant_42`);
client.release();
// the next borrower of this connection is still on tenant_42
```

This is the multi-tenant footgun. Either set such things per connection through the
pool's `options` ([Connection configuration](03-connection-config.md)), or reset
explicitly before release:

```js
await client.query('DISCARD ALL');   // resets settings, temp tables, prepared statements
client.release();
```

`DISCARD ALL` cannot run inside a transaction, so make sure the transaction has ended
first.

## Trade-off

Checking a client out buys a stable session — transactions, session settings, cursors,
advisory locks — at the cost of holding a scarce resource for the duration and taking on
responsibility for returning it. Every checkout is a chance to leak.

`pool.query()` cannot leak, because the pool owns the borrow and return. Prefer it for
anything that is a single statement, which is most reads.

## Gotchas

**Symptom:** Requests hang, then time out, with no errors in the logs
**Cause:** Leaked clients — `waitingCount` climbs while `idleCount` sits at 0.
**Fix:** `finally { client.release() }`, or a `withClient` wrapper.

**Symptom:** A later request sees a transaction it did not start
**Cause:** A client released without `COMMIT` or `ROLLBACK`.
**Fix:** The `withTransaction` shape above.

**Symptom:** `Cannot use a client after it has been released`
**Cause:** `release()` called twice, or the client used after release — often an
un-awaited promise finishing late.
**Fix:** `await` every query before releasing.

**Symptom:** Queries mysteriously run against the wrong schema
**Cause:** A `SET search_path` left on a pooled connection.
**Fix:** Pool-level `options`, or `DISCARD ALL` before release.

**Symptom:** The pool keeps handing out a broken connection
**Cause:** Released normally after a fatal error.
**Fix:** `release(true)` when the state is unknown.

**Symptom:** `timeout exceeded when trying to connect`
**Cause:** `connectionTimeoutMillis` elapsed waiting for a free connection — the pool is
saturated.
**Fix:** Find the leak or the slow query first; raising `max` usually just moves the
queue into PostgreSQL.

## Interview questions

**★ What happens if you forget to call `release()`?**
The connection never returns to the pool. Once that has happened `max` times, every
subsequent request queues — measured, a fourth request against a `max: 3` pool raised
`waitingCount` to 1 rather than erroring — until `connectionTimeoutMillis` rejects them.
It presents as latency and hangs, not as an obvious error, which is why `release()`
belongs in a `finally`.

**★ When would you call `release(true)`?**
When the connection's state is unknown or bad: after a `FATAL`, after a client-side query
timeout where the server may still be executing, or after an error that leaves session
state behind. Measured, it drops the connection — `totalCount` fell from 3 to 2 — and the
pool opens a fresh one. It is cheaper than poisoning later requests.

**★ Why must a transaction use `pool.connect()` rather than `pool.query()`?**
Because each `pool.query()` independently borrows and returns a connection, so `BEGIN`,
the writes and `COMMIT` can land on different connections and the transaction would not
contain the work.

**Does `release()` reset the connection?**
No. Session settings, temp tables and open transactions persist for the next borrower.
Use pool-level `options` for settings you need everywhere, or `DISCARD ALL` before
release.

**How do you tell whether a pool is undersized or leaking?**
Watch `waitingCount` against `idleCount`. Both a leak and an undersized pool show queuing;
a leak also shows `idleCount` pinned at 0 with `totalCount` at `max` while throughput
falls. Fix leaks and slow queries before raising `max`.

---

← [The result object](06-result-object.md) · Next → [Type parsing](08-type-parsing.md)
