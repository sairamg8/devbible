---
title: "16 · Building a CRUD API with Postgres — the chapter where the parts stop being options and become one running resource, because every interesting decision in a CRUD API is a decision about what happens when two requests arrive at once"
sidebar_label: "Overview"
sidebar_position: 0
description: "Chapter 16 index: what this chapter builds and how it differs from chapter 15, the resource contract, the schema, the connection, the Data Access Layer, each verb as its own topic, transactions, one error shape, ownership, testing, and the milestone."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js documentation — [Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route),
> [Server Actions and Mutations](https://nextjs.org/docs/app/getting-started/updating-data) —
> and the [PostgreSQL 18 documentation](https://www.postgresql.org/docs/18/index.html).
> Target: **Next.js 16.3.4 · React 19.2.8 · Node 24.20.0 · PostgreSQL 18.4**.
> Documentation-verified, **no sandbox run**, no timings.

**Chapter 15 answers *which* — which driver, which pooling model, a Route Handler or a Server Action. This chapter answers *how, concretely, and what breaks*.** It builds one resource end to end against a real Postgres database: a schema, a migration, a connection that survives a serverless function's lifecycle, a Data Access Layer nothing can route around, and then every verb in turn — with the failure each verb actually has in production rather than the happy path each verb has in a tutorial. The thesis of the chapter is that **CRUD is easy until two requests overlap**, and that almost every topic here is really a concurrency or a trust question wearing a REST verb as a costume.

## Why this is a separate chapter from 15

Chapter 15 is a survey of full-stack patterns: database integrations, hybrid API design, real-time, background jobs, edge compute, multi-tenancy. It is organised by *concern*, and each topic is deliberately independent of the others.

This chapter is organised by *one build*. The same resource carries through every page, so a decision made in the schema shows up three topics later as an HTTP status code, and the ownership predicate written in the Data Access Layer is the reason the DELETE topic has nothing to say about authorization. That accumulation is the point — it is what a survey chapter cannot give you.

## What it deliberately does not own

- **SQL itself** — DDL, indexing, query planning and full-text search belong to the separate `docs/postgresql/` track. This chapter writes queries; it does not teach the language.
- **Driver and pooling choice** — chapter 15 topic 01 settles serverless Postgres, Neon, Prisma, Drizzle and the three kinds of pool. This chapter picks one and lives with the consequences.
- **Sessions, passwords and CSRF** — chapter 10 owns authentication and security hardening. Topic 11 here is only about the authorization predicate on a row.
- **Test runners and CI** — chapter 13 owns testing and developer experience. Topic 12 here is only about what is worth asserting at an HTTP boundary.

## Chunks

**Thirteen topics, 71 pages.** Every topic below is a topic, not a page — the count is what it actually runs to on disk, and the link goes to that topic's first chunk.

| # | Topic | Pages | Covers |
|---|---|---:|---|
| 01 | **[The resource contract](01-the-resource-contract.md)** | 3 | What "a CRUD API" means in the App Router; Route Handlers and Server Actions against one shared service layer; the six routes and the codes they commit to |
| 02 | **[The schema and the migration story](02-the-schema-and-the-migration-story.md)** | 5 | Table design driven by real access patterns; constraints as the first validation layer; 🔴 the lock a migration actually takes, and expand-and-contract while the old code is still serving |
| 03 | **[The connection you actually get](03-the-connection-you-actually-get.md)** | 4 | Pooling inside a function that may be frozen; the arithmetic and the three escapes; the dev hot-reload leak; what does not survive the pooler |
| 04 | **[The Data Access Layer](04-the-data-access-layer.md)** | 6 | One place every query lives; 🔴 where the ownership predicate goes so it cannot be forgotten, and where it must *not* live; projections rather than rows |
| 05 | **[CREATE](05-create.md)** | 8 | POST semantics; validating at the boundary; mapping SQLSTATE to status codes; idempotency keys for a retried POST; client-supplied ids; the `position` value under concurrent creates |
| 06 | **[READ](06-read.md)** | 7 | One vs many; filtering and sorting without injection; 🔴 offset vs keyset pagination and why offset degrades; caching a collection; the N+1; conditional requests and `ETag` |
| 07 | **[UPDATE](07-update.md)** | 7 | PUT vs PATCH; absent vs null; 🔴 the lost update, and optimistic concurrency with a version column; `If-Match` and 412; pessimistic locking and when it is right |
| 08 | **[DELETE](08-delete.md)** | 5 | Hard vs soft, and what soft delete costs every read; cascades and referential integrity; 204 vs 200 and why delete must be idempotent; restoring a row |
| 09 | **[Transactions and multi-table writes](09-transactions-and-multi-table-writes.md)** | 7 | What genuinely needs one; isolation levels in PostgreSQL 18; 🔴 serialization failures and the retry loop; why a transaction cannot span an HTTP boundary; duration as pool occupancy |
| 10 | **[Errors and one response shape](10-errors-and-one-response-shape.md)** | 2 | 🔴 One envelope, **two renderings** — a Route Handler has a status code and a Server Action does not; never leaking a driver error |
| 11 | **[Ownership on the API surface](11-ownership-on-the-api-surface.md)** | 1 | Every row-returning query scoped to the caller; 401 vs 403 vs answering 404 on purpose |
| 12 | **[Testing the API](12-testing-the-api.md)** | 12 | The three questions and the three homes; asserting the envelope, not the prose; the ownership negative test; seed and reset; 🔴 forcing the interleaving, because a sequential test of a concurrency fix proves nothing |
| 13 | **[Project milestone](13-project-milestone-sprintdesk-cards-api.md)** | 4 | The finished API wired to the UI and deployed — the seams, what each fix costs the database, and the acceptance evidence |

## Phase gate

You are done with this chapter when you can take a resource nobody has modelled yet and ship an API for it that survives two clients writing the same row in the same second — and can say, for each verb, which status code that collision produces and why.

## Where this connects

- [15 · Databases, APIs and full-stack patterns](../15-databases-apis-and-full-stack-patterns/01-explanation.md) — the parts this chapter assembles
- [15 · Multi-tenant applications](../15-databases-apis-and-full-stack-patterns/10-multi-tenant-applications.md) — the isolation predicate, once there is more than one customer
- [10 · Forms, authentication and security hardening](../10-forms-authentication-and-security-hardening/01-explanation.md) — who the caller is, before this chapter asks what they may touch
- [13 · Testing and developer experience](../13-testing-and-developer-experience/01-explanation.md) — the runner and the CI gate
- [17 · Deployment, scaling and observability](../17-deployment-scaling-and-observability/01-explanation.md) — where the finished API runs, and what it costs

---

Start → [01 · The resource contract](01-the-resource-contract.md) · [Chapter 15 index](../15-databases-apis-and-full-stack-patterns/01-explanation.md)
