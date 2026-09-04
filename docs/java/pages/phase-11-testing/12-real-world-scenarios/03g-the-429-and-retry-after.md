---
title: "A 429 is the one HTTP error that tells you exactly what to do next, in a header with two legal formats, and almost every client both ignores the instruction and parses only one of the formats"
sidebar_label: "03g · The 429 and Retry-After"
sidebar_position: 21
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against **RFC 6585** §4 *429 Too Many Requests*
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6585.txt)) and **RFC 9110** §10.2.3
> *Retry-After* ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9110.txt)); the
> **Spring Framework 7.0.x** `MockRestResponseCreators` javadoc
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/web/client/response/MockRestResponseCreators.html))
> for `withTooManyRequests(int)`; and the Framework reference *Resilience*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/core/resilience.html))
> for `@Retryable`'s documented defaults.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**[03c](03c-the-error-paths-nobody-writes.md) mapped the status families onto your own
exception types. The 429 gets its own chunk because it is different in kind: every other
error tells you *that* something went wrong, and a 429 tells you *what to do about it*, in
an optional header with two legal syntaxes. Three tests cover it properly, and the third
one — the format nobody implements — is the one that fires during the incident it was meant
to help with.**

## What a 429 actually says

This is the single most commonly missing test in this whole topic, and the reason is that
the code that handles 429 usually does not exist — a generic "retry on failure" treats it
like any other error and hammers a partner that has explicitly asked you to stop.

The specs, because the semantics are the whole point. RFC 6585 §4 defines the status:

> *"The 429 status code indicates that the user has sent too many requests in a given
> amount of time ("rate limiting")."*

> *"The response representations SHOULD include details explaining the condition, and MAY
> include a Retry-After header indicating how long to wait before making a new request."*

And RFC 9110 §10.2.3 defines the header's two shapes, which is what breaks parsers:

> *"The Retry-After field value can be either an HTTP-date or a number of seconds to delay
> after receiving the response."*

> ```
> Retry-After = HTTP-date / delay-seconds
> ```

Spring gives you a purpose-built response creator:
`withTooManyRequests(int retryAfter)` — *"`ResponseCreator` for a 429 rate-limited response
(TOO_MANY_REQUESTS) with a `Retry-After` header in seconds."* And the bare
`withTooManyRequests()` for the header-less case, which you also need, because the header is
`MAY`, not `MUST`.

```java
@Test
void surfacesTheRetryAfterDelay() {
    server.expect(requestTo("https://pay.example.com/v1/charges"))
          .andRespond(withTooManyRequests(30));

    assertThatThrownBy(() -> gateway.charge(aCharge().build()))
            .isInstanceOf(PaymentRateLimited.class)
            .extracting(e -> ((PaymentRateLimited) e).retryAfter())
            .isEqualTo(Duration.ofSeconds(30));
}

@Test
void defaultsWhenTheServerSendsNoRetryAfter() {
    server.expect(requestTo("https://pay.example.com/v1/charges"))
          .andRespond(withTooManyRequests());

    assertThat(catchThrowableOfType(PaymentRateLimited.class,
            () -> gateway.charge(aCharge().build())).retryAfter())
            .isEqualTo(Duration.ofSeconds(5));   // your documented default
}

@Test
void parsesTheHttpDateFormOfRetryAfter() {
    server.expect(requestTo("https://pay.example.com/v1/charges"))
          .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS)
                  .header(HttpHeaders.RETRY_AFTER, "Wed, 21 Oct 2026 07:28:00 GMT"));

    // asserts through the injected Clock — see 01b's MutableClock
    assertThat(catchThrowableOfType(PaymentRateLimited.class,
            () -> gateway.charge(aCharge().build())).retryAfter())
            .isNotNegative();
}
```

Three tests, and the third is the one that finds the bug. A parser written against a
partner that always sends `Retry-After: 30` throws `NumberFormatException` the day the
partner switches to the date form — which is legal, and which the third test would have
caught. Note that the date form needs an injected `Clock` to compute a duration, or the
test is nondeterministic; that is [01b](01b-the-js-to-java-map.md)'s `MutableClock` earning
its keep.

## Where this connects

- The status families and the exception hierarchy this builds on:
  [03c · The error paths nobody writes](03c-the-error-paths-nobody-writes.md).
- The failures with no status code — timeout, reset, malformed body:
  [03f · The failures with no status code](03f-the-failures-with-no-status-code.md).
- Retrying without waiting for a real backoff, and the injected `Clock`:
  [07 · Async, scheduled and eventual](07-async-scheduled-and-eventual.md).
- The `MutableClock` the HTTP-date test needs:
  [01b · The JS-to-Java map](01b-the-js-to-java-map.md).
- Proving a retried charge did not become two charges:
  [09b · Idempotency and the double charge](09b-idempotency-and-the-double-charge.md).

## Gotchas

**★ `Retry-After` has two legal forms and every hand-written parser handles one.**
RFC 9110 is explicit: *"Retry-After = HTTP-date / delay-seconds"*. Partners overwhelmingly send seconds, so the parser gets written as `Integer.parseInt(header)`, and it works for years — until a CDN, a WAF or a partner migration starts emitting the date form and every rate-limited request throws `NumberFormatException` from inside the error handler. Write both tests. The date form also needs an injected `Clock`, or the assertion is a function of when the suite ran.

