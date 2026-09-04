---
title: "One helper class is why `JdbcTemplate` joins your transaction, and calling `dataSource.getConnection()` yourself steps outside it"
sidebar_label: "9 · The connection"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the `DataSourceUtils` and
> `TransactionAwareDataSourceProxy` javadoc
> ([docs.spring.io/.../jdbc/datasource/DataSourceUtils.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/DataSourceUtils.html)),
> the Spring Framework 7.0 reference *Data Access → JDBC Core Classes* and
> *Transaction Management*
> ([docs.spring.io/.../jdbc/core.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html)).
> JDK 25, Spring Framework 7.0.9, PostgreSQL 18.

**A `JdbcClient` call inside a `@Transactional` method runs on the transaction's
connection, commits with it and rolls back with it — and there is nothing in the
repository that says so. The mechanism is a single class,
`DataSourceUtils`, and it is worth twenty minutes because the moment you understand
it you also understand every way people accidentally step outside a transaction.
Transaction *semantics* belong to
[Topic 04](../04-spring-transactional/README.md); this chunk is only about how the
JDBC layer finds the right `Connection`.**

## Two ways to get a connection, and only one is transaction-aware

```java
Connection a = dataSource.getConnection();                 // a fresh one from the pool
Connection b = DataSourceUtils.getConnection(dataSource);  // the transaction's, if there is one
```

The javadoc for the second states the whole behaviour:

> "Is aware of a corresponding Connection bound to the current thread, for example
> when using `DataSourceTransactionManager`. Will bind a Connection to the thread if
> transaction synchronization is active."

and the reference confirms `JdbcTemplate` is one of its users: it is "used internally
by Spring's `JdbcTemplate`, Spring's JDBC operation objects and the JDBC
`DataSourceTransactionManager`".

So the sequence inside any `JdbcTemplate` operation is:

1. `DataSourceUtils.getConnection(dataSource)` — returns the thread-bound
   connection if a transaction is active, otherwise a pooled one.
2. Do the work.
3. `DataSourceUtils.releaseConnection(con, dataSource)`.

Step 3 is the other half, and its javadoc is equally explicit:

> "Close the given Connection, obtained from the given DataSource, if it is **not
> managed externally** (that is, not bound to the thread)."

That is why a repository method inside a transaction does not close the connection
out from under the transaction manager. The template asks to release it; the helper
sees it is thread-bound and declines.

The thread-binding itself — a `ThreadLocal` holding a `ConnectionHolder` — is
**[Thread binding](../04-spring-transactional/07-thread-binding.md)**, and the safe
way to obtain a raw `Connection` when you genuinely need one is
**[Getting the connection safely](../04-spring-transactional/07b-getting-the-connection-safely.md)**.

## With no transaction: autocommit, one statement at a time

Outside a transaction there is nothing bound to the thread, so every
`JdbcClient`/`JdbcTemplate` call takes a connection from the pool, runs one
statement under the connection's autocommit setting, and returns it. Each statement
is its own transaction, which is the argument of
**[Autocommit is a transaction you did not choose](../03-jdbc-transactions/01-autocommit-is-a-transaction-you-did-not-choose.md)**.

Two practical consequences:

- **Two repository calls in a row are two transactions.** They can interleave with
  another request's writes, and the second can fail after the first committed.
- **A streaming read will not stream.** pgJDBC only uses a cursor inside a
  transaction, so `stream()` with a fetch size outside one still materialises
  everything — [chunk 4b](04b-the-result-specs.md).

## What bypassing actually costs

The tempting thing, usually written to reach a driver-specific API:

```java
@Transactional
public void importRows(List<Row> rows) {
    jdbcClient.sql("insert into staging (...) values (...)").update();   // in the transaction

    try (Connection con = dataSource.getConnection()) {                  // ⛔ a DIFFERENT connection
        new CopyManager((BaseConnection) con).copyIn("copy target from stdin", reader);
    }
}
```

Three separate problems, in increasing order of nastiness:

1. **Two connections per request.** With a pool sized for one connection per
   in-flight request, this halves your effective concurrency and can deadlock the
   pool outright — the arithmetic is the one in
   **[`REQUIRES_NEW`](../04-spring-transactional/10-requires-new.md)**.
2. **The second connection is not covered by the rollback.** If the method throws
   after the `COPY`, the transactional insert is undone and the copied rows are not.
3. 🔴 **The second connection cannot see the first one's uncommitted writes.** It is
   a different session, so the transaction's changes are invisible to it under any
   isolation level PostgreSQL supports. Code that inserts a row and then, on the
   bypassing connection, looks it up, finds nothing — and the failure reads like the
   insert did not happen.

The correct version keeps the connection:

```java
jdbcTemplate.execute((Connection con) -> {
    new CopyManager((BaseConnection) con).copyIn("copy target from stdin", reader);
    return null;
});
```

`execute` hands you the connection `DataSourceUtils` chose, which inside a
transaction is the transaction's. Everything is one session and one transaction.

## Timeouts flow down from the transaction

`DataSourceUtils.applyTimeout(stmt, dataSource, timeout)` applies "the specified
timeout — **overridden by the current transaction timeout, if any** — to the given
JDBC `Statement` object", and `applyTransactionTimeout` is the no-argument form. So
`@Transactional(timeout = 5)` reaches the driver as a JDBC statement timeout on
every statement the template runs, and it takes precedence over
`spring.jdbc.template.query-timeout`. The full argument, including what a
transaction timeout is *not*, is
**[Timeouts](../04-spring-transactional/17-timeouts.md)**.

## Gotchas

