---
title: "HTTP in practice"
sidebar_label: "03 · HTTP in practice"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Methods, status codes, headers, content negotiation and CORS — the parts of the
protocol you argue about in code review, and the parts Node enforces for you
whether you asked or not.**

## Methods, and the two properties that matter

| Method | Safe | Idempotent | Body | Notes |
|---|---|---|---|---|
| `GET` | ✅ | ✅ | no | Cacheable. Never mutate in a GET — crawlers and prefetchers will find it |
| `HEAD` | ✅ | ✅ | no | Same headers as GET, body discarded by Node |
| `POST` | ❌ | ❌ | yes | The only non-idempotent verb. Retries need an idempotency key ([page 08](08-outbound-client-discipline.md)) |
| `PUT` | ❌ | ✅ | yes | Full replacement. Sending the same PUT twice is one write |
| `PATCH` | ❌ | ❌ | yes | Partial update; not idempotent unless you design it so |
| `DELETE` | ❌ | ✅ | no* | Second call is a no-op — return 204 either way, not 404 |
| `OPTIONS` | ✅ | ✅ | no | CORS preflight, below |

**Idempotent** means *n* identical requests leave the same state as one. It is
what decides whether a proxy, a load balancer or a client library may retry
automatically. Getting it wrong is how a payment gets taken twice.

## Status codes you will actually send

| Code | When |
|---|---|
| `200` / `201` / `204` | OK · created (send `Location`) · success with nothing to say |
| `301` / `302` / `304` | moved permanently · found · not modified (conditional GET) |
| `400` | malformed — the request itself is broken |
| `401` / `403` | not authenticated · authenticated but not allowed |
| `404` / `409` / `410` | absent · conflicts with current state · deliberately gone |
| `413` / `415` / `422` | too large · unsupported media type · syntactically valid, semantically wrong |
| `429` | rate limited — always with `Retry-After` |
| `500` / `502` / `503` / `504` | you broke · upstream broke · not accepting work · upstream too slow |

The distinctions that get argued: **401 vs 403** is *who are you* vs *you may
not*; **400 vs 422** is *I cannot parse this* vs *I parsed it and it is wrong*;
**404 vs 403** on a resource you are not allowed to see is a judgement call —
404 hides existence, 403 admits it.

Node drops the body on statuses that forbid one:

```console
$ node fund.mjs
HEAD  -> 200 | content-length header: null | body bytes: 0
GET   -> 200 | body bytes: 10
204   -> 204 | body bytes: 0 | content-length: null
```

`res.end('this body is dropped')` on a 204 sends nothing, and the same handler
answering `HEAD` sends headers only. You do not need to special-case either.

## Content negotiation

```js
if (req.url === '/nego') {
  const accept = req.headers.accept ?? '';
  const wantsJson = accept.includes('application/json');
  res.writeHead(wantsJson ? 200 : 406, { 'Content-Type': 'application/json', Vary: 'Accept' });
  res.end(wantsJson ? '{"ok":true}' : '');
}
```

```console
$ node fund.mjs
nego json -> 200
nego html -> 406 | Vary: Accept
```

**Any response that varies by a request header must say so in `Vary`.** Without
it a shared cache serves the JSON representation to the client that asked for
HTML. The same rule applies to `Accept-Encoding` and to `Origin` below.

`includes()` is a simplification — real `Accept` headers carry quality values
(`text/html,application/xhtml+xml;q=0.9,*/*;q=0.8`). Parse them properly with
`negotiator` if content negotiation is load-bearing; most JSON APIs simply
declare `application/json` and stop.

## Headers worth knowing

| Header | Direction | Why |
|---|---|---|
| `Content-Type` | both | Includes the charset: `application/json; charset=utf-8`. Split on `;` before comparing |
| `Content-Length` / `Transfer-Encoding` | both | Exactly one of them. Node sets whichever fits |
| `Cache-Control` | response | `no-store` for anything user-specific; `public, max-age=31536000, immutable` for hashed assets |
| `ETag` / `If-None-Match` | both | Conditional GET → 304 with no body |
| `Authorization` | request | Never log it. Never put it in a URL |
| `X-Forwarded-For` / `-Proto` / `-Host` | request | Set by *your* proxy. Trusting them from the internet is a spoof |
| `Retry-After` | response | Seconds or an HTTP date; honour it on the calling side |

## CORS is a browser rule, not a server one

The single most misunderstood thing in this phase:

```console
$ node fund.mjs
cross-origin from Node -> 200 | X-Secret readable: not-cors-exposed
```

Node's `fetch` sent an `Origin` header, the server returned no CORS headers at
all, and the request succeeded with every header readable. **CORS is enforced by
the browser against its own JavaScript.** It is not access control. A server that
relies on CORS to keep data private is protected against nobody with a terminal.

