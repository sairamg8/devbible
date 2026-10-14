---
title: "Link map · Next.js · Part 5 (chapters 15–20)"
sidebar_label: "05 · fullstack deployment production"
sidebar_position: 5
---

# Link map · Next.js · Part 5 (chapters 15–20)

Covers every topic row of chapters 15 to 20 in `docs/nextjs/syllabus/05-fullstack-deployment-production.md`: databases and full-stack patterns (T15), the CRUD API (T16), deployment and observability (T17), advanced ecosystem topics (T18), capstone and outlook (T19) and appendices (T20). The three "Project Milestone" bullets (T15-06, T16-13, T17-06) are not topics and are skipped; T19-05 (Appendices A–E) is one block that points at chapter 20. That leaves 36 blocks, and every one has a page of ours (a chunked topic shows its first chunk file).
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up after searching, the block has no "Beyond the docs" line. Two pages (`github.com/timgit/pg-boss`, the Next.js `with-docker` example folder) answer a plain scripted request with 403 and are not linked.

🔴 **Version note.** Our syllabus targets **Next.js 16.3** (shipped 2026-08-03) and **React 19.2**. Official links point at the App Router docs on nextjs.org, which carried 16.x pages on 2026-10-14. The versioned `/docs/15/...` copies are not used. Several third-party picks were written for Next.js 13 to 15 and say so in their block. The Next.js multi-tenant guide is a one-paragraph stub that points at a Vercel starter kit (it is not a full guide), so T18 and chapter 10 lean on the starter kit and our own pages.

---

## Chapter 15 — Databases, APIs, and Full-Stack Patterns

