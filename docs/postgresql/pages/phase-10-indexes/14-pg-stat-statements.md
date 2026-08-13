---
title: "pg_stat_statements"
sidebar_label: "14 · pg_stat_statements"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex26-index-ops.mjs`.

**The query you should optimise is almost never the one you suspect. `pg_stat_statements`
ranks by *total* time, which is how a 4 ms query run 500 times beats an 87 ms query run
twice — and only one of those is worth your afternoon.**

## Total time, not mean time

```console
$ node ex26-index-ops.mjs
=== 4. pg_stat_statements — what actually costs you ===
┌─────────┬───────┬──────────┬──────────┬─────────┬──────────────────────────────────────────────┐
│ (index) │ calls │ total_ms │ mean_ms  │ rows    │ query                                        │
├─────────┼───────┼──────────┼──────────┼─────────┼──────────────────────────────────────────────┤
│ 0       │ '500' │ 9240     │ '18.481' │ '499'   │ 'SELECT * FROM u_tab WHERE id = $1'          │
│ 1       │ '2'   │ 173      │ '86.605' │ '2'     │ 'SELECT count(*) FROM x_big WHERE v LIKE $1' │
│ 2       │ '40'  │ 161      │ '4.033'  │ '80000' │ 'SELECT * FROM u_tab WHERE a = $1'           │
└─────────┴───────┴──────────┴──────────┴─────────┴──────────────────────────────────────────────┘
note: the 500-call query and the 2-call query are ranked by TOTAL, not by mean
```

Row 1 has the **worst mean** — 86.6 ms — and is the one a slow-query log would flag. Row 0
is 4.7× cheaper per call and consumed **9240 ms against 173 ms**. Fix row 0 first.

Row 0 is also the most common shape in real systems: an unindexed lookup by `id` in a hot
path, individually unremarkable, collectively dominant.

The `rows` column earns its place too. Row 2 returned **80 000 rows across 40 calls** —
2000 rows per call to the application. That is a `LIMIT` problem, not an index problem.

## Literals are normalised away

```console
┌─────────┬───────┬────────────────────────────────────┐
│ (index) │ calls │ query                              │
├─────────┼───────┼────────────────────────────────────┤
│ 0       │ '3'   │ 'SELECT * FROM u_tab WHERE a = $1' │
└─────────┴───────┴────────────────────────────────────┘
```

Three queries with the literals `1`, `2` and `3` — **one row, `calls = 3`**. Constants are
replaced by `$n` regardless of whether you parameterised them, so string-concatenated SQL
still aggregates correctly.

Two consequences: you cannot see which parameter value was slow (take an
[`EXPLAIN`](03-explain.md) for that), and **no parameter values are stored**, which is what
makes the view safe to expose to people who should not see production data.

## Setting it up

The extension requires a **server restart** — it hooks the executor, so it must be
preloaded:

```sql
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';
-- restart the server here
CREATE EXTENSION pg_stat_statements;
```

```console
pg_stat_statements.max = 5000 | track = all
```

`max = 5000` is the number of distinct normalised statements retained. When it overflows,
the least-executed are evicted — so on an application generating unbounded query shapes
(unparameterised `IN` lists of varying length are the classic cause) the view quietly
becomes useless. `pg_stat_statements_info` reports `dealloc`, the eviction count; a
non-zero and growing `dealloc` means raise `max` or fix the query generation.

`track = 'all'` includes statements inside functions and procedures; the default `'top'`
counts only what the client sent.

## The queries worth keeping

```sql
-- where the time goes
SELECT calls, round(total_exec_time)::int AS total_ms,
       round(mean_exec_time::numeric, 2) AS mean_ms, rows,
       left(query, 80) AS query
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 20;

-- rows returned per call — the LIMIT audit
SELECT calls, rows / calls AS rows_per_call, left(query, 80)
FROM pg_stat_statements
WHERE calls > 0 ORDER BY rows / calls DESC LIMIT 20;

-- cache behaviour per statement
SELECT shared_blks_hit, shared_blks_read, left(query, 60)
FROM pg_stat_statements ORDER BY shared_blks_read DESC LIMIT 20;

