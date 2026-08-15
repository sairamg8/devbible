---
title: "01 · The model — controller, signal, reason"
sidebar_label: "01 · The model"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [`AbortController.abort()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal), [`AbortSignal.reason`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/reason), [`AbortSignal.throwIfAborted()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted), [`AbortSignal: abort event`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/abort_event), [`DOMException`](https://developer.mozilla.org/en-US/docs/Web/API/DOMException), [`EventTarget.addEventListener()` § signal](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener) — and the [DOM Standard § Aborting ongoing activities](https://dom.spec.whatwg.org/#aborting-ongoing-activities). Documentation-validated; **no timings, no console blocks**.

🔴 **A promise cannot be cancelled. There is no `promise.cancel()`, and there never was.** A
promise is a *report* of a result, not the work producing it — cancelling the report would not
stop the work. What the platform gives you instead is a way to ask the *work* to stop, and a
standard way for it to say it did: `AbortController` and `AbortSignal`.

## Two halves, on purpose

```js
const controller = new AbortController();
const { signal } = controller;

doWork({ signal });        // the callee gets the read-only half
controller.abort();        // only the caller can pull the lever
```

| | `AbortController` | `AbortSignal` |
|---|---|---|
| Who holds it | the code that **starts** the work | the code that **does** the work |
| Can abort | ✅ `abort(reason?)` | ❌ — read-only |
| Exposes | `.signal` | `.aborted`, `.reason`, `.throwIfAborted()`, the `abort` event |

**Pass the signal, never the controller.** Handing a callee the controller lets it cancel its
own caller's work — and lets it cancel siblings sharing the same controller. This split is the
entire design; treat it as the API contract rather than a formality.

## Abort is cooperative, and that is a real limitation

The signal is a request. Something has to be listening, and only APIs that were built to honour
one will stop:

```js
const c = new AbortController();
c.abort();
await hugeSynchronousParse(text);   // ❌ the signal cannot interrupt this
```

Nothing in the platform preempts running JavaScript. A signal can stop a `fetch`, a timer, an
event listener, a Node stream or **your own loop that checks it** — it cannot interrupt a
synchronous block or a third-party promise that never took a signal.

🔴 **Consequence: cancellation is a property your own functions must opt into and *propagate*.**
A function that takes a `signal` and does not pass it to the work it starts has a cancellation
API that does nothing.

## `reason` — what an aborted operation rejects with

`abort()` may be given a reason, and that value becomes `signal.reason` and the rejection value
of whatever was aborted:

```js
controller.abort();                             // reason = DOMException, name 'AbortError'
controller.abort(new Error('user navigated'));  // reason = that Error
```

**With no argument the reason is a `DOMException` whose `name` is `"AbortError"`.** That default
is what every "why is my catch getting an AbortError" question is about, and it is the value
`fetch` rejects with when its signal fires.

### Do not treat an abort as a failure

```js
try {
  await load({ signal });
} catch (err) {
  if (err.name === 'AbortError') return;   // 🔴 expected: we cancelled it
  report(err);
}
```

An abort you asked for is not an error to log, retry or show the user. Checking `err.name` is
the portable test — `instanceof DOMException` is fine in a browser but not across every
runtime, and `AbortError` is what the platform sets. A custom reason gives you something
richer to branch on, which is why passing one is worth the extra characters.

⚠️ **`abort()` on an already-aborted controller does nothing.** The first reason wins; a second
call fires no event and does not replace `reason`. It is safe to call defensively in teardown.

## Reading the signal: three ways, for three situations

### `signal.aborted` — the guard before you start

```js
async function load(url, { signal } = {}) {
  if (signal?.aborted) return;                 // never start work already cancelled
  …
}
```

🔴 **A signal that was aborted before you attached fires no `abort` event.** Listening is not
enough; every entry point must check the flag first. This is the single most common bug in
hand-written cancellable functions.

### `signal.throwIfAborted()` — the checkpoint inside a loop

```js
for (const chunk of chunks) {
  signal.throwIfAborted();       // throws signal.reason, whatever it is
  await process(chunk);
}
```

It throws `signal.reason` if aborted and does nothing otherwise — one line that both checks and
propagates the right value. **Put a checkpoint after every `await` in a long loop**: the abort
can land while you were suspended, and without a check the loop happily continues doing work
nobody wants.

### The `abort` event — for work you must actively unwind

```js
signal.addEventListener('abort', () => {
  reader.releaseLock();
  clearTimeout(id);
  reject(signal.reason);
}, { once: true });
```

Use the event when abortion requires *doing* something — closing a socket, clearing a timer,
rejecting a promise you created ([13 · Promisifying](../13-creating-promises/02-promisifying.md)).

**Always `{ once: true }`, or register with a `signal` of your own.** The `abort` event fires at
most once, but the listener stays attached until removed, holding its closure. On a long-lived
signal — one that outlives the operation — that is a straightforward leak.

## `signal` is accepted far beyond `fetch`

The same object is threaded through much of the platform, and that uniformity is the point:

| API | How the signal is used |
|---|---|
| `addEventListener(type, fn, { signal })` | removes the listener on abort — no `removeEventListener` |
| `fetch(url, { signal })` | aborts the request; the promise rejects with `signal.reason` |
| Node `fs/promises`, `timers/promises`, `stream/promises` | abort the pending operation |
| Node `events.once(emitter, name, { signal })` | stops waiting |
| your own functions | whatever you make it mean |

🔴 **`addEventListener`'s `signal` option deserves special attention** — it turns "remove these
fourteen listeners on teardown" into one `abort()`, and it is why an `AbortController` is the
natural cleanup handle for a component, a widget or a promise wrapper, even when no network is
involved.

## Writing a cancellable function

The contract, in full — four obligations:

```js
async function fetchReport(id, { signal } = {}) {
  signal?.throwIfAborted();                       // 1 · refuse to start if already aborted

  const res = await fetch(`/reports/${id}`, { signal });   // 2 · pass it down
  const rows = [];
  for await (const row of res.body) {
    signal?.throwIfAborted();                     // 3 · check across suspension points
    rows.push(row);
  }
  return rows;                                    // 4 · release everything on the way out
}
```

1. **Check before starting.**
2. **Propagate** the signal into every call that accepts one.
3. **Re-check after `await`**, because time passed.
4. **Clean up** — the `finally` block, the `{ once: true }` listener, the internal controller.

An `async` function that awaits only signal-aware calls gets most of this free: the inner
rejection propagates outward on its own. The manual checks are for loops, timers and anything
you wrapped yourself.

## Gotchas

**Symptom: `abort()` has no effect on an in-flight operation.**
Cause — the operation never received the signal, or does not support one.
Fix — pass `{ signal }` down every layer; a function that swallows it cannot be cancelled.

**Symptom: work starts even though the caller aborted first.**
Cause — an already-aborted signal fires no `abort` event.
Fix — `if (signal?.aborted) return` or `signal.throwIfAborted()` at the top.

**Symptom: `AbortError` shows up in error reporting as a real failure.**
Cause — an intentional cancellation reached the generic error path.
Fix — branch on `err.name === 'AbortError'` and return quietly.

**Symptom: a long loop keeps running after the abort.**
Cause — the signal was checked once, before the loop.
Fix — `signal.throwIfAborted()` inside the loop, after each `await`.

**Symptom: memory grows on a long-lived controller.**
Cause — `abort` listeners accumulate and are never removed.
Fix — `{ once: true }`, or register them with an inner controller's signal and abort it on settle.

**Symptom: a callee cancelled work its caller still needed.**
Cause — the controller was passed instead of the signal.
Fix — pass `controller.signal`; the lever belongs to whoever started the work.

**Symptom: `err.reason` is `undefined` in the catch.**
Cause — the rejection value *is* the reason; there is no `.reason` on it.
Fix — read `err` itself, or `signal.reason` if you still have the signal.

## Interview questions

**★ Why is there no `promise.cancel()`?**
Because a promise reports a result; it is not the work. Cancelling the report would not stop the
operation. `AbortController` cancels the *operation*, and the promise then rejects with the
signal's reason.

**★ Why pass the signal rather than the controller?**
The controller is the write half — anyone holding it can abort. The callee only needs to observe,
so it gets the read-only `AbortSignal`. It is the same split as a promise versus its resolvers.

**★ What does `abort()` with no argument reject with?**
A `DOMException` whose `name` is `"AbortError"`. Pass your own reason to get something more
specific; the first reason wins and later `abort()` calls are no-ops.

**★ Your cancellable function ignores an already-aborted signal. Why?**
Because no `abort` event fires for a signal aborted before you listened. Check `signal.aborted`
or call `throwIfAborted()` before starting.

**★ What does `throwIfAborted()` do that `if (signal.aborted) throw` does not?**
It throws the **signal's own reason**, so the right error propagates without you reconstructing
it — and it reads as a checkpoint, which is exactly what it is inside a loop.

**★ Name a use of `AbortSignal` that has nothing to do with the network.**
`addEventListener(type, fn, { signal })` — one `abort()` removes every listener registered with
that signal, which makes a controller the natural teardown handle for a component.

**Is cancellation guaranteed to stop the work?**
No. It is cooperative: only APIs that honour the signal stop, and nothing can interrupt a
synchronous block.

---

[Topic index](./README.md) · [02 · Composing and propagating signals](./02-composing-signals.md) →
