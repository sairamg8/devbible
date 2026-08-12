---
title: "psql variables"
sidebar_label: "08 · psql variables"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

**:var interpolation traps.**

## Why it matters

`psql` is how you prove every later claim. psql variables is daily operator skill.

## How it works

:var interpolation traps.

Hold the model in your head before memorizing syntax.

## In SQL / psql

```sql
-- run in psql against the sandbox database
SELECT current_setting('server_version') AS version;
```

```console
$ psql -h 127.0.0.1 -p 55432 -U devbible -d devbible -c "show server_version;"
 server_version
----------------
 18.4
```

## From Node

```js
import pg from 'pg';

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://devbible:devbible@127.0.0.1:55432/devbible',
});

// Prefer $1 placeholders — never concatenate user input into SQL.
const {rows} = await pool.query('select $1::text as topic', ['psql variables']);
console.log(rows[0]);
await pool.end();
```

```console
$ node example.mjs
{ topic: 'psql variables' }
```

## Gotchas

**Symptom:** It works in a tutorial and fails in your app  
**Cause:** Different database, search_path, role, or missing parameters  
**Fix:** Reproduce in `psql` with the same role/database as the app, then match the `pg` call

**Symptom:** "It is slow" with no evidence  
**Cause:** Guessing  
**Fix:** `EXPLAIN (ANALYZE, BUFFERS)` for plans; `\timing` for shell latency; measure API time separately

## Interview questions

**★ What is the core idea of “psql variables”?**  
:var interpolation traps.

**★ How do you verify it?**  
Reproduce in `psql` on PostgreSQL 18, then issue the same statement from Node with `$1` parameters (or confirm it is intentionally shell-only).

**What breaks in production if you ignore this?**  
Wrong data, silent wrong results, pool exhaustion, or multi-second list endpoints — depending on the topic. Measure before guessing.

**How does this connect to the rest of the syllabus?**  
Use the phase index and the Part file “Where this connects” sections; do not re-learn pool sizing here if Node Phase 6 already owns it.

---

← [Query buffer and editor](07-query-buffer.md) · Next → [\copy vs COPY](09-copy.md)
