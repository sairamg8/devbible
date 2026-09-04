---
title: "The third family of flakes is waiting: a test asserts on work another thread has not finished, and Thread.sleep does not fix it because the JLS says sleep has no synchronization semantics at all — so the number you tuned buys you nothing but a slower suite"
sidebar_label: "14c · Timing and concurrency"
sidebar_position: 53
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Java Language Specification, Java SE 25 Edition — §17.3
> "Sleep and Yield" ([jls-17.html](https://docs.oracle.com/javase/specs/jls/se25/html/jls-17.html));
> the JUnit 6.0.3 User Guide — "Timeouts"
> ([writing-tests/timeouts](https://docs.junit.org/6.0.3/writing-tests/timeouts.html));
> the Awaitility 4.3.0 javadoc for `ConditionFactory` and `Awaitility`
> ([ConditionFactory](https://javadoc.io/doc/org.awaitility/awaitility/4.3.0/org/awaitility/core/ConditionFactory.html))
> and the Awaitility usage wiki
> ([awaitility/wiki/Usage](https://github.com/awaitility/awaitility/wiki/Usage)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9, Awaitility 4.3.0.

**Everything in [14](14-flaky-tests.md) and [14b](14b-time-and-determinism.md) is state you can
see if you look. This family is different: the test and the code are each correct in isolation
and the failure lives in the gap between "I called the method" and "the effect is observable".
This chunk is how to close that gap — deterministically where you can, with a bounded wait where
you cannot, and never with a sleep, for a reason that is written into the language
specification.** The concurrency problems that no amount of correct waiting solves — proving an
absence, races the test merely exposes, ordering under parallel execution, threads leaked between
tests — are [14f](14f-concurrency-you-cannot-wait-out.md). The machine underneath is
[14d](14d-environment.md).

## Asynchrony breaks a test in two independent ways

Confusing them is why "add another 200 ms" keeps not working.

**1 · The work has not finished.** Your thread reached the assertion before the other thread
reached the write. This is a *scheduling* problem, and it is the one everybody thinks about.

**2 · The work has finished and you cannot see it.** The other thread wrote the field; your
thread is allowed to read a stale value, indefinitely, unless a happens-before edge connects the
two. This is a *memory model* problem and no amount of waiting fixes it.

A `CountDownLatch`, a `Future`, a `synchronized` block, a `volatile` read and an
`ExecutorService` shutdown all establish the edge. `Thread.sleep` does not.

## 🔴 Why `Thread.sleep` is not a small sin

[13d](13d-what-a-timeout-is-for.md) makes the practical case — a sleep is simultaneously too slow
on a fast machine and too short on a loaded one, and the number in it encodes nothing anybody can
review. The specification makes a harder one. JLS SE 25 §17.3:

> *"It is important to note that neither `Thread.sleep` nor `Thread.yield` have any
> synchronization semantics. In particular, the compiler does not have to flush writes cached in
> registers out to shared memory before a call to `Thread.sleep` or `Thread.yield`, nor does the
> compiler have to reload values cached in registers after a call to `Thread.sleep` or
> `Thread.yield`."*

And the specification's own broken example is, exactly, a polling loop:

> *"For example, in the following (broken) code fragment, assume that `this.done` is a
> non-`volatile` boolean field:"*

```java
while (!this.done)
    Thread.sleep(1000);
```

> *"The compiler is free to read the field `this.done` just once, and reuse the cached value in
> each execution of the loop. This would mean that the loop would never terminate, even if
> another thread changed the value of `this.done`."*

So a test that sleeps and then reads a plain field is not "probably fine, just slow". It is a
program with no ordering constraint between the write and the read, whose observed behaviour
depends on what the JIT decided to do that run — which is precisely a flake that appears after an
unrelated commit changes inlining.

**The consequence for your test:** if you sleep, you must *also* read through something that
carries the edge — a `volatile` field, a concurrent collection, a `Future`, a database round
trip. Most tests accidentally do (a JDBC call or a `ConcurrentHashMap` read is a synchronisation
point), which is why the bug hides. Do not rely on the accident.

## The ladder: deterministic first, bounded second, timed never

### Rung 1 — make the boundary synchronous in the test

The best async test is not async. If the seam is injectable, inject a direct executor:

```java
// production wiring: Executors.newFixedThreadPool(4)
// test wiring:
NotificationService service = new NotificationService(Runnable::run);
```

`Runnable::run` satisfies `Executor` and runs the task on the calling thread. Now the test is
straight-line code with no waiting, no timeout and no polling — and you have *stopped testing the
threading*, which is correct, because the thread pool is not the behaviour you were asserting on.

⚠️ It is a real trade: you no longer exercise the concurrent path at all. That is a deliberate
split — most tests assert on the work, and a small number of tests assert on the concurrency,
using the real executor.

### Rung 2 — wait on a signal the code already gives you

If the code under test can tell you it is done, wait on that. The JUnit guide raises this before
it mentions any library:

> *"In some cases you can rewrite the logic to use a `CountDownLatch` or another synchronization
> mechanism, but sometimes that is not possible…"*

```java
@Test
@Timeout(5)
void publishesEvent() throws InterruptedException {
    CountDownLatch received = new CountDownLatch(1);
    eventBus.subscribe(event -> received.countDown());

    publisher.publish(new OrderPlaced("A-1"));

    assertTrue(received.await(2, SECONDS), "no event within 2s");
    assertThat(store.find("A-1")).isPresent();
}
```

`CountDownLatch.await` returns the instant the count reaches zero, and `countDown` happens-before
a returning `await` — the memory edge comes free. Note the `assertTrue` on the boolean result:
`await(timeout, unit)` returns `false` on timeout rather than throwing, and a test that ignores
the return value silently continues on a wait that never succeeded.

The same shape applies to `CompletableFuture<Void> f` — `f.get(2, SECONDS)` — and to
`executor.awaitTermination(...)` after `shutdown()`.

### Rung 3 — poll with a bound

When the subject gives you no signal — it wrote to a broker, a database, another process —
polling is the honest fallback. Boot 4.1.0 manages **Awaitility 4.3.0**:

```java
service.sendAsync(message);

await().atMost(Duration.ofSeconds(5))
       .untilAsserted(() -> assertThat(repository.findAll()).hasSize(1));
```

[13d](13d-what-a-timeout-is-for.md) carries the API surface, the defaults and the
`until`-versus-`untilAsserted` argument. Three things belong here instead, because they are about
concurrency rather than about waiting.

**`dontCatchUncaughtExceptions()` and what it implies about the default.** From the `Awaitility`
javadoc for `catchUncaughtExceptionsByDefault()`:

> *"Instruct Awaitility to catch uncaught exceptions from other threads by default. This is
> useful in multi-threaded systems when you want your test to fail regardless of which thread
> throwing the exception. Default is `true`."*

That default is doing more work than people realise. **JUnit fails a test when an exception
escapes on the test's own thread and on no other thread** — an exception thrown inside a task you
submitted to an executor goes to that thread's uncaught-exception handler and, in the case of
`ExecutorService.submit`, into a `Future` nobody reads. Your test does not fail; it times out, or
worse, passes because the assertion it made was about something else. Awaitility catching those
exceptions is often the only reason you find out at all.

**`pollInSameThread()`**, from the 4.3.0 javadoc:

> *"Instructs Awaitility to execute the polling of the condition from the same as the test. This
> is an advanced feature and you should be careful when combining this with conditions that wait
> forever (or a long time) since Awaitility cannot interrupt the thread when it's using the same
> thread as the test."*

You need it whenever the condition reads `ThreadLocal`-bound state — a Spring-managed transaction
or `EntityManager`, a `SecurityContext`, an MDC. By default the condition runs on Awaitility's own
poll thread, which has none of that, so the condition sees an empty security context or opens its
own transaction and never observes the test's uncommitted data. Same failure family as
`assertTimeoutPreemptively` ([13b](13b-thread-modes.md)), same cause.

**`failFast(...)`** exists so a poll can stop early on a terminal state instead of burning the
whole `atMost`:

```java
await().atMost(Duration.ofSeconds(30))
       .failFast("job entered FAILED", () -> job.status() == FAILED)
       .untilAsserted(() -> assertThat(job.status()).isEqualTo(COMPLETED));
```

⚠️ The 4.3.0 javadoc for `failFast(Callable<Boolean>)` contradicts itself in one sentence — it
says *"If the supplied `Callable` ever returns false, it indicates our condition will never be
true"* and then *"Throws a `TerminalFailureException` if fail fast condition evaluates to
`true`."* **I could not settle from the documentation which polarity is correct**, so verify it
against the behaviour you observe before relying on the sense of the predicate. The `failFast`
overload taking a `ThrowingRunnable` assertion is unambiguous — it fires when the assertion
throws — and is the safer one to reach for.

### The rung that does not exist

There is no rung for `Thread.sleep`. If none of the three above apply, the code under test has no
observable completion, and that is a design defect in the code, not a testing problem.

And there is a whole class of question the ladder cannot answer at all — *did this event fail to
trigger an email?* — because no finite wait establishes an absence. That, and the races a test
exposes rather than causes, is [14f](14f-concurrency-you-cannot-wait-out.md).

## Gotchas

**★ Adding milliseconds to a `Thread.sleep` until CI goes green.**
You are tuning a number against one agent's load on one day. The next agent, or the same agent
with a co-tenant, restores the failure — and per JLS §17.3 the sleep never established the memory
ordering you needed anyway.

**★ Sleeping and then reading a plain, non-`volatile` field.**
The JLS's own broken example. The compiler may hoist the read out of the loop entirely. Read
through something with synchronisation semantics, or use a latch.

**★ Ignoring the return value of `CountDownLatch.await(timeout, unit)`.**
It returns `false` on timeout instead of throwing, so the test carries on as if the event
happened and fails later with a confusing assertion. Assert on the boolean with a message.

**★ Ignoring the `Future` returned by `ExecutorService.submit`.**
An exception thrown inside the task is captured into the `Future` and is thrown only when you
call `get()`. Nobody calls `get()`, so the failure is invisible and the test passes for the wrong
reason. Call `get()`, or submit with `execute` so the exception reaches the uncaught handler.

**★ Assuming JUnit fails a test when a background thread throws.**
It does not. Jupiter fails a test on a throwable that escapes on the test's own thread. Anything
thrown on a pool thread is the pool's problem, and the default `ThreadPoolExecutor` behaviour is
to log or discard it depending on how it was submitted.

**★ Polling a condition that reads `ThreadLocal` state without `pollInSameThread()`.**
Awaitility polls on its own thread by default, which has no transaction, no `SecurityContext` and
no MDC. The condition sees a different world than the test does and never becomes true. Same
root cause as `assertTimeoutPreemptively` ([13b](13b-thread-modes.md)).

**★ Leaving Awaitility's default 10-second timeout implicit in a suite of a thousand tests.**
Ten seconds is not the cost — ten seconds *per failing assertion under a broken build* is. State
`atMost` and pick a number you would defend in review.

**★ `ignoreExceptions()` on the whole condition.**
It swallows the `NullPointerException` in your own test lambda as happily as the connection
refused you meant to tolerate, and you get a timeout instead of a diagnosis. Name the exception:
`ignoreException(ConnectException.class)`.

**★ Testing the executor instead of the behaviour.**
Most tests of asynchronous code do not care that a pool was involved. Injecting `Runnable::run`
makes them synchronous and deterministic; keep a small, deliberate set of tests that use the real
executor to cover the concurrency itself.

## Interview questions

**★ Why is `Thread.sleep` before an assertion wrong even if the sleep is long enough?**
Because length is not the only thing missing. JLS SE 25 §17.3 states that neither `Thread.sleep`
nor `Thread.yield` has any synchronization semantics: the compiler need not flush writes before
the sleep or reload cached values after it. So a test that sleeps and then reads a plain field has
no happens-before edge between the other thread's write and its own read, and is entitled to see a
stale value forever. The specification's own example of broken code is a `while (!done)
Thread.sleep(...)` loop. Practically, the sleep also wastes time when the system is fast and is
insufficient when it is loaded — but the memory-model point is the one that survives tuning.

**★ You have to test that a message handler eventually writes a row. Walk me through your
options in order.**
First, try to remove the asynchrony: if the executor is injectable, inject `Runnable::run` in the
test and the whole thing becomes straight-line code. Second, if the code exposes a completion
signal — a callback, a `CompletableFuture`, an `ExecutorService` you can shut down and await —
wait on that, because it is instant and carries the memory edge for free. Third, if the subject
gives you nothing (it published to a broker, another process consumes it), poll with a bound:
`await().atMost(...).untilAsserted(...)`, plus a larger `@Timeout` on the method as a backstop.
There is no fourth option; `Thread.sleep` is not a rung on that ladder.

**★ What does `pollInSameThread()` do and when do you need it?**
By default Awaitility evaluates the condition on its own thread. If the condition reads
`ThreadLocal`-bound state — a Spring transaction and its `EntityManager`, a `SecurityContext`, an
MDC — that thread has none of it, so the condition either fails to authenticate or opens a fresh
transaction that cannot see the test's uncommitted rows, and the wait times out for a reason that
looks nothing like the cause. `pollInSameThread()` moves polling onto the test thread. The
javadoc's own caveat is that Awaitility can then no longer interrupt the wait, so pair it with a
framework-level timeout.

**★ Does JUnit fail a test if a thread it started throws an exception?**
No. Jupiter reports a test as failed when a `Throwable` propagates out of the test method on the
test's own thread. An exception on a pool thread goes to that thread's uncaught-exception handler,
and if the task was submitted via `submit` it is captured into a `Future` and never surfaces at
all unless someone calls `get()`. This is why asynchronous tests so often fail as timeouts rather
than as the actual error — and why Awaitility catching uncaught exceptions from other threads by
default is more useful than it first appears.

{/* FOOTER */}
