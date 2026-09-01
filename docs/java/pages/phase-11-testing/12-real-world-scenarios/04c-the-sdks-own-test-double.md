---
title: "When the vendor ships its own mock server you should use it — but read what it says it does not do first, because Stripe's own README tells you plainly that stripe-mock will return a success where you asked for a decline"
sidebar_label: "04c · The SDK's own test double"
sidebar_position: 24
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against **stripe-mock**'s README, read in full
> ([github.com/stripe/stripe-mock](https://github.com/stripe/stripe-mock/blob/master/README.md))
> — every quoted sentence on this page is from it — and the **Testcontainers 2.0.5**
> LocalStack module page ([java.testcontainers.org](https://java.testcontainers.org/modules/localstack/)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3, Testcontainers 2.0.5.
> ⚠️ **No sandbox and no Docker on this machine** — this page carries Java source and
> documented behaviour, never container logs, timings or test output.

**Population B from [04b](04b-the-adapter-and-the-three-test-populations.md) needs
something on the other end of the socket. There are five candidates, they are not
interchangeable, and the most commonly recommended one — "use the vendor's own mock
server" — comes with limitations the vendor documents in plain English and almost nobody
reads. This page ranks the options by what each actually proves, and shows the one
combination that covers both the happy path and the error paths.**

## The precondition: can you point the SDK somewhere else?

Before choosing anything, check one thing. Every option below except "no test at all"
requires that the SDK's client can be built against a base URL you supply.

```java
// Stripe: an explicit override on the builder.
StripeClient client = StripeClient.builder()
        .setApiKey("sk_test_123")
        .setApiBase("http://localhost:" + stripeMock.getFirstMappedPort())
        .build();

// AWS SDK v2: endpointOverride on any client builder.
S3Client s3 = S3Client.builder()
        .endpointOverride(localstack.getEndpoint())
        .credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create(localstack.getAccessKey(), localstack.getSecretKey())))
        .region(Region.of(localstack.getRegion()))
        .build();
```

If the SDK has no such hook — some older or narrower SDKs hard-code the host — then the
adapter test is not possible without either an HTTP proxy configured through JVM system
properties, or replacing the SDK's HTTP client implementation with one of your own. Both
are real options and both are unpleasant. Establish this on day one, because it decides
whether the whole of population B is available to you, and it is much cheaper to discover
before you have written the adapter than after.

## The five candidates, ranked by what they prove

| Option | Proves | Does not prove | Cost |
|---|---|---|---|
| **1 · No adapter test** | nothing | everything | zero, until the first charge |
| **2 · Mock the SDK client** | your assumptions match themselves | serialization, auth, wire format, real statuses | low, negative value |
| **3 · HTTP stub you control** (WireMock, `MockWebServer`) | request shape, auth headers, your handling of *any* response including errors | that the vendor ever sends what you stubbed | a socket per test class |
| **4 · The vendor's own double** (stripe-mock, LocalStack, Azurite, Pub/Sub emulator) | request shape validated *by the vendor's spec*, response shapes that are genuinely theirs | behaviour, state, error responses (varies wildly) | a container per suite |
| **5 · The vendor's sandbox** (Stripe testmode, PayPal sandbox) | close to real behaviour, including declines | nothing offline; not deterministic; not in CI | network, credentials, flakiness |

Option 2 is the one people reach for and it is the only one on the list with negative
value — [04](04-a-third-party-sdk.md) argues that at length. The real choice is between 3
and 4, and the answer is usually **both**, for different tests.

## What a vendor double proves that a mock cannot

Everything between your adapter's method call and the bytes on the wire is code you did not
write and cannot see: the SDK's parameter encoder, its auth header construction, its API
version pinning, its JSON deserializer, its connection and read timeouts, its own retry
loop. A mock of the client skips all of it. A real client against a real socket runs all of
it.

Concretely, these are bugs only option 3 or 4 can catch:

- The amount was serialised as `25.0` instead of `2500`.
- The idempotency key went into the body instead of the `Idempotency-Key` header, so the
  vendor ignored it entirely.
- The `Stripe-Version` header pins an API version two years old, and the field your
  deserializer wants does not exist in it.
- Your `metadata` map key contains a character the vendor rejects with a 400 you never
  handled.
- The client's default read timeout is 80 seconds and your HTTP thread pool is 20 — one
  slow vendor and the whole application stops serving.

## stripe-mock: read the README before you rely on it

stripe-mock is the canonical example of a vendor-shipped double, and its own README is
unusually honest about the ceiling. These sentences should be quoted at anyone who proposes
it as *the* payment test strategy:

> *"stripe-mock is a mock HTTP server based on the real Stripe API. It accepts the same
> requests and parameters that the Stripe API accepts, and rejects requests whose
> parameters are not recognized or have incorrect types."*

That is the value: **request validation by the vendor's own schema.** And then:

> *"stripe-mock **does not attempt to reproduce the behavior of the real Stripe API at
> all**. It cannot reject all invalid requests, and its responses are completely hardcoded.
> They will have a correct type, but they will not necessarily be realistic Stripe
> responses."*

> *"stripe-mock is stateless. Data you send on a `POST` request will be validated, but it
> will be completely ignored beyond that."*

> *"Testing for specific responses and errors is currently not supported. It will return a
> success response instead of the desired error response."*

Read that last one twice. **The error branches of your adapter — the ones
[04b](04b-the-adapter-and-the-three-test-populations.md) argues are the most important
thing in the class — cannot be tested against stripe-mock at all.** Ask it for a declined
card and it hands you a success. A test suite built entirely on stripe-mock has its best
coverage exactly where the risk is lowest.

It is also *"powered by the Stripe OpenAPI specification and is therefore kept up-to-date
with the latest methods, resources, and fields"* — and correspondingly *"locked to the
latest version of Stripe's API and doesn't support old versions"*, which is a real problem
if your production integration pins an older `Stripe-Version`.

So the shape of a sane Stripe adapter test suite is a division of labour:

```java
// Happy-path request shape: let the vendor's own schema validate what we send.
@Test
void aChargeSendsTheRightParametersToStripe() { /* against stripe-mock */ }

// Every error branch: a stub we control, because the vendor's double cannot produce them.
@Test
void aCardErrorBecomesADecline()      { /* WireMock: 402 + card_declined body */ }

@Test
void aRateLimitBecomesUnavailable()   { /* WireMock: 429 + Retry-After */ }

@Test
void aConnectionResetIsNotSwallowed() { /* WireMock fault injection */ }
```

The tooling for the second group — WireMock versus `MockWebServer`, and what each costs —
is **fork C's 03b**, and the catalogue of error responses worth stubbing is **fork C's
03c**. Nothing here re-teaches them; the point of this page is *which of your tests belong
in which column*.

## Where this connects

- The interface that made any of this possible is
  [04 · A third-party SDK](04-a-third-party-sdk.md); which tests go where is
  [04b · The three test populations](04b-the-adapter-and-the-three-test-populations.md).
- The doubles that run the *real protocol* rather than a hardcoded catalogue — LocalStack,
  GreenMail, the emulators — are
  [04d · Doubles that run the real protocol](04d-doubles-that-run-the-real-protocol.md).
- **Fork C's 03b · WireMock and MockWebServer** owns the socket-level stub tooling, and
  **fork C's 03c · The error paths nobody writes** owns the catalogue of failures to stub.
- The idempotency key that stripe-mock validates the *presence* of but never enforces the
  *semantics* of is [09b](09b-idempotency-and-the-double-charge.md).

## Gotchas

**★ stripe-mock returns a success when you ask for a decline, so an adapter suite built
only on it has zero coverage of its most important branch.**
The README says it outright: *"Testing for specific responses and errors is currently not
supported. It will return a success response instead of the desired error response."* The
practical consequence is that your `catch (CardException e)` block is unexecuted by any
test, and the mapping from decline code to customer message is unverified. Cover error
branches with a stub you control, and use the vendor double only for the request-shape
tests it is actually good at.

**★ A stateless double makes "create then fetch" tests pass for the wrong reason.**
stripe-mock is explicit that *"Data you send on a `POST` request will be validated, but it
will be completely ignored beyond that."* A test that creates a customer and then reads it
back gets a hardcoded fixture, not your customer — so it passes even if the create silently
sent the wrong ID. Statefulness is the single most important property to establish about a
double before you write a test against it, because it silently changes what a round-trip
assertion means.

**★ The vendor's double tracks the vendor's latest API; your production integration may not.**
stripe-mock is *"locked to the latest version of Stripe's API and doesn't support old
versions."* If your client pins `Stripe-Version: 2022-11-15`, the double is answering a
different API from the one production talks to, and a field your deserializer needs may be
present in the test and absent in production, or vice versa. Pin the double's image tag,
review it when you bump the API version, and treat a mismatch between the two as a release
blocker rather than a test-only detail.

**★ A double pinned by image tag silently becomes a snapshot of an API that has moved on.**
`stripe/stripe-mock:latest` in CI means your test result changes when the vendor pushes an
image, which is a different kind of flaky — it is not your code that changed. Pin the tag.
But then nothing tells you the pinned tag has fallen behind the live API, because your tests
never talk to the live API. The only real answer is a small number of scheduled tests
against the vendor's *sandbox*, run nightly and outside the PR pipeline, whose failure
opens a ticket rather than blocking a merge.

**★ Pointing the SDK at a local base URL often disables its TLS path, and TLS is sometimes
where the bug is.**
`http://localhost:12111` exercises no certificate validation, no SNI, no protocol
negotiation. If your production failure mode is a corporate proxy, a pinned CA bundle or a
TLS version mismatch, none of these tests will ever see it. stripe-mock *"will respond over
HTTP or over HTTPS"*, so use HTTPS when TLS configuration is part of what you are worried
about — otherwise be clear with yourself that TLS is untested.

**★ Vendor sandboxes belong in a scheduled job, never in the PR pipeline.**
Stripe testmode and its equivalents are the only doubles that reproduce real behaviour, so
the pull to use them is strong. They are also remote, rate-limited, occasionally down,
shared with your colleagues, and stateful across runs — every property that makes a CI test
flaky. Run them nightly, alert on failure, and keep the merge-blocking suite offline and
deterministic. **Topic 01 · JUnit 5**'s flaky-test chunks own the general form of this rule.

**★ "The SDK can't reach the internet in CI" is a symptom, not a failure — and the fix is
not to add network access.**
An adapter test that fails in CI with a DNS or connect error is telling you the base-URL
override did not take effect, usually because a second client is being constructed
somewhere the test does not control (a `@Configuration` still building the production
client, an SDK global default, a static initialiser). Adding egress to the CI runner makes
the test pass by talking to the real vendor, which is the worst of all outcomes: slow,
flaky, and occasionally billable. Find the second client instead.

**★ A test that asserts on the double's canned fixture values is asserting on the double.**
`assertThat(result.reference()).isEqualTo("ch_1AbC…")` — that string came from stripe-mock's
hardcoded fixture, not from anything your code decided. When the double's fixtures change,
the test fails and you learn nothing. Assert on the *shape* your adapter produced (a
non-blank reference, the right result subtype) and on the *request* you sent, both of which
are properties of your code.

## Interview questions

**★ The vendor ships a mock server. Is that the end of the discussion?**
No, and the reason is specific rather than philosophical: read what the double says it does
not do. stripe-mock's own README states it *"does not attempt to reproduce the behavior of
the real Stripe API at all"*, that it is stateless, and that error responses are not
supported — it will return a success where you asked for a decline. So it is an excellent
validator of the requests you send and useless as a source of the responses you must
handle. The correct posture is to use the vendor double for request-shape and
deserialization tests, and a stub you control for every error branch. A team that adopts
only the vendor double ends up with the best coverage on the path that never breaks.

**★ You have a container-based double and an in-JVM HTTP stub available. When do you pick
which?**
Pick the vendor double when the question is *"is what I am sending acceptable to the
vendor?"* — because it validates against the vendor's schema, which no stub of yours can.
Pick your own stub when the question is *"what does my code do when the vendor answers
badly?"* — because you need to produce a 429 with a `Retry-After`, a 500, a truncated body
or a connection reset on demand, and no vendor double will cooperate. Cost breaks ties: the
in-JVM stub is faster and has no Docker dependency, so if a test could reasonably go either
way, it goes to the stub.

**★ Your SDK does not let you override the base URL. What are your options?**
Three, in descending order of pleasantness. First, check again — many SDKs hide it on the
builder or behind an environment variable, and some read a documented system property.
Second, replace the SDK's HTTP client: most modern SDKs let you inject an
`HttpClient`/`SdkHttpClient`, and you can supply one that routes to your stub. Third,
configure a JVM-wide proxy through system properties and run the test with it set — which
works but is global state that leaks into other tests in the same JVM and interacts badly
with parallel execution. If all three fail, be honest: population B is not available, the
adapter is untested, and the mitigation is a canary in staging rather than a test that
pretends.

**★ How do you stop the vendor double from drifting away from the real API without
noticing?**
Accept that you cannot detect the drift from inside the offline suite, because nothing in
it talks to the vendor. Two things help. Pin the double's image tag so the drift is at
least *deliberate* — a version bump in a diff — rather than something that happens when the
vendor pushes `latest` on a Tuesday. Then add a small number of tests against the vendor's
real sandbox, running on a schedule outside the merge pipeline, whose job is not to gate
anything but to tell you that the offline double and the real API have diverged. Their
failure should open a ticket, not block a release; treating them as merge-blocking is how
teams end up disabling them.

**★ A reviewer says the adapter test is "an integration test" and belongs in a separate,
slower suite. Are they right?**
Partly, and the distinction that matters is not speed but *what fails it*. An adapter test
against an in-JVM stub is fast, offline and deterministic — it belongs in the ordinary
suite, and moving it to a nightly job means the request-shape regressions it exists to catch
are found a day late. An adapter test that starts a container is slower and depends on a
Docker daemon, so a project that cannot assume one on every developer machine has a real
reason to tag it. What should never move to the slow suite is the error-translation tests,
because those need no infrastructure at all beyond a stub, and they are the ones you most
want run on every commit.

{/* FOOTER */}
