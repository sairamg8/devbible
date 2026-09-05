---
title: "One PrismaClient is one connection pool, so where you construct it is a capacity decision — and the CLI needs a different URL from the application, for a reason that is structural rather than administrative"
sidebar_label: "01ga · Where the instance lives"
sidebar_position: 107
description: "The `globalThis` singleton and why hot reloading needs it, the serverless instance-per-function arithmetic, when `$disconnect()` is wrong, `prisma.config.ts`, and why `DATABASE_URL` and `DIRECT_URL` are two different things."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Prisma ORM v7 documentation — [Databases connections](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections), [PgBouncer](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/pgbouncer) and the [Prisma Config reference](https://www.prisma.io/docs/orm/reference/prisma-config-reference).
> Documentation-verified; **no sandbox run**.
> Target: **Prisma 7.10.0** · **Next.js 16.3.4** · `pg` **8.23.0** · PostgreSQL 18.4 · Node 24.20.0.

**[01g](01g-prisma-the-generated-client-and-driver-adapters.md) established that a `PrismaClient` owns a driver pool. This page is the consequence: the `new PrismaClient()` call is not an object construction, it is an allocation of up to ten Postgres backend processes, and *where the statement sits in your module graph* decides how many times it happens. Put it at module scope in a long-lived server and you get one pool, which is right. Put it at module scope in a file that hot module replacement re-evaluates and you get a new pool every time you save. Put it in a serverless function and you get one per concurrent instance, plus the ones held by instances that are paused or dying. The same line of code is correct, catastrophic or merely wasteful depending on what is around it, and Prisma's documentation covers all three cases separately.**

## One client is one pool — the development failure

> *"Frameworks like Next.js support hot reloading of changed files, which enables you to see changes to your application without restarting. However, if the framework refreshes the module responsible for exporting `PrismaClient`, this can result in **additional, unwanted instances of `PrismaClient` in a development environment**."*
> — [Prisma · Databases connections](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections)

Every hot reload of that module builds another client, each with its own pool of up to ten, and the old clients are not collected while their sockets are open. Fifteen saves is 150 connections against a `max_connections` that PostgreSQL 18 defaults to 100 — so the developer who is editing most actively is the one who takes the shared database down, which is exactly backwards as an incentive.

The documented workaround stashes the instance somewhere HMR does not replace, because HMR swaps *modules*, not globals:

```ts
// lib/db.ts — the singleton, with the adapter from 01g.
import 'server-only'
import { PrismaClient } from '@/prisma/generated/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

Three details in eight lines are load-bearing:

- **`import 'server-only'`** turns a Client Component importing this file into a build error instead of an attempt to bundle a database driver for the browser. It is not in Prisma's snippet because Prisma's snippet is framework-neutral; in an App Router codebase it belongs on every module that touches the database.
- **The `NODE_ENV` guard** is not superstition. In production you want one instance per process and no global reference keeping it alive across a reload that will never happen. Assigning unconditionally also hides genuine double-construction in production behind a cache.
- **`??`, not `||`.** With `||` a falsy-but-present value would be replaced; the distinction never bites here in practice, but the nullish form says what is meant.

## The same arithmetic, at production scale

> *"In a serverless environment, each function creates **its own instance** of `PrismaClient`, and each client instance has its own connection pool."*

> *"Many *concurrent functions* responding to a traffic spike 📈 can exhaust the database connection limit very quickly. Furthermore, any functions that are **paused** keep their connections open by default and block them from being used by another function."*

Note what "paused" means: the instance is not serving anyone, and it is still holding your connections. There is a third state that is worse still:

> *"Containers that are marked \"to be removed\" and are not being reused still **keep a connection open**"*

and a fourth fact that removes the obvious mitigation:

> *"There is no guarantee that subsequent nearby invocations of a function will hit the same container"*

which is why "keep the pool warm" is not a strategy you can rely on and why pool *size* on serverless is a different calculation from pool size on a server. This is [01b](01b-the-three-kinds-of-pool.md)'s exhaustion arithmetic with Prisma's name on it, and the escapes are the same three: a transaction-mode proxy pool in front, the HTTP driver for the queries that do not need a session, or fewer and longer-lived processes. **The ORM is not one of the variables** — a hand-written `pg` layer with the same concurrency has the same problem.

One documented dead end is worth knowing before you try it:

> *"Due to the way AWS RDS Proxy pins connections, it does not provide any connection pooling benefits when used together with Prisma Client."*

## `$disconnect()` — and when it is wrong

> *"You do not need to explicitly `$disconnect()` in the context of a long-running application that is continuously serving requests."*

A Next.js server is exactly that. The `$disconnect()` you see in Prisma's script examples belongs to a `main()` that must let the process exit, not to a route handler — calling it per request destroys the pool the singleton exists to preserve, so every request pays the full handshake and you have converted pooling into per-request connecting while keeping all of its complexity.

The mirror image is a real bug in the other direction:

```ts
// prisma/seed.ts — a short-lived script MUST disconnect, or the process hangs.
import { prisma } from '../lib/db'

async function main() {
  await prisma.plan.createMany({ data: [{ name: 'free' }, { name: 'pro' }] })
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
```

Without the `finally`, the open pool keeps handles registered with the event loop and `node` sits there after the work is done. In CI that is not a hang you notice locally — it is a job that times out after ten minutes with every log line saying the seed succeeded.

## The config file

Prisma 7 moved CLI configuration out of the schema into TypeScript:

> *"The Prisma Config file (`prisma.config.ts`) configures the Prisma CLI using TypeScript."*

```ts
// prisma.config.ts
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
})
```

Two traps live in that file.

🔴 **`.env` is not loaded for you.** *"Environment variables from `.env` files need to be loaded explicitly."* — hence the bare `import 'dotenv/config'` on line one. Drop it and `env('DIRECT_URL')` resolves against a process that never read the file, so the CLI reports a missing or malformed URL while your application, which loads `.env` through Next.js, works perfectly. Nothing about the error points at the config file.

⚠️ **The `adapter` field was removed in v7.** *"Removed in Prisma ORM v7. Migrations for driver adapters work automatically without additional configuration."* A config copied from a v6-era post will fail to type-check on that key — which is the good outcome; the bad one is copying a v6 `schema.prisma` block instead and wondering why nothing takes effect.

## The two URLs

The `datasource.url` in that config is the **CLI's** connection, and it is deliberately a different variable from the one your adapter uses. Prisma's own `.env` comments name them:

| Variable | Prisma's own description | Used by | Hostname |
|---|---|---|---|
| `DATABASE_URL` | *"Connection URL to your database using PgBouncer."* | the adapter, at runtime | the `-pooler` one |
| `DIRECT_URL` | *"Direct connection URL to the database used for Prisma CLI commands."* | `prisma.config.ts` | the direct one |

> *"Prisma CLI commands always read from this configuration."*

The split is structural, not stylistic:

> *"Prisma Migrate uses **database transactions** to check out the current state of the database and the migrations table. However, the Schema Engine is designed to use a **single connection to the database**, and does not support connection pooling with PgBouncer."*

A transaction-mode pooler hands each statement to whichever backend is free, which is precisely the guarantee the Schema Engine needs and cannot get. Which schema changes need that direct route, what a shadow database is for, and how Drizzle Kit answers the same question differently is [01i · Migrations in each](01i-migrations-in-each.md).

## Gotchas

**★ Symptom: development hits `too many clients already` after twenty minutes of editing; production never does.** Cause: HMR re-evaluates the module that constructs `PrismaClient`, and each new instance opens its own pool while the old pools keep their connections. Fix: the `globalThis` singleton, guarded so it applies only outside production.

```ts
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**★ Symptom: you added the `globalThis` guard and development *still* leaks.** Cause: the guard is on a module that something imports twice under different specifiers — `@/lib/db` in one file and `../../lib/db` in another — or a module evaluated separately in the Node and Edge runtimes. Two module instances, two globals, two pools, and the guard working correctly in each. Fix: one import specifier everywhere, enforced by a path alias, and never import the client from a file that also runs on Edge.

