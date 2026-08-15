---
title: "10.2 · Resolution, thenables and the rest"
sidebar_label: "02 · Resolution, thenables and the rest"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise), [`Promise.resolve()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve), [`Promise.withResolvers()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers). Documentation-validated; **nothing was run**.

**"Resolved" and "fulfilled" are not synonyms**, and the difference is the whole of this
chunk. A promise resolved *with another promise* is resolved but still pending — MDN's
example:

```js
new Promise((resolveOuter) => {
  resolveOuter(new Promise((resolveInner) => setTimeout(resolveInner, 1000)));
});
```

> "This promise is already *resolved* at the time when it's created (because the
> `resolveOuter` is called synchronously), but it is resolved with another promise, and
> therefore won't be *fulfilled* until 1 second later, when the inner promise fulfills."

The machinery that makes that work is the **resolution procedure**, and it is what
[10.1](./01-the-state-machine.md) deferred to `#resolveWith`.

## The resolution procedure

```js
#resolveWith(value, settle) {
  if (value === this) {                                     // ← self-resolution
    return settle(REJECTED, new TypeError("Chaining cycle detected for promise"));
  }

  if (value !== null && (typeof value === "object" || typeof value === "function")) {
    let then;
    try { then = value.then; }                              // reading .then can throw (a getter)
    catch (err) { return settle(REJECTED, err); }

    if (typeof then === "function") {                        // it is a THENABLE — adopt it
      let called = false;                                    // the thenable may be badly behaved
      try {
        then.call(
          value,
          (v) => { if (!called) { called = true; this.#resolveWith(v, settle); } },  // recurse
          (r) => { if (!called) { called = true; settle(REJECTED, r); } },
        );
      } catch (err) {
        if (!called) { called = true; settle(REJECTED, err); }
      }
      return;                                                // stay pending until the thenable settles
    }
  }

  settle(FULFILLED, value);                                  // a plain value
}
```

Five behaviours, all of them things an interviewer can ask about:

**1 · Thenables, not just promises.** MDN: *"A thenable implements the `.then()` method"*, and
*"promises are thenables as well."* Any object with a callable `then` is adopted — which is
how a jQuery deferred, a library's own promise, or a hand-written object interoperates with
native promises.

**2 · Adoption recurses.** The fulfilment handler calls `#resolveWith` again, so a thenable
that fulfils with another thenable is unwrapped repeatedly. MDN's example returns **42**:

```js
const thenable = {
  then(onFulfilled) { onFulfilled({ then(onFulfilled) { onFulfilled(42); } }); },
};
Promise.resolve(thenable);   // a promise fulfilled with 42
```

That is why you can never end up with a promise *for* a promise: `Promise.resolve` *"will
'follow' that thenable, adopting its eventual state"*.

**3 · Self-resolution is a `TypeError`.** Resolving a promise with itself would wait forever,
so it is defined as a rejection instead — the "chaining cycle" check.

**4 · Reading `.then` is done once, defensively.** It may be a getter that throws, and calling
it twice could return different functions. Read it into a local, then call.

**5 · The `called` flag.** A foreign thenable can call both callbacks, or call one twice.
First call wins; the rest are ignored. This is the same one-way guard as settling, one level
down, and it exists because the thenable is untrusted code.

## Why `resolve` and `reject` are asymmetric

`reject(reason)` settles immediately with whatever it is given — **a promise passed to
`reject` is not unwrapped**, and becomes the rejection reason itself:

```js
reject(Promise.resolve(1));    // rejected WITH a promise object
```

`resolve` runs the whole procedure above. The asymmetry is deliberate: adoption is about
*following* an eventual value, and a rejection reason is a value, not a plan.

## The statics, in a few lines each

```js
static resolve(value) {
  if (value instanceof MyPromise) return value;                 // already ours — pass through
  return new MyPromise((res) => res(value));                    // res() handles thenables
}
static reject(reason) { return new MyPromise((_, rej) => rej(reason)); }

static withResolvers() {                                        // the deferred, standardised
  let resolve, reject;
  const promise = new MyPromise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
```

