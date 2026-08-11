---
title: "Part 3 — Application Layer"
sidebar_label: "3 · Application"
sidebar_position: 3
---

> Phases 6–9 · Data access, background work, security, testing

Where a Node process becomes an application other people can depend on. These
phases are parallelizable — run them alongside whatever you're building.

---

## Phase 6 — Data access

Node-side concerns only. The databases themselves live in their own sections.

| Topic | Tier |
|---|---|
| **Connection pooling** — sizing, exhaustion, leaks, and why the pool lives at module scope, not per-request | <span className="db-tier t-master">Master</span> |
| **Parameterized queries** — never string-concatenate SQL or build Mongo filters from raw input | <span className="db-tier t-master">Master</span> |
| Driver lifecycle: connect at boot, verify on health check, close on shutdown | <span className="db-tier t-understand">Understand</span> |
| **PostgreSQL from Node**: `pg`, `Pool` vs `Client`, `query` with placeholders, typed results | <span className="db-tier t-master">Master</span> |
| **MongoDB from Node**: the official driver, `MongoClient`, connection string options | <span className="db-tier t-master">Master</span> |
| **Transactions from Node**: propagating a transaction handle through service layers without leaking the driver upward | <span className="db-tier t-understand">Understand</span> |
| **N+1 queries** — how they appear in ORM code and how to spot them | <span className="db-tier t-understand">Understand</span> |
| Drivers vs. query builders vs. ORMs — the real trade-off | <span className="db-tier t-understand">Understand</span> |
| **Mongoose**: schemas, models, middleware, and where its magic hurts | <span className="db-tier t-understand">Understand</span> |
| Data-access layering (repository pattern) that keeps driver types out of business logic | <span className="db-tier t-understand">Understand</span> |
| Migrations as code, and running them safely at deploy time | <span className="db-tier t-understand">Understand</span> |
| **`node:sqlite`** — built in, SQLite 3.53, defensive mode by default. Zero-setup SQL practice and local tooling | <span className="db-tier t-know">Know</span> |
| **Prisma** and **Drizzle** — schema-first vs SQL-first, and when each earns its place | <span className="db-tier t-know">Know</span> |
| Retry and backoff on transient connection failures | <span className="db-tier t-know">Know</span> |
| Read replicas and routing reads vs. writes | <span className="db-tier t-when">When Needed</span> |
| Streaming large result sets (cursors) instead of buffering | <span className="db-tier t-when">When Needed</span> |

---

## Phase 7 — Background work and resilience

Everything here is framework-free — `AbortSignal`, plain functions, and separate
processes. No Express required, which is exactly why it belongs in Node rather
than in a framework section.

### Background work

The request path should do the minimum that the user is waiting on. Everything
else is a job.

| Topic | Tier |
|---|---|
| **Sync vs. background** — what must never happen inside the request path | <span className="db-tier t-master">Master</span> |
| Job queues from Node — the producer/consumer shape. Redis mechanics live in the Redis section | <span className="db-tier t-understand">Understand</span> |
| Worker processes — running workers separately from the API while sharing code | <span className="db-tier t-understand">Understand</span> |
| Job retries, attempts, stalled jobs, and visibility timeout | <span className="db-tier t-understand">Understand</span> |
| **Job idempotency** — assume every job runs twice, because eventually it will | <span className="db-tier t-master">Master</span> |
| **Dual-write and the transactional outbox** — "save the row, then enqueue the job" is two writes that can diverge. Write the job into the same transaction and relay it after commit | <span className="db-tier t-understand">Understand</span> |
| Dead-letter queues — where poison messages go, and why you must read them | <span className="db-tier t-know">Know</span> |
| Scheduled and recurring jobs — drift, overlap, and timezones | <span className="db-tier t-know">Know</span> |
| **Outbound side-effects as jobs** — email, webhooks and notifications belong on the queue, not in the request. The pattern, not a vendor SDK tour | <span className="db-tier t-know">Know</span> |
| **Time on the server** — store UTC, convert at the edge, and never trust a scheduled job's clock. The bug class behind wrong trial expiries and "ends at midnight" | <span className="db-tier t-know">Know</span> |
| **Graceful worker shutdown** — finish the in-flight job, don't ack early | <span className="db-tier t-master">Master</span> |

