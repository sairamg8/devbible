---
title: "Isolation on @Transactional applies only to a transaction Spring actually starts — set it on a method that joins one and it is discarded without a sound"
sidebar_label: "16 · Isolation"
sidebar_position: 44
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `TransactionDefinition` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionDefinition.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionDefinition.html)),
> the `Isolation` javadoc
> ([.../transaction/annotation/Isolation.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Isolation.html)),
> the `@Transactional` javadoc
> ([.../transaction/annotation/Transactional.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Transactional.html)),
> the `DataSourceTransactionManager` javadoc
> ([.../jdbc/datasource/DataSourceTransactionManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/DataSourceTransactionManager.html)),
> the Spring Framework 7.0 reference *Using `@Transactional`* and *Transaction
> propagation*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)),
> the PostgreSQL 18 manual *SET TRANSACTION*
> ([postgresql.org/docs/18/sql-set-transaction.html](https://www.postgresql.org/docs/18/sql-set-transaction.html))
> and the HikariCP source
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)).
> JDK 25, Spring Framework 7.0.8, HikariCP 7.0.2, pgjdbc 42.7.13, PostgreSQL 18.

**`@Transactional(isolation = Isolation.SERIALIZABLE)` is a request to open a new
transaction at that level. If the method is entered while a transaction is already
running, Spring does not open one — so there is nothing to set the level on, and
the declaration is dropped silently. Unlike the read-only flag, which costs you an
optimisation, this one costs you correctness.**

## What the enum is

`Isolation` is a thin wrapper over the JDBC constants. The javadoc:

> Enumeration that represents transaction isolation levels for use with the
> `@Transactional` annotation, corresponding to the `TransactionDefinition`
> interface.

and `TransactionDefinition`'s constants are explicitly aligned with the driver's:

> Must return one of the `ISOLATION_XXX` constants defined on this interface.
> Those constants are designed to match the values of the same constants on
> `Connection`.

Five values:

| `Isolation` | Javadoc |
|---|---|
| `DEFAULT` | "Use the default isolation level of the underlying data store. All other levels correspond to the JDBC isolation levels." |
| `READ_UNCOMMITTED` | "A constant indicating that dirty reads, non-repeatable reads, and phantom reads can occur." |
| `READ_COMMITTED` | "A constant indicating that dirty reads are prevented; non-repeatable reads and phantom reads can occur." |
| `REPEATABLE_READ` | "A constant indicating that dirty reads and non-repeatable reads are prevented; phantom reads can occur." |
| `SERIALIZABLE` | "A constant indicating that dirty reads, non-repeatable reads, and phantom reads are prevented." |

What those anomalies *mean*, how a database implements them, and what
`SERIALIZABLE` costs you in retries is **[Topic 03 — Transactions at the JDBC level](../03-jdbc-transactions/README.md)**. This page is about Spring's exposure of the setting,
which has its own failure modes independent of the levels themselves.

## The rule that turns a declaration into decoration

The `@Transactional` javadoc, on the `isolation` attribute:

> **Exclusively designed for use with `Propagation.REQUIRED` or
> `Propagation.REQUIRES_NEW`** since it only applies to newly started
> transactions.

The reference's settings table says the same in fewer words: "Applies only to
propagation values of `REQUIRED` or `REQUIRES_NEW`."

The mechanism is simple once you see it. With `REQUIRED` — the default — Spring
checks whether a transaction is already bound to the thread. If there is none, it
starts one, and setting the isolation level is part of starting it. If there *is*
one, Spring does not start anything; your method just runs inside the transaction
that already exists, at whatever level that transaction was opened with.

The propagation reference states the consequence:

> By default, a participating transaction joins the characteristics of the outer
> scope, silently ignoring the local isolation level, timeout value, or read-only
> flag (if any).

So this compiles, reads convincingly, and does nothing:

```java
@Service
class OrderService {
    private final StockService stock;

    @Transactional                                        // starts: READ COMMITTED
    public void place(NewOrder cmd) {
        stock.decrementWithSerializableGuard(cmd.sku());   // joins it
        ...
    }
}

@Service
class StockService {
    @Transactional(isolation = Isolation.SERIALIZABLE)     // ignored
    public void decrementWithSerializableGuard(String sku) { ... }
}
```

