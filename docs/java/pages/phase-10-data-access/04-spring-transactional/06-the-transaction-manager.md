---
title: "Spring's entire transaction story is one interface with three methods, and everything else in this topic is an argument about what to pass to the first of them"
sidebar_label: "6 · The transaction manager"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Understanding the
> Spring Framework transaction abstraction*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/strategies.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/strategies.html)),
> the `TransactionDefinition` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionDefinition.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionDefinition.html))
> and the `UnexpectedRollbackException` javadoc
> ([.../org/springframework/transaction/UnexpectedRollbackException.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/UnexpectedRollbackException.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8.

**The interceptor from [chunk 2b](02b-where-the-annotation-lives.md) does not know
what a database is. It reads your annotation, turns it into a
`TransactionDefinition`, and hands that to a `PlatformTransactionManager` — a
strategy interface with three methods. This chunk is that interface and the definition you feed it;
[chunk 6d](06d-the-status-handle.md) is the handle it gives back, and
[chunk 6b](06b-which-manager-you-have.md) is which implementation you actually have
and how Spring Boot chose it. Understanding this
seam is what turns propagation and rollback rules from rules you memorise into
consequences you can derive.**

## The interface

```java
public interface PlatformTransactionManager extends TransactionManager {

    TransactionStatus getTransaction(TransactionDefinition definition)
            throws TransactionException;

    void commit(TransactionStatus status) throws TransactionException;

    void rollback(TransactionStatus status) throws TransactionException;
}
```

That is the whole thing. Three methods, and every one of them can throw.

- **`getTransaction(definition)`** — "give me a transaction matching this
  description." It may **begin** a new physical transaction, or **join** one that
  already exists, or **suspend** one and begin another, entirely according to the
  definition's propagation setting. This is why `getTransaction` is not called
  `begin`: beginning is one of the things it might do.
- **`commit(status)`** — end the transaction. ⚠️ **This may roll back instead**,
  if the transaction was marked rollback-only, and it throws
  `UnexpectedRollbackException` when it does —
  [chunk 9](09-marked-rollback-only.md).
- **`rollback(status)`** — end it the other way.

The reference calls `PlatformTransactionManager` "the key to the Spring
transaction abstraction". The word doing the work is *abstraction*: your service
code, your annotations and every propagation rule are written against this
interface, and the implementation is chosen by configuration.

⚠️ **`TransactionException` is unchecked.** It extends `NestedRuntimeException`,
which extends `RuntimeException` — so none of these three methods forces a
`try`/`catch`, and a commit failure propagates like any other runtime exception.

## `TransactionDefinition` — what your annotation becomes

`@Transactional`'s attributes are not passed around as an annotation. They are
resolved into a `TransactionDefinition`, which is the vocabulary the manager
actually understands:

| Method | Comes from | Notes |
|---|---|---|
| `getPropagationBehavior()` | `propagation` | one of the seven `PROPAGATION_*` constants |
| `getIsolationLevel()` | `isolation` | the `ISOLATION_*` constants **match `java.sql.Connection`'s** |
| `getTimeout()` | `timeout` / `timeoutString` | seconds; `TIMEOUT_DEFAULT` (-1) means the system default |
| `isReadOnly()` | `readOnly` | a **hint**, not an enforcement |
| `getName()` | the method | "fully-qualified class name + `.` + method name" |

Two of these carry a restriction the javadoc states twice, once for each, and it
is the source of a great deal of confusion later in this topic:

> *"Exclusively designed for use with `PROPAGATION_REQUIRED` or
> `PROPAGATION_REQUIRES_NEW` since it only applies to newly started
> transactions."*

That sentence is attached to **both `getTimeout()` and `getIsolationLevel()`**.
Isolation and timeout are properties of a transaction *when it starts*. A method
that joins an existing transaction is not starting one, so its isolation and
timeout have nowhere to go — they are silently ignored. Read-only carries a
similar caveat: the javadoc says the flag "just serves as a hint for the actual
transaction subsystem; it will not necessarily cause failure of write access
attempts."

🔴 **Three of the five attributes are conditional or advisory.** Only propagation
is unconditionally honoured, and `getName()` is purely informational. That is not
a defect — it falls directly out of the fact that `getTransaction` might be
joining rather than beginning.

## The trade-off

A strategy interface is what lets one annotation drive several different
transaction technologies — [chunk 6b](06b-which-manager-you-have.md) lists them —
and the price is that **the annotation cannot express anything the interface does
not carry**. Every attribute you set has to survive being turned
into a `TransactionDefinition` and being interpreted by an implementation that
may not support it — which is exactly why `readOnly` is documented as a hint, why
`NESTED` works only where savepoints exist, and why suspension "will not work
out-of-the-box on all transaction managers". The uniformity is real and the cost
is that some settings are requests rather than instructions.

## Gotchas

**⚠️ Reading `getTransaction` as "begin a transaction"**
**Symptom:** surprise that three annotated methods in a call chain produce one
commit.
**Cause:** `getTransaction` returns a status for a *scope*, which may be a new
physical transaction or participation in an existing one.
**Fix:** `status.isNewTransaction()` tells you which happened.

**⚠️ Setting `isolation` on a method that joins an existing transaction**
**Symptom:** the isolation level you asked for is not in effect and nothing says
so.
**Cause:** the javadoc is explicit that isolation is "exclusively designed for
use with `PROPAGATION_REQUIRED` or `PROPAGATION_REQUIRES_NEW` since it only
applies to newly started transactions".
**Fix:** put it on the method that starts the transaction, or set
`validateExistingTransaction` so the mismatch is rejected —
[chunk 8](08-propagation-required.md).

**⚠️ The same, for `timeout`**
**Symptom:** a timeout that never fires.
**Cause:** identical reasoning; the javadoc attaches the same sentence to
`getTimeout()`.
**Fix:** the outermost boundary owns the timeout.

**⚠️ Expecting `readOnly = true` to prevent writes**
**Symptom:** an UPDATE succeeds inside a read-only transaction.
**Cause:** the javadoc calls it a hint that "will not necessarily cause failure
of write access attempts", and says a manager that cannot interpret it "will not
throw an exception when asked for a read-only transaction".
**Fix:** treat it as an optimisation signal. Enforcement, where it exists, comes
from the database — [chunk 15](15-read-only.md).

**⚠️ Catching `TransactionException` because the signature says `throws`**
**Symptom:** a `try`/`catch` around a commit that swallows a real failure.
**Cause:** `TransactionException` is unchecked; the `throws` clause is
documentation, not an obligation.
**Fix:** let it propagate unless you have a specific recovery.

## Interview questions

**★ What is `PlatformTransactionManager` and why does Spring have it?**
It is a strategy interface with three methods — `getTransaction`, `commit` and
`rollback` — and it is the seam that makes `@Transactional` mean the same thing
regardless of what is underneath. Your service declares that a method needs a
transaction; the interceptor turns that declaration into a
`TransactionDefinition` and hands it to whichever implementation is configured.
For plain JDBC that implementation begins a transaction by calling
`setAutoCommit(false)` on a connection; for JPA it begins an `EntityTransaction`;
for JTA it enlists with a transaction manager the container provides. None of
that is visible in your code, which is the entire point. The reference calls it
"the key to the Spring transaction abstraction", and the practical consequence is
that switching from JDBC to JPA changes a bean definition, not a service.

**★ Why is the first method called `getTransaction` rather than `begin`?**
Because beginning is only one of the things it might do. Depending on the
propagation setting in the definition it is given, it may start a new physical
transaction, join an existing one and return a status representing a
participating logical scope, suspend the current transaction and start a separate
one, throw because a transaction is required and none exists, or throw because
one exists and must not. `begin` would name one branch of five. The method
returns a `TransactionStatus`, and `status.isNewTransaction()` is how the caller
finds out which branch was taken — which is also the single most useful
diagnostic in the abstraction, because "did this method start the transaction or
join one?" determines whether its isolation, timeout and read-only settings were
honoured or silently discarded.

**★ Which `@Transactional` attributes are actually guaranteed to take effect?**
Propagation, and essentially only propagation. Isolation and timeout are, in the
`TransactionDefinition` javadoc's words, "exclusively designed for use with
`PROPAGATION_REQUIRED` or `PROPAGATION_REQUIRES_NEW` since it only applies to
newly started transactions" — so on a method that joins an existing transaction
they are ignored without any error. `readOnly` is documented as a hint that "will
not necessarily cause failure of write access attempts", and a manager that
cannot interpret it is explicitly permitted not to complain. The rollback rules
do apply unconditionally, but they are evaluated by the interceptor rather than
the manager. So the honest summary is: propagation and rollback rules are
instructions; isolation and timeout are conditional; read-only is advisory.

**★ If the abstraction is so uniform, why do so many settings behave differently
across managers?**
Because uniformity of *interface* is not uniformity of *capability*. The
interface guarantees that every manager can be asked to start, commit and roll
back something; it cannot guarantee that every underlying resource supports
savepoints, or suspension, or read-only transactions, or statement timeouts.
Spring's approach is to let the definition carry the request and let each
implementation honour what it can — so `NESTED` maps to JDBC savepoints and, in
the `Propagation` javadoc's words, "out of the box, this only applies to the JDBC
`DataSourceTransactionManager`"; suspension for `REQUIRES_NEW` and `NOT_SUPPORTED`
"will not work out-of-the-box on all transaction managers"; and `readOnly` is a
hint by definition. The alternative would have been to expose only the
intersection of every technology's capabilities, which would have been a much
poorer abstraction.

**★ The signature says `throws TransactionException`. Do you have to catch it, and what
happens if you do not?**
No, and in almost every case you should not. `TransactionException` extends
`NestedRuntimeException`, which extends `RuntimeException`, so the `throws` clause on
all three methods is documentation of intent rather than a compiler obligation. Two
consequences follow and both matter. First, a commit failure propagates out of your
service method like any other runtime exception, from a frame that is no longer yours —
your method has already returned by the time `commit` runs, so the stack trace starts
inside the interceptor. Second, because it is unchecked, it is on the default rollback
list, which means a `TransactionException` escaping an *outer* boundary will roll that
outer boundary back. The temptation the `throws` clause creates — wrapping a call in
`try`/`catch (TransactionException e)` because the signature seemed to ask for it — is
how a real commit failure gets swallowed and the caller is told the work succeeded.

**★ Spring's `ISOLATION_*` constants have the same numeric values as
`java.sql.Connection`'s. Is that a coincidence?**
No, it is deliberate, and it tells you something about the design. The
`TransactionDefinition` constants are defined to match the JDBC `Connection` constants
so that the JDBC-backed manager can pass the value straight through to
`setTransactionIsolation` with no translation table, and so that anything reading the
level back — `TransactionSynchronizationManager.getCurrentTransactionIsolationLevel()`
returns it "according to the JDBC `Connection` constants" — speaks one vocabulary. The
practically useful part is the extra constant that has no JDBC counterpart:
`ISOLATION_DEFAULT`, whose value is `-1` and which means "use the underlying
datastore's default" rather than naming a level. So `@Transactional` with no `isolation`
attribute does not set `READ_COMMITTED`; it sets nothing at all and leaves whatever the
connection or the database was configured with — which is why the level you observe in
production can change when a DBA changes a server default and no code changed.

---

← Prev: [5c · Proving it and preventing it](05c-proving-it-and-preventing-it.md) · Index: [Spring @Transactional](README.md) · Next → [6b · The implementations](06b-which-manager-you-have.md)
