---
title: "The only question that separates @Timeout, assertTimeout and assertTimeoutPreemptively is which thread your code runs on and whether anything actually stops it — everything else about them follows from that, including why one of them silently commits to your database"
sidebar_label: "13 · Timeouts"
sidebar_position: 47
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Timeouts"
> ([writing-tests/timeouts](https://docs.junit.org/6.0.3/writing-tests/timeouts.html))
> and "Assertions"
> ([writing-tests/assertions](https://docs.junit.org/6.0.3/writing-tests/assertions.html));
> javadoc for `Assertions`
> ([Assertions](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/Assertions.html))
> and `@Timeout`
> ([Timeout](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/Timeout.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**Three tools that all fail a test for taking too long, and they are not interchangeable. Two
of them measure and then complain; one of them actually interrupts. Two of them run your code
on the calling thread; one runs it somewhere else. Get the pairing wrong and you get a test
that hangs forever, or one whose database writes escape the rollback.**

Thread modes and the `ThreadLocal` problem in full are
[13b · thread modes](13b-thread-modes.md); the configuration family is
[13c · timeout configuration](13c-timeout-configuration.md); the argument about what a
timeout is actually for is [13d · what a timeout is for](13d-what-a-timeout-is-for.md).

## The three tools, on the one axis that matters

| | Runs on | On expiry | Stops the code? |
|---|---|---|---|
| `assertTimeout` | the calling thread | fails **after** the code finishes | **no** |
| `assertTimeoutPreemptively` | a **different** thread | fails at the deadline | interrupts — best effort |
| `@Timeout` | depends on `threadMode` ([13b](13b-thread-modes.md)) | fails at the deadline | interrupts the executing thread |

Everything else is detail.

## `assertTimeout` measures; it does not stop anything

> *"Note: the executable will be executed in the same thread as that of the calling code.
> Consequently, execution of the executable will not be preemptively aborted if the timeout is
> exceeded."*

Read the consequence: **`assertTimeout(ofMillis(10), …)` on code that takes an hour takes an
hour, and then fails.** It is an assertion *about* elapsed time, evaluated afterwards. It cannot
rescue a hung suite, because there is nothing to rescue it from — the assertion has not been
reached yet.

The guide's examples:

```java
@Test
void timeoutNotExceededWithResult() {
    // The following assertion succeeds, and returns the supplied object.
    String actualResult = assertTimeout(ofMinutes(2), () -> {
        return "a result";
    });
    assertEquals("a result", actualResult);
}

@Test
void timeoutExceeded() {
    // The following assertion fails with an error message similar to:
    // execution exceeded timeout of 10 ms by 91 ms
    assertTimeout(ofMillis(10), () -> {
        // Simulate task that takes more than 10 ms.
        Thread.sleep(100);
    });
}
```

Two useful properties fall out of "same thread":

- **It returns the value.** `assertTimeout` with a `ThrowingSupplier` gives you the result, so
  you can assert on it afterwards without a mutable holder.
- **Everything thread-bound still works.** A Spring-managed transaction, a security context,
  an `MDC` — all intact, because it is the same thread. That is precisely what
  `assertTimeoutPreemptively` gives up.

Note the failure message shape the guide quotes: *"execution exceeded timeout of 10 ms by 91
ms"* — it tells you the overshoot, because it measured the whole thing.

## `assertTimeoutPreemptively` interrupts — and may not succeed

> *"The various `assertTimeoutPreemptively()` methods in this class execute the provided
> callback (executable or supplier) in a different thread than that of the calling code. If the
> timeout is exceeded, an attempt will be made to preemptively abort execution of the callback
> by interrupting the callback's thread. If the callback's thread does not return when
> interrupted, the thread will continue to run in the background after the
> `assertTimeoutPreemptively()` method has returned."*

Three things in that paragraph, and every one of them is a trap in waiting.

**"a different thread than that of the calling code"** — the `ThreadLocal` problem
([13b](13b-thread-modes.md)).

**"an attempt will be made"** — `Thread.interrupt()` is cooperative. It sets a flag and unblocks
code that is waiting in an interruptible method. A tight CPU loop, a blocking socket read on
some stacks, a native call: none of them notice.

**🔴 "the thread will continue to run in the background"** — the assertion returns, the test
fails, and the runaway thread is still going. In a suite of a thousand tests that pattern leaks
a thread per occurrence, each holding whatever it held: a connection, a lock, a file handle.
The failure you eventually see is an exhausted pool in an unrelated test.

The guide's example is chosen so interruption *does* work:

```java
@Test
void timeoutExceededWithPreemptiveTermination() {
    // The following assertion fails with an error message similar to:
    // execution timed out after 10 ms
    assertTimeoutPreemptively(ofMillis(10), () -> {
        // Simulate task that takes more than 10 ms.
        new CountDownLatch(1).await();
    });
}
```

`CountDownLatch.await()` is interruptible, so the thread really does stop. Substitute
`while (true) { i++; }` and it does not.

Compare the messages: `assertTimeout` says *"execution exceeded timeout of 10 ms by 91 ms"*
because it waited and measured; `assertTimeoutPreemptively` says *"execution timed out after 10
ms"* because it gave up at the deadline and has no idea how long the work would have taken.

## `@Timeout` — declarative, and broader than the assertions

> *"The `@Timeout` annotation allows one to declare that a test, test factory, test template, or
> lifecycle method should fail if its execution time exceeds a given duration. The time unit for
> the duration defaults to seconds but is configurable."*

```java
class TimeoutDemo {

    @BeforeEach
    @Timeout(5)
    void setUp() {
        // fails if execution time exceeds 5 seconds
    }

    @Test
    @Timeout(value = 500, unit = TimeUnit.MILLISECONDS)
    void failsIfExecutionTimeExceeds500Milliseconds() {
        // fails if execution time exceeds 500 milliseconds
    }

    @Test
    @Timeout(value = 500, unit = TimeUnit.MILLISECONDS, threadMode = ThreadMode.SEPARATE_THREAD)
    void failsIfExecutionTimeExceeds500MillisecondsInSeparateThread() {
        // fails if execution time exceeds 500 milliseconds, the test code is executed in a separate thread
    }

}
```

**Seconds by default.** `@Timeout(5)` is five seconds, not five milliseconds — the single most
common misreading, and it fails in the safe direction, which is why nobody catches it.

The annotation reaches places the assertions cannot: **lifecycle methods**. A `@BeforeAll` that
starts a container, a `@BeforeEach` that opens a connection — you cannot wrap those in an
assertion without restructuring them, and a hung `@BeforeAll` hangs the whole class.

### Class-level `@Timeout` and the exception nobody expects

> *"To apply the same timeout to all test methods within a test class and all of its `@Nested`
> classes, you can declare the `@Timeout` annotation at the class level. It will then be applied
> to all test, test factory, and test template methods within that class and its `@Nested`
> classes unless overridden by a `@Timeout` annotation on a specific method or `@Nested` class.
> Please note that `@Timeout` annotations declared at the class level are not applied to
> lifecycle methods."*

🔴 **Class-level `@Timeout` does not cover `@BeforeEach`, `@AfterEach`, `@BeforeAll` or
`@AfterAll`.** Which is exactly backwards from where a hang usually is: the setup that opens a
connection, not the assertion. If you want lifecycle methods covered, annotate them
individually, or use the `junit.jupiter.execution.timeout.lifecycle.method.default`
configuration parameter ([13c](13c-timeout-configuration.md)).

### `@TestFactory` and `@TestTemplate`

> *"Declaring `@Timeout` on a `@TestFactory` method checks that the factory method returns
> within the specified duration but does not verify the execution time of each individual
> `DynamicTest` generated by the factory. Please use `assertTimeout()` or
> `assertTimeoutPreemptively()` for that purpose."*

> *"If `@Timeout` is present on a `@TestTemplate` method — for example, a `@RepeatedTest` or
> `@ParameterizedTest` — each invocation will have the given timeout applied to it."*

Opposite behaviours, and both are what you would want on reflection: a factory is one method
that produces tests, so the timeout covers the production; a template *is* the test, repeated,
so the timeout is per repetition. `@Timeout(1)` on a `@ParameterizedTest` with a hundred cases
allows a hundred seconds, not one.

## Which one to use

**`@Timeout`** for almost everything. It is declarative, it covers lifecycle methods, it has a
configurable default, and it can be disabled globally while you debug
([13c](13c-timeout-configuration.md)).

**`assertTimeout`** when you want to time *one operation inside* a test and keep everything on
the calling thread — the timing is part of the assertion, not a safety net.

**`assertTimeoutPreemptively`** almost never, and never in a test that touches Spring-managed
transactions or anything else `ThreadLocal`-bound. If you need preemption on a method, prefer
`@Timeout(threadMode = SEPARATE_THREAD)`, which has the same semantics and is at least visible
in the method's annotations rather than buried in its body.

## Gotchas

**★ Expecting `assertTimeout` to stop a hanging test.**
It cannot. The executable runs on the calling thread and is *"not preemptively aborted"* — the
assertion is evaluated after the code returns, so code that never returns never fails. Use
`@Timeout` for a hang.

**★ `@Timeout(5)` read as five milliseconds.**
The unit defaults to `TimeUnit.SECONDS`. The mistake is generous rather than strict, so a
too-loose timeout silently protects nothing.

**★ Class-level `@Timeout` and a hanging `@BeforeEach`.**
Class-level `@Timeout` is documented as not applying to lifecycle methods. The hang you were
guarding against is often in setup, and it is exactly what the class-level annotation misses.

**★ `assertTimeoutPreemptively` leaving a thread running.**
If the callback's thread does not respond to interruption it *"will continue to run in the
background"* after the assertion returns. Repeat that a hundred times and you have leaked a
hundred threads, each still holding whatever resource it took.

**★ Assuming interruption stops anything.**
`Thread.interrupt()` sets a flag and unblocks interruptible waits. A CPU-bound loop or a native
call ignores it. Preemption is best-effort by construction, not a guarantee.

**★ `@Timeout` on a `@TestFactory` expecting per-test enforcement.**
It times the factory method, not the `DynamicTest`s it produces. The guide points you at
`assertTimeout` inside each dynamic test for that.

**★ `@Timeout` on a `@ParameterizedTest` read as a total budget.**
It applies per invocation. A hundred cases at `@Timeout(1)` permits a hundred seconds.

**★ Using `assertTimeoutPreemptively` in a `@Transactional` test.**
The callback runs on another thread, so Spring's `ThreadLocal`-bound transaction is not visible
to it, and its writes commit instead of rolling back ([13b](13b-thread-modes.md)). This is the
worst failure in the whole topic because the test *passes*.

**★ Choosing `assertTimeoutPreemptively` over `@Timeout(SEPARATE_THREAD)` out of habit.**
They share the documented behaviour and the documented hazards, but the annotation is visible
at the method signature, participates in the timeout configuration family, and can be disabled
globally for a debugging session. The assertion can do none of those.

**★ Reading the two failure messages as equivalent.**
*"execution exceeded timeout of 10 ms by 91 ms"* comes from `assertTimeout`, which waited and
therefore knows the overshoot. *"execution timed out after 10 ms"* comes from
`assertTimeoutPreemptively`, which stopped waiting and does not know how long the work needed.
If you want to know how slow something actually is, the non-preemptive one is the informative
tool.

## Interview questions

**★ What is the difference between `assertTimeout` and `assertTimeoutPreemptively`?**
Which thread the code runs on, and whether it is stopped. `assertTimeout` runs the executable on
the calling thread and is documented as *not* preemptively aborting it, so the failure is
reported after the code finishes — code that hangs forever hangs the suite forever.
`assertTimeoutPreemptively` runs it on a different thread and interrupts that thread at the
deadline, which stops interruptible code, breaks `ThreadLocal`-bound state, and may leave a
thread running in the background if interruption is ignored.

**★ Why would `assertTimeoutPreemptively` cause data to be committed in a test that should roll
back?**
Because Spring's test support binds the transaction to the current thread through a
`ThreadLocal`, and the callback runs on a different thread. Components invoked inside the
callback do not see the test-managed transaction, so their work is not rolled back with it and
is committed to the database instead. The guide documents exactly this scenario.

**★ Does a class-level `@Timeout` protect a `@BeforeEach`?**
No. Class-level `@Timeout` applies to test, test factory and test template methods in the class
and its `@Nested` classes, and is documented as *not* applying to lifecycle methods. Cover those
with a method-level `@Timeout` or with the
`junit.jupiter.execution.timeout.lifecycle.method.default` configuration parameter.

**★ `@Timeout(1)` on a `@RepeatedTest(100)` — what is the budget?**
One second per invocation, so up to a hundred seconds overall. The guide states that a
`@Timeout` on a `@TestTemplate` method applies to each invocation. A `@TestFactory` behaves
oppositely: the timeout covers the factory method, not the dynamic tests it returns.

**★ Which of the three would you reach for by default, and why?**
`@Timeout`. It is declarative and therefore visible; it is the only one that can guard lifecycle
methods; it has a whole family of default-timeout configuration parameters; and it can be turned
off globally with `junit.jupiter.execution.timeout.mode` while you step through a debugger. The
assertions are for timing a specific operation inside a test.

**★ Is `assertTimeoutPreemptively` guaranteed to stop the code?**
No. It interrupts the callback's thread, which unblocks interruptible waits but does nothing to
a CPU-bound loop or a native call. The javadoc says the thread *"will continue to run in the
background"* if it does not return when interrupted — so the assertion fails, the test moves on,
and the work carries on holding whatever it holds.

{/* FOOTER */}
