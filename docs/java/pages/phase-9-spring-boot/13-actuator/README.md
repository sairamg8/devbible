---
title: "Actuator"
sidebar_label: "13 · Actuator"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 / 2026-08-20 against the Spring Boot 4.1.1 reference —
> *Actuator · Endpoints*, *Health*, *Kubernetes Probes*, *Metrics* and
> *Observability* (docs.spring.io/spring-boot/reference/actuator/) and the
> Spring Boot 4.1.1 how-to *Actuator*
> (docs.spring.io/spring-boot/how-to/actuator.html), plus the Micrometer 1.17
> reference (docs.micrometer.io/micrometer/reference/) for meter types,
> histograms and percentiles, and the Observation API. Version-specific defaults
> are cross-checked against the Spring Boot 3.4 and 3.5 release notes where a
> behaviour changed. Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Actuator is a set of production interfaces bolted onto your application, and
almost every mistake made with it comes from treating it as one feature with one
switch. It is four independent gates — does the endpoint exist, may it be called,
is it routed over HTTP, is the caller authorised — layered over two completely
different jobs. One job is telling an orchestrator whether to send this instance
traffic, which is a question with operational consequences and a very short right
answer. The other is telling you what the process is doing, which is a question
whose honest answers describe your architecture in detail and, in one case, hand
over the contents of memory. Getting Actuator right is mostly a matter of keeping
those two jobs apart. The first belongs on a probe, answers in one word, and has
to be reachable by callers that cannot authenticate. The second belongs on a port
the internet cannot route to.**

This topic runs to twenty files. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What Actuator is](01-what-actuator-is.md)** | The starter that was *not* renamed in Boot 4, the endpoint programming model, and why an endpoint can appear as a side effect of an unrelated dependency |
| 2 | **[Exposure, access and where endpoints live](02-exposure-access-and-ports.md)** | The four gates in order; `access` replacing `enabled`; web versus JMX; base path and `management.server.port`, and what that port does not inherit |
| 3 | **[Health, properly](03-health-properly.md)** | `HealthIndicator` and `HealthContributor`, writing one that cannot hang, and why the endpoint's latency is the slowest contributor's |
| 4 | **[Aggregation, details and status codes](04-health-aggregation-and-details.md)** | Severity as a total order, registering a custom `Status` in *both* places, and `show-details` / `show-components` as disclosure controls |
| 5 | **[Liveness and readiness](05-liveness-and-readiness.md)** | Two questions with opposite consequences — restart me versus stop sending me traffic — and the `AvailabilityState` events behind them |
| 6 | **[What belongs in each probe](06-what-belongs-in-each-probe.md)** | The judgement call: which dependencies are decisive, and why a liveness probe that checks a database restarts a healthy process |
| 7 | **[Groups and graceful shutdown](07-groups-and-graceful-shutdown.md)** | Health groups as the mechanism for having several answers, and the drain sequence including the probe-interval race nothing can close |
| 8 | **[Micrometer and the meter types](08-metrics.md)** | The facade and the composite registry; counter, gauge, timer, long task timer and distribution summary; the weak-reference gauge trap |
| 9 | **[What Boot already measures](09-what-boot-measures.md)** | The families you get free, `http.server.requests` and its URI template, and why the scrape endpoint is not public data |
| 10 | **[Registering custom metrics](10-custom-metrics.md)** | `MeterBinder` over constructor registration, the annotations and the two switches they need, and why a metric name is a contract |
| 11 | **[Tags, filters and cardinality](11-tags-filters-cardinality.md)** | The failure mode that scales with your success, common tags multiplying everything, and `MeterFilter` as the configuration-first remedy |
| 12 | **[Distributions and percentiles](12-distributions-and-percentiles.md)** | What a timer publishes by default; client-side percentiles that cannot be aggregated, worked through ten pods; histogram buckets, which can |
| 13 | **[Buckets, SLOs and cost](13-configuring-distributions.md)** | Buckets multiplied by cardinality; clamping as a precondition; SLO boundaries as the cheap exact answer; the nanosecond trap in `MeterFilter` |
| 14 | **[The Observation API](14-the-observation-api.md)** | Recording an event rather than a duration; low- versus high-cardinality key values as routing; handlers as the source of every output |
| 15 | **[Conventions, filtering and propagation](15-observation-conventions-and-propagation.md)** | Changing instrumentation you do not own; common key values versus common tags; predicates; and the thread boundary that truncates traces silently |
| 16 | **[`/info` and build metadata](16-info-and-the-catalogue.md)** | Why `/info` is empty by default, generating build and git information, and the fingerprint argument against exposing it |
| 17 | **[The endpoint catalogue](17-the-endpoint-catalogue.md)** | What each endpoint is genuinely for; `loggers` as the one that changes an incident; the three that need a collaborator; incident tools versus development tools |
| 18 | **[Locking it down](18-locking-it-down.md)** | `heapdump` as one GET away from a credential dump; `max-permitted` as a ceiling on future mistakes; routing beating authorisation |
| 19 | **[Securing the endpoints](19-securing-the-endpoints.md)** | The auto-configured protection that backs off the day you define a chain, and the `EndpointRequest`-scoped chain that replaces it |
| 20 | **[Sanitising the responses](20-sanitising-what-is-returned.md)** | `show-values`, why masking never covers keys, `SanitizingFunction` matching by origin, and a baseline configuration worth defending |

