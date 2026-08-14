---
title: "What is forwarded"
sidebar_label: "01 · What is forwarded"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Rejected promises from async handlers reach error middleware on Express 5. The
guarantee is precisely one thing: the promise your function *returns*. Nothing
else, and the difference is where every remaining async bug lives.**

> Verified: 2026-08-14 on **Express 5.2.1**. The forwarding mechanism is
> `Layer.prototype.handleRequest`'s `isPromise(ret)` branch in **`router@2.2.0`**'s
> `lib/layer.js`, quoted below, in `sandbox/express-verify/node_modules/`.
> **Reading source is not a run.** The console block below is **re-used unchanged
> from the earlier authorised `sandbox/express-verify` run** and is
> sandbox-measured. [Migrating to Express
> 5](https://expressjs.com/en/guide/migrating-5.html) shows the before/after
> directly: Express 4 needed `.catch(next)`; in Express 5 an async handler's
> errors are *"automatically forwarded to the error handler"*.
> [Error handling](https://expressjs.com/en/guide/error-handling.html) documents
> the limit — for *"callback-based APIs and asynchronous code without error-first
> callbacks"* you must still call `next(err)` yourself.

```js
// async-err.mjs
import express from 'express';

const app = express();
app.get('/boom', async (req, res) => {
  throw new Error('async boom');
});
app.use((err, req, res, next) => {
  res.status(500).json({error: err.message});
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log(await (await fetch(`http://127.0.0.1:${port}/boom`)).json());
  server.close();
});
```

```console
$ node async-err.mjs
{ error: 'async boom' }
```

## The mechanism, in seven lines

```js
// router/lib/layer.js — Layer.prototype.handleRequest()
try {
  const ret = fn(req, res, next)

  if (isPromise(ret)) {
    ret.then(null, function (error) {
      next(error || new Error('Rejected promise'))
    })
  }
} catch (err) {
  next(err)
}
```

That is the whole feature. Two independent guarantees:

- **The `try`/`catch`** covers a **synchronous** `throw` — the same thing Express 4
  did.
- **The `isPromise(ret)` branch** attaches a rejection handler to the value your
  function **returned**. An `async` function always returns a promise, so an
  `async` handler that throws is covered.

`Layer.prototype.handleError` has the identical block, so an error handler may
also be `async`.

**Note what is *not* in that code: an `await`.** Express does not wait for your
promise. It attaches `.then(null, …)` and returns immediately — the walk is driven
by `next`, not by the promise settling. So a handler that returns a promise which
resolves *without* responding still hangs; the promise resolving is not an ending
([Phase 2 · 03 · chunk 02](../../phase-2-middleware/03-next-semantics/02-the-hang.md)).

## Two details worth carrying

**A falsy rejection becomes a real `Error`.** `next(error || new Error('Rejected
promise'))` — so `Promise.reject()` with no argument, or `Promise.reject(null)`,
arrives at your handler as an `Error` whose message is literally `Rejected
promise`. If you have seen that string in production and could not find it in
your codebase, that line is where it comes from.

**Thenables are deprecated.** If the returned value is promise-like but not a
native `Promise`, the router emits a `depd` warning: *"handlers that are
Promise-like are deprecated, use a native Promise instead"*. Bluebird-era code and
some ORM query builders hit this — `await` the thenable inside an `async` handler
and a native promise is what gets returned.

## Where this leaves `try`/`catch`

Not gone, but its job changed. **Catching in order to call `next(err)` with the
same error is now pure noise** — the router does it. Catch when you want to
**decide** something:

```js
// ✅ translate — a driver error becomes a domain error with a status
try {
  await orders.insert(order);
} catch (err) {
  if (err.code === '23505') throw new AppError('CONFLICT', 'Order already exists');
  throw err;
}

// ✅ fall back — a cache miss is not a failure
let profile;
try { profile = await cache.get(id); }
catch { profile = await db.getProfile(id); }

// ❌ noise — this is exactly what Express 5 already does
try { await doWork(); } catch (err) { next(err); }
```

The test: **does the `catch` change the outcome?** If it only forwards, delete it.

## Remove the shim

`express-async-errors` exists to patch this behaviour into Express 4. On
Express 5 it is redundant, and it is worse than redundant: it monkey-patches
router internals, and the router was extracted into its own package with a
different shape
([Phase 0 · 01 · chunk 03](../../phase-0-express-basics/01-what-express-is/03-what-express-delegates.md)).
Take it out during the upgrade, not later.

The same goes for hand-rolled `asyncHandler(fn)` wrappers. They are harmless if
they preserve arity — and **many do not**, because the common
`fn => (...args) => Promise.resolve(fn(...args)).catch(args[2])` form has
`length` 0, which turns any error handler passed through it into ordinary
middleware
([01 · chunk 01](../01-error-middleware/01-arity-and-placement.md)).

## Gotchas

**Symptom:** `express-async-errors` still in `package.json` after the upgrade
**Cause:** Left over from Express 4
**Fix:** Remove it. Express 5 does this natively, and the shim patches router
internals that have since moved into a separate package

**Symptom:** `Error: Rejected promise` in the logs, with a stack pointing into the
router
**Cause:** Something rejected with `undefined` or `null`; the router substituted
an `Error` so the error path had a value to carry
**Fix:** Reject with an `Error`. The substitution is the router being defensive,
not the bug

**Symptom:** A deprecation warning about Promise-like handlers
**Cause:** The handler returned a thenable that is not a native `Promise` — a
query builder, an old promise library
**Fix:** `await` it inside an `async` handler so what you return is native

**Symptom:** An `async` handler resolves and the request still hangs
**Cause:** Express attaches a rejection handler; it does not `await`. A promise
that resolves without responding or calling `next()` is not an ending
**Fix:** Respond or `next()` on every path, as with any handler

**Symptom:** An error thrown *after* `res.json()` produces
`ERR_HTTP_HEADERS_SENT`
**Cause:** The handler responded, then threw; the rejection is forwarded and the
error handler tries to respond again
**Fix:** `return` after responding, and guard the error handler with
`if (res.headersSent) return next(err)`

**Symptom:** An `asyncHandler` wrapper broke the error middleware
**Cause:** The wrapper used rest arguments, so `fn.length` became 0
**Fix:** Delete the wrapper — it is unnecessary on Express 5. If you keep one,
re-declare named parameters

## Interview questions

**★ What exactly does Express 5 forward?**
Two things: a synchronous `throw`, caught by a `try` in
`Layer.prototype.handleRequest`, and a rejection of the promise your function
**returns**, via `ret.then(null, err => next(err))`. Anything not on that returned
promise is invisible to Express.

**★ Does Express `await` your handler?**
No. It attaches a rejection handler and returns immediately; the walk is driven
by `next`, not by the promise settling. So a promise that resolves without
responding still leaves the request hanging.

**★ Is `try`/`catch` still worth writing in a handler?**
Only when it changes the outcome — translating a driver error into a domain error
with a status, adding context, or choosing a fallback. A `catch` that only calls
`next(err)` with the same error duplicates what the router already does.

**★ Where does `Error: Rejected promise` come from?**
`next(error || new Error('Rejected promise'))` in `handleRequest`. Something
rejected with a falsy value — `Promise.reject()` or `Promise.reject(null)` — and
the router substituted a real `Error` so the error path had something to carry.

**Should you keep `express-async-errors` on Express 5?**
No. It is redundant, and it monkey-patches router internals that moved into a
separate package with a different shape. Remove it as part of the upgrade.

**Why can a hand-rolled `asyncHandler` wrapper be harmful?**
Because the usual `(...args) => …` form has `fn.length === 0`, and arity is how
Express distinguishes an error handler from ordinary middleware. Wrapping an
error handler that way silently unregisters it.

---

Index: [Async errors](README.md) · Next → [The four shapes that escape](02-the-shapes-that-escape.md)
