---
title: "An exception in a handler puts a MockMvc test into one of two states — resolved, where a HandlerExceptionResolver produced a response you can assert on, and unresolved, where nothing did and there is therefore no response at all — and the classic API throws it out of perform() while MockMvcTester hands you a result object that throws only when you touch it"
sidebar_label: "03c · Resolved and unresolved failures"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the **Spring Framework 7.0.x** reference — "Defining
> Expectations" (AssertJ)
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/mockmvc/assertj/assertions.html)),
> "Performing Requests" (AssertJ), "Async Requests" (Hamcrest)
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/mockmvc/hamcrest/async-requests.html))
> and "Streaming Responses" — read as asciidoc source at tag `v7.0.9`, with listings taken from
> the reference's own `framework-docs` sources; plus the `spring-test` 7.0.9 sources for
> `MockMvcTester`, `MvcTestResult` and `MvcTestResultAssert`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9 (docs and sources read at 7.0.9), JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> **No sandbox** — every message string on this page is read out of `spring-test`'s own source,
> never from a console.

**[03](03-mockmvctester.md) and [03b](03b-the-classic-api.md) are two spellings of the same
engine. Here they stop being spellings. Two of the three reasons the AssertJ API was written are
behavioural rather than ergonomic, and this chunk is the first of them: what happens when a
handler throws. The second — asynchronous requests, where the classic API makes you dispatch twice
— is [03d · Async and streaming](03d-async-and-streaming.md).**

## 🔴 Resolved and unresolved — the distinction with no name in most codebases

A handler throws. What happens next depends entirely on whether something *handled* it:

- **Resolved.** A `HandlerExceptionResolver` — your `@ControllerAdvice`, Spring's
  `ResponseEntityExceptionHandler`, or the default resolvers — turned it into a response. There is
  a status, there are headers, there is a body. The request completed.
  [05 · @ControllerAdvice](../../phase-9-spring-boot/09-error-handling/05-controlleradvice.md) is
  the mechanism; [07 · Exception handlers](07-exception-handlers.md) is testing it.
- **Unresolved.** Nothing handled it. In a real deployment the container catches it and produces a
  500 through its error dispatch. In `MockMvc` there is no container and no error dispatch
  ([01b](01b-the-blank-request.md)), so **there is no response at all**.

`MvcTestResult`'s javadoc states the two states exactly:

> *"Can be in one of two distinct states: 1. The request processed successfully, even if it failed
> with an exception that has been resolved. The result is available, and
> `getUnresolvedException()` will return `null`. 2. The request failed unexpectedly.
> `getUnresolvedException()` provides more information about the error, and any attempt to access
> the result will fail with an exception."*

Read state 1 carefully: *"processed successfully, even if it failed with an exception that has
been resolved"*. A 400 produced by your advice is a **success** in this vocabulary. That is the
opposite of how people read `hasFailed()`.

## How each API surfaces it

**Classic.** An unresolved exception propagates out of `perform`. `MockMvc.perform` is declared `throws Exception`, so every test method that calls it must declare
it too. It is trivial and it is also the second of the AssertJ API's three stated reasons for
existing — *"Unresolved exceptions are handled consistently so that your tests do not need to
throw (or catch) `Exception`"*. The consequence is not the keyword; it is that a test method
declaring `throws Exception` gives you no signal about which exceptions the code under test can
actually produce, and that a handler exception propagates out of `perform` rather than becoming
something you assert on. That is the tax, and it is also the signal.

```java
// resolved: assert on the response, and optionally on what resolved it
MvcResult result = mockMvc.perform(get("/orders/-1"))
        .andExpect(status().isBadRequest())
        .andReturn();
assertThat(result.getResolvedException()).isInstanceOf(InvalidOrderId.class);

// unresolved: it comes out of perform(), so this is ordinary JUnit
assertThatThrownBy(() -> mockMvc.perform(get("/boom")))
        .hasRootCauseInstanceOf(IllegalStateException.class);
```

**AssertJ.** Nothing is thrown by the exchange. The reference:

> *"If a request fails, the exchange does not throw the exception. Rather, you can assert that the
> result of the exchange has failed."*

```java
assertThat(mockMvc.get().uri("/hotels/{id}", -1))
        .hasFailed()
        .hasStatus(HttpStatus.BAD_REQUEST)
        .failure().hasMessageContaining("Identifier should be positive");
```

That listing is the reference's own. And `MockMvcTester`'s class javadoc makes the scope of
`hasFailed()` explicit:

> *"**Both resolved and unresolved exceptions are considered a failure** that can be asserted as
> follows: `assertThat(mvc.get().uri("/boom")).hasFailed().failure().hasMessage("Test exception");`"*

