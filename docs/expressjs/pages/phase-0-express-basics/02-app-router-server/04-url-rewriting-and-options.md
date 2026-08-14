---
title: "URL rewriting and OPTIONS"
sidebar_label: "04 · URL rewriting and OPTIONS"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

**Mounting works because the router rewrites `req.url` before calling a mounted
handler — and puts it back afterwards. The same walk is what lets Express answer
`OPTIONS` with an `Allow` header it builds itself.**

> Verified: 2026-08-14. Read from **`router@2.2.0`** at
> `sandbox/express-verify/node_modules/router/index.js` — `trimPrefix`,
> `getProtohost`, `generateOptionsResponder`, `sendOptionsResponse` — cited by
> function name. **Reading source is not a run: nothing was executed for this page
> and it carries no console block.** The four URL properties are cross-checked
> against [expressjs.com · Request](https://expressjs.com/en/5x/api/request.html)
> (`req.baseUrl`, `req.originalUrl`, `req.path`), whose own worked example gives
> `originalUrl '/admin/new?sort=desc'` · `baseUrl '/admin'` · `path '/new'`.

## `trimPrefix`: the URL rewrite that makes mounting work

When a matched layer is middleware — a router, a sub-app, or your own function
mounted at a path — the router rewrites the URL before calling it:

```js
// router/index.js — trimPrefix()
if (layerPath !== path.substring(0, layerPath.length)) { next(layerError); return }

const c = path[layerPath.length]
if (c && c !== '/') { next(layerError); return }      // must break on a separator

removed = layerPath
req.url = protohost + req.url.slice(protohost.length + removed.length)

if (!protohost && req.url[0] !== '/') { req.url = '/' + req.url; slashAdded = true }

req.baseUrl = parentUrl + (removed[removed.length - 1] === '/'
  ? removed.substring(0, removed.length - 1)
  : removed)
```

Read for behaviour rather than for syntax:

- **The prefix must break on a `/`.** `app.use('/admin', r)` matches `/admin` and
  `/admin/users`, and does **not** match `/administrator`. The `c !== '/'` guard
  is that rule, in one line.
- **`req.url` loses the prefix** for the duration of the mounted handler, with a
  leading `/` re-added if the slice removed it. This is what lets a router define
  `/` and be mounted at `/api/v1/users` without knowing it.
- **`req.baseUrl` accumulates** across nested mounts, with any trailing slash
  stripped — so nesting `/api` → `/users` gives `/api/users`, not `/api//users`.
- **`req.originalUrl` is untouched**, because it was set once at entry.

Which settles the three-property confusion, for a request to
`/admin/new?sort=desc` handled by a router mounted at `/admin`:

| Property | Value | Set by |
|---|---|---|
| `req.originalUrl` | `/admin/new?sort=desc` | the outermost `handle`, once |
| `req.baseUrl` | `/admin` | `trimPrefix`, accumulating |
| `req.url` | `/new?sort=desc` | `trimPrefix`, rewritten |
| `req.path` | `/new` | a getter over `req.url` |

**Log `req.originalUrl`.** Inside a mounted router `req.path` is `/` more often
than it is useful, which is how error logs end up full of `POST /`.
## Express does answer `OPTIONS` — with an `Allow` header

This is under-advertised, and it is the one place Express *does* volunteer a
method list:

```js
// router/index.js — sendOptionsResponse()
const allow = Object.keys(options).sort().join(', ')

res.setHeader('Allow', allow)
res.setHeader('Content-Length', Buffer.byteLength(allow))
res.setHeader('Content-Type', 'text/plain')
res.setHeader('X-Content-Type-Options', 'nosniff')
res.end(allow)
```

The rules, straight from the surrounding code:

- It fires only when the request method is `OPTIONS`, **no layer responded**, no
  error is pending, and **at least one route matched the path**
  (`methods.length === 0` falls through to the normal 404).
- The list is built from `route._methods()` of every matching route — so
  **`use` middleware contributes nothing**, as the source comment on `use` warns.
- The methods are **de-duplicated and sorted**, and the same string is both the
  `Allow` header and the response body.

🔴 **Do not generalise this into "Express sends 405".** It does not. A `GET` to a
path that only has a `POST` route is a **404**, with no `Allow` header — this
responder is `OPTIONS`-only. [Phase 1 ·
01](../../phase-1-routing/01-http-methods/03-405-and-method-semantics.md) covers what to do about that.

## Gotchas

**Symptom:** Logs are full of `POST /` and you cannot tell which endpoint failed
**Cause:** Logging `req.path` or `req.url` inside a mounted router, both of which
have had the mount prefix stripped
**Fix:** Log `req.originalUrl`, which is set once at entry and never rewritten —
[Phase 5 · 07](../../phase-5-errors/07-error-logging.md)

**Symptom:** `req.params` from a parent router is empty inside a child
**Cause:** `handle` sets `req.params = layer.params` unless `mergeParams` is on,
and `restore` puts the parent's back on the way out
**Fix:** `express.Router({mergeParams: true})` —
[Phase 1 · 03](../../phase-1-routing/03-router-composition.md)

**Symptom:** An `OPTIONS` request 404s for a path that clearly has middleware on it
**Cause:** Only **routes** contribute methods to the responder; `use` layers
register none, so `methods.length === 0` and the walk falls through to the 404
**Fix:** Register real routes, or answer `OPTIONS` yourself. For browsers,
preflight is a CORS concern and must be mounted **above** authentication —
[Phase 9 · 02](../../phase-9-hardening/02-cors.md)

**Symptom:** A client sees `Allow: GET, POST` but a `DELETE` returns 404 rather
than 405
**Cause:** The `Allow` header comes from the `OPTIONS` responder only. Express has
no 405 path at all
**Fix:** If you need 405 with `Allow`, write it — a catch-all `app.all` below the
routes for that path. [Phase 1 · 01](../../phase-1-routing/01-http-methods/03-405-and-method-semantics.md)

**Symptom:** A route mounted at `/admin` unexpectedly does *not* handle
`/administrator`, and someone "fixes" it with a regex
**Cause:** That is correct behaviour — `trimPrefix` requires the character after
the prefix to be `/` or nothing
**Fix:** Leave it. A prefix that matches mid-segment is the bug, not the guard

**Symptom:** Mount-relative code breaks for a request whose target is
absolute-form (`GET http://host/path HTTP/1.1`)
**Cause:** `getProtohost` splits the `scheme://host` off so `trimPrefix` can slice
around it — a code path almost nothing exercises
**Fix:** Terminate absolute-form and proxy-shaped requests at the proxy and let
Express see origin-form URLs only

## Interview questions

**★ What is the difference between `req.url`, `req.originalUrl`, `req.baseUrl` and
`req.path`?**
`originalUrl` is set once, at the outermost router, and never rewritten.
`trimPrefix` strips the matched mount prefix from `req.url` and accumulates it
onto `baseUrl` at each nesting level. `path` is a getter over the current,
rewritten `url`. In logs you want `originalUrl`.

**★ Why can a router be mounted at any path without changing its routes?**
Because `trimPrefix` rewrites `req.url` to be relative to the mount before the
mounted handler runs, and the walk restores it afterwards. The router only ever
sees paths relative to where it was mounted — which is exactly what the source
comment on `use` says the feature is for.

**★ Does Express ever send an `Allow` header?**
Yes, but only for `OPTIONS`, and only when at least one **route** matched the path
and nothing else responded. The router collects `route._methods()` from matching
routes, de-duplicates and sorts them, and sends the same string as both the
`Allow` header and the body, with `Content-Type: text/plain` and
`X-Content-Type-Options: nosniff`.

**★ Does Express send 405 Method Not Allowed?**
No. A known path with an unregistered method is a 404 with no `Allow` header. The
`OPTIONS` responder is the only place Express volunteers a method list, and it
does not generalise.

**Why does `app.use('/admin', r)` match `/admin/users` but not `/administrator`?**
`use` layers match with `end: false`, so a prefix match is enough — but
`trimPrefix` additionally requires the next character to be `/` or nothing. The
first is a segment boundary; the second is not.

**How does `req.baseUrl` end up without a doubled slash when mounts nest?**
`trimPrefix` strips a trailing `/` from the removed prefix before appending it to
the parent's `baseUrl`, so `/api` + `/users/` becomes `/api/users`.

---

← Prev: [Inside `router.handle`](03-inside-router-handle.md) · Index: [Object graph](README.md) · Next → [Sub-apps and the server](05-sub-apps-and-the-server.md)
