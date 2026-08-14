---
title: "Two paths to 413"
sidebar_label: "01 · Two paths to 413"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**A body can be rejected before a byte is read, or partway through reading it.
Which one happens depends on whether the client sent a `Content-Length` — and a
compressed body can only ever take the second path.**

> Verified: 2026-08-14 against **`body-parser@2.3.0`** and **`raw-body`** in
> `sandbox/express-verify/node_modules/`, reading `readStream`'s up-front length
> check and its `onData` accumulator, and `body-parser`'s `contentstream`, by
> function. **Reading source is not a run.** The console block below **predates
> this pass and was not re-measured**; the earlier verification review lists it
> among the claims it checked by hand, and 413 with `entity.too.large` is what the
> source produces. Every parser documents `limit` with a default of `"100kb"`
> ([express reference](https://expressjs.com/en/5x/api/express.html)).

## The behaviour

```js
// limit.mjs
import express from 'express';

const app = express();
app.use(express.json({limit: '1kb'}));
app.post('/echo', (req, res) => res.json({ok: true}));
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({type: err.type, message: err.message});
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/echo`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({pad: 'x'.repeat(2000)}),
  });
  console.log(res.status, await res.json());
  server.close();
});
```

```console
$ node limit.mjs
413 { type: 'entity.too.large', message: 'request entity too large' }
```

## Path 1 — rejected before reading

```js
// raw-body/index.js — readStream(), before any data event
if (limit !== null && length !== null && length > limit) {
  return done(createError(413, 'request entity too large', {
    expected: length, length: length, limit: limit, type: 'entity.too.large'
  }))
}
```

When the client sent a `Content-Length` and it exceeds `limit`, **nothing is
read**. The 413 is decided from the headers alone, and the error carries
`expected`, `length` and `limit` — enough to tell the client exactly how far over
it was.

The source comment on that block is worth keeping: *"we intentionally leave the
stream paused, so users should handle the stream themselves."*

## Path 2 — rejected while reading

```js
// raw-body/index.js — onData()
received += chunk.length

if (limit !== null && received > limit) {
  done(createError(413, 'request entity too large', {
    limit: limit, received: received, type: 'entity.too.large'
  }))
}
```

When there is no usable `Content-Length` — a chunked body, or a compressed one —
the limit is enforced **as an accumulator**. Bytes are counted per chunk and the
request is failed the moment the total passes `limit`.

Note the error fields differ: this one has `received`, not `expected`. If your
error handler reports "you sent N bytes", read both and pick whichever is
present.

**The practical consequence:** a `Transfer-Encoding: chunked` client can always
make you read up to `limit` bytes before being refused. It cannot make you read
more. That bound is the whole protection.

## 🔴 Compression takes path 2, always

```js
// body-parser/lib/read.js — contentstream()
if (encoding === 'identity') {
  req.length = length          // ← the up-front check can run
  return req
}

const stream = createDecompressionStream(encoding, debug)
req.pipe(stream)               // ← req.length is NOT set
return stream
```

Read carefully: **`req.length` is only set for an uncompressed body.** For a
gzipped one, `raw-body` gets `length === null`, so the up-front check is skipped
and only the accumulator applies.

Two things follow, and both matter:

- **`limit` measures the *decompressed* size.** A 2 kb gzipped body that inflates
  to 50 MB is refused at your limit, not at 2 kb. That is the correct semantic —
  the limit protects your memory, and memory holds the decompressed bytes.
- **A compressed body cannot be refused from its headers.** The server must
  inflate up to `limit` bytes before deciding. So a "zip bomb" is **bounded** by
  `limit` — you will never hold more than that — but it does cost you the CPU of
  inflating that much, per request. That, not memory, is the reason to keep the
  limit modest on public endpoints, and to rate-limit alongside it
  ([Phase 9 · 04](../../phase-9-hardening/04-rate-limiting.md)).

If a route genuinely has no reason to accept compressed bodies, `inflate: false`
turns the whole question off with a **415 `encoding.unsupported`**.

## What happens to the connection afterwards

```js
// body-parser/lib/read.js — the error path
if (stream !== req) { req.unpipe(); stream.destroy() }

