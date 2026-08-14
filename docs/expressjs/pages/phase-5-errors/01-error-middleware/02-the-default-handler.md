---
title: "The default handler"
sidebar_label: "02 · The default handler"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**The thing that answers when you define no error handler is `finalhandler` — a
separate package that also produces every 404. It has precise rules about which
`err.status` values it will believe, and it destroys the socket rather than
truncating a response.**

> Verified: 2026-08-14 against **`finalhandler@2.1.1`** in
> `sandbox/express-verify/node_modules/`, reading the returned closure and its
> helpers `getErrorStatusCode`, `getResponseStatusCode`, `getErrorMessage` and
> `getErrorHeaders`, quoted by function. It is installed by `app.handle` as the
> router's callback ([Phase 0 · 01 · chunk
> 02](../../phase-0-express-basics/01-what-express-is/02-the-app-is-a-function.md)).
> **Reading source is not a run: nothing was executed for this page and it carries
> no console block.** Cross-checked against the
> [error-handling guide](https://expressjs.com/en/guide/error-handling.html)'s
> description of the default handler.

## One function, both endings

```js
// finalhandler/index.js — the returned closure
if (err) {
  status = getErrorStatusCode(err)
  if (status === undefined) {
    status = getResponseStatusCode(res)
  } else {
    headers = getErrorHeaders(err)          // ← only when the error gave a status
  }
  msg = getErrorMessage(err, status, env)
} else {
  status = 404
  msg = 'Cannot ' + req.method + ' ' + encodeUrl(getResourceName(req))
}
```

The 404 and the 500 are **the same call**, distinguished only by whether an error
was passed. That is the mechanical reason a 404 never reaches your four-argument
middleware: it travelled as "no error", so the error stack was never consulted
([Phase 0 · 03 · chunk 03](../../phase-0-express-basics/03-request-lifecycle/03-the-four-endings.md)).

It is also where the familiar body comes from: **`Cannot GET /foo`**, with the
path URL-encoded.

## Which `err.status` it will believe

```js
function getErrorStatusCode (err) {
  if (typeof err.status === 'number' && err.status >= 400 && err.status < 600) return err.status
  if (typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600) return err.statusCode
  return undefined
}
```

Three constraints, all easy to trip over:

- **It must be a `number`.** `err.status = '404'` is ignored — a status parsed
  out of a string, or copied from an upstream JSON body, is a string.
- **It must be ≥ 400 and < 600.** A 3xx on an error object is ignored, so an
  error carrying `status: 301` does not produce a redirect.
- **`status` is checked before `statusCode`.** If both are present and disagree,
  `status` wins.

When it returns `undefined`, the fallback is the response's own status:

```js
function getResponseStatusCode (res) {
  var status = res.statusCode
  if (typeof status !== 'number' || status < 400 || status > 599) status = 500
  return status
}
```

🔴 **So a handler that set `res.status(422)` and then threw produces a 422**, not
a 500 — the already-set response status is used. That is occasionally exactly
what you want and much more often a surprise, because the status was set for the
success path.

**And `err.headers` is only copied when the error supplied a valid status.** An
error with `headers` but no `status` in range gets neither.

## What goes in the body

```js
function getErrorMessage (err, status, env) {
  var msg
  if (env !== 'production') {
    msg = err.stack                                    // ← the whole stack
    if (!msg && typeof err.toString === 'function') msg = err.toString()
  }
  return msg || statuses.message[status]
}
```

🔴 **In any environment that is not exactly `'production'`, the response body is
`err.stack`.** Not the message — the entire stack trace, with your file paths and
line numbers, sent to the client. `env` is resolved once at `app.init()` from
`NODE_ENV`, so setting `NODE_ENV` after `express()` has already run is too late
([Phase 0 · 01 · chunk 03](../../phase-0-express-basics/01-what-express-is/03-what-express-delegates.md)).

In production the body is the generic status text — `Internal Server Error` — and
nothing else. Which is safe, and also useless to a client: no error code, no
request id, nothing to quote in a support ticket. **That is the argument for
always defining your own handler**, not the stack leak.

## The two behaviours nobody expects

**1 · It destroys the socket if the response has already started.**

```js
if (res.headersSent) {
  debug('cannot %d after headers sent', status)
  if (req.socket) req.socket.destroy()
  return
}
```

Not `res.end()`, not a graceful close — `socket.destroy()`. That is deliberate
and correct: a partially-written response that ends *cleanly* is worse than a
broken connection, because a client will parse it as complete. Destroying the
socket makes the client see a transport error.

This is exactly what `if (res.headersSent) return next(err)` in your own handler
delegates to
([Phase 2 · 03 · chunk 03](../../phase-2-middleware/03-next-semantics/03-double-send-and-guards.md)).

**2 · It calls `onerror`, which is how the stack reaches your console.**

```js
if (err && onerror) setImmediate(onerror, err, req, res)
```

Express passes its own `logerror`, which is three lines:

```js
// express/lib/application.js
function logerror(err) {
  if (this.get('env') !== 'test') console.error(err.stack || err.toString());
}
```

So **unhandled errors are `console.error`'d, unless `env` is `'test'`** — that is
the origin of stack traces appearing in your terminal that no logger of yours
produced. It is scheduled with `setImmediate`, so it happens after the response.

There is also a **404 guard worth knowing**: `if (!err && res.headersSent) return`
— finalhandler declines to 404 a response that has already started, and returns
silently.

## When the default handler is enough

Almost never for an API, and that is a design decision rather than a criticism:

| | Default handler | Your handler |
|---|---|---|
| Status | from `err.status` in 400–599, else `res.statusCode`, else 500 | whatever you map |
| Body (production) | the bare status text | your envelope, with a code and a request id |
| Body (development) | **the full stack trace** | your choice |
| Logging | `console.error` of the stack | structured, with the request id |
| `err.headers` | copied, if the status was valid | yours to decide |
| Half-sent response | socket destroyed | delegate with `next(err)` |

The one thing it does better than a naive custom handler: **it never tries to
write on top of a started response.** Any handler you write must reproduce that
guard.

## Gotchas

**Symptom:** A stack trace appears in the HTTP response body
**Cause:** `env` is not `'production'` and no custom error handler is defined, so
the default handler sends `err.stack`
**Fix:** Define your own error handler, and set `NODE_ENV=production` **in the
environment before the process starts** — `env` is read once at `app.init()`

**Symptom:** `err.status = '404'` produces a 500
**Cause:** `getErrorStatusCode` requires a **number**; a string is ignored
**Fix:** Set numeric statuses. Watch for statuses copied out of an upstream JSON
response, which arrive as numbers or strings depending on the source

**Symptom:** An error produces 422 and nobody wrote that mapping
**Cause:** The handler had already called `res.status(422)` for the success path;
with no valid `err.status`, finalhandler falls back to `res.statusCode`
**Fix:** Set the status at the moment you write, not earlier

**Symptom:** A 503's `Retry-After` is missing
**Cause:** `err.headers` is only copied when the error also supplied a status in
400–599
**Fix:** Set both `status` and `headers` on the error

**Symptom:** Stack traces in the terminal that your logger did not emit
**Cause:** Express's `logerror` `console.error`s every error that reaches the
default handler, unless `env` is `'test'`
**Fix:** Expected. If you want structured logs only, handle the error yourself so
it never reaches finalhandler

**Symptom:** A client reports "connection reset" instead of an error response
**Cause:** The error was raised after the response started, and finalhandler
destroyed the socket
**Fix:** Correct behaviour — a truncated body that ends cleanly would be parsed as
complete

## Interview questions

**★ What answers a request when you define no error handler?**
`finalhandler`, a separate package Express installs as the router's callback in
`app.handle`. The same function produces every 404, distinguished only by whether
an error was passed — which is why a 404 never reaches four-argument middleware.

**★ How does the default handler choose a status?**
`err.status` if it is a **number** in 400–599, then `err.statusCode` on the same
terms; otherwise the response's own `res.statusCode`, defaulted to 500 if that is
outside 400–599. A string status or a 3xx is ignored.

**★ What is in the response body?**
In production, the generic status text. In anything else — including an unset
`NODE_ENV` — **the full `err.stack`**. That is the leak, and it is why an explicit
handler matters even before you care about the envelope.

**★ What does the default handler do when the response has already started?**
`req.socket.destroy()`. Not a graceful end — deliberately, because a truncated
body that ends cleanly would be parsed as a complete response. Forwarding with
`if (res.headersSent) return next(err)` is how you reach that behaviour from your
own handler.

**Where do the stack traces in your terminal come from?**
Express passes `logerror` to finalhandler as its `onerror` callback, and it
`console.error`s `err.stack` unless `env` is `'test'`. It is scheduled with
`setImmediate`, so it runs after the response.

**Why does an error with `headers` sometimes not set them?**
`getErrorHeaders` is only consulted when `getErrorStatusCode` returned a valid
status. An error with headers but no numeric 400–599 status gets neither.

---

← Prev: [Arity and placement](01-arity-and-placement.md) · Index: [Error middleware](README.md) · Next → [Designing the handler](03-designing-the-handler.md)