**★ Symptom: a Client Component imports a helper from `lib/db.ts` and the build fails with a driver module resolution error, or worse, succeeds and ships something odd.** Cause: nothing marks the module as server-only, so the bundler tries to include it in the client graph. Fix: `import 'server-only'` at the top of every module that constructs or uses the client — the error then names the offending import instead of the driver.

**★ Symptom: your seed or migration script finishes its work and the process never exits; CI times out.** Cause: the pool's sockets keep handles registered with the event loop, and a script has no server to keep running afterwards. Fix: `$disconnect()` in a `finally`, so it runs on the error path too.

```ts
main().finally(() => prisma.$disconnect())
```

**★ Symptom: you call `$disconnect()` at the end of each request and connection churn goes up, not down.** Cause: `$disconnect()` tears down the pool, so the next request pays every handshake again — and the doc explicitly exempts long-lived servers: *"You do not need to explicitly `$disconnect()` in the context of a long-running application that is continuously serving requests."* Fix: delete the call. Reserve it for scripts and seeds that must let the process exit.

**★ Symptom: connection count stays high for minutes after traffic drops to zero.** Cause: paused instances *"keep their connections open by default"*, and containers marked to be removed *"still keep a connection open"*. The pool is idle from your side and occupied from the database's. Fix: this is not fixable in application code — it is the reason a transaction-mode proxy pool exists. Size the *proxy's* limit against `max_connections` and let function instances contend for its client slots instead of for backends.

