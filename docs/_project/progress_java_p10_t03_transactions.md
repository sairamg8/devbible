---
name: Java P10 topic 03 · Transactions at the JDBC level
description: Chunk-by-chunk progress and every load-bearing claim with its source URL, for docs/java/pages/phase-10-data-access/03-jdbc-transactions/
metadata:
  type: project
---

# Java · Phase 10 · Topic 03 · Transactions at the JDBC level

Directory: `docs/java/pages/phase-10-data-access/03-jdbc-transactions/`
Tier: **Understand** (`t-understand` on every chunk). Boundary: **raw JDBC only** —
Spring `@Transactional`, propagation, proxies and `TransactionTemplate` belong to
topic 04, written in parallel by another agent. No links into `../04-spring-transactional/`.

## Status — ✅ TOPIC COMPLETE (25 files written by this fork)

| # | File | Lines | Gotchas | Q |
|---|---|---|---|---|
| 01 | 01-autocommit-is-a-transaction-you-did-not-choose.md | 199 | 3 | 3 | *(pre-existing, not mine)* |
| 02 | 02-commit-rollback-and-the-shape-that-survives.md | 259 | 5 | 6 | *(pre-existing, not mine)* |
| 03 | 03-what-isolation-actually-means.md | 285 | 5 | 6 |
| 04 | 04-postgresql-has-three-levels.md | 250 | 4 | 5 |
| 05 | 05-read-committed-in-practice.md | 258 | 5 | 5 |
| 05b | 05b-when-re-evaluation-surprises-you.md | 275 | 5 | 6 |
| 06 | 06-repeatable-read.md | 238 | 4 | 4 |
| 06b | 06b-what-repeatable-read-still-cannot-promise.md | 189 | 3 | 4 |
| 07 | 07-serializable-and-ssi.md | 255 | 4 | 5 |
| 07b | 07b-making-serializable-perform.md | 224 | 4 | 4 |
| 07c | 07c-deferrable-and-the-limits.md | 187 | 4 | 5 |
| 08 | 08-setting-the-level-from-java.md | 190 | 3 | 3 |
| 08b | 08b-the-level-and-the-pool.md | 169 | 3 | 3 |
| 09 | 09-savepoints.md | 249 | 4 | 6 |
| 09b | 09b-cursors-and-the-cost.md | 180 | 3 | 4 |
| 10 | 10-the-aborted-transaction.md | 249 | 6 | 6 |
| 10b | 10b-autosave.md | 152 | 4 | 3 |
| 11 | 11-read-only-transactions.md | 239 | 5 | 4 |
| 11b | 11b-read-only-that-earns-its-keep.md | 173 | 2 | 4 |
| 12 | 12-locking-and-select-for-update.md | 290 | 6 | 6 |
| 12b | 12b-nowait-skip-locked-and-scope.md | 291 | 6 | 6 |
| 13 | 13-deadlocks-and-timeouts.md | 299 | 6 | 6 |
| 13b | 13b-the-four-clocks.md | 294 | 7 | 6 |
| 14 | 14-retrying-safely.md | 294 | 6 | 5 |
| 14b | 14b-when-the-commit-is-in-doubt.md | 248 | 6 | 3 |
| 15 | 15-where-the-boundary-belongs.md | 274 | 7 | 6 |
| 15b | 15b-a-debugging-order-and-a-checklist.md | 231 | 4 | 6 |

**0 files over 300. sidebar_position 1..27, no gaps. Every intra-topic and
cross-topic link verified against the filesystem.** The coordinator still generates
`README.md` and the Prev/Next footers.

⚠️ Chunk 13 was named `13-deadlocks-and-timeouts.md` (as planned) but its *content*
is deadlocks only; the timeout/diagnosis half is `13b-the-four-clocks.md`, because
`../01-jdbc/22d-server-side-timeouts.md` already owns the timeout GUC catalogue and
duplicating it was not acceptable. 13b covers `pg_stat_activity` diagnosis instead,
which no page in topic 01 touches.

⚠️ Deliberate non-duplication decisions, so a later session does not "fix" them:
- Chunk 14 defers the generic retry-loop shape (fresh connection, cap, jitter) to
  `../01-jdbc/21e-retrying-and-translating.md` and covers the SQLSTATE-class
  *predicate* plus the in-doubt case, which 21e does not have.
