---
title: "Interceptors: inside the framework, and they know the handler"
sidebar_label: "3 · Interceptors"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework 7.0 reference — *Web MVC →
> DispatcherServlet → Interception*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-servlet/handlermapping-interceptor.html,
> quoted for the three callbacks, the `postHandle` limitation and the security
> warning) and *Web MVC → MVC Config → Interceptors*
> (`mvc-config/interceptors.html`, for `addInterceptors`, `addPathPatterns`,
> `excludePathPatterns` and the `MappedInterceptor` note). Spring Boot 4.1.0,
> Spring Framework 7.0.x, JDK 25.

**An interceptor buys you exactly one thing a filter cannot give you: it knows
which handler is about to run. That is worth a great deal — it is how you read
an annotation off the controller method, how you tag a metric with the URI
pattern instead of the raw path, how you skip work for endpoints that opted out.
It costs you two things. The interceptor only exists when a handler was found,
so it never sees a 404. And by the time its most tempting callback fires, the
response has already been sent.**

## The three callbacks, and what each is really for

The reference describes the interface as three callbacks:

- **`preHandle(..)`** — "called before the actual handler is executed", returning
  a boolean: "If the method returns `true`, execution continues through the
  interceptor chain"; if it returns `false`, "the rest of the execution chain is
  bypassed and the handler is not called".
- **`postHandle(..)`** — "called after the handler is executed (but before the
  view is rendered in traditional MVC scenarios)".
- **`afterCompletion(..)`** — "called after the complete request has finished".

Read as a set, that is: *decide whether to proceed*, *contribute to the model*,
*clean up*. For a JSON API only the first and third are usable, and knowing why
is the point of the next section.

```java
@Component
class ApiBudgetInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response,
                             Object handler) throws Exception {
        if (!(handler instanceof HandlerMethod method)) {
            return true;                       // static resources, RouterFunctions, etc.
        }
        var budget = method.getMethodAnnotation(CostsBudget.class);
        if (budget == null) {
            return true;
        }
        if (!budgets.tryConsume(tenantOf(request), budget.units())) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader(HttpHeaders.RETRY_AFTER, "60");
            return false;                      // handler is NOT called
        }
        return true;
    }
}
```

`handler` is an `Object`, and the `instanceof HandlerMethod` check is not
defensive noise — the same interceptor can be handed a `ResourceHttpRequestHandler`
for a static file or a `HandlerFunction` for a functional route. `HandlerMethod`
is the interesting case: it gives you `getMethod()`, `getBeanType()`,
`getMethodAnnotation(...)` and `hasMethodAnnotation(...)`, which is the whole
reason to be at this depth rather than in a filter.

Note also what `return false` obliges you to do: **write the response yourself**.
Returning `false` does not produce a 403 or a 429; it produces whatever you left
on the response object, which by default is an empty 200. The reference's step 5
of the dispatch sequence says exactly this — if no model is returned, "maybe due
to a preprocessor or postprocessor intercepting the request, perhaps for security
reasons", no view is rendered "because the request could already have been
fulfilled". *Could already have been* — the framework assumes you did it.

## `postHandle` is a trap for `@ResponseBody` handlers

This is the trap that produces the most confident wrong code, and the reference
states the reason without ambiguity:

> For `@ResponseBody` and `ResponseEntity` controller methods, the response is
> written and committed within the `HandlerAdapter`, before `postHandle` is
> called. That means it is too late to change the response, such as to add an
> extra header. You can implement `ResponseBodyAdvice` and declare it as a
> Controller Advice bean or configure it directly on
> `RequestMappingHandlerAdapter`.

So for a REST API — where every handler is `@ResponseBody`, because
`@RestController` folds it in — `postHandle` can *observe* the status and read
the `ModelAndView` (which is `null`), and can change nothing. Adding a header
there fails silently: no exception, no warning, just a header the client never
receives.

The replacement the reference names is `ResponseBodyAdvice`, which runs at the
right moment — after the return value is produced, before the converter writes
it:

