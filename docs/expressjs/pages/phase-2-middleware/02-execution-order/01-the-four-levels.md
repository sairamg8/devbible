---
title: "The four levels"
sidebar_label: "01 · The four levels"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**First registered runs first. There is no priority, no specificity ranking and
no sorting — the stack is an array, walked from index 0.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. **The console block
> below is re-used unchanged from the earlier authorised `sandbox/express-verify`
> run and is sandbox-measured** — nothing was executed for this rewrite.
> [Using middleware](https://expressjs.com/en/guide/using-middleware.html) names
> the same levels this page does — application-level, router-level, route-level,
> error-handling and built-in — and states that middleware executes *"in the order
> they are defined"*. The [router
> reference](https://expressjs.com/en/5x/api/router.html) adds that *"the order of
> `router.use()` definitions is critical — they execute sequentially, defining
> middleware precedence"*. The array-walk mechanism is
> `Router.prototype.handle`'s `while (match !== true && idx < stack.length)` loop
> in `router@2.2.0`, in `sandbox/express-verify/node_modules/`.

## Levels

```text
app.use(globalMw)           // every request that reaches the app stack
app.use('/api', apiRouter)  // only under /api
apiRouter.use(routerMw)     // only inside that router
apiRouter.get('/x', mw, h)  // only GET /api/x
```

Those are not four different mechanisms. They are **one** mechanism — a layer
pushed onto a stack — differing only in *which* stack and *what path filter*:

| Level | Which stack | Path filter | `end` |
|---|---|---|---|
| application | the app's base router | `/` or the mount path | `false` (prefix) |
| router | that router's own stack | as given to `router.use` | `false` (prefix) |
| route | the `Route`'s per-method stack | the full route path | `true` (whole path) |
| error | any of the above | same as the level it is on | same |

**Nothing sorts them.** There is no "more specific route wins", no priority
number, and no registration-time reordering. `app.get('/users/:id')` registered
before `app.get('/users/new')` means `/users/new` is handled by the `:id` route
with `id === 'new'`, forever, silently
([Phase 1 · 04](../../phase-1-routing/04-route-ordering.md)).

## Prove mount order

```js
// order-mw.mjs
import express from 'express';

const app = express();
const log = (label) => (req, res, next) => {
  req.trace = (req.trace || []).concat(label);
  next();
};

app.use(log('app'));

const api = express.Router();
api.use(log('router'));
api.get('/item', log('route'), (req, res) => {
  res.json({trace: req.trace});
});

app.use('/api', api);

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log(await (await fetch(`http://127.0.0.1:${port}/api/item`)).json());
  server.close();
});
```

```console
$ node order-mw.mjs
{ trace: [ 'app', 'router', 'route' ] }
```

## Why it comes out in that order

Not because "app-level beats router-level" — that framing is wrong and leads
people astray. It is because of **where the mount sits in the app's array**:

```text
app's base router stack:
  [0] Layer('/',     use)  → log('app')          ← registered first
  [1] Layer('/api',  use)  → the api router      ← registered second

  api's stack:
    [0] Layer('/',     use)   → log('router')
    [1] Layer('/item', route) → Route('/item')
                                  .get → [log('route'), handler]
