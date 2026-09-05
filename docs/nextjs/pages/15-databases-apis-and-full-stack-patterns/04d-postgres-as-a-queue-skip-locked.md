---
title: "SELECT … FOR UPDATE SKIP LOCKED is the single feature that turns an ordinary table into a queue, because it is the only way two workers can ask for 'the next job' at the same moment and get different answers instead of one of them waiting"
sidebar_label: "04d · Postgres as a queue · SKIP LOCKED"
sidebar_position: 232
description: "The table, the enqueue, the claim query, why SKIP LOCKED makes concurrent workers safe, what happens without it, the CTE locking trap, the OFFSET trap, and the claim written in TypeScript against a real pool."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 manual —
> [`SELECT`, The Locking Clause](https://www.postgresql.org/docs/18/sql-select.html) — and
> the [node-postgres pooling documentation](https://node-postgres.com/features/pooling).
> Every locking rule below is quoted verbatim from the manual.
> Documentation-verified, **no sandbox run, no timings, no query plans**.
> Target: **PostgreSQL 18.4** · `pg` 8.23.0 · Node 24.20.0 · Next.js 16.3.4.

**A queue is a table where many readers compete for the same few rows, and ordinary row locking is exactly wrong for that: `FOR UPDATE` makes the losers *wait* for the winner, which turns N workers into one worker with extra latency. `SKIP LOCKED` inverts the behaviour — a row that cannot be locked immediately is simply not returned — so every worker's "give me the next job" returns a different job, atomically, with no coordination and no external broker. That one clause is the whole pattern. This page builds the table, the enqueue and the claim query around it, and then shows the three ways the claim query is quietly got wrong: putting the locking clause outside the CTE, using `OFFSET`, and checking out a pool client without an unconditional `release()`. What happens *after* the claim — leases, heartbeats, retries and dead letters — is [04da](04da-leases-and-the-claim-lifetime.md).**

## The clause, verbatim

This is the paragraph the entire pattern rests on. It is worth reading in full rather than in summary, because it contains its own warning:

> *"To prevent the operation from waiting for other transactions to commit, use either the NOWAIT or SKIP LOCKED option. With NOWAIT, the statement reports an error, rather than waiting, if a selected row cannot be locked immediately. With SKIP LOCKED, any selected rows that cannot be immediately locked are skipped. Skipping locked rows provides an inconsistent view of the data, so this is not suitable for general purpose work, but can be used to avoid lock contention with multiple consumers accessing a queue-like table. Note that NOWAIT and SKIP LOCKED apply only to the row-level lock(s) — the required ROW SHARE table-level lock is still taken in the ordinary way."*
> — [PostgreSQL 18 · `SELECT`](https://www.postgresql.org/docs/18/sql-select.html)

Three things to take from it:

1. **"can be used to avoid lock contention with multiple consumers accessing a queue-like table"** — this is not a clever repurposing. PostgreSQL's own manual names the queue use case.
2. **"provides an inconsistent view of the data, so this is not suitable for general purpose work"** — a `SKIP LOCKED` query is not a report. It answers "what can I have right now", not "what exists". Never use it to count anything.
3. **"the required ROW SHARE table-level lock is still taken in the ordinary way"** — `SKIP LOCKED` does not make you immune to table-level locks. A migration taking `ACCESS EXCLUSIVE` on `jobs` still stops every worker dead.

The full syntax, from the same page:

```text
FOR { UPDATE | NO KEY UPDATE | SHARE | KEY SHARE } [ OF from_reference [, ...] ] [ NOWAIT | SKIP LOCKED ]
```

## What happens without it

Two workers, each running `SELECT id FROM jobs WHERE status = 'pending' ORDER BY run_at LIMIT 1 FOR UPDATE`.

- Worker A locks job 1 and begins a five-second HTTP call.
- Worker B's query selects the same row — nothing has changed its `status` yet, because A has not committed — and, per the manual, **waits for A's transaction to commit** rather than moving on.
- Five seconds later A commits. B's statement re-evaluates the row, finds `status = 'running'`, and returns nothing. B has burned five seconds and comes back to try again.

Scale that: **every worker serialises behind the single oldest claimable row.** Adding workers adds lock waiters, not throughput, and each waiter is holding a database connection while it waits — so the pool drains at the same time. The system gets slower as you scale it, which is the most confusing possible failure signature and the reason this page exists.

`NOWAIT` is not the fix either. It *errors* instead of waiting, so with N workers you get N−1 errors per claim attempt and a retry storm in your logs. `SKIP LOCKED` is the only option whose failure mode is "returns fewer rows", which is exactly what a worker can handle: fewer rows means sleep and ask again.

## The table

```sql
CREATE TYPE job_status AS ENUM ('pending', 'running', 'done', 'dead');

CREATE TABLE jobs (
  id            bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind          text        NOT NULL,
  payload       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  status        job_status  NOT NULL DEFAULT 'pending',
  -- Earliest time this job may be claimed. Delays and retry backoff both write here.
  run_at        timestamptz NOT NULL DEFAULT now(),
  -- The lease. Set at claim time; a claim whose lease has expired is reclaimable.
  locked_until  timestamptz,
  locked_by     text,
  attempts      int         NOT NULL DEFAULT 0,
  max_attempts  int         NOT NULL DEFAULT 5,
  last_error    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz
);

-- The hot-path index. PARTIAL, so it only ever contains claimable work:
-- a table with ten million finished jobs still has a tiny index here.
CREATE INDEX jobs_claimable
  ON jobs (run_at, id)
  WHERE status = 'pending';

-- The recovery index, used by the lease reaper in 04da. Kept separate so the
-- hot claim path stays on one narrow index.
CREATE INDEX jobs_expired
  ON jobs (locked_until)
  WHERE status = 'running';
```

🔴 **The partial indexes are not an optimisation, they are the design.** A queue table's row count is dominated by history, while the working set is the handful of `pending` rows. A plain `CREATE INDEX jobs (run_at)` grows forever and every claim pays for the history. The `WHERE status = 'pending'` predicate means the index shrinks back to near-nothing whenever the queue drains.

⚠️ For a partial index to be used, the query's `WHERE` clause must *imply* the index predicate. `WHERE status = 'pending'` does; `WHERE status IN ('pending','running')` does not. That constraint shapes the claim query below, and it is the reason lease recovery is a separate statement in [04da](04da-leases-and-the-claim-lifetime.md) rather than an extra `OR` bolted onto the claim.

## The enqueue

The enqueue is one `INSERT`, and the only rule that matters is where it happens — inside the transaction that made the job necessary. That argument is [04c](04c-the-anatomy-of-a-job.md); here is the statement itself.

```ts
// lib/jobs/enqueue.ts
import type { PoolClient } from 'pg'

export type JobKind = 'order.paid' | 'post.published' | 'thumbnail.render'

export async function enqueue(
  client: PoolClient,
  kind: JobKind,
  payload: unknown,
  options: { delaySeconds?: number; maxAttempts?: number } = {},
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO jobs (kind, payload, run_at, max_attempts)
     VALUES ($1, $2::jsonb, now() + make_interval(secs => $3), $4)
     RETURNING id`,
    [kind, JSON.stringify(payload), options.delaySeconds ?? 0, options.maxAttempts ?? 5],
  )
  return rows[0].id
}
```

`make_interval(secs => …)` rather than string concatenation into an `interval` literal: the delay is user-influenced data in some designs, and `'now() + ' || $3 || ' seconds'` is a SQL injection waiting to be discovered.

Note that `id` comes back as a **string**, not a number — `pg` returns `bigint` as text by default so that values above `Number.MAX_SAFE_INTEGER` are not silently mangled. Type it as `string` and stop fighting it.

## The claim query

```sql
WITH claimed AS (
  SELECT id
    FROM jobs
   WHERE status = 'pending'
     AND run_at <= now()
   ORDER BY run_at, id
   LIMIT $1
   FOR UPDATE SKIP LOCKED          -- 🔴 inside the CTE, not on the outer query
)
UPDATE jobs j
   SET status       = 'running',
       locked_until = now() + make_interval(secs => $2),
       locked_by    = $3,
       attempts     = j.attempts + 1
  FROM claimed c
 WHERE j.id = c.id
RETURNING j.id, j.kind, j.payload, j.attempts, j.max_attempts;
```

Read it as three moves:

1. **The CTE selects and locks.** `SKIP LOCKED` guarantees that no two concurrent executions of this statement can return the same `id`, because a row already locked by another transaction is skipped rather than waited for.
2. **The `UPDATE` marks the rows claimed.** It runs in the same statement, so there is no window between locking and marking.
3. **`RETURNING` hands the work to the application.** One round trip, atomically.

### 🔴 The locking clause must be *inside* the CTE

The most common way this query is written wrong is putting `FOR UPDATE SKIP LOCKED` on the outer statement, or omitting it and assuming the `UPDATE` is enough. The manual is explicit:

> *"these clauses do not apply to WITH queries referenced by the primary query. If you want row locking to occur within a WITH query, specify a locking clause within the WITH query."*

and, for the sub-`SELECT` form of the same pattern:

> *"When a locking clause appears in a sub-SELECT, the rows locked are those returned to the outer query by the sub-query."*

Without the clause in the CTE, two concurrent workers both compute the same candidate list, and then both `UPDATE` the same rows — one blocks on the other's row lock, and when it unblocks it has claimed a job that is already `running`. You have reinvented the serialisation you were trying to avoid, with a correctness bug on top.

### 🔴 Never use `OFFSET` in a claim query

> *"If a LIMIT is used, locking stops once enough rows have been returned to satisfy the limit (but note that rows skipped over by OFFSET will get locked)."*

`LIMIT` is safe and efficient: locking stops as soon as the limit is satisfied. `OFFSET` is the opposite — rows you deliberately skipped are still locked, so a worker paginating through the queue with `OFFSET 100` locks a hundred jobs it will never process and blocks every other worker out of them for the duration of its transaction. There is no legitimate reason to paginate a claim; you want *any* N claimable jobs, not a specific page.

### `ORDER BY` is a preference, not a guarantee

> *"It is possible for a SELECT command running at the READ COMMITTED transaction isolation level and using ORDER BY and a locking clause to return rows out of order. This is because ORDER BY is applied first."*

The ordering is computed before locking, and `SKIP LOCKED` then removes some of the chosen rows. Combined with retries, this means the claim query expresses *fairness*, not *sequence*. Design accordingly — see the ordering section of [04c](04c-the-anatomy-of-a-job.md).

⚠️ And one clause that is simply unavailable here:

> *"The WITH TIES option is used to return any additional rows that tie for the last place in the result set according to the ORDER BY clause; ORDER BY is mandatory in this case, and SKIP LOCKED is not allowed."*

## The claim, in TypeScript

A claim is several statements in one transaction, so it needs a **checked-out client**, not the pool's convenience method. node-postgres is unambiguous:

> *"Do **not** use `pool.query` if you are using a transaction. The pool will dispatch every query passed to pool.query on the first available idle client."*
> *"You must **always** return the client to the pool if you successfully check it out, regardless of whether or not there was an error with the queries you ran on the client."*
> — [node-postgres · pooling](https://node-postgres.com/features/pooling)

```ts
// lib/jobs/claim.ts
import type { Pool } from 'pg'

export type ClaimedJob = {
  id: string
  kind: string
  payload: unknown
  attempts: number
  max_attempts: number
}

const CLAIM_SQL = `
WITH claimed AS (
  SELECT id
    FROM jobs
   WHERE status = 'pending'
     AND run_at <= now()
   ORDER BY run_at, id
   LIMIT $1
   FOR UPDATE SKIP LOCKED
)
UPDATE jobs j
   SET status       = 'running',
       locked_until = now() + make_interval(secs => $2),
       locked_by    = $3,
       attempts     = j.attempts + 1
  FROM claimed c
 WHERE j.id = c.id
RETURNING j.id, j.kind, j.payload, j.attempts, j.max_attempts`

export async function claimJobs(
  pool: Pool,
  { batch, leaseSeconds, workerId }: { batch: number; leaseSeconds: number; workerId: string },
): Promise<ClaimedJob[]> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<ClaimedJob>(CLAIM_SQL, [batch, leaseSeconds, workerId])
    await client.query('COMMIT')
    return rows
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    // Unconditional. This `finally` is the difference between a working
    // queue and a pool that is exhausted after the first error.
    client.release()
  }
}
```

Strictly, a single statement is atomic on its own and the explicit `BEGIN`/`COMMIT` is redundant here — but writing it out makes the transaction boundary visible, and the moment you add a second statement (an audit insert, a metrics update) the boundary must already be there.

`attempts` is incremented **at claim time, not at failure time**. That is deliberate: a job that crashes the worker process — an out-of-memory payload, an infinite loop — never reports a failure, so a failure-time counter never advances and the job is reclaimed forever, taking a worker down each time. Incrementing on claim means even an unreported death costs an attempt, and the poison pill dead-letters itself. The cost is that a worker killed by an unrelated deploy also burns an attempt, which is a much cheaper mistake.

## Gotchas

**★ Symptom: you added workers and throughput did not improve — it got slightly worse.** Cause: the claim query has `FOR UPDATE` without `SKIP LOCKED`, so every extra worker is an extra waiter blocked on the same oldest row, each one holding a pooled connection while it waits. Fix: add the clause, in the CTE:

```sql
SELECT id FROM jobs WHERE status = 'pending' AND run_at <= now()
 ORDER BY run_at, id LIMIT $1
 FOR UPDATE SKIP LOCKED;
