---
title: "Outbound HTTP"
sidebar_label: "12 · Outbound HTTP"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework reference *REST Clients* and
> *Core → Resilience*
> (docs.spring.io/spring-framework/reference/integration/rest-clients.html,
> .../core/resilience.html), the Spring Boot reference *Calling REST Services*
> and *Actuator → Metrics*
> (docs.spring.io/spring-boot/reference/io/rest-client.html), the Spring Boot 4.0
> Migration Guide and Configuration Changelog, the Spring Framework 7.0.x and
> Spring Boot 4.1.0 Javadoc, the JDK 25 `java.net.http` API, and the Apache
> HttpComponents Client 5.x API. Spring Boot 4.1.0, Spring Framework 7.0.x,
> JDK 25.

**Every topic before this one made your service a server. This one makes it a
client — and the moment it is a client, it inherits someone else's availability.
Two things follow, and this topic is about both. First, the API you write against
changed: `RestTemplate` is deprecated in Framework 7, `RestClient` is the
synchronous default, `WebClient` is no longer the answer to "I need concurrency"
now that virtual threads exist, and declarative `@HttpExchange` interfaces are
the nicest way to write a client in 2026. Second — and this is the half that
causes incidents — every default in that stack is tuned for a desktop
application, not a server. The JDK client's documented behaviour with no timeout
set is to *block forever*. Apache's connection pool defaults to *five*
connections per host. Neither is a bug; both are how one slow dependency takes
down a fleet that was, by every configuration file in the repository, correctly
protected.**

This topic runs to eighteen files. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Which client](01-the-client-you-should-reach-for.md)** | The four options the reference lists, `RestTemplate`'s deprecation and the one-line migration bridge, and why virtual threads ended `WebClient`'s concurrency argument |
| 2 | **[Wiring it in Boot 4](02-wiring-it-in-boot-4.md)** | The new `spring-boot-starter-restclient`, why the builder is a prototype, and why `RestClient.create()` silently opts out of every timeout and every metric |
| 3 | **[The fluent API](03-the-fluent-api.md)** | `body` vs `toEntity` vs `toBodilessEntity` vs `exchange`, URI templates and the cardinality they protect, and builder-level defaults |
| 4 | **[HTTP interfaces](04-http-interfaces.md)** | `@HttpExchange`, `HttpServiceProxyFactory`, the adapter that decides the transport, and how this compares with `@FeignClient` |
| 5 | **[HTTP service groups](05-http-service-groups.md)** | `@ImportHttpServices`, `AbstractHttpServiceRegistrar`, and `spring.http.serviceclient.<group>.*` — a client with no URL in the Java |
| 6 | **[What a timeout covers](06-what-a-timeout-covers.md)** | Connect vs read vs deadline, what each request factory actually implements, and the JDK's documented "block forever" default |
| 7 | **[Configuring timeouts](07-configuring-timeouts-in-boot.md)** | `spring.http.clients.*`, the non-uniform Boot 3 → 4 rename, per-group overrides, and why there is no per-call timeout |
| 8 | **[Factory, TLS and proxy](08-pinning-the-factory-tls-proxy.md)** | Pinning the request factory so the classpath stops choosing your transport, `HttpClientSettings`, SSL bundles, `InetAddressFilter` and the proxy |
| 9 | **[The pool is the real limit](09-the-pool-is-the-real-limit.md)** | Apache's 25/5 defaults, connection acquisition as a fourth phase, HTTP/2 multiplexing, and the leak from never completing a response |
| 10 | **[The cascade](10-the-cascade.md)** | The six-step sequence from "a dependency got slower" to "we are down", bulkheads, load shedding, and the limit virtual threads removed |
| 11 | **[Deadlines](11-deadlines-not-timeouts.md)** | Why three two-second calls is a six-second endpoint, building a deadline, propagating it as an instant, and what it still cannot do |
| 12 | **[Client exceptions](12-error-mapping.md)** | The hierarchy, the `ResourceAccessException` branch that catches every timeout, `getResponseBodyAs`, and per-call `onStatus` |
| 13 | **[Translating failures](13-their-failure-is-not-yours.md)** | The status-mapping table — their 500 is your 502 — and why their error body must never reach your caller |
| 14 | **[`@Retryable`](14-retries-and-resilience.md)** | Framework 7's annotation, every attribute and default, the `timeout` that bounds the sequence, and the switch Boot declined to auto-configure |
| 15 | **[Retrying safely](15-retrying-safely.md)** | Idempotency and idempotency keys, why retries amplify an outage, retry budgets, `@ConcurrencyLimit`, and the circuit breaker core does not ship |
| 16 | **[Observing calls](16-observing-outbound-calls.md)** | `http.client.requests`, the tag set, why `status >= 500` misses every timeout, trace propagation, and logging without regret |
| 17 | **[Testing: the tools](17-testing-outbound-calls.md)** | `MockRestServiceServer`, `@RestClientTest`, and the Boot 4 removals — `@MockBean` is gone |
| 18 | **[Testing the failures](18-testing-the-failures.md)** | Why a slow stub server is the only test that proves your timeout exists, the failure list worth writing, and stub drift |

## Why this runs to eighteen files

