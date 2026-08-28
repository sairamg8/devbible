---
title: "The mock request starts blank and the mock response is inspected in-process — which is why MockMvc surprises you with a 404 on a context path and lets you assert things no client could ever see"
sidebar_label: "01b · The blank request"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Spring Framework 7.0.x reference — "MockMvc vs
> End-to-End Tests"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/mockmvc/vs-end-to-end-integration-tests.html)),
> "Performing Requests"
> ([hamcrest](https://docs.spring.io/spring-framework/reference/testing/mockmvc/hamcrest/requests.html),
> [assertj](https://docs.spring.io/spring-framework/reference/testing/mockmvc/assertj/requests.html))
> and "Async Requests"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/mockmvc/hamcrest/async-requests.html))
> — read as asciidoc source at tag `v7.0.9`, plus the `spring-test` 7.0.9 javadoc for
> `MockMvcTester`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8 (docs read at 7.0.9), JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> **No sandbox** — this page carries Java source, never a fabricated test run.

**[01 · No socket, no server](01-no-socket-no-server.md) argued that `MockMvc` invokes the
real `DispatcherServlet` with mock Servlet objects. This chunk is the consequence: the
request object you dispatch begins completely empty, so every header, cookie, path segment
and session attribute your production code takes for granted is absent until your test puts
it there — and the response object you assert on is a Java object in your own JVM, so you
can interrogate parts of it that no HTTP client could ever observe. The first fact produces
most `MockMvc` false failures. The second produces most `MockMvc` bad tests.**

## The request starts blank, and that is the whole surprise list

The reference gives you the mental model to reason from, and it is worth memorising
verbatim:

> *"The easiest way to think about this is by starting with a blank
> `MockHttpServletRequest`. Whatever you add to it is what the request becomes. Things that
> may catch you by surprise are that there is no context path by default; no `jsessionid`
> cookie; no forwarding, error, or async dispatches; and, therefore, no actual JSP
> rendering. Instead, "forwarded" and "redirected" URLs are saved in the
> `MockHttpServletResponse` and can be asserted with expectations."*

Read "blank" literally. There is no `Accept` header unless you set one, no
`Content-Type`, no `User-Agent`, no cookies, no session, no TLS, no remote address that
means anything. Anything your code reads off the request that a real client would have
sent is `null` in a `MockMvc` test until the test supplies it — and a controller that
behaves differently under `Accept: */*` than under `Accept: application/json` will behave
differently here than in production for exactly that reason.

The rendering caveat is narrower than it sounds and the reference draws the line itself:

> *"This means that, if you use JSPs, you can verify the JSP page to which the request was
> forwarded, but no HTML is rendered. In other words, the JSP is not invoked. Note,
> however, that all other rendering technologies which do not rely on forwarding, such as
> Thymeleaf and Freemarker, render HTML to the response body as expected. The same is true
> for rendering JSON, XML, and other formats through `@ResponseBody` methods."*

For a JSON API — which is what most of this topic is about — the body you assert on is the
body your message converter actually produced. That is real serialisation by *Spring*. It
is not real serialisation by the *container*, which is a different and smaller claim; see
[09 · What MockMvc cannot test](09-what-mockmvc-cannot-test.md).

## It is a server-side test, and that is a feature and a bias

> *"Another important distinction when using Spring MVC Test is that, conceptually, such
> tests are server-side tests, so you can check what handler was used, if an exception was
> handled with a `HandlerExceptionResolver`, what the content of the model is, what binding
> errors there were, and other details. That means that it is easier to write expectations,
> since the server is not an opaque box, as it is when testing it through an actual HTTP
> client."*

And immediately the counterweight, which is the sentence to quote back at anyone who wants
to assert the resolved handler in every test:

> *"…it is important not to lose sight of the fact that the response is the most important
> thing to check."*

Being able to assert which controller method ran does not make it a good assertion. It
couples the test to the implementation and it is invisible to the client. Assert the
response; reach for `handler()` and `model()` only when the response genuinely cannot tell
you what you need to know.

## Gotchas

**★ There is no context path, so a URI that includes yours will not match.**
`get("/app/orders/42")` against a controller mapped to `/orders/{id}` produces a 404,
because the mock request has no context path to strip. The documented fix is to say so
explicitly:

```java
assertThat(mvc.get().uri("/app/main/hotels/{id}", 42)
        .contextPath("/app").servletPath("/main"))
        .hasStatusOk();
```

The reference's own advice is to avoid the problem entirely: *"In most cases, it is
preferable to leave the context path and the Servlet path out of the request URI."*

**★ The request has no `Accept` header unless you set one, and that changes behaviour.**
Content negotiation with no `Accept` resolves to `*/*`, which is not what a browser, a
`RestClient` or a JavaScript client sends. Any code path that branches on the negotiated
media type — including Spring Security's choice of authentication entry point — takes a
different branch in a bare `MockMvc` test than in production. Set `.accept(...)`
deliberately rather than discovering the difference later.

**★ Query parameters in the URI are decoded; parameters passed to `param(...)` are not.**
Straight from the reference: *"query parameters provided with the URI template are decoded
while request parameters provided through the `param(...)` method are expected to already
be decoded."* Pass a pre-encoded `%20` to `param(...)` and your controller sees the literal
percent-escape.

**★ There are no forward, error or async dispatches — the container is what performs
those.**
`MockMvc` runs one dispatch. A `forward:` is recorded on the response rather than executed,
the container error dispatch that would render `/error` does not happen by itself, and an
async request stops when the servlet thread exits. With the classic API you perform the
second dispatch yourself; the reference annotates its own example *"Manually perform an
ASYNC dispatch (as there is no running container)"*. `MockMvcTester.exchange()` hides that
for you by waiting for completion — see [03 · MockMvcTester](03-mockmvctester.md).

**★ Asserting the resolved handler is usually a coupling, not a test.**
`handler().isInvokedOn(OrderController.class, c -> c.getOrder(42L))` fails on a rename that
changed no behaviour, and passes on a mapping that returns the wrong body. The reference
says the response is the most important thing to check; treat handler and model assertions
as debugging aids that occasionally graduate into tests.

**★ "No JSP is rendered" is often misread as "no view is rendered".**
Thymeleaf, Freemarker and Mustache write HTML into the response body under `MockMvc`
exactly as they do in production, because they do not go through a servlet forward. Only
forwarding-based rendering (JSP) is inert. If you have been avoiding `MockMvc` for a
Thymeleaf application on this basis, the basis is wrong.


## Interview questions

**★ A colleague says a `MockMvc` test proves the API contract. What is the honest answer?**
It proves the contract as far as `DispatcherServlet` defines it — the mapping, the status,
the headers Spring set, and the body Spring's message converter produced. It does not
prove anything that only exists on the wire: the bytes the container writes, chunked or
compressed encoding, HTTP/2 behaviour, filters registered by the container rather than by
your builder, connection handling, or timeouts. That is the boundary where
`TestRestTemplate` and `WebTestClient` take over, and it is
[09 · What MockMvc cannot test](09-what-mockmvc-cannot-test.md).

**★ Your `MockMvc` test passes and the same request 404s in production. Name two causes
you would check first.**
The context path — the mock request has none by default, so a URI that includes the
deployment's context path fails locally while the deployed application strips it, and the
inverse mistake produces the reverse symptom. And a standalone setup that never loaded your
real MVC configuration: a mapping that depends on a `WebMvcConfigurer`, a path-matching
setting or a custom argument resolver present in production and absent from the test.

**★ Why can a `MockMvc` test see the model and the resolved exception when an HTTP client
cannot?**
Because it is a server-side test: the test and the dispatcher share a JVM and the
`MvcResult` retains the handler, the `ModelAndView`, the resolved exception and the binding
result. The reference frames it as *"the server is not an opaque box."* The cost is that
those assertions describe internals no client can observe, so they couple the test to the
implementation — which is why the same page insists the response is the most important
thing to check.

{/* FOOTER */}
