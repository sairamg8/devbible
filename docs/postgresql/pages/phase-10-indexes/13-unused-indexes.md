---
title: "Unused and duplicate indexes"
sidebar_label: "13 · Unused indexes"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex26-index-ops.mjs`.

**`pg_stat_user_indexes.idx_scan` counts how many times the planner chose each index. An
index sitting at zero after a full business cycle is costing you writes and disk for
nothing — but read the counter carefully, because it lags and it resets.**

## The audit

One table, four indexes, twenty queries filtering `a` and `b`:

```console
$ node ex26-index-ops.mjs
┌─────────┬────────────────┬──────────┬──────────────┬───────────┐
│ (index) │ index          │ idx_scan │ idx_tup_read │ size      │
├─────────┼────────────────┼──────────┼──────────────┼───────────┤
│ 0       │ 'u_tab_ab'     │ '21'     │ '6000'       │ '1416 kB' │
│ 1       │ 'u_tab_a'      │ '0'      │ '0'          │ '1440 kB' │
│ 2       │ 'u_tab_a_copy' │ '0'      │ '0'          │ '1440 kB' │
│ 3       │ 'u_tab_never'  │ '0'      │ '0'          │ '4408 kB' │
└─────────┴────────────────┴──────────┴──────────────┴───────────┘
```

Three of four indexes never used, **7288 kB of dead weight**, maintained on every write:

- `u_tab_a_copy` is a byte-for-byte duplicate of `u_tab_a`.
- `u_tab_a` is redundant anyway — `u_tab_ab` is `(a, b)` and serves `a` as a
  [leftmost prefix](06-multicolumn.md).
- `u_tab_never` indexes a column nothing queries, and it is the largest of the four.

## The counter lags — twice

This will mislead you if you check immediately after running a query:

```console
read immediately            : u_tab_a=0 u_tab_a_copy=0 u_tab_ab=0 u_tab_never=0
after 2s                    : u_tab_a=0 u_tab_a_copy=0 u_tab_ab=0 u_tab_never=0
after 4s + clear_snapshot   : u_tab_a=0 u_tab_a_copy=0 u_tab_ab=21 u_tab_never=0
stats_fetch_consistency = cache
```

Two separate delays stack up:

1. **The writing backend** accumulates counters locally and flushes them on a timer, not
   at commit.
2. **The reading backend** caches its statistics snapshot — `stats_fetch_consistency =
   cache` is the default — so repeated reads in the same session can return the same
   stale numbers. `SELECT pg_stat_clear_snapshot()` discards it.

**Never conclude "unused" from a reading taken seconds after the query.** Judge over days.

## Finding exact duplicates

```console
┌─────────┬───────────────────────────────┬───────┐
│ (index) │ same_definition               │ count │
├─────────┼───────────────────────────────┼───────┤
│ 0       │ [ 'u_tab_a', 'u_tab_a_copy' ] │ '2'   │
└─────────┴───────────────────────────────┴───────┘
```

```sql
SELECT array_agg(indexrelid::regclass::text) AS same_definition, count(*)
FROM pg_index
GROUP BY indrelid, indkey::text, indclass::text,
         indexprs::text, indpred::text, indisunique
HAVING count(*) > 1;
```

Grouping on the full definition — columns, operator classes, expression, predicate and
uniqueness — is what makes this reliable. Grouping on column names alone would wrongly
merge a partial index with a full one, or a `text_pattern_ops` index with a plain one.

## The duplicate everybody creates by accident

```console
┌─────────┬────────────────────┬─────────────────────────────────────────────────────────────────────────┐
│ (index) │ indexname          │ indexdef                                                                │
├─────────┼────────────────────┼─────────────────────────────────────────────────────────────────────────┤
│ 0       │ 'u_uq_pkey'        │ 'CREATE UNIQUE INDEX u_uq_pkey ON public.u_uq USING btree (id)'         │
│ 1       │ 'u_uq_email_key'   │ 'CREATE UNIQUE INDEX u_uq_email_key ON public.u_uq USING btree (email)' │
│ 2       │ 'u_uq_email_extra' │ 'CREATE INDEX u_uq_email_extra ON public.u_uq USING btree (email)'      │
└─────────┴────────────────────┴─────────────────────────────────────────────────────────────────────────┘
```

The table declared `id int PRIMARY KEY, email text UNIQUE` — that is **two indexes created
implicitly**. Someone then added `u_uq_email_extra` on `email`, which serves nothing the
unique index does not already serve.

**A `PRIMARY KEY` or `UNIQUE` constraint is an index.** Before adding one, check `\d`.

## Before you drop anything

`idx_scan = 0` is necessary, not sufficient. Check all of this first:

```sql
-- when were the counters last zeroed?
SELECT stats_reset FROM pg_stat_database WHERE datname = current_database();

