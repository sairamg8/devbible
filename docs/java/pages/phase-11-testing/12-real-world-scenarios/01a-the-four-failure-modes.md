---
title: "Over-mocking, under-mocking, mocking at the wrong altitude and mocking the very thing the assertion is about are four different failures with four different symptoms, and only one of them ever shows up on a CI dashboard"
sidebar_label: "01a · The four failure modes"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the **Mockito 5.23.0** javadoc for `Mockito`
> (§13 *Spying on real objects*, §32 *Better generic support with deep stubs*, §40
> *"stricter" Mockito*, §47 *clearing mock state in inline mocking*), read from
> `mockito-core-5.23.0-javadoc.jar` on Maven Central; and the **Spring Framework 7.0.x**
> reference for bean overrides (`@MockitoBean` is *"never wrapped in a Spring AOP proxy"*).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**[01](01-what-to-mock-and-what-to-let-run.md) gave the rule. This chunk is the four ways
it gets broken, because they are not one mistake with four names — they have different
symptoms, different costs and different cures, and exactly one of them (under-mocking)
announces itself in CI. The other three are silent, which is why suites drift into them
over years without anyone filing a ticket.**

## The four ways this decision goes wrong

**Over-mocking** — every collaborator is a mock, including the ones with no I/O. Symptom:
the test file is 70% `when(...)`. Consequence: the test is a transcript of the
implementation. Any refactor that changes the call sequence breaks it, and no bug inside
the mocked collaborators can break it. The cure is to delete mocks until something real
runs.

**Under-mocking** — nothing is replaced, so the "unit" test hits a real HTTP endpoint or
a shared database. Symptom: the test is flaky on Mondays and fails on aeroplanes.
Consequence: a suite nobody trusts, so failures get re-run instead of read.

**Mocking at the wrong altitude** — the boundary chosen is technically a boundary but the
wrong one. Mocking `RestTemplate` or `RestClient` itself (rather than your own gateway,
or the HTTP transport underneath it) is the classic. You end up stubbing a
builder-shaped fluent API — `when(restClient.get()).thenReturn(uriSpec)`,
`when(uriSpec.uri(any())).thenReturn(headersSpec)` — four mocks deep, testing Spring's
DSL rather than your request. [03](03-mocking-an-outbound-http-api.md) shows what to do
instead.

**Mocking what the assertion is about** — the subtlest one. The test says it is about
retry behaviour, and it mocks the retry template. It says it is about serialization, and
it mocks the `ObjectMapper`. Whenever the mocked thing appears in the test's own name,
stop: you have mocked the subject.

## The smell that tells you the boundary is in the wrong place

```java
when(repository.findById(1L)).thenReturn(Optional.of(order));
when(order.customer()).thenReturn(customer);
when(customer.loyaltyTier()).thenReturn(GOLD);
```

Three stubs to reach one enum. A mock whose stubbed method returns another mock means
your production code is walking an object graph across a boundary — and it means the test
now encodes the *shape of the graph*, so a rename three levels down breaks it. Two honest
readings:

1. The value objects should be real. Build the graph with a builder (**topic 08**) and
   stub only `findById`.
2. The query is at the wrong level: the repository should return what the caller needs
   (`Optional<LoyaltyTier> tierFor(OrderId)`), not a graph the caller must navigate.

Mockito offers `RETURNS_DEEP_STUBS` to make the chain compile without the intermediate
stubs. It is a way to hide this smell, not a way to fix it — reach for reading 1 or 2 first.

## Only one of the four is visible in CI

This asymmetry is the reason the drift is always in the same direction.

| Failure | How it announces itself | Who pays |
|---|---|---|
| Under-mocking | Red builds, flakes, a slow suite | Everyone, immediately |
| Over-mocking | Nothing. The build is green | The next person to refactor, years later |
| Wrong altitude | Nothing, until the vendor changes something | Production |
| Mocking the subject | Nothing. Coverage even goes up | Production |

