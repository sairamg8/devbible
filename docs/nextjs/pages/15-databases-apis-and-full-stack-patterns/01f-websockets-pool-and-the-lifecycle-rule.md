---
title: "The WebSocket transport buys back the session — and with it every lifecycle rule the HTTP driver let you forget, inverted: here the pool must NOT live at module scope"
sidebar_label: "01f · WebSockets and lifecycle"
sidebar_position: 105
description: "`Pool` and `Client` over WebSockets, why `neonConfig.webSocketConstructor` must be assigned before the first pool, the rule that a WebSocket cannot outlive a request, and how Prisma and Drizzle wire onto it."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Neon · Neon serverless driver](https://neon.com/docs/serverless/serverless-driver) (Pool and Client usage notes), [Neon · Choosing your connection method](https://neon.com/docs/connect/choose-connection) and [`node-postgres` · `pg.Pool`](https://node-postgres.com/apis/pool).
> Documentation-verified; **no sandbox run**.
> Target: **`@neondatabase/serverless` 1.1.0** · **Next.js 16.3.4** · Prisma **7.10.0** · `drizzle-orm` **0.45.2** · Node 24.20.0.

**Everywhere else in this topic the advice is "put the client at module scope so it is created once per process". For the WebSocket transport that advice is exactly wrong, and Neon says so in as many words: a WebSocket connection cannot outlive a single request, so the `Pool` must be created, used and closed inside the handler. This is the one page in the topic where the correct pattern is a per-request pool — and understanding *why* is what stops you from applying the rule where it does not belong.**

## What the WebSocket transport gives you

> *"The `Pool` and `Client` constructors, provide session and transaction support, as well as `node-postgres` compatibility. You can find the API guide for the `Pool` and `Client` constructors in the node-postgres documentation."*
> — [Neon · Neon serverless driver](https://neon.com/docs/serverless/serverless-driver)

Neon lists three reasons to choose it, verbatim:

> *"You already use `node-postgres` in your code base and would like to migrate to using `@neondatabase/serverless`."*
> *"You are writing a new code base and want to use a package that expects a `node-postgres-compatible` driver."*
> *"Your backend service uses sessions / interactive transactions with multiple queries per connection."*

and the swap is genuinely a one-line import change:

> *"Where you usually import `pg`, import `@neondatabase/serverless` instead."*

The third bullet is the one with teeth. An **interactive** transaction is the thing HTTP cannot express: read a row, evaluate it in JavaScript, then decide what to write, all inside one `BEGIN`/`COMMIT`.

## The WebSocket constructor

```ts
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

// Must run before the first Pool is constructed — so it belongs at module top
// level, not inside a handler.
neonConfig.webSocketConstructor = ws
```

> *"In Node.js and some other environments, there's no built-in WebSocket support. In these cases, supply a WebSocket constructor function."*

Drizzle's documentation adds the second package people forget:

> *"Additional configuration is required to use WebSockets in environments where the `WebSocket` global is not defined, such as Node.js. Add the `ws` and `bufferutil` packages to your project's dependencies, and set `ws` in the Drizzle config."*
> — [Drizzle · `<>` Neon Postgres](https://orm.drizzle.team/docs/pg/connect-neon)

## 🔴 The lifecycle rule

> *"In serverless environments such as Vercel Edge Functions or Cloudflare Workers, WebSocket connections can't outlive a single request. That means `Pool` or `Client` objects must be connected, used and closed within a single request handler. Don't create them outside a request handler; don't create them in one handler and try to reuse them in another; and to avoid exhausting available connections, don't forget to close them."*
> — [Neon · Neon serverless driver](https://neon.com/docs/serverless/serverless-driver)

Neon repeats it in the pitfalls table of the connection-method guide, which is a fair signal of how often it is got wrong:

> *"Create, use, and close `Pool` or `Client` objects **within the same request handler**. Do not create them outside a handler or reuse them across handlers."*

Three separate instructions are packed in there and each one fails differently:

| Instruction | What happens if you ignore it |
|---|---|
| Do not create outside a handler | The socket is torn down between invocations. The next request finds a dead pool and fails — intermittently, because a warm instance sometimes still has a live one. |
| Do not reuse across handlers | Same, plus a shared mutable object across concurrent requests. |
| Do not forget to close | One leaked WebSocket per request until you exhaust `max_client_conn`. |

```ts
// app/api/board/[id]/route.ts — WebSocket Pool, correctly scoped to one request.
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

neonConfig.webSocketConstructor = ws

export async function POST(_req: Request, ctx: RouteContext<'/api/board/[id]'>) {
  const { id } = await ctx.params
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const client = await pool.connect()
    try {
      // The interactive transaction HTTP cannot express: read, branch, write.
      await client.query('BEGIN')
      const { rows } = await client.query(
        'SELECT status FROM boards WHERE id = $1 FOR UPDATE',
        [id]
      )
      if (rows[0]?.status === 'archived') {
        await client.query('ROLLBACK')
        return Response.json({ error: 'archived' }, { status: 409 })
      }
      await client.query('UPDATE boards SET touched_at = now() WHERE id = $1', [id])
      await client.query('COMMIT')
    } finally {
      client.release()
    }
    return Response.json({ ok: true })
  } finally {
    await pool.end() // 🔴 not optional
  }
}
```

Note the **two** nested `finally` blocks. `client.release()` returns the client to the pool; `pool.end()` closes the pool. Neither substitutes for the other, and the `pg` documentation is emphatic about the inner one: *"You must always return the client to the pool if you successfully check it out, regardless of whether or not there was an error."*

⚠️ **`pool.end()` must be awaited before the response resolves, or scheduled on a platform primitive that keeps the invocation alive.** Neon's Cloudflare and Vercel edge examples use `ctx.waitUntil(pool.end())` for exactly this reason. In a Next.js Route Handler on the Node runtime there is no `ctx` argument, so `await pool.end()` in a `finally` is the honest version — you pay a few milliseconds of teardown inside the request rather than gambling that the runtime finishes a floating promise.

## Wiring the ORMs onto it

Because the transport is `node-postgres`-compatible, both ORMs take it unchanged.

```ts
// Drizzle over WebSockets
import { drizzle } from 'drizzle-orm/neon-serverless'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

neonConfig.webSocketConstructor = ws

export function makeDb() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return { db: drizzle({ client: pool }), close: () => pool.end() }
}
```

```ts
// Prisma over WebSockets — Neon's own example, with the adapter package.
import { Pool, neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@prisma/client'
import ws from 'ws'

neonConfig.webSocketConstructor = ws

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaNeon(pool)
const prisma = new PrismaClient({ adapter })
```

⚠️ **Prisma's example is written for a script, not for a serverless handler.** It constructs the pool at module scope, which is right for a long-lived process and wrong under the lifecycle rule above. Neon's own Drizzle-on-Cloudflare example does the opposite and calls `ctx.waitUntil(pool.end())`. When two vendor snippets disagree, the one that matches your runtime wins — and the runtime question is "does this process survive between requests".

## HTTP or WebSocket, per operation

The choice is not per application. It is per unit of work, and a healthy codebase uses both.

| Reach for | When |
|---|---|
| `neon()` over HTTP ([01e](01e-the-http-driver-and-one-shot-queries.md)) | Reads and single-statement writes. Nothing to leak, nothing to close. The default for a Server Component fetching a page's data. |
| WebSocket `Pool` | An interactive transaction, `SELECT … FOR UPDATE` then branch, a transaction-scoped advisory lock, or a library that insists on `pg` semantics. Scoped to one handler, always `end()`ed. |
| Plain `pg` on the pooled endpoint ([01b](01b-the-three-kinds-of-pool.md)) | Warm or fluid compute where a long-lived process makes a persistent pool worth having. |

```ts
// lib/db/index.ts — both, deliberately.
import 'server-only'
import { neon, Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

neonConfig.webSocketConstructor = ws

/** Reads and one-shot writes. Stateless, safe at module scope. */
export const sql = neon(process.env.DATABASE_URL!)

/** Interactive transactions only. MUST be closed by the caller. */
export async function withSession<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    return await fn(pool)
  } finally {
    await pool.end()
  }
}
```

That `withSession` helper is the whole discipline in eight lines: the expensive, leak-prone thing can only be obtained through a function that closes it for you.

## Gotchas

**★ Symptom: a WebSocket `Pool` created at module scope works in development and fails intermittently in production.** Cause: Neon's rule — WebSocket connections *"can't outlive a single request"* — so a module-scope pool holds a socket that the platform tears down between invocations, and the next request finds it dead. It works in `next dev` because that is one long-lived process. Fix: create and `end()` the pool inside the handler.

```ts
export async function POST(request: Request) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    return await handle(request, pool)
  } finally {
    await pool.end()
  }
}
```

**★ Symptom: `WebSocket is not defined`, or `bufferutil` warnings, on Node.** Cause: no global `WebSocket` constructor in that runtime configuration. Fix: install `ws` (and `bufferutil`, per Drizzle's note) and assign the constructor at module top level — it must run before the first `Pool` is constructed, so putting it inside the handler is a race you will lose exactly once.

```ts
import { neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
neonConfig.webSocketConstructor = ws
```

**★ Symptom: connection count climbs steadily until `no more connections allowed (max_client_conn)`, one per request.** Cause: a per-request pool that is never `end()`ed. Every handler invocation opens a WebSocket and abandons it. Fix: `finally { await pool.end() }`, without exception — including on the error paths and the early returns.

```ts
// 🔴 The early return skips end().
const pool = new Pool({ connectionString: url })
if (!authorized) return Response.json({ error: 'nope' }, { status: 403 })
await pool.end()

// ✅ finally runs on every exit, including early returns and throws.
const pool2 = new Pool({ connectionString: url })
try {
  if (!authorized) return Response.json({ error: 'nope' }, { status: 403 })
  return await handle(pool2)
} finally {
  await pool2.end()
}
```

**★ Symptom: `pool.end()` was scheduled but the connection still leaked.** Cause: a floating promise. `pool.end()` returns a promise; if you neither `await` it nor hand it to a platform keep-alive primitive, the runtime may freeze the instance before it resolves. Fix: `await` it, or on a platform that offers one, use the equivalent of `ctx.waitUntil(pool.end())` as Neon's edge examples do.

**★ Symptom: a transaction's statements land on different connections despite using a pool.** Cause: `pool.query()` dispatches each call to any idle client — *"The pool will dispatch every query passed to pool.query on the first available idle client"* — so `BEGIN`, `UPDATE` and `COMMIT` can be split. Fix: check out one client with `pool.connect()` and run the whole transaction on it.

**★ Symptom: you copied Prisma's Neon example into a Route Handler and it leaks.** Cause: the example is written for a long-lived script and puts the `Pool` at module scope. Fix: build the adapter per request in a serverless handler, or use the HTTP-shaped path if the operation does not need a session.

```ts
export async function POST(request: Request) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter: new PrismaNeon(pool) })
  try {
    return await handle(request, prisma)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}
```

**★ Symptom: an interactive transaction holds a pooled server connection for the length of an external API call.** Cause: the session transport made a long transaction *possible*, and nothing stops you from putting a `fetch` inside it. Behind Neon's transaction-mode PgBouncer that pins one of a few hundred server connections. Fix: the same rule as everywhere — transactions contain only database work. Read, commit, call, then a second short transaction to write.

**★ Symptom: `SELECT … FOR UPDATE` blocks forever under load.** Cause: row locks are held for the whole transaction, so any slowness inside the transaction body multiplies into lock waits for everyone else. Fix: keep the locked section minimal, and prefer `FOR UPDATE SKIP LOCKED` for queue-style claims so contenders move on rather than queueing. See [PostgreSQL · `SKIP LOCKED`](../../../postgresql/pages/phase-11-mvcc/08-skip-locked.md).

```ts
const { rows } = await client.query(
  `SELECT id FROM jobs WHERE status = 'queued'
     ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`
)
```

## Interview questions

**★ Why is "put the client at module scope" right for `pg` and wrong for the Neon WebSocket driver?**
Because the two are betting on different things surviving. A `pg` pool at module scope bets that the *process* outlives the request, which is true on a server and often true on warm serverless — and if the socket dies, the pool detects it and replaces the client. A Neon WebSocket bets that the *socket* survives, and Neon states flatly that it cannot outlive a single request in a serverless environment. So the module-scope version holds an object that is dead by the time the next request arrives, and it fails intermittently rather than consistently, because a sufficiently warm instance sometimes still has a live connection. That intermittency is what makes it survive code review and reach production.

**★ When is the WebSocket transport the right choice over HTTP, and what does it cost you?**
When you need a session inside one request: an interactive transaction, `SELECT … FOR UPDATE` followed by application logic, a transaction-scoped advisory lock, or a library that expects `pg`'s `Pool`/`Client` API. It costs you the connection lifecycle back — the pool must be created, used and closed inside the handler, and forgetting the `end()` leaks a connection per request until you exhaust the pooler's client limit. It also costs the extra round trips that made HTTP attractive for one-shot reads. The rule of thumb is per-operation, not per-application: `neon()` for the reads, a scoped WebSocket pool for the two or three writes that genuinely need a session.

**★ You have a per-request pool and an early `return` for an unauthorised caller. What is the bug?**
The `pool.end()` after the return never runs, so every rejected request leaks a WebSocket. It is the exact same class of bug as a missing `client.release()`, and it is more likely here because the leak is on the *error* path, which is the path least covered by tests and least exercised in development. The fix is structural rather than disciplinary: wrap the body in `try`/`finally`, or better, never hand callers a raw pool — expose a `withSession(fn)` helper that owns construction and teardown, so there is no code path in which a caller can forget.

**★ Prisma's Neon example and Neon's Cloudflare example disagree about where the pool goes. Which is right?**
Both, for their own runtime, and that is the point. Prisma's snippet is a Node script with a `main()` — a long-lived process where module scope is correct and `$disconnect()` at the end is enough. Neon's Cloudflare snippet is a request handler in a runtime that discards the isolate, so it constructs per request and calls `ctx.waitUntil(pool.end())`. Copying either into the wrong context produces a leak or a dead socket. The question to ask of any database snippet is "what does this assume about process lifetime", and vendor documentation frequently does not say, because the author knew which runtime they were in.

**★ Does using a WebSocket pool let you skip Neon's pooled endpoint?**
No, and conflating the two is common. The WebSocket transport changes how *your process* reaches Neon's proxy; it does not change how many Postgres backend processes exist or how they are shared. You still choose between the `-pooler` hostname and the direct one, and you still want the pooled one for request traffic because the exhaustion arithmetic is unchanged. What the WebSocket transport buys is a session across statements within one request; what PgBouncer buys is many clients sharing few backends. They are orthogonal, and the fact that both are called "pooling" in casual conversation is precisely why [01b](01b-the-three-kinds-of-pool.md) separates them by layer.

**★ What does `client.release()` do that `pool.end()` does not, and vice versa?**
`release()` returns one checked-out client to the pool so another part of the same request can use it; the connection stays open. `end()` drains the pool and closes every connection, after waiting for checked-out clients to come back. In a per-request pool you need both: `release()` so the transaction's client is not still checked out when you try to drain, and `end()` so the socket does not leak. Skipping `release()` and calling only `end()` makes `end()` wait for a client that will never be returned, which turns a leak into a hang — the worst possible upgrade.

---

← [01e · The HTTP driver](01e-the-http-driver-and-one-shot-queries.md) · Next → [01g · Prisma: client and adapters](01g-prisma-the-generated-client-and-driver-adapters.md)
