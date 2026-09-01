---
title: "The failures that arrive without a status code are worse than the ones that have one, because a connect timeout means the request never left and a read timeout means it may already have been processed — and Spring collapses both into the same ResourceAccessException"
sidebar_label: "03f · Failures with no status code"
sidebar_position: 19
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Spring Framework 7.0.8** source of
> [`DefaultRestClient`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/spring-web/src/main/java/org/springframework/web/client/DefaultRestClient.java)
> (the `catch (IOException ex)` around the exchange and its `createResourceAccessException`),
> [`ResourceAccessException`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/spring-web/src/main/java/org/springframework/web/client/ResourceAccessException.java)
> — *"Exception thrown when an I/O error occurs."* — and
> [`ResponseCreator`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/spring-test/src/main/java/org/springframework/test/web/client/ResponseCreator.java),
> whose single method is declared `throws IOException`; the **Spring Boot 4.1.0** reference
> *Calling REST Services*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/io/rest-client.html)) for
> the client detection order and the `spring.http.clients` settings, and the source of
> [`HttpRedirects`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-http-client/src/main/java/org/springframework/boot/http/client/HttpRedirects.java);
> the **JDK 25** javadocs for
> [`HttpTimeoutException`](https://docs.oracle.com/en/java/javase/25/docs/api/java.net.http/java/net/http/HttpTimeoutException.html)
> and
> [`HttpConnectTimeoutException`](https://docs.oracle.com/en/java/javase/25/docs/api/java.net.http/java/net/http/HttpConnectTimeoutException.html);
> **WireMock**'s *Simulating Faults* page
> ([wiremock.org](https://wiremock.org/docs/simulating-faults/)); and **OkHttp**'s
> `mockwebserver3` sources at tag `parent-5.5.0`
> ([SocketEffect.kt](https://github.com/square/okhttp/blob/parent-5.5.0/mockwebserver/src/main/kotlin/mockwebserver3/SocketEffect.kt),
> `MockResponse.Builder`).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source, build configuration and
> documented behaviour only, never console output or timings.

**[03c](03c-the-error-paths-nobody-writes.md) handled the failures that arrive with a status
code, where the partner told you what went wrong. This chunk is the other half, and it is the
half that produces the incidents: the partner told you nothing, because the partner never
answered. Every one of these surfaces on the Spring side as a `ResourceAccessException`, and
that is the problem — the exception type is identical whether the request never left your
process or was fully processed and charged a customer. This chunk is the connection-level
failures. The ones where a response *does* arrive and is unusable — malformed JSON, an HTML
error page with a 200, a redirect loop — are [03f2](03f2-when-a-response-arrives-and-is-wrong.md).**

## The mechanism: one catch block decides all of it

`DefaultRestClient` wraps the whole exchange, and its handler is short enough to quote in
full behaviour:

```java
catch (IOException ex) {
    ResourceAccessException resourceAccessException =
            createResourceAccessException(uri, this.httpMethod, ex);
    // …
    throw resourceAccessException;
}
```

and `createResourceAccessException` builds the message as
`"I/O error on " + method + " request for \"" + urlWithoutQuery + "\": " + ex.getMessage()`,
passing `ex` as the cause. `ResourceAccessException`'s own javadoc is one line: *"Exception
thrown when an I/O error occurs."*

Two consequences fall straight out and they are the whole page.

🔴 **First: the Spring type carries no information.** `ResourceAccessException` is what you
get for a connect timeout, a read timeout, a connection reset, a DNS failure and a TLS
handshake failure alike. A test asserting `isInstanceOf(ResourceAccessException.class)` has
asserted "something went wrong on the network", which was never in doubt.

🔴 **Second: everything you need is in the cause.** The `IOException` subtype is preserved,
and it is the only thing that distinguishes "the request never left" from "the request may
have been processed". So the assertion worth writing is on your translation, and your
translation must look at the cause.

## The distinction that costs money

| Failure | Cause type (JDK `HttpClient`) | Did the partner receive it? | Safe to retry blindly? |
|---|---|---|---|
| Connect timeout | `HttpConnectTimeoutException` | **No** — no connection was established | ✅ yes |
| DNS failure | `UnknownHostException` | **No** | ⛔ pointless — it is configuration, not weather |
| TLS handshake failure | `SSLHandshakeException` | **No** | ⛔ pointless — usually an expired certificate |
| Read / response timeout | `HttpTimeoutException` | **Unknown** | 🔴 **no** — only with the same idempotency key |
| Connection reset mid-response | `SocketException` | **Unknown** | 🔴 **no** — only with the same idempotency key |

The JDK's own javadocs draw the line for the first and fourth rows exactly where it matters.
`HttpConnectTimeoutException` is *"Thrown when a connection, over which an `HttpRequest` is
intended to be sent, is not successfully established within a specified time period"* — the
request was never sent. `HttpTimeoutException`, its superclass, is *"Thrown when a response is
not received within a specified time period"* — which says nothing about whether the request
was processed. And `HttpConnectTimeoutException extends HttpTimeoutException extends
IOException`, so ⚠️ **a `catch` or an `instanceof` on `HttpTimeoutException` catches the
connect timeout too**, collapsing the exact distinction you were trying to make. Test for the
subclass first.

⚠️ **The cause type depends on which HTTP client is on the classpath.** Boot 4.1's detection
order, from the reference, is: *Apache HttpClient*, *Jetty HttpClient*, *Reactor Netty
HttpClient*, *JDK client (`java.net.http.HttpClient`)*, *Simple JDK client
(`java.net.HttpURLConnection`)*, and *"If multiple clients are available on the classpath, and
no global configuration is provided, the most preferred client will be used."* Apache produces
`ConnectTimeoutException` and `SocketTimeoutException`; the simple factory produces
`SocketTimeoutException` for both. **Do not write a translation that pattern-matches only the
JDK client's types unless you have pinned the client.**

## The translation, and the type that carries the answer

```java
catch (ResourceAccessException e) {
    throw switch (e.getCause()) {
        case HttpConnectTimeoutException c -> new PaymentUnreachable(c);          // never sent
        case UnknownHostException u        -> new PaymentMisconfigured(u);        // not transient
        case SSLHandshakeException s       -> new PaymentMisconfigured(s);        // not transient
        case HttpTimeoutException t        -> new PaymentOutcomeUnknown(t);       // may have charged
        case SocketException s             -> new PaymentOutcomeUnknown(s);       // may have charged
        case null, default                 -> new PaymentOutcomeUnknown(e);       // assume the worst
    };
}
```

🔴 **`PaymentOutcomeUnknown` is not a failure type — it is a third outcome**, and most
codebases do not have one. Success, decline, and *"we do not know"* are three states, and a
gateway that only offers two forces the caller to guess. The default arm assumes the worst on
purpose: an unrecognised cause is treated as possibly-charged, because the cost of
under-assuming is a double charge and the cost of over-assuming is a reconciliation lookup.

The `case null, default` arm is not decoration either — `ResourceAccessException` has a
message-only constructor, so `getCause()` is nullable.

## Testing them in process, with no socket

This is the part people do not know exists. `ResponseCreator`'s single method is declared
`throws IOException`:

```java
ClientHttpResponse createResponse(@Nullable ClientHttpRequest request) throws IOException;
```

`MockClientHttpRequest.execute()` is likewise `throws IOException`, so an exception thrown
from a response creator propagates out of the request execution and lands in
`DefaultRestClient`'s `catch (IOException ex)` — the same code path a real failure takes.
That makes a lambda a legitimate fault injector:

```java
@Test
void treatsAConnectTimeoutAsUnreachableRatherThanUnknown() {
    server.expect(requestTo("https://pay.example.com/v1/charges"))
          .andRespond(request -> {
              throw new HttpConnectTimeoutException("connect timed out");
          });

    assertThatThrownBy(() -> gateway.charge(aCharge().build()))
            .isInstanceOf(PaymentUnreachable.class);
}

@Test
void treatsAReadTimeoutAsAnUnknownOutcome() {
    server.expect(requestTo("https://pay.example.com/v1/charges"))
          .andRespond(request -> {
              throw new HttpTimeoutException("request timed out");
          });

    assertThatThrownBy(() -> gateway.charge(aCharge().build()))
            .isInstanceOf(PaymentOutcomeUnknown.class);
}
```

🔴 **Be precise about what this proves.** It proves your *translation* — the switch above —
which is the branchiest and most consequential code in the gateway, and it proves it in
microseconds with no port. It does **not** prove that a timeout is configured, that the
configured value is reached, or that the client produces that exception type at all;
[03a](03a-what-the-mock-server-does-not-run.md)'s table is explicit that connect and read
timeouts are *"never applied"* in this style, because the `ClientHttpRequestFactory` is gone.
You are asserting on a symptom you injected. That is a fair trade for the translation table
and a lie if you present it as timeout coverage.

## Testing them on a socket, where the timeout is real

For the configuration question you need a server that is genuinely slow or genuinely rude.

**WireMock**, whose `Fault` enum is documented as:

| `Fault` value | Documented behaviour |
|---|---|
| `EMPTY_RESPONSE` | *"Return a completely empty response."* |
| `MALFORMED_RESPONSE_CHUNK` | *"Send an OK status header, then garbage, then close the connection."* |
| `RANDOM_DATA_THEN_CLOSE` | *"Send garbage then close the connection."* |
| `CONNECTION_RESET_BY_PEER` | *"Close the connection, setting `SO_LINGER` to 0 and thus preventing the `TIME_WAIT` state being entered."* |

```java
stubFor(post("/v1/charges").willReturn(aResponse().withFault(Fault.CONNECTION_RESET_BY_PEER)));
```

and for slowness, `withFixedDelay(millis)`, `withLogNormalRandomDelay(median, sigma)`, and
`withChunkedDribbleDelay(numberOfChunks, totalDuration)` — the last being the one that models
a partner that answers and then stalls mid-body, which is what "the partner went slow"
actually looks like.

**MockWebServer** attaches the nastiness to the queued response. From the
`mockwebserver3` sources: `failHandshake()` — *"Don't trust the client during the SSL
handshake."* — `headersDelay(delay, unit)`, `bodyDelay(delay, unit)`,
`throttleBody(bytesPerPeriod, period, unit)` (*"Throttles the request reader and response
writer to sleep for the given period after each series of `bytesPerPeriod` bytes are
transferred. Use this to simulate network behavior."*), and the `SocketEffect` family attached
at a trigger point — `onRequestStart`, `onRequestBody`, `onResponseStart`, `onResponseBody`,
`onResponseEnd`. The effects themselves are `CloseSocket`, `ShutdownConnection`, `CloseStream`
and `Stall` — the last documented simply as *"Stop processing this."*, which is the response
that never ends.

🔴 **`Stall` is the test that finds the missing timeout**, and it only works if the test
itself has a bound: a JUnit `@Timeout`, or an assertion that the call returns within a
duration. Without one, the test *becomes* the hang it was written to detect.

## The two failures that are not transient, and the retry that makes them worse

`UnknownHostException` and `SSLHandshakeException` are lumped in with "network problems" by
almost every retry policy, and they are not weather — they are configuration:

- **DNS.** A typo in a base URL, a private zone not resolvable from the new cluster, a
  service name that changed. It will fail identically on every attempt, forever. Retrying
  three times with backoff turns a fast, clear failure into a slow, confusing one, and hides
  the real message behind a retry-exhausted wrapper.
- **TLS.** Overwhelmingly an expired certificate, an untrusted intermediate, or a truststore
  that lost an entry in a base-image bump. It has a start time and no end time, and every
  client in the fleet hits it at once.

Both belong in the *"do not retry, alert"* bucket alongside 401 and 400 from
[03c](03c-the-error-paths-nobody-writes.md)'s table. `MockWebServer`'s `failHandshake()`
gives you a real TLS failure to test the translation against; DNS is easiest tested through
the in-process route by throwing `UnknownHostException` from a response creator, because
pointing a test at an unresolvable name makes the test depend on the resolver of whatever
machine runs it.

## Where this connects

- The failures where a response arrives and is unusable — malformed JSON, HTML with a 200, a
  redirect loop, an empty body, and the configuration test for the missing timeout:
  [03f2 · When a response arrives and is wrong](03f2-when-a-response-arrives-and-is-wrong.md).
- The failures that carry a status code, and the translation table they feed:
  [03c · The error paths nobody writes](03c-the-error-paths-nobody-writes.md).
- The 429, which is the one failure that tells you what to do next:
  [03g · The 429 and Retry-After](03g-the-429-and-retry-after.md).
- Why the retry after an unknown outcome must reuse the idempotency key, and the test that
  proves it: [09b · Idempotency and the double charge](09b-idempotency-and-the-double-charge.md).
- What the in-process mock server does and does not run, which bounds every claim on this
  page: [03a · What it does not run](03a-what-the-mock-server-does-not-run.md).
- The socket tools, their setup and their cost:
  [03b · WireMock and MockWebServer](03b-wiremock-and-mockwebserver.md) and
  [03e · MockWebServer and the cost of a socket](03e-mockwebserver-and-the-cost-of-a-socket.md).
- The adapter whose `catch` blocks are the code under test here:
  [04b · The adapter and the three test populations](04b-the-adapter-and-the-three-test-populations.md).

## Gotchas

**★ `ResourceAccessException` is the same type for a connect timeout and a read timeout, and only the cause tells you which.**
`DefaultRestClient` catches `IOException` and wraps every one of them identically. So `assertThatThrownBy(...).isInstanceOf(ResourceAccessException.class)` is an assertion that the network failed, which was the premise of the test. The behaviour worth pinning is the branch on `getCause()`, because that branch decides whether the caller may retry blindly or must reuse an idempotency key.

**★ `HttpConnectTimeoutException` extends `HttpTimeoutException`, so an `instanceof HttpTimeoutException` check swallows the connect case.**
The JDK's own hierarchy puts them in that order, and the two mean opposite things for retry safety — never sent versus possibly processed. A `switch` pattern or an `if` chain that tests the superclass first quietly classifies every connect timeout as an unknown outcome, which is the safe direction but produces unnecessary reconciliation work; the reverse ordering mistake is far worse. Order the cases most-specific first.

**★ The cause type depends on which HTTP client is on the classpath, and Boot picks by preference order.**
Apache HttpClient, if present, wins over the JDK client, and it throws its own `ConnectTimeoutException` and `SocketTimeoutException` rather than `java.net.http`'s. A translation written against the JDK types silently falls through to the default arm on a service that has Apache on the classpath for another reason. Either pin the factory with `spring.http.clients.imperative.factory` or write the translation to handle both families and test both.

**★ `ResourceAccessException.getCause()` can be null, and the switch that forgot it throws a `NullPointerException` from inside the error handler.**
The class has a message-only constructor. A `switch` over the cause without a `case null` arm produces an NPE thrown from the catch block, which replaces a diagnosable network error with a stack trace pointing at your gateway. `case null, default ->` costs three words.

**★ A retry policy that treats `UnknownHostException` as transient turns a five-second config error into a thirty-second one and hides the message.**
DNS failures are deterministic. Three attempts with exponential backoff produce the same failure three times, then a retry-exhausted exception whose message is about retries rather than about the hostname. The same applies to `SSLHandshakeException`. Both belong in the do-not-retry bucket with 400 and 401.

**★ A TLS failure is a fleet-wide, time-triggered event, and nothing in a normal test suite has a date in it.**
Certificate expiry hits every instance at once, at a moment nobody chose. No unit test detects it, because the certificate is valid when the suite runs. What a test *can* pin is the translation: `MockWebServer`'s `failHandshake()` produces a real handshake failure, and the assertion is that it becomes your non-retryable, alert-worthy type rather than being retried as weather. The detection itself is monitoring's job, not the suite's.

**★ Injecting an `IOException` from a `ResponseCreator` tests your translation and proves nothing about your timeout configuration.**
The `ClientHttpRequestFactory` is replaced in this style, so connect and read timeouts are never applied — there is no socket to be slow. The test is genuinely valuable, because the translation is the branchy part, but writing it and then believing the client is protected against a slow partner is precisely the false confidence [03a](03a-what-the-mock-server-does-not-run.md) warns about. The timeout needs either a socket test or a configuration assertion.

**★ A `Stall` or a long delay in a socket test with no timeout on the test itself hangs the build instead of failing it.**
`SocketEffect.Stall` is documented as *"Stop processing this."* — which is the exact behaviour you want to detect and also the exact behaviour that will pin your CI job. Bound the test: JUnit's `@Timeout`, or an AssertJ assertion that the call completed within a duration. A hung build is a worse outcome than the missing timeout it was hunting.

**★ Delays and throttling are properties of the queued response, so a retry test needs the delay on every enqueued response.**
`bodyDelay`, `headersDelay` and `throttleBody` are `MockResponse.Builder` calls, not server settings. A test that models "the partner is degraded" and enqueues three responses must slow all three; slowing only the first produces a test where the retry succeeds instantly and the assertion about giving up never fires.

**★ "The partner went down" is the rare case; "the partner went slow" is the common one, and only one of them has a status code.**
Teams test 500s exhaustively and timeouts not at all, because a 500 is easy to stub. In practice a degraded partner keeps accepting connections and answers late or partially, which exhausts your connection pool and your request threads and takes your service down with it — a much larger blast radius than the partner returning errors quickly. `withChunkedDribbleDelay` and `bodyDelay` model this; nothing with a status code does.

## Interview questions

**★ A payment POST times out. What does your code do, and what does the test assert?**
It depends entirely on *which* timeout, and that is the answer. A connect timeout means no connection was established — the JDK's `HttpConnectTimeoutException` is documented as being thrown when a connection *"is not successfully established"* — so the request was never sent, the charge definitely did not happen, and retrying it is safe. A read timeout means a response was not received, which says nothing about whether the partner processed the request; the charge may well have gone through. So my gateway translates those into two different types: something like `PaymentUnreachable` for the first and `PaymentOutcomeUnknown` for the second, and the caller treats the second as a third outcome rather than as a failure — reconcile, or retry with the same idempotency key. The tests assert exactly that mapping, and I write them in process by throwing the relevant `IOException` from a `ResponseCreator`, because the interface is declared `throws IOException` and `RestClient` wraps everything it catches into `ResourceAccessException`. What those tests do not prove is that a timeout is configured at all, which is a separate, configuration-level test.

**★ Why is asserting `ResourceAccessException` not enough?**
Because Spring throws the same type for every I/O failure — connect timeout, read timeout, reset, DNS, TLS. `DefaultRestClient` has one `catch (IOException ex)` and wraps all of them with the same class and a message built from the method and URL. So the assertion says "the network failed", which is what the test set up. Everything that distinguishes a safe retry from a possible double charge is in the cause, and the cause is what my translation branches on, so the cause is what the test has to reach. Practically, I assert on my own exception type — the one the switch produced — because that is the value the caller acts on, and I keep the original as the cause so an incident has the underlying message to work from.

**★ How would you prove your client has a read timeout configured?**
Not with `MockRestServiceServer`, because it replaces the request factory and no timeout is ever applied there — that test would pass against a client with no timeout at all. Two honest routes. The cheap one is a configuration test: assert that the properties the application binds contain the timeouts, since Boot 4.1 exposes `spring.http.clients.connect-timeout` and `spring.http.clients.read-timeout` as first-class settings, and a test that the bound values are non-null and sane catches the commonest failure, which is that nobody set them. The real one is a socket test: a `MockWebServer` response with a `bodyDelay` or a `SocketEffect.Stall`, and an assertion that the call fails within a bounded time. That second test must itself be bounded with `@Timeout` or an assertion on duration, otherwise the test hangs exactly the way production would, which is a spectacularly unhelpful way to discover you were right.

**★ Which network failures should a retry policy exclude, and why?**
DNS and TLS, and everything non-idempotent without a key. `UnknownHostException` and `SSLHandshakeException` are configuration failures, not transient conditions — a bad hostname does not become good, and an expired certificate does not un-expire — so retrying produces the identical failure N times, delays the alert, and buries the useful message under a retry-exhausted wrapper. The subtler exclusion is the read timeout and the connection reset on a non-idempotent request. Those are retryable in principle, but only with the same idempotency key, because the partner may have processed the request. RFC 9110 puts it plainly: a client *"SHOULD NOT automatically retry a request with a non-idempotent method unless it has some means to know that the request semantics are actually idempotent"*. An idempotency key is that means, which is why the retry decision and the key are the same design question.

{/* FOOTER */}
