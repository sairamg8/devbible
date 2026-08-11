---
title: "Phase 10 — Testable app and ops boundary"
sidebar_label: "Overview"
sidebar_position: 0
---

> Composition root for HTTP. Docker/Nginx depth lives in their syllabi.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[createApp](01-create-app.md)** | <span className="db-tier t-master">Master</span> | Pure factory; no listen inside |
| 02 | **[Request id middleware](02-request-id.md)** | <span className="db-tier t-understand">Understand</span> | X-Request-Id + ALS hook |
| 03 | **[Supertest](03-supertest.md)** | <span className="db-tier t-understand">Understand</span> | Route tests with mocked services |
| 04 | **[Auth in tests](04-auth-in-tests.md)** | <span className="db-tier t-understand">Understand</span> | Helpers mint sessions/JWTs |
| 05 | **[Health and boot](05-health-and-boot.md)** | <span className="db-tier t-understand">Understand</span> | Liveness vs readiness; boot order |
| 06 | **[Shutdown and entrypoint](06-shutdown-and-entrypoint.md)** | <span className="db-tier t-understand">Understand</span> | server.close; server.js vs app.js |

## Phase gate

`createApp({mocks})` under Supertest covers happy + 403 paths without a real DB; production listens only after deps are ready.

---

← Syllabus: [Part 4](../../syllabus/04-edge-and-ops.md) · Start → [createApp](01-create-app.md)
