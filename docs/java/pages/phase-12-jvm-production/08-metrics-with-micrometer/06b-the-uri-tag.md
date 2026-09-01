---
title: "The uri tag is the one dimension Spring normalises for you, the rule it uses has four documented fallbacks you should be able to recite, and on the client side the same tag is yours to get right and there are two distinct ways to get it wrong"
sidebar_label: "06b · The URI tag"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Spring Framework 7 reference · Integration · Observability**
> — *HTTP Server instrumentation* and *HTTP Client instrumentation*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/observability.html)),
> the **Micrometer 1.17 reference · Concepts · Naming Meters · Tag Values**
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/naming.html)),
> the **Spring Boot 4.1 production-ready reference · Metrics**
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)), and the
> **Spring Boot 4.1.0 sources** at tag `v4.1.0` —
> [`WebMvcObservationAutoConfiguration`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-webmvc/src/main/java/org/springframework/boot/webmvc/autoconfigure/WebMvcObservationAutoConfiguration.java)
> and
> [`MetricsProperties`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-micrometer-metrics/src/main/java/org/springframework/boot/micrometer/metrics/autoconfigure/MetricsProperties.java).
> No JVM was run for this page. JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8 ·
> Micrometer 1.17.0.

**Micrometer names the URI tag as the canonical sneaky cardinality bomb, and then Spring defuses it
— on the server side, and only on the server side. Knowing the exact rule matters because its
fallbacks are what you see on a dashboard when something is wrong, and knowing that the client side
has no equivalent protection matters because that is where you will actually blow it up.**

## The threat, in Micrometer's words

> *"Beware of the potential for tag values coming from user-supplied sources to blow up the
> cardinality of a metric. … Sometimes, the cause is sneaky. Consider the URI tag for recording
> HTTP requests on service endpoints. If we do not constrain 404's to a value like `NOT_FOUND`, the
> dimensionality of the metric would grow with each resource that cannot be found."*

The reason this specific example is chosen is that the tag looks bounded. You have forty
endpoints. But a request that matches no handler has no endpoint to name, and the paths that match
no handler are chosen by whoever is scanning your service.

## The server-side rule, verbatim

Spring Framework's `DefaultServerRequestObservationConvention` produces this low-cardinality key:

> ***uri** (required): URI pattern for the matching handler if available, falling back to
> `REDIRECTION` for 3xx responses, `NOT_FOUND` for 404 responses, `root` for requests with no path
> info, and `UNKNOWN` for all other requests."*

Four fallbacks, in that order. Learn them as *dashboard vocabulary*, because each one tells you
something specific when it appears:

| Value you see | What it means |
|---|---|
| `/orders/{id}` | normal: a handler matched and its mapping pattern is the tag |
| `NOT_FOUND` | 404s, all collapsed into one series — the bomb, defused |
| `REDIRECTION` | any 3xx, collapsed. A spike here is usually an auth redirect loop |
| `root` | a request with no path info |
| `UNKNOWN` | ⚠️ **a request was handled but no pattern was available** |

🔴 **`UNKNOWN` is a bug report.** It means the request produced neither a matched pattern nor one
of the other fallbacks — most often because it was served outside the handler-mapping machinery, or
because a handler was registered in a way that carries no pattern. A `uri="UNKNOWN"` series with
real traffic in it is a piece of your service you cannot see per-endpoint.

The full low-cardinality set for `http.server.requests` is `error`, `exception` (deprecated and
*"duplicates the `error` key and might be removed in the future"*), `method`, `outcome`, `status`
and `uri`. The high-cardinality set is one key:

> ***http.url** (required): HTTP request URI."*

That is the whole design in two lines. The **raw** URI is not thrown away — it goes to the trace,
where storage is per span. Only the *metric* gets the bounded projection.
[04a · Common tags](04a-common-tags.md) has the routing rule; **Topic 09 · Distributed
tracing** *(not written yet)* is where `http.url` lands.

## And a cap underneath it

Boot 4.1 registers a filter bounding the `uri` tag at 100 distinct values by default
(`management.metrics.web.server.max-uri-tags`, and a separate one for the client). The
belt-and-braces design is deliberate: normalisation handles the expected case, the cap handles the
one you did not anticipate. Mechanics, semantics and the once-only warning are
[04d · Capping cardinality](04d-capping-cardinality.md).

