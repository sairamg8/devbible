---
title: "Connection pooling"
sidebar_label: "01 · Connection pooling"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS), `pg` 8.23.0 against **PostgreSQL 17.10**.

**A database connection is a TCP socket, a server-side process and an
authentication handshake. Opening one per request is the single most expensive
thing a Node application can do to itself.**

```js
// db.js — module scope. One pool per process, created once.
import pg from 'pg';
export const pool = new pg.Pool({connectionString: process.env.DATABASE_URL, max: 10});
```

Every handler imports `pool` and calls `pool.query()`. Nothing else creates one.

## What the pool actually saves

Twenty `select 1` queries, each on a brand new `Client`, against a Postgres on
the same machine:

```console
$ node ex1-pool.mjs
20 queries, new Client each time -> 279 ms
20 queries, reusing one pooled connection -> 6 ms
```

**14 ms versus 0.3 ms per query.** That gap is TCP setup, a SCRAM password
exchange, and Postgres forking a backend process — before your query is even
parsed. Across a network with TLS it is worse, and it is paid on *every request*.

## `max` is a queue length, not a speed limit

The pool does not run your queries in parallel beyond `max`. It queues.

```console
$ node ex1-pool.mjs
10 x 200ms through max:2  -> 1054 ms
10 x 200ms through max:10 -> 239 ms
```

Ten 200 ms queries through two connections take five rounds. Nothing is broken —
that is the design. What it means is that **`max` sets your concurrency ceiling
for the whole process**, and every request that arrives past it waits.

You can watch the queue:

```js
setInterval(() => {
  console.log({total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount});
}, 5000).unref();
```

```console
mid-flight: { total: 2, idle: 0, waiting: 4 }
drained:    { total: 2, idle: 2, waiting: 0 }
```

**`waitingCount` above zero for any sustained period is the metric that matters.**
Export it. It tells you the pool is the bottleneck before your latency graph does.

## Sizing it

The instinct is to raise `max` until the waiting stops. That moves the queue from
your process into the database, which is worse — Postgres schedules every backend
process, and a hundred of them thrash.

Start from the server's limit and divide:

```console
$ node ex1-pool.mjs
server: { max_connections: '100', in_use: '6' }
```

```
max per process  ≈  (max_connections − reserved) / number of processes
```

Four pods × 4 cluster workers × `max: 10` is **160 connections** against a server
that allows 100. The two-thirds of your fleet that boots last gets
`FATAL: sorry, too many clients already` (`53300`). Count the multipliers:
replicas × workers × pools.

| Situation | Reasonable `max` |
|---|---|
| One API process, small Postgres | 10 (the `pg` default) |
| Several pods behind an autoscaler | `max_connections / expected pods`, minus headroom |
| Serverless / per-invocation processes | 1, plus a proxy (PgBouncer, RDS Proxy) in front |
| Background worker doing batch work | 2–5 — it is not latency-sensitive |

A pool that is too *large* also hides a real problem: if 40 connections are all
busy, the fix is usually a missing index or an N+1 ([page 07](./07-n-plus-1.md)),
not more sockets.

## The defaults you are actually running

```console
$ node ex15-knobs.mjs
pg.Pool defaults: {
  max: 10, min: 0,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: undefined,
  maxUses: Infinity, maxLifetimeSeconds: 0,
  allowExitOnIdle: false
}
```

Two of those deserve attention:

- **`connectionTimeoutMillis` is unset**, which means *wait forever* for a free
  connection. Under load, requests pile up in the queue with no upper bound. Set
  it — 2000–5000 ms — so a saturated pool fails fast instead of holding every
  inbound socket open.
- **`allowExitOnIdle: false`** means an idle pool keeps the process alive. That is
  correct for a server and wrong for a script; a one-shot job that "hangs at the
  end" has forgotten `await pool.end()`.

## Leaks: `connect()` without `release()`

`pool.query()` checks a connection out and back in for you. `pool.connect()` does
not — you own it until you release it.

```console
$ node ex1-pool.mjs
after 1 leak of 2, a query still works: { '?column?': 1 }
with both leaked -> Error: timeout exceeded when trying to connect
  pool: { total: 2, idle: 0, waiting: 0 }
```

Note the shape of that failure. **One leak changes nothing.** The service stays
healthy while the pool bleeds a connection per request that takes some rare error
path, and then dies all at once, hours later, with a timeout that names no
culprit. That is why it is hard to find.

```js
const client = await pool.connect();
try {
  await client.query('…');
} finally {
  client.release();          // finally, not at the end of the happy path
}
```

If you never need a specific connection, **do not call `connect()` at all** —
`pool.query()` cannot leak. The three reasons to check one out are transactions
([page 06](./06-transactions.md)), cursors ([page 16](./16-cursors.md)) and
`LISTEN/NOTIFY`.

## The error handler that keeps your process alive

A pooled connection can die while it is sitting idle: a failover, a restart, an
admin running `pg_terminate_backend`, a load balancer idle timeout. `pg` emits
that on the pool, and an unhandled `'error'` event **kills Node**.