A team optimising against the signals it receives will fix under-mocking and accumulate
the other three indefinitely. There is no CI check for "this test cannot fail".

There are, however, two mechanical things that come close, and both are worth turning on
before you start arguing about style.

**Mockito's strict stubbing.** `MockitoExtension` uses `STRICT_STUBS` by default, and the
javadoc's §40 lists what that buys you, including *"Unnecessary stubbing detection"* and
*"Stubbing argument mismatch warnings"*. A stub that is never called is reported as an
error, so the most literal form of over-mocking — arranging a collaborator the code under
test never touches — becomes a build failure rather than dead weight.

```java
@ExtendWith(MockitoExtension.class)   // STRICT_STUBS by default
class CheckoutServiceTest { /* an unused when(...) now fails the test */ }
```

If a team has suppressed this with `@MockitoSettings(strictness = Strictness.LENIENT)` at
class level, that suppression is itself the finding: it is usually there because a shared
setup block stubs things most tests do not use. **Topic 04 · Mockito** owns strictness in
full; the point here is that it is your only free over-mocking detector.

**Mutation testing.** Over-mocking produces tests that cannot fail, which is exactly what
a mutation testing tool measures — it changes the production code and asks whether any
test notices. **Topic 11 · PIT** is the honest answer to "is this green meaningful?", and
a service class with high line coverage and low mutation score is almost always a class
whose tests stubbed the answer.

## The cure for over-mocking is subtraction, and it has a fixed procedure

Do not try to redesign the test. Delete stubs one at a time, in this order, and stop when
something breaks for a real reason.

1. **Delete every stub on a value type or DTO.** Replace with a constructed instance or a
   builder from **topic 08**. Nothing should break; if something does, you have found
   production code that depends on a value's identity rather than its data.
2. **Delete every stub on a pure collaborator** — validators, mappers, policies,
   calculators. Let them run. The arrangement usually gets *shorter*, because you feed
   real inputs instead of describing outputs.
3. **Collapse deep-stub chains** using the two readings below.
4. **Whatever is left should be one to three mocks**, each of which you can justify with
   the word *slow*, *remote*, *non-deterministic* or *destructive*.

If step 4 still leaves you with eight mocks, the finding has moved from the test to the
production class: eight boundaries in one class is not a testing problem.


## Where this connects

- The rule these four failures break — mock at a boundary you own, never the class under
  test, never a value — is [01](01-what-to-mock-and-what-to-let-run.md), together with the
  table of what to mock and what to let run.
- The wrong-altitude failure applied to HTTP has a concrete right answer:
  [03 · Mocking an outbound HTTP API](03-mocking-an-outbound-http-api.md), and
  [03b](03b-wiremock-and-mockwebserver.md) when you want a real socket.
- The refactors that remove the *need* for a mocking trick — static methods, `new` inside
  a method, a final class — are [02b](02b-when-the-collaborator-is-hard-to-mock.md).
- Strictness, `RETURNS_DEEP_STUBS`, `spy()` and `@InjectMocks` mechanics belong to
  **topic 04 · Mockito**. Builders and object mothers for the real values you will
  substitute back in belong to **topic 08 · Test data patterns**. Mutation score as the
  detector for tests that cannot fail belongs to **topic 11 · Mutation testing**.

## Gotchas

**★ A mocked bean is never wrapped in a Spring AOP proxy, so anything you were testing about `@Transactional` or `@Cacheable` on it silently stops being tested.**
This is documented behaviour of `@MockitoBean`, and it is a trap in exactly the tests that care: you mock a repository to isolate a service, and in doing so you also removed transaction demarcation, retry advice and caching from that bean. If the behaviour under test is *the advice*, the collaborator must be real and the test must be a Spring test. **Topic 05** owns `@MockitoBean`; the consequence is named here because it decides mock-vs-real.

