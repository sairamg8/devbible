---
title: "worker_threads"
sidebar_label: "24 · worker_threads"
sidebar_position: 24
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS), 8-core Linux host.

**Real OS threads, each with its own V8 isolate and event loop, inside one
process. They exist for one reason: CPU-bound JavaScript that would otherwise
block the event loop. They are not a way to make I/O faster.**

Why CPU work must leave the main thread at all is
[Phase 2, page 22](../phase-2-async/22-cpu-bound-work.md). This page is the
mechanism and the pool.

## What they cost

```console
$ node startup.mjs
worker thread ready:  min 57 ms, median 59 ms, max 69 ms
forked process ready: min 53 ms, median 56 ms, max 58 ms
parent RSS with 4 worker threads: 90 MB (baseline 67 MB)
bare node RSS: 49 MB
```

**Startup is not the advantage** — a worker takes about as long to become ready as
a forked process, because each one boots a fresh V8 isolate. The advantages are
memory (four threads added 23 MB to the parent, against roughly 49 MB *each* for
four processes) and the ability to share memory instead of copying it
([page 25](25-shared-memory.md)).

Either way, ~60 ms and several megabytes means **you do not create a worker per
request**. You create a pool at startup.

## The mechanism

```js
import { Worker, isMainThread, parentPort, workerData, threadId } from 'node:worker_threads';

if (isMainThread) {
  const worker = new Worker(new URL(import.meta.url), { workerData: { rows } });
  worker.on('message', (result) => resolve(result));
  worker.on('error', (err) => reject(err));               // ALWAYS handle this
  worker.on('exit', (code) => { if (code !== 0) reject(new Error(`worker exit ${code}`)); });
} else {
  parentPort.postMessage(expensive(workerData.rows));
}
```

The same file runs in both roles, branching on `isMainThread` — the usual layout,
though a separate file is clearer once the worker grows.

What is **not** shared: globals, module state, the require cache, `process.env`
mutations. Each thread is effectively a separate program that happens to share an
address space. What *is* shared: `SharedArrayBuffer`, and the process — so
`process.exit()` in a worker exits **the whole process**, and `process.chdir()` is
unavailable in workers for the same reason.

Messages use the structured clone algorithm — better than IPC's JSON
([page 21](21-ipc.md)), preserving `Map`, `Set`, `Date` and typed arrays — but
still a **copy**. Two ways to avoid the copy:

```js
worker.postMessage(buf, [buf]);        // transfer: zero-copy, sender loses it
```

```console
$ node wt.mjs
transferred 8 MB: worker sees 8388608 bytes, sender now sees 0 (detached)
```

The sender's buffer is **detached** — `byteLength` becomes 0. Transfer when
ownership moves; `SharedArrayBuffer` when both sides need it at once.

## A pool

```js
// pool.js — fixed workers, a queue, one promise per task
import { Worker } from 'node:worker_threads';
import { availableParallelism } from 'node:os';

export function createPool(file, size = Math.max(1, availableParallelism() - 1)) {
  const idle = [], queue = [], all = [];

  const spawn = () => {
    const w = new Worker(file);
    w.on('error', (err) => { w.currentReject?.(err); retire(w); });
    w.on('exit', () => retire(w));
    all.push(w); idle.push(w); return w;
  };
  const retire = (w) => {
    const i = all.indexOf(w); if (i >= 0) all.splice(i, 1);
    const j = idle.indexOf(w); if (j >= 0) idle.splice(j, 1);
    spawn(); pump();                                    // replace it, keep going
  };
  const pump = () => {
    while (idle.length && queue.length) {
      const w = idle.pop(), task = queue.shift();
      w.currentReject = task.reject;
      w.once('message', (result) => { w.currentReject = null; idle.push(w); task.resolve(result); pump(); });
      w.postMessage(task.payload);
    }
  };

  for (let i = 0; i < size; i++) spawn();
  return {
    run: (payload) => new Promise((resolve, reject) => { queue.push({ payload, resolve, reject }); pump(); }),
    close: () => Promise.all(all.map((w) => w.terminate())),
  };
}
```

