---
title: "DispatcherServlet, the front controller"
sidebar_label: "3 · DispatcherServlet"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Framework 7.0 reference *Web on
> Servlet Stack → DispatcherServlet*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-servlet.html — the
> special bean types, `doService`/`doDispatch`, the context hierarchy,
> `DispatcherServlet.properties`), the Spring Boot reference *Servlet Web
> Applications* (docs.spring.io/spring-boot/reference/web/servlet.html —
> the `DispatcherServlet` registration and `spring.mvc.*` properties), and the
> Framework 7.0 reference sections on annotated controllers (argument
> resolvers, return-value handlers and `HttpMessageConverter`).
> Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Spring MVC's central design decision is that your application registers
exactly *one* servlet. `DispatcherServlet` takes every request and then asks a
set of pluggable strategy beans what to do with it — which handler, how to
invoke it, how to convert the return value, how to turn an exception into a
response. That indirection is the whole framework: your `@RestController` is
not a servlet and knows nothing about HTTP plumbing, because a strategy object
sits between it and the container. Once you can name those strategies you can
answer almost every "how do I customise Spring MVC" question mechanically,
because each one is a slot with a default you are allowed to replace.**

## The front controller

The classic alternative is one servlet per endpoint, each registered against a
URL pattern, each parsing and serializing by hand. The front-controller pattern
replaces that with one servlet that owns a *shared algorithm* and delegates
every variable part.

`DispatcherServlet` extends `HttpServlet`. `doService` prepares the request —
locale, flash attributes, context exposure — and `doDispatch` runs the
algorithm:

1. Ask each `HandlerMapping` for a handler matching this request. This is what
   turns `GET /orders/42` into "the `find` method on `OrderController`",
   wrapped with any matching interceptors.
2. Find the `HandlerAdapter` that knows how to invoke that handler.
   `@RequestMapping` methods, functional routes and plain `HttpRequestHandler`s
   are all different shapes; the adapter is why the dispatcher does not care.
3. Run the interceptors' `preHandle` methods.
4. Invoke the handler through the adapter — this is where argument resolution
   and return-value handling live.
5. Run `postHandle`.
6. Resolve the view (or, for `@ResponseBody`/`@RestController`, skip views
   entirely because the return value was already written by a message
   converter).
7. If anything above threw, hand the exception to the `HandlerExceptionResolver`
   chain instead.

### The special beans

`DispatcherServlet` looks up these types in its `ApplicationContext` by
convention, and falls back to defaults declared in `DispatcherServlet.properties`
when you provide none:

| Interface | What it decides |
|---|---|
| `HandlerMapping` | which handler serves this request |
| `HandlerAdapter` | how to invoke a handler of that shape |
| `HandlerExceptionResolver` | how an exception becomes a response |
| `ViewResolver` | a logical view name → a `View` |
| `LocaleResolver` | the request's locale |
| `MultipartResolver` | parsing `multipart/form-data` |
| `FlashMapManager` | attributes surviving a redirect |
| `RequestToViewNameTranslator` | a view name when the handler returned none |

This table is worth memorising, because it is the map of every extension point
Spring MVC has. Nearly every "how do I customise X" question in Spring MVC
resolves to "replace or add to one of these eight beans" — and
`@ControllerAdvice`, which **[Topic 09 — Error handling](../09-error-handling/README.md)**
covers, is a wrapper over `HandlerExceptionResolver`.

## The context hierarchy Boot mostly deletes

Classic Spring MVC has two `ApplicationContext`s: a **root** context (shared
infrastructure — services, repositories, transaction management) loaded by
`ContextLoaderListener` into the `ServletContext`, and a **servlet** context
per `DispatcherServlet` (controllers, view resolvers) which is its *child* and
can therefore see the parent's beans but not vice versa.

Spring Boot registers a single `DispatcherServlet` and a single context, so in
a Boot application the hierarchy is flat and you can stop thinking about it.
You still need the model for two situations: reading Spring MVC documentation
written against the two-level arrangement, and debugging an inherited
application that genuinely has two contexts, where "the bean exists but isn't
injected" is explained by direction — a root-context bean cannot see a
servlet-context bean.

## Where your method signature comes from

The step the summary above glosses as "invoke the handler through the adapter"
is where most of Spring MVC's apparent magic actually lives.
`RequestMappingHandlerAdapter` does not call your method directly. For each
parameter it walks a list of `HandlerMethodArgumentResolver`s until one claims
the parameter, and for the return value it walks a list of
`HandlerMethodReturnValueHandler`s:

