---
title: "Errors and choices"
sidebar_label: "03 · Errors and choices"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**Every parser failure arrives as an `http-errors` object with a `status` and a
`type` code. Mapping on `type` gives you useful messages; mapping on the message
string gives you a maintenance problem.**

> Verified: 2026-08-14 against **`body-parser@2.3.0`** and **`raw-body`** in
> `sandbox/express-verify/node_modules/`, reading the `createError(...)` calls in
> `body-parser/lib/read.js` and `raw-body/index.js` — each supplies both a status
> and a `type` string, quoted verbatim in the table below. **Reading source is not
> a run: nothing was executed for this page and it carries no console block.**
> The default error handler's use of `err.status`/`err.statusCode` is per the
> [error-handling guide](https://expressjs.com/en/guide/error-handling.html).

## The error table

Every one of these reaches your error middleware as `next(err)`, with `err.status`
and `err.type` set:

| Status | `err.type` | Cause |
|---|---|---|
| **400** | `entity.parse.failed` | malformed JSON, or a `strict` violation |
| **403** | `entity.verify.failed` | your `verify` hook threw |
| **413** | `entity.too.large` | body exceeded `limit` |
| **415** | `charset.unsupported` | e.g. JSON with a non-`utf-*` charset |
| **415** | `encoding.unsupported` | `inflate: false`, or an unsupported `Content-Encoding` |

Two things about this list are worth acting on.

**They already carry the right status.** Express's default error handler reads
`err.status`/`err.statusCode`, so if you do nothing at all, a body that is too
large produces a 413 and malformed JSON produces a 400 — correctly, without any
code from you. 🔴 **A custom error handler that maps everything to 500 destroys
that**, and turns a client's malformed request into your alert. Honour
`err.status` unless you have a specific reason not to
([Phase 5 · 04](../../phase-5-errors/04-mapping-to-http.md)).

**`type` is the stable identifier, not the message.** Messages have changed
across body-parser versions; the `type` codes have not. Branch on `err.type`:

```js
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({error: 'payload_too_large', limit: '100kb'});
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({error: 'malformed_json'});
  }
  next(err);
});
```

**Say what the limit is.** A 413 with no number tells the client nothing
actionable; `{limit: '100kb'}` lets them chunk or compress.

## Distinguishing "no body" from "wrong body"

The gates in [chunk 01](01-the-four-gates.md) are silent, so the parser cannot
tell you this — but you can, cheaply, at the boundary:

```js
function requireJsonBody(req, res, next) {
  if (!req.is('json')) {
    return res.status(415).json({error: 'unsupported_media_type', expected: 'application/json'});
  }
  if (req.body === undefined) {
    return res.status(400).json({error: 'missing_body'});
  }
  next();
}
```

Recall from [Phase 3 · 01 ·
chunk 03](../01-req-anatomy/03-reading-headers-and-content.md) that `req.is()`
returns **`null`** when there is no body at all and `false` for a body of another
type — so the check above treats both as "not JSON", which is usually right.

The alternative, and the better one for most APIs: **let the schema do it.** A
`safeParse` on `req.body` fails identically for `undefined` and for `{}`, and
returns per-field messages instead of a generic one
([Phase 8 · 02](../../phase-8-validation-authz/02-validation-factory.md)).

## What Express 5 changed here

| | Express 4 | Express 5 |
|---|---|---|
| `req.body` with no parser | `{}` | **`undefined`** |
| `urlencoded` `extended` default | `true` | **`false`** |
| `body-parser` | a separate install | re-exported from core |
| async parser errors | needed a wrapper | forwarded automatically |

The first two are the ones that break silently on upgrade. The first throws
(`Cannot read properties of undefined`) and is found immediately; **the second
does not throw**, and is found when someone notices addresses are missing a city.

## Trade-off

**Parse globally, validate per route.** Body parsing is cheap for requests it
declines and expensive only for the ones you wanted parsed anyway, so a single
global mount with a conservative `limit` is the right default — and it means the
limit is stated once, in the factory, where it can be reviewed.

Deviate for three reasons and no others:

- **A route needs the raw bytes** — webhooks. Mount `express.raw` on that path,
  above the global JSON parser.
- **A route needs a different limit** — a document upload. Mount a second parser
  at that path with its own `limit`.
- **A route streams the body** — a proxy, a large file. It must not be parsed at
  all; use a `type` function or a path mount so the global parser declines.

**Do not deviate for performance.** A parser that declines at gate 2 or gate 3
has read nothing.

## Gotchas

**Symptom:** A malformed-JSON request pages someone as a 500
**Cause:** A custom error handler that ignores `err.status` and defaults
everything to 500
**Fix:** Read `err.status`/`err.statusCode` first. body-parser already supplies
the correct one

**Symptom:** Error handling broke after a dependency bump, with no code change
**Cause:** Branching on `err.message`, which is not stable across body-parser
versions
**Fix:** Branch on `err.type` — those codes are the stable contract

**Symptom:** Clients get 413 and have no idea what to do
**Cause:** The response says only "too large"
**Fix:** Include the limit in the body. It is not a secret, and it is the only
actionable part

**Symptom:** A 415 fires for a request that looks fine
**Cause:** `charset.unsupported` — the JSON parser accepts only `utf-*` — or
`encoding.unsupported` from a `Content-Encoding` it cannot inflate
**Fix:** Read `err.type` to tell the two apart; they need different client fixes

**Symptom:** Upgrading to Express 5 quietly dropped nested form fields
**Cause:** `extended` now defaults to `false`
**Fix:** Set it explicitly, either way, so the next upgrade cannot move it

## Interview questions

**★ What status does Express return for malformed JSON, and who decided it?**
400. `body-parser` throws an `http-errors` object with `status: 400` and
`type: 'entity.parse.failed'`, and Express's default error handler honours
`err.status`. You get the right answer by writing no code — and lose it the
moment a custom handler maps everything to 500.

**★ How should you branch on body-parser errors?**
On `err.type` — `entity.too.large`, `entity.parse.failed`,
`entity.verify.failed`, `charset.unsupported`, `encoding.unsupported`. The
message strings have changed between versions; the type codes have not.

**★ What status does a failing `verify` hook produce, and why that one?**
403 `entity.verify.failed`. `verify` is modelled as an authenticity check rather
than a syntax check, which is exactly right for a webhook signature — the request
was well-formed, it just was not from who it claimed.

**★ How do you tell "the client sent no body" from "the client sent the wrong
type"?**
Not from the parser — both gates are silent. Check `req.is('json')` (which is
`null` for no body, `false` for another type) and `req.body === undefined` at the
boundary, or let a schema reject both with per-field messages.

**Should body parsing be global or per route?**
Global by default: it is a header check and a `next()` for anything it declines,
and one mount means one reviewable limit. Go per route only when a route needs
the raw bytes, a different limit, or to stream the body itself.

**What are the two silent Express 4 → 5 body changes?**
`req.body` is `undefined` instead of `{}` when no parser ran, and `urlencoded`'s
`extended` defaults to `false` instead of `true`. The first throws immediately;
the second silently drops nested fields, which is the more expensive one.

---

← Prev: [The parsers and their options](02-the-parsers-and-their-options.md) · Index: [JSON and urlencoded](README.md) · Next topic → [Size limits](../03-size-limits.md)
