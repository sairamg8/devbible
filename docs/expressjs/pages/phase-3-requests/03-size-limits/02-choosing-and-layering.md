---
title: "Choosing and layering limits"
sidebar_label: "02 · Choosing and layering"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**`express.json({limit})` is one limit in a stack of at least five, and it is
neither the outermost nor the one that fails most usefully. Set them so the
innermost is smallest, and so the one that rejects is the one that can explain
why.**

> Verified: 2026-08-14. The `limit` default of `"100kb"` and its `bytes`-syntax
> parsing are from **`body-parser@2.3.0`**'s `normalizeOptions` in
> `sandbox/express-verify/node_modules/`; the Node socket-level limits are per the
> [`http.Server`](https://nodejs.org/api/http.html#class-httpserver) documentation
> (`maxHeadersCount`, `headersTimeout`, `requestTimeout`) and the
> `--max-http-header-size` CLI option. **No sandbox run backs this page and it
> carries no console block.** The recommended values are **this bible's guidance**,
> stated as such — there is no upstream recommendation, and the right number is a
> property of your API, not of Express.

## The five layers

| # | Layer | Limits | Fails as |
|---|---|---|---|
| 1 | **Proxy / ingress** — nginx `client_max_body_size`, ALB, Cloudflare | request body | the proxy's own error page — often HTML, often unhelpful |
| 2 | **Node** — `--max-http-header-size` (default 16 kb), `maxHeadersCount` | headers, not body | a socket-level rejection your app never sees |
| 3 | **`express.json({limit})`** and friends | the parsed body | **413 `entity.too.large`**, in your error handler, in your format |
| 4 | **multer `limits.fileSize`** | per-file upload size | `MulterError` with `code: 'LIMIT_FILE_SIZE'` |
| 5 | **the database / storage** | column size, document size, object size | far too late, mid-transaction |

🔴 **Layer 3 is the only one that can produce your error contract.** A body
rejected at the proxy gets the proxy's response — usually an HTML page with no
request id, which a JSON client cannot parse and your logs never see. So the
useful arrangement is:

**proxy limit slightly *above* the app limit.** The proxy is the backstop that
protects the process from bodies your app should never have to read; the app
limit is the one that fires in practice and explains itself. Setting them the
other way round means every oversize request produces an unparseable error from a
layer you do not control.

## Choosing a number

Start from what the endpoint actually accepts, not from a round number:

| API shape | Suggested `limit` | Reasoning |
|---|---|---|
| CRUD JSON — a form, a record | **`'100kb'`** (the default) | a JSON object with dozens of fields is a few kilobytes; 100 kb is already generous |
| Bulk endpoints — an array of records | **`'1mb'`**, plus a **row cap** | the row cap is the real control; bytes are a proxy for it |
| Documents, rich text, embedded images | **`'5mb'`–`'10mb'`**, on that route only | and consider whether it should be an upload instead |
| File uploads | **not a JSON limit at all** | multipart, with multer's `limits` — [page 07](../07-multipart-uploads.md) |
| A proxy or streaming route | **no parser** | it must not be buffered at all |

**For bulk endpoints, cap the item count as well as the bytes.** A 1 MB array of
10,000 tiny objects is a 10,000-row transaction, and the byte limit said nothing
about that. The count is the limit that maps to work
([Phase 6 · 10](../../phase-6-rest-surface/10-patch-and-bulk.md)).

**The `bytes` syntax** is what `limit` accepts — `'100kb'`, `'1mb'`, `'5mb'` — and
an unparseable value **throws at mount time**, which is the good outcome. A bare
number is bytes.

## Per-route limits

```js
// app.js — the conservative default
app.use(express.json({limit: '100kb'}));

// routes/documents.js — one route that needs more, and says so
router.put('/:id/content',
  express.json({limit: '5mb'}),
  requireAuth,
  replaceContent);
```

Both parsers run for that route; the route-level one runs first if it is mounted
first, and the global one then declines at the already-consumed gate
([chunk 01 of the previous topic](../02-json-and-urlencoded/01-the-four-gates.md)).
The version that reliably does what you want is the route-level parser mounted
**on the route**, as above, because the route's own stack runs before the request
ever reaches the global mount only if the global mount is below it — so in
practice:

- **Put the global parser at the top** and give the exception route a **path
  mount above it**, or
- **use a `type` function** on the global parser that declines the exception path,
  and mount the bigger parser on the route.

The second is the more readable of the two, because the exception is stated once
in the factory rather than depending on the order of two mounts.

## Document the limit

The limit is part of your API contract, and there are three places it should
appear:

1. **In the OpenAPI description** for the endpoint
   ([Phase 6 · 08](../../phase-6-rest-surface/08-openapi.md)).
2. **In the 413 response body** — `{error: 'payload_too_large', limit: '100kb'}`.
   It is not a secret, and it is the only actionable part of the response.
3. **In the config**, as a named constant rather than a literal buried in a
   `app.use` call, so raising it is a reviewable change.

## Trade-off

**Tight limits protect memory and fail honest large clients.** Loose limits
accept everything and turn one client's mistake into your incident.

The asymmetry that decides it: **a limit that is too low produces a clear 413 the
client can act on; a limit that is too high produces an out-of-memory kill that
takes every in-flight request with it.** Err low, document the number, and raise
it deliberately for the one route that needs it.

And the structural point — **if a payload is genuinely large, it should not be a
JSON body.** Direct the client to an upload endpoint or to presigned object
storage, and let the API carry a reference. Streaming large payloads belongs in
streams and files ([Node Phases 3–4](/docs/nodejs/pages/README.md)), not in an
unbounded `express.json()`.

## Gotchas

**Symptom:** Large requests fail with an HTML error page and no request id
**Cause:** The proxy's limit is lower than the app's, so it rejects first with its
own error format
**Fix:** Proxy limit slightly **above** the app limit, so your 413 is the one that
fires

**Symptom:** The process is OOM-killed under load
**Cause:** No explicit limit on a public parser, or one raised globally to serve a
single route
**Fix:** Set the limit explicitly and conservatively; raise it per route, never
globally

**Symptom:** A bulk endpoint with a 1 MB limit still times out
**Cause:** The byte limit says nothing about item count. 1 MB of small objects is
thousands of rows in one transaction
**Fix:** Cap the item count too, and reject over-count with a clear message

**Symptom:** `app.use(express.json({limit: 5000000}))` — nobody can tell what that
is
**Cause:** A raw byte count
**Fix:** `'5mb'`. The `bytes` syntax is accepted and readable, and an invalid
string fails at mount time rather than silently

**Symptom:** A route that streams a large body buffers it all into memory
**Cause:** A global parser matched its content type
**Fix:** Exclude that path — a `type` function on the global parser, or a mount
that does not cover it

## Interview questions

**★ Where should the body-size limit live?**
In several places, ordered so the application's is the one that fires: the proxy
slightly above the app, the app's `express.json({limit})` as the practical limit,
multer's `limits` for uploads. Only the application layer can produce your error
contract with a request id; a proxy rejection is an opaque page.

**★ What is the default limit, and is it a good one?**
100 kb, for all four parsers. It is a good default for CRUD JSON and too small
for documents — which is the point: raise it per route, deliberately, rather than
globally.

**★ Why cap item count as well as body size on a bulk endpoint?**
Because bytes are a poor proxy for work. A 1 MB array of ten thousand small
objects is a ten-thousand-row transaction, and the byte limit had nothing to say
about it. The count is the limit that maps to what the server actually does.

**★ Should the proxy limit be above or below the app limit?**
Above. The proxy is the backstop for bodies the process should never read; the
app limit is the one you want to fire, because it is the only one that can answer
in your error format with your request id.

**When is a size limit the wrong tool entirely?**
When the payload is genuinely large. A 50 MB JSON body should be an upload to
object storage with a reference in the API, not a raised limit — raising the limit
just moves the memory problem into your process.

**How do you give one route a larger limit safely?**
Mount a parser with the larger limit on that route, and make sure the global
parser does not claim the request first — either by mounting the exception above
it or by giving the global parser a `type` function that declines that path.

---

← Prev: [Two paths to 413](01-two-paths-to-413.md) · Index: [Size limits](README.md) · Next → [What a limit does not protect](03-what-it-does-not-protect.md)
