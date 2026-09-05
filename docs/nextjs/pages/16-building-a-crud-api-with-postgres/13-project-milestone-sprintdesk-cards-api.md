---
title: "Project milestone — assemble the SprintDesk cards API from the twelve topics that built it, and note that nothing you assemble is new: the milestone is not writing six routes, it is being able to name, for each of them, the silent failure it inherits and the page that closes it"
sidebar_label: "13 · Milestone: the build"
sidebar_position: 68
description: "What the finished cards API actually is, the two doors over one Data Access Layer, the six decisions the chapter forced and where each is argued, and the three seams that fail before a second user ever exists — the connection, the migration, and the door."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 — this page composes material already verified in topics [01](01-the-resource-contract.md) through [11](11-ownership-on-the-api-surface.md) of this chapter against the Next.js, Drizzle, Neon, `node-postgres` and PostgreSQL 18 documentation and against RFC 9110. **It introduces no new claims of its own**; every quote below is one already banked and sourced on the page named beside it.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · `drizzle-orm` **0.45.2** · `drizzle-kit` **0.31.10** · `@neondatabase/serverless` **1.1.0** · `pg` **8.23.0** · **PostgreSQL 18.4** · React 19.2.8 · Node 24.20.0.

**Six routes over one table. A competent developer writes that in an afternoon and it works, and that is exactly the trap this chapter has spent fifty-six pages describing: every one of the failures below produces a `200`, a `404` or nothing at all, and none of them produces a stack trace you would find. The milestone is therefore not "make the six routes work" — they will work on the first try. It is to be able to point at each route and say which of the chapter's named failures it inherits, which page closes it, and what evidence you have that it is closed rather than merely unobserved. This page assembles the build and the three seams that fail before a second user exists. [13b](13b-milestone-the-overlap-seams.md) is the seams that need two requests, [13c](13c-milestone-what-it-costs-the-database.md) is what those fixes cost the database, and [13d](13d-milestone-acceptance-and-hand-off.md) is how you prove any of it.**

## What you are building

```text
SprintDesk · cards
├─ db/schema.ts          cards, boards, teams, team_members — 02
│                        id · boardId · title · body · status · position
│                        version · createdAt · updatedAt · deletedAt
│                        + index (board_id, created_at, id)
├─ lib/dal/              'server-only' — the ONLY module graph that reaches the driver
│  ├─ db.ts              one pool, one globalThis stash            — 03, 03c
│  ├─ session.ts         the ONLY caller of auth()                 — 04
│  ├─ access.ts          the ownership predicate as a WHERE clause — 04c
│  ├─ pg-errors.ts       SQLSTATE → the domain vocabulary          — 05c, 05ca
│  ├─ projections.ts     CARD_COLUMNS, and nothing wider           — 04d
│  └─ cards.ts           one exported function per use case        — 04e
├─ app/api/…/route.ts    six methods, each: parse → call → render a status  — 01b
└─ app/boards/[boardId]/actions.ts   'use server' — call → revalidateTag
```

Eleven columns, four tables, one predicate, six routes. **The line count of the whole thing is smaller than this chapter.** That ratio is the argument.

## The six routes, and what each one commits to

Copied from [01b](01b-the-six-routes-and-the-codes-they-commit-to.md) because it is the contract everything else has to satisfy:

| Route | Verb | Success | Failures it may produce | Built in |
|---|---|---|---|---|
| `/api/boards/[boardId]/cards` | `GET` | `200` | `401` `404` `400` | [06](06-read.md) |
| `/api/boards/[boardId]/cards` | `POST` | `201` + `Location` | `401` `404` `400` `422` `409` | [05](05-create.md) |
| `/api/cards/[cardId]` | `GET` | `200` | `401` `404` `304` | [06](06-read.md), [06g](06g-conditional-requests-and-etag.md) |
| `/api/cards/[cardId]` | `PATCH` | `200` | `401` `404` `400` `422` `409` `412` | [07](07-update.md) |
| `/api/cards/[cardId]` | `PUT` | `200` | `401` `404` `400` `422` `409` `412` | [07](07-update.md) |
| `/api/cards/[cardId]` | `DELETE` | `204` | `401` `404` | [08](08-delete.md) |

