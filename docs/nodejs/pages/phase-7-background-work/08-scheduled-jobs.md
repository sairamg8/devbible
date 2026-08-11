---
title: "Scheduled and recurring jobs — drift, overlap and timezones"
sidebar_label: "08 · Scheduled and recurring jobs"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** — `pg` 8.23.0 against PostgreSQL 17.10.

**`setInterval` is not a scheduler.** It drifts, it overlaps with itself, it runs once
per process rather than once per cluster, and it forgets everything on restart. Each of
those is a separate bug, and each has a separate fix.

## Drift

`setInterval(fn, 100)` does not fire every 100 ms. It fires 100 ms after the previous
*callback finished*, so the job's own duration accumulates:

```console
setInterval(100) with a 30 ms job -> 130, 230, 331, 432, 533, 634, 734, 835
8 ticks should end at 800 ms; ended at 835 ms — drift 35 ms
```

35 ms over eight ticks is nothing. At "every minute" with a 4-second job, it is four
minutes of drift a day, and your hourly job slowly walks off the hour. A job that
matters at a specific wall-clock time must be scheduled **against the clock**, not
against the last run:

```js
const msUntilNext = (intervalMs) => intervalMs - (Date.now() % intervalMs);
const tick = async () => {
  setTimeout(tick, msUntilNext(60_000));   // re-anchor on the clock every time
  await runTheJob();
};
setTimeout(tick, msUntilNext(60_000));
```

Note the `setTimeout` before the `await` — schedule the next run *first*, so a slow or
throwing job cannot stop the schedule.

## Overlap

If the job takes longer than the interval, `setInterval` starts the next one anyway:

```console
setInterval(100) + a 250 ms job -> 9 runs, up to 3 at once   <- overlap
with an overlap guard           -> 3 runs, max 1 at once, 6 ticks skipped
```

**Three copies of a "nightly report" running simultaneously**, each reading the same
rows. The guard is trivial in one process:

```js
let running = false;
setInterval(async () => {
  if (running) return;                 // skip this tick
  running = true;
  try { await runTheJob(); } finally { running = false; }
}, 100);
```

Skipping is usually right for periodic work — the next tick will pick up whatever is
outstanding. Queueing the missed ticks is right only when each run must happen.

## More than one instance

The in-memory guard is worthless across processes. Three API instances each with a
"every hour" timer produce three runs an hour, and none of them knows about the others.

Take a lock in shared state. With PostgreSQL, an advisory lock is one query:

```js
const client = await pool.connect();         // must be a checked-out client, not pool.query
try {
  const {rows} = await client.query(
    "select pg_try_advisory_lock(hashtext('nightly-report')) as got");
  if (!rows[0].got) return;                  // another instance has it
  await runTheJob();
} finally {
  await client.query("select pg_advisory_unlock(hashtext('nightly-report'))");
  client.release();
}
```

```console
A pid 74 | B pid 75
instance A got the lock: true
instance B got the lock: false      <- only one instance runs the nightly job
after A unlocks, B gets it: true
```

**The `client` matters.** The first version of this test used `pool.query` for both
"instances" and both reported `true` — advisory locks are session-scoped and reentrant,
and the pool had handed back the same connection. Same trap as
[Phase 6, page 06](../phase-6-data-access/06-transactions.md): anything session-scoped
needs `pool.connect()`.

The better answer is usually to **not schedule in the application at all**. Let the
queue own it — BullMQ's repeatable jobs are stored in Redis, so N workers produce one
scheduled job, and it survives restarts:

```js
await queue.upsertJobScheduler('nightly-report', {pattern: '0 2 * * *', tz: 'Asia/Kolkata'},
  {name: 'report', data: {}});
```

Or let the platform own it: a Kubernetes `CronJob`, a systemd timer, a platform
scheduler. Those give you one run, logs, alerting on failure, and no scheduling code.

## Timezones

`0 2 * * *` means 2 a.m. *somewhere*. Three separate decisions hide in that:

**Which zone the schedule is in.** A server in UTC running "2 a.m." for an
IST business runs at 7:30 a.m. local. Set the zone explicitly on the schedule; never
rely on the container's `TZ`.

