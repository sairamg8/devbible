---
title: "The everyday case is a service with one collaborator, and the whole test is decided before you type a line of it — by whether the constructor takes the collaborator, by which interface it takes, and by whether you stub the query or verify the command"
sidebar_label: "02 · Mocking a class you own"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the **Mockito 5.23.0** javadoc — §1–3 stubbing and
> verification, §21 `@Captor`/`@Spy`/`@InjectMocks`, §23 *"Automatic instantiation of
> @Spies, @InjectMocks and constructor injection goodness"*, §40 strict stubbing, §55
> `assertArg` — read from `mockito-core-5.23.0-javadoc.jar` on Maven Central; and the
> **Spring Framework 7.0.x** reference for bean overrides.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**This is the ticket you get most weeks: a service, one collaborator that does I/O, and a
behaviour to prove. Nothing about it is hard, and almost everyone writes it slightly
wrong in the same two ways — they verify calls the assertion already covers, and they
stub and verify the same method. This chunk is the shape of the test that does neither,
and the argument that the constructor you had to write in order to get there is the
actual deliverable. How the rest of the test class is assembled, and which cases it needs
beyond this one, is [02a](02a-building-the-test-class.md).**

## The ticket

> *When the payment gateway declines a charge, the order must end up in
> `PAYMENT_FAILED`, no confirmation email may be sent, and the caller must get a
> `PaymentDeclinedException` carrying the gateway's decline code.*

Three assertions and a negative. That is a completely ordinary piece of work and it is
worth doing carefully, because the shape generalises to every other collaborator ticket
in this topic.

## The production class, and why its constructor is the test API

```java
@Service
public class CheckoutService {

    private final PaymentGateway payments;
    private final OrderRepository orders;
    private final EmailSender email;
    private final Clock clock;

    public CheckoutService(PaymentGateway payments, OrderRepository orders,
                           EmailSender email, Clock clock) {
        this.payments = payments;
        this.orders = orders;
        this.email = email;
        this.clock = clock;
    }

    public Receipt checkout(OrderId id) {
        Order order = orders.findById(id).orElseThrow(() -> new OrderNotFound(id));

        PaymentResult result = payments.charge(
                new ChargeRequest(order.total(), order.paymentToken(), id.value()));

        if (result.declined()) {
            order.markPaymentFailed(result.declineCode(), clock.instant());
            orders.save(order);
            throw new PaymentDeclinedException(result.declineCode());
        }

        order.markPaid(result.chargeId(), clock.instant());
        orders.save(order);
        email.send(ConfirmationEmail.forOrder(order));
        return new Receipt(result.chargeId(), order.total());
    }
}
```

Four constructor parameters and four fields. There is nothing clever here, and that is the
point: **every seam this test will use is visible in the constructor signature.** A
reviewer can count the boundaries of this class without opening the body, and a reader of
the test can see exactly what the class is allowed to touch.

Two things in that signature are deliberate and worth defending.

**`PaymentGateway` is an interface *you* define, not the vendor's type.** It has one
method, it speaks in your domain's vocabulary (`ChargeRequest`, `PaymentResult`), and it
lives in the same package as `CheckoutService` — because it is a description of what
*this consumer needs*, not a description of what the payment provider offers. That is what
makes the mock honest, per [01](01-what-to-mock-and-what-to-let-run.md). The adapter that
implements it against the real API is a separate class with its own HTTP test.

**`Clock` is a constructor parameter, not an ambient `Instant.now()`.** It costs one line
in the Spring configuration (`@Bean Clock clock() { return Clock.systemUTC(); }`) and it
buys every future test the ability to state a time.

## The test

```java
@ExtendWith(MockitoExtension.class)
class CheckoutServiceTest {

    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-03-01T10:15:30Z"), ZoneOffset.UTC);

    @Mock PaymentGateway payments;
    @Mock OrderRepository orders;
    @Mock EmailSender email;

    private CheckoutService service;

    @BeforeEach
    void setUp() {
        service = new CheckoutService(payments, orders, email, CLOCK);
    }

    @Test
    void aDeclinedPaymentFailsTheOrderAndSendsNoEmail() {
        Order order = anOrder().withId("o-1").totalling("90.00").build();
        given(orders.findById(OrderId.of("o-1"))).willReturn(Optional.of(order));
        given(payments.charge(any())).willReturn(PaymentResult.declined("insufficient_funds"));

        assertThatThrownBy(() -> service.checkout(OrderId.of("o-1")))
                .isInstanceOf(PaymentDeclinedException.class)
                .hasMessageContaining("insufficient_funds");

        assertThat(order.status()).isEqualTo(OrderStatus.PAYMENT_FAILED);
        assertThat(order.failedAt()).isEqualTo(Instant.parse("2026-03-01T10:15:30Z"));
        verify(email, never()).send(any());
    }
}
```

