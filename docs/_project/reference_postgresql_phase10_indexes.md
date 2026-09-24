---
name: devbible-postgresql-phase10-indexes
description: The measured dataset behind PostgreSQL Phase 10 (indexes and the planner) — what each of ex23–ex26 proved, including the results that contradicted the obvious expectation
metadata:
  type: reference
---

# PostgreSQL Phase 10 — measured findings (2026-08-12)

Behind the 18 pages in `docs/postgresql/pages/phase-10-indexes/`. All from
`sandbox/pg-api/ex23-index-basics.mjs`, `ex24-index-not-used.mjs`,
`ex25-index-kinds.mjs`, `ex26-index-ops.mjs` on **PG 18.4**, Node 24.19.0, `pg` 8.23.0.

**The numbers are already on the pages.** Open this only to reuse a finding elsewhere,
or before re-running one of these scripts — several of them measure something other
than what they appear to.

## Results that contradicted the expectation

- **A sequential scan is often the right plan.** `bucket < 800` on 400k rows: planner's
  seq scan **91.0 ms / hit=3712**, forced bitmap 96.4 ms, forced pure index scan
  **272.4 ms / hit=400358**. Forcing the index was 3× slower. Force both
  `enable_seqscan=off` *and* `enable_bitmapscan=off` or you compare the planner
  against itself and learn nothing.
- **Prefix `LIKE` seq-scans under `en_US.utf8`** — the collation, not a bug. A
  `text_pattern_ops` index fixed it 34.5 ms → 4.1 ms, and that index **cannot** serve
  `ORDER BY sku`. Both facts are on `02-btree.md`.
- **`pg` stringifies JS numbers**, so `text = $1` with `12345` works *and* uses the
  index. The classic "type mismatch kills the index" demo **does not reproduce from
  Node**. What does: `text = bigint` with no cast at all → **`42883`**.
- **GIN is not automatically faster.** At 16% selectivity GIN *lost* to a seq scan.
  The page reports the loss rather than picking the flattering predicate.
- **`idx_scan` lags twice** — the backend's flush timer *and* the reader's cached
  snapshot at `stats_fetch_consistency = cache`. `pg_stat_clear_snapshot()` is the fix.
  Cost an hour of "the counter is broken" before it was diagnosed.

## The rest

- **Cast side decides everything.** Cast the *other* column → Index Only Scan 5.5 ms.
  Cast the *indexed* column → Parallel Seq Scan 43.2 ms.
- **PG 18 B-tree skip scan is real**: `Index Searches: 7`, 0.511 ms on a
  non-leading-column predicate. Only visible after dropping the index whose leading
  column made it an ordinary scan — the first version of this probe measured nothing.
- **Immutability probe** (`CREATE INDEX` on an expression): `42P17` for
  `(created_at::date)`, `date_trunc('day', created_at)` and `age(created_at)`; **OK**
  for `((created_at AT TIME ZONE 'UTC')::date)`, `date_trunc('day', created_at, 'UTC')`
  and `(created_ts::date)`.
- **jsonb operator classes**: `jsonb_path_ops` 42.061 ms vs `jsonb_ops` 0.064 ms on
  `doc ? 'discount'` — `?` is not in `jsonb_path_ops`. Pick `doc ? 'x'` carefully:
  `doc ? 'sku'` matched every row and measured nothing.
- **`<->` distance ordering needs GiST**, not GIN: 766.6 ms vs 110.0 ms, at 48 MB
  against 13 MB.
- **BRIN**: 24 kB vs 64 MB B-tree on 3 M rows, same speed — until correlation drops.
  Shuffled copy: correlation **0.0119**, planner ignored the index entirely.
- **Hash**: 16 MB vs 28 MB B-tree; `UNIQUE` → **`0A000`**; ranges and `ORDER BY`
  seq-scan.
- **GiST exclusion constraint** raises **`23P01`**, distinct from `23505`. Needs
  `btree_gist` for the plain-equality column.
- **Bloat**: 8792 kB → **34 MB (4×)** from six passes over a third of 400k rows,
  `leaf_fragmentation 49.99`. `VACUUM` left it at 34 MB. `REINDEX CONCURRENTLY` →
  9968 kB in 783 ms, fragmentation 0.
- **Stale stats**: analyzed at 2000 rows, grown to 402 000 → estimated `rows=1` against
  actual `400001`, `Heap Fetches: 400001`, **157.2 ms → 58.5 ms** after `ANALYZE`.
  A never-analyzed table reports `reltuples = -1` — unknown, not empty.
- **Extended statistics**: correlated `country`/`dial_code` estimated **33 607** against
  actual 100 000; `CREATE STATISTICS (dependencies, ndistinct)` → **100 990**.
  Execution time did not change — the payoff is on joins.
- **`default_statistics_target`**: 101 buckets at 100, 1001 at 1000, `n_distinct`
  −0.949 → −0.995, `ANALYZE` 1309 ms. Raise per column, never globally.
- **Unindexed FK**: parent DELETE **33.2 ms vs 6.2 ms** indexed, on only 300k children.
- SQLSTATEs exercised: `42601`, `42883`, `42P17`, `42846`, `23505`, `23P01`, `25001`,
  `57014`, `0A000`.

## Reusable SQL worth keeping

**Foreign keys whose referencing column is not indexed.** Validated against a
deliberate positive *and* negative case before it went on `18-fk-indexes.md` — it
compares against the index's **leading** columns and requires `indisvalid`, so a
composite index counts and a failed `CREATE INDEX CONCURRENTLY` does not:

```sql
SELECT c.conrelid::regclass AS child_table, c.conname AS constraint_name,
       (SELECT string_agg(a.attname, ', ' ORDER BY k.ord)
        FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS fk_columns
FROM pg_constraint c
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid AND i.indisvalid
      AND (string_to_array(i.indkey::text, ' ')::smallint[])[1:array_length(c.conkey,1)]
          = c.conkey::smallint[])
ORDER BY 1;
```

**Gotcha:** `histogram_bounds` is `anyarray` — `::text[]` fails with `42846`, use
`::text::text[]`.

## Environment note

**`pg_stat_statements` is now enabled on `devbible-pg`**, via `ALTER SYSTEM SET
shared_preload_libraries` + `podman restart devbible-pg`. Data survived the restart.
Do not redo it.

---

**Five confounded measurements were caught before they reached a page** in this phase:
the forced-scan null comparison, the join type-mismatch, the INCLUDE index that had a
two-column index competing with it, the jsonb GIN selectivity, and the skip-scan probe.
That is [[devbible-verify-your-own-measurements]] earning its place.

Related: [[devbible-postgresql-rewrite-handoff]] · [[devbible-verify-your-own-measurements]]
