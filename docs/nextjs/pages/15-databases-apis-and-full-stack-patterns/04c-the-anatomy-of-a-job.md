---
title: "A job is a row with a state machine, and the only interesting design decision is whether the row is written in the same transaction as the change that caused it — because if it is not, you have a dual write and one of the two will eventually be lost"
sidebar_label: "04c · The anatomy of a job"
sidebar_position: 231
description: "The six responsibilities of any job system, the job state machine, what goes in a payload, the transactional outbox and the dual-write problem, deploy skew, and why queues are not ordered."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Vercel
> [Queues concepts](https://vercel.com/docs/queues/concepts) documentation (visibility
> timeout, at-least-once delivery, retry priority, ordering, idempotency keys, deployment
> partitioning) and the PostgreSQL 18
> [`NOTIFY`](https://www.postgresql.org/docs/18/sql-notify.html) reference (transactional
> delivery). Documentation-verified, **no sandbox run**.
> Target: **PostgreSQL 18.4** · Next.js 16.3.4 · Node 24.20.0.

**Strip away the product names and every queue is the same six things: a durable record, a way to claim it exclusively, a lease so a dead worker's claim expires, an acknowledgement, a retry policy, and somewhere for messages that will never succeed to go and stop hurting you. If you can name all six for whatever you are using, you can operate it; if you cannot, you are trusting defaults you have not read. This page is those six responsibilities, the state machine they imply, what belongs in a payload, and the one design decision that separates a queue that loses work from one that does not — whether the enqueue shares a transaction with the write that caused it.**

## The six responsibilities

| # | Responsibility | What breaks without it |
|---|---|---|
| 1 | **Durable record** | The work exists only in memory; a crash loses it with no trace — the `after()` failure mode, [04b](04b-after-and-waituntil-are-not-a-queue.md) |
| 2 | **Exclusive claim** | Two workers run the same job simultaneously; every duplicate-charge story starts here |
| 3 | **Lease / visibility timeout** | A worker that dies mid-job holds the job forever; the queue stalls behind one poisoned claim |
| 4 | **Acknowledgement** | Nothing distinguishes "finished" from "still running"; you either redeliver constantly or never |
| 5 | **Retry policy with a bound** | A permanently failing job retries forever at full speed and becomes a self-inflicted denial of service on the downstream API |
| 6 | **Dead-letter path** | Poisoned messages stay in the hot path, consuming claim capacity ahead of healthy work |

Vercel's documentation describes exactly this shape for its hosted queue:

