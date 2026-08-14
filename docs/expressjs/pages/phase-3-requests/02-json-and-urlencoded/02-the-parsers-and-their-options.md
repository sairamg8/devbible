---
title: "The parsers and their options"
sidebar_label: "02 · The parsers and their options"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Four parsers, one shared option set, and three behaviours that are not what
their names suggest: `strict` rejects valid JSON, an empty body parses to `{}`
anyway, and `extended` changed its default in Express 5.**

> Verified: 2026-08-14 against **`body-parser@2.3.0`** in
> `sandbox/express-verify/node_modules/`, reading `lib/utils.js`
> (`normalizeOptions`) and `lib/types/json.js` (`createJsonParser`) by function.
> **Reading source is not a run: nothing was executed for this page and it carries
> no console block.** Cross-checked against the
> [express reference](https://expressjs.com/en/5x/api/express.html), whose option
> tables are `body-parser`'s verbatim, and the
> [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5.html) for
> the `extended` default change.

## The four, and their default types

| Parser | Default `type` | Produces |
|---|---|---|
| `express.json()` | `application/json` | an object or array |
| `express.urlencoded()` | `application/x-www-form-urlencoded` | an object of strings |
| `express.text()` | `text/plain` | a string |
| `express.raw()` | **`application/octet-stream`** | a `Buffer` |

Multipart is **not** in the list — `multipart/form-data` needs multer or
equivalent, and none of these four will touch it
([page 07](../07-multipart-uploads.md)).

## The shared options

```js
// body-parser/lib/utils.js — normalizeOptions()
const inflate = options?.inflate !== false
const limit = typeof options?.limit === 'undefined' || options?.limit === null
  ? 102400                       // 100kb, as a literal
  : bytes.parse(options.limit)
const type = options?.type || defaultType
const verify = options?.verify || false
const defaultCharset = options?.defaultCharset || 'utf-8'
```

| Option | Default | Notes |
|---|---|---|
| `limit` | **`102400`** bytes (100 kb) | accepts `'1mb'` etc. via the `bytes` package; an unparseable value **throws at mount time** |
| `inflate` | `true` | accept gzip/deflate bodies. `false` ⇒ **415 `encoding.unsupported`** |
| `type` | per parser | a string, an array, or **a function `(req) => boolean`** |
| `verify` | `false` | `(req, res, buf, encoding)`; throwing produces **403 `entity.verify.failed`** |
| `defaultCharset` | `'utf-8'` | used when the request declares none |

Two under-used ones:

**`type` as a function** is the clean way to express "raw for this one path,
JSON everywhere else" without ordering games:

```js
app.use(express.json({
  type: req => !req.path.startsWith('/webhooks/')
}));
```

**`verify`** is the documented hook for capturing the exact bytes while still
getting a parsed body — the standard webhook shape:

```js
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}));
```

Note the status it produces on throw: **403**, not 400. `verify` is modelled as an
authenticity check, not a syntax check, which is exactly right for a signature.

## `express.json()`'s own options

| Option | Default | What it does |
|---|---|---|
| `strict` | **`true`** | only `{` or `[` may start the body |
| `reviver` | none | passed straight to `JSON.parse` |

🔴 **`strict: true` rejects JSON that is perfectly valid.** RFC 8259 allows any
value at the top level, so `42`, `"hello"`, `true` and `null` are all valid JSON
documents — and body-parser refuses all of them:

```js
if (strict) {
  const first = firstchar(body)
  if (first !== '{' && first !== '[') throw createStrictSyntaxError(body, first)
}
```

The result is a **400 `entity.parse.failed`**. This is almost always what you
want for an API, and it is worth knowing it is a body-parser policy rather than a
JSON rule — if you are consuming a partner's feed of bare arrays of numbers or
top-level strings, `strict: false` is the switch.

🔴 **An empty body parses to `{}` — even in strict mode.** Both branches begin:

```js
if (body.length === 0) {
  // special-case empty json body, as it's a common client-side mistake
  return {}
}
```

So `POST /orders` with `Content-Type: application/json`, `Content-Length: 0`
gives `req.body = {}` and **no error**. The request looks like a valid empty
object. This is a deliberate leniency, and it means **"the client sent nothing" is
indistinguishable from "the client sent `{}`"** at the parser level. Your schema
has to be the thing that rejects it — which it will, if required fields are
actually marked required
([Phase 8 · 01](../../phase-8-validation-authz/01-validate-at-boundary.md)).

## `express.urlencoded()`'s `extended`

```js
app.use(express.urlencoded({extended: false}));
```

| `extended` | Library | `a[b]=1` becomes | Default |
|---|---|---|---|
| `false` | Node's `querystring` | `{'a[b]': '1'}` — a literal key | **Express 5** |
| `true` | `qs` | `{a: {b: '1'}}` | Express 4 |

**The default flipped in Express 5**, exactly as the query-parser default did,
and it fails the same silent way: an upgraded app reading
`req.body.address.city` gets `undefined`, the field is quietly ignored, and the
record saves without it. Nothing throws.

If you genuinely need nesting, set `extended: true` **and** validate the shape —
the same `?a[$ne]=` class of problem applies to bodies
([Phase 1 · 02 · chunk 03](../../phase-1-routing/02-params-and-query/03-shape-and-trust.md)).
And use urlencoded only for HTML form posts; a JSON API should use
`express.json()` and reject form encodings outright.

## `express.text()` and `express.raw()`

`text()` gives you a string decoded with the declared charset; `raw()` gives you a
`Buffer` and no decoding at all. The rule of thumb:

- **Signature verification, encryption, checksums → `raw()`.** Any decode-then-
  re-encode round trip can change the bytes, and the signature is over the bytes.
- **CSV, XML, a plain-text webhook → `text()`**, then parse it yourself.
- Both take the same `limit`, and both need their `type` set to whatever the
  sender actually uses.

## Gotchas

**Symptom:** `SyntaxError` / 400 on a body that is valid JSON, like `42` or
`"ok"`
**Cause:** `strict: true` (the default) requires the first non-whitespace
character to be `{` or `[`
**Fix:** Correct the client, or `strict: false` if you must consume top-level
scalars

**Symptom:** A completely empty POST is accepted and the handler sees `{}`
**Cause:** body-parser special-cases a zero-length body to `{}` in both strict and
non-strict modes
**Fix:** Nothing at the parser level — make required fields required in the
schema, so an empty object is a 400 with a useful message

**Symptom:** After upgrading to Express 5, nested form fields silently vanish
**Cause:** `extended` now defaults to `false`, so `address[city]` is one literal
key
**Fix:** `extended: true` if you need nesting — and validate the resulting shape

**Symptom:** `app.use(express.json({limit: '10 megabytes'}))` throws at startup
**Cause:** `bytes.parse` returns `null` for an unparseable value, and
`normalizeOptions` throws `option limit "…" is invalid`
**Fix:** Use the `bytes` syntax — `'10mb'`. Failing at mount time is the good
outcome here

**Symptom:** A gzipped body is rejected with 415
**Cause:** `inflate: false` was set, or the content encoding is one body-parser
does not support
**Fix:** Leave `inflate` at its default `true` unless you have a specific reason —
and remember a compressed body's *decompressed* size is what `limit` applies to
([page 03](../03-size-limits.md))

## Interview questions

**★ What are `express.json()`'s defaults?**
`limit` 100 kb (literally 102400 bytes), `type` `application/json`, `strict`
`true`, `inflate` `true`, `defaultCharset` `utf-8`. All of them are
`body-parser`'s, because `express.json` is a re-export.

**★ What does `strict: true` actually reject?**
Any body whose first non-whitespace character is not `{` or `[` — which includes
`42`, `"hello"`, `true` and `null`, all of which are valid JSON documents under
RFC 8259. It is a body-parser policy, not a JSON rule, and it produces a 400
`entity.parse.failed`.

**★ What does an empty JSON body parse to?**
`{}`, in both strict and non-strict modes — body-parser special-cases a
zero-length body as *"a common client-side mistake"*. So "sent nothing" and "sent
`{}`" are indistinguishable at the parser, and your schema has to reject it.

**★ What changed about `extended` in Express 5, and why does it matter?**
The default went from `true` to `false`, so bracketed form field names stop
nesting: `address[city]` becomes one literal key. Nothing throws — the field is
silently ignored and the record saves without it.

**How do you capture the raw bytes and still get a parsed body?**
The `verify` hook: `verify: (req, res, buf) => { req.rawBody = buf }`. Throwing
from it produces a **403 `entity.verify.failed`**, which is the right status for
a failed authenticity check.

**When do you use `express.raw()` rather than `express.text()`?**
When the bytes themselves matter — signatures, encryption, checksums. Any decode
and re-encode round trip can alter them, and a signature computed over the
original bytes will then not match.

---

← Prev: [The four gates](01-the-four-gates.md) · Index: [JSON and urlencoded](README.md) · Next → [Errors and choices](03-errors-and-choices.md)
