---
title: "ErrorResponse: exceptions that carry their own mapping"
sidebar_label: "8 · ErrorResponse"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Error
> Responses*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html
> — `ErrorResponse` as *"a contract to expose HTTP error response details
> including HTTP status, response headers, and a body in the format of RFC 9457;
> this allows exceptions to encapsulate and expose the details of how they map
> to an HTTP response"*, *"All Spring MVC exceptions implement this"*, and
> `ErrorResponseException` as *"a basic `ErrorResponse` implementation that
> others can use as a convenient base class"*) and the `ResponseStatusException`
> javadoc (subclass of `ErrorResponseException`, implements `ErrorResponse`).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**`ErrorResponse` is the interface that lets an *exception* carry its own HTTP
mapping — status, required headers and a `ProblemDetail` body — instead of
depending on a handler to know about it. Every Spring MVC exception implements
it, and that single fact is why turning on RFC 9457 for Spring's own errors is a
switch rather than a project.**

## The contract

| Method | What it gives you |
|---|---|
| `getStatusCode()` | The HTTP status this error means |
| `getHeaders()` | Headers the error *requires* — `Allow` on a 405, `Accept` on a 415, `Retry-After` on a 429, `WWW-Authenticate` on a 401 |
| `getBody()` | The `ProblemDetail` |
| `updateAndGetBody(MessageSource, Locale)` | Resolves the type/title/detail message codes and returns the updated body — see [chunk 9](09-message-codes-and-i18n.md) |

`getHeaders()` is the underrated member. A 405 without an `Allow` header is
non-conformant HTTP, and a 429 without `Retry-After` is a 429 the client cannot
act on. Because the *exception* carries them, a completely generic handler emits
the right headers without knowing which error it is rendering.

`ErrorResponseException` is the ready-made implementation, and
`ResponseStatusException` extends it — which is precisely why
[a bare `ResponseStatusException` already produces a problem body](02-the-resolver-chain.md)
with no handler at all.

## Why "all Spring MVC exceptions implement this" is load-bearing

It means `HttpRequestMethodNotSupportedException`,
`HttpMediaTypeNotSupportedException`, `MethodArgumentNotValidException`,
`NoResourceFoundException`, `MissingServletRequestParameterException` and the
rest **already carry a fully-formed `ProblemDetail`**. Nothing needs to map
them; something needs to *render* them.

Which is why there are exactly two switches, and why both are small:

- **`spring.mvc.problemdetails.enabled=true`** — a Boot property;
- **extending `ResponseEntityExceptionHandler`**, which has *"an
  `@ExceptionHandler` method that handles any `ErrorResponse` exception, which
  includes all built-in web exceptions"* — one method, the whole family.

Both are compared properly in [chunk 10](10-responseentityexceptionhandler.md).

## Should your own exceptions implement it?

This is the sharpest design fork in the topic, so both sides get stated plainly.

```java
// Option A: the exception carries its own HTTP mapping.
public class InsufficientStockException extends RuntimeException implements ErrorResponse {

    private final String sku;
    private final int available, requested;

    public InsufficientStockException(String sku, int available, int requested) {
        super("Only %d units of %s remain; %d requested".formatted(available, sku, requested));
        this.sku = sku; this.available = available; this.requested = requested;
    }

    @Override public HttpStatusCode getStatusCode() { return HttpStatus.CONFLICT; }

    @Override public ProblemDetail getBody() {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(getStatusCode(), getMessage());
        pd.setType(URI.create("https://api.example.com/problems/insufficient-stock"));
        pd.setTitle("Insufficient stock");
        pd.setProperty("sku", sku);
        pd.setProperty("available", available);
        pd.setProperty("requested", requested);
        return pd;
    }
}
```

```java
// Option B: the exception stays plain; the advice owns the mapping.
public class InsufficientStockException extends RuntimeException {
    private final String sku;
    private final int available, requested;
    // constructor and getters — no Spring types anywhere
}
```

**What Option A buys.** The entire advice collapses to:

```java
@RestControllerAdvice
class ApiErrorHandler extends ResponseEntityExceptionHandler { }
```

Every exception in the family is handled by the inherited `ErrorResponse`
handler, and adding a new exception type requires no change to the advice at
all. In a large domain with dozens of error kinds and several teams touching
one advice file, removing that coordination point is worth real money.

