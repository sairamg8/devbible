---
title: "Job queues from Node — the producer/consumer shape"
sidebar_label: "02 · Job queues"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** — `bullmq` 6.0.10 against **Redis 8.10.0**,
> `pg` 8.23.0 against PostgreSQL 17.10.

**A queue is three things: somewhere durable to put a job, a way for exactly one
consumer to claim it, and a way to know it finished.** Everything else — priorities,
rate limits, dashboards — is convenience on top. Redis internals belong to the Redis
section; this is the shape, and the two ways to get it.

## The shape

```js
// producer — in the API process
await queue.add('send-receipt', {orderId: 42}, {jobId: 'receipt:42'});
```

```js
// consumer — in a separate process (page 03)
new Worker('emails', async (job) => {
  await sendReceipt(job.data.orderId);
}, {connection, concurrency: 5});
```

The producer knows nothing about who runs the job or when. That decoupling is the
point: the API can be deployed, restarted or scaled without touching the workers.

Four properties decide whether a queue is real:

| Property | What it means | What breaks without it |
|---|---|---|
| **Durable** | The job survives a restart | Deploys lose work |
| **Exclusive claim** | One consumer gets each job | Two emails per order |
| **Visibility timeout** | A crashed consumer's job returns | Work vanishes with a pod |
| **Acknowledgement** | Removed only when finished | Either loss or infinite redelivery |

Note what is *not* on that list: exactly-once delivery. No queue offers it. Every
queue is **at-least-once**, which is why [page 05](./05-job-idempotency.md) is a
Master-tier topic and this page is not.

## Option 1 — your database is already a queue

If you have PostgreSQL, you have everything above. The whole mechanism is one
statement:

```sql
create table jobs (
  id           bigserial primary key,
  kind         text        not null,
  payload      jsonb       not null,
  run_at       timestamptz not null default now(),
  attempts     int         not null default 0,
  locked_until timestamptz
);
```

```js
const claim = async () => {
  const {rows} = await pool.query(`
    update jobs
       set locked_until = now() + interval '30 seconds',
           attempts     = attempts + 1
     where id = (select id from jobs
                  where run_at <= now()
                    and (locked_until is null or locked_until < now())
                  order by id
                  for update skip locked
                  limit 1)
    returning id, kind, payload`);
  return rows[0] ?? null;
};
```

`for update skip locked` is what makes this work: each worker locks a different row
instead of queueing behind the same one. Three workers, twenty jobs:

```console
3 workers drained 20 jobs in 94 ms
A got 8 | B got 6 | C got 6
total claims 20 | unique 20        <- no job was delivered twice
```

The same twenty jobs with a plain `for update`:

```console
same 20 jobs WITHOUT skip locked: 189 ms
```

**Twice as slow**, because the workers serialise on the first row. And `unique 20`
against `total claims 20` is the exclusivity property, demonstrated rather than
assumed.

`locked_until` is the visibility timeout. A worker that dies mid-job leaves the row
locked; once the lock expires it is claimable again, with `attempts` already
incremented — which is how you find a job that keeps killing its worker
([page 07](./07-dead-letter-queues.md)).

**Take this option when** you already run PostgreSQL and do not want a second
datastore. You get transactional enqueue for free — the killer feature, and the whole
of [page 06](./06-transactional-outbox.md) — plus jobs you can query with SQL. The
cost is that you write the retry, scheduling and metrics yourself, and a busy queue
is write traffic on your primary database.

## Option 2 — a real queue library

BullMQ over Redis is the default in a MERN/PERN stack. It gives you what the
hand-rolled table does not:

```js
import {Queue, Worker} from 'bullmq';

const connection = {host: '127.0.0.1', port: 6379};
const emails = new Queue('emails', {connection});

await emails.add('send-receipt', {orderId: 42}, {
  jobId: `receipt:42`,
  attempts: 5,
  backoff: {type: 'exponential', delay: 1000},
  removeOnComplete: {age: 3600, count: 1000},
  removeOnFail: {age: 86400},
});

const worker = new Worker('emails', async (job) => {
  await sendReceipt(job.data.orderId);
}, {connection, concurrency: 5, lockDuration: 30000});
```

Retries with backoff, delayed and repeatable jobs, priorities, rate limiting,
concurrency, events and a dashboard — all of it already written and, more importantly,
already debugged. `removeOnComplete` matters more than it looks: without it, Redis
memory grows with every job you ever ran.

