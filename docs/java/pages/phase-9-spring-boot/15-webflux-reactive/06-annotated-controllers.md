---
title: "Annotated controllers and streaming responses"
sidebar_label: "6 · Annotated controllers"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against the Spring Framework reference *Web on Reactive
> Stack* — *Annotated Controllers*, *Functional Endpoints*
> (`RouterFunction`/`HandlerFunction`), *WebFlux Config* and *WebClient*
> (docs.spring.io/spring-framework/reference/web/webflux.html) — the Spring
> Boot reference *Reactive Web Applications*, which names the
> `spring-boot-starter-webflux` starter, Reactor Netty as the default server,
> and the behaviour when both web starters are present
> (docs.spring.io/spring-boot/reference/web/reactive.html) — and the Spring
> Boot 4.0 migration guide's starter renames. Spring Boot 4.1.1, Spring
> Framework 7.0.x, JDK 25.

**WebFlux offers two programming models over the same runtime, and the first
one is deliberately indistinguishable from Spring MVC at a glance: the same
`@RestController`, the same `@GetMapping`, the same `@PathVariable`. Only the
return type changes. That similarity is a feature — it makes reactive code
readable to anyone who knows MVC — and a trap, because it hides the fact that
the servlet API is gone and the rules about blocking are now absolute.**

## Getting one

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-webflux</artifactId>
</dependency>
```

Two version notes that matter on Boot 4:

- **The WebFlux starter kept its name.** Boot 4.0 renamed
  `spring-boot-starter-web` to **`spring-boot-starter-webmvc`** (along with
  `-aop` → `-aspectj` and the OAuth2 starters), but `spring-boot-starter-webflux`
  is not in the rename list. So the two starters are now *asymmetrically*
  named, and a Boot 3 sample's `spring-boot-starter-web` will not resolve.
- **Adding both starters gives you MVC, not WebFlux.** Spring Boot's reference
  states this explicitly; if both are on the classpath the application is
  auto-configured as a servlet application. Forcing the other way requires
  setting the web application type to reactive on the `SpringApplication`.
  This is a real hazard in a multi-module build where a shared library drags in
  the MVC starter transitively.

The default server is **Reactor Netty**. Tomcat and Jetty can also run WebFlux
— the reactive stack does not require Netty, it requires non-blocking I/O,
which Servlet 3.1+ containers can provide.

## Annotated controllers

```java
@RestController
@RequestMapping("/orders")
class OrderController {

    private final OrderService orders;

    OrderController(OrderService orders) {          // constructor injection, unchanged
        this.orders = orders;
    }

    @GetMapping("/{id}")
    Mono<OrderView> one(@PathVariable String id) {
        return orders.view(id);
    }

