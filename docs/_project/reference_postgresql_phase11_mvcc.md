---
name: devbible-postgresql-phase11-mvcc
description: The measured dataset behind the 16 Phase 11 pages — which open transactions actually block VACUUM, HOT/fillfactor, the lost-update fixes compared, SERIALIZABLE vs row locks, lock matrix, DDL lock table
metadata:
  type: reference
---

# PostgreSQL Phase 11 (transactions, MVCC, concurrency) — measured findings

Landed session 5 (2026-08-12). All 16 pages rewritten from stamps, 170–224 lines each.
Scripts: `ex27-tx-basics.mjs`, `ex28-mvcc-isolation.mjs`, `ex29-locks.mjs`,
`ex30-vacuum-horizon.mjs` in `sandbox/pg-api/`.

Parent: [[devbible-postgresql-rewrite-handoff]]

## The results that contradicted the obvious expectation

- **An idle READ COMMITTED read-only transaction does NOT block VACUUM.** Measured per
  kind on 100k dead rows: `no other tx` and `idle RC read-only` → **100 000 removed, 0
  stuck, space reused**. `idle REPEATABLE READ`, `idle tx that WROTE`, and **a
  long-running SELECT still executing** → **0 removed, 100 000 not yet removable, file
  grew 27 MB → 40 MB**. The common "idle in transaction blocks vacuum" advice is only
  true for the write/RR/active cases. Under RC the snapshot lasts one statement, so
  `backend_xmin` is null between statements.
- **`pg_locks` is EMPTY for row locks.** They live in the tuple header, not the lock
  manager. Use `pg_blocking_pids()`. (The FK probe returned `[]` while the row was
  demonstrably locked.)
- **HOT updates need free page space, and the default forbids it.** 50k rows × 5 updates:
  fillfactor 100 → **0.1% HOT, 4 MB → 24 MB**; fillfactor 70 → **76.6% HOT, 13 MB**;
  fillfactor 70 + index on the updated column → **0% HOT**.
- **`pg_current_snapshot()` omits in-progress xids above `xmax`.** xmax is one past the
  last *completed* transaction, not the last assigned. `50181:50183:50181` only appeared
  once the YOUNGER transaction committed ahead of the older one. Sequence matters when
  demonstrating this.
- **SERIALIZABLE was 175× slower than ordered row locks** on the same 20 transfers over 2
  rows: 135 attempts / 115 retries / **12 419 ms** vs 20 attempts / 0 retries / **71 ms**
  (`SELECT … WHERE id IN … ORDER BY id FOR UPDATE`). Part of the 12.4 s is my
  `5ms × attempt` backoff — the page says so.
- **Batching beats turning durability off.** 500 single-row commits: sync on **1042 ms**,
  sync off **170 ms**, all 500 in ONE transaction with sync on **128 ms**.

## The four lost-update fixes, measured (20 concurrent, one row)

| Approach | Result | Time |
|---|---|---|
| SELECT then UPDATE (the bug) | **qty = 2** — 18 writes lost, no error | — |
| `SET qty = qty + 1` | 20 | **37.9 ms** |
| `SELECT … FOR UPDATE` then UPDATE | 20 | 58.0 ms |
| optimistic `version` column | 20, **170 retries** | 337.4 ms |
| REPEATABLE READ, no retry | qty = 1, **1 committed / 19 rejected** `40001` | — |

## Lock reference tables (both measured, safe to reuse)

Row lock conflict matrix (holder × requester, BLOCKS/ok):

```
                UPDATE  NO KEY UPDATE  SHARE  KEY SHARE
UPDATE          BLOCKS  BLOCKS         BLOCKS BLOCKS
NO KEY UPDATE   BLOCKS  BLOCKS         BLOCKS ok
SHARE           BLOCKS  BLOCKS         ok     ok
KEY SHARE       BLOCKS  ok             ok     ok
```

DDL on a 200k table, with a concurrent reader at `lock_timeout=300ms`:

- metadata-only, reads blocked but only for ms: ADD COLUMN 0.6, ADD COLUMN DEFAULT 7
  **2.0** (constant default is metadata since PG11), DROP COLUMN 1.0, CHECK NOT VALID 1.4
- rewrites: ADD COLUMN DEFAULT random() **319**, int→bigint **326**, int→text **345**
- `CREATE INDEX` **103.7 ms, ShareLock, reads OK** (writes blocked)

## Other numbers on the pages

- **SKIP LOCKED queue**, 8 workers / 200 jobs: `SKIP LOCKED` **168.6 ms, 0 dupes, 8
  workers used**; plain `FOR UPDATE` 499.0 ms, **only 3 workers used**; no locking
  **793 claims for 200 jobs = 593 duplicates**.
- **Deadlock**: opposite order → `40P01` after **1155 ms** (deadlock_timeout 1s); same
  order → both commit in 326 ms. Full `detail` captured in ex29 §8.
- **Savepoints**: 2000 inserts plain 599.8 ms vs **1362.5 ms** wrapped in
  SAVEPOINT/RELEASE (2.3×). Each writing savepoint **burns its own xid** (top 46128, rows
  xmin 46129–46132). `pg_stat_activity.backend_xid` shows only the top-level id.
- **Timeouts**: `idle_in_transaction_session_timeout` → **25P03**;
  `transaction_timeout` (PG17+) → **25P04**; `statement_timeout` does **nothing** to an
  idle transaction (600 ms idle, still alive). All arrive as `'error'` EVENTS and the
  next query fails with **no `err.code`**.
- **XIDs**: 200 autocommitted UPDATEs → **201 xids** (1.00/statement) at 147 xids/s;
  200 SELECTs → **0**. Sandbox at 0.0027% of the 2^31 budget.
- **VACUUM vs FULL**: 46 MB → delete half → 46 MB → VACUUM 46 MB → **VACUUM FULL 23 MB**
  (260 ms). Freed space IS reused: 40k fresh inserts stayed at 23 MB.
- **autovacuum trigger** = `50 + 0.2 × live`; measured 90 000 live → 18 050 dead.
- **One leaked transaction on a pool of 3**: three concurrent 300 ms queries took
  **603 ms** instead of ~300.

## Traps hit while measuring (cost several reruns)

- **`pg` does NOT reset session state on `release()`.** A `SET lock_timeout` / 
  `SET statement_timeout` from one section leaked into every later section and poisoned
  four of them — the deadlock demo died to `57014` before the 1s detector could fire.
  Fixed with a `conn()` helper doing `RESET ALL` on checkout. **This became a page fact**
  (ex29 §1b) — it is worth keeping in any future concurrency script.
- **PG 18 VACUUM VERBOSE wording**: `tuples: N removed, M remain, K are dead but not yet
  removable` + `removable cutoff: X`. The old "dead row versions cannot be removed yet"
  regex matches nothing.
- Stats (`n_dead_tup`, `n_live_tup`) lag badly — call `pg_stat_force_next_flush()` or use
  `count(*)`. Two draft claims were wrong because of this.
- Two of my own `console.log` narration lines asserted things the data contradicted (a
  false `backend_xmin` claim, and an xid burn rate with an assumed denominator). Caught
  before they reached a page. [[devbible-verify-your-own-measurements]] again.

Related: [[devbible-postgresql-rewrite-handoff]] · [[devbible-postgresql-phase10-indexes]] ·
[[devbible-verify-your-own-measurements]]