**★ Symptom: `PrismaClientInitializationError` from the CLI while the running application connects fine.** Cause: `prisma.config.ts` does not read `.env` — *"Environment variables from `.env` files need to be loaded explicitly."* Next.js loads it for the app; the CLI is a separate process with no such courtesy. Fix: `import 'dotenv/config'` as the first line of the config file.

**★ Symptom: `prisma migrate deploy` fails against the pooled hostname with a transaction or advisory-lock error.** Cause: the Schema Engine *"is designed to use a single connection to the database, and does not support connection pooling with PgBouncer."* Fix: point `datasource.url` in `prisma.config.ts` at `DIRECT_URL` — the hostname without `-pooler` — and leave `DATABASE_URL` pooled for the application.

**★ Symptom: `adapter` in `prisma.config.ts` is a type error after upgrading to v7.** Cause: the field was *"Removed in Prisma ORM v7. Migrations for driver adapters work automatically without additional configuration."* Fix: delete the key. Nothing replaces it; the CLI now derives what it needs from `datasource.url`.

**★ Symptom: you need `SET LOCAL` or a session variable and there is no Prisma API for it.** Cause: *"database connections are managed by the driver and its pool. They are not exposed to the developer and it is not possible to manually access individual connections."* Fix: use `prisma.$transaction` with a callback, which holds one client for the callback's duration, so the `SET LOCAL` and the query it governs land on the same connection — and use `SET LOCAL`, never bare `SET`, so the value cannot leak onto the next request that reuses the backend.

```ts
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
  return tx.invoice.findMany()
})
```

**★ Symptom: a `set_config`/`SET LOCAL` guard works in tests and leaks between tenants in production.** Cause: the setting was applied with `$executeRaw` on `prisma` rather than on the transactional `tx`, so it went out on one checked-out client and the query that depended on it went out on another. Under a single-connection test database both land on the same backend and the bug is invisible. Fix: every statement that depends on the setting must use the `tx` handle from the same `$transaction` callback — see [01c](01c-transaction-pooling-and-session-state.md) for the same trap in raw `pg`.

**★ Symptom: the singleton is correct and you still exhaust connections in staging.** Cause: correct is not small. Ten is the v7 default pool size, so one dev machine, one preview deployment and one staging server is already thirty connections against a database that may be a 0.25 CU Neon compute with 97 usable. Fix: size `max` per environment rather than inheriting the default everywhere, and count the *processes*, not the applications.

## Interview questions

**★ Why does the `globalThis` singleton exist, and why is it guarded by `NODE_ENV`?**
It exists because hot module replacement re-evaluates the module that constructs `PrismaClient`, and each construction brings its own pool while the previous pools keep their connections; Prisma warns that a refreshed module *"can result in additional, unwanted instances of PrismaClient in a development environment"*. Stashing the instance on `globalThis` survives the reload, because HMR replaces modules, not globals. The guard is there because in production the problem does not exist — a process constructs the client once — and a global reference would only keep an object alive across a reload that never happens while making the lifecycle harder to reason about. The guard also documents the intent: this is a development workaround, not an architectural choice.

**★ You added the singleton and development still leaks connections. What would you check?**
Whether the module is being evaluated more than once under different identities. Importing `@/lib/db` in one file and `../../lib/db` in another can produce two module instances in some bundler configurations, and a file imported by both an Edge-runtime route and a Node route is evaluated separately in each runtime — two modules, two `globalThis` objects, two pools, and the guard working correctly in each of them. The fix is to standardise on one import specifier and to keep the Prisma client out of anything that runs on Edge. The second thing to check is the pool size: ten is the v7 default, so even a correct singleton holds ten connections, and two developers plus a staging environment against one small instance is already thirty.

**★ Does choosing Prisma over a hand-written `pg` layer change the connection arithmetic?**
No, and v7 makes that unusually easy to demonstrate, because Prisma is now using the same `pg.Pool` you would have written. One `PrismaClient` is one pool of up to `max` connections; N concurrent function instances are N pools; paused and terminating containers *"still keep a connection open"*. The escapes are unchanged — put a transaction-mode proxy pool in front, switch to the HTTP driver for the queries that do not need a session, or run fewer, longer-lived processes. The ORM affects your query ergonomics and your migration story; it does not affect how many backend processes Postgres will start.

