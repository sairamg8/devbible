---
title: "Load testing"
sidebar_label: "18 · Load testing"
sidebar_position: 18
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 on **Node 24.19.0**. Benchmarking *methodology* — warmup, variance,
> reading a distribution — is [Phase 10, page 20](../phase-10-observability/20-benchmarking.md).
> This page is the testing-phase view: what a load test is *for*, and how it lies.

**A load test answers "what happens at N concurrent users", which no functional test
asks.** It belongs in this phase because it is a test — with a pass condition, run on a
schedule — and because the most common way to run one produces a confident number that
means nothing.

## `autocannon` — the quick answer

For "is this endpoint roughly fine":

```bash
npx autocannon -c 100 -d 30 -w 3 http://127.0.0.1:3000/api/orders
```

`-c` connections, `-d` duration in seconds, `-w` warmup. It reports latency percentiles
and throughput. Run it against a **production-like build** — `NODE_ENV=production`, a
real database — because a dev-mode process measures your tooling, not your service.

It is also scriptable, which is how it becomes a test rather than an experiment:

```js
import autocannon from 'autocannon';

const result = await autocannon({
  url: 'http://127.0.0.1:3000/api/orders',
  connections: 100,
  duration: 30,
  warmup: {connections: 10, duration: 3},
});

assert.ok(result.latency.p99 < 300, `p99 was ${result.latency.p99} ms`);
assert.equal(result.non2xx, 0);
```

## `k6` — when the shape of the load matters

autocannon hammers one URL. Real traffic is a journey with think time, and it ramps:

```js
// k6 run --vus 100 --duration 5m checkout.js
import http from 'k6/http';
import {check, sleep} from 'k6';

export const options = {
  stages: [
    {duration: '2m', target: 100},   // ramp up
    {duration: '5m', target: 100},   // hold
    {duration: '2m', target: 0},     // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const list = http.get('https://staging.example.com/api/products');
  check(list, {'products 200': (r) => r.status === 200});
  sleep(Math.random() * 3);                        // think time

  const order = http.post('https://staging.example.com/api/orders',
    JSON.stringify({sku: 'WIDGET-1', qty: 1}),
    {headers: {'Content-Type': 'application/json'}});
  check(order, {'order 201': (r) => r.status === 201});
  sleep(Math.random() * 5);
}
```

`thresholds` is what makes it a test: k6 exits non-zero when one is breached, so CI can
gate on it. The ramp matters because failures cluster at the transition — connection
pools fill, autoscaling lags, caches are cold.

## The four ways a load test lies

**1. No warmup.** The first requests hit an unoptimised JIT and cold caches. Without
`-w`, a 30-second run reports the average of a slow start and a fast middle, and the
number moves between runs.

**2. The load generator is the bottleneck.** 10 000 connections from one laptop
measures the laptop. If latency rises with no server-side CPU or I/O increase, suspect
the client — run the generator on separate hardware and watch its own resource use.

**3. One hot row, or one cached response.** Hammering `/api/products/1` measures your
cache. Real traffic spreads across keys with a long tail. Parameterise the requests.

**4. The average.** A 45 ms mean can contain a 4-second p99. Report **p50, p95, p99 and
max**, and treat p99 as the number that describes user experience — with 100 requests
per page load, most sessions hit the tail.

## What to assert

| Metric | A sane starting threshold |
|---|---|
| p99 latency | under your SLO — 300 ms is a common API target |
| Error rate | under 1%, and **zero** 5xx |
| Throughput | at or above expected peak, with headroom |
| Event loop lag under load | under 50 ms ([Phase 10](../phase-10-observability/09-event-loop-lag.md)) |
| Memory after the run | back near baseline — a rise is a leak ([Phase 10](../phase-10-observability/17-memory-leaks.md)) |

The last two matter as much as latency and are usually forgotten. A service that meets
its p99 while its event loop lag climbs to 400 ms is one traffic step away from failing,
and a run that ends with memory 300 MB above baseline has found a leak that a functional
test never will.

## Where it runs

**Not in the PR pipeline** — it takes minutes, needs a dedicated environment, and its
numbers move with whatever else runs on the host. Nightly against staging, or before a
release, with results tracked over time so a regression is visible as a trend rather
than as one alarming number.

Load test the environment you care about. A test against a laptop with a container
database tells you about your laptop.

## Related, and different

- **Stress test** — increase load until it breaks, to learn *where* and *how*. Ideally
  it degrades (queues, sheds load) rather than falling over.
- **Soak test** — moderate load for hours, to find leaks and connection exhaustion.
  The one that catches the bug nothing else does.
- **Spike test** — instant 10× load, to test autoscaling and cold starts.

## Gotchas

**Symptom:** Every run gives a different number
**Cause:** No warmup, a noisy host, or a shared environment.
**Fix:** `-w`, a quiet dedicated host, and report percentiles across repeated runs.

**Symptom:** Latency rises but the server is idle
**Cause:** The load generator is saturated.
**Fix:** Run it elsewhere and monitor its own CPU and file descriptors.

**Symptom:** Great numbers, poor real-world performance
**Cause:** One URL, one cached row.
**Fix:** Parameterise requests across a realistic key distribution; add think time.

**Symptom:** p50 is fine and users complain
**Cause:** Reporting the average.
**Fix:** Report p99 and max; a page making 100 requests hits the tail every time.

**Symptom:** The service is fine during the test and falls over after it
**Cause:** A leak or exhausted pool that only shows over time.
**Fix:** A soak test, and check memory and handle counts after the run.

**Symptom:** Load tests make CI flaky
**Cause:** They are in the PR pipeline.
**Fix:** Move them to a nightly job against staging and track the trend.

## Interview questions

**★ What does a load test tell you that a functional test cannot?**
Behaviour under concurrency: queueing, pool exhaustion, event loop lag, GC pressure,
and where latency stops being linear. Functional tests run one request at a time, so
none of that is observable.

**★ Why is the average latency the wrong number?**
Because it hides the tail. A 45 ms mean can contain a 4-second p99, and a page making
100 requests hits the p99 on almost every load. Report p50, p95, p99 and max.

**★ Why does a load test need a warmup?**
The first requests run against an unoptimised JIT and cold caches, so a run without
warmup averages a slow start with a fast middle and the number moves between runs.

**★ How do you know the load generator is not the bottleneck?**
Latency rises while server CPU and I/O stay flat. Run the generator on separate
hardware and monitor its own resources; one laptop cannot honestly generate very high
concurrency.

**autocannon or k6?**
autocannon for a quick single-endpoint answer, and it is scriptable enough to assert
on. k6 when the shape matters — ramps, user journeys, think time, and thresholds that
make the run exit non-zero so CI can gate on it.

**What should you check after a load test, not during it?**
Memory back near baseline and handle counts stable. A run that ends 300 MB above
baseline has found a leak, which is the thing a soak test exists to surface.

---

← Prev: [17 · Property-based and mutation testing](./17-property-and-mutation.md) ·
Next → [19 · Contract testing](./19-contract-testing.md)
