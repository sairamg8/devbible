---
title: "A 200 with an HTML body, a JSON document that stops halfway, an empty success and a pair of redirects pointing at each other are all successes as far as the status line is concerned, and each one surfaces as a different Spring exception from a different place in the client"
sidebar_label: "03f2 · When the response is wrong"
sidebar_position: 45
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Spring Framework 7.0.8** source of
> [`DefaultRestClient`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/spring-web/src/main/java/org/springframework/web/client/DefaultRestClient.java)
> — the body-extraction `catch (UncheckedIOException | IOException | HttpMessageNotReadableException exc)`
> and the `RestClientException("Error while extracting response for type […] and content type […]")`
> it throws — and of
> [`UnknownContentTypeException`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/spring-web/src/main/java/org/springframework/web/client/UnknownContentTypeException.java),
> whose javadoc reads *"Raised when no suitable `HttpMessageConverter` could be found to
> extract the response."*; the **Spring Boot 4.1.0** reference *Calling REST Services*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/io/rest-client.html)) for
> `spring.http.clients` and the client detection order, and the source of
> [`HttpRedirects`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-http-client/src/main/java/org/springframework/boot/http/client/HttpRedirects.java);
> **WireMock**'s *Simulating Faults*
> ([wiremock.org](https://wiremock.org/docs/simulating-faults/)); and the **Spring Framework
> 7.0.x** `MockRestResponseCreators` javadoc
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/web/client/response/MockRestResponseCreators.html)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source, build configuration and
> documented behaviour only, never console output or timings.

**[03f](03f-the-failures-with-no-status-code.md) covered the cases where nothing came back.
This is the more insidious set: something came back, the status line said 200, and the body
is not what the contract says. These do not look like failures anywhere in your monitoring —
the partner's dashboard shows a success, your HTTP client metric shows a 2xx — and they
surface deep inside the client, from a different code path and with a different exception
type from anything in the previous chunk. This chunk finishes the catalogue and then does
the one test [03f](03f-the-failures-with-no-status-code.md) said it could not: proving the
timeouts are configured at all.**

## Two different code paths, two different exceptions

`DefaultRestClient` has two distinct failure regions, and knowing which one you are in is
most of the diagnosis:

| Where it fails | Exception | Trigger |
|---|---|---|
| Executing the exchange | `ResourceAccessException` | any `IOException` establishing or performing the request ([03f](03f-the-failures-with-no-status-code.md)) |
| **Reading the body — converter present** | `RestClientException` *"Error while extracting response for type […] and content type […]"* | `HttpMessageNotReadableException`, `IOException`, `UncheckedIOException` while converting |
| **Reading the body — no converter** | `UnknownContentTypeException` | no `HttpMessageConverter` can read that `Content-Type` into that type |

🔴 **Note what that first split means.** A connection dropped *before* the response is a
`ResourceAccessException`; a connection dropped *during the body* is caught by the
body-extraction handler and becomes a plain `RestClientException`. Same underlying
`IOException`, two different Spring types, because the code caught it in two different
places. A `catch (ResourceAccessException e)` that thinks it covers "the connection broke"
misses the truncated-body case entirely.

## 1 · Malformed or truncated JSON

The partner's serializer crashed mid-document, a proxy truncated at a buffer boundary, a
gzip stream ended early, or somebody's template emitted a trailing comma.

```java
@Test
void translatesAnUnreadableBodyIntoAGatewayFailure() {
    server.expect(requestTo("https://pay.example.com/v1/charges"))
          .andRespond(withSuccess("""
                  {"id":"ch_123","status":"succ
                  """, MediaType.APPLICATION_JSON));

    assertThatThrownBy(() -> gateway.charge(aCharge().build()))
            .isInstanceOf(PaymentGatewayUnavailable.class);

    server.verify();
}
```

The raw exception is a `RestClientException` whose message the source builds as
`"Error while extracting response for type [" + type + "] and content type [" + contentType + "]"`
with the converter's `HttpMessageNotReadableException` as the cause.

🔴 **The interesting question is not what Spring throws — it is what your `catch` blocks do.**
Go back to [03c](03c-the-error-paths-nobody-writes.md)'s adapter: it catches
`HttpClientErrorException` and `HttpServerErrorException`. Neither matches. A bare
`RestClientException` escapes the gateway and reaches the caller as a raw Spring type, which
is the leak [03c](03c-the-error-paths-nobody-writes.md) spent a page arguing against — and it
escapes on a **200**, so nothing in your status-code-based error handling ever sees it.
`catch (RestClientException e)` as a final, broadest arm is the fix, and this test is the one
that tells you it is missing.

⚠️ **A truncated body is also an ambiguous outcome.** The partner successfully processed the
charge and failed to tell you about it. Translate it into the same *"we do not know"* type as
a read timeout ([03f](03f-the-failures-with-no-status-code.md)), not into a plain failure.

## 2 · An HTML error page served with a 200

The canonical shape: a captive portal, a corporate egress proxy, a WAF interstitial, a CDN
maintenance page, or a partner's own load balancer returning its default page. All of them
are `text/html`, and several of them are `200 OK`.

```java
@Test
void doesNotAcceptAnHtmlPageAsACharge() {
    server.expect(requestTo("https://pay.example.com/v1/charges"))
          .andRespond(withSuccess("<html><body>Service temporarily unavailable</body></html>",
                  MediaType.TEXT_HTML));

    assertThatThrownBy(() -> gateway.charge(aCharge().build()))
            .isInstanceOf(PaymentGatewayUnavailable.class);
}
```

Spring raises `UnknownContentTypeException` — *"Raised when no suitable
`HttpMessageConverter` could be found to extract the response."* — and its constructor builds
the message beginning `"Could not extract response: no suitable HttpMessageConverter found "`.
The type is genuinely useful for diagnosis because of what it carries:
`getContentType()`, `getStatusCode()`, `getStatusText()`, `getResponseHeaders()`,
`getResponseBody()` and `getResponseBodyAsString()`. Copy at least the content type and the
first part of the body into your own exception, because *"we got HTML from the payments
API"* is a five-minute incident and *"payment failed"* is an hour.

⚠️ It is a subclass of `RestClientException`, not of `RestClientResponseException` — so it
does **not** appear in [03c](03c-the-error-paths-nobody-writes.md)'s status-code branch of the
hierarchy, and a catch block written for `RestClientResponseException` misses it.

## 3 · An empty 200

```java
server.expect(requestTo("https://pay.example.com/v1/charges"))
      .andRespond(withSuccess());          // documented: a 200 with no body, no content type
```

`retrieve().body(ChargeResult.class)` returns **`null`** here rather than throwing. That is
the failure mode nobody writes a test for, because there is no exception to assert on — the
client returns null, the gateway returns null, and the NullPointerException happens two
layers up in a method that has nothing to do with HTTP.

The gateway must decide, explicitly and in one place, what an empty success means: an
exception, an `Optional.empty()`, or a defaulted value. Whichever you choose, the test asserts
it directly:

```java
assertThatThrownBy(() -> gateway.charge(aCharge().build()))
        .isInstanceOf(PaymentGatewayUnavailable.class)
        .hasMessageContaining("empty");
```

The same shape recurs with a `200` whose body is the literal text `null`, and with a
`204 No Content` on an endpoint your code expects to return an object.

## 4 · A redirect loop

Two URLs that redirect to each other, or a single URL that redirects to itself — usually a
misconfigured trailing slash rule, an http-to-https rule that fires after the rewrite, or a
locale redirect that cannot decide.

Boot 4.1 makes the policy explicit and configurable. `HttpRedirects` has three values, with
these javadocs:

- `FOLLOW_WHEN_POSSIBLE` — *"Follow redirects (if the underlying library has support)."*
- `FOLLOW` — *"Follow redirects (fail if the underlying library has no support)."*
- `DONT_FOLLOW` — *"Don't follow redirects (fail if the underlying library has no support)."*

set through `spring.http.clients.redirects`, alongside `connect-timeout` and `read-timeout`:

```yaml
spring:
  http:
    clients:
      connect-timeout: 2s
      read-timeout: 1s
      redirects: dont-follow
```

🔴 **For an API client, `dont-follow` is usually the correct setting and almost nobody sets
it.** A partner API has no legitimate reason to redirect a `POST`; a redirect on an API call
is a proxy, a captive portal or a misconfiguration, and following it can silently re-send
your request body — with your `Authorization` header — to a host you did not choose. Not
following turns a mystery into a 302 you can assert on.

The redirect test needs a real socket, because `MockRestServiceServer` replaces the request
factory and redirect following lives in it ([03a](03a-what-the-mock-server-does-not-run.md)):

```java
stubFor(post("/v1/charges").willReturn(aResponse().withStatus(302).withHeader("Location", "/v1/charges")));
```

With `redirects: dont-follow`, the assertion is that the client surfaces the 302 rather than
looping. ⚠️ **What a client does when it *does* follow a loop is client-specific** — the JDK
`HttpClient`, Apache and Jetty each cap redirects differently and report exhaustion
differently, and I could not find a single documented Spring-level exception type that covers
all of them. Assert that the call terminates and produces your own failure type, bound the
test with `@Timeout`, and do not assert on a specific cause class.

## 5 · The test [03f](03f-the-failures-with-no-status-code.md) could not write: is a timeout configured at all?

No mock server of any kind can answer this, because the failure is an *absence*. But it is
a property of bound configuration, and bound configuration is testable:

```java
@SpringBootTest
class HttpClientSettingsTest {

    @Autowired Environment environment;

    @Test
    void everyOutboundClientHasBothTimeouts() {
        assertThat(environment.getProperty("spring.http.clients.connect-timeout", Duration.class))
                .isNotNull()
                .isLessThanOrEqualTo(Duration.ofSeconds(5));
        assertThat(environment.getProperty("spring.http.clients.read-timeout", Duration.class))
                .isNotNull()
                .isLessThanOrEqualTo(Duration.ofSeconds(10));
    }
}
```

It is a blunt test and it catches the commonest production-outage cause in this whole band:
nobody set a read timeout, a partner went slow, and every request thread parked on a socket
until the service stopped answering health checks. **Topic 05 · The test pyramid** owns what
`@SpringBootTest` costs; if a context is too expensive for this, the same assertion works
against a `@ConfigurationProperties`-bound object in a plain unit test.

⚠️ Note the scope: `spring.http.clients` is the global setting. A client built from a
hand-configured `ClientHttpRequestFactory`, or one whose builder overrides the settings, is
not covered by it — and that is worth a comment in the test, because a green global
assertion next to a client that opted out is exactly the false confidence this page is about.

## Where this connects

- The failures where nothing came back at all, and the connect-versus-read distinction:
  [03f · The failures with no status code](03f-the-failures-with-no-status-code.md).
- The failures that carry a status code, the exception hierarchy and the adapter whose catch
  blocks this chunk extends: [03c · The error paths nobody writes](03c-the-error-paths-nobody-writes.md).
- Why the in-process mock server cannot see redirects, compression or the connection pool:
  [03a · What it does not run](03a-what-the-mock-server-does-not-run.md).
- The socket tools this chunk's redirect and fault tests need:
  [03b · WireMock and MockWebServer](03b-wiremock-and-mockwebserver.md) and
  [03e](03e-mockwebserver-and-the-cost-of-a-socket.md).
- Asserting the request that produced the response:
  [03d](03d-asserting-what-you-sent.md) and [03d2](03d2-asserting-the-body.md).
- Why an ambiguous outcome must not be retried without the same key:
  [09b · Idempotency and the double charge](09b-idempotency-and-the-double-charge.md).

## Gotchas

**★ An `IOException` while reading the body becomes a `RestClientException`, not a `ResourceAccessException`, so the catch block for "the connection broke" misses it.**
The two live in different regions of `DefaultRestClient`: the exchange is wrapped by `catch (IOException ex)` producing `ResourceAccessException`, and body extraction is wrapped by `catch (UncheckedIOException | IOException | HttpMessageNotReadableException exc)` producing a `RestClientException` whose message starts *"Error while extracting response for type"*. A connection dropped mid-body therefore does not look like a connection failure to your code.

**★ A malformed body arrives with a 200, so nothing in status-code-based error handling ever sees it.**
The adapter from [03c](03c-the-error-paths-nobody-writes.md) catches `HttpClientErrorException` and `HttpServerErrorException`; neither matches a `RestClientException` from body extraction. The Spring type escapes the gateway on a successful status, which is the exact leak the translation layer exists to prevent. A final `catch (RestClientException e)` arm is the fix, and it must be last, because everything else in the hierarchy is a subclass.

**★ `UnknownContentTypeException` is a `RestClientException` but not a `RestClientResponseException`, so it dodges catch blocks written for "responses with data".**
It carries a status code, headers and a body, which makes it feel like it belongs in the response-exception family, and it does not. A catch on `RestClientResponseException` — the recommended backstop for unknown status codes in [03c](03c-the-error-paths-nobody-writes.md) — will not catch the HTML-page case. Both arms are needed.

**★ An empty 200 returns `null` from `body(...)` rather than throwing, and the NPE lands two layers away.**
There is no exception to assert on, which is why the case is never tested. The gateway has to make an explicit decision — throw, return `Optional.empty()`, or default — and the test has to state it. `withSuccess()` with no arguments is documented as a bare 200 with no body and no content type, which makes the arrangement one line.

**★ Following redirects on an API client can re-send your body and your `Authorization` header to a host you did not choose.**
A `POST` to a partner API has no business being redirected; when it is, the cause is a proxy, a captive portal or a rewrite rule. Boot 4.1's `spring.http.clients.redirects: dont-follow` turns that into a 302 you can see and assert on. The default is to follow when the library supports it, and almost nobody changes it.

**★ What a client does with a redirect *loop* depends on the client, so do not assert on a cause type.**
Boot's detection order puts Apache ahead of Jetty ahead of Reactor Netty ahead of the JDK client, and each has its own redirect cap and its own exhaustion behaviour. I could not find a single Spring-level exception documented as covering all of them. Assert that the call terminates and produces your failure type, bound the test with `@Timeout`, and treat the cause as an implementation detail.

**★ A redirect test cannot be written with `MockRestServiceServer` at all, and the attempt produces a test that passes for the wrong reason.**
Redirect following is a function of the `ClientHttpRequestFactory`, which is precisely the object the mock server replaces. Stubbing a 302 there gives you a 302 response object handed to your code, which is not what happens in production when following is enabled. This one needs a socket.

**★ A truncated body is an *ambiguous outcome*, not a failure, and translating it as a failure loses the distinction.**
The partner processed the request and then failed to finish telling you about it. Mapping it to `PaymentGatewayUnavailable` invites a blind retry; mapping it to the same "outcome unknown" type as a read timeout routes it to reconciliation or to a retry with the same idempotency key. The difference shows up as duplicate charges on exactly the days a partner is having trouble.

**★ A global timeout assertion is green while an individual client has opted out of it.**
`spring.http.clients` is the global setting; a client assembled from a hand-built `ClientHttpRequestFactory`, or one whose builder overrides `HttpClientSettings`, does not inherit it. The configuration test then reports that timeouts are configured while the one client that talks to the flaky partner has none. Either forbid hand-built factories by convention, or assert per-client.

**★ `withSuccess(body)` with no `MediaType` produces a response with no `Content-Type`, and the failure looks like a Jackson problem.**
This is the arrangement bug that most often masquerades as one of the failures on this page. It is documented in [03a](03a-what-the-mock-server-does-not-run.md); it is worth repeating here only because a test *about* malformed content is exactly where you will hit it and misdiagnose it as the thing you were testing for.

## Interview questions

**★ A partner returns a 200 with an HTML maintenance page. What happens in your client, and what should happen?**
Spring raises `UnknownContentTypeException`, documented as *"Raised when no suitable `HttpMessageConverter` could be found to extract the response"*, because no converter reads `text/html` into my result type. What usually happens next is that nothing catches it — it is a `RestClientException` but not a `RestClientResponseException`, so a catch block written for status-carrying responses misses it, and the raw Spring exception escapes the gateway on a successful status code. What should happen is that the gateway catches it, translates it into its own unavailable type, and copies the content type and the first part of the body into the message, because the exception carries `getContentType()` and `getResponseBodyAsString()` and those two facts turn a mystifying incident into an obvious one — you were talking to a proxy, not to the partner.

**★ Where in the client does a body-read failure surface, and why does that matter?**
In a different place from a connection failure, which is the part that catches people. `DefaultRestClient` wraps the exchange in a `catch (IOException ex)` that produces `ResourceAccessException`, and it wraps body extraction in a separate catch of `UncheckedIOException`, `IOException` and `HttpMessageNotReadableException` that produces a plain `RestClientException` with a message about extracting the response. So a connection that dies before the response and a connection that dies halfway through the body give you two different exception types from the same underlying cause. Anyone whose error handling branches on `ResourceAccessException` to mean "the network broke" has a hole exactly where the ambiguity is worst — a truncated body means the partner did the work and failed to tell you.

**★ Would you configure an API client to follow redirects?**
No, for a partner API — I would set `spring.http.clients.redirects` to `dont-follow`, and Boot 4.1 makes that a first-class setting with `HttpRedirects.DONT_FOLLOW` documented as *"Don't follow redirects (fail if the underlying library has no support)."* The reasoning is that a legitimate API does not redirect a `POST`; when one arrives, the source is a proxy, a captive portal, an egress gateway or a rewrite rule somebody added. Following it means my request body and my `Authorization` header get re-sent to a host I did not choose, which is a credential-exposure question rather than a robustness one, and it turns a visible 302 into an invisible detour. The exception is a client where redirects are genuinely part of the contract — a storage service that redirects to a signed URL — and then I want it explicit rather than defaulted.

**★ How do you catch "nobody configured a read timeout" in a test suite?**
Not with a mock server, because the bug is an absence and no stub can represent it. Two tests, and I would have both. The first is a configuration assertion: bind the properties and assert `spring.http.clients.read-timeout` and `connect-timeout` are present and within a ceiling, which is blunt but catches the actual, extremely common failure — that nobody set them. The second is a socket test with a stalled or heavily delayed response and a bound on the test itself, proving the client gives up rather than parking. The caveat I would state out loud is that the global properties do not cover a client built from a hand-configured factory, so a green configuration test is only as good as the convention that all clients go through the auto-configured builder. If a team has one client that opts out, that is the one that will take the service down.

{/* FOOTER */}
