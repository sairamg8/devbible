---
title: "The poll phase"
sidebar_label: "02 · The poll phase"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**The phase where a server spends 99% of its life — asleep, holding zero CPU,
waiting for the kernel to say something happened.**

## What it does

Poll has two jobs, in this order:

1. **Run I/O callbacks** that are ready — a file read finished, a socket has bytes,
   a DNS lookup returned.
2. **Then decide whether to block**, and for how long.

That second job is the interesting one, because it is what makes Node cheap to run
idle.

## How it decides to block

When the poll queue is empty, Node asks: is there anything else to do?

| Situation | What poll does |
|---|---|
| `setImmediate` callbacks are pending | **Do not block.** Move to check immediately |
| A timer is due soon | **Block, but only until that timer is due** |
| Neither, but handles are active | **Block indefinitely** until the OS reports I/O |
| Nothing active at all | Exit the loop — the process ends |

That third row is where an idle server sits. It is a single `epoll_wait` (Linux),
`kqueue` (macOS) or IOCP (Windows) call, and the thread is genuinely suspended —
the OS scheduler will not run it until a socket becomes readable.

```js
// poll.cjs
const { monitorEventLoopDelay } = require('node:perf_hooks');
const h = monitorEventLoopDelay({ resolution: 10 });
h.enable();

const t0 = Date.now();
setTimeout(() => {
  h.disable();
  console.log('elapsed wall time:', Date.now() - t0, 'ms');
  console.log('loop was idle, not spinning — max delay:', Math.round(h.max / 1e6), 'ms');
}, 300);
```

```console
$ node poll.cjs
elapsed wall time: 300 ms
loop was idle, not spinning — max delay: 11 ms
```

300ms passed and the loop stayed responsive throughout. Node was not polling in a
busy loop for 300ms; it asked the kernel to wake it when the timer was due.

**This is why one Node process handles thousands of idle connections.** Ten
thousand open sockets with no traffic cost ten thousand file descriptors and
almost no CPU, because they are all parked in one blocking call. Compare a
thread-per-connection server, where each idle connection costs a thread and its
stack.

## Why "the loop is blocked" is different from "poll is blocking"

Two very different things share the word:

| | Poll blocking | Event loop blocked |
|---|---|---|
| What is happening | Waiting on the kernel for I/O | Your JavaScript is running a long computation |
| CPU | ~0% | 100% of one core |
| New I/O | Wakes the loop instantly | Ignored until your code returns |
| Healthy? | **Yes — this is the design** | No — every request is stalled |

Poll blocking is the loop doing its job efficiently. A blocked event loop is your
code refusing to yield. The diagnostic that distinguishes them is event loop
delay: near zero while poll is waiting, large while JavaScript is hogging the
thread. That measurement is in
[blocking the event loop](../phase-0-runtime-model/03-blocking-the-event-loop.md)
and again in [CPU-bound work](22-cpu-bound-work.md).

## The timeout is why `setTimeout` is a floor

Poll computes its block duration from the nearest due timer. If a timer is due in
5ms, it blocks for at most 5ms. But two things push the actual firing later:

- **The block only ends when the OS returns.** Timer resolution is milliseconds,
  not microseconds.
- **The loop must finish the current phase and reach the timers phase.** Anything
  slow in between delays it.

Which is why `setTimeout(fn, 100)` means "no sooner than 100ms," never "at 100ms."

## Where the thread pool fits

Poll is about **sockets**, which the OS can watch natively. File reads, DNS
lookups via `dns.lookup`, `crypto.pbkdf2` and `zlib` cannot be watched that way —
they are handed to the [libuv thread
pool](../phase-0-runtime-model/04-libuv-thread-pool.md), and when a pool thread
finishes, it signals the loop, which wakes poll and runs your callback.

So a file read *appears* in the poll phase even though no socket was involved. The
practical consequence is the one from Phase 0: saturating the pool with four slow
file reads delays everything else that needs it, while ten thousand sockets do not
compete for it at all.

## Gotchas

**Symptom:** CPU sits at 100% with no traffic
**Cause:** Not poll. Something is spinning — a recursive `setImmediate`, a busy
`while` loop, or a `setInterval(fn, 0)`.
**Fix:** Profile it. `node --cpu-prof` or `--prof`. Poll never burns CPU while
idle.

**Symptom:** Timers fire late under load
**Cause:** The loop cannot reach the timers phase because callbacks elsewhere are
long-running.
**Fix:** Find the long callback. The timer is the symptom, not the cause.

**Symptom:** A file read is slow only when the server is busy
**Cause:** Thread pool saturation, not poll. All four threads are occupied.
**Fix:** `UV_THREADPOOL_SIZE`, or reduce pool-using work. See the
[thread pool](../phase-0-runtime-model/04-libuv-thread-pool.md).

**Symptom:** The process exits immediately despite pending work
**Cause:** Nothing registered an active handle — for example, all timers were
`unref()`ed.
**Fix:** Check `process.getActiveResourcesInfo()`.

## Interview questions

**★ What happens in the poll phase?**
It runs I/O callbacks that are ready, then decides whether to block waiting for
more. If `setImmediate` callbacks are pending it does not block at all; if a timer
is due soon it blocks until then; otherwise it blocks indefinitely on the OS
notification mechanism until I/O arrives.

**★ Why can Node handle thousands of idle connections on one thread?**
Because all of them are watched by a single blocking kernel call — `epoll`,
`kqueue` or IOCP. Idle sockets cost a file descriptor, not a thread or a stack,
and the process consumes essentially no CPU while waiting.

**★ What is the difference between the poll phase blocking and the event loop
being blocked?**
Poll blocking is the loop sleeping in a kernel call with ~0% CPU, ready to wake
the instant I/O arrives — the intended design. A blocked event loop is JavaScript
occupying the thread so no callback of any kind can run. Event loop delay
distinguishes them: near zero in the first case, large in the second.

**★ Why is a `setTimeout` delay a minimum rather than an exact time?**
Poll blocks only until the nearest timer is due, then the loop must finish the
current phase and reach the timers phase. Any slow callback in between pushes it
later, and timer resolution is milliseconds regardless.

**How does a file read end up in the poll phase if no socket is involved?**
libuv runs it on a thread pool thread and signals the loop on completion. Poll
wakes and dispatches the callback, so it looks like I/O even though the OS could
not watch it natively.

---

← Prev: [The event loop phases](01-event-loop-phases.md) · Next → [Microtasks and macrotasks](03-microtasks-and-macrotasks.md)
