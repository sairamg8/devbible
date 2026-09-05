---
title: "Transaction-mode pooling buys capacity by refusing to promise you the same backend twice, and every feature it breaks is a feature that assumed the promise"
sidebar_label: "01c · Transaction pooling"
sidebar_position: 3
description: "Session vs transaction pool mode, the exact list of what stops working, why a bare statement is its own transaction, and how to carry per-request state — search_path, RLS identity, advisory locks — through a pooler without leaking it to the next tenant."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Neon · Connection pooling](https://neon.com/docs/connect/connection-pooling), [Neon · Neon serverless driver](https://neon.com/docs/serverless/serverless-driver) (the RLS/JWT transaction example), and [Prisma 7 · Configure Prisma Client with PgBouncer](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/pgbouncer).
> Documentation-verified; **no sandbox run**. The unsupported-feature list is quoted verbatim.
> Target: **PostgreSQL 18.4** · **Next.js 16.3.4** · Prisma **7.10.0** · `pg` **8.23.0**.

**A pooler in *session* mode gives a client one backend for the life of its connection — it saves you handshakes and nothing else. A pooler in *transaction* mode gives a client a backend only from `BEGIN` to `COMMIT`, and hands the same backend to somebody else in between. That single change is where all the capacity comes from and where all the breakage comes from, and the two are the same fact seen from two sides. Every "it works locally and fails in production" database bug on Neon, Supabase or any PgBouncer deployment is a piece of code that assumed session continuity nobody promised it.**

## The two pool modes, stated precisely

| Mode | Unit of assignment | Client keeps a backend for | Capacity gain |
|---|---|---|---|
| **Session** | one client connection | the whole connection | Small. You save handshakes; the backend count still tracks client count. |
| **Transaction** | one transaction | `BEGIN` → `COMMIT`/`ROLLBACK` | Large. Idle clients hold no backend at all. |

Neon runs transaction mode and does not let you change it:

> *"Neon uses PgBouncer in transaction mode (`pool_mode=transaction`), which means connections are returned to the pool after each transaction completes."*
> — [Neon · Connection pooling](https://neon.com/docs/connect/connection-pooling)

Prisma requires it:

> *"For Prisma Client to work reliably, PgBouncer must run in **Transaction mode**. Transaction mode offers a connection for every transaction – a requirement for the Prisma Client to work with PgBouncer."*
> — [Prisma 7 · PgBouncer](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/pgbouncer)

Now the crucial subtlety: **a bare statement outside an explicit transaction is its own transaction.** So under transaction mode, two consecutive `pool.query()` calls with no `BEGIN` between them are two transactions and can land on two different backends. Nothing in your code says "transaction", nothing in your code says "different connection", and yet the second statement may not see the first one's session state. That is the whole class of bug.

## What stops working, exactly

Neon publishes the list. Quoted verbatim, because a paraphrase of this is where people lose an afternoon:

> **Not supported with pooled connections:**
> - `SET` / `RESET` (session variables)
> - `LISTEN` / `NOTIFY`
> - `WITH HOLD CURSOR`
> - `PREPARE` / `DEALLOCATE` (SQL-level prepared statements)
> - Temporary tables with `PRESERVE` / `DELETE ROWS`
> - `LOAD` statement
> - Session-level advisory locks

Look at what those have in common: each stores something **on the backend process** and expects to find it there on the next statement. Transaction mode is the explicit refusal of that guarantee. It is not that PgBouncer forbids `SET`; it is that `SET` succeeds and then the state evaporates.

Neon's own worked example is the clearest statement of the failure shape:

```sql
SET search_path TO myschema;
SELECT * FROM mytable;  -- Works in this transaction
-- Transaction ends, connection returns to pool
SELECT * FROM mytable;  -- ERROR: relation "mytable" does not exist
```

Note that this is **non-deterministic**. If the pooler happens to hand you back the same backend — likely at low concurrency, which is to say in development — the second `SELECT` works. It fails under load. That is the worst possible test signal, and it is why this belongs in your head rather than in your integration suite.

The prepared-statement entry on that list is the one that produces the most confusing errors, and it is a big enough subject to be its own page: [01d · Prepared statements under a pooler](01d-prepared-statements-under-a-pooler.md).

## The three fixes for `SET`, in order of preference

```sql
-- 1. Best: put it on the role. Applies at every session start, on every backend.
ALTER ROLE sprintdesk_app SET search_path TO app, public;
```

```ts
// 2. Qualify everything explicitly. Verbose, but immune.
await db.execute(sql`SELECT * FROM app.cards WHERE board_id = ${boardId}`)
```

```ts
// 3. If the setting is genuinely per-request, it must live INSIDE the transaction
//    that consumes it — that is the only window where the backend is yours.
//    set_config(..., true) is transaction-local, which is exactly what you want.
await db.transaction(async (tx) => {
  await tx.execute(sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`)
  return tx.select().from(cards) // RLS policies can now read app.current_tenant
})
```

That third pattern is the one that makes row-level security work behind a pooler, and it is the single most important block on this page if you are doing multi-tenancy — the `true` third argument makes the setting local to the transaction, so it cannot leak to the next tenant that borrows the backend. Neon uses exactly this shape in its RLS example:

> ```javascript
> const [, my_table] = await sql.transaction([
>   sql`SELECT set_config('request.jwt.claims', ${claims}, true)`,
>   sql`SELECT * FROM my_table`,
> ]);
> ```
> — [Neon · Neon serverless driver](https://neon.com/docs/serverless/serverless-driver)

Neon adds the constraint that makes the whole scheme meaningful rather than decorative:

> *"When using JWT self-verification with RLS, ensure your database connection string uses a role that does **not** have the `BYPASSRLS` attribute. Avoid using the `neondb_owner` role in your connection string, as it bypasses Row-Level Security policies."*

🔴 **`set_config(key, value, false)` behind a transaction pooler is a cross-tenant data leak waiting to happen.** The `false` makes it session-scoped; the session is shared; the next request on that backend inherits your tenant id. Tenant isolation in the DAL is [10c](10c-tenant-isolation-in-the-data-access-layer.md)'s subject, and the pooling constraint here is precisely why that page insists on a request-scoped predicate rather than a session variable. For the policy language itself, see [PostgreSQL · RLS policies](../../../postgresql/pages/phase-13-ops/14-rls/01-policies.md) and [carrying the identity](../../../postgresql/pages/phase-13-ops/14-rls/02-carrying-the-identity.md).

## The patterns that quietly assume a session

Three shapes show up constantly in Next.js codebases and all three are session-scoped.

```ts
// 🔴 Session-level advisory lock behind a transaction pooler.
// pg_advisory_lock is held by the *session*. The pooler may hand that backend
// to someone else, and your unlock may run on a different backend entirely.
await db.execute(sql`SELECT pg_advisory_lock(${hashKey})`)
await doWork()
await db.execute(sql`SELECT pg_advisory_unlock(${hashKey})`)

