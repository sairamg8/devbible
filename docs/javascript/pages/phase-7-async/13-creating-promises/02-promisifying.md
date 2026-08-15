---
title: "02 · Promisifying a callback API"
sidebar_label: "02 · Promisifying"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Promise()` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise), [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [`AbortSignal.reason`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/reason), [`EventTarget.addEventListener()` § signal](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener), [`FileReader`](https://developer.mozilla.org/en-US/docs/Web/API/FileReader), [`Error.cause`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause) — and Node.js [`util.promisify`](https://nodejs.org/api/util.html#utilpromisifyoriginal), [`fs/promises`](https://nodejs.org/api/fs.html#promises-api). Documentation-validated; **no timings, no console blocks**.

This is the constructor's real job, and the only one
([01](./01-the-executor.md)): taking an API that reports its result some other way and giving
it back as a promise. There are three shapes worth knowing, and one rule that governs all of
them.

🔴 **The rule: the wrapper owns settlement *and* cleanup.** Every path — success, failure,
cancellation, a synchronous throw from the API itself — must settle the promise and release
whatever it registered. Everything below is that rule applied to a different callback shape.

## Shape 1 · The error-first callback

Node's convention: one callback, error in the first argument, result in the second.

```js
function promisify(fn) {
  return (...args) =>
    new Promise((resolve, reject) => {
      fn(...args, (err, value) => (err ? reject(err) : resolve(value)));
    });
}

const readFile = promisify(fs.readFile);
```

That is the whole idea, and it is worth being able to write from memory — it is a standard
interview exercise, and the fuller version with edge cases is
**Phase 17 · 14 · `promisify`** *(not written yet)*.

Three details separate the memorised version from the correct one:

**Keep `this`.** Promisifying a *method* and calling it detached loses the receiver. Take the
object explicitly, or use an arrow that closes over it:

```js
const stat = (...args) => new Promise((res, rej) =>
  client.stat(...args, (e, v) => (e ? rej(e) : res(v))));    // ✅ still called on `client`
```

**Catch a synchronous throw.** Plenty of callback APIs validate arguments and throw *before*
ever calling back. Inside the executor that throw already becomes a rejection
([01, rule 3](./01-the-executor.md)) — which is exactly why the `fn(...)` call belongs
**inside** the executor and not before it.

**Multiple result values are lost.** `callback(null, a, b)` has nowhere to go: a promise
carries one value. Resolve with an object or array deliberately. Node's own `util.promisify`
handles this with the **`util.promisify.custom` symbol** — a function can publish its own
promisified form, and `util.promisify` uses it instead of the generic wrapper.

⚠️ **In Node, reach for the built-in promise API before promisifying anything.** `fs/promises`,
`timers/promises`, `dns/promises` and `stream/promises` already exist, are better tested than
your wrapper, and support `AbortSignal`. `util.promisify` is for the libraries that never got
one.

## Shape 2 · Two callbacks, success and failure

Older browser and library APIs take separate handlers. The mapping is direct:

```js
const getPosition = (options) =>
  new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
```

🔴 **Check what the failure callback actually receives.** `GeolocationPositionError` is *not* an
`Error` — it has `code` and `message` but no stack, so `err instanceof Error` is false and a
logger that expects a stack gets nothing. When the API's failure value is not an `Error`, wrap
it:

```js
(err) => reject(new Error(`Geolocation failed: ${err.message}`, { cause: err }))
```

`cause` keeps the original for anyone who needs `code`, and the outer `Error` gives you the
stack — the pattern set out in
[08 · Rejections that vanish](../08-error-handling/02-rejections-that-vanish.md).

## Shape 3 · Events — the one that leaks

`FileReader`, `XMLHttpRequest`, `<img>`, `<script>`, `IndexedDB` and every `EventTarget` report
completion by firing an event. The naive wrapper is wrong in two ways at once:

```js
// ❌ leaks: the listeners survive, and 'error' is unhandled once 'load' has fired
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', reject);
    img.src = src;
  });
}
```

Both listeners stay attached forever, each holding the promise's `resolve`/`reject` closures and
the element. The settle-once rule means the *second* event does no damage — but the references
are still there, which is the leak catalogued in
[Phase 8 · 04 · The four leaks](../../phase-8-modules-errors/04-leaks/02-the-four-leaks.md).

**The fix is one `AbortController`, used as the wrapper's teardown:**

```js
function loadImage(src, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const ac = new AbortController();
    const done = (fn) => (arg) => { ac.abort(); fn(arg); };   // settle, then detach everything

    const img = new Image();
    img.addEventListener('load', done(() => resolve(img)), { signal: ac.signal });
    img.addEventListener('error', done(() =>
      reject(new Error(`Failed to load ${src}`))), { signal: ac.signal });

    signal?.addEventListener('abort', done(() => {
      img.src = '';                       // ask the browser to stop fetching
      reject(signal.reason);
    }), { signal: ac.signal, once: true });

    if (signal?.aborted) return done(() => reject(signal.reason))();
    img.src = src;
  });
}
```

Every listener is registered with `{ signal: ac.signal }`, so **one `ac.abort()` removes all of
them** — no matter which path settled the promise. That is the shape to copy: an internal
controller for cleanup, an optional external signal for cancellation.

⚠️ **Check `signal.aborted` before starting.** A signal that is already aborted when you are
called fires no `abort` event, and the wrapper would start work nobody wants.

### An event that fires more than once cannot be a promise

A promise settles once. An API that reports *progress* — `progress` events, a stream of
messages, a `change` listener — has no promise-shaped answer, and forcing one silently discards
everything after the first event.

| The API reports | Wrap it as |
|---|---|
| one result, then done | a **promise** |
| many values over time | an **async iterator** — **Phase 6 · 06 · Async iterators** *(not written yet)* |
| an ongoing stream of notifications | leave it as events, or an `EventTarget` |
| one result **plus** progress | a promise for the result, a callback for progress |

That last row is the pragmatic one: `upload(file, { onProgress })` returning a promise gives you
both without pretending progress is a settlement.

## Cancellation belongs in the wrapper, not around it

`Promise.race` against a timeout is not cancellation — the underlying work carries on, its
listeners stay attached, and its eventual result is discarded rather than prevented. A wrapper
that accepts a `signal` can actually stop the work: abort the request, clear the timer, close
the reader. Doing that everywhere, and composing signals, is **14 · Cancellation** *(not written
yet)*; the timer version of the same helper is
[12 · 01 · Tying a timer to an `AbortSignal`](../12-timers/01-the-api.md).

## Do not wrap what is already a promise

```js
// ❌ the explicit-construction anti-pattern
const getUser = (id) => new Promise((resolve, reject) => {
  fetch(`/users/${id}`).then((r) => r.json()).then(resolve, reject);
});

