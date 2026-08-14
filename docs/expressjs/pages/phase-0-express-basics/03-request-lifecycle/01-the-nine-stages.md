---
title: "The nine stages"
sidebar_label: "01 · The nine stages"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Every request walks one path: socket → parsed headers → the app stack → a
handler → a response. Knowing which stage you are in tells you which object can
still help you.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. **The console block
> below is re-used unchanged from the earlier authorised `sandbox/express-verify`
> run and is sandbox-measured** — nothing was executed for this rewrite. Stage
> boundaries are from the Node
> [HTTP documentation](https://nodejs.org/api/http.html) (`'request'`,
> `'finish'`, `'close'`, `res.writableEnded`, `res.headersSent`) and from the
> installed `express@5.2.1` / `router@2.2.0` source in
> `sandbox/express-verify/node_modules/`, cited by function.

## The map

Nine stages. Express owns four of them; the other five are Node's, and every
"Express is doing something weird" question that survives Phase 0 is really a
question about one of Node's.

| # | Stage | Owner | What exists yet |
|---|---|---|---|
| 1 | TCP connection accepted | `net`/`http.Server` | a socket |
| 2 | Request line + headers parsed | `http` | `req.method`, `req.url`, `req.headers` |
| 3 | `'request'` emitted → the listener is called | `http` | `req` as an unread stream, `res` unwritten |
| 4 | `app.handle` prepares the request | **Express** | prototypes re-parented, `res.locals`, `finalhandler` chosen |
| 5 | `router.handle` walks the stack | **the router** | `req.baseUrl`, `req.originalUrl`, `req.params` per layer |
| 6 | Body-parsing middleware reads the stream | **`body-parser`** | `req.body` — and **only now** |
| 7 | The matched handler runs | **you** | everything |
| 8 | A response is written and ended | **Express + Node** | headers flushed on first write |
| 9 | `'finish'`, then `'close'` | `http` | the socket is reused or closed |

🔴 **Stage 3 is the one people mis-model.** Node emits `'request'` as soon as the
**headers** are complete. The body may still be arriving — or may never arrive.
So your first middleware runs while the request is, in the literal sense,
unfinished. That is why body parsing is a middleware and not something that
happened before Express was called, and it is why a body-size limit can only be
enforced *while reading*, never up front
([Phase 3 · 03](../../phase-3-requests/03-size-limits.md)).

There is no parallel "Express event loop". It is still Node's single JS thread;
Express is synchronous scheduling of your functions on it until one of them
awaits.

## Stage by stage, with what can go wrong

**1–2 · Socket and parse.** Nothing of yours runs. A malformed request line, a
header block over `--max-http-header-size`, or a client slower than
`server.headersTimeout` is rejected here, by Node, with no Express involvement.
Those are the failures you cannot log from a middleware, because no middleware
ran — and the reason a "we log every request" claim is never quite true.

**3 · The listener is called.** `app(req, res)`. Everything from here is
`app.handle` ([topic 02 ·
chunk 02](../02-app-router-server/02-a-router-is-a-function-too.md) has the
source).

**4 · Express prepares the request.** `finalhandler` is chosen, `X-Powered-By` is
set, `req`/`res` prototypes are re-parented, `res.locals` is created. This is the
last moment before *your* code, and nothing here can fail in an interesting way.

**5 · The router walks its stack.** Registration order, forward only.
`req.originalUrl` is fixed here, once. Each mounted layer rewrites `req.url`.
[Topic 02 · chunk 03](../02-app-router-server/03-inside-router-handle.md) is the
whole walk.

**6 · The body is read — if something reads it.** `express.json()` and friends
consume the stream, respecting `limit`, `inflate` and the content-type gate. If
no parser matched, **`req.body` is `undefined`** in Express 5 (Express 4 gave
`{}`), and the stream is still sitting there unread.

**7 · Your handler runs.** How Express invokes it — the arity gates, the
`try`/`catch`, the returned-promise hook — is
[chunk 02](02-how-a-handler-is-invoked.md), and it is worth reading before you
write another `async` handler.

**8 · The response is written.** `res.json` → `res.send` → `res.end`. **Headers
are flushed on the first write**, which is why `res.status()` after `res.send()`
does nothing and why `res.headersSent` is the guard every error handler needs.

**9 · `'finish'` then `'close'`.** `'finish'` means the last byte was handed to
the OS; `'close'` means the underlying connection is done, and it fires whether
the response completed or the client vanished mid-stream. Both are Node events on
`res`, not Express ones.

## Minimal map