- **Four different things are called "the client", and they are chosen for
  different reasons.** Chunks 1–5 are entirely about *what you write*: which of
  the four options, how Boot wires it, the fluent chain, and the declarative
  alternative. None of that is about failure, and mixing it with failure is what
  makes most treatments of this subject unreadable.
- **The timeout material is four chunks because the word means four things.**
  Chunk 6 is what the libraries actually implement, chunk 7 is the property
  namespace that changed in Boot 4, chunk 8 is which library applies them at all,
  and chunk 11 is the deadline none of them gives you. Collapsing these produces
  the sentence that causes outages — "we set a timeout" — with no way to ask
  *which* one.
- **Pooling and cascading failure are separate chunks because they are separate
  ideas that only become an outage together.** Chunk 9 is a resource limit;
  chunk 10 is the feedback loop. A reader who knows the first can size a pool; a
  reader who knows both can read a thread dump during an incident and say what
  they are looking at.
- **Error handling splits along the line between mechanism and policy.** Chunk 12
  is what Spring throws and how to read it — including the `ResourceAccessException`
  branch that most `catch` blocks miss. Chunk 13 is the argument about what your
  API should return, which is a design decision with no framework answer.
- **Retries get two chunks because the mechanism is easy and the judgement is
  not.** Chunk 14 is `@Retryable`'s attribute table, which is new in Framework 7
  and different from Spring Retry's in ways that silently change behaviour.
  Chunk 15 is idempotency, amplification and budgets — the reasoning that decides
  whether the mechanism helps or makes the incident worse.
- **Testing splits on what is testable in process.** `MockRestServiceServer`
  replaces the request factory, so it can prove your request shape and your retry
  count and can never prove a timeout. That boundary is worth its own chunk,
  because a suite that does not know it is green about the wrong layer.

## Where this connects

- **[Topic 01 — Why frameworks: the servlet model](../01-why-frameworks-servlet-model/README.md)**
  — the thread your handler runs on is the thread a blocking outbound call
  occupies. Chunks 9 and 10 assume that picture.
- **[Topic 07 — REST controllers](../07-rest-controllers/README.md)** — the
  mirror image. `@GetExchange` is to `@GetMapping` what a client is to a server,
  and [API versioning](../07-rest-controllers/12-api-versioning.md) has a client
  half on the `RestClient` builder.
- **[ProblemDetail and RFC 9457](../09-error-handling/06-problemdetail-and-rfc-9457.md)**
  — the error shape you return, read from the other side with
  `getResponseBodyAs(ProblemDetail.class)` in chunk 12.
- **[Mapping domain exceptions](../09-error-handling/11-mapping-domain-exceptions.md)**
  and **[Correlation ids and logging](../09-error-handling/14-correlation-ids-and-logging.md)**
  — where the gateway's domain exceptions become status codes, and how the
  correlation id chunk 16 propagates gets joined up.
- **[Topic 11 — Spring Security](../11-spring-security/README.md)** — outbound
  authorisation: forwarding a caller's token versus using your own service
  credentials, and the token acquisition that Spring Security 7 attaches to an
  HTTP service group.
- **[Topic 15 — WebFlux and the reactive stack](../15-webflux-reactive/README.md)**
  — `WebClient` in its natural habitat, and
  [why virtual threads changed the answer](../15-webflux-reactive/11-why-virtual-threads-changed-the-answer.md),
  which chunk 1 leans on.
- **[Topic 06 — Configuration and profiles](../06-configuration-and-profiles/README.md)**
  — every timeout, base URL and SSL bundle in chunks 7 and 8 is an `Environment`
  property with the usual precedence.
- **[Topic 05 — Auto-configuration](../05-auto-configuration/README.md)** — why
  `RestClient.Builder` exists as a bean and `RestClient` does not.
- **[Phase 6 — Concurrency](../../phase-6-concurrency/README.md)** — virtual
  threads, structured concurrency and `ScopedValue`, all of which chunks 10 and 11
  build on directly.
- **[Phase 7 — I/O, time and the standard library](../../phase-7-io-time-stdlib/README.md)**
  — `java.net.http.HttpClient` itself, and the `Duration`/`Instant` types a
  deadline is made of.
- **[Phase 11 — Testing](../../phase-11-testing/README.md)** — slices,
  `@MockitoBean` and the broader strategy chunks 17 and 18 sit inside.
- **[Phase 16 — Resilience and operations](../../phase-16-resilience-operations/README.md)**
  — circuit breakers, bulkheads and load shedding at the architecture level,
  where the core framework stops.
- **Topic 10 — The request pipeline** *(not written yet)* — the inbound side of
  the deadline problem chunk 11 raises.
- **Topic 13 — Actuator** *(not written yet)* — the metrics endpoint chunk 16's
  observations arrive at, and the readiness-probe trap chunk 10 warns about.
- **Topic 14 — OpenAPI with springdoc** *(not written yet)* — generating client
  stubs and interfaces from a provider's schema, which is chunk 18's answer to
  stub drift.
- **Topic 16 — The alternatives** *(not written yet)* — where a service mesh
  takes over retries, timeouts and mTLS from the application entirely.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Which client](01-the-client-you-should-reach-for.md)