**★ A chain of three stubs to reach one value is a design finding, not a mocking problem.**
`when(a.b()).thenReturn(bMock); when(bMock.c()).thenReturn(cMock);` says your production code traverses someone else's object graph. Fix it at the source — return the value the caller needs, or use real value objects — rather than reaching for `RETURNS_DEEP_STUBS`, which makes the chain compile and leaves the coupling in place.

**★ Mocking a collaborator that has no I/O usually costs you the only real assertion in the test.**
`when(validator.validate(order)).thenReturn(VALID)` means the test proves your service does the right thing *given* a valid order, and proves nothing about which orders are valid — while also guaranteeing that a validation bug cannot break this test. If the collaborator is pure and fast, run it. The rule "one class per unit test" is not in any specification; the unit is however much code you can exercise deterministically and quickly.

**★ Mocking the class under test with `spy()` converts a failing test into a passing one without changing the product.**
The pattern is always the same: a method calls a sibling method that is hard to arrange, so someone spies the subject and stubs the sibling. The test now passes with a body that no user will ever execute. If arranging the sibling is hard, that is the finding — extract it to a collaborator you can inject, which is the whole subject of [02b](02b-when-the-collaborator-is-hard-to-mock.md).

**★ Under-mocking is easier to detect than over-mocking, so teams drift towards over-mocking.**
A slow or flaky test announces itself; a test that asserts implementation shape sits there being green for two years and only bills you during a refactor, at which point the cost looks like the refactor's fault. Nothing in CI measures over-mocking. The only cheap proxy is mutation testing — **topic 11 · PIT** — which finds precisely the tests that cannot fail.

**★ Deciding mock-vs-real per collaborator, rather than per test class, is the actual skill.**
There is no such thing as "we write unit tests here, so everything is mocked". A single test class routinely wants a real `Clock` (fixed), a real value graph, a mocked gateway and a mocked event publisher. Anyone who applies one policy to a whole file will over-mock the cheap things to be consistent with the expensive ones.

**★ Strict stubbing catches unused stubs, not useless ones — the harder half of over-mocking is invisible to it.**
`STRICT_STUBS` fails a test whose `when(...)` was never called. It says nothing about a stub that *is* called and that supplies the very answer the assertion checks. That second kind is the expensive kind, and no framework can detect it, because from Mockito's point of view the stub was used correctly. Strict stubbing is a floor. The ceiling is a human asking "could this assertion fail if the production logic were wrong?"

**★ `@MockitoSettings(strictness = LENIENT)` at class level is almost always covering for a shared setup block.**
Someone put six `when(...)` calls in `@BeforeEach`, three tests use two of them each, and strict stubbing correctly complains. The applied fix is to switch strictness off for the whole class, which also switches off detection for every genuine unused stub written afterwards. The actual fix is to move the stubs down into the tests that need them — the same argument the forty-line setup block gets in **topic 08**.

**★ Over-mocking and a shared `@BeforeEach` reinforce each other, so they arrive together.**
Once stubbing lives in setup, adding a stub is free and deleting one is risky, so the arrangement ratchets upward exactly like a data fixture does. The compounding effect is worse than for data, because each added stub also removes a piece of real behaviour from every test in the class. If you are auditing a suite, the classes with the longest `@BeforeEach` are where the least meaningful assertions are.

**★ Mocking at the wrong altitude produces tests that are *harder* to write, which is the tell.**
Four chained stubs to fake `RestClient`'s fluent API is genuinely painful, and people push through because they assume testing HTTP is meant to be painful. It is not. When the arrangement is fighting you, the usual cause is that the seam is in the wrong place, not that you have not found the right matcher yet. Difficulty is diagnostic information.

**★ A mock that is created but never verified and never stubbed is a boundary you forgot to assert.**
Suites accumulate `@Mock EmailSender emailSender;` that exists purely so the constructor call compiles. That is fine for a test about something else — but if *no* test in the suite verifies what gets sent, nothing is testing your email content, and it will read as covered because the service class lines all execute. Grep for mock fields that appear in no `verify` and no `when` across the whole suite; each one is an untested boundary.

