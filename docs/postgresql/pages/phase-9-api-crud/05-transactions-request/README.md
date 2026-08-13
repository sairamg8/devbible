---
title: "Transactions in a request"
sidebar_label: "Overview"
sidebar_position: 0
---

# Transactions in a request

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex39-tx-request.mjs`.

**A transaction is a property of one connection, so the whole pattern is about
holding one connection for the length of the request and giving it back exactly
once.** Get the wrapper right and everything inside it composes; get it wrong and
`ROLLBACK` silently undoes only part of the work.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[The wrapper](01-the-wrapper.md)** | `BEGIN`/`COMMIT`/`ROLLBACK` on a checked-out client, the `try/catch/finally` shape, a reusable `withTransaction`, and why `pool.query('BEGIN')` produces a transaction that is not one — measured with 7 of 8 writes surviving a `ROLLBACK` |
| 02 | **[Savepoints, aborts and duration](02-savepoints-and-duration.md)** | `25P02` after the first error, `SAVEPOINT` for a step allowed to fail, and what an `await` that is not a query costs while the transaction is open |

## Phase gate

- Why must `BEGIN` and `COMMIT` run on the same checked-out client?
- What does `pool.query('BEGIN')` actually do, and why does it appear to work in testing?
- What happens to the next query after an error inside a transaction?
- What is the cost of calling a payment provider between `BEGIN` and `COMMIT`?

## Where this connects

- **[A repository module per resource](../01-repository/README.md)** establishes the
  contract this relies on: every repository function takes the client as its
  first argument.
- **[Passing a client through services](../12-client-propagation.md)** is the
  failure mode when one function in the chain ignores that contract.
- **[Phase 11 · Transactions and MVCC](../../phase-11-mvcc/README.md)** owns isolation
  levels, lost updates and locking. This topic is only about the request-shaped
  wrapper around them.
- **[Phase 11 · Idle in transaction](../../phase-11-mvcc/14-idle-in-transaction.md)**
  covers the server-side consequences of the duration problem in chunk 02.

---

← [Phase index](../README.md) · Start → [The wrapper](01-the-wrapper.md)
