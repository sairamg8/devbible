---
title: "05.2 · then, catch and finally"
sidebar_label: "02 · then, catch, finally"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Promise.prototype.then()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then), [`Promise.prototype.catch()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/catch), [`Promise.prototype.finally()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/finally). Documentation-validated.

**There is only one method here.** `catch` and `finally` are both defined in terms of
`then`, and knowing exactly how collapses a lot of apparently unrelated behaviour into one
rule.

## `then` takes two handlers

```js
promise.then(onFulfilled, onRejected);
```

Two things MDN states about the call itself, both load-bearing:

> "Returns a new `Promise` immediately. **This returned promise is always pending when
> returned**, regardless of the current promise's status."

> "The call always happens **asynchronously, even when the current promise is already
> settled**."

🔴 **`then` on an already-settled promise still defers.** This is guarantee 1 from
[04 · 03](../04-callbacks/03-inversion-of-control.md) — the anti-"Zalgo" rule — and it means
you can attach a handler to a promise that settled an hour ago and it will still run in a
microtask, never synchronously.

```js
const done = Promise.resolve(1);
done.then(() => console.log("A"));
console.log("B");
// B, then A — always, regardless of `done` already being settled
```

### A missing handler is not a no-op

This is the mechanism most people never learn, and it explains error propagation entirely.
MDN, on what happens when a handler is not a function:

> **`onFulfilled`** — "If it is not a function, it is internally replaced with an *identity*
> function (`(x) => x`) which simply passes the fulfillment value forward."
>
> **`onRejected`** — "If it is not a function, it is internally replaced with a *thrower*
> function (`(x) => { throw x; }`) which throws the rejection reason it received."

So `promise.then(fn)` is really `promise.then(fn, (x) => { throw x; })`. **Every `then` you
write without a second argument is silently re-throwing rejections down the chain.** That is
not a special propagation rule bolted onto chains — it is just the default handler doing its
job, one link at a time.

The mirror image is equally useful: `promise.then(undefined, fn)` passes fulfilment values
straight through untouched. Which is exactly what `catch` is.

## `catch` is `then` with the first argument omitted

MDN:

> "It is a shortcut for `then(undefined, onRejected)`."

and it says so at the implementation level too:

```js
// MDN's demonstration that catch() internally calls then()
Promise.resolve().catch(function XXX() {});

// Logs:
// Called .catch on Promise{} with arguments: Arguments{1} [0: function XXX()]
// Called .then on Promise{} with arguments: Arguments{2} [0: undefined, 1: function XXX()]
```

There is no separate error channel. **A rejection is just the second argument's turn.**

### `catch` restores the chain

The consequence people find surprising: a `catch` handler that returns normally produces a
**fulfilled** promise, so the chain continues on the success path.

MDN's example:

```js
p1.then((value) => {
  console.log(value); // "Success!"
  throw new Error("oh, no!");
})
  .catch((e) => {
    console.error(e.message); // "oh, no!"
  })
  .then(
    () => console.log("after a catch the chain is restored"), // This executes
  );
```

🔴 **Handling an error means the chain recovers.** If you want the failure to keep
propagating, you must re-throw:

```js
.catch((e) => {
  log(e);
  throw e;          // stays rejected
})
```

A `catch` that logs and does not re-throw has **swallowed** the error, and everything
downstream proceeds as if the operation succeeded — usually with `undefined` where a value
should be, because a handler that returns nothing fulfils with `undefined`.

### Two things `catch` cannot catch

MDN gives both, and they are the same failure twice. **Errors thrown asynchronously inside
the executor:**

```js
const p2 = new Promise((resolve, reject) => {
  setTimeout(() => {
    throw new Error("Uncaught Exception!");
  }, 1000);
});

p2.catch((e) => {
  console.error(e); // This is never called
});
```

**And errors thrown after `resolve()` has already been called:**

```js
const p3 = new Promise((resolve, reject) => {
  resolve();
  throw new Error("Silenced Exception!");
});

p3.catch((e) => {
  console.error(e); // This is never called
});
```

The first is the callback problem from [04 · 02](../04-callbacks/02-error-first.md) —
that `setTimeout` callback runs on a fresh stack, and the executor is long gone. The second
is the one-shot state machine from [chunk 01](./01-the-three-states.md): the promise already
settled, so *"further resolving or rejecting it has no effect"*.

**Only a throw during the executor's synchronous run is converted into a rejection.** Inside
any asynchronous callback in an executor, you must call `reject` explicitly.

## `finally` — transparent by design

MDN:

> "The `finally()` method schedules a function to be called when the promise is settled
> (either fulfilled or rejected)… It's typically used for cleanup actions, regardless of the
> promise's outcome."

Two rules define it. First:

> "**The `onFinally` callback does not receive any argument.** This is by design for cases
> where you do not care about the rejection reason or the fulfillment value."

Second, and the one that matters:

> "The `finally()` call is **transparent and reflects the eventual state of the original
> promise**."

MDN's two examples of that transparency:

```js
Promise.resolve(2).finally(() => 77);   // fulfils with 2, NOT 77
Promise.reject(3).finally(() => 88);    // rejects with 3, NOT fulfilled with 88
```

