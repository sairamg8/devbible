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

## Knowing where you were mounted

**`mountpath` is a property of an *app*, not of a `Router`.** This trips people up
constantly, because the two are otherwise interchangeable. A `Router` never gets a
`mountpath` — mounted or not.

```js
// mountpath.mjs
import express from 'express';

const app = express();

const admin = express.Router();              // a Router
admin.get('/dashboard', (req, res) => {
  res.json({baseUrl: req.baseUrl, path: req.path, originalUrl: req.originalUrl});
});
app.use('/admin', admin);

const reports = express();                   // a sub-APP
reports.get('/daily', (req, res) => {
  res.json({mountpath: req.app.mountpath, baseUrl: req.baseUrl, path: req.path});
});
app.use('/reports', reports);

console.log('Router.mountpath  :', admin.mountpath);
console.log('sub-app.mountpath :', reports.mountpath);

const server = app.listen(0, '127.0.0.1', async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;
  console.log('router   ', await (await fetch(`${base}/admin/dashboard`)).json());
  console.log('sub-app  ', await (await fetch(`${base}/reports/daily`)).json());
  server.close();
});
```

```console
$ node mountpath.mjs
Router.mountpath  : undefined
sub-app.mountpath : /reports
router    { baseUrl: '/admin', path: '/dashboard', originalUrl: '/admin/dashboard' }
sub-app   { mountpath: '/reports', baseUrl: '/reports', path: '/daily' }
```

So there are two different answers depending on what you mounted:

| You have | Ask for | Value |
|---|---|---|
| A `Router` | `req.baseUrl` | `/admin` |
| A sub-app | `req.app.mountpath` **or** `subApp.mountpath` | `/reports` |
| Either, need the full path | `req.originalUrl` | `/admin/dashboard` |

**Use `req.baseUrl`.** It works for both, it is available during the request when you
actually need it, and it does not depend on whether a colleague reached for
`express.Router()` or `express()`. Reserve `mountpath` for the rare case of a sub-app
that must know its own prefix outside a request — generating absolute links at boot,
for example.

`req.path` is the part *after* the mount, and `req.originalUrl` is everything —
including the query string. Logging `req.path` from inside a mounted router is the
usual reason a log line is missing its prefix.

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

**Symptom:** `router.mountpath` is `undefined` even after `app.use('/x', router)`  
**Cause:** `mountpath` exists on **apps**, not on `Router` instances. Measured: it stays
`undefined` before *and* after mounting  
**Fix:** Use `req.baseUrl` inside the request, or mount a sub-app (`express()`) if you
genuinely need the property

**Symptom:** Log lines are missing the `/admin` prefix  
**Cause:** Logging `req.path`, which is the portion *after* the mount  
**Fix:** `req.originalUrl` for the full path, or `req.baseUrl + req.path`

**Symptom:** Host routing works locally but not behind proxy  
**Cause:** Wrong hostname / `trust proxy`  
**Fix:** Phase 9 — proxy configuration first

## Interview questions

**★ What is `app.route('/path')` for?**  
Chain HTTP verbs on a single path without repeating the path string.

**When is host-based routing appropriate?**  
Multi-tenant hostnames or separate sites in one app — uncommon for simple APIs;
often better at the reverse proxy.

**★ What is `router.mountpath`?**  
A trick question — it does not exist. `mountpath` is an **app** property. Measured on
Express 5.2.1, a `Router` reports `undefined` both before and after `app.use`, while a
mounted sub-app reports `/reports`. Inside a request, `req.baseUrl` gives you the mount
prefix for either.

**What is the difference between `req.path`, `req.baseUrl` and `req.originalUrl`?**  
Inside a router mounted at `/admin` handling `/dashboard`: `req.path` is `/dashboard`,
`req.baseUrl` is `/admin`, and `req.originalUrl` is `/admin/dashboard` plus any query
string. Logging `req.path` alone is why prefixes go missing from logs.

**Is `route()` required?**  
No — purely organizational sugar.

---

← Prev: [router.param](06-router-param.md) · Index: [Phase 1](README.md)
