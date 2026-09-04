---
title: "ResponseEntityExceptionHandler and the problemdetails switch"
sidebar_label: "10 · ResponseEntityExceptionHandler"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the `ResponseEntityExceptionHandler` javadoc
> (docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/mvc/method/annotation/ResponseEntityExceptionHandler.html
> — the class description, the protected `handle*` methods and their common
> signature, `handleExceptionInternal`, `createProblemDetail` and
> `createResponseEntity`), the Spring Framework reference *Error Responses*
> (the "extend it and declare it as an `@ControllerAdvice`" instruction) and the
> Spring Boot reference *Servlet Web Applications · Error Handling*
> (`spring.mvc.problemdetails.enabled`). Spring Boot 4.1.1, Spring Framework
> 7.0.x, JDK 25.

**Spring already knows the correct status for every error it raises itself — 405
for a wrong verb, 415 for an unsupported content type, 400 for an unreadable
body. `ResponseEntityExceptionHandler` is the base class that hands you those
mappings as overridable methods, so you can standardise the *body* without
re-deriving the *statuses*. Writing your own advice from scratch and then adding
handlers for Spring's exceptions one at a time is rebuilding this class, badly.**

## What the class is

The javadoc: *"A class with an `@ExceptionHandler` method that handles all
Spring MVC raised exceptions by returning a `ResponseEntity` with RFC 9457
formatted error details in the body. Convenient as a base class of an
`@ControllerAdvice` for global exception handling in an application."*

Using it is one line:

```java
@RestControllerAdvice
class ApiErrorHandler extends ResponseEntityExceptionHandler {

    // your own domain handlers go here, as normal @ExceptionHandler methods
    @ExceptionHandler
    ProblemDetail handle(OrderNotFoundException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        pd.setType(URI.create("https://api.example.com/problems/order-not-found"));
        pd.setTitle("Order not found");
        return pd;
    }
}
```

You now have RFC 9457 bodies for **both** Spring's exceptions and yours, from
one class, with no mapping table for the former.

## The overridable surface

Every method is `protected`, so overriding is opt-in per exception. They share a
signature — `(TheException ex, HttpHeaders headers, HttpStatusCode status,
WebRequest request)` — which is worth noticing: **the status is passed in**,
already decided by Spring, so an override that only wants to change the body
does not have to know the correct status.

| Method | Exception |
|---|---|
| `handleHttpRequestMethodNotSupported` | wrong HTTP verb (405) |
| `handleHttpMediaTypeNotSupported` | unsupported `Content-Type` (415) |
| `handleHttpMediaTypeNotAcceptable` | unsatisfiable `Accept` (406) |
| `handleMissingPathVariable` | a `@PathVariable` the URI template did not supply |
| `handleMissingServletRequestParameter` | a required `@RequestParam` absent |
| `handleMissingServletRequestPart` | a required multipart part absent |
| `handleServletRequestBindingException` | a fatal binding problem — missing header, missing cookie |
| `handleMethodArgumentNotValid` | `@Valid` failure on a `@RequestBody` |
| `handleHandlerMethodValidationException` | constraint failure on method parameters |
| `handleNoHandlerFoundException` | no mapping matched |
| `handleNoResourceFoundException` | static resource not found |
| `handleAsyncRequestTimeoutException` | async processing timed out |
| `handleErrorResponseException` | any `ErrorResponseException` — the family catch |
| `handleMaxUploadSizeExceededException` | upload too large |
| `handleConversionNotSupported` | conversion has no converter (a 500 — it is a config bug) |
| `handleTypeMismatch` | a value could not be converted to the target type |
| `handleHttpMessageNotReadable` | malformed request body |
| `handleHttpMessageNotWritable` | the response could not be serialised |
| `handleMethodValidationException` | method-validation failure |
| `handleAsyncRequestNotUsableException` | the client went away mid-async; *"by default, return `null` since the response is not usable"* |

Three more are the machinery rather than the mappings:

- **`handleExceptionInternal`** — *"internal handler method that all others
  delegate to"*. It returns `null` if the response is already committed, sets
  the error attribute for a 500 status, and extracts the body from an
  `ErrorResponse`. This is where [message-code
  resolution](09-message-codes-and-i18n.md) happens.
- **`createProblemDetail`** — builds a `ProblemDetail` with `MessageSource`
  lookup for the detail field.
- **`createResponseEntity`** — assembles the final entity; *"subclasses can
  override to inspect/modify the response"*.

## The three override points, from cheapest to broadest

**One exception's body — override its `handle*` method:**

```java
@Override
protected ResponseEntity<Object> handleHttpMessageNotReadable(
        HttpMessageNotReadableException ex, HttpHeaders headers,
        HttpStatusCode status, WebRequest request) {

    ProblemDetail pd = createProblemDetail(
            ex, status, "The request body could not be parsed.", null, null, request);
    pd.setType(URI.create("https://api.example.com/problems/malformed-body"));
    pd.setTitle("Malformed request body");
    return handleExceptionInternal(ex, pd, headers, status, request);
}
```

Note what this does **not** do: it does not decide the status, and it does not
build the `ResponseEntity` by hand. `createProblemDetail` and
`handleExceptionInternal` do both, so message resolution and the
already-committed check survive.

**Every response's shape — override `handleExceptionInternal`:**

```java
@Override
protected ResponseEntity<Object> handleExceptionInternal(
        Exception ex, Object body, HttpHeaders headers,
        HttpStatusCode status, WebRequest request) {

    ResponseEntity<Object> response = super.handleExceptionInternal(ex, body, headers, status, request);
    if (response != null && response.getBody() instanceof ProblemDetail pd) {
        pd.setProperty("correlationId", MDC.get("correlationId"));
    }
    return response;
}
```

That is the right place for anything that must be on **every** error — a
correlation id, a timestamp, a trace id. Doing it per-handler guarantees you
will miss one.

⚠️ **Call `super` and honour a `null` return.** `super` is what performs the
committed-response check; returning a fabricated entity when it returned `null`
means writing to a response that has already gone out.

**Every response's headers or status — override `createResponseEntity`.**
Narrow, and rarely what you want; prefer `handleExceptionInternal`.

## `spring.mvc.problemdetails.enabled` — the other route

Boot exposes a switch that turns on RFC 9457 responses for Spring MVC's built-in
exceptions with no advice at all:

```yaml
spring:
  mvc:
    problemdetails:
      enabled: true
```

It works because [every Spring MVC exception implements
`ErrorResponse`](08-errorresponse.md) and therefore already carries a
`ProblemDetail`; the property just makes the framework render it.

**How to choose:**

| | `problemdetails.enabled` | extend `ResponseEntityExceptionHandler` |
|---|---|---|
| Effort | One property | One class |
| Covers Spring's exceptions | ✅ | ✅ |
| Covers **your** exceptions | ⛔ no — you still need handlers | ✅ same class |
| Customise the body per exception | ⛔ only via message codes | ✅ override the `handle*` method |
| Add a field to every error | ⛔ | ✅ `handleExceptionInternal` |
| Message-code resolution | ✅ | ✅ |

The property is the right answer for a service whose only requirement is "don't
return Boot's default error shape". The base class is the right answer for
anything that also has domain exceptions — which is nearly everything. They are
not mutually exclusive, but once you extend the base class the property adds
nothing.

## The trade-off

Extending `ResponseEntityExceptionHandler` gives you twenty correct status
mappings for free, and couples your advice to a Spring class whose protected
surface can grow. New `handle*` methods appear across versions — that is how
`handleNoResourceFoundException` and
`handleAsyncRequestNotUsableException` arrived — so an upgrade can change the
handling of an exception you never wrote code for. That is usually an
improvement, but it is a behaviour change you did not author, and it argues for
tests that assert the status and shape of your common error paths.

## Gotchas

