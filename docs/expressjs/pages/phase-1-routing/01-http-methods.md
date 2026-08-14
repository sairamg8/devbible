---
title: "HTTP methods"
sidebar_label: "01 · HTTP methods"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**A route is method + path. Register the methods you mean. A mismatch is a 404
by default — not a 405.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> [FAQ — 404 responses](https://expressjs.com/en/starter/faq.html): *"404 responses are
> not the result of an error … Express has executed all middleware functions and routes,
> and found that none of them responded."*
> [`app.all`](https://expressjs.com/en/5x/api/application/) *"matches all HTTP verbs"*,
> and the routing guide lists `QUERY` among them.
> **The HEAD note below has a caveat the docs add:** `app.get()` covers HEAD *"if
> `app.head()` was not called for the path **before** `app.get()`"* — register a `head`
> route first and the GET handler stops serving HEAD.
> The docs describe no built-in 405 or `Allow` header, which is why this page says you
> must write one.

## The verbs

```js
// methods.mjs
import express from 'express';

const app = express();

app.get('/items', (req, res) => res.send('list'));
app.post('/items', (req, res) => res.send('create'));
app.put('/items/:id', (req, res) => res.send('replace'));
app.patch('/items/:id', (req, res) => res.send('patch'));
app.delete('/items/:id', (req, res) => res.send('delete'));
app.all('/ping', (req, res) => res.send(req.method));

const server = app.listen(0, async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;

  const postOnlyGet = await fetch(`${base}/items`, {method: 'POST'});
  console.log('POST /items', postOnlyGet.status, await postOnlyGet.text());

  const wrong = await fetch(`${base}/items`, {method: 'DELETE'});
  console.log('DELETE /items (no handler)', wrong.status);

  const ping = await fetch(`${base}/ping`, {method: 'OPTIONS'});
  console.log('all /ping OPTIONS', await ping.text());

  server.close();
});
```

```console
$ node methods.mjs
POST /items 200 create
DELETE /items (no handler) 404
all /ping OPTIONS OPTIONS
```

| Helper | HTTP methods |
|---|---|
| `app.get` | GET (and HEAD, via Express) |
| `app.post` | POST |
| `app.put` / `patch` / `delete` | as named |
| `app.all` | every method |

There is no built-in “return 405 Method Not Allowed with Allow header” for free.
If you need strict 405s, add middleware that knows your allowed methods.

## Why 404 on wrong method matters

Clients and caches treat 404 and 405 differently. APIs that care about correctness
often implement an explicit method check. Most CRUD apps live with Express’s
default 404 and document allowed methods in OpenAPI (Phase 6).

## Trade-off

`app.all` is convenient for CORS preflight experiments and diagnostics. Using it
for real resources hides method mistakes. Prefer explicit verbs on public APIs.

## Gotchas

**Symptom:** `POST /users` returns 404 even though `app.get('/users')` exists  
**Cause:** Only GET was registered  
**Fix:** Add `app.post` (or the method you need). The path match is not enough

**Symptom:** Expecting automatic 405  
**Cause:** Express default final handler is 404  
**Fix:** Custom middleware or framework policy — not Express default

**Symptom:** HEAD requests behave oddly  
**Cause:** GET handlers usually satisfy HEAD; body is stripped  
**Fix:** Do not assume a separate HEAD route unless you registered one

## Interview questions

**★ What status does Express return when the path matches but the method does not?**  
**404** by default — not 405.

**★ What does `app.all` do?**  
Registers a handler for every HTTP method on that path.

**Name the common registration helpers.**  
`get`, `post`, `put`, `patch`, `delete`, `all`, plus `use` for middleware mounts.

**When would you implement 405 yourself?**  
Public APIs that must advertise allowed methods correctly for strict clients.

**Is `app.get` enough for a REST collection that creates on POST?**  
No — create needs `post` (or another verb) on the same or related path.

---

← Index: [Phase 1](README.md) · Next → [Params and query](02-params-and-query.md)
