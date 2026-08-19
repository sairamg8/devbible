---
title: "Which exception you get, and why it depends on the signature"
sidebar_label: "7 · What the failure is"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Validation* for
> `@RequestMapping` methods
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-validation.html
> — the two validation levels, `MethodArgumentNotValidException` vs
> `HandlerMethodValidationException`, the statement that method validation
> *"supersedes any validation that would be applied otherwise to a method
> parameter individually"*, and the instruction to remove class-level
> `@Validated` to use the support added in Framework 6.1), *Error Responses*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html
> — the exception-to-status table, both validation exceptions mapping to 400)
> and *Java Bean Validation*
> (docs.spring.io/spring-framework/reference/core/validation/beanvalidation.html
> — `MethodValidationPostProcessor` and `ConstraintViolationException`). Spring
> Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**Three different exceptions can come out of a failed validation in Spring MVC,
and which one you get is decided by the *shape of the controller method
signature*, not by anything you annotated on the DTO. Handling only the one you
happen to have seen is why validation error responses are inconsistent in so
many codebases.**

## The two levels, restated precisely

**Level 1 — individual parameter validation.** An `@ModelAttribute`,
`@RequestBody` or `@RequestPart` parameter annotated `@Valid` or `@Validated`
is validated on its own, provided it is a command object rather than a
container, has no `Errors`/`BindingResult` immediately after it, and the method
does not otherwise require method validation.
→ **`MethodArgumentNotValidException`**

**Level 2 — method validation.** Constraint annotations declared **directly on
method parameters** (or on the method, for the return value) trigger validation
of the whole invocation. The reference is explicit that this *"supersedes any
validation that would be applied otherwise to a method parameter individually"*
and that it *"covers both method parameter constraints and nested constraints
via `@Valid`"*.
→ **`HandlerMethodValidationException`**

The word *supersedes* is the one to hold on to. Adding a single
`@Min(1) @RequestParam int page` to a method that already had
`@Valid @RequestBody CreateOrderRequest` **changes which exception the body
failure throws**, because the method has moved from level 1 to level 2. Nothing
about the DTO changed.

⚠️ `@Valid` on its own does **not** trigger method validation — it is a cascade
marker, not a constraint. But putting a real constraint *next to* it on the
same parameter does: `@NotNull @Valid @RequestBody Order` is a constrained
parameter and therefore level 2.

## The third exception: `ConstraintViolationException`

This one does not come from Spring MVC at all. It comes from **AOP-based method
validation**, the older mechanism: `MethodValidationPostProcessor` proxies any
bean whose class is annotated `@Validated` and validates constrained method
arguments on the way through.

That mechanism is the right tool on a **service** bean
([chunk 10](10-beyond-the-controller.md)). On a **controller** it is now a
trap, because the reference says plainly: *"In order to take advantage of the
Spring MVC built-in support for method validation added in Spring Framework
6.1, you need to remove the class level `@Validated` annotation from the
controller."*

Leave it on and three things happen at once, none of them announced:

1. the controller is wrapped in an AOP proxy;
2. Spring MVC's built-in method validation stands down;
3. failures arrive as `ConstraintViolationException` — **which is not a Spring
   MVC exception**, does not appear in the framework's exception-to-status
   table, and therefore surfaces as **500 Internal Server Error** unless you
   wrote a handler for it.

A bad query parameter reported as a server error is the single most misleading
outcome in this topic: the client is told the server broke when the client sent
the wrong thing.

## The decision table

| Situation | Exception | Default status |
|---|---|---|
| `@Valid @RequestBody Dto` — no other constrained parameters | `MethodArgumentNotValidException` | **400** |
| `@Valid @RequestPart` / `@Valid @ModelAttribute`, same conditions | `MethodArgumentNotValidException` | **400** |
| Any constraint directly on a parameter (`@Positive @PathVariable`, `@Min @RequestParam`, `List<@Valid T>`) | `HandlerMethodValidationException` | **400** |
| The same method having both — level 2 supersedes | `HandlerMethodValidationException` | **400** |
| Controller class annotated `@Validated` | `ConstraintViolationException` | **500** ⚠️ unless handled |
| `@Validated` service bean, invalid argument | `ConstraintViolationException` | **500** ⚠️ unless handled |
| `Errors`/`BindingResult` immediately after the validated parameter | *none thrown* | **200** — the handler runs |
| Body cannot be parsed at all | `HttpMessageNotReadableException` | **400** — never reaches validation |

