---
title: "Once the SDK lives behind one interface, \"how do I test the payment integration\" stops being one question and becomes three with three different answers, and the only one worth agonising over is the four lines of error translation in the adapter's catch blocks"
sidebar_label: "04b · The three test populations"
sidebar_position: 23
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.9** javadoc for
> `@MockitoBean` in `org.springframework.test.context.bean.override.mockito`
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/bean/override/mockito/MockitoBean.html))
> — `REPLACE_OR_CREATE` and `enforceOverride` — and the **Spring Framework 7.0.9**
> reference for `JavaMailSender`
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/email.html)).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — this page carries Java source and
> documented behaviour, never console output.

**[04](04-a-third-party-sdk.md) put a two-method interface in front of the vendor. This
page spends that. The interface splits the testing question into three populations with
wildly different sizes, speeds and purposes — hundreds of fast tests that never see the
SDK, a handful of slow tests about one class, and zero tests of the vendor's own code.
Conflating them is the mistake that produces both a slow suite and an uncovered
integration at the same time.**

## The three test populations, and why they are different kinds of test

| | What is under test | What stands in for the vendor | Where it runs |
|---|---|---|---|
| **A · Service / domain tests** | `CheckoutService`, `OrderStateMachine` | a Mockito mock or a hand-written fake of `PaymentGateway` | plain JUnit, no Spring, milliseconds |
| **B · Adapter tests** | `StripePaymentGateway` — the mapping and the error translation | the SDK's own test double, or an HTTP stub | one class, a socket or a container |
| **C · Nothing** | the SDK itself | — | — |

**A is where 95% of your payment logic lives, and it never sees the SDK.** "A declined
card leaves the order in `PAYMENT_FAILED` and sends no confirmation email" is a
`PaymentResult.Declined` fed to a service with a mocked gateway. It runs in a millisecond
and it is the test you would actually miss if it were deleted.

```java
class CheckoutServiceTest {

    private final PaymentGateway gateway = mock(PaymentGateway.class);
    private final OrderRepository orders = new InMemoryOrderRepository();
    private final Mailer mailer = mock(Mailer.class);
    private final CheckoutService service = new CheckoutService(gateway, orders, mailer);

    @Test
    void aDeclinedCardLeavesTheOrderUnpaidAndSendsNoReceipt() {
        when(gateway.charge(any()))
                .thenReturn(new PaymentResult.Declined(DeclineReason.INSUFFICIENT_FUNDS));

        service.checkout(anOrder().withTotal("25.00").build());

        assertThat(orders.findById(ORDER_ID)).hasStatus(PAYMENT_FAILED);
        verifyNoInteractions(mailer);
    }
}
```

No Spring context, no SDK on the mental classpath, no HTTP. The whole state machine —
declined, requires-action, captured, refunded, partially refunded, refund-after-capture —
is exercised here, one fast test per outcome.

**B is a small number of tests about one class**, and they are the only place the vendor's
wire format, auth, serialization and exception hierarchy are exercised. Those tests are
slower and rarer by design. [04c](04c-the-sdks-own-test-double.md) is entirely about how
to write them.

**C is not laziness — it is scope.** You are not the vendor's QA. A test that asserts
`StripeClient` correctly signs its requests is testing code you cannot fix, against a
contract you cannot influence, and it will break on an SDK upgrade that fixed a bug.

The ratio that falls out of this in a healthy codebase is roughly *dozens of A per B*. If
your payment tests are mostly B, the logic has leaked into the adapter. If you have zero
B, nothing in your suite has ever seen a real request go out.

## The error translation is the part worth testing hardest

Everything else in the adapter is field copying. The `catch` blocks are decisions, and a
wrong decision here is an outage or a double charge.

```java
@Test
void aDeclinedCardIsADeclineNotAnOutage() { ... }      // CardException  -> Declined

@Test
void aRateLimitIsRetryableNotADecline() { ... }        // RateLimit      -> Unavailable

@Test
void aConnectionResetIsRetryableAndNotIdempotencySafe() { ... }
```

The middle one is the classic production bug in both directions:

- **Translate `RateLimitException` to `Declined`** and you tell a customer with a perfectly
  good card that it was refused, during your busiest hour, and you do not retry.
- **Translate `CardException` to `Unavailable`** and your retry layer hammers the gateway
  with a card that will never work, burning your rate-limit budget on a guaranteed
  failure, and possibly tripping the vendor's fraud heuristics.

Both are one line in a `catch` block, both are invisible in a service test with a mocked
`PaymentGateway`, and both are trivially covered by a table-driven adapter test — which is
what **topic 03 · Parameterized tests** is for.