```java
@GetMapping("/orders/{id}")
OrderView find(@PathVariable String id,              // PathVariableMethodArgumentResolver
               @RequestParam(defaultValue = "false") boolean expand,
               @RequestHeader("X-Tenant") String tenant,
               Authentication auth,                  // contributed by Spring Security
               HttpServletRequest raw) {             // ServletRequestMethodArgumentResolver
    // ...
}
```

Nothing about that signature is hardcoded. Each annotation maps to a resolver,
and the list is extensible — which is how Spring Security contributes
`Authentication`, and how you add a resolver for, say, a `@CurrentUser`
annotation of your own.

The return side is the same shape. On an `@RestController`, the
`RequestResponseBodyMethodProcessor` handles the return value by picking an
`HttpMessageConverter` through content negotiation and writing the body
directly — which is exactly why the view-resolution step is skipped. "Returning
JSON" is not a feature; it is a converter being selected because the request
said `Accept: application/json` and Jackson is on the classpath. Content
negotiation and converter customisation in detail belong to
**[Topic 07 — REST controllers](../07-rest-controllers/README.md)**.

## `@EnableWebMvc` — the annotation that turns Boot off

`@EnableWebMvc` imports Spring MVC's default configuration. In a plain Spring
application that is what you want. In a **Spring Boot** application it is
almost always a mistake, because Boot's `WebMvcAutoConfiguration` is annotated
`@ConditionalOnMissingBean(WebMvcConfigurationSupport.class)` — and
`@EnableWebMvc` registers exactly that bean.

The consequence is that adding one annotation silently switches off Boot's
entire web auto-configuration: static resource handling, the configured message
converters, `spring.mvc.*` properties, error handling. Nothing fails; things
just stop being configured.

```java
@Configuration
// @EnableWebMvc                          // ⛔ do not, in a Boot application
class WebConfig implements WebMvcConfigurer {   // ✅ customise, keep the defaults

    @Override
    public void addFormatters(FormatterRegistry registry) {
        registry.addConverter(new StringToOrderStatusConverter());
    }
}
```

Implementing `WebMvcConfigurer` adds to Boot's configuration. `@EnableWebMvc`
replaces it. That distinction — *add to* versus *replace* — recurs across every
one of the special beans.

## Gotchas

### Two contexts, and a bean that "isn't injected"

**Symptom.** A controller cannot autowire a service that unambiguously exists.

**Cause.** In a classic two-context application, the child (servlet) context
sees the root context's beans, but the root context cannot see the child's. A
bean declared in the `DispatcherServlet` context is invisible to anything in
the root.

**Fix.** Move the bean to the root context, or — in a Boot application, where
this should not arise — check that nobody has hand-registered a second
`DispatcherServlet` with its own context. A quick way to tell is that the bean
name appears in one context's bean list and not the other's.

### `@EnableWebMvc` in a Boot application

**Symptom.** After adding a `@Configuration` class, static resources 404,
`spring.mvc.*` properties stop taking effect, and JSON serialisation settings
you configured are ignored — all at once, with no error.

**Cause.** The class carries `@EnableWebMvc`, which registers
`WebMvcConfigurationSupport`. Boot's `WebMvcAutoConfiguration` is conditional on
that bean being *absent*, so the whole auto-configuration backs off.

**Fix.** Delete the annotation and implement `WebMvcConfigurer` instead, which
customises Boot's configuration rather than replacing it:

```java
@Configuration
class WebConfig implements WebMvcConfigurer {
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new TimingInterceptor());
    }
}
```

### Assuming `DispatcherServlet` handles every URL

**Symptom.** A request to a path you expected Spring to route returns the
container's own 404 page rather than your error handling.

**Cause.** `DispatcherServlet` is mapped to `/` by default, but that mapping
competes with `server.servlet.context-path`, with explicitly registered
servlets, and — if enabled — with the container's default servlet.

**Fix.** Keep `server.servlet.register-default-servlet` at its default of
`false` unless you need the container serving static files, and register
additional servlets on explicit, non-overlapping patterns via
`ServletRegistrationBean`.

## Interview questions

