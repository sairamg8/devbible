---
title: "API versioning"
sidebar_label: "05 · Versioning"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

**Public APIs need a compatibility story. URL prefix is the clearest default for this stack.**

## Strategies

| Strategy | Example | Trade-off |
|---|---|---|
| URL prefix | `/api/v1/users` | Visible, cache-friendly, easy routers |
| Header | `Accept-Version: 1` | Cleaner URLs, harder to explore |
| Media type | `Accept: application/vnd.app.v1+json` | Strict, heavy |

Mount version routers:

```js
app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);
```

Deprecate with docs + sunset headers; do not break v1 silently.

## Interview questions

**★ Most common versioning style for REST JSON APIs?**  
URL path prefix (`/v1`).


---

← Prev: [Filter sort search](04-filter-sort-search.md) · Next → [Idempotency keys](06-idempotency-keys.md)
