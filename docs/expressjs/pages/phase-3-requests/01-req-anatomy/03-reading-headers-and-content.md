---
title: "Reading headers and content"
sidebar_label: "03 · Reading headers and content"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**`req.get`, `req.is` and `req.accepts` exist because the naive versions —
indexing `req.headers`, comparing content types with `===`, and reading `Accept`
yourself — are all subtly wrong.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. `req.get`'s
> `referer`/`referrer` special case and its two `TypeError`s are read from
> `express@5.2.1`'s `lib/request.js`; `req.is` delegates to `type-is` and
> `req.accepts` to `accepts`, both in `sandbox/express-verify/node_modules/`.
> **Reading source is not a run.** The console block below is **re-used unchanged
> from the earlier authorised `sandbox/express-verify` run**, and it carries a
> known error which is flagged in place rather than replaced — see the warning.
> Cross-checked against the
> [request reference](https://expressjs.com/en/5x/api/request.html).
>
> ⚠️ **Known error in the console block, left in place rather than rewritten.** It
> prints `body: undefined`. A real run cannot print that: the value crosses
> `res.json`, and `JSON.stringify` **omits** object properties whose value is
> `undefined` — *"they are either omitted (when found in an object) or changed to
> `null` (when found in an array)"*
> ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)).
> The `body` key would simply be **absent**. Since this pass runs nothing, the
> block is not rewritten from imagination — the correction is stated here instead.
> **The lesson is the more useful one anyway: `undefined` does not survive a JSON
> round-trip.**

## `req.get(name)` — not just a lowercase index

```js
// express/lib/request.js
req.get = req.header = function header(name) {
  if (!name) throw new TypeError('name argument is required to req.get');
  if (typeof name !== 'string') throw new TypeError('name must be a string to req.get');

  var lc = name.toLowerCase();

  switch (lc) {
    case 'referer':
    case 'referrer':
      return this.headers.referrer || this.headers.referer;
    default:
      return this.headers[lc];
  }
};
```

Three behaviours the naive version does not have:

- **Case-insensitive.** `req.get('Content-Type')` works;
  `req.headers['Content-Type']` is `undefined`, because Node lowercases the keys.
- 🔴 **`referer` and `referrer` are aliases**, checked in that order —
  `referrer` first, then the famously misspelled `referer` that is actually on
  the wire. Either spelling in your code finds either spelling in the request.
- **It throws on bad input.** No name, or a non-string name, is a `TypeError`
  rather than a silent `undefined` — which catches
  `req.get(someVariableThatIsUndefined)`.

`req.header` is the same function under a second name.

## `req.is(type)` — content-type matching that handles the real header

```js
req.is = function is(types) { /* … */ return typeis(this, arr); };
```

It delegates to `type-is`, and that matters because the header you are matching
against is rarely clean:

```text
Content-Type: application/json; charset=utf-8
Content-Type: application/vnd.api+json
Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryX
```

| You write | It matches |
|---|---|
| `req.is('json')` | `application/json` **and** `application/vnd.api+json` — the `+json` suffix |
| `req.is('application/json')` | exact type, parameters ignored |
| `req.is('text/*')` | any `text/…` |
| `req.is('json', 'urlencoded')` | first match wins; returns the matched type string |
| *(no body)* | **`null`** — not `false` |

**`req.headers['content-type'] === 'application/json'` fails on every request
that includes a charset**, which is most of them. That comparison is the single
most common reason a webhook handler "sees the wrong content type".

Note the `null`-versus-`false` distinction: `req.is()` returns `null` when there
is no body at all, `false` when there is a body of a different type. Code that
does `if (!req.is('json'))` treats both the same, which is usually right — but if
you need to distinguish "no body" from "wrong body", check for `null` explicitly.

## `req.accepts(...)` — negotiation, in the client's preference order

```js
req.accepts = function(){
  var accept = accepts(this);
  return accept.types.apply(accept, arguments);
};
```

It returns the **best match** — ordered by the client's quality values, not by
your argument order — or `false` when nothing matches, in which case the correct
answer is **406**:

```js
switch (req.accepts(['json', 'html'])) {
  case 'json': return res.json(data);
  case 'html': return res.render('view', data);
  default:     return res.sendStatus(406);
}
```

The siblings — `req.acceptsCharsets`, `req.acceptsEncodings`,
`req.acceptsLanguages` — work the same way for their headers.

🔴 **Anything negotiated must send `Vary`.** A response that differs by `Accept`
and is cached without `Vary: Accept` gets served to the wrong client. `res.vary()`
adds it, and `res.format()` does the negotiation and the `Vary` together —
[Phase 4 · 09](../../phase-4-responses/09-content-negotiation.md).

## Where each piece of the request comes from

