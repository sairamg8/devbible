---
title: "03.2 · Using microtasks deliberately"
sidebar_label: "02 · Using microtasks"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Using microtasks in JavaScript](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide). Documentation-validated.

`queueMicrotask` is not a curiosity — MDN documents two genuine uses, and both solve
problems that come up in real libraries.

```js
queueMicrotask(() => {
  /* code to run in the microtask here */
});
```

MDN: it *"runs after the current JavaScript execution context exits but before any event
handlers, timeouts, or other callbacks"*. The callback takes no parameters and its return
value is ignored.

## Use 1 — making conditional async consistent

The problem MDN identifies: a function that is **sometimes** asynchronous.

```js
// PROBLEM: Inconsistent ordering
customElement.prototype.getData = function (url) {
  if (this.cache[url]) {
    this.data = this.cache[url];
    this.dispatchEvent(new Event("load"));  // Runs immediately
  } else {
    fetch(url)
      .then((result) => result.arrayBuffer())
      .then((data) => {
        this.cache[url] = data;
        this.data = data;
        this.dispatchEvent(new Event("load"));  // Runs as microtask
      });
  }
};
```

**On a cache hit the `load` event fires synchronously, before the caller has attached a
listener.** On a miss it fires later, and the listener catches it. Same function, two
different orderings, decided by cache state — so the bug appears only on the second call
and looks like a race.

MDN's fix is to make the fast path *also* asynchronous:

```js
// SOLUTION: Balance with queueMicrotask()
customElement.prototype.getData = function (url) {
  if (this.cache[url]) {
    queueMicrotask(() => {
      this.data = this.cache[url];
      this.dispatchEvent(new Event("load"));
    });
  } else {
    fetch(url)
      .then((result) => result.arrayBuffer())
      .then((data) => {
        this.cache[url] = data;
        this.data = data;
        this.dispatchEvent(new Event("load"));
      });
  }
};
```

🔴 **The principle generalises: a function should be always-async or never-async, never
sometimes.** "Releasing Zalgo" is the traditional name for the alternative. Any cached,
memoised or short-circuiting async function needs this treatment.

The promise version of the same idea is free — `async function` and `Promise.resolve()`
both guarantee the callback runs in a microtask, so returning a promise from every path
fixes it without `queueMicrotask`:

```js
async getData(url) {
  if (this.cache[url]) return this.cache[url];   // still async: async fn always defers
  …
}
```

**Use `queueMicrotask` when the API is callback- or event-based** and cannot return a
promise, which is exactly MDN's custom-element case.

## Use 2 — batching within one turn

MDN's second example:

```js
const messageQueue = [];

let sendMessage = (message) => {
  messageQueue.push(message);

  if (messageQueue.length === 1) {
    queueMicrotask(() => {
      const json = JSON.stringify(messageQueue);
      messageQueue.length = 0;
      fetch("url-of-receiver", json);
    });
  }
};
```

**The `length === 1` check is the whole trick.** The first message schedules the flush;
every later message in the same turn just joins the array. When the microtask runs, it
sends all of them in one request and empties the queue.

MDN's stated benefits: *"All `sendMessage()` calls in the same event loop iteration batch
together"*, *"single `fetch()` request instead of multiple"*, and reduced overhead.

This is the mechanism behind framework batching generally — collect synchronous
mutations, flush once before the browser can paint. A microtask is the right queue for it
because it runs **after all synchronous code** but **before rendering**, so the batch is
complete and nothing is displayed twice.

## Choosing a scheduling primitive

| Need | Use |
|---|---|
| After the current synchronous code, **before** rendering or events | **`queueMicrotask`** / `Promise.resolve().then` |
| After the current task, **allowing** rendering and events in between | `setTimeout(fn, 0)`, or `scheduler.yield()` |
| Just before the next paint | `requestAnimationFrame` |
| When the browser is idle | `requestIdleCallback` |
| After DOM changes are applied | `MutationObserver` (a microtask) |
| Node: before promise microtasks | `process.nextTick` (Node only) |

