---
title: "Extending ResponseEntityExceptionHandler hands you twenty RFC 9457 handlers behind one final method, makes handleExceptionInternal the single place every error body is decided, and removes Boot's own advice from the context by @ConditionalOnMissingBean — while @ExceptionHandler's produces attribute turns the mapping key into a PAIR, which is why two handlers for one exception are legal and why your test has to send an Accept header"
sidebar_label: "07f · ResponseEntityExceptionHandler"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-30 against the **Spring Framework 7.0.9** sources —
> [`ResponseEntityExceptionHandler`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-webmvc/src/main/java/org/springframework/web/servlet/mvc/method/annotation/ResponseEntityExceptionHandler.java)
> (the `@ExceptionHandler` list, `handleException`, `handleExceptionInternal`, `createResponseEntity`),
> [`ExceptionHandlerMethodResolver`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-web/src/main/java/org/springframework/web/method/annotation/ExceptionHandlerMethodResolver.java)
> (`ExceptionMapping`, `ExceptionMappingComparator`, `detectExceptionMappings`),
> `ExceptionHandlerExceptionResolver.getExceptionHandlerMethod`, and the
> [`@ExceptionHandler`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-web/src/main/java/org/springframework/web/bind/annotation/ExceptionHandler.java)
> javadoc for `produces` (since 6.2); plus **Spring Boot 4.1.1** `ProblemDetailsExceptionHandler`
> and its `@ConditionalOnMissingBean` registration.
> Deeper on the base class itself:
> [10 · ResponseEntityExceptionHandler](../../phase-9-spring-boot/09-error-handling/10-responseentityexceptionhandler.md).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9 (sources read at 7.0.9 / 4.1.1), JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> **No sandbox** — this page carries Java source and library source, never a fabricated test run.

**[07e](07e-what-the-handler-produces.md) covered the three ways to declare a status that write no
body under `MockMvc`. This chunk is the fourth way — the base class that writes one — and the
attribute that lets two handlers claim the same exception. Both change what a slice test has to
send and assert, and both change what is in your context.**

## Extending `ResponseEntityExceptionHandler`

> *"A class with an `@ExceptionHandler` method that handles all Spring MVC raised exceptions by
> returning a `ResponseEntity` with RFC 9457 formatted error details in the body. Convenient as a
> base class of an `@ControllerAdvice` for global exception handling in an application. Subclasses
> can override individual methods that handle a specific exception, override
> `handleExceptionInternal` to override common handling of all exceptions, or override
> `createResponseEntity` to intercept the final step of creating the `ResponseEntity` from the
> selected HTTP status code, headers, and body."*

Its entry point is one method mapping twenty exception types — `HttpRequestMethodNotSupported`,
`HttpMediaTypeNotSupported`, `HttpMediaTypeNotAcceptable`, `MissingPathVariable`,
`MissingServletRequestParameter`, `MissingServletRequestPart`, `ServletRequestBinding`,
`MethodArgumentNotValid`, `HandlerMethodValidation`, `NoHandlerFound`, `NoResourceFound`,
`AsyncRequestTimeout`, `ErrorResponseException`, `MaxUploadSizeExceeded`, `ConversionNotSupported`,
`TypeMismatch`, `HttpMessageNotReadable`, `HttpMessageNotWritable`, `MethodValidation`,
`AsyncRequestNotUsable` — and it is **`final`**:

```java
public final @Nullable ResponseEntity<Object> handleException(Exception ex, WebRequest request) throws Exception {
```

You cannot override the dispatcher; you override one of the `handleXxx` methods it delegates to, or
one of the two hooks. `handleExceptionInternal` is the hook that earns its keep:

```java
protected @Nullable ResponseEntity<Object> handleExceptionInternal(
        Exception ex, @Nullable Object body, HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {

    if (request instanceof ServletWebRequest servletWebRequest) {
        HttpServletResponse response = servletWebRequest.getResponse();
        if (response != null && response.isCommitted()) {
            if (logger.isWarnEnabled()) {
                logger.warn("Response already committed. Ignoring: " + ex);
            }
            return null;
        }
    }

    if (body == null && ex instanceof ErrorResponse errorResponse) {
        body = errorResponse.updateAndGetBody(this.messageSource, LocaleContextHolder.getLocale());
    }

    if (statusCode.equals(HttpStatus.INTERNAL_SERVER_ERROR) && body == null) {
        request.setAttribute(WebUtils.ERROR_EXCEPTION_ATTRIBUTE, ex, WebRequest.SCOPE_REQUEST);
    }

    return createResponseEntity(body, headers, statusCode, request);
}
```

