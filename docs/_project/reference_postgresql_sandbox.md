---
name: devbible-postgresql-sandbox
description: The PostgreSQL sandbox at sandbox/pg-api — container setup, connection facts, and what each of the 67 ex*.mjs / ex*.sh scripts covers
metadata:
  type: reference
---

# PostgreSQL sandbox — `sandbox/pg-api/`

Split out of [[devbible-postgresql-rewrite-handoff]] on 2026-08-13 when that file passed the
300-line memory cap ([[devbible-memory-file-cap]]). Open this when you need to know **whether
a measurement already exists** before writing a new script — the house rule is never to
re-run what is already on a page.

✅ **The scripts are committed to the devbible repo** as of 2026-08-13 (session 10) —
`sandbox/` was removed from `.gitignore` on the user's instruction, so a reviewer can
re-run whatever a page's `> Verified:` line names. Ignored: `**/node_modules/`,
`**/.stryker-tmp/`, `**/*.log`. Lockfiles kept, so a re-run pins the same versions.


npm project: `pg` 8.23.0, `pg-copy-streams` 7.0.0, `pg-cursor` 2.22.0, `postgres` 3.4.9.
Container: `podman start devbible-pg` → **PG 18.4 on `127.0.0.1:55432`**, user/db/pass
all `devbible`.

⚠️ **Correction (session 3): the old "never `localhost`" rule no longer reproduces.**
Measured — `127.0.0.1`, `::1` and `localhost` all connect. Node 24 has
`autoSelectFamily` on by default so it tries both families, and the container accepts on
both. Still *prefer* `127.0.0.1` in config (no resolver-order dependency), but a failure
to connect is no longer explained by this.
A second Debian/glibc container `devbible-pg-glibc` on **:55433** exists (stopped) —
only needed for the collation comparison.

✅ **`devbible-pg-vector` on :55434** — `docker.io/pgvector/pgvector:pg18`, PG 18.4
(Debian), **pgvector 0.8.6**. Created 2026-08-13 because `vector` is **absent** from
`postgres:18-alpine`, not merely uninstalled. Same credentials. Only `ex48` uses it.

✅ **`devbible-mysql` on :55440** — `docker.io/library/mysql:8`, **MySQL 8.4.11**.
Created 2026-08-13 for phase-0 topic 11's three-way comparison. Same credentials
(`devbible`), plus `MYSQL_ROOT_PASSWORD=devbible`. Takes **~30 s** to become ready;
poll with `podman exec devbible-mysql mysqladmin ping -udevbible -pdevbible`. Only
`ex57` uses it.

```bash
podman run -d --name devbible-mysql -e MYSQL_ROOT_PASSWORD=devbible \
  -e MYSQL_DATABASE=devbible -e MYSQL_USER=devbible -e MYSQL_PASSWORD=devbible \
  -p 55440:3306 docker.io/library/mysql:8
```

**SQLite needs no container** — `node:sqlite` is built into Node 24 (SQLite **3.53.3**).

⚠️ **`psql -c` batching trap, cost a wrong measurement 2026-08-13.** Several statements
in one `psql -c` run inside a **single implicit transaction**, so an embedded `ROLLBACK`
discards the earlier statements too. A sequence-gap comparison appeared to show
PostgreSQL and MySQL differing when they do not. **One statement per `-c`** whenever
transaction boundaries are what you are measuring.

Machine `TZ` is **Asia/Calcutta (+5:30)**, server `TimeZone` is **UTC**. That gap is what
makes the `date` trap reproduce; keep it in mind when reading any date output.

**Scripts added 2026-08-13 (session 12):**

