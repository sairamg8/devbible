---
title: "Choosing and shaping"
sidebar_label: "03 · Choosing and shaping"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**Pick one terminal method per request and one response shape per API. Both are
decisions Express will not make for you, and both are expensive to change once
clients depend on them.**

> Verified: 2026-08-14. The mechanisms this page builds on — `res.send`'s
> dispatch, `res.json`'s `JSON.stringify` delegation, the `json spaces` /
> `json replacer` / `json escape` settings — are read from `express@5.2.1`'s
> `lib/response.js` in `sandbox/express-verify/node_modules/` and quoted in
> [chunk 01](01-what-res-send-does.md). `JSON.stringify`'s treatment of
> `undefined` is per
> [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify).
> **No sandbox run backs this page and it carries no console block.** The shape
> recommendations are **this bible's guidance**, stated as such — Express has no
> opinion on response bodies.

## `res.json` or `res.send`?

**For a JSON API: always `res.json`.** Not because `res.send` is broken, but
because it dispatches on `typeof`, and the moment a value's type varies so does
your content type:

```js
res.send(await getThing(id));
// object  → application/json
// null    → empty body, no content type      ← "not found" becomes a blank 200
// string  → text/html                        ← a stringified id becomes markup
// number  → application/json, body `42`
```

`res.json` removes the variance: it always serialises, always sets
`application/json`, and `null` becomes the JSON literal `null` rather than an
empty response.

**`res.send` earns its place** for `Buffer`s (where the octet-stream default is
right), for pre-rendered HTML, and for the rare endpoint that returns plain text
— with `res.type('txt')` in front of it.

## The three JSON settings, and what they cost

| Setting | Default | When to set it |
|---|---|---|
| `json spaces` | unset | **Never in production.** Pretty-printing adds bytes to every response for a benefit only a human reading raw curl output gets |
| `json replacer` | unset | A global `JSON.stringify` replacer. Tempting for redaction — and dangerous, because it applies to *every* response and is invisible at the call site |
| `json escape` | `false` | `true` escapes `<`, `>`, `&` as `\uXXXX`. Needed only when JSON is embedded in HTML — a `<script>` block — where `</script>` inside a string would otherwise break out |

🔴 **A `json replacer` for redaction is the wrong tool.** It hides the rule far
from the handler, it runs on every response including errors, and it silently
does nothing for a field that gets renamed. Redaction belongs in an explicit
presenter function — which is also the thing that stops `password_hash` riding
along on a row you passed straight through
([Phase 7 · 02](../../phase-7-layering/02-domain-vs-transport.md)).

## Shaping: what a body should contain

Express has no opinion here, so this is the bible's. Three rules that survive
contact with real clients:

**1 · One shape per outcome, decided once.** A success is a success everywhere; an
error is an error everywhere. The specific envelope matters far less than the fact
that a client can write one parser
([Phase 5 · 03](../../phase-5-errors/03-error-contract/README.md)).

**2 · Never return a database row directly.**

```js
res.json(row);                              // ❌ ships whatever the schema has
res.json(presentOrder(row));                // ✅ an explicit, reviewed shape
```

The failure is not hypothetical: it works perfectly until a migration adds
`password_hash`, `internal_notes` or `deleted_at` to the table, and then it ships
them. The defence that actually catches it is a test asserting the **exact key
set** of the response, not the presence of individual fields
([Phase 10 · 03](../../phase-10-app-factory/03-supertest.md)).

**3 · Return the created resource on 201, with a `Location`.**

```js
res.status(201)
   .location(`${req.baseUrl}/${order.id}`)
   .json(presentOrder(order));
```

The id is the one thing the client cannot compute, and making them issue a second
GET for it is a round trip you gave away. Note `req.baseUrl` rather than a
hard-coded prefix — the router does not know where it is mounted
([Phase 1 · 03 · chunk 01](../../phase-1-routing/03-router-composition/01-mounting-a-router.md)).

## `undefined` does not survive

`JSON.stringify` **omits** object properties whose value is `undefined`, and
turns them into `null` inside arrays. So:

```js
res.json({a: 1, b: undefined});     // → {"a":1}         — b is ABSENT
res.json([1, undefined, 3]);        // → [1,null,3]      — becomes null
```

Two consequences worth designing around:

- **"Absent" and "explicitly null" are different states**, and a client cannot
  distinguish "the server omitted it" from "the server does not have it" unless
  you decide. Pick one — either always include the key with `null`, or always omit
  it — and make the presenter enforce it.
- **A `PATCH` API cannot express "clear this field" with `undefined`**, which is
  exactly why JSON Merge Patch (RFC 7386) uses `null` to mean delete — and why it
  therefore cannot set a field *to* null
  ([Phase 6 · 10](../../phase-6-rest-surface/10-patch-and-bulk.md)).

