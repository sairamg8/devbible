---
title: "A @Valid failure in a bare @WebMvcTest gives you a 400 with an EMPTY body — because Spring's default resolver calls response.sendError(...) and MockMvc performs no error dispatch, so Boot's /error controller never runs — which means the error body most people believe they are testing is produced by a @ControllerAdvice that has to be in the slice, or by a property that is off by default"
sidebar_label: "06 · Validation errors"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the **Spring Framework 7.0.9** sources —
> `DefaultHandlerExceptionResolver.handleErrorResponse` and `MockHttpServletResponse.sendError` —
> and the **Spring Boot 4.1.1** sources for
> [`WebMvcProperties.Problemdetails`](https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-webmvc/src/main/java/org/springframework/boot/webmvc/autoconfigure/WebMvcProperties.java),
> [`ProblemDetailsExceptionHandler`](https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-webmvc/src/main/java/org/springframework/boot/webmvc/autoconfigure/ProblemDetailsExceptionHandler.java)
> and its `@ConditionalOnBooleanProperty` registration in `WebMvcAutoConfiguration`; plus the
> Spring Framework 7.0.x reference "Defining Expectations", read as asciidoc at tag `v7.0.9`.
> The validation mechanism itself belongs to
> [08 · Validation](../../phase-9-spring-boot/08-validation/07-the-failure.md) and
> [09 · Error handling](../../phase-9-spring-boot/09-error-handling/01-the-error-shape-is-a-contract.md).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8 (sources read at 7.0.9 / 4.1.1), JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> **No sandbox** — this page carries Java source and library source, never a fabricated test run.

**Validation is the most commonly tested thing in a controller test and the most commonly
mis-tested. The reason is a gap between what a bare slice produces and what production produces:
in a `@WebMvcTest` with no exception handling of your own, an invalid request body gives you a 400
with **no body at all**, and a test asserting the error shape has to be told where that shape comes
from. This chunk is which exception each failure raises, what the slice does with it by default,
and how to test the error contract you actually publish.**

## Which failure raises which exception

| Cause | Exception | Default status |
|---|---|---|
| `@Valid @RequestBody` fails a constraint | `MethodArgumentNotValidException` | 400 |
| constraint on a `@RequestParam` / `@PathVariable`, class annotated `@Validated` | `HandlerMethodValidationException` | 400 |
| a path variable or parameter cannot be converted | `MethodArgumentTypeMismatchException` | 400 |
| a required parameter is absent | `MissingServletRequestParameterException` | 400 |
| the body cannot be parsed at all | `HttpMessageNotReadableException` | 400 |

Which one you get is decided by the handler-method signature, and that is
[07 · What the failure is](../../phase-9-spring-boot/08-validation/07-the-failure.md)'s subject.
For testing, the thing to take from the table is that four different exceptions all produce 400,
so **a test asserting only `hasStatus(400)` does not distinguish "the field was blank" from "the
JSON did not parse"** — and those have different error bodies and different meanings to a client.

## 🔴 What a bare slice actually returns: 400, and nothing else

With no `@ControllerAdvice` and no problem-details support, the exception reaches
`DefaultHandlerExceptionResolver`, whose `handleErrorResponse` does this:

```java
if (!response.isCommitted()) {
    HttpHeaders headers = errorResponse.getHeaders();
    headers.forEach((name, values) -> values.forEach(value -> response.addHeader(name, value)));

    int status = errorResponse.getStatusCode().value();
    String message = errorResponse.getBody().getDetail();
    if (message != null) {
        response.sendError(status, message);
    }
    else {
        response.sendError(status);
    }
}
return new ModelAndView();
```

and `MockHttpServletResponse.sendError` does this:

```java
@Override
public void sendError(int status, String errorMessage) throws IOException {
    Assert.state(!isCommitted(), "Cannot set error status - response is already committed");
    this.status = status;
    this.errorMessage = errorMessage;
    setCommitted(true);
}
```

**Status set, message stored, response committed, no body written.** In a deployed application the
container would then perform an *error dispatch* to `/error`, where Boot's `BasicErrorController`
renders the JSON error body everyone recognises. `MockMvc` performs no error dispatch —
[01b](01b-the-blank-request.md): *"there is no… forwarding, error, or async dispatches"* — so that
step never happens and the body is empty.

The message is still reachable, because the mock response kept it:

```java
MvcTestResult result = mvc.post().uri("/orders").contentType(APPLICATION_JSON)
        .content("{\"quantity\":-1}").exchange();

assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
assertThat(result.getResponse().getErrorMessage()).contains("quantity");
```

⚠️ That last line is a characterisation test of Spring's own message, not of your contract. It is
useful while you are working out what happened and it should not survive into the suite — the
message text is Spring's to change, and it is locale-dependent once a `MessageSource` is involved
([14 · Messages and interpolation](../../phase-9-spring-boot/08-validation/14-messages-and-interpolation.md)).

## Where the body you expected comes from

