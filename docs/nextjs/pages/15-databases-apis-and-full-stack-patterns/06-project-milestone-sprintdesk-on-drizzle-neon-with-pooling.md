---
title: "Project milestone — put SprintDesk on Drizzle and Neon with the pooling right, stream board updates over SSE, and move digest emails to a queue: three features that each fail in a way this chapter has already named"
sidebar_label: "06 · Milestone: SprintDesk full-stack"
sidebar_position: 62
description: "The build, the four decisions it forces, the six seams where a chapter-15 failure will actually appear, and the acceptance checks that prove each one is closed rather than merely absent."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 — this page composes material already verified in topics [01](01-database-integrations-serverless-postgres-neon-prisma-drizzl.md) through [05](05-edge-functions-and-custom-cache-structures-for-global-comput.md) of this chapter against the Neon, Prisma 7, Drizzle, `node-postgres`, PostgreSQL 18 and Next.js 16.3.4 documentation. It introduces no new claims of its own.
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4** · `drizzle-orm` **0.45.2** · `drizzle-kit` **0.31.10** · `@neondatabase/serverless` **1.1.0** · `pg` **8.23.0** · **PostgreSQL 18.4** · Node 24.20.0.

**Three features, chosen because each one breaks along a different fault line this chapter has already mapped. A board that reads and writes Postgres from a serverless runtime will hit the connection arithmetic in [01b](01b-the-three-kinds-of-pool.md) long before it hits a slow query. A live board that streams updates over SSE will work perfectly in `next dev` and stall in production for the buffering reasons in [03h](03h-what-silently-breaks-sse-in-production.md). And a digest email sent from inside a Server Action will appear to work until the day a user closes the tab. The milestone is not "make these three things run" — a tutorial does that in an afternoon. It is to build them so that each of the six named failures below is closed, and to be able to demonstrate it.**

## What you are building

```
SprintDesk
├─ boards + cards on Neon Postgres, Drizzle schema, drizzle-kit migrations
├─ mutations as Server Actions; a public read API as a Route Handler
├─ a live board: SSE stream, resumable via Last-Event-ID
└─ a nightly digest email: enqueued in the same transaction as the write
```

## The four decisions, and where each is argued

Make these explicitly. Each has a page that argues it, and the wrong choice is recoverable but expensive.

| Decision | Take | Argued in |
|---|---|---|
| ORM | **Drizzle** — the schema is TypeScript, no codegen step in CI, and the queue work in topic 04 needs SQL the client cannot model | [01hc](01hc-ergonomics-size-and-when-each-is-wrong.md) |
| Connection | **pooled endpoint for the app, direct for migrations** — two URLs, always | [01b](01b-the-three-kinds-of-pool.md), [01ia](01ia-push-pooling-and-proving-the-migration-ran.md) |
| Mutations | **Server Actions** for the UI, **Route Handlers** for anything a non-browser client calls | [02l](02l-the-decision-rule.md) |
| Live updates | **SSE**, not WebSockets — the serverless request model does not host a socket | [03i](03i-websockets-and-the-serverless-request-model.md) |

🔴 **The one decision people get wrong is the second, and it is not really an ORM question.** Whichever ORM you pick, instance count multiplied by pool size is the number that exhausts Neon, and the escapes are the same three. Choosing Drizzle does not help with it; sizing the pool and using the pooler does.

## The six seams

This is the actual content of the milestone. Each seam is a failure that will happen, the page that explains it, and a check that proves you have closed it — because *"we did not see that bug"* is not evidence, given every one of these is silent.

### 1 · The connection count

Every instance opens its own pool, so your connection use is instances × `max`, and a traffic spike multiplies the first term. **Check:** compute the number for your plan's concurrency before you deploy, and point the app at the **pooled** endpoint. → [01b](01b-the-three-kinds-of-pool.md), [01ga](01ga-where-the-prisma-instance-lives.md)

### 2 · The migration that never ran

Your types say `title` is `NOT NULL`; only an applied migration makes the database agree. **Check:** `drizzle-kit migrate` against `DIRECT_URL` as a release step, and a ledger assertion that fails the deploy rather than the request. Never from application startup — instances race. → [01i](01i-migrations-in-each.md), [01ia](01ia-push-pooling-and-proving-the-migration-ran.md)

### 3 · The action that is a public endpoint

A Server Action is a POST route reachable by anyone who can send the same POST. The page's `auth()` check does not protect it. **Check:** every action re-verifies the caller, through the same data access layer the Route Handlers use. → [02e](02e-authentication-and-authorisation-at-the-entry-point.md), [02m](02m-the-data-access-layer.md), [02n](02n-thin-entry-points-over-one-rule.md)

### 4 · The stream that works in dev and stalls in production