🔴 **`403` is absent from every row, and that is the single most contestable decision in the chapter.** It is argued in [11](11-ownership-on-the-api-surface.md): a `403` on a resource a stranger cannot read tells them the resource exists, which for a B2B or a medical product is often the sensitive fact. The predicate in [04c](04c-the-ownership-predicate.md) makes that decision structural rather than remembered — a non-member's query returns zero rows, and zero rows is indistinguishable from a missing card because the code never learned the difference.

## Two doors, one room

This is the whole architecture, and it fits on a screen. The Route Handler adds a status code and nothing else; the Server Action adds cache invalidation and nothing else; neither contains a rule.

```ts
// app/api/cards/[cardId]/route.ts — door 1: HTTP
import { readCard, patchCard } from '@/lib/dal/cards'
import { toHttpResponse } from '@/lib/errors-http'          // 10
import { cardETag, versionFromIfMatch } from '@/lib/http/etag'  // 07e

export async function GET(_req: Request, ctx: RouteContext<'/api/cards/[cardId]'>) {
  const { cardId } = await ctx.params
  try {
    const card = await readCard(cardId)                     // 04e — the only door to data
    return Response.json(card, { status: 200, headers: { ETag: cardETag(card) } })
  } catch (reason) {
    return toHttpResponse(reason)                           // 10 — the only door to a body
  }
}

export async function PATCH(req: Request, ctx: RouteContext<'/api/cards/[cardId]'>) {
  const { cardId } = await ctx.params
  try {
    const expected = versionFromIfMatch(req.headers.get('if-match'), cardId)  // 07e
    const card = await patchCard(cardId, await req.json(), expected)
    return Response.json(card, { status: 200, headers: { ETag: cardETag(card) } })
  } catch (reason) {
    return toHttpResponse(reason)
  }
}
```

```ts
// app/boards/[boardId]/actions.ts — door 2: React
'use server'
import 'server-only'
import { revalidateTag } from 'next/cache'
import { patchCard } from '@/lib/dal/cards'
import { toActionResult } from '@/lib/errors-action'        // 10

export async function renameCardAction(cardId: string, boardId: string, title: string, expectedVersion: number) {
  try {
    const card = await patchCard(cardId, { title }, expectedVersion)   // the SAME call
    revalidateTag(`board:${boardId}`)                                  // the only thing this door adds
    return { ok: true as const, card }
  } catch (reason) {
    return toActionResult(reason)     // a value the form renders inline — NOT a thrown boundary
  }
}
```

**`patchCard` is byte-for-byte the same call in both.** It authenticates, applies the ownership predicate, checks the version, projects `CARD_COLUMNS` and throws from a closed vocabulary — and it does not know that HTTP exists. Adding a third door later (a cron job, a queue consumer, a CLI) adds no copy of any rule. That property is the entire return on the Data Access Layer, and it is measurable: the number of places the ownership rule lives is `1`, not `number of entry points`.

## The six decisions, and where each is argued

Make these explicitly. Every one of them is recoverable and every one of them is expensive to recover.

| Decision | Take | Argued in |
|---|---|---|
| Delete semantics | **Soft**, `deleted_at IS NULL` on every read, `204` on success and on the replay | [08](08-delete.md), [08b](08b-what-soft-delete-costs-every-read.md), [08d](08d-status-codes-and-idempotency.md) |
| Concurrency control | **Optimistic**, one `version` integer, conflict detected by the affected-row count | [07d](07d-optimistic-concurrency-with-a-version-column.md), [07f](07f-pessimistic-locking-and-when-it-is-right.md) |
| How the client states it | **`If-Match` header**, not a body field — so `412` and `409` stay different answers | [07e](07e-etag-if-match-and-412.md) |
| Pagination | **Keyset**, on the `(board_id, created_at, id)` index — offset degrades with depth, not with page size | [06c](06c-offset-pagination-and-why-it-degrades.md), [06d](06d-keyset-pagination.md) |
| Isolation | **Read Committed**, the PostgreSQL default, with correctness bought per-statement rather than per-level | [09c](09c-isolation-levels-in-postgresql-18.md), [09d](09d-serialization-failures-and-the-retry-loop.md) |
| Where the rule lives | **The DAL, always**, enforced by a lint boundary rather than by review | [04](04-the-data-access-layer.md), [04b](04b-what-server-only-does-not-protect.md), [04ca](04ca-where-the-check-must-not-live.md) |

