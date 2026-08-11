---
title: "Exponential backoff and jitter"
sidebar_label: "15 · Backoff and jitter"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** — 500 simulated clients, three attempts each,
> `100 * 2 ** (attempt - 1)` backoff, bucketed by 100 ms.

**Backoff decides how hard you hit a struggling dependency. Jitter decides whether all
your clients hit it at the same instant.** They are separate fixes for separate
problems, and the second one is the one that gets skipped.

## Backoff: stop making it worse

A fixed retry delay applies constant pressure to a service that is already failing —
and it is exactly when a service is overloaded that your clients all start retrying.
Exponential backoff gives it room:

```js
const backoff = (attempt, base = 100, cap = 30_000) =>
  Math.min(cap, base * 2 ** (attempt - 1));      // 100, 200, 400, 800, 1600 …
```

The **cap** is not optional: at attempt 12, uncapped doubling is 200 seconds. Cap it
at something a human would tolerate, and bound total attempts as well.

## Jitter: the part that gets skipped

Failures are correlated. When a dependency goes down, every client fails at
approximately the same moment — so with a deterministic schedule, they all retry at
approximately the same moment, forever, in a synchronised wave.

500 clients, three attempts each, bucketed by 100 ms:

```console
no jitter  : 700ms:500
full jitter: 0ms:22 100ms:67 200ms:112 300ms:122 400ms:108 500ms:62 600ms:7
             max bucket 122
```

**All 500 clients in one bucket, against a maximum of 122.** The recovering service
sees a spike of 500 concurrent requests at exactly 700 ms — likely knocking it over
again, at which point the cycle repeats with the next backoff step. That is the
thundering herd, and it is why an outage that should have lasted seconds lasts
minutes.

Full jitter is one line:

```js
const delay = Math.random() * backoff(attempt);        // full jitter
```

That is the AWS "full jitter" variant, and it is the right default. Two others exist:

| Strategy | Delay | When |
|---|---|---|
| No jitter | `b` | Never in a system with more than one client |
| **Full jitter** | `random(0, b)` | **Default** — best spread |
| Equal jitter | `b/2 + random(0, b/2)` | When you want a guaranteed minimum wait |
| Decorrelated | `min(cap, random(base, prev * 3))` | Long-running pollers |

Full jitter's only downside is that an individual retry may come back very quickly. If
a minimum spacing matters — a rate-limited API — use equal jitter.

## The whole thing

```js
import {setTimeout as sleep} from 'node:timers/promises';

export async function withRetry(fn, {
  attempts = 5, base = 100, cap = 30_000, isTransient = () => true, budget, signal,
} = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= attempts || !isTransient(err)) throw err;
      const delay = Math.round(Math.random() * Math.min(cap, base * 2 ** (attempt - 1)));
      if (budget && budget.remaining < delay + 200) throw err;   // no time left — page 12
      await sleep(delay, undefined, {signal});                   // cancellable — page 13
    }
  }
}
```

Four things beyond the arithmetic, each of which has its own failure mode:

**`isTransient`** — retrying permanent failures is the mistake on
[page 14](./14-retry-safe-failures.md).

**The budget check** — sleeping 8 seconds inside a 2-second budget guarantees you blow
it. Give up while there is still time to fail cleanly.

**The signal** — a bare `setTimeout` holds the process open through shutdown. With
`timers/promises` and a signal, `SIGTERM` cancels the sleep immediately
([page 11](./11-graceful-shutdown.md)).

**`Retry-After`** — if the server tells you when to come back, obey it rather than your
own schedule:

```js
const retryAfter = Number(res.headers.get('retry-after'));
const delay = Number.isFinite(retryAfter) ? retryAfter * 1000 : jittered(attempt);
```

## In a queue, this is configuration

Job retries already have all of this; do not rebuild it inside a handler
([page 04](./04-retries-and-stalled-jobs.md)):

```js
await queue.add('call-webhook', payload, {
  attempts: 6,
  backoff: {type: 'exponential', delay: 1000},
});
```

```console
attempt timings (ms from start): 20, 300, 810, 1610      <- gaps 280 / 510 / 800
```

The exponential shape is visible in those gaps. **Check whether your queue jitters by
default** — several do not, and 10 000 jobs that failed together will retry together.
Where there is no built-in jitter, a custom backoff strategy is a few lines and worth
writing.

## What backoff cannot fix

**It does not reduce total load during a long outage.** Every client still retries,
just more politely. When a dependency is properly down, the fix is to stop calling it —
a circuit breaker that fails fast after N consecutive failures, then probes with a
single request.

**It does not fix an overloaded system caused by your own traffic.** If you are the
load, backing off delays the collapse. Concurrency limiting is the fix
([page 16](./16-concurrency-limiting.md)).

**It does not make retries safe.** Backoff is about *when*; safety is about *whether*
([page 14](./14-retry-safe-failures.md)).

## Gotchas

**Symptom:** A dependency recovers, then immediately falls over again
**Cause:** Synchronised retries — no jitter. Measured: all 500 clients in the same
100 ms bucket.
**Fix:** Full jitter, `Math.random() * backoff`.

**Symptom:** Retry delays reach minutes
**Cause:** Uncapped exponential growth.
**Fix:** Cap the delay and the attempt count.

**Symptom:** A request takes far longer than its timeout
**Cause:** Backoff sleeps outside the budget.
**Fix:** Check remaining budget before sleeping.

**Symptom:** Shutdown waits out a long backoff
**Cause:** A bare `setTimeout` keeps the loop alive.
**Fix:** `timers/promises` with an abort signal.

**Symptom:** A rate-limited API keeps returning 429 despite backoff
**Cause:** `Retry-After` ignored.
**Fix:** Honour the header when present.

**Symptom:** Queue retries still arrive in a wave
**Cause:** The queue's exponential backoff is deterministic.
**Fix:** Add a jittered custom backoff strategy.

## Interview questions

**★ Why is jitter necessary if you already have exponential backoff?**
Because failures are correlated — every client fails at the same moment, so a
deterministic schedule makes them all retry at the same moment. Measured: 500 clients
with three attempts and no jitter all landed in one 100 ms bucket; with full jitter the
busiest bucket held 122. Exponential backoff sets the rate; jitter breaks the
synchronisation.

**★ What is "full jitter"?**
`random(0, backoff)` rather than `backoff`. It gives the best spread and is the right
default. Equal jitter (`b/2 + random(0, b/2)`) is preferable only when you need a
guaranteed minimum spacing, such as against a rate-limited API.

**★ What must a production retry loop have besides the delay?**
A transient-error check, an attempt cap, a delay cap, a budget check so the sleep
cannot exceed the request's deadline, an abort signal so shutdown is not blocked, and
respect for `Retry-After` when the server sends it.

**★ Does backoff solve an outage?**
No. Every client still calls the failing dependency, just less often. Backoff protects
recovery; a circuit breaker stops the calls entirely after repeated failures, and
concurrency limiting is what protects you from being the load yourself.

**Where should backoff live in a job pipeline?**
In the queue configuration, not inside the handler — the queue already schedules
delayed retries without holding a worker slot. Check whether it jitters by default;
several queues do not.

**Why cap the exponential?**
Doubling from 100 ms reaches 200 seconds by attempt 12. Without a cap, a job that
retries a dozen times effectively stops retrying, and a request-path retry blows any
budget.

---

← Prev: [Retry only what is safe](./14-retry-safe-failures.md) · Next → [Concurrency limiting](./16-concurrency-limiting.md)
