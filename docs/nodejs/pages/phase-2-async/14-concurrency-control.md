---
title: "Concurrency control"
sidebar_label: "14 · Concurrency control"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`Promise.all` over 10,000 items is a self-inflicted outage. It is a waiting
primitive, not a limiter — the limit has to come from you.**

## Why unbounded fails

```js
// ❌ starts 10,000 requests in the same millisecond
const results = await Promise.all(userIds.map(id => api.fetchUser(id)));
```

Everything starts at once. What breaks, in roughly the order you hit it:

| Resource | What happens |
|---|---|
| **Remote API** | 429 rate limit, or you take down someone else's service |
| **Connection pool** | Every query queues behind 10 connections; timeouts cascade |
| **File descriptors** | `EMFILE: too many open files` |
| **Memory** | 10,000 in-flight buffers and response bodies held at once |
| **Event loop** | 10,000 callbacks resolving in one burst |

The cruel part is that it works fine in development with 20 items and fails the
first time a real dataset arrives.

## Measuring the difference

```js
// pool.mjs
import { setTimeout as sleep } from 'node:timers/promises';

let inFlight = 0, peak = 0;
async function work(id) {
  peak = Math.max(peak, ++inFlight);
  await sleep(20);
  inFlight--;
  return id;
}

const ids = Array.from({ length: 50 }, (_, i) => i);

peak = 0;
let t = Date.now();
await Promise.all(ids.map(work));
console.log(`unbounded : ${Date.now() - t}ms, peak concurrency ${peak}`);

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

peak = 0;
t = Date.now();
const out = await mapLimit(ids, 5, work);
console.log(`limit 5   : ${Date.now() - t}ms, peak concurrency ${peak}, results ok ${out.length === 50}`);
```

```console
$ node pool.mjs
unbounded : 22ms, peak concurrency 50
limit 5   : 203ms, peak concurrency 5, results ok 50
```

Ten times slower — **and that is the point.** The bounded version finishes in a
predictable time using a fixed, survivable amount of resource. The unbounded one is
fast right up until it is an incident.

## The pool pattern, explained

`mapLimit` above is worth understanding rather than copying blindly:

- It creates exactly `limit` worker functions.
- Each worker loops, claiming the next index with `next++` and processing it.
- Because JavaScript is single-threaded, `next++` is atomic — no locks needed. That
  is the [one-thread guarantee](../phase-0-runtime-model/02-single-thread-and-io.md)
  paying off.
- `results[i]` preserves input order regardless of completion order.

It is about fifteen lines and has no dependencies. For anything more —
retries, backoff, priorities — use a library rather than growing this:

| Need | Reach for |
|---|---|
| Bounded map over a list | the pattern above, or `p-map` |
| A general queue with concurrency | `p-queue` |
| Retry with backoff | `p-retry` |
| Batch database work | your driver's own batching / `UNNEST` |

## Batching is not the same thing

A common alternative is chunking the list and running each chunk with
`Promise.all`:

```js
// simpler, but strictly worse
for (const batch of chunk(ids, 5)) {
  await Promise.all(batch.map(work));      // waits for the SLOWEST in each batch
}
```

Every batch waits for its slowest member before the next starts, so one slow item
idles four workers. The pool keeps all five busy continuously. Batching is easier
to read and fine when items are uniform; the pool is better when they are not.

## Picking the limit

There is no universal number. Derive it:

- **Bounded by a remote API** → its documented rate limit, minus headroom.
- **Bounded by your database** → the connection pool size. More concurrency than
  connections just moves the queue.
- **Bounded by CPU** → concurrency does not help at all. That is
  [CPU-bound work](22-cpu-bound-work.md).
- **Bounded by memory** → total in-flight bytes divided by per-item size.

Start at 5–10 for external APIs and measure. The right limit is the one where
throughput stops improving — beyond that you are only adding queueing and risk.

## Gotchas

**Symptom:** `EMFILE: too many open files`
**Cause:** Unbounded concurrency over file or socket operations.
**Fix:** A bounded pool. Raising `ulimit` postpones the failure rather than fixing
it.

**Symptom:** 429s from an API that works fine at low volume
**Cause:** `Promise.all` over a large array.
**Fix:** Limit concurrency, add retry with backoff for the 429s that still occur.

**Symptom:** Database queries time out under load while CPU is idle
**Cause:** More concurrent queries than pool connections; the rest queue past the
timeout.
**Fix:** Match concurrency to pool size.

**Symptom:** Memory spikes and the process is OOM-killed
**Cause:** Every in-flight response held simultaneously.
**Fix:** Bound concurrency; stream large responses instead of buffering.

**Symptom:** One slow item stalls a whole batch
**Cause:** Chunked `Promise.all` waits for the slowest member per chunk.
**Fix:** The worker-pool pattern, which keeps every worker busy.

**Symptom:** The pool silently stops early
**Cause:** A rejection inside a worker kills that worker; with `Promise.all` over
the workers, the first rejection propagates and the rest are abandoned mid-flight.
**Fix:** Catch inside `fn` and record failures per item, or use `allSettled` over
the workers.

## Interview questions

**★ Why is `Promise.all` over 10,000 items dangerous?**
It starts all 10,000 immediately — it waits for promises, it does not schedule
them. That exhausts file descriptors, connection pools, memory or the remote
service's rate limit. Concurrency has to be bounded separately.

**★ How would you implement a concurrency limit without a library?**
Spawn exactly N worker functions over a shared cursor. Each worker loops, claims
the next index and awaits the work. Because JavaScript is single-threaded the
cursor increment needs no lock, and writing results by index preserves input
order.

**★ Why is a worker pool better than batching with `Promise.all`?**
Batching waits for the slowest item in each batch before starting the next, so a
single slow item leaves the other workers idle. A pool immediately gives a free
worker the next item, keeping all of them busy.

**★ How do you choose the concurrency limit?**
From whatever the real bottleneck is: the remote API's rate limit, your database
pool size, or in-flight memory. Then measure — the right value is where throughput
stops improving. For CPU-bound work concurrency does not help at all, since there
is only one thread.

**What happens to the other items if one fails in your pool?**
With `Promise.all` over the workers, the first rejection propagates and the
remaining work is abandoned partway. If you need every item attempted, catch
inside the per-item function and collect failures, or use `allSettled`.

---

← Prev: [Callbacks and promisify](13-callbacks-and-promisify.md) · Next → [Unhandled rejections](15-unhandled-rejections.md)
