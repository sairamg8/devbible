---
title: "node:http — the server"
sidebar_label: "01 · The HTTP server"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`http.createServer` hands you two streams and nothing else. `req` is a readable
stream of the request; `res` is a writable stream of the response. Every framework
you will use — Express, Fastify, Hono — is a router and a middleware chain sitting
on exactly this.**

```js
import { createServer } from 'node:http';

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('hello\n');
});

server.listen(3000, () => console.log('listening on', server.address()));
```

You will not ship raw `node:http` — you will ship Express. You learn this layer
because every production incident lands here: a timeout that is really
`headersTimeout`, a header set too late, a socket that never closed.

## The request object

```js
// echo.mjs — the fields you actually read
const server = createServer((req, res) => {
  console.log('method      :', req.method);       // always upper-case
  console.log('url         :', req.url);          // path + query ONLY, never absolute
  console.log('httpVersion :', req.httpVersion);
  console.log('headers.host:', req.headers.host);
  console.log('x-trace     :', JSON.stringify(req.headers['x-trace']));
  console.log('distinct    :', JSON.stringify(req.headersDistinct['x-trace']));
  res.writeHead(201, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
});
```

```console
$ node echo.mjs      # client sent X-Trace twice, as separate header lines
method      : POST
url         : /echo?a=1
httpVersion : 1.1
headers.host: 127.0.0.1:36921
x-trace     : "one, two"
distinct    : ["one","two"]
status      : 201 Created
```

Four rules that surprise people:

| | |
|---|---|
| **Header names are lower-cased** | `req.headers['Content-Type']` is always `undefined`. Always index with lower case |
| **Duplicates are joined with `, `** | `req.headersDistinct` keeps them as an array; `req.rawHeaders` is the flat `[name, value, name, value]` list, case preserved |
| **`cookie` joins with `; `, `set-cookie` stays an array** | Two exceptions to the comma rule — see [page 04](04-cookies.md) |
| **`req.url` is not a URL** | It is the request *target*: `/echo?a=1`. There is no origin in it |

```js
// req.url needs a base before URL will touch it
const url = new URL(req.url, `http://${req.headers.host}`);
url.pathname;                    // '/echo'
url.searchParams.get('a');       // '1'
```

`req.headers.host` is attacker-controlled. Use it to parse, never to build a link
you email to someone — that is host-header injection. Behind a proxy, trust
`X-Forwarded-Host` only when the proxy is the one that set it.

## The response object

Headers go out with the first byte of the body, which makes ordering strict:

```js
res.statusCode = 201;
res.setHeader('Content-Type', 'application/json');
res.setHeaders(new Headers({ 'x-request-id': id }));   // Headers or Map, since v18.17
res.writeHead(201, { 'Content-Type': 'application/json' });  // status + headers in one call
res.write('partial ');           // ← headers are flushed HERE
res.end('body');                 // required; without it the client hangs
```

```console
$ node late.mjs
late setHeader: ERR_HTTP_HEADERS_SENT
```

`setHeader` after the headers are flushed throws `ERR_HTTP_HEADERS_SENT`. Guard
with `res.headersSent` in any error path that might run after a partial response.

| Call | Use it for |
|---|---|
| `res.statusCode = 404` | Setting status without writing anything yet |
| `res.writeHead(status, headers)` | Status + headers in one shot; returns `res`, so it chains |
| `res.setHeader(name, value)` | One header; value may be an array (multiple lines) |
| `res.flushHeaders()` | Send headers now, keep the body open — SSE, [page 10](10-streaming-and-sse.md) |
| `res.end([data])` | **Mandatory.** Ends the response and frees the socket |

`http.STATUS_CODES` maps numbers to reason phrases (`STATUS_CODES[418]` is
`"I'm a Teapot"`), which is handy for a generic error responder.

## The timeouts, and the one nobody knows about

```console
$ node srv.mjs
defaults: headersTimeout 60000 | requestTimeout 300000 | keepAliveTimeout 5000
```

| Property | Default | Kills a request that… |
|---|---|---|
| `headersTimeout` | 60 000 ms | takes too long to finish sending **headers** (slowloris) |
| `requestTimeout` | 300 000 ms | takes too long **in total**, headers plus body |
| `keepAliveTimeout` | 5 000 ms | is idle on a reused connection |
| `connectionsCheckingInterval` | **30 000 ms** | — this is how often the other two are *checked* |

That last row is the trap. Lowering `requestTimeout` to 2 s does nothing on its
own, because the sweep that enforces it runs every 30 s:

```js
const server = createServer(
  { requestTimeout: 2000, connectionsCheckingInterval: 500 },   // both, or neither works
  handler,
);
```

```console
$ node cllie3.mjs         # client declares Content-Length: 100, sends 10 bytes, stalls
   11 ms client: Content-Length: 100, sends 10 bytes, then stalls
 2512 ms client got: "HTTP/1.1 408 Request Timeout"
 2514 ms body stream error: ECONNRESET | bytes received 10
