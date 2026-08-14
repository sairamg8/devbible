---
title: "Two objects in one"
sidebar_label: "01 · Two objects in one"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**`req` is Node's `IncomingMessage` with Express's prototype spliced underneath
it. Knowing which half a property comes from tells you whether it always exists,
whether it costs anything to read, and who can lie about it.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. The prototype
> splice is `Object.setPrototypeOf(req, this.request)` in `app.handle`, and the
> twelve getters are `defineGetter(req, …)` calls in `express@5.2.1`'s
> `lib/request.js` — both read from `sandbox/express-verify/node_modules/`.
> **Reading source is not a run: nothing was executed for this page and it carries
> no console block.** The Node half is per
> [`http.IncomingMessage`](https://nodejs.org/api/http.html#class-httpincomingmessage);
> the Express half per the
> [request reference](https://expressjs.com/en/5x/api/request.html).

## The prototype chain

```text
your req instance                    ← per-request own properties live here
  └─ app.request                     ← express/lib/request.js + { app }
       └─ http.IncomingMessage.prototype
            └─ stream.Readable.prototype
                 └─ EventEmitter.prototype
```

Express does not wrap. `app.handle` calls
`Object.setPrototypeOf(req, this.request)` on the live object Node created, so
`req instanceof http.IncomingMessage` remains true and every Node method — `pipe`,
`destroy`, `setEncoding`, `on('data')` — is the real one
([Phase 0 · 01 · chunk 02](../../phase-0-express-basics/01-what-express-is/02-the-app-is-a-function.md)).

That single fact answers most "where did this come from" questions:

| Layer | Examples | Always present? |
|---|---|---|
| **`stream.Readable`** | `pipe`, `on('data')`, `destroy`, `readable` | yes — `req` **is** the body stream |
| **`http.IncomingMessage`** | `method`, `url`, `headers`, `httpVersion`, `socket`, `rawHeaders` | yes, from the moment the listener is called |
| **`express/lib/request.js`** | 12 getters + `get`, `is`, `accepts`, `range` | yes, but **computed on access** |
| **your own / middleware** | `body`, `cookies`, `user`, `validated`, `id` | **only if something set them** |

## The Node half: raw, cheap, and yours to distrust

| Property | What it actually is |
|---|---|
| `req.method` | the verb string, uppercase, exactly as parsed |
| `req.url` | the **request target** — path + query, no origin — and it is **rewritten** by every mount ([Phase 0 · 02 · chunk 04](../../phase-0-express-basics/02-app-router-server/04-url-rewriting-and-options.md)) |
| `req.headers` | a plain object with **lowercased** keys; duplicates joined with `, ` (except `set-cookie`, which stays an array) |
| `req.rawHeaders` | a flat array preserving original case and order — the only way to see a header's original casing |
| `req.socket` | the TCP socket: `remoteAddress`, `encrypted`, `destroy()` |
| `req.httpVersion` | `'1.1'`, `'2.0'` — occasionally matters for keep-alive reasoning |

Two things worth internalising:

- **`req.headers` is the parsed view and it is lossy.** Two `X-Custom` headers
  arrive as one comma-joined string. If that matters, read `req.rawHeaders`.
- **Everything here is attacker-supplied except `req.socket.remoteAddress`.**
  Headers are input. `Host` is input. That is the entire premise of
  [`trust proxy`](../../phase-9-hardening/01-trust-proxy/README.md) and of
  [chunk 02](02-the-twelve-getters.md).

## The Express half: twelve getters, none cached

`lib/request.js` installs exactly twelve `defineGetter` properties:

```text
query   protocol   secure   ip    ips     subdomains
path    host       hostname fresh stale   xhr
```

🔴 **Every one is recomputed on every access.** There is no memoisation anywhere
in the file. `req.query` re-parses the query string; `req.ip` re-runs the proxy
resolution; `req.hostname` re-parses the `Host` header. In a hot handler,
destructure once:

```js
const {ip, hostname} = req;          // one computation each
const {page, limit} = req.query;     // one parse, not two
```

For most of them the cost is trivial. For `req.query` it is a full parse and a
**new object every time**, which is why mutating `req.query.filters` does nothing
([Phase 1 · 02 · chunk 02](../../phase-1-routing/02-params-and-query/02-the-query-parser.md)).

## The middleware half: nothing is free

| Property | Requires | Value when absent |
|---|---|---|
| `req.body` | `express.json` / `urlencoded` / `raw` / `text`, or multer | **`undefined`** (Express 4 gave `{}`) |
| `req.cookies` | **`cookie-parser`** — not built in | `undefined` |
| `req.signedCookies` | `cookie-parser` with a secret | `undefined` |
| `req.file` / `req.files` | multer | `undefined` |
| `req.user` | your auth middleware | `undefined` |
| `req.session` | `express-session` | `undefined` |
| `req.id` | your request-id middleware | `undefined` |

🔴 **The cookie asymmetry is real and documented on both sides**: `res.cookie` is
built into Express, `req.cookies` is not. Writing cookies works out of the box;
reading them silently gives `undefined` until `cookie-parser` is mounted.

And the structural point: **each row is an undeclared dependency.** A handler
reading `req.user` cannot be understood, tested or type-checked without knowing
which middleware ran above it, and nothing in the framework connects the two. The
mitigation is to keep the list short, the names conventional, and the mounting
visible in one factory
([Phase 2 · 02 · chunk 02](../../phase-2-middleware/02-execution-order/02-ordering-in-practice.md)).

## Reading the wrong half

The most common confusions, and which layer each belongs to:

| You wanted | Use | Not |
|---|---|---|
| the URL the client sent | `req.originalUrl` | `req.url` — rewritten by mounts |
| the client's address | `req.ip` **with `trust proxy` set correctly** | `req.socket.remoteAddress` (the proxy) or a raw `X-Forwarded-For` |
| a header, case-insensitively | `req.get('Content-Type')` | `req.headers['Content-Type']` — keys are lowercased |
| the host | `req.hostname` | `req.headers.host` — includes the port |
| whether a body is JSON | `req.is('json')` | a `=== 'application/json'` comparison — misses `; charset=utf-8` |
| the body | `req.body`, after a parser | reading the stream yourself after a parser already consumed it |

## Gotchas

**Symptom:** `req.headers['Content-Type']` is `undefined` but the header was sent
**Cause:** Node lowercases header names when building `req.headers`
**Fix:** `req.get('Content-Type')`, which lowercases for you — or index with the
lowercase key

**Symptom:** Two identical custom headers arrive as one comma-joined string
**Cause:** `req.headers` is the parsed, joined view
**Fix:** `req.rawHeaders` is the flat original list. `set-cookie` is the one field
Node keeps as an array

**Symptom:** `req.cookies` is `undefined` even though the browser sent cookies
**Cause:** `cookie-parser` is not mounted. Express writes cookies but does not
read them
**Fix:** Mount `cookie-parser`. `req.headers.cookie` is the raw string if you
prefer to parse it yourself

**Symptom:** Reading `req.query` in a loop is measurably slow
**Cause:** It is a getter with no cache; every access re-parses the query string
and allocates a new object
**Fix:** Destructure once into locals

**Symptom:** A handler works in one route and throws `Cannot read properties of
undefined` in another
**Cause:** It reads a property some middleware attaches, and that middleware is
not mounted above this route
**Fix:** Mount it, or make the dependency loud — a guard that throws a clear
error beats a `TypeError` three layers down

## Interview questions

**★ What is `req`, exactly?**
Node's `http.IncomingMessage` — a readable stream — with Express's request
prototype spliced into its chain by `Object.setPrototypeOf` in `app.handle`.
Express adds no wrapper, so `req instanceof http.IncomingMessage` is still true
and every Node stream method is the real one.

**★ Which `req` properties always exist and which do not?**
The Node ones (`method`, `url`, `headers`, `socket`) always exist. Express's
twelve getters always resolve, but they are computed on access. Everything else —
`body`, `cookies`, `user`, `session` — exists only if a middleware set it, and is
`undefined` otherwise.

**★ Is `req.body` available without middleware?**
No. In Express 5 it is `undefined` until a body parser runs; Express 4 gave `{}`,
which is why upgraded code that did `Object.keys(req.body)` now throws.

**★ Is `req.cookies` built into Express?**
No, and the asymmetry is documented on both sides: `res.cookie` is built in,
`req.cookies` and `req.signedCookies` need `cookie-parser`. The raw string is
always available as `req.headers.cookie`.

**Are Express's `req` properties cached?**
No. All twelve are `defineGetter` properties recomputed on every access — `query`
re-parses and returns a new object each time, `ip` re-runs the proxy resolution.
Destructure once in hot paths.

**Why is `req.headers` lossy?**
Because it is the parsed view: keys are lowercased and duplicate headers are
joined with `, `. `set-cookie` is the exception Node keeps as an array.
`req.rawHeaders` preserves original case and order.

---

Index: [req anatomy](README.md) · Next → [The twelve getters](02-the-twelve-getters.md)