**Default to `queueMicrotask` over `Promise.resolve().then(fn)`** when you only want the
scheduling. It says what it means, allocates no promise, and — importantly — an exception
thrown inside it surfaces as an ordinary uncaught error rather than a silently rejected
promise nobody handles.

## Where microtasks bite

**They run before rendering, so a long chain blocks paint.** Covered in
[chunk 1](./01-the-drain-order.md), and it is the main hazard.

**Errors in a microtask are not caught by the surrounding `try`/`catch`:**

```js
try {
  queueMicrotask(() => { throw new Error("boom"); });
} catch {
  // never reached — the microtask runs after this block has exited
}
```

The `try` block finishes before the microtask runs. Handle errors **inside** the
callback. The same applies to `setTimeout`, and to every callback-based API — a
`try`/`catch` only guards the synchronous act of *scheduling*.

**Ordering between microtasks is FIFO**, so two independent pieces of code queueing
microtasks interleave in scheduling order, not by importance. There is no priority within
the queue.

## Gotchas

**Symptom:** An event fires before the caller can attach a listener, but only sometimes
**Cause:** A function that is synchronous on a cache hit and asynchronous on a miss — the
"sometimes async" bug MDN's custom-element example demonstrates.
**Fix:** `queueMicrotask` on the fast path, or make every path return a promise.

**Symptom:** Many small requests where one batch would do
**Cause:** No batching across a single event-loop turn.
**Fix:** MDN's queue-plus-`length === 1` pattern — the first call schedules a microtask
flush, later calls in the same turn join it.

**Symptom:** `try`/`catch` around `queueMicrotask` does not catch the error
**Cause:** The callback runs **after** the `try` block has exited.
**Fix:** Put the `try`/`catch` inside the callback. Same for `setTimeout`.

**Symptom:** A microtask chain prevents the browser painting
**Cause:** Rendering happens between **tasks**, and the microtask queue drains completely
first.
**Fix:** Yield a task — `await new Promise(r => setTimeout(r, 0))` or
`scheduler.yield()`.

**Symptom:** An error inside `Promise.resolve().then(fn)` disappears
**Cause:** It becomes a **rejected promise** nobody handles, not an uncaught error.
**Fix:** `queueMicrotask` when you only want scheduling — its exceptions surface
normally.

## Interview questions

**★ What is the "sometimes async" problem, and how does `queueMicrotask` fix it?**
A function that returns synchronously on a cache hit and asynchronously on a miss fires
its callbacks in two different orders, so a listener attached after the call is missed
only on the fast path. MDN's fix is to wrap the fast path in `queueMicrotask`, making the
function **consistently** asynchronous. A function should be always-async or never-async,
never sometimes.

**★ How do you batch calls made in the same event-loop turn?**
Push into an array, and **only when the array length is 1** schedule a `queueMicrotask`
that flushes it. Later calls in the same turn join the array; the microtask sends one
request. It is MDN's own example, and the mechanism behind framework batching.

**★ Why `queueMicrotask` rather than `Promise.resolve().then(fn)`?**
It states the intent, allocates no promise, and its **exceptions surface as ordinary
uncaught errors** instead of becoming a rejected promise nobody observes.

**★ Why does `try`/`catch` not catch an error thrown in a microtask?**
Because the callback runs after the `try` block has already exited — the block only
guards the synchronous act of scheduling. Handle errors inside the callback.

**Why is a microtask the right queue for batching UI updates?**
Because it runs **after all synchronous code** in the turn — so the batch is complete —
but **before rendering**, so nothing is painted twice.

**Is there any priority within the microtask queue?**
No — it is FIFO. Independent code queueing microtasks interleaves in scheduling order,
with no way to jump ahead.

---

← [The drain order](./01-the-drain-order.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
