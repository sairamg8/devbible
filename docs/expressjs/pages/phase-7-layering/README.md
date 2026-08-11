---
title: "Phase 7 — Layering at the Express edge"
sidebar_label: "Overview"
sidebar_position: 0
---

> Thin HTTP edge. Repository/transaction **mechanism** stays in Node Phase 6.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Controller service repository](01-controller-service-repository.md)** | <span className="db-tier t-master">Master</span> | HTTP in, domain out, drivers down |
| 02 | **[Domain vs transport](02-domain-vs-transport.md)** | <span className="db-tier t-understand">Understand</span> | No `Request` types in domain |
| 03 | **[Fat controllers](03-fat-controllers.md)** | <span className="db-tier t-understand">Understand</span> | Validation/auth as middleware |
| 04 | **[DI without a framework](04-di-without-framework.md)** | <span className="db-tier t-understand">Understand</span> | Pass `deps` into routers |
| 05 | **[Jobs from routes](05-jobs-from-routes.md)** | <span className="db-tier t-understand">Understand</span> | Enqueue, do not await side effects |
| 06 | **[Folders and DTOs](06-folders-and-dtos.md)** | <span className="db-tier t-know">Know</span> | Feature folders; map shapes at edge |

## Phase gate

Handlers stay short; services unit-test without `req`/`res`; one slow side effect is enqueued.

---

← Syllabus: [Part 3](../../syllabus/03-api-product.md) · Start → [CSR wiring](01-controller-service-repository.md)
