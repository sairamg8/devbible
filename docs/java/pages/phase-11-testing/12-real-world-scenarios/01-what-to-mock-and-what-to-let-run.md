---
title: "Every test you will write in this topic starts with one decision — mock at a boundary you own, never the class under test and never a value — and getting that decision wrong is why a suite can be green, slow and useless at the same time"
sidebar_label: "01 · What to mock, what to let run"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the **Mockito 5.23.0** javadoc for `Mockito`
> ([`Mockito.html`, §1, §13, §39, §48, §51](https://javadoc.io/doc/org.mockito/mockito-core/5.23.0/org/mockito/Mockito.html))
> and `@DoNotMock`, read from `mockito-core-5.23.0-javadoc.jar` on Maven Central; and the
> **Spring Framework 7.0.x** testing reference, *Testing Client Applications*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/spring-mvc-test-client.html)).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7, Testcontainers 2.0.5.
> ⚠️ **No sandbox, no Docker and no test runs on this machine** — every page in this topic
> carries Java source and documented behaviour, never console output.

**This topic is task-shaped: you have a ticket, you have to test the thing, what do you
write? Every answer in it collapses to one prior decision — which collaborators get
replaced and which are allowed to run. That decision is not a matter of taste. Get it
wrong in one direction and the test asserts the shape of your code instead of its
behaviour, so it fails on every refactor and passes through every bug. Get it wrong in the
other direction and the "unit" test opens a socket, and the suite goes from seconds to
twenty minutes. This chunk states the rule, gives you the table you actually consult, and
shows how to make the codebase enforce the one clause people break silently. The four
ways the decision goes wrong in practice are [01a](01a-the-four-failure-modes.md).**

## The rule, in three clauses

> **Mock at a boundary you own. Never mock the class under test. Never mock a value.**

Each clause rules out a different disaster, and they are worth taking one at a time.

**"A boundary"** means a point where control leaves the unit you are testing — a network
call, a clock read, the filesystem, the database, a message broker, a random number, a
process, a third-party service. Inside the boundary, everything runs. A `DiscountPolicy`
that calls three private methods and a `Money` arithmetic helper is one unit with one
seam, not five units with five mocks.

