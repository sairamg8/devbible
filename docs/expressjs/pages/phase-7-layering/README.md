---
title: "Phase 7 — Layering at the Express edge"
sidebar_label: "Overview"
sidebar_position: 0
---

> Thin HTTP edge. Repository/transaction **mechanism** stays in Node Phase 6.

> ✅ **Phase complete — 8 of 8 topics, 2026-08-14.** The thinnest phase so far: six pages
> of 26–33 lines with **zero Gotchas and zero Trade-offs between all of them**, and one
> topic (transaction middleware) present only as a single sentence. All written.
> **Documentation-validated, not sandbox-measured** — nothing was run.
>
> **Almost nothing in this phase is an Express feature**, and every page says so in its
> Verified line. Express has no controllers, no services, no repositories, no DI
> container and no opinion on folders. The two documented mechanisms everything rests on
> are that a `Router` is a mountable "mini-app" and that a route accepts several handler
> functions in sequence. The rest is convention that holds only while someone enforces it.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Controller service repository](01-controller-service-repository.md)** | <span className="db-tier t-master">Master</span> | HTTP in, domain out, drivers down |
| 02 | **[Domain vs transport](02-domain-vs-transport.md)** | <span className="db-tier t-understand">Understand</span> | No `Request` types in domain |
| 03 | **[Fat controllers](03-fat-controllers.md)** | <span className="db-tier t-understand">Understand</span> | Validation/auth as middleware |
| 04 | **[DI without a framework](04-di-without-framework.md)** | <span className="db-tier t-understand">Understand</span> | Pass `deps` into routers |
| 05 | **[Jobs from routes](05-jobs-from-routes.md)** | <span className="db-tier t-understand">Understand</span> | Enqueue, do not await side effects |
| 06 | **[Folders and DTOs](06-folders-and-dtos.md)** | <span className="db-tier t-know">Know</span> | Feature folders; map shapes at edge |
| 07 | **[Transaction middleware](07-transaction-middleware.md)** | <span className="db-tier t-know">Know</span> | The per-request wrapper, and why the service usually owns the boundary |

## Coverage

All 8 syllabus topics. **Page 07 was written on 2026-08-14** — transaction-per-request
middleware existed only as a single sentence inside page 06, which is not an
explanation of a syllabus topic. This README had no Coverage table; that is the
same gap found in phases [4](../phase-4-responses/README.md),
[5](../phase-5-errors/README.md) and [6](../phase-6-rest-surface/README.md).

| Syllabus topic | Page |
|---|---|
| Controller → service → repository wiring | 01 |
| Domain vs transport | 02 |
| Avoiding fat controllers | 03 |
| Dependency injection without a framework | 04 |
| Triggering background work from a route | 05 |
| Folder structure that scales | 06 |
| DTO mapping at the edge | 06 |
| Transaction middleware per request | **07** |

## Phase gate

Handlers stay short; services unit-test without `req`/`res`; one slow side effect is enqueued.

---

← Syllabus: [Part 3](../../syllabus/03-api-product.md) · Start → [CSR wiring](01-controller-service-repository.md)
