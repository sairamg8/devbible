---
title: "The status object is a handle to a scope, not to a transaction — and the one boolean on it tells you whether your settings were honoured or silently discarded"
sidebar_label: "6d · The status handle"
sidebar_position: 18
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `TransactionStatus`
> ([.../org/springframework/transaction/TransactionStatus.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionStatus.html)),
> `TransactionExecution`
> ([.../org/springframework/transaction/TransactionExecution.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionExecution.html))
> and `TransactionAspectSupport`
> ([.../transaction/interceptor/TransactionAspectSupport.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/interceptor/TransactionAspectSupport.html))
> javadocs, and the Spring Framework 7.0 reference *Understanding the Spring Framework
> transaction abstraction*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/strategies.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/strategies.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9.

**[Chunk 6](06-the-transaction-manager.md) covered what you hand the manager.
This is what it hands back. `TransactionStatus` is easy to skim past as
bookkeeping, and it is not: one of its methods answers the question that decides
whether half the attributes on your annotation did anything at all.**

## `TransactionStatus` — the handle you get back

```java
public interface TransactionStatus extends TransactionExecution, SavepointManager, Flushable {

    boolean isNewTransaction();
    boolean hasSavepoint();
    void setRollbackOnly();
    boolean isRollbackOnly();
    void flush();
    boolean isCompleted();
}
```

Each method answers a question that turns out to matter somewhere later in this
topic:

- **`isNewTransaction()`** — did *this* `getTransaction` call actually start a
  physical transaction, or did it join one? This is the single most useful
  diagnostic in the whole abstraction, and it is what distinguishes the outermost
  boundary from a participating one — [chunk 8](08-propagation-required.md).
- **`hasSavepoint()`** — is this scope carrying a savepoint, meaning it is a
  `NESTED` transaction rather than a real one?
  [Chunk 11](11-nested-and-savepoints.md).
- **`setRollbackOnly()`** — mark the transaction so that it can only ever roll
  back, without throwing. The mechanism behind
  [chunk 9](09-marked-rollback-only.md).
- **`isRollbackOnly()`** — has anybody done that? Note that this can be true
  because of something an *inner* scope did that you never saw.
- **`flush()`** — push pending changes to the underlying store, where the
  concept applies (Hibernate, JPA). A no-op for plain JDBC.
- **`isCompleted()`** — has this transaction already been committed or rolled
  back? Calling `commit` or `rollback` twice is an error, and this is how you
  would know.

⚠️ **`TransactionStatus` is a handle, not the transaction.** It is a small object
describing a scope. The actual transaction lives in the resources bound to the
thread, which is [chunk 7](07-thread-binding.md).

## Reaching the status from inside a declarative transaction

You do not normally hold a `TransactionStatus` when using `@Transactional` — the
interceptor has it. When you need it, there is a supported static accessor:

```java
TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
```

This is the documented way to force a rollback without throwing an exception, and
it is one of the two ways to get a rollback out of a method that catches its own
failures ([chunk 14](14-the-caught-exception.md)). It throws `NoTransactionException` if there is no transaction on
the current thread, which makes it self-diagnosing in a way most of this topic is
not.

## Gotchas

**⚠️ Holding a `TransactionStatus` past its transaction**
**Symptom:** an `IllegalTransactionStateException`, or operations on a completed
transaction.
**Cause:** the status describes a scope that has ended.
**Fix:** `isCompleted()` exists for exactly this check. Do not store a status in
a field.

**⚠️ Assuming `TransactionStatus.flush()` does something under plain JDBC**
**Symptom:** a `flush()` call added to force writes through, with no effect.
**Cause:** flushing is a concept of a persistence context — Hibernate or JPA. For
JDBC, statements have already been sent.
**Fix:** nothing to fix; know that the method exists for the ORM implementations.

## Interview questions

