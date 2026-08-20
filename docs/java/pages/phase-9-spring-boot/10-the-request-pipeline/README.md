---
title: "The request pipeline"
sidebar_label: "10 · The request pipeline"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework 7.0 reference — *Web MVC →
> DispatcherServlet* and its *Processing* and *Interception* pages, *MVC Config →
> Interceptors*, *Filters*, *CORS*, *Core → AOP → Proxying Mechanisms* and
> *Integration → Observability Support*
> (docs.spring.io/spring-framework/reference) — the Jakarta Servlet 6.1 javadoc
> for `jakarta.servlet.Filter`, the Spring Boot 4.1 reference on servlet filter
> registration, response compression, proxy headers, metrics and tracing, and the
> Spring Security 7 reference *Servlet Applications → Architecture*. Spring Boot
> 4.1.0, Spring Framework 7.0.x, JDK 25.

**Filters, interceptors and AOP advice are not three styles of solving one
problem. They are three depths in a single nested call stack, and every practical
difference between them — what they can see, what they can change, which of them
catches your exception, which of them runs when nothing matched the URL — is a
mechanical consequence of that depth. Learn the stack once and the comparison
table writes itself; skip it and you will spend years moving concerns between
layers by trial and error, and shipping a filter whose exception your
`@ControllerAdvice` will never see.**

This topic runs to ten files. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The full path a request takes](01-the-full-path.md)** | The nested stack drawn once; the documented `DispatcherServlet` sequence; where `@InitBinder`, `@ModelAttribute` and `@ExceptionHandler` each sit; the unwinding order |
| 2 | **[Filters](02-filters.md)** | The Servlet contract and why `chain.doFilter` is a *call*; the `@ControllerAdvice` gap and how to close it; correlation IDs and the five decisions inside that filter |
| 3 | **[Interceptors](03-interceptors.md)** | `preHandle`/`postHandle`/`afterCompletion`; reading annotations off the `HandlerMethod`; why `postHandle` is useless for `@ResponseBody`; the documented security warning |
| 4 | **[AOP at the web boundary](04-aop-at-the-web-boundary.md)** | Typed arguments and return values; the Boot 4 `spring-boot-starter-aspectj` rename; self-invocation and its three fixes; CGLIB's limits |
| 5 | **[The decision table](05-the-decision-table.md)** | Three questions that settle any concern, then thirteen worked rows — auth, CORS, correlation, logging, metrics, rate limiting, tenancy, compression, sanitising, auditing |
| 6 | **[What Spring already gives you](06-what-spring-gives-you.md)** | Security's chain as one filter; CORS three ways; `ForwardedHeaderFilter`, `CharacterEncodingFilter`, `FormContentFilter`, `RequestContextFilter`; compression as a property |
| 7 | **[Observability and correlation](07-observability-and-correlation.md)** | `ServerHttpObservationFilter` and `http.server.requests`; why `uri` is a pattern; why handled exceptions read `error=none`; tracing, baggage and `logging.pattern.correlation` |
| 8 | **[Registration and ordering](08-registration-and-ordering.md)** | Dispatch types and `OncePerRequestFilter`; `FilterRegistrationBean` and `@FilterRegistration`; the `@Order`-on-a-`@Bean`-method trap; two registries side by side |
| 9 | **[Wrapping and request logging](09-wrapping-and-request-logging.md)** | The read-once body; `ContentCachingRequestWrapper` and the caveat that defeats naive use; `copyBodyToResponse()`; why body logging is genuinely hard |
| 10 | **[Threads, scope and async](10-threads-scope-and-async.md)** | What is `ThreadLocal`-bound; `@Async` losing everything; `ContextPropagatingTaskDecorator`; virtual threads changing cost but not semantics |

## Why this runs to ten files

- **The mechanisms need three chunks because they differ on four axes, not one.**
  Layer is the easy difference. What each one can *see*, what it can *change*,
  how it *fails*, and how it is *ordered* are four independent comparisons, and a
  single "filters vs interceptors vs AOP" page can only assert them. Chunks 2, 3
  and 4 each argue one mechanism properly so that chunk 5 can decide between them
  in one line per concern.
