---
title: "The client timer is the one that tells you whose fault it is"
sidebar_label: "16 · Observing calls"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework reference *Integration →
> Observability*, the HTTP Client section
> (docs.spring.io/spring-framework/reference/integration/observability.html), and
> the Spring Boot reference *Actuator → Metrics*, the HTTP client metrics section
> (docs.spring.io/spring-boot/reference/actuator/metrics.html). Spring Boot
> 4.1.0, Spring Framework 7.0.x, JDK 25.

**When your endpoint's p99 goes from 80 ms to 3 seconds, the server-side timer
tells you that it happened and nothing about why. The *client* timer tells you
which dependency, on which URI template, with which status — which is the
difference between an incident you can attribute in thirty seconds and one you
spend an hour bisecting. Spring emits it as the `http.client.requests`
observation, and it costs you nothing except two disciplines: take the
auto-configured builder, and always call `.uri()` with a template.**

## `http.client.requests`, and what has to be true for it to exist

Spring Framework instruments `RestTemplate`, `RestClient` and `WebClient` with an
observation named **`http.client.requests`**, measuring the entire exchange —
from connection establishment to body deserialisation.

🔴 **It only exists if an `ObservationRegistry` is configured on the client.** The
reference is blunt: without one, the observations are no-ops. Boot configures the
registry on the auto-configured `RestTemplateBuilder`, `RestClient.Builder` and
`WebClient.Builder`, which is the concrete, operational reason
[chunk 2](02-wiring-it-in-boot-4.md) insists you take the builder rather than
calling `RestClient.create()`. A statically created client is silent, and it is
silent in exactly the way that is hardest to notice: everything works, there is
simply no data.

For a client you must build by hand, Boot exposes customisers that apply the
instrumentation:

```java
@Service
public class LegacyGateway {

    LegacyGateway(ObservationRestClientCustomizer customizer) {
        RestClient.Builder builder = RestClient.builder();
        customizer.customize(builder);
        this.restClient = builder.baseUrl("https://legacy.internal").build();
    }
}
```

`ObservationRestTemplateCustomizer` and `ObservationWebClientCustomizer` are the
equivalents. Reaching for one of these is a signal, though: if you are applying
the observation customiser by hand you have probably also lost the timeouts, so
ask why you are not using the auto-configured builder.

## The tags, and the one that decides your metrics bill

The default convention is
`org.springframework.http.client.observation.ClientRequestObservationConvention`,
and the reference documents the keys:

| Key | Cardinality | Meaning |
|---|---|---|
| `method` | low | the HTTP method, or `none` if not a well-known one |
| `uri` | low | **the URI template**, or `none` if none was provided; scheme, host and port are excluded |
| `client.name` | low | derived from the request URI host |
| `status` | low | the raw status code, or `IO_ERROR` on an `IOException`, or `CLIENT_ERROR` if no response was received |
| `outcome` | low | the outcome of the exchange |
| `error` | low | the class name of the exception thrown, or `none` |
| `exception` | low, **deprecated** | duplicates `error`; may be removed |
| `http.url` | **high** | the full request URI |

Two of these repay a close reading.

🔴 **`uri` is the template, and `none` if you did not give one.** This is the
cardinality control, and it is the reason
[chunk 3](03-the-fluent-api.md) makes such a fuss about `.uri("/pets/{id}", id)`.
Concatenate the id into the string and there is no template, so the tag is either
`none` — collapsing every endpoint on that client into one useless series — or,
depending on the path taken, the literal URI, which gives you a distinct time
series per id. Neither is a dashboard; one is a bill.

🔴 **`status` has non-numeric values, and they are the important ones.**
`IO_ERROR` and `CLIENT_ERROR` are what a timeout or a refused connection produces,
because there was no response and therefore no status code. An alert written as
`status >= 500` misses every timeout — the same blind spot as catching
`HttpServerErrorException` and missing `ResourceAccessException`, in
[chunk 12](12-error-mapping.md). Alert on `outcome` or on the error tag, not on a
numeric comparison.

`client.name` comes from the request host, which is a good reason to give each
downstream service its own client with its own `baseUrl`: the dashboards separate
themselves.

## Customising, renaming, and when not to

The observation name can be changed:

```properties
management.observations.http.client.requests.name=http.outbound
```

⚠️ **Do not.** Dashboards, alerts and third-party integrations all key on the
default name, and renaming it is a migration with no benefit. The property exists
for people integrating with a pre-existing metrics taxonomy.

