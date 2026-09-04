---
title: "Containers are safe to run concurrently because every exposed port is published to a random free host port, but the JUnit integration says in its own javadoc that parallel test execution is unsupported — and the shared database underneath a singleton is a piece of mutable global state that no port mapping protects"
sidebar_label: "05a4 · Parallel execution"
sidebar_position: 34
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Testcontainers 2.0.5 source tarball**
> ([tag `2.0.5`](https://github.com/testcontainers/testcontainers-java/tree/2.0.5)) — read directly:
> `modules/junit-jupiter/src/main/java/org/testcontainers/junit/jupiter/Testcontainers.java`
> (whose javadoc is quoted verbatim) and `TestcontainersExtension.java`,
> `core/src/main/java/org/testcontainers/containers/GenericContainer.java` and
> `core/src/main/java/org/testcontainers/lifecycle/Startables.java`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine** — nothing below is a container log, a timing or a
> test run.

**[05a3](05a3-the-cost-of-sharing.md) ended with a shared database and four isolation strategies.
Turn on parallel execution and two of those four stop working, while a third question — do
concurrent containers fight over ports? — turns out to have been answered for you years ago. This
chunk separates the three things that get conflated whenever somebody says "parallel
Testcontainers".**

## Three different questions

1. **Do concurrent containers collide on ports?** No, by design.
2. **Can the JUnit integration be used under parallel test execution?** Its javadoc says no.
3. **Can tests sharing one database run concurrently?** Only with an isolation strategy that
   tolerates concurrency.

They are independent, and the answer to the easy one is routinely used to justify the hard ones.

## Ports: safe by construction

Testcontainers publishes each exposed container port to a **random free host port** and makes you
ask the container what it got — `getMappedPort(5432)`, or `getJdbcUrl()` which embeds it. Two Gradle
workers each running their own Postgres therefore never contend for 5432, and neither does a
container competing with a Postgres you happen to have installed locally.

This is the same argument that
[04b · webEnvironment](../05-the-test-pyramid/04b-webenvironment.md) makes about
`SpringBootTest.WebEnvironment.DEFINED_PORT` and that
[14h · Ports, network and the database](../01-junit-5/14h-ports-network-and-the-database.md) makes
about binding port zero: **a fixed port is a shared global resource, and a random one is not.** The
corollary is that any code of yours that hardcodes 5432 — a fixture, a `docker-compose.yml` a test
also reads, a connection string in a properties file — has opted back out of the guarantee.

## The extension: unsupported, in its own words

```java
/**
 * ...
 * <p><strong>Note:</strong> This extension has only been tested with sequential
 * test execution. Using it with parallel test execution is unsupported and
 * may have unintended side effects.</p>
 */
public @interface Testcontainers { … }
```

> *"This extension has only been tested with sequential test execution. Using it with parallel test
> execution is unsupported and may have unintended side effects."*

That is a stronger and more specific statement than anything on the documentation site, and it is
worth knowing where at least one of those side effects lives. `GenericContainer.start()` is guarded
like this:

```java
public void start() {
    if (containerId != null) {
        return;
    }
    …
}
```

`containerId` is a plain, **non-`volatile`** field, and neither `start()` nor `stop()` is
`synchronized`. With sequential execution that is fine — one thread does everything. With two test
classes running concurrently on different threads and sharing a container object, there is no
happens-before edge between one thread's write of `containerId` and the other's read of it, so both
threads can observe `null` and both can create a container. Nothing in the extension serialises
`beforeAll` across classes.

🔴 **The singleton and container-bean forms sidestep this**, for different reasons. The singleton
starts its container inside a class initialiser, and the JVM serialises class initialisation under
its own lock — that is the guarantee [05](05-the-singleton-pattern.md) leans on. A container bean is
started by Spring as part of building one application context, which the TestContext framework does
under its own coordination. Neither path relies on `start()` being thread-safe.

## `@Testcontainers(parallel = true)` is not what you think

It gates exactly one branch in the extension:

```java
if (isParallelExecutionEnabled(context)) {
    Startables.deepStart(startables).join();      // start this class's containers concurrently
} else {
    storeAdapters.forEach(adapter -> store.getOrComputeIfAbsent(adapter.getKey(), k -> adapter.start()));
}
```

`Startables.deepStart` submits each `Startable` to a cached thread pool of daemon threads named
`testcontainers-lifecycle-N`, resolving dependencies between them, and joins. So the flag means:
**when one test class declares several containers, start them at the same time rather than one after
another.** It says nothing whatsoever about running *tests* in parallel, which is configured through
JUnit's own `junit.jupiter.execution.parallel.enabled`
([topic 01 · 12 · Parallel execution](../01-junit-5/12-parallel-execution.md)).

A test class with one container gains nothing from `parallel = true`.

## The database is the actual shared resource

Ports are private per container. The **database inside the shared container is not.** Of the four
isolation strategies in [05a3](05a3-the-cost-of-sharing.md):

| Strategy | Under parallel execution |
|---|---|
| Transactional rollback | **Works.** Each test's transaction is its own; uncommitted rows are invisible to other connections under read-committed. |
| Truncate between tests | **Breaks.** One thread's `TRUNCATE` deletes another thread's in-flight fixture, and it will block behind that thread's locks first. |
| Fresh schema per class | **Works.** Different threads touch different schemas. |
| Unique data per test | **Works**, and is the strategy most naturally suited to concurrency. |

For the tests that genuinely cannot tolerate a neighbour — one that truncates, one that asserts on a
global count, one that changes a database-level setting — JUnit's
[resource locks](../01-junit-5/12c-resource-locks.md) are the mechanism: declare a lock on a name
that stands for "the database" and the engine will not run two holders of that write-lock at once.
[12e · Shared state under parallelism](../01-junit-5/12e-shared-state-under-parallelism.md) is the
general treatment.

## Forks are not threads

Two mechanisms both get called "running the tests in parallel", and for containers they behave
oppositely:

- **Forked JVMs** — Gradle's `maxParallelForks`, Maven Surefire's `forkCount`. Each worker is its
  own JVM, so it initialises its own classes, gets its own singleton container, its own
  `DockerClientFactory.SESSION_ID` and its own Ryuk sidecar
  ([05a2](05a2-ryuk-and-cleanup.md)). Isolation is perfect and the container count is the fork
  count. Nothing shares a database — which also means nothing shares the startup cost.
- **JUnit threads** — `junit.jupiter.execution.parallel.enabled=true`. One JVM, one singleton, one
  database, many threads. Isolation is now entirely your problem.

If your suite is slow because of container startup, forks make it worse and threads make it better;
if it is slow because of the tests themselves, the reverse is often true. Decide which you have
before choosing.

## Gotchas

**★ Treating `@Testcontainers(parallel = true)` as a parallel-test switch.**
It only makes the containers declared in a single test class start concurrently, via
`Startables.deepStart(...)`. JUnit parallelism is `junit.jupiter.execution.parallel.enabled` and is
completely unrelated. A class with one container gains nothing from the flag.

**★ Running the JUnit extension under parallel test execution.**
Its own javadoc says this is unsupported and *"may have unintended side effects"*. If you need
parallel execution and containers, the singleton or container-as-a-bean forms keep the extension out
of the picture entirely.

**★ Assuming truncation is safe under parallel execution.**
One thread's `TRUNCATE` deletes another thread's in-flight fixture — and will first block behind
that thread's locks, turning a fast test into a slow one before it turns it into a failing one.
Under parallelism your options are rollback, schema-per-class, or unique data per test.

**★ Assuming `start()` is thread-safe because it looks idempotent.**
The `if (containerId != null) return;` guard reads a non-volatile field from an unsynchronised
method. It makes a *sequential* second call a no-op; it does not make a concurrent one safe.

**★ Hardcoding 5432 anywhere.**
The random port mapping is the entire reason concurrent containers are safe. A fixture, a compose
file or a properties entry that names the container's internal port re-creates the collision that
mapping exists to prevent.

**★ Expecting forked JVMs to share a container.**
They cannot: separate JVMs mean separate class initialisation, so each fork starts its own
singleton and its own Ryuk. That is usually fine, but it multiplies startup by the fork count, and
`maxParallelForks` is often turned up by someone trying to make a container-heavy suite faster.

**★ Turning on JUnit parallelism without changing the isolation strategy.**
The suite will pass locally for a while, because thread interleavings are not deterministic. The
first symptom is usually a flaky count assertion, not an obvious failure — see
[14 · Flaky tests](../01-junit-5/14-flaky-tests.md).

**★ Locking on a string that only some tests use.**
A resource lock only serialises tests that declare it. One class that truncates without declaring
the lock defeats every class that does.

## Interview questions

**★ Does a shared container break parallel test execution?**
The container does not — every exposed port is published to a random free host port, so concurrent
containers never collide. The shared *database* can, and separately the Testcontainers JUnit
extension states in its javadoc that it has only been tested with sequential execution and that
parallel execution is unsupported. Under parallelism, use the singleton or container-bean forms and
pick an isolation strategy that tolerates concurrency: rollback, schema-per-class, or unique data.

**★ What does `@Testcontainers(parallel = true)` actually do?**
It makes the containers declared in a *single* test class start concurrently, via
`Startables.deepStart(...).join()` on a pool of daemon `testcontainers-lifecycle-N` threads, instead
of sequentially. It has nothing to do with running tests in parallel, which is JUnit's
`junit.jupiter.execution.parallel.enabled`.

**★ Why is `GenericContainer.start()` not safe to call from two threads?**
Because its idempotence guard is `if (containerId != null) return;` on a non-volatile field, in a
method that is not synchronised. Sequentially that is a correct no-op; concurrently there is no
happens-before edge, so two threads can both read `null` and both create a container.

**★ Which isolation strategies survive parallel execution, and which do not?**
Transactional rollback survives — each test has its own transaction and uncommitted rows are not
visible to other connections. Schema-per-class and unique-data-per-test survive, because threads
touch disjoint data. Truncation does not: it deletes another thread's fixture mid-test, and blocks
on its locks on the way there.

**★ What is the difference between `maxParallelForks` and JUnit's parallel execution, for a Testcontainers suite?**
Forks are separate JVMs, so each gets its own class initialisation, its own singleton container, its
own session id and its own Ryuk sidecar — perfect isolation, and container startup multiplied by the
fork count. JUnit parallelism is threads inside one JVM sharing one container and one database, so
startup is paid once and isolation becomes your responsibility.

**★ How would you let most tests run in parallel while a few cannot?**
Declare a JUnit resource lock naming the shared resource — the database — as a write lock on the
tests that truncate or assert globally, and either no lock or a read lock on the rest. The engine
will refuse to run two write-lock holders concurrently while letting everything else overlap.

{/* FOOTER */}
