---
title: "Driver lifecycle"
sidebar_label: "03 · Driver lifecycle"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**, `pg` 8.23.0 and `mongodb` 7.5.0.

**Connect at boot, verify on the health check, close on shutdown.** Three moments,
each of which decides whether a bad deploy fails loudly in ten seconds or quietly
serves errors for an hour.

## Nothing connects when you construct the pool

```console
$ node ex9-lifecycle.mjs lazy
new Pool() to a dead port returned in 0 ms, totalCount = 0
first query failed after 9 ms: ECONNREFUSED connect ECONNREFUSED 127.0.0.1:1
bad credentials -> 28P01 | password authentication failed for user "postgres"
```

`new pg.Pool()` performs no I/O. A wrong host, a wrong port, a wrong password, a
database that does not exist — **none of it surfaces until the first query**, which
is to say until the first user request. Your process starts, reports healthy, joins
the load balancer, and then 500s.

Make it fail at boot instead:

```js
// db.js
import pg from 'pg';

export const pool = new pg.Pool({connectionString: process.env.DATABASE_URL, max: 10});
pool.on('error', (err) => logger.error({err}, 'idle db connection died'));

export async function connectDatabase() {
  const {rows} = await pool.query('select current_database() db, version()');
  logger.info({db: rows[0].db}, 'database ready');
}
```

```js
// server.js
await connectDatabase();          // throws -> the process exits before it can serve
const server = createServer(app);
server.listen(3000);
```

```console
boot check (select 1) took 17 ms; pool now has 1 connection
```

Seventeen milliseconds to convert "500s on every request" into "the container never
started". An orchestrator handles the second one for you: the deploy halts and the
previous version keeps serving.

MongoDB behaves the same way, with a longer fuse:

```console
$ node ex9-lifecycle.mjs mongo
new MongoClient() returned in 16 ms
connect() to a dead port failed after 2013 ms: MongoServerSelectionError | connect ECONNREFUSED 127.0.0.1:1
```

That was with `serverSelectionTimeoutMS=2000`. The **default is 30 000 ms**, so a
misconfigured host makes boot hang for half a minute before telling you anything.
Lower it for the boot check.

## Health checks: liveness is not readiness

Two endpoints, two different questions.

```js
// liveness: is this process wedged? Do NOT touch the database.
app.get('/healthz', (req, res) => res.status(200).end());

// readiness: can this process actually serve traffic?
app.get('/readyz', async (req, res) => {
  try {
    await pool.query({text: 'select 1', query_timeout: 1000});
    res.status(200).json({db: 'up', pool: {total: pool.totalCount, waiting: pool.waitingCount}});
  } catch (err) {
    res.status(503).json({db: 'down', error: err.code});
  }
});
```

**Putting the database in your liveness probe is how one slow query restarts your
whole fleet.** Liveness failing means "kill this process"; a database that is down
is not fixed by killing every process that talks to it. Readiness failing means
"stop sending it traffic", which is the correct response.

Keep the check cheap — `select 1`, or `ping` for Mongo (measured at **8 ms**) — and
give it its own timeout, or the probe inherits the outage it is meant to report.

## Shutdown: close after the server, not before

The order is the whole lesson. [Phase 5, page
17](../phase-5-http-processes/17-graceful-shutdown.md) drains the HTTP server;
the database close hangs off the end of that.

```js
async function shutdown(signal) {
  logger.info({signal}, 'shutting down');
  await closeHttpServer();        // stop accepting, drain in-flight requests
  await pool.end();               // now nothing can be mid-query
  await mongo.close();
  process.exit(0);
}
```

`pool.end()` waits for checked-out connections to come back, then closes each one.
Reverse the order and you cancel queries that a still-running request is waiting
for. After it resolves the pool is finished for good:

```console
query after pool.end() -> Cannot use a pool after calling end on the pool
query after close() -> MongoNotConnectedError | Client must be connected before running operations
```

Both are permanent. There is no reconnect — you build a new pool, which in practice
means the process restarts.

## The connections you did not close

A pooled socket is a live libuv handle, which is why `allowExitOnIdle` defaults to
`false`: an idle pool keeps `node script.js` running forever. For a server that is
what you want. For a migration script, a cron job or a test suite, end the pool or
set `allowExitOnIdle: true`.

If a test runner reports *"a worker process has failed to exit gracefully"*, an
open pool is the first suspect.

## Timeouts belong on the connection, not on hope

Three different knobs, three different behaviours — and one of them is a trap.

```console
$ node ex15-knobs.mjs
statement_timeout 500 -> 57014 after 535 ms: canceling statement due to statement timeout
  the connection is still usable: { ok: 1 }
query_timeout 500 -> Query read timeout after 512 ms
  server-side queries still running: 1
idle_in_transaction_session_timeout -> 25P03: terminating connection due to idle-in-transaction timeout
```

