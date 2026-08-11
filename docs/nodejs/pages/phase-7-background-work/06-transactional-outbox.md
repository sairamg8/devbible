---
title: "Dual-write and the transactional outbox"
sidebar_label: "06 · The transactional outbox"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** — `pg` 8.23.0 against PostgreSQL 17.10.

**"Save the row, then enqueue the job" is two writes to two systems, and there is no
way to make them both happen.** Not with try/catch, not with ordering, not with
retries. The outbox pattern removes the problem instead of trying to solve it.

## The dual write

```js
const {rows} = await pool.query(
  'insert into orders (user_id, total_cents) values ($1,$2) returning id', [7, 250000]);
await queue.add('send-receipt', {orderId: rows[0].id});   // ← the crash window
```

With the queue unavailable:

```console
dual write: enqueue failed -> redis unavailable
dual write: orders = 1 | jobs enqueued = 0
```

**The order exists and nothing will ever process it.** No error reaches the user if
you swallowed it; if you did not, the user sees a 500 for an order that was created.

Reversing the order does not help — enqueue first and a database failure leaves a job
for an order that does not exist. Wrapping it in try/catch does not help either: the
catch block runs a *third* write that can also fail. The window is genuinely
irreducible, because two systems cannot commit together without a distributed
transaction, and nobody wants one of those.

This is not rare. Any deploy, any Redis failover, any OOM kill lands in that window
eventually.

## The outbox

Write the *intent to enqueue* into the same database, in the same transaction as the
business data. One system, one commit.

```sql
create table outbox (
  id           bigserial primary key,
  topic        text        not null,
  payload      jsonb       not null,
  created_at   timestamptz not null default now(),
  published_at timestamptz
);
```

```js
const client = await pool.connect();
try {
  await client.query('begin');
  const {rows} = await client.query(
    'insert into orders (user_id, total_cents) values ($1,$2) returning id', [8, 99900]);
  await client.query(
    'insert into outbox (topic, payload) values ($1,$2)',
    ['order.paid', {orderId: rows[0].id}]);
  await client.query('commit');
} finally {
  client.release();
}
```

```console
outbox: orders = 2 | outbox rows = 1
```

And on rollback:

```console
outbox after rollback: orders = 2 | outbox rows = 1   <- neither, together
```

**Neither the order nor the event survived.** That is the whole property: the record
and the intent to notify are now the same commit, so they cannot diverge.

Both statements must use the same checked-out `client` — a `pool.query` in the middle
runs on a different connection and escapes the transaction, which
[Phase 6, page 06](../phase-6-data-access/06-transactions.md) measured directly.

## The relay

A separate loop moves committed rows out. It is the same claim pattern as
[page 02](./02-job-queues.md):

```js
const relay = async () => {
  const {rows} = await pool.query(`
    update outbox set published_at = now()
     where id in (select id from outbox
                   where published_at is null
                   order by id
                   for update skip locked
                   limit 100)
    returning id, topic, payload`);

  for (const row of rows) {
    await queue.add(row.topic, row.payload, {jobId: `outbox:${row.id}`});
  }
  return rows.length;
};
```

```console
relay: published 1 event(s): {"orderId":2}
```

`skip locked` lets several relay instances run without publishing the same row twice,
and `jobId: outbox:${row.id}` makes a duplicate publish harmless.

**The relay is at-least-once, deliberately.** It marks `published_at` and *then*
enqueues; a crash between the two republishes on the next pass. That is the correct
trade — the alternative, enqueuing before marking, loses events instead of duplicating
them, and duplicates are already handled ([page 05](./05-job-idempotency.md)).

Run it as its own small process, or as a job in the worker. Poll every second or two;
`LISTEN/NOTIFY` can wake it immediately if the latency matters.

## Housekeeping

The table grows forever unless you delete from it:

```sql
delete from outbox where published_at < now() - interval '7 days';
```

Keep a window — a few days is usually enough to answer "was this event ever sent?" —
and index the hot path:

```sql
create index on outbox (id) where published_at is null;
```

A partial index keeps the relay's scan proportional to unpublished rows, not to the
table.

## When you need this, and when you do not

**You need it when** losing the follow-up action is a real business problem: the order
was paid and no receipt was sent, the account was created and no welcome email
arrived, the shipment was booked and the warehouse never heard.

**You do not need it when** the side effect is genuinely optional — analytics, a cache
warm, a nice-to-have notification. An outbox for those is machinery protecting
something nobody would notice.

**And you do not need it at all if your queue is the same database.** A `jobs` table
written inside the transaction *is* the outbox — the relay disappears because the
consumer already reads that table. This is the strongest argument for a Postgres-backed
queue, and it is worth choosing on those grounds alone.

## The inverse problem

The same reasoning runs the other way. A worker that does external work and then
records it can crash in between, leaving the effect without the record. The fix is the
same as [page 05](./05-job-idempotency.md): make the external effect idempotent, and
write the record in the same transaction as any other database change the job makes.

## Gotchas

**Symptom:** A row exists with no job, or a job with no row
**Cause:** Dual write — two systems, two commits.
**Fix:** Outbox row in the business transaction; relay after commit.

**Symptom:** The outbox row is committed but the business row is missing
**Cause:** The two inserts used different connections (`pool.query` inside a
transaction).
**Fix:** One checked-out `client` for both statements.

**Symptom:** Events publish twice
**Cause:** The relay marks and enqueues non-atomically — by design.
**Fix:** Consumers are idempotent; `jobId: outbox:${id}` makes the duplicate a no-op.

**Symptom:** The outbox table is enormous
**Cause:** Nothing deletes published rows.
**Fix:** Periodic delete with a retention window, plus a partial index on unpublished
rows.

**Symptom:** The relay falls behind under load
**Cause:** One instance, small batch, long poll interval.
**Fix:** Larger batches, several relays (`skip locked` makes that safe), or
`LISTEN/NOTIFY`.

**Symptom:** Events arrive out of order
**Cause:** Parallel relays and independent job retries.
**Fix:** Order per entity if it matters — a version column on the target row, as in
[page 05](./05-job-idempotency.md).

## Interview questions

**★ What is the dual-write problem?**
Writing to two systems that cannot commit together — a database row and a queue
message. Whichever goes second can fail after the first succeeded, so you get an order
with no job or a job with no order. Measured: with the queue down, the order committed
and nothing was ever enqueued. Try/catch does not fix it, because the compensating
write can fail too.

**★ How does the transactional outbox solve it?**
It removes the second system from the critical path. The event is inserted into an
`outbox` table inside the same database transaction as the business data, so they
commit or roll back together — verified, a rollback left neither. A separate relay then
reads committed outbox rows and publishes them.

**★ Is the relay exactly-once?**
No, and deliberately not. It marks `published_at` and then enqueues, so a crash between
those republishes the event. At-least-once with idempotent consumers is the correct
trade; the reverse ordering would lose events instead.

**★ When do you not need an outbox?**
When the side effect is optional — analytics, cache warming. And when the queue is
already the same database: a `jobs` table written inside the transaction *is* the
outbox, with no relay at all.

**How do you stop the outbox table growing forever?**
Delete published rows past a retention window, and put a partial index on
`published_at is null` so the relay's scan stays proportional to unpublished rows.

**Can several relay instances run at once?**
Yes, with `for update skip locked` on the claim, exactly as with a job queue. Combined
with a derived `jobId`, a duplicate publish is a no-op.

---

← Prev: [Job idempotency](./05-job-idempotency.md) · Next → [Dead-letter queues](./07-dead-letter-queues.md)