// ✅
const getUser = async (id) => (await fetch(`/users/${id}`)).json();
```

The wrapper adds a layer that can only lose information — a forgotten `reject`, a swallowed
sync throw, a lost `AbortSignal`. Full argument:
[11 · The explicit-construction anti-pattern](../11-anti-patterns/01-explicit-construction.md).

## Gotchas

**Symptom: the promisified method throws `Cannot read properties of undefined`.**
Cause — the method was detached from its object, so `this` is wrong.
Fix — call it on the owner: `obj.method(...)` inside the executor, or `.bind(obj)`.

**Symptom: `err instanceof Error` is false in the `.catch`.**
Cause — the wrapped API rejects with its own error-shaped object, not an `Error`.
Fix — wrap it: `new Error(msg, { cause: original })`.

**Symptom: only the first of several callback values survives.**
Cause — a promise carries one value.
Fix — resolve with an object or tuple, or expose a `util.promisify.custom` implementation.

**Symptom: memory grows with every wrapped call.**
Cause — event listeners registered in the executor were never removed after settling.
Fix — register them with `{ signal }` from an internal `AbortController` and abort it on settle.

**Symptom: a wrapper given an already-aborted signal starts the work anyway.**
Cause — no `abort` event fires for a signal that was aborted before you listened.
Fix — check `signal.aborted` (or `signal.throwIfAborted()`) first.

**Symptom: cancelling with `Promise.race` against a timeout does not stop the request.**
Cause — `race` only ignores the loser; it cannot cancel it.
Fix — pass an `AbortSignal` into the wrapper and abort the underlying work.

**Symptom: a promisified progress API reports only the first event.**
Cause — a promise settles once, so every later event is discarded.
Fix — a promise for the result plus a progress callback, or an async iterator.

**Symptom: the wrapped API validates its arguments and the throw escapes your `.catch`.**
Cause — it was called outside the executor.
Fix — call it inside; the constructor converts a synchronous throw into a rejection.

## Interview questions

**★ Write `promisify` for an error-first callback API.**
Return a function that takes the arguments, and inside `new Promise` calls the original with an
extra callback: `(err, value) => err ? reject(err) : resolve(value)`. Call the original **inside**
the executor so a synchronous throw becomes a rejection, and keep the receiver so `this` survives.

**★ Why must the listeners be removed after the promise settles?**
Because they hold `resolve`/`reject` and everything those close over. Settle-once means the
extra events are harmless, but the references keep the graph alive. Register with
`{ signal }` from an internal `AbortController` and abort it when you settle.

**★ How do you add cancellation to a promisified API?**
Accept an `AbortSignal`, reject with `signal.reason` on `abort`, actually stop the underlying
work, and check `signal.aborted` before starting. `Promise.race` with a timeout is not
cancellation — the work continues and only its result is ignored.

**★ What can't be promisified?**
Anything that produces more than one value: progress events, streams, subscriptions. A promise
settles once, so the rest would be discarded. Use an async iterator or keep the event API.

**★ An error-first callback returns two values, `(err, a, b)`. What happens?**
A promise carries a single value, so `b` is lost unless you resolve with an object or array.
Node handles this via the `util.promisify.custom` symbol.

**★ Why call the wrapped function inside the executor rather than before it?**
So that a synchronous throw from it is converted into a rejection instead of escaping to the
caller as an exception — otherwise the same failure arrives two different ways.

**When should you not write a wrapper at all?**
When a promise-based version already exists — `fs/promises`, `timers/promises`, `fetch` — or
when the thing you are wrapping already returns a promise.

---

← [01 · The executor](./01-the-executor.md) · [Topic index](./README.md)
