---
title: "Registration and ordering: two registries, two rules"
sidebar_label: "8 · Registration and ordering"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Boot 4.1 reference *Web → Servlet Web
> Applications → Servlets, Filters and Listeners*
> (docs.spring.io/spring-boot/reference/web/servlet.html — bean registration,
> `FilterRegistrationBean`, `@FilterRegistration`,
> `DelegatingFilterProxyRegistrationBean`, the `@Order` rules,
> `OrderedFilter.REQUEST_WRAPPER_FILTER_MAX_ORDER` and `logging.level.web=debug`),
> the `OncePerRequestFilter` javadoc (dispatch types and the already-filtered
> attribute), and the Spring Framework 7.0 reference *Web MVC → MVC Config →
> Interceptors* (`MappedInterceptor`). Spring Boot 4.1.0, Spring Framework 7.0.x,
> JDK 25.

**Filter order and interceptor order look like the same problem and are solved in
completely different places. Filter order is a servlet-container property that
Boot drives from the *filter class*; interceptor order is simply the sequence of
`addInterceptor(...)` calls in a `WebMvcConfigurer`. Nothing you write in one
registry has any effect on the other, and the annotation that looks like it
should work in both — `@Order` on a `@Bean` method — works in neither.**

## One request, several dispatches

Before ordering, the count. A single HTTP request can pass through the filter
chain more than once, because the container dispatches with a **dispatcher type**:

| Type | When |
|---|---|
| `REQUEST` | the original client request |
| `FORWARD` | a server-side forward to another resource |
| `INCLUDE` | a server-side include |
| `ASYNC` | a handler returned `Callable`, `DeferredResult` or `CompletableFuture` and the result is being delivered |
| `ERROR` | the container is performing an error dispatch — in Boot, typically to `/error` |

Which of these a filter participates in depends on how it is registered, and
containers do not all agree on the defaults. `OncePerRequestFilter` exists to make
this deterministic: its javadoc gives the goal as "a single execution per request
dispatch, on any servlet container", implemented by setting a request attribute
whose name defaults to the filter's configured name plus the suffix `.FILTERED`
and skipping `doFilterInternal` when it is already present.

Three overrides decide the edges, and all three are answered *statically*, at
startup, rather than per request:

- `shouldNotFilter(request)` — skip this particular request entirely.
- `shouldNotFilterAsyncDispatch()` — run again on the `ASYNC` dispatch? Return
  `false` (i.e. do filter it) for anything that sets up thread state, because the
  async dispatch runs on a different thread with none of your state on it.
- `shouldNotFilterErrorDispatch()` — run on the `ERROR` dispatch? Say yes-skip
  for anything that counts or logs, or you double-count every error.

Inside the body, `isAsyncDispatch(request)` and `isAsyncStarted(request)` let the
code tell which pass it is on — the second answers "the request has been placed
in async mode, so this is not the last dispatch".

## Getting a filter into the chain

Boot registers filters by convention: "any `Servlet`, `Filter`, or servlet
`*Listener` instance that is a Spring bean is registered with the embedded
container". A `@Component` filter is live immediately, mapped to every request.
When that is not enough there are three escalating options.

```java
@Bean
FilterRegistrationBean<TenantFilter> tenantFilter(TenantFilter filter) {
    var registration = new FilterRegistrationBean<>(filter);
    registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 30);
    registration.addUrlPatterns("/api/*");
    registration.setDispatcherTypes(DispatcherType.REQUEST, DispatcherType.ASYNC);
    return registration;
}
```

- **`FilterRegistrationBean`** (with `ServletRegistrationBean` and
  `ServletListenerRegistrationBean`) — the reference's phrase is "for complete
  control": order, URL patterns, dispatcher types, servlet names, enabled/disabled.
- **`@FilterRegistration`** and **`@ServletRegistration`** — the annotation form,
  "if you prefer annotations".
- **`DelegatingFilterProxyRegistrationBean`** — for the case the reference calls
  out explicitly: filter beans "are initialized very early in the application
  lifecycle", so "if you need to register a `Filter` that interacts with other
  beans, consider using a `DelegatingFilterProxyRegistrationBean` instead". It
  registers a proxy with the container and resolves the real bean from the context
  lazily, on first use.

That last one is the same mechanism Spring Security uses to install
`FilterChainProxy` — see [chunk 6](06-what-spring-gives-you.md).