🔴 **The one people get wrong is the third, and it does not look like a decision.** Threading `version` through the request body works and is one line shorter. But then the only way a client can say *"only write this if nothing changed"* is a field your API invented, so a generic HTTP client, a cache and an intermediary cannot participate, and the failure has to be reported as `409` — which is the code for a conflict the client never mentioned. [07e](07e-etag-if-match-and-412.md) argues the difference, and the argument is not aesthetic: client error handling branches on it, and *"retry with the server's copy"* is right for one and wrong for the other.

## Seam 1 · The connection, from a function that may be frozen

**The failure.** It works for one developer and returns a connection error the first time real traffic arrives. Nothing in the code changed.

**The mechanism.** Every instance constructs its own pool, so your connection use at peak is `instances × max`, you control only the second term, and `pg` defaults `max` to `10` — which nobody sets on day one, so the default is what ships. There are exactly three moves on that product: put a transaction-mode pooler in front, remove the session from the equation, or run fewer processes. → [03b](03b-the-arithmetic-and-the-three-escapes.md)

**The check.** Compute the number before you deploy, and point the application at `DATABASE_URL` (pooled) while the migration runner uses `DIRECT_URL` (direct). Two variables, neither of them a default:

```ts
// lib/dal/db.ts — the application. Pooled endpoint, and an explicit max.
import 'server-only'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '@/db/schema'
import { env } from '@/lib/env'

// HMR replaces modules and has no opinion about globalThis, which is the whole
// reason this stash works — see 03c.
const globalForDb = globalThis as unknown as { sprintdeskPool?: Pool }

// `max` is whatever `instances × max` says it may be for YOUR plan and YOUR
// concurrency. The numbers below stand in for that computation and are not a
// recommendation — but leaving `max` out entirely ships pg's default of 10.
const pool =
  globalForDb.sprintdeskPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    max: process.env.NODE_ENV === 'production' ? 5 : 2,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  })

if (process.env.NODE_ENV !== 'production') globalForDb.sprintdeskPool = pool

export const db = drizzle(pool, { schema })
```

```ts
// drizzle.config.ts — the migration runner. Direct endpoint, always.
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DIRECT_URL! },   // NOT DATABASE_URL
})
```

**And the second failure in the same seam, which is worse in development than in production.** A module-scope `new Pool()` is re-evaluated every time hot module replacement re-runs the module; fifteen saves is fifteen pools and nothing closes the previous fourteen, because nothing told the old module it was being replaced. The developer editing most actively is the one taking the shared database down, and dev is the environment nobody monitors. The fix is the `globalThis` stash already in the snippet above — outside the module graph entirely, which is precisely why HMR leaves it alone. A module-level variable cannot do it, because a module-level variable is inside the thing being replaced. → [03c](03c-the-dev-hot-reload-leak.md)

**And the third, which has no error at all.** In transaction mode the pooler hands you a backend from `BEGIN` to `COMMIT` and nothing in between — so two consecutive `await` calls with no explicit transaction are *two* transactions and may run on two different backends. Every feature that stores something on the server between statements silently stops working, non-deterministically, under load and never in development. → [03d](03d-what-does-not-survive-the-pooler.md)

## Seam 2 · The migration is a release step, and the old code is still serving

**The failure.** The board renders and a write throws about a column that is right there in `db/schema.ts`.

**The mechanism.** `db/schema.ts` is a TypeScript file. It types your queries, it generates your DTOs, and it has no authority over the database whatsoever. `title` is `NOT NULL` in that file the moment you type it and `NOT NULL` in the database only after a migration ran and a ledger row says so. → [02c](02c-the-migration-is-a-release-step.md)

**The check.** `drizzle-kit migrate` against `DIRECT_URL` as a release step, gated so a pending migration fails the deploy rather than the first request that touches the new column. Never from application startup — instances race.

**Two things about *how* it runs that people learn during the outage.** First, `ALTER TABLE` takes `ACCESS EXCLUSIVE`, and the PostgreSQL 18 manual is explicit about what that means for everyone else:

> *"Conflicts with locks of all modes (`ACCESS SHARE`, `ROW SHARE`, `ROW EXCLUSIVE`, `SHARE UPDATE EXCLUSIVE`, `SHARE`, `SHARE ROW EXCLUSIVE`, `EXCLUSIVE`, and `ACCESS EXCLUSIVE`). This mode guarantees that the holder is the only transaction accessing the table in any way."*
> — [PostgreSQL 18 · Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html), banked in [02d](02d-the-lock-a-migration-actually-takes.md)

and the wait is not bounded by anything you did not set:

> *"So long as no deadlock situation is detected, a transaction seeking either a table-level or row-level lock will wait indefinitely for conflicting locks to be released."*
> — same page

That is how a one-millisecond statement becomes a ten-minute outage: it does not run slowly, it *waits*, and every `SELECT` arriving behind it waits too. The fix is `lock_timeout` — refuse to wait — which turns an outage into a failed deploy you retry. → [02d](02d-the-lock-a-migration-actually-takes.md)

Second, a deploy is not an instant. For some window, old code and new code are both running against one database, so **the only safe migrations are the ones both versions can live with**. Renaming a column is two deploys; dropping one is the last step, never the first. → [02e](02e-expand-and-contract.md)

## Seam 3 · The DAL is only a door if there is no other door

**The failure.** The DAL exists, the audit passes, and half the new code queries the database directly — with its own authorisation check, or none.

**The mechanism, and the part everyone gets wrong.** `import 'server-only'` is a build error when a module specifier enters the **client** graph. A Route Handler is server code. It is not in the client graph, it never will be, and the pill in `lib/dal/db.ts` has no opinion whatsoever about `app/api/cards/[cardId]/route.ts` importing it and writing its own query. → [04b](04b-what-server-only-does-not-protect.md)

**The check is a lint rule, because it is the only tool that has an opinion about server-to-server imports:**

```jsonc
// eslint.config — nothing outside lib/dal may reach the driver, the client, or the schema
{
  "rules": {
    "no-restricted-imports": ["error", {
      "paths": [
        { "name": "pg", "message": "Import from @/lib/dal/* — the DAL owns the pool." },
        { "name": "drizzle-orm/node-postgres", "message": "Import from @/lib/dal/* — the DAL owns the client." },
        { "name": "@neondatabase/serverless", "message": "Import from @/lib/dal/* — the DAL owns the transport." }
      ],
      "patterns": ["@/lib/dal/db", "@/db/schema"]
    }]
  }
}
```

`@/db/schema` is in that list deliberately: importing the table definitions is step one of writing a query outside the layer, and it is the step a reviewer is least likely to challenge.

The documentation asks the audit question in a form that is deliberately about topology, because topology is the part you can check with a command:

> *"**Data Access Layer:** Is there an established practice for an isolated Data Access Layer? Verify that database packages and environment variables are not imported outside the Data Access Layer."*
> — [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security), banked in [04](04-the-data-access-layer.md)

**And the placement inside the DAL matters as much as the boundary around it.** A check written *after* the read is correct today and structurally weaker forever: the row is in memory before the caller was allowed to have it, there is a window between the check and the act, and there is a branch a refactor can delete without any test noticing. The predicate belongs in the `WHERE` clause, where authorization stops being something the function *does* and becomes something the function *is*. → [04c](04c-the-ownership-predicate.md), [04ca](04ca-where-the-check-must-not-live.md)

## Gotchas

**★ Symptom: the six routes work, the demo is fine, and you cannot say what would break under load.** Cause: the build was assembled from the happy paths, which is what a tutorial teaches and what every one of these topics deliberately does not. Fix: walk the four milestone pages and answer the acceptance questions in [13d](13d-milestone-acceptance-and-hand-off.md) before calling it done. Every failure in this chapter is silent, so *"we did not see it"* is not evidence of anything.

**★ Symptom: the app connects fine locally and exhausts connections on the first traffic spike.** Cause: the app is pointed at the direct endpoint, so every instance holds real Postgres backends, and `pg` shipped its default `max` of `10`. Fix: two variables — `DATABASE_URL` (pooled) for `lib/dal/db.ts`, `DIRECT_URL` (direct) for `drizzle.config.ts` — plus an explicit `max` you computed rather than inherited.

