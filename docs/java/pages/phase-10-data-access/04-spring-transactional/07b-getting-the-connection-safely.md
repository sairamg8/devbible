---
title: "Getting a raw Connection without leaving the transaction, releasing it without closing it, and the one wrapper Spring tells you is rarely desirable"
sidebar_label: "7b · Getting the connection safely"
sidebar_position: 20
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Controlling
> database connections*
> ([docs.spring.io/spring-framework/reference/data-access/jdbc/connections.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/connections.html))
> and the `DataSourceTransactionManager` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/DataSourceTransactionManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/DataSourceTransactionManager.html)),
> the `DataSourceUtils`
> ([.../jdbc/datasource/DataSourceUtils.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/DataSourceUtils.html))
> and `LazyConnectionDataSourceProxy`
> ([.../jdbc/datasource/LazyConnectionDataSourceProxy.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/LazyConnectionDataSourceProxy.html))
> javadocs.
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, HikariCP 7.0.2,
> PostgreSQL 18.

**[Chunk 7](07-thread-binding.md) established the rule: the transaction is a
connection bound to a thread, and only `DataSourceUtils` finds it. This chunk is
the two practical consequences. The first is that when you genuinely need a raw
`Connection` — a driver API, a `COPY`, an awkward stored procedure — there is a
correct way to get one and a correct way to give it back, and the second is not
`close()`. The second is that when the code needing a connection is code you
cannot edit, there is exactly one supported answer, and Spring tells you in the
same paragraph that it is rarely the right one.**

## When you genuinely need the connection

Sometimes you do need a raw `Connection` — a driver-specific API, a `COPY`
operation, a stored procedure with an unusual signature. Use `DataSourceUtils`,
not the `DataSource`:

```java
Connection con = DataSourceUtils.getConnection(dataSource);   // the bound one
try {
    // driver-specific work, inside the transaction
} finally {
    DataSourceUtils.releaseConnection(con, dataSource);       // no-op if bound
}
```

⚠️ **Do not put that connection in a try-with-resources.** `close()` on a bound
connection is the wrong operation; `releaseConnection` is the one that knows
whether closing is correct.

## `TransactionAwareDataSourceProxy` — the escape hatch, with a warning

There is a wrapper that makes a plain `DataSource.getConnection()` return the
bound connection, so that code you cannot change participates correctly. The
reference introduces it and immediately warns against it:

> *"It is rarely desirable to use this class, except when already existing code
> must be called and passed a standard JDBC `DataSource` interface
> implementation… It is generally preferable to write your own new code by using
> the higher level abstractions."*

**The legitimate case is exactly the one it names**: a third-party library, or
legacy code you cannot edit, that takes a `DataSource` and calls `getConnection()`
on it. Wrapping the `DataSource` before handing it over makes that library's work
join your transaction.

🔴 **Do not wrap the application's main `DataSource` with it as a blanket safety
net.** Doing so makes every `getConnection()` in the codebase transaction-aware,
which sounds attractive and is not: it hides the distinction this whole chunk is
about, so the code that was wrong stays wrong and merely stops failing visibly.
Wrap narrowly, at the point you hand a `DataSource` to code you do not control.

## The connection's lifetime is the outermost boundary's

Worth stating explicitly, because it drives pool sizing. The manager binds the
connection when it starts the *physical* transaction and releases it after the
commit or rollback. Every participating inner method uses the same bound
connection and releases nothing when it returns.

```
placeOrder            @Transactional   ← connection checked out HERE
  ├── validate()                          (no database work — still holding it)
  ├── writer.save()  @Transactional       (joins; uses the same connection)
  ├── callPaymentApi()                    (800 ms of HTTP — still holding it)
  └── return                            ← connection released HERE
```

So connection-hold time tracks the length of the **outermost** annotated method,
not the length of the queries. A transaction that spends most of its life waiting
on an HTTP call occupies a pool slot for that whole time while touching no
database at all — which is why "what belongs inside the boundary" is a real
design question and not a stylistic one.

## The trade-off

`DataSourceUtils` gives you the escape hatch that keeps you inside the
transaction, and the price is that the resource protocol stops being the ordinary
Java one. Try-with-resources — the correct, idiomatic, compiler-checked way to
handle a `Connection` everywhere else in Java — becomes wrong here, and nothing
in the type system says so. `TransactionAwareDataSourceProxy` restores the
ordinary protocol, and its price is worse: it hides the distinction entirely, so
incorrect code stops failing without becoming correct. Neither option is
comfortable, which is the honest reason the reference's advice is to use the
higher-level abstractions and need neither.

## Gotchas

