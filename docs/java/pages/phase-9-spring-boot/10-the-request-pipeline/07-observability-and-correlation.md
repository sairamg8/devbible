---
title: "The observability you already have"
sidebar_label: "7 · Observability"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework 7.0 reference *Integration →
> Observability Support*
> (docs.spring.io/spring-framework/reference/integration/observability.html —
> `ServerHttpObservationFilter`, `DefaultServerRequestObservationConvention`,
> `ServerRequestObservationContext`, the `http.server.requests` key values and
> the handled-exception limitation), the Spring Boot 4.1 reference *Actuator →
> Metrics* (`management.observations.http.server.requests.name`, the URI-template
> tag) and *Actuator → Tracing* (`logging.pattern.correlation`,
> `management.tracing.sampling.probability`, the baggage properties). Spring Boot
> 4.1.0, Spring Framework 7.0.x, JDK 25.

**Timing filters and correlation-ID filters are the two things developers write
most often at this layer, and both are already in the chain, done better than a
hand-rolled version will be. The built-in one is a filter — the same mechanism
from [chunk 2](02-filters.md), placed where it can see requests that never reach
a handler — but it is fed by the layers below it, which is how a metric ends up
tagged with the URI *pattern* a filter could not have known. Understanding that
split is what lets you extend it instead of replacing it.**

## `ServerHttpObservationFilter` and `http.server.requests`

The Framework reference states the requirement directly: "Applications need to
configure the `org.springframework.web.filter.ServerHttpObservationFilter`
Servlet filter in their application" — and in a Boot application that is done for
you. It creates one observation per HTTP exchange, named **`http.server.requests`**,
using `DefaultServerRequestObservationConvention` backed by a
`ServerRequestObservationContext`.

The low-cardinality key values — the ones that become metric tags — are:

| Key | What it holds |
|---|---|
| `error` | class name of the exception thrown during the exchange, or `"none"` |
| `exception` | **deprecated**; duplicates `error` and may be removed |
| `method` | the HTTP method name, or `"none"` if not a well-known method |
| `outcome` | the outcome of the exchange |
| `status` | the raw response status code, or `"UNKNOWN"` if no response was created |
| `uri` | the URI **pattern** for the matching handler, if available |

`http.url` — the actual request URI — is carried as a *high*-cardinality key
value, so it reaches a trace backend but never becomes a metric dimension.

The `uri` fallback rules are the interesting part, and they are the reason this
metric is safe to leave on. Where no handler pattern is available it falls back to
`REDIRECTION` for 3xx responses, `NOT_FOUND` for 404s, `root` for requests with no
path info, and `UNKNOWN` for everything else. A scanner probing ten thousand
random paths therefore contributes to one `NOT_FOUND` series rather than creating
ten thousand of them. A hand-written filter that tags by `request.getRequestURI()`
does the opposite, and the failure mode is a metrics bill and a storage outage
rather than a compile error.

Note what that implies about layering: a filter alone cannot know the URI pattern,
because patterns are resolved by `HandlerMapping`, which runs later. The filter
opens the observation on the way in and the framework enriches its context on the
way out. That is a cooperation you get by using the built-in filter and lose the
moment you write your own.

## The trap: handled exceptions are not errors

This is the one thing about the built-in observation that surprises everybody,
and the reference is explicit:

> This will only record an observation as an error if the `Exception` has not been
> handled by the web framework and has bubbled up to the Servlet filter.
> Typically, all exceptions handled by Spring MVC's `@ExceptionHandler` and
> `ProblemDetail` support will not be recorded with the observation.

So the better your error handling, the emptier your `error` tag. An API that maps
every failure through `@ControllerAdvice` — which is what
**[Topic 09 — Error handling](../09-error-handling/README.md)** argues for — reports
`error=none` on every single one of them. The `status` tag is still accurate, so
you can alert on 5xx; what you cannot do is group by exception type.

If you want that grouping, set the error on the observation context yourself,
from the handler:

```java
@RestControllerAdvice
class ApiExceptionHandler {

    @ExceptionHandler(PaymentDeclinedException.class)
    ProblemDetail declined(PaymentDeclinedException ex, HttpServletRequest request) {
        ServerHttpObservationFilter.findObservationContext(request)
                .ifPresent(context -> context.setError(ex));

        var problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.PAYMENT_REQUIRED, ex.getMessage());
        problem.setType(URI.create("https://example.com/problems/payment-declined"));
        return problem;
    }
}
```

`findObservationContext` returns an `Optional`, and the `ifPresent` is not
politeness — the context is absent when the filter did not run for this request,
which is exactly the case in a slice test or when the exception came from
somewhere the observation never covered.

⚠️ **Do this selectively.** `error` is a low-cardinality tag, so setting it for
every exception type your application can produce turns a bounded dimension into
an unbounded one if any of those types are generated dynamically. Set it for the
handful of failures you actually want to alert on separately.

## Customising rather than replacing

Two supported extension points, in order of preference:

- **Change the convention.** Publish your own
  `ServerRequestObservationConvention` bean to add or rename key values; the
  default is `DefaultServerRequestObservationConvention` and yours can extend it.
- **Change the filter registration.** The Boot reference's instruction is to
  "provide a `@Bean` that implements
  `FilterRegistrationBean<ServerHttpObservationFilter>`" — that is how you narrow
  which requests are observed, since by default "all requests are handled".

The observation name itself is a property:
`management.observations.http.server.requests.name`.

Neither of these is "write a filter". If you find yourself starting from
`OncePerRequestFilter` for a metric, you have chosen to reimplement a component
whose hardest problem — cardinality — is already solved.

## Correlation without writing a filter

With Micrometer Tracing and a bridge on the classpath — OpenTelemetry with OTLP,
or OpenZipkin Brave with Zipkin — Boot wires the rest:

- **`traceId` and `spanId` land in the MDC** and are formatted into log lines.
  The pattern is `logging.pattern.correlation`, so a service name can be folded
  in:

  ```properties
  logging.pattern.correlation=[${spring.application.name:},%X{traceId:-},%X{spanId:-}]
  logging.include-application-name=false
  management.tracing.sampling.probability=1.0
  ```

  `%X{traceId:-}` is an MDC lookup with an empty default, which is what keeps the
  pattern from printing a literal placeholder on log lines produced outside a
  trace.

- **Context propagates outbound automatically** through the auto-configured
  `RestClient.Builder` and `WebClient.Builder`. ⚠️ *Auto-configured* is
  load-bearing: a `RestClient` you build with `RestClient.create()` is not
  instrumented, and the trace stops at your service boundary. This is one of the
  arguments for injecting the builder rather than constructing clients, made at
  length in **[Topic 12 — Outbound HTTP](../12-outbound-http/README.md)**.

- **Sampling is `management.tracing.sampling.probability`**, defaulting to 10%.
  Turning it to `1.0` in development is standard; leaving it at `1.0` in
  production is a cost decision, not a technical one. ⚠️ Sampling affects the
  *trace backend*, not the MDC: an unsampled request still gets a `traceId` in its
  logs, which is why log correlation keeps working at 10% sampling.

- **Business keys travel as baggage.** `management.tracing.baggage.remote-fields`
  lists the fields propagated over the network;
  `management.tracing.baggage.correlation.fields` lists the ones copied into the
  MDC so they appear in logs. That is the correct home for a tenant ID or an
  order number — not a hand-written header filter, and definitely not a metric
  tag.

The one honest reason left to write your own correlation filter is a fixed
inbound header from a system you do not control that must be preserved verbatim.
Even then, prefer mapping it into baggage over maintaining a parallel identifier.

## Gotchas

**⚠️ A hand-written timing filter alongside the built-in observation**
**Symptom:** two metrics for the same request that never agree, and one of them
grows a tag per unique URL.
**Cause:** the hand-written filter measures a different span of the pipeline and
tags by raw path.
**Fix:** delete it; customise the convention if the built-in tags are wrong.

**⚠️ `error=none` on a dashboard full of 500s**
**Symptom:** the error dimension says nothing is failing while `status` says
otherwise.
**Cause:** every exception is handled by `@ExceptionHandler`, so none bubbles up
to the filter.
**Fix:** `ServerHttpObservationFilter.findObservationContext(request)` plus
`setError(ex)` in the handler, as shown above.