Three things a test should know from those twenty lines. **One:** it returns `null` when the
response is already committed — so a handler that fires after streaming has begun produces nothing,
and this is the mechanism behind
[19 · Committed responses](../../phase-9-spring-boot/09-error-handling/19-committed-responses.md).
**Two:** the body is built by `errorResponse.updateAndGetBody(messageSource, locale)`, which is why
your error details are locale-dependent and why the slice needs `MessageSourceAutoConfiguration`
(it has it) to reproduce production. **Three:** overriding this one method is how you add a
correlation id or a `code` field to *every* error at once, which is the right place for it —
override `createResponseEntity` instead if you need to replace the `ProblemDetail` with an
extension type.

🔴 **Defining any `ResponseEntityExceptionHandler` bean backs Boot's out of the context**, because
`ProblemDetailsExceptionHandler` is registered `@ConditionalOnMissingBean(ResponseEntityExceptionHandler.class)`
([06](06-validation-errors.md)). That is usually what you want — one handler, yours — but it means
a slice test with `spring.mvc.problemdetails.enabled=true` and your own subclass is exercising
*your* twenty overrides, not Boot's defaults. Both configurations return `problem+json`; only one
is under your control.

## `produces`: content-negotiated error handlers

`@ExceptionHandler` gained a `produces` attribute in 6.2:

```java
@ExceptionHandler(exception = OrderNotFound.class, produces = "application/problem+json")
ProblemDetail handleAsProblem(OrderNotFound ex) { … }

@ExceptionHandler(exception = OrderNotFound.class, produces = "text/html")
String handleAsPage(OrderNotFound ex) { … }
```

`ExceptionHandlerExceptionResolver` resolves the client's accepted media types before searching, and
`ExceptionMappingComparator` breaks depth ties by preferring an exact media-type match and then the
more specific one. Two consequences for a test:

- these two handlers are **not** an ambiguous mapping — the mapping key is (exception type, media
  type), so both are legal; the same two *without* `produces` would throw
  `IllegalStateException` at context startup ([07b](07b-which-advice-applies.md));
- **the test must send `Accept`.** A request with no `Accept` header negotiates to `*/*` and you
  will get whichever the comparator ranks first, which is not necessarily the one you meant:

```java
assertThat(mvc.get().uri("/orders/42").accept(MediaType.APPLICATION_PROBLEM_JSON))
    .hasStatus(HttpStatus.NOT_FOUND)
    .hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
```

`hasContentTypeCompatibleWith` and not `hasContentType`, for the charset reason in
[05](05-asserting-the-response.md).

⚠️ An invalid media type string in `produces` is one of the three documented `IllegalStateException`
causes — `"Invalid media type [...] declared on @ExceptionHandler for "` — thrown from the same
constructor, so a typo there fails the context for an advice and the request for a controller.


## What the twenty handlers mean for a slice test

Extending the base class changes the *default* for exceptions your advice never mentions. Before,
`MethodArgumentNotValidException` reached `DefaultHandlerExceptionResolver` and produced an
empty-bodied 400 ([06](06-validation-errors.md)); after, it reaches
`handleMethodArgumentNotValid` and produces a `ProblemDetail`. Two practical consequences:

- **Existing tests change without being edited.** A test asserting `hasStatus(400)` still passes; a
  test asserting `getResponse().getErrorMessage()` — the characterisation assertion
  [06](06-validation-errors.md) warns against keeping — starts failing, because the message is now
  a body rather than a `sendError` message. That failure is correct and the test was the problem.
- **The 404 case depends on configuration you may not have set.** `NoHandlerFoundException` and
  `NoResourceFoundException` are both in the list, but which one a given unmatched path raises
  depends on your resource handling and on
  `spring.mvc.throw-exception-if-no-handler-found`. **I could not confirm from the Boot 4.1
  documentation which of the two a given path produces by default**, so read it once off
  `result.getResolvedException()` rather than assuming, then assert the status and shape.

## Gotchas
**★ Trying to override `handleException` on `ResponseEntityExceptionHandler`.**
It is `final`. Override the specific `handleXxx` method, or `handleExceptionInternal` for all of
them, or `createResponseEntity` for the last step.

**★ Extending `ResponseEntityExceptionHandler` and being surprised that Boot's problem details
stopped.**
`ProblemDetailsExceptionHandler` is `@ConditionalOnMissingBean(ResponseEntityExceptionHandler.class)`
— your bean replaces it entirely, including for the exceptions you never overrode. That is fine,
but it means those twenty defaults are now yours to keep working.

**★ Forgetting that `handleExceptionInternal` returns `null` on a committed response.**
Nothing is written and the exception is only logged at WARN. In an async or streaming handler the
response commits early, so the error contract you tested synchronously does not apply
([03d](03d-async-and-streaming.md)).

