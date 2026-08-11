---
title: "Part 4 — Edge correctness & ops boundary"
sidebar_label: "4 · Edge & ops"
sidebar_position: 4
---

> Phases 8–10 · Validation & authz middleware, hardening mounts, testable app factory

The edge of the process: parse input, attach identity, enforce access, harden
headers, and compose an app that tests and deploys cleanly.

**Boundary rule (repeat until boring):**

| Concern | Owner |
|---|---|
| Password hashing, JWT *structure*, session *theory*, Helmet *ideas*, Zod *as a library* | **Node Phase 8–9** |
| Middleware that validates, authenticates, authorizes, sets cookies, mounts Helmet/CORS/rate-limit | **Express** |
| Pool / Redis / queue *mechanics* | **Node / Redis / DB syllabi** |
| `createApp(deps)`, readiness routes, `server.close` hang-off | **Express** |
| Docker multi-stage, Nginx TLS | **Docker / Nginx** |

---

## Phase 8 — Validation and authorization at the edge

Parse at the boundary. Attach identity. Enforce who can touch which row.

📖 **Explanation written:** [Phase 8 — Validation & authz](../pages/phase-8-validation-authz/)

| Topic | Tier |
|---|---|
| **Why validate at the HTTP boundary** — untrusted input never reaches services raw; the habit outlives any schema library | <span className="db-tier t-master">Master</span> |
| Zod (or equivalent) **schemas** for `body`, `params`, and `query` — library surface; principle is the Master row above | <span className="db-tier t-understand">Understand</span> |
| A reusable **validation middleware factory** — schema in, 400 out, typed output on `req` | <span className="db-tier t-master">Master</span> |
| Coercion traps — query strings are always strings; numbers, booleans, and arrays | <span className="db-tier t-understand">Understand</span> |
| Type inference from schemas into handlers — stay honest without `any` | <span className="db-tier t-know">Know</span> |
| **Authentication middleware** — parse session or Bearer JWT, attach `req.user`, reject 401; **no crypto theory re-teach** | <span className="db-tier t-master">Master</span> |
| Session store wire-up vs JWT header wire-up — choosing at the Express layer (cross-link Node for trade-offs) | <span className="db-tier t-understand">Understand</span> |
| Cookie flags on the auth path — `httpOnly`, `Secure`, `SameSite`, path/domain; refresh-cookie patterns | <span className="db-tier t-understand">Understand</span> |
| **RBAC middleware** — role checks on routes, 403 vs 401 | <span className="db-tier t-master">Master</span> |
| **Resource ownership checks** — “is this row mine?” inside or beside the handler | <span className="db-tier t-master">Master</span> |
| Multi-tenant scoping — force `tenantId` from identity, never from raw body alone | <span className="db-tier t-understand">Understand</span> |
| Logout and revocation **surface** — clear cookie, hit denylist endpoint; storage mechanism stays Node/Redis | <span className="db-tier t-know">Know</span> |
| Optional auth middleware — public routes that enrich `req.user` when a token is present | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** a protected route rejects missing tokens with 401,
wrong roles with 403, invalid bodies with 400 from the same factory style, and
services never see unparsed `req.body`.

---

## Phase 9 — Hardening middleware

Mount order and Express-specific config. Concepts of XSS/CSRF/injection live in
Node Phase 8 — here you **apply** them at the app edge.

📖 **Explanation written:** [Phase 9 — Hardening](../pages/phase-9-hardening/)

| Topic | Tier |
|---|---|
| **`trust proxy`** — correct client IP and protocol behind Nginx/load balancers; why rate limits and secure cookies fail without it | <span className="db-tier t-master">Master</span> |
| **CORS in Express** — origins, methods, headers, `credentials`, preflight; dynamic origin pitfalls | <span className="db-tier t-understand">Understand</span> |
| Helmet (or equivalent) **as mounted middleware** — defaults, CSP trade-offs for APIs vs pages | <span className="db-tier t-understand">Understand</span> |
| **Rate limiting** at the app layer — key by IP/user, skip health routes, proxy-aware keys | <span className="db-tier t-understand">Understand</span> |
| CSRF — when cookie-based session APIs need it, when Bearer / `SameSite` already cover you; **`csurf` is archived** — do not teach it; cross-link Node Phase 8 double-submit (or current approach) | <span className="db-tier t-understand">Understand</span> |
| Injection **surfaces in handlers** — open redirects, header injection, unsafe `res.redirect(userInput)`; cross-link Node Phase 8 SSRF / open-redirect pages | <span className="db-tier t-understand">Understand</span> |
| Security headers beyond defaults — `COOP`/`COEP` awareness, API-only apps that skip noisy browser headers | <span className="db-tier t-know">Know</span> |
| Request timeout middleware — soft deadline at the edge (deep budgets stay Node Phase 7) | <span className="db-tier t-know">Know</span> |
| Secrets and config at the edge — no secrets in middleware source; fail boot if required env missing (cross-link Node 12-factor) | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** behind a reverse proxy, `req.ip` is the real client,
CORS allows your SPA with credentials, rate limits key correctly, and a missing
`trust proxy` is something you can diagnose from wrong IPs in logs.

