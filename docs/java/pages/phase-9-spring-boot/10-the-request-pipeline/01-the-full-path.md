---
title: "The full path a request takes"
sidebar_label: "1 · The full path"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework 7.0 reference — *Web MVC →
> DispatcherServlet*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-servlet.html), its
> *Processing* sequence page (`mvc-servlet/sequence.html`, the five numbered
> steps quoted below) and *Interception*
> (`mvc-servlet/handlermapping-interceptor.html`) — and the Jakarta Servlet 6.1
> javadoc for `jakarta.servlet.Filter`
> (jakarta.ee/specifications/servlet/6.1/apidocs). Spring Boot 4.1.0, Spring
> Framework 7.0.x, JDK 25.

**Filters, interceptors and AOP advice are not three styles of doing the same
job. They are three *depths* in one nested call stack, and every difference
between them — what they can see, what they can change, which of them catches
your exception, which of them runs when the URL matched nothing — is a
mechanical consequence of that depth. A filter wraps `DispatcherServlet`. An
interceptor lives inside it. AOP advice lives inside your own bean, one frame
below the handler method. Learn the stack once and you never have to memorise a
comparison table; the table falls out of the picture.**

## The stack, drawn once

Everything in this topic refers back to this. It is a call stack, not a queue:
each layer *calls* the next and then gets control back on the way out.

```
servlet container (embedded Tomcat)
└── FilterChain
    ├── filter 1: code before chain.doFilter(...)   ← raw bytes; may WRAP req/res
    │   └── filter 2: code before chain.doFilter(...)
    │       └── DispatcherServlet.doDispatch()
    │           ├── HandlerMapping  → HandlerExecutionChain (handler + interceptors)
    │           ├── interceptor.preHandle()          ← registration order
    │           ├── HandlerAdapter.handle()
    │           │   ├── @InitBinder / @ModelAttribute (advice-level, then controller)
    │           │   ├── argument resolution          (HandlerMethodArgumentResolver)
    │           │   ├── [ AOP proxy ] your controller method
    │           │   │        └── [ AOP proxy ] your service method
    │           │   └── return value → HttpMessageConverter → response committed
    │           ├── interceptor.postHandle()         ← reverse order
    │           ├── HandlerExceptionResolver         ← @ControllerAdvice lives HERE
    │           ├── view rendering (only if a model and view were returned)
    │           └── interceptor.afterCompletion()    ← reverse order
    │       └── filter 2: code after chain.doFilter(...)
    └── filter 1: code after chain.doFilter(...)
```

Two facts to take from the shape before any detail:

- **`@ControllerAdvice` is *inside* `DispatcherServlet`.** It is a
  `HandlerExceptionResolver`, and a resolver is a delegate the servlet consults.
  Anything that throws before `DispatcherServlet` is entered — that is, anything
  in a filter — is thrown *past* it. This single fact is the most expensive
  thing on the page; [chunk 2](02-filters.md) is largely about living with it.
- **The response can already be sent before the outer layers finish.** For a
  `@ResponseBody` handler the bytes are written inside `HandlerAdapter.handle()`,
  so `postHandle`, `afterCompletion` and every filter's unwinding code run with a
  committed response they can no longer change.

## What `DispatcherServlet` does, in the documented order

The reference documents the sequence as five steps. Paraphrased, in order:

1. The `WebApplicationContext` is bound into the request as an attribute (under
   `DispatcherServlet.WEB_APPLICATION_CONTEXT_ATTRIBUTE`).
2. The locale resolver is bound to the request, so later stages can resolve a
   locale.
3. If a multipart resolver is configured, the request is inspected for
   multiparts and, if found, wrapped in a `MultipartHttpServletRequest`.
4. An appropriate handler is searched for. If one is found, the execution chain
   associated with it — the reference's words are "preprocessors, postprocessors,
   and controllers" — is run. For annotated controllers, the reference notes that
   "the response can be rendered (within the `HandlerAdapter`) instead of
   returning a view".
5. If a model is returned, the view is rendered. If none is — "maybe due to a
   preprocessor or postprocessor intercepting the request, perhaps for security
   reasons" — no view is rendered.

Exceptions are handled alongside that sequence: "The `HandlerExceptionResolver`
beans declared in the `WebApplicationContext` are used to resolve exceptions
thrown during request processing."

