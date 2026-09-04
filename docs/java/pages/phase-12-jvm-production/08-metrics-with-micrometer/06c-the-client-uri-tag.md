---
title: "On the client there is no handler pattern to normalise anything, so the uri tag is literally the string you passed — which means you can explode it with a plus sign or erase it with a java.net.URI, and only one of those two mistakes is loud"
sidebar_label: "06c · The client URI tag"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Spring Framework 7 reference · Integration · Observability**
> — *HTTP Client instrumentation* (`RestTemplate`, `RestClient`, `WebClient` key tables)
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/observability.html)),
> the **Spring Boot 4.1 production-ready reference · Metrics — HTTP Client Metrics** and
> *Actuator · Tracing*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)), and the
> **Spring Boot 4.1.1 sources** at tag `v4.1.0` —
> [`MetricsProperties`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-micrometer-metrics/src/main/java/org/springframework/boot/micrometer/metrics/autoconfigure/MetricsProperties.java)
> for the `max-uri-tags` default. No JVM was run for this page. JDK 25 · Spring Boot 4.1.1 /
> Spring Framework 7.0.9 · Micrometer 1.17.0.

**[06b](06b-the-uri-tag.md) showed that Spring normalises the server-side URI tag for you with a
documented four-step fallback. None of that machinery exists on the client, because there is no
handler mapping to consult. The tag is the template string you supplied, which makes outbound
instrumentation the one place in a Spring Boot service where the classic cardinality bomb is still
fully armed — and where the *opposite* mistake is quieter and more common.**

## The client side has no such protection

`http.client.requests` carries a `uri` tag too, and its definition is completely different:

> ***uri** (required): URI template used for HTTP request, or `none` if none was provided. The
> protocol, host and port part of the URI are not considered."*

There is no pattern matcher on the client. **The template is whatever string you passed.** Two
consequences follow directly from that sentence, and they fail in opposite directions.

```java
// RIGHT — the template is "/orders/{id}", one series regardless of traffic
String body = restClient.get()
    .uri("/orders/{id}", orderId)
    .retrieve()
    .body(String.class);

// WRONG (explodes) — the "template" is "/orders/8134", one series per order
String body = restClient.get()
    .uri("/orders/" + orderId)
    .retrieve()
    .body(String.class);

// WRONG (collapses) — no template was provided, so uri="none"
String body = restClient.get()
    .uri(URI.create("https://svc/orders/" + orderId))
    .retrieve()
    .body(String.class);
```

*(The three outcomes are what the quoted definition entails; the middle and last cases are
inference from "URI template used for HTTP request, or `none` if none was provided", not separate
quotations.)*

The middle case is the cardinality bomb and it is contained by
`management.metrics.web.client.max-uri-tags` — which is to say, contained by *losing metrics for
every call after the hundredth distinct order id*. The last case is quieter and arguably worse:
every outbound call to that service collapses into `uri="none"`, so you keep the metric and lose the
ability to say which endpoint is slow. You have no per-endpoint client RED
([05](05-red-and-use.md)) at all, and nothing warns you.

The other client keys are worth knowing because one of them is also a cardinality question:
`client.name` is *"derived from the request URI host"*, `status` is the raw code *"or `IO_ERROR` in
case of `IOException`, or `CLIENT_ERROR` if no response was received"*, plus `method`, `outcome` and
`error`. A `status="IO_ERROR"` series is a connection-level failure, not an HTTP one — a genuinely
useful distinction that most hand-rolled client instrumentation loses.


## The instrumentation only exists if you used the builder

Everything above assumes the client is instrumented at all, and that is a separate condition:

> *"Spring Boot Actuator manages the instrumentation of `RestTemplate`, `WebClient` and
> `RestClient`. For that, you have to inject the auto-configured builder and use it to create
> instances."*

The framework states the underlying requirement in its own terms — *"Applications must configure an
`ObservationRegistry` on `RestTemplate` instances to enable the instrumentation; without that,
observations are 'no-ops'"* — and Boot's builders are what set it.

```java
@Bean
RestClient paymentsClient(RestClient.Builder builder) {     // instrumented
    return builder.baseUrl("https://payments.internal").build();
}
```

The same builder carries trace propagation, so an uninstrumented client costs you the metric and
the trace together — Boot's tracing chapter puts it in an admonition: *"If you create the
`RestTemplate`, the `RestClient` or the `WebClient` without using the auto-configured builders,
automatic trace propagation won't work!"*

Order of diagnosis, when an outbound call has no metrics: **is it instrumented at all**
(`uri` tag absent entirely, no series for that `client.name`), then **is the template right**
(`uri="none"`, or a series per id).

## Both failure modes, and how to spot each one

| Symptom on the dashboard | Cause | Fix |
|---|---|---|
| No `http.client.requests` series at all for a downstream | client not built from the auto-configured builder | inject `RestClient.Builder` |
| Hundreds of `uri` values that look like real paths with ids in them | a variable was concatenated into the URI string | pass it as a URI variable |
| Exactly one series, `uri="none"`, covering every call to a service | a fully-built `java.net.URI` was passed | use the template overload |
| A single warning about reaching the maximum number of `uri` tags, then flat data | Boot's client cap engaged at 100 values | fix the template; the cap is a backstop |
| `status="IO_ERROR"` series appearing | connection-level failures, no HTTP response | a network or pool problem, not a 5xx |

