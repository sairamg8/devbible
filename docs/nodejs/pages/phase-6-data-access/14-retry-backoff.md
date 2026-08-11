---
title: "Retry and backoff on transient failures"
sidebar_label: "14 · Retry and backoff"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** — `pg` 8.23.0 against PostgreSQL 17.10 and
> `mongodb` 7.5.0 against MongoDB 8.2.12, with the container stopped and restarted
> mid-run.

**Retrying is easy. Knowing what may be retried is the entire problem.** A retry on
the wrong error turns one failure into many; a retry on a non-idempotent write turns
one order into two.

## Two questions before any retry

**Is the failure transient?** A dropped connection, a restarted database, a
connection timeout — these succeed if you try again. A constraint violation, a syntax
error, a bad password will fail identically forever, and retrying them is a way to
turn a 400 into a 30-second 500.

**Is the operation safe to repeat?** A `select` always is. An `insert` is only safe
if the row is keyed on something you control. And a **timeout is not a failure** — it
is *not knowing*. The statement may have committed after the client gave up.

| Retry | Do not retry |
|---|---|
| `ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT` | `23505` unique violation |
| `57P01` admin shutdown / terminated | `23514` check violation |
| `08006` connection failure, `08003` | `42601` syntax error |
| `40001` serialization failure, `40P01` deadlock | `28P01` bad password |
| `MongoNetworkError`, `MongoServerSelectionError` | `25P02` aborted transaction |

`40001` and `40P01` are the interesting entries: a serialization failure or deadlock
means "your transaction lost a race" — retrying the **whole transaction** is the
documented, correct response.

## The loop

```js
const TRANSIENT = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE',
                           '57P01', '08006', '08003', '08001', '40001', '40P01']);

const isTransient = (err) => TRANSIENT.has(err.code) || TRANSIENT.has(err.errno);

export async function withRetry(fn, {attempts = 6, base = 100, cap = 5000, signal} = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= attempts || !isTransient(err)) throw err;
      const backoff = Math.min(cap, base * 2 ** (attempt - 1));
      const delay = Math.round(Math.random() * backoff);      // full jitter
      console.log(`attempt ${attempt} failed (${err.code}), retrying in ${delay} ms`);
      await scheduler.wait(delay, {signal});
    }
  }
}
```

Run against a database that is down and then comes back:

```console
$ node ex-retry.mjs
attempt 1 failed (ECONNREFUSED), retrying in 173 ms
attempt 2 failed (ECONNREFUSED), retrying in 248 ms
attempt 3 failed (ECONNREFUSED), retrying in 535 ms
attempt 4 failed (ECONNREFUSED), retrying in 1557 ms
attempt 5 failed (ECONNREFUSED), retrying in 1546 ms
connected on attempt 6 after 4123 ms
```

Three details in that loop earn their place:

**Exponential.** 100, 200, 400, 800, 1600 ms. A fixed 100 ms interval hammers a
recovering database with exactly the load that keeps it down.

**Jitter.** `Math.random() * backoff` — full jitter. Without it, every instance that
failed at the same moment retries at the same moment, forever, in a synchronised
wave. Note attempt 5's delay (1546 ms) came out *below* attempt 4's (1557 ms): that
is randomness doing its job, not a bug.

**A cap and an attempt limit.** Unbounded retry is an outage that never reports
itself. And `scheduler.wait(delay, {signal})` — from `node:timers/promises` — means a
shutdown or a client disconnect cancels the wait instead of holding the process open
([Phase 5](../phase-5-http-processes/)).

## What the drivers already retry

Do not build what you already have.

**`mongodb` retries by default**: `retryWrites: true` and `retryReads: true`. It
retries **once**, for network errors and failovers, and it is safe because the driver
attaches a transaction id the server uses to deduplicate. That is the machinery a
hand-written retry cannot replicate.

Server selection has its own budget:

```js
const client = new MongoClient(uri, {serverSelectionTimeoutMS: 2000});
await client.connect();
```

```console
MongoServerSelectionError: connect ECONNREFUSED 127.0.0.1:57017
  (after 2013 ms)
```

The driver **already spent 2 seconds** looking for a server. Your outer retry sits on
top of that, so total time is attempts × (selection timeout + backoff) — the reason a
"5 retries" policy can take a minute.

**`pg` retries nothing.** It is a thin driver: one query, one round trip, one
outcome. All of the above is yours to write. It also fails fast, which is easier to
reason about:

```console
new Pool() to a dead port      returned in 0 ms, totalCount 0
first query                    failed after 9 ms, ECONNREFUSED
```

The pool connects lazily ([page 03](./03-driver-lifecycle.md)), so nothing retries at
construction because nothing connected.

## Where the retry goes

**At boot, retry the connection.** A container that starts before its database is
normal; crashing is the wrong response to a dependency that is 3 seconds behind.
Retry the boot check with a cap, then exit non-zero and let the orchestrator restart
you.

**Per query, retry only reads and idempotent writes.** This is the discipline that
matters:

```js
// safe — a read
const user = await withRetry(() => pool.query('select … where id = $1', [id]));

// safe — idempotent by construction
await withRetry(() => pool.query(
  `insert into invoices (idempotency_key, user_id, total_cents)
   values ($1, $2, $3) on conflict (idempotency_key) do nothing`,
  [key, userId, cents]));

// NOT safe — retrying may charge twice
await withRetry(() => pool.query(
  'update accounts set balance_cents = balance_cents - $1 where id = $2', [cents, id]));
```

