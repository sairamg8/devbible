---
title: "Functional endpoints and WebClient"
sidebar_label: "7 · Functional endpoints, WebClient"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against the Spring Framework reference *Web on Reactive
> Stack → Functional Endpoints* (`RouterFunction`, `HandlerFunction`,
> `ServerRequest`/`ServerResponse`, `HandlerFilterFunction`) and *WebClient*
> (docs.spring.io/spring-framework/reference/web/webflux-functional.html and
> .../web/webflux-webclient.html), the Spring Framework 7.0 notes on the
> deprecation of `RestTemplate` in favour of `RestClient`, and the Spring Boot
> 4 `spring-boot-starter-restclient` / `spring-boot-starter-webclient`
> starters. Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**The second programming model replaces annotations with values: a
`RouterFunction` is an object that maps a request to a `HandlerFunction`, and
both are ordinary Java you can compose, nest, filter and unit-test without a
container. And `WebClient` — the reactive HTTP client that comes with all this
— is the single piece of WebFlux most widely used by applications that are not
reactive at all.**

## Functional endpoints

```java
@Configuration
class OrderRoutes {

    @Bean
    RouterFunction<ServerResponse> orderRoutes(OrderHandler handler) {
        return RouterFunctions.route()
                .GET("/orders/{id}", accept(APPLICATION_JSON), handler::one)
                .GET("/orders", handler::all)
                .POST("/orders", handler::create)
                .build();
    }
}

@Component
class OrderHandler {

    private final OrderService orders;

    OrderHandler(OrderService orders) { this.orders = orders; }

    Mono<ServerResponse> one(ServerRequest request) {
        return orders.view(request.pathVariable("id"))
                     .flatMap(view -> ServerResponse.ok().bodyValue(view))
                     .switchIfEmpty(ServerResponse.notFound().build());
    }

    Mono<ServerResponse> create(ServerRequest request) {
        return request.bodyToMono(NewOrder.class)
                      .flatMap(orders::create)
                      .flatMap(created -> ServerResponse
                              .created(URI.create("/orders/" + created.id()))
                              .bodyValue(created));
    }
}
```

What changes, and why anyone chooses it:

- **Routing is explicit and first-class.** The mapping is a value produced by a
  method rather than metadata scattered across annotated classes. Routes
  compose with `and`, nest under a common path with `nest`, and can be wrapped
  by a `HandlerFilterFunction` — a filter that applies to a chosen subset of
  routes, which annotations cannot express without inventing a convention.
- **The response is built rather than returned.** `ServerResponse` carries
  status, headers and body in one expression, which is why the "not found" case
  above is a single `switchIfEmpty` instead of a `ResponseEntity` branch.
- **There is no annotation-driven binding.** You pull path variables, query
  parameters and the body off `ServerRequest` yourself — `pathVariable`,
  `queryParam`, `bodyToMono` — and validation is something you invoke, not
  something `@Valid` triggers.
- **Handlers are trivially unit-testable.** A `HandlerFunction` is a method
  taking one argument and returning a publisher, so a test constructs a
  `MockServerRequest` and calls it. No context, no `MockMvc`, no
  `WebTestClient` unless you want routing covered too.

The two models are equal in capability and can coexist in one application. The
annotated model dominates in practice, so a reader is far more likely to meet
it — but a gateway or a small edge service written entirely with
`RouterFunction` is a normal sight, and Spring's own documentation presents
them as peers rather than as a primary and an alternative.

## WebClient, and its blocking twin

`WebClient` is the non-blocking HTTP client:

```java
Mono<Quote> quote = webClient.get()
        .uri("/quotes/{symbol}", symbol)
        .retrieve()
        .bodyToMono(Quote.class);
```

Three things worth knowing about it:

- **It is usable from Spring MVC**, and the reference recommends exactly that
  for MVC applications making remote calls: an MVC controller may also return a
  reactive type directly, so a blocking application can fan out concurrently
  without becoming a reactive application. This is the sanctioned middle
  ground, and it is a much smaller commitment than it looks.
- **`RestClient` is its synchronous sibling**, with a deliberately similar
  fluent API. On Framework 7 it is the answer for blocking outbound HTTP,
  because **`RestTemplate` is deprecated**. Moving from `RestTemplate` to
  `RestClient` is a like-for-like modernisation, *not* a step toward reactive
  — a distinction worth making explicitly when someone proposes the migration
  as "going reactive". Boot 4 ships `spring-boot-starter-restclient` and
  `spring-boot-starter-webclient` for exactly this split.
- **Framework 7 adds `@ImportHttpServices`** and the HTTP service client
  abstraction, which lets you declare an interface and have the client
  generated — available for both the blocking and reactive clients, so the
  choice of transport becomes a configuration detail rather than a rewrite.

## Choosing between the two models

| | Annotated controllers | Functional endpoints |
|---|---|---|
| Routing | declarative, discovered by scanning | explicit, a value you construct |
| Familiarity | identical to MVC | new vocabulary |
| Cross-cutting concerns | `WebFilter`, `@ControllerAdvice` | `HandlerFilterFunction`, applied per route group |
| Binding and validation | `@PathVariable`, `@RequestBody`, `@Valid` | manual, off `ServerRequest` |
| Testing a handler alone | needs argument resolution | plain method call |
| Typical fit | applications | gateways, edge services, small APIs |

