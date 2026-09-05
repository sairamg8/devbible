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

Every topic below is a topic, not a page — each will run to several chunks.

| # | Topic | Covers |
|---|---|---|
| 01 | **The resource contract** *(not written yet)* | What "a CRUD API" means in the App Router; Route Handlers and Server Actions against one shared service layer; writing the contract before the code |
| 02 | **The schema and the migration story** *(not written yet)* | Table design driven by real access patterns; constraints as the API's first validation layer; migrations that are safe while the old code is still serving |
| 03 | **The connection you actually get** *(not written yet)* | Pooling inside a function that may be frozen; module-scope client vs per-request; the dev hot-reload connection leak |
| 04 | **The Data Access Layer** *(not written yet)* | One place every query lives; why a Route Handler never touches the driver; 🔴 where authorization goes so it cannot be forgotten |
| 05 | **CREATE** *(not written yet)* | POST semantics; validation at the boundary; mapping unique, foreign-key and check violations to status codes; 201 and `Location`; idempotency keys for a retried POST |
| 06 | **READ** *(not written yet)* | One vs many; filtering and sorting without injection; 🔴 offset vs keyset pagination and why offset degrades; caching a collection and invalidating it |
| 07 | **UPDATE** *(not written yet)* | PUT vs PATCH; partial updates; the lost-update problem; optimistic concurrency with a version column or `If-Match`; 409 vs 412 |
| 08 | **DELETE** *(not written yet)* | Hard vs soft; cascades and referential integrity; 204 vs 200; why delete must be idempotent |
| 09 | **Transactions and multi-table writes** *(not written yet)* | What genuinely needs one; isolation levels in PostgreSQL 18; 🔴 serialization failures and the retry loop; why a transaction cannot span an HTTP boundary |
| 10 | **Errors and one response shape** *(not written yet)* | A single envelope the client can rely on; never leaking a driver error; logging the cause and returning the code |
| 11 | **Ownership on the API surface** *(not written yet)* | Every row-returning query scoped to the caller; 401 vs 403 vs answering 404 on purpose |
| 12 | **Testing the API** *(not written yet)* | What is worth asserting at the HTTP boundary vs in the Data Access Layer; the seed and reset story |
| 13 | **Project milestone** *(not written yet)* | The finished API wired to the UI and deployed |

## Phase gate

You are done with this chapter when you can take a resource nobody has modelled yet and ship an API for it that survives two clients writing the same row in the same second — and can say, for each verb, which status code that collision produces and why.

## Where this connects

- [15 · Databases, APIs and full-stack patterns](../15-databases-apis-and-full-stack-patterns/01-explanation.md) — the parts this chapter assembles
- [15 · Multi-tenant applications](../15-databases-apis-and-full-stack-patterns/10-multi-tenant-applications.md) — the isolation predicate, once there is more than one customer
- [10 · Forms, authentication and security hardening](../10-forms-authentication-and-security-hardening/01-explanation.md) — who the caller is, before this chapter asks what they may touch
- [13 · Testing and developer experience](../13-testing-and-developer-experience/01-explanation.md) — the runner and the CI gate
- [17 · Deployment, scaling and observability](../17-deployment-scaling-and-observability/01-explanation.md) — where the finished API runs, and what it costs

---

Start → **The resource contract** *(not written yet)* · [Chapter 15 index](../15-databases-apis-and-full-stack-patterns/01-explanation.md)
