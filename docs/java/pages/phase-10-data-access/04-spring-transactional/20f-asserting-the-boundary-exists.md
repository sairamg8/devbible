---
title: "The assertion nobody writes is that a transaction existed at all — and it is the only one that catches a self-invocation or a dead annotation"
sidebar_label: "20f · Asserting the boundary exists"
sidebar_position: 58
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `TransactionSynchronizationManager` javadoc
> ([.../transaction/support/TransactionSynchronizationManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronizationManager.html)),
> the `TransactionAspectSupport` javadoc
> ([.../transaction/interceptor/TransactionAspectSupport.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/interceptor/TransactionAspectSupport.html))
> and the Spring Framework 7.0 reference *Testing → TestContext Framework →
> Transaction management*
> ([docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)).
> JDK 25, Spring Framework 7.0.9, Spring Boot 4.1.1.

**A `@Transactional` that the proxy never applied does not throw, does not log, and
does not fail any assertion a normal test makes. Every repository call still succeeds
— each one in its own autocommit unit. The only observable difference is that there
was no transaction, so the only test that can catch it is one that asks whether there
was.**

## The failure this assertion exists for

Two chunks of this topic describe silent failures:
[3 · The self-invocation trap](03-the-self-invocation-trap.md), where a `this.`
call bypasses the proxy, and
[5 · Annotations that do nothing](05-annotations-that-do-nothing.md), where the
annotation is on a method or a class the interceptor cannot see at all.

Both produce identical behaviour to correct code, right up until a failure happens
halfway through and half the work is already committed. Nothing in a conventional
suite distinguishes them:

| What a normal test asserts | Passes without a transaction? |
|---|---|
| the row exists afterwards | ✅ yes — autocommit wrote it |
| the returned object is correct | ✅ yes |
| the repository method was called | ✅ yes |
| an exception propagated | ✅ yes |
| **an actual transaction was active** | ❌ **no** |

Only the last row is a transaction test.

## The probe, and exactly what it answers

`TransactionSynchronizationManager` is the question, and the javadoc is careful about
what it means by "active":

> Return whether there currently is an actual transaction active. This indicates
> whether the current thread is associated with an actual transaction rather than just
> with active transaction synchronization.
>
> To be called by resource management code that wants to differentiate between active
> transaction synchronization (with or without a backing resource transaction; also on
> `PROPAGATION_SUPPORTS`) and an actual transaction being active (with a backing
> resource transaction; on `PROPAGATION_REQUIRED`, `PROPAGATION_REQUIRES_NEW`, etc).

That distinction is the whole point. `isSynchronizationActive()` can be true when
there is no real transaction — it is true under `SUPPORTS` with nothing to join.
**`isActualTransactionActive()` is the one that means a resource transaction is
underway**, so it is the one to assert on. Getting this wrong gives you a test that
passes on precisely the configuration you were trying to rule out.

## Getting the assertion into the right place

"Current" means *this thread, right now*. So the check has to run **inside the call
stack of the method under test** — from the test method itself it only tells you about
the test's own transaction, which is not the claim. Three shapes work, in descending
order of how much they prove:

```java
// 1 — from a collaborator the service already calls. Nothing production-only is added.
@SpringBootTest                       // ← note: NO class-level @Transactional
class OrderBoundaryTests {

    @MockitoBean AuditLog auditLog;
    @Autowired  OrderService orders;

    @Test
    void place_runs_inside_a_real_transaction() {
        AtomicBoolean sawTransaction = new AtomicBoolean();
        doAnswer(inv -> {
            sawTransaction.set(TransactionSynchronizationManager.isActualTransactionActive());
            return null;
        }).when(auditLog).record(any());

        orders.place(cart);

        assertThat(sawTransaction).isTrue();
    }
}
```

```java
// 2 — from an event listener, when the service already publishes
@Component
class BoundaryProbe {
    final List<String> boundaries = new ArrayList<>();

    @EventListener
    void on(OrderPlaced e) {
        boundaries.add(TransactionSynchronizationManager.getCurrentTransactionName());
    }
}
```

```java
// 3 — verifying the template was called. Weakest: proves a call, not a boundary.
verify(transactionTemplate).execute(any());
```

