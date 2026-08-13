---
title: "03 · Microtasks vs macrotasks"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Using microtasks in JavaScript](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide), [JavaScript execution model](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model). Documentation-validated.

**Two queues, and one has absolute priority.** MDN: *"Microtasks have higher priority and
the microtask queue is drained first before the task queue is pulled."*

The asymmetry that matters: a task runs **one** job per turn; a microtask drain runs
**every** microtask, including ones queued during the drain.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The drain order](./01-the-drain-order.md)** | Which primitives create which, MDN's two rules, the `1, 4, 3, 2` exercise and the nested-timer case, **why microtasks can starve the loop where tasks cannot**, where `await` fits (and that `await null` still yields), rendering between tasks, and Node's extra queue |
| 2 | **[Using microtasks deliberately](./02-using-microtasks.md)** | MDN's two documented uses — fixing the **"sometimes async"** bug, and **batching within one turn** with the `length === 1` trick — how to choose a scheduling primitive, and why `try`/`catch` cannot catch a microtask's error |

## The exercise

```js
console.log("1");
setTimeout(() => console.log("2"), 0);
Promise.resolve().then(() => console.log("3"));
console.log("4");
// 1, 4, 3, 2
```

Read it in three phases: **all synchronous code**, then **the entire microtask queue**,
then **one task**.

## The hazard

```js
// freezes the page more completely than while(true)
queueMicrotask(function loop() { queueMicrotask(loop); });
```

A recursive `setTimeout` yields between callbacks; a recursive microtask never returns to
the task queue — so no timers, no events, **no rendering**.

## Phase gate

You are done with this topic when you can predict the `1, 4, 3, 2` ordering and explain
each step, say why a microtask chain freezes the page where a timer chain does not, and
name the two things MDN recommends `queueMicrotask` for.

## Where this connects

- [02 · The event loop](../02-the-event-loop/README.md) — *"a job is completed when the stack is empty"*, the rule underneath this one
- [07 · `async`/`await`](../README.md) — `await` continuations are microtasks
- [Phase 5 · 04 · Callbacks, holes and async](../../phase-5-built-in-library/04-array-iteration-methods/02-callbacks-holes-and-async.md) — the `forEach(async …)` trap

---

Start → [The drain order](./01-the-drain-order.md)
