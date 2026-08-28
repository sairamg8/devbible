---
title: "A thread you forgot to shut down does not fail your test — it goes on writing rows, calling mocks and holding connections for the rest of the suite, so the test that turns red is never the test that caused it, and the only cure is to assert termination in the test that owns the pool"
sidebar_label: "14g · Leaked threads and executors"
sidebar_position: 55
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the javadoc for `java.util.concurrent.ExecutorService`
> ([ExecutorService](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ExecutorService.html))
> and `java.util.concurrent.Executors`
> ([Executors](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/Executors.html))
> and `java.lang.Thread`
> ([Thread](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.html));
> the JUnit 6.0.3 User Guide — "Test Instance Lifecycle"
> ([writing-tests/test-instance-lifecycle](https://docs.junit.org/6.0.3/writing-tests/test-instance-lifecycle.html))
> and "Built-in Extensions"
> ([writing-tests/built-in-extensions](https://docs.junit.org/6.0.3/writing-tests/built-in-extensions.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**[14f](14f-concurrency-you-cannot-wait-out.md) covers races the test exposes. This is the mirror
image and it is worse, because the evidence points at the wrong test: work started by test 7 that
lands during test 23. Everything here is about ending things — threads, executors and
`ThreadLocal` entries — and about making the failure land on the test that leaked rather than the
test that was unlucky.**

## Threads and executors that outlive the test

This is the flake nobody attributes correctly, because the test that fails is not the test that
caused it.

```java
// 🔴 one pool per test, none of them ever shut down
class OrderServiceTest {
    private final ExecutorService pool = Executors.newFixedThreadPool(4);
    // ...
}
```

Every test method gets a fresh instance under the default `PER_METHOD` lifecycle
([03](03-the-lifecycle.md)), so a class with forty tests creates forty pools and 160 threads,
all still alive, all still holding whatever the tasks captured. What they then do to *later*
tests:

- **Write a row.** A task submitted in test 7 lands during test 23 and breaks a `count()`.
- **Touch a mock.** A task that calls a shared mock after the test that stubbed it has finished
  produces a verification failure or an unexpected-invocation error in an unrelated test
  ([04 · Mockito](../04-mockito/05-verification.md)).
- **Hold a lock or a connection.** The pool's tasks keep connections checked out and a later test
  blocks on an exhausted pool, failing with a timeout that names the wrong subject.
- **Keep the JVM alive.** The javadoc for `Executors.defaultThreadFactory()`, which every
  `Executors.new…Pool` factory uses unless you supply your own: *"Each new thread is created as a
  non-daemon thread with priority set to the smaller of `Thread.NORM_PRIORITY` and the maximum
  priority permitted in the thread group."* The JVM does not exit while a non-daemon thread runs,
  so your build hangs after the last test, or the build tool kills the fork and you get a
  fork-crash message instead of a test report.

That last point also gives you the diagnostic. The same javadoc: *"New threads have names
accessible via `Thread.getName()` of `pool-N-thread-M`, where N is the sequence number of this
factory, and M is the sequence number of the thread created by this factory."* A thread dump full
of `pool-7-thread-1` through `pool-40-thread-4` is a test class creating one pool per method, and
the N tells you how many factories were constructed.

⚠️ Virtual threads invert that last one. The `Thread` javadoc: *"Virtual threads are daemon
threads and so do not prevent the shutdown sequence from beginning."* A leaked virtual thread
therefore does **not** hang the build — the JVM exits and the task simply never finishes,
silently. That is harder to notice, not easier.

### Shutting one down properly

The three methods are not interchangeable, and the javadoc is explicit about which one waits.

`shutdown()`:

> *"Initiates an orderly shutdown in which previously submitted tasks are executed, but no new
> tasks will be accepted… This method does not wait for previously submitted tasks to complete
> execution. Use `awaitTermination` to do that."*

`shutdownNow()`:

> *"Attempts to stop all actively executing tasks, halts the processing of waiting tasks, and
> returns a list of the tasks that were awaiting execution… There are no guarantees beyond
> best-effort attempts to stop processing actively executing tasks. For example, typical
> implementations will cancel via `Thread.interrupt()`, so any task that fails to respond to
> interrupts may never terminate."*

`close()`, `default` on `ExecutorService` since **JDK 19**:

> *"This method waits until all tasks have completed execution and the executor has terminated.
> If interrupted while waiting, this method stops all executing tasks as if by invoking
> `shutdownNow()`."*

So the honest teardown for a test is:

```java
@AfterEach
void stopPool() throws InterruptedException {
    pool.shutdownNow();
    assertTrue(pool.awaitTermination(5, SECONDS), "pool did not terminate");
}
```

`shutdownNow` interrupts, `awaitTermination` bounds the wait, and the assertion turns a task that
ignores interruption into a *named failure in the test that leaked it* instead of a mystery in
the next one. That last line is the whole point: without it the leak is silent.

🔴 `close()` is convenient and dangerous in a test: it waits for completion with **no bound at
all**, so one hung task hangs the suite. If you use `close()` — or `@AutoClose`
([09d](09d-autoclose.md)) on the field, which calls it — put a `@Timeout`
([13](13-timeouts.md)) on the class so the hang becomes a reported failure.

**Better still, do not own a pool per test.** A single executor as a `static` field with
`PER_CLASS` lifecycle ([03b](03b-per-class-lifecycle.md)), or `Runnable::run` injected
([14c](14c-timing-and-concurrency.md)), removes the leak by removing the thing that leaks.

### `ThreadLocal` and inherited thread-locals

A `ThreadLocal` set on a pooled thread stays set on that thread. The next test that draws the
same thread inherits it — a stale `SecurityContext`, an MDC value, a Spring transaction holder, a
`ThreadLocal` cache — and the pair that fails is not adjacent in the report.

The subtler variant is documented on `Thread`:

> *"A `Thread` inherits its initial values of inheritable-thread-local variables (including the
> context class loader) from the parent thread values at the time that the child `Thread` is
> created."*

A thread created *during* test A therefore carries test A's inheritable thread-locals and its
context class loader for its entire life, however long that outlasts test A. Threads created
eagerly in a `@BeforeAll`, or by a library on first use, capture whatever the first test happened
to have set.

**Fix:** clear in `@AfterEach` with `remove()`, not `set(null)` — the entry stays in the map
either way, but `null` is a value that later code will happily read as if it were meaningful.
Better, do not put request-scoped state in a `ThreadLocal` your tests can reach; and best, do not
own the thread.

## Gotchas

**★ Creating an `ExecutorService` as an instance field of a test class.**
Under `PER_METHOD` you get one per test method, none of them shut down, all of them still
running. Forty tests become 160 live threads that go on writing rows and calling mocks for the
rest of the suite.

**★ Calling `shutdown()` and assuming the tasks are done.**
The javadoc says the opposite in as many words: it does not wait, and you must use
`awaitTermination` to do that. `shutdown()` alone in an `@AfterEach` leaks exactly as much as
calling nothing, just more politely.

**★ Calling `awaitTermination` and ignoring its result.**
It returns `false` on timeout. Without an assertion on the return value, a task that ignores
interruption leaks silently and the leak is attributed to whichever test fails next.

**★ Using `ExecutorService.close()` (or `@AutoClose`) on a pool in a test with no `@Timeout`.**
`close()` waits for all tasks to complete with no bound. A single hung task converts a failing
test into a hanging build, which produces no test report at all.

**★ Assuming a leaked virtual thread will hang the build the way a platform thread does.**
It will not — the `Thread` javadoc states virtual threads are daemon threads and do not prevent
JVM shutdown. The work is silently abandoned instead, which is a quieter failure, not a safer one.

**★ `threadLocal.set(null)` as cleanup.**
The entry survives; you have merely replaced a stale value with `null`, which downstream code
reads as a value. Use `remove()`.

**★ Assuming a thread created in `@BeforeAll` is neutral.**
It captured the inheritable thread-locals and the context class loader of whichever thread created
it, at creation time, and keeps them for its whole life — which may be the whole suite.

**★ Diagnosing the test that failed rather than the test that leaked.**
A leaked thread produces a failure in a *later*, unrelated test. Looking for the bug in the red
test finds nothing. The tools are a full-suite run with randomised ordering
([11b](11b-random-order.md)) and, if the leak is a pool, an assertion on termination in every test
that creates one — which moves the failure back to its cause.

**★ Letting the build tool's forking configuration hide the leak.**
A fresh JVM per class disposes of every leaked thread at the class boundary, so a suite that only
passes with a fork per class may be leaking threads rather than `static` state
([14](14-flaky-tests.md)). Both diagnoses are worth separating, because the fixes are different.

## Interview questions

**★ What is the correct way to shut down an executor a test created, and why is it three lines
rather than one?**
`shutdownNow()` to interrupt anything running, `awaitTermination(bound, unit)` to wait, and an
assertion on the boolean that `awaitTermination` returns. `shutdown()` on its own explicitly does
not wait — the javadoc says so and points you at `awaitTermination`. `shutdownNow()` on its own is
best-effort: it interrupts, and a task that does not respond to interruption keeps going.
`close()` does wait, but with no bound, so a hung task hangs the build. The assertion is the part
people leave out and the part that matters: it converts a silent leak into a failure in the test
that caused it.

**★ Why is a leaked thread a flakiness problem rather than just untidy?**
Because it keeps executing after its test has ended. It writes rows that break another test's
`count()`, calls mocks that another test has since reset, holds database connections that another
test then cannot get, and keeps `ThreadLocal` state alive on a pooled thread that a later test
will draw. The failure surfaces in a test that has nothing to do with the cause, which is why
these are among the hardest flakes to attribute — and why the fix is to assert termination in the
test that owns the pool rather than to hunt downstream.

**★ Why does a `ThreadLocal` cause a flake even though each test gets a fresh instance?**
The fresh instance is a fresh *test class* instance; the thread is not fresh. `ThreadLocal` state
is keyed by thread, so anything left on a pooled thread — Jupiter's parallel executor threads, a
connection pool's threads, an HTTP client's threads — is visible to whatever runs on that thread
next. Worse, a thread created during a test inherits that test's inheritable thread-locals and
context class loader at creation time and keeps them for as long as it lives, per the `Thread`
javadoc.

{/* FOOTER */}
