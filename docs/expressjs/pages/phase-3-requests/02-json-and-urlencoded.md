---
title: "JSON and urlencoded parsers"
sidebar_label: "02 · JSON · urlencoded"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**`express.json()` and `express.urlencoded()` read the stream into `req.body`
only when `Content-Type` matches. Wrong type means empty body, not a thrown
error.**

## JSON

```js
// json-parse.mjs
import express from 'express';

const app = express();
app.use(express.json());
app.post('/echo', (req, res) => res.json({body: req.body}));

const server = app.listen(0, async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;

  let res = await fetch(`${base}/echo`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({a: 1}),
  });
  console.log('json', await res.json());

  res = await fetch(`${base}/echo`, {
    method: 'POST',
    headers: {'content-type': 'text/plain'},
    body: JSON.stringify({a: 1}),
  });
  console.log('wrong type', await res.json());

  server.close();
});
```

```console
$ node json-parse.mjs
json { body: { a: 1 } }
wrong type { body: undefined }
```

## urlencoded

```js
app.use(express.urlencoded({extended: false}));
// extended: false → querystring library; true → qs (nested objects)
```

Use urlencoded for HTML form posts. JSON APIs use `express.json()`. Do not assume
both are always mounted — mount what your clients send.

## Content-Type gates

Parsers skip bodies they do not claim. Clients must send
`Content-Type: application/json` (with optional charset) for JSON.

## Trade-off

Global `express.json()` is simple. Per-route parsers (`app.post('/x', express.json(), h)`)
avoid parsing huge bodies on routes that never need them — use when abuse is a concern.

## Gotchas

**Symptom:** Body always undefined with correct JSON text  
**Cause:** Missing or wrong `Content-Type`  
**Fix:** Set header; verify with logging middleware

**Symptom:** Nested form fields missing  
**Cause:** `extended: false`  
**Fix:** `extended: true` only if you need nesting — still validate

## Interview questions

**★ When does `express.json()` populate `req.body`?**  
When the request has a JSON content-type it understands and a parseable body.

**What if Content-Type is wrong?**  
Parser skips; `req.body` stays undefined — usually not an automatic 415.

**json vs urlencoded?**  
JSON APIs vs HTML form bodies.

---

← Prev: [req anatomy](01-req-anatomy.md) · Next → [Size limits](03-size-limits.md)