`Promise.resolve` returning its argument unchanged when it is already the right kind of
promise is a real optimisation in the native version, and a detail worth mentioning.
`withResolvers` is the built-in version of the "deferred" pattern — the reason it can exist at
all is that the executor runs synchronously, so the captured `resolve`/`reject` are assigned
before the constructor returns ([Phase 7 · 05 · Promises](../../phase-7-async/05-promises/README.md)).

The combinators — `all`, `allSettled`, `race`, `any` — are their own topic
([04 · `Promise.all`, `race`, `any`, `allSettled`](../04-promise-combinators/README.md)) and
build only on what is above.

## What a real implementation adds

Say this list out loud rather than pretending the exercise is complete:

- **Promises/A+ compliance**, verified against the official test suite, which exists
  precisely because the thenable rules are easy to get subtly wrong.
- **Unhandled rejection tracking.** The runtime reports a rejection nobody handled; that
  requires knowing whether a rejection was ever consumed, which a teaching implementation
  ignores ([Phase 8 · 10 · Global error handling](../../phase-8-modules-errors/README.md)).
- **Species and subclassing** — `then` on a subclass constructs via `Symbol.species` rather
  than hard-coding the class.
- **Engine integration.** Native promises schedule on the real microtask queue, are visible to
  `await`, and get async stack traces. `queueMicrotask` gets the timing right; nothing gets you
  the debugging.

## Gotchas

**Symptom:** Resolving with a promise produced a promise-for-a-promise
**Cause:** No resolution procedure — the thenable was stored as a plain value.
**Fix:** Detect a callable `.then` and adopt it, recursing on the value it supplies.

**Symptom:** `p.resolve(p)` hung forever
**Cause:** A promise waiting on itself.
**Fix:** Reject with `TypeError("Chaining cycle detected for promise")`.

**Symptom:** A foreign thenable settled the promise twice
**Cause:** The thenable called both callbacks, or one of them repeatedly.
**Fix:** A `called` flag — first call wins.

**Symptom:** A `then` getter that throws crashed resolution
**Cause:** `value.then` read outside a `try`.
**Fix:** Read it into a local inside `try`, and reject on failure.

**Symptom:** `reject(somePromise)` behaved unexpectedly
**Cause:** `reject` does not unwrap — the promise **is** the reason.
**Fix:** Expected; reject with an `Error`, and `throw` inside a handler if you meant to adopt.

**Symptom:** The custom promise worked with itself but not with `await`
**Cause:** `await` accepts thenables, so it works — but the reverse (native `.then` receiving
your object) also relies on a correct `then` signature.
**Fix:** Keep `then(onFulfilled, onRejected)` exactly, and call handlers with one argument.

**Symptom:** Unhandled rejections were silent
**Cause:** Rejection tracking is engine machinery, not part of the state machine.
**Fix:** Not implementable at this level — use native promises in production.

## Interview questions

**★ What is the difference between "resolved" and "fulfilled"?**
Fulfilled is a settled state with a value. Resolved means the fate is decided — which may mean
*following another promise* and therefore still pending. MDN's example is resolved
immediately but not fulfilled for a second.

**★ What is a thenable, and why does it matter?**
Any object with a callable `then`. The resolution procedure adopts it, which is what lets
promises from different libraries and hand-written objects interoperate — and why
`Promise.resolve(thenable)` *"follow[s] that thenable, adopting its eventual state."*

**★ What happens if a promise is resolved with itself?**
A `TypeError` — "chaining cycle detected". Otherwise it would wait on itself forever, so the
spec defines a rejection instead.

**★ Why does the resolution procedure recurse?**
Because a thenable can fulfil with another thenable. Recursing unwraps them until a
non-thenable value appears — MDN's nested example fulfils with `42`.

**Why is a `called` flag needed when adopting a thenable?**
The thenable is untrusted: it may call both callbacks or the same one twice. First call wins;
everything after is ignored, mirroring the settle-once guard.

**Does `reject` unwrap a promise the way `resolve` does?**
No. `reject` settles with the value as given, so rejecting with a promise makes that promise
object the reason. Adoption is only about following an eventual value.

**What does your implementation not do that the native one does?**
A+ compliance verified by the test suite, unhandled-rejection reporting, `Symbol.species`
subclassing, real microtask-queue integration and async stack traces.

---

← Prev [The state machine and `then`](./01-the-state-machine.md) · [Topic index](./README.md)
