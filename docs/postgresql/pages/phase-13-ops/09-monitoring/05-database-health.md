---
title: "09.5 · Database health and alerting"
sidebar_label: "05 · Database health & alerting"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [statistics views](https://www.postgresql.org/docs/18/monitoring-stats.html).
> **Not sandbox-measured** — no console output on this page.

**Table-level statistics tell you which object is unhealthy; database-level ones
tell you whether the system is.** This chunk is the second, plus the only list in
this topic that matters at 3am: what to actually alert on.

## Database-wide statistics

`pg_stat_database` has one row per database:

```sql
SELECT datname,
       xact_commit, xact_rollback,
       round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2) AS cache_hit_pct,
       deadlocks,
       temp_files, pg_size_pretty(temp_bytes) AS temp_written,
       stats_reset
  FROM pg_stat_database
 WHERE datname = current_database();
```

**Cache hit ratio.** `blks_hit / (blks_hit + blks_read)` is the classic health
number, and the conventional target is above 99% for an OLTP workload. Treat it
as a rough signal rather than a measurement, for a documented reason: `blks_read`
counts blocks not found in PostgreSQL's **shared buffers**, many of which are
then served from the *operating system's* page cache at memory speed. So a
"miss" is not necessarily a disk read, and the ratio understates real cache
effectiveness. A sharp *drop* is more informative than the absolute value.

**`temp_files` and `temp_bytes`** count spills to disk — queries whose sorts or
hashes exceeded `work_mem`. A steadily rising `temp_bytes` is one of the clearest
signals that `work_mem` is too low for your workload, or that a specific query is
sorting far more than it should. This is the number to look at before changing
`work_mem`, and it connects directly to
[10 · Key configuration](../10-config-keys/README.md).

**`deadlocks`** should be near zero. Any sustained rate means two code paths take
locks in different orders — an application bug that PostgreSQL is detecting and
resolving for you, at the cost of an aborted transaction each time.

**`xact_rollback` relative to `xact_commit`** is a decent proxy for application
error rate. A rollback ratio that climbs after a deploy is worth investigating
even if nothing else looks wrong.

**`stats_reset`** is the timestamp every other number is relative to. Read it
first; it is what makes the rest interpretable.

## Table and index size

```sql
SELECT relname,
       pg_size_pretty(pg_total_relation_size(relid))                       AS total,
       pg_size_pretty(pg_relation_size(relid))                             AS heap,
       pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS indexes_toast
  FROM pg_stat_user_tables
 ORDER BY pg_total_relation_size(relid) DESC
 LIMIT 20;
```

`pg_total_relation_size` includes indexes and TOAST; `pg_relation_size` is the
heap alone. The difference is worth watching: indexes larger than the table they
serve is common, sometimes justified, and always worth a look. Growth rate
matters more than absolute size — a table doubling weekly is a capacity
conversation you want to have early.

## What to actually alert on

Most monitoring setups fail by alerting on everything and being ignored. A
defensible minimum:

| Alert | Threshold | Why |
|---|---|---|
| Connections near `max_connections` | > 80% | the next step is refused connections |
| Oldest transaction age | > 5 min | locks and vacuum horizon |
| `idle in transaction` count | > a handful, sustained | pool exhaustion incoming |
| Replication lag | workload-dependent | stale reads, slow failover |
| Dead tuple percentage on big tables | > 20% | autovacuum falling behind |
| Deadlock rate | any sustained rate | application lock-ordering bug |
| `temp_bytes` rate | rising trend | `work_mem` too low |
| Disk space | > 80% | the outage with no graceful degradation |

Two of these deserve their place for reasons that are not obvious. **Disk space**
belongs at the top of any real list: PostgreSQL handles a full disk badly, and
WAL accumulation from a stuck replication slot can fill one surprisingly fast —
which is a
[16 · Logical replication](../16-logical-replication.md) failure mode as much as
a monitoring one. And **oldest transaction age** is a leading indicator for a
remarkable number of unrelated-looking problems: bloat, lock waits, pool
exhaustion and replication conflicts all trace back to it.

## Trade-off

These views are cumulative counters maintained by the statistics subsystem —
cheap to read, and *approximate by design*. `n_live_tup` and `n_dead_tup` are
estimates, not counts; statistics are reported after statements complete rather
than continuously; and everything resets when you reset it or when the cluster is
re-initialised.

That approximation is the right trade — exact counters would require
synchronisation on every row operation — but it means these numbers are for
**trends and triage**, not for accounting. When you need an exact answer, count
the rows. When you need to know whether something is getting worse, these are
what you have, and they are enough.

The second trade is human: everything here can be alerted on, and almost none of
it should be. An alert nobody acts on trains people to ignore the ones that
matter.

## Gotchas

**Symptom:** An index shows `idx_scan = 0`, but dropping it broke things
**Cause:** Statistics were reset recently, the index serves a replica, or it
enforces a constraint.
**Fix:** Check `stats_reset`, check the replica's own statistics, and exclude
unique/primary indexes before considering a drop.

**Symptom:** `n_dead_tup` keeps rising although autovacuum runs
**Cause:** Either autovacuum cannot keep pace with the write rate, or a
long-running transaction is pinning the vacuum horizon so nothing is removable.
**Fix:** Distinguish them with `last_autovacuum` — recent means "not keeping
pace" (tune per-table thresholds), old or NULL means "blocked" (find the old
transaction in chunk 01).

