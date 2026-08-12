---
title: "Query timeouts"
sidebar_label: "11 · Timeouts"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex21-types-prepared.mjs`.

**Five different timeouts apply to a `pg` query and they do different things. Only one of
them actually stops the database doing work: `statement_timeout`. The client-side
`query_timeout` gives up on the answer while the server keeps going.**

## The one that works: `statement_timeout`

```console
$ node ex21-types-prepared.mjs
=== 5. which timeout does what ===
statement_timeout → 57014 canceling statement due to statement timeout after 201 ms
  connection still usable after cancel → 1
```

Server-side. PostgreSQL cancels the statement itself, raises `57014`, and — importantly —
**the connection stays usable**. The transaction is aborted, not the session.

```js
new pg.Pool({connectionString: URL, statement_timeout: 10_000});   // every connection
```

```sql
SET statement_timeout = '10s';                    -- this session
SET LOCAL statement_timeout = '2s';               -- this transaction only
ALTER ROLE api_user SET statement_timeout = '10s'; -- everything that role does
```

The role-level form is the one to reach for in production: it applies no matter which
client connects, including a `psql` session someone forgot about. Set a generous global
ceiling and tighten it per transaction where you know the work should be quick.

## The one that misleads: `query_timeout`

```console
query_timeout     → Query read timeout after 213 ms
  server-side query still running? YES
```

Client-side. `pg` stops waiting and rejects your promise — **the server carries on
executing the statement to completion**. Measured directly: after the client gave up, the
query was still `active` in `pg_stat_activity`.

So `query_timeout` alone protects your request latency and does nothing for the database.
Under load that is the worst combination: users retry, each retry starts another
expensive query, and the server accumulates work nobody is waiting for.

```js
new pg.Pool({connectionString: URL, query_timeout: 5_000});
```

Use it *with* `statement_timeout`, not instead of it — and set the client value slightly
higher, so the server's cancellation is what normally fires and you get the informative
`57014` rather than an opaque read timeout.

Note the connection is also in an uncertain state afterwards: a statement may still be
running on it. `release(true)` is the safe response
([`pool.connect` and release](07-connect-release.md)).

## The one that kills the connection: `idle_in_transaction_session_timeout`

```console
idle_in_transaction → arrived as an "error" EVENT: Connection terminated unexpectedly
  next query on it   → Client has encountered a connection error and is not queryable
  ↑ a FATAL kills the connection; pg emits "error" on the Client.
    Unhandled, that is an uncaught exception — pool.on("error") is mandatory.
