---
title: "OpenAPI"
sidebar_label: "08 · OpenAPI"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

**The contract is part of the product. Drift between OpenAPI and handlers is a bug.**

## Practice

- Write or generate OpenAPI 3.x for public routes  
- CI: fail on breaking changes or on route/doc mismatch if you have tooling  
- Use the same schemas as Zod when possible (Phase 8) to avoid double sources of truth  

Swagger UI is optional sugar — the artifact is the spec.

## Interview questions

**★ Why bother with OpenAPI for an internal API?**  
Onboarding, client generation, contract tests, and explicit breaking-change review.


---

← Prev: [ETag and Cache-Control](07-etag-and-cache.md) · Next → [Webhooks](09-webhooks.md)