The third one is the hardest and the one teams skip. A connection reset *after* the
request left your process is not "the charge did not happen" — it is "you do not know
whether the charge happened". If the adapter translates it to a plain
`PaymentGatewayUnavailable` and the caller retries **without** reusing the idempotency key,
you have written a double charge. The assertion worth making is not about the exception
type at all; it is that the retry carries the same key. That test lives in
[09b · Idempotency and the double charge](09b-idempotency-and-the-double-charge.md).

## Mail and storage are the same shape with easier seams

Not every SDK needs an interface written from scratch, because sometimes the framework has
already written it for you.

- **Mail.** Spring's `JavaMailSender` *is* an anti-corruption interface over
  `jakarta.mail`. Depend on `JavaMailSender`, not on `Session`/`Transport`, and your
  service test mocks a Spring interface. The adapter-level question — does the MIME
  message actually come out right — is what an in-process SMTP server answers; see
  [04c](04c-the-sdks-own-test-double.md).
- **Storage.** `S3Client` in AWS SDK v2 is an *interface*, which removes the "final class"
  problem but not the other three: the vocabulary is still S3's, the exceptions are still
  `S3Exception`, and a mocked `S3Client` still encodes your beliefs about S3. A
  `DocumentStore` interface with `store(DocumentId, byte[])` and `fetch(DocumentId)` is
  usually still worth the twenty lines.

The rule of thumb: **if the SDK type already reads like your domain and its failure modes
already map one-to-one onto your decisions, use it directly.** Otherwise wrap it. Most
payment and storage SDKs fail both halves; `JavaMailSender` passes both.

There is a second-order benefit for mail specifically. Because `JavaMailSender` is an
interface, a service test can capture the `MimeMessage` with an `ArgumentCaptor` and assert
on the recipient and subject without a single byte of SMTP — and the *rendering* of the
body, which is where the real bugs are, moves into its own test of a template component
that has nothing to do with mail transport at all.

## Where this connects

- The interface this page spends is designed in
  [04 · A third-party SDK](04-a-third-party-sdk.md).
