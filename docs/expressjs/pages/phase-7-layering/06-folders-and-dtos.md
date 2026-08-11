---
title: "Folders and DTOs"
sidebar_label: "06 · Folders · DTOs"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

**Pick feature folders or layer folders and stay consistent. Map API DTOs at the edge.**

| Layout | Idea |
|---|---|
| Feature | `orders/routes.ts`, `orders/service.ts` |
| Layer | `routes/`, `services/`, `repos/` |

Transaction-per-request middleware is a thin wrapper; mechanism stays Node Phase 6.

## Interview questions

**★ Feature vs layer folders?**  
Feature scales by domain; layer scales by role — teams pick one convention.


---

← Prev: [Jobs from routes](05-jobs-from-routes.md) · Index: [Phase 7](README.md)
