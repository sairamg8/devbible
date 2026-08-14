---
title: "09.4 · Table health"
sidebar_label: "04 · Table health"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [statistics views](https://www.postgresql.org/docs/18/monitoring-stats.html)
> (`pg_stat_user_tables`, `pg_stat_database`, `pg_stat_all_indexes`),
> [routine vacuuming](https://www.postgresql.org/docs/18/routine-vacuuming.html).
> **Not sandbox-measured** — no console output on this page. The *measured*
> index-usage and bloat results are in
> [Phase 10](../../phase-10-indexes/README.md), and the vacuum-horizon results in
> [Phase 11](../../phase-11-mvcc/README.md).

**These are the views that tell you something is wrong before anyone notices.**
Chunk 01 is for the incident and chunk 02 for the investigation; this one is for
the week before either.

## Table statistics

`pg_stat_user_tables` has one row per table, counting access and maintenance:

| Column | Question it answers |
|---|---|
| `seq_scan`, `seq_tup_read` | how often is this table scanned end to end? |
| `idx_scan`, `idx_tup_fetch` | how often is an index used instead? |
| `n_live_tup`, `n_dead_tup` | how much of the table is dead weight? |
| `n_mod_since_analyze` | how stale are the planner's statistics? |
| `last_autovacuum`, `last_autoanalyze` | is maintenance actually running? |
| `n_tup_ins`, `n_tup_upd`, `n_tup_del`, `n_tup_hot_upd` | the write mix |

### Sequential scans on large tables

```sql
SELECT relname,
       seq_scan, idx_scan,
       n_live_tup,
       seq_tup_read / nullif(seq_scan, 0) AS avg_rows_per_seq_scan
  FROM pg_stat_user_tables
 WHERE seq_scan > 0 AND n_live_tup > 100000
 ORDER BY seq_tup_read DESC
 LIMIT 20;
```

A high `seq_scan` on a large table is a *hint*, not a verdict. Sequential scans
are correct and often optimal — for small tables, and for queries that genuinely
touch most rows, a seq scan beats an index. What this query finds is candidates
worth an `EXPLAIN`, which is where the actual answer is. Phase 10 measures
several cases where the obvious expectation was wrong, including an index that
made a query **slower**, so resist concluding "add an index" from this view
alone.

### Dead tuples and whether autovacuum is keeping up

```sql
SELECT relname,
       n_live_tup, n_dead_tup,
       round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 1) AS dead_pct,
       last_autovacuum, last_autoanalyze
  FROM pg_stat_user_tables
 WHERE n_dead_tup > 1000
 ORDER BY n_dead_tup DESC
 LIMIT 20;
```

Two failure signatures to recognise:

**Rising `n_dead_tup` with a recent `last_autovacuum`** — autovacuum is running
but not keeping pace, usually because the table is written to heavily. Tune the
per-table thresholds (`autovacuum_vacuum_scale_factor` is a fraction of table
size, so it scales badly on very large tables) rather than the global ones.

**Rising `n_dead_tup` with an old or NULL `last_autovacuum`** — autovacuum is
blocked, not slow. The usual cause is a long-open transaction pinning the vacuum
horizon: dead rows cannot be removed while any snapshot might still need them.
That is the direct link back to `idle in transaction` in
[chunk 01](01-whats-happening-now.md), and Phase 11 measures exactly which open
transactions have this effect and which do not — the answer is less obvious than
it sounds.

A third possibility worth knowing because it fails *silently*: the role running a
manual `VACUUM` may lack the `MAINTAIN` privilege, in which case the command
emits a warning, skips the table, and **exits successfully**. That result is
measured in [01 · Roles and GRANT](../01-roles-grant/README.md). A nightly
maintenance job that lost its grant never fails.

### Unused indexes

```sql
SELECT s.relname AS table_name,
       s.indexrelname AS index_name,
       s.idx_scan,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS size
  FROM pg_stat_all_indexes s
  JOIN pg_index i ON i.indexrelid = s.indexrelid
 WHERE s.schemaname NOT IN ('pg_catalog', 'pg_toast')
   AND s.idx_scan = 0
   AND NOT i.indisunique          -- unique indexes enforce constraints
   AND NOT i.indisprimary
 ORDER BY pg_relation_size(s.indexrelid) DESC;
```

Every index costs write throughput and disk, so unused ones are pure loss. Four
cautions before dropping anything:

1. **Counters are cumulative since the last statistics reset.** An index unused
   since a reset three days ago tells you very little. Check
   `pg_stat_get_db_stat_reset_time()` or `stats_reset` in `pg_stat_database`.
2. **Excluding unique and primary-key indexes is deliberate** — they enforce
   constraints and are doing their job whether or not they are ever scanned.
3. **A replica has its own statistics.** An index unused on the primary may serve
   reporting queries on a standby. Check both.
4. **`idx_scan` updates lag** — statistics are reported after the statement, not
   during it, which Phase 10 documents from measurement. A brand-new index may
   read as unused simply because nothing has run yet.

Drop candidates with `DROP INDEX CONCURRENTLY`, and consider marking an index
invisible first where you want a reversible test.


---

← [Reading pg_stat_statements](03-reading-pg-stat-statements.md) · Next → [Database health and alerting](05-database-health.md)

## Trade-off

`pg_stat_user_tables` is cheap to read and **approximate by design**.
`n_live_tup` and `n_dead_tup` are estimates, not counts, and statistics are
reported after statements complete rather than continuously. That approximation
is the right trade — exact counters would require synchronisation on every row
operation — but it means these numbers are for **trends and triage**, not for
accounting.

The second trade is interpretive: almost everything here is a *hint* rather than
a verdict. A high `seq_scan` may be correct, an `idx_scan` of zero may mean the
statistics were reset. Acting on these numbers without confirming with `EXPLAIN`
or `stats_reset` is how a healthy index gets dropped.

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
transaction in [chunk 01](01-whats-happening-now.md)).

**Symptom:** `VACUUM` reports success and nothing is cleaned
**Cause:** Missing `MAINTAIN` privilege — it warns, skips, and exits zero.
Measured in [01 · Roles and GRANT](../01-roles-grant/README.md).
**Fix:** Grant `MAINTAIN`, and check warnings rather than only the exit code.

**Symptom:** A high `seq_scan` count led to an index that made things worse
**Cause:** Sequential scans are often optimal — for small tables and for queries
touching most rows.
**Fix:** Treat `seq_scan` as a candidate list for `EXPLAIN`, not as a verdict.

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

**Why are `n_live_tup` and `n_dead_tup` described as estimates?**
The statistics subsystem maintains approximate counters rather than
synchronising an exact count on every row operation. They are built for trends
and triage; when an exact number matters, count the rows.

**Is a high `seq_scan` count a problem?**
Not by itself. Sequential scans are correct and often optimal for small tables
and for queries that genuinely touch most rows. It identifies candidates worth an
`EXPLAIN` — and this corpus measured cases where adding an index made a query
*slower*.

---

← [Reading pg_stat_statements](03-reading-pg-stat-statements.md) · Next → [Database health and alerting](05-database-health.md)
