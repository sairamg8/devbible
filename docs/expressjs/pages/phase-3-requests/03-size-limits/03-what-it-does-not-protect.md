---
title: "What a limit does not protect"
sidebar_label: "03 · What it does not protect"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**A body-size limit bounds one request. It says nothing about how many requests,
how slowly they arrive, how expensive a small body can be, or how much memory the
parsed object occupies.**

> Verified: 2026-08-14. The slow-client and header limits are Node's, per the
> [`http.Server`](https://nodejs.org/api/http.html#class-httpserver) documentation
> — `headersTimeout` and `requestTimeout` — and the `--max-http-header-size`
> option. The `limit`-applies-to-decompressed-size behaviour is read from
> `body-parser@2.3.0`'s `contentstream` in `sandbox/express-verify/node_modules/`
> and covered in [chunk 01](01-two-paths-to-413.md). **No sandbox run backs this
> page and it carries no console block.** The threat framing and the mitigations
> are this bible's guidance, stated as such — Express documents none of this.

## Five things it does not cover

**1 · Many requests.** One 100 kb body is fine; ten thousand of them concurrently
is 1 GB. `limit` is per request and has no notion of concurrency. The companion
control is rate limiting, keyed correctly — which means `trust proxy` must be
right, or the limiter counts fabricated addresses
([Phase 9 · 01](../../phase-9-hardening/01-trust-proxy/README.md),
[Phase 9 · 04](../../phase-9-hardening/04-rate-limiting.md)).

**2 · Slow clients.** A client that sends one byte per second, forever, stays
under any limit and holds a socket and a partially-filled buffer indefinitely.
Nothing in Express addresses this; the controls are Node's, at the socket:

```js
server.headersTimeout = 10_000;   // time to send the complete header block
server.requestTimeout = 30_000;   // time for the whole request, headers + body
```

Both default to non-zero values in current Node, but they are worth setting
explicitly, because the correct value is a property of your clients — a mobile app
on a bad connection is not an attacker.

**3 · Small bodies that are expensive.** `limit` measures bytes, not work:

| A tiny body that costs a lot | Why |
|---|---|
| `{"limit": 1000000}` | an unbounded page size — a database scan and a huge response |
| `{"regex": "(a+)+$"}` | catastrophic backtracking, if it reaches a regex engine — ReDoS |
| `{"ids": [1,2,…,5000]}` | 5,000 lookups, or one query with a 5,000-element `IN` |
| `{"depth": {"a":{"b":{…}}}}` | deep nesting a recursive validator or serialiser walks |
| a two-line GraphQL query | arbitrary joins |

**Byte limits and semantic limits are different controls.** Cap `limit`, cap
array lengths, cap `?limit=`, cap nesting depth
([Phase 6 · 03](../../phase-6-rest-surface/03-pagination/README.md),
[Phase 8 · 03](../../phase-8-validation-authz/03-coercion-traps.md)).

**4 · Memory after parsing.** The limit bounds the *bytes on the wire*. A 100 kb
JSON document becomes a JavaScript object graph several times that size — every
string, every object header, every array. If you then copy it, map it and hold
the result while awaiting a database call, the peak is a multiple of the limit and
you are holding it once per concurrent request.

**5 · Multipart.** `express.json({limit})` never sees a `multipart/form-data`
body — none of the four built-in parsers claims that type. Uploads are bounded by
multer's `limits`, whose `fileSize` **defaults to `Infinity`**, and whose README
warns that memory storage can *"run out of memory"* and to *"never add multer as a
global middleware"*. A JSON limit gives you no protection there at all
([page 07](../07-multipart-uploads.md)).

## The compressed-body case, restated as a threat

From [chunk 01](01-two-paths-to-413.md): a compressed body cannot be rejected
from its headers, because `req.length` is not set for a non-`identity` encoding.
So a 2 kb gzipped payload that inflates to gigabytes is:

- **bounded in memory** — inflation stops at `limit`, so you never hold more than
  that;
- **not bounded in CPU per request** — you paid to inflate up to `limit` bytes
  before refusing;
- **not bounded in aggregate** — a thousand such requests cost a thousand times
  that, which is the rate limiter's problem, not the parser's.

If a route has no reason to accept compressed bodies, `inflate: false` removes
the question entirely and returns **415 `encoding.unsupported`**.

## What a complete picture looks like

Layered, innermost first, each one covering a different axis:

| Control | Bounds | Where |
|---|---|---|
| `express.json({limit})` | bytes per request | the app |
| `server.headersTimeout` / `requestTimeout` | time per request | the server object |
| a rate limiter | requests per client per window | above the routes |
| a concurrency cap / queue | requests in flight | the process or the proxy |
| array-length and `?limit=` caps | work per request | the schema |
| statement timeouts | time per query | the database |
| multer `limits` | upload size and count | the upload route |

🔴 **Note what is *not* on that list: a timeout does not cancel work.** Nothing in
Express or Node unwinds an in-flight `await`, so a request that has been given up
on still holds its pooled connection
([Phase 9 · 06](../../phase-9-hardening/06-timeouts-and-secrets.md)).

## Trade-off

Every control above costs something — a legitimate large client refused, a slow
mobile connection cut off, a bulk import that has to be chunked. The honest
position is that **these are availability controls, and availability is a
trade against convenience for the well-behaved**.

The order to add them in, by value per unit of pain:

1. **A body limit** — one line, protects against the single worst case, already
   on by default.
2. **A rate limiter** — the one control that covers "many requests", which is the
   most common real attack.
3. **Semantic caps** — array lengths and page sizes, because they map to actual
   work and are cheap to express in a schema.
4. **Socket timeouts** — worth setting explicitly once you know your clients.
5. **Concurrency caps** — last, because they are the easiest to get wrong and the
   most likely to hurt legitimate traffic.

## Gotchas

**Symptom:** Memory grows under load even though every body is under the limit
**Cause:** Concurrency. `limit` is per request; a thousand concurrent 100 kb
bodies is 100 MB before parsing, and several times that after
**Fix:** Rate limiting and a concurrency cap. The body limit was never the control
for this

**Symptom:** Sockets accumulate and the process stops accepting connections
**Cause:** Slow clients — a byte at a time stays under any size limit forever
**Fix:** `server.headersTimeout` and `server.requestTimeout`, set to values your
real clients can meet

**Symptom:** A 200-byte request takes the database down
**Cause:** `?limit=1000000`, or a 5,000-element id array. Bytes are not work
**Fix:** Cap the semantics in the schema — page size, array length, nesting depth

**Symptom:** File uploads are unbounded despite a JSON limit
**Cause:** `multipart/form-data` is not claimed by any built-in parser, and
multer's `limits.fileSize` defaults to `Infinity`
**Fix:** Set multer's `limits` explicitly, and never mount it globally

**Symptom:** CPU spikes from a handful of small requests
**Cause:** Compressed bodies. A compressed payload has to be inflated up to
`limit` before it can be refused
**Fix:** `inflate: false` where compression is not needed, plus rate limiting

## Interview questions

**★ What does a body-size limit *not* protect you from?**
Concurrency (it is per request), slow clients (a byte per second stays under any
limit), expensive small bodies (`?limit=1000000`, a 5,000-element array), the
memory the parsed object graph occupies after parsing, and multipart uploads,
which no built-in parser claims.

**★ How do you defend against a slow-client attack in Express?**
You do not — the controls are Node's, on the server object: `headersTimeout` for
the header block and `requestTimeout` for the whole request. Express has no
timeout of any kind.

**★ Why is `{"limit": 1000000}` more dangerous than a 1 MB body?**
Because bytes are not work. That body is twenty characters and asks for a
million-row scan and a response to match. Byte limits and semantic limits are
different controls, and the semantic one belongs in the schema.

**★ Are uploads covered by `express.json({limit})`?**
No. None of the four built-in parsers claims `multipart/form-data`. Uploads are
multer's, whose `limits.fileSize` defaults to `Infinity`, and whose own README
warns against mounting it globally.

**Why does a compressed body cost more than its size suggests?**
Because it cannot be refused from its headers — `req.length` is unset for a
non-identity encoding — so the server inflates up to `limit` bytes before
deciding. Memory is bounded; the CPU to inflate that much is not, per request.

**In what order would you add availability controls to an existing API?**
Body limit first (one line, already defaulted), then a rate limiter (covers the
most common real attack), then semantic caps in the schema, then socket timeouts
once you know your clients, and concurrency caps last, because they are the
easiest to set wrongly and the most likely to hurt legitimate traffic.

---

← Prev: [Choosing and layering limits](02-choosing-and-layering.md) · Index: [Size limits](README.md) · Next topic → [Query parser](../04-query-parser.md)
