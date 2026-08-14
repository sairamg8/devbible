---
title: "06.3 · finally and the timing of a chain"
sidebar_label: "03 · finally and timing"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises), [`Promise.prototype.finally()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/finally). Documentation-validated.

**Two questions this chunk answers: where in a chain does `finally` actually run, and how
many event-loop ticks does a chain cost?** Both are asked in interviews and both are
misremembered.

## `finally` runs where you put it

`finally` is not a chain-level construct. It is a link like any other, and it runs **when
the promise it is attached to settles** — not at the end of the chain.

```js
step1()
  .finally(() => console.log("A"))    // runs after step1 settles
  .then(() => step2())
  .finally(() => console.log("B"));   // runs after step2 settles
```

The `try`/`finally` analogy is where the intuition goes wrong: in a `try` statement,
`finally` is textually last and runs last. In a chain, **position is everything**, because
each `.finally` attaches to a different promise.

🔴 **The practical consequence: a `finally` placed before a `catch` still runs, and runs
first.**

```js
doWork()
  .finally(() => spinner.hide())    // runs on both paths, BEFORE the catch
  .catch((e) => report(e));
```

That ordering is usually what you want for a spinner — hide it the moment the work settles,
regardless of outcome — and it works because `finally` is transparent: it passes the
rejection through untouched to the `catch` behind it, as established in
[05 · 02](../05-promises/02-then-catch-finally.md).

Putting it last is equally valid and slightly different:

```js
doWork()
  .catch((e) => report(e))          // handles → chain is now FULFILLED
  .finally(() => spinner.hide());   // runs after the handling
```

| Placement | Runs | Sees |
|---|---|---|
| **before `catch`** | as soon as the work settles | a still-rejected chain — passes it through |
| **after `catch`** | after the error has been handled | a fulfilled chain |

Both are correct; pick by whether cleanup should happen before or after error reporting.

### The rule that catches people out

Because `finally` reflects the original outcome, **it cannot be used to mark a chain as
handled**. This does not stop an unhandled rejection:

```js
doWork().finally(() => cleanup());
// ⚠️ if doWork() rejects, this is STILL an unhandled rejection
```

`finally` is transparent — MDN: *"reflects the eventual state of the original promise"* —
so the rejection passes straight through it and off the end of the chain. Only a `catch`
(or a two-argument `then`) marks a rejection handled.

And the hazard from [05 · 02](../05-promises/02-then-catch-finally.md) applies with more
force in a chain: **a `finally` that throws replaces the outcome**, destroying the original
error before it ever reaches your `catch`.

```js
fetchThing()
  .finally(() => { closeConnection(); })   // if THIS throws, the fetch error is lost
  .catch((e) => report(e));                // reports the cleanup error instead
```

## Every link costs a microtask

A chain is not free, and the cost is measured in microtask ticks. From
[05 · 02](../05-promises/02-then-catch-finally.md): a handler *"always happens
asynchronously, even when the current promise is already settled"*.

**So a three-link chain over an already-resolved promise takes three microtask ticks to
finish** — one per link. This never blocks anything (microtasks drain before the next task,
per [03 · Microtasks vs macrotasks](../03-microtasks-vs-macrotasks/README.md)), but it does
mean the chain's result is not available in the same tick, however trivial the handlers are.

MDN's illustration of the ordering, with its stated output:

```js
const promise = new Promise((resolve, reject) => {
  console.log("Promise callback");
  resolve();
}).then((result) => {
  console.log("Promise callback (.then)");
});

setTimeout(() => {
  console.log("event-loop cycle: Promise (fulfilled)", promise);
}, 0);

console.log("Promise (pending)", promise);
```

```
Promise callback
Promise (pending) Promise {<pending>}
Promise callback (.then)
event-loop cycle: Promise (fulfilled) Promise {<fulfilled>}
```

Three separate facts are visible in that output, and each is worth naming:

1. **The executor runs synchronously.** `"Promise callback"` prints first, before anything
   else — `new Promise(fn)` calls `fn` immediately, on the current stack.
2. **The chain is still pending when the synchronous code finishes.** `"Promise (pending)"`
   prints third-from-last with the promise unsettled, even though `resolve()` was already
   called, because the `.then` handler has not run yet.
3. **The `.then` handler beats the `setTimeout`.** Microtask before task —
   MDN: *"Promise callbacks are handled as a microtask whereas `setTimeout()` callbacks are
   handled as task queues."*

🔴 **Point 1 is the one that surprises people.** The *executor* is synchronous; only the
*handlers* are deferred. Work you put directly inside `new Promise(…)` runs now and blocks,
which is why a slow synchronous computation is not made asynchronous by wrapping it in a
promise.

## What this means for a long chain

- **Never `await` in a loop over a chain you could have composed.** Each link is a tick and,
  worse, each *awaited network call* is a round trip — the waterfall from
  [chunk 01](./01-flattening.md).
- **A chain never yields to rendering.** All the links drain in one microtask checkpoint, so
  a hundred-link chain of synchronous handlers freezes the frame exactly as a loop would.
  Yielding to the browser needs a **task**, as covered in
  [03 · 01](../03-microtasks-vs-macrotasks/01-the-drain-order.md).
- **Ordering between two independent chains is by tick, not by declaration.** Two chains
  started in the same synchronous block interleave link-by-link, since each link queues one
  microtask.

## Gotchas

**Symptom:** `finally` ran in the middle of the chain rather than at the end
**Cause:** `finally` attaches to **the promise before it**, like any other link. It is not a
chain-level clause.
**Fix:** Place it where you want it to run — before `catch` for cleanup-on-settle, after for
cleanup-after-reporting.

**Symptom:** A chain ending in `.finally()` still reports an unhandled rejection
**Cause:** `finally` is **transparent** and does not mark anything handled; the rejection
passes through it and off the end.
**Fix:** End with `.catch()`, or return the chain to a caller that does.

**Symptom:** The error reported is from the cleanup, not from the operation
**Cause:** The `finally` callback threw, which **replaces** the outcome before the `catch`
sees it.
**Fix:** Make cleanup non-throwing, or wrap the `finally` body in its own `try`/`catch`.

**Symptom:** A value is not available immediately after a chain over an already-resolved
promise
**Cause:** Every link costs a microtask tick — handlers *"always happen asynchronously, even
when the current promise is already settled"*.
**Fix:** Expected. Read the value inside a handler or after `await`.

**Symptom:** Slow synchronous work inside `new Promise(…)` still blocks the page
**Cause:** The **executor runs synchronously**, on the current stack. MDN's output shows
`"Promise callback"` printing first.
**Fix:** Wrapping in a promise does not offload work. Use a worker, or chunk the work across
tasks.

**Symptom:** A long promise chain froze the frame
**Cause:** Every link is a microtask, and the whole queue drains before rendering.
**Fix:** Yield a **task** periodically — `await new Promise(r => setTimeout(r, 0))`.

## Interview questions

**★ Where does `finally` run in a chain?**
Wherever you put it — it attaches to the promise immediately before it, not to the chain.
Before a `catch` it runs first and passes the rejection through untouched; after a `catch`
it runs on an already-fulfilled chain. The `try`/`finally` intuition, where `finally` is
always last, is what misleads.

**★ Does `.finally()` handle a rejection?**
No. It is transparent — MDN: *"reflects the eventual state of the original promise"* — so a
chain ending in `.finally()` still produces an unhandled rejection. Only `catch` (or a
two-argument `then`) marks it handled.

**★ How many ticks does a three-link chain take?**
Three microtask ticks, one per link, even if the promise is already settled and the handlers
are trivial — handlers *"always happen asynchronously"*. It never blocks, since microtasks
drain before the next task, but the result is not available in the same tick.

**★ Predict the order:** executor `console.log`, a `.then` log, a `setTimeout(…, 0)` log, and
a trailing synchronous log.
Executor first (it is **synchronous**), then the trailing synchronous log, then the `.then`
(microtask), then the `setTimeout` (task) — MDN's documented output for exactly this
program.

**★ Does wrapping slow synchronous work in `new Promise` make it non-blocking?**
No. The **executor runs synchronously** on the current stack; only handlers are deferred.
Offloading needs a worker, or splitting the work across tasks.

**Can a long promise chain freeze the UI?**
Yes. Every link is a microtask and the whole queue drains before the browser gets a
rendering opportunity, so a chain of synchronous handlers blocks the frame just as a loop
would. Yield a **task** to let it paint.

---

← Prev [02 · Error propagation](./02-error-propagation.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
