---
title: "Handler signatures: what you may take and return"
sidebar_label: "4 · Handler signatures"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Exceptions
> (`@ExceptionHandler`)*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-exceptionhandler.html
> — the supported method-argument table, the supported return-value table
> including `ErrorResponse`/`ProblemDetail`, and the `produces` attribute with
> media-type mapping) and *Controller Advice*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-advice.html
> — global handlers applied after local ones). Spring Boot 4.1.0, Spring
> Framework 7.0.x, JDK 25.

**An `@ExceptionHandler` method is an ordinary handler method whose "request" is
an exception: it gets argument resolution, return-value handling, content
negotiation and message conversion exactly as a `@GetMapping` does. The two
things worth memorising are what is *missing* from the argument list, and how
much the return type changes the outcome.**

## What you may accept

| Argument | Why you would want it |
|---|---|
| The exception type | The whole point |
| `HandlerMethod` | *"For access to the controller method that raised the exception"* — the most useful one for logging: controller class and method name without parsing a stack trace |
| `WebRequest`, `NativeWebRequest` | Request parameters and attributes without importing the Servlet API |
| `HttpServletRequest`, `HttpServletResponse` | The raw objects — needed to read a request attribute a filter set, e.g. a correlation id |
| `HttpSession` | *"Enforces presence of session (never `null`)"*, and not thread-safe |
| `java.security.Principal` | Who was authenticated when it failed |
| `HttpMethod` | Branching a message on the verb |
| `Locale`, `TimeZone`, `ZoneId` | Localising the `detail` text |
| `OutputStream`, `Writer` | Writing the body by hand |
| `Map`, `Model`, `ModelMap` | View rendering. The reference notes it is *"always empty"* here |
| `RedirectAttributes` | Redirect and flash attributes, for server-rendered flows |
| `@SessionAttribute`, `@RequestAttribute` | Pulling one named thing out without the whole request |

⚠️ **What is conspicuously absent: `@PathVariable`, `@RequestParam` and
`@RequestBody`.** They are not on the list, and that is coherent — by the time
the handler runs, the binding that would have produced them is frequently what
failed. If the error body needs the id that was not found, put it on the
exception at the throw site:

```java
public class OrderNotFoundException extends RuntimeException {
    private final String orderId;
    public OrderNotFoundException(String orderId) {
        super("No order with id " + orderId);
        this.orderId = orderId;
    }
    public String getOrderId() { return orderId; }
}
```

```java
@ExceptionHandler
ResponseEntity<ProblemDetail> handle(OrderNotFoundException ex) {
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    pd.setProperty("orderId", ex.getOrderId());
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(pd);
}
```

`HandlerMethod` deserves a second mention, because it turns a log line from
guesswork into something useful:

```java
@ExceptionHandler
ResponseEntity<ProblemDetail> handle(Exception ex, HandlerMethod handlerMethod) {
    log.error("Unhandled exception in {}#{}",
              handlerMethod.getBeanType().getSimpleName(),
              handlerMethod.getMethod().getName(), ex);
    ...
}
```

## What you may return

| Return value | Effect |
|---|---|
| `ProblemDetail` | *"Render RFC 9457 error response with details in the body"* — the shortest correct answer |
| `ErrorResponse` | Same, but the object also carries the status and headers |
| `ResponseEntity<B>`, `HttpEntity<B>` | Full control of status, headers and body |
| `@ResponseBody` value | Converted through the `HttpMessageConverter`s |
| `String` | A **view name**, resolved by a `ViewResolver` |
| `View` | A view instance |
| `ModelAndView` | View and model, optionally with a status |
| `void` | Fully handled — but only if the method also took `ServletResponse`/`OutputStream`, or carries `@ResponseStatus` |
| anything else | Treated as a model attribute if not a simple type |

Two rows do real damage in practice.

**The `String` row.** In a `@RestControllerAdvice` the class-level
`@ResponseBody` makes a returned `String` the response body. In a plain
`@ControllerAdvice` the *same method* returns a **view name**, and you get a
view-resolution failure instead of the message you meant to send. Identical
code, opposite behaviour. That one difference is reason enough to use
`@RestControllerAdvice` for anything that is an API.

**The `void` row.** A handler returning `void` with no response argument and no
`@ResponseStatus` has declared the exception handled and written nothing — the
client gets an empty `200 OK` for a failure. `void` is for the case where you
wrote to the `OutputStream` yourself, and nothing else.

## Returning the status, three ways

```java
// 1. ResponseEntity — status, headers and body all explicit. Most control.
@ExceptionHandler
ResponseEntity<ProblemDetail> handle(StockException ex) {
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
    return ResponseEntity.status(HttpStatus.CONFLICT)
            .header("Retry-After", "30")
            .body(pd);
}

// 2. ProblemDetail alone — the status comes from the ProblemDetail's own status field.
@ExceptionHandler
ProblemDetail handle(OrderNotFoundException ex) {
    return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
}

// 3. @ResponseStatus on the handler method — status fixed, body from the return value.
@ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
@ExceptionHandler
ProblemDetail handle(BusinessRuleException ex) {
    return ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage());
}
```

Form 2 is the one to reach for by default: one object, one line, status and body
in the same place, and no chance of the annotation and the body disagreeing.
Form 3 can disagree with itself — the annotation and the `ProblemDetail`'s
`status` field are set independently, and nothing checks that they match. Use
form 1 whenever you need a header (`Retry-After`, `Location`, `WWW-Authenticate`
are the common ones).

## Content negotiation on the handler: `produces`

Producible media types can be declared on the annotation, and negotiation during
error handling picks between them:

