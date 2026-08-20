---
title: "What the client throws, and how to read what came back"
sidebar_label: "12 · Client exceptions"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework reference *REST Clients →
> Error Handling*
> (docs.spring.io/spring-framework/reference/integration/rest-clients.html) and
> the Spring Framework 7.0.x API for `RestClientException`,
> `RestClientResponseException`, `HttpStatusCodeException`,
> `HttpClientErrorException`, `HttpServerErrorException` and
> `ResourceAccessException`
> (docs.spring.io/spring-framework/docs/current/javadoc-api/). Spring Boot 4.1.0,
> Spring Framework 7.0.x, JDK 25.

**Spring's client exception hierarchy has one branch that decides whether your
error handling works at all, and it is not the one people catch. Every HTTP
status failure — 4xx, 5xx — lands under `RestClientResponseException`. Every
*I/O* failure — connect timeout, read timeout, connection refused, DNS — lands
under `ResourceAccessException`, which is a *sibling*, not a subclass, because
there was no response and therefore no status code. Since timeouts are the most
common way a dependency actually fails, a `catch` that only covers the status
branch handles the failure that matters least.**

## What `RestClient` throws by default

The reference states that by default `RestClient` throws a subclass of
`RestClientException` when it receives a 4xx or 5xx. The hierarchy is worth
knowing because it is what your `catch` blocks discriminate on:

```text
RestClientException
├── ResourceAccessException            ← "Exception thrown when an I/O error occurs"
└── RestClientResponseException        ← "contains actual HTTP response data"
    ├── HttpStatusCodeException
    │   ├── HttpClientErrorException   ← 4xx
    │   └── HttpServerErrorException   ← 5xx
    └── UnknownHttpStatusCodeException ← a status code the enum does not know
```

🔴 **The most important branch is the top one, and it is the one people forget.**
`ResourceAccessException` is not an HTTP error — it is the I/O failure case, which
is where a connect timeout, a read timeout, a refused connection and a DNS failure
all arrive. There is no status code, because there was no response. A `catch
(HttpServerErrorException e)` misses every one of them, which means the code that
handles "the dependency failed" does not handle the most common way the
dependency fails.

`HttpClientErrorException` and `HttpServerErrorException` both have per-status
nested subclasses — `HttpServerErrorException.BadGateway`,
`.GatewayTimeout`, `.ServiceUnavailable`, `.InternalServerError`,
`.NotImplemented`, and the 4xx equivalents — so you can catch a specific status
as a type where that reads better than comparing an enum.

## Getting at the error response

`RestClientResponseException` is documented as the "common base class for
exceptions that contain actual HTTP response data", and it carries the whole
response:

| Method | Returns |
|---|---|
| `getStatusCode()` | the `HttpStatusCode` |
| `getStatusText()` | the reason phrase |
| `getResponseHeaders()` | the response headers (nullable) |
| `getResponseBodyAsString()` | the body, decoded with the response charset or UTF-8 |
| `getResponseBodyAsByteArray()` | the raw bytes |
| `getResponseBodyAs(Class<E>)` | the body converted to a type |
| `getResponseBodyAs(ParameterizedTypeReference<E>)` | the generic variant |

That last pair is the useful one, and it is how you read a structured error body
back off the wire.

## Reading a `ProblemDetail` back

If the downstream service follows RFC 9457 — which it does if it is a Spring
service using the defaults from
[ProblemDetail and RFC 9457](../09-error-handling/06-problemdetail-and-rfc-9457.md)
— its error body is a `ProblemDetail`, and you can deserialise it directly:

```java
try {
    return restClient.get().uri("/pricing/{tier}", tier)
            .retrieve()
            .body(Pricing.class);
}
catch (RestClientResponseException ex) {
    ProblemDetail problem = ex.getResponseBodyAs(ProblemDetail.class);
    log.warn("pricing lookup failed: status={} type={} detail={}",
            ex.getStatusCode(),
            problem != null ? problem.getType() : null,
            problem != null ? problem.getDetail() : null);
    throw new PricingUnavailable(ex);
}
```

⚠️ **`getResponseBodyAs` can return `null`** — the method is declared nullable —
and it will, whenever the body is empty, is not JSON, or is an HTML error page
produced by a proxy rather than by the service. Every read of it needs the null
branch. A dependency returning a `text/html` 502 from a load balancer is not an
edge case; it is Tuesday.

⚠️ **`RestClientResponseException` does not itself expose a `ProblemDetail`.** Its
javadoc lists no `getBody()` returning one, so the conversion is something you do
explicitly with `getResponseBodyAs`. Do not assume the framework has parsed it
for you.

## `onStatus`: deciding per call

`retrieve()` gives you the default behaviour; `onStatus` overrides it for
statuses matching a predicate:

```java
String result = restClient.get()
        .uri("/this-url-does-not-exist")
        .retrieve()
        .onStatus(HttpStatusCode::is4xxClientError, (request, response) -> {
            throw new MyCustomRuntimeException(response.getStatusCode(), response.getHeaders());
        })
        .body(String.class);
```

The handler receives the request and the response, so it can include the URI in
the exception — which is worth doing, because "404" is a much less useful log
line than "404 from `GET /pricing/{tier}`".

The most common non-throwing use is turning a 404 into an absent value, which is
the one case where a 4xx genuinely is not an error:

