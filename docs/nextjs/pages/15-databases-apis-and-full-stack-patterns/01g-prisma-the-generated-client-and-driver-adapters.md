---
title: "Prisma 7 stopped owning the connection: the client is now generated into your repository and the pool belongs to a driver adapter you construct yourself — which moves every knob you knew and breaks every build that forgot to regenerate"
sidebar_label: "01g · Prisma: client and adapters"
sidebar_position: 7
description: "What `prisma generate` produces and why `output` became required, what a driver adapter is, which adapter wraps which driver, and where the v6 pooling parameters went — with the two v7 defaults that turn a loud failure into a quiet one."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Prisma ORM v7 documentation — [Connection pool](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool), [Generating Prisma Client](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/generating-prisma-client), [Driver adapters](https://www.prisma.io/docs/orm/overview/databases/database-drivers), [Neon](https://www.prisma.io/docs/orm/overview/databases/neon) and [PgBouncer](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/pgbouncer).
> Documentation-verified; **no sandbox run**.
> Target: **Prisma 7.10.0** (`@prisma/client`, `@prisma/adapter-pg`, `@prisma/adapter-neon`) · **Next.js 16.3.4** · `pg` **8.23.0** · `@neondatabase/serverless` **1.1.0** · Node 24.20.0.

**Two things about Prisma changed in v7 and they are the reason most of what you remember about it is now wrong. First, the client is generated to a path *you* choose inside your project and `output` is no longer optional, so the client is a build artifact with all the failure modes build artifacts have. Second, a relational datasource is instantiated with a driver adapter by default — Prisma does not open the connection any more, `pg` or `@neondatabase/serverless` does — so every pooling parameter that used to live as a query string on `DATABASE_URL` has moved into a driver config object with different names and different defaults. If you carry a v6 mental model into a v7 codebase you will look for `connection_limit` in a URL that no longer reads it, and silently run on the driver's defaults instead.**

## What actually changed under the hood

Prisma states the shift plainly:

> *"Starting with Prisma ORM v7, relational datasources instantiate Prisma Client with driver adapters by default. Driver adapters rely on the Node.js driver you supply, so connection pooling defaults (and configuration) now come from the driver itself."*
> — [Prisma · Connection pool](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool)

Read that as a transfer of ownership. Previously the query engine held its own pool and you tuned it through the datasource URL. Now the pool is a `pg.Pool` — the exact object [01b](01b-the-three-kinds-of-pool.md) calls the *driver pool*, with the exact semantics [01b](01b-the-three-kinds-of-pool.md) gives it. Prisma became a caller of that pool rather than its owner, and the practical consequence is that the pooling chapter of this topic now applies to Prisma directly instead of by analogy.

The corollary is stated just as flatly:

> *"Pool size, acquire timeout, and other pool behavior are **configured per driver adapter**. There are no connection URL parameters for these in Prisma ORM v7."*

**There are none.** A `?connection_limit=5` left on a v7 connection string is not an error and not a warning — it is an unrecognised query parameter that the driver ignores. Nothing tells you.

## `prisma generate` — the client is a build artifact

> *"`prisma generate` creates Prisma Client from the models and generator configuration in your `schema.prisma` file."*
> — [Prisma · Generating Prisma Client](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/generating-prisma-client)

and in v7 you must say where it goes:

> *"In Prisma ORM v7, the `output` field is required:"*

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "./generated/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

⚠️ **Prisma's own documentation imports that client from two different paths** — the driver-adapters page writes `"../generated/prisma/client"`, the Neon guide writes `"../prisma/generated/client"`. Neither is canonical, because the path is whatever your `output` says. Copying a snippet without changing its import to match your own `output` is the first thing that breaks, and the error is a module-not-found, not a Prisma error, so it reads like a bundler problem.

The doc lists exactly when the artifact goes stale:

> *"You should run `prisma generate` after: changing your Prisma schema, updating generator configuration, enabling features that affect the client API, pulling schema changes from another branch or teammate"*

That last clause is the one that bites a team. A colleague adds a column, you pull, your editor still types the old model, and `prisma.invoice.findMany({ select: { currency: true } })` fails type-checking against a schema that *does* have `currency`. The fix is not a restart:

```jsonc
// package.json — regenerate on every install and before every build.
{
  "scripts": {
    "postinstall": "prisma generate",
    "build": "prisma generate && next build"
  }
}
```

🔴 **Do not commit the generated directory and do not rely on it surviving a Docker layer.** A container that runs `npm ci --omit=dev` in one stage and copies `node_modules` into another has no `prisma` CLI at the point the client is needed; a CI job that caches `node_modules` but not the generated output starts a build with no client at all. Both fail at *import* time in the deployed app, long after the step that actually went wrong.

## The driver adapter

> *"Adapters act as *translators* between Prisma Client and the JavaScript database driver."*
> — [Prisma · Driver adapters](https://www.prisma.io/docs/orm/overview/databases/database-drivers)

The adapter you pick names the driver, not the database:

| Adapter package | Driver it wraps | Use it when |
|---|---|---|
| `@prisma/adapter-pg` | `pg` (`node-postgres`) | any Postgres over TCP — a VPS, RDS, a container, Neon's pooled endpoint |
| `@prisma/adapter-neon` | `@neondatabase/serverless` | Neon specifically, when you want its HTTP or WebSocket transport |
| `@prisma/adapter-ppg` | Prisma Postgres | Prisma's own hosted Postgres |
| `@prisma/adapter-mariadb` | `mariadb` | MySQL / MariaDB |
| `@prisma/adapter-better-sqlite3` · `@prisma/adapter-libsql` | `better-sqlite3` · libSQL | SQLite, local or Turso |
| `@prisma/adapter-mssql` | `node-mssql` | SQL Server |
| `@prisma/adapter-d1` | Cloudflare D1 | Workers |

The wiring is two lines, and the shape is identical across adapters:

```ts
// lib/db.ts — the pg adapter. Note the adapter, not the client, holds the connection string.
import { PrismaClient } from '@/prisma/generated/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
export const prisma = new PrismaClient({ adapter })
```

```ts
// lib/db.ts — the Neon adapter, per Prisma's Neon guide.
import { PrismaClient } from '@/prisma/generated/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
export const prisma = new PrismaClient({ adapter })
```

> *"You can then use Prisma Client as you normally would with full type-safety."*
> — [Prisma · Neon](https://www.prisma.io/docs/orm/overview/databases/neon)

⚠️ `PrismaNeon` takes a **connection string**, not a pre-built `Pool`. That matters because everything [01f](01f-websockets-pool-and-the-lifecycle-rule.md) says about `neonConfig.webSocketConstructor` still applies — the assignment has to happen at module top level, before this adapter constructs its first pool, and the adapter gives you no hook to do it later.

## The pool knobs moved, and the defaults moved with them

Because the pool is `pg`'s, the configuration is `pg`'s. Prisma publishes the mapping:

| Behaviour | v6 URL parameter | v7 adapter field | v7 default | v6 default |
|---|---|---|---:|---:|
| Pool size | `connection_limit` | `max` | **10** | `num_cpus * 2 + 1` |
| Acquire timeout | `pool_timeout` | `connectionTimeoutMillis` | **0** (none) | 10s |
| Connection timeout | `connect_timeout` | `connectionTimeoutMillis` | **0** (none) | 5s |
| Idle timeout | `max_idle_connection_lifetime` | `idleTimeoutMillis` | **10s** | 300s |
| Connection lifetime | `max_connection_lifetime` | `maxLifetimeSeconds` | **0** (none) | 0 |

🔴 **Three of those defaults changed, and two changed in the dangerous direction.** v6 defaulted `pool_timeout` to 10s and `connect_timeout` to 5s; v7 defaults both to **0, meaning no timeout at all**. Under v6 a saturated pool eventually rejected a request with a timeout error you could see in logs and alert on. Under v7 the same saturation produces a request that waits — forever, from the pool's point of view, until the platform's own function timeout kills it. The symptom changes from *"errors spike"* to *"latency goes to the timeout ceiling and stays there"*, which is a much harder page to read at 2am. Set them:

```ts
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 10,                         // per process — see the arithmetic in 01b
  connectionTimeoutMillis: 5_000,  // fail fast rather than hang on a saturated pool
  idleTimeoutMillis: 10_000,
  maxLifetimeSeconds: 1_800,       // recycle, so a pooler restart cannot strand a client
})
```

Two further statements bound what you can do with the result:

> *"The pool is created when Prisma Client opens the *first* connection to the database"* — by `$connect()` or by the first query.

> *"When using Prisma Client with a driver adapter, database connections are managed by the driver and its pool. They are not exposed to the developer and it is not possible to manually access individual connections."*

So there is no `prisma.$pool`, no way to pin a statement to a specific backend, and no way to run the bare `SET`-then-query pattern [01c](01c-transaction-pooling-and-session-state.md) warns about. What you do instead — and where the client instance has to live so that any of this holds — is [01ga](01ga-where-the-prisma-instance-lives.md).

## Gotchas

**★ Symptom: `?connection_limit=5` on `DATABASE_URL` changes nothing; the pool is still 10.** Cause: v7 reads no pooling parameters from the URL — *"There are no connection URL parameters for these in Prisma ORM v7."* The string is parsed by `pg`, which ignores keys it does not know. Fix: move every knob into the adapter constructor.

```ts
// ❌ v6 muscle memory — silently ignored.
const adapter = new PrismaPg({ connectionString: `${process.env.DATABASE_URL}?connection_limit=5` })
// ✅
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 5 })
```

**★ Symptom: under load, requests stop returning but almost nothing errors; p99 pins to the platform's function timeout.** Cause: `connectionTimeoutMillis` defaults to **0** in v7, where v6's `pool_timeout` was 10s. A caller that cannot get a client waits indefinitely instead of failing. Fix: set it, and treat the resulting error as a load signal.

```ts
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5_000 })
```

**★ Symptom: connection churn against the pooler jumped after the v7 upgrade, with no change in traffic.** Cause: the idle timeout fell from 300s to **10s**, so a connection idle for eleven seconds between requests is now closed and re-handshaken instead of being reused. On bursty traffic that turns one warm connection into a stream of new ones. Fix: raise it deliberately if your traffic has gaps — the v6 value is still a reasonable choice, it just is not the default any more.

```ts
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, idleTimeoutMillis: 300_000 })
```

**★ Symptom: `Cannot find module '@/prisma/generated/client'` after a clean checkout or in CI.** Cause: the generated client is a build artifact and `output` now points inside your project, so it is (correctly) gitignored and absent until `prisma generate` runs. Fix: generate in `postinstall` and again in `build`, so neither a cached `node_modules` nor a fresh clone can skip it.

```jsonc
{ "scripts": { "postinstall": "prisma generate", "build": "prisma generate && next build" } }
```

**★ Symptom: every pull request has thousands of lines of diff in `prisma/generated/` and merge conflicts nobody can resolve.** Cause: the generated client was committed, because `output` puts it inside the project and it looked like source. Fix: gitignore it and generate it in every environment — including the editor's, via `postinstall`.

```gitignore
# .gitignore — must match the generator's output path
/prisma/generated/
```

**★ Symptom: the types are stale — a column you can see in `schema.prisma` is not on the model type.** Cause: the client was generated before the schema changed, most often by pulling a teammate's migration. Fix: `npx prisma generate`, then restart the TypeScript server; the editor caches the old `.d.ts` even after the file on disk is replaced.

**★ Symptom: an import copied from the Prisma docs does not resolve.** Cause: the docs import from `"../generated/prisma/client"` on one page and `"../prisma/generated/client"` on another; both are illustrations of a user-chosen `output`. Fix: import from whatever your own `generator client { output = … }` says, and add a path alias so the answer is the same in every file.

**★ Symptom: `prepared statement "s0" already exists` from Prisma behind a pooler.** Cause: *"One common feature that external connection poolers do not support are named prepared statements, which Prisma ORM uses"* — the full mechanism is in [01d](01d-prepared-statements-under-a-pooler.md). Fix: transaction-mode PgBouncer as Prisma requires, and on PgBouncer ≥ 1.21.0 *do not* set `pgbouncer=true` — *"We recommend **not** setting `pgbouncer=true` in the database connection string if you're using PgBouncer 1.21.0 or later."*

**★ Symptom: the pool looks unused right up until the first query, then ten connections appear at once.** Cause: *"The pool is created when Prisma Client opens the first connection to the database"*, and `pg` then creates clients lazily as demand arrives. Fix: nothing is wrong — but do not use "connections at boot" as a health check, and if you need warm connections, issue a trivial query at startup rather than assuming construction connected anything.

**★ Symptom: you switched from `@prisma/adapter-pg` to `@prisma/adapter-neon` and your pool settings stopped applying.** Cause: the fields are the driver's, not Prisma's, so they only exist if that driver has them — `max` and `idleTimeoutMillis` mean something to `pg` and to Neon's `Pool`, but the HTTP transport has no pool to size at all. Fix: read the *driver's* documentation for the adapter you chose, and do not assume a knob survives the swap.

## Interview questions

**★ Why did Prisma 7 make `output` required, and what does that change operationally?**
Because the client is no longer generated into `node_modules` as a side effect of installation; it is generated to a path in your project that you name. Operationally it turns the client from something an install produces into a build artifact with an explicit lifecycle — it must be generated after every schema change, after every branch switch that brings someone else's migration, and in every environment that starts from a clean checkout or a cached `node_modules`. The failure mode moved too: instead of a Prisma error you get a module-not-found at import time in the deployed application, which points at your bundler rather than at the step that actually went wrong. The mitigation is unglamorous and complete: `prisma generate` in `postinstall` and again in `build`.

**★ What is a driver adapter, and what did it take away from you?**
It is a translation layer — Prisma's word is *"translators"* — between Prisma Client and an ordinary JavaScript database driver, so that `pg` or `@neondatabase/serverless` opens and owns the connections instead of Prisma's own engine. What it takes away is URL-based pool configuration: v7 reads no pooling parameters from the connection string at all, so `connection_limit`, `pool_timeout` and friends are now `max`, `connectionTimeoutMillis` and friends on the adapter's config object. It also takes away any illusion that Prisma's pool is special. It is a `pg.Pool`, with `pg`'s FIFO queue, `pg`'s lazy creation and `pg`'s defaults, which means the pooling reasoning you do for a hand-written `pg` application transfers to Prisma exactly.

**★ Which v7 default change is most likely to hurt you, and why is it hard to spot?**
The acquire and connect timeouts, both of which went from a finite v6 value (10s and 5s) to **0, meaning no timeout**. It is hard to spot because it converts a loud failure into a quiet one. Under v6, a saturated pool rejected the eleventh caller with a timeout error that appeared in logs, incremented an error metric and fired an alert. Under v7 that caller simply waits, and the request dies later at the platform's function timeout — so the dashboard shows latency climbing to a ceiling with a normal error rate, which reads like a slow database rather than an exhausted pool. Setting `connectionTimeoutMillis` explicitly is less about tuning than about restoring an observable failure.

**★ `maxLifetimeSeconds` defaults to off. Why set it anyway?**
Because a connection that lives forever accumulates every kind of staleness the network and the pooler can produce. A PgBouncer restart, a Neon compute suspend-and-resume, a failover to a replica, an idle NAT mapping expiring — each can leave the driver holding a socket it believes is fine, and the failure surfaces as one mysterious error on one request rather than as a pattern. Recycling connections on a fixed lifetime bounds how long a broken one can hide, and it costs a handshake every half hour per connection, which is nothing. It also caps how long a connection can hold a backend process on the database side after a deployment, which matters when the old and new versions overlap.

**★ When would you choose `@prisma/adapter-neon` over `@prisma/adapter-pg` against a Neon database?**
When you want Neon's own transports rather than plain TCP — the HTTP path for one-shot queries described in [01e](01e-the-http-driver-and-one-shot-queries.md), or the WebSocket path in [01f](01f-websockets-pool-and-the-lifecycle-rule.md). `@prisma/adapter-pg` against Neon's pooled hostname is a perfectly good choice and is the simpler one; it is TCP to PgBouncer, and everything in this topic about proxy pools applies unchanged. Reach for `@prisma/adapter-neon` when the runtime makes a TCP connection expensive or impossible, and remember that it takes a connection string rather than a pool — so the `neonConfig.webSocketConstructor` assignment must already have happened at module scope by the time you construct it.

**★ Why is "the pool is created on the first connection" worth knowing?**
Because it separates construction from connection, and people build health checks and startup assertions on the assumption that they are the same event. Constructing `PrismaClient` opens nothing; the pool appears when `$connect()` or the first query runs, and `pg` then creates clients lazily as callers arrive. So a container that boots successfully has proven nothing about its credentials, its network path or the database being up — the first real request discovers all of that, which is why a bad `DATABASE_URL` so often reaches production and surfaces as a user-facing 500 rather than a failed deploy. If you want boot-time proof, issue a trivial query at startup deliberately.

**★ Prisma no longer exposes individual connections. Is that a loss?**
Mostly it is an honesty. The engine never gave you a connection handle either; what v7 does is state the constraint instead of leaving it implicit — *"they are not exposed to the developer and it is not possible to manually access individual connections."* You lose the ability to paper over a pooler-mode mistake by pinning a `SET` to a connection you kept, which is a pattern that was always fragile and that transaction-mode pooling breaks anyway. What you keep is the one construct that genuinely needs a stable connection, `$transaction` with a callback, which holds a single checked-out client for the duration. If you need more than that — `LISTEN`/`NOTIFY`, an advisory lock spanning statements, a temporary table — you need a `pg` client of your own next to Prisma, and that is a design decision worth making explicitly rather than discovering.

---

← [01f · WebSockets and lifecycle](01f-websockets-pool-and-the-lifecycle-rule.md) · Next → [01ga · Where the instance lives](01ga-where-the-prisma-instance-lives.md)