```java
@ExceptionHandler(produces = "application/problem+json")
ResponseEntity<ProblemDetail> handleJson(IllegalArgumentException ex) {
    return ResponseEntity.badRequest()
            .body(ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage()));
}

@ExceptionHandler(produces = "text/html")
String handleHtml(IllegalArgumentException ex, Model model) {
    model.addAttribute("error", ex.getMessage());
    return "errorView";
}
```

Two handlers, one exception, chosen by the client's `Accept` header. For a pure
API you will rarely need this — but it is the right answer to "our API is also
hit by a form post from a legacy page", and it is far better than sniffing
`Accept` inside a single handler and branching.

## Local handlers: `@ExceptionHandler` inside a controller

A handler declared in the controller applies only to that controller — and
because *"global `@ExceptionHandler` methods are applied after local ones"*, it
wins over the advice for the same exception.

```java
@RestController
class ReportController {

    @GetMapping("/reports/{id}")
    Report get(@PathVariable String id) { ... }

    // Only this controller treats "still building" as 202 rather than a 5xx.
    @ExceptionHandler
    ResponseEntity<ProblemDetail> stillBuilding(ReportStillBuildingException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.ACCEPTED, ex.getMessage());
        pd.setProperty("retryAfterSeconds", ex.getEstimatedSeconds());
        return ResponseEntity.accepted().body(pd);
    }
}
```

That is the legitimate use: **a deliberate local override of a global rule**,
where this one resource genuinely means something different by the same
exception. The illegitimate use is putting handlers in controllers because it
seemed easier than creating an advice class, which reintroduces every drift
problem from [chunk 1](01-the-error-shape-is-a-contract.md) one method lower
down.

## The trade-off

The flexibility of the signature is what makes `@ExceptionHandler` pleasant to
write and what makes it possible to write a handler nobody can predict from
reading. A method taking `Object`, annotated with four types, returning
`Object`, compiles perfectly and behaves differently depending on how it
matched. Narrow signatures cost extra methods and buy handlers that do what
they look like they do.

## Gotchas

**Symptom** — a handler returning `String` produces a view-resolution error
instead of a plain-text body.
**Cause** — the class is `@ControllerAdvice`, so `String` means view name.
**Fix** — use `@RestControllerAdvice`, annotate the method `@ResponseBody`, or
return `ResponseEntity<String>`, which is unambiguous in both.

**Symptom** — `200 OK` with an empty body when an exception was thrown.
**Cause** — the handler returns `void` with no response argument and no
`@ResponseStatus`, so the exception is marked handled and nothing is written.
**Fix** — return a `ProblemDetail` or `ResponseEntity`.

**Symptom** — the `@ResponseStatus` on a handler says 422 and the JSON body's
`status` field says 400.
**Cause** — form 3 above: the annotation sets the HTTP status, the
`ProblemDetail` carries its own `status` field, and the two were set
independently.
**Fix** — return the `ProblemDetail` alone (form 2) and let it be the single
source of the status, or use `ResponseEntity.status(...)` with the same value
you built the detail with.

**Symptom** — a handler wants the correlation id a filter generated and cannot
reach it.
**Cause** — the filter put it in a `ThreadLocal`/MDC, and the handler is trying
to read the request instead.
**Fix** — have the filter also store it as a request attribute, then take
`HttpServletRequest` in the handler and read it:
`String cid = (String) request.getAttribute("correlationId");` Covered fully in
[chunk 9](09-never-reaches-the-client.md).

**Symptom** — taking `HttpSession` as a handler argument creates sessions for
API clients that never had one.
**Cause** — the argument *"enforces presence of session (never `null`)"*, so
resolving it creates one.
**Fix** — take `WebRequest` and call `getSessionId()`/attribute access, or take
`HttpServletRequest` and call `getSession(false)`. For a stateless API, do not
touch the session at all.

## Interview questions

**★ What can an `@ExceptionHandler` method not accept, and how do you work
around it?**
The request-binding annotations — `@PathVariable`, `@RequestParam`,
`@RequestBody`. That is coherent: binding is often what failed. You attach the
data to the exception at the throw site and read it off the exception in the
handler, which also makes the exception self-describing for non-HTTP callers.

**★ Why does returning `String` behave differently in `@ControllerAdvice` and
`@RestControllerAdvice`?**
`@RestControllerAdvice` is `@ControllerAdvice` plus `@ResponseBody`. With
`@ResponseBody` a returned `String` goes through the message converters as the
body; without it, `String` is a view name handed to the `ViewResolver`s. Same
method, entirely different outcome.

**★ You need to add a `Retry-After` header to a 429 error response. Which
return type?**
`ResponseEntity`, because it is the only one of the three that carries headers.
`ProblemDetail` alone gives you status and body; `@ResponseStatus` gives you
status only. Build the `ProblemDetail` as the body and wrap it.

**★ When is a controller-local `@ExceptionHandler` the right choice rather than
a global one?**
When one resource genuinely assigns a different HTTP meaning to the same
exception — a report endpoint answering 202 "still building" for a timeout that
every other endpoint reports as a 504. Global handlers are applied after local
ones, so the local one wins for that controller only, and the global default
survives everywhere else. It is not the right choice merely because creating an
advice class felt like extra work.

**★ How would you log which controller method blew up, without parsing the
stack trace?**
Take `HandlerMethod` as a parameter. It is a documented argument and gives you
the bean type and the `Method`, so a single log statement can name the
controller and method precisely — useful when the same exception can come from
a dozen endpoints.

---

← Prev: [Which handler wins](03-matching-which-handler-wins.md) · Index: [Error handling](README.md) · Next → [@ControllerAdvice: scope and order](05-controlleradvice.md)
