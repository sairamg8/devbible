---
title: "Module scope in a serverless function runs once per instance and not once per request, so where you write `new Pool()` decides how many Postgres backends your traffic spike opens — and the instance that stops serving does not close them, because it is paused rather than exited"
sidebar_label: "03 · The connection you get"
sidebar_position: 18
description: "The invocation lifecycle a pool lives inside, module scope versus per-request construction and the real cost of each, why a paused instance still holds its connections, the pg options that exist for this failure mode, and the four placements ranked."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against [Prisma 7 · Database connections](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections) (quoted for the serverless lifecycle, which is a platform property rather than a Prisma one), [`node-postgres` · `pg.Pool`](https://node-postgres.com/apis/pool), [Neon · Connection pooling](https://neon.com/docs/connect/connection-pooling), [Neon · Choosing your connection method](https://neon.com/docs/connect/choose-connection) and [Next.js · `after`](https://nextjs.org/docs/app/api-reference/functions/after) (`version: 16.3.4`).
> Target: `pg` **8.23.0** · `drizzle-orm` **0.45.2** · **PostgreSQL 18.4** · **Next.js 16.3.4** · Node **24.20.0**.
> Documentation-verified; **no sandbox run, no timings**.

**A connection pool is a piece of state that outlives a request, and serverless is a model where the thing that outlives a request is not something you control. The instance that served your `POST` is not destroyed afterwards — it is paused, holding whatever sockets it had open, waiting to see whether another request arrives. Write `new Pool()` at module scope and you have created one pool per instance, alive for as long as the platform keeps that instance, invisible to you the entire time. Write it inside the handler and you have created one per request and paid a full handshake for it. Neither is wrong; both have a cost that only becomes visible at a scale where fixing it is expensive.**

## What actually runs, and when

A Route Handler file has two kinds of code in it, and the difference is not obvious from reading it.

```ts
// app/api/cards/[cardId]/route.ts
import { Pool } from 'pg'

// ── module scope ──────────────────────────────────────────────
// Runs ONCE per instance, on the first request that instance serves.
// Survives every subsequent request that instance serves.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 })

// ── handler scope ─────────────────────────────────────────────
// Runs once per request.
export async function GET(_req: Request, ctx: RouteContext<'/api/cards/[cardId]'>) {
  const { cardId } = await ctx.params
  const { rows } = await pool.query('SELECT id, title FROM cards WHERE id = $1', [cardId])
  return Response.json(rows[0] ?? null)
}
```

On a long-lived Node server that distinction is familiar: module scope is startup, handler scope is per request, and there is one process. On a serverless platform the same two lines mean something different, because **"the process" is now a population**. Module scope runs once per member of that population, and the population's size is decided by your concurrency, not by you.

The lifecycle, stated as the four states a pool can be in:

| Instance state | Is your handler running? | Are the pool's sockets open? |
|---|---|---|
| **Cold start** | yes, after module scope evaluates | being established |
| **Serving** | yes | yes |
| **Paused** | no | **yes** |
| **Being removed** | no | **yes, until the platform tears it down** |

The two bold cells are the whole problem. Prisma documents them, and the behaviour is the platform's rather than the ORM's:

> *"In a serverless environment, each function creates **its own instance** of `PrismaClient`, and each client instance has its own connection pool."*

> *"Many *concurrent functions* responding to a traffic spike 📈 can exhaust the database connection limit very quickly. Furthermore, any functions that are **paused** keep their connections open by default and block them from being used by another function."*

> *"Containers that are marked "to be removed" and are not being reused still **keep a connection open**"*
> — [Prisma 7 · Database connections](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections)

Read the second one carefully. **A paused instance is doing no work and holding your connections.** It is not in a `finally` block; it is not going to run one; it has no event loop running to notice that `idleTimeoutMillis` has elapsed. From the database's point of view an instance that served one request an hour ago and one that is serving right now are indistinguishable.

And the mitigation people reach for does not exist:

> *"There is no guarantee that subsequent nearby invocations of a function will hit the same container"*

so "keep the pool warm and reuse it" is a hope rather than a strategy. Sometimes it works, which is worse than never working, because it means your development experience and your staging environment both confirm a model that production does not follow.

## Module scope: one pool per instance

**What it costs.** `instances × max` connections, where you control `max` and the platform controls `instances`. The arithmetic and the three ways out are [03b](03b-the-arithmetic-and-the-three-escapes.md).

**What it buys.** Reuse *within* an instance. If one instance serves ten requests before being paused, nine of them skip the TCP and TLS handshake. That is real, and on a warm runtime it is the single biggest latency saving available at this layer.

**When it is right.** A long-lived Node server, a container, or a serverless platform where instances are genuinely reused and you have sized `max` against your concurrency ceiling.

**When it is wrong.** A runtime that starts cold for most requests. There, module scope constructs a pool, serves one request, and pauses holding `max` sockets it will never use again — which is strictly worse than a single connection, because you paid for `max` and used one.

```ts
// lib/db/pool.ts — the module-scope form, with every option that matters set.
import 'server-only'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '@/db/schema'

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,   // the POOLED endpoint
  max: 5,                       // per instance. Multiply by your instance count.
  idleTimeoutMillis: 5_000,     // let idle clients drop off the pooler quickly
  connectionTimeoutMillis: 5_000, // pg's default is 0 = wait forever. Never leave it.
  maxLifetimeSeconds: 300,      // rotate clients so a rebalanced pooler is not pinned
})

export const db = drizzle({ client: pool, schema })
```

Two of those are not tuning, they are defect prevention.

**`connectionTimeoutMillis`.** The `pg` default is `0`, which means wait forever. A request that cannot get a connection then hangs until the platform's own timeout kills it, and the symptom is a slow endpoint rather than an error — so it is diagnosed as "the database is slow" for a week before anyone finds the queue.

**`idleTimeoutMillis`.** *"Number of milliseconds a client must sit idle in the pool and not be checked out before it is disconnected"*. It matters here because an idle client still occupies a `max_client_conn` slot on the pooler ([15 · 01b](../15-databases-apis-and-full-stack-patterns/01b-the-three-kinds-of-pool.md)) — but note the limit of the mechanism: **a timer cannot fire in a paused instance.** `idleTimeoutMillis` helps a busy instance shed connections between bursts; it does nothing at all for an instance the platform has frozen.

## Per-request: one connection, then give it back

```ts
// The opposite placement. Correct in some runtimes and expensive in all of them.
import { Client } from 'pg'

export async function GET(_req: Request, ctx: RouteContext<'/api/cards/[cardId]'>) {
  const { cardId } = await ctx.params
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    const { rows } = await client.query('SELECT id, title FROM cards WHERE id = $1', [cardId])
    return Response.json(rows[0] ?? null)
  } finally {
    await client.end()
  }
}
```

**What it costs.** A full connection setup per request. Neon quantifies the shape of it when contrasting transports:

> *"**HTTP** uses `fetch` requests. It is faster for single queries (~3 round trips vs. ~8 for TCP) and supports non-interactive transactions."*
> — [Neon · Choosing your connection method](https://neon.com/docs/connect/choose-connection)

Eight round trips before your query starts, on every request, plus TLS. On a request that runs one indexed lookup, the connection is the request.

**What it buys.** A bounded, predictable connection count: one per *in-flight* request rather than `max` per *existing instance*. Nothing is held by a paused instance because nothing survives the handler.

🔴 **The `finally` is not optional and it is the part that gets removed during a refactor.** A `return` inside the `try` without the `finally` leaks a connection per request, and the leak is silent until the pooler's client limit is reached — at which point the error is `no more connections allowed`, which reads like a capacity problem rather than a missing `end()`.

## The four placements, ranked

| Placement | Connections held | Handshake cost | Where it is right |
|---|---|---|---|
| Module-scope `Pool`, pooled endpoint | `instances × max` | amortised | Warm runtimes, containers, a real Node server |
| Module-scope `Pool` with `max: 1` | `instances` | amortised | Serverless where you want reuse and a hard per-instance cap |
| Per-request `Client`, `end()` in `finally` | in-flight requests | every request | Cold-start-dominated runtimes; cron; scripts |
| HTTP driver (`neon()`), no session at all | none | one HTTPS request | One-shot queries and non-interactive transactions |

The last row is the honest answer for a large fraction of a CRUD API, and it is worth taking seriously rather than treating as an exotic option: four of the five queries in [02](02-the-schema-and-the-migration-story.md) are single statements with no interactive transaction. Neon's serverless driver serves those over `fetch` with nothing to pool, nothing to leak and no lifecycle to get wrong. What it cannot do is an interactive transaction — read a row, branch in JavaScript, write conditionally, all inside one transaction — which is exactly what topic 09 needs. That is why this chapter keeps a TCP pool: not because the reads need it, but because the writes do.

⚠️ **A single application can use both**, and the split is the same one as `DATABASE_URL` versus `DIRECT_URL`: one transport per kind of work, chosen once, in the DAL, where nothing else can see the decision. What it must not become is a per-call-site choice, because then "which connection does this query use" is a question you answer by reading every file.

## The client went away and the query did not

Route Handlers are built on the Web `Request` and `Response` APIs, so the incoming request exposes an `AbortSignal` that fires when the client disconnects. It is tempting to read that as "the work stops". It does not — it stops your *handler* from being useful, and the database is a separate process that has never heard of the HTTP connection.

A statement already executing on a Postgres backend runs until it completes or until something aborts it, and the mechanism that aborts it is a server-side setting rather than a client hanging up:

> *"Abort any statement that takes more than the specified amount of time… A value of zero (the default) disables the timeout."*

> *"Setting `statement_timeout` in `postgresql.conf` is not recommended because it would affect all sessions."*
> — [PostgreSQL 18 · `statement_timeout`](https://www.postgresql.org/docs/18/runtime-config-client.html)

So the default is unbounded, and the recommended place to set it is per session or per role rather than globally:

```sql
-- A bound on every statement the application role can issue.
-- Migrations and analytics use different roles, or override it per session.
ALTER ROLE sprintdesk_app SET statement_timeout = '10s';
```

That one line is the difference between a user closing a tab and a runaway query holding a backend out of the pooler's limited set for as long as it feels like. It is also the second half of the pair in [02d](02d-the-lock-a-migration-actually-takes.md): `lock_timeout` bounds waiting for a lock, `statement_timeout` bounds the statement itself, and they are not substitutes.

⚠️ **Whether `pg` 8.23.0 will cancel an in-flight query when the promise awaiting it is abandoned is not something I could settle from its documentation.** Do not assume it does. Design as though an issued statement runs to completion regardless of what your handler does next, set `statement_timeout` on the role, and treat any client-side abort as a way to stop *waiting* rather than a way to stop *working*.

🔴 **This interacts badly with `after()`.** Work scheduled after the response extends the invocation's lifetime, so a slow query in an `after` callback keeps the instance — and its connections — alive well past the point where anybody is waiting for it. Combined with an unbounded `statement_timeout`, that is a connection held for as long as the query runs, with no client and no operator watching. [03d](03d-what-does-not-survive-the-pooler.md) covers the rest of what `after()` does to a connection.

## Gotchas

**★ Symptom: `too many connections` under load, and the database CPU is idle.** Cause: the count is `instances × max` and the instances are mostly paused, holding sockets and running nothing. Fix: point the application at the **pooled** endpoint, shrink `max`, and do the arithmetic before the spike rather than after — [03b](03b-the-arithmetic-and-the-three-escapes.md).

**★ Symptom: an endpoint gets slower and slower and eventually times out, with no error in the logs.** Cause: `connectionTimeoutMillis` is `0`, the pool's waiting queue is full, and requests are waiting forever for a client that never becomes free. The platform's timeout eventually kills them, so the symptom is latency rather than a connection error. Fix: set `connectionTimeoutMillis`. An error that says "could not get a connection" is diagnosable; a slow request is not.

**★ Symptom: `idleTimeoutMillis` is set and connections are still held for hours.** Cause: a paused instance has no running event loop, so the timer that would close an idle client never fires. Fix: accept that this is not solvable from inside the instance, and solve it at the layer that can see across instances — the transaction-mode pooler, whose whole purpose is that an idle client holds a cheap socket rather than a backend process.

**★ Symptom: a `Client` is constructed per request and connections still climb.** Cause: an early `return` or a thrown error skipped the `end()`. Fix: `end()` in a `finally`, never on the happy path. And prefer the pool-with-`max`-1 shape if the code has multiple exits, because a pool's `release()` is easier to get right than a client's lifecycle.

**★ Symptom: performance is fine locally and terrible on the first request of every cold instance.** Cause: module scope is doing the connection setup, and a cold start pays it — roughly eight round trips plus TLS before the first query runs. Fix: this is inherent to a TCP session on a cold runtime; the only real mitigations are fewer cold starts, a smaller `max` so fewer connections are established eagerly, or the HTTP driver for the queries that do not need a session.

**★ Symptom: two queries in a row in one handler see different session state.** Cause: two bare statements are two transactions under a transaction-mode pooler, so they may land on two different backends. Fix: this is [03d](03d-what-does-not-survive-the-pooler.md), and the short version is that nothing you `SET` survives between statements. Wrap the pair in an explicit transaction if they must share a backend.

**★ Symptom: the pool is constructed in the route file, and there are now four pools.** Cause: `new Pool()` written wherever it was needed, so every module that touches the database has its own. Fix: exactly one module constructs it, it is `server-only`, and a lint rule forbids importing `pg` anywhere else — the invariant from [04](04-the-data-access-layer.md).

**★ Symptom: `max` was raised to fix slowness and the database fell over.** Cause: `max` is per instance, so raising it multiplies by a number you do not control. Fix: the slowness was almost certainly queueing on the pooler's `default_pool_size`, which raising `max` makes worse. Read the error string first; the decision procedure is in [15 · 01b](../15-databases-apis-and-full-stack-patterns/01b-the-three-kinds-of-pool.md).

**★ Symptom: users abandon a slow page and the database load does not fall.** Cause: a disconnected HTTP client does not stop a running SQL statement — the backend is a separate process with no knowledge of your socket, and `statement_timeout` defaults to zero, meaning no bound at all. Fix: `ALTER ROLE sprintdesk_app SET statement_timeout = '10s'`. Per role, not in `postgresql.conf`, because the documentation warns that a global setting *"would affect all sessions"* — and your migration runner legitimately needs a longer one.

**★ Symptom: a bad query took the API down and killing the requests did not help.** Cause: the requests were the symptom. Cancelling a client's wait does not cancel the statement, and without `statement_timeout` there is nothing that will. Fix: set the bound before you need it. This is the pair to `lock_timeout` from [02d](02d-the-lock-a-migration-actually-takes.md) — one bounds waiting for a lock, the other bounds the statement, and having only one of them leaves the other failure unbounded.

## Interview questions

**★ Why does `new Pool()` at module scope behave differently in serverless than on a server?**
Because module scope means "once per process" and serverless replaces one process with a population of them whose size you do not control. On a server, one pool with `max: 10` is ten connections, forever. On a serverless platform, the same line is ten connections *per instance*, and the instance count tracks concurrency — so a traffic spike multiplies your connection use by a factor that is a property of the traffic rather than of your configuration. The code is identical and the meaning is not, which is why this is the placement decision people get wrong: nothing in the file tells you which world it is in.

**★ What does it mean that an instance is paused rather than exited, and why does it matter to a database?**
It means the process still exists with all its state, including open sockets, but nothing is running — no handler, no timers, no `finally` blocks. From the database's side a paused instance and a busy one look the same: both hold their backends. Prisma's documentation says it directly, that *"any functions that are paused keep their connections open by default and block them from being used by another function"*, and that even containers marked for removal *"still keep a connection open"*. The consequence is that every idle-connection mechanism that lives inside your process — `idleTimeoutMillis`, a cleanup on shutdown, a `process.on('exit')` handler — is unavailable exactly when you need it, because the process is not running to execute it.

**★ When is a per-request connection the right choice, and what is the honest cost?**
When instances are cold for most requests, so a pool has nothing to amortise and only holds sockets that will never be reused. Then one connection per in-flight request is a genuinely better bound than `max` per existing instance, because it is proportional to actual work rather than to instance count. The cost is the setup, and it is not small: Neon puts a TCP connection at roughly eight round trips against three for its HTTP transport, and that is before TLS. On a handler whose query is one indexed primary-key lookup, the connection dominates the request. Which is the argument for the fourth option — if the query needs no session, the HTTP driver removes the connection rather than paying for it.

**★ Why not just raise `max` when the API is slow?**
Because `max` is the per-instance ceiling and almost every "slow under load" symptom is a queue somewhere else. If requests are waiting on your pool, raising `max` moves the queue to the pooler; if they are waiting on the pooler's `default_pool_size`, raising `max` makes contention worse by having more clients competing for the same backends; and if they are waiting on `max_connections`, raising `max` converts queueing — which is recoverable — into hard connection failures, which are not. The number you should compute first is `instances × max` against your plan's limit. The error string tells you which wall you actually hit, and the three walls have three different remedies.

**★ Which of the four placements would you pick for this chapter's card API, and why is that not one decision?**
Two, split by workload. The single-statement reads and the simple writes have no session requirement, so they would be perfectly served by the HTTP driver with no lifecycle at all. The multi-table writes in topic 09 need an interactive transaction — read, branch in JavaScript, write conditionally, commit — which the HTTP transport structurally cannot offer, so those need a TCP session through the pooled endpoint. What makes that manageable is that the choice lives in exactly one place: the DAL constructs whichever client each function needs, and no route handler ever knows which transport its query used. The failure mode to avoid is not "using both" but "choosing per call site", because then the transport becomes something you determine by reading every file.

**★ Your pool has `idleTimeoutMillis: 5000` and connections are still held for an hour. Is the setting broken?**
No — it is correct and it is unreachable. `idleTimeoutMillis` is implemented as a timer on your event loop, and a paused serverless instance has no event loop running, so the timer neither fires nor advances. The setting does real work on an instance that is alive and between bursts of traffic; it does nothing for one the platform has frozen. That is the general shape of this whole topic: every mitigation that lives inside the instance is unavailable in exactly the state that causes the problem, which is why the durable fix is at a layer that can see across instances — a transaction-mode pooler, where an idle client costs a socket rather than a backend process.

**★ A user closes the tab mid-request. What happens to the query?**
It keeps running. The `AbortSignal` on the Web `Request` tells your handler the client is gone, and the database is a separate process that has never heard of your HTTP connection — a statement already executing on a backend runs until it completes or until something aborts it. The thing that aborts it is `statement_timeout`, whose default is zero, meaning no bound. So on a default configuration, a query that takes four minutes takes four minutes, holding a backend out of the pooler's limited set the entire time, with nobody waiting for the result. Set it on the application role, not globally, because the migration runner and the analytics job legitimately want different values — which is the same reason `lock_timeout` is set per migration rather than in `postgresql.conf`.

**★ Why is `statement_timeout` a connection-management setting rather than a performance one?**
Because on a serverless deployment the scarce resource is backends, and a statement's duration is exactly how long it occupies one. A slow query is a latency problem for one user and a capacity problem for everyone — a few hundred long transactions saturate `default_pool_size` and every other request queues behind them. Bounding statement duration therefore bounds the worst case of the whole system, not just the worst case of one endpoint, and it does so from a place no application code can forget. The pairing with `lock_timeout` matters for the same reason: without both, one of the two ways a statement can occupy a backend indefinitely is left uncovered, and which one you left open decides which kind of incident you get.

---

← [02e · Expand and contract](02e-expand-and-contract.md) · [Chapter 16 overview](01-explanation.md) · Next → [03b · The arithmetic and the three escapes](03b-the-arithmetic-and-the-three-escapes.md)
