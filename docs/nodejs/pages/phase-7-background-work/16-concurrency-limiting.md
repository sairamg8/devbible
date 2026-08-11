---
title: "Concurrency limiting — bounded parallelism and worker pools"
sidebar_label: "16 · Concurrency limiting"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** — 200 tasks, each a 20 ms async operation.

**`Promise.all` over an array of unknown length is an outage waiting for a big enough
array.** It starts everything at once, by design. With 200 items that is 200
simultaneous operations; with 50 000 it is 50 000, and the process, the database or the
API on the other end goes down.

## The measurement

```js
let inflight = 0, peak = 0;
const call = async () => {
  inflight++; peak = Math.max(peak, inflight);
  await doWork();
  inflight--;
};

await Promise.all(items.map(call));
```

```console
Promise.all over 200 items -> peak in-flight 200
mapLimit(8) over 200 items -> peak in-flight 8, 511 ms
```

**Peak 200 against peak 8.** `Promise.all` does not schedule anything — it collects
promises that are *already running*. The parallelism was decided by `.map()`; `all`
only waits.

This is the Phase 2 outage
([Phase 2 — async](../phase-2-async/)) in its production form. It fails in four ways at
once: the connection pool is exhausted so unrelated requests time out
([Phase 6, page 01](../phase-6-data-access/01-connection-pooling.md)); the downstream
API rate-limits or falls over; memory holds every pending result; and one rejection
abandons the rest mid-flight with no way to clean up.

## The limiter

Thirteen lines, no dependency:

```js
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const i = next++;                        // sync claim — no interleaving
      results[i] = await fn(items[i], i);
    }
  };

  await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker));
  return results;
}
```

`limit` runners pull from a shared cursor until the work is gone. Results stay in input
order, and peak concurrency is exactly `limit` — measured, 8.

The `next++` is deliberately synchronous. Any `await` between reading and incrementing
would let two runners claim the same index — the same class of bug as a queue without
an atomic claim ([page 02](./02-job-queues.md)).

**Preserving errors** matters as much as preserving order. `Promise.all` rejects on the
first failure while the rest keep running invisibly. For a batch you usually want all
outcomes:

```js
const settled = await mapLimit(items, 8, async (item) => {
  try { return {ok: true, value: await fn(item)}; }
  catch (err) { return {ok: false, item, err}; }
});
const failures = settled.filter((r) => !r.ok);
```

## Picking the limit

The bound is not a taste question — it comes from whatever resource runs out first.

| Bounded by | Sensible limit |
|---|---|
| Your database pool | **Below** `pool.max`, leaving headroom for other work |
| A third-party API | Their documented rate limit, minus margin |
| Outbound sockets | Tens, not thousands — file descriptors are finite |
| Memory per task | `available memory / peak per task` |
| CPU-bound work | `os.availableParallelism()`, in worker threads |

The database row is the one that bites in a MERN/PERN app: `mapLimit(items, 50, …)`
against a pool of `max: 10` does not run 50 queries — it runs 10 and queues 40, while
starving every HTTP request the process is also serving. **Match the limit to the pool,
or give the batch its own smaller pool.**

For CPU-bound work, concurrency is not parallelism: `mapLimit` on one event loop
interleaves nothing, because the work never yields. That needs worker threads
([Phase 5](../phase-5-http-processes/)).

## Where limits belong

**In the worker** — `concurrency` on a queue worker is exactly this limiter, applied to
jobs ([page 03](./03-worker-processes.md)). It is the reason a worker pulls 5 jobs and
not 5000.

**Around fan-out** — the dispatcher of [page 09](./09-outbound-side-effects.md) enqueues
one job per subscriber rather than calling 500 endpoints in parallel. The queue becomes
the limiter, and it is a better one: durable, retryable, observable.

**Around any `map` over data you did not size.** The rule is simple: if the array comes
from a query, a file, or a request body, it needs a bound. If it is three known items,
`Promise.all` is fine and clearer.

**Not in three places at once.** A limit of 10 in the service, inside a worker with
`concurrency: 5`, across 4 worker processes is 200 concurrent operations against a
database that sees one number. Count the product, not the parts.

## Backpressure is the same idea

Limiting concurrency bounds work you initiate. Backpressure bounds work pushed at you —
and it is the same principle applied to a stream: stop reading until the consumer
catches up ([Phase 3 — streams](../phase-3-buffers-streams/)).

A queue is backpressure for jobs: work accumulates in Redis or Postgres, which is built
for it, instead of in the process. The queue growing is a signal to scale workers, not a
failure — the failure mode is the version where 50 000 things run at once and nothing
completes.

## Gotchas

**Symptom:** A batch job takes the whole application down
**Cause:** `Promise.all` over an unbounded array — measured, peak 200 in-flight for 200
items.
**Fix:** `mapLimit` with a bound tied to the scarcest resource.

**Symptom:** `timeout exceeded when trying to connect`
**Cause:** Concurrency above the database pool size.
**Fix:** Limit below `pool.max`, or give the batch its own pool.

**Symptom:** 429s from an API during a batch
**Cause:** No client-side rate bound.
**Fix:** Limit concurrency to their documented rate, and honour `Retry-After`
([page 15](./15-backoff-and-jitter.md)).

**Symptom:** One failure and the rest of the batch is in an unknown state
**Cause:** `Promise.all` rejects on first failure; the others keep running.
**Fix:** Capture per-item outcomes and report failures as data.

**Symptom:** Raising the limit does not speed up CPU-bound work
**Cause:** One event loop — concurrency is not parallelism.
**Fix:** Worker threads, one per core.

**Symptom:** Concurrency is far higher than any single configured limit
**Cause:** Limits multiplying across service, worker and process count.
**Fix:** Compute the product against the shared resource.

**Symptom:** Memory grows through a batch
**Cause:** All results retained until the end.
**Fix:** Process and discard per item; stream rather than collect
([Phase 6, page 16](../phase-6-data-access/16-cursors.md)).

## Interview questions

**★ What is wrong with `Promise.all(items.map(fn))`?**
It starts every operation immediately — `map` decides the parallelism, `all` only waits.
Measured: 200 items produced 200 concurrent operations. With an array whose size you do
not control, that exhausts the connection pool, overruns downstream rate limits, and
holds every pending result in memory.

**★ How do you bound it?**
A `mapLimit`: N runners pulling from a shared index until the work is done — thirteen
lines, no dependency, peak concurrency exactly N. Measured 8 against 200 for the same
work. The index claim must be synchronous, or two runners take the same item.

**★ How do you choose the limit?**
From whatever runs out first: below the database pool size, at or under a third-party
rate limit, within socket and memory budgets. And count the product across layers — a
limit of 10 inside a worker with `concurrency: 5` across 4 processes is 200 against one
database.

**★ Does concurrency limiting help CPU-bound work?**
No. One event loop means those tasks never interleave; the limiter changes nothing
except memory. CPU work needs worker threads or separate processes.

**How does this relate to `Promise.allSettled`?**
`allSettled` fixes error handling — you get every outcome instead of the first rejection
— but not concurrency. It still starts everything at once. You usually want both: a
limiter for the concurrency, per-item try/catch for the outcomes.

**What is the relationship between concurrency limiting and backpressure?**
Same principle, opposite directions. Limiting bounds work you initiate; backpressure
bounds work pushed at you. A job queue is backpressure for background work — the backlog
sits in a datastore built to hold it rather than in your process.

---

← Prev: [Backoff and jitter](./15-backoff-and-jitter.md) · Phase index: [Background work and resilience](./README.md)
