---
title: "Trace the read path and the write path separately — caches and fan-out on one side, durability and ordering on the other — and walk \"what happens when the user taps Buy\" box by box, because that walk is where the design is actually tested"
sidebar_label: "08 · Read path and write path"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Method; the transaction semantics are those of the schema on
> [06](06-the-data-model-from-access-patterns.md) and belong to the
> [PostgreSQL track](../../../postgresql/README.md); idempotency per
> [05](05-the-api-sketch.md) and RFC 9110 §9.2.2. Code is TypeScript targeting Node 24 (LTS),
> written to be runnable against the `pg` client; **nothing was run**.

**A system has two paths with opposite concerns, and a design that traces only one has designed
half a system. The read path is about serving the same data many times cheaply — caches, edge
delivery, replicas, fan-out — and its failures are staleness and cost. The write path is about
changing state exactly once, durably, in an order that keeps the invariants — transactions,
idempotency, the outbox, the boundary with the external provider — and its failures are lost
writes, duplicates and contention.** Reads are where the scale numbers are, which is why designs
drift towards them; writes are where correctness lives, which is why interviewers ask "what
happens when the user taps Buy?" and follow the answer box by box. The walk is the single most
revealing thing in the round: every box on the write path either has a stated failure mode and a
response, or it is a box the candidate has not thought about.

## The two paths, side by side

| | Read path | Write path |
|---|---|---|
| **Goal** | serve the same thing many times, cheaply, fast enough | change state once, durably, keeping the invariants |
| **Tools** | CDN, cache, replicas, denormalised views, fan-out on write | transactions, unique constraints, conditional writes, idempotency keys, the outbox, timeouts |
| **Scale lever** | copies — more caches, more replicas | fewer serialisation points — the hot row, the single primary, the one queue |
| **Failure looks like** | stale data, cache stampede, cost | lost writes, duplicates, oversold stock, a lock held across a network call |
| **Consistency question** | how stale may this reader be? | which invariants must hold, and in which transaction? |
| **Where the deep dive usually is** | the hot set and invalidation | the transaction boundary and the external call |

## The write path: "the user taps Buy"

Flow 3 from [07](07-the-high-level-diagram.md), box by box, with the failure at each step and
what the design does about it:

| Step | Box | What happens | If it fails here |
|---|---|---|---|
| 1 | client | sends `POST /orders` with a fresh idempotency key and the cart id | a retry reuses the same key — by design |
| 2 | gateway | authenticates; checks the rate limit; on sale day, the admission gate | rejected requests get a wait page, not a 500 |
| 3 | order service | opens a transaction | — |
| 4 | primary | looks up `(user, key)`: if present, returns the stored order — replay | — |
| 5 | primary | `UPDATE inventory SET available = available - qty WHERE product_id = $1 AND available >= qty` per line | zero rows updated → out of stock → `ROLLBACK`, 409 to the client |
| 6 | primary | `INSERT` the order in `PENDING_PAYMENT` and its items | unique violation on the key → a concurrent duplicate; the second request reads the first's result |
| 7 | primary | `INSERT` the outbox row `ORDER_PLACED` | same transaction — cannot be lost without losing the order |
| 8 | primary | `COMMIT` | crash before commit → nothing happened; the client retries with the same key |
| 9 | payment adapter | calls the provider with the order id as the provider-side idempotency reference, with a timeout | timeout → the order stays `PENDING_PAYMENT`; a reconciliation job asks the provider later; stock stays reserved until an expiry |
| 10 | client | receives 201 `PENDING_PAYMENT` | — |
| 11 | provider → gateway → adapter | callback: signature verified; `payments` row inserted on `provider_payment_id`; order → `PAID` or `PAYMENT_FAILED`; outbox row for the transition | duplicate callback → the insert on `provider_payment_id` no-ops; failed → stock released by a compensating update |
| 12 | outbox publisher | reads unpublished rows in order per aggregate, publishes to the log, marks published | crash after publish, before mark → the event is published twice; consumers are idempotent on the event id |

Every row has a failure and a response. That is the whole point of the walk: the interviewer is
listening for whether step 9's timeout, step 11's duplicate and step 12's double-publish have
answers, because those are the three that break production.

The core of it as code — the transaction, with the provider call deliberately outside it:

