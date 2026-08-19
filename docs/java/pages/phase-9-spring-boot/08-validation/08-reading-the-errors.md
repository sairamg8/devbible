---
title: "Reading the errors: BindingResult and ParameterValidationResult"
sidebar_label: "8 · Reading the errors"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Validation* for
> `@RequestMapping` methods
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-validation.html
> — `HandlerMethodValidationException` carrying *"a list of
> `ParameterValidationResult`s that group validation errors by method
> parameter"*, its `Visitor` contract, and the `Errors`/`BindingResult`
> positional rule), *Java Bean Validation*
> (docs.spring.io/spring-framework/reference/core/validation/beanvalidation.html
> — `ParameterErrors` implementing `org.springframework.validation.Errors`, and
> the `MessageSourceResolvable` error codes) and *Error Responses*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**The two validation exceptions are "designed to be very similar" and can be
"handled with almost identical code" — but the payloads are not the same shape,
because one describes a single object's fields and the other describes a list
of parameters. This chunk is what is actually inside each, and how to get a
stable field-by-field report out of them.**

## Two facts about the violation set

**All of them are collected.** The provider evaluates every constraint rather
than stopping at the first failure, which is what makes a complete
field-by-field rejection possible. Fail-fast exists as a provider option and is
the wrong trade for an HTTP API — see
[chunk 11](11-messages-and-interpolation.md).

**None of them are ordered.** The underlying `Set<ConstraintViolation<T>>` is a
set, so nothing promises that `@NotNull` is reported before `@Size` on the same
field, or that fields arrive in declaration order. **Sort when you build the
body**, by property path and then by message; assertions on "the first error"
are flaky by construction.

## Inside `MethodArgumentNotValidException`

It extends `BindException`, which implements `BindingResult`, which extends
`Errors`. So everything Spring's data-binding world knows how to do applies:

```java
@ExceptionHandler(MethodArgumentNotValidException.class)
ResponseEntity<ProblemDetail> onInvalidBody(MethodArgumentNotValidException ex) {

    List<Map<String, String>> fieldErrors = ex.getBindingResult()
            .getFieldErrors().stream()
            .sorted(Comparator.comparing(FieldError::getField))
            .map(fe -> Map.of(
                    "field",  fe.getField(),                 // "shippingAddress.street"
                    "detail", Objects.requireNonNullElse(fe.getDefaultMessage(), "invalid")))
            .toList();

    List<String> objectErrors = ex.getBindingResult()
            .getGlobalErrors().stream()
            .map(oe -> Objects.requireNonNullElse(oe.getDefaultMessage(), "invalid"))
            .toList();

    ProblemDetail body = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
    body.setTitle("Validation failed");
    body.setProperty("errors", fieldErrors);
    body.setProperty("objectErrors", objectErrors);
    return ResponseEntity.badRequest().body(body);
}
```

Four things in there are worth naming.

- **`getFieldErrors()` versus `getGlobalErrors()`.** A field constraint
  produces a `FieldError`; a **class-level** constraint
  ([chunk 9](09-custom-validators.md)) produces an `ObjectError` with no field
  attached, and a handler that only reads field errors reports an empty list
  for a request that genuinely failed. This is a very common half-written
  handler.
- **The property path is nested and indexed.** `shippingAddress.street`,
  `lines[3].quantity` — the path is a client's map back to its own payload, so
  do not flatten it to the leaf name.
- **`getDefaultMessage()` can be `null`.** It is nullable on `ObjectError`, so
  handle it rather than letting an NPE turn a 400 into a 500.
- **`fe.getRejectedValue()` exists and is a decision, not a freebie.** See the
  gotchas: echoing it back is convenient for debugging and leaks whatever the
  client sent, including a password or a token.

`FieldError` also carries `getCodes()` — the `MessageSourceResolvable` codes
such as `Size.createOrderRequest.customerName`, `Size.customerName`,
`Size.java.lang.String`, `Size` — which is the hook for message resolution via
`MessageSource` rather than the constraint's own `message` attribute.
[Chunk 11](11-messages-and-interpolation.md) is about which of those two
mechanisms you should be using.

## Inside `HandlerMethodValidationException`

This one groups errors **by method parameter**, because that is what the
failure actually is: several parameters, each with its own source. It carries a
list of `ParameterValidationResult`, each holding the `MethodParameter`, the
argument value, and the resolvable errors for it. Where the parameter was a
cascaded `@Valid` object, the result is a `ParameterErrors`, which itself
implements `org.springframework.validation.Errors` — so nested field errors are
reachable in the same shape as above.

The reference's own extraction mechanism is a **visitor**, and it exists
because the useful question is usually *which kind of input was wrong*:

```java
ex.visitResults(new HandlerMethodValidationException.Visitor() {
    @Override
    public void requestParam(@Nullable RequestParam requestParam, ParameterValidationResult result) {
        // a query parameter: name it from requestParam.name() or the parameter name
    }
    @Override
    public void requestHeader(RequestHeader requestHeader, ParameterValidationResult result) {
        // a header
    }
    @Override
    public void modelAttribute(@Nullable ModelAttribute modelAttribute, ParameterErrors errors) {
        // a cascaded object — errors is a full Errors, with field paths
    }
    @Override
    public void other(ParameterValidationResult result) {
        // everything else
    }
});
```

**Why bother distinguishing them?** Because the client-facing name differs by
source. A violated query parameter should be reported as `?page`, a violated
header as `X-Tenant-Id`, and a violated body field as `lines[0].quantity`.
Flattening all three into a single "field" key produces a report where the
client cannot tell which part of the request to fix.

## Where this hands off

