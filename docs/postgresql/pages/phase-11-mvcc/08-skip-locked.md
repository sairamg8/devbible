---
title: "SKIP LOCKED and the job queue"
sidebar_label: "08 · SKIP LOCKED"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex29-locks.mjs`.

**`FOR UPDATE SKIP LOCKED` returns the rows nobody else has locked and silently ignores
the rest. That one modifier turns a table into a work queue that N workers can drain
concurrently without coordinating, without duplicates, and without waiting on each
other.**

## The measurement that makes the case

Eight workers, 200 jobs, three claim strategies:

```console
$ node ex29-locks.mjs
=== 5. SKIP LOCKED job queue — 8 workers, 200 jobs ===
FOR UPDATE SKIP LOCKED               168.6 ms | claimed 200, done 200, duplicates 0, workers used 8
plain FOR UPDATE (serialised)        499.0 ms | claimed 200, done 200, duplicates 0, workers used 3
no locking at all (broken)           862.9 ms | claimed 793, done 200, duplicates 593, workers used 8
```

Three distinct outcomes:

- **`SKIP LOCKED`** — 168 ms, no duplicates, and all eight workers did real work.
- **Plain `FOR UPDATE`** — correct, but 3× slower and **only three of the eight workers
  ever got a job**. Every worker targets the same lowest-id row, so they queue behind
  each other; by the time a worker wakes, the job is taken and it re-queries. It is a
  single-file line wearing a parallel costume.
- **No locking** — 793 claims for 200 jobs: **593 duplicate executions.** Every worker
  read the same `ready` row and every one of them "claimed" it. In a real queue that is
  593 duplicate emails.

## The query

```sql
SELECT id FROM jobs
WHERE state = 'ready'
ORDER BY id
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

Every clause matters. `ORDER BY` makes the claim order deterministic (usually you want
`priority DESC, id`); `LIMIT` bounds how many rows one worker takes; `FOR UPDATE` holds
the claim until commit; `SKIP LOCKED` steps over rows other workers already hold.

## The claim-and-work loop

```js
async function claimOne(pool, workerId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {rows} = await client.query(
      `SELECT id, payload FROM jobs
       WHERE state = 'ready' AND run_after <= now()
       ORDER BY priority DESC, id
       LIMIT 1
       FOR UPDATE SKIP LOCKED`);
    if (rows.length === 0) { await client.query('ROLLBACK'); return null; }

    await client.query(
      `UPDATE jobs SET state = 'running', worker = $1, started_at = now()
       WHERE id = $2`, [workerId, rows[0].id]);
    await client.query('COMMIT');          // claim is now visible to everyone
    return rows[0];
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
```

**Commit the claim before doing the work, not after.** The alternative — holding the
transaction open for the job's duration — keeps a connection and a row lock for as long
as the job runs, and blocks [VACUUM](12-long-transactions.md) the whole time. A job
that takes 30 seconds would hold the xmin horizon for 30 seconds.

The cost of committing early is that a crashed worker leaves a row stuck in `running`.
That is what the `started_at` column is for:

```sql
-- reaper: return jobs abandoned by dead workers
UPDATE jobs SET state = 'ready', worker = NULL
WHERE state = 'running' AND started_at < now() - interval '5 minutes';
```

This makes delivery **at-least-once**: a job can run twice if a worker dies after doing
the work but before marking it done. Job handlers must be idempotent. There is no
configuration that makes it exactly-once.

## Index it as a partial index

The claim query filters on `state = 'ready'`, and once a queue is working most rows are
`done`:

```sql
CREATE INDEX jobs_ready_idx ON jobs (priority DESC, id) WHERE state = 'ready';
```

A [partial index](../phase-10-indexes/09-partial.md) stays small no matter how large the
history grows, because it only indexes the rows the claim query can match.

Queue tables are also the archetypal high-churn table: every row is inserted, updated
once or twice, then deleted. Set `fillfactor` lower so updates stay
[HOT](05-mvcc.md), and expect autovacuum to be the thing that keeps it healthy —
or move completed jobs to a history table and delete aggressively.

