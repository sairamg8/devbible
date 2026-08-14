---
title: "The shape and the endings"
sidebar_label: "01 · The shape and the endings"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Middleware is a function `(req, res, next) => void`. It must either send a
response or call `next` (or `next(err)`). Anything else hangs the client — and
the number of parameters you declare decides whether Express will call it at
all.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. **The console block
> below is re-used unchanged from the earlier authorised `sandbox/express-verify`
> run and is sandbox-measured** — nothing was executed for this rewrite. The
> contract is documented literally in
> [using middleware](https://expressjs.com/en/guide/using-middleware.html): an
> Express app is *"a series of middleware function calls"*, each may *"execute any
> code, modify the request and response objects, end the request-response cycle,
> or pass control to the next middleware function"*, and *"if a middleware
> function does not end the request-response cycle, it must call `next()` …
> Otherwise, the request will be left hanging."* The arity gate is read from
> `router@2.2.0`'s `lib/layer.js` in `sandbox/express-verify/node_modules/`.

## The shape

```js
function middleware(req, res, next) {
  // read req, optionally write res headers/body
  // then exactly one of:
  //   res.status(...).json(...)  // terminal
  //   next()                     // continue
  //   next(err)                  // error stack
}
```

Route handlers are middleware that matched a method and path. **Same contract,
same powers, same failure modes.** Express has no separate concept for them —
the only difference is that a route layer carries a `Route` with per-method
handler stacks, and a `use` layer does not
([Phase 0 · 02 · chunk 02](../../phase-0-express-basics/02-app-router-server/02-a-router-is-a-function-too.md)).

## Three legal endings

| Ending | Means | The request is |
|---|---|---|
| **Respond** — `res.json`, `res.send`, `res.end`, `res.redirect`, `res.sendFile` | you answered | over |
| **`next()`** | pass to the next layer in this stack | still running |
| **`next(err)`** | skip every remaining route, enter the error stack | still running |

Returning from the function without one of those is not an ending Express
understands. There is no timeout, no warning and no log line — the socket simply
waits, which is [ending 4](../../phase-0-express-basics/03-request-lifecycle/03-the-four-endings.md)
and the hardest of the four to find.

Two things that look like endings and are not:

- **`res.status(400)`** sets a field and returns `res` for chaining. It sends
  nothing. `return res.status(400)` returns a response object and hangs.
- **`throw`** *is* an ending in Express 5 — but only synchronously, or on a
  promise your handler **returned**. A `throw` inside a `setTimeout` or an
  error-first callback is not caught by anything
  ([Phase 0 · 03 · chunk 02](../../phase-0-express-basics/03-request-lifecycle/02-how-a-handler-is-invoked.md)).

## See a clean chain

```js
// contract.mjs
import express from 'express';

const app = express();

app.use((req, res, next) => {
  req.seen = ['A'];
  next();
});

app.use((req, res, next) => {
  req.seen.push('B');
  next();
});

app.get('/t', (req, res) => {
  res.json({seen: req.seen});
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log(await (await fetch(`http://127.0.0.1:${port}/t`)).json());
  server.close();
});
```

```console
$ node contract.mjs
{ seen: [ 'A', 'B' ] }
```

## Arity is part of the contract, not a convention

You declare three parameters because Express **counts them**:

```js
// router/lib/layer.js — handleRequest
if (fn.length > 3) return next()        // skipped on the happy path

