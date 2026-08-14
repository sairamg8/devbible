---
title: "raw and text parsers"
sidebar_label: "06 · raw · text"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

**JSON parsing destroys the exact bytes. Webhooks that HMAC the body need
`express.raw` (or equivalent) before any JSON middleware consumes the stream.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> [`express.raw`](https://expressjs.com/en/5x/api/express/) *"parses incoming request
> payloads into a `Buffer`"* and defaults to `type` **`"application/octet-stream"`**,
> `limit` `"100kb"`; `express.text` parses into a string with `type` **`"text/plain"`**.
> Both default `type` values matter for webhooks: a provider sending
> `application/json` will **not** hit `express.raw` unless you widen `type` yourself.
> The ordering argument follows from the documented content-type gate — whichever parser
> matches first consumes the stream, and the parsed body is what survives.

## raw → Buffer

```js
// raw.mjs
import express from 'express';

const app = express();
app.post(
  '/hook',
  express.raw({type: '*/*', limit: '1mb'}),
  (req, res) => {
    res.json({
      isBuffer: Buffer.isBuffer(req.body),
      len: req.body.length,
    });
  },
);

const server = app.listen(0, async () => {
  const {port} = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/hook`, {
    method: 'POST',
    body: 'payload-bytes',
  });
  console.log(await res.json());
  server.close();
});
```

```console
$ node raw.mjs
{ isBuffer: true, len: 13 }
```

Verify signatures on `req.body` (Buffer), then `JSON.parse` if needed. Phase 6
covers webhook verification product rules.

## text

`express.text()` yields a string — useful for plain-text endpoints. Still set
limits.

## Mount order death trap

```js
app.use(express.json()); // consumes body first
app.post('/hook', express.raw(), handler); // too late — empty/wrong body
```

Mount raw on the webhook path **before** global JSON, or exclude the path from
global JSON.

## Trade-off

Global JSON is ergonomic; webhooks need an exception. Prefer route-level raw on
`/webhooks/*` rather than disabling JSON everywhere.

## Gotchas

**Symptom:** HMAC never matches  
**Cause:** Body parsed as JSON and re-stringified  
**Fix:** raw bytes for verification

**Symptom:** `req.body` is `{}` on the hook  
**Cause:** JSON parser already ran  
**Fix:** Order / path-specific parser

## Interview questions

**★ Why do Stripe-style webhooks use raw body parsers?**  
Signatures are over the exact byte sequence, not a re-serialized object.

**Can you use both json and raw globally?**  
Only with careful path separation — first consumer wins the stream.

---

← Prev: [Malformed bodies](05-malformed-bodies.md) · Next → [Multipart uploads](07-multipart-uploads.md)
