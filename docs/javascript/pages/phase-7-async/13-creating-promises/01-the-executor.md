---
title: "01 · The executor, and the rules it obeys"
sidebar_label: "01 · The executor"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Promise()` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise), [`Promise.resolve()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve), [`Promise.reject()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/reject), [`Promise.try()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/try) — and ECMAScript [§ Promise Objects](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise-objects). Documentation-validated; **no timings, no console blocks**.

```js
const p = new Promise((resolve, reject) => {
  // the executor
});
```

The function you pass is the **executor**, and everything surprising about the constructor
follows from five rules it obeys. Learn the rules once and every "why didn't my promise settle"
question answers itself.

## Rule 1 · The executor runs synchronously, immediately

It is not scheduled. It runs *during* the `new Promise(...)` call, before the constructor
returns, on the current stack:

```js
console.log('a');
const p = new Promise((resolve) => { console.log('b'); resolve(); });
console.log('c');
// a, b, c — 'b' is synchronous
```

🔴 **Only the *settlement* is asynchronous, never the executor.** `resolve()` does not run
`.then` callbacks; it marks the promise settled and *queues* the reactions as microtasks. So
work you put directly in the executor blocks the caller exactly as much as it would anywhere
else — wrapping a slow synchronous function in `new Promise` makes it no less blocking.

```js
// ❌ still blocks the thread for the whole parse
const parsed = new Promise((resolve) => resolve(JSON.parse(hugeString)));
```

## Rule 2 · A promise settles exactly once, and later calls are ignored

```js
new Promise((resolve, reject) => {
  resolve('first');
  resolve('second');   // ignored
  reject(new Error());  // ignored
});
```

The second and third calls are **not errors** — they do nothing at all. This is the
constructor's one genuinely forgiving property, and it makes the wrapping patterns in
[02](./02-promisifying.md) safe: a callback that fires twice cannot corrupt the promise.

⚠️ **Forgiving is not free.** Silently ignoring the second settle means a double-callback bug
in the API you wrapped produces no signal whatsoever. If that matters, count the calls yourself
and log the second one.

## Rule 3 · Throwing in the executor rejects — until it has settled

```js
new Promise(() => { throw new Error('boom'); });          // rejected with boom
new Promise((resolve) => { resolve(1); throw new Error('boom'); });  // fulfilled with 1
```

The constructor catches a throw and turns it into a rejection — but **only while the promise is
still pending**. Once settled, rule 2 applies: the throw is swallowed entirely. No rejection,
no `unhandledrejection`, no console output. It is one of the few places in JavaScript where an
exception genuinely vanishes.

🔴 **The `async` executor is the version of this that bites people:**

```js
// ❌ never do this
new Promise(async (resolve, reject) => {
  const data = await fetchThing();     // if this rejects…
  resolve(data);
});
```

An `async` function does not *throw* — it **returns a rejected promise**, and the constructor
discards the executor's return value. So the failure never reaches `reject`; it becomes an
unhandled rejection while the outer promise stays **pending forever**. If your executor wants
`await`, you did not need the constructor: return the `async` function's promise directly. The
family this belongs to is [11 · Promise anti-patterns](../11-anti-patterns/01-explicit-construction.md).

## Rule 4 · `resolve` adopts; `reject` does not

This asymmetry is the most-missed detail of the constructor, and MDN calls it out explicitly.

```js
resolve(somePromise);   // the outer promise ADOPTS it — follows its state and value
reject(somePromise);    // the outer promise REJECTS, with the promise object as the reason
```

`resolve` is really "resolve **with**": hand it a promise or any **thenable** (any object with a
callable `then`) and the outer promise waits for it and takes on its eventual state. Hand it a
plain value and the promise fulfils with that value. This is what makes a chain flatten, and the
mechanism it shares with `.then` returning a promise is
[06 · Flattening](../06-chaining/01-flattening.md). Thenables in general — including
non-native promise libraries — are **21 · Thenables** *(not written yet)*.

`reject` has no such behaviour. It takes the argument literally, always, which is why
`reject(Promise.reject(err))` gives you a rejection whose `reason` is a promise rather than
`err`. **Reject with an `Error`, never with a promise and never with a bare string** — see
[08 · Rejections that vanish](../08-error-handling/02-rejections-that-vanish.md).

### Two consequences worth knowing

**Resolving a promise with itself throws.** `resolve(p)` where `p` is the promise being
constructed produces a `TypeError: Chaining cycle detected` — the promise rejects with that
error rather than hanging.

**Adoption costs extra microtask ticks.** Following a thenable is itself specified in terms of
microtasks, so a promise resolved with another promise settles a couple of ticks later than one
resolved with a plain value. It never changes *what* you get, only the interleaving — the kind
of detail [03 · The drain order](../03-microtasks-vs-macrotasks/01-the-drain-order.md) exists
to explain.

