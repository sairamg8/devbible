---
title: "timeout exits the moment the verification passes and after always waits the full duration, which is why after(100).never() is a real assertion and timeout(100).never() is one that is satisfied instantly — and why Mockito's own javadoc tells you to find a better way of testing concurrency"
sidebar_label: "05c · Async verification"
sidebar_position: 18
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> section 22 (*"Verification with timeout"*) of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> and the `timeout(long)` and `after(long)` method javadocs on the same class, including the
> *"timeout() vs. after()"* comparison.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3, Awaitility 4.3.0. **No sandbox** — this page carries
> Java source, never a fabricated test run.

**Mockito has two verification modes that wait: `timeout` and `after`. They differ in exactly one
respect and that respect decides whether your test is fast and correct, slow and correct, or
green for a reason that has nothing to do with the behaviour. Mockito documents both while
telling you not to need them, and that advice is the most useful part of the feature. This chunk
continues [05 · Verification](05-verification.md).**

## `timeout` and `after`

Both let a verification wait for an interaction that has not happened yet. Section 22 opens with
a warning:

> *"Allows verifying with timeout. It causes a verify to wait for a specified period of time for a
> desired interaction rather than fails immediately if had not already happened. May be useful for
> testing in concurrent conditions."*
>
> *"This feature should be used rarely - figure out a better way of testing your multi-threaded
> system."*
>
> *"Not yet implemented to work with InOrder verification."*

```java
//passes when someMethod() is called no later than within 100 ms
//exits immediately when verification is satisfied (e.g. may not wait full 100 ms)
verify(mock, timeout(100)).someMethod();
//above is an alias to:
verify(mock, timeout(100).times(1)).someMethod();

//passes as soon as someMethod() has been called 2 times under 100 ms
verify(mock, timeout(100).times(2)).someMethod();

//equivalent: this also passes as soon as someMethod() has been called 2 times under 100 ms
verify(mock, timeout(100).atLeast(2)).someMethod();
```

### 🔴 Which modes each one offers — and why they differ

`VerificationWithTimeout` and `VerificationAfterDelay` are separate interfaces with deliberately
different method sets:

| Mode | `timeout(n).…` | `after(n).…` |
|---|---|---|
| `times(k)` | yes | yes |
| `atLeastOnce()` | yes | yes |
| `atLeast(k)` | yes | yes |
| `only()` | yes | yes |
| `never()` | 🔴 **absent** | yes |
| `atMostOnce()` | 🔴 **absent** | yes |
| `atMost(k)` | 🔴 **absent** | yes |

The reason is in the `VerificationWithTimeout` javadoc:

> *"This is similar to `after()` except this assertion will immediately pass if it becomes true at
> any point, whereas after() will wait the full period. Assertions which are consistently expected
> to be initially true and potentially become false are deprecated below, and after() should be
> used instead."*

An upper bound — `never`, `atMost` — is true at t=0 and can only *become* false. A mode that
exits as soon as it is satisfied would return immediately every time, proving nothing. So they
are simply not offered on `timeout`.

### 🔴 The one difference

> ***timeout() vs. after()***
> - *"timeout() exits immediately with success when verification passes"*
> - *"after() awaits full duration to check if verification passes"*

```java
//1.
mock.foo();
verify(mock, after(1000)).foo();
//waits 1000 millis and succeeds

//2.
mock.foo();
verify(mock, timeout(1000)).foo();
//succeeds immediately
```

That difference decides which one is correct for what you are asserting:

- **`timeout(n)` is for "this will happen, eventually, within n ms."** It is a *positive* claim.
  It is as fast as the system under test, and it is the right default.
- **`after(n)` is for "the state at n ms is X."** It always costs the full duration, and it is
  the only one that can express a *negative* claim over a window: `verify(mock, after(100).never()).foo()`
  — *"passes if someMethod() has not been called, as tested after 100 millis"*. `timeout(100).never()`
  would be satisfied by "not called yet", which is true at t=0.

`after` also supports an exact count over the window — *"passes if someMethod() is called
**exactly** 2 times, as tested after 100 millis"* — which `timeout` cannot, because it returns at
the moment the count is reached and cannot know a third call is coming.

⚠️ Both are wall-clock waits, so both make the suite slower and both are sensitive to a loaded CI
machine. Awaitility (4.3.0 under Boot 4.1) is the more expressive tool for the polling case, and
a deterministic design — a latch, an injected executor you run inline, a callback the test
supplies — beats both.

## What to do instead

The javadoc's advice — *"figure out a better way of testing your multi-threaded system"* — is
concrete once you look at what makes the test need to wait at all.

**Run the async work inline.** If the class takes an `Executor`, pass `Runnable::run` in the
test. The submission becomes synchronous and no verification needs to wait:

```java
OrderService service = new OrderService(gateway, Runnable::run);   // direct executor

service.payAsync(order);

verify(gateway).charge(order);       // no timeout needed — it already happened
```

**Await a latch the collaborator releases.** When the work genuinely has to happen on another
thread, make the mock signal:

```java
CountDownLatch published = new CountDownLatch(1);
doAnswer(inv -> { published.countDown(); return null; })
    .when(publisher).publish(any());

service.confirmAsync(order);

assertThat(published.await(2, SECONDS)).isTrue();
verify(publisher).publish(assertArg(e -> assertThat(e.orderId()).isEqualTo(ORDER_ID)));
```

The latch's timeout is a *safety net* — it only fires when something is broken — rather than a
number the passing path waits for. That is the difference between a two-second budget you never
spend and a two-second cost on every run.

**Use Awaitility for the polling case.** Boot 4.1 manages Awaitility 4.3.0. It expresses "keep
checking until this holds, or fail after N" with a condition rather than a fixed sleep, and its
failure message describes the condition. It is still wall-clock polling, so the ordering above
still applies: inline executor, then latch, then Awaitility, then `timeout`, and `after` only for
a negative claim over a window.

## Gotchas

**★ Looking for `timeout(100).never()`.**
It does not exist — `VerificationWithTimeout` declares only `times`, `atLeastOnce`, `atLeast` and
`only`. The javadoc explains the omission: *"Assertions which are consistently expected to be
initially true and potentially become false are deprecated below, and after() should be used
instead."* A "never" claim would be satisfied the instant it was evaluated, so it is
`after(100).never()` or nothing.

**★ `after(n)` used where `timeout(n)` would do.**
`after` always waits the whole duration. Sprinkled through a suite, that is minutes of wall-clock
time buying nothing — `timeout` returns as soon as the interaction arrives.

**★ `timeout`/`after` combined with `InOrder`.**
Documented as *"Not yet implemented to work with InOrder verification"* for both. There is no
async ordered verification.

**★ Verifying while the async work is still running.**
`timeout` waits for the *count* to be reached, then returns. If the code under test makes further
calls afterwards, they land after the verification and a later `verifyNoMoreInteractions` sees
them. Async plus completeness assertions is a race by construction.

**★ Stubbing a mock from the test thread while another thread is invoking it.**
Mockito records invocations and stubbings through the same thread-local machinery described in
[04 · Argument matchers](04-argument-matchers.md). Setting up a stubbing while a worker thread is
calling the same mock is a documented-as-unsupported shape rather than a guaranteed failure — do
all stubbing before the async work starts. I could not find a javadoc statement giving mocks a
concurrency guarantee either way, so treat this as "arrange fully, then act".

**★ An async verification with no assertion on the result.**
`verify(gateway, timeout(500)).charge(order)` proves a call was made, not that the pipeline
produced anything. In async code the outcome is often the only thing a consumer sees, so assert
on the observable state as well as the interaction.

**★ Tuning the millisecond value until CI goes green.**
A number chosen to pass on a laptop is a flake on a loaded build agent, and doubling it is a
slower flake. The fix is determinism: a latch the test awaits, an executor the test runs inline, a
callback the test supplies. Mockito's own advice: *"figure out a better way of testing your
multi-threaded system."*

## Interview questions

**★ `timeout(100)` or `after(100)`?**
`timeout` returns as soon as the verification passes, so it is the right choice for "this will
happen within 100 ms" and costs only as long as the system takes. `after` always waits the full
100 ms and then evaluates, which is what you need for a claim about the state *at* that moment —
notably `after(100).never()`, since `timeout(100).never()` is trivially true immediately.

**★ Why is there no `timeout(100).never()`?**
Because a mode that returns as soon as it is satisfied would return immediately: "never called" is
true at t=0. `VerificationWithTimeout` therefore declares only `times`, `atLeastOnce`, `atLeast`
and `only`, and the javadoc redirects upper-bound assertions to `after()`, which waits the full
window before evaluating.

**★ How would you test that a service publishes an event on a background thread, without a
sleep?**
Inject the executor and pass `Runnable::run` in the test so the work happens inline — then no
waiting is needed at all. If the threading is not injectable, have the mock release a
`CountDownLatch` from a `doAnswer`, await the latch with a generous timeout, and then verify. The
latch's timeout is a failure budget rather than a cost paid on every green run.

**★ Why does Mockito discourage `timeout` and `after`?**
Because they turn a logical claim into a wall-clock race. The javadoc says the feature *"should be
used rarely - figure out a better way of testing your multi-threaded system"*, and neither works
with `InOrder`. A latch, an inline executor, or a test-supplied callback makes the same assertion
deterministically and instantly.

{/* FOOTER */}

{/* FOOTER */}
