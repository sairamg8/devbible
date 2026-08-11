---
title: "Response shapes"
sidebar_label: "03 · Response shapes"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

**Pick envelope vs bare resource and keep it consistent. Mixing both is worse
than either choice.**

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

---

← Prev: [Status and headers](02-status-and-headers.md) · Next → [Headers already sent](04-headers-already-sent.md)