### Resilience

| Topic | Tier |
|---|---|
| **Timeout budgets** — every outbound call bounded, and the budget shrinking as it propagates | <span className="db-tier t-master">Master</span> |
| Deadline propagation — one `AbortSignal` threaded through, so a cancelled request cancels everything it started | <span className="db-tier t-understand">Understand</span> |
| **Retry only safe, transient failures** — why retrying a non-idempotent write duplicates data | <span className="db-tier t-master">Master</span> |
| **Exponential backoff and jitter** — backoff without jitter synchronizes clients into a thundering herd | <span className="db-tier t-master">Master</span> |
| **Concurrency limiting** — bounded parallelism and worker pools, the fix for the Phase 2 `Promise.all` outage | <span className="db-tier t-master">Master</span> |

**Gate — deliverable:** move one slow operation out of a request into a queued
job that is safe to run twice, retried with backoff and jitter, and that finishes
cleanly when the worker receives `SIGTERM`.

---

## Phase 8 — Security

Not optional, and not a phase you do "later". Every item here has cost someone
their weekend.

### Authentication and authorization

| Topic | Tier |
|---|---|
| **Password storage**: argon2 / scrypt / bcrypt. Never a bare hash, never MD5 or SHA-1 | <span className="db-tier t-master">Master</span> |
| **Sessions vs. JWT** — the honest comparison: revocation, expiry, storage, refresh tokens | <span className="db-tier t-master">Master</span> |
| Where to store tokens: `HttpOnly` cookies vs `localStorage`, and the XSS/CSRF trade-off | <span className="db-tier t-master">Master</span> |
| Authorization vs. authentication — and enforcing it server-side, always | <span className="db-tier t-master">Master</span> |
| Session management: rotation on privilege change, invalidation on logout | <span className="db-tier t-understand">Understand</span> |
| **OAuth 2.0 / OIDC** flows at a level you can implement | <span className="db-tier t-know">Know</span> |
| Multi-factor auth, TOTP | <span className="db-tier t-when">When Needed</span> |

### The vulnerability set you must recognize on sight

| Topic | Tier |
|---|---|
| **Injection**: SQL, NoSQL (`$where`, operator injection), command injection | <span className="db-tier t-master">Master</span> |
| **XSS** and correct output encoding; why `Content-Type` matters | <span className="db-tier t-master">Master</span> |
| **Path traversal** (revisit from Phase 4) | <span className="db-tier t-master">Master</span> |
| **CSRF** — when it applies, when `SameSite` already solved it | <span className="db-tier t-understand">Understand</span> |
| **SSRF** — user-controlled URLs in server-side requests | <span className="db-tier t-understand">Understand</span> |
| **Prototype pollution** — a JavaScript-specific class of bug | <span className="db-tier t-understand">Understand</span> |
| **ReDoS** — catastrophic backtracking in user-facing regex | <span className="db-tier t-understand">Understand</span> |
| Insecure deserialization, open redirects, mass assignment | <span className="db-tier t-know">Know</span> |
| Timing attacks and `crypto.timingSafeEqual` | <span className="db-tier t-know">Know</span> |

### Practices and tooling

