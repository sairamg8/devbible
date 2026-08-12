---
title: "pool.end"
sidebar_label: "13 · pool.end"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex20-driver.mjs`.

**`pool.end()` waits for in-flight queries, closes every connection, and permanently
retires the pool. It is one line, and getting the *order* right around it is the whole
of graceful shutdown.**

> Shutdown sequencing, health checks and the SIGTERM handler are owned by
> [Driver lifecycle](/docs/nodejs/pages/phase-6-data-access/driver-lifecycle). This page
> is what `end()` itself does.

## It drains, then closes

```console
$ node ex20-driver.mjs
=== 7. pool.end ===
end() waited 319 ms for the in-flight query
in-flight result      : finished
query after end()     → Cannot use a pool after calling end on the pool
second end()          → Called end on pool more than once
```

Three measured facts:

- **`end()` waits.** A query with 300 ms left to run held it for 319 ms, and that query
  **resolved normally**. Nothing in flight is cancelled or lost.
- **The pool is finished afterwards.** Any later `query()` rejects with
  `Cannot use a pool after calling end on the pool`. There is no reopening it — build a
  new pool if you need one.
- **Calling it twice throws.** `Called end on pool more than once`. Signal handlers fire
  more than once more often than people expect, so guard it.

```js
let closing = null;
export const shutdown = () => (closing ??= pool.end());
```

## The order that matters

```js
process.on('SIGTERM', async () => {
  server.close();                 // 1. stop accepting new requests
  await once(server, 'close');    // 2. let in-flight requests finish
  await pool.end();               // 3. now close the database connections
  process.exit(0);
});
```

**Close the HTTP server first, the pool last.** Reversed, requests already in progress
find a dead pool and fail — turning a graceful shutdown into a burst of 500s during every
deploy.

`end()` does not need a timeout of its own if the queries have `statement_timeout`
([Timeouts](11-timeouts.md)); the drain is bounded by however long a statement may run.
Without one, a runaway query holds shutdown open until the orchestrator's grace period
expires and sends `SIGKILL`.

## Checked-out clients block it

`end()` waits for connections to return to the pool. A client checked out with
`pool.connect()` and never released will hold shutdown open indefinitely — the same leak
that causes request queuing ([`pool.connect` and release](07-connect-release.md)) shows up
here as a process that will not exit.

If shutdown hangs and the pool is idle from the outside, that is the first thing to check.

## Tests that never finish

A module-scope pool keeps a socket open, and an open socket keeps Node's event loop alive.
The symptom is a test run that prints results and then sits there.

```js
// vitest / jest global teardown
export default async () => { await pool.end(); };
```

Jest's "A worker process has failed to exit gracefully" and Vitest's hang at the end of a
run are usually this. See
[Testing against real PostgreSQL](../phase-9-api-crud/16-testing-real-pg.md).

## Scripts

A one-off script must end the pool or it will not exit:

```js
async function main() { /* … */ }

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => pool.end());
```

The `finally` is what makes it exit on the error path too — every sandbox script in this
corpus ends this way.

## `client.end()` is a different thing

For a standalone `pg.Client` — a `LISTEN` listener, a migration script — the equivalent is
`client.end()`, which closes that one connection. Do not call `end()` on a client obtained
from `pool.connect()`; that one gets `release()`
([`Pool` vs `Client`](02-pool-vs-client.md)).

## Trade-off

Draining before closing means no request is cut off mid-flight, at the cost of a shutdown
that takes as long as the slowest running statement — which is unbounded without
`statement_timeout`, and which orchestrators will eventually kill.

The alternative, closing immediately, makes shutdown instant and abandons in-flight work:
committed transactions survive, but the client never learns the outcome. For an HTTP API
draining is clearly right; for a stuck process being force-recycled, the `SIGKILL` is the
point.

## Gotchas

**Symptom:** `Cannot use a pool after calling end on the pool`
**Cause:** A query after shutdown began — usually a background interval or a late
request.
**Fix:** Stop timers and close the server before ending the pool.

**Symptom:** `Called end on pool more than once`
**Cause:** A signal handler running twice, or several shutdown paths.
**Fix:** Memoise the shutdown promise.

**Symptom:** A burst of 500s on every deploy
**Cause:** The pool closed before in-flight requests finished.
**Fix:** `server.close()` first, `pool.end()` last.

**Symptom:** Shutdown hangs and the orchestrator `SIGKILL`s the process
**Cause:** A leaked client, or a query with no `statement_timeout`.
**Fix:** Release clients in `finally`; set a server-side statement timeout.

**Symptom:** The test suite prints results and hangs
**Cause:** A module-scope pool keeping the event loop alive.
**Fix:** `await pool.end()` in global teardown.

**Symptom:** `Client was closed and is not queryable`
**Cause:** `end()` called on a pooled client instead of `release()`.
**Fix:** `release()` for pooled clients, `end()` only for standalone ones.

## Interview questions

**★ What does `pool.end()` do to queries already running?**
It waits for them. Measured, a pool with a 300 ms query in flight took 319 ms to end and
that query resolved normally — nothing is cancelled. Afterwards the pool is permanently
unusable; further queries reject, and a second `end()` throws.

**★ In what order do you shut down an HTTP service that uses a pool?**
Stop accepting connections (`server.close()`), wait for in-flight requests to finish, then
`pool.end()`. Ending the pool first makes requests already in progress fail, which is the
usual cause of errors during deploys.

**★ Why might a process refuse to exit after tests pass?**
An open pool holds sockets, and open handles keep Node's event loop alive. `await
pool.end()` in global teardown fixes it. The same symptom appears in scripts that never
call `end()`.

**★ Why might `pool.end()` hang?**
It waits for checked-out connections to return, so a leaked client — one where `release()`
was skipped on an error path — blocks it indefinitely. A query with no `statement_timeout`
does the same.

**What is the difference between `client.release()` and `client.end()`?**
`release()` returns a pooled client to the pool for reuse. `end()` closes a standalone
`Client`'s connection outright. Calling `end()` on a pooled client removes it from the
pool's management and is a bug.

---

← [One query, one statement](12-one-statement.md) · Next → [LISTEN/NOTIFY from Node](14-listen-notify.md)