**A `JdbcTemplate` created over a *different* `DataSource` is in a different
transaction.** The thread binding is keyed by `DataSource`. Two data sources means
two independent bindings, so a repository built on the second one does not join a
transaction started by the manager for the first — and nothing warns you. This is
the JDBC-layer statement of
**[what Boot picked for you](../04-spring-transactional/06c-what-boot-picked-for-you.md)**.

**`dataSource.getConnection()` inside a transactional method is almost always a
bug.** It is a legal thing to write, it compiles, and in a test with a single
statement it appears to work. The failure modes — invisible writes, uncovered
rollback, doubled pool usage — all need either a rollback or concurrency to show up.

**Closing the connection you were handed by `execute(ConnectionCallback)` corrupts
the transaction.** The connection is on loan. Inside a transaction it belongs to the
transaction manager, which will try to commit or roll back an object you closed.
`execute` exists so you can *use* driver APIs, not manage the connection.

**`@Transactional` and no transaction manager for that `DataSource` gives you
autocommit and no error.** If the annotation is not doing anything — the many ways
that happens are
**[Annotations that do nothing](../04-spring-transactional/05-annotations-that-do-nothing.md)**
— your `JdbcClient` calls silently fall back to one-statement-per-transaction. Every
statement still works, so tests pass. Only a rollback reveals it.

**A connection returned to the pool remembers what you did to it.** Setting the
isolation level or the read-only flag with raw SQL on a connection you obtained
yourself leaves it set for the next borrower —
**[The level and the pool](../03-jdbc-transactions/08b-the-level-and-the-pool.md)**.
Going through Spring avoids this because the transaction manager restores the
connection's state on release.

**`releaseConnection` is a no-op inside a transaction, which is exactly why leak
detection is confusing there.** A leak-detection warning naming a connection held
for the length of a transaction is usually reporting the transaction, not a leak.
Read it alongside
**[Ownership and leaks](../01-jdbc/18-ownership-and-leaks.md)**.

**`TransactionAwareDataSourceProxy` exists and is not the answer.** It makes a plain
`dataSource.getConnection()` transaction-aware, for code you cannot change. Spring's
own javadoc calls it rarely desirable, and the reasoning is in
**[Getting the connection safely](../04-spring-transactional/07b-getting-the-connection-safely.md)**.
Use it for legacy code; do not reach for it to justify bypassing.

## Interview questions

**★ How does `JdbcTemplate` participate in a Spring transaction without any
transaction code in the repository?**
Through `DataSourceUtils`. Rather than calling `dataSource.getConnection()`, every
template operation calls `DataSourceUtils.getConnection(dataSource)`, which — in the
javadoc's words — "is aware of a corresponding Connection bound to the current
thread". Spring's transaction manager binds a connection to a `ThreadLocal` when it
starts a transaction, so the template's request returns that same connection instead
of a new one from the pool. Release is symmetrical:
`DataSourceUtils.releaseConnection` closes the connection only "if it is not managed
externally (that is, not bound to the thread)", so the template does not close a
connection the transaction is still using.

**★ What happens if you call `dataSource.getConnection()` inside a `@Transactional`
method?**
You get a second, independent connection with its own session, and three things go
wrong. The pool now serves two connections for one request, which halves effective
concurrency and can deadlock a small pool. The second connection is outside the
transaction, so if the method throws, the work done on it is not rolled back.
And — the one that produces the most confusing bug — the second connection cannot
see the transaction's uncommitted writes, because they are uncommitted and it is a
different session. So an insert followed by a lookup on the bypassing connection
finds nothing, and it looks as though the insert failed.

**★ What runs if there is no transaction?**
Each statement independently, under the connection's autocommit setting. The
template takes a connection from the pool, runs one statement, and returns it; the
next call may well get a different connection. That means two repository calls in
the same service method are two transactions and can be interleaved by another
request. It also means a streaming query does not stream on PostgreSQL, because
pgJDBC only uses a server-side cursor inside a transaction. Neither of these throws,
which is why "it works in the test" is not evidence that the boundary is where you
think it is.

**★ How do you reach a driver-specific API such as pgJDBC's `CopyManager` without
leaving the transaction?**
`jdbcTemplate.execute(ConnectionCallback)`. It hands your callback the `Connection`
that `DataSourceUtils` selected — the transaction's, if one is active — while still
handling acquisition, release and exception translation. Inside the callback you may
use the connection freely, including casting it to `BaseConnection` for pgJDBC
extensions, but you must not manage it: no `close()`, no `commit()`, no changing
autocommit, because the transaction manager owns those. `JdbcClient` has no
equivalent, which is one of the reasons to keep a `JdbcTemplate` injected.

**★ Where does a `@Transactional(timeout = 5)` end up at the JDBC level?**
As a statement timeout on each statement the template runs.
`DataSourceUtils.applyTimeout` applies the template's configured timeout "overridden
by the current transaction timeout, if any", so the transaction's value wins over
`spring.jdbc.template.query-timeout`. It is not a wall clock over the whole
transaction; it is checked at operation boundaries and pushed down per statement,
which means code that bypasses Spring to run a statement gets no timeout at all.

**★ Two `DataSource`s, one transaction — what happens?**
Nothing good, and nothing loud. The thread binding is per `DataSource`, so a
transaction started by the manager for data source A binds a connection for A only.
A repository built on data source B looks for a binding for B, finds none, and runs
in autocommit. Every statement succeeds; a rollback of the A transaction leaves the
B writes in place. The moment a second data source appears, every `JdbcTemplate`,
`JdbcClient` and transaction manager needs to be qualified explicitly, and any
operation spanning both needs a design decision rather than an annotation.

---

← Prev: [8b · Batches and bulk](08b-batches-and-bulk-writes.md) · Index: [05 · SQL-first access](README.md) · Next → [10 · When SQL wins](10-when-sql-first-beats-an-entity.md)