```java
@ControllerAdvice
class DeprecationAdvice implements ResponseBodyAdvice<Object> {

    @Override
    public boolean supports(MethodParameter returnType,
                            Class<? extends HttpMessageConverter<?>> converterType) {
        return returnType.hasMethodAnnotation(Deprecated.class);
    }

    @Override
    public Object beforeBodyWrite(Object body, MethodParameter returnType,
                                  MediaType selectedContentType,
                                  Class<? extends HttpMessageConverter<?>> converterType,
                                  ServerHttpRequest request, ServerHttpResponse response) {
        response.getHeaders().add("Deprecation", "true");   // still mutable here
        return body;
    }
}
```

The general rule that falls out: **if you want to change the response, you must
be upstream of the converter** — a filter (before the chain call), a
`ResponseBodyAdvice`, or the handler itself. `postHandle` and `afterCompletion`
are downstream, and downstream is read-only.

## `afterCompletion`, and the one condition on it

`afterCompletion` is the interceptor's `finally`: it runs after the request has
finished, whether the handler returned or threw, and it receives the exception if
there was one. It is where you stop a timer, release something `preHandle`
acquired, or clear thread state.

The condition is the part people miss: **`afterCompletion` is only called for
interceptors whose `preHandle` returned `true`.** That is the correct behaviour —
an interceptor that never got to set anything up should not be asked to tear it
down — but it means an interceptor that acquires a resource must acquire it in
`preHandle` *and return `true`*, or the release never happens. If you acquire and
then return `false`, you must release before returning.

Ordering on the way out is the reverse of the way in, matching the stack in
[chunk 1](01-the-full-path.md): `preHandle` runs in registration order,
`postHandle` and `afterCompletion` in reverse.

## Where interceptor exceptions go — and it is not where filter exceptions go

An interceptor runs *inside* `DispatcherServlet`, which is the whole difference.
The reference says the resolvers are used "to resolve exceptions thrown during
request processing", and interceptor callbacks are part of that processing. So an
exception thrown from `preHandle` or `postHandle` is a candidate for the
`HandlerExceptionResolver` chain, and therefore for your `@ControllerAdvice` —
unlike the filter case in [chunk 2](02-filters.md).

⚠️ **Stated with a caveat, because the reference does not spell it out
callback-by-callback.** The behaviour follows from where the callbacks are
invoked rather than from an explicit sentence, and the treatment of an exception
thrown from `afterCompletion` in particular — after the response is already
complete — is not something the reference documents. If your design depends on
it, confirm it against the `DispatcherServlet` source for the version you run
rather than on this page.

## Registering them, and the security warning worth taking literally

```java
@Configuration
class WebConfiguration implements WebMvcConfigurer {

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new LocaleChangeInterceptor());
        registry.addInterceptor(new ApiBudgetInterceptor())
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/health", "/api/public/**");
    }
}
```

Order is the order you call `addInterceptor`. There is no `@Order` involved —
this is a different registry from the servlet filter chain, configured a
different way, which is the comparison [chunk 8](08-registration-and-ordering.md)
draws out.

And then the sentence that decides a whole row of [chunk 5](05-the-decision-table.md):

> Interceptors are not ideally suited as a security layer due to the potential
> for a mismatch with annotated controller path matching. Generally, we recommend
> using Spring Security, or alternatively a similar approach integrated with the
> Servlet filter chain, and applied as early as possible.

The mismatch is real and specific: an interceptor's `addPathPatterns` is matched
against the request path by the interceptor registry, while the handler is chosen
by `HandlerMapping` using its own pattern set, decoding rules and matching
options. Two matchers over one string will eventually disagree, and when a
security decision depends on which one is right, "eventually" is a vulnerability.
Authentication and authorisation belong in the filter chain, where Spring
Security puts them — [Topic 11](../11-spring-security/README.md).

⚠️ For handlers that return a `Callable`, `DeferredResult` or
`CompletableFuture`, `AsyncHandlerInterceptor` replaces those callbacks on the
first pass with `afterConcurrentHandlingStarted(..)`; see
[chunk 10](10-threads-scope-and-async.md).

## Gotchas