- Chunk 13b defers GUC semantics to `../01-jdbc/22d-server-side-timeouts.md`.
- Savepoint cost material is split: chunk 9b owns it; `../01-jdbc/19g` touches
  `autosave` but not the savepoint cursor rules.

## 🔴 TRAP the coordinator must fix (I may not edit chunks 01/02)

`01-autocommit-...md` and `02-commit-rollback-...md` contain links to filenames
that do not exist and are not in this topic's plan:

- `03-one-error-aborts-everything.md` — linked once from chunk 01. My **chunk 10**
  (`10-the-aborted-transaction.md`) is the content it means.
- `08-how-long-to-hold-it-open.md` — linked once from chunk 01 and once from
  chunk 02. My **chunk 15** (`15-where-the-boundary-belongs.md`) is the content
  it means.

Three dangling links total. They will break the build. Chunks 01/02 were written
against an earlier, different chunk plan.

## Load-bearing claims, with sources (do NOT re-fetch)

### PostgreSQL 18 §13.2 Transaction Isolation — https://www.postgresql.org/docs/18/transaction-iso.html

- The standard defines Serializable directly; the other three levels are defined
  "in terms of phenomena ... which must not occur at each level".
- "In PostgreSQL, you can request any of the four standard transaction isolation
  levels, but internally only three distinct isolation levels are implemented,
  i.e., PostgreSQL's Read Uncommitted mode behaves like Read Committed. This is
  because it is the only sensible way to map the standard isolation levels to
  PostgreSQL's multiversion concurrency control architecture."
- Phenomena definitions (verbatim): dirty read = "A transaction reads data written
  by a concurrent uncommitted transaction."; nonrepeatable read = "A transaction
  re-reads data it has previously read and finds that data has been modified by
  another transaction (that committed since the initial read)."; phantom read =
  "A transaction re-executes a query returning a set of rows that satisfy a search
  condition and finds that the set of rows satisfying the condition has changed
  due to another recently-committed transaction."; serialization anomaly = "The
  result of successfully committing a group of transactions is inconsistent with
  all possible orderings of running those transactions one at a time."
- **Table 13.1**: Read uncommitted → dirty read "Allowed, but not in PG",
  nonrepeatable/phantom/anomaly Possible. Read committed → dirty Not possible,
  rest Possible. Repeatable read → dirty & nonrepeatable Not possible, phantom
  "Allowed, but not in PG", anomaly Possible. Serializable → all Not possible.
- RR is "a stronger guarantee than is required by the SQL standard ... this is
  specifically allowed by the standard, which only describes the **minimum**
  protections each isolation level must provide."
- **Read Committed**: SELECT "sees a snapshot of the database as of the instant
  the query begins to run"; "two successive SELECT commands can see different
  data, even though they are within a single transaction". UPDATE/DELETE/SELECT
  FOR UPDATE/SHARE find rows committed as of *command* start; if the target row
  was concurrently updated the would-be updater **waits**, then if the first
  committed, "the search condition of the command (the WHERE clause) is
  re-evaluated to see if the updated version of the row still matches".
- Read Committed worked examples in the manual: the two-UPDATE $100 transfer
  (safe, because each command affects a predetermined row); the `website.hits`
  example where `DELETE FROM website WHERE hits = 10` has no effect because the
  pre-update value 9 is skipped and the post-update value is 11.
- "Because of the above rules, it is possible for an updating command to see an
  inconsistent snapshot ... This behavior makes Read Committed mode unsuitable
  for commands that involve complex search conditions".
- **Repeatable Read**: snapshot "as of the start of the first non-transaction-control
  statement in the *transaction*". Error text verbatim:
  `ERROR:  could not serialize access due to concurrent update`.
  "When an application receives this error message, it should abort the current
  transaction and retry the whole transaction from the beginning."
  "only updating transactions might need to be retried; read-only transactions
  will never have serialization conflicts."
  RR read-only example of a still-inconsistent view: a control record shown
  complete while a detail record logically part of the batch is not seen.
  RR is Snapshot Isolation; pre-9.1 SERIALIZABLE gave exactly RR behaviour.
