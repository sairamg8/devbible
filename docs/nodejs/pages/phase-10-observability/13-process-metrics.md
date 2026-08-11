---
title: "Process metrics — RSS, heap, handles"
sidebar_label: "13 · Process metrics"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** — `process.memoryUsage()`,
> `v8.getHeapStatistics()`, idle process baseline on this host.

**RSS tells you what the OS charged the process; heap used tells you what V8 thinks
it allocated; active handles tell you why the process has not exited. You need all
three to debug "memory is high" without guessing.**

## memoryUsage

```js
import process from 'node:process';

console.log(process.memoryUsage());
// {
//   rss, heapTotal, heapUsed, external, arrayBuffers
// }
console.log(process.memoryUsage.rss()); // rss only, slightly cheaper
```

Measured on an idle script on this machine (bytes; order of magnitude is the point):

```console
rss:        ~52 MB
heapTotal:  ~6–7 MB
heapUsed:   ~5 MB
external:   ~2 MB
```

| Field | Meaning |
|---|---|
| **rss** | Resident set — pages in RAM. Includes heap, stacks, code, native addons |
| **heapTotal** | V8 heap reserved |
| **heapUsed** | V8 heap currently live |
| **external** | C++ objects bound to JS (Buffer backing stores, etc.) |
| **arrayBuffers** | ArrayBuffer / SharedArrayBuffer memory |

**RSS can be high while heapUsed is flat** — native addons, thread pool, or the OS
not reclaiming free pages. **heapUsed climbing over hours with flat traffic** is the
leak signal (pages 17–18).

## V8 heap statistics

```js
import v8 from 'node:v8';

const s = v8.getHeapStatistics();
console.log({
  heap_size_limit: s.heap_size_limit,
  total_heap_size: s.total_heap_size,
  used_heap_size: s.used_heap_size,
});
```

Default `heap_size_limit` on this host was **~4288 MB**. With
`--max-old-space-size=256` the reported limit was **448 MB**, not 256 — the limit
covers more than old space alone (page 21).

## Handles and requests

```js
// useful in diagnostics; underscore APIs are not a public stability contract
const handles = process._getActiveHandles?.() ?? [];
const requests = process._getActiveRequests?.() ?? [];
console.log(handles.length, requests.length);
```

Idle process here reported **2 handles, 0 requests**. Open servers, timers, sockets,
and watchers keep the loop alive — that is correct for a server and a bug for a CLI
that should exit.

Prefer documented diagnostics (`process.report`, why-is-node-running style tools) in
production forensics over depending on underscore APIs in app code.

## resourceUsage

```js
console.log(process.resourceUsage());
// userCPUTime, systemCPUTime, maxRSS, fsRead, fsWrite, …
```

Good for **CPU attribution** over a window (user vs system) and cumulative FS ops —
export deltas between scrapes, not absolute counters alone.

## What to export

| Metric | Why |
|---|---|
| `nodejs_heap_size_used_bytes` | Leak and GC pressure |
| `nodejs_heap_size_total_bytes` | Heap growth vs used |
| `process_resident_memory_bytes` | OS-level RAM / cgroup limits |
| Active handles (if available) | "Why won't it exit" / runaway sockets |
| Event loop lag | Saturation ([page 09](./09-event-loop-lag.md)) |

## Gotchas

**Symptom:** Container OOMKilled while heapUsed looks fine
**Cause:** RSS / native memory / off-heap buffers hit the cgroup limit
**Fix:** Watch RSS and cgroup metrics, not only V8 heap

**Symptom:** heapTotal grows then plateaus; team panics
**Cause:** V8 reserves heap; growth is not the same as a leak
**Fix:** Watch **heapUsed trend** under stable load; use snapshots if it never returns

**Symptom:** Process never exits in tests
**Cause:** Open handle (server, timer, Redis client)
**Fix:** Close clients in `after`; list active handles in the failure path

**Symptom:** `external` dominates memory
**Cause:** Large Buffers or native bindings
**Fix:** Stream instead of buffer; bound concurrency on binary work

## Interview questions

**★ RSS vs heapUsed — which do you alert on for OOM risk in Kubernetes?**
RSS (and cgroup memory). The kubelet kills on container memory, not V8's opinion.

**What does a slowly rising heapUsed under constant traffic suggest?**
A leak or an unbounded cache — capture heap snapshots (page 17).

**Why might RSS be much larger than heapTotal?**
Native code, stacks, free lists not returned to the OS, external buffers, worker
threads.

**How does `--max-old-space-size` show up in metrics?**
It shapes `heap_size_limit` (and OOM behaviour when the old space cannot grow). The
limit number is not always equal to the flag value.

**Name three process metrics you want on a Node dashboard.**
Heap used, RSS, event loop lag — then pool wait and HTTP latency.

---

← Prev: [perf_hooks](./12-perf-hooks.md) · Next → [Prometheus metrics](./14-prometheus-metrics.md)
