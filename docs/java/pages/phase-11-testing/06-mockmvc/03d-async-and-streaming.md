---
title: "Servlet async works by releasing the container thread and dispatching a second time, and MockMvc has no container — so the classic API makes you perform that second dispatch by hand, and a test that forgets it asserts the empty response that existed before the handler produced anything, which passes for almost any implementation"
sidebar_label: "03d · Async and streaming"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the **Spring Framework 7.0.x** reference — "Async Requests"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/mockmvc/hamcrest/async-requests.html)),
> "Performing Requests" (AssertJ)
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/mockmvc/assertj/requests.html))
> and "Streaming Responses" — read as asciidoc source at tag `v7.0.9`, with listings taken from
> the reference's own pages and `framework-docs` sources; plus the `spring-test` 7.0.9 javadoc for
> `MockMvcTester` and `MvcTestResult`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9 (docs and sources read at 7.0.9), JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> **No sandbox** — this page carries Java source, never a fabricated test run.

**[03c · Resolved and unresolved failures](03c-resolved-and-unresolved-failures.md) covers the
first behavioural difference between the two front ends. This is the second, and it is the one
that produces tests which pass without asserting anything: a Servlet async request completes in a
second dispatch that no container is present to perform.**

## Async: the classic API makes you dispatch twice

Servlet async works by releasing the container thread and dispatching again later. With no
container there is nothing to perform the second dispatch, so you do:

```java
// static import of MockMvcRequestBuilders.* and MockMvcResultMatchers.*

@Test
void test() throws Exception {
    MvcResult mvcResult = this.mockMvc.perform(get("/path"))
            .andExpect(status().isOk())              // 1. status is still unchanged
            .andExpect(request().asyncStarted())     // 2. async processing must have started
            .andExpect(request().asyncResult("body"))// 3. wait and assert the async result
            .andReturn();

    this.mockMvc.perform(asyncDispatch(mvcResult))   // 4. manually perform an ASYNC dispatch
            .andExpect(status().isOk())              // 5. verify the final response
            .andExpect(content().string("body"));
}
```

The numbered comments are the reference's own callouts, and callout 4 is the one to keep:
*"Manually perform an ASYNC dispatch (as there is no running container)"*. This applies to a
handler returning `DeferredResult`, `Callable`, or a reactive type such as `Mono`.

**The failure mode is silent.** Assert only on the first `perform` and you are asserting the state
of the response *before the handler produced anything* — status 200, empty body — which passes for
almost any implementation. An async controller test with a single `perform` is usually testing
nothing.

## Async: `MockMvcTester` waits for you

> *"If the processing of the request is done asynchronously, `exchange()` waits for the completion
> of the request so that the result to assert is effectively immutable. **The default timeout is
> 10 seconds** but it can be controlled on a request-by-request basis."*

```java
assertThat(mockMvc.get().uri("/compute").exchange(Duration.ofSeconds(5))).hasStatusOk();
```

and `MvcTestResult`'s javadoc confirms what you are holding: *"If the request was asynchronous, it
is fully resolved at this point and regular assertions can be applied without having to wait for
the completion of the response."*

To opt out — to assert that async *started*, rather than what it eventually produced — use
`asyncExchange()`:

```java
assertThat(mvc.post().uri("/save").asyncExchange()).request().hasAsyncStarted();
```

⚠️ **`mvc.perform(...)` opts out too, silently.** Its javadoc: *"This approach is also invoking
`MockMvc` without any additional processing of asynchronous requests."* So the bridge method from
[03](03-mockmvctester.md) gives you AssertJ assertions with the classic API's async semantics, and
you must dispatch manually again.

## Streaming, and where it stops

The reference is explicit that there is a limit neither API crosses:

> *"`MockMvcWebTestClient` doesn't support infinite streams because there is no way to cancel the
> server stream from the client side. To test infinite streams, you'll need to bind to a running
> server… `MockMvcWebTestClient` does support asynchronous responses, and even streaming
> responses. The limitation is that it can't influence the server to stop, and therefore the
> server must finish writing the response on its own."*