### T15-01 · Serverless Postgres, Prisma, Drizzle, pooling — ✅ written `docs/nextjs/pages/15-databases-apis-and-full-stack-patterns/01-database-integrations-serverless-postgres-neon-prisma-drizzl.md`
- **Read this:** [Connection pooling](https://neon.com/docs/connect/connection-pooling) · Neon docs · pooled vs direct connection strings, PgBouncer transaction mode, and which features it breaks (*read*) · covers our angle: **partial** — Neon only, no ORM comparison · fetched 2026-10-14
- **Also good:** [Neon with Drizzle ORM](https://orm.drizzle.team/docs/connect-neon) · Drizzle docs · picks between the HTTP driver and the WebSocket driver and says which supports transactions (*headings only*) · fetched 2026-10-14
- **Also good:** [Connection pooling with Vercel Functions](https://vercel.com/kb/guide/connection-pooling-with-functions) · Vercel KB · why a function that is frozen and reused leaks connections (*headings only*) · fetched 2026-10-14
- **Our delta:** the three kinds of pool, prepared statements under a pooler, Prisma driver adapters, and the Prisma-vs-Drizzle comparison.

### T15-02 · Route Handlers and Server Actions side by side — ✅ written `docs/nextjs/pages/15-databases-apis-and-full-stack-patterns/02-hybrid-api-design-route-handlers-and-server-actions-side-by.md`
- **Read this:** [Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data) · Next.js docs · Server Functions and Server Actions for mutations from the UI (*headings only*) · covers our angle: **partial** — says how, not when to pick a Route Handler instead · fetched 2026-10-14
- **Also good:** [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) · Next.js docs · the HTTP-facing half: methods, caching, Web Request/Response (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Server Actions vs Route Handlers: When to Use Each in Next.js](https://makerkit.dev/blog/tutorials/server-actions-vs-route-handlers) · Makerkit, 2024-12-16 (tested on Next.js 16) · the decision rule in one place: external clients or cacheable GET means Route Handler, UI-driven mutation means Server Action (*read*) · fetched 2026-10-14
- **Our delta:** what an action compiles into, dispatch being sequential, and thin entry points over one shared rule.

### T15-03 · Real time: SSE and WebSockets — ✅ written `docs/nextjs/pages/15-databases-apis-and-full-stack-patterns/03-real-time-server-sent-events-and-websockets-in-a-serverless.md`
- **Read this:** [Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) · MDN · the wire format, `EventSource`, named events, reconnection (*headings only*) · covers our angle: **partial** — the protocol, nothing on serverless · fetched 2026-10-14
- **Also good:** [Vercel Functions limits](https://vercel.com/docs/functions/limitations) · Vercel docs · max duration counts streamed responses (300s default, 800s maximum on Pro, 1800s beta) and Edge must start responding within 25s (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Using Server-Sent Events (SSE) to stream LLM responses in Next.js](https://upstash.com/blog/sse-streaming-llm-responses) · Rishi Raj Jain, Upstash, 2024-05-06 · an SSE route handler plus a `fetch` and `TextDecoderStream` reader on Vercel; Next.js 14-era and says little on duration limits (*read*) · fetched 2026-10-14
- **Beyond the docs:** [WebSockets on Vercel: why serverless functions can't host them](https://ably.com/topic/ai-stack/websockets-on-vercel-why-serverless-functions-cant-host-them) · Ably, 2026-07-09 · a connection pins to one instance and hits the duration cap; vendor content, and it overstates "can't" since Vercel announced WebSocket support in beta in June 2026 (*read*) · fetched 2026-10-14
- **Our delta:** resumable streams with `Last-Event-ID`, back-pressure, and what silently buffers SSE in production.

### T15-04 · Background jobs and queues — ✅ written `docs/nextjs/pages/15-databases-apis-and-full-stack-patterns/04-background-jobs-and-message-queues-for-async-workloads.md`
- **Read this:** [`after`](https://nextjs.org/docs/app/api-reference/functions/after) · Next.js docs · runs work after the response is sent; fully supported on `next start` with a graceful-shutdown drain (*headings only*) · covers our angle: **partial** — not a queue: no retries, no durability · fetched 2026-10-14
- **Also good:** [pg-boss](https://pgboss.io/) · library docs · a Postgres job queue built on `SKIP LOCKED` (*headings only*) · fetched 2026-10-14
- **Also good:** [Cron Jobs](https://vercel.com/docs/cron-jobs) · Vercel docs · scheduled invocation of a route, the usual way to wake a worker (*headings only*) · fetched 2026-10-14
- **Our delta:** leases, backoff, dead letters, at-least-once with idempotency, and `LISTEN`/`NOTIFY` as a wake-up.

### T15-05 · Edge Functions and custom cache structures — ✅ written `docs/nextjs/pages/15-databases-apis-and-full-stack-patterns/05-edge-functions-and-custom-cache-structures-for-global-comput.md`
- **Read this:** [`cacheHandlers`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers) · Next.js docs (16.x) · custom storage for `use cache` and `use cache: remote`; most apps do not need one; `use cache: private` is not configurable (*read*) · covers our angle: **partial** — config shape, not the CDN layer · fetched 2026-10-14
- **Also good:** [CDN Caching](https://nextjs.org/docs/app/guides/cdn-caching) · Next.js docs · what a CDN in front of Next.js must respect (*headings only*) · fetched 2026-10-14
- **Also good:** [Edge Runtime](https://nextjs.org/docs/app/api-reference/edge) · Next.js docs · the runtime's limits; our page covers its deprecation, so check this against 16.3 (*headings only*) · fetched 2026-10-14
- **Our delta:** the edge runtime being deprecated, `Vary` and RSC headers a CDN must forward, and a shared cache across instances.

## Chapter 16 — Building a CRUD API with Postgres

### T16-01 · The resource contract — ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/01-the-resource-contract.md`
- **Read this:** [`route.js` file convention](https://nextjs.org/docs/app/api-reference/file-conventions/route) · Next.js docs · supported methods, `params` as a Promise, caching of GET (*headings only*) · covers our angle: **partial** — handler mechanics, not the contract between routes and status codes · fetched 2026-10-14
- **Also good:** [Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) · Next.js docs · Route Handlers as a public HTTP surface, with a rate-limiting example (*headings only*) · fetched 2026-10-14
- **Our delta:** six routes and the codes each commits to, and one service layer under both entry points.

### T16-02 · Schema and migrations — ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/02-the-schema-and-the-migration-story.md`
- **Read this:** [Constraints](https://www.postgresql.org/docs/18/ddl-constraints.html) · PostgreSQL 18 docs · check, not-null, unique, primary and foreign key constraints (*headings only*) · covers our angle: **partial** — the constraints, not the validation-layer argument · fetched 2026-10-14
- **Also good:** [Drizzle migrations](https://orm.drizzle.team/docs/migrations) · Drizzle docs · `generate`, `migrate` and `push`, and which is for production (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Zero-Downtime Database Migrations With EF Core](https://milanjovanovic.tech/blog/zero-downtime-migrations-ef-core) · Milan Jovanovic, 2026-08-23 · expand, migrate, contract as three separately deployed steps; .NET examples, but the pattern is database-wide (*read*) · fetched 2026-10-14
- **Our delta:** the lock an `ALTER TABLE` takes and migration as a release step.

### T16-03 · The connection you actually get — ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/03-the-connection-you-actually-get.md`
- **Read this:** [Connection pooling with Vercel Functions](https://vercel.com/kb/guide/connection-pooling-with-functions) · Vercel KB · frozen function instances keep sockets open; the pool-per-instance arithmetic (*headings only*) · covers our angle: **partial** — no dev hot-reload leak · fetched 2026-10-14
- **Also good:** [Vercel Functions limits](https://vercel.com/docs/functions/limitations) · Vercel docs · the 1,024 file-descriptor cap shared across concurrent executions, with a pointer to pooling (*read*) · fetched 2026-10-14
- **Our delta:** the dev hot-reload leak and what does not survive a pooler.

### T16-04 · The Data Access Layer — ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/04-the-data-access-layer.md`
- **Read this:** [How to think about data security in Next.js](https://nextjs.org/docs/app/guides/data-security) · Next.js docs (updated 2026-10-06) · the DAL as server-only, authorizing, and returning DTOs; mutations delegate to it too (*read*) · covers our angle: **full** for the pattern; its SQL examples are not scoped by owner · fetched 2026-10-14
- **Beyond the docs:** [Next.js Authorization](https://www.robinwieruch.de/next-authorization/) · Robin Wieruch · permission logic in a service layer with the DAL as the last line of defence (*headings only*) · fetched 2026-10-14
- **Our delta:** the ownership predicate in every query, why `server-only` is not authorization, and function-per-use-case.

### T16-05 · CREATE — ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/05-create.md`
- **Read this:** [Idempotency-Key HTTP header field](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/) · IETF HTTPAPI draft (not yet an RFC) · key uniqueness, one key per payload, server-set expiry (*headings only*) · covers our angle: **partial** — header semantics, no storage design · fetched 2026-10-14
- **Also good:** [Errors appendix](https://www.postgresql.org/docs/18/errcodes-appendix.html) · PostgreSQL 18 docs · SQLSTATE `23505` unique and `23503` foreign-key violations, the codes we map to 409 and 422 (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Implementing Stripe-like Idempotency Keys in Postgres](https://brandur.org/idempotency-keys) · Brandur Leach, 2017-10-27 · stores the key with request progress so a retry resumes at a recovery point (*read*) · fetched 2026-10-14
- **Our delta:** Zod at the boundary, SQLSTATE to status mapping, and client-supplied ids.

### T16-06 · READ — ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/06-read.md`
- **Read this:** [Cursor-based pagination](https://orm.drizzle.team/docs/guides/cursor-based-pagination) · Drizzle docs · the keyset query in Drizzle (*headings only*) · covers our angle: **partial** — no argument for why offset degrades · fetched 2026-10-14
- **Also good:** [LIMIT and OFFSET](https://www.postgresql.org/docs/18/queries-limit.html) · PostgreSQL 18 docs · states that rows skipped by `OFFSET` are still computed (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [We need tool support for keyset pagination](https://use-the-index-luke.com/no-offset) · Markus Winand, Use The Index, Luke · why offset gets slower with depth and drifts under inserts, with the row-value comparison fix (*headings only*) · fetched 2026-10-14
- **Our delta:** filtering and sorting without injection, the N+1 on a card list, and ETag with conditional GET.

### T16-07 · UPDATE — ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/07-update.md`
- **Read this:** [HTTP Semantics (RFC 9110)](https://www.rfc-editor.org/rfc/rfc9110.html) · IETF · `If-Match`, `ETag` and 412 Precondition Failed (*headings only*) · covers our angle: **partial** — the protocol rules, not the version-column pattern · fetched 2026-10-14
- **Also good:** [Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html) · PostgreSQL 18 docs · row-level locks for the pessimistic alternative (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [ETags and Optimistic Concurrency Control](https://fideloper.com/etags-and-optimistic-concurrency-control) · Chris Fidao, fideloper.com · two clients editing one article; the stale ETag gets a 412 instead of overwriting (*headings only*) · fetched 2026-10-14
- **Our delta:** absent versus null in PATCH, a version column, and position collisions.

### T16-08 · DELETE — ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/08-delete.md`
- **Read this:** [Constraints](https://www.postgresql.org/docs/18/ddl-constraints.html) · PostgreSQL 18 docs · `ON DELETE` actions: `RESTRICT`, `CASCADE`, `SET NULL` (*headings only*) · covers our angle: **partial** — hard-delete referential rules; nothing on soft delete or idempotent status codes · fetched 2026-10-14
- **Beyond the docs:** [Soft deletion with PostgreSQL: but with logic on the database](https://evilmartians.com/chronicles/soft-deletion-with-postgresql-but-with-logic-on-the-database) · Evil Martians · soft delete in a table, and the cost to every read and foreign key (*headings only*) · fetched 2026-10-14
- **Our delta:** 204 versus 404 on a repeat delete, and restoring a soft-deleted row.

### T16-09 · Transactions and isolation — ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/09-transactions-and-multi-table-writes.md`
- **Read this:** [Serialization Failure Handling](https://www.postgresql.org/docs/18/mvcc-serialization-failure-handling.html) · PostgreSQL 18 docs · SQLSTATE `40001`, the whole transaction must be re-run, no built-in retry (*read*) · covers our angle: **partial** — no HTTP boundary or pool-occupancy point · fetched 2026-10-14
- **Also good:** [Transaction Isolation](https://www.postgresql.org/docs/18/transaction-iso.html) · PostgreSQL 18 docs · Read Committed, Repeatable Read and Serializable, with anomalies per level (*headings only*) · fetched 2026-10-14
- **Also good:** [Drizzle transactions](https://orm.drizzle.team/docs/transactions) · Drizzle docs · `db.transaction`, nesting and isolation config (*headings only*) · fetched 2026-10-14
- **Our delta:** a transaction cannot span an HTTP boundary, duration as pool occupancy, and the retry loop.

### T16-10 · Errors and one response shape — ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/10-errors-and-one-response-shape.md`
- **Read this:** [Problem Details for HTTP APIs (RFC 9457)](https://www.rfc-editor.org/rfc/rfc9457) · IETF · `application/problem+json` with `type`, `title`, `status`, `detail`, `instance` and extension members (*headings only*) · covers our angle: **partial** — we use our own envelope, so this is the reference point we diverge from · fetched 2026-10-14
- **Our delta:** our envelope, never leaking a driver error, and testing the envelope rather than the prose.

### T16-11 · Ownership on the API surface — ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/11-ownership-on-the-api-surface.md`
- **Read this:** [How to think about data security in Next.js](https://nextjs.org/docs/app/guides/data-security) · Next.js docs · re-verify inside each action, and check ownership (authorization), not just login, to avoid IDOR (*read*) · covers our angle: **partial** — shows one ownership check, not a query-scoping rule · fetched 2026-10-14
- **Also good:** [Nextjs Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nextjs_Security_Cheat_Sheet.html) · OWASP · do not rely on proxy checks alone; test entry points directly (*headings only*) · fetched 2026-10-14
- **Our delta:** scope every row-returning query to the caller, so a wrong id returns 404.

### T16-12 · Testing the API and seed/reset — ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/12-testing-the-api.md`
- **Read this:** [Testing: Vitest](https://nextjs.org/docs/app/guides/testing/vitest) · Next.js docs · setup for unit tests; notes async Server Components are not supported by Vitest (*headings only*) · covers our angle: **partial** — nothing on a real database · fetched 2026-10-14
- **Also good:** [Getting started with Testcontainers for Node.js](https://testcontainers.com/guides/getting-started-with-testcontainers-for-nodejs/) · Testcontainers · a throwaway Postgres per test run (*headings only*) · fetched 2026-10-14
- **Our delta:** the database is the thing under test, truncate versus schema-per-worker, forcing interleavings, and testing the retry loop.

## Chapter 17 — Deployment, Scaling, and Observability

### T17-01 · Vercel: deployments, edge network, previews — ✅ written `docs/nextjs/pages/17-deployment-scaling-and-observability/01-vercel-automated-deployments-edge-network-preview-branches.md`
- **Read this:** [Deployments](https://vercel.com/docs/deployments) · Vercel docs · production and preview deployments from Git, the CLI or the API (*headings only*) · covers our angle: **partial** — no Next.js-specific build/runtime split · fetched 2026-10-14
- **Also good:** [Environments](https://vercel.com/docs/deployments/environments) · Vercel docs · production, preview and development, and per-environment variables (*headings only*) · fetched 2026-10-14
- **Also good:** [Skew Protection](https://vercel.com/docs/skew-protection) · Vercel docs · pins a client to its own deployment during a rollout (*headings only*) · fetched 2026-10-14
- **Our delta:** the build-time versus runtime split, the edge network, and the self-host skew comparison.

### T17-02 · Self-hosting, Docker, Build Adapters — ✅ written `docs/nextjs/pages/17-deployment-scaling-and-observability/02-self-hosting-docker-containerization.md`
- **Read this:** [How to self-host your Next.js application](https://nextjs.org/docs/app/guides/self-hosting) · Next.js docs (updated 2026-10-01) · reverse proxy, runtime env vars for one image, multi-instance cache and encryption key, `deploymentId`, no-buffering for streaming (*read*) · covers our angle: **full** for the operating rules; no Dockerfile · fetched 2026-10-14
- **Also good:** [Adapters](https://nextjs.org/docs/app/api-reference/adapters) and [Creating an Adapter](https://nextjs.org/docs/app/api-reference/adapters/creating-an-adapter) · Next.js docs · the `NextAdapter` interface with `modifyConfig` and `onBuildComplete`; the section also has Output Types, Runtime Integration and routing pages (*headings only*) · fetched 2026-10-14
- **Also good:** [Containerize a Next.js Application](https://docs.docker.com/guides/nextjs/containerize/) · Docker docs · multi-stage Dockerfile with standalone output (*headings only*) · fetched 2026-10-14
- **Our delta:** all thirteen adapter pages, OpenNext as the community adapter (see [OpenNext](https://opennext.js.org/), *headings only*), and the cache handler across containers.

### T17-03 · Multi-region and data locality — ✅ written `docs/nextjs/pages/17-deployment-scaling-and-observability/03-multi-region-strategies-and-data-locality-patterns.md`
- **Read this:** [Configuring regions for Vercel Functions](https://vercel.com/docs/functions/configuring-functions/region) · Vercel docs · default region is `iad1`; place functions near the data; multiple regions on Pro and Enterprise (*headings only*) · covers our angle: **partial** — function placement, not replicas or consistency · fetched 2026-10-14
- **Also good:** [Fluid compute](https://vercel.com/docs/fluid-compute) · Vercel docs · instance reuse, which is why the database hop dominates latency (*headings only*) · fetched 2026-10-14
- **Our delta:** the `preferredRegion` deprecation, read replicas, and writes that must go to a primary.

### T17-04 · Telemetry via `instrumentation.ts` — ✅ written `docs/nextjs/pages/17-deployment-scaling-and-observability/04-telemetry-sentry-logtail-datadog-integration-via-instrumenta.md`
- **Read this:** [Instrumentation](https://nextjs.org/docs/app/guides/instrumentation) · Next.js docs (updated 2026-08-06) · `register()` runs once per server start, and branching on `NEXT_RUNTIME` (*read*) · covers our angle: **partial** — no vendor wiring · fetched 2026-10-14
- **Also good:** [Manual setup for Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/) · Sentry docs · `instrumentation.ts` loading server and edge configs and exporting `onRequestError` (*headings only*) · fetched 2026-10-14
- **Also good:** [OpenTelemetry](https://nextjs.org/docs/app/guides/open-telemetry) · Next.js docs · the span catalogue and `@vercel/otel` (*headings only*) · fetched 2026-10-14
- **Our delta:** trace volume, log drains for Logtail-style sinks, and Datadog through the OTel path.

### T17-05 · Cost engineering — ✅ written `docs/nextjs/pages/17-deployment-scaling-and-observability/05-cost-engineering-function-compute-bandwidth-and-edge-cache-h.md`
- **Read this:** [Vercel Functions limits](https://vercel.com/docs/functions/limitations) · Vercel docs · billed on active CPU plus provisioned memory; I/O wait does not count as active CPU (*read*) · covers our angle: **partial** — no bandwidth or cache-hit view · fetched 2026-10-14
- **Also good:** [Pricing on Vercel](https://vercel.com/docs/pricing) · Vercel docs · usage line items (*headings only*) · fetched 2026-10-14
- **Also good:** [Immutable static assets](https://nextjs.org/docs/app/api-reference/adapters/immutable-static-assets) · Next.js docs (16.3) · assets reused across deployments, so no skew (*headings only*) · fetched 2026-10-14
- **Our delta:** the cache-hit-rate economics and immutable assets as a lever. Rates change often; do not quote numbers from third-party calculators.

## Chapter 18 — Advanced Ecosystem Topics

### T18-01 · Micro-frontends and multi-zones — ✅ written `docs/nextjs/pages/18-advanced-ecosystem-topics/01-micro-frontends-and-multi-zone-architectures-for-decoupled-t.md`
- **Read this:** [Multi-Zones](https://nextjs.org/docs/app/guides/multi-zones) · Next.js docs · one domain split over several Next.js apps, `assetPrefix` per zone, plain `a` links across zones, `serverActions.allowedOrigins` (*headings only*) · covers our angle: **partial** — no guidance on when not to · fetched 2026-10-14
- **Our delta:** routing requests to a zone, crossing zone boundaries, and when zones are the wrong answer.

### T18-02 · Pages Router to App Router migration — ✅ written `docs/nextjs/pages/18-advanced-ecosystem-topics/02-pages-router-app-router-migration-roadmaps-for-legacy-codeba.md`
- **Read this:** [App Router migration](https://nextjs.org/docs/app/guides/migrating/app-router-migration) · Next.js docs · `pages` and `app` coexist; step-by-step migration (*headings only*) · covers our angle: **partial** — no CVE or Windows-host argument · fetched 2026-10-14
- **Also good:** [Codemods](https://nextjs.org/docs/app/guides/upgrading/codemods) · Next.js docs · the automated transforms (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Migrating from Pages Router to App Router: An Incremental Guide](https://clerk.com/blog/migrating-pages-router-to-app-router-an-incremental-guide) · Clerk blog · a page-by-page, one-to-one translation; written around Next.js 13 and skips `getInitialProps` (*headings only*) · fetched 2026-10-14
- **Our delta:** translating each data-fetching contract, the two APIs with no successor, and the security reason to move.

### T18-03 · Compliance, token leakage, supply chain — ✅ written `docs/nextjs/pages/18-advanced-ecosystem-topics/03-enterprise-compliance-owasp-mapping-token-leakage-prevention.md`
- **Read this:** [Nextjs Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nextjs_Security_Cheat_Sheet.html) · OWASP · Next.js-specific controls (proxy is not authorization, cache by audience) (*headings only*) · covers our angle: **partial** — little on supply chain · fetched 2026-10-14
- **Also good:** [OWASP Top 10](https://owasp.org/Top10/) · OWASP · the category list our mapping uses (*headings only*) · fetched 2026-10-14
- **Also good:** [Environment Variables](https://nextjs.org/docs/app/guides/environment-variables) · Next.js docs · `NEXT_PUBLIC_` values are inlined into the bundle at build (*headings only*) · fetched 2026-10-14
- **Our delta:** the libheif to `sharp` AVIF chain as a worked supply-chain case.

### T18-04 · Framework extension and plugin development — ✅ written `docs/nextjs/pages/18-advanced-ecosystem-topics/04-framework-extension-and-plugin-development.md`
- **Read this:** [Turbopack configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack) · Next.js docs · `rules` for loaders, `resolveAlias`, and the options that replace webpack config (*headings only*) · covers our angle: **partial** — there is no general Turbopack plugin API, so extension means loaders, config and adapters · fetched 2026-10-14
- **Also good:** [`adapterPath`](https://nextjs.org/docs/app/api-reference/config/next-config-js/adapterPath) · Next.js docs · the one supported build-extension hook (*headings only*) · fetched 2026-10-14
- **Our delta:** the files-as-seams (instrumentation, proxy) and the plugin decision about coupling to internals.

## Chapter 19 — Capstone, Decision Trees, and Outlook

### T19-01 · SprintDesk retrospective — ✅ written `docs/nextjs/pages/19-capstone-decision-trees-and-outlook/01-sprintdesk-retrospective-the-finished-multi-tenant-saas-revi.md`
- **Read this:** [Production checklist](https://nextjs.org/docs/app/guides/production-checklist) · Next.js docs · the official pass over rendering, caching, security and analytics (*headings only*) · covers our angle: **partial** — generic, not multi-tenant · fetched 2026-10-14
- **Also good:** [How to build multi-tenant apps in Next.js](https://nextjs.org/docs/app/guides/multi-tenant) · Next.js docs · a stub that points to the Platforms Starter Kit (*read*) · fetched 2026-10-14
- **Our delta:** the multi-tenant guide is unnamed upstream, so the review checks tenant isolation, tenant-scoped cache and invalidation ourselves.

### T19-02 · Case Study 2: PPR e-commerce storefront — ✅ written `docs/nextjs/pages/19-capstone-decision-trees-and-outlook/02-case-study-2-contrast-a-ppr-driven-e-commerce-storefront.md`
- **Read this:** [Cache Components](https://nextjs.org/docs/app/getting-started/cache-components) · Next.js docs · static shell plus streamed dynamic parts; product page with a dynamic cart as the example (*headings only*) · covers our angle: **partial** — a model, not a full storefront · fetched 2026-10-14
- **Also good:** [PPR Platform Guide](https://nextjs.org/docs/app/guides/ppr-platform-guide) · Next.js docs · streaming must work end to end or the shell advantage is lost (*headings only*) · fetched 2026-10-14
- **Our delta:** where the cart and checkout state live, and the side-by-side with SprintDesk.

### T19-03 · Architecture decision trees — ✅ written `docs/nextjs/pages/19-capstone-decision-trees-and-outlook/03-architecture-decision-trees-rendering-strategy.md`
- **Read this:** [`use cache: remote`](https://nextjs.org/docs/app/api-reference/directives/use-cache-remote) and [`use cache: private`](https://nextjs.org/docs/app/api-reference/directives/use-cache-private) · Next.js docs · remote is shared and server-side, private is per user and browser-only; both need `cacheComponents` (*headings only*) · covers our angle: **partial** — the directive tree only · fetched 2026-10-14
- **Also good:** [Caching](https://nextjs.org/docs/app/getting-started/caching) · Next.js docs · the base model for the caching tree (*headings only*) · fetched 2026-10-14
- **Also good:** [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) · Next.js docs · input for the state-placement tree (*headings only*) · fetched 2026-10-14
- **Our delta:** four trees: rendering, caching, state, runtime and deployment target, plus the cache-directive tree.

### T19-04 · Outlook and evaluating previews — ✅ written `docs/nextjs/pages/19-capstone-decision-trees-and-outlook/04-outlook-deeper-ai-runtimes.md`
- **Read this:** [Next.js 16.3](https://nextjs.org/blog/next-16-3) · Next.js blog, 2026-08-03 · Instant Navigations behaviours "will become the default in a future major version"; `turbopackRustReactCompiler` and `useOffline` are still experimental; the earlier Skills are retired (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Adopting Partial Prefetching and migrating to Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components) · Next.js docs · the migration path the outlook relies on (*headings only*) · fetched 2026-10-14
- **Our delta:** a checklist for betting on a preview feature.

### T19-05 · Appendices A–E — ✅ written `docs/nextjs/pages/20-appendices/01-appendix-a-glossary-ppr.md`
- **Read this:** see T20-01 to T20-05 below; the appendices live in chapter 20 only (the chapter 19 copies were deleted on 2026-09-03).
- **Our delta:** none; one block so the topic row is not orphaned.

## Chapter 20 — Appendices

### T20-01 · Appendix A: Glossary — ✅ written `docs/nextjs/pages/20-appendices/01-appendix-a-glossary-ppr.md`
- **Read this:** [Glossary](https://nextjs.org/docs/app/glossary) · Next.js docs · official definitions (App Router, Cache Components, version skew) (*headings only*) · covers our angle: **partial** — we add App Shell, Partial Prefetching, root params, LTS lines and adapter · fetched 2026-10-14
- **Also good:** [Instant Navigation](https://nextjs.org/docs/app/guides/instant-navigation) · Next.js docs · Instant Insights, Navigation Inspector, the `instant()` helper (*headings only*) · fetched 2026-10-14
- **Our delta:** terms the upstream glossary lacks.

### T20-02 · Appendix B: React upgrade blueprint — ✅ written `docs/nextjs/pages/20-appendices/02-appendix-b-react-upgrade-blueprint-tracking-react-canary-nex.md`
- **Read this:** [Upgrading to Next.js 16](https://nextjs.org/docs/app/guides/upgrading/version-16) · Next.js docs · the 15 to 16 steps and codemod (*headings only*) · covers our angle: **partial** — does not frame the canary-versus-your-version split · fetched 2026-10-14
- **Also good:** [React 19.2](https://react.dev/blog/2025/10/01/react-19-2) · react.dev blog, 2025-10-01 · what 19.2 adds (*headings only*) · fetched 2026-10-14
- **Our delta:** the App Router bundles React canary, while the Pages Router uses your `package.json`.

### T20-03 · Appendix C: Tooling and MCP — ✅ written `docs/nextjs/pages/20-appendices/03-appendix-c-tooling.md`
- **Read this:** [Next.js MCP Server](https://nextjs.org/docs/app/guides/mcp) · Next.js docs · `next-devtools-mcp` connecting to a running dev server; needs Next.js 16 (*headings only*) · covers our angle: **partial** — no CLI-wrapper coverage · fetched 2026-10-14
- **Also good:** [Setting up Next.js for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents) · Next.js docs · version-matched `AGENTS.md` block, per the 16.3 post (*headings only*) · fetched 2026-10-14
- **Also good:** [Next.js CLI](https://nextjs.org/docs/app/api-reference/cli/next) · Next.js docs · the command surface (*headings only*) · fetched 2026-10-14
- **Our delta:** runtime-sight over MCP and the error loop.

### T20-04 · Appendix D: Production Readiness Checklist — ✅ written `docs/nextjs/pages/20-appendices/04-appendix-d-production-readiness-checklist-security.md`
- **Read this:** [Production checklist](https://nextjs.org/docs/app/guides/production-checklist) · Next.js docs · building, before launch, after deploy (*headings only*) · covers our angle: **partial** — no patch-level or CVE items · fetched 2026-10-14
- **Also good:** [Content Security Policy](https://nextjs.org/docs/app/guides/content-security-policy) · Next.js docs · nonce-based CSP (*headings only*) · fetched 2026-10-14
- **Also good:** [Nextjs Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nextjs_Security_Cheat_Sheet.html) · OWASP (*headings only*) · fetched 2026-10-14
- **Our delta:** patched-to-LTS, AVIF status, not Windows-hosted with mixed routers, `preferredRegion` audited.

### T20-05 · Appendix E: Version watchlist — ✅ written `docs/nextjs/pages/20-appendices/05-appendix-e-version-watchlist.md`
- **Read this:** [Next.js 16.3](https://nextjs.org/blog/next-16-3) · Next.js blog, 2026-08-03 · the stable list (Instant Insights, Partial Prefetching, root params, glob imports, immutable assets, `catchError`) and the experimental list (*read*) · covers our angle: **full** for 16.3 · fetched 2026-10-14
- **Also good:** [Vercel supports Next.js 16.3](https://vercel.com/blog/vercel-supports-next-js-16-3) · Vercel blog · platform-side notes on the same release (*headings only*) · fetched 2026-10-14
- **Our delta:** the shipped/withdrawn record, including the retired Skills and the removed `next lint`.
