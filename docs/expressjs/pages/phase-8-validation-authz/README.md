---
title: "Phase 8 — Validation and authorization at the edge"
sidebar_label: "Overview"
sidebar_position: 0
---

> Concepts (passwords, JWT structure) live in **Node Phase 8**. Here: middleware surface.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Validate at the boundary](01-validate-at-boundary.md)** | <span className="db-tier t-master">Master</span> | Untrusted input never reaches services raw |
| 02 | **[Validation factory](02-validation-factory.md)** | <span className="db-tier t-master">Master</span> | Zod schemas → 400 → typed `req` |
| 03 | **[Coercion traps](03-coercion-traps.md)** | <span className="db-tier t-understand">Understand</span> | Query strings are strings |
| 04 | **[Authn middleware](04-authn-middleware.md)** | <span className="db-tier t-master">Master</span> | Attach `req.user` or 401 |
| 05 | **[Cookies and sessions wire-up](05-cookies-sessions-wireup.md)** | <span className="db-tier t-understand">Understand</span> | Flags + store; theory in Node |
| 06 | **[RBAC middleware](06-rbac-middleware.md)** | <span className="db-tier t-master">Master</span> | Role checks → 403 |
| 07 | **[Ownership checks](07-ownership.md)** | <span className="db-tier t-master">Master</span> | Is this row mine? |
| 08 | **[Multi-tenant and logout](08-tenant-and-logout.md)** | <span className="db-tier t-know">Know</span> | Scope tenantId; revoke surface |

## Phase gate

Missing token → 401, wrong role → 403, bad body → 400 from the same factory style; services never see raw `req.body`.

---

← Syllabus: [Part 4](../../syllabus/04-edge-and-ops.md) · Start → [Validate at boundary](01-validate-at-boundary.md)
