---
title: "Malformed bodies"
sidebar_label: "05 · Malformed bodies"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

**Bad JSON is a client error. Express surfaces it as an error with status 400
and a `type` — your error middleware should map it to a stable envelope, not a
stack trace.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> A parse failure is one of the documented outcomes of the body parsers — the body is
> `undefined` when *"an error occurred"*
> ([express reference](https://expressjs.com/en/5x/api/express/)) — and the error reaches
> your four-arg handler through the ordinary `next(err)` path
> ([error handling](https://expressjs.com/en/guide/error-handling.html)).
> The reason to map it yourself is documented too: Express's **default** handler writes
> `err.stack` in development and takes the status from `err.status`/`err.statusCode`, so
> leaving it unhandled is what leaks parse internals to clients.
> `strict: true` (the `express.json` default) is why only objects and arrays are accepted
> at the top level.

## Measured parse failure

```js
// malformed.mjs
import express from 'express';

const app = express();
app.use(express.json());
app.post('/echo', (req, res) => res.json(req.body));
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    type: err.type,
    message: err.message,
  });
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/echo`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: '{not json',
  });
  console.log(res.status, await res.json());
  server.close();
});
```

```console
$ node malformed.mjs
400 {
  type: 'entity.parse.failed',
  message: "Expected property name or '}' in JSON at position 1 (line 1 column 2)"
}
```

Do **not** leak raw parser messages to untrusted clients in production if they
reveal internals — map to `{code: 'BAD_JSON', message: 'Invalid JSON body'}`.

## Headers and charset

Odd `Content-Type` values can skip the parser (empty body) or fail parsing.
Normalize clients; reject unsupported types with 415 if your API is strict.

## Trade-off

Verbose parse errors help developers; production APIs should return stable codes.
Log the detailed message server-side with a request id.

## Gotchas

**Symptom:** HTML error page for bad JSON  
**Cause:** No error middleware; default handler  
**Fix:** Four-arg handler last (Phase 5)

**Symptom:** Empty body treated as success  
**Cause:** Parser skipped; handler did not require body  
**Fix:** Validate presence (Phase 8)

## Interview questions

**★ Typical status for malformed JSON body?**  
**400** with `entity.parse.failed` from the parser stack.

**Should you return the parser’s raw message to browsers?**  
Prefer a stable public message; log detail internally.

---

← Prev: [Query parser](04-query-parser.md) · Next → [raw and text](06-raw-and-text.md)