This is also the source of the two known-wrong console blocks in
[Phase 3](../../phase-3-requests/01-req-anatomy/03-reading-headers-and-content.md):
a printed `body: undefined` cannot survive a JSON round trip.

## Buffer or stream?

`res.json` and `res.send` **buffer**: the whole body is serialised into memory,
its length computed, and an ETag generated over it. That is right for
kilobyte-scale responses and wrong for megabyte-scale ones.

| Response | Use | Why |
|---|---|---|
| a record, a page of records | `res.json` | buffering is free at this size, and you get `Content-Length` and an ETag |
| a file on disk | `res.sendFile` | ranges, `Last-Modified`, caching, and no full read into memory |
| a large export | a stream, `pipe`d to `res` | constant memory; you lose `Content-Length` and the ETag |
| a report built from a query | a cursor + a stream | the alternative is holding the whole result set |

The trade when you stream: **no `Content-Length`, so the response is chunked, and
no ETag, so it is not conditionally cacheable.** And a failure partway through has
already sent a 200 — which is the case `if (res.headersSent) return next(err)`
exists for ([Phase 4 · 04](../04-headers-already-sent.md)).

## Trade-off

`res.json` is explicit, uniform and slightly less flexible. `res.send` is
flexible and its flexibility is type-driven, which means a change in a value's
runtime type silently changes your content type.

**For a JSON API, uniformity wins outright**: one terminal method, one shape, one
presenter per resource. The cost is a presenter function per resource that mostly
copies fields — genuinely tedious, and the thing that stops a schema change from
becoming a data leak.

## Gotchas

**Symptom:** An endpoint returns an empty 200 for a missing record
**Cause:** `res.send(null)` — the `null` branch empties the body
**Fix:** Decide the status. A missing record is a 404, not a null body

**Symptom:** A response returns `text/html` once a value happened to be a string
**Cause:** `res.send` dispatches on `typeof`
**Fix:** `res.json` for APIs; `res.type('txt').send(...)` if you really want text

**Symptom:** A new column appeared in the API the day after a migration
**Cause:** `res.json(row)` — the response shape is the table schema
**Fix:** An explicit presenter, plus a test asserting the exact response key set

**Symptom:** A client cannot tell "field omitted" from "field is null"
**Cause:** `JSON.stringify` drops `undefined` properties entirely
**Fix:** Normalise in the presenter — always `null`, or always absent. Do not let
it depend on whether a database column happened to be `NULL`

**Symptom:** Responses got 30% larger with no data change
**Cause:** `app.set('json spaces', 2)` left on in production
**Fix:** Remove it. Pretty-printing is a curl convenience, paid for on every
response

**Symptom:** A large export exhausts memory
**Cause:** `res.json(await getEverything())` buffers the whole thing and then
computes an ETag over it
**Fix:** Stream it, accepting the loss of `Content-Length` and conditional caching

## Interview questions

**★ Why prefer `res.json` over `res.send` in a JSON API?**
Because `res.send` dispatches on `typeof`, so the content type follows the
runtime type of the value: an object is JSON, a string is `text/html`, `null` is
an empty body with no type at all. `res.json` always serialises and always sets
`application/json`.

**★ What happens to `undefined` in a JSON response?**
`JSON.stringify` omits object properties whose value is `undefined` and converts
them to `null` inside arrays. So the key is **absent**, not null — which means
"omitted" and "explicitly null" are different states the client can see, and your
presenter should pick one deliberately.

**★ Why should a handler never `res.json(row)`?**
Because the response shape becomes the table schema. It works until a migration
adds a column, and then the API ships it. The test that catches it asserts the
**exact key set** of the response rather than the presence of individual fields.

**★ What do you lose by streaming a response instead of buffering it?**
`Content-Length` — the response becomes chunked — and the ETag, so it is not
conditionally cacheable. You also lose the ability to fail cleanly: once the
first byte is out, an error cannot change the status.

**Is `app.set('json spaces', 2)` a good idea?**
Not in production. It adds bytes to every response for a benefit only a human
reading raw output gets. If you want readable output for debugging, pretty-print
in the client or in a curl pipe.

**When would you set `json escape`?**
When JSON is embedded in an HTML document — inside a `<script>` block — where a
`</script>` sequence inside a string would end the element early. It escapes `<`,
`>` and `&` as unicode. For an ordinary API response it is unnecessary.

---

← Prev: [The method map](02-the-method-map.md) · Index: [res methods](README.md) · Next topic → [Status and headers](../02-status-and-headers/README.md)
