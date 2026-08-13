---
title: "The transactional outbox"
sidebar_label: "18 · Transactional outbox"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts:
> `sandbox/p7-background-work/ex1-outbox.mjs` (dual write vs outbox, relay),
> `sandbox/p7-background-work/ex2-skiplocked.mjs` (competing relays).

**You cannot write to your database and to a queue atomically. The outbox pattern
turns that impossible two-system commit into one ordinary transaction plus a
separate, retryable publish — and every ingredient for it is already on the earlier
pages of this syllabus.**

## The bug this fixes: the dual write

The natural code is "save the order, then enqueue the job":

```js
await pool.query('INSERT INTO orders …');
await queue.add('send-receipt', {orderId});   // a second system
```

There is no transaction spanning those two lines. Measured, with the queue's backing
store unavailable at the moment of the second call:

```console
$ node ex1-outbox.mjs
dual write: enqueue failed -> redis unavailable
dual write: orders = 1 | jobs enqueued = 0   <- order exists, nothing will process it
```

**The order was committed and the receipt will never be sent.** No error reaches the
customer, nothing retries, and nothing in the database records that work is
outstanding. Reversing the order of the two calls does not help — then you enqueue
work for an order that may never commit, and the worker fires on a row that does not
exist.

This is not a rare race. It is the ordinary behaviour of two systems without a shared
transaction.

## The fix: write the event to a table, in the same transaction

An outbox is a plain table written by the **same** transaction as the business row:

```sql
CREATE TABLE outbox (
  id            bigserial PRIMARY KEY,
  topic         text        NOT NULL,
  payload       jsonb       NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz,
  attempts      int         NOT NULL DEFAULT 0
);
CREATE INDEX ON outbox (created_at) WHERE published_at IS NULL;
```

```js
await withTransaction(async (tx) => {
  const {rows} = await tx.query('INSERT INTO orders … RETURNING id');
  await tx.query('INSERT INTO outbox (topic, payload) VALUES ($1, $2)',
                 ['order.created', {orderId: rows[0].id}]);
});
```

Both rows commit or neither does:

```console
outbox: orders = 2 | outbox rows = 1
outbox after rollback: orders = 2 | outbox rows = 1   <- neither, together
```

The second line is the point. The transaction was rolled back after both inserts, and
the counts did not move — **no orphan order, no orphan event**. Atomicity you already
had, applied to the thing you were doing outside it.

The partial index matters: the relay only ever queries unpublished rows, and a partial
index on `published_at IS NULL` stays small even as the table grows.

## The relay: publishing without double delivery

A separate process reads unpublished rows and publishes them. Competing relay
instances must not both publish the same event, which is exactly what
[`SKIP LOCKED`](../phase-11-mvcc/README.md) is for:

```sql
UPDATE outbox SET published_at = now()
WHERE id = (SELECT id FROM outbox
             WHERE published_at IS NULL
             ORDER BY created_at
             FOR UPDATE SKIP LOCKED
             LIMIT 1)
RETURNING *;
```

```console
$ node ex1-outbox.mjs
relay: published 1 event(s): {"orderId":2}
```

Measured with three competing workers over the same 20 rows:

```console
$ node ex2-skiplocked.mjs
3 workers drained 20 jobs in 94 ms
A got 8 | B got 6 | C got 6
total claims 20 | unique 20        <- no job delivered twice
same 20 jobs WITHOUT skip locked: 189 ms
```

**2× faster and provably no double delivery.** Without `SKIP LOCKED` the three workers
queue behind the same row — correct, but serialised, so the extra workers buy nothing.

## What the outbox does *not* give you

**It is at-least-once, not exactly-once.** The relay can publish and then crash before
setting `published_at`, and the event goes out twice. That is unavoidable: publishing
to the broker and marking the row are, once again, two systems.

So the consumer must be idempotent. Measured:

```console
naive job run twice      -> emails_sent = 2
idempotent job run twice -> rowCounts 1 0 | emails_sent = 1
```

The mechanism is a unique key and `ON CONFLICT DO NOTHING`:

```sql
INSERT INTO processed_events (idempotency_key) VALUES ($1)
ON CONFLICT (idempotency_key) DO NOTHING;
```

The second run's `rowCount` is **0**, and that zero is how the job knows it is a
repeat and should stop. Exactly-once delivery does not exist; exactly-once *effect*
does, and this is how you get it.

## Latency, and when to reach for `LISTEN`/`NOTIFY`

