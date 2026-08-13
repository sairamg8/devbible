---
title: "03.1 · The drain order"
sidebar_label: "01 · The drain order"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Using microtasks in JavaScript](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide), [JavaScript execution model](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model). Documentation-validated.

**Two queues, not one, and one of them has absolute priority.** MDN, on the execution
model: *"HTML event loops split jobs into two categories: **tasks** and **microtasks**.
Microtasks have higher priority and the microtask queue is drained first before the task
queue is pulled."*

## Which is which

| | Tasks (sometimes "macrotasks") | Microtasks |
|---|---|---|
| Created by | `setTimeout`, `setInterval`, event dispatch, the initial script | `.then`/`.catch`/`.finally`, `await` continuations, `queueMicrotask`, `MutationObserver` |
| When they run | one per event-loop turn | **all of them**, after the current task, before the next |
| Can starve the loop | no | **yes** |

MDN lists tasks as *"initial program execution, event dispatching, `setTimeout()` or
`setInterval()` callbacks"*.

## The two rules

MDN gives exactly two, and everything else follows:

> 1. **Execution timing**: Each time a task exits, the event loop checks if control
>    returns to JavaScript. If not, it runs **all** microtasks in the queue before
>    proceeding to the next task.
> 2. **Queue draining behavior**: If a microtask adds more microtasks via
>    `queueMicrotask()`, those newly-added microtasks **execute before the next task
>    runs**. The event loop keeps processing microtasks until the queue is empty.

🔴 **"All" and "until the queue is empty" are the load-bearing words.** A task runs
**one** job. A microtask drain runs **every** microtask, including ones queued during the
drain itself.

## The ordering exercise

MDN's own example:

```js
const callback = () => log("Regular timeout callback has run");
const urgentCallback = () => log("*** Oh noes! An urgent callback has run!");

log("Main program started");
setTimeout(callback, 0);
queueMicrotask(urgentCallback);
log("Main program exiting");
```

Output:

```
Main program started
Main program exiting
*** Oh noes! An urgent callback has run!
Regular timeout callback has run
```

MDN's explanation: *"setTimeout creates a task (processed after current task exits);
queueMicrotask creates a microtask (processed before next task)."*

The general shape, which is the interview question:

```js
console.log("1");
setTimeout(() => console.log("2"), 0);
Promise.resolve().then(() => console.log("3"));
console.log("4");
// 1, 4, 3, 2
```

**Read it in three phases:**

1. **Synchronous** — the current task runs to completion: `1`, `4`.
2. **Microtask drain** — every queued microtask, in order: `3`.
3. **Next task** — one task: `2`.

Nesting follows the same rule rather than needing a new one:

```js
setTimeout(() => {
  console.log("A");
  Promise.resolve().then(() => console.log("B"));
}, 0);
setTimeout(() => console.log("C"), 0);
// A, B, C
```

`B` runs before `C` because the microtask queue is drained **after each task**, not only
after the synchronous script. Each timer callback is its own task, and its microtasks are
drained before the next one begins.

## Microtasks can starve the loop

MDN's warning, with its example:

```js
// DANGEROUS - infinite loop
queueMicrotask(() => {
  queueMicrotask(() => {
    // This keeps adding more microtasks forever
  });
});
```

> Since microtasks can enqueue more microtasks, there's a real risk of endlessly
> processing microtasks.

**This freezes the page more completely than a `while (true)` loop does** — the loop never
returns to the task queue, so no timer, no event and no rendering ever runs, and it looks
like async code so it does not read as a hang.

A recursive `setTimeout` has the opposite property: each callback is a separate task, so
the loop breathes between them. **That is the practical difference — a task yields, a
microtask does not.**

The realistic version is not the obvious one above; it is a promise chain that re-arms
itself:

```js
function poll() {
  return check().then(poll);   // ⚠️ if check() resolves synchronously, this never yields
}
```

## Where `await` fits

`await` is microtask scheduling with different syntax:

```js
async function f() {
  console.log("a");
  await null;          // suspends; the continuation becomes a MICROTASK
  console.log("b");
}
f();
console.log("c");
// a, c, b
```

Everything up to the first `await` runs **synchronously** — `f()` is an ordinary call
until then. `await` suspends and queues the rest as a microtask, so `c` runs first.

**`await` on a non-promise still yields.** `await null` and `await 5` both suspend and
resume in a microtask. So `await` in a loop always yields to the microtask queue, and
never to the task queue — which is why an `await` loop still starves rendering.

