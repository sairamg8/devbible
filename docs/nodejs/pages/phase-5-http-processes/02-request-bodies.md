---
title: "Request bodies are streams"
sidebar_label: "02 · Request bodies"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**There is no `req.body`. `req` is a readable stream that arrives in chunks over
the network, and an unbounded read of it is a denial-of-service vector you wrote
yourself.**

Every body parser — `express.json()`, `@fastify/formbody`, `busboy` — is the
twenty lines below plus content-type dispatch.

## Reading one

```js
// count.mjs
const server = createServer(async (req, res) => {
  let n = 0, chunks = 0;
  for await (const chunk of req) { n += chunk.length; chunks++; }
  console.log(`content-length=${req.headers['content-length']} read=${n} bytes in ${chunks} chunks`);
  res.end('ok');
});
```

```console
$ node count.mjs             # client POSTs 3 MB
/count  content-length=3000000 actually read=3000000 bytes in 49 chunks
/count  GET ->  content-length=undefined actually read=0 bytes in 0 chunks
```

Three facts in that output. The body arrives in **49 chunks**, not one — anything
that regex-matches a single chunk is broken ([Phase 3, page
13](../phase-3-buffers-streams/13-transform-streams.md)). Chunks are **Buffers**,
so `chunks.join('')` corrupts multi-byte UTF-8; concat then decode. And a body-less
GET is still a valid stream that ends immediately, so the loop is always safe.

## The size limit is the point

`Content-Length` is a claim by the client, not a measurement. Enforce **mid-stream**:

```js
// limit2.mjs — note the order of the last three statements
async function readLimited(req, res, limit) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      res.writeHead(413, { Connection: 'close' });
      res.end('Payload too large');
      req.destroy();                  // stop reading only AFTER the reply is queued
      return null;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
```

```console
$ node limit2.mjs
small -> 200 got 100 bytes
server: refused, replied 413 then destroyed
big   -> 413 Payload too large
```

Destroy **after** responding. The obvious-looking version — throw a `413` error,
destroy the request, let the catch block write the status — loses the race:

```console
$ node body.mjs               # req.destroy() before res.end()
/limit  rejected: Payload too large | statusCode 413
/limit  large -> client threw: UND_ERR_SOCKET
```

The server believes it sent a 413. The client got a dead socket and will retry,
because a transport error looks retryable and a 413 does not. That is how a
too-large upload turns into a hot loop.

Checking `Content-Length` up front is a cheap *addition*, never the whole
defence — a chunked request has no `Content-Length` at all:

```js
const declared = Number(req.headers['content-length']);
if (declared > LIMIT) { res.writeHead(413).end(); return; }   // fast path only
```

## Parsing by content type

```js
import { text as readText } from 'node:stream/consumers';

async function parseBody(req, res, limit = 1e6) {
  const raw = await readLimited(req, res, limit);
  if (raw === null) return null;                       // already answered 413
  const type = (req.headers['content-type'] ?? '').split(';')[0].trim();
  switch (type) {
    case 'application/json':
      try { return JSON.parse(raw.toString('utf8')); }
      catch { throw Object.assign(new Error('Invalid JSON'), { statusCode: 400 }); }
    case 'application/x-www-form-urlencoded':
      return Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
    case 'text/plain':
      return raw.toString('utf8');
    default:
      throw Object.assign(new Error(`Unsupported type ${type}`), { statusCode: 415 });
  }
}
```

`node:stream/consumers` exports `text`, `json`, `buffer`, `arrayBuffer` and
`blob`, which collapse the loop to `await json(req)` — convenient, and
**unbounded**. Use them for trusted internal callers only.

Splitting on `;` is load-bearing: the real header is
`application/json; charset=utf-8`, and an equality check against
`'application/json'` fails on it.

## Large bodies never become one Buffer

Uploads go straight to their destination. Buffering a 2 GB file costs 2 GB of RSS
per concurrent request:

```js
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';

await pipeline(req, limitTo(25e6), createWriteStream(tmpPath));
```

The counting transform, the temp-file-then-rename publish and the traversal check
on the destination are [Phase 3, page 10](../phase-3-buffers-streams/10-pipeline.md)
and [Phase 4, page 10](../phase-4-filesystem/10-atomic-writes-and-temp-files.md).
Multipart form parsing is genuinely hard — boundary framing, filename sanitising,
per-part limits — and is the one place here to take a library (`busboy`).

## Bodies you do not read still cost you

```console
$ node body.mjs
/ignore -> 200 ignored
```

Responding without consuming the body works, but the unread bytes sit in the
socket buffer and the connection cannot be reused for keep-alive. On a rejection
path, either drain (`req.resume()`) or destroy — do not just return.

## Gotchas

**Symptom:** `req.body` is `undefined`
**Cause:** Core Node has no body parser.
**Fix:** Read the stream, or mount `express.json()`.

**Symptom:** Clients retry aggressively against an endpoint that is correctly
rejecting oversized uploads
**Cause:** `req.destroy()` ran before the 413 was written, so they see a socket
error rather than a status.
**Fix:** Respond first, destroy second.

**Symptom:** JSON with non-ASCII characters fails to parse intermittently
**Cause:** Chunks were decoded individually, splitting a multi-byte sequence.
**Fix:** `Buffer.concat(chunks).toString('utf8')`, or a `StringDecoder`
([Phase 3, page 05](../phase-3-buffers-streams/05-string-decoder.md)).

**Symptom:** RSS spikes to gigabytes under upload load
**Cause:** The body is buffered before being written out.
**Fix:** `pipeline(req, …, destination)`.

**Symptom:** `Unsupported type` on a request that clearly sends JSON
**Cause:** The header is `application/json; charset=utf-8` and was compared whole.
**Fix:** Split on `;` before comparing.

**Symptom:** A second request on the same connection is slow or dropped
**Cause:** The previous body was never consumed.
**Fix:** `req.resume()` on early-return paths.

## Interview questions

**★ Why is there no `req.body` in Node?**
Because the body has not arrived yet. `req` is a readable stream and the handler
runs as soon as the *headers* are parsed. A parser has to buffer or pipe the
chunks itself, which is exactly what body-parsing middleware does.

**★ How do you size-limit an upload, and why is `Content-Length` not enough?**
Count bytes as they arrive and reject when the running total crosses the limit.
`Content-Length` is client-supplied and absent entirely on chunked transfers, so
it is a cheap early rejection, never the enforcement point.

**★ You reject oversized bodies with 413 and clients hammer you anyway. Why?**
The request was destroyed before the response was flushed, so clients see a
transport error instead of a status. Transport errors are retryable by default;
413 is not. Write the response, then destroy.

**★ Why can't you `join()` the chunks into a string?**
Chunks are Buffers split at arbitrary byte offsets. A UTF-8 character can straddle
two of them, so decoding each chunk separately produces replacement characters.
Concatenate the Buffers, then decode once.

**What happens if a handler responds without reading the body?**
The response is delivered, but the unread bytes remain in the socket buffer and
block keep-alive reuse. Drain with `req.resume()` or destroy the request.

**When would you use `stream/consumers`' `json(req)`?**
When the caller is trusted and the payload is known-small — an internal service,
a webhook you rate-limit ahead of. It has no size limit, so it is wrong for
anything public.

---

← Prev: [The HTTP server](01-http-server.md) · Next → [HTTP in practice](03-http-fundamentals.md)
