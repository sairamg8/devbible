---
title: "Test the failures, because the happy path was never the risk"
sidebar_label: "18 · Testing the failures"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework reference *Testing → Testing
> Client Applications*, which recommends a dedicated mock web server for
> transport-layer and network-condition testing
> (docs.spring.io/spring-framework/reference/testing/spring-mvc-test-client.html).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**Every argument in this topic has been about a failure mode — a timeout, an
exhausted pool, a 500 that should have been a 502, a retry that duplicated an
order. A suite that only asserts "the client parses the JSON" validates none of
them. The tests that pay make the dependency behave badly, and one of those
behaviours — being *slow* — cannot be produced in process at all, because
`MockRestServiceServer` never touches a socket. That single limitation is why
Spring's own documentation points at a real stub server, and why the timeout you
believe you configured is untested until you run one.**

## When you need a real server

The framework's own documentation recommends a dedicated mock web server —
OkHttp's `MockWebServer`, or WireMock — for more complete transport-layer and
network-condition testing. That recommendation is the important sentence in this
chunk, because of what it enables:

| You want to test | `MockRestServiceServer` | Real stub server |
|---|---|---|
| Request shape: method, path, headers, body | ✅ | ✅ |
| Response handling and error mapping | ✅ | ✅ |
| Retry counts | ✅ | ✅ |
| **A response that is slow** | ❌ | ✅ |
| **A connection that is refused or reset** | ❌ | ✅ |
| Connection pooling and exhaustion | ❌ | ✅ |
| TLS, proxy, redirects | ❌ | ✅ |
| Speed and simplicity | ✅ | slower, a port to manage |

🔴 **The row that matters is "a response that is slow".** Every argument in
chunks [6](06-what-a-timeout-covers.md) through [11](11-deadlines-not-timeouts.md)
was about a dependency that is *slow*, not down — and `MockRestServiceServer`
cannot be slow, because it never touches a socket and there is no timeout to
exceed. A stub server that delays its response is the only way to assert that
your read timeout is configured, that it fires at the value you think, and that
the resulting `ResourceAccessException` is mapped to a 503 rather than a 500.

That test is worth writing once per dependency, because a timeout that was
misconfigured is completely invisible until production.

## What to actually test

Ordered by how much each one has saved people:

1. **The read timeout fires**, at roughly the configured value, against a
   deliberately slow stub — and produces the status *you* intended.
2. **A downstream 5xx maps to your 502/503**, and never leaks their body.
3. **A downstream 4xx caused by your request maps to a 500**, not to a
   pass-through 400.
4. **The retry count is exactly what you configured** — `times(n)` and
   `verify()`.
5. **A retried `POST` carries the same idempotency key on every attempt.** This
   is a request-matcher assertion, and it is the only way to catch the
   generate-inside-the-method bug from [chunk 15](15-retrying-safely.md).
6. **A 404 becomes `Optional.empty()`** where that is the contract, and an
   exception where it is not.
7. **A non-JSON error body** — an HTML 502 from a proxy — does not throw from
   inside your error handler.

Where the gateway class is well isolated, the *callers* of it should not be
testing HTTP at all: mock the gateway interface with `@MockitoBean` and test the
business logic against domain exceptions. Broader test-slice strategy is
[Phase 11 — Testing](../../phase-11-testing/README.md).

## The shape of a slow-dependency test

The point of a stub server is that it can take its time. Whatever library you
use, the test has the same three parts: a stub that delays past the configured
bound, a client pointed at it by property override, and an assertion on the
*mapped* outcome rather than on the raw exception.

```java
@SpringBootTest(properties = "spring.http.clients.read-timeout=300ms")
class PricingGatewayTimeoutTests {

    // stubFor(get("/pricing/gold").willReturn(aResponse().withFixedDelay(2000)));
    // or MockWebServer: enqueue(new MockResponse().setBodyDelay(2, SECONDS));

    @Autowired PricingGateway gateway;

    @Test
    void slowDependencyBecomesUpstreamUnavailable() {
        assertThatThrownBy(() -> gateway.lookup("gold"))
                .isInstanceOf(PricingUnavailable.class);
    }
}
```