## 🔴 The trap: `hasFailed()` covers both states, but the assertions after it do not

Because `hasFailed()` is true for a resolved *and* an unresolved exception, the chain you write
after it is what decides whether the test is meaningful — and the documentation warns about it:

> *"The request could also fail unexpectedly, that is the exception thrown by the handler has not
> been handled and is thrown as is. You can still use `.hasFailed()` and `.failure()` but **any
> attempt to access part of the result will throw an exception** as the exchange hasn't
> completed."*

and the javadoc is blunter:

> *"Any attempt to access the result with an unresolved exception will throw an `AssertionError`."*

So `hasStatus(BAD_REQUEST)` after `hasFailed()` is meaningful only in the resolved case; in the
unresolved case the same line raises an `AssertionError` from `MvcTestResultAssert`, which builds
its message from:

```text
Request failed unexpectedly:
<the indented stack trace of the unresolved exception>
```

Its two other assertion messages are worth recognising for the same reason:

```text
Expected request to fail, but it succeeded
Expected request to succeed, but it failed
```

Those three strings are read out of `MvcTestResultAssert`'s source, not from a console. When you
see the first one, your handler *is* handling the exception and there is a perfectly good response
to assert on instead.

## 🔴 The design consequence, which is bigger than the API choice

An unresolved exception in a `MockMvc` test means **you have no error contract for that
exception**. In production it becomes whatever the container's error page produces — a 500 with a
body your API never documented, or Boot's `/error` representation — and neither is something a
test asserted. A test that catches the propagating exception, or that asserts `hasFailed()` and
stops, has recorded the absence of a contract rather than a contract.

The fix is not in the test. It is a `@ControllerAdvice` that maps the exception, after which the
same test asserts a status and a body — [07 · Exception handlers](07-exception-handlers.md) and
[16 · The error floor](../../phase-9-spring-boot/09-error-handling/16-the-error-floor.md).

## Gotchas

**★ Reading `throws Exception` on every test method as noise.**
It is, but it is also load-bearing: an unresolved handler exception comes *out of* `perform`. A
test that expected a 500 body and got a propagated exception is not a broken test — it is the
classic API telling you nothing handled it.

**★ Reading `hasFailed()` as "the response was an error".**
It is true for a resolved exception too, and a resolved exception means the request *succeeded* in
`MvcTestResult`'s vocabulary — *"processed successfully, even if it failed with an exception that
has been resolved"*. A 400 from your `@ControllerAdvice` satisfies `hasFailed()`.

**★ Chaining `hasStatus(...)` after `hasFailed()` on an unresolved exception.**
There is no response, so *"any attempt to access part of the result will throw an exception"* —
an `AssertionError` built from *"Request failed unexpectedly:"* plus the stack trace. The
assertion that looked like it was checking a 500 is checking nothing.

**★ Treating an unresolved exception as a test problem.**
It is a production problem. Nothing maps that exception, so in a real container the client gets
whatever the error dispatch produces and no test describes it. Add the `@ControllerAdvice`
mapping, then assert the status and body.

**★ Catching the exception from `perform` and asserting on it as if it were the API's behaviour.**
`assertThatThrownBy(() -> mockMvc.perform(...))` documents that nothing handles the exception. It
is a legitimate characterisation test of a gap; it is not a test of an error contract, and it
should carry a comment saying which it is.

## Interview questions

**★ What is the difference between a resolved and an unresolved exception in a MockMvc test?**
A resolved exception was turned into a response by a `HandlerExceptionResolver` — your
`@ControllerAdvice` or Spring's defaults — so there is a status and a body to assert. An unresolved
exception was handled by nothing; since `MockMvc` runs no container and performs no error dispatch,
there is no response at all. `MvcTestResult` names the two states directly and says that a resolved
failure counts as the request having *"processed successfully"*.

**★ How does each API surface an unresolved exception?**
The classic API throws it out of `perform`, which is why every test method calling `perform`
declares `throws Exception`. `MockMvcTester` does not throw: it returns an `MvcTestResult` whose
`getUnresolvedException()` is non-null, `hasFailed()` is true and `failure()` is assertable — but
any attempt to read the response raises an `AssertionError` reading *"Request failed
unexpectedly:"* followed by the stack trace.

**★ Your test asserts `hasFailed().hasStatus(INTERNAL_SERVER_ERROR)` and fails with an
`AssertionError` about the request failing unexpectedly. What does that tell you?**
That the exception is unresolved, so there is no response and no status to check. The right
conclusion is not to change the assertion but to notice that this exception has no error contract:
in production the client gets whatever the container's error handling produces. Map it in a
`@ControllerAdvice` and the assertion becomes possible and meaningful.


{/* FOOTER */}