## The client tag is a different problem entirely

`http.client.requests` also carries a `uri` tag, and it is defined completely differently: there is
no pattern matcher on the client, so the "template" is whatever string you passed. That produces
two failure modes that fail in opposite directions — one explodes and one collapses — and both are
[06c · The client URI tag](06c-the-client-uri-tag.md).

## Where the server-side tag still goes wrong

**Functional endpoints without a pattern.** `RouterFunction` routes built from predicates that are
not simple path patterns may not expose a pattern to the convention, which surfaces as `UNKNOWN`.

**Anything served below the observation filter.** Boot registers `ServerHttpObservationFilter` at
`Ordered.HIGHEST_PRECEDENCE + 1` for `DispatcherType.REQUEST` and `DispatcherType.ASYNC` — but the
framework is explicit about the limit:

> *"Because the instrumentation is done at the Servlet Filter level, the observation scope only
> covers the filters ordered after this one as well as the handling of the request. Typically,
> Servlet container error handling is performed at a lower level and won't have any active
> observation or span. For this use case, a container-specific implementation is required, such as
> a `org.apache.catalina.Valve` for Tomcat; this is outside the scope of this project."*

So a request rejected by the container — a malformed request line, a header size violation, a
filter ordered before the observation filter — produces no `http.server.requests` sample at all.
Not a wrong tag: **no metric**. If your access log shows 400s that your metrics do not, this is
why.

**Handled exceptions are not errors.** Also explicit:

> *"This will only record an observation as an error if the Exception has not been handled by the
> web framework and has bubbled up to the Servlet filter. Typically, all exceptions handled by
> Spring MVC's `@ExceptionHandler` and `ProblemDetail` support will not be recorded with the
> observation."*

The documented opt-in:

```java
@ExceptionHandler(MissingUserException.class)
ResponseEntity<Void> handleMissingUser(HttpServletRequest request, MissingUserException exception) {
    ServerHttpObservationFilter.findObservationContext(request)
            .ifPresent(context -> context.setError(exception));
    return ResponseEntity.notFound().build();
}
```

Without that call, a well-behaved service with an exception handler for everything reports
`error="none"` on every request it failed.

## Changing the tags

To add to the defaults, extend the convention; to replace them, implement it:

```java
public class ExtendedServerRequestObservationConvention
        extends DefaultServerRequestObservationConvention {

    @Override
    public KeyValues getLowCardinalityKeyValues(ServerRequestObservationContext context) {
        return super.getLowCardinalityKeyValues(context).and(custom(context));
    }

    private KeyValue custom(ServerRequestObservationContext context) {
        return KeyValue.of("custom.method", context.getCarrier().getMethod());
    }
}
```

> *"To add to the default tags, provide a `@Bean` that extends
> `DefaultServerRequestObservationConvention` from the `org.springframework.http.server.observation`
> package. To replace the default tags, provide a `@Bean` that implements
> `ServerRequestObservationConvention`."*

⚠️ **Replacing rather than extending is how the URI normalisation gets lost.** A custom convention
that builds its own `uri` key from `request.getRequestURI()` reintroduces exactly the bomb the
default was written to defuse, and it will pass every test.

There is also an OpenTelemetry-flavoured alternative:
`OpenTelemetryServerRequestObservationConvention`, which *"complies with the OpenTelemetry Semantic
Conventions for HTTP Metrics (v1.36.0) and the OpenTelemetry Semantic Conventions for HTTP Spans
(v1.36.0)"* and names the observation `http.server.request.duration` rather than
`http.server.requests`. Choosing it changes your metric *names*, so it is a migration, not a
setting.

## Gotchas

**★ `uri="UNKNOWN"` with real traffic is a hole in your per-endpoint visibility.** It means a
request was measured but no handler pattern was available. Find what is serving it before you
tune anything else.

**★ Requests rejected below the filter produce no metric at all.** The observation is a Servlet
filter; container-level error handling happens beneath it. Access-log 400s with no matching metric
series is the signature, and the framework says a Tomcat `Valve` is the only fix and is out of
scope for Spring.

