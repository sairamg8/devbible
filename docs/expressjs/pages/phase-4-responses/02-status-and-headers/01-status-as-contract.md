---
title: "Status as contract"
sidebar_label: "01 · Status as contract"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**The status code is the only part of your response every intermediary
understands. Browsers, caches, proxies, SDK generators and retry logic all act on
it — and none of them read your JSON.**

> Verified: 2026-08-14 on **Express 5.2.1**. `res.status`'s two guards are read
> from `express@5.2.1`'s `lib/response.js` in
> `sandbox/express-verify/node_modules/`, quoted below; the Express 5 restriction
> is also in the
> [migration guide](https://expressjs.com/en/guide/migrating-5.html) and
> `res.status` is documented as *"a chainable alias of Node's
> `response.statusCode`"*
> ([response reference](https://expressjs.com/en/5x/api/response.html)). Status
> semantics are [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §15.
> **No sandbox run backs this page and it carries no console block.** Which code
> to choose for which operation is **this bible's guidance** where the RFC leaves
> it open, and says so inline.

## `res.status` throws now

```js
// express/lib/response.js — res.status()
if (!Number.isInteger(code)) {
  throw new TypeError(`Invalid status code: ${JSON.stringify(code)}. Status code must be an integer.`);
}
if (code < 100 || code > 999) {
  throw new RangeError(`Invalid status code: ${JSON.stringify(code)}. Status code must be greater than 99 and less than 1000.`);
}
this.statusCode = code;
return this;
```

Two distinct error types, and both are new in Express 5:

- **`TypeError`** for a non-integer — including `'404'` as a string, `404.0` is
  fine, `NaN` is not. A status computed from `parseInt` of something absent
  produces `NaN` and now throws instead of silently writing garbage.
- **`RangeError`** for anything outside 100–999.

🔴 **This turns a class of silent bug into a loud one — and a loud one into an
outage if you were relying on it.** An error-mapping table that emitted a
made-up code (`res.status(err.code)` where `err.code` is `'ECONNREFUSED'`)
worked by accident on Express 4 and throws on Express 5 — inside your error
handler, which then has nowhere to go
([Phase 5 · 04](../../phase-5-errors/04-mapping-to-http.md)). Map to a known
code, and default.

Note it is still **chainable and non-terminal**: it sets a field and returns
`res`. `return res.status(400)` hangs
([Phase 2 · 03 · chunk 02](../../phase-2-middleware/03-next-semantics/02-the-hang.md)).

## The codes worth being deliberate about

Success:

| Code | Use for | Body |
|---|---|---|
| **200** | a read, or an update that returns the new state | the resource |
| **201** | a create | the created resource, plus a `Location` header |
| **202** | accepted, work not finished — RFC 9110 calls it *"intentionally noncommittal"* | an **id**, not a snapshot |
| **204** | a success with genuinely nothing to say — usually DELETE | **none**, and `res.send` enforces that |
| **206** | a range response | the requested range |

Client fault:

| Code | Means | The distinction that matters |
|---|---|---|
| **400** | malformed — the server could not understand it | syntax, not permission |
| **401** | not authenticated | tells a client to **re-authenticate and retry** |
| **403** | authenticated, not permitted | retrying will not help |
| **404** | not found — **or deliberately hidden** | see below |
| **405** | wrong method — **must carry `Allow`**, and Express never sends it | [Phase 1 · 01 · chunk 03](../../phase-1-routing/01-http-methods/03-405-and-method-semantics.md) |
| **409** | a conflict with current state — a duplicate, a version mismatch | the client can resolve it and retry |
| **412** | a failed precondition (`If-Match`) — **your handler must evaluate it** | [Phase 6 · 07](../../phase-6-rest-surface/07-etag-and-cache.md) |
| **415** | unsupported media type | body-parser already sends this for a bad charset |
| **422** | syntactically valid, semantically wrong | see the note below |
| **429** | rate limited — **send `Retry-After`** | [Phase 9 · 04](../../phase-9-hardening/04-rate-limiting.md) |

Server fault:

| Code | Use for |
|---|---|
| **500** | anything unexpected. A generic public body, the detail in the log |
| **502** / **504** | an upstream failed or timed out — meaningful only if you are in front of something |
| **503** | you are deliberately refusing — shutting down, overloaded. Send `Retry-After` |

## The three that generate arguments

**401 vs 403 is behavioural, not cosmetic.** A 401 tells the client "authenticate
and try again", so using it for an authorization failure produces a **retry loop
that can never succeed** — the client refreshes its token, gets a valid one, and
is refused again. Use 403 when the caller is who they say and still may not.

**400 vs 422.** RFC 9110 defines 400 as "the server cannot or will not process
the request due to something perceived to be a client error", which covers both
cases. 422 comes from WebDAV and is widely borrowed for "well-formed but
semantically invalid" — a valid JSON body that fails your schema. **Both are
defensible; pick one and be consistent.** This bible uses **400 for everything
the client got wrong at the request level**, because a client that must
distinguish them can read the error body, and one that cannot handles all 4xx the
same way anyway.

🔴 **404 vs 403 is a security decision, not a semantic one.** A 403 confirms the
resource exists. For anything cross-tenant, **answer 404** — the caller must not
be able to enumerate what they cannot see
([Phase 8 · 07](../../phase-8-validation-authz/07-ownership.md)).

## Why "always 200 with `{success: false}`" fails

It is a real pattern and it costs real things:

- **Caches cache it.** A 200 is cacheable by default; your error is now served
  from a CDN to other users.
- **Retry logic cannot work.** Every HTTP client, queue and service mesh decides
  whether to retry from the status. A 200 is never retried, so a transient
  failure becomes permanent.
- **Monitoring goes blind.** Error rate is computed from status codes. An API
  that returns 200 for everything has a 0% error rate on every dashboard while
  failing completely.
- **Generated SDKs cannot express it.** OpenAPI models responses per status; a
  single 200 with a discriminated union is a shape most generators handle badly.

The counter-argument — "we want one response shape" — is answered by keeping the
shape consistent *within* each class, not by collapsing the classes
([Phase 5 · 03](../../phase-5-errors/03-error-contract/README.md)).

## Trade-off

**Rich status codes help clients; over-fine codes confuse them.** A public API
that distinguishes 409 from 412 from 422 is more precise and demands more of every
integrator, and most of them will collapse it back to `if (status >= 400)`.

The defensible middle: **use the status class correctly and always; use specific
codes only where a client would genuinely act differently.** 401 vs 403 changes
client behaviour, so it earns its distinction. 400 vs 422 usually does not, so
pick one. And whatever you choose, **align it with the OpenAPI document** so the
contract is stated once
([Phase 6 · 08](../../phase-6-rest-surface/08-openapi.md)).

## Gotchas

**Symptom:** `res.status(err.code)` throws `RangeError` inside the error handler
**Cause:** Express 5 rejects anything outside 100–999, and `err.code` was a string
like `'ECONNREFUSED'` — which throws `TypeError` first
**Fix:** Map through a table with a 500 default. The throw is the framework
telling you the mapping was never valid

**Symptom:** Clients retry a 401 forever
**Cause:** 401 was used for an authorization failure, so the client re-authenticates
successfully and is refused again
**Fix:** 403 when the caller is authenticated and simply may not

**Symptom:** An error response was served from a CDN to a different user
**Cause:** It was a 200 — cacheable by default
**Fix:** Real status codes, and `Cache-Control: no-store` on anything
user-specific

**Symptom:** The error-rate dashboard reads 0% during an incident
**Cause:** The API returns 200 with `{success: false}`
**Fix:** Status codes are the monitoring interface, whether or not you intended
them to be

**Symptom:** A cross-tenant probe gets 403 for records that exist and 404 for
records that do not
**Cause:** The difference leaks the existence of other tenants' data
**Fix:** 404 for both

## Interview questions

**★ What changed about `res.status` in Express 5?**
It validates. A non-integer throws `TypeError` and anything outside 100–999
throws `RangeError`. Express 4 accepted made-up codes silently, so error-mapping
tables that emitted one now fail loudly — usually inside the error handler.

**★ 401 or 403?**
401 means not authenticated and tells the client to authenticate and retry; 403
means authenticated and not permitted, so retrying cannot help. Using 401 for an
authorization failure produces a retry loop that never succeeds.

**★ When is 404 the right answer for a resource that exists?**
When the caller must not learn that it exists — cross-tenant or cross-user
access. 403 confirms existence, which is an enumeration oracle. Answer 404.

**★ What is wrong with returning 200 and `{success: false}`?**
Caches cache it, retry logic never retries it, monitoring computes a 0% error
rate from it, and generated SDKs cannot model it. The status code is the only
part of the response that intermediaries read.

**★ 400 or 422 for a schema validation failure?**
Both are defensible — RFC 9110's 400 covers it, and 422 is the borrowed WebDAV
code for "well-formed but semantically invalid". Pick one and be consistent; the
error body carries the detail either way.

**When would you return 202?**
When the work is accepted and not finished — RFC 9110 calls it *"intentionally
noncommittal"*. The body should carry an **id** the client can poll, not a
snapshot of a state that has not settled, and the enqueue must happen after the
commit.

---

Index: [Status and headers](README.md) · Next → [Headers, and when it is too late](02-headers-and-timing.md)
