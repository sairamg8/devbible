---
name: research-nextjs-ch15-databases-and-api-design
description: Banked primary-source research for devbible Next.js chapter 15 topics 01 (database integrations - Neon, Prisma, Drizzle, pooling) and 02 (hybrid API design - Route Handlers vs Server Actions). Verbatim quotes with URLs. DO NOT RE-DERIVE.
metadata:
  type: research
  track: nextjs
  chapter: 15
  date: 2026-09-05
---

# Research bank — Next.js ch15, topics 01 + 02

🔴 **Do not re-derive.** Every load-bearing sentence below was fetched from the primary
source on **2026-09-05** and is quoted verbatim. Write chunks from this file.

## Version spine (given by coordinator, re-confirmed where noted)

Next.js **16.3.4** (confirmed: every fetched `nextjs.org/docs/*.md` carries
`version: 16.3.4` in its frontmatter) · React **19.2.8** · Node **24.20.0** ·
PostgreSQL **18.4** · Prisma **7.10.0**.

### npm dist-tags read from `registry.npmjs.org` on 2026-09-05

| Package | `latest` | Notes |
|---|---|---|
| `@prisma/client` | **7.10.0** | matches spine |
| `@prisma/adapter-pg` | **7.10.0** | |
| `@prisma/adapter-neon` | **7.10.0** | |
| `prisma` (CLI) | `8.0.0-rc.13` | 🔴 **`latest` points at a release candidate**; `prev` = `7.10.0`. `8.0.0` stable has no entry in `time`. Report to coordinator. |
| `drizzle-orm` | **0.45.2** | `rc` = `1.0.0-rc.4`; the docs site documents the RC line (`drizzle-orm@rc`) |
| `drizzle-kit` | **0.31.10** | `rc` = `1.0.0-rc.4` |
| `@neondatabase/serverless` | **1.1.0** | |
| `pg` | **8.23.0** | matches the corpus pin recorded in `.agents/references/verification.md` |

T1 probe (published typings, not a local install), `drizzle-orm@0.45.2`,
`https://unpkg.com/drizzle-orm@0.45.2/neon-http/driver.d.ts`:

```ts
export declare function drizzle<...>(...params: [
    TClient | string
] | [
    TClient | string, DrizzleConfig<TSchema>
] | [
    (DrizzleConfig<TSchema> & ({ connection: string | ({ connectionString: string } & HTTPTransactionOptions<boolean, boolean>) } | { client: TClient }))
]): NeonHttpDatabase<TSchema> & { $client: TClient };
```

→ the three call forms shown in the current (1.0-rc) Drizzle docs are also present in the
0.45.2 stable typings. Safe to teach either.

---

## A · Neon — connection pooling
Source: <https://neon.com/docs/connect/connection-pooling> (append `.md` for markdown)

> *"Neon uses [PgBouncer](https://www.pgbouncer.org/) to provide connection pooling, enabling up to 10,000 concurrent connections."*

> *"Each Postgres connection creates a new process in the operating system, consuming memory and CPU resources. Postgres limits the number of connections based on available RAM. In Neon, this limit is defined by `max_connections`, which varies by compute size"*

`max_connections` by compute size (verbatim table rows): 0.25 CU / 1 GB → **104**;
0.5 CU / 2 GB → 209; 1 CU / 4 GB → **419**; 2 CU → 839; 4 CU → 1678; 8 CU → 3357;
9–56 CU → capped at **4000**.

> *"Seven connections are reserved for the Neon superuser account. For a 0.25 CU compute, this means 97 connections are available for your application (104 total - 7 reserved)."*

> *"PgBouncer creates separate pools for each combination of database user and database name."*

> *"default_pool_size = 0.9 × max_connections"*

> *"The 10,000 connection limit does not mean 10,000 simultaneous query results."*

Three limits table, verbatim cells:
| `max_client_conn` | 10,000 | Maximum client connections to PgBouncer | Client gets: "no more connections allowed" |
| `default_pool_size` | 90% of `max_connections` | Maximum active connections per user per database | Client waits in queue (2 min timeout) |
| `max_connections` | Varies by compute | Direct connections to Postgres | Client gets: "too many connections" |

