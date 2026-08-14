---
title: "Streaming replication replicas"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation**
> ([hot standby](https://www.postgresql.org/docs/18/hot-standby.html),
> [`pg_stat_replication`](https://www.postgresql.org/docs/18/monitoring-stats.html),
> [replication settings](https://www.postgresql.org/docs/18/runtime-config-replication.html)),
> cited inline on each chunk. **Not sandbox-measured** — this topic carries no
> console output, deliberately: building a replication pair to produce numbers a
> reader cannot reproduce was out of scope.

**This topic is the consumer half of replication only.** You will almost
certainly never configure streaming replication — a managed provider does it for
you. You will very likely be broken by it, in two specific ways, and those are
what this covers.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Lag and read-your-writes](01-lag-and-read-your-writes.md)** | why a user sees their own save fail, the four WAL stages, and what `synchronous_commit` actually guarantees |
| 02 | **[Conflicts and routing](02-conflicts-and-routing.md)** | why a read-only query gets killed by a `VACUUM`, and how to decide which reads may go to a replica |

## The two failures worth remembering

| Failure | Looks like | Root cause |
|---|---|---|
| **Stale read** | "the save button didn't work" — no error at all | the write is committed on the primary but not yet **replayed** on the replica |
| **Cancelled query** | `40001 canceling statement due to conflict with recovery` | replay needed to remove rows the query still required |

Both are load-dependent and effectively invisible in development, which is why
they arrive as production bug reports rather than as test failures.

## Phase gate

You are done here when you can say which of your application's reads are allowed
to be stale and which are not — in particular, that **no read feeding a write
decision goes to a replica** — and you can measure lag from both the primary and
the standby without being fooled by an idle system.

## Where this connects

- [Connection limits and PgBouncer](../07-pgbouncer/README.md) — `SET LOCAL` vs
  `SET` applies to `synchronous_commit` exactly as it does to everything else on
  a pooled connection.
- [Monitoring views](../09-monitoring/README.md) — where `pg_stat_replication` sits
  among the other stats views, and what to alert on.
- [Transactions and MVCC](../../phase-11-mvcc/README.md) — `hot_standby_feedback`
  extends the primary's vacuum horizon; that is the same mechanism, reached from
  a different direction.
- [Logical replication](../16-logical-replication.md) — the other kind, for when
  you need *part* of a database rather than a byte-identical copy.
- [Managed PostgreSQL](../13-managed-postgres/README.md) — who actually runs all of this
  for you, and what you still own.

---

← [Phase index](../README.md) · Start → [Lag and read-your-writes](01-lag-and-read-your-writes.md)