// router/lib/layer.js — handleError
if (fn.length !== 4) return next(error) // skipped on the error path
```

| `fn.length` | Request path | Error path |
|---|---|---|
| 0–3 | **runs** as `(req, res, next)` | skipped |
| 4 | skipped | **runs** as `(err, req, res, next)` |
| 5+ | skipped | skipped — silently dead |

🔴 **This is the one place in Express where a signature detail changes
behaviour**, and three habits break it:

- `(err, req, res, next = null)` has `length` **3**, so it registers as ordinary
  middleware and runs on **every normal request**, with `err` bound to the request.
- `(...args) => fn(...args)` has `length` **0**, so any decorator written that way
  turns an error handler into ordinary middleware.
- An unused parameter removed by a lint autofix — `(req, res)` where `next` was
  never called anyway — is harmless here but fatal if it happens to an error
  handler.

**Never let a wrapper change the arity.** Re-declare the parameters by name:

```js
const wrapError = fn => (err, req, res, next) => fn(err, req, res, next);   // length 4 ✅
```

## `return next()` is a habit, not a keyword

`next` does not stop your function. It schedules the rest of the stack and comes
back:

```js
app.use((req, res, next) => {
  if (!req.user) next(new Error('unauthenticated'));   // ← no return
  res.json({secret: true});                            // ← still runs
});
```

That code sends the secret *and* enters the error stack, and the error handler
then throws `ERR_HTTP_HEADERS_SENT` trying to answer. The fix is one word:

```js
if (!req.user) return next(new Error('unauthenticated'));
```

`return` is doing nothing framework-specific — it is ordinary JavaScript control
flow, and it is load-bearing precisely because `next` is not. Use it on **every**
`next` and every terminal `res.*` call, and the whole class of double-send bugs
disappears. [Phase 2 · 03](../03-next-semantics/03-double-send-and-guards.md) is this failure in full.

## Gotchas

**Symptom:** The request never completes and nothing is logged
**Cause:** A branch that neither responded nor called `next()` — usually an early
`return` on a path nobody tested
**Fix:** Audit every branch, including `if` arms and `catch` blocks. Log entry and
exit of the layer to find the one with no exit

**Symptom:** `return res.status(400)` hangs
**Cause:** `res.status` sets a field and returns `res`; it sends nothing
**Fix:** `return res.status(400).json({…})` — the terminal call is `json`, `send`
or `end`

**Symptom:** `Cannot set headers after they are sent`
**Cause:** `next(err)` or `next()` without `return`, so the code below it also ran
**Fix:** `return next()` and `return res.json(...)`, always

**Symptom:** An error handler runs on every successful request and crashes on
`err.message`
**Cause:** A default parameter dropped its arity to 3, so it registered as
ordinary middleware and `err` is bound to `req`
**Fix:** Exactly four named parameters, no defaults, no rest args

**Symptom:** A middleware you added does nothing at all and never appears in
logs
**Cause:** It declares five or more parameters, so both `handleRequest` and
`handleError` skip it
**Fix:** Three parameters, or four for an error handler. There is no other shape

## Interview questions

**★ What is the Express middleware contract?**
A function `(req, res, next)` that must do exactly one of three things: send a
response, call `next()` to continue, or call `next(err)` to enter the error
stack. Returning without one of those leaves the request hanging — there is no
timeout and no warning.

**★ Are route handlers middleware?**
Yes, with a method and path filter in front. Same signature, same powers, same
failure modes; Express has no separate concept. The only structural difference is
that a route layer carries a `Route` with per-method handler stacks.

**★ Why does the number of parameters matter?**
Because it is how Express decides which stack a function belongs to.
`handleRequest` skips anything with more than three; `handleError` skips anything
that is not exactly four. That makes default parameters, rest args and careless
wrappers behaviour-changing.

**★ Why is `return next()` the recommended style?**
Because `next` does not stop your function. Without the `return`, the code below
it runs as well — so a guard clause both forwards an error and sends a response,
and the error handler then fails on `ERR_HTTP_HEADERS_SENT`.

**Does `res.status(400)` end the request?**
No. It sets the status field and returns `res` for chaining. Sending is
`json`, `send`, `end`, `redirect` or `sendFile`. `return res.status(400)` on its
own hangs.

**What happens if middleware throws?**
In Express 5, a synchronous `throw` is caught by the `try` in
`Layer.handleRequest` and forwarded as `next(err)`, and so is a rejection of a
promise your handler **returned**. A throw in a `setTimeout` or an error-first
callback is caught by nothing.

---

Index: [The middleware contract](README.md) · Next → [Middleware that composes](02-middleware-that-composes.md)