**★ Prisma says paused functions keep their connections. Why can't you just close the pool at the end of each invocation?**
You can, and on a runtime that genuinely discards the instance after each request that is the right thing to do. The problem is that on most serverless platforms you do not know which case you are in: *"There is no guarantee that subsequent nearby invocations of a function will hit the same container"*, but many invocations *do* hit the same warm container, and tearing the pool down at the end of every one of those throws away the reuse that made the pool worth having. So closing per invocation trades a connection-count problem for a latency problem, and neither is solved in application code. The actual solution is a layer down: a proxy pool that makes the number of your processes irrelevant to the number of backends, which is why every serverless Postgres product ships one.

**★ Why are there two connection URLs, and what breaks if you use only the pooled one?**
Because the application and the CLI need different things from a connection. The application wants many short-lived queries sharing few backends, which is what a transaction-mode pooler gives it. Prisma Migrate wants a single session it can hold across statements: the Schema Engine *"is designed to use a single connection to the database, and does not support connection pooling with PgBouncer"*, and it takes advisory locks and runs DDL inside transactions that must all land on the same backend. Point migrations at the pooled hostname and they fail — sometimes immediately with a lock or transaction error, sometimes worse, by half-applying a migration whose statements were split across backends. So `DATABASE_URL` is pooled and used by the adapter; `DIRECT_URL` is direct and used by `prisma.config.ts`.

**★ Prisma's config file needs `import 'dotenv/config'` but your Next.js app does not. Why?**
Because loading `.env` is a framework courtesy, not a Node feature. Next.js reads `.env` files as part of starting the dev server or the build, so `process.env.DATABASE_URL` is populated for your application code. `prisma.config.ts` is executed by the Prisma CLI in its own process, which does no such loading — the reference says so directly: *"Environment variables from `.env` files need to be loaded explicitly."* The symptom is a CLI that cannot connect while the app connects fine, which sends people looking at the database, the network and the credentials before they look at the eight characters missing from line one of a config file.

**★ How do you run a `SET LOCAL` with Prisma, given that connections are not exposed?**
Through `prisma.$transaction` with a callback, which holds one checked-out client for the duration and passes you a transactional client bound to it. Both the setting and the queries that depend on it then execute on the same connection, and `LOCAL` scoping means it is discarded at commit — exactly what you want behind a transaction-mode pooler, where a plain `SET` would leak onto whatever the next request happened to reuse. What you cannot do is `prisma.$executeRaw('SET …')` followed by a separate `prisma.model.findMany()`, because those are two independent checkouts. That is the same trap [01c](01c-transaction-pooling-and-session-state.md) describes for raw `pg`, and Prisma's lack of connection access makes it impossible to paper over — which is arguably a feature, since the `pg` version of the mistake is the one that silently serves one tenant another tenant's rows.

**★ When is `$disconnect()` correct, and when is it a bug?**
It is correct in anything that must let the Node process exit — a seed script, a one-off migration helper, a cron job, a test teardown. It is a bug in a request handler in a long-lived server, where the documentation explicitly says it is unnecessary and where it destroys the pool that the next request would have reused. The tell is what the code does after the last query: if the answer is "the process ends", disconnect; if the answer is "wait for another request", do not. Both mistakes are quiet — the missing disconnect looks like a CI job that hangs with a successful log, and the extra disconnect looks like a database that is inexplicably slow under light load.

**★ You are asked to review a `lib/db.ts`. What are you looking for, in order?**
Whether it is `server-only`, so a Client Component cannot pull the driver into the browser bundle. Whether there is exactly one construction site for `PrismaClient` in the repository. Whether the development singleton is present and `NODE_ENV`-guarded. Whether `max` is set deliberately rather than inherited, and whether `connectionTimeoutMillis` is non-zero so saturation is visible ([01g](01g-prisma-the-generated-client-and-driver-adapters.md)). Whether the connection string is the pooled hostname, and whether a separate `DIRECT_URL` exists for the CLI. Finally, whether anything in a request path calls `$disconnect()`. Six checks, and in my experience at least two of them fail on any codebase that upgraded from v6 without re-reading the connection docs.

---

← [01g · Prisma: client and adapters](01g-prisma-the-generated-client-and-driver-adapters.md) · Next → [01h · Prisma and Drizzle as models](01h-prisma-and-drizzle-as-models.md)
