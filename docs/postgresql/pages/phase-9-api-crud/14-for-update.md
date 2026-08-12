---
title: "SELECT FOR UPDATE"
sidebar_label: "14 · FOR UPDATE"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

**FOR UPDATE in a request locks rows — hold the transaction as short as possible.**

## Why it matters

This is the Node-facing half of PostgreSQL: how SELECT FOR UPDATE shows up in a real process using `pg`.

## How it works

FOR UPDATE in a request locks rows — hold the transaction as short as possible.

Hold the model in your head before memorizing syntax.

## Verify in psql first

```console
$ psql -h 127.0.0.1 -p 55432 -U devbible -d devbible -c "select 1"
 ?column?
----------
        1
```

## From Node

```js
import pg from 'pg';
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

const client = await pool.connect();
try {
  await client.query('BEGIN');
  const {rows} = await client.query(
    'insert into measure_users (email) values ($1) returning id, email',
    ['new@x.com'],
  );
  await client.query('COMMIT');
  console.log(rows[0]);
} catch (err) {
  await client.query('ROLLBACK');
  // err.code === '23505' unique_violation (measured constraint: measure_users_email_key)
  throw err;
} finally {
  client.release();
}
```

Pool sizing / service-layer propagation: short recap only — see **Node Phase 6**.

## Gotchas

**Symptom:** `sorry, too many clients already`  
**Cause:** Pool/client leak or max_connections too low  
**Fix:** `release()` in `finally`; one pool per process; lower concurrency

**Symptom:** Unique error becomes HTTP 500  
**Cause:** Not mapping SQLSTATE  
**Fix:** Map `23505` → 409, `23503` → 400/409, `40001`/`40P01` → retry then 503

**Symptom:** Nested `BEGIN` expected  
**Cause:** Second BEGIN on an open transaction is not nested  
**Fix:** Savepoints, or redesign; see Phase 11

## Interview questions

**★ What is the core idea of “SELECT FOR UPDATE”?**  
FOR UPDATE in a request locks rows — hold the transaction as short as possible.

**★ How do you verify it?**  
Reproduce in `psql` on PostgreSQL 18, then issue the same statement from Node with `$1` parameters (or confirm it is intentionally shell-only).

**What breaks in production if you ignore this?**  
Wrong data, silent wrong results, pool exhaustion, or multi-second list endpoints — depending on the topic. Measure before guessing.

**How does this connect to the rest of the syllabus?**  
Use the phase index and the Part file “Where this connects” sections; do not re-learn pool sizing here if Node Phase 6 already owns it.

---

← [Optimistic concurrency](13-optimistic.md) · Next → [Shape in SQL vs JS](15-shape-sql-vs-js.md)
