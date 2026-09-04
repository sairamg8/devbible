---
title: "Three tests pin an exception handler down and they sit at different distances from HTTP — assert a code only one handler emits, assert the advice ordering once by reading getExceptionHandlerAdviceCache(), and assert the chosen METHOD with a bare ExceptionHandlerMethodResolver and no Spring context at all — while standaloneSetup().setControllerAdvice(...) gives you the fastest test and the least of your wiring"
sidebar_label: "07d · Tests that pin the handler"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-30 against the **Spring Framework 7.0.9** sources —
> `ExceptionHandlerExceptionResolver.getExceptionHandlerAdviceCache`,
> `HandlerExceptionResolverComposite.getExceptionResolvers`,
> [`ExceptionHandlerMethodResolver`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-web/src/main/java/org/springframework/web/method/annotation/ExceptionHandlerMethodResolver.java)
> (`resolveMethodByExceptionType` and its javadoc), and
> [`StandaloneMockMvcBuilder`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-test/src/main/java/org/springframework/test/web/servlet/setup/StandaloneMockMvcBuilder.java)
> (`setControllerAdvice` javadoc and `registerMvcSingletons`) — plus **Spring Boot 4.1.1**
> `DefaultErrorAttributes` and `AutoConfigureWebMvc.imports`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9 (sources read at 7.0.9 / 4.1.1), JUnit Jupiter 6.0.3, Mockito 5.23.0,
> AssertJ 3.27.7.
> **No sandbox** — this page carries Java source and library source, never a fabricated test run.

**[07](07-exception-handlers.md), [07b](07b-which-advice-applies.md) and
[07c](07c-which-method-matches.md) are mechanism: which advice is consulted, whether it applies, and
which of its methods matches. This chunk is the executable part. Everything above
is unobservable through `hasStatus(...)` alone, so the tests here are the only thing standing
between "the error handling works" and "some handler returned the number I expected".**

## Writing the test that proves *which* handler won

Three techniques, in increasing distance from the HTTP contract. Prefer the first.

**1 · Make the answers distinguishable.** Two handlers that both return 400 with `{"error": "…"}`
cannot be told apart, so give each error a code only one handler emits, and assert the code:

```java
@Test
void a_domain_conflict_is_reported_by_the_api_advice_and_not_the_catch_all() {
    assertThat(mvc.post().uri("/orders/42/cancel"))
        .hasStatus(HttpStatus.CONFLICT)
        .bodyJson().extractingPath("$.code").isEqualTo("ORDER_ALREADY_SHIPPED");
}
```

A catch-all advice returning `500 / INTERNAL` fails this on the status; a *different* 409-producing
advice fails it on the code. That is the assertion the contract needs anyway
([06b](06b-asserting-the-error-contract.md),
[01 · The error shape is a contract](../../phase-9-spring-boot/09-error-handling/01-the-error-shape-is-a-contract.md)).

**2 · Pin the advice ordering directly, once.** `getExceptionHandlerAdviceCache()` is public and
its `LinkedHashMap` iterates in sorted order, so a single test can nail down the ordering every
other test silently depends on:

```java
@Autowired
@Qualifier("handlerExceptionResolver")
HandlerExceptionResolver resolver;   // the composite; do NOT inject by type alone

@Test
void the_api_advice_is_consulted_before_any_other() {
    ExceptionHandlerExceptionResolver ehr =
        ((HandlerExceptionResolverComposite) resolver).getExceptionResolvers().stream()
            .filter(ExceptionHandlerExceptionResolver.class::isInstance)
            .map(ExceptionHandlerExceptionResolver.class::cast)
            .findFirst().orElseThrow();

    assertThat(ehr.getExceptionHandlerAdviceCache().keySet())
        .extracting(ControllerAdviceBean::getBeanType)
        .startsWith(ApiExceptionHandler.class);
}
```

⚠️ Inject with `@Qualifier("handlerExceptionResolver")`, never by type alone: Boot's
`DefaultErrorAttributes` is *also* a `HandlerExceptionResolver` bean in the slice, at
`HIGHEST_PRECEDENCE`, because `AutoConfigureWebMvc` imports `ErrorMvcAutoConfiguration`. A bare
`@Autowired HandlerExceptionResolver` is ambiguous by type. The javadoc on the accessor also warns
that *"the returned map will be empty if the method is invoked before the bean has been initialized
via `afterPropertiesSet()`"* — in a `@WebMvcTest` it has been, so this is safe; in a hand-built
resolver it would not be.

**3 · Assert the method chosen inside one advice, with no Spring at all.**
`ExceptionHandlerMethodResolver` is public, and the javadoc on the exception-type overload says it
exists for exactly this: *"This can be useful if an `Exception` instance is not available (for
example, for tools)."*

