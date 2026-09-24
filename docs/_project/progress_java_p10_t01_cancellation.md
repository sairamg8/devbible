---
name: progress-java-p10-t01-cancellation
description: Java Phase 10 topic 01 chunks 22f/22g (cancellation mechanics, JDBC metadata) — files written, verified claims, traps found
metadata:
  type: project
---

# Java P10 · topic 01 · cancellation and metadata (chunks 22f, 22g)

**Written 2026-08-24 by a fork of session `bace755f`** (a retry — the original fork
died mid-topic after writing 22 through 22e).

Directory: `docs/java/pages/phase-10-data-access/01-jdbc/`

## Files written

| File | Lines | Gotchas | Questions |
|---|---|---|---|
| `22f-how-cancellation-works.md` | 289 | 6 | 5 |
| `22f2-what-pgjdbc-actually-does.md` | 300 | 5 | 6 |
| `22f3-when-a-cancel-lands.md` | 300 | 6 | 5 |
| `22f4-the-operators-tools.md` | 237 | 6 | 5 |
| `22g-metadata.md` | 282 | 6 | 5 |
| `22g2-metadata-types-and-mappers.md` | 272 | 7 | 5 |
| `22g3-databasemetadata.md` | 300 | 7 | 6 |

✅ **ALL SEVEN WRITTEN.** 1,980 lines, 0 over the 300-line cap, 43 gotchas, 37
interview questions. Every internal link resolves against the filesystem. 15 code
fences, all `java` or `sql` — **no console block anywhere**, nothing measured,
nothing invented.

⚠️ **The brief asked for exactly two files (`22f`, `22g`), splitting only if a file
genuinely exceeded 300 lines. It does — repeatedly.** A single `22f` draft came to
554 lines; a two-way split still left 434/346. Cancellation has four concept
boundaries (protocol · driver implementation · what a landed cancel means ·
the operator's SQL functions) and metadata has three (`ResultSetMetaData` names ·
types and generic mappers · `DatabaseMetaData`). **Seven chunks in total.** The
coordinator must wire Prev/Next across
**22f → 22f2 → 22f3 → 22f4 → 22g → 22g2 → 22g3**, not 22f → 22g.

Sidebar positions used: 22.6, 22.62, 22.64, 22.66, 22.7, 22.72, 22.74.

## Load-bearing claims and their sources

Everything below was read from a primary source in this session. No sandbox, no
database, no console block anywhere in the pages.

### The protocol (postgresql.org/docs/18/protocol-flow.html §54.2.8)

- The cancel is **not** sent on the busy connection, and the stated reason is
  efficiency, not security: *"we don't want to have the backend constantly checking
  for new input from the frontend during query processing. Cancel requests should be
  relatively infrequent, so we make them slightly cumbersome in order to avoid a
  penalty in the normal case."*
- *"the frontend opens a new connection to the server and sends a CancelRequest
  message, rather than the StartupMessage… The server will process this request and
  then close the connection."*
- *"For security reasons, no direct reply is made to the cancel request message."*
- Best effort, verbatim: *"The cancellation signal might or might not have any
  effect — for example, if it arrives after the backend has finished processing the
  query, then it will have no effect."* and *"Issuing a cancel simply improves the
  odds that the current query will finish soon, and improves the odds that it will
  fail with an error message instead of succeeding."*
- The key is the only credential: *"A CancelRequest message will be ignored unless it
  contains the same key data (PID and secret key) passed to the frontend during
  connection start-up."*

### The packet (postgresql.org/docs/18/protocol-message-formats.html)

- `CancelRequest` = Int32 length (incl. self) · Int32 `80877102` (`1234` high 16
  bits, `5678` low) · Int32 PID · Byte*n* key to end of message, **max 256 bytes**.
- 🔴 **Key length changed in PG18's protocol 3.2**: *"Before protocol version 3.2,
  the secret key was always 4 bytes long."* From 3.2: min 4, max 256, *"The
  PostgreSQL server only sends keys up to 32 bytes"*, larger ceiling reserved for
  poolers/middleware. This contradicts every pre-2025 blog that says "4-byte key".

### pgjdbc `REL42.7.13` — read from raw.githubusercontent.com

- `PgStatement.cancel()`: returns **silently** if `statementState == IDLE`; then a
  `compareAndSet(IN_QUERY → CANCELING)` that also returns silently on failure. Takes
  the connection lock, calls `connection.cancelQuery()`, and in a `finally` sets
  `IDLE` + `signalAll()`.
- `PgConnection.cancelQuery()` = `checkClosed()` + `queryExecutor.sendQueryCancel()`.
- `QueryExecutorBase.sendQueryCancel()`: returns silently if `cancelKey == null`
  ("It might be the cancel key is not received yet"); builds `new PGStream(
  pgStream.getSocketFactory(), pgStream.getHostSpec(), cancelSignalTimeout,
  cancelKey.length + 12)`; sends `len=key.length+12`, `Int2 1234`, `Int2 5678`,
  `Int4 pid`, key; `flush()`; **`receiveEOF()`**.
