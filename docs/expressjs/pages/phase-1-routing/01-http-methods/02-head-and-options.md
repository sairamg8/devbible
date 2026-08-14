---
title: "HEAD and OPTIONS"
sidebar_label: "02 · HEAD and OPTIONS"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Two methods Express handles for you, both conditionally, and both in ways that
break the moment you register the method yourself.**

> Verified: 2026-08-14. Read from **`router@2.2.0`** —
> `Route.prototype._handlesMethod`, `Route.prototype._methods`,
> `Route.prototype.dispatch`, and `sendOptionsResponse` in `index.js` — at
> `sandbox/express-verify/node_modules/router/`. **Reading source is not a run:
> nothing was executed for this page and it carries no console block.**
> Cross-checked against
> [expressjs.com · Routing](https://expressjs.com/en/guide/routing.html) — whose
> `app.get` note carries the caveat quoted below — and
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §9.3.2 (HEAD) and
> §9.3.7 (OPTIONS).

## HEAD: served by your GET handler, until it isn't

The fallback is two identical conditionals, one in the router's matching loop and
one in the route's dispatch:

```js
// router/lib/route.js — Route.prototype._handlesMethod()
if (this.methods._all) return true

let name = typeof method === 'string' ? method.toLowerCase() : method

if (name === 'head' && !this.methods.head) {
  name = 'get'
}

return Boolean(this.methods[name])
```

```js
// router/lib/route.js — Route.prototype.dispatch()
let method = typeof req.method === 'string' ? req.method.toLowerCase() : req.method

if (method === 'head' && !this.methods.head) {
  method = 'get'
}
```

Read it as a rule: **`HEAD` is rewritten to `get`, but only if the route has no
`head` handler of its own.** The Express routing guide states the same thing with
the ordering caveat spelled out — `app.get()` covers HEAD *"if `app.head()` was
not called for the path **before** `app.get()`"*.

🔴 **The ordering matters because both conditions read `this.methods.head`, which
is set at registration time.** So:

```js
app.get('/report', sendReport);      // HEAD /report → sendReport ✅
```

```js
app.head('/report', cheapHeadCheck); // registers methods.head = true
app.get('/report', sendReport);      // HEAD /report → cheapHeadCheck only
```

Registering `head` first does not *add* a HEAD path — it **takes HEAD away from
your GET handler**, permanently, for that route. If the `head` handler was a
half-finished optimisation, HEAD requests now get its behaviour and nothing else.
The failure is invisible in a browser and shows up in monitoring probes and cache
revalidation, which are the two things that actually send HEAD.

**Your handler still does all the work.** The rewrite happens at dispatch, so the
GET handler runs in full — the database is queried, the JSON is serialised — and
then Node declines to write a body for a HEAD response, per
[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §9.3.2. HEAD is cheap on
the wire and exactly as expensive on the server. If you need it to be cheap, that
is what an explicit `app.head` is for — and now you know it costs you the
fallback.

## OPTIONS: an `Allow` header Express builds itself

Express does answer `OPTIONS` — this is the one place it volunteers a method
list, and it is much less advertised than it should be:

```js
// router/index.js — sendOptionsResponse()
const allow = Object.keys(options).sort().join(', ')

res.setHeader('Allow', allow)
res.setHeader('Content-Length', Buffer.byteLength(allow))
res.setHeader('Content-Type', 'text/plain')
res.setHeader('X-Content-Type-Options', 'nosniff')
res.end(allow)
```

The conditions, all of them:

- the request method is `OPTIONS`;
- **no layer responded** — an explicit `app.options` handler, or an `app.all`,
  takes over completely;
- no error is pending;
- **at least one route matched the path.** With `methods.length === 0` the walk
  falls through to the ordinary 404.

And the list itself comes from `_methods`, which contains one more conditional
worth knowing:

```js
// router/lib/route.js — Route.prototype._methods()
const methods = Object.keys(this.methods)

if (this.methods.get && !this.methods.head) {
  methods.push('head')          // ← the automatic HEAD is advertised
}
```

So a route registered with only `app.get` advertises `Allow: GET, HEAD` — the
header tells the truth about the fallback. Register `app.head` as well and both
are there for the ordinary reason.

🔴 **`use` middleware contributes nothing.** The source comment on
`Router.prototype.use` says so directly: *"it will not add handlers for those
methods so OPTIONS requests will not consider `.use` functions even if they could
respond."* A path served entirely by mounted middleware — no routes — gets a
**404 for `OPTIONS`**, not an empty `Allow`.

## What this does not give you

**Not CORS.** The automatic responder answers a *plain* `OPTIONS` request. A
browser **preflight** additionally needs `Access-Control-Allow-Origin`,
`-Methods` and `-Headers`, none of which this sends. Preflight is the `cors`
middleware's job, and it must be mounted **above authentication** — a preflight
carries no credentials, so an auth middleware answers 401 and the browser reports
it as a CORS failure. [Phase 9 · 02](../../phase-9-hardening/02-cors.md).

**Not 405.** The responder is `OPTIONS`-only and does not generalise. A `DELETE`
to a GET-only path is still a 404 with no `Allow` —
[chunk 03](03-405-and-method-semantics.md).

## Gotchas

**Symptom:** Monitoring probes using HEAD started getting different results after
someone added an `app.head` route
**Cause:** `_handlesMethod` and `dispatch` both rewrite HEAD to `get` **only when
`methods.head` is unset**. Registering `head` removes the fallback for that route
**Fix:** Either register `head` deliberately and make it complete, or do not
register it at all and let GET serve both

**Symptom:** HEAD requests are as slow as GET
**Cause:** They are the same handler. The rewrite is at dispatch; the body is
dropped at the very end
**Fix:** Expected. If HEAD must be cheap, write an explicit `app.head` — accepting
that it now owns HEAD entirely

**Symptom:** `OPTIONS` on a working endpoint returns 404
**Cause:** The path is served by `use` middleware, not by routes. `use` registers
no methods, so the collector stayed empty and the walk fell through
**Fix:** Register real routes, or answer `OPTIONS` explicitly

**Symptom:** Browser preflight fails with a CORS error even though `OPTIONS`
returns 200 in curl
**Cause:** The automatic responder sends `Allow` but no
`Access-Control-Allow-*` headers — and if authn is mounted above CORS, the
preflight gets a 401 instead
**Fix:** Mount `cors()` above authentication.
[Phase 9 · 02](../../phase-9-hardening/02-cors.md)

**Symptom:** An `app.all('/x', handler)` route stopped sending `Allow`
**Cause:** With a handler for every method, `_handlesMethod('OPTIONS')` is true,
so the route **handles** the request and the automatic responder never runs
**Fix:** Expected. If you want the header, send it yourself from that handler

## Interview questions

**★ Does Express serve HEAD requests automatically?**
Yes, by rewriting the method to `get` — but only if the route has no `head`
handler. Both `_handlesMethod` and `dispatch` check `this.methods.head`, so
registering `app.head` for a path takes HEAD away from that path's GET handler.

**★ Is a HEAD request cheaper than a GET on the server?**
No. The rewrite happens at dispatch, so the GET handler runs in full — the query,
the serialisation, everything. Only the body is not written to the wire. It is
cheaper for the *client* and for the network, not for you.

**★ Does Express send an `Allow` header?**
For `OPTIONS` only, and only when at least one route matched the path and nothing
else responded. It collects the matching routes' methods, de-duplicates and sorts
them, and sends the same string as both the header and the body. It never sends
405.

**★ Why does `Allow` list `HEAD` for a route that only registered `get`?**
`Route.prototype._methods` appends `head` when `get` is present and `head` is
not — so the header advertises the automatic fallback rather than hiding it.

**Why might `OPTIONS` 404 on a path that clearly works?**
Because the path is served by `use` middleware. `use` registers no HTTP methods,
so it contributes nothing to the collector, and an empty method list falls through
to the normal 404.

**Is the automatic `OPTIONS` response enough for CORS?**
No. A browser preflight needs `Access-Control-Allow-Origin`, `-Methods` and
`-Headers`; the built-in responder sends only `Allow`. Use the `cors` middleware,
mounted above authentication.

---

← Prev: [The verb table](01-the-verb-table.md) · Index: [HTTP methods](README.md) · Next → [405 and method semantics](03-405-and-method-semantics.md)
