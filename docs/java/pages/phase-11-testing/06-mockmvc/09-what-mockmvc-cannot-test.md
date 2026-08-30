---
title: "The boundary is the DispatcherServlet: everything above it is your real Spring MVC configuration and everything below it is a mock object, so MockMvc proves your controllers and proves nothing about the container — and the fix is a real port, not a better assertion"
sidebar_label: "09 · What MockMvc cannot test"
sidebar_position: 32
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-30 against the **Spring Framework 7.0.x** reference —
> [`testing/mockmvc/overview`](https://docs.spring.io/spring-framework/reference/testing/mockmvc/overview.html),
> [`mockmvc/setup-options`](https://docs.spring.io/spring-framework/reference/testing/mockmvc/setup-options.html)
> and [`mockmvc/vs-end-to-end-integration-tests`](https://docs.spring.io/spring-framework/reference/testing/mockmvc/vs-end-to-end-integration-tests.html)
> — and the **Spring Boot 4.1.1** reference
> [`testing/spring-boot-applications`](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html)
> plus the `@AutoConfigureMockMvc` javadoc (4.1.1) for its four attributes.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> **No sandbox** — this page carries Java source and quoted documentation, never a fabricated
> test run.

**Every previous chunk in this topic has been about what `MockMvc` does. This one is about
where it stops, because the boundary is sharp and it is not where most people put it. Boot's
reference states it in one sentence: *"since mocking occurs at the Spring MVC layer, code that
relies on lower-level servlet container behavior cannot be directly tested with MockMvc."*
Above the `DispatcherServlet` — mappings, binding, conversion, validation, your advice, your
interceptors — everything is the real thing and a passing test means something. Below it there
is no container at all, only `spring-test`'s mock objects. A test that fails to distinguish the
two either trusts `MockMvc` for something it never claimed, or throws away a fast test and
spins up a server for something `MockMvc` covers perfectly.**

## First, what IS real — because the list is longer than the sceptics think

The reference is explicit that `MockMvc` exists precisely because hand-rolled controller unit
tests are not enough:

> *"You can write plain unit tests for Spring MVC by instantiating a controller, injecting it
> with dependencies, and calling its methods. However such tests do not verify request
> mappings, data binding, message conversion, type conversion, or validation and also do not
> involve any of the supporting `@InitBinder`, `@ModelAttribute`, or `@ExceptionHandler`
> methods."*

`MockMvc` *"aims to provide more complete testing support for Spring MVC controllers without a
running server. It does that by invoking the `DispatcherServlet` and passing 'mock'
implementations of the Servlet API from the `spring-test` module which replicates the full
Spring MVC request handling without a running server."*

So the entire `DispatcherServlet` algorithm runs for real: handler mapping, argument
resolution, `HttpMessageConverter` selection and execution, `ConversionService`, Bean
Validation, `HandlerInterceptor` chain, `@ExceptionHandler` resolution, view resolution, and
your `@ControllerAdvice` — [07](07-exception-handlers.md). **Your JSON is really serialised by
your really-configured `ObjectMapper`.** That is the part people undersell.

## The boundary, stated precisely

| Layer | In a `MockMvc` test |
|---|---|
| Socket, connector, TLS, HTTP/2, keep-alive, chunked transfer | ❌ absent entirely |
| Container-enforced limits — max header size, max post size, URI length | ❌ absent |
| Container URL normalisation and decoding before the servlet sees it | ❌ absent |
| `Filter` chain **as the container maps it** (URL patterns, dispatcher types, order) | ⚠️ approximated — see below |
| `DispatcherServlet` and everything it orchestrates | ✅ real |
| Your `@Configuration`, converters, `ConversionService`, validators, advice | ✅ real |
| Error dispatch to `/error` | ❌ never happens — [06](06-validation-errors.md) |
| JSP rendering | ❌ forwarded-to, never invoked |
| Thymeleaf / Freemarker / `@ResponseBody` JSON and XML | ✅ really rendered |

The two ❌ rows people are most often surprised by are the last three, and they all come from
the same root: the request is a `MockHttpServletRequest` that only ever goes through one
dispatch.

## No second dispatch, and everything that follows from it

[01b](01b-the-blank-request.md) established the blank request. The reference's own warning
list is worth having in full here because three of the five items are dispatch-related:

> *"Things that may catch you by surprise are that there is no context path by default; no
> `jsessionid` cookie; no forwarding, error, or async dispatches; and, therefore, no actual JSP
> rendering."*

**No forward dispatch → no JSP.** The reference: *"if you use JSPs, you can verify the JSP page
to which the request was forwarded, but no HTML is rendered. In other words, the JSP is not
invoked."* A test asserting `hasViewName("orders/list")` proves the view was *selected*. It
proves nothing about whether that JSP compiles, whether its EL expressions resolve, or whether
it throws at render time. On a JSP codebase this is a genuine coverage hole and the reason to
keep a handful of real-server smoke tests.

**But not every template engine is affected**, and this is the distinction that gets lost:

> *"Note, however, that all other rendering technologies which do not rely on forwarding, such
> as Thymeleaf and Freemarker, render HTML to the response body as expected. The same is true
> for rendering JSON, XML, and other formats through `@ResponseBody` methods."*

So on a Thymeleaf application you **can** assert on rendered HTML in the response body. The
"MockMvc does not render" folklore is a JSP-specific fact that outlived its scope.

**No error dispatch → the empty 400.** Fully covered in [06](06-validation-errors.md); named
here because it is the single most common "MockMvc lied to me" report and it belongs on any
list of the framework's boundaries.

**No async dispatch by default** in the classic API — the classic `perform(...)` returns as
soon as the handler returns its `Callable`/`DeferredResult`, and you must round-trip through
`asyncDispatch(...)`. `MockMvcTester` closes this by default: *"By default, the result to assert
is complete whether the processing is asynchronous or not."* Details and the timeout in
[03d](03d-async-and-streaming.md).

## Filters: the row that deserves the ⚠️

Boot registers the application context's filters with `MockMvc`, controlled by one boolean:

> `addFilters` — *"If filters from the application context should be registered with MockMVC."*
> Default `true`.

That is an **all-or-nothing switch**, and it is the whole of the public contract. Two things
follow that are worth stating carefully:

- Turning it off with `@AutoConfigureMockMvc(addFilters = false)` is the standard way to take
  Spring Security's filter chain out of a slice — see [08](08-security-in-a-slice.md) — and it
  removes *every* filter at the same time, including your correlation-id or request-logging
  filter. If a controller test starts failing on a missing MDC value, this flag is why.
- ⚠️ **Whether MockMvc reproduces the container's filter *mapping* — URL patterns, dispatcher
  types, and `FilterRegistrationBean` ordering — is not something I could settle from the
  documentation.** The javadoc says "registered", not "registered with their mappings", and
  neither reference states the semantics. Treat filter *mapping* as unverified in a slice and
  assert it against a real server if it matters. Registration and ordering in production are
  [08 · Registration and ordering](../../phase-9-spring-boot/10-the-request-pipeline/08-registration-and-ordering.md);
  the container's own view of filters is
  [02 · Filters and the container](../../phase-9-spring-boot/01-why-frameworks-servlet-model/02-filters-and-the-container.md).

## The other silent gap: `standaloneSetup`

Worth naming here because it is a *narrower* boundary than `@WebMvcTest`, and the reference is
blunt about the trade:

> *"A `WebApplicationContext`-based test loads your actual Spring MVC configuration, resulting
> in a more complete integration test."*
>
> *"A standalone test, on the other hand, is a little closer to a unit test. It tests one
> controller at a time. You can manually inject the controller with mock dependencies, and it
> does not involve loading Spring configuration."*
>
> *"However, using standalone tests does imply the need for additional integration tests to
> verify your Spring MVC configuration."*

**"It does not involve loading Spring configuration"** is the sentence to internalise. A
`standaloneSetup` test that passes has not verified your `ObjectMapper` customisations, your
registered converters, your `ControllerAdvice` (unless you passed it in explicitly), or your
interceptors. It is fast and it is honest about being a unit test — but a green
`standaloneSetup` suite is not evidence that the application's web configuration works.

Crossing that boundary — the `webEnvironment` dial, `TestRestTemplate` and `WebTestClient`, what
a real port actually costs, and the authentication trap that catches every such migration — is
[09b · Crossing to a real port](09b-crossing-to-a-real-port.md).

## Gotchas

**★ Reading "MockMvc does not render views" as universal.**
It is JSP-specific and it is about *forwarding*. Thymeleaf, Freemarker, and `@ResponseBody`
JSON/XML *"render HTML to the response body as expected"*. On a Thymeleaf application, asserting
on rendered markup in a slice is legitimate.

**★ Believing a green `hasViewName(...)` proves the page works.**
It proves the view was selected. With JSP the template is never invoked, so a syntax error, a
broken EL expression or a null dereference at render time all pass.

**★ Expecting the container's limits to apply.**
Max header size, max POST size and URI-length limits are enforced by the connector, which is not
there. A request that a real Tomcat would reject with a 400 sails through the slice.

**★ Assuming a redirect is followed.**
`MockMvc` hands you the 302 and its `Location`. There is no HTTP client to follow it. Asserting
"the user ends up on the dashboard" needs a second, explicit request — or a real port.

**★ Testing session behaviour across requests without setting it up.**
Every `MockMvc` request starts blank, and there is *"no `jsessionid` cookie"*. Two requests are
not automatically the same session; you have to carry the session yourself.

**★ Turning off `addFilters` to silence Spring Security and losing every other filter with it.**
`addFilters` is one boolean for the whole chain. Correlation-id, request-logging and MDC filters
disappear at the same time, and the failure surfaces somewhere unrelated.

**★ Trusting a `standaloneSetup` suite as integration coverage.**
*"It does not involve loading Spring configuration."* Your converters, `ObjectMapper` tuning and
interceptors are not in the test. The reference explicitly says standalone *"does imply the need
for additional integration tests"*.

## Interview questions

**★ Where exactly is the line between what MockMvc tests and what it does not?**
At the `DispatcherServlet`. Above it everything is real — handler mapping, argument resolution,
message conversion, type conversion, validation, interceptors, `@ControllerAdvice`, view
resolution. Below it there is no container: no socket, no connector, no TLS, no container-enforced
limits, and only a single dispatch. Boot states it as *"mocking occurs at the Spring MVC layer,
[so] code that relies on lower-level servlet container behavior cannot be directly tested"*.

**★ Your controller returns a JSP view name and the test passes. What have you actually proven?**
That the handler ran and selected that view name. Because `MockMvc` performs no forward dispatch,
the JSP is never invoked — *"you can verify the JSP page to which the request was forwarded, but
no HTML is rendered"*. Nothing about the template's correctness is covered, which is why JSP
applications still need a small number of real-server tests.

**★ Someone says "MockMvc can't test rendering." Is that right?**
Only for forward-based views, i.e. JSP. The reference says all other technologies *"such as
Thymeleaf and Freemarker, render HTML to the response body as expected"*, as does JSON and XML
through `@ResponseBody`. So on a Thymeleaf app you can assert on the rendered body in a slice.

**★ What is the difference in coverage between `standaloneSetup` and `webAppContextSetup`?**
`webAppContextSetup` *"loads your actual Spring MVC configuration, resulting in a more complete
integration test"*. `standaloneSetup` *"does not involve loading Spring configuration"* — you wire
one controller and its mocks by hand, so converters, `ObjectMapper` settings, advice and
interceptors are absent unless you register them explicitly. The reference is direct that
standalone *"does imply the need for additional integration tests to verify your Spring MVC
configuration"*.

**★ Why does disabling `addFilters` sometimes break a test that has nothing to do with security?**
Because it is a single boolean over the whole filter chain — *"if filters from the application
context should be registered with MockMVC"*. Switching it off to escape Spring Security also
removes correlation-id, logging and MDC filters, so failures appear in assertions or log
expectations far from the annotation.

{/* FOOTER */}
