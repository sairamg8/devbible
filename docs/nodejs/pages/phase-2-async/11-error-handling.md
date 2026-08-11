---
title: "Error handling with async/await"
sidebar_label: "11 · Error handling"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`try`/`catch` works with `await` exactly as it does with synchronous code — with
one boundary that catches everyone, and one placement rule that decides whether
your error handling is useful or noise.**

## The basics

```js
// basic.mjs
async function load(id) {
  if (!id) throw new Error('id required');
  return { id };
}

try {
  const user = await load(null);
} catch (err) {
  console.log('caught:', err.message);
} finally {
  console.log('finally always runs');
}
```

```console
$ node basic.mjs
caught: id required
finally always runs
```

A rejected promise that you `await` throws at the `await`. That is the whole
mapping — `async` functions turn rejections into exceptions at the point you wait
for them.

## The boundary that catches everyone

`try`/`catch` only catches what you **await inside it**.

```js
// boundary.mjs
function fireAndForget() {
  return Promise.reject(new Error('not caught by the try below'));
}

try {
  fireAndForget();          // ❌ no await — the try block is already done
} catch (e) {
  console.log('NEVER RUNS');
}
console.log('try block finished without catching anything');
```

```console
$ node boundary.mjs
try block finished without catching anything
[UnhandledPromiseRejection] ... 
```

The `try` block completed synchronously; the rejection arrived later, with nobody
listening. Same thing happens with a callback:

```js
// ❌ the throw is inside a different call stack entirely
try {
  setTimeout(() => { throw new Error('escapes'); }, 10);
} catch (e) { /* never runs — this crashes the process */ }
```

**Rule: if there is no `await`, there is no catch.** Everything about
[floating promises](12-floating-promises.md) follows from this.

## Where to put the `try`

The most common mistake is wrapping everything in one giant `try`, which makes the
`catch` unable to say what failed:

```js
// ❌ which one failed? the catch cannot tell
try {
  const user = await loadUser(id);
  const cart = await loadCart(user.id);
  await charge(cart.total);
} catch (err) {
  log.error('something went wrong', err);      // useless at 3am
}
```

Catch where you can **do** something different:

```js
// ✅ each failure has its own meaning and its own response
const user = await loadUser(id);               // let it propagate — a 404 upstream

let cart;
try {
  cart = await loadCart(user.id);
} catch (err) {
  if (err.code === 'ENOENT') cart = emptyCart();  // recoverable
  else throw err;                                  // not ours to handle
}

try {
  await charge(cart.total);
} catch (err) {
  throw new PaymentError('charge failed', { cause: err });   // add context, rethrow
}
```

Two principles:

- **Catch only what you can handle.** A `catch` that logs and rethrows unchanged is
  usually noise; a `catch` that adds context or recovers is doing work.
- **Let the rest propagate** to a boundary that knows what to do — an Express error
  handler, a job runner's retry, the top-level process handler.

## Adding context with `cause`

Rethrowing loses the original unless you attach it:

```js
// context.mjs
class PaymentError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'PaymentError';
  }
}

try {
  try { JSON.parse('{ broken'); }
  catch (low) { throw new PaymentError('could not read gateway response', { cause: low }); }
} catch (e) {
  console.log(e.name, '—', e.message);
  console.log('  caused by:', e.cause.name, '—', e.cause.message.slice(0, 40));
}
```

```console
$ node context.mjs
PaymentError — could not read gateway response
  caused by: SyntaxError — Expected property name or '}' in JSON at
```

`{ cause }` is standard, `console.log` and stack printers understand it, and it
means you never have to choose between a useful message and the underlying detail.
Full treatment in [error design](16-error-design.md).

## `.catch()` placement

Position decides what is covered — everything **upstream**, nothing downstream:

```js
// placement.mjs
const boom = () => Promise.reject(new Error('failed'));

boom().then(() => console.log('never')).catch(e => console.log('3 catch after then →', e.message));

boom().catch(e => { console.log('4 catch before then →', e.message); return 'recovered'; })
      .then(v => console.log('5 then still runs   →', v));
```

```console
$ node placement.mjs
4 catch before then → failed
3 catch after then → failed
5 then still runs   → recovered
```

(`4` prints before `3` because the second chain's `.catch` is one link earlier —
each `.then` costs a microtask tick. The labels are source order, not output
order.)

A `.catch` in the middle **recovers**: the chain continues in the success state
with whatever the handler returns. A `.catch` at the end is a final safety net. Put
it where you want recovery to happen, and put one at the end of every chain you do
not await.

## `try`/`catch` with `Promise.all`

`Promise.all` rejects with the **first** error only:

```js
try {
  await Promise.all([a(), b(), c()]);
} catch (err) {
  // err is whichever rejected first. The others are hidden.
}
```

When you need all of them, use `allSettled` and inspect —
[combinators](09-combinators.md).

## Gotchas

**Symptom:** `try`/`catch` around an async call catches nothing
**Cause:** No `await`, so the block finished before the rejection arrived.
**Fix:** `await` it, or attach `.catch()`.

**Symptom:** A `throw` inside `setTimeout` crashes the process despite a `try`
**Cause:** The callback runs on a later tick with its own stack. The `try` is long
gone.
**Fix:** Put the `try`/`catch` inside the callback, or use the promise-based timer
and await it.

**Symptom:** Logs say "something went wrong" with no indication of what
**Cause:** One `try` wrapping many operations.
**Fix:** Narrow the blocks, or attach `{ cause }` and a distinguishing error type.

**Symptom:** An error is logged three times as it bubbles up
**Cause:** Every layer catches, logs, and rethrows.
**Fix:** Log once, at the boundary that decides the response. Lower layers add
context and rethrow.

**Symptom:** `catch (err)` receives something that is not an `Error`
**Cause:** Someone rejected with a string or object. Any value can be thrown.
**Fix:** Normalise at the boundary:
`const e = err instanceof Error ? err : new Error(String(err));`

## Interview questions

**★ Why does `try`/`catch` sometimes not catch an async error?**
Because it only covers what is `await`ed inside it. An un-awaited call returns a
promise and the block completes synchronously; the rejection surfaces later with
no handler. Callbacks are the same — they run on a later tick with a different
stack.

**★ Where should you catch errors in an async application?**
Wherever you can actually do something different — recover with a fallback, add
context, or map to a response. Errors you cannot handle should propagate to a
boundary that can: an Express error handler, a job retry, or the process-level
handler.

**★ What does `.catch()` placement change?**
A `.catch` handles rejections from everything upstream of it. Placed mid-chain it
recovers, and the chain continues in the success state with whatever it returns.
Placed at the end it is a final net. Anything after a mid-chain `.catch` is not
protected by it.

**★ How do you preserve the original error when rethrowing?**
`throw new HigherLevelError('message', { cause: originalError })`. The standard
`cause` option keeps the underlying error attached, and tooling prints the chain.

**Can you `catch` something that is not an `Error`?**
Yes — any value can be thrown or used as a rejection reason. Defensive code
normalises unknown values into an `Error` at the boundary so downstream handlers
can rely on `.message` and `.stack`.

---

← Prev: [Sequential vs parallel](10-sequential-vs-parallel.md) · Next → [Floating promises](12-floating-promises.md)
