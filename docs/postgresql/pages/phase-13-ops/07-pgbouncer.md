---
title: "Connection limits and PgBouncer"
sidebar_label: "07 · PgBouncer"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

**PgBouncer transaction vs session pooling — LISTEN and session features break under transaction pooling.**

## Why it matters

`psql` is how you prove every later claim. Connection limits and PgBouncer is daily operator skill.

## How it works

PgBouncer transaction vs session pooling — LISTEN and session features break under transaction pooling.

Hold the model in your head before memorizing syntax.

## Ops surface

```bash
# Logical backup (practice restore into a scratch DB)
pg_dump -h 127.0.0.1 -p 55432 -U devbible -d devbible -Fc -f /tmp/devbible.dump
# pg_restore -h ... -d scratch --clean /tmp/devbible.dump
```

Never log connection strings. App role ≠ superuser.

## From Node

```js
// Fail closed on missing secrets
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL required');
const pool = new pg.Pool({ connectionString: url, ssl: /* provider docs */ undefined });
```

## Gotchas

**Symptom:** It works in a tutorial and fails in your app  
**Cause:** Different database, search_path, role, or missing parameters  
**Fix:** Reproduce in `psql` with the same role/database as the app, then match the `pg` call

**Symptom:** "It is slow" with no evidence  
**Cause:** Guessing  
**Fix:** `EXPLAIN (ANALYZE, BUFFERS)` for plans; `\timing` for shell latency; measure API time separately

## Interview questions

**★ What is the core idea of “Connection limits and PgBouncer”?**  
PgBouncer transaction vs session pooling — LISTEN and session features break under transaction pooling.

**★ How do you verify it?**  
Reproduce in `psql` on PostgreSQL 18, then issue the same statement from Node with `$1` parameters (or confirm it is intentionally shell-only).

**What breaks in production if you ignore this?**  
Wrong data, silent wrong results, pool exhaustion, or multi-second list endpoints — depending on the topic. Measure before guessing.

**How does this connect to the rest of the syllabus?**  
Use the phase index and the Part file “Where this connects” sections; do not re-learn pool sizing here if Node Phase 6 already owns it.

---

← [TLS to the database](06-tls.md) · Next → [Streaming replication replicas](08-replication.md)
