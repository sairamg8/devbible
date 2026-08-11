---
title: "CPU-bound work"
sidebar_label: "22 · CPU-bound work"
sidebar_position: 22
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS). Timings are from one machine —
> the *shape* reproduces everywhere, the exact milliseconds will not.

**Everything in this phase assumed your code yields. CPU-bound work does not — it
holds the single thread and every other request waits. This is Node's one genuine
weakness, and the fix is never `async`.**

## Recognising it

The tell is work that is **busy**, not **waiting**:

| Waiting (fine) | Busy (blocks everything) |
|---|---|
| Database query | JSON parse of a 50MB payload |
| HTTP request | Image resize, PDF render |
| File read | `bcrypt`, `scrypt`, key derivation |
| Timer | Sorting or aggregating 10⁶ rows |
| Queue consume | Regex backtracking on hostile input |

Waiting is handed to the OS and the loop moves on —
[single thread and I/O](../phase-0-runtime-model/02-single-thread-and-io.md).
Busy work runs *on* the loop thread, and nothing else can run until it finishes.

**`async` does not help.** Marking a synchronous function `async` changes when it
returns, not whether it blocks. There is no `await` that makes a `for` loop yield.

## Measuring the damage

A heartbeat timer every 20ms shows exactly what a caller experiences:

```js
// heartbeat.mjs
import { Worker } from 'node:worker_threads';

function hash(n) { let x = 0; for (let i = 0; i < n; i++) x = (x * 31 + i) % 1e9; return x; }
const TOTAL = 4e7, CHUNKS = 30;

async function measure(label, run) {
  let beats = 0, worst = 0, last = Date.now();
  const hb = setInterval(() => {
    const d = Date.now() - last; last = Date.now();
    worst = Math.max(worst, d); beats++;
  }, 20);
  const t = Date.now();
  await run();
  clearInterval(hb);
  console.log(`${label.padEnd(9)} ${String(Date.now() - t).padStart(4)}ms | heartbeats ${String(beats).padStart(2)} | worst gap ${String(worst).padStart(4)}ms`);
}

await measure('blocking', async () => { hash(TOTAL); });

await measure('chunked', async () => {
  for (let i = 0; i < CHUNKS; i++) {
    hash(TOTAL / CHUNKS);
    await new Promise(r => setImmediate(r));
  }
});

await measure('worker', () => new Promise((resolve, reject) => {
  const w = new Worker(new URL('./hashwork.mjs', import.meta.url), { workerData: TOTAL });
  w.on('message', resolve); w.on('error', reject);
}));
```

```js
// hashwork.mjs
import { parentPort, workerData } from 'node:worker_threads';
function hash(n) { let x = 0; for (let i = 0; i < n; i++) x = (x * 31 + i) % 1e9; return x; }
parentPort.postMessage(hash(workerData));
```

```console
$ node heartbeat.mjs
blocking  1205ms | heartbeats  0 | worst gap    0ms
chunked   1226ms | heartbeats 30 | worst gap   45ms
worker    1306ms | heartbeats 64 | worst gap   21ms
```

Over four runs: blocking 1172–1245ms, chunked worst gap 40–49ms, worker 63–65
heartbeats. The absolute numbers move a little; the three-way ordering does not.

Read the **heartbeats** column, not the total time:

- **blocking — 0 heartbeats.** The interval was due 60 times and fired *never*. For
  1.2 seconds the process was dead to the world: no requests served, no health check
  answered, no timers.
- **chunked — 30 heartbeats, worst gap 45ms.** Responsive, at the cost of a slightly
  longer total.
- **worker — 64 heartbeats, worst gap 21ms.** The loop is essentially undisturbed;
  20ms was the interval, so 21ms is as good as it gets.

Note also that `worst gap 0ms` for the blocking case is not "no delay" — it is
**no data**. The measuring timer could not run either. Any in-process metric that
depends on a timer has this blind spot, which is worth remembering when reading
[event loop delay](../phase-0-runtime-model/03-blocking-the-event-loop.md) numbers: a
fully blocked loop can look healthy right up until it stops reporting.

## Escape hatch 1 — chunking

Split the work and yield between pieces:

```js
for (let i = 0; i < CHUNKS; i++) {
  doOneChunk(i);
  await new Promise(r => setImmediate(r));    // let the loop drain
}
```

`setImmediate` yields to the **check** phase, so pending I/O callbacks run first —
that is why it is right here and `setTimeout(0)` is not
([page 04](04-setimmediate-vs-settimeout.md)).

- **Good for:** work that splits naturally — batches of rows, pages of a document.
- **Costs:** total time goes up slightly, and you still consume the only thread —
  throughput is unchanged, only latency for others improves.
