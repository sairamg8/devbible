---
title: "Finding the bottleneck before optimizing"
sidebar_label: "15 · Finding the bottleneck"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Method page — tools cited are covered with
> measurements on later pages in this phase.

**The bottleneck is the resource that is full. Optimizing anything else is a hobby.
Measure until you know which resource, then change only that.**

Node processes run out of a small set of things: **event loop time**, **CPU**,
**memory**, **outbound concurrency / sockets**, **DB pool**, **disk**, or
**downstream latency**. Guessing "it must be Redis" without numbers is how teams
rewrite the wrong layer.

## A fixed order that works under pressure

1. **Reproduce with a number** — p99 latency, error rate, or lag max. No number, no
   fix you can verify.
2. **Golden signals** ([page 11](./11-golden-signals.md)) — is it latency, errors,
   traffic spike, or saturation?
3. **Loop lag** ([page 09](./09-event-loop-lag.md)) — if max lag tracks the incident,
   you are CPU-bound or blocked on the loop. If lag is calm and latency is not, you
   are waiting on I/O or a queue.
4. **Dependency timings** — DB, HTTP, Redis. One slow `await` dominates more outages
   than clever micro-optimizations.
5. **Profile only when the loop or CPU is hot** — `--cpu-prof` / Inspector
   (page 19), not as step one on an I/O outage.
6. **Change one thing**, remeasure the same number.

## Decision table

| Observation | Likely bottleneck | First move |
|---|---|---|
| Lag max high, CPU high | Sync JS / crypto / JSON | Profile; move work off path |
| Lag low, latency high | Downstream or pool wait | Timeouts, pool size, indexes |
| Errors spike, latency fine | Logic / validation / deploy | Error tracker + logs |
| RSS climbs, traffic flat | Leak or unbounded cache | Heap snapshots (page 17) |
| Queue depth climbs | Consumers slow or stuck | Worker concurrency, DLQ |
| Only one route is slow | That route's I/O or code | Trace + targeted timing |

## What "measure" means in Node

```js
import {performance} from 'node:perf_hooks';

export async function checkout(orderId) {
  const t0 = performance.now();
  const order = await loadOrder(orderId);
  const tLoad = performance.now();
  await charge(order);
  const tCharge = performance.now();
  await save(order);
  const tEnd = performance.now();
  log.info({
    orderId,
    ms_load: +(tLoad - t0).toFixed(1),
    ms_charge: +(tCharge - tLoad).toFixed(1),
    ms_save: +(tEnd - tCharge).toFixed(1),
    ms_total: +(tEnd - t0).toFixed(1),
  });
}
```

Three spans beat a single "checkout is slow" log. When production volume forbids
per-request logs, sample or push the same boundaries as OTel spans
([page 05](./05-opentelemetry.md)).

## Optimizations that are usually wrong first

- Rewriting readable code into microbenchmark winners (page 20)
- Adding a cache before you know the read pattern and invalidation path (page 16)
- Scaling replicas when one dependency is single-threaded saturated
- "More `cluster` workers" when the database is the limit

## Gotchas

**Symptom:** Staging is fine, production is not
**Cause:** Data volume, concurrency, or real dependency latency never reproduced
**Fix:** Load test against production-like data; compare lag and dependency times

**Symptom:** Profile shows noise, no clear hot function
**Cause:** You are I/O bound; CPU profile cannot show await time well
**Fix:** Traces and per-await timings, not only CPU profiles

**Symptom:** Fix "worked" in a microbenchmark, p99 unchanged
**Cause:** Optimized a non-dominant path
**Fix:** Confirm the path is on the critical request with traces before celebrating

**Symptom:** Two changes shipped together; nobody knows which helped
**Cause:** No single-variable experiment
**Fix:** One change per deploy when debugging performance

## Interview questions

**★ How do you find a bottleneck in a slow Node API?**
Quantify the symptom, check golden signals and loop lag, time dependencies, profile
only if the loop/CPU is hot, change one thing, remeasure.

**★ Lag is low but p99 is high — what does that suggest?**
Waiting on I/O or a queue, not blocking the event loop. Look at downstream and pool
wait times.

**Why is "make it faster" a bad ticket?**
Without a metric and a resource, you cannot know done. "p99 checkout under 300 ms at
N RPS" is a ticket.

**When is a CPU profile the wrong first tool?**
When the process is idle on the loop and waiting on network or disk.

**What is the cost of optimizing the wrong layer?**
Time burned, complexity added, and the original saturation still pages you at 3 a.m.

---

← Prev: [Prometheus metrics](./14-prometheus-metrics.md) · Next → [Caching strategy](./16-caching-strategy.md)
