---
title: "The in-process tools: MockRestServiceServer, the slice, and what Boot 4 removed"
sidebar_label: "17 · Testing: the tools"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework reference *Testing → Testing
> Client Applications*
> (docs.spring.io/spring-framework/reference/testing/spring-mvc-test-client.html),
> the Spring Boot 4.1.1 API for
> `org.springframework.boot.restclient.test.autoconfigure.RestClientTest`
> (docs.spring.io/spring-boot/api/java/), the Spring Boot reference *Testing
> Spring Boot Applications* for `@MockitoBean`, and the Spring Boot 4.0
> Migration Guide for the removal of `@MockBean`/`@SpyBean`. Spring Boot 4.1.1,
> Spring Framework 7.0.x, JDK 25.

**Spring's in-process client testing works by *replacing the request factory*,
which is simultaneously why it is fast and why it cannot see the transport. Get
that boundary right and `MockRestServiceServer` plus `@RestClientTest` is an
excellent, quick way to assert the shape of your requests, your error mapping and
your retry counts. Get it wrong and you ship a suite that is green about the one
layer where nothing interesting ever fails. And if you have just upgraded: Boot 4
removed `@MockBean`, moved `@RestClientTest` to a new package, and stopped
auto-configuring MockMvc — three unrelated-looking breakages from one release.**

## `MockRestServiceServer`: intercepting below the client

`MockRestServiceServer` configures the client with a custom
`ClientHttpRequestFactory` that matches requests against expectations and returns
stubbed responses. No socket, no port, no server.

```java
RestTemplate restTemplate = new RestTemplate();

MockRestServiceServer mockServer = MockRestServiceServer.bindTo(restTemplate).build();
mockServer.expect(requestTo("/greeting")).andRespond(withSuccess());

// Test code that uses the above RestTemplate ...

mockServer.verify();
```

Three parts, and all three matter:

- **`expect(...)`** declares a request matcher. `verify()` fails the test if an
  expectation was not met, which is what makes this a *contract* assertion rather
  than a stub.
- **`andRespond(...)`** supplies the response — status, headers, body.
- **Order is enforced by default.** Requests must arrive in the order the
  expectations were declared. `ignoreExpectOrder(true)` relaxes that:

```java
server = MockRestServiceServer.bindTo(restTemplate).ignoreExpectOrder(true).build();
```

Counts come from `ExpectedCount` — `once`, `manyTimes`, `max`, `min`, `between`,
`times(n)` — which is exactly the tool for asserting retry behaviour:

```java
mockServer.expect(times(3), requestTo("/pricing/gold"))
        .andRespond(withServerError());
```

Three attempts expected, and `verify()` fails if the retry policy made two or
four. That single assertion catches the `maxRetries`-versus-`maxAttempts` confusion
from [chunk 14](14-retries-and-resilience.md).

`ExecutingResponseCreator` lets you mix stubbed and real responses in one test —
useful when one call in a flow must hit a real endpoint while the rest are
stubbed.

⚠️ **Because it replaces the request factory, `MockRestServiceServer` cannot test
anything the request factory does.** No timeout fires, no connection is pooled,
no TLS is negotiated, no proxy is consulted. It validates the *shape* of your
requests and your handling of responses, and nothing about the transport. That
boundary is the whole reason for [chunk 18](18-testing-the-failures.md).

## `@RestClientTest`: the slice

Boot's slice annotation limits the context to what a client test needs. Its
javadoc describes it as focusing "only on beans that use `RestTemplateBuilder` or
`RestClient.Builder`", with component scanning limited to `@JacksonComponent`
beans and Jackson modules — and by default it also auto-configures a
`MockRestServiceServer`.

```java
@RestClientTest(PricingGateway.class)
class PricingGatewayTests {

    @Autowired PricingGateway gateway;
    @Autowired MockRestServiceServer server;

    @Test
    void mapsServerErrorToDomainException() {
        server.expect(requestTo("/pricing/gold"))
                .andRespond(withServerError());

        assertThatThrownBy(() -> gateway.lookup("gold"))
                .isInstanceOf(PricingUnavailable.class);

        server.verify();
    }
}
```

⚠️ **In Boot 4 the annotation moved package**, to
`org.springframework.boot.restclient.test.autoconfigure`, as part of the same
reorganisation that produced `spring-boot-starter-restclient-test`. An unresolved
import after an upgrade is that move, not a missing dependency.

For finer control over the mock server there is `@AutoConfigureMockRestServiceServer`.

## 🔴 `@MockBean` is gone

Boot 4 removed `@MockBean` and `@SpyBean` outright — the migration guide says
support "has been removed in this release, in favor of `@MockitoBean` and
`@MockitoSpyBean` support". These are Spring Framework annotations now, not Boot
ones.

```java
@WebMvcTest(PricingController.class)
class PricingControllerTests {

    @Autowired MockMvcTester mvc;

    @MockitoBean PricingGateway gateway;   // was @MockBean
}
```

