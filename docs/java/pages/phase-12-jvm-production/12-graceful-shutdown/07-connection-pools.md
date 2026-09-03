---
title: "Closing a connection pool does not wait for the query that is still running — it aborts it — and the pool is closed at bean destruction, which is after every lifecycle timeout you configured has already expired and is itself governed by no timeout at all"
sidebar_label: "07 · Connection pools"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the **HikariCP** sources on `dev` — `HikariPool.shutdown()` and its
> javadoc, and the `abortActiveConnections`/`softEvictConnections` loop
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP/blob/dev/src/main/java/com/zaxxer/hikari/pool/HikariPool.java));
> the **HikariCP** `HikariDataSource.close()` javadoc and the documented defaults for
> `connectionTimeout`, `idleTimeout`, `maxLifetime` and `keepaliveTime`
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP));
> the **JDK 25** API documentation for `java.sql.Connection.abort(Executor)`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Connection.html));
> and the **Spring Boot 4.1** reference · *Graceful Shutdown* for the phase in which the lifecycle
> timeout applies ([docs.spring.io](https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html)).
> 🔴 **No sandbox.** No pool was closed and no query was aborted. Every quoted sentence is from the
> javadoc or from source at the named path. JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Everything up to here has had a timeout attached to it. The web server drains for a configured
period, executors wait for `awaitTermination`, listener containers block for `shutdownTimeout`.
The pool is where that stops being true: it is closed during bean destruction, which happens after
the whole `SmartLifecycle` stop sequence has finished, and `spring.lifecycle.timeout-per-shutdown-phase`
does not apply to it. There is no grace period for a connection. There is an abort.**

## Where the pool closes

Boot's `DataSource` is an ordinary bean with a destroy method, so it is closed in the
**destruction** step of context close — not in the lifecycle stop step that
[05b · `SmartLifecycle` and phases](05b-smartlifecycle-and-phases.md) describes.

```
context.close()
 ├─ stop SmartLifecycle beans, DESCENDING phase   <- every timeout you configured lives here
 │    web server drain            (earliest phase)
 │    Kafka containers            Integer.MAX_VALUE - 100   (06b)
 │    executors and schedulers    Integer.MAX_VALUE / 2     (06a)
 │    ordinary Lifecycle beans    0
 └─ destroy singletons, reverse dependency order  <- the pool closes HERE, untimed
      DataSource.close(), HTTP clients, caches, files
```

**★ This ordering is the reason the pool is nearly always the right place for it and almost never
the place the problem is.** Everything that borrows a connection has already been asked to stop by
the time the pool closes. If a connection is still checked out at that point, the bug is upstream:
something ignored its own stop, or its timeout expired and it kept running anyway.

**★ Bean destruction has no configurable timeout.** People reach for
`spring.lifecycle.timeout-per-shutdown-phase` when the pool is the visible symptom. It changes the
lifecycle phases and does nothing at all to the destruction step. The lever for the pool is the
pool's own behaviour, described below, and the real lever is bounding the work that holds
connections.

## What `close()` actually does

The `HikariDataSource.close()` javadoc is one line — *"Shutdown the DataSource and its associated
pool"* — and `HikariPool.shutdown()`, which it delegates to, is the honest one:

> *"Shutdown the pool, closing all idle connections and aborting or closing active connections."*

**★ "Aborting … active connections" is the whole page in four words.** A connection that is in use
is not waited for. It is aborted.

The sequence in `shutdown()`, read from source, is worth knowing because its shape explains the
symptoms:

1. `poolState = POOL_SHUTDOWN` — no new connections are handed out.
2. `softEvictConnections()` — mark connections for eviction; idle ones go immediately, in-use ones
   are marked to be evicted when returned.
3. Stop the housekeeping task and the add-connection executor.
4. Then the loop that matters:

```java
final var start = currentTime();
do {
   abortActiveConnections(assassinExecutor);
   softEvictConnections();
} while (getTotalConnections() > 0 && elapsedMillis(start) < SECONDS.toMillis(10));
```

**★ HikariCP has its own ten-second budget, hard-coded, and it spends it aborting in a loop.** It
is not a wait for your queries to finish — `abortActiveConnections` runs on every pass. It is a
loop because aborting is asynchronous and a connection can take more than one attempt to go away.
The executor doing it is named `connection-assassinator` in the source, which tells you the intent
better than any documentation could.

**★ Ten seconds, again.** Kafka's `shutdownTimeout` is 10s, AMQP's is 5s, this loop is 10s, and
Kubernetes' `terminationGracePeriodSeconds` — the only total — is 30s. Stack them on your own
service's path before changing any of them; **08b** *(not written yet)* is where that arithmetic
is done properly.

## What an abort does to the query

`Connection.abort(Executor)` is a JDBC contract, not a Hikari invention, and the JDK 25 javadoc is
precise about the guarantee it gives — which is weaker than people assume:

> *"Terminates an open connection. Calling `abort` results in: The connection marked as closed;
> Closes any physical connection to the database; Releases resources used by the connection;
> Insures that any thread that is currently accessing the connection will either progress to
> completion **or throw an `SQLException`**."*

**★ "Either progress to completion or throw" is a disjunction, not a promise.** Your thread may get
its result. It may equally get a `SQLException` in the middle of a transaction. Nothing in the
contract lets you predict which, and nothing lets you distinguish "aborted at shutdown" from "the
database went away" at the catch site.

There is a second sentence that matters for how long shutdown takes:

> *"It is possible that the aborting and releasing of the resources that are held by the connection
> can take an extended period of time. When the `abort` method returns, the connection will have
> been marked as closed and the `Executor` that was passed as a parameter to abort may still be
> executing tasks to release resources."*

**★ `abort` returning does not mean the connection is gone.** That is precisely why HikariCP loops
rather than aborting once, and why `getTotalConnections() > 0` is the loop's condition rather than
a count of abort calls.

## The transaction, and the one piece of good news

An in-flight transaction whose connection is aborted is not committed, and the physical connection
is closed. **From the database's point of view a client that disconnects mid-transaction is rolled
back** — that is standard behaviour for every engine this corpus covers, and it is what makes the
abort survivable rather than catastrophic.

**★ The data is safe; the *caller's knowledge* is not.** The write did not happen, but the caller
saw a `SQLException` from which it cannot tell whether the commit landed. If the caller is an HTTP
request, the client gets a 500 and may retry. If the caller is a message listener
([06b](06b-message-consumers.md)), the message is redelivered. **09 · Idempotency as the backstop**
*(not written yet)* is where that ambiguity is finally addressed, and this is the second of the
three places in the topic that hands it the same problem.

**★ The dangerous case is not one statement — it is a multi-statement unit that was not in a
transaction.** Two `INSERT`s with autocommit on, aborted between them, leave the database in a
state no rollback undoes. Shutdown is not the reason that is wrong, but it is one of the reliable
ways to discover it.

## The other pools close the same way

`DataSource` is the one with published internals, but the destruction step closes every resource
bean:

- **HTTP clients** — a `RestClient`/`WebClient`'s underlying connection pool, and anything holding
  keep-alive sockets. An in-flight outbound call is a socket that closes under it.
- **Caches and clients** — Redis, Mongo, S3 and the rest, each with its own close semantics and
  its own idea of whether to wait.
- **Anything with `@PreDestroy` or a `destroyMethod`.**

**★ Destruction runs in reverse dependency order, and that is your only ordering lever here.** A
bean that depends on the `DataSource` is destroyed before it. If you need something to happen
before the pool closes, make it a bean that depends on the `DataSource` — not a `SmartLifecycle`,
which runs in an earlier step entirely.

## What to do instead of tuning the pool

The pool's shutdown is not really configurable, and that is fine, because it is not where the fix
belongs.

1. **Bound the work that holds a connection.** A query with a statement timeout and a transaction
   with a timeout both fail *before* the pool is closed, on your terms, with an error you chose.
2. **Set a JDBC network timeout.** `Connection.setNetworkTimeout` puts an upper bound on a socket
   read, so a query against a database that has stopped answering cannot outlive the grace period.
3. **Make the callers stop first, and check that they did.** The order already does this for you;
   what it cannot do is force a listener that ignores interruption to return
   ([06](06-executors-and-schedulers.md), [06b](06b-message-consumers.md)).
4. **Only then, look at the deadlines.** If everything stops correctly and you are still being
   killed, the total is too small — **08b** *(not written yet)*.

## Gotchas

**★ `spring.lifecycle.timeout-per-shutdown-phase` has no effect on the pool.** It governs the
lifecycle stop step; the pool closes in the destruction step afterwards. Raising it to "give the
database more time" changes nothing about the pool and may make the overall shutdown longer,
bringing the pod's grace period into play.

**★ HikariCP's ten-second loop is not configurable.** It is `SECONDS.toMillis(10)` in source, not a
property. Nothing in `spring.datasource.hikari.*` moves it.

**★ A connection that is in use when `softEvictConnections()` runs is not closed there.** It is
marked, and evicted when returned — which is why the abort loop exists at all. A pool with no
in-flight work closes almost instantly; one with a long query spends the full ten seconds.

**★ `abort` returning is not the connection being released.** The javadoc says the executor *"may
still be executing tasks to release resources"* after the call returns. Shutdown duration is
bounded by the loop, not by the abort calls.

**★ You cannot tell an abort-at-shutdown from a network failure at the catch site.** Both surface
as a `SQLException`. If your error handling distinguishes "retryable infrastructure error" from
"business failure", shutdown lands in the first bucket, which is usually right — and means retries
will arrive at other instances, which is why they must be idempotent.

