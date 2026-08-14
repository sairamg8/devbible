---
title: "Phase 8 — Validation and authorization at the edge"
sidebar_label: "Overview"
sidebar_position: 0
---

> Concepts (passwords, JWT structure) live in **Node Phase 8**. Here: middleware surface.

> ✅ **Phase complete — 13 of 13 topics, 2026-08-14.** This was the thinnest phase in the
> corpus — eight pages of 21–39 lines with **zero Gotchas and zero Trade-offs between all
> eight** — and the highest-consequence. All written, plus the missing type-inference
> topic (09). **Documentation-validated, not sandbox-measured** — nothing was run.
>
> 🔴 **The one to read if you read nothing else: [ownership checks](07-ownership.md).**
> RBAC present and ownership absent is IDOR — every line looks correct, a valid token and
> a correct permission, and any authenticated user reads any record by changing an id. It
> survives review because each line is individually right, and survives tests because
> tests only ever fetch the user's own records.
>
> Three Express 5 changes underpin this phase and break Express 4 habits, all quoted from
> the migration guide on the pages: **`req.query` is now a getter** (assigning the parsed
> value throws), **`req.body` is `undefined` when unparsed** (was `{}`), and
> **`req.params` has a null prototype** — so `req.params.hasOwnProperty(...)` is a
> TypeError.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Validate at the boundary](01-validate-at-boundary/README.md)** *(2 chunks)* | <span className="db-tier t-master">Master</span> | Every request surface and its trap; why the parse *output* is what matters; and what a schema cannot do |
| 02 | **[Validation factory](02-validation-factory.md)** | <span className="db-tier t-master">Master</span> | Zod schemas → 400 → typed `req` |
| 03 | **[Coercion traps](03-coercion-traps.md)** | <span className="db-tier t-understand">Understand</span> | Query strings are strings |
| 04 | **[Authn middleware](04-authn-middleware.md)** | <span className="db-tier t-master">Master</span> | Attach `req.user` or 401 |
| 05 | **[Cookies and sessions wire-up](05-cookies-sessions-wireup.md)** | <span className="db-tier t-understand">Understand</span> | Flags + store; theory in Node |
| 06 | **[RBAC middleware](06-rbac-middleware.md)** | <span className="db-tier t-master">Master</span> | Role checks → 403 |
| 07 | **[Ownership checks](07-ownership.md)** | <span className="db-tier t-master">Master</span> | Is this row mine? |
| 08 | **[Multi-tenant and logout](08-tenant-and-logout.md)** | <span className="db-tier t-know">Know</span> | Scope tenantId; revoke surface; optional auth |
| 09 | **[Type inference](09-type-inference.md)** | <span className="db-tier t-know">Know</span> | `z.infer`, and typing `req.validated` without lying |

## Coverage

All 13 syllabus topics. **Page 09 was written on 2026-08-14** — type inference from
schemas had no coverage at all. This README had no Coverage table; that is phases
[4](../phase-4-responses/README.md), [5](../phase-5-errors/README.md),
[6](../phase-6-rest-surface/README.md), [7](../phase-7-layering/README.md) and now 8.

| Syllabus topic | Page |
|---|---|
| Why validate at the HTTP boundary | 01 (chunks [01](01-validate-at-boundary/01-what-untrusted-means.md) · [02](01-validate-at-boundary/02-parse-dont-validate.md)) |
| Zod (or equivalent) schemas for `body`, `params`, `query` | 02 |
| A reusable validation middleware factory | 02 |
| Coercion traps | 03 |
| Type inference from schemas into handlers | **09** |
| Authentication middleware | 04 |
| Session store vs JWT wire-up | 05 |
| Cookie flags on the auth path | 05 |
| RBAC middleware | 06 |
| Resource ownership checks | 07 |
| Multi-tenant scoping | 08 |
| Logout and revocation surface | 08 |
| Optional auth middleware | 08 |

## Phase gate

Missing token → 401, wrong role → 403, bad body → 400 from the same factory style; services never see raw `req.body`.

---

← Syllabus: [Part 4](../../syllabus/04-edge-and-ops.md) · Start → [Validate at boundary](01-validate-at-boundary/README.md)