Two details make it worth keeping rather than deleting after the first green run.
Asserting on `PricingUnavailable` rather than on `ResourceAccessException` means
the test covers the *mapping* from [chunk 13](13-their-failure-is-not-yours.md)
as well as the timeout. And setting the timeout as a property in the test rather
than hard-coding a short one in a test-only client means the test exercises the
same configuration path production uses — which is the path that broke when the
property was renamed in Boot 4.

⚠️ **Do not assert a tight elapsed time.** "Failed in under 400 ms" is a flaky
assertion on shared CI hardware. Assert that it failed, and that it failed
*before* the stub's delay elapsed, with generous margins.

## Stub drift: the failure mode of every stubbed test

A stub encodes what you *believe* the dependency returns. Nothing keeps that
belief true. The provider adds a required field, changes an error shape, or
starts returning 422 where it used to return 400, and every one of your tests
stays green while production breaks.

There is no complete answer, only degrees of mitigation, and it is worth being
honest about the trade:

| Approach | Catches drift? | Cost |
|---|---|---|
| Hand-written stubs | no | lowest |
| Stubs generated from the provider's OpenAPI document | schema drift, on regeneration | a build step |
| Consumer-driven contract tests | yes, at the provider's build | a shared contract and provider buy-in |
| A scheduled smoke test against the real dependency | yes, late | flaky, and needs credentials |
| Sharing the provider's `@HttpExchange` interface as an artifact | signature drift, at compile time | coupling |

The last row is the one this topic makes available and people overlook: if the
provider publishes its HTTP interface, a change to a method signature breaks your
*build* rather than your production traffic — which is the earliest and cheapest
place to find out. It does not catch a semantic change behind an unchanged
signature, so it is a floor, not a ceiling. The OpenAPI route is
**[Topic 14 — OpenAPI with springdoc](../14-openapi-springdoc/README.md)**.

## Gotchas

**⚠️ Believing a `MockRestServiceServer` test proves the timeout works**
**Symptom:** production times out at thirty seconds against a service the tests
"cover".
**Cause:** the mock replaces the request factory, so no timeout is ever
exercised.
**Fix:** one test per dependency against a delaying stub server. It is the only
place a timeout can be observed.

**⚠️ Testing resilience against a dependency that refuses connections**
**Symptom:** the chaos test is green and the real incident still takes the
service down.
**Cause:** a refused connection fails in milliseconds and exercises no timeout,
no pool exhaustion and no queueing. Slow is the hard case, not down.
**Fix:** delay the stub. Everything interesting in this topic happens between
"fast" and "never".

**⚠️ Asserting a precise elapsed time**
**Symptom:** a timeout test that fails on a busy CI runner and passes locally.
**Cause:** wall-clock assertions on shared hardware.
**Fix:** assert the failure and its type, and that it happened before the stub's
much-longer delay. Precision here buys nothing and costs a quarantined test.

**⚠️ Hard-coding a short timeout in a test-only client**
**Symptom:** the timeout test passes for years while production has no timeout at
all.
**Cause:** the test built its own client instead of exercising the configured
one, so a renamed property was never noticed.
**Fix:** override the property with `@SpringBootTest(properties = ...)` and let
the client be built the way production builds it.

**⚠️ Stubs that were written once and never revisited**
**Symptom:** a full green suite and a production failure on a field the provider
added months ago.
**Cause:** the stub encodes a belief about the provider that nothing verifies.
**Fix:** generate stubs from the provider's schema, adopt contract tests, or at
minimum consume the provider's published interface so signature changes break the
build.

