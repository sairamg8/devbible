---
title: "Isolation is session state on a pooled connection, so three layers decide what DEFAULT means and two independent mechanisms put it back"
sidebar_label: "16b · Isolation in the plumbing"
sidebar_position: 45
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `DataSourceTransactionManager` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/DataSourceTransactionManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/DataSourceTransactionManager.html)),
> the `TransactionDefinition` javadoc
> ([.../transaction/TransactionDefinition.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionDefinition.html)),
> the HikariCP README and the pool source
> (`ProxyConnection.java`, `PoolEntry.java`, `PoolBase.java`,
> [github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)),
> the PostgreSQL 18 manual *Transaction Isolation*
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html))
> and *SET TRANSACTION*
> ([postgresql.org/docs/18/sql-set-transaction.html](https://www.postgresql.org/docs/18/sql-set-transaction.html)).
> JDK 25, Spring Framework 7.0.8, HikariCP 7.0.2, pgjdbc 42.7.13, PostgreSQL 18.

**Isolation is not a property of the transaction object. It is a setting on the
JDBC `Connection`, which is borrowed from a pool and handed back — so "what level
am I running at?" is answered by a chain of three defaults, and "does my setting
leak into the next request?" is answered by two independent restore mechanisms.**

## What `DEFAULT` resolves to

`ISOLATION_DEFAULT` means "use the default isolation level of the underlying
datastore". Three layers can supply it, and each defers to the next:

1. **The pool.** HikariCP's `transactionIsolation` property — "This property
   controls the default transaction isolation level of connections returned from
   the pool. If this property is not specified, the default transaction isolation
   level defined by the JDBC driver is used."
2. **The driver.** For pgjdbc that means it does not impose one, so the session
   simply keeps the server's.
3. **The server.** PostgreSQL's `default_transaction_isolation`, which ships as
   `read committed`.

So the answer for a stock Boot 4.1 + HikariCP + PostgreSQL 18 application is
**Read Committed**, arrived at by two layers declining to decide. That is worth
knowing precisely, because "the default" is the level almost every transaction in
almost every Spring application actually runs at.

A PostgreSQL detail that catches people: its `READ UNCOMMITTED` is not a distinct
level.

> In PostgreSQL, you can request any of the four standard transaction isolation
> levels, but internally only three distinct isolation levels are implemented,
> i.e., PostgreSQL's Read Uncommitted mode behaves like Read Committed.

Asking for `Isolation.READ_UNCOMMITTED` therefore succeeds and gives you Read
Committed, with no error and no warning.

## How Spring applies a level

With `DataSourceTransactionManager`, applying an isolation level means calling
`Connection.setTransactionIsolation()` on the borrowed connection before the
transaction begins, and restoring the previous value during cleanup. The javadoc
summarises the manager's capabilities as

> Supports custom isolation levels, and timeouts which get applied as appropriate
> JDBC statement timeouts

Under JPA the same work is done by the dialect, and it is governed by
`HibernateJpaDialect`'s `prepareConnection` flag — the one whose javadoc warns
that turning it off means "JPA transaction management will not support
per-transaction isolation levels anymore".

The restore step matters because of what the connection is: a long-lived object
shared by every request that borrows it. If Spring raised a connection to
`SERIALIZABLE` and did not put it back, the next request to borrow that
connection would inherit the level for free — an invisible, load-dependent change
in behaviour.

## The pool's own restore

HikariCP does not take Spring's word for it. Its connection proxy tracks which
properties have been changed with a set of dirty bits — one each for read-only,
autocommit, isolation, catalog, network timeout and schema:

```java
static final int DIRTY_BIT_READONLY   = 0b000001;
static final int DIRTY_BIT_AUTOCOMMIT = 0b000010;
static final int DIRTY_BIT_ISOLATION  = 0b000100;
static final int DIRTY_BIT_CATALOG    = 0b001000;
static final int DIRTY_BIT_NETTIMEOUT = 0b010000;
static final int DIRTY_BIT_SCHEMA     = 0b100000;
```

On close, if any bit is set, the pool resets those properties. The restore target
is **the pool's own configured value** — the `transactionIsolation` you gave
HikariCP, or the driver default it captured at startup — not whatever the borrower
happened to find. And each property is only touched when the current state
actually differs, so the common case costs nothing.

Two independent layers restoring the same setting is why isolation leaking
between requests is rare in practice, and why an actual leak almost always means
something bypassed both: code that obtained a raw connection outside the
framework, changed the level, and closed it in a way the proxy did not see.

## Why the level must be decided at `BEGIN`

The database imposes the last constraint:

> The transaction isolation level cannot be changed after the first query or
> data-modification statement (`SELECT`, `INSERT`, `DELETE`, `UPDATE`, `MERGE`,
> `FETCH`, or `COPY`) of a transaction has been executed.

The level decides which snapshot the transaction reads from, so changing it
mid-flight would mean one transaction had read under two different consistency
rules. This is the underlying reason for everything in
[16 · Isolation](16-isolation.md): the level can only be set while starting a
transaction, which is why an annotation on a method that joins an existing one has
nothing to act on.

## The connection you never fetched

One more piece of plumbing changes when the isolation level is applied, and it is
worth knowing because it turns a per-transaction cost into a lazily-avoided one.
`DataSourceTransactionManager`'s javadoc:

> Consider defining a `LazyConnectionDataSourceProxy` for your target `DataSource`,
> pointing both this transaction manager and your DAOs to it. This will lead to
> optimized handling of "empty" transactions, i.e. of transactions without any JDBC
> statements executed. A `LazyConnectionDataSourceProxy` will not fetch an actual
> JDBC `Connection` from the target `DataSource` until a `Statement` gets executed,
> lazily applying the specified transaction settings to the target `Connection`.

Without it, a `@Transactional` method that ends up executing no SQL — a cache hit,
an early return, a validation failure — still borrows a connection, sets its
isolation, and hands it back. With it, the borrow and the `setTransactionIsolation`
call happen at the first statement, and a transaction that runs no statements
touches no connection at all.

That matters most in the applications that annotate broadly: a service where
`@Transactional` sits at class level opens a nominal transaction on every call,
including the ones that only read from a cache.

## The trade-off

Raising the pool's `transactionIsolation` gives every transaction in the
application the stronger level with one line and no annotations to forget. That is
genuinely attractive when the application is mostly one kind of workload.

What it costs is that it applies to *everything*: health checks, Flyway
migrations, background jobs, a scheduled cleanup that scans a large table. On
PostgreSQL, raising the baseline to `REPEATABLE READ` or `SERIALIZABLE` means all
of those become abortable with serialization failures, and every one of them now
needs a retry policy. The per-boundary annotation is more work and much better
targeted.

## Gotchas

**⚠️ Assuming `DEFAULT` means the same thing in every environment**
**Symptom:** behaviour that differs between local, CI and production with no code
change.
**Cause:** the default is resolved through the pool, the driver and the server, and
any of the three can be configured differently per environment — a
`transactionIsolation` in one profile's Hikari config, a
`default_transaction_isolation` set on one server.
**Fix:** pin it deliberately if it matters, and check all three places rather than
assuming the application decides.

**⚠️ Raising `transactionIsolation` on the pool to fix one race**
**Symptom:** unrelated background jobs start failing intermittently.
**Cause:** the pool property is a baseline for every connection, so every
transaction in the application inherits the stronger level and its abort
behaviour.
**Fix:** declare the level on the one boundary that needs it.

**⚠️ Changing isolation on a raw connection**
**Symptom:** a level that persists past the request that set it.
**Cause:** both restore mechanisms depend on going through the framework and the
pool proxy. A connection obtained and manipulated outside them can escape both.
**Fix:** obtain connections through `JdbcTemplate`, an `EntityManager` or
`DataSourceUtils`. This is the same rule that makes the transaction visible to
Spring at all.

**⚠️ Expecting `READ_UNCOMMITTED` to do something on PostgreSQL**
**Symptom:** an annotation requesting dirty reads that behaves exactly like Read
Committed.
**Cause:** PostgreSQL implements three distinct levels and maps Read Uncommitted
onto Read Committed.
**Fix:** none available. Do not write code — or an interview answer — that assumes
dirty reads are obtainable here.

**⚠️ Reading the pool's `transactionIsolation` value as a guarantee**
**Symptom:** a belief that every transaction runs at the configured level.
**Cause:** it is the level a connection *starts* at. Spring raises or lowers it
per transaction when an annotation asks, then restores it.
**Fix:** the pool property sets the baseline; the annotation sets the exception.
Both are in play.

**⚠️ Blaming the pool for a level that "did not apply"**
**Symptom:** time spent inspecting Hikari configuration for a declaration that was
dropped in Spring.
**Cause:** by far the most common reason a level does not apply is that the method
joined an existing transaction, which happens well before the connection is
touched.
**Fix:** check the propagation and the call graph first (16). The plumbing is the
second place to look, not the first.

## Interview questions

**★ What does `Isolation.DEFAULT` actually resolve to in a typical Boot
application?**
Read Committed, on PostgreSQL, by way of three layers each deferring to the next.
HikariCP's `transactionIsolation` is unset by default, and its documentation says
that in that case "the default transaction isolation level defined by the JDBC
driver is used"; pgjdbc does not impose one, so the session keeps the server's
`default_transaction_isolation`, which ships as `read committed`. Worth being
precise about, because it is the level under which nearly every transaction in
nearly every Spring application runs.

**★ Isolation is set on a connection, and connections are pooled. Does a level
leak into the next request?**
Not normally, because two independent mechanisms restore it. Spring's transaction
manager records the connection's previous isolation and puts it back during
cleanup. Independently, HikariCP's connection proxy tracks a dirty bit for
isolation and, when the connection is closed, resets the property — to the
**pool's** configured value, not to whatever the borrower found. A real leak
therefore needs something to evade both, which in practice means a raw connection
obtained outside the framework.

**★ Why does HikariCP reset to the pool's configured value rather than to the
value the borrower was given?**
Because the pool's configured value is the definition of a clean connection.
Restoring "what it was when handed out" would faithfully propagate any corruption
that had already happened; restoring the configured value makes every checkout
start from the same known state regardless of history. It also makes the reset
cheap — the pool already knows the target, and it only issues the call when the
current state differs.

**★ When would you set `transactionIsolation` on the pool instead of on a
method?**
When the whole application genuinely wants a different baseline — a service where
essentially every operation needs Repeatable Read, for instance. The cost is that
it applies to everything the application does through that `DataSource`, including
migrations, health checks and background scans, all of which then inherit the
stronger level's abort behaviour and need retry policies. For a single race
condition in a single operation, the annotation on that boundary is the correct
tool and the pool property is a blunt instrument.

**★ A colleague reports that `@Transactional(isolation = SERIALIZABLE)` "did not
apply" and starts inspecting the HikariCP configuration. What do you suggest?**
Check the propagation and the call graph first. By a wide margin the most common
reason a level does not apply is that the annotated method was entered while a
transaction already existed, so Spring never started one and the level had nothing
to attach to — the reference calls it silently ignoring the local isolation level.
That happens well before a connection is involved, so no amount of pool inspection
will show it. Turning on `validateExistingTransaction` in the test profile turns
that guesswork into an exception.

**★ What is the relationship between the isolation level and when it must be
set?**
The level determines which snapshot the transaction reads from, so it has to be
fixed before the transaction reads anything. PostgreSQL enforces exactly that: the
level "cannot be changed after the first query or data-modification statement… of
a transaction has been executed". That is why Spring sets it on the connection
*before* beginning the transaction, and why the whole "only applies to newly
started transactions" rule exists — there is no point in the lifecycle after
`BEGIN` at which the level could be changed even if Spring wanted to.

**★ What is a `LazyConnectionDataSourceProxy` and what does it change here?**
It defers fetching the physical `Connection` until a statement is actually
executed. The `DataSourceTransactionManager` javadoc recommends it for "optimized
handling of 'empty' transactions, i.e. of transactions without any JDBC statements
executed", and notes that it will "not fetch an actual JDBC `Connection` from the
target `DataSource` until a `Statement` gets executed, lazily applying the
specified transaction settings to the target `Connection`". So the isolation level
is applied at the first statement rather than at `BEGIN`, and a transactional
method that returns from a cache without querying never borrows a connection at
all. In applications with class-level `@Transactional` that is a meaningful
reduction in pool pressure.

**★ Somebody asks whether they should just set `SERIALIZABLE` as the pool default
"to be safe". What is wrong with that reasoning?**
That isolation is not a safety dial where higher is strictly better. Raising it
does not make incorrect code correct; on PostgreSQL it converts some races into
*aborted transactions*, which the application then has to retry — so "to be safe"
actually means "to add a retry requirement to every operation in the application,
including migrations and background jobs". The correct approach is to identify the
specific operation with the race, declare the level on the boundary that starts its
transaction, and give it a retry. A pool-wide default is right only when the whole
application genuinely wants a different baseline, and even then it is a
capacity-planning decision rather than a safety one.

---

← Prev: [16 · Isolation](16-isolation.md) · Index: [Spring @Transactional](README.md) · Next → [17 · Timeouts](17-timeouts.md)