---

## Phase 10 — Testable app and ops boundary

Composition root for HTTP: factory, tests, readiness, shutdown hang-off. Not a
Docker or Nginx course.

📖 **Explanation written:** [Phase 10 — App factory](../pages/phase-10-app-factory/)

| Topic | Tier |
|---|---|
| **App factory `createApp(deps)`** — pure function returns `app`; no listen inside; inject db/redis/queue clients | <span className="db-tier t-master">Master</span> |
| **Request-id / correlation middleware** — generate or accept `X-Request-Id`, put it on `req`, carry via `AsyncLocalStorage` (mechanism: Node Phase 10; this row is the Express mount) | <span className="db-tier t-understand">Understand</span> |
| Integration testing with **Supertest** (or `fetch` against ephemeral listen) — routes with mocked services | <span className="db-tier t-understand">Understand</span> |
| Authenticating inside tests — test helpers that mint sessions/JWTs without copying production crypto pages | <span className="db-tier t-understand">Understand</span> |
| Mocking external services at the router boundary — not mocking Express itself | <span className="db-tier t-understand">Understand</span> |
| **Health vs readiness endpoints** — liveness cheap; readiness checks pool/redis; cross-link Node Phase 10 | <span className="db-tier t-understand">Understand</span> |
| Boot order with Express — validate env → connect deps → `createApp` → `listen` → ready (cross-link Node Phase 11) | <span className="db-tier t-understand">Understand</span> |
| Graceful **HTTP** shutdown hang-off — `server.close`, stop accepting, drain; workers/pools are Node’s pages | <span className="db-tier t-understand">Understand</span> |
| Separate `server.js` / `app.js` — listen only in the entrypoint so tests import the factory | <span className="db-tier t-know">Know</span> |
| Feature flags or route toggles at mount time | <span className="db-tier t-when">When Needed</span> |
| Exporting the app for serverless adapters (`serverless-http` etc.) | <span className="db-tier t-when">When Needed</span> |

**Gate — deliverable:** `createApp({ …mocks })` under Supertest covers a happy
path and a 403 path without opening a real database, and the production
entrypoint only listens after deps are ready.

---

## Where this connects

| From | To |
|---|---|
| Phase 0–2 | **Node Phase 5** — `node:http` is the substrate |
| Phase 5 errors | **Node Phase 2 / 8** — error design and security concepts |
| Phase 6 webhooks / jobs | **Node Phase 7** — queues, outbox, idempotent jobs |
| Phase 7 repositories | **Node Phase 6** — pooling, transactions, repository mechanism |
| Phase 8–9 auth/security | **Node Phase 8** — theory; Express is the mount surface |
| Phase 10 health / shutdown | **Node Phases 5, 10, 11** — signals, probes, boot sequence |
| Phase 9 `trust proxy` | **Nginx** syllabus — termination and forwarded headers in depth |
| Phase 10 wiring | **PostgreSQL · MongoDB · Redis** — clients injected, not re-taught |

### Deliberately not here

| Topic | Why |
|---|---|
| Password hashing algorithms, JWT structure deep-dive | Node Phase 8 Master |
| Full testing curriculum (`node:test`, coverage theory) | Node Phase 9 — Express only adds app-factory + HTTP tests |
| BullMQ / Redis queue mechanics | Redis + Node Phase 7 |
| SQL/Mongo query construction, migrations | DB syllabi |
| Pino / OpenTelemetry internals | Node Phase 10 — request-log middleware is a thin hook only |
| Docker multi-stage, Nginx TLS, Kubernetes | Infra syllabi / parked |
| GraphQL, tRPC, NestJS, Passport | Out of stack or parked; teach primitives instead |
| Template engines (EJS/Pug), SSR | Frontend / separate concern |
| Circuit breakers, bulkheads, load shedding | Project-based, not syllabus |
| Custom path engines, publishing middleware packages | When Needed only |
| Socket.IO / WebSocket **server** product design | Node covers protocol; real-time product is its own track if ever |

---

## Counts (this part)

| Tier | Count |
|---|---|
| Master | 7 |
| Understand | 17 |
| Know | 7 |
| When Needed | 2 |
| **Total** | **33** |

---

## Grand total (all parts)

| Part | Topics | Master |
|---|---|---|
| 1 Foundations | 26 | 9 |
| 2 HTTP surface | 33 | 8 |
| 3 API product | 22 | 4 |
| 4 Edge & ops | 33 | 7 |
| **Sum** | **114** | **28 (25%)** |

Phase 8–10 Master rows: validate-at-boundary, validation factory, authn middleware,
RBAC, ownership, `trust proxy`, `createApp`. Demote freely if a review wants a
stricter Master cap; do **not** demote `next` semantics, body parsers, error
contract, or REST status mapping.

← Prev: [Part 3 — API product](03-api-product.md) · Index: [Express.js](../)
