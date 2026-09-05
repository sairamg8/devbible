---
title: "Two consecutive queries with no BEGIN between them are two transactions, and a transaction-mode pooler is free to run them on two different backends — so every feature that stores something on the server between statements silently stops working, non-deterministically, under load and not in development"
sidebar_label: "03d · What the pooler removes"
sidebar_position: 21
description: "Why a bare statement is its own transaction, Neon's verbatim list of what stops working, the three fixes for SET in preference order, the two mechanisms the phrase prepared statement covers and why only one survives, and what after() does to a connection once the response has already gone."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Neon · Connection pooling](https://neon.com/docs/connect/connection-pooling), [Neon · Choosing your connection method](https://neon.com/docs/connect/choose-connection), the [PostgreSQL 18 `PREPARE` reference](https://www.postgresql.org/docs/18/sql-prepare.html), [PostgreSQL 18 · `set_config`](https://www.postgresql.org/docs/18/functions-admin.html) and [Next.js · `after`](https://nextjs.org/docs/app/api-reference/functions/after) (`version: 16.3.4`, `lastUpdated: 2026-03-13`).
> Target: **PostgreSQL 18.4** · `pg` **8.23.0** · `drizzle-orm` **0.45.2** · **Next.js 16.3.4** · Node **24.20.0**.
> Documentation-verified; **no sandbox run, no timings**. Neon's unsupported-feature list and the `PREPARE` semantics are quoted verbatim.

**The pooled endpoint from [03b](03b-the-arithmetic-and-the-three-escapes.md) is not a faster version of the direct one; it is a different set of guarantees. In transaction mode a client holds a backend from `BEGIN` to `COMMIT` and nothing in between, which is where the entire capacity gain comes from and where the entire breakage comes from — the same fact seen from two sides. The subtlety that catches everyone is that a bare statement with no explicit transaction *is* a transaction, so two `await db.execute(...)` calls in a row are two transactions and can land on two different backends, with nothing in your code mentioning transactions or connections at all.**

## The unit of assignment

| Mode | Client keeps a backend for | Capacity gain |
|---|---|---|
| **Session** | the whole connection | Small — you save handshakes, backend count still tracks client count |
| **Transaction** | `BEGIN` → `COMMIT`/`ROLLBACK` | Large — idle clients hold no backend at all |

Neon runs transaction mode and does not let you change it:

> *"Neon uses PgBouncer in transaction mode (`pool_mode=transaction`), which means connections are returned to the pool after each transaction completes."*
> — [Neon · Connection pooling](https://neon.com/docs/connect/connection-pooling)

Now the sentence that generates every bug in this page: **a statement outside an explicit transaction is its own implicit transaction.** So

```ts
await db.execute(sql`SET search_path TO app`)          // transaction 1 → backend A
const rows = await db.select().from(cards).limit(10)   // transaction 2 → backend B
```

is two transactions. The `SET` applied to backend A and was gone the moment its implicit transaction committed. Nothing in that code says "transaction", nothing says "connection", and the failure is invisible in the source.

🔴 **It is also non-deterministic.** At low concurrency — which is to say, in development — the pooler will usually hand back the same backend, so the second statement sees the first's state and everything works. It fails under load. That is the worst possible test signal, which is why this belongs in your head rather than in an integration suite.

## The list, verbatim

Neon publishes it. Quoted exactly, because a paraphrase of this is where people lose an afternoon:

> **Not supported with pooled connections:**
> - `SET` / `RESET` (session variables)
> - `LISTEN` / `NOTIFY`
> - `WITH HOLD CURSOR`
> - `PREPARE` / `DEALLOCATE` (SQL-level prepared statements)
> - Temporary tables with `PRESERVE` / `DELETE ROWS`
> - `LOAD` statement
> - Session-level advisory locks

Look at what they have in common: **each stores something on the backend process and expects to find it there on the next statement.** Transaction mode is the explicit refusal of that expectation. It is not that PgBouncer forbids `SET`; it is that `SET` succeeds and then the state evaporates.

Neon's own worked example is the clearest statement of the shape:

```sql
SET search_path TO myschema;
SELECT * FROM mytable;  -- Works in this transaction
-- Transaction ends, connection returns to pool
SELECT * FROM mytable;  -- ERROR: relation "mytable" does not exist
```

## The three fixes for `SET`, in preference order

**1 — Put it on the role.** Applies at every session start, on every backend, forever.

```sql
ALTER ROLE sprintdesk_app SET search_path TO app, public;
```

**2 — Qualify everything explicitly.** Verbose, and immune to the problem existing.

```ts
await db.execute(sql`SELECT id, title FROM app.cards WHERE board_id = ${boardId}`)
```

**3 — If the setting is genuinely per-request, it must live *inside* the transaction that consumes it.** That is the only window in which the backend is yours, and `set_config(..., true)` is transaction-local, which is exactly the scope you want.

```ts
// The one correct shape for per-request session state behind a transaction pooler.
await db.transaction(async (tx) => {
  // `true` = local to this transaction. It disappears at COMMIT, which is the point:
  // the next tenant to be handed this backend cannot inherit it.
  await tx.execute(sql`SELECT set_config('app.current_team', ${teamId}, true)`)
  return tx.select().from(cards).where(eq(cards.boardId, boardId))
})
```

🔴 **The `true` is load-bearing and the failure mode of `false` is a cross-tenant leak.** A session-scoped `set_config` behind a transaction pooler sets a value on a backend that is then handed to somebody else's request. That is the mechanism behind row-level-security setups that work in testing and leak in production — the isolation predicate reads a GUC that the previous request set. [15 · 10c](../15-databases-apis-and-full-stack-patterns/10c-tenant-isolation-in-the-data-access-layer.md) covers the tenancy version of this in full.

## "Prepared statement" is two mechanisms and only one survives

This is the most misdiagnosed error in serverless Postgres, and the reason is that one phrase covers two unrelated things.

**Mechanism one — SQL-level `PREPARE`, a named object owned by a session.**

> *"Prepared statements only last for the duration of the current database session. When the session ends, the prepared statement is forgotten, so it must be recreated before being used again. This also means that a single prepared statement cannot be used by multiple simultaneous database clients; however, each client can create their own prepared statement to use."*
> — [PostgreSQL 18 · `PREPARE`](https://www.postgresql.org/docs/18/sql-prepare.html)

Session-scoped, name-addressed, in a namespace owned by the session. Two things follow immediately: a client that prepares `s0` and returns to a *different* backend finds no `s0`; a client that prepares `s0` on a backend where somebody else already prepared `s0` collides. Which is why it is on Neon's unsupported list, stated as a rule:

> *"SQL-level `PREPARE` and `EXECUTE` statements are not supported with PgBouncer. You must use protocol-level prepared statements through your database driver."*

**Mechanism two — the extended query protocol.** Parse → Bind → Execute, where the driver names the statement at the protocol level without ever sending the SQL keyword `PREPARE`. PgBouncer learned to track and replay those:

> *"PgBouncer supports protocol-level prepared statements (as of PgBouncer 1.22.0), which can improve query performance and security."*

Neon bounds how many, in its published fixed configuration: `max_prepared_statements=1000`, described as *"Maximum protocol-level prepared statements per connection."*

In `pg` you opt into the second mechanism by giving the query object a `name`:

```ts
// Protocol-level. Pooler-safe on PgBouncer 1.22+.
await pool.query({
  name: 'card-by-id',
  text: 'SELECT id, title, status FROM cards WHERE id = $1',
  values: [cardId],
})
```

⚠️ **Do not confuse parameterisation with preparation.** `pool.query('SELECT … WHERE id = $1', [cardId])` is parameterised and *not* prepared: values travel out of band, so it is fully safe against injection, and there is no named object anywhere, so it is pooler-neutral. Parameterisation is the security control; preparation is a performance optimisation you can give up. Anyone keeping a pooler-hostile setting "for SQL injection safety" has confused the two. The full treatment is [15 · 01d](../15-databases-apis-and-full-stack-patterns/01d-prepared-statements-under-a-pooler.md).

⚠️ **Whether `drizzle-orm` 0.45.2's `.prepare(name)` emits a protocol-level named statement through `node-postgres` in every configuration is not something I could settle from its published documentation**, and the published Drizzle docs currently describe the 1.0 release candidate rather than 0.45.2. Treat prepared-statement behaviour behind a pooler as something to confirm against your own driver version rather than something to assume.

## `after()`, and a connection you thought was finished

`after` schedules work to run once the response is gone. It is the right tool for logging, analytics and cheap follow-up writes, and it interacts with connections in ways that are worth stating explicitly.

> *"`after` allows you to schedule work to be executed after a response (or prerender) is finished. This is useful for tasks and other side effects that should not block the response, such as logging and analytics."*

> *"`after` will run for the platform's default or configured max duration of your route."*

> *"`after` will be executed even if the response didn't complete successfully. Including when an error is thrown or when `notFound` or `redirect` is called."*
> — [Next.js · `after`](https://nextjs.org/docs/app/api-reference/functions/after)

And the mechanism on a serverless platform, from the same page:

> *"Using `after` in a serverless context requires waiting for asynchronous tasks to finish after the response has been sent. In Next.js and Vercel, this is achieved using a primitive called `waitUntil(promise)`, which extends the lifetime of a serverless invocation until all promises passed to `waitUntil` have settled."*

Four consequences for a database connection:

**1 · The instance stays alive, so the connection stays held.** `waitUntil` *extends the lifetime of the invocation*. A query in `after()` therefore lengthens the window in which this instance is counted against `instances × max`, and if it is inside a transaction it pins a backend out of `default_pool_size` — after the client has already been told the request succeeded. The whole latency benefit is on the client's side; the database sees the same load, later.

**2 · A failure in `after()` has no response to report it on.** The status code has already been sent. Anything in an `after` callback must therefore be either idempotent-and-retried elsewhere, or acceptable to lose. It is not a queue, and [15 · 04b](../15-databases-apis-and-full-stack-patterns/04b-after-and-waituntil-are-not-a-queue.md) is the full argument for why.

**3 · It runs even on the failure paths** — *"even if the response didn't complete successfully… including when an error is thrown"* — so a callback that assumes the mutation succeeded is wrong. Capture the outcome and branch on it.

**4 · Nothing about `after()` makes a closed connection usable.** If a handler `end()`s a client in its `finally` and then an `after` callback queries the same client, the callback fails after the response has gone, which is a failure nobody sees. Never `end()` a pool in a handler ([03c](03c-the-dev-hot-reload-leak.md)); never hand a per-request `Client` to an `after` callback.

```ts
// app/api/cards/[cardId]/route.ts — the shape that is safe.
import { after } from 'next/server'
import { db } from '@/lib/db'          // module-scope pool. NOT ended anywhere.
import { deleteCard } from '@/lib/dal/cards'
import { auditLog } from '@/db/schema'

export async function DELETE(_req: Request, ctx: RouteContext<'/api/cards/[cardId]'>) {
  const { cardId } = await ctx.params
  let ok = false
  try {
    await deleteCard(cardId)
    ok = true
    return new Response(null, { status: 204 })
  } finally {
    // Runs on both paths, so record what actually happened.
    after(async () => {
      await db.insert(auditLog).values({ kind: 'card.delete', cardId, ok })
    })
  }
}
```

⚠️ **In a Server Component the rules are different**, and this catches people moving code between the two: *"Server Components (including pages, layouts, and `generateMetadata`) **cannot** use `cookies`, `headers`, or other Request-time APIs inside `after`"*, and *"Calling `cookies()` or `headers()` inside the `after` callback in a Server Component will throw a runtime error."* Read the values before the callback and close over them. In Route Handlers and Server Functions you may call them directly inside the callback.

## Gotchas

**★ Symptom: `relation "mytable" does not exist` for a table that plainly exists.** Cause: a `SET search_path` in one implicit transaction and the query in the next, on a different backend. Fix: `ALTER ROLE … SET search_path`, or qualify the schema in the query. Never a bare `SET` on the request path.

**★ Symptom: it works locally every time and fails in production some of the time.** Cause: at low concurrency the pooler usually returns the same backend, so session state appears to persist. Under load it does not. Fix: treat any reliance on cross-statement session state as a bug regardless of whether your tests catch it — the test environment is structurally incapable of reproducing it.

**★ Symptom: a tenant sees another tenant's rows, intermittently, with correct-looking RLS policies.** Cause: `set_config('app.tenant', …, false)` — session scope — behind a transaction pooler, so the value persisted on a backend that was then handed to a different request. Fix: `true` for transaction-local scope, and the `set_config` must be inside the same explicit transaction as the query that reads it.

**★ Symptom: `prepared statement "s0" already exists`.** Cause: SQL-level `PREPARE`, or a driver using session-named statements, colliding on a backend where another client already used that name. It is a *collision*, not a miss, which is why the message is confusing. Fix: protocol-level prepared statements through the driver, which PgBouncer 1.22+ tracks — or no preparation at all, which costs planning time and nothing else.

**★ Symptom: someone refuses to disable prepared statements because of SQL injection.** Cause: parameterisation and preparation conflated. Parameterisation sends values out of band and is the injection defence; preparation is a named plan cache and is a performance optimisation. Fix: keep parameterised queries, drop the preparation, and note that `pool.query(text, values)` with no `name` is already the safe form.

**★ Symptom: `LISTEN` produces no notifications on the pooled endpoint.** Cause: `LISTEN`/`NOTIFY` is session-scoped and appears on Neon's unsupported list. A listener whose backend is returned to the pool is not listening. Fix: the direct endpoint, from a long-lived process — which means a worker, not a request handler ([15 · 04fa](../15-databases-apis-and-full-stack-patterns/04fa-listen-notify-and-the-latency-floor.md)).

**★ Symptom: a session-level advisory lock is taken and immediately not held.** Cause: session-level advisory locks are on the unsupported list for the same reason. Fix: transaction-level advisory locks, taken and released within one explicit transaction, which is the only lock scope a transaction pooler can honour.

**★ Symptom: `after()` work never runs on one deployment target and runs everywhere else.** Cause: the platform support matrix — `after` is supported on a Node.js server and in Docker, is **not** supported for static export, and is platform-specific for adapters, because it needs a `waitUntil` implementation. Fix: check the target before relying on it, and treat anything that must not be lost as a queued job rather than an `after` callback.

**★ Symptom: latency improved and database load did not.** Cause: work was moved into `after()`, which moves it off the response and not off the instance — `waitUntil` *"extends the lifetime of a serverless invocation"*, so the connection is held for longer, not less. Fix: if the goal is to reduce database load rather than response time, the work has to leave the request entirely, into a job a worker claims.

**★ Symptom: an `after` callback threw and nothing was logged anywhere.** Cause: the response was already sent, so there is no status code to carry the failure and no client to report it to. Fix: wrap the callback body in its own try/catch with explicit logging, and never put anything in `after()` whose loss you would consider an incident.

**★ Symptom: an `after` callback in a page throws when it calls `headers()`.** Cause: in Server Components request-time APIs are unavailable inside the callback because *"`after` runs after React's rendering lifecycle"*. Fix: read the values during render and close over them. In a Route Handler the same code is legal, which is exactly why the mistake happens when code is moved.

## Interview questions

**★ Why can two consecutive queries see different session state when your code contains no transaction?**
Because a statement outside an explicit transaction is still a transaction — Postgres runs it in an implicit one — and a transaction-mode pooler assigns a backend per transaction. So two `await`ed queries are two transactions and may be served by two different backends. Nothing in the source mentions transactions or connections, which is precisely why the bug is hard to see: the code reads as two operations against "the database", and the pooler's contract is that "the database" is not a single process between them. The rule that falls out is that anything which must share a backend has to be inside one explicit transaction, and anything which merely *appears* to share one is a latent failure.

**★ Why is this class of bug worse than a bug that always fails?**
Because it passes every test you would think to write. At low concurrency the pooler usually returns the same backend, so session state appears to persist — which means development, CI and staging all confirm the incorrect model, and production disproves it only under load, intermittently, at whatever hour the traffic arrives. A deterministic failure is caught by the first person to run the code. This one is caught by a customer. That is the argument for treating the unsupported list as knowledge rather than as something your test suite will enforce.

**★ What is the correct way to carry per-request state, such as a tenant id, through a pooled connection?**
`set_config(name, value, true)` inside the same explicit transaction as the query that reads it. The `true` makes the setting transaction-local, so it is discarded at commit and cannot be inherited by whichever request is handed that backend next. The session-scoped form — `false`, or a bare `SET` — is a cross-tenant leak with no error message: the value survives on the backend, the pooler hands the backend to somebody else, and their query reads your tenant id. Everything else about the arrangement matters less than that boolean; the whole isolation property of an RLS-based design rests on it.

**★ What are the two things called "prepared statements" and which one works behind a pooler?**
SQL-level `PREPARE` creates a named object owned by a session — *"Prepared statements only last for the duration of the current database session"* — so a client returning to a different backend finds nothing under that name, and a client landing on a backend where another client used the same name collides. That is why the classic error is `already exists` rather than `does not exist`; it is a namespace collision, not a cache miss. Protocol-level statements are the extended query protocol's Parse/Bind/Execute, named by the driver rather than by SQL, and PgBouncer has tracked and replayed those since 1.22.0. So the second works and the first does not, and the practical instruction is to let the driver name statements rather than emitting `PREPARE` yourself.

**★ Does keeping prepared statements off make you vulnerable to SQL injection?**
No, and this confusion keeps pooler-hostile settings alive in production. Parameterisation is what defends against injection: the SQL text and the values travel separately, so a value can never be parsed as syntax, and that happens whether or not the statement is named. Preparation is a cached plan under a name, and its benefit is skipping repeated parse and plan work — a performance optimisation, and one that pays most for a long-lived session issuing many similar statements, which is exactly the workload least likely to be behind a transaction pooler. Dropping preparation costs planning time. It costs no safety at all.

**★ What does `after()` actually cost, given the response has already been sent?**
It costs the instance's lifetime. On a serverless platform `after` is implemented on top of `waitUntil`, which *"extends the lifetime of a serverless invocation until all promises passed to `waitUntil` have settled"* — so the instance stays alive, keeps its pool, and continues to count toward `instances × max`. Moving a database write into `after` therefore improves the client's latency and does not reduce database load; if anything it holds the connection longer, and if the callback opens a transaction it pins a backend out of the pooler's limited set after the client has already been told the request succeeded. If the goal is to shed load rather than to shed latency, the work has to leave the request entirely.

**★ What must never go in an `after()` callback?**
Anything whose loss would be an incident. The response is gone, so there is no status code to carry a failure, no client to retry, and — depending on the deployment target — no guarantee the callback runs at all, since `after` needs a `waitUntil` implementation and is unsupported for static export and platform-specific for adapters. It also runs on the failure paths, *"even if the response didn't complete successfully"*, so a callback that assumes the mutation committed is simply wrong unless it was given the outcome explicitly. The correct home for must-not-be-lost work is a row in a jobs table written inside the same transaction as the change that caused it, claimed later by a worker.

---

← [03c · The dev hot-reload leak](03c-the-dev-hot-reload-leak.md) · Next → [04 · The Data Access Layer](04-the-data-access-layer.md)