Step 4 is doing a great deal of work in one sentence, and unpacking it is most
of what a Spring developer needs.

## Inside step 4: mapping, then adapting

**Mapping** produces a `HandlerExecutionChain` — the handler *plus the ordered
list of interceptors that matched its path*. That pairing is the reason an
interceptor can see the handler at all: by the time `preHandle` runs, the
framework has already decided which method will be invoked. A filter, running
before any of this, cannot know.

If no handler matches, there is no chain, so **there are no interceptors to
run**. A concern that must also cover 404s cannot live in an interceptor. That
test — *does this have to run for requests that never reach a handler?* — is one
of the three questions in [chunk 5](05-the-decision-table.md).

**Adapting** is `RequestMappingHandlerAdapter` doing four things in order:

1. Applying `@InitBinder` methods — advice-level ones first, then the
   controller's own — to configure the `WebDataBinder` used for binding.
2. Applying `@ModelAttribute` methods, again advice-level first, populating the
   model before any argument is resolved.
3. Resolving every method argument through the `HandlerMethodArgumentResolver`
   chain — this is where `@RequestBody` reads the body and `@PathVariable` reads
   the URI template variables. Topic 07 covers that stage in detail.
4. Invoking the method, then passing its return value to the
   `HandlerMethodReturnValueHandler` chain, which for `@ResponseBody` selects an
   `HttpMessageConverter` and **writes the response**.

A `@ControllerAdvice` bean therefore has three quite different jobs living in
one place, at two different depths: `@InitBinder` and `@ModelAttribute` run
*before* your handler inside the adapter, while `@ExceptionHandler` runs *after*
it inside the resolver chain. Grouping them under one annotation is a packaging
decision, not a statement that they are related.

## Where your own code sits

Your controller method is not called directly. If the bean is proxied — because
something on it is `@Transactional`, `@Async`, `@Cacheable`, `@Retryable`, or
matched by an `@Aspect` — the adapter invokes the **proxy**, which runs the
advice chain and then the target method. The same is true one frame further
down for the service the controller calls. That is the layer AOP operates at,
and why AOP sees typed arguments rather than an `HttpServletRequest`; see
[chunk 4](04-aop-at-the-web-boundary.md).

The proxy mechanics — why a `this.` call skips the advice entirely — are
established in
[Topic 02, chunk 5](../02-the-ioc-container/05-proxies-and-self-invocation.md).
This topic uses that fact rather than re-deriving it.

## The unwinding, which is where most surprises live

On the way out, control returns in reverse:

| Stage | Order | Response state |
|---|---|---|
| `HttpMessageConverter` writes the body | — | becomes committed here |
| `postHandle` | reverse of registration | already committed for `@ResponseBody` |
| exception resolution | — | only if something threw |
| view rendering | — | only for model-and-view handlers |
| `afterCompletion` | reverse of registration | committed |
| filter code after `chain.doFilter(...)` | reverse of registration | committed |

"Committed" means the status line and headers have gone to the client. Setting a
header after that point does nothing — no exception, no log line, just a header
that never arrives. It is the reason `postHandle` disappoints people, and the
reason a "response logging" filter that reads `response.getStatus()` works while
one that *changes* the status does not.

## Gotchas

**⚠️ Treating the pipeline as a queue rather than a stack**
**Symptom:** you expect filter 1 to finish before filter 2 starts, and you are
baffled that a `try/finally` in filter 1 sees the exception a controller threw.
**Cause:** `chain.doFilter(...)` is a *call*. Filter 1's frame is still on the
stack for the entire request, including the controller.
**Fix:** read every filter as `before(); chain.doFilter(...); after();` — and
put the `after()` in a `finally`, because the call can throw.

**⚠️ Expecting `@ControllerAdvice` to catch a filter's exception**
**Symptom:** an exception in a JWT-parsing filter returns Boot's default error
body instead of your `ProblemDetail`.
**Cause:** the advice is a `HandlerExceptionResolver`, consulted by
`DispatcherServlet` — a servlet the request never reached.
**Fix:** handle it inside the filter and write the body yourself; the shape is
in [chunk 2](02-filters.md), and the error contract it must match is
**[Topic 09 — Error handling](../09-error-handling/README.md)**.

