---
title: "GC basics — generational collection and --max-old-space-size"
sidebar_label: "21 · GC basics"
sidebar_position: 21
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** — default `heap_size_limit`, limit under
> `--max-old-space-size=256`, and GC PerformanceObserver entry shape.

**V8 frees memory you can no longer reach. You do not call free. You do control how
large the heap may grow, how much garbage you allocate, and whether GC pauses show up
as event-loop lag.**

## Generational idea (enough to operate)

V8 treats **new objects** as likely short-lived (young generation / scavenges) and
**objects that survive** as old generation (mark-sweep / mark-compact style major GC).

- Lots of short-lived objects → frequent **minor** GCs (usually cheap).  
- Growing old space → **major** GCs (more expensive pauses).  
- Pauses can appear as **event loop lag** spikes ([page 09](./09-event-loop-lag.md)).

You rarely tune generations by hand in app code. You **reduce retention** (pages 17–18)
and **size the process** for the host.

## --max-old-space-size

```bash
node --max-old-space-size=256 app.js   # megabytes of old-space budget (approx)
```

Measured on this host:

```console
default heap_size_limit           ~4288 MB
--max-old-space-size=256 limit    ~448 MB
```

**The reported `heap_size_limit` is not always equal to the flag.** The limit covers
more than old space alone — here 256 MB old-space setting produced a **448 MB**
limit. Treat the flag as a dial, remeasure with `v8.getHeapStatistics()` on your
Node version.

```js
import v8 from 'node:v8';
console.log(v8.getHeapStatistics().heap_size_limit / 1024 / 1024, 'MB limit');
```

**Too low** → `JavaScript heap out of memory` under legitimate load.  
**Too high on a small container** → RSS can grow until the **cgroup OOMKiller** fires
before V8 hits its limit — the kernel does not care about your flag.

## Watching GC

```js
import {PerformanceObserver} from 'node:perf_hooks';

const obs = new PerformanceObserver((list) => {
  for (const e of list.getEntries()) {
    // e.duration in ms; e.detail.kind distinguishes major/minor etc.
    console.log(e.duration, e.detail);
  }
});
obs.observe({entryTypes: ['gc'], buffered: true});
```

Sample entry on this runtime: `duration ~1.3 ms`, `detail: {"kind":1,"flags":0}` for a
minor collection under light load ([page 12](./12-perf-hooks.md)).

## Operational rules

| Practice | Why |
|---|---|
| Size heap from real RSS under load, leave headroom for cgroup | Avoid dual limits fighting |
| Prefer fewer long-lived huge objects | Less old-space pressure |
| Do not allocate multi-MB strings per request if you can stream | Young gen thrash becomes lag |
| Alert on lag + heap used, not on GC count alone | Count without pause cost is vanity |

## Gotchas

**Symptom:** OOM in Kubernetes with "plenty" of heap left in V8 stats
**Cause:** cgroup memory limit below RSS including off-heap
**Fix:** Align `--max-old-space-size` and container limits; watch RSS

**Symptom:** Setting a huge old space "for performance"
**Cause:** Longer major GC pauses, larger blast radius
**Fix:** Right-size; fix leaks instead of hiding them in a 8 GB heap

**Symptom:** `global.gc is not a function`
**Cause:** Need `node --expose-gc` for manual GC (debug only)
**Fix:** Do not rely on manual GC in production app logic

## Interview questions

**★ What does `--max-old-space-size` control?**
Roughly the old-space heap budget for V8. Hitting it yields heap OOM; it is not a
cgroup RSS limit.

**★ Why might heap_size_limit be 448 MB when you passed 256?**
The limit includes more than old space; always read `getHeapStatistics()` on your
version rather than assuming equality.

**How does GC show up as user-facing latency?**
Pauses delay the event loop — lag and request latency spike during heavy collections.

**Young vs old generation in one line?**
New objects start young and cheap to collect; survivors age into a larger, costlier space.

**What is the first fix for GC thrashing?**
Allocate less and retain less — not only raising the heap flag.

---

← Prev: [Benchmarking](./20-benchmarking.md) · Next → [Flame graphs](./22-flame-graphs.md)
