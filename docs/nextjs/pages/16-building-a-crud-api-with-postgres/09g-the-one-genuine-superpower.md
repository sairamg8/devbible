---
title: "Enqueueing a job in the same transaction as the write that causes it is the one thing a database-backed queue can do that no external broker structurally can — and it is worth more than every operational feature a real broker offers, because it removes a class of bug rather than making one easier to survive"
sidebar_label: "09g · The one genuine superpower"
sidebar_position: 52
description: "The two-generals problem between a database and a broker, why both orderings are wrong, the transactional outbox written against the chapter's schema, what the pattern does and does not give you, and the honest list of what you give up by not running a broker."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 manual — [`SELECT`, The Locking Clause](https://www.postgresql.org/docs/18/sql-select.html), [3.4. Transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html) — and the published `drizzle-orm` **0.45.2** typings ([unpkg](https://unpkg.com/drizzle-orm@0.45.2/pg-core/session.d.ts)). The queue mechanics are carried from ch15 [04d](../15-databases-apis-and-full-stack-patterns/04d-postgres-as-a-queue-skip-locked.md), verified there.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · `pg` **8.23.0** · **Next.js 16.3.4** · Node **24.20.0**.

**Every page in this topic so far has been about what a transaction costs and what it cannot do. This one is about the single thing it can do that nothing else can. When the job that must happen because of a write lives in the same database as the write, the enqueue and the write are one atomic fact: if the update rolls back the job was never enqueued, and if the job exists the update definitely committed. A separate broker — Kafka, SQS, RabbitMQ, anything — cannot participate in your database transaction, so it forces you to choose between enqueueing before the commit and possibly acting on a write that failed, or after it and possibly losing the job entirely. That is not a configuration problem you can solve with retries; it is a structural property of having two systems that cannot agree. This is the closing page of the topic because it is the payoff for everything the previous six pages said no to.**

## The two orderings, and why both are wrong

You have written a card move and you need to send a digest email. The broker is a different system. Pick an order.

**Order A — publish first, then commit:**

```text
t1  BEGIN
t2  UPDATE cards …
t3  broker.publish('digest.recompute', { boardId })     ← committed to the broker
t4  ROLLBACK  (a constraint failed, a serialization failure, the process died)
────────────────────────────────────────────────────────────────────────────
result: a digest is computed and mailed for a move that did not happen.
```

**Order B — commit first, then publish:**

```text
t1  BEGIN
t2  UPDATE cards …
t3  COMMIT                                              ← durable
t4  process dies / broker unreachable / network partitions
────────────────────────────────────────────────────────────────────────────
result: the move happened and no digest will ever be computed. Nothing knows.
```

🔴 **There is no third ordering.** Two systems, no shared transaction, and the failure window between them cannot be closed by retrying — a retry in order B requires the process to still be alive, which is exactly what the failure removed. This is the classic distributed-systems problem, and the usual answers to it (two-phase commit, sagas) are heavier than the entire feature you were trying to ship.

## The move that removes the problem

**Put the queue in the database.** Then there are not two systems, and the ordering question evaporates.

```ts
// lib/dal/cards.ts
export async function moveCard(cardId: string, toBoardId: string, position: number,
                               expectedVersion: number, actorId: string) {
  return db.transaction(async (tx) => {
    const [moved] = await tx.update(cards)
      .set({ boardId: toBoardId, position,
             version: sql`${cards.version} + 1`, updatedAt: sql`now()` })
      .where(and(eq(cards.id, cardId), eq(cards.version, expectedVersion),
                 isNull(cards.deletedAt)))
      .returning()
    if (!moved) return null            // conflict or gone — 07d disambiguates

    // the durable history the SSE stream replays from
    await tx.insert(boardEvents).values({
      boardId: toBoardId, kind: 'card.moved', cardId, actorId,
    })

    // the work that must happen BECAUSE of this write — same transaction, same fact
    await tx.insert(jobs).values({
      kind: 'digest.recompute',
      payload: { boardId: toBoardId },
      idempotencyKey: `digest:${toBoardId}:${todayUtc()}`,
      runAfter: sql`now()`,
    })

    return moved
  })
}
```

That is the `moveCard` from the ch15 milestone ([06](../15-databases-apis-and-full-stack-patterns/06-project-milestone-sprintdesk-on-drizzle-neon-with-pooling.md)), now with the version predicate from [07d](07d-optimistic-concurrency-with-a-version-column.md) and the soft-delete guard from [08b](08b-what-soft-delete-costs-every-read.md). Three inserts and an update, one atomic fact.

**The guarantee, stated exactly:** the `jobs` row and the `cards` row commit together or not at all. There is no window. There is nothing to retry across, because there is nothing between them.

## Why the worker completes the picture

The enqueue is atomic; the *execution* is a separate transaction, and it is what turns "a row exists" into "the work happened". The claim query is ch15 [04d](../15-databases-apis-and-full-stack-patterns/04d-postgres-as-a-queue-skip-locked.md)'s subject, and it rests on one clause:

> *"With `SKIP LOCKED`, any selected rows that cannot be immediately locked are skipped. Skipping locked rows provides an inconsistent view of the data, so this is not suitable for general purpose work, but can be used to avoid lock contention with multiple consumers accessing a queue-like table."*
> — [PostgreSQL 18 · `SELECT`](https://www.postgresql.org/docs/18/sql-select.html)

```sql
-- claim one job; concurrent workers get different rows rather than waiting
WITH claimed AS (
  SELECT id FROM jobs
   WHERE status = 'pending' AND run_after <= now()
   ORDER BY run_after, id
   LIMIT 1
   FOR UPDATE SKIP LOCKED
)
UPDATE jobs SET status = 'running', leased_until = now() + interval '5 minutes'
  FROM claimed WHERE jobs.id = claimed.id
RETURNING jobs.*;
```

🔴 **The worker's transaction must not contain the external effect either** — [09f](09f-transaction-duration-as-pool-occupancy.md)'s rule does not stop applying because you are now a worker. Claim in one transaction, perform the effect outside it, mark done in a second transaction. That leaves a window where the effect happened and the job is not yet marked done, which is why **delivery is at-least-once and handlers must be idempotent** — the `idempotencyKey` above, and ch15 [04e](../15-databases-apis-and-full-stack-patterns/04e-at-least-once-and-idempotency.md).

## What the pattern gives you, precisely

| Property | Delivered? |
|---|---|
| The job exists **iff** the write committed | ✅ — this is the whole point |
| Exactly-once **enqueue** | ✅ |
| Exactly-once **execution** | ❌ — at-least-once; handlers must be idempotent |
| Ordering between jobs | ⚠️ only what your `ORDER BY` gives; not a guarantee |
| Survives the process dying after commit | ✅ — the row is durable, a worker will find it |
| Survives the *database* dying | ✅ to the same degree your data does; the job is your data |
| Fan-out to many independent consumers | ❌ — this is a work queue, not a log |
| Retention, replay, consumer groups, partitioning | ❌ |

**The single row in that table that justifies the whole design is the first one.** Everything else is either something you build (backoff, dead letters, leases — ch15 [04da](../15-databases-apis-and-full-stack-patterns/04da-leases-and-the-claim-lifetime.md), [04db](../15-databases-apis-and-full-stack-patterns/04db-backoff-dead-letters-and-pruning.md)) or something you accept not having.

## The honest cost

This is not a free win and pretending otherwise is how teams end up rebuilding Kafka badly.

**What you give up by not running a broker:**

- **Throughput ceiling.** The queue's writes and the application's writes hit the same database, and the claim query takes row locks on a hot table. At high enough volume a dedicated broker is genuinely better, and "high enough" is a number you should measure rather than guess.
- **Fan-out.** One job row is claimed by one worker. Several independent consumers of the same event is a log, not a queue, and this pattern does not give you one.
- **Operational maturity.** Dead-letter handling, exponential backoff, visibility timeouts, poison-message quarantine, consumer lag dashboards — a broker ships these. You will write them, and yours will be worse for a while.
- **Isolation of failure domains.** Queue load now affects your application's database. A broker having a bad day is a degraded feature; your database having a bad day is an outage.

**The pattern that gets you both**, and the reason this is not an either/or: keep the outbox in Postgres for atomicity, and have a relay process read committed outbox rows and publish them to the broker. The atomicity is preserved because the outbox row committed with the write; the broker gets the fan-out and the operations. You have moved the two-generals problem to a place where a retry actually helps — the relay can retry forever against a durable row, which is the thing order B could not do.

```sql
-- the relay's read: committed rows only, claimed the same way as any job
SELECT id, kind, payload FROM outbox
 WHERE published_at IS NULL
 ORDER BY id
 LIMIT 100
 FOR UPDATE SKIP LOCKED;
```

⚠️ The relay is at-least-once too, so the broker's consumers must be idempotent regardless. You have not removed that requirement; you have moved it one hop.

## Gotchas

**★ Symptom: an email went out for a card move that was rolled back.** Cause: the publish happened before the commit — order A — so the broker accepted work for a write that never landed. Fix: the enqueue is an `INSERT` inside the same transaction as the write, so a rollback removes it. That is the entire pattern.

**★ Symptom: a write committed and the job it should have triggered never ran.** Cause: order B — the publish happened after the commit and something failed in between. There is no error anywhere, because the commit succeeded and the process that would have reported the failure is the one that died. Fix: same — one transaction, one fact.

**★ Symptom: the job row is inserted in the transaction and the worker never sees it.** Cause: the insert used `db` instead of `tx`, so it committed independently and *is* visible — or it used `tx` correctly and the worker's polling predicate does not match (`run_after` in the future, wrong `status`). Fix: check [09b](09b-the-tx-rule.md) first, because it is the failure that also breaks the guarantee; then check the claim predicate against what you actually inserted.

**★ Symptom: some users get two digest emails.** Cause: at-least-once delivery — a worker that dies after performing the effect but before marking the job done will have the job re-claimed when its lease expires. Fix: this is expected and is made harmless with a durable idempotency key, as `digest:${boardId}:${todayUtc()}` does; the provider-side version is ch15 [04ea](../15-databases-apis-and-full-stack-patterns/04ea-external-effects-and-provider-idempotency.md).

**★ Symptom: the worker holds a transaction open while calling an email API.** Cause: the claim, the effect and the completion were written as one transaction. Fix: three phases — claim in a transaction, effect outside, complete in a second transaction. [09f](09f-transaction-duration-as-pool-occupancy.md)'s rule applies to workers exactly as it applies to request handlers.

**★ Symptom: two workers process the same job.** Cause: the claim query lacks `SKIP LOCKED`, or the locking clause was placed outside the CTE so it never applied to the selected rows. Fix: `FOR UPDATE SKIP LOCKED` inside the `SELECT` that picks the row, as in the claim above; the CTE-placement trap is spelled out in ch15 [04d](../15-databases-apis-and-full-stack-patterns/04d-postgres-as-a-queue-skip-locked.md).

**★ Symptom: the `jobs` table grows without bound and every claim gets slower.** Cause: completed jobs are never removed, so the index the claim scans keeps growing. Fix: prune on a schedule, and index the claim's predicate partially so completed rows are not in it:

```sql
CREATE INDEX jobs_pending_idx ON jobs (run_after, id) WHERE status = 'pending';
DELETE FROM jobs WHERE status = 'done' AND completed_at < now() - interval '7 days';
```

**★ Symptom: queue load starts affecting ordinary API latency.** Cause: the queue and the application share a database, so the claim query's row locks and the worker's writes compete with request traffic for the same connections. Fix: this is the design's central trade-off, not a bug — size the worker pool separately, cap worker concurrency, and treat crossing this threshold as the signal to move to a relay-plus-broker topology rather than tuning further.

**★ Symptom: someone proposes replacing the outbox with the broker "because we already run Kafka".** Cause: the atomicity argument is not widely known, so the outbox looks like duplicated infrastructure. Fix: state the two orderings and ask which one they want. Then offer the relay — outbox in Postgres for atomicity, broker for fan-out and operations — which is not a compromise but the correct architecture for a system that has both.

**★ Symptom: a `revalidateTag()` fired for a transaction that rolled back.** Cause: cache invalidation is an external effect placed inside the transaction callback. Fix: it goes after the transaction resolves — or, if it must be reliable rather than best-effort, it becomes a job row like everything else.

## Interview questions

**★ What can a database-backed queue do that a dedicated broker structurally cannot?**
Enqueue atomically with the write that justifies the job. Because the job row is in the same database, it is covered by the same transaction: if the write rolls back the job was never enqueued, and if the job exists the write definitely committed. A broker cannot join your database transaction, so it forces a choice between publishing before the commit — risking work for a write that failed — and publishing after it — risking losing the job if the process dies in between. No amount of retry configuration closes that window, because the failure that opens it is the one that removes the retrier.

**★ Walk me through both orderings and say why neither is acceptable.**
Publish-then-commit means the broker has accepted work that your database may then reject: a constraint violation, a serialization failure, or a crash produces a digest email for a move that did not happen, and there is no compensating message because the process that would send it is the one that failed. Commit-then-publish means the write is durable and the job may never exist: the process dies between the two statements and nothing anywhere knows there was work to do. The first is a visible wrong action; the second is a silent omission, which is worse because nothing will ever surface it.

**★ Does putting the queue in Postgres give you exactly-once execution?**
No. It gives exactly-once *enqueue*. Execution is at-least-once, because the worker must perform the external effect outside its transaction — otherwise a slow provider holds a database connection — which leaves a window where the effect happened and the job is not yet marked done. A worker that dies in that window has its job re-claimed when the lease expires. So handlers must be idempotent, and the practical mechanism is a durable idempotency key stored with the job and honoured by the provider.

**★ What do you give up by not running a real broker?**
Throughput headroom, because the queue competes with your application for the same database and the same connections. Fan-out, because a claimed job belongs to one worker and several independent consumers of one event is a log rather than a queue. Operational maturity — dead letters, backoff, visibility timeouts, consumer lag dashboards — all of which you will build worse before you build them well. And failure isolation: a broker having a bad day degrades one feature, whereas your database having a bad day is an outage.

**★ Can you have both?**
Yes, and it is the right answer once you need fan-out. Keep the outbox table in Postgres so the enqueue stays atomic with the write, and run a relay that reads committed outbox rows and publishes them to the broker. The two-generals problem is still there but it has moved somewhere a retry works: the relay is retrying against a durable row rather than against a memory it lost, so it can keep trying until the broker accepts. The consumers are still at-least-once and still need to be idempotent — you moved the requirement one hop, you did not remove it.

**★ Why must the worker not hold its transaction open while performing the effect?**
Because it is subject to exactly the same pool arithmetic as a request handler: one transaction holds one connection, and an external call inside it converts the provider's latency into your database's concurrency limit. A worker that does this exhausts the pool the API also uses, so a slow email provider becomes an API outage. The correct shape is three phases — claim in a transaction, perform the effect with no transaction open, mark done in a second transaction — and the price of that shape is the at-least-once window, which idempotency covers.

**★ How does this connect back to the rest of the topic?**
It is the payoff for every restriction the earlier pages imposed. [09b](09b-the-tx-rule.md) says every query inside must use `tx` — the job insert is the one where a stray `db` silently destroys the guarantee rather than merely losing a row. [09d](09d-serialization-failures-and-the-retry-loop.md) says nothing with an external effect may go inside a retried transaction — an outbox row is not an external effect, so it is the shape that survives a retry. And [09f](09f-transaction-duration-as-pool-occupancy.md) says no network call inside a transaction — the outbox is exactly how you honour that while still guaranteeing the call happens.

---

← [09f · Duration and pool occupancy](09f-transaction-duration-as-pool-occupancy.md) · [Chapter 16 overview](01-explanation.md) · Next → [10 · Errors and one response shape](10-errors-and-one-response-shape.md)