**★ A generic "retry on any exception" policy turns a 429 into a denial-of-service on your partner and a 400 into an infinite loop.**
Framework 7's `@Retryable` retries *"for any exception thrown"* by default — the reference says so explicitly — with three attempts and a one-second delay. That default is the wrong policy for HTTP: 400, 401, 403 and 422 will never succeed on retry, and 429 needs a delay the server chose, not the one in your annotation. Configure `includes` with your own retryable exception type, which is another reason the translation in the adapter has to happen first.

**★ `withTooManyRequests()` and `withTooManyRequests(int)` are different tests, and you need both.**
The header is `MAY` in RFC 6585, so a well-behaved client has a documented default for its absence. Testing only the with-header case leaves the default path — the one that runs when the partner is under real load and stops populating optional headers — completely uncovered. It is a two-line test and it is the one that fires at 3am.

**★ Catching `HttpClientErrorException.TooManyRequests` *after* `HttpClientErrorException` does not compile, and moving it first is the fix people skip.**
Java rejects a catch block for a subclass that appears after its superclass — "has already been caught". So the adapter's `catch (TooManyRequests e)` must come before the general `catch (HttpClientErrorException e)`. The failure mode when someone "fixes" the compile error by deleting the specific block instead of reordering is silent: 429 falls into the generic branch, becomes `PaymentRejected`, and the caller stops retrying something that was explicitly retryable.

**★ Putting the retry *inside* the gateway hides the rate limit from the caller, from metrics and from the test.**
A gateway that catches its own 429 and sleeps looks tidy and is a trap. The caller can no longer decide whether waiting thirty seconds is acceptable for this request — it might be a user-facing checkout where it absolutely is not. The wait also disappears from the caller's latency budget, and the test now needs to sleep to observe anything. Throw `PaymentRateLimited` with the duration, let the layer that knows the request's deadline decide, and the test stays instant.

**★ `withTooManyRequests(30)` writes `Retry-After: 30` as a header string; nothing in Spring turns it into a `Duration` for you.**
The response creator is documented as producing a 429 *"with a `Retry-After` header in seconds"* — that is all it does. Converting the header to a `Duration`, handling its absence, and handling the date form are entirely your code, which is exactly why they need tests. If your gateway does not have a `retryAfter(HttpHeaders)` method, the header is being dropped and the three tests on this page all pass against a client that ignores rate limiting completely.

## Interview questions

**★ A partner returns 429 with `Retry-After`. Walk me through the tests you would write and the production code they drive.**
Three tests and one design constraint. Test one: 429 with `Retry-After: 30` produces my `PaymentRateLimited` carrying `Duration.ofSeconds(30)` — proving I read the header at all, which a generic retry does not. Test two: 429 with no `Retry-After` produces the same exception with my documented default, because RFC 6585 makes the header optional and that path runs exactly when the partner is most loaded. Test three: 429 with the HTTP-date form, because RFC 9110 permits `Retry-After = HTTP-date / delay-seconds` and a `parseInt` parser explodes on it. The design constraint falls out of test three: computing a duration from a date needs an injected `Clock`, so the gateway takes one, and the test uses a fixed or mutable clock rather than wall time. On the production side, the retry policy has to consume that duration instead of its own backoff — which means the retry lives above the gateway, on my exception type, not as a blanket `@Retryable` on any exception.

**★ How do you stop a retry policy from making an outage worse?**
By making the retryability decision at the adapter, in code, and testing it as a table. Framework 7's `@Retryable` defaults to retrying any exception, three times, a second apart — fine as a default, wrong for HTTP, because 400, 401, 403 and 422 cannot succeed on retry and retrying them turns a client bug into sustained load on a partner who is already telling you no. So the adapter translates each status into one of my types, the types carry a `retryable()` answer, and the retry policy `includes` only the retryable ones. Then the parameterized status-to-outcome test is the thing that stops someone quietly adding 422 to the retryable set. The second half is the backoff: honour the server's `Retry-After` when it sends one, add jitter when it does not, and cap the total, so a partner recovering from an outage is not immediately re-flooded by every client retrying in lockstep.

**★ Should the retry live inside the HTTP gateway or above it?**
Above it, in almost every case. The gateway knows what the partner said; it does not know whether waiting is acceptable, and that is the decision a retry makes. A checkout request with a user waiting on it cannot absorb a thirty-second `Retry-After`, while the same call from a nightly reconciliation job absolutely can — same gateway, opposite correct behaviour. So the gateway translates the 429 into `PaymentRateLimited` carrying the duration, and the caller, or a policy configured per use case, decides. It also keeps the tests honest: a gateway that sleeps internally forces every test of it to be slow or to inject a sleeper, whereas a gateway that throws is tested in microseconds and the retry policy is tested separately with a fake clock. The one exception I would make is a low-level, internal, non-user-facing client where the retry is genuinely part of the transport contract — and even then I would make the policy injectable so a test can set it to zero attempts.

{/* FOOTER */}