## Ordering a filter, and the rule that catches everyone

The reference states the normal case and the trap in consecutive sentences:

> It is usually safe to leave filter beans unordered. If a specific order is
> required, you should annotate the `Filter` with `@Order` or make it implement
> `Ordered`.

> You cannot configure the order of a `Filter` by annotating its bean method with
> `@Order`. If you cannot change the `Filter` class to add `@Order` or implement
> `Ordered`, you must define a `FilterRegistrationBean` for the `Filter` and set
> the registration bean's order using the `setOrder(int)` method.

So there are exactly three valid ways to order a filter — `@Order` on the class,
`Ordered` implemented by the class, or `setOrder` on a registration bean — and one
invalid way that compiles, runs, and does nothing. Lower value means earlier;
`Ordered.HIGHEST_PRECEDENCE` is first.

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)   // ✅ on the CLASS
class CorrelationIdFilter extends OncePerRequestFilter { ... }

@Bean
@Order(Ordered.HIGHEST_PRECEDENCE + 10)   // ❌ on the @Bean method — silently ignored
CorrelationIdFilter correlationIdFilter() { ... }
```

Two constraints from the same page, both worth obeying literally:

- **Do not read the request body at `Ordered.HIGHEST_PRECEDENCE`**, because it
  "might go against the character encoding configuration of your application" —
  the encoding filter has not run yet.
- **A filter that wraps the request** "should be configured with an order that is
  less than or equal to `OrderedFilter.REQUEST_WRAPPER_FILTER_MAX_ORDER`". Read
  the constant rather than hardcoding whatever integer it currently holds;
  wrapping is [chunk 9](09-wrapping-and-request-logging.md).

And when the order is not what you expected, do not reason about it — print it:

```properties
logging.level.web=debug
```

The reference states that "details of the registered filters, including their
order and URL patterns, will then be logged at startup". That list includes every
filter contributed by a starter, which is why it beats reading your own code.

## Ordering an interceptor: a different registry entirely

```java
@Configuration
class WebConfiguration implements WebMvcConfigurer {
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new TenantInterceptor());        // runs first
        registry.addInterceptor(new BudgetInterceptor())         // runs second
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/public/**");
    }
}
```

Execution order is call order. There is no `@Order`, no `Ordered`, no registration
bean. `preHandle` runs in that order and `postHandle`/`afterCompletion` in
reverse, exactly like nested filter calls.

One structural note the reference makes about Java config: it "passes interceptors
only to the `HandlerMapping` beans it manages", whereas XML config declares them as
`MappedInterceptor` beans "which are detected by any `HandlerMapping` bean
(including those from other frameworks)". If an interceptor must apply to a
`HandlerMapping` that Spring MVC's Java config does not own, declare a
`MappedInterceptor` bean directly instead of registering it.

## The two registries side by side

| | Filters | Interceptors |
|---|---|---|
| Registered by | being a bean, or a `FilterRegistrationBean` / `@FilterRegistration` | `WebMvcConfigurer.addInterceptors` |
| Ordered by | `@Order`/`Ordered` **on the class**, or `setOrder(int)` | the order of `addInterceptor` calls |
| Scoped by | `addUrlPatterns`, `setDispatcherTypes`, `shouldNotFilter` | `addPathPatterns`, `excludePathPatterns` |
| Owned by | the servlet container | `DispatcherServlet`'s handler mappings |
| Runs for unmatched paths | yes | no |
| Cross-registry ordering | — none. Every filter always wraps every interceptor — |

## Gotchas

**⚠️ `@Order` on the `@Bean` method**
**Symptom:** the order silently has no effect; an auth filter runs after the one
that depended on it.
**Cause:** the reference states outright that this does not configure filter order.
**Fix:** annotate the class, implement `Ordered`, or use
`FilterRegistrationBean.setOrder(int)`.

**⚠️ `@Order` on an interceptor bean**
**Symptom:** interceptors run in the order they were registered, ignoring the
annotation.
**Cause:** the interceptor registry does not consult `Ordered` at all.
**Fix:** reorder the `addInterceptor` calls.

**⚠️ A `@Component` filter mapped to everything, including `/actuator/**`**
**Symptom:** health checks pick up correlation IDs, generate log noise, or fail
authentication.
**Cause:** convention-based registration maps to all requests.
**Fix:** override `shouldNotFilter`, or register with
`addUrlPatterns("/api/*")`.

**⚠️ A plain `Filter` that runs twice**
**Symptom:** duplicate log lines or double-counted metrics on error responses.
**Cause:** the `ERROR` dispatch went through the chain again.
**Fix:** extend `OncePerRequestFilter` and answer `shouldNotFilterErrorDispatch()`
deliberately.

**⚠️ Thread state missing after an async handler resumes**
**Symptom:** the MDC is empty, or a `ThreadLocal` is null, on everything logged
after the async dispatch.
**Cause:** `shouldNotFilterAsyncDispatch()` defaulted to skipping that dispatch,
which runs on another thread.
**Fix:** return `false` from it in any filter that establishes thread state — and
see [chunk 10](10-threads-scope-and-async.md).

**⚠️ A filter bean that injects a rich collaborator**
**Symptom:** obscure early-initialisation failures, or the injected bean is not
the proxied version.
**Cause:** filter beans are initialised very early in the application lifecycle.
**Fix:** register through `DelegatingFilterProxyRegistrationBean`, which resolves
the bean lazily.

**⚠️ A CORS filter ordered after Spring Security**
**Symptom:** the browser reports a CORS error; the network tab shows 401 on the
preflight `OPTIONS`.
**Cause:** the preflight carries no credentials by design and Security rejected it
first.
**Fix:** order `CorsFilter` ahead of Security's chain, as the reference advises,
or use Security's own CORS support.

## Interview questions

**★ How do you control the order of a third-party filter you cannot modify?**
Wrap it in a `FilterRegistrationBean` and call `setOrder(int)`. You cannot put
`@Order` on the `@Bean` method — the Boot reference calls that out specifically —
and you cannot add `Ordered` to a class you do not own. This is the main reason
`FilterRegistrationBean` exists at all for filters you are otherwise happy with.

**★ Why does `DelegatingFilterProxy` exist?**
Because the servlet container and the Spring context have separate lifecycles. The
container wants a `Filter` registered very early; Spring's beans are created later
and are post-processed. `DelegatingFilterProxy` registers immediately and defers
the lookup, so the filter it delegates to is a fully initialised, fully proxied
bean. Spring Security uses it to install `FilterChainProxy`, and Boot exposes the
same trick as `DelegatingFilterProxyRegistrationBean` for your own filters.

**★ How is interceptor ordering configured?**
By the order you call `registry.addInterceptor(...)` in `addInterceptors`, and by
nothing else. It is a separate registry from the servlet filter chain, so `@Order`
and `Ordered` play no part. This trips people who assume one ordering model spans
the whole pipeline; there are two, and they never interact — a filter always wraps
an interceptor regardless of any number either declares.

**★ What is the `.FILTERED` request attribute for?**
It is how `OncePerRequestFilter` guarantees a single execution per dispatch. The
base class derives an attribute name from the filter's configured name plus
`.FILTERED`, sets it on first execution, and skips `doFilterInternal` if it is
already present. That makes behaviour identical across containers that disagree
about which dispatch types a filter participates in by default.

**★ Why the constraint on the order of request-wrapping filters?**
Layering. If a wrapper is installed too late, filters that already ran have seen —
and possibly consumed — the unwrapped request, so their view and the wrapper's
disagree, and a once-only body may already be gone. The reference expresses it as
an order "less than or equal to `OrderedFilter.REQUEST_WRAPPER_FILTER_MAX_ORDER`",
and separately warns against reading the body at `HIGHEST_PRECEDENCE` because that
runs ahead of character-encoding configuration.

**★ How would you find out what your filter order actually is at runtime?**
Set `logging.level.web=debug`. Boot then logs every registered filter with its
order and URL patterns at startup. That is strictly better than reading code,
because it includes filters contributed by starters and auto-configuration that
never appear in your source at all.

**★ A filter needs to run for the async dispatch but not the error dispatch. How?**
Extend `OncePerRequestFilter` and override the two predicates independently:
`shouldNotFilterAsyncDispatch()` returns `false` so it does run on `ASYNC`, and
`shouldNotFilterErrorDispatch()` returns `true` so it does not run on `ERROR`.
Both are static decisions made once at startup, not per request, which is why they
are methods on the class rather than checks inside the body.

---

← Prev: [Observability and correlation](07-observability-and-correlation.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Wrapping and request logging](09-wrapping-and-request-logging.md)
