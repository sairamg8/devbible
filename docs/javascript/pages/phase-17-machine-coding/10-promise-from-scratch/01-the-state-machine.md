---
title: "10.1 · The state machine and `then`"
sidebar_label: "01 · The state machine and `then`"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise), [`Promise.prototype.then()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then) and [`queueMicrotask()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/queueMicrotask). Documentation-validated; **nothing was run**.

Writing `Promise` yourself is the best way to stop treating it as magic. **The state machine
is small**; what makes the exercise worth doing is the three rules around it — settle once,
never call a handler synchronously, and `then` always returns a *new* promise.

MDN's states: *"**pending**: initial state, neither fulfilled nor rejected"*, *"**fulfilled**:
meaning that the operation was completed successfully"*, *"**rejected**: meaning that the
operation failed"* — and *"a promise is said to be settled if it is either fulfilled or
rejected, but not pending."*

## Part one: settle once, remember the outcome

```js
const PENDING = "pending", FULFILLED = "fulfilled", REJECTED = "rejected";

class MyPromise {
  #state = PENDING;
  #value = undefined;          // the fulfillment value or the rejection reason
  #callbacks = [];             // handlers registered while still pending

  constructor(executor) {
    const settle = (state, value) => {
      if (this.#state !== PENDING) return;          // ← settle ONCE; later calls are ignored
      this.#state = state;
      this.#value = value;
      queueMicrotask(() => {
        for (const cb of this.#callbacks) cb();     // flush, then never again
        this.#callbacks = [];
      });
    };

    const resolve = (value) => this.#resolveWith(value, settle);
    const reject = (reason) => settle(REJECTED, reason);

    try {
      executor(resolve, reject);                     // ← runs SYNCHRONOUSLY
    } catch (err) {
      reject(err);                                   // a throwing executor rejects the promise
    }
  }
}
```

Three behaviours are encoded there, and each is a question:

- **The executor runs synchronously**, immediately, before the constructor returns. Everything
  *after* it is asynchronous.
- **A throwing executor rejects the promise** rather than throwing at the construction site.
- **Settling is one-way.** The guard on `#state !== PENDING` is what makes a second `resolve`
  or a `reject` after `resolve` a silent no-op — not an error, and not a state change.

## Part two: handlers are *never* called synchronously

This is the rule people break when writing their own. MDN:

> "An action can be assigned to an already settled promise. In this case, the action is added
> immediately to the back of the job queue and will be performed when all existing jobs are
> completed. Therefore, an action for an already 'settled' promise will occur only after the
> current synchronous code completes and at least one loop-tick has passed. **This guarantees
> that promise actions are asynchronous.**"

```js
then(onFulfilled, onRejected) {
  return new MyPromise((resolve, reject) => {
    const handle = () => {
      const handler = this.#state === FULFILLED ? onFulfilled : onRejected;

      if (typeof handler !== "function") {           // no handler → pass the state straight through
        this.#state === FULFILLED ? resolve(this.#value) : reject(this.#value);
        return;
      }

      try {
        resolve(handler(this.#value));               // resolve, so a returned thenable is adopted
      } catch (err) {
        reject(err);                                 // a throwing handler REJECTS the new promise
      }
    };

    if (this.#state === PENDING) this.#callbacks.push(handle);
    else queueMicrotask(handle);                     // already settled → still async
  });
}
```

**Why it matters:** a promise library that calls handlers synchronously when the value is
already available produces code whose ordering depends on timing — sometimes before the next
line, sometimes after. The guarantee removes an entire class of bug, and it is why
`Promise.resolve(1).then(log)` logs *after* the synchronous code that follows it
([Phase 7 · 03 · Microtasks vs macrotasks](../../phase-7-async/03-microtasks-vs-macrotasks/README.md)).

## Part three: `then` returns a **new** promise

MDN's rules for what the new promise does, and they map one-to-one onto the code above:

| The handler… | The new promise… |
|---|---|
| returns a non-thenable value | is **fulfilled** with that value |
| returns a thenable | *"settles in the same state as the returned value"* |
| throws | is **rejected** with the thrown error |
| is missing | *"will settle to the same state as the initial promise"* |

That last row is the **passthrough**, and it is what makes `.catch` work several links down a
chain: a `then` with only an `onFulfilled` forwards a rejection untouched until something
handles it ([Phase 7 · 06 · Chaining](../../phase-7-async/06-chaining/README.md)).

