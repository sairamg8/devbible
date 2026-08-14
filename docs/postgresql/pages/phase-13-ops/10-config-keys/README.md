---
title: "Key configuration"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation**
> ([resource consumption](https://www.postgresql.org/docs/18/runtime-config-resource.html),
> [query planning](https://www.postgresql.org/docs/18/runtime-config-query.html),
> [WAL](https://www.postgresql.org/docs/18/runtime-config-wal.html),
> [setting parameters](https://www.postgresql.org/docs/18/config-setting.html)),
> cited inline. The `pg_settings.context` values are **sandbox-measured**
> (`sandbox/pg-api/ex53-hba-tls.sh`). ⚠️ Phase 0's `shared_buffers` benchmark was
> found to be **confounded** and is deliberately not reused; no timing claim in
> this topic is presented as measured.

**You need this topic to reason about what your managed provider already set for
you** — not to hand-tune a server you do not run. Two chunks, split by what the
settings actually do.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Memory](01-memory.md)** | `shared_buffers`, `work_mem` (per *operation*), `maintenance_work_mem`, and the one that allocates nothing |
| 02 | **[Planner and WAL](02-planner-wal-and-changing.md)** | `random_page_cost` on SSD, checkpoints and timeouts |
| 03 | **[Changing a setting](03-changing-a-setting.md)** | `pg_settings.context`, `ALTER SYSTEM` precedence, and where to actually start |

## The four facts worth leaving with

1. **`work_mem` is per sort/hash operation** — worst case is
   `work_mem × operations × concurrency`. This is how servers get OOM-killed.
2. **`effective_cache_size` allocates nothing.** It only changes plan costs, and
   leaving it at 4 GB on a large server biases the planner to sequential scans.
3. **`random_page_cost = 4.0` models a spinning disk.** On SSD, 1.1 is the usual
   value, and it is the highest-value one-line change here.
4. **`pg_settings.context` tells you restart vs reload** — check it before
   planning a change, and read `pending_restart` after.

## Phase gate

You are done here when you can explain why raising `work_mem` is dangerous and
raising `maintenance_work_mem` mostly is not, and you can tell — without
guessing — whether a given setting needs a restart, a reload, or neither.

## Where this connects

- [Connection limits and PgBouncer](../07-pgbouncer/README.md) — connection count
  and `work_mem` are the same conversation; fewer backends buys more memory per
  query.
- [Monitoring views](../09-monitoring/README.md) — `temp_bytes` is the evidence
  you gather *before* changing `work_mem`.
- [Zero-downtime DDL](../12-zero-downtime-ddl/README.md) — `lock_timeout` is a
  configuration setting and a migration-safety requirement.
- [Indexes and the planner](../../phase-10-indexes/README.md) — where cost
  constants stop being theory and get settled with `EXPLAIN (ANALYZE, BUFFERS)`.
- [Managed PostgreSQL](../13-managed-postgres/README.md) — which of these you are even
  allowed to change.

---

← [Phase index](../README.md) · Start → [Memory settings](01-memory.md)
