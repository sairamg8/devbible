---
title: "Their 500 is your 502 — translating a downstream failure into your own API"
sidebar_label: "13 · Translating failures"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework reference *REST Clients →
> Error Handling*, the Spring Framework 7.0.x API for
> `RestClientResponseException`
> (docs.spring.io/spring-framework/docs/current/javadoc-api/), and RFC 9457
> *Problem Details for HTTP APIs* as implemented by Spring's `ProblemDetail`.
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**When a dependency fails, your service has to answer a question the dependency
cannot: what does this mean *for my caller*? A 500 from the inventory service is
not a 500 from you — you did not fail, your dependency did, and the status code
that says so is 502 or 503. A 400 from them, caused by a request you constructed,
is a 500 from you, because the bug is yours. And their error *body* — their field
names, their internal codes, their stack trace — must never appear in your
response, because the moment it does, your clients start parsing it and you have
accidentally published someone else's API as part of your own.**

## The mapping table you should actually write down

Here is the argument this chunk exists for. When a dependency fails, the status
you return is a statement about *where the fault lies*:

| Downstream outcome | Your status | Why |
|---|---|---|
| Connect timeout, connection refused, DNS failure | **503** (or 504) | the dependency is unavailable; you are healthy and this may be transient |
| Read timeout | **504** | a gateway timeout is literally this situation |
| 500, 502, 503 from them | **502** or **503** | you received an invalid response from an upstream server |
| 429 from them | **429** or **503**, with `Retry-After` | pass the backpressure on rather than absorbing it |
| 404 from them, for a resource your caller named | **404** | their absence is your absence |
| 404 from them, for a resource *you* chose | **500** | you asked for something that should exist; that is your bug |
| 400 from them, from a request you built | **500** | your caller cannot fix a request they never saw |
| 401/403 from them, on *your* service credentials | **500** | your credentials are your configuration problem |
| 401/403 from them, on a token forwarded from your caller | **401/403** | the caller's authorisation genuinely failed |

🔴 **The row people get wrong is the third one: returning 500 when a dependency
returned 500.** It reads as harmless and it is not. A 500 from you says *your
service has a bug*, so it points every dashboard, every alert and every on-call
engineer at your code. A 502 or 503 says *a dependency failed*, which is both
true and actionable, and which most clients and load balancers treat as
retryable — whereas a 500 they will (correctly) not retry.

The 400 rows are the mirror image and equally important. A downstream 400 caused
by a request *you* constructed is your bug: your caller cannot fix a request they
never saw, and returning 400 to them is blaming the wrong party.

## Never leak their error body

```java
// ❌ their contract becomes your contract
catch (RestClientResponseException ex) {
    return ResponseEntity.status(ex.getStatusCode())
            .body(ex.getResponseBodyAsString());
}
```

Three separate problems in four lines. Their status code is passed through
untranslated, so the mapping table above never happens. Their body — field names,
internal error codes, possibly a stack trace or an internal hostname — becomes
part of *your* response, and once a client parses it, changing your dependency
becomes a breaking change to your API. And an error body frequently contains
things that should not cross a trust boundary at all.

```java
// ✅ log theirs, return yours
catch (RestClientResponseException ex) {
    ProblemDetail theirs = ex.getResponseBodyAs(ProblemDetail.class);
    log.warn("pricing failed correlationId={} status={} detail={}",
            correlationId, ex.getStatusCode(), theirs != null ? theirs.getDetail() : null);
    throw new UpstreamUnavailable("pricing", correlationId);
}
```

Their detail goes to your logs, where your engineers can see it. Your caller gets
your own error shape, carrying a correlation id that lets support join the two.
Correlation ids across a call chain are
[Correlation ids and logging](../09-error-handling/14-correlation-ids-and-logging.md).

## Where the translation belongs

Not in the controller, and not scattered through the service layer. The clean
place is the **gateway class that owns the client** — the same class that owns
the base URL and the timeouts:

```java
@Service
public class PricingGateway {

    Pricing lookup(String tier) {
        try {
            return restClient.get().uri("/pricing/{tier}", tier)
                    .retrieve().body(Pricing.class);
        }
        catch (ResourceAccessException ex) {          // timeout, refused, DNS
            throw new PricingUnavailable(ex);
        }
        catch (HttpServerErrorException ex) {         // their 5xx
            throw new PricingUnavailable(ex);
        }
        catch (HttpClientErrorException ex) {         // our bad request to them
            throw new PricingRequestInvalid(ex);
        }
    }
}
```

