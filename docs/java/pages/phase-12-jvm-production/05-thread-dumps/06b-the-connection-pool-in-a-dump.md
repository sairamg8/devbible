---
title: "A thread waiting for a database connection parks in a `SynchronousQueue` inside HikariCP's bag, which gives it a stack signature you can recognise on sight — and the exception it eventually throws carries the pool's entire state in its message, which is more than most people ever read"
sidebar_label: "06b · The connection pool in a dump"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HikariCP 6.3.0 sources** — `HikariPool.getConnection`, which
> delegates to `connectionBag.borrow(timeout, MILLISECONDS)` and throws
> `SQLTransientConnectionException` from `createTimeoutException`, and `ConcurrentBag.borrow`,
> whose blocking call is `handoffQueue.poll(timeout, NANOSECONDS)` on a
> `SynchronousQueue<T>` constructed as `new SynchronousQueue<>(true)`
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP/blob/HikariCP-6.3.0/src/main/java/com/zaxxer/hikari/util/ConcurrentBag.java)),
> and the **`java.lang.Thread.State` API documentation**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.State.html)).
> 🔴 **No sandbox** — the stack shape below is assembled from the verified call chain in those
> sources and is labelled a schematic; it is not a captured dump.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Connection-pool exhaustion is the most common specific instance of the shape in
[06](06-pool-exhaustion.md), and it is worth its own page because it has a stack signature you can
learn once and recognise forever. Spring Boot's default pool is HikariCP, and a thread waiting for
a connection ends up in a very particular place: parked on a `SynchronousQueue` inside HikariCP's
own bag implementation. This page is that signature, what it proves, and the exception message
that tells you the answer without a dump at all.**

## The call chain, from the source

HikariCP 6.3.0, verified:

- `HikariPool.getConnection(long hardTimeout)` delegates to
  **`connectionBag.borrow(timeout, MILLISECONDS)`**.
- `ConcurrentBag.borrow` checks a thread-local list, then a shared list, and if neither yields a
  connection it blocks on **`handoffQueue.poll(timeout, NANOSECONDS)`**.
- `handoffQueue` is a **`SynchronousQueue<T>`**, constructed `new SynchronousQueue<>(true)` — the
  `true` making it fair, so waiters are served in arrival order.
- On timeout, `getConnection` calls `createTimeoutException`, which throws a
  **`SQLTransientConnectionException`**.

That chain is the whole page: it determines the state, the frames and the error.

## What it looks like

```text
"http-nio-8080-exec-88" ... 
   java.lang.Thread.State: TIMED_WAITING (parking)
        at jdk.internal.misc.Unsafe.park(Native Method)
        at java.base/java.util.concurrent.locks.LockSupport.parkNanos(...)
        at java.base/java.util.concurrent.SynchronousQueue$...(...)
        at java.base/java.util.concurrent.SynchronousQueue.poll(...)
        at com.zaxxer.hikari.util.ConcurrentBag.borrow(ConcurrentBag.java:...)
        at com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:...)
        at com.zaxxer.hikari.HikariDataSource.getConnection(HikariDataSource.java:...)
        ...
        at com.example.OrderRepository.findByCustomer(OrderRepository.java:88)
```

*(Schematic, assembled from the verified HikariCP call chain. Line numbers and intermediate
`SynchronousQueue` frames are omitted rather than invented.)*

🔴 **The two frames to recognise are `ConcurrentBag.borrow` and `HikariPool.getConnection`.**
Together they mean exactly one thing: **this thread is waiting for a database connection and there
are none free.** No further inference is needed.

**The state is `TIMED_WAITING`** because the poll carries the pool's connection timeout — which is
an important detail, because it means [04](04-the-thread-states.md)'s warning applies: the
presence of a timeout is not reassurance. A 30-second connection timeout means each thread is held
for up to 30 seconds, which at any real request rate exhausts the request pool long before any
thread gives up.

## Counting it

Apply the [06](06-pool-exhaustion.md) technique with two numbers instead of one:

