---
title: "PostgreSQL vs MySQL vs SQLite"
sidebar_label: "11 · vs other databases"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

**Pick the engine for the job.**

## Why it matters

This topic exists because fullstack backends hit it in real schemas, queries, or Node drivers — not as trivia.

## How it works

Pick the engine for the job.

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
const {rows} = await pool.query('select $1::text as topic', ['PostgreSQL vs MySQL vs SQLite']);
console.log(rows[0]);
await pool.end();
```

```console
$ node example.mjs
{ topic: 'PostgreSQL vs MySQL vs SQLite' }
```

## Gotchas

**Symptom:** It works in a tutorial and fails in your app  
**Cause:** Different database, search_path, role, or missing parameters  
**Fix:** Reproduce in `psql` with the same role/database as the app, then match the `pg` call

**Symptom:** "It is slow" with no evidence  
**Cause:** Guessing  
**Fix:** `EXPLAIN (ANALYZE, BUFFERS)` for plans; `\timing` for shell latency; measure API time separately

## Interview questions

**★ What is the core idea of “PostgreSQL vs MySQL vs SQLite”?**  
Pick the engine for the job.

**★ How do you verify it?**  
Reproduce in `psql` on PostgreSQL 18, then issue the same statement from Node with `$1` parameters (or confirm it is intentionally shell-only).

**What breaks in production if you ignore this?**  
Wrong data, silent wrong results, pool exhaustion, or multi-second list endpoints — depending on the topic. Measure before guessing.

**How does this connect to the rest of the syllabus?**  
Use the phase index and the Part file “Where this connects” sections; do not re-learn pool sizing here if Node Phase 6 already owns it.

---

← [Version policy](10-version-policy.md) · Next → [Templates](12-templates.md)
