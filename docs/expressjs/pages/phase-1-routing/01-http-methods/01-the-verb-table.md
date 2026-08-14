---
title: "The verb table"
sidebar_label: "01 · The verb table"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**A route is method + path. Express generates one helper per method Node knows
about — thirty-five of them — and one of those helpers is overloaded in a way
that silently swallows a route.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. **The console block
> below is re-used unchanged from the earlier authorised `sandbox/express-verify`
> run and is sandbox-measured** — nothing was executed for this rewrite. The
> generation mechanism is read from `express@5.2.1`'s `lib/application.js`
> (`methods.forEach`, `app.all`) and `router@2.2.0`'s `lib/route.js`, in
> `sandbox/express-verify/node_modules/`. The method list is
> `require('node:http').METHODS`, which is **35 entries on Node 24.19.0**.
> Cross-checked against [expressjs.com ·
> Routing](https://expressjs.com/en/guide/routing.html) and
> [`app.all`](https://expressjs.com/en/5x/api/application.html#app.all).

## The verbs

```js
// methods.mjs
import express from 'express';

const app = express();

app.get('/items', (req, res) => res.send('list'));
app.post('/items', (req, res) => res.send('create'));
app.put('/items/:id', (req, res) => res.send('replace'));
app.patch('/items/:id', (req, res) => res.send('patch'));
app.delete('/items/:id', (req, res) => res.send('delete'));
app.all('/ping', (req, res) => res.send(req.method));

const server = app.listen(0, async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;

  const postOnlyGet = await fetch(`${base}/items`, {method: 'POST'});
  console.log('POST /items', postOnlyGet.status, await postOnlyGet.text());

  const wrong = await fetch(`${base}/items`, {method: 'DELETE'});
  console.log('DELETE /items (no handler)', wrong.status);

  const ping = await fetch(`${base}/ping`, {method: 'OPTIONS'});
  console.log('all /ping OPTIONS', await ping.text());

  server.close();
});
```

```console
$ node methods.mjs
POST /items 200 create
DELETE /items (no handler) 404
all /ping OPTIONS OPTIONS
```

The middle line is the one to keep: **a path that exists with the wrong method is
a 404, not a 405.** Why, and what to do about it, is
[chunk 03](03-405-and-method-semantics.md).

## Where the helpers come from

Express does not hand-write `app.get`, `app.post` and the rest. It generates one
per method Node's parser knows:

```js
// express/lib/application.js
var methods = require('./utils').methods;   // require('node:http').METHODS, lowercased

methods.forEach(function (method) {
  app[method] = function (path) {
    if (method === 'get' && arguments.length === 1) {
      return this.set(path);              // ← app.get(setting)
    }

    var route = this.route(path);
    route[method].apply(route, slice.call(arguments, 1));
    return this;
  };
});
```

On **Node 24.19.0 that is 35 methods**, and all 35 exist on your app:

```text
ACL BIND CHECKOUT CONNECT COPY DELETE GET HEAD LINK LOCK M-SEARCH MERGE
MKACTIVITY MKCALENDAR MKCOL MOVE NOTIFY OPTIONS PATCH POST PROPFIND PROPPATCH
PURGE PUT QUERY REBIND REPORT SEARCH SOURCE SUBSCRIBE TRACE UNBIND UNLINK
UNLOCK UNSUBSCRIBE
```

Two consequences worth knowing:

- **`app.query`, `app.search`, `app.report`, `app.purge` and the WebDAV verbs all
  exist.** `QUERY` in particular is a live HTTP method — a GET-with-a-body
  proposal — and Express's routing guide lists it. If you need it, it is already
  there.
- **`M-SEARCH` becomes `app['m-search']`**, because the lowercased name is not a
  valid identifier. It is the one verb you cannot call with dot notation.

🔴 **The overload in that source is the trap.** `app.get` is *both* the route
registrar and the settings reader, disambiguated only by `arguments.length === 1`:

```js
app.get('etag')            // → 'weak'   — reads a setting
app.get('/health')         // → the app  — reads a setting named "/health"! (undefined)
app.get('/health', handler)  // → registers a route
```

**`app.get('/health')` with the handler accidentally omitted does not throw.** It
reads a setting called `/health`, gets `undefined`, discards it, and returns the
app so your chain keeps working. The route is silently never registered, and the
endpoint 404s in production. No other verb behaves this way — `app.post('/x')`
throws `TypeError: argument handler is required` from the route, which is what
you would want here too.

## `app.all` and `route.all` are not the same thing

Both are documented as "every method", and they are implemented completely
differently:

```js
// express/lib/application.js — app.all
app.all = function all(path) {
  var route = this.route(path);
  var args = slice.call(arguments, 1);
  for (var i = 0; i < methods.length; i++) {
    route[methods[i]].apply(route, args);      // ← all 35, one at a time
  }
  return this;
};
```

```js
// router/lib/route.js — Route.prototype.all
const layer = Layer('/', {}, fn)
layer.method = undefined          // ← matches any method
this.methods._all = true
this.stack.push(layer)
```

| | `app.all(path, fn)` | `app.route(path).all(fn)` |
|---|---|---|
| Layers pushed onto the route | **35**, one per method | **1**, with `method: undefined` |
| `route.methods` | 35 keys | `{_all: true}` |
| Behaviour for a request | identical | identical |
| Chaining more verbs after it | awkward | natural — `.all(auth).get(list).post(create)` |

`route.all` is the useful one, and the source's own example shows why: it is how
you attach per-route middleware that must run before every verb on that path.

```js
app.route('/orders/:id')
  .all(requireAuth)          // runs for GET, PUT, DELETE on this path
  .all(loadOrder)
  .get(sendOrder)
  .put(replaceOrder)
  .delete(removeOrder);
```

That is [Phase 1 · 07](../07-app-route-and-hosts.md), and it removes the repeated
path string that route tables accumulate.

## Trade-off

`app.all` is convenient for diagnostics and for a catch-all under a prefix. Using
it for real resources **hides method mistakes**: a client sending `PUT` where the
API meant `PATCH` gets a 200 and the wrong semantics, where explicit verbs would
have given a 404 and a fast bug report. Prefer explicit verbs on anything public;
keep `app.all` for middleware-shaped work on a route.

## Gotchas

**Symptom:** A route registered with `app.get('/health')` 404s in production and
never threw at startup
**Cause:** `app.get` with exactly one argument is the **settings reader**. It read
a setting named `/health`, found nothing, and returned the app
**Fix:** Never call `app.get` with one argument for a route. A startup assertion —
`app.get('/health', handler)` returning the app is normal; the absence of the
route is not — or a route-table test, catches it

**Symptom:** `POST /users` returns 404 even though `app.get('/users')` exists
**Cause:** Only GET was registered. Path match alone is not a route match
**Fix:** Register the method you mean. See [chunk
03](03-405-and-method-semantics.md) for why the answer is 404 and not 405

**Symptom:** `app.m-search is not a function`
**Cause:** The lowercased method name contains a hyphen
**Fix:** `app['m-search'](path, handler)`

**Symptom:** Using `app.all` for a resource, and a client's wrong verb silently
succeeds
**Cause:** `app.all` registers all 35 methods, so nothing can be "the wrong verb"
**Fix:** Explicit verbs on public paths; `app.route(path).all(fn)` when what you
actually wanted was per-route middleware

## Interview questions

**★ What status does Express return when the path matches but the method does
not?**
404, not 405. Express has no 405 path at all; the router simply finds no matching
route and the request falls through to `finalhandler`.

**★ Why is `app.get('/health')` a dangerous line?**
Because `app.get` is overloaded: with exactly one argument it reads an
application setting instead of registering a route. It returns the app rather
than throwing, so a forgotten handler produces a silently missing endpoint. No
other verb helper has this overload.

**★ How many HTTP method helpers does an Express app have, and where do they come
from?**
One per entry in `require('node:http').METHODS` — 35 on Node 24 — generated by a
`methods.forEach` loop in `lib/application.js`. That includes `QUERY`, `SEARCH`,
`REPORT` and the WebDAV verbs, and `M-SEARCH` as `app['m-search']`.

**★ What is the difference between `app.all(path, fn)` and
`app.route(path).all(fn)`?**
Behaviour is the same; implementation is not. `app.all` loops the 35 methods and
registers `fn` under each, pushing 35 layers. `route.all` pushes one layer with
`method: undefined` and sets `methods._all`. `route.all` is the one to reach for,
because it chains naturally with the verbs that follow it.

**When would you deliberately use `app.all`?**
Diagnostics, a catch-all under a prefix, or a maintenance-mode short circuit.
Not for modelling a resource — it removes the framework's ability to tell you a
client used the wrong verb.

**Is `QUERY` a real HTTP method?**
Yes — it is in Node's `METHODS` list, so Express generates `app.query` for it, and
the Express routing guide lists it among the verbs `app.all` covers. It is a
safe, idempotent method that carries a request body, aimed at searches too large
for a query string.

---

Index: [HTTP methods](README.md) · Next → [HEAD and OPTIONS](02-head-and-options.md)