The middle one is the pattern worth internalising: **make the write idempotent, then
retrying is free.** A unique key the caller supplies, `on conflict do nothing`, and
the second attempt is a no-op. That is also the foundation of job idempotency in
Phase 7.

**Never retry inside a transaction.** Once a statement fails, PostgreSQL aborts the
whole transaction — every subsequent command returns `25P02 current transaction is
aborted` ([page 06](./06-transactions.md)). The retry unit is the entire transaction,
from `BEGIN`, in a fresh checkout from the pool.

```js
await withRetry(() => withTransaction(pool, async (tx) => {
  await tx.query('update accounts set balance_cents = balance_cents - $1 where id = $2', [c, from]);
  await tx.query('update accounts set balance_cents = balance_cents + $1 where id = $2', [c, to]);
}));
```

That is correct for `40001` and `40P01` specifically, because the transaction did not
commit — there is nothing to duplicate.

## The two things a retry policy is not

**A retry is not a timeout.** Without one, "retry 5 times" can wait forever five
times. Set `connectionTimeoutMillis` and `statement_timeout`
([page 03](./03-driver-lifecycle.md)) so each attempt is bounded, and remember
`query_timeout` is client-side only — the server keeps running the query you stopped
waiting for.

**A retry is not a circuit breaker.** When a database is down, every request retrying
six times means six times the load on the recovery, and requests piling up until the
process runs out of memory. A breaker trips after N consecutive failures, fails fast
for a cooldown, then lets one request through to test. Retry handles a blip; a
breaker handles an outage. Below roughly a few hundred requests per second, retry
plus a hard attempt cap plus a bounded pool is usually enough — the pool's own queue
is a crude breaker, since request 11 waits rather than opening connection 11.

## Gotchas

**Symptom:** A duplicate charge or a doubled row after an incident
**Cause:** A non-idempotent write was retried after a timeout — the first attempt had
committed.
**Fix:** Idempotency key plus `on conflict do nothing`. Retry only what is safe to
repeat.

**Symptom:** All instances recover at the same instant, then fail again together
**Cause:** No jitter — synchronised retry waves.
**Fix:** Full jitter: `Math.random() * backoff`.

**Symptom:** A bad password takes 30 seconds to report
**Cause:** Retrying a permanent error (`28P01`).
**Fix:** Allowlist transient codes; rethrow everything else immediately.

**Symptom:** Retries make an overload worse
**Cause:** Retry storm against a saturated database.
**Fix:** Cap attempts, cap total time, add a breaker; shed load rather than queue it.

**Symptom:** `25P02 current transaction is aborted` on the retry
**Cause:** Retrying a statement inside a transaction that already failed.
**Fix:** Retry the whole transaction from `BEGIN` on a fresh connection.

**Symptom:** Retry logic never fires; failures surface immediately
**Cause:** The error is on a pooled connection's `'error'` event, not on your `await`.
**Fix:** `pool.on('error')` — an idle connection killed by the server emits `57P01`
there and crashes the process without it ([page 01](./01-connection-pooling.md)).

**Symptom:** Shutdown hangs for the length of the backoff
**Cause:** A bare `setTimeout` keeps the event loop alive.
**Fix:** `scheduler.wait(delay, {signal})` with the shutdown signal.

## Interview questions

**★ Which database errors should you retry?**
Transient ones: connection refused/reset, `57P01` admin shutdown, `08006`, and
crucially `40001` serialization failure and `40P01` deadlock — those mean the
transaction lost a race and re-running it is the documented fix. Never retry
constraint violations, syntax errors or authentication failures; they will fail
identically forever.

**★ Why jitter?**
Because failures are correlated. Every instance that failed at the same moment
retries at the same moment, producing a synchronised wave that keeps the recovering
database down. Full jitter — a random delay up to the backoff — spreads them out.

**★ A write times out. Do you retry it?**
Only if it is idempotent. A timeout means you do not know whether it committed, so a
plain `insert` or a relative `update` may apply twice. Give the write a caller-supplied
idempotency key and `on conflict do nothing`, and the retry becomes a no-op.

**★ Can you retry a single statement inside a transaction?**
No. After any failure PostgreSQL aborts the transaction and every further command
returns `25P02`. The retry unit is the whole transaction from `BEGIN`, on a fresh
connection from the pool.

**What do the drivers retry for you?**
`mongodb` defaults to `retryWrites: true` and `retryReads: true` — one automatic
retry on network errors and failovers, made safe by a server-side transaction id that
deduplicates. `pg` retries nothing; all of it is yours.

**Retry versus circuit breaker?**
Retry absorbs a blip. A breaker handles an outage: after N consecutive failures it
fails fast for a cooldown, then probes with a single request. Retrying through a real
outage multiplies load on the recovery and fills the process with waiting requests.

**How do retries interact with timeouts?**
They multiply. Mongo's default server selection already spends its
`serverSelectionTimeoutMS` before your handler sees the error — measured 2013 ms with
a 2000 ms setting. Bound each attempt and bound the total, or "5 retries" becomes a
minute-long request.

---

← Prev: [Prisma and Drizzle](./13-prisma-drizzle.md) · Next → [Read replicas](./15-read-replicas.md)