## When to use this rather than a real broker

**Use the table** when the jobs are already database work and you want them in the same
transaction as the data change — enqueue and business write commit together, so a job
can never reference a row that was rolled back. That transactional guarantee is exactly
what a separate broker cannot give you without an outbox.

**Use a broker** (Redis/BullMQ, RabbitMQ, SQS) when throughput is tens of thousands per
second, when you need fan-out to many consumer groups, or when the jobs have nothing to
do with your database. A queue table puts queue churn on the same disk, WAL and
autovacuum budget as your application tables.

At the scale most applications actually have — thousands of jobs per minute — the table
is the simpler and more reliable choice, and it is one dependency instead of two.

## Trade-off

**`SKIP LOCKED` trades ordering guarantees for parallelism.** A worker skipping a locked
row processes a *later* job first, so strict FIFO is gone. If your jobs must run in
order per entity, `SKIP LOCKED` on a global queue is wrong — partition the queue by
entity key and let one worker own each key, or take an
[advisory lock](15-advisory-locks.md) on the entity. Measured, the parallelism is worth
it: 168 ms against 499 ms, with all eight workers busy instead of three.

## Gotchas

**Symptom:** Jobs execute twice or more
**Cause:** Claiming without `FOR UPDATE` — every worker reads the same `ready` row
**Fix:** `FOR UPDATE SKIP LOCKED`; measured 593 duplicates out of 200 jobs without it

**Symptom:** Eight workers configured, only two or three ever busy
**Cause:** Plain `FOR UPDATE` — they all queue for the same lowest-id row
**Fix:** Add `SKIP LOCKED` (measured 3 workers used → 8, 499 ms → 168 ms)

**Symptom:** Jobs stuck in `running` forever
**Cause:** The worker died between claiming and finishing
**Fix:** A reaper on `started_at`, plus idempotent handlers — delivery is at-least-once

**Symptom:** VACUUM cannot keep up and the queue table bloats
**Cause:** Transactions held open for the duration of each job
**Fix:** Commit the claim, then work outside the transaction

**Symptom:** The claim query gets slower as history accumulates
**Cause:** Full index over all states, mostly `done` rows
**Fix:** Partial index `WHERE state = 'ready'`; archive or delete completed jobs

**Symptom:** Jobs for one entity run out of order
**Cause:** `SKIP LOCKED` deliberately skips ahead
**Fix:** Partition per entity, or serialise with an advisory lock on the entity id

## Interview questions

**★ What does `SKIP LOCKED` do?**
Omits rows currently locked by other transactions instead of waiting for them. It
returns fewer rows than the `LIMIT` and never raises an error.

**★ Why is plain `FOR UPDATE` a bad queue claim?**
All workers contend for the same first row, so they serialise. Measured: 8 workers, only
3 ever got a job, and total time went from 168 ms to 499 ms.

**★ What happens without any locking?**
Every worker reads the same `ready` rows and all of them claim them. Measured: 793
claims for 200 jobs — 593 duplicate executions, no errors.

**★ Should the transaction stay open while the job runs?**
No. Commit the claim first. Holding it keeps a connection, a row lock and the xmin
horizon for the job's whole duration. The cost is at-least-once delivery, handled by a
reaper and idempotent handlers.

**★ Can you get exactly-once delivery?**
No. A worker can complete the work and die before recording it. Design handlers to be
idempotent — that is the guarantee, not the configuration.

**How do you keep the claim query fast forever?**
A partial index on the ready predicate, so the index stays proportional to pending work
rather than to history.

**When is a broker the better choice?**
Very high throughput, fan-out to multiple consumer groups, or jobs unrelated to your
data. A table wins when enqueue must be transactional with the business write.

---

← [Row locks FOR UPDATE](07-row-locks.md) · Next → [Savepoints](09-savepoints.md)
