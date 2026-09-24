---
name: devbible-postgresql-phase9-api-crud
description: The measured dataset behind the 18 phase-9 API-CRUD pages — the propagation bug that half-commits, jsonb_agg losing to JS, the 6x lock-scope result, and the four measurements that had to be corrected before they shipped
metadata:
  type: reference
---

# PostgreSQL Phase 9 — CRUD patterns for a real API

Written in session 10 on branch `pg-phase9-api-crud`. 14 topics written (02, 03/,
04/, 09 already existed), **six new scripts `ex38`–`ex43`**. Phase now 24/24.

Parent: [[devbible-postgresql-rewrite-handoff]] · sandbox inventory:
[[devbible-postgresql-sandbox]]

## Four measurements that were wrong the first time

All four were caught by re-reading the output against the claim, which is
[[devbible-verify-your-own-measurements]] earning its place again.

1. **`ex39` §5 — the narration contradicted its own output.** "The INSERT survived
   a ROLLBACK" printed `orders=0`, i.e. it did not. With an idle pool and
   sequential awaits, all three `pool.query` calls reuse one connection (same pid
   3153) and the rollback works. Rewritten as two cases: sequential **looks
   correct**, and with 8 concurrent inserts **7 survive the ROLLBACK**. The
   "it appears to work" half is the more valuable finding.
2. **`ex39` §8 — read the wrong field of an interval.** `now() - xact_start` parses
   to an object; `.milliseconds` was 209 for a 1211 ms wait. Use
   `extract(epoch FROM ...)*1000`.
3. **`ex43` §3 — stats showed 0.** `pg_stat_user_tables` lags; a 600 ms sleep is not
   enough. Fix: do the updates and the reads **on one dedicated client** and call
   `pg_stat_force_next_flush()`, which only flushes its own backend.
4. **`ex42` §7 — the assertion could not detect the interference it claimed.** Two
   parallel truncate-based test files both saw 1 row, so a count assertion passed.
   Asserting on the row's *identity* showed file A seeing file B's row. That is
   also why this is diagnosed as flakiness in real suites.

## Findings worth reusing

### The propagation bug (topics 05, 12) — `ex39`

- A service handed **`pool` instead of the transaction's `client`** → after
  `ROLLBACK`, **`orders=0 items=1`**. Half the request committed, **no error**.
- Proof they are separate sessions: backend pids **3150 vs 3151**; the
  transaction's own backend reads `idle in transaction`.
- `pool.query('BEGIN')`: sequential **orders=0** (looks fine, same pid); with 8
  concurrent inserts **orders=7** survive the ROLLBACK.
- Skipping `ROLLBACK TO` after an error → next query is `25P02`.
- `SAVEPOINT` recovery after `23502` → outer commit still succeeds, and **both**
  item inserts were undone (rewinds to the savepoint, not to the failing statement).
- A 1240 ms external call inside a transaction held it open **1223 ms**.

### The repository (topics 01, 06, 07) — `ex38`

- `Pool` and `Client` are interchangeable: **`BoundPool` / `Client`**, identical
  result shape from one function body.
- Missing row = `rowCount 0`, `rows []`, `rows[0] undefined`, **no throw**.
- Types: bigint identity → **`String`**, int → `Number`, timestamptz → `Date`.
- **Full SQLSTATE table produced for real**: `23505` (constraint
  `r_users_email_key`), `23503`, `23514`, `23502`, `22P02`, `42703`, `22003`.
  **`constraint` is populated only for the 23xxx family; `column` only for 23502.**
- `err.detail` echoes the submitted value (`Key (email)=(ada@x.com) already
  exists.`) and for `23514` is **the entire failing row**. `err.constraint` is the
  safe switch.
- Leak with `max: 2`: call 3 fails **after 1501 ms**, and **`pool.end()` never
  resolves** while a client is stranded (still pending at 2000 ms).
- `release()` preserves `statement_timeout` **and TEMP tables**; `release(true)`
  resets.

### Concurrency at the API level (topics 11, 13, 14) — `ex40`

- Unguarded read-modify-write, 2 requests: balance **120, not 130**, both "ok".
- Version column → `rowCount 0` refusal; final `{balance: 110, version: 2}`.
- **`rowCount 0` is ambiguous** — missing row and stale version are identical. One
  is 404, the other 409; needs a second SELECT.
- Retry loop: 3 racers resolve on attempts 1/2/3 → correct 160.
- **Lock scope: 8 concurrent × 100 ms work — lock held across the work 863 ms vs
  lock taken only to write 143 ms = 6.0x.**
- `NOWAIT` and `lock_timeout` both give **`55P03`** (different messages; timeout at
  302 ms). `SKIP LOCKED` returns **0 rows** for a locked point lookup.
- `ON CONFLICT DO NOTHING ... RETURNING` → **`rowCount 0` on the replay**, so the
  handler has no row to answer with. `DO UPDATE SET key = EXCLUDED.key` returns the
  original row; **`(xmax = 0) AS was_inserted`** tells create from replay.