Shape 1 is the one to reach for. It adds nothing to production code, it runs on the
right thread by construction, and it fails with a clear message. The `AtomicBoolean`
matters: asserting inside the `doAnswer` swallows the failure if the stub is never
invoked at all, so capture the value and assert after.

🔴 **The test must not itself be `@Transactional`, or the assertion means nothing.**
If the test class carries the annotation, `isActualTransactionActive()` is true inside
the service whether or not the service has a boundary of its own — the test supplied
one. That is exactly the false positive
[20 · Transactions in tests](20-transactions-in-tests.md) closes on, and it neuters
this assertion completely. Drive the service the way a controller does: no test
transaction, no class-level annotation, and clean up explicitly afterwards.

## Naming the boundary tells you *whose* it is

`isActualTransactionActive()` proves a boundary exists. It does not prove it is the
boundary you meant. `getCurrentTransactionName()` does, because of a default stated in
the `TransactionAspectSupport` javadoc:

> If no transaction name has been specified in the `TransactionAttribute`, the exposed
> name will be the `fully-qualified class name + "." + method name` (by default).

```java
assertThat(TransactionSynchronizationManager.getCurrentTransactionName())
        .isEqualTo("com.example.orders.OrderService.reserve");
```

That single assertion distinguishes cases nothing else can. If `place()` calls
`this.reserve()` and `reserve()` is annotated `@Transactional(REQUIRES_NEW)`, a
correct dispatch through the proxy reports `…OrderService.reserve` inside `reserve`;
a self-invocation reports `…OrderService.place`, because the inner annotation was
never seen and the outer boundary is still the active one. The test fails with a
message that names the actual bug rather than a symptom of it.

⚠️ It is a string built from a class and a method name, so it is brittle in the
ordinary way: renaming the method breaks the test. Note also that the `value` /
`transactionManager` attribute of `@Transactional` is a **manager qualifier**, not a
name — `@Transactional("txMgr")` selects which `PlatformTransactionManager` to use and
leaves the exposed name at the default. Assert on the name where the distinction is
load-bearing; elsewhere assert only that a boundary exists.

## Gotchas

**⚠️ Asserting `isActualTransactionActive()` from inside a `@Transactional` test**
**Symptom:** the assertion passes for every service, including one with no annotation
at all.
**Cause:** the test's own transaction is the active one. You are asserting that the
TestContext framework works.
**Fix:** remove the class-level `@Transactional` from that specific test, drive the
service the way production does, and clean up explicitly.

**⚠️ Using `isSynchronizationActive()` as the boundary check**
**Symptom:** a test that passes under `PROPAGATION_SUPPORTS` with no transaction.
**Cause:** synchronization can be active "with or without a backing resource
transaction; also on `PROPAGATION_SUPPORTS`". It is a strictly weaker condition.
**Fix:** `isActualTransactionActive()`.

**⚠️ Asserting inside the `doAnswer` and nowhere else**
**Symptom:** the test passes because the stubbed collaborator was never called.
**Cause:** an assertion that never runs cannot fail. If the service takes a branch
that skips the audit call, nothing happens.
**Fix:** capture into an `AtomicBoolean` (or a list) inside the stub and assert on it
after the call, so "never invoked" is a failure.

**⚠️ Asserting the transaction name everywhere**
**Symptom:** thirty tests break when a method is renamed.
**Cause:** the default name is literally the qualified method name, so it is coupled
to the source.
**Fix:** assert on the name only where *which* method opened the boundary is the point
— self-invocation, `REQUIRES_NEW`, nesting. Elsewhere assert that one exists.

**⚠️ Expecting `@Transactional("txMgr")` to change the transaction name**
**Symptom:** a name assertion against `"txMgr"` that never matches.
**Cause:** that attribute is a transaction-*manager* qualifier, used when there are
several `PlatformTransactionManager` beans. It does not name the transaction.
**Fix:** assert on the qualified method name, or set an explicit name if your boundary
is programmatic and you control the `TransactionDefinition`.

**⚠️ Probing from a thread the service handed work to**
**Symptom:** the probe reports no transaction and the test fails on code that is fine.
**Cause:** the holder is a `ThreadLocal`. An `@Async` collaborator, an executor task or
a `parallelStream()` element runs on a thread with nothing bound —
[20c](20c-the-other-ways-a-test-lies.md).
**Fix:** probe on the thread the boundary is on. If the collaborator you were going to
probe through is asynchronous, pick a different one.

