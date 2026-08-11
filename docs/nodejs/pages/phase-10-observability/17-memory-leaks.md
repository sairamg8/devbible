---
title: "Memory leaks — symptoms, heap snapshots, finding the retainer"
sidebar_label: "17 · Memory leaks"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** — `v8.writeHeapSnapshot()` return shape and
> idle baseline heap.

**A leak in Node is almost always a growing set of objects still reachable from a root
— a Map, a closure, a listener list — not "malloc forgot free". Heap snapshots tell you
what retains the growth; RSS alone only tells you that something is wrong.**

## Symptoms

| What you see | Why it suggests a leak |
|---|---|
| heapUsed climbs under **stable** traffic | Live set not returning after GC |
| RSS climbs until container OOMKill | Process hits cgroup limit |
| Latency and lag worsen over hours | GC thrashing on a huge heap |
| Restart "fixes" it until the same curve returns | Memory state, not a one-shot bug |

Flat traffic is the control. Growth that tracks traffic may be a **working set** or an
unbounded cache you intended poorly — still a bug, different fix (page 16, page 18).

## Capture a heap snapshot

```js
import v8 from 'node:v8';

const file = v8.writeHeapSnapshot();
console.log(file);
// Heap.<timestamp>.<pid>.heapsnapshot
```

Measured: `writeHeapSnapshot()` returns a **string path** to the file. Open it in
Chrome DevTools → Memory → Load.

```bash
node --inspect app.js
# chrome://inspect → take heap snapshot while reproducing growth
```

**Take two snapshots** minutes apart under the same load. Diff them. The classes that
grew in **retained size** are suspects; **shallow size** alone misleads.

## Finding the retainer

In DevTools:

1. Sort the diff by retained size growth.  
2. Open a growing object type.  
3. Walk **retainer path** to a GC root (global, closure, module scope, DOM-less
   equivalents: servers, timers, static Maps).  
4. That path is the bug: something pushed and never removed.

```js
// classic leak shape — module-level Map grows forever
const sessions = new Map();

export function touch(sessionId, data) {
  sessions.set(sessionId, data); // never deleted
}
```

Fix: TTL eviction, LRU with max size, or store sessions in Redis with expiry.

## Comparison discipline

| Do | Do not |
|---|---|
| Same traffic shape for both snapshots | Compare idle boot vs peak traffic and call it a leak |
| Force a quiet moment / `global.gc()` under `--expose-gc` if you need a cleaner diff | Trust one snapshot with no baseline |
| Record heapUsed over time in metrics first | Snapshot only after OOM when the pod is gone |

## Gotchas

**Symptom:** Snapshot file is huge / process stalls while writing
**Cause:** Full heap serialization is expensive
**Fix:** Snapshot on a canary; avoid on every pod during peak

**Symptom:** Diff shows string / array noise
**Cause:** Normal allocation churn
**Fix:** Focus retained size of long-lived structures (Maps, arrays of sockets)

**Symptom:** RSS high, heap snapshot looks fine
**Cause:** Native / external memory, not V8 heap
**Fix:** Check `external`, addons, Buffer pools ([page 13](./13-process-metrics.md))

**Symptom:** Leak only in production
**Cause:** Real traffic cardinality (one entry per user) never seen in dev
**Fix:** Load test with production-like key counts

## Interview questions

**★ How do you confirm a memory leak in Node?**
Stable load, rising heapUsed/RSS over time that does not return after GC; confirm with
two heap snapshots and a retainer path.

**★ What does a retainer path tell you?**
Which reference chain keeps the object alive — the line of code that should have
released it.

**writeHeapSnapshot vs Chrome inspect?**
Both produce the same format idea. `writeHeapSnapshot()` is scriptable in production
canaries; Inspector is interactive.

**Why might restarting the process "fix" memory?**
All JS heap is gone. If the curve returns, the bug is still in the code path.

**Leak vs large cache?**
A cache with a cap is a policy. An unbounded Map is a leak with a product name.

---

← Prev: [Caching strategy](./16-caching-strategy.md) · Next → [Common leak sources](./18-common-leak-sources.md)
