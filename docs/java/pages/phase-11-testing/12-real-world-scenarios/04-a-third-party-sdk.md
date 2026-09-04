---
title: "A payment, mail or storage SDK hands you a fat client you cannot mock honestly, so the test you write is not a test of the SDK but a test of the one class you wrote to keep the SDK out of everything else"
sidebar_label: "04 · A third-party SDK"
sidebar_position: 22
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.9** javadoc for
> `org.springframework.test.context.bean.override.mockito.MockitoBean`
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/bean/override/mockito/MockitoBean.html)),
> the **Testcontainers 2.0.5** LocalStack module page
> ([java.testcontainers.org](https://java.testcontainers.org/modules/localstack/)), and
> Stripe's **stripe-mock** repository description ([github.com/stripe/stripe-mock](https://github.com/stripe/stripe-mock)).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7,
> Testcontainers 2.0.5.
> ⚠️ **No sandbox and no test runs on this machine** — this page carries Java source and
> documented behaviour, never console output.

**You have been asked to charge a card. The vendor ships a 400-class SDK whose entry point
is a `final` class built by a static factory, whose response object has sixty fields, and
whose exception hierarchy has eleven subtypes. Every instinct says "mock the client".
That instinct produces a test that asserts what *you believe* the SDK does — which is
precisely the thing you are least sure about. The honest move is to stop trying to test
through the SDK and instead put one small interface in front of it that you own, mock
*that* everywhere else, and give the adapter its own, different kind of test.**

## The shape of the problem, concretely

An SDK client is hostile to testing in four distinct ways, and it helps to name them
separately because each one has a different consequence.

```java
// The vendor's world. You control none of this.
StripeClient client = StripeClient.builder()
        .setApiKey(secret)
        .build();

PaymentIntent intent = client.paymentIntents().create(
        PaymentIntentCreateParams.builder()
                .setAmount(2_500L)                   // minor units, vendor's convention
                .setCurrency("gbp")
                .setCustomer("cus_ABC123")
                .putMetadata("orderId", "10042")
                .build(),
        RequestOptions.builder()
                .setIdempotencyKey(key)
                .build());

if ("succeeded".equals(intent.getStatus())) { ... }
```

1. **The types are the vendor's.** `PaymentIntent`, `PaymentIntentCreateParams`,
   `RequestOptions` are classes you did not write and cannot change. If they appear in
   your service's signature, your service now compiles against the vendor.
2. **The construction is not injectable by default.** `StripeClient.builder()…build()` is
   a static call. Whatever class contains that line cannot be given a different client in
   a test without a seam being added on purpose.
3. **The vocabulary is wrong for your domain.** `"succeeded"` is a `String`. Amounts are
   `long` minor units. Your domain has `Money` and a `PaymentOutcome` enum, or it should.
4. **The failure taxonomy is the vendor's, not yours.** `CardException`,
   `RateLimitException`, `ApiConnectionException`, `IdempotencyException` — eleven types
   that collapse, from your application's point of view, into about three decisions:
   *tell the customer their card was refused*, *retry later*, *page someone*.

Mocking the client attacks none of these. It leaves all four in place and adds a fifth
problem — a stub that says the SDK behaves as you assumed.

## Why "just mock `StripeClient`" is the wrong default

The general argument — *do not mock types you do not own* — belongs to **topic 04 ·
Mockito**, which owns the reasoning. What is worth adding here is the specific, concrete
cost in an SDK-shaped situation, because it is sharper than the general case.

**Your mock is a written record of your assumptions, and assumptions are the defect.**
When you write `when(paymentIntents.create(any(), any())).thenReturn(succeededIntent())`,
you have asserted that a successful create returns an intent with `status == "succeeded"`.
Stripe's real API can return `requires_action` (3-D Secure), `requires_capture` (manual
capture), or `processing`. Your mock never returns those, so your service never handles
them, and the test suite is a full-colour green certificate that it does.

**Two mocks deep is a different program.** SDKs are fluent:
`client.paymentIntents().create(...)`. Mocking that requires a mock returning a mock, or
`RETURNS_DEEP_STUBS`. At that point the test's setup is a small re-implementation of the
SDK's object graph, and every SDK upgrade that reshapes the graph breaks tests that are
about payments, not about graphs.

**The mock cannot fail the way the SDK fails.** A `final` response class with no public
constructor may not be instantiable at all in your test; you end up mocking the *response
object too*, and now `intent.getCharges().getData().get(0).getOutcome().getReason()`
returns whatever a chain of mocks felt like returning. That is not a test of a refund
path. It is a test of Mockito.

## The anti-corruption interface

Write the interface your application wants. Not the one the SDK offers. It goes in your
domain or application package, and it names nothing the vendor invented.

```java
package com.example.payments;

public interface PaymentGateway {

    /**
     * Charges the customer. Must be safe to call twice with the same
     * idempotencyKey: the second call returns the first call's outcome.
     */
    PaymentResult charge(ChargeRequest request);

    RefundResult refund(PaymentReference reference, Money amount);
}
```

```java
public record ChargeRequest(
        CustomerId customer,
        Money amount,
        OrderId order,
        IdempotencyKey idempotencyKey) {}

public sealed interface PaymentResult {
    record Captured(PaymentReference reference)            implements PaymentResult {}
    record Declined(DeclineReason reason)                  implements PaymentResult {}
    record RequiresCustomerAction(URI redirect)            implements PaymentResult {}
}
```

Two properties make this interface worth having, and both are testable properties of the
*source*, not of a run:

- **No vendor type crosses it.** No `com.stripe.*` in the signature, in the record
  components, or in the thrown exceptions. Grep is the test:
  `grep -rn "com\.stripe" src/main/java --include=*.java` should return exactly one
  package.
- **It is small enough to stub by hand.** Two methods. A hand-written
  `InMemoryPaymentGateway` fake is fifteen lines, and for a lot of service tests it is a
  better collaborator than a mock — the argument for that trade is **topic 04 · Mockito**'s
  *mocks vs fakes*.

Now the SDK lives in exactly one class:

```java
package com.example.payments.stripe;

class StripePaymentGateway implements PaymentGateway {

    private final StripeClient client;   // injected — this is the seam

    StripePaymentGateway(StripeClient client) {
        this.client = client;
    }

    @Override
    public PaymentResult charge(ChargeRequest request) {
        try {
            PaymentIntent intent = client.paymentIntents().create(
                    toParams(request), toOptions(request.idempotencyKey()));
            return toResult(intent);
        }
        catch (CardException e) {
            return new PaymentResult.Declined(DeclineReason.from(e.getDeclineCode()));
        }
        catch (StripeException e) {
            throw new PaymentGatewayUnavailable(e);
        }
    }
    ...
}
```

Note what moved. `StripeClient.builder()` is gone from this class — it now lives in a
`@Configuration` that produces the client as a bean. That single change is what makes the
adapter constructible in a test with a client pointed at something other than the real
API.

## Where this connects

- **Fork C's 02b · When the collaborator is hard to mock** covers the general refactors —
  static methods, `new` inside a method, final classes — and the SDK case is its largest
  instance. This page is the SDK-specific version of that argument.
- **Topic 04 · Mockito** owns *do not mock types you do not own*, the anti-corruption
  adapter pattern, mocks vs fakes, and static/final mocking. Nothing here re-teaches them.
- What you then test, in which of three populations, and how the error translation gets
  pinned, is [04b · The adapter and the three test populations](04b-the-adapter-and-the-three-test-populations.md).
- The socket-level half — the SDK's own double, LocalStack, GreenMail, stripe-mock — is
  [04c · The SDK's own test double](04c-the-sdks-own-test-double.md).
- When the SDK is already wired into a class with no seam at all — a `static` client field
  in a 900-line service — the order of operations is
  [11 · The legacy class with no seams](11-the-legacy-class-with-no-seams.md).

## Gotchas

**★ An interface that returns the SDK's type is not an anti-corruption interface.**
`PaymentIntent charge(ChargeRequest r)` looks like a seam and is not one: every caller
still imports `com.stripe.model.PaymentIntent`, still reads `getStatus()` as a `String`,
and still breaks when the SDK's major version renames the field. The whole benefit comes
from the *return* type being yours. The check is mechanical — if the interface's file
needs an `import com.stripe.…`, it has failed.

**★ Deep stubs on a fluent SDK make a test that cannot fail.**
`mock(StripeClient.class, RETURNS_DEEP_STUBS)` means every navigation you write returns
another mock instead of throwing. `intent.getLastPaymentError().getCode()` returns `null`
rather than exploding, your `if` takes the wrong branch silently, and the assertion you
wrote passes for a reason unrelated to the code. If you find yourself reaching for deep
stubs on a vendor type, that is the signal that the seam is in the wrong place.

**★ The seam is the `@Bean` method, not the mock — and adding it is a production change,
not a test change.**
`StripeClient.builder()…build()` inside the adapter is what makes the adapter untestable,
and no amount of test-side cleverness fixes it. Moving that expression into a
`@Configuration` and taking `StripeClient` as a constructor parameter is a one-commit
production refactor that changes no behaviour, and it is the precondition for everything
else on this page. Reviewers who object to "changing production code for a test" should be
shown that the change also makes the API key configurable per environment, which they
wanted anyway.

**★ Swapping the vendor is not the reason to write the interface, and pretending it is
gets the interface rejected in review.**
"We might move off Stripe" is a weak, usually false argument, and a reviewer is right to
push back. The real reasons are all present on day one: the service tests get fast and
readable, the failure taxonomy gets collapsed into decisions you can reason about, the
money-unit conversion gets a single home, and the SDK upgrade blast radius becomes one
class. Make *those* the case.

**★ A `sealed` result type forces callers to handle the outcome you forgot; a `String`
status does not.**
`PaymentResult` as a sealed interface with three permitted records means a `switch` over it
is checked by the compiler, so the day you add `RequiresCustomerAction` every caller stops
compiling until it decides what to do. Return `String status` and the same change is
silent, the `else` branch swallows it, and the customer sees a spinner. The sealed type is
doing test-like work at compile time, which is the cheapest place to do it.

**★ The interface leaks back gradually, one convenience parameter at a time.**
Six months in, someone needs the raw vendor response "just for logging", so the record
grows a `PaymentIntent raw` component; then someone reads a field off it. The interface is
now leaky and no single commit made it so. The enforceable guard is an architecture test —
ArchUnit or a `grep` in CI — asserting that only `com.example.payments.stripe` may import
`com.stripe`. That check is worth more than a convention in a wiki.

## Interview questions

**★ Why not just mock the SDK client? It is one line and it works.**
Because the mock encodes your assumptions about the SDK, and the SDK's behaviour is the
thing you are least certain about — so the test is confident about exactly the wrong thing.
Concretely: your stub returns `status == "succeeded"`, the real API can return
`requires_action`, `requires_capture` or `processing`, and no test in your suite will ever
show you that. Add to that the mechanical problems — fluent APIs force deep stubs, final
response classes force you to mock the responses too, and every SDK upgrade breaks tests
about payments rather than tests about the SDK — and the cost is not one line, it is a
permanent tax paid by every test that touches money. The alternative costs one interface,
one adapter class, and it moves the SDK into a corner where a small number of *different*
tests can exercise it honestly.

**★ Where exactly do you draw the boundary of the anti-corruption interface?**
At the point where the vendor's vocabulary stops being useful to your domain. The method
names are yours (`charge`, `refund`), the parameters are your value objects (`Money`,
`CustomerId`), the return type is a sealed hierarchy of *your* outcomes, and the exceptions
are yours. The mechanical test is that the interface's source file needs no vendor import,
and that `grep` for the vendor package returns exactly one package in `src/main/java`. If
the interface returns `PaymentIntent`, you have moved the coupling one file and gained
nothing.

**★ The SDK's client is a `final` class with a private constructor and the vendor ships no
interface. Now what?**
You still do not mock it. The `final` problem is a problem for the adapter test only, and
the adapter test does not want a mock — it wants a real client pointed at a fake server.
Build the real `StripeClient` in the test with the base URL overridden to a local stub or
the vendor's own mock server, inject it into the adapter, and let the SDK do its real
serialization. Everything above the adapter mocks your own interface, which is not final,
not vendor-owned, and has two methods. The `final` class stops being a testing problem the
moment you stop trying to test through it. Mockito's inline mock maker *can* mock final
classes — **topic 04 · Mockito** covers when that is justified — but reaching for it here
is treating the symptom.

**★ When is wrapping an SDK genuinely not worth it?**
When the SDK type already reads like your domain and its failure modes already map
one-to-one onto your decisions. Spring's `JavaMailSender` passes both tests: `send(MimeMessage)`
is the operation you wanted, and `MailException` splits into exactly the outcomes you care
about, so wrapping it adds a layer and subtracts nothing. A one-method HTTP client for an
internal service you also own is usually in the same category. The signal that a wrapper
*is* worth it is that you find yourself writing the same three-line translation — minor
units, status string, exception mapping — at more than one call site.

{/* FOOTER */}
