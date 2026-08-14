---
title: "The app is a function"
sidebar_label: "02 · The app is a function"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**An Express app *is* a Node request listener. Everything else Express does to a
request, it does by re-parenting prototypes — it never wraps `req` or `res`.**

> Verified: 2026-08-14. Every claim on this page is read from the installed
> **`express@5.2.1`** source at
> `sandbox/express-verify/node_modules/express/lib/`, cited by file and function.
> Reading source is not a run: nothing here was executed for this page. **The one
> console block below is re-used unchanged from the earlier authorised
> `sandbox/express-verify` run** (extract → execute against claimed output) and is
> **sandbox-measured**; it is not reproduced or edited. Public API behaviour
> cross-checked against
> [expressjs.com · Application](https://expressjs.com/en/5x/api/application.html).

## `express()` returns a function, not an object

This is the fact the whole framework hangs off, and it is nine lines of source:

```js
// express/lib/express.js — createApplication()
function createApplication() {
  var app = function(req, res, next) {
    app.handle(req, res, next);
  };

  mixin(app, EventEmitter.prototype, false);
  mixin(app, proto, false);
  // …
  app.init();
  return app;
}
```

Read it literally. `app` is a **closure of three arguments that forwards to
`app.handle`** — exactly the shape `http.createServer` wants. Everything you
think of as "the app object" is then copied onto that function:

- `mixin(app, EventEmitter.prototype, false)` — the app **is an EventEmitter**.
  That is why `app.on('mount', …)` works, and why a sub-app can be notified when
  it is mounted.
- `mixin(app, proto, false)` — `proto` is `express/lib/application.js`, the ~40
  methods you actually call: `use`, `set`, `get`, `listen`, `handle`, `render`,
  `param`, and one method per HTTP verb.

`mixin` is the `merge-descriptors` package, and the `false` third argument means
*do not redefine what is already there* — so the function's own intrinsic
properties survive the merge.

```js
// what-express-is.mjs
import express from 'express';

const app = express();

console.log('express export is a function:', typeof express === 'function');
console.log('app is a function (request listener):', typeof app === 'function');
console.log('app.handle exists:', typeof app.handle === 'function');
```

```console
$ node what-express-is.mjs
express export is a function: true
app is a function (request listener): true
app.handle exists: true
```

## Which is why `app.listen` is eight lines

`app.listen` is not a server. It builds one and gets out of the way:

```js
// express/lib/application.js — app.listen()
app.listen = function listen() {
  var server = http.createServer(this)
  var args = slice.call(arguments)
  if (typeof args[args.length - 1] === 'function') {
    var done = args[args.length - 1] = once(args[args.length - 1])
    server.once('error', done)
  }
  return server.listen.apply(server, args)
}
```

Three things worth taking from that:

- **`http.createServer(this)`** — `this` is the app, passed as the request
  listener. Confirms the claim above rather than restating it.
- **It returns the `http.Server`**, not the app. Everything server-shaped —
  `close()`, `keepAliveTimeout`, `headersTimeout`, the `'upgrade'` event —
  belongs to that return value. **`app.close` does not exist**, which is the
  single most common graceful-shutdown bug and is
  [Phase 10 · 06](../../phase-10-app-factory/06-shutdown-and-entrypoint.md).
- **A callback passed to `listen` is also wired to `'error'`**, wrapped in `once`
  so it fires at most once. So `app.listen(3000, err => …)` does report
  `EADDRINUSE` — a detail the documentation does not spell out.

The corollary is the one the whole of Phase 10 rests on: **an app that never
calls `listen` is still fully usable.** Supertest, serverless adapters and your
own tests all take the app and hand it to a server they control. That is why the
app factory must build and return an app without binding a port.

## What `app.handle` does to your request

Per request, before any of your code runs:

```js
// express/lib/application.js — app.handle()
app.handle = function handle(req, res, callback) {
  var done = callback || finalhandler(req, res, {
    env: this.get('env'),
    onerror: logerror.bind(this)
  });

  if (this.enabled('x-powered-by')) {
    res.setHeader('X-Powered-By', 'Express');
  }

  req.res = res;
  res.req = req;

  Object.setPrototypeOf(req, this.request)
  Object.setPrototypeOf(res, this.response)

  if (!res.locals) {
    res.locals = Object.create(null);
  }

  this.router.handle(req, res, done);
};
```

Five steps, and the third is the one to understand.

**1 · The final handler is decided first.** `finalhandler` is a separate package,
and it is what produces the 404 when nothing responded and the 500 when an error
reached the end of the stack. This is why [404 is not an
error](../../phase-5-errors/06-not-found-and-process.md) in Express: falling off
the end of the router and calling `next(err)` land in the *same* function, which
then chooses between them.

**2 · `X-Powered-By` is set before routing**, from the `x-powered-by` setting.
Disabling it (`app.disable('x-powered-by')`) removes the header for every route
at once, because there is only this one place that sets it.

**3 · `req` and `res` are re-parented, not wrapped.**
`Object.setPrototypeOf(req, this.request)` replaces the prototype of the live
`http.IncomingMessage` object with Express's request prototype — which was itself
created in `createApplication` as `Object.create(req)` over
`express/lib/request.js`, with an `app` property attached.

The resulting chain, for the request object, is:

```
your req instance
  └─ app.request           (express/lib/request.js + { app })
       └─ http.IncomingMessage.prototype
            └─ stream.Readable.prototype …
```

Consequences you can now predict rather than memorise:

- **There is no Express request object.** `req instanceof http.IncomingMessage`
  is still true; `req.pipe`, `req.socket`, `req.headers` and `req.destroy` are
  the Node ones, untouched. Express added a layer *underneath* its own additions,
  not a shell around Node's.
- **Every Express `req`/`res` helper is a prototype property**, so it costs
  nothing per request — one `setPrototypeOf` call, not forty assignments.
- **Adding your own helpers by assigning to `req` in middleware works**, and is
  documented practice, but it is an *own* property on that one request. It is
  invisible to `Object.keys(app.request)` and to anyone reading the framework.
  That is the whole argument of
  [Phase 2 · 06](../../phase-2-middleware/06-mutating-req-res.md).
- **A sub-app inherits the parent's prototypes.** `defaultConfiguration`
  registers a `mount` listener that runs `Object.setPrototypeOf(this.request,
  parent.request)` for `request`, `response`, `engines` and `settings` — so
  helpers and settings added to the parent are visible in the sub-app, by
  prototype chain rather than by copying.

**4 · `res.locals` is created** as `Object.create(null)` — a null-prototype
object, so no inherited keys can be confused for your data.

**5 · The router is invoked**, with `done` as the callback for "nobody handled
this." What that router *is* — and the fact that it is not part of Express — is
[the next chunk](03-what-express-delegates.md).

## Gotchas

**Symptom:** `app.close is not a function`
**Cause:** `app.listen()` returns the `http.Server`; the app is only a listener
**Fix:** `const server = app.listen(...)`, then `server.close()` — and see
[Phase 10 · 06](../../phase-10-app-factory/06-shutdown-and-entrypoint.md), because
`close` alone still leaves keep-alive sockets holding the callback

**Symptom:** A helper you attached to `req` in one app is missing in a sub-app
**Cause:** Prototype inheritance for a sub-app is wired by the `mount` event, so
it only reaches apps mounted with `app.use(path, subApp)` — a `Router` is not an
app and has no prototypes of its own
**Fix:** Attach shared helpers with middleware mounted above both, not by
patching `app.request`

**Symptom:** Monkey-patching `express.request` in one module changes behaviour
across an unrelated app in the same process
**Cause:** `express/lib/request.js` is a module-level singleton; every app's
`app.request` is `Object.create` of it, so the whole process shares the mutation
**Fix:** Do not patch the prototype. Use middleware, which is scoped to the app or
router you mount it on

**Symptom:** `X-Powered-By: Express` still appears on one route after you removed
the header in middleware
**Cause:** It is set in `app.handle`, before routing — removing it in one
handler's stack does nothing for the others
**Fix:** `app.disable('x-powered-by')` once, in the factory, or let Helmet do it —
[Phase 9 · 03](../../phase-9-hardening/03-helmet.md)

## Interview questions

**★ Why can you pass an Express app straight to `http.createServer`?**
Because `express()` literally returns a function of `(req, res, next)` that
forwards to `app.handle`. The app *is* the request listener; `app.listen` is a
documented convenience that calls `http.createServer(this).listen(...)`.

**★ Does Express wrap `req` and `res`?**
No. `app.handle` calls `Object.setPrototypeOf(req, app.request)` on the live
`http.IncomingMessage`, inserting Express's helpers into the existing prototype
chain. `req instanceof http.IncomingMessage` stays true and every Node method
still works — Express added a layer under its own additions, not a shell.

**★ Where does the 404 come from, given no route matched?**
From `finalhandler`, a separate package that `app.handle` installs as the
router's "nobody handled this" callback. The same function also formats errors,
which is why a 404 never reaches error middleware — it never travelled as an
error.

**★ Why can Supertest test an Express app without starting a server on a fixed
port?**
Because the app is a request listener, so Supertest can hand it to an
`http.Server` it creates and binds to an ephemeral port itself. Nothing about the
app assumes it owns a port — which is also why the app factory must not call
`listen`.

**Why is `res.locals` created with `Object.create(null)`?**
So it has no prototype, and no inherited key (`constructor`, `toString`,
`__proto__`) can be mistaken for data you put there. The same reasoning applies to
`req.params` for string paths.

**How does a sub-app get the parent's settings?**
Through the `mount` event. `defaultConfiguration` registers a listener that
`setPrototypeOf`s the sub-app's `request`, `response`, `engines` and `settings`
onto the parent's — inheritance by prototype chain, not by copying, so later
changes on the parent are visible too. A `Router` gets none of this; it is not an
app.

---

← Prev: [The mapping problem](01-the-mapping-problem.md) · Index: [What Express is](README.md) · Next → [What Express delegates](03-what-express-delegates.md)
