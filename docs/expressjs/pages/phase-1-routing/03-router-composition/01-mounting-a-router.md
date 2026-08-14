---
title: "Mounting a router"
sidebar_label: "01 · Mounting a router"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**`express.Router()` is a portable stack. Mount it at a prefix, and every path
inside it becomes relative to that prefix — because the router rewrites the URL
before the router runs.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. **The console block
> below is re-used unchanged from the earlier authorised `sandbox/express-verify`
> run and is sandbox-measured** — nothing was executed for this rewrite. The
> [routing guide](https://expressjs.com/en/guide/routing.html) calls a `Router`
> *"a complete middleware and routing system … often referred to as a 'mini-app'"*;
> the [request reference](https://expressjs.com/en/5x/api/request.html) defines
> `req.baseUrl` as *"the URL path on which a router instance was mounted"* and gives
> the worked example `originalUrl '/admin/new?sort=desc'` · `baseUrl '/admin'` ·
> `path '/new'`. The rewrite mechanism is `trimPrefix` in `router@2.2.0`'s
> `index.js`, in `sandbox/express-verify/node_modules/`.

## Mount a feature router

```js
// routers.mjs
import express from 'express';

const users = express.Router();
users.get('/', (req, res) => {
  res.json({baseUrl: req.baseUrl, path: req.path, url: req.url});
});
users.get('/:id', (req, res) => {
  res.json({id: req.params.id, baseUrl: req.baseUrl});
});

const app = express();
app.use('/api/users', users);

const server = app.listen(0, async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;
  console.log(await (await fetch(`${base}/api/users`)).json());
  console.log(await (await fetch(`${base}/api/users/7`)).json());
  server.close();
});
```

```console
$ node routers.mjs
{ baseUrl: '/api/users', path: '/', url: '/' }
{ id: '7', baseUrl: '/api/users' }
```

| Field | Meaning when mounted at `/api/users` | Set by |
|---|---|---|
| `req.originalUrl` | `/api/users/7` — full path + query, as sent | the outermost `handle`, once |
| `req.baseUrl` | `/api/users` — the mount path, accumulated | `trimPrefix`, per nesting level |
| `req.url` | `/7` — the remainder the router matches against | `trimPrefix`, rewritten |
| `req.path` | `/7` — a getter over the rewritten `req.url` | derived |

**The router only ever sees paths relative to its mount**, which is the whole
point: the same file can be mounted at `/api/users`, `/v2/users` or `/users`
without editing a route. The mechanism — a slice of `req.url`, a leading slash
re-added, the prefix appended to `baseUrl` with any trailing slash stripped — is
[Phase 0 · 02 · chunk
04](../../phase-0-express-basics/02-app-router-server/04-url-rewriting-and-options.md).

## What a router is and is not

A `Router` is a **callable function** with a `stack` of `Layer`s and no settings
at all ([Phase 0 · 02 · chunk
02](../../phase-0-express-basics/02-app-router-server/02-a-router-is-a-function-too.md)).
Practically:

| A router **has** | A router **does not have** |
|---|---|
| `use`, all 35 verb helpers, `route`, `param` | `set` / `get(name)` — no settings |
| its own `stack`, walked in registration order | `mountpath` — that is an app property |
| its own error middleware | `locals`, a view engine, a `mount` event |
| `mergeParams`, `caseSensitive`, `strict` at construction | any awareness of where it is mounted |

That last row is the useful property and the source of the confusion. A router
genuinely does not know its own prefix — `req.baseUrl` is the answer, and it is
per request, not per router. Code that wants to build an absolute URL to a
sibling resource must read `req.baseUrl`, not a constant.

The three constructor options are read **once**, at construction, and cannot be
changed afterwards:

```js
express.Router({
  mergeParams: true,     // see chunk 02
  caseSensitive: true,   // /Users vs /users, for this router's routes
  strict: true           // /users/ vs /users, for this router's routes
});
```

🔴 **A `Router` does not inherit `case sensitive routing` or `strict routing`
from the app.** The app passes its settings to *its own base router* when that is
first created; a router you construct yourself gets whatever you pass, and
`undefined` otherwise. So an app with `strict routing` enabled and a mounted
router that did not ask for it behaves differently on either side of the mount —
silently.

## Composition shapes that work

**One router per resource, mounted once.**

```js
// routes/orders.js
const router = express.Router();
router.get('/', list);
router.post('/', create);
router.get('/:id', get);
export default router;

// app.js
app.use('/api/orders', orders);
```

**A parent router that owns the version prefix**, so the version appears once:

```js
const v1 = express.Router();
v1.use('/orders', orders);
v1.use('/users', users);
app.use('/api/v1', v1);
```

Note that middleware on `v1` runs for **both** children, and nothing on `app`
below the `app.use('/api/v1', v1)` line runs before them. Mount order is the
whole story — [Phase 2 · 02](../../phase-2-middleware/02-execution-order.md).

**The same router at two prefixes**, which works because a router holds no
per-request state:

```js
app.use('/api/v1/orders', orders);
app.use('/api/v2/orders', orders);     // legal; both mounts push a layer
```

Useful for a deprecation window. Each request rewrites `req.url` for whichever
mount matched, so a handler that reads `req.baseUrl` can tell which version it
was reached through.

## Error middleware belongs to the router it is on

A four-argument handler mounted on a router runs for errors raised **inside that
router**, and only for layers registered above it there:

```js
const orders = express.Router();
orders.get('/:id', getOrder);
orders.use((err, req, res, next) => {           // orders-specific errors
  if (err.code === 'ORDER_NOT_FOUND') return res.status(404).json({…});
  next(err);                                     // everything else goes up
});
```

The pattern that works: **handle what this module knows about, `next(err)`
everything else.** The app-level handler stays the single place that decides the
generic shape, and the router-level one adds domain knowledge without owning the
contract. [Phase 5 · 03](../../phase-5-errors/03-error-contract.md).

## Gotchas

**Symptom:** Double prefix — requests only work at `/api/api/users`
**Cause:** The router defines `/api/users` **and** is mounted at `/api`
**Fix:** Paths inside a router are relative to the mount. Define `/` and `/:id`,
and let the mount own the prefix

**Symptom:** Middleware on one router does not run for another
**Cause:** Both are mounted on `app` side by side, not one under the other
**Fix:** `parent.use('/child', childRouter)`, or mount the shared middleware above
both on the common prefix

**Symptom:** `strict routing` works on app routes and not on a mounted router's
**Cause:** A `Router` takes `strict` and `caseSensitive` from its **own**
constructor, not from the app. The app only passes them to its base router
**Fix:** Pass them explicitly to every router you construct, from one shared
options object

**Symptom:** A helper builds `/api/users/${id}` as a constant and breaks when the
mount moves
**Cause:** The router does not know its prefix; the constant duplicated it
**Fix:** Build from `req.baseUrl`, which is the accumulated prefix for this
request

**Symptom:** A router's error handler catches errors from an unrelated route
**Cause:** It is mounted on the app, not on the router, or it is above other
mounts on the same parent
**Fix:** Attach it to the router it belongs to, as the last thing registered there

## Interview questions

**★ What is `express.Router()`, and what does it not have?**
A callable mini-app: a `stack` of layers with the same `use`/verb surface as an
app. It has **no settings**, no `mountpath`, no `locals` and no view engine, and
it has no awareness of where it is mounted — `req.baseUrl` is the per-request
answer to that.

**★ What is `req.baseUrl`, and how does it differ from `req.originalUrl`?**
`baseUrl` is the mount prefix this request matched, accumulated across nesting
levels by `trimPrefix`. `originalUrl` is the URL as the client sent it, fixed once
at entry and never rewritten. Inside a mounted router `req.url` and `req.path`
have had the prefix stripped, which is why logs should use `originalUrl`.

**★ Can the same router be mounted twice?**
Yes — a router holds no per-request state, so both mounts simply push a layer.
It is a clean way to serve two version prefixes from one implementation during a
deprecation window.

**★ Does a mounted router inherit the app's `strict routing`?**
No. The app passes those settings only to its own base router, at the moment that
router is first constructed. A router you create takes them from its own
constructor options, so an app-wide setting silently does not apply across a
mount.

**How do you version an API with routers?**
Mount a per-version parent router that owns the prefix and mounts the resource
routers under it. The version string then appears once, and version-specific
middleware has an obvious home. Strategy trade-offs are
[Phase 6 · 05](../../phase-6-rest-surface/05-versioning.md).

**Can a router have its own error-handling middleware?**
Yes. A four-argument handler on a router catches errors raised by layers above it
*in that router*. The useful pattern is to handle what the module knows about and
`next(err)` the rest, leaving one app-level handler to own the response shape.

---

Index: [Router composition](README.md) · Next → [mergeParams and isolation](02-mergeparams-and-isolation.md)
