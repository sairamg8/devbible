---
name: progress-java-p10-t01-batch
description: Java Phase 10 topic 01 chunk 19 (batch updates) — files written, verified claims, traps found
metadata:
  type: project
---

# Java P10 · topic 01 · batch updates (chunk 19)

**Written 2026-08-24 by a fork of session `bace755f`.**

Directory: `docs/java/pages/phase-10-data-access/01-jdbc/`.
Tier **Master**. Target stack JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13.
**No sandbox, no console blocks anywhere** — every claim is documentation- or
source-verified, and the pgJDBC facts come from reading the driver's own source.

## Files written

Chunk 19 was commissioned as one file (optionally two). The material came to
**2,123 lines**, so it was split on concept boundaries into **eight** files, per
the hard rule that 300 is a file-size cap and never a content budget. Nothing was
trimmed to fit; every split moved content verbatim.

| File | Lines | Gotchas | Questions | Concept |
|---|---|---|---|---|
| `19-batch-updates.md` | 294 | 5 | 5 | mechanics: round trips vs work, the four methods, autocommit + the implicit transaction block |
| `19b-when-a-batch-fails.md` | 298 | 7 | 4 | the three update-count values, PostgreSQL never continues, `EXECUTE_FAILED` inside a transaction, the exception chain |
| `19c-insert-rewriting.md` | 296 | 4 | 5 | `reWriteBatchedInserts`, power-of-two decomposition, the ceilings, `SUCCESS_NO_INFO`, the `RETURNING` silent no-op |
| `19d-generated-keys-from-a-batch.md` | 291 | 7 | 3 | `getGeneratedKeys` after `executeBatch`, what it costs, the alignment trap |
| `19e-sizing-a-batch.md` | 262 | 9 | 4 | client heap, the chunked-load loop, choosing the number |
| `19f-timeouts-and-cancellation.md` | 232 | 6 | 3 | `setQueryTimeout` vs `statement_timeout` granularity, CancelRequest |
| `19g-locks-and-long-transactions.md` | 209 | 4 | 4 | row locks, deadlocks, `autosave`, `40001` |
| `19h-copy-instead-of-batching.md` | 241 | 6 | 4 | `COPY`, `CopyManager`, what you give up, the staging-table pattern |

**Totals: 2,123 lines, 48 gotchas, 32 interview questions. No file over 300.**
All internal links resolve against the filesystem (checked file-by-file; the site
was **not** built — the build/dev-server registry was not claimed).

⚠️ **`sidebar_position` is fractional — `19`, then `19.1` … `19.7`.** Deliberate:
integer positions 20–26 would collide with a future chunk 20 in the same flat
directory. Docusaurus accepts floats.

Each file carries its own tier badge, `> Verified:` line, Gotchas and Interview
sections, and ends with the literal `<!--FOOTER-->` line for the coordinator to
wire Prev/Next.

## Load-bearing claims and their sources

### From the JDK 25 javadoc (docs.oracle.com/en/java/javase/25/docs/api/java.sql/)

- `addBatch(String)`: "This method cannot be called on a `PreparedStatement` or
  `CallableStatement`."
- `executeBatch` element values: `>= 0`, `SUCCESS_NO_INFO`, `EXECUTE_FAILED`;
  `EXECUTE_FAILED` "occurs only if a driver continues to process commands after a
  command fails".
- `executeBatch` throws if a command "fails to execute properly **or attempts to
  return a result set**".
- Batch timeout granularity is "implementation defined".
- `BatchUpdateException` javadoc recommends `getLargeUpdateCounts` after
  `executeLargeBatch` to avoid integer overflow.
- `getGeneratedKeys` is specified against "executing this `Statement` object" —
  **batches are never mentioned**, so batch key retrieval is driver-specific.

### From the PostgreSQL 18 manual

- **Pipelining, §55.2.4**: an implicit transaction block starts when a command
  ends without a Sync; each Sync commits or rolls back. 🔴 **This is why a pgJDBC
  batch under autocommit is still atomic per Sync segment** — contradicts the
  common online claim that "a batch under autocommit is not one transaction".
- **§55.2.3**: on error the backend "reads and discards messages until a Sync is
  reached" — so on PostgreSQL nothing after the failing entry ever runs.
- **§55.2.8 Canceling Requests**: a cancel opens a *new connection*; "the
  cancellation signal might or might not have any effect"; the frontend "has no
  direct way to tell whether a cancel request has succeeded".
- 🔴 **`statement_timeout` under the extended protocol "starts running when any
  query-related message (Parse, Bind, Execute, Describe) arrives, and it is
  canceled by completion of an Execute or Sync message"** — i.e. it restarts per
  batch entry, the **opposite** granularity to `setQueryTimeout`.
  `transaction_timeout` is the one that bounds a whole batch server-side, and it
  covers "an implicitly started transaction" too.