Neon's fixed PgBouncer config (verbatim):
```ini
[pgbouncer]
pool_mode=transaction
max_client_conn=10000
default_pool_size=0.9 * max_connections
max_prepared_statements=1000
query_wait_timeout=120
```
> *"These settings are not user-configurable."*

> *"Neon uses PgBouncer in transaction mode (`pool_mode=transaction`), which means connections are returned to the pool after each transaction completes."*

Not supported on a pooled (transaction-mode) connection — verbatim list:
`SET` / `RESET` (session variables) · `LISTEN` / `NOTIFY` · `WITH HOLD CURSOR` ·
`PREPARE` / `DEALLOCATE` (SQL-level prepared statements) ·
Temporary tables with `PRESERVE` / `DELETE ROWS` · `LOAD` statement ·
Session-level advisory locks.

> *"PgBouncer supports protocol-level prepared statements (as of PgBouncer 1.22.0), which can improve query performance and security."*

> *"SQL-level `PREPARE` and `EXECUTE` statements are not supported with PgBouncer. You must use protocol-level prepared statements through your database driver."*

Pooled hostname form (verbatim): `ep-cool-darkness-123456-pooler.us-east-2.aws.neon.tech`
vs direct `ep-cool-darkness-123456.us-east-2.aws.neon.tech`.

Error strings quoted by the doc: `query_wait_timeout` ·
`no more connections allowed (max_client_conn)` ·
`FATAL: remaining connection slots are reserved`.

Direct-connection use cases (verbatim rows): Schema migrations · Long-running analytics
queries · `pg_dump` / `pg_restore` · Logical replication · Admin tasks.

## B · Neon — choosing a connection method
Source: <https://neon.com/docs/connect/choose-connection>

> *"**Vercel (Fluid compute):** Use `pg` (node-postgres) with [`@vercel/functions`](https://www.npmjs.com/package/@vercel/functions). Vercel Fluid keeps functions warm long enough to reuse TCP connections, so you skip the connection setup cost on subsequent requests."*

> *"**HTTP** uses `fetch` requests. It is faster for single queries (~3 round trips vs. ~8 for TCP) and supports non-interactive transactions. Choose HTTP when your queries are independent, one-shot operations."*

> *"**WebSocket** maintains a persistent connection within a request. It supports interactive transactions and is compatible with the `node-postgres` API (`Pool`, `Client`). Choose WebSocket when you need multi-step transactions or `pg` compatibility."*

Double pooling pitfall, verbatim:
> *"If you use a pooled Neon connection, avoid adding client-side pooling on top. Let Neon handle it. If you must use client-side pooling, release connections back to the pool promptly to avoid conflicts with PgBouncer."*

> *"Increasing your compute to raise `max_connections` may not help if `default_pool_size` is the bottleneck."*

> *"In serverless environments (Vercel Edge Functions, Cloudflare Workers), WebSocket connections cannot outlive a single request. Create, use, and close `Pool` or `Client` objects **within the same request handler**. Do not create them outside a handler or reuse them across handlers."*

Direct connection required for (verbatim): *"Schema migrations (Prisma Migrate, Drizzle Kit, django-admin migrate) · `CREATE INDEX CONCURRENTLY` · `LISTEN` / `NOTIFY` · Temporary tables or prepared statements across multiple queries"*

## C · Neon serverless driver
Source: <https://neon.com/docs/serverless/serverless-driver>

> *"The [Neon serverless driver](https://github.com/neondatabase/serverless) is a low-latency Postgres driver for JavaScript and TypeScript that allows you to query data from serverless and edge environments over **HTTP** or **WebSockets** in place of TCP."*

> *"The GA version of the Neon serverless driver, v1.0.0 and higher, requires Node.js version 19 or higher."*

> *"**HTTP**: Querying over an HTTP fetch request is faster for single, non-interactive transactions, also referred to as \"one-shot queries\"."*

> *"The function returns a query function that can only be used as a template function for improved safety against SQL injection vulnerabilities."*

> *"The maximum request size and response size for queries over HTTP is 64 MB."*

