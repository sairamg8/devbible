---
title: "setImmediate vs setTimeout(fn, 0)"
sidebar_label: "04 · setImmediate vs setTimeout"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS). The main-module result below
> is from ten consecutive runs.

**Nondeterministic from the main module. Guaranteed inside an I/O callback. This
is the classic Node interview question and it has a genuinely interesting answer.**

## The race

```js
// race.cjs
setTimeout(() => console.log('setTimeout'), 0);
setImmediate(() => console.log('setImmediate'));
```

Ten runs:

```console
$ for i in $(seq 1 10); do node race.cjs | tr '\n' ' '; echo; done | sort | uniq -c
      7 setImmediate setTimeout
      3 setTimeout setImmediate
```

Neither order is a bug. Both are correct.

### Why it is a coin flip

`setTimeout(fn, 0)` is clamped to **1ms** — there is no true zero delay. So the
outcome depends on how much wall-clock time passed between the timer being
scheduled and the loop reaching the timers phase for the first time:

- Process startup took **≥1ms** → the timer is already due when timers runs →
  `setTimeout` wins.
- Startup took **&lt;1ms** → the timer is not due yet, timers is skipped, poll
  finds pending immediates → `setImmediate` wins.

Startup time varies with machine load, disk cache and what else the process
imported. That is the entire source of the nondeterminism — and it is why the same
script can flip order between two runs a second apart.

## Inside an I/O callback it is deterministic

```js
// ioRace.cjs
const fs = require('node:fs');
fs.readFile(__filename, () => {
  setTimeout(() => console.log('setTimeout'), 0);
  setImmediate(() => console.log('setImmediate'));
});
```

```console
$ for i in $(seq 1 10); do node ioRace.cjs | tr '\n' ' '; echo; done | sort | uniq -c
     10 setImmediate setTimeout
```

Ten out of ten. The reason is [phase order](01-event-loop-phases.md): an I/O
callback runs in **poll**, and **check** comes immediately after poll in the same
lap. A timer must wait for the loop to come all the way around to **timers**.

**Inside any I/O callback, `setImmediate` always runs first.** No exceptions, no
timing dependency.

## Which to use

| Want | Use |
|---|---|
| "Run after the current phase, as soon as possible" | **`setImmediate`** |
| "Yield to the event loop so pending I/O can run" | **`setImmediate`** |
| "Run after roughly N milliseconds" | `setTimeout(fn, N)` |
| "Break up CPU work into chunks" | **`setImmediate`** — see [CPU-bound work](22-cpu-bound-work.md) |
| "Defer before promise continuations" | `process.nextTick` — [page 03](03-microtasks-and-macrotasks.md) |

**`setTimeout(fn, 0)` is almost always the wrong tool.** It reads as "do this
immediately" but means "do this in at least 1ms, on a later lap of the loop."
`setImmediate` says what you mean, runs sooner in the common case, and is
deterministic where it matters.

The one thing `setImmediate` is not: a way to escape a blocked thread. It yields
*between* callbacks, so it only helps if you actually return.

## The name is backwards

Worth saying out loud, because it trips everyone:

- **`setImmediate`** does *not* run immediately — it runs in the check phase.
- **`setTimeout(fn, 0)`** does *not* run at zero — it is clamped to 1ms.

If the names were honest, `setImmediate` would be `setAfterPoll` and
`setTimeout(fn, 0)` would be `setTimeout(fn, 1)`. Judge them by phase, not by
name.

## Gotchas

**Symptom:** Output order changes between runs on the same machine
**Cause:** Main-module `setTimeout(0)` versus `setImmediate` — a genuine race
against process startup time.
**Fix:** Do not depend on it. If order matters, sequence with `await` or nest the
callbacks.

**Symptom:** A test passes locally and fails in CI
**Cause:** Same race. CI machines are slower, so startup more often exceeds 1ms
and the timer wins.
**Fix:** Remove the ordering assumption from the test.

**Symptom:** `setTimeout(fn, 0)` is slower than expected in a tight sequence
**Cause:** Each one costs at least 1ms and a full lap of the loop.
**Fix:** `setImmediate` — same lap, no clamp.

**Symptom:** Chunking work with `setTimeout(fn, 0)` is far slower than expected
**Cause:** 1ms minimum per chunk. A thousand chunks is a second of pure waiting.
**Fix:** `setImmediate`, or `await setImmediate()` from `node:timers/promises`.

## Interview questions

**★ What is the difference between `setImmediate` and `setTimeout(fn, 0)`?**
`setImmediate` schedules into the check phase, which runs right after poll in the
same lap of the loop. `setTimeout(fn, 0)` schedules a timer clamped to 1ms, which
runs in the timers phase on a later lap. From the main module their relative order
is nondeterministic; inside an I/O callback `setImmediate` always wins.

**★ Why is the order nondeterministic from the main module?**
Because `setTimeout(fn, 0)` is really 1ms, and whether it is already due when the
loop first reaches the timers phase depends on how long process startup took. Over
1ms and the timer fires first; under, and poll moves to check with the immediate
pending.

**★ Why is it deterministic inside an I/O callback?**
I/O callbacks run in the poll phase, and check is the very next phase in the same
lap. The timers phase requires a full lap of the loop, so `setImmediate` is always
first.

**★ Which should you use to break up a long computation?**
`setImmediate`. It yields once per lap with no clamp, so the loop can service I/O
between chunks. `setTimeout(fn, 0)` adds at least 1ms of dead time per chunk, and
`await` alone does not yield to the loop at all.

**Does `setImmediate` run immediately?**
No. It runs in the check phase of the current lap — after poll, after any I/O
callbacks. The name is misleading; think of it as "after the current phase."

---

← Prev: [Microtasks and macrotasks](03-microtasks-and-macrotasks.md) · Next → [nextTick starvation](05-nexttick-starvation.md)