> *"Producers publish messages to a topic. Consumer groups read and process those messages independently. Messages persist until they are acknowledged or expire. Failed processing attempts are retried automatically. Delivery is at-least-once, so consumers should be idempotent."*
> — [Vercel · Queues concepts](https://vercel.com/docs/queues/concepts)

## The state machine

```text
                    ┌──────────────────────────────────────┐
                    │                                      │ lease expires
                    ▼                                      │ (worker died)
  enqueue ──▶ [ pending ] ──claim──▶ [ running ] ──────────┘
                    ▲                    │
                    │                    ├── ack ──────▶ [ done ]
     attempts < max │                    │
     backoff delay  └── nack/throw ──────┤
                                         └── attempts ≥ max ──▶ [ dead ]
```

Four states, and each transition is a row update you can see in a `SELECT`. That visibility *is* the point — it is what `after()` cannot give you and what makes an incident debuggable at 2am.

🔴 **`running` is not a state you can trust.** It means "some worker claimed this and has not acked", which includes "a worker claimed this and was then killed by a deploy". That is why responsibility 3 exists: the state is really `running until <timestamp>`, and the timestamp is the only thing that makes recovery automatic. Vercel names the same mechanism:

> *"When a message is delivered to a consumer, it becomes temporarily invisible to other consumers in the same group. This is the **visibility timeout**."*
> *"The default visibility timeout is **60 seconds**. You can configure it per receive request from 0 to 3,600 seconds (60 minutes). Setting it to `0` peeks at the message without leasing it."*

## The payload: reference or snapshot?

A job payload should be small and self-describing. Beyond that there is one real choice, and it is a semantic one, not a performance one.

```ts
// Reference: the job carries an id and re-reads current state when it runs.
{ kind: 'order.confirmation', payload: { orderId: 'ord_8812' } }

// Snapshot: the job carries the values as they were at enqueue time.
{ kind: 'order.confirmation', payload: {
    orderId: 'ord_8812',
    email: 'ada@example.com',
    lines: [{ sku: 'KB-01', qty: 1, cents: 8900 }],
    totalCents: 8900,
} }
```

- **Reference** is right when the job should reflect *the world as it is when the job runs* — reindexing a document, recalculating an aggregate, syncing a profile to a CRM. It also keeps the payload immune to schema drift, since the worker reads through today's code.
- **Snapshot** is right when the job must reflect *the world as it was at the moment of the event* — a receipt, an audit entry, a webhook describing a state transition. A receipt that re-reads the order and finds it refunded would email the wrong total.

🔴 The failure people hit is using a reference for a snapshot-shaped job and discovering it when a row is deleted: the worker runs, finds nothing, and either throws forever or silently no-ops. If you use references, decide explicitly what a missing row means — usually "ack and move on", not "retry":

```ts
const order = await getOrder(payload.orderId)
if (!order) {
  // The referent is gone. This is a terminal success, not a failure.
  // Retrying will never find it, and DLQ-ing it creates noise.
  return { status: 'done', note: 'referent deleted' }
}
```

Never put a secret, a signed URL or a large blob in a payload. The row is persisted, replicated, backed up, and readable by anyone with database access; a payload is not a secure channel and it is not a file store. Store a key and let the worker fetch.

## 🔴 The one decision that matters: the dual write

Here is the version almost everyone writes first:

```ts
// ❌ Broken. Two systems, no shared transaction.
await db.query(`UPDATE orders SET status = 'paid' WHERE id = $1`, [orderId])
await redis.lpush('jobs', JSON.stringify({ kind: 'order.paid', orderId }))
```

There is no ordering of those two lines that is correct.

- **Commit first, publish second** — the process dies between them, or Redis is briefly unreachable. The order is paid and nobody is ever notified. No error was raised in the user's request; the loss is silent and permanent.
- **Publish first, commit second** — the transaction rolls back after the publish. A worker now picks up `order.paid` for an order that is not paid, and depending on your handler, emails a receipt for a payment that did not happen.
- **Wrap the publish in a try/catch and retry it** — you have moved the problem, not solved it. A retry loop in a dying process is still a dying process, and now you have a partially applied side effect *and* an unbounded delay in the user's request.

This is the **dual-write problem**, and the only clean fix available to an application is to make one of the two writes go through the other. That is the **transactional outbox**: the queue lives in the same database as the data, so the enqueue is just another `INSERT` in the transaction.

```ts
// ✅ One transaction. There is no state where the order is paid and no job exists.
import type { PoolClient } from 'pg'

export async function markOrderPaid(client: PoolClient, orderId: string) {
  await client.query('BEGIN')
  try {
    await client.query(
      `UPDATE orders SET status = 'paid', paid_at = now() WHERE id = $1`,
      [orderId],
    )
    await client.query(
      `INSERT INTO jobs (kind, payload, run_at)
       VALUES ('order.paid', $1, now())`,
      [JSON.stringify({ orderId })],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}
```

Both statements commit or neither does. The job's existence is now a *consequence* of the business fact rather than a second, independent attempt to record it. This is the entire argument for putting the queue in Postgres, and it is why [04g](04g-broker-database-or-hosted-queue.md) treats "one more piece of infrastructure" as the thing you are trading away rather than the thing you are gaining.

⚠️ Note the signature: `markOrderPaid` takes a `PoolClient`, not a pool. `BEGIN`/`COMMIT` across separate `pool.query()` calls is not a transaction — node-postgres is explicit that *"the pool will dispatch every query passed to `pool.query` on the first available idle client"*. See [01c · Transaction pooling and session state](01c-transaction-pooling-and-session-state.md).

### The outbox variant, when the broker is not negotiable

If you must publish to Kafka, SQS or a third-party bus, keep the shape and add a relay:

```sql
-- Same transaction as the business write.
CREATE TABLE outbox (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  topic       text        NOT NULL,
  payload     jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE INDEX outbox_unpublished ON outbox (id) WHERE published_at IS NULL;
```

A relay process claims unpublished rows, publishes them, and marks them published. The claim is the same `SKIP LOCKED` query as any other worker ([04d](04d-postgres-as-a-queue-skip-locked.md)), and the relay is at-least-once too — so the broker's consumers still need idempotency ([04e](04e-at-least-once-and-idempotency.md)). What you have bought is that the *database* is now the single source of truth for "did this event happen", which is the only question the dual write could not answer.

Note the partial index: it only covers unpublished rows, so it stays small forever even as the table grows, and the relay's scan cost does not increase with history.

## `kind` is an API, and deploy skew is real

A job enqueued at 14:00 by deployment N may be executed at 14:03 by deployment N+1, because deploys are not synchronised with queue drain. That makes the payload a wire format between two versions of your own code.

The rules that follow:

- **Never repurpose a `kind` string.** Introduce `order.paid.v2` and keep a handler for `order.paid` until the table has none left. A `SELECT count(*) … WHERE kind = 'order.paid'` tells you when it is safe to delete.
- **Only add optional fields.** A new required field breaks every in-flight job enqueued by the old deployment.
- **Validate at the handler boundary**, and treat a validation failure as terminal, not retryable — a payload that does not parse will not parse on the fourth attempt either.

```ts
import { z } from 'zod'

const OrderPaid = z.object({
  orderId: z.string(),
  // added in N+1 — optional, because jobs from N do not have it
  reason: z.string().optional(),
})

export async function handleOrderPaid(raw: unknown) {
  const parsed = OrderPaid.safeParse(raw)
  if (!parsed.success) {
    // Terminal. Send it straight to the dead-letter table; do not burn retries.
    throw new PermanentJobError('payload failed validation', parsed.error)
  }
  await sendReceipt(parsed.data)
}
```

Vercel's hosted queue makes the deploy-skew question explicit rather than solving it for you:

> *"On Vercel, topics are **partitioned by deployment ID** by default. In push mode, Vercel delivers messages back to the same deployment that published them."*

That removes skew for messages already in flight, at the cost of keeping old deployments alive to drain them. A Postgres table has no such mechanism; the compatibility discipline above is the substitute.

## Queues are not ordered, and pretending otherwise is a bug

Nothing in the six responsibilities delivers ordering, and hosted queues say so:

> *"Vercel Queues delivers messages in **approximate write order**… **Retried messages have lower priority than new messages.** … **No FIFO guarantee.** Even with a single consumer and max concurrency set to 1, message order is not strictly first-in-first-out."*

The reason is structural: the moment a job can be retried, a job enqueued later can succeed earlier. A Postgres queue claiming `ORDER BY run_at LIMIT 10` with several workers has the same property, and PostgreSQL warns about a subtler version of it in the same breath:

> *"It is possible for a SELECT command running at the READ COMMITTED transaction isolation level and using ORDER BY and a locking clause to return rows out of order. This is because ORDER BY is applied first."*
> — [PostgreSQL 18 · `SELECT`](https://www.postgresql.org/docs/18/sql-select.html)

If you need per-entity ordering — "apply these three updates to account 42 in sequence" — you do not get it from the queue. You get it from a **partition key plus a serialising lock**: all jobs for account 42 take `pg_advisory_xact_lock(hashtext('account:42'))` before doing work, so at most one runs at a time, and the rest wait or defer. Global ordering is not achievable at all with concurrent workers, and a design that requires it needs one worker, which is a throughput decision you should make deliberately.

## Gotchas

**★ Symptom: an order is paid but no confirmation was ever sent, and there is no error anywhere.** Cause: the classic dual write — the `COMMIT` succeeded and the publish to the broker did not, or the process died between them. Nothing failed loudly because nothing was watching the gap. Fix: move the enqueue inside the transaction, as `markOrderPaid` above does. If the broker is mandatory, put an `outbox` row in the transaction and relay it.

**★ Symptom: a job stays in `running` forever and the queue silently loses capacity.** Cause: the worker was killed — deploy, OOM, spot reclaim — while holding the claim, and nothing expires a claim. Fix: never store a boolean `running`; store a lease deadline, and let the claim query treat an expired lease as available:

```sql
UPDATE jobs SET locked_until = now() + interval '5 minutes'
WHERE id = $1 AND (locked_until IS NULL OR locked_until < now());
```

**★ Symptom: a malformed payload retries twenty times over four hours before dead-lettering.** Cause: the handler treats every throw the same, so a permanent error (bad JSON, unknown enum, referent deleted) consumes the full retry budget of a transient error. Fix: two error classes, and a retry policy that reads them:

```ts
export class PermanentJobError extends Error {}
export class TransientJobError extends Error {}

// in the worker
try {
  await handle(job)
  await ack(job)
} catch (error) {
  if (error instanceof PermanentJobError) await deadLetter(job, error)
  else await scheduleRetry(job, error)
}
```

**★ Symptom: after a deploy, a burst of jobs fails with "cannot read property of undefined".** Cause: deploy skew — deployment N+1's handler expects a payload field that deployment N did not write, and jobs from N are still pending. Fix: additive-only payload changes and a new `kind` when the shape genuinely breaks. Ship the handler that tolerates both *before* the producer that emits the new shape; the order of those two deploys is the whole trick.

**Symptom: a job's payload contains a pre-signed upload URL that has expired by the time it runs.** Cause: the payload snapshotted a short-lived credential. Anything time-bounded is wrong in a durable record, because the record's whole purpose is to outlive the moment. Fix: store the object key and mint the URL inside the handler, at execution time.

**Symptom: the `jobs` table is 40 GB and queries against it got slow.** Cause: completed jobs are never removed, so every index on the table also carries years of `done` rows. Fix: either delete on ack, or keep completed rows in a separate archive and prune on a schedule — plus a partial index so the hot path never touches the history:

```sql
CREATE INDEX jobs_ready ON jobs (run_at)
  WHERE status = 'pending';

DELETE FROM jobs
 WHERE status = 'done' AND finished_at < now() - interval '7 days';
```

**Symptom: three updates to one account applied in the wrong order.** Cause: you assumed FIFO. No concurrent queue offers it, and retries actively break it — a retried job is by definition later than a job enqueued after it. Fix: serialise per entity with an advisory lock keyed on the entity, and accept that jobs for *different* entities remain unordered, which is what you actually wanted:

```sql
SELECT pg_advisory_xact_lock(hashtext('account:' || $1));
```

**Symptom: a worker deleted a job it had not finished.** Cause: the ack happened before the effect, usually because the code deleted the row and then did the work "to keep the transaction short". Fix: ack after the effect is durable, always. That ordering is what makes the system at-least-once instead of at-most-once, and at-least-once is the one you can repair with idempotency — [04e](04e-at-least-once-and-idempotency.md).

## Interview questions

**★ What is the dual-write problem, and what is the standard fix?**
It is having to record one fact in two systems with no shared transaction — typically a row in your database and a message in a broker. Whichever you do first, there is a window in which it succeeded and the other did not, and no amount of retrying inside the request closes that window, because the process that would do the retrying is the thing that might die. The standard fix is the transactional outbox: write the message into the same database, in the same transaction, so the two facts commit atomically, and have a separate relay move rows out to the broker afterwards. The relay can be at-least-once and that is fine, because duplicates are repairable and losses are not.

**★ Why does a job need a lease rather than a `running` boolean?**
Because a boolean records a claim but not a promise. A worker that sets `running = true` and is then killed leaves a row that no other worker will ever touch, and no process is responsible for noticing. A lease encodes the claim as `running until T`, which makes recovery a property of the data rather than a job for an operator: any worker whose claim query treats `locked_until < now()` as available will pick the job back up automatically, and the only tuning parameter is how long you are willing to wait. The corollary is that the lease must be longer than the slowest legitimate execution, or you will hand the same job to a second worker while the first is still working on it.

**★ Snapshot or reference in the payload — how do you choose?**
Ask what the job means. If it means "make the world consistent with the current state of row X", the payload should reference X and read it fresh, because a snapshot would apply stale data and any change between enqueue and execution should be reflected. If it means "record what happened at time T", the payload must snapshot, because re-reading would produce a description of a different moment. Receipts, audit entries and outbound webhooks are snapshots; search indexing, cache invalidation and CRM sync are references. Getting it backwards produces bugs that only appear under delay, which is exactly when nobody is looking.

**★ Why is validating a job payload a terminal failure rather than a retryable one?**
Because the input is fixed. A transient failure is one where the same input might succeed later — a timeout, a rate limit, a downstream deploy. A payload that does not parse is not going to parse in five minutes, so retrying it costs claim capacity, log volume and downstream load while guaranteeing the same outcome, and it delays the moment a human sees the problem by the full length of the retry budget. Classifying errors into permanent and transient at the point they are thrown is the cheapest reliability work available in a queue.

**Your queue has one consumer and concurrency set to 1. Is it FIFO?**
No, and the hosted queues say so explicitly — *"Even with a single consumer and max concurrency set to 1, message order is not strictly first-in-first-out."* Retries are the reason: a message that fails and is scheduled for a later attempt is now behind messages enqueued after it, and most systems deliberately deprioritise retries so a poisoned message cannot block fresh work. A Postgres queue behaves the same way for the same reason, plus the extra subtlety that `ORDER BY` is applied before row locking, so under `READ COMMITTED` the returned order is not guaranteed either. If ordering matters, express it as a serialising lock on a partition key, not as an assumption about the queue.

**A colleague wants to store the email body in the job payload so the worker does not have to render it. Good idea?**
Usually not, and the reasons stack up. It bloats every row and every backup with data that is derivable; it freezes the template at enqueue time, so a fix to the template never reaches queued jobs; and it makes the payload a second place your content lives, which will drift from the first. It also risks putting personal data into a table with different retention rules from the one it came from. The exception is genuine snapshot semantics — if the legal requirement is "the receipt says what it said at the time", then storing the rendered artifact is the *point*, and it should probably live in object storage with the payload carrying its key.

**How do you deploy a change to a job's payload shape without dropping anything?**
In two deploys, consumer first. Deploy the handler that accepts both the old and the new shape and does something sensible with each. Wait until it is live everywhere. Then deploy the producer that emits the new shape. If the change is not expressible as "old shape still works" — a field removed, a meaning inverted — do not change the shape at all: introduce a new `kind`, run both handlers, and delete the old one once `SELECT count(*) FROM jobs WHERE kind = 'old' AND status = 'pending'` is zero. The whole discipline exists because there is no moment at which the queue is empty and every instance is running the same code.

---

← [04b · `after()` and `waitUntil` are not a queue](04b-after-and-waituntil-are-not-a-queue.md) · Next → [04d · Postgres as a queue: `SKIP LOCKED`](04d-postgres-as-a-queue-skip-locked.md)
