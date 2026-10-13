---
title: "Link map · PostgreSQL · Part 4 (phases 10–11)"
sidebar_label: "04 · Indexes and MVCC (10–11)"
sidebar_position: 5
---

# Link map · PostgreSQL · Part 4 — Indexes and the query planner, Transactions and MVCC (phases 10–11)

Covers every topic row of phases 10 and 11 in `docs/postgresql/syllabus/04-performance-and-production.md`: T10-01 to T10-18 (Indexes and the query planner) and T11-01 to T11-16 (Transactions, MVCC and concurrency). **All 34 rows have a page of ours (✅).** The phase 10 page files are numbered differently from the syllabus rows: row 6 (foreign keys) is `18-fk-indexes.md`, and rows 7 to 18 are files 06 to 17.
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry the date the page shows. No `#anchors` are given.

🔴 **Version note.** postgresql.org/docs/current served **PostgreSQL 18.6** in the page footer on 2026-10-12 (the pages also show a banner for the 19 beta); our syllabus says **18.4**, minor drift only. Official pages show no date, so only the fetch date is given. `github.com` is not used here. The `pg` driver docs are at node-postgres.com.

---

## Phase 10 — Indexes and the query planner

### T10-01 · What an index is, and its write cost — Master · ✅ written `docs/postgresql/pages/phase-10-indexes/01-what-index.md`
- **Read this (1/2):** [11.1 Introduction (Indexes)](https://www.postgresql.org/docs/current/indexes-intro.html) · postgresql.org · the book-index analogy, and that the planner uses an index only when it thinks it is cheaper than a sequential scan (*read*) · covers our angle: **partial** — only says the system updates the index when the table changes, with no write-cost discussion · fetched 2026-10-12
- **Read this (2/2):** [Over-indexing](https://postgres.ai/docs/postgres-howtos/performance-optimization/indexing/over-indexing) · postgres.ai · each new row version from INSERT or UPDATE must update every index; HOT updates can skip it for UPDATEs (*read* the first section); page shows no date · fetched 2026-10-12
- **Our delta:** the write-cost number must be measured on our own table; neither page gives one for our schema.

### T10-02 · B-tree — Master · ✅ written `docs/postgresql/pages/phase-10-indexes/02-btree.md`
- **Read this:** [11.2 Index Types](https://www.postgresql.org/docs/current/indexes-types.html) · postgresql.org · B-tree handles equality and range; `LIKE 'foo%'` is indexable but `LIKE '%bar'` is not; non-C locales need a special operator class for the prefix case (*read* the B-tree section) · covers our angle: full except sort order · fetched 2026-10-12
- **Also good:** [11.4 Indexes and ORDER BY](https://www.postgresql.org/docs/current/indexes-ordering.html) · postgresql.org · sort order and `ASC`/`DESC` (*headings only*) · [65.1 B-Tree Indexes](https://www.postgresql.org/docs/current/btree.html) · postgresql.org · internals, operator classes (*headings only*) · fetched 2026-10-12
- **Beyond the docs:** [Understanding the Mechanics of PostgreSQL B-Tree Indexes](https://www.postgresql.fastware.com/pzone/2025-01-understanding-the-mechanics-of-postgresql-b-tree-indexes) · Gary Evans, Fastware · walks meta, root, internal and leaf pages with real `pageinspect` output, so the tree is seen rather than described; page dated 2025-01-11 · fetched 2026-10-13 (*read*)
- **Our delta:** the non-C-locale `LIKE` caveat is easy to drop; keep it, and name the operator class from the docs page we link at write time (the class name is not in the page text I read).

### T10-03 · `EXPLAIN` vs `EXPLAIN ANALYZE` — Master · ✅ written `docs/postgresql/pages/phase-10-indexes/03-explain.md`
- **Read this:** [14.1 Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) · postgresql.org · plan tree, cost numbers, and "EXPLAIN ANALYZE actually runs the query", with the roll-back-a-write example (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [EXPLAIN (command reference)](https://www.postgresql.org/docs/current/sql-explain.html) · postgresql.org · every option; `ANALYZE` defaults to false (*read* the option list) · fetched 2026-10-12
- **Our delta:** wrap a write under `ANALYZE` in `BEGIN` and `ROLLBACK`, from `pg` on one checked-out client.

### T10-04 · Seq scan vs index scan vs bitmap heap scan — Master · ✅ written `docs/postgresql/pages/phase-10-indexes/04-scan-types.md`
- **Read this:** [14.1 Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) · postgresql.org · worked plans for `Seq Scan`, `Index Scan` and the two-step `Bitmap Index Scan` then `Bitmap Heap Scan` with `Recheck Cond` (*read*) · covers our angle: **partial** — shows the plans, does not argue "a sequential scan is the correct plan" as a rule · fetched 2026-10-12
- **Also good:** [11.5 Combining Multiple Indexes](https://www.postgresql.org/docs/current/indexes-bitmap-scans.html) · postgresql.org · bitmaps ANDed and ORed in memory, rows then visited in physical order (*read*) · fetched 2026-10-12
- **Beyond the docs:** [PostgreSQL indexing: index scan vs bitmap scan vs sequential scan](https://www.cybertec-postgresql.com/en/postgresql-indexing-index-scan-vs-bitmap-scan-vs-sequential-scan-basics/) · Hans-Jürgen Schönig, Cybertec · one 10-million-row table showing when the planner flips between the three scan types, and why `ANALYZE` matters; beginner level; posted 2018-02 · fetched 2026-10-13 (*read*)
- **Our delta:** the table-size and selectivity thresholds are ours to measure.

### T10-05 · Why an index is not being used — Master · ✅ written `docs/postgresql/pages/phase-10-indexes/05-index-not-used.md`
- **Read this:** [Why isn't Postgres using my index?](https://www.pgmustard.com/blog/why-isnt-postgres-using-my-index) · pgMustard · splits causes into "cannot use" (function, datatype mismatch, operator not supported) and "thinks it is slower" (small table, many rows returned, LIMIT, bad row estimates, config); published 2021-09-28, page metadata modified 2025-12-19 (the page footer says "Last updated: March 2025") (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [11.12 Examining Index Usage](https://www.postgresql.org/docs/current/indexes-examine.html) · postgresql.org · "Always run ANALYZE first"; `enable_seqscan` as a diagnostic (*read*) · fetched 2026-10-12
- **Our delta:** one runnable example per cause, since the Node angle is the parameter type `pg` sends.

### T10-06 · Indexing foreign key columns — Understand · ✅ written `docs/postgresql/pages/phase-10-indexes/18-fk-indexes.md`
- **Read this:** [5.5 Constraints, section on foreign keys](https://www.postgresql.org/docs/current/ddl-constraints.html) · postgresql.org · says a referenced-column change scans the referencing table, so index it too, and a foreign key does not create that index automatically (*read*) · covers our angle: **partial** — states the rule, no timing demo · fetched 2026-10-12
- **Also good:** [PostgreSQL: Indexes and foreign keys](https://www.cybertec-postgresql.com/en/postgresql-indexes-and-foreign-keys/) · Cybertec · a cascading delete reads all 5 million child rows without the index; published 2017-07-20, modified 2024-10-08 (*read*) · [Unindexed foreign keys](https://wiki.postgresql.org/wiki/Unindexed_foreign_keys) · PostgreSQL wiki · a query listing them (*headings only*) · fetched 2026-10-12
- **Our delta:** our own `DELETE` timing with and without the index.

### T10-07 · Multicolumn indexes and column order — Understand · ✅ written `docs/postgresql/pages/phase-10-indexes/06-multicolumn.md`
- **Read this:** [11.3 Multicolumn Indexes](https://www.postgresql.org/docs/current/indexes-multicolumn.html) · postgresql.org · the exact rule: equality on leading columns plus an inequality on the first non-equality column limit the scan (*read*) · covers our angle: full · fetched 2026-10-12
- **Beyond the docs:** [Multicolumn Index Order in Postgres](https://io.adafruit.com/blog/sysadmin/2016/05/18/postgres-multicolumn-indexes) · Adafruit IO blog (@toddtreece) · a real incident: about 5 s down to about 0.1 ms on roughly 50 million rows by moving the constrained column first; short; dated 2016-05-18 · fetched 2026-10-13 (*read*)
- **Our delta:** 🔴 the page says a multicolumn index can be used for conditions on any subset of its columns, just less efficiently. Our syllabus wording "will not serve a query on `b`" is too strong; say "scans the whole index" and measure it.

### T10-08 · `EXPLAIN (ANALYZE, BUFFERS)` — Understand · ✅ written `docs/postgresql/pages/phase-10-indexes/07-explain-buffers.md`
- **Read this:** [14.1 Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) · postgresql.org · plans with `Buffers: shared hit=… read=…` lines and `rows=` estimate versus actual (*read*) · covers our angle: **partial** — no worked "where was the planner wrong" hunt · fetched 2026-10-12
- **Also good:** [EXPLAIN (command reference)](https://www.postgresql.org/docs/current/sql-explain.html) · postgresql.org · hit, read, dirtied, written defined (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Using BUFFERS for query optimization](https://www.pgmustard.com/blog/using-postgres-buffers-for-query-optimization) · Michael Christofides, pgMustard · worked plans showing why block counts beat timings, with the caveat that read includes OS-cache hits; the author also sells pgMustard; dated 2022-07-25 · fetched 2026-10-13 (*read*)
- **Our delta:** 🔴 in 18.6 the reference says buffer information is automatically included when `ANALYZE` is used, so older "add BUFFERS" advice is no longer needed there.

### T10-09 · Index-only scans, `INCLUDE`, visibility map — Understand · ✅ written `docs/postgresql/pages/phase-10-indexes/08-index-only.md`
- **Read this:** [11.9 Index-Only Scans and Covering Indexes](https://www.postgresql.org/docs/current/indexes-index-only-scans.html) · postgresql.org · checks the visibility map bit per heap page, falls back to the heap if unset; `INCLUDE` payload columns (*read*) · covers our angle: full · fetched 2026-10-12
- **Beyond the docs:** [Index-only scans in Postgres](https://www.pgmustard.com/blog/2019/03/04/index-only-scans-in-postgres) · David Conlin, pgMustard · plain-language walk through why heap fetches still happen and what to do about them; introductory; dated 2019-03-04, page says updated 2025-05 · fetched 2026-10-13 (*read*)

### T10-10 · Partial indexes — Understand · ✅ written `docs/postgresql/pages/phase-10-indexes/09-partial.md`
- **Read this:** [11.8 Partial Indexes](https://www.postgresql.org/docs/current/indexes-partial.html) · postgresql.org · usable only if the query's `WHERE` provably implies the index predicate; no theorem prover for equivalent forms (*read*) · covers our angle: full for matching · fetched 2026-10-12
- **Our delta:** the `deleted_at IS NULL` example is ours; not found in the page text.

### T10-11 · Expression indexes — Understand · ✅ written `docs/postgresql/pages/phase-10-indexes/10-expression.md`
- **Read this:** [11.7 Indexes on Expressions](https://www.postgresql.org/docs/current/indexes-expressional.html) · postgresql.org · `lower(col1)` index and the matching query; a `UNIQUE` variant (*read*) · covers our angle: **partial** — "must match character for character" is not stated in what I read · fetched 2026-10-12
- **Our delta:** show the mismatch case (`lower(email)` indexed, query uses `upper`) failing.

### T10-12 · GIN, and `pg_trgm` for `LIKE '%x%'` — Understand · ✅ written `docs/postgresql/pages/phase-10-indexes/11-gin-trgm.md`
- **Read this (1/2):** [65.4 GIN Indexes](https://www.postgresql.org/docs/current/gin.html) · postgresql.org · built-in operator classes table: `array_ops`, `jsonb_ops`, `jsonb_path_ops`, `tsvector_ops` (*read* the table) · covers our angle: full for the operator classes · fetched 2026-10-12
- **Read this (2/2):** [F.35 pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html) · postgresql.org · GIN and GiST trigram indexes support `LIKE`, `ILIKE`, `~`, `~*` and `=`; not as efficient as B-tree for equality (*read*) · fetched 2026-10-12

### T10-13 · `CREATE INDEX CONCURRENTLY` — Understand · ✅ written `docs/postgresql/pages/phase-10-indexes/12-concurrently.md`
- **Read this:** [CREATE INDEX, section "Building Indexes Concurrently"](https://www.postgresql.org/docs/current/sql-createindex.html) · postgresql.org · two table scans, waits for older transactions; a failed build leaves an "invalid" index that still costs update overhead (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** the `DROP INDEX` then retry recipe after failure; and the page states a concurrent build cannot run inside a transaction block (*read*), which matters for `pg` migrations that wrap everything in `BEGIN`.

### T10-14 · Unused and duplicate indexes — Understand · ✅ written `docs/postgresql/pages/phase-10-indexes/13-unused-indexes.md`
- **Read this:** [How to find unused indexes](https://postgres.ai/docs/postgres-howtos/performance-optimization/indexing/how-to-find-unused-indexes) · postgres.ai · `idx_scan = 0 and not indisunique`, check `stats_reset` first (about a month of data), check replicas, drop with `DROP INDEX CONCURRENTLY`; page shows no date (*read*) · covers our angle: **partial** — no duplicate-index passage on this page (duplicates: not confirmed, no source found) · fetched 2026-10-12
- **Also good:** [27.2 The Cumulative Statistics System](https://www.postgresql.org/docs/current/monitoring-stats.html) · postgresql.org · the `idx_scan` column definitions (*read* the column list) · fetched 2026-10-12

### T10-15 · `pg_stat_statements` — Understand · ✅ written `docs/postgresql/pages/phase-10-indexes/14-pg-stat-statements.md`
- **Read this:** [F.32 pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html) · postgresql.org · must be in `shared_preload_libraries`, restart needed; `calls`, `total_exec_time` columns (*read*) · covers our angle: full for setup and columns; includes a top-5 `ORDER BY total_exec_time DESC` example query, but not the argument "measure, do not suspect" (that is ours) · fetched 2026-10-12
- **Beyond the docs:** [Queries for pg_stat_statements](https://www.pgmustard.com/blog/queries-for-pg-stat-statements) · Michael Christofides, pgMustard · ready-to-run queries ranked by total time versus mean time versus I/O, and why those give different answers; dated 2023-05-05, updated 2025-10 · fetched 2026-10-13 (*read*)

### T10-16 · GiST, BRIN and hash — Know · ✅ written `docs/postgresql/pages/phase-10-indexes/15-gist-brin-hash.md`
- **Read this:** [11.2 Index Types](https://www.postgresql.org/docs/current/indexes-types.html) · postgresql.org · one section per type; hash handles only simple equality (*read* the hash section) · covers our angle: full as a survey · fetched 2026-10-12
- **Also good:** [65.5 BRIN Indexes](https://www.postgresql.org/docs/current/brin.html) · postgresql.org · built for very large tables whose columns correlate with physical location (*read*) · [65.6 Hash Indexes](https://www.postgresql.org/docs/current/hash-index.html) · postgresql.org · fully crash recoverable (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Avoiding the Pitfalls of BRIN Indexes in Postgres](https://www.crunchydata.com/blog/avoiding-the-pitfalls-of-brin-indexes-in-postgres) · John Porvaznik, Crunchy Data · size benchmark (1M rows: table 50MB, B-tree 21MB, BRIN 48kB), a `pageinspect` view of block ranges for in-order data, and diagrams of how out-of-order inserts and deletes make ranges overlap, which the docs only hint at; the out-of-order cases are illustrative, not measured output; dated 2020-08-06 · fetched 2026-10-13 (*read*)

### T10-17 · Statistics, `ANALYZE`, extended statistics — Know · ✅ written `docs/postgresql/pages/phase-10-indexes/16-statistics.md`
- **Read this:** [14.2 Statistics Used by the Planner](https://www.postgresql.org/docs/current/planner-stats.html) · postgresql.org · `pg_statistic` and `pg_stats`, single-column and extended statistics (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [CREATE STATISTICS](https://www.postgresql.org/docs/current/sql-createstatistics.html) · postgresql.org · `ndistinct`, `dependencies`, `mcv` kinds; correlated-columns example (*read*) · fetched 2026-10-12
- **Beyond the docs:** [The Postgres 10 feature you didn't know about: CREATE STATISTICS](https://www.citusdata.com/blog/2018/03/06/postgres-planner-and-its-usage-of-statistics) · Samay Sharma, Citus Data · before and after `EXPLAIN ANALYZE` of a correlated-column misestimate (100 rows estimated versus 10,000 actual) fixed by dependencies and ndistinct statistics; dated 2018-03-06 · fetched 2026-10-13 (*read*)
- **Our delta:** `default_statistics_target` is covered in one passage of the Read-this page (set per column with `ALTER TABLE SET STATISTICS` or globally; default limit 100 entries); the config-reference page for it was not opened in this check.

### T10-18 · Index bloat and `REINDEX CONCURRENTLY` — Know · ✅ written `docs/postgresql/pages/phase-10-indexes/17-bloat-reindex.md`
- **Read this:** [24.2 Routine Reindexing](https://www.postgresql.org/docs/current/routine-reindex.html) · postgresql.org · empty B-tree pages are reused, but pages with a few keys left stay allocated (*read*) · covers our angle: **partial** — `CONCURRENTLY` gets one sentence here (`SHARE UPDATE EXCLUSIVE` instead of `ACCESS EXCLUSIVE`); the full detail is in the command page · fetched 2026-10-12
- **Also good:** [REINDEX](https://www.postgresql.org/docs/current/sql-reindex.html) · postgresql.org · synopsis shows `CONCURRENTLY` for index, table, schema, database (*headings only*; synopsis seen) · fetched 2026-10-12

---

## Phase 11 — Transactions, MVCC and concurrency

### T11-01 · ACID, concretely, in PostgreSQL terms — Master · ✅ written `docs/postgresql/pages/phase-11-mvcc/01-acid.md`
- **Read this:** [3.4 Transactions (tutorial)](https://www.postgresql.org/docs/current/tutorial-transactions.html) · postgresql.org · a transaction bundles steps into one all-or-nothing operation; atomic, and durable once acknowledged (*read*) · covers our angle: **partial** — atomicity and durability are argued; isolation only in passing (intermediate states hidden), consistency not at all · fetched 2026-10-12
- **Also good:** [13.1 Introduction (Concurrency Control)](https://www.postgresql.org/docs/current/mvcc-intro.html) · postgresql.org · the isolation side: each statement sees a snapshot (*read*) · fetched 2026-10-12
- **Beyond the docs:** [How Postgres Makes Transactions Atomic](https://brandur.org/postgres-atomicity) · brandur · follows a commit through `xmin`/`xmax`, snapshots, the WAL flush and the commit log, so atomicity and durability are seen in mechanism; advanced; dated 2017-08-16 · fetched 2026-10-13 (*read*)
- **Our delta:** the "consistency" leg (constraints) and a durability demo (`synchronous_commit`) have no single page I found; our page must carry them.

### T11-02 · `BEGIN`/`COMMIT`/`ROLLBACK`, and autocommit from `pg` — Master · ✅ written `docs/postgresql/pages/phase-11-mvcc/02-begin-commit.md`
- **Read this:** [node-postgres: Transactions](https://node-postgres.com/features/transactions) · node-postgres.com · run `BEGIN`/`COMMIT`/`ROLLBACK` yourself; use the same client for every statement; never `pool.query` for a transaction (*read*) · covers our angle: **partial** — nothing about autocommit or the per-statement implicit transaction (that is on the tutorial page) · fetched 2026-10-12
- **Also good:** [3.4 Transactions (tutorial)](https://www.postgresql.org/docs/current/tutorial-transactions.html) · postgresql.org · the SQL side (*read*) · fetched 2026-10-12
- **Our delta:** the word "autocommit" appears on neither page, but the tutorial says each statement without `BEGIN` gets an implicit `BEGIN` and `COMMIT`; our page ties that to a lone `pool.query` from `pg`.

### T11-03 · `READ COMMITTED` — Master · ✅ written `docs/postgresql/pages/phase-11-mvcc/03-read-committed.md`
- **Read this:** [13.2 Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) · postgresql.org · Read Committed is the default; a `SELECT` sees only data committed before that query began; the anomaly definitions and the isolation table (*read*) · covers our angle: full · fetched 2026-10-12

### T11-04 · Lost update — Master · ✅ written `docs/postgresql/pages/phase-11-mvcc/04-lost-update.md`
- **Read this:** [PostgreSQL anti-patterns: read-modify-write cycles](https://www.enterprisedb.com/blog/postgresql-anti-patterns-read-modify-write-cycles) · EDB · four fixes: calculated `UPDATE`, `SELECT … FOR UPDATE`, `SERIALIZABLE`, optimistic version column; page shows no date (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [SELECT FOR UPDATE considered harmful in PostgreSQL](https://www.cybertec-postgresql.com/en/select-for-update-considered-harmful-postgresql/) · Cybertec · explains the lost-update race and why `FOR NO KEY UPDATE` is often the right lock; published 2025-06-17, modified 2026-09-22 (*read*) · fetched 2026-10-12
- **Our delta:** the syllabus row says "three real fixes" while our page title says four; the EDB list has four, so align the syllabus.

### T11-05 · MVCC — Understand · ✅ written `docs/postgresql/pages/phase-11-mvcc/05-mvcc.md`
- **Read this:** [13.1 Introduction (Concurrency Control)](https://www.postgresql.org/docs/current/mvcc-intro.html) · postgresql.org · each statement sees a snapshot; "reading never blocks writing and writing never blocks reading" (*read*) · covers our angle: **partial** — no row-version (`xmin`/`xmax`) walkthrough on the page · fetched 2026-10-12
- **Beyond the docs:** [MVCC in PostgreSQL, 4. Snapshots](https://postgrespro.com/blog/pgsql/5967899) · Egor Rogov, Postgres Professional · snapshot contents (`xmin`, `xmax`, active list), per-statement versus per-transaction snapshots and the vacuum horizon, with SQL you can run; dated 2020-12-04 · fetched 2026-10-13 (*read*)
- **Our delta:** the `xmin`/`xmax` demo is ours; the Cybertec page in T11-12 shows the dead-row side.

### T11-06 · `REPEATABLE READ` and `SERIALIZABLE`, and retries — Understand · ✅ written `docs/postgresql/pages/phase-11-mvcc/06-isolation-levels.md`
- **Read this (1/2):** [13.2 Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) · postgresql.org · the two levels, serialization anomaly defined (*read*) · covers our angle: full for semantics · fetched 2026-10-12
- **Read this (2/2):** [13.5 Serialization Failure Handling](https://www.postgresql.org/docs/current/mvcc-serialization-failure-handling.html) · postgresql.org · applications must retry; SQLSTATE `40001`; deadlock failures may also be retried (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Jepsen: PostgreSQL 12.3](https://jepsen.io/analyses/postgresql-12.3) · Kyle Kingsbury, Jepsen · tests each isolation level for anomalies: Repeatable Read is snapshot isolation, and Serializable had a conflict-detection bug (patch scheduled for the 2020-08-13 minor release); dated 2020-06-12; note it describes a bug in 12.3 · fetched 2026-10-13 (*read*)
- **Our delta:** the Node retry loop (re-run the whole callback on a fresh client) is ours.

### T11-07 · Row locks — Understand · ✅ written `docs/postgresql/pages/phase-11-mvcc/07-row-locks.md`
- **Read this:** [13.3 Explicit Locking, section "Row-Level Locks"](https://www.postgresql.org/docs/current/explicit-locking.html) · postgresql.org · the four row lock modes and their conflict table (*read* the contents, modes seen in the text) · covers our angle: full · fetched 2026-10-12
- **Also good:** [SELECT FOR UPDATE considered harmful in PostgreSQL](https://www.cybertec-postgresql.com/en/select-for-update-considered-harmful-postgresql/) · Cybertec · `UPDATE` takes `FOR NO KEY UPDATE`, but `FOR UPDATE` when it modifies a column of a (non-partial, non-expression) unique index; published 2025-06-17, modified 2026-09-22 (*read*) · fetched 2026-10-12

### T11-08 · `SKIP LOCKED` — Understand · ✅ written `docs/postgresql/pages/phase-11-mvcc/08-skip-locked.md`
- **Read this:** [SELECT, "The Locking Clause"](https://www.postgresql.org/docs/current/sql-select.html) · postgresql.org · skipped rows give "an inconsistent view of the data"; fine for queue-like tables, not general work (*read*) · covers our angle: **partial** — no worker-loop pattern · fetched 2026-10-12
- **Also good:** [Postgres 9.5 feature highlight - SKIP LOCKED](https://paquier.xyz/postgresql-2/postgres-9-5-feature-highlight-skip-locked-row-level/) · Paquier · short demo of rows being skipped; dated 10 Oct 2014 (*read*) · fetched 2026-10-12
- **Our delta:** the claim-then-commit worker loop and crash recovery (lock dies with the transaction) are ours; I found no read source that covers them well.
- *Checked, not chosen:* the 2ndQuadrant "What is SKIP LOCKED for" post, which was not re-opened in verification (the first fetch reported a 502, not re-confirmed). *Not opened:* DEV Community and Substack queue tutorials.

### T11-09 · Savepoints — Understand · ✅ written `docs/postgresql/pages/phase-11-mvcc/09-savepoints.md`
- **Read this:** [SAVEPOINT](https://www.postgresql.org/docs/current/sql-savepoint.html) · postgresql.org · `ROLLBACK TO`, `RELEASE`, only inside a transaction block (*read*) · covers our angle: **partial** — no `pg` example · fetched 2026-10-12
- **Beyond the docs:** [PostgreSQL Subtransactions Considered Harmful](https://postgres.ai/blog/20210831-postgresql-subtransactions-considered-harmful) · Nikolay Samokhvalov, PostgresAI · what savepoints cost under load: XID growth, the 64-entry per-session cache, MultiXact contention, standby SLRU overflow; dated 2021-08-31, corrections listed 2025-09-22 · fetched 2026-10-13 (*read*)

### T11-10 · Table-level locks and DDL — Understand · ✅ written `docs/postgresql/pages/phase-11-mvcc/10-table-locks-ddl.md`
- **Read this (1/2):** [13.3 Explicit Locking, section "Table-Level Locks"](https://www.postgresql.org/docs/current/explicit-locking.html) · postgresql.org · lock modes and the conflict table; `ROW EXCLUSIVE` taken by `UPDATE`, `DELETE`, `INSERT`, `MERGE` (*read*) · covers our angle: **partial** — no DDL-to-lock list · fetched 2026-10-12
- **Read this (2/2):** [ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html) · postgresql.org · `ACCESS EXCLUSIVE` unless a subform says otherwise; several subcommands take the strictest (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Schema changes and the Postgres lock queue](https://xata.io/blog/migrations-and-exclusive-locks) · Xata blog · demonstrates with `pg_sleep` and `pg_blocking_pids` how a queued `ALTER TABLE` blocks later reads, which is the effect our delta says neither official page shows; no author or date shown on the page · fetched 2026-10-13 (*read*)
- **Our delta:** the "queued `ALTER` blocks later readers" effect is not on either page; shown by our own two-session demo.
- *Checked, not chosen:* pglocks.org (fetched, 13 words of text, nothing to read).

### T11-11 · Deadlocks — Understand · ✅ written `docs/postgresql/pages/phase-11-mvcc/11-deadlocks.md`
- **Read this:** [13.3 Explicit Locking, section "Deadlocks"](https://www.postgresql.org/docs/current/explicit-locking.html) · postgresql.org · automatic detection aborts one transaction; which one is "difficult to predict"; acquire locks in a consistent order (*read*) · covers our angle: full · fetched 2026-10-12
- **Beyond the docs:** [PostgreSQL: understanding deadlocks](https://www.cybertec-postgresql.com/en/postgresql-understanding-deadlocks/) · Hans-Jürgen Schönig, Cybertec · step-by-step timeline of two sessions deadlocking and the reorder fix; also states the `deadlock_timeout` default of 1 second that our delta could not confirm from the docs page; posted 2021-04 · fetched 2026-10-13 (*read*)
- **Our delta:** the `deadlock_timeout` default is not on the page text I read; "not confirmed".

### T11-12 · Long-running transactions — Understand · ✅ written `docs/postgresql/pages/phase-11-mvcc/12-long-transactions.md`
- **Read this:** [Four reasons why VACUUM won't remove dead rows](https://www.cybertec-postgresql.com/en/reasons-why-vacuum-wont-remove-dead-rows/) · Cybertec · the xmin horizon, a `pg_stat_activity` query on `backend_xmin`, and the other holders (slots, prepared transactions, standby feedback); published 2018-03-14, modified 2024-03-05 (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** an author reply in the comments says open snapshots hold vacuum back, and a `READ COMMITTED` read-only session takes one per statement; keep that nuance.

### T11-13 · `VACUUM`, autovacuum, dead tuples, bloat — Understand · ✅ written `docs/postgresql/pages/phase-11-mvcc/13-vacuum.md`
- **Read this:** [24.1 Routine Vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html) · postgresql.org · standard `VACUUM` versus `VACUUM FULL`, planner statistics, visibility map, autovacuum daemon (*read*) · covers our angle: full · fetched 2026-10-12
- **Beyond the docs:** [Tuning autovacuum in PostgreSQL and autovacuum internals](https://www.percona.com/blog/tuning-autovacuum-in-postgresql-and-autovacuum-internals/) · Avinash Vallarapu, Percona · the trigger formula with worked numbers, cost-based throttling and per-table overrides; dated 2018-08-10, so check defaults against 18 · fetched 2026-10-13 (*read*)

### T11-14 · Idle in transaction — Understand · ✅ written `docs/postgresql/pages/phase-11-mvcc/14-idle-in-transaction.md`
- **Read this:** [idle_in_transaction_session_timeout: Terminating idle transactions](https://www.cybertec-postgresql.com/en/idle_in_transaction_session_timeout-terminating-idle-transactions-in-postgresql/) · Cybertec · why long transactions cause bloat, then the timeout; published 2018-04-09, modified 2024-10-08 (*read* the bloat part) · covers our angle: **partial** — no Node cause · fetched 2026-10-12
- **Also good:** [19.11 Client Connection Defaults](https://www.postgresql.org/docs/current/runtime-config-client.html) · postgresql.org · the setting definition; zero (default) disables it; prepared transactions are not subject to it (*read*) · fetched 2026-10-12
- **Our delta:** the leaked `BEGIN` on an un-released `pool.connect()` client is ours.

### T11-15 · Advisory locks — Know · ✅ written `docs/postgresql/pages/phase-11-mvcc/15-advisory-locks.md`
- **Read this:** [13.3 Explicit Locking, section "Advisory Locks"](https://www.postgresql.org/docs/current/explicit-locking.html) · postgresql.org · application-defined, not enforced by the system; faster than a table flag, no bloat, cleaned up at session end (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [9.28 System Administration Functions](https://www.postgresql.org/docs/current/functions-admin.html) · postgresql.org · `pg_advisory_lock` family (*read* the function table) · fetched 2026-10-12
- **Beyond the docs:** [How do PostgreSQL advisory locks work](https://vladmihalcea.com/how-do-postgresql-advisory-locks-work) · Vlad Mihalcea · short overview of shared versus exclusive and session versus transaction locks with the `try_` variants; introductory and written against 9.6; posted 2017-04-12 · fetched 2026-10-13 (*read*)
- **Our delta:** session-level locks and a pooled `pg` client: the lock belongs to a connection, not to your request.

### T11-16 · Transaction id wraparound — Know · ✅ written `docs/postgresql/pages/phase-11-mvcc/16-xid-wraparound.md`
- **Read this:** [24.1 Routine Vacuuming, "Preventing Transaction ID Wraparound Failures"](https://www.postgresql.org/docs/current/routine-vacuuming.html) · postgresql.org · 32-bit XIDs wrap after about 4 billion; vacuum every table at least once every two billion transactions (*read*) · covers our angle: full · fetched 2026-10-12
- **Beyond the docs:** [Transaction ID Wraparound in Postgres](https://blog.sentry.io/transaction-id-wraparound-in-postgres/) · David Cramer, Sentry · a production outage account: what the stop-accepting-writes state looks like and how recovery went; dated 2015-07-23, so mechanism only, not current settings · fetched 2026-10-13 (*read*)
