---
title: "MockRestServiceServer replaces exactly one object — the ClientHttpRequestFactory — which is why your Jackson converters are real, your connection pool is not, and the list of production failures this test can never reproduce is longer than the list it can"
sidebar_label: "03a · What it does not run"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.x** reference *Testing Client
> Applications*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/spring-mvc-test-client.html))
> and the `MockRestServiceServer`, `MockRestServiceServer.MockRestServiceServerBuilder`,
> `MockRestResponseCreators` and `ExecutingResponseCreator` javadocs
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/web/client/MockRestServiceServer.html));
> plus the **Spring Boot 4.1** `MockServerRestClientCustomizer` javadoc
> ([docs.spring.io](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/restclient/test/MockServerRestClientCustomizer.html)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**[03](03-mocking-an-outbound-http-api.md) showed how to bind the mock server and write the
test. This chunk is the part that decides how much you are allowed to believe it. The
mechanism is one sentence — a single object in the client is swapped — and everything
useful about the technique, and every limit of it, falls out of exactly where that swap
happens in the stack. Then the rest of the API: the `RestTemplate` and multi-client
bindings, ordering, expected counts, resetting, and the passthrough response creator that
lets one endpoint call the real world while the others stay stubbed.**

## The mechanism, in one sentence

The reference states it plainly:

> *"`MockRestServiceServer` (the central class for client-side REST tests) configures the
> `RestTemplate` with a custom `ClientHttpRequestFactory` that asserts actual requests
> against expectations and returns 'stub' responses."*

`ClientHttpRequestFactory` sits **below** the message converters and **above** the socket.
So draw the line there and the consequences read themselves off:

| Layer | Runs for real? |
|---|---|
| Your code, your URI template, your `.header(...)` calls | ✅ real |
| `UriBuilderFactory` — encoding, path variables, query params | ✅ real |
| `HttpMessageConverter` — Jackson serializing the request body | ✅ real |
| `HttpMessageConverter` — Jackson deserializing the response body | ✅ real |
| Status handling — `onStatus`, `defaultStatusHandler`, the thrown exception type | ✅ real |
| **`ClientHttpRequestFactory`** | ⛔ **replaced — this is the seam** |
| Connect timeout, read timeout | ⛔ never applied |
| Connection pool, keep-alive, connection reuse | ⛔ does not exist |
| TLS, certificate validation, SNI, proxies | ⛔ does not exist |
| Redirect following, `Content-Encoding: gzip`, chunked transfer | ⛔ handled by the factory, so absent |
| DNS resolution, and therefore a wrong host name | ⛔ never attempted |
| HTTP/2, connection reset, half-closed sockets | ⛔ no socket at all |

That top half is why the technique is worth using: a wrong `@JsonProperty`, a
mis-encoded query parameter, a missing header and a wrong error mapping all fail this test.
The bottom half is why Spring itself now points elsewhere for anything transport-shaped:

> *"At present, we recommend using mock web servers for more complete testing of the
> transport layer and network conditions."*

That recommendation is [03b · WireMock and MockWebServer](03b-wiremock-and-mockwebserver.md),
and the failures it unlocks are [03c](03c-the-error-paths-nobody-writes.md).

## Binding a `RestTemplate`

Nothing about the argument changes; only the binding line does. The reference's own snippet:

```java
RestTemplate restTemplate = new RestTemplate();

MockRestServiceServer mockServer = MockRestServiceServer.bindTo(restTemplate).build();
mockServer.expect(requestTo("/greeting")).andRespond(withSuccess());

// Test code that uses the above RestTemplate ...

mockServer.verify();
```

If the class takes a `RestTemplateBuilder`, `@RestClientTest` covers it — its javadoc names
both builder types explicitly.

## Two clients in one test

`MockServerRestClientCustomizer` is the machine underneath the slice, and it is the only
route when one class builds **two** clients. Its javadoc:

> *"If the customizer is only used once, the `getServer()` method can be used to obtain the
> mock server. If the customizer has been used more than once the
> `getServer(RestClient.Builder)` or `getServers()` method must be used to access the
> related server."*

```java
MockServerRestClientCustomizer customizer = new MockServerRestClientCustomizer();
RestClient.Builder payments = RestClient.builder();
RestClient.Builder ledger   = RestClient.builder();
customizer.customize(payments);
customizer.customize(ledger);

customizer.getServer(payments).expect(requestTo("/v1/charges")).andRespond(withSuccess());
customizer.getServer(ledger).expect(requestTo("/v1/entries")).andRespond(withSuccess());
```

It also carries `setBufferContent(boolean)` — documented as controlling whether the
`BufferingClientHttpRequestFactory` wrapper is used *"to buffer the input and output
streams, and for example, allow multiple reads of the response body."* That is the switch
for a test that needs to read the body twice.

## Order, counts and reset

By default expectations are **ordered**: the first request must match the first expectation.
That is usually a feature and occasionally a lie about your production code, because a
client that fires two independent calls has no guaranteed order. The builder's opt-out,
from the reference:

```java
server = MockRestServiceServer.bindTo(restTemplate).ignoreExpectOrder(true).build();
```

Counts come from the two-argument `expect`:

```java
MockRestServiceServer mockServer = MockRestServiceServer.bindTo(restTemplate).build();
mockServer.expect(times(2), requestTo("/something")).andRespond(withSuccess());
mockServer.expect(times(3), requestTo("/somewhere")).andRespond(withSuccess());

mockServer.verify();
```

`ExpectedCount` also offers `once()`, `manyTimes()`, `min(int)`, `max(int)` and
`between(int, int)` — `min(1)` is what you want for "at least one retry happened, I do not
care how many".

Two verifications and one reset are worth memorising:

- `verify()` — *"Verify that all expected requests set up via `expect(RequestMatcher)` were
  indeed performed."*
- `verify(Duration)` — *"Variant of `verify()` that waits for up to the specified time for
  all expectations to be fulfilled. This can be useful for tests that involve asynchronous
  requests."* This is the one for a client called from an `@Async` method; see
  [07](07-async-scheduled-and-eventual.md).
- `reset()` — *"Reset the internal state removing all expectations and recorded requests."*

## Letting one call go to the real world

`ExecutingResponseCreator` is the `msw` `passthrough()` equivalent and it is genuinely
useful for exactly one thing: pinning a recorded fixture against the live API on demand.
The reference's snippet:

```java
RestTemplate restTemplate = new RestTemplate();

// Create ExecutingResponseCreator with the original request factory
ExecutingResponseCreator withActualResponse =
        new ExecutingResponseCreator(restTemplate.getRequestFactory());

MockRestServiceServer mockServer = MockRestServiceServer.bindTo(restTemplate).build();
mockServer.expect(requestTo("/profile")).andRespond(withSuccess());
mockServer.expect(requestTo("/quoteOfTheDay")).andRespond(withActualResponse);

// Test code that uses the above RestTemplate ...

mockServer.verify();
```

The line that makes it work is capturing `restTemplate.getRequestFactory()` **before**
`bindTo(...).build()` replaces it. Do it after and you have wired the mock factory to
itself.

## Where this connects

- The binding, the two routes and the class under test:
  [03](03-mocking-an-outbound-http-api.md).
- A real socket, and the two tools: [03b](03b-wiremock-and-mockwebserver.md).
- The failures that need the bottom half of that table:
  [03c · The error paths nobody writes](03c-the-error-paths-nobody-writes.md).
- Matching the outgoing request in detail:
  [03d · Asserting what you sent](03d-asserting-what-you-sent.md).
- `verify(Duration)` and the asynchronous caller:
  [07 · Async, scheduled and eventual](07-async-scheduled-and-eventual.md).

## Gotchas

**★ `MockRestServiceServer` never resolves DNS, so a wrong host name only fails if you assert the absolute URL.**
`requestTo("/v1/charges")` matches the request URI as a string and will pass happily while the client is pointed at `https://pay.example.con`. Nothing connects, so nothing complains. Assert the absolute URI — `requestTo("https://pay.example.com/v1/charges")` — in at least one test per client, or configure the base URL from the same property object production uses and let a configuration test cover the value.

**★ Forgetting `server.verify()` turns the test into a response-mapping test that cannot fail on a missing request.**
Expectations are not assertions until they are verified. Without `verify()`, a client that made no HTTP call at all — because a guard clause returned early, a feature flag was off, or a cache short-circuited it — still passes, since the stubbed response was simply never needed. `verify()` is the line that upgrades "if a request happens it must look like this" to "a request must happen, and it must look like this".

**★ Reusing one `MockRestServiceServer` across test methods without `reset()` leaks expectations into the next test.**
Creating the builder and the server in `@BeforeEach` sidesteps this completely. If the server is a `static` field or an `@Autowired` slice bean shared across methods, the javadoc's own remedy applies — `getServer().reset()` — and the failure without it is order-dependent, which means it appears in CI and not on your machine.

**★ The message converters are real, so this test *does* fail on a serialization bug — and people write it as if only the transport were stubbed.**
Because only the `ClientHttpRequestFactory` is replaced, Jackson runs for real in both directions. Renaming a `@JsonProperty`, switching a naming strategy, or adding a field with no default breaks this test. That is the single best reason to have it. It also means the test is sensitive to Jackson configuration, which is precisely why `@RestClientTest` exists — a hand-built `RestClient.builder()` uses default converters, not yours.

**★ `withSuccess()` with a body but no `MediaType` sets no `Content-Type`, and the response then fails to convert.**
`withSuccess()` with no arguments is a bare 200 with no body and no content type. Give it a JSON body without `MediaType.APPLICATION_JSON` and the client has nothing to select a converter with; the failure reads like a Jackson misconfiguration rather than a missing argument in the arrangement. Always pass the media type when you pass a body.

**★ Expectations are ordered by default, so a client that makes two independent calls has an order-dependent test for no reason.**
The default is strict sequencing. If your code fetches a customer and a price and does not care which goes first — or worse, iterates a `Set` — the test is one HashMap iteration order away from red. `ignoreExpectOrder(true)` is the documented switch, and it is the honest default whenever the production code does not itself guarantee an order.

**★ Consecutive identical expectations are not the same as `times(2)`, and the difference bites on retries.**
Two separate `expect(requestTo("/x"))` lines each match once, in order, and each can carry a *different* response — which is how you script "fail, then succeed" for a retry test. `expect(times(2), requestTo("/x"))` matches twice with the *same* response. Reaching for the second when you wanted the first produces a retry test where the retry has nothing different to succeed at.

**★ `verify()` fails on *unmet* expectations, not on *unexpected* requests — those fail earlier, at the request.**
An extra request that matches no expectation throws at the moment it is made, from inside the production call, so the stack trace points at your gateway rather than at the test arrangement. People read that as a bug in the client. It usually means an expectation is missing or the order is wrong.

**★ `ExecutingResponseCreator` built from the request factory *after* binding wires the mock to itself.**
`bindTo(...).build()` replaces the `RestTemplate`'s factory. Capture `getRequestFactory()` first, as the reference's snippet does, or the "real" call is dispatched into the mock server, which has no expectation for it, and the failure is a puzzling unexpected-request error on the endpoint you deliberately let through.

**★ Nothing about timeouts is exercised, so a client with no timeout configured passes every test in this style.**
`RestClient` built from a default `JdkClientHttpRequestFactory` has no read timeout unless you set one, and a missing timeout is the single most common cause of a thread pool exhausting during a partner outage. No in-process mock server can catch it, because there is no socket to be slow. That test needs a real one — see [03c](03c-the-error-paths-nobody-writes.md) — and it is the argument for having at least one mock-web-server test per client.

## Interview questions

**★ What is the one assertion in this kind of test that people leave out, and why does it matter?**
`server.verify()`. Expectations set with `expect(...)` do not assert anything on their own; they only match requests as they arrive. Without the verify call, a test whose production path silently made no HTTP request — an early return, a feature flag, a cache hit, a null check — still passes green, because the stubbed response was never needed. `verify()` is what turns "if a request happens it must look like this" into "a request must happen, and it must look like this", and the difference shows up the first time somebody refactors a guard clause.

**★ Exactly what is stubbed when you use `MockRestServiceServer`, and what does that mean you are still allowed to claim?**
One object: the `ClientHttpRequestFactory`. Everything above it in the client runs for real — URI templates and their encoding, the request message converter, the response message converter, and the status handling that decides which exception a 404 becomes. Everything below it does not exist: no socket, no DNS, no TLS, no connection pool, no timeouts, no redirects, no compression. So I am entitled to claim the request I built is the request I meant to build and the response I described maps to the object I expect. I am not entitled to claim the client survives a slow server, a reset connection, an expired certificate or a redirect loop, and if those matter — they always do for a payment API — I need a test with a real socket.

**★ Your test asserts a retry happens after a 500. How do you script the two responses, and what is the trap?**
Two separate expectations for the same request, in order: the first `andRespond(withServerError())`, the second `andRespond(withSuccess(json, APPLICATION_JSON))`. The trap is reaching for `expect(times(2), requestTo("/x"))` instead, because that binds *one* response to *two* matches — the client gets a 500 both times, the retry exhausts, and the test fails in a way that looks like the retry is broken when in fact the arrangement made success impossible. The second trap, one level up, is that if the retry is implemented with a real backoff the test now sleeps; keep the backoff configurable and set it to near zero in tests.

**★ When would you use `ExecutingResponseCreator`, given it makes a real network call from a test?**
Almost never in the suite that runs on every commit, and deliberately in a tagged, manually run test whose job is to refresh or validate a recorded fixture. The pattern that earns its place: stub every endpoint except the one whose payload you have pinned, let that one execute for real, and assert that the live response still satisfies the contract your mapping depends on. That gives you a cheap consumer-side canary against a partner changing their payload, without putting a network dependency in the default build. It is the same instinct as a scheduled contract test — just far less machinery.

{/* FOOTER */}