- 🔴 **`catch (IOException e) { // Safe to ignore. LOGGER.log(Level.FINEST, …) }`** —
  every network failure on the cancel path is invisible above `FINEST`.
- 🔴 **No SSL/GSS on the cancel socket.** `sendQueryCancel()` never calls
  `enableSSL`; the login path in `ConnectionFactoryImpl` does GSS then SSL then the
  startup packet. So the cancel key crosses the wire in clear text even on a TLS
  connection. Corroborated as a real class of defect by libpq's docs
  (postgresql.org/docs/18/libpq-cancel.html), which deprecate `PQcancel`/`PQgetCancel`
  *"due to not sending the cancel requests in an encrypted manner, even when the
  original connection specified `sslmode` or `gssencmode`"*, while `PQcancelCreate`
  makes the cancel connection *"with these same requirements"*.
- 🔴 **pgjdbc 42.7.13 negotiates protocol 3.0 by default, so it still gets a 4-byte
  key.** `ConnectionFactoryImpl` reads `PGProperty.PROTOCOL_VERSION`, whose declared
  default is the string `"3"`; with no decimal it sets major 3 / minor 0. The
  `ProtocolVersion` enum knows `v3_0` and `v3_2`, and `protocolVersion=3.2` selects
  the newer one. ⚠️ The `PGProperty` description still reads *"currently only version
  3 is supported"* — the docs lag the code.
- `killTimerTask()` blocks until the state is `IDLE`, waiting on the connection lock
  condition; **catches `InterruptedException`, sets a local flag and keeps waiting**,
  re-interrupting only at the end.
- `PSQLState.QUERY_CANCELED("57014")` exists; `SQLTimeoutException` does not appear
  in `PgStatement.java` / `QueryExecutorImpl.java` (already recorded in chunk 22).

### JDK 25 javadoc

- `Statement.cancel()`, verbatim and complete: *"Cancels this `Statement` object if
  both the DBMS and driver support aborting an SQL statement. This method can be
  used by one thread to cancel a statement that is being executed by another
  thread."* Throws `SQLFeatureNotSupportedException`; throws if the statement is
  closed. Returns `void` — no success signal.
- 🔴 **`java.net.Socket.getInputStream()` on JDK 25**: *"The socket uses the
  system-default socket implementation and a virtual thread is reading from the input
  stream. In that case, interrupting the virtual thread will cause it to wakeup and
  close the socket. The read method will then throw `SocketException` with the
  interrupt status set."* Same wording for `getOutputStream()`. **This means
  `Thread.interrupt()` on a virtual thread blocked in a JDBC read destroys the
  connection without cancelling anything on the server** — worse than useless. On a
  platform thread the interrupt does nothing at all. The class description says
  nothing about virtual threads; only the two stream methods do.

### PostgreSQL admin functions (postgresql.org/docs/18/functions-admin.html)

- `pg_cancel_backend(pid integer) → boolean`, sends **SIGINT**, cancels the current
  query only. Allowed to the same role, to `pg_signal_backend` members; only
  superusers can cancel superuser backends; `pg_signal_autovacuum_worker` is an
  explicit exception.
- `pg_terminate_backend(pid integer, timeout bigint DEFAULT 0) → boolean`, sends
  **SIGTERM**, ends the session. *"If timeout is not specified or zero, this function
  returns `true` whether the process actually terminates or not"*; with a positive
  timeout in ms it waits, and *"On timeout, a warning is emitted and `false` is
  returned."*
- Error codes: `57014 query_canceled`, `55P03 lock_not_available`,
  `57P01 admin_shutdown`, `57P05 idle_session_timeout`.

### pgjdbc `ResultSetMetaData` / `DatabaseMetaData` (for 22g — already gathered)

- 🔴 **`PgResultSetMetaData.getColumnName(column)` is literally
  `return getColumnLabel(column);`** — on PostgreSQL the JDBC distinction between the
  alias and the underlying column **collapses**. The real column name is only
  reachable through the pgjdbc extension `PGResultSetMetaData.getBaseColumnName()`,
  which triggers a catalog query. This contradicts the standard "getColumnLabel is
  the alias, getColumnName is the real column" advice found everywhere online.
- `isNullable()`, `isAutoIncrement()`, `getTableName()` (= `getBaseTableName()`) all
  call `fetchFieldMetaData()`, which runs a **large `pg_catalog` join** (pg_class +
  pg_namespace + pg_attribute + pg_type + pg_attrdef) and caches it in the
  connection's field-metadata cache. **Metadata is a round trip, not a local lookup.**
- `isNullable()` returns `ResultSetMetaData.columnNullable` when metadata is absent —
  it **guesses "nullable"**, never `columnNullableUnknown`.
