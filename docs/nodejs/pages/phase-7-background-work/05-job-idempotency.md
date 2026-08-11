---
title: "Job idempotency — assume every job runs twice"
sidebar_label: "05 · Job idempotency"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** — `pg` 8.23.0 against PostgreSQL 17.10,
> `bullmq` 6.0.10 against Redis 8.10.0.

**Every job will eventually run twice.** Not because of a bug — because at-least-once
delivery is the only guarantee any queue offers, and [page 04](./04-retries-and-stalled-jobs.md)
showed the two independent paths that get you there. A job that is not safe to repeat
is a bug waiting for a bad deploy.

## Two lines apart

```js
// naive
const sendReceipt = (orderId) =>
  pool.query('insert into emails_sent (order_id) values ($1)', [orderId]);
```

```js
// idempotent
const sendReceipt = (orderId) =>
  pool.query(
    `insert into emails_sent (order_id, idempotency_key)
     values ($1, $2)
     on conflict (idempotency_key) do nothing`,
    [orderId, `order-paid-email:${orderId}`]);
```

Run each twice:

```console
naive job run twice      -> emails_sent = 2
idempotent job run twice -> rowCounts 1 0 | emails_sent = 1
```

Note `rowCounts 1 0`. The second run's `rowCount` is **0**, and that is not just a
side effect — it is how the job knows it is a repeat, and therefore whether to do the
rest of its work.

## Where the key comes from

The key must be **derived from the domain**, not generated inside the job.

```js
const key = `order-paid-email:${orderId}`;              // stable across every run
const key = `webhook:${subscriptionId}:${eventId}`;     // stable, and per subscriber
const key = crypto.randomUUID();                        // useless — new every attempt
```

If a fresh key is generated per attempt, every attempt is "new" and nothing
deduplicates. The test is simple: *would attempt 2 compute the same string as attempt
1?*

Deduplicate at two levels, because they catch different things:

```js
// 1. at enqueue — the same job is not queued twice
await queue.add('send-receipt', {orderId}, {jobId: `receipt:${orderId}`});

// 2. inside the handler — the same job is not *executed* twice
await pool.query('insert … on conflict (idempotency_key) do nothing', [key]);
```

`jobId` stops a duplicate *enqueue* (a retried HTTP request, a relay running twice).
It does **not** stop redelivery of a job already claimed. Only the handler-level check
does that, and it is the one that is not optional.

## Making each kind of work repeatable

**Database writes** — `on conflict do nothing` / `do update` on a unique key. Already
the most common case, and the cheapest.

**Counters and balances** are the dangerous ones, because they are relative:

```js
// NOT idempotent — runs twice, charges twice
await tx.query('update accounts set balance_cents = balance_cents - $1 where id = $2', [cents, id]);
```

```js
// idempotent — the ledger row is the guard
const {rowCount} = await tx.query(
  `insert into ledger (idempotency_key, account_id, delta_cents)
   values ($1, $2, $3) on conflict (idempotency_key) do nothing`,
  [key, id, -cents]);
if (rowCount === 1) {
  await tx.query('update accounts set balance_cents = balance_cents - $1 where id = $2', [cents, id]);
}
```

Both statements in **one transaction**
([Phase 6, page 06](../phase-6-data-access/06-transactions.md)). The insert is the
lock: if it did nothing, this attempt already happened, and the balance is not touched
again.

**Third-party calls** — use the provider's idempotency support. Stripe takes an
`Idempotency-Key` header; most payment and email APIs have an equivalent:

```js
await stripe.charges.create(payload, {idempotencyKey: `charge:${orderId}`});
```

Where the provider has none, record your own attempt *before* calling, and check it
first. That narrows the window but does not close it — a crash between the call and
recording it is unrecoverable in the general case. Which is the real lesson: **put the
irreversible external call in its own job**, so the retry boundary is as small as
possible.

**Non-transactional side effects** — files, S3 objects, index updates — should be
written to a deterministic key (`receipts/${orderId}.pdf`), so a second run overwrites
rather than duplicates. Naturally idempotent: `PUT` to a fixed path, `set` on a fixed
key, `DELETE`. Naturally dangerous: `append`, `POST`, `INCR`.

