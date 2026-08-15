---
title: "02 · Microtask hazards"
sidebar_label: "02 · Microtask hazards"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`queueMicrotask()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/queueMicrotask), [Using microtasks in JavaScript](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide), [`Window: error` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/error_event), [`Window: unhandledrejection` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event), [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) — and the [HTML Standard § Microtask queue](https://html.spec.whatwg.org/multipage/webappapis.html#microtask-queue). Documentation-validated; **no timings, no console blocks**.

Microtasks are the highest-priority thing you can schedule, and that priority is exactly what
makes them hazardous. Three failure modes are worth knowing before you reach for one.

## Hazard 1 · Starvation blocks rendering, input and timers

```js
queueMicrotask(function loop() { queueMicrotask(loop); });   // 🔴 the page is now frozen
```

The microtask queue is drained **to completion**, and microtasks queued *during* the drain join
the same pass. So a chain that always queues another one never ends: no task runs, no timer
fires, nothing paints, and clicks are not processed. The page is unresponsive with the CPU at
full tilt and no infinite `for` loop to find.

**The realistic version is not a deliberate loop** — it is recursion through promises:

```js
async function drain(queue) {
  while (queue.length) await handle(queue.shift());   // ⚠️ every await is a microtask
}
```

If `handle` resolves synchronously (a cache hit, a resolved promise), the loop never reaches a
task boundary, and a long queue holds the thread exactly as the deliberate loop does.

🔴 **The fix is to yield to a *task* periodically, not to a microtask.** Chunk the work and hand
control back — `setTimeout(fn, 0)`, `scheduler.yield()` where available, or a `MessageChannel`
message — so rendering and input get their turn. That is the same argument as
[12 · Why `0` is not `0`](../12-timers/02-why-zero-is-not-zero.md), from the other direction.

⚠️ **`await` alone is not a yield.** Awaiting an already-resolved value queues a microtask and
resumes in the same drain; it never lets the browser render. This surprises people who add an
`await` specifically to "give the UI a chance".

## Hazard 2 · Errors leave by a different door

| Where the throw happens | Where it surfaces |
|---|---|
| `queueMicrotask(() => { throw e })` | **uncaught exception** — `window.onerror` / the `error` event |
| `Promise.resolve().then(() => { throw e })` | **rejected promise** — `unhandledrejection` |
| inside a `.then` with a later `.catch` | the `.catch`, and nowhere global |
| a `MutationObserver` callback | uncaught exception |

**A reporter wired to only one of these misses half your failures.** Both handlers are cheap:

```js
addEventListener('error', (e) => report(e.error ?? e.message));
addEventListener('unhandledrejection', (e) => report(e.reason));
```

🔴 **The subtle case is a deferral inside a promise chain.** Wrapping something in
`queueMicrotask` *inside* a `.then` moves its errors out of the chain — the surrounding
`.catch` will never see them, because the callback runs on its own, later, with no relationship
to the promise. If the failure should reject the chain, do not defer it that way; return a
promise instead. The wider argument is
[08 · Rejections that vanish](../08-error-handling/02-rejections-that-vanish.md).

## Hazard 3 · A microtask cannot see anything the platform has not done yet

Microtasks run before the browser does its next round of work, which is precisely the point —
and the reason a microtask is the wrong place to observe layout, paint, or the result of any
task-scheduled callback.

```js
el.classList.add('open');
queueMicrotask(() => console.log(el.getBoundingClientRect().height));  // forces layout, now
```

That does not read a *stale* value — layout is computed on demand — but it does force a
synchronous layout at a moment nothing needed one, which is the thrashing pattern from
[Phase 9 · 12 · Layout thrashing](../../phase-9-dom/12-layout-thrashing/02-fixing-it.md). If you
want "after the style change has been rendered", that is `requestAnimationFrame` — usually two
of them — not a microtask.

**Similarly, a microtask never observes the result of a `setTimeout` scheduled beside it**, no
matter how small the delay. Tasks come after the whole drain, every time.

## Where microtasks come from, so you can spot them

Not everything that queues a microtask is obvious. From MDN and the HTML Standard, the sources
are:

| Source | Note |
|---|---|
| `.then` / `.catch` / `.finally` callbacks | the common case |
| `await` continuations | every `await`, including on a non-promise |
| `queueMicrotask()` | the direct form |
| **`MutationObserver`** callbacks | which is why DOM mutations batch per microtask checkpoint |
| resolving a promise **with a thenable** | adoption itself is specified in microtasks |

⚠️ **`MutationObserver` being a microtask is the one people miss.** It means a DOM-observing
callback runs before rendering and before any timer — excellent for batching, and a genuine
starvation risk if the callback mutates what it observes.

## Flushing microtasks in a test

Because microtasks drain before tasks, "let all pending promise callbacks run" is one line:

```js
await Promise.resolve();        // or: await null — both queue a microtask continuation
```

…and "let pending timers and rendering happen too" needs a task:

```js
await new Promise((r) => setTimeout(r, 0));
```

🔴 **Awaiting once flushes one level, not the whole graph.** A chain of *n* `.then`s needs *n*
turns, which is why test helpers often loop or why fake timers are used instead. If a test needs
an unknown number of flushes, that is usually a sign to await the actual promise the code under
test exposes rather than the queue.

## Gotchas

**Symptom: the page freezes with no infinite loop in sight.**
Cause — a self-queueing microtask chain, or a promise loop that never reaches a task boundary.
Fix — yield to a task periodically; a microtask or a bare `await` is not a yield.

**Symptom: adding `await` did not give the UI a chance to update.**
Cause — awaiting a resolved value queues a microtask and resumes in the same drain.
Fix — `setTimeout(fn, 0)` or `scheduler.yield()` for a real rendering opportunity.

**Symptom: an error from a deferred callback never reaches the surrounding `.catch`.**
Cause — `queueMicrotask` detaches the callback from the promise chain.
Fix — return a promise from the chain instead of deferring inside it.

**Symptom: half the production errors are missing from the reporter.**
Cause — only `error` or only `unhandledrejection` is handled.
Fix — handle both; they carry different failures.

**Symptom: reading a measurement in a microtask after a class change forces layout.**
Cause — the read happens at a moment nothing else needed layout.
Fix — batch reads, or use `requestAnimationFrame` when you mean "after the render".

**Symptom: a `MutationObserver` callback fires far more often than expected and stalls the page.**
Cause — the callback mutates the nodes it observes; its callbacks are microtasks.
Fix — guard the mutation, or disconnect while writing.

**Symptom: a test passes with two `await Promise.resolve()` and fails with one.**
Cause — each await flushes a single microtask turn, not the whole chain.
Fix — await the promise the code actually returns, or use fake timers.

## Interview questions

**★ Can a microtask block the page?**
Yes — the queue drains to completion and microtasks queued during the drain join the same pass,
so a self-queueing chain never lets a task, a timer or a paint through.

**★ Does `await` yield to the browser?**
No. Awaiting an already-resolved value queues a microtask and resumes within the same drain.
Yielding for rendering needs a task boundary.

**★ Where does an exception thrown in a `queueMicrotask` callback go?**
It is reported as an uncaught exception — the global `error` handler — not as an unhandled
rejection. That is a deliberate difference from `Promise.resolve().then`.

**★ Name a microtask source that is not a promise.**
`MutationObserver` callbacks, and `queueMicrotask` itself. Thenable adoption inside a promise
resolution is another.

**★ How do you flush pending promise callbacks in a test?**
`await Promise.resolve()` for one microtask turn; `await new Promise(r => setTimeout(r, 0))` to
also let timers and rendering run. One await is one turn, not the whole chain.

**★ Why can't you observe a rendered style change from a microtask?**
Because rendering happens after the microtask checkpoint. For "after the browser has rendered",
use `requestAnimationFrame` — commonly nested twice.

**What is the cost of choosing a microtask when a task was correct?**
The user sees nothing update until your work finishes, because nothing paints between the current
code and the microtask.

---

← [01 · Choosing a deferral](./01-choosing-a-deferral.md) · [Topic index](./README.md)
