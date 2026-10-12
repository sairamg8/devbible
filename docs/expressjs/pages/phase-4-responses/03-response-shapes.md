---
title: "Response shapes"
sidebar_label: "03 · Response shapes"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

**Pick envelope vs bare resource and keep it consistent. Mixing both is worse
than either choice.**

> Verified: 2026-08-14 — **no sandbox run**, and mostly **not a documentation question**.
> Express has no opinion on body shape: `res.json` simply serialises what you hand it via
> `JSON.stringify` ([response reference](https://expressjs.com/en/5x/api/response/)).
> The conventions below are this bible's guidance, not upstream rules — the only
> Express-level fact that constrains them is the one from
> [Phase 3](../phase-3-requests/01-req-anatomy/03-reading-headers-and-content.md): `JSON.stringify` **omits `undefined`
> properties**, so an envelope field you set to `undefined` disappears from the response
> rather than appearing as `null`
> ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)).
> That alone is a reason to make absent-vs-null an explicit decision in your shape.

## Two common styles

**Bare resource**

```json
{ "id": "1", "email": "a@b.com" }
```

**Envelope**

```json
{ "data": { "id": "1" }, "meta": { "requestId": "…" } }
```

Errors should share a **stable** shape (Phase 5):

```json
{ "error": { "code": "NOT_FOUND", "message": "User not found" } }
```

## Trade-off

Envelopes extend with pagination meta without breaking clients; they add nesting
noise. Bare resources match pure REST textbooks and OpenAPI components cleanly.

## Gotchas

**Symptom:** Frontend special-cases every endpoint  
**Cause:** No house style  
**Fix:** Document one success shape + one error shape

## Interview questions

**★ Why standardize error JSON?**  
Clients parse one schema; you can add `code` without breaking UIs.

{/* LINKMAP:START */}

## Further reading

*Best explanations found elsewhere on the web — added alongside this page, nothing here replaces it.*

- **Read this:** [Zalando RESTful API Guidelines](https://opensource.zalando.com/restful-api-guidelines/) — Zalando: rule: always return JSON objects as top-level structures, including collections, for future extension (*read* the rule)
- **Also good:** [Where to Put Response Metadata: Envelope or HTTP Headers?](https://dev.to/tiguchi/where-to-put-response-metadata---envelope-or-http-headers-4ai9) — Thomas Werner, 15 Dec 2018: the opposite view: metadata in headers (*read*)

{/* LINKMAP:END */}

---

← Prev: [Status and headers](02-status-and-headers/README.md) · Next → [Headers already sent](04-headers-already-sent.md)
