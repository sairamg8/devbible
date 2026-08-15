---
title: "14.2 · What it cannot bridge"
sidebar_label: "02 · What it cannot bridge"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against Node.js — [`util.promisify`](https://nodejs.org/api/util.html#utilpromisifyoriginal), [`util.callbackify`](https://nodejs.org/api/util.html#utilcallbackifyoriginal), [`child_process.exec`](https://nodejs.org/api/child_process.html#child_processexeccommand-options-callback), the implementation in [`lib/internal/util.js`](https://github.com/nodejs/node/blob/main/lib/internal/util.js) — and MDN [`Promise()` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise), [`Geolocation.getCurrentPosition()`](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition), [`Error.cause`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause). Documentation-validated; **nothing was run**.

**A generic promisifier is a bet that the API obeys a convention**, and the interesting half of
this topic is what happens when it does not. Node's documentation is blunt about the bet:

> *"`promisify()` assumes that `original` is a function taking a callback as its final argument in
> all cases."*
>
> *"If `original` is a function but its last argument is not an error-first callback, it will still
> be passed an error-first callback as its last argument."*

**It will not warn you.** It appends a callback and hopes. Three questions decide whether that
hope is justified.

| | Question | If the answer is no |
|---|---|---|
| 1 | Is the callback the **last** argument? | Your callback lands in the wrong slot, or is never called at all |
| 2 | Is it **error-first**? | Success and failure swap places — silently |
| 3 | Does it fire **exactly once**? | Everything after the first call disappears |

## 1 · Not error-first — the failure looks like success

Take an API whose callback receives a plain value:

```js
exists(path, (found) => { … });      // found is a boolean, not an error
const check = promisify(exists);

await check(path);                    // ⛔ found === true  → rejects with `true`
                                      // ⛔ found === false → resolves with undefined
```

Both outcomes are wrong, and they are wrong in the worst possible way: the *success* case throws
and the *failure* case resolves. Nothing anywhere reports a problem, because the wrapper cannot
tell a value from an error — that is the convention's entire job.

The browser's version of this shape is a **pair** of callbacks, which no error-first wrapper can
reach at all:

```js
navigator.geolocation.getCurrentPosition(success, error, options);
```

MDN describes `success` as taking *"a `GeolocationPosition` object as its sole input parameter"*
and `error` as taking *"a `GeolocationPositionError` object as its sole input parameter"*. Two
independent callbacks, neither of which carries an error slot. The bridge is three lines and
must be written by hand:

```js
const getPosition = (options) =>
  new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, options));
```

⚠️ **You reject with whatever the API hands you**, and platform failure objects are not always
`Error` instances — no stack, and `err instanceof Error` may be `false`. If the caller is going
to log or re-throw it, wrap it: `reject(new Error("Geolocation failed", { cause: err }))`.

📌 **The shape of the adapter is the same every time** — call the API, resolve on its success path,
reject on its failure path. Writing one per awkward API is the correct answer, not a cleverer
generic promisifier.

## 2 · Fires more than once — then it is a stream, not a promise

A promise settles once: *"Only the first call to `resolveFunc` or `rejectFunc` affects the
promise's eventual state."* Wrapping a many-shot callback therefore **compiles, runs, and throws
away all but the first result**.

```js
watcher.on("change", cb);        // many
upload(file, onProgress, done);  // many, then one
socket.subscribe(cb);            // many, forever
```

The promise resolves on the first event and the rest go nowhere — while the underlying
subscription stays alive, holding the callback, its closure and everything the closure captured.
**One value delivered, a leak left behind.**

The right target is an async iterator, which is exactly a promise-per-value with a defined end
([Phase 6 · 06 · Async iterators](../../phase-6-iteration-and-destructuring/06-async-iterators/README.md),
[Phase 6 · 07 · Paginating an API](../../phase-6-iteration-and-destructuring/07-paginating-an-api/README.md)):

```js
for await (const change of watch(dir)) { … }
```

The one honest exception is a **terminal** event on a one-shot operation — `load`/`error` on a
`FileReader`, `end` on a single request. That is a promise, and the wrapper must remove both
listeners on either outcome or it leaks the same way
([Phase 7 · 13 · Promisifying a callback API](../../phase-7-async/13-creating-promises/02-promisifying.md)
works through that listener-leak fix in detail).

## 3 · Already returns a promise — the wrapper hangs

```js
const worse = promisify(async function work() { … });
await worse();                    // ⛔ never settles
```

The async function ignores the extra argument, never calls it, and the executor's `resolve` is
never reached. There is no error, no rejection and no timeout — the `await` simply never returns,
which is the most expensive failure mode in the list to diagnose.

Node guards against it: its implementation checks whether the original returned a promise and
emits a **`DeprecationWarning` (DEP0174)** reading *"Calling promisify on a function that returns
a Promise is likely a mistake."* Copy the check if your wrapper will be used by other people —
warning loudly beats hanging quietly.

## 4 · Cancellation, timeouts and cleanup are not in the contract

An error-first callback describes **how a result is delivered**, and nothing else. Wrapping it
adds no way to stop the work, no deadline and no cleanup hook. `Promise.race` against a timer
gives the *caller* an early rejection while the original operation keeps running to completion —
the file still gets read, the request still gets sent.

If the API accepts an `AbortSignal` or returns a handle, the adapter has to thread it through by
hand, which is one more reason a hand-written adapter beats a generic wrapper for anything you
depend on ([08 · Retry with backoff, jitter and an `AbortSignal`](../08-retry-backoff/README.md),
[Phase 7 · 14 · Cancellation](../../phase-7-async/14-cancellation/01-the-model.md)).

## Publishing your own promise version — `promisify.custom`

When an API cannot be bridged generically, its **author** fixes it once for everyone by attaching
an implementation under the registered symbol. Node's own `child_process.exec` is the canonical
example, because its callback carries two values:

> *"If this method is invoked as its `util.promisify()`ed version, it returns a `Promise` for an
> `Object` with `stdout` and `stderr` properties."*
>
> *"The returned `ChildProcess` instance is attached to the `Promise` as a `child` property."*
>
> *"In case of an error (including any error resulting in an exit code other than 0), a rejected
> promise is returned, with the same `error` object given in the callback, but with two additional
> properties `stdout` and `stderr`."*

Three decisions worth stealing from that one paragraph: **a named object** rather than a tuple,
**an escape hatch** (`child`) for what the promise shape cannot express, and **failure data
attached to the error** instead of being lost with the resolution path.

Publishing one is a single assignment:

```js
readPair[Symbol.for("nodejs.util.promisify.custom")] = (id) =>
  new Promise((resolve, reject) =>
    readPair(id, (err, head, body) => (err ? reject(err) : resolve({ head, body }))));
```

⚠️ Node names multi-value results internally through a **different, non-public** symbol
(`Symbol('customPromisifyArgs')`). It is not part of the API — do not reach for it. The supported
route is the registered `promisify.custom` symbol above.

## The other direction — `callbackify`

Occasionally the bridge runs the other way: an async function has to satisfy an interface that
takes an error-first callback, such as an older plugin or middleware contract. Node ships
`util.callbackify`, and its documented behaviours are the ones to reproduce if you write your own:

> *"In the callback, the first argument will be the rejection reason (or `null` if the `Promise`
> resolved), and the second argument will be the resolved value."*
>
> *"Since `null` has a special meaning as the first argument to a callback, if a wrapped function
> rejects a `Promise` with a falsy value as a reason, the value is wrapped in an `Error` with the
> original value stored in a field named `reason`."*
>
> *"The callback is executed asynchronously, and will have a limited stack trace."*
>
> *"If the callback throws, the process will emit an `'uncaughtException'` event, and if not
> handled will exit."*

