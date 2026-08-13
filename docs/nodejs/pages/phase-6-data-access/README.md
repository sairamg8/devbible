---
title: "Phase 6 — Data access"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target runtime: Node 24 — the Active LTS as of August 2026.**
> Every example was executed on **Node 24.19.0** against real servers:
> **PostgreSQL 17.10** (plus a live streaming replica) and **MongoDB 8.2.12**
> (single-node replica set), with `pg` 8.23.0, `mongodb` 7.5.0, `mongoose` 9.9.1,
> `drizzle-orm` 0.45.2 and `prisma` 7.9.1.

**Complete — 16 pages.** This phase opens **Part 3 — Application layer**. Node-side
concerns only: pooling, parameterization, transactions, N+1, cursors. Query planners,
indexes, aggregation, MVCC and replication mechanics belong to the PostgreSQL and
MongoDB sections.

## Pages

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Connection pooling](./01-connection-pooling.md)** | <span className="db-tier t-master">Master</span> | 279 ms of connecting versus 6 ms of reusing — and the missing `'error'` listener that kills the process |
| 02 | **[Parameterized queries](./02-parameterized-queries.md)** | <span className="db-tier t-master">Master</span> | A stacked `drop table` really executed; `{"$ne":null}` really logged in as admin |
| 03 | **[Driver lifecycle](./03-driver-lifecycle.md)** | <span className="db-tier t-understand">Understand</span> | Pools connect lazily, so nothing fails until your first user. `query_timeout` does not stop the query |
| 04 | **[PostgreSQL from Node](./04-postgresql-from-node.md)** | <span className="db-tier t-master">Master</span> | `count(*) + 1` is `"50001"`, and a `date` column arrives a day early |
| 05 | **[MongoDB from Node](./05-mongodb-from-node.md)** | <span className="db-tier t-master">Master</span> | `MongoClient` is the pool; `_id` is an `ObjectId` and a string never matches it |
| 06 | **[Transactions](./06-transactions.md)** | <span className="db-tier t-understand">Understand</span> | One flow's `ROLLBACK` ran on another's connection — and how to propagate `tx` without leaking the driver |
| 07 | **[N+1 queries](./07-n-plus-1.md)** | <span className="db-tier t-understand">Understand</span> | 101 queries 111 ms → 2 queries 7 ms. `Promise.all` is not the fix |
| 08 | **[Drivers vs builders vs ORMs](./08-drivers-builders-orms.md)** | <span className="db-tier t-understand">Understand</span> | 500 lookups: `pg` 296 ms · Drizzle 388 ms · Prisma 597 ms — and why that is the wrong reason to choose |
| 09 | **[Mongoose](./09-mongoose.md)** | <span className="db-tier t-understand">Understand</span> | A 40-character name was written past `maxlength: 30` — validators do not run on updates |
| 10 | **[The repository pattern](./10-repository-pattern.md)** | <span className="db-tier t-understand">Understand</span> | Four tests in 139 ms with no database, because business logic never imported `pg` |
| 11 | **[Migrations as code](./11-migrations.md)** | <span className="db-tier t-understand">Understand</span> | Forty lines: ordered files, a ledger, an advisory lock, one transaction each. The second deploy waited 1306 ms |
| 12 | **[`node:sqlite`](./12-node-sqlite.md)** | <span className="db-tier t-know">Know</span> | A real SQL database with no install. Foreign keys are on, big integers throw, 1000 inserts go 66 ms → 1 ms |
| 13 | **[Prisma and Drizzle](./13-prisma-drizzle.md)** | <span className="db-tier t-know">Know</span> | Prisma 7 moved the URL out of the schema and requires an adapter; `include` is two queries, not a join |
| 14 | **[Retry and backoff](./14-retry-backoff.md)** | <span className="db-tier t-know">Know</span> | Which errors are transient, why jitter, and why a timeout is not permission to retry a write |
| 15 | **[Read replicas](./15-read-replicas.md)** | <span className="db-tier t-when">When Needed</span> | The read after the write returned 0 rows — on a 1.6 ms replica on the same machine |
| 16 | **[Cursors and streaming](./16-cursors.md)** | <span className="db-tier t-when">When Needed</span> | 500 000 rows: 300 MB buffered vs 111 MB cursored. Object-mode streams cost 5.7× |

## Where this connects

- **[Phase 1 — modules](../phase-1-modules/README.md)** explains why `import pg from 'pg'`
  is the safe form for a CommonJS driver.
- **[Phase 2 — async](../phase-2-async/README.md)** supplies `AsyncLocalStorage` for
  transaction propagation and the concurrency limiting that an N+1 "fixed" with
  `Promise.all` needs.
- **[Phase 5 — HTTP and processes](../phase-5-http-processes/README.md)** owns graceful
  shutdown; `pool.end()` hangs off the end of it.
- **Phase 7 — background work** depends on transactions: the transactional outbox
  is "write the job in the same transaction".
- **Phase 8 — security** goes deeper on injection, of which
  [page 02](./02-parameterized-queries.md) is the data-access half.

---

← Phase 5: [Networking, HTTP, processes](../phase-5-http-processes/README.md) · Start → [Connection pooling](./01-connection-pooling.md)