Two domain exceptions cross the boundary; nothing above this class ever imports
`org.springframework.web.client`. Mapping those two onto status codes is then the
ordinary job of a `@ControllerAdvice`, which
[Mapping domain exceptions](../09-error-handling/11-mapping-domain-exceptions.md)
covers.

## Gotchas

**⚠️ Returning 500 because they returned 500**
**Symptom:** your error budget is consumed by a dependency's incident, and your
alerts page your team for someone else's outage.
**Cause:** the status was passed through rather than translated.
**Fix:** 502 or 503. It is true, it is actionable, and clients treat it as
retryable.

**⚠️ Passing a downstream 429 straight through without `Retry-After`**
**Symptom:** clients retry immediately and the rate limit never clears.
**Cause:** the status was copied but the header that makes it useful was not.
**Fix:** propagate `Retry-After` from their response, or synthesise one from your
own policy.

**⚠️ Treating a downstream 404 as always meaning 404**
**Symptom:** your API returns 404 for a resource that definitely exists, because
an internal lookup of a config-driven identifier missed.
**Cause:** the 404 was about something your caller never named.
**Fix:** decide per call. A 404 for a resource identifier your caller supplied is
a 404; a 404 for an id from your own configuration is a 500.

## Interview questions

**★ A downstream service returns 500. What status does your API return, and
why?**
502 or 503, not 500. The status code is a statement about where the fault lies: a
500 from you means *your* service has a defect, which points every dashboard and
every alert at your code and consumes your error budget for somebody else's
incident. 502 "bad gateway" or 503 "service unavailable" says a dependency
failed, which is true, is actionable for whoever is on call, and is treated as
retryable by most clients and load balancers — whereas a 500 correctly is not. The
same reasoning gives you 504 for a read timeout, which is exactly what a gateway
timeout means.

**★ A downstream service returns 400 for a request your service constructed. What
do you return?**
500. The 400 says the request was malformed, and your caller did not construct
that request — you did, from whatever they gave you plus your own logic. Passing
the 400 through blames them for a defect they cannot fix and, worse, hides a real
bug in your code behind what looks like a client error, so it never gets
investigated. The exception is a 400 that is genuinely a direct consequence of
input they supplied and could correct, in which case you translate it into *your*
validation error, in your error shape, naming your field — not theirs.

**★ Why must you never return the downstream service's error body to your
caller?**
Because it makes their contract part of yours. As soon as one client parses that
body, changing your dependency — or the dependency changing its own error format
— becomes a breaking change to your API, and you did not agree to that. It is
also an information-disclosure risk: error bodies routinely carry internal
hostnames, stack traces, database messages and internal error codes, none of
which should cross a trust boundary. The right shape is to log their body with a
correlation id and return your own error shape carrying that same id, so support
can join the two without your caller ever seeing their internals.

**★ Where in the codebase does downstream-error translation belong?**
In the gateway class that owns the client — the same class that owns the base URL
and the timeouts. That class catches `ResourceAccessException`,
`HttpServerErrorException` and `HttpClientErrorException` and throws two or three
domain exceptions instead, so nothing above it imports
`org.springframework.web.client`. The reason to concentrate it is that the
translation is a policy decision about one dependency, and scattering it across
the callers guarantees that the fourth caller written next quarter forgets a case.
Mapping the domain exceptions onto HTTP statuses is then the ordinary job of a
`@ControllerAdvice`.

**★ Your service calls a dependency that returns 429. What do you do?**
Pass the backpressure on rather than absorbing it. Absorbing it — retrying inside
your service until it succeeds — turns their rate limit into your latency and
your resource consumption, and adds load to a system that just told you it has
too much. Returning 429 or 503 to your caller with a `Retry-After` derived from
theirs pushes the decision to the party that can actually reduce demand. The one
thing not to do is copy the status and drop the header: a 429 without
`Retry-After` invites an immediate retry, which is the opposite of what a rate
limit is asking for.

---

← Prev: [Client exceptions](12-error-mapping.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Retries and resilience](14-retries-and-resilience.md)
