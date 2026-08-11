---
title: "Common leak sources — caches, listeners, closures, timers"
sidebar_label: "18 · Common leak sources"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Patterns below are the usual retainer roots
> found in Node services; verify with snapshots ([page 17](./17-memory-leaks.md)).

**Most Node leaks are one of four shapes: an unbounded cache, a listener that is never
removed, a closure that captures a large object, or a timer/socket that is never
cleared. Learn the shapes so the snapshot path looks familiar.**

## 1. Unbounded caches and dictionaries

```js
const responseCache = new Map();

function cachePut(key, value) {
  responseCache.set(key, value); // no max, no TTL
}
```

**Fix:** LRU with a max entry count, TTL eviction, or move to Redis with `maxmemory`
and a policy. Bound by **count and bytes**, not hope.

## 2. Event listeners never removed

```js
// pseudo-code
function attach(userSocket, requestScope) {
  const onData = (buf) => requestScope.push(buf);
  userSocket.on('data', onData);
  // missing: userSocket.off('data', onData) when the request ends
}
```

Each request adds a listener. The socket (or `EventEmitter`) retains them all.

**Fix:** `once`, or explicit `removeListener` / `AbortSignal` to detach; prefer
`stream.finished` / `pipeline` for streams so errors tear down handlers.

## 3. Closures over big objects

```js
function handleUpload(hugeBuffer) {
  setTimeout(() => {
    console.log('upload done', hugeBuffer.length); // retains hugeBuffer
  }, 60_000);
}
```

The timer callback closes over `hugeBuffer` for the full minute even if you only
needed the length.

**Fix:** Close over the **small derived value** (`const n = hugeBuffer.length`), null
out references, or avoid deferring work that needs the whole payload.

## 4. Timers and intervals

```js
const interval = setInterval(() => poll(jobId), 1000);
// if job finishes without clearInterval, poll continues forever
```

**Fix:** `clearInterval` on completion and on failure; store handles where the cleanup
path can reach them. Same for `setTimeout` chains that reschedule themselves.

## 5. Closely related: unclosed handles

Not always a "heap leak" in the V8 sense, but the process never settles:

- `http.Server` / DB pools not closed in tests  
- Redis clients left open  
- `fs.watch` watchers  

RSS stays elevated and `why-is-node-running` points at the handle.

## Quick self-audit checklist

| Area | Question |
|---|---|
| Module-level `Map` / array | Is there a max size and eviction? |
| `on` / `addListener` | Is every path removing the listener? |
| `setInterval` | Who clears it? |
| Per-request objects stored globally | Is the key deleted when the request ends? |
| Logs / error trackers | Are you retaining full request bodies on a ring buffer? |

## Gotchas

**Symptom:** Leak only when a rare error path runs
**Cause:** Cleanup in `try` but not `finally` / error branch
**Fix:** `try/finally` or `AbortSignal` teardown

**Symptom:** "I removed the listener" but heap still grows
**Cause:** Removed a different function reference than the one registered
**Fix:** Hold the same function reference for `on` and `off`

**Symptom:** Bound LRU still grows RSS
**Cause:** Values are huge; entry count bound is not byte bound
**Fix:** Cap value size or total bytes; do not cache large buffers

**Symptom:** Test suite memory climbs across files
**Cause:** Shared module state or open servers between tests
**Fix:** Reset module state; close servers in hooks

## Interview questions

**★ Name four common Node leak sources.**
Unbounded caches, unremoved listeners, closures retaining large objects, uncleared
timers (plus unclosed handles).

**Why does `emitter.on` without `off` leak?**
The emitter retains the function, which retains its closed-over scope.

**How do you bound an in-process cache safely?**
Max entries and/or max bytes, eviction policy (LRU), and often a TTL — never only
"we'll remember to delete".

**Why capture `hugeBuffer.length` instead of `hugeBuffer` in a deferred callback?**
So the large allocation can be GC'd while the timer still runs.

**Where do you look first in a heap snapshot for these bugs?**
Growing `Map` / `Array` / `SomeEmitter` retainer paths to module scope or long-lived
singletons.

---

← Prev: [Memory leaks](./17-memory-leaks.md) · Next → [CPU and heap profiling](./19-cpu-heap-profiling.md)
