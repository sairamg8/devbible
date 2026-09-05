---
title: "Hot module replacement swaps modules and leaves globals alone, which is why a pool constructed at module scope is reconstructed on every save and why the developer editing most actively is the one who takes the shared database down — and why the fix is a `globalThis` stash rather than anything clever"
sidebar_label: "03c · The dev hot-reload leak"
sidebar_position: 11
description: "Why the leak only happens in development, the arithmetic that reaches max_connections in an afternoon, the globalThis singleton written for Drizzle and pg with every line justified, what the guard is for, the seed-script variant of the same bug, and the four things the singleton does not fix."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against [Prisma 7 · Database connections](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections) (quoted for the hot-reload mechanism, which is the framework's rather than the ORM's), [PostgreSQL 18 · Connection Settings](https://www.postgresql.org/docs/18/runtime-config-connection.html), [`node-postgres` · `pg.Pool`](https://node-postgres.com/apis/pool) and [Drizzle · Get started with PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql).
> Target: `pg` **8.23.0** · `drizzle-orm` **0.45.2** · **PostgreSQL 18.4** · **Next.js 16.3.4** · Node **24.20.0**.
> Documentation-verified; **no sandbox run, no timings**.

**This is the only bug in the chapter that is worse in development than in production, and it is the reason it survives so long: the person best placed to notice it is the one causing it, and the environment where it happens is the one nobody monitors. A module-scope `new Pool()` is evaluated every time hot module replacement re-runs that module, each evaluation opens a fresh set of connections, and nothing closes the previous ones — because nothing told the old module it was being replaced. Fifteen saves is fifteen pools. The fix is four lines and it works because HMR replaces modules and has no opinion about `globalThis`.**

## What HMR does, and why it does it

The Next.js development server does not restart on a file change. It re-evaluates the changed module and everything downstream of it, so that your edit is live without losing the page you were on. That is the entire value of `next dev`, and it is also the mechanism of the leak.

Prisma documents the consequence in framework-neutral terms — this is a property of hot reloading, not of any ORM:

> *"Frameworks like Next.js support hot reloading of changed files, which enables you to see changes to your application without restarting. However, if the framework refreshes the module responsible for exporting `PrismaClient`, this can result in **additional, unwanted instances of `PrismaClient` in a development environment**."*
> — [Prisma 7 · Database connections](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections)

Substitute `Pool` for `PrismaClient` and nothing changes. Re-evaluating

```ts
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 })
```

constructs a *new* pool. The old one is still referenced by whatever already imported it, its sockets are still open, and no code path exists that would call `end()` on it — module replacement is not a lifecycle event your module gets to observe.

## The arithmetic, in an afternoon

> *"Determines the maximum number of concurrent connections to the database server. The default is typically 100 connections, but might be less if your kernel settings will not support it (as determined during initdb). This parameter can only be set at server start."*
> — [PostgreSQL 18 · `max_connections`](https://www.postgresql.org/docs/18/runtime-config-connection.html)

Against a local Postgres with that default, and `pg`'s own `max` default of 10, the ceiling is ten saves of any file in the database module's dependency graph. In practice pools do not fill instantly, so it takes longer — but "longer" is measured in minutes of ordinary editing, not in days.

🔴 **Against a *shared* development database it is worse than an inconvenience, and the incentive is exactly backwards: the developer iterating fastest is the one who exhausts the connection limit for the whole team.** That is a strong argument for per-developer database branches, and an even stronger one for fixing the leak.

## The fix

```ts
// lib/db/index.ts — the ONE module that constructs a database client.
import 'server-only'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '@/db/schema'

/**
 * HMR replaces modules; it does not replace `globalThis`. Stashing the pool
 * there is what makes it survive a re-evaluation of this file.
 */
const globalForDb = globalThis as unknown as { sprintdeskPool?: Pool }

const pool =
  globalForDb.sprintdeskPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: process.env.NODE_ENV === 'production' ? 5 : 2,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.sprintdeskPool = pool
}

export const db = drizzle({ client: pool, schema })
```

Every line earns its place.

**`globalThis`, not a module-level variable.** A module-level cache is inside the thing being replaced, so it is replaced too. `globalThis` is outside the module graph entirely, which is precisely why HMR leaves it alone.

**A namespaced key.** `globalThis.pool` is a name any dependency could also pick. `sprintdeskPool` will not collide.

**`??`, not `||`.** A `Pool` instance is never falsy so the distinction does not bite here, but nullish coalescing says what is meant, and the habit matters on values that can legitimately be `0` or `''`.

**The `NODE_ENV` guard on the *assignment*, not on the read.** In production there is no HMR, so the stash has no job to do — and assigning unconditionally would hide genuine double-construction behind a cache, which is a bug you want to see rather than absorb. Reading unconditionally is harmless because the key is only ever set in development.

**`max: 2` in development.** Even with the singleton working, a lower ceiling is right locally: one developer does not need five connections, and if the singleton ever breaks, a smaller `max` buys you a longer runway before the database refuses.

**`drizzle({ client: pool, schema })` outside the cache.** The Drizzle wrapper is a thin object around the pool; constructing a new one per reload is cheap and holds no sockets. **The pool is the thing that must be shared, because the pool is the thing that owns connections.** Caching the wrapper as well is harmless and slightly tidier; caching *only* the wrapper fixes nothing.

⚠️ **The `import 'server-only'` at the top is not part of this fix and is not optional either.** It is what turns a Client Component reaching this module into a build error instead of an attempt to bundle a Postgres driver for the browser ([04b](04b-what-server-only-does-not-protect.md)).

## The same bug wearing a different hat

**A seed or script that imports the app's pool and never ends it.** The pool keeps handles registered with the event loop, so `node` sits there after the work is done. Locally that looks like a script that "finished"; in CI it is a step that times out at ten minutes with every log line saying the seed succeeded.

```ts
// db/seed.ts — a short-lived script MUST end its pool.
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { boards, cards } from '@/db/schema'

const pool = new Pool({ connectionString: process.env.DIRECT_URL, max: 1 })
const db = drizzle({ client: pool })

try {
  const [board] = await db.insert(boards).values({ name: 'Sprint 1' }).returning()
  await db.insert(cards).values([
    { boardId: board.id, title: 'Write the contract', position: 1 },
    { boardId: board.id, title: 'Write the schema', position: 2 },
  ])
} finally {
  await pool.end()
}
```

`max: 1`, `DIRECT_URL`, and `end()` in a `finally`. The mirror-image mistake is calling `end()` per request in the application, which destroys the pool the singleton exists to preserve and converts pooling into per-request connecting while keeping all of its complexity.

**A dev server and a seed script running at once.** Two processes, two pools, one local database. Neither is leaking; the total is still `2 × max` and it counts against the same limit. Worth knowing when the arithmetic does not add up.

## What the singleton does not fix

It is a development-mode workaround for a development-mode mechanism, and it is regularly mistaken for a connection-management strategy.

1. **It does nothing in production**, by design — the assignment is guarded and there is no HMR there anyway.
2. **It does nothing for serverless connection count.** One pool per instance is still one pool per instance; `globalThis` is per process, and the exhaustion product in [03b](03b-the-arithmetic-and-the-three-escapes.md) is untouched.
3. **It does not survive a server restart.** Changing `next.config.ts`, an environment variable, or anything else that restarts the process starts from zero — which is fine, because the old process's sockets die with it.
4. **It does not protect against a second module constructing a pool.** If two files each call `new Pool()`, the singleton in one of them is irrelevant. The invariant that prevents that is one construction site plus a lint boundary, which is [04](04-the-data-access-layer.md).

## Gotchas

**★ Symptom: `sorry, too many clients already` after twenty minutes of editing, and production never sees it.** Cause: HMR re-evaluated the module holding `new Pool()` on every save, each evaluation opened a new pool, and nothing closed the old ones. Fix: the `globalThis` stash above. Nothing else works, because module replacement is not a lifecycle event your module can observe.

**★ Symptom: the singleton was added and the leak continues.** Cause: the `drizzle()` wrapper was cached and the `Pool` was not, so a fresh pool is still constructed on every reload. Fix: cache the object that owns sockets. The wrapper is cheap and stateless with respect to connections; the pool is the resource.

**★ Symptom: the singleton was added and the leak continues, and the pool *is* cached.** Cause: a second module also constructs a pool — a script, a test helper, or a route file that imported `pg` directly. Fix: exactly one construction site, `server-only`, plus a `no-restricted-imports` rule that makes importing `pg` anywhere else a lint error rather than a review comment.

**★ Symptom: a colleague cannot connect to the shared dev database and has changed nothing.** Cause: somebody else's dev server is leaking pools into the same `max_connections`. Fix: fix the leak, and separately give every developer their own database branch — a shared development database makes one person's editing speed everyone's outage.

**★ Symptom: production has two pools and the singleton "should" have prevented it.** Cause: the assignment is guarded by `NODE_ENV !== 'production'`, deliberately, so the second construction is visible instead of being absorbed. Fix: find why the module was evaluated twice — usually two copies of the module in the graph via differing import specifiers, such as `@/lib/db` in one file and `../../lib/db` in another with a misconfigured path alias.

**★ Symptom: the seed script never exits in CI and the job times out.** Cause: the pool was never ended, so its sockets keep the event loop alive. Fix: `await pool.end()` in a `finally`. `allowExitOnIdle: true` is a second, blunter option — it lets Node's event loop exit with idle clients still socket-open — and it is appropriate for scripts and tests, never for a server.

**★ Symptom: `end()` was added to a route handler "for symmetry" and every request got slower.** Cause: ending the pool per request destroys the thing the singleton preserves, so every request pays a full handshake. Fix: a long-running server never ends its pool. `end()` belongs to scripts, which must let the process exit, and to nothing else.

**★ Symptom: the leak reappeared after a refactor that moved the schema import.** Cause: the database module's dependency graph changed, so a file that previously did not trigger its re-evaluation now does — HMR walks downstream of the change. Fix: the singleton makes this irrelevant, which is exactly why the fix belongs at the pool rather than in a rule about which files you edit.

## Interview questions

**★ Why does the `globalThis` trick work, when caching in a module-level variable does not?**
Because the unit hot module replacement operates on is the module. When your file is re-evaluated, everything declared inside it is constructed again — including a variable you intended as a cache, which is inside the thing being replaced. `globalThis` is not part of the module graph at all; it belongs to the realm, and HMR has no reason to touch it. So the stash is the one place in the process that survives a reload of the file that reads it. The corollary is that it survives *only* a reload: a full process restart clears it, which is correct, because a restart also closes the old sockets.

**★ Why is the assignment guarded by `NODE_ENV` when the read is not?**
Because the two have different purposes. The read is free and harmless everywhere — in production the key is never set, so it always falls through to constructing the pool. The assignment is what turns `globalThis` into a cache, and in production that cache would hide information: if something did construct the module twice, you would want that to show up as two pools and a connection count you can investigate, not as one pool and a silently swallowed bug. Guarding the write keeps the workaround scoped to the mechanism it exists for, which is a good general property for workarounds to have.

**★ Does the singleton help with serverless connection exhaustion?**
No, and conflating the two is common. The singleton makes one *process* hold one pool across module reloads. Serverless exhaustion is `instances × max`, and every instance is a separate process with a separate `globalThis`. So the singleton takes the per-process count from "one per reload" down to one, which is exactly what you want in development, and leaves the per-deployment count entirely alone. The escapes for that are architectural: a transaction-mode pooler, a sessionless HTTP transport, or fewer and longer-lived processes.

**★ Should a Route Handler ever call `pool.end()`?**
No. `end()` drains and closes the pool, which is correct for a script that must let the process exit and wrong for anything serving requests — it destroys the reuse the pool exists to provide, so every subsequent request pays a full handshake, and you have kept all of pooling's complexity while discarding its only benefit. The place `end()` belongs is a `finally` in a seed script, a migration runner, or a one-shot job, alongside `max: 1`. If you want a script to exit without explicitly ending, `allowExitOnIdle: true` lets the event loop drain with idle clients still socket-open, which is a reasonable default for tests.

**★ What is the failure mode of a shared development database, beyond this leak?**
That one person's local behaviour becomes everyone's environment. The connection leak is the visible version, but the same structure produces schema drift when somebody runs `push` against it, data confusion when two people seed it differently, and a migration that passes locally because a column happened to be there from an experiment. The leak is worth fixing on its own merits; the shared database is worth removing because it makes every local action a shared action. Per-developer branch databases turn all of those from coordination problems into nothing at all, which is why they are worth the setup cost.

**★ How would you make it impossible for a second module to construct a pool?**
By removing the alternative rather than documenting it. One `server-only` module constructs the pool and exports the Drizzle instance; it does not re-export the pool. Then a lint rule forbids importing `pg` and `@neondatabase/serverless` from anywhere outside `lib/db/`, so a `new Pool()` written in a route file is a lint error rather than something a reviewer has to spot. That is the same enforcement the Data Access Layer uses for the same reason — a convention degrades with team size, and an import error does not — and it is why this gotcha and topic 04 are really one rule seen from two angles.

---

← [03b · The arithmetic, three escapes](03b-the-arithmetic-and-the-three-escapes.md) · [Chapter 16 overview](01-explanation.md) · Next → [03d · What does not survive the pooler](03d-what-does-not-survive-the-pooler.md)