**Symptom:** `VACUUM` reports success and nothing is cleaned
**Cause:** Missing `MAINTAIN` privilege — it warns, skips, and exits zero.
Measured in [01 · Roles and GRANT](../01-roles-grant/README.md).
**Fix:** Grant `MAINTAIN`, and check for warnings in maintenance job output
rather than only the exit code.

**Symptom:** Cache hit ratio is 97% and someone wants to buy more RAM
**Cause:** `blks_read` counts shared-buffer misses, many of which are served from
the OS page cache — the ratio understates real cache effectiveness.
**Fix:** Treat it as a trend signal. A sudden drop is meaningful; the absolute
number is not a purchasing decision.

**Symptom:** Statistics look wrong or suspiciously small
**Cause:** They are cumulative since `stats_reset`, and something reset them.
**Fix:** Read `stats_reset` before interpreting anything else.

**Symptom:** Rising `temp_files` with no obvious slow query
**Cause:** Sorts and hashes spilling past `work_mem`.
**Fix:** Identify the statement via `pg_stat_statements`, then either raise
`work_mem` for that workload or fix the query — see
[10 · Key configuration](../10-config-keys/README.md).

## Interview questions

**★ How do you tell whether autovacuum is keeping up?**
`pg_stat_user_tables`: rising `n_dead_tup` together with `last_autovacuum`. A
recent autovacuum with growing dead tuples means it cannot keep pace with writes;
an old or NULL `last_autovacuum` means it is blocked — usually by a long-open
transaction pinning the vacuum horizon, so the fix is in the application, not in
autovacuum settings.

**★ How do you find unused indexes, and what would stop you dropping one?**
`pg_stat_all_indexes` where `idx_scan = 0`, excluding unique and primary-key
indexes. Before dropping: check `stats_reset` (counters are cumulative, so a
recent reset makes everything look unused), check replicas which keep their own
statistics, and remember `idx_scan` updates lag. Then `DROP INDEX CONCURRENTLY`.

**★ Is a 97% cache hit ratio a problem?**
Not necessarily. `blks_read` counts misses from PostgreSQL's shared buffers, and
many of those are served by the OS page cache without touching a disk, so the
ratio understates effectiveness. A sudden drop is a real signal; the absolute
value is a weak one.

**★ What would you alert on for a production PostgreSQL?**
Disk space, connections against `max_connections`, oldest transaction age,
sustained `idle in transaction`, replication lag, dead-tuple percentage on large
tables, and deadlock rate. Oldest transaction age earns its place because bloat,
lock waits, pool exhaustion and replication conflicts all trace back to it.

**What does rising `temp_bytes` tell you?**
That queries are spilling sorts or hashes to disk because they exceeded
`work_mem`. It is the evidence to gather *before* changing `work_mem`, and it
often points at one specific query sorting far more than it needs to.

**Why are `n_live_tup` and `n_dead_tup` described as estimates?**
The statistics subsystem maintains approximate counters rather than
synchronising an exact count on every row operation. They are built for trends
and triage; when an exact number matters, count the rows.

---


---

← [Table health](04-table-health.md) · Next → [Key configuration](../10-config-keys/README.md)