## Why this runs to twenty files

- **Health is two questions, not one, and the second one costs money.** Chunks
  3–7 exist because "is the service healthy" collapses two decisions with
  opposite consequences: restarting a process and removing it from rotation.
  Teams that conflate them build liveness probes that check a database, and then
  a slow database restarts every instance simultaneously. Separating the
  question, aggregating it correctly, choosing what each probe checks, and
  draining cleanly are four distinct arguments, and every one of them has a
  failure mode that only appears in production.
- **Metrics splits into instrumentation, cost and correctness, and the cost half
  is the one that bites.** Chunks 8–13 move from "which meter type" through "what
  you already get" to cardinality and distribution statistics — and the last two
  are where the real damage lives. A tag with unbounded values and a histogram
  enabled without clamping are the two ways to turn a monitoring system into an
  incident, and neither is visible in a code review.
- **The Observation API needed its own pair rather than a paragraph in the
  metrics chunks.** It is not a convenience wrapper over `Timer`; it is a
  different unit of instrumentation, and it is what Boot's own instrumentation is
  written against. Chunk 14 covers the model and chunk 15 covers the leverage it
  gives you over code you did not write — plus the context-propagation failure,
  which deserves the space because it produces traces that look merely incomplete
  rather than broken and therefore survives for months.
- **Security is three chunks because it is three distinct failures.** Chunk 18 is
  about what is reachable, chunk 19 is about the auto-configured protection that
  silently backs off, and chunk 20 is about what a reachable, authenticated
  endpoint is still allowed to say. A reader who fixes only one of the three has
  a service that is genuinely exposed and feels secured — which is exactly the
  shape of every published Actuator incident.
- **The catalogue earns a chunk because knowing an endpoint exists is the whole
  value.** `loggers` can change the course of an incident, `threaddump` is free
  and diagnostic, and neither helps anyone who discovers them afterwards.
  Equally, half the catalogue describes your architecture to anybody who reads
  it, and knowing which half is what makes chunk 18's exposure list a decision
  rather than a guess.

## Where this connects

- **[Topic 05 — Boot auto-configuration](../05-auto-configuration/README.md)** —
  Actuator is auto-configuration all the way down. Endpoints appear because
  classes are on the classpath, contributors appear because a bean type was
  found, and the security auto-configuration in chunk 19
  [backs off](../05-auto-configuration/04-bean-conditions-and-back-off.md)
  exactly as designed when you define your own chain.
- **[Topic 06 — Configuration and profiles](../06-configuration-and-profiles/01-the-environment-and-precedence.md)**
  — every `management.*` setting is an `Environment` property like any other, and
  chunk 20's argument about which profile the hardening belongs in is a
  configuration argument before it is a security one.
- **[Topic 02 — The IoC container](../02-the-ioc-container/05-proxies-and-self-invocation.md)**
  — the annotation-driven instrumentation in chunk 10 is proxy-based, so
  self-invocation produces no measurement at all.
- **[Topic 11 — Spring Security](../11-spring-security/README.md)** — chunk 19 is
  one application of [multiple filter chains](../11-spring-security/06-matchers-and-multiple-chains.md)
  and [CSRF decisions](../11-spring-security/13-csrf-decisions.md); that topic
  owns the model, this one owns the actuator-shaped instance of it.
- **[Topic 01 — Why frameworks: the servlet model](../01-why-frameworks-servlet-model/02-filters-and-the-container.md)**
  — the management server in chunk 02 is a *second* server, which is why none of
  your servlet-level customisation follows it there.
- **[Topic 07 — REST controllers](../07-rest-controllers/README.md)** — actuator
  endpoints are not controllers, and the difference is the point: they are
  technology-agnostic operations that Boot maps onto HTTP or JMX, which is why
  exposure is configured per technology.
- **[Topic 10 — The request pipeline](../10-the-request-pipeline/README.md)** — where filters,
  interceptors and the actuator's own chain sit relative to one another.
- **[Topic 12 — Outbound HTTP](../12-outbound-http/README.md)** — `http.client.requests` is
  the meter chunks 09 and 13 keep referring to, and it carries its own
  cardinality and bucket costs.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [What Actuator is](01-what-actuator-is.md)
