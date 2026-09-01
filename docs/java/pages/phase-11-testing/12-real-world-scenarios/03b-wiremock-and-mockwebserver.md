---
title: "When the thing you need to test is the transport rather than the request, you need a real socket, and the choice between WireMock and MockWebServer is a choice between a stub server with a matching engine and a queue that hands back whatever you enqueued next"
sidebar_label: "03b · WireMock and MockWebServer"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against **WireMock**'s own documentation — the JUnit 5 page
> ([wiremock.org/docs/junit-jupiter](https://wiremock.org/docs/junit-jupiter/)), the
> download page ([wiremock.org](https://wiremock.org/docs/download-and-installation/),
> current stable **3.13.2**, group id `org.wiremock`) and the Spring Boot integration page
> ([wiremock.org/docs/spring-boot](https://wiremock.org/docs/spring-boot/),
> `org.wiremock.integrations:wiremock-spring-boot`); **OkHttp**'s `mockwebserver/README.md`
> and `CHANGELOG.md` on `github.com/square/okhttp` (coordinates
> `com.squareup.okhttp3:mockwebserver3`, package `mockwebserver3`, JUnit 5 module
> `mockwebserver3-junit5`); and the **Spring Framework 7.0.x** reference *Testing Client
> Applications* for the recommendation quoted below.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3.
> ⚠️ **Neither library is managed by `spring-boot-dependencies:4.1.0`** — I checked the BOM
> and there is no `okhttp` or `wiremock` entry. You pin both versions yourself.
> ⚠️ **No sandbox and no test runs on this machine** — Java source, build configuration and
> documented behaviour only, never console output.

**[03a](03a-what-the-mock-server-does-not-run.md) drew the line: `MockRestServiceServer`
replaces the request factory, so everything below it — timeouts, pooling, TLS, redirects,
compression, resets — is simply absent. When the bug you are chasing lives below that line,
you need a process listening on a port. Two libraries do that in the JVM, they are built on
opposite philosophies, and picking the wrong one produces either a fifty-line arrangement
for a three-line need or a test that cannot express the scenario at all. This chunk is the
choice and the WireMock half of the answer; [03e](03e-mockwebserver-and-the-cost-of-a-socket.md)
is the `MockWebServer` half and the honest accounting of what a socket costs you.**

## Spring's own position

The Framework reference no longer treats `MockRestServiceServer` as the default answer:

> *"At present, we recommend using mock web servers for more complete testing of the
> transport layer and network conditions."*

Read that as a scope statement, not a deprecation. `MockRestServiceServer` remains the
better tool for *"is this the request I meant to send"* — it is faster, it needs no port,
and its request matchers are richer than anything you would hand-write. The mock web server
is the better tool for *"does my client survive what the network does"*.

## The two philosophies, which is the actual choice

| | **WireMock** | **MockWebServer** |
|---|---|---|
| Model | A **stub server**: register matchers, it serves whoever matches | A **queue**: enqueue responses, it hands them out in order |
| Matching | URL, method, headers, cookies, query, body (JSON/XML/XPath/regex), priorities | none — or write a `Dispatcher` yourself |
| Unmatched request | **Fails the test by default** | Serves the next queued response regardless |
| Verification | Rich — `verify(postRequestedFor(urlEqualTo(...)))` | `takeRequest()` and assert on `RecordedRequest` |
| Recording/proxying | Yes — record from a live API into stub mappings | No |
| Stateful scenarios | Yes — named scenarios with state transitions | Enqueue in the order you want |
| Fault injection | Yes — malformed responses, connection resets, delays | Yes — `SocketEffect`, `throttleBody`, delays |
| Weight | Jetty-based; a heavier start | Very small; designed for one-per-test |
| Home | `org.wiremock:wiremock` | `com.squareup.okhttp3:mockwebserver3` |

**The one-line rule: if the test needs the server to *decide* what to send based on the
request, use WireMock. If the test needs the server to *do something to the connection*,
either works and `MockWebServer` is lighter.** In practice most teams standardise on one,
and standardising on WireMock is the more common outcome because the matching engine is
what makes the second and third test cheap.

## WireMock · the JUnit 5 setup

```xml
<dependency>
  <groupId>org.wiremock</groupId>
  <artifactId>wiremock</artifactId>
  <version>3.13.2</version>
  <scope>test</scope>
</dependency>
```

⚠️ **The group id changed.** Anything you find under `com.github.tomakehurst:wiremock-jre8`
or `wiremock-jre8-standalone` is the old coordinate; the current artifact is
`org.wiremock:wiremock`. Copying an old dependency block is how teams end up on a version
that predates the JUnit 5 extension entirely.

### Declarative — `@WireMockTest`

```java
@WireMockTest
class HttpPaymentGatewayTest {

    @Test
    void chargesAgainstARealSocket(WireMockRuntimeInfo wm) {
        stubFor(post("/v1/charges")
                .willReturn(okJson("""
                        {"id":"ch_123","status":"succeeded"}
                        """)));

        RestClient.Builder builder = RestClient.builder();
        HttpPaymentGateway gateway =
                new HttpPaymentGateway(builder, new PaymentProperties(wm.getHttpBaseUrl()));

        assertThat(gateway.charge(aCharge().build()).id()).isEqualTo("ch_123");

        verify(postRequestedFor(urlEqualTo("/v1/charges"))
                .withHeader("Idempotency-Key", matching(".+")));
    }
}
```

The `WireMockRuntimeInfo` parameter is how you get the port, which is random by default —
and random is what you want, because a fixed port makes the test fail when it collides. The
annotation takes `httpPort`, `httpsEnabled`, `httpsPort`, `proxyMode` and
`extensionScanningEnabled` when you need them.

Two documented behaviours that make WireMock stricter than people expect, both of them
good:

> *"if the WireMock instance receives unmatched requests during a test run an assertion
> error will be thrown and the test will fail"*

> *"By default WireMock will be reset before each tests method."*

The first is `nock`'s behaviour and the opposite of `MockWebServer`'s. It means a typo in
your production URL fails the test loudly instead of silently serving something. Turn it
off with `.failOnUnmatchedRequests(false)` only when you have a genuine reason. The second
means you do not write teardown; the reset is per method, and since WireMock 3.13.0 it can
be disabled with `.resetOnEachTest(false)`.

### Programmatic — `WireMockExtension`

Use this when you need two servers, a fixed port, or configuration the annotation cannot
express:

```java
class MultiServiceTest {

    @RegisterExtension
    static WireMockExtension payments = WireMockExtension.newInstance()
            .options(wireMockConfig().dynamicPort())
            .failOnUnmatchedRequests(true)
            .build();

    @RegisterExtension
    static WireMockExtension ledger = WireMockExtension.newInstance()
            .options(wireMockConfig().dynamicPort())
            .build();

    @Test
    void bothAreCalled() {
        payments.stubFor(post("/v1/charges").willReturn(okJson("{}")));
        ledger.stubFor(post("/v1/entries").willReturn(ok()));
        // ...
        payments.verify(postRequestedFor(urlEqualTo("/v1/charges")));
    }
}
```

`static` plus `@RegisterExtension` gives one server for the class; an instance field gives
one per method. **Topic 01 · JUnit 5** owns `@RegisterExtension` and the lifecycle rules —
this page just uses them.

### Stub mappings as files — the `msw` handlers module

WireMock loads JSON stub mappings from its file source automatically, which by default is
`src/test/resources/mappings` (with response bodies in `src/test/resources/__files`). That
is the direct analogue of a shared `msw` handlers module: fixtures live as data, not as
Java, and can be recorded from the real API rather than hand-written.

### Pointing the application at it

For a `@SpringBootTest`, the port is only known after the extension starts, so the base URL
goes in through a dynamic property:

```java
@DynamicPropertySource
static void paymentProperties(DynamicPropertyRegistry registry) {
    registry.add("payments.base-url", payments::baseUrl);
}
```

Or use WireMock's own Spring Boot module, `org.wiremock.integrations:wiremock-spring-boot`,
which does the wiring for you:

```java
@SpringBootTest
@EnableWireMock({
  @ConfigureWireMock(name = "payments", baseUrlProperties = "payments.base-url")
})
class CheckoutIntegrationTest { }
```

## Where this connects

- The `MockWebServer` setup, the OkHttp 5 renames, and what a socket costs a suite:
  [03e · MockWebServer and the cost of a socket](03e-mockwebserver-and-the-cost-of-a-socket.md).
- The in-process alternative and precisely what it omits:
  [03](03-mocking-an-outbound-http-api.md) and
  [03a](03a-what-the-mock-server-does-not-run.md).
- The failure catalogue these tools exist for:
  [03c](03c-the-error-paths-nobody-writes.md).
- Asserting the outgoing request in both styles:
  [03d · Asserting what you sent](03d-asserting-what-you-sent.md).
- Vendor SDKs that ship their own protocol-faithful double, which is a third option again:
  [04c](04c-the-sdks-own-test-double.md) and
  [04d](04d-doubles-that-run-the-real-protocol.md).
- **Topic 07 · Testcontainers** owns the "real dependency in a container" argument, which is
  the same shape one level up.

## Gotchas

**★ WireMock's group id is `org.wiremock` now, and every article older than 2023 gives you `com.github.tomakehurst`.**
The old coordinates still resolve from Maven Central, so nothing fails loudly — you simply get an old version. On an old enough version the JUnit 5 extension does not exist, `@WireMockTest` is not on the classpath, and the answers you find tell you to use the JUnit 4 `@Rule`, which then drags a JUnit 4 dependency into a Jupiter project. Check the group id first when a WireMock example will not compile.

**★ WireMock fails on unmatched requests by default and people turn that off to make a test pass.**
`failOnUnmatchedRequests(false)` converts the best property WireMock has into `MockWebServer`'s weakest one. The legitimate uses are narrow: a client that also calls a health endpoint you do not care about, or a proxy-mode recording session. If a stub is not matching, read WireMock's diff output — it tells you which part of the matcher failed — rather than disabling the check.

**★ A class-scoped (`static`) WireMock extension plus JUnit parallel execution is a data race on the stub registry.**
`@RegisterExtension static` gives one server for the whole class, which is the fast configuration; JUnit's parallel execution then runs test methods concurrently against it. Two methods calling `stubFor` for the same URL, or one calling `resetAll` while another is asserting, produces failures that look like WireMock bugs. Either make the extension non-static (a server per method) or keep the class serial. **Topic 01 · JUnit 5** owns the parallelism switches.

**★ WireMock's response templating and its matching engine make it possible to build a second implementation of the partner's API by accident.**
The features are there — templated bodies, scenarios with state, priorities, conditional matchers — and each individual use is defensible. The cumulative result is a fixture nobody can reason about that encodes your *belief* about the partner, tested by nothing. The same argument as [01](01-what-to-mock-and-what-to-let-run.md): a stub is a second specification. Keep stubs flat, keep bodies recorded from real responses where you can, and let a contract test or a scheduled canary check the belief.

## Interview questions

**★ WireMock or MockWebServer — how do you decide?**
By asking whether the test needs the server to make a decision. If the server has to look at the request and choose a response — different bodies for different URLs, a header-conditional stub, a stateful sequence, a recorded fixture set shared across tests — WireMock, because that matching engine is the whole product and hand-writing it is how people accidentally build a worse WireMock. If the test just needs "return this, then that" or "do something nasty to the socket", `MockWebServer` is smaller, starts faster, and the whole arrangement is three lines. The other input is strictness: WireMock fails the test on an unmatched request by default, which catches a wrong URL; `MockWebServer` serves the queue regardless, so the wrong URL only fails if I assert on `takeRequest()`. On a team that is not disciplined about that assertion, WireMock's default is worth real money.

**★ What is the biggest risk of a large WireMock stub set, and what do you do about it?**
That it becomes a second, unverified implementation of the partner's API. Every stub encodes a belief — this endpoint returns this shape, this error produces this code, this field is never null — and nothing in the build checks any of those beliefs against reality. A large enough stub set is confidently wrong, and the tests that depend on it are green while production breaks. The mitigations, in order of cost: record stubs from the real API rather than writing them, so at least the initial shape is true; keep them flat and small so the divergence is visible; put the partner's own error payloads in as fixtures rather than inventing them; and if the integration is important enough, add a scheduled contract test or a canary that hits the real sandbox and asserts the assumptions the stubs encode.

{/* FOOTER */}