| Count | Compare against | Means |
|---|---|---|
| Threads in `ConcurrentBag.borrow` | Nothing — any number is bad | Every one is a request waiting on a connection |
| Threads holding a connection (in a query frame) | `maximumPoolSize` | If equal, the pool is fully lent out |
| Total request threads | `server.tomcat.threads.max` | If equal, the outer pool has saturated too |

🔴 **The diagnostic pair is: connections all lent out, and requests queueing for them.** That
establishes the pool is saturated. The next question — the real one — is **who is holding the
connections and why**, which is answered by the threads *not* in `borrow`: the ones in a JDBC
execute frame.

**Their stacks are the finding.** Typically one of:

- **A slow query.** The database is doing something expensive, and the fix is in the query or the
  index, not the pool. Topic 10 of phase 10 owns that.
- **A transaction held open across a remote call.** A `@Transactional` method that calls an HTTP
  service holds its connection for the duration of the network. This is the single most common
  cause of connection-pool exhaustion in Spring applications and it is invisible in the pool's own
  metrics.
- **A connection leaked** — borrowed and never returned, usually through a path that escapes the
  framework's management. The count of lent connections rises and never falls.
- **Genuinely too much concurrency** for the pool size, which is the case where enlarging is
  right.

## The exception says it all, without a dump

When the wait times out, `createTimeoutException` throws a `SQLTransientConnectionException` whose
message is, from the source:

> `[poolName] - Connection is not available, request timed out after [elapsedMs]ms (total=[totalConnections], active=[activeConnections], idle=[idleConnections], waiting=[waitingThreads])`

🔴 **That message is a complete pool state report and it is already in your logs.** Read it as
four numbers:

- **`active` equals `total`** — every connection is lent out. Saturation confirmed.
- **`idle=0`** — the same fact from the other side.
- **`waiting=N`** — how deep the queue of requests is. A large and growing `waiting` is the
  severity indicator.
- **`total` below `maximumPoolSize`** — ⚠️ **the pool could not even create connections.** That
  is a *different* failure: the database is refusing connections, or the network to it is failing,
  or `maxLifetime` churn is outpacing creation. Do not diagnose it as exhaustion.

**Because this message exists, the connection-pool case is frequently solvable without a thread
dump at all** — grep the logs for `Connection is not available`. The dump becomes necessary when
you need to know *who holds the connections*, which the message does not say.

## The transaction-across-a-network-call trap

This deserves stating plainly because it is so common and so invisible.

```java
@Transactional
public void placeOrder(Order order) {
    orderRepository.save(order);          // connection borrowed here
    paymentClient.charge(order);          // ← HTTP call, connection still held
    order.setStatus(PAID);                // still held
}                                          // released here
```

*(Illustrative anti-pattern.)*

The connection is held for the entire duration of the HTTP call. If the payment service takes two
seconds, every order request holds a database connection for two seconds — and a pool of ten
connections supports five orders per second, regardless of how fast the database is.

**In a dump this is unmistakable:** some threads in `ConcurrentBag.borrow` waiting, and the
threads holding connections are in a *socket read to a different service*, not in a query. Two
different pools, one stack trace, and the database is entirely innocent.

⚠️ The fix is to shrink the transaction, not the pool: do the remote call outside it, or split the
work so the connection is taken after the call returns.

## Gotchas

**★ `ConcurrentBag.borrow` plus `HikariPool.getConnection` means one thing only.**
Waiting for a database connection with none free. It is the most recognisable signature in
production Java dumps and it needs no further inference.

**★ The state is `TIMED_WAITING`, and that is not reassurance.**
The poll carries the connection timeout. A 30-second timeout means threads are held for up to 30
seconds each, which saturates the request pool long before any of them gives up.

**★ The threads to read are the ones *not* waiting.**
Waiters are the symptom. The threads holding connections — in a query frame, or in a socket read
to another service — are where the cause is.

**★ `total` below `maximumPoolSize` in the timeout message is a different failure.**
It means the pool could not create connections at all: the database is refusing them, the network
is failing, or lifetime churn is outpacing creation. Diagnosing that as exhaustion sends you to
the wrong system.