## Rule 5 · The executor's return value is discarded

```js
new Promise((resolve) => 42);        // pending forever; nothing resolved it
```

Nothing reads what the executor returns. A promise settles **only** because `resolve` or
`reject` was called, or because the executor threw. Every path through the executor must reach
one of those, including the early returns and the `catch` blocks — a `return` that skips the
`resolve` is a promise that stays pending, and a pending promise never errors, never times out
and never appears in any log. **A silent hang is the constructor's characteristic bug.**

## Most of the time you should not be using the constructor at all

| You want | Use | Not |
|---|---|---|
| a promise of a value you already have | `Promise.resolve(v)` | `new Promise((r) => r(v))` |
| a promise that is already rejected | `Promise.reject(err)` | `new Promise((_, r) => r(err))` |
| to run a function and capture *sync* throws as a rejection | `Promise.try(fn)` | a constructor wrapper |
| to sequence promise work | an `async` function | a constructor around it |
| to wrap a **callback or event** API | 🔴 `new Promise` — [02](./02-promisifying.md) | anything else |

**`Promise.resolve` is identity for a native promise.** `Promise.resolve(p) === p` when `p` is
already a `Promise`, so it is the cheap, correct way to normalise "value or promise" input. For
a thenable it returns a **new** promise that follows it.

**`Promise.try(fn, ...args)` is the modern answer to "what if `fn` throws synchronously".**
Calling `fn()` inside an ordinary expression lets a synchronous throw escape past your promise
chain; `Promise.try` calls it and routes both a sync throw and an async rejection into the same
rejected promise. It is the honest replacement for the old
`new Promise((resolve) => resolve(fn()))` trick.

🔴 **The rule of thumb: if the thing you are wrapping already returns a promise, the constructor
is wrong.** The single legitimate use is bridging a callback- or event-based API into the
promise world, which is the whole of [02](./02-promisifying.md).

## Gotchas

**Symptom: a promise never settles and nothing is logged.**
Cause — a path through the executor returned without calling `resolve` or `reject`.
Fix — make every branch settle; a pending promise produces no error to find.

**Symptom: `new Promise(async (resolve) => { … await … })` hangs and the console shows an
unhandled rejection.**
Cause — the `async` executor returned a rejected promise, which the constructor discards.
Fix — drop the constructor and return the `async` function's promise.

**Symptom: an exception thrown in the executor disappears.**
Cause — the promise had already settled, so the throw was ignored under the settle-once rule.
Fix — do not do work after resolving; if it must run, handle its errors itself.

**Symptom: `.catch(err => err.message)` gives `undefined`.**
Cause — something rejected with a non-`Error` — often a promise, because `reject` does not adopt.
Fix — always reject with an `Error`; pass the original as `{ cause }`.

**Symptom: `TypeError: Chaining cycle detected for promise`.**
Cause — the promise was resolved with itself.
Fix — resolve with the value, not the promise you are constructing.

**Symptom: wrapping a slow synchronous function in `new Promise` did not stop the UI freezing.**
Cause — the executor runs synchronously; only settlement is deferred.
Fix — move the work off the main thread, or chunk it.

**Symptom: a wrapped callback fires twice and the second result is lost silently.**
Cause — rule 2: later settle calls are ignored, by design.
Fix — count the calls in the wrapper if double-firing is a bug you need to see.

## Interview questions

**★ When does the executor function run?**
Synchronously, during `new Promise(...)`, before the constructor returns. Only the reactions —
`.then`/`.catch` callbacks — are deferred to the microtask queue.

**★ What happens if you call `resolve` twice?**
Nothing. A promise settles once; every later `resolve`, `reject` or throw is ignored without an
error.

**★ What is the difference between `resolve(p)` and `reject(p)` when `p` is a promise?**
`resolve` **adopts** `p` — the outer promise follows its state and value. `reject` takes the
argument literally, so you get a rejection whose reason *is* a promise object. Always reject
with an `Error`.

**★ Why is `new Promise(async (resolve, reject) => …)` wrong?**
Because an `async` executor signals failure by returning a rejected promise, and the constructor
ignores the return value. Errors escape as unhandled rejections while the outer promise stays
pending forever.

**★ When is `new Promise` actually the right tool?**
Only when bridging a non-promise API — a callback, an event, a timer, an `XMLHttpRequest` —
into the promise world. If what you are wrapping already returns a promise, the constructor is
the explicit-construction anti-pattern.

**★ What does `Promise.try` give you over calling the function directly?**
It captures a **synchronous** throw from the function as a rejection, so both sync and async
failure arrive through the same `.catch` instead of one escaping the chain.

**Does `Promise.resolve(p)` create a new promise?**
Not for a native promise — it returns the same object. For a thenable it returns a new promise
that follows it.

---

[Topic index](./README.md) · [02 · Promisifying a callback API](./02-promisifying.md) →
