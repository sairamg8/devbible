---
title: "res methods"
sidebar_label: "01 · res methods"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Pick one terminal method. Mixing `json` then `send` is how headers-already-sent
starts.**

## Common terminals

| Method | Use |
|---|---|
| `res.status(code)` | Chainable status — call before body helpers |
| `res.json(obj)` | JSON + Content-Type |
| `res.send(body)` | String/Buffer/object (object → JSON) |
| `res.end()` | Finish with optional raw body |
| `res.redirect(url)` | 302 by default (overload for code) |
| `res.type(mime)` / `res.set(h)` | Headers before body |

```js
// res-methods.mjs
import express from 'express';

const app = express();
app.get('/j', (req, res) => res.status(201).json({created: true}));
app.get('/s', (req, res) => res.status(200).send('plain'));
app.get('/r', (req, res) => res.redirect(302, '/j'));

const server = app.listen(0, async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;
  console.log('json', (await fetch(`${base}/j`)).status, await (await fetch(`${base}/j`)).json());
  console.log('send', await (await fetch(`${base}/s`)).text());
  const r = await fetch(`${base}/r`, {redirect: 'manual'});
  console.log('redirect', r.status, r.headers.get('location'));
  server.close();
});
```

```console
$ node res-methods.mjs
json 201 { created: true }
send plain
redirect 302 /j
```

## Trade-off

`res.json` is explicit for APIs. `res.send` is flexible and easy to misuse with
mixed types. Prefer `json` for JSON APIs.

## Gotchas

**Symptom:** Empty response with 200  
**Cause:** Forgot to call a terminal method  
**Fix:** Every branch ends with send/json/end/redirect

**Symptom:** Redirect to relative path surprises  
**Cause:** Client/base URL resolution  
**Fix:** Prefer absolute paths from the API root you document

## Interview questions

**★ Difference between `res.json` and `res.send`?**  
`json` always serializes as JSON with the right Content-Type; `send` branches on
type.

**Why chain `status` before `json`?**  
Status must be set before the body is written.

---

← Index: [Phase 4](README.md) · Next → [Status and headers](02-status-and-headers.md)
