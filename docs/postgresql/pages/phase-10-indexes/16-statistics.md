---
title: "Statistics and ANALYZE"
sidebar_label: "16 · Statistics"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

**ANALYZE, default_statistics_target, extended statistics for correlated columns.**

## Why it matters

`psql` is how you prove every later claim. Statistics and ANALYZE is daily operator skill.

## How it works

ANALYZE, default_statistics_target, extended statistics for correlated columns.

Hold the model in your head before memorizing syntax.

## In SQL

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM measure_orders WHERE user_id = 1;
```

Measured plan shape (sandbox): **Bitmap Index Scan** on `measure_orders_user_id_idx` then Bitmap Heap Scan — not a seq scan when the index matches.

## From Node

You rarely run EXPLAIN from the app in production paths. Capture slow SQL (`log_min_duration_statement` / `pg_stat_statements`), then paste into `psql`:

```bash
psql ... -c "EXPLAIN (ANALYZE, BUFFERS) <the query with literals>"
```

## Gotchas

**Symptom:** It works in a tutorial and fails in your app  
**Cause:** Different database, search_path, role, or missing parameters  
**Fix:** Reproduce in `psql` with the same role/database as the app, then match the `pg` call

**Symptom:** "It is slow" with no evidence  
**Cause:** Guessing  
**Fix:** `EXPLAIN (ANALYZE, BUFFERS)` for plans; `\timing` for shell latency; measure API time separately

## Interview questions

**★ What is the core idea of “Statistics and ANALYZE”?**  
ANALYZE, default_statistics_target, extended statistics for correlated columns.

**★ How do you verify it?**  
Reproduce in `psql` on PostgreSQL 18, then issue the same statement from Node with `$1` parameters (or confirm it is intentionally shell-only).

**What breaks in production if you ignore this?**  
Wrong data, silent wrong results, pool exhaustion, or multi-second list endpoints — depending on the topic. Measure before guessing.

**How does this connect to the rest of the syllabus?**  
Use the phase index and the Part file “Where this connects” sections; do not re-learn pool sizing here if Node Phase 6 already owns it.

---

← [GiST BRIN hash](15-gist-brin-hash.md) · Next → [Index bloat REINDEX](17-bloat-reindex.md)