Read what that test does and does not do.

- It **stubs the two queries** — `findById` and `charge` — because the service needs
  answers from them.
- It **asserts on state**: the order's status and its failure timestamp. Those are the
  observable outcome, and they can be wrong.
- It **verifies exactly one thing**: that no email was sent. That is a *negative* about a
  side effect, and there is no state to assert it from — the only way to observe "nothing
  was sent" is to ask the mock.
- It does **not** `verify(orders).save(order)`. The assertion on `order.status()` already
  proves the state transition happened; adding the verification would couple the test to
  the fact that persistence goes through `save` rather than, say, a dirty-checking JPA
  session.

That last point is the discipline that keeps these tests from ossifying.

## Stub the query, verify the command — and never both to the same method

The rule is command–query separation applied to test doubles, and it removes most of the
argument about "how much verification is too much".

| The collaborator method… | What the test does | Why |
|---|---|---|
| returns a value the code needs (`findById`, `charge`, `currentRate`) | **stub it** | The value is an input to the logic. Verifying it too just asserts the code read its own input. |
| causes an effect outside the unit (`send`, `publish`, `deleteFile`) | **verify it** | There is no return value to assert on. The call *is* the observable behaviour. |
| does both (`save` returning the saved entity) | stub it, and verify **only** if the persistence itself is the behaviour under test | Doing both to one method is how tests double-count. |

The double-count looks like this and is extremely common:

```java
// ⛔ both halves of the same fact, stated twice
given(payments.charge(any())).willReturn(PaymentResult.declined("insufficient_funds"));
// ... call ...
verify(payments).charge(any());   // adds nothing: if it hadn't been called, the stub
                                  // would never have fired and the assertion would fail
```

If the code had not called `charge`, `result` would have been null and the test would have
failed at the assertion. The `verify` is unreachable-by-construction and pure maintenance
cost. Mockito's own javadoc makes the same point about a stubbed `get(0)`:

> *"Although it is possible to verify a stubbed invocation, usually it's just redundant.
> If your code cares what `get(0)` returns, then something else breaks (often even before
> `verify()` gets executed). If your code doesn't care what `get(0)` returns, then it
> should not be stubbed."*

The exception worth knowing: verify a stubbed method when **the arguments** are the thing
under test and no assertion reaches them. That is the subject of
[03d · Asserting what you sent](03d-asserting-what-you-sent.md), and it is why
`ArgumentCaptor` and `assertArg` exist.

## Where this connects

- How the test class is assembled — explicit construction instead of `@InjectMocks` — and
  the three cases every collaborator ticket needs (success, business failure,
  infrastructure failure) are
  [02a · Building the test class](02a-building-the-test-class.md).
- Whether this collaborator should be mocked at all is
  [01 · What to mock and what to let run](01-what-to-mock-and-what-to-let-run.md).
- When the collaborator is a static call, a `new` inside the method, a final class or a
  vendor SDK — so there is no constructor parameter to hand a mock to — the answer is
  [02b](02b-when-the-collaborator-is-hard-to-mock.md).
- The `PaymentGateway` implementation's own test, against a stubbed HTTP endpoint, is
  [03](03-mocking-an-outbound-http-api.md).
- Asserting the *contents* of what was sent to a collaborator is
  [03d](03d-asserting-what-you-sent.md).
- `@Mock`, `@InjectMocks`, argument captors, `given`/`willReturn`, strictness and
  `MockitoExtension` all belong to **topic 04 · Mockito**. The Spring-context version of
  the same idea — `@MockitoBean` — belongs to **topic 05 · The test pyramid**. The
  `anOrder()` builder belongs to **topic 08 · Test data patterns**.

## Gotchas

**★ Verifying a method you also stubbed is almost always redundant, and Mockito's own javadoc says so.**
If the code needs the stubbed return value, an omitted call makes the assertion fail on its own; if the code does not need it, the stub should not exist. The verification adds a line that can only break during refactoring. The genuine exception is when the *arguments* carry the behaviour under test and nothing else observes them — then verify with a captor or `assertArg`, and drop the redundant no-arg `verify`.

