---
title: "Once the first test exists, two decisions decide whether the class ages well: whether the object under test is constructed explicitly or by @InjectMocks, and whether you wrote all three cases a fallible collaborator has rather than only the happy one"
sidebar_label: "02a · Building the test class"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the **Mockito 5.23.0** javadoc — §21 *"New annotations:
> @Captor, @Spy, @InjectMocks"*, §23 *"Automatic instantiation of @Spies, @InjectMocks and
> constructor injection goodness"*, §40 *"stricter" Mockito* and its unnecessary-stubbing
> detection, §12 stubbing with exceptions — read from `mockito-core-5.23.0-javadoc.jar` on
> Maven Central.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**[02](02-mocking-a-class-you-own.md) wrote one test. This chunk is the rest of the class:
how the object under test gets constructed, and which cases exist. Both look like matters
of taste and neither is. Explicit construction converts a whole category of future
`NullPointerException` into a compile error, and the three-case structure is the
difference between a suite that proves the happy path works and one that proves the
system does not corrupt itself when a boundary fails — which is the only failure your
users will ever see.**

## Why the test constructs the service with `new` rather than `@InjectMocks`

`@InjectMocks` works, Mockito documents it under *"constructor injection goodness"*, and
plenty of good codebases use it. The argument for `new` is narrow but it is real: **the
failure mode of `@InjectMocks` is a null field, and the failure mode of `new` is a
compile error.**

```java
@Mock PaymentGateway payments;
@Mock OrderRepository orders;
@Mock EmailSender email;
@InjectMocks CheckoutService service;   // works today
```

Now somebody adds a fifth constructor parameter — `FraudCheck fraud` — and does not
touch this test file. With `@InjectMocks`, the test still compiles and Mockito still
constructs *something*; `fraud` is null, and you get a `NullPointerException` from inside
`CheckoutService` on whichever test happens to reach that line. With `new
CheckoutService(payments, orders, email, CLOCK)` the build breaks at the call site, in the
file that needs changing, before anything runs.

There is a second, quieter benefit. `@InjectMocks` hides the arity, so a class can drift
to nine collaborators and no test ever gets uncomfortable. An explicit constructor call in
twelve test classes makes a nine-parameter constructor genuinely annoying, which is the
correct amount of annoying for a class with nine boundaries.

Use `@InjectMocks` when the constructor is stable and wide and you own both sides. Do not
use it as the default, and never use it with field injection, where it will reflectively
set private fields and remove the last signal that the design has a problem.

## The three cases every collaborator ticket needs

For a boundary that can fail — which is every boundary worth mocking — the test class is
not done at one happy path.

```java
@Test
void aSuccessfulPaymentMarksTheOrderPaidAndSendsTheConfirmation() {
    Order order = anOrder().withId("o-1").totalling("90.00").build();
    given(orders.findById(OrderId.of("o-1"))).willReturn(Optional.of(order));
    given(payments.charge(any())).willReturn(PaymentResult.succeeded("ch_123"));

    Receipt receipt = service.checkout(OrderId.of("o-1"));

    assertThat(receipt.chargeId()).isEqualTo("ch_123");
    assertThat(order.status()).isEqualTo(OrderStatus.PAID);
    verify(email).send(argThat(e -> e.orderId().equals("o-1")));
}

@Test
void aGatewayOutageDoesNotMarkTheOrderPaidAndDoesNotEmail() {
    Order order = anOrder().withId("o-1").totalling("90.00").build();
    given(orders.findById(OrderId.of("o-1"))).willReturn(Optional.of(order));
    given(payments.charge(any())).willThrow(new PaymentGatewayUnavailable());

    assertThatThrownBy(() -> service.checkout(OrderId.of("o-1")))
            .isInstanceOf(PaymentGatewayUnavailable.class);

    assertThat(order.status()).isEqualTo(OrderStatus.PENDING);
    verify(email, never()).send(any());
    verify(orders, never()).save(any());
}
```

1. **The collaborator succeeds** — the happy path.
2. **The collaborator returns a business failure** — declined, not-found, rejected. This
   is a *value*, not an exception, and it is the one people forget to distinguish from 3.
3. **The collaborator blows up** — timeout, connection reset, 500. This is an *exception*,
   and the question the test answers is "what state are we left in?"

Case 3 is where the interesting bug lives, because it is where partial work happens. In
the example above, the assertion that matters is `order.status()` is still `PENDING` — if
the code had marked it paid before charging, this test is the only thing that would ever
say so.

## The fourth case, which is not always there but is always worth asking about

Three cases cover a collaborator that returns a result or throws. Two more come up often
enough to be on the checklist:

**4 · The collaborator returns nothing when you expected something.** `Optional.empty()`,
an empty list, a `null` from a foreign API. This is distinct from a business failure
because the code frequently has *no branch for it at all* — the bug is an unhandled
`NoSuchElementException` three lines later, and the test that finds it is a two-line stub.

