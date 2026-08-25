---
title: "Almost every deadlock floor is fixed by making one thread hold one connection, not by buying a bigger pool"
sidebar_label: "3b · Reducing Cm"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the HikariCP wiki page *About Pool Sizing*
> ([github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing))
> and the Spring Boot reference *SQL Databases*
> ([docs.spring.io/spring-boot](https://docs.spring.io/spring-boot/reference/data/sql.html)).
> JDK 25, HikariCP 7.0.2, Spring Boot 4.1.0, Spring Framework 7.0.8.

**[Chunk 3](03-the-connection-budget.md) showed that the floor is
`Tn x (Cm - 1) + 1`, and that the coefficient is `Cm - 1`. That is the whole
strategy in one line: **drive `Cm` to 1 and the floor collapses to 1, whatever
`Tn` is**. Every other lever — a bigger pool, a longer timeout, more replicas —
is working on the wrong term of the equation.**

## Three ways to get Cm to 1

### 1 · Pass the connection down

The method that borrowed the connection owns it, and everything it calls takes
it as a parameter. This is [topic 01 chunk 18's](../01-jdbc/18-ownership-and-leaks.md)
ownership rule applied to sizing:

```java
try (var c = dataSource.getConnection()) {
    c.setAutoCommit(false);
    long orderId = insertOrder(c, customerId);
    auditLog.record(c, "order.created", orderId);   // same connection
    c.commit();
}
```

It is not elegant — the `Connection` argument spreads through signatures — but it
is unambiguous, and unambiguous is what you want in the code path that can wedge
the service.

### 2 · Under Spring, let the transaction manager do it

Inside a `@Transactional` boundary Spring binds one connection to the thread and
every `JdbcTemplate`, repository or JPA call on that thread joins it. `Cm` stays
at 1 as long as nothing *suspends* the transaction. That is exactly what
`Propagation.REQUIRED` — the default — buys you, and it is the reason
`REQUIRES_NEW` deserves a comment explaining why every time it appears:

```java
@Transactional                       // REQUIRED: one connection, bound to the thread
public void placeOrder(long customerId, List<Item> items) {
    long orderId = orderRepo.insert(customerId, items);
    auditRepo.record("order.created", orderId);   // joins the same connection
}
```

⚠️ **This only holds for calls that go through the transaction manager.** A raw
`dataSource.getConnection()` inside a `@Transactional` method does **not** join
the bound transaction — it takes a second connection from the pool, and it will
not see the outer transaction's uncommitted rows either. Spring's
`DataSourceUtils.getConnection(dataSource)` is the call that joins.

### 3 · Make the independent work genuinely later

Sometimes the second unit of work really must survive the outer rollback — an
audit record, a "we tried" marker, a dead-letter row. `REQUIRES_NEW` is the
obvious tool and it costs you a connection. The cheaper shape is to write it on
the *same* connection into an outbox table and let a separate process drain it:

```java
@Transactional
public void placeOrder(...) {
    long orderId = orderRepo.insert(customerId, items);
    outboxRepo.enqueue(c, "order.created", orderId);   // same transaction
}
```

You trade "the audit row survives a rollback" for "the audit row is written if
and only if the order was", which is usually the behaviour people actually
wanted. Where it is not, take the `REQUIRES_NEW` and size for the floor
deliberately.

## Where Tn actually comes from

`Tn` is not "how many users". It is the width of the widest thing that can run
the nesting code path concurrently, and most services have more than one such
thing:

| Source of threads | Typical width |
|---|---|
| the web container's request threads | `server.tomcat.threads.max`, default 200 |
| `@Async` executors | `spring.task.execution.pool.max-size` |
| `@Scheduled` jobs | `spring.task.scheduling.pool.size`, default 1 |
| Kafka / RabbitMQ listener concurrency | per-container `concurrency` setting |
| `parallelStream()` inside a request | the common ForkJoinPool, `cores - 1` |

Add up every one of those that can reach a code path where `Cm > 1`. If you
cannot say what `Tn` is, you cannot say what the floor is — and a floor you
cannot compute is a floor you are probably under.

## Virtual threads break the formula outright

🔴 **This is the modern version of the trap.** With
`spring.threads.virtual.enabled=true` there is no bounded request-thread pool at
all. `Tn` becomes "however many requests arrive at once", which is not a number
you control. A formula linear in `Tn` then has **no finite answer**: if `Cm > 1`,
there is no `maximumPoolSize` that makes deadlock impossible.

There are exactly two responses:

- **Get `Cm` to 1** by one of the three routes above. This is the real fix, and
  it makes the question disappear rather than bounding it.
- **Bound admission explicitly** — a `Semaphore`, a bulkhead, or a bounded
  executor in front of the nesting path — so that a finite `Tn` exists again.

⚠️ Note the direction of the risk. Virtual threads do not *create* the bug; they
remove the accidental protection that a bounded thread pool was providing. A
`Cm = 2` path that was safe on a 20-thread container because the pool happened to
be 50 becomes unsafe the day someone flips one boolean in `application.yaml`.

## The JTA footnote

The wiki adds one exception, and it is worth knowing it exists so you can decline
it knowingly:

> *You may be able to reduce the number of simultaneous connections required by a
> thread by using a JTA (Java Transaction Association) transaction manager.*

Under JTA, several pieces of work enlisted in the same global transaction against
the same resource can be served by one physical connection, which is a genuine
reduction in `Cm`. But it brings two-phase commit, a transaction log and a
recovery story with it. Reach for it when you actually have multiple resources in
one atomic unit; do not reach for it to avoid passing a `Connection` argument.

## The trade-off

Passing connections down and staying inside one transaction boundary makes the
code less modular: a service method that could stand alone now needs a
transaction to have been started for it, and its signature says so. You are
buying operational safety with a small amount of coupling. That is a good trade
in the request path and a poor one in a batch job that legitimately wants
independent units of work — which is why batch jobs are usually the place where
`REQUIRES_NEW` is correct and the floor should simply be paid for.

## Gotchas

**⚠️ `REQUIRES_NEW` added for a good reason, with no pool change**
**Symptom:** an audit or notification write is made independent so it survives a
rollback, and the service starts locking up at peak.
**Cause:** `Cm` went from 1 to 2, so the floor went from 1 to `Tn + 1`.
**Fix:** outbox table on the same connection, or accept the new floor and resize
deliberately.

**⚠️ `dataSource.getConnection()` inside a `@Transactional` method**
**Symptom:** the method cannot see rows it just inserted, *and* the pool is under
more pressure than the thread count suggests.
**Cause:** the raw call bypasses the thread-bound connection entirely — a second
connection, in a second transaction, with its own snapshot.
**Fix:** `DataSourceUtils.getConnection(dataSource)`, or inject a
`JdbcTemplate`/`JdbcClient`, both of which join the bound transaction.

**⚠️ A borrow inside a `ResultSet` loop**
**Symptom:** a report or migration job wedges, and only that job.
**Cause:** the outer connection is held for the whole stream
([topic 01 chunk 15](../01-jdbc/15-fetch-size-and-streaming.md)) while each row
borrows a second connection to enrich itself.
**Fix:** collect the keys first, close the outer connection, then process the
keys. `Cm` returns to 1 and the streaming connection stops being held for
minutes.

**⚠️ Counting `Cm` per method instead of per call stack**
**Symptom:** the floor is calculated as 1 and the service still deadlocks.
**Cause:** each method borrows exactly one connection, but three of them are on
the stack at once.
**Fix:** `Cm` is the maximum held **simultaneously by one thread**, which means
reading the whole call chain, framework code included.

**⚠️ Counting only the web container's threads**
**Symptom:** the floor was computed for 50 request threads and the pool still
empties at 3 a.m.
**Cause:** a `@Scheduled` job with its own executor also reaches the nesting
path.
**Fix:** `Tn` is the sum over every executor that can get there.

**⚠️ Handing a `Connection` to an executor**
**Symptom:** intermittent "connection is closed" errors, or two threads
interleaving on one connection.
**Cause:** `CompletableFuture.supplyAsync(() -> repo.load(c))` moves the
connection to another thread while the borrower still holds it. `java.sql.Connection`
is not thread-safe, and Spring's transaction binding is thread-local, so the
async thread is outside the transaction as well.
**Fix:** finish the connection's work before going async, or let the async task
borrow its own connection *after* the first is returned.

**⚠️ Enabling virtual threads as a performance change**
**Symptom:** a configuration-only change causes intermittent total lock-ups under
load.
**Cause:** `Tn` became unbounded and an existing `Cm = 2` path stopped being
accidentally safe.
**Fix:** audit for nested borrows *before* flipping the flag, not after.

## Interview questions

**★ You find a `Cm = 2` path. What do you do first?**
Remove the nesting, not resize the pool. In descending order of preference: pass
the connection into the inner call so both pieces of work share it; rely on
Spring's `REQUIRED` propagation so the inner repository joins the thread-bound
connection; or restructure so the independent work happens after the first
connection is returned, typically through an outbox row written in the same
transaction. Resizing to `Tn + 1` is the fallback when the second connection is
genuinely required — an independent transaction that must survive the outer
rollback — and then it is a deliberate cost, not an accident.

**★ Why does `dataSource.getConnection()` inside `@Transactional` not join the transaction?**
Because the transaction manager binds the connection to the thread in a
`ThreadLocal` held by `TransactionSynchronizationManager`, and only code that
asks *through* that mechanism finds it. `DataSourceUtils.getConnection()`,
`JdbcTemplate`, `JdbcClient` and the JPA `EntityManager` all do; a direct call on
the `DataSource` does not — it goes straight to the pool. The result is a second
connection with its own transaction and its own snapshot, so it cannot see the
outer transaction's uncommitted writes, and it doubles the pool pressure of that
code path.

**★ How do you work out Tn for a real service?**
Enumerate every thread pool that can execute the code path and add their maximum
widths: the servlet container's worker threads, each `@Async` executor, the
scheduler pool, each message-listener container's concurrency, and the common
ForkJoinPool if a parallel stream is involved. It is deliberately the *maximum*
rather than the observed concurrency, because the floor has to hold on the worst
day. If the answer is "we cannot tell", that itself is the finding — an
uncomputable floor is a floor nobody is respecting.

**★ Why are virtual threads a problem here specifically?**
Because the floor formula is linear in `Tn`, and virtual threads deliberately
remove the bound on `Tn`. If any code path holds two connections at once, there
is no pool size that guarantees safety — you cannot outrun an unbounded thread
count with a bounded pool. It also converts a class of latent bug into an active
one: a `Cm = 2` path that never deadlocked because the container only ran 20
threads against a pool of 50 will deadlock once thousands of virtual threads can
reach it. So the pre-condition for turning virtual threads on is an audit for
nested borrows, plus explicit admission control anywhere one survives.

**★ Is a JTA transaction manager a reasonable answer?**
Rarely, but it is a real one and HikariCP's wiki mentions it. JTA lets several
enlistments in one global transaction against the same resource share a physical
connection, which reduces `Cm` directly. The cost is two-phase commit, a
recovery log and a great deal of operational surface. It is the right answer when
you genuinely have two resources — a database and a message broker, say — that
must commit atomically, and the wrong answer when the real problem is that
`auditLog.record()` does not take a `Connection` parameter.

**★ Can you have Cm greater than 1 safely on purpose?**
Yes, when `Tn` is small and known. A batch job running on a fixed executor of
four threads, where each task holds two connections, has a floor of
`4 x (2 - 1) + 1 = 5` — trivially satisfied by a pool of 10, and the job can keep
its independent transactions. The dangerous combination is not `Cm > 1` by
itself, it is `Cm > 1` on a path reachable from a wide or unbounded thread pool.
Recognising that distinction is what lets you say yes to `REQUIRES_NEW` in the
places it belongs.

---

← Prev: [3 · The deadlock floor](03-the-connection-budget.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [3c · The server-side ceiling](03c-the-server-side-ceiling.md)
