---
title: "15 · Databases, APIs and full-stack patterns — the chapter where React stops being the hard part, because every failure in it is silent, arrives under load, and is invisible to the compiler that told you the code was fine"
sidebar_label: "Overview"
sidebar_position: 0
description: "Chapter 15 index: serverless Postgres and the three kinds of pool, Prisma versus Drizzle as models, migrations, Route Handlers versus Server Actions, SSE and WebSockets, background jobs and Postgres as a queue, the edge-runtime deprecation and custom cache structures, and multi-tenancy."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the [Neon](https://neon.com/docs/connect/connection-pooling), [Prisma ORM v7](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections), [Drizzle](https://orm.drizzle.team/llms-full.txt), [`node-postgres`](https://node-postgres.com/features/pooling), [PostgreSQL 18](https://www.postgresql.org/docs/18/index.html) and [Next.js 16.3.4](https://nextjs.org/docs) documentation, plus the [WHATWG HTML](https://html.spec.whatwg.org/multipage/server-sent-events.html) server-sent-events section and [MDN](https://developer.mozilla.org/en-US/docs/Web/API/EventSource).
> Target: **Next.js 16.3.4 · React 19.2.8 · Node 24.20.0 · PostgreSQL 18.4 · Prisma 7.10.0 · `drizzle-orm` 0.45.2 · `pg` 8.23.0 · `@neondatabase/serverless` 1.1.0**.
> Documentation-verified, **no sandbox run**, no timings.

**This is the chapter where the compiler stops helping you. Every other chapter in this track has failures you can see: a type error, a hydration mismatch, a build that will not build. The failures here are different in kind — a connection limit reached only at peak, a migration that was generated and never applied, a Server Action that is a public POST endpoint, a stream that works in `next dev` and silently buffers in production, a revalidation that reaches one instance out of eight. None of them errors. Several of them look like success. The organising claim of the chapter is that in full-stack Next.js, *your code being correct is roughly half the problem*, and the other half is a set of operational facts that no amount of reading your own source will reveal.**

## What this chapter owns, by topic

| Topic | Pages | The argument |
|---|---:|---|
| **[01 · Database integrations](01-database-integrations-serverless-postgres-neon-prisma-drizzl.md)** | 14 | Connections are the scarce resource, not queries. The three kinds of pool, transaction pooling and session state, prepared statements under a pooler, the HTTP driver, where the client instance lives — then Prisma versus Drizzle as *models*, and migrations in each. |
| **[02 · Hybrid API design](02-hybrid-api-design-route-handlers-and-server-actions-side-by.md)** | 14 | A Server Action and a Route Handler are both POST endpoints on your origin; the difference is who is meant to call them and what the framework does for you either way. Ends at the Data Access Layer, which is the answer to *"how do I not get this wrong."* |
| **[03 · Real-time: SSE and WebSockets](03-real-time-server-sent-events-and-websockets-in-a-serverless.md)** | 13 | The stream format, producing it correctly, resumption via `Last-Event-ID`, what silently breaks it in production, and why a long-lived WebSocket does not fit the serverless request model. |
| **[04 · Background jobs and queues](04-background-jobs-and-message-queues-for-async-workloads.md)** | 13 | A serverless request is not the place slow work happens. `after()` is not a queue; Postgres with `FOR UPDATE SKIP LOCKED` is one, and it is the only queue that can enqueue inside the transaction that caused the job. |
| **[05 · Edge and custom cache structures](05-edge-functions-and-custom-cache-structures-for-global-comput.md)** | 7 | 🔴 The Edge Runtime is **deprecated**, so "global" now means a CDN in front and a cache handler behind — both configured, neither declared. |
| **[06 · Milestone: SprintDesk](06-project-milestone-sprintdesk-on-drizzle-neon-with-pooling.md)** | 1 | Three features, six seams, and six acceptance questions you must be able to answer without opening anything. |
| **[10 · Multi-tenant applications](10-multi-tenant-applications.md)** | 5 | Tenant routing, isolation in the data access layer, tenancy and caching, tenant-scoped invalidation. |

## The five facts the chapter is really built on

If you retain nothing else, retain these. Each is documented, each is counter-intuitive, and each has a page that proves it.

1. **Your connection count is instances × pool size**, and a traffic spike multiplies the first term. No ORM changes this arithmetic; there are exactly three escapes. → [01b](01b-the-three-kinds-of-pool.md)
2. **Type safety means "your code agrees with your schema file"**, never "your code agrees with your database". Only an applied migration closes that gap. → [01hb](01hb-generated-types-and-inferred-types.md), [01i](01i-migrations-in-each.md)
3. **A Server Action is reachable by anyone who can send the same POST.** The page's auth check protects the UI, not the endpoint. → [02e](02e-authentication-and-authorisation-at-the-entry-point.md)
4. **A queue in your database can be written in the same transaction as the write that caused the job.** A separate broker structurally cannot. → [04d](04d-postgres-as-a-queue-skip-locked.md), [04e](04e-at-least-once-and-idempotency.md)
5. **`revalidateTag()` invalidates one instance and never reaches your CDN.** A mutation has three caches to invalidate and only the first is automatic. → [05h](05h-a-shared-cache-across-instances.md), [05c](05c-the-cdn-layer-and-cache-control.md)

## What this chapter deliberately does not own

- **SQL itself** — DDL, indexing and query planning belong to the separate `docs/postgresql/` track. This chapter writes queries; it does not teach the language.
- **The caching model** — `use cache`, `cacheLife` and PPR are [chapter 5](../05-caching-ppr-and-cache-components/01-explanation.md). Topic 05 here owns the *infrastructure* underneath that model: the CDN, the cache handler, the shared store.
- **Authentication, sessions and CSRF** — [chapter 10](../10-forms-authentication-and-security-hardening/01-explanation.md). Topic 02 here is only about the entry point being untrusted.
- **Building one resource end to end** — that is [chapter 16](../16-building-a-crud-api-with-postgres/01-explanation.md), which answers *how, concretely, and what breaks* where this chapter answers *which*.
- **Platform operations** — [chapter 17](../17-deployment-scaling-and-observability/01-explanation.md) owns deployment, scaling and observability.

## Two version findings, current as of 2026-09-05

⚠️ **The Edge Runtime is deprecated.** `export const runtime = 'edge'` is listed as deprecated on the `runtime` segment config, and the migration is a deletion — *"The Node.js runtime is the default, so no replacement is needed."* The docs name **no removal version** and do **not** state that the build fails. → [05b](05b-the-edge-runtime-is-deprecated.md)

⚠️ **Two ORM toolchains are mid-major.** The published Prisma Migrate documentation now describes **Prisma 8**, while this chapter targets 7.10.0 and cites the versioned `/docs/orm/v7/` paths; the `prisma` CLI's npm `latest` tag points at an `8.0.0` release candidate. Separately, the published Drizzle docs describe the **1.0 release candidate** while npm `latest` is `0.45.2`, and the two disagree on the relations API. Both are recorded in `src/data/pins.js`. → [01h](01h-prisma-and-drizzle-as-models.md), [01ha](01ha-relations-mean-different-things.md), [01ia](01ia-push-pooling-and-proving-the-migration-ran.md)

## Phase gate

You are done with this chapter when you can take a feature request — *"the board should update live"* — and name, before writing any code, which of the five facts above it will collide with, what the failure will look like in production, and what evidence would prove you had closed it. The [milestone](06-project-milestone-sprintdesk-on-drizzle-neon-with-pooling.md) is that exercise, with the answers.

---

[Chapter 14 · Agent-driven development](../14-agent-driven-development/01-explanation.md) · Start → [01 · Database integrations](01-database-integrations-serverless-postgres-neon-prisma-drizzl.md) · Next chapter → [16 · Building a CRUD API with Postgres](../16-building-a-crud-api-with-postgres/01-explanation.md)
