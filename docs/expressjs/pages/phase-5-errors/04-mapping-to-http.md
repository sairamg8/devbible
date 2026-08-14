---
title: "Mapping to HTTP"
sidebar_label: "04 · HTTP mapping"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

**Carry `statusCode` (or `status`) on errors you throw. Map domain failures once
in error middleware — not with ad-hoc `res.status` in every catch.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> Attaching the status to the error is not a convention this page invented: Express's own
> default handler *"sets `res.statusCode` from `err.status` (or `err.statusCode`)"* and
> falls back to 500 when the value sits outside the 4xx–5xx range
> ([error handling](https://expressjs.com/en/guide/error-handling.html)). So an error
> carrying `statusCode` behaves correctly even before your handler exists. Express 5 also
> **restricts `res.status()` to 100–999**
> ([migration guide](https://expressjs.com/en/guide/migrating-5.html)) — a mapping table
> that can emit a made-up code now throws rather than sending it.
> The status **meanings** below are HTTP semantics
> ([RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)), not Express behaviour.

| Situation | Status |
|---|---|
| Validation failed | 400 or 422 |
| Not logged in | 401 |
| Logged in, not allowed | 403 |
| Missing resource | 404 |
| Conflict / duplicate | 409 |
| Rate limited | 429 |
| Upstream/db down | 503 |
| Bug / unknown | 500 |

Thin helper:

```js
export class HttpError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.expose = statusCode < 500;
  }
}
```

Avoid deep inheritance trees — Node error design already covers advanced cases.

That helper is deliberately about forty characters of logic. `statusCode` decides
the response code, `code` is the client's stable contract, and `expose` answers
"may the caller read this message?" — the three things the error handler actually
needs. A class per failure mode gives you the same three fields plus a taxonomy to
maintain, and `instanceof` checks that break across module boundaries.

## The pairs that get confused

Four distinctions carry most of the value, and interviewers ask about all four.

| Pair | The question that separates them |
|---|---|
| **401 vs 403** | Do I know who you are? Unknown → 401. Known but not permitted → 403 |
| **400 vs 422** | Could I parse it? Malformed → 400. Well-formed but semantically wrong → 422 |
| **404 vs 403** | Should this caller know the resource exists? If not, **404 both cases** — a 403 confirms existence |
| **409 vs 422** | Is the request wrong, or is the *world* wrong? Stale version / duplicate key → 409 |

That third row is a security decision disguised as a status code. Returning 403
for another tenant's record tells an attacker the id is real; returning 404 tells
them nothing. **Leak nothing through the status line** — for cross-tenant access,
404 is the honest answer to "does this exist *for you*?"

The 400/422 line is real but not worth arguing over: pick one for validation
failures and apply it everywhere. Consistency beats correctness here, because
clients branch on your `code` anyway.

## 503 and Retry-After

`503` is the one status with an obligation attached: it means *"try again later"*,
and a client cannot act on that without knowing when.

```js
err.statusCode = 503;
err.headers = {'Retry-After': '30'};   // seconds, or an HTTP date
```

Express's default handler copies `err.headers` onto the response, so a status and
its header can travel together on the error object. Use 503 for a dependency that
is down, not for a bug — a 500 that says "retry" invites a client to hammer you
while you are broken.

## Trade-off

Mapping in one place means a route can `throw new HttpError(404, 'USER_NOT_FOUND')`
and stop thinking about HTTP — the domain layer stays free of transport concerns,
which is the whole argument of [Phase 7](../phase-7-layering/README.md). The cost
is a lookup: reading a route no longer tells you what status the client sees, and
you have to know the mapping to predict the response.

The alternative — `res.status(404).json(...)` inline — is locally obvious and
globally inconsistent. You will end up with three shapes of 404 and a 403 that
should have been a 404. **Take the indirection.**

## Gotchas

**Symptom:** A deliberate 404 arrives as a 500  
**Cause:** The status went on the *response* in a catch block that then rethrew, or the
error carries `status` where the handler reads only `statusCode`  
**Fix:** Read both — `err.statusCode || err.status || 500` — which is what Express's own
default handler does

**Symptom:** `RangeError` from `res.status()` since upgrading to Express 5  
**Cause:** A mapping table emitting a non-standard code; Express 5 accepts only 100–999  
**Fix:** Validate the mapped value before it reaches `res.status`, and default unknown
mappings to 500

**Symptom:** An attacker enumerates valid ids by watching 403 vs 404  
**Cause:** Authorisation failures answering 403 for resources the caller may not know exist  
**Fix:** 404 for anything outside the caller's tenant or scope. Reserve 403 for resources
they can see but not act on

**Symptom:** Clients retry a 500 in a tight loop and amplify the outage  
**Cause:** A dependency failure mapped to 500 with no `Retry-After`  
**Fix:** 503 with `Retry-After` for dependency failures; keep 500 for genuine bugs, which
retrying cannot fix

**Symptom:** A validation error is 400 on one endpoint and 422 on another  
**Cause:** Two authors, no decision  
**Fix:** Pick one and enforce it in the mapper, not in each route

## Interview questions

**★ 401 vs 403 in one line?**  
401 = who are you?; 403 = I know who you are and you may not.

**★ When is 404 the right answer to an authorisation failure?**  
When the caller should not learn the resource exists — another tenant's record, for
instance. A 403 confirms existence, which is an information leak delivered by the
status line.

**★ 400 vs 422 — does it matter?**  
Formally, 400 is malformed and 422 is well-formed but semantically invalid.
Practically, pick one for validation failures and be consistent; clients branch on
your error `code`, not the number.

**Why put `statusCode` on the error instead of calling `res.status` where it happens?**  
So the throwing code stays transport-agnostic and one place owns the envelope. It
also works before you write a handler at all — Express's default reads
`err.status`/`err.statusCode` already.

**What does a 503 owe the client that a 500 does not?**  
A `Retry-After`. 503 means "try later", which is unactionable without a hint —
and it distinguishes "we are degraded" from "your request hit a bug".

**Why not a class per error type?**  
Three fields — `statusCode`, `code`, `expose` — carry everything the handler needs.
A hierarchy adds a taxonomy to maintain and `instanceof` checks that fail across
duplicate module instances, in exchange for nothing the handler reads.

---

← Prev: [Error response contract](03-error-contract.md) · Next → [Operational vs programmer](05-operational-vs-programmer.md)