```java
@Test
void anUnknownOrderIsRejectedBeforeAnyCharge() {
    given(orders.findById(OrderId.of("nope"))).willReturn(Optional.empty());

    assertThatThrownBy(() -> service.checkout(OrderId.of("nope")))
            .isInstanceOf(OrderNotFound.class);

    verifyNoInteractions(payments, email);
}
```

Note `verifyNoInteractions(payments, email)` rather than two `never()` calls: here the
claim genuinely is *nothing at all happened to these boundaries*, and that is the
assertion that catches a future refactor which charges the card before validating the
order.

**5 · The collaborator is called more than once.** Retries, pagination, a loop over line
items. If the production code can call the boundary twice, a test that stubs one answer
and asserts one outcome is describing a case that does not exist. Mockito's consecutive
stubbing — `willReturn(a, b)` — plus `verify(mock, times(2))` is the shape, and the trap
is in [01b](01b-the-js-to-java-map.md): the last value repeats forever, it does not fall
back to a default.

## Strict stubbing is what makes the three-case structure cheap

Each of these tests stubs only what its own case needs. That is only comfortable because
`MockitoExtension` defaults to `STRICT_STUBS`, whose documented benefits include
*"Unnecessary stubbing detection"* — a stub that no test path reaches fails the test
rather than sitting there.

The practical consequence is a rule you can apply without thinking: **if a stub belongs in
`@BeforeEach`, it is probably wrong.** Under strict stubbing a shared stub that only two
of five tests use will fail the other three, and the usual reaction — switching the class
to `LENIENT` — disables the detector for everything written afterwards. Keep the
construction shared and the stubbing local, and the four or five cases stay independently
readable.


## Where this connects

- The first test, the production class, and the stub-the-query/verify-the-command rule are
  [02 · Mocking a class you own](02-mocking-a-class-you-own.md).
- Whether the collaborator should be mocked at all:
  [01](01-what-to-mock-and-what-to-let-run.md). What goes wrong when the answer is "all of
  them": [01a](01a-the-four-failure-modes.md).
- When there is no constructor parameter to hand a mock to:
  [02b](02b-when-the-collaborator-is-hard-to-mock.md).
- The infrastructure-failure case for a real HTTP boundary — 500, 429, timeout, reset,
  malformed body — is [03c · The error paths nobody writes](03c-the-error-paths-nobody-writes.md).
- `@Mock`, `@InjectMocks`, strictness, `MockitoExtension` and consecutive stubbing belong
  to **topic 04 · Mockito**; the builders used for the real domain objects belong to
  **topic 08 · Test data patterns**.

## Gotchas

**★ `@InjectMocks` turns "the constructor gained a parameter" from a compile error into a runtime `NullPointerException` in an unrelated test.**
Mockito will construct the object with whatever it can match and leave the rest null, and the failure surfaces inside your production class rather than at the wiring. Explicit `new` in `@BeforeEach` costs one line and makes the compiler do the work. If a team insists on `@InjectMocks`, at least never combine it with field injection, where it will reflectively populate private fields and hide the arity completely.

**★ Business failure and infrastructure failure are different tests, and merging them hides the state question.**
A declined card is a `PaymentResult` you handle; a gateway timeout is an exception that unwinds you. They leave the order in different states and they exercise different branches. Teams routinely write only the exception case, or only the declined case, and ship the other one's bug. If the collaborator can do both, there are two tests.

**★ The most valuable assertion in the failure test is the one about what did *not* change.**
`assertThat(order.status()).isEqualTo(PENDING)` in the outage test is what catches "we marked the order paid before the charge succeeded". Nobody writes it by instinct, because it asserts an absence. Every test of a failing collaborator should ask: what work might have been half-done here, and does anything check that it was not?

**★ The "collaborator returns empty" case is the one with no branch in production, which is exactly why it is worth writing.**
Success and failure both usually have code paths someone thought about. `Optional.empty()`, an empty list or a `null` from a foreign API frequently has none — the author assumed the lookup succeeds. The test costs two lines and the bug it finds is an unhandled exception in a code path that runs on real data every day. Add it whenever the collaborator's signature admits emptiness, which for anything returning `Optional`, a collection or a nullable foreign type is always.

**★ Mockito refuses `willThrow` for a checked exception the method does not declare, and that refusal is a design message.**
It reads as an annoyance and it is actually the framework telling you the interface does not admit that failure. Either the exception belongs in the signature — in which case add it and let every caller confront it — or it does not, in which case the adapter must translate it into something that does. Suppressing the problem by making the exception unchecked is a decision, not a workaround, and it should be made deliberately at the interface rather than accidentally at the test.

**★ `verify(mock, times(2))` and a single-value stub describe two different worlds, and only one of them is your production code.**
If the service retries, the stub must supply a sequence — `willReturn(failure, success)` — or the second call gets the first answer again and the retry appears to work when it cannot. A test that asserts a retry path while stubbing one constant answer is one of the most convincing false positives in the whole toolkit, because it is green and it names retrying in its method name.

