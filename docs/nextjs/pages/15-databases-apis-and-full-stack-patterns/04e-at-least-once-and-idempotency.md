---
title: "Every durable queue delivers at least once, so the handler — not the queue — is where duplicate protection lives, and 'we'll be careful' is not a design: you need either an operation that is naturally repeatable or a key you actually store"
sidebar_label: "04e · At-least-once and idempotency"
sidebar_position: 48
description: "Why exactly-once is unavailable, the three routes to safe re-execution, the dedupe table and the ON CONFLICT DO NOTHING RETURNING idiom, where the key comes from, and enqueue-time deduplication."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18
> [`INSERT`](https://www.postgresql.org/docs/18/sql-insert.html) reference (`ON CONFLICT`,
> `RETURNING` semantics — fetched 2026-09-05) and
> [Vercel · Queues concepts](https://vercel.com/docs/queues/concepts) and
> [Managing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
> (at-least-once delivery, publish idempotency keys, the idempotent-operation examples).
> Documentation-verified, **no sandbox run**.
> Target: **PostgreSQL 18.4** · `pg` 8.23.0 · Node 24.20.0.

**At-least-once is not a limitation of the queue you picked; it is the only delivery semantic compatible with surviving a crash, and every system worth using chooses it deliberately. Which means the duplicate is not an edge case to be prevented upstream — it is a normal, expected input to your handler, and the handler is where the entire defence lives. There are exactly three ways to build that defence: make the operation itself repeatable, guard it with a conditional write that only the first attempt can satisfy, or store a key that says "this one is done". This page is all three, with the one rule that makes the third actually work — the key must be written in the same transaction as the effect it protects.**

## Exactly-once is not on offer

Consider a worker that has just charged a card and is about to acknowledge the job. It dies.

From the queue's side, that is **indistinguishable** from a worker that died *before* charging the card. The queue holds one piece of information — the acknowledgement never arrived — and that single fact is consistent with two opposite realities. It must therefore choose:

- **Redeliver** — at-least-once. Risk: the card is charged twice.
- **Do not redeliver** — at-most-once. Risk: the card is never charged and nobody knows.

There is no third option, because the missing information is on the other side of a machine that no longer exists. Every queue you would actually deploy chooses redelivery, because a duplicate is repairable in the handler and a loss is not repairable anywhere.

> *"Vercel Queues provides **at-least-once** delivery semantics. Every accepted message is delivered to each consumer group at least one time. In most cases, a message is delivered exactly once, but there are edge cases where a message may be delivered more than once: **Consumer timeouts**: If your function processes a message but doesn't acknowledge it before the visibility timeout expires, Vercel assumes the delivery failed and redelivers the message. **Infrastructure events**: During rare events like availability zone failovers, a message that was already delivered may be redelivered."*
> — [Vercel · Queues concepts](https://vercel.com/docs/queues/concepts)

> *"Design your consumers to be **idempotent**, meaning they produce the same result whether they process a message once or multiple times. Common strategies include using a unique message ID to deduplicate, or making operations naturally idempotent (like setting a value rather than incrementing it)."*

Your Postgres queue has exactly the same property, from exactly the same cause: lease expiry is a redelivery, and a worker that finished the work and then lost its lease before acking has produced a duplicate. See [04da](04da-leases-and-the-claim-lifetime.md).

## What "idempotent" means here, precisely

It does **not** mean "the code can run twice without throwing". It means **the observable effect of running it N times equals the effect of running it once** — where "observable" includes rows written, emails sent, money moved and webhooks delivered.

A handler that writes a row, catches the unique-violation on the second run, and returns cleanly is idempotent. A handler that sends an email, then writes a row, and skips the write on the second run is **not** — two emails went out and no error was raised anywhere.

## Route 1 — make the operation naturally repeatable

The cheapest defence, and always the first thing to try. Vercel's cron documentation puts it in one line:

> *"Design your operations to be **idempotent** and reconciliation-based so each run can safely reprocess outstanding work since the last successful run. For example: Good: "Set user status to active" (running twice has the same effect). Bad: "Increment user credit by 10" (running twice doubles the credit)."*
> — [Vercel · Managing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)

Operations that are naturally repeatable:

```sql
-- Assignment, not accumulation.
UPDATE users SET status = 'active' WHERE id = $1;

-- Upsert to a fixed value derived from the source of truth.
INSERT INTO search_index (doc_id, body, indexed_at)
VALUES ($1, $2, now())
ON CONFLICT (doc_id) DO UPDATE SET body = EXCLUDED.body, indexed_at = now();

-- Delete by key: the second run finds nothing and that is a success.
DELETE FROM sessions WHERE id = $1;
```

Operations that are not, and cannot be made so by trying harder: `credit = credit + 10`, `INSERT INTO audit_log`, `sendEmail()`, `POST /charges`. Those need route 2 or route 3.

🔴 The reframing that does most of the work: **prefer jobs that say "make X true" over jobs that say "do Y"**. `reindex(docId)` re-reads the current document and writes it — safe any number of times. `applyDelta(docId, patch)` is not. When you can choose the job's shape, choose the reconciling one.

## Route 2 — a conditional write only the first attempt can satisfy

If the entity already has a state machine, that state machine *is* your dedupe.

```sql
-- Only the transition from 'pending' can succeed. The second run affects 0 rows.
UPDATE invoices
   SET status = 'paid', paid_at = now(), payment_ref = $2
 WHERE id = $1
   AND status = 'pending';
```

```ts
const result = await client.query(SQL, [invoiceId, paymentRef])
if (result.rowCount === 0) {
  // Someone — possibly a previous delivery of this same job — already did it.
  // This is a SUCCESS. Ack and return; do not throw, do not retry.
  return 'already-applied'
}
await sendReceipt(invoiceId)   // guarded: only the winner reaches here
```

This is the pattern to reach for whenever the effect is "advance a thing through a lifecycle", and it costs nothing extra — no table, no key, no retention. Its limit is that it only protects effects the *database* can see. The `sendReceipt` line above is inside the guard, which helps, but if the process dies between the `COMMIT` and the send, the receipt is never sent and the state machine will never let another attempt through. That case is [04ea](04ea-external-effects-and-provider-idempotency.md).

## Route 3 — the dedupe table

When the operation cannot be made repeatable and there is no state to compare against, you store the fact that you did it.

```sql
CREATE TABLE processed_events (
  key          text        PRIMARY KEY,
  job_kind     text        NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  result       jsonb
);
```

The idiom that makes it atomic:

```sql
INSERT INTO processed_events (key, job_kind)
VALUES ($1, $2)
ON CONFLICT (key) DO NOTHING
RETURNING key;
```

Two verbatim rules from the manual make this work, and both are load-bearing:

> *"ON CONFLICT DO NOTHING simply avoids inserting a row as its alternative action."*
> *"Only rows that were successfully inserted or updated will be returned."*
> — [PostgreSQL 18 · `INSERT`](https://www.postgresql.org/docs/18/sql-insert.html)

So the statement never raises a unique violation, and **zero returned rows means "someone already claimed this key"** — a single round trip that both tests and takes the claim, with the primary key providing the mutual exclusion. There is no window between the check and the write, which is exactly the flaw in the `SELECT` then `INSERT` version everyone writes first.

### 🔴 The rule that makes it real: same transaction as the effect

```ts
// lib/jobs/handlers/credit-account.ts
import type { Pool } from 'pg'

const CLAIM_KEY = `
INSERT INTO processed_events (key, job_kind) VALUES ($1, $2)
ON CONFLICT (key) DO NOTHING RETURNING key`

export async function creditAccount(
  pool: Pool,
  { key, accountId, cents }: { key: string; accountId: string; cents: number },
): Promise<'applied' | 'duplicate'> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const claim = await client.query(CLAIM_KEY, [key, 'account.credit'])
    if (claim.rowCount === 0) {
      await client.query('ROLLBACK')
      return 'duplicate'
    }

    // The non-idempotent effect and the dedupe key COMMIT TOGETHER.
    await client.query(
      `UPDATE accounts SET credit_cents = credit_cents + $1 WHERE id = $2`,
      [cents, accountId],
    )

    await client.query('COMMIT')
    return 'applied'
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
```

If the key is committed in its own transaction *before* the effect, a crash in between leaves a key that says "done" for work that never happened — and now the job is permanently, silently skipped. If it is committed *after*, a crash in between duplicates the effect. Only the shared transaction has neither window. **A dedupe key in a separate transaction from the effect it protects is worse than no dedupe key at all**, because it converts a visible duplicate into an invisible loss.

## Where the key comes from

This is the part that is usually got wrong, because the obvious choice protects less than it appears to.

| Key source | Protects against | Does **not** protect against |
|---|---|---|
| **The job's own `id`** | Redelivery of *that job* — lease expiry, reaper, worker crash | Two separate enqueues of the same intent (retry of a webhook, double form submit) — different ids |
| **A business key** — `'receipt:' \|\| order_id` | Both: any job, any delivery, that means the same thing | Genuinely distinct events that share the key (two legitimate refunds on one order) |
| **The upstream event id** — a provider's `evt_…` | The provider redelivering its webhook, plus your own redelivery | Nothing, if the provider guarantees a stable id per event. This is the best key when it exists |
| **A hash of the payload** | Byte-identical duplicates | Anything with a timestamp, a nonce or key ordering differences in the JSON — fragile, use last |

🔴 **Use a business key, not the job id, unless you specifically mean "this job".** The job id dedupes deliveries; a business key dedupes *intents*, and the duplicate that reaches production is almost always two intents — a user double-clicking, a webhook provider retrying, a cron overlapping with itself.

```ts
// The key names the effect, not the delivery.
const key = `receipt:${order.id}`                  // one receipt per order, ever
const key = `stripe:${event.id}`                   // one application per provider event
const key = `digest:${userId}:${dayInUtc}`         // one digest per user per day
```

That last shape — embedding the time bucket in the key — is how you make a scheduled job safe against an overlapping or duplicated cron tick without any locking at all.

## Deduplicating at enqueue time

The cheapest duplicate is the one that never becomes a job. Hosted queues offer this directly:

> *"You can include an idempotency key when publishing a message to have Vercel deduplicate it for you… The deduplication window lasts for the entire lifetime of the original message (up to its TTL)."*
> — [Vercel · Queues concepts](https://vercel.com/docs/queues/concepts)

In Postgres you get the same thing with a **partial unique index**, which also gives you free coalescing: a hundred edits to one document while a reindex is pending produce one pending reindex, not a hundred.

```sql
-- At most one PENDING job of a given kind per entity.
CREATE UNIQUE INDEX jobs_one_pending_per_entity
  ON jobs (kind, (payload ->> 'entityId'))
  WHERE status = 'pending';
```

```ts
await client.query(
  `INSERT INTO jobs (kind, payload) VALUES ($1, $2::jsonb)
   ON CONFLICT DO NOTHING`,
  ['search.reindex', JSON.stringify({ entityId: docId })],
)
```

⚠️ Note the bare `ON CONFLICT DO NOTHING` with no conflict target. The manual permits it — *"For ON CONFLICT DO NOTHING, it is optional to specify a conflict_target; when omitted, conflicts with all usable constraints (and unique indexes) are handled."* — but that also means it silently swallows conflicts on constraints you did not have in mind. Name the target where you can, and be deliberate when you cannot: inference against a partial index requires the index predicate in the statement, which an `INSERT` cannot express.

The semantic you have bought is *"there is at most one pending reindex for this document"*, which is coalescing, not deduplication of effects. It does nothing about the reindex that is already `running`. That is fine here — reindexing is naturally repeatable — and would be wrong for a charge.

## Retention: how long must a key live?

Long enough that every possible redelivery of the original has already happened. That window is the **maximum retry lifetime of the job**: `max_attempts` steps of your backoff schedule, plus the lease, plus whatever manual requeue window you allow. If a key is pruned earlier than that, a late redelivery finds no key and re-applies the effect.

```sql
-- Only safe if it comfortably exceeds max_attempts × backoff + lease + requeue window.
DELETE FROM processed_events
 WHERE processed_at < now() - interval '30 days';
```

Hosted queues bound this for you by expiring the message itself:

> *"Retention is configurable per-message from 60 seconds to 7 days, defaulting to 24 hours."*

A Postgres queue has no such bound, so **you own the arithmetic**. If you allow a human to requeue a dead job weeks later, your dedupe keys must outlive that, or the requeue re-applies effects that already happened.

## Gotchas

**★ Symptom: the customer was charged twice, and the logs show one job.** Cause: the job was delivered twice — lease expiry, a reaper, or a redelivery — and the handler had no dedupe because "the queue doesn't duplicate". Every durable queue duplicates; it is the documented semantic. Fix: a business-keyed dedupe row committed in the same transaction as the effect, per `creditAccount` above. If the effect is an external API call it cannot join that transaction — see [04ea](04ea-external-effects-and-provider-idempotency.md).

**★ Symptom: a job is silently skipped and the work never happens, with no error.** Cause: the dedupe key was inserted and committed *before* the effect, and the process died in the gap. The key now permanently asserts that work was done. Fix: one transaction covering both, with the key insert first *inside* it so a conflict short-circuits before any effect:

```ts
await client.query('BEGIN')
const claim = await client.query(CLAIM_KEY, [key, kind])
if (claim.rowCount === 0) { await client.query('ROLLBACK'); return 'duplicate' }
await applyEffect(client)          // same client, same transaction
await client.query('COMMIT')
```

**★ Symptom: dedupe works for retries but not for a user who double-clicked Submit.** Cause: the key is the job id, so two enqueues produce two keys and both pass. Fix: key on the intent, not the delivery — `` `receipt:${orderId}` `` — so any number of jobs meaning the same thing collapse to one effect.

**★ Symptom: `SELECT` then `INSERT` dedupe fails under concurrency.** Cause: two workers both `SELECT`, both find nothing, both proceed, and only then does one of them hit the unique violation — after the effect has run twice. Fix: never separate the check from the claim. `INSERT … ON CONFLICT DO NOTHING RETURNING key` does both in one statement, and *"only rows that were successfully inserted or updated will be returned"* is what makes the row count a reliable verdict.

**★ Symptom: the handler catches a `23505` unique violation and treats it as success, but the transaction is then unusable.** Cause: in PostgreSQL any error aborts the transaction — subsequent statements fail with `current transaction is aborted, commands ignored until end of transaction block` until you `ROLLBACK`. Catching the violation in application code does not undo that. Fix: do not rely on catching the violation. Use `ON CONFLICT DO NOTHING`, which is not an error at all; or if you must attempt-and-catch, wrap the attempt in a `SAVEPOINT` so only that sub-block is rolled back.

**Symptom: dedupe stopped working after a background reindex.** Cause: *"While `CREATE INDEX CONCURRENTLY` or `REINDEX CONCURRENTLY` is running on a unique index, `INSERT ... ON CONFLICT` statements on the same table may unexpectedly fail with a unique violation."* Fix: treat a unique violation from a dedupe insert as a *retryable transient* error rather than a bug, and schedule concurrent reindexes of the dedupe table during a quiet window.

**Symptom: duplicates reappear months later when someone requeues an old dead job.** Cause: the dedupe keys were pruned after 30 days; the requeue was 60 days later. Fix: make the retention arithmetic explicit and tie it to the longest requeue you permit — or, if you allow arbitrary-age requeues, do not prune keys at all for the kinds where an accidental re-application is expensive.

**Symptom: two legitimate refunds on one order, and the second is swallowed.** Cause: the business key was `` `refund:${orderId}` `` — correct for receipts, wrong for an event that can legitimately repeat. Fix: key on the *event*, not the entity — `` `refund:${refundId}` `` — and if the upstream provides an event id, use theirs. The test for a key is: *"can this thing correctly happen twice?"* If yes, the key must contain whatever distinguishes the two occurrences.

**Symptom: the dedupe table is one of the hottest tables in the database.** Cause: it takes one insert per job for every job in the system, forever, and it is a single index on a random-ish text key. Fix: only dedupe the handlers that need it — routes 1 and 2 cost nothing and cover most jobs — and prune on the schedule your retention arithmetic allows.

## Interview questions

**★ Why is exactly-once delivery impossible, and what should you build instead?**
Because the queue's only evidence about a worker is whether an acknowledgement arrived, and the absence of one is consistent with two opposite realities: the work happened and the ack was lost, or the work never happened. No amount of engineering inside the queue can distinguish them, because the information lives in a process that has died. So the queue must choose to redeliver or not, and every serious system chooses to redeliver, because a duplicate is repairable at the handler and a silent loss is repairable nowhere. What you build instead is exactly-once *effects*: a handler that produces the same observable outcome no matter how many times it runs, achieved by making the operation repeatable, guarding it with a conditional write, or storing a key.

**★ Why must the dedupe key be written in the same transaction as the effect?**
Because a separate transaction creates a window, and each ordering makes that window fail differently. Key first: a crash after the key commits leaves a marker claiming the work is done when it is not, so every future delivery is skipped and the work is lost permanently and silently — strictly worse than the duplicate you were preventing. Effect first: a crash before the key commits means the next delivery re-applies the effect, so you have paid for a dedupe table and still get duplicates. Only a single transaction containing both makes the marker and the effect atomic, so any crash leaves a state where either both happened or neither did, and a redelivery does the right thing in both cases.

**★ Why key on a business identifier rather than the job id?**
Because the job id only dedupes *deliveries of that job*, and the duplicates that actually reach production are usually duplicate *intents*. A user double-clicks and two jobs are enqueued. A webhook provider retries because your ack was slow, and your handler enqueues a job each time. A cron tick overlaps with the previous one. In every case the job ids differ, so a job-id key passes both and the effect happens twice. A key that names the effect — `receipt:ord_8812` — is invariant across all of those, which is the property you actually want. The job id is the right key only when you genuinely mean "this specific delivery", which is rare.

**★ Why is `INSERT … ON CONFLICT DO NOTHING RETURNING` better than `SELECT` then `INSERT`?**
Because it is one statement, so there is no interval during which another transaction can slip between the check and the write. With `SELECT` then `INSERT`, two concurrent workers both read "no key", both decide to proceed, and both run the effect — the unique constraint only stops the second *insert*, long after the damage is done. The single-statement form pushes the mutual exclusion into the primary key itself, and the manual's rule that *"only rows that were successfully inserted or updated will be returned"* is what turns the row count into a verdict: one row means you won and must do the work, zero rows means someone else already has it. It is also cheaper — one round trip rather than two.

**★ Your handler sends an email and then writes a row. Is it idempotent?**
No, and this is the most common false positive in code review. The second delivery will hit the unique constraint on the row and the handler will exit cleanly, so it *looks* idempotent — no error, no duplicate row. But the email was sent before the check, so two emails went out. Idempotence is a property of the observable effects, not of whether the function throws. The fix is ordering: claim the key first, and let only the winner reach the send. That still leaves the gap between committing the claim and the send actually succeeding, which is the genuinely hard case and needs the treatment in [04ea](04ea-external-effects-and-provider-idempotency.md).

**How long do you keep dedupe keys, and what happens if you get it wrong?**
Long enough to cover the maximum window in which the original can be redelivered: `max_attempts` steps of your backoff, plus the lease, plus any manual requeue you permit. Prune shorter than that and a late redelivery finds no key and re-applies the effect, which is the exact failure you built the table to prevent — and it will happen during an incident, when requeues are most likely. Hosted queues bound the window for you by expiring messages, with retention *"configurable per-message from 60 seconds to 7 days, defaulting to 24 hours"*; a Postgres queue has no expiry, so the arithmetic is yours. If you cannot bound it — because you allow requeuing arbitrarily old dead jobs — then for expensive effects, do not prune at all.

**When is a partial unique index on the jobs table the right dedupe, and when is it not?**
It is right when you want *coalescing*: at most one pending job of a kind per entity, so a burst of edits produces one reindex rather than fifty. The semantics you get are "there is already work queued for this entity", which is exactly correct for reconciling jobs that re-read current state. It is wrong for anything with per-event meaning, for two reasons: it only excludes jobs still in `pending`, so it does nothing once a job starts running, and collapsing two distinct events into one job means the second event's information is simply discarded. A charge, a refund and an audit entry all need per-event keys and a dedupe table; a reindex, a cache warm and a CRM sync want the partial index.

---

← [04db · Backoff, dead letters and pruning](04db-backoff-dead-letters-and-pruning.md) · Next → [04ea · External effects and provider idempotency](04ea-external-effects-and-provider-idempotency.md)