```ts
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
type Line = { productId: string; qty: number; unitPriceCents: number };

export async function placeOrder(userId: string, key: string, lines: Line[]) {
  const client = await pool.connect();
  let orderId: string;
  try {
    await client.query('BEGIN');
    const replay = await client.query(
      'SELECT id FROM orders WHERE user_id = $1 AND idempotency_key = $2', [userId, key]);
    if (replay.rowCount) { await client.query('COMMIT'); return { orderId: replay.rows[0].id, replayed: true }; }

    for (const l of lines) {
      const r = await client.query(
        'UPDATE inventory SET available = available - $1 WHERE product_id = $2 AND available >= $1',
        [l.qty, l.productId]);
      if (r.rowCount === 0) { await client.query('ROLLBACK'); return { outOfStock: l.productId }; }
    }
    orderId = randomUUID(); // a time-ordered id in production — see 06
    const total = lines.reduce((s, l) => s + l.qty * l.unitPriceCents, 0);
    await client.query(
      `INSERT INTO orders (id, user_id, status, total_cents, idempotency_key) VALUES ($1, $2, 'PENDING_PAYMENT', $3, $4)`,
      [orderId, userId, total, key]);
    for (const l of lines) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, qty, unit_price_cents) VALUES ($1, $2, $3, $4)',
        [orderId, l.productId, l.qty, l.unitPriceCents]);
    }
    await client.query(
      `INSERT INTO outbox (aggregate, aggregate_id, event_type, payload) VALUES ('order', $1, 'ORDER_PLACED', $2)`,
      [orderId, JSON.stringify({ orderId, userId, total })]);
    await client.query('COMMIT');                       // step 8: durable from here
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally {
    client.release();
  }
  // step 9: OUTSIDE the transaction — no row lock spans this network call
  await requestCharge(orderId, userId);                  // idempotent on orderId; times out; may fail
  return { orderId, replayed: false };
}

async function requestCharge(orderId: string, userId: string): Promise<void> {
  // the payment adapter: provider call with a timeout and the order id as the idempotency reference.
  // On timeout the order stays PENDING_PAYMENT and reconciliation picks it up.
  void orderId; void userId; // pseudo-code boundary: the adapter's HTTP call lives in the payment adapter
}
```

The line that interviewers look for is the comment before `requestCharge`: the provider call is
after `COMMIT`, so a slow or dead provider never holds a lock on the inventory row. The price is
step 9's failure mode — an order committed and unpaid — and the design pays it with a pending
state, an expiry that releases stock, and a reconciliation job.

## Ordering on the write path

Two places where order matters and the design has to say how it is kept:

- **Per aggregate, in the outbox.** `ORDER_PLACED` must be published before `ORDER_PAID` for
  the same order. The publisher reads the outbox in insertion order per aggregate id and
  publishes to a log partitioned by aggregate id, so consumers see one order's events in
  sequence. Across different orders, no ordering is promised or needed.
- **Between the decrement and the insert, inside the transaction.** The conditional decrement
  goes first so an out-of-stock line aborts before an order row exists; the order row is the
  thing a retry looks up, and it should only exist once the stock is reserved.

## The read path: the product page and the buyer's order

Two reads with different needs, traced the same way:

**Flow 1, the product page.** Client → CDN: a hit serves the page's static shell and images and
stops there. Miss → gateway → catalogue service → product cache: a hit returns the product in
a memory read. Miss → the primary or a replica → the cache is filled with a TTL → response. The
failures are staleness (a price change invisible until the TTL expires — acceptable, or
invalidated on write from the outbox), a stampede when a hot key expires (many misses at once
hit the store — a lock or a short jittered TTL), and cost (a cache with a low hit rate is worse
than none; the hot set is what is cached).

**Flow 5, the buyer's own order.** The customer who just placed an order reads it back — and
that read must not go to a lagging replica, or they see "no such order". So: reads of an order
by its buyer within a short window after a write go to the primary, or the response from the
write carries enough to render, or the replica is checked for having caught up to the write's
position. Say which. History pages for older orders go to the replica; the lag is invisible
there.

The read path's decisions — what is cached, at which layer, invalidated how, and which readers
must see their own writes — are the [caching phase](../../syllabus/02-the-network-path-and-caching.md)'s
material; here the point is that the read path is traced as deliberately as the write path, and
that its consistency question is answered per reader.

## Why they are traced separately

Because their deep dives are different and their failures are different, and a single "request
path" hides both. A candidate who traces only the read path has a fast system that loses
orders; one who traces only the write path has a correct system that falls over on the
product page. The two traces also produce the two halves of the failure walk
(**11 · Bottlenecks and single points of failure** *(not written yet)*): the read path's single points are the cache and the CDN's origin; the
write path's are the primary and the provider.

## Gotchas

**★ Symptom: "what happens when the user taps Buy?" and the answer stops at "the order service
saves it."** Cause: the write path never traced box by box. Fix: the twelve-step walk, with a
failure and a response at each step; steps 9, 11 and 12 are the ones the interviewer is
waiting for.