A finite Server-Sent Events endpoint is testable; an endpoint that streams until the client
disconnects is not, because there is no client and no connection to drop. That is
[09 · What MockMvc cannot test](09-what-mockmvc-cannot-test.md).

## Gotchas

**★ A single `perform(...)` for an async handler in the classic API.**
You asserted the response as it stood when the servlet thread exited — typically 200 with an empty
body — which passes regardless of what the handler eventually produced. You need
`request().asyncStarted()`, then `perform(asyncDispatch(mvcResult))`.


**★ Forgetting `asyncDispatch` and concluding async "does not work in MockMvc".**
It works; there is simply no container to perform the second dispatch, so you do it. The
reference's own callout says exactly that.


**★ Assuming `MockMvcTester` removes the need to think about async.**
It removes the manual dispatch. It does not remove the ten-second default timeout, which becomes a
ten-second pause on every test where the handler never completes, and it does not apply to
`mvc.perform(...)`.


**★ Using `exchange()` when you meant to assert that processing started.**
`exchange()` waits for completion, so `hasAsyncStarted()` after it is either meaningless or false.
`asyncExchange()` is the one that returns immediately.


**★ Expecting to test an infinite stream.**
`MockMvcWebTestClient` *"can't influence the server to stop, and therefore the server must finish
writing the response on its own."* An endpoint that streams until the client goes away needs a
running server.


**★ Asserting `status().isOk()` on the first dispatch and calling it a passing async test.**
Before the async result exists the response is an empty 200. That assertion holds whatever the
handler eventually does — including throwing. The meaningful assertions are all after
`asyncDispatch`.

**★ A ten-second pause at the end of a suite.**
`MockMvcTester.exchange()` waits for completion with a default timeout of ten seconds. A handler
that never completes turns each such test into a ten-second stall rather than an immediate
failure. `exchange(Duration.ofSeconds(2))` makes the failure fast and the intent explicit.

## Interview questions

**★ How do you test a controller that returns `DeferredResult` with the classic API?**
Two dispatches. Perform the request, assert `request().asyncStarted()` and optionally
`request().asyncResult(...)`, call `andReturn()`, then `perform(asyncDispatch(mvcResult))` and
assert the final response. The reference annotates that fourth step *"Manually perform an ASYNC
dispatch (as there is no running container)"*. Asserting only on the first dispatch tests the
empty pre-completion response and passes almost unconditionally.


**★ What does `MockMvcTester` do differently for async, and what is the catch?**
`exchange()` waits for completion, so the result is fully resolved and ordinary assertions apply —
that is the third of the API's three stated reasons for existing. The catch is a default ten-second
timeout, adjustable per request with `exchange(Duration)`; `asyncExchange()` opts out entirely when
you want to assert that processing started; and `mvc.perform(...)` opts out silently, because it
invokes `MockMvc` *"without any additional processing of asynchronous requests"*.


**★ Can you test a Server-Sent Events endpoint with MockMvc?**
A finite one, yes. An infinite one, no: *"`MockMvcWebTestClient` doesn't support infinite streams
because there is no way to cancel the server stream from the client side"* — the server has to
finish writing on its own, and there is no client connection to drop. That case needs a running
server.

{/* FOOTER */}

**★ Why does MockMvc need a manual async dispatch at all?**
Because Servlet async is defined as two passes: the handler returns, the container thread is
released, and later the container performs an ASYNC dispatch to write the response.
`MockMvc` invokes `DispatcherServlet` directly and there is no container to schedule that second
pass — the reference's own callout on the example says *"Manually perform an ASYNC dispatch (as
there is no running container)"*. `MockMvcTester.exchange()` performs the waiting for you; the
classic API does not.

{/* FOOTER */}
