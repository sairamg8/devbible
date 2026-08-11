---
title: "Timers"
sidebar_label: "06 · Timers"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`setTimeout`, `setInterval`, and the two things that actually matter about them:
the delay is a floor, and a live timer keeps your process alive.**

## The basics, and what they return

```js
// timers.cjs
const t = setTimeout(() => console.log('once'), 100);
const i = setInterval(() => console.log('repeatedly'), 100);

clearTimeout(t);
clearInterval(i);
```

In Node these return a **`Timeout` object**, not a number as in browsers. That
object has methods — `unref()`, `ref()`, `refresh()` — and it is why
`typeof setTimeout(…)` is `'object'` in Node and `'number'` in a browser. Code
that stores a timer id in a typed field, or compares it to a number, breaks when
moved between the two.

## The delay is a minimum

```js
setTimeout(fn, 100);   // "no earlier than 100ms", never "at 100ms"
```

The callback runs when the loop next reaches the [timers
phase](01-event-loop-phases.md) *and* the thread is free. A long callback
elsewhere delays it arbitrarily. Two more specifics worth knowing:

- **`setTimeout(fn, 0)` is clamped to 1ms.** There is no zero delay — see
  [page 04](04-setimmediate-vs-settimeout.md).
- **Delays above 2147483647 ms (~24.8 days) overflow** and fire immediately, with
  a warning. Long schedules need a different mechanism, not a big timer.

For anything where drift matters, measure elapsed time inside the callback rather
than trusting the schedule.

## `setInterval` drifts and overlaps

`setInterval` schedules by *period*, not by completion. If the callback takes
longer than the interval, Node does not run two copies concurrently on one thread
— but the callbacks queue up and the spacing collapses.

The safer pattern for anything that does async work is a self-scheduling timeout:

```js
// poll-loop.mjs
import { setTimeout as sleep } from 'node:timers/promises';

async function pollForever(intervalMs, signal) {
  while (!signal.aborted) {
    try {
      await doWork();                       // however long it takes
    } catch (err) {
      console.error('poll failed', err);    // never let it kill the loop
    }
    await sleep(intervalMs, null, { signal });   // then wait a full interval
  }
}
```

This guarantees a real gap between runs, cannot overlap, surfaces errors, and is
cancellable. `setInterval` gives you none of those.

## `unref()` — a timer that does not hold the process open

An active timer counts as a handle keeping the loop alive. `unref()` removes it
from that count without cancelling it.

```js
// unref.cjs
const t = setInterval(() => console.log('tick'), 500);
t.unref();
setTimeout(() => console.log('done — process exits even though the interval is live'), 1200);
```

```console
$ node unref.cjs
tick
tick
done — process exits even though the interval is live
```

The interval fired twice and the process still exited when the *other* timer
finished. Use `unref()` for background work that should never be the reason a
process stays up — metrics flushes, cache sweeps, heartbeat pings. `ref()` puts it
back.

This is also the answer to "why won't my script exit?":

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

## `node:timers/promises`

The promise-based API, and what you should reach for in async code:

```js
// tp.mjs
import { setTimeout as sleep, setInterval as every, scheduler } from 'node:timers/promises';

const t0 = Date.now();
await sleep(100);
console.log('slept ~100ms:', Date.now() - t0 >= 100);

await scheduler.yield();
console.log('scheduler.yield() resumed');

let n = 0;
for await (const _ of every(50)) { if (++n === 3) break; }
console.log('async interval ran', n, 'times');
```

```console
$ node tp.mjs
slept ~100ms: true
scheduler.yield() resumed
async interval ran 3 times
```

| Export | What it gives you |
|---|---|
| `setTimeout(ms, value, opts)` | A promise resolving after `ms` — the `sleep` everyone writes by hand |
| `setInterval(ms)` | An async iterable, so `for await` replaces callback intervals with `break` as the exit |
| `setImmediate(value, opts)` | Awaitable yield to the check phase — the correct way to chunk CPU work |
| `scheduler.yield()` | Yield to the loop, letting pending work run |
| `scheduler.wait(ms)` | Like `setTimeout`, standards-track naming |

All of them accept `{ signal }`, so they are cancellable —
[AbortSignal](19-abortcontroller.md):

```js
await sleep(5000, null, { signal: AbortSignal.timeout(100) });   // rejects as AbortError
```

**Stop writing `const sleep = ms => new Promise(r => setTimeout(r, ms))`.** The
built-in version is cancellable and does not leak a timer when abandoned.

## Gotchas

**Symptom:** A timer fires much later than its delay
**Cause:** The delay is a floor; the loop was busy elsewhere.
**Fix:** Expected. Find the long callback if the lateness matters.

**Symptom:** `setTimeout` fires instantly with a `TimeoutOverflowWarning`
**Cause:** A delay above ~24.8 days overflows the 32-bit limit.
**Fix:** Schedule in stages, or use an absolute-time check with a shorter repeating
timer.

**Symptom:** The process will not exit after work completes
**Cause:** A live `setInterval` or pending `setTimeout` is holding it open.
**Fix:** `clearInterval`, or `unref()` if the timer is genuinely background.
`process.getActiveResourcesInfo()` names the culprit.

**Symptom:** `setInterval` callbacks bunch up
**Cause:** The callback takes longer than the period, so runs queue with no gap.
**Fix:** Self-scheduling `setTimeout` after the work completes.

**Symptom:** Timer code that worked in a browser breaks in Node
**Cause:** Node returns a `Timeout` object; browsers return a number.
**Fix:** Do not treat the return value as a number. Store it as opaque.

**Symptom:** Cancelling a request leaves a timer running for its full delay
**Cause:** A hand-rolled `sleep` with no signal support.
**Fix:** `setTimeout` from `node:timers/promises` with `{ signal }`.

## Interview questions

**★ Is `setTimeout(fn, 100)` guaranteed to run after exactly 100ms?**
No — it runs no earlier than 100ms. The callback fires when the loop next reaches
the timers phase and the thread is free, so a slow callback elsewhere delays it.
Timer delays are floors.

**★ What does `unref()` do?**
It removes a timer from the set of handles keeping the process alive, without
cancelling it. The timer still fires while the process runs, but it will not by
itself prevent exit. Use it for background maintenance work.

**★ Why does `setTimeout` return an object in Node but a number in a browser?**
Node returns a `Timeout` object carrying `unref()`, `ref()` and `refresh()`.
Browsers return an opaque numeric id. Code that assumes a number is not portable —
treat the return value as opaque.

**★ Why prefer a self-scheduling `setTimeout` over `setInterval` for async work?**
`setInterval` schedules by period regardless of how long the work takes, so slow
runs bunch up with no gap between them. Awaiting the work and then sleeping
guarantees a real interval, cannot overlap, and gives you a natural place to catch
errors.

**★ What does `node:timers/promises` give you over a hand-written `sleep`?**
Cancellation via `{ signal }`, an async-iterable interval that exits with `break`,
and an awaitable `setImmediate` for yielding to the loop. A hand-rolled sleep
cannot be cancelled and leaves its timer pending when abandoned.

**How do you find out why a Node process will not exit?**
`process.getActiveResourcesInfo()` lists the handles keeping the loop alive —
timers, sockets, servers. Then clear, close or `unref()` the one you did not
expect.

---

← Prev: [nextTick starvation](05-nexttick-starvation.md) · Next → [Promise states and chaining](07-promise-states.md)
