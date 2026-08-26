---
title: "A participating transaction silently ignores its own isolation, timeout and read-only flag — and there is one switch that turns that silence into an error"
sidebar_label: "8b · Whose settings win"
sidebar_position: 22
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Transaction
> propagation*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)),
> the `TransactionDefinition` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionDefinition.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionDefinition.html))
> the `AbstractPlatformTransactionManager` javadoc
> ([.../transaction/support/AbstractPlatformTransactionManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/AbstractPlatformTransactionManager.html))
> and the PostgreSQL 18 manual *SET TRANSACTION*
> ([postgresql.org/docs/18/sql-set-transaction.html](https://www.postgresql.org/docs/18/sql-set-transaction.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, PostgreSQL 18.

**[Chunk 8](08-propagation-required.md) established that several logical scopes
map onto one physical transaction. This is the bill for that: three of
`@Transactional`'s five settings belong to the *physical* transaction, so an
inner method's declarations of them are discarded. The reference's word for what
happens is "silently". There is a switch that makes it loud —
[chunk 8c](08c-making-the-mismatch-loud.md) — and this chunk is the rule it exists to
police.**

## Which method's settings win

This is the part that bites, and the reference is blunt about it:

> *"By default, a participating transaction joins the characteristics of the
> outer scope, silently ignoring the local isolation level, timeout value, or
> read-only flag (if any)."*

**"Silently ignoring."** Not overriding, not merging, not warning.

```java
@Transactional                                              // read-write, default isolation
public void checkout(Cart cart) {
    inventory.check(cart);
}

@Transactional(readOnly = true,
               isolation = Isolation.REPEATABLE_READ,
               timeout = 2)                                  // ← ALL THREE IGNORED
public void check(Cart cart) { ... }
```

`check` runs read-write, at the outer transaction's isolation, with the outer
transaction's timeout. Nothing is logged. The `TransactionDefinition` javadoc
explains why in a sentence attached to both `getIsolationLevel()` and
`getTimeout()`:

> *"Exclusively designed for use with `PROPAGATION_REQUIRED` or
> `PROPAGATION_REQUIRES_NEW` since it only applies to newly started
> transactions."*

Isolation and timeout are properties a transaction acquires **when it begins**.
`check` does not begin one, so there is nowhere for its settings to go.

⚠️ **This is not a bug and it could not sensibly be otherwise.** There is one
physical transaction and one connection; you cannot have one region of it at
`REPEATABLE_READ` and another at `READ_COMMITTED`, because isolation is a
property of the database session for the life of the transaction.

## The trade-off

The default is lenient because leniency is what makes `REQUIRED` composable. If a
participating scope rejected every setting it could not honour, a repository method
annotated `readOnly = true` — a perfectly reasonable thing to write — would break the
moment somebody called it from a read-write service. Spring chose to let the outer scope
win quietly, so that composition never fails. The price is that the annotation and the
behaviour disagree, with nothing to tell you. There is a switch that inverts that trade,
and it is [chunk 8c](08c-making-the-mismatch-loud.md).

## Gotchas

**⚠️ Setting `isolation` on an inner method**
**Symptom:** the isolation level is not what the annotation says, and nothing
reports it.
**Cause:** a participating transaction joins the outer scope's characteristics.
**Fix:** set it on the method that starts the transaction, or enable
`validateExistingTransaction` so the mismatch throws.

**⚠️ Setting `timeout` on an inner method**
**Symptom:** a timeout that never fires.
**Cause:** the same rule; `getTimeout()` carries the same javadoc sentence.
**Fix:** the outermost boundary owns the timeout. ⚠️ Note that
`validateExistingTransaction` does **not** catch this one.

**⚠️ `readOnly = true` on a repository method inside a read-write service**
**Symptom:** the read-only optimisation never applies.
**Cause:** the flag belongs to the physical transaction, which was started
read-write by the outer method.
**Fix:** annotate the outer method `readOnly = true` when the whole unit of work
is a read — [chunk 15](15-read-only.md).

**⚠️ Restating the outer settings on the inner method to "make it consistent"**
**Symptom:** the code looks right and the next refactor breaks it.
**Cause:** the inner declaration is still ignored; it merely happens to agree
today. Change the outer one and the two silently diverge again.
**Fix:** declare the settings in one place — the boundary — and nowhere else.

**⚠️ Assuming a matching declaration means the setting was applied**
**Symptom:** an inner `isolation = READ_COMMITTED` inside an outer transaction
that is also `READ_COMMITTED`, read as evidence that inner isolation works.
**Cause:** coincidence. It was ignored and the value happened to match.
**Fix:** the only method whose isolation is in force is the one where
`isNewTransaction()` is true.

**⚠️ Trying to change isolation with a raw `SET TRANSACTION` mid-method**
**Symptom:** a PostgreSQL error rather than a changed isolation level.
**Cause:** the manual is explicit that "the transaction isolation level cannot be
changed after the first query or data-modification statement … of a transaction
has been executed".
**Fix:** none at this level. Isolation is fixed when the transaction begins,
which is why Spring has nowhere to put an inner declaration.

## Interview questions

**★ You set `isolation = REPEATABLE_READ` on a service method and it is not
taking effect. Why?**
Almost certainly because the method is participating in a transaction that was
already started by a caller. The reference says a participating transaction
"joins the characteristics of the outer scope, silently ignoring the local
isolation level, timeout value, or read-only flag", and the
`TransactionDefinition` javadoc explains that isolation is "exclusively designed
for use with `PROPAGATION_REQUIRED` or `PROPAGATION_REQUIRES_NEW` since it only
applies to newly started transactions". It could not be otherwise: there is one
connection and one physical transaction, and isolation is a property of that
transaction for its whole life — you cannot switch it partway through. The fix is
to put the setting on the outermost boundary, and the way to stop it happening
silently is `validateExistingTransaction = true`.

**★ Why can two logical scopes in the same physical transaction not have
different isolation levels?**
Because isolation is a property of the database transaction, established when it
begins and fixed for its duration. There is one connection; `BEGIN` set its
isolation; there is no operation that changes it partway through, and
PostgreSQL's `SET TRANSACTION` documentation is explicit that "the transaction
isolation level cannot be changed after the first query or data-modification
statement (`SELECT`, `INSERT`, `DELETE`, `UPDATE`, `MERGE`, `FETCH`, or `COPY`) of
a transaction has been executed". Spring's logical scopes are a framework concept
layered on one physical transaction, so a per-scope isolation level would have to
be implemented by something the database does not offer. The framework ignores
the inner declaration by default and offers `validateExistingTransaction` for
people who would rather be told.

**★ A colleague restates the outer transaction's isolation on every inner method
so the code "documents itself". What do you say?**
That it documents something false and creates a trap. The inner declarations are
still ignored; they merely happen to agree with the outer one today. The moment
someone changes the boundary's isolation, every inner annotation silently
disagrees with reality, and a reader inspecting the inner method will confidently
read the wrong value. It also removes the one signal that would have been useful:
if only the boundary declares isolation, then finding the isolation level is a
matter of finding the boundary. The self-documenting version of this is a comment
on the inner method saying it participates and has no settings of its own, or —
better — an application-wide `validateExistingTransaction = true` so that any
future disagreement is a failure rather than a fiction.

**★ How do you find out which method's settings are actually in force at
runtime?**
`TransactionStatus.isNewTransaction()` is true in exactly one scope — the one
that started the physical transaction — and that is the scope whose isolation,
timeout and read-only flag were applied. From declarative code you can reach the
status via `TransactionAspectSupport.currentTransactionStatus()`. The more
convenient diagnostic is
`TransactionSynchronizationManager.getCurrentTransactionName()`, which returns
the fully qualified class and method name of the boundary: call it inside the
method you are suspicious about, and if it names some outer service method you
have your answer in one step.
`TransactionSynchronizationManager.isCurrentTransactionReadOnly()` completes the
picture for the read-only flag specifically.

**★ If a participating scope's settings are ignored, does its `rollbackFor` get ignored
too?**
No — and this is the asymmetry that makes the rule "inner settings are ignored" too
crude to rely on. Isolation, timeout and read-only are handed to the *transaction
manager* at `getTransaction`, and a participating call does not start a transaction, so
they have nowhere to go. Rollback rules are evaluated by the *interceptor*, on the way
out, for the scope that is returning — so an inner `@Transactional(rollbackFor =
BusinessException.class)` is consulted when that exception escapes the inner method, and
it takes effect. What it cannot do is roll back only its own work: there is one physical
transaction, so the interceptor marks the shared transaction rollback-only, and
`AbstractPlatformTransactionManager`'s default says what that means — with
`globalRollbackOnParticipationFailure` true, "the transaction will be globally marked as
rollback-only. The only possible outcome of such a transaction is a rollback: The
transaction originator *cannot* make the transaction commit anymore."

So the honest summary is that an inner scope has no say over *how* the transaction runs
and complete say over *whether* it may commit. That is also why catching the inner
exception in the outer method does not rescue anything — the mark is already set, and
the outer commit turns into `UnexpectedRollbackException`
([chunk 9](09-marked-rollback-only.md)).

**★ "The inner method's `timeout` is ignored" — does that mean it runs with no deadline?**
No, and this is worth getting right because "ignored" suggests the wrong picture. The
inner scope's *declaration* is discarded, but the outer transaction's timeout is very
much in force for everything the inner method does, because the deadline does not live
on the scope at all — it lives on the resource holder bound to the thread. For JDBC that
is the `ConnectionHolder`, whose base class `ResourceHolderSupport` is documented as
able to "expire after a certain number of seconds or milliseconds in order to determine
a transactional timeout", and `DataSourceUtils.applyTransactionTimeout(stmt, dataSource)`
— which `JdbcTemplate` calls for you — applies "the current transaction timeout, if any"
to each statement.

Two consequences follow that a per-scope reading would miss. The budget is **shared and
shrinking**: `getTimeToLiveInSeconds` returns the time left, not the original value, so
a method entered four seconds into a five-second transaction gets one second for all of
its work. And when the deadline has already passed, that accessor **throws**
`TransactionTimedOutException` rather than returning zero — so an inner method can fail
on its very first statement with a timeout it never declared and cannot see in its own
annotation.

---

← Prev: [8 · Propagation REQUIRED](08-propagation-required.md) · Index: [04 · Spring @Transactional](README.md) · Next → [8c · Making the mismatch loud](08c-making-the-mismatch-loud.md)