**⚠️ Setting a dynamic value on the `error` key**
**Symptom:** metric cardinality climbs steadily and never plateaus.
**Cause:** `error` is a low-cardinality key value; it holds a class name for a
reason.
**Fix:** set it only for a bounded set of exception types.

**⚠️ Traces that stop at your service boundary**
**Symptom:** the caller's span exists, the downstream service's does not.
**Cause:** the HTTP client was constructed directly rather than from the
auto-configured builder, so it carries no propagation.
**Fix:** inject `RestClient.Builder` and build from it.

**⚠️ A hand-rolled correlation ID next to `traceId`**
**Symptom:** two identifiers in the logs; the one in the logs is not the one in
the trace backend.
**Cause:** the filter was written before anyone checked what Boot already does.
**Fix:** `logging.pattern.correlation` for the format, baggage for business keys.

## Interview questions

**★ Why is the `uri` tag on `http.server.requests` a pattern rather than the real path?**
Cardinality. Every distinct tag value is a separate time series, so tagging by the
real path gives one series per order ID and an unbounded metric — which is how
monitoring systems get taken down by a scanner. The convention uses the matching
handler's URI pattern where one exists and falls back to `REDIRECTION`,
`NOT_FOUND`, `root` or `UNKNOWN` where none does, bounding the tag by the number
of endpoints you have. The full URL survives as the high-cardinality key
`http.url`, which reaches traces but not metrics.

**★ My dashboard shows 5xx responses but the `error` tag is always `none`. Explain it.**
The observation records an error only when the exception "has not been handled by
the web framework and has bubbled up to the Servlet filter". A well-built API
handles everything in `@ExceptionHandler` and returns a `ProblemDetail`, so from
the filter's vantage point the request completed with a 5xx status and no
exception. It is not a bug; it is the direct consequence of the filter being
outside the handler. If you want the grouping, call
`ServerHttpObservationFilter.findObservationContext(request)` and `setError` in
the handler — for a chosen few exception types, not all of them.

**★ How can a *filter* produce a metric tagged with the URI pattern, when patterns are resolved later?**
It does not do it alone. The filter opens the observation on the way in, and the
observation *context* is enriched as the request proceeds, so by the time the
observation is stopped the handler's pattern is available. That cooperation is
built into `ServerRequestObservationContext` and the default convention. It is
also the single strongest argument against writing your own timing filter: a
standalone filter genuinely cannot know the pattern.

**★ You need one extra tag on HTTP server metrics. What do you do?**
Publish a `ServerRequestObservationConvention` bean, typically extending
`DefaultServerRequestObservationConvention`, and add the key value there. That
keeps every existing tag, the cardinality-safe `uri` handling and the error
semantics. Writing a parallel filter would duplicate the timing and lose all
three.

**★ What does `management.tracing.sampling.probability` actually affect?**
What is exported to the trace backend, not what is recorded locally. It defaults
to 10%. An unsampled request still gets a `traceId` and `spanId` in its MDC, so
log correlation continues to work for every request even though only a tenth of
the traces are stored. People often raise it to `1.0` believing their logs are
missing IDs, when the missing thing was only the trace.

**★ Where should a tenant ID live so it appears in logs and reaches the next service?**
Baggage. `management.tracing.baggage.remote-fields` propagates it over the wire
and `management.tracing.baggage.correlation.fields` copies it into the MDC so it
shows up in log lines. That gets you both halves with configuration rather than a
filter, and it stays consistent with the trace context instead of running beside
it. It should not become a metric tag — tenant count is exactly the sort of
unbounded dimension that ruins a time-series database.

**★ Why does propagation stop when a team switches from an injected `RestClient.Builder` to `RestClient.create()`?**
Because the instrumentation lives on the auto-configured builder, not on the
`RestClient` type. Boot customises that builder to attach the observation and
propagation machinery; a client created from scratch has none of it, so the
outbound request carries no trace headers and the downstream service starts a new
trace. The symptom is a trace that ends at your service with no error anywhere.

---

← Prev: [What Spring already gives you](06-what-spring-gives-you.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Registration and ordering](08-registration-and-ordering.md)
