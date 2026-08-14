---
title: "Phase 9 — Hardening middleware"
sidebar_label: "Overview"
sidebar_position: 0
---

> Mount security middleware correctly. Deep vulnerability theory is **Node Phase 8**.

> ✅ **Phase complete — 9 of 9 topics, 2026-08-14.** Six pages of 21–32 lines with **zero
> Gotchas and zero Trade-offs between them**; all written.
> **Documentation-validated, not sandbox-measured** — nothing was run.
>
> 🔴 **The long-outstanding gap is now written**: no page previously connected
> **`trust proxy: true` → client-controlled `req.ip` → rate-limit bypass**. It is on
> [01](01-trust-proxy.md) and [04](04-rate-limiting.md), from both directions — including
> the mirror failure where trust is *off* and every client shares the proxy's bucket.
>
> Two things stated plainly because they are widely misunderstood: **CORS is not access
> control** (browser-enforced, ignored by every non-browser client — it protects your
> users, not your API), and **a request-timeout middleware does not stop the work** —
> nothing in Express or Node cancels a running handler.

## Coverage

All 9 syllabus topics. **Topic 7, "security headers beyond defaults" (COOP/COEP,
API-only apps skipping noisy headers), had no page and is covered on
[03 Helmet](03-helmet.md)** — headers belong together. Recorded here because this
README had no Coverage table, the same gap found in phases
[4](../phase-4-responses/README.md) through [8](../phase-8-validation-authz/README.md).

| Syllabus topic | Page |
|---|---|
| `trust proxy` | 01 |
| CORS in Express | 02 |
| Helmet as mounted middleware | 03 |
| Security headers beyond defaults (COOP/COEP) | **03** |
| Rate limiting at the app layer | 04 |
| CSRF — and why `csurf` is archived | 05 |
| Injection surfaces in handlers (open redirect, header injection) | 05 |
| Request timeout middleware | 06 |
| Secrets and config at the edge | 06 |

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[trust proxy](01-trust-proxy.md)** | <span className="db-tier t-master">Master</span> | Real client IP behind Nginx |
| 02 | **[CORS](02-cors.md)** | <span className="db-tier t-understand">Understand</span> | Credentials + preflight gotchas |
| 03 | **[Helmet](03-helmet.md)** | <span className="db-tier t-understand">Understand</span> | Secure headers as middleware |
| 04 | **[Rate limiting](04-rate-limiting.md)** | <span className="db-tier t-understand">Understand</span> | Key by IP/user; skip health |
| 05 | **[CSRF and injection surfaces](05-csrf-and-injection.md)** | <span className="db-tier t-understand">Understand</span> | When CSRF applies; open redirects |
| 06 | **[Timeouts and secrets at edge](06-timeouts-and-secrets.md)** | <span className="db-tier t-know">Know</span> | Soft deadlines; no secrets in source |

## Phase gate

Behind a proxy, `req.ip` is correct; CORS allows your SPA with credentials; rate limits key properly.

---

← Syllabus: [Part 4](../../syllabus/04-edge-and-ops.md) · Start → [trust proxy](01-trust-proxy.md)