## Rendering fits between tasks

The browser schedules a rendering opportunity **between tasks**, after the microtask
queue is empty. Two consequences:

- **A long microtask chain blocks rendering** just as effectively as a long synchronous
  function.
- **`requestAnimationFrame` is neither** a task nor a microtask — it is a separate
  callback list run as part of the rendering step, just before layout and paint. That is
  why visual updates belong there rather than in `setTimeout`.

To yield to rendering you must yield to the **task** queue:

```js
await new Promise((r) => setTimeout(r, 0));   // yields a task — rendering can happen
await null;                                   // yields a microtask — it cannot
```

Newer platforms expose `scheduler.yield()` for this, which is clearer than the timer
trick where it is available.

## Node's extra queue

Node adds `process.nextTick`, whose queue is drained **before** the promise microtask
queue, and `setImmediate`, which is a check-phase task. Both are Node-only.

🔴 **This page does not assert a cross-runtime ordering beyond "microtasks drain before
tasks"**, which is what both the HTML specification and MDN's execution model state. The
relative ordering of `setTimeout(…, 0)` and `setImmediate` in Node is famously
context-dependent, and no run here measured it.

## Gotchas

**Symptom:** A `.then` callback runs before a `setTimeout(…, 0)` scheduled earlier
**Cause:** Microtasks are drained **entirely** before the next task — MDN: *"it runs all
microtasks in the queue before proceeding to the next task"*.
**Fix:** Expected. Do not use `setTimeout(…, 0)` to sequence against promises.

**Symptom:** The page freezes and the profiler shows only promise callbacks
**Cause:** A self-re-arming microtask chain. MDN warns of *"a real risk of endlessly
processing microtasks"*.
**Fix:** Yield a **task** between iterations —
`await new Promise((r) => setTimeout(r, 0))` — or `scheduler.yield()`.

**Symptom:** UI does not update inside an `await` loop
**Cause:** `await` yields to the **microtask** queue; rendering happens between **tasks**.
**Fix:** Yield a task periodically, or move the work to a worker.

**Symptom:** Code before the first `await` ran synchronously and surprised you
**Cause:** An `async` function is an ordinary call until its first `await`.
**Fix:** Expected — and useful. Put validation before the first `await` so it throws
synchronously.

**Symptom:** `await null` behaves differently from no `await` at all
**Cause:** `await` on a non-promise **still suspends** and resumes in a microtask.
**Fix:** Expected. `await` always yields at least one microtask tick.

**Symptom:** Ordering differs between Node and the browser
**Cause:** Node adds `process.nextTick` (drained before promise microtasks) and
`setImmediate`.
**Fix:** Do not depend on anything narrower than "microtasks before tasks".

## Interview questions

**★ What is the difference between a microtask and a task?**
A task is one job per event-loop turn — `setTimeout`, events, the initial script. A
**microtask** is drained **entirely** after the current task and **before the next one**,
and MDN adds that microtasks queued *during* the drain also run in that same drain, until
the queue is empty. `.then`, `await` continuations and `queueMicrotask` create
microtasks.

**★ Predict the output: `console.log(1)`, `setTimeout(…2…, 0)`, `Promise.resolve().then(…3…)`, `console.log(4)`.**
`1, 4, 3, 2`. Synchronous code first, then the **entire** microtask queue, then one task.

**★ Why can microtasks freeze the page when tasks cannot?**
Because the drain continues *"until the queue is empty"*, so a microtask that queues
another never returns control to the task queue — no timers, no events, no rendering. A
recursive `setTimeout` yields between each callback; a recursive `.then` does not.

**★ Does `await` on a non-promise still yield?**
Yes — `await null` suspends and resumes in a **microtask**. And everything before the
first `await` runs **synchronously**, which is why validation placed there throws
synchronously.

**How do you yield so the browser can paint?**
Yield to the **task** queue — `await new Promise(r => setTimeout(r, 0))`, or
`scheduler.yield()` where available. Awaiting a resolved promise only yields a microtask,
and rendering happens between tasks.

**Where does `requestAnimationFrame` fit?**
Neither queue — it is a separate callback list run as part of the **rendering step**, just
before layout and paint. That is why visual updates belong there rather than in a timer.

---

[Topic index](./README.md) · Next → [Phase index](../README.md)
