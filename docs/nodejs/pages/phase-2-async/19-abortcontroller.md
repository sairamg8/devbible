---
title: "AbortController and cancellation"
sidebar_label: "19 · AbortController"
sidebar_position: 19
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Promises cannot be cancelled. `AbortController` is the standard way to say "stop"
to work already in flight — and it is now accepted by almost every async API in
Node.**

## Why promises have no `.cancel()`

A promise is a *view* of a result, not a handle on the work producing it. Ten
places can await the same promise; if one cancelled it, the other nine would break.
So cancellation lives one level down, in the thing doing the work — and
`AbortController` is the channel for telling it.

```js
const ac = new AbortController();
doWork({ signal: ac.signal });      // hand the signal to the worker
ac.abort();                         // ...and pull it later
```

The **controller** is the remote; the **signal** is what you hand out. Give
callees the signal, never the controller — otherwise anyone can cancel your work.

## The basic shape

```js
// abort.mjs
import { setTimeout as sleep } from 'node:timers/promises';

const ac = new AbortController();
setTimeout(() => ac.abort(new Error('user cancelled')), 30);

try { await sleep(1000, null, { signal: ac.signal }); }
catch (e) { console.log('1 aborted →', e.name, '|', e.message, '| reason:', ac.signal.reason.message); }
```

```console
$ node abort.mjs
1 aborted → AbortError | The operation was aborted | reason: user cancelled
```

Note the split, which trips people up: the operation rejects with a **generic
`AbortError`** whose message is always `The operation was aborted`. Your custom
reason is not in that message — it is on `signal.reason`. If you want to
distinguish *why* something was cancelled, read `signal.reason`, not `err.message`.

Abort with no argument gives a standard `AbortError` DOMException:

```js
const ac2 = new AbortController();
ac2.abort();
console.log('2 default reason →', ac2.signal.reason.name, '|', ac2.signal.reason.code);
```

```console
2 default reason → AbortError | 20
```

## `AbortSignal.timeout` — deadlines

```js
try { await sleep(1000, null, { signal: AbortSignal.timeout(25) }); }
catch (e) { console.log('3 timeout →', e.name, '|', e.code); }
```

```console
3 timeout → AbortError | ABORT_ERR
```

One line replaces the whole "race a promise against a `setTimeout`" pattern — and
unlike `Promise.race`, it actually **stops the work**, rather than just ignoring
its result. The timer is `unref`ed, so it will not hold the process open.

## `AbortSignal.any` — combining reasons

Real requests have several ways to end: the client disconnects, a deadline passes,
a shutdown begins.

```js
const user = new AbortController();
const combined = AbortSignal.any([user.signal, AbortSignal.timeout(5000)]);
setTimeout(() => user.abort(), 20);

try { await sleep(1000, null, { signal: combined }); }
catch (e) { console.log('4 any →', e.name, '| aborted:', combined.aborted); }
```

```console
4 any → AbortError | aborted: true
```

`AbortSignal.any` fires as soon as **any** input aborts, and adopts that signal's
reason. It is the cancellation counterpart of
[`Promise.race`](09-combinators.md).

## Reacting to abort yourself

For work Node does not know how to cancel — your own loop, a subscription — check
the flag and listen for the event:

```js
const ac3 = new AbortController();
ac3.signal.addEventListener('abort', () =>
  console.log('5 listener fired, reason:', ac3.signal.reason?.message ?? '(default)'));
ac3.abort(new Error('cleanup'));
console.log('6 aborted flag →', ac3.signal.aborted);
```

```console
5 listener fired, reason: cleanup
6 aborted flag → true
```

**Always check `signal.aborted` before starting**, not only via the listener — a
signal may already be aborted when you receive it, and the `abort` event has
already fired and will never fire again.

```js
async function work(items, { signal } = {}) {
  signal?.throwIfAborted();                 // ← the ergonomic version of the check
  for (const item of items) {
    await process(item);
    signal?.throwIfAborted();               // between units of work
  }
}
```

`throwIfAborted()` throws `signal.reason` when aborted and does nothing otherwise.

## Threading the signal through

The rule that makes cancellation actually work: **every async function in the path
takes `{ signal }` and passes it down.** A single layer that drops it makes
everything below it uncancellable.

```js
async function getUser(id, { signal }) {
  const res = await fetch(`/users/${id}`, { signal });        // ← passed on
  return res.json();
}

async function handler(req, res) {
  const ac = new AbortController();
  req.on('close', () => ac.abort());        // client hung up → stop the work
  const user = await getUser(req.params.id, { signal: ac.signal });
  res.json(user);
}
```

APIs in Node that accept `{ signal }`: `fetch`, `fs/promises` (including
`readFile`/`writeFile`), `timers/promises`, `events.on` and `events.once`,
`stream.pipeline`, `readline/promises`, and `child_process`.

## Gotchas

**Symptom:** `err.message` is `The operation was aborted`, not the reason you passed
**Cause:** The rejection is a generic `AbortError`; your reason is on
`signal.reason`.
**Fix:** Read `signal.reason`, or use `throwIfAborted()` which throws the reason
itself.

**Symptom:** An abort has no effect on work already running
**Cause:** Some layer did not forward the signal.
**Fix:** Thread `{ signal }` through every function in the path.

**Symptom:** An abort listener never fires
**Cause:** The signal was already aborted when the listener was attached.
**Fix:** Check `signal.aborted` first — the event does not re-fire.

**Symptom:** `MaxListenersExceededWarning` on an `AbortSignal`
**Cause:** One long-lived signal reused across thousands of operations, each adding
a listener.
**Fix:** One controller per operation, or remove listeners when work completes.

**Symptom:** Cancelling still leaves the request running on the server
**Cause:** Abort stops the client waiting; the server does not always find out.
**Fix:** Expect it. Cancellation is cooperative — the server needs its own
deadline.

**Symptom:** An `AbortError` crashes the process during shutdown
**Cause:** Abort is a normal outcome, but it was treated as a failure.
**Fix:** `if (e.name === 'AbortError') return;` — cancellation is not an error.

## Interview questions

**★ Why can't you cancel a promise?**
A promise represents a result, not the work producing it, and it can have many
consumers — cancelling for one would break the rest. Cancellation belongs to the
operation, which is what `AbortController` signals.

**★ What is the difference between the controller and the signal?**
The controller has `.abort()`; the signal is the read-only side you pass to
callees, exposing `.aborted`, `.reason`, `throwIfAborted()` and an `abort` event.
Handing out the signal means only the owner can cancel.

**★ How do you implement a timeout on an async operation?**
`AbortSignal.timeout(ms)` passed as `{ signal }`. Unlike racing against a
`setTimeout`, it actually aborts the underlying work rather than ignoring a result
that is still in flight, and its timer is unref'ed.

**★ How do you combine a user cancellation with a deadline?**
`AbortSignal.any([userSignal, AbortSignal.timeout(ms)])` — it aborts when the
first of them does, adopting that reason.

**★ What must you do to make cancellation work through several layers?**
Accept `{ signal }` in every async function and forward it. Cancellation is
cooperative, so one layer that drops the signal makes everything beneath it
uncancellable. In your own loops, call `signal.throwIfAborted()` between units of
work.

**Why check `signal.aborted` rather than only listening for the event?**
Because the signal may already be aborted when you receive it. The `abort` event
fires once, and a listener attached afterwards never runs.

---

← Prev: [Async iterators](18-async-iterators.md) · Next → [AsyncLocalStorage](20-asynclocalstorage.md)
