---
title: "02 · Shared memory and Atomics"
sidebar_label: "02 · Shared memory and `Atomics`"
sidebar_position: 2
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-15 against MDN — [`SharedArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer), [`SharedArrayBuffer.prototype.grow()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer/grow), [`Atomics`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics), [`Atomics.wait()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics/wait), [`Atomics.waitAsync()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics/waitAsync), [`Atomics.compareExchange()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics/compareExchange), [`WebAssembly.Memory`](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory). Documentation-validated; **no timings and no console output**.

With [cross-origin isolation](./01-cross-origin-isolation.md) in place, JavaScript gets something it
has never had anywhere else: **two agents holding the same bytes at the same time.** Everything
awkward about the API follows from that being genuinely dangerous.

## Sharing, not sending

```js
const sab = new SharedArrayBuffer(1024);
const view = new Int32Array(sab);

worker.postMessage(sab);      // 🔴 shared — not copied, and NOT transferred
view[0] = 42;                 // the worker sees the same memory
```

This is the third `postMessage` behaviour, and the one people get wrong:

| Kind | What happens |
|---|---|
| Ordinary value | **structured clone** — a copy; changes on one side are invisible on the other |
| `ArrayBuffer` in a transfer list | **transferred** — moved; the sender's buffer is detached |
| `SharedArrayBuffer` | **shared** — both sides hold the same memory, and the sender keeps it |

⚠️ **A `SharedArrayBuffer` is not a `Transferable`.** There is no detaching it, no taking it back,
and no way to know who else is reading it — which is exactly why the rest of this page exists.

**Growable, never shrinkable:**

```js
const sab = new SharedArrayBuffer(1024, { maxByteLength: 2048 });
sab.growable;        // true
sab.grow(1536);      // new bytes are zeroed
```

Growth is capped by `maxByteLength` and one-directional — shrinking is prohibited for security
reasons, and it gives JavaScript parity with WebAssembly's linear memory.

## Plain reads and writes are not enough

🔴 **A write in one agent is not immediately visible in another.** MDN says so directly: changes to
shared memory propagate depending on the CPU, the OS and the engine. `view[0] = 42` in a worker may
sit in a register or a cache line for an unbounded time, and the reader may see a stale value — or,
for a multi-byte value, a torn one.

`Atomics` is the fix: operations that are indivisible and that establish ordering.

```js
Atomics.store(view, 0, 42);          // a write everyone will see
Atomics.load(view, 0);               // a read that is not stale
Atomics.add(view, 1, 1);             // read-modify-write, returns the OLD value
Atomics.compareExchange(view, 0, expected, next);   // the primitive locks are built from
```

| Group | Methods |
|---|---|
| Read / write | `load`, `store`, `exchange` |
| Arithmetic | `add`, `sub` |
| Bitwise | `and`, `or`, `xor` |
| Conditional | `compareExchange` |
| Blocking | `wait`, `notify`, `waitAsync` |
| Utility | `isLockFree`, `pause` |

They operate on integer typed-array views over the buffer — an `Int32Array` is the usual choice
because that is what `wait`/`notify` work with.

## Waiting, and the main-thread rule

```js
// inside a WORKER
const result = Atomics.wait(view, 0, expected);   // 'ok' | 'not-equal' | 'timed-out'
```

🔴 **`Atomics.wait()` is not allowed on the browser's main thread and throws if you try it.** It
blocks the agent — which on the main thread means the page stops: no rendering, no input, no event
loop. The whole design of the web platform says that cannot be allowed, so the API enforces it.

```js
// anywhere, including the main thread
const { async, value } = Atomics.waitAsync(view, 0, expected);
if (async) value.then((r) => { /* 'ok' | 'timed-out' */ });
```

`waitAsync` is the non-blocking counterpart: it hands back a promise-like result instead of
stopping the agent, and it is what the main thread uses to be notified that a worker changed a
value.

`Atomics.notify(view, index, count)` wakes waiters and returns **how many it woke** — which is
usually the only feedback you get that anyone was listening.

## What you are signing up for

Shared memory brings the classic concurrency problems into JavaScript for the first time — the
language's usual guarantee, *"my function runs to completion without interference"*, does not hold
for shared bytes:

- **Data races.** Two agents writing the same location without atomics is undefined behaviour in
  practice, and it will be intermittent and machine-dependent.
- **Locks are yours to build.** `compareExchange` plus `wait`/`notify` is a mutex you write and
  debug yourself — including the deadlocks
  ([15 · Cross-tab coordination](../15-cross-tab-coordination/README.md) is the *easy* kind of
  locking by comparison).
- **Debugging is genuinely hard.** A race that appears on one machine under load and never in
  development is the normal experience, and there is no `console.log` that observes the interleaving
  without changing it.

🔴 **So the honest recommendation stands: almost nobody should write this by hand.** The mainstream
use is not hand-rolled JavaScript threading — it is **WebAssembly**: `new WebAssembly.Memory({
initial, maximum, shared: true })` is backed by a `SharedArrayBuffer`, and the toolchain that
compiled the C++ or Rust already knows how to use it correctly. Your job is to ship the headers and
the fallback.

## The decision, one more time

| Need | Reach for |
|---|---|
| Move a big buffer to a worker | `postMessage` with a **transfer list** ([07 · 02](../07-web-workers/02-the-message-boundary.md)) |
| Several workers reading one large dataset simultaneously | `SharedArrayBuffer` + `Atomics.load` |
| A compiled multi-threaded library | `WebAssembly.Memory({ shared: true })` |
| Coordination between tabs | Web Locks ([15 · 02](../15-cross-tab-coordination/02-web-locks.md)) |
| Anything else | messages — they are copies for a reason |

## Gotchas

**Symptom: the worker's write is never seen by the reader.**
Cause — plain property access on the view; visibility is not guaranteed.
Fix — `Atomics.store`/`Atomics.load` for anything shared between agents.

**Symptom: `TypeError` from `Atomics.wait`.**
Cause — called on the main thread, where blocking is forbidden.
Fix — `Atomics.waitAsync` on the main thread; keep `wait` inside workers.

**Symptom: `postMessage` with a transfer list throws for a `SharedArrayBuffer`.**
Cause — it is shared, not transferable.
Fix — post it without a transfer list.

**Symptom: `grow()` throws or does nothing.**
Cause — the buffer was not created with `maxByteLength`, or the new size is smaller.
Fix — create it growable; buffers can only grow.

**Symptom: a counter is occasionally short under load.**
Cause — `view[i]++` is three separate operations.
Fix — `Atomics.add`.

**Symptom: everything deadlocks on one machine only.**
Cause — a hand-written lock with an ordering bug.
Fix — reduce the shared surface, use a timeout on `wait`, and prefer message passing for anything
that does not truly need shared memory.

## Interview questions

**★ How is a `SharedArrayBuffer` different from a transferred `ArrayBuffer`?**
A transfer *moves* the buffer and detaches it from the sender; sharing gives both agents the same
memory simultaneously and detaches nothing. A `SharedArrayBuffer` is not transferable at all.

**★ Why is `Atomics` necessary if the memory is already shared?**
Because ordinary reads and writes have no visibility or ordering guarantee across agents, and
read-modify-write sequences are not indivisible. `Atomics` provides both.

**★ Why can't the main thread call `Atomics.wait()`?**
Because it blocks the agent, which would freeze rendering and input. It throws on the main thread;
`Atomics.waitAsync` is the non-blocking alternative.

**★ What does `Atomics.compareExchange` give you?**
The compare-and-swap primitive — write only if the current value is what you expected — which is
what every lock-free structure and hand-written mutex is built from.

**★ Who actually uses shared memory on the web?**
Mostly WebAssembly: a compiled multi-threaded library backed by `WebAssembly.Memory({ shared: true
})`. Hand-written JavaScript threading is rare, and for most worker use a transferred `ArrayBuffer`
is both sufficient and far safer.

---

← [01 · Cross-origin isolation](./01-cross-origin-isolation.md) · [Topic index](./README.md)