The third row is the one worth memorising, because it is invisible by every normal check. A single
low-cardinality series looks like a *well-behaved* metric. Nothing is denied, no cap engages, no
warning is logged, and the dashboard shows a clean line — for a service where you have lost the
ability to distinguish a 3 ms token lookup from a 4-second report call.

## Why the fix is a code change and not a filter

The `MeterFilter` remedies from [04c](04c-meterfilter.md) can drop or fold a tag, but they cannot
*recover* a template that was never provided. `replaceTagValues` could collapse
`/orders/8134`-style values into something bounded with a regex, which stops the bleeding, but it
cannot turn `uri="none"` back into `/orders/{id}` because the information was discarded before the
observation was created. Client-side URI tagging is one of the few cardinality problems where the
central emergency lever is strictly weaker than the call-site fix.

## Gotchas


**★ On the client, string-concatenating an id into `uri(...)` makes the id the template.** There is
no pattern matcher on the client side to save you, only the 100-value cap — which saves your
backend by discarding your metrics.

**★ On the client, passing a fully-built `URI` yields `uri="none"`.** Every call to that service
collapses into one series. You keep a metric and lose the ability to tell which endpoint is slow,
and nothing warns you because a single low-cardinality series looks healthy.

**★ `client.name` is derived from the request host, so a dynamic host is a dynamic tag.** Calling
per-tenant hostnames, or a service whose DNS name embeds a shard, puts that cardinality directly
into your client metrics.

**★ `status="IO_ERROR"` and `status="CLIENT_ERROR"` are not HTTP statuses.** They mean an
`IOException` occurred and no response was received respectively. Dashboards that parse `status` as
a number silently drop these — which are exactly the failures you most want to see.


**★ An uninstrumented client is silent in three places at once.** No `http.client.requests`
series, no `traceparent` on the outgoing request, and no error anywhere. The single highest-yield
audit in a Spring codebase is grepping for `new RestTemplate(`, `RestClient.create(` and
`WebClient.create(`.

**★ `uri="none"` passes every review because one series looks healthy.** There is no cap warning,
no denial and no gap in the data. The only way to notice is to look at the `uri` values for a
downstream you know has several endpoints and find that there is one.

**★ A `MeterFilter` cannot repair a missing template.** Filters see a `Meter.Id` after the
observation has produced its key values; the URI template was already discarded. `replaceTagValues`
can bound an exploded tag, but nothing can un-collapse `none`.

**★ Boot's client cap is a separate property from the server one.**
`management.metrics.web.client.max-uri-tags`, also defaulting to 100. Raising the server one during
an incident does nothing for outbound calls.

**★ Every downstream service is a separate cardinality budget in your process, not theirs.** Ten
downstreams each with fifteen endpoints is 150 `uri` values on one meter name, before `method`,
`status` and `outcome` multiply it.

## Interview questions


**★ On the client side, what are the two ways to get the `uri` tag wrong, and which is worse?**
Concatenating a variable into the URI string, which makes the concatenated path the "template" and
gives you one series per value; and passing a fully-constructed `java.net.URI`, which provides no
template at all and yields `uri="none"`. The first is loud — it trips Boot's 100-value client cap,
which then discards metrics for new values, and someone eventually notices missing data. The second
is silent and arguably worse: you keep a healthy-looking metric with a single series, and you have
permanently lost per-endpoint visibility for that downstream.


**★ Why can't a `MeterFilter` fix a client `uri` tag that reads `none`?**
Because a filter operates on a `Meter.Id` — a name and a set of tags — at registration time, long
after the observation convention decided what the `uri` key would be. The template was never
supplied to the client, so the information does not exist anywhere in the pipeline for a filter to
recover. Filters can bound an exploded tag by folding values together, which is a lossy operation
in the safe direction, but there is no operation that invents a dimension that was discarded at the
call site. This is why client URI tagging is taught as a code-review rule rather than as a
configuration lever.

**★ You inherit a service and want to know in five minutes whether its outbound metrics are
trustworthy. What do you do?**
Two checks. Grep for `new RestTemplate(`, `RestClient.create(` and `WebClient.create(` — every hit
is a client with no metrics and no trace propagation. Then list the distinct `uri` values on
`http.client.requests` per `client.name` and compare against what you know each downstream exposes:
one value means a `java.net.URI` was passed somewhere and you have lost per-endpoint visibility;
dozens of values containing digits means an identifier was concatenated in and the 100-value cap is
either engaged or about to be.

**★ What does `status="IO_ERROR"` mean on a client metric, and why does it matter that it is not a
number?**
It means an `IOException` occurred and no HTTP response was received at all — a connection reset, a
DNS failure, a read timeout at the socket layer — as distinct from `CLIENT_ERROR`, which means no
response was received for some other reason. It matters that it is not numeric because dashboards
and alerts routinely filter `status` with numeric comparisons or regexes like `5..`, which silently
exclude exactly the failures where the downstream never answered. Those are usually the most
serious ones, and a service can be failing every outbound call while its "5xx rate" panel is flat.

{/* FOOTER */}
