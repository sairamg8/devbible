---
title: "01 · Choosing a deferral"
sidebar_label: "01 · Choosing a deferral"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`queueMicrotask()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/queueMicrotask), [Using microtasks in JavaScript](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide), [`requestAnimationFrame()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame), [`requestIdleCallback()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback), [`MessageChannel`](https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel), [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) — and Node.js [`process.nextTick()` vs `queueMicrotask()`](https://nodejs.org/api/process.html#processnexttickcallback-args), [`timers` § `setImmediate`](https://nodejs.org/api/timers.html#setimmediatecallback-args). Documentation-validated; **no timings, no console blocks**.

⚠️ **The mechanism is already covered.** The drain order, the two uses MDN documents, and the
starvation loop are
[03 · Microtasks vs macrotasks](../03-microtasks-vs-macrotasks/02-using-microtasks.md), at Master
depth. **This page is the decision** — given "run this later", which "later" do you want, and
what does each one actually promise?

🔴 **"Later" is not one thing.** There are at least six distinct positions in the event loop you
can ask for, and picking the wrong one produces bugs that look like timing flakiness: a value
read before it was written, a frame of visible flicker, a spinner that never paints.

## The decision table

| You want to run… | Use | Position |
|---|---|---|
| after the current call stack, **before** anything else | **`queueMicrotask(fn)`** | microtask |
| …the same, but you need a promise anyway | `Promise.resolve().then(fn)` | microtask |
| after the browser has had a chance to **paint** | `setTimeout(fn, 0)` | task |
| …the same, without the 4 ms clamp | `MessageChannel` port message | task |
| immediately **before the next paint** | `requestAnimationFrame(fn)` | frame callback |
| only when the main thread is **idle** | `requestIdleCallback(fn)` | idle callback |
| with an explicit **priority** | `scheduler.postTask(fn, { priority })` | task, where available |

**Read the middle column against one question: does the browser get to render between now and
your callback?** Microtasks say no — they all drain before the loop moves on. Tasks and frame
callbacks say yes. That single distinction resolves most of the choices.

### `queueMicrotask` versus `Promise.resolve().then`

They land in the same queue, and MDN's own guidance is to prefer `queueMicrotask` when you only
want the deferral. Two reasons, and the second is the one that matters:

- **No promise is allocated**, and no `.then` closure — it is the direct expression of "queue
  this microtask".
- 🔴 **Errors route differently.** A throw inside a `queueMicrotask` callback is reported as an
  **uncaught exception** — it reaches `window.onerror` / the `error` event, like any other
  unexpected failure. A throw inside `.then` becomes a **rejected promise**, which nothing is
  handling, so it surfaces as `unhandledrejection` instead — a different handler, a different
  dashboard, and silently swallowed if you chained a `.catch` you forgot about.

**Use the promise form when the result is a promise anyone awaits.** Use `queueMicrotask` when
the deferral is an implementation detail and a failure genuinely is a bug, not a rejection.
Global handling of both is [08 · Unhandled rejections](../08-error-handling/03-unhandled-rejections.md).

### `setTimeout(fn, 0)` versus `queueMicrotask`

```js
queueMicrotask(() => paintSpinner());   // ❌ still before any rendering — nothing appears
setTimeout(() => startHeavyWork(), 0);  // ✅ the spinner painted; now do the work
```

🔴 **This is the classic "my loading indicator never shows" bug.** Setting the DOM and then
immediately doing heavy synchronous work never yields to rendering, and a microtask does not
yield either. Only a **task** boundary gives the browser its chance to paint.

Going the other way — using `setTimeout(fn, 0)` where a microtask was wanted — costs you an
entire render opportunity and the timer clamp, and it is what makes state look "one tick behind"
([12 · Why `0` is not `0`](../12-timers/02-why-zero-is-not-zero.md)).

### `requestAnimationFrame` is not "a fast timer"

It runs **before the next paint**, which makes it right for anything visual: writing styles,
measuring after a class change, driving animation from its timestamp. It is wrong for
non-visual work — in a background tab it stops entirely, so a `rAF`-driven poller simply
freezes.

**And it is not a throttle for `scroll`** — frame callbacks fire at the same rate as scroll
events, so the pairing buys nothing
([Phase 10 · 09](../../phase-10-events/09-scroll-resize-visibility/01-the-high-frequency-events.md)).

### `requestIdleCallback` and `scheduler.postTask`

`requestIdleCallback` runs your callback when the browser has spare time, with a deadline object
telling you how much. It is right for genuinely optional work — prefetching, analytics flushing,
cache warming — and wrong for anything the user is waiting on, because "idle" may never arrive
on a busy page. Give it a `timeout` when the work must eventually happen.

`scheduler.postTask(fn, { priority })` is the explicit version of the same idea, with
`'user-blocking'`, `'user-visible'` and `'background'` priorities, and `scheduler.yield()` for
handing control back mid-task. **Feature-detect before using either** — availability is not
universal, and the fallback is `setTimeout(fn, 0)`.

## Node has two extra positions, and they are not the same

```js
process.nextTick(fn);   // before the promise microtask queue
queueMicrotask(fn);     // the promise microtask queue
setImmediate(fn);       // the check phase — a task, after I/O callbacks
setTimeout(fn, 0);      // the timers phase — a task
```

🔴 **`process.nextTick` is not a microtask in the ECMAScript sense** — Node drains the entire
`nextTick` queue *before* the promise microtask queue, so a `nextTick` callback runs ahead of a
`.then` scheduled earlier. That makes it starve-prone in the same way, only more so, and Node's
own documentation recommends `queueMicrotask` for new code unless you specifically need
`nextTick`'s ordering.

**`setImmediate` versus `setTimeout(fn, 0)`** is the other Node-only pairing: different loop
phases, and their relative order at the top level of a program is famously not guaranteed —
inside an I/O callback, `setImmediate` runs first. The phases in detail are
**19 · Event loop: browser vs Node** *(not written yet)*.

## Two rules that settle most cases

**1 · If it must happen before anyone can observe the current state, it is a microtask.**
Normalising an API so it is *always* asynchronous, batching several synchronous mutations into
one notification, flushing a queue before control returns — all microtasks, and all covered at
[03 · Using microtasks](../03-microtasks-vs-macrotasks/02-using-microtasks.md).

**2 · If the user should see something first, it is a task.**
Painting a spinner, letting a transition start, breaking a long job into pieces. A microtask here
is invisible, because nothing renders between now and it.

⚠️ **And if the answer is "I don't know, but wrapping it in `setTimeout` made it work" — stop.**
That is a race with a delay stapled over it; the fix is the signal that actually says the state
is ready ([17 · The stale response](../17-race-conditions-ui/01-the-stale-response.md)).

## Gotchas

**Symptom: a loading spinner never appears before heavy work starts.**
Cause — the work was deferred with a microtask, or not deferred at all; nothing renders before a
microtask.
Fix — yield with a task: `setTimeout(fn, 0)`, `scheduler.yield()` or a `MessageChannel` message.

**Symptom: state looks "one tick behind" after an update.**
Cause — the read was deferred to a task when it only needed a microtask.
Fix — `queueMicrotask`, or await the promise the API already gives you.

**Symptom: an error from a deferred callback does not reach your rejection handler.**
Cause — a throw in `queueMicrotask` is an uncaught exception, not a rejected promise.
Fix — handle both channels globally: `error` and `unhandledrejection`.

**Symptom: an animation freezes in a background tab.**
Cause — `requestAnimationFrame` stops entirely when the page is hidden.
Fix — for non-visual work use a timer; for visual work, resume from a timestamp on
`visibilitychange`.

**Symptom: `requestIdleCallback` work never runs on a busy page.**
Cause — idle time never arrives.
Fix — pass a `timeout`, or promote the work to `scheduler.postTask` with a real priority.

**Symptom: `scheduler.postTask` is not a function.**
Cause — the API is not available in that browser.
Fix — feature-detect and fall back to `setTimeout(fn, 0)`.

**Symptom: in Node, a `.then` scheduled first runs after a later `process.nextTick`.**
Cause — the `nextTick` queue drains before the promise microtask queue.
Fix — expected; prefer `queueMicrotask` unless you specifically want that ordering.

## Interview questions

**★ `queueMicrotask` or `setTimeout(fn, 0)` — how do you choose?**
Ask whether the browser should be able to render in between. Microtasks all drain before the loop
continues, so nothing paints; a timer is a task, so it does. "Before anyone can observe the
state" is a microtask; "after the user sees something" is a task.

**★ Why prefer `queueMicrotask` over `Promise.resolve().then`?**
It expresses the deferral directly with no promise allocated, and a throw inside it is reported
as an uncaught exception rather than becoming an unhandled rejection — a different, usually more
appropriate, error channel.

**★ Why does a spinner set right before heavy work never appear?**
Because the DOM change is not painted until the browser gets a rendering opportunity, and neither
synchronous code nor a microtask yields one. Defer the work to a task.

**★ What is `requestAnimationFrame` for, and what is it not for?**
For visual work that must land before the next paint. Not for polling or non-visual scheduling —
it stops in background tabs — and not as a throttle for `scroll`.

**★ How does `process.nextTick` differ from `queueMicrotask` in Node?**
Its queue drains *before* the promise microtask queue, so it can jump ahead of `.then` callbacks
scheduled earlier. Node recommends `queueMicrotask` for new code.

**★ You have "run this later" and no other requirement. What do you pick?**
`queueMicrotask` if it is an implementation detail that must not be observable; a task if the
user needs to see the current state first. Anything more specific needs a stated reason.

**When is `requestIdleCallback` the right answer?**
For genuinely optional work — prefetch, analytics, cache warming — with a `timeout` so it is not
postponed forever.

---

[Topic index](./README.md) · [02 · Microtask hazards](./02-microtask-hazards.md) →
