---
title: "Streaming responses and SSE"
sidebar_label: "10 · Streaming and SSE"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**A response does not have to be built before it is sent. Omit `Content-Length`
and Node switches to chunked transfer encoding, so the first byte reaches the
client while you are still producing the rest — the difference between a 30-second
export that times out and one that starts downloading immediately.**

## Chunked happens automatically

```js
res.writeHead(200, { 'Content-Type': 'text/plain' });
await pipeline(source, res);                       // res is a writable stream
```

```console
$ node sse.mjs
  196 ms chunked: content-length set? no
  200 ms chunked headers: transfer-encoding = chunked
```

Node sets `Transfer-Encoding: chunked` the moment you write without having
declared a length. You never write chunk framing yourself.

`res` is an ordinary writable stream, so everything from
[Phase 3](../phase-3-buffers-streams/10-pipeline.md) applies — including
backpressure. Streaming a database cursor straight to the response means a slow
client slows the query rather than filling your heap:

```js
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

res.writeHead(200, { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="orders.csv"' });
await pipeline(
  db.query('SELECT id, total, created_at FROM orders').stream(),
  new Transform({ objectMode: true, transform(row, _e, cb) { cb(null, `${row.id},${row.total},${row.created_at}\n`); } }),
  res,
);
```

Use `pipeline`, never `.pipe()` — a client that disconnects mid-download leaves
`.pipe()` with both ends open and the query still running
([Phase 3, page 10](../phase-3-buffers-streams/10-pipeline.md)).

Two consequences of streaming that people meet the hard way. **You cannot change
your mind about the status**: once the first chunk is out, a failure halfway can
only truncate the response, so a 200 that ends early is indistinguishable from a
complete one unless your format has a terminator. And **`Content-Length` is
unknown**, so browsers show no progress bar and no download size.

## Server-Sent Events

SSE is one long-lived chunked response with a defined text format. One direction,
server to client, over plain HTTP — no new protocol, no upgrade, and it survives
every proxy that speaks HTTP/1.1.

```js
res.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',                 // stop Nginx buffering the stream
});
res.flushHeaders();                          // send headers now, keep the body open

res.write(`id: ${id}\nevent: tick\ndata: ${JSON.stringify(payload)}\n\n`);
```

```console
$ node sse2.mjs
   41 ms client: headers 200 | transfer-encoding: chunked
  183 ms server: wrote id 1 (write returned true, destroyed=false)
  186 ms client frame -> ["id: 1","event: tick","data: {\"id\":1}"]
  334 ms server: wrote id 2 (write returned true, destroyed=false)
  335 ms client frame -> ["id: 2","event: tick","data: {\"id\":2}"]
  485 ms server: wrote id 3 (write returned true, destroyed=false)
  487 ms server: 'close' (writableEnded=true)
  490 ms client: stream ended
```

The format is four fields and a blank line:

| Field | Effect |
|---|---|
| `data:` | The payload. Repeat the field for multiple lines — they are joined with `\n` |
| `event:` | Names the event, so the browser fires `es.addEventListener('tick', …)` |
| `id:` | Stored by the browser and replayed as the `Last-Event-ID` **request header** on reconnect |
| `retry:` | Reconnect delay in ms |
| `: comment` | Ignored — the standard keep-alive ping |

**Two newlines terminate a frame.** A `data:` payload containing a raw newline
splits the message; `JSON.stringify` output never does, which is the practical
reason to always send JSON.

The browser API is three lines and it reconnects on its own:

```js
const es = new EventSource('/events');
es.addEventListener('tick', (e) => render(JSON.parse(e.data)));
es.onerror = () => {/* EventSource is already retrying */};
```

Resumption is the part worth implementing. On reconnect the browser sends the
last `id` it saw:

```js
let cursor = Number(req.headers['last-event-id'] ?? 0);
```

Without that, every reconnect either replays everything or drops whatever happened
while the connection was down.

## Clean-up is the whole job

```console
$ node sseabort.mjs
  134 ms client got: "data: 1"
  232 ms client got: "data: 2"
  332 ms client got: "data: 3"
  362 ms client: AbortError
  366 ms server: 'close' after 3 events — interval cleared, leaked timers: 0
```

`res.on('close')` fires whether the response ended normally or the client vanished.
**Every per-connection resource must be released there** — the interval, the
database cursor, the subscription, the entry in your connection registry. A
forgotten `setInterval` per connection is a leak that only shows up under real
traffic, because in development you close the tab and never look again.

Also send a comment line every 15–30 s. Idle connections are reaped by proxies
and NAT devices, and a keep-alive ping is what keeps the stream alive and tells you
promptly that the client is gone.

## Gotchas

**Symptom:** SSE works locally, delivers nothing through Nginx
**Cause:** Proxy buffering — the events sit in the proxy's buffer.
**Fix:** `X-Accel-Buffering: no` and `proxy_buffering off;`. Also
`Cache-Control: no-transform`, since a transforming proxy may try to gzip it.

**Symptom:** Events arrive in bursts instead of immediately
**Cause:** Compression middleware buffering to fill a block.
**Fix:** Exclude `text/event-stream` from compression, or flush per event.

**Symptom:** Memory grows in proportion to connections ever opened
**Cause:** No `res.on('close')` cleanup — timers and registry entries outlive the
connection.
**Fix:** Release everything in `close`.

**Symptom:** A client reconnects and misses events
**Cause:** `id:` not sent, or `Last-Event-ID` not honoured.
**Fix:** Emit a monotonic id and resume from the header.

**Symptom:** A truncated download looks like a successful one
**Cause:** The failure happened after headers were sent.
**Fix:** Nothing at the HTTP level — put a terminator in the payload format, or
use trailers.

**Symptom:** The query keeps running after the user cancels a download
**Cause:** `.pipe()` does not propagate the destination's destruction.
**Fix:** `pipeline`.

## Interview questions

**★ How does a response become chunked?**
By writing without a `Content-Length`. Node then sets `Transfer-Encoding: chunked`
and frames each write, so bytes reach the client before the body is complete.

**★ SSE or WebSockets?**
SSE if the data flows one way — notifications, progress, live dashboards, token
streaming. It is plain HTTP, so proxies, auth cookies and compression all work
unchanged, and the browser reconnects for you with resumption built in. WebSockets
when the client must send frequently too ([page 11](11-websockets.md)).

**★ What does `id:` do in an SSE stream?**
The browser remembers the last id and sends it as the `Last-Event-ID` header when
it reconnects, so the server can resume from that point instead of replaying or
skipping. It is the only reason SSE reconnection is actually useful.

**★ Why does an SSE endpoint leak memory?**
Per-connection resources — intervals, subscriptions, cursors — created when the
stream opens and never released. `res.on('close')` fires on both normal end and
client disconnect and is where they must be torn down.

**Why is streaming a large export better than building it in memory?**
Peak memory becomes one chunk instead of the whole result, backpressure ties the
producer to the client's speed, and time-to-first-byte drops from the full
generation time to almost nothing — which is often what keeps a proxy from timing
the request out.

**What breaks SSE in production but never in development?**
An intermediary that buffers: Nginx's `proxy_buffering`, a CDN, or compression
middleware. Locally there is no intermediary, so it always works.

---

← Prev: [HTTPS and TLS](09-https-and-tls.md) · Next → [WebSockets](11-websockets.md)
