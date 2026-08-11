---
title: "Event loop lag — the single most important health metric"
sidebar_label: "09 · Event loop lag"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** — `monitorEventLoopDelay` from `node:perf_hooks`.

**Event loop lag is how late the loop is for work that should have run already — and
it is the metric that turns "the server feels slow" into a number you can alert on.**

CPU saturation, sync crypto, a clogged stdout, a giant `JSON.parse` — they all show
up here first. Request latency can hide behind client retries; lag is the process
telling you it cannot keep up with its own timers.

## What the histogram measures

```js
import {monitorEventLoopDelay} from 'node:perf_hooks';

const h = monitorEventLoopDelay({resolution: 10}); // ms between samples
h.enable();
// … serve traffic …
h.disable();

console.log({
  p50: (h.percentile(50) / 1e6).toFixed(2) + 'ms',
  p99: (h.percentile(99) / 1e6).toFixed(2) + 'ms',
  max: (h.max / 1e6).toFixed(2) + 'ms',
});
```

Values are **nanoseconds** in the histogram. Divide by `1e6` for milliseconds.

Measured idle and under deliberate blocks on this machine:

```console
idle (resolution 10)         p50 10.13ms  p99 10.27ms  max 10.29ms
after one 100ms block        p50 10.13ms  p99 10.29ms  max 115.34ms
after 5x 100ms blocks        p50 10.13ms  p99 108.66ms  max 115.34ms
idle (resolution 1)          p50  1.08ms  p99  1.22ms  max  1.25ms
after one 200ms block        p50  1.08ms  p99  1.24ms  max 201.33ms
```

Two facts that change how you read the number:

**The idle p50 is roughly the sampling resolution, not "real lag".** At
`resolution: 10`, idle p50 sits near 10 ms. Alerting on "p50 > 5 ms" at that
resolution is alerting on arithmetic. Use a finer resolution if you care about
small delays, or alert on **max / p99**, not on a floor you set yourself.

**A single stall is invisible in percentiles until it is frequent.** One 100 ms
block moved only **max** (10.29 → 115.34 ms). Five blocks raised **p99** to
~109 ms. `max` is the smoke alarm; p99 is the trend.

## How to use it in production

1. Enable a process-wide histogram at boot (or use your metrics library's loop lag).
2. Export **p99 and max** every scrape interval; reset or use a sliding window so one
   incident does not poison the rest of the day.
3. Alert on **max above a hard budget** (e.g. 100–250 ms) for pages, and on **p99
   rising** for gradual saturation.
4. Correlate with CPU, active handles, and slow-endpoint logs — lag says *that* you
   are stuck, not *why*.

## What lag is not

| Symptom | Lag? | Usually |
|---|---|---|
| Downstream API is slow | No (I/O wait) | Timeout budgets ([Phase 7](../phase-7-background-work/12-timeout-budgets.md)) |
| Sync bcrypt / image resize on the loop | Yes | Queue or worker ([Phase 7](../phase-7-background-work/01-sync-vs-background.md)) |
| Event loop free but all workers busy | Maybe low | Concurrency limits / pool size |
| GC thrashing | Yes, bursts | Heap size and allocation rate (page 21) |

## Gotchas

**Symptom:** Alerts fire constantly on "healthy" idle pods
**Cause:** Threshold below the histogram resolution floor
**Fix:** Raise the threshold above resolution, or lower `resolution` and re-baseline

**Symptom:** One user-visible hang never appears in p99
**Cause:** Single sample; percentiles need repeated stalls
**Fix:** Alert on `max` as well as p99

**Symptom:** `h.reset()` right before a sync block shows no spike
**Cause:** Reset clears samples; the block ends before the next sample window closes
**Fix:** Leave the histogram running through the work; sample after a short settle

**Symptom:** Lag looks fine but HTTP p99 is terrible
**Cause:** Waiting on network, not blocking the loop
**Fix:** Separate latency metrics and dependency timeouts from loop health

**Symptom:** Lag spikes only during log storms
**Cause:** Backpressure on stdout/stderr under load
**Fix:** Async structured logger ([page 01](./01-structured-logging.md))

## Interview questions

**★ What is event loop lag, and why does Node care more than a threaded runtime?**
It is delay between when a timer or I/O callback was due and when it actually ran.
One thread runs all JS — if the loop is late, every request on that process is late.

**★ Why is idle p50 near 10 ms with `resolution: 10`?**
The histogram samples on that interval; the floor of the distribution is the resolution
itself, not proof of 10 ms of real work.

**★ max moved after one block; p99 did not. What does that mean?**
A rare stall. Percentiles need frequency. Use max for spikes and p99 for sustained load.

**How do you wire this into Prometheus?**
Expose histogram quantiles (or precomputed p50/p99/max gauges) on `/metrics` each
scrape (page 14). Do not log every sample.

**What do you do when lag is high?**
Find the sync work: CPU profiles (page 19), eliminate blocking handlers, move work
off the request path, check GC and logging backpressure.

---

← Prev: [Trace events and reports](./08-trace-events-and-reports.md) · Next → Health checks
