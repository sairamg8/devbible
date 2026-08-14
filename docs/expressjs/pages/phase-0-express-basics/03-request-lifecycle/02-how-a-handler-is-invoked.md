---
title: "How a handler is invoked"
sidebar_label: "02 · How a handler is invoked"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Arity decides which of your functions Express is willing to call, a `try` block
catches synchronous throws, and Express 5 attaches a rejection handler to the
promise your function *returns* — and to nothing else.**

> Verified: 2026-08-14. Read from **`router@2.2.0`** at
> `sandbox/express-verify/node_modules/router/lib/layer.js` —
> `Layer.prototype.handleRequest` and `Layer.prototype.handleError`, quoted in
> full below. **Reading source is not a run: nothing was executed for this page
> and it carries no console block.** Cross-checked against the Express
> [error-handling guide](https://expressjs.com/en/guide/error-handling.html) and
> the [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5.html),
> which documents the rejected-promise forwarding.

## The two functions, in full

Every single one of your middleware and handlers is called through one of these.
They are 25 lines each and they explain a surprising amount.

```js
// router/lib/layer.js
Layer.prototype.handleRequest = function handleRequest (req, res, next) {
  const fn = this.handle

  if (fn.length > 3) {
    // not a standard request handler
    return next()
  }

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
}
```

```js
Layer.prototype.handleError = function handleError (error, req, res, next) {
  const fn = this.handle

  if (fn.length !== 4) {
    // not a standard error handler
    return next(error)
  }

  try {
    const ret = fn(error, req, res, next)
    // …identical promise and catch handling…
  } catch (err) {
    next(err)
  }
}
```

## Arity is the entire detection mechanism

There is no registration flag, no `app.useErrorHandler`, no naming convention.
`fn.length` decides, and it decides in **both** directions:

| `fn.length` | In the request path | In the error path |
|---|---|---|
| 0, 1, 2, 3 | **runs** as `(req, res, next)` | skipped — `next(error)` |
| 4 | skipped — `next()` | **runs** as `(err, req, res, next)` |
| 5+ | skipped | skipped |

Four consequences, in rising order of how much time they cost people:

- **A five-argument function never runs at all.** Neither branch accepts it, and
  nothing warns. It is silently dead code in the middle of your stack.
- **A four-argument function never runs on the happy path.** Registering
  `(err, req, res, next)` as ordinary middleware and expecting it to see normal
  requests is a common misreading of "middleware is middleware".
- 🔴 **Default parameters and rest args change `fn.length`.**
  `(err, req, res, next = null)` has **length 3**, so it registers as ordinary
  middleware — and then *runs on every normal request*, with `err` bound to the
  request object and `res` bound to `next`. `(...args)` has length 0 and does the
  same. The Express docs' own wording covers the requirement — *"Even if you
  don't need to use the `next` object, you must specify it to maintain the
  signature"* — but not this failure mode.
- **You cannot wrap an error handler carelessly.** Any decorator that returns
  `(...args) => fn(...args)` destroys the arity and turns an error handler into
  middleware. Wrappers must re-declare four named parameters.

## What Express 5 catches, and what it cannot

The `try` block catches a **synchronous** `throw`. The `isPromise(ret)` branch
attaches a rejection handler to the promise your function **returned**. Those two
are the whole guarantee.

```js
// ✅ caught — synchronous throw, inside the try
app.get('/a', (req, res) => { throw new Error('boom') });

// ✅ caught — async function returns a promise, which rejects
app.get('/b', async (req, res) => { await failing() });

// ✅ caught — explicitly returning a promise
app.get('/c', (req, res) => Promise.reject(new Error('boom')));
```

```js
// ❌ NOT caught — nothing was returned, so there is no promise to hook
app.get('/d', (req, res) => { failing(); res.json({ok: true}) });

// ❌ NOT caught — the throw happens in a later tick, outside the try
app.get('/e', (req, res) => { setTimeout(() => { throw new Error('boom') }) });

// ❌ NOT caught — an error-first callback's throw is on the callback's stack
app.get('/f', (req, res) => { fs.readFile(p, (err, d) => { throw err }) });

// ❌ NOT caught — an event handler's throw, likewise
app.get('/g', (req, res) => { stream.on('data', () => { throw new Error('boom') }) });
```

🔴 **The dangerous one is `/d`, the floating promise**, because the request
*succeeds*. The response goes out, the client is happy, and the rejection becomes
an `unhandledRejection` that — in Node 15 and later, by default — **terminates
the process**. A bug that ships as "the API randomly restarts" traces back to a
missing `await` or a missing `return`.

The pattern that makes the guarantee usable: **make the handler `async`, and
`await` or `return` every promise inside it.** Then everything is on the returned
promise, and Express's hook covers it.

## Two details worth carrying

**A falsy rejection becomes a real error.**
`next(error || new Error('Rejected promise'))` — so `Promise.reject()` with no
argument, or `Promise.reject(null)`, arrives at your error handler as an `Error`
whose message is literally `Rejected promise`. If you have ever seen that string
in production and could not find it in your codebase, this is where it comes
from.

**Thenables are deprecated.** If the returned value is promise-like but not a
native `Promise`, the router emits a `depd` deprecation warning: *"handlers that
are Promise-like are deprecated, use a native Promise instead"*. Bluebird-era
code and some ORM query builders hit this.

## Gotchas

**Symptom:** An error handler never runs, and nothing is logged
**Cause:** Its arity is not exactly 4 — usually a default parameter, a rest arg,
or a wrapper that erased the signature
**Fix:** Four named parameters, always: `(err, req, res, next)`. Verify with
`fn.length === 4` if you generate handlers

**Symptom:** A middleware that reads `err.message` crashes with
`Cannot read properties of undefined` on every normal request
**Cause:** Its declared arity is 3 (a default parameter on `next`), so it
registered as ordinary middleware and `err` is bound to `req`
**Fix:** Remove the default. This is the exact failure the arity table above
predicts

**Symptom:** The process exits with `unhandledRejection` and the request that
caused it returned 200
**Cause:** A floating promise — the handler called an async function without
`await` or `return`, so Express had nothing to attach to
**Fix:** `async` handler, `await` everything. A lint rule for
`no-floating-promises` catches the rest

**Symptom:** `Error: Rejected promise` in the logs, with a stack that points into
the router
**Cause:** Something rejected with `undefined` or `null`; the router substituted
an `Error` so the error path had something to carry
**Fix:** Reject with an `Error`. The substitution is the router being defensive,
not the bug

**Symptom:** A handler that returns a query builder's thenable prints a
deprecation warning
**Cause:** `isPromise(ret)` matched a non-native thenable
**Fix:** `await` it inside an `async` handler so a native promise is returned

## Interview questions

**★ How does Express know a function is error middleware?**
`fn.length === 4`, checked in `Layer.prototype.handleError`. There is no
registration flag. The request path applies the mirror check — anything with
`length > 3` is skipped — so the two are mutually exclusive.

**★ What does Express 5 catch that Express 4 did not, and what does it still
miss?**
Express 5 attaches a rejection handler to a promise a handler **returns**, so
`async` handlers no longer need a `try`/`catch` and a manual `next(err)`. It
still misses anything not on that promise: a floating promise, a `setTimeout`
callback, an error-first callback's throw, an event handler's throw.

**★ Which of those is most dangerous, and why?**
The floating promise, because the request succeeds. The response is sent, nothing
looks wrong, and the rejection surfaces later as an `unhandledRejection` that by
default terminates the Node process.

**★ Why might `(err, req, res, next = null)` be a catastrophic signature?**
Its `length` is 3, so it registers as ordinary middleware and runs on **every**
request, with `err` bound to `req` and `res` bound to `next`. It looks like an
error handler, never handles an error, and corrupts the happy path.

**What happens to a five-argument middleware?**
Nothing, ever. `handleRequest` skips anything over three parameters and
`handleError` skips anything that is not exactly four. It is silent dead code.

**Where does `Error: Rejected promise` come from?**
`Layer.prototype.handleRequest` — `next(error || new Error('Rejected promise'))`.
Something rejected with a falsy value and the router substituted a real error so
the error path had something to carry.

---

← Prev: [The nine stages](01-the-nine-stages.md) · Index: [Request lifecycle](README.md) · Next → [The four endings](03-the-four-endings.md)