**Take this option when** job volume is real, you want retries and scheduling without
writing them, or you already run Redis for sessions and caching. The cost is a second
datastore in your availability story, and enqueue that is *not* transactional with
your database.

## Which one

Start with the database table if you have Postgres and no Redis — it is fewer moving
parts, and the transactional enqueue removes an entire class of bug. Move to BullMQ
when you want scheduling, rate limiting and retry semantics you would otherwise
write, or when queue traffic starts competing with application queries.

**Both at once is a defensible architecture**, not a failure: the outbox table is the
transactional record, and a relay moves it to BullMQ where the retry machinery lives
([page 06](./06-transactional-outbox.md)).

**Do not use** an in-memory array, `setImmediate`, or an unawaited promise. They lose
work on restart, have no retry, and still run on the API's event loop.

## What goes in the payload

**An identifier, not the object.** `{orderId: 42}`, not the whole order.

The job may run minutes later, and a copied object is stale by then — you will email a
receipt for a total that has since changed. It also keeps payloads small, which
matters when they are serialised into Redis, and it keeps personal data out of a
datastore with a different retention policy than your database.

The exception is data that must be *as it was*: the price at the time of order, the
address the user typed. That is domain state, so it belongs in the database row the
job reads — not in the payload.

## Gotchas

**Symptom:** Two workers processed the same job
**Cause:** No exclusive claim — a `select` then `update` instead of one atomic
statement.
**Fix:** `update … where id = (select … for update skip locked limit 1) returning`, in
one statement.

**Symptom:** Workers are slower with more workers
**Cause:** `for update` without `skip locked` — they queue on the same row. Measured
189 ms versus 94 ms.
**Fix:** Add `skip locked`.

**Symptom:** Redis memory grows forever
**Cause:** Completed and failed jobs retained by default.
**Fix:** `removeOnComplete` / `removeOnFail` with an age and count.

**Symptom:** A job processes stale data
**Cause:** The payload carried a copy of the row.
**Fix:** Put an id in the payload; read current state in the worker.

**Symptom:** Jobs are lost on deploy
**Cause:** An in-memory queue, or work started after the response.
**Fix:** A durable queue, plus graceful shutdown ([page 11](./11-graceful-shutdown.md)).

**Symptom:** The database is slow since the queue was added
**Cause:** Queue polling and job churn on the primary.
**Fix:** Index `(run_at, locked_until)`, poll with backoff or `LISTEN/NOTIFY`, or move
to Redis.

## Interview questions

**★ What are the minimum properties of a job queue?**
Durability, exclusive claim, a visibility timeout so a dead consumer's job comes back,
and acknowledgement on completion. Exactly-once delivery is not on the list — no queue
provides it, which is why jobs must be idempotent.

**★ How do you build a queue on PostgreSQL?**
A `jobs` table and one atomic claim: `update jobs set locked_until = now() + interval
'30 seconds' where id = (select id from jobs where run_at <= now() and (locked_until
is null or locked_until < now()) order by id for update skip locked limit 1)
returning`. `skip locked` is what lets workers take different rows — measured 94 ms
versus 189 ms for 20 jobs across 3 workers, with no job delivered twice.

**★ Redis queue or database queue?**
Database when you already have Postgres and want transactional enqueue — the enqueue
and the row commit together, which removes the dual-write problem entirely. Redis/
BullMQ when you want retries, backoff, scheduling and rate limiting without writing
them, or when queue traffic would compete with application queries.

**★ What should the job payload contain?**
An identifier and anything genuinely required to reconstruct intent — not a copy of
the row. The job runs later, so a copied object is stale, and it duplicates personal
data into a store with different retention.

**Why must every job be idempotent?**
Because delivery is at-least-once everywhere. A worker can complete the work and die
before acknowledging, and the visibility timeout will redeliver it. That is a correct
queue behaving correctly.

**What is a visibility timeout?**
The window during which a claimed job is invisible to other consumers. If the consumer
does not finish or extend it, the job becomes claimable again — which is how work
survives a crashed worker, and why a job that outlives its timeout gets processed
twice.

---

← Prev: [Sync vs background](./01-sync-vs-background.md) · Next → [Worker processes](./03-worker-processes.md)