| Topic | Tier |
|---|---|
| **Input validation at the boundary** with `zod` / `valibot` — parse, don't validate | <span className="db-tier t-master">Master</span> |
| **Secrets handling**: `--env-file`, `process.env` hygiene, never in git, rotation | <span className="db-tier t-master">Master</span> |
| HTTPS everywhere, HSTS, secure cookie flags | <span className="db-tier t-master">Master</span> |
| **`node:crypto`**: hashing, HMAC, `randomUUID`, `randomBytes`, `timingSafeEqual` | <span className="db-tier t-understand">Understand</span> |
| Rate limiting and brute-force protection | <span className="db-tier t-understand">Understand</span> |
| Security headers (`helmet`): CSP, `X-Content-Type-Options`, frame options | <span className="db-tier t-understand">Understand</span> |
| **Supply chain**: `npm audit`, lockfile integrity, install scripts, provenance, typosquatting, dependency minimization | <span className="db-tier t-understand">Understand</span> |
| **Permission Model**: `--permission`, `--allow-fs-read`, `--allow-fs-write`, `--allow-net` (granular, added v25), `--allow-child-process` | <span className="db-tier t-know">Know</span> |
| **Web Crypto API** — the standards-based alternative to `node:crypto` | <span className="db-tier t-know">Know</span> |
| Symmetric and asymmetric encryption, signing, key management | <span className="db-tier t-know">Know</span> |
| Audit logging and tamper-evidence | <span className="db-tier t-when">When Needed</span> |

---

## Phase 9 — Testing

| Topic | Tier |
|---|---|
| **`node:test`** — the built-in runner: `describe`/`it`, hooks, `--test`, watch mode. No dependency required | <span className="db-tier t-master">Master</span> |
| **`node:assert`** strict mode: `deepStrictEqual`, `rejects`, `throws` | <span className="db-tier t-master">Master</span> |
| **Unit vs. integration vs. e2e** — and where the boundaries actually belong | <span className="db-tier t-master">Master</span> |
| Writing testable code: dependency injection over module-level singletons | <span className="db-tier t-master">Master</span> |
| **API testing**: `supertest`, or `fetch` against an ephemeral real server | <span className="db-tier t-master">Master</span> |
| Async testing done right — awaiting assertions, testing rejections | <span className="db-tier t-master">Master</span> |
| **Mocking**: `mock.fn`, `mock.method`, mock timers, and **`mock.module()`** for ESM module mocking — the latter is still *1.0 — Early development*, so pin your Node version if you build on it | <span className="db-tier t-understand">Understand</span> |
| Test doubles: stub vs. spy vs. mock vs. fake — and over-mocking as a smell | <span className="db-tier t-understand">Understand</span> |
| Fixtures, factories, and test data that doesn't rot | <span className="db-tier t-understand">Understand</span> |
| Coverage via `--experimental-test-coverage` — and why 100% is a bad target | <span className="db-tier t-understand">Understand</span> |
| **Vitest / Jest** — when they earn their place over the built-in runner | <span className="db-tier t-understand">Understand</span> |
| **Testcontainers** — integration tests against a real database | <span className="db-tier t-know">Know</span> |
| Newer runner flags: `--test-random-order` (surfaces inter-test coupling), `--test-name-tag`, per-worker IDs, OTel-compatible diagnostics output | <span className="db-tier t-know">Know</span> |
| Snapshot testing | <span className="db-tier t-know">Know</span> |
| ESLint flat config, Prettier, or Biome for both | <span className="db-tier t-know">Know</span> |
| Property-based testing, mutation testing | <span className="db-tier t-when">When Needed</span> |
| Load testing (`autocannon`, k6) | <span className="db-tier t-when">When Needed</span> |

### Contract testing

Where a green unit suite still ships a broken frontend.

| Topic | Tier |
|---|---|
| Contract testing — testing the agreement between client and server, not just each side | <span className="db-tier t-understand">Understand</span> |
| Schema compatibility — breaking vs. non-breaking changes, and which ones need a version | <span className="db-tier t-understand">Understand</span> |
| Consumer-driven contracts | <span className="db-tier t-know">Know</span> |

---

← Prev: [Part 2 — Core I/O](02-core-io.md) · Next → [Part 4 — Production](04-production.md)
