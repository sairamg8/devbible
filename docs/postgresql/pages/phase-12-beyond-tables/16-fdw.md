---
title: "Foreign data wrappers"
sidebar_label: "16 · FDW"
sidebar_position: 16
---

<span className="db-tier t-when">When Needed</span>

**FDW queries remote data as local tables — ops complexity high.**

## Why it matters

`psql` is how you prove every later claim. Foreign data wrappers is daily operator skill.

## How it works

FDW queries remote data as local tables — ops complexity high.

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

**★ What is the core idea of “Foreign data wrappers”?**  
FDW queries remote data as local tables — ops complexity high.

**★ How do you verify it?**  
Reproduce in `psql` on PostgreSQL 18, then issue the same statement from Node with `$1` parameters (or confirm it is intentionally shell-only).

**What breaks in production if you ignore this?**  
Wrong data, silent wrong results, pool exhaustion, or multi-second list endpoints — depending on the topic. Measure before guessing.

**How does this connect to the rest of the syllabus?**  
Use the phase index and the Part file “Where this connects” sections; do not re-learn pool sizing here if Node Phase 6 already owns it.

---

← [Procedures vs functions](15-procedures.md) · Next → [pgvector](17-pgvector.md)