🔴 **The falsy-rejection rule is the interesting one**, and it is the exact mirror of `if (err)`
from [14.1](./01-writing-it.md). `Promise.reject(null)` cannot be passed straight into an
error-first callback, because `null` in that slot *means success* — so it is boxed in an `Error`
carrying `reason`. Both halves of the bridge have to take a position on falsy errors, and neither
position is free.

Note the last sentence too: once you hand control back to a callback, a throw is no longer a
rejection anybody can catch. It becomes a process-level event.

## Do not promisify what already has a promise API

Node ships promise versions of most of its callback APIs — `node:fs/promises`,
`node:timers/promises`, `node:dns/promises` — and they are better than a wrapper over the callback
form: they were designed as promise APIs, they accept `AbortSignal`, and they are maintained.
`util.promisify` is for the libraries that never made the transition.

The same holds for `promisifyAll`-style helpers that walk an object and wrap every method. Node
never shipped one, and the reasons are worth being able to state: **you cannot detect** which
functions take a callback, the generated names collide with real ones, methods still need their
receiver, and touching every property can trigger getters with side effects. Wrap the three
functions you actually call, explicitly, where a reader can see them.

## Gotchas

**Symptom:** The promisified call resolves with `undefined` when the operation clearly failed.
**Cause:** The API is not error-first — a falsy value in the first slot reads as success.
**Fix:** Write an adapter for that API's shape; a generic promisifier cannot detect this.