**★ What does `TransactionStatus.isNewTransaction()` tell you that nothing else
does?**
Whether this particular scope owns the physical transaction. Under the default
propagation, several annotated methods in one call chain each get a
`TransactionStatus`, but only the outermost one is backed by a real begin — the
rest are participating logical scopes mapped onto the same physical transaction.
`isNewTransaction()` is true only for the outermost. That single boolean answers
several otherwise confusing questions at once: whose commit will actually run
(the one where it is true), whose isolation and timeout settings were applied
(the same one), and why your `REQUIRES_NEW` did or did not do what you thought
(if it is false, the propagation did not take effect the way you expected).

**★ `setRollbackOnly()` and throwing an exception both cause a rollback. When
would you use the first?**
When "this failed" is a normal outcome you want to return a value about rather
than an exceptional one, or when the code that discovers the failure is not in a
position to throw — inside a callback, or in code that must complete its
remaining work. `setRollbackOnly()` marks the transaction so the eventual commit
becomes a rollback, and control continues normally. From declarative code you
reach it via `TransactionAspectSupport.currentTransactionStatus()`. The important
consequence is what happens when an *inner* scope does it and the outer scope
does not know: the outer method still calls commit, the commit rolls back
instead, and Spring throws `UnexpectedRollbackException` so the caller is never
told a commit happened when it did not.
**★ What do `hasSavepoint()` and `isCompleted()` actually tell you?**
They answer two questions that only arise once you know a status describes a *scope*
rather than a transaction. `hasSavepoint()` is true when this scope is backed by a
savepoint rather than by a physical transaction of its own — which is exactly what
`PROPAGATION_NESTED` produces, so it is the runtime way to tell a nested scope from a
`REQUIRES_NEW` one, since both look like "an inner scope that can roll back
independently" from the outside. `isCompleted()` is true once the scope has been
committed or rolled back; it exists because calling `commit` or `rollback` on a
completed status is an error, and it is the check to make if a status has escaped into
code that might run after the boundary closed. Read together with
`isNewTransaction()`, the three booleans classify a scope completely: new physical
transaction, savepoint, or plain participation.

**★ `currentTransactionStatus()` throws when there is no transaction. Is that a design
mistake?**
It is the opposite — it is the one self-diagnosing thing in this whole area, and the
javadoc is explicit that it throws `NoTransactionException` "if the transaction info
cannot be found, because the method was invoked outside an AOP invocation context".
Everything else about a missing boundary is silent: the annotation does nothing, the
statements still run, the rows still appear. Here, the failure that would otherwise be
invisible becomes an exception with a name that says what happened. The corollary is
that it is unsuitable as a probe — you cannot use it to *ask* whether a transaction
exists, because the "no" answer is thrown rather than returned. For that question,
`TransactionSynchronizationManager.isActualTransactionActive()` returns a boolean, and
the two tools are not interchangeable.

**★ Can you read `isNewTransaction()` from declarative code, and would it be useful?**
You can — `TransactionAspectSupport.currentTransactionStatus().isNewTransaction()` is
reachable from inside any proxied transactional method — and it is genuinely useful as
a *diagnostic*, because it settles in one call whether this method opened the boundary
or joined one, and therefore whether its isolation, timeout and read-only attributes
were applied or discarded. What it should not become is a branch in business logic.
A method that behaves differently depending on whether it was called first is a method
whose contract depends on its caller, which is precisely the coupling the declarative
model exists to remove — and it will be wrong the day someone adds a new entry point.
Note also the distinction the `TransactionAspectSupport` javadoc draws: the status
"exposes the locally declared transaction boundary", so on a participating call
`isNewTransaction()` is false while the *actual* resource transaction is very much
alive; for facts about that outer transaction, `TransactionSynchronizationManager` is
the right holder.

---

← Prev: [6c · What Boot picked for you](06c-what-boot-picked-for-you.md) · Index: [04 · Spring @Transactional](README.md) · Next → [7 · Thread binding](07-thread-binding.md)