```js
// anatomy.mjs
import express from 'express';

const app = express();
app.post('/echo', (req, res) => {
  res.json({
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    hasCookieParser: typeof req.cookies,
  });
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  const res = await fetch(
    `http://127.0.0.1:${port}/echo?x=1`,
    {
      method: 'POST',
      headers: {'content-type': 'application/json', cookie: 'a=b'},
      body: '{"hi":true}',
    },
  );
  console.log(await res.json());
  server.close();
});
```

```console
$ node anatomy.mjs
{
  method: 'POST',
  path: '/echo',
  query: { x: '1' },
  body: undefined,
  hasCookieParser: 'undefined'
}
```

No parser → no `body`. No cookie-parser → no `cookies` object — even though a
`Cookie` header was sent and is sitting in `req.headers.cookie` the whole time.
Writing cookies still works, because `res.cookie` is built in
([Phase 4 · 07](../../phase-4-responses/07-cookies-out.md)).

| Piece of the request | Where it lands | Needs |
|---|---|---|
| the path | `req.path` / `req.originalUrl` | nothing |
| `?x=1` | `req.query` | nothing (the parser setting decides the shape) |
| `/users/:id` | `req.params` | a matching route |
| headers | `req.headers`, `req.get(…)` | nothing |
| the `Cookie` header | `req.headers.cookie` | nothing |
| parsed cookies | `req.cookies` | **cookie-parser** |
| the body bytes | `req` itself, as a stream | nothing |
| a parsed body | `req.body` | **a body parser** |
| an uploaded file | `req.file` / `req.files` | **multer** |

## Trade-off

Putting everything on `req` is convenient and it is how the whole ecosystem
communicates. The cost is that **the request object becomes an undocumented
interface**: nothing declares that `req.user` exists, nothing type-checks it, and
nothing tells a reader which middleware supplied it.

Two disciplines keep it survivable. **Document what your app attaches** — a short
list in the app factory, or a `.d.ts` augmenting `Express.Request`
([Phase 8 · 09](../../phase-8-validation-authz/09-type-inference.md)) — and
**keep the list short**, preferring an explicit function argument over another
`req` property whenever the value is only needed in one place.

## Gotchas

**Symptom:** `req.headers['Content-Type']` is `undefined`
**Cause:** Node lowercases header keys
**Fix:** `req.get('Content-Type')`

**Symptom:** A webhook handler rejects valid requests as the wrong content type
**Cause:** `req.headers['content-type'] === 'application/json'` fails against
`application/json; charset=utf-8`
**Fix:** `req.is('json')`, which parses the header and also matches `+json` suffix
types

**Symptom:** `req.get('referrer')` returns nothing although the browser sent a
referrer
**Cause:** Nothing — this actually works. The getter aliases both spellings. The
failure is `req.headers.referrer`, since the wire header is the misspelled
`referer`
**Fix:** Use `req.get`, either spelling

**Symptom:** A negotiated endpoint serves JSON to a browser and HTML to an API
client, intermittently
**Cause:** A cache in front, and the response has no `Vary: Accept`
**Fix:** `res.vary('Accept')`, or use `res.format()` which handles it

**Symptom:** `req.is('json')` returned `null` and the code treated it as "wrong
type"
**Cause:** `null` means **no body at all**; `false` means a body of another type
**Fix:** Distinguish them if the difference matters — a missing body is usually a
400 with a different message

## Interview questions

**★ Why use `req.get('Content-Type')` instead of `req.headers['Content-Type']`?**
Because Node lowercases header keys, so the bracket form with capitals is always
`undefined`. `req.get` also aliases `referer`/`referrer` and throws a `TypeError`
on a missing or non-string name instead of silently returning `undefined`.

**★ What is wrong with `req.headers['content-type'] === 'application/json'`?**
It fails on `application/json; charset=utf-8`, which is what most clients send,
and it misses suffix types like `application/vnd.api+json`. `req.is('json')`
parses the header properly and handles both.

**★ What does `req.is()` return when there is no body?**
`null` — distinct from `false`, which means there is a body of a different type.
Most code treats them the same, which is fine, but "no body" is usually a
different error message from "wrong body".

**★ How does `req.accepts` decide?**
It returns the client's most preferred acceptable type, ordered by the quality
values in the `Accept` header rather than by your argument order, and `false`
when nothing matches — in which case the correct response is 406. Any negotiated
response must also send `Vary: Accept`.

**Why does `req.get` special-case `referer`?**
Because the HTTP header is famously misspelled. The getter checks
`headers.referrer` first, then `headers.referer`, so either spelling in your code
finds the header regardless.

**What is the structural cost of attaching things to `req`?**
It creates an undocumented interface. Nothing declares that `req.user` exists,
nothing type-checks it, and nothing tells a reader which middleware supplied it —
so a handler cannot be understood or tested without knowing the mount order above
it.

---

← Prev: [The twelve getters](02-the-twelve-getters.md) · Index: [req anatomy](README.md) · Next topic → [JSON and urlencoded](../02-json-and-urlencoded/README.md)