To add or change tags, declare a `ClientRequestObservationConvention` bean.
⚠️ **Two different types share that simple name** —
`org.springframework.http.client.observation.ClientRequestObservationConvention`
for `RestTemplate`/`RestClient` and
`org.springframework.web.reactive.function.client.ClientRequestObservationConvention`
for `WebClient` — so an import mistake produces a bean that silently applies to
the client you were not instrumenting.

Whatever you add, add it as **low cardinality only**. A tenant id, an order id or
a user id in a low-cardinality key is how a metrics backend falls over. If you
need per-request identifiers, they belong on the *trace*, not on the metric.

## Tracing and correlation: propagating context outward

A metric tells you which dependency was slow. A trace tells you which *request*
was slow and what it did before and after — and it only works if the trace
context leaves your process on the outbound call.

With Micrometer Tracing on the classpath, Boot's observation instrumentation
handles the propagation: the same `ObservationRegistry` that produces the timer
also injects the W3C `traceparent` header. So the same discipline buys both.
⚠️ **The exact propagation format and the bridge configuration are Micrometer
Tracing's, not Spring's, and I have not verified their configuration surface here
— check the Micrometer Tracing reference for the version you ship** rather than
assuming a header name.

Your own correlation id, if you have one distinct from the trace id, belongs on
an interceptor applied globally:

```java
@Bean
RestClientCustomizer correlationPropagation() {
    return builder -> builder.requestInitializer(request ->
            Optional.ofNullable(CorrelationContext.current())
                    .ifPresent(id -> request.getHeaders().add("X-Correlation-Id", id)));
}
```

A `requestInitializer` rather than an interceptor, for the reason
[chunk 2](02-wiring-it-in-boot-4.md) gives: it only prepares the request, so it
cannot accidentally swallow a response. Joining that id to the log line the
downstream service writes is what
[Correlation ids and logging](../09-error-handling/14-correlation-ids-and-logging.md)
is about.

## Logging outbound calls without regretting it

The temptation is to log every outbound request and response body. Resist it, for
three reasons that are all serious.

- **Volume.** Bodies are large and calls are frequent; a dependency's incident
  becomes a logging incident, and the lines you needed are unfindable inside the
  ones you did not.
- **Secrets.** Outbound requests carry `Authorization` headers, API keys and
  personal data. A body log is a data-protection question, not a debugging
  preference.
- **Consumption.** An interceptor that reads the body to log it must buffer it,
  which changes the streaming behaviour of the client and can hold a connection
  longer.

What to log per call, at `INFO` or below: the method, the **URI template**, the
status, the duration, and the correlation id. That is the same information as the
metric, per request, which is what you want when you are looking at one request
rather than at a distribution. Full bodies belong behind a `DEBUG` logger you can
switch on for one class, or behind sampling.

## Gotchas

**⚠️ A client with no metrics at all**
**Symptom:** one dependency is missing from every outbound dashboard, and nobody
notices until it is the one causing an incident.
**Cause:** the client was created with `RestClient.create()`, so no
`ObservationRegistry` was attached.
**Fix:** inject `RestClient.Builder`. An ArchUnit rule banning `RestClient.create`
outside configuration classes catches this at build time.

**⚠️ A `uri` tag of `none` on every series**
**Symptom:** one time series per client, with no way to tell which endpoint is
slow.
**Cause:** URLs built by string concatenation, so no template was recorded.
**Fix:** `.uri("/pets/{id}", id)`. For dynamic URLs, the `UriBuilder` form still
records a template.

**⚠️ Alerting on `status >= 500`**
**Symptom:** a dependency times out for twenty minutes and no alert fires.
**Cause:** a timeout produces `IO_ERROR` or `CLIENT_ERROR`, not a numeric status.
**Fix:** alert on `outcome`, or explicitly include the non-numeric values. This is
the single most common gap in outbound-call alerting.

**⚠️ Adding a high-cardinality tag to the metric**
**Symptom:** the metrics backend's ingestion cost jumps, or the metric is dropped
by a sampler.
**Cause:** a tenant, user or order identifier added as a low-cardinality key.
**Fix:** identifiers belong on the trace. Metrics answer "how often and how
slow", not "which one".

