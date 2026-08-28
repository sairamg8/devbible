---
title: "A timeout is a blunt instrument — it can only say \"too slow\", never \"wrong\", and every attempt to use it as a performance assertion produces a test that fails on a busy CI agent — so its one real job is stopping a hang, and Awaitility is what you actually wanted when you reached for Thread.sleep"
sidebar_label: "13d · What a timeout is for"
sidebar_position: 50
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Timeouts"
> ([writing-tests/timeouts](https://docs.junit.org/6.0.3/writing-tests/timeouts.html));
> the Awaitility documentation
> ([awaitility/wiki/Usage](https://github.com/awaitility/awaitility/wiki/Usage)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8, Awaitility 4.3.0.

**[13](13-timeouts.md), [13b](13b-thread-modes.md) and [13c](13c-timeout-configuration.md) are
the mechanism. This is the judgement: a timeout is a very poor assertion and a very good safety
net, and almost every misuse comes from confusing the two.**

## What a timeout can and cannot say

A timeout produces exactly one bit of information: *this took longer than N*. It cannot say the
answer was wrong, that the system was slow for a reason worth knowing, or that the code would
have finished in N+1.

That makes it useless as a performance assertion, for a reason that is structural rather than a
matter of tuning. The elapsed time of a test method depends on the CI agent's hardware, on what
else is running on it, on the degree of parallelism ([12b](12b-parallelism-configuration.md)),
on JIT warm-up, on whether a GC pause landed inside the window, and on disk and network. A
threshold tight enough to catch a genuine regression is inside that noise, so it fires on noise.
A threshold loose enough not to fire on noise cannot catch a regression.

**`@Timeout(2)` on a method you believe takes 50 ms is not a performance test. It is a hang
detector with an alarming number written on it.** That is fine — say so, and stop pretending the
number means anything.

If you want to know how fast something is, you want a benchmark harness (JMH) with warm-up,
repetition and statistics, run somewhere quiet. A test method run once on a shared agent produces
one sample of a noisy distribution.

## What it is genuinely for

**Stopping a hang.** A test that blocks forever blocks the suite forever, and the pipeline's own
timeout eventually kills the job with no test report at all — you get "the build timed out after
an hour" and no idea which test. `@Timeout` converts that into a named failing test with, if you
enabled it, a thread dump ([13c](13c-timeout-configuration.md)). That alone justifies a global
default.

**Bounding a poll.** The documented use, and the only case where the number has real meaning: an
upper bound on how long you are prepared to wait for something asynchronous
([below](#polling-and-awaitility)).

**Catching an accidental infinite loop** in code under development, before it reaches CI.

Three uses, and all three are about *termination*, not about speed.

## Polling and Awaitility

The guide's own framing of the async problem:

> *"When dealing with asynchronous code, it is common to write tests that poll while waiting for
> something to happen before performing any assertions. In some cases you can rewrite the logic
> to use a `CountDownLatch` or another synchronization mechanism, but sometimes that is not
> possible — for example, if the subject under test sends a message to a channel in an external
> message broker and assertions cannot be performed until the message has been successfully sent
> through the channel. Asynchronous tests like these require some form of timeout to ensure they
> don't hang the test suite by executing indefinitely, as would be the case if an asynchronous
> message never gets successfully delivered."*

Note the first sentence of the answer: **if you can use a `CountDownLatch`, do that instead.**
A latch is deterministic — the test proceeds the instant the thing happens, with no polling and
no timing at all. Polling is the fallback for when the code under test gives you no signal to
wait on.

The documented polling pattern:

```java
@Test
@Timeout(5) // Poll at most 5 seconds
void pollUntil() throws InterruptedException {
    while (asynchronousResultNotAvailable()) {
        Thread.sleep(250); // custom poll interval
    }
    // Obtain the asynchronous result and perform assertions
}
```

That works, and the guide immediately points past it:

> *"If you need more control over polling intervals and greater flexibility with asynchronous
> tests, consider using a dedicated library such as Awaitility."*

### 🔴 `Thread.sleep` racing a real condition

The pattern the polling loop replaces is the single most common flake in Java test suites:

```java
// 🔴 the bug
service.sendAsync(message);
Thread.sleep(500);
assertThat(repository.findAll()).hasSize(1);
```

Everything is wrong with it. **On a fast machine 500 ms is 450 ms of wasted suite time**, paid on
every run forever. **On a loaded CI agent 500 ms is not enough** and the test fails for no reason
anybody can act on. And the number encodes nothing: it is not a requirement, not a measurement,
and nobody will ever know whether it is safe to change.

A sleep asserts "the thing happens within exactly this long", which is never what you meant. You
meant "the thing happens".

### What Awaitility does instead

Boot 4.1.0 manages **Awaitility 4.3.0**. It replaces the sleep with a polled condition and a
bound:

```java
service.sendAsync(message);

await().atMost(5, SECONDS)
       .untilAsserted(() -> assertThat(repository.findAll()).hasSize(1));
```

Fast when it is fast — it returns as soon as the condition holds — and it fails with a stated
bound when it does not. The API surface worth knowing:

```java
// simplest form: a boolean condition
await().until(() -> userRepository.size() == 1);

// a supplier plus a matcher
await().until(userRepository::size, equalTo(3));

// an assertion that must eventually pass — the AssertJ-friendly form
await().atMost(5, SECONDS)
       .untilAsserted(() -> assertThat(fakeRepository.getValue()).isEqualTo(1));

// tuning the polling
with().pollInterval(100, MILLISECONDS)
      .and().pollDelay(20, MILLISECONDS)
      .await().until(customerStatus(), equalTo(REGISTERED));

// a lower bound as well as an upper one
await().atLeast(1, SECONDS).and().atMost(2, SECONDS)
       .until(value(), equalTo(1));

// tolerate exceptions while the system settles
given().ignoreExceptions().await().until(() -> someCondition());
```

The defaults, in the project's own words:

> *"If you don't specify any timeout Awaitility will wait for 10 seconds"*

before throwing `ConditionTimeoutException`, and

> *"the poll interval and poll delay are 100 milliseconds."*

⚠️ **`untilAsserted` is the form to reach for** when the check is an assertion rather than a
boolean, because the failure message is your assertion's message — the AssertJ diff
([02 · AssertJ](../02-assertj/README.md)) — instead of "condition was not fulfilled". A boolean
`until` that times out tells you nothing about *why*.

⚠️ **`atLeast` is a trap disguised as rigour.** Asserting that something takes *at least* a
second is asserting a timing lower bound, which is the performance-assertion problem in the other
direction. Use it only when the delay is a specified behaviour, not to prove that work happened.

### Keep the `@Timeout` as well

Awaitility bounds the wait it knows about. It does not bound the rest of the method. A
`@Timeout` on the test and an `await().atMost(...)` inside it are complementary: the annotation is
the backstop for the whole method, the `atMost` is the meaningful bound on the specific wait.
Give the annotation the larger number.

## Gotchas

**★ Using `@Timeout` as a performance assertion.**
Elapsed time on a shared CI agent is noise: hardware, co-tenants, parallelism, JIT warm-up, GC. A
threshold tight enough to catch a regression fires on noise; one loose enough not to fire catches
nothing. Benchmark with JMH; use timeouts to catch hangs.

**★ `Thread.sleep` before an assertion.**
Slow when the system is fast, and insufficient when it is loaded. It asserts a timing
coincidence rather than a behaviour, and the number in it means nothing to whoever reads it next.
Replace with `await().atMost(...).untilAsserted(...)`.

**★ Reaching for Awaitility when a `CountDownLatch` would do.**
The guide says so first: if the code under test can signal you, wait on the signal. That is
deterministic and instant. Polling is the fallback for code that gives you nothing to wait on.

**★ `await().until(booleanCondition)` where the failure message matters.**
A timed-out boolean condition reports that it was not fulfilled and nothing else. `untilAsserted`
with a real assertion inside gives you the assertion's own failure message, which is the
difference between a two-minute diagnosis and an afternoon.

**★ Relying on Awaitility's default 10-second timeout.**
It is a default, not a decision. State `atMost` explicitly so the number is reviewable and so a
reader knows whether ten seconds was chosen or inherited.

**★ Using `atLeast` to prove work happened.**
It asserts a timing lower bound, which is as machine-dependent as an upper bound. Assert on the
observable effect instead — unless a minimum delay is genuinely part of the specification.

**★ Dropping `@Timeout` because Awaitility has `atMost`.**
`atMost` bounds one wait. Anything else in the method — a slow query, a retry loop, a lock — is
unbounded. Keep a generous `@Timeout` as the method-level backstop.

**★ `ignoreExceptions()` used broadly.**
It is right while a system is starting and a connection legitimately fails. Applied to the whole
condition it also swallows the `NullPointerException` in your own test code, and the test times
out instead of telling you what broke. Prefer `ignoreException(SomeSpecific.class)`.

**★ A polling interval far shorter than the operation.**
Polling every millisecond for something that takes a second is a thousand pointless calls,
several of them contending with the very system you are waiting for. Awaitility's 100 ms default
is a sensible starting point.

**★ Treating a timeout failure as a flake.**
A `@Timeout` firing means something did not terminate. That is a defect report, not a retry
candidate ([14 · flaky tests](14-flaky-tests.md)) — and with
`junit.jupiter.execution.timeout.threaddump.enabled` it comes with the evidence attached.

## Interview questions

**★ Why is `@Timeout` a poor performance assertion?**
Because the elapsed time of a test on a shared machine is dominated by things unrelated to the
code: hardware, co-tenancy, degree of parallelism, JIT warm-up, GC pauses. A threshold tight
enough to detect a real regression sits inside that noise and fires on it; one loose enough to be
stable catches nothing. Use a benchmark harness for performance and reserve timeouts for
termination.

**★ What is `@Timeout` genuinely for?**
Preventing a hang from consuming the whole pipeline, bounding a poll for something asynchronous,
and catching an accidental infinite loop. All three are about termination. Its value is that a
hung test becomes a named failure with a thread dump instead of a build that dies after an hour
with no report.

**★ What is wrong with `Thread.sleep(500)` before an assertion?**
It is both too slow and too fast. On a quick machine it wastes 450 ms of suite time on every run
forever; on a loaded agent 500 ms is not enough and the test fails for reasons nobody can act on.
It asserts that the thing happens within exactly that long, which is never the intent — you meant
"the thing happens". `await().atMost(...).untilAsserted(...)` returns as soon as it is true and
fails with a stated bound when it is not.

**★ When should you use a `CountDownLatch` rather than Awaitility?**
Whenever the code under test can signal completion. The JUnit guide raises this first: a latch is
deterministic, the test proceeds the instant the event occurs, and there is no polling and no
timing involved at all. Polling is the fallback for a subject that gives you nothing to wait on —
the guide's example is a message crossing an external broker.

**★ `until` or `untilAsserted`?**
`untilAsserted` whenever the check is an assertion, because on timeout you get the assertion's own
failure message — the actual-versus-expected diff — instead of a bare "condition was not
fulfilled". `until` with a boolean is fine for a simple state check where the condition's name
already explains what was expected.

**★ Should a test that uses Awaitility still carry `@Timeout`?**
Yes, with a larger value. `atMost` bounds the specific wait; the annotation bounds the whole
method, including everything Awaitility knows nothing about — a slow query, a retry, a lock. The
two are backstops at different levels, not alternatives.

{/* FOOTER */}
