---
title: "Node's two escape hatches from one thread — a worker with a message boundary, or a process with a socket boundary"
sidebar_label: "2b · Node's parallelism"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Node.js
> [`worker_threads`](https://nodejs.org/api/worker_threads.html),
> [`cluster`](https://nodejs.org/api/cluster.html),
> [`child_process`](https://nodejs.org/api/child_process.html) and
> [`os`](https://nodejs.org/api/os.html) documentation.
> Target: **Node.js 24 "Krypton" (Active LTS)**.

**Node's answer to "my work does not fit on one thread" comes in exactly two shapes, and
they are chosen by what has to cross the boundary. `worker_threads` gives you real OS
threads inside one process, each with its own V8 isolate and heap, and the only memory
they genuinely share is a `SharedArrayBuffer` — everything else is a deep copy.
`cluster` and child processes give you separate processes sharing a listening socket.
Neither one gives you what a Java or Go developer means by threads, and neither one is
free. The comparison with Python matters here, because Python's answer to the same
question is a strictly larger menu.**

This is the second half of [chunk 2](02-node-model.md), which established the single
loop and the four-thread libuv pool.

## `worker_threads`: parallelism with a message boundary

When the work is genuinely CPU-bound JavaScript, `worker_threads` gives you real OS
threads — each with its **own V8 isolate, its own event loop, and its own heap**. The
documentation is unusually direct about what they are for:

> "Workers (threads) are useful for performing CPU-intensive JavaScript operations. They
> do not help much with I/O-intensive work. The Node.js built-in asynchronous I/O
> operations are more efficient than Workers can be."
> — [Node.js `worker_threads`](https://nodejs.org/api/worker_threads.html)

And what they can share:

> "Unlike `child_process` or `cluster`, `worker_threads` can share memory. They do so by
> transferring `ArrayBuffer` instances or sharing `SharedArrayBuffer` instances."

That is the whole sharing story:

| Mechanism | What happens | Cost |
|---|---|---|
| `postMessage(obj)` | **structured clone** — a deep copy | proportional to the graph size, paid on the sending thread |
| `postMessage(buf, [buf])` | **transfer** — ownership moves, sender's copy is detached | near-zero, but the sender loses it |
| `SharedArrayBuffer` | **genuinely shared memory** | needs `Atomics` for correctness |
| `workerData` | structured-cloned once, at construction | one copy at startup |

```js
// main.js
import { Worker } from 'node:worker_threads';

function hashInWorker(password) {
  return new Promise((resolve, reject) => {
    const w = new Worker('./hash-worker.js', { workerData: password });
    w.once('message', resolve);
    w.once('error', reject);
    w.once('exit', (code) => { if (code !== 0) reject(new Error(`exit ${code}`)); });
  });
}
```

```js
// hash-worker.js
import { parentPort, workerData } from 'node:worker_threads';
import { pbkdf2Sync, randomBytes } from 'node:crypto';

const salt = randomBytes(16);
parentPort.postMessage(pbkdf2Sync(workerData, salt, 600_000, 32, 'sha512').toString('hex'));
```

**Spawning a worker per request is a mistake.** A worker costs a fresh V8 isolate —
tens of milliseconds and several megabytes of heap. Use a pool (`piscina` is the usual
choice), sized to `os.availableParallelism()`.

```js
import Piscina from 'piscina';
const pool = new Piscina({ filename: new URL('./hash-worker.js', import.meta.url).href });
const hash = await pool.run(password);   // queued onto a reused worker
```

Note `os.availableParallelism()` rather than `os.cpus().length`: the former respects
CPU affinity and container CPU limits, which is what you actually want inside Kubernetes.

## `cluster` and child processes: parallelism with a process boundary

`cluster` forks one process per core, all sharing a listening socket, with connections
distributed between them. It is how a Node service uses more than one core for *request
handling*, as opposed to for one expensive computation.

```js
import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';

if (cluster.isPrimary) {
  for (let i = 0; i < availableParallelism(); i++) cluster.fork();
  cluster.on('exit', () => cluster.fork());   // restart the dead one
} else {
  startServer();
}
```

In practice, most production Node deployments do **not** use `cluster` — they run N
containers or N processes behind a real load balancer, because that gives the same
parallelism plus independent restarts, rolling deploys and per-process memory limits.

This matters for the comparison more than anything else on the page: **the standard Node
scaling story and the standard Python scaling story are the same story** — one process
per core behind a proxy. Neither runtime scales a single process across cores by default.
Anyone arguing that Python "can't use multiple cores" while deploying Node behind
`cluster` or four containers is describing the same architecture twice and only calling
one of them a limitation.

`child_process` is the third door: `spawn` for streaming a long-running external program,
`execFile` for a bounded one, `fork` for another Node program with an IPC channel. It is
what you use when the work is not JavaScript at all — invoking `ffmpeg`, or, quite
commonly in real systems, **invoking a Python script** because the library you need only
exists there.

## Where this leaves the comparison

| | Node | Python (default build) |
|---|---|---|
| In-process I/O concurrency | event loop, one thread | `asyncio` event loop, one thread — **same design** |
| Blocking the loop | one CPU-heavy callback stalls everything | one CPU-heavy coroutine stalls everything — **same failure** |
| Threads for I/O | not the idiom; explicitly discouraged for I/O | `threading` is a normal, supported choice — the GIL is released during I/O |
| CPU parallelism, in-process | `worker_threads`, message-passing only | free-threaded build (3.14+); `concurrent.interpreters` (3.14+) |
| CPU parallelism, cross-process | `cluster` / `child_process` | `multiprocessing` / `ProcessPoolExecutor` |
| Escaping to native code | N-API / node-gyp addons | C extensions, Cython, PyO3 — and the GIL is released while they run |
| Hidden shared thread pool | **yes — libuv's 4, invisible in your code** | yes, but explicit and resizable |

The honest summary of this table: **Node's parallelism story is one model plus two escape
hatches; Python's is four models you must choose between.** Node's is harder to misuse.
Python's has more headroom, and since 3.14 that headroom is officially supported rather
than experimental — which is the subject of the [next chunk](03-python-model.md).

## Gotchas

### Expecting `worker_threads` to share your objects
**Symptom.** A worker mutates the object it received and the main thread never sees the
change; or sending a large object is unexpectedly slow.
**Cause.** `postMessage` structured-clones. The worker got a deep copy, and cloning a
large graph costs real CPU on the sending thread — which is the event loop.
**Fix.** Send the smallest thing that works: an id the worker can fetch for itself, or a
`SharedArrayBuffer` when the data is genuinely numeric and large.

```js
const buf = new SharedArrayBuffer(1024 * 1024);
const view = new Int32Array(buf);
worker.postMessage({ buf });        // shared, not copied
Atomics.store(view, 0, 42);         // and mutation must go through Atomics
```

### A worker per request
**Symptom.** Adding workers makes the service slower and its memory footprint balloons.
**Cause.** Each `new Worker()` builds a V8 isolate from scratch. Under load you are
paying isolate construction more often than you are saving CPU.
**Fix.** A fixed pool, created at boot:

```js
const pool = new Piscina({ filename: workerPath, maxThreads: availableParallelism() });
```

### `os.cpus().length` inside a container
**Symptom.** A pod with a 1-CPU limit forks 64 workers and thrashes.
**Cause.** `os.cpus()` reports the *host's* processors, not the cgroup limit.
**Fix.** `os.availableParallelism()`, which accounts for affinity, or read the limit from
the environment your orchestrator sets. Python has the identical trap: `os.cpu_count()`
reports the host, and `os.process_cpu_count()` (3.13+) is the affinity-aware one.

### One unhandled `throw` kills the whole process
**Symptom.** The container restarts and every in-flight request from every user dies.
**Cause.** One process, one thread, all requests. An uncaught exception in an async
callback — or an unhandled promise rejection, which is fatal by default in modern Node —
takes down the process, not just the request.
**Fix.** Framework-level error handling on every async route, plus a supervisor that
restarts. Worth conceding as a structural downside: a Gunicorn worker dying takes out one
worker's requests, and `cluster` gives Node the same property only if you use it.

```js
process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'unhandled rejection');
  server.close(() => process.exit(1));   // drain, then let the supervisor restart
});
```

### An errored worker that nobody is listening to
**Symptom.** Requests hang forever instead of failing.
**Cause.** A `Worker` that throws emits `'error'`; if you only wired `'message'`, nothing
ever settles the promise.
**Fix.** Always wire all three of `'message'`, `'error'` and `'exit'`, as in the example
above — the `'exit'` handler is what catches a worker that died without throwing, such as
an OOM kill.

### Assuming `cluster` load-balances evenly
**Symptom.** One worker is pinned at 100% while others idle.
**Cause.** On Linux the default distribution is round-robin from the primary, but a
long-lived connection (a WebSocket, an HTTP/2 session, a keep-alive pool) stays on the
worker that accepted it. Round-robin balances *connections*, not *work*.
**Fix.** For long-lived connections, balance at the proxy with a strategy that knows
about them (least-connections), and keep per-connection work bounded.

## Interview questions

**Q. When would you use `worker_threads` rather than `cluster`?**
A. `worker_threads` for one expensive CPU computation you want off the request thread —
image resizing, hashing, a big parse — because threads share a process and can pass
`ArrayBuffer`s cheaply. `cluster`, or just N processes, to scale *request handling*
across cores, because each process gets its own event loop and its own failure domain.

**Q. Do worker threads share memory with the main thread?**
A. Only through `SharedArrayBuffer`, and only with `Atomics` for safe access.
`ArrayBuffer`s can be transferred, which moves ownership and detaches the sender's copy.
Everything else is structured-cloned — a deep copy — because each worker has its own V8
isolate and heap.

**Q. Why do most Node deployments not use `cluster`?**
A. Because containers already provide the same thing with better properties: independent
restarts, rolling deploys, per-process memory limits, and a real load balancer doing the
distribution. `cluster` is mainly useful on a single VM where you control the whole box.

**Q. Someone says "Python can't use multiple cores, so we're using Node." What is wrong
with that sentence?**
A. Two things. First, it is out of date: free-threaded CPython is officially supported as
of 3.14, and `concurrent.interpreters` landed in the same release. Second, and more
importantly, Node's default answer to multiple cores is *also* multiple processes —
`cluster` or N containers — which is exactly what Python does with Gunicorn or four
containers. The two runtimes deploy identically; only one of them gets called limited
for it.

**Q. How does Node's `worker_threads` compare to Python's free-threading?**
A. They solve the same problem from opposite directions. A Node worker is an isolated
heap with a message boundary: safe by construction, but you pay serialisation and cannot
share objects. Free-threaded Python gives threads genuinely shared objects in one heap:
no serialisation, but you inherit every classic data race and need locks. Node's is the
safer default; Python's is the more powerful one, and the more dangerous one.

**Q. You need to call a Python ML model from a Node service. How?**
A. Not by reimplementing it. Either run the model behind its own HTTP or gRPC endpoint —
a Python service you deploy and scale independently, which is the normal answer — or, for
a batch job, `child_process.spawn` the Python program and stream over stdio. The first is
right almost every time, because it lets the two services scale, deploy and fail
independently.

**Q. What is `os.availableParallelism()` and why not `os.cpus().length`?**
A. `availableParallelism()` reports the parallelism actually available to the process,
respecting CPU affinity — so it is correct inside a container with a CPU limit.
`os.cpus().length` reports the host's processor list, which in a 1-CPU pod on a 64-core
node is off by a factor of 64. Python's equivalent pair is `os.process_cpu_count()`
versus `os.cpu_count()`.

---

← Prev: [Node's model](02-node-model.md) · Index: [Python vs Node](README.md) · Next → [Python's four models](03-python-model.md)

{/* FOOTER */}