- **Chunk size:** aim for ~10–50ms per chunk. Much smaller and the yields dominate;
  much larger and the gaps become visible.

## Escape hatch 2 — worker threads

Real parallelism, on another thread:

```js
const w = new Worker(new URL('./hashwork.mjs', import.meta.url), { workerData: TOTAL });
w.on('message', resolve);
w.on('error', reject);
```

- **Good for:** sustained CPU work — image processing, crypto, big parses.
- **Costs:** spawning is expensive (tens of milliseconds), so **use a pool** —
  `piscina` is the standard one; do not spawn per request.
- **Data crosses by copy** via structured clone. Large payloads pay for it; use
  `ArrayBuffer` transfer or `SharedArrayBuffer` when that matters.
- Workers do not share memory or module state — no shared caches or globals.

## Escape hatch 3 — do not do it in Node

Often the right answer:

| Situation | Better home |
|---|---|
| Long batch job | A queue and a separate worker process |
| Image / video processing | A dedicated service, or `sharp` (its work is in native code, off-thread) |
| Heavy aggregation over rows | The database — it is built for it |
| Password hashing | The **async** form of `bcrypt`/`argon2`, which uses the thread pool |

That last row is the most common real fix. `crypto.pbkdf2`, `scrypt` and the async
bcrypt bindings run on the [libuv thread pool](../phase-0-runtime-model/04-libuv-thread-pool.md),
not the loop — the synchronous variants (`pbkdf2Sync`) block it. Choosing the async
API is a one-word change that removes the problem.

## Choosing

```text
Is the work CPU-bound?
├─ No  → nothing to do
└─ Yes → Does a native/async API already exist?   → use it (crypto async, sharp)
         ├─ No → Does it split into chunks?
         │       ├─ Yes, and it is occasional     → chunk with setImmediate
         │       └─ No, or it is sustained        → worker pool (piscina)
         └─ Is it a long batch job?               → move it out of the request path
```

## Gotchas

**Symptom:** Health checks fail and the process is restarted under load, with no
error
**Cause:** The loop was blocked; the health endpoint never got to run.
**Fix:** Find the blocking work — chunk it or move it to a worker.

**Symptom:** Making a function `async` did not help
**Cause:** `async` affects the return value, not whether the body blocks.
**Fix:** Chunk it or move it off-thread. There is no `await` that yields inside a
tight loop.

**Symptom:** Event loop delay metrics look fine, then the process stops responding
**Cause:** The metric is sampled by a timer, which cannot fire while blocked.
**Fix:** Treat *missing* samples as the signal, as the heartbeat demo shows.

**Symptom:** Worker threads made everything slower
**Cause:** Spawning per task, or copying large payloads across the boundary.
**Fix:** A pool; transfer `ArrayBuffer`s instead of copying.

**Symptom:** One request with a large body stalls all others
**Cause:** `JSON.parse` on a large payload — it is synchronous and unyielding.
**Fix:** Limit body size; stream-parse when large payloads are legitimate.

**Symptom:** Latency spikes only on certain user input
**Cause:** Catastrophic regex backtracking (ReDoS).
**Fix:** Rewrite the pattern to avoid nested quantifiers; bound input length.

## Interview questions

**★ Why is CPU-bound work a problem in Node specifically?**
JavaScript runs on one thread, and the event loop is that thread. I/O is delegated
to the OS so the loop stays free, but computation runs on the loop itself — while it
runs, no other request, timer or callback can be handled at all.

**★ Does making a function `async` stop it blocking?**
No. `async` changes the return value to a promise and allows `await` inside; it does
not make synchronous code yield. A tight loop in an async function blocks exactly as
much as in a sync one.

**★ How do you keep the loop responsive during unavoidable CPU work?**
Split it into chunks of roughly 10–50ms and `await` a `setImmediate` between them,
which lets the loop drain pending I/O. It does not increase throughput — the thread
is still yours — but it bounds the latency other work experiences.

**★ When do you reach for worker threads instead of chunking?**
When the work is sustained rather than occasional, or does not split cleanly.
Workers give real parallelism on another thread, but spawning is expensive and data
is copied across the boundary, so use a pool and keep payloads small.

**★ Why can event loop delay metrics miss a fully blocked loop?**
They are sampled by a timer, which cannot fire while the loop is blocked. The
heartbeat demo shows a 1.2-second block reporting a worst gap of 0ms — because it
recorded no samples at all. Missing data is the signal.

**What is the cheapest fix for a service that is slow because of password hashing?**
Use the asynchronous API. `crypto.scrypt`, `pbkdf2` and the async bcrypt bindings run
on the libuv thread pool rather than the event loop; only the `*Sync` variants block.

---

← Prev: [async_hooks](21-async-hooks.md) · Next → *(end of Phase 2)*
