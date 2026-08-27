---
title: "You mock a boundary you do not control in order to make a test deterministic, and every other reason people reach for a mock — speed, convenience, reaching a private method — produces a test that verifies your own assumptions back to you"
sidebar_label: "01 · What a mock is for"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the class javadoc of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java),
> sections 1 (verification), 2 (stubbing) and 3 (argument matchers). Mockito keeps its
> documentation in the javadoc *"because it guarantees consistency between what's on the web
> and what's in the source code"*, so the source and
> [site.mockito.org](https://site.mockito.org/) are the same text.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**A test is a claim about behaviour, and it can only be a claim if the same input always
produces the same output. Anything the test cannot control breaks that: a clock, a network
call, a payment gateway, a random number, a database that another test is also writing to.
A mock is how you take one of those out of the picture. That is the whole justification, and
it is narrower than how the tool is usually used — because a mock is also a very convenient
way to make an awkward test compile, and Mockito will not stop you.**

## The mechanic, in ten lines

Mockito's own opening example, with its own warning attached:

```java
//Let's import Mockito statically so that the code looks clearer
import static org.mockito.Mockito.*;

//mock creation
List mockedList = mock(List.class);

//using mock object
mockedList.add("one");
mockedList.clear();

//verification
verify(mockedList).add("one");
verify(mockedList).clear();
```

> *"The following examples mock a `List`, because most people are familiar with the interface
> (such as the `add()`, `get()`, `clear()` methods). **In reality, please don't mock the
> `List` class. Use a real instance instead.**"*

That warning is on the *first example in the documentation*, and it is the topic's whole
argument in miniature. `List` is not a boundary you do not control. It is deterministic,
fast, and already correct. Mocking it replaces a working implementation with your guess
about a working implementation.

> *"Once created, a mock will remember all interactions. Then you can selectively verify
> whatever interactions you are interested in."*

Two capabilities, and it is worth separating them from the start:

- **Stubbing** — deciding what the mock *returns*. This is about controlling the input to the
  code under test.
- **Verification** — asserting what the mock *was asked*. This is about observing the output
  of the code under test, when that output is a call rather than a value.

They are different tools for different situations, and the most common way to write a bad
mock-based test is to use both on the same interaction.

## What returns when you have not stubbed

> *"By default, for all methods that return a value, a mock will return either null, a
> primitive/primitive wrapper value, or an empty collection, as appropriate. For example 0
> for an int/Integer and false for a boolean/Boolean."*

This default is why an unmocked dependency does not blow up — and why it is dangerous. A
method you forgot to stub returns `null`, and the code under test proceeds with a `null`.
Sometimes it throws immediately, which is fine. Sometimes it takes the "not found" branch and
your test asserts a correct-looking result produced by a path you never intended to exercise.

## 🔴 The rule: mock what you do not control

A dependency is a candidate for mocking when it is at least one of:

- **Non-deterministic** — a clock, a random source, anything reading the real time.
- **Outside the process** — an HTTP call, a queue, a third-party API, a payment gateway.
- **Slow enough to change the shape of the suite** — something that turns a 2ms test into a
  2s one.
- **Hard to drive into the state you need** — an error path a real collaborator produces once
  a year.
- **A side effect you must not actually cause** — sending an email, charging a card.

It is *not* a candidate because:

- **It is inconvenient to construct.** That is a constructor problem, and a builder fixes it
  more honestly. See **08 · Test data patterns** *(not written yet)*.
- **It has a lot of methods.** A mock hides the size of the interface; it does not reduce it.
- **The real one is a value object.** `List`, `Money`, `LocalDate`, your own domain records —
  the real instance is faster than the mock and cannot be wrong about itself.
- **You want to reach a private method or an internal branch.** That is the class under test,
  and mocking it is the subject of
  **10 · Never mock the class under test** *(not written yet)*.

The test that follows from the rule: **could this dependency's real implementation make my
test fail for a reason unrelated to the behaviour I am testing?** If no, use the real one.

## What a mock costs

Every stubbing is an **assumption written down**. `when(gateway.charge(any())).thenReturn(OK)`
says "the gateway returns `OK` for this input" — and nothing verifies that it does. If the
real gateway returns `PENDING` for cards issued outside the EU, the mock does not know, the
test passes, and production fails.

So a mock-based test is only as good as the fidelity of its stubbings, and that fidelity
decays silently:

- **It cannot detect a contract change.** The real API adds a required field, your mock does
  not care, the test stays green.
- **It encodes your *belief* about the collaborator**, which was formed once, by one person,
  possibly from a skimmed API doc.
- **It couples the test to the interaction, not the outcome.** Change how the code achieves
  the result and the test breaks even though nothing observable changed.

This is why the topic keeps coming back to two counterweights: **contract tests** for the
boundary itself, and **fakes** — a real, small, in-memory implementation — where the
collaborator is yours and the interaction is complex. See
**12 · Mocks vs fakes** *(not written yet)*.

## The shape of a good mock-based test

```java
@Test
void a_declined_card_leaves_the_order_unpaid() {
    // the boundary we do not control, driven to a state that is rare in reality
    when(gateway.charge(any(Card.class))).thenReturn(ChargeResult.DECLINED);

    Order order = service.pay(anOrder(), aCard());

    // assert the OUTCOME
    assertThat(order.status()).isEqualTo(UNPAID);
}
```

One stubbing, because there is one thing outside our control. No `verify` on the charge,
because the assertion on `order.status()` already proves the call happened — if it had not,
the status would not be `UNPAID`. And the assertion is about the *result*, not about the
conversation.

Mockito says this itself, in the stubbing section, about verifying something you have already
stubbed:

> *"Although it is possible to verify a stubbed invocation, usually **it's just redundant**.
> If your code cares what `get(0)` returns, then something else breaks (often even before
> `verify()` gets executed). If your code doesn't care what `get(0)` returns, then it should
> not be stubbed."*

That is one of the sharpest sentences in the whole library's documentation, and it disposes
of a large fraction of the mock-heavy tests in the average codebase.

## When you genuinely do want `verify`

When the effect **is** the call and there is no return value to assert on:

```java
@Test
void a_confirmed_order_notifies_the_customer() {
    service.confirm(anOrder());

    verify(notifier).orderConfirmed(any(Order.class));
}
```

Nothing observable comes back, so the only evidence the behaviour happened is the
interaction. That is verification's job — and it is a smaller job than its popularity
suggests. See **05 · Verification** *(not written yet)* and
**05b · Verifying too much** *(not written yet)*.

## Gotchas

**★ Mocking a value type.**
`List`, `Map`, `String`, `LocalDate`, your own records. The documentation's very first
example carries the warning — *"please don't mock the `List` class. Use a real instance
instead."* The real one is faster, already correct, and cannot drift from itself.

**★ An unstubbed method returning `null` and the test still passing.**
The default return is `null`, `0`, `false` or an empty collection. Code that treats `null` as
"not found" will take that branch happily, and your test then asserts a result produced by a
path you did not mean to exercise.

**★ Stubbing and then verifying the same interaction.**
Mockito's own documentation calls this *"just redundant"*: if the code cares about the return
value, something downstream already fails when the call is missing; if it does not care, the
stubbing should not exist.

**★ Mocking to avoid building an object.**
The mock is not solving the problem — the constructor is hard to call, and it will be just
as hard in the next test. A builder or an object mother fixes it once.

**★ Mocking a collaborator you own, with complex behaviour.**
Twenty stubbings across six tests is a re-implementation of that collaborator, scattered.
A single in-memory fake is one implementation, in one place, that stays honest.

**★ Treating a passing mock-based test as evidence about the real collaborator.**
It is evidence about your *belief* regarding the collaborator. The real thing can change its
contract without a single test going red. That gap is what contract tests exist for.

**★ Mocking something purely because it is slow.**
Sometimes correct, and sometimes the right answer is a real dependency in a container — see
**07 · Testcontainers** *(not written yet)*. "Passed against a mock" and "passed against
PostgreSQL" are very different claims.

**★ A test with more setup than assertion.**
Six `when(...)` lines and one `assertThat`. The mock setup has become the specification, and
the test now documents the conversation rather than the behaviour.

**★ Assuming a mock is thread-safe in the way your code needs.**
A mock records every interaction. Under concurrent use from the code under test, what it
records and what it returns are a lot less obvious than the single-threaded case the test
was written for.

**★ Mocking a type you do not own.**
Your stubbing is a guess about a third-party API's behaviour, frozen at the moment you wrote
it, and upgrades cannot invalidate it. Covered in
**10b · Do not mock types you do not own** *(not written yet)*.

## Interview questions

**★ What is a mock actually for?**
Removing something the test cannot control, so the test becomes deterministic — a clock, a
network call, a third-party service, a side effect you must not really cause. Every other
motivation (it is awkward to construct, it has many methods, it is slow to build) is solving
a different problem with the wrong tool.

**★ Mockito's first documented example mocks a `List` and then tells you not to. Why?**
Because `List` is a value type you fully control: deterministic, fast, and already correct.
Mocking it replaces a working implementation with your assumptions about one. The example
exists to show the API, and the warning exists because people copy examples.

**★ What does an unstubbed method on a mock return, and why does that matter?**
`null` for objects, the zero value for primitives and wrappers, an empty collection where
appropriate. It matters because code that treats `null` as "absent" will take that branch
silently, so a forgotten stubbing produces a green test exercising a path you never intended.

**★ Why is verifying a stubbed call usually redundant?**
Mockito's own answer: if the code cares what the call returns, its absence breaks something
downstream — often before `verify()` is even reached. If the code does not care, the stubbing
should not be there. Either way the `verify` adds a failure mode without adding coverage.

**★ When is `verify` the right assertion?**
When the behaviour under test *is* the call and nothing observable comes back — sending a
notification, publishing an event, writing to an audit log. There is no return value to
assert on, so the interaction is the only evidence.

**★ What does a mock-based test not prove?**
Anything about the real collaborator. Every stubbing is an assumption recorded at one moment
by one person, and nothing keeps it in step with the real thing — the API can add a required
field or change a status code and every test stays green. Contract tests and integration
tests against a real dependency close that gap; mocks do not.

**★ Your teammate mocks a domain entity because it is awkward to construct. What do you
say?**
That the difficulty is a construction problem and will recur in every test, so a builder or
an object mother fixes it once and for all. And that mocking the entity means the test no
longer exercises its real behaviour — invariants in its constructor, logic in its methods —
so a bug there is now invisible to this test.

{/* FOOTER */}