- **Serializable**: SSI = Serializable Snapshot Isolation. Error text verbatim:
  `ERROR:  could not serialize access due to read/write dependencies among transactions`.
  Serialization failures "always return with an SQLSTATE value of '40001'".
  Predicate locks show in `pg_locks` with mode `SIReadLock`; they "do not cause
  any blocking and therefore can *not* play any part in causing a deadlock".
  A READ ONLY transaction may release SIRead locks early or avoid taking any;
  `SERIALIZABLE READ ONLY DEFERRABLE` blocks until it can establish that fact and
  is "the *only* case where Serializable transactions block but Repeatable Read
  transactions don't".
  Unique-constraint violations can still be raised under SERIALIZABLE even after
  checking the key is absent, unless *all* such transactions follow the same
  check-first protocol.
  The manual's canonical anomaly example: table `mytab` with (1,10),(1,20),
  (2,100),(2,200); A sums class 1 → 30 and inserts as class 2; B sums class 2 →
  300 and inserts as class 1; one is rolled back.
  **Performance recommendation bullets (verbatim list)**: declare transactions
  READ ONLY when possible; control the number of active connections, using a
  connection pool if needed; don't put more into a single transaction than needed
  for integrity; don't leave connections dangling "idle in transaction" longer
  than necessary (`idle_in_transaction_session_timeout`); eliminate explicit
  locks / SELECT FOR UPDATE / FOR SHARE no longer needed; raise
  `max_pred_locks_per_transaction` / `_per_relation` / `_per_page` when page-level
  predicate locks get promoted to relation-level for lack of memory; a sequential
  scan always necessitates a relation-level predicate lock — encourage index scans
  by reducing `random_page_cost` and/or increasing `cpu_tuple_cost`.

### PostgreSQL 18 SET TRANSACTION — https://www.postgresql.org/docs/18/sql-set-transaction.html

- Syntax: `SET TRANSACTION` (current transaction only) vs
  `SET SESSION CHARACTERISTICS AS TRANSACTION` (defaults for subsequent
  transactions in the session).
- transaction_mode: `ISOLATION LEVEL {SERIALIZABLE|REPEATABLE READ|READ COMMITTED|READ UNCOMMITTED}`,
  `READ WRITE | READ ONLY`, `[NOT] DEFERRABLE`.
- 🔴 "The isolation level cannot be changed after the first query or
  data-modification statement (SELECT, INSERT, DELETE, UPDATE, MERGE, FETCH, or
  COPY) has been executed."
- READ ONLY forbids: INSERT, UPDATE, DELETE, MERGE; COPY FROM (except to temp
  tables); CREATE/ALTER/DROP; COMMENT, GRANT, REVOKE, TRUNCATE; EXPLAIN ANALYZE
  and EXECUTE if they would execute any of those. "Read-only is a high-level
  restriction; it does not prevent all writes to disk."
- DEFERRABLE has effect only when SERIALIZABLE **and** READ ONLY are both set;
  the transaction may block acquiring its snapshot, then runs without the normal
  SERIALIZABLE overhead and without risk of serialization failure. Ideal for
  long-running reports or backups.
- `SET TRANSACTION SNAPSHOT` only at the start of a transaction; needs
  SERIALIZABLE or REPEATABLE READ else the snapshot is discarded immediately.
- GUCs: `default_transaction_isolation`, `default_transaction_read_only`,
  `default_transaction_deferrable`; current-transaction views
  `transaction_isolation`, `transaction_read_only`, `transaction_deferrable`.
- "If SET TRANSACTION is executed without a prior START TRANSACTION or BEGIN, it
  emits a warning and otherwise has no effect."
- PostgreSQL's default is READ COMMITTED; the SQL standard's default is
  SERIALIZABLE.

### JDK 25 java.sql.Connection — https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Connection.html

- `TRANSACTION_REPEATABLE_READ` javadoc: "dirty reads and non-repeatable reads
  are prevented; phantom reads can occur" — i.e. the javadoc describes the
  standard's minimum, NOT PostgreSQL (where phantoms are prevented at RR).
- `TRANSACTION_NONE` = "transactions are not supported"; the javadoc says it
  "cannot be used" as an argument to setTransactionIsolation.
