---
title: "Statistics, ANALYZE and extended statistics"
sidebar_label: "16 · Statistics"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex26-index-ops.mjs`,
> `ex24-index-not-used.mjs`.

**The planner does not look at your data — it looks at a sample of it taken by `ANALYZE`.
Every plan choice is downstream of that sample being current, detailed enough, and aware
that your columns are not independent.**

## Where statistics live

```sql
SELECT null_frac, n_distinct, most_common_vals, most_common_freqs, correlation
FROM pg_stats WHERE tablename = 'n_users' AND attname = 'status';
```

```console
pg_stats for status: {active,locked} {0.9991,0.0009}
```

That single row is why `WHERE status = 'locked'` gets an index scan and `WHERE status =
'active'` gets a sequential scan — see
[Why an index is not used](05-index-not-used.md). `n_distinct` of `-1` means "unique per
row"; a negative fraction means "scales with table size".

## Stale statistics produce genuinely wrong plans

From [Why an index is not used](05-index-not-used.md), a table analyzed at 2000 rows and
then grown to 402 000 without re-analyzing:

```console
->  Index Only Scan using s_stale_tag_idx on s_stale  (cost=0.42..8.44 rows=1 width=0)
      (actual time=0.068..119.743 rows=400001.00 loops=1)
      Heap Fetches: 400001
Execution Time: 157.163 ms
  catalog still says reltuples = 2000
```

**Estimated 1 row, actual 400 001.** After `ANALYZE` the same query switched to a parallel
sequential scan: **157 ms → 58 ms**.

Also worth knowing: a never-analyzed table reports `reltuples = -1`, which means *unknown*,
not empty. PostgreSQL then estimates from the physical file size.

## Correlated columns — the error `ANALYZE` alone cannot fix

Per-column statistics assume independence. `country` and `dial_code` always move together:

```console
-- without extended statistics --
Seq Scan on s_corr  (cost=0.00..6164.00 rows=33607 width=10)
                    (actual time=0.015..43.703 rows=100000.00 loops=1)
  Filter: ((country = 'IN'::text) AND (dial_code = '+91'::text))
```

Each filter alone is estimated correctly. Combined, PostgreSQL multiplies the
selectivities — ⅓ × ⅓ — and lands on **33 607 against an actual 100 000**.

```sql
CREATE STATISTICS s_corr_ext (dependencies, ndistinct) ON country, dial_code FROM s_corr;
ANALYZE s_corr;
```

```console
-- after CREATE STATISTICS + ANALYZE --
Seq Scan on s_corr  (cost=0.00..6164.00 rows=100990 width=10)
                    (actual time=0.017..44.135 rows=100000.00 loops=1)
┌─────────┬─────────────────┬───────────────┬────────────────────────────────────────────┐
│ (index) │ statistics_name │ n_distinct    │ dependencies                               │
├─────────┼─────────────────┼───────────────┼────────────────────────────────────────────┤
│ 0       │ 's_corr_ext'    │ '{"2, 3": 3}' │ '{"2 => 3": 1.000000, "3 => 2": 1.000000}' │
└─────────┴─────────────────┴───────────────┴────────────────────────────────────────────┘
```

**33 607 → 100 990 against an actual 100 000.** The `dependencies` entry records that
column 2 determines column 3 with certainty 1.0, and `ndistinct` records that the pair has
3 combinations rather than the 9 independence would imply.

The execution time did not change here, because with only one table there was one sensible
plan either way. **The payoff is on joins**, where a 3× underestimate feeds a nested loop
that should have been a hash join, and the error compounds up the tree.

Three kinds are available: `ndistinct`, `dependencies`, and `mcv` (multivariate
most-common-values, for correlations that hold only for some values).

## Sample size: `default_statistics_target`

```console
default_statistics_target = 100
x_big.v at target 100: {"buckets":101,"mcvs":1,"n_distinct":-0.94929594}
x_big.v at target 1000: {"buckets":1001,"mcvs":1,"n_distinct":-0.9947037} | ANALYZE took 1309 ms
```

The target sets both the histogram bucket count and the number of most-common-values
tracked. At 1000 the histogram is 10× more detailed and `n_distinct` moved from −0.949 to
−0.995 — measurably closer to the truth (the column really is unique per row).

The cost is `ANALYZE` time and planning time on every query touching the column, so raise
it **per column**, not globally:

```sql
ALTER TABLE x_big ALTER COLUMN v SET STATISTICS 1000;
ANALYZE x_big;
ALTER TABLE x_big ALTER COLUMN v SET STATISTICS -1;   -- back to the default
```

The columns worth this are skewed ones the planner keeps misjudging — a `status` with one
dominant value, a tenant id with a few enormous tenants.

## When autovacuum analyzes on its own

```console
┌─────────┬───────────────────────────────────┬─────────┐
│ (index) │ name                              │ setting │
├─────────┼───────────────────────────────────┼─────────┤
│ 0       │ 'autovacuum_analyze_scale_factor' │ '0.1'   │
│ 1       │ 'autovacuum_analyze_threshold'    │ '50'    │
│ 2       │ 'autovacuum_naptime'              │ '60'    │
└─────────┴───────────────────────────────────┴─────────┘
```

The rule is `threshold + scale_factor × reltuples` — **50 + 10% of the table**. On a
10-million-row table that is a million modifications before autoanalyze considers it,
which on a slowly-drifting distribution is far too late. Lower `scale_factor` for large
tables:

```sql
ALTER TABLE big_table SET (autovacuum_analyze_scale_factor = 0.01);
```

```console
┌─────────┬──────────┬─────────────────────┬──────────┬──────────────┐
│ (index) │ relname  │ n_mod_since_analyze │ analyzed │ autoanalyzed │
├─────────┼──────────┼─────────────────────┼──────────┼──────────────┤
│ 0       │ 'x_big'  │ '0'                 │ true     │ true         │
│ 1       │ 's_corr' │ '300000'            │ true     │ false        │
└─────────┴──────────┴─────────────────────┴──────────┴──────────────┘
```

`n_mod_since_analyze` is the counter to watch — 300 000 modifications outstanding on
`s_corr`.

## In SQL

```sql
ANALYZE t;                          -- one table
ANALYZE t (col_a, col_b);           -- specific columns
ANALYZE VERBOSE t;                  -- how many rows were sampled