`transaction()`: *"It allows multiple queries to be executed within a single, non-interactive transaction."* Options: `isolationLevel` (`ReadUncommitted` | `ReadCommitted` | `RepeatableRead` | `Serializable`), `readOnly`, `deferrable`.
> *"Note that options **cannot** be supplied for individual queries within a transaction."*

> *"In Node.js and some other environments, there's no built-in WebSocket support. In these cases, supply a WebSocket constructor function."* → `neonConfig.webSocketConstructor = ws`

> *"In serverless environments such as Vercel Edge Functions or Cloudflare Workers, WebSocket connections can't outlive a single request. That means `Pool` or `Client` objects must be connected, used and closed within a single request handler."*

Options on `neon(...)`: `arrayMode` (default `false`), `fullResults` (default `false`),
`fetchOptions` (merged into the `fetch` call — supports `signal` for timeouts).

RLS/JWT note, verbatim:
> *"When using JWT self-verification with RLS, ensure your database connection string uses a role that does **not** have the `BYPASSRLS` attribute. Avoid using the `neondb_owner` role in your connection string, as it bypasses Row-Level Security policies."*

## D · Prisma 7 — database connections
Source: <https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections>

> *"In a serverless environment, each function creates **its own instance** of `PrismaClient`, and each client instance has its own connection pool."*

> *"Many *concurrent functions* responding to a traffic spike 📈 can exhaust the database connection limit very quickly. Furthermore, any functions that are **paused** keep their connections open by default and block them from being used by another function."*

> *"Frameworks like [Next.js](https://nextjs.org/) support hot reloading of changed files, which enables you to see changes to your application without restarting. However, if the framework refreshes the module responsible for exporting `PrismaClient`, this can result in **additional, unwanted instances of `PrismaClient` in a development environment**."*

