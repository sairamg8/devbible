---
title: "bytea"
sidebar_label: "13 · bytea"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

**bytea stores bytes; large files usually belong in object storage, not the row.**

## Why it matters

Type choices are expensive to reverse. Getting bytea wrong creates classes of bugs (money, time zones, ids) that appear only under load or in another region.

## How it works

bytea stores bytes; large files usually belong in object storage, not the row.

Hold the model in your head before memorizing syntax.

## In SQL

```sql
SELECT pg_typeof(1::bigint) AS t_bigint,
       pg_typeof(10.50::numeric) AS t_numeric,
       pg_typeof(now()) AS t_timestamptz,
       pg_typeof('x'::text) AS t_text;
```

## From Node (`pg` return shapes)

```js
const {rows} = await pool.query(`
  select 1::bigint as b, 10.50::numeric as n, now() as t, true as ok
`);
// Measured: { b: '1', n: '10.50', t: Date, ok: true }
// typeof: b string, n string, t object(Date), ok boolean
console.log(rows[0]);
```

**Never** put money in JS numbers from float columns. Keep `numeric` as string or a decimal library.

## Gotchas

**Symptom:** It works in a tutorial and fails in your app  
**Cause:** Different database, search_path, role, or missing parameters  
**Fix:** Reproduce in `psql` with the same role/database as the app, then match the `pg` call

**Symptom:** "It is slow" with no evidence  
**Cause:** Guessing  
**Fix:** `EXPLAIN (ANALYZE, BUFFERS)` for plans; `\timing` for shell latency; measure API time separately

## Interview questions

**★ What is the core idea of “bytea”?**  
bytea stores bytes; large files usually belong in object storage, not the row.

**★ How do you verify it?**  
Reproduce in `psql` on PostgreSQL 18, then issue the same statement from Node with `$1` parameters (or confirm it is intentionally shell-only).

**What breaks in production if you ignore this?**  
Wrong data, silent wrong results, pool exhaustion, or multi-second list endpoints — depending on the topic. Measure before guessing.

**How does this connect to the rest of the syllabus?**  
Use the phase index and the Part file “Where this connects” sections; do not re-learn pool sizing here if Node Phase 6 already owns it.

---

← [Casting](12-casting.md) · Next → [Network, geometric, citext](14-network-geo-citext.md)
