---
title: "Waiting correctly closes one gap and leaves three open — you can never wait your way to proving an absence, a test that fails only under load has usually found a real race in production code rather than acquired one, and a thread you forgot to shut down goes on failing other people's tests for the rest of the suite"
sidebar_label: "14f · Concurrency you cannot wait out"
sidebar_position: 54
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Parallel Execution"
> ([writing-tests/parallel-execution](https://docs.junit.org/6.0.3/writing-tests/parallel-execution.html))
> and the 6.0.x release notes ([release-notes](https://docs.junit.org/6.0.3/release-notes.html));
> javadoc for `java.util.concurrent.ExecutorService`
> ([ExecutorService](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ExecutorService.html))
> and `java.lang.Thread`
> ([Thread](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.html));
> the Awaitility 4.3.0 javadoc for `ConditionFactory`
> ([ConditionFactory](https://javadoc.io/doc/org.awaitility/awaitility/4.3.0/org/awaitility/core/ConditionFactory.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9, Awaitility 4.3.0.

**[14c](14c-timing-and-concurrency.md) is how to wait for asynchronous work without lying about
timing. This chunk is two things waiting cannot reach: assertions of *absence*, which no finite
wait establishes, and production races that the test exposes rather than causes — plus the
ordering assumptions that only fail once parallelism is switched on.** Threads and executors that
outlive the test that created them are [14g](14g-leaked-threads-and-executors.md). The machine
underneath is [14d](14d-environment.md); what to do with a flake once you have classified it is
[14e](14e-retry-is-not-a-fix.md).

## The thing you cannot poll for: proving something did *not* happen

`await()` proves a condition eventually holds. Nothing proves a condition never will.

```java
// 🔴 this asserts "no email was sent within 500ms", which is not what you meant
publisher.publish(new OrderPlaced("A-1"));
Thread.sleep(500);
verifyNoInteractions(mailer);
```

The test is green when the system is slow and red when the system is slow in a different way, and
it can never be right, because "no email was sent, ever" is not a statement any finite wait can
establish. Awaitility's `during(...)` — *"Await at the predicate holds during at least timeout"* —
lets you assert a predicate holds across a window, which is the same finite bet in better
clothing.

**Do this instead:** wait for a *positive* signal that the operation completed, then assert the
absence.

```java
CountDownLatch handled = new CountDownLatch(1);
handler.onComplete(handled::countDown);

publisher.publish(new OrderPlaced("A-1"));

assertTrue(handled.await(2, SECONDS), "handler did not complete");
verifyNoInteractions(mailer);   // now this is a claim about a finished operation
```

The absence is only meaningful relative to a completion you observed. If the handler has no
completion signal, add one — even a test-only counter — because otherwise the test genuinely
cannot be written, and pretending otherwise with a sleep produces a green build that asserts
nothing ([05b](05b-what-not-to-assert.md)).

## When the test is right and the code is racy

Some intermittent failures are not testing defects at all. The test is a concurrency probe that
happened to hit a window, and the correct response is to fix the production code. Recognising
this is the difference between deleting a valuable test and shipping a bug.

**The tell:** the test does not sleep, does not poll, and does not depend on another test — it
fails intermittently *under parallel execution or load only*, and the failure is a wrong value
rather than a timeout.

The usual production defects behind that shape:

| Defect | What it looks like |
|---|---|
| Check-then-act | `if (!map.containsKey(k)) map.put(k, v);` — use `computeIfAbsent` |
| Non-atomic compound op | `map.put(k, map.get(k) + 1)` — use `merge` or `compute` |
| Lazy init without a guard | a `private Foo cached;` populated on first call from any thread |
| `HashMap` shared across threads | corrupts internally under concurrent resize |
| Non-`volatile` stop flag | JLS §17.3, quoted in [14c](14c-timing-and-concurrency.md) — the write may never be observed |
| Shared `SimpleDateFormat` | documented as not thread-safe; use `DateTimeFormatter`, which is |
| A read outside the lock that the writes hold | half-published object state |
| `getAndSet` split into a get and a set | use the `Atomic*` compound methods |
| Two `ConcurrentHashMap` calls that needed to be one | `containsKey` then `get` is not atomic even on a concurrent map |

**Do not "stabilise" the test.** Adding a retry, a sleep, or `@Execution(SAME_THREAD)` to a test
that exposed a real race removes the only warning you were going to get. Fix the code; keep the
test; if it is slow to reproduce, `@RepeatedTest(value = 500, failureThreshold = 1)`
([14](14-flaky-tests.md)) turns it into a reproduction you can iterate against — with
`@Execution(SAME_THREAD)` on the repetition, as the guide requires.

⚠️ The mirror image of this section is [14g](14g-leaked-threads-and-executors.md): a failure that
looks like a race in the code under test but is actually a thread from an *earlier* test still
running. The distinguishing question is whether the offending work could have been started by
this test at all.

## Ordering assumptions under parallel execution

Jupiter's parallel executor does not guarantee that two tests observe each other's effects in any
order, and it does not guarantee that one class's `@BeforeAll` precedes anything in another class.
Every assumption of the form "by the time this runs, that has happened" becomes a flake the day
parallelism is switched on.

The mechanism is argued elsewhere in this topic and is not repeated here:
[12](12-parallel-execution.md) for the two switches, [12b](12b-parallelism-configuration.md) for
the pool, [12c](12c-resource-locks.md) for `@ResourceLock`,
[12d](12d-dynamic-locks-and-isolation.md) for `@Isolated`,
[12e](12e-shared-state-under-parallelism.md) for the catalogue of what breaks,
[12f](12f-diagnosing-a-parallel-failure.md) for diagnosis. Ordering *without* parallelism —
`@Order`, class orderers, and why needing an order is a smell — is
[11](11-execution-order.md) through [11d](11d-when-order-is-a-smell.md).

🔴 The one judgement to carry over: **a `@ResourceLock` contains a flake, it does not fix one.**
It says "these tests may not run together" and buys determinism back at the cost of parallelism,
permanently. That is the right answer when the shared resource is genuinely global — the default
time zone, a fixed port, `System.out` — and the wrong answer when the shared resource is a
`static` field you could have made an instance field.
[12e](12e-shared-state-under-parallelism.md) draws that line.

⚠️ Nothing in `@ResourceLock`, `@Isolated` or the parallel configuration parameters changed
between Jupiter 5.x and 6.0.3 in a way the 6.0.x release notes record; the only entry touching
them is a 6.0.2 fix, *"Allow using `@ResourceLock` on classes annotated with `@ClassTemplate` (or
`@ParameterizedClass`)."* Treat 5.x guidance on locking as current for this stack.

## Gotchas

**★ Using `await()` — or a sleep — to prove something did not happen.**
No finite wait establishes an absence. Wait for a positive completion signal and assert the
absence relative to it; if there is no signal, add one rather than guessing at a duration.

**★ `Awaitility.during(...)` as a rigorous version of a sleep.**
It asserts the predicate holds across a window, which is still a bet on a duration. Defensible
when the window is part of the specification ("the circuit stays open for 30 s"); not otherwise.

**★ "Stabilising" a test that has found a real race.**
A test that fails only under parallelism, with a wrong value rather than a timeout, has probably
found a check-then-act or a missing `volatile` in production code. Adding a sleep, a retry or
`SAME_THREAD` deletes the warning and keeps the bug.

**★ Believing a `ConcurrentHashMap` makes a compound operation atomic.**
Each individual call is atomic; `containsKey` followed by `get`, or `get` followed by `put`, is
not. The atomic compound methods — `computeIfAbsent`, `merge`, `compute`, `putIfAbsent` — exist
precisely for this, and a test that exposes the gap has done its job.

**★ Reaching for `@ResourceLock` before checking whether the resource had to be shared.**
A lock serialises tests forever. If the "resource" is a `static` field that could have been an
instance field, the lock pays a permanent throughput cost to preserve a design defect.

## Interview questions

**★ How do you test that an event does *not* trigger an email?**
You cannot poll for an absence, so anchor it to a completion you can observe. Wait for a positive
signal that the operation finished — a latch counted down by the handler, a status that becomes
`PROCESSED` — and only then assert `verifyNoInteractions(mailer)`. Without that anchor the test is
asserting "no email within N milliseconds", which is a timing coincidence rather than a behaviour,
and it fails the day CI is busy. If the handler exposes no completion signal at all, the test
cannot be written honestly and the right change is to the production code.

**★ A test only fails when parallel execution is on. Is that the test's fault?**
Not necessarily, and the distinction is the important part. If it fails with a timeout or a
"not there yet", it is probably a waiting problem in the test. If it fails with a *wrong value* —
a count one short, a null where an object should be — the test has probably exposed a real race in
production code: a check-then-act, a non-atomic compound operation on a map, a lazily initialised
field, a non-`volatile` flag. Then the fix belongs in the production code and the test is the most
valuable one you own; serialising it with `@ResourceLock` or `SAME_THREAD` would hide a shipping
bug.

**★ Is `@ResourceLock` a fix for a flaky test?**
It is a containment. It tells the engine two tests may not run concurrently, which restores
determinism at the price of parallelism, permanently. That is the right call when the shared thing
is genuinely global to the JVM — the default locale, `System.out`, a fixed port — because there is
nothing to redesign. It is the wrong call when the shared thing is a `static` field that could
have been an instance field, because then you are paying throughput forever to preserve a design
defect you could have deleted.

{/* FOOTER */}
