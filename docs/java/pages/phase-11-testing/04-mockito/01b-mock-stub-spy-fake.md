---
title: "Mock, stub, spy, fake and dummy name five different things, Mockito uses two of those words for its own concepts in ways that do not match the classical definitions, and the confusion is not pedantic — it decides what a test is allowed to assert"
sidebar_label: "01b · Mock, stub, spy, fake"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the class javadoc of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> (sections 1, 2 and 13 · spying on real objects) and the `spy` and `mock` declarations.
> The classical vocabulary is Gerard Meszaros's, as popularised by Martin Fowler's
> ["Mocks Aren't Stubs"](https://martinfowler.com/articles/mocksArentStubs.html) — named
> here as the source of the terms, not as a Mockito API reference.
> JDK 25 · Spring Boot 4.1.0 → Mockito 5.23.0, JUnit Jupiter 6.0.3.

**"Mock" in casual speech means "any object standing in for a real one". In the vocabulary
this topic uses, and in Mockito's API, it means something narrower — and two of the five
terms mean *different things* depending on whether you are reading Mockito's javadoc or a
testing book. Getting the words straight is worth ten minutes, because each kind of
double licenses a different kind of assertion, and using the wrong assertion for the double
you have is the most common structural mistake in this topic.**

## The five, as test doubles

| Term | What it is | What a test may assert with it |
|---|---|---|
| **Dummy** | Passed to satisfy a signature, never used | nothing — it is filler |
| **Stub** | Returns canned answers to calls | the **outcome** the canned answer produced |
| **Spy** | A real object that also records calls | the outcome, **and** what was called |
| **Mock** | Pre-programmed with expectations about calls | **the calls themselves** |
| **Fake** | A working implementation, simplified | the outcome, exactly as with the real thing |

The distinction between **stub** and **mock** is the one that carries weight. A stub exists
to supply *input* to the code under test — you use it and then assert on the result. A mock
exists to record *output* that takes the form of a call — you assert on the interaction
because there is no result to look at.

This is the same split as
[01 · What a mock is for](01-what-a-mock-is-for.md)'s stubbing-versus-verification, and it is
why the two should rarely appear on the same interaction.

## 🔴 Where Mockito's words diverge

Mockito is a *"mock"* framework whose objects are, in the classical vocabulary, mostly
**stubs**. `Mockito.mock(...)` produces an object that records everything and returns
defaults; it becomes a stub when you call `when(...)`, and a mock when you call
`verify(...)`. **The same object plays both roles depending on which method you use on it.**

That is a genuinely useful design and a genuinely confusing vocabulary. In practice:

```java
PaymentGateway gateway = mock(PaymentGateway.class);   // a "mock" by API

when(gateway.charge(any())).thenReturn(DECLINED);      // now it is a STUB
                                                       // — supplying input

verify(notifier).orderConfirmed(any());                // this is MOCK usage
                                                       // — asserting an interaction
```

The word to use in conversation is whichever makes the sentence true. The word to use in
code is `mock(...)`, because that is the API.

### And `spy` means two things

The classical **spy** is a real object wrapped so that calls are recorded — behaviour is
real, observation is added. Mockito's `spy(...)` is exactly that, and is covered in
**08 · Spies** *(not written yet)*.

But "spy" is also used loosely for "a mock I am verifying against", which is the classical
*mock*. When someone says "I spied on the repository", ask which they mean — a real
repository with recording, or a `mock` they later `verify`. They behave completely
differently when a method is not stubbed: the spy runs the real code, the mock returns
`null`.

## The one that is underused: the fake

A **fake** is a real implementation, kept simple — an in-memory `Map` behind a repository
interface, an `InMemoryClock`, a queue that is an `ArrayDeque`.

```java
class InMemoryOrderRepository implements OrderRepository {
    private final Map<OrderId, Order> byId = new LinkedHashMap<>();

    @Override public Optional<Order> findById(OrderId id) {
        return Optional.ofNullable(byId.get(id));
    }
    @Override public Order save(Order order) {
        byId.put(order.id(), order);
        return order;
    }
}
```

Compared with mocking `OrderRepository`, this:

- **Cannot be internally inconsistent.** A mock stubbed so that `save` succeeds but
  `findById` returns empty describes a state no real repository can be in — and a test built
  on it proves nothing. The fake makes that combination impossible.
- **Is written once** instead of re-stubbed in every test.
- **Survives a refactor** of how the service uses the repository, because it responds to
  behaviour rather than to a recorded script.
- **Is honest about what it does not do.** No transactions, no constraints, no SQL. You know
  what you are not testing, which is more than a mock tells you.

Its cost is real too: it is production-shaped code living in the test tree, it needs to stay
in step with the interface, and a fake that grows features is a second implementation to
maintain. The argument for when each wins is
**12 · Mocks vs fakes** *(not written yet)*.

## Choosing, in practice

- **The collaborator is a boundary you do not control** (HTTP, gateway, clock) → a Mockito
  mock, stubbed. One or two stubbings.
- **The behaviour under test is "it told someone"** → a Mockito mock, verified. No stubbing.
- **The collaborator is yours, has state, and several tests need it** → a fake.
- **The collaborator is deterministic, fast and correct** (a value type, a pure function) →
  the real thing.
- **The parameter exists only to satisfy the signature** → a dummy. `mock(X.class)` with
  nothing else on it is a perfectly good dummy; so is `null`, where the code will not touch
  it.

## Gotchas

**★ Saying "mock" when you mean "stub", in a code review.**
The conversation then argues about whether the test verifies too much, when the actual
question was whether the canned return value is realistic. Name the double and the
disagreement usually resolves itself.

**★ Treating Mockito's `mock(...)` as classical-mock-only.**
It is both, depending on whether you `when` it or `verify` it. A test that does both to the
same interaction is asserting the same fact twice — which Mockito's own documentation calls
redundant.

**★ "Spy" used for a verified mock.**
Two different objects with opposite unstubbed behaviour: the real method runs on a spy, and
`null` comes back from a mock. Getting this wrong in conversation leads to a test that does
something nobody intended.

**★ A mock stubbed into a state the real thing cannot reach.**
`save` succeeding while `findById` returns empty; a `count()` of 3 with an empty `findAll()`.
Mocks have no invariants, so nothing stops you. The test then passes against a world that
does not exist.

**★ A fake that grows into a second implementation.**
Once the in-memory repository has query support and ordering and a cache, it is production
code without production tests. Keep fakes small; when one stops being small, the real
dependency in a container is probably the honest answer.

**★ A dummy that is not actually unused.**
`mock(X.class)` passed as filler will return `null` from every method — so if the code
*does* touch it, you get a `NullPointerException` from deep inside the code under test, far
from the argument that caused it.

**★ Using a fake where the point of the test is the boundary's failure modes.**
An in-memory repository cannot produce a constraint violation, a deadlock or a timeout. If
those are what you are testing, the fake is the wrong double and a real database is the
right one.

**★ Mixing doubles for the same collaborator across a test class.**
A mock in three tests and a fake in two, for the same interface, means two different sets of
assumptions about its behaviour live in one file. Pick one per collaborator per test class.

## Interview questions

**★ What is the difference between a stub and a mock?**
A stub supplies *input* to the code under test — it returns canned answers, and the test then
asserts on the outcome those answers produced. A mock records *output* that took the form of
a call, and the test asserts on the interaction itself. Stubs are about state; mocks are
about behaviour verification.

**★ Which of the five is `Mockito.mock(...)`?**
Both a stub and a mock, depending on how you use it. Stubbed with `when(...)` it is a stub;
asserted with `verify(...)` it is a mock. The API name says "mock" because that is the
framework's name for the object, not because it commits you to interaction verification.

**★ What is a spy, and what happens to an unstubbed method on one?**
A spy wraps a real object, so behaviour is real and calls are recorded. An unstubbed method
runs the real implementation — which is the opposite of a mock, where an unstubbed method
returns `null` or a zero value. That difference is why `when(...)` on a spy is a trap and
`doReturn(...)` is the safe form.

**★ When would you write a fake instead of using a mock?**
When the collaborator is yours, has state, and several tests need consistent behaviour from
it. A fake cannot be stubbed into an impossible state, it is written once instead of
re-stubbed per test, and it survives a refactor of how the code uses it. The cost is that it
is production-shaped code in the test tree, so it has to stay small.

**★ Give an example of a mock configuration that describes an impossible world.**
A repository mock where `save(order)` succeeds and `findById(order.id())` returns
`Optional.empty()`. No real repository behaves that way, but a mock has no invariants to stop
you, so the test passes against a state that cannot exist — and it proves nothing about the
real system.

**★ Why does the vocabulary matter if the code works either way?**
Because each kind of double licenses a different assertion. Verifying interactions on
something you are using as a stub couples the test to the conversation instead of the result;
asserting only outcomes when the behaviour *is* the call leaves it untested. Naming the
double correctly is how you notice you are asserting the wrong thing.

**★ Is `null` ever an acceptable test double?**
As a dummy, yes — a parameter that exists only to satisfy a signature and is never touched.
It is more honest than `mock(X.class)` in that role, because it fails loudly and immediately
if the code does touch it, rather than returning `null` from somewhere deeper and producing a
confusing stack trace.

{/* FOOTER */}