**★ The exception message is a full pool state report, and it is already in your logs.**
`total`, `active`, `idle` and `waiting` in one line. Grepping for `Connection is not available` is
often faster than taking a dump, and it works retrospectively for an incident that has ended.

**★ A `@Transactional` method that makes a remote call holds a connection for the network's
duration.**
This is the most common cause of connection-pool exhaustion in Spring applications, and neither
the database nor the pool is at fault. In a dump, the connection holders are in a socket read to
another service rather than in a query.

**★ Connection-pool exhaustion cascades into request-pool exhaustion.**
Both pools show saturated in the same dump. The connection pool is the inner one and therefore the
more informative; reading the outer one first sends you toward the wrong fix.

**★ Enlarging the pool is rarely the answer and can make things worse.**
More connections means more concurrent load on the database, which can slow every query and
lengthen hold times — turning a queueing problem into a database problem. Connection pools are
usually smaller than people expect for good reason.

**★ A leak looks like exhaustion that never recovers.**
With a leak, `active` rises monotonically and never falls even at low load. Exhaustion from slow
queries tracks load; a leak does not, which is how the two are distinguished without a dump.

**★ Waiters are served fairly, so the queue is orderly and still fatal.**
`new SynchronousQueue<>(true)` makes the handoff fair. That prevents starvation of individual
threads and does nothing about the pool being empty — fairness is about order, not capacity.

## Interview questions

**★ How do you recognise connection-pool exhaustion in a thread dump?**
By the frames `com.zaxxer.hikari.util.ConcurrentBag.borrow` and
`com.zaxxer.hikari.pool.HikariPool.getConnection`, with the thread `TIMED_WAITING` parked in a
`SynchronousQueue.poll`. That chain means the thread asked for a connection and none was free. The
count of such threads tells you how deep the queue is; the threads *not* in that state, holding
connections, tell you why.

**★ You see it. What do you look at next?**
The threads holding connections. Waiters are the symptom; the holders' stacks are the cause —
typically a slow query, a connection borrowed and never returned, or a transaction held open
across a remote call. Which of those it is determines whether you fix an index, a leak, or a
transaction boundary, and none of those is "make the pool bigger".

**★ What does HikariCP's timeout exception message tell you?**
Everything about the pool's state at that moment:
`Connection is not available, request timed out after Nms (total=…, active=…, idle=…,
waiting=…)`. `active` equal to `total` with `idle=0` confirms saturation; `waiting` gives the
queue depth and therefore the severity. Crucially, if `total` is *below* the configured maximum,
the pool could not create connections at all — a different failure pointing at the database or the
network rather than at hold times.

**★ Why is a `@Transactional` method that calls an HTTP service a problem?**
Because the database connection is borrowed when the transaction begins and released when it
commits, so it is held for the entire duration of the HTTP call. A two-second remote call means a
two-second connection hold, and a pool of ten supports five requests per second no matter how fast
the database is. In a dump it is obvious — the connection holders are in a socket read to another
service — and the fix is to move the remote call outside the transaction.

**★ Would you increase `maximumPoolSize` to fix exhaustion?**
Rarely, and cautiously. More connections means more concurrent work on the database, which can
slow every query and lengthen hold times, converting a queueing problem into a database
performance problem. Little's Law says the pool size needed is arrival rate times hold time, so if
hold time has grown the correct target is the hold time. Enlarging is right only when the
calculation shows the pool was genuinely undersized for the load.

**★ How do you distinguish a connection leak from ordinary exhaustion?**
By whether it tracks load. Exhaustion caused by slow queries rises with traffic and recovers when
traffic falls. A leak rises monotonically and never recovers — `active` stays at the maximum even
during quiet periods, because those connections were never returned. HikariCP's leak detection
threshold will also log the borrowing stack, which names the code path directly.

**★ Both your connection pool and your request pool show exhausted in the same dump. Where do you
start?**
With the inner one. The connection pool saturated first and caused the request threads to queue
behind it, so the request pool's exhaustion is a consequence. Reading the outer pool first leads
toward resizing the thing that is not broken. Follow the frames inward until you reach the pool
whose holders are waiting on something outside the JVM — that is where the investigation
continues.

{/* FOOTER */}
