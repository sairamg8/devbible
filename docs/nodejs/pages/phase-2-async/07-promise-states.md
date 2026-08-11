---
title: "Promise states and chaining"
sidebar_label: "07 · Promise states"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Three states, one transition, and one rule about `.then` that causes more bugs
than the rest of the API combined: if you do not return it, it is not chained.**

## The three states

| State | Meaning |
|---|---|
| **pending** | Not settled yet |
| **fulfilled** | Settled with a value |
| **rejected** | Settled with a reason |

A promise transitions **once**, from pending to one of the other two, and then
never changes. "Settled" means fulfilled or rejected. "Resolved" is a subtly
different word — a promise resolved *with another promise* stays pending until
that one settles.

```js
// states.mjs
const pending = new Promise(() => {});
const fulfilled = Promise.resolve(42);
const rejected = Promise.reject(new Error('nope'));
rejected.catch(() => {});                 // handled, so it will not crash the process

console.log(pending, fulfilled, rejected);
```

```console
$ node states.mjs
Promise { <pending> } Promise { 42 } Promise { <rejected> Error: nope
    at ... }
```

Two consequences that matter in practice:

- **Settling twice is a no-op.** Calling `resolve()` again after `reject()` does
  nothing — no error, no warning. A retry that resolves late is silently ignored.
- **A promise is not lazy.** The work starts the moment the promise is created,
  not when you `await` it. `const p = fetchUser()` has already begun.

## Chaining: `.then` returns a *new* promise

Every `.then`, `.catch` and `.finally` returns a new promise. What you return from
the handler determines what that promise settles with:

| Return from the handler | Resulting promise |
|---|---|
| a value | fulfilled with that value |
| a promise | **adopts** it — waits, then settles the same way |
| nothing (`undefined`) | fulfilled with `undefined` |
| `throw` | rejected with the thrown reason |

## The rule: return, or it is not chained

```js
// chain.mjs
const load = (v) => sleep(20).then(() => v);

load('A')
  .then(v => { load(v + '-inner'); return 'forgot to return'; })   // ❌ inner not awaited
  .then(v => console.log('1 without return →', v));

await load('A')
  .then(v => load(v + '-inner'))                                    // ✅ returned, so chained
  .then(v => console.log('2 with return    →', v));
```

```console
$ node chain.mjs
1 without return → forgot to return
2 with return    → A-inner
```

In the first chain the inner `load` still ran — it just was not waited for and its
result was thrown away. If it had rejected, that rejection would have been
unhandled and would have crashed the process.

This is the single most common promise bug. The `async`/`await` equivalent is
forgetting to `await`, and it is the same mistake.

## `.finally`

Runs on both paths and **passes the outcome through** — it does not change the
value or swallow the error:

```js
// finally.mjs
const result = await Promise.resolve('value')
  .finally(() => console.log('cleanup ran'))
  .then(v => v.toUpperCase());
console.log(result);

try {
  await Promise.reject(new Error('failed')).finally(() => console.log('cleanup ran again'));
} catch (e) { console.log('error still propagated:', e.message); }
```

```console
$ node finally.mjs
cleanup ran
VALUE
cleanup ran again
error still propagated: failed
```

Returning a value from `.finally` does not replace the result. Throwing inside it
*does* replace the outcome — which is why cleanup code that can throw needs its
own `try`/`catch`.

## `.then(onFulfilled, onRejected)` vs `.then().catch()`

`.then` takes a second argument, and it is not the same as chaining `.catch`:

```js
// twoarg.mjs
Promise.resolve('ok')
  .then(
    v => { throw new Error('thrown inside onFulfilled'); },
    e => console.log('NOT called — the second arg only sees upstream errors')
  )
  .catch(e => console.log('caught by .catch:', e.message));
```

```console
$ node twoarg.mjs
caught by .catch: thrown inside onFulfilled
```

The rejection handler passed *as the second argument* cannot catch an error thrown
by the success handler beside it — they are alternatives, not a try/catch pair.
A chained `.catch` is downstream, so it sees both. **Prefer `.then().catch()`.**

## Where chaining still beats `await`

`async`/`await` is the default (the next page), but `.then` is
better for a few shapes:

```js
// A stream of transformations with no branching
const config = readFile('config.json', 'utf8')
  .then(JSON.parse)
  .then(validate)
  .then(applyDefaults);

// Attaching a handler without awaiting — fire-and-forget with an explicit catch
metrics.flush().catch(err => log.warn('metrics flush failed', err));
```

That second one matters: `.catch()` on a deliberately un-awaited promise is how
you make a floating promise safe. See
[floating promises](12-floating-promises.md).

## Gotchas

**Symptom:** A `.then` handler's async work finishes after the chain completes
**Cause:** The inner promise was not returned, so the chain never waited.
**Fix:** `return` it. Enable the `promise/always-return` lint rule.

**Symptom:** An error in a `.then` is not caught by the `onRejected` argument
beside it
**Cause:** The two arguments are alternatives — the rejection handler only sees
upstream rejections.
**Fix:** Use a chained `.catch`.

**Symptom:** A promise "resolves twice" and the second value is ignored
**Cause:** Promises settle once. Later calls are no-ops.
**Fix:** Expected. If you need the last of several values, that is not a promise —
use an event or an async iterator.

**Symptom:** Work starts earlier than expected
**Cause:** Promises are eager. Creating one starts the work.
**Fix:** Wrap it in a function and call it when you actually want it to begin.

**Symptom:** `.finally` swallowed the result
**Cause:** It did not — but a `throw` inside `.finally` replaces the outcome.
**Fix:** Guard cleanup code that can throw.

## Interview questions

**★ What are the three promise states, and how many times can a promise
transition?**
Pending, fulfilled, rejected. It transitions exactly once, from pending to
fulfilled or rejected, and is then immutable. Subsequent `resolve`/`reject` calls
are silently ignored.

**★ Why does returning inside `.then` change everything?**
`.then` returns a new promise that settles with whatever the handler returns. Return
a promise and the chain adopts it — waiting for it and propagating its rejection.
Do not return it and the chain continues immediately, the inner work becomes
detached, and any rejection it produces is unhandled.

**★ What is the difference between `.then(f, g)` and `.then(f).catch(g)`?**
In the two-argument form, `g` only handles rejections from *upstream* — it cannot
catch an error thrown by `f`, because they are alternative branches. A chained
`.catch` is downstream of `f`, so it catches both. Prefer the chained form.

**★ Are promises lazy?**
No. The work begins when the promise is created, not when it is awaited. To defer
it, wrap the creation in a function.

**What does `.finally` do to the value?**
Nothing — it passes the outcome through unchanged, on both the success and failure
paths. Its return value is ignored. Throwing inside it, however, replaces the
outcome with that error.

**Why is `Promise.reject(new Error(...))` on its own dangerous?**
With no handler attached it becomes an unhandled rejection, which terminates the
process by default in modern Node.

---

← Prev: [Timers](06-timers.md) · Next → [Async and await](08-async-await.md)
