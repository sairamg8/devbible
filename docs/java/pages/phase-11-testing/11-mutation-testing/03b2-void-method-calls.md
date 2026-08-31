---
title: "VOID_METHOD_CALLS deletes the call entirely, so its survivors are not weak assertions but unobserved actions — and it is the one operator for which Mockito's verify() is the correct answer rather than a smell, with the sting that Spring Data's save returns a value and is therefore not mutated by the default set at all"
sidebar_label: "03b2 · VOID_METHOD_CALLS"
sidebar_position: 10
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against pitest's
> [Mutation operators](https://pitest.org/quickstart/mutators/) page — the *Void Method Call
> Mutator* and *Non Void Method Call Mutator* sections and the group table — and the
> [Maven quick start](https://pitest.org/quickstart/maven/) `avoidCallsTo` entry.
> `CrudRepository.save`'s signature from the **Spring Data Commons** javadoc as managed by
> Spring Boot 4.1.0.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring Framework
> 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0.
> ⚠️ **No sandbox and no build on this machine.** Mutator behaviour is quoted from pitest's docs;
> the Java on this page is illustrative source, never a run.

**Every other default mutator corrupts a value; this one deletes an action. That makes its
survivors a different kind of finding — not "the number you asserted was too weakly constrained"
but "this method could stop doing the thing it exists to do and your suite would not notice". It is
also the operator that settles a long-running argument about Mockito, because when the call has no
return value there is nothing to assert on and `verify()` is the only instrument that works. The
sting in the tail is that the single most important side effect in a Spring service — the
repository save — is not a `void` call, so the default set does not touch it.**

## `VOID_METHOD_CALLS` — the side-effect detector

> *"The void method call mutator removes method calls to void methods."*

```java
public int foo() {
  int i = 5;
  someVoidMethod(i);
  return i;
}
```

becomes

```java
public int foo() {
  int i = 5;
  return i;
}
```

with the note that *"constructor calls are not considered void method calls"*.

**What a survivor means:** a side effect nothing verifies. This is the mutator that punishes
mock-heavy tests least and rewards them most, depending on how they are written:

```java
// This test does not kill the mutant: no assertion, no verification of the save.
@Test
void savesTheOrder() {
    service.place(anOrder());
}
```

```java
// This one does: deleting repository.save(order) makes the verification fail.
@Test
void savesTheOrder() {
    Order order = anOrder();
    service.place(order);
    verify(orderRepository).save(order);
}
```

`VOID_METHOD_CALLS` is the operator for which `verify()` is exactly the right tool — see
[04 · Mockito](../04-mockito/README.md). It is also where `avoidCallsTo` matters, because
`log.debug(...)` is a `void` method call and would otherwise generate a mutant on every logging
line ([02b2](02b2-logging-and-avoidcallsto.md)).

## 🔴 The `void` boundary is arbitrary, and it lands in the wrong place

Read the operator's scope precisely. It removes calls **whose return type is `void`**. It does not
remove calls whose return value you ignore.

```java
public void place(Order order) {
    orderRepository.save(order);        // returns Order — NOT mutated by the default set
    eventPublisher.publish(placed);     // void          — mutated
    auditTrail.record(order.id());      // void          — mutated
    notifier.notifyCustomer(order);     // void          — mutated
}
```

`CrudRepository.save` is declared `<S extends T> S save(S entity)`. It returns the saved entity, so
`VOID_METHOD_CALLS` skips it. The operator that would neutralise it is `NON_VOID_METHOD_CALLS`,
whose documentation says it *"removes method calls to non void methods"* and replaces the return
value with the Java default — and it is **off by default**, sitting only in the `ALL` group
([03d](03d-optional-mutators.md)).

So the default mutation report on a Spring service tells you whether anyone checks the event was
published and says nothing about whether anyone checks the entity was saved. That asymmetry is a
property of the JVM's type system, not of risk.

There is no clean fix inside the default set. The honest options:

1. **Assert the save with a real repository.** A `@DataJpaTest` or Testcontainers-backed test that
   reads the row back constrains the behaviour whether or not pitest generates a mutant for it —
   [07 · Testcontainers](../07-testcontainers/README.md).
2. **Add `NON_VOID_METHOD_CALLS` to a narrow scope.** It is genuinely noisy on general code, but
   pointing it at one package with `targetClasses` is defensible:
   ```xml
   <mutators>
     <mutator>DEFAULTS</mutator>
     <mutator>NON_VOID_METHOD_CALLS</mutator>
   </mutators>
   <targetClasses>
     <param>com.example.orders.application.*</param>
   </targetClasses>
   ```
   Expect equivalent mutants: the docs warn it *"may also create equivalent mutations if it
   replaces a method that already returns one of the default values without also having a side
   effect"*.
3. **Accept the gap and know where it is.** This is usually right, and it is only a defensible
   position if it is written down rather than unnoticed.

## Constructors are not covered either

> *"Please note that constructor calls are not considered void method calls."*

So `new AuditEvent(...)` as a statement is untouched by this operator; `CONSTRUCTOR_CALLS`, which
*"replaces constructor calls with null values"*, is optional and off — and pitest's own warning is
that it is *"fairly unstable and likely to cause NullPointerExceptions even with weak test
suites"*, which is a polite way of saying its mutants get killed by accident.

## When `verify()` is right, and when it is still a smell

[04 · Mockito](../04-mockito/README.md) argues, correctly, that asserting on interactions couples a
test to the implementation and that asserting on outcomes is better where an outcome exists. A
`VOID_METHOD_CALLS` mutant is precisely the case where **no outcome exists to assert on**: the
method returns nothing, and the effect is in another object.

The distinction that resolves it:

```java
// Smell: the outcome IS available. Assert on it, not on the interaction.
@Test
void appliesTheDiscount() {
    Order priced = service.price(anOrder());
    verify(discountPolicy).discountFor(any());     // couples to implementation
    assertThat(priced.total()).isEqualTo(...);     // this is the real test
}
```

```java
// Not a smell: there is no outcome. The interaction is the behaviour.
@Test
void publishesAnOrderPlacedEvent() {
    service.place(anOrder());
    verify(eventPublisher).publish(argThat(e -> e.orderId().equals(ORDER_ID)));
}
```

The second is better still with an in-memory fake, which lets you assert on state instead of on
calls:

```java
class RecordingEventPublisher implements EventPublisher {
    private final List<DomainEvent> published = new ArrayList<>();

    @Override public void publish(DomainEvent event) { published.add(event); }

    List<DomainEvent> published() { return List.copyOf(published); }
}
```

```java
@Test
void publishesAnOrderPlacedEvent() {
    service.place(anOrder());
    assertThat(publisher.published())
        .singleElement()
        .isInstanceOf(OrderPlaced.class);
}
```

Both kill the mutant. The fake survives a refactor that changes how many times `publish` is called
in a way `verify(publisher).publish(...)` does not.

## Where this connects

- **[03b · Arithmetic mutators](03b-arithmetic-mutators.md)** — the operators that corrupt values
  rather than delete actions.
- **[03d · Optional mutators](03d-optional-mutators.md)** — `NON_VOID_METHOD_CALLS` and
  `CONSTRUCTOR_CALLS`, the two operators that would close this gap and the reasons they are off.
- **[02b2 · Logging and `avoidCallsTo`](02b2-logging-and-avoidcallsto.md)** — logging calls are
  `void` calls, which is why they needed a filter of their own.
- **[04 · Mockito](../04-mockito/README.md)** — `verify()`, argument captors, and the argument
  about interaction versus state assertions that this operator settles for one specific case.

## Gotchas

**★ A `VOID_METHOD_CALLS` survivor on a repository call means your test never checked the save happened.**
The mutant deletes `repository.save(order)` and everything still passes. A test that calls the
service and asserts on its return value cannot catch this; it needs either a `verify()` or an
assertion against a real or in-memory repository. This is the one mutator where interaction
verification is the correct answer rather than a smell.

**★ Spring Data's `save` is not a `void` method, so the default set does not delete it.**
`CrudRepository.save(S entity)` returns the saved entity. `VOID_METHOD_CALLS` only removes calls
with no return value, and the operator that would blank out a non-`void` call —
`NON_VOID_METHOD_CALLS` — is off by default. The result is that the highest-risk side effect in a
Spring service is one of the least mutated things in it, and a clean mutation report says nothing
about it either way.

**★ The operator's scope is the declared return type, not whether you use the value.**
`list.add(x)` returns `boolean` and is not mutated even though nobody reads the result;
`map.put(k, v)` returns the previous value and is not mutated. A class full of collection
mutations looks well tested to this operator because the JDK happened to give those methods return
types.

**★ Constructor calls are exempt, and the operator that covers them is unstable.**
`new AuditEvent(...)` as a bare statement is not a `void` method call. `CONSTRUCTOR_CALLS` exists
but pitest's own docs call it *"fairly unstable and likely to cause NullPointerExceptions even with
weak test suites"* — its mutants are killed by tests that verify nothing, so enabling it raises the
score without measuring anything.

**★ A mock with no verification turns every `void` call into a permanent survivor.**
`@Mock EmailSender sender;` with no `verify` means deleting `sender.send(...)` from the production
code changes nothing observable in the test. That is not a Mockito problem — it is a test that
asserts nothing about a behaviour — but mutation testing is the only tool that will point at it,
because coverage counts the line as covered either way.

**★ `verifyNoMoreInteractions` does not help and `verifyNoInteractions` actively hurts.**
Killing this mutant needs a positive assertion that the call *happened*. A test asserting that
nothing else was called still passes when the call under test is deleted. Worse, a strict
`verifyNoInteractions(publisher)` in a sibling test passes more easily with the mutant present.

**★ `avoidCallsTo` exists because `VOID_METHOD_CALLS` and logging are a bad combination.**
`log.debug(...)` is a `void` call on every line it appears, so without the `FLOGCALL` filter this
one operator would generate a mutant per logging statement, all of them survivors. Understanding
that this operator is the reason makes it obvious why disabling `FLOGCALL` "to see more" is so
destructive.

## Interview questions

**★ Your suite uses Mockito heavily and scores well on mutation. Which mutator would you look at to test that claim?**
`VOID_METHOD_CALLS`. It deletes calls to `void` methods, so a mutant that removes
`eventPublisher.publish(event)` is killed only if something verifies or observes the publish. A
mock-heavy suite that uses `verify()` kills these reliably — this is the case where interaction
verification is genuinely the right assertion. A mock-heavy suite that only stubs and never
verifies will show `VOID_METHOD_CALLS` survivors everywhere, which is the honest measurement of "we
set up a lot of mocks and checked nothing".

**★ Why is a `VOID_METHOD_CALLS` survivor different in kind from a `MATH` survivor?**
A `MATH` survivor says a value is unasserted; a `VOID_METHOD_CALLS` survivor says an *action* is
unobserved — the code could stop doing it entirely and nothing would notice. That is usually a
bigger finding, because the action is often the point of the method: sending the email, publishing
the event, recording the audit entry. It is also the one place where the standard advice against
asserting on interactions is wrong: there is no return value to assert on, so `verify()` or an
in-memory fake is the only way to kill it.

**★ Does PIT tell you whether your code saves to the database?**
Not with the default operator set, on a Spring Data repository. `CrudRepository.save` returns the
saved entity, so it is a non-`void` call, and `VOID_METHOD_CALLS` only deletes `void` ones.
`NON_VOID_METHOD_CALLS` would replace the call's result with `null` and is off by default, listed
only in the `ALL` group and documented as producing equivalent mutants. So a high mutation score on
a service class is compatible with nobody ever having checked that the save happens. The remedy is
a repository-level test that reads the row back, which is what
[07 · Testcontainers](../07-testcontainers/README.md) is for — and knowing that this gap exists is
more valuable than closing it with a noisy operator.

**★ You have a `VOID_METHOD_CALLS` survivor on `notifier.notifyCustomer(order)`. Walk through fixing it.**
First decide whether the behaviour matters — if sending the notification is part of what "placing
an order" means, it does. Then pick the assertion. `verify(notifier).notifyCustomer(order)` kills
the mutant and couples the test to the exact call. An in-memory fake that records notifications and
an assertion on its contents also kills it, survives refactoring better, and reads as a statement
about behaviour rather than about method calls. If the notification genuinely does not matter — a
best-effort metric, say — the right move is to add its package to `avoidCallsTo`, which records the
decision in the build file instead of leaving a permanent survivor in the report.

**★ Why doesn't this operator mutate `list.add(item)`?**
Because `Collection.add` returns `boolean`. The operator's scope is the declared return type, not
whether the caller uses the value. That is a real blind spot: a great deal of code accumulates into
collections and ignores the returns, and none of it is touched by this operator. The mutants that
would catch it come from `NON_VOID_METHOD_CALLS`, which replaces the call's result with the type's
default and is off by default because on general code it produces both noise and equivalent
mutants.

{/* FOOTER */}