- `setTransactionIsolation`: 🔴 "Note: If this method is called during a
  transaction, the result is implementation-defined." Throws SQLException if the
  parameter is not one of the Connection constants.
- `setReadOnly`: "Puts this connection in read-only mode as a **hint to the
  driver** to enable database optimizations." 🔴 "Note: This method cannot be
  called during a transaction." Throws if called during a transaction.
- `setSavepoint()` / `setSavepoint(String)`: throw if the connection is in
  auto-commit mode or participating in a distributed transaction; "If setSavepoint
  is invoked outside of an active transaction, a transaction will be started at
  this newly created savepoint."
- `rollback(Savepoint)`: "Undoes all changes made after the given Savepoint object
  was set." Throws if the Savepoint is no longer valid or autocommit is on.
- `releaseSavepoint(Savepoint)`: "Removes the specified Savepoint **and subsequent
  Savepoint objects** from the current transaction. Any reference to the savepoint
  after it have been removed will cause an SQLException to be thrown."

### pgJDBC PgConnection source — https://github.com/pgjdbc/pgjdbc (pgjdbc/src/main/java/org/postgresql/jdbc/PgConnection.java)

- 🔴 `setTransactionIsolation` sends
  `"SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL " + name` — i.e.
  it changes the **session default**, not just the current transaction. Huge for
  connection pools: the level persists on that physical connection.
- It throws first if `queryExecutor.getTransactionState() != TransactionState.IDLE`:
  message `"Cannot change transaction isolation level in the middle of a transaction."`,
  `PSQLState.ACTIVE_SQL_TRANSACTION`.
- Unknown level → `"Transaction isolation level {0} not supported."`,
  `PSQLState.NOT_IMPLEMENTED`. `getIsolationLevelName` returns null only for
  TRANSACTION_NONE (and any other int).
- `getTransactionIsolation()` runs `SHOW TRANSACTION ISOLATION LEVEL` and maps the
  string back; it has an explicit `"READ UNCOMMITTED"` branch.
- `setReadOnly`: throws `"Cannot change transaction read-only property in the
  middle of a transaction."` (`ACTIVE_SQL_TRANSACTION`) if not IDLE. It only sends
  SQL when `readOnly != this.readOnly && autoCommit && readOnlyBehavior == always`,
  in which case it sends `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`
  (or `... READ WRITE`). Otherwise it just sets a local flag.
- `ReadOnlyBehavior` enum = `ignore | transaction | always`; from the
  `readOnlyMode` connection property; **default is `transaction`**, and an
  unparseable value also falls back to `transaction`.
- Savepoints: `setSavepoint()` throws `"Cannot establish a savepoint in
  auto-commit mode."` (`NO_ACTIVE_SQL_TRANSACTION`); unnamed savepoints get an id
  from `savepointId++`. It sends `SAVEPOINT <name>`, `ROLLBACK TO SAVEPOINT <name>`,
  `RELEASE SAVEPOINT <name>`, and `releaseSavepoint` calls
  `pgSavepoint.invalidate()` afterwards.

### PostgreSQL 18 SAVEPOINT / ROLLBACK TO — sql-savepoint.html, sql-rollback-to.html

- SAVEPOINT: only inside a transaction block; multiple savepoints allowed.
  PostgreSQL deviates from the standard on duplicate names: "the old savepoint is
  kept, though only the more recent one will be used when rolling back or
  releasing" — releasing the newer makes the older accessible again.
- 🔴 ROLLBACK TO: "Roll back all commands that were executed after the savepoint
  was established and then start a new subtransaction at the same transaction
  level. **The savepoint remains valid and can be rolled back to again later.**"
  It "implicitly destroys all savepoints that were established after the named
  savepoint." Specifying a non-existent savepoint name is an error.
- 🔴 Cursor rules (verbatim): "Any cursor that is opened inside a savepoint will
  be closed when the savepoint is rolled back. If a previously opened cursor is
  affected by a FETCH or MOVE command inside a savepoint that is later rolled
  back, the cursor remains at the position that FETCH left it pointing to (that
  is, the cursor motion caused by FETCH is not rolled back). Closing a cursor is
  not undone by rolling back, either. However, other side-effects caused by the
  cursor's query (such as side-effects of volatile functions called by the query)
  *are* rolled back... A cursor whose execution causes a transaction to abort is
  put in a cannot-execute state, so while the transaction can be restored using
  ROLLBACK TO SAVEPOINT, the cursor can no longer be used."
