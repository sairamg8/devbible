---
title: "The four gates"
sidebar_label: "01 · The four gates"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**A body parser checks four things before it reads a single byte, and three of
the four failures are silent. `req.body` being `undefined` is not an error — it is
the parser politely declining.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**, and
> **`body-parser@2.3.0`**, which is what `express.json` and friends are re-exports
> of ([Phase 0 · 01 · chunk 03](../../phase-0-express-basics/01-what-express-is/03-what-express-delegates.md)).
> The gate sequence is read from `body-parser`'s `lib/read.js` in
> `sandbox/express-verify/node_modules/`. **Reading source is not a run.** The
> console block below is **re-used unchanged from the earlier authorised
> `sandbox/express-verify` run**, and it carries a known error flagged in place —
> see the warning. The documented wording is from the
> [express reference](https://expressjs.com/en/5x/api/express.html): the parsed
> body is populated *"or `undefined` if there was no body to parse, the
> `Content-Type` was not matched, or an error occurred."*
>
> ⚠️ **Known error in the console block, left in place rather than rewritten.** It
> prints `body: undefined`, which a real run cannot produce — `res.json`
> serialises with `JSON.stringify`, which omits `undefined` properties, so the key
> would be **absent**. Left unrewritten because this pass ran nothing; the
> corrected reading is here.

## The sequence

```js
// body-parser/lib/read.js — the top of read()
if (onFinished.isFinished(req)) { next(); return }        // gate 1

if (!('body' in req)) { req.body = undefined }            // ← this is where it comes from

if (!hasBody(req))        { next(); return }              // gate 2
if (!options.shouldParse(req)) { next(); return }         // gate 3

encoding = getCharset(req) || options.defaultCharset      // gate 4 → 415
```

| Gate | Condition | Outcome |
|---|---|---|
| **1 · already finished** | the request stream is already consumed or the response ended | `next()`, silently |
| **2 · no body** | no `Content-Length` and no `Transfer-Encoding` | `next()`, silently |
| **3 · type mismatch** | `Content-Type` does not match this parser's `type` | `next()`, silently |
| **4 · charset** | charset is not `utf-*` (for JSON) | **415 `charset.unsupported`** |

🔴 **That third line is the answer to "why is `req.body` undefined".** The parser
*explicitly assigns* `req.body = undefined` before deciding whether to run — so
the property exists and holds `undefined`, which is why `req.body.foo` throws
`Cannot read properties of undefined` rather than being caught by a
`'body' in req` check. Express 4 assigned `{}` here, and that single change breaks
a lot of upgraded code.

**Gates 2 and 3 are the silent ones**, and they are silent by design: a parser
that 415'd every request with the wrong content type could not be mounted
globally, because it would reject every GET.

## Gate 3 in practice: the content-type gate

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

**Valid JSON text, wrong header, no error.** The parser declined at gate 3, the
handler ran, and the bug surfaces as a validation failure or a null-reference
somewhere else entirely.

The matching is `type-is`, not string equality, so all of these hit
`express.json()`'s default `application/json`:

```text
application/json
application/json; charset=utf-8
application/json;charset=UTF-8
```

…and none of these do:

```text
text/json
application/x-json
application/vnd.api+json          ← the +json suffix is NOT matched by the default
(no Content-Type at all)
```

That last group is where webhook integrations fail. Widen deliberately:

```js
app.use(express.json({type: ['application/json', 'application/*+json']}));
```

## 🔴 The webhook trap

`express.raw()`'s default `type` is **`application/octet-stream`**, and almost
every webhook provider posts `application/json`. So the natural-looking

```js
app.post('/webhooks/stripe', express.raw(), verifySignature, handler);
```

**never populates `req.body`** — gate 3 declines, `req.body` stays `undefined`,
and the signature check fails on every single delivery. It is the number-one
reason webhook signature verification fails on first setup.

```js
app.post('/webhooks/stripe',
  express.raw({type: 'application/json'}),   // ← the fix
  verifySignature, handler);
```

And the ordering constraint that goes with it: **the raw parser must be mounted
above any global `express.json()`** for that route, or JSON will have consumed the
stream first and gate 1 will decline the raw parser. Signature verification needs
the exact bytes, and a re-serialised object is not them
([Phase 6 · 09](../../phase-6-rest-surface/09-webhooks.md)).

## Choosing the mount point

```js
app.use(express.json({limit: '100kb'}));                  // global
app.post('/orders', express.json(), createOrder);          // per route
```

| | Global | Per route |
|---|---|---|
| Effort | one line | one line per route |
| Cost on routes with no body | a type check and a `next()` — genuinely cheap | none |
| Different limits per route | needs a second mount at a path | natural |
| A route that must **not** parse (webhooks, proxies, streams) | must be mounted above the global, or excluded | natural |
| Reviewability | the limit is in one place | the limit is next to the handler |

**Global is the right default**, because gate 2 and gate 3 make it nearly free
for requests that carry no matching body. Reach for per-route when a route needs
a different limit, needs the raw bytes, or streams the body itself.

## Gotchas

**Symptom:** `req.body` is `undefined` and the JSON was definitely valid
**Cause:** Gate 3 — the `Content-Type` did not match. Wrong type, missing type, or
a `+json` suffix type the default does not cover
**Fix:** Log `req.get('Content-Type')` for the failing request; widen `type` if the
client is correct and you are not

**Symptom:** `Cannot read properties of undefined (reading 'name')` on `req.body`
**Cause:** Express 5 assigns `req.body = undefined` when no parser ran; Express 4
gave `{}`
**Fix:** Validate at the boundary so a missing body is a 400 with a message —
[Phase 8 · 01](../../phase-8-validation-authz/01-validate-at-boundary.md)

**Symptom:** A webhook's signature check fails on every delivery
**Cause:** `express.raw()` defaults to `application/octet-stream`; the provider
sends `application/json`
**Fix:** `express.raw({type: 'application/json'})`, mounted **above** any global
JSON parser for that path

**Symptom:** Two parsers are mounted and only the first ever populates the body
**Cause:** Correct behaviour — the first to match consumes the stream, and gate 1
makes the second bail
**Fix:** Expected. Mount parsers for **different** types, not two for the same one

**Symptom:** `415 unsupported charset "ISO-8859-1"`
**Cause:** Gate 4 — the JSON parser accepts only `utf-*` charsets
**Fix:** Correct the client. JSON is UTF-8 by specification

## Interview questions

**★ When does `express.json()` populate `req.body`?**
Only when the request survives four gates: the stream is not already consumed,
there is a body at all (`Content-Length` or `Transfer-Encoding`), the
`Content-Type` matches the parser's `type`, and the charset is `utf-*`. The first
three decline silently; only the charset failure is an error.

**★ What happens when the `Content-Type` is wrong?**
Nothing visible. The parser calls `next()` and `req.body` stays `undefined` — it
is **not** an automatic 415. The failure surfaces later, as a validation error or
a null reference far from the cause.

**★ Why is `req.body` `undefined` rather than absent?**
Because `read()` explicitly assigns `req.body = undefined` before the gates, if
the property is not already set. Express 4 assigned `{}` at that point, which is
why upgraded code doing `Object.keys(req.body)` now throws.

**★ Why do webhook signature checks usually fail on first setup?**
`express.raw()` defaults its `type` to `application/octet-stream`, and providers
send `application/json`, so the raw parser declines at the content-type gate and
`req.body` is never populated. It also has to be mounted above any global JSON
parser, because signature verification needs the exact bytes.

**Is global `express.json()` expensive?**
Not meaningfully. For a request with no body or a non-matching content type it is
a header check and a `next()` — it never touches the stream. Mount it per route
when you need a different limit, the raw bytes, or to stream the body yourself.

**Can you mount two parsers for the same content type?**
You can, and the second will never run: the first consumes the stream, and gate 1
(`onFinished.isFinished`) makes the second bail. Mount parsers for different
types instead.

---

Index: [JSON and urlencoded](README.md) · Next → [The parsers and their options](02-the-parsers-and-their-options.md)
