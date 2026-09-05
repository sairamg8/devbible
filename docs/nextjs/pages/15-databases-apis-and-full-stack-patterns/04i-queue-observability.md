---
title: "Queue depth is the metric everyone graphs and the one that tells you least — the number that actually means something is the age of the oldest claimable job, because it is measured in the unit your users experience and it is zero whenever you are keeping up"
sidebar_label: "04i · Knowing the queue is behind"
sidebar_position: 54
description: "Depth versus oldest-unclaimed age, arrival rate against completion rate, the queries that produce each, the alert that catches a dead worker fleet, tracing across the enqueue boundary, and what to page on."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the PostgreSQL 18
> [`SELECT`](https://www.postgresql.org/docs/18/sql-select.html) manual (the `SKIP LOCKED`
> consistency warning) and
> [monitoring statistics](https://www.postgresql.org/docs/18/monitoring-stats.html)
> (`pg_stat_activity`), plus
> [Vercel · Queues concepts](https://vercel.com/docs/queues/concepts) for the delivery
> semantics these metrics measure. Documentation-verified, **no sandbox run, no timings,
> no example metric values**.
> Target: **PostgreSQL 18.4** · `pg` 8.23.0 · Node 24.20.0.

**A queue does not fail loudly. It fails by getting slower, and "slower" is invisible until someone outside engineering notices that receipts arrive an hour late. That is why this page exists as its own chunk: everything up to here makes the queue correct, and none of it tells you whether it is currently *working*. Two questions matter and they need different metrics. "Am I keeping up?" is answered by the age of the oldest claimable job, not by depth. "Am I succeeding?" is answered by the rate of transitions into `dead`, not by an error count in logs. This page is the queries for both, the one alert that catches a worker fleet that has silently stopped, and the column you will wish you had added on day one.**

## The column you will wish you had added

The schema in [04d](04d-postgres-as-a-queue-skip-locked.md) can tell you when a job was created and when it finished, but not when it *started* — so it cannot tell you execution duration, and cannot separate "the queue is backed up" from "each job got slower".

```sql
ALTER TABLE jobs ADD COLUMN started_at timestamptz;
```

Set it in the claim, alongside the lease:

```sql
UPDATE jobs j
   SET status = 'running', started_at = now(),
       locked_until = now() + make_interval(secs => $2),
       locked_by = $3, attempts = j.attempts + 1
  FROM claimed c WHERE j.id = c.id
RETURNING j.id, j.kind, j.payload, j.attempts, j.max_attempts;
```

With `created_at`, `started_at` and `finished_at` you can decompose end-to-end latency into **queue wait** and **execution time**, which are two entirely different problems with two entirely different fixes — add workers versus make the handler faster.

## 🔴 Depth is the wrong headline metric

A depth of 10,000 draining at 5,000 per minute is a healthy queue two minutes behind. A depth of 50 that has not moved in an hour is an outage. Depth cannot distinguish them, because it is a stock and the thing you care about is a flow.

The metric that can is **the age of the oldest claimable job**: it is expressed in seconds of user-visible latency, it is near zero whenever you are keeping up regardless of volume, and it rises the instant you stop.

```sql
-- The headline number. One row, always.
SELECT
  coalesce(extract(epoch FROM now() - min(run_at)), 0) AS oldest_claimable_age_seconds,
  count(*)                                             AS depth
FROM jobs
WHERE status = 'pending' AND run_at <= now();
```

🔴 **No `SKIP LOCKED`, ever, in a metric query.** The manual is explicit that *"Skipping locked rows provides an inconsistent view of the data, so this is not suitable for general purpose work"* — a metric written that way silently under-reports in proportion to how busy your workers are, which is precisely when you need it to be right.

Per kind, because one slow kind hiding behind nine fast ones is the normal case:

```sql
SELECT kind,
       count(*) FILTER (WHERE status = 'pending' AND run_at <= now())  AS claimable,
       count(*) FILTER (WHERE status = 'pending' AND run_at >  now())  AS scheduled,
       count(*) FILTER (WHERE status = 'running')                      AS running,
       count(*) FILTER (WHERE status = 'dead')                         AS dead,
       coalesce(extract(epoch FROM now() - min(run_at))
                FILTER (WHERE status = 'pending' AND run_at <= now()), 0) AS oldest_age_s
  FROM jobs
 GROUP BY kind
 ORDER BY oldest_age_s DESC;
```

Note the split between **claimable** and **scheduled**. A thousand jobs deliberately delayed until tomorrow is not a backlog, and a dashboard that counts them as one will train everyone to ignore the graph.

## Arrival rate against completion rate

Depth's derivative is what tells you whether you will recover on your own.

```sql
-- Enqueued vs finished in the last five minutes, by kind.
SELECT kind,
       count(*) FILTER (WHERE created_at  > now() - interval '5 minutes') AS arrived,
       count(*) FILTER (WHERE finished_at > now() - interval '5 minutes'
                          AND status = 'done')                            AS completed
  FROM jobs
 WHERE created_at > now() - interval '5 minutes'
    OR finished_at > now() - interval '5 minutes'
 GROUP BY kind;
```

If `arrived` exceeds `completed` for a sustained period, the backlog grows without bound and no amount of waiting fixes it — that is a capacity decision, not an incident to ride out. If `completed` exceeds `arrived`, you are draining and the only question is how long.

## Latency, decomposed

```sql
SELECT kind,
       percentile_disc(0.5)  WITHIN GROUP (ORDER BY started_at  - created_at) AS wait_p50,
       percentile_disc(0.95) WITHIN GROUP (ORDER BY started_at  - created_at) AS wait_p95,
       percentile_disc(0.5)  WITHIN GROUP (ORDER BY finished_at - started_at) AS exec_p50,
       percentile_disc(0.95) WITHIN GROUP (ORDER BY finished_at - started_at) AS exec_p95
  FROM jobs
 WHERE status = 'done'
   AND finished_at > now() - interval '1 hour'
 GROUP BY kind;
```

**`wait_p95` is your capacity signal; `exec_p95` is your code signal.** Rising wait with flat execution means add workers. Rising execution means something downstream got slower, and adding workers will make it worse by increasing concurrent pressure on whatever that is.

`exec_p95` is also the number that sets your lease: it must be comfortably below `locked_until`'s interval, or slow-but-healthy jobs get reclaimed under you ([04da](04da-leases-and-the-claim-lifetime.md)).

## Health of the running set

```sql
-- In-flight work, and anything whose lease has already lapsed.
SELECT locked_by,
       count(*)                                                   AS running,
       count(*) FILTER (WHERE locked_until < now())               AS lease_expired,
       max(now() - started_at)                                    AS longest_running
  FROM jobs
 WHERE status = 'running'
 GROUP BY locked_by
 ORDER BY longest_running DESC;
```

A non-zero `lease_expired` for more than a reaper interval means the reaper is not running. A `locked_by` that appears with `running` rows but has stopped appearing in completions is a worker that died without draining.

Retry pressure, which usually moves before anything else does:

```sql
SELECT kind, attempts, count(*)
  FROM jobs
 WHERE status = 'pending' AND attempts > 0
 GROUP BY kind, attempts
 ORDER BY kind, attempts;
```

A rising population at `attempts = 1` is a downstream wobbling; a population climbing through 3, 4, 5 is a downstream that is not coming back and a dead-letter wave arriving shortly.

## 🔴 The alert nobody has

Every dashboard has "depth is high". Almost none has the one that catches a worker deployment scaled to zero, a crash loop, or a `DATABASE_URL` rotated on the app but not on the worker:

```sql
-- Work is waiting AND nothing has completed recently.
SELECT
  (SELECT count(*) FROM jobs
    WHERE status = 'pending' AND run_at <= now())                     AS claimable,
  (SELECT count(*) FROM jobs
    WHERE status = 'done' AND finished_at > now() - interval '5 minutes') AS completed_5m;
```

**Page when `claimable > 0` and `completed_5m = 0`.** Depth alone never catches this quickly, because a stopped fleet produces a slowly rising line that looks exactly like a busy afternoon; the conjunction fires within one alert interval and has almost no false-positive surface — if there is work available and nothing is completing, something is wrong, always.

## Tracing across the enqueue boundary

The job runs minutes later, in a different process, with none of the request's context. Carry the correlation id in the payload or you will never connect a slow receipt back to the checkout that caused it.

```ts
// At enqueue time, inside the request.
await enqueue(client, 'order.paid', {
  orderId: order.id,
  traceId: request.headers.get('x-request-id') ?? crypto.randomUUID(),
})

// In the worker, on every log line for this job.
const log = (event: string, extra: Record<string, unknown> = {}) =>
  console.info(JSON.stringify({
    event, jobId: job.id, kind: job.kind, attempt: job.attempts,
    traceId: (job.payload as { traceId?: string }).traceId, ...extra,
  }))

log('job.start')
try {
  await handle(job)
  log('job.done', { durationMs: Date.now() - t0 })
} catch (error) {
  log('job.failed', { durationMs: Date.now() - t0, error: String(error) })
  throw error
}
```

Emit `attempt` on every line. Without it, a log search for one job id returns five identical-looking blocks and you cannot tell which was the successful one.

## Who emits the gauges

Counters — jobs started, completed, failed, dead-lettered — are per-worker and should be emitted by each worker. **Gauges are not.** If ten workers each report `queue_depth`, you get ten series that flap against each other and a dashboard that either sums to ten times reality or picks one arbitrarily.

Run the gauge queries from **one** place: a dedicated scrape endpoint, the cron drain, or a small metrics process. If you must emit from workers, gate it behind the same advisory lock pattern as a single-instance cron ([04h](04h-cron-and-scheduled-work.md)).

## What to page on, and what to merely graph

| Signal | Page | Graph only |
|---|---|---|
| `claimable > 0` and no completions in 5 min | ✅ the fleet is down | |
| Oldest claimable age above the SLO for that kind | ✅ per kind, not globally | |
| Transitions into `dead` for a money-moving kind | ✅ any at all | |
| Unsettled `external_calls` older than 15 min ([04ea](04ea-external-effects-and-provider-idempotency.md)) | ✅ money in an unknown state | |
| Oldest unpublished outbox row ([04c](04c-the-anatomy-of-a-job.md)) | ✅ the relay has stopped | |
| Depth | | ✅ context, not a trigger |
| `exec_p95` per kind | | ✅ drives lease sizing |
| Retry-attempt histogram | | ✅ leading indicator |
| Table size and dead-tuple count | | ✅ drives pruning cadence |

The rule behind the split: **page on things that will not fix themselves.** A depth spike after a bulk import fixes itself; a fleet that has stopped does not, and neither does a job that has dead-lettered.

## Gotchas

**★ Symptom: the depth graph looks fine and users report hour-old emails.** Cause: depth is a stock, not a flow — a small, stuck backlog and a large, draining one look similar, and a single stalled `kind` disappears inside a global count. Fix: alert on the age of the oldest claimable job **per kind**, which is expressed in the unit users actually experience:

```sql
SELECT kind, extract(epoch FROM now() - min(run_at)) AS oldest_age_s
  FROM jobs WHERE status = 'pending' AND run_at <= now()
 GROUP BY kind;
```

**★ Symptom: the metrics query returns numbers that jump around and disagree with a manual count.** Cause: it was copied from the claim query and inherited `FOR UPDATE SKIP LOCKED`, so it excludes rows other transactions hold — *"skipping locked rows provides an inconsistent view of the data."* Fix: metric queries take no locks. Delete the locking clause; a plain `count(*)` is what you want.

**★ Symptom: the worker fleet was down for six hours and the first signal was a customer.** Cause: only depth was alerted on, and a stopped fleet raises depth slowly and smoothly — indistinguishable from load. Fix: the conjunction alert. `claimable > 0 AND completed_5m = 0` fires in one interval and cannot be produced by a healthy system.

**★ Symptom: queue depth is permanently in the thousands and everyone ignores the graph.** Cause: delayed jobs (`run_at` in the future) are counted as backlog, so the baseline is never zero and the alert threshold was raised until it meant nothing. Fix: separate `claimable` from `scheduled` in every query, and alert only on the first — the `FILTER (WHERE run_at <= now())` in the per-kind query above.

**★ Symptom: you cannot tell whether to add workers or fix the handler.** Cause: only end-to-end latency is recorded, so queue wait and execution time are one number. Fix: add `started_at`, set it in the claim, and graph `started_at - created_at` against `finished_at - started_at`. Rising wait with flat execution is a capacity problem; rising execution is a code or downstream problem, and adding workers to it makes it worse.

**Symptom: ten workers each report a different queue depth.** Cause: a gauge emitted from every worker instead of from one place. Fix: scrape gauges from a single process — a metrics endpoint, the cron drain, or a leader elected with an advisory lock — and let workers emit only counters, which aggregate correctly by construction.

**Symptom: a job id appears five times in the logs and you cannot tell which run succeeded.** Cause: log lines carry the job id but not the attempt number, so redeliveries are indistinguishable. Fix: include `attempt` (and the worker id) in every structured log line for a job.

**Symptom: a slow checkout cannot be connected to the slow job it spawned.** Cause: the correlation id stopped at the transaction boundary. Fix: put the trace id in the job payload at enqueue time and log it from the worker — the queue is an asynchronous boundary and nothing carries context across it unless you do.

**Symptom: dashboards get slower as the queue table grows.** Cause: metric queries scanning millions of `done` rows every scrape interval. Fix: restrict time-window queries to indexed columns with a bound (`finished_at > now() - interval '1 hour'` plus an index on `finished_at`), prune history ([04db](04db-backoff-dead-letters-and-pruning.md)), and consider materialising per-minute rollups if the scrape itself becomes a load source.

**Symptom: `lease_expired` is always non-zero.** Cause: the reaper is not running, or the folded recovery branch was dropped from the claim query during a refactor. Fix: alert on it — it should be zero or transient, and a persistent non-zero value means jobs are only recovered when something else happens to notice them.

## Interview questions

**★ Why is queue depth a poor alerting metric, and what would you use instead?**
Because depth is a stock and the thing you actually care about is a flow. Ten thousand jobs draining fast is a healthy system briefly behind; fifty jobs that have not moved in an hour is an outage — and depth reports the first as ten thousand and the second as fifty, exactly inverting the severity. It also aggregates across kinds, so a single stalled job type vanishes inside a healthy total, and it counts deliberately delayed jobs as backlog, which pushes teams to raise the threshold until the alert means nothing. The age of the oldest claimable job fixes all of that: it is expressed in seconds of user-visible latency, it is near zero whenever you are keeping up regardless of volume, and per kind it maps directly onto a service level you can state in words.

**★ Your worker deployment is accidentally scaled to zero. Which of your alerts fires, and how fast?**
If the only alert is on depth, none of them fire quickly — depth rises smoothly and looks like a busy period, and by the time it crosses a threshold you have hours of backlog. The alert that catches it immediately is a conjunction: there is claimable work *and* nothing has completed in the last few minutes. That combination cannot be produced by a healthy system under any load, so the threshold needs no tuning and there is essentially no false-positive surface. It is the cheapest high-value alert in the whole topic and it is the one most commonly missing, because dashboards are built from the metrics that are easy to collect rather than from the failure modes that actually happen.

**★ Why must a metrics query never use `SKIP LOCKED`?**
Because `SKIP LOCKED` deliberately returns an incomplete result — rows locked by another transaction are silently omitted — and the manual says so directly: *"Skipping locked rows provides an inconsistent view of the data, so this is not suitable for general purpose work."* In a claim that is exactly right, since the question is "what can I take right now". In a metric it produces a number that varies with how busy your workers happen to be at the scrape instant, so it under-reports most severely under load, which is precisely when the number needs to be trustworthy. There is no error and no warning; the graph simply lies in a direction that makes things look better than they are.

**★ Latency is up. How do you decide between adding workers and fixing the handler?**
Split end-to-end latency into queue wait — from `created_at` to `started_at` — and execution time — from `started_at` to `finished_at`. If wait is rising while execution is flat, jobs are arriving faster than the fleet can take them, and adding workers or concurrency is the correct response. If execution is rising, each job has become slower, usually because something downstream has, and adding workers is actively harmful: more concurrency means more pressure on the thing that is already struggling, and you convert a latency problem into an outage. This is why `started_at` is worth adding to the schema even though nothing else uses it — without it the two cases are one number and the diagnosis is a guess.

**What do you page on versus merely graph, and what is the principle?**
Page on things that will not fix themselves and that have a human action attached: the fleet has stopped, the oldest claimable age for a given kind has exceeded its stated service level, a money-moving kind has dead-lettered anything at all, an external call has been unsettled for fifteen minutes, or the outbox relay has stopped publishing. Graph everything else — depth, execution percentiles, the retry-attempt histogram, table size — because they are context for an investigation rather than triggers for one. The principle is that a page must correspond to a decision; a signal that resolves on its own trains people to ignore the channel, and an ignored channel is worse than no channel, because it also carries the alerts that mattered.

**Why does the trace id have to be in the job payload rather than in a header or a context?**
Because the queue is an asynchronous boundary and nothing crosses it implicitly. The request that enqueued the job has ended by the time the job runs; there is no header, no async-local context, no shared process, and often not even the same machine or the same deployment. The only thing that survives is what was written into the row. Putting the trace id in the payload — and logging it from the worker on every line, alongside the job id, kind and attempt number — is what makes it possible to answer "which checkout produced this slow receipt", which is the first question anyone asks and the one that is impossible to answer retroactively if the link was never recorded.

---

← [04h · Cron and scheduled work](04h-cron-and-scheduled-work.md) · Next → [05 · Edge functions and custom cache structures](05-edge-functions-and-custom-cache-structures-for-global-comput.md)
