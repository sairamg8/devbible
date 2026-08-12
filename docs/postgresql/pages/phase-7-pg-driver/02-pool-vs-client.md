---
title: "Pool vs Client"
sidebar_label: "02 · Pool vs Client"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex20-driver.mjs`,
> `ex22-notify-cursor-pgjs.mjs`.

**Use `Pool` — that is the answer almost every time. A bare `Client` is one connection
you own from `connect()` to `end()`, and it is the right tool only when you need a
session that outlives a single query.**

> **This page is the PostgreSQL-side recap.** Pool sizing, queueing behaviour, leak
> detection and the error handler are owned by
> [Connection pooling](/docs/nodejs/pages/phase-6-data-access/connection-pooling) in the
> Node syllabus. Read that one for the runtime concerns; this page is about *which
> object to reach for*.

## The two objects

```js
// Pool — a managed set of connections, shared for the process's lifetime
const pool = new pg.Pool({connectionString: URL, max: 10});
await pool.query('SELECT 1');            // borrow, run, return — automatically

// Client — exactly one connection, yours until you end it
const client = new pg.Client({connectionString: URL});
await client.connect();
await client.query('SELECT 1');
await client.end();
```

`pool.query()` borrows a connection, runs the statement, and returns it to the pool
before resolving. Two `pool.query()` calls may land on **different** connections — which
is exactly why anything stateful cannot use it.

## When you genuinely need a dedicated connection

Session state lives on a connection. If your work spans more than one statement and
depends on that state, you must hold one connection for the duration:

| Need | Why a pooled `pool.query()` fails |
|---|---|
| **Transactions** | `BEGIN` and `COMMIT` could land on different connections |
| **`LISTEN`** | The connection returns to the pool with no handler attached |
| **`SET` / session config** | The next query may run on a different connection |
| **Cursors** (`DECLARE`) | The cursor lives in the session and its transaction |
| **Advisory locks** (session-scoped) | Released when the connection is returned or reused |
| **Prepared statements by name** | Prepared per session — [Prepared statements](10-prepared.md) |

For all but `LISTEN`, the answer is **not** a bare `Client` — it is
`pool.connect()`, which checks one connection *out* of the pool and hands it to you:

```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO …');
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();          // back to the pool — never skip this
}
```

That gives you a dedicated session *and* pooling. Details, including why the `finally`
matters, are in [`pool.connect` and `release`](07-connect-release.md).

## `LISTEN` is the real `Client` case

```console
$ node ex22-notify-cursor-pgjs.mjs
=== 1. LISTEN / NOTIFY needs a dedicated Client ===
LISTEN issued via pool.query → the connection went back to the pool; no handler is attached, notifications are lost
```

A listener must stay connected indefinitely with an event handler bound to it. It is not
serving requests, so pooling buys nothing, and a pooled connection would be handed to
someone else. That is a genuine `new pg.Client()` —
[LISTEN/NOTIFY](14-listen-notify.md).

The other honest `Client` cases: a **migration runner** or CLI script that runs once and
exits, and a **one-shot admin task**. Even there a small pool works; a `Client` is just
less machinery.

## What the pool is actually doing

```console
$ node ex20-driver.mjs
=== 6. pool.connect and release ===
pool max = 3
3 clients checked out → idle: 0 total: 3 waiting: 0
a 4th query queued    → waitingCount: 1
after release         → idle: 3 waiting: 0
```

`max` is a **queue depth, not a speed limit** — the fourth request waits rather than
failing, and `waitingCount` is how you see it. When that number is persistently above
zero, the pool is the bottleneck. The sizing argument is in
[Connection pooling](/docs/nodejs/pages/phase-6-data-access/connection-pooling).

## Trade-off

`Pool` amortises connection setup — TCP, TLS, authentication — across every request and
bounds how many connections one process can consume. It costs you the guarantee of
*which* connection you get, so session state is unusable through `pool.query`.

`Client` gives you a stable session at the cost of doing everything yourself: no reuse
across requests, no cap, no queueing, and a connect/end lifecycle you must manage. Under
request load that is strictly worse; for a long-lived listener it is exactly right.

## Gotchas

**Symptom:** A transaction commits partially, or `COMMIT` errors with no transaction
**Cause:** `BEGIN` and `COMMIT` issued through `pool.query()` on different connections.
**Fix:** `pool.connect()`, all statements on that client, `release()` in `finally`.

**Symptom:** `SET search_path` seems to be ignored by the next query
**Cause:** The next query ran on a different pooled connection.
**Fix:** Hold one client, or set it in the connection `options`.

**Symptom:** `LISTEN` never delivers anything
**Cause:** Issued via `pool.query()` — measured, notifications are lost.
**Fix:** A dedicated `new pg.Client()` with a `'notification'` handler.

**Symptom:** The pool is exhausted and requests hang
**Cause:** Clients checked out and not released — `waitingCount` climbs.
**Fix:** `finally { client.release() }`.

**Symptom:** `Client has already been connected` 
**Cause:** Calling `connect()` twice on one `Client`, or reusing one after `end()`.
**Fix:** A `Client` is single-use; construct a new one, or use a pool.

## Interview questions

**★ When would you use a `Client` instead of a `Pool`?**
When you need a session that outlives a single statement and pooling buys nothing —
principally a `LISTEN` listener, which must stay connected with a handler bound to it,
and one-shot scripts like migration runners. For transactions and session settings you
want `pool.connect()`, which gives a dedicated connection *from* the pool rather than a
standalone one.

**★ Why can't you run a transaction with `pool.query()`?**
Because each `pool.query()` borrows and returns a connection independently, so `BEGIN`,
the writes and `COMMIT` may execute on different connections — the transaction would not
contain the work. Check one client out with `pool.connect()`, run every statement on it,
and release it in a `finally`.

**★ What happens when all connections are busy?**
The request queues rather than failing — measured, a fourth query against a `max: 3` pool
raised `waitingCount` to 1 and resolved once a client was released. `max` is a queue
depth. Persistent `waitingCount > 0` means the pool is the bottleneck.

**Does `pool.query()` guarantee two calls use the same connection?**
No, and that is the whole reason session state cannot go through it.

---

← [Installing and wiring pg](01-install-wire.md) · Next → [Connection configuration](03-connection-config.md)