- RELEASE SAVEPOINT destroys a savepoint *without* discarding the effects of
  commands executed after it.
- ⚠️ The savepoint reference pages say **nothing** about resource cost — do not
  claim a specific per-savepoint cost from them.

### HikariCP 7.x source — https://github.com/brettwooldridge/HikariCP

- `ProxyConnection` dirty bits (verbatim):
  `DIRTY_BIT_READONLY = 0b000001; DIRTY_BIT_AUTOCOMMIT = 0b000010;
   DIRTY_BIT_ISOLATION = 0b000100; DIRTY_BIT_CATALOG = 0b001000;
   DIRTY_BIT_NETTIMEOUT = 0b010000; DIRTY_BIT_SCHEMA = 0b100000;`
- Each setter does `delegate.setX(v); field = v; dirtyBits |= DIRTY_BIT_X;`
- `PoolBase.resetConnectionState(connection, proxyConnection, dirtyBits)` resets a
  property only if its bit is set AND the proxy's recorded state differs from the
  pool's own field. For isolation:
  `if ((dirtyBits & DIRTY_BIT_ISOLATION) != 0 && proxyConnection.getTransactionIsolationState() != transactionIsolation) { connection.setTransactionIsolation(transactionIsolation); }`
- Pool fields come from config in the PoolBase constructor:
  `this.isReadOnly = config.isReadOnly(); this.isAutoCommit = config.isAutoCommit();
   this.transactionIsolation = UtilityElf.getTransactionIsolation(config.getTransactionIsolation());`
- 🔴 `checkDefaultIsolation`: `defaultTransactionIsolation = connection.getTransactionIsolation();
  if (transactionIsolation == -1) { transactionIsolation = defaultTransactionIsolation; }`
  → an unconfigured pool adopts whatever the FIRST connection reported.
- 🔴 **The hole:** the proxy intercepts METHOD CALLS, not SQL. A raw
  `SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL ...` executed through
  a `Statement` sets no dirty bit and is never reset → it leaks to every future
  borrower of that physical connection. Same for `search_path`, `statement_timeout`,
  `application_name`. The per-transaction `SET TRANSACTION` form cannot leak.

### PostgreSQL 18 routine vacuuming — https://www.postgresql.org/docs/18/routine-vacuuming.html

- "an UPDATE or DELETE of a row does not immediately remove the old version of the
  row ... the row version must not be deleted while it is still potentially visible
  to other transactions."
- Bloat: "if a table has an unexpected spike in update activity, it may get bloated
  to the point that VACUUM FULL is really necessary to reclaim space."
- Finding the offender: "End long-running open transactions. You can find these by
  checking pg_stat_activity for rows where age(backend_xid) or age(backend_xmin) is
  large." (Also: old prepared transactions in pg_prepared_xacts, old replication
  slots in pg_replication_slots.)
- ⚠️ This page does NOT mention idle-in-transaction sessions in this context — do
  not attribute that to it.

### PostgreSQL 18 error codes — https://www.postgresql.org/docs/18/errcodes-appendix.html

"the first two characters of an error code denote a class of errors, while the last
three characters indicate a specific condition within that class."

- Class 08: 08000 connection_exception, 08003 connection_does_not_exist,
  08006 connection_failure, 08001 sqlclient_unable_to_establish_sqlconnection,
  08004 sqlserver_rejected_establishment_of_sqlconnection,
  08007 transaction_resolution_unknown, 08P01 protocol_violation.
- Class 23: 23000 integrity_constraint_violation, 23001 restrict_violation,
  23502 not_null_violation, 23503 foreign_key_violation, 23505 unique_violation,
  23514 check_violation, 23P01 exclusion_violation.