**Registering two handlers on one promise gives two independent chains** — a consequence of
returning a new promise each time, not a special case:

```js
const p = doWork();
p.then(a);          // chain 1
p.then(b);          // chain 2 — neither sees the other's return value
```

## Part four: the callback list

While pending, handlers queue up. Each entry is a closure over the `resolve`/`reject` of *its
own* derived promise, which is why one list can serve many `then` calls with no bookkeeping:

```js
#callbacks = [];        // pushed by then(), flushed once on settle, then cleared
```

**Clear it after flushing.** Holding the closures keeps every derived promise's captured state
alive for the lifetime of the original — a real leak for a long-lived promise
([Phase 8 · 04 · Leaks](../../phase-8-modules-errors/04-leaks/README.md)).

## Deriving the rest of the API

`catch` and `finally` are not primitives:

```js
catch(onRejected) { return this.then(undefined, onRejected); }

finally(onFinally) {
  return this.then(
    (value)  => { onFinally(); return value; },        // pass the value through
    (reason) => { onFinally(); throw reason; },        // re-throw so the rejection continues
  );
}
```

**`finally` must not swallow anything** — it observes and passes on. (The real one also waits
for a thenable returned by `onFinally`; the version above is the interview answer.) Note how
naturally the rules fall out: returning `value` keeps fulfilment, re-throwing keeps rejection.

## Gotchas

**Symptom:** Handlers ran synchronously when the promise was already settled
**Cause:** Calling the handler directly instead of scheduling it.
**Fix:** `queueMicrotask(handle)` on every path — MDN: *"this guarantees that promise actions
are asynchronous."*

**Symptom:** A promise settled twice, or a `reject` after `resolve` took effect
**Cause:** No state guard.
**Fix:** Return early unless `#state === PENDING`.

**Symptom:** A throwing handler crashed the caller
**Cause:** The handler was called outside a `try`.
**Fix:** Catch and `reject` the derived promise.

**Symptom:** `.catch` at the end of a chain never fired
**Cause:** An intermediate `then` swallowed the rejection instead of passing it through.
**Fix:** With no `onRejected`, reject the derived promise with the same reason.

**Symptom:** Two `.then`s on the same promise interfered with each other
**Cause:** Expecting a chain; each `then` creates an independent derived promise.
**Fix:** Chain off the *returned* promise if the steps must be sequential.

**Symptom:** A throwing executor threw at the construction site
**Cause:** No `try` around `executor(...)`.
**Fix:** Catch and reject.

**Symptom:** Memory grew while holding a long-lived promise with many handlers
**Cause:** The callback list was never cleared after settling.
**Fix:** Empty it once flushed.

## Interview questions

**★ What are a promise's states and transitions?**
`pending` → `fulfilled` or `rejected`, once. Settled means fulfilled or rejected. The
transition is one-way and single-shot: a second `resolve` or a later `reject` is ignored.

**★ Why must `then` handlers be asynchronous even when the promise is already settled?**
Because otherwise ordering would depend on whether the value happened to be ready — sometimes
before the following line, sometimes after. MDN specifies the action is queued and runs after
the current synchronous code, which *"guarantees that promise actions are asynchronous."*

**★ What does `then` return, and what determines its state?**
A **new** promise. Handler returns a plain value → fulfilled with it; returns a thenable →
adopts its state; throws → rejected with the error; missing → passes the original state
through, which is what lets a later `.catch` see an earlier rejection.

**★ Implement `catch` and `finally` in terms of `then`.**
`catch(fn)` is `then(undefined, fn)`. `finally(fn)` is `then(v => { fn(); return v; }, e => {
fn(); throw e; })` — it must pass the value through and re-throw the reason, never swallow
either.

**What does the executor's timing tell you?**
It runs synchronously inside the constructor, so `new Promise(...)` executes its body
immediately; only the handlers are deferred. A throw inside it rejects the promise rather than
propagating to the caller.

**Do two `.then()` calls on the same promise form a chain?**
No — they create two independent derived promises, both fed by the same source. Chaining means
calling `then` on the *returned* promise.

---

[Topic index](./README.md) · Next → [Resolution, thenables and the rest](./02-resolution-and-thenables.md)