```

This one targets a transaction that is **open but doing nothing** — `BEGIN` issued, then
an `await` on an HTTP call, then a crash. Such a transaction holds locks and pins the
xmin horizon, blocking `VACUUM` across the database
([MVCC](../phase-11-mvcc/)). PostgreSQL terminates the whole session rather than
cancelling a statement.

The delivery mechanism is the trap. There is no in-flight query to reject, so `pg` emits
an **`'error'` event**, and an unhandled `'error'` event in Node is an uncaught exception:

```js
pool.on('error', (err) => log.error({err}, 'idle client error'));
```

Without that line, a routine server-side timeout takes your process down.

```sql
ALTER ROLE api_user SET idle_in_transaction_session_timeout = '30s';
```

## The two pool timeouts

```js
new pg.Pool({
  connectionTimeoutMillis: 5_000,   // give up ACQUIRING a connection
  idleTimeoutMillis: 30_000,        // close a connection idle this long
});
```

`connectionTimeoutMillis` covers opening the socket *and* waiting for a free pooled
connection — so it is the timeout that fires when the pool is saturated by a leak. Without
it, requests queue forever ([`pool.connect` and release](07-connect-release.md)).

`idleTimeoutMillis` keeps the pool from holding connections it does not need. Set it below
any idle timeout imposed by an intermediary — a load balancer or NAT gateway that silently
drops idle TCP connections is a common source of "connection terminated unexpectedly"
hours after startup.

## `lock_timeout`, for the waiting case

A statement blocked on a lock is not slow, it is *waiting*, and `statement_timeout` counts
that time too. When you specifically want to give up rather than queue — a migration
behind a long transaction, for instance:

```sql
SET lock_timeout = '3s';
ALTER TABLE t ADD COLUMN c int;    -- fails fast instead of queueing behind readers
```

This matters more than it sounds: an `ALTER TABLE` waiting for `ACCESS EXCLUSIVE` blocks
every query that arrives behind it, so a migration that waits is an outage
([DDL locks](../phase-3-ddl/05-alter-table.md)).

## Choosing values

| Timeout | Where | Typical | Protects |
|---|---|---|---|
| `statement_timeout` | Server | 10–30 s global, tighter per transaction | The database |
| `query_timeout` | Client | Slightly above `statement_timeout` | Request latency |
| `lock_timeout` | Server | 2–5 s on migrations | Everyone behind the lock |
| `idle_in_transaction_session_timeout` | Server | 30–60 s | `VACUUM`, locks |
| `connectionTimeoutMillis` | Pool | 2–5 s | The request queue |
| `idleTimeoutMillis` | Pool | 10–30 s | Connection count |

Background jobs need their own, longer, settings — `SET LOCAL statement_timeout = 0` inside
a deliberately long transaction is legitimate, and much better than raising the global
ceiling for everyone.

## Trade-off

Timeouts convert an unbounded wait into a definite error. The cost is that they fire on
work that would have succeeded — a report that usually takes 8 seconds and occasionally
takes 12 — so the value encodes a judgement about which failure you prefer.

Setting only `query_timeout` looks like protection and is close to the opposite: latency
is bounded while server load is not. Setting only `statement_timeout` is far better, and
the pair together is best.

## Gotchas

**Symptom:** Queries time out client-side but the database is still overloaded
**Cause:** `query_timeout` only stops waiting — measured, the statement was still `active`
server-side afterwards.
**Fix:** Set `statement_timeout` as well; that is the one that cancels work.

**Symptom:** The process exits with an uncaught error and no stack from your code
**Cause:** A `FATAL` (idle-in-transaction termination, admin disconnect) emitted as an
`'error'` event.
**Fix:** `pool.on('error', …)`.

**Symptom:** `57014 canceling statement due to statement timeout`
**Cause:** The timeout working as intended.
**Fix:** Optimise the query or raise the limit for that transaction with `SET LOCAL` —
not globally.

**Symptom:** `VACUUM` stops reclaiming space and tables bloat
**Cause:** A long-open idle transaction pinning the xmin horizon.
**Fix:** `idle_in_transaction_session_timeout`, and never hold a transaction across an
external call.

**Symptom:** Connections die after a period of inactivity
**Cause:** An intermediary dropping idle TCP connections.
**Fix:** `idleTimeoutMillis` below theirs; add TCP keepalives.

**Symptom:** A migration hangs and takes the site down with it
**Cause:** `ALTER TABLE` queued for `ACCESS EXCLUSIVE`, blocking everything behind it.
**Fix:** `SET lock_timeout` before the DDL and retry.

**Symptom:** Requests hang with no query running
**Cause:** Waiting for a pooled connection; no `connectionTimeoutMillis`.
**Fix:** Set it, and find the leak.

## Interview questions

**★ What is the difference between `statement_timeout` and `query_timeout`?**
`statement_timeout` is server-side: PostgreSQL cancels the statement, raises `57014`, and
the connection remains usable. `query_timeout` is client-side: `pg` stops waiting and
rejects, but the server keeps executing — measured, the statement was still `active` in
`pg_stat_activity` after the client gave up. Only `statement_timeout` protects the
database.

**★ Why is `pool.on('error')` required, and what does it have to do with timeouts?**
Because a server-side termination — `idle_in_transaction_session_timeout`, an admin
disconnect — kills the session when there may be no in-flight query to reject. `pg` emits
an `'error'` event instead, and an unhandled `'error'` event is an uncaught exception that
kills the Node process. Measured: the connection was terminated and became unqueryable.

**★ Why set `idle_in_transaction_session_timeout`?**
An open, idle transaction holds its locks and pins the xmin horizon, which stops `VACUUM`
reclaiming dead tuples database-wide. The usual cause is a `BEGIN` followed by an
`await` on something external. Terminating such sessions after 30–60 seconds bounds the
damage.

**★ When would you use `lock_timeout`?**
Before DDL. An `ALTER TABLE` waiting for `ACCESS EXCLUSIVE` blocks every query that
arrives behind it, so waiting is worse than failing — `lock_timeout` makes the migration
give up quickly and retry rather than causing an outage.

**How should the client and server timeouts relate?**
Set `query_timeout` slightly *above* `statement_timeout`, so the server's cancellation
fires first and you get an informative `57014` rather than an opaque read timeout with a
statement still running.

---

← [Prepared statements](10-prepared.md) · Next → [One query, one statement](12-one-statement.md)
