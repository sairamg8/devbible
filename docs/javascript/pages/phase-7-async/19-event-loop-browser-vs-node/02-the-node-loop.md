---
title: "02 · The Node loop and its phases"
sidebar_label: "02 · The Node loop"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against the Node.js guide [*The Node.js Event Loop*](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick) and the API docs — [`process.nextTick()`](https://nodejs.org/api/process.html#processnexttickcallback-args), [`timers` § `setImmediate()`](https://nodejs.org/api/timers.html#setimmediatecallback-args), [`worker_threads`](https://nodejs.org/api/worker_threads.html). Documentation-validated; **no timings, no console blocks**.

Node has no rendering step and no frames. What it has instead is **phases**: the loop makes a
full circuit through a fixed sequence, and each phase has its own queue of callbacks.

## The six phases, in order

| Phase | What runs there |
|---|---|
| **timers** | callbacks scheduled by `setTimeout` and `setInterval` whose threshold has elapsed |
| **pending callbacks** | some system-level I/O callbacks deferred from the previous turn |
| **idle, prepare** | internal to Node — you never schedule here |
| **poll** | retrieve new I/O events and run their callbacks; **this is where the loop waits** |
| **check** | `setImmediate` callbacks |
| **close callbacks** | `'close'` handlers, e.g. `socket.on('close', …)` |

Then it starts again at timers. **The poll phase is where a mostly-idle server spends its life** —
it blocks there waiting for connections, disk reads and sockets, and wakes when one is ready.

🔴 **A phase runs its whole queue before the loop moves on** (subject to Node's internal limits),
so the phase structure is what makes `setImmediate` and `setTimeout(fn, 0)` genuinely different
things rather than two spellings of the same thing.

## `setImmediate` versus `setTimeout(fn, 0)`

**At the top level of a program the order is not guaranteed.** Node's own documentation says so
plainly: which one runs first depends on process performance, because it depends on how long the
loop took to start relative to the timer's threshold. Code that relies on it is flaky by
construction.

**Inside an I/O callback, the order *is* guaranteed** — `setImmediate` runs first:

```js
fs.readFile(file, () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));   // ✅ always first, from inside I/O
});
```

The reason is positional: an I/O callback runs in the **poll** phase, and **check** is the very
next phase, while **timers** comes only after the loop has gone all the way round.

⚠️ **The name is backwards from what it suggests.** `setImmediate` does not run immediately — it
runs at the next check phase. `process.nextTick` is the one that runs almost immediately, and it
is not a phase at all.

## `process.nextTick` sits outside the phases

```js
process.nextTick(fn);
```

Its queue is drained **after the current operation completes, regardless of which phase the loop
is in** — and, critically, **before the promise microtask queue**. So:

```js
Promise.resolve().then(() => console.log('promise'));
process.nextTick(() => console.log('nextTick'));
// nextTick, then promise — the nextTick queue is drained first
```

🔴 **This makes `process.nextTick` starve-prone in the same way microtasks are, only more so.**
A recursive `nextTick` never lets the loop advance a phase, so I/O and timers are frozen while
the CPU spins. Node's documentation recommends **`queueMicrotask` for new code** unless you
specifically need `nextTick`'s ordering.

**The one place `nextTick` genuinely earns its keep** is letting a caller attach handlers before
an event fires — emitting after construction returns, so the user has had a chance to call
`.on('error', …)`. That is the Node-flavoured version of the "make a conditionally-async API
always async" pattern from
[03 · Using microtasks](../03-microtasks-vs-macrotasks/02-using-microtasks.md).

## Where the drains happen

Between phases — and, in modern Node, between *each callback* — the runtime empties the
`nextTick` queue and then the promise microtask queue. What this means for you:

**The microtask guarantee holds in Node exactly as in the browser.** `.then` and `await`
continuations run before the loop moves on to more phase work, so every ordering claim in
[03 · The drain order](../03-microtasks-vs-macrotasks/01-the-drain-order.md) is portable.

**What is *not* portable is everything phase-shaped**: `setImmediate`, `process.nextTick`, and the
relative order of a timer against an I/O callback. Those are runtime features, not language
features.

## No rendering, and what takes its place

The browser's rendering step has no Node equivalent — nothing paints, nothing observes layout,
`requestAnimationFrame` does not exist. But the *problem* the rendering step exposes does have an
equivalent, and it is worse in Node:

🔴 **A long synchronous task blocks the whole server, not just one user.** In a browser, blocking
the loop freezes one tab. In Node, it stalls every in-flight request on that process — the poll
phase cannot accept connections while your JSON parse is running.

| The problem | Browser answer | Node answer |
|---|---|---|
| CPU-heavy work | Web Worker | `worker_threads`, or a child process |
| Yield mid-task | `setTimeout(fn, 0)`, `scheduler.yield()` | `setImmediate` |
| Never block | avoid sync APIs | avoid `fs.readFileSync`, sync crypto, big sync JSON |
| Scale beyond one core | — | cluster / multiple processes |

**`setImmediate` is Node's yield.** Chunk a long loop, `setImmediate` between chunks, and the poll
phase gets to serve requests in between — the same shape as chunking with a task in the browser.

⚠️ **Node's I/O is asynchronous, but not all of it is on the loop.** File system work and some
crypto and compression run on a thread pool (`UV_THREADPOOL_SIZE`, four threads by default), so a
burst of file reads can queue behind each other even though nothing is "blocking". Sockets do not
use the pool.

## Gotchas

**Symptom: `setTimeout(fn, 0)` and `setImmediate` swap order between runs.**
Cause — at the top level the order genuinely is not guaranteed.
Fix — do not depend on it; inside an I/O callback `setImmediate` is deterministic.

**Symptom: a `.then` scheduled first runs after a later `process.nextTick`.**
Cause — the `nextTick` queue is drained before the promise microtask queue.
Fix — expected behaviour; use `queueMicrotask` if you want normal microtask ordering.

**Symptom: the server stops responding while one request runs.**
Cause — synchronous CPU work blocking the loop; the poll phase cannot accept anything.
Fix — `worker_threads` for CPU work, `setImmediate` to yield between chunks.

**Symptom: a recursive `process.nextTick` freezes the process with no loop in the profile.**
Cause — the `nextTick` queue never empties, so the loop never advances a phase.
Fix — `setImmediate` to advance the loop, or restructure the recursion.

**Symptom: parallel file reads do not get faster past a handful.**
Cause — file I/O runs on the thread pool, four threads by default.
Fix — raise `UV_THREADPOOL_SIZE` deliberately, or reduce the fan-out.

**Symptom: an `'error'` event emitted in a constructor is never caught.**
Cause — it fired before the caller could attach a listener.
Fix — defer the emit with `process.nextTick` (or `queueMicrotask`).

**Symptom: code that worked in the browser has different ordering in Node.**
Cause — it depended on `setImmediate`, `nextTick`, or a timer-versus-I/O order.
Fix — depend only on the microtask-before-task guarantee, which both share.

## Interview questions

**★ Name Node's event loop phases.**
timers, pending callbacks, idle/prepare (internal), poll, check, close callbacks — then round
again. Poll is where the loop waits for I/O; check is where `setImmediate` runs.

**★ `setImmediate` or `setTimeout(fn, 0)` — which runs first?**
At the top level it is not guaranteed and depends on process timing. Inside an I/O callback,
`setImmediate` always wins, because check is the phase immediately after poll.

**★ How does `process.nextTick` differ from `queueMicrotask`?**
Its queue is drained after the current operation regardless of phase, and **before** the promise
microtask queue. Node recommends `queueMicrotask` for new code unless you need that ordering.

**★ What does blocking the loop cost in Node compared with a browser?**
In a browser it freezes one tab. In Node it stalls every concurrent request on the process,
because the poll phase cannot accept or progress I/O.

**★ Which parts of the event loop are portable between Node and the browser?**
The microtask guarantee — microtasks drain before the loop continues — and one task at a time
with no preemption. Phases, `setImmediate` and `nextTick` are Node-only.

**★ Is all Node I/O on the event loop?**
No. File system, and some crypto and compression, use a thread pool of four by default. Network
sockets do not.

**What is Node's equivalent of yielding to let the UI paint?**
`setImmediate` between chunks — it lets the loop reach the poll phase and serve other work.

---

← [01 · The browser loop](./01-the-browser-loop.md) · [Topic index](./README.md) ·
[03 · Writing code that survives both](./03-writing-for-both.md) →
