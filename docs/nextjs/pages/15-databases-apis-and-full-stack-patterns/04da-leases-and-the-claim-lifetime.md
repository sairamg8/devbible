---
title: "A claim is a promise with a deadline: the lease is what turns a dead worker from a permanently stuck job into one that comes back on its own, which is why every statement a worker runs after the claim carries a WHERE clause proving it still owns the row"
sidebar_label: "04da · Leases and the claim lifetime"
sidebar_position: 46
description: "The visibility timeout as a lease, the reaper, heartbeats for long jobs, which transaction the work lives in, and the ack that checks it still owns the job."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 manual —
> [`SELECT`, The Locking Clause](https://www.postgresql.org/docs/18/sql-select.html) — the
> [node-postgres pooling documentation](https://node-postgres.com/features/pooling), the
> [Prisma/PgBouncer transaction-mode notes](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/pgbouncer),
> and [Vercel · Queues concepts](https://vercel.com/docs/queues/concepts) (visibility
> timeout, retry backoff after 32 attempts, no built-in DLQ, retention).
> Documentation-verified, **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · `pg` 8.23.0 · Node 24.20.0.

**[04d](04d-postgres-as-a-queue-skip-locked.md) gets a job into a worker's hands. This page is everything that happens when the worker does not give it back: the lease that expires, the reaper that notices, the heartbeat that keeps a legitimately slow job alive, and the ack that refuses to fire when the worker has quietly lost ownership. It also settles the question 04d deliberately deferred — whether the work runs inside the claim's transaction — because that single choice decides whether your queue is compatible with a connection pool at all.**

## The lease is the only recovery mechanism you get

`locked_until` is not bookkeeping. It is the entire answer to "a worker was killed mid-job". Hosted queues call the same thing a visibility timeout:

> *"When a message is delivered to a consumer, it becomes temporarily invisible to other consumers in the same group. This is the **visibility timeout**."*
> *"The default visibility timeout is **60 seconds**. You can configure it per receive request from 0 to 3,600 seconds (60 minutes). Setting it to `0` peeks at the message without leasing it."*
> — [Vercel · Queues concepts](https://vercel.com/docs/queues/concepts)

Sixty seconds is a reasonable default to steal, with one caveat: it should be set from your job durations, not from a convention. **Set the lease comfortably above the p99 duration of the slowest `kind` that shares the table**, and use a heartbeat for the handful of jobs that legitimately run longer.

### The reaper

```sql
-- Runs every minute — from cron, or from the worker's own timer.
UPDATE jobs
   SET status = 'pending', locked_until = NULL, locked_by = NULL
 WHERE status = 'running'
   AND locked_until < now();
```

This is one statement against the `jobs_expired` partial index, and it is the reason the claim query in [04d](04d-postgres-as-a-queue-skip-locked.md) can stay on a single narrow `status = 'pending'` index.

### Or fold recovery into the claim

```sql
-- Self-healing variant: also picks up jobs whose worker died.
WITH claimed AS (
  SELECT id FROM jobs
   WHERE (status = 'pending' AND run_at <= now())
      OR (status = 'running' AND locked_until < now())
   ORDER BY run_at, id
   LIMIT $1
   FOR UPDATE SKIP LOCKED
)
UPDATE jobs j SET status = 'running', locked_until = now() + make_interval(secs => $2),
       locked_by = $3, attempts = j.attempts + 1
  FROM claimed c WHERE j.id = c.id
RETURNING j.id, j.kind, j.payload, j.attempts, j.max_attempts;
```

One fewer moving part, and it is what most small deployments should run. The cost is that the `OR` cannot satisfy the `status = 'pending'` partial index on its own; the planner needs both partial indexes and a bitmap combination, so the hot path is no longer a single narrow index scan. Choose the reaper when the queue is hot enough that the claim's plan matters, and the folded version when it is not. Both are correct; the difference is index shape, not semantics.

### Heartbeats, for jobs that are slow rather than dead

```sql
-- Extend our own lease. Note every guard in the WHERE clause.
UPDATE jobs
   SET locked_until = now() + make_interval(secs => $2)
 WHERE id = $1
   AND locked_by = $3
   AND status = 'running'
   AND locked_until > now();
```

```ts
// lib/jobs/heartbeat.ts
import type { Pool } from 'pg'

const HEARTBEAT_SQL = `
UPDATE jobs SET locked_until = now() + make_interval(secs => $2)
 WHERE id = $1 AND locked_by = $3 AND status = 'running' AND locked_until > now()`

/**
 * Returns false when we no longer own the lease — the caller must ABORT.
 * Someone else has the job now; finishing would be duplicate execution.
 */
export async function heartbeat(
  pool: Pool,
  jobId: string,
  leaseSeconds: number,
  workerId: string,
): Promise<boolean> {
  const result = await pool.query(HEARTBEAT_SQL, [jobId, leaseSeconds, workerId])
  return result.rowCount === 1
}
```

🔴 **`locked_until > now()` is the load-bearing guard.** Without it, a worker whose lease has already expired — because it was paused, GC-stalled, or network-partitioned — happily re-extends a lease that a *second* worker now holds, and both proceed. Zero affected rows means "you lost the race"; treat that as a signal to stop, not as a no-op.

## Which transaction does the *work* live in?

This is the decision people skip, and it determines whether your queue survives contact with a connection pool.

### Shape A — short claim transaction, lease covers the work

```text
BEGIN → claim (SKIP LOCKED) → COMMIT → release connection
      → do the work (HTTP, S3, email — takes seconds or minutes)
      → BEGIN → ack/retry → COMMIT
```

The database connection is held for milliseconds twice, not for the whole job. Safety comes from `locked_until`: if the worker dies mid-job, the lease expires and another worker picks it up.

### Shape B — hold the transaction open for the whole job

```text
BEGIN → SELECT … FOR UPDATE SKIP LOCKED → do the work → DELETE the row → COMMIT
```

Seductive, because the crash semantics are perfect: a dead worker's transaction aborts, its row lock vanishes, and the job is instantly claimable again with no lease and no reaper. It is also usually wrong in a serverless or pooled deployment, for three separate reasons:

1. **It occupies a connection for the entire job duration.** With `max: 10` and jobs taking thirty seconds, ten concurrent jobs is your whole pool — and that pool is shared with the application's user-facing queries.
2. **It is a long-running transaction**, which holds back the transaction horizon and prevents `VACUUM` from cleaning up dead tuples *across the whole database*, not just this table. A queue is a high-churn table; blocking its vacuum is how the queue table becomes the slowest thing in the system.
3. **It cannot survive a transaction-mode pooler.** PgBouncer in transaction mode returns the server connection at `COMMIT`; a session holding a transaction across application-level awaits is exactly what that mode does not support. See [01c · Transaction pooling and session state](01c-transaction-pooling-and-session-state.md).

🔴 **Use Shape A.** Shape B is defensible only for a dedicated worker with its own direct connection, jobs measured in milliseconds, and no pooler in the path.

## Ack — and why the ack has a `WHERE` clause too

```sql
UPDATE jobs
   SET status = 'done', finished_at = now(), locked_until = NULL, last_error = NULL
 WHERE id = $1
   AND locked_by = $2
   AND status = 'running';
```

`AND locked_by = $2` stops a worker whose lease expired from marking `done` a job that another worker is currently, correctly, running. If the ack affects zero rows, the job was taken from you and its outcome is now someone else's; log it and move on rather than retrying the ack.

**Ack after the effect is durable, never before.** That ordering is what makes the system at-least-once rather than at-most-once, and at-least-once is the failure mode you can repair — with idempotency, [04e](04e-at-least-once-and-idempotency.md). What happens on the *other* branch, when the handler throws, is [04db](04db-backoff-dead-letters-and-pruning.md).

## Gotchas

**★ Symptom: `VACUUM` never reclaims space on the `jobs` table and the whole database slows down.** Cause: Shape B — a worker holding a transaction open for the duration of each job. A long-lived transaction holds back the horizon autovacuum needs, and it does so database-wide, not just for this table. Fix: switch to Shape A — commit the claim, do the work with no transaction open, then open a second short transaction to ack.

**★ Symptom: the claim query is fast in staging and does a sequential scan in production.** Cause: the partial index's predicate is not implied by the query's `WHERE` clause — typically because the query was widened to `status IN ('pending','running')` when lease recovery was added, and `IN` does not imply `= 'pending'`. Fix: either keep two partial indexes and write the predicate as an `OR` of the two exact conditions, which the planner can satisfy with a bitmap of both, or split recovery into a reaper and leave the claim predicate untouched:

```sql
CREATE INDEX jobs_claimable ON jobs (run_at, id)     WHERE status = 'pending';
CREATE INDEX jobs_expired   ON jobs (locked_until)   WHERE status = 'running';
```

**★ Symptom: a slow-but-healthy job is processed twice, and the second run overwrites the first.** Cause: the lease is shorter than the job. It expired mid-flight, a second worker reclaimed it, and both finished. Fix: heartbeat from inside the handler and abort when you lose the lease:

```ts
const timer = setInterval(async () => {
  if (!(await heartbeat(pool, job.id, 60, workerId))) controller.abort()
}, 20_000)
try { await handle(job, controller.signal) } finally { clearInterval(timer) }
```

**★ Symptom: a job is marked `done` but the work never happened.** Cause: the ack ran before the effect — usually written that way to "keep the transaction short" or because the handler returned a promise nobody awaited. Fix: ack strictly after the effect is durable, and guard the ack with `AND locked_by = $2 AND status = 'running'` so a worker that lost its lease cannot ack someone else's in-flight job.

**Symptom: the reaper resurrects a job that a worker was genuinely still running, but only in production.** Cause: production workers are subject to CPU throttling and long GC pauses that staging never sees, so a "30-second" job occasionally takes ninety. Fix: the lease is sized from p99 real durations plus a margin, and anything that can legitimately exceed it must heartbeat. If you cannot bound a job's duration at all, it is the wrong shape — split it into chunked jobs that each fit inside the lease.

## Interview questions

**★ Should the worker hold the transaction open while it does the work?**
Only if it owns its own direct connection, its jobs are very short, and there is no transaction-mode pooler in the path. Holding it gives beautiful crash semantics — the transaction aborts, the lock disappears, the job is instantly available again, no lease and no reaper needed. But it pins a connection for the entire job, so on a shared pool a handful of slow jobs starve the user-facing application, and it creates a long-running transaction that holds back the vacuum horizon for the whole database — which is especially bad on the high-churn table you are holding it on. The default should be the short claim transaction plus a `locked_until` lease: two millisecond-scale transactions per job, with the lease providing the recovery the open transaction would have given you for free.

**★ What is the failure mode of a lease that is too short, and of one that is too long?**
Too short and a job that is merely slow — a large upload, a rate-limited API — has its lease expire while it is still running, so a second worker claims it and you get concurrent duplicate execution, which is exactly what the claim was supposed to prevent. Too long and a genuinely dead worker's jobs sit unclaimable for the full lease before anyone retries them, so your recovery time equals your lease length. The resolution is not a cleverer number: set the lease comfortably above p99 job duration and *extend* it with a heartbeat for jobs that legitimately run long, so slow jobs stay claimed without forcing everyone else to wait as long for recovery.

**★ Why does the heartbeat check `locked_until > now()` when it is the current owner doing the extending?**
Because "current owner" is a belief the worker holds, not a fact it can verify without asking. A process that was stopped — a long GC pause, a container frozen for migration, a network partition — can wake up after its lease has expired and a second worker has already claimed the job. Without the guard, that stale worker extends a lease it no longer holds, and now two workers each believe they own the job and neither will notice. With the guard, the update affects zero rows, which is an unambiguous signal to abort the handler. The general principle is that any distributed lock must be re-validated at every use, never assumed from the moment it was acquired.

**★ Why increment the attempt counter at claim time rather than on failure — and how does that interact with the lease?**
Because the dangerous failure is the one that never reports. A job that kills the worker outright — a heap blowout, a native crash, an infinite loop until the platform reaps the instance — never reaches the failure handler, so a failure-time counter stays at zero. Lease expiry then hands the same poison pill to the next worker, forever, taking down one worker per cycle. Incrementing on claim means every *delivery* is counted whether or not anyone survived to report it, so the poison pill reaches `max_attempts` and dead-letters itself. The interaction with the lease is exactly the point: lease expiry is a re-delivery, and re-delivery must cost an attempt, or the two mechanisms combine into an infinite loop.

---

← [04d · Postgres as a queue: `SKIP LOCKED`](04d-postgres-as-a-queue-skip-locked.md) · Next → [04db · Backoff, dead letters and pruning](04db-backoff-dead-letters-and-pruning.md)
