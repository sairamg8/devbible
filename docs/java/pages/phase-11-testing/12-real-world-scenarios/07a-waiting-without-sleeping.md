---
title: "Waiting is the part of an async test that decides whether it is fast, honest and diagnosable or slow, flaky and silent — and the three levers are the executor you install, the operator you wait with, and the fact that Awaitility polls on a thread that is not yours"
sidebar_label: "07a · Waiting without sleeping"
sidebar_position: 61
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Awaitility 4.3.0** `ConditionFactory` javadoc
> ([javadoc.io](https://javadoc.io/static/org.awaitility/awaitility/4.3.0/org/awaitility/core/ConditionFactory.html))
> and usage guide ([github.com](https://github.com/awaitility/awaitility/wiki/Usage)); the
> **Spring Framework 7.0.x** `SyncTaskExecutor` javadoc
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/core/task/SyncTaskExecutor.html));
> the **Spring Boot 4.1** reference *Task Execution and Scheduling*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/features/task-execution-and-scheduling.html));
> and the **Mockito 5.23.0** javadoc §22 *Verification with timeout*
> ([site.mockito.org](https://site.mockito.org/javadoc/current/org/mockito/Mockito.html)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7, Awaitility 4.3.0.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**[07](07-async-scheduled-and-eventual.md) split the async problem into three questions and
showed that two of them need no waiting at all. This chunk is about the third: what to do
when you genuinely have to wait. There are two moves — remove the wait by replacing the
executor, or bound the wait with a polling operator — and one fact that ruins tests written
by people who do not know it: `await()` polls from its own thread, not yours.**

## Making async synchronous on purpose

Sometimes you genuinely want the async path exercised end to end but not concurrently —
an integration test where the hand-off must happen but the timing is noise.
`SyncTaskExecutor` is documented for exactly this:

> *"`TaskExecutor` implementation that executes each task synchronously in the calling
> thread. This can be used for testing purposes but also for bounded execution in a Virtual
> Threads setup…"*

```java
@TestConfiguration(proxyBeanMethods = false)
class SynchronousExecution {

    @Bean(name = "applicationTaskExecutor")
    AsyncTaskExecutor applicationTaskExecutor() {
        return new TaskExecutorAdapter(new SyncTaskExecutor());
    }
}
```

Two caveats, and they are the reason this is a tool and not a default. It deletes the
concurrency from the test, so nothing about ordering, interleaving or thread-confinement is
being checked any more — the wiring test above still has to exist separately. And it changes
the shape of the stack: with a synchronous executor the body runs inside the caller's frame,
so a failure surfaces at a different point in time than it will in production. ⚠️ I could not
find documentation settling whether a synchronous executor changes *which* path a `void`
`@Async` exception takes, so do not build an error-path assertion on it; assert on the
`AsyncUncaughtExceptionHandler` instead, which is documented.

## Awaitility, the way it is actually meant to be written

When you genuinely have to wait — question 2, or an integration test where a listener
eventually writes a row — Awaitility is the tool and there is one idiom worth memorising:

```java
await().atMost(Duration.ofSeconds(2))
       .pollInterval(Duration.ofMillis(50))
       .untilAsserted(() -> assertThat(receipts.findByOrder(ORDER_ID)).isPresent());
```

- **`untilAsserted(ThrowingRunnable)`** takes an assertion, retries it, and on timeout
  reports the *last assertion failure* — so the message says "expected present but was
  empty", not "condition not fulfilled". `until(Callable<Boolean>)` reports only the latter.
  Use `untilAsserted` unless the condition is genuinely a boolean.
- **`atMost` always, explicitly.** The documented default is *"Awaitility will wait for 10
  seconds"*, which is a fine default for one test and a disaster for twenty failing ones.
- **`pollDelay`** is the wait before the *first* check and defaults to the poll interval;
  set it to `Duration.ZERO` when the condition may already be true, or the fastest possible
  test still costs one poll delay.
- **`ignoreExceptions()`** for the case where the condition throws while the system is still
  starting — otherwise the first `NullPointerException` aborts the wait instead of retrying.
- **`untilAtomic`, `untilTrue`, `untilAdder`, `untilAccumulator`** exist because polling a
  plain field is unsafe, which is the next point.
- On timeout you get a `ConditionTimeoutException`. It is a distinctive type, and it is worth
  grepping CI for, because a suite that has started throwing them is a suite about to go
  flaky everywhere.

And the warning that costs people an afternoon, verbatim:

> *"Awaitility does nothing to ensure thread safety or thread synchronization! This is your
> responsibility!"*

Polling `() -> this.done` where `done` is a plain `boolean` written by another thread is not
a slow test — it is a test that may loop until timeout on a value that was set long ago,
because nothing in the Java memory model forced the polling thread to re-read it. Poll an
`AtomicBoolean`, a `volatile` field, a `ConcurrentHashMap`, a `CountDownLatch`, or the
database. Never a plain field.

## The operators worth knowing beyond `atMost`

`ConditionFactory` is bigger than the two methods everyone uses, and four of the rest change
how a suite behaves under failure:

| Operator | Documented as | Why it matters |
|---|---|---|
| `alias("receipt is stored")` | *"Set the alias"* | The timeout message names the condition. In a test with three waits, this is the difference between a two-minute and a two-second diagnosis. |
| `failFast(ThrowingRunnable)` | *"If the supplied `failFastAssertion` ever … throws an exception, it indicates our condition will never be true, and if so fail the system immediately."* | Stop waiting when the message has already landed on the dead-letter queue. Turns a ten-second timeout into an instant, accurate failure. |
| `during(Duration)` | *"Await at the predicate holds during at least timeout"* | For "and it stayed that way" — no duplicate row appeared in the next 200 ms. |
| `atLeast(Duration)` | *"Condition has to be evaluated not earlier than timeout before throwing a timeout exception."* | For asserting something did **not** happen too early — a debounce, a backoff. |
| `pollInSameThread()` | *"Instructs Awaitility to execute the polling of the condition from the same as the test."* | The escape hatch for the thread-local problem below. |
| `ignoreExceptions()` | *"Instruct Awaitility to ignore all exceptions that occur during evaluation."* | The condition is allowed to be *wrong* while it is still becoming right. |

`failFast` deserves the extra sentence. The default failure mode of a polling wait is the
worst one available: it waits the full timeout and then reports that the thing did not
happen, with no clue why. If the same system that eventually produces the row also produces
a dead-letter record when it fails, `failFast` lets one wait cover both outcomes and report
the informative one:

```java
await().alias("receipt stored")
       .atMost(Duration.ofSeconds(5))
       .failFast("receipt was dead-lettered",
                 () -> assertThat(deadLetters.countFor(ORDER_ID)).isZero())
       .untilAsserted(() -> assertThat(receipts.findByOrder(ORDER_ID)).isPresent());
```

## 🔴 Awaitility polls on its own thread, and that breaks thread-bound state

This is the fact that turns a correct-looking test into an unexplainable one. The default
poll runs on an Awaitility-managed thread — which is why `pollInSameThread()` exists as an
explicit opt-out, and why the javadoc calls it *"an advanced feature"* with a warning that
Awaitility *"cannot interrupt the thread when it's using the same thread as the test"*.

Anything bound to the test thread is therefore invisible inside the lambda:

- the transaction and `EntityManager` a `@Transactional` test opened;
- `SecurityContextHolder`, which is `ThreadLocal` by default — so a repository call inside
  the poll runs unauthenticated and method security rejects it
  ([06c](06c-method-security-with-no-request.md));
- `RequestContextHolder`, and anything scoped to it;
- `MDC` and any other diagnostic context your logging depends on;
- a Mockito `mockStatic` scope, which [02b](02b-when-the-collaborator-is-hard-to-mock.md)
  already flagged as *"within the current thread and a user-defined scope"*.

The symptom is a `LazyInitializationException`, an `AccessDeniedException` or a silently
empty query result inside a wait whose logic is correct. Two ways out, and they are not
equivalent: `pollInSameThread()` keeps the context but forfeits Awaitility's ability to
interrupt a hung condition — so pair it with `@Timeout` from JUnit — or, better, poll
something that has no thread affinity, such as a fresh `JdbcClient` query or an
`AtomicReference` the production code writes.

## Mockito can wait too, and its own documentation tells you not to lean on it

`verify(mock, timeout(100))` is a real verification mode and the shortest possible way to
wait for an interaction:

```java
verify(mail, timeout(2000)).send(eq("ada@example.com"), any(), any());
```

The javadoc's examples cover the combinations — `timeout(100).times(2)`,
`timeout(100).atLeast(2)` — and then adds the sentence that decides when to use it:

> *"This feature should be used rarely - figure out a better way of testing your
> multi-threaded system."*

> *"Not yet implemented to work with `InOrder` verification."*

Take that at face value. `timeout()` is a reasonable choice for one narrow case: the thing
you are waiting for **is** an interaction with a mock you already hold, and there is no
other observable. The moment the assertion is about state — a row, a queue depth, a cache
entry — Awaitility's `untilAsserted` gives a better failure message and does not couple the
wait to Mockito's verification internals.

## A wait is not a substitute for a signal

Before reaching for any of this, ask whether the system already offers a completion signal
you are ignoring. In rough order of preference:

1. **A `CompletableFuture` returned by the method** — the completion *is* the signal;
   `assertThat(future).succeedsWithin(...)` and no polling at all.
2. **A `CountDownLatch` the test installs** in a stubbed collaborator, awaited with a bound.
   Deterministic, and it fails fast when the count never reaches zero.
3. **A synchronous executor**, removing the concurrency from the scenario entirely.
4. **Awaitility**, when the completion happens somewhere you cannot instrument — a message
   listener, a container, another process.
5. **`Thread.sleep`** — never.

Most "we need Awaitility" situations are actually situation 1 or 2 with an inconvenient
signature. Polling is what you use when the work genuinely leaves your process.

## Where this connects

- The three questions this chunk's waiting serves, and why two of them need no waiting:
  [07 · Async, scheduled and eventual](07-async-scheduled-and-eventual.md).
- Driving a scheduled job and an event listener without waiting for either:
  [07b · Scheduled jobs, events and retries](07b-scheduled-jobs-events-and-retries.md).
- Why a Java `Clock` cannot substitute for `jest.advanceTimersByTime`:
  [01c · Where the analogy breaks](01c-where-the-analogy-breaks.md).
- The eventual assertion at its most necessary — a broker delivering a message to a
  listener container: [08b · The container, poison messages and redelivery](08b-the-container-poison-messages-and-redelivery.md).
- `mockStatic`'s thread confinement, which the polling thread also trips over:
  [02b · When the collaborator is hard to mock](02b-when-the-collaborator-is-hard-to-mock.md).

## Gotchas

**★ `Thread.sleep` in a test is wrong at every duration simultaneously.**
Too short and it fails on a loaded CI runner; long enough to be safe there and it is dead time in every local run, multiplied by every async test. And it never fails *fast*: a sleep-then-assert test that will never pass still costs the full sleep. Awaitility's `untilAsserted` returns the microsecond the condition holds and gives up at a bound you chose.

**★ Polling a plain `boolean` can hang until timeout on a value that was set before you started waiting.**
Awaitility's own documentation disclaims responsibility: *"Awaitility does nothing to ensure thread safety or thread synchronization! This is your responsibility!"* There is no happens-before edge between the worker thread's write and the polling thread's read, so the read is free to keep returning the stale value. This failure is 100% reproducible on some machines and never seen on others, which is exactly the profile of a bug that gets marked "flaky" and retried forever. Use `AtomicBoolean` and `untilAtomic`/`untilTrue`.

**★ Awaitility's default timeout is ten seconds and its default poll delay is not zero.**
Ten seconds per failing async test is CI time you did not budget for; the poll delay means even a condition that is already true costs one interval before the first check. Set `atMost` on every call and `pollDelay(Duration.ZERO)` when the work may already be done.

**★ The poll runs on Awaitility's thread, so `@Transactional`, `SecurityContextHolder` and `RequestContextHolder` are all absent inside the lambda.**
`pollInSameThread()` exists precisely because the default is a different thread, and the javadoc labels it *"an advanced feature"*. The symptom is not a helpful error about threading — it is a lazy-loading failure, an access-denied, or an empty result from a query that works fine one line above the `await()`. Either opt in to same-thread polling (and add a JUnit `@Timeout`, since Awaitility then cannot interrupt a hang) or poll through something with no thread affinity.

**★ A `@Transactional` test that hands work to another thread hands it a row that does not exist yet.**
The test method's inserts live in an uncommitted transaction bound to the *test* thread. The async thread has its own connection and its own transaction, and under READ COMMITTED it cannot see uncommitted rows from another one. So the async code reads nothing, the Awaitility poll times out, and the failure looks like a race. It is not a race — it is isolation, and it will fail identically every time. Either commit before handing off (drop `@Transactional` on the test and clean up explicitly) or test the body directly.

**★ Replacing the executor with `SyncTaskExecutor` and then keeping the Awaitility wait around is a hidden always-passes test.**
With a synchronous executor the condition is already true on the first poll, so `await()` returns immediately and the assertion proves only that the method ran. That is fine if it is what you meant, and a trap if you inherited the test from someone who meant the concurrent version. If you install a synchronous executor, delete the waiting and make the test's synchronous intent visible in its code.

**★ A wait with no `alias` and no `failFast` produces the least useful failure message in the suite.**
Ten seconds later you learn that "condition was not fulfilled". You do not learn which condition, what the state actually was, or whether the system had already given up. `untilAsserted` fixes the second, `alias` fixes the first, and `failFast` fixes the third. All three are one method call each, and all three are added after the first 3am incident rather than before it.

**★ `Awaitility.setDefaultTimeout(...)` in a `@BeforeAll` is a global mutation that leaks across the whole JVM fork.**
The static setters are documented configuration, but Surefire runs many test classes in one JVM by default, so a default set by one class applies to every class that runs after it in that fork — including ones that relied on the ten-second default. Per-call `atMost` is verbose and correct; if you want the brevity, hold a configured `ConditionFactory` constant in the test class and reuse that instead of mutating global state.

**★ `ignoreExceptions()` will happily swallow the exception that was the actual bug.**
It is the right call when the condition legitimately throws while a system starts up, and the wrong call as a blanket habit — a `NullPointerException` inside your production code becomes an unexplained timeout instead of an immediate, informative failure. Prefer `ignoreExceptionsInstanceOf(...)` naming the one you expect.

**★ Retrying flaky tests at the build level is the anti-fix for everything on this page.**
Surefire and Gradle can both re-run failing tests. Turning that on for an async suite converts a diagnosable, reproducible timing bug into background noise, and it hides exactly the class of memory-visibility failure that Awaitility warns it does not protect you from. If a test needs a retry to pass, the wait is wrong, the synchronisation is wrong, or the test is asking three questions at once.

## Interview questions

**★ Why is `untilAsserted` preferred over `until` in Awaitility, given both wait for the same thing?**
Because of what happens when the wait fails, which is the only time you read the output. `until(Callable<Boolean>)` can only tell you that the condition was false for the whole window — the timeout message says the condition was not fulfilled, and you are left adding logging to find out what the state actually was. `untilAsserted(ThrowingRunnable)` runs a real assertion each poll, swallows the `AssertionError` while retrying, and on timeout surfaces the *last* one, so the failure reads "expected the receipt to be present but it was empty" and you can act on it without re-running anything. The secondary reason is that it composes with AssertJ, so the same assertions you use in synchronous tests work unchanged; you are not maintaining a boolean predicate that duplicates them.

**★ A colleague adds `Thread.sleep(2000)` to fix a flaky async test and it goes green. What is your response?**
That the test is now slower and still flaky, just at a lower rate — which is worse, because it will now fail once a fortnight in someone else's pull request. A sleep encodes a guess about the slowest machine that will ever run the suite, and CI runners under contention are slower than any guess. It also never fails fast: a genuinely broken async path still costs the full two seconds before the assertion runs. I would replace it with `await().atMost(...).untilAsserted(...)`, which returns as soon as the condition holds and bounds the failure case, and then I would look at *why* it was racing, because sometimes the real answer is that the test is polling an unsynchronised field — Awaitility's documentation is blunt that it *"does nothing to ensure thread safety"* — and a sleep only papers over that by making the stale read less likely, never impossible.

**★ When would you deliberately make asynchronous code run synchronously in a test?**
When the async hop is incidental to what I am testing. If I am checking that an order-confirmation flow persists three rows and publishes an event, the fact that one step is dispatched to an executor is noise that buys me a wait, a timeout and a flake risk. Installing a `SyncTaskExecutor` — documented as executing *"each task synchronously in the calling thread"* and explicitly offered for testing — removes the noise and keeps the wiring. What I would not do is treat that as a replacement for the asynchrony test: with a synchronous executor, every assertion about off-thread behaviour becomes vacuously true, so the one test that proves `@Async` is live has to run against the real executor. And I would delete any leftover Awaitility calls in the synchronous test, because a wait whose condition is already true on the first poll is a test that cannot fail for the reason its author thought.

**★ An eventual-consistency test times out in CI but passes locally and the code is unchanged. Where do you look first?**
Not at the timeout value, which is where everyone looks and where the fix is almost never right. First at whether the condition is reading thread-safe state, because Awaitility explicitly does not synchronise anything and CI machines have different core counts and memory-ordering behaviour than a developer laptop — a plain field written by a worker and read by the poll thread is allowed to look stale forever, and that difference is exactly the kind that shows up under a different JIT and a different load. Second at thread-bound context: the poll runs on Awaitility's own thread, so if the condition depends on the test's transaction, its security context or its request context, it is running blind, and a CI environment that is slower simply widens the window in which that is visible. Third at whether the system had already failed and the wait had no `failFast`, so I spent ten seconds waiting for something the dead-letter queue already had. Only after all three would I consider that the operation is genuinely slower on CI and the bound is too tight — and then I would raise the bound explicitly on that one test with an `alias` explaining why.

**★ How do you assert that something did *not* happen asynchronously?**
Carefully, because the naive version is unfalsifiable — asserting a row is absent immediately after the call passes trivially, since the async work may simply not have started. The honest version has a shape: wait for a *positive* signal that the processing is complete, then assert the absence. If the pipeline emits a "processed" marker, wait for the marker and then assert no duplicate. If there is no marker, Awaitility's `during(Duration)` — documented as awaiting that *"the predicate holds during at least timeout"* — lets you assert the condition stayed true for a bounded window, which is the strongest available statement and is explicitly probabilistic. I would also say out loud in review that this is the weakest kind of assertion in the suite and that adding an observable completion signal to the production code is worth more than any amount of cleverness in the test.

{/* FOOTER */}
