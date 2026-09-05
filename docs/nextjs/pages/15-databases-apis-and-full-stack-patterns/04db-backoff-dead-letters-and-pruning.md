---
title: "Retry is a policy, not a loop: the backoff decides whether a downstream outage recovers or is kept down by your own fleet, and the dead-letter path is what stops one broken job consuming the capacity of every healthy one"
sidebar_label: "04db · Backoff, dead letters, pruning"
sidebar_position: 47
description: "Exponential backoff with jitter written in SQL, permanent versus transient errors in the worker, the dead-letter path, the staggered requeue you will need at 3am, and batched pruning."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Vercel · Queues concepts](https://vercel.com/docs/queues/concepts)
> (retry handler shape, forced backoff after 32 delivery attempts, no built-in dead-letter
> queue, retention window) and the PostgreSQL 18 manual —
> [`SELECT`](https://www.postgresql.org/docs/18/sql-select.html) and
> [`UPDATE`](https://www.postgresql.org/docs/18/sql-update.html).
> Documentation-verified, **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · `pg` 8.23.0 · Node 24.20.0.

**A job that fails is not an error condition, it is the normal operating state of a distributed system, and the interesting question is what you do next. Retry immediately and you turn a struggling downstream into a dead one. Retry forever and a single malformed payload burns worker capacity indefinitely. Retry without jitter and your whole fleet re-synchronises on the same instant, so the recovery attempt is itself the second outage. This page is the failure branch of the worker: the backoff arithmetic in SQL, the distinction between an error worth retrying and one that never will be, the dead-letter path a job ends in, the staggered requeue you will want at 3am, and the pruning that keeps the table from becoming the slowest thing you own.**

## Failure — backoff, in SQL, with jitter

```sql
-- $1 = job id, $2 = worker id, $3 = error text
UPDATE jobs
   SET status = CASE WHEN attempts >= max_attempts
                     THEN 'dead'::job_status
                     ELSE 'pending'::job_status END,
       -- 5s, 10s, 20s, 40s … capped at one hour, ±50% jitter.
       run_at = now() + make_interval(
                  secs => least(3600, 5 * power(2, attempts)) * (0.5 + random())),
       locked_until = NULL,
       locked_by    = NULL,
       last_error   = left($3, 2000),
       finished_at  = CASE WHEN attempts >= max_attempts THEN now() ELSE NULL END
 WHERE id = $1
   AND locked_by = $2
   AND status = 'running';
```

Four decisions are encoded there and each is worth defending:

- **Exponential**, because the common transient failure is a downstream service under load, and a fixed retry interval means your fleet retries in lockstep and keeps it under load.
- **Capped**, because unbounded doubling produces a job that retries next week and looks lost.
- **Jittered**, because a hundred jobs that failed together during one outage will otherwise all retry at the same instant and re-create it. `(0.5 + random())` spreads them across a window without changing the average.
- **`left($3, 2000)`**, because an error message can be a megabyte of HTML from a proxy, and you are about to store one per attempt per job.

Vercel's hosted queue does the same arithmetic in application code, and its example is worth having beside yours:

```ts
// Vercel Queues' documented retry handler shape
export const POST = handleCallback(
  async (message, metadata) => { await fulfillOrder(message) },
  { retry: (error, metadata) => {
      if (metadata.deliveryCount > 10) return { acknowledge: true }
      const delay = Math.min(300, 2 ** metadata.deliveryCount * 5)
      return { afterSeconds: delay }
  } },
)
```

It also enforces a ceiling on your patience, which is a good idea to copy:

> *"For the first 32 delivery attempts, Vercel respects your configured retry delay. After 32 attempts, the system begins forcing exponential backoff to maintain system health and prevent runaway deliveries."*

## Permanent versus transient, wired into the worker

The backoff statement above is the *transient* branch. A permanent error — a payload that does not parse, a referenced row that has been deleted, a 400 from an API telling you the request will never be valid — must not consume the retry budget, because the same input will produce the same result on every attempt. [04c](04c-the-anatomy-of-a-job.md) introduces the two error classes; here is the worker that reads them.

```ts
// lib/jobs/run.ts
import type { Pool } from 'pg'
import { PermanentJobError } from './errors'
import type { ClaimedJob } from './claim'

const ACK_SQL = `
UPDATE jobs SET status = 'done', finished_at = now(), locked_until = NULL, last_error = NULL
 WHERE id = $1 AND locked_by = $2 AND status = 'running'`

const RETRY_SQL = `
UPDATE jobs
   SET status = CASE WHEN attempts >= max_attempts THEN 'dead'::job_status
                     ELSE 'pending'::job_status END,
       run_at = now() + make_interval(secs => least(3600, 5 * power(2, attempts)) * (0.5 + random())),
       locked_until = NULL, locked_by = NULL, last_error = left($3, 2000),
       finished_at = CASE WHEN attempts >= max_attempts THEN now() ELSE NULL END
 WHERE id = $1 AND locked_by = $2 AND status = 'running'`

const KILL_SQL = `
UPDATE jobs SET status = 'dead', finished_at = now(), locked_until = NULL,
       locked_by = NULL, last_error = left($3, 2000)
 WHERE id = $1 AND locked_by = $2 AND status = 'running'`

export async function runJob(
  pool: Pool,
  job: ClaimedJob,
  workerId: string,
  handle: (job: ClaimedJob) => Promise<void>,
): Promise<void> {
  try {
    await handle(job)
    const acked = await pool.query(ACK_SQL, [job.id, workerId])
    if (acked.rowCount === 0) {
      // We lost the lease mid-job; someone else owns the outcome now.
      console.warn('job completed after losing lease', { id: job.id, workerId })
    }
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    const sql = error instanceof PermanentJobError ? KILL_SQL : RETRY_SQL
    await pool.query(sql, [job.id, workerId, message])
  }
}
```

🔴 Three statements, all three carrying `AND locked_by = $2 AND status = 'running'`. A worker may only write an outcome for a job it still owns. Without that guard, a worker whose lease expired mid-job overwrites the state of the worker that legitimately reclaimed it — and the symptom is a job that flips between `running` and `pending` with no explanation.

## Choosing `max_attempts`

There is no universal number, but there is a derivation. Ask how long the *longest outage you intend to survive without human intervention* is, then pick the attempt count whose cumulative backoff exceeds it. With the `5 * 2^n` schedule capped at an hour, five attempts covers roughly the first hour and a half; ten attempts covers most of a day. Setting it to three because three looks tidy means a fifteen-minute provider incident dead-letters your entire evening's work, and you find out from the dead-letter count rather than from the recovery.

Two adjustments worth making per `kind` rather than globally:

- **Idempotent, cheap, externally-owned** work (webhook delivery, index updates) can take a generous budget — failure is cheap and success is valuable.
- **Expensive or user-visible** work (a large transcode, a charge attempt) should dead-letter earlier and louder, because a human deciding is better than nine more automatic attempts.

## The dead-letter path

A `dead` job must leave the hot loop. Two implementations, both fine:

**Status in place.** `status = 'dead'` — as above. The payload, the attempt history and the last error stay on one row, requeue is a single `UPDATE`, and the partial index on `status = 'pending'` already excludes them from the claim path. This is the right default.

**A separate table.** Move the row to `jobs_dead` on the final failure. Worth it when the main table is pruned aggressively and you want dead jobs to survive that pruning with different retention.

The requeue — which is the part people forget to build, and then perform by hand at 3am:

```sql
-- Requeue one job after fixing the bug, with a fresh attempt budget.
UPDATE jobs
   SET status = 'pending', attempts = 0, run_at = now(),
       last_error = NULL, finished_at = NULL
 WHERE id = $1 AND status = 'dead';

-- Requeue a whole incident, rate-limited so the retry does not become the outage.
UPDATE jobs
   SET status = 'pending', attempts = 0,
       run_at = now() + make_interval(secs => 0.1 * row_number() OVER (ORDER BY id))
 WHERE id IN (
   SELECT id FROM jobs
    WHERE status = 'dead' AND kind = $1 AND finished_at > $2
    ORDER BY id
 );
```

⚠️ The second statement uses a window function inside `SET`, which PostgreSQL does not permit directly in an `UPDATE` target list — write it as an `UPDATE … FROM (SELECT id, row_number() OVER (ORDER BY id) AS n FROM …) s WHERE jobs.id = s.id` if your version rejects it. The point that matters is the **staggering**: requeueing ten thousand dead jobs with `run_at = now()` recreates whatever knocked them over.

Hosted queues generally do not give you a dead-letter queue at all, which is worth knowing before you assume one:

> *"Vercel Queues doesn't have a built-in dead-letter queue. Instead, you handle poisoned messages at the application level using the SDK's `retry` handler."*
> *"Because messages with no delivery attempts are always prioritized over retried messages, a poisoned message naturally falls to lower priority."*

And they expire messages whether or not you dealt with them:

> *"Retention is configurable per-message from 60 seconds to 7 days, defaulting to 24 hours."*

A Postgres table has no retention at all, which is a feature during an incident and a liability afterwards — hence pruning.

## Pruning

```sql
-- Keep a week of successes for debugging, then drop them.
DELETE FROM jobs
 WHERE status = 'done'
   AND finished_at < now() - interval '7 days';
```

Run it in bounded batches (`… AND id IN (SELECT id FROM jobs WHERE … LIMIT 10000)`) rather than as one enormous statement: a single `DELETE` of millions of rows is a long transaction, and a long transaction on the queue table is the problem you were avoiding in Shape B.


## Gotchas

**★ Symptom: a job flips between `running` and `pending` and its `last_error` keeps changing worker id.** Cause: two workers both believe they own it — one lost its lease and kept writing outcomes anyway. Fix: every outcome statement carries `AND locked_by = $2 AND status = 'running'`, and a zero row count is treated as "you lost it", logged and dropped rather than retried:

```ts
const acked = await pool.query(ACK_SQL, [job.id, workerId])
if (acked.rowCount === 0) console.warn('lost lease before ack', { id: job.id })
```

**Symptom: the dead-letter count has been growing for three weeks and nobody knew.** Cause: dead-lettering is the *end* of the automatic path, so unless something watches it, a job class that broke on a Tuesday is invisible until a customer complains. Fix: alert on the rate of transitions into `dead`, not on the total, and break it down by `kind` — see [04i](04i-queue-observability.md):

```sql
SELECT kind, count(*) FROM jobs
 WHERE status = 'dead' AND finished_at > now() - interval '1 hour'
 GROUP BY kind ORDER BY 2 DESC;
```

**★ Symptom: after a downstream outage recovers, it immediately falls over again.** Cause: every job that failed during the outage was scheduled with the same deterministic backoff, so they all became claimable in the same second — a thundering herd of your own making. Fix: jitter. `least(3600, 5 * power(2, attempts)) * (0.5 + random())` spreads a synchronised failure set across a window while keeping the same mean delay.

**Symptom: `last_error` is enormous and the table has ballooned.** Cause: storing a full upstream response body per failed attempt. Fix: truncate at write time with `left($3, 2000)`, and log the full body to your log sink where it has retention rules.

**Symptom: a bug is fixed, four thousand jobs are requeued, and the service goes down again.** Cause: the requeue set `run_at = now()` for all of them, so they became claimable simultaneously and hit a downstream that is sized for steady state. Fix: stagger the requeue, as in the windowed statement above, so the replay lands at a rate the downstream can absorb.

**Symptom: a job requeued from `dead` immediately dies again without any new attempts being visible.** Cause: `attempts` was not reset, so it is already at or above `max_attempts` and the first failure sends it straight back. Fix: `SET attempts = 0` in the requeue — a requeue after a code fix is a new job's worth of budget, not a continuation of the old one.

**Symptom: nightly pruning locks the queue for minutes.** Cause: a single unbounded `DELETE` over millions of rows is one long transaction, which both blocks and holds back vacuum. Fix: loop over bounded batches:

```sql
DELETE FROM jobs
 WHERE id IN (
   SELECT id FROM jobs
    WHERE status = 'done' AND finished_at < now() - interval '7 days'
    LIMIT 10000
 );
```

## Interview questions

**★ Why does every outcome statement carry `AND locked_by = $2`?**
Because ownership of a job can be lost without the worker noticing. A lease expires on wall-clock time; a process that was frozen, GC-stalled or partitioned can come back believing it still holds a claim that a reaper has already released and another worker has already taken. If the outcome statements do not check ownership, the stale worker writes `done` over a job that is genuinely mid-flight elsewhere, or resets `run_at` on someone else's claim, and the resulting state flapping is nearly impossible to read from logs. Checking `locked_by` makes the write conditional on a fact the database can verify, and a zero row count becomes a clean, explicit signal that this worker's opinion is out of date.

**How do you choose `max_attempts` in a way you can defend?**
Work backwards from the longest downstream outage you want to ride out without a human. Sum the backoff schedule until the cumulative delay exceeds that window, and use the resulting attempt count — with the usual `5 · 2^n` capped at an hour, five attempts buys about ninety minutes and ten buys most of a day. Then adjust per job kind rather than globally: cheap idempotent work like webhook delivery or index updates should be patient, because retrying costs almost nothing and giving up costs data consistency, while expensive or user-visible work should dead-letter early and loudly, because a human making a decision is better than nine more automatic attempts at something that is going to need one anyway.

**★ Why jitter a retry delay, when the exponential part already spreads things out?**
Exponential backoff spreads *successive* attempts of one job; it does nothing to spread *simultaneous* attempts of many jobs. During an outage, every in-flight job fails within the same few seconds, so they all get `attempts = 1` at roughly the same moment and therefore all become claimable at the same moment. The recovering service is hit by the entire backlog at once, fails again, and the herd re-synchronises — a retry storm that is indistinguishable from the original outage and is entirely self-inflicted. Multiplying the delay by a random factor decorrelates them at no cost to the average wait.

**What belongs in the dead-letter table, and what is it actually for?**
Everything needed to re-run the job after a fix: the original payload, the kind, how many times it was tried, and the last error. Its purpose is not archival — it is to get a permanently failing job out of the claim path so it stops consuming worker capacity and log volume ahead of healthy work, while keeping enough context that a human can decide between requeue, discard and code change. The measure of whether you built it properly is whether the requeue is a single query you can run confidently during an incident, or an ad-hoc script someone writes under pressure. Note that hosted queues frequently do not provide one — Vercel's documentation says plainly that it *"doesn't have a built-in dead-letter queue"* and hands the problem back to your retry handler — so if you are using one, this is code you own either way.

**Your queue table is 40 GB, mostly `done` rows, and claim latency has crept up. What do you do first, and why not just delete everything?**
First, confirm the claim path is on a partial index restricted to `status = 'pending'`, because if it is, table size should barely matter and the real cause is elsewhere — bloat, a missing `VACUUM`, or a long-running transaction. If it is not, that index is the fix and it is cheaper than any deletion. Only then prune, and in bounded batches, because a single `DELETE` of tens of millions of rows is a long transaction that holds back the vacuum horizon for the whole database — you would be causing the exact problem you are trying to clear. It also does not immediately return disk to the operating system; it creates dead tuples that autovacuum must then process, so the space is reclaimed for reuse rather than freed, which is worth knowing before you promise anyone a smaller disk.

---

← [04da · Leases and the claim lifetime](04da-leases-and-the-claim-lifetime.md) · Next → [04e · At-least-once and the dedupe table](04e-at-least-once-and-idempotency.md)