**★ Switching a whole class to `Strictness.LENIENT` to silence one unnecessary-stubbing failure disables the detector for every test written afterwards.**
The failure is nearly always correct: a stub in `@BeforeEach` that only some tests use. The right move is to push the stub down into the tests that need it, which also makes each test's arrangement readable on its own. `lenient()` on the single stubbing that genuinely must be shared is a far smaller blast radius than the class-level annotation.

## Interview questions

**★ Walk me through how you would test a service that charges a card and sends a confirmation email.**
I would give the service a constructor taking a `PaymentGateway` interface I own, the repository, an email sender and a `Clock`, so every boundary is visible in the signature. Then three tests, not one. Success: stub the gateway to succeed, assert the returned receipt and the order's state, and verify the email was sent with the right order id. Business failure: stub the gateway to return a declined result, assert the exception and the `PAYMENT_FAILED` state, and verify `never()` on the email. Infrastructure failure: stub the gateway to throw, assert the exception, and — the assertion people miss — assert the order is still `PENDING` and nothing was saved or sent. That last one is the only test that catches "we marked it paid before the charge returned". I would stub the queries and verify only the side effects, and I would not verify `charge` itself, because if it had not been called the stub would never have fired and the assertions would already have failed.

**★ Why do you construct the class under test with `new` instead of `@InjectMocks`?**
Because I want the compiler to notice when the constructor changes. `@InjectMocks` matches what it can and leaves the rest null, so adding a fifth dependency to the service produces a `NullPointerException` inside my production class during some unrelated test, at run time. Explicit construction in `@BeforeEach` produces a compile error in exactly the file that needs updating. There is a second reason that matters more over a codebase's life: the explicit call makes the number of collaborators visible and mildly annoying, which is appropriate feedback for a class that has grown eight boundaries. `@InjectMocks` makes that growth free. I am not dogmatic about it — for a stable, narrow constructor it is fine — but I would never combine it with field injection, because then it is hiding the design problem rather than merely not surfacing it.

**★ How do you decide whether a collaborator's failure should be a return value or an exception in your interface, and does it change the test?**
Business outcomes that the caller is expected to handle — declined, out of stock, rate not found — are return values, because they are part of the normal flow and an exception would make the caller use `try`/`catch` for control flow. Infrastructure failures — timeout, connection reset, a 500 — are exceptions, because there is nothing sensible for this layer to do with them and they must unwind. It changes the test substantially: the return-value case is stubbed with `willReturn` and asserted on the resulting state, while the exception case is stubbed with `willThrow` and the interesting assertion is about what was *not* left half-done. It also changes the interface, which is the point — designing the two cases differently forces you to decide which failures are part of the domain, and that decision is much harder to make later.

**★ A service has three collaborators and each can fail. How many tests is that, and how do you keep it from exploding?**
Not twenty-seven. Failure cases compose linearly, not combinatorially, because each boundary's failure is handled at one place and the handling does not depend on what the other boundaries would have done. So I write the happy path once, then one test per boundary per *distinct kind* of failure it can produce — typically a business failure and an infrastructure failure for the ones that have both, and a single "returns empty" case for lookups. That is usually six to eight tests for three collaborators, and each one has a name that states a real scenario. The explosion happens when people try to enumerate combinations; the cure is to notice that a test asserting "if the gateway times out *and* the repository is empty" is describing a path the code cannot even reach, because the repository is consulted first.

**★ You find a test named `retriesOnceOnTimeout` that stubs the gateway with a single `willThrow`. What is wrong with it?**
It cannot be testing a retry. A single `willThrow` throws on every call, so either the production code does not retry and the test passes for the wrong reason, or it does retry and the second attempt throws too, and the test is asserting the exhausted-retries path while claiming to assert the successful one. The correct arrangement is consecutive stubbing — throw on the first call, return a success on the second — plus `verify(gateway, times(2)).charge(any())`. And Mockito's consecutive stubbing has a trap worth stating: the last value repeats forever rather than falling back to a default, so "fail, fail, succeed" must name the success explicitly as the final value.

**★ Your team's test class has eight stubs in `@BeforeEach` and `@MockitoSettings(strictness = LENIENT)` at the top. What does that tell you, and what would you do?**
That someone hit unnecessary-stubbing failures and silenced the detector instead of reading it. The strict-stubs failure was correct: most of those eight stubs are needed by two or three of the tests, not by all of them, and the shared block is now hiding which arrangement each test actually depends on — the same comprehension cost a forty-line data fixture has. I would push each stub down into the tests that use it, delete the class-level leniency, and if one genuinely universal stub remains, mark that single stubbing `lenient()` rather than the whole class. The side effect is that each test becomes independently readable, which is usually what people were missing when they said the suite was hard to work with.

{/* FOOTER */}