// ✅ Transaction-scoped variant: released automatically at COMMIT or ROLLBACK,
// and therefore correct under transaction pooling.
await db.transaction(async (tx) => {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${hashKey})`)
  await doWorkWith(tx)
})
```

```ts
// 🔴 Temp table created in one statement, read in the next.
await db.execute(sql`CREATE TEMP TABLE staging (id uuid, title text)`)
await db.execute(sql`INSERT INTO staging SELECT ...`)   // may be a different backend

// ✅ Everything inside one transaction, or use a CTE and skip the temp table.
await db.transaction(async (tx) => {
  await tx.execute(sql`CREATE TEMP TABLE staging (id uuid, title text) ON COMMIT DROP`)
  await tx.execute(sql`INSERT INTO staging SELECT ...`)
  await tx.execute(sql`INSERT INTO cards SELECT * FROM staging`)
})
```

```ts
// 🔴 LISTEN/NOTIFY for realtime. Cannot work through a transaction pooler at all:
// the LISTEN registration lives on a backend you do not own after COMMIT, and the
// failure is silent — the notification simply goes nowhere. This needs a direct
// connection on a long-lived process.
```

Cross-reference for the underlying Postgres semantics: [PostgreSQL · advisory locks](../../../postgresql/pages/phase-11-mvcc/15-advisory-locks.md), [PostgreSQL · PgBouncer pool modes](../../../postgresql/pages/phase-13-ops/07-pgbouncer/02-pool-modes.md) and [PostgreSQL · `LISTEN`/`NOTIFY`](../../../postgresql/pages/phase-7-pg-driver/14-listen-notify.md).

## Gotchas

**★ Symptom: `ERROR: relation "cards" does not exist` from a query that worked a moment ago.** Cause: `search_path` was set with `SET` on a pooled connection, the transaction ended, and the next statement landed on a backend with the default path. Fix: set it on the role, so it is applied at backend start rather than by your client.

```sql
ALTER ROLE sprintdesk_app SET search_path TO app, public;
```

**★ Symptom: a background job's advisory lock is never released, and every later run blocks.** Cause: `pg_advisory_lock` is session-scoped; behind a transaction pooler the unlock can execute on a different backend, leaving the original lock held until that backend is recycled. Fix: use `pg_advisory_xact_lock`, which the transaction releases for you at commit or rollback.

```ts
await db.transaction(async (tx) => {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${jobKey}))`)
  await runJob(tx)
}) // lock gone here, whatever happened
```

**★ Symptom: row-level security lets a request see another tenant's rows, intermittently.** Cause: the tenant id was published with `set_config(..., false)` — session scope — on a pooled connection, so it outlived the request and the next borrower of that backend inherited it. Fix: transaction-local scope, inside the same transaction as the reads.

```ts
export async function withTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`) // true = tx-local
    return fn(tx)
  })
}
```

