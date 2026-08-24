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

This topic runs deep. The chunks, in reading order:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What JDBC actually is](01-what-jdbc-actually-is.md)** | Specification vs driver, `java.sql` vs `javax.sql`, how `DriverManager` finds a driver, why `Class.forName` still appears |
| 2 | **[`DataSource`, not `DriverManager`](02-datasource-not-drivermanager.md)** | The factory for the most expensive object in the service, and why nothing in application code should call it |
| 3 | **[The JDBC URL](03-the-jdbc-url.md)** | Half your connection behaviour is configuration hidden in a string — timeouts, TLS, prepare thresholds |
| 4 | **[A `Connection` is expensive](04-connection-is-expensive.md)** | A process on another machine, not thread-safe, and carrying session state back to the pool |
| 5 | **[`PreparedStatement` and injection](05-preparedstatement-and-injection.md)** | Why injection dies at the protocol layer and not at an escaping function |
| 6 | **[The `PreparedStatement` API](06-the-preparedstatement-api.md)** | Indexes from 1, `setNull` and its type argument, the `?` that is not a parameter |
| 7 | **[What a parameter can be](07-what-a-parameter-can-be.md)** | `ORDER BY ?` does not work — identifiers, and where the last real injections live |
| 8 | **[`IN` lists and `LIKE`](08-in-lists-and-like-patterns.md)** | One parameter for a whole list, and the wildcards a user did not mean to type |
| 9 | **[Server-side prepared statements](09-server-side-prepared-statements.md)** | The five-execution fuse, the server-side cache, and what actually gets reused |
| 10 | **[The generic plan cliff](10-the-generic-plan-cliff.md)** | Fast five times then slow forever — the plan nobody deployed |
| 11 | **[The three statement types](11-statement-types.md)** | `Statement`, `PreparedStatement`, `CallableStatement` — one you should almost never create |
| 12 | **[`ResultSet`: the cursor model](12-resultset-the-cursor-model.md)** | A cursor over rows you may not have received yet; what closing really closes |
| 13 | **[Nulls, primitives and `wasNull`](13-nulls-and-wasnull.md)** | `getInt` on NULL returns 0 and nothing tells you |
| 14 | **[Dates, times and `timestamptz`](14-dates-times-and-timestamptz.md)** | `timestamp` and `timestamptz` are different types and only one is an instant |
| 15 | **[Fetch size and streaming](15-fetch-size-and-streaming.md)** | The four conditions that must all hold before a single row streams |
| 16 | **[Mapping rows to objects](16-mapping-rows-to-objects.md)** | The row mapper by hand — what `JdbcTemplate` and Hibernate are doing for you |

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

## The three things to carry out of here

1. **Parameters are never string concatenation** — chunks 5, 7 and 8 close the
   injection surface, including the two places (identifiers, `LIKE` patterns) a
   `?` cannot reach.
2. **The sixth execution can be the slow one** — chunks 9 and 10 explain a
   production symptom that looks like nothing else.
3. **A default `SELECT` is not lazy** — chunk 15 is why a report endpoint OOMs
   with a query that was fine in `psql`.

## Phase gate contribution

The phase gate asks you to read a SQL log and explain what the layer above
produced. This topic is what makes that log legible.

---

← Index: [Phase 10 — Data access](../README.md) · Start: [What JDBC actually is](01-what-jdbc-actually-is.md)