| Setting | Enforced by | Effect |
|---|---|---|
| `statement_timeout` | the **server** | Cancels the query, error `57014`, connection survives |
| `query_timeout` | the **client** | Rejects your promise — **the server keeps running the query** |
| `idle_in_transaction_session_timeout` | the **server** | Kills a transaction someone forgot to end (`25P03`) |

`query_timeout` alone is a liar: your request gave up, the database is still
burning CPU on it, and the connection is unusable until it finishes. **Set
`statement_timeout`** — it is the only one that stops the work. This is the same
shape as `requestTimeout` needing `connectionsCheckingInterval` in [Phase 5, page
01](../phase-5-http-processes/01-http-server.md): the client-side clock and the
server-side clock are different clocks.

A sane baseline in the connection string, so every connection inherits it:

```
postgres://…/shop?statement_timeout=5000&idle_in_transaction_session_timeout=10000
```

Note where that `25P03` was emitted: on a **checked-out client**, not the pool. A
`pool.on('error')` handler was installed and the process still crashed. Handle
errors around checked-out clients yourself ([page 01](./01-connection-pooling.md)).

## Mongo's defaults, printed

```console
default maxPoolSize: 100 | minPoolSize: 0 | serverSelectionTimeoutMS: 30000
  | connectTimeoutMS: 30000 | retryWrites: true | retryReads: true
```

- **`maxPoolSize: 100`** per client, ten times `pg`'s default. Multiply by your pod
  count before deciding it is fine.
- **`retryWrites` / `retryReads` are on**, so the driver already retries one
  transient failure for you — worth knowing before you add a retry loop on top
  ([page 14](./14-retry-backoff.md)).
- `serverSelectionTimeoutMS: 30000` is the fuse on every operation while the
  topology is unknown, not just on connect.

One `MongoClient` per process, at module scope, shared by everything — it *is* the
pool.

## Gotchas

**Symptom:** The app boots green, then every request 500s with `ECONNREFUSED`
**Cause:** Pools connect lazily; nothing validated the config at startup.
**Fix:** `await pool.query('select 1')` before `listen()`.

**Symptom:** A database blip restarts every pod
**Cause:** The liveness probe queries the database.
**Fix:** Liveness returns 200 unconditionally; readiness does the query.

**Symptom:** Requests fail during shutdown
**Cause:** The pool was closed before the HTTP server drained.
**Fix:** Drain HTTP first, then `pool.end()`.

**Symptom:** A script or test run never exits
**Cause:** An idle pool is a live handle.
**Fix:** `await pool.end()` in a `finally`, or `allowExitOnIdle: true`.

**Symptom:** A query timed out but the database is still at 100% CPU
**Cause:** `query_timeout` is client-side only.
**Fix:** `statement_timeout`, which cancels the query server-side.

**Symptom:** Boot hangs for 30 s on a bad Mongo host
**Cause:** `serverSelectionTimeoutMS` defaults to 30 000.
**Fix:** Lower it, at least for the startup check.

## Interview questions

**★ When does a `pg.Pool` actually connect?**
On the first query. Construction does no I/O — measured at 0 ms against a dead
port, with the `ECONNREFUSED` arriving only when a query was issued. So bad
credentials or a bad host are discovered by your first user unless you run an
explicit check at boot.

**★ Why shouldn't a liveness probe hit the database?**
Liveness failure means "restart this process", and restarting does not fix a
database outage — it turns one incident into a crash-loop across the fleet.
Readiness is the probe that should fail, because its consequence is "stop routing
traffic here".

**★ What order do you close things in on `SIGTERM`?**
HTTP server first (stop accepting, drain in-flight requests), then the database
pool. Closing the pool first cancels queries that in-flight requests are still
waiting on.

**★ What is the difference between `statement_timeout` and `query_timeout` in `pg`?**
`statement_timeout` is enforced by Postgres: it cancels the query and returns
`57014`, leaving the connection usable. `query_timeout` is enforced by the driver:
your promise rejects but the server keeps executing — verified, the query was still
active afterwards. Only the server-side one actually stops work.

**Why does a Node script with a pool never exit?**
Pooled sockets are active handles and `allowExitOnIdle` is `false` by default. End
the pool, or set the flag.

**What is `maxPoolSize` in the MongoDB driver, and what is its default?**
The per-`MongoClient` connection pool size, default 100. Since the client is the
pool, one per process is correct, and the default must be multiplied by your
process count when comparing against the server's connection limit.

---

← Prev: [Parameterized queries](./02-parameterized-queries.md) · Next → [PostgreSQL from Node](./04-postgresql-from-node.md)
