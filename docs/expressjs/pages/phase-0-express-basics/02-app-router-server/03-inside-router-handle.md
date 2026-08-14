---
title: "Inside router.handle"
sidebar_label: "03 · Inside router.handle"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**One function walks the stack, rewrites `req.url` per mount, refuses to match
routes while an error is pending, and puts everything back on the way out.**

> Verified: 2026-08-14. Read from **`router@2.2.0`** at
> `sandbox/express-verify/node_modules/router/index.js` — `Router.prototype.handle`,
> `trimPrefix`, `sendOptionsResponse`, `restore` — cited by function name.
> **Reading source is not a run: nothing was executed for this page and it carries
> no console block.** Cross-checked against
> [expressjs.com · Routing](https://expressjs.com/en/guide/routing.html) and
> [Using middleware](https://expressjs.com/en/guide/using-middleware.html). The
> request's end-to-end journey, including body parsing and the response, is
> [topic 03](../03-request-lifecycle.md); this page is the router's part of it.

This is the single function that makes Express behave the way it does. It is
worth reading once properly, because roughly a third of the "why did Express do
*that*" questions in the rest of this track are answered here.
## What it installs on the request, before anything runs

```js
// router/index.js — Router.prototype.handle()
let done = restore(callback, req, 'baseUrl', 'next', 'params')

req.next = next

if (req.method === 'OPTIONS') {
  methods = []
  done = wrap(done, generateOptionsResponder(res, methods))
}

req.baseUrl     = parentUrl                     // req.baseUrl || ''
req.originalUrl = req.originalUrl || req.url

next()
```

Four things, each with a visible consequence:

- **`restore(callback, req, 'baseUrl', 'next', 'params')`** captures the current
  values of those three properties and puts them back when this router finishes.
  A nested router therefore cannot leak its `baseUrl` or its `params` to the
  parent — the parent's values are restored as the request unwinds.
- **`req.next` is the router's own `next`.** It exists, it is not documented as
  public API, and it is the reason a stray `req.next()` in application code
  sometimes appears to work.
- **`req.originalUrl` is set once**, guarded by `|| req.url`. The outermost
  router to touch the request wins, so `originalUrl` is the URL as it arrived —
  which is why it, not `req.path`, is the correct thing to log
  ([Phase 5 · 07](../../phase-5-errors/07-error-logging.md)).
- **`OPTIONS` gets a collector.** An empty `methods` array is threaded through the
  walk and filled in as routes are examined. See below.

## The walk

`next()` is called once to start, and once by every layer that hands off. Each
call does the same five things:

**1 · Interpret the argument.**

```js
let layerError = err === 'route' ? null : err
```

`next('route')` is not an error — it is a signal that clears `layerError` and
skips the rest of the current route's handler stack. `next('router')` is checked
a few lines later and exits the router entirely, `setImmediate(done, null)`.
Anything else that is not `undefined` is a real error and puts the walk into
error mode.

**2 · Undo any URL rewriting** the previous layer's mount caused, restoring
`req.url` and `req.baseUrl` before considering the next layer.

**3 · Break the synchronous stack if it is getting deep.**

```js
if (++sync > 100) {
  return setImmediate(next, err)
}
```

Every 100 consecutive **synchronous** `next()` calls, the router yields to the
event loop instead of recursing. `sync` is reset to 0 whenever a layer actually
runs. This is why an app with hundreds of middleware does not blow the call
stack, and it is a real (if tiny) scheduling boundary: a request crossing many
purely synchronous layers is not processed in one uninterrupted tick.

**4 · Find the next matching layer**, scanning forward from the current index:

```js
while (match !== true && idx < stack.length) {
  layer = stack[idx++]
  match = matchLayer(layer, path)
  route = layer.route

  if (typeof match !== 'boolean') {
    layerError = layerError || match      // a thrown path error becomes the error
  }
  if (match !== true) continue
  if (!route) continue                    // middleware: matched, take it

  if (layerError) { match = false; continue }   // ← routes are skipped in error mode

  const hasMethod = route._handlesMethod(req.method)

  if (!hasMethod && req.method === 'OPTIONS' && methods) {
    methods.push.apply(methods, route._methods())
  }
  if (!hasMethod && req.method !== 'HEAD') match = false
}
```

**5 · Run it** — after `req.route` and `req.params` are set and any
`router.param` callbacks have run.

## Error mode: the four lines that make error handling work

```js
if (layerError) { match = false; continue }
```

Once an error is pending, **route layers stop matching entirely.** Only `use`
layers are still considered, and each is asked for its error form —
`layer.handleError(err, req, res, next)` instead of `layer.handleRequest`, which
is where the four-argument arity check lives.

That single line explains behaviour that otherwise looks arbitrary:

- **Why an error skips all your remaining routes** even ones whose path matches.
- **Why an error handler must be mounted with `use`** and cannot be a route.
- **Why an error handler mounted *above* the failing route never runs** — the walk
  only moves forward, and index *n* is behind you by the time the error is raised.
- **Why a 404 is not an error**: nothing set `layerError`, so the walk simply ran
  off the end of the stack and called `done(undefined)`. `finalhandler` then
  chooses 404 rather than 500. [Phase 5 ·
  06](../../phase-5-errors/06-not-found-and-process.md).

`HEAD` is the other conditional worth noticing: `if (!hasMethod && req.method !==
'HEAD') match = false`. A route with no `head` handler still matches a `HEAD`
request, and the `Route` then dispatches it to the `get` stack. That is the
mechanism behind the documented caveat that `app.get` covers `HEAD` **unless
`app.head` was registered for that path first** —
[Phase 1 · 01](../../phase-1-routing/01-http-methods.md).

## Gotchas

**Symptom:** An error handler mounted above the failing route never runs
**Cause:** The walk only moves forward; by the time `next(err)` is called the
handler's index is already behind the cursor
**Fix:** Error handlers go last, below every route —
[Phase 5 · 01](../../phase-5-errors/01-error-middleware.md)

**Symptom:** A route with a matching path is skipped and you cannot see why
**Cause:** Something upstream called `next(err)`. Route layers refuse to match
while an error is pending; only `use` layers are still considered
**Fix:** Look upstream, not at the route. An unexpected `next(err)` is the cause,
and in Express 5 a rejected promise in an earlier handler produces one silently

**Symptom:** `next('router')` in a sub-router seems to skip more than expected
**Cause:** It exits **that whole router**, not just the current route, calling the
parent's callback with no error
**Fix:** Use `next('route')` to skip the rest of one route's handler stack;
reserve `next('router')` for "this mount does not apply, try the parent"

**Symptom:** `next()` called twice in one handler produces
`Cannot set headers after they are sent`
**Cause:** The walk resumes twice from the same index, so everything downstream
runs twice — including whatever wrote the response
**Fix:** `return next()`, always. [Phase 2 ·
03](../../phase-2-middleware/03-next-semantics.md) is this failure in full

**Symptom:** A `HEAD` request runs your `GET` handler even though you registered
`app.head` for the path
**Cause:** Registration order. The route matches `HEAD` regardless, and dispatch
inside the `Route` picks the `head` stack only if one exists — registered before
the `get`
**Fix:** Register `app.head` first, or do not register it at all and let `GET`
serve both — [Phase 1 · 01](../../phase-1-routing/01-http-methods.md)

## Interview questions

**★ Why does an error skip every remaining route but still hit error middleware?**
Because `handle`'s matching loop contains `if (layerError) { match = false;
continue }` — route layers are refused while an error is pending. Only `use`
layers are still considered, and each is invoked in its error form, which is
where the four-argument arity check happens.

**★ Why must error middleware be registered last?**
The stack is an array walked forward by index. When `next(err)` fires, the cursor
is already past every layer registered above the failing route, and nothing
rewinds it. An error handler at the top of the file is unreachable.

**★ What does `next('route')` do that `next()` does not?**
It sets `layerError` to `null` and skips the remaining handlers **of the current
route**, continuing the walk at the next layer. `next('router')` is the bigger
hammer: it exits the entire router with no error, via `setImmediate(done, null)`.

**★ How does Express avoid a stack overflow with hundreds of middleware?**
`Router.prototype.handle` counts consecutive synchronous `next()` calls and, past
100, defers with `setImmediate` instead of recursing. The counter resets whenever
a layer actually runs.

**★ Why is a 404 not an error in Express?**
Because nothing set `layerError`. The walk simply ran past the end of the stack
and called `done(undefined)`; `finalhandler` reads the absent error and chooses
404. An error would have travelled the same path with a value, and produced 500.

**Why does calling `next()` twice corrupt the response?**
The walk resumes from the stored index twice, so every downstream layer runs
twice — including the one that already wrote a response. The second write throws
`ERR_HTTP_HEADERS_SENT`. `return next()` is the habit that prevents it.

**What is `req.next`?**
The router's own `next` function, assigned onto the request at the top of
`handle`. It is not documented public API, and code that calls it is depending on
an internal.

---

← Prev: [A Router is a function too](02-a-router-is-a-function-too.md) · Index: [Object graph](README.md) · Next → [URL rewriting and OPTIONS](04-url-rewriting-and-options.md)
