---
title: "MockMvc opens no socket and starts no container — it calls DispatcherServlet directly with mock Servlet objects, and everything it can and cannot catch follows from that one fact"
sidebar_label: "01 · No socket, no server"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Spring Framework 7.0.x reference — "MockMvc",
> "Overview", "Setup Options", "Filter Registrations" and "MockMvc vs End-to-End Tests"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/mockmvc.html),
> [overview](https://docs.spring.io/spring-framework/reference/testing/mockmvc/overview.html),
> [vs end-to-end](https://docs.spring.io/spring-framework/reference/testing/mockmvc/vs-end-to-end-integration-tests.html))
> — read as asciidoc source at tag `v7.0.9`, plus the `spring-test` 7.0.9 sources
> (`org.springframework.test.web.servlet.assertj.MockMvcTester`).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9 (docs read at 7.0.9), JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> **No sandbox** — this page carries Java source, never a fabricated test run.

**A `MockMvc` test is not an HTTP test. Nothing is serialised onto a wire, nothing is
parsed off one, no thread pool accepts a connection and no `Tomcat` starts. What actually
happens is that `DispatcherServlet` — the real one, with your real handler mappings,
message converters and exception resolvers — is handed a `MockHttpServletRequest` you
built in Java and writes into a `MockHttpServletResponse` you then assert on. Every
strength of the tool (fast, inspectable, server-side) and every blind spot (no container
serialisation, no real content negotiation defaults, no dispatch types) is a direct
consequence of that. Get this one paragraph right and the rest of the topic is
bookkeeping. This chunk covers what is invoked and how you build one;
[01b · The blank request](01b-the-blank-request.md) covers what the mock request does
*not* contain and why that is where the surprises come from.**

## What is actually invoked

The reference opens with the claim in one sentence:

> *"MockMvc provides support for testing Spring MVC applications. It performs full Spring
> MVC request handling but via mock request and response objects instead of a running
> server."*

and the Overview page says how:

> *"`MockMvc` aims to provide more complete testing support for Spring MVC controllers
> without a running server. It does that by invoking the `DispatcherServlet` and passing
> "mock" implementations of the Servlet API from the `spring-test` module which replicates
> the full Spring MVC request handling without a running server."*

"Full Spring MVC request handling" is the load-bearing phrase. The pipeline you get is
the real one: `HandlerMapping` selects a handler, `HandlerAdapter` invokes it,
`@InitBinder` and `@ModelAttribute` methods run, argument resolvers bind path variables
and request parameters, `HttpMessageConverter` deserialises the body, Bean Validation
runs, the return value goes back through a converter or a view resolver, and a thrown
exception hits the `HandlerExceptionResolver` chain. Phase 9 owns that pipeline in
detail — see
[the full path of a request](../../phase-9-spring-boot/10-the-request-pipeline/01-the-full-path.md)
and
[the controller and the pipeline](../../phase-9-spring-boot/07-rest-controllers/01-the-controller-and-the-pipeline.md).
This topic assumes it and tests it.

## Why not just call the controller method?

Because a controller method call is not a request. The reference states the gap before it
introduces `MockMvc` at all:

> *"You can write plain unit tests for Spring MVC by instantiating a controller, injecting
> it with dependencies, and calling its methods. However such tests do not verify request
> mappings, data binding, message conversion, type conversion, or validation and also do
> not involve any of the supporting `@InitBinder`, `@ModelAttribute`, or
> `@ExceptionHandler` methods."*

That list is the entire value proposition. A direct call `controller.getOrder(42L)` proves
your method body works when handed a `long`. It proves nothing about whether
`@GetMapping("/orders/{id}")` is even mapped, whether `{id}` binds, whether a bad `id`
produces a 400 rather than a 500, whether the response is JSON, whether `@Valid` is
honoured, or whether your `@ControllerAdvice` turns your domain exception into the error
body you promised. Those are the defects that reach production, and they all live in the
wiring, not the method body.

## The smallest complete test

```java
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

import static org.assertj.core.api.Assertions.assertThat;

class OrderControllerStandaloneTests {

    private final MockMvcTester mvc =
            MockMvcTester.of(new OrderController(new StubOrderService()));

    @Test
    void returnsTheOrderAsJson() {
        assertThat(mvc.get().uri("/orders/{id}", 42))
                .hasStatusOk()
                .bodyJson().extractingPath("$.reference").isEqualTo("ORD-42");
    }
}
```

No context, no Boot, no server, and the mapping, the path-variable conversion, the
message converter and the status are all exercised. `MockMvcTester` is the AssertJ-based
front end introduced in Framework 6.2; the classic `perform(...).andExpect(...)` form is
in [03b · The classic API](03b-the-classic-api.md) and the two are compared in
[03 · MockMvcTester](03-mockmvctester.md).

## Two ways to build one, and they are not the same test

The reference names exactly two setup options:

> *"`WebApplicationContext` :: Point to Spring configuration with Spring MVC and controller
> infrastructure in it. Standalone :: Point directly to the controllers you want to test and
> programmatically configure Spring MVC infrastructure."*

and it is blunt about the trade:

> *"A `WebApplicationContext`-based test loads your actual Spring MVC configuration,
> resulting in a more complete integration test. … A standalone test, on the other hand,
> is a little closer to a unit test. It tests one controller at a time. … using standalone
> tests does imply the need for additional integration tests to verify your Spring MVC
> configuration."*

That last clause is the one people skip. A standalone `MockMvcTester.of(controller)` builds
*minimum* MVC infrastructure programmatically — it is not your application's MVC
configuration. Your custom `HandlerMethodArgumentResolver`, your registered
`WebMvcConfigurer`, your Jackson customisations and your filters are absent unless you add
them by hand. In a Spring Boot codebase the context-based route has a name —
`@WebMvcTest` — and it is [02 · The @WebMvcTest slice](02-webmvctest.md).

## Filters run, but only the ones you registered

`MockMvc` does execute Servlet filters, and the mechanism is explicit:

> *"When setting up a `MockMvc` instance, you can register one or more Servlet `Filter`
> instances… Registered filters are invoked through the `MockFilterChain` from
> `spring-test`, and the last filter delegates to the `DispatcherServlet`."*

So there is a filter chain, it is `MockFilterChain`, and its membership is whatever the
builder was told about — not whatever your servlet container would have assembled from
`web.xml`, `@WebFilter`, `FilterRegistrationBean` ordering and the container's own
built-ins. Boot's `@AutoConfigureMockMvc` closes most of that gap by registering the
context's filters for you (`addFilters` defaults to `true`), which is why security
suddenly applies in a Boot slice — [08 · Security in a slice](08-security-in-a-slice.md).

What the mock request *lacks* — the context path, the `Accept` header, the session, the
second dispatch — is the other half of this argument and it continues in
[01b · The blank request](01b-the-blank-request.md).

## Gotchas

**★ "It performs full Spring MVC request handling" does not mean it performs full HTTP.**
Both halves of that sentence are true and people keep only one. Everything from
`DispatcherServlet` inwards is real; everything outside it — the socket, the container's
parsing and encoding of the message, the container's own filters and error page machinery
— is absent. A test that is green here can still 500 behind Tomcat.

**★ In a standalone setup your `@ControllerAdvice` is not registered, so your error
contract is not under test.**
The javadoc on `StandaloneMockMvcBuilder.setControllerAdvice` says it plainly: *"Normally
`@ControllerAdvice` are auto-detected as long as they're declared as Spring beans. However
since the standalone setup does not load any Spring config, they need to be registered
explicitly here instead much like controllers."* Until you do, a thrown domain exception is
handled by the default resolvers, not by your advice — so a test that "proves" your 404 body
is proving Spring's, not yours:

```java
MockMvcTester mvc = MockMvcTester.of(List.of(new OrderController(service)),
        builder -> builder.setControllerAdvice(new ApiExceptionHandler()).build());
```

**★ Passing a `Class` rather than an instance means the controller is built for you, with
no dependencies.**
`MockMvcTester.of(Object... controllers)` documents its parameter as *"one or more
`@Controller` instances or `@Controller` types to test; a type (`Class`) will be turned into
an instance"*. `MockMvcTester.of(OrderController.class)` therefore instantiates it through
its default constructor — which for a constructor-injected controller is either a compile
error or an object with null collaborators. Pass the instance you built with your mocks.

**★ Without message converters, `MockMvcTester` can only make basic body assertions.**
From the javadoc of `withHttpMessageConverters`: *"If none are specified, only basic
assertions on the response body can be performed. Consider registering a suitable JSON
converter for asserting against JSON data structures."* In a Boot `@WebMvcTest` the
converters come from the context and this is invisible; in a hand-built standalone tester
`bodyJson().convertTo(Order.class)` has nothing to convert with.

**★ A filter that does not call `chain.doFilter` silently ends the test before the
controller runs.**
Registered filters are invoked through `MockFilterChain` and *"the last filter delegates to
the `DispatcherServlet`"* — so a filter that short-circuits produces a response with no
handler and no model, and every assertion about the controller then describes a request the
controller never saw. If `handler()` is empty and the status is inexplicable, suspect a
filter before you suspect the mapping.

**★ A standalone setup is not your application's MVC configuration.**
`MockMvcTester.of(new OrderController(...))` registers, in the javadoc's words, *"the
minimum infrastructure required by the `DispatcherServlet` to serve requests with annotated
controllers"*. Your `WebMvcConfigurer`, your custom argument resolvers, your Jackson module
and your `@ControllerAdvice` are not there unless you add them. A green standalone test
proves the controller, not the deployment.

## Interview questions

**★ What does `MockMvc` actually run, and what does it not?**
It runs the real `DispatcherServlet` with the real Spring MVC infrastructure —
handler mappings, argument resolvers, message converters, validation, interceptors,
exception resolvers, view resolution — driven by `MockHttpServletRequest` and
`MockHttpServletResponse` from `spring-test`, plus any filters you registered, wired
through `MockFilterChain`. It does not run a servlet container, a socket, HTTP parsing or
encoding, the container's own filters and error pages, or any dispatch other than the
initial one. The Framework reference's phrase is *"full Spring MVC request handling but
via mock request and response objects instead of a running server."*

**★ Why is a `MockMvc` test better than calling the controller method directly?**
Because the defects live in the wiring. A direct call skips request mapping, data
binding, type conversion, message conversion, validation, `@InitBinder` and
`@ModelAttribute` support, and exception handling — the reference lists exactly those.
A controller method is usually a few lines of delegation; the interesting behaviour is
whether the annotations on it describe the contract you published, and only a dispatched
request tests that.

**★ Is a `MockMvc` test a unit test or an integration test?**
Neither cleanly, and the reference says so: *"none of the options in Spring MVC Test fall
under the category of classic unit testing, but they are a little closer to it."* Which one
it resembles depends on setup: a standalone setup with hand-injected mocks is nearly a unit
test of one controller; a `WebApplicationContext` setup loads your actual MVC configuration
and is an integration test of the web layer with the layers below it stubbed. Choosing
between them is slice choice, which belongs to **05 · The test pyramid** *(not written
yet)*.

{/* FOOTER */}