**"You own"** means the interface being mocked is one you wrote and can change. That is
not pedantry about who typed the file. It is about who defines the contract. When you
write `when(client.fetchUser("u1")).thenReturn(user)`, you are asserting that the real
`client` behaves that way. If `client` is your own `UserGateway` interface, that assertion
is true by construction — you control both halves and the compiler keeps them in step.
If `client` is a vendor's SDK type, the assertion is a *guess about somebody else's
code*, and the guess is exactly where the production bug lives. **Topic 12's chunk 04 ·
A third-party SDK** (fork D's half of this directory) is entirely about the interface you
introduce so that this clause can be satisfied.

**"Never the class under test"** rules out partial mocks of the subject. If you find
yourself writing `spy(service)` and stubbing one of `service`'s own methods so the test
passes, the test no longer exercises the code you shipped. **Topic 04 · Mockito** owns
that argument in full; it is restated here because it is the single most common way the
scenarios in this topic go wrong.

**"Never a value"** rules out mocking `Money`, `LocalDate`, `OrderId`, a DTO, an enum, a
`List`. Mockito's own javadoc is blunt about this in its very first example:

> *"In reality, please don't mock the `List` class. Use a real instance instead."*

A mock of a value has no behaviour to be wrong about, so a test built on one asserts
nothing except that your production code called the getters you thought it would.

## The table you will actually consult

This is the working answer for the collaborators that come up in real tickets. "Real"
means construct the actual object in the test.

| Collaborator | Default | Why |
|---|---|---|
| Value object, DTO, enum, record (`Money`, `OrderId`) | **Real** | It has no behaviour worth faking; a mock of it removes the only thing the assertion could check. |
| Pure domain logic you own (`DiscountPolicy`, a validator) | **Real** | It is part of the unit. Mocking it means the test verifies wiring, not the rule. |
| A collaborator interface you own with no I/O (`PricingRules`) | **Real** unless it makes the arrangement unmanageable | Prefer the real thing; reach for a mock only when its own setup is the forty-line block. |
| A repository / gateway interface you own | **Mock** in a service test; **real + Testcontainers** in its own test | Two tests, two levels. Neither substitutes for the other. |
| An HTTP client class you own (`PaymentClient`) | **Mock** in the service test; test the client itself against a stub server | See [03](03-mocking-an-outbound-http-api.md) and [03b](03b-wiremock-and-mockwebserver.md). |
| A third-party SDK client (Stripe, S3, SES) | **Never mock the SDK type.** Wrap it, mock your wrapper | Its contract is not yours to assert. |
| `Clock` / the current time | **Real, fixed** — `Clock.fixed(...)` injected | A fixed clock *is* a real `Clock`. Mocking it is strictly worse. |
| `UUID.randomUUID()`, `Random`, `SecureRandom` | **Inject a supplier**, do not mock statics | The seam is a constructor parameter, not a bytecode trick. |
| `ObjectMapper` / Jackson | **Real** | Serialization bugs are the thing you want to catch; a mocked mapper hides all of them. |
| `ApplicationEventPublisher` | **Mock** | It is a boundary, and asserting *what was published* is usually the point of the test. |
| A `@Transactional` proxy / Spring AOP behaviour | **Real, in a Spring test** | A mock has no proxy at all — a plain unit test can never observe rollback. |
| Database | **Real, Testcontainers** (**topic 07**) | See the "passed on H2" argument. |
| Message broker | **Real container** for the container test; **plain method call** for the handler | See [08 · A message consumer](08-a-message-consumer.md) in this topic. |
| `System.getenv` / `System.getProperty` | **Inject configuration** | Boot binds these to a `@ConfigurationProperties` type; take that type as a parameter. |
| The filesystem | **Real, with JUnit's `@TempDir`** | The API surface is huge and the real one is fast. |

Read down the "Why" column and one pattern emerges: **the default is real.** A mock is
something you justify, not something you reach for. Every entry that says *mock* says it
because the real thing is slow, non-deterministic, remote, or destructive — never because
it is merely inconvenient to construct.

## Why "a boundary you own" is the load-bearing clause

A mock is a **second specification** of a collaborator's behaviour, written by you,
compiled into the test, and checked by nothing.

When you own the interface, that second specification stays honest almost for free: the
compiler catches signature drift, and the interface's *only* implementation is the one
your integration test exercises. Two things describe one contract and both are in your
repository.

When you do not own it — when you mock `com.stripe.Stripe`, `S3Client`,
`RestTemplate` itself, or a `JdbcTemplate` — the second specification is a belief. It
says "on a 409 this method throws `ApiException`", and nothing in your build will tell
you when that stops being true, or when it was never true. The test goes green and
production returns a 409 body you never handled. This is the mechanism behind almost
every "100% covered, still broke" story.

The fix is not "mock more carefully". The fix is to move the boundary so you own it:

```java
// The interface is yours. Its contract is one you can assert in a mock honestly,
// because you also wrote the only implementation and you test that separately.
public interface PaymentGateway {
    PaymentResult charge(ChargeRequest request);
}

// The adapter is where the vendor's real contract lives — and it is the ONLY place
// that imports the SDK. Its own test runs against the SDK's stub server / WireMock.
@Component
class StripePaymentGateway implements PaymentGateway {

    private final RestClient stripe;

    StripePaymentGateway(RestClient stripe) { this.stripe = stripe; }

    @Override
    public PaymentResult charge(ChargeRequest request) { /* ... */ }
}
```

Now the service test mocks `PaymentGateway` — one method, three outcomes, no vendor types
in sight — and the adapter test is an HTTP test that proves the vendor's actual wire
behaviour, once, in one file. **Two tests, two levels, and each of them can be wrong in a
way somebody notices.**

## Never mock a value — and how to make the codebase enforce it

The failure looks harmless:

```java
@Mock Money total;            // ⛔
@Mock Order order;            // ⛔

@Test
void goldGetsTenPercent() {
    when(order.total()).thenReturn(total);
    when(total.multipliedBy(new BigDecimal("0.10"))).thenReturn(Money.gbp("9.00"));

    assertThat(policy.discountFor(order)).isEqualTo(Money.gbp("9.00"));
}
```

The assertion cannot fail for any reason connected to discounting. It passes if
`discountFor` returns the constant `Money.gbp("9.00")`. It passes if `multipliedBy` is
implemented wrongly. It fails if somebody refactors `discountFor` to compute
`total.percentage(10)` — a change with identical behaviour. That is precisely inverted:
insensitive to bugs, sensitive to refactors.

The real version is shorter and can actually be wrong:

```java
@Test
void goldGetsTenPercent() {
    Order order = anOrder().forCustomer(aCustomer().gold()).totalling("90.00").build();

    assertThat(policy.discountFor(order)).isEqualTo(Money.gbp("9.00"));
}
```

If your team keeps doing it anyway, Mockito has an enforcement mechanism — mark the type,
and Mockito refuses to mock it. From the `@DoNotMock` javadoc (Mockito 5.23.0):

> *"Annotation representing a type that should not be mocked. When marking a type
> `@DoNotMock`, you should always point to alternative testing solutions such as standard
> fakes or other testing utilities."*

```java
import org.mockito.DoNotMock;

@DoNotMock(reason = "Use Money.gbp(\"…\") — it is a value, constructing one is free")
public final class Money { /* ... */ }
```

The `reason` element defaults to `"Create a real instance instead."`. If you do not want a
compile-time dependency on Mockito in your production module, the javadoc documents the
escape hatch verbatim:

> *"If you want to use a custom `@DoNotMock` annotation, the `DoNotMockEnforcer` will
> match on annotations with a type ending in `"org.mockito.DoNotMock"`. You can thus place
> your custom annotation in `com.my.package.org.mockito.DoNotMock` and Mockito will enforce
> that types annotated by `@com.my.package.org.mockito.DoNotMock` can not be mocked."*

So you declare your own annotation in a package that *ends with* `org.mockito`, annotate
your value types with it, and the ban is enforced by the test framework rather than by
code review.

## Where this connects

- The four ways this decision goes wrong in practice — over-mocking, under-mocking,
  mocking at the wrong altitude, and mocking the thing the assertion is about — plus
  the deep-stub smell, are in
  [01a · The four failure modes](01a-the-four-failure-modes.md).
- The mapping from the JS/React vocabulary you already have — `jest.mock`, `msw`,
  `render`, `waitFor`, `useFakeTimers`, `spyOn`, snapshots — onto these choices is
  [01b · The JS-to-Java map](01b-the-js-to-java-map.md).
- The everyday application of the rule, with the annotations and the wiring, is
  [02 · Mocking a class you own](02-mocking-a-class-you-own.md).
- When the collaborator is a static method, a `new` inside a method, a final class or a
  fat SDK client, the boundary has to be *created* first:
  [02b · When the collaborator is hard to mock](02b-when-the-collaborator-is-hard-to-mock.md).
- The stubbing and verification mechanics themselves — `when/thenReturn`, `@Mock`,
  `@InjectMocks`, argument captors, strictness — belong to **topic 04 · Mockito**, which
  this topic deliberately does not repeat.
- Which *kind* of test the whole thing should be (plain unit, slice, `@SpringBootTest`)
  belongs to **topic 05 · The test pyramid**.

## Gotchas

**★ A mock is a specification of someone else's behaviour that nothing in your build checks.**
This is the whole reason the "boundary you own" clause exists. `when(sdk.charge(any())).thenThrow(new CardException(...))` compiles and runs whether or not the SDK ever throws that. Every mock of a type you did not write is an unverified claim, and the number of such claims in a suite is a decent proxy for how much of your green is fictional. If you must mock a foreign type, pair it with exactly one test that exercises the real contract at the transport level — that test is the only thing making the mocks honest.

**★ "It has an interface, so it is a seam" is false when the interface is theirs.**
Teams see `S3Client` is an interface and conclude it is mockable, therefore mockable is fine. Ownership is about who can change the contract, not about whether the type declaration says `interface`. A vendor can add a checked exception, change a default, or start returning a paginated result, and your mock will keep telling you the old story. The test compiles because you upgraded the jar; the meaning silently changed.

**★ Mocking a value type makes the test insensitive to bugs and sensitive to refactors — the exact inversion of what you want.**
A good test fails when behaviour changes and survives when structure changes. A test built on `@Mock Money` does the opposite: it cannot notice a wrong calculation (you stubbed the answer) but it does notice that you renamed a method. When you catch a test failing on a pure rename, check whether the thing that broke was a stub on a value.

**★ Mocking `Clock` instead of injecting `Clock.fixed(...)` is strictly worse and people do it constantly.**
`Clock` is an abstract class with a factory that already gives you a deterministic instance: `Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC)`. Mocking it means stubbing `instant()` and `getZone()` separately and getting an `NPE` from `LocalDate.now(clock)` the first time you forget one, because `LocalDate.now(Clock)` calls both. Use the real fixed clock. There is no scenario where the mock is better.

**★ If you cannot name what the mock's absence would make slow, non-deterministic or destructive, you should not be mocking it.**
This is the one-question test, and it is fast enough to apply in code review. "Why is this a mock?" — *because it calls out to Stripe* is an answer. *Because it is a dependency* is not.

## Interview questions

**★ How do you decide what to mock in a unit test?**
By boundary, not by class count. I mock where control leaves the unit — network, clock, randomness, filesystem, broker, database — and only when the collaborator's interface is one my team owns, so that the stub I write is a contract I control rather than a guess about a vendor's behaviour. Everything else runs for real: value objects, pure domain logic, Jackson, cheap collaborators. The default is real; a mock is something I have to justify with a concrete word — slow, remote, non-deterministic, or destructive. If I can't say which of those four applies, the mock comes out.

**★ Why is mocking a third-party SDK type a bad idea, if it is an interface and Mockito will happily do it?**
Because a mock is a second specification of that type's behaviour, written by me and checked by nobody. When I stub my own `PaymentGateway`, the compiler and my one adapter test keep the stub honest. When I stub `StripeClient`, I have encoded a belief — that a declined card throws this exception, that a 409 maps to that type — and the build will never tell me when the belief is wrong or when the vendor changes it. The correct move is to introduce a narrow interface I own, put the SDK behind a single adapter, mock the interface everywhere, and prove the vendor's real wire behaviour once in the adapter's own HTTP test.

**★ What is wrong with `@Mock Money money` in a discount test?**
It removes the possibility of failure for the right reason. The assertion `assertThat(policy.discountFor(order)).isEqualTo(Money.gbp("9.00"))` can only pass or fail on what the stub returns, so a wrong multiplication, a wrong rounding mode or a hard-coded constant all pass. Meanwhile the test *is* sensitive to structure: rename `multipliedBy` and it breaks. That inversion — blind to bugs, brittle to refactors — is the signature of mocking a value. Mockito ships `@DoNotMock` for exactly this, and it can be applied without a production dependency by declaring your own annotation in a package ending `org.mockito`, which the `DoNotMockEnforcer` matches on.

**★ When would you deliberately let a database run in a test rather than mock the repository?**
Whenever the thing under test is expressed in SQL or in mapping. A mocked repository can never catch a wrong join, a missing index causing a lock, an `@Transactional` boundary in the wrong place, a lazy-loading exception outside the session, a unique-constraint race, or a JSON column that does not round-trip. Those are the bugs repositories actually have. So the repository gets its own test against a real PostgreSQL via Testcontainers, and the *service* test mocks the repository interface because at that level the database is a boundary and its behaviour is already covered one level down. Two tests, two levels — the mistake is expecting either one to do both jobs.

**★ Is there ever a legitimate reason to mock a type you do not own?**
Yes, but narrowly: when the type is a stable, specified part of the platform and the alternative is genuinely unusable — and even then it is a trade, not a free move. A more honest framing is that there is almost always a real substitute you have overlooked: `Clock.fixed` instead of a mocked `Clock`, `@TempDir` instead of a mocked filesystem, an in-process HTTP stub instead of a mocked HTTP client, the vendor's own test double if it ships one. The question to ask is "what does the library itself recommend for testing?" — for HTTP clients, Spring's own answer is a mock web server, which is the subject of [03b](03b-wiremock-and-mockwebserver.md).

{/* FOOTER */}
