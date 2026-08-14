---
title: "Execution order"
sidebar_label: "02 · Execution order"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**First registered runs first. Application middleware runs before router
middleware for that mount. Route-level middleware runs only for that route.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> [Using middleware](https://expressjs.com/en/guide/using-middleware.html) names the
> same levels this page does — application-level (`app.use`/`app.METHOD`), router-level
> (`router.use`/`router.METHOD`), route-level, error-handling and built-in — and states
> that middleware executes *"in the order they are defined"*. The
> [router reference](https://expressjs.com/en/5x/api/router/) adds that *"the order of
> `router.use()` definitions is critical — they execute sequentially, defining
> middleware precedence"*, and that a router's own mount path *"is stripped and not
> visible to the middleware"*.

## Levels

```text
app.use(globalMw)           // every request that reaches the app stack
app.use('/api', apiRouter)  // only under /api
apiRouter.use(routerMw)     // only inside that router
apiRouter.get('/x', mw, h)  // only GET /api/x
```

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

Reverse the `app.use` lines in your head: if `api` were mounted before `app`
logger, the logger would not see those requests the same way — registration
order on `app` is absolute.

## Trade-off

Global middleware is easy and expensive (runs for health checks, static, …).
Scope loggers and auth to the routers that need them when hot paths matter.

## Gotchas

**Symptom:** Auth middleware runs on `/health` and breaks probes  
**Cause:** Global `app.use(auth)`  
**Fix:** Mount auth on `/api` only

**Symptom:** Body parser never sees the body  
**Cause:** Route registered before `express.json()`  
**Fix:** Parsers before routes that need `req.body` (page 05)

**Symptom:** Router middleware runs for sibling mounts  
**Cause:** Attached to `app` instead of the router  
**Fix:** `router.use` vs `app.use`

## Interview questions

**★ In what order do app, router, and route middleware run?**  
App stack in registration order, then the mounted router’s stack, then
route-specific middleware and handler.

**Why does registration order matter?**  
First match / first run — Express does not sort by specificity for middleware.

**How do you skip middleware for a path?**  
Mount it only on the sub-tree that needs it, or branch inside the function.

---

← Prev: [The middleware contract](01-middleware-contract.md) · Next → [next semantics](03-next-semantics.md)
