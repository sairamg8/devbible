---
title: "JDBC: the interfaces, the driver underneath them, and everything that leaks through"
sidebar_label: "01 · JDBC"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql` / `javax.sql`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/)),
> the JDBC 4.3 specification, the pgJDBC documentation
> ([jdbc.postgresql.org/documentation/](https://jdbc.postgresql.org/documentation/))
> and the PostgreSQL 18 manual. Versions: JDK 25, JDBC 4.3, pgjdbc 42.7.13,
> PostgreSQL 18. No sandbox — the pages carry Java and SQL, never fabricated
> query logs.

**JDBC is a specification you code against and a driver you actually run. The
`java.sql` interfaces promise a portable minimum; pgJDBC delivers something
specific, and almost every surprise at this layer — the query that gets slow on
its sixth execution, the `getInt` that turns NULL into 0, the `SELECT` that
loads a million rows into your heap before returning the first one — lives in
the gap between the two. Every abstraction above this (JdbcTemplate, Hibernate,
Spring Data) is generating these calls, so a bug you cannot see here is a bug
you cannot debug there.**

This topic runs deep — **50 chunks, 13,838 lines**, because JDBC is what every
abstraction above it is generating. Read it in order; each chunk links to the
next.

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[What JDBC actually is](01-what-jdbc-actually-is.md)** | JDBC is a set of interfaces you never implement and a driver you never read |
| 2 | **[`DataSource`, not `DriverManager`](02-datasource-not-drivermanager.md)** | `DriverManager` is a factory for the most expensive object in your service |
| 3 | **[The JDBC URL](03-the-jdbc-url.md)** | The URL is configuration, and half of your connection behaviour hides in it |
| 4 | **[A `Connection` is expensive](04-connection-is-expensive.md)** | A `Connection` is a process on another machine, and it is not thread-safe |
| 5 | **[`PreparedStatement` and injection](05-preparedstatement-and-injection.md)** | SQL injection dies at the protocol layer, not at the escaping function |
| 6 | **[The `PreparedStatement` API](06-the-preparedstatement-api.md)** | Binding parameters: numbering from 1, nulls that need a type, and a `?` that isn't one |
| 7 | **[Reuse and parameter metadata](06b-reuse-and-parameter-metadata.md)** | Bound values outlive the execution, and that is a data-corruption bug waiting for a branch |
| 8 | **[What a parameter can be](07-what-a-parameter-can-be.md)** | `ORDER BY ?` does not work, and that is where the remaining injections live |
| 9 | **[Dynamic SQL without concatenation](07b-dynamic-sql-without-concatenation.md)** | The clever ways to avoid concatenating are safe, and most of them are slow |
| 10 | **[`IN` lists and `LIKE`](08-in-lists-and-like-patterns.md)** | One parameter for a whole list, and the wildcards your users didn't mean to type |
| 11 | **[Server-side prepared statements](09-server-side-prepared-statements.md)** | Preparation is a server-side cache with a five-execution fuse and a plan you did not choose |
| 12 | **[The generic plan cliff](10-the-generic-plan-cliff.md)** | Fast five times, then slow forever: the generic plan nobody deployed |
| 13 | **[The three statement types](11-statement-types.md)** | Three statement types, one of which you should almost never create |
| 14 | **[`ResultSet`: the cursor model](12-resultset-the-cursor-model.md)** | A `ResultSet` is a cursor over rows you have not necessarily received yet |
| 15 | **[Nulls, primitives and `wasNull`](13-nulls-and-wasnull.md)** | `getInt` on a NULL column returns 0, and nothing tells you |
| 16 | **[Dates, times and `timestamptz`](14-dates-times-and-timestamptz.md)** | `timestamp` and `timestamptz` are different types, and only one of them is an instant |
| 17 | **[Fetch size and streaming](15-fetch-size-and-streaming.md)** | By default the driver reads every row into your heap before you see the first one |
| 18 | **[Mapping rows to objects](16-mapping-rows-to-objects.md)** | Hand-written mapping is not primitive; it is the thing an ORM spends its life hiding |
| 19 | **[Resource handling](17-resource-handling.md)** | Every JDBC object is a handle on something that is not garbage, and closing is not optional |
| 20 | **[Ownership and leaks](18-ownership-and-leaks.md)** | A leaked connection is not found where it leaked, and that is the whole difficulty |
| 21 | **[Batch updates](19-batch-updates.md)** | A batch removes round trips, not work — and under autocommit it is still a transaction, just not the one you think |
| 22 | **[When a batch fails](19b-when-a-batch-fails.md)** | Inside a transaction pgJDBC reports every entry as EXECUTE_FAILED, including the ones that worked — and it is right to |
| 23 | **[Insert rewriting](19c-insert-rewriting.md)** | reWriteBatchedInserts turns one SQL text into up to fifteen, throws your update counts away, and silently does nothing if the insert has a RETURNING clause |
| 24 | **[Generated keys from a batch](19d-generated-keys-from-a-batch.md)** | getGeneratedKeys after executeBatch works on pgJDBC, is not in the specification, and hands you a ResultSet that is not guaranteed to line up with your batch |
| 25 | **[Sizing a batch](19e-sizing-a-batch.md)** | The whole batch is resident in your heap before a single byte leaves the JVM, so the chunk size is a memory decision before it is a performance one |
| 26 | **[Timeouts and cancellation](19f-timeouts-and-cancellation.md)** | The client timeout covers the whole batch and the server timeout restarts on every entry, and neither of them is a deadline |
| 27 | **[Locks and long transactions](19g-locks-and-long-transactions.md)** | Row locks are unlimited, which is exactly why a big batch hurts — the cost is the length of the transaction, not the size of a lock table |
| 28 | **[COPY instead of batching](19h-copy-instead-of-batching.md)** | PostgreSQL's own manual says COPY beats a prepared, batched, single-transaction INSERT — and the reason to switch is not only speed |
| 29 | **[Generated keys](20-generated-keys.md)** | Asking the database which id it just assigned has three APIs, and on PostgreSQL the convenient one answers a much bigger question than you asked |
| 30 | **[Reading keys, writing RETURNING](20b-reading-and-writing-returning.md)** | The generated-keys result set is an ordinary cursor, and the clause underneath it is one you are allowed to write yourself |
| 31 | **[Beyond INSERT and beyond keys](20c-returning-beyond-insert.md)** | RETURNING is not an insert feature and is not about keys: it is how you read the row the database actually stored |
| 32 | **[Batches and ON CONFLICT](20d-batches-and-on-conflict.md)** | A batch returns one key per row it affected, not per row you submitted, and nothing tells you which ones are missing |
| 33 | **[Client-side keys, and upward](20e-when-the-key-is-not-the-databases.md)** | The cheapest way to find out which id you were given is to have decided it yourself |
| 34 | **[`SQLException`](21-sqlexception.md)** | One exception class covers every database failure, and the only reliable way to ask it what went wrong is a five-character string |
| 35 | **[The `SQLException` hierarchy](21b-the-subclass-hierarchy.md)** | The subclass hierarchy puts \is retrying worth it\ into the type system, and the answer has three values, not two |
| 36 | **[What pgJDBC actually throws](21c-what-pgjdbc-throws.md)** | pgJDBC ignores the subclass hierarchy and hands you something better instead — a structured error object with the constraint name in it |
| 37 | **[The chain and the cause](21d-the-chain-and-what-to-do.md)** | A `SQLException` has a chain as well as a cause, and nothing in the JDK prints the chain |
| 38 | **[Retrying and translating](21e-retrying-and-translating.md)** | There are exactly three things to do with a `SQLException`, and the one everybody actually does is not on the list |
| 39 | **[Client-side timeouts](22-timeouts-cancellation-metadata.md)** | A timeout on the client stops you waiting; it does not stop the database working |
| 40 | **[Connection and socket timeouts](22b-connection-and-socket-timeouts.md)** | `setNetworkTimeout` does not fail your query — it destroys your connection |
| 41 | **[pgJDBC's timeout properties](22c-pgjdbc-timeout-properties.md)** | Every timeout pgJDBC ships is either off by default or measured in a unit you did not expect |
| 42 | **[The server's own timeouts](22d-server-side-timeouts.md)** | The only timeout that stops the database working is the one the database enforces |
| 43 | **[Setting the timeouts](22e-setting-the-timeouts.md)** | Every layer must be strictly larger than the one it backstops, or the destructive one fires first |
| 44 | **[How cancellation works](22f-how-cancellation-works.md)** | A cancel does not travel on the connection running the query — it arrives at the front door on a new one, carrying a password |
| 45 | **[What pgJDBC does](22f2-what-pgjdbc-actually-does.md)** | pgJDBC's cancel is forty lines of source, and three of them explain every cancel you have seen fail |
| 46 | **[When a cancel lands](22f3-when-a-cancel-lands.md)** | Interrupting the Java thread does not cancel the query — and on a virtual thread it destroys the connection instead |
| 47 | **[The operator's tools](22f4-the-operators-tools.md)** | Cancel first, terminate second — and `pg_terminate_backend` returning true does not mean the backend died |
| 48 | **[ResultSetMetaData: names](22g-metadata.md)** | `getColumnLabel` is the alias and `getColumnName` is the real column — except on PostgreSQL, where they are the same method |
| 49 | **[Types and mappers](22g2-metadata-types-and-mappers.md)** | The type methods answer three different questions, and the ones pgJDBC hardcodes tell you about the driver, not the database |
| 50 | **[DatabaseMetaData](22g3-databasemetadata.md)** | `DatabaseMetaData` exists so a tool can discover a database it has never seen — and your application is not that tool |

## Why this is a Master topic

Every later topic in this phase is a layer over these calls, and the failures
they produce are only diagnosable in JDBC's terms:

- HikariCP (topic 02) exists because chunk 4 is true — a connection is expensive
  and stateful.
- `@Transactional` (topic 04) is a proxy around chunk 4's `setAutoCommit`,
  `commit` and `rollback`.
- The N+1 problem (topic 08) is Hibernate emitting the `PreparedStatement`
  executions of chunks 6 and 9, one per row.
- Hibernate's `ScrollableResults` and Spring Data's `Stream` return types are
  chunk 15's four conditions, wrapped.

## The five things to carry out of here

1. **Parameters are never string concatenation** — chunks 5, 7 and 7b close the
   injection surface, including the two places a `?` cannot reach (identifiers,
   `LIKE` patterns) and the safe-but-slow forms people reach for instead.
2. **The sixth execution can be the slow one** — chunks 9 and 10 explain a
   production symptom that looks like nothing else, and chunk 9 explains the
   migration that makes it fail outright.
3. **A default `SELECT` is not lazy** — chunk 15 is why a report endpoint runs out
   of heap on a query that was fine in `psql`.
4. **A batch is not one transaction, and a client timeout is not a deadline** —
   chunks 19–19h and 22–22f4. Both are places where the obvious mental model is
   wrong in a way that only shows up under load.
5. **Close what you opened, and nothing else** — chunks 17 and 18. Leaking a
   connection ends the service; closing one you do not own breaks a transaction
   somebody else is running.

## Phase gate contribution

The phase gate asks you to read a SQL log and explain what the layer above
produced. This topic is what makes that log legible.

---

← Index: [Phase 10 — Data access](../README.md) · Start: [What JDBC actually is](01-what-jdbc-actually-is.md)