**★ Autocommit plus a multi-statement unit of work is the case with no safety net.** A transaction
is rolled back by the disconnect; a sequence of autocommitted statements is not. Shutdown does not
create that bug, it exposes it.

**★ Destruction order is reverse dependency order, not phase order.** People try to control it with
`@Order` or a `SmartLifecycle` phase. Neither applies. `@DependsOn`, or a genuine constructor
dependency, is the lever.

**★ Every non-database client closes in the same step, with far less documentation.** The
`DataSource` is the one whose shutdown you can read. An HTTP client's or a cache client's behaviour
on close is usually undocumented, so assume abort rather than drain unless you have checked.

**★ A leaked connection makes shutdown take exactly ten seconds, every time.** If your pool
shutdown is reliably slow and reliably ten seconds, that is `getTotalConnections() > 0` never
becoming false — a connection that is never returned. `leakDetectionThreshold` finds it while the
service is running, which is a much better time to find it.

**★ Long-running background jobs are the usual culprit, not requests.** A request is bounded by the
web server's drain. A `@Scheduled` report that opens a cursor and reads for two minutes is bounded
by nothing until its scheduler is stopped, and its scheduler stops at `Integer.MAX_VALUE / 2` by
interrupting — which a JDBC read does not necessarily notice.

## Interview questions

**★ When is the connection pool closed relative to everything else in a Spring Boot shutdown?**
Last, and in a different step. The `SmartLifecycle` stop sequence runs first in descending phase
order — web server drain, listener containers, executors, ordinary lifecycle beans — and every
timeout you can configure lives in that step. The pool is an ordinary bean, so it is closed in the
singleton-destruction step that follows, in reverse dependency order, and
`spring.lifecycle.timeout-per-shutdown-phase` does not apply to it.

**★ What happens to a query that is still running when the pool closes?**
It is aborted, not waited for. `HikariPool.shutdown()`'s own javadoc says it shuts down *"closing
all idle connections and aborting or closing active connections"*, and the JDBC contract for
`Connection.abort` guarantees only that a thread currently using the connection *"will either
progress to completion or throw an `SQLException`"*. You do not get to know which.

**★ Is the data at risk?**
The data is not — an open transaction whose client disconnects is rolled back by the database, so
a half-written transaction does not survive. What is at risk is the caller's *knowledge*: it sees a
`SQLException` and cannot tell whether the commit landed. That ambiguity is the same one produced
by a timed-out retry, and it is answered by idempotency rather than by anything in the shutdown
path. The genuinely unsafe case is a multi-statement unit of work running with autocommit, which no
rollback covers.

**★ How long does closing a Hikari pool take, worst case, and can you change it?**
About ten seconds, and no. `shutdown()` loops calling `abortActiveConnections()` and
`softEvictConnections()` while `getTotalConnections() > 0 && elapsedMillis(start) < SECONDS.toMillis(10)`
— a hard-coded literal in source, with no property behind it. A pool with nothing checked out
closes almost immediately; one with a stuck connection takes the full ten every time, which makes
"shutdown always takes ten seconds" a good signature for a connection leak.

**★ Why does HikariCP loop rather than abort each connection once?**
Because `abort` is asynchronous. The javadoc says that when it returns *"the `Executor` … may still
be executing tasks to release resources"*, so the connection can still be counted after the call.
The loop's exit condition is `getTotalConnections() > 0`, i.e. observed state, not the number of
abort attempts.

**★ Shutdown is being killed by Kubernetes and the last thing in the log is a pool message. Where
do you look?**
Not at the pool. By the time it closes, every component that borrows connections has already been
asked to stop, so a connection still checked out means something upstream ignored its stop or
overran its own timeout — most often a scheduled job or a message listener, not a request. Find
what was holding the connection; the pool is reporting the problem, not causing it.

**★ You need cleanup to run before the `DataSource` closes. How?**
Make it a bean that depends on the `DataSource`, because destruction runs in reverse dependency
order — dependents first. A `SmartLifecycle` phase will not work: lifecycle stop is an earlier step
entirely, so a `SmartLifecycle` always runs before *any* destruction, which is usually far earlier
than you wanted.

**★ Which timeouts would you actually set to make this well-behaved?**
The ones on the work, not on the shutdown: a statement timeout and a transaction timeout so a query
fails on your terms while the service is running, and `Connection.setNetworkTimeout` so a socket
read against an unresponsive database cannot outlive the grace period. Those three convert "the
pool aborted something" into "a query failed with an error we chose", which is debuggable.

**★ What about the HTTP clients and cache clients — do they behave the same?**
They close in the same destruction step, and mostly with far less documentation. `HikariPool` is
unusual in that you can read exactly what it does. For an HTTP client or a Redis client, assume the
close aborts in-flight work unless you have checked its source, and bound the outbound call with a
timeout rather than relying on a drain that may not exist.

{/* FOOTER */}
