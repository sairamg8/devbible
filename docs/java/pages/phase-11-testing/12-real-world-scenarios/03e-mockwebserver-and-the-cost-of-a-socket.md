---
title: "MockWebServer is a queue with a socket attached, which makes it three lines to set up and structurally unable to fail on a wrong URL — and every socket-based test you add buys transport realism with startup time, port contention and a longer distance between the failure and its cause"
sidebar_label: "03e · MockWebServer and the cost"
sidebar_position: 18
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against **OkHttp**'s `mockwebserver/README.md` and `CHANGELOG.md` on
> `github.com/square/okhttp` — coordinates `com.squareup.okhttp3:mockwebserver3`, package
> `mockwebserver3`, JUnit 5 module `mockwebserver3-junit5`, the `@StartStop` annotation, the
> `MockResponse.Builder` and `SocketEffect` renames, and the `RecordedRequest` property
> changes; plus **WireMock**'s JUnit 5 documentation
> ([wiremock.org/docs/junit-jupiter](https://wiremock.org/docs/junit-jupiter/)) for the
> comparison, and `spring-boot-dependencies:4.1.0` (neither library appears in it).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox and no test runs on this machine** — Java source, build configuration and
> documented behaviour only, never console output.

**[03b](03b-wiremock-and-mockwebserver.md) made the choice and did WireMock. This chunk does
the other one, and it needs its own page for a reason that is not length: `MockWebServer`
changed its Maven coordinate, its package, its response API, its JUnit 5 integration and
half its `RecordedRequest` property names in OkHttp 5, so essentially every sample you will
find online fails to compile. Then the part that applies to both libraries and that nobody
budgets for — what a suite pays, per test, for having a socket in it.**

## MockWebServer · the JUnit 5 setup

🔴 **The coordinate and the package both changed** in OkHttp 5. The changelog is explicit:

> *"MockWebServer has a new coordinate and package name."*

| Artifact | Package | Note (from the changelog's own table) |
|---|---|---|
| `com.squareup.okhttp3:mockwebserver3` | `mockwebserver3` | *"Core module. No JUnit dependency!"* |
| `com.squareup.okhttp3:mockwebserver3-junit5` | `mockwebserver3.junit5` | *"Optional JUnit 5 integration."* |
| `com.squareup.okhttp3:mockwebserver` | `okhttp3.mockwebserver` | *"Obsolete. Depends on JUnit 4."* |

```xml
<dependency>
  <groupId>com.squareup.okhttp3</groupId>
  <artifactId>mockwebserver3-junit5</artifactId>
  <version>5.5.0</version>
  <scope>test</scope>
</dependency>
```

The JUnit 5 integration is now a single annotation. From the changelog:

> *"Replace our parameters-based JUnit 5 extension with a new annotation, `@StartStop`. Put
> this annotation on a `MockWebServer` property and the extension will start it before your
> test executes and stop it after it completes. No further configuration is required."*

```java
class HttpPaymentGatewaySocketTest {

    @StartStop final MockWebServer server = new MockWebServer();

    @Test
    void mapsASuccessfulCharge() throws Exception {
        server.enqueue(new MockResponse.Builder()
                .code(200)
                .addHeader("Content-Type", "application/json")
                .body("{\"id\":\"ch_123\",\"status\":\"succeeded\"}")
                .build());

        HttpPaymentGateway gateway = new HttpPaymentGateway(
                RestClient.builder(),
                new PaymentProperties(server.url("/").toString()));

        assertThat(gateway.charge(aCharge().build()).id()).isEqualTo("ch_123");

        RecordedRequest request = server.takeRequest();
        assertThat(request.getMethod()).isEqualTo("POST");
        assertThat(request.getTarget()).isEqualTo("/v1/charges");
        assertThat(request.getHeaders().get("Idempotency-Key")).isNotNull();
    }
}
```

Three API facts that will trip you if you learned this library before OkHttp 5, all from
the changelog:

- **`MockResponse` is immutable, with a `Builder`.** The old
  `new MockResponse().setBody(...)` setters are gone in `mockwebserver3`.
- **`RecordedRequest.requestLine` was decomposed** into `method`, `target` and `version`,
  and `path` was renamed `target` — *"(This property is sometimes a path, but it can also
  be a path and query, or a full URL.)"*
- **`RecordedRequest.body` is nullable** — *"Null is used when the request does not have a
  body."*

And one lifecycle fact:

> *"Don't automatically start `MockWebServer` after calls to accessors like `port`. Now
> these accessors will throw an `IllegalStateException` if the service has not yet been
> started."*

With `@StartStop` that is handled for you. Without it — a hand-rolled `@BeforeEach` — call
`start()` before `url(...)`.

### When the queue is not enough

`Dispatcher` turns MockWebServer into a (very small) matching server:

```java
server.setDispatcher(new Dispatcher() {
    @Override public MockResponse dispatch(RecordedRequest request) {
        return switch (request.getTarget()) {
            case "/v1/charges" -> new MockResponse.Builder().code(201).body("{}").build();
            case "/v1/health"  -> new MockResponse.Builder().code(200).build();
            default            -> new MockResponse.Builder().code(404).build();
        };
    }
});
```

If you find yourself growing that `switch`, you have started writing WireMock. That is the
signal to switch libraries rather than to keep going.

## What the socket costs

- **Startup.** Both start a server per test class or per test method. WireMock brings a
  Jetty; `MockWebServer` is much smaller. Neither is free, and a suite of two hundred
  socket tests is measurably slower than two hundred `MockRestServiceServer` tests. Prefer
  a `static` extension (class-scoped) over an instance one where the tests do not conflict.
- **Ports.** Always dynamic. A hard-coded port is a test that fails on a developer machine
  running the real service, and a test that cannot run in parallel with itself.
- **Parallelism.** JUnit's parallel execution plus a class-scoped server plus stateful stubs
  is a genuine hazard: two methods configuring the same server concurrently is a race.
  Either keep the server per-method or keep the class serial.
- **Assertion distance.** The failure message from a socket test is further from the cause.
  WireMock's unmatched-request diff is good; `MockWebServer`'s "expected a request but the
  queue was empty" is not.

None of that argues against having them. It argues for having **few of them, aimed at the
things only they can prove**: the timeout, the reset, the redirect, the malformed body, the
TLS. Which is exactly [03c · The error paths nobody writes](03c-the-error-paths-nobody-writes.md).


## Where this connects

- The choice between the two libraries, and the WireMock setup:
  [03b · WireMock and MockWebServer](03b-wiremock-and-mockwebserver.md).
- What the in-process mock server cannot see, which is why you are here:
  [03a · What it does not run](03a-what-the-mock-server-does-not-run.md).
- The failures a socket makes reachable — timeout, reset, malformed body, redirect loop:
  [03c · The error paths nobody writes](03c-the-error-paths-nobody-writes.md).
- Asserting the request you sent, in both styles:
  [03d · Asserting what you sent](03d-asserting-what-you-sent.md).
- **Topic 01 · JUnit 5** owns `@RegisterExtension`, extension lifecycle and the parallel
  execution switches this page leans on.

## Gotchas

**★ `MockWebServer` serves the next queued response no matter what was requested, so a wrong URL passes.**
This is the single most important difference from WireMock and from `MockRestServiceServer`. The queue has no matcher. Point your client at `/v1/chrages` and the test still gets its 200 and still goes green — the mistake only surfaces if you assert on `takeRequest()`. With `MockWebServer`, `takeRequest()` is not optional extra rigour; it is the only thing standing between you and a test that cannot fail.

**★ `new MockResponse().setBody(...)` does not compile against `mockwebserver3`, and the error looks like a missing dependency.**
`MockResponse` became immutable with a `Builder` in OkHttp 5. If you copied a sample from before that, you get "cannot find symbol: setBody" and the natural reaction is to suspect the version. It is the right version; the API changed. Same story for `SocketPolicy`, which was replaced by `SocketEffect`, splitting *"triggers (request start, response body, etc.) from effects (closing the socket, closing the stream, etc.)"*.

**★ A `MockWebServer` accessor before `start()` throws `IllegalStateException`, which used to silently auto-start.**
Older versions started the server on first call to `port` or `url`. OkHttp 5 removed that convenience deliberately. If you are not using `@StartStop`, a `@BeforeEach` that calls `server.url("/")` before `server.start()` now fails with a state exception that names nothing helpful. Use `@StartStop` from `mockwebserver3-junit5` and the problem cannot occur.

**★ `takeRequest()` blocks, and a test where the client never sent anything hangs until the default timeout rather than failing.**
The no-argument form waits for a request to arrive. If a guard clause meant no request was ever made, the test does not fail fast with a clear message; it sits. Use the overload that takes a timeout so the failure arrives promptly and says "no request within N seconds", which is a far better diagnostic than a stalled build.

**★ A hard-coded port turns a green suite red the moment a colleague runs the real service locally.**
Both libraries default to a dynamic port and both make it easy to pin one. Pinning is occasionally necessary — a client whose URL is baked into a config file you cannot override — and it is always a liability: the test fails on any machine where something else holds the port, and it can never run in parallel with a second copy of itself. Fix the config instead, with `@DynamicPropertySource` or WireMock's `baseUrlProperties`.

**★ Neither library is in Boot's BOM, so `<version>` is mandatory and drift is on you.**
Spring Boot 4.1.0 manages Awaitility, JSONassert, XMLUnit and Testcontainers, but it manages neither WireMock nor OkHttp. A multi-module build with two different WireMock versions on two test classpaths is a real and confusing failure. Pin both in your own `dependencyManagement` block.

**★ `takeRequest()` consumes from a queue, so the second assertion in a test reads the *second* request, and skipping one silently shifts everything after it.**
The README's own example takes three requests in sequence and asserts a different path on each. There is no "get the request for /v1/charges" lookup — the ordering is the API. A test that asserts on one request while the client actually made two (a token refresh, then the call) is asserting about the token refresh and will fail with a message about the wrong path. When a client makes more than one call, either assert on all of them in order or switch to WireMock, whose `verify(postRequestedFor(...))` is a query rather than a queue read.

**★ A `MockWebServer` instance cannot be restarted, and reusing one across classes gives you a closed server.**
The README ends its example with *"Shut down the server. Instances cannot be reused."* Sharing one in a static holder to save startup time works right up to the first `close()`, after which every later test fails on a closed socket in a way that looks like a network problem. Create one per test class at minimum; `@StartStop` on an instance field creates one per test method, which is the cheap and correct default given how small the server is.

**★ Response delays and throttling are properties of the queued response, not of the server, so "the partner is slow" has to be attached to every response the test needs slow.**
`throttleBody(1024, 1, TimeUnit.SECONDS)` is a `MockResponse.Builder` call. Enqueue three responses and throttle one, and the other two return at full speed. That is usually what you want, but it catches people trying to model a degraded partner: there is no server-wide "be slow" switch, and a retry test that expects every attempt to time out needs the delay set on every enqueued response.

## Interview questions

**★ You already have `MockRestServiceServer` tests for a client. Why add a mock web server test at all, and how many?**
Because the two cover disjoint halves of the stack, and the half `MockRestServiceServer` cannot see is where outages live. It replaces the `ClientHttpRequestFactory`, so no test in that style can exercise a read timeout, a connection reset, a redirect, gzip, TLS, or the connection pool — and "the partner got slow" is a far more common production incident than "we sent the wrong field name". As for how many: few and deliberate. I would keep the bulk of the client's tests in-process, where they are fast and the failure messages are close to the cause, and add a small number of socket tests aimed at exactly the transport behaviours — a timeout, a reset, a 429 with `Retry-After`, a malformed body — plus one happy path to prove the wiring end to end.

**★ Your `MockWebServer` test passed while the production URL was wrong. How did that happen and how do you prevent it?**
The queue has no matcher. `server.enqueue(...)` says "the next request, whatever it is, gets this response" — so a POST to a misspelled path gets the same 200 as the correct one, and the client maps it fine. It happened because the test asserted only on the returned object. The prevention is to make `takeRequest()` mandatory in every `MockWebServer` test and assert at least the method and the target on it; with OkHttp 5 that is `request.getMethod()` and `request.getTarget()`. If the team will not reliably do that, the structural fix is to switch to WireMock, whose default is to fail the test on an unmatched request.

**★ What changed in OkHttp 5, and why does that matter more than it sounds?**
Five things at once, and together they mean essentially every `MockWebServer` sample written before 2024 fails to compile: the Maven coordinate moved to `com.squareup.okhttp3:mockwebserver3`, the package moved to `mockwebserver3`, `MockResponse` became immutable with a `Builder` so the `setBody`/`setResponseCode` setters are gone, `SocketPolicy` was replaced by `SocketEffect` — the changelog describes it as splitting *"triggers (request start, response body, etc.) from effects (closing the socket, closing the stream, etc.)"* — and the JUnit 5 integration became the `@StartStop` annotation in a separate `mockwebserver3-junit5` artifact. It matters because the old artifact is still published, so a stale dependency resolves happily and you end up debugging why an annotation does not exist rather than realising you are on the obsolete coordinate. The changelog's own table is the authority: the old `com.squareup.okhttp3:mockwebserver` is marked *"Obsolete. Depends on JUnit 4."*

**★ Your team's suite has grown to two hundred socket-based tests and CI is slow. What do you actually do?**
Not delete them wholesale — work out what each one is proving, because most of them are proving something an in-process test proves faster. The pattern I would expect to find is that the socket test was chosen once, early, as "the way we test clients", and then copied. So: keep the socket tests that exercise transport behaviour a request-factory swap cannot reach — timeouts, resets, redirects, compression, TLS, malformed bodies — and move the rest, which are asserting URLs, headers, bodies and response mapping, to `MockRestServiceServer`, where they need no port and no server start. Second, move class-scoped servers where the tests do not conflict, since one start per class beats one per method. Third, check whether the socket tests are running inside a `@SpringBootTest` that did not need to be one — a context start usually dwarfs the server start. The measurement matters more than the guess here; I would profile before moving anything.

{/* FOOTER */}