**What Option A costs.** The exception now imports
`org.springframework.http.HttpStatusCode` and `ProblemDetail`. It is no longer a
plain Java exception. Throw it from a Kafka consumer, a batch job or a CLI in a
module without `spring-web` on the classpath and the class will not even load.
This is the same coupling [chunk 2](02-the-resolver-chain.md) argued against for
`@ResponseStatus`, in a larger dose — `@ResponseStatus` costs you one
annotation; `ErrorResponse` costs you an interface, a return type and a method
body.

**The resolution.** Keep *domain rule violations* plain (Option B) and map them
in the advice. Reserve `ErrorResponse` for exception types that are **already**
an HTTP concern and live in the web module — an `ApiException` family declared
next to the controllers, not a business rule declared next to the aggregate. If
you want both properties, the honest shape is a plain domain exception plus a
thin web-module translation, not one class trying to be both.

## The trade-off

Option A moves the mapping to where the data is, which is genuinely the more
cohesive design if you accept that your exceptions are HTTP objects. Option B
keeps the domain portable and pays for it with an advice file that must be
edited every time an exception type is added — a file every team touches, and
therefore a merge point and a place to forget. Neither is free; the deciding
question is whether anything other than the web layer will ever throw these.

## Gotchas

**Symptom** — a 405 response loses its `Allow` header once you add a custom
handler for `HttpRequestMethodNotSupportedException`.
**Cause** — the handler built a fresh `ResponseEntity` and dropped the headers
the `ErrorResponse` was carrying.
**Fix** — take them from the exception:
```java
@ExceptionHandler
ResponseEntity<ProblemDetail> handle(ErrorResponse ex) {
    return ResponseEntity.status(ex.getStatusCode())
            .headers(ex.getHeaders())          // do not drop these
            .body(ex.getBody());
}
```

**Symptom** — a domain exception implementing `ErrorResponse` fails to load in
a batch or messaging module.
**Cause** — that module has no `spring-web` on the classpath and the class
references `HttpStatusCode`.
**Fix** — the coupling cost made concrete. Make the domain exception plain and
translate it in the web module.

**Symptom** — `getBody()` builds a new `ProblemDetail` on every call and a
handler that mutates the returned object sees its change vanish.
**Cause** — the implementation above constructs a fresh detail per invocation,
so `ex.getBody().setProperty(...)` mutates a throwaway.
**Fix** — build it once in the constructor and return the same instance, or do
all enrichment inside `getBody()`. Either is fine; mixing them is what breaks.

**Symptom** — an `ErrorResponse` exception is handled, but the `type` and
`title` are the defaults rather than the ones you set.
**Cause** — something rebuilt the body from the status instead of calling
`getBody()`, typically a catch-all handler declared for `Exception` that ran
first.
**Fix** — order advices so the `ErrorResponse` handler is consulted before the
catch-all ([chunk 5](05-controlleradvice.md)).

## Interview questions

**★ What is `ErrorResponse`?**
A contract by which an exception exposes its own HTTP status code, required
response headers and RFC 9457 body. It lets exceptions encapsulate how they map
to an HTTP response, so a single generic handler can render any of them
correctly.

**★ Why does it matter that every Spring MVC exception implements it?**
Because Spring's own errors then need no mapping table — only rendering. That is
what makes `spring.mvc.problemdetails.enabled` a one-line change and what lets
`ResponseEntityExceptionHandler` cover every built-in exception with a single
inherited handler.

**★ Why does the interface expose headers at all?**
Because some statuses are not conformant without them: 405 requires `Allow`, 415
should carry `Accept`, 429 needs `Retry-After`, 401 needs `WWW-Authenticate`.
Carrying them on the exception means a generic handler emits them without
special-casing, and it is exactly what hand-written handlers tend to drop.

**★ Should a domain exception implement `ErrorResponse`?**
Usually not. It gives real cohesion — status, headers and body next to the data —
and removes the advice as a coordination point, but it puts Spring HTTP types
into the domain and breaks the moment that exception is thrown from a
non-web context. Reserve it for an API-layer exception family in the web module.

**★ `ResponseStatusException` seems to do all of this already. When would I
implement `ErrorResponse` myself?**
`ResponseStatusException` gives you a status and a `detail` from the reason
string, which is genuinely enough for one-off cases in a controller.
Implementing `ErrorResponse` is what you do when the error needs a stable
`type`, a fixed `title`, structured extension members and required headers —
that is, when it is a documented problem kind in your API rather than an ad-hoc
failure.

---

← Prev: [Extension members](07-extension-members.md) · Index: [Error handling](README.md) · Next → [Message codes and i18n](09-message-codes-and-i18n.md)