**⚠️ Adding a header in `postHandle`**
**Symptom:** the header never reaches the client and nothing is logged.
**Cause:** for `@ResponseBody`/`ResponseEntity` handlers the response is written
and committed inside the `HandlerAdapter`, before `postHandle` runs.
**Fix:** use a `ResponseBodyAdvice` (shown above), or set it in a filter before
`chain.doFilter`.

**⚠️ `preHandle` returns `false` and the client gets an empty 200**
**Symptom:** rejected requests look successful.
**Cause:** returning `false` only stops the chain; it writes nothing.
**Fix:** set the status, headers and body yourself before returning `false`, and
match the error contract the rest of the API uses.

**⚠️ Casting `handler` to `HandlerMethod` without checking**
**Symptom:** `ClassCastException` on static resources or functional endpoints.
**Cause:** `HandlerMapping` also returns `ResourceHttpRequestHandler` and
`HandlerFunction`.
**Fix:** `if (!(handler instanceof HandlerMethod method)) return true;` as the
first line.

**⚠️ Acquiring in `preHandle` and expecting `afterCompletion` regardless**
**Symptom:** a leaked lock, connection or `ThreadLocal` on rejected requests.
**Cause:** `afterCompletion` runs only for interceptors whose `preHandle`
returned `true`.
**Fix:** release before returning `false`, or acquire only on the path that
returns `true`.

**⚠️ Using an interceptor for authorisation**
**Symptom:** an endpoint is reachable through a path shape the interceptor's
pattern did not match.
**Cause:** the reference's documented mismatch between interceptor path patterns
and controller path matching.
**Fix:** move it to the filter chain — in practice, to Spring Security.

## Interview questions

**★ What can an interceptor do that a filter cannot?**
See the handler. By the time `preHandle` runs, `HandlerMapping` has already
chosen the `HandlerMethod`, so the interceptor can read annotations off the
controller method, look at the declaring class, or branch on the URI pattern that
matched rather than the raw path. Everything an interceptor does that is worth
doing depends on that; if your interceptor never touches the `handler` argument,
it should probably have been a filter.

**★ Why is `postHandle` almost useless in a REST API?**
Because a REST API is all `@ResponseBody`, and the documentation is explicit
that for those handlers "the response is written and committed within the
`HandlerAdapter`, before `postHandle` is called. That means it is too late to
change the response". You can still read the status, but any mutation is a no-op.
The documented replacement is `ResponseBodyAdvice`, which runs before the
converter writes.

**★ `preHandle` returns `false`. What does the client receive?**
Whatever you wrote on the response before returning. The framework does not
synthesise a status — the dispatch sequence explicitly assumes "the request could
already have been fulfilled" by the interceptor. If you write nothing, the client
gets an empty 200, which is the worst possible outcome for a rejection because it
looks like success to every client library.

**★ An interceptor acquires a distributed lock in `preHandle`. Where do you release it?**
In `afterCompletion`, which runs whether the handler returned or threw and
receives the exception. But only for interceptors whose `preHandle` returned
`true` — so if any path in `preHandle` returns `false` after the lock has been
taken, that path must release it itself. The safest shape is to acquire as the
last statement before `return true`.

**★ Is `@ControllerAdvice` able to handle an exception thrown from an interceptor?**
Yes in the ordinary case, and this is the sharp contrast with filters. An
interceptor is invoked inside `DispatcherServlet`'s processing, and the
documentation says the `HandlerExceptionResolver` beans resolve "exceptions
thrown during request processing". A filter is outside the servlet entirely, so
its exceptions bypass the resolvers. I would still verify the `afterCompletion`
case against the source for the version I am on, because that callback runs after
the response is complete and the reference does not document its behaviour.

**★ Why does Spring warn against using interceptors as a security layer?**
Because interceptor path patterns are matched by the interceptor registry, while
the handler is selected by `HandlerMapping` with its own patterns and decoding
rules. Two independent matchers over the same URL eventually disagree, and a
disagreement in a security check is an authorisation bypass. The documentation's
recommendation is Spring Security, or something else "integrated with the Servlet
filter chain, and applied as early as possible" — that is, one layer out, where
the decision is made before routing rather than alongside it.

---

← Prev: [Filters](02-filters.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [AOP at the web boundary](04-aop-at-the-web-boundary.md)