```

2512 ms — the timeout plus one check interval. With the defaults left alone, the
same stalled request occupies a socket for five minutes.

## A thrown handler does not become a 500

Node has no error handling. Nothing turns an exception into a response:

```console
$ node throw.mjs                # handler is `async`
unhandledRejection : sync boom
/sync -> client: client timed out — no response ever sent
unhandledRejection : async boom
/async -> client: client timed out — no response ever sent

$ node throw2.mjs               # handler is NOT async
uncaughtException: sync boom in a NON-async handler
```

Both shapes leave the client hanging until *its* timeout. The difference only
changes which process-level event fires — and an `async` handler routes even a
synchronous `throw` to `unhandledRejection`
([Phase 2](../phase-2-async/15-unhandled-rejections.md)).

```js
// the wrapper every framework is hiding from you
const handle = (fn) => (req, res) => {
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error({ err, url: req.url }, 'request failed');
    if (res.headersSent) return res.destroy();      // too late to send a status
    res.writeHead(err.statusCode ?? 500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  });
};
```

`res.destroy()` is the only honest option once bytes have gone out: the client
sees a truncated response, which is at least distinguishable from a complete one.

## Malformed requests never reach your handler

```js
server.on('clientError', (err, socket) => {
  if (err.code === 'ECONNRESET' || !socket.writable) return;
  socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
});
```

A bad request line or illegal header is a parser error, so there is no `req` and
no `res` — only a socket. Without this listener Node closes the connection
silently and you never learn it happened.

## Gotchas

**Symptom:** The client hangs forever; the server logs nothing
**Cause:** A code path that never calls `res.end()` — usually an early `return`
after `res.setHeader`, or a thrown error.
**Fix:** Wrap the handler as above. Every branch ends the response.

**Symptom:** `ERR_HTTP_HEADERS_SENT` in the error handler
**Cause:** The response was already partly written when the error was thrown.
**Fix:** Check `res.headersSent`; `destroy()` rather than trying to write a status.

**Symptom:** `req.headers['Content-Type']` is `undefined` but the header is there
**Cause:** Node lower-cases every incoming header name.
**Fix:** `req.headers['content-type']`.

**Symptom:** `new URL(req.url)` throws `ERR_INVALID_URL`
**Cause:** `req.url` is a path, not an absolute URL.
**Fix:** ``new URL(req.url, `http://${req.headers.host}`)``.

**Symptom:** Slow clients hold sockets for minutes; a short `requestTimeout` was
set and changed nothing
**Cause:** `connectionsCheckingInterval` still defaults to 30 s.
**Fix:** Set both in the `createServer` options object.

**Symptom:** Load balancer returns 502 intermittently under keep-alive
**Cause:** Node's `keepAliveTimeout` (5 s) is shorter than the proxy's, so the
proxy reuses a connection Node just closed.
**Fix:** Raise `server.keepAliveTimeout` above the proxy's idle timeout — see
[page 14](14-http2.md) and Phase 11.

## Interview questions

**★ What are `req` and `res`, precisely?**
`req` is an `http.IncomingMessage` — a readable stream carrying the body, with
the method, target and headers parsed onto it. `res` is an
`http.ServerResponse` — a writable stream that emits a status line and headers
before the first body byte. Everything else is framework.

**★ Why does a thrown error in a handler not produce a 500?**
Because nothing is catching it. `node:http` invokes your callback and has no
concept of an error response. The exception escapes to `uncaughtException` (sync
handler) or `unhandledRejection` (async handler), the socket is never written to,
and the client waits until it times out.

**★ You lowered `requestTimeout` and slow requests still hold sockets. Why?**
The timeouts are enforced by a periodic sweep whose interval,
`connectionsCheckingInterval`, defaults to 30 000 ms. A 2 s `requestTimeout` is
not observed until the next sweep. Both must be set together.

**★ A client sends the same header twice. What does `req.headers` show?**
The values joined with `, ` — except `cookie`, which joins with `; `, and
`set-cookie`, which is always an array. `req.headersDistinct` gives every header
as an array, and `req.rawHeaders` preserves the original case and order.

**What is `keepAliveTimeout` and why does it cause 502s?**
It is how long Node holds an idle connection open for reuse — 5 s by default. If
an upstream proxy's idle timeout is longer, the proxy will send a request on a
connection Node is closing at that instant, and the race surfaces as a 502.

**When does `clientError` fire instead of your handler?**
When the HTTP parser rejects the bytes — a malformed request line, an illegal
header, a bad chunk. There is no request object to hand you, so you get the raw
socket and must write the status line yourself.

---

← Phase index: [Networking, HTTP, processes](README.md) · Next → [Request bodies](02-request-bodies.md)
