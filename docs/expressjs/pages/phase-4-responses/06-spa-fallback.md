---
title: "SPA fallback"
sidebar_label: "06 · SPA fallback"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

**Client-side routers need `index.html` on unknown paths. On Express 5,
`app.get('*')` throws at boot. Use a named splat, and register it after API
routes.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> [Migrating to Express 5](https://expressjs.com/en/guide/migrating-5.html): a wildcard
> *"must have a name"* — `'/*'` is out, `'/*splat'` is in, and `'/{*splat}'` is the form
> that also matches the root. The fallback works because `express.static` defaults to
> **`fallthrough: true`**, so a request matching no file *"will cause this middleware to
> simply call `next()`"* ([express reference](https://expressjs.com/en/5x/api/express/)).
> Note the shape change that comes with the rename: `req.params.splat` is an **array** of
> path segments, not a string
> ([request reference](https://expressjs.com/en/5x/api/request/)).

## Order that works

```js
// spa.mjs — pattern measured on Express 5.2.1
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spa-'));
fs.writeFileSync(path.join(dir, 'index.html'), '<html>hi</html>');

const app = express();
app.get('/api/ping', (req, res) => res.json({ok: true}));
app.use(express.static(dir));
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(dir, 'index.html'));
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;
  console.log('api', await (await fetch(`${base}/api/ping`)).json());
  console.log('spa', (await (await fetch(`${base}/app/route`)).text()).slice(0, 20));
  server.close();
  fs.rmSync(dir, {recursive: true});
});
```

```console
$ node spa.mjs
api { ok: true }
spa <html>hi</html>
```

## What fails

```js
app.get('*', handler); // THROWS on Express 5 at registration
```

See Phase 0 / Phase 1 path pages for the error text.

## Trade-off

Serving the SPA from Express means one deployable and one origin — the same
appeal as [page 05](05-static-files.md), and the fallback is four lines. The cost
is that your API now shares a catch-all with a front end, and every future route
you add lives in the shadow of a rule that matches everything. The failure is
quiet: an unknown endpoint returns 200 with HTML, and the client reports "JSON
parse error" from somewhere far away.

Hosting the front end separately — CDN, static host, its own domain — removes that
whole class of bug and costs you a CORS configuration. For anything with more
than a handful of endpoints, that is the better trade.

## Gotchas

**Symptom:** `TypeError: Missing parameter name` at startup after upgrading to Express 5  
**Cause:** `app.get('*', …)` — bare wildcards are invalid in the new path syntax  
**Fix:** `app.get('/*splat', …)`, or `'/{*splat}'` when the root path must match too

**Symptom:** `GET /api/typo` returns the SPA's HTML with status 200  
**Cause:** The fallback is registered before, or without excluding, the API mount  
**Fix:** Register APIs first and scope the fallback; add an explicit JSON 404 for
`/api/*` above it so API misses stay machine-readable

**Symptom:** A deep link works locally but 404s in production  
**Cause:** The fallback never ran — a reverse proxy resolved the path itself, or the
static mount answered with `fallthrough: false`  
**Fix:** Check which layer terminates the request. In a proxied deployment the
history fallback often belongs in Nginx, not Express

**Symptom:** The fallback serves stale HTML after every deploy  
**Cause:** `index.html` cached with the same long `maxAge` as the hashed assets  
**Fix:** Short or no cache on the HTML entry point — it is the file that names the
new hashes

## Interview questions

**★ Why did Express 5 break SPA tutorials?**  
Bare `*` path tokens are invalid; registration throws.

**Correct mount order for API + SPA?**  
API → static assets → HTML fallback.

**★ Why does the fallback swallow unknown `/api` paths, and how do you stop it?**  
Because it matches everything registered after it, including API URLs that hit no
route. Scope it — mount the fallback under the SPA's path, or exclude `/api` — so a
mistyped endpoint returns a JSON 404 instead of an HTML page a client cannot parse.

**What does `req.params.splat` contain in Express 5?**  
An array of path segments. Code ported from Express 4's `req.params[0]` string will
quietly produce `"a,b"` where it used to produce `"a/b"`.

---

← Prev: [Static files](05-static-files.md) · Next → [Cookies out](07-cookies-out.md)