**★ Symptom: a feature works in `next dev`, works in preview, and behaves nondeterministically in production under load.** Cause: it stores state on the server between two statements — a `SET`, an advisory lock, a temporary table, a prepared statement — and a transaction-mode pooler is free to run consecutive statements on different backends. Fix: the enumeration in [03d](03d-what-does-not-survive-the-pooler.md). Anything that must persist across statements goes inside an explicit `BEGIN`/`COMMIT`, or onto the role so it applies at every session start.

**★ Symptom: your local database is fine and CI's is unusable after a day of development.** Cause: the module-scope pool is reconstructed on every hot-reload and nothing closes the old one. Fix: the `globalThis` stash from [03c](03c-the-dev-hot-reload-leak.md). A module-level cache does not work, because the module-level cache is inside the thing being replaced.

**★ Symptom: a deploy takes the whole product down for ten minutes and the migration itself was one line.** Cause: `ALTER TABLE` took `ACCESS EXCLUSIVE`, could not get it because a long-running read held `ACCESS SHARE`, and — per the manual — waited indefinitely, with every subsequent reader queued behind it. Fix: set `lock_timeout` in the migration session so a blocked migration fails fast and becomes a red deploy rather than an outage.

**★ Symptom: a migration succeeded, the deploy succeeded, and the previous version's instances started throwing.** Cause: destructive and additive changes shipped in one release, so for the overlap window the old code was running against a schema it had never seen. Fix: expand and contract — additive first in its own release, destructive last, never together. That discipline is also the only thing that makes "roll it back" a real option.

**★ Symptom: the DAL is enforced by `import 'server-only'` and a Route Handler queries the database anyway.** Cause: the pill guards the client graph and a Route Handler is not in it. Fix: the `no-restricted-imports` boundary above. `server-only` and the lint rule guard two different edges and neither substitutes for the other.

**★ Symptom: a second entry point was added and shipped with no authorization at all, and the reviewer approved it.** Cause: the check lived in the first entry point, so the second one had nothing to copy and nothing to fail. Fix: the predicate lives in the query. A new door that calls `readCard` inherits it whether or not its author knew it existed — which is the only form of "cannot be forgotten" that survives a team.

**★ Symptom: `revalidateTag` was moved into the DAL "so nobody forgets it" and a background job started failing.** Cause: cache invalidation is transport knowledge, and a worker has no router to invalidate. Fix: keep `next/cache` in the entry points. If a DAL function seems to need invalidation, the real requirement is a domain event each door reacts to in its own way.

**★ Symptom: the Server Action throws on a validation failure and the user loses everything they typed.** Cause: a thrown error in an Action is an error *boundary*, not an error *message* — the nearest `error.tsx` renders and the form is gone. Fix: catch at the Action boundary and return the failure as a value, which is what `toActionResult` in the wiring above does. The Route Handler throws nothing to the client either; it renders through `toHttpResponse`.

**★ Symptom: `GET /api/cards/[cardId]` returns a field the list endpoint does not, and nobody decided that.** Cause: two queries each wrote their own column list. Fix: one exported `CARD_COLUMNS` that both spread — which is also what keeps `deletedAt` out of every response and therefore keeps soft delete a private implementation detail you are still free to redesign. → [04d](04d-projections-not-rows.md)

**★ Symptom: `403` appears on one route because it felt more honest.** Cause: the disclosure decision was re-litigated per endpoint instead of being encoded once. Fix: it is encoded in the error vocabulary — one class covers both "gone" and "not yours" specifically so no transport can distinguish them even if its author wanted to. If you genuinely want `403`, [11](11-ownership-on-the-api-surface.md) argues when it is right, and the answer is "when the caller already knows the resource exists".

## Interview questions

**★ Why is "the six routes work" not the milestone?**
Because six routes over one table is a solved problem and every developer on the team can do it. What separates a CRUD API that survives from one that quietly corrupts data is a set of failures that all present as success: a lost update is two `200`s, a soft-delete leak is a `200` with extra rows, a duplicate from a retried `POST` is a `201`, a per-instance cache miss is a stale board with no error, and connection exhaustion looks like latency until it looks like an outage. None of them is visible in a code review of the route file, so the deliverable has to be the account of which ones you closed and how, not the routes themselves.

