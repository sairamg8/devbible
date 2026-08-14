---
title: "Arity and placement"
sidebar_label: "01 · Arity and placement"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Error middleware has four parameters. Express detects it by arity, and it is
reachable only from below. Both rules are absolute, and neither produces a
warning when you break it.**

> Verified: 2026-08-14 on **Express 5.2.1**. The arity gate is
> `Layer.prototype.handleError`'s `if (fn.length !== 4) return next(error)` in
> **`router@2.2.0`**'s `lib/layer.js`, and the forward-only walk is
> `Router.prototype.handle`'s `if (layerError) { match = false; continue }` — both
> in `sandbox/express-verify/node_modules/`. **Reading source is not a run.** The
> console block below is **re-used unchanged from the earlier authorised
> `sandbox/express-verify` run** and is sandbox-measured. The
> [error-handling guide](https://expressjs.com/en/guide/error-handling.html) states
> both rules: error middleware is *"defined last, after other `app.use()` and
> routes calls"*, and *"you must provide four arguments to identify it as an
> error-handling middleware function. Even if you don't need to use the `next`
> object, you must specify it to maintain the signature."*

```js
// error-mw.mjs
import express from 'express';

const app = express();
app.get('/boom', (req, res, next) => next(new Error('nope')));
app.use((req, res) => res.status(404).json({error: 'not found'}));
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
$ node error-mw.mjs
{ error: 'nope' }
```

Note what the 404 handler above it did: **nothing**. It is three-argument
middleware and the walk was in error mode, so route layers were refused and
`use` layers were offered only their error form — which a three-argument function
does not have.

## Arity is the whole detection mechanism

There is no registration API, no flag, no `app.onError`. The router looks at
`fn.length` and routes errors only to functions declaring exactly four:

```js
app.use((err, req, res, next) => {});        // length 4 → error handler ✅
app.use((err, req, res) => {});              // length 3 → ORDINARY middleware ⛔
app.use((err, req, res, next, extra) => {}); // length 5 → not recognised at all ⛔
```

🔴 **The three-parameter version is the dangerous one.** It is not an error — it
registers successfully as normal middleware, runs on **every successful request**
with `(req, res, next)` bound to the misleading names `(err, req, res)`, and your
errors sail past it into the default handler. The first line that touches
`err.message` then throws on the happy path, because `err` is the request.

Two consequences that catch people out:

- **Default parameters and rest args change `length`.** `(err, req, res, next = null)`
  has a `length` of **3** — default parameters are not counted. So does `(...args)`,
  which is 0. Any decorator written as `fn => (...args) => fn(...args)` silently
  unregisters an error handler.
- **A five-parameter function is dead code.** `handleRequest` skips anything over
  three and `handleError` skips anything that is not exactly four, so it never
  runs on either path and nothing warns.

The wrapper that preserves arity re-declares the parameters by name:

```js
const withLogging = fn => (err, req, res, next) => { log(err); return fn(err, req, res, next); };
//                        ^^^^^^^^^^^^^^^^^^^^^^ length 4 ✅
```

## It is reachable only from below

The stack is an array walked forward from index 0, and nothing rewinds it
([Phase 2 · 02 · chunk 01](../../phase-2-middleware/02-execution-order/01-the-four-levels.md)).
So by the time a route at index 7 calls `next(err)`, an error handler registered
at index 2 is **behind the cursor** and unreachable — permanently, silently.

```js
app.use(errorHandler);          // ⛔ index 0 — never runs for anything below
app.use('/api', apiRouter);     // index 1
```

**Mount error handlers last**, below every route and below the 404 handler. In a
single factory that is easy to see; spread across files it is the thing that
breaks when someone reorders imports
([Phase 10 · 01](../../phase-10-app-factory/01-create-app.md)).

## Handlers chain, and that is the useful pattern

Calling `next(err)` from an error handler passes the error to the **next
four-argument handler**, not back to routes — the walk stays in error mode.

That makes a two-stage arrangement natural, and it is worth adopting:

```js
// 1 · observe. Never responds.
app.use((err, req, res, next) => {
  logger.error({err, requestId: req.id, method: req.method, url: req.originalUrl});
  next(err);
});

// 2 · decide. The only place that writes.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = statusFor(err);
  res.status(status).json(bodyFor(err, status, req.id));
});
```

The separation earns its keep because the two have different reasons to change:
logging changes with your observability stack, the envelope changes with your API
contract, and neither should force an edit to the other. It also means **exactly
one function writes a response**, which removes a whole class of double-send bug
([Phase 2 · 03 · chunk 03](../../phase-2-middleware/03-next-semantics/03-double-send-and-guards.md)).

## Router-level handlers

A four-argument handler mounted on a `Router` catches errors from layers above it
**in that router**, then can hand the rest upward:

```js
const orders = express.Router();
orders.get('/:id', getOrder);

orders.use((err, req, res, next) => {
  if (err.code === 'ORDER_NOT_FOUND') return res.status(404).json({error: 'not_found'});
  next(err);                       // everything else is the app's problem
});
```

**Handle what this module knows about; `next(err)` everything else.** The
app-level handler stays the single owner of the generic envelope, and the
router-level one adds domain knowledge without duplicating the contract.

## Gotchas

**Symptom:** The error handler never runs and errors produce an HTML 500
**Cause:** Its arity is not exactly 4 — usually a default parameter, a rest arg,
or a wrapper that erased the signature
**Fix:** Four named parameters. If you generate handlers, assert `fn.length === 4`
at mount time

**Symptom:** A "middleware" crashes on `err.message` for every successful request
**Cause:** A three-parameter `(err, req, res)` registered as ordinary middleware,
so `err` is bound to the request
**Fix:** Add `next`. The names lie; the arity decides

**Symptom:** An error handler at the top of `app.js` never runs
**Cause:** The walk moves forward only. Index 0 is behind the cursor when a route
lower down fails
**Fix:** Mount error handlers last, below the 404 handler

**Symptom:** A middleware you added does nothing at all, on either path
**Cause:** Five or more parameters — skipped by both `handleRequest` and
`handleError`
**Fix:** Three, or exactly four

**Symptom:** Two error handlers both respond and one throws
`ERR_HTTP_HEADERS_SENT`
**Cause:** Chaining is fine, but only one may write
**Fix:** The observer logs and calls `next(err)`; the responder writes and does
not

## Interview questions

**★ How does Express know a function is error middleware?**
`fn.length === 4`, checked in `Layer.prototype.handleError`. There is no
registration flag. The request path applies the mirror test — anything with more
than three parameters is skipped — so the two roles are mutually exclusive.

**★ Why is `(err, req, res)` a dangerous signature?**
Its length is 3, so it registers as **ordinary** middleware. It runs on every
successful request with `err` bound to the request object, and it never sees an
error. The names make it look correct in review.

**★ Why must error middleware be last?**
Because the stack is an array walked forward from a stored index and nothing
rewinds it. An error handler registered above the failing route is behind the
cursor by the time `next(err)` is called, so it is unreachable.

**★ What happens when an error handler calls `next(err)`?**
The walk stays in error mode and the error goes to the **next four-argument
handler**, not back to the routes. That is what makes a log-then-respond pair
work, and it is how a router-level handler defers to the app-level one.

**Why separate a logging handler from a responding handler?**
Because they change for different reasons — observability versus API contract —
and because it guarantees exactly one function writes a response, which removes
the double-send failure mode.

**How do you wrap an error handler without breaking it?**
Re-declare four named parameters in the wrapper. Anything using rest arguments
sets `length` to 0 and turns the result into ordinary middleware.

---

Index: [Error middleware](README.md) · Next → [The default handler](02-the-default-handler.md)
