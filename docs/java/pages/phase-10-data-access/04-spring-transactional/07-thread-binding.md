---
title: "The transaction is a Connection in a ThreadLocal, and asking the DataSource for a connection gets you a different one that is not in it"
sidebar_label: "7 · Thread binding"
sidebar_position: 19
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Controlling
> database connections*
> ([docs.spring.io/spring-framework/reference/data-access/jdbc/connections.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/connections.html)),
> the `DataSourceTransactionManager` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/DataSourceTransactionManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/DataSourceTransactionManager.html))
> and the `TransactionSynchronizationManager` javadoc
> ([.../org/springframework/transaction/support/TransactionSynchronizationManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronizationManager.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, HikariCP 7.0.2,
> PostgreSQL 18.

**Here is the bug. Two lines in the same method, inside the same
`@Transactional`, writing to the same database — and only one of them is in the
transaction. This chunk is the mechanism that causes it;
[chunk 7b](07b-getting-the-connection-safely.md) is what to do when you genuinely
need a raw `Connection` and how to make code you cannot edit participate.**

```java
@Service
public class OrderService {

    private final JdbcClient db;          // Spring's
    private final DataSource dataSource;  // the raw one

    @Transactional
    public void placeOrder(NewOrder order) {

        db.sql("INSERT INTO orders (customer_id, total) VALUES (?, ?)")
          .params(order.customerId(), order.total())
          .update();                                  // ← IN the transaction

        try (Connection c = dataSource.getConnection();     // ← a DIFFERENT connection
             PreparedStatement ps = c.prepareStatement(
                     "INSERT INTO audit_log (event) VALUES (?)")) {
            ps.setString(1, "order placed");
            ps.executeUpdate();                       // ← NOT in the transaction, autocommit
        }

        throw new IllegalStateException("something later goes wrong");
    }
}
```

**Result: the order row is rolled back. The audit row is not.** No warning, no
error, and code that reads as though both writes are covered by the same
boundary. This is the most damaging misunderstanding in the topic, and everything
below explains why it happens.

## Where the transaction actually lives

`DataSourceTransactionManager`'s javadoc, first sentence:

> *"Binds a JDBC `Connection` from the specified `DataSource` to the current
> thread, potentially allowing for one thread-bound `Connection` per
> `DataSource`."*

So beginning a transaction is three steps:

1. Take a `Connection` from the `DataSource` — in a Boot application, from the
   HikariCP pool.
2. Call `setAutoCommit(false)` on it, plus isolation and read-only if requested.
3. **Bind it to the current thread**, keyed by the `DataSource` it came from.

Committing means calling `commit()` on *that* connection, unbinding it, and
returning it to the pool. The transaction is not an object Spring holds
somewhere — it is a state on one specific `Connection`, and the only record of
which connection that is lives in a `ThreadLocal`.

The binding is managed by `TransactionSynchronizationManager`, described in its
javadoc as a *"Central delegate that manages resources and transaction
synchronizations per thread"*, with `getResource` / `bindResource` /
`unbindResource` keyed by the `DataSource`.

```
Thread "http-nio-8080-exec-3"
  └── TransactionSynchronizationManager resources
        └── dataSource ──▶ Connection#42   (autoCommit = false)
```

## The two ways to ask for a connection

This is the whole chunk in one table:

| Call | Returns | Inside a transaction? |
|---|---|---|
| `DataSourceUtils.getConnection(dataSource)` | the **bound** connection if there is one, otherwise a fresh one | **yes** |
| `dataSource.getConnection()` | always a fresh one from the pool | **no** |

The reference and the javadoc both state the requirement, and the javadoc's
wording is the stronger of the two:

> *"Application code is required to retrieve the JDBC `Connection` via
> `DataSourceUtils.getConnection(DataSource)` instead of a standard EE-style
> `DataSource.getConnection()` call."*

🔴 **"Required" means required.** `DataSource` is a standard Java interface, and
`getConnection()` on it does exactly what it says: it gives you a connection.
There is nothing Spring can do to make that call return the bound one, because it
is not Spring's method — it is HikariCP's, and HikariCP knows nothing about
transactions.

## Why `JdbcTemplate` and `JdbcClient` "just work"

They call `DataSourceUtils` for you. The reference says so directly: "the class
[`DataSourceUtils`] … is used internally by `JdbcTemplate`". The same is true of
`JdbcClient`, of `NamedParameterJdbcTemplate`, and of Spring Data's repositories.

That is the entire reason they participate in your transaction and a hand-rolled
connection does not. It is not that Spring detects your queries; it is that
Spring's own classes ask for the connection in the way that finds the bound one.

```java
// what JdbcTemplate does, in essence
Connection con = DataSourceUtils.getConnection(getDataSource());
try {
    // ... prepare, execute, map ...
} finally {
    DataSourceUtils.releaseConnection(con, getDataSource());
}
```

⚠️ **`releaseConnection` is the other half, and it matters.** It closes the
connection *only if it is not the thread-bound one*. Inside a transaction it is a
no-op, so the connection stays bound until the boundary ends. A hand-written
`close()` on the bound connection would end the transaction's connection while
the transaction was still running — which is why you release rather than close.

## The trade-off

Binding to a `ThreadLocal` is what makes `@Transactional` invisible — your method
body contains no connection, no transaction object, nothing to pass around, and
any Spring data-access class you call finds the right connection without being
told. That is a large ergonomic win and it costs two things. **A different way of
asking for a connection silently escapes the transaction**, which is this whole
page. And **a different thread has a different `ThreadLocal`**, so work handed to
an executor, a parallel stream or an `@Async` method is outside the transaction
entirely — [chunk 18](18-threads-and-async.md).

## Gotchas

**⚠️ `dataSource.getConnection()` inside a transactional method**
**Symptom:** part of the method's writes survive a rollback.
**Cause:** a second connection, in autocommit, outside the transaction.
**Fix:** `DataSourceUtils.getConnection(dataSource)`, or use `JdbcClient` /
`JdbcTemplate`.

**⚠️ A repository that takes a `DataSource` and manages its own connections**
**Symptom:** the same, spread across a class rather than a method.
**Cause:** the class was written for plain JDBC and never adapted.
**Fix:** `DataSourceUtils` inside it —
[chunk 7b](07b-getting-the-connection-safely.md).

**⚠️ Two data sources, one transaction, and a write to the wrong one**
**Symptom:** one table is rolled back and another is not, with no raw
`getConnection()` anywhere.
**Cause:** the binding is keyed **per `DataSource`**. A transaction on data
source A binds A's connection; a `JdbcTemplate` over data source B finds nothing
bound and gets a fresh, autocommitting connection.
**Fix:** one manager per data source, and know which one the annotation named —
[chunk 6c](06c-what-boot-picked-for-you.md).

**⚠️ Reading `TransactionSynchronizationManager` state in application code**
**Symptom:** business logic that depends on Spring internals.
**Cause:** the javadoc says the class is "to be used by resource management code
but not by typical application code".
**Fix:** use it as a diagnostic and remove it —
[chunk 5b](05b-detecting-a-dead-annotation.md).

**⚠️ A `@Transactional` method that opens a second connection to "avoid
blocking"**
**Symptom:** an intermittent hang under load that clears when the pool is
enlarged.
**Cause:** each thread now holds two connections; with N threads the pool needs
more than N connections or threads block holding one while waiting for another.
**Fix:** the same arithmetic that governs `REQUIRES_NEW` —
[chunk 10](10-requires-new.md) — and the deadlock floor in
[Topic 02 · 3 · The deadlock floor](../02-connection-pooling/03-the-connection-budget.md).

**⚠️ Assuming the binding survives a `CompletableFuture`**
**Symptom:** work inside a `supplyAsync` runs with no transaction and no error.
**Cause:** a different thread has a different `ThreadLocal`.
**Fix:** [chunk 18](18-threads-and-async.md). Nothing about the boundary crosses
a thread hand-off.

**⚠️ Expecting a connection to be held for the whole method when there is no
transaction**
**Symptom:** two `JdbcTemplate` calls in a non-transactional method see different
snapshots, or two different pool connections show up in the database's session
view.
**Cause:** with nothing bound, `DataSourceUtils` fetches and releases a
connection per operation.
**Fix:** that is correct behaviour. If the two reads must be consistent, they
need a transaction — which is one of the better arguments for annotating a
read-only method.

## Interview questions

**★ Where does Spring keep the current transaction?**
In a `ThreadLocal`, managed by `TransactionSynchronizationManager`, which its
javadoc describes as a "central delegate that manages resources and transaction
synchronizations per thread". For JDBC the resource being kept is a `Connection`
— the transaction manager takes one from the `DataSource`, calls
`setAutoCommit(false)` on it, and binds it to the thread keyed by that
`DataSource`. There is no transaction object floating around; the transaction is
a state on that one connection, and the thread-local binding is the only record
of which connection it is. Everything downstream follows: any code that finds the
bound connection is in the transaction, any code that gets a different connection
is not, and any code on a different thread finds nothing bound at all.

**★ Why does `dataSource.getConnection()` break a transaction, and why can Spring
not fix it?**
Because `DataSource` is a standard JDBC interface and `getConnection()` means
"give me a connection" — the implementation is HikariCP's, or the driver's, and
it knows nothing about Spring transactions. It hands you a fresh connection from
the pool, in autocommit mode, which is a completely separate session on the
database. Work you do on it commits immediately and is unaffected by a rollback
of the real transaction. Spring cannot intercept the call because it does not own
the class; the only supported route to the bound connection is
`DataSourceUtils.getConnection(dataSource)`, which is why the
`DataSourceTransactionManager` javadoc says application code "is required" to use
it.

**★ Why do `JdbcTemplate` and `JdbcClient` participate in a transaction without
being told about it?**
Because they ask for the connection the right way. Internally they call
`DataSourceUtils.getConnection(dataSource)`, which returns the thread-bound
connection when a transaction is active and a fresh one otherwise, and they
release it with `DataSourceUtils.releaseConnection`, which closes it only when it
is *not* the bound one. There is no detection and no magic: the participation is
entirely a consequence of using the lookup that consults the thread binding. This
is also the reason the failure in hand-rolled JDBC is so easy to introduce — the
code looks like ordinary correct JDBC, and it is; it is just asking a question
that does not consult the binding.

**★ The binding is keyed per `DataSource`. What goes wrong if you forget that?**
You get a rollback that covers one database and not another, with no raw
`getConnection()` anywhere to blame. A transaction started by the manager for
data source A binds A's connection to the thread. A `JdbcTemplate` built over
data source B looks for a binding for B, finds none, and gets a fresh
autocommitting connection from B's pool — so its writes commit immediately and
survive a rollback of A. The code looks entirely correct: two Spring templates,
one transactional method, no hand-rolled JDBC. The fix is to know which manager
the annotation named and to accept that a second data source is a second
transaction, which is the multiple-manager problem in
[chunk 6c](06c-what-boot-picked-for-you.md).

**★ What happens when there is no transaction and you call a `JdbcTemplate`
method?**
`DataSourceUtils.getConnection` finds nothing bound, so it fetches a connection
from the pool, the statement runs in autocommit, and `releaseConnection` closes
it and returns it to the pool — all within that one operation. The consequence
worth knowing is that two consecutive `JdbcTemplate` calls in a non-transactional
method may use two *different* connections, and therefore two different database
sessions, with no consistency guarantee between them. That is one of the better
arguments for annotating even a read-only method that performs several queries:
not because you intend to write anything, but because you want all the reads on
one connection inside one transaction so they see one consistent snapshot.

**★ Why is thread binding both the reason `@Transactional` is ergonomic and the
reason it is surprising?**
Because it makes the transaction ambient. Your method body has no connection
parameter, no transaction object, nothing to thread through call after call — any
Spring data-access code you reach, at any depth, finds the right connection
without being handed it. That is a genuine and large simplification, and it is
why declarative transactions feel like a language feature. The cost is that
ambient state is invisible state: two things silently fall outside it, and
neither announces itself. Asking for a connection a different way gets you a
different connection, which is this chunk. Moving work to a different thread gets
you a different `ThreadLocal`, which is [chunk 18](18-threads-and-async.md). Both
failures share the property that the code reads correctly and behaves wrongly
only when something fails partway through.

---

← Prev: [6d · The status handle](06d-the-status-handle.md) · Index: [04 · Spring @Transactional](README.md) · Next → [7b · Getting the connection safely](07b-getting-the-connection-safely.md)