**★ What is the front controller pattern and what does `DispatcherServlet` actually do with a request?**
One servlet receives every request and owns a fixed algorithm, delegating each
variable step to a pluggable strategy bean. `doService` prepares request
attributes; `doDispatch` then resolves a handler via the `HandlerMapping`
chain, finds a `HandlerAdapter` that can invoke that handler shape, runs
interceptor `preHandle` methods, invokes the handler, runs `postHandle`,
resolves and renders a view — or skips the view entirely when a message
converter already wrote the body — and routes any exception to the
`HandlerExceptionResolver` chain. The value of the indirection is that your
controller is a plain object: it never touches `HttpServletRequest` unless it
asks to.

**★ Name the special bean types `DispatcherServlet` depends on, and what happens if you declare none.**
`HandlerMapping`, `HandlerAdapter`, `HandlerExceptionResolver`, `ViewResolver`,
`LocaleResolver`, `MultipartResolver`, `FlashMapManager` and
`RequestToViewNameTranslator`. If the context declares none, `DispatcherServlet`
falls back to the defaults listed in `DispatcherServlet.properties`, which is
why a bare Spring MVC application works at all. Declaring one of these types
generally *replaces* the default for that slot rather than adding to it, which
is the usual explanation for "I added a `ViewResolver` and everything else
stopped working".

**★ Explain the root context versus the servlet context, and which can see which.**
The root `WebApplicationContext` holds shared infrastructure — services,
repositories, transaction management — and is loaded into the `ServletContext`
by `ContextLoaderListener`. Each `DispatcherServlet` gets its own child context
for web-layer beans. Children can resolve beans from the parent; the parent
cannot see into a child. Spring Boot uses a single context, so this matters
mainly for reading older documentation and for debugging inherited
applications, where the direction of visibility explains injection failures
that otherwise look impossible.

**★ How does Spring decide what to pass to each parameter of a controller method?**
`RequestMappingHandlerAdapter` holds an ordered list of
`HandlerMethodArgumentResolver`s and asks each in turn whether it supports a
given `MethodParameter`; the first that claims it produces the value. That is
why `@PathVariable`, `@RequestParam`, `@RequestHeader`, `@RequestBody`,
`HttpServletRequest`, `Principal` and framework-contributed types like
Spring Security's `Authentication` can all coexist in one signature with no
fixed order. The list is extensible, so a custom resolver is how you make your
own annotation — a `@CurrentUser`, say — work in a signature. The return value
goes through the mirror-image `HandlerMethodReturnValueHandler` list.

**★ Why does an `@RestController` skip view resolution entirely?**
Because `@RestController` is `@Controller` plus `@ResponseBody`, and a
`@ResponseBody` return value is claimed by `RequestResponseBodyMethodProcessor`,
which selects an `HttpMessageConverter` by content negotiation and writes the
response body itself. Once the body is written the dispatcher has nothing left
to render, so the `ViewResolver` step is bypassed. This is also why "it returns
JSON" depends on two separate things being true — a converter capable of the
negotiated media type being present, and the `Accept` header (or a producible
media type on the mapping) selecting it.

**★ What does `@EnableWebMvc` do in a Spring Boot application, and why is it usually wrong?**
It imports `WebMvcConfigurationSupport`, Spring MVC's own default
configuration. Boot's `WebMvcAutoConfiguration` is declared
`@ConditionalOnMissingBean(WebMvcConfigurationSupport.class)`, so registering it
makes Boot's entire web auto-configuration back off — static resource handlers,
the pre-configured message converters, `spring.mvc.*` properties and the
default error handling all disappear silently. The correct way to customise a
Boot MVC application is to implement `WebMvcConfigurer`, which contributes to
the auto-configuration instead of replacing it. `@EnableWebMvc` is right only
in a plain Spring application with no Boot auto-configuration to lose.

**★ Why might a `DispatcherServlet` request produce the container's 404 page rather than your error handling?**
Because the request never reached `DispatcherServlet`. It is mapped to `/` by
default, but that mapping interacts with `server.servlet.context-path`, with
any other servlets registered on overlapping patterns, and with the container's
default servlet when `server.servlet.register-default-servlet` is enabled. If
another servlet wins the mapping, or the path falls outside the context path,
Spring's error handling is simply not in the picture. The diagnostic question
is always "which servlet actually handled this", not "why did my exception
handler not run".

---

← Prev: [The container's own extension points](02-filters-and-the-container.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The embedded container](04-the-embedded-container.md)