The documented workaround, verbatim:
```ts
import { PrismaClient } from "../prisma/generated/client";
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

> *"You do not need to explicitly `$disconnect()` in the context of a long-running application that is continuously serving requests."*

> *"There is no guarantee that subsequent nearby invocations of a function will hit the same container"*

> *"Containers that are marked \"to be removed\" and are not being reused still **keep a connection open**"* (zombie connections)

> *"Due to the way AWS RDS Proxy pins connections, [it does not provide any connection pooling benefits](…) when used together with Prisma Client."*

Two-URL pattern (verbatim `.env` comments):
`DATABASE_URL` = *"Connection URL to your database using PgBouncer."*;
`DIRECT_URL` = *"Direct connection URL to the database used for Prisma CLI commands."*
Wired through `prisma.config.ts` → `datasource: { url: env("DIRECT_URL") }` and
*"Prisma CLI commands always read from this configuration."*

## E · Prisma 7 — connection pool
Source: <https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool>

> *"Starting with Prisma ORM v7, relational datasources instantiate Prisma Client with [driver adapters](…) by default. Driver adapters rely on the Node.js driver you supply, so connection pooling defaults (and configuration) now come from the driver itself."*

> *"Pool size, acquire timeout, and other pool behavior are **configured per driver adapter**. There are no connection URL parameters for these in Prisma ORM v7."*

`pg` driver-adapter defaults, verbatim table (v6 URL param → v7 field → v7 default):
| Pool size | `connection_limit` → `max` | **10** |
| Acquire timeout | `pool_timeout` → `connectionTimeoutMillis` | **0** (no timeout) |
| Connection timeout | `connect_timeout` → `connectionTimeoutMillis` | **0** (no timeout) |
| Idle timeout | `max_idle_connection_lifetime` → `idleTimeoutMillis` | **10s** |
| Connection lifetime | `max_connection_lifetime` → `maxLifetimeSeconds` | **0** (no timeout) |

(v6 defaults for comparison: pool size `num_cpus::get_physical() * 2 + 1`,
`pool_timeout` 10s, `connect_timeout` 5s, `max_idle_connection_lifetime` 300s.)

> *"The pool is created when Prisma Client opens the *first* connection to the database"* — by `$connect()` or by the first query.

> *"When using Prisma Client with a driver adapter, database connections are managed by the driver and its pool. They are not exposed to the developer and it is not possible to manually access individual connections."*

## F · Prisma + PgBouncer
Source: <https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/pgbouncer>

> *"One common feature that external connection poolers do not support are named prepared statements, which Prisma ORM uses."*

> *"For Prisma Client to work reliably, PgBouncer must run in **Transaction mode**."*

> *"We recommend **not** setting `pgbouncer=true` in the database connection string if you're using PgBouncer `1.21.0` or later."*

> *"Prisma Migrate uses **database transactions** to check out the current state of the database and the migrations table. However, the Schema Engine is designed to use a **single connection to the database**, and does not support connection pooling with PgBouncer."*

The error the doc quotes verbatim:
```
Error: undefined: Database error
Error querying the database: db error: ERROR: prepared statement "s0" already exists
```

## G · node-postgres
Sources: <https://node-postgres.com/features/pooling>, <https://node-postgres.com/apis/pool>,
<https://node-postgres.com/guides/pool-sizing>

> *"Connecting a new client to the PostgreSQL server requires a handshake which can take 20-30 milliseconds. During this time passwords are negotiated, SSL may be established, and configuration information is shared with the client & server."*

> *"PostgreSQL can only process one query at a time on a single connected client in a first-in first-out manner."*

> *"You must **always** return the client to the pool if you successfully check it out, regardless of whether or not there was an error with the queries you ran on the client."*

> *"Do **not** use `pool.query` if you are using a transaction. The pool will dispatch every query passed to pool.query on the first available idle client."*

> *"The pool is initially created empty and will create new clients lazily as they are needed."*

`Pool` config defaults, verbatim from the API doc comments:
- `max` — *"Maximum number of clients the pool should contain. By default this is set to 10."*
- `idleTimeoutMillis` — *"Default is 10000 (10 seconds) - set to 0 to disable auto-disconnection of idle clients."*
- `connectionTimeoutMillis` — *"By default this is 0 which means no timeout."*
- `min` — default `0`; *"currently the pool will not automatically create and connect new clients up to the min"*
- `maxUses` — default `Infinity`
- `maxLifetimeSeconds` — *"A value of 60 would evict connections that have been around for over 60 seconds"*, default 0 (disabled)
- `allowExitOnIdle` — lets the node event loop exit when all clients are idle
- `onConnect(client)` — *"Called once when a new client is created, before it is made available to the pool."* Doc's own example: `await client.query('SET search_path TO my_schema')`
- `pipeline` — default `false`

> *"If the pool is 'full' and all clients are currently checked out, requests will wait in a FIFO queue until a client becomes available by being released back to the pool."*

Pool sizing guide, verbatim:
> *"If you're running on Vercel with fluid compute, your serverless functions can handle multiple requests concurrently and stick around between invocations. In this case, you can treat it similarly to a traditional long-lived process and use a default-ish pool size of 10. The pool will stay warm across requests and you'll get the benefits of connection reuse. You'll probably need to put pgBouncer (or some kind of pooler like what is offered with Supabase, RDS, GCP, etc.) in front of your database, as Vercel worker count can grow quite a bit larger than the number of reasonable max connections Postgres can handle."*

> *"Make sure at the end of your serverless handler, after everything is done, you close and dispose of the pool by calling `pool.end()`."*

> *"Setting the pool to a size larger than 1 is still recommended… With a pool size of 1 you are turning what is \"a few things at once\" into all things waiting in line one after another on the one available client in the pool."*

> *"Creating an unbounded number of pools defeats the purpose of pooling at all."*

## H · PostgreSQL 18
Sources: <https://www.postgresql.org/docs/18/runtime-config-connection.html>,
<https://www.postgresql.org/docs/18/sql-prepare.html>

> *"`max_connections` (integer) — Determines the maximum number of concurrent connections to the database server. The default is typically 100 connections, but might be less if your kernel settings will not support it (as determined during initdb). This parameter can only be set at server start."*

> *"PostgreSQL sizes certain resources based directly on the value of max_connections. Increasing its value leads to higher allocation of those resources, including shared memory."*

> *"`superuser_reserved_connections` … Whenever the number of active concurrent connections is at least max_connections minus superuser_reserved_connections, new connections will be accepted only for superusers."*

> *"Prepared statements only last for the duration of the current database session. When the session ends, the prepared statement is forgotten, so it must be recreated before being used again. This also means that a single prepared statement cannot be used by multiple simultaneous database clients; however, each client can create their own prepared statement to use."*

> *"When the PREPARE statement is executed, the specified statement is parsed, analyzed, and rewritten. When an EXECUTE command is subsequently issued, the prepared statement is planned and executed."*

## I · Drizzle
Sources: <https://orm.drizzle.team/llms-full.txt>, sections
`Drizzle <> Neon Postgres` (`/docs/pg/connect-neon`), `Query performance`,
`Drizzle migrations fundamentals`.
⚠️ The Drizzle site does **not** serve `.md`; `llms.txt` / `llms-full.txt` do work.
⚠️ The published docs currently describe the **1.0 release-candidate** line
(`drizzle-orm@rc`), while npm `latest` is `0.45.2`.

> *"Drizzle has native support for Neon connections with the `neon-http` and `neon-websockets` drivers. These use the **neon-serverless** driver under the hood."*

> *"Querying over HTTP is faster for single, non-interactive transactions."*

> *"If you need session or interactive transaction support, or a fully compatible drop-in replacement for the `pg` driver, you can use the WebSocket-based `neon-serverless` driver."*

> *"Additional configuration is required to use WebSockets in environments where the `WebSocket` global is not defined, such as Node.js. Add the `ws` and `bufferutil` packages to your project's dependencies, and set `ws` in the Drizzle config."*

> *"Drizzle ORM is dialect-specific, slim, performant and serverless-ready **by design**."* · *"Drizzle has exactly 0 dependencies!"* · *"~7.4kb minified+gzipped"*

Prepared statements:
> *"When it comes to Drizzle — we're a thin TypeScript layer on top of SQL with almost 0 overhead and to make it actual 0, you can utilise our prepared statements API."*

> *"With prepared statements you do SQL concatenation once on the Drizzle ORM side and then database driver is able to reuse precompiled binary SQL instead of parsing query all the time."*

API: `db.select().from(customers).prepare("statement_name")`, `sql.placeholder('id')`,
`await p1.execute({ id: 10 })`.

Migrations:
> *"**Database first** is when your database schema is a source of truth… **Codebase first** is when database schema in your codebase is a source of truth and is under version control."*

drizzle-kit commands: `generate`, `migrate`, `push`, `pull`, `export`.
> *"That's the best approach for rapid prototyping"* — on `drizzle-kit push`.

---

## J · Next.js — Server Actions
Source: <https://nextjs.org/docs/app/guides/server-actions> (`version: 16.3.4`)

> *"A **Server Action** is a [React Server Function](https://react.dev/reference/rsc/server-functions) invoked through React's action mechanisms, such as `<form action>`, `<button formAction>`, or a client-side transition."*

> *"Next.js dispatches Server Actions one at a time per client. If a user triggers three actions in quick succession, the second waits for the first to finish, then the third waits for the second. This keeps the re-rendered server tree consistent with the action result that produced it."*

> *"A consequence: do not rely on `Promise.all` to parallelize Server Actions from the client."*

> *"When a Server Action triggers an immediate revalidation, Next.js does the work inside one HTTP request: it runs the action, then re-renders the current route server-side. The response that comes back contains both pieces in the same Flight stream"*

A re-render ships in the same response when the action calls `updateTag` or
`revalidatePath`, calls `refresh`, mutates cookies, or calls `redirect`.

> *"`revalidateTag` with a stale-while-revalidate profile is the exception: it marks the tag for background refresh and does **not** include a re-render in the action response."*

🔴 The security paragraph, verbatim and load-bearing:
> *"A Server Action runs as a POST request against the page that invokes it. At build time, the `'use server'` directive tells the compiler to swap the function's implementation in client bundles for a reference (an action ID plus a dispatcher) that POSTs back to the server. The implementation stays on the server, but the route is reachable to anyone who can send the same POST. Treat every action as an untrusted entry point."*

Framework protections, verbatim:
> *"**CSRF check.** The request's `Origin` is compared to the `Host` (or `X-Forwarded-Host`). Mismatches are rejected."*
> *"**Body size limit.** Action requests are capped at 1MB by default."*
> *"**Encrypted action IDs and dead code elimination.** Action references are encrypted at build time, and unused Server Functions are stripped from client bundles so they have no public endpoint."*
> *"**Closure variable encryption.** Variables captured by an inline action are encrypted before being sent to the client. For multi-instance and self-hosted deployments, set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to a stable key shared across instances."*

> *"Render-time gating (only rendering a form on an authenticated page) is not a security boundary, because requests can be sent without going through the UI."*

> *"Schema validation (zod or similar) only checks the *shape* of the input. A well-formed `Item` object can still refer to a row the caller does not own."*

Cache-update menu, verbatim:
- `updateTag` — *"immediate expiration of a tag… Use when the action needs **read-your-own-writes**… Server Actions only."*
- `revalidateTag` — *"stale-while-revalidate refresh of a tag with a cache-life profile… the action's own re-render does **not** wait for the new data."*
- `revalidatePath` — *"invalidate by URL path."*
- `refresh` — *"refetch the current route's RSC Payload without invalidating cached data."*

Deployment:
> *"Each Server Action is identified by the action ID that is part of its build artifacts. New deployments typically generate new IDs (Next.js rotates them at most every 14 days, even when the source is unchanged), so a client still running the previous build may invoke an action ID that no longer exists. The error surfaces as \"Failed to find Server Action\"."*

Config: `experimental.serverActions.allowedOrigins`, `.bodySizeLimit`.

## K · Next.js — Route Handlers
Sources: <https://nextjs.org/docs/app/getting-started/route-handlers>,
<https://nextjs.org/docs/app/api-reference/file-conventions/route>

> *"Route Handlers allow you to create custom request handlers for a given route using the Web [Request] and [Response] APIs."*

> *"The following HTTP methods are supported: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`. If an unsupported method is called, Next.js will return a `405 Method Not Allowed` response."*

