---
title: "HAVING vs WHERE"
sidebar_label: "03 · HAVING"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**WHERE filters rows before grouping; HAVING filters groups after.**

## Why it matters

Correct SQL is the product surface of your API. HAVING vs WHERE shows up in list/detail/write paths constantly.

## How it works

WHERE filters rows before grouping; HAVING filters groups after.

Hold the model in your head before memorizing syntax.

## In SQL

```sql
-- Example shape on sandbox tables
SELECT u.email, count(o.*) AS orders
FROM measure_users u
LEFT JOIN measure_orders o ON o.user_id = u.id
GROUP BY u.email
ORDER BY u.email;
```

## From Node

```js
const {rows} = await pool.query(
  `select u.email, count(o.*)::int as orders
   from measure_users u
   left join measure_orders o on o.user_id = u.id
   where ($1::text is null or u.email = $1)
   group by u.email
   order by u.email`,
  [emailOrNull],
);
```

Always pass values as parameters (`$1`), never string-build them.

## Gotchas

**Symptom:** It works in a tutorial and fails in your app  
**Cause:** Different database, search_path, role, or missing parameters  
**Fix:** Reproduce in `psql` with the same role/database as the app, then match the `pg` call

**Symptom:** "It is slow" with no evidence  
**Cause:** Guessing  
**Fix:** `EXPLAIN (ANALYZE, BUFFERS)` for plans; `\timing` for shell latency; measure API time separately

## Interview questions

**★ What is the core idea of “HAVING vs WHERE”?**  
WHERE filters rows before grouping; HAVING filters groups after.

**★ How do you verify it?**  
Reproduce in `psql` on PostgreSQL 18, then issue the same statement from Node with `$1` parameters (or confirm it is intentionally shell-only).

**What breaks in production if you ignore this?**  
Wrong data, silent wrong results, pool exhaustion, or multi-second list endpoints — depending on the topic. Measure before guessing.

**How does this connect to the rest of the syllabus?**  
Use the phase index and the Part file “Where this connects” sections; do not re-learn pool sizing here if Node Phase 6 already owns it.

---

← [count variants](02-count-variants.md) · Next → [FILTER WHERE aggregates](04-filter-clause.md)