`decrementWithSerializableGuard` runs at whatever level `place` opened, which on
PostgreSQL will normally be `READ COMMITTED`. The guard the method's name promises
does not exist. Nothing logs a warning. The only evidence will be a lost update
under concurrency, months later, which nobody will connect to this annotation.

This is why isolation deserves a stronger reaction than read-only does: a missed
optimisation is a performance regression, and a missed isolation level is
incorrect data.

## Making it fail instead

Spring provides a switch for exactly this. The `getIsolationLevel()` javadoc:

> Consider switching the "validateExistingTransaction" flag to "true" on your
> transaction manager if you'd like isolation level declarations to get rejected
> when participating in an existing transaction with a different isolation level.

```java
@Bean
DataSourceTransactionManager transactionManager(DataSource dataSource) {
    var tm = new DataSourceTransactionManager(dataSource);
    tm.setValidateExistingTransaction(true);
    return tm;
}
```

With it on, the mismatch above becomes an exception at the point of the join
rather than a silent difference in behaviour. It also catches read-only
mismatches (see [15b](15b-where-read-only-pays.md)), which is a bonus.

The reason it is not the default is that plenty of applications declare
`readOnly = true` on inner read methods perfectly harmlessly, and turning
validation on makes all of those fail. Enabling it is therefore a decision with a
cleanup cost — but it is a cleanup that removes annotations which were lying.

Turning it on in the **test** profile only is a reasonable middle position: the
lying annotations surface during development, and production keeps the lenient
behaviour.

## Where the level comes from when you do not declare one, and what the pool does
with it, is [16b · Isolation in the plumbing](16b-isolation-in-the-plumbing.md).

## The trade-off

Declaring a stronger isolation level buys you a guarantee the database enforces,
and it is the only honest way to get some of them — you cannot emulate
`SERIALIZABLE` with careful application code.

What you pay is concurrency and retries. On PostgreSQL, `SERIALIZABLE` and
`REPEATABLE READ` transactions can be aborted by the server with a serialization
failure, and the manual is explicit that applications "must be prepared to
retry". So a `SERIALIZABLE` annotation is never a complete design on its own: it
comes with a retry requirement, and the retry has to sit **outside** the
transaction boundary, because a transaction that has failed cannot be continued —
see [21 · What belongs in a transaction](21-what-belongs-in-a-transaction.md).

You also pay in fragility, which is this page's subject. The setting works only
where Spring starts the transaction, so its effect depends on a call graph that
can change without anybody thinking about isolation.

## Gotchas

**⚠️ Isolation set on a method that joins an existing transaction**
**Symptom:** the guarantee the annotation promises does not exist, with no
diagnostic anywhere.
**Cause:** with `REQUIRED`, a participating method does not start a transaction,
so the level is never applied — "silently ignoring the local isolation level".
**Fix:** declare it on the boundary that starts the transaction, or use
`REQUIRES_NEW` if the inner work genuinely needs its own. Turn on
`validateExistingTransaction` so the next such mistake fails loudly.

**⚠️ The same method behaving differently depending on the caller**
**Symptom:** a repeatable-read guarantee that holds when the method is called
from a scheduler and not when it is called from a controller.
**Cause:** entered with no transaction it starts its own at the declared level;
entered from a service that already has one it joins that one.
**Fix:** isolation belongs on the outermost boundary of the unit of work. Anywhere
else its effect is conditional on the call graph, which is not something a reader
of the method can see.

**⚠️ Adding `SERIALIZABLE` and no retry**
**Symptom:** intermittent failures under load that were not there before.
**Cause:** serializable transactions can be aborted when the server detects a
dependency cycle; the PostgreSQL manual states applications must be prepared to
retry.
**Fix:** put a retry around the transaction boundary, restarting it whole. Not
inside — a transaction that has failed cannot be continued.

**⚠️ A transaction manager that does not support custom levels**
**Symptom:** an exception on any level other than `DEFAULT`.
**Cause:** the `TransactionDefinition` javadoc: "a transaction manager that does
not support custom isolation levels will throw an exception when given any other
level than `ISOLATION_DEFAULT`". Some JTA setups are in this category.
**Fix:** nothing to fix — this is the *good* failure mode. It tells you at the
boundary instead of after the fact.

