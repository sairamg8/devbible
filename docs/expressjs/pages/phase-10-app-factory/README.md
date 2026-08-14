---
title: "Phase 10 — Testable app and ops boundary"
sidebar_label: "Overview"
sidebar_position: 0
---

> Composition root for HTTP. Docker/Nginx depth lives in their syllabi.

> ✅ **Phase complete — 11 of 11 topics, 2026-08-14. This is the last phase; Express is
> now complete at 114/114 topics.** Six pages of 25–32 lines with **zero Gotchas and zero
> Trade-offs between them**, plus two topics that shared one dismissive sentence — all
> written. **Documentation-validated, not sandbox-measured** — nothing was run.
>
> The through-line: **an Express app *is* a request listener**, and `app.listen()` is
> documented as a convenience for `http.createServer(app).listen()`. That single fact is
> why [the factory must not listen](01-create-app.md), why
> [Supertest works](03-supertest.md), why [serverless adapters work](07-flags-and-serverless.md),
> and why [`close` belongs to the server, not the app](06-shutdown-and-entrypoint.md).
>
> Two operational claims worth carrying out of here: **a liveness probe that checks the
> database is a restart-storm generator**, and **graceful shutdown without a drain delay
> still produces 502s** — the load balancer has not noticed you are leaving.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[createApp](01-create-app.md)** | <span className="db-tier t-master">Master</span> | Pure factory; no listen inside |
| 02 | **[Request id middleware](02-request-id.md)** | <span className="db-tier t-understand">Understand</span> | X-Request-Id + ALS hook |
| 03 | **[Supertest](03-supertest.md)** | <span className="db-tier t-understand">Understand</span> | Route tests with mocked services |
| 04 | **[Auth in tests](04-auth-in-tests.md)** | <span className="db-tier t-understand">Understand</span> | Helpers mint sessions/JWTs |
| 05 | **[Health and boot](05-health-and-boot.md)** | <span className="db-tier t-understand">Understand</span> | Liveness vs readiness; boot order |
| 06 | **[Shutdown and entrypoint](06-shutdown-and-entrypoint.md)** | <span className="db-tier t-understand">Understand</span> | server.close; server.js vs app.js |
| 07 | **[Flags and serverless](07-flags-and-serverless.md)** | <span className="db-tier t-when">When Needed</span> | Mount-time toggles; handing the app to a platform with no `listen` |

## Coverage

All 11 syllabus topics. **Page 07 was written on 2026-08-14** — feature flags and
serverless adapters had one dismissive sentence between them, which is not an
explanation of two syllabus rows. Both are *When Needed* and both are mount-time
composition concerns, so they share a page.

| Syllabus topic | Page |
|---|---|
| App factory `createApp(deps)` | 01 |
| Request-id / correlation middleware | 02 |
| Integration testing with Supertest | 03 |
| Mocking external services at the router boundary | 03 |
| Authenticating inside tests | 04 |
| Health vs readiness endpoints | 05 |
| Boot order with Express | 05 |
| Graceful HTTP shutdown | 06 |
| Separate `server.js` / `app.js` | 06 |
| Feature flags / route toggles at mount time | **07** |
| Exporting the app for serverless adapters | **07** |

## Phase gate

`createApp({mocks})` under Supertest covers happy + 403 paths without a real DB; production listens only after deps are ready.

---

← Syllabus: [Part 4](../../syllabus/04-edge-and-ops.md) · Start → [createApp](01-create-app.md)