```java
@Test
void the_specific_handler_wins_over_the_catch_all() {
    var resolver = new ExceptionHandlerMethodResolver(ApiExceptionHandler.class);

    assertThat(resolver.resolveMethodByExceptionType(OrderNotFound.class).getName())
        .isEqualTo("handleOrderNotFound");
}
```

A plain JUnit test, no context, no HTTP, and the cheapest possible regression test for "somebody
added `@ExceptionHandler(RuntimeException.class)` and it swallowed everything". It also fails
loudly on a duplicate mapping, because the constructor is where that `IllegalStateException` is
thrown — so it doubles as a structural check on the advice. What it does **not** prove: ordering
*between* advices (technique 2), or anything about the response body (technique 1).

The classic API's equivalent of technique 1's supporting evidence is
`result.getResolvedException()`, which tells you the exception the resolver saw but not the handler
that answered:

```java
MvcResult result = mockMvc.perform(post("/orders/42/cancel"))
        .andExpect(status().isConflict())
        .andReturn();
assertThat(result.getResolvedException()).isInstanceOf(OrderAlreadyShipped.class);
```

Useful as a diagnostic; not a substitute for asserting the code, because two advices can both
resolve the same exception to two different bodies.


## Testing the advice with no context at all

`StandaloneMockMvcBuilder.setControllerAdvice` exists precisely because the standalone setup does
not read your Spring configuration:

> *"Register one or more `@ControllerAdvice` instances to be used in tests (specified `Class` will
> be turned into instance). Normally `@ControllerAdvice` are auto-detected as long as they're
> declared as Spring beans. However since the standalone setup does not load any Spring config,
> they need to be registered explicitly here instead much like controllers."*

```java
// AssertJ
MockMvcTester mvc = MockMvcTester.of(List.of(new OrderController(orders)),
        builder -> builder.setControllerAdvice(new ApiExceptionHandler()).build());

// classic
MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new OrderController(orders))
        .setControllerAdvice(new ApiExceptionHandler())
        .build();
```

**What it buys.** No application context: no context cache entry, no auto-configuration, no bean
graph to satisfy, and a test that constructs the controller with plain Mockito mocks passed to its
constructor. For an advice with several exception mappings this is the fastest honest way to
exercise all of them, and — because you name the advices — it is the only setup where "which advice
answered" is not a question at all.

**What it costs, precisely.** The builder does `wac.addBeans(this.controllerAdvice)` into a
`StubWebApplicationContext` and then builds `handlerExceptionResolver` from
`WebMvcConfigurationSupport` against that stub. So:

| Still true | No longer true |
|---|---|
| the advice is a `ControllerAdviceBean`, so `assignableTypes` / `basePackages` / `annotations` selectors are honoured | your `MessageSource` is absent, so `ProblemDetail` details and `@ResponseStatus(reason = …)` are not interpolated as production does |
| `@Order` / `Ordered` on the advice class is read by `getOrder()` | the *set* of advices is whatever you passed — Boot's `ProblemDetailsExceptionHandler` and every advice in another package are gone |
| depth-based method selection inside the advice is identical | your Boot-configured message converters are not there; the JSON is produced by the standalone defaults ([01](01-no-socket-no-server.md)) |
| the resolver chain order is the framework default | your `WebMvcConfigurer`, filters, interceptors and security are absent |

The one-line summary: **a standalone advice test proves the advice; a slice test proves the
wiring.** They answer different questions and a codebase with an interesting error contract wants
both — the standalone one per exception mapping, the slice one once per published error shape.

## When the exception escapes every handler

If nothing matches, `getExceptionHandlerMethod` returns `null`, the resolver returns `null`, and the
next resolver in the chain gets a turn; if none of them resolves it either, the request has **no
response at all** in `MockMvc`. That state, how each API surfaces it, and why it is a production
problem rather than a test problem is [03c · Resolved and unresolved
failures](03c-resolved-and-unresolved-failures.md) — read it before you write a test that catches
the exception out of `perform`. The short version: an unresolved exception in a slice test is your
suite telling you that this exception has no published error contract
([16 · The error floor](../../phase-9-spring-boot/09-error-handling/16-the-error-floor.md)).

## Gotchas
**★ Injecting `HandlerExceptionResolver` by type in a slice test.**
`DefaultErrorAttributes` implements `HandlerExceptionResolver` and is a bean in the slice, so the
injection is ambiguous. Use `@Qualifier("handlerExceptionResolver")`, or inject the `List` and
filter it.

**★ Asserting only the status when two advices can produce it.**
`hasStatus(409)` is satisfied by your advice and by a catch-all that maps a supertype to the same
status. Assert a code that only one handler emits — that is what makes the test a test of *your*
handler rather than of the framework.