- `statement_timeout`, `lock_timeout`, `transaction_timeout`: "setting … in
  `postgresql.conf` is not recommended because it would affect all sessions."
- 🔴 **`max_locks_per_transaction` "is *not* the number of rows that can be
  locked; that value is unlimited"** — kills the common "big batch exhausts the
  lock table" theory.
- `deadlock_timeout` default `1s`, because "the check for deadlock is relatively
  expensive".
- **§14.4**: "loading a large number of rows using `COPY` is almost always faster
  than using `INSERT`, even if `PREPARE` is used and multiple insertions are
  batched into a single transaction"; and build indexes *after* the load.
- **INSERT**: `RETURNING` returns "only rows that were successfully inserted or
  updated".
- **COPY**: "will invoke any triggers and check constraints … However, it will
  not invoke rules." PG18 `ON_ERROR ignore` covers only **type conversion**
  errors, `text`/`csv` only; default `stop`.
- **Bind message parameter count is `Int16`** → 65535 parameters max.
- SQLSTATEs used: `25P02` in_failed_sql_transaction, `40001`
  serialization_failure, `40P01` deadlock_detected, `23505` unique_violation.
- **Transaction isolation §13.2**: `40001` always, and "applications using this
  level must be prepared to retry transactions".

### From pgJDBC source (github.com/pgjdbc/pgjdbc, master)

