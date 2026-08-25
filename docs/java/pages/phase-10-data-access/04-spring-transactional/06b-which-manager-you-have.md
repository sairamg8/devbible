---
title: "The five implementations behind the interface, and the four javadoc sentences on the JDBC one that explain most of the surprises in this topic"
sidebar_label: "6b · The implementations"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `DataSourceTransactionManager` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/DataSourceTransactionManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/DataSourceTransactionManager.html)),
> the Spring Framework 7.0 reference *Understanding the Spring Framework
> transaction abstraction*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/strategies.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/strategies.html)),
> *Using `@Transactional`*
> ([.../declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)),
> the Spring Boot 4.1 `TransactionProperties` javadoc
> ([docs.spring.io/spring-boot/docs/current/api/org/springframework/boot/transaction/autoconfigure/TransactionProperties.html](https://docs.spring.io/spring-boot/docs/current/api/org/springframework/boot/transaction/autoconfigure/TransactionProperties.html))
> and the Boot reference *SQL databases*
> ([docs.spring.io/spring-boot/reference/data/sql.html](https://docs.spring.io/spring-boot/reference/data/sql.html))
> and the `TransactionAwareDataSourceProxy` javadoc
> ([.../jdbc/datasource/TransactionAwareDataSourceProxy.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/TransactionAwareDataSourceProxy.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8.

**[Chunk 6](06-the-transaction-manager.md) was the interface. This is the object
actually behind it: the five implementations, and — because it is the one this
phase cares about — the four sentences in `DataSourceTransactionManager`'s javadoc
that between them explain thread binding, statement timeouts, savepoints and the
single most damaging misunderstanding in the whole topic.
[Chunk 6c](06c-what-boot-picked-for-you.md) is who chose your implementation and
what happens when there is more than one.**

## Why an interface at all

The abstraction exists because "a transaction" means different things to
different resources, and Spring wanted `@Transactional` to mean one thing to you.

| Implementation | "Begin" means | Used for |
|---|---|---|
| `DataSourceTransactionManager` | `setAutoCommit(false)` on a JDBC connection | plain JDBC, MyBatis, jOOQ |
| `JdbcTransactionManager` (5.3+) | the same, plus exception translation | plain JDBC — the better default |
| `JpaTransactionManager` | begin an `EntityTransaction` on an `EntityManager` | JPA / Hibernate |
| `JtaTransactionManager` | enlist with a JTA `TransactionManager` | multiple resources, XA |
| `R2dbcTransactionManager` | a reactive equivalent | R2DBC — but via `ReactiveTransactionManager` |

**Your service code is identical in every row.** That is the entire return on the
abstraction, and it is why the reference presents the interface before anything
about annotations.

⚠️ **There is a second, parallel interface.** `ReactiveTransactionManager` exists
for reactive stacks and does *not* extend `PlatformTransactionManager`; both
extend a common marker `TransactionManager`. The two are not interchangeable, and
a reactive application binds its transaction context to the reactive `Context`
rather than to a `ThreadLocal` — which is the reason
[chunk 7](07-thread-binding.md)'s rules do not transfer to it.

## `DataSourceTransactionManager`, from its own javadoc

Four sentences from it carry most of the behaviour you will meet:

> *"Binds a JDBC `Connection` from the specified `DataSource` to the current
> thread, potentially allowing for one thread-bound `Connection` per
> `DataSource`."*

That is [chunk 7](07-thread-binding.md) in one line, and it is the mechanism
behind everything in it.

> *"Application code is required to retrieve the JDBC `Connection` via
> `DataSourceUtils.getConnection(DataSource)` instead of a standard EE-style
> `DataSource.getConnection()` call."*

🔴 **"Required" is not advice.** Code that calls `dataSource.getConnection()`
directly gets a *different* connection, outside your transaction. Same code, two
connections, half the work not rolled back. Also [chunk 7](07-thread-binding.md),
and the single most damaging misunderstanding in this topic.

> *"Supports custom isolation levels, and timeouts which get applied as
> appropriate JDBC statement timeouts."*

A Spring `timeout` is not a wall clock over the whole method — it becomes a
`setQueryTimeout` on statements, and the javadoc adds that this only happens for
statements created through `JdbcTemplate`, through
`DataSourceUtils.applyTransactionTimeout`, or through
`TransactionAwareDataSourceProxy`. A raw statement you created yourself gets no
timeout at all. That is [chunk 17](17-timeouts.md).

> *"Nested transactions … via JDBC Savepoints"*, with `nestedTransactionAllowed`
> defaulting to true.

`NESTED` propagation exists because of this and only this —
[chunk 11](11-nested-and-savepoints.md).

## `JdbcTransactionManager` — the one you should be using

> *"As of 5.3, `JdbcTransactionManager` is available as an extended subclass which
> includes commit/rollback exception translation."*

It is a subclass of `DataSourceTransactionManager` that differs in one respect and
it is a respect worth having: when the **commit or rollback itself** fails, the
raw `SQLException` is translated into Spring's `DataAccessException` hierarchy,
the same way `JdbcTemplate` translates exceptions from your statements.

Why that matters concretely: a deferred constraint, a serialization failure
detected at commit, or a connection lost between the last statement and the commit
all surface *at commit time*. Without translation, your service catches
`DataAccessException` from every statement and then gets a raw `SQLException` — or
a `TransactionSystemException` wrapping one — from the commit, which is a
different `catch` block and usually an absent one.

⚠️ **Both classes exist and both are current.** `DataSourceTransactionManager` is
not deprecated; `JdbcTransactionManager` is the extended one. If you are declaring
a manager by hand for a JDBC `DataSource`, declare the subclass.

## The trade-off

Two classes doing the same job, one of which is strictly better for new code, is
a small tax the framework pays for compatibility: `DataSourceTransactionManager`
predates the exception-translation behaviour and is still what a great deal of
documentation and every older tutorial names. Nothing is deprecated, so nothing
warns you. The cost is a decision you have to make deliberately once, and the
benefit is that no existing application broke when the subclass arrived in 5.3.
It is worth noticing the pattern, because the same shape recurs — Spring adds
capability in a subclass or a flag rather than changing behaviour underneath
running code, which is why so many of this topic's "correct settings" are things
you opt into.

## Gotchas

**⚠️ Calling `dataSource.getConnection()` in code that runs inside a transaction**
**Symptom:** half the work is rolled back and half is not, in the same method.
**Cause:** the javadoc says application code "is required" to use
`DataSourceUtils.getConnection(DataSource)`; a direct call gets a second,
untransacted connection.
**Fix:** [chunk 7](07-thread-binding.md). Use `JdbcClient`, `JdbcTemplate` or
`DataSourceUtils`.

**⚠️ Declaring `DataSourceTransactionManager` in new code**
**Symptom:** a raw `SQLException` escaping from a commit while every other error
in the application is a `DataAccessException`.
**Cause:** commit/rollback exception translation lives in the subclass.
**Fix:** declare `JdbcTransactionManager` instead. It has been available since
5.3.

**⚠️ Expecting a Spring `timeout` to abort a long-running Java loop**
**Symptom:** a method that computes for two minutes inside a five-second
transaction completes without complaint.
**Cause:** the javadoc says timeouts "get applied as appropriate JDBC statement
timeouts" — they bound statements, not your code.
**Fix:** [chunk 17](17-timeouts.md). A transaction timeout is not a wall clock.

**⚠️ Creating a `Statement` by hand and expecting the transaction timeout to
reach it**
**Symptom:** one query in a timed transaction runs unbounded.
**Cause:** the javadoc names exactly three routes that apply the timeout —
`JdbcTemplate`, `DataSourceUtils.applyTransactionTimeout`, and
`TransactionAwareDataSourceProxy`. A hand-made statement uses none of them.
**Fix:** go through `JdbcTemplate` / `JdbcClient`, or apply the timeout yourself.

**⚠️ Assuming `NESTED` works because the annotation compiles**
**Symptom:** `NestedTransactionNotSupportedException`, or `NESTED` behaving like
`REQUIRED`.
**Cause:** nested transactions are implemented with JDBC savepoints, so they
depend on the manager supporting them.
**Fix:** [chunk 11](11-nested-and-savepoints.md). Out of the box this is the JDBC
manager only.

**⚠️ Turning `nestedTransactionAllowed` off and forgetting**
**Symptom:** `NESTED` propagation starts failing across the application.
**Cause:** the flag defaults to true on `DataSourceTransactionManager`; somebody
set it false.
**Fix:** check the manager's configuration before believing the propagation is
at fault.

**⚠️ Injecting `PlatformTransactionManager` in a reactive application**
**Symptom:** no bean of that type, or a manager that does not bind anything your
reactive code can see.
**Cause:** reactive stacks use `ReactiveTransactionManager`, a separate interface
that does not extend `PlatformTransactionManager`.
**Fix:** use the reactive interface and `TransactionalOperator`. The two families
share only a marker supertype.

**⚠️ Assuming `JpaTransactionManager` leaves plain JDBC work outside the
transaction**
**Symptom:** an expectation that `JdbcTemplate` work in a JPA application is not
covered.
**Cause:** `JpaTransactionManager` manages the `EntityManager` *and* exposes the
underlying `DataSource`'s connection to the thread, so JDBC work participates.
**Fix:** it does participate. What changes is flush ordering — JPA writes may
reach the database later than your `JdbcTemplate` statements did.

## Interview questions

**★ What is the difference between `DataSourceTransactionManager` and
`JdbcTransactionManager`?**
`JdbcTransactionManager` is a subclass, available since Spring Framework 5.3, and
its javadoc describes the difference exactly: it "includes commit/rollback
exception translation". Everything about beginning, joining, suspending and
savepoints is identical. What differs is what happens when the *commit itself*
fails — a deferred constraint firing, a serialization failure detected at commit,
a connection lost after the last statement. The base class lets that surface as a
raw `SQLException` wrapped in a `TransactionSystemException`; the subclass
translates it into Spring's `DataAccessException` hierarchy, the same hierarchy
`JdbcTemplate` produces for ordinary statement failures. For new JDBC code the
subclass is the right choice, because it makes commit-time failures the same
shape as every other data-access failure.

**★ Why does the `DataSourceTransactionManager` javadoc say application code "is
required" to use `DataSourceUtils.getConnection`?**
Because that is the only call that returns the connection bound to the current
thread. The manager begins a transaction by taking a connection from the
`DataSource`, calling `setAutoCommit(false)`, and binding it to the thread; the
transaction exists on *that* connection and nowhere else. A plain
`dataSource.getConnection()` asks the pool for a connection and gets a different
one, in autocommit, entirely outside the transaction. The consequence is that a
method mixing `JdbcTemplate` calls with a hand-obtained connection has half its
work inside the transaction and half outside, and a rollback undoes only half.
`JdbcTemplate` and `JdbcClient` call `DataSourceUtils` internally, which is why
they "just work" and why hand-rolled JDBC in the middle of a Spring service is
the dangerous case.

**★ What does the javadoc mean by timeouts being "applied as appropriate JDBC
statement timeouts"?**
That a Spring transaction timeout is not a deadline for the method — it is
converted into `setQueryTimeout` on the statements the transaction issues. Two
consequences follow, and both catch people. The first is that time spent in Java
does not count: a transaction with a five-second timeout that spends two minutes
in a computation between two fast queries will not be aborted, because no
statement ever exceeded its limit. The second is that the timeout only reaches
statements created through a route that knows about it — the javadoc names
`JdbcTemplate`, `DataSourceUtils.applyTransactionTimeout` and
`TransactionAwareDataSourceProxy` — so a `Statement` you created from a
hand-obtained connection has no timeout at all.

**★ Why is `NESTED` propagation tied to a specific implementation?**
Because it is not a nested transaction in any database sense — it is one physical
transaction with savepoints inside it. The reference says the setting is
"typically mapped onto JDBC savepoints, so it works only with JDBC resource
transactions", and the `Propagation` javadoc is blunter: "out of the box, this
only applies to the JDBC `DataSourceTransactionManager`". So `NESTED` depends on
the manager being able to issue `SAVEPOINT` and `ROLLBACK TO SAVEPOINT` on the
bound connection, which is a JDBC capability. On a manager without it you get
`NestedTransactionNotSupportedException` rather than silent degradation, which is
one of the few places in this topic where an unsupported setting fails loudly.

**★ Does plain JDBC work participate in a transaction managed by
`JpaTransactionManager`?**
Yes, and this is worth knowing because people often assume otherwise.
`JpaTransactionManager` manages the `EntityManager`'s transaction and also
exposes the underlying `DataSource`'s connection to the thread, so
`JdbcTemplate` or `JdbcClient` calls made inside the same boundary use the same
connection and are covered by the same commit. What does change is ordering: JPA
buffers changes in the persistence context and writes them at flush time, which
may be after your JDBC statements have already run. So a `JdbcTemplate` query
that expects to see an entity you just modified can miss it unless the
persistence context has been flushed — the same class of surprise that makes
"assert row counts without a flush" a false positive in tests.

**★ You are asked why Spring has two classes that appear to do the same thing.
What is the general principle?**
That Spring adds capability alongside rather than underneath. Changing
`DataSourceTransactionManager` to translate commit exceptions would have altered
the exception type escaping every existing application's commit path — a silent
behavioural change in a class thousands of projects declare explicitly. Shipping
the behaviour in a subclass makes it opt-in, so nothing breaks and new code can
have the better default. The same pattern is everywhere in this topic:
`rollbackOn = ALL_EXCEPTIONS` is a flag rather than a new default,
`validateExistingTransaction` is a flag, `publicMethodsOnly` is a flag. The
practical lesson is that "Spring's default" and "the right setting for new code"
are frequently different, and the gap is almost always compatibility.

**★ The javadoc keeps naming `TransactionAwareDataSourceProxy`. What is it, and when
would you actually reach for it?**
It is the escape hatch for code you cannot change. Its own javadoc describes it as a
"Proxy for a target JDBC `DataSource`, adding awareness of Spring-managed transactions.
Similar to a transactional JNDI DataSource as provided by a Jakarta EE server" — and
the sentence that names the use case is "Data access code that should remain unaware of
Spring's data access support can work with this proxy to seamlessly participate in
Spring-managed transactions." Concretely: it delegates to `DataSourceUtils`, so a plain
`dataSource.getConnection()` through the proxy returns the *thread-bound* connection
instead of a fresh pooled one, and `close()` on it behaves correctly. That turns the
most dangerous pattern in this chunk into a safe one, without touching the calling
code — which is the point when the calling code is a third-party library or a legacy
DAO layer.

Three details the javadoc attaches, all of which matter in practice. The transaction
manager must still be wired to the **underlying** `DataSource`, not to the proxy.
The proxy must be "the outermost `DataSource` of a chain of DataSource
proxies/adapters", so it wraps things like `LazyConnectionDataSourceProxy` rather than
the other way round. And it has a useful side effect: "using a transaction-aware
DataSource will apply remaining transaction timeouts to all created JDBC
(Prepared/Callable)Statement", which closes the hole where a hand-made statement
escapes the transaction timeout. The javadoc is nonetheless clear that it is the second
choice — "if possible, use Spring's `DataSourceUtils`, `JdbcTemplate` or JDBC operation
objects… avoiding the need to define such a proxy in the first place." Reach for it
when you cannot edit the code that calls `getConnection`, not as a default.

---

← Prev: [6 · The transaction manager](06-the-transaction-manager.md) · Index: [Spring @Transactional](README.md) · Next → [6c · What Boot picked for you](06c-what-boot-picked-for-you.md)
