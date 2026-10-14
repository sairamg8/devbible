---
title: "Link map · Next.js · Part 5 (chapters 15–20)"
sidebar_label: "05 · fullstack deployment production"
sidebar_position: 5
---

# Link map · Next.js · Part 5 (chapters 15–20)

Covers every topic row of chapters 15 to 20 in `docs/nextjs/syllabus/05-fullstack-deployment-production.md`: databases and full-stack patterns (T15), the CRUD API (T16), deployment and observability (T17), advanced ecosystem topics (T18), capstone and outlook (T19) and appendices (T20). The three "Project Milestone" bullets (T15-06, T16-13, T17-06) are not topics and are skipped; T19-05 (Appendices A–E) is one block that points at chapter 20. That leaves 36 blocks, and every one has a page of ours (a chunked topic shows its first chunk file).
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up after searching, the block has no "Beyond the docs" line. Two pages (`github.com/timgit/pg-boss`, the Next.js `with-docker` example folder) answer a plain scripted request with 403 and are not linked.

🔴 **Version note.** Our syllabus targets **Next.js 16.3** (shipped 2026-08-03) and **React 19.2**. Official links point at the App Router docs on nextjs.org, which carried 16.x pages on 2026-10-14; several of them show a frontmatter version of 16.4.0, so a page can describe behaviour newer than our target (the migration guide marks `ensureStatic` as 16.4 and later). The versioned `/docs/15/...` copies are not used. Several third-party picks were written for Next.js 13 to 15 and say so in their block. The Next.js multi-tenant guide is a one-sentence stub that points at a Vercel starter kit (it is not a full guide), so T18 and chapter 10 lean on the starter kit and our own pages.

---

## Chapter 15 — Databases, APIs, and Full-Stack Patterns

