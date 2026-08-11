---
title: "node:http2"
sidebar_label: "14 · node:http2"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**HTTP/2 replaces one-request-per-connection with many concurrent streams over a
single TLS connection. In a typical deployment Nginx or an ALB terminates it and
talks HTTP/1.1 to Node, so `node:http2` matters mainly when Node is the edge, or
when it is the client of a gRPC-style service.**

## Multiplexing, measured

```console
$ node h2.mjs
   26 ms client: 5 requests, each 300 ms of server work, in parallel
   41 ms client: ALPN = "h2"
   44 ms server: HTTP/2 session #1 opened
  353 ms client: answered /a?ms=300
  353 ms client: answered /b?ms=300
  355 ms client: answered /c?ms=300
  355 ms client: answered /d?ms=300
  355 ms client: answered /e?ms=300
  355 ms all five done in 328 ms over 1 TCP connection(s)
```

Five requests, 300 ms of work each, **328 ms total over one TCP connection**.
Under HTTP/1.1 the same five either need five connections
([page 07](07-keep-alive-and-agents.md)) or queue on one.

What HTTP/2 adds over 1.1:

- **Streams.** Many interleaved request/response pairs per connection, each with
  its own id and flow-control window. This kills head-of-line blocking at the
  HTTP layer — though not at the TCP layer, which is what HTTP/3 over QUIC fixes.
- **HPACK header compression.** Repeated headers — cookies, auth, user-agent —
  cost a table reference instead of bytes per request.
- **Binary framing.** No text parsing, and no ambiguity of the kind that makes
  request smuggling possible in HTTP/1.1.
- **Server push.** Removed from browsers; do not design around it.

## The two server APIs

```js
import { createSecureServer } from 'node:http2';

const server = createSecureServer({ key, cert, allowHTTP1: true });

// compatibility API — req/res shaped like node:http, works for h2 AND h1
server.on('request', (req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end(`served over HTTP/${req.httpVersion}`);
});

// native API — full access to streams
server.on('stream', (stream, headers) => {
  stream.respond({ ':status': 200, 'content-type': 'text/plain' });
  stream.end(`answered ${headers[':path']}`);
});
```

**Register one or the other, not both** — with both, an h2 request reaches the
`stream` handler *and* the compat `request` handler, and the second call to
respond throws `ERR_HTTP2_HEADERS_SENT`. The compatibility API is what lets
Express run unchanged; the native API is what you use for anything stream-shaped.

`allowHTTP1: true` serves both protocols on one port, with **ALPN** choosing
during the TLS handshake. Browsers only speak HTTP/2 over TLS, so in practice h2
means HTTPS. Cleartext h2c exists (`createServer`) and is used between a proxy
and a backend on a trusted network.

Pseudo-headers replace the request line: `:method`, `:path`, `:scheme`,
`:authority` — the last replacing `Host`. Header names are lower-case by protocol
rule rather than by convention, and **HTTP/2 has no chunked transfer encoding**;
framing is inherent, so `Transfer-Encoding` is illegal and `Connection`-style
hop-by-hop headers are rejected outright.

## The client

```js
const client = connect('https://example.com', { ca });
const stream = client.request({ ':path': '/orders', ':method': 'GET' });
stream.setEncoding('utf8');
stream.on('data', append);
stream.on('end', () => { done(); client.close(); });
```

`connect` returns a long-lived **session**; every `request` on it is a stream.
That is the opposite of `fetch`'s model, and it means the session is a resource
you own — keep it, reuse it, close it on shutdown, and handle its `'error'` and
`'goaway'` events, because a session failure takes every in-flight stream with it.

Whether `fetch` uses HTTP/2 depends on which undici you are using:

```console
$ NODE_EXTRA_CA_CERTS=tls/ca.crt node h2global.mjs
built-in global fetch -> served over HTTP/1.1 (ALPN "http/1.1")

$ NODE_EXTRA_CA_CERTS=tls/ca.crt node h2alpn.mjs
undici default         -> served over 2.0 (ALPN "h2")
undici allowH2: true   -> served over 2.0 (ALPN "h2")
```

