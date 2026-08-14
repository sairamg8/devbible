---
title: "Request-id middleware"
sidebar_label: "02 · Request id"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

**Generate or accept `X-Request-Id`, set on `req`, return on the response, continue with AsyncLocalStorage (Node Phase 10).**

> Verified: 2026-08-14 — **no sandbox run**. Express provides **no request id**; this is
> ordinary middleware relying on the documented ability to *"modify the request and
> response objects"* ([using middleware](https://expressjs.com/en/guide/using-middleware.html)),
> with `req.get()` reading headers case-insensitively and `res.set()` writing them
> ([request](https://expressjs.com/en/5x/api/request/) /
> [response](https://expressjs.com/en/5x/api/response/) references).
> `crypto.randomUUID()` is a Node global (Web Crypto), and `AsyncLocalStorage` is
> [`node:async_hooks`](https://nodejs.org/api/async_hooks.html) — the mechanism is
> [Node Phase 10](../../../nodejs/pages/phase-10-observability/README.md), not repeated here.
> **`X-Request-Id` is a convention, not a standard.** The IETF's standardised alternative
> is `traceparent` from the W3C
> [Trace Context](https://www.w3.org/TR/trace-context/) recommendation, which is what
> OpenTelemetry propagates — worth knowing before inventing your own header.

```js
app.use((req, res, next) => {
  const id = req.get('x-request-id') || crypto.randomUUID();
  req.requestId = id;
  res.set('X-Request-Id', id);
  next();
});
```

## Mount it first, and know what "accept" costs

It goes **above everything** — logs, errors, rate limits and the router all want the
id, and anything mounted earlier produces log lines you cannot correlate.

Accepting an inbound id is what makes a trace continuous across a gateway, a
front-end, and three services. It also means **a client controls a value that ends
up in your logs**, so treat it as untrusted input like anything else:

```js
const INBOUND = /^[A-Za-z0-9._-]{8,128}$/;

app.use((req, res, next) => {
  const inbound = req.get('x-request-id');
  req.requestId = INBOUND.test(inbound ?? '') ? inbound : crypto.randomUUID();
  res.set('X-Request-Id', req.requestId);
  next();
});
```

Without that guard: a 10 MB header value in every log line, newlines that let an
attacker forge log entries, or non-ASCII that breaks a downstream parser. **Bound
the length, restrict the alphabet, otherwise generate your own.** It is three lines
and removes a log-injection surface.

Whether to accept at all depends on the edge: **if your proxy sets a trusted id,
prefer that one**; if you are directly internet-facing, generating your own is
defensible and simpler.

## Returning it is the point

`res.set('X-Request-Id', …)` is what turns a user's bug report into a lookup. A
support workflow where someone pastes an id from an error screen and you find the
exact request beats "it failed around 2pm" by an enormous margin — which is also
why the id belongs in the **error response body**
([Phase 5](../phase-5-errors/03-error-contract.md)), not just the header.

Propagate it outbound too. An id that stops at your process is half a trace: pass
it on every outgoing HTTP call and into every enqueued job, or the second hop is
unlinkable.

## Why `AsyncLocalStorage`, and its one real cost

Threading `req.requestId` through every function signature works and is honest —
and it stops being practical three layers down, where a repository has no business
knowing about requests.

`AsyncLocalStorage` keeps a value available for the lifetime of an async call chain
without passing it, so a logger deep in a service can retrieve the current request
id. The cost is that it is **implicit context**: a function's dependencies no
longer appear in its signature, which is the same objection
[Phase 7](../phase-7-layering/02-domain-vs-transport.md) raises about reading
`req` in a service.

The distinction worth holding: **use it for cross-cutting observability, not for
business data.** A request id and a logger are fine. Pulling the current user or
tenant out of ambient storage instead of passing it is how authorisation checks
become invisible and untestable.

## Trade-off

Request ids cost one header, one middleware and a field on every log line. There is
essentially no argument against having them, and the benefit — every log line for
one request joinable, across services — is what makes an incident tractable.

The real decision is **`X-Request-Id` versus W3C `traceparent`**. Your own header is
simpler and understood by nothing else. `traceparent` is standardised, propagated
automatically by OpenTelemetry, and understood by every tracing backend — at the
cost of adopting that toolchain. **If you already run OpenTelemetry, use its
context and do not invent a second id.** If you do not, `X-Request-Id` is a fine
place to start, and the two can coexist.

## Gotchas

**Symptom:** Some log lines have no request id  
**Cause:** Middleware mounted above the request-id middleware  
**Fix:** Mount it first, before logging, helmet, CORS and the router

**Symptom:** A log line contains newlines and forged-looking entries  
**Cause:** An unvalidated inbound `X-Request-Id`  
**Fix:** Validate length and alphabet; generate your own when it fails

**Symptom:** The id is in the logs but users cannot report it  
**Cause:** Not returned in the response header or the error body  
**Fix:** `res.set` it, and include it in the error envelope

**Symptom:** Traces break at the first outbound call  
**Cause:** The id is not propagated to downstream services or jobs  
**Fix:** Forward it on outgoing requests and include it in job payloads

**Symptom:** `AsyncLocalStorage` returns `undefined` inside a callback  
**Cause:** The context was not established, or the chain broke across a boundary the
store does not follow  
**Fix:** Wrap the request in `als.run(...)` at the middleware, and treat a missing value
as a bug in propagation — Node Phase 10

**Symptom:** A service reads the tenant id from ambient storage and a test cannot set it  
**Cause:** Business data in `AsyncLocalStorage`  
**Fix:** Ambient context for observability only; business data travels in arguments

## Interview questions

**★ Why accept inbound request ids?**  
Trace continuity across gateways and clients.

**★ What is the risk of accepting an inbound request id, and how do you handle it?**  
It is client-controlled input that lands in your logs — an oversized value, newlines
for log injection, or characters that break a downstream parser. Validate length and
alphabet, and generate your own when it fails.

**★ Where should the request-id middleware be mounted, and why there?**  
First. Everything downstream — logging, errors, rate limiting, the router — wants the
id, and anything mounted above it produces log lines that cannot be correlated.

**Why return it to the client?**  
So a user's report becomes a lookup instead of a search. It belongs in the response
header and in the error body, since those are the two places a person can copy it from.

**What is `AsyncLocalStorage` for here, and what should it not carry?**  
It keeps the id available down an async call chain without threading it through every
signature — good for observability. It should not carry business data such as the
current user or tenant, because that makes dependencies invisible and authorisation
untestable.

**`X-Request-Id` or `traceparent`?**  
`traceparent` is the W3C Trace Context standard and what OpenTelemetry propagates, so
prefer it if you have that toolchain. `X-Request-Id` is a convention — simpler, and
understood by nothing outside your own system.


---

← Prev: [createApp](01-create-app.md) · Next → [Supertest](03-supertest.md)
