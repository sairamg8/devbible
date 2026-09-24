---
name: devbible-postgresql-phase14-scenarios
description: The approved but deferred Phase 14 syllabus — 18 real-world PG + Node scenarios, one working sandbox app each
metadata:
  type: project
---

# PostgreSQL Phase 14 — real-world scenarios

**Approved 2026-08-13 (session 10). DEFERRED the same day** until after React —
see [[devbible-postgresql-rewrite-handoff]] for the sequencing decision. It is
~3 sessions of sandbox apps on a technology already at 89% while the frontend
has zero pages.

The user asked for "a dedicated section for real world scenarios with raw PG and
Node.js for better learning with ease".

## Approved shape

**18 scenarios, each with a full working sandbox app** — a runnable Node + `pg`
script that builds the schema, seeds it, demonstrates the failure case and the
fix, and produces real console output. Scenarios **compose** earlier phases and
link back rather than re-teaching.

| # | Scenario | Composes |
|---|---|---|
| 01 | Product catalogue endpoint — filter, sort, page, index | 4, 9, 10 |
| 02 | Checkout that cannot oversell stock | 11, 9 |
| 03 | Idempotent payment webhook receiver | 9, 11 |
| 04 | Job queue on `SKIP LOCKED` with retries and a dead-letter table | 11 |
| 05 | Multi-tenant isolation with RLS | 13 |
| 06 | Audit trail / change history via triggers | 3, 9, 12 |
| 07 | Soft delete plus a real GDPR hard delete | 4, 9 |
| 08 | Full-text search over products | 12 |
| 09 | Activity feed — keyset plus denormalised counters | 9, 10 |
| 10 | CSV bulk import with per-row validation and error reporting | 8, 4 |
| 11 | Reporting endpoint — window functions and materialised views | 6, 12 |
| 12 | Transactional outbox for reliable event publishing | 11, 7 |
| 13 | Rate limiting and counters in PG | 11 |
| 14 | Zero-downtime migration (expand–contract) | 3, 8 |
| 15 | Read replicas and replication lag | 13 |
| 16 | Cache invalidation with `LISTEN`/`NOTIFY` | 7, 12 |
| 17 | Debugging a slow endpoint: `pg_stat_statements` → `EXPLAIN` → index | 10 |
| 18 | Connection pooling under real load, and PgBouncer | 7, 13 |

## When it is revisited

Several scenarios (01 catalogue, 02 checkout, 09 feed) get materially better once
a React frontend exists to pair them with — that was part of the reason to defer
rather than drop. Scenarios 15 and 18 need infrastructure beyond the single
container (replicas, PgBouncer).

Related: [[devbible-postgresql-rewrite-handoff]] · [[devbible-brief]] ·
[[devbible-postgresql-syllabus]]
