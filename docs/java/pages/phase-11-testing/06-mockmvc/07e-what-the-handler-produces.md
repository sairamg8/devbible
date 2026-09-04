---
title: "@ResponseStatus on an exception class and a bare ResponseStatusException are resolved by a DIFFERENT resolver that also calls sendError, so under MockMvc they produce exactly the empty-bodied response a bare @Valid failure does — and the handler's return type decides the rest, where a String on a plain @ControllerAdvice is a VIEW NAME and a DTO with no status is a 200 carrying an error"
sidebar_label: "07e · What the handler produces"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-30 against the **Spring Framework 7.0.9** sources —
> [`ResponseStatusExceptionResolver`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-webmvc/src/main/java/org/springframework/web/servlet/mvc/annotation/ResponseStatusExceptionResolver.java),
> [`ResponseEntityExceptionHandler`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-webmvc/src/main/java/org/springframework/web/servlet/mvc/method/annotation/ResponseEntityExceptionHandler.java),
> [`ErrorResponseException`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-web/src/main/java/org/springframework/web/ErrorResponseException.java),
> [`ResponseStatusException`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-web/src/main/java/org/springframework/web/server/ResponseStatusException.java)
> and the [`@ExceptionHandler`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-web/src/main/java/org/springframework/web/bind/annotation/ExceptionHandler.java)
> javadoc (supported return types); plus **Spring Boot 4.1.1** `ProblemDetailsExceptionHandler`
> and its `@ConditionalOnMissingBean` registration in `WebMvcAutoConfiguration`.
> The error format itself is
> [06 · ProblemDetail and RFC 9457](../../phase-9-spring-boot/09-error-handling/06-problemdetail-and-rfc-9457.md)
> and [10 · ResponseEntityExceptionHandler](../../phase-9-spring-boot/09-error-handling/10-responseentityexceptionhandler.md).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9 (sources read at 7.0.9 / 4.1.1), JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> **No sandbox** — this page carries Java source and library source, never a fabricated test run.

**A handler was selected ([07](07-exception-handlers.md) through
[07c](07c-which-method-matches.md)) and you know how to prove it
([07d](07d-tests-that-pin-the-handler.md)). What is left is the return
value, and it is where the slice bites hardest. Spring MVC gives you four ways to attach a status
to a failure; three of them are resolved by machinery that writes **no body at all** under
`MockMvc`, so three of them let a green `hasStatus(...)` coexist with a client contract nobody
tested. The fourth — extending `ResponseEntityExceptionHandler` — is
[07f](07f-responseentityexceptionhandler.md).**

## `@ResponseStatus` on the exception class: a different resolver, the same empty body

```java
@ResponseStatus(HttpStatus.NOT_FOUND)
class OrderNotFound extends RuntimeException { }
```

No advice matches, so `ExceptionHandlerExceptionResolver` returns `null` and
`ResponseStatusExceptionResolver` takes it. Its terminal method is:

```java
protected ModelAndView applyStatusAndReason(int statusCode, @Nullable String reason, HttpServletResponse response)
        throws IOException {

    if (!StringUtils.hasLength(reason)) {
        response.sendError(statusCode);
    }
    else {
        String resolvedReason = (this.messageSource != null ?
                this.messageSource.getMessage(reason, null, reason, LocaleContextHolder.getLocale()) :
                reason);
        response.sendError(statusCode, resolvedReason);
    }
    return new ModelAndView();
}
```

🔴 `response.sendError(...)` — the **same** call [06](06-validation-errors.md) traced through
`MockHttpServletResponse`: status set, message recorded, response committed, **nothing written**. So
`@ResponseStatus` on an exception class behaves in a slice exactly like an unhandled `@Valid`
failure: the right status and an empty body. A test asserting `hasStatus(404)` passes and tells you
nothing about what a client receives.

Two further details this resolver hands you for free:

- **Cause recursion.** `doResolveException` ends with
  `if (ex.getCause() instanceof Exception cause) { return doResolveException(request, response, handler, cause); }`
  — so `@ResponseStatus` on a *wrapped* exception is still honoured. A domain exception rethrown
  inside a `RuntimeException` keeps its status, which is occasionally why a 404 appears with no
  handler you can find.
- **`reason` is a message code.** It is passed to `MessageSource.getMessage(reason, null, reason,
  locale)`, so `@ResponseStatus(code = NOT_FOUND, reason = "order.not.found")` resolves through your
  `messages.properties` when one exists and falls back to the literal string when it does not.
  Asserting `getResponse().getErrorMessage()` on that is asserting a locale-dependent value
  ([06b](06b-asserting-the-error-contract.md)).