What it *does* prevent is a page on `evil.test` reading a response from
`api.yours.com` using the visitor's cookies. That is worth having:

```js
const ALLOWED = new Set(['https://app.example.com', 'http://localhost:5173']);

function cors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');                       // or caches poison each other
  if (!origin || !ALLOWED.has(origin)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);  // echo it, never '*' with credentials
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
    res.setHeader('Access-Control-Max-Age', '600');
    res.writeHead(204).end();
    return true;
  }
  res.setHeader('Access-Control-Expose-Headers', 'x-request-id');
  return false;
}
```

```console
$ node cors.mjs
preflight allowed  : 204 | allow-origin: https://app.example.com | vary: Origin | expose: null
preflight rejected : 200 | allow-origin: null | vary: Origin | expose: null
actual request     : 200 | allow-origin: https://app.example.com | vary: Origin | expose: x-request-id
no Origin at all   : 200 | allow-origin: null | vary: Origin | expose: null
```

Read the second line carefully: the rejected preflight still got a **200 with a
body**. The server answered it. The browser is what refuses to proceed, because
no `Access-Control-Allow-Origin` came back. Every line of this is advisory.

Four rules the spec enforces and people trip over:

1. **A preflight only happens for non-simple requests** — a custom header, a
   non-simple method, or a `Content-Type` outside
   `text/plain` / `multipart/form-data` / `application/x-www-form-urlencoded`.
   Sending JSON always triggers one, which is why "it works with form data".
2. **`*` and credentials are mutually exclusive.** With
   `Access-Control-Allow-Credentials: true`, the origin must be echoed literally.
3. **Browsers expose only the safelisted response headers** — `Cache-Control`,
   `Content-Language`, `Content-Type`, `Expires`, `Last-Modified`, `Pragma`.
   Anything else needs `Access-Control-Expose-Headers`, which is why your
   `x-request-id` is `null` in the console and present on the wire.
4. **`Vary: Origin` is not optional** when the allow-origin value depends on the
   request.

In production this is `app.use(cors({ origin: ALLOWED, credentials: true }))`.
Knowing what it emits is what lets you debug it.

## Gotchas

**Symptom:** A cache serves JSON to a browser that asked for HTML
**Cause:** The response varies by `Accept` without a `Vary` header.
**Fix:** `Vary: Accept` — and `Vary: Origin` on anything CORS-dependent.

**Symptom:** CORS errors only on `PATCH`/`DELETE` or once an auth header is added
**Cause:** Those make the request non-simple, so a preflight now happens and
`OPTIONS` is unhandled.
**Fix:** Answer `OPTIONS` with the allow-methods and allow-headers lists.

**Symptom:** `Access-Control-Allow-Origin: *` stops working after cookies are added
**Cause:** Wildcard origin is illegal with credentials.
**Fix:** Echo the validated origin.

**Symptom:** A header is visible in curl and `undefined` in the browser
**Cause:** It is not on the CORS safelist.
**Fix:** `Access-Control-Expose-Headers`.

**Symptom:** A GET request mutated data after a link preview crawler hit it
**Cause:** A non-safe operation behind a safe method.
**Fix:** GET never writes.

**Symptom:** Duplicate charges after a network blip
**Cause:** A client retried a non-idempotent POST.
**Fix:** Idempotency keys ([page 08](08-outbound-client-discipline.md)).

## Interview questions

**★ Is CORS a security mechanism?**
It protects the *browser's* user — it stops a page on one origin reading a
response from another using ambient credentials. It does nothing about a request
from curl, a server, or any client that chooses not to enforce it, so it is never
authorisation. Proven above: a Node `fetch` with a spoofed `Origin` read the whole
response from a server that sent no CORS headers.

**★ Difference between safe and idempotent, with an example of each mistake?**
Safe means no state change at all (GET, HEAD). Idempotent means repeating it
changes nothing more (PUT, DELETE). A GET that mutates gets triggered by
prefetchers; a POST treated as idempotent by a retrying proxy charges twice.

**★ When does a browser send a preflight?**
When the request is not "simple": a method beyond GET/HEAD/POST, any non-safelisted
header, or a `Content-Type` other than the three form types. Posting JSON always
preflights.

**★ 401 or 403? 400 or 422?**
401 means unauthenticated — the credential is missing or invalid, and a `WWW-Authenticate`
header should say how to fix it. 403 means authenticated and refused. 400 means the
request could not be parsed; 422 means it parsed and violates a business rule.

**Why must a 204 have no body?**
The status is defined as "no content", so the framing rules give it no body — Node
discards anything you write. Same for 304 and for any response to HEAD.

**What is `Vary` for?**
It tells shared caches which request headers the response depends on, so they key
their entries by those headers instead of by URL alone.

---

← Prev: [Request bodies](02-request-bodies.md) · Next → [Cookies](04-cookies.md)
