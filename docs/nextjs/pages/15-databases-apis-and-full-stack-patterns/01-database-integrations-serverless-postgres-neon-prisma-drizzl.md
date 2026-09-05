---
title: "A Postgres connection is an operating-system process on the database server, and a serverless function is a process that appears and vanishes — every hard problem in this topic is those two facts refusing to line up"
sidebar_label: "01 · Why serverless breaks pooling"
sidebar_position: 100
description: "The connection lifecycle mismatch at the root of every serverless database failure: what a Postgres backend actually costs, why a driver pool amortises it, and why multiplying pools by function instances is the arithmetic that takes production down."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 reference — [Connection settings](https://www.postgresql.org/docs/18/runtime-config-connection.html) — the [`node-postgres` pooling guide](https://node-postgres.com/features/pooling) and [pool sizing guide](https://node-postgres.com/guides/pool-sizing), and [Neon · Connection pooling](https://neon.com/docs/connect/connection-pooling).
> Documentation-verified; **no sandbox run, no timings of my own**.
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `pg` **8.23.0** · React 19.2.8 · Node 24.20.0.

**Every serverless database disaster you will ever debug reduces to one sentence: PostgreSQL gives each connected client a dedicated backend process on the database server, and a serverless platform gives your code a lifetime measured in one request. A connection pool exists to hide the cost of creating that process by keeping a few of them alive and handing them round; a serverless function has nowhere to keep them. Everything that follows in this topic — the pooled endpoint, transaction-mode PgBouncer, the HTTP driver, where the Prisma client instance lives, why a per-request pool cannot be cached — is a different answer to that same mismatch. Learn the mismatch first and the rest stops being trivia.**

## What a connection actually is

`node-postgres` states the cost of opening one plainly:

> *"Connecting a new client to the PostgreSQL server requires a handshake which can take 20-30 milliseconds. During this time passwords are negotiated, SSL may be established, and configuration information is shared with the client & server."*
> — [node-postgres · Pooling](https://node-postgres.com/features/pooling)

That handshake is not the expensive part. The expensive part is what it creates. PostgreSQL 18 sizes the server around the count:

> *"PostgreSQL sizes certain resources based directly on the value of max_connections. Increasing its value leads to higher allocation of those resources, including shared memory."*
> — [PostgreSQL 18 · Connection settings](https://www.postgresql.org/docs/18/runtime-config-connection.html)

and caps it:

> *"`max_connections` (integer) — Determines the maximum number of concurrent connections to the database server. The default is typically 100 connections, but might be less if your kernel settings will not support it (as determined during initdb). This parameter can only be set at server start."*

Three consequences fall straight out of those quotes, and each one bites in a different place:

1. **A connection is a fixed-cost resource, not a socket.** You cannot have 10,000 of them because you cannot have 10,000 backend processes.
2. **The cap is set at server start.** You cannot raise it under load; that is a restart.
3. **Reserved slots mean the effective cap is lower than the number you configured.** PostgreSQL keeps some back: *"Whenever the number of active concurrent connections is at least max_connections minus superuser_reserved_connections, new connections will be accepted only for superusers."* Neon reserves seven for its own superuser on top of that — *"For a 0.25 CU compute, this means 97 connections are available for your application (104 total - 7 reserved)."*

And there is a fourth consequence that catches people who think of a connection as a pipe:

> *"PostgreSQL can only process one query at a time on a single connected client in a first-in first-out manner."*
> — [node-postgres · Pooling](https://node-postgres.com/features/pooling)

One connection is one query at a time. That is *why* you want several, and it is also why a pool of size 1 is a serialisation point rather than a saving.

## What a driver pool does, and the assumption underneath it

A driver pool — `pg`'s `Pool`, the thing Prisma's `pg` adapter and Drizzle's `node-postgres` driver both wrap — keeps N already-handshaken connections in a process-local array. A request checks one out, runs a query, returns it. The handshake is paid once per connection rather than once per query. The pool is created lazily:

> *"The pool is initially created empty and will create new clients lazily as they are needed."*
> — [node-postgres · `pg.Pool`](https://node-postgres.com/apis/pool)

and when it is full, callers queue:

> *"If the pool is 'full' and all clients are currently checked out, requests will wait in a FIFO queue until a client becomes available by being released back to the pool."*

**The assumption underneath all of that is that the process outlives the request.** A pool is only a saving if the second request finds the connections the first request warmed. A long-lived Node server on a VPS satisfies that assumption perfectly. A function that is frozen after the response and thawed for the next one satisfies it *sometimes*. A worker that is destroyed at the end of every request does not satisfy it at all, and there the pool is pure overhead: you pay the handshake, use it once, and throw it away.

```ts
// lib/db/pool.ts — the classic, correct-on-a-server shape.
// It is module scope: created once per *process*, not once per request.
import { Pool } from 'pg'

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,                      // node-postgres default; see the sizing section below
  idleTimeoutMillis: 10_000,    // node-postgres default
  connectionTimeoutMillis: 5_000, // NOT the default — the default is 0, meaning wait forever
})

pool.on('error', (err) => {
  // The pool emits on behalf of *idle* clients when the backend or the network dies.
  // Without this listener an idle-client error is an unhandled 'error' event and kills the process.
  console.error('idle client error', err)
})
```

Two things in that snippet are load-bearing and get skipped. `connectionTimeoutMillis` defaults to `0`, and the API reference says what that means: *"By default this is 0 which means no timeout."* A request that cannot get a connection will hang until the platform's own function timeout kills it, which is the worst possible failure shape — you burn the whole invocation budget and return nothing. And the `error` listener is not optional in Node: an `EventEmitter` that emits `'error'` with no listener throws.

## The arithmetic that takes production down

Write the numbers down, because nobody does and that is the whole bug.

**Connections in flight = (number of running instances) × (pool `max` per instance).**

That is it. There is no other term. Prisma's serverless documentation says the same thing in prose:

> *"In a serverless environment, each function creates **its own instance** of `PrismaClient`, and each client instance has its own connection pool."*
> — [Prisma 7 · Database connections](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections)

> *"Many concurrent functions responding to a traffic spike 📈 can exhaust the database connection limit very quickly. Furthermore, any functions that are **paused** keep their connections open by default and block them from being used by another function."*

Now put real numbers in it. A Neon 1 CU compute has `max_connections = 419` (Neon's published table). Leave the `pg` default `max: 10` in place. You are safe up to **41 concurrent instances** and you fall over at 42 — and 42 concurrent instances is a completely ordinary Tuesday for a Next.js app that has one slow Server Component. On a 0.25 CU compute (`max_connections = 104`, 97 usable) the same default gives you **nine instances**.

The failure is not gradual. The 42nd instance does not get slower; it gets an error. Neon quotes the string:

> `FATAL: remaining connection slots are reserved`

and the "paused function keeps its connection" clause means the count does not drop when traffic does. You can be at the cap with an idle application.

⚠️ **The number that matters is instances, and you do not control it.** Autoscaling means the right-hand term of that multiplication is chosen by your host in response to load — exactly the moment you least want to exhaust the database. This is why "it worked in staging" is not evidence: staging ran one instance.

## Sizing `max`, and why the answer is usually "leave it alone"

The `node-postgres` sizing guide is unusually candid and worth quoting rather than paraphrasing, because the advice is the opposite of what people guess:

> *"If your app isn't running in a k8s style env with containers scaling automatically or lambdas or cloud functions etc., you can do some 'napkin math' for the `max` pool config you can use."*

> *"Typically, though, I don't bother setting it to anything other than the default of `10` as that's usually fine."*

> *"If you're running an application under pretty serious load where you need dynamic scaling or lots of lambdas spinning up and sending queries, your queries are likely fast and you should be fine setting the `max` to a low value like 10 — or just leave it alone, since `10` is the default."*
> — [node-postgres · Pool sizing](https://node-postgres.com/guides/pool-sizing)

And the trap on the other side:

> *"Setting the pool to a size larger than 1 is still recommended, as things like tRPC and other server-side routing & request batching code could result in multiple independent queries executing at the same time. With a pool size of `1` you are turning what is 'a few things at once' into all things waiting in line one after another on the one available client in the pool."*

That last one is precisely a Next.js problem. A Server Component tree renders several independent `await`s concurrently; a page with a header, a sidebar and a board each fetching their own data will issue three queries at once. Pool `max: 1` turns your carefully parallelised render into a queue and your slowest sequential path becomes the sum of all three.

🔴 **`max: 1` is not "safe for serverless". It is a self-inflicted latency bug that also does not fix connection exhaustion**, because 200 instances × 1 is still 200 connections.

## Fluid / warm compute changes the sums, but only in one direction

Vercel's fluid compute model reuses a warm function process across invocations. `node-postgres` addresses it by name:

> *"If you're running on Vercel with fluid compute, your serverless functions can handle multiple requests concurrently and stick around between invocations. In this case, you can treat it similarly to a traditional long-lived process and use a default-ish pool size of `10`. The pool will stay warm across requests and you'll get the benefits of connection reuse. You'll probably need to put pgBouncer (or some kind of pooler like what is offered with Supabase, RDS, GCP, etc.) in front of your database, as Vercel worker count can grow quite a bit larger than the number of reasonable max connections Postgres can handle."*

Neon says the same from its side:

> *"**Vercel (Fluid compute):** Use `pg` (node-postgres) with `@vercel/functions`. Vercel Fluid keeps functions warm long enough to reuse TCP connections, so you skip the connection setup cost on subsequent requests."*
> — [Neon · Choosing your connection method](https://neon.com/docs/connect/choose-connection)

Read what that does and does not buy you. It buys you **connection reuse** — the handshake is amortised again, so a driver pool is worth having. It does **not** buy you a smaller instance count. Both sources say to put a proxy pooler in front anyway, because the number of warm workers is still larger than the number of backends Postgres can host. Warm compute fixes the latency half of the mismatch and leaves the capacity half exactly where it was.

I could not find a primary source that quantifies how long a fluid worker stays warm, and I am not going to invent one. Treat it as "long enough that reuse is likely, never long enough to be a guarantee" — which means your code must still be correct when the process is brand new.

## The three escapes, named now and taken apart later

There are exactly three structural answers to the mismatch, and the rest of this topic is one chunk per answer.

| Escape | What it changes | Where it is taught |
|---|---|---|
| **Put a proxy pool between the app and Postgres** | Many app connections multiplex onto few backend processes. The app's connection stops being a backend process. | [01b](01b-the-three-kinds-of-pool.md), [01c](01c-transaction-pooling-and-session-state.md) |
| **Stop using TCP at all** | An HTTP request carries the query; there is no session to keep alive, so there is nothing to pool. | [01d](01e-the-http-driver-and-one-shot-queries.md) |
| **Make the process long-lived after all** | Warm/fluid compute, or a real server. The classic pool works again. | this page, plus [11 · Node.js runtime vs Edge](../11-performance-optimization-turbopack/04-nodejs-runtime-vs-edge-runtime-capabilities-cold-starts-choo.md) |

Note what is *not* on that list: "use a smaller pool", "call `end()` more", "use a different ORM". None of those change the arithmetic. Prisma, Drizzle and hand-written `pg` all sit on the same three escapes; the ORM choice ([01h · Prisma and Drizzle as models](01h-prisma-and-drizzle-as-models.md)) is orthogonal to the connection problem and it is worth being blunt about that, because the internet mostly is not.

## Gotchas

**★ Symptom: the app works locally and under load returns `FATAL: remaining connection slots are reserved`.** Cause: instances × pool `max` exceeded `max_connections`, and the multiplication was never written down. Fix: compute the budget explicitly and cap the app side, then move to a proxy pool rather than shrinking `max` further.

```ts
// lib/db/pool.ts
// Budget: Neon 1 CU -> max_connections 419, 7 reserved for Neon's superuser.
// Reserve 20 for migrations, psql and dashboards. 392 usable.
// Target 30 concurrent instances -> 392 / 30 = 13. Round down hard.
const MAX_PER_INSTANCE = Number(process.env.DB_POOL_MAX ?? 10)

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // must be the -pooler host; see 01b
  max: MAX_PER_INSTANCE,
  connectionTimeoutMillis: 5_000,
})
```

**★ Symptom: a request hangs until the platform's function timeout, with no error in the logs.** Cause: `connectionTimeoutMillis` defaults to `0`, which the `pg` API reference defines as *"no timeout"*, so a request that cannot acquire a connection waits forever inside the pool's FIFO queue. Fix: always set it, and set it below your function timeout so you get your own error rather than the platform's.

```ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5_000, // fail fast, inside the invocation, with a message you wrote
})
```

**★ Symptom: the Node process exits with an unhandled `'error'` event referencing a client you were not using.** Cause: the pool emits `'error'` on behalf of *idle* clients when the backend restarts or the network partitions, and an `EventEmitter` with no `'error'` listener throws. Fix: attach the listener at pool construction, unconditionally.

```ts
pool.on('error', (err) => {
  console.error('[pg] idle client error', err)
  // Do NOT process.exit() in a serverless function — you will kill an
  // invocation that was serving an unrelated request on the same instance.
})
```

**★ Symptom: connections leak until the pool is permanently empty and every request queues forever.** Cause: a `pool.connect()` whose `client.release()` sits after a line that can throw. The `pg` docs are emphatic: *"You must always return the client to the pool if you successfully check it out, regardless of whether or not there was an error with the queries you ran on the client."* Fix: `try/finally`, or do not check out at all.

```ts
// Leaks on any throw between connect() and release().
const bad = async () => {
  const client = await pool.connect()
  const rows = await client.query('SELECT 1') // throws -> release never runs
  client.release()
  return rows
}

// Correct: finally, always.
const good = async () => {
  const client = await pool.connect()
  try {
    return await client.query('SELECT 1')
  } finally {
    client.release()
  }
}

// Better where you do not need a transaction: never check out at all.
const best = () => pool.query('SELECT 1')
```

**★ Symptom: a transaction's `COMMIT` lands on a different row set than its `UPDATE`, or `ROLLBACK` rolls back nothing.** Cause: the statements were issued through `pool.query()`, which the docs describe as dispatching *"every query passed to pool.query on the first available idle client"* — so the `BEGIN`, the `UPDATE` and the `COMMIT` can each land on a different connection. Fix: check a client out for the whole transaction.

```ts
export async function moveCard(cardId: string, columnId: string) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('UPDATE cards SET column_id = $1 WHERE id = $2', [columnId, cardId])
    await client.query('UPDATE columns SET updated_at = now() WHERE id = $1', [columnId])
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
```

**★ Symptom: setting `max: 1` "to be safe on serverless" made every page slower and did not stop the exhaustion.** Cause: two separate errors. Latency, because a Server Component tree issues several independent queries concurrently and `max: 1` serialises them; capacity, because the constraint is instances × `max` and shrinking `max` by 10× does nothing if the host scales 10× further. Fix: leave `max` at the default and move the multiplexing to a proxy pool ([01b](01b-the-three-kinds-of-pool.md)).

**★ Symptom: raising the Neon compute size did not raise the number of concurrent queries you can run.** Cause: you were bounded by `default_pool_size`, not `max_connections`. Neon states it directly: *"Increasing your compute to raise `max_connections` may not help if `default_pool_size` is the bottleneck."* Fix: identify which of the three limits you are hitting before spending money — the error string tells you which, and [01b](01b-the-three-kinds-of-pool.md) maps each string to its limit.

**★ Symptom: the connection count stays at the cap long after traffic dropped to nothing.** Cause: paused-but-not-destroyed function containers. Prisma: *"any functions that are **paused** keep their connections open by default and block them from being used by another function"*, and separately *"Containers that are marked 'to be removed' and are not being reused still keep a connection open"*. Fix: this is not fixable from inside the application; it is the argument for a proxy pool, whose idle client connections are cheap in a way backend processes are not.

**★ Symptom: `max_connections` was raised and the database got slower, or fell over harder.** Cause: PostgreSQL *"sizes certain resources based directly on the value of max_connections. Increasing its value leads to higher allocation of those resources, including shared memory."* More connections means more backend processes competing for the same CPU and memory; past a point you are paying for context switching, not concurrency. Fix: multiplex instead of raising the cap. See [PostgreSQL · PgBouncer exhaustion and sizing](../../../postgresql/pages/phase-13-ops/07-pgbouncer/03-exhaustion-and-sizing.md).

## Interview questions

**★ Why does a connection pool stop working when you move from a VPS to serverless functions?**
Because a pool's entire value proposition is that the process outlives the request. It keeps already-handshaken connections around so the *next* request does not pay the 20–30 ms handshake and, more importantly, so the database does not have to spawn a new backend process. On a long-lived server there is one process and one pool, so N requests share N connections. On serverless there is one pool *per instance*, instances are created and destroyed by the platform in response to load, and a frozen instance keeps its connections open without using them. The pool has not become incorrect — it has become a per-instance multiplier on a resource that is globally capped, which is the opposite of what you wanted.

**★ Write down the formula for how many database connections your deployment can open, and say which term you control.**
Connections in flight equals the number of concurrently running instances multiplied by the pool `max` on each. You control `max`. You do not control the instance count — the platform picks it in response to traffic, which means the multiplier peaks exactly when you can least afford it. That asymmetry is why the fix is never "tune `max`": you can only shrink a term you control by a factor of ten, and the term you do not control can grow by more than that. The structural fixes change the shape of the formula rather than a coefficient in it — a proxy pool decouples app-side connections from backend processes, and an HTTP driver removes the persistent connection entirely.

**★ Is `max: 1` a reasonable pool size for a serverless function?**
No, on two independent grounds. Capacity: 300 instances at `max: 1` is still 300 backend processes, so it does not solve exhaustion; it just makes you feel like you tried. Latency: a Server Component tree renders sibling components concurrently, and each may issue its own query, so a pool of one converts parallel work into a FIFO queue. The `node-postgres` sizing guide makes exactly this argument and recommends leaving the default of 10 alone until you have evidence. The one place a very small pool is defensible is a runtime that is genuinely killed at the end of each request and where you also call `pool.end()`, and even there the guide says 10 is fine.

**★ Why is `connectionTimeoutMillis` more important on serverless than on a server?**
Because its default is `0`, meaning wait forever, and on serverless "forever" is bounded by the platform's function timeout rather than by anything you wrote. The result is that connection exhaustion presents as invocations that burn their full time budget and then die with a platform error, not as a database error you can read. You lose the diagnosis along with the request. Setting it to something comfortably below the function timeout converts a silent hang into an application-level error you raised, with your own message and your own metric, and lets you shed load deliberately instead of queueing into a wall.

**★ A colleague proposes raising `max_connections` from 100 to 2000 to fix exhaustion. What do you say?**
That it trades one failure for a worse one. Each connection is a backend process with its own memory, and PostgreSQL allocates shared resources in proportion to `max_connections` at server start, so raising it costs memory before a single client connects. Two thousand concurrently active backends on a machine with a handful of cores spend their time being scheduled rather than executing. The parameter also cannot be changed without a restart, so it is not a lever you can pull during an incident. The right move is to keep the backend count small and multiplex many application connections onto it with a proxy pool, which is what Neon's pooled endpoint and PgBouncer exist to do.

**★ Your application is idle at 3 a.m. and the connection count is still at the ceiling. Explain.**
Serverless containers that have been paused, or marked for removal but not yet reclaimed, keep their TCP connections and therefore their backend processes. Prisma documents both cases explicitly. Nothing in your application code is running, so nothing in your application code can close them, and the platform gives you no hook that reliably fires. That is the clearest possible argument for a proxy pool: an idle *client* connection to PgBouncer is a cheap socket, whereas an idle *server* connection to Postgres is a process. Moving the idleness to the cheap side of the proxy is the whole trick.

**★ Why does one connection only run one query at a time, and why does that matter to a React Server Component tree?**
The Postgres wire protocol is request/response on a single session; the backend process handles one statement at a time in FIFO order. It matters because RSC encourages you to co-locate fetches — the header component, the sidebar and the board each `await` their own query, and React renders those siblings concurrently. If they share one connection they run one after another and the page's time-to-first-byte becomes the sum, not the max. This is the concrete reason the pool size should be at least a few even in the most constrained runtime, and it is also why the parallel-fetch guidance in [ch04](../04-data-fetching-in-the-app-router/01h-parallel-and-sequential-fetching-and-the-shape-of-a-route.md) silently assumes a pool wide enough to honour it.

---

← [Chapter 15 overview](01-explanation.md) · Next → [01b · Three kinds of pool](01b-the-three-kinds-of-pool.md)
