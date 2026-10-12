---
title: "Link map · Node.js · Part 3a (phases 6–7)"
sidebar_label: "03 · Node.js · Data and background (6–7)"
sidebar_position: 3
---

# Link map · Node.js · Part 3a — Data access, background work and resilience (phases 6–7)

Covers every topic row of phases 6 and 7 in `docs/nodejs/syllabus/03-application.md`: phase 6 (T06-01 to T06-16) and phase 7 (T07-01 to T07-16, rows 1–11 background work, 12–16 resilience). **All 32 rows have a page of ours (✅).**
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. No `#anchors` are given.

🔴 **Version and source notes (2026-10-12).** nodejs.org/api served v26.11.1. Prisma's `/docs/orm` is now **Prisma ORM 8**; the query-optimization page I read is labelled v7, so re-check it before quoting. `github.com` returned 403 to our fetcher, so p-limit was read from its unpkg copy. appsignal.com did not fetch (no response) and is not used. The Node `node:sqlite` page does not state which SQLite version is bundled (not confirmed); SQLite 3.53.0 itself is dated 2026-04-09 on sqlite.org.

---

## Phase 6 — Data access

### T06-01 · Connection pooling — Master · ✅ written `docs/nodejs/pages/phase-6-data-access/01-connection-pooling.md`
- **Read this:** [Pooling](https://node-postgres.com/features/pooling) · node-postgres.com · a pool of clients you check out and return; forgetting `release()` leaks clients until the pool is empty and callers wait forever; `pool.query` is the preferred way as it removes the leak risk (*read*) · covers our angle: **partial** — Postgres only; sizing is on the next page · fetched 2026-10-12
- **Also good:** [Pool sizing](https://node-postgres.com/guides/pool-sizing) · node-postgres.com · napkin math across instances: max connections divided by instance count (*read*) · [Connection pools](https://www.mongodb.com/docs/drivers/node/current/connect/connection-options/connection-pools/) · mongodb.com · `maxPoolSize` default 100, `waitQueueTimeoutMS`; "create a client and reuse it for all operations in a process" (*read*) · fetched 2026-10-12
- **Our delta:** the pool lives at module scope, not per request, and the exhaustion/leak diagnosis; the Mongo page states reuse but not the per-request mistake.

### T06-02 · Parameterized queries — Master · ✅ `…/02-parameterized-queries.md`
- **Read this:** [Queries](https://node-postgres.com/features/queries) · node-postgres.com · concatenating parameters into query text leads to SQL injection; parameters travel separately to the server; identifiers need `pg-format` (*read*) · covers our angle: **partial** — SQL only, nothing on Mongo filters · fetched 2026-10-12
- **Also good:** [Query Parameterization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html) · OWASP · prepared-statement and stored-procedure examples (≈1.8k words; *headings only*, examples are not in Node) · fetched 2026-10-12
- **Our delta:** 🔴 Mongo filters built from raw input (`$ne`, `$gt`, `$where`). My search only surfaced blogs and a sanitizer package, none fetched; no primary page found, so cite nothing until one is chosen.

### T06-03 · Driver lifecycle: connect, health check, close — Understand · ✅ `…/03-driver-lifecycle.md`
- **Read this:** [Pooling → Shutdown](https://node-postgres.com/features/pooling) · node-postgres.com · `pool.end()` waits for checked-out clients to return, then closes clients and timers; checking out after it returns errors (*read*) · covers our angle: **partial** — close only; no boot or health-check guidance · fetched 2026-10-12
- **Also good:** [MongoClient](https://www.mongodb.com/docs/drivers/node/current/connect/mongoclient/) · mongodb.com · the driver calls `connect()` itself on first CRUD call; examples close the client in a `finally` (*read*) · fetched 2026-10-12
- **Our delta:** the health-check step (a cheap query or ping) and ordering shutdown after the HTTP server stops; neither page says it.

### T06-04 · PostgreSQL from Node: `pg` — Master · ✅ `…/04-postgresql-from-node.md`
- **Read this:** [pg.Pool](https://node-postgres.com/apis/pool) · node-postgres.com · config reference: `max` default 10, `idleTimeoutMillis` default 10000, `connectionTimeoutMillis` default 0 (no timeout) (*read*) · covers our angle: **partial** — `Pool` is covered; `Client` vs `Pool` and typed results are not argued here · fetched 2026-10-12
- **Also good:** [Queries](https://node-postgres.com/features/queries) · node-postgres.com · placeholders, query config object, prepared statements, row mode, type parsing (*read* the parameterized section; rest headings) · fetched 2026-10-12
- **Our delta:** when `Client` is right (one dedicated connection) and how to type `rows` (this page does not cover typing).

### T06-05 · MongoDB from Node: driver, `MongoClient`, connection string — Master · ✅ `…/05-mongodb-from-node.md`
- **Read this:** [MongoClient](https://www.mongodb.com/docs/drivers/node/current/connect/mongoclient/) · mongodb.com · one `MongoClient` is a pool of connections, so most apps need a single instance across requests (*read*) · covers our angle: **partial** — connection string option catalogue is on another page · fetched 2026-10-12
- **Also good:** [Specify Connection Options](https://www.mongodb.com/docs/drivers/node/current/connect/connection-options/) · mongodb.com · timeouts, closing sockets, keepAlive (≈3.2k words; *headings only*) · fetched 2026-10-12

### T06-06 · Transactions from Node — Understand · ✅ `…/06-transactions.md`
- **Read this:** [Transactions](https://node-postgres.com/features/transactions) · node-postgres.com · run `BEGIN`/`COMMIT`/`ROLLBACK` on one checked-out client; never use `pool.query` for a transaction; release in `finally` (*read*) · covers our angle: **partial** — the raw mechanics; no service-layer propagation · fetched 2026-10-12
- **Also good:** [Asynchronous context tracking](https://nodejs.org/api/async_context.html) · nodejs.org · `AsyncLocalStorage` creates stores that stay coherent through async operations; Stable since v16.4.0 (*read* the class intro; reference, not a tutorial) · fetched 2026-10-12
- **Our delta:** passing the handle through service layers without leaking `pg` types upward (a unit-of-work wrapper, or ALS); neither page shows it.

### T06-07 · N+1 queries — Understand · ✅ `…/07-n-plus-1.md`
- **Read this:** [Query optimization](https://www.prisma.io/docs/orm/v7/prisma-client/queries/advanced/query-optimization-performance) · prisma.io · defines n+1 as one extra query per looped result; shows the loop anti-pattern and fixes with `include`, an `in` filter and `relationLoadStrategy: "join"` (*read*; Prisma 7 docs) · covers our angle: **partial** — Prisma-specific; spotting it is only "debugging performance issues" · fetched 2026-10-12
- **Also good:** [Understanding N+1 Database Queries](https://www.scoutapm.com/blog/understanding-n1-database-queries) · Scout Monitoring · published 2024-12-23, modified 2026-04-27; what, why, fixes, detection, and when it is acceptable (*headings only*; Rails, Django and Elixir examples, vendor blog)
- **Our delta:** detection in Node (query logs, span counts) and Mongoose `populate`; neither page covers either.

### T06-08 · Drivers vs. query builders vs. ORMs — Understand · ✅ `…/08-drivers-builders-orms.md`
- **Read this:** [ORM vs Raw SQL: Which Should You Choose?](https://blog.openreplay.com/orm-or-raw-sql/) · OpenReplay blog · 2026-07-15; default to an ORM or query builder for CRUD, raw SQL for measured hot paths; the real ORM tax is N+1; Drizzle, Kysely and Knex are the middle option (*read* the takeaways and query-builder section) · covers our angle: **partial** — SQL ORMs only, Mongo drivers not considered; a blog, not a benchmark · fetched 2026-10-12
- **Also good:** [Why Drizzle?](https://orm.drizzle.team/docs/overview) · orm.drizzle.team · the SQL-like position stated by a vendor (*read* a paragraph)
- *Not opened:* appsignal (no response); a dev.to comparison (200, unread).

### T06-09 · Mongoose — Understand · ✅ `…/09-mongoose.md`
- **Read this:** [Schemas](https://mongoosejs.com/docs/guide.html) · mongoosejs.com · each schema maps to a MongoDB collection and defines document shape (*read* the opening; rest *headings only*) · covers our angle: **partial** — "where the magic hurts" is not the guide's job · fetched 2026-10-12
- **Also good:** [Middleware](https://mongoosejs.com/docs/middleware.html) · mongoosejs.com · four types (document, model, aggregate, query); pre hooks run one after another and may be async; has "Notes on findAndUpdate() and Query Middleware" (*read* types and pre; ≈3.9k words, Mongoose v9.11.1) · fetched 2026-10-12
- **Our delta:** the gotchas must be sourced before we state them; start from the Middleware page's Notes section (not read in full).

### T06-10 · Data-access layering / repository pattern — Understand · ✅ `…/10-repository-pattern.md`
- **Read this:** [Repository](https://martinfowler.com/eaaCatalog/repository.html) · martinfowler.com · mediates between domain and data mapping using a collection-like interface (*read*) · covers our angle: **partial** — the idea only, no Node code or driver-type leakage · fetched 2026-10-12
- **Our delta:** keeping `pg` rows and Mongo `ObjectId` out of business types, in plain functions; undated catalogue entry.

### T06-11 · Migrations as code, run safely at deploy — Understand · ✅ `…/11-migrations.md`
- **Read this:** [node-pg-migrate](https://salsita.github.io/node-pg-migrate/) · salsita.github.io · pending migrations run in one transaction under an advisory lock, with an order check; `up --dry-run` prints the SQL (*read* that section; ≈560 words, a tool landing page) · covers our angle: **partial** — one tool's safety features, not the expand/contract method · fetched 2026-10-12
- **Also good:** [Migrations](https://knexjs.org/guide/migrations.html) · knexjs.org · CLI, transactions in migrations, a "Notes about locks" section (*headings only*) · [How migrations work](https://www.prisma.io/docs/orm/migrations/how-migrations-work) · prisma.io · Prisma 8's model (*headings only*) · fetched 2026-10-12
- **Our delta:** 🔴 expand/contract for zero-downtime deploys. Search found only blogs (not fetched); not confirmed from a primary source.

### T06-12 · `node:sqlite` — Know · ✅ `…/12-node-sqlite.md`
- **Read this:** [SQLite](https://nodejs.org/api/sqlite.html) · nodejs.org · `Stability: 1.2 - Release candidate`; `defensive` option defaults to true (history: "Enable defensive by default", v25.5.0 and v24.14.0); only under the `node:` scheme (*read*) · covers our angle: **partial** — reference, and no bundled SQLite version stated (not confirmed) · fetched 2026-10-12
- **Also good:** [SQLite Release 3.53.0](https://sqlite.org/releaselog/3_53_0.html) · sqlite.org · release log dated 2026-04-09 (*headings only*) · fetched 2026-10-12
- **Our delta:** the "SQLite 3.53" claim in the syllabus must be checked against Node's own source or release notes before it is repeated; the API page does not state it.

### T06-13 · Prisma and Drizzle — Know · ✅ `…/13-prisma-drizzle.md`
- **Read this (1/2):** [Prisma ORM](https://www.prisma.io/docs/orm) · prisma.io · `npm install prisma` gives Prisma ORM 8; apps on 7 can pin; core concepts and migrations laid out (*read* release status; rest *headings only*) · covers our angle: **partial** — the schema-first side · fetched 2026-10-12
- **Read this (2/2):** [Why Drizzle?](https://orm.drizzle.team/docs/overview) · orm.drizzle.team · SQL-like by design, "headless ORM", serverless section (≈1.2k words; *read* the SQL-like paragraph) · covers our angle: **partial** — vendor pitch, so the trade-off must be ours · fetched 2026-10-12
- **Our delta:** when each earns its place; both are vendor pages and neither argues against itself.

### T06-14 · Retry and backoff on transient connection failures — Know · ✅ `…/14-retry-backoff.md`
- **Read this:** [Exponential Backoff And Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) · AWS Architecture Blog · Marc Brooker, 2015-03-04, updated 2023-05-03; sections Introducing OCC, Adding Backoff, Adding Jitter (*read* the opening; rest *headings only*) · covers our angle: **partial** — written about contended writes, not DB connect failures · fetched 2026-10-12
- **Our delta:** which errors are transient for `pg` and the Mongo driver (not confirmed; no page opened).

### T06-15 · Read replicas — When Needed · ✅ `…/15-read-replicas.md`
- **Read this:** [Read-Your-Writes Consistency](https://arpitbhayani.me/blogs/read-your-write-consistency/) · Arpit Bhayani · 2021-09-22; replication lag is the root cause; fixes: synchronous replication, pinning a user to the primary, fragmented pinning, primary fallback (*read*) · covers our angle: **partial** — concept only, no Node code · fetched 2026-10-12
- **Also good:** [Hot Standby](https://www.postgresql.org/docs/current/hot-standby.html) · postgresql.org · PostgreSQL 18; standby queries and conflicts (*read* two passages) · [Read replicas](https://orm.drizzle.team/docs/read-replicas) · orm.drizzle.team · `withReplicas()` sends reads to replicas, writes to primary (*read*) · fetched 2026-10-12

### T06-16 · Streaming large result sets (cursors) — When Needed · ✅ `…/16-cursors.md`
- **Read this:** [pg-cursor](https://node-postgres.com/apis/cursor) · node-postgres.com · reads through large result sets without loading them all; `cursor.read(rowCount)` and `close()` (*read*; ≈490 words) · covers our angle: **partial** — Postgres only · fetched 2026-10-12
- **Also good:** [Access Data From a Cursor](https://www.mongodb.com/docs/drivers/node/current/crud/query/cursor/) · mongodb.com · async iteration, stream API, batching; warns not to mix cursor paradigms on one cursor (*read*) · fetched 2026-10-12

---

## Phase 7 — Background work and resilience

### T07-01 · Sync vs. background — Master · ✅ `docs/nodejs/pages/phase-7-background-work/01-sync-vs-background.md`
- **Read this:** [Keeping your API fast](https://www.inngest.com/docs/patterns/jobs/keeping-your-api-fast) · inngest.com · a handler that returns in under a second hands everything else to a transport, a worker, retry semantics and idempotency (*read* "What this requires"; vendor docs) · covers our angle: **partial** — lists what to hand off, not a "never in the request" rule · fetched 2026-10-12
- **Also good:** [Webhooks](https://docs.stripe.com/webhooks) · stripe.com · the receiver should return 2xx before any complex logic that might time out (*read* one passage) · fetched 2026-10-12

### T07-02 · Job queues: producer/consumer — Understand · ✅ `…/02-job-queues.md`
- **Read this:** [Workers](https://docs.bullmq.io/guide/workers) · docs.bullmq.io · a worker is the "message" receiver; a job that completes is `completed`, a throwing job moves to `failed` (*read*) · covers our angle: **partial** — BullMQ's view; Redis mechanics live in the Redis section · fetched 2026-10-12
- **Also good:** [Queues](https://docs.bullmq.io/guide/queues/) · docs.bullmq.io · the producer side (≈730 words; *headings only*) · fetched 2026-10-12

### T07-03 · Worker processes — Understand · ✅ `…/03-worker-processes.md`
- **Read this:** [Concurrency](https://12factor.net/concurrency) · 12factor.net · "Scale out via the process model" is the section title (*read* the opening; ≈520 words) · covers our angle: **partial** — principle only; sharing code between API and worker is ours · fetched 2026-10-12
- **Also good:** [Going to production](https://docs.bullmq.io/guide/going-to-production) · docs.bullmq.io · ≈1.9k words (*headings only*) · fetched 2026-10-12

### T07-04 · Retries, attempts, stalled jobs, visibility timeout — Understand · ✅ `…/04-retries-and-stalled-jobs.md`
- **Read this:** [Retrying failing jobs](https://docs.bullmq.io/guide/retrying-failing-jobs) · docs.bullmq.io · `attempts` above 1 turns retries on; without a back-off, a retry is immediate (*read*) · covers our angle: **partial** — stalled jobs and visibility timeout are elsewhere · fetched 2026-10-12
- **Also good:** [Stalled jobs](https://docs.bullmq.io/guide/workers/stalled-jobs) · docs.bullmq.io · a worker that cannot renew its lock marks the job stalled, it goes back to waiting; keep the event loop free (*read*) · [Visibility timeout](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html) · AWS SQS · a received message stays in the queue but is invisible to others (*read* the opening) · fetched 2026-10-12

### T07-05 · Job idempotency — Master · ✅ `…/05-job-idempotency.md`
- **Read this:** [Idempotent Consumer](https://microservices.io/patterns/communication-style/idempotent-consumer.html) · microservices.io · record processed message IDs in the database (a `PROCESSED_MESSAGES` table or the business table) and drop duplicates (*read*) · covers our angle: **partial** — message consumers; "assume it runs twice" is our framing · fetched 2026-10-12
- **Also good:** [Idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs) · docs.bullmq.io · design jobs so a first-try success and a retry end in the same state; keep them atomic (*read*) · [Designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency) · Stripe · 2017-02-22; client-generated key, server correlates it (*read*) · fetched 2026-10-12

### T07-06 · Dual-write and the transactional outbox — Understand · ✅ `…/06-transactional-outbox.md`
- **Read this:** [Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html) · microservices.io · problem "How to atomically update the database and send messages"; store the message in the same transaction, a separate process sends it (*read*) · covers our angle: **partial** — no Node code or relay detail · fetched 2026-10-12
- **Also good:** [Transactional outbox pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) · AWS Prescriptive Guidance · defines the dual write problem (*read* the intent) · [Solving the Dual-Write Problem](https://www.confluent.io/blog/dual-write-problem/) · Confluent · 2024-05-29, ≈4k words (*headings only*) · fetched 2026-10-12

### T07-07 · Dead-letter queues — Know · ✅ `…/07-dead-letter-queues.md`
- **Read this:** [Using dead-letter queues in Amazon SQS](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html) · AWS · isolating unconsumed messages helps debugging; examine logs, then redrive (*read*; ≈810 words) · covers our angle: **partial** — SQS, not BullMQ; "why you must read them" is ours · fetched 2026-10-12
- **Also good:** [Implementing Webhook Retries](https://hookdeck.com/webhooks/guides/webhook-retry-best-practices) · Hookdeck · 2026-02-11, modified 2026-07-03; silently discarding a failed event is the worst outcome (*read* that section; vendor) · fetched 2026-10-12

### T07-08 · Scheduled and recurring jobs — Know · ✅ `…/08-scheduled-jobs.md`
- **Read this:** [Job Schedulers](https://docs.bullmq.io/guide/job-schedulers/) · docs.bullmq.io · `upsertJobScheduler` with `every` or cron; a `tz` option, and `tz: 'UTC'` for UTC cron (*read*) · covers our angle: **partial** — overlap and drift are not discussed · fetched 2026-10-12
- **Also good:** [Prevent overlapping cron jobs](https://www.nodecron.com/prevent-overlapping-cron-jobs.html) · node-cron docs · `noOverlap` skips a tick while the previous run is active (*read*) · fetched 2026-10-12
- **Our delta:** drift and catch-up after downtime. Search found nothing on it; not confirmed.

### T07-09 · Outbound side-effects as jobs — Know · ✅ `…/09-outbound-side-effects.md`
- **Read this:** [Implementing Webhook Retries](https://hookdeck.com/webhooks/guides/webhook-retry-best-practices) · Hookdeck · 2026-02-11, modified 2026-07-03; backoff, jitter, response-code rules, DLQ, endpoint disabling, idempotency (*read* DLQ section; rest *headings only*; written by a vendor of this product) · covers our angle: **partial** — webhooks only; email and notifications not covered · fetched 2026-10-12
- **Also good:** [Keeping your API fast](https://www.inngest.com/docs/patterns/jobs/keeping-your-api-fast) · inngest.com · notifications and third-party calls belong off the request path (*read*) · fetched 2026-10-12

### T07-10 · Time on the server — Know · ✅ `…/10-time-on-the-server.md`
- **Read this:** [Date/Time Types](https://www.postgresql.org/docs/current/datatype-datetime.html) · postgresql.org · `timestamp with time zone` is stored as UTC and converted to the session zone on output; the original zone is not kept (*read*) · covers our angle: **partial** — storage only; scheduler clocks and "ends at midnight" are not covered · fetched 2026-10-12
- **Also good:** [10 Date-and-Time Bugs](https://dev.to/luke_bowers/10-date-and-time-bugs-i-still-see-in-production-and-how-to-avoid-them-31ke) · DEV Community · 2025-07-28; cron jobs drift by an hour at DST, so run in UTC or use a zone-aware scheduler (*read* that bullet; thin, and the post promotes its own API) · fetched 2026-10-12

### T07-11 · Graceful worker shutdown — Master · ✅ `…/11-graceful-shutdown.md`
- **Read this:** [Graceful shutdown](https://docs.bullmq.io/guide/workers/graceful-shutdown) · docs.bullmq.io · `await worker.close()` stops new jobs and waits for current ones; it has no timeout of its own; if it fails, pending jobs become stalled (*read*) · covers our angle: **partial** — the SIGTERM wiring and "don't ack early" are ours · fetched 2026-10-12

### T07-12 · Timeout budgets — Master · ✅ `…/12-timeout-budgets.md`
- **Read this (1/2):** [Timeouts, retries, and backoff with jitter](https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter) · AWS Builder Center · 2026-06-12 (moved from the Builders' Library); pick a timeout from a downstream latency percentile, with caveats for internet latency (*read*) · covers our angle: **partial** — per-call timeouts, not a shrinking budget · fetched 2026-10-12
- **Read this (2/2):** [Deadlines](https://grpc.io/docs/guides/deadlines/) · grpc.io · a deadline is a point in time past which a client will not wait; propagation converts it to a timeout with elapsed time deducted (*read*) · covers the shrinking-budget angle: full · fetched 2026-10-12

### T07-13 · Deadline propagation with one `AbortSignal` — Understand · ✅ `…/13-deadline-propagation.md`
- **Read this (1/2):** [AbortSignal.timeout()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static) · MDN · aborts with a `TimeoutError`; timeout counts active, not elapsed, time (*read*) · covers our angle: **partial** — browser-oriented · fetched 2026-10-12
- **Read this (2/2):** [AbortSignal.any()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static) · MDN · the result aborts when any input aborts, with the first one's reason (*read*) · covers our angle: **partial** — Node version support not confirmed from this page · fetched 2026-10-12
- **Also good:** [Deadlines](https://grpc.io/docs/guides/deadlines/) · grpc.io · the idea of propagating one deadline across calls (*read*) · fetched 2026-10-12

### T07-14 · Retry only safe, transient failures — Master · ✅ `…/14-retry-safe-failures.md`
- **Read this:** [Low-level error handling](https://docs.stripe.com/error-low-level) · stripe.com · GET and DELETE are idempotent; POST needs an idempotency key; treat a 500 outcome as indeterminate and do not retry with a new key (*read*) · covers our angle: **partial** — one API's rules, but the reasoning generalises · fetched 2026-10-12
- **Also good:** [Timeouts, retries, and backoff with jitter](https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter) · AWS Builder Center · 2026-06-12; design APIs idempotent so they can be retried safely (*read*) · fetched 2026-10-12

### T07-15 · Exponential backoff and jitter — Master · ✅ `…/15-backoff-and-jitter.md`
- **Read this:** [Exponential Backoff And Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) · AWS Architecture Blog · Marc Brooker, 2015-03-04, updated 2023-05-03; backoff first, then jitter to break up synchronized clients (*read* the opening; sections Adding Backoff and Adding Jitter *headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Retrying failing jobs](https://docs.bullmq.io/guide/retrying-failing-jobs) · docs.bullmq.io · the `jitter` option on a backoff, as a fraction of the delay (*read*) · fetched 2026-10-12
- *Checked, not chosen:* Hookdeck retries guide has a jitter section (*headings only*), vendor-run.

### T07-16 · Concurrency limiting — Master · ✅ `…/16-concurrency-limiting.md`
- **Read this:** [p-limit readme](https://unpkg.com/p-limit@7.3.3/readme.md) · unpkg copy of p-limit 7.3.3 (github returned 403) · `pLimit(concurrency)` returns a `limit` function; `activeCount` and `pendingCount` expose the queue (*read*) · covers our angle: **partial** — a library API; why the Phase 2 `Promise.all` outage happens is ours · fetched 2026-10-12
- **Our delta:** worker pools for CPU work (`worker_threads`) are not covered by this page; no page chosen for them.
