---
title: "When a test needs twenty stubbings to reach one assertion, the problem is not the stubbing syntax — it is that a mock has no state and no invariants, so every fact about the collaborator has to be restated by hand in every test, and a forty-line in-memory implementation replaces all of them permanently"
sidebar_label: "12 · Mocks vs fakes"
sidebar_position: 61
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> section 8 (*"Finding redundant invocations"*) and section 17 (*"Resetting mocks"*) of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java),
> and the Mockito wiki
> [How to write good tests](https://github.com/mockito/mockito/wiki/How-to-write-good-tests)
> (*"Keep the testing code compact and readable"*, *"Don't mock everything, it's an
> anti-pattern"*). The mock/stub/fake vocabulary is
> [01b · Mock, stub, spy, fake](01b-mock-stub-spy-fake.md)'s.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**Everything else in this topic is about using Mockito well. This chunk is about the case where
the right amount of Mockito is none. A fake is a working implementation of your own interface,
kept simple — and where a mock has to be told every fact, in every test, a fake knows them. The
test below goes from twenty-nine lines of setup to four, and gains the ability to catch a class
of bug a mock structurally cannot. [12b · What a fake costs](12b-what-a-fake-costs.md) is the
other side — the maintenance bill, the contract test that keeps the fake honest, and where the
fake stops and a real database starts.**

## The test that is thirty lines of `when`

A service that confirms an order, records it, and refuses to confirm the same order twice:

```java
@Test
void confirming_an_order_twice_is_rejected() {
    // --- fixture: everything the repository must "know" ---
    when(repository.findById(ORDER_ID)).thenReturn(Optional.of(pendingOrder));
    when(repository.save(any(Order.class))).thenAnswer(returnsFirstArg());
    when(repository.existsById(ORDER_ID)).thenReturn(true);
    when(repository.countByCustomer(CUSTOMER)).thenReturn(1L);
    when(repository.findByCustomer(CUSTOMER)).thenReturn(List.of(pendingOrder));

    // --- and now the same facts again, for the state AFTER the first confirm ---
    when(repository.findById(ORDER_ID))
            .thenReturn(Optional.of(pendingOrder))
            .thenReturn(Optional.of(confirmedOrder));
    when(auditLog.lastFor(ORDER_ID)).thenReturn(Optional.empty(), Optional.of(entry));

    when(pricing.totalFor(pendingOrder)).thenReturn(Money.of("42.50"));
    when(gateway.charge(CUSTOMER, Money.of("42.50"))).thenReturn(APPROVED);

    service.confirm(ORDER_ID);

    assertThatThrownBy(() -> service.confirm(ORDER_ID))
            .isInstanceOf(AlreadyConfirmed.class);
}
```

Look at what the stubbings are doing. They are not describing *inputs* to the code under test —
they are hand-maintaining a **model of a repository's state across two calls**, using
[03b · Consecutive stubbing](03b-consecutive-stubbing.md) to fake the transition. Every one of
those lines is a fact the real repository would know for itself, restated by a human, per test,
and liable to be restated inconsistently.

And nothing checks the consistency. `existsById` returning `true` while `findById` returns
`empty()` is a perfectly legal mock configuration and an impossible repository.

## The fake, in full

This is the whole thing. It is the point of the page, so it is written out rather than sketched.

```java
public class InMemoryOrderRepository implements OrderRepository {

    private final Map<OrderId, Order> byId = new LinkedHashMap<>();
    private final AtomicLong sequence = new AtomicLong();

    @Override
    public Order save(Order order) {
        Order stored = order.id() == null
                ? order.withId(OrderId.of("ORD-" + sequence.incrementAndGet()))
                : order;
        byId.put(stored.id(), stored);
        return stored;
    }

    @Override
    public Optional<Order> findById(OrderId id) {
        return Optional.ofNullable(byId.get(id));
    }

    @Override
    public boolean existsById(OrderId id) {
        return byId.containsKey(id);
    }

    @Override
    public List<Order> findByCustomer(CustomerId customer) {
        return byId.values().stream()
                .filter(o -> o.customer().equals(customer))
                .toList();                                    // insertion order, like the Map
    }

    @Override
    public long countByCustomer(CustomerId customer) {
        return findByCustomer(customer).size();               // never disagrees with the list
    }

    @Override
    public void deleteById(OrderId id) {
        byId.remove(id);
    }

    @Override
    public List<Order> findAll() {
        return List.copyOf(byId.values());
    }

    // --- test-only affordances: setup and inspection without going through the interface ---

    public InMemoryOrderRepository containing(Order... orders) {
        for (Order o : orders) { byId.put(o.id(), o); }
        return this;
    }

    public boolean isEmpty() {
        return byId.isEmpty();
    }
}
```

Forty-odd lines, no framework, and it is written once for the whole codebase. The test becomes:

```java
@Test
void confirming_an_order_twice_is_rejected() {
    OrderRepository repository = new InMemoryOrderRepository().containing(pendingOrder);
    OrderService service = new OrderService(repository, pricing, gateway, notifier);
    when(pricing.totalFor(any())).thenReturn(Money.of("42.50"));
    when(gateway.charge(any(), any())).thenReturn(APPROVED);

    service.confirm(ORDER_ID);

    assertThatThrownBy(() -> service.confirm(ORDER_ID)).isInstanceOf(AlreadyConfirmed.class);
}
```

Two stubbings remain — `pricing` and `gateway` are genuine boundaries and their return values
are inputs to the behaviour under test. That is what stubbing is *for*.

## 🔴 The bug a fake catches and a mock cannot

The interesting part is not the line count. It is that the second `confirm` above now goes
through **the state the first `confirm` left behind**.

With mocks, `findById` returns whatever the second element of a consecutive stubbing says it
returns — which is a value the test author chose, so the test passes whether or not `confirm`
actually saved anything. Delete the `repository.save(...)` call from `OrderService.confirm` and
the mock-based test stays green. The fake-based test goes red, because `findById` genuinely
consults what `save` genuinely stored.

That is a whole class of defect: **anything about the sequence of operations**.

- Did the write actually happen, or only the call to `save`?
- Did the code read back what it wrote, or a stale copy it was holding?
- Does the second invocation see the first one's effect?
- Is the operation idempotent when repeated?
- Does a failure halfway through leave the store in the state the next step expects?

A mock answers all of these with "whatever you scripted". A fake answers them with "whatever the
code actually did", which is the only answer worth having.

This is also why the awkward `verify(repository).save(order)` in
[05d · Verifying too much](05d-verifying-too-much.md) disappears: with a fake, the save is
observable as state, so you assert on `repository.findById(id)` — an outcome — instead of on the
interaction.

## When a stub genuinely wins

A fake is not the default. Reach for a stub when:

- **The collaborator has no state worth modelling.** `PricingPolicy.totalFor(order)` is a
  function; a fake of it would be either the real implementation or a lookup table, and both are
  worse than `when(...).thenReturn(...)`.
- **The behaviour under test is "it told someone".** A `Notifier` has nothing to remember; the
  assertion is the interaction, so a mock and `verify` is exactly right.
- **You need a failure the fake cannot produce.** A timeout, a connection reset, a constraint
  violation. `when(gateway.charge(any(), any())).thenThrow(new GatewayTimeout())` in one line
  beats teaching the fake to fail on command — see the gotcha below about fakes that grow
  configuration.
- **The collaborator is used once, in one test.** A fake is amortised over many tests. For a
  single use, it is a class nobody else will ever read.
- **The interface is large and you need one method.** Implementing fourteen methods to stub one
  is a bad trade, though it is also a signal that the interface should be smaller.

The rule of thumb that holds up: **stub a function, fake a store.** If the collaborator answers
questions about state it holds, a fake pays for itself by the third test.

## Gotchas

**★ A mock configured into a state the real collaborator cannot reach.**
`existsById(id)` returning `true` alongside `findById(id)` returning `Optional.empty()`. Mocks
have no invariants, so nothing stops you, and the test then passes against a world that does not
exist. A fake makes the combination impossible by construction.

**★ Consecutive stubbing used to simulate state transitions.**
`thenReturn(a).thenReturn(b)` for "before and after the write" is a hand-rolled state machine
with no invariants and no name. It is the clearest signal in the topic that a fake is wanted —
[03b · Consecutive stubbing](03b-consecutive-stubbing.md) covers the mechanism; this covers when
not to need it.

**★ An `Answer` with a `Map` inside it.**
`thenAnswer(inv -> store.get(inv.getArgument(0)))` is a fake written inside a lambda, with no
type, no name and no reuse. [03c · Answers](03c-answers.md) says the same thing from the other
side. Promote it to a class implementing the interface.

**★ Adding configuration knobs to a fake so it can fail on command.**
`repository.failNextSave(new OptimisticLockException())` turns the fake back into a mock with
worse ergonomics. Failure injection is what a stub is good at; use `mock(...)` for the failure
test and the fake for the rest.

**★ Mixing a fake and a mock for the same collaborator across one test class.**
Three tests with `@Mock OrderRepository` and two with `InMemoryOrderRepository` means two
different sets of assumptions about the same interface live in one file, and a reader cannot
tell which is authoritative. Pick one per collaborator per class.

**★ Sharing one fake instance across tests.**
A fake holds state, which is the entire point — so a `static` or field-initialised instance
reused across test methods leaks data between them and makes the suite order-dependent. Build it
fresh in each test or in `@BeforeEach`. This is the same hazard as
[01-junit-5/12e-shared-state-under-parallelism.md](../01-junit-5/12e-shared-state-under-parallelism.md).

**★ Writing a fake for a collaborator you use in exactly one test.**
The economics do not work: a class nobody else reads, to replace two stubbings. Fakes pay off by
about the third test that needs consistent behaviour.

**★ Faking a boundary you do not own.**
An in-memory `HttpClient` is a guess about HTTP with extra steps —
[10b](10b-do-not-mock-types-you-do-not-own.md) applies to fakes exactly as it does to mocks. Fake
*your* interface (the adapter from [10e](10e-the-anti-corruption-adapter.md)), not the library
behind it.

## Interview questions

**★ When would you write an in-memory fake instead of using a mock?**
When the collaborator holds state that several tests need to be consistent about — a repository,
a queue, a cache. A mock has to be told every fact in every test, and nothing stops it being
told contradictory ones; a fake knows them once and cannot be inconsistent. The rule of thumb is
stub a function, fake a store.

**★ What class of bug does a fake catch that a mock cannot?**
Anything about the sequence of operations: whether the write actually happened, whether the code
reads back what it wrote, whether a second invocation sees the first one's effect, whether an
operation is idempotent. With mocks, every read returns a value the test author scripted, so
deleting the write from production code leaves the test green. With a fake, the read consults
what the write actually stored.

**★ You see a test with twenty-nine `when(...)` lines and one assertion. What is wrong?**
The stubbings are not supplying inputs; they are hand-maintaining a model of a collaborator's
state, usually with consecutive stubbing standing in for a transition. That is a fake written
badly and spread across a test method. Extract it into a class implementing the interface, and
the twenty-nine lines become one constructor call.

**★ When is a mock clearly better than a fake?**
When the collaborator is stateless (a pricing function), when the behaviour under test *is* the
interaction (a notifier), when you need to inject a failure the fake cannot produce (a timeout,
a constraint violation), or when the collaborator appears in one test only. Adding failure
switches to a fake to cover the third case turns it back into a mock with worse ergonomics.

**★ How is a fake different from a stub, in the vocabulary?**
A stub returns canned answers with no memory; a fake is a working implementation, simplified. In
Mockito terms a stub is `mock(X.class)` plus `when(...)`, while a fake is a class you wrote that
implements `X`. The distinction is exactly the one in
[01b](01b-mock-stub-spy-fake.md), and it decides what the test is allowed to assert: a fake lets
you assert on outcomes where a stub would force you to assert on interactions.


{/* FOOTER */}