Three possibilities, and a controller test has to know which one is in play.

**1 · Your own `@ControllerAdvice`.** This is the common case and the good one. `@ControllerAdvice`
is on `@WebMvcTest`'s scan allow-list ([02](02-webmvctest.md)), so your advice **is** in the slice
and produces your body. Nothing else needs configuring, and the test asserts your published shape:

```java
@WebMvcTest(OrderController.class)
class OrderValidationTests {

    @Autowired MockMvcTester mvc;
    @MockitoBean OrderService orders;

    @Test
    void a_blank_reference_is_reported_as_a_field_error() {
        assertThat(mvc.post().uri("/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reference\":\"\",\"quantity\":1}"))
            .hasStatus(HttpStatus.BAD_REQUEST)
            .bodyJson().extractingPath("$.errors[?(@.field == 'reference')].code")
                .asArray().containsExactly("NotBlank");
    }
}
```

**2 · Boot's RFC 9457 support, which is off by default.** `WebMvcProperties.Problemdetails` has a
plain `boolean enabled` with no initialiser — so `spring.mvc.problemdetails.enabled` is `false`
unless you set it — and the handler is registered conditionally:

```java
@ConditionalOnBooleanProperty("spring.mvc.problemdetails.enabled")
static class ProblemDetailsErrorHandlingConfiguration {

    @Bean
    @ConditionalOnMissingBean(ResponseEntityExceptionHandler.class)
    @Order(0)
    ProblemDetailsExceptionHandler problemDetailsExceptionHandler() {
        return new ProblemDetailsExceptionHandler();
    }
}
```

`ProblemDetailsExceptionHandler` is *"`@ControllerAdvice` annotated `ResponseEntityExceptionHandler`
that is auto-configured for problem details support"*. Two consequences worth holding: it **backs
off entirely** if you define any `ResponseEntityExceptionHandler` bean of your own, and it is
enabled by a property, which a slice test can set locally:

```java
@WebMvcTest(properties = "spring.mvc.problemdetails.enabled=true")
```

If production enables it and the test does not, the test asserts the empty-body behaviour and
production returns a `application/problem+json` document — a divergence no assertion catches
because both are 400. Set the property in the test if it is set in production.
[06 · ProblemDetail and RFC 9457](../../phase-9-spring-boot/09-error-handling/06-problemdetail-and-rfc-9457.md)
is the format itself.

**3 · Boot's `/error` fallback — which the slice does not reach.** This is the one to stop
expecting. `BasicErrorController` is a controller mapped to `/error`, invoked by the container's
error dispatch. No error dispatch, no `/error`, no body. A body that appears when you run the
application and disappears in `MockMvc` is almost always this.

That is the whole mechanism. What you do about it — which assertions are worth writing, why the
default message is the wrong thing to pin, and the form-controller case where a validation failure
is a **200** — is [06b · Asserting the error contract](06b-asserting-the-error-contract.md).

## Gotchas

**★ Expecting an error body in a bare `@WebMvcTest`.**
`DefaultHandlerExceptionResolver` calls `response.sendError(...)`, which on the mock response sets
the status and commits without writing anything. Boot's `/error` body comes from a container error
dispatch that `MockMvc` does not perform.

**★ Asserting only `hasStatus(400)`.**
Five different failures produce 400 — constraint violation, type mismatch, missing parameter,
unparseable body, and your own rejection. A test that cannot tell them apart passes when the
request fails for the wrong reason.

**★ Not setting `spring.mvc.problemdetails.enabled` in the test when production sets it.**
The property defaults to `false`. Production returns `application/problem+json` and the test sees
an empty body — both 400, so nothing fails. Put it in `@WebMvcTest(properties = ...)`.

**★ Defining your own `ResponseEntityExceptionHandler` and wondering why problem details stopped.**
`ProblemDetailsExceptionHandler` is `@ConditionalOnMissingBean(ResponseEntityExceptionHandler.class)`
— your bean replaces it entirely, including for the exceptions you did not override.

## Interview questions

**★ Why does a `@Valid` failure in a `@WebMvcTest` return an empty body?**
Because `DefaultHandlerExceptionResolver.handleErrorResponse` calls `response.sendError(status,
message)`, and `MockHttpServletResponse.sendError` only records the status and message and marks
the response committed. In a real container the next step is an *error dispatch* to `/error`,
where `BasicErrorController` writes the body — and `MockMvc` performs no error dispatch. The body
you see in production comes from a step the test never runs.

**★ Where should the error body under test come from, then?**
From a `@ControllerAdvice` you wrote, which *is* included in the slice because `@ControllerAdvice`
is on `@WebMvcTest`'s allow-list; or from Boot's `ProblemDetailsExceptionHandler`, which is a
`@ControllerAdvice` registered only when `spring.mvc.problemdetails.enabled` is true — and that
property defaults to false. If neither is in play, the correct assertion is the status alone.

{/* FOOTER */}
