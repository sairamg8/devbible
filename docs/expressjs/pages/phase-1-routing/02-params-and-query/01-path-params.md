---
title: "Path params"
sidebar_label: "01 · Path params"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Path params are part of the route pattern, decoded per segment, and delivered
on an object with no prototype — unless your route was a RegExp, in which case
they are not.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. **The console block
> below is re-used unchanged from the earlier authorised `sandbox/express-verify`
> run and is sandbox-measured** — nothing was executed for this rewrite. The
> matching mechanism is read from `router@2.2.0`'s `lib/layer.js` (`Layer`,
> `decodeParam`, `loosen`) and from **`path-to-regexp@8.4.2`**'s compiled `match`,
> both in `sandbox/express-verify/node_modules/`, cited by function. Named params
> and the Express 5 splat syntax are per the
> [routing guide](https://expressjs.com/en/guide/routing.html); the full syntax
> change is [page 05](../05-path-matching-express5.md).

## The basic shape

```js
// params.mjs
import express from 'express';

const app = express();

app.get('/users/:userId/books/:bookId', (req, res) => {
  res.json({params: req.params, path: req.path});
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  const res = await fetch(
    `http://127.0.0.1:${port}/users/u1/books/b9?verbose=1`,
  );
  console.log(await res.json());
  server.close();
});
```

```console
$ node params.mjs
{ params: { userId: 'u1', bookId: 'b9' }, path: '/users/u1/books/b9' }
```

Params are **strings**, always. Coerce and validate at the edge
([Phase 8 · 01](../../phase-8-validation-authz/01-validate-at-boundary/README.md)) —
never hand `req.params.id` to a query as though it were a number, and never
assume it is even a plausible one.

## Where they come from

Routing is not in Express. A `Layer` compiles its path once, at registration, and
the compiler is **`path-to-regexp@8.4.2`**, reached through `router@2.2.0`:

```js
// router/lib/layer.js — Layer(), the string-path branch
return pathRegexp.match((opts.strict ? _path : loosen(_path)), {
  sensitive: opts.sensitive,
  end: opts.end,
  trailing: !opts.strict,
  decode: decodeParam
})
```

Four options, and each maps to something you can observe:

| Option | Comes from | What it decides |
|---|---|---|
| `sensitive` | `case sensitive routing` | whether `/Users` matches `/users` |
| `end` | `false` for `use`, `true` for routes | prefix match vs whole-path match |
| `strict` / `trailing` | `strict routing` | whether `/users/` matches `/users` |
| `decode` | always `decodeParam` | per-segment percent-decoding |

Note `loosen(_path)`, applied when `strict` is off: it strips trailing slashes
**from your pattern**, so `app.get('/users/', h)` and `app.get('/users', h)`
compile to the same thing by default. `strict routing` is what stops that — and
it is read once, when the router is first built
([Phase 0 · 01 · chunk 03](../../phase-0-express-basics/01-what-express-is/03-what-express-delegates.md)).

## Four behaviours that follow from the source

**1 · Unmatched optional params are omitted, not `undefined`.**

```js
// path-to-regexp/dist/index.js — match()
const params = Object.create(null);
for (let i = 1; i < m.length; i++) {
  if (m[i] === undefined) continue;        // ← the key is never created
  params[keys[i - 1].name] = decoders[i - 1](m[i]);
}
```

So for an optional segment that did not match, `'name' in req.params` is
**false** — not "present and undefined". Code written as
`if (req.params.action !== undefined)` works by accident; code written as
`Object.keys(req.params)` sees a genuinely shorter list.

🔴 **2 · `req.params` has a NULL PROTOTYPE — for string paths only.**
`Object.create(null)` in the line above. That means:

```js
req.params.hasOwnProperty('id')   // ❌ TypeError: not a function
Object.hasOwn(req.params, 'id')   // ✅
'id' in req.params                // ✅
```

But a **RegExp** route takes a different branch entirely — the router builds its
own matcher, and that one uses a plain `{}`:

```js
// router/lib/layer.js — the RegExp branch
const params = {}
for (let i = 1; i < match.length; i++) { /* … */ }
```

So `req.params.hasOwnProperty` **works** on a RegExp route and **throws** on a
string route. Two routes in the same file, same helper, opposite behaviour. Use
`Object.hasOwn` and the question never arises.

**3 · Splat params are arrays, and each segment is decoded separately.** The
wildcard decoder in `path-to-regexp` is
`(value) => value.split(delimiter).map(decode)`:

```js
app.get('/files/*path', (req, res) => {
  // GET /files/images/logo%20v2.png
  req.params.path;   // ['images', 'logo v2.png']  ← array, each part decoded
});
```

Express 4 code reading `req.params[0]` as a string gets `'images,logo v2.png'`
from an implicit `Array.prototype.toString` — a path with commas where the
slashes were. This is the single most common Express 4 → 5 migration bug in
file-serving routes. Rejoin deliberately with `req.params.path.join('/')`, and
then treat the result as hostile input: it is a user-supplied path
([Phase 4 · 08](../../phase-4-responses/08-streaming-and-downloads.md) on
`res.sendFile`'s `root` guard).

🔴 **4 · A malformed percent-escape is a 400, not a 500.**

```js
// router/lib/layer.js — decodeParam()
try {
  return decodeURIComponent(val)
} catch (err) {
  if (err instanceof URIError) {
    err.message = 'Failed to decode param \'' + val + '\''
    err.status = 400
  }
  throw err
}
```

`GET /users/%E0%A4%A` throws a `URIError` inside the matcher; `matchLayer` catches
it and turns it into the walk's pending error; the default error handler reads
`err.status` and answers **400**. Worth knowing because the message is distinctive
and appears in logs with no stack of yours in it — and because a custom error
handler that ignores `err.status` will turn a legitimate 400 into a 500 and an
alert.

## Params vs query for identity

A design point the framework does not enforce and everything downstream assumes:

| Use a **path param** for | Use a **query param** for |
|---|---|
| identity — `/users/:id` | filtering — `?status=active` |
| hierarchy — `/orders/:id/items` | sorting — `?sort=-created_at` |
| anything that names *the* resource | pagination — `?limit=20&cursor=…` |
| anything a cache key must include | anything optional or omittable |

The test: **if removing it would leave a different resource rather than a
differently-filtered view of the same one, it is a path param.** `?id=42` is a
smell — it makes the collection and the item the same URL, breaks cache
granularity, and makes an authorization check easy to forget because the route
looks like a list endpoint.

## Gotchas

**Symptom:** `req.params.hasOwnProperty is not a function`
**Cause:** For string paths, `path-to-regexp` builds params with
`Object.create(null)` — no prototype, no inherited methods
**Fix:** `Object.hasOwn(req.params, key)` or `key in req.params`. Note it *does*
work on a RegExp route, which is why this looks intermittent

**Symptom:** After the Express 5 upgrade, a file route serves
`images,logo.png` instead of `images/logo.png`
**Cause:** Splat params are arrays now. `req.params[0]` stringified an array
**Fix:** `req.params.path.join('/')`, then validate it — a user-controlled path
segment is a traversal risk

**Symptom:** A request with a stray `%` in the URL returns 500 and pages someone
**Cause:** `decodeParam` sets `err.status = 400`, but a custom error handler that
maps everything to 500 discarded it
**Fix:** Honour `err.status` / `err.statusCode` in your error handler —
[Phase 5 · 04](../../phase-5-errors/04-mapping-to-http.md)

**Symptom:** `Object.keys(req.params)` is missing a key you declared optional
**Cause:** Unmatched groups are skipped, so the key is never created
**Fix:** Read with a default — `const {action = 'view'} = req.params`

**Symptom:** `/users/` 404s once someone enabled `strict routing`
**Cause:** Without `strict`, the pattern is passed through `loosen()`, which
strips trailing slashes. With it, `/users/` and `/users` are different routes
**Fix:** Decide once, in the app factory, before any route is registered — the
setting is read only when the router is first built

## Interview questions

**★ What type are route params, and what does that mean for your handler?**
Always strings — including `:id` on a numeric id. They must be coerced and
validated at the boundary; a handler that passes `req.params.id` straight into a
query is trusting an arbitrary string.

**★ Why does `req.params.hasOwnProperty('id')` throw?**
Because for string paths `path-to-regexp` creates the params object with
`Object.create(null)`, so it has no prototype and no inherited methods. Use
`Object.hasOwn`. A RegExp route uses a plain object and does not throw, which
makes the failure look intermittent.

**★ What changed about wildcards in Express 5?**
Bare `*` is gone; you name the splat (`/files/*path`), and **the captured value
is an array of decoded segments**, not a string. Express 4 code reading
`req.params[0]` now gets a comma-joined array.

**★ What status does Express return for a URL with a malformed percent-escape?**
400. `decodeParam` catches the `URIError`, rewrites the message to
`Failed to decode param '…'` and sets `err.status = 400`; the default handler
uses it. A custom error handler that ignores `err.status` will report it as a
500.

**When should something be a path param rather than a query param?**
When it identifies the resource rather than filtering a view of it. If removing
it leaves a *different* resource instead of a broader list, it belongs in the
path. `?id=` collapses the collection and the item into one URL and makes
authorization easy to forget.

**Does `/users/` match `app.get('/users')`?**
By default yes — with `strict routing` off, the pattern is passed through
`loosen()`, which strips trailing slashes, and `trailing` matching is enabled.
Turning `strict routing` on separates them, and it must be set before the first
route.

---

Index: [Params and query](README.md) · Next → [The query parser](02-the-query-parser.md)
