---
title: "Microtasks, macrotasks and nextTick"
sidebar_label: "03 · Microtasks and macrotasks"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS). Every ordering below was
> produced by running the script shown — including the one that contradicts the
> rule most articles state.

**The full execution picture: call stack, then the two priority queues, then the
event loop phases. Get this and output-order questions stop being guesswork.**

## The pieces

| Mechanism | Queue | When it runs |
|---|---|---|
| Your synchronous code | **call stack** | Now, to completion |
| `process.nextTick(fn)` | **nextTick queue** | As soon as the stack empties — before microtasks |
| `Promise.then` / `await` / `queueMicrotask` | **microtask queue** | After the nextTick queue is empty |
| `setTimeout` / `setInterval` | timers phase | Next lap of the [loop](01-event-loop-phases.md) |
| `setImmediate` | check phase | Same lap, after poll |
| I/O callbacks | poll phase | When the I/O completes |

The last three are **macrotasks** — they belong to event loop phases. The first
two are not phases at all: they are drained *between* every phase and between
every individual callback.

## The rule, and the exception nobody mentions

The rule you will read everywhere is "`process.nextTick` runs before promises."
Here it is holding, in CommonJS:

```js
// order.cjs
console.log('1 sync start');

setTimeout(() => console.log('6 setTimeout 0'), 0);
setImmediate(() => console.log('7 setImmediate'));

Promise.resolve().then(() => console.log('5 promise.then'));
queueMicrotask(() => console.log('4 queueMicrotask'));
process.nextTick(() => console.log('3 nextTick'));

console.log('2 sync end');
```

```console
$ node order.cjs
1 sync start
2 sync end
3 nextTick
5 promise.then
4 queueMicrotask
6 setTimeout 0
7 setImmediate
```

Now run **the identical code** as an ES module:

```console
$ node order.js          # same file, "type": "module"
1 sync start
2 sync end
5 promise.then
4 queueMicrotask
3 nextTick
6 setTimeout 0
7 setImmediate
```

**`nextTick` ran last.** The rule appears to break.

It has not. The mechanism is that **the nextTick queue is only revisited once the
microtask queue is exhausted** — and top-level ESM code is *itself* running inside
a microtask, because module evaluation is a promise job. So a `nextTick` scheduled
there is queued from within a microtask, and the microtask queue drains first.

Two experiments confirm exactly that, both in CommonJS so ESM is not a factor:

```js
// mech.cjs — scheduling from inside a microtask
Promise.resolve().then(() => {
  console.log('A: in microtask');
  process.nextTick(() => console.log('C: nextTick scheduled from microtask'));
  Promise.resolve().then(() => console.log('B: microtask scheduled from microtask'));
});
```

```console
$ node mech.cjs
A: in microtask
B: microtask scheduled from microtask
C: nextTick scheduled from microtask
```

```js
// mech2.cjs — at a normal checkpoint, nextTick wins and drains completely
process.nextTick(() => {
  console.log('tick 1');
  process.nextTick(() => console.log('tick 3 (queued during tick 1)'));
});
process.nextTick(() => console.log('tick 2'));
Promise.resolve().then(() => console.log('micro (after ALL ticks)'));
```

```console
$ node mech2.cjs
tick 1
tick 2
tick 3 (queued during tick 1)
micro (after ALL ticks)
```

Note `tick 3`: a tick queued *during* tick processing still runs before any
microtask. The nextTick queue drains to exhaustion, newly-added entries included —
which is what makes [starvation](05-nexttick-starvation.md) possible.

### The accurate rule

> At a checkpoint, the **nextTick queue drains completely, then the microtask
> queue drains completely**. But once you are already inside a microtask, the
> microtask queue keeps draining first — so a `nextTick` scheduled from a
> microtask (or from ESM top-level code) runs after it.

Inside any ordinary callback, the familiar order is back:

```js
// order2.js — ESM, but scheduled inside a timer callback
setTimeout(() => {
  console.log('--- inside a timer callback ---');
  Promise.resolve().then(() => console.log('promise.then'));
  queueMicrotask(() => console.log('queueMicrotask'));
  process.nextTick(() => console.log('nextTick'));
}, 0);
```

```console
$ node order2.js
--- inside a timer callback ---
nextTick
promise.then
queueMicrotask
```

**Practical takeaway:** never rely on `nextTick` versus promise ordering. It
depends on where you are standing. If two things must happen in a fixed order,
express that with `await`, not with queue priority.

## `nextTick` vs `queueMicrotask`

| | `process.nextTick` | `queueMicrotask` |
|---|---|---|
| Standard | Node-only | Web standard, also in browsers |
| Priority | Higher at a checkpoint | Same queue as promises |
| Starvation risk | **Yes** — recursion blocks the loop forever | Yes, but far less common |
| Use for | Deferring inside Node internals; emitting an event after the constructor returns | Everything else |

