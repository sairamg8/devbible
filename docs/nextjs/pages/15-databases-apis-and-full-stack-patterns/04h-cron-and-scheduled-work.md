---
title: "A cron that hits a Route Handler is a public URL that runs your batch job, so the first three lines of that handler are authentication — and the second thing to accept is that cron delivery is best-effort, which makes 'reconcile outstanding work' the only safe shape for the code behind it"
sidebar_label: "04h · Cron and scheduled work"
sidebar_position: 53
description: "CRON_SECRET and the Bearer comparison, why the handler must stay dynamic, missed and duplicated ticks, overlapping runs and advisory locks, and why cron should enqueue jobs rather than do work."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against
> [Vercel · Managing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs) and
> [Vercel · Cron jobs quickstart](https://vercel.com/docs/cron-jobs/quickstart) (fetched
> 2026-09-05), the Next.js
> [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) guide, and
> the PostgreSQL 18 [`SELECT`](https://www.postgresql.org/docs/18/sql-select.html) manual.
> Documentation-verified, **no sandbox run**.
> Target: **Next.js 16.3.4** · PostgreSQL 18.4 · Node 24.20.0.

**Cron on a serverless platform is not a scheduler running inside your application; it is a timer somewhere else that makes an HTTP request to a URL you deployed. Everything surprising about it follows from that one fact. The URL is public, so it needs authentication. The request can be lost in transit, so a tick can be silently skipped. The request can be sent twice, so a tick can silently repeat. It has no retry, so a failure is simply gone. And a slow run can overlap the next one, so two copies of your batch job can be live at once. None of those are defects to work around — they are the delivery model, and the code behind the URL has to be written for it.**

## The configuration is a URL and a schedule

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/jobs/drain", "schedule": "*/1 * * * *" },
    { "path": "/api/cron/nightly-reconcile", "schedule": "0 5 * * *" }
  ]
}
```

> *"The `crons` property is an array of cron jobs. Each cron job has two properties: The `path`, which must start with `/`… The `schedule` property, which must be a string that represents a cron expression."*
> — [Vercel · Cron jobs quickstart](https://vercel.com/docs/cron-jobs/quickstart)

> *"When you deploy your project, Vercel's build process creates the cron job. Vercel invokes cron jobs only for production deployments and not for preview deployments."*

Note what is *not* in that JSON: any notion of who is allowed to call `/api/jobs/drain`. The path is a route in your application, reachable by anyone who guesses it.

## 🔴 The handler is public, so authenticate it

> *"It is possible to secure your cron job invocations by adding an environment variable called `CRON_SECRET` to your Vercel project. We recommend using a random string of at least 16 characters for the value of `CRON_SECRET`."*
> *"The value of the variable will be automatically sent as an `Authorization` header when Vercel invokes your cron job. Your endpoint can then compare both values, the authorization header and the environment variable, to verify the authenticity of the request."*
> *"The `authorization` header will have the `Bearer` prefix for the value."*
> — [Vercel · Managing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)

Their handler, verbatim:

```ts
export function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  return Response.json({ success: true });
}
```

Three details that are doing real work in those five lines:

- **`!cronSecret` is checked first.** If the environment variable is missing — a new preview environment, a rotated secret not yet propagated — the comparison against `` `Bearer undefined` `` would otherwise be a live target. Missing config must fail closed.
- **The comparison happens before anything else.** No database connection, no work, no logging of the payload.
- **Reading `request.headers` opts the route out of prerendering.** Next.js lists exactly this: *"Prerendering stops if the `GET` handler accesses network requests, database queries, async file system operations, request object properties (like `req.url`, `request.headers`, `request.cookies`, `request.body`), runtime APIs like `cookies()`, `headers()`, `connection()`, or non-deterministic operations."* A cron handler that somehow got prerendered would return a build-time response and never run your job.

A stronger comparison, for a secret compared on every tick:

```ts
import { timingSafeEqual } from 'node:crypto'

function authorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(header)
  // timingSafeEqual throws on length mismatch, so guard it first.
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
```

⚠️ Vercel's own example uses `!==`, and I am not claiming their version is exploitable — length is already leaked by the guard and the attack is impractical over a network. Use the constant-time form because it costs one function and removes the argument.

## Best-effort delivery: missed ticks and duplicate ticks

This is the section people skip and then debug for a week.

> *"Cron job delivery is best effort. Most invocations run as scheduled, but occasional transient network errors can prevent a request from reaching your function. In those cases, your function does not execute, and no runtime log is created for that scheduled run."*
> *"Cron delivery can also occasionally invoke the same scheduled run more than once. Because of this, cron jobs should be resilient to both missed runs and duplicate runs."*
> — [Vercel · Managing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)

And there is no safety net:

> 🔴 *"Vercel will not retry an invocation if a cron job fails."*

So a cron tick has all three of: it may not happen, it may happen twice, and if it errors nobody tries again. The design that survives all three is stated by the same page:

> *"Design your operations to be **idempotent** and reconciliation-based so each run can safely reprocess outstanding work since the last successful run. For example: Good: "Set user status to active" (running twice has the same effect). Bad: "Increment user credit by 10" (running twice doubles the credit)."*
> *"Use both locks (to prevent concurrent runs) and idempotent reconciliation (to handle duplicate or missed runs safely) for the most reliable cron jobs."*

**Reconciliation-based** is the load-bearing word. A cron that asks *"what outstanding work exists right now?"* self-heals from a missed tick, because the next tick sees the same outstanding work plus a bit more. A cron that asks *"what happened in the last five minutes?"* does not: the window that was missed is gone forever.

```sql
-- ✅ Reconciling: a missed tick is repaired by the next one.
SELECT id FROM invoices WHERE status = 'pending' AND due_at < now();

