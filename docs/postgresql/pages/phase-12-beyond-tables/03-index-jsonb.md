---
title: "Indexing jsonb"
sidebar_label: "03 · Index jsonb"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

**GIN, jsonb_path_ops, and expression indexes on hot keys.**

## Why it matters

`psql` is how you prove every later claim. Indexing jsonb is daily operator skill.

## How it works

GIN, jsonb_path_ops, and expression indexes on hot keys.

Hold the model in your head before memorizing syntax.

## In SQL

```sql
SELECT '{"a":1,"b":[1,2]}'::jsonb -> 'b' AS b,
       '{"a":1}'::jsonb @> '{"a":1}' AS contains;  -- measured: [1,2] / t
```

## From Node

`jsonb` arrives as a JS object. Prefer columns for stable filters; jsonb for optional attributes (see column-vs-json page).

## Gotchas

**Symptom:** It works in a tutorial and fails in your app  
**Cause:** Different database, search_path, role, or missing parameters  
**Fix:** Reproduce in `psql` with the same role/database as the app, then match the `pg` call

**Symptom:** "It is slow" with no evidence  
**Cause:** Guessing  
**Fix:** `EXPLAIN (ANALYZE, BUFFERS)` for plans; `\timing` for shell latency; measure API time separately

## Interview questions

**★ What is the core idea of “Indexing jsonb”?**  
GIN, jsonb_path_ops, and expression indexes on hot keys.

**★ How do you verify it?**  
Reproduce in `psql` on PostgreSQL 18, then issue the same statement from Node with `$1` parameters (or confirm it is intentionally shell-only).

**What breaks in production if you ignore this?**  
Wrong data, silent wrong results, pool exhaustion, or multi-second list endpoints — depending on the topic. Measure before guessing.

**How does this connect to the rest of the syllabus?**  
Use the phase index and the Part file “Where this connects” sections; do not re-learn pool sizing here if Node Phase 6 already owns it.

---

← [When a column beats JSON](02-column-vs-json.md) · Next → [Building JSON in SQL](04-build-json-sql.md)
