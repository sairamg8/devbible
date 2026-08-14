---
title: "Four-arg error middleware"
sidebar_label: "01 · Error middleware"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Error middleware has four parameters. Express detects it by arity. Mount it
last.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> [Error handling](https://expressjs.com/en/guide/error-handling.html): error-handling
> middleware is *"defined last, after other `app.use()` and routes calls"*, and *"you
> must provide four arguments to identify it as an error-handling middleware function.
> Even if you don't need to use the `next` object, you must specify it to maintain the
> signature."* The default handler that runs when you define none is documented too — it
> takes the status from `err.status`/`err.statusCode`, falls back to 500 outside the
> 4xx–5xx range, writes `err.stack` in development, and copies `err.headers` onto the
> response.

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

If you omit `next` from the signature, Express treats the function as normal
middleware and your errors vanish into the wrong path.

## Arity is the whole detection mechanism

There is no registration API, no flag, no `app.onError`. Express looks at
`fn.length` — the number of declared parameters — and routes errors only to
functions declaring four. Everything surprising about error middleware follows
from that one fact:

```js
app.use((err, req, res, next) => {});        // length 4 → error handler ✅
app.use((err, req, res) => {});              // length 3 → ORDINARY middleware ⛔
app.use((err, req, res, next, extra) => {}); // length 5 → not recognised ⛔
```

The three-parameter version is the dangerous one. It is not an error — it
registers successfully as normal middleware, receives `(req, res, next)` under
misleading names, and your errors sail past it into Express's default handler.

Two consequences that catch people out:

- **Default parameters and rest args change `length`.** `(err, req, res, next = null)`
  has a `length` of **3**, because default parameters are not counted. So does
  `(...args)`, which has a length of 0. Wrapping an error handler in a helper that
  uses rest arguments silently unregisters it.
- **Multiple error handlers chain.** Calling `next(err)` from one passes the error to
  the *next* four-arg handler, not back to routes. That is how you layer a logger
  before a responder.

## Trade-off

One central error handler gives you a single place where the response envelope,
the status mapping and the logging decision live — which is why every guard in a
route can be a bare `throw`. The cost is distance: the handler sees an error
object and a request, not the context that produced them. Anything the handler
needs to make a good decision has to be *on the error* (`statusCode`, `code`,
`expose`) or on the request (a request id), because there is nothing else left
by the time it runs.

Handling errors locally in each route keeps that context, but you will write the
envelope fifteen times and get it subtly different in three of them. Centralise,
and put the effort into the error objects instead.

## Gotchas

**Symptom:** Error handler never runs  
**Cause:** Three parameters, or mounted above routes  
**Fix:** Four args, bottom of stack

**Symptom:** The handler stopped working after a "harmless" refactor  
**Cause:** A default value or rest parameter dropped `fn.length` below 4 —
`(err, req, res, next = noop)` registers as ordinary middleware  
**Fix:** Keep all four parameters plain and undefaulted. If a linter complains that
`next` is unused, silence the linter, not the signature

**Symptom:** Errors from middleware mounted *after* the error handler are unhandled  
**Cause:** Express walks the stack in order; a handler cannot catch what is registered
below it  
**Fix:** Error middleware goes last — after every route and every other `app.use`

**Symptom:** A 404 response arrives with an HTML body instead of your JSON envelope  
**Cause:** Nothing matched and no 404 middleware was registered, so Express's default
final handler answered  
**Fix:** Register a three-arg 404 middleware above the error handler
([page 06](06-not-found-and-process.md))

## Interview questions

**★ How does Express recognize error middleware?**  
Function length 4: `(err, req, res, next)`.

**★ What happens if you write `(err, req, res)` with three parameters?**  
It registers as ordinary middleware and never receives errors. Worse, it silently
receives `(req, res, next)` bound to parameters named `err`, `req`, `res` — so it
looks like it is running while doing something completely different.

**★ Why must you keep `next` even when you never call it?**  
Because arity *is* the detection mechanism. The docs say it outright: specify it
"to maintain the signature". Dropping it unregisters the handler.

**Can you have more than one error handler?**  
Yes. `next(err)` from one moves to the next four-arg handler in the stack, which is
the clean way to separate a logging handler from a responding one.

**What does Express do if you register none at all?**  
Its default handler responds: status from `err.status`/`err.statusCode` (500 if
outside 4xx–5xx), `err.stack` in development, an HTML page in production. Adequate
for a demo, wrong for an API — no stable JSON shape, and no control over what leaks.

---

← Index: [Phase 5](README.md) · Next → [Async errors on Express 5](02-async-errors.md)