## Interview questions

**★ Someone on your team says "we mock everything except the class under test, that's what a unit test means." What is your response?**
That the definition is arbitrary and expensive. Nothing in JUnit, Mockito or any specification defines a unit as one class. A unit is as much code as you can run deterministically and fast. Mocking a pure `Validator` or a `Money` type buys no speed and no determinism, and it costs the test its only chance to catch a real bug — because the answer is now stubbed. The rule I would replace it with is: replace the collaborator if leaving it real would make the test slow, flaky, remote or destructive. Otherwise let it run. In practice that produces bigger, faster, more sensitive units and far fewer lines of `when`.

**★ You have a service test with fifteen `when(...)` lines and it broke when a colleague extracted a private method. What do you do?**
Treat the breakage as the diagnosis, not the incident. A behaviour-preserving refactor broke the test, which means the test is asserting call structure. I'd go through the fifteen stubs and ask of each: is this collaborator slow, remote, non-deterministic or destructive? Almost always two or three are (the gateway, the publisher, the repository) and the rest are pure objects that could just be constructed. Deleting those stubs shrinks the test, makes it sensitive to real logic errors again, and makes the arrangement readable. If after that the test *still* needs eight stubs, the finding has moved to production: the class has eight collaborators and probably more than one responsibility.

**★ You inherit a service with 95% line coverage and a bug ships every sprint. How do you work out what the tests are not doing?**
Line coverage measures execution, not sensitivity, so I would start by measuring sensitivity directly: run a mutation testing tool (PIT, **topic 11**) over the package and look for classes with high line coverage and low mutation score. Those are classes whose tests stubbed the answers. Then I would read their test files for the mechanical tells — the ratio of `when(...)` lines to `assertThat(...)` lines, stubs on value types, a long shared `@BeforeEach`, `RETURNS_DEEP_STUBS`, and any `spy()` of the class under test. Almost always the finding is over-mocking and it is concentrated in a handful of files rather than spread evenly. The fix is subtraction, one stub at a time, letting the real collaborators run.

**★ How would you tell over-mocking from a test that is legitimately isolating a boundary?**
By asking, for each mock, what the test would lose if it were real. If the answer is "it would call Stripe", "it would need a database", "it would return a different UUID each run", the mock is earning its place. If the answer is "nothing, it would just construct an object", the mock is a habit. A second, faster check is whether the mocked thing supplies the value the assertion checks: `when(calculator.total(order)).thenReturn(Money.gbp("90.00"))` followed by an assertion about the total means the test proves nothing about totals. That single pattern accounts for most of the over-mocking I have seen.

**★ A colleague's test mocks `RestClient` and chains four stubs to fake its fluent API. What do you tell them, and what do you show them instead?**
That the pain is the signal: they are mocking Spring's DSL rather than the boundary. There are two honest levels, and neither needs a fluent-API mock. If the test is about the *service* that uses an HTTP gateway, mock their own `PaymentGateway` interface — one method, three outcomes. If the test is about the *client itself* — the URL, the headers, the body, the error mapping — then bind `MockRestServiceServer` to the `RestClient.Builder` the client is built from, or run a real stub server. Both are shown in [03](03-mocking-an-outbound-http-api.md) and [03b](03b-wiremock-and-mockwebserver.md), and both produce a shorter test that can actually catch a wrong URL.

**★ Why does a team drift towards over-mocking rather than under-mocking over time?**
Because only under-mocking is punished. A test that opens a socket goes red, goes flaky, and slows the build, so somebody fixes it that week. A test that asserts implementation shape is green, fast and deterministic — it looks like a *good* test by every automated measure the team has. Its cost is deferred to a refactor months later, and at that point the cost is attributed to the refactor rather than to the test. Any system that only measures speed and colour will select for tests that are fast, green and meaningless. That is why mutation testing and strict stubbing matter: they are the only two signals pointing the other way.

{/* FOOTER */}