**Symptom:** `await` never returns, with no error and no rejection.
**Cause:** The original already returns a promise, so it never calls the appended callback.
**Fix:** Call it directly. Add Node's returns-a-promise check to your own wrapper so it warns.

**Symptom:** Only the first progress event arrives, and memory grows.
**Cause:** A many-shot callback behind a promise — later calls are ignored while the subscription
stays alive.
**Fix:** An async iterator for the stream; a promise only for a terminal, one-shot event, with
both listeners removed on either outcome.

**Symptom:** The timeout fired but the work carried on.
**Cause:** `Promise.race` rejects the caller's promise; it cannot cancel the original operation.
**Fix:** Thread an `AbortSignal` (or the API's own cancel handle) through a hand-written adapter.

**Symptom:** A rejected promise crashed the process after `callbackify`.
**Cause:** The callback threw, which Node surfaces as `'uncaughtException'`.
**Fix:** Keep the callback trivial — hand off, do not compute in it.

**Symptom:** `err.reason` appeared out of nowhere in a callback-shaped API.
**Cause:** The promise rejected with a falsy value, so `callbackify` boxed it in an `Error`.
**Fix:** Reject with an `Error`. Rejecting with `null` was never a good contract.

## Interview questions

**★ When can you not use a generic `promisify`?**
When the callback is not last, is not error-first, fires more than once, or the function already
returns a promise. Each fails silently in a different way — inverted results, dropped values, or a
hang.

**★ How would you promisify `navigator.geolocation.getCurrentPosition`?**
By hand — it takes two callbacks. `new Promise((resolve, reject) =>
getCurrentPosition(resolve, reject, options))`, wrapping the rejection in an `Error` with `cause`
if the caller needs a stack.

**★ What happens if you promisify an async function?**
The returned promise never settles, because the callback is never called. Node emits a
`DeprecationWarning` (DEP0174) for exactly this.

**★ Why can a promise not represent a progress callback?**
A promise settles once. The first event resolves it and every later one is dropped, while the
subscription stays alive and leaks. Progress needs an async iterator or an event listener.

**★ What is `util.promisify.custom` for, and when do you publish one?**
To let an API supply its own promise version when the generic wrapper would be wrong — most often
a multi-value callback. `child_process.exec` publishes one that resolves `{ stdout, stderr }`.

**Does wrapping in a promise give you cancellation?**
No. `Promise.race` with a timer rejects the caller while the underlying work continues. Real
cancellation has to be supported by the API, usually through `AbortSignal`.

**What does `util.callbackify` do about a promise rejected with `null`?**
It wraps the value in an `Error` with the original stored on `reason`, because `null` in the first
callback slot means success.

---

← Prev [Writing it](./01-writing-it.md) · [Topic index](./README.md)