**⚠️ Importing the wrong `ClientRequestObservationConvention`**
**Symptom:** a custom convention bean has no effect.
**Cause:** two types share the name — one under `org.springframework.http.client.observation`
for the synchronous clients, one under
`org.springframework.web.reactive.function.client` for `WebClient`.
**Fix:** check the import against the client you are actually instrumenting.

## Interview questions

**★ What is `http.client.requests` and what has to be true for it to be
emitted?**
It is the observation Spring Framework records for every `RestTemplate`,
`RestClient` or `WebClient` exchange, covering connection establishment through
body deserialisation. The condition is that an `ObservationRegistry` is
configured on the client — the reference says that without one the observations
are no-ops. Boot configures it on the auto-configured builders, so in practice
the requirement is "you injected `RestClient.Builder` rather than calling
`RestClient.create()`". That is why the builder rule is not stylistic: a
hand-created client is invisible to your dashboards, and it is invisible
silently, which is the worst way for monitoring to be missing.

**★ Why does using a URI template matter for metrics, and what happens if you
do not?**
The `uri` tag is documented as the URI *template* used for the request, or `none`
if none was provided, with scheme, host and port excluded. That is the
cardinality control: with a template, every call to that endpoint aggregates into
one series named `/pets/{id}`, which is the row you want. Without one you get
either `none` — collapsing every endpoint on the client into a single
uninterpretable series — or a distinct series per identifier, which is a
cardinality explosion your metrics backend will either charge you for or defend
itself against by dropping the metric. Both outcomes cost you the dashboard, and
the fix is one character of syntax.

**★ You alert on outbound failures with `status >= 500`. What does that miss?**
Every timeout, every refused connection, and every DNS failure. The `status` tag
is documented as the raw status code *or* `IO_ERROR` when an `IOException`
occurs, *or* `CLIENT_ERROR` when no response was received — because in those
cases there is no status code to report. So the alert covers the case where the
dependency answered badly and misses the case where it did not answer at all,
which is the more common and more damaging failure. Alert on `outcome`, or on the
`error` tag, or include the non-numeric statuses explicitly.

**★ Your latency is up and the dependency insists it is healthy. How do you
settle it?**
By comparing the two timers, which measure different intervals. Their server-side
timer starts when their process receives the request; your client timer starts
before DNS, connection acquisition and the network, and includes any wait for a
pooled connection. So a dependency can be genuinely healthy by its own
measurement while your calls to it are slow, and the gap between the two is the
evidence: if their p99 is flat and yours is not, the time is being spent in the
network or in your own connection pool, and the pool metrics — leased, pending,
available — will say which. This is the concrete reason to have the client timer
at all rather than trusting the provider's dashboard.

**★ Where should a tenant id go — a metric tag or a trace?**
The trace. Metrics are aggregates whose cost is proportional to the number of tag
combinations, so a tenant id as a low-cardinality key multiplies every series by
the tenant count and will either blow up ingestion cost or get the metric
dropped. Traces are per-request records that carry arbitrary attributes by
design, and they are also where a tenant id is actually useful — you look at a
tenant id when investigating one request, not when reading a latency
distribution. The general rule is that metrics answer "how often and how slow",
and traces and logs answer "which one".

**★ What is the risk in logging outbound request and response bodies?**
Three risks, and all of them are realised eventually. Volume: bodies are large
and calls are frequent, so a dependency's bad hour becomes a logging incident and
the lines you needed are buried. Secrets: outbound requests carry `Authorization`
headers, API keys and personal data, which turns a debugging convenience into a
data-protection finding. And consumption: an interceptor that reads a streamed
body in order to log it has to buffer it, which changes the client's memory
profile and can hold a pooled connection longer than it should. Log the method,
the URI template, the status, the duration and the correlation id by default, and
keep bodies behind a `DEBUG` logger or sampling.

**★ How does trace context get onto an outbound call?**
Through the same observation instrumentation that produces the metric: with
Micrometer Tracing on the classpath, the registry configured on the
auto-configured builder also injects the W3C trace headers on the outbound
request, so the downstream service's spans join yours. It is worth saying plainly
that this is another consequence of the builder rule — a hand-created client
neither reports a timer nor propagates context, so it appears in the trace as a
gap where a span should be. If you need your own correlation id in addition, a
`requestInitializer` applied through a global `RestClientCustomizer` is the right
shape, because an initializer prepares the request and cannot accidentally
interfere with the response.

---

← Prev: [Retrying safely](15-retrying-safely.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Testing outbound calls](17-testing-outbound-calls.md)