| Script | Covers |
|---|---|
| **`ex55-merge-returning.mjs`** | **`MERGE … RETURNING` works on PG18** — the page said 7× it does not. `merge_action()` per row; `42601` outside a MERGE; PG18 `old.`/`new.` aliases (`old.qty` null on INSERT); **`RETURNING` on the DELETE branch yields the PRE-state**; `WHEN NOT MATCHED BY SOURCE` (PG17); command tag carries no per-action split |
| **`ex56-vs-sqlite.mjs`** | PG vs **SQLite via `node:sqlite`**, no container: type affinity (text in an `integer` column), `varchar(3)` holding 8 chars, **both roll back DDL**, identifier folding, one-writer lock (`database is locked`), and the driver split — `pg` returns bigint as a **string**, `node:sqlite` **throws** |
| **`ex57-vs-mysql.sh`** | PG vs **MySQL 8.4.11**: **MySQL cannot roll back `CREATE TABLE`**, both strict on overflow (1264/1406), isolation **read committed vs REPEATABLE-READ**, `MixedCol` preserved vs folded, `only_full_group_by` on both, `UPDATE … ORDER BY … LIMIT` MySQL-only, `RETURNING` PG-only, `BOOLEAN` = `tinyint(1)`, CHECK enforced on both, **sequence gaps identical** |

**Full inventory:**

