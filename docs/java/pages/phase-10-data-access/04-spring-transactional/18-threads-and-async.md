---
title: "The transaction is bound to a ThreadLocal, so the moment work moves to another thread it leaves the transaction behind and gets a different connection"
sidebar_label: "18 · Threads and @Async"
sidebar_position: 49
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `TransactionSynchronizationManager` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronizationManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronizationManager.html)),
> the `DataSourceTransactionManager` javadoc
> ([.../jdbc/datasource/DataSourceTransactionManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/DataSourceTransactionManager.html)),
> the Spring Framework 7.0 reference *Declarative transaction management*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative.html)),
> *Task Execution and Scheduling → The `@Async` annotation*
> ([.../integration/scheduling.html](https://docs.spring.io/spring-framework/reference/integration/scheduling.html))
> and the JDBC *Controlling Database Connections* reference
> ([.../data-access/jdbc/connections.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/connections.html)).
> JDK 25, Spring Framework 7.0.8, Spring Boot 4.1.0.

**A Spring transaction is a JDBC `Connection` (or an `EntityManager`) stored in a
`ThreadLocal`. Every piece of machinery that finds "the current transaction"
finds it by asking the current thread. Move the work to another thread and the
lookup returns nothing — and the code that needed a connection quietly opens a
new one, outside your transaction, which will not be rolled back with it.**

## The binding, stated plainly

The reference introduces declarative transaction management with a constraint
most people read past:

> declarative transaction management works at method granularity around a thread
> of execution.

`TransactionSynchronizationManager`'s javadoc says what does the storing:

> Central delegate that manages resources and transaction synchronizations per
> thread. To be used by resource management code but not by typical application
> code.

and `DataSourceTransactionManager` says what is stored:

> Binds a JDBC `Connection` from the specified `DataSource` to the current
> thread, potentially allowing for one thread-bound `Connection` per
> `DataSource`.

That is the whole mechanism. `JdbcTemplate`, Spring Data repositories and the
JPA `EntityManager` proxy all resolve "which connection am I using?" by asking
`TransactionSynchronizationManager` for the resource bound to *this* thread. On a
thread with no binding, `DataSourceUtils.getConnection` behaves exactly like a
plain `DataSource.getConnection()` — a fresh connection, autocommit on, no
transaction.

**Nothing throws.** That is the part that makes this a bug class rather than an
error message.

## Four ways to lose it without noticing

Every one of these is a thread hand-off:

```java
@Transactional
public void placeOrder(NewOrder cmd) {
    orderRepository.save(order);

    new Thread(() -> auditRepository.save(entry)).start();          // 1
    executor.submit(() -> auditRepository.save(entry));             // 2
    cmd.items().parallelStream().forEach(inventory::reserve);       // 3
    CompletableFuture.supplyAsync(this::loadRates)                  // 4
                     .thenAccept(pricingRepository::save);
}
```

1. **A raw thread.** No binding is copied. The `save` runs on its own connection
   with autocommit on and commits immediately, even if `placeOrder` later rolls
   back.
2. **An executor.** Same thing, with the extra hazard that the pool thread may be
   reused by another request and hold onto something.
3. **A parallel stream.** The common ForkJoinPool. Some elements may be processed
   on the calling thread and therefore *inside* the transaction, and others on
   pool threads *outside* it. A partial, non-deterministic split of one loop
   across two transactional contexts is about as bad as it gets.
4. **A `CompletableFuture` continuation.** `supplyAsync` runs on the common pool,
   and `thenAccept` runs wherever the completion happens — which may be a pool
   thread or the calling thread depending on timing.

In all four cases the writes are real, they are committed independently, and they
survive a rollback of the outer transaction. The database ends up holding exactly
the records the failed operation was supposed to undo.

## `@Async` and `@Transactional` together

```java
@Async
@Transactional
public void reindex(long id) { ... }
```

This is legal and it works — but not in the way the call site suggests. `@Async`
hands the invocation to an executor, and `@Transactional` then starts **a new
transaction on the async thread**. It does not join the caller's, because the
caller's transaction is bound to a thread this code is not running on.

Consequences worth being explicit about:

- The async work is **not atomic with the caller's**. The caller can roll back;
  the async transaction has already committed, or will.
- The async work may read data the caller has written but not committed — and
  will not see it, because it is a separate transaction at whatever isolation
  level applies. An `@Async` method that loads the entity the caller just saved
  is a race, and it usually loses.
- Both transactions hold a connection at the same time, so the pool must be able
  to supply both.

If the intent was "do this after the caller commits", `@Async` is the wrong tool
and `@TransactionalEventListener` with `AFTER_COMMIT` is the right one — see
[19 · Transactional events](19-transactional-events.md).

Two smaller `@Async` facts from the reference that matter here. A `void`-returning
`@Async` method swallows its exception: "With a `void` return type, however, the
exception is uncaught and cannot be transmitted… By default, the exception is
merely logged", unless you supply an `AsyncUncaughtExceptionHandler`. So an async
transaction that rolls back does so entirely silently unless you arranged
otherwise. And "You can not use `@Async` in conjunction with lifecycle callbacks
such as `@PostConstruct`" — the same proxy-initialisation constraint that governs
`@Transactional`.

## When it is genuinely what you want

Losing the transaction across a thread boundary is not always a bug. It is
exactly right when the background work is an independent unit that should succeed
or fail on its own — sending a notification, rebuilding a search index,
recalculating a cached aggregate. What makes it a bug is doing it accidentally,
inside a method that was supposed to be atomic.

The test is simple: **if the caller rolling back should undo this work, it cannot
be on another thread.** No configuration changes that.

## The trade-off

Thread-bound transactions are why `@Transactional` can be a single annotation
with no plumbing. Nothing has to be passed around; any code on the thread can
find the transaction. That simplicity is the reason the programming model works
at all.

The price is that the boundary of a transaction is invisible in the type system.
A method signature does not say whether it must run on the transaction's thread,
so nothing stops a colleague wrapping a call in `executor.submit()` for latency
and silently removing it from the transaction. There is no compiler error, no
warning, and the tests usually still pass because they do not assert on rollback
behaviour under concurrency.

## Gotchas

**⚠️ `new Thread(...)` or `executor.submit(...)` inside a transactional method**
**Symptom:** rows that survive a rollback.
**Cause:** the new thread has no transaction bound to it, so repository calls get
a fresh autocommit connection and commit immediately.
**Fix:** do the work on the calling thread, or accept that it is a separate unit
and move it after the commit.

**⚠️ A parallel stream inside a transactional method**
**Symptom:** intermittent, partial persistence with no pattern to it.
**Cause:** the common ForkJoinPool may run some elements on the caller's thread
(inside the transaction) and others on pool threads (outside it). Which is which
depends on scheduling.
**Fix:** never use a parallel stream for database work inside a transaction. If
the work is CPU-bound and touches no repository, it is fine — but check.

**⚠️ `@Async` on a method the caller expects to be atomic with itself**
**Symptom:** the caller rolls back and the async work is still there.
**Cause:** they are two transactions on two threads. Nothing links them.
**Fix:** `@TransactionalEventListener(phase = AFTER_COMMIT)` if the work should
happen only on success, or do it inline if it must be atomic.

**⚠️ `@Async` reading data the caller just wrote**
**Symptom:** an async job that intermittently cannot find the entity that
triggered it.
**Cause:** the caller's transaction has not committed when the async thread
queries, so the row is not visible to it.
**Fix:** trigger the async work after commit, not during. Passing the id and
letting the async side load it is correct *only* if it runs after the commit.

**⚠️ An `@Async` transaction failing silently**
**Symptom:** work that is simply missing, with nothing in the logs beyond a
default warning.
**Cause:** a `void`-returning `@Async` method's exception "is uncaught and cannot
be transmitted"; by default it is merely logged.
**Fix:** return a `CompletableFuture` so failures are observable, or register an
`AsyncUncaughtExceptionHandler`.

**⚠️ Assuming `@Async` and `@Transactional` on the same method compose in a
defined order**
**Symptom:** uncertainty about whether the transaction wraps the async hand-off
or the other way round.
**Cause:** both are proxy-based advice with configurable order, and the async
advice's job is to move the invocation to another thread.
**Fix:** do not put the two on one method if the ordering matters to your design.
Make the async method a thin dispatcher that calls a transactional method on
another bean; then the arrangement is explicit.

**⚠️ A thread-pool thread retaining a binding**
**Symptom:** a later, unrelated task on the same pool thread behaving as though a
transaction exists.
**Cause:** code that bound a resource manually via
`TransactionSynchronizationManager` and did not unbind it. Spring's own managers
always unbind in a `finally`.
**Fix:** the javadoc's own advice — that class is "to be used by resource
management code but not by typical application code". If application code is
calling `bindResource`, that is the bug.

**⚠️ Expecting `@Async` to inherit anything at all**
**Symptom:** surprise that security context, request scope or MDC logging context
are missing as well.
**Cause:** they are all `ThreadLocal`-based, for the same reason and with the same
consequence. Transactions are one instance of a general rule.
**Fix:** propagate deliberately what you need — Spring Security has a delegating
executor for exactly this — and be aware that no such mechanism exists for
transactions, because a JDBC connection cannot be used by two threads at once.

## Interview questions

**★ Why does a transaction not cross a thread boundary?**
Because it is stored in a `ThreadLocal`. `DataSourceTransactionManager` "binds a
JDBC `Connection` from the specified `DataSource` to the current thread", and
`TransactionSynchronizationManager` is the "central delegate that manages
resources and transaction synchronizations per thread". Everything that resolves
"the current transaction" — `JdbcTemplate`, repositories, the `EntityManager`
proxy — does so by asking the current thread. A different thread has no binding,
so the lookup finds nothing and the caller gets a fresh autocommit connection
instead. Nothing throws, which is what makes it dangerous.

**★ What happens if you `executor.submit()` a repository save from inside a
transactional method?**
The save runs on a pool thread with no transaction bound, so it obtains its own
connection with autocommit on and commits immediately and independently. If the
outer transaction later rolls back, that row stays. You have created exactly the
inconsistency the transaction existed to prevent, and there is no error anywhere
to indicate it.

**★ Why is a parallel stream especially bad here?**
Because the split is non-deterministic. `parallelStream()` uses the common
ForkJoinPool, and the calling thread participates in the work as well — so some
elements are processed inside the transaction and some outside it, and which is
which depends on scheduling and workload. That produces a failure that is
different on every run, cannot be reproduced reliably, and looks like data
corruption rather than like a threading bug.

**★ Does `@Transactional` on an `@Async` method join the caller's transaction?**
No. `@Async` moves the invocation to an executor thread; the caller's transaction
is bound to the caller's thread, so on the async thread there is nothing to join
and `@Transactional` starts a fresh transaction. The two are entirely independent
— the caller can roll back after the async work has committed, the async work
cannot see the caller's uncommitted writes, and both hold a pooled connection at
the same time. If the requirement is "run this once the caller has committed",
the correct mechanism is a transactional event listener in the `AFTER_COMMIT`
phase.

**★ Is losing the transaction across threads ever the right behaviour?**
Yes, whenever the background work is genuinely an independent unit — a
notification, an index rebuild, a cache warm. The problem is never the mechanism;
it is doing it by accident inside a method that was meant to be atomic. The test
I apply is: if the caller rolling back should undo this work, it cannot be on
another thread, because no configuration will make it so.

**★ What else is lost at the same boundary?**
Everything else that is `ThreadLocal`-based: the security context, request-scoped
beans, MDC logging context, locale context. Frameworks provide propagation
helpers for most of those — a delegating executor that copies the context to the
worker thread. There is deliberately no such helper for transactions, and the
reason is fundamental rather than an omission: a JDBC connection is not safe for
concurrent use, so "propagating" a transaction to a second thread would mean two
threads issuing statements on one connection.

**★ How would you catch this class of bug in review?**
By looking for thread hand-offs inside transactional methods — `new Thread`,
`submit`, `supplyAsync`, `parallelStream`, and any injected `Executor` — and
asking of each one whether the work it starts should be undone if the caller
fails. A test can catch it too, but only a specific kind: force a rollback after
the hand-off and assert the database is clean. A test that only asserts the happy
path will pass regardless, which is why these survive to production.

---

← Prev: [17b · What actually bounds it](17b-what-actually-bounds-it.md) · Index: [04 · Spring @Transactional](README.md) · Next → [18b · Reactive and virtual threads](18b-reactive-and-virtual-threads.md)