Turning any of this into the actual response — a `ProblemDetail` per RFC 9457,
a stable machine-readable error code per violation, content negotiation,
i18n — is **Topic 09 — Error handling** *(not written yet)*, which covers
`@ControllerAdvice`, `ResponseEntityExceptionHandler` and Boot's
`spring.mvc.problemdetails.enabled`. The handler above is deliberately a
sketch of *extraction*, not a recommended final shape.

The general principle — translate an exception at the boundary that
understands it — is
[custom exceptions and translation](../../phase-5-exceptions/04-custom-exceptions-translation.md),
and the anatomy of a global handler is
[the global handler](../../phase-5-exceptions/08-global-handler.md).

## The trade-off

Extracting errors by hand gives you an error contract you control, and costs
you a piece of framework-shaped code that has to be maintained against two
exception types and updated when either grows a field. Boot's built-in problem
details cost nothing and give you a body whose `detail` string is a rendered
sentence rather than a structured list — fine for a browser, poor for a client
that wants to highlight the offending inputs.

There is also a real tension in **how much to say**. A precise report — field
path, rejected value, the exact bound — is excellent for a first-party
front-end and is a reconnaissance aid for anyone probing your API: it discloses
your internal field names, your limits and your rules. The usual resolution is
to report the path and a message but never the rejected value, and to keep
messages generic on endpoints that handle credentials.
[Chunk 11](11-messages-and-interpolation.md) takes that further.

## Gotchas

**Symptom** · A class-level constraint fails and the error response lists no
errors.
**Cause** · The handler reads `getFieldErrors()` only; a class-level constraint
produces an `ObjectError` with no field.
**Fix** · Read `getGlobalErrors()` as well and give them a place in the body,
as in the handler above.

**Symptom** · The handler throws an NPE and the client gets a 500 instead of a
400.
**Cause** · `getDefaultMessage()` is nullable and was passed straight into a
`Map.of(...)`, which rejects `null`.
**Fix** · `Objects.requireNonNullElse(...)`, or a filter — the error handler
is the one place that must never fail.

**Symptom** · Test assertions on "the first validation error" break on an
unrelated change.
**Cause** · Violations are an unordered set.
**Fix** · Sort by property path when building the body and assert on the whole
collection.

**Symptom** · A password or API key appears in an error response.
**Cause** · The handler echoes `getRejectedValue()`.
**Fix** · Do not include rejected values by default. If you want them for
debugging, log them at a level that does not reach clients and redact known
sensitive paths.

**Symptom** · Query-parameter violations are reported with a field name that
does not exist in the request.
**Cause** · A `HandlerMethodValidationException` flattened through
`MethodArgumentNotValidException`-shaped code, so the parameter's *Java* name
is used rather than its request name.
**Fix** · Use the visitor and take the name from the `@RequestParam`
annotation, falling back to the parameter name.

**Symptom** · Nested paths arrive at the client as `street` rather than
`shippingAddress.street`.
**Cause** · Something took the leaf of the path.
**Fix** · Keep the full path. It is the only thing that lets a client map the
error onto its own form state.

## Interview questions

**★ What is inside `MethodArgumentNotValidException`?**
A `BindingResult` — the exception extends `BindException` — so you get
`getFieldErrors()` returning `FieldError`s with a property path, a rejected
value, a default message and a list of `MessageSourceResolvable` codes, and
`getGlobalErrors()` returning `ObjectError`s for class-level constraints. A
handler that reads only the field errors silently drops every cross-field
violation.

**★ How is `HandlerMethodValidationException` shaped differently, and why?**
It carries a list of `ParameterValidationResult`s that group errors **by method
parameter**, because a method-validation failure is about several parameters
rather than one object graph. Each result exposes the `MethodParameter`, the
argument and the resolvable errors; for a cascaded `@Valid` object the result is
a `ParameterErrors`, which implements `Errors` so nested field paths are
reachable. It also supports a `Visitor` whose callbacks tell you whether the
bad input was a request parameter, a header, a model attribute or something
else.

**★ Why does the visitor matter for a good error response?**
Because the client-facing name of a bad input depends on where it came from: a
query parameter is `?page`, a header is `X-Tenant-Id`, a body field is
`lines[0].quantity`. Without the visitor you fall back to the Java parameter
name, which the client has never seen and cannot act on.

**★ Are validation errors ordered?**
No. Violations come back as a set with no specified iteration order, so the
sequence of errors in a response is not stable across runs or library upgrades.
Sort by property path when building the body — it makes the response readable
and the tests deterministic.

**★ Should the error response echo the rejected value?**
Rarely. It is genuinely useful for a first-party front-end and it is a
disclosure: the field may be a password, a token or personal data, and echoing
it can also place attacker-controlled content into whatever renders your
errors. Report the path and a message; keep the value in logs, redacted where
the path is sensitive.

**★ What are `FieldError.getCodes()` for?**
They are `MessageSourceResolvable` codes — most specific first, such as
`Size.createOrderRequest.customerName`, then `Size.customerName`, then
`Size.java.lang.String`, then `Size`. They let a `MessageSource` resolve a
message by constraint, by field, or by both, which is how you get localised and
context-specific text without putting it in the annotation.

**★ How would you keep the error contract identical across both exception
types?**
Write one internal representation — a sorted list of `{path, code, message}` —
and two small extractors that populate it, one from the `BindingResult` and one
from the parameter results via the visitor. Both `@ExceptionHandler`s then feed
the same builder, so an endpoint changing shape cannot change the response
format. Handling only one of the two is the usual cause of inconsistent
validation errors within a single API.

---

← Prev: [What the failure is](07-the-failure.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Custom validators and groups](09-custom-validators.md)
