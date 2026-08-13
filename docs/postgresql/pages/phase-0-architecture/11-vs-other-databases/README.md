---
title: "PostgreSQL vs MySQL vs SQLite"
sidebar_label: "Overview"
sidebar_position: 0
---

# PostgreSQL vs MySQL vs SQLite

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **MySQL 8.4.11** (`mysql:8`, `127.0.0.1:55440`), **SQLite 3.53.3** via `node:sqlite`,
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex56-vs-sqlite.mjs`,
> `sandbox/pg-api/ex57-vs-mysql.sh`.

**Most of what you have read comparing these three is out of date. MySQL 8 is strict
by default, SQLite has transactional DDL, and sequence gaps happen everywhere. The
differences that survive measurement are fewer than the folklore — and they are the
ones that change your schema.**

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[The folklore that no longer holds](01-outdated-folklore.md)** | MySQL's strict mode, `CHECK` and `ONLY_FULL_GROUP_BY` — all fixed. SQLite is the permissive one. Transactional DDL, where SQLite sides with PostgreSQL and **MySQL is the outlier**. Sequence gaps on every engine |
| 02 | **[The differences that survive](02-real-differences.md)** | Default isolation level, identifier case folding, `RETURNING` vs `UPDATE … ORDER BY … LIMIT`, what a `BOOLEAN` really is, the concurrency ceiling, what each driver hands JavaScript, and how to choose |

## Phase gate

- Which of the three cannot roll back a `CREATE TABLE`, and what does that cost you?
- Is MySQL still loose about data types? Which engine actually is?
- Why does `createdAt` become `createdat` on PostgreSQL?
- What is SQLite's real concurrency limit, and what happens when you exceed it?

## Where this connects

- **[Version policy](../10-version-policy.md)** — why "PostgreSQL 18" is a moving
  target and how long each major is supported.
- **[Type parsing](../../phase-7-pg-driver/08-type-parsing.md)** — what `pg` does with
  `bigint`, `numeric` and `date` once the rows reach Node.
- **[Data types](../../phase-2-types/README.md)** — the types PostgreSQL has that the
  other two do not.
- **Node [Phase 6 · Data access](/docs/nodejs/pages/phase-6-data-access/)** owns the
  driver-and-pool side of the same choice.

---

← [Version policy](../10-version-policy.md) · Start → [The folklore that no longer holds](01-outdated-folklore.md)