- **The decision table is the point of the topic and had to be earned.** A table
  of verdicts is worthless — every row needs the reason, and several reasons only
  make sense once you know that interceptors do not exist for a 404 and that only
  a filter can wrap the request. Putting it fifth is deliberate.
- **What Spring already registers deserves its own chunk because it deletes
  code.** Most hand-written filters are worse copies of `CorsFilter`,
  `ForwardedHeaderFilter` or `ServerHttpObservationFilter`. That argument only
  lands with the actual class names, properties and defaults on the page, which is
  more than a sidebar.
- **Observability split off because the built-in filter is fed by layers below
  it.** A metric tagged with the URI *pattern* cannot be produced by a filter
  alone, and the "handled exceptions are not errors" rule surprises everyone.
  Both need room to be shown rather than mentioned.
- **Ordering is a chunk because there are two registries and people assume one.**
  Filter order comes from the filter class; interceptor order comes from the
  sequence of `addInterceptor` calls; `@Order` on a `@Bean` method does nothing.
  Every one of those is a documented rule with a silent failure attached.
- **Wrapping and threading are the two hard consequences, and each is where real
  outages come from.** A forgotten `copyBodyToResponse()` empties every response
  body; a `ThreadLocal` not cleared in a `finally` leaks one tenant's data into
  another's request under load only. Neither compresses into a bullet.

## Where this connects

- **[Topic 01 — Why frameworks: the servlet model](../01-why-frameworks-servlet-model/README.md)**
  — the container, `DispatcherServlet` and the thread a request runs on. This
  topic is that picture with every extension point filled in;
  [chunk 2 there](../01-why-frameworks-servlet-model/02-filters-and-the-container.md)
  is the container's-eye view of chunk 2 here.
- **[Topic 02 — The IoC container](../02-the-ioc-container/README.md)**, and
  specifically
  [proxies and self-invocation](../02-the-ioc-container/05-proxies-and-self-invocation.md)
  — the mechanism chunk 4 depends on and does not re-derive.
- **[Topic 03 — Dependency injection](../03-dependency-injection/README.md)** —
  filters, interceptors and aspects are ordinary beans, which is why "filter beans
  are initialised very early" is a problem you can reason about.
- **[Topic 04 — Bean scopes and lifecycle](../04-bean-scopes-lifecycle/README.md)**
  — request scope is `RequestContextHolder` wearing an annotation, which is why
  chunk 10's rules about thread boundaries apply to it too.
- **[Topic 07 — REST controllers](../07-rest-controllers/README.md)** — the
  handler at the centre of the stack. Its
  [chunk 1](../07-rest-controllers/01-the-controller-and-the-pipeline.md) points
  here for the full pipeline.
- **Topic 09 — Error handling** — the resolver chain that chunk 1 places inside
  `DispatcherServlet`, argued in full:
  [the resolver chain](../09-error-handling/02-the-resolver-chain.md) and
  [correlation IDs and logging](../09-error-handling/14-correlation-ids-and-logging.md)
  are the two chunks this topic leans on hardest.
- **[Topic 11 — Spring Security](../11-spring-security/README.md)** — the largest
  filter in your chain, and the reason most auth concerns are already solved.
  [The `ThreadLocal` caveat](../11-spring-security/04-the-threadlocal-caveat.md)
  is chunk 10's argument applied to the security context.
- **[Topic 15 — WebFlux and reactive](../15-webflux-reactive/README.md)** — the
  same cross-cutting problems without a thread to hang context on;
  [context and thread-locals](../15-webflux-reactive/10-context-and-threadlocals.md)
  is the contrast chunk 10 draws.
- **[Phase 6 — Concurrency](../../phase-6-concurrency/README.md)**, especially
  [`ThreadLocal` and `ScopedValue`](../../phase-6-concurrency/12-threadlocal-scopedvalue/README.md)
  and
  [platform vs virtual threads](../../phase-6-concurrency/02-platform-vs-virtual-threads/README.md)
  — the language-level mechanics under everything in chunk 10.
- **Topic 12 — Outbound HTTP** *(not written yet)* — where trace context has to be
  propagated onwards, and why an injected `RestClient.Builder` matters.
- **Topic 13 — Actuator** *(not written yet)* — the endpoints that expose the
  metrics chunk 7 describes.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The full path a request takes](01-the-full-path.md)
