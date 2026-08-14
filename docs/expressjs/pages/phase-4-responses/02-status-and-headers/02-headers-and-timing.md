---
title: "Headers, and when it is too late"
sidebar_label: "02 · Headers and timing"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Every header must be set before the first byte. After that, `res.set` and
`res.status` fail *silently* while `res.send` throws — an asymmetry that makes
one kind of mistake invisible and the other loud in the wrong place.**

> Verified: 2026-08-14 on **Express 5.2.1**. `res.set`, `res.append`, `res.vary`,
> `res.links`, `res.attachment`, `res.type` and `res.get` are read from
> `express@5.2.1`'s `lib/response.js` in `sandbox/express-verify/node_modules/`,
> quoted by function. **Reading source is not a run: nothing was executed for this
> page and it carries no console block.** `res.headersSent` is the documented
> boolean that flips once headers go out
> ([response reference](https://expressjs.com/en/5x/api/response.html));
> `res.writableEnded` / `res.writableFinished` are Node's, per
> [`http.ServerResponse`](https://nodejs.org/api/http.html#class-httpserverresponse).

## The timeline

```text
handler starts
  │   res.status()   ✅   res.set()   ✅   res.type()   ✅   res.cookie()   ✅
  │
  ├── first write  ── headers flushed ──►  res.headersSent === true
  │
  │   res.status()   ⚠️ silent no-op      res.set()   ⚠️ silent no-op
  │   res.send()     🔴 throws ERR_HTTP_HEADERS_SENT
  │
  └── res.end()  ──►  res.writableEnded === true  ──►  'finish'
```

🔴 **The asymmetry is the thing to remember.** Setting a status or a header after
the fact **mutates a field nobody will read** — no error, no warning, no log
line. Writing after the fact attempts a socket operation and throws. So a
too-late `res.status(404)` is invisible and a too-late `res.json({})` is loud, in
whatever unrelated middleware happened to be second
([Phase 2 · 03 · chunk 03](../../phase-2-middleware/03-next-semantics/03-double-send-and-guards.md)).

The three properties that tell you where you are:

| Property | True once | Answers |
|---|---|---|
| `res.headersSent` | the first byte is written | "is it too late to set headers?" |
| `res.writableEnded` | `res.end()` has been called | "did **we** finish, or did the client leave?" |
| `res.writableFinished` | the last byte reached the OS | what `'finish'` fires on |

## The header helpers, precisely

**`res.set(field, val)` / `res.header(...)`** — replaces. Everything is
stringified with `String(val)`, so `res.set('X-Count', undefined)` sends the
literal text `undefined`. Arrays are allowed for multi-value headers, and
**`Content-Type` as an array throws `TypeError`**. `Content-Type` values are run
through `mime.contentType`, which is why setting `'text/html'` yields
`text/html; charset=utf-8`.

**`res.append(field, val)`** — accumulates:

```js
var prev = this.get(field);
var value = val;
if (prev) {
  value = Array.isArray(prev) ? prev.concat(val)
    : Array.isArray(val) ? [prev].concat(val)
      : [prev, val]
}
return this.set(field, value);
```

Use it for anything that may legitimately repeat: `Set-Cookie`, `Link`, `Vary`.
Using `set` twice silently discards the first value.

**`res.vary(field)`** delegates to the `vary` package, which de-duplicates for
you — so calling it twice with `Accept` is safe where `append` would produce
`Accept, Accept`.

**`res.links(obj)`** builds an RFC 8288 `Link` header and **appends to any
existing one**, handling an array of URLs per relation:

```js
res.links({next: '/orders?cursor=abc', prev: '/orders?cursor=xyz'});
// Link: </orders?cursor=abc>; rel="next", </orders?cursor=xyz>; rel="prev"
```

That is the standards-based place to put pagination cursors, as an alternative to
embedding them in the body
([Phase 6 · 03](../../phase-6-rest-surface/03-pagination.md)).

**`res.attachment([filename])`** sets `Content-Disposition` via the
`content-disposition` package — which handles the quoting and the RFC 5987
`filename*` encoding for non-ASCII names — and, if given a filename, **also sets
the content type from its extension**. That second effect is easy to miss and
occasionally unwanted.

**`res.get(field)`** reads back a header **you** set. It is
`this.getHeader(field)` — it cannot see request headers, which is `req.get`.

## The headers to set deliberately

| Header | Set it | Why |
|---|---|---|
| `Cache-Control` | on **every** response | the default is "the intermediary decides" — [Phase 6 · 07](../../phase-6-rest-surface/07-etag-and-cache.md) |
| `Vary` | whenever the response depends on a request header | a negotiated response cached without it is served to the wrong client |
| `Location` | on 201 and every redirect | the id is the thing the client cannot compute |
| `Retry-After` | on 429 and 503 | without it a client guesses, and guesses badly |
| `Allow` | on 405 | RFC 9110 requires it, and Express never sends it |
| `Content-Disposition` | on downloads | `res.attachment` handles the encoding |
| `X-Request-Id` | on every response | so a user can quote it in a support ticket |

🔴 **`Cache-Control` is the one people leave to chance.** Nothing sets it by
default, so a private JSON response with no `Cache-Control` is fair game for any
intermediary that decides to heuristically cache it. For anything user-specific,
`no-store`; for anything genuinely public, say so and say for how long.

## Error responses need headers too

An error path that skips the headers a success path sets is a real and common
gap:

- **Helmet mounted below the routes** means error responses miss every security
  header ([Phase 2 · 02 · chunk 01](../../phase-2-middleware/02-execution-order/01-the-four-levels.md)).
- **`X-Request-Id` set in a handler** rather than in middleware is absent from
  every error — exactly when someone needs to quote it.
- **`Retry-After` on a 503** is often forgotten, so clients hammer a service that
  told them it was unavailable.

The rule that fixes all three: **headers that describe the response as a whole
belong in middleware mounted above the routes, not in handlers.**

## `err.headers` — the one Express does copy

The default error handler copies `err.headers` onto the response. So an error
object can carry its own:

```js
class TooManyRequests extends Error {
  status = 429;
  headers = {'Retry-After': '30'};
}
throw new TooManyRequests();
```

That keeps status and headers together on the thing that knows about them,
rather than requiring the error handler to special-case each type
([Phase 5 · 04](../../phase-5-errors/04-mapping-to-http.md)).

## Gotchas

**Symptom:** `res.status(404)` after a `res.send` produces a 200, with no error
**Cause:** Headers were flushed on the first write; `res.status` mutates a field
nobody reads and does **not** throw
**Fix:** Decide the status before writing. There is no warning for this

**Symptom:** `ERR_HTTP_HEADERS_SENT` from the 404 handler or the error handler
**Cause:** Something upstream already responded and then called `next()`
**Fix:** `return` every terminal call; guard error handlers with
`if (res.headersSent) return next(err)`

**Symptom:** Only the last `Vary` value is present
**Cause:** `res.set('Vary', …)` twice — `set` replaces
**Fix:** `res.vary(field)`, which appends and de-duplicates

**Symptom:** A header reads `undefined` in production
**Cause:** `res.set` calls `String(val)` unconditionally
**Fix:** Guard before setting

**Symptom:** A CDN serves the JSON response to a browser that asked for HTML
**Cause:** Content negotiation with no `Vary: Accept`
**Fix:** `res.vary('Accept')`, or use `res.format`, which does it for you

**Symptom:** Error responses lack the security headers that success responses have
**Cause:** Helmet, or a header-setting middleware, is mounted below the routes
**Fix:** Response-wide headers go in middleware above everything

**Symptom:** A download of `résumé.pdf` arrives with a mangled filename
**Cause:** A hand-built `Content-Disposition`
**Fix:** `res.attachment(filename)` — the `content-disposition` package handles
the RFC 5987 encoding

## Interview questions

**★ What happens if you set a header after the response has started?**
Nothing visible — `res.set` and `res.status` mutate fields that will never be
read, and neither throws. Only a **write** throws `ERR_HTTP_HEADERS_SENT`. That
asymmetry makes a too-late status invisible and a too-late body loud in code
unrelated to the bug.

**★ How do you know whether it is too late?**
`res.headersSent`. It is the documented boolean that flips at the first write,
and `if (res.headersSent) return next(err)` is the documented first line of an
error handler.

**★ Why use `res.vary` rather than `res.set('Vary', …)`?**
Because `set` replaces. `vary` appends and de-duplicates, so calling it from two
independent middleware produces one correct header rather than the last one
winning — and a missing `Vary` on a negotiated response is a cache-poisoning bug,
not a cosmetic one.

**★ Which headers should be set in middleware rather than in handlers?**
Anything that describes the response as a whole: security headers, `X-Request-Id`,
`Cache-Control` defaults. Set in a handler, they are missing from every error
response — which is exactly when someone needs the request id.

**What does `res.attachment('report.csv')` do beyond `Content-Disposition`?**
It also sets the content type from the extension, via `res.type`. That is
convenient and occasionally unwanted, so set the type explicitly afterwards if you
need something else.

**How can an error carry its own headers?**
Put them on the error as `err.headers` — the default error handler copies them
onto the response. That keeps a 503's `Retry-After` with the thing that knows the
retry interval, instead of special-casing it in the handler.

---

← Prev: [Status as contract](01-status-as-contract.md) · Index: [Status and headers](README.md) · Next topic → [Response shapes](../03-response-shapes.md)