**★ Your API has one Data Access Layer and two entry points. What, exactly, is each entry point allowed to contain?**
Translation and nothing else. The Route Handler parses the request envelope — path params, headers such as `If-Match`, the JSON body — calls one DAL function, and renders the outcome as a status code plus the shared envelope. The Server Action calls the same DAL function, adds `revalidateTag`, and renders the outcome as a typed return value. Neither contains an authorization check, a projection, an SQLSTATE mapping, or a business rule. The test is arithmetic: if adding a third door would require copying anything, the split is wrong, and the third door always arrives.

**★ Why does `import 'server-only'` not enforce the Data Access Layer?**
Because it guards a different edge. It causes a build error when a module specifier enters the *client* graph, which is exactly right for stopping a Client Component from importing the driver, and completely irrelevant to a Route Handler — which is server code and will never be in the client graph. The rule "only `lib/dal` may import `pg`" is a rule about which server module may import which other server module, and Next.js has no opinion about that. The tool that does is a lint boundary. Conflating the two is how a codebase comes to believe it has an invariant it does not have, which is worse than knowing it has none.

**★ Why is `403` missing from every row of the route table?**
Because `403` on a resource the caller cannot read confirms that the resource exists, and existence is frequently the sensitive fact — how many boards a competitor's team has, whether a given patient record is in the system. Answering `404` for both "no such card" and "not your card" removes the oracle. It is a real cost: a legitimate user who has lost access sees a confusing `404` rather than a clear denial, and support tickets follow. The chapter takes that trade deliberately and makes it structural, by collapsing both cases into one error class inside the DAL so no transport can un-collapse it later.

**★ Why must the ownership check be in the `WHERE` clause rather than after the read?**
Four reasons, and only the first is about correctness today. The row is loaded into your process before the caller was entitled to it, so any logging, any error path that serialises the object, and any future `return` added above the check leaks it. There is a window between the check and the act, so a card that moves boards between the two is acted on under a permission that no longer holds. The check is a branch, and a branch can be deleted by a refactor with every test still passing. And a check placed anywhere other than the query has to be repeated in every future function that touches the table. In the `WHERE` clause it is not a thing the function does — it is a property of what the function can possibly return.

**★ Your `db/schema.ts` says a column is `NOT NULL`. What does that guarantee?**
That your TypeScript types and your generated DTOs believe it. Nothing else. The database learns it only when a migration has been applied and a ledger row records that fact, and until then your queries and your types agree with each other while both being wrong about the only system that matters. This is why the migration is a release step gated to fail the deploy — the alternative is that the disagreement is discovered by the first request that touches the new column, in production, at whatever hour that happens.

**★ Why is a migration dangerous even when the statement itself is instantaneous?**
Because the danger is the lock, not the duration. `ALTER TABLE` takes `ACCESS EXCLUSIVE`, which the manual says *"conflicts with locks of all modes"* including the `ACCESS SHARE` that a plain `SELECT` takes, and a lock request *"will wait indefinitely for conflicting locks to be released"*. So a one-millisecond statement that arrives while an analytics query is running does not take one millisecond — it queues, and every read arriving afterwards queues behind it, because lock requests are granted in order. The table is unavailable for the length of the *other* query, not yours. Setting `lock_timeout` converts that from an outage into a failed deploy.

**★ Why can you not put both an additive and a destructive migration in the same release?**
Because a deploy is a window, not an instant, and during it two versions of your code are running against one database. A release that adds `title_v2` and drops `title` leaves the still-running old instances querying a column that no longer exists. Splitting it means every intermediate state is one both versions tolerate: expand, backfill, switch reads, switch writes, then contract in a later release. The same property is what makes a rollback possible at all — rolling back is just the overlap window traversed in the other direction, and it only works if the schema the old code needs is still there.

---

← [12k · Migrations in the test path](12k-migrations-in-the-test-path.md) · [Chapter 16 overview](01-explanation.md) · Next → [13b · The overlap seams](13b-milestone-the-overlap-seams.md)