Both validation exceptions map to **400** and both are `ErrorResponse`
implementations, so Boot's problem-detail support renders them as RFC 9457
bodies with message codes of the form
`problemDetail.<fully-qualified-exception-class-name>`. The last row is worth
keeping in mind when debugging: a malformed body fails in the message converter
and validation never runs, so a missing violation report is sometimes a
*parsing* failure wearing a 400.

## The rule that returns 200 with bad data

```java
// ⚠️ no exception is thrown — the handler is invoked with the errors in hand
@PostMapping
ResponseEntity<?> create(@Valid @RequestBody CreateOrderRequest req,
                         BindingResult binding) {
    if (binding.hasErrors()) { /* you MUST check */ }
    ...
}
```

An `Errors` or `BindingResult` parameter **immediately after** the validated
one suppresses the exception and hands you the failures instead. It is
deliberate, it is positional, and it is a loaded gun: forget the `hasErrors()`
check and the endpoint accepts invalid data and returns 200.

The rule for method validation is a shade subtler. The controller method is
called only if **all** validation errors are on parameters that have an
`Errors` immediately after them; if there are errors on any other parameter,
`HandlerMethodValidationException` is raised anyway and the method is not
invoked at all.

**Prefer no `BindingResult` parameter.** Let the exception be thrown and
translate it in one place. The in-method style earns its keep only where a
single endpoint genuinely re-renders a form with errors attached — a
server-rendered-HTML concern rather than an API one.

## Why this design, and what it costs

The two-level split exists because the two situations are genuinely different:
one object with a graph of fields, versus a list of heterogeneous parameters
each with its own kind of source. `HandlerMethodValidationException` therefore
groups errors **by parameter** and knows whether each came from a
`@RequestParam`, a `@RequestHeader` or a `@ModelAttribute` — information
`MethodArgumentNotValidException` has no place to put.

The cost is the one this chunk opened with: **the error contract of an endpoint
depends on its signature.** A refactor that adds a constrained query parameter,
or wraps a list in a record, silently moves an endpoint between exception types
and can change the JSON your clients receive. The reference's own advice is the
only safe posture — *"Applications should handle both
`MethodArgumentNotValidException` and `HandlerMethodValidationException` since
either may be raised depending on the controller method signature."* The two
are deliberately similar and *"can be handled with almost identical code"*, but
"almost" is doing work: the payload structures differ, which is
[chunk 8](08-reading-the-errors.md).

**Where this hands off.** Turning any of these into a client-facing body — a
`ProblemDetail` with a field-by-field breakdown, a stable error code, i18n — is
**Topic 09 — Error handling** *(not written yet)*, which covers
`@ControllerAdvice`, `ResponseEntityExceptionHandler` and RFC 9457. This topic
stops at *what the exception is and what it contains*. The general principle of
translating an exception at a boundary is
[custom exceptions and translation](../../phase-5-exceptions/04-custom-exceptions-translation.md),
and the shape of a global handler is
[the global handler](../../phase-5-exceptions/08-global-handler.md).

## Gotchas

**Symptom** · A bad query parameter returns 500.
**Cause** · `@Validated` on the controller class routes validation through AOP,
producing `ConstraintViolationException`, which is not in Spring MVC's
exception-to-status table.
**Fix** · Remove `@Validated` from the controller and let Framework 6.1's
built-in method validation produce `HandlerMethodValidationException` (400). If
you cannot remove it, you must write an `@ExceptionHandler` for
`ConstraintViolationException` that sets 400 explicitly.

**Symptom** · An `@ExceptionHandler(MethodArgumentNotValidException.class)`
that used to catch everything now misses some endpoints.
**Cause** · Somebody added a constrained parameter to those methods, moving
them to level 2 and `HandlerMethodValidationException`.
**Fix** · Handle both. They are designed to be handled with nearly identical
code, and omitting one produces an inconsistent API rather than a crash.

**Symptom** · An endpoint accepts invalid data and returns 200.
**Cause** · A `BindingResult` parameter with no `hasErrors()` check.
**Fix** · Remove the parameter; let the exception be thrown and handled
centrally.

**Symptom** · Adding a `@Min` to a page parameter changed the JSON error body
of an unrelated field in the same endpoint.
**Cause** · The method moved from level 1 to level 2; the body failure is now
reported by the other exception.
**Fix** · Nothing to fix in the method — this is the design. It is an argument
for having both handlers in place before it happens.

**Symptom** · A validation error response has no field information at all.
**Cause** · The request never got as far as validation — the body failed to
parse (`HttpMessageNotReadableException`), which is also a 400.
**Fix** · Handle that exception separately and give it a distinguishable
problem type; conflating the two makes malformed JSON look like a business
rejection.

