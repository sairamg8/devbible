---
title: "What you can pass to next"
sidebar_label: "01 · What you can pass"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**`next` takes one argument and interprets it four different ways. Two of the
four are magic strings, one is "no error", and everything else becomes an error
— including a string you meant as a message.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. **The console block
> below is re-used unchanged from the earlier authorised `sandbox/express-verify`
> run and is sandbox-measured** — nothing was executed for this rewrite. The
> argument handling is read from `router@2.2.0` in
> `sandbox/express-verify/node_modules/` — the `err === 'route'` and
> `layerError === 'router'` branches in `Router.prototype.handle`, and the mirror
> pair at the top of `Route.prototype.dispatch`'s `next`. Cross-checked against
> the [routing guide](https://expressjs.com/en/guide/routing.html), which
> documents `next('route')`, and the
> [error-handling guide](https://expressjs.com/en/guide/error-handling.html).

## The four interpretations

```js
// router/index.js — Router.prototype.handle(), the top of next()
let layerError = err === 'route' ? null : err
// …
if (layerError === 'router') {
  setImmediate(done, null)
  return
}
// …
if (layerError) { /* error mode: routes stop matching */ }
```

| You call | Interpreted as | Effect |
|---|---|---|
| `next()` / `next(null)` / `next(undefined)` | no error | continue to the next layer |
| `next('route')` | a **sentinel** | skip the rest of **this route's** handler stack, continue the router walk |
| `next('router')` | a **sentinel** | exit **this whole router** with no error, via `setImmediate` |
| `next(anythingElseTruthy)` | an error | enter error mode: route layers stop matching, `use` layers get their error form |

Two subtleties fall straight out of that code:

**Falsy is silently "no error".** `layerError` is the value itself, and the check
below is `if (layerError)`. So `next(null)`, `next(undefined)`, `next(0)`,
`next('')` and `next(false)` all just continue. That is *correct* and useful —
it is exactly what makes `cb(err)` from an error-first callback work:

```js
fs.readFile(p, (err, data) => {
  if (err) return next(err);
  // …
});
// or, when there is nothing else to do:
fs.readFile(p, next);        // err === null on success → continues
```

🔴 **A string that is not one of the two sentinels becomes an error object that
is not an Error.** `next('user not found')` enters the error stack with
`err === 'user not found'`, a primitive string. Your error handler then reads
`err.message` (`undefined`), `err.status` (`undefined`) and `err.stack`
(`undefined`), and typically produces a 500 with an empty body. It is one of the
easiest bugs to write and one of the least obvious to read.

**Always `next(new Error(...))`**, or a typed error class. A logger with an error
serialiser also silently drops a string, so the log line is as unhelpful as the
response.

## `next()` — continue

```js
// contract.mjs (excerpt) — the ordinary case
app.use((req, res, next) => { req.seen = ['A']; next(); });
app.use((req, res, next) => { req.seen.push('B'); next(); });
```

`next` does **not** return from your function. It runs the rest of the stack and
comes back, so anything after it also executes. `return next()` on every path is
the habit that removes an entire class of bug —
[chunk 03](03-double-send-and-guards.md).

## `next(err)` — enter the error stack

```js
// next-err.mjs
import express from 'express';

const app = express();
app.get('/e', (req, res, next) => next(new Error('nope')));
app.use((err, req, res, next) => {
  res.status(500).send(err.message);
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log(await (await fetch(`http://127.0.0.1:${port}/e`)).text());
  server.close();
});
```

```console
$ node next-err.mjs
nope
```

What happens mechanically: `layerError` is set, so the matching loop hits
`if (layerError) { match = false; continue }` and **every remaining route layer
is refused**. Only `use` layers are still considered, and each is invoked through
`Layer.handleError`, which runs it only if `fn.length === 4`
([Phase 0 · 03 · chunk 02](../../phase-0-express-basics/03-request-lifecycle/02-how-a-handler-is-invoked.md)).

On Express 5 a `throw` in a handler, or a rejection of the promise a handler
**returns**, is converted to `next(err)` by the `try`/`catch` and the promise hook
in `Layer.handleRequest`. Not a floating promise, not a `setTimeout` callback —
[Phase 5 · 02](../../phase-5-errors/02-async-errors.md).

## `next('route')` — skip the rest of this route

Only meaningful **inside a route's handler stack**, because that is where the
mirror branch lives:

```js
// router/lib/route.js — Route.prototype.dispatch()'s next()
if (err && err === 'route')  return done()      // leave the route, no error
if (err && err === 'router') return done(err)   // propagate the bigger signal
```

The use case is a guard that decides this route is not the right one after all,
and wants a *later* route to get the chance:

```js
app.get('/items/:id', (req, res, next) => {
  if (req.params.id === 'featured') return next('route');   // not an id
  res.json(getItem(req.params.id));
});

