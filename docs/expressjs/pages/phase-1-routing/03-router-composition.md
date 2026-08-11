---
title: "Router composition"
sidebar_label: "03 · Router composition"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**`express.Router()` is a portable stack. Mount it on `app` (or another router)
at a prefix. That is how feature modules stay small.**

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

| Field | Meaning when mounted at `/api/users` |
|---|---|
| `req.baseUrl` | `/api/users` — the mount path |
| `req.path` | Path **inside** the router (`/` or `/7`) |
| `req.url` | Remainder used for routing inside the router |
| `req.originalUrl` | Full path + query as the client sent it |

## Nested routers and `mergeParams`

Parent params are **not** visible on child routers unless you ask:

```js
// nested.mjs
import express from 'express';

const comments = express.Router({mergeParams: true});
comments.get('/:commentId', (req, res) => {
  res.json(req.params);
});

const app = express();
app.use('/posts/:postId/comments', comments);

const server = app.listen(0, async () => {
  const {port} = server.address();
  const res = await fetch(
    `http://127.0.0.1:${port}/posts/1/comments/2`,
  );
  console.log(await res.json());
  server.close();
});
```

```console
$ node nested.mjs
{ postId: '1', commentId: '2' }
```

Without `{mergeParams: true}`, `postId` is missing inside `comments`.

## Trade-off

Deep nesting mirrors URLs but multiplies mount-path bugs. Prefer
**feature routers** (`/api/orders`) over five levels of nesting unless the
resource hierarchy is the product.

## Gotchas

**Symptom:** `req.params.postId` undefined in child router  
**Cause:** Default `mergeParams: false`  
**Fix:** `express.Router({mergeParams: true})` on the child

**Symptom:** Double prefix (`/api/api/users`)  
**Cause:** Router defines `/api/users` **and** is mounted at `/api`  
**Fix:** Paths inside a router are relative to the mount

**Symptom:** Middleware on parent does not run for child  
**Cause:** Child mounted on `app` beside parent, not under it  
**Fix:** `parent.use('/child', childRouter)` or mount both under same prefix chain

## Interview questions

**★ What is `express.Router()` for?**  
A mini-app stack you can mount at a path — modular routes and middleware.

**★ What is `req.baseUrl`?**  
The mount path where this router was attached.

**Why `mergeParams`?**  
So nested routers can read parent path parameters.

**How do you version an API with routers?**  
Mount `v1` and `v2` routers at `/api/v1` and `/api/v2` (Phase 6 expands strategy).

**Can a router have its own error-handling middleware?**  
Yes — four-arg handlers on that router run for errors inside it, subject to
mount order (Phase 5).

---

← Prev: [Params and query](02-params-and-query.md) · Next → [Route ordering](04-route-ordering.md)
