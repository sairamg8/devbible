---
title: "Sub-apps and the server"
sidebar_label: "05 · Sub-apps and the server"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

**A mounted app is not a mounted router. Express tells them apart by duck test,
and gives one of them settings, a `mountpath`, a `mount` event and its own
prototypes.**

> Verified: 2026-08-14. Read from **`express@5.2.1`** — `app.use` and
> `defaultConfiguration` in `lib/application.js` — at
> `sandbox/express-verify/node_modules/express/`. **Reading source is not a run:
> nothing was executed for this page and it carries no console block.**
> Cross-checked against [expressjs.com ·
> Application](https://expressjs.com/en/5x/api/application.html) (`app.mountpath`,
> the `mount` event) and the Node
> [`http.Server`](https://nodejs.org/api/http.html#class-httpserver) docs.

## The duck test

`app.use` branches on three properties, and nothing else:

```js
// express/lib/application.js — app.use()
fns.forEach(function (fn) {
  // non-express app
  if (!fn || !fn.handle || !fn.set) {
    return router.use(path, fn);
  }

  fn.mountpath = path;
  fn.parent = this;

  router.use(path, function mounted_app(req, res, next) {
    var orig = req.app;
    fn.handle(req, res, function (err) {
      Object.setPrototypeOf(req, orig.request)
      Object.setPrototypeOf(res, orig.response)
      next(err);
    });
  });

  fn.emit('mount', this);
}, this);
```

**`fn.handle && fn.set` means "this is an Express app".** A `Router` has
`handle` but no `set`, so it takes the first branch and is mounted as ordinary
middleware. Everything that follows about sub-apps flows from that one test.

Four things happen to a sub-app that never happen to a router:

1. **`mountpath` is assigned** — which is why `mountpath` exists on an app and is
   `undefined` on a `Router`. Inside a request, the equivalent for either is
   `req.baseUrl`.
2. **`parent` is assigned**, giving the sub-app a reference back.
3. **It is wrapped in `mounted_app`**, which calls the sub-app's own `handle` and
   then **restores `req`/`res` prototypes to the parent app's** before continuing.
   A sub-app that matches nothing therefore falls through to the parent cleanly,
   with the parent's helpers back in place.
4. **A `mount` event fires**, synchronously, at mount time. The listener that
   `defaultConfiguration` already registered uses it to inherit the parent's
   `request`, `response`, `engines` and `settings` prototypes — and to drop its
   own `trust proxy` if it was still the default.

## Sub-app versus Router

| | `express.Router()` | `express()` mounted as a sub-app |
|---|---|---|
| `app.set` / `app.get(name)` settings | ✗ none | ✓ its own, **inheriting the parent's by prototype** |
| `mountpath` | ✗ `undefined` | ✓ the mount path |
| `parent` | ✗ | ✓ |
| `mount` event | ✗ | ✓ fires at mount time |
| `app.locals` | ✗ | ✓ its own |
| View engine, `res.render` | ✗ | ✓ its own `views`, `view engine`, `app.engine` |
| Inherits parent's `req`/`res` helpers | via the shared app | ✓ by prototype chain, wired on `mount` |
| Unmatched request | continues the parent's stack | continues the parent's stack, **prototypes restored first** |
| Cost | one layer | one layer, one wrapper closure, its own settings object |

**Choose a `Router` by default.** It is the lighter object, it is what
`app.use('/api', …)` is for, and settings that differ per mount are rare.

**Choose a sub-app when the mounted thing genuinely needs its own application
settings** — most commonly its own view engine and `views` directory (a
server-rendered admin panel bolted onto a JSON API), or its own `trust proxy`
because it sits behind a different ingress. If you cannot name the setting that
must differ, you want a router.

## `mountpath` versus `req.baseUrl`

These answer different questions and are constantly confused:

| | `app.mountpath` | `req.baseUrl` |
|---|---|---|
| Exists on | a mounted **app** only | every request, in any router or app |
| Known at | mount time (startup) | request time |
| Value with a multi-path mount | the array you passed to `use` | the concrete prefix **this** request matched |
| Nested mounts | only this app's own mount path | the full accumulated prefix |

The rule: **`mountpath` is configuration, `req.baseUrl` is what happened.** In a
handler you almost always want `req.baseUrl` — and in a log line you want
`req.originalUrl` ([chunk 04](04-url-rewriting-and-options.md)).

A `Router` has no `mountpath` at all. Code that reads `router.mountpath` gets
`undefined` both before and after mounting; this corpus shipped that error once
and it is recorded in [Phase 1 ·
07](../../phase-1-routing/07-app-route-and-hosts.md).

## Back to the server: what only it can do

Everything in this topic so far lives inside one request listener. The server is
what wraps it, and it owns the things that have nothing to do with routing:

| Need | The call | Notes |
|---|---|---|
| Stop accepting connections | `server.close([cb])` | The callback fires only when **all** connections have ended |
| Release idle keep-alives | `server.closeIdleConnections()` | Node ≥ 18.2. Without it, `close`'s callback can stall indefinitely |
| Cap header/request time | `server.headersTimeout`, `server.requestTimeout` | Socket-level; a slow-client defence Express cannot provide |
| Keep-alive window | `server.keepAliveTimeout` | Must exceed a load balancer's idle timeout or you get sporadic 502s |
| WebSockets | `server.on('upgrade', …)` | An upgrade never becomes a request and never reaches the router |
| TLS | `https.createServer({key, cert}, app)` | The app is unchanged — it is only a listener |

**The whole of graceful shutdown lives on this object**, which is why
discarding `app.listen`'s return value is such a common and expensive habit.
[Phase 10 · 06](../../phase-10-app-factory/06-shutdown-and-entrypoint.md) has the
ordering that actually works, including the drain delay without which you still
serve 502s.

## Trade-off

**Mounting keeps files small and gives every feature a home.** The costs are
real but bounded:

- **Mount-path bookkeeping.** Every nesting level adds a rewrite of `req.url` and
  another accumulation onto `req.baseUrl`. Two levels are easy to hold in your
  head; four are not, and the symptom is logs that no longer say which endpoint
  ran.
- **Parameters do not cross mounts by default.** Each nesting level that needs a
  parent's `:id` needs `mergeParams: true`, and forgetting it fails as an
  `undefined`, not as an error.
- **Order becomes distributed.** The set of middleware that runs for a route is
  the concatenation of every parent's stack above the mount. When that is spread
  across six files, no one can read it — which is the argument for assembling the
  whole thing in one visible factory.

**Prefer shallow, feature-sized routers**: one router per resource, mounted once,
under a single versioned prefix. Reach for a sub-app only for the settings.

## Gotchas

**Symptom:** `router.mountpath` is `undefined` after mounting
**Cause:** `mountpath` is assigned by `app.use` only to things that pass the
`handle && set` duck test — a `Router` has no `set`
**Fix:** Use `req.baseUrl` inside a request; there is no startup-time equivalent
for a router

**Symptom:** A sub-app's `app.set('view engine', …)` mysteriously affects the
parent, or vice versa
**Cause:** The `mount` listener sets the sub-app's `settings` **prototype** to the
parent's. Reads fall through to the parent; writes stay local — so it looks
one-directional until someone reads a setting they never set
**Fix:** Expect inheritance. Set explicitly on the sub-app anything it must own

**Symptom:** A custom `req` helper works in the parent, is missing inside a
mounted sub-app, and then works again afterwards
**Cause:** The sub-app re-parents `req`'s prototype to its own, and `mounted_app`
restores the parent's on the way out. A helper attached to `app.request` of the
parent is not on the sub-app's chain unless the `mount` inheritance covered it
**Fix:** Attach shared helpers with middleware mounted above both

**Symptom:** `server.close()` never calls back and the process hangs on SIGTERM
**Cause:** Keep-alive connections are idle but open, and `close` waits for **all**
connections
**Fix:** `server.closeIdleConnections()`, plus a hard `setTimeout(...).unref()`
deadline — [Phase 10 · 06](../../phase-10-app-factory/06-shutdown-and-entrypoint.md)

## Interview questions

**★ How does Express tell a mounted app from a mounted router?**
A duck test in `app.use`: if the value has both `handle` and `set` it is treated
as an app, otherwise it is pushed as ordinary middleware. That single check is
the origin of every behavioural difference between the two.

**★ What does a sub-app get that a `Router` does not?**
Its own settings (inheriting the parent's by prototype), `mountpath`, `parent`, a
`mount` event, its own `locals` and its own view engine — plus a wrapper that
restores the parent's `req`/`res` prototypes if the sub-app does not respond.

**★ `mountpath` or `req.baseUrl`?**
`mountpath` is configuration, known at startup, and exists only on a mounted app;
with a multi-path mount it is the whole array. `req.baseUrl` is what actually
matched for this request, accumulated across nesting. In a handler, you want
`req.baseUrl`.

**★ Why does discarding `app.listen`'s return value matter?**
Because that return value is the `http.Server`, and it owns `close`,
`closeIdleConnections`, every socket timeout, and the `'upgrade'` event. Without
it there is no graceful shutdown, only `process.exit`.

**When would you actually mount a sub-app instead of a router?**
When the mounted thing needs application settings of its own — most often a
distinct view engine and `views` directory, or a different `trust proxy` because
it sits behind a different ingress. If you cannot name the setting, use a router.

**What happens to a request a sub-app does not handle?**
`mounted_app` restores `req` and `res` to the parent app's prototypes and calls
the parent's `next(err)`, so the request continues down the parent's stack as if
the sub-app had been ordinary middleware.

---

← Prev: [URL rewriting and OPTIONS](04-url-rewriting-and-options.md) · Index: [Object graph](README.md) · Next topic → [The request lifecycle](../03-request-lifecycle.md)