## Ordering is not guaranteed either

Idempotency is about repeats; the neighbouring assumption is order. Two jobs enqueued
in order can run in either — different workers, different retry schedules. `order.paid`
can be processed after `order.refunded`.

Where order matters, encode it rather than assume it:

```js
// ignore an event older than the state we already have
const {rowCount} = await pool.query(
  `update orders set status = $1, status_version = $2
    where id = $3 and status_version < $2`,
  [status, version, orderId]);
```

A version or timestamp on the row makes late arrivals no-ops. The alternative is a
per-entity serial queue, which costs throughput — only use it where the domain
genuinely demands it.

## Testing it

The test is one line longer than the normal one, and it is the test that matters:

```js
test('sending a receipt twice sends one email', async () => {
  await sendReceipt(order.id);
  await sendReceipt(order.id);                       // the whole test
  assert.equal(await countEmails(order.id), 1);
});
```

Run every job handler twice in its test. It costs nothing and it catches the class of
bug that otherwise surfaces during an incident, when the queue is redelivering
everything at once.

## Gotchas

**Symptom:** Duplicate emails, charges or webhooks after an incident
**Cause:** At-least-once redelivery of a non-idempotent handler.
**Fix:** Domain-derived key plus `on conflict do nothing`; check `rowCount` before
doing the rest.

**Symptom:** The idempotency key never matches
**Cause:** It is generated inside the job (`randomUUID`) or includes a timestamp.
**Fix:** Derive it from stable domain values.

**Symptom:** A balance is wrong by exactly one job's amount
**Cause:** A relative `update` was retried.
**Fix:** Guard with a ledger insert in the same transaction; only apply the delta when
the insert took effect.

**Symptom:** `jobId` was set but the job still ran twice
**Cause:** `jobId` deduplicates *enqueues*, not redelivery of a claimed job.
**Fix:** Deduplicate inside the handler too.

**Symptom:** A refund is processed before the payment
**Cause:** Assumed ordering across independent jobs.
**Fix:** A version or timestamp on the row so stale updates are no-ops.

**Symptom:** Two files `receipt-1723300000.pdf` and `receipt-1723300094.pdf`
**Cause:** A non-deterministic output path.
**Fix:** Derive the key from the domain so the second run overwrites.

## Interview questions

**★ Why must every job be idempotent?**
Because delivery is at-least-once. A worker can complete the work and die before
acknowledging, or exceed its visibility timeout while still running, and the queue
will correctly redeliver. Measured: the same handler run twice inserted two rows;
with `on conflict (idempotency_key) do nothing` it inserted one and the second call
reported `rowCount 0`.

**★ Where does the idempotency key come from?**
The domain — `order-paid-email:${orderId}`, `webhook:${subId}:${eventId}` — so every
attempt computes the same string. A UUID generated inside the job is new on each
attempt and deduplicates nothing.

**★ How do you make a balance update idempotent?**
Insert a ledger row keyed on the idempotency key and apply the delta only if that
insert affected a row, both inside one transaction. The unique constraint is the
guard; a relative `update` on its own applies again on every retry.

**★ Does setting `jobId` make a job idempotent?**
No. It prevents the same job being *enqueued* twice. It does nothing about a claimed
job being redelivered after a stall, which is the case that actually causes duplicates.
The handler must be idempotent regardless.

**Can you rely on jobs running in order?**
No — different workers and different retry schedules reorder them freely. Where order
matters, put a version or timestamp on the row and ignore updates older than the
current state, or serialise per entity and accept the throughput cost.

**What about a third-party call you cannot deduplicate?**
Use the provider's idempotency key if it has one. If not, record the attempt before
calling and check it first, and put that call in its own small job so the retry
boundary is as narrow as possible. The window cannot be fully closed without provider
support.

---

← Prev: [Retries and stalled jobs](./04-retries-and-stalled-jobs.md) · Next → [The transactional outbox](./06-transactional-outbox.md)
