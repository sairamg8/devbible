---
title: "\"Connection pooling\" names three different machines that live in three different places, and picking the wrong one — or two of them at once — is the most common serverless database misconfiguration there is"
sidebar_label: "01b · Three kinds of pool"
sidebar_position: 101
description: "Driver-level pool, proxy pool and HTTP/WebSocket driver: what each multiplexes, which of Neon's three limits each one protects, why double pooling hurts, and how to read the error string to know which wall you hit."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Neon · Connection pooling](https://neon.com/docs/connect/connection-pooling), [Neon · Choosing your connection method](https://neon.com/docs/connect/choose-connection), [`node-postgres` · `pg.Pool`](https://node-postgres.com/apis/pool) and [Prisma 7 · Database connections](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections).
> Documentation-verified; **no sandbox run**. Neon's published `max_connections` table quoted verbatim.
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `pg` **8.23.0** · `@neondatabase/serverless` **1.1.0**.

**When someone says "we use connection pooling", they have told you almost nothing, because the phrase covers three unrelated mechanisms sitting at three different layers. A driver pool lives inside your process and multiplexes *your requests* onto *your connections*. A proxy pool lives beside the database and multiplexes *everyone's connections* onto *backend processes*. An HTTP driver abolishes the persistent connection so there is nothing left to pool. They compose in one specific way and conflict in another, and the whole "should I use `-pooler`?" argument is really a question about which of three limits you are about to hit.**

## The three layers, in the order a query passes through them

```text
your Server Component / Route Handler / Server Action
        │
        │  (1) DRIVER POOL — in your Node process. `new Pool({ max: 10 })`
        │      multiplexes concurrent requests onto N TCP sessions.
        │      Limit it protects: your own instance's socket count and handshake cost.
        ▼
   ── network ──
        │
        │  (2) PROXY POOL — PgBouncer, beside the database.
        │      Neon: the `-pooler` hostname. Multiplexes many client
        │      connections onto few backend processes.
        │      Limit it protects: max_connections.
        ▼
   PostgreSQL backend processes
```

The third mechanism does not appear in that diagram because it replaces layer 1 entirely:

```text
   your code
        │  (3) HTTP DRIVER — `neon()` from @neondatabase/serverless.
        │      One HTTPS request carries one SQL statement (or one
        │      non-interactive transaction). No session, nothing to pool.
        ▼
   Neon's proxy  ──►  PostgreSQL
```

## 1 · The driver pool — what it is actually for

A `pg` `Pool` is an in-process array of connected `Client` objects plus a FIFO waiting queue. Its job is **request multiplexing within one process**, and the resource it saves is the handshake.

Its full option surface is worth knowing because half of it exists for failure modes people meet in serverless and then misdiagnose:

| Option | Default | What it is really for |
|---|---|---|
| `max` | `10` | Ceiling on this instance's connections. The right-hand term of the exhaustion arithmetic in [01](01-database-integrations-serverless-postgres-neon-prisma-drizzl.md). |
| `min` | `0` | Floor kept alive against `idleTimeoutMillis`. Note the caveat: *"currently the pool will not automatically create and connect new clients up to the min, it will only not evict and close clients except those which exceed the min count."* |
| `idleTimeoutMillis` | `10000` | *"Number of milliseconds a client must sit idle in the pool and not be checked out before it is disconnected"* — set `0` to disable. |
| `connectionTimeoutMillis` | `0` | `0` means wait forever. Always set it. |
| `maxUses` | `Infinity` | Recycle a client after N checkouts. Useful behind a proxy that rebalances. |
| `maxLifetimeSeconds` | `0` (disabled) | *"A value of 60 would evict connections that have been around for over 60 seconds, regardless of whether they are idle."* The lever for rolling a pool through a failing-over backend. |
| `allowExitOnIdle` | `false` | Lets Node's event loop exit with idle clients still socket-open. Scripts, seeds, tests. |
| `onConnect(client)` | — | *"Called once when a new client is created, before it is made available to the pool."* 🔴 See the gotcha below: this is where `SET search_path` goes, and it is exactly the thing that breaks behind a transaction-mode proxy. |
| `pipeline` | `false` | Send queries without waiting for prior responses. |

**A driver pool cannot protect the database.** It bounds one process. Ten thousand processes each obeying `max: 10` is a hundred thousand connections and a dead database. That is not a flaw in the pool; it is a category error about what it was ever for.

## 2 · The proxy pool — the only thing that protects `max_connections`

PgBouncer sits in front of Postgres and holds two distinct sets of connections: *client* connections (your app to PgBouncer, cheap — a socket in a single-process event loop) and *server* connections (PgBouncer to Postgres, expensive — a backend process). It hands a server connection to a client only for as long as the client needs it.

Neon runs exactly this, with a fixed, non-negotiable configuration:

> ```ini
> [pgbouncer]
> pool_mode=transaction
> max_client_conn=10000
> default_pool_size=0.9 * max_connections
> max_prepared_statements=1000
> query_wait_timeout=120
> ```
> *"These settings are not user-configurable."*
> — [Neon · Connection pooling](https://neon.com/docs/connect/connection-pooling)

You opt in by changing the hostname, not the code:

```bash
# .env.local — direct: straight to Postgres, one backend process per connection.
DATABASE_URL_DIRECT="postgresql://user:pw@ep-cool-darkness-123456.us-east-2.aws.neon.tech/sprintdesk?sslmode=require"

# pooled: through PgBouncer. Note the `-pooler` infix on the endpoint id.
DATABASE_URL="postgresql://user:pw@ep-cool-darkness-123456-pooler.us-east-2.aws.neon.tech/sprintdesk?sslmode=require"
```

🔴 **The `-pooler` suffix goes on the endpoint id, not the region and not the domain.** `ep-cool-darkness-123456-pooler.us-east-2.aws.neon.tech` is right; anything else resolves to a different host or to nothing, and the resulting `ENOTFOUND` reads like a network problem rather than a typo.

### The per-user, per-database pool — the detail everyone misses

> *"PgBouncer creates separate pools for each combination of database user and database name."*

> *"`default_pool_size = 0.9 × max_connections`"*

So on a 1 CU Neon compute (`max_connections = 419`), `default_pool_size` is 377 — **per role, per database**. Two roles against the same database get 377 each, and *"All of these pools share the underlying `max_connections` limit."* This cuts both ways:

- It is a **capacity lever**. Neon lists it as a fix: *"Use multiple database users to get additional pools."* If one role is saturated, splitting read traffic onto a second role gives you a second queue.
- It is a **trap**. Adding a second role does not add backend processes; it adds a second queue competing for the same 419. You can convert "requests wait" into "requests fail", which is worse.

### The three limits, and the string each one prints

This table is the fastest debugging tool in the topic. Neon publishes it; I am quoting the cells verbatim.

| Limit | Value | What it controls | When you hit it |
|---|---|---|---|
| `max_client_conn` | 10,000 | Maximum client connections to PgBouncer | Client gets: `no more connections allowed` |
| `default_pool_size` | 90% of `max_connections` | Maximum active connections per user per database | Client waits in queue (2 min timeout) |
| `max_connections` | Varies by compute | Direct connections to Postgres | Client gets: `too many connections` |

Read it as a decision procedure:

- **`FATAL: remaining connection slots are reserved`** or `too many connections` → you are on the **direct** connection string. You did not go through the pooler at all. Change the hostname.
- **`query_wait_timeout`** after roughly two minutes → you are on the pooler and you exhausted `default_pool_size`. Your transactions are too long, not too many. Neon's own remedies, verbatim: *"Ensure transactions complete quickly · Use a larger compute size (increases pool size) · Use multiple database users to get additional pools."*
- **`no more connections allowed (max_client_conn)`** → ten thousand sockets. This is a leak or a genuinely enormous instance count, not a tuning problem.

⚠️ **The 10,000 is not throughput.** Neon says so in bold: *"The 10,000 connection limit does not mean 10,000 simultaneous query results."* On a 1 CU compute the numbers are 10,000 clients, ~377 concurrently active transactions, 419 backends. The pooler buys you *idle* capacity, which is exactly the shape of serverless demand, and buys you nothing on the active side.

## 3 · The HTTP driver — deleting the problem instead of managing it

`@neondatabase/serverless`'s `neon()` function sends a statement over `fetch`. There is no session, so there is nothing to keep warm, nothing to leak and nothing to pool.

> *"**HTTP** uses `fetch` requests. It is faster for single queries (~3 round trips vs. ~8 for TCP) and supports non-interactive transactions."*
> — [Neon · Choosing your connection method](https://neon.com/docs/connect/choose-connection)

The cost is that you give up the session: no interactive transaction, no `SET`, no `LISTEN`. That is the whole trade and it is covered in detail in [01d](01e-the-http-driver-and-one-shot-queries.md).

## Composing them: what stacks and what does not

**Driver pool + proxy pool is the normal, correct production stack** — with one condition, which Neon states as a pitfall rather than a rule:

> *"If you use a pooled Neon connection, avoid adding client-side pooling on top. Let Neon handle it. If you must use client-side pooling, release connections back to the pool promptly to avoid conflicts with PgBouncer."*
> — [Neon · Choosing your connection method](https://neon.com/docs/connect/choose-connection)

The reason "double pooling" is listed as a pitfall is not that two pools are forbidden; it is that a driver pool **holds** a PgBouncer client connection while idle, and a transaction-mode PgBouncer can only reuse a *server* connection between transactions. An idle client connection that never sends a transaction still occupies a slot against `max_client_conn`, and — worse — a client that opens a transaction and then sits there pins a server connection out of `default_pool_size` for the duration. So:

- **Warm/fluid compute, `pg`, pooled endpoint:** keep a modest driver pool. Reuse is real, and the guidance in [01](01-database-integrations-serverless-postgres-neon-prisma-drizzl.md) applies.
- **Cold, per-request runtime:** a driver pool is worse than useless. Either take the HTTP driver, or create and `end()` the pool inside the handler.
- **Never**: a long-lived driver pool with a large `max` against a pooled endpoint from hundreds of instances. That is the configuration that produces `max_client_conn` exhaustion while the database itself sits idle.

## Which string goes where

This is a two-URL world and the split is not optional. Neon lists the direct-only operations verbatim:

> *"Schema migrations (Prisma Migrate, Drizzle Kit, django-admin migrate) · `CREATE INDEX CONCURRENTLY` · `LISTEN` / `NOTIFY` · Temporary tables or prepared statements across multiple queries"*

and its pooled/direct table adds `pg_dump` / `pg_restore` (*"Uses `SET` statements"*), logical replication (*"Requires persistent connection"*), long-running analytics (*"Avoid pool contention"*) and admin tasks.

```ts
// lib/db/urls.ts
import 'server-only'

/** Runtime traffic. Always the pooled endpoint. */
export const POOLED_URL = required('DATABASE_URL')

/** Migrations, index builds, dumps, LISTEN/NOTIFY. Never used by request paths. */
export const DIRECT_URL = required('DATABASE_URL_DIRECT')

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

// A cheap guard worth having in CI: the two must not be the same string,
// and the runtime one must be the pooled host.
if (POOLED_URL === DIRECT_URL) {
  throw new Error('DATABASE_URL and DATABASE_URL_DIRECT are identical — one of them is wrong')
}
if (!new URL(POOLED_URL).hostname.includes('-pooler.')) {
  throw new Error('DATABASE_URL is not a pooled endpoint')
}
```

That last check has caught more incidents than it has any right to, because the two strings differ by seven characters in the middle of a 120-character secret and nobody reviews secrets.

## Gotchas

**★ Symptom: `FATAL: remaining connection slots are reserved` even though you "turned pooling on" in the Neon console.** Cause: the console toggle changes which string it *shows you*; it does not change what your app connects to. Neon: *"It doesn't start or stop the pooler at the compute. The pooled endpoint is always available. The toggle just switches the displayed connection string."* Your deployment still holds the direct host. Fix: assert on the hostname at boot, as in the snippet above — do not trust that the right value was pasted.

**★ Symptom: queries hang for exactly ~120 seconds and then fail with `query_wait_timeout`.** Cause: `default_pool_size` is exhausted and PgBouncer's `query_wait_timeout=120` fired. This is **transaction duration**, not connection count — 377 slow transactions hold 377 server connections. Fix: shorten transactions and never hold one open across an `await` on anything that is not the database.

```ts
// Holds a server connection out of default_pool_size for the whole HTTP call.
await db.transaction(async (tx) => {
  const card = await tx.insert(cards).values(input).returning()
  await fetch('https://hooks.slack.com/...', { method: 'POST' }) // 🔴 network inside the tx
  return card
})

// Correct: commit, then do the slow thing.
const card = await db.transaction(async (tx) => tx.insert(cards).values(input).returning())
await fetch('https://hooks.slack.com/...', { method: 'POST' })
```

**★ Symptom: `no more connections allowed (max_client_conn)` while the database CPU is flat.** Cause: ten thousand *client* sockets, which almost always means driver pools that are never drained — every instance holding `max` idle clients against PgBouncer. The database is idle because nobody is running a query; they are all just holding sockets. Fix: shrink or remove the driver pool on cold runtimes, and set `idleTimeoutMillis` so idle clients disconnect rather than squatting.

```ts
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 5_000, // let idle clients drop off PgBouncer quickly
  maxLifetimeSeconds: 300,  // and rotate the rest so a rebalanced pooler is not pinned
})
```

**★ Symptom: `SET search_path` set in `onConnect` silently stops applying after the first query.** Cause: `onConnect` runs once per *driver* client, but behind a transaction-mode pooler the driver's client is not bound to a backend — Neon's list of unsupported features starts with `SET` / `RESET`. Your `SET` applied to whatever backend happened to serve that transaction and was gone the moment it committed. Fix: qualify schemas explicitly, or set it on the role so it survives.

```sql
-- Persists across transactions and pooled connections alike.
ALTER ROLE sprintdesk_app SET search_path TO app, public;
```

**★ Symptom: adding a second database role to "get more pool" made things worse.** Cause: a second role gets a second `default_pool_size`-sized pool, but both pools draw from the same `max_connections`. You raised the ceiling on *concurrent attempts* without raising the ceiling on *backends*, converting queuing (recoverable) into `too many connections` (not). Fix: only split roles when you also intend to split the workload — for example a read-only role pinned to a replica — and re-do the arithmetic against `max_connections`, not against `default_pool_size`.

**★ Symptom: migrations fail against the pooled endpoint with errors about prepared statements or `SET`.** Cause: migration tooling assumes a session. Neon lists schema migrations as direct-only; Prisma documents that its Schema Engine *"is designed to use a **single connection to the database**, and does not support connection pooling with PgBouncer."* Fix: give the CLI the direct URL and leave the app on the pooled one — the two-URL wiring is in [01ga](01ga-where-the-prisma-instance-lives.md) and the per-tool migration mechanics are [01i · Migrations in each](01i-migrations-in-each.md).

**★ Symptom: `ENOTFOUND` on a hostname that looks right.** Cause: `-pooler` was appended to the wrong label — after the region, or to the whole domain. Fix: it goes on the endpoint id only: `ep-<id>-pooler.<region>.aws.neon.tech`. The boot-time hostname assertion above turns this into a startup error instead of a runtime one.

**★ Symptom: raising the compute size doubled the bill and did not raise concurrency.** Cause: you were queueing on `default_pool_size` and assumed you were failing on `max_connections`. They have different symptoms — one waits then fails at 120 s, the other fails immediately. Fix: read the error string first. Neon: *"Increasing your compute to raise `max_connections` may not help if `default_pool_size` is the bottleneck."*

**★ Symptom: `pg_dump` produces an empty or broken dump against the pooled host.** Cause: *"This issue also affects tools like `pg_dump`, which relies on `SET` statements. Always use direct connections for `pg_dump`."* Fix: direct URL, and treat any tool that emits `SET` as direct-only by default.

## Interview questions

**★ Someone says "we use connection pooling". What three follow-up questions do you ask?**
Which layer — driver, proxy, or neither because you are on HTTP? What pool mode is the proxy in, since transaction mode silently removes session features? And what is the pool size *per role per database*, because on PgBouncer that is the real concurrency ceiling and it is not the number in your `Pool({ max })`. The answers tell you which of three limits they are going to hit and therefore which error string they will see at 3 a.m. Without them, "we use pooling" is compatible with both a correct setup and the exact misconfiguration that will take them down.

**★ Can you run a driver pool and a proxy pool at the same time?**
Yes, and on a warm runtime you should — they solve different problems. The driver pool amortises the TLS handshake and lets one instance run several queries concurrently; the proxy pool stops the total backend count from tracking your instance count. The condition is that the driver pool must return clients promptly, because an idle client still occupies a `max_client_conn` slot and a client sitting inside an open transaction pins a scarce server connection out of `default_pool_size`. Neon lists "double pooling" as a pitfall for precisely that reason, not because two pools are inherently wrong. On a runtime that dies each request the driver pool has nothing to amortise and should go.

**★ Neon advertises 10,000 connections on a compute whose `max_connections` is 419. Are they lying?**
No, they are counting a different thing, and the distinction is the whole point of a proxy pool. Ten thousand is `max_client_conn` — sockets PgBouncer will accept. 419 is backend processes Postgres will host. The mapping between them is many-to-few because in transaction mode a client only holds a server connection for the duration of a transaction; the rest of the time it holds nothing but a socket. So 10,000 *mostly idle* clients is fine and 10,000 *simultaneously querying* clients is not, which Neon says outright: the limit *"does not mean 10,000 simultaneous query results"*. Serverless demand is overwhelmingly the first shape, which is why the trade works.

**★ Why is `default_pool_size` per user and per database, and when does that bite?**
PgBouncer cannot hand a server connection authenticated as one role to a client authenticated as another, and it cannot hand a connection to `db_a` to a client wanting `db_b` — so a pool is keyed on the pair. It bites in two directions. It is a lever, because a second role gives you a second queue when one workload is starving another. And it is a trap, because those pools are not additive at the Postgres end: they share `max_connections`, so adding roles can push you from queueing into hard connection failures. It also means a multi-tenant design that gives each tenant its own role or database multiplies pools by tenants, which is one of the reasons database-per-tenant is painful on serverless — see [10 · Multi-tenant applications](10-multi-tenant-applications.md).

**★ Your queries hang for two minutes and then fail. What is the diagnosis, and what is not?**
Two minutes is PgBouncer's `query_wait_timeout=120` and it means clients are queueing for a server connection — `default_pool_size` is saturated. The diagnosis is *transaction duration*: 377 transactions that each take a second is fine, 377 that each take a minute is not. What it is *not* is `max_connections` exhaustion, which fails immediately with `too many connections` rather than after a wait, and it is not `max_client_conn`, which also fails immediately. So the fix is to find what holds transactions open — most often an external HTTP call or a user-facing `await` inside the transaction body — not to raise a limit.

**★ Which operations must not go through the pooled endpoint, and what do they have in common?**
Schema migrations, `CREATE INDEX CONCURRENTLY`, `LISTEN`/`NOTIFY`, `pg_dump`/`pg_restore`, logical replication, anything using temporary tables or SQL-level `PREPARE`, and long analytics queries. What they share is that they need *session* state or a *stable* backend across statements — and transaction-mode pooling exists precisely by refusing to guarantee that. `CREATE INDEX CONCURRENTLY` is the sharpest case because it is not even permitted inside a transaction block, so it cannot be expressed in the unit the pooler multiplexes. The practical consequence is the two-URL setup: pooled for request paths, direct for the CLI and for operations.

**★ If a proxy pool is strictly better for capacity, why not always use the HTTP driver instead and skip both?**
Because the HTTP driver removes the session, and with it interactive transactions — you cannot read a row, branch in JavaScript, and then write conditionally inside the same transaction. Neon's HTTP path supports one-shot queries and non-interactive transactions where the whole statement list is known up front. Plenty of application code fits that, and where it does the HTTP driver is the cleanest answer because there is no lifecycle to get wrong. Where it does not fit, you need a session, and then the question is only whether that session terminates at PgBouncer or at Postgres.

---

← [01 · Why serverless breaks pooling](01-database-integrations-serverless-postgres-neon-prisma-drizzl.md) · Next → [01c · Transaction pooling and prepared statements](01c-transaction-pooling-and-session-state.md)