`next dev` is one process talking to your browser; production inserts a proxy, a CDN and a compression layer, any of which may buffer. **Check:** deploy it and watch the first comment arrive immediately. If it does not, the problem is downstream of your handler and no handler change fixes it. → [03h](03h-what-silently-breaks-sse-in-production.md), [03ha](03ha-connection-lifetime-limits-and-the-cost-of-an-open-stream.md)

### 5 · The email sent from the request

Work started inside a request dies with the request. **Check:** enqueue the digest in the **same transaction** as the write that causes it — which is the one thing a Postgres queue can do and a separate broker cannot — and let a worker claim it with `FOR UPDATE SKIP LOCKED`. Handlers must be idempotent, because delivery is at-least-once. → [04b](04b-after-and-waituntil-are-not-a-queue.md), [04d](04d-postgres-as-a-queue-skip-locked.md), [04e](04e-at-least-once-and-idempotency.md)

### 6 · The invalidation that reached one instance

`revalidateTag()` invalidates the instance it ran on. On more than one instance, some users see the new board and some do not — with no error anywhere. **Check:** enumerate your cache layers (framework, other instances, CDN) and know which of the three a mutation actually reaches. → [05h](05h-a-shared-cache-across-instances.md), [05c](05c-the-cdn-layer-and-cache-control.md)

## The seam that ties four of them together

Seams 3 and 5 meet in one place, and it is the most valuable thing in this milestone to get right:

```ts
// app/actions/move-card.ts
'use server'

import 'server-only'
import { requireBoardAccess } from '@/lib/dal'   // seam 3: the ONE authorisation path
import { db } from '@/db'
import { cards, jobs, boardEvents } from '@/db/schema'

export async function moveCard(cardId: string, toBoardId: string, position: number) {
  const user = await requireBoardAccess(toBoardId)      // re-verified INSIDE the action

  await db.transaction(async (tx) => {
    await tx.update(cards)
      .set({ boardId: toBoardId, position })
      .where(eq(cards.id, cardId))

    // seam 4: the event the SSE stream will replay, with a monotonic id
    await tx.insert(boardEvents).values({ boardId: toBoardId, kind: 'card.moved', cardId })

    // seam 5: enqueued in the SAME transaction as the write that caused it.
    // If the update rolls back, the job was never enqueued. No broker can promise this.
    await tx.insert(jobs).values({
      kind: 'digest.recompute',
      payload: { boardId: toBoardId },
      idempotencyKey: `digest:${toBoardId}:${todayUtc()}`,
    })
  })

  revalidateTag(`board:${toBoardId}`)   // seam 6: layer 1 of 3 — know the other two
}
```

Four chapter concerns in one function, and none of them is an add-on: the authorisation is inside the action because the action is its own entry point, the event row exists because a resumable stream needs durable history rather than process memory, the job shares the transaction because that is the entire argument for a database-backed queue, and the `revalidateTag` is annotated because it is one layer of three.

## Acceptance

You have finished this milestone when you can answer these without opening anything:

1. How many database connections does a peak-traffic deploy of SprintDesk open, and what are the three ways to reduce it?
2. What proves, at deploy time, that the running database matches your schema — and what happens to the deploy if it does not?
3. Which entry points can mutate a card, and where does each one check authorisation?
4. Your live board stalls in production and works locally. What do you check, in what order?
5. A digest job runs twice. Why is that expected, and what makes it harmless?
6. A user reports the board is stale for them and fresh for a colleague. Which of your caches is responsible, and how would you tell?

Every one of those is a failure this chapter names and none is detectable by reading your own code. If you can answer all six, the chapter has done its job.

## Gotchas

**★ Symptom: SprintDesk works for one developer and returns `too many connections` the first time two people use it.** Cause: the app is on the direct Neon endpoint, so every instance holds real Postgres backends and the count is instances × pool `max`. Fix: the app gets the **pooled** connection string and the migration runner gets the direct one. They are two different variables and neither is a default:

```ts
// db/index.ts — the application
export const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema })
// drizzle.config.ts — the migration runner
dbCredentials: { url: process.env.DIRECT_URL }
```

**★ Symptom: the board renders, and moving a card throws about a column that is in your schema file.** Cause: the migration was generated and never applied — the schema file is a claim and only an applied migration makes it true. Fix: `drizzle-kit migrate` as a release step against `DIRECT_URL`, gated so a pending migration fails the deploy instead of the first request.

**★ Symptom: a user who is not on a board can still move its cards, despite the board page redirecting them.** Cause: the page-level check controls which UI renders; the Server Action is a separate entry point reachable by anyone who can send the same POST. Fix: re-verify inside the action, through the same data access layer the Route Handlers use — one authorisation path, not one per entry point.

**★ Symptom: the live board updates instantly on localhost and never updates in production.** Cause: something between your handler and the browser is buffering — a proxy, a CDN, or a compression layer. `next dev` has no such hop, which is exactly why the environment does not reproduce it. Fix: diagnose downstream rather than editing the handler; the layer-by-layer list is in [03h](03h-what-silently-breaks-sse-in-production.md).