**Symptom** — you extend the class and your `@ExceptionHandler` methods work,
but Spring's exceptions still return Boot's default body.
**Cause** — the class is extended but not declared as an advice: the reference
says to *"extend `ResponseEntityExceptionHandler` and declare it as an
`@ControllerAdvice`"*, and the annotation is the half that registers it.
**Fix** — annotate it `@RestControllerAdvice`.

**Symptom** — an override changed the body and also silently changed the status.
**Cause** — the override built a `ResponseEntity.badRequest()` instead of using
the `status` parameter it was handed.
**Fix** — use the passed-in `status`; it is the correct one for that exception
and passing it through is why the parameter exists.

**Symptom** — overriding `handleExceptionInternal` causes intermittent
`IllegalStateException`s about the response being committed.
**Cause** — `super.handleExceptionInternal` returned `null` because the response
was already committed, and the override ignored that and returned an entity.
**Fix** — null-check the `super` result and return it unchanged when it is
`null`. Committed-response cases are [chunk 19](19-committed-responses.md).

**Symptom** — after a Spring upgrade, an error that used to be a 500 is now a
404 with a problem body.
**Cause** — a new `handle*` method was added for an exception that previously
fell through.
**Fix** — nothing to fix, but assert your common error statuses in tests so the
change is visible at upgrade time rather than in production.

**Symptom** — extending the class stops your own catch-all
`handle(Exception ex)` from firing for Spring's exceptions.
**Cause** — correct and desirable: the inherited handlers are more specific and
now claim them.
**Fix** — none needed. This is the reason to extend it in the first place: your
catch-all was flattening 405s and 415s into 500s.

**Symptom** — `handleMethodArgumentNotValid` is overridden and the field errors
are gone from the body.
**Cause** — the override built a plain `ProblemDetail` and never read
`ex.getFieldErrors()`.
**Fix** — see [chunk 11](11-mapping-domain-exceptions.md), which builds the
field-level body properly.

## Interview questions

**★ What does `ResponseEntityExceptionHandler` give you?**
An `@ExceptionHandler` that handles every Spring MVC exception with an RFC 9457
body, plus a protected `handle*` method per exception so you can customise any
of them individually, plus `handleExceptionInternal` as the common funnel where
message resolution and the committed-response check happen. You extend it and
annotate the subclass as an advice.

**★ Why does every `handle*` method receive the status as a parameter?**
Because Spring has already decided the correct status for its own exception, and
an override that only wants to change the body should not have to re-derive it.
Passing it through is also what keeps overrides from accidentally changing
semantics — a 415 stays a 415 unless you deliberately return something else.

**★ Where do you add a field that must appear on every error response?**
`handleExceptionInternal`, because every other method delegates to it. Adding it
per-handler works until someone adds the twenty-first handler and forgets. Call
`super` first, and pass through its `null` return, which signals an already
committed response.

**★ `spring.mvc.problemdetails.enabled` or extend the base class?**
The property if all you need is RFC 9457 for Spring's own exceptions and you
have no domain exceptions to map. The base class as soon as you have your own
exceptions, want a per-exception body, or need a field on every error. Once you
extend the class, the property adds nothing.

**★ What is the risk of extending a framework base class here?**
Its protected surface grows between versions, so an upgrade can change how an
exception you never handled is rendered — `handleNoResourceFoundException` and
`handleAsyncRequestNotUsableException` are both examples of methods that were
added. The mitigation is tests asserting the status and shape of your common
error paths, so the change shows up at upgrade time.

**★ How do you keep message-source overrides working inside a custom `handle*`
method?**
Build the detail with `createProblemDetail(...)` and return through
`handleExceptionInternal(...)` rather than constructing a `ProblemDetail` and a
`ResponseEntity` by hand. Those two methods are where the `MessageSource` lookup
and the committed check live.

---

← Prev: [Message codes and i18n](09-message-codes-and-i18n.md) · Index: [Error handling](README.md) · Next → [Mapping your domain exceptions](11-mapping-domain-exceptions.md)
