---
title: "A Router is a function too"
sidebar_label: "02 · A Router is a function too"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**`app` and `Router` are the same shape: a callable function with a `.handle` and
a stack. That is the entire reason everything composes with everything.**

> Verified: 2026-08-14. Read from the installed **`router@2.2.0`** source at
> `sandbox/express-verify/node_modules/router/`, cited by file and function, and
> from `express@5.2.1`'s `lib/express.js` and `lib/application.js`. **Reading
> source is not a run: nothing was executed for this page and it carries no
> console block.** Public behaviour cross-checked against
> [expressjs.com · Router](https://expressjs.com/en/5x/api/router.html) and
> [Using middleware](https://expressjs.com/en/guide/using-middleware.html).

## The constructor

```js
// router/index.js — Router()
function Router (options) {
  if (!(this instanceof Router)) {
    return new Router(options)
  }

  const opts = options || {}

  function router (req, res, next) {
    router.handle(req, res, next)
  }

  // inherit from the correct prototype
  Object.setPrototypeOf(router, this)

  router.caseSensitive = opts.caseSensitive
  router.mergeParams   = opts.mergeParams
  router.params        = {}
  router.strict        = opts.strict
  router.stack         = []

  return router
}
```

Compare it, line for line, with `createApplication` in
[topic 01 · chunk 02](../01-what-express-is/02-the-app-is-a-function.md):

| | `express()` | `express.Router()` |
|---|---|---|
| Returns | `function(req,res,next){ app.handle(...) }` | `function(req,res,next){ router.handle(...) }` |
| Gets its methods from | `mixin(app, application.js)` | `Object.setPrototypeOf(router, Router.prototype)` |
| Also is | an `EventEmitter` | nothing else |
| Carries | `settings`, `locals`, `engines`, a lazy `router` | `stack`, `params`, `caseSensitive`, `strict`, `mergeParams` |

There is a line in the source that makes the "callable" part explicit rather than
accidental:

```js
/**
 * Router prototype inherits from a Function.
 */
Router.prototype = function () {}
```

`Router.prototype` is **a function**, so a router instance is callable through
its prototype chain. This is deliberate, and it is the design decision the entire
composition model rests on.

## Why that matters: everything mountable is just middleware

Because `app`, a `Router`, and your own `(req, res, next)` function are all the
same shape, `use` does not need to know which one it is being handed:

```js
app.use(express.json());        // a plain middleware function
app.use('/api', apiRouter);     // a Router — also a function
app.use('/admin', adminApp);    // a whole Express app — also a function
app.use('/v1', router1, router2, express.json());  // any mix, in order
```

None of these is a special case in the framework. `Router.prototype.use` accepts
functions and pushes each one onto the stack; a router or a sub-app satisfies
"function" the same way your own middleware does. That uniformity is why the
Express middleware ecosystem is the size it is — and it is also why mounting a
sub-app "works" while behaving subtly differently from mounting a router, which
is [chunk 05](05-sub-apps-and-the-server.md).

## The stack is a list of Layers

```js
// router/index.js — Router.prototype.use(), the part that matters
const layer = new Layer(path, {
  sensitive: this.caseSensitive,
  strict: false,
  end: false
}, fn)

layer.route = undefined

this.stack.push(layer)
```

A **`Layer`** pairs a compiled path pattern with one function. `router.stack` is
an ordinary array of them, in registration order, and dispatch is a walk down
that array. Three details in those five lines are load-bearing:

- **`strict: false`, hard-coded.** The app's `strict routing` setting is *not*
  passed to a `use` layer. `app.use('/admin', r)` treats `/admin` and `/admin/`
  identically no matter what you set, and only `app.get('/admin/')` style route
  layers are affected by `strict routing`.
- **`end: false`.** A `use` layer matches a **prefix**, which is why
  `app.use('/admin', r)` runs for `/admin/users/12`. Route layers use `end: true`
  and must match the whole path.
- **`layer.route = undefined`.** This flag is how the dispatcher later tells
  middleware apart from routes — and it is what makes error handling work at all
  ([chunk 03](03-inside-router-handle.md)).

Routes are the other kind of entry: `router.route(path)` creates a `Route`, whose
own stack holds one or more handlers **per method**. So `app.get('/x', a, b)`
pushes *one* layer onto the router's stack, holding a `Route` whose `get` stack
is `[a, b]`.

```text
router.stack = [
  Layer('/',       use,   fn = express.json)        route: undefined
  Layer('/users',  use,   fn = usersRouter)         route: undefined
  Layer('/orders', route, fn = route.dispatch) ───► Route('/orders')
                                                      .get   → [auth, list]
                                                      .post  → [auth, validate, create]
]
```

## The source's own warning about `use` and OPTIONS

Worth quoting verbatim, because it is the clearest statement of the `use`/route
distinction anywhere, and it is a code comment rather than documentation:

> Use (like `.all`) will run for any http METHOD, but it will not add handlers
> for those methods so OPTIONS requests will not consider `.use` functions even
> if they could respond.
>
> The other difference is that *route* path is stripped and not visible to the
> handler function. The main effect of this feature is that mounted handlers can
> operate without any code changes regardless of the "prefix" pathname.

Two facts, both consequential:

1. **`use` registers no methods**, so it contributes nothing to the automatic
   `OPTIONS` response. Only routes do.
2. **`use` strips the matched prefix from `req.url`** before calling the handler,
   which is *why* a router can be mounted anywhere without editing its routes.
   The mechanics of that rewrite — and what it does to `req.baseUrl`,
   `req.originalUrl` and `req.params` — are [chunk
   04](04-url-rewriting-and-options.md).

## Consequences you can now derive

- **Order is registration order, per router.** There is no priority, no
  specificity ranking, no "most specific wins". The array is walked from index 0.
  [Phase 2 · 02](../../phase-2-middleware/02-execution-order/01-the-four-levels.md) is this fact,
  applied.
- **A router mounted before a middleware never sees it.** The mount pushed a
  layer at position *n*; the middleware is at *n+1*. Nothing reorders them later.
- **You can mount the same router twice**, at two prefixes, and it works —
  because a `Router` holds no per-request state. Everything per-request is on
  `req`.
- **`express.Router()` is usable without Express.** It is a published package;
  Express only re-exports it. Nothing in `router/` imports `express`.
- **Registering a route mid-request is legal and confusing.** `stack` is a plain
  array being iterated by index, so a route added by an earlier handler is
  reachable in the same request. Never do this deliberately; recognise it when a
  "dynamic route registration" helper produces routes that appear only on the
  second request.

## Gotchas

**Symptom:** `app.set('strict routing', true)` has no effect on a mounted router's
prefix
**Cause:** `Router.prototype.use` builds its layer with `strict: false` hard-coded;
only route layers read the setting
**Fix:** Expect `/admin` and `/admin/` to be the same mount point. If you need
them distinguished, that is a route concern, not a mount concern

**Symptom:** `app.use('/admin', r)` also matches `/administrator`
**Cause:** It does not — but people expect the opposite failure and mis-diagnose.
`use` layers match a prefix **that breaks on a `/`**, so `/administrator` is not
a match while `/admin/anything` is
**Fix:** Read [chunk 04](04-url-rewriting-and-options.md)'s `trimPrefix` walk-through
before adding a regex

**Symptom:** An `OPTIONS` request returns 404 for a path that clearly has
middleware on it
**Cause:** `use` registers no methods; only routes contribute to the automatic
`OPTIONS` responder
**Fix:** Register real routes, or handle `OPTIONS` explicitly — and mount CORS
above authentication, [Phase 9 · 02](../../phase-9-hardening/02-cors.md)

**Symptom:** Two routers were "combined" by assigning `r2.stack = r1.stack`
**Cause:** Someone reached past the API into the internals
**Fix:** `r1.use(r2)`. The stack is not a public interface, and `Layer` options
were compiled against the router that created them

## Interview questions

**★ What *is* an Express `Router`, mechanically?**
A callable function with a `stack` array of `Layer` objects and a `handle` method
that walks it. `Router.prototype` is literally a function, so instances are
callable — which is why a router can be passed to `app.use` exactly like any
middleware.

**★ Why can you pass a `Router`, a sub-app, and a plain function to the same
`app.use`?**
Because all three are functions of `(req, res, next)`. `use` type-checks for
"function" and pushes a `Layer`; it has no concept of "router" versus
"middleware". The uniformity is the design.

**★ What is the difference between a `use` layer and a route layer?**
A `use` layer matches a **prefix** (`end: false`), ignores `strict`, strips the
matched prefix from `req.url` before calling its handler, and registers **no HTTP
methods**. A route layer must match the whole path and holds a per-method handler
stack. The method registration is why only routes appear in the automatic
`OPTIONS` response.

**★ How does Express decide which middleware runs first?**
Registration order within a router, walked as an array from index 0. There is no
specificity ranking of any kind — a fact that surprises people arriving from
frameworks that sort routes.

**Can the same Router be mounted at two paths?**
Yes. A router holds no per-request state; everything per-request lives on `req`.
Both mounts push a layer, and each request rewrites `req.url` for the mount it
matched.

**Does `express.Router()` require Express?**
No — it is the standalone `router` package, re-exported. `express.Router ===
require('router')` in the installed tree, and nothing in `router/` imports
Express.

---

← Prev: [The three objects](01-the-three-objects.md) · Index: [Object graph](README.md) · Next → [Inside `router.handle`](03-inside-router-handle.md)