**★ Symptom: a user reconnects to the live board and misses the moves that happened while they were away.** Cause: events were held in process memory, and the instance holding them was replaced. Fix: write events durably with a monotonic id and let the reconnecting client resume from `Last-Event-ID` — which is why `moveCard` above inserts a `boardEvents` row inside the transaction rather than pushing to an in-memory list.

**★ Symptom: a digest email goes out for a card move that was rolled back.** Cause: the job was enqueued to a broker outside the transaction, so the enqueue committed and the write did not. Fix: enqueue into a `jobs` table in the same transaction as the write. This is the one capability a database-backed queue has that a separate broker structurally cannot offer.

**★ Symptom: some users get two digest emails.** Cause: delivery is at-least-once and a worker that dies after sending but before marking the job done will have it re-claimed. Fix: this is expected, not a bug — make it harmless with an idempotency key stored durably, as `digest:${boardId}:${todayUtc()}` does above.

**★ Symptom: a board is stale for one user and fresh for another, with no pattern and no errors.** Cause: `revalidateTag()` reached the instance that handled the mutation and no others. Fix: know your three cache layers and which the mutation actually reaches — a shared cache handler covers the second, and a CDN purge covers the third.

**★ Symptom: the milestone "passes" because nobody hit any of these.** Cause: every failure in this chapter is silent, so absence of a report is not evidence. Fix: prove each seam closed rather than unobserved — the six acceptance questions above are the test, and each one has a concrete answer for your deployment.

## Interview questions

**★ Why is the ORM choice the least important decision in this milestone?**
Because the failure that actually takes SprintDesk down is connection exhaustion, and its arithmetic — instances multiplied by pool size — is identical under Drizzle, Prisma and hand-written `pg`. The three escapes are the same three in every case. The ORM decides how pleasant the schema and queries are, which matters over months; the connection architecture decides whether the first traffic spike is an outage, which matters on day one.

**★ Why enqueue the digest job in the same transaction as the card move, rather than using a dedicated broker?**
Because it makes the enqueue atomic with the write that justifies it. If the update rolls back, the job was never enqueued; if the job exists, the write definitely happened. A separate broker cannot participate in your database transaction, so it forces you to choose between enqueueing before the commit — and possibly sending mail for a write that failed — or after it, and possibly losing the job if the process dies in between. That single property is the strongest argument for a database-backed queue, and it is worth more than the operational polish a real broker offers.

**★ A page redirects unauthorised users. Why does the Server Action still need its own check?**
Because they are different entry points to the same server. The redirect decides what UI is rendered; the action is a POST endpoint that anyone who can construct the request can call directly, with no page render involved. Treating the page check as protection means the security of a mutation depends on the attacker using your UI, which is not a property you can rely on.

**★ Your live board works locally and stalls in production. What is your first move, and what is your last?**
First, confirm whether any bytes arrive at all — if the initial keep-alive comment does not reach the browser immediately, the problem is downstream of your handler and nothing you change in the route will help. Last, and only after ruling out every buffering layer, look at the handler itself. The order matters because the handler is the thing you can edit, so it is where people start, and it is almost never the cause.

**★ Why is "we never saw that bug" not an acceptable answer for any of the six seams?**
Because all six fail silently. Connection exhaustion looks like slowness until it looks like an outage; an unapplied migration only surfaces on the code path that touches the new column; an unprotected action produces no error for the attacker or the victim; a buffered stream is a connection that succeeds and says nothing; a duplicated job sends a second email nobody reports; and a per-instance invalidation is correct for whoever happens to be routed to the right instance. None of them produces a log line you would notice, so each has to be demonstrated closed rather than assumed absent.

**★ You have to cut one of the three features to ship. Which, and why?**
The live board, because SSE is the feature whose value is most easily approximated — polling at a sane interval gives most of the benefit with none of the streaming, buffering or connection-lifetime problems, and it degrades gracefully. The database work cannot be cut because everything depends on it, and the background job cannot be cut because the alternative is doing that work inside a request, which is the failure the chapter opens with. Streaming is the one where a cheaper approximation is genuinely close.

## Where this connects

- [ch16 · Building a CRUD API with Postgres](../16-building-a-crud-api-with-postgres/01-explanation.md) — this chapter answers *which*, ch16 answers *how, and what breaks when two requests overlap*
- [ch17 · Deployment, scaling and observability](../17-deployment-scaling-and-observability/01-explanation.md) — the platform view of seams 1, 4 and 6
- [ch10 · Forms, authentication and security hardening](../10-forms-authentication-and-security-hardening/01-explanation.md) — the auth material seam 3 assumes

---

← [05h · A shared cache across instances](05h-a-shared-cache-across-instances.md) · [Chapter 15 overview](01-explanation.md) · Next chapter → [16 · Building a CRUD API with Postgres](../16-building-a-crud-api-with-postgres/01-explanation.md)
