---
name: devbible-postgresql-phase7-driver
description: The measured dataset behind PostgreSQL Phase 7 (the pg driver) — timeouts, prepared statements, type mapping, cursors, LISTEN/NOTIFY
metadata:
  type: reference
---

# PostgreSQL Phase 7 — the `pg` driver

Split out of [[devbible-postgresql-rewrite-handoff]] on 2026-08-13 to keep that file under
the 300-line memory cap ([[devbible-memory-file-cap]]). All measured on Node 24 / PG 18.4 via
`ex20-driver.mjs`, `ex21-types-prepared.mjs`, `ex22-notify-cursor-pgjs.mjs`
([[devbible-postgresql-sandbox]]).


- **`query_timeout` does NOT stop the server** — client rejects, statement stays `active`
  in `pg_stat_activity`. Only `statement_timeout` cancels (`57014`, connection reusable).
- **A `FATAL` arrives as an `'error'` EVENT, not a rejected promise.** Unhandled = process
  death. `pool.on('error')` is mandatory. (idle_in_transaction termination proved it.)
- **Named/prepared statements**: 2000 queries 772 ms unnamed → **481 ms named** (1.6×).
  **Per-session** — pid 1932 prepared it, pid 1933 saw 0. Custom plan ×5 then generic
  from the 6th (`custom_plans: 5, generic_plans: 4`). Breaks under PgBouncer txn pooling.
- **`SELECT *` across a join silently drops columns**: `fields` had `id,name,id,name`,
  row object had only `{id:99,name:'from_b'}`. `rowMode:'array'` keeps all four.
- **`rowCount` is `null` (not 0) for DDL.** Multi-statement returns an **array of Results**.
- **Multi-statement = one implicit transaction** — a valid INSERT rolled back when the
  second statement failed. `[]` as params still uses the simple protocol.
- **Type mapping**: int8/numeric → **string**; `date` → Date at **local midnight**;
  `timestamp` (no tz) → parsed as **local**; timestamptz correct; interval →
  `PostgresInterval` object; json/jsonb pre-parsed; bytea → Buffer.
- **`connectionString` beats explicit fields** — `{connectionString: …/devbible,
  database:'postgres'}` connected to devbible, silently.
- **`sslmode=require` currently means verify-full in pg 8.x**; pg 9 will switch to libpq
  semantics (weaker). Write `verify-full` explicitly.
- **pg-cursor vs buffered**: 300k rows → `pool.query` +101 MB (linear in rows);
  cursor peak +52 MB and **flat regardless of result size**.
- **NOTIFY**: delivered on COMMIT only, rolled back = never, 3 identical in one tx → 1
  delivered, payload cap 8000 bytes (`22023`). **No durability — hint, not a queue.**


Related: [[devbible-postgresql-rewrite-handoff]] · [[devbible-postgresql-sandbox]] · [[devbible-postgresql-phase2-types]]