> *"If `OPTIONS` is not defined, Next.js will automatically implement `OPTIONS` and set the appropriate Response `Allow` header depending on the other methods defined in the Route Handler."*

> *"Route Handlers are not cached by default. You can, however, opt into caching for `GET` methods. Other supported HTTP methods are **not** cached."*

> *"Other supported HTTP methods are **not** cached, even if they are placed alongside a `GET` method that is cached, in the same file."*

Cache Components behaviour:
> *"When Cache Components is enabled, `GET` Route Handlers follow the same model as normal UI routes in your application. They run at request time by default, can be prerendered when they don't access uncached or runtime data, and you can use `use cache` to include uncached data in the static response."*

> *"Prerendering stops if the `GET` handler accesses network requests, database queries, async file system operations, request object properties (like `req.url`, `request.headers`, `request.cookies`, `request.body`), runtime APIs like `cookies()`, `headers()`, `connection()`, or non-deterministic operations."*

🔴 > *"`use cache` cannot be used directly inside a Route Handler body; extract it to a helper function. Cached responses revalidate according to `cacheLife` when a new request arrives."*

Route resolution:
> *"They **do not** participate in layouts or client-side navigations like `page`. There **cannot** be a `route.js` file at the same route as `page.js`."*
> *"Each `route.js` or `page.js` file takes over all HTTP verbs for that route."*

