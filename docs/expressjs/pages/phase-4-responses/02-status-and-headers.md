---
title: "Status and headers"
sidebar_label: "02 · Status · headers"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Status is part of the contract. Headers are fixed once the body starts.
Useful APIs pick 201/204/400/401/403/404/409 deliberately — not always 200.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> [Response reference](https://expressjs.com/en/5x/api/response/): `res.status` is
> chainable and aliases Node's `statusCode`; `res.headersSent` is the documented boolean
> that flips once headers go out (`false` before `res.send`, `true` after — the docs show
> exactly that); `res.set`/`res.type`/`res.vary` mutate headers and are therefore only
> meaningful before the first write. Express 5 also **restricts `res.status()` to
> 100–999** and rejects anything outside that range
> ([migration guide](https://expressjs.com/en/guide/migrating-5.html)) — an Express 4
> habit of passing a made-up code now throws.

## Discipline

```js
res.status(201).json({id});     // created
res.status(204).end();          // no body
res.status(409).json({error});  // conflict
res.set('Cache-Control', 'no-store');
res.set('X-Request-Id', req.requestId);
```

| Code family | Typical use |
|---|---|
| 2xx | Success — 201 create, 204 no content |
| 4xx | Client fault — validation, auth, missing |
| 5xx | Server fault — log + generic public body |

## Trade-off

Rich status codes help clients; over-fine codes confuse them. Align with your
OpenAPI (Phase 6) and stick to it.

## Gotchas

**Symptom:** Always HTTP 200 with `{success:false}`  
**Cause:** RPC-over-HTTP habit  
**Fix:** Use real statuses; keep error body for details

**Symptom:** Cannot set header  
**Cause:** Body already sent  
**Fix:** Set headers first; see page 04

## Interview questions

**★ When is 204 appropriate?**  
Success with no response body (e.g. DELETE).

**401 vs 403?**  
401 unauthenticated; 403 authenticated but not allowed (Phase 8).

---

← Prev: [res methods](01-res-methods.md) · Next → [Response shapes](03-response-shapes.md)