**Symptom** · A service method annotated with constraints throws
`ConstraintViolationException` and the API returns 500.
**Cause** · That is correct behaviour, and it is a signal: a service-layer
constraint failure means the *controller* let bad data through.
**Fix** · Fix the edge. A 500 here is the right answer — it is a programming
error, not a client error, and dressing it up as a 400 hides the bug.

**Symptom** · `@Validated(OnCreate.class)` on a controller parameter works, but
moving the same annotation to the class breaks the query-parameter checks.
**Cause** · At parameter level `@Validated` selects groups; at class level it
switches on AOP method validation.
**Fix** · Keep `@Validated` on parameters only in controllers.

## Interview questions

**★ Name the three exceptions Bean Validation can produce in a Spring MVC
application and say when each occurs.**
`MethodArgumentNotValidException` when a command-object parameter
(`@RequestBody`, `@ModelAttribute`, `@RequestPart`) annotated `@Valid` fails.
`HandlerMethodValidationException` when constraint annotations are declared
directly on method parameters — path variables, query parameters, headers,
container type arguments — which is Framework 6.1's built-in method validation.
`ConstraintViolationException` when validation runs through the AOP-based
`MethodValidationPostProcessor`, which happens on any bean whose class is
annotated `@Validated`.

**★ Why does adding a constrained `@RequestParam` change the exception thrown
for a bad request body on the same method?**
Because method validation *supersedes* individual-parameter validation for that
method. Once any parameter carries a constraint annotation directly, the whole
invocation is validated at the method level and every failure — including the
body's — is reported through `HandlerMethodValidationException`. It is the
strongest reason to handle both exception types rather than the one you have
seen.

**★ A colleague reports that `@Positive @PathVariable Long id` returns 500 on a
negative id. Diagnose it.**
The controller class almost certainly carries `@Validated`. That enables
AOP-based method validation, which supersedes Spring MVC's built-in support and
throws `ConstraintViolationException` — a Jakarta exception that is not in
Spring MVC's exception-to-status table, so it falls through to 500. Remove
`@Validated` from the controller class; the built-in path then throws
`HandlerMethodValidationException`, which maps to 400.

**★ Does `@Valid` on a parameter trigger method validation?**
No. `@Valid` is a cascade marker, not a constraint, so on its own it keeps the
method on the individual-parameter path. Adding any actual constraint to the
same parameter — `@NotNull @Valid @RequestBody Order` — does move it to method
validation, which is a subtle way to change an endpoint's error shape while
apparently only tightening a rule.

**★ What does a `BindingResult` parameter do to validation failure handling?**
It suppresses the exception. Errors are placed in the `BindingResult` and the
handler is invoked, on the assumption that you will check it. The parameter
must be **immediately after** the one it belongs to. Under method validation
the rule is stricter: the method is called only if *all* errors are on
parameters that have an `Errors` immediately after; errors anywhere else still
raise `HandlerMethodValidationException`.

**★ What status codes do the validation exceptions map to by default?**
`MethodArgumentNotValidException` and `HandlerMethodValidationException` both
map to **400** and both implement `ErrorResponse`, so Boot's problem-detail
support renders them as RFC 9457 bodies with message codes derived from the
fully-qualified exception class name. `ConstraintViolationException` maps to
nothing — it is not a Spring MVC exception — and therefore becomes **500**
unless you handle it.

**★ Should you write a handler for `ConstraintViolationException`?**
For a controller, the better move is to remove the class-level `@Validated` so
it never arises. For a `@Validated` **service**, letting it be a 500 is
arguably correct: a service-layer constraint failure means the boundary
validation missed something, which is a bug in your code rather than in the
client's request. Mapping it to 400 hides that.

**★ Why did Framework 6.1 add built-in method validation when the AOP
mechanism already existed?**
Because the AOP mechanism required a proxy around every controller, which
brings the usual proxy costs and caveats — including self-invocation not being
intercepted — and because it produced an exception with no web semantics. The
built-in support needs no proxy, knows which annotation each parameter came
from, groups results per parameter, and maps to 400 out of the box. The cost is
the transitional trap: the old class-level annotation now disables the new
path.

**★ A validation-looking 400 arrives with no field details. What are the
candidates?**
Either the body never parsed — `HttpMessageNotReadableException` from the
message converter, which is also a 400 and never reaches validation — or a type
conversion failed (`MethodArgumentTypeMismatchException`), or the failure came
from `HandlerMethodValidationException` and the handler only knew how to
extract details from `MethodArgumentNotValidException`. All three look
identical from the outside, which is why the error handler should give each a
distinguishable problem type.

---

← Prev: [Collections, parts and scalar inputs](06-collections-parts-parameters.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Reading the errors](08-reading-the-errors.md)
