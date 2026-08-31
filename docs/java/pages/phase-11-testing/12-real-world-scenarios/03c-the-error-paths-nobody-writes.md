---
title: "Every HTTP client test suite has a happy path and a 404, and every HTTP client outage is caused by one of the failures nobody wrote a test for — this chunk does the ones that arrive with a status code, and the assertion worth making is never on Spring's exception type but on your translation of it"
sidebar_label: "03c · The error paths nobody writes"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.x** `MockRestResponseCreators`
> javadoc
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/web/client/response/MockRestResponseCreators.html)),
> the `RestClientResponseException`, `HttpClientErrorException` and `HttpServerErrorException`
> javadocs, the Framework reference *REST Clients* for `onStatus`/`defaultStatusHandler`
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/rest-clients.html)),
> the Framework reference *Resilience* for `@Retryable`/`RetryTemplate`
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/core/resilience.html)),
> **RFC 9110** §10.2.3 *Retry-After* and §15.6 and **RFC 6585** §4 *429 Too Many Requests*
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6585.txt)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**Look at the tests for any HTTP client in any codebase and you will find a 200 and,
if the team is careful, a 404. Now look at the last three incidents involving that
integration. They were a 500 storm, a rate limit the retry ignored, and a partner that
went slow rather than down. There is a straight line between those two observations. This
chunk writes the tests for the failures that *arrive with a status code*: the 5xx family,
the 4xx family whose mapping decides whether your caller retries or gives up, and the status
code Spring has no constant for. [03g](03g-the-429-and-retry-after.md) does the 429 on its
own, because rate limiting has semantics the others do not, and
[03f](03f-the-failures-with-no-status-code.md) does the failures with no status code at all,
which are worse.**

## What the client throws, before you write a single test

You cannot assert on an error path without knowing what it produces. Spring's hierarchy,
straight from the javadocs:

```
RestClientException
├── RestClientResponseException            "Common base class for exceptions that contain actual HTTP response data."
│   ├── HttpStatusCodeException
│   │   ├── HttpClientErrorException       — 4xx, with named subclasses: NotFound, Conflict,
│   │   │                                    TooManyRequests, Unauthorized, Forbidden, Gone, …
│   │   └── HttpServerErrorException       "Exception thrown when an HTTP 5xx is received."
│   │                                        — InternalServerError, BadGateway, ServiceUnavailable, GatewayTimeout
│   └── UnknownHttpStatusCodeException
├── UnknownContentTypeException            "Raised when no suitable HttpMessageConverter could be found to extract the response."
└── ResourceAccessException                "Exception thrown when an I/O error occurs."
```

And the default behaviour from the reference: `RestClient` throws a subclass of
`RestClientException` on a 4xx or 5xx from `retrieve()`, and that is overridable with
`onStatus`. `exchange()` applies **no** status handlers, because it hands you the response.

🔴 **The point of the hierarchy is that it is not your domain.** Letting
`HttpServerErrorException` escape your gateway means every caller now depends on Spring's
web client package and has to decide, at the call site, what a 502 means for an order. The
gateway's job is to translate. Which means the error tests below are not about Spring's
exceptions — they are about **your** translation of them, and the assertion is on your type.

## The adapter that makes the tests possible

```java
@Override
public ChargeResult charge(ChargeCommand command) {
    try {
        return http.post()
                .uri("/v1/charges")
                .header("Idempotency-Key", command.idempotencyKey())
                .body(new ChargeRequest(command.amountMinorUnits(), command.currency()))
                .retrieve()
                .body(ChargeResult.class);
    }
    catch (HttpClientErrorException.TooManyRequests e) {
        throw new PaymentRateLimited(retryAfter(e.getResponseHeaders()));
    }
    catch (HttpClientErrorException e) {
        throw new PaymentRejected(e.getStatusCode().value(), e.getResponseBodyAsString());
    }
    catch (HttpServerErrorException e) {
        throw new PaymentGatewayUnavailable("upstream " + e.getStatusCode(), e);
    }
}
```

Three outcomes, three of your own exception types, and the caller can now say *"reject the
order"*, *"back off and retry"* or *"leave the order pending"* without importing anything
from `org.springframework.web.client`.

## 1 · The 500

```java
@Test
void translatesAServerErrorIntoGatewayUnavailable() {
    server.expect(requestTo("https://pay.example.com/v1/charges"))
          .andRespond(withServerError());

    assertThatThrownBy(() -> gateway.charge(aCharge().build()))
            .isInstanceOf(PaymentGatewayUnavailable.class)
            .hasMessageContaining("500");

    server.verify();
}
```

