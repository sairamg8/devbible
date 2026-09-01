---
title: "A vendor client with forty methods is the one shape where Mockito's answer is easiest and worst, because the mock compiles, the test passes, and every stub on it is an unverified guess about somebody else's software"
sidebar_label: "02d · Vendor clients"
sidebar_position: 39
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Mockito 5.23.0** sources on GitHub, tag `v5.23.0` —
> the class javadoc of
> [`Mockito.java`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> §32 *"Better generic support with deep stubs"*, §39 *"Mocking final types, enums and final
> methods"*, §51 *"Mark classes as unmockable"* — and
> [`DoNotMock.java`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/DoNotMock.java)
> at the same tag.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**[02b](02b-when-the-collaborator-is-hard-to-mock.md) did the static call and
[02c](02c-construction-and-final-classes.md) did the `new` and the final class. Those three
shapes are hard because Mockito has to work to reach them. This one is the opposite: the
vendor's client is a plain non-final class with a public API, `mock(StripeClient.class)`
compiles on the first try, and that is precisely the problem. Nothing stops you, so nothing
makes you notice that every stub you write on it is a claim about software you have never
read, checked by nothing in your build. This chunk is the fat vendor client. The private
method somebody asked you to test — the fifth shape, and the one that is almost always a
design report rather than a testing question — is
[02d2](02d2-the-private-method.md).**

## Shape 4 · A vendor client with a fat surface

```java
@Service
public class RefundService {

    private final StripeClient stripe;          // 40+ methods, vendor type
    private final RefundRepository refunds;

    public Refund refund(String chargeId, Money amount) throws StripeException {
        RefundCreateParams params = RefundCreateParams.builder()
                .setCharge(chargeId)
                .setAmount(amount.minorUnits())
                .setReason(RefundCreateParams.Reason.REQUESTED_BY_CUSTOMER)
                .build();

        com.stripe.model.Refund created = stripe.refunds().create(params);

        return refunds.save(new Refund(created.getId(), amount, created.getStatus()));
    }
}
```

Four separate problems live in those ten lines, and only the first is about mocking.

1. **The vendor's checked exception is in your service's signature.** `StripeException`
   propagates up to the controller, so every layer above compiles against the vendor.
2. **The vendor's `Reason` enum is in your business logic.** Change SDK major versions and
   this is a compile error in the middle of a domain method.
3. **The vendor's `Refund` model is what you map from**, so a field rename in their DTO is a
   change here, not in one adapter.
4. **The mock has to be four levels deep.** `stripe.refunds()` returns a service object;
   `.create(params)` returns their model. To stub it you need a mock that returns a mock.

### The trick, and why the trick is where the rot starts

Mockito will do all of it. `mock(StripeClient.class)` works. The nested call has a
purpose-built answer, and the javadoc for it contains its own warning. §32:

> *"Deep stubbing has been improved to find generic information if available in the class.
> That means that classes like this can be used without having to mock the behavior."*

> *"Please note that in most scenarios a mock returning a mock is wrong."*

```java
@Test
void refundsTheCharge() throws Exception {
    StripeClient stripe = mock(StripeClient.class, RETURNS_DEEP_STUBS);
    com.stripe.model.Refund vendorRefund = mock(com.stripe.model.Refund.class);
    given(vendorRefund.getId()).willReturn("re_1");
    given(vendorRefund.getStatus()).willReturn("succeeded");
    given(stripe.refunds().create(any(RefundCreateParams.class))).willReturn(vendorRefund);

    Refund refund = service.refund("ch_1", Money.of("20.00"));

    assertThat(refund.status()).isEqualTo(RefundStatus.SUCCEEDED);
}
```

Count what that test proves. It proves that if `stripe.refunds().create(...)` returns an
object whose `getStatus()` returns the string `"succeeded"`, your code maps it to
`RefundStatus.SUCCEEDED`. Every load-bearing fact in that sentence is one **you** supplied:

- that the accessor is `getStatus()` and not `status()`;
- that the value is the lower-case string `"succeeded"` and not `"SUCCEEDED"` or an enum;
- that `refunds().create(...)` is the call and not `Refund.create(params)`;
- that the params object is accepted at all — `any(...)` swallowed the entire request.

The test cannot fail when any of those is wrong, because your stub *is* the specification it
is checked against. This is [01](01-what-to-mock-and-what-to-let-run.md)'s ownership clause
arriving with the maximum possible force: the type is mockable, so nothing pushes back.

### The three practical obstacles, and why they are symptoms

Before the ownership argument even lands, teams hit three mechanical problems and reach for
three tricks. Each trick treats a symptom of the same cause.

| Obstacle | The trick people reach for | What it actually means |
|---|---|---|
| The client will not construct without an API key | `mock(StripeClient.class)` in every test | your service depends on a type it cannot build |
| The call is `client.a().b(params)` | `RETURNS_DEEP_STUBS` | you are stubbing two contracts, not one |
| The response model is `final` or has no public constructor | mock the DTO (Mockito 5 lets you) | you stopped testing the mapping, which is the whole job |

The third one is worth staring at. A vendor response DTO is a **value**: it has no behaviour
worth doubling, and mocking it removes the deserialization and the field access that your
adapter exists to perform. [02c](02c-construction-and-final-classes.md) makes the same point
about final value types; the SDK case is just the version where the type is somebody else's.

## The refactor: one narrow interface, and it is narrower than you think

```java
public interface Refunds {
    RefundResult refund(RefundRequest request);       // your types, both sides
}
```

```java
@Component
class StripeRefunds implements Refunds {

    private final StripeClient stripe;

    StripeRefunds(StripeClient stripe) { this.stripe = stripe; }

    @Override
    public RefundResult refund(RefundRequest request) {
        try {
            var created = stripe.refunds().create(RefundCreateParams.builder()
                    .setCharge(request.chargeId())
                    .setAmount(request.amount().minorUnits())
                    .setReason(RefundCreateParams.Reason.REQUESTED_BY_CUSTOMER)
                    .build());
            return new RefundResult(created.getId(), RefundStatus.from(created.getStatus()));
        }
        catch (StripeException e) {
            throw RefundFailure.from(e);              // the translation, in one place
        }
    }
}
```

Two properties matter more than the code.

**The interface has one method, not forty.** The temptation is to mirror the vendor —
`interface StripeGateway { Refund create(...); Refund get(...); RefundCollection list(...); }`
— which reproduces the coupling with an extra file. The interface should have exactly the
operations *your application performs*, in *your* vocabulary. If you only ever refund, it has
one method. A wrapper that is isomorphic to the thing it wraps has bought nothing.

**Everything vendor-shaped is now inside one class.** The checked exception, the enum, the
builder, the nested call, the DTO accessors. That class gets tested against something more
honest than a mock — the SDK's own test double, a recorded payload, or a real sandbox — which
is [04b · The adapter and the three test populations](04b-the-adapter-and-the-three-test-populations.md)
and [04c · The SDK's own test double](04c-the-sdks-own-test-double.md). And `RefundService`
now mocks `Refunds`, a one-method interface it owns, which is
[02 · Mocking a class you own](02-mocking-a-class-you-own.md) and needs nothing from this
page.

## Making the rule enforceable: `@DoNotMock`

An argument in a code review is a rule that decays. Mockito 4.1.0 added a way to encode it,
§51:

> *"In some cases, mocking a class/interface can lead to unexpected runtime behavior. For
> example, mocking a `java.util.List` is difficult, given the requirements imposed by the
> interface. This means that on runtime, depending on what methods the application calls on
> the list, your mock might behave in such a way that it violates the interface."*

> *"For any class/interface you own that is problematic to mock, you can now mark the class
> with `@DoNotMock`."*

```java
@DoNotMock(reason = "Mock the Refunds port instead; this is the vendor's contract, not ours")
public final class RefundResult { /* … */ }
```

The `reason` attribute defaults to `"Create a real instance instead."`, and the annotation
is enforced by a `DoNotMockEnforcer` plugin. 🔴 **You can only annotate types you own** —
you cannot put it on `StripeClient`. But you can put it on your own value types, which is
where the second-most-common version of this mistake lives, and the javadoc documents a
package-name trick for shipping your own copy of the annotation without a compile-time
dependency on Mockito: the enforcer *"will match on annotations with a type ending in
`org.mockito.DoNotMock`"*, so `com.my.package.org.mockito.DoNotMock` works.

## Where this connects

- The private method, and the reflection escape hatches:
  [02d2 · The private method](02d2-the-private-method.md).
- The cost of every trick in this band, and the table that decides trick-versus-refactor per
  shape: [02e · The agent tax and the decision table](02e-the-agent-tax-and-the-decision-table.md).
- The full treatment of the vendor case — the anti-corruption interface, what to test where,
  and the vendor's own double: [04](04-a-third-party-sdk.md),
  [04b](04b-the-adapter-and-the-three-test-populations.md),
  [04c](04c-the-sdks-own-test-double.md), [04d](04d-doubles-that-run-the-real-protocol.md).
- Why a mockable vendor type is still not a type you should mock:
  [01 · What to mock and what to let run](01-what-to-mock-and-what-to-let-run.md).
- The wrong-altitude failure mode this produces: [01a](01a-the-four-failure-modes.md).
- If the vendor's "SDK" is really just HTTP, the adapter's own test is
  [03](03-mocking-an-outbound-http-api.md), not a mock of the client.
- `RETURNS_DEEP_STUBS`, `@DoNotMock`, mocks vs fakes and the mock-maker plumbing all belong
  to **topic 04 · Mockito** — see
  [`../04-mockito/10b-do-not-mock-types-you-do-not-own.md`](../04-mockito/10b-do-not-mock-types-you-do-not-own.md)
  and [`../04-mockito/10e-the-anti-corruption-adapter.md`](../04-mockito/10e-the-anti-corruption-adapter.md).

## Gotchas

**★ `RETURNS_DEEP_STUBS` makes a test that stubs two contracts and verifies neither, and Mockito's own javadoc says so in one line.**
§32 ends with *"Please note that in most scenarios a mock returning a mock is wrong."* When you write `given(stripe.refunds().create(any())).willReturn(x)` you have asserted that `refunds()` exists and returns a thing with a `create` — a fact about the vendor — and then asserted what that `create` returns, a second fact about the vendor. Neither is checked. A deep stub in a test is a reliable indicator that the object graph belongs to somebody else and should be behind one interface of yours.

**★ The interface you extract must have your application's methods, not the vendor's.**
The commonest failed refactor is a `StripeGateway` interface with the same forty methods and the same parameter types, which changes nothing: the enum, the builder and the checked exception are still in your service. The test for whether the extraction worked is mechanical — grep the rest of the codebase for the vendor's package name. If it appears anywhere except the one adapter class and its own test, the boundary leaked.

**★ A checked vendor exception in your service signature spreads to every caller and forces every test to declare it.**
`throws StripeException` on `refund(...)` means the controller declares it, the scheduler declares it, and every test method declares it. That is why the `throws Exception` on the test above is not cosmetic — it is the coupling showing up in the test's own signature. Translating in the adapter's `catch` block removes it from every file at once, and the translation is the thing worth testing ([04b](04b-the-adapter-and-the-three-test-populations.md)).

**★ Mocking the vendor's response DTO deletes the mapping, which is the only code the adapter contains.**
`given(vendorRefund.getStatus()).willReturn("succeeded")` proves your `RefundStatus.from` handles the string you typed. It does not prove the accessor is named `getStatus`, that the vendor sends lower case, that an unknown status is handled, or that a null does not blow up. Construct the real DTO if the SDK lets you, and let the SDK deserialize a captured real payload if it does not.

**★ `any(RefundCreateParams.class)` throws away the entire outgoing request, and the outgoing request is the money.**
The amount, the charge id, the currency, the reason and the idempotency key all live in that params object, and `any(...)` asserts nothing about any of them. A refund for the wrong amount passes this test. Capture the argument and assert on it — that is [03d · Asserting what you sent](03d-asserting-what-you-sent.md), and for a payment SDK it is not optional.

**★ "The client needs credentials to construct" is treated as a reason to mock it, when it is a reason to inject it.**
The obstacle is that `new StripeClient(apiKey)` needs configuration. The fix is that the adapter takes the constructed client as a constructor parameter and a `@Configuration` class builds it from bound properties — at which point the adapter is constructible in a test with a client built against a sandbox key, and the service does not know the type exists. Mocking the client because it is awkward to build is solving a wiring problem with a test technique.

**★ `@DoNotMock` cannot be applied to the vendor's types, which is exactly where you want it.**
The annotation goes on classes you own. For the vendor's types the only enforcement available is review, an ArchUnit rule that forbids the vendor package outside the adapter package, or the structural fix of not having the type visible in the first place. Extracting the interface *is* the enforcement: once `StripeClient` is not on the service's constructor, no test of the service can mock it.

**★ Mocking a vendor interface that the vendor extends in a minor release gives you a mock that silently answers `null` to a method your production code now calls.**
A mock implements every method with a default answer. When the SDK adds `refunds().createAsync(...)` and some path in your code starts using it, the mock returns `null` rather than failing, and the failure surfaces later and elsewhere. A hand-written fake of *your* one-method interface has no such surface: it has one method, and adding a second is a compile error you see immediately.

## Interview questions

**★ Your service calls a payment SDK directly. Walk me through what you would change and what each test then covers.**
I would introduce a one-method interface in my own vocabulary — `Refunds.refund(RefundRequest)` returning a `RefundResult` — and move the SDK call, the builder, the enum, the DTO mapping and the checked-exception translation into a single adapter class behind it. That produces three tests with three different characters. The service test mocks `Refunds`, my own interface, and covers the business decisions: what happens on success, on a decline, on an infrastructure failure. The adapter test covers the mapping and the error translation, and it deliberately does not use a Mockito mock of the SDK — it uses the vendor's own test double if there is one, or a recorded payload, or a sandbox, because a mock of their client would just be me writing down what I believe their client does. And the third population, which most teams skip, is a small number of tests against the real sandbox, tagged and not run on every commit, whose job is to tell me when my beliefs went stale.

**★ What is wrong with `RETURNS_DEEP_STUBS` for an SDK client?**
That it removes the friction that was telling me something. The friction is that `client.refunds().create(params)` is two contracts deep in somebody else's object graph, and a test that stubs it is asserting the shape of that graph — that `refunds()` exists, that it returns a service object, that the object has a `create` taking those params — none of which my build checks. Mockito's own javadoc for the feature says *"in most scenarios a mock returning a mock is wrong"*, and this is the archetype of that scenario. The practical harm is that the test goes green while the SDK's actual method is `refundService().create(...)` or takes a different builder, and the discovery happens in production or, if I am lucky, the first time someone runs it against a sandbox. If I genuinely have to reach two levels deep to arrange a test, the object graph belongs behind an interface of mine.

**★ Is it ever right to mock a vendor's client directly?**
Yes, in one narrow case: when the vendor's client *is* a thin, single-purpose interface that I would otherwise copy verbatim into my own. Spring's `JavaMailSender` is the example — it is already an anti-corruption interface over `jakarta.mail`, it has a small surface, and re-wrapping it produces an interface identical to it. The test is whether the wrapper I would write is meaningfully different from the type I am wrapping. If it is not, the wrapper is ceremony. The moment the type has a fat surface, nested accessors, checked exceptions of its own, or a construction requirement, the answer flips, because those are all ways of saying that my beliefs about it are large and unverified.

**★ How would you stop this class of mistake from coming back after you have fixed it once?**
Three layers, cheapest first. `@DoNotMock` with a `reason` on my own value and result types, since it is one annotation and the enforcer fails the test rather than a reviewer catching it. An architecture test — ArchUnit or an equivalent — that says the vendor's package may only be imported from the adapter package, which catches the reintroduction at the import rather than at the mock. And a review habit of treating any `RETURNS_DEEP_STUBS` or any mock of a type from a `com.` package that is not ours as a finding, not a style preference. The first two are automated and therefore survive turnover, which is the only property that matters for a rule like this.

{/* FOOTER */}
