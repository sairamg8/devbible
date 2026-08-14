---
title: "Monitoring views"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation**
> ([statistics views](https://www.postgresql.org/docs/18/monitoring-stats.html),
> [`pg_stat_statements`](https://www.postgresql.org/docs/18/pgstatstatements.html)),
> cited inline on each chunk. **Not sandbox-measured** — no console output in
> this topic. The measured index, vacuum and lock results it points at live in
> [Phase 10](../../phase-10-indexes/README.md) and
> [Phase 11](../../phase-11-mvcc/README.md).

**Three different questions, three different views, and using the wrong one is
how an outage gets spent reading averages.**

| Question | View | Chunk |
|---|---|---|
| What is happening *right now*? | `pg_stat_activity`, `pg_locks` | [01](01-whats-happening-now.md) |
| What costs the most *in aggregate*? | `pg_stat_statements` | [02](02-pg-stat-statements.md), [03](03-reading-pg-stat-statements.md) |
| What is *quietly getting worse*? | `pg_stat_user_tables`, `pg_stat_database` | [04](04-table-health.md), [05](05-database-health.md) |

| # | Chunk | In one line |
|---|---|---|
| 01 | **[What is happening now](01-whats-happening-now.md)** | the one incident query, `idle in transaction`, wait events, and who is blocking whom |
| 02 | **[pg_stat_statements](02-pg-stat-statements.md)** | why `total_exec_time` beats `mean_exec_time`, normalisation, and the restart it costs |
| 03 | **[Reading it](03-reading-pg-stat-statements.md)** | the queries worth keeping, and why one snapshot misleads |
| 04 | **[Table health](04-table-health.md)** | dead tuples, unused indexes, and whether autovacuum is keeping up |
| 05 | **[Database health and alerting](05-database-health.md)** | cache hit ratio, temp files, deadlocks, and what is actually worth alerting on |

## The single most useful idea in this topic

**Oldest transaction age is a leading indicator for problems that look
unrelated.** Table bloat, lock waits, connection-pool exhaustion and replication
conflicts all trace back to a transaction that has been open too long. If you
monitor one thing beyond disk space, monitor that.

## Phase gate

You are done here when you can, without looking anything up, find the oldest
transaction and what it is blocking; name the most expensive query on your
system by total time rather than by mean; and say whether autovacuum is keeping
up on your largest table.

## Where this connects

- [Logging slow queries](../11-logging/README.md) — the third leg: individual slow
  statements, which neither the live view nor the aggregate view will show you.
- [Key configuration](../10-config-keys/README.md) — `temp_bytes` and connection counts
  are the evidence you gather before touching `work_mem` or `max_connections`.
- [Connection limits and PgBouncer](../07-pgbouncer/README.md) — `idle in
  transaction` is what exhausts a pool, measured there.
- [Streaming replication replicas](../08-replication/README.md) —
  `pg_stat_replication` and the lag columns.
- [Indexes and the planner](../../phase-10-indexes/README.md) — where a
  suspicious `seq_scan` count gets settled by `EXPLAIN (ANALYZE, BUFFERS)`.
- [Transactions and MVCC](../../phase-11-mvcc/README.md) — why a long transaction
  stops vacuum, measured.

---

← [Phase index](../README.md) · Start → [What is happening now](01-whats-happening-now.md)