**⚠️ Closing a connection obtained from `DataSourceUtils`**
**Symptom:** "connection is closed" errors later in the same transaction, or a
connection returned to the pool mid-transaction.
**Cause:** `close()` does not know the connection is bound; `releaseConnection`
does.
**Fix:** always `DataSourceUtils.releaseConnection(con, dataSource)`, never
try-with-resources.

**⚠️ Try-with-resources on a `DataSourceUtils` connection because the IDE
suggested it**
**Symptom:** the same, arrived at by following good general Java advice.
**Cause:** `Connection` is `AutoCloseable`, so every tool in the ecosystem
recommends the construct that is wrong here.
**Fix:** a comment at the call site saying why, because the next reader will
"fix" it back.

**⚠️ Wrapping the main `DataSource` in `TransactionAwareDataSourceProxy`**
**Symptom:** the bug goes away and the codebase gets worse.
**Cause:** it papers over the distinction rather than fixing the code, and the
reference says it "is rarely desirable".
**Fix:** wrap only at the boundary with code you cannot change.

**⚠️ Handing a `DataSource` to a third-party library and expecting
participation**
**Symptom:** a library's writes commit independently of your transaction.
**Cause:** the library calls `getConnection()` on the standard interface, exactly
as it should.
**Fix:** this is the one case `TransactionAwareDataSourceProxy` exists for.

**⚠️ Injecting the wrapped `DataSource` into Spring's own templates too**
**Symptom:** an extra layer of indirection on every query for no benefit.
**Cause:** `JdbcTemplate` already consults the binding; wrapping adds a proxy it
does not need.
**Fix:** wrap the reference you hand to the foreign code, not the bean everything
uses.

**⚠️ Setting autocommit or isolation on a connection you obtained**
**Symptom:** the transaction behaves unpredictably, or a pooled connection
carries the change to the next borrower.
**Cause:** the connection is the transaction's; the manager configured it and
expects to be the only thing that does.
**Fix:** declare isolation and read-only on the annotation and leave the
connection's state alone.

**⚠️ Assuming the bound connection is returned to the pool when your method
returns**
**Symptom:** connection-pool pressure that tracks the length of the *outermost*
method rather than the one doing the query.
**Cause:** the connection is unbound and released at the outermost boundary, not
at the end of an inner participating method.
**Fix:** keep slow non-database work out of the boundary —
[chunk 21](21-what-belongs-in-a-transaction.md).

**⚠️ Holding a connection across a slow non-database call**
**Symptom:** pool exhaustion under load with low database utilisation.
**Cause:** the boundary, not the query, decides how long a connection is held.
**Fix:** move the slow call outside the transactional method.

## Interview questions

**★ You need a raw `Connection` for a driver-specific API inside a transactional
method. How do you get one safely?**
`DataSourceUtils.getConnection(dataSource)` gives you the bound one, so your
driver-specific work is inside the transaction. The part people get wrong is the
release: do **not** use try-with-resources, because `close()` on a bound
connection is the wrong operation — it would return the transaction's connection
to the pool while the transaction is still open. Use
`DataSourceUtils.releaseConnection(con, dataSource)` in a `finally`, which checks
whether the connection is the thread-bound one and closes it only if it is not.
That asymmetry — get with `DataSourceUtils`, release with `DataSourceUtils`,
never `close` — is the whole safe pattern.

**★ Why is try-with-resources wrong here when it is right everywhere else?**
Because try-with-resources calls `close()`, and `close()` on a `Connection` means
"I am finished with this connection" — which for a pooled connection means
returning it to the pool. Inside a transaction that connection is not yours to
finish with: the transaction manager borrowed it, configured it, bound it to the
thread, and intends to commit on it and release it at the boundary. Closing it
early either ends the transaction's session or returns a connection to the pool
that another thread can then borrow while your transaction still believes it owns
it. `releaseConnection` exists precisely to make the decision conditional: it
closes the connection when there is no transaction and does nothing when the
connection is the bound one. The uncomfortable part is that nothing in the type
system distinguishes the two cases, so the correct code looks like a mistake.

**★ When is `TransactionAwareDataSourceProxy` the right answer?**
Only in the case the reference names: "when already existing code must be called
and passed a standard JDBC `DataSource` interface implementation". A third-party
library, or legacy code you cannot edit, takes a `DataSource` and calls
`getConnection()` on it; wrapping the `DataSource` before you hand it over makes
that call return the thread-bound connection, so the library's work joins your
transaction. What it is *not* for is protecting your own codebase from itself.
Wrapping the application's main `DataSource` makes every incorrect
`getConnection()` silently start working, which removes the symptom and keeps the
misunderstanding — and the reference is explicit that it is "generally preferable
to write your own new code by using the higher level abstractions".