- Class 25: 25000 invalid_transaction_state, 25001 active_sql_transaction,
  25002 branch_transaction_already_active, 25008 held_cursor_requires_same_isolation_level,
  25003 inappropriate_access_mode_for_branch_transaction,
  25004 inappropriate_isolation_level_for_branch_transaction,
  25005 no_active_sql_transaction_for_branch_transaction, 25006 read_only_sql_transaction,
  25007 schema_and_data_statement_mixing_not_supported, 25P01 no_active_sql_transaction,
  🔴 25P02 in_failed_sql_transaction, 25P03 idle_in_transaction_session_timeout,
  🔴 25P04 transaction_timeout (new-ish; PG18 has it).
- Class 40: 40000 transaction_rollback, 40002 transaction_integrity_constraint_violation,
  🔴 40001 serialization_failure, 40003 statement_completion_unknown,
  🔴 40P01 deadlock_detected.
- Class 3B: 3B000 savepoint_exception, 3B001 invalid_savepoint_specification.
- Class 55: 55000 object_not_in_prerequisite_state, 55006 object_in_use,
  55P02 cant_change_runtime_param, 🔴 55P03 lock_not_available,
  55P04 unsafe_new_enum_value_usage.
- Class 57: 57000 operator_intervention, 🔴 57014 query_canceled, 57P01 admin_shutdown,
  57P02 crash_shutdown, 57P03 cannot_connect_now, 57P04 database_dropped,
  57P05 idle_session_timeout.

### pgJDBC connection parameters — https://jdbc.postgresql.org/documentation/use/

- `autosave` (default `never`): "Specifies what the driver should do if a query
  fails." · `always` = "JDBC driver sets a savepoint before each query, and rolls
  back to that savepoint in case of failure." · `never` = "no savepoint dance is
  made ever." · `conservative` = "savepoint is set for each query, however the
  rollback is done only for rare cases like 'cached statement cannot change return
  type' or 'statement XXX is not valid' so JDBC driver rolls back and retries".
- `cleanupSavepoints` (default `false`): "Determines if the SAVEPOINT created in
  autosave mode is released prior to the statement." 🔴 Justification quoted:
  "This is done to avoid running out of shared buffers on the server in the case
  where 1000's of queries are performed." — this is the ONLY primary source I found
  for savepoints having a real resource cost; there is no per-savepoint number
  anywhere, so do not invent one.
- `readOnlyMode` (default `transaction`): `ignore` = "the readOnly setting has no
  effect." · `transaction` = "readOnly is set to true and autocommit is false the
  driver will set the transaction to readonly by sending BEGIN READ ONLY." ·
  `always` = "the session will be set to READ ONLY if autoCommit is true. If
  autocommit is false the driver will set the transaction to read only by sending
  BEGIN READ ONLY."

### PostgreSQL 18 source, src/backend/tcop/postgres.c (REL_18_STABLE)

🔴 The aborted-transaction check, verbatim:

```c
/*
 * If we are in an aborted transaction, reject all commands except
 * COMMIT/ABORT.  It is important that this test occur before we try
 * to do parse analysis, rewrite, or planning, since all those phases
 * try to do database accesses, which may fail in abort state.
 */
if (IsAbortedTransactionBlockState() && !IsTransactionExitStmt(parsetree->stmt))
    ereport(ERROR,
            (errcode(ERRCODE_IN_FAILED_SQL_TRANSACTION),
             errmsg("current transaction is aborted, "
                    "commands ignored until end of transaction block"),
             errdetail_abort()));
```

- The same block appears in `exec_simple_query`, `exec_parse_message`,
  `exec_bind_message` and `exec_execute_message` — so there is no protocol path
  around it, prepared statements included.
- `IsTransactionExitStmt` permits **COMMIT, PREPARE, ROLLBACK, ROLLBACK TO
  SAVEPOINT**.
- ⚠️ NOT confirmed from primary docs: what command tag the server reports for
  COMMIT in an aborted block. Chunk 10 explicitly declines to claim it.

### PL/pgSQL Trapping Errors — https://www.postgresql.org/docs/18/plpgsql-control-structures.html

- "A block containing an EXCEPTION clause is significantly more expensive to enter
  and exit than a block without one. Therefore, don't use EXCEPTION without need."
- ⚠️ The page as fetched does NOT say this is because of subtransactions/savepoints
  — do not attribute the mechanism to it.

## Still owed / to verify — NOTHING for this topic