-- start a clean measurement window
SELECT pg_stat_statements_reset();
```

Column names differ across major versions — `total_time` became `total_exec_time` in
PostgreSQL 13, and planning time is tracked separately. Check `\d pg_stat_statements`
before copying a query from the internet.

## From Node

The workflow: **reset, run the load, read the top of the list, then `EXPLAIN` the winner.**

```js
await pool.query(`SELECT pg_stat_statements_reset()`);
await runTheScenario();

const {rows} = await pool.query(`
  SELECT calls, round(total_exec_time)::int AS total_ms,
         round(mean_exec_time::numeric, 2) AS mean_ms,
         rows / greatest(calls, 1) AS rows_per_call,
         left(query, 90) AS query
  FROM pg_stat_statements
  WHERE query NOT LIKE '%pg_stat_statements%'
  ORDER BY total_exec_time DESC LIMIT 10`);
console.table(rows);
```

Filtering out the monitoring query itself matters — it will otherwise rank itself. Scoping
to the current database (`dbid = (SELECT oid FROM pg_database WHERE datname =
current_database())`) matters on a shared server.

This is also the honest way to catch N+1: a query with `calls` in the tens of thousands and
`rows_per_call` of 1 is one, no matter what the ORM's documentation says. See
[N+1 queries](/docs/nodejs/pages/phase-6-data-access/n-plus-1).

## Trade-off

**It costs a small amount of overhead on every statement and a shared-memory allocation,
and it requires a restart to enable** — which is why it should be turned on *before* you
need it, not during an incident.

The limits are real. It aggregates, so a statement that is fast for most parameters and
catastrophic for one shows only the average. It stores no plans and no timestamps, so it
cannot tell you *when* something got slow — pair it with a periodic snapshot of the view,
or a monitoring tool that does that for you.

## Gotchas

**Symptom:** `CREATE EXTENSION pg_stat_statements` succeeds but the view is empty
**Cause:** The library was not preloaded, so nothing is being collected
**Fix:** `shared_preload_libraries`, then restart. `SHOW shared_preload_libraries` to
confirm

**Symptom:** Optimising the highest `mean_exec_time` query changed nothing
**Cause:** It runs twice a day. Measured: 173 ms total against 9240 ms for a query with a
4.7× better mean
**Fix:** Order by `total_exec_time`

**Symptom:** The same query appears many times
**Cause:** Genuinely different statement text — different whitespace, comments, or a
variable-length `IN` list
**Fix:** Parameterise; use `= ANY($1)` instead of a generated `IN (…)` list

**Symptom:** Statistics vanish or the view is missing recent queries
**Cause:** Eviction at `pg_stat_statements.max`
**Fix:** Check `dealloc` in `pg_stat_statements_info`; raise `max` or reduce query-shape
churn

**Symptom:** A query is slow only in production, and the view shows a good mean
**Cause:** Aggregation hides the bad parameter values
**Fix:** `EXPLAIN (ANALYZE, BUFFERS)` with a realistic value; consider
`auto_explain` for outliers

## Interview questions

**★ How do you find the queries actually costing you?**
`pg_stat_statements` ordered by `total_exec_time`. Measured: the top query had a 4.7×
better mean than the second but consumed 9240 ms against 173 ms.

**★ Why order by total rather than mean?**
Mean flags rare heavyweight queries; total finds the frequent moderate ones that dominate
the server's actual workload.

**★ Are query parameters visible in it?**
No. Constants are normalised to `$1`, so three literal variants collapse into one row with
`calls = 3`. That is why it is safe to expose, and why you cannot see which value was slow.

**What does it take to enable?**
`shared_preload_libraries = 'pg_stat_statements'` and a **server restart**, then
`CREATE EXTENSION`.

**What is `pg_stat_statements.max` and why does it matter?**
The number of distinct statements retained — 5000 by default. Overflow evicts entries;
watch `dealloc` in `pg_stat_statements_info`.

**How would you detect N+1 with it?**
A statement with a very high `calls` count and `rows / calls` of about 1.

---

← [Unused and duplicate indexes](13-unused-indexes.md) · Next → [GiST, BRIN and hash](15-gist-brin-hash.md)
