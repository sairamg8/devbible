---
title: "app.route and hosts"
sidebar_label: "07 · app.route · hosts"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

**`app.route(path)` chains verbs on one path. Host-based routing exists but is
rarely your first tool — know it exists, prefer path mounts for APIs.**

## `app.route` / `router.route`

```js
// route-chain.mjs
import express from 'express';

const app = express();

app
  .route('/book')
  .get((req, res) => res.send('get book'))
  .post((req, res) => res.send('post book'))
  .put((req, res) => res.send('put book'));

const server = app.listen(0, async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;
  console.log('GET', await (await fetch(`${base}/book`)).text());
  console.log(
    'POST',
    await (await fetch(`${base}/book`, {method: 'POST'})).text(),
  );
  server.close();
});
```

```console
$ node route-chain.mjs
GET get book
POST post book
```

Same as separate `app.get` / `app.post` calls — fewer path string repetitions.
Use when several methods share one path and little middleware variance.

## `mountpath` awareness

```js
// mountpath.mjs
import express from 'express';

const admin = express.Router();
admin.get('/dashboard', (req, res) => {
  res.json({
    mountpath: admin.mountpath, // set after mount
    baseUrl: req.baseUrl,
  });
});

const app = express();
app.use('/admin', admin);

// After use(), router.mountpath reflects the mount
console.log('after mount, admin.mountpath =', admin.mountpath);

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log(await (await fetch(`http://127.0.0.1:${port}/admin/dashboard`)).json());
  server.close();
});
```

```console
$ node mountpath.mjs
after mount, admin.mountpath = /admin
{ mountpath: '/admin', baseUrl: '/admin' }
```

Useful when a shared router must know where it was mounted (generating links).

## Host-based routing

Express can branch on `req.hostname` via `vhost`-style middleware or custom
checks. For most JSON APIs, **path prefixes** (`/api/v1`) beat multi-host apps in
one process. Multi-host usually means reverse proxy (Nginx) routing to different
upstreams — that is infrastructure, not Express cleverness.

## Trade-off

`route()` chains reduce duplication; they also pack multiple handlers into one
expression that is harder to split across files. Prefer them for small resources;
use separate registrations when handlers grow.

## Gotchas

**Symptom:** `mountpath` empty when logged at router definition  
**Cause:** Read before `app.use`  
**Fix:** Read after mount, or use `req.baseUrl` inside a request

**Symptom:** Host routing works locally but not behind proxy  
**Cause:** Wrong hostname / `trust proxy`  
**Fix:** Phase 9 — proxy configuration first

## Interview questions

**★ What is `app.route('/path')` for?**  
Chain HTTP verbs on a single path without repeating the path string.

**When is host-based routing appropriate?**  
Multi-tenant hostnames or separate sites in one app — uncommon for simple APIs;
often better at the reverse proxy.

**What is `router.mountpath`?**  
The path pattern where the router was mounted on its parent.

**Is `route()` required?**  
No — purely organizational sugar.

---

← Prev: [router.param](06-router-param.md) · Index: [Phase 1](README.md)