**★ Treating `getResolvedException()` as "which handler ran".**
It is the exception the resolver was given, not the method that answered. Two advices resolving the
same exception to different bodies both leave the same `getResolvedException()`.

**★ Writing the ordering test in every test class.**
`getExceptionHandlerAdviceCache()` is a property of the context, not of the controller under test.
One test, in one place, covering the whole application's advice ordering. Repeating it in fifteen
slice classes buys nothing and pays for fifteen more context lookups.

**★ Using `standaloneSetup(...).setControllerAdvice(...)` and believing you tested the wiring.**
You tested the advice class. The set of advices, the ordering against Boot's, the message
converters, the `MessageSource` and every `WebMvcConfigurer` customisation are all yours to supply
and you supplied none of them. Keep at least one slice test per published error shape.

**★ Building a standalone tester *inside* a `@WebMvcTest`.**
The context is already built and paid for, and `MockMvcTester.of(...)` throws it away — along with
your advices, your converters and your filters ([03](03-mockmvctester.md)). Either use the injected
`MockMvcTester`, or do not start a context.

**★ Asserting an interpolated message in a standalone advice test.**
There is no `MessageSource` in the stub context, so `@ResponseStatus(reason = "…")` and
`ProblemDetail` details are not resolved the way production resolves them. Assert codes
([06b](06b-asserting-the-error-contract.md)); if the message itself is the contract, that test
belongs in a slice or an integration test.

**★ Testing an advice by calling its handler method directly.**
`new ApiExceptionHandler().handleNotFound(ex)` compiles and asserts a `ResponseEntity`, and it
proves nothing about *whether the method would be selected* — which is the failure that actually
occurs. Use `resolveMethodByExceptionType` for selection, or drive it through a standalone tester.

**★ Catching the exception out of `perform` and calling it an error-handling test.**
It records that nothing handles the exception. That is a legitimate characterisation of a gap and
it is not a test of a contract ([03c](03c-resolved-and-unresolved-failures.md)); label it as such
or fix the gap.

## Interview questions
**★ How would you write a test that proves your advice, and not another one, produced a response?**
Cheapest first: make the responses distinguishable and assert a code only that handler emits — a
status alone cannot separate two advices that both return 400. If the ordering itself needs
pinning, write one test that injects the `handlerExceptionResolver` composite by qualifier, pulls
out the `ExceptionHandlerExceptionResolver`, and asserts on the key order of
`getExceptionHandlerAdviceCache()`, which is sorted order. To prove which *method* inside one
advice matches, construct an `ExceptionHandlerMethodResolver` over the advice class in a plain
JUnit test and call `resolveMethodByExceptionType` — no context at all.

**★ Why is the `ExceptionHandlerMethodResolver` unit test worth writing when you already have slice
tests?**
Because it is the only one of the three that runs in milliseconds with no context, and because it
fails on two distinct regressions at once: a new catch-all mapping stealing a specific exception,
and a duplicate mapping that would otherwise blow up the context of every slice test that touches
that advice. It is a structural assertion about a class, and it belongs next to the advice.

**★ What does `standaloneSetup(...).setControllerAdvice(...)` buy you, and what does it cost?**
It buys a test with no application context at all — no cache entry, no auto-configuration, no bean
graph — because *"the standalone setup does not load any Spring config"*, which is also why the
advice has to be handed over explicitly. It costs you your wiring: the stub context contains only
the controllers and advices you passed, so Boot's converters, your `MessageSource`, the
problem-details handler and every other advice in the application are absent, and the ordering you
observe is not the ordering production computes. Selectors and depth-based method selection still
work, because the advice is still wrapped in a `ControllerAdviceBean`.

**★ Which of the three techniques would you actually put in a codebase, and where?**
All three, in different files. The code assertion (technique 1) goes in the slice test for each
published error shape — it is the contract. The ordering assertion (technique 2) goes in exactly
one test in the whole suite, because advice ordering is a property of the application and not of a
controller. The `ExceptionHandlerMethodResolver` assertion (technique 3) goes next to the advice
class as a plain unit test, because it is a structural fact about that class and it fails fast when
someone adds a catch-all.

**★ Your slice test passes but the same request in production returns a different body. Where do you
look first?**
At the set of advices and the ordering, in that order. The slice loads all of them but the property
`spring.mvc.problemdetails.enabled` may differ, which changes both the set and the winner
([07](07-exception-handlers.md)); and if two advices are unordered, the tie is broken by bean
discovery order, which can differ between a test classpath and a packaged jar. The ordering test is
what turns that from a two-hour investigation into a red build.

{/* FOOTER */}