## Interview questions

**★ You have a service method with `@Transactional` and a green test suite. What
assertion would tell you whether the annotation is doing anything?**
An assertion on `TransactionSynchronizationManager.isActualTransactionActive()`
evaluated *inside* the method's call stack — from a collaborator the method already
calls, or an event listener it publishes to — with the test itself **not**
`@Transactional`. That is the only observable difference between a working
`@Transactional` and one the proxy never applied: nothing throws, nothing logs, and
every repository call still succeeds against autocommit. If the test class carries
`@Transactional`, the check is worthless, because the test supplied the transaction
the assertion then finds.

**★ Why `isActualTransactionActive()` rather than `isSynchronizationActive()`?**
Because they answer different questions and only one of them is the boundary. The
javadoc says the former "indicates whether the current thread is associated with an
actual transaction rather than just with active transaction synchronization", and
spells out the case that separates them: synchronization can be active "with or
without a backing resource transaction; also on `PROPAGATION_SUPPORTS`". A method
running under `SUPPORTS` with no caller transaction therefore has synchronization and
no resource transaction — `isSynchronizationActive()` is true and nothing is atomic.
Asserting on the weaker one gives you a test that passes on exactly the configuration
you were trying to rule out.

**★ How would you write a test that fails specifically on self-invocation?**
Assert on `getCurrentTransactionName()` from inside the inner method. Spring's default
is documented: with no name in the `TransactionAttribute`, "the exposed name will be
the fully-qualified class name + `.` + method name". So when `place()` calls
`this.reserve()` and `reserve()` is annotated `REQUIRES_NEW`, a correct dispatch
through the proxy reports `…OrderService.reserve` while a self-invocation reports
`…OrderService.place` — the outer boundary, still active, because the inner annotation
was never seen. The assertion fails with a message that names the bug. It is a brittle
assertion by nature, so it belongs on the few methods where the distinction is
load-bearing.

**★ Where exactly do you put the probe, and why not in the test method?**
In the call stack of the method under test, on its thread: a mocked collaborator it
already calls, an `@EventListener` on an event it already publishes, or a
`TransactionSynchronization` registered by such a listener. Not in the test method,
because the holder is thread-local *and* scope-local — from the test method you are
reading the test's own transaction state, not the service's. And not on any thread the
service handed work to, for the same reason: an `@Async` collaborator or a
`parallelStream()` element has nothing bound and will report no transaction even when
the caller's boundary is perfectly correct.

**★ Is it reasonable to put transaction-infrastructure assertions in application tests
at all? It looks like testing the framework.**
It looks like it and it is not, and the distinction is worth being able to state. You
are not asserting that Spring's transaction manager works; you are asserting that
*your* class is wired such that the interceptor applies to it — that the bean is a
proxy, that the call arrives from outside, that the annotation is on a method the
proxy can see, and that no `final`, `private` or `static` modifier and no self-call
removed it. All of those are properties of your code, all of them fail silently, and
none is visible in any other assertion the suite makes. The reasonable scope is small:
one such test per transactional entry point that genuinely needs atomicity, not one
per method.

**★ Could you replace all of this with an architecture test — ArchUnit, or a startup
check — instead of a runtime assertion?**
For some of it, and that is worth doing because it is cheaper. A static rule can
require that `@Transactional` never appears on a `private`, `final` or `static`
method, that it never appears on a class outside the service package, and that service
classes are not `final` — all of which kill whole categories of dead annotation before
a test runs, and are the subject of
[5c · Proving it and preventing it](05c-proving-it-and-preventing-it.md). What static
analysis cannot see is the self-invocation that happens through a lambda, a callback
or a helper method it cannot resolve, nor whether a specific runtime wiring produced a
proxy at all. The two are complements: rules for the shapes, one runtime probe per
entry point for the wiring.

---

← Prev: [20e · What the context hides](20e-what-the-context-hides.md) · Index: [04 · Spring @Transactional](README.md) · Next → [20g · Asserting the settings](20g-asserting-the-settings.md)