- (done) pgjdbc autosave / cleanupSavepoints / readOnlyMode — see above
- (done) Row-level lock modes, Table 13.3, SKIP LOCKED / NOWAIT — see below
- (done) deadlock_timeout, the four client timeouts, pg_stat_activity — see below

### PostgreSQL 18 §13.3.2 Row-Level Locks + SELECT locking clause

- FOR UPDATE "prevents them from being locked, modified or deleted by other
  transactions until the current transaction ends"; also acquired by any DELETE and
  by an UPDATE modifying columns "that have a unique index on them that can be used
  in a foreign key". Every other UPDATE takes FOR NO KEY UPDATE.
- FOR NO KEY UPDATE = weaker, does not block FOR KEY SHARE. FOR SHARE = shared,
  blocks UPDATE/DELETE/FOR UPDATE/FOR NO KEY UPDATE. FOR KEY SHARE = weakest, blocks
  only FOR UPDATE (plus DELETE and key-changing UPDATE).
- Table 13.3 conflicts: KEY SHARE×UPDATE; SHARE×{NO KEY UPDATE, UPDATE};
  NO KEY UPDATE×{SHARE, NO KEY UPDATE, UPDATE}; UPDATE×all four.
- 🔴 "Row-level locks do not affect data querying; they block only writers and
  lockers to the same row."
- 🔴 "PostgreSQL doesn't remember any information about modified rows in memory, so
  there is no limit on the number of rows locked at one time. However, locking a row
  might cause a disk write, e.g., SELECT FOR UPDATE modifies selected rows to mark
  them locked, and so will result in disk writes."
- 🔴 "Within a REPEATABLE READ or SERIALIZABLE transaction, however, an error will be
  thrown if a row to be locked has changed since the transaction started."
- Locking clause: `FOR <strength> [ OF from_reference ] [ NOWAIT | SKIP LOCKED ]`.
  NOWAIT "reports an error, rather than waiting"; SKIP LOCKED "any selected rows that
  cannot be immediately locked are skipped. Skipping locked rows provides an
  inconsistent view of the data, so this is not suitable for general purpose work,
  but can be used to avoid lock contention with multiple consumers accessing a
  queue-like table." Both "apply only to the row-level lock(s) — the required ROW
  SHARE table-level lock is still taken in the ordinary way."
- No table list → "affects all tables used in the statement"; views/sub-queries are
  reached; 🔴 WITH queries are NOT ("these clauses do not apply to WITH queries").
  Strongest clause wins; NOWAIT beats SKIP LOCKED. Cannot be used with aggregation.
- LIMIT: "locking stops once enough rows have been returned to satisfy the limit
  (but note that rows skipped over by OFFSET will get locked)."
- 🔴 ORDER BY Caution: at READ COMMITTED a locking SELECT with ORDER BY can return
  rows out of order because ORDER BY is applied first, then the lock wait happens.
  Workaround = locking clause in a sub-query, but that locks ALL rows. "At the
  REPEATABLE READ or SERIALIZABLE transaction isolation level this would cause a
  serialization failure (with an SQLSTATE of '40001')".

### PostgreSQL 18 §13.3.4 Deadlocks + deadlock_timeout

- "PostgreSQL automatically detects deadlock situations and resolves them by aborting
  one of the transactions involved... (Exactly which transaction will be aborted is
  difficult to predict and should not be relied upon.)"
- "deadlocks can also occur as the result of row-level locks (and thus, they can
  occur even if explicit locking is not used)." Worked example = two UPDATEs on
  acctnum 11111/22222 in opposite orders.
- "The best defense against deadlocks is generally to avoid them by being certain
  that all applications using a database acquire locks on multiple objects in a
  consistent order... One should also ensure that the first lock acquired on an
  object in a transaction is the most restrictive mode that will be needed for that
  object. If it is not feasible to verify this in advance, then deadlocks can be
  handled on-the-fly by retrying transactions that abort due to deadlocks."
- 🔴 "So long as no deadlock situation is detected, a transaction seeking either a
  table-level or row-level lock will wait indefinitely for conflicting locks to be
  released. This means it is a bad idea for applications to hold transactions open
  for long periods of time (e.g., while waiting for user input)."