**★ Symptom: the provider is called inside the transaction.** Cause: "charge then commit" felt
safer. Fix: commit first, call after; the price is a pending state, an expiry that releases
stock and a reconciliation job — all of which are said.

**Symptom: the order event was published by the service after the commit, not from an
outbox.** Cause: the dual-write. Fix: the outbox row in the same transaction; the publisher
drains it; consumers are idempotent because the publisher may double-publish.

**Symptom: a duplicate callback moved the order to paid twice and the ledger shows two
credits.** Cause: the callback endpoint not idempotent. Fix: insert on `provider_payment_id`
first; a conflict means a repeat, and nothing else happens.

**Symptom: the customer placed an order and the confirmation page said "no orders yet."**
Cause: the follow-up read went to a lagging replica. Fix: read-your-writes for the buyer —
primary for fresh reads, or the write's response carries the order, or a replica position check.

**Symptom: the order row was inserted before the stock was reserved, and a retry found the
order and skipped the reservation.** Cause: the steps in the wrong order inside the
transaction. Fix: conditional decrement first, then the order row; the order's existence means
the stock is held.

**Symptom: a hot product's cache key expired and the store took a thousand misses at once.**
Cause: the stampede on the read path. Fix: a short jittered TTL, or a single-flight lock on the
miss, or refresh-ahead for the known hot set.

**Symptom: events for one order arrived out of order at the fulfilment worker.** Cause: the
log not partitioned by aggregate id. Fix: partition by order id; the publisher writes in outbox
order per aggregate.

## Interview questions

**★ Walk through what happens when the user taps Buy.**
The client posts the order with a fresh idempotency key; the gateway authenticates, rate-limits
and, on sale day, admits or queues. The order service opens a transaction: it looks up the key
and replays if seen; conditionally decrements inventory per line, aborting if any line lacks
stock; inserts the order in pending-payment and its items — a unique violation on the key means
a concurrent duplicate, which reads the first's result; inserts the outbox row; commits. Only
then the payment adapter calls the provider, with a timeout, using the order id as the
idempotency reference; on timeout the order stays pending and reconciliation picks it up, with
an expiry that releases the stock. The client gets pending-payment. The provider's signed
callback inserts a payment row on the provider's id — a repeat no-ops — moves the order to
paid or failed, writes an outbox row, and the publisher drains the outbox in order per aggregate
to a log whose idempotent consumers send the email, start fulfilment and update the index.

**★ Why is the provider called after the commit, and what does that cost?**
Because a call to an external system takes at least a cross-region round trip and can take
thirty seconds or fail, and holding a row lock on the sale item's inventory for that long
serialises every other checkout behind one network call. Committing first releases the lock in
milliseconds. The cost is a state the design has to handle: an order committed and unpaid. It
is handled with a pending status, an expiry that releases the reserved stock if no confirmation
arrives, and a reconciliation job that asks the provider what happened to orders it never heard
back about.

**What do the read path and the write path each optimise for, and how do their failures
differ?**
The read path optimises for serving the same data many times cheaply — CDN, cache, replicas,
fan-out — and fails by being stale, by stampeding a store when a hot key expires, and by costing
more than it saves when the hit rate is low. The write path optimises for changing state exactly
once, durably, with invariants intact — transactions, conditional writes, unique constraints,
idempotency keys, the outbox — and fails by losing writes, duplicating them, overselling, or
holding a lock across a network call. They are traced separately because their deep dives and
their single points of failure are different.

**How is ordering kept on the write path?**
Inside the transaction, the conditional decrement precedes the order insert, so an order row
only exists once stock is held and a retry that finds the row can trust that. In the outbox, the
publisher reads rows in insertion order per aggregate and publishes to a log partitioned by the
aggregate id, so consumers see one order's events in sequence; no ordering is promised across
orders because none is needed. Consumers are idempotent on the event id because the publisher
can crash between publishing and marking, and publish twice.

**How does the buyer see their own order immediately after placing it?**
By routing that read away from replica lag: serve the buyer's fresh reads from the primary for
a short window, or return enough in the write's response to render the confirmation, or check
that the replica has applied up to the write's position before serving from it. Older history
goes to the replica, where lag is invisible. The choice is said, because "we have replicas" is
otherwise a bug on the confirmation page.

---

← Prev: [07 · The high-level diagram](07-the-high-level-diagram.md) · Index: [Phase 1 — The method](README.md) · Next → [09 · Choosing the deep dives](09-choosing-the-deep-dives.md)