```java
Optional<Pet> pet = Optional.ofNullable(restClient.get()
        .uri("/pets/{id}", id)
        .retrieve()
        .onStatus(status -> status.value() == 404, (req, res) -> { })
        .body(Pet.class));
```

An empty handler body means "do not throw". The call then returns `null` for the
missing resource, which `Optional.ofNullable` turns into something honest.

For a policy that should apply to every call on a client, put it on the builder
with `defaultStatusHandler` — [chunk 3](03-the-fluent-api.md) argues for keeping
that one narrow, because a broad builder-level handler removes the ability of any
individual call site to disagree with it.

## Gotchas

**⚠️ Catching `HttpStatusCodeException` and missing every timeout**
**Symptom:** timeouts and connection failures escape as raw
`ResourceAccessException` and surface to the client as a 500.
**Cause:** the I/O branch is a sibling of the status branch, not a child.
**Fix:** catch `ResourceAccessException` explicitly, or catch
`RestClientException` and discriminate inside. There is no single subclass that
covers both.

**⚠️ Assuming an error body is JSON**
**Symptom:** a `HttpMessageConversionException` thrown from inside the `catch`
block that was supposed to handle the error.
**Cause:** the 502 came from a load balancer as `text/html`.
**Fix:** null-check `getResponseBodyAs`, and be prepared for it to throw on
unconvertible content — wrap the conversion, or check the `Content-Type` from
`getResponseHeaders()` first.

**⚠️ A `defaultStatusHandler` that swallows errors and returns null**
**Symptom:** `NullPointerException` deep in business logic, with no sign of the
HTTP failure that caused it.
**Cause:** a handler that logs and returns instead of throwing, so `body(...)`
yields `null`.
**Fix:** swallow only where the *caller* is written to expect an empty result —
the 404-as-`Optional` case — and throw everywhere else.

**⚠️ Logging the whole error body at `ERROR` on every failure**
**Symptom:** a dependency's incident produces gigabytes of logs, and the useful
lines are unfindable.
**Cause:** unbounded response bodies logged per occurrence.
**Fix:** log the status, the URI template and the `detail` field; keep the full
body behind `DEBUG` or a sampled logger.

## Interview questions

**★ Which exception does a read timeout produce, and why does that surprise
people?**
`ResourceAccessException`, whose javadoc is simply "Exception thrown when an I/O
error occurs". It surprises people because it is a *sibling* of
`RestClientResponseException` rather than a subclass — there is no status code,
because there was no response. So a `catch (HttpServerErrorException e)` block,
which looks like it handles "the dependency failed", misses every timeout,
refused connection and DNS failure. Since those are the most common ways a
dependency actually fails, that single miscatch is one of the most consequential
mistakes in this whole topic.

**★ How do you read an RFC 9457 `ProblemDetail` out of a failed call?**
`RestClientResponseException.getResponseBodyAs(ProblemDetail.class)`. The
exception carries the raw response, and `getResponseBodyAs` runs it through the
message converters for you. Two cautions. It is nullable and returns `null`
whenever the body is empty or not convertible — which happens constantly, because
a 502 from a load balancer is HTML, not JSON — so the null branch is mandatory.
And the exception does not expose a parsed `ProblemDetail` of its own; nothing has
parsed it until you ask, so do not write code assuming the framework did it.

**★ When is it right to swallow a 4xx rather than throw?**
When the status is genuinely part of the resource's normal vocabulary rather than
a failure — overwhelmingly, a 404 meaning "this does not exist", which you turn
into an `Optional.empty()`. An empty `onStatus` handler does exactly that, and it
is honest because the caller's type says the value may be absent. What makes it
dangerous is doing it broadly: a builder-level handler that swallows all 4xx
turns a 403 caused by an expired credential into a `null` that surfaces as a
`NullPointerException` in business logic, with nothing in the logs connecting the
two. Swallow narrowly, at the call site, for one status, where the return type
admits absence.

**★ What is `UnknownHttpStatusCodeException` and when would you see it?**
It is the sibling of `HttpStatusCodeException` under `RestClientResponseException`,
used when the response carries a status code Spring's `HttpStatus` enum does not
know — a vendor-specific code, or something a proxy invented. It matters because
code that catches `HttpStatusCodeException` and believes it has covered "all HTTP
errors" has not: an unrecognised status escapes that catch entirely. If you are
writing a general error handler for a dependency you do not control, catch
`RestClientResponseException`, which is the common base for anything carrying
actual response data, and discriminate on `getStatusCode()` inside.

**★ Your logs show `404` and nothing else. What would you have wanted them to
show, and how do you get it?**
The URI template and the method, at minimum — "404 from `GET /pricing/{tier}`" is
diagnosable and "404" is not, especially in a service calling four dependencies.
The way to get it is the `onStatus` handler's signature: it receives both the
request and the response, so the exception you throw can carry
`request.getURI()`. Doing it there rather than at the catch site matters because
by the time the exception has propagated a few frames, the call it came from is no
longer obvious. The template rather than the expanded URI is the right thing to
log for the same reason it is the right metric tag — it aggregates, and it does
not put an identifier into every log line.

---

← Prev: [Deadlines](11-deadlines-not-timeouts.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Their failure is not your failure](13-their-failure-is-not-yours.md)