**★ Asserting on a mutable domain object that the service mutated is only meaningful if the object is real.**
`assertThat(order.status()).isEqualTo(PAYMENT_FAILED)` works in the example because `order` is a real `Order` built by a builder and passed back through the stubbed `findById`. If `order` were a `@Mock`, `markPaymentFailed` would do nothing and `status()` would return null — and the test would fail in a way that looks like a production bug. This is the "never mock a value" rule showing up as a concrete debugging cost.

**★ A negative verification with `any()` is weaker than it looks: `verify(email, never()).send(any())` passes if the code called an overload you did not check.**
`never()` only constrains the method you named with the matchers you gave. If `EmailSender` has both `send(Email)` and `send(String, String)`, the negative proves nothing about the second. On a boundary where "nothing at all happened" is the assertion, `verifyNoInteractions(email)` says what you actually mean.

**★ A stubbed method whose argument you never constrain will match a call with the wrong arguments.**
`given(orders.findById(any())).willReturn(Optional.of(order))` makes the test pass even if `checkout` looks up the wrong order id. Constrain the argument (`findById(OrderId.of("o-1"))`) whenever the identity matters, which for a lookup is essentially always. `any()` belongs on arguments the test genuinely does not care about — and if you find you never care about any of them, the test is not testing much.

**★ Putting the service construction in `@BeforeEach` is fine; putting the stubbing there is not.**
Constructing `service` from the mocks is invariant across every test in the class. Stubbing `findById` is not — it is the arrangement of a particular case, and moving it into setup both hides the case and, under strict stubbing, forces someone to switch strictness off for the class. Keep the wiring shared and the arrangement local.

**★ An interface with one implementation and no I/O is not a seam, it is indirection.**
Teams sometimes extract `PricingRulesInterface` purely so a mock exists. That produces a test where the rule under test is stubbed, plus a production interface with no second implementation and no purpose. Only extract the interface when there is something on the other side of it that you genuinely cannot run in a test — a network, a clock, a queue, a vendor.

**★ Defining the collaborator interface in the *provider's* package undoes half the benefit.**
If `PaymentGateway` lives in an `infrastructure.stripe` package next to its implementation, it will drift towards exposing the vendor's concepts — `StripeCharge`, `stripeCustomerId` — and your mock ends up asserting Stripe's model after all. Put the interface next to the consumer that needs it, phrased in your domain's language. The adapter can be as ugly as the vendor requires; that ugliness stays in one file.

## Interview questions

**★ When is it right to `verify()` at all, if you can assert on state?**
When there is no state to assert on, which is precisely when the collaborator's job is a side effect that leaves the process. Sending an email, publishing an event, deleting an object from a bucket, enqueuing a message — the call *is* the observable behaviour, and a mock is the only observer available in a unit test. The other legitimate case is a negative: proving something did not happen, like `verify(email, never()).send(any())`, or better `verifyNoInteractions(email)` when I mean "nothing at all". What I try to avoid is verifying calls whose effects the assertions already cover, because those verifications cannot fail for a behavioural reason but can fail for a structural one — they are pure refactor tax.

**★ Your `PaymentGateway` interface has exactly one implementation. Isn't that just indirection for the sake of testing?**
It would be, if the implementation had no I/O — and in that case I would delete the interface and use the class. Here the implementation makes an HTTPS call to a third party, which is the thing the unit test cannot afford and the thing whose contract I do not control. The interface is doing two jobs, and only one of them is about testing: it is the anti-corruption boundary that keeps the vendor's types, exceptions and pagination model out of my domain code. The test seam is a consequence of that, not the motivation. The check I apply is whether the interface is phrased in my language or the vendor's — if it takes a `StripeCharge`, I have added indirection without adding a boundary.

**★ A test in your codebase stubs `findById(any())`. What would you change and why?**
I would constrain the argument to the id the test is about. `any()` on a lookup means the test passes even if the production code looks up entirely the wrong entity — a very real bug, especially where two ids of the same type are in scope. `any()` earns its place on arguments the test genuinely does not care about, like a correlation id or a timestamp, and it is fine on `charge(any())` in the example above because the *contents* of the charge request are the subject of a different, dedicated test. The heuristic is: if the value distinguishes this test case from another one, name it.

{/* FOOTER */}
