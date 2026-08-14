---
title: "What res.send actually does"
sidebar_label: "01 · What res.send does"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**`res.send` is not a thin wrapper around `res.end`. It picks a content type from
`typeof`, sets `Content-Length`, generates an `ETag`, quietly downgrades to 304,
strips headers on 204, and drops the body for HEAD — and everything you send goes
through it, including `res.json`.**

> Verified: 2026-08-14 on **Express 5.2.1**. Read from `express@5.2.1`'s
> `lib/response.js` — `res.send`, `res.json`, `res.sendStatus` — in
> `sandbox/express-verify/node_modules/`, quoted by function. **Reading source is
> not a run.** The console block below is **re-used unchanged from the earlier
> authorised `sandbox/express-verify` run** and is sandbox-measured. Cross-checked
> against the [response reference](https://expressjs.com/en/5x/api/response.html):
> `res.json` sends a body *"converted to a JSON string using `JSON.stringify()`"*;
> `res.send` chooses the content type from the body; `res.status` is *"a chainable
> alias of Node's `response.statusCode`"*.

## The dispatch

```js
// express/lib/response.js — res.send(), the type switch
switch (typeof chunk) {
  case 'string':
    if (!this.get('Content-Type')) this.type('html');    // ← html, not plain
    break;
  case 'boolean':
  case 'number':
  case 'object':
    if (chunk === null) {
      chunk = '';                                        // ← empty body
    } else if (ArrayBuffer.isView(chunk)) {
      if (!this.get('Content-Type')) this.type('bin');
    } else {
      return this.json(chunk);                           // ← delegates
    }
    break;
}
```

| You send | Content-Type | Body |
|---|---|---|
| `'hello'` | 🔴 **`text/html; charset=utf-8`** | `hello` |
| `{a: 1}` / `[1,2]` | `application/json` | JSON, via `res.json` |
| `Buffer` / `TypedArray` | `application/octet-stream` | the bytes |
| `null` | *(unset)* | 🔴 **empty** — not the string `null` |
| `42` | `application/json` | `42` |
| `true` | `application/json` | `true` |

🔴 **`res.send('<p>hi</p>')` sets `text/html`, and so does `res.send('plain text')`.**
The type is decided by the JavaScript type, not by the content. For a plain-text
response you must say so: `res.type('txt').send('plain text')`.

🔴 **`res.send(404)` does not send a 404.** In Express 4 that was a deprecated
alias for `sendStatus`; in Express 5 a number falls into `res.json`, so you get
**status 200** with the JSON body `404`. If you meant the status, it is
`res.sendStatus(404)`.

Note also that the type is only set **if `Content-Type` is not already set**. A
`res.type(...)` or `res.set('Content-Type', ...)` earlier in the handler wins, and
so does one set by a middleware you forgot about.

## Everything after the dispatch

The rest of `res.send` runs for every response, including every `res.json`:

**1 · Strings are declared UTF-8.** `setCharset(type, 'utf-8')` rewrites the
Content-Type, which is why you see `; charset=utf-8` you did not write.

**2 · `Content-Length` is computed**, with a small optimisation worth knowing:

```js
} else if (!generateETag && chunk.length < 1000) {
  len = Buffer.byteLength(chunk, encoding)      // cheap path
} else {
  chunk = Buffer.from(chunk, encoding)          // needed for the ETag anyway
  len = chunk.length
}
```

**3 · An `ETag` is generated** — but only if the response does not already have
one and the app has an `etag fn`. The default `etag` setting is `'weak'`
([Phase 0 · 01 · chunk 03](../../phase-0-express-basics/01-what-express-is/03-what-express-delegates.md)),
so the tag is weak, which is why it cannot be used with `If-Match`
([Phase 6 · 07](../../phase-6-rest-surface/07-etag-and-cache.md)).

🔴 **4 · The conditional-GET check happens here.**

```js
if (req.fresh) this.status(304);
```

**`res.send` silently turns your 200 into a 304** when the request's
`If-None-Match` matches the ETag it just generated. You wrote
`res.json(order)`; the client gets an empty 304. That is correct HTTP and it
surprises people debugging "my API returns nothing" — it returns nothing
*because the client already has it*. Recall that `req.fresh` is only ever true
for GET and HEAD with a 2xx/304 status
([Phase 3 · 01 · chunk 02](../../phase-3-requests/01-req-anatomy/02-the-twelve-getters.md)).

**5 · 204, 205 and 304 have their headers stripped.**

```js
if (204 === this.statusCode || 304 === this.statusCode) {
  this.removeHeader('Content-Type');
  this.removeHeader('Content-Length');
  this.removeHeader('Transfer-Encoding');
  chunk = '';
}
if (this.statusCode === 205) {
  this.set('Content-Length', '0');
  this.removeHeader('Transfer-Encoding');
  chunk = '';
}
```

So `res.status(204).json({deleted: true})` sends **no body and no
`Content-Type`** — Express enforces RFC 9110 for you, silently discarding what you
passed. If you want the body, do not use 204.

**6 · HEAD gets no body.** `if (req.method === 'HEAD') this.end()`. The handler
still did all the work — serialised the object, computed the ETag — and Express
throws the bytes away at the last line
([Phase 1 · 01 · chunk 02](../../phase-1-routing/01-http-methods/02-head-and-options.md)).

## `res.json` is a thin wrapper over all of that

```js
res.json = function json(obj) {
  var body = stringify(obj, app.get('json replacer'), app.get('json spaces'), app.get('json escape'))

  if (!this.get('Content-Type')) this.set('Content-Type', 'application/json');

  return this.send(body);
};
```

It serialises, sets the type if unset, and hands a **string** to `res.send` —
which then re-enters the dispatch as a string, but with `Content-Type` already
set, so the `text/html` branch does not fire. Everything in the list above still
applies: charset, `Content-Length`, ETag, the 304, the 204 stripping, HEAD.

Three app settings feed it:

| Setting | Effect |
|---|---|
| `json spaces` | pretty-printing indent. Costs bytes on every response — leave unset in production |
| `json replacer` | a `JSON.stringify` replacer applied to **every** JSON response |
| `json escape` | escapes `<`, `>`, `&` as unicode, for embedding JSON in HTML |

And the consequence that catches everyone: **`undefined` does not survive.**
`JSON.stringify` omits object properties whose value is `undefined`, so
`res.json({a: 1, b: undefined})` sends `{"a":1}` — the key is **absent**, not
null. [Phase 4 · 03](../03-response-shapes.md).

## `res.sendStatus` is not `res.status`

```js
res.sendStatus = function sendStatus(statusCode) {
  var body = statuses.message[statusCode] || String(statusCode)
  this.status(statusCode);
  this.type('txt');
  return this.send(body);
};
```

**It is terminal, and it sends a body**: the status text, as `text/plain`. So
`res.sendStatus(404)` writes the literal string `Not Found`, not an empty
response. Useful for 204-and-friends where you want no thought; wrong whenever a
client expects JSON, because it will get `text/plain` and fail to parse it.

For a JSON API the honest pair is `res.status(404).json({error: 'not_found'})`
for errors and `res.sendStatus(204)` for genuinely empty successes.

## The measured shapes

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

## Gotchas

**Symptom:** A plain-text response arrives as `text/html` and a browser renders
it as markup
**Cause:** `res.send(string)` sets `text/html` when no Content-Type is set — the
type comes from the JavaScript type, not the content
**Fix:** `res.type('txt').send(...)`, or use `res.json` for APIs

**Symptom:** `res.send(404)` returns 200 with the body `404`
**Cause:** In Express 5 a number goes to `res.json`. The Express 4 alias for
`sendStatus` is gone
**Fix:** `res.sendStatus(404)`, or `res.status(404).json({…})`

**Symptom:** An endpoint intermittently returns an empty 304
**Cause:** `res.send` checks `req.fresh` and downgrades to 304 when the client's
`If-None-Match` matches the generated ETag
**Fix:** Correct behaviour. If you must always send a body, `res.set('ETag', false)`
before sending, or disable `etag` for that route

**Symptom:** `res.status(204).json(data)` sends nothing
**Cause:** `res.send` strips `Content-Type`, `Content-Length` and the body for 204
and 304 — RFC 9110 forbids a body
**Fix:** Use 200 if you want a body

**Symptom:** `res.send(null)` produces an empty response rather than `null`
**Cause:** The `null` branch sets `chunk = ''`
**Fix:** `res.json(null)` if you genuinely want the JSON literal

**Symptom:** A client cannot parse a 404 from `res.sendStatus(404)`
**Cause:** It is `text/plain` with the body `Not Found`
**Fix:** `res.status(404).json({error: 'not_found'})` for JSON APIs

## Interview questions

**★ What content type does `res.send('hello')` set?**
`text/html; charset=utf-8`. The type is chosen from `typeof chunk`, not from the
content, so a plain string is HTML unless you set the type yourself. Only a
`Content-Type` already on the response prevents it.

**★ What is the relationship between `res.json` and `res.send`?**
`res.json` serialises with `JSON.stringify` (honouring `json replacer`,
`json spaces` and `json escape`), sets `application/json` if no type is set, and
then calls `res.send` with the resulting **string**. So everything `res.send`
does — charset, `Content-Length`, ETag, the 304 check, the 204 stripping, the
HEAD body drop — applies to every JSON response.

**★ Why might an endpoint return an empty 304 you did not write?**
Because `res.send` contains `if (req.fresh) this.status(304)`. It generated a
weak ETag, the client sent a matching `If-None-Match`, and Express downgraded the
response. That is correct conditional-GET behaviour.

**★ What does `res.status(204).json(x)` send?**
No body and no `Content-Type` — `res.send` removes `Content-Type`,
`Content-Length` and `Transfer-Encoding` and empties the chunk for 204 and 304.
Express enforces the RFC rather than letting you send a body with a no-content
status.

**★ What is the difference between `res.status(404)` and `res.sendStatus(404)`?**
`res.status` sets a field and returns `res` for chaining — it sends nothing.
`res.sendStatus` is terminal: it sets the status, sets `text/plain`, and sends
the status message as the body, so a JSON client receives `Not Found` as text.

**What happened to `res.send(404)` in Express 5?**
It is no longer a status alias. A number now falls into `res.json`, so you get a
200 with the JSON body `404`. Use `res.sendStatus`.

---

Index: [res methods](README.md) · Next → [The method map](02-the-method-map.md)