### T15-01 · Serverless Postgres, Prisma, Drizzle, pooling — Syllabus bullet · ✅ written `docs/nextjs/pages/15-databases-apis-and-full-stack-patterns/01-database-integrations-serverless-postgres-neon-prisma-drizzl.md`
- **Read this:** [Connection pooling](https://neon.com/docs/connect/connection-pooling) · Neon docs · the pooled string adds `-pooler` to the endpoint host, PgBouncer runs in transaction mode, and the page lists what breaks (`SET`/`RESET`, `LISTEN`/`NOTIFY`, SQL-level `PREPARE`, session advisory locks) (*read*) · covers our angle: **partial** — Neon only, no ORM comparison · fetched 2026-10-14
- **Also good:** [Neon with Drizzle ORM](https://orm.drizzle.team/docs/connect-neon) · Drizzle docs · separate HTTP and WebSocket tabs: HTTP suits single non-interactive transactions, and interactive transactions need the WebSocket driver (*read*) · fetched 2026-10-14
- **Also good:** [Connection pooling with Vercel Functions](https://vercel.com/kb/guide/connection-pooling-with-functions) · Vercel KB · suspended or reused instances keep connections open because idle timeouts do not run while suspended, so pools leak; the page's fix is `attachDatabasePool` on Fluid compute (*read*) · fetched 2026-10-14
- **Our delta:** the three kinds of pool, prepared statements under a pooler, Prisma driver adapters, and the Prisma-vs-Drizzle comparison.

### T15-02 · Route Handlers and Server Actions side by side — Syllabus bullet · ✅ written `docs/nextjs/pages/15-databases-apis-and-full-stack-patterns/02-hybrid-api-design-route-handlers-and-server-actions-side-by.md`
- **Read this:** [Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data) · Next.js docs · Server Functions and Server Actions, POST only, the client dispatching one action at a time (*read*) · covers our angle: **partial** — says how to mutate; a Route Handler is named only as the way to do parallel work, with no decision rule · fetched 2026-10-14
- **Also good:** [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) · Next.js docs · sequential dispatch per client, one response carrying both return value and re-rendered UI, and the security boundary (*read*) · fetched 2026-10-14
- **Also good:** [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) · Next.js docs · not cached by default, opt-in caching for `GET`, and `GET` handlers prerender under Cache Components unless they touch runtime data (*read*) · fetched 2026-10-14
- **Also good:** [Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) · Next.js docs · its caveats say Server Actions are queued, so using them for data fetching serializes it, and not to call Route Handlers from Server Components (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Server Actions vs Route Handlers: When to Use Each in Next.js](https://makerkit.dev/blog/tutorials/server-actions-vs-route-handlers) · Makerkit, 2024-12-16, no byline (page says tested on Next.js 16) · three questions in order: caller outside the app or cacheable `GET` means Route Handler, UI-driven mutation means Server Action (*read*) · fetched 2026-10-14
- **Our delta:** what an action compiles into, dispatch being sequential, and thin entry points over one shared rule.

### T15-03 · Real time: SSE and WebSockets — Syllabus bullet · ✅ written `docs/nextjs/pages/15-databases-apis-and-full-stack-patterns/03-real-time-server-sent-events-and-websockets-in-a-serverless.md`
- **Read this:** [Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) · MDN · wire format (`event`, `data`, `id`, `retry`, comment lines), `EventSource`, named events, `onerror` and `close()` (*read*) · covers our angle: **partial** — the protocol only; it does not explain the `Last-Event-ID` header on reconnect, and says nothing on serverless · fetched 2026-10-14
- **Also good:** [Vercel Functions limits](https://vercel.com/docs/functions/limitations) · Vercel docs · max duration counts streamed responses (300s default; Pro and Enterprise 800s maximum, 1800s in beta; Hobby 300s), and Edge must start responding within 25s (*read*) · fetched 2026-10-14
- **Also good:** [WebSocket support is now in Public Beta](https://vercel.com/changelog/websocket-support-is-now-in-public-beta) · Vercel changelog, 2026-06-22 · WebSockets run on Fluid compute with the same limits and pricing as other invocations, and `ws` or Socket.IO work unconfigured; the Backend for Frontend guide's warning that WebSockets fail on lambda-style hosts predates this (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Using Server-Sent Events (SSE) to stream LLM responses in Next.js](https://upstash.com/blog/sse-streaming-llm-responses) · Rishi Raj Jain, Upstash, 2024-05-06 · a route handler streaming model tokens and a client reading the POST response with `TextDecoderStream`; Next.js version not stated (App Router, 2024) and no word on duration limits (*read*) · fetched 2026-10-14
- **Beyond the docs:** [WebSockets on Vercel: why serverless functions can't host them](https://ably.com/topic/ai-stack/websockets-on-vercel-why-serverless-functions-cant-host-them) · Ably, 2026-07-09, no named author · a connection pins to one instance under a 5-minute default cap with a 30-minute beta ceiling, and native support has no fan-out or presence; vendor content selling Ably, and its title says "can't" while its body reports Vercel's native public beta of 2026-06-22 (*read*) · fetched 2026-10-14
- **Our delta:** resumable streams with `Last-Event-ID`, back-pressure, and what silently buffers SSE in production.

### T15-04 · Background jobs and queues — Syllabus bullet · ✅ written `docs/nextjs/pages/15-databases-apis-and-full-stack-patterns/04-background-jobs-and-message-queues-for-async-workloads.md`
- **Read this:** [`after`](https://nextjs.org/docs/app/api-reference/functions/after) · Next.js docs · schedules work to run after the response or prerender finishes, for the route's max duration, and still runs if the response errored (*read*) · covers our angle: **partial** — the page promises nothing about retries or durability, so it is not a queue · fetched 2026-10-14
- **Also good:** [How to self-host your Next.js application](https://nextjs.org/docs/app/guides/self-hosting) · Next.js docs · the `after` section: on `SIGINT` or `SIGTERM` the server finishes pending callbacks, and a 10 to 30 second drain is recommended (*read*) · fetched 2026-10-14
- **Also good:** [pg-boss](https://pgboss.io/) · library docs · a Node job queue on Postgres that relies on `SKIP LOCKED`; sections for CLI, dashboard and proxy (*read*) · fetched 2026-10-14
- **Also good:** [Cron Jobs](https://vercel.com/docs/cron-jobs) · Vercel docs · a schedule in `vercel.json` makes Vercel send an HTTP GET to the production deployment URL; UTC only, all plans (*read*) · fetched 2026-10-14
- **Our delta:** leases, backoff, dead letters, at-least-once with idempotency, and `LISTEN`/`NOTIFY` as a wake-up.

### T15-05 · Edge Functions and custom cache structures — Syllabus bullet · ✅ written `docs/nextjs/pages/15-databases-apis-and-full-stack-patterns/05-edge-functions-and-custom-cache-structures-for-global-comput.md`
- **Read this:** [`cacheHandlers`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers) · Next.js docs (frontmatter 16.4.0, updated 2026-09-29) · custom storage for `use cache` and `use cache: remote`; "most applications don't need custom cache handlers"; `use cache: private` is not configurable; `refreshTags` and `updateTags` coordinate invalidation across instances (*read*) · covers our angle: **partial** — handler API, not the CDN layer · fetched 2026-10-14
- **Also good:** [Using a CDN with Next.js](https://nextjs.org/docs/app/guides/cdn-caching) · Next.js docs · `Cache-Control` per route type, the `Vary` headers (`rsc`, `next-router-state-tree`, `next-router-prefetch`, `next-router-segment-prefetch`, `next-url`), `rsc` must be forwarded and `_rsc` kept in the cache key (*read*) · fetched 2026-10-14
- **Also good:** [`runtime` segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime) and [Edge Runtime Deprecated](https://nextjs.org/docs/messages/edge-runtime-deprecated) · Next.js docs · `'edge'` is marked deprecated, "remove the `runtime` export", Node.js is the default so no replacement is needed, and the option cannot be used in Proxy (*read*) · fetched 2026-10-14
- **Our delta:** the edge runtime being deprecated, `Vary` and RSC headers a CDN must forward, and a shared cache across instances. The older Edge Runtime API reference (`/docs/app/api-reference/edge`, updated 2026-02-02) has no deprecation notice and still says the runtime is used in Proxy, which contradicts the `runtime` page, so it is not linked.

## Chapter 16 — Building a CRUD API with Postgres

### T16-01 · The resource contract — Syllabus bullet · ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/01-the-resource-contract.md`
- **Read this:** [`route.js` file convention](https://nextjs.org/docs/app/api-reference/file-conventions/route) · Next.js docs · the seven methods and automatic `OPTIONS`, `params` as a Promise (since v15 RC), the `RouteContext` helper (*read*) · covers our angle: **partial** — handler mechanics, not the contract between routes and status codes · fetched 2026-10-14
- **Also good:** [Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) · Next.js docs · Route Handlers are public endpoints, a rate-limiting example returning 429, and "do not rely on proxy alone" for authorization (*read*) · fetched 2026-10-14
- **Our delta:** six routes and the codes each commits to, and one service layer under both entry points.

### T16-02 · Schema and migrations — Syllabus bullet · ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/02-the-schema-and-the-migration-story.md`
- **Read this:** [Constraints](https://www.postgresql.org/docs/18/ddl-constraints.html) · PostgreSQL 18 docs · check, not-null, unique, primary key, foreign key and exclusion constraints, with the `ON DELETE` actions under foreign keys (*read*) · covers our angle: **partial** — the constraints, not the validation-layer argument · fetched 2026-10-14
- **Also good:** [Drizzle migrations](https://orm.drizzle.team/docs/migrations) · Drizzle docs · `generate` plus `migrate` as the file-based flow and `push` for rapid prototyping, though it also reports teams using `push` in production; it does not name one for production (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Zero-Downtime Database Migrations With EF Core](https://milanjovanovic.tech/blog/zero-downtime-migrations-ef-core) · Milan Jovanović, 2026-08-23 · expand, migrate, contract as three separately deployed steps, plus index creation without blocking writes; C# and EF Core examples, but the pattern is database-wide (*read*) · fetched 2026-10-14
- **Our delta:** the lock an `ALTER TABLE` takes and migration as a release step.

### T16-03 · The connection you actually get — Syllabus bullet · ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/03-the-connection-you-actually-get.md`
- **Read this:** [Connection pooling with Vercel Functions](https://vercel.com/kb/guide/connection-pooling-with-functions) · Vercel KB · suspended instances hold sockets open ("phantom" pool usage after deploys and traffic spikes) (*read*) · covers our angle: **partial** — no dev hot-reload leak · fetched 2026-10-14
- **Also good:** [Vercel Functions limits](https://vercel.com/docs/functions/limitations) · Vercel docs · 1,024 file descriptors shared across concurrent executions, with "use connection pooling" as the advice (*read*) · fetched 2026-10-14
- **Also good:** [Next.js (Prisma ORM v7)](https://www.prisma.io/docs/orm/more/help-and-troubleshooting/help-articles/nextjs-prisma-client-dev-practices) · Prisma docs, undated · hot reloading can create several Prisma Client instances, fixed by caching one on a global object outside production; it does not mention connection exhaustion by name (*read*) · fetched 2026-10-14
- **Our delta:** the dev hot-reload leak and what does not survive a pooler.

### T16-04 · The Data Access Layer — Syllabus bullet · ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/04-the-data-access-layer.md`
- **Read this:** [How to think about data security in Next.js](https://nextjs.org/docs/app/guides/data-security) · Next.js docs (updated 2026-10-06) · the DAL as server-only, authorizing, and returning DTOs; mutations delegate to it too (*read*) · covers our angle: **full** for the pattern; its SQL examples select by slug and check ownership after fetching, not in the query · fetched 2026-10-14
- **Beyond the docs:** [Authorization in Next.js](https://www.robinwieruch.de/next-authorization/) · Robin Wieruch, 2025-03-25 · permission logic belongs in a service layer, and the DAL is the "last line of defense" focused on data manipulation; written for Next.js 15.2 and the CVE-2025-29927 middleware bypass (*read*) · fetched 2026-10-14
- **Our delta:** the ownership predicate in every query, why `server-only` is not authorization, and function-per-use-case.

### T16-05 · CREATE — Syllabus bullet · ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/05-create.md`
- **Read this:** [Idempotency-Key HTTP header field](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/) · IETF HTTPAPI draft -07 (revised 2025-10-15), an expired Internet-Draft and not an RFC · the datatracker page shows only the abstract; the full text says keys are unique and not reused for another payload (422), a concurrent retry gets 409, and the server publishes its expiry policy (*read*) · covers our angle: **partial** — header semantics, no storage design · fetched 2026-10-14
- **Also good:** [Errors appendix](https://www.postgresql.org/docs/18/errcodes-appendix.html) · PostgreSQL 18 docs · SQLSTATE `23505` unique_violation and `23503` foreign_key_violation (class 23), the codes we map to 409 and 422 (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Implementing Stripe-like Idempotency Keys in Postgres](https://brandur.org/idempotency-keys) · Brandur Leach, 2017-10-27 · stores the key with request progress so a retry resumes at a recovery point, with a `SERIALIZABLE` upsert and a locked-at column (*read*) · fetched 2026-10-14
- **Our delta:** Zod at the boundary, SQLSTATE to status mapping, and client-supplied ids.

### T16-06 · READ — Syllabus bullet · ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/06-read.md`
- **Read this:** [Cursor-based pagination](https://orm.drizzle.team/docs/guides/cursor-based-pagination) · Drizzle docs · the keyset query on a unique id and a compound cursor with a matching index; one sentence on why it beats offset (*read*) · covers our angle: **partial** — no real argument for why offset degrades · fetched 2026-10-14
- **Also good:** [LIMIT and OFFSET](https://www.postgresql.org/docs/18/queries-limit.html) · PostgreSQL 18 docs · "rows skipped by an `OFFSET` clause still have to be computed inside the server" (*read*) · fetched 2026-10-14
- **Beyond the docs:** [We need tool support for keyset pagination](https://use-the-index-luke.com/no-offset) · Markus Winand, Use The Index, Luke, 2014-08-06 (updated 2023-09-08) · big offsets make the database fetch and discard rows, and an insert between page fetches causes duplicates; keyset is a `WHERE` on the last seen key, and multi-column sorting is left to a linked article (*read*) · fetched 2026-10-14
- **Our delta:** filtering and sorting without injection, the N+1 on a card list, and ETag with conditional GET.

### T16-07 · UPDATE — Syllabus bullet · ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/07-update.md`
- **Read this:** [HTTP Semantics (RFC 9110)](https://www.rfc-editor.org/rfc/rfc9110.html) · IETF, June 2022 · the `If-Match` (13.1.1), `ETag` (8.8.3) and 412 Precondition Failed (15.5.13) sections are in the table of contents (*headings only*) · covers our angle: **partial** — the protocol rules, not the version-column pattern · fetched 2026-10-14
- **Also good:** [Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html) · PostgreSQL 18 docs · row-level lock modes (`FOR UPDATE`, `FOR NO KEY UPDATE`, `FOR SHARE`, `FOR KEY SHARE`) for the pessimistic alternative (*read*) · fetched 2026-10-14
- **Beyond the docs:** [ETags and Optimistic Concurrency Control](https://fideloper.com/etags-and-optimistic-concurrency-control) · fideloper.com, no byline or publication date shown · client B sends a stale ETag in `If-Match` after client A changed the article and gets a 412 instead of overwriting (*read*) · fetched 2026-10-14
- **Our delta:** absent versus null in PATCH, a version column, and position collisions.

### T16-08 · DELETE — Syllabus bullet · ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/08-delete.md`
- **Read this:** [Constraints](https://www.postgresql.org/docs/18/ddl-constraints.html) · PostgreSQL 18 docs · `ON DELETE` actions: `RESTRICT`, `CASCADE`, `SET NULL`, plus the default `NO ACTION` and `SET DEFAULT` (*read*) · covers our angle: **partial** — hard-delete referential rules; nothing on soft delete or idempotent status codes · fetched 2026-10-14
- **Beyond the docs:** [Soft deletion with PostgreSQL: but with logic on the database](https://evilmartians.com/chronicles/soft-deletion-with-postgresql-but-with-logic-on-the-database) · Andrew Kozin and Travis Turner, Evil Martians, 2022-05-16 · hides soft-deleted rows behind views, and a foreign key cannot cascade a soft delete so extra rules are needed; it measures neither read nor index cost (*read*) · fetched 2026-10-14
- **Our delta:** 204 versus 404 on a repeat delete, and restoring a soft-deleted row.

### T16-09 · Transactions and isolation — Syllabus bullet · ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/09-transactions-and-multi-table-writes.md`
- **Read this:** [Serialization Failure Handling](https://www.postgresql.org/docs/18/mvcc-serialization-failure-handling.html) · PostgreSQL 18 docs · SQLSTATE `40001`, "retry the complete transaction", and PostgreSQL offers no automatic retry (*read*) · covers our angle: **partial** — no HTTP boundary or pool-occupancy point · fetched 2026-10-14
- **Also good:** [Transaction Isolation](https://www.postgresql.org/docs/18/transaction-iso.html) · PostgreSQL 18 docs · Read Committed (default), Repeatable Read and Serializable, with the anomalies table and the advice to keep transactions short and use a pool (*read*) · fetched 2026-10-14
- **Also good:** [Drizzle transactions](https://orm.drizzle.team/docs/transactions) · Drizzle docs · `db.transaction`, nested transactions as savepoints, `tx.rollback()` and the PostgreSQL `isolationLevel`, `accessMode` and `deferrable` options (*read*) · fetched 2026-10-14
- **Our delta:** a transaction cannot span an HTTP boundary, duration as pool occupancy, and the retry loop.

### T16-10 · Errors and one response shape — Syllabus bullet · ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/10-errors-and-one-response-shape.md`
- **Read this:** [Problem Details for HTTP APIs (RFC 9457)](https://www.rfc-editor.org/rfc/rfc9457) · IETF Proposed Standard, 2023, obsoletes RFC 7807 · `application/problem+json` with `type`, `title`, `status`, `detail`, `instance` and extension members that clients must ignore if unknown (*read*) · covers our angle: **partial** — we use our own envelope, so this is the reference point we diverge from · fetched 2026-10-14
- **Our delta:** our envelope, never leaking a driver error, and testing the envelope rather than the prose.

### T16-11 · Ownership on the API surface — Syllabus bullet · ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/11-ownership-on-the-api-surface.md`
- **Read this:** [How to think about data security in Next.js](https://nextjs.org/docs/app/guides/data-security) · Next.js docs · re-verify inside each action, and check ownership (authorization), not just login, to avoid IDOR; its example loads the post and compares `authorId` afterwards (*read*) · covers our angle: **partial** — a post-fetch check, not a query-scoping rule · fetched 2026-10-14
- **Also good:** [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) · Next.js docs · the safe version takes only an id, derives identity from the session and looks the row up with `findFirst` on id plus `ownerId`, which is our predicate; schema validation checks shape, not ownership (*read*) · fetched 2026-10-14
- **Also good:** [Nextjs Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nextjs_Security_Cheat_Sheet.html) · OWASP · "Proxy should not be the only line of defense", and test entry points directly with wrong-owner and wrong-tenant requests (*read*) · fetched 2026-10-14
- **Our delta:** scope every row-returning query to the caller, so a wrong id returns 404.

### T16-12 · Testing the API and seed/reset — Syllabus bullet · ✅ written `docs/nextjs/pages/16-building-a-crud-api-with-postgres/12-testing-the-api.md`
- **Read this:** [Testing: Vitest](https://nextjs.org/docs/app/guides/testing/vitest) · Next.js docs (updated 2026-08-25) · jsdom setup for unit tests; Vitest does not support async Server Components, so use E2E for those (*read*) · covers our angle: **partial** — nothing on a real database · fetched 2026-10-14
- **Also good:** [Getting started with Testcontainers for Node.js](https://testcontainers.com/guides/getting-started-with-testcontainers-for-nodejs/) · Testcontainers · starts a real Postgres container in `beforeAll` and stops it in `afterAll`, so one per suite rather than per test; undated, with 2023 log timestamps (*read*) · fetched 2026-10-14
- **Our delta:** the database is the thing under test, truncate versus schema-per-worker, forcing interleavings, and testing the retry loop.

## Chapter 17 — Deployment, Scaling, and Observability

### T17-01 · Vercel: deployments, edge network, previews — Syllabus bullet · ✅ written `docs/nextjs/pages/17-deployment-scaling-and-observability/01-vercel-automated-deployments-edge-network-preview-branches.md`
- **Read this:** [Deploying to Vercel](https://vercel.com/docs/deployments) · Vercel docs · preview and production deployments from Git, Vercel Drop, the CLI, deploy hooks or the REST API (*read*) · covers our angle: **partial** — no Next.js-specific build/runtime split · fetched 2026-10-14
- **Also good:** [Environments](https://vercel.com/docs/deployments/environments) · Vercel docs · Local, Preview and Production, per-environment variables, custom environments on Pro and Enterprise, and a project's first deployment is always production (*read*) · fetched 2026-10-14
- **Also good:** [Skew Protection](https://vercel.com/docs/skew-protection) · Vercel docs · the framework adds the deployment id (`?dpl=` or `x-deployment-id`) to framework-managed requests; Pro and Enterprise, default max age one day, document navigations not pinned by default (*read*) · fetched 2026-10-14
- **Our delta:** the build-time versus runtime split, the edge network, and the self-host skew comparison.

### T17-02 · Self-hosting, Docker, Build Adapters — Syllabus bullet · ✅ written `docs/nextjs/pages/17-deployment-scaling-and-observability/02-self-hosting-docker-containerization.md`
- **Read this:** [How to self-host your Next.js application](https://nextjs.org/docs/app/guides/self-hosting) · Next.js docs (updated 2026-10-01) · reverse proxy, runtime env vars for one image, multi-instance cache handler and encryption key, `deploymentId`, no-buffering for streaming (*read*) · covers our angle: **full** for the operating rules; no Dockerfile · fetched 2026-10-14
- **Also good:** [Adapters](https://nextjs.org/docs/app/api-reference/adapters) and [Creating an Adapter](https://nextjs.org/docs/app/api-reference/adapters/creating-an-adapter) · Next.js docs · the index page is a stub; the `NextAdapter` interface has `name`, `modifyConfig` and `onBuildComplete`, and the section holds thirteen pages in all (*read*) · fetched 2026-10-14
- **Also good:** [Next.js Across Platforms: Adapters, OpenNext, and Our Commitments](https://nextjs.org/blog/nextjs-across-platforms) · Next.js blog, Jimmy Lai and JJ Kasper, 2026-03-25 · why 16.2 made the Adapter API stable, the two hooks, a public adapter test suite and verified adapters (*read*) · fetched 2026-10-14
- **Also good:** [Containerize a Next.js Application](https://docs.docker.com/guides/nextjs/containerize/) · Docker docs · a three-stage Dockerfile (`dependencies`, `builder`, `runner`) with standalone output (*read*) · fetched 2026-10-14
- **Beyond the docs:** [3 Years of OpenNext](https://opennext.js.org/news/2026-03-25-3-years-of-opennext) · OpenNext project, 2026-03-25, no byline · from SST's AWS Lambda adapter to a multi-platform project, with new AWS and Cloudflare adapters and a Netlify one expected by the end of 2026 (*read*) · fetched 2026-10-14
- **Our delta:** all thirteen adapter pages, OpenNext as the community adapter (see [OpenNext](https://opennext.js.org/), which lists AWS, Cloudflare and Netlify adapters; *read*), and the cache handler across containers.

### T17-03 · Multi-region and data locality — Syllabus bullet · ✅ written `docs/nextjs/pages/17-deployment-scaling-and-observability/03-multi-region-strategies-and-data-locality-patterns.md`
- **Read this:** [Configuring regions for Vercel Functions](https://vercel.com/docs/functions/configuring-functions/region) · Vercel docs · default region `iad1` for new projects, place functions near the data, per-function regions, Enterprise failover; Hobby is one region and Pro five (*read*) · covers our angle: **partial** — function placement, not replicas or consistency; the Fluid compute page says Pro gets "up to 3", so check the figure before quoting it · fetched 2026-10-14
- **Also good:** [Fluid compute](https://vercel.com/docs/fluid-compute) · Vercel docs · several invocations share one instance (optimized concurrency) and `waitUntil` allows background work; it does not discuss database latency (*read*) · fetched 2026-10-14
- **Our delta:** the `preferredRegion` deprecation (the `route.js` reference marks `preferredRegion` as deprecated), read replicas, and writes that must go to a primary.

### T17-04 · Telemetry via `instrumentation.ts` — Syllabus bullet · ✅ written `docs/nextjs/pages/17-deployment-scaling-and-observability/04-telemetry-sentry-logtail-datadog-integration-via-instrumenta.md`
- **Read this:** [Instrumentation](https://nextjs.org/docs/app/guides/instrumentation) · Next.js docs (updated 2026-08-06) · `register()` is called once when a server instance starts and must finish before requests are handled; branch on `NEXT_RUNTIME` (*read*) · covers our angle: **partial** — no vendor wiring · fetched 2026-10-14
- **Also good:** [Manual setup for Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/) · Sentry docs · `register()` loads the server or edge Sentry config by `NEXT_RUNTIME` and exports `onRequestError`; needs `@sentry/nextjs` 8.28 or newer and Next.js 15 (*read*) · fetched 2026-10-14
- **Also good:** [OpenTelemetry](https://nextjs.org/docs/app/guides/open-telemetry) · Next.js docs · `@vercel/otel`, manual `NodeSDK` setup, the default span list, and `NEXT_OTEL_VERBOSE=1` for more spans (*read*) · fetched 2026-10-14
- **Our delta:** trace volume, log drains for Logtail-style sinks, and Datadog through the OTel path.

### T17-05 · Cost engineering — Syllabus bullet · ✅ written `docs/nextjs/pages/17-deployment-scaling-and-observability/05-cost-engineering-function-compute-bandwidth-and-edge-cache-h.md`
- **Read this:** [Vercel Functions limits](https://vercel.com/docs/functions/limitations) · Vercel docs · billed on active CPU plus provisioned memory; waiting on I/O does not count as active CPU (*read*) · covers our angle: **partial** — no bandwidth or cache-hit view · fetched 2026-10-14
- **Also good:** [Pricing on Vercel](https://vercel.com/docs/pricing) · Vercel docs · the billable line items (Fast Data Transfer, Fast Origin Transfer, CDN requests, Active CPU, Provisioned Memory, invocations, image optimization) (*read*) · fetched 2026-10-14
- **Also good:** [Supporting Immutable Static Assets](https://nextjs.org/docs/app/api-reference/adapters/immutable-static-assets) · Next.js docs (updated 2026-07-20) · immutable assets live under `/_next/static/immutable/*` and are requested without `?dpl`, so deployments share them (*read*) · fetched 2026-10-14
- **Our delta:** the cache-hit-rate economics and immutable assets as a lever. Rates change often; do not quote numbers from third-party calculators.

## Chapter 18 — Advanced Ecosystem Topics

### T18-01 · Micro-frontends and multi-zones — Syllabus bullet · ✅ written `docs/nextjs/pages/18-advanced-ecosystem-topics/01-micro-frontends-and-multi-zone-architectures-for-decoupled-t.md`
- **Read this:** [Multi-Zones](https://nextjs.org/docs/app/guides/multi-zones) · Next.js docs (updated 2026-06-01) · one domain split over several Next.js apps, `assetPrefix` per zone, plain `a` links across zones (hard navigation), `serverActions.allowedOrigins`; the only "when not to" is to keep pages visited together in one zone (*read*) · covers our angle: **partial** — no guidance on when zones are the wrong answer · fetched 2026-10-14
- **Our delta:** routing requests to a zone, crossing zone boundaries, and when zones are the wrong answer.

### T18-02 · Pages Router to App Router migration — Syllabus bullet · ✅ written `docs/nextjs/pages/18-advanced-ecosystem-topics/02-pages-router-app-router-migration-roadmaps-for-legacy-codeba.md`
- **Read this:** [App Router migration](https://nextjs.org/docs/app/guides/migrating/app-router-migration) · Next.js docs (updated 2026-09-28) · `pages` and `app` coexist and migrate page by page; the text is still Next.js 13 era (upgrade to 13, Node 18.17) (*read*) · covers our angle: **partial** — no CVE or Windows-host argument · fetched 2026-10-14
- **Also good:** [Codemods](https://nextjs.org/docs/app/guides/upgrading/codemods) · Next.js docs (updated 2026-10-02) · `npx @next/codemod upgrade` and per-version transforms (16.3 `cache-components-instant-false`, 16.0 `middleware-to-proxy`); no Pages-to-App transform is listed (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Migrating from Pages Router to App Router: An Incremental Guide](https://clerk.com/blog/migrating-pages-router-to-app-router-an-incremental-guide) · Clerk blog, no byline or date shown · page-by-page steps (create `/app`, move `_document` and `_app`, then each page); built on Pages Router best practice for Next.js 12.3 and leaves out `getInitialProps` (*read*) · fetched 2026-10-14
- **Our delta:** translating each data-fetching contract, the two APIs with no successor, and the security reason to move.

### T18-03 · Compliance, token leakage, supply chain — Syllabus bullet · ✅ written `docs/nextjs/pages/18-advanced-ecosystem-topics/03-enterprise-compliance-owasp-mapping-token-leakage-prevention.md`
- **Read this:** [Nextjs Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nextjs_Security_Cheat_Sheet.html) · OWASP · "Proxy should not be the only line of defense" (with CVE-2025-29927), scope caches to their audience, and `NEXT_PUBLIC_` values reach the client (*read*) · covers our angle: **partial** — supply chain gets one line ("a supported patched release") · fetched 2026-10-14
- **Also good:** [OWASP Top 10:2021](https://top10.owasp.org/2021) · OWASP · the ten categories A01 to A10 that our mapping uses; `owasp.org/Top10` now redirects to the 2025 edition (*read*) · fetched 2026-10-14
- **Also good:** [Environment Variables](https://nextjs.org/docs/app/guides/environment-variables) · Next.js docs · `NEXT_PUBLIC_` values are inlined into the bundle at build and frozen after it (*read*) · fetched 2026-10-14
- **Our delta:** the libheif to `sharp` AVIF chain as a worked supply-chain case.

### T18-04 · Framework extension and plugin development — Syllabus bullet · ✅ written `docs/nextjs/pages/18-advanced-ecosystem-topics/04-framework-extension-and-plugin-development.md`
- **Read this:** [Turbopack configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack) · Next.js docs (updated 2026-09-24) · `rules` for webpack loaders (a subset of the loader API: no `importModule`, `loadModule` or `emitFile`), `resolveAlias`, `resolveExtensions`, `debugIds` (*read*) · covers our angle: **partial** — it describes loaders and config, and no plugin API appears on it, which matches our claim that extension means loaders, config and adapters · fetched 2026-10-14
- **Also good:** [`adapterPath`](https://nextjs.org/docs/app/api-reference/config/next-config-js/adapterPath) · Next.js docs · the built-in adapters API for platforms and build systems, stable and top-level since v16.2.0 (*read*) · fetched 2026-10-14
- **Also good:** [Next.js Across Platforms](https://nextjs.org/blog/nextjs-across-platforms) · Next.js blog, 2026-03-25 · the adapter contract is versioned and breaking changes need a new major (*read*) · fetched 2026-10-14
- **Our delta:** the files-as-seams (instrumentation, proxy) and the plugin decision about coupling to internals.

## Chapter 19 — Capstone, Decision Trees, and Outlook

### T19-01 · SprintDesk retrospective — Syllabus bullet · ✅ written `docs/nextjs/pages/19-capstone-decision-trees-and-outlook/01-sprintdesk-retrospective-the-finished-multi-tenant-saas-revi.md`
- **Read this:** [Production checklist](https://nextjs.org/docs/app/guides/production-checklist) · Next.js docs (updated 2026-03-10) · the official pass over rendering, caching, security and analytics; some text predates 16 (it calls Partial Prerendering experimental) (*read*) · covers our angle: **partial** — generic, not multi-tenant · fetched 2026-10-14
- **Also good:** [How to build multi-tenant apps in Next.js](https://nextjs.org/docs/app/guides/multi-tenant) · Next.js docs (updated 2025-04-15) · one sentence pointing at the Platforms Starter Kit as the recommended architecture (*read*) · fetched 2026-10-14
- **Our delta:** the multi-tenant guide is unnamed upstream, so the review checks tenant isolation, tenant-scoped cache and invalidation ourselves.

### T19-02 · Case Study 2: PPR e-commerce storefront — Syllabus bullet · ✅ written `docs/nextjs/pages/19-capstone-decision-trees-and-outlook/02-case-study-2-contrast-a-ppr-driven-e-commerce-storefront.md`
- **Read this:** [Caching (Cache Components)](https://nextjs.org/docs/app/getting-started/caching) · Next.js docs (updated 2026-10-06; `getting-started/cache-components` ends up here) · static shell plus cached and streamed parts; its figure shows a product page with a dynamic cart and recommendations, while the code example is a blog page (*read*) · covers our angle: **partial** — a model, not a full storefront · fetched 2026-10-14
- **Also good:** [Implementing Partial Prerendering on your platform](https://nextjs.org/docs/app/guides/ppr-platform-guide) · Next.js docs · a PPR route yields a static shell, `postponedState` and an RSC payload, and a CDN can serve the shell while the origin resumes the dynamic parts; the line that streaming must work end to end is on the self-hosting guide, not here (*read*) · fetched 2026-10-14
- **Our delta:** where the cart and checkout state live, and the side-by-side with SprintDesk.

### T19-03 · Architecture decision trees — Syllabus bullet · ✅ written `docs/nextjs/pages/19-capstone-decision-trees-and-outlook/03-architecture-decision-trees-rendering-strategy.md`
- **Read this:** [`use cache: remote`](https://nextjs.org/docs/app/api-reference/directives/use-cache-remote) and [`use cache: private`](https://nextjs.org/docs/app/api-reference/directives/use-cache-private) · Next.js docs · remote is a shared server-side cache that does not survive deploys; private reads cookies and headers, is not kept in a server cache across requests and lives in the browser; both need `cacheComponents` (*read*) · covers our angle: **partial** — the directive tree only · fetched 2026-10-14
- **Also good:** [Caching](https://nextjs.org/docs/app/getting-started/caching) · Next.js docs · the base model for the caching tree: `use cache`, `Suspense`, runtime APIs, where cached content is stored (*read*) · fetched 2026-10-14
- **Also good:** [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) · Next.js docs · when to use each, input for the state-placement tree (*read*) · fetched 2026-10-14
- **Our delta:** four trees: rendering, caching, state, runtime and deployment target, plus the cache-directive tree.

### T19-04 · Outlook and evaluating previews — Syllabus bullet · ✅ written `docs/nextjs/pages/19-capstone-decision-trees-and-outlook/04-outlook-deeper-ai-runtimes.md`
- **Read this:** [Next.js 16.3](https://nextjs.org/blog/next-16-3) · Next.js blog, 2026-08-03 · the Instant Navigations behaviours "will become the default in a future major version"; `turbopackRustReactCompiler` and `useOffline` are experimental; the post retires the earlier docs-only Skills (the AI agents guide now lists workflow Skills such as `next-dev-loop`) (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Migrating to Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components) and [Adopting Partial Prefetching](https://nextjs.org/docs/app/guides/adopting-partial-prefetching) · Next.js docs (both updated 2026-10-06) · the two migration paths the outlook relies on, including incremental adoption with `instant = false` and `prefetch = 'partial'` (*read*) · fetched 2026-10-14
- **Our delta:** a checklist for betting on a preview feature.

### T19-05 · Appendices A–E — Syllabus bullet · ✅ written `docs/nextjs/pages/20-appendices/01-appendix-a-glossary-ppr.md`
- **Read this:** see T20-01 to T20-05 below; the appendices live in chapter 20 only (the chapter 19 copies were deleted on 2026-09-03).
- **Our delta:** none; one block so the topic row is not orphaned.

## Chapter 20 — Appendices

### T20-01 · Appendix A: Glossary — Syllabus bullet · ✅ written `docs/nextjs/pages/20-appendices/01-appendix-a-glossary-ppr.md`
- **Read this:** [Glossary](https://nextjs.org/docs/app/glossary) · Next.js docs (updated 2026-10-01) · official definitions including App Shell, Cache Components, Partial Prefetching, Static Shell, URL data, version skew and Proxy ("formerly known as Middleware") (*read*) · covers our angle: **partial** — it has no entries for root params, LTS lines or adapter · fetched 2026-10-14
- **Also good:** [Ensuring instant navigations](https://nextjs.org/docs/app/guides/instant-navigation) · Next.js docs (updated 2026-10-06) · validation insights in the dev overlay, the Navigation Inspector, and the `instant()` Playwright helper (*read*) · fetched 2026-10-14
- **Our delta:** terms the upstream glossary lacks (our A-to-Z adds Adapter; appendix E covers root params and LTS lines).

### T20-02 · Appendix B: React upgrade blueprint — Syllabus bullet · ✅ written `docs/nextjs/pages/20-appendices/02-appendix-b-react-upgrade-blueprint-tracking-react-canary-nex.md`
- **Read this:** [Upgrading to Next.js 16](https://nextjs.org/docs/app/guides/upgrading/version-16) · Next.js docs (updated 2026-10-02) · Node 20.9+ and TypeScript 5.1+, the upgrade codemod, and "the App Router uses the latest React Canary release" with 19.2 features (*read*) · covers our angle: **partial** — it does not frame the canary-versus-your-version split or say what the Pages Router uses · fetched 2026-10-14
- **Also good:** [React 19.2](https://react.dev/blog/2025/10/01/react-19-2) · react.dev blog, 2025-10-01 · what 19.2 adds: New React Features, New React DOM Features, Notable Changes (*headings only*) · fetched 2026-10-14
- **Our delta:** the App Router bundles React canary, while the Pages Router uses your `package.json`.

### T20-03 · Appendix C: Tooling and MCP — Syllabus bullet · ✅ written `docs/nextjs/pages/20-appendices/03-appendix-c-tooling.md`
- **Read this:** [Next.js MCP Server](https://nextjs.org/docs/app/guides/mcp) · Next.js docs (updated 2026-10-02) · the dev server exposes `/_next/mcp` in Next.js 16 and later, and `next-devtools-mcp` adds `nextjs_index` and `nextjs_call`, with runtime tools such as `get_errors` and `get_routes` (*read*) · covers our angle: **partial** — no CLI-wrapper coverage · fetched 2026-10-14
- **Also good:** [How Next.js supports AI coding agents](https://nextjs.org/docs/app/guides/ai-agents) · Next.js docs (updated 2026-10-06) · bundled docs in `node_modules/next/dist/docs/` from 16.2, a managed `AGENTS.md` block on by default from 16.3, and Skills for multi-step workflows (*read*) · fetched 2026-10-14
- **Also good:** [Next.js CLI](https://nextjs.org/docs/app/api-reference/cli/next) · Next.js docs · `dev`, `build`, `start`, `info`, `telemetry`, `typegen`, `upgrade` and `analyze` (*read*) · fetched 2026-10-14
- **Our delta:** runtime-sight over MCP and the error loop.

### T20-04 · Appendix D: Production Readiness Checklist — Syllabus bullet · ✅ written `docs/nextjs/pages/20-appendices/04-appendix-d-production-readiness-checklist-security.md`
- **Read this:** [Production checklist](https://nextjs.org/docs/app/guides/production-checklist) · Next.js docs (updated 2026-03-10) · automatic optimizations, during development, before going to production (*read*) · covers our angle: **partial** — no patch-level or CVE items · fetched 2026-10-14
- **Also good:** [Content Security Policy](https://nextjs.org/docs/app/guides/content-security-policy) · Next.js docs (updated 2026-03-20) · nonce-based CSP through Proxy needs dynamic rendering and is incompatible with Partial Prerendering; experimental SRI is the static alternative (*read*) · fetched 2026-10-14
- **Also good:** [Nextjs Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nextjs_Security_Cheat_Sheet.html) · OWASP · entry points, caches by audience, configuration as security code (*read*) · fetched 2026-10-14
- **Our delta:** patched-to-LTS, AVIF status, not Windows-hosted with mixed routers, `preferredRegion` audited.

### T20-05 · Appendix E: Version watchlist — Syllabus bullet · ✅ written `docs/nextjs/pages/20-appendices/05-appendix-e-version-watchlist.md`
- **Read this:** [Next.js 16.3](https://nextjs.org/blog/next-16-3) · Next.js blog, 2026-08-03 · the stable list (Instant Insights, Partial Prefetching, root params, glob imports, immutable assets, `catchError`) and the experimental list (*read*) · covers our angle: **full** for 16.3 · fetched 2026-10-14
- **Also good:** [Next.js 16.3 support on Vercel](https://vercel.com/blog/vercel-supports-next-js-16-3) · Vercel blog, 2026-08-04 · immutable assets under `/_next/static/immutable/*`, sharded routing metadata and new observability views (*read*) · fetched 2026-10-14
- **Our delta:** the shipped/withdrawn record, including the retired Skills and the removed `next lint` (the version 16 upgrade guide confirms `next lint` is removed).
