---
title: "Middleware that composes"
sidebar_label: "02 · Middleware that composes"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Every built-in is a factory that returns a middleware. Copying that convention
— configuration outside, request handling inside, a named function returned —
is what makes middleware testable, mountable anywhere, and debuggable.**

> Verified: 2026-08-14. The factory convention is Express's own: the
> [writing middleware](https://expressjs.com/en/guide/writing-middleware.html)
> guide describes configurable middleware as a module that *"exports a function
> which accepts an options object and returns the middleware implementation"*, and
> every built-in — `express.json()`, `express.static()`, `express.urlencoded()` —
> is called for its return value. `Layer.name = fn.name || '<anonymous>'` is read
> from `router@2.2.0`'s `lib/layer.js` in
> `sandbox/express-verify/node_modules/`. **No sandbox run backs this page and it
> carries no console block.** The structural recommendations are this bible's
> guidance, stated as such.

## The factory convention

```js
// ❌ configuration read at request time, from module scope
export function requireRole(req, res, next) {
  if (req.user?.role !== process.env.ADMIN_ROLE) return res.sendStatus(403);
  next();
}

// ✅ configuration closed over once; the middleware is pure request handling
export function requireRole(role) {
  return function requireRole(req, res, next) {
    if (req.user?.role !== role) return res.sendStatus(403);
    next();
  };
}
```

Four things the second form buys, none of them stylistic:

- **It is testable without an app.** `requireRole('admin')` returns a plain
  function you can call with two fakes and a spy.
- **It can be mounted twice with different configuration** — `requireRole('admin')`
  on one router, `requireRole('auditor')` on another.
- **Configuration is validated at boot, not per request.** A missing env var
  fails when the factory runs, during startup, rather than on the first request
  that happens to hit that route at 3 a.m.
- **It reads `process.env` once**, in one place, which is the whole argument of
  [Phase 9 · 06](../../phase-9-hardening/06-timeouts-and-secrets.md) — one config
  module parsed at import, so a missing value fails the boot.

**Name the returned function.** `Layer` stores `fn.name || '<anonymous>'`, and
that name is what the `DEBUG=router` output and every stack trace shows you. A
stack of twelve `<anonymous>` layers is unreadable; a stack of `requireRole`,
`validate`, `loadOrder` tells you where you are. The named function expression
above costs nothing and is the difference.

## Per-route beats global, when it can be

```js
// ✅ greppable: every protected route says so
router.post('/orders', requireAuth, validate(createOrder), createOrderHandler);

// ⚠️ opt-out: a route added above this line is silently public
router.use(requireAuth);
router.post('/orders', validate(createOrder), createOrderHandler);
```

Both work. The difference is what happens when someone adds a route six months
later. In the first form, a route with no `requireAuth` is visible in the diff
and greppable across the codebase. In the second, a route added **above** the
`use` line is public and looks identical to every other line in the file.

The rule this bible uses: **authentication and authorization are opt-in per
route; cross-cutting infrastructure is global.** Request id, logging, body
parsing, CORS, Helmet and the rate limiter apply to everything and belong at the
top of the factory. Anything that decides *who may do this* belongs on the route,
where a reviewer can see it. [Phase 8 ·
04](../../phase-8-validation-authz/04-authn-middleware/README.md).

## Middleware that runs for a subset

Three mechanisms, in increasing specificity:

```js
app.use('/api', apiOnly);                        // path prefix
router.route('/orders/:id').all(loadOrder);      // every method on one path
router.get('/orders/:id', loadOrder, sendOrder); // one method, one path
```

And a fourth people reach for and should not: a global middleware with an
internal `if (req.path.startsWith('/api'))`. That re-implements routing badly —
it runs for every request, it duplicates the prefix as a string constant, and it
breaks the moment the mount moves, because `req.path` inside a mounted router has
had the prefix stripped
([Phase 1 · 03 · chunk 01](../../phase-1-routing/03-router-composition/01-mounting-a-router.md)).
Mount it at the prefix instead and let the router do the matching.

## Async middleware

```js
export function loadOrder(orders) {
  return async function loadOrder(req, res, next) {
    const order = await orders.findOwned(req.params.orderId, req.user.orgId);
    if (!order) return next();          // fall through to the 404
    req.order = order;
    next();
  };
}
```

Three rules, all consequences of how Express 5 catches errors:

1. **Make it `async` and `await` everything.** The rejection hook attaches to the
   promise your function **returns**, so anything not on that promise is
   invisible — and a floating promise produces an `unhandledRejection` that by
   default terminates the process, on a request that already returned 200.
2. **Do not `try`/`catch` just to `next(err)`.** Express 5 does it for you.
   A `catch` that adds context is fine; a `catch` that rethrows the same error is
   noise.
3. **Do not pass `next` as a callback.** `orders.find(id, next)` looks clever and
   makes the loaded value the *error* argument. Await, then call `next()`.

## Extending `req` — and the cost of it

Attaching to `req` is documented practice and it is how every middleware
communicates downstream. Two disciplines make it survivable:

- **Namespace or be obvious.** `req.user`, `req.order`, `req.validated`,
  `req.id` are conventional. `req.data`, `req.ctx` and `req.temp` are the
  properties that collide with a library six months later.
- 🔴 **There is no documented reserved-name list.** The Express docs do not
  publish one; the de-facto list is everything in the
  [request reference](https://expressjs.com/en/5x/api/request.html). Overwriting
  `req.query` throws in Express 5; overwriting `req.params` or `req.body`
  succeeds and quietly breaks whatever reads them next.

And the structural cost: **a property attached to `req` is an undeclared
dependency.** A handler that reads `req.order` cannot be understood, tested or
type-checked without knowing which middleware ran above it, and nothing in the
framework connects them. Keep the number of such properties small and their names
obvious. [Phase 2 · 06](../06-mutating-req-res.md) is the full argument;
[Phase 8 · 09](../../phase-8-validation-authz/09-type-inference.md) is what it
does to types.

## Trade-off

Small, single-purpose middleware units are testable, reusable and composable.
Too many hops hide the path a request takes: with twenty layers, the answer to
"what ran before this handler" is a manual read of the mount list, because
Express can tell you nothing.

**Prefer a short, named chain over many anonymous lambdas** — five named
functions you can grep beat fifteen inline arrows. And prefer **one middleware
that does one thing** over a `context` middleware that attaches six unrelated
properties, because the second is impossible to remove later.

## Gotchas

**Symptom:** A middleware works in one app and not another
**Cause:** It read `process.env` or a module-scope singleton at request time
instead of taking configuration as a factory argument
**Fix:** Factory form. Configuration closed over once, at boot

**Symptom:** `DEBUG=router` output and stack traces are a wall of `<anonymous>`
**Cause:** Arrow functions returned from factories. `Layer` stores
`fn.name || '<anonymous>'`
**Fix:** Return a **named** function expression from every factory

**Symptom:** A new route is publicly accessible and looks exactly like the others
**Cause:** `router.use(requireAuth)` is opt-out — a route added above it is
unprotected
**Fix:** Put auth on the route. It is then visible in the diff and greppable

**Symptom:** A path-prefix check with `req.path.startsWith('/api')` stops working
after a refactor
**Cause:** Inside a mounted router `req.path` has had the prefix stripped
**Fix:** Mount the middleware at the prefix and delete the check

**Symptom:** The suite passes and then hangs
**Cause:** A module-scope `createPool()` in a middleware file opened a real
connection at import time
**Fix:** Take dependencies as factory arguments —
[Phase 7 · 04](../../phase-7-layering/04-di-without-framework.md)

## Interview questions

**★ Why does `express.json()` have parentheses?**
Because it is a factory: it takes an options object and **returns** the
middleware. That is Express's own documented convention for configurable
middleware, and every built-in follows it. Mounting `express.json` without
calling it mounts the factory itself, which is not a valid middleware.

**★ What does the factory form buy over a plain exported function?**
Testability without an app, the ability to mount the same middleware twice with
different configuration, and configuration validated at boot rather than on the
first request that reaches that route.

**★ Why name the function a factory returns?**
Because `Layer` stores `fn.name || '<anonymous>'`, and that name is what debug
output and stack traces show. Twelve anonymous layers are unreadable; named ones
tell you where the request is.

**★ Should authentication be `router.use` or per route?**
Per route. `use` is opt-out, so a route added above the line is silently public
and indistinguishable from the rest of the file. Per-route auth is visible in the
diff and greppable. Infrastructure that genuinely applies to everything —
logging, body parsing, CORS — is the opposite case.

**What is the risk of attaching properties to `req`?**
It creates an undeclared dependency: a handler reading `req.order` cannot be
understood or tested without knowing which middleware ran above it, and nothing
in the framework links them. There is also no documented reserved-name list, so
collisions with framework or library properties are found at runtime.

**Do you need `try`/`catch` in async middleware on Express 5?**
Not to forward the error — the router attaches a rejection handler to the promise
your function returns. Catch only to add context or to convert an error into a
different one, and never catch just to rethrow.

---

← Prev: [The shape and the endings](01-the-shape-and-the-endings.md) · Index: [The middleware contract](README.md) · Next → [What middleware must not do](03-what-middleware-must-not-do.md)