- `PgStatement.internalExecuteBatch`: `if (connection.getAutoCommit()) flags |=
  QueryExecutor.QUERY_SUPPRESS_BEGIN;` → **no `BEGIN` under autocommit**; and
  `startTimer()` is called **once** for the whole batch → **`setQueryTimeout`
  covers the entire `executeBatch`**. Also `QUERY_NO_RESULTS` when keys are not
  wanted ("disallow any result set"), `QUERY_BOTH_ROWS_AND_STATUS |
  QUERY_NO_BINARY_TRANSFER` when they are (GitHub issue #267), and an extra
  Describe before batching "so `flushIfDeadlockRisk` can estimate response sizes".
  `executeBatch` returns `new int[0]` for an empty batch, and clears
  `batchStatements`/`batchParameters` at the **start**.
- `QueryExecutorImpl`: `MAX_BUFFERED_RECV_BYTES = 64000`,
  `NODATA_QUERY_RESPONSE_SIZE_BYTES = 250`; `flushIfDeadlockRisk` forces a Sync
  and calls `batchHandler.secureProgress()`. 🔴 **So a large autocommit batch is
  many implicit transactions, roughly every 64000/250 ≈ 256 entries** (arithmetic
  on the two constants — the source calls the estimate "coarse"; **not** a
  measurement). Batch path: `sendQueryPreamble` → `sendAutomaticSavepoint(queries[0])`
  **once, before the loop** → loop of `sendQuery` → single `sendSync()`.
- `BatchResultHandler`: `isProgressDurable()` = `autoCommit && transactionState
  == IDLE`. 🔴 **Inside an explicit transaction `committedRows` stays 0, so
  `Arrays.fill(..., EXECUTE_FAILED)` marks EVERY entry failed, including ones the
  server accepted.** Message template: `"Batch entry {0} {1} was aborted: {2}
  Call getNextException to see other errors in the batch."`; the real error is
  both the cause and the next exception. `getUpdateCounts()` substitutes
  `SUCCESS_NO_INFO` for any count > `Integer.MAX_VALUE`. `uncompressLongUpdateCount`
  turns a rewritten block's count into `SUCCESS_NO_INFO` ("we do not really know
  how did they spread over individual statements"). `handleError` clears
  `allGeneratedRows`. Generated rows are only collected when `updateCount > 0`.
- `SqlCommand`: rewrite-compatible requires INSERT + property on + parseable
  `VALUES (` `)` braces + **no `RETURNING`** + `priorQueryCount == 0`.
- `Parser.addReturning` appends `"\nRETURNING "` then `*` or the named columns →
  🔴 **`getGeneratedKeys` silently disables `reWriteBatchedInserts`.**
- `BatchedQuery.MAX_VALUE_BLOCK = 1 << 15` (32768), cache sized
  `Integer.numberOfTrailingZeros(MAX_VALUE_BLOCK)` → **at most 15 derived
  statements**.
- `PgPreparedStatement.transformQueriesAndParameters`: `maxValueBlocks =
  highestOneBit(max(1, min(maximumNumberOfParameters()/bindCount, rowCeiling)))`,
  statement count = `fullBlocks + Integer.bitCount(remainder)`.
  🔴 **A chunk of 1000 rows → 6 statements; 1024 → 1. Chunk in powers of two.**
- `PGProperty` defaults used: `reWriteBatchedInserts` **false**,
  `reWriteBatchedInsertsSize` **0** (rounded down to a power of two, capped 32768,
  and `min(65535/parametersPerRow, 32768)` under the extended protocol),
  `preparedStatementCacheQueries` **256**, `logServerErrorDetail` **true**,
  `socketTimeout` **0**, `cancelSignalTimeout` **10**, `autosave` **never**,
  `prepareThreshold` **5**.
- `CopyManager` javadoc: "API for PostgreSQL COPY bulk data transfer"; `copyIn`
  overloads "use `COPY FROM STDIN` for very fast copying"; `Reader`/`InputStream`/
  `ByteStreamWriter` forms with `bufferSize` variants; returns rows as `long`.

## Traps found

- 🔴 **Pre-existing broken link, NOT mine, left alone deliberately:**
  `09-server-side-prepared-statements.md` line 84 links to `18-batch-updates.md`
  (a file that does not exist) and calls it "chunk 17". Whoever owns chunk 18 or
  the topic README should repoint it at `19-batch-updates.md`. I was told to touch
  no other file.
- The topic `README.md` chunk table stops at 16 and does **not** list 17 or any of
  19–19h. The coordinator still has to wire: README table rows, the eight
  `<!--FOOTER-->` Prev/Next lines, and the four UI boards.
- `sidebar_position` for the 19x family is fractional (19.1–19.7) to avoid
  colliding with a future integer chunk 20. Do not "tidy" these to integers.
- MDX safety: `Iterable<Throwable>`, `Function<ResultSet, T>` and `String[] { "id" }`
  appear inside inline code spans (one span wraps a line break in
  `19d`, line 101–102). That pattern is already used in `16-mapping-rows-to-objects.md`,
  so it is known-good — do not "fix" it.
- The four biggest things that contradict widely-repeated advice, and which a
  reviewer may push back on: (1) an autocommit batch on pgJDBC **is** atomic per
  Sync segment; (2) `statement_timeout` does **not** bound a batch, it restarts
  per entry; (3) all-`EXECUTE_FAILED` inside a transaction is correct, not a bug;
  (4) `max_locks_per_transaction` has nothing to do with row locks. All four are
  quoted from primary sources in the pages.

## 🔴 Overlap with chunks 20 and 22, written in parallel — COORDINATOR MUST RECONCILE

While this chunk was being written, other forks wrote **chunk 20 · Generated keys**
(`20-generated-keys.md`, `20b`–`20e`) and **chunk 22 · Client-side timeouts**
(`22-timeouts-cancellation-metadata.md`, `22b`–`22f`) into the same directory.
Two of my files overlap them substantially:

| Mine | Theirs | Overlap |
|---|---|---|
| `19d-generated-keys-from-a-batch.md` | `20d-batches-and-on-conflict.md` | **near-duplicate thesis** — both argue "a batch returns one key per row it affected, not per row you submitted"; both cover the `ON CONFLICT DO NOTHING` alignment trap |
| `19f-timeouts-and-cancellation.md` | `22`, `22d`, `22f` | `setQueryTimeout` semantics, `socketTimeout`, server-side timeouts, the CancelRequest-over-a-second-connection mechanism |

I did **not** edit their files and did **not** link into them, because they may
still be renamed. **The coordinator has to pick one of two shapes:**

1. **Keep both** — mine are scoped to *batches specifically* (whole-batch timer,
   forced Syncs, `EXECUTE_FAILED` watermark), theirs to the general feature.
   Then add cross-links and trim nothing.
2. **Fold** — delete `19d` and `19f`, move their batch-specific facts into `20d`
   and `22`, and repoint the 19-family links (`19`, `19b`, `19c`, `19e`, `19g`,
   `19h` all reference `19d` and/or `19f`).

⚠️ **`22d-server-side-timeouts.md` has a mismatched frontmatter**: `sidebar_label:
"25 · The server's own timeouts"` with `sidebar_position: 25`, in a file named
`22d`. Not mine — flagging only.

✅ Positions do not collide: they also used fractions (`20.3`, `22.6`), mine are
`19.1`–`19.7`.

## Still owed

- **Not built.** The docs site was not compiled — the shared build/dev-server
  registry (`shared/session_build_devserver_registry.md`) was not claimed, per the
  hard rule about one build at a time. Links were verified by resolving each
  target against the filesystem instead. A later session that claims the registry
  should do a clean rebuild and grep for `warning|broken`.
- **Boards not wired** (README, `src/data/progress.js`, `docs/java/pages/README.md`,
  `docs/README.md`, and the `updated:` stamp) — the fork was scoped to the topic
  directory only and told not to touch other files. The coordinator owns this.
- Nothing was left unverified in the pages: no claim that documentation or the
  driver source could not settle was written as fact.