    @GetMapping
    Flux<OrderView> all(@RequestParam(defaultValue = "0") int page) {
        return orders.page(page);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    Mono<OrderView> create(@RequestBody @Valid Mono<NewOrder> body) {
        return body.flatMap(orders::create);
    }
}
```

Everything about the annotations is what
[Topic 07 · REST controllers](../07-rest-controllers/01-the-controller-and-the-pipeline.md)
describes. The differences are all in what flows through them:

- **Return types are publishers.** `Mono<T>` for one, `Flux<T>` for many,
  `Mono<Void>` for a body-less response, `Mono<ResponseEntity<T>>` when you
  need to set status and headers dynamically.
- **`@RequestBody` may itself be a publisher.** `Mono<NewOrder>` means the body
  is decoded as it arrives rather than after it has all arrived —
  `Flux<Item>` for a streamed body. Taking the plain type is also allowed and
  is much more common.
- **There is no `HttpServletRequest`.** The reactive equivalent is
  `ServerWebExchange`, or `ServerHttpRequest`/`ServerHttpResponse`. Any code
  reaching for the servlet API will not compile, and any library that reaches
  for it at runtime will not work.
- **Filters are `WebFilter`, not servlet `Filter`.** Same idea — a chain around
  the handler — different type, and it returns a `Mono<Void>`. See
  [Topic 01 · Filters and the container](../01-why-frameworks-servlet-model/02-filters-and-the-container.md)
  for the servlet side of the comparison.
- **Exception handling is identical.** `@ExceptionHandler`,
  `@ControllerAdvice`, `ResponseStatusException` and `@ResponseStatus` all work
  the same way, and handler methods may return publishers.

## What a `Flux` return type actually produces

This trips people up because it depends entirely on the content type:

| Produces | `Flux<T>` renders as |
|---|---|
| `application/json` (default) | a **single JSON array**, streamed element by element but buffered by any client that waits for the closing bracket |
| `application/x-ndjson` | newline-delimited JSON — one object per line, consumable incrementally |
| `text/event-stream` | Server-Sent Events, one `data:` frame per element |

Returning a `Flux` does not by itself give the client a stream. If streaming is
the point, say so:

```java
@GetMapping(value = "/prices", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
Flux<ServerSentEvent<Price>> prices(@RequestParam String symbol) {
    return ticker.stream(symbol)
                 .map(p -> ServerSentEvent.builder(p).event("price").build());
}
```

`ServerSentEvent` is the wrapper that lets you set the SSE `event`, `id` and
`retry` fields; a bare `Flux<Price>` with the same `produces` works too and
sends only `data:` frames. Note that MVC can also serve SSE — via `SseEmitter`,
or by returning a reactive type from a servlet-stack controller — so SSE alone
is not a reason to adopt WebFlux, though a long-lived SSE connection per client
is exactly the workload where holding a thread each hurts most.

## Gotchas

### Both web starters on the classpath

**Symptom.** A project that added `spring-boot-starter-webflux` starts as a
servlet application, `WebFilter` beans are ignored, and reactive return types
still work — which makes the misconfiguration hard to see.

**Cause.** Boot auto-configures Spring MVC when both starters are present. The
MVC starter often arrives transitively, through a shared internal library or a
starter that depends on it.

**Fix.** Find it and exclude it — `mvn dependency:tree` shows the path, as
[Phase 8 · Transitive dependencies and mediation](../../phase-8-build-dependencies/03-transitive-and-mediation/README.md)
describes. Setting the application type to reactive explicitly forces the issue
but leaves the unwanted starter in the build.

### A `Flux` return type that does not stream

**Symptom.** A "streaming" endpoint delivers everything at once when the source
completes.

**Cause.** The default content type is JSON, so the elements are rendered as
one array. Many clients also buffer until the array closes.

**Fix.** Choose a streaming media type — `text/event-stream` for SSE or
`application/x-ndjson` for newline-delimited JSON — with `produces` on the
mapping, and check that the client consumes it incrementally.

### Reaching for the servlet API

**Symptom.** Code that compiled in an MVC module fails to compile after being
moved, on `HttpServletRequest`, `HttpSession` or `Filter`.

**Cause.** WebFlux does not run on the servlet API at all. There is no
`HttpServletRequest` to obtain.

**Fix.** `ServerWebExchange` gives you the request, the response, and the
session (`exchange.getSession()` returns a `Mono<WebSession>`). Servlet
`Filter`s become `WebFilter`s. Third-party libraries that require the servlet
API simply cannot be used, which is one of the ecosystem costs in chunk 7.

### `@Valid` on a publisher body doing nothing

**Symptom.** Validation annotations on a DTO are ignored for a
`@RequestBody Mono<T>` parameter.

**Cause.** Validation applies to the decoded value; when the parameter is a
publisher, the value does not exist at the point the argument is resolved.

**Fix.** Take the plain type — `@RequestBody @Valid NewOrder body` — which is
what nearly all handlers should do anyway, or validate inside the pipeline
with an injected `Validator`. Remember also that on Boot 4 **Bean Validation is
no longer transitive**: `spring-boot-starter-validation` must be added
explicitly or none of the annotations do anything at all.

## Interview questions

**★ How does a WebFlux controller differ from an MVC controller?**
Superficially, only in the return type — the same `@RestController`,
`@GetMapping`, `@PathVariable` and `@RequestBody` annotations apply, and the
same exception-handling machinery. Underneath, there is no servlet API:
`HttpServletRequest` becomes `ServerWebExchange`, servlet `Filter` becomes
`WebFilter`, and the handler must never block, because the thread it runs on is
one of a small number of event-loop workers shared by the entire application.

**★ You return a `Flux<Trade>` from a controller. What does the client receive?**
By default a single JSON array, because the default content type is
`application/json` — which most clients buffer to completion, so nothing is
gained over returning a list. To actually stream you must select a streaming
media type in `produces`: `text/event-stream` for Server-Sent Events (optionally
wrapping elements in `ServerSentEvent` to set event names and ids), or
`application/x-ndjson` for newline-delimited JSON.

**★ What replaces `HttpServletRequest` and servlet `Filter` in WebFlux?**
`ServerWebExchange` replaces the request/response pair — it exposes
`ServerHttpRequest`, `ServerHttpResponse`, request attributes and a
`Mono<WebSession>` — and `WebFilter` replaces `Filter`, taking the exchange and
a chain and returning `Mono<Void>`. The substitution is not cosmetic: WebFlux
does not run on the servlet API at all, so any library that reaches for
`HttpServletRequest` at runtime is unusable, which is a real constraint when
choosing authentication, tracing or multi-tenancy libraries.

**★ Should `@RequestBody` be a `Mono<T>` or a plain `T`?**
Plain `T` for almost every handler. Declaring the parameter as a publisher
means the body is decoded as it arrives, which only matters for genuinely
streamed uploads — and it has a real cost: `@Valid` does not apply to a
publisher parameter, because the value does not exist when the argument is
resolved. Take `Mono<T>` or `Flux<T>` when you are processing a large or
open-ended body incrementally, and the plain type otherwise.

**★ Does using WebFlux change how validation is wired on Boot 4?**
Not in mechanism, but the Boot 4 baseline catches people either way: **Bean
Validation is no longer a transitive dependency**, so
`spring-boot-starter-validation` has to be added explicitly or the constraint
annotations are silently inert. On top of that, `@Valid` on a publisher-typed
body parameter does nothing, so a reactive handler can fail to validate for two
independent reasons at once.

**★ What happens if you add both `spring-boot-starter-webmvc` and `spring-boot-starter-webflux`?**
Spring Boot auto-configures Spring MVC — the servlet stack wins. The
documentation states this directly, and it matters because the MVC starter
frequently arrives transitively through a shared library, leaving a team
convinced they are running reactive when they are not. The fix is to find and
exclude the transitive dependency rather than to force the application type.

---

← Prev: [Schedulers and threading](05-schedulers-and-threading.md) · Index: [WebFlux and reactive](README.md) · Next → [Functional endpoints and WebClient](07-functional-endpoints-and-webclient.md)
