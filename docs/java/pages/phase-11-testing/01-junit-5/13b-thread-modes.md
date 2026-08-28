---
title: "SAME_THREAD interrupts your test's own thread from somewhere else specifically so that ThreadLocal-bound frameworks keep working, and the JUnit documentation names Spring's transaction management as the reason — which is also why the SEPARATE_THREAD failure mode is a test that passes while writing to your database"
sidebar_label: "13b · Thread modes"
sidebar_position: 48
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Timeouts"
> ([writing-tests/timeouts](https://docs.junit.org/6.0.3/writing-tests/timeouts.html))
> and "Assertions"
> ([writing-tests/assertions](https://docs.junit.org/6.0.3/writing-tests/assertions.html));
> javadoc for `Assertions`
> ([Assertions](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/Assertions.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**`@Timeout` has a `threadMode` attribute with three values, and choosing between them is not a
performance decision — it decides whether your test's framework-managed state survives. The
JUnit documentation is unusually direct about this, naming Spring by name and describing a
failure in which the test passes and the data is committed anyway.**

[13](13-timeouts.md) compares the three timeout tools; this is the attribute that makes two of
them behave alike.

## The three modes

> *"The timeout can be applied using one of the following three thread modes: `SAME_THREAD`,
> `SEPARATE_THREAD`, or `INFERRED`."*

### `SAME_THREAD`

> *"When `SAME_THREAD` is used, the execution of the annotated method proceeds in the main
> thread of the test. If the timeout is exceeded, the main thread is interrupted from another
> thread. This is done to ensure interoperability with frameworks such as Spring that make use
> of mechanisms that are sensitive to the currently running thread — for example, `ThreadLocal`
> transaction management."*

Read the mechanism, because it is clever and it is the reason this mode exists at all. Your test
runs where it always runs. A **watcher** thread holds the deadline, and when the deadline
passes, *it* calls `Thread.interrupt()` on your test's thread. Nothing about the test's own
execution context changes — the transaction, the security context, the `MDC` are all still bound
to the thread that is doing the work.

The documentation names the reason explicitly: *"to ensure interoperability with frameworks such
as Spring"*. This is not incidental; it is the design goal of the mode.

### `SEPARATE_THREAD`

> *"On the contrary when `SEPARATE_THREAD` is used, like the `assertTimeoutPreemptively()`
> assertion, the execution of the annotated method proceeds in a separate thread, this can lead
> to undesirable side effects, see Preemptive Timeouts with `assertTimeoutPreemptively()`."*

**"like the `assertTimeoutPreemptively()` assertion"** — the guide equates them. Everything true
of one is true of the other, including the section below.

### `INFERRED`

> *"When `INFERRED` (default) thread mode is used, the thread mode is resolved via the
> `junit.jupiter.execution.timeout.thread.mode.default` configuration parameter. If the provided
> configuration parameter is invalid or not present then `SAME_THREAD` is used as fallback."*

So the effective default is `SAME_THREAD` — the safe one — unless a configuration parameter says
otherwise. ⚠️ Note the interaction with JUnit 6: `junit.jupiter.execution.timeout.thread.mode.default`
is one of the enum parameters whose invalid values *"now cause test discovery or execution to
fail"* on 6.0 ([12](12-parallel-execution.md)). The "invalid … falls back to `SAME_THREAD`"
sentence in the timeouts page and that release note are in tension for JUnit 6, and **I could not
determine from the documentation which behaviour wins for this specific parameter.** Do not rely
on the fallback: spell the value correctly.

## 🔴 Why a separate thread breaks Spring, in the documentation's own words

> *"The various `assertTimeoutPreemptively()` methods in the `Assertions` class execute the
> provided executable or supplier in a different thread than that of the calling code. This
> behavior can lead to undesirable side effects if the code that is executed within the
> executable or supplier relies on `java.lang.ThreadLocal` storage."*

> *"One common example of this is the transactional testing support in the Spring Framework.
> Specifically, Spring's testing support binds transaction state to the current thread (via a
> `ThreadLocal`) before a test method is invoked. Consequently, if an executable or supplier
> provided to `assertTimeoutPreemptively()` invokes Spring-managed components that participate
> in transactions, any actions taken by those components will not be rolled back with the
> test-managed transaction. On the contrary, such actions will be committed to the persistent
> store (e.g., relational database) even though the test-managed transaction is rolled back."*

> *"Similar side effects may be encountered with other frameworks that rely on `ThreadLocal`
> storage."*

Walk through what that means concretely:

1. Spring's `TestContext` framework starts a transaction and binds it to the test thread before
   the test method runs. `@Transactional` on a test means "roll this back at the end".
2. Your `SEPARATE_THREAD` timeout runs the body on a different thread.
3. Repository calls made on that thread look up the current transaction, find none bound to
   *their* thread, and start their own — which is not the test-managed one.
4. That transaction commits normally.
5. The test-managed transaction rolls back at the end, rolling back nothing, because the writes
   were never in it.

**The test passes.** The rows are in the database. The next test in the class sees them, and the
failure surfaces somewhere else entirely — as an order-dependence
([11d](11d-when-order-is-a-smell.md)) or a parallel flake
([12e](12e-shared-state-under-parallelism.md)) in a test that never heard of timeouts.

This is the single most expensive interaction in this topic, because every other failure here is
loud and this one is silent and green.

## What else is `ThreadLocal`-bound

The guide says *"other frameworks that rely on `ThreadLocal` storage"* without listing them. The
ones a Java developer will actually meet:

| Bound to the thread | What breaks on a separate thread |
|---|---|
| Spring `TransactionSynchronizationManager` | writes commit instead of rolling back |
| Spring `RequestContextHolder` | request-scoped beans unavailable |
| Spring Security `SecurityContextHolder` | the authenticated principal is gone; authorisation fails or falls through to anonymous |
| SLF4J / Logback `MDC` | correlation ids vanish from log lines |
| Hibernate session binding via Spring | a new session, so no first-level cache and possible `LazyInitializationException` |
| `Locale`/`TimeZone` set through a request filter | defaults instead of the request's |

Each is a different symptom of one cause. The tell is always: *the behaviour is correct when the
timeout is not there.*

## Choosing

**Default to `SAME_THREAD`** — which is what you get by leaving `threadMode` alone. It is safe
with every framework above, and it still fails the test at the deadline.

**Use `SEPARATE_THREAD`** only when `SAME_THREAD` genuinely cannot help: the code you are timing
ignores interruption entirely, and you need the *test* to be marked failed and move on even
though the work continues. Understand what you are buying — the test result, not the termination
of the work.

**Never use `SEPARATE_THREAD` (or `assertTimeoutPreemptively`) in a test that touches a
transaction, a security context, or a request scope.** There is no configuration that makes it
safe.

If the reason you wanted `SEPARATE_THREAD` was "the test hangs and `SAME_THREAD` did not stop
it", the real problem is that your code is not interruptible, and a timeout is the wrong tool
([13d](13d-what-a-timeout-is-for.md)).

## Gotchas

**★ Using `SEPARATE_THREAD` or `assertTimeoutPreemptively` in a `@Transactional` test.**
The documented outcome is that Spring-managed components' writes *"will be committed to the
persistent store … even though the test-managed transaction is rolled back"*. The test passes.
The data stays. The next failure is somewhere else.

**★ Assuming `SAME_THREAD` cannot interrupt because it is the same thread.**
It can. A watcher thread interrupts the test's thread from outside. The mode is "same thread as
the test", not "no other thread involved".

**★ Reaching for `SEPARATE_THREAD` because `SAME_THREAD` did not stop the code.**
Interruption is cooperative in both modes. If your code ignores interruption, `SEPARATE_THREAD`
does not stop it either — it only lets the *test* be reported as failed while the work carries
on. You have bought a report, not a termination.

**★ Losing the security context and blaming the test.**
`SecurityContextHolder` is `ThreadLocal`-bound by default. A `SEPARATE_THREAD` timeout makes the
principal disappear inside the timed block, so authorisation behaves as anonymous. Nothing in the
failure mentions the timeout.

**★ Losing `MDC` correlation ids in a timed block.**
Same mechanism, and it makes the timeout failure itself harder to diagnose, because the log lines
you need have lost the id you would have grepped for.

**★ Setting `junit.jupiter.execution.timeout.thread.mode.default` to `separate_thread` globally.**
That silently applies the hazardous mode to every `@Timeout` in the module, including ones in
transactional tests written by people who never chose it. If you need the mode, put it on the
method.

**★ Typing the thread-mode parameter value wrong.**
The timeouts page says an invalid value falls back to `SAME_THREAD`; the 6.0 release notes list
this parameter among those whose invalid values now fail discovery or execution. Those two
statements are hard to reconcile, so do not depend on either — get the spelling right.

**★ Treating `assertTimeoutPreemptively` as different from `@Timeout(SEPARATE_THREAD)`.**
The guide says the latter behaves *"like the `assertTimeoutPreemptively()` assertion"*. Same
mechanism, same hazards. The annotation is preferable only because it is visible in the signature
and participates in the timeout configuration.

**★ Testing async code by wrapping it in a preemptive timeout.**
That does not test the asynchrony; it tests that some thread finished in time, on a thread with
none of your framework state. Poll with a `@Timeout(SAME_THREAD)` guard, or use Awaitility
([13d](13d-what-a-timeout-is-for.md)).

## Interview questions

**★ What are the three `@Timeout` thread modes and what is the effective default?**
`SAME_THREAD`, `SEPARATE_THREAD` and `INFERRED`. `INFERRED` is the annotation default and resolves
through the `junit.jupiter.execution.timeout.thread.mode.default` configuration parameter, with
`SAME_THREAD` as the documented fallback when that parameter is absent. So unless somebody has
configured otherwise, you get `SAME_THREAD`, which is the safe one.

**★ How can a timeout interrupt a test that is running on the same thread?**
A separate watcher thread holds the deadline and calls `Thread.interrupt()` on the test's thread
when it expires. The test's own execution context never moves, which is exactly why the mode
exists — the guide says it is done *"to ensure interoperability with frameworks such as Spring
that make use of mechanisms that are sensitive to the currently running thread"*.

**★ Explain precisely how `SEPARATE_THREAD` breaks a `@Transactional` test.**
Spring binds the test-managed transaction to the test thread through a `ThreadLocal` before the
test method runs. `SEPARATE_THREAD` executes the body on a different thread, where that binding
is absent, so repository calls start their own transaction and commit it. The test-managed
transaction then rolls back nothing. The result is a passing test that has left rows in the
database.

**★ Besides transactions, what else is `ThreadLocal`-bound and would break?**
Spring Security's `SecurityContextHolder`, so the authenticated principal disappears; Spring's
`RequestContextHolder`, so request-scoped beans are unavailable; SLF4J's `MDC`, so correlation
ids vanish; and the Hibernate session bound by Spring, so you get a fresh session with no
first-level cache. All the same cause, all silent.

**★ Your test hangs and `@Timeout` with the default mode does not stop it. What do you conclude?**
That the code is not interruptible — interruption sets a flag and unblocks interruptible waits, and
a CPU-bound loop or a native call ignores it. Switching to `SEPARATE_THREAD` will mark the test
failed while the work keeps running in the background, which is a reporting fix, not a
termination. The real fix is to make the code interruptible or to stop timing it this way.

**★ Is there a safe way to use `SEPARATE_THREAD` with Spring?**
Not for anything that touches thread-bound state — transactions, security, request scope. If the
timed block is pure computation with no framework involvement, the mode is harmless; the moment
it calls a Spring-managed component that participates in a transaction, the documented side
effect applies and no configuration prevents it.

{/* FOOTER */}
