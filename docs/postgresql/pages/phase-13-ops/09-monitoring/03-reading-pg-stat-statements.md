---
title: "09.3 · Reading pg_stat_statements"
sidebar_label: "03 · Reading it"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [`pg_stat_statements`](https://www.postgresql.org/docs/18/pgstatstatements.html).
> **Not sandbox-measured** — no console output on this page.

**The view is enabled; now the question is which queries to run against it, and
how not to be misled by cumulative counters.**

## The queries worth keeping

**Top consumers by total time** — the one to start with:

```sql
SELECT calls,
       round(total_exec_time)              AS total_ms,
       round(mean_exec_time::numeric, 2)   AS mean_ms,
       rows,
       left(query, 90)                     AS query
  FROM pg_stat_statements
 ORDER BY total_exec_time DESC
 LIMIT 20;
```

**Cache behaviour per statement** — which queries are actually going to disk:

```sql
SELECT round(total_exec_time)                                   AS total_ms,
       shared_blks_hit, shared_blks_read,
       round(100.0 * shared_blks_hit
             / nullif(shared_blks_hit + shared_blks_read, 0), 1) AS hit_pct,
       left(query, 70)                                           AS query
  FROM pg_stat_statements
 ORDER BY shared_blks_read DESC
 LIMIT 20;
```

A statement with high `shared_blks_read` is reading from disk and is usually
either missing an index or scanning far more than it needs — the natural handoff
to [Phase 10](../../phase-10-indexes/README.md) and `EXPLAIN (ANALYZE, BUFFERS)`.

**Inconsistent queries** — where `stddev_exec_time` is large relative to
`mean_exec_time`, meaning the same query shape is sometimes fast and sometimes
not. That pattern points at parameter-dependent plans, lock waits, or data skew,
and it is invisible in an average:

```sql
SELECT calls,
       round(mean_exec_time::numeric, 2)   AS mean_ms,
       round(stddev_exec_time::numeric, 2) AS stddev_ms,
       round(max_exec_time::numeric, 2)    AS max_ms,
       left(query, 70)                     AS query
  FROM pg_stat_statements
 WHERE calls > 100
 ORDER BY stddev_exec_time DESC
 LIMIT 20;
```

**`rows / calls`** is a quick sanity check that gets overlooked: a statement
returning thousands of rows per call to an API endpoint is usually a missing
`LIMIT` or an N+1 pattern in disguise.

## Reading it correctly: it is cumulative

Every counter accumulates since the last reset. That has two practical
consequences.

**A single snapshot is nearly meaningless.** Sorted by `total_exec_time`, a
snapshot shows you what has been expensive since the statistics were last
cleared — which might be six months and two deployments ago. What you actually
want is the **delta** between two snapshots:

```sql
-- take a snapshot, wait, take another, and diff them
CREATE TABLE IF NOT EXISTS pgss_snapshot AS
  SELECT now() AS taken_at, queryid, query, calls, total_exec_time
    FROM pg_stat_statements;
```

Any monitoring product that integrates `pg_stat_statements` is doing exactly
this: sampling periodically and reporting rates. Doing it by hand for fifteen
minutes during an investigation is a reasonable substitute.

**Reset deliberately, and know what you are destroying.**
`pg_stat_statements_reset()` with no arguments discards everything and returns
the reset timestamp. It is the right move before a load test or when measuring
the effect of a change; it is the wrong move casually, because the history is not
recoverable. The function also takes `userid`, `dbid` and `queryid` to reset one
entry, and a `minmax_only` flag to clear just the min/max columns — useful when
one old outlier is distorting your view of `max_exec_time`.

Only superusers can execute it by default, though access can be granted.

## Permissions

Non-superusers see their own statements' text; the query text of other users'
statements is hidden unless the role is a member of `pg_read_all_stats`. The
counters are visible either way. Granting `pg_read_all_stats` to a monitoring
role is the normal arrangement — it is exactly the read-only observability
privilege, without the rest of superuser.

## Trade-off

`pg_stat_statements` costs a fixed slice of shared memory (proportional to
`.max`), a small amount of per-execution bookkeeping, and one **restart** to
enable. In exchange it is the only source of truth about aggregate query cost —
the thing that actually determines whether your database keeps up.

The overhead is small enough that the trade is not really in doubt; the practical
objection is the restart, which is why the right time to enable it is *before*
you need it, not during the incident where you first wish you had. Enable it on
every environment, including development, so query cost is visible while code is
being written rather than after it ships.

Its blind spot is real, though: it aggregates. It cannot tell you that *this*
request at *that* moment was slow, and it cannot show you a query that ran once
and hurt. Pair it with slow-query logging for the individual cases and
`pg_stat_activity` for the live ones.

## Gotchas

**Symptom:** `relation "pg_stat_statements" does not exist` after configuring it
**Cause:** `shared_preload_libraries` loads the module; `CREATE EXTENSION`
creates the view. Both are needed, per database.
**Fix:** Run `CREATE EXTENSION pg_stat_statements;` in the database you are
querying.

**Symptom:** Changing `shared_preload_libraries` had no effect
**Cause:** It requires a **restart**, not a reload.
**Fix:** Restart. Schedule it — this is the one genuine cost of adoption.

**Symptom:** The view is full of thousands of near-identical entries
**Cause:** Queries built by string interpolation instead of `$1` parameters, so
each value is a distinct query shape.
**Fix:** Parameterise. Otherwise `pg_stat_statements.max` (default 5000) is
exhausted and useful entries are evicted.

**Symptom:** Optimising the slowest query changed nothing
**Cause:** Sorted by `mean_exec_time` instead of `total_exec_time`. The expensive
query is usually a fast one executed constantly.
**Fix:** Sort by `total_exec_time`, or by `calls × mean`.

**Symptom:** The numbers look wrong after an upgrade
**Cause:** `queryid` is not guaranteed stable across major versions, and
statistics may have been reset.
**Fix:** Expect dashboards keyed on `queryid` to break at a major upgrade; key
them on the normalised text where you need continuity.

**Symptom:** Planning time is always zero
**Cause:** `pg_stat_statements.track_planning` defaults to **off**.
**Fix:** Turn it on if you suspect planning cost — it is not free to track, which
is why it is off.

**Symptom:** Statements inside functions are missing
**Cause:** `pg_stat_statements.track` defaults to `top` — top-level statements
only.
**Fix:** Set it to `all` if real work happens in PL/pgSQL.

## Interview questions

**★ How do you find the query that is hurting your database?**
`pg_stat_statements`, ordered by `total_exec_time` — not by mean. The most
expensive query is typically a fast one called constantly: a 4 ms query run
500 000 times costs far more than a single 8-second report, and slow-query
logging will never surface it because it is under every threshold.

**★ What does `pg_stat_statements` require to enable?**
Adding it to `shared_preload_libraries`, which needs a **server restart**, plus
`CREATE EXTENSION pg_stat_statements` in each database you want to query. The
restart is the reason to enable it before you need it.

**★ What is query normalisation and what breaks it?**
Literal constants are replaced with `$1`, `$2`… so all executions of one query
shape aggregate into a single entry. Queries built by string concatenation defeat
it — every distinct value becomes its own entry, filling
`pg_stat_statements.max` (default 5000) and evicting useful rows. Parameterised
queries are what make the view usable.

**★ Why is one snapshot of `pg_stat_statements` misleading?**
The counters are cumulative since the last reset, so a snapshot reflects an
arbitrary and possibly very long window. Compare two snapshots and use the delta,
which is exactly what monitoring tools do.

**How would you spot a query with an unstable plan?**
High `stddev_exec_time` relative to `mean_exec_time`, and a `max_exec_time` far
above the mean, on a statement with many calls. That signals the same shape
sometimes running very differently — parameter-dependent plans, data skew or lock
waits — and an average alone hides it completely.

**What is the difference between what `pg_stat_statements` and the slow-query log
tell you?**
`pg_stat_statements` aggregates: it answers "what costs the most in total" and
cannot point at an individual bad moment. The slow-query log records individual
statements over a threshold, with their parameters and timing, and never shows
you the cheap-but-constant query. They are complementary, and a production system
wants both.

---


---

← [pg_stat_statements](02-pg-stat-statements.md) · Next → [Table health](04-table-health.md)