**⚠️ A single test that tries to cover the whole failure matrix**
**Symptom:** a large parameterised test that everyone skips reading and nobody
maintains.
**Cause:** treating "failure testing" as one item on a checklist.
**Fix:** one small, named test per failure mode — slow, 5xx, 4xx, non-JSON error
body, retry count. The names are the documentation of what you decided.

## Interview questions

**★ How would you test that your read timeout is actually configured?**
With a stub server that delays. Start WireMock or a `MockWebServer`, configure the
response to arrive after longer than the read timeout, point the client at it, and
assert both that the call fails within roughly the configured bound and that the
resulting `ResourceAccessException` is mapped to whatever your API returns —
typically a 504 or 503. It cannot be done with `MockRestServiceServer`, because
nothing there can be slow. This is worth one test per dependency, because a
timeout that was never applied — a property renamed in Boot 4, a client built with
`RestClient.create()` — is completely invisible until an incident.

**★ How would you test that a retried `POST` is safe?**
By asserting on the request, not the outcome. Configure the stub to fail the first
attempt and succeed on the second, then assert that both requests carried *the
same* `Idempotency-Key` header. That is the only test that catches the most common
implementation bug, which is generating the key inside the retried method so that
every attempt looks like a new logical request to the server — the mechanism is
present in the code and absent in effect, and the operation still succeeds, so
nothing else fails. If the endpoint is not idempotent at all, the test to write is
the one asserting you do *not* retry it.

**★ Your chaos test kills the dependency and the service survives. Are you
resilient?**
Only against the easy failure. A killed dependency refuses connections, which
trips the connect timeout in milliseconds — nothing queues, no pool is exhausted,
no thread is held. The failure that actually causes outages is a dependency that
is *slow*: it accepts connections normally and then holds every request's
connection and thread for as long as your timeouts allow, which is what exhausts
the pool and cascades. So the experiment worth running injects latency rather than
killing the process, and the assertion is that the service sheds load and returns
a sensible status rather than that it keeps succeeding.

**★ What is stub drift and what can you actually do about it?**
It is the gap that opens between what your stub says the dependency returns and
what it now really returns — a new required field, a changed error shape, a 422
where a 400 used to be. Your tests stay green because they are testing your
belief, not the provider. There is no complete fix, only a ladder of mitigations:
generate stubs from the provider's OpenAPI document so a schema change forces a
regeneration; adopt consumer-driven contract tests so the provider's build fails
when it breaks you; or, cheapest and most overlooked, consume the provider's
published `@HttpExchange` interface as an artifact so a signature change breaks
your compile. The last one is a floor rather than a ceiling — it catches nothing
behind an unchanged signature — but it costs almost nothing.

**★ Which failure modes would you insist on having a test for, if you could only
have four?**
A slow dependency, because it is the failure that causes outages and the only one
that needs a real stub server. A downstream 5xx mapping to my 502 or 503, because
returning 500 there points every alert at the wrong team. A downstream 4xx caused
by my own request mapping to a 500, because passing it through blames a caller who
never saw the request. And the retry count, asserted with `times(n)` and
`verify()`, because retry configuration is silently wrong in both directions —
absent when `@EnableResilientMethods` is missing, and one attempt larger than
intended after a Spring Retry migration.

**★ Why override the timeout as a property in a test rather than building a
short-timeout client?**
Because the thing most likely to be broken is not the timeout value, it is
whether the value reaches the client at all. Boot 4 renamed the HTTP client
property namespace, a misspelled key binds silently, and a client created with
`RestClient.create()` ignores properties entirely — all three produce a service
with no effective timeout. A test that builds its own client with a hard-coded
300 ms bound passes under every one of those conditions. Overriding the property
and letting the application build the client the way it does in production
exercises the whole path, which is where the defect actually lives.

---

← Prev: [Testing: the tools](17-testing-outbound-calls.md) · Index: [Phase 9 — Spring Boot and the web](../README.md)