`RouteContext<'/users/[id]'>` is a global helper; *"Types are generated during `next dev`, `next build` or `next typegen`."*

Version history rows, verbatim:
| `v15.0.0-RC` | `context.params` is now a promise. |
| `v15.0.0-RC` | The default caching for `GET` handlers was changed from static to dynamic |
| `v13.2.0` | Route Handlers are introduced. |

Segment config still available in a route file: `dynamic`, `dynamicParams`, `revalidate`,
`fetchCache`, `runtime`, and `preferredRegion` — the doc's own snippet annotates
`export const preferredRegion = 'auto' // deprecated`.

## L · Next.js — backend for frontend
Source: <https://nextjs.org/docs/app/guides/backend-for-frontend>

> *"Next.js backend capabilities are not a full backend replacement. They serve as an API layer that: is publicly reachable · handles any HTTP request · can return any content type"*

> *"Route Handlers are public HTTP endpoints. Any client can access them."*

> *"You can only read the request body once. Clone the request if you need to read it again"*

> *"This example uses `POST` to avoid putting geo-location data in the URL. `GET` requests may be cached or logged, which could expose sensitive info."*

Content negotiation — a `next.config.js` rewrite with `has: [{ type: 'header', key: 'accept', value: '(.*)text/markdown(.*)' }]` routing to a `route.ts`, plus:
> *"The `Vary: Accept` response header tells caches that the response body depends on the `Accept` request header. Without it, a shared cache could serve a cached Markdown response to a browser (or vice versa)."*