**Whether DST should move it.** "Every day at 2 a.m. New York" skips a day in March
and runs twice in November. "Every 24 hours" does neither but drifts against the wall
clock. Pick deliberately: billing periods usually want wall-clock; rate-limited batch
jobs usually want fixed intervals.

**What the job's date range means.** "Yesterday's orders" is a different set of rows
for every user's timezone — the whole of [page 10](./10-time-on-the-server.md).

## What a scheduled job must handle

**Missed runs.** The scheduler was down at 2 a.m.; nothing fires at 2:05. Scheduled
jobs should be written to catch up — "process everything unprocessed", not "process
today". Then a missed run is self-healing.

**Being late.** A run that starts at 2:47 must produce the same result as one starting
at 2:00. Derive the window from data (`where processed_at is null`), not from `now()`.

**Running twice.** Same rule as everywhere else: idempotent
([page 05](./05-job-idempotency.md)).

**Taking too long.** A daily job that takes 25 hours is now permanently overlapping.
Alert on duration, not only on failure.

## Gotchas

**Symptom:** An hourly job slowly moves off the hour
**Cause:** `setInterval` drift — the job's own duration accumulates.
**Fix:** Re-anchor on the clock each tick, or use a real scheduler.

**Symptom:** Several copies of the nightly report run at once
**Cause:** Interval shorter than the job, or several instances.
**Fix:** An overlap guard in-process, plus a lock in shared state across processes.

**Symptom:** The job runs N times an hour with N instances
**Cause:** Application-level timers, per instance.
**Fix:** Queue-owned repeatable jobs or a platform scheduler.

**Symptom:** Two instances both took the "lock"
**Cause:** `pg_try_advisory_lock` via `pool.query` — session-scoped and reentrant on a
reused connection.
**Fix:** Take it on a checked-out `client` and hold it for the run.

**Symptom:** The job runs at the wrong hour after a clock change
**Cause:** DST, or an implicit container timezone.
**Fix:** Set the zone explicitly on the schedule; decide whether DST should move it.

**Symptom:** A missed run leaves data unprocessed forever
**Cause:** The job processes "today" rather than "everything outstanding".
**Fix:** Derive the work set from state, not from the clock.

**Symptom:** Scheduled jobs vanish on deploy
**Cause:** Timers in application memory.
**Fix:** Persist the schedule in the queue or the platform.

## Interview questions

**★ Why is `setInterval` not good enough for scheduled work?**
Four separate problems: it drifts because the delay is measured from the end of the
last run (measured 35 ms over eight ticks with a 30 ms job); it overlaps with itself if
the job outlasts the interval (measured up to 3 concurrent runs); it runs once per
process, so N instances means N runs; and it does not survive a restart.

**★ How do you stop a recurring job running on every instance?**
A lock in shared state — `pg_try_advisory_lock` on a checked-out connection, or a Redis
lock with a TTL — or better, let the queue own the schedule so N workers produce one
job. Verified: with two real sessions, the first got the lock and the second did not.

**★ What happens to a daily job at a DST boundary?**
A wall-clock schedule ("2 a.m. New York") skips the day the clock jumps forward and
runs twice when it falls back. A fixed-interval schedule ("every 24 hours") does
neither but drifts against the wall clock. Choose per job: billing wants wall-clock,
throughput-limited batches want fixed intervals.

**★ How should a scheduled job handle having been missed?**
By deriving its work from state rather than from the clock — `where processed_at is
null` instead of `where created_at::date = today`. Then a late or skipped run is
self-healing, and running twice is harmless.

**Where should the schedule live?**
Outside application memory: in the queue as a repeatable job, or in the platform as a
cron/timer. Both survive restarts, produce one run across N instances, and give you
logs and failure alerts without scheduling code.

**Why schedule the next tick before running the job?**
So a slow run does not compound the delay and a throwing run does not stop the
schedule entirely.

---

← Prev: [Dead-letter queues](./07-dead-letter-queues.md) · Next → [Outbound side-effects as jobs](./09-outbound-side-effects.md)