A polling relay adds latency equal to its poll interval. If that matters, have the
writing transaction `NOTIFY` and let the relay wake immediately — but keep the poll
as the backstop, because [`LISTEN`/`NOTIFY`](13-listen-notify.md) is **at-most-once**:
a relay that is disconnected when the notification fires never receives it. The table
is the source of truth; the notification is only a hint that it is worth looking.

## Through your ORM or platform

The pattern is the same, but the traps move:

- **Prisma / Drizzle** — the outbox insert must be inside the *same* `$transaction` /
  `db.transaction` callback as the business write. Passing the outer client instead of
  the transaction handle silently reintroduces the dual write, and it will pass every
  test that does not kill the process mid-transaction.
- **BullMQ, SQS, or any Redis/broker-backed queue** — `queue.add()` in a request
  handler *is* the dual write measured above. The outbox does not replace the queue;
  the relay feeds it.
- **Supabase / serverless** — there is no long-lived process to run the relay in. Use a
  scheduled function (`pg_cron`, a cron worker, or the platform's scheduler) and accept
  the poll interval as your latency floor.
- **Managed Postgres with a read replica** — the relay must read the **primary**.
  Replication lag means a replica may not yet have the row the transaction just
  committed.

## Trade-off

The outbox buys atomicity between your data and your events, at the cost of a table
that grows, a process that must be run and monitored, and end-to-end latency of at
least one poll interval. You also inherit a deletion job — unpublished rows are a
backlog, but published rows are garbage, and a `DELETE … WHERE published_at < now() -
interval '7 days'` on a schedule is part of the pattern, not an afterthought.

If you do not already have a queue, you may not need the outbox at all: a job table
read with `SKIP LOCKED` *is* a queue, and it is transactional by construction.

## Gotchas

**Symptom:** An order exists but its side effect never happened, with no error anywhere
**Cause:** Dual write — the enqueue failed after the insert committed. Measured:
`orders = 1 | jobs enqueued = 0`.
**Fix:** Write the event to an outbox table in the same transaction.

**Symptom:** The same event is published twice
**Cause:** The relay crashed between publishing and setting `published_at`. This is
inherent, not a bug in your code.
**Fix:** Idempotent consumers — a unique key plus `ON CONFLICT DO NOTHING`, and treat
`rowCount = 0` as "already handled".

**Symptom:** Two relay instances publish the same rows
**Cause:** The claim query lacks `SKIP LOCKED`, or it selects rows without locking them.
**Fix:** `SELECT … FOR UPDATE SKIP LOCKED LIMIT 1` inside the `UPDATE`. Measured: 20
claims, 20 unique.

**Symptom:** Adding relay workers does not speed anything up
**Cause:** `FOR UPDATE` without `SKIP LOCKED` — the workers queue behind one row.
Measured: 189 ms serialised versus 94 ms with three workers.
**Fix:** `SKIP LOCKED`.

**Symptom:** The outbox table is enormous
**Cause:** Nothing deletes published rows.
**Fix:** A scheduled delete, and a partial index on `published_at IS NULL` so the relay
query stays fast regardless.

**Symptom:** Events stop flowing but nothing alerts
**Cause:** The relay died. The database is healthy, so nothing else notices.
**Fix:** Alert on the age of the oldest unpublished row, not on relay liveness.

## Interview questions

**★ Why can you not just save the row and then enqueue the job?**
There is no transaction across the two systems. Measured: with the queue's store
unavailable, the order committed and nothing was enqueued — `orders = 1 | jobs
enqueued = 0`, so the work is lost with no error and no record. Reversing the order
just moves the failure to jobs for orders that never committed.

**★ What does the outbox pattern actually guarantee?**
That the event and the business row commit together — measured, a rollback left both
counts unchanged. It guarantees **at-least-once** delivery to the broker, not
exactly-once, because the relay can publish and die before marking the row.

**★ How do competing relay workers avoid publishing the same event?**
`SELECT … FOR UPDATE SKIP LOCKED` inside the claiming `UPDATE`. Measured with three
workers over 20 rows: 20 claims, 20 unique, 94 ms — versus 189 ms and no parallelism
without it.

**How do you make the consumer safe against duplicates?**
A unique idempotency key with `ON CONFLICT DO NOTHING`; a `rowCount` of 0 means it is
a repeat. Measured: the naive job sent 2 emails, the idempotent one sent 1.

**When would you not use an outbox?**
When you have no second system. A job table polled with `SKIP LOCKED` is already
transactional and needs no relay. The outbox earns its complexity only when events
must leave PostgreSQL for a broker.

---

← [pgvector](17-pgvector.md) · Next → [Audit and history tables](19-audit-history-tables.md)
