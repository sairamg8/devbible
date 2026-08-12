---
title: "MVCC snapshots"
sidebar_label: "05 · MVCC"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

**MVCC versions rows so readers do not block writers (generally).**

## Why it matters

`psql` is how you prove every later claim. MVCC snapshots is daily operator skill.

## How it works

MVCC versions rows so readers do not block writers (generally).

Hold the model in your head before memorizing syntax.

## In SQL

```sql
SHOW default_transaction_isolation; -- read committed (measured)
BEGIN;
UPDATE measure_users SET balance = balance - 10 WHERE email = 'a@x.com';
-- other session can still read committed data under READ COMMITTED rules
ROLLBACK;
```

## From Node

```js
const c = await pool.connect();
try {
  await c.query('BEGIN');
  await c.query('update measure_users set balance = balance - $1 where email = $2', [10, 'a@x.com']);
  await c.query('ROLLBACK'); // measured: balance restored
} finally {
  c.release();
}
```

One client for the whole transaction. Idle-in-transaction freezes vacuum — always COMMIT/ROLLBACK.

## Gotchas

**Symptom:** It works in a tutorial and fails in your app  
**Cause:** Different database, search_path, role, or missing parameters  
**Fix:** Reproduce in `psql` with the same role/database as the app, then match the `pg` call

**Symptom:** "It is slow" with no evidence  
**Cause:** Guessing  
**Fix:** `EXPLAIN (ANALYZE, BUFFERS)` for plans; `\timing` for shell latency; measure API time separately

## Interview questions

**★ What is the core idea of “MVCC snapshots”?**  
MVCC versions rows so readers do not block writers (generally).

**★ How do you verify it?**  
Reproduce in `psql` on PostgreSQL 18, then issue the same statement from Node with `$1` parameters (or confirm it is intentionally shell-only).

**What breaks in production if you ignore this?**  
Wrong data, silent wrong results, pool exhaustion, or multi-second list endpoints — depending on the topic. Measure before guessing.

**How does this connect to the rest of the syllabus?**  
Use the phase index and the Part file “Where this connects” sections; do not re-learn pool sizing here if Node Phase 6 already owns it.

---

← [Lost update](04-lost-update.md) · Next → [REPEATABLE READ SERIALIZABLE](06-isolation-levels.md)
