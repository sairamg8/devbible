---
title: "Phase 9 — Hardening middleware"
sidebar_label: "Overview"
sidebar_position: 0
---

> Mount security middleware correctly. Deep vulnerability theory is **Node Phase 8**.

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