🔴 **A `return` inside `finally` is ignored.** Unlike `then` and `catch`, whose return value
becomes the next promise's value, `finally` passes the original outcome through untouched.
That is what makes it safe to drop into the middle of a chain.

### But it can still break the chain

Transparency is one-directional. MDN:

- **Returning a value** — "ignored; the returned promise maintains the original promise's
  state and value/reason"
- **Throwing an error** — "the returned promise is rejected with that error"
- **Returning a rejected promise** — "the returned promise is rejected with that reason"
- **Returning a pending promise** — "the returned promise waits for that promise to settle
  before continuing"

```js
Promise.reject(3).finally(() => { throw 99; });        // rejects with 99 — 3 is LOST
Promise.reject(3).finally(() => Promise.reject(99));   // rejects with 99 — 3 is LOST
```

**A `finally` that throws replaces the original outcome, including the original error.** A
cleanup step that fails destroys the diagnostic you actually needed. Keep `finally` bodies
incapable of throwing, or wrap them:

```js
.finally(() => {
  try { spinner.hide(); } catch { /* cleanup must not mask the real error */ }
})
```

And the fourth rule is a real hazard in its own right: **returning a pending promise from
`finally` delays the whole chain**, which is easy to do accidentally by making the cleanup
callback `async`.

## Gotchas

**Symptom:** A `.then` on an already-resolved promise runs later than surrounding code
**Cause:** MDN: *"The call always happens asynchronously, even when the current promise is
already settled."*
**Fix:** Expected — it is the anti-"Zalgo" guarantee. Never assume a settled promise runs its
handler now.

**Symptom:** An error disappears and the chain continues with `undefined`
**Cause:** A `catch` that handled the error and returned nothing. Handling **restores** the
chain, and a handler returning nothing fulfils with `undefined`.
**Fix:** Re-throw (`throw e`) if the failure should keep propagating.

**Symptom:** A rejection skips several `.then` handlers and lands in a distant `catch`
**Cause:** Not a special rule — each `then` without a second argument has an implicit
`(x) => { throw x; }` as its rejection handler.
**Fix:** Expected. Place `catch` where you actually want to handle, not where it looks tidy.

**Symptom:** A `throw` inside `new Promise(…)` is never caught
**Cause:** It was thrown **asynchronously** (inside a `setTimeout`, an event handler) or
**after `resolve()`** had already settled the promise.
**Fix:** Call `reject(err)` explicitly from asynchronous code in an executor. Only a
synchronous throw during the executor becomes a rejection.

**Symptom:** A value returned from `finally` is ignored
**Cause:** By design — MDN: *"transparent and reflects the eventual state of the original
promise."* `Promise.resolve(2).finally(() => 77)` fulfils with **2**.
**Fix:** Expected. Use `then` if you want to change the value.

**Symptom:** The original error vanished and a cleanup error surfaced instead
**Cause:** The `finally` callback **threw**, which replaces the outcome — MDN:
*"rejected with that error."*
**Fix:** Make cleanup non-throwing, or wrap the `finally` body in its own `try`/`catch`.

**Symptom:** The chain got slower after adding a `finally`
**Cause:** The callback returned a **pending** promise (often an accidental `async` cleanup
function), and MDN says the chain *"waits for that promise to settle before continuing"*.
**Fix:** Keep `finally` synchronous unless the delay is intended.

## Interview questions

**★ How does a rejection skip over `.then` handlers to reach a `catch`?**
There is no skipping rule. MDN: an `onRejected` that is not a function *"is internally
replaced with a thrower function `(x) => { throw x; }`"*. So each `then` without a second
argument re-throws the rejection to the next link, one at a time, until something handles it.

**★ What is `catch` actually?**
*"A shortcut for `then(undefined, onRejected)`"* — MDN, which also demonstrates that `catch`
internally calls `then`. There is no separate error channel; a rejection is simply the
second handler's turn.

**★ What does a `catch` handler that returns normally do to the chain?**
It **restores** it — the promise `catch` returns is **fulfilled**, so following `.then`
handlers run on the success path. To keep propagating the failure you must re-throw. A
`catch` that only logs has swallowed the error.

**★ Does `finally` change the value?**
No. MDN: *"transparent and reflects the eventual state of the original promise"* —
`Promise.resolve(2).finally(() => 77)` fulfils with **2**. A `return` is ignored. But a
**throw** or a **rejected promise** from `finally` does replace the outcome, destroying the
original error.

**★ Why isn't this error caught?** `new Promise(() => { setTimeout(() => { throw e; }) })`
Because the throw happens on a fresh stack in a later task; the executor has already
returned. Only a **synchronous** throw during the executor becomes a rejection. Call
`reject(e)` from asynchronous code instead. The same applies to a throw *after* `resolve()`
— MDN's "Silenced Exception" case, where the promise has already settled.

**Does `then` run synchronously if the promise is already settled?**
No. *"The call always happens asynchronously, even when the current promise is already
settled."* The returned promise is also *"always pending when returned"*.

**Why does `finally` receive no argument?**
MDN: *"by design for cases where you do not care about the rejection reason or the
fulfillment value"* — it runs on both paths, so there is no single argument that would make
sense.

---

← Prev [01 · The three states](./01-the-three-states.md) · [Topic index](./README.md) · Next → [03 · Returning a value vs a promise](./03-value-vs-promise.md)