**Node 24's built-in `fetch` negotiates HTTP/1.1**, against a server offering
both. The npm `undici` 8.10.0 negotiated h2. If you need HTTP/2 from a client,
say so explicitly rather than relying on either default.

## When it actually matters

| Situation | Verdict |
|---|---|
| Node behind Nginx / an ALB | The proxy speaks h2 outward and h1 inward. Nothing to do |
| Node as the edge server, many small assets | Real win — one connection, compressed headers |
| gRPC, or an API that streams many concurrent responses | h2 is the transport; use it |
| Server-to-server with few, large requests | Little benefit; h1 with keep-alive is equivalent |
| Anything not over TLS in a browser | Not available |

One counter-intuitive property: because everything shares a connection, **packet
loss hurts more**. All streams stall on a lost TCP segment, where HTTP/1.1's
parallel connections would only stall one. That is TCP head-of-line blocking, and
it is the reason HTTP/3 moved to QUIC over UDP.

## Gotchas

**Symptom:** `ERR_HTTP2_HEADERS_SENT` from a handler that responds once
**Cause:** Both `stream` and `request` listeners are registered, so the response
is initiated twice.
**Fix:** Pick one API.

**Symptom:** A browser will not use HTTP/2 with your server
**Cause:** No TLS, or ALPN not advertising `h2`.
**Fix:** Serve over TLS with `createSecureServer`; check
`socket.alpnProtocol`.

**Symptom:** `Transfer-Encoding` or `Connection` headers rejected
**Cause:** They are illegal in HTTP/2.
**Fix:** Remove them; framing and connection management are the protocol's job.

**Symptom:** All in-flight requests fail at once
**Cause:** The session errored or received GOAWAY — one connection, everything on
it.
**Fix:** Handle `'error'` and `'goaway'`, and reconnect with backoff.

**Symptom:** HTTP/2 is slower than HTTP/1.1 on a lossy network
**Cause:** TCP head-of-line blocking across multiplexed streams.
**Fix:** Nothing at this layer — it is what HTTP/3 exists to solve.

**Symptom:** `fetch` does not use HTTP/2 even though the server supports it
**Cause:** Built-in `fetch` negotiates HTTP/1.1 on Node 24.
**Fix:** Use an undici dispatcher with `allowH2: true`, or `node:http2` directly.

## Interview questions

**★ What does HTTP/2 actually change?**
Multiple concurrent streams over one connection, binary framing instead of text,
and HPACK header compression. The practical effect: five 300 ms requests finished
in 328 ms over one TCP connection, where HTTP/1.1 would need five connections or
serialise them.

**★ Does HTTP/2 eliminate head-of-line blocking?**
Only at the HTTP layer. All streams still ride one TCP connection, so a lost
segment stalls every stream — sometimes making h2 worse than h1 on a lossy link.
Removing that is why HTTP/3 runs over QUIC on UDP.

**★ Should a Node service behind Nginx use `node:http2`?**
Usually not. The proxy terminates h2 from clients and speaks HTTP/1.1 with
keep-alive to Node, where the connection count is small and stable. The reasons to
use it directly are being the edge server, or speaking gRPC.

**★ Why can registering both `stream` and `request` handlers break a server?**
The compatibility layer emits `request` for the same stream, so both handlers
respond and the second throws `ERR_HTTP2_HEADERS_SENT`. Use the native API or the
compat API, not both.

**Why is HTTP/2 effectively HTTPS-only?**
Browsers only negotiate it over TLS, using ALPN during the handshake. Cleartext
h2c is legal and used between infrastructure components, but no browser will do it.

**What replaces the `Host` header in HTTP/2?**
The `:authority` pseudo-header, alongside `:method`, `:path` and `:scheme`. There
is no request line — the metadata is header fields in a binary frame.

---

← Prev: [node:dns](13-dns.md) · Next → [The process object](./15-process.md)