Two adjacent removals from the same guide, because they break the same tests:
`MockitoTestExecutionListener` is gone (use Mockito's `MockitoExtension`), and
**MockMvc now requires an explicit `@AutoConfigureMockMvc`** when used with
`@SpringBootTest`. `TestRestTemplate` likewise now needs
`@AutoConfigureTestRestTemplate`, and the guide recommends the newer
`RestTestClient` with `@AutoConfigureRestTestClient`.

## Testing an HTTP interface

A declarative client is an ordinary Java interface, which is its quiet advantage
in testing: a caller's unit test mocks it directly, with no HTTP machinery at
all.

```java
@MockitoBean RepositoryService repositoryService;
```

The interface's own behaviour — that `@GetExchange` produces the request you
think — still needs a real test against a stub server or a
`MockRestServiceServer`, because that is exactly the part the proxy generates and
you did not write.

## Gotchas

**⚠️ `@MockBean` after a Boot 4 upgrade**
**Symptom:** the annotation does not resolve.
**Cause:** removed in Boot 4.
**Fix:** `@MockitoBean`, and `@MockitoSpyBean` for spies. Check for
`MockitoTestExecutionListener` and missing `@AutoConfigureMockMvc` in the same
pass — they are removals from the same release and they break together.

**⚠️ Forgetting `verify()`**
**Symptom:** a refactor stops calling the dependency entirely and every test
still passes.
**Cause:** expectations that are never checked.
**Fix:** call `verify()`. It is what turns a stub into an assertion.

**⚠️ Fighting the default request ordering**
**Symptom:** a test fails intermittently once calls are parallelised.
**Cause:** ordering is enforced by default and parallel calls arrive in any
order.
**Fix:** `ignoreExpectOrder(true)` — and note that each expectation still matches
only once unless an `ExpectedCount` says otherwise.

**⚠️ An unresolved `@RestClientTest` import after upgrading**
**Symptom:** the annotation cannot be found although the test dependency is
present.
**Cause:** it moved to `org.springframework.boot.restclient.test.autoconfigure`
in Boot 4.
**Fix:** update the import; add `spring-boot-starter-restclient-test` if it is
genuinely absent.

**⚠️ A test that asserts the retry count by counting log lines**
**Symptom:** the assertion breaks whenever logging changes, and passes when the
policy silently stops working.
**Cause:** logs are not a contract.
**Fix:** `expect(times(3), ...)` plus `verify()`, which asserts the actual
requests.

## Interview questions

**★ What can `MockRestServiceServer` test, and what can it not?**
It can test everything above the transport: that your client sent the method,
path, headers and body you intended, that you handle each response status
correctly, and — via `ExpectedCount` and `verify()` — how many times a call was
made, which is how you assert a retry policy. It cannot test anything the request
factory does, because it *replaces* the request factory: no timeout fires, no
connection is pooled or exhausted, no TLS is negotiated, no redirect is followed.
That is a serious limit, because almost every failure mode worth designing for
lives in the layer it removed, which is why Spring's own documentation points at
a real stub server for transport-level testing.

**★ `@MockBean` no longer compiles after a Boot 4 upgrade. What happened, and
what else broke at the same time?**
`@MockBean` and `@SpyBean` were removed in Boot 4 in favour of Spring Framework's
`@MockitoBean` and `@MockitoSpyBean`, which are drop-in replacements for the
common case. Two adjacent changes usually break the same test classes:
`MockitoTestExecutionListener` was removed, so tests relying on it should use
Mockito's own `MockitoExtension`; and MockMvc now requires an explicit
`@AutoConfigureMockMvc` alongside `@SpringBootTest` rather than being
auto-configured. `TestRestTemplate` similarly needs
`@AutoConfigureTestRestTemplate`, with `RestTestClient` recommended as the newer
option.

**★ What does `@RestClientTest` give you over a plain `@SpringBootTest`?**
A slice: the context is limited to beans that use `RestTemplateBuilder` or
`RestClient.Builder`, component scanning is restricted to Jackson-related
components, and a `MockRestServiceServer` is auto-configured for you. The value
is that it starts in a fraction of the time and, more importantly, fails for the
right reasons — a broken repository bean cannot break your client test, because
it was never in the context. The trade-off is the usual slice trade-off: it does
not prove the client works inside the full application, so if a
`RestClientCustomizer` or a property binding is what you are worried about, the
slice may not include it.

**★ How do you assert that a retry policy did what you configured?**
`mockServer.expect(times(3), requestTo("/pricing/gold")).andRespond(withServerError())`
followed by `verify()`. That asserts the exact number of requests, which is the
property you care about and the one that silently changes — `maxRetries = 3` means
four invocations, not three, so a migration from Spring Retry moves this number
without anyone editing it. Counting log lines instead is the common alternative
and it is bad in both directions: it breaks when logging changes, and it passes
when `@EnableResilientMethods` is missing and nothing retried at all.

**★ Where does testing an HTTP service interface differ from testing a
hand-written client?**
The caller's tests get simpler and the client's tests do not go away. Because the
interface is an ordinary Java type, any class that depends on it can be tested
with `@MockitoBean` and no HTTP machinery at all, which is a real advantage over a
concrete client class you have to stub. But the proxy is generated code that you
did not write and cannot read, so the mapping from `@GetExchange` and
`@PathVariable` to an actual request still needs a test against
`MockRestServiceServer` or a stub server. The rule of thumb is: test the interface
once, against the wire; mock it everywhere else.

---

← Prev: [Observing outbound calls](16-observing-outbound-calls.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Testing the failures](18-testing-the-failures.md)
