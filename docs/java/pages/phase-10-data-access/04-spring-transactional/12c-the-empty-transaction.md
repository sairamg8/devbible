---
title: "When there is nothing to join and nothing to start, Spring does not do nothing — it builds an \"empty\" transaction, and that object decides what half the API reports"
sidebar_label: "12c · The empty transaction"
sidebar_position: 33
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `AbstractPlatformTransactionManager` javadoc and
> source
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/AbstractPlatformTransactionManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/AbstractPlatformTransactionManager.html),
> [github.com/spring-projects/spring-framework/.../transaction/support/AbstractPlatformTransactionManager.java](https://github.com/spring-projects/spring-framework/blob/main/spring-tx/src/main/java/org/springframework/transaction/support/AbstractPlatformTransactionManager.java)),
> the `Propagation` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Propagation.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Propagation.html))
> and the `TransactionSynchronizationManager` javadoc
> ([.../org/springframework/transaction/support/TransactionSynchronizationManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronizationManager.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, PostgreSQL 18.

**Spring has a third state, and almost nobody knows its name. There is "inside a
transaction", there is "no transaction at all", and there is the **empty
transaction** — a scope with synchronization but no backend transaction, which
Spring creates whenever a propagation says "run without one". It is not nothing.
It binds a connection for its whole duration, it makes one of the two obvious
"am I in a transaction?" checks return `true`, and it is the reason `NEVER` does
not fire where you might expect it to.**

## Where it comes from

`AbstractPlatformTransactionManager.getTransaction` has exactly three outcomes.
It asks `isExistingTransaction`; if that is true it goes to
`handleExistingTransaction`. If not, `MANDATORY` throws, `REQUIRED`,
`REQUIRES_NEW` and `NESTED` start a real transaction, and everything else lands
here:

```java
else {
    // Create "empty" transaction: no actual transaction, but potentially synchronization.
    if (def.getIsolationLevel() != TransactionDefinition.ISOLATION_DEFAULT && logger.isWarnEnabled()) {
        logger.warn("Custom isolation level specified but no actual transaction initiated; " +
                "isolation level will effectively be ignored: " + def);
    }
    boolean newSynchronization = (getTransactionSynchronization() == SYNCHRONIZATION_ALWAYS);
    return prepareTransactionStatus(def, null, true, newSynchronization, debugEnabled, null);
}
```

The comment in Spring's own source is the definition: **"no actual transaction,
but potentially synchronization"**. The `null` in the middle of
`prepareTransactionStatus` is the transaction object — there isn't one.

`NOT_SUPPORTED` reaches the same state from the other branch, after suspending:

```java
Object suspendedResources = suspend(transaction);
boolean newSynchronization = (getTransactionSynchronization() == SYNCHRONIZATION_ALWAYS);
return prepareTransactionStatus(
        definition, null, false, newSynchronization, debugEnabled, suspendedResources);
```

Same shape, same `null`, same synchronization decision.

## Which propagations produce one

| Propagation | With no existing transaction | Inside a transaction |
|---|---|---|
| `SUPPORTS` | **empty transaction** | joins |
| `NEVER` | **empty transaction** | throws |
| `NOT_SUPPORTED` | **empty transaction** | suspends, then **empty transaction** |
| `MANDATORY` | throws | joins |
| `REQUIRED` / `REQUIRES_NEW` / `NESTED` | starts a real one | joins / suspends / savepoint |

🔴 **Three of the seven can produce it**, and two of those three are exactly the
propagations people choose to mean "no transaction here, please".

## `newSynchronization` — the switch that decides how empty it is

Whether the empty scope does anything at all comes down to one manager setting.
The javadoc:

> *"Set when this transaction manager should activate the thread-bound transaction
> synchronization support. Default is 'always'."*

and the three constants:

> **`SYNCHRONIZATION_ALWAYS`** — *"Always activate transaction synchronization,
> even for 'empty' transactions that result from `PROPAGATION_SUPPORTS` with no
> existing backend transaction."*
>
> **`SYNCHRONIZATION_ON_ACTUAL_TRANSACTION`** — *"Activate transaction
> synchronization only for actual transactions, that is, not for empty ones that
> result from `PROPAGATION_SUPPORTS` with no existing backend transaction."*
>
> **`SYNCHRONIZATION_NEVER`** — *"Never active transaction synchronization, not
> even for actual transactions."*

**The default is "always", so by default the empty scope is a real scope.** That
single default is what turns this from a curiosity into something with an
operational cost.

## What an empty scope actually holds

Synchronization being active is what makes resources thread-bound, and the
`Propagation` javadoc spells out the consequence:

> *"As a consequence, the same resources (JDBC Connection, Hibernate Session, etc)
> will be shared for the entire specified scope."*

So inside an empty transaction:

| | Empty transaction | No annotation at all |
|---|---|---|
| backend transaction | none | none |
| atomicity | none | none |
| statements | autocommit | autocommit |
| connection | **one, bound for the whole scope** | one per operation, returned each time |
| `isActualTransactionActive()` | `false` | `false` |
| `isSynchronizationActive()` | **`true`** | `false` |

**The connection is the cost and the feature.** Several reads inside the scope
share one connection, so they at least come from one session; the price is that
the connection is checked out for the whole method rather than for each statement.

## The two checks that disagree

This is where the empty transaction stops being trivia. `isSynchronizationActive()`
is `true` in a scope that has no transaction, so using it to answer "am I in a
transaction?" produces a false positive on every `SUPPORTS`, `NEVER` and
`NOT_SUPPORTED` method in the application.
`TransactionSynchronizationManager.isActualTransactionActive()` is the question
people mean — see [chunk 5b](05b-detecting-a-dead-annotation.md) — and it is also
the question `MANDATORY` and `NEVER` are asking on your behalf.

## The trade-off

The empty transaction exists so that "run without a transaction" still has a
*scope* — a defined beginning and end during which resources and synchronization
callbacks make sense. That is genuinely useful: without it, `SUPPORTS` would have
no way to give several reads one connection, and `NOT_SUPPORTED` would have no
place to hang the suspended outer resources. **What you pay is that "no
transaction" stops meaning "no resources".** A method annotated to stay out of a
transaction still binds a connection for its whole duration by default, which is
the opposite of what someone writing `NOT_SUPPORTED` on a slow report usually
intends. Neither the annotation nor the manager will mention it.

## Gotchas

**⚠️ Reading `NEVER` or `NOT_SUPPORTED` as "this method holds no connection"**
**Symptom:** a long method annotated to stay out of transactions still occupies a
pool slot for its entire runtime.
**Cause:** the empty scope binds a connection because synchronization is active
by default.
**Fix:** if the goal is to hold nothing, the method must not be a transactional
scope at all — remove the annotation and let each operation borrow and return.

**⚠️ `isSynchronizationActive()` used as the transaction check**
**Symptom:** code takes the "inside a transaction" branch in a method that has no
transaction.
**Cause:** the empty scope activates synchronization.
**Fix:** `isActualTransactionActive()`, always
([chunk 5b](05b-detecting-a-dead-annotation.md)).

**⚠️ Setting `SYNCHRONIZATION_ON_ACTUAL_TRANSACTION` to save a connection**
**Symptom:** a targeted fix that changes behaviour in unrelated code.
**Cause:** the setting is per manager, not per method. Every `SUPPORTS` scope in
the application stops sharing a connection at the same time.
**Fix:** treat it as an application-wide decision, made deliberately, not as a
tuning knob for one endpoint.

**⚠️ Expecting `isolation` to be ignored silently here as it is elsewhere**
**Symptom:** a WARN appears for a setting that is discarded silently in the
participating case.
**Cause:** the empty-transaction branch explicitly checks the isolation level and
logs; the participating path does not
([chunk 8b](08b-whose-settings-win.md)).
**Fix:** none — it is the more helpful of the two behaviours. Just do not read
the *absence* of a warning as proof a setting took effect.

**⚠️ Assuming an empty transaction can be rolled back**
**Symptom:** `setRollbackOnly()` in a `SUPPORTS` scope with no outer transaction
appears to do nothing.
**Cause:** there is no backend transaction to mark, and the statements already
committed themselves.
**Fix:** if the work needs to be undoable, it needs a real transaction. `SUPPORTS`
on a write is the mistake, not the rollback call.

**⚠️ Treating the empty scope's shared connection as a consistency guarantee**
**Symptom:** reads that appear consistent in one environment and not another.
**Cause:** one connection is not one snapshot. Under read-committed each
statement takes its own snapshot, so sharing a connection buys session identity,
not repeatable reads — and the javadoc adds that the sharing itself "depends on
the actual synchronization configuration of the transaction manager".
**Fix:** a genuinely consistent multi-statement read needs a read-only
transaction at an isolation level that provides it
([chunk 16](16-isolation.md)).

## Interview questions

**★ What is an "empty" transaction in Spring, and when does one appear?**
It is a `TransactionStatus` with no backend transaction behind it — Spring's own
source comment is "create 'empty' transaction: no actual transaction, but
potentially synchronization". It is what `getTransaction` returns when no existing
transaction was found and the propagation does not call for starting one, which
means `SUPPORTS`, `NEVER` and `NOT_SUPPORTED`; `NOT_SUPPORTED` also lands there
from inside a transaction, after suspending it. Nothing is begun and nothing will
be committed, but a synchronization scope is opened, and by default that is a real
scope with real consequences. The object's purpose is to give "no transaction" a
defined beginning and end, so that resources and synchronization callbacks have
somewhere to live.

**★ Inside a `SUPPORTS` scope with no outer transaction, does a `NEVER` method
throw?**
No, and working out why is the clearest way to see what an empty transaction is.
`getTransaction` asks `isExistingTransaction` first; `NEVER` is only evaluated on
the other side of that question, inside `handleExistingTransaction`, where it
throws `IllegalTransactionStateException` — *"Existing transaction found for
transaction marked with propagation 'never'"*. An empty transaction is not an
existing transaction, so there is nothing to find and nothing to throw.
`MANDATORY` is the mirror image: it is checked on the no-existing-transaction path
and throws *"No existing transaction found for transaction marked with propagation
'mandatory'"*, so it **does** fire inside a `SUPPORTS` scope, synchronization or
not. Both assertions are about an actual backend transaction, which is exactly why
`isActualTransactionActive()` is the check that agrees with them.

**★ You put `isolation = SERIALIZABLE` on a `SUPPORTS` method and it has no
effect. Does Spring tell you?**
In this one case, yes — which is unusual, because the equivalent mistake on a
participating scope is silent. The empty-transaction branch checks the definition
and logs a warning: *"Custom isolation level specified but no actual transaction
initiated; isolation level will effectively be ignored"*, followed by the
definition itself. Compare that with the same annotation on a `REQUIRED` method
that joins a caller's transaction: the reference says the participating scope's
isolation, timeout and read-only flag are "silently ignored", and nothing is
logged unless `validateExistingTransaction` is switched on
([chunk 8b](08b-whose-settings-win.md)). Two ways for a setting to be discarded,
one noisy and one silent, and it is worth knowing which is which before
concluding from a quiet log that a setting took effect.

**★ Why does `isSynchronizationActive()` return `true` when there is no
transaction?**
Because it is answering a different question, and the empty transaction is
precisely the case where the two questions come apart. Synchronization is the
thread-binding machinery — the thing that keeps one JDBC `Connection` or Hibernate
`Session` associated with the current thread for a defined scope, and that
registers callbacks to run when that scope ends. A transaction needs it, but it
does not need a transaction. So a `SUPPORTS` method called with no outer
transaction has synchronization active and no transaction, and code that tests
`isSynchronizationActive()` to decide "am I transactional?" gets a false positive
on every such call. `isActualTransactionActive()` asks whether a backend
transaction was actually started, which is the question people mean.

**★ Would switching the manager to `SYNCHRONIZATION_ON_ACTUAL_TRANSACTION` be a
good way to stop empty scopes holding connections?**
It would work, and it is the wrong shape of fix for almost every reason someone
wants it. The javadoc describes the setting exactly — activate synchronization
"only for actual transactions, that is, not for empty ones that result from
`PROPAGATION_SUPPORTS` with no existing backend transaction" — so empty scopes
stop binding resources and each operation inside them borrows and returns a
connection instead. But the setting lives on the transaction manager, not on the
method, so it changes every `SUPPORTS`, `NEVER` and `NOT_SUPPORTED` scope in the
application at once, including any that were quietly relying on several reads
sharing a session. If one long method is holding a connection it should not, the
targeted fix is to stop making that method a transactional scope: remove the
annotation, and it holds nothing between statements.

**★ Is an empty transaction the same as no annotation at all?**
Not by default, and the difference is a connection. Both give you no backend
transaction, no atomicity and autocommit statements — but the empty scope has
synchronization active, and the `Propagation` javadoc's consequence of that is
that "the same resources (JDBC Connection, Hibernate Session, etc) will be shared
for the entire specified scope". So three queries in an unannotated method may
borrow and return three different pooled connections, while three queries in a
`SUPPORTS` scope share one that is held for the whole method. The two also differ
in what the API reports: `isSynchronizationActive()` is `true` in the scope and
`false` outside it, while `isActualTransactionActive()` is `false` in both. Every
other observable behaviour is identical, which is why the difference goes
unnoticed until a pool metric or a `MANDATORY` assertion makes it visible.

**★ Can you mark an empty transaction rollback-only?**
You can call `setRollbackOnly()`, and it will not undo anything, because there is
nothing to undo. No backend transaction was started, so each statement the method
ran was committed by the connection's autocommit as it executed. Whatever effect the
call has is confined to the scope's own completion bookkeeping — I could not
confirm from the reference exactly what an empty scope reports to its
synchronizations — and if the empty scope is inside an outer transaction, as it is
for `NOT_SUPPORTED`, that outer transaction is suspended and unaffected, which is
the whole point of suspension.
The practical reading is that rollback semantics simply do not exist in an empty
scope, and a design that wants them has chosen the wrong propagation: a write that
must be undoable needs `REQUIRED`, `REQUIRES_NEW` or `NESTED`, never `SUPPORTS`.

---

← Prev: [12b · SUPPORTS and NOT_SUPPORTED](12b-supports-and-not-supported.md) · Index: [Spring @Transactional](README.md) · Next → [13 · Rollback rules](13-rollback-rules.md)