**★ Exceptions handled by `@ExceptionHandler` are not recorded as observation errors.** A service
with tidy exception handling reports `error="none"` universally. `ServerHttpObservationFilter
.findObservationContext(request).ifPresent(c -> c.setError(e))` is the documented opt-in and has to
be added per handler.

**★ The `exception` key is deprecated in favour of `error`.** *"Duplicates the `error` key and
might be removed in the future."* New queries and alerts should use `error`.

**★ Replacing the observation convention instead of extending it discards the URI normalisation.**
And every other default key. Extend unless you specifically intend to replace all of them.

**★ Switching to the OpenTelemetry convention renames the metric.** `http.server.requests` becomes
`http.server.request.duration`. Every dashboard, alert and recording rule referencing the old name
stops working, and the two never coexist for a given handler.

**★ Renaming the observation with `management.observations.http.server.requests.name` also moves
Boot's URI cap.** The cap filter takes its meter-name prefix from the same property, so the two
stay in sync — but any `MeterFilter` of your own that hard-codes `"http.server.requests"` will
silently stop matching.

## Interview questions

**★ What exactly is in the `uri` tag of `http.server.requests`, and what are the fallbacks?**
The URI pattern of the matching handler — `/orders/{id}`, not `/orders/8134`. When no pattern is
available it falls back, in order, to `REDIRECTION` for 3xx responses, `NOT_FOUND` for 404s, `root`
for a request with no path info, and `UNKNOWN` for everything else. The `NOT_FOUND` fallback is the
important one: it is what stops an internet scanner from creating a time series per non-existent
path, which is Micrometer's own worked example of a cardinality bomb.

**★ Your `http.server.requests` metric has a large `uri="UNKNOWN"` series. Is that a problem?**
Yes. `UNKNOWN` is the last fallback and means the request was measured but no handler pattern was
available — typically something served outside the normal handler-mapping path, or a functional
route whose predicate exposes no pattern. Everything in that bucket is invisible to per-endpoint
RED: you cannot tell which of those requests is slow or failing, and if the bucket is large it can
dominate the service-level percentile.

**★ Why does the raw URI still get recorded, and where?**
As `http.url`, the single high-cardinality key on the observation, which is contributed to traces
only. That is the whole point of the low/high cardinality distinction: the metric gets a bounded
projection so it stays cheap, and the trace gets the exact URI because a tracing backend charges per
span rather than per distinct value. When a metric shows one endpoint's p99 has moved, the trace is
where you find which specific URLs were slow.

**★ Your access log shows 400 responses that never appear in `http_server_requests`. Explain.**
The instrumentation is a Servlet filter registered near the top of the chain, and Spring documents
that the observation scope covers only filters ordered after it plus the request handling itself.
Container-level error handling — a malformed request line, an over-long header, a rejection by an
earlier filter — happens below that point, so there is no active observation and no sample is
recorded. The framework's own note says a container-specific mechanism such as a Tomcat `Valve`
would be required and is out of scope, so the honest answer is that those requests are visible in
the access log and in the load balancer, not in application metrics.

**★ Why might a service with a good `@ExceptionHandler` for everything report zero errors?**
Because the observation records an error only when the exception bubbles up to the Servlet filter,
and exceptions handled by `@ExceptionHandler` or `ProblemDetail` support do not. The `status` tag
still reflects the response code, so a 500 returned from a handler is visible as a status, but the
`error` key stays `none`. Spring documents the opt-in — call
`ServerHttpObservationFilter.findObservationContext(request)` and set the error on the context —
and it has to be added in each handler where you want it.

**★ When would you write a custom `ServerRequestObservationConvention`, and what is the risk?**
When you need an extra low-cardinality dimension the defaults do not provide — an API version, a
tenant class, a client tier — and you want it on every request without touching controllers. The
risk is choosing the *replace* form rather than the *extend* form: implementing
`ServerRequestObservationConvention` from scratch drops every default key, including the normalised
`uri`. A convention that rebuilds `uri` from `getRequestURI()` reintroduces the exact cardinality
bomb the default exists to prevent, and no test will catch it because tests hit a handful of paths.

{/* FOOTER */}
