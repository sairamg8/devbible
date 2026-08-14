---
title: "Zero-downtime schema changes"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation**
> ([`ALTER TABLE`](https://www.postgresql.org/docs/18/sql-altertable.html),
> [`CREATE INDEX`](https://www.postgresql.org/docs/18/sql-createindex.html),
> [`DROP INDEX`](https://www.postgresql.org/docs/18/sql-dropindex.html),
> [explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)),
> cited inline. **Not sandbox-measured** — the measured `ALTER TABLE` timings on
> a 200 000-row table live in [Phase 3](../../phase-3-ddl/05-alter-table.md)
> (`sandbox/pg-api/ex11-ddl-alter.mjs`), which owns the statement-level view.
> This topic owns the **deployment** view.

**The migration that takes your site down is fast. It spends its time waiting.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The lock queue](01-the-lock-queue.md)** | why a 5 ms `ALTER` causes a 30-second outage, `lock_timeout` + retry, and which operations are actually cheap |
| 02 | **[Expand and contract](02-expand-and-contract.md)** | the three-phase migration, `NOT VALID` → `VALIDATE`, batched backfills, `CONCURRENTLY`, and the checklist |

## The two ideas this topic is built on

**1. A waiting `ACCESS EXCLUSIVE` lock blocks everything behind it.** New queries
do not jump the queue, so a DDL statement blocked by one slow reader makes the
table unavailable to everyone — before the DDL has run at all. Hence
`lock_timeout` is not optional.

**2. A schema change and a code deploy are never simultaneous.** During a rolling
deploy both old and new code run against one schema, so every intermediate state
must be valid for both. Hence nothing is ever removed in the same step that adds
its replacement.

## The exceptions that make safe migrations possible

| Operation | Lock | Why it matters |
|---|---|---|
| `ADD CONSTRAINT … NOT VALID` | `ACCESS EXCLUSIVE`, but **no scan** | add the constraint instantly |
| `VALIDATE CONSTRAINT` | **`SHARE UPDATE EXCLUSIVE`** | scan without blocking reads or writes |
| `ADD FOREIGN KEY` | **`SHARE ROW EXCLUSIVE`** | documented exception — does not block reads |
| `CREATE/DROP INDEX CONCURRENTLY` | no blocking lock | at the cost of no transaction block, and invalid indexes on failure |
| `ADD COLUMN`, non-volatile default | catalog only | fast since PG 11 — the folklore is out of date |

## Phase gate

You are done here when you never run DDL without `lock_timeout`, you can add a
`NOT NULL` column and a foreign key to a large busy table without blocking it,
and your migration checklist includes looking for **invalid indexes** afterwards.

## Where this connects

- [Phase 3 · ALTER TABLE](../../phase-3-ddl/05-alter-table.md) and
  [Adding NOT NULL safely](../../phase-3-ddl/09-add-not-null.md) — the measured
  statement-level view; this topic does not duplicate it.
- [Phase 3 · Transactional DDL](../../phase-3-ddl/07-transactional-ddl.md) — why
  wrapping a migration in one transaction is sometimes wrong.
- [Monitoring views](../09-monitoring/01-whats-happening-now.md) —
  `pg_blocking_pids()` is how you find the root blocker mid-incident.
- [Key configuration](../10-config-keys/02-planner-wal-and-changing.md) —
  `lock_timeout` and `idle_in_transaction_session_timeout`.
- [Transactions and MVCC](../../phase-11-mvcc/README.md) — the lock modes and
  what conflicts with what.
- [Indexes](../../phase-10-indexes/README.md) — what to build, once you know how
  to build it safely.

---

← [Phase index](../README.md) · Start → [The lock queue](01-the-lock-queue.md)