`withServerError()` is documented as *"`ResponseCreator` for a 500 response
(SERVER_ERROR)."* Its siblings cover the rest of the 5xx family without you constructing a
status: `withBadGateway()` (502), `withServiceUnavailable()` (503), `withGatewayTimeout()`
(504).

**The assertion that matters is the exception type, not the message.** A test that asserts
`isInstanceOf(HttpServerErrorException.class)` is asserting Spring behaved as documented,
which it will. Asserting `PaymentGatewayUnavailable` is asserting *your translation* — the
line that decides whether an order is retried or cancelled.

### The 5xx with a body

Partners put machine-readable detail in 5xx bodies more often than people expect, and
losing it is why on-call has nothing to go on:

```java
server.expect(requestTo("https://pay.example.com/v1/charges"))
      .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE)
              .body("""
                    {"error":"processor_down","processor":"acme","retryable":true}
                    """)
              .contentType(MediaType.APPLICATION_JSON));

assertThat(catchThrowableOfType(PaymentGatewayUnavailable.class,
        () -> gateway.charge(aCharge().build())).retryable()).isTrue();
```

`withStatus(HttpStatusCode)` returns a `DefaultResponseCreator`, so `.body(...)`,
`.contentType(...)` and `.headers(...)` chain off it. That is the general form; the named
creators are conveniences over it.

## 2 · The 4xx family, and the distinction the caller depends on

The important thing about 4xx is not that it throws — it is that **different 4xxs mean
opposite things for a retry**, and a gateway that collapses them into one exception has
destroyed the information the caller needs.

| Status | What it means for the caller | The mistake |
|---|---|---|
| 400 | your request is wrong — **never retry** | retried forever by a generic retry policy |
| 401 / 403 | credentials or scope — **do not retry**, alert | retried, which locks the account |
| 404 | the resource does not exist — depends; often a legitimate empty result | mapped to an exception when it should be `Optional.empty()` |
| 409 | a conflict — often means *"you already did this"* | treated as failure when it is proof of success |
| 422 | semantically invalid — **never retry** | lumped in with 400, losing the field-level detail |
| 429 | back off — **retry, later** | retried immediately |

The 409 row is the one that costs money, and it is covered in
[09b · Idempotency and the double charge](09b-idempotency-and-the-double-charge.md).

A table-driven test is the natural shape here, and **topic 03 · Parameterized tests** owns
the mechanics:

```java
@ParameterizedTest
@CsvSource({
    "400, PaymentRejected,      false",
    "401, PaymentAuthFailure,   false",
    "409, PaymentAlreadyExists, false",
    "422, PaymentRejected,      false",
    "429, PaymentRateLimited,   true",
    "500, PaymentGatewayUnavailable, true",
    "503, PaymentGatewayUnavailable, true"
})
void mapsEachStatusToItsOwnOutcome(int status, String expectedType, boolean retryable) {
    server.expect(requestTo("https://pay.example.com/v1/charges"))
          .andRespond(withStatus(HttpStatusCode.valueOf(status)));

    Throwable thrown = catchThrowable(() -> gateway.charge(aCharge().build()));

    assertThat(thrown.getClass().getSimpleName()).isEqualTo(expectedType);
    assertThat(((PaymentException) thrown).retryable()).isEqualTo(retryable);
}
```

That table is also documentation. When a partner adds a new status code, the table is where
the decision gets recorded, and the row is the review artefact.

## 3 · The status code nobody has heard of

`withRawStatus(int)` — *"Variant of `withStatus(HttpStatusCode)` with an integer"* — exists
for the codes Spring has no constant for, and partners emit them. A 599, a 430, a
vendor-specific 520 from a CDN in front of the real API. Spring raises
`UnknownHttpStatusCodeException` for a code it cannot classify, which is a different branch
of the hierarchy from `HttpStatusCodeException` and therefore **not caught by your
`catch (HttpServerErrorException e)`**.

```java
@Test
void treatsAnUnknownStatusAsUnavailableRatherThanCrashing() {
    server.expect(requestTo("https://pay.example.com/v1/charges"))
          .andRespond(withRawStatus(520));

    assertThatThrownBy(() -> gateway.charge(aCharge().build()))
            .isInstanceOf(PaymentGatewayUnavailable.class);
}
```

If that test fails with a raw `UnknownHttpStatusCodeException` escaping the gateway, you
have found a real bug, and it is one that only ever appears in production behind a CDN.

## Where this connects

- The 429, `Retry-After` in both its legal forms, and the retry policy that has to consume
  it: [03g · The 429 and Retry-After](03g-the-429-and-retry-after.md).
- Timeout, connection reset, malformed body, an HTML page with a 200, and a redirect loop —
  the failures with no status code at all:
  [03f · The failures with no status code](03f-the-failures-with-no-status-code.md).