## Gotchas

### Mixing `RouterFunction` and annotated controllers on the same path

**Symptom.** One of two mappings silently wins and the other never runs.

**Cause.** They are separate handler-mapping strategies with an ordering
between them, not a merged routing table.

**Fix.** Keep them on disjoint paths, or commit to one model per application.
Coexistence is supported; overlapping routes are not a design.

### Losing validation when moving a controller to a handler function

**Symptom.** Constraint annotations that worked on a `@RequestBody` DTO stop
being enforced after a rewrite to `RouterFunction`.

**Cause.** `@Valid` is part of the annotated model's argument resolution. There
is no argument resolution in a handler function.

**Fix.** Invoke validation yourself, and fail the pipeline explicitly:

```java
Mono<ServerResponse> create(ServerRequest request) {
    return request.bodyToMono(NewOrder.class)
                  .doOnNext(this::validate)          // throws on constraint violation
                  .flatMap(orders::create)
                  .flatMap(o -> ServerResponse.ok().bodyValue(o));
}

private void validate(NewOrder body) {
    Set<ConstraintViolation<NewOrder>> violations = validator.validate(body);
    if (!violations.isEmpty()) {
        throw new ServerWebInputException(violations.toString());
    }
}
```

### `WebClient` calls that never apply a timeout

**Symptom.** A downstream service degrades and the reactive application's
in-flight request count climbs without bound.

**Cause.** Non-blocking clients do not tie up threads, so a slow downstream
produces no obvious symptom until memory or connection limits are reached. The
implicit "we only have 200 threads" limit does not exist.

**Fix.** Set a response timeout on the client and a `timeout` on the pipeline,
and bound the connection pool. This is the same lesson as the one virtual
threads teach on the blocking side — removing the thread ceiling removes the
backpressure that ceiling was accidentally providing.

### Assuming `WebClient` means the application is reactive

**Symptom.** A team reports "we moved to reactive" having only replaced
`RestTemplate` with `WebClient`, then blocks on the result.

**Cause.** `WebClient` returns publishers; calling `.block()` on them in an MVC
handler is legal and reasonable, but it means the thread is parked exactly as
before. Nothing about the server side changed.

**Fix.** Be precise about what was gained: concurrency of downstream calls, if
you used `zip` or `flatMap` to overlap them, and nothing else. If the goal was
outbound-call modernisation rather than reactivity, `RestClient` is the
straighter path on Framework 7.

## Interview questions

**★ What are the two programming models in WebFlux and why does the functional one exist?**
Annotated controllers, and functional endpoints built from `RouterFunction` and
`HandlerFunction`. The functional model makes routing a first-class value:
routes compose, nest and can be filtered per group with ordinary code, handlers
are plain methods taking a `ServerRequest` and returning `Mono<ServerResponse>`,
and there is no annotation processing between you and the dispatch. It suits
gateways and small edge services; the annotated model dominates everywhere else
because it matches what teams already know.

**★ How do you read a path variable, a query parameter and the body in a handler function?**
`request.pathVariable("id")`, `request.queryParam("page")` (which returns an
`Optional<String>`), and `request.bodyToMono(Type.class)` or `bodyToFlux`.
Everything that annotations resolved for you becomes an explicit call, which is
the model's whole trade: more code, no magic, and a handler you can call
directly in a test.

**★ Can you use `WebClient` in a Spring MVC application?**
Yes, and the Spring reference recommends it for MVC applications making remote
calls — an MVC controller can also return a reactive type directly. It is the
sanctioned middle ground: keep the blocking servlet stack for your own
handlers, use the non-blocking client to fan out to several downstream services
concurrently. On Framework 7 the purely synchronous alternative is
`RestClient`, since `RestTemplate` is deprecated.

**★ Is `.block()` ever acceptable?**
In a `main` method, a test, or a genuinely blocking context, yes — that is how
you leave the reactive world, and an MVC handler calling `.block()` on a
`WebClient` result is a normal thing to write. Inside a WebFlux handler or any
operator running on an event-loop thread, never: Reactor detects `block()` on a
non-blocking scheduler thread and throws rather than letting you stall a core's
worth of the application. Its appearance in production WebFlux code is nearly
always a sign that the codebase is fighting the model.

**★ Someone proposes migrating from `RestTemplate` to `WebClient` "to go reactive". What do you say?**
That those are two separate decisions. `RestTemplate` is deprecated on
Framework 7 and does need replacing, but the like-for-like replacement is
`RestClient`, which is synchronous and keeps every call site unchanged in shape.
Adopting `WebClient` instead only pays off if you are either going to compose
its publishers — overlapping downstream calls with `zip` or `flatMap` — or
moving the whole application to a non-blocking stack. Otherwise you have taken
on Reactor's vocabulary and stack traces to make the same blocking call.

---

← Prev: [Annotated controllers and streaming responses](06-annotated-controllers.md) · Index: [WebFlux and reactive](README.md) · Next → [The cost: the colour of your functions](08-the-colour-of-functions.md)