**★ Symptom: RLS policies are in place, the identity is carried correctly, and every tenant still sees every row.** Cause: the connecting role bypasses RLS. Neon names the specific trap — `neondb_owner` has `BYPASSRLS`, and it is the role in the connection string the console hands you by default. Fix: connect as an application role that does not own the tables and does not bypass RLS.

```sql
CREATE ROLE sprintdesk_app LOGIN PASSWORD '...';
GRANT USAGE ON SCHEMA app TO sprintdesk_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO sprintdesk_app;
-- and verify: rolbypassrls must be false
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'sprintdesk_app';
```

**★ Symptom: `CREATE INDEX CONCURRENTLY` fails with a message about running inside a transaction block.** Cause: it cannot run inside a transaction, and a transaction pooler's unit of work *is* a transaction — and most migration runners wrap statements in one anyway. Fix: run it on the direct URL, outside the migration runner's transaction, as its own step.

```ts
// scripts/build-index.ts — direct URL, no wrapping transaction, run out of band.
import { Client } from 'pg'
const client = new Client({ connectionString: process.env.DATABASE_URL_DIRECT })
await client.connect()
await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_board_idx ON app.cards (board_id)')
await client.end()
```

**★ Symptom: two consecutive `pool.query()` calls disagree about session state, with no explicit transaction anywhere.** Cause: each bare statement is its own implicit transaction, so under transaction pooling consecutive statements are not guaranteed the same backend. There is no `BEGIN` in your code and that is exactly the point. Fix: if two statements must share a backend, wrap them in an explicit transaction — that is the only unit the pooler respects.

**★ Symptom: `LISTEN`/`NOTIFY`-based invalidation silently stops delivering in production.** Cause: `LISTEN` registers interest on a backend; transaction mode returns that backend to the pool at the end of the statement, so nobody is listening. There is no error — the notification just goes nowhere. Fix: a direct connection on a long-lived process, or a different transport entirely; [03 · Real-time SSE and WebSockets](03-real-time-server-sent-events-and-websockets-in-a-serverless.md) is the chapter's treatment of that problem in a serverless deployment.

**★ Symptom: a transaction that reads, calls an external API, then writes, holds the pool hostage under load.** Cause: transaction mode pins a backend for the whole transaction, so the external call's latency is charged against `default_pool_size`. Fix: split it — read, commit, call, then open a second short transaction to write, and make the write idempotent so a retry is safe.