- 10 racing POSTs: **inserted=1 replays=9 errors=0**, 1 row. Same race on a plain
  INSERT: **1 success, 9× `23505`** — the unique index is the correctness
  mechanism, `ON CONFLICT` only chooses the response.

### Shaping and mapping (topics 15, 17, 18) — `ex41`

- **Shaping in SQL was SLOWER**: jsonb_agg **284.8 ms** vs flat join + JS **90.7 ms**
  vs two queries + JS **103.3 ms** vs N+1 **298.6 ms per 500 orders** (2986 ms
  extrapolated to 5000).
- Isolated properly: `ORDER BY` inside the aggregate costs only ~35 ms;
  **`json_agg` is 131.2 ms vs `jsonb_agg` 284.8 ms** (the binary parse is the
  cost); `EXPLAIN` execution **232 ms vs 36 ms**, so it is server CPU not transfer;
  jsonb payload **2,000,000 bytes vs 1,225,000** despite 5× fewer rows.
- jsonb **reorders keys** (`qty` before `sku`).
- Empty children: plain `jsonb_agg` → **`[{"sku":null}]`**; `FILTER` + `coalesce`
  → `[]`. Both halves needed or you get `null`.
- Through jsonb: numeric → JSON **number** (`'11.00'` becomes `11`), timestamptz →
  string. As columns: numeric stays a **string**, timestamptz is a **Date**.
- Trigger vs app `updated_at`: an UPDATE that never mentions the column moves the
  trigger's stamp and **not** the app-managed one. Trigger overhead **1.23–1.29x**
  (328.9 vs 266.8 ms over 20 000 updates).
- `now()` constant across a transaction; `clock_timestamp()` moved **303 ms**.
- Rename cost over 20 000 rows: alias in SQL **33.2 ms**, explicit JS map
  **31.6 ms**, generic key-rewriter **75.3 ms** (2.3×). A quoted alias is
  unreferencable unquoted afterwards → **`42703 column "customername" does not
  exist`**.

### Testing (topic 16) — `ex42`

- Per-test BEGIN/ROLLBACK isolates cleanly; test 2 reinserts the same email with no
  `23505`.
- **Sequences are not rolled back** — `last_value` 2002 → 2003 after a rolled-back
  insert. Never assert on a literal id.
- Uncommitted test data is **invisible to any other pool connection** (test client
  1, pool 0) — so a repository that grabs its own connection finds an empty
  database, which makes the harness enforce the executor contract.
- Code issuing its own `BEGIN/COMMIT` **commits the test's transaction**; 1 row
  survived. Remapping BEGIN/COMMIT/ROLLBACK to SAVEPOINT/RELEASE/ROLLBACK TO → 0.
- Reset cost, 2000 seed rows: **rollback 1.66 ms vs TRUNCATE+reseed 42.50 ms vs
  DELETE+reseed 41.69 ms (25×)**. `CREATE DATABASE ... TEMPLATE` **156 ms**.

### Partial updates and keyset (topics 08, 10) — `ex43`

- `COALESCE($n, col)` **cannot clear a field** — absent and explicit null are the
  same value in JS.
- **HOT is decided by values, not by the SET clause**: COALESCE form naming the
  indexed column but keeping its value → **HOT 1090**; single unindexed column →
  **HOT 1096**; the indexed column actually changing → **HOT 0** of 2500.
- A no-op `SET city = city` still reports `rowCount 1` and makes a dead tuple;
  `AND col IS DISTINCT FROM $n` → `rowCount 0`, now ambiguous with "not found".
- jsonb merge: `data || '{"k":null}'` stores a JSON null; removal needs `data - 'k'`.
- **OFFSET 499980 → 295.87 ms / 501 918 buffers; keyset at the same depth →
  1.23 ms / 23 buffers.**
- **Row constructor `(a,b) < ($1,$2)` 0.99 ms (`Index Cond`) vs the expanded OR
  form 158.12 ms (`Filter`, `Rows Removed by Filter: 250001`)** — same rows, 160×.
- Page walking: **50 pages keyset 62 ms vs OFFSET 55 ms (0.9× — OFFSET wins
  shallow)**; 500 pages 382 vs 2430 (6.4×); 2000 pages 1779 vs 10524 (5.9×).
- Mixed directions: the tuple form against `ORDER BY a DESC, b ASC` returns
  **plausible but wrong rows**, no error.
- Nullable sort column: the comparison matched **250 000 of 500 000** — every NULL
  row silently excluded after page 1.

## Layout note

Topics **01, 05 and 10 became chunked directories**; 11 remain single files, all
under 300 lines. Build clean at **658 HTML pages** (651 + 7 = the exact chunk
arithmetic).

Related: [[devbible-postgresql-rewrite-handoff]] · [[devbible-postgresql-sandbox]] ·
[[devbible-verify-your-own-measurements]] · [[devbible-never-compress-to-fit-cap]]