dump(req, function onfinished () { next(createError(400, _error)) })
```

**body-parser drains the rest of the request before forwarding the error.** That
is deliberate: on a keep-alive connection, an unread request body would corrupt
the next request on the same socket, so the remaining bytes are consumed and
discarded first. Where a decompression stream was involved it also unpipes and
destroys that stream.

The cost is that a client which keeps sending after the 413 keeps you reading —
which is another argument for the limit being modest, and for the proxy in front
having its own.

## The other errors from the same reader

| Status | `err.type` | When |
|---|---|---|
| **413** | `entity.too.large` | either path above |
| **400** | `request.aborted` (with `code: 'ECONNABORTED'`) | the client disconnected mid-body |
| **500** | `stream.encoding.set` | someone called `req.setEncoding()` before the parser |

That last one is a genuine developer error and the source labels it as such: a
body parser needs raw `Buffer` chunks, and setting an encoding on the request
stream first breaks it. If you see it, look for a middleware doing
`req.setEncoding('utf8')` above the parser.

## Gotchas

**Symptom:** A 413 arrives instantly for a big upload, and slowly for another
**Cause:** Two different paths — the first had a `Content-Length` over the limit
and was refused from headers; the second was chunked and had to be read up to the
limit first
**Fix:** Expected. If you report the size back, read both `expected` and
`received`, since only one is present in each case

**Symptom:** A small gzipped body is rejected as too large
**Cause:** `limit` applies to the **decompressed** size, and `req.length` is not
set for a compressed body so the up-front check never runs
**Fix:** That is the correct behaviour — the limit protects memory. Raise the
limit deliberately, or set `inflate: false` if the route should not take
compressed bodies at all

**Symptom:** After a 413, the next request on the same connection behaves oddly
**Cause:** Something responded without draining the request body
**Fix:** body-parser drains for you. If you write your own reader, consume the
remainder before responding, or destroy the socket

**Symptom:** `500 stream encoding should not be set`
**Cause:** A middleware called `req.setEncoding()` above the body parser
**Fix:** Remove it. The parser needs `Buffer` chunks

**Symptom:** `400 request aborted` fills the logs
**Cause:** Clients disconnecting mid-upload — mobile networks, page navigations
**Fix:** Usually not your bug. Do not alert on it; count it

## Interview questions

**★ What status means the body was too large, and what carries it?**
413, from `raw-body`, as an `http-errors` object with `type: 'entity.too.large'`.
Express's default error handler reads `err.status`, so you get the right status
without writing anything.

**★ There are two ways a 413 happens. What are they?**
Up front, when `Content-Length` exceeds `limit` — nothing is read at all — and
during reading, when the accumulated byte count passes `limit`. The first carries
`expected`/`length` on the error, the second carries `received`.

**★ Does `limit` apply to the compressed or decompressed size?**
Decompressed. `contentstream` only sets `req.length` for an `identity` encoding,
so a compressed body skips the up-front check entirely and is bounded by the
accumulator as it inflates. That bounds the memory a zip bomb can cost you, but
not the CPU of inflating up to the limit.

**★ Why does body-parser drain the request after an error?**
Because on a keep-alive connection an unread body would be interpreted as part of
the next request. It consumes and discards the remainder before forwarding the
error, and unpipes and destroys any decompression stream it created.

**What is `stream.encoding.set`?**
A 500 raised when something called `req.setEncoding()` before the parser ran. The
parser needs raw `Buffer` chunks; a decoded stream breaks byte counting and
signature verification alike.

**A chunked client sends an unbounded body. How much do you read?**
At most `limit` bytes. The accumulator fails the request on the first chunk that
takes the total past it, so the absence of a `Content-Length` costs you the limit
and nothing more.

---

Index: [Size limits](README.md) · Next → [Choosing and layering limits](02-choosing-and-layering.md)
