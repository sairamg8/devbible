---
title: "A serverless request has a lifetime, and that lifetime ends at the response — so any work that outlives the response has to be handed to something with a different lifetime, which is what a queue is"
sidebar_label: "04 · Background jobs and queues"
sidebar_position: 4
description: "Why slow work cannot live in a request handler, what after() actually buys you, the anatomy of a durable job system, and the map of this topic's chunks."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the Next.js
> [`after`](https://nextjs.org/docs/app/api-reference/functions/after) and
> [`maxDuration`](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/maxDuration)
> references, the Vercel
> [`@vercel/functions` reference](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package)
> (`waitUntil`, `getDeadline`) and [Queues concepts](https://vercel.com/docs/queues/concepts),
> and the PostgreSQL 18 [`SELECT` locking clause](https://www.postgresql.org/docs/18/sql-select.html).
> Documentation-verified, **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · React 19.2.8 · Node 24.20.0 · PostgreSQL 18.4 · `pg` 8.23.0.

**Every request handler you write is a coroutine with a hard deadline. The platform starts it when the request arrives, and it is entitled to stop it when the response finishes or when the configured maximum duration elapses — whichever comes first. That is not a bug you can configure away; it is the request/response model, and it is the only reason background jobs exist as a category. The entire topic reduces to one move: inside the request, *record the intent* durably and return; outside the request, in something whose lifetime you control, *perform the work*. Everything else on these pages — `after()`, `SKIP LOCKED`, visibility timeouts, idempotency keys, dead-letter tables, cron secrets — is a variation on where that "outside" lives and how the two halves stay honest with each other.**

## The lifetime problem, stated precisely

A Route Handler or Server Action runs inside an invocation. The invocation is billed, bounded, and disposable. Next.js exposes the bound as route segment config:

> *"The `maxDuration` option allows you to set the maximum execution time (in seconds) for server-side logic in a route segment. Deployment platforms can use `maxDuration` from the Next.js build output to add specific execution limits."*
> — [Next.js · `maxDuration`](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/maxDuration)

Notice what that sentence does *not* say: it does not promise you any particular number, and it does not promise the platform honours an arbitrary value. The ceiling is the platform's, and Next.js only forwards your request for one. Treat any specific figure you remember as a plan detail that will change under you; the *shape* — there is a ceiling, and exceeding it kills the invocation — is the durable fact.

The second half of the problem is that extending the invocation past the response does not remove the ceiling, it merely moves what is under it:

> *"Promises passed to `waitUntil()` will have the same timeout as the function itself. If the function times out, the promises will be cancelled."*
> — [Vercel · `@vercel/functions`](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package)

That is the sentence people are surprised by. `after()` and `waitUntil()` decouple the work from the *response*, not from the *invocation*. A 90-second video transcode scheduled with `after()` inside a route whose ceiling is 60 seconds is a 60-second transcode followed by a cancellation, and — this is the part that hurts — the user already got a `200`.

## The user-visible symptom

The reason this topic is worth a chapter is that the failure does not look like a failure.

1. The user submits the form. The mutation writes the row. The action returns.
2. The UI shows success, because it was successful — the row is there.
3. The email never arrives. The thumbnail never renders. The webhook is never delivered. The search index never learns about the row.
4. There is no error in the client, no error in the user's face, and depending on how the work was scheduled, possibly no error in your logs either — a cancelled promise does not necessarily throw anywhere you are listening.

**A mutation that "worked" and then did not** is the signature of side-effect work living inside a request lifetime. When you see it, do not start by looking at the email provider. Start by asking where the code that sends the email was running, and what killed it.

## The shape of the fix

Split the operation at the point where durability is achieved:

```ts
// app/actions/publish.ts — the shape, in outline
'use server'

export async function publishPost(formData: FormData) {
  const id = String(formData.get('id'))

  // Half 1 — inside the request. Fast, transactional, and the ONLY part
  // whose failure the user is allowed to see.
  await db.transaction(async (tx) => {
    await tx.query(`UPDATE posts SET status = 'published' WHERE id = $1`, [id])
    await tx.query(
      `INSERT INTO jobs (kind, payload) VALUES ('post.published', $1)`,
      [JSON.stringify({ postId: id })],
    )
  })

  // Half 2 — somewhere else, later, retried until it succeeds.
  // Nothing about it happens here.
}
```

Two properties of that snippet carry the whole design:

- **The enqueue is in the same transaction as the write that caused it.** If the `UPDATE` rolls back, the job disappears with it; if the job insert fails, the publish rolls back. There is no state in which the post is published and nobody was told. This is the single strongest technical argument for a queue that lives in your database, and no external broker can offer it — see [04g · Broker, database, or hosted queue](04g-broker-database-or-hosted-queue.md).
- **The handler returns having promised nothing about the work.** The user is told "published", which is true. They are not told "emailed", because that has not happened yet and the UI should not claim it has.

## Where "somewhere else" can live

| Mechanism | Lifetime | Retries? | Survives a crash? | Use it for |
|---|---|---|---|---|
| `after()` / `waitUntil()` | The **same invocation**, extended past the response | ❌ none | ❌ no | Logging, analytics, cache warming — work whose loss is acceptable |
| Postgres job table + worker | The worker's, independent of any request | ✅ yours to define | ✅ yes, it is a row | Anything transactional with your own data |
| Redis-backed broker (BullMQ) | A long-lived worker process | ✅ built in | ✅ subject to Redis persistence | High throughput, rich scheduling, existing Redis |
| Hosted queue (Vercel Queues, SQS) | The platform's | ✅ built in | ✅ yes | Fan-out, cross-service, no infra to run |
| Cron hitting a Route Handler | One invocation per tick | ⚠️ **no retry on Vercel** | n/a | Reconciliation sweeps, not per-event work |

🔴 The first row is the one that gets misused. `after()` is a *response* decoupler, not a job system. It has no durable record, so there is nothing to retry from and nothing to inspect afterwards. [04b](04b-after-and-waituntil-are-not-a-queue.md) is that argument in full, because getting it wrong is the most common way this topic is failed.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| b | **[`after()` and `waitUntil` are not a queue](04b-after-and-waituntil-are-not-a-queue.md)** | What `after()` genuinely guarantees, the `waitUntil` primitive underneath it, the request-API rules that differ by call site, graceful shutdown drain, and 🔴 the four properties it does not have |
| c | **[The anatomy of a job](04c-the-anatomy-of-a-job.md)** | The six responsibilities, the state machine, snapshot versus reference payloads · 🔴 the dual write and the transactional outbox · deploy skew · why queues are not ordered |
| d | **[Postgres as a queue: `SELECT … FOR UPDATE SKIP LOCKED`](04d-postgres-as-a-queue-skip-locked.md)** | 🔴 The load-bearing chunk. The table, the enqueue, the claim query, what happens without `SKIP LOCKED`, the CTE locking trap, the `OFFSET` trap — real SQL, real TypeScript |
| da | **[Leases and the claim lifetime](04da-leases-and-the-claim-lifetime.md)** | The visibility timeout, the reaper, heartbeats and the `locked_until > now()` guard, which transaction the work lives in, and the ack that proves ownership |
| db | **[Backoff, dead letters and pruning](04db-backoff-dead-letters-and-pruning.md)** | Exponential backoff with jitter in SQL, permanent versus transient errors, choosing `max_attempts`, the dead-letter path, the staggered requeue, batched pruning |
| e | **[At-least-once and the dedupe table](04e-at-least-once-and-idempotency.md)** | Why exactly-once is not on offer, natural idempotence, conditional writes, 🔴 the dedupe table committed in the same transaction as the effect, and where the key comes from |
| ea | **[External effects and provider idempotency](04ea-external-effects-and-provider-idempotency.md)** | 🔴 A timeout is an unknown outcome, not a failure · provider idempotency keys and their expiry window · reconciliation when there is no key · email · what you owe your own consumers |
| f | **[Waking the worker](04f-waking-the-worker.md)** | Where the worker process actually lives, the cron-driven drain, the poll loop with idle backoff, batch versus concurrency versus `pool.max`, and a shutdown that returns leases |
| fa | **[`LISTEN`/`NOTIFY` and the latency floor](04fa-listen-notify-and-the-latency-floor.md)** | Transactional notification delivery, the dedicated session it needs, the 8000-byte payload rule, 🔴 the shared notification queue that can fail every commit, and why polling stays |
| g | **[Broker, database, or hosted queue](04g-broker-database-or-hosted-queue.md)** | The one property you cannot rebuild · what a Postgres queue costs your primary · BullMQ with real code and its long-lived-process requirement · hosted queues · the outbox hybrid |
| h | **[Cron, and why the handler it hits needs auth](04h-cron-and-scheduled-work.md)** | `CRON_SECRET` and the `Bearer` comparison, best-effort delivery, no retries, overlapping runs and advisory locks, 🔴 why cron should enqueue rather than execute |
| i | **[Knowing the queue is behind](04i-queue-observability.md)** | Depth versus oldest-claimable age, arrival against completion rate, latency decomposed, 🔴 the conjunction alert that catches a dead fleet, tracing across the enqueue boundary |

## Phase gate

You are done with this topic when you can take a Server Action that currently sends an email inline, move the send behind a Postgres job table in the same transaction as the write, write the claim query with `SKIP LOCKED` from memory including the visibility timeout and attempt counter, explain what happens to two concurrent workers with and without `SKIP LOCKED`, name the key your handler deduplicates on, and say — with a number from a query, not a feeling — whether the queue is currently keeping up.

## Where this connects

- [01c · Transaction pooling and session state](01c-transaction-pooling-and-session-state.md) — a claim query holds a transaction open across several statements, so it needs a real session, not a pooled statement dispatcher. This is a hard dependency of [04d](04d-postgres-as-a-queue-skip-locked.md).
- [01b · The three kinds of pool](01b-the-three-kinds-of-pool.md) — worker concurrency and pool `max` are the same number viewed twice.
- [03e · Pull sources and back-pressure](03e-pull-sources-and-back-pressure.md) — the durable-log shape a resumable SSE stream rests on is the same table shape as a job queue.
- [PostgreSQL · `SKIP LOCKED`](../../../postgresql/pages/phase-11-mvcc/08-skip-locked.md) and [advisory locks](../../../postgresql/pages/phase-11-mvcc/15-advisory-locks.md) — the locking primitives, taught from the database side.
- [05 · Edge functions and custom cache structures](05-edge-functions-and-custom-cache-structures-for-global-comput.md) — the other half of "where does this code run".

## Gotchas

**★ Symptom: the action returns success and the side effect silently never happens.** Cause: the side effect was awaited *after* the response, or not awaited at all, inside an invocation the platform is entitled to reclaim. Fix: make the durable record part of the transaction that made the response true, so the two cannot disagree — the `INSERT INTO jobs` in the outline above sits inside the same `db.transaction` as the `UPDATE`.

**★ Symptom: raising `maxDuration` fixed it in staging and it broke again in production.** Cause: `maxDuration` is a *request* to the platform, and the platform's own ceiling — plan-dependent and not documented in the Next.js reference — still applies. You bought headroom, not a guarantee, and the job simply grew past the new number. Fix: stop scaling the ceiling and change the shape. Work that grows with your data must be chunked into units that each fit comfortably inside a fixed budget:

```ts
// Instead of "process every pending row", claim a bounded batch and
// re-enqueue a continuation. Each invocation is O(BATCH), not O(table).
const BATCH = 50
const rows = await claimBatch(BATCH)
for (const row of rows) await handle(row)
if (rows.length === BATCH) await enqueue('sweep.continue', {})
```

**Symptom: you cannot tell whether a job ran, from the logs.** Cause: the job had no identity — it was a closure passed to `after()`, so there is no row, no id, and nothing to correlate. Fix: give every unit of work a row before you start it. If a thing cannot be named in a `SELECT`, you will never be able to answer "did it run?" during an incident.

**Symptom: a retry double-charged a customer.** Cause: at-least-once delivery met a non-idempotent handler. Every durable queue worth using redelivers on ambiguity, so this is a property of the model, not of your broker. Fix: [04e](04e-at-least-once-and-idempotency.md) — a stored idempotency key, checked and inserted in the same transaction as the effect.

**Symptom: "we'll just use cron" and events are hours late.** Cause: cron is a *clock*, not a queue. A five-minute cron gives you a five-minute worst-case latency floor and no per-event durability — the tick that failed is simply gone, because on Vercel *"Vercel will not retry an invocation if a cron job fails"*. Fix: use cron for reconciliation sweeps that are safe to miss and safe to repeat, and a queue for anything with a per-event outcome. [04h](04h-cron-and-scheduled-work.md) draws the line.

## Interview questions

**★ Why can't you just do the slow work in the request handler and let the user wait?**
Three separate reasons, and only the first is about the user. One: the response is the user's feedback loop, and a thirty-second spinner on a "Publish" button is a product failure independent of any infrastructure. Two: the invocation has a maximum duration, so past some input size the work does not merely feel slow, it is *killed mid-way*, leaving a half-applied side effect with no record of how far it got. Three: the request handler has no retry semantics — if the email provider is having a bad minute, the user's only recovery is to press the button again, which is also how you get duplicate sends. A queue fixes all three at once, and that is why it is one mechanism rather than three.

**★ What is the actual difference between `after()` and a queue?**
Durability and retries. `after()` schedules a callback to run in the same invocation after the response is flushed — the work is still bounded by that invocation's deadline and, crucially, exists only as a promise in memory. If the process dies, or the deadline is hit, that promise is cancelled and there is no artifact left behind saying it should have happened. A queue writes a row first; the row survives the process, can be claimed by a different machine, and carries a counter saying how many times it has been tried. `after()` is the right tool when losing the work costs you a log line. It is the wrong tool the moment losing the work costs you a customer.

**★ Why is putting the queue in your own database an architectural argument rather than a laziness argument?**
Because a broker cannot participate in your database transaction. If you `COMMIT` the order and then publish to Redis, there is a window in which the commit succeeded and the publish did not, and the order sits forever with nobody notified. If you publish first and then commit, there is a window in which a worker picks up a job for an order that does not exist. Neither ordering is safe, and the standard escape — a transactional outbox — is *already a job table in your database*, so at that point you have built the Postgres queue anyway and added a broker on top of it. Choosing Postgres directly is choosing to keep the one guarantee that is genuinely hard to reconstruct.

**What would make you move off a Postgres queue?**
Volume and shape, not aesthetics. A job table is rows being inserted, updated and deleted at high rate, which is dead tuples and vacuum pressure on your primary — the same instance serving user reads. When the queue's write rate starts materially affecting the application's read latency, or when you need fan-out to several independent consumer groups, or delayed delivery measured in days with millions of pending items, the queue has outgrown a table. The honest trigger is a measurement, and the measurements to take are in [04i](04i-queue-observability.md).

**A colleague says "we need exactly-once delivery". What do you say?**
That they can have exactly-once *effects*, which is what they actually want, but not exactly-once *delivery*, which is not on offer from any queue that also survives crashes. The reason is fundamental: a worker that dies between doing the work and acknowledging it is indistinguishable, from the queue's side, from a worker that died before doing the work. The queue must choose between redelivering (at-least-once, risking duplicates) and not redelivering (at-most-once, risking loss), and every system you would want to use chooses redelivery. Vercel Queues states it plainly — *"Delivery is at-least-once, so consumers should be idempotent."* The engineering work is therefore in the handler, not in the queue.

---

← [03e · Pull sources and back-pressure](03e-pull-sources-and-back-pressure.md) · [Chapter 15 overview](01-explanation.md) · Next → [04b · `after()` and `waitUntil` are not a queue](04b-after-and-waituntil-are-not-a-queue.md)