| Script | Covers |
|---|---|
| `ex1-ddl-from-node.mjs` | DDL via pg, `$1` in identifier slot, transactional rollback |
| `ex2-ddl-edges.mjs` | **protocol switch on params** (`42601`); `IF NOT EXISTS` race 228/500 |
| `ex3-advisory-fix.mjs` | same race + advisory lock → 500/500 clean |
| `ex4-soft-delete.mjs` | hard vs soft delete, partial unique index, partial-index plans |
| `ex5-filter-sort.mjs` | `ORDER BY $1` no-op, identifier injection, dynamic WHERE, ILIKE wildcards, NULL ordering, **tie/pagination instability** |
| `ex6-collation.mjs` | collation providers; musl vs glibc ordering |
| `ex7-ddl-locks.mjs` | lock modes, ADD COLUMN rewrite, lock-queue pile-up |
| `ex8-bulk-and-seed.mjs` | bulk-load 5 ways, **65535 param ceiling**, identity burn, reset strategies |
| `ex9-bulk-at-scale.mjs` | unnest vs COPY at 10k/100k/500k |
| `ex10-migrations.mjs` | migration runner: idempotent, atomic, checksum, drift |
| `ex11-ddl-alter.mjs` | ALTER TABLE rewrite table, NOT NULL safely, identity vs serial |
| `ex12-ddl-rest.mjs` | 5 ON DELETE actions, unindexed FK, search_path, generated cols |
| `ex13-constraints-rel.mjs` | CHECK on NULL, DEFAULT eval time, 1-1/1-N/N-N, TEMP/UNLOGGED |
| `ex14-crud.mjs` | Phase 4 core: NULL predicates, RETURNING, ON CONFLICT, DISTINCT ON, MERGE, expressions, strings, dates, series, tuples, TRUNCATE |
| **`ex15-pagination.mjs`** | **NEW** — deep-OFFSET scaling, keyset comparison, count(\*) cost, OFFSET drift, LIMIT without ORDER BY |
| **`ex16-returning.mjs`** | **NEW** — RETURNING on all DML, **PG18 `old.`/`new.`**, DO NOTHING trap, CTE chaining |
| **`ex17-update.mjs`** | **NEW** — no-WHERE, UPDATE…FROM, duplicate-source, **lost update 20→2**, PATCH via COALESCE |
| **`ex18-delete.mjs`** | **NEW** — DELETE…USING, 4 FK actions, ctid batching, dead tuples vs VACUUM |
| `ex19-series-values.mjs` | gap filling, **date→JS trap + both fixes**, step args, WITH ORDINALITY, unnest bulk bridge |
| **`ex20-driver.mjs`** | **NEW** — connection-string parse, lazy connect, **the full pg error object per SQLSTATE**, Result shape, `SELECT *` join column collapse, connect/release counters, `pool.end`, config precedence |
| **`ex21-types-prepared.mjs`** | **NEW** — **full type→JS mapping table**, bigint precision, `setTypeParser`, **named statements + generic-plan switch**, all five timeouts, multi-statement |
| `ex22-notify-cursor-pgjs.mjs` | LISTEN/NOTIFY (commit-only delivery, dedup, 8000-byte cap), pg-cursor vs buffered heap, `postgres.js` comparison |
| **`ex23-index-basics.mjs`** | **NEW** — write cost, B-tree reach, `text_pattern_ops`, EXPLAIN vs ANALYZE, seq/index/bitmap forced three ways, index size |
| **`ex24-index-not-used.mjs`** | **NEW** — the five reasons an index is skipped, cast-side contrast, stale stats, leftmost prefix, **PG 18 skip scan**, BUFFERS |
| **`ex25-index-kinds.mjs`** | **NEW** — index-only + visibility map + INCLUDE, partial, expression + IMMUTABLE probe loop, GIN `jsonb_ops` vs `jsonb_path_ops`, `pg_trgm` |
| **`ex26-index-ops.mjs`** | CONCURRENTLY + `indisvalid`, `pg_stat_user_indexes` (+ the stats-lag demo), `pg_stat_statements`, GiST/BRIN/hash, `CREATE STATISTICS`, bloat/REINDEX, **FK-without-index finder** |
| **`ex27-tx-basics.mjs`** | **NEW** — atomicity, DEFERRABLE constraints, WAL/`synchronous_commit` cost, **the pool-`BEGIN` bug shown failing**, `25P02`, stray BEGIN/ROLLBACK warnings, RC anomalies, per-statement snapshot, UPDATE re-check, savepoints + their cost/xids |
| **`ex28-mvcc-isolation.mjs`** | **NEW** — xmin/xmax/ctid, readers vs writers, `pg_current_snapshot()`, **HOT vs fillfactor**, the **four lost-update fixes**, REPEATABLE READ, **write skew**, SERIALIZABLE retry vs ordered `FOR UPDATE` |
| **`ex29-locks.mjs`** | **NEW** — **row lock conflict matrix**, `SET` leaking across `release()`, NOWAIT/SKIP LOCKED, `lock_timeout` vs `statement_timeout`, FK `FOR KEY SHARE`, **SKIP LOCKED queue 3 ways**, **DDL lock table**, lock-queue pile-up, deadlock + full error object, advisory locks |
| **`ex33-types-core.mjs`** | **NEW** — int widths + `2200H` sequence exhaustion, numeric vs float (the 0.01x1000 drift), text/varchar/char, timestamptz vs timestamp + session-zone GROUP BY, NULL three-valued logic, **uuid v4 vs v7 insert/index cost**, json vs jsonb + GIN |
| **`ex34-types-more.mjs`** | **NEW** — boolean/date/interval calendar rules, arrays + GIN (and `= ANY` not using it), **enum vs CHECK vs lookup change costs**, the 241x column cast, bytea + TOAST, inet/cidr/citext, domains + composites, ranges + exclusion constraints + multiranges |
| **`ex35-joins.mjs`** | **NEW (session 6)** — inner/left/outer/cross joins, fan-out 450-vs-350, the `ON`-vs-`WHERE` bug, semi/anti plans + **the `NOT IN` NULL trap**, N-N `array_agg`, NATURAL failing on a shared `created_at`, self join + recursive CTE, **LATERAL top-N (with the confounded benchmark and its correction)**, UNION vs UNION ALL, alias errors, range join, expression index |
| **`ex31-psql-basics.sh`** | **NEW, shell** — connect 3 ways + 4 failure messages, the `\d` family, `\d`/`\d+` in full, output control, `\?`/`\h`, scripting + exit codes, the query buffer, **psql variables and the `-c` trap** |
| **`ex32-psql-io.sh`** | **NEW, shell** — `COPY` vs `\copy`, `\timing` vs EXPLAIN, `\watch`, `\i` vs `\ir`, roles/`\dp`/a real restricted role, `.psqlrc` vs `-X`, `\errverbose` + **9 SQLSTATEs produced for real**, piping and `\gexec` |
| **`ex36-aggregation.mjs`** | **NEW (session 8)** — phase 6 topics 01-08: GROUP BY/NULL semantics, the three counts, HAVING, FILTER, array/string/jsonb aggregates, window basics, ranking, lag/lead. **Also seeds `agg_events`, 500k rows** |
| **`ex36b-agg-plans.mjs`** | **NEW** — full `EXPLAIN (ANALYZE, BUFFERS)` for every plan the phase-6 pages quote, in **two parts: without and with `agg_ev_user_amt`**, because the index state changes the answer. Caps the pathological LATERAL with a 30 s `statement_timeout` |
| **`ex36c-agg-checks.mjs`** | **NEW** — driver types for uncast aggregates, one-row-vs-zero-rows, `NULL` grouping keys, the three day renderings, `GROUP BY` vs `DISTINCT`, ordinal/alias legality |
| **`ex36d-count-having.mjs`** | **NEW** — `count(*)`/`count(1)`/`count(col)`, `count(DISTINCT (a,b))`, fan-out vs `count(DISTINCT)`, FILTER-vs-CASE on empty sets, the **HAVING pushdown plans** |
| **`ex36e-shaping.mjs`** | **NEW** — `string_agg`/`array_agg` NULL divergence, **the sibling-aggregate sort inheritance**, json vs jsonb round trip, the `[null]` → `null` → `[]` sequence, a two-level payload |
| **`ex37-cte-subquery.mjs`** | phase 6 topics 09-16: CTE inlining vs MATERIALIZED, data-modifying CTEs and snapshot visibility, correlated subqueries, pagination counting, ordered-set aggregates, frames, recursive CTEs + CYCLE/SEARCH, GROUPING SETS/ROLLUP/CUBE. **Mutates the phase-6 fixture — run it after `ex36`, before `ex37b`.** Several of its narration lines overstate what its own queries prove — the `ex37b`–`ex37g` scripts below exist for exactly that reason |
| **`ex37b-cte-inlining.mjs`** | **NEW (s9)** — what actually decides CTE inlining, one variable at a time, verdict read off the plan (`CTE <name>` node present or not); volatility isolated properly; `NOT MATERIALIZED` ignored for volatile; `OFFSET 0` still fencing; CTE scope, shadowing, forward references, column aliases |
| **`ex37c-correlated-cost.mjs`** | **NEW (s9)** — correlated subquery vs `GROUP BY` with the **visibility map controlled**: measures after `VACUUM` and again after dirtying 1 row in 500. Written because two `ex37` runs of the same query differed 6.5× |
| **`ex37d-pagination-counts.mjs`** | **NEW (s9)** — exact count vs page vs `limit+1` vs `count(*) OVER ()`, planner estimate, `reltuples`, and the capped count with **both** branches (`ex37`'s "rare" filter was not rare) |
| **`ex37e-ordered-set-checks.mjs`** | **NEW (s9)** — proves `mode()` reports a sort order on tied input (reversing `ORDER BY` flips the winner), `every()` = `bool_and`, `percentile_disc(0/1)` = `min`/`max` |
| **`ex37f-frame-extras.mjs`** | **NEW (s9)** — all four `EXCLUDE` options side by side, running-total spellings, partition-boundary clipping, frame errors (`42P20`, `22013`, `0A000`), and a frame on `row_number()` being **accepted and ignored**. Rebuilds `agg_tick` so it stands alone |
| **`ex37g-grouping-sets-cost.mjs`** | **NEW (s9)** — like-for-like grouping sets vs separate `GROUP BY`s (same three sets), set counts per form, and the plans showing **grouping sets are not parallelised** |
| **`ex38-repository.mjs`** | **NEW (s10)** — phase 9 topics 01/06/07: Pool vs Client interchangeable, the missing-row result, bigint→String, **the full SQLSTATE table caused for real** (23505/23503/23514/23502/22P02/42703/22003 with constraint/detail/table/column), what `err.detail` leaks, the `max:2` leak (**and `pool.end()` never resolving**), what survives `release()` |
| **`ex39-tx-request.mjs`** | **NEW (s10)** — phase 9 topics 05/12: the try/catch/finally shape, **the service handed the pool → `orders=0 items=1`**, backend-pid proof, `pool.query('BEGIN')` sequential-vs-concurrent (7 of 8 survive a ROLLBACK), SAVEPOINT recovery, `25P02`, a 1223 ms idle-in-transaction. **Read intervals with `extract(epoch …)`, not `.milliseconds`** |
| **`ex40-api-concurrency.mjs`** | **NEW (s10)** — phase 9 topics 11/13/14: lost update 120-not-130, version column + the **ambiguous `rowCount 0`**, retry loop, **lock scope 863 vs 143 ms (6.0×)**, NOWAIT/SKIP LOCKED/`lock_timeout` (all `55P03`), the idempotency ladder ending at 10 racing POSTs → inserted=1 replays=9 |
| **`ex41-shaping-mapping.mjs`** | **NEW (s10)** — phase 9 topics 15/17/18: **jsonb_agg 284.8 ms vs flat join + JS 90.7 ms**, isolated against `json_agg` (131.2) / server-side EXPLAIN (232 vs 36) / payload bytes (2.0 vs 1.2 MB), the `[{"sku":null}]` trap, trigger-vs-app `updated_at`, `now()` vs `clock_timestamp()`, the three rename sites |
| **`ex42-testing-rollback.mjs`** | **NEW (s10)** — phase 9 topic 16: per-test rollback, **sequences not rolled back**, uncommitted data invisible to the pool, code that commits the test's transaction (+ the savepoint wrapper), reset costs **1.66 vs 42.50 ms**, `CREATE DATABASE … TEMPLATE` 156 ms, parallel truncate interference **a row-count assertion does not catch** |
| **`ex43-keyset-patch.mjs`** | **NEW (s10)** — phase 9 topics 08/10: COALESCE cannot clear a field, **HOT decided by values not by the SET clause** (1090/1096 vs 0), the no-op update, jsonb merge; then **OFFSET 295.87 vs keyset 1.23 ms**, **row constructor 0.99 vs expanded OR 158.12 ms** (`Index Cond` vs `Filter`), the shallow-paging crossover, mixed directions returning wrong rows, a nullable key excluding half the table |
| **`ex44-jsonb-ops.mjs`** | **NEW (s10)** — phase 12 topics 01–04: the full operator set on one document, missing-key vs JSON-null vs SQL NULL, **GIN `jsonb_ops` vs `jsonb_path_ops` vs an expression index** (containment 4.5 vs 1.1 ms; `->>` equality unserved by GIN at 35.4 ms vs 0.9 ms with an expression index; sizes 17 MB / 13 MB / 1352 kB), column-vs-jsonb (storage 22 MB vs 1736 kB, range query seq-scans), constraints (CHECK works, **FK impossible — `42601`**), and the JSON constructors |
| **`ex45-search.mjs`** | **NEW (s10)** — phase 12 topics 05–06: `to_tsvector` english-vs-simple (stemming, stop words), **the four query parsers and `to_tsquery` raising `42601` on ordinary user text**, the `42P17` IMMUTABLE trap, expression index vs generated tsvector column (1165 → 17 ms; both 13 MB), weights/`ts_rank`/`ts_rank_cd`/`ts_headline`, prefix `:*`; then trigrams — **`%` compares WHOLE strings (0.273 vs word_similarity 1.000, so 0 rows vs 13336)**, `ILIKE '%x%'` 87 → 1.13 ms with `gin_trgm_ops`, **`ORDER BY <->` needs GiST** (GIN seq-scans), and the FTS-vs-trigram matrix with a **threshold sweep showing the default 0.6 misses a one-character typo** |
| **`ex46-views-triggers.mjs`** | **NEW (s10)** — phase 12 topics 07/08/11: view expansion and **predicate pushdown failing on an aggregate filter (0.8 vs 135.8 ms)**, `42P02` no parameters, updatable views + `WITH CHECK OPTION` (`44000`), `2BP01` dependencies; **AFTER-trigger assignment to NEW silently discarded**, row-vs-statement firing (1000 vs 1, and statement fires on 0 rows), **per-arm rebuilt cost benchmark** (statement free, row 1.24×, WHEN 0.86×), `RETURN NULL` dropping rows, alphabetical firing order; matviews — **CONCURRENTLY needs a unique index (`55000`) and is 1.6× slower**, plain REFRESH blocked a reader 32 ms vs 2 ms, staleness, `WITH NO DATA` |
| **`ex47-functions.mjs`** | **NEW (s10)** — phase 12 topics 10/12/15, **deliberately small** (only what `ex19`/`ex8`/`ex9`/`ex44`/`ex46` do not already cover): **`LANGUAGE sql` inlines and `plpgsql` does not — but the TIMES ARE THE SAME (1.13 vs 0.98 ms); the difference is the planner's row estimate, 60 vs a fixed 1000**; `VOLATILE` blocks inlining on an identical body; `IMMUTABLE` folded to a constant in the plan; two SRFs in a `SELECT` list run in lockstep padded with NULL; `ROWS FROM`; SRF in `WHERE` → `0A000`; procedure `COMMIT`s mid-body, function → `2D000`, **`CALL` inside an explicit transaction → `2D000` too**, `SELECT` a procedure → `42809` |
| **`ex48-extensions-partitioning.mjs`** | **NEW (s10)** — phase 12 topics 09/14/16/17. Extensions: available-vs-installed (60 in the image), **per-DATABASE not per-cluster (`42883` in a fresh one)**, 37 objects from `CREATE EXTENSION pgcrypto`, `2BP01` on drop + the query that finds the blocker. Partitioning: **pruning is only ~2× (15.6 vs 32.9 ms)** but **DROP of a 103k-row partition is 10 ms** and DETACH 5 ms; `23514` with no default; partition-key UPDATE moves the row. FDW: **2.9 ms fully pushed down vs 41.9 ms when a volatile predicate forces rows across** — read the `Remote SQL` line; **no two-phase commit**. pgvector (on :55434): `<->`/`<=>`/`<#>`, **exact 88 ms → HNSW 2.1 ms (42×)**, build **22.9 s**, index **98 MB vs a 78 MB table**, recall 10/10 at every `ef_search` **on clustered data**, `54000` past 2000 dims |
| **`ex49-notify-server-side.mjs`** | **NEW (s10)** — phase 12 topic 13, the SERVER side only (driver mechanics are `ex22`/phase 7): `pg_notify` from a trigger with `TG_OP`; **500 rows → 500 notifications from a ROW trigger vs 1 from a STATEMENT trigger**; **`NOTIFY` folds an unquoted channel, `pg_notify()` does not** and is the only form taking a computed channel; the 8 GB queue reported **0.000000% even after 2000 notifications** (so filling it was NOT demonstrated — the page says so); a notification sent while nobody listened is **discarded with no replay** |
| **`ex30-vacuum-horizon.mjs`** | **NEW** — **which transaction kinds block VACUUM**, VACUUM vs FULL vs reuse, finding long transactions, the three idle timeouts (`25P03`/`25P04`), pool cost of a leak, autovacuum thresholds, freezing and XID age, the monitoring queries |


Related: [[devbible-postgresql-rewrite-handoff]] · [[devbible-postgresql-review-remediation]]
