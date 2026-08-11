---
title: "perf_hooks — performance.now, marks, measures, PerformanceObserver"
sidebar_label: "12 · perf_hooks"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** — `node:perf_hooks` marks, measures, and GC
> observer entries.

**`node:perf_hooks` is the built-in stopwatch and observer bus for timing work inside
one process — higher resolution than `Date.now()`, and able to watch GC and other
entry types without a third-party APM.**

Use it when you need **in-process** timings: boot phases, a specific handler stage,
or GC pause distribution. Distributed traces are still OpenTelemetry
([page 05](./05-opentelemetry.md)).

## Clocks

```js
import {performance} from 'node:perf_hooks';

const t0 = performance.now(); // ms, fractional, monotonic
// … work …
const ms = performance.now() - t0;
```

`performance.now()` is **monotonic** within the process — it does not jump when the
wall clock is adjusted. Prefer it over `Date.now()` for durations.

## Marks and measures

```js
import {performance} from 'node:perf_hooks';

performance.mark('checkout:start');
// validate, charge, write …
performance.mark('checkout:end');
performance.measure('checkout', 'checkout:start', 'checkout:end');

const [entry] = performance.getEntriesByName('checkout');
console.log(entry.duration); // milliseconds
```

Measured on this machine for a tight `1e6` `Math.sqrt` loop:

```console
measure duration ~7.1 ms
```

Clear entries in long-running processes or the buffer grows:

```js
performance.clearMarks();
performance.clearMeasures();
```

## PerformanceObserver

```js
import {PerformanceObserver, performance, constants} from 'node:perf_hooks';

const obs = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'gc') {
      console.log({
        kind: entry.detail?.kind,
        duration: entry.duration,
      });
    }
  }
});
obs.observe({entryTypes: ['gc'], buffered: true});

// force a sample of the shape (not required in production)
if (global.gc) global.gc();
```

Measured GC entry shape on Node 24.19.0:

```console
entryType: gc | name: gc | duration: ~1.3 ms
detail: {"kind":1,"flags":0}
```

`kind` maps through `constants` (`NODE_PERFORMANCE_GC_MAJOR`, etc.). You rarely
alert on individual GC entries; you histogram **duration** and watch for multi-ms
spikes under load (page 21).

## Event loop delay lives here too

`monitorEventLoopDelay` is also from `node:perf_hooks` — covered in full on
page 09. Same module, different job.

## When not to use it

| Need | Prefer |
|---|---|
| Cross-service request path | OpenTelemetry spans |
| Fleet-wide rates and percentiles | Prometheus metrics (page 14) |
| "Why is this function hot?" under prod load | CPU profile (page 19) |
| One-off script timing | `performance.now()` or `console.time` |

## Gotchas

**Symptom:** Durations go negative or jump wildly
**Cause:** Mixing wall clock (`Date.now`) with assumptions about monotonicity
**Fix:** `performance.now()` for elapsed time only

**Symptom:** Memory creeps up in a long-lived process with lots of marks
**Cause:** Entries retained until cleared
**Fix:** `clearMarks` / `clearMeasures` on a timer, or avoid marks in the hot path

**Symptom:** GC observer never fires
**Cause:** No observation registered, or no GC under light load
**Fix:** `observe({entryTypes:['gc']})`; confirm under allocation pressure

**Symptom:** Measure duration is 0
**Cause:** Marks in the wrong order or cleared early
**Fix:** Mark start before work, end after; measure once; then clear

## Interview questions

**★ Why prefer `performance.now()` over `Date.now()` for timing?**
Monotonic high-resolution clock inside the process — wall clock can step on NTP
adjustments and skew durations.

**What are marks and measures for?**
Named timestamps and the duration between them — boot stages, handler subsections —
without inventing your own Map of numbers.

**How do you observe GC pauses in pure Node?**
`PerformanceObserver` on `entryTypes: ['gc']`; read `entry.duration` (and `detail.kind`).

**Does `perf_hooks` replace APM?**
No. It times *this* process. APM/OTel correlates across services and stores history.

**Where does event loop lag fit?**
Same module: `monitorEventLoopDelay` — see page 09.

---

← Prev: Golden signals · Next → Process metrics
