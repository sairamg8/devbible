---
title: "Scheduled jobs"
sidebar_label: "05 · Scheduled jobs"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Node.js v24 timers docs and PostgreSQL 17
> documentation (advisory locks). Concept home:
> [Node — scheduled and recurring jobs](../../../nodejs/pages/phase-7-background-work/08-scheduled-jobs.md),
> [time on the server](../../../nodejs/pages/phase-7-background-work/10-time-on-the-server.md).

## The problem

Three chores nobody triggers: sweep abandoned carts (3 days idle), prune
processed outbox rows (30 days old), and delete orphaned `.tmp` uploads
(1 day old). Each is trivial; the machinery around them — not overlapping
themselves, not double-running across two worker instances, surviving
restarts, being *observable* — is where scheduled work actually goes wrong.

## The design choices

**In the worker process, not cron/systemd timers.** The jobs need the pool,
the config and the logger the worker already has; an external cron would
re-boot all of it per run and hide the schedule from the codebase. The trade:
if the worker is down, schedules pause — acceptable, because every job here
is *catch-up-able*: it processes a backlog defined by data age, not by tick
count. Missing ticks loses nothing; the next run does more work.

**Anchor to the clock, don't accumulate an interval.** Each job computes its
next run from the clock (`nextRunAt = ceil(now, period)`), so drift doesn't
compound and restarts land back on the grid.

**One advisory lock per job.** Two worker instances must not both sweep.
`pg_try_advisory_lock(jobKey)` — *try*, not wait: the loser skips the tick
entirely, because the winner is already doing the identical work.

**UTC only.** Periods here are relative (age-based), so timezones cannot
bite — and the one future footgun ("run at midnight") is pre-answered: that
midnight would be UTC, or an instant computed by product code, never a local
server clock ([the time rules](../phase-1-database/07-money-and-time.md)).

## The implementation

```js
// worker/schedule.js
import {setTimeout as sleep} from 'node:timers/promises';

export function schedule({pool, signal, jobs}) {
  async function runJob(job) {
    const {rows: [{locked}]} = await pool.query(
      `select pg_try_advisory_lock($1) as locked`, [job.lockKey],
    );
    if (!locked) return;                          // another instance has it
    try {
      const t0 = performance.now();
      const result = await job.run();
      console.log(JSON.stringify({
        msg: 'job done', job: job.name,
        ms: Math.round(performance.now() - t0), ...result,
      }));
    } catch (err) {
      console.error(JSON.stringify({msg: 'job failed', job: job.name,
                                    err: String(err)}));
    } finally {
      await pool.query(`select pg_advisory_unlock($1)`, [job.lockKey]);
    }
  }

  return {
    async run() {
      const next = new Map(jobs.map((j) => [j, Date.now()])); // due immediately
      while (!signal.aborted) {
        for (const job of jobs) {
          if (Date.now() >= next.get(job)) {
            await runJob(job);                    // sequential: no self-overlap
            const now = Date.now();               // anchor AFTER the run
            next.set(job, now + job.periodMs - (now % job.periodMs));
          }
        }
        await sleep(30_000, undefined, {signal}).catch(() => {});
      }
    },
  };
}
```

```js
// worker/jobs.js — the three chores; each returns what it did
export function buildJobs({pool, uploads}) {
  return [
    {name: 'abandoned-carts', lockKey: 801, periodMs: 3_600_000,
      async run() {
        const {rowCount} = await pool.query(
          `delete from carts
            where updated_at < now() - interval '3 days'
              and user_id is null`,               // guests only — account carts persist
        );
        return {swept: rowCount};
      }},
    {name: 'outbox-prune', lockKey: 802, periodMs: 86_400_000,
      async run() {
        const {rowCount} = await pool.query(
          `delete from outbox
            where processed_at < now() - interval '30 days'`,
        );
        return {pruned: rowCount};
      }},
    {name: 'tmp-sweep', lockKey: 803, periodMs: 86_400_000,
      async run() {
        return {removed: await uploads.sweepTmp(86_400_000)}; // ch. 03's helper
      }},
  ];
}
```

## What to notice

- **Jobs report facts.** `{swept: 12}` in a structured log line is the whole
  observability story for a chore — chapter 09's metrics add the last-run
  timestamp per job, and "job hasn't run in 2× its period" is the alert.
- **`try` lock + skip beats waiting.** Waiting serializes instances into
  running the sweep twice back-to-back (winner finishes, loser runs
  immediately after) — pure waste. Skipping is correct *because* jobs are
  restatements of desired state, not increments.
- **Sequential execution within the loop** is a feature: a slow sweep delays
  the outbox-prune by seconds and prevents the worker from stacking its own
  jobs. Parallelism across *instances* exists (locks arbitrate); parallelism
  within one loop would only add failure modes.
- **The delete conditions restate the business rule** — guests only, 3 days,
  by `updated_at` (maintained by [the trigger](../phase-1-database/11-soft-delete-and-audit.md)).
  A job is the one place a rule runs unattended, so the rule must be
  readable at the query.

## Gotchas

- **Symptom:** the abandoned-cart sweep deleted a logged-in user's cart.
  **Cause:** the `user_id is null` guard was lost in a refactor — the spec
  says *account* carts persist indefinitely. **Fix:** the guard is also a
  test (Phase 3's suite): seed an old account cart, run the job, assert it
  survives.
- **Symptom:** on a two-instance worker deploy, jobs run zero times for a
  while. **Cause:** instance A crashed *while holding* a lock and its
  connection lingers (TCP not yet dead) — B skips every tick. **Fix:**
  session-scoped locks free when the connection actually drops;
  `tcp_keepalives_idle` on the pool shortens the linger. The skipped ticks
  cost nothing — the next successful run catches up, which is why jobs are
  written age-based.
- **Symptom:** `tmp-sweep` removed a file an in-flight upload was about to
  rename. **Cause:** the age threshold was tightened below the longest
  plausible upload duration. **Fix:** the 1-day threshold is deliberately
  huge compared to any upload; treat it as a floor, not a tunable.

## Interview questions

1. **★ Why is "the job processes a backlog, not a tick" the property that
   makes this design safe?** Because every failure mode — missed ticks,
   skipped locks, worker downtime — then costs only latency. `delete where
   older than 3 days` run at hour 5 does exactly what runs at hour 1 would
   have, plus the difference. Tick-counting designs (send a digest per run)
   need exactly-once ticks, which this machinery deliberately does not
   promise.
2. **★ Why `pg_try_advisory_lock` here but `pg_advisory_lock` (waiting) in
   the migration runner?** Migrations must *eventually run exactly once
   each* — the second deployer waits because it may hold different, newer
   files. A sweep is identical work in every hand: if someone else is doing
   it, the correct contribution is nothing. Wait when the work differs by
   holder; skip when it doesn't.
3. **Why anchor `next` to the clock grid instead of `now + period`?** With
   `now + period`, each run's duration pushes every subsequent run later —
   restarts and slow runs compound into schedule drift. Anchoring to the
   grid (`now + period - now % period`) makes the schedule stateless: any
   instance, restarted at any time, converges on the same slots.
4. **When do these jobs outgrow this scheduler?** When a chore stops being
   catch-up-able (a per-customer digest email — needs a ledger of who got
   it), needs sub-minute precision, or needs to run where the worker isn't.
   The first gets an outbox-style table of owed sends; the others get real
   schedulers. The point of naming the property is knowing the moment it no
   longer holds.

---

← Prev: [The outbox relay and email worker](04-outbox-relay-and-email.md) ·
Next → [The webhook dispatcher](06-the-webhook-dispatcher.md)
