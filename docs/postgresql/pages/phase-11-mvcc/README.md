---
title: "Phase 11 — Transactions, MVCC and concurrency"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: PostgreSQL 18.4 · Node 24 · `pg`.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[ACID in PostgreSQL](01-acid.md)** | <span className="db-tier t-master">Master</span> | concrete not textbook |
| 02 | **[BEGIN COMMIT ROLLBACK](02-begin-commit.md)** | <span className="db-tier t-master">Master</span> | autocommit from pg |
| 03 | **[READ COMMITTED](03-read-committed.md)** | <span className="db-tier t-master">Master</span> | default anomalies |
| 04 | **[Lost update](04-lost-update.md)** | <span className="db-tier t-master">Master</span> | read-modify-write |
| 05 | **[MVCC snapshots](05-mvcc.md)** | <span className="db-tier t-understand">Understand</span> | readers vs writers |
| 06 | **[REPEATABLE READ SERIALIZABLE](06-isolation-levels.md)** | <span className="db-tier t-understand">Understand</span> | retry 40001 |
| 07 | **[Row locks FOR UPDATE](07-row-locks.md)** | <span className="db-tier t-understand">Understand</span> | lock modes |
| 08 | **[SKIP LOCKED](08-skip-locked.md)** | <span className="db-tier t-understand">Understand</span> | job queue |
| 09 | **[Savepoints](09-savepoints.md)** | <span className="db-tier t-understand">Understand</span> | partial rollback |
| 10 | **[Table locks and DDL](10-table-locks-ddl.md)** | <span className="db-tier t-understand">Understand</span> | DDL blocks |
| 11 | **[Deadlocks](11-deadlocks.md)** | <span className="db-tier t-understand">Understand</span> | ordering rule |
| 12 | **[Long-running transactions](12-long-transactions.md)** | <span className="db-tier t-understand">Understand</span> | bloat |
| 13 | **[VACUUM and bloat](13-vacuum.md)** | <span className="db-tier t-understand">Understand</span> | dead tuples |
| 14 | **[Idle in transaction](14-idle-in-transaction.md)** | <span className="db-tier t-understand">Understand</span> | leaked BEGIN |
| 15 | **[Advisory locks](15-advisory-locks.md)** | <span className="db-tier t-know">Know</span> | app mutex |
| 16 | **[XID wraparound](16-xid-wraparound.md)** | <span className="db-tier t-know">Know</span> | never reach it |

## Phase gate

Move on when you can prevent lost updates and never leave idle-in-transaction connections.

---

← Syllabus: [Part 4](../../syllabus/04-performance-and-production.md) · Start → [ACID in PostgreSQL](01-acid.md)
