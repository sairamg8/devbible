---
title: "readOnly = true is a hint that passes through four independent layers, and each of them is free to ignore it"
sidebar_label: "15 · Read-only"
sidebar_position: 42
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `TransactionDefinition` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionDefinition.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionDefinition.html)),
> the `@Transactional` javadoc
> ([.../transaction/annotation/Transactional.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Transactional.html)),
> the `HibernateJpaDialect` javadoc
> ([.../orm/jpa/vendor/HibernateJpaDialect.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/orm/jpa/vendor/HibernateJpaDialect.html)),
> the Spring Framework 7.0 reference *Using `@Transactional`*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)),
> the pgjdbc documentation
> ([jdbc.postgresql.org/documentation/use/](https://jdbc.postgresql.org/documentation/use/))
> and the PostgreSQL 18 manual *SET TRANSACTION*
> ([postgresql.org/docs/18/sql-set-transaction.html](https://www.postgresql.org/docs/18/sql-set-transaction.html)).
> JDK 25, Spring Framework 7.0.8, Hibernate ORM 7.4.1, pgjdbc 42.7.13,
> PostgreSQL 18.

**`@Transactional(readOnly = true)` does not make your transaction read-only. It
sets a flag, and then four separate pieces of software — Spring, the transaction
manager and its ORM dialect, the JDBC driver, and the database — each decide
independently what to do about it. Some of them do a lot. At least one of them is
allowed to do nothing at all, silently.**

## The javadoc says "hint", and means it

`TransactionDefinition.isReadOnly()`:

> Return whether to optimize as a read-only transaction.
>
> This just serves as a hint for the actual transaction subsystem; it will not
> necessarily cause failure of write access attempts. A transaction manager which
> cannot interpret the read-only hint will not throw an exception when asked for a
> read-only transaction.

The `@Transactional` javadoc repeats it with even less ambiguity:

> This just serves as a hint for the actual transaction subsystem; it will *not
> necessarily* cause failure of write access attempts. A transaction manager which
> cannot interpret the read-only hint will *not* throw an exception when asked for
> a read-only transaction but rather silently ignore the hint.

So `readOnly = true` is not a safety mechanism. It is a request for optimisation.
Whether writes are actually *prevented* depends entirely on which of the four
layers below happens to be in play.

## Layer 1 — Spring's own flag

Spring records the flag on the transaction it starts and binds it to the thread.
Any code on that thread can ask:

```java
import org.springframework.transaction.support.TransactionSynchronizationManager;

boolean ro = TransactionSynchronizationManager.isCurrentTransactionReadOnly();
```

This is the layer that always exists, whatever the data access technology, and it
is the layer other infrastructure reads. Routing a read-only transaction to a
replica, for example, is implemented by a `DataSource` that consults exactly this
flag when it is asked for a connection.

By itself, layer 1 changes nothing about what SQL can run. It only publishes the
intent.

## Layer 2 — the transaction manager and its ORM dialect

This is where the interesting work happens, and it is technology-specific.

With **`DataSourceTransactionManager`** (plain JDBC / `JdbcTemplate`), the flag is
passed down to the connection — layer 3 — and that is the whole of it. There is
no ORM to optimise.

With **`JpaTransactionManager` over Hibernate**, `HibernateJpaDialect` does two
things. It prepares the flush mode, via

```java
protected FlushMode prepareFlushMode(Session session, boolean readOnly)
```

which the javadoc for `beginTransaction` describes as returning

> transaction data for a flush mode reset if necessary

and it prepares the JDBC connection, controlled by a flag that is on by default:

> Set whether to prepare the underlying JDBC Connection of a transactional
> Hibernate Session, that is, whether to apply a transaction-specific isolation
> level and/or the transaction's read-only flag to the underlying JDBC Connection.

Turning that off has a documented consequence:

> If you turn this flag off, JPA transaction management will not support
> per-transaction isolation levels anymore. It will not call
> `Connection.setReadOnly(true)` for read-only transactions anymore either.

There is also a version note worth knowing when reading older material:

> NOTE: The default behavior in terms of read-only handling changed in Spring 4.1,
> propagating the read-only status to the JDBC Connection now, analogous to other
> Spring transaction managers.

The flush-mode half is where the real performance win lives, and it gets its own
page: [15b · Where read-only actually pays](15b-where-read-only-pays.md).

## Layer 3 — `Connection.setReadOnly(true)`

Assuming layer 2 chose to propagate it, Spring calls `setReadOnly(true)` on the
JDBC `Connection` before the transaction begins, and restores the previous value
afterwards.

`java.sql.Connection.setReadOnly` is a JDBC hint too. The JDBC contract is that it
"puts this connection in read-only mode as a driver hint to enable database
optimizations", and that it cannot be called during a transaction. Drivers vary
enormously in what they do with it: some ignore it entirely, some pass it to the
server, some use it only for internal routing.

The practical point: layer 3 is a *call into the driver*, not a guarantee. What
happens next is layer 4's business.

## Layer 4 — what the database is told, if anything

With **pgjdbc** the behaviour is configurable and the default is not "ignore".
The driver has a `readOnlyMode` parameter with three values — `ignore`,
`transaction`, `always` — and the default is **`transaction`**. In that mode, when
`setReadOnly(true)` has been called and autocommit is off, the driver opens the
transaction as

```sql
BEGIN READ ONLY
```

and at that point PostgreSQL is genuinely enforcing it. The PostgreSQL 18 manual
for `SET TRANSACTION` lists what `READ ONLY` forbids: `INSERT`, `UPDATE`,
`DELETE`, `MERGE` and `COPY FROM` against non-temporary tables, all
`CREATE`/`ALTER`/`DROP`, `COMMENT`, `GRANT`, `REVOKE`, `TRUNCATE`, and
`EXPLAIN ANALYZE` or `EXECUTE` of any of those. A write attempt is an error from
the server, not a silent no-op.

So on the Boot 4.1 / pgjdbc 42.7 / PostgreSQL 18 stack in this bible, `readOnly =
true` on a `REQUIRED` boundary **is** enforced at the database, by default. That
is a property of this specific stack. Change the driver, set
`readOnlyMode=ignore`, or run against a database whose driver does nothing with
the flag, and the same annotation stops enforcing anything while the code looks
identical.

## Why "hint" is the right word for the whole chain

Each layer is independently optional:

| Layer | What it does | Can it silently do nothing? |
|---|---|---|
| 1 · Spring's flag | records intent, publishes it to infrastructure | no — it is always set |
| 2 · manager + ORM dialect | flush mode, connection preparation | yes — `prepareConnection = false`, or a manager that does not interpret it |
| 3 · `Connection.setReadOnly` | tells the driver | yes — the JDBC contract calls it a hint |
| 4 · the database | `BEGIN READ ONLY` and real enforcement | yes — `readOnlyMode=ignore`, or a driver that never sends it |

Only layer 1 is guaranteed. That is the honest summary, and it is why the
annotation should be read as "this transaction intends only to read" rather than
"this transaction cannot write".

## The trade-off

Marking read paths `readOnly = true` costs nothing you would miss and buys
several unrelated things at once: the ORM optimisation of layer 2, an
enforcement net at layer 4 on stacks that provide one, and a machine-readable
declaration that infrastructure can route on. The cost is that the annotation
looks stronger than it is, so a reader can conclude the code *cannot* write when
in fact it merely says it will not — and on a stack where layer 4 is not
enforcing, a stray write will succeed and commit.

The trade is worth making everywhere, provided nobody treats the flag as an
authorisation control. It is a performance and intent declaration that happens to
be enforced on some stacks.

## Gotchas

**⚠️ Treating `readOnly = true` as a security or safety control**
**Symptom:** a write happens in a method marked read-only and commits.
**Cause:** the javadoc's "not necessarily cause failure of write access attempts".
Whether it fails depends on layers 2–4, none of which are guaranteed.
**Fix:** if writes must be impossible, use a database role without write
privileges, or a separate read-only `DataSource`. The annotation is an
optimisation hint that happens to be enforced on some stacks.

**⚠️ Assuming the behaviour is portable across databases**
**Symptom:** a read-only method that throws on PostgreSQL and quietly writes on
another database in a second environment.
**Cause:** layer 4 is entirely driver- and server-specific. pgjdbc's default
`readOnlyMode=transaction` sends `BEGIN READ ONLY`; other drivers do other
things, including nothing.
**Fix:** know which stack you are on, and do not let a test suite running against
a different database be the proof that the flag is enforced.

**⚠️ `readOnlyMode=ignore` set in a JDBC URL for an unrelated reason**
**Symptom:** enforcement disappears everywhere in the application at once, with
no code change.
**Cause:** the driver stops translating `setReadOnly(true)` into `BEGIN READ
ONLY`, so layer 4 vanishes while layers 1–3 look identical.
**Fix:** treat the connection URL as part of the transactional configuration and
review changes to it accordingly.

**⚠️ `setPrepareConnection(false)` on the Hibernate dialect**
**Symptom:** per-transaction isolation levels stop working *and* read-only stops
reaching the connection, both at once.
**Cause:** they are the same flag. The javadoc says so explicitly.
**Fix:** know that this switch is usually set to work around a pooling or
proxying constraint, and that it costs both features together.

**⚠️ Expecting `setReadOnly` to work mid-transaction**
**Symptom:** an exception from the driver when code tries to flip the flag on an
already-open connection.
**Cause:** the JDBC contract does not allow `setReadOnly` during a transaction;
Spring sets it before the transaction begins for exactly this reason.
**Fix:** the flag is a property of the boundary, declared on the annotation. There
is no supported way to change it partway through.

**⚠️ Believing the flag is what makes the query fast**
**Symptom:** disappointment when a read-only annotation does not speed up a
`JdbcTemplate` query.
**Cause:** with `DataSourceTransactionManager` there is no ORM to optimise, so
layers 1, 3 and 4 are all that happen — and none of them makes a `SELECT` faster.
The win is an ORM win.
**Fix:** expect the benefit where there is a persistence context. See 15b.

## Interview questions

**★ What does `@Transactional(readOnly = true)` actually do?**
It sets a flag on the transaction definition. Spring records it and binds it to
the thread, where infrastructure can read it back through
`TransactionSynchronizationManager.isCurrentTransactionReadOnly()`. The
transaction manager then decides what to make of it — with Hibernate that means
preparing the flush mode and, unless `prepareConnection` has been turned off,
propagating the flag to the JDBC connection via `Connection.setReadOnly(true)`.
The driver decides what to do with that call, and on pgjdbc with the default
`readOnlyMode=transaction` it opens the transaction as `BEGIN READ ONLY`, at
which point PostgreSQL genuinely rejects writes. Four layers, each optional
except the first.

**★ Is it a guarantee that nothing will be written?**
No, and the javadoc is explicit: "it will not necessarily cause failure of write
access attempts. A transaction manager which cannot interpret the read-only hint
will not throw an exception when asked for a read-only transaction but rather
silently ignore the hint." On the Boot 4 / pgjdbc / PostgreSQL stack it happens
to be enforced end to end, but that is a property of that stack, not of the
annotation. If writes must be impossible, the control belongs in the database —
a role without write privileges, or a dedicated read-only `DataSource`.

**★ Which layer is the one that actually stops the write on PostgreSQL?**
The server. Spring calls `setReadOnly(true)`; pgjdbc, in its default
`readOnlyMode=transaction`, translates that into `BEGIN READ ONLY`; and
PostgreSQL then refuses `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `COPY FROM` to
non-temporary tables, all DDL, `TRUNCATE`, `GRANT`/`REVOKE`/`COMMENT`, and
`EXPLAIN ANALYZE` of any of those. Nothing in Spring or in the driver checks your
SQL; the enforcement is entirely the database's.

**★ Why does Spring set the flag on the connection before the transaction rather
than during it?**
Because JDBC does not permit `setReadOnly` to be called during a transaction, and
because `BEGIN READ ONLY` is a property of the transaction's start. The
characteristic has to be decided before any work happens, which is also why the
`@Transactional` attribute is only meaningful on a boundary that actually starts
a transaction — a point that has its own consequences, covered in 15b.

**★ You see `readOnly = true` on a method that calls `save()`. What do you
conclude?**
First, that the annotation is wrong regardless of whether it currently throws:
the method's declared intent contradicts what it does, and the next person to
read it will be misled. Second, that the behaviour depends on the stack — on
PostgreSQL with default driver settings it will fail at the database, on other
stacks it may commit successfully, and on Hibernate it may do neither because the
flush never happens. Third, that this is probably a copy-pasted class-level
annotation rather than a deliberate choice, which is worth checking because the
same paste is likely on other methods.

**★ How would you make a genuinely read-only path, not just a hinted one?**
By taking the guarantee out of the application. Point the read path at a
`DataSource` configured with database credentials that have no write privileges,
so the enforcement is the server's authorisation system rather than a flag any
layer may drop. If the goal is replica routing rather than safety, the flag *is*
the right mechanism — a routing `DataSource` reads
`isCurrentTransactionReadOnly()` and chooses the replica — but then be clear that
what you have built is routing, and the replica being read-only is what protects
you, not the annotation.

---

← Prev: [14c · What the database did](14c-what-the-database-did.md) · Index: [Spring @Transactional](README.md) · Next → [15b · Where read-only pays](15b-where-read-only-pays.md)