## `ResponseStatusException`, and the hierarchy that decides whether it has a body

The class hierarchy is the opposite of what most people assume:

```
NestedRuntimeException
  └─ ErrorResponseException   implements ErrorResponse   (since 6.0)
       └─ ResponseStatusException                        (accepts a "reason")
```

> *"Subclass of `ErrorResponseException` that accepts a 'reason', and by default maps that to the
> `detail` of the `ProblemDetail`."*

That inheritance is load-bearing, because `ResponseEntityExceptionHandler` declares
`ErrorResponseException.class` in its `@ExceptionHandler` list, and matching is
`mappedType.isAssignableFrom(thrownType)`. So:

| Your setup | What `throw new ResponseStatusException(CONFLICT, "already shipped")` produces in the slice |
|---|---|
| no advice, problem details off | `ResponseStatusExceptionResolver` → `sendError(409, "already shipped")` → 409, **empty body** |
| `spring.mvc.problemdetails.enabled=true` | Boot's advice matches it via `ErrorResponseException` → RFC 9457 body, `application/problem+json` |
| you extend `ResponseEntityExceptionHandler` | your advice matches it via `ErrorResponseException` → RFC 9457 body |
| your own advice maps `ResponseStatusException` | your advice, ahead of both other resolvers |

The same status, four different bodies, and only the first is what a bare `@WebMvcTest` gives you.
This is the single most common reason a controller test and production disagree while both return
the number the test asserted.

## `@ControllerAdvice` versus `@RestControllerAdvice`: the view-name trap

`@ExceptionHandler`'s javadoc lists the supported return types, and one of them is a landmine in a
JSON API:

> *"`String` value which is interpreted as view name."*

A handler on a plain `@ControllerAdvice` returning `String` returns a **view name**, not a body.
`@RestControllerAdvice` is `@ControllerAdvice` + `@ResponseBody`, which is why every JSON error
handler should use it. The other listed return types are worth knowing because each changes what
you can assert:

| Return type | What you assert in the test |
|---|---|
| `ResponseEntity<Object>` | status, headers **and** body — the only one that lets a handler set `Location`, `Retry-After`, `WWW-Authenticate` |
| `ProblemDetail` / `ErrorResponse` | *"render an RFC 9457 error response with details in the body"* — status comes from the object |
| a `@ResponseBody` object | body only; the status is 200 unless the method also carries `@ResponseStatus` |
| `void` | you wrote the response by hand; assert bytes, and expect nothing helpful from the framework |

🔴 The third row is the quiet one. A handler that returns a DTO without `@ResponseStatus` and
without `ResponseEntity` produces **200 with an error body** — a shape no client handles, and a test
asserting only the body passes.

## The four ways to attach a status, side by side

| Declaration | Resolver | Body under `MockMvc` |
|---|---|---|
| `@ResponseStatus` on the exception class | `ResponseStatusExceptionResolver` | **empty** — `sendError` |
| `throw new ResponseStatusException(...)` with nothing mapping `ErrorResponseException` | `ResponseStatusExceptionResolver` | **empty** — `sendError` |
| `@ResponseStatus` on an `@ExceptionHandler` method | `ExceptionHandlerExceptionResolver` | whatever the method returns — the status comes from the annotation, the body from the return value |
| `ResponseEntity` / `ProblemDetail` from an `@ExceptionHandler` | `ExceptionHandlerExceptionResolver` | the entity, converted |

Rows three and four are the only two that produce a testable body in a bare slice, and they are the
only two that are `@ControllerAdvice` code you own. Rows one and two are perfectly reasonable in
production *because* a real container performs an error dispatch to `/error` and Boot's
`BasicErrorController` fills in a body ([06](06-validation-errors.md)) — which is exactly the step
`MockMvc` skips. **If you use rows one or two, the slice cannot test your error body; you need a
`@SpringBootTest` with a real server, or you move to rows three and four.**

The base class that turns rows one and two into row four for twenty framework exceptions is
[07f · ResponseEntityExceptionHandler](07f-responseentityexceptionhandler.md).

## Gotchas

**★ Asserting `hasStatus(404)` on a `@ResponseStatus`-annotated exception and calling it done.**
`ResponseStatusExceptionResolver.applyStatusAndReason` calls `response.sendError(...)`, so under
`MockMvc` the body is empty exactly as it is for an unhandled `@Valid` failure
([06](06-validation-errors.md)). The status is right and the client contract is untested.

**★ Believing `ResponseStatusException` always yields a problem-details body.**
It does when something maps `ErrorResponseException` — Boot's advice with problem details enabled,
or your own `ResponseEntityExceptionHandler` subclass. With neither, it is resolved by
`ResponseStatusExceptionResolver` and `sendError`s, giving a status and no body.

