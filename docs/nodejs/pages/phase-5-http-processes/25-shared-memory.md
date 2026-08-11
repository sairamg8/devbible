---
title: "Sharing memory between threads"
sidebar_label: "25 · Shared memory"
sidebar_position: 25
---

<span className="db-tier t-when">Learn When Needed</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS), 8-core Linux host.

**`SharedArrayBuffer` is the one piece of memory two threads can touch at the same
time. It removes copying — and hands you every data race that JavaScript has spent
its life not having. Reach for it only when profiling says the copy is the
problem.**

## Three ways to move data

| | Cost | After the call |
|---|---|---|
| `postMessage(obj)` | Structured clone — O(size) | Both sides have their own copy |
| `postMessage(buf, [buf])` | **Zero copy** | Sender's buffer is **detached** |
| `SharedArrayBuffer` | Zero copy, no handoff | Both sides read and write the same bytes |

Transfer covers most real cases: a pipeline stage passing a buffer along has no
further use for it. `SharedArrayBuffer` is for when threads must work on the same
data *concurrently* — a shared counter, a ring buffer, a large matrix several
threads read at once.

## The race is real, and it is not deterministic

Four threads, released together from a barrier, each doing 2 000 000 increments —
one atomic, one not:

```console
$ node race.mjs
  Atomics.add(c,0,1) -> 8000000 of 8000000  (lost: 0)
  c[1]++             -> 6154460 of 8000000  (lost: 1845540)

$ node race.mjs
  Atomics.add(c,0,1) -> 8000000 of 8000000  (lost: 0)
  c[1]++             -> 8000000 of 8000000  (lost: 0)

$ node race.mjs
  Atomics.add(c,0,1) -> 8000000 of 8000000  (lost: 0)
  c[1]++             -> 7312758 of 8000000  (lost: 687242)
```

**Run two lost nothing.** That is the entire danger in one line: `c[1]++` is
read-modify-write, three separate steps, and two threads interleaving between them
lose an update — but only sometimes, depending on scheduling. It passes your test,
passes CI, and corrupts data under production load.

`Atomics.add` was exact in every run. Any location touched by more than one thread
goes through `Atomics`.

## Atomics

```js
const sab = new SharedArrayBuffer(4 * Int32Array.BYTES_PER_ELEMENT);
const view = new Int32Array(sab);                 // a typed-array view, always

Atomics.add(view, 0, 1);                          // returns the PREVIOUS value
Atomics.load(view, 0);
Atomics.store(view, 0, 42);
Atomics.compareExchange(view, 0, expected, next);  // the CAS primitive
Atomics.wait(view, 3, 0, timeoutMs);               // block until the value changes
Atomics.notify(view, 3);                           // wake waiters
```

A `SharedArrayBuffer` is raw bytes; you always work through a typed-array view.
`Atomics` needs an integer view — `Int32Array` or `BigInt64Array` — so floats and
strings cannot be shared atomically. Structured data means encoding it yourself.

**`Atomics.wait` blocks the thread**, which is why it throws on the main thread by
default — blocking the event loop is exactly what workers exist to avoid. It is
for a worker waiting on a barrier or a queue, as in the test above where four
workers waited on a start flag so the race would actually happen.

```js
// the barrier that made the race reproducible
Atomics.add(c, 2, 1); Atomics.notify(c, 2);              // "I have arrived"
while (Atomics.load(c, 3) === 0) Atomics.wait(c, 3, 0, 50);  // wait for the start gun
```

## MessageChannel — a private pipe

```js
const { port1, port2 } = new MessageChannel();
a.postMessage({ port: port1 }, [port1]);
b.postMessage({ port: port2 }, [port2]);
```

```console
$ node sab.mjs
  B received: hello from A (never passed through the main thread)
```

Ports are transferable, so two workers can talk directly instead of relaying
through the main thread — which matters when the main thread is the one you are
trying to keep free. Ports are also how you build request/response over a worker
instead of the fragile "next `'message'` is my answer" pattern.

Each port is a referenced handle: an open port keeps the event loop alive, so
`port.close()` is part of shutdown.

## When it is worth it

Honest answer: rarely in a web application. The data has to be big enough that
copying dominates, and concurrent enough that transfer will not do — image or
audio buffers processed by several threads, a large shared lookup table, a
lock-free ring buffer between a producer and consumers, tight numeric loops over
one array.

The cost is real. Races are non-deterministic and survive code review; there are
no locks, mutexes or condition variables in the standard library, so you build
them from `compareExchange` and `wait`/`notify`; and only numbers can be shared,
so anything structured needs manual encoding. Try transfer first — most "we need
shared memory" turns out to be "we were copying when we could have moved".

One deployment note: `SharedArrayBuffer` is available unconditionally in Node. In
browsers it needs cross-origin isolation headers, so client code that mirrors your
worker code will not simply work.

## Gotchas

**Symptom:** A shared counter is short and the shortfall varies per run
**Cause:** Non-atomic read-modify-write.
**Fix:** `Atomics.add`. Every shared location, every access.

**Symptom:** It works in testing and corrupts data in production
**Cause:** The race needs real concurrency to appear — verified above, where one
run in three lost nothing.
**Fix:** Assume any non-atomic shared write is broken regardless of test results.

**Symptom:** `TypeError` from `Atomics.wait` on the main thread
**Cause:** It blocks, and is disallowed there by default.
**Fix:** Use it only inside workers.

**Symptom:** `postMessage` of a buffer that then reads as empty
**Cause:** It was transferred and is now detached.
**Fix:** Intended for transfer; use `SharedArrayBuffer` if the sender still needs it.

**Symptom:** The process will not exit
**Cause:** An open `MessagePort` keeps the loop alive.
**Fix:** `close()` both ports.

**Symptom:** Strings or objects cannot be put in a `SharedArrayBuffer`
**Cause:** It is raw bytes; `Atomics` needs integer views.
**Fix:** Encode manually, or use transfer instead.

## Interview questions

**★ Why is `counter[0]++` unsafe across threads?**
It is three operations — load, add, store. Two threads can both load the same
value before either stores, and one update is lost. Measured: four threads doing
2 000 000 increments each lost 1 845 540 in one run and **zero** in the next.

**★ What makes that non-determinism the real danger?**
The correct-looking run is indistinguishable from a correct program. A test that
passes proves nothing about a data race, so the only safe rule is that every
shared location is accessed through `Atomics`.

**★ Transfer or share?**
Transfer when ownership moves — zero copy, and the sender's buffer is detached.
Share when both threads need concurrent access, accepting that you now need
`Atomics` and hand-built synchronisation.

**★ Why does `Atomics.wait` throw on the main thread?**
It blocks the calling thread until notified, which would freeze the event loop —
the precise thing worker threads exist to prevent. It is intended for workers
implementing barriers or blocking queues.

**What can't you put in a `SharedArrayBuffer`?**
Anything that is not numeric bytes. It is a raw buffer viewed through typed
arrays, and `Atomics` requires integer views, so strings and objects must be
encoded by hand.

**How do two workers talk without the main thread?**
A `MessageChannel`: transfer one port to each worker. They then communicate
directly, which keeps the main thread's event loop free.

---

← Prev: [worker_threads](24-worker-threads.md) · Next → [Single Executable Applications](26-single-executable-applications.md)