```

**★ Symptom: two workers processed the same job, even though the query has `SKIP LOCKED`.** Cause: the clause is on the outer statement, not on the CTE — and *"these clauses do not apply to WITH queries referenced by the primary query."* The CTE ran unlocked, both workers got the same candidate ids, and the `UPDATE`s serialised without either noticing. Fix: move the clause inside the `WITH` body, exactly as `CLAIM_SQL` above does. The visual check in review is that `FOR UPDATE SKIP LOCKED` appears *before* the closing parenthesis of the CTE.

**★ Symptom: one worker starves the others under load and jobs are locked that nobody is processing.** Cause: `OFFSET` in the claim query — *"rows skipped over by OFFSET will get locked"*. The worker asked for "the second page of pending jobs" and locked the first page on the way past. Fix: delete the `OFFSET`. A claim wants *any* N claimable rows; the only positional clause it may use is `LIMIT`.

**★ Symptom: the pool is exhausted after a burst of failed claims, and every subsequent request hangs.** Cause: `pool.connect()` inside a `try` whose `release()` sits after the queries rather than in a `finally`; an error skipped it and leaked the client permanently. node-postgres: *"You must always return the client to the pool if you successfully check it out, regardless of whether or not there was an error."* Fix: `finally { client.release() }`, with no condition on it — as above. This one leak is the single most common cause of "the site is down and the database looks idle".

**Symptom: a migration deployed and every worker stalled for the length of it.** Cause: `SKIP LOCKED` only skips *row* locks — *"the required ROW SHARE table-level lock is still taken in the ordinary way."* An `ALTER TABLE` taking `ACCESS EXCLUSIVE` on `jobs` conflicts with that, so claims queue behind it. Fix: set a short `lock_timeout` on migrations touching the queue table so they fail fast instead of parking the fleet:

```sql
SET lock_timeout = '3s';
ALTER TABLE jobs ADD COLUMN priority int NOT NULL DEFAULT 0;
```

**Symptom: a "queue depth" dashboard shows a number that jitters wildly and never matches reality.** Cause: the metric query was copied from the claim query and inherited `SKIP LOCKED` — and *"skipping locked rows provides an inconsistent view of the data, so this is not suitable for general purpose work."* You are counting "rows not currently locked", which fluctuates with worker activity. Fix: metric queries never lock. Plain `SELECT count(*) … WHERE status = 'pending'`, as in [04i](04i-queue-observability.md).

**Symptom: job ids in the application are wrong for large tables — comparisons fail, ids look truncated.** Cause: `bigint` values arriving as JavaScript numbers would lose precision, so `pg` returns them as strings; code that did `Number(row.id)` reintroduced exactly the problem the driver avoided. Fix: keep ids as strings end to end, and never do arithmetic on them.

**Symptom: `run_at` delays behave differently in two environments.** Cause: `timestamp` without a time zone, or a session `TimeZone` difference between the worker and the application. Fix: every time column in this table is `timestamptz` and every comparison uses `now()`. Never compute a deadline in JavaScript and send it as a string; let the database do the arithmetic with `make_interval`.

## Interview questions

**★ Explain `SKIP LOCKED` to someone who has only used `FOR UPDATE`.**
`FOR UPDATE` says "I intend to update these rows, so nobody else may touch them until I commit" — and a second transaction asking for the same row *waits*. That is correct for the case row locking was designed for, where two transactions genuinely need the same row and one must go second. A queue is the opposite situation: the workers do not need *that* row, they need *a* row, and waiting is pure waste. `SKIP LOCKED` changes the loser's behaviour from "block until the winner commits" to "pretend that row was not in the result and take the next one", which means N workers can execute the identical claim statement concurrently and receive N disjoint sets of jobs with no coordination at all. The manual endorses exactly this use, while warning that the resulting view of the table is inconsistent — which is fine for claiming and disqualifying for reporting.

**★ What actually happens if you leave `SKIP LOCKED` off, in detail?**
Worker B's `SELECT … FOR UPDATE` finds the same top row as worker A, and blocks — the manual describes `NOWAIT`/`SKIP LOCKED` precisely as the way *"to prevent the operation from waiting for other transactions to commit"*, so without one of them, waiting is the defined behaviour. B stays blocked for as long as A's transaction lasts, holding a database connection and a pool slot the whole time. When A commits, B re-evaluates and finds the row no longer matches `status = 'pending'`, so it returns zero rows and loops. The observable result is that total throughput is capped at roughly one worker regardless of how many you run, latency rises with worker count, and the connection pool saturates — a scaling curve that goes the wrong way, which is why the bug is usually diagnosed as "the database is slow" rather than as a missing clause.

**★ Why must the locking clause be inside the CTE rather than on the `UPDATE`?**
Because a locking clause does not propagate into a `WITH` query — *"these clauses do not apply to WITH queries referenced by the primary query. If you want row locking to occur within a WITH query, specify a locking clause within the WITH query."* The CTE is where the candidate rows are chosen, so it is the only place where skipping a locked row can prevent two workers from choosing the same one. Put it outside and the selection happens unlocked; both workers pick identical candidates and only then contend on the `UPDATE`, where one blocks on the other's row lock and afterwards updates a row that is already claimed. You get the serialisation you were avoiding *plus* double processing, and the query still looks correct on the page because the words `SKIP LOCKED` are present.

**★ Why is `OFFSET` dangerous in a claim query when `LIMIT` is fine?**
Because they behave differently with respect to locking. The manual states that with `LIMIT`, *"locking stops once enough rows have been returned to satisfy the limit"*, so you lock exactly the rows you take. But *"rows skipped over by OFFSET will get locked"* — the rows you stepped past are locked anyway, for the length of your transaction, and invisible to every other worker via `SKIP LOCKED`. A worker using `OFFSET 100` therefore removes a hundred jobs from the fleet's view while processing none of them. The deeper point is that pagination is meaningless for a claim: you are not browsing a list, you are taking work, and any N claimable rows are equally good.

**★ Why should the attempt counter increment when the job is claimed rather than when it fails?**
Because failures that get reported are the easy case. The dangerous job is the one that kills the worker outright — an allocation that blows the heap, a native segfault, a payload that triggers an infinite loop until the platform reaps the instance. That job never reaches your failure handler, so a failure-time counter stays at zero and the lease expiry hands the same poison pill to the next worker, forever, taking one worker down per cycle. Incrementing at claim time means every delivery is counted whether or not anyone survived to report it, so the job reaches `max_attempts` and dead-letters on its own. The trade-off you accept is that a worker killed for unrelated reasons — a deploy, a spot reclaim — also spends an attempt, which is why `max_attempts` should be generous rather than tight.

**Why is `SKIP LOCKED` a bad idea in a report, given it works so well here?**
Because it silently changes the result set based on what other transactions happen to be doing at that instant. The manual says it plainly: *"Skipping locked rows provides an inconsistent view of the data, so this is not suitable for general purpose work."* A count, a sum or an export written with `SKIP LOCKED` returns a number that depends on concurrent activity, is not reproducible, and has no error to warn you — it just quietly under-reports. In a claim that is the desired semantics, because "give me what is available" is the actual question. In a report it is a wrong answer with no symptom.

---

← [04c · The anatomy of a job](04c-the-anatomy-of-a-job.md) · Next → [04da · Leases and the claim lifetime](04da-leases-and-the-claim-lifetime.md)