```js
// lifecycle.mjs
import express from 'express';

const app = express();

app.use((req, res, next) => {
  console.log('1 middleware', req.method, req.url);
  next();
});

app.get('/ok', (req, res) => {
  console.log('2 handler');
  res.status(200).json({ok: true});
});

app.use((req, res) => {
  console.log('3 404');
  res.status(404).json({error: 'not found'});
});

app.use((err, req, res, next) => {
  console.log('4 error', err.message);
  res.status(500).json({error: err.message});
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;
  console.log('status', (await fetch(`${base}/ok`)).status);
  console.log('status', (await fetch(`${base}/missing`)).status);
  server.close();
});
```

```console
$ node lifecycle.mjs
1 middleware GET /ok
2 handler
status 200
1 middleware GET /missing
3 404
status 404
```

Read the output for what is **absent**: the four-argument handler never ran, for
either request. A 404 is not an error, so nothing was forwarded to it — the walk
simply reached a middleware that responded.

## Where to hook, and what each hook can still do

Because stages 8 and 9 are Node's, the observability hooks are Node events, and
which one you pick determines what is still available:

| Hook | Fires when | `res.statusCode` | Can you still write? |
|---|---|---|---|
| top of the stack | stage 5 | not yet decided | yes |
| `res.on('finish')` | the response completed | **final** | no |
| `res.on('close')` | the connection ended, **completed or not** | final or partial | no |
| `req.on('aborted')` *(deprecated in Node 16+)* | client went away mid-body | — | no |

- **Access logging belongs on `'finish'`** — it is the only place the real status
  code is known. Logging at the top of the stack records intent, not outcome.
- **`'close'` fires even when the client disconnected**, so
  `res.writableEnded === false` inside a `'close'` handler is how you distinguish
  "client gave up" from "we answered". This is the honest way to measure
  abandoned requests.
- **Neither hook can cancel anything.** The handler is still running, the query
  still holds its pooled connection. Nothing in Express or Node aborts work on
  disconnect — [Phase 9 ·
  06](../../phase-9-hardening/06-timeouts-and-secrets.md).

## Gotchas

**Symptom:** A request appears in the access log with status 200 but the client
got nothing
**Cause:** The log was written at the top of the stack, before the status existed;
`res.statusCode` defaults to 200
**Fix:** Log on `res.on('finish')`, where the status is final

**Symptom:** `req.body` is `undefined` in the very first middleware
**Cause:** The listener is called when the **headers** are parsed; the body has
not been read, and will not be until a parser middleware reads it
**Fix:** Mount `express.json()` above anything that needs a body — and remember a
mismatched `Content-Type` leaves it `undefined` rather than erroring
([Phase 3 · 02](../../phase-3-requests/02-json-and-urlencoded/01-the-four-gates.md))

**Symptom:** `res.status(404)` after `res.send(...)` has no effect and no error
**Cause:** Headers were flushed on the first write; the status line is already on
the wire
**Fix:** Decide the status before writing. In an error handler, guard with
`if (res.headersSent) return next(err)` — the documented pattern

**Symptom:** Some malformed requests never appear in your logs at all
**Cause:** They failed at stage 1–2, in Node's parser, before the request
listener was ever called
**Fix:** Accept it, and look at the proxy's logs. No Express middleware can see
a request Node rejected

**Symptom:** A handler keeps running and burning a database connection after the
user closed the tab
**Cause:** `'close'` is a notification, not a cancellation. Nothing unwinds an
in-flight `await`
**Fix:** Cancel at the resource — statement timeouts, `AbortSignal` — not at the
HTTP layer

## Interview questions

**★ Walk me through a `GET /users` from socket to response.**
Node accepts the connection and parses the request line and headers, then emits
`'request'` and calls the app. `app.handle` picks a final handler, re-parents the
`req`/`res` prototypes and calls the router. The router walks its stack in
registration order; middleware runs, a matching route's handlers run, one of them
writes a response. Headers flush on the first write; `'finish'` fires when the
last byte is out.

**★ At what point does `req.body` exist?**
Only after a body-parsing middleware has read the stream — stage 6. The request
listener is called as soon as the headers are parsed, so in the first middleware
the body has not arrived and `req.body` is `undefined`.

**★ Where do you put access logging, and why not at the top?**
On `res.on('finish')`. At the top of the stack the status code has not been
decided — `res.statusCode` is still its default 200 — so a top-of-stack log
records what you were asked, not what you did.

**★ Does Express handle two requests on two threads?**
No. One JS thread, Node's model. Concurrency comes from async I/O: while one
handler awaits, the loop runs another request's synchronous work.

**How do you tell "the client disconnected" from "we responded"?**
Listen on `res.on('close')` and check `res.writableEnded`. `'close'` fires in both
cases; `writableEnded` is only true if you finished writing.

**Why can't a middleware log every request that hits the process?**
Because requests can fail in Node's parser — bad request line, oversized headers,
`headersTimeout` — before the request listener is ever called. Nothing in Express
observes those.

---

Index: [Request lifecycle](README.md) · Next → [How a handler is invoked](02-how-a-handler-is-invoked.md)
