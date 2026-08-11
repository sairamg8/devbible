---
title: "The event loop phases"
sidebar_label: "01 · Event loop phases"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS). Every ordering on this page
> was produced by running the script shown.

**One thread, six phases, running in a fixed order, forever. Almost every "why did
that run in that order?" question is answered by knowing which phase a callback
belongs to.**

## The phases, in order

Each turn of the loop — one **tick** — visits the phases in this sequence:

| # | Phase | Runs |
|---|---|---|
| 1 | **timers** | `setTimeout` and `setInterval` callbacks whose time has come |
| 2 | **pending callbacks** | A few deferred system callbacks, mostly TCP errors |
| 3 | **idle, prepare** | Internal to libuv. You never touch this |
| 4 | **poll** | **Waits for I/O**, then runs I/O callbacks — see [the poll phase](02-poll-phase.md) |
| 5 | **check** | `setImmediate` callbacks |
| 6 | **close callbacks** | `'close'` events — `socket.on('close')`, `server.close()` |

Between **every** phase — and between every individual callback — Node drains two
more queues that are not phases at all: `process.nextTick` and microtasks
(promises). Those are [page 03](03-microtasks-and-macrotasks.md), and they are the
reason phase order alone does not predict output.

## Watching it happen

```js
// phases.cjs
const fs = require('node:fs');

console.log('sync');

setTimeout(() => console.log('1 timers'), 0);
setImmediate(() => console.log('2 check'));

fs.readFile(__filename, () => {
  console.log('3 poll — I/O callback');

  process.nextTick(() => console.log('4 nextTick — before anything else'));
  Promise.resolve().then(() => console.log('5 microtask'));
  setImmediate(() => console.log('6 check — always next from poll'));
  setTimeout(() => console.log('7 timers — a full lap later'), 0);
});
```

```console
$ node phases.cjs
sync
2 check
1 timers
3 poll — I/O callback
4 nextTick — before anything else
5 microtask
6 check — always next from poll
7 timers — a full lap later
```

Read that output carefully, because it contains both lessons:

**Lines 2–3 are not stable.** Run it again and `1 timers` and `2 check` swap. From
the main module, `setTimeout(…, 0)` versus `setImmediate` is a genuine race —
[page 04](04-setimmediate-vs-settimeout.md) explains why, and it is a favourite
interview question.

**Lines 4–7 never change.** Once you are inside an I/O callback you are in the poll
phase, and the order that follows is fixed: `nextTick`, then microtasks, then
**check** (which comes right after poll), then **timers** (which requires a whole
new lap of the loop).

## The close phase really is last

```js
// close.cjs
const net = require('node:net');
const server = net.createServer(sock => {
  sock.on('close', () => console.log('close phase: socket close event'));
  setImmediate(() => console.log('check phase: setImmediate'));
  sock.destroy();
});
server.listen(0, () => {
  const c = net.connect(server.address().port, () => c.end());
  setTimeout(() => server.close(), 200);
});
```

```console
$ node close.cjs
check phase: setImmediate
close phase: socket close event
```

`sock.destroy()` is called *before* the `setImmediate`, and the close handler still
runs second. Cleanup callbacks are the last thing in a tick — which matters when a
teardown handler needs to run after in-flight work.

## What keeps the loop alive

The process exits when no phase has anything left to do and nothing is waiting on
I/O. You can ask what is holding it open:

```js
// alive.cjs
const t = setTimeout(() => {}, 1000);
console.log(process.getActiveResourcesInfo());
t.unref();
console.log('after unref:', process.getActiveResourcesInfo());
```

```console
$ node alive.cjs
[ 'Timeout' ]
after unref: []
```

That is the whole answer to "why does my script not exit?" — something is still
registered. An open server, a pending timer, an unresolved socket.
[`unref()`](06-timers.md) removes a handle from that count without cancelling it.

## The model to carry around

1. Run all synchronous code to completion.
2. Drain `nextTick`, then microtasks.
3. Enter the loop. For each phase: run its due callbacks, draining `nextTick` and
   microtasks after each one.
4. In **poll**, if there is nothing to do, **block and wait** for I/O — this is
   where an idle server spends its life.
5. Repeat until nothing is left.

The single most useful consequence: **a callback only runs when the thread is
free.** If your code is in a long `for` loop, none of these phases are being
visited at all, which is why [blocking the event
loop](../phase-0-runtime-model/03-blocking-the-event-loop.md) stalls everything at
once.

## Gotchas

**Symptom:** `setTimeout(fn, 0)` and `setImmediate` fire in a different order each
run
**Cause:** From the main module their order depends on how long process startup
took relative to the timer threshold.
**Fix:** Nothing to fix — do not depend on it. Inside an I/O callback the order is
guaranteed: `setImmediate` first. See [page 04](04-setimmediate-vs-settimeout.md).

**Symptom:** A `setTimeout(fn, 100)` fires noticeably late
**Cause:** The delay is a *minimum*, not a promise. The timers phase only runs when
the loop reaches it, and a long callback elsewhere delays that.
**Fix:** Treat timer delays as floors. If precision matters, measure elapsed time
inside the callback rather than trusting the schedule.

**Symptom:** The process will not exit after work finishes
**Cause:** An active handle — a live `setInterval`, an open server or socket.
**Fix:** `process.getActiveResourcesInfo()` to see what. Then `clearInterval`,
`server.close()`, or `unref()` the handle.

**Symptom:** A `'close'` handler seems to run "too late"
**Cause:** Close callbacks are the final phase of the tick, after check.
**Fix:** Expected behaviour. Put ordering-sensitive teardown inside the close
handler itself rather than racing it.

## Interview questions

**★ Name the event loop phases in order.**
timers → pending callbacks → idle/prepare → poll → check → close callbacks. Timers
run expired `setTimeout`/`setInterval`; poll waits for and runs I/O callbacks;
check runs `setImmediate`; close runs `'close'` events. `nextTick` and microtasks
are drained between every phase and between individual callbacks, so they are not
phases themselves.

**★ Why does `setImmediate` run before `setTimeout` inside an I/O callback?**
Because I/O callbacks run in the poll phase, and check comes immediately after
poll in the same tick. A timer has to wait for the loop to come all the way back
around to the timers phase, a full lap later.

**★ Does `setTimeout(fn, 100)` run after exactly 100ms?**
No. It runs no *earlier* than 100ms, when the loop next reaches the timers phase
and the thread is free. A blocking callback or a busy loop delays it arbitrarily.

**★ What makes a Node process exit?**
The loop having nothing left: no pending timers, no active handles, no outstanding
I/O. `process.getActiveResourcesInfo()` lists what is currently keeping it alive,
and `unref()` excludes a handle from the count.

**Where does a Node server spend most of its time?**
Blocked in the poll phase, waiting on the kernel for socket activity — consuming
no CPU. See [the poll phase](02-poll-phase.md).

---

← Prev: [Phase 2 overview](README.md) · Next → [The poll phase](02-poll-phase.md)
