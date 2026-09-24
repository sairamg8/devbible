---
name: plan-nextjs-ch15b-crud-api-postgres
description: The brief and topic plan for the NEW Next.js chapter 15b — building a CRUD API with Postgres — requested by the user 2026-09-05; placement decision, topic list, per-topic scope, and what each neighbouring chapter already owns.
metadata:
  type: project
---

# Next.js chapter 15b · Building a CRUD API with Postgres

**Requested by the user 2026-09-05**, in the same instruction as "continue with 15 and next 18":
*"i need dedicated chapter to create a crud API with databse using postgres"*. It is a **new
chapter**, not a topic inside chapter 15.

## 🔴 SUPERSEDED 2026-09-05 — it is chapter 16, a FULL chapter

The user read the proposal below and answered: **"15b as a full chapter 16, do the renumber."**
So the directory is `docs/nextjs/pages/16-building-a-crud-api-with-postgres/` at `"position": 16`,
and chapters **16→17, 17→18, 18→19, 19→20** were renumbered in commit `0bdf4e87`. The track is
**20 chapters**. The chapter is **open at 1 of 13** — the index exists, every topic is a bold
*(not written yet)* placeholder. The reasoning below is kept because the trade-off it names is
real and the next person proposing a renumber should see what it costs.

## The placement decision as originally proposed, and why

`docs/nextjs/pages/15b-building-a-crud-api-with-postgres/`, `_category_.json` at
`"position": 15.5`, label `"15b · Building a CRUD API with Postgres"`.

- **Reading position is right.** It belongs immediately after ch15 (databases, APIs, full-stack
  patterns) and before ch16 (deployment) — it is the hands-on build that ch15 has just given the
  reader the parts for.
- **Nothing is renumbered.** Inserting a real chapter 16 would push 16–19 up by one and break every
  inbound link in the corpus, plus five `progress.js` rows and five `_category_.json` files.
  Docusaurus accepts a float `position`, so `15.5` sorts between 15 and 16 with zero collateral.
- **The lettered form is already house style**, one level down: a file that outgrows the cap gains
  a lettered sibling (`04-x.md` → `04b-y.md`) precisely so numbering never shifts. This applies the
  same rule at chapter level.

## The difference from chapter 15 — say it on the chapter index

ch15 is **patterns**: which database client, which pooling model, Route Handler *vs* Server Action,
realtime, jobs. **ch15b is one build, start to finish**: a real resource, a real schema, a real
API, every verb, every failure mode, wired to the UI and deployed. ch15 answers *which*; ch15b
answers *how, concretely, and what breaks*.

## Topic plan (each is a TOPIC, i.e. several pages — not a page)

| # | Topic | The load-bearing content |
|---|---|---|
| 01 | What we are building, and what "a CRUD API" means in the App Router | The resource model; Route Handlers vs Server Actions vs both against one service layer; why the answer is usually both; the contract before the code |
| 02 | The schema and the migration story | Table design for the API's real access patterns; keys and constraints as the API's first validation layer; `drizzle-kit` migrations; what a migration must never do while old code is live |
| 03 | The connection you actually get | Pooling in a function that may be frozen; module-scope client vs per-request; the dev hot-reload connection leak; Neon pooled endpoint vs direct |
| 04 | The Data Access Layer | One place every query lives; typed end to end; why a Route Handler never touches the driver; where authorization is enforced so it cannot be forgotten |
| 05 | CREATE | POST semantics; validation at the boundary with zod; mapping constraint violations (unique, FK, check) to status codes; `Location` and 201; idempotency keys for a retried POST |
| 06 | READ | GET one vs GET many; filtering and sorting without SQL injection; offset vs keyset pagination and why offset degrades; shaping the response; caching a collection and invalidating it |
| 07 | UPDATE | PUT vs PATCH; partial updates; the lost-update problem; optimistic concurrency with a version column or ETag/`If-Match`; 409 vs 412 |
| 08 | DELETE | Hard vs soft; cascades and referential integrity; 204 vs 200; idempotent delete; restoring |
| 09 | Transactions and multi-table writes | What genuinely needs one; isolation levels in PostgreSQL 18; serialization failures and the retry loop; a transaction across an HTTP boundary is not a thing |
| 10 | Errors, status codes and one error shape | A single response envelope the client can rely on; never leaking a driver error; logging the cause and returning the code |
| 11 | Auth and ownership on the API surface | Every row-returning query scoped by the caller; 401 vs 403 vs 404-as-403; cross-links ch10 |
| 12 | Testing the API, and the seed/reset story | Cross-links ch13; what is worth testing at the HTTP boundary vs the DAL |
| 13 | Project milestone | The finished API wired to the UI and deployed |

## Pins this chapter forces (versions checked against registry.npmjs.org 2026-09-05)

`drizzle-orm` **0.45.2** · `drizzle-kit` **0.31.10** · `@neondatabase/serverless` **1.1.0** ·
`pg` **8.23.0** (`@types/pg` 8.23.1) · `postgres` 3.4.9 (only if taught) · `bullmq` 6.3.4 (ch15
topic 04 only, if taught). `postgresql` already pinned at **18.4** and **gained the `nextjs` track
2026-09-05** (`dd3ec9bd`). `zod` is pinned but has drifted 4.4.3 → 4.5.4 — currency lane's, not this
one's.

## Do not re-teach — cross-link
`docs/postgresql/` owns SQL, indexing, full-text search. ch04 data fetching · ch05 caching/PPR ·
ch08 state · ch10 forms/auth/security · ch13 testing · ch15 the patterns above · ch15 topic 10
(`10`, `10b`–`10e`) owns multi-tenancy and tenant-scoped isolation.