Caveats, verbatim and load-bearing:
> *"Fetch data in Server Components directly from its source, not via Route Handlers."*
> *"For Server Components prerendered at build time, using Route Handlers will fail the build step. This is because, while building there is no server listening for these requests."*
> *"For Server Components rendered on demand, fetching from Route Handlers is slower due to the extra HTTP round trip between the handler and the render process."*

> *"[Server Actions] primary purpose is to mutate data from your frontend client. Server Actions are queued. Using them for data fetching introduces sequential execution."*

> *"In `export mode`, only `GET` Route Handlers are supported, in combination with the `dynamic` route segment config, set to `'force-static'`."*

Deployment environment, verbatim:
> *"Some hosts deploy Route Handlers as lambda functions. This means: Route Handlers cannot share data between requests. The environment may not support writing to File System. Long-running handlers may be terminated due to timeouts. WebSockets won't work because the connection closes on timeout, or after the response is generated."*

Security:
> *"Be deliberate about where headers go, and avoid directly passing incoming request headers to the outgoing response."*
> *"Always verify credentials before granting access. Do not rely on proxy alone for authentication and authorization."*

Preflight:
> *"Preflight requests use the `OPTIONS` method to ask the server if a request is allowed based on origin, method, and headers."*

Open-redirect guard shown in the callback-URL example:
`if (destination.origin !== request.nextUrl.origin) return new Response('Invalid redirect', { status: 400 })`

## M · Next.js — data security / the DAL
Source: <https://nextjs.org/docs/app/guides/data-security>

> *"There are three main approaches we recommend for fetching data in Next.js… HTTP APIs: for existing large applications and organizations. Data Access Layer: for new projects. Component-Level Data Access: for prototypes and learning."*

> *"We recommend choosing one data fetching approach and avoiding mixing them."*

> *"A Data Access Layer should: Only run on the server. Perform authorization checks. Return safe, minimal **Data Transfer Objects (DTOs)**."*

> *"This approach centralizes all data access logic, making it easier to enforce consistent data access and reduces the risk of authorization bugs. You also get the benefit of sharing an in-memory cache across different parts of a request."*

🔴 > *"Secret keys should be stored in environment variables, but only the Data Access Layer should access `process.env`. This keeps secrets from being exposed to other parts of the application."*

> *"`import 'server-only'` … ensures that proprietary code or internal business logic stays on the server by causing a build error if the module is imported in the client environment."*

> *"By default, when a Server Action is created and exported, it is reachable via a direct POST request, not just through your application's UI. This means, even if a Server Action or utility function is not imported elsewhere in your code, it can still be called externally."*

> *"The IDs are created during compilation and are cached for a maximum of 14 days."*

## N · Next.js — `use cache`
Source: <https://nextjs.org/docs/app/api-reference/directives/use-cache>

Cache key composition, verbatim:
> *"A cache entry's key is generated using a serialized version of its inputs, which includes: 1. **Build ID** … 2. **Function ID** - A secure hash of the function's location and signature in the codebase 3. **Serializable arguments** … 4. **HMR refresh hash** (development only)"*

> *"When a cached function references variables from outer scopes, those variables are automatically captured and bound as arguments, making them part of the cache key."*

> *"Arguments to cached functions and their return values must be serializable."*

🔴 > *"Cached functions and components **cannot** access runtime APIs like `cookies()`, `headers()`, or `searchParams`, and the restriction follows the call stack: a helper the cached function calls that reads one of these fails the same way, with the `next-request-in-use-cache` error. On a dynamically rendered route this surfaces when the route runs, so it can pass `next build` and fail under `next start`. Read these values outside the cached scope and pass them as arguments."*

