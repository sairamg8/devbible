---
title: "Repository module per resource"
sidebar_label: "01 · Repository"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**One repository module per resource: plain functions taking a client/pool, returning rows.**

## Why it matters

This is the Node-facing half of PostgreSQL: how Repository module per resource shows up in a real process using `pg`.

## How it works

One repository module per resource: plain functions taking a client/pool, returning rows.

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

**★ What is the core idea of “Repository module per resource”?**  
One repository module per resource: plain functions taking a client/pool, returning rows.

**★ How do you verify it?**  
Reproduce in `psql` on PostgreSQL 18, then issue the same statement from Node with `$1` parameters (or confirm it is intentionally shell-only).

**What breaks in production if you ignore this?**  
Wrong data, silent wrong results, pool exhaustion, or multi-second list endpoints — depending on the topic. Measure before guessing.

**How does this connect to the rest of the syllabus?**  
Use the phase index and the Part file “Where this connects” sections; do not re-learn pool sizing here if Node Phase 6 already owns it.

---

← [Phase index](README.md) · Next → [list with filter sort page](02-list-endpoint.md)