app.get('/items/featured', (req, res) => res.json(getFeatured()));
```

Two things to know before using it:

- **It only skips the current route's handlers.** The walk resumes at the next
  layer in the router, so a later matching route can still run — which is the
  point.
- **It is rarely the right tool.** The example above is better written as two
  routes in the correct order, with the literal `/items/featured` registered
  *first* ([Phase 1 · 04](../../phase-1-routing/04-route-ordering.md)). `next('route')`
  earns its place when the decision genuinely cannot be made from the path — a
  content-type check, a feature flag, an A/B split.

## `next('router')` — leave this router entirely

The bigger hammer, and the less known of the two:

```js
if (layerError === 'router') {
  setImmediate(done, null)
  return
}
```

It abandons the **whole router**, with no error, and hands control back to the
parent's stack. The documented use is a mounted router that decides it does not
apply to this request at all:

```js
const admin = express.Router();

admin.use((req, res, next) => {
  if (!req.user?.isAdmin) return next('router');   // not for us — try the parent
  next();
});
admin.get('/', showDashboard);

app.use('/admin', admin);
app.get('/admin', showPublicPage);   // reached when the router bailed out
```

Note the `setImmediate`: **exiting a router is asynchronous**, one turn of the
event loop. It never matters for correctness, and it is why a stack trace taken
after `next('router')` does not include the router's frames.

⚠️ **Both sentinels are magic strings with no namespace.** There is nothing
stopping `next('router')` from being written when an error message happened to be
the word "router", and nothing warns. This is the strongest practical argument
for never passing a bare string to `next`.

## Gotchas

**Symptom:** An error handler produces a 500 with an empty body and
`err.message` is `undefined`
**Cause:** `next('some message')` — a non-sentinel string is treated as the error
value itself, and a primitive string has no `message`, `status` or `stack`
**Fix:** `next(new Error('some message'))`, or a typed error class

**Symptom:** `next(err)` inside an error-first callback continues normally on
success and you did not expect it to
**Cause:** That is correct — `err` is `null`, which is falsy, so the walk
continues. `fs.readFile(p, next)` relies on it
**Fix:** Nothing. Know that only truthy values enter error mode

**Symptom:** `next('route')` in `app.use` middleware appears to do nothing
special
**Cause:** It clears `layerError` and continues the walk. The skip-the-rest
behaviour lives in `Route.dispatch`, so it is only meaningful inside a route's
handler stack
**Fix:** Use it in route handlers. In `use` middleware, plain `next()` is what you
want

**Symptom:** Two routes both need to handle a path and ordering alone will not
express it
**Cause:** The decision depends on something other than the path
**Fix:** `next('route')` from the first handler — but check first whether
registering the literal route above the parameterised one solves it

**Symptom:** A mounted router should sometimes not apply, and `next()` from its
first middleware still runs the rest of it
**Cause:** `next()` continues **within** the router
**Fix:** `next('router')`, which abandons the whole router and returns to the
parent's stack

## Interview questions

**★ What are the four things `next` does, depending on its argument?**
Nothing-or-falsy continues; `'route'` skips the rest of the current route's
handler stack; `'router'` exits the whole router with no error; anything else
truthy enters error mode, where route layers stop matching and only four-argument
`use` layers run.

**★ What happens if you call `next('user not found')`?**
It becomes the error value — a primitive string, not an `Error`. Your handler
gets `err.message === undefined`, no `status` and no `stack`, and usually
produces an empty 500. Always pass an `Error`.

**★ Why does `fs.readFile(path, next)` work?**
Because an error-first callback passes `null` on success, and `next` treats any
falsy argument as "no error" and continues. It is a real idiom, and it is the
reason falsy values are not an error.

**★ What is the difference between `next('route')` and `next('router')`?**
`'route'` leaves the current route's handler stack and lets the router keep
walking, so a later matching route can run. `'router'` abandons the entire router
with no error and returns to the parent's stack — via `setImmediate`, so it costs
one tick.

**When is `next('route')` actually the right tool?**
When the decision to decline cannot be expressed in the path — a content-type
check, a feature flag, an experiment split. If it *can* be expressed in the path,
register the more literal route first instead.

**Why is passing a bare string to `next` risky beyond the missing `Error`
properties?**
Because two strings are sentinels. `'route'` and `'router'` have no namespace,
so a message that happens to equal one of them silently changes control flow
instead of raising an error.

---

Index: [`next` semantics](README.md) · Next → [The hang](02-the-hang.md)
