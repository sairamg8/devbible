---
title: "ETag and Cache-Control"
sidebar_label: "07 · ETag · Cache-Control"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

**Conditional requests avoid useless transfers. Authenticated JSON is usually `Cache-Control: private, no-store`.**

## ETags

```http
ETag: "v3"
If-None-Match: "v3"  → 304
If-Match: "v2"       → 412 if current is v3 (lost update)
```

Express can generate weak ETags for some responses (`etag` setting). For APIs,
explicit version fields or hashes are often clearer.

## Cache-Control on APIs

| Audience | Directive |
|---|---|
| User-specific JSON | `private, no-store` |
| Public catalog | `public, max-age=…` carefully |
| Static hashed assets | long `max-age` + immutable (Phase 4) |

## Interview questions

**★ What does If-None-Match enable?**  
304 Not Modified when the client already has the current representation.


---

← Prev: [Idempotency keys](06-idempotency-keys.md) · Next → [OpenAPI](08-openapi.md)