**★ Why is making every `getConnection()` transaction-aware a bad idea, given
that it would fix a whole class of bug?**
Because it fixes the symptom in a way that guarantees the misunderstanding
persists. After the wrap, `dataSource.getConnection()` and
`DataSourceUtils.getConnection(dataSource)` behave the same, so nobody ever
learns that they differ — and the day someone injects the unwrapped `DataSource`,
or a new module wires its own, the bug returns with no clue as to why. It also
makes an application-wide behavioural change to satisfy a small number of call
sites, in a class the framework itself describes as "rarely desirable". The
narrow wrap has none of these properties: it applies at one injection point, it
is visible in the configuration, and it does not change how anything else in the
application behaves.

**★ When is the connection actually returned to the pool?**
At the *outermost* transaction boundary, not when the method that ran the query
returns. The manager binds the connection when it starts the physical transaction
and unbinds and releases it after the commit or rollback; every participating
inner method uses the same bound connection and releases nothing. That is why
connection-hold time tracks the length of the outermost `@Transactional` method,
and why putting an HTTP call or a slow computation inside a transaction costs a
pool slot for its whole duration even though it touches no database. It is also
why the pool arithmetic for `REQUIRES_NEW` matters: an inner transaction takes a
*second* connection and the outer one keeps its own bound throughout.

**★ How would you audit a codebase for connections that escape the transaction?**
Grep is unusually effective here, because the wrong call has a distinctive shape:
any occurrence of `.getConnection()` on something typed `DataSource`. In a Spring
application there should be very few, and each one is either correct (a place
with no transaction, doing its own resource management) or a bug. An ArchUnit
rule can make it permanent — forbid calls to `javax.sql.DataSource.getConnection`
outside a named set of infrastructure classes. Beyond the direct call, look for
classes that take a `DataSource` in their constructor and do their own JDBC,
because they are where this pattern lives; a class that takes a `JdbcTemplate` or
a `JdbcClient` cannot make the mistake. The runtime version of the audit is
harder, which is why the static one is worth the effort.

**★ You are handed a `Connection` by code you did not write. How do you tell whether it
is the transaction's?**
`DataSourceUtils.isConnectionTransactional(con, dataSource)`, documented as: "Determine
whether the given JDBC `Connection` is transactional, that is, bound to the current
thread by Spring's transaction facilities." It is the direct answer, it takes the
`DataSource` because the binding is keyed by it, and it is the check to make before
deciding whether you are allowed to call `close()`, `setAutoCommit` or
`setTransactionIsolation` on the thing you were given — all three of which are correct
on an unbound connection and wrong on a bound one. It is also worth knowing the two
timeout helpers alongside it, because they close the hole where a hand-made statement
escapes the transaction's deadline: `applyTransactionTimeout(stmt, dataSource)` —
"Apply the current transaction timeout, if any, to the given JDBC `Statement` object" —
and `applyTimeout(stmt, dataSource, timeout)`, which applies your own value "overridden
by the current transaction timeout, if any". If you are doing raw JDBC inside a
boundary, those two calls are what `JdbcTemplate` would have done for you.

**★ The connection is held for the whole outermost method. Is "keep slow work out of
the boundary" the only answer?**
It is the right answer and it is not the only tool. `LazyConnectionDataSourceProxy`
exists for exactly this shape: it is a "Proxy for a target `DataSource`, fetching actual
JDBC Connections lazily, i.e. not until first creation of a `Statement`", and it keeps
the connection-initialization properties — "auto-commit mode, transaction isolation and
read-only mode… will be kept and applied to the actual JDBC Connection as soon as an
actual Connection is fetched (if ever)". The consequence the javadoc draws is the useful
one: "commit and rollback calls will be ignored if no Statements have been created", so
"JDBC transaction control can happen without fetching a Connection from the pool or
communicating with the database". It calls out the case it was built for — a "generic
transaction demarcation environment, allowing you to demarcate transactions on all
methods that could potentially perform data access, without paying a performance penalty
if no actual data access happens".

Two limits worth stating plainly, because it is easy to read that as a fix for the
HTTP-call-inside-a-transaction problem and it is not. The connection is still acquired
at the *first statement* and held to the boundary, so a slow call placed **after** a
query still holds a pool slot for its whole duration — laziness only helps at the front
of the method. And it changes when connection failures surface, from the boundary to
the first statement. Its own configuration warning is worth carrying too: if you also
use `TransactionAwareDataSourceProxy`, "make sure that the latter is the outermost
`DataSource`". Since 6.1.2 it can additionally route a read-only transaction to a
separate read-only `DataSource`, via `setReadOnlyDataSource`, which is a genuinely
different feature wearing the same class name.

---

← Prev: [7 · Thread binding](07-thread-binding.md) · Index: [04 · Spring @Transactional](README.md) · Next → [8 · Propagation REQUIRED](08-propagation-required.md)
