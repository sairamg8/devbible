---
title: "\"Prepared statement\" names two different mechanisms, only one of which survives a pooler — and knowing which one your ORM uses explains every confusing error it throws in production"
sidebar_label: "01d · Prepared statements"
sidebar_position: 4
description: "SQL-level PREPARE as a session-scoped named object versus protocol-level Parse/Bind/Execute, why `prepared statement \"s0\" already exists` means a collision rather than a miss, why `pgbouncer=true` is now the wrong advice, and where parameterisation ends and preparation begins."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the [PostgreSQL 18 `PREPARE` reference](https://www.postgresql.org/docs/18/sql-prepare.html), [Neon · Connection pooling](https://neon.com/docs/connect/connection-pooling), [Prisma 7 · Configure Prisma Client with PgBouncer](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/pgbouncer) and [Drizzle · Query performance](https://orm.drizzle.team/docs/pg/perf-queries).
> Documentation-verified; **no sandbox run**. Every error string below is quoted from a vendor doc, not reproduced from a run.
> Target: **PostgreSQL 18.4** · Prisma **7.10.0** · `drizzle-orm` **0.45.2** · `pg` **8.23.0** · Next.js 16.3.4.

**The single most misdiagnosed error in serverless Postgres is `prepared statement "s0" already exists`, and it is misdiagnosed because "prepared statement" is one phrase covering two unrelated mechanisms. One is a named object stored in a database session, which a transaction-mode pooler destroys by design. The other is a wire-protocol interaction that a modern pooler tracks and re-issues on your behalf. Which one your driver uses is the difference between an ORM that works behind PgBouncer and one that throws a name-collision error at 3 a.m. — and the difference between parameterisation, which is your injection defence, and preparation, which is a performance optimisation you can give up.**

## Mechanism one — SQL-level `PREPARE`, a named object in a session

PostgreSQL 18 defines it:

> *"`PREPARE` creates a prepared statement. A prepared statement is a server-side object that can be used to optimize performance. When the `PREPARE` statement is executed, the specified statement is parsed, analyzed, and rewritten. When an `EXECUTE` command is subsequently issued, the prepared statement is planned and executed. This division of labor avoids repetitive parse analysis work, while allowing the execution plan to depend on the specific parameter values supplied."*

and, decisively for anything behind a pooler:

> *"Prepared statements only last for the duration of the current database session. When the session ends, the prepared statement is forgotten, so it must be recreated before being used again. This also means that a single prepared statement cannot be used by multiple simultaneous database clients; however, each client can create their own prepared statement to use."*
> — [PostgreSQL 18 · `PREPARE`](https://www.postgresql.org/docs/18/sql-prepare.html)

Read the second sentence twice. *Session-scoped, name-addressed, and the name lives in a namespace owned by the session.* Two facts follow immediately:

- A client that prepares `s0` and comes back to a different backend finds no `s0`.
- A client that prepares `s0` on a backend where somebody else already prepared `s0` collides.

That is why `PREPARE` / `DEALLOCATE` sits on Neon's unsupported list for pooled connections, and it is stated as a rule rather than a caveat:

> *"SQL-level `PREPARE` and `EXECUTE` statements are not supported with PgBouncer. You must use protocol-level prepared statements through your database driver."*

The reference also tells you where `PREPARE` genuinely pays, which is worth knowing so you can judge what you are giving up:

> *"Prepared statements potentially have the largest performance advantage when a single session is being used to execute a large number of similar statements. The performance difference will be particularly significant if the statements are complex to plan or rewrite, e.g., if the query involves a join of many tables"*

"A single session executing many similar statements" is a description of a long-lived worker, not of a serverless request handler. The workload that benefits most is the workload least likely to be behind a transaction pooler.

## Mechanism two — the extended query protocol

The Postgres frontend/backend protocol has its own Parse → Bind → Execute cycle. A driver can name a statement at the protocol level without ever sending the SQL keyword `PREPARE`, and PgBouncer learned to track and replay those:

> *"PgBouncer supports protocol-level prepared statements (as of PgBouncer 1.22.0), which can improve query performance and security."*
> — [Neon · Connection pooling](https://neon.com/docs/connect/connection-pooling)

Neon bounds how many it will track, in the fixed configuration it publishes: `max_prepared_statements=1000`, described as *"Maximum protocol-level prepared statements per connection."*

In `pg` you opt in by giving the query object a `name`. Neon's own example:

```javascript
const query = {
  name: 'fetch-user',
  text: 'SELECT * FROM users WHERE username = $1',
  values: ['alice'],
};
await client.query(query);
```

## Parameterisation is not preparation, and only one of them is a security control

This distinction is worth its own paragraph because conflating the two leads people to keep a pooler-hostile setting for a reason that does not exist.

```ts
// (a) Parameterised, NOT prepared. Extended protocol, values sent out of band.
//     Fully safe against injection. No named object anywhere. Pooler-neutral.
await pool.query('SELECT * FROM cards WHERE board_id = $1', [boardId])

// (b) Parameterised AND prepared. Same injection safety, plus a named object
//     on the backend that the pooler now has to track for you.
await pool.query({ name: 'cards_by_board', text: 'SELECT * FROM cards WHERE board_id = $1', values: [boardId] })

// (c) Neither. Interpolated SQL. This is the injection bug, and it is orthogonal
//     to both of the above.
await pool.query(`SELECT * FROM cards WHERE board_id = '${boardId}'`) // 🔴 never
```

Neon lists both benefits together — *"**Performance**: Query parsing and planning happens once… **Security**: Reduces SQL injection risk by separating query structure from data"* — but the security half comes from the parameter separation in (a), which you have whether or not you name the statement. **Dropping the name to appease a pooler costs you plan reuse and costs you nothing in safety.**

## Where the ORMs land

### Prisma names its statements

> *"One common feature that external connection poolers do not support are named prepared statements, which Prisma ORM uses."*
> — [Prisma 7 · PgBouncer](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/pgbouncer)

which produces its signature failure, quoted verbatim from that page:

```
Error: undefined: Database error
Error querying the database: db error: ERROR: prepared statement "s0" already exists
```

🔴 **Read that message carefully: the problem is not that the statement is missing, it is that it already exists.** Prisma believes it has a fresh session and prepares `s0`; the backend it was handed already carries an `s0` from an earlier client. Same name, different owner, collision. Everyone's first instinct is to look for a *missing* statement and they look in the wrong place for an hour.

The historical mitigation was a connection-string flag, and it is now the wrong answer on any current pooler:

> *"We recommend **not** setting `pgbouncer=true` in the database connection string if you're using PgBouncer `1.21.0` or later."*

⚠️ **This is a live source of stale advice.** A large volume of blog posts and forum answers still tell you to add `?pgbouncer=true`. Against Neon, whose PgBouncer is well past 1.21, Prisma's own documentation says not to. Today the `s0 already exists` error is far more often a *CLI command* running through the pooler than a runtime query, because Prisma documents the migration engine as unpoolable in principle:

> *"Prisma Migrate uses **database transactions** to check out the current state of the database and the migrations table. However, the Schema Engine is designed to use a **single connection to the database**, and does not support connection pooling with PgBouncer."*

### Drizzle makes it opt-in

Drizzle's `.prepare()` is an explicit call you write, so the default query issues no named statement at all:

> *"When it comes to Drizzle — we're a thin TypeScript layer on top of SQL with almost 0 overhead and to make it actual 0, you can utilise our prepared statements API."*

> *"With prepared statements you do SQL concatenation once on the Drizzle ORM side and then database driver is able to reuse precompiled binary SQL instead of parsing query all the time. It has extreme performance benefits on large SQL queries."*
> — [Drizzle · Query performance](https://orm.drizzle.team/docs/pg/perf-queries)

```ts
import { sql, eq } from 'drizzle-orm'
import { cards } from './schema'

// Prepared once at module scope, reused across executions.
// sql.placeholder is how a runtime value reaches a pre-compiled statement.
const cardsForBoard = db
  .select()
  .from(cards)
  .where(eq(cards.boardId, sql.placeholder('boardId')))
  .prepare('cards_for_board')

await cardsForBoard.execute({ boardId: 'b_123' })
await cardsForBoard.execute({ boardId: 'b_456' })
```

Note what Drizzle's own description says the saving is: *"you do SQL concatenation once on the Drizzle ORM side"*. Half the win is in JavaScript — not building the SQL string on every call — and that half survives a pooler regardless of what happens on the backend. That is a genuinely different trade from Prisma's, where preparation is not a decision you make per query.

## Deciding, per query

| Situation | Name the statement? |
|---|---|
| Simple single-table lookup, behind a pooled endpoint | No. The plan is cheap; the pooler bookkeeping is not free. |
| Large multi-join query run on every request | Yes, if you can — the PostgreSQL reference says planning cost is where the win is. Measure with `EXPLAIN`, not with vibes. |
| Long-lived worker on a **direct** connection | Yes. This is the workload `PREPARE` was designed for. |
| Migration, seed, one-off script | No. It runs once; there is nothing to reuse. |
| Hundreds of distinct query shapes per instance | No. You will churn through `max_prepared_statements` and pay re-prepare cost on every backend hop. |

For the driver-level mechanics of prepared statements outside a Next.js context, the PostgreSQL track owns it: [PostgreSQL · prepared statements in `pg`](../../../postgresql/pages/phase-7-pg-driver/10-prepared.md).

## Gotchas

**★ Symptom: `prepared statement "s0" already exists` from Prisma, only in production.** Cause: the connection string used for that operation reaches PgBouncer, and named statements from a previous client are still on the backend you were handed. Overwhelmingly this is the CLI — `prisma migrate deploy` — pointed at the pooled URL. Fix: give the CLI a direct URL through `prisma.config.ts` and leave the client on the pooled one.

```ts
// prisma.config.ts — the CLI always reads its datasource from here.
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: env('DIRECT_URL') },
})
```

```ts
// src/db/client.ts — the runtime client keeps the pooled URL.
import { PrismaClient } from '../prisma/generated/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
export const prisma = new PrismaClient({ adapter })
```

**★ Symptom: you added `?pgbouncer=true` on advice from a blog post and the problem persisted.** Cause: that flag targets PgBouncer below 1.21.0. Prisma's current documentation recommends *against* it on 1.21.0 and later, and Neon's PgBouncer is newer than that. You changed a flag that no longer applies and left the real cause — a CLI on a pooled URL — in place. Fix: remove the flag, split the URLs.

```bash
# .env — the shape that actually resolves it.
DATABASE_URL="postgres://user:pw@ep-x-pooler.us-east-2.aws.neon.tech/sprintdesk?sslmode=require"
DIRECT_URL="postgres://user:pw@ep-x.us-east-2.aws.neon.tech/sprintdesk?sslmode=require"
```

**★ Symptom: prepared-statement performance gains vanished after moving behind the pooler.** Cause: the pooler tracks protocol-level statements per *server* connection, capped by `max_prepared_statements` (1000 on Neon), and your client's statements are re-prepared whenever it lands on a backend that has not seen them. With a large statement catalogue and high backend churn, the prepare cost is paid repeatedly instead of once. Fix: shrink the set of named statements to the few queries where planning genuinely dominates, and leave the rest unnamed.

```ts
// Name only the expensive one. The lookups stay plain parameterised queries.
const boardWithEverything = db.query.boards
  .findFirst({
    where: eq(boards.id, sql.placeholder('boardId')),
    with: { columns: { with: { cards: { with: { assignee: true, labels: true } } } } },
  })
  .prepare('board_full')

const cardById = (id: string) => db.select().from(cards).where(eq(cards.id, id)) // unnamed
```

**★ Symptom: you removed statement names to fix a pooler error and a security reviewer flagged it as an injection regression.** Cause: the reviewer conflated parameterisation with preparation. Fix: show that the values still travel as bind parameters — the query text is a constant with `$1` in it — and that nothing was interpolated. If you actually did switch to string building while you were in there, that *is* the regression, and it is the thing to revert.

```ts
// Still fully parameterised after dropping the name. `$1` never becomes text.
await pool.query('SELECT * FROM app.cards WHERE board_id = $1 AND archived = $2', [boardId, false])
```

**★ Symptom: a `prepare()`d Drizzle query returns stale results after you edited the query builder chain.** Cause: `.prepare()` compiles once at module scope; the compiled statement holds the SQL as it was when the module evaluated. Under `next dev` the module reloads, but a statement captured in a `globalThis` cache does not. Fix: keep prepared statements out of the dev-time global singleton, or key the cache on something that changes when the module does.

```ts
// Keep the *connection* global for hot reload; do NOT put prepared statements on it.
const globalForDb = globalThis as unknown as { pool?: Pool }
export const pool = globalForDb.pool ?? new Pool({ connectionString: process.env.DATABASE_URL })
if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool

export const db = drizzle({ client: pool })
export const cardsForBoard = db.select().from(cards)
  .where(eq(cards.boardId, sql.placeholder('boardId')))
  .prepare('cards_for_board') // re-created on every module evaluation, which is what you want
```

**★ Symptom: `DEALLOCATE ALL` "fixed" the error, then it came back.** Cause: deallocating clears named statements on whichever backend served that statement — one of many, chosen non-deterministically. You cleaned one and left the rest, so the collision recurs as soon as you are routed to another. Fix: stop issuing SQL-level `PREPARE` through the pooler at all; `DEALLOCATE` is on the same unsupported list for the same reason.

**★ Symptom: a query that was fast in `psql` is slow from the application, and both use the same SQL.** Cause: this is often generic-plan behaviour on a reused prepared statement — the reference notes that `EXECUTE` *"allow[s] the execution plan to depend on the specific parameter values supplied"*, but a statement reused many times may settle on a plan chosen without your current parameters. `psql` typing the statement fresh gets a custom plan. Fix: confirm with `EXPLAIN (ANALYZE)` on both paths before assuming; if plan reuse is the cause, dropping the statement name is the smallest change that restores per-execution planning.

## Interview questions

**★ What is the difference between SQL-level `PREPARE` and a protocol-level prepared statement, and why does a pooler care?**
SQL-level `PREPARE` creates a named server-side object that, in the words of the PostgreSQL reference, *"only last[s] for the duration of the current database session"* and cannot be shared between simultaneous clients. It is addressed by a name in a namespace that belongs to the session, so under transaction pooling two clients can collide on the same name on the same backend, and a client can look for a name that was never prepared on the backend it just got. Protocol-level statements use the wire protocol's Parse/Bind/Execute cycle instead; PgBouncer has been able to track and re-issue those since 1.22.0, so a driver that uses them works through a pooler. That is exactly why Neon says SQL `PREPARE` is unsupported while protocol-level preparation is supported, and why a driver's choice of mechanism determines whether it can be pooled at all.

**★ Prisma throws `prepared statement "s0" already exists` in production only. Walk through the diagnosis.**
The error says a *name collided*, so something is issuing named statements onto a backend that already carries that name — which means it is talking through a transaction pooler. Two candidates. The first and most likely is the CLI: `prisma migrate deploy` runs the Schema Engine, which Prisma documents as using a single connection and not supporting PgBouncer, so pointing it at the pooled URL is the classic cause. The second is the runtime client against an old pooler, which is what `?pgbouncer=true` was invented for — but Prisma now recommends against that flag on PgBouncer 1.21 and later, so on Neon it is a red herring. The fix is structural rather than a flag: two URLs, `DIRECT_URL` in `prisma.config.ts` for the CLI, pooled `DATABASE_URL` in the driver adapter for the app.

**★ Does a parameterised query need to be a prepared statement to be safe from SQL injection?**
No, and conflating the two is common enough to be dangerous in both directions. Passing values as `$1`, `$2` uses the extended query protocol, so the parameters are sent separately from the statement text and are never parsed as SQL — that is the entire injection defence, and it applies whether or not the statement is given a name for reuse. Naming it turns it into a *prepared* statement, whose benefit is avoiding repeated parse and rewrite work and whose cost is the pooler interaction. So under a pooler you can freely drop the name and keep the safety; you lose a performance optimisation, not a security property. The direction that matters more: keeping the name does not make an interpolated string safe.

**★ Under what conditions is preparing a statement actually worth it?**
The PostgreSQL reference is specific: the advantage is largest *"when a single session is being used to execute a large number of similar statements"*, and *"particularly significant if the statements are complex to plan or rewrite, e.g., if the query involves a join of many tables"*. So: a long-lived process, a stable set of query shapes, and queries whose planning cost is a meaningful fraction of their execution cost. Invert each of those and you get the serverless anti-case — short-lived instances, backends handed round by a pooler, and simple indexed lookups where planning is trivial. That is why the same optimisation that is obviously right in a Java service on a VPS is usually noise, and sometimes negative, in a Next.js route handler behind PgBouncer.

**★ Your ORM prepares statements and you cannot change that. What are your options?**
Three, in increasing order of disruption. Run the offending workload on a direct connection — mandatory for the migration engine anyway, and often sufficient because the CLI is the real culprit. Ensure the pooler is new enough to track protocol-level statements, which for a managed provider means checking their published configuration rather than guessing; Neon publishes `max_prepared_statements=1000` and the 1.22.0 support claim. Or reduce the number of distinct statement shapes so the per-backend cache stays small and re-preparation after a hop is cheap. What is *not* an option is `DEALLOCATE ALL` as a workaround, because it only clears the one backend you happened to be on.

**★ You inherit a codebase that adds `?pgbouncer=true` to every Postgres URL. What do you do?**
Find out which pooler is actually in front of the database and which version. If it is 1.21.0 or newer — which every managed Postgres provider I checked is — Prisma's current documentation recommends removing the flag, so removing it is a correctness change rather than a cleanup. Then check whether the flag was masking the real problem: search for CLI invocations, migration steps and seed scripts that use the pooled URL, because those are unpoolable regardless of the flag. Finally add the boot-time assertion that the runtime URL is a pooled host and the CLI URL is not, so the next person cannot reintroduce it by pasting the wrong secret.

---

← [01c · Transaction pooling](01c-transaction-pooling-and-session-state.md) · Next → [01e · The Neon serverless driver](01e-the-http-driver-and-one-shot-queries.md)