-- is it enforcing a constraint? then it is not optional
SELECT c.conname, c.contype FROM pg_constraint c WHERE c.conindid = 'idx'::regclass;

-- the full picture
SELECT s.indexrelname, s.idx_scan, i.indisunique, i.indisvalid,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS size
FROM pg_stat_user_indexes s JOIN pg_index i ON i.indexrelid = s.indexrelid
WHERE s.relname = 'u_tab' ORDER BY s.idx_scan;
```

Four traps in that list:

- **`stats_reset` was `null` in the measurement above** — no reset had ever happened. If it
  is recent, your zeros mean nothing.
- **A unique index enforces a constraint** even at `idx_scan = 0`. Dropping it changes what
  data is legal.
- **Replicas keep their own counters.** An index unused on the primary may be the one your
  reporting replica depends on. Check every node.
- **Quarterly and annual jobs.** A month of observation does not cover them.

Then drop it the safe way:

```sql
DROP INDEX CONCURRENTLY u_tab_a_copy;
```

## From Node

Ship the audit as a query, not a memory:

```js
const {rows} = await pool.query(`
  SELECT s.relname AS table, s.indexrelname AS index, s.idx_scan,
         pg_size_pretty(pg_relation_size(s.indexrelid)) AS size,
         i.indisunique, i.indisvalid
  FROM pg_stat_user_indexes s
  JOIN pg_index i ON i.indexrelid = s.indexrelid
  WHERE s.idx_scan = 0 AND NOT i.indisunique
  ORDER BY pg_relation_size(s.indexrelid) DESC`);
console.table(rows);
```

Excluding `indisunique` up front keeps constraint-backing indexes out of the candidate
list. Run it as a scheduled report against production, keep the output, and only act on an
index that has been at zero across the whole window.

## Trade-off

**Dropping an unused index is one of the few pure wins in database tuning — and it is
irreversible in the moment that matters.** Rebuilding a large index takes minutes you may
not have during the incident that reveals you needed it.

The other side: keeping indexes "just in case" is what produced the 7288 kB of dead weight
above. On a busy table that is real insert latency, real disk, and real
[bloat](17-bloat-reindex.md).

The middle path is to drop with evidence — a long observation window, every replica
checked, the definition recorded so it can be rebuilt with
[`CREATE INDEX CONCURRENTLY`](12-concurrently.md) if you were wrong.

## Gotchas

**Symptom:** `idx_scan` is 0 immediately after a query you know used the index
**Cause:** Backend flush delay plus the reader's cached snapshot
**Fix:** `SELECT pg_stat_clear_snapshot()` and wait; judge over days, not seconds

**Symptom:** Everything shows zero scans
**Cause:** Counters reset — by `pg_stat_reset()`, a crash recovery, or a major upgrade
**Fix:** Check `stats_reset` in `pg_stat_database` before trusting any of it

**Symptom:** Dropping a zero-scan index broke an insert
**Cause:** It was backing a `UNIQUE` or `PRIMARY KEY` constraint
**Fix:** Exclude `indisunique`; drop the constraint if you truly mean to

**Symptom:** Two indexes on the same column with different names
**Cause:** A migration added one the `UNIQUE` constraint already provided
**Fix:** Group `pg_index` by the full definition; drop the redundant one

**Symptom:** An index unused on the primary turns out to be critical
**Cause:** Read replicas keep separate counters
**Fix:** Audit every node before dropping

## Interview questions

**★ How do you find unused indexes?**
`pg_stat_user_indexes.idx_scan = 0` over a long window, joined to `pg_index` to exclude
unique/constraint-backing indexes, ordered by size. Measured: three of four indexes on one
table were at zero, costing 7288 kB.

**★ Why is `idx_scan = 0` not enough to drop it?**
It may back a `UNIQUE` constraint; the counters may have been reset (`stats_reset`); a
quarterly job may not have run yet; and replicas count separately.

**★ Why did the counter still read zero right after the query?**
Backends flush index counters on a timer, and the reading session caches its snapshot
(`stats_fetch_consistency = cache`). Measured: the count appeared only after
`pg_stat_clear_snapshot()` and a wait.

**How do you find exact duplicate indexes?**
Group `pg_index` by `indrelid, indkey, indclass, indexprs, indpred, indisunique` and keep
groups with more than one member — comparing full definitions, not column names.

**Does `id int PRIMARY KEY, email text UNIQUE` create indexes?**
Yes, two. Adding another index on `email` is pure duplication.

**How do you drop an index safely on a live system?**
`DROP INDEX CONCURRENTLY` — the plain form takes an `ACCESS EXCLUSIVE` lock.

---

← [CREATE INDEX CONCURRENTLY](12-concurrently.md) · Next → [pg_stat_statements](14-pg-stat-statements.md)