- Population B — the SDK's own double, LocalStack, GreenMail, stripe-mock — is
  [04c · The SDK's own test double](04c-the-sdks-own-test-double.md).
- **Topic 04 · Mockito** owns `verifyNoInteractions`, argument captors, mocks vs fakes and
  contract-testing a fake. **Topic 03 · Parameterized tests** owns the table-driven form
  the error-translation tests want.
- The idempotency-key assertion that stops a retried charge becoming two charges is
  [09b · Idempotency and the double charge](09b-idempotency-and-the-double-charge.md).
- **Fork C's 03d · Asserting what you sent** is the general version of the "did the right
  request actually leave" problem; for money it is not optional.

## Gotchas

**★ `@MockitoBean` will happily create a bean for an SDK client the application never
declares, and the test goes green while production has no such bean.**
`@MockitoBean` uses `REPLACE_OR_CREATE`: *"If a corresponding bean does not exist, a new
bean will be created"*. So `@MockitoBean StripeClient client;` passes whether or not your
`@Configuration` actually produces a `StripeClient` — including after someone deletes that
`@Bean` method in a refactor. Set `enforceOverride = true` to switch to `REPLACE`, which
fails the context if there is nothing to replace. This is the single most common way an SDK
integration test keeps passing after the integration has been unwired.

**★ The adapter is where money units get converted, and nothing else checks the conversion.**
`Money.of("25.00", GBP)` becomes `2500`. Nobody notices a factor-of-100 error in a service
test, because the mocked gateway takes `Money`. The only test that can catch it is one that
inspects what was actually sent to the vendor — which is why *asserting the request* matters
more for payments than for anything else in the system. If you write exactly one adapter
test, write that one.

**★ Vendor SDKs bake in their own retry and timeout policy, and it multiplies with yours.**
Most SDK clients retry idempotent requests internally with their own backoff. If you then
wrap the adapter in `@Retryable`, the effective attempt count is the product, not the sum,
and the worst-case latency is the product too: an SDK doing 3 attempts inside your 3
attempts is 9 requests and 9× the timeout budget. Decide which layer owns retry, disable
the other explicitly in the client builder, and pin the decision with a test that counts
requests at the HTTP boundary — a counting mock at the `PaymentGateway` level cannot see
the SDK's internal retries at all, so it will report 3 while the vendor saw 9.

**★ Currency, locale and rounding come from the JVM default unless you make them explicit.**
An adapter that formats an amount with `String.format("%.2f", amount)` produces `25,00` on
a machine with a comma decimal separator and `25.00` on yours. A CI runner in a different
region is where you find out. Pass an explicit `Locale`, and prefer sending minor units as
an integer over ever formatting a decimal for the wire. **Topic 01 · JUnit 5**'s flaky-test
chunks own the general "the environment differs" argument; this is its most expensive
instance.

**★ SDK exceptions are frequently checked, and `catch (Exception e)` in the adapter erases
the distinction the adapter exists to preserve.**
The one place in your codebase where a fine-grained catch is genuinely load-bearing is the
adapter, and it is also the place where a broad catch is most tempting because the vendor
has eleven types. A single `catch (StripeException e) -> Unavailable` turns every decline
into an outage. Enumerate the ones that map to *customer-visible, non-retryable* outcomes
explicitly, and only then fall through to a catch-all. A test per enumerated branch is
cheap; the branch you did not enumerate is the incident.

**★ A hand-written fake of the gateway that is too clever becomes a second implementation
you have to keep honest.**
An `InMemoryPaymentGateway` that models balances, partial captures and refund windows is a
payment processor you now maintain, and it will drift from the vendor. Keep the fake to
recorded calls and canned outcomes; if a test needs realistic gateway behaviour, that test
belongs in population B against a real double. **Topic 04 · Mockito**'s contract-testing
chunk is the discipline for keeping a fake honest when you do need one.

**★ Population A and population B share no fixtures, and trying to share them is what
makes both worse.**
A `ChargeRequest` builder is an A-side fixture; a canned vendor JSON payload is a B-side
fixture. Teams that put both in one `TestFixtures` class end up with A tests that
transitively load the SDK's Jackson modules and B tests that assert on domain objects the
adapter should have already translated away. Keep them in different packages —
`payments/` and `payments/stripe/` — mirroring the production split that made the whole
thing testable.

**★ Population C creeping back in looks like "let's just add one test for the SDK's retry".**
It is always framed as prudence and it always ages badly: the SDK changes its backoff in a
patch release, your test fails, and the fix is to change your test to match code you do not
own. If you genuinely need to know the SDK's retry count, assert it *behaviourally* at your
HTTP boundary — "three requests reached the stub" — not by reading the SDK's configuration
object. The former survives an upgrade with a different implementation; the latter does not.

## Interview questions

**★ What do you actually test in the adapter, given that you are not testing the SDK?**
Three things, and only three. First, **translation in**: that a `ChargeRequest` becomes the
right vendor parameters — right amount in minor units, right currency, the idempotency key
actually attached, the metadata your ops team greps for actually present. Second,
**translation out**: that each meaningful vendor response becomes the right member of your
result type, including the ones you would not have thought of (`requires_action`). Third,
and most important, **error translation**: that `CardException` becomes a decline and
`RateLimitException` becomes a retryable unavailability, because getting those two the
wrong way round is either an outage or a false refusal, and neither is visible anywhere
else in the suite.

**★ Your service test mocks `PaymentGateway` and passes. What class of bug can it not
possibly catch?**
Anything on the far side of the interface: unit conversion, serialization, auth headers,
API version drift, the vendor returning a status you do not handle, timeouts, and the
vendor's own retry behaviour. That is not a criticism of the test — it is the point of the
split. The service test is fast because it is deliberately blind to the wire, and the
adapter test is slow and rare because it is deliberately about the wire. The failure mode
is a team that writes only population A, ships, and discovers on the first real charge that
minor units were off by a hundred.

**★ How many adapter tests is the right number?**
Roughly one per distinct *decision* the adapter makes, which is far fewer than one per SDK
feature. Count the branches: each `catch` clause, each vendor status you map, and one
request-shape test. For a two-method gateway that is typically six to ten tests. If you are
writing thirty, look at what they are asserting — you have probably started testing the
SDK's serializer, or the adapter has grown business logic that belongs in a service. If you
are writing two, check whether the exception hierarchy is really being collapsed by a
single catch-all.

**★ How do you keep the adapter from becoming the new god class?**
By keeping the interface small and refusing to let convenience methods accumulate on it.
The pressure comes from callers: someone needs "charge and email a receipt", and the
adapter is where the vendor lives, so it lands there. It does not belong there — it belongs
in a service that depends on `PaymentGateway` and `JavaMailSender`. The adapter's job is
translation and nothing else, and the review heuristic is that an adapter method containing
an `if` about *business* rules (rather than about vendor response codes) has taken on work
that belongs upstream.

**★ A colleague says the three-population split is over-engineering for a service that
makes one API call. Do they have a point?**
Sometimes. If the integration is genuinely one call whose result is a boolean, and the
failure modes really are "worked" and "did not work", then the interface buys little and a
single adapter tested against an HTTP stub is a defensible whole strategy. The question to
ask is how many *decisions* hang off the result. One decision, keep it simple. As soon as
the answer is "declined vs unavailable vs needs 3-D Secure vs already charged", you have a
result type whether or not you have written one down, and the population split is what lets
you test all four branches in milliseconds instead of four socket round-trips.

{/* FOOTER */}
