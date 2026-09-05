---
title: "Instances multiplied by pool max is the only number that predicts whether your API survives a traffic spike, and there are exactly three ways to make it smaller — put a transaction-mode proxy in front, remove the session, or have fewer processes"
sidebar_label: "03b · The arithmetic, three escapes"
sidebar_position: 10
description: "The two terms of the exhaustion product and who controls each, Neon's three published limits and the error string each produces, why default_pool_size is per role and per database, the three escapes with the code for each, and the table of which consumer gets which connection string."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Neon · Connection pooling](https://neon.com/docs/connect/connection-pooling), [Neon · Choosing your connection method](https://neon.com/docs/connect/choose-connection), [`node-postgres` · `pg.Pool`](https://node-postgres.com/apis/pool) and [Prisma 7 · Database connections](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections). Neon's published limits table is quoted verbatim.
> Target: `pg` **8.23.0** · `drizzle-orm` **0.45.2** · **PostgreSQL 18.4** · **Next.js 16.3.4** · Node **24.20.0**.
> Documentation-verified; **no sandbox run, no timings**.

**There is exactly one number to compute before deploying a Postgres-backed API on a serverless platform, and almost nobody computes it: the number of concurrent instances multiplied by each instance's pool `max`. That product is your connection use at peak, and it has the unpleasant property that you control the second term and the platform controls the first. Every mitigation in this area is one of three moves on that product, and knowing which three is more useful than any amount of tuning, because two of them are architectural decisions you make once and the third is a number.**

## The product

```text
peak connections  =  concurrent instances  ×  pool `max`
                     ▲                        ▲
                     │                        └── yours. Default 10 in `pg`.
                     └── the platform's. Tracks concurrency, not your config.
```

Both terms deserve a sentence.

**`max` defaults to `10` in `pg`.** Nobody sets it on day one, so the default is what ships. Ten is a sensible number for one server and a dangerous one for a population.

**Instance count is not a number you set.** It is a function of request concurrency and of how long each request takes, and a slow database makes requests longer, which makes concurrency higher, which creates more instances, which each open `max` connections — a feedback loop where the symptom worsens the cause. That loop is why connection exhaustion presents as a cliff rather than a slope.

And the recovery people expect does not happen, because a paused instance holds its sockets ([03](03-the-connection-you-actually-get.md)). The connection count does not fall when traffic falls; it falls when the platform reclaims instances, on its own schedule.

## The three walls, and the string each one prints

Neon publishes the limits. Quoted verbatim, because this table is the fastest diagnostic in the topic:

| Limit | Value | What it controls | When you hit it |
|---|---|---|---|
| `max_client_conn` | 10,000 | Maximum client connections to PgBouncer | Client gets: `no more connections allowed` |
| `default_pool_size` | 90% of `max_connections` | Maximum active connections per user per database | Client waits in queue (2 min timeout) |
| `max_connections` | Varies by compute | Direct connections to Postgres | Client gets: `too many connections` |

— [Neon · Connection pooling](https://neon.com/docs/connect/connection-pooling)

Read it as a decision procedure, because the three failures have three different remedies and only the error string tells them apart:

- **`too many connections`** (or `FATAL: remaining connection slots are reserved`) → you are on the **direct** endpoint. You never went through the pooler at all. Change the hostname.
- **A hang of roughly two minutes, then a failure** → you are on the pooler and `default_pool_size` is exhausted. This is **transaction duration**, not connection count. Neon's fixed configuration includes `query_wait_timeout=120`, and it says the settings *"are not user-configurable."*
- **`no more connections allowed`** → ten thousand client sockets. That is a leak or a genuinely enormous instance count, not a tuning problem.

⚠️ **The 10,000 is not throughput.** Neon states it: *"The 10,000 connection limit does not mean 10,000 simultaneous query results."* The pooler buys you *idle* capacity, which is precisely the shape of serverless demand, and buys you nothing on the active side.

### `default_pool_size` is per role, per database

> *"PgBouncer creates separate pools for each combination of database user and database name."*

> *"`default_pool_size = 0.9 × max_connections`"*

This is both a lever and a trap, and the difference is whether you also split the workload. Neon lists *"Use multiple database users to get additional pools"* among its remedies, and it is real: a second role gives a second queue, so a saturated read workload stops starving writes. But the pools are not additive at the Postgres end — *"All of these pools share the underlying `max_connections` limit"* — so adding roles without adding compute converts queueing, which is recoverable, into `too many connections`, which is not.

## Escape 1 — a transaction-mode proxy in front

This is the default answer and the one that requires no code change at all, only a hostname.

```bash
# .env — two variables, two hosts, and the difference is seven characters.

# Pooled. PgBouncer in transaction mode. Everything a request path touches.
DATABASE_URL="postgresql://app:pw@ep-cool-darkness-123456-pooler.us-east-2.aws.neon.tech/sprintdesk?sslmode=require"

# Direct. Straight to Postgres, one backend per connection. Migrations and ops only.
DIRECT_URL="postgresql://app:pw@ep-cool-darkness-123456.us-east-2.aws.neon.tech/sprintdesk?sslmode=require"
```

🔴 **The `-pooler` infix goes on the endpoint id, not the region and not the domain.** `ep-<id>-pooler.<region>.aws.neon.tech` is right; anything else resolves elsewhere or nowhere, and the resulting `ENOTFOUND` reads like a network problem rather than a typo.

**What it changes.** Your instances still open `instances × max` *client* connections, but a client connection to PgBouncer is a socket in a single-process event loop, not a Postgres backend. Backends are handed out per transaction and returned at commit, so idle clients cost almost nothing.

**What it costs.** Session continuity, which is [03d](03d-what-does-not-survive-the-pooler.md).

**The condition Neon attaches**, and the reason "double pooling" appears on its pitfalls list:

> *"If you use a pooled Neon connection, avoid adding client-side pooling on top. Let Neon handle it. If you must use client-side pooling, release connections back to the pool promptly to avoid conflicts with PgBouncer."*
> — [Neon · Choosing your connection method](https://neon.com/docs/connect/choose-connection)

The mechanism behind that advice is worth stating, because "do not double pool" is usually repeated without it: a driver pool **holds** a PgBouncer client connection while idle, which occupies a `max_client_conn` slot; and a driver client that opens a transaction and then waits on something pins a *server* connection out of `default_pool_size` for the duration. Neither is fatal, and both are why the numbers in the module-scope pool of [03](03-the-connection-you-actually-get.md) are small and why `idleTimeoutMillis` is short.

## Escape 2 — remove the session

If the query needs no session, it needs no connection.

> *"**HTTP** uses `fetch` requests. It is faster for single queries (~3 round trips vs. ~8 for TCP) and supports non-interactive transactions."*
> — [Neon · Choosing your connection method](https://neon.com/docs/connect/choose-connection)

Neon's serverless driver sends a statement over `fetch`. There is no persistent connection, so there is nothing to size, nothing to leak, nothing to hold while paused, and the exhaustion product simply does not apply to those queries.

```ts
// lib/db/http.ts — the sessionless transport, for one-shot reads.
import 'server-only'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '@/db/schema'

const sql = neon(process.env.DATABASE_URL!)

/** Use for single statements only. No interactive transaction is possible here. */
export const httpDb = drizzle({ client: sql, schema })
```

**What it cannot do.** An interactive transaction — read a row, branch in JavaScript, write conditionally, commit — because there is no session to hold the transaction open across your `await`. It also gives up `SET`, `LISTEN`/`NOTIFY` and anything else session-scoped. Topic 09's retry loop needs the interactive form, which is why this is an escape for part of the API and not for all of it.

**The honest framing.** Four of the five queries in [02](02-the-schema-and-the-migration-story.md) are single statements. Serving those over HTTP and keeping a small TCP pool for the writes that genuinely need a session is not a compromise; it is the shape of the workload.

## Escape 3 — fewer, longer-lived processes

The unglamorous one, and the only one that attacks the left-hand term.

Deploy the API as a long-running Node server or a container rather than as per-request functions, and the instance count becomes something you configure. Three replicas with `max: 10` is thirty connections at any traffic level, and it does not move when a spike arrives.

**What it costs.** You are now operating servers: health checks, rolling deploys, autoscaling policy, and the capacity planning that serverless was supposed to remove. For many APIs that is a worse trade than escapes 1 and 2. For an API whose workload is genuinely transaction-heavy and session-dependent, it is the honest answer, and refusing to consider it means running an architecture whose only failure mode is the one you cannot configure away.

⚠️ **Escape 3 is also the answer to a question the other two cannot address**: work that must outlive a request. A queue worker holding one connection and processing jobs continuously is a process, not a function, and it is why [15 · 04](../15-databases-apis-and-full-stack-patterns/04-background-jobs-and-message-queues-for-async-workloads.md) exists as a separate topic.

## Which consumer gets which string

This table is the whole point of having two variables, and it is worth writing into the repository rather than remembering.

| Consumer | Connection | Why |
|---|---|---|
| Route Handlers, Server Actions, Server Components | **pooled** (`DATABASE_URL`) | Many short transactions from many instances |
| The Data Access Layer's own pool | **pooled** | Same; it is the request path |
| `drizzle-kit migrate` / the migration runner | **direct** (`DIRECT_URL`) | Needs one stable session across DDL and the ledger ([02c](02c-the-migration-is-a-release-step.md)) |
| `CREATE INDEX CONCURRENTLY` | **direct** | Cannot be expressed in the unit a transaction pooler multiplexes |
| `pg_dump` / `pg_restore` | **direct** | Neon: *"relies on `SET` statements. Always use direct connections for `pg_dump`."* |
| `LISTEN` / `NOTIFY` | **direct** | Session-scoped by definition |
| A seed script | **direct**, `max: 1`, and `end()` | It is a script; it wants one session and must let the process exit |
| A long-running queue worker | **direct** or pooled, one connection | It is a process, not a function; the product does not apply |
| Long analytics queries | **direct** | Neon lists them as direct-only to *"Avoid pool contention"* |

Neon's own direct-only list, verbatim:

> *"Schema migrations (Prisma Migrate, Drizzle Kit, django-admin migrate) · `CREATE INDEX CONCURRENTLY` · `LISTEN` / `NOTIFY` · Temporary tables or prepared statements across multiple queries"*

## Assert it at boot, because nobody reviews a secret

The two strings differ by seven characters in the middle of a 120-character value that is stored in a secrets manager and pasted by a human.

```ts
// lib/env.ts — the only module that reads process.env.
import 'server-only'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const DATABASE_URL = required('DATABASE_URL')
export const DIRECT_URL = required('DIRECT_URL')

if (DATABASE_URL === DIRECT_URL) {
  throw new Error('DATABASE_URL and DIRECT_URL are identical — one of them is wrong')
}
if (!new URL(DATABASE_URL).hostname.includes('-pooler.')) {
  throw new Error(`DATABASE_URL is not a pooled endpoint: ${new URL(DATABASE_URL).hostname}`)
}
if (new URL(DIRECT_URL).hostname.includes('-pooler.')) {
  throw new Error('DIRECT_URL points at the pooler — migrations will not work reliably')
}
```

Note that the error message prints the *hostname* and not the URL. A thrown error ends up in a log, and a log with a password in it is a credential rotation.

## Gotchas

**★ Symptom: pooling was enabled in the Neon console and the app still gets `too many connections`.** Cause: the console toggle changes which string it displays; it does not change what your deployment connects to. Neon: *"It doesn't start or stop the pooler at the compute. The pooled endpoint is always available. The toggle just switches the displayed connection string."* Fix: the boot-time hostname assertion above — do not trust that the right value was pasted.

**★ Symptom: queries hang for about two minutes and then fail.** Cause: `default_pool_size` is exhausted and PgBouncer's `query_wait_timeout=120` fired. That is transaction *duration*, not connection count. Fix: find the transaction that is held open across a non-database `await` and commit before doing the slow thing:

```ts
// 🔴 Pins a backend out of default_pool_size for the whole HTTP call.
await db.transaction(async (tx) => {
  const [card] = await tx.insert(cards).values(input).returning()
  await fetch('https://hooks.slack.com/services/xxx', { method: 'POST' })
  return card
})

// ✅ Commit, then do the slow thing.
const [card] = await db.transaction(async (tx) => tx.insert(cards).values(input).returning())
await fetch('https://hooks.slack.com/services/xxx', { method: 'POST' })
```

**★ Symptom: `no more connections allowed` while the database is idle.** Cause: ten thousand client sockets, which almost always means driver pools that are never drained — every instance holding `max` idle clients against PgBouncer with nothing running. Fix: shrink `max`, set a short `idleTimeoutMillis` for the instances that are awake, and reconsider whether a driver pool earns its keep on this runtime at all.

**★ Symptom: adding a second database role to "get more pool" made things worse.** Cause: a second role gets a second `default_pool_size`-sized pool, and both draw from the same `max_connections`. You raised the ceiling on concurrent *attempts* without raising the ceiling on *backends*. Fix: only split roles when you also split the workload, and redo the arithmetic against `max_connections` rather than against `default_pool_size`.

**★ Symptom: raising the compute size doubled the bill and did not raise concurrency.** Cause: the bottleneck was `default_pool_size` and the assumption was `max_connections`. They have different symptoms — one waits two minutes then fails, the other fails immediately. Fix: read the error string first. Neon: *"Increasing your compute to raise `max_connections` may not help if `default_pool_size` is the bottleneck."*

**★ Symptom: `ENOTFOUND` on a hostname that looks right.** Cause: `-pooler` appended after the region or to the whole domain rather than to the endpoint id. Fix: `ep-<id>-pooler.<region>.aws.neon.tech`, and the boot assertion turns this into a startup error rather than a runtime one.

**★ Symptom: the seed script hangs in CI with every log line saying it succeeded.** Cause: the pool was never ended, so open sockets keep the event loop alive and the process does not exit. Fix: `max: 1` and `await pool.end()` in a `finally`, exactly as the migration runner in [02c](02c-the-migration-is-a-release-step.md) does.

**★ Symptom: the API is fine and a nightly export takes the database down.** Cause: a long analytics query on the pooled endpoint pins a backend out of `default_pool_size` for its whole duration, so it competes directly with request traffic. Fix: direct connection for analytics, which is what Neon's own guidance says and why the consumer table above has a row for it.

**★ Symptom: connection count does not fall after a spike ends.** Cause: paused instances hold their sockets and the platform reclaims them on its own schedule, not on yours. Fix: nothing inside the instance can help — this is precisely the case escape 1 exists for, because an idle client on a transaction pooler costs a socket rather than a backend.

**★ Symptom: the HTTP driver was adopted and topic 09's transaction retry stopped working.** Cause: the HTTP transport supports one-shot queries and non-interactive transactions; an interactive transaction needs a session it does not have. Fix: keep both transports, choose per *workload* in the DAL, and never per call site — otherwise "which transport does this query use" becomes a question you answer by reading every file.

## Interview questions

**★ What is the one number to compute before deploying, and why do so few people compute it?**
Concurrent instances multiplied by pool `max`. Almost nobody computes it because neither term is visible where the decision is made: `max` is a `pg` default nobody typed, and instance count does not appear in any file — it is a property of traffic. So the code review that would catch it has nothing to look at. The number also behaves badly, because a slow database lengthens requests, which raises concurrency, which creates instances, which each open `max` connections; the symptom feeds the cause, which is why exhaustion arrives as a cliff rather than a slope and why the first time you compute the number should not be during the incident.

**★ Name the three escapes and say which term of the product each attacks.**
A transaction-mode proxy pool leaves the product alone and changes what the units cost: your instances still open that many *client* connections, but a client connection to PgBouncer is a socket rather than a Postgres backend, and backends are handed out per transaction. The HTTP driver removes the product entirely for the queries that use it, because there is no persistent connection to count. Fewer, longer-lived processes attacks the left-hand term directly, by making instance count a configuration rather than a consequence. The first is nearly free and costs you session continuity; the second is free and costs you interactive transactions; the third costs you operational simplicity, which is usually the reason you were on serverless in the first place.

**★ Neon advertises 10,000 connections on a compute whose `max_connections` is a few hundred. How?**
By counting a different thing, and the distinction is the entire point of a proxy pool. Ten thousand is `max_client_conn` — sockets PgBouncer will accept. The few hundred is backend processes Postgres will host. The mapping is many-to-few because in transaction mode a client holds a server connection only from `BEGIN` to `COMMIT`; the rest of the time it holds nothing but a socket. So ten thousand *mostly idle* clients is fine and ten thousand *simultaneously querying* clients is not, which Neon says outright: the limit *"does not mean 10,000 simultaneous query results"*. Serverless demand is overwhelmingly the first shape, which is why the trade works — and why it stops working the moment your transactions get long.

**★ Your queries hang for two minutes and then fail. What is the diagnosis, and what is definitely not?**
Two minutes is `query_wait_timeout=120`, so clients are queueing for a server connection and `default_pool_size` is saturated. The diagnosis is transaction *duration*: a few hundred transactions that each take a second is fine, the same number taking a minute is not. It is not `max_connections` exhaustion, which fails immediately with `too many connections` rather than after a wait, and it is not `max_client_conn`, which also fails immediately. So the fix is to find what holds transactions open — almost always an external HTTP call or some other non-database `await` inside the transaction body — rather than to raise a limit. Raising the limit here makes it worse, because more clients then contend for the same backends.

**★ Why does the migration runner get a different connection string from the application, and what happens if it does not?**
Because they need opposite guarantees. The application wants a transaction pooler, whose capacity argument is precisely that it will not promise you the same backend twice; the migration runner needs that promise, because it reads a ledger, takes a lock, runs DDL and writes the ledger, and those have to be one session. If the runner gets the pooled string the failure is not reliably a clean error — it can be a partially applied migration with a ledger row claiming success, which is the worst possible schema state because the next run skips it. That is why the check is a boot-time assertion on the hostname rather than a comment: the two strings differ by seven characters in the middle of a long secret nobody reads.

**★ Is running both a driver pool and a proxy pool wrong?**
No, and on a warm runtime it is correct, because they solve different problems: the driver pool amortises the TLS handshake within one instance, the proxy pool stops total backend count from tracking instance count. Neon lists "double pooling" as a pitfall for a specific mechanical reason rather than as a general prohibition — an idle driver client still occupies a `max_client_conn` slot, and a driver client sitting inside an open transaction pins a scarce server connection out of `default_pool_size`. Both of those are arguments for a small `max` and a short `idleTimeoutMillis`, not for removing the driver pool. Where the driver pool genuinely should go is a runtime that starts cold for most requests, because then there is nothing to amortise and the pool is pure holding cost.

**★ When would you argue for abandoning serverless functions for this API entirely?**
When the workload is dominated by interactive transactions, because that is the one shape neither of the other two escapes helps with: a transaction pooler gives you capacity by refusing to hold a session, and the HTTP driver removes the session altogether, so an API where most requests need read-branch-write inside one transaction is fighting both. At that point the connection cost is irreducible per in-flight request, and the only remaining lever is to make the number of processes something you choose. The trade is real — you take on health checks, rolling deploys and capacity planning — and the reason to make it explicitly is that the alternative is running an architecture whose single failure mode is the one you cannot configure away.

---

← [03 · The connection you get](03-the-connection-you-actually-get.md) · [Chapter 16 overview](01-explanation.md) · Next → [03c · The dev hot-reload leak](03c-the-dev-hot-reload-leak.md)