**★ Testing a `produces`-qualified handler without an `Accept` header.**
The request negotiates to `*/*` and the comparator picks by media-type specificity, not by your
intent. Always set `.accept(...)` when more than one handler maps the same exception.

**★ Overriding a `handleXxx` method and forgetting to call through.**
Each `handleXxx` funnels into `handleExceptionInternal`, which is where the committed-response
check, the `ErrorResponse` body extraction and the 500 request-attribute all live. Returning a
hand-built `ResponseEntity` from the override skips every one of them.

**★ Extending `ResponseEntityExceptionHandler` *and* keeping a second unordered advice that maps
the same exceptions.**
Now two advices claim `MethodArgumentNotValidException` and the winner is
[07](07-exception-handlers.md)'s ordering tie. Fold the mappings into the subclass, or order them.

**★ Asserting a `ProblemDetail` field that the base class only fills from a `MessageSource`.**
`handleExceptionInternal` builds the body with
`errorResponse.updateAndGetBody(this.messageSource, LocaleContextHolder.getLocale())`. The slice has
`MessageSourceAutoConfiguration`, so this works — but a *standalone* advice test
([07d](07d-tests-that-pin-the-handler.md)) has no `MessageSource` and the detail will differ.

**★ Declaring `produces` with a media type string that does not parse.**
`detectExceptionMappings` throws `IllegalStateException("Invalid media type [...] declared on
@ExceptionHandler for " + method)` from the same constructor as the ambiguity check — a context
failure for an advice, a request failure for a controller ([07b](07b-which-advice-applies.md)).

**★ Relying on `produces` to route by `Content-Type` rather than `Accept`.**
`getExceptionHandlerMethod` resolves the *accepted* media types through the
`ContentNegotiationManager`; `produces` is matched against what the client will accept. A request
that posts JSON but accepts HTML gets the HTML handler.

## Interview questions
**★ What does extending `ResponseEntityExceptionHandler` actually give you, and what does it take
away?**
It gives you `@ExceptionHandler` coverage of twenty Spring MVC exceptions, each rendered as an RFC
9457 `ProblemDetail`, with a `handleXxx` method per exception you can override and two shared hooks
— `handleExceptionInternal` for common handling and `createResponseEntity` for the final step. It
takes away Boot's `ProblemDetailsExceptionHandler`, which is registered
`@ConditionalOnMissingBean(ResponseEntityExceptionHandler.class)`, so defining yours means those
twenty defaults are your responsibility from then on.

**★ Where would you add a correlation id to every error body?**
`handleExceptionInternal`, overridden once in your `ResponseEntityExceptionHandler` subclass. It is
the single point every one of the twenty handlers funnels through before `createResponseEntity`, and
the `body` is still mutable there. Doing it in each `handleXxx` is twenty places to forget one;
doing it in a `ResponseBodyAdvice` catches successful responses too, which is usually not wanted.
See [14 · Correlation ids and logging](../../phase-9-spring-boot/09-error-handling/14-correlation-ids-and-logging.md).

**★ Two `@ExceptionHandler` methods map the same exception type. When is that legal?**
When they declare different `produces` media types. The mapping key is the pair (exception type,
media type), so two entries coexist and `ExceptionMappingComparator` chooses by depth first, then
by exact match against the requested media type, then by media-type specificity. Without `produces`
the keys collide and the constructor throws *"Ambiguous `@ExceptionHandler` method mapped for"*. A
test for a content-negotiated handler must send an explicit `Accept` header, or it is testing the
`*/*` path.

**★ A team adds `extends ResponseEntityExceptionHandler` to an existing advice and three unrelated
tests fail. Is that a regression?**
Almost certainly not — it is the tests catching a real behaviour change. Twenty Spring MVC
exceptions that previously fell through to `DefaultHandlerExceptionResolver` and produced
empty-bodied responses now produce `ProblemDetail` bodies. Tests that asserted on the `sendError`
message, or that asserted an empty body, were characterising the absence of an error contract.
Rewrite them against the new shape rather than reverting.

**★ How does the resolver decide between two handlers when the client sends
`Accept: application/json, text/html;q=0.8`?**
`getExceptionHandlerMethod` asks the `ContentNegotiationManager` for the accepted media types and
then loops over them **in order**, returning on the first mapping that resolves — so the client's
preference order drives the outer loop, and `ExceptionMappingComparator` only decides among the
matches for one media type. A test that sends a multi-value `Accept` is testing that loop, which is
worth doing once for a genuinely content-negotiated API.

{/* FOOTER */}
