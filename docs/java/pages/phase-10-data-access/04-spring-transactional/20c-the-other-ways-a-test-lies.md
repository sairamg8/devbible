---
title: "Flushing is only the first way a transaction test lies — a second thread and a mocked repository each give you a green test over code that has no transaction at all"
sidebar_label: "20c · The other ways a test lies"
sidebar_position: 55
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Testing →
> TestContext Framework → Transaction management*
> ([docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)),
> *Testing → Annotations → `@MockitoBean` and `@MockitoSpyBean`*
> ([.../testing/annotations/integration-spring/annotation-mockitobean.html](https://docs.spring.io/spring-framework/reference/testing/annotations/integration-spring/annotation-mockitobean.html))
> and the reference *Integration → Task execution and scheduling*
> ([.../integration/scheduling.html](https://docs.spring.io/spring-framework/reference/integration/scheduling.html)).
> JDK 25, Spring Framework 7.0.8, Spring Boot 4.1.0, Hibernate ORM 7.4.1.

**The flush problem is the famous one, so it gets fixed. Two quieter ones do not:
a test body that ran on a different thread from the transaction, and a repository
that was never a database. Both produce a test that is green, confident, and
proves nothing about the transaction.**

## The second false positive: another thread

The reference's warning about preemptive timeouts is really a warning about
threads, and it is worth reading in full because it names an unexpected
consequence:

> Spring's testing support binds transaction state to the current thread (via a
> `java.lang.ThreadLocal` variable) *before* the current test method is invoked. If
> a testing framework invokes the current test method in a new thread in order to
> support a preemptive timeout, any actions performed within the current test
> method will *not* be invoked within the test-managed transaction. Consequently,
> the result of any such actions will not be rolled back with the test-managed
> transaction. On the contrary, such actions will be committed to the persistent
> store — for example, a relational database — even though the test-managed
> transaction is properly rolled back by Spring.

Read the last sentence twice. The rollback is not skipped. It happens, correctly,
on the test thread — and it rolls back a transaction that contains none of the
work, because the work happened somewhere else and committed on its own. Spring is
behaving exactly as documented; the test is simply not testing what it looks like
it is testing.

The named culprits:

- JUnit 4's `@Test(timeout = …)` support and the `TimeOut` rule
- JUnit Jupiter's `assertTimeoutPreemptively(…)`
- TestNG's `@Test(timeOut = …)`

The symptom is peculiar: the test appears to work, and the *next* test fails, or a
row appears in the database that no rollback removed. If you want a timeout in a
JUnit 5 test, `@Timeout` (which does not run the test in another thread by
default) or `assertTimeout` (which runs the body on the calling thread and only
checks the elapsed time afterwards) are safe; `assertTimeoutPreemptively` is not.

```java
// ⛔ writes escape the test transaction and survive the rollback
assertTimeoutPreemptively(Duration.ofSeconds(2), () -> orders.place(cart));

// ✅ same thread, same transaction; fails afterwards if it took too long
assertTimeout(Duration.ofSeconds(2), () -> orders.place(cart));
```

## The same trap, moved into the code under test

The harness is only half of it. The rule from
[18 · Threads and `@Async`](18-threads-and-async.md) is that the transaction is on
one thread, so anything that leaves that thread leaves the transaction — and the
code under test can do that just as easily as the test framework can:

- a method annotated `@Async`, which the reference is explicit runs on an executor
  and cannot even be combined with lifecycle callbacks;
- a `CompletableFuture.supplyAsync(...)` that writes;
- a `parallelStream()`, which splits work between the calling thread (inside the
  transaction) and common-pool threads (outside it), non-deterministically.

None of those writes is in the test transaction, so none is rolled back with it. A
test of such a service that passes has told you nothing about atomicity, and the
leaked rows will surface in whichever test runs next.

## The third: a mock never reaches a database

A suite built on mocked repositories cannot detect any of this, because there is no
database and no transaction. Mockito will happily record that `save` was called and
return whatever you stubbed; no flush happens, no constraint is evaluated, no
rollback is exercised, and the proxy that would have opened the transaction may not
even be in the object graph. The test verifies that your code called the methods
you expected — a real and useful claim, but a different one.

Transaction behaviour is an integration concern. It needs the container, a real
transaction manager, and a real database. Mocks belong **above** the transactional
boundary, standing in for the collaborators a service talks to that are not the
database — a payment gateway, a mail sender, a clock. That division has a second
benefit: those are exactly the collaborators
[21 · What belongs in a transaction](21-what-belongs-in-a-transaction.md) argues
should be outside the boundary anyway, so a codebase that is easy to mock at the
right level is usually one whose transactions are already the right shape.

## Boot 4: `@MockBean` is gone

A version detail that will otherwise waste an afternoon. Spring Boot 4 **removes**
`@MockBean` and `@SpyBean`. The replacements live in Spring Framework itself, in
`org.springframework.test.context.bean.override.mockito`:

> `@MockitoBean` and `@MockitoSpyBean` can be used in test classes to override a
> bean in the test's `ApplicationContext` with a Mockito *mock* or *spy*,
> respectively. In the latter case, an early instance of the original bean is
> captured and wrapped by the spy.

They may be declared on a non-static field in the test class or its superclasses,
on such a field in an enclosing class of a `@Nested` test, or at type level in
either hierarchy. Practically every tutorial and answer online still shows
`@MockBean`; on Boot 4 it will not compile.

There is a transactional sting in `@MockitoSpyBean` specifically. Overriding a bean
replaces what the context hands out, so a spy wrapped around a `@Transactional`
service leaves you with two wrappers around one target — the transactional proxy
and the spy — and no contract about which one an injection point receives or in
what order they nest. If you are testing transactional behaviour, do not spy the
transactional bean. Take the real one from the context and spy its collaborators.

## The trade-off

Every fix here pushes the test further from a unit test and closer to an
integration test: a real context, a real database, a real thread, no doubles at the
boundary. Those tests are slower to run, slower to write, and they fail for reasons
unrelated to the code under test — a schema drift, a container that will not start.

That is the honest price. Transactional behaviour is a property of the interaction
between the proxy, the transaction manager, the connection and the database, and no
test that removes three of those four can observe it. The pragmatic resolution is
to have very few of these tests and to make each one count, leaving the rest of the
suite fast and mocked above the boundary.

## Gotchas

**⚠️ `assertTimeoutPreemptively` around code that writes**
**Symptom:** rows that survive the rollback, and a later test failing.
**Cause:** the assertion runs the code in a new thread, which has no test
transaction bound; its writes commit independently.
**Fix:** `assertTimeout` or JUnit 5's `@Timeout`, neither of which relocates the
test body to another thread by default.

**⚠️ A green test for a service that dispatches to `@Async`**
**Symptom:** the test passes; production leaves half-written data after a failure.
**Cause:** the async work runs on another thread with its own transaction (or
none), so the test transaction never contained it and the rollback never covered
it.
**Fix:** test the async unit separately and synchronously; assert on the
transactional part alone.

**⚠️ A `parallelStream()` inside the method under test**
**Symptom:** intermittently leaked rows, and a test that fails only on a loaded
machine.
**Cause:** the common pool runs some elements on the calling thread — inside the
transaction — and some on its own threads, outside it. Which is which varies.
**Fix:** do not fan out inside a transactional method. Collect first, write on one
thread.

**⚠️ A test suite built on mocked repositories claiming to test transactions**
**Symptom:** total confidence and no coverage.
**Cause:** a mock never reaches a database, so nothing about atomicity, flushing
or constraints is exercised.
**Fix:** transaction behaviour needs an integration test against a real database.
Mocks belong in the layers above.

**⚠️ `@MockBean` in a Boot 4 codebase**
**Symptom:** it does not compile, and every search result suggests it should.
**Cause:** Boot 4 removed `@MockBean` and `@SpyBean`; the replacements are
Framework's `@MockitoBean` and `@MockitoSpyBean`.
**Fix:** change the import and the name.

**⚠️ `@MockitoSpyBean` on the `@Transactional` service itself**
**Symptom:** the rollback stops happening, or the verification counts calls that
never went through an interceptor.
**Cause:** the bean override replaces what the context hands out, so the spy and
the transactional proxy are not guaranteed to be the same object in the same order.
**Fix:** do not spy the bean whose transactionality you are testing. Spy its
collaborators.

**⚠️ Stubbing the repository to throw, to "test the rollback"**
**Symptom:** a passing rollback test with no database in sight.
**Cause:** the mock throws, the exception propagates, and nothing else happens —
there was no transaction to roll back and no row to check.
**Fix:** force the failure against a real database and assert on the row count.

## Interview questions

**★ Why is `assertTimeoutPreemptively` dangerous in a Spring integration test?**
Because it runs the test body in a new thread, and the reference explains what that
costs: Spring binds the transaction state to the current thread via a `ThreadLocal`
*before* the test method is invoked, so actions performed in the new thread "will
not be invoked within the test-managed transaction… such actions will be committed
to the persistent store… even though the test-managed transaction is properly
rolled back by Spring". The rollback happens and the data survives. JUnit 4's
`@Test(timeout=…)` and TestNG's `@Test(timeOut=…)` have the same problem, and the
safe JUnit 5 equivalents are `assertTimeout` and `@Timeout`.

**★ Is that a Spring bug, or a testing-framework bug?**
Neither — it is the documented consequence of a documented design. Spring's
transaction context is thread-bound by construction, and the test harness binds it
before invoking the method. A framework that then moves the method body to a
different thread has moved it out of the context. The reason it feels like a bug is
that the failure is silent and delayed: the current test passes, and a later test
fails on data nobody expected to exist.

**★ Your test calls a service that dispatches part of its work with `@Async`. What
can the test still prove?**
Only the synchronous part. The async method runs on an executor thread, which has
no inherited transaction context, so its work is outside the test transaction and
outside the caller's — it either runs in its own transaction or in none, and it is
not rolled back with the test. A passing test therefore says nothing about the
atomicity of the whole operation. The honest approach is to test the synchronous
boundary transactionally, test the async unit separately and synchronously, and
treat the handoff between them as the integration point it actually is.

**★ Why is `parallelStream()` inside a transactional method worse than `@Async`?**
Because it is non-deterministic rather than consistently wrong. `@Async` always
leaves the thread, so the mistake is at least reproducible. A parallel stream runs
some elements on the calling thread — which *is* inside the transaction — and the
rest on common-pool threads that are not, and the split depends on the number of
elements, the pool size and the machine's load. So the same test can pass on a
laptop and leak rows in CI, and half of a "rolled back" batch can survive.

**★ Can you test transaction behaviour with mocked repositories?**
No. A mock never reaches a database, so nothing about atomicity, flushing,
constraints or rollback is exercised — the test verifies that your code called the
methods you expected, which is a different and much weaker claim. Transaction
behaviour is an integration concern and needs a real database. Mocks are
appropriate above the transactional boundary, for the collaborators a service calls
that are not the database.

**★ Where, then, is a mock the right tool in a transactional codebase?**
Above the boundary, for the collaborators that should not be inside a transaction
in the first place: a payment gateway, an email sender, a clock, a message
publisher. Those are the ones you want to stub because they are slow, remote or
non-deterministic — and they are the same ones that belong outside the transaction
for the reasons in chunk 21. A codebase that is naturally easy to mock at that
level usually has its transaction boundaries in the right place already; one where
mocking forces you inside the boundary is telling you the boundary is too wide.

**★ What changed about mocking beans in Spring Boot 4?**
`@MockBean` and `@SpyBean` were removed. The replacements are Spring Framework's
own `@MockitoBean` and `@MockitoSpyBean`, in
`org.springframework.test.context.bean.override.mockito`, which "can be used in
test classes to override a bean in the test's `ApplicationContext` with a Mockito
mock or spy" — the spy variant capturing and wrapping an early instance of the real
bean. They can go on a non-static field or at type level, including for `@Nested`
classes. Nearly all existing material online still shows the Boot annotations, so
this is a routine source of confusion on a Boot 4 codebase.

**★ Is `@MockitoSpyBean` safe to put on a `@Transactional` service?**
Not for testing transactionality. The bean override replaces the instance the
context hands out, and you now have two wrappers around the same target — the
transactional proxy and the spy — with no contract about which one the injection
point receives or how they nest. The verification may count calls that never
crossed the interceptor, or the interceptor may be bypassed entirely. Spy the
collaborators instead, and take the transactional bean itself from the context
untouched.

**★ A colleague replaces the whole integration test with mocks because "the
database makes it slow". What do you say?**
That the speed is real and the coverage loss is total, so it is a trade to make
deliberately rather than by default. Mocking everything below the service turns an
integration test into an interaction test: it will still catch a wrong method call
or a wrong argument, and it will no longer catch a missing rollback rule, a
self-invocation that skipped the proxy, a constraint violation, a propagation
mistake or a connection-pool deadlock — the entire subject of this topic. The
usual resolution is a small number of slow, real tests for the transactional
contracts and a fast mocked suite for everything else, not one or the other.

---

← Prev: [20b · The false positives](20b-the-false-positives.md) · Index: [04 · Spring @Transactional](README.md) · Next → [20d · What a test must assert](20d-what-a-test-must-assert.md)