- Hardcoded / made-up answers in pgjdbc: `getSchemaName()` → `""`,
  `getCatalogName()` → `""`, `isReadOnly()` → `false`, `isWritable()` →
  `!isReadOnly()` (so always true), `isSearchable()` → `true`,
  `getMaxConnections()` → **`8192`** (not the server's `max_connections`),
  `getIdentifierQuoteString()` → `"\""`, `getSearchStringEscape()` → `"\\"`,
  `supportsGetGeneratedKeys()` → `true`.
- `getColumnTypeName()` **lies helpfully**: for an auto-increment `int4`/`int8`/`int2`
  it returns `serial`/`bigserial`/`smallserial` rather than the real type name.
- The source comments are themselves evidence for the "runtime feature detection is
  not portability" argument — `isDefinitelyWritable` carries *"Hmmm...this is a bad
  one… I cannot tell is the short answer."*
- JDK 25 javadoc: `getColumnLabel` = *"the designated column's suggested title for
  use in printouts and displays. The suggested title is usually specified by the SQL
  `AS` clause. If a SQL `AS` is not specified, the value returned from
  `getColumnLabel` will be the same as the value returned by the `getColumnName`
  method."* `getColumnName` = *"Get the designated column's name."*
- `isNullable` returns one of `columnNoNulls` / `columnNullable` /
  `columnNullableUnknown`.
- `DatabaseMetaData` javadoc: *"A user for this interface is commonly a tool that
  needs to discover how to deal with the underlying DBMS."* Pattern arguments: `%`
  matches any substring, `_` any one character, and *"If a search pattern argument is
  set to `null`, that argument's criterion will be dropped from the search."* Extra
  vendor columns *"must be accessed by their column label"*.

## Traps found

1. 🔴 **Chunk 22's outbound links were broken and someone fixed them mid-session.**
   `22-timeouts-cancellation-metadata.md` originally linked to
   `22c-server-side-timeouts.md` and `22d-how-cancellation-works.md`, neither of
   which exists (the real files are `22d-server-side-timeouts.md` and
   `22f-how-cancellation-works.md`). It was corrected on disk while this fork was
   working. ⚠️ **`22c-pgjdbc-timeout-properties.md` still links twice to
   `22e-how-cancellation-works.md`** (lines ~59 and ~180) — that file does not exist
   and will break the build. The correct target is
   `22f-how-cancellation-works.md`. **Not fixed here** (out of scope: do not touch
   the five existing files).
2. **Do not put the label-vs-index discussion in 22g.** Chunk 12 already covers it
   thoroughly for *reading values*, including the duplicate-`id`-on-a-join trap and
   the javadoc's "first matching column will be returned". 22g must be about
   *introspection*, and link to chunk 12 for the rest.
3. **Chunk 22 already owns `SQLTimeoutException` not being thrown**, the
   seconds-vs-milliseconds table, and `PgStatement.setQueryTimeoutMs`. Chunks 22b–22e
   own `setNetworkTimeout`, the socket properties, the five GUCs, and the ordering
   rule. Cancellation chunks must link, not re-explain.
4. **Rule 1 bites hard on this topic.** Written at the depth the corpus expects
   (7–10 gotchas, 5–7 questions, javadoc quoted verbatim), each concept lands at
   250–300 lines on its own. Budget one file per concept boundary from the start
   rather than writing 550 lines and splitting afterwards.
5. `raw.githubusercontent.com/pgjdbc/pgjdbc/REL42.7.13/pgjdbc/src/main/java/...` works
   and is far cheaper than WebFetch on the GitHub UI. Files used:
   `core/QueryExecutorBase.java`, `jdbc/PgStatement.java`, `jdbc/PgConnection.java`,
   `core/v3/ConnectionFactoryImpl.java`, `core/ProtocolVersion.java`, `PGProperty.java`,
   `jdbc/PgResultSetMetaData.java`, `jdbc/PgDatabaseMetaData.java`, `util/PSQLState.java`.

## Still owed

- **Boards are NOT wired.** No `README.md`, `src/data/progress.js`, phase README or
  root `docs/README.md` edits were made — out of scope for this fork, and the
  coordinator must do it. The topic README needs **seven** new rows, not two.
- **No build was run** (rule 12 — the dev-server/build registry was not claimed). The
  pages were **link-checked against the filesystem**, not built.
- **Could not confirm** whether a pgjdbc connection using a *custom* TLS
  `socketFactory` would encrypt the cancel socket. The source reuses
  `pgStream.getSocketFactory()`, so it plausibly would, but nothing was tested and
  chunk 22f2 says so in the page rather than guessing.
- **Could not confirm** the JDK 25 virtual-thread interrupt behaviour when pgjdbc's
  socket is wrapped in an `SSLSocket`. The javadoc guarantee names the "system-default
  socket implementation" only. Chunk 22f3 states this as unconfirmed.
- **Did not verify** whether PostgreSQL 18 servers accept a protocol-3.0 cancel key
  from a client that later upgrades, or how poolers behave with 3.2 keys. Chunk 22f
  recommends testing `protocolVersion=3.2` rather than asserting it works.