**Prefer `queueMicrotask`.** It is portable, it is the same queue your promises
already use, and it does not carry `nextTick`'s starvation footgun. Reach for
`nextTick` only when you specifically need to run before pending promise
continuations.

The classic legitimate `nextTick` use is letting a caller attach listeners before
you emit:

```js
// emitter.cjs
const { EventEmitter } = require('node:events');

class Loader extends EventEmitter {
  load() {
    process.nextTick(() => this.emit('done', 'payload'));   // ✅ caller can subscribe first
    return this;
  }
}

new Loader().load().on('done', (v) => console.log('received:', v));
```

```console
$ node emitter.cjs
received: payload
```

Emit synchronously and the `.on('done')` call has not happened yet, so the event
is lost.

## `await` is a microtask, not a phase

The most useful thing to know about `await`: it yields to the **microtask queue**,
not to the event loop.

```js
// awaits.cjs
console.log('1');
(async () => {
  console.log('2 — body runs synchronously up to the first await');
  await null;                       // yields here
  console.log('4 — resumed as a microtask');
})();
setTimeout(() => console.log('5 — a whole loop phase later'), 0);
console.log('3');
```

```console
$ node awaits.cjs
1
2 — body runs synchronously up to the first await
3
4 — resumed as a microtask
5 — a whole loop phase later
```

`await` does **not** give the event loop a chance to run timers or I/O. An
`await`-heavy loop over in-memory values never yields to the loop at all, which is
why `await` is not a fix for [CPU-bound work](22-cpu-bound-work.md) — that needs
`setImmediate`, which is a real phase.

## Gotchas

**Symptom:** `nextTick` runs after promises, contradicting everything you read
**Cause:** You are at ESM top level, which is itself a microtask.
**Fix:** Nothing to fix — stop relying on the ordering. Use `await` to sequence.

**Symptom:** Adding `await` inside a hot loop did not make the server responsive
**Cause:** `await` yields to the microtask queue, which drains before the loop
continues. No phase ever runs.
**Fix:** `await setImmediate()` from `node:timers/promises` — that is a real
yield.

**Symptom:** An event emitted from a constructor is never received
**Cause:** It fired synchronously, before the caller could attach a listener.
**Fix:** Defer the emit with `process.nextTick` or `queueMicrotask`.

**Symptom:** The process hangs with no CPU activity and no output
**Cause:** Recursive `process.nextTick` — see
[starvation](05-nexttick-starvation.md).
**Fix:** Use `setImmediate` for anything recursive.

## Interview questions

**★ What is the difference between a microtask and a macrotask?**
Microtasks — promise continuations, `queueMicrotask`, `await` resumptions — drain
completely between event loop phases and between individual callbacks. Macrotasks
— timers, `setImmediate`, I/O callbacks — each belong to a specific phase and get
one turn per lap of the loop. The microtask queue is emptied before the loop moves
on, so a microtask that schedules another microtask can delay the loop
indefinitely.

**★ Does `process.nextTick` always run before promise callbacks?**
No — and this is where most answers are wrong. At an ordinary checkpoint the
nextTick queue drains first. But once you are inside a microtask, the microtask
queue continues draining first, so a `nextTick` queued there runs after. Top-level
ESM code is itself a microtask, which is why the same script gives different
output as `.cjs` and `.js`.

**★ What does `await` yield to?**
The microtask queue. The async function's body runs synchronously up to the first
`await`, then resumes as a microtask. It does not give the event loop a chance to
run timers or I/O, which is why `await` alone never unblocks a CPU-bound loop.

**★ When should you use `process.nextTick` over `queueMicrotask`?**
Rarely. `queueMicrotask` is the web standard, uses the same queue as promises, and
does not carry the starvation risk. `nextTick` is for the narrow case of needing to
run before pending promise continuations — classically, deferring an event emit so
a caller can attach a listener first.

**★ Why can recursive `nextTick` hang the process but recursive `setImmediate`
cannot?**
The nextTick queue drains to exhaustion at each checkpoint, including entries
added during draining, so it never returns control to the loop. `setImmediate`
schedules into the check phase, which gets one turn per lap — the loop keeps
running.

**In what order do these run: sync code, `setTimeout(0)`, `setImmediate`, a
resolved promise, `process.nextTick`?**
Sync code first, to completion. Then `nextTick`, then the promise. Then the loop:
`setTimeout(0)` in timers and `setImmediate` in check — whose relative order from
the main module is nondeterministic, and inside an I/O callback is always
`setImmediate` first.

---

← Prev: [The poll phase](02-poll-phase.md) · Next → [setImmediate vs setTimeout](04-setimmediate-vs-settimeout.md)