```console
$ node ex9-lifecycle.mjs idle-error
node:events:487
      throw er; // Unhandled 'error' event
      ^
error: terminating connection due to administrator command
    …
Emitted 'error' event on BoundPool instance at:
    at Client.idleListener (…/pg-pool/index.js:62:10)
  severity: 'FATAL',
  code: '57P01',
```

One line prevents it, and the pool then heals itself silently:

```js
pool.on('error', (err) => {
  logger.error({err}, 'idle database connection died');   // do not exit; do not rethrow
});
```

```console
$ LISTEN=1 node ex9-lifecycle.mjs idle-error
pool 'error' handler: 57P01
still alive; next query -> { ok: 1 }
```

**`pool.on('error')` only covers connections the pool is holding.** A connection
that is *checked out* emits on the client instead, which is its own unhandled
event — a `idle_in_transaction_session_timeout` kill produced exactly that crash
with a `pool.on('error')` handler already installed. Wrap checked-out work in
`try/finally` and let the rejection reach your handler.

## Where the pool must live

```js
// ✗ a new pool per request: unbounded connections, none of them reused
app.get('/orders', async (req, res) => {
  const pool = new pg.Pool();            // 100 requests -> 100 pools
  res.json((await pool.query('select …')).rows);
});
```

Module scope, created once, ended once on shutdown ([page
03](./03-driver-lifecycle.md)). This is the same rule as the HTTP agent in
[Phase 5, page 07](../phase-5-http-processes/07-keep-alive-and-agents.md): the
thing that pools is long-lived by definition, so it cannot be created inside the
thing it is pooling for.

MongoDB works the same way — `MongoClient` *is* the pool, with a default
`maxPoolSize` of 100 ([page 05](./05-mongodb-from-node.md)).

## Gotchas

**Symptom:** Latency climbs under load but the database looks bored
**Cause:** Every request is queueing for a pool connection.
**Fix:** Export `waitingCount`. Raise `max` only if the server can take it;
otherwise fix the slow queries that are holding connections.

**Symptom:** `timeout exceeded when trying to connect` after hours of uptime
**Cause:** A code path that calls `pool.connect()` and returns without
`release()`.
**Fix:** `try/finally`, and prefer `pool.query()` where you do not need a
specific connection.

**Symptom:** `sorry, too many clients already` after scaling up
**Cause:** `max` × pods × workers exceeded `max_connections`.
**Fix:** Size per process, or put a connection proxy in front.

**Symptom:** The process exits with an unhandled `'error'` event naming a FATAL
Postgres error
**Cause:** No `pool.on('error')` listener; an idle connection was terminated
server-side.
**Fix:** Add the listener and log. The pool replaces the connection itself.

**Symptom:** A CLI script never exits
**Cause:** An idle pool is a live handle.
**Fix:** `await pool.end()`, or `allowExitOnIdle: true`.

**Symptom:** Requests hang forever when the database is unreachable
**Cause:** `connectionTimeoutMillis` is unset — the queue has no deadline.
**Fix:** Set it, and pair it with a retry policy ([page 14](./14-retry-backoff.md)).

## Interview questions

**★ Why is a connection pool necessary — isn't a connection just a socket?**
It is a socket *plus* an authentication handshake and, in Postgres, a whole
server-side process. Measured here: 14 ms per query when each one opens its own
connection against 0.3 ms when they share a pooled one. The pool also bounds
concurrency, which protects the database from your traffic spikes.

**★ What does `max` actually control?**
The maximum number of connections open at once, and therefore the maximum number
of queries in flight. Beyond it, callers queue inside your process —
`waitingCount` is that queue. It is a concurrency ceiling, not a throughput dial.

**★ How do you size a pool?**
From the server's `max_connections` divided by the number of processes that will
connect — replicas × workers — with headroom for admin sessions. Raising `max`
past that just moves contention into the database.

**★ What is a connection leak and why is it so hard to catch?**
`pool.connect()` without a matching `release()`. It is invisible until the pool is
exhausted, so the failure appears hours after the deploy, on an unrelated request,
as a connect timeout that names no culprit.

**★ Why does a pool need an `'error'` listener?**
Idle pooled connections can be killed by the server — failover, restart,
`pg_terminate_backend`. `pg` emits `'error'` on the pool, and an unhandled
`'error'` event terminates the Node process. With a listener the pool discards the
dead connection and the next query succeeds.

**Where should the pool be created?**
Once, at module scope, and shared. A pool created per request pools nothing and
opens unbounded connections.

**Why is one long transaction worse for a pool than one slow query?**
Both hold a connection, but a transaction also holds locks and keeps a server-side
snapshot alive. A pool of 4 with 4 open transactions serves nothing at all — see
[page 06](./06-transactions.md).

---

← Phase 5: [Networking, HTTP, processes](../phase-5-http-processes/) · Next → [Parameterized queries](./02-parameterized-queries.md)