Four things this gets right that a naive pool does not: workers are created
**once**; tasks **queue** instead of spawning more; a worker that dies is
**replaced** and its in-flight task rejected rather than hanging forever; and
`close()` exists, so [graceful shutdown](17-graceful-shutdown.md) can drain it.

`availableParallelism() - 1` leaves a core for the main thread, which still has to
run the event loop.

**In production, use `piscina`.** It is this plus task cancellation, timeouts,
`AbortSignal` support, resource limits and metrics. The value in reading the code
above is knowing what it is doing for you.

## When not to use one

- **I/O** — `fs`, network and `zlib` are already off-thread
  ([Phase 0](../phase-0-runtime-model/04-libuv-thread-pool.md)). A worker adds
  serialisation and gains nothing.
- **Per-request work of a few milliseconds** — the round trip costs more than the
  work.
- **Concurrency you already have** — parallel `await` is not a thread problem
  ([Phase 2, page 10](../phase-2-async/10-sequential-vs-parallel.md)).

Genuine uses: image and video processing in JS, large JSON parse/stringify,
crypto not covered by `node:crypto`'s async APIs, compression of big in-memory
payloads, template or bundle compilation, and anything measured to block the loop
for more than ~50 ms.

Two footguns worth naming: worker threads **do not increase the libuv thread
pool** — every thread's `fs` and `dns` work still shares those four threads
([page 13](13-dns.md)) — and an unhandled `'error'` event on a `Worker` is thrown
as an uncaught exception, which kills the process.

## Gotchas

**Symptom:** Latency gets *worse* after moving work to a worker
**Cause:** The task was short, or the payload large; serialisation dominates.
**Fix:** Measure first. Move work only when it blocks measurably.

**Symptom:** Memory grows until the process dies
**Cause:** A worker created per request and never terminated.
**Fix:** A fixed pool.

**Symptom:** The whole process exits when one worker finishes
**Cause:** `process.exit()` inside a worker exits the process.
**Fix:** `parentPort.close()`, or return from the worker's top level.

**Symptom:** A worker error crashes the app
**Cause:** No `'error'` listener on the `Worker`.
**Fix:** Handle `'error'` and `'exit'`; reject the in-flight task.

**Symptom:** A task never resolves
**Cause:** The worker died between accepting the task and replying.
**Fix:** Reject in-flight tasks on `'exit'`; add a per-task timeout.

**Symptom:** `fs` in workers is no faster
**Cause:** All threads share the same four libuv pool threads.
**Fix:** `UV_THREADPOOL_SIZE`, or accept the ceiling.

## Interview questions

**★ What problem do worker threads solve?**
CPU-bound JavaScript blocking the single event loop. Each worker has its own V8
isolate and loop, so the work runs in parallel and the main thread keeps serving.
They do nothing for I/O, which is already asynchronous.

**★ Are worker threads faster to start than child processes?**
No — measured at a median 59 ms versus 56 ms, because each still boots a V8
isolate. The real differences are memory (four threads cost ~23 MB against ~196 MB
for four processes) and shared memory, which processes cannot have.

**★ What is shared between threads, and what is not?**
Not shared: globals, module state, the require cache — each thread is effectively
its own program. Shared: `SharedArrayBuffer`, and the process itself, which is why
`process.exit()` in a worker terminates everything.

**★ Copy, transfer, or share?**
`postMessage` copies via structured clone. Passing a buffer in the transfer list
moves it with no copy and detaches it from the sender — verified: 8 MB arrived
intact and the sender's `byteLength` became 0. `SharedArrayBuffer` gives both
sides access at once, and needs `Atomics`.

**Why a pool instead of a worker per task?**
Because creation costs ~60 ms and several megabytes. A fixed pool with a queue
bounds both, and turns a spike into queueing rather than into thread thrash.

**Does adding worker threads speed up file I/O?**
No. `fs` work from every thread shares the same libuv thread pool, so the ceiling
is unchanged.

---

← Prev: [cluster](23-cluster.md) · Next → [Shared memory](25-shared-memory.md)