**⚠️ `setPrepareConnection(false)` on the Hibernate JPA dialect**
**Symptom:** isolation declarations stop having any effect under JPA.
**Cause:** the dialect javadoc — "If you turn this flag off, JPA transaction
management will not support per-transaction isolation levels anymore." It costs
read-only propagation at the same time; they are the same switch.
**Fix:** find out what that switch was set for before removing it, and know that
it disables two features together.

**⚠️ Treating `validateExistingTransaction = true` as a free win**
**Symptom:** enabling it breaks a working application on startup or under load.
**Cause:** it rejects *every* mismatch, including the harmless
`readOnly = true` inner methods that most codebases are full of.
**Fix:** enable it in the test profile first, clean up what it finds, then decide
about production. The declarations it breaks were not doing anything anyway.

## Interview questions

**★ Why is `@Transactional(isolation = …)` sometimes ignored?**
Because it is a characteristic of *starting* a transaction. With the default
`REQUIRED` propagation, a method entered while a transaction is already bound to
the thread does not start one — it participates in the existing transaction, which
was already opened at some level and cannot be re-levelled. The javadoc calls the
attribute "exclusively designed for use with `Propagation.REQUIRED` or
`Propagation.REQUIRES_NEW`… since it only applies to newly started transactions",
and the propagation reference says a participating transaction joins the outer
scope's characteristics, "silently ignoring the local isolation level". The word
that matters is *silently*.

**★ How is that different from the same problem with `readOnly`?**
Mechanically it is identical — one sentence in the reference covers both. The
consequences are not. A dropped read-only flag costs an ORM optimisation, so you
get correct data and slightly more work. A dropped isolation level costs a
concurrency guarantee, so you get a system that appears to work and produces wrong
data under load. That asymmetry is why `validateExistingTransaction` is worth
turning on even though it makes harmless read-only declarations fail: the failures
it surfaces are cheap and the bug it prevents is not.

**★ You are asked to add `SERIALIZABLE` to a method with a check-then-write race.
Is that a complete fix?**
Not on its own. `SERIALIZABLE` on PostgreSQL prevents the anomaly by *aborting*
one of the conflicting transactions, so the application has to be prepared to
retry — the manual says so directly. That retry must sit outside the transaction
boundary and restart the whole transaction, because a failed transaction cannot be
continued. I would also check the annotation is on a boundary Spring actually
starts: if the method is called from another transactional service, the level is
dropped and the race is exactly where it was, now with a comment claiming
otherwise.

**★ Why can't the isolation level be changed in the middle of a transaction?**
Because the database will not allow it. PostgreSQL's `SET TRANSACTION`
documentation states the level "cannot be changed after the first query or
data-modification statement… of a transaction has been executed". The reason is
that the level determines which snapshot the transaction sees; changing it
mid-flight would mean one transaction had read under two different consistency
rules. That constraint is what forces the level to be a property of the boundary,
which in turn is why the annotation only means anything where a boundary begins.

**★ Would you turn `validateExistingTransaction` on in production?**
In tests, without hesitation — it converts a silent class of decorative
annotations into failures at the moment they are written. In production it is a
judgement call, because it will throw on mismatches that were previously harmless,
notably a `readOnly = true` inner method under a read-write caller. My preferred
order is: enable it in the test profile, fix everything it finds, then consider
production, where by that point it protects against a regression rather than
uncovering a backlog.

**★ Where should an isolation level be declared in a layered application?**
On the method that defines the unit of work — usually the outermost service
method a controller, listener or scheduled task calls. That is the boundary Spring
starts a transaction at, so it is the only place the level is guaranteed to take
effect. Declaring it on an inner helper is worse than useless: it takes effect
when the helper is called directly and is dropped when it is called through a
transactional caller, so the same code has two behaviours and the annotation
documents neither of them reliably.

---

← Prev: [15b · Where read-only pays](15b-where-read-only-pays.md) · Index: [Spring @Transactional](README.md) · Next → [16b · Isolation in the plumbing](16b-isolation-in-the-plumbing.md)
