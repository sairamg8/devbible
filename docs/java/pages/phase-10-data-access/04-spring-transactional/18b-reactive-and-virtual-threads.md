---
title: "The reactive model puts the transaction in the subscriber context instead of a ThreadLocal, and virtual threads change the economics of blocking without changing the model at all"
sidebar_label: "18b · Reactive and virtual threads"
sidebar_position: 49
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Transaction
> strategies*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/strategies.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/strategies.html))
> and *Programmatic transaction management*
> ([.../transaction/programmatic.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/programmatic.html)),
> the `TransactionContextManager` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/reactive/TransactionContextManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/reactive/TransactionContextManager.html)),
> the `TransactionSynchronizationManager` javadoc
> ([.../transaction/support/TransactionSynchronizationManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronizationManager.html))
> and JEP 491 *Synchronize Virtual Threads without Pinning*
> ([openjdk.org/jeps/491](https://openjdk.org/jeps/491)).
> JDK 25, Spring Framework 7.0.8, Spring Boot 4.1.0, HikariCP 7.0.2.

**Spring has two transaction models, not one. The imperative model binds to a
thread; the reactive model binds to the Reactor subscriber context and travels
with the pipeline instead of with the thread. They are separate abstractions and
mixing them is a category error, not a configuration problem. Virtual threads are
a third thing again — they leave the imperative model exactly as it was and change
only what it costs.**

## Two managers, two interfaces

The imperative one:

```java
public interface PlatformTransactionManager extends TransactionManager {
	TransactionStatus getTransaction(TransactionDefinition definition) throws TransactionException;
	void commit(TransactionStatus status) throws TransactionException;
	void rollback(TransactionStatus status) throws TransactionException;
}
```

The reactive one:

```java
public interface ReactiveTransactionManager extends TransactionManager {
	Mono<ReactiveTransaction> getReactiveTransaction(TransactionDefinition definition) throws TransactionException;
	Mono<Void> commit(ReactiveTransaction status) throws TransactionException;
	Mono<Void> rollback(ReactiveTransaction status) throws TransactionException;
}
```

The reference describes the second as a strategy "for reactive applications that
make use of reactive types or Kotlin Coroutines", and notes that it "is primarily
a service provider interface (SPI), although you can use it programmatically from
your application code".

Look at the return types. Every operation is a `Mono` — beginning, committing and
rolling back are themselves asynchronous steps in the pipeline, not method calls
that block until done.

## Where the reactive transaction lives

In the imperative model, `TransactionSynchronizationManager` is the "central
delegate that manages resources and transaction synchronizations **per thread**".

In the reactive model the equivalent is `TransactionContextManager`, and its
javadoc says exactly where the context goes:

> Create a `TransactionContext` and register it in the subscriber `Context`.

and how it is found again:

> Obtain the current `TransactionContext` from the subscriber context or the
> transactional context holder. Context retrieval fails with
> `NoTransactionException` if no context or context holder is registered.

The subscriber `Context` is Reactor's own `reactor.util.context.Context` — an
immutable map that flows *down the subscription* through every operator in the
chain. That is precisely why the reactive model works when the imperative one
cannot: a reactive pipeline hops threads freely between operators, so a
`ThreadLocal` would be lost at the first hop, whereas the subscriber context
travels with the subscription regardless of which thread each signal is delivered
on.

Note the same exception type appears in both worlds — `NoTransactionException` —
for the same reason: you asked for a transaction where none was registered.

## Why mixing the two does not work

A blocking JDBC call inside a reactive pipeline is not "a transaction problem
with a workaround". It is two incompatible facts:

- The reactive transaction lives in the subscriber context. A blocking JDBC DAO
  looks for a connection in a `ThreadLocal`, which the reactive machinery never
  populates. It will not find the reactive transaction, and will happily open its
  own connection outside it.
- The blocking call occupies the thread. Reactor's event-loop threads are few and
  are meant never to block; one blocked JDBC call takes an event-loop thread out
  of service for the duration.

So a `@Transactional` method returning a `Mono` while calling a JDBC repository
is doing neither model correctly. Pick one: R2DBC with a
`ReactiveTransactionManager` for the reactive stack, or blocking JDBC with a
`PlatformTransactionManager` on a thread-per-request model.

One reactive-only behaviour worth carrying away even if you never write reactive
code, because it has no imperative analogue:

> Since version 5.3 cancel signals lead to a roll back. As a result it is
> important to consider the operators used downstream from a transaction
> `Publisher`. In particular in the case of a `Flux` or other multi-value
> `Publisher`, the full output must be consumed to allow the transaction to
> complete.

A downstream `take(10)` on a transactional `Flux` cancels the subscription, and
the cancellation rolls the transaction back. Nothing failed; the consumer simply
stopped being interested.

## Virtual threads: what changes and what does not

Virtual threads are JDK threads scheduled by the JVM rather than the OS. Two
statements, both important, and they point in opposite directions.

**Nothing about the transaction model changes.** A virtual thread is a
`java.lang.Thread`, and `ThreadLocal` works on it exactly as it does on a platform
thread. `TransactionSynchronizationManager` binds to it, `@Transactional` behaves
identically, and every rule in [18](18-threads-and-async.md) still applies —
including that handing work to *another* virtual thread loses the transaction just
as thoroughly.

**The economics change completely.** The imperative model's cost has always been
that a thread blocked on a database call is a platform thread doing nothing, and
platform threads are expensive enough that you keep a small pool of them. Virtual
threads are cheap, and JEP 491 — delivered in **JDK 24**, so it is in force on the
JDK 25 baseline here — removed the last major reason they could not simply block:

> Improve the scalability of Java code that uses synchronized methods and
> statements by arranging for virtual threads that block in such constructs to
> release their underlying platform threads for use by other virtual threads. This
> will eliminate nearly all cases of virtual threads being pinned to platform
> threads.

Before that JEP, a virtual thread blocking inside a `synchronized` block was
*pinned* — it held its carrier platform thread while blocked, which defeated the
point and made older connection-pool and driver internals a hazard. That is
resolved in the JDK this bible targets.

**What is not resolved is the connection pool.** The pool is still finite, and it
is now the binding constraint rather than the thread pool. Ten thousand virtual
threads each wanting a transaction do not get ten thousand connections; they queue
on HikariCP's `connectionTimeout` and then fail. Making threads cheap makes
oversubscription of the database *easier*, not safer.

In Spring Boot, virtual threads for request handling are opt-in via
`spring.threads.virtual.enabled`.

## The trade-off

The reactive model buys non-blocking end-to-end I/O and a transaction that
survives thread hops, at the cost of a programming model where the transaction is
tied to a subscription — which means cancellation is a rollback, partial
consumption of a `Flux` is a rollback, and debugging is materially harder.

Virtual threads buy most of the scalability with none of the model change: you
keep blocking code, blocking transactions, stack traces that make sense, and the
whole imperative ecosystem. What they do not buy is a bigger database. They move
the bottleneck from threads to connections, and that bottleneck is harder to
raise.

For a service whose scaling limit is a relational database — which is most
services in this bible's scope — virtual threads plus a well-sized pool is the
better trade, and the reactive stack earns its complexity only when the I/O being
scaled is not the database.

## Gotchas

**⚠️ `@Transactional` on a method returning `Mono` with a JDBC repository inside**
**Symptom:** the transaction appears to do nothing, and the event loop stalls
under load.
**Cause:** two separate failures — the JDBC code looks for a thread-bound
connection the reactive machinery never bound, and the blocking call occupies a
scarce event-loop thread.
**Fix:** commit to one model. R2DBC with `ReactiveTransactionManager`, or blocking
JDBC with `PlatformTransactionManager`.

**⚠️ A `take()` or `timeout()` downstream of a transactional `Flux`**
**Symptom:** a transaction that rolls back although nothing failed.
**Cause:** documented since 5.3 — cancel signals lead to a rollback, and those
operators cancel.
**Fix:** consume the full output inside the transactional boundary, or move the
limiting operator upstream of it.

**⚠️ Assuming virtual threads let a transaction span threads**
**Symptom:** the same rollback-survival bugs as before, now with more threads.
**Cause:** a virtual thread is still a thread and the binding is still a
`ThreadLocal`. Cheap threads do not make the binding shared.
**Fix:** everything in 18 applies unchanged.

**⚠️ Enabling virtual threads without resizing the connection pool**
**Symptom:** a burst of `connectionTimeout` failures under load that did not
happen before.
**Cause:** the thread pool used to limit concurrency implicitly. Removing that
limit exposes the pool as the real one.
**Fix:** size the pool deliberately and expect the queue to move there. More
threads is not more database.

**⚠️ Blaming pinning for a stall on JDK 25**
**Symptom:** time spent hunting `synchronized` blocks in a driver.
**Cause:** JEP 491 landed in JDK 24 and "eliminate[s] nearly all cases of virtual
threads being pinned". On this baseline the classic pinning problem is gone.
**Fix:** look at the connection pool, at native calls, and at genuinely
CPU-bound work instead.

**⚠️ Expecting `NoTransactionException` to mean the same thing in both models**
**Symptom:** confusion when the reactive stack throws a familiar exception for an
unfamiliar reason.
**Cause:** it is thrown by `TransactionContextManager` when no context is
registered in the **subscriber context**, not when a thread has no binding.
**Fix:** read which manager threw it. The two worlds share the type and not the
mechanism.

**⚠️ Treating the reactive model as an optimisation of the imperative one**
**Symptom:** a partial migration in which some services are reactive and share a
`DataSource` with blocking ones.
**Cause:** they are different abstractions with different transaction managers,
not two speeds of the same thing.
**Fix:** the boundary between them has to be a process or at minimum a clean
service boundary, not a method that returns `Mono` and calls a JDBC DAO.

## Interview questions

**★ How does the reactive transaction model differ from the imperative one?**
Where the transaction is kept. The imperative model binds resources to the thread
— `TransactionSynchronizationManager` manages them "per thread" — which works
because a blocking call stays on one thread from start to finish. The reactive
model cannot do that, because a pipeline hops threads between operators, so
`TransactionContextManager` registers the `TransactionContext` in Reactor's
subscriber `Context` instead, and it flows down the subscription regardless of
which thread each signal arrives on. The interfaces reflect it too:
`ReactiveTransactionManager`'s begin, commit and rollback all return `Mono`,
because they are steps in the pipeline rather than blocking calls.

**★ Why can you not use JDBC inside a reactive transaction?**
Two independent reasons. The transaction lives in the subscriber context, and a
JDBC DAO resolves its connection from a `ThreadLocal` that the reactive machinery
never populates — so it would not find the transaction and would open its own
connection outside it. And the JDBC call blocks, occupying one of the few
event-loop threads for the duration, which is the specific thing the reactive
stack exists to avoid. Neither has a workaround; the fix is to choose one model.

**★ What is special about cancellation in reactive transactions?**
Since Framework 5.3, a cancel signal causes a rollback. That has no imperative
equivalent, and it means operators like `take(long)` or `timeout(Duration)`
downstream of a transactional publisher will roll the transaction back even
though nothing failed — the subscriber simply stopped consuming. The reference's
guidance is that with a `Flux` or other multi-value publisher "the full output
must be consumed to allow the transaction to complete", which is a real
constraint on how you compose pipelines around a transactional boundary.

**★ Do virtual threads change how `@Transactional` works?**
Not at all. A virtual thread is a `java.lang.Thread`, `ThreadLocal` works on it
normally, and the transaction binds to it exactly as before. Every rule about
losing the transaction across a thread hand-off still applies — handing work to
another virtual thread loses it just as completely as handing it to a platform
thread. What changes is cost: blocking a virtual thread is cheap, so the
imperative model scales much further than it used to without changing a line of
transactional code.

**★ What was pinning, and is it still a concern on JDK 25?**
Pinning was a virtual thread being unable to unmount from its carrier platform
thread while blocked inside a `synchronized` method or block, so the carrier was
held for the duration and the scalability benefit was lost. JEP 491 addressed it
in **JDK 24** — its summary says it will "eliminate nearly all cases of virtual
threads being pinned to platform threads" — so on a JDK 25 baseline it is
essentially resolved. The word "nearly" is doing some work: native frames and a
few other cases remain, and the JEP explicitly includes improved diagnostics for
identifying them.

**★ If virtual threads make blocking cheap, what limits throughput now?**
The connection pool, and behind it the database. Threads used to be the scarce
resource and the pool was sized to match; making threads abundant just moves the
queue. Ten thousand virtual threads each needing a transaction still contend for
however many connections the pool holds, and they queue on HikariCP's
`connectionTimeout` and then fail. That is why enabling virtual threads is a
capacity-planning change, not a free switch — and why the discipline of keeping
transactions short matters more, not less, once threads stop being the limit.

**★ Which model would you choose for a service backed by PostgreSQL?**
The imperative one on virtual threads, in almost every case within this bible's
scope. The scaling limit for such a service is the database, and the reactive
stack does not raise that limit — it only avoids blocking threads while waiting
for it, which virtual threads now do too and with an enormously simpler
programming model. I would reach for reactive when the I/O being scaled is not
the database: a gateway fanning out to many slow HTTP services, or a streaming
pipeline where backpressure is the actual requirement.

---

← Prev: [18 · Threads and @Async](18-threads-and-async.md) · Index: [Spring @Transactional](README.md) · Next → [19 · Transactional events](19-transactional-events.md)