- 🔴 `deadlock_timeout` = "the amount of time to wait on a lock before checking to
  see if there is a deadlock condition. The check for deadlock is relatively
  expensive... Increasing this value reduces the amount of time wasted in needless
  deadlock checks, but slows down reporting of real deadlock errors... The default is
  one second (1s), which is probably about the smallest value you would want in
  practice... Ideally the setting should exceed your typical transaction time." Also
  controls the delay before `log_lock_waits` logs a lock wait.
- `max_locks_per_transaction` / `max_pred_locks_per_transaction`: default 64 each,
  per server process, settable only at server start; "This is *not* the number of
  rows that can be locked; that value is unlimited."

### PostgreSQL 18 client timeouts (runtime-config-client.html)

All five default to 0 (disabled), milliseconds without a unit.
- `statement_timeout` "Abort any statement that takes more than the specified amount
  of time." Measured from command arrival to completion; applied per statement in a
  multi-statement simple-query message since v13. "Setting statement_timeout in
  postgresql.conf is not recommended because it would affect all sessions."
- `lock_timeout` "Abort any statement that waits longer than the specified amount of
  time while attempting to acquire a lock... The time limit applies separately to
  each lock acquisition attempt." "if statement_timeout is nonzero, it is rather
  pointless to set lock_timeout to the same or larger value."
- `idle_in_transaction_session_timeout` "Terminate any session that has been idle...
  within an open transaction... Even when no significant locks are held, an open
  transaction prevents vacuuming away recently-dead tuples that may be visible only
  to this transaction; so remaining idle for a long time can contribute to table
  bloat."
- `transaction_timeout` "Terminate any session that spans longer than the specified
  amount of time in a transaction." 🔴 "If transaction_timeout is shorter or equal to
  idle_in_transaction_session_timeout or statement_timeout then the longer timeout is
  ignored." Note: "Prepared transactions are not subject to this timeout."
- `idle_session_timeout` — outside a transaction. "Be wary of enforcing this timeout
  on connections made through connection-pooling software."

### PostgreSQL 18 pg_stat_activity (monitoring-stats.html)

`state` values, verbatim: `starting` "The backend is in initial startup..."; `active`
"The backend is executing a query."; `idle` "The backend is waiting for a new client
command."; `idle in transaction` "The backend is in a transaction, but is not
currently executing a query."; `idle in transaction (aborted)` "similar to idle in
transaction, except one of the statements in the transaction caused an error.";
`fastpath function call`; `disabled` (track_activities off).
Columns: `xact_start` "Time when this process' current transaction was started, or
null if no transaction is active."; `query_start` "Time when the currently active
query was started, or if state is not active, when the last query was started";
`state_change` "Time when the state was last changed"; `backend_xid` top-level xid;
`backend_xmin` "The current backend's xmin horizon"; `wait_event_type` / `wait_event`.

### PostgreSQL 18 §13.5 Serialization Failure Handling

- "While it's recommendable to just retry serialization_failure errors
  unconditionally, more care is needed when retrying these other error codes, since
  they might represent persistent error conditions rather than transient failures."
- 40P01: "It may also be advisable to retry deadlock failures."
- 23505 / 23P01: retryable only in the narrow case where the app derived a new key by
  inspecting stored keys — "this is effectively a serialization failure".
- 🔴 "It is important to retry the complete transaction, including all logic that
  decides which SQL to issue and/or which values to use. Therefore, PostgreSQL does
  not offer an automatic retry facility, since it cannot do so with any guarantee of
  correctness."
- "Transaction retry does not guarantee that the retried transaction will complete;
  multiple retries may be needed."

### PostgreSQL 18 SET TRANSACTION — READ ONLY, verbatim (re-fetched for exactness)

"When a transaction is read-only, the following SQL commands are disallowed: INSERT,
UPDATE, DELETE, MERGE, and COPY FROM if the table they would write to is not a
temporary table; all CREATE, ALTER, and DROP commands; COMMENT, GRANT, REVOKE,
TRUNCATE; and EXPLAIN ANALYZE and EXECUTE if the command they would execute is among
those listed. This is a high-level notion of read-only that does not prevent all
writes to disk."
- (done) SQLSTATE classes — see the error-codes section above
- (done) HikariCP dirty-bit reset — see the HikariCP section above