SELECT relname, n_mod_since_analyze, last_analyze, last_autoanalyze
FROM pg_stat_user_tables ORDER BY n_mod_since_analyze DESC;

CREATE STATISTICS st (dependencies, ndistinct, mcv) ON a, b FROM t;
SELECT * FROM pg_stats_ext WHERE tablename = 't';
DROP STATISTICS st;
```

## From Node

**`ANALYZE` is the last statement of every bulk load and every migration that moves a lot
of rows.** Not optional — the measurement above is what happens when it is skipped.

```js
await client.query(`COPY staging FROM STDIN`);   // or an unnest bulk insert
await client.query(`INSERT INTO target SELECT * FROM staging`);
await client.query(`ANALYZE target`);            // ← the step people forget
```

See [bulk insert](../phase-8-schema-from-node/04-bulk-insert.md).

A staleness check worth shipping as a health query:

```js
const {rows} = await pool.query(`
  SELECT relname, n_live_tup, n_mod_since_analyze,
         round(100.0 * n_mod_since_analyze / greatest(n_live_tup, 1), 1) AS pct_stale,
         last_analyze, last_autoanalyze
  FROM pg_stat_user_tables
  WHERE n_mod_since_analyze > 10000
  ORDER BY n_mod_since_analyze DESC LIMIT 20`);
console.table(rows);
```

`ANALYZE` takes only a `SHARE UPDATE EXCLUSIVE` lock, so it does not block reads or
writes — it is safe to run on a live table, unlike most maintenance.

## Trade-off

**Statistics are a sample, and every knob trades accuracy against the cost of collecting
and using them.** A higher `default_statistics_target` gives better estimates and slower
`ANALYZE` and planning. Extended statistics fix correlated-column errors and add work to
every `ANALYZE` on those columns, and they must be created by hand — PostgreSQL will never
notice the correlation for you.

The default settings are reasonable for medium tables and systematically too lax for very
large ones, where 10% of the table is an enormous number of modifications to tolerate
before re-sampling.

Extended statistics are worth creating only where you have *seen* the estimate go wrong.
Adding them speculatively across a schema is cost without evidence.

## Gotchas

**Symptom:** Terrible plan straight after a bulk load
**Cause:** No statistics; `reltuples` may still be `-1`
**Fix:** `ANALYZE t` as the final step of the load

**Symptom:** Estimates wrong on two columns that always agree
**Cause:** Per-column statistics assume independence — measured 33 607 estimated versus
100 000 actual
**Fix:** `CREATE STATISTICS … (dependencies, ndistinct) ON a, b FROM t` and `ANALYZE`

**Symptom:** A large table's plans drift worse over weeks
**Cause:** Autoanalyze needs 10% of the table modified
**Fix:** `ALTER TABLE … SET (autovacuum_analyze_scale_factor = 0.01)`

**Symptom:** A skewed column is consistently misestimated
**Cause:** 100 most-common-values is not enough to describe it
**Fix:** `ALTER TABLE … ALTER COLUMN c SET STATISTICS 1000` for that column only

**Symptom:** `CREATE STATISTICS` did not change anything
**Cause:** It only takes effect after the next `ANALYZE`
**Fix:** Run `ANALYZE`, then re-check the estimate in `EXPLAIN`

**Symptom:** Estimates wrong on an expression like `lower(x)`
**Cause:** No statistics exist for expressions without an index on them
**Fix:** Create the [expression index](10-expression.md), or `CREATE STATISTICS` on the
expression

## Interview questions

**★ Why does the planner need `ANALYZE`?**
It plans against a sample, not the data. Measured: a table analyzed at 2000 rows and grown
to 402 000 estimated 1 row where 400 001 matched, and took 157 ms instead of 58 ms.

**★ What problem do extended statistics solve?**
Correlated columns. Per-column statistics multiply selectivities as if independent —
measured 33 607 estimated against 100 000 actual, corrected to 100 990 by
`CREATE STATISTICS … (dependencies, ndistinct)`.

**★ When does autovacuum analyze a table?**
When `n_mod_since_analyze` exceeds `threshold + scale_factor × reltuples` — 50 + 10% by
default, which is far too lax on very large tables.

**What does `default_statistics_target` control?**
Histogram buckets and most-common-values tracked per column. Measured: 101 buckets at 100,
1001 at 1000, with `ANALYZE` taking 1309 ms. Raise it per column, not globally.

**What does `reltuples = -1` mean?**
Never analyzed — unknown, not zero.

**Does `ANALYZE` lock the table?**
Only `SHARE UPDATE EXCLUSIVE`; reads and writes continue.

---

← [GiST, BRIN and hash](15-gist-brin-hash.md) · Next → [Index bloat and REINDEX](17-bloat-reindex.md)