```ts
const card = await db.select().from(cards).where(eq(cards.id, cardId)).then((r) => r[0])
const enrichment = await fetch(`https://api.example.com/enrich/${card.externalId}`).then((r) => r.json())
await db.update(cards).set({ enriched: enrichment }).where(eq(cards.id, cardId))
```

## Interview questions

**★ Explain transaction-mode pooling to someone who thinks a pooled connection is "just a connection".**
It is a lease, not a connection. In transaction mode, PgBouncer gives your client a real backend process only for the span of a transaction and takes it back at `COMMIT`; in between, your client holds nothing but a socket. That is what makes ten thousand mostly-idle clients affordable on a database that can host four hundred backends. The price is that every guarantee that lives on the backend — session variables, temp tables, `LISTEN` registrations, named prepared statements, session advisory locks — is now scoped to a transaction you did not know you were in, because a bare statement is its own transaction. So the mental model is: anything you "set up and then use later" is broken unless "later" is inside the same transaction.

**★ You need per-request row-level security through a pooled connection. How do you carry the identity safely?**
Set it inside the transaction that reads the data, with `set_config(key, value, true)` — the `true` makes it transaction-local, so it is discarded at commit whatever happens. Never `SET` it as a session variable and never pass `false`, because behind a transaction pooler the backend goes to another request with your value still on it, which is a cross-tenant read. The consequence for application structure is that the RLS-carrying transaction and the queries it protects must be the *same* transaction, which pushes you towards a data-access layer that owns the transaction boundary rather than scattering queries. Neon's JWT example does exactly this, and adds that the connecting role must not have `BYPASSRLS`, because otherwise the policies are decoration.

**★ Why is this class of bug so hard to catch in tests?**
Because it is concurrency-dependent and it fails *open* in the easy direction. At low concurrency a transaction pooler usually hands back the same backend, so a `SET` appears to persist, a temp table appears to survive, and a named statement appears to be unique — every one of those passes in development and in CI where you are the only client. They fail when a second client interleaves, which is production. Worse, some of the failures are silent rather than loud: a lost `LISTEN` produces no error, and a leaked session `set_config` produces *wrong data* rather than an exception. The only reliable defence is knowing the unsupported list and treating anything on it as a design constraint rather than something to test for.

**★ When would you deliberately choose session-mode pooling?**
When the workload genuinely needs session continuity and you would rather cap concurrency than rewrite it: a long-lived worker that uses `LISTEN`/`NOTIFY`, a reporting tool that emits `SET`, a migration runner, or a legacy client that depends on temp tables across statements. The trade is explicit — session mode barely improves your backend-to-client ratio, so you are using the pooler for handshake amortisation and failover, not for capacity. On a managed provider you often cannot make that choice at all: Neon's PgBouncer is fixed at `pool_mode=transaction` and *"These settings are not user-configurable."* There the answer is a direct connection for the session-shaped workload and the pooled endpoint for everything else, which is the two-URL split.

**★ Why does putting an external HTTP call inside a database transaction hurt so much more behind a pooler than on a direct connection?**
On a direct connection an open transaction costs you one backend that you already owned; the cost is idle-in-transaction bloat and blocked vacuum, which is bad but slow. Behind a transaction-mode pooler, the open transaction pins one of a small, globally shared set of server connections — on a 1 CU Neon compute, one of about 377 — for the duration of a network round trip you do not control. A third-party API having a bad minute is now a database outage for your whole application, because every other request queues behind the pinned connections and eventually hits `query_wait_timeout`. The fix is the same either way but the urgency is different: transactions must contain only database work.

**★ A `SET LOCAL` inside a transaction and a `set_config(..., true)` — are they the same thing?**
Effectively yes: both scope the setting to the current transaction, and both are the correct shape behind a transaction pooler. `set_config` is the function form, which matters because it takes its value as a *parameter*, so you can bind a runtime value with `$1` instead of interpolating it into SQL text. `SET LOCAL search_path TO $1` is not valid — `SET` does not take parameters — so carrying a tenant id or a JWT claim through `SET LOCAL` means string interpolation, which is an injection surface in the one place you least want one. That is why every RLS-through-a-pooler example, including Neon's, uses `set_config` with the third argument `true`.

---

← [01b · Three kinds of pool](01b-the-three-kinds-of-pool.md) · Next → [01d · Prepared statements under a pooler](01d-prepared-statements-under-a-pooler.md)
