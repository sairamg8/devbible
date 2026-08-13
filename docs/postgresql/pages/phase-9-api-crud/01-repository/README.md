---
title: "A repository module per resource"
sidebar_label: "Overview"
sidebar_position: 0
---

# A repository module per resource

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex38-repository.mjs`.

**A repository is not a class, a base class, or an abstraction over SQL — it is a
module of plain functions whose first argument is whatever will run the query.**
That one decision, `db` as the first parameter, is what lets the same function be
called standalone and inside a transaction without knowing which is happening.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[The executor contract](01-the-executor-contract.md)** | Why every function takes `db` first, `Pool` and `Client` being interchangeable (measured), what happens when a repository calls `pool.connect()` itself, and the leak that follows |
| 02 | **[Rows to domain objects](02-rows-to-domain.md)** | What `pg` actually hands back per column type, `rowCount` vs `rows.length`, the missing-row result, and where the mapping layer belongs |
| 03 | **[Errors to HTTP status codes](03-errors-to-http.md)** | The SQLSTATE table produced by causing each error for real, which error fields are safe to return, and the constraint-name switch |

## Phase gate

- Why is the first argument `db` rather than the module importing the pool?
- What is the difference in behaviour between passing `pool` and passing a checked-out `client`?
- What does `pg` return for a `SELECT` that matches no rows — and does it throw?
- Which field of a `pg` error is safe to show a client, and which one echoes their input back?

## Where this connects

- **[Transactions in a request](../05-transactions-request/README.md)** is the other half:
  this topic says repository functions accept a client, that one says who opens
  and closes it.
- **[Passing a client through services](../12-client-propagation.md)** shows what
  breaks when one function in the chain ignores the contract.
- **Node [Phase 6 · Data access](/docs/nodejs/pages/phase-6-data-access/)** owns the
  layering rationale, pool sizing and the ORM comparison. This topic is the
  PostgreSQL-facing half and links out rather than re-teaching them.

---

← [Phase index](../README.md) · Start → [The executor contract](01-the-executor-contract.md)