```

The walk reaches `[0]`, runs `log('app')`, gets `next()`, reaches `[1]`, matches
the `/api` prefix, and **descends** into the api router's own walk — which starts
again at its index 0. The nesting is what produces the ordering, not a rule about
levels.

🔴 **Which means the framing flips the moment you reorder the mounts:**

```js
app.use('/api', api);      // ← mounted FIRST
app.use(log('app'));       // ← never runs for /api/item
```

Here `log('app')` is at index 1 and the api router is at index 0, so for any
request under `/api` the router matches, handles the request, and the walk
finishes without ever reaching index 1. "Application middleware runs before
router middleware" is only true when it was **registered** first. There is no
level-based precedence.

## The consequences you can now derive

- **A route registered before its parser has no body.** `express.json()` at index
  5 and `app.post('/orders')` at index 3 means `req.body` is `undefined` in that
  handler and defined in every handler registered after index 5. Same app, two
  behaviours.
- **A router mounted before a middleware never sees it**, for every path under
  that mount — including its 404s and its `OPTIONS`.
- **`router.use` inside a router applies only to that router**, not to siblings.
  Two routers mounted next to each other share nothing.
- **Route-level middleware runs after all of it**, because it lives inside the
  `Route`'s per-method stack, which the route layer dispatches into.
- **An error handler is reachable only from below it.** The walk moves forward,
  so a four-argument handler at index 2 is behind the cursor by the time a route
  at index 7 fails ([Phase 5 · 01](../../phase-5-errors/01-error-middleware/01-arity-and-placement.md)).

## The order that actually matters, in one list

Every entry here is a real failure documented elsewhere in this track:

```js
app.set('trust proxy', 1);     // 0 · settings — the router reads some at first use
app.use(requestId);            // 1 · before any logging
app.use(httpLogger);           // 2 · after the id, before everything it should record
app.use(helmet());             // 3 · headers on every response, including errors
app.use(cors(opts));           // 4 · BEFORE authn — preflight carries no credentials
app.use(express.json({limit})); // 5 · before routes that read a body
app.get('/livez', livez);      // 6 · ABOVE the rate limiter
app.get('/readyz', readyz);    // 7 · likewise
app.use(rateLimit(opts));      // 8 · after probes, before routes
app.use('/api/v1', v1);        // 9 · the product
app.use(notFound);             // 10 · three-arg, below every route
app.use(errorHandler);         // 11 · four-arg, last
```

| Constraint | What breaks if you get it wrong |
|---|---|
| `trust proxy` before anything reading `req.ip` | the rate limiter keys on a wrong or forged address — [Phase 9 · 01](../../phase-9-hardening/01-trust-proxy/README.md) |
| request id before logging | the first log lines have no correlation id |
| CORS before authn | preflight gets 401, and the browser reports "CORS" — [Phase 9 · 02](../../phase-9-hardening/02-cors.md) |
| parsers before routes | `req.body` is `undefined` in exactly the handlers registered above them |
| probes above the limiter | a rate-limited `/readyz` pulls the instance out of rotation under load — [Phase 10 · 05](../../phase-10-app-factory/05-health-and-boot.md) |
| Helmet early | error responses miss the security headers if it is mounted after the routes |
| 404 then error handler | a 404 is not an error and never reaches four-arg middleware — [Phase 5 · 06](../../phase-5-errors/06-not-found-and-process.md) |

## Gotchas

**Symptom:** `req.body` is `undefined` in one handler and populated in another,
in the same app
**Cause:** The first route was registered above `express.json()`
**Fix:** Parsers before routes. In a factory this is visible; spread across files
it is not

**Symptom:** Global middleware does not run for a mounted router
**Cause:** The router was mounted **first**, so its layer is at a lower index and
the walk finishes inside it
**Fix:** Registration order is absolute. "Application-level runs first" is a
consequence of registering first, not a rule

**Symptom:** Auth middleware runs on `/health` and breaks the probes
**Cause:** Global `app.use(auth)` above the probe routes
**Fix:** Probes at the top; auth mounted on `/api` or per route

**Symptom:** `router.use(logger)` on one router also seems to log another
router's requests
**Cause:** It does not — the logger is on the app, or on a shared parent router
above both mounts
**Fix:** Check which object owns the `use`. Sibling routers share nothing

**Symptom:** Error responses are missing the security headers that normal
responses have
**Cause:** Helmet was mounted after the routes, so the error path never crossed it
**Fix:** Mount it near the top, above anything that can respond

## Interview questions

**★ In what order do app, router and route middleware run?**
In registration order, walking one array from index 0, descending into a mounted
router's own array when its layer matches. The usual "app, then router, then
route" ordering is a **consequence** of registering the global middleware before
the mount — reverse the two lines and the global middleware never runs for that
mount.

**★ Does Express sort routes by specificity?**
No. There is no sorting of any kind. `app.get('/users/:id')` registered before
`app.get('/users/new')` handles `/users/new` with `id = 'new'`, permanently and
silently.

**★ Name three ordering constraints and what each breaks.**
`trust proxy` before anything reading `req.ip` (the rate limiter keys on a forged
address); CORS before authentication (a preflight carries no credentials, so
authn 401s it and the browser reports a CORS error); health probes above the rate
limiter (a limited `/readyz` removes the instance from rotation exactly when it
is busiest).

**★ Why can an error handler mounted at the top of a file never run?**
Because the walk only moves forward from a stored index. By the time a route
lower down calls `next(err)`, the handler's index is behind the cursor and
nothing rewinds.

**How do you make a middleware apply to only part of the app?**
Mount it at a path prefix, or on the router that owns that subtree, or on the
route itself. Not with an `if (req.path.startsWith(...))` inside a global
middleware — that re-implements routing, and `req.path` has the mount prefix
stripped inside a router.

**Two routers are mounted side by side. Does `router.use` on one affect the
other?**
No. Each router has its own stack. Anything they must share belongs on a common
parent — the app, or a parent router both are mounted under.

---

Index: [Execution order](README.md) · Next → [Ordering in practice](02-ordering-in-practice.md)
