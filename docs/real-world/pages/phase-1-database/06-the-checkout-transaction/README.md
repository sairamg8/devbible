---
title: "The checkout transaction"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against PostgreSQL 17 documentation — transactions,
> explicit locking (`FOR UPDATE`), isolation levels, error codes. Concept home:
> [Node — transactions from Node](../../../../nodejs/pages/phase-6-data-access/06-transactions.md)
> and the [PostgreSQL MVCC phase](../../../../postgresql/pages/phase-11-mvcc/README.md).

The most consequential write in the app: turn a cart into an order — decrement
stock, snapshot prices, record the side-effects — atomically, under
concurrency, and safely replayable. Everything the spec promised about
checkout lands in this one function.

Two chapters:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The transaction](01-the-transaction.md)** | The seven steps in order, the full implementation, and why each statement is where it is |
| 2 | **[Concurrency and failure](02-concurrency-and-failure.md)** | Two buyers, one unit of stock; deadlock avoidance; the replay path; what every failure point leaves behind |

## Where this connects

Phase 3's checkout endpoint calls this with a validated payload and an
idempotency key; Phase 2's worker drains the outbox row it writes. The
[schema constraints](../01-the-schema/02-carts-orders-reviews-outbox.md) it
leans on — `check (stock >= 0)`, `unique (idempotency_key)` — were designed
for exactly this chapter.
