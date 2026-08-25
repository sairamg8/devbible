---
title: "A transaction timeout is not a wall clock — it is checked before operations and pushed down as a JDBC statement timeout, and code that bypasses Spring gets no timeout at all"
sidebar_label: "17 · Timeouts"
sidebar_position: 46
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `TransactionTimedOutException` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionTimedOutException.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionTimedOutException.html)),
> the `DataSourceTransactionManager` javadoc
> ([.../jdbc/datasource/DataSourceTransactionManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/DataSourceTransactionManager.html)),
> the `TransactionDefinition` and `@Transactional` javadocs
> ([.../transaction/TransactionDefinition.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionDefinition.html)),
> the Spring Framework 7.0 reference *Using `@Transactional`*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)),
> the Spring Boot 4.1 `TransactionProperties` javadoc
> ([docs.spring.io/spring-boot/docs/current/api/org/springframework/boot/transaction/autoconfigure/TransactionProperties.html](https://docs.spring.io/spring-boot/docs/current/api/org/springframework/boot/transaction/autoconfigure/TransactionProperties.html))
> and the PostgreSQL 18 manual *Client Connection Defaults*
> ([postgresql.org/docs/18/runtime-config-client.html](https://www.postgresql.org/docs/18/runtime-config-client.html)).
> JDK 25, Spring Framework 7.0.8, Spring Boot 4.1.0, pgjdbc 42.7.13,
> PostgreSQL 18.

**`@Transactional(timeout = 5)` does not start a timer that kills your
transaction after five seconds. Spring records a deadline, checks it at the
points where it hands out resources, and passes the remaining time down as a JDBC
statement timeout. Nothing interrupts a thread. Nothing cancels work Spring did
not create.**

## What actually happens

Two mechanisms, and the javadoc for `TransactionTimedOutException` describes both
in one place:

> Thrown by Spring's local transaction strategies if the deadline for a
> transaction has been reached when an operation is attempted, according to the
> timeout specified for the given transaction.
>
> Beyond such checks before each transactional operation, Spring's local
> transaction strategies will also pass appropriate timeout values to resource
> operations (for example to JDBC Statements, letting the JDBC driver respect the
> timeout). Such operations will usually throw native resource exceptions (for
> example, JDBC `SQLException`s) if their operation timeout has been exceeded, to
> be converted to Spring's `DataAccessException` in the respective DAO.

So:

**1 · A deadline check at each operation.** When Spring is asked for a resource —
a connection, a statement — it compares now against the deadline computed at
`BEGIN`. If the deadline has passed, it throws `TransactionTimedOutException`, a
`RuntimeException` (via `TransactionException` and `NestedRuntimeException`), so
the default rollback rule covers it.

**2 · A statement timeout on statements Spring creates.** The remaining seconds
are set on the JDBC `Statement`, and the *driver and server* enforce that. A
statement that runs past it fails with a driver exception, which Spring's
exception translation turns into a `DataAccessException`.

Neither of these is a watchdog. If your method spends forty seconds doing
arithmetic between two queries, the timeout does nothing until the next
operation, and then it fires immediately.

## The requirement almost everyone misses

`DataSourceTransactionManager`'s javadoc states the timeout mechanism *and* its
precondition in one sentence:

> Supports custom isolation levels, and timeouts which get applied as appropriate
> JDBC statement timeouts. To support the latter, application code must either use
> `JdbcTemplate`, call
> `DataSourceUtils.applyTransactionTimeout(Statement, DataSource)` for each
> created JDBC `Statement`, or go through a `TransactionAwareDataSourceProxy`
> which will create timeout-aware JDBC `Connection`s and `Statement`s
> automatically.

Read the negative form of that: **a `Statement` you created yourself, from a
`Connection` you obtained yourself, has no timeout.** Not a shortened one — none
at all.

```java
// no transaction timeout applies to this statement, whatever the annotation says
@Transactional(timeout = 5)
public void report() throws SQLException {
    try (Connection c = dataSource.getConnection();          // ← not Spring's connection
         PreparedStatement ps = c.prepareStatement(HUGE_QUERY)) {
        ps.executeQuery();                                   // ← runs as long as it likes
    }
}
```

Two things are wrong here at once, and they are worth separating. The obvious one
is the missing timeout. The deeper one is that `dataSource.getConnection()`
returns a *different connection* from the one the transaction is bound to, so this
query is not even in the transaction. The same javadoc says so:

> Application code is required to retrieve the JDBC `Connection` via
> `DataSourceUtils.getConnection(DataSource)` instead of a standard EE-style
> `DataSource.getConnection()` call. Spring classes such as `JdbcTemplate` use this
> strategy implicitly.

The corrected version is simply to use the framework:

```java
@Transactional(timeout = 5)
public void report() {
    jdbcTemplate.query(HUGE_QUERY, rowMapper);   // in the transaction, timeout applied
}
```

The third option in the javadoc, `TransactionAwareDataSourceProxy`, exists for
legacy code that must be handed a plain `DataSource` — the JDBC reference is
lukewarm about it, saying "It is rarely desirable to use this class, except when
already existing code must be called and passed a standard JDBC `DataSource`
interface implementation".

## `timeout` and `timeoutString`

`timeout` is an `int` in seconds, defaulting to `-1`, which is
`TransactionDefinition.TIMEOUT_DEFAULT`:

> Use the default timeout of the underlying transaction system, or none if
> timeouts are not supported.

`timeoutString`, added in 5.3, takes the same value as a `String` so that it can
be a property placeholder:

```java
@Transactional(timeoutString = "${orders.checkout.timeout-seconds:10}")
public void checkout(long cartId) { ... }
```

That is its entire reason for existing — the reference's table describes it as
"Alternative for specifying the `timeout` in seconds as a `String` value — for
example, as a placeholder." Set one or the other, never both.

For an application-wide default there is a Boot property. `TransactionProperties`
— note the Boot 4 package, `org.springframework.boot.transaction.autoconfigure` —
exposes `spring.transaction.default-timeout` as a `Duration`, described as a
setting "that can be applied to an `AbstractPlatformTransactionManager`".

And the same caveat as isolation applies at the bottom:

> Note that a transaction manager that does not support timeouts will throw an
> exception when given any other timeout than `TIMEOUT_DEFAULT`.

## Only on a transaction Spring starts

The `@Transactional` javadoc gives `timeout` and `timeoutString` the same note
that `isolation` gets:

> **Exclusively designed for use with `Propagation.REQUIRED` or
> `Propagation.REQUIRES_NEW`** since it only applies to newly started
> transactions.

A method that joins an existing transaction inherits the outer deadline and its
own `timeout` is discarded silently — the propagation reference again: a
participating transaction "joins the characteristics of the outer scope, silently
ignoring the local isolation level, timeout value, or read-only flag (if any)".

This one has a pleasant property the others do not: because the deadline is
absolute and computed at `BEGIN`, an inner method inheriting it gets *less* time
than the outer method had, which is usually what you would have wanted anyway.
The mistake is only harmful when the inner declaration was meant to be *longer*.

`validateExistingTransaction = true` rejects the mismatch instead of dropping it,
as it does for isolation — see [16 · Isolation](16-isolation.md).

## What this cannot bound

Because the check happens at operation boundaries and the enforcement is
per-statement, a transaction timeout does **not** bound:

- **A single long-running statement started before the deadline**, beyond the
  statement timeout that was set on it. If ten seconds remained when the statement
  was created, the statement gets ten seconds.
- **CPU work in your own code.** A loop between two queries is invisible.
- **A blocking network call** — an HTTP request to another service, a message
  broker publish. This is the outage-shaped one, and it is why such calls do not
  belong in a transaction at all: see
  [21 · What belongs in a transaction](21-what-belongs-in-a-transaction.md).
- **A connection obtained outside the framework**, as above.

What genuinely bounds a runaway transaction is the database. Where those settings
live and which one to reach for is
[17b · What actually bounds a transaction](17b-what-actually-bounds-it.md).

## The trade-off

A transaction timeout is cheap, portable and it gives you a Spring exception
rather than a driver-specific one — a `TransactionTimedOutException` names the
transaction, which is a better diagnostic than a socket read timeout three layers
down. It is also declarative, so it can be per-operation.

What it costs is a false sense of coverage. Because it is enforced at
Spring-controlled operations only, an application can carry timeouts on every
service method and still hold a connection open indefinitely, and the annotation
gives no hint that this is possible. The complementary server-side settings are
not optional extras; they are the part that cannot be bypassed.

## Gotchas

**⚠️ A raw `dataSource.getConnection()` inside a transactional method**
**Symptom:** the timeout never fires, and — worse — the work is not in the
transaction and is not rolled back.
**Cause:** the connection came from the pool directly, not from the thread-bound
transaction. Spring never sees the statement, so it cannot time it or enrol it.
**Fix:** use `JdbcTemplate`, an `EntityManager`, or
`DataSourceUtils.getConnection(dataSource)`. This single mistake breaks timeouts
and atomicity together.

**⚠️ Expecting the timeout to interrupt a long-running query**
**Symptom:** a `timeout = 5` transaction that runs for a minute.
**Cause:** the statement was created while time remained, so it received the
remaining seconds as its statement timeout; a query started with ten seconds left
is allowed ten seconds. And Spring never interrupts the thread.
**Fix:** if you need a hard cap on statement duration, set it at the database — see
17b.

**⚠️ `timeout` on a method that joins an existing transaction**
**Symptom:** an operation that visibly runs past its declared timeout.
**Cause:** participating transactions inherit the outer deadline and discard the
local one, silently.
**Fix:** declare the timeout on the boundary that starts the transaction, or use
`validateExistingTransaction` to make the mismatch fail.

**⚠️ Setting both `timeout` and `timeoutString`**
**Symptom:** confusion about which wins, and a configuration that behaves
differently from how it reads.
**Cause:** they are two spellings of one setting.
**Fix:** pick one. Use `timeoutString` only when you actually need a placeholder.

**⚠️ A `TransactionTimedOutException` that surprises people by rolling back**
**Symptom:** a timeout produces a rollback rather than a partial commit.
**Cause:** it extends `RuntimeException` through `TransactionException` and
`NestedRuntimeException`, so the default rollback rule covers it. This is correct.
**Fix:** none — but note that catching it inside the method would produce a commit
attempt on a transaction that has already blown its deadline, which is exactly the
antipattern in [14 · The caught exception](14-the-caught-exception.md).

## Interview questions

**★ What does `@Transactional(timeout = 5)` actually do?**
Two things, neither of which is a timer. Spring computes a deadline when the
transaction begins and checks it whenever it is asked for a transactional
resource, throwing `TransactionTimedOutException` if the deadline has passed. And
it passes the remaining seconds down as a JDBC statement timeout on statements it
creates, which the driver and server then enforce. Nothing interrupts the thread,
and nothing cancels work already in flight beyond what the statement timeout
covers.

**★ Why might a transaction timeout have no effect at all on some code?**
Because the statement timeout only reaches statements the framework creates. The
`DataSourceTransactionManager` javadoc spells out the requirement: application
code must use `JdbcTemplate`, call
`DataSourceUtils.applyTransactionTimeout(Statement, DataSource)` on each statement
it creates, or go through a `TransactionAwareDataSourceProxy`. Code that calls
`dataSource.getConnection()` and prepares its own statement gets no timeout — and
in fact is not in the transaction at all, because that connection is not the
thread-bound one.

**★ A transactional method runs for a minute with `timeout = 5`. Give me three
explanations.**
One: a single statement was started while time remained and received the
remaining seconds as its statement timeout, so it is allowed to run that long —
the deadline is not re-checked mid-statement. Two: the time is being spent
somewhere Spring never gets asked for a resource, such as CPU work or a blocking
HTTP call, so no check point is reached. Three: the method joined an existing
transaction, so its own timeout was silently discarded and it inherited whatever
the outer boundary declared, possibly nothing.

**★ What is `timeoutString` for?**
Purely for property placeholders. `timeout` is an `int` and cannot hold
`${...}`, so 5.3 added a `String` twin whose value is resolved at runtime —
`@Transactional(timeoutString = "${orders.timeout:10}")`. Same units, same
meaning, same "only applicable to `REQUIRED` or `REQUIRES_NEW`" restriction. Set
one or the other.

**★ If Spring's timeout cannot be relied on to bound a transaction, what can?**
The database, because it is the one participant nothing in the application can
bypass. On PostgreSQL that means `statement_timeout` for individual statements,
`idle_in_transaction_session_timeout` for a transaction that is open and waiting
on the client, `lock_timeout` for lock waits specifically, and
`transaction_timeout` for the total span of a transaction. Those are enforced by
the server against the session, so a raw connection, a hand-built statement or a
thread stuck on a socket read are all covered. The Spring timeout is a
convenience and a better diagnostic; the server settings are the actual bound.

**★ Does `TransactionTimedOutException` roll the transaction back?**
Yes, under the default rules — it is a `RuntimeException`, reached through
`TransactionException` and `NestedRuntimeException`, so it matches the default
rollback rule with nothing extra needed. The interesting version of the question
is what happens if you catch it: you would then return normally from a method
whose transaction had already passed its deadline, and Spring would attempt a
commit that is likely to fail at the next resource operation. Catching a timeout
is never the right move.

---

← Prev: [16b · Isolation in the plumbing](16b-isolation-in-the-plumbing.md) · Index: [Spring @Transactional](README.md) · Next → [17b · What actually bounds it](17b-what-actually-bounds-it.md)