**⚠️ Putting an authorisation check in an interceptor and finding it never runs**
**Symptom:** requests to a mistyped path bypass the check.
**Cause:** no handler matched, so there is no `HandlerExecutionChain` and no
interceptors — and the reference explicitly warns that interceptors are "not
ideally suited as a security layer due to the potential for a mismatch with
annotated controller path matching".
**Fix:** authorisation belongs in the filter chain; see
[Topic 11 — Spring Security](../11-spring-security/README.md).

**⚠️ Assuming one request equals one pass through the filter chain**
**Symptom:** your filter's logging fires twice, or a counter double-counts.
**Cause:** `FORWARD`, `INCLUDE`, `ASYNC` and `ERROR` are separate *dispatches*,
and a container may route several of them through the same filter.
**Fix:** extend `OncePerRequestFilter`, whose contract is "a single execution per
request dispatch, on any servlet container" — detail in
[chunk 2](02-filters.md).

## Interview questions

**★ Walk me through what happens between the socket and my controller method.**
The container hands the request to the filter chain; each filter runs its
pre-work and calls `chain.doFilter`, which eventually reaches
`DispatcherServlet`. The servlet binds the application context and locale
resolver, checks for multiparts, then asks its `HandlerMapping` beans for a
`HandlerExecutionChain` — the handler method plus the interceptors whose path
patterns matched. It runs each `preHandle`, then hands the chain to a
`HandlerAdapter`, which applies `@InitBinder` and `@ModelAttribute` methods,
resolves every argument, and invokes the method — through an AOP proxy if the
bean has one. The return value goes to a message converter, which writes the
body. Then `postHandle`, then exception resolution if anything threw, then
rendering if there is a view, then `afterCompletion`, and finally each filter's
code after its `doFilter` call, in reverse order.

**★ Why can't a `@ControllerAdvice` handle an exception thrown by a servlet filter?**
Because `@ControllerAdvice`'s `@ExceptionHandler` methods are reached through
`HandlerExceptionResolver`, and the resolvers are components
`DispatcherServlet` consults. A filter sits outside the servlet, so an
exception it throws propagates to the container, which does its own error
dispatch. The advice is never asked. This is not a bug or an ordering problem
you can configure away — it is the nesting.

**★ Which layer sees the URI template `/orders/{id}` rather than `/orders/42`?**
Everything from `HandlerMapping` inwards. Mapping is what resolves the pattern
and extracts the variables, so an interceptor and the handler see the pattern
(and Micrometer's `uri` tag uses it, which is what keeps HTTP metrics from
exploding in cardinality). A filter runs before mapping and only has the raw
path. That is why a rate limiter keyed on "the endpoint" is awkward as a filter
and easy as an interceptor.

**★ Where exactly does a `@ResponseBody` response get written?**
Inside `HandlerAdapter.handle()`, by a `HandlerMethodReturnValueHandler` that
selects an `HttpMessageConverter`. The reference makes the point directly: for
annotated controllers "the response can be rendered (within the
`HandlerAdapter`) instead of returning a view". Everything after that in the
pipeline is looking at a committed response.

**★ If I want to add a response header for every request, where should it go?**
In a filter, before `chain.doFilter`, or in a `ResponseBodyAdvice`. Not in
`postHandle` — the documentation is explicit that for `@ResponseBody` and
`ResponseEntity` methods "the response is written and committed within the
`HandlerAdapter`, before `postHandle` is called. That means it is too late to
change the response, such as to add an extra header."

**★ What is a `HandlerExecutionChain` and why does it matter?**
It is the object a `HandlerMapping` returns: the handler plus the ordered
interceptors that apply to it. It matters because it makes the coupling
explicit — interceptors exist only when a handler was found. A request that
404s produces no chain, so no interceptor sees it, which decides several rows
of the table in [chunk 5](05-the-decision-table.md).

**★ Does the order of my filters and the order of my interceptors work the same way?**
No, and confusing them is common. Filter order is a servlet-container concern
that Boot drives from `@Order`/`Ordered` **on the filter class** or from a
`FilterRegistrationBean`'s `setOrder`. Interceptor order is simply the order you
call `registry.addInterceptor(...)` in a `WebMvcConfigurer`. They are two
independent orderings in two different registries, and no `@Order` on an
interceptor bean affects the second one.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Filters](02-filters.md)
