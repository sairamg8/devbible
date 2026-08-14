---
title: "Connection limits and PgBouncer"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13. **Mixed provenance, marked per chunk.** Backend counts and
> the exhaustion timing are **sandbox-measured** on **PgBouncer 1.25.2** in front
> of **PostgreSQL 18.4** (`sandbox/pg-api/ex54-pgbouncer.mjs`, sections 1–3);
> everything else is validated against the
> [PgBouncer](https://www.pgbouncer.org/config.html) and
> [PostgreSQL 18](https://www.postgresql.org/docs/18/runtime-config-connection.html)
> documentation, cited inline.

**A PostgreSQL connection is an operating-system process, so connections are
scarce in a way threads are not.** Everything in this topic follows from that:
why `pg.Pool` alone cannot save you, why transaction pooling is both the answer
and a source of intermittent bugs, and why one forgotten `COMMIT` takes down
endpoints that have nothing to do with it.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Why connections cost](01-why-connections-cost.md)** | process-per-connection, `max_connections`, and the replicas × pool-max arithmetic |
| 02 | **[Pool modes](02-pool-modes.md)** | session vs transaction vs statement, what transaction mode breaks, and the prepared-statement advice that is now out of date |
| 03 | **[Exhaustion and sizing](03-exhaustion-and-sizing.md)** | the 120-second default that turns saturation into a hang, and why a smaller pool is faster |
| 04 | **[Node, observing, alternatives](04-node-and-observing.md)** | the `pg` settings that matter, `SHOW POOLS`, and the managed poolers you meet instead |

## The three measured results

| Result | Where |
|---|---|
| 40 clients, non-overlapping work → **1** server backend | [02](02-pool-modes.md) |
| 40 clients, all concurrent → **exactly 5** (`default_pool_size`), 0 failures | [02](02-pool-modes.md) |
| 5 open transactions, pool 5 → two clients waited **120 204 ms**, then `08P01` | [03](03-exhaustion-and-sizing.md) |

## Phase gate

You are done here when you can state your application's real connection count
(replicas × pool max, plus workers and admin sessions), you know which pool mode
you are running and have audited for the session features it breaks, and pool
exhaustion in your system produces a fast error rather than a two-minute stall.

## Where this connects

- [Key configuration](../10-config-keys/README.md) — `max_connections`, `work_mem` and
  why connection count and memory are the same conversation.
- [Monitoring views](../09-monitoring/README.md) — `pg_stat_activity` filtered to
  `idle in transaction` is how you find the cause of an exhausted pool.
- [Managed PostgreSQL](../13-managed-postgres/README.md) — every managed provider fronts
  you with a pooler, and using the direct endpoint by mistake is the most common
  connection incident on those platforms.
- [Row-level security](../14-rls/README.md) and
  [multi-tenancy](../../phase-3-ddl/20-multi-tenancy/README.md) — both depend on
  `SET LOCAL` rather than `SET`, for exactly the pooling reason in chunk 02.
- [The pg driver](../../phase-7-pg-driver/README.md) owns `pg.Pool` configuration
  and connection-string parsing in detail.
- [Transactions and MVCC](../../phase-11-mvcc/README.md) — why transaction
  duration, not query count, is what a pool is really rationing.

---

← [Phase index](../README.md) · Start → [Why connections cost](01-why-connections-cost.md)