- The tools: [03](03-mocking-an-outbound-http-api.md) in-process,
  [03b](03b-wiremock-and-mockwebserver.md) and
  [03e](03e-mockwebserver-and-the-cost-of-a-socket.md) on a socket.
- Asserting the request rather than the response:
  [03d](03d-asserting-what-you-sent.md).
- Why translating vendor errors into your own types is the adapter's main job:
  [04b · The adapter and the three test populations](04b-the-adapter-and-the-three-test-populations.md).
- The retry that consumes `Retry-After`, and testing it without waiting:
  [07 · Async, scheduled and eventual](07-async-scheduled-and-eventual.md).
- **Topic 03 · Parameterized tests** owns `@CsvSource` and every other source.

## Gotchas

**★ Asserting `isInstanceOf(HttpServerErrorException.class)` tests Spring, not you.**
Spring will throw that on a 500; it is documented and it is not going to regress. The behaviour worth pinning is the translation into a type your callers can act on — `PaymentGatewayUnavailable` versus `PaymentRejected` — because that is the decision an outage turns on and it is the line most likely to be wrong. If your gateway lets Spring's exception escape, the missing test is a symptom of a missing design, not the other way around.

**★ `UnknownHttpStatusCodeException` is not a subclass of `HttpStatusCodeException`, so a `catch (HttpServerErrorException e)` misses a 520.**
The hierarchy puts `HttpStatusCodeException` and `UnknownHttpStatusCodeException` as siblings under `RestClientResponseException`. Anything in front of your partner — a CDN, a reverse proxy, a corporate egress gateway — can emit a status Spring has no constant for, and it flies straight through catch blocks written for the named families. Catch `RestClientResponseException` as the backstop, and use `withRawStatus(int)` to prove it.

**★ Collapsing every 4xx into one exception type destroys the retry decision at the only place it can be made.**
The gateway is the only code that knows a 409 from this partner means "already charged" and a 422 means "never going to work". A caller looking at `PaymentFailed` has no way to recover that. The symptom in production is either a retry storm against requests that can never succeed, or an order abandoned because a 409 that actually proved success was treated as a failure.

**★ A 4xx body is thrown away by `getMessage()` and people then debug blind.**
`RestClientResponseException` carries the response body — `getResponseBodyAsString()` — and partners put the actual reason there: which field was invalid, which limit was hit, which idempotency key conflicted. If your translation does not copy it into your exception, every future incident starts with "we got a 400" and no more. Assert in the test that the body survives the translation; it costs one line and it is the difference between a five-minute and a two-hour investigation.

**★ Stubbing an error status with no `Content-Type` means the error-body deserialization path never runs.**
If production parses the partner's JSON error envelope, a test that responds with `withStatus(HttpStatus.BAD_REQUEST)` and no body exercises none of that code. The mapping of `{"code":"card_declined"}` to your `DeclineReason` enum is real logic with real branches, including the unknown-code branch. Stub the body and the content type, and add the case where the body is empty or is HTML, because both happen.

**★ `retrieve()` and `exchange()` differ on whether status handlers run, and the difference silently disables your error tests.**
The reference is explicit that with `exchange()` *"status handlers are not applied"* because it gives you the response directly. Refactor a client from `retrieve()` to `exchange()` for streaming or header access and every `onStatus` handler stops firing — no compile error, no warning, and a suite full of error-path tests that now assert against handling that no longer happens. If you use `exchange()`, the status checks are yours to write and yours to test.

## Interview questions

**★ Which HTTP error cases do you make a point of testing, and why those?**
Not the ones with obvious code — the ones where the behaviour is a judgement call. Concretely: a 5xx, to prove it becomes a retryable failure of my own type rather than leaking Spring's; a 429 both with and without `Retry-After`, because the header is optional and the fallback path is the one that runs during a real incident; a 4xx table that pins which statuses are retryable and which are terminal, because that is a design decision that would otherwise live nowhere; a status code Spring has no constant for, because CDNs emit them and they dodge catch blocks; and, off this page, a timeout and a connection reset, because "slow" is a far more common partner failure than "down". The through-line is that I test the translation I wrote, not the framework behaviour I did not.

**★ Why not just assert that the client throws `HttpServerErrorException` on a 500?**
Because that assertion is about Spring, and Spring is not the thing likely to break. Worse, if it passes, it tells me the exception escaped my gateway — which means every caller of the gateway now depends on `org.springframework.web.client` and has to decide at each call site whether a 502 means retry, fail the order, or leave it pending. The gateway exists to make that decision once. So the assertion I want is `isInstanceOf(PaymentGatewayUnavailable.class)`, plus a check that the status code and response body survived into the exception so the incident is debuggable. If the test can only be written against Spring's type, the missing translation is the finding.

{/* FOOTER */}