**★ An `@ExceptionHandler` on a plain `@ControllerAdvice` returning `String`.**
That is a **view name**, per the javadoc, not a body. Use `@RestControllerAdvice`, or annotate the
method `@ResponseBody`, or return `ResponseEntity`.

**★ An error handler returning a DTO with no status.**
Without `ResponseEntity` and without `@ResponseStatus` on the method, the response is **200** with
an error body. A test that only asserts the body passes; every client breaks.

**★ Putting `@ResponseStatus` on the advice method *and* returning a `ResponseEntity`.**
The `ResponseEntity`'s status is what is written. Two declarations of the status, one of them dead,
and a reader cannot tell which. Pick one — `ResponseEntity` if you need headers, `@ResponseStatus`
if you do not.

**★ Putting `@ResponseStatus` on the exception class *and* mapping it in an advice.**
`ExceptionHandlerExceptionResolver` runs first, so the advice wins and the annotation is dead code
that still reads like a specification. Delete one. If you keep the annotation as documentation, at
least assert the advice's status so the contradiction cannot drift.

**★ Reaching for `@ResponseStatus` when the error needs a header.**
The annotation carries a code and a reason and nothing else, and `applyStatusAndReason` writes only
`sendError`. `ResponseStatusException` *does* carry headers — `resolveResponseStatusException`
applies `ex.getHeaders()` before the `sendError` — and an `@ExceptionHandler` returning
`ResponseEntity` carries anything. For a 429 with `Retry-After` or a 401 with `WWW-Authenticate`,
the annotation is the wrong tool and a slice test asserting the header is what proves it.

**★ Asserting `@ResponseStatus(reason = …)` text.**
`reason` is passed through `MessageSource.getMessage(reason, null, reason, locale)`. It is a message
code with a literal fallback, so what you assert depends on your `messages.properties` and the
request locale.

**★ Assuming `@ResponseStatus` on a wrapped exception is ignored.**
`ResponseStatusExceptionResolver` recurses into `getCause()`, so a domain exception rethrown inside
a `RuntimeException` still supplies the status. If a 404 appears with no handler you can find, this
is usually why.

## Interview questions

**★ Why does a `@ResponseStatus`-annotated exception produce an empty body in a `@WebMvcTest`?**
Because it is resolved by `ResponseStatusExceptionResolver`, whose `applyStatusAndReason` calls
`response.sendError(...)`. On `MockHttpServletResponse` that sets the status, records the message
and commits without writing anything, and `MockMvc` performs no error dispatch to `/error`. It is
the same mechanism that makes a bare `@Valid` failure return 400 with nothing in it.

**★ Does `throw new ResponseStatusException(CONFLICT, "…")` give the client a problem-details body?**
Only if something maps it. `ResponseStatusException` extends `ErrorResponseException`, which
`ResponseEntityExceptionHandler` declares — so Boot's `ProblemDetailsExceptionHandler` (when
`spring.mvc.problemdetails.enabled` is true) or your own subclass will render RFC 9457. With
neither present, `ResponseStatusExceptionResolver` handles it with `sendError` and the body is
empty. Four configurations, one status, four different responses.

**★ What is the difference between `@ControllerAdvice` and `@RestControllerAdvice` for an error
handler?**
`@RestControllerAdvice` is `@ControllerAdvice` meta-annotated with `@ResponseBody`. Without it, a
handler returning a `String` is returning a *view name* — the javadoc lists that explicitly — and a
handler returning a DTO goes through view resolution rather than a message converter. For a JSON
API the answer is always `@RestControllerAdvice` or an explicit `ResponseEntity`.

**★ You need a `Retry-After` header on a 429. Which of the four ways can give you one?**
Not `@ResponseStatus` — it declares a code and a reason and its resolver only calls `sendError`. A
`ResponseStatusException` can, because `resolveResponseStatusException` copies `ex.getHeaders()`
onto the response before sending the error, though the body is still empty under `MockMvc`. The
clean answer is an `@ExceptionHandler` returning `ResponseEntity`, which sets status, headers and
body together and is the only one of the four that a slice test can assert end to end —
`.hasStatus(429).hasHeader("Retry-After", "60")` plus the body.

**★ Your handler returns a `ProblemDetail`. What decides the response status?**
The `ProblemDetail` itself — the javadoc lists `ProblemDetail` and `ErrorResponse` as return types
that *"render an RFC 9457 error response with details in the body"*, and the status is taken from
the object rather than from the method. This is the case where adding `@ResponseStatus` to the
method as well is redundant at best and contradictory at worst.

{/* FOOTER */}
