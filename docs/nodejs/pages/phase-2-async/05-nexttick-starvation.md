---
title: "nextTick starvation"
sidebar_label: "05 · nextTick starvation"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**A recursive `process.nextTick` stops the event loop forever, at 100% CPU, with
no error and no way in. It is the one starvation bug that cannot be waited out.**

## The failure

```js
// starve-forever.cjs
setTimeout(() => console.log('THIS NEVER PRINTS'), 0);
function loop() { process.nextTick(loop); }
loop();
```

```console
$ timeout 3 node starve-forever.cjs
$ echo $?
124        # still running — the timer never fired
```

No output. No crash. The process runs until something kills it.

The cause is the drain rule from [page 03](03-microtasks-and-macrotasks.md): **the
nextTick queue is drained to exhaustion, including entries added during draining.**
Each `loop()` adds another entry before the queue can empty, so it never empties,
so the event loop never advances past the checkpoint. Timers, I/O and
`setImmediate` are all unreachable.

## It is a spectrum, not a binary

Even bounded recursion delays everything until it finishes:

```js
// starve.cjs
const start = Date.now();
let ticks = 0;

setTimeout(() => console.log('timer finally ran after', Date.now() - start, 'ms'), 0);
setImmediate(() => console.log('immediate ran'));

function recurse() {
  if (++ticks > 1_000_000) {
    console.log('stopped recursing after', ticks, 'ticks,', Date.now() - start, 'ms');
    return;
  }
  process.nextTick(recurse);
}
recurse();
```

```console
$ node starve.cjs
stopped recursing after 1000001 ticks, 190 ms
timer finally ran after 195 ms
immediate ran
```

The timer was scheduled first and ran last, 195ms late. During that window the
server accepted nothing, answered nothing and logged nothing.

## `setImmediate` has the same shape and does not starve

```js
// nostarve.cjs
const start = Date.now();
let n = 0;
setTimeout(() => console.log('timer ran after', Date.now() - start, 'ms, n =', n), 0);
function recurse() {
  if (++n > 1_000_000) return;
  setImmediate(recurse);
}
recurse();
```

```console
$ node nostarve.cjs
timer ran after 1 ms, n = 19
```

The timer fired after **1ms**, having let only 19 iterations through. `setImmediate`
schedules into the **check phase**, which gets one turn per lap — so the loop
completes a lap, visits timers, and everything stays alive.

**That is the whole fix: recursion belongs on `setImmediate`, never on
`nextTick`.**

| | recursive `nextTick` | recursive `setImmediate` |
|---|---|---|
| Loop advances | never | every iteration |
| Timers fire | never | on schedule |
| I/O is served | never | yes |
| CPU | 100%, no progress | 100%, but the app works |

## Where this shows up in real code

It is rarely written as an obvious `loop()`. The realistic versions:

- **A recursive queue drain** — `processNext()` calls `process.nextTick(processNext)`
  while items remain, and items keep arriving.
- **A retry wrapper** that defers with `nextTick` and retries a permanently failing
  operation.
- **A library** doing it internally. Your code looks innocent; the profile shows
  100% CPU in one function.

Symptom in production: the process is alive, healthchecks time out, CPU is pinned,
and no request completes. Restarting "fixes" it until the same input arrives.

## Diagnosing it

The event loop delay histogram will not help — it cannot sample while the loop is
starved. What works:

```console
$ node --cpu-prof app.js       # writes a .cpuprofile; the hot frame is the recursion
$ kill -SIGUSR1 <pid>          # opens the inspector on a running process
```

Then attach a debugger and pause. The stack shows the recursive function
immediately.

## Gotchas

**Symptom:** Process pinned at 100% CPU, healthchecks failing, no logs
**Cause:** A recursive `nextTick` that never terminates.
**Fix:** Change the recursion to `setImmediate`. Confirm with `--cpu-prof`.

**Symptom:** Timers fire hundreds of milliseconds late under specific input
**Cause:** Bounded `nextTick` recursion with a large bound.
**Fix:** `setImmediate`, and cap the batch size per turn.

**Symptom:** Adding `await` inside the recursion did not help
**Cause:** `await` yields to the microtask queue, which is also drained before the
loop advances. Neither queue returns control to the loop.
**Fix:** `await setImmediate()` from `node:timers/promises` — a real phase yield.

**Symptom:** It only happens in production
**Cause:** The recursion is bounded by queue depth, and production has more items.
**Fix:** Same fix. Load-test the drain path.

## Interview questions

**★ What is `nextTick` starvation?**
Recursively scheduling `process.nextTick` so the nextTick queue never empties.
Because that queue is drained to exhaustion — including entries added while
draining — before the event loop advances, timers, I/O and `setImmediate` never
run. The process stays alive at 100% CPU and does nothing.

**★ Why does the same pattern with `setImmediate` not starve the loop?**
`setImmediate` schedules into the check phase, which gets one turn per lap of the
loop. Each iteration lets the loop complete a full lap, so timers fire and I/O is
serviced between iterations.

**★ Why will an event loop delay metric not detect it?**
The metric is sampled by a timer, and timers never run while the loop is starved.
It reports nothing rather than a large number. Use a CPU profile or attach the
inspector instead.

**★ Can you fix it with `await`?**
No. `await` yields to the microtask queue, which — like the nextTick queue — is
drained before the loop advances. The fix has to be a real phase yield:
`setImmediate`, or `await setImmediate()` from `node:timers/promises`.

**Is recursion with `nextTick` ever correct?**
Only when it is bounded and small — a handful of iterations to defer work past the
current stack. Anything driven by queue depth or retries should use
`setImmediate`.

---

← Prev: [setImmediate vs setTimeout](04-setimmediate-vs-settimeout.md) · Next → [Timers](06-timers.md)