Runtime caching table, verbatim:
> **Serverless** — *"Cache entries typically don't persist across requests (each request can be a different instance), or during revalidation. Build-time caching works normally."*
> **Self-hosted** — *"Cache entries persist across requests."*

> *"[`React.cache`] operates in an isolated scope inside `use cache` boundaries. Values stored via `React.cache` outside a `use cache` function are not visible inside it."*

Build hang error string, quoted by the doc:
> *"Error: Filling a cache during prerender timed out, likely because request-specific arguments such as params, searchParams, cookies() or uncached data were used inside \"use cache\"."*
> *"causing a timeout after 50 seconds"*

---

## Claims I could NOT settle from a primary source

1. **Whether `use cache` refuses a value that is a live `Pool`/`Client` object.** The docs
   state only that *"Arguments to cached functions and their return values must be
   serializable"* — they do not enumerate what happens with a driver handle. Write the
   mechanism (a pool is not serializable, so it cannot be an argument or a return value)
   and do not invent an error string for it.
2. **A number for how many connections a Next.js deployment opens per instance.** No
   primary source gives one; it is a product of host concurrency × pool `max`. State the
   arithmetic, never a figure.
3. **Whether Vercel Fluid keeps a Node process alive across a specific interval.** The
   `node-postgres` sizing guide says only that functions *"stick around between
   invocations"*. Do not quantify.
4. **Drizzle 0.45.x documentation.** The site publishes only the 1.0-rc docs; the 0.45.2
   typings were probed instead (§ version spine).

---

## O · Server Actions, Data Security and BFF — banked 2026-09-05 by ch15 fork B

🔴 **Not in sections J–N.** All from `version: 16.3.4` pages. Do not re-fetch.

### React — Server Functions (the progressive-enhancement mechanism)
Source: <https://react.dev/reference/rsc/server-functions>

⚠️ **This corrected a wrong claim.** Fork B had written that `<form action={serverAction}>`
"submits as a real HTML form POST before hydration". The Next.js forms guide does not say
that; React's reference gives a different and more precise mechanism:

> *"When using `useActionState` with Server Functions, React will also automatically replay form submissions entered before hydration finishes"*
> *"When the permalink is provided to `useActionState`, React will redirect to the provided URL if the form is submitted before the JavaScript bundle loads"*

### Next.js — Server Actions guide
> *"**Good to know:** This is a property of the client dispatcher, not of Server Functions in general. Server-side, an action runs in its own request and can do anything an async function can do."*
> *"Because `redirect` throws a control-flow exception, any code after it does not run. Place revalidation calls before `redirect` if the destination needs the fresh data."*
> *"If you've enabled the experimental `authInterrupts` flag, you can throw `unauthorized()` and `forbidden()` … so Next.js renders the corresponding `unauthorized.tsx` / `forbidden.tsx` UI segment automatically."*

### Next.js — Data Security
🔴 The load-bearing pair for "an action is its own entry point":
> *"A page-level authentication check does not extend to the Server Actions defined within it. Always re-verify inside the action"*
> *"The highlighted `auth()` check inside the action is critical. The page-level redirect on line 6 controls which UI is rendered, but the Server Action is a separate entry point and must verify the caller on its own."*

> *"The key must be a base64-encoded value whose decoded length matches a valid AES key size (16, 24, or 32 bytes). Next.js generates 32-byte keys by default."*
> *"You can use `import 'server-only'` in both the Data Access Layer and the `\"use server\"` file itself. Both work when the action is imported into a Client Component … because `\"use server\"` modules are resolved in a server-only webpack layer."*

### Next.js — `use server`
> *"Read authentication from cookies or headers rather than accepting tokens as function parameters."*

### Next.js — backend for frontend
> *"The `/docs/md/...` route is still directly accessible without the rewrite."*
> *"You can only read the request body once."*
> *"Avoid exposing sensitive information in error messages sent to the client."*

### Next.js — `route.js` reference, CORS
> *"If `OPTIONS` is not defined, Next.js adds it automatically and sets the `Allow` header based on the other defined methods."*

⚠️ **Unresolved:** the BFF guide's webhook example passes a second argument to
`revalidateTag(tag, 'max')` that that page never explains. `02j` says so on the page rather
than inventing semantics. Check the `revalidateTag` reference before copying it.