-- ❌ Windowed: a missed tick silently drops everything in that window.
SELECT id FROM invoices WHERE due_at BETWEEN now() - interval '5 minutes' AND now();
```

## 🔴 The best cron handler does no work

The most useful single piece of advice on this page: **cron should enqueue jobs, and the worker should do the work.**

```ts
// app/api/cron/nightly-reconcile/route.ts
export async function GET(request: NextRequest) {
  if (!authorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const client = await pool.connect()
  try {
    // One statement: find outstanding work, create a job per unit.
    // ON CONFLICT DO NOTHING against the partial unique index from 04e
    // makes a duplicate tick a no-op.
    const { rowCount } = await client.query(`
      INSERT INTO jobs (kind, payload)
      SELECT 'invoice.remind', jsonb_build_object('entityId', i.id)
        FROM invoices i
       WHERE i.status = 'pending' AND i.due_at < now()
      ON CONFLICT DO NOTHING`)
    return Response.json({ enqueued: rowCount })
  } finally {
    client.release()
  }
}
```

Look at what that buys, against a handler that sends the reminders itself:

| | Cron does the work | Cron enqueues jobs |
|---|---|---|
| A tick is missed | That night's reminders never sent | Next tick finds the same outstanding rows |
| A tick is duplicated | Everything sent twice | `ON CONFLICT DO NOTHING` — a no-op |
| One reminder fails | No retry; whole run may abort | The job retries with backoff ([04db](04db-backoff-dead-letters-and-pruning.md)) |
| Work exceeds `maxDuration` | Invocation killed mid-run, partially applied | Enqueue is one statement; the worker paces itself |
| "Did it run?" | Read logs, if any exist | `SELECT` the jobs table |

The cron invocation becomes short, bounded and idempotent — three properties it needs anyway — and everything that is genuinely hard is delegated to the queue, which was built for it.

## Overlapping runs

> *"If your cron job runs longer than the interval between invocations, Vercel can trigger a second instance while the first is still running. This can lead to race conditions, duplicate processing, or data corruption."*
> *"To prevent concurrent runs, use a lock mechanism like Redis distributed locks in your cron job."*

If your handler only enqueues, overlap is harmless — the second run's `INSERT … ON CONFLICT DO NOTHING` finds the rows already queued. If it genuinely must be single-instance, use a PostgreSQL advisory lock, and be careful about *which* one.

```ts
// Session-level lock: held for the whole handler, on ONE dedicated client.
const LOCK_KEY = 918_273_645   // any stable bigint; keep a registry of them

export async function GET(request: NextRequest) {
  if (!authorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const client = await pool.connect()
  try {
    const { rows } = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS locked', [LOCK_KEY],
    )
    if (!rows[0].locked) {
      // Another run holds it. This is a SUCCESS, not an error.
      return Response.json({ skipped: 'already running' }, { status: 200 })
    }
    try {
      await reconcile(client)
      return Response.json({ ok: true })
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY])
    }
  } finally {
    client.release()   // ⟵ only AFTER the unlock
  }
}
```

🔴 **Two hazards, both about pooling.** A session-level advisory lock lives on the *connection*, so it must be taken and released on the same checked-out client, and released before that client goes back to the pool — otherwise the next user of that connection inherits a lock nobody will unlock. And under a transaction-mode pooler, session-level locks are not usable at all, because the server connection you get back is not the one you locked on. See [01c · Transaction pooling and session state](01c-transaction-pooling-and-session-state.md) and [PostgreSQL · advisory locks](../../../postgresql/pages/phase-11-mvcc/15-advisory-locks.md).

The transaction-scoped variant `pg_advisory_xact_lock` releases automatically at `COMMIT` and is therefore much safer — but it only covers the transaction, so it is right when the whole critical section is one transaction and wrong when the handler spends minutes calling APIs.

## Everything else the platform will do to you

| Behaviour | Verbatim | What it means for you |
|---|---|---|
| Missing route still runs | *"If you create a cron job for a path that doesn't exist, it generates a 404 error. However, **Vercel still executes your cron job**."* | A renamed route is a silently dead cron |
| Redirects swallow the run | *"Cron jobs do not follow redirects. When a cron-triggered endpoint returns a 3xx redirect status code, the job completes without further requests."* | 🔴 A proxy rule, trailing-slash rule or auth redirect makes your cron a no-op |
| Invisible in logs | *"when cron jobs respond with a redirect or a cached response, they will not be shown in the logs."* | The above failure produces **no evidence at all** |
| Schedule in a header | *"Every cron job request includes the `x-vercel-cron-schedule` header, which contains the cron expression that triggered the invocation."* | Useful for logging which schedule fired |
| No local dev | *"There is currently no support for `vercel dev`, `next dev`, or other framework-native local development servers."* | Test by calling the route with the header yourself |
| Rollback does not revert crons | *"If you Instant Rollback to a previous deployment, active cron jobs **will not** be updated."* | A rollback does not undo a bad schedule |
| Deploys do not interrupt | *"Creating a new deployment will not interrupt your running cron jobs; they will continue until they finish."* | An old run can outlive the deployment that started it |
| Split long jobs | *"if you need more processing time, it's recommended to split your cron jobs into different units or distribute your workload by combining cron jobs with regular HTTP requests with your API."* | Which is exactly the enqueue-don't-work pattern |

The redirect row deserves emphasis. A middleware or proxy rule added months later for an unrelated reason — locale prefixes, canonical host, trailing slashes, an auth guard that redirects unauthenticated requests to `/login` — will turn every cron tick into a `3xx` that completes immediately, produces no log line, and looks exactly like nothing happening. Exclude your cron paths from proxy rules explicitly, and assert on it.

## Gotchas

**★ Symptom: a stranger triggered your nightly billing run.** Cause: the cron path is an ordinary public route and the handler had no auth, because "only the scheduler calls it". Fix: compare the `Authorization` header against `CRON_SECRET` before anything else, and fail closed when the secret is absent:

```ts
if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
  return new Response('Unauthorized', { status: 401 })
}
```

**★ Symptom: the cron stopped running after an unrelated proxy change, with no errors and no logs.** Cause: the route now returns a redirect, and *"cron jobs do not follow redirects"* — plus *"when cron jobs respond with a redirect or a cached response, they will not be shown in the logs."* Fix: exclude cron paths from redirect rules, and add an end-to-end assertion that does not depend on logs — a `last_run_at` row the handler writes and an alert on its age.

**★ Symptom: a night of reminders was silently skipped.** Cause: the tick was lost — *"occasional transient network errors can prevent a request from reaching your function. In those cases, your function does not execute, and no runtime log is created"* — and the handler queried a five-minute window, so the missed window is gone. Fix: make the query reconciliation-shaped, selecting all outstanding work rather than a time slice, so the next tick repairs the gap.

**★ Symptom: the cron ran twice and everyone got two emails.** Cause: duplicate delivery, which the platform documents as possible, met a handler that sends directly. Fix: have cron enqueue jobs with a dedupe key, so a second tick is a no-op — the `INSERT … SELECT … ON CONFLICT DO NOTHING` above, against the partial unique index from [04e](04e-at-least-once-and-idempotency.md).

**★ Symptom: a cron job failed and nobody retried it.** Cause: *"Vercel will not retry an invocation if a cron job fails."* Fix: the handler must not be the thing that can fail meaningfully. Enqueue the work, and let the queue's retry policy handle failure — that is the whole reason the queue has one.

**★ Symptom: after a cron run, a random later request hangs on a lock.** Cause: `pg_try_advisory_lock` was taken on a pooled client that was released without unlocking, so the lock travelled back into the pool on that connection. Fix: unlock in a `finally` *inside* the client's lifetime, release the client outside it — exactly the nesting in the handler above — and prefer `pg_advisory_xact_lock` whenever the critical section is a single transaction.

**Symptom: cron works in production and cannot be tested at all locally.** Cause: *"There is currently no support for `vercel dev`, `next dev`, or other framework-native local development servers."* Fix: treat the handler as an ordinary authenticated route and call it yourself with the header, so the code path is exercised in tests and locally; the only untestable part is the platform's timer.

**Symptom: a bad schedule was shipped, the deployment was rolled back, and it kept firing.** Cause: *"If you Instant Rollback to a previous deployment, active cron jobs will not be updated."* Fix: fix schedules with a forward deployment, never a rollback, and keep the cron configuration reviewable — it is a small JSON file that changes rarely and breaks loudly.

**Symptom: the drain cron overlaps itself and connection usage doubles.** Cause: the run takes longer than the interval, and *"Vercel can trigger a second instance while the first is still running."* Fix: bound the run by the invocation deadline ([04f](04f-waking-the-worker.md)) so it cannot exceed the interval by much, and rely on `SKIP LOCKED` to make the overlap harmless rather than trying to prevent it.

## Interview questions

**★ Why does a cron-triggered Route Handler need authentication when a cron job in a monolith does not?**
Because it is not a scheduler inside your application; it is a timer outside it making an HTTP request to a route you deployed. That route is part of your public surface, reachable by anyone who guesses or discovers the path, with no session and no user to check. A monolithic `cron` entry invokes a function in-process with no network hop and therefore no attacker-reachable entry point. The standard defence is a shared secret the platform sends as an `Authorization: Bearer …` header, compared against an environment variable before the handler does anything else — and it must fail closed when the variable is missing, because a comparison against `Bearer undefined` is a live target on any environment where the secret was not set.

**★ What does "cron delivery is best effort" actually oblige you to build?**
Three things, matching three documented behaviours. Ticks can be missed, so the handler must be *reconciliation-based* — it asks what outstanding work exists now, rather than what happened in the last window, so the next tick repairs the gap automatically. Ticks can be duplicated, so the handler must be *idempotent* — setting a value rather than incrementing one, or enqueueing with a dedupe key so a second run is a no-op. And a failed invocation is not retried, so the handler must not be where meaningful failure can occur — which points at the same conclusion: the cron should enqueue jobs and let the queue, which does have retries, do the work.

**★ Why is "cron enqueues, worker executes" better than "cron does the work"?**
Because it moves every hard property into a system that already has it. The queue has retries, so a failed unit does not depend on a tick that will never come again. The queue has a dead-letter path, so a permanently broken unit is visible instead of failing silently every night. The queue paces itself, so the work is not bounded by one invocation's `maxDuration` — which is the constraint that pushes people into ever-larger cron timeouts. And the cron handler shrinks to a single idempotent statement, which makes duplicate and overlapping ticks harmless instead of dangerous. It also makes "did it run" answerable with a `SELECT` instead of a log search, which matters most at the moment logs are least helpful.

**★ You need to guarantee only one instance of a nightly job runs. How, and what is the trap?**
A PostgreSQL advisory lock is the natural fit, since the database is already there and the lock is cheap: take `pg_try_advisory_lock` at the top and return a success response if you do not get it, because "another run has it" is a normal outcome and not an error. The trap is pooling. A session-level advisory lock belongs to the connection, so it must be released on the same checked-out client and *before* that client returns to the pool — otherwise the lock rides back into the pool and the next unrelated query on that connection inherits it, producing a hang in code that has nothing to do with cron. Under a transaction-mode pooler, session-level locks are not usable at all. Where the critical section is a single transaction, `pg_advisory_xact_lock` avoids the whole problem by releasing at `COMMIT`.

**★ Your cron silently stopped working after a proxy change. What happened, and how would you have caught it?**
Almost certainly a redirect. Cron jobs do not follow redirects — a `3xx` response completes the job with no further request — and, worse, *"when cron jobs respond with a redirect or a cached response, they will not be shown in the logs"*, so the failure produces no evidence at all. A locale prefix rule, a canonical-host rule, a trailing-slash normalisation or an auth guard that bounces unauthenticated requests to `/login` will all do it. You catch it by not trusting logs for liveness: have the handler write a `last_run_at` row and alert when its age exceeds a couple of intervals. That check is positive evidence of execution, which is the only kind that survives a failure mode whose signature is silence.

**What is the difference between a cron job and a delayed job, and when do you need each?**
A cron job is a wall-clock schedule that fires regardless of what is in your system — "every night at 05:00" — and it is the right tool for reconciliation sweeps, reports and cleanup, where the trigger is time itself. A delayed job is a single unit of work with a `run_at` in the future, created by something that happened — "remind this user in 24 hours if they have not verified their email" — and it belongs in the queue, with `run_at` as an ordinary column. Using cron for the second gives you an unnecessary scan of the whole table every interval and a latency floor equal to the interval; using a delayed job for the first gives you nothing to enqueue from, since no event occurred. When in doubt, ask whether the work is *about* a specific entity: if it is, it is a delayed job.

---

← [04g · Broker, database, or hosted queue](04g-broker-database-or-hosted-queue.md) · Next → [04i · Knowing the queue is behind](04i-queue-observability.md)
