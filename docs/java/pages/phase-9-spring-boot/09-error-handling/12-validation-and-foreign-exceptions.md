---
title: "Validation failures and exceptions you do not own"
sidebar_label: "12 · Validation and foreign exceptions"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Validation*
> and *Error Responses*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-validation.html
> and .../mvc-ann-rest-exceptions.html — `MethodArgumentNotValidException` with
> `{0}` global errors / `{1}` field errors, `HandlerMethodValidationException`
> with `{0}` all validation errors) and the `ResponseEntityExceptionHandler`
> javadoc (`handleMethodArgumentNotValid`,
> `handleHandlerMethodValidationException`). Boot 4's non-transitive Bean
> Validation confirmed against the **Spring Boot 4.0 Release Notes** (GitHub
> wiki). Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Validation is the error path every API exercises most and documents least, and
it is the one place where Spring hands you two different exceptions for what a
client experiences as one thing. Getting this right means one body shape for
every validation failure — not one for bodies and a different one for query
parameters.**

## Two exceptions, and they are not interchangeable

| Exception | Raised when | Carries |
|---|---|---|
| `MethodArgumentNotValidException` | `@Valid` on a `@RequestBody` failed | a `BindingResult` — **field errors** with field names, plus global (class-level) errors |
| `HandlerMethodValidationException` | Constraint annotations directly on method parameters failed — `@RequestParam @Min(1) int page`, `@PathVariable @Size(max=36) String id` | per-**parameter** failures, not per-body-field |

Both have a `handle*` method on `ResponseEntityExceptionHandler`, and both
produce a generic `detail` by default. That generic detail is close to useless
to a client: it says validation failed, not which field. Overriding **both** —
to the same shape — is the work.

## A structured body for `@RequestBody` validation

```java
@Override
protected ResponseEntity<Object> handleMethodArgumentNotValid(
        MethodArgumentNotValidException ex, HttpHeaders headers,
        HttpStatusCode status, WebRequest request) {

    ProblemDetail pd = createProblemDetail(
            ex, HttpStatus.BAD_REQUEST, "Request body failed validation.", null, null, request);
    pd.setType(URI.create("https://api.example.com/problems/validation-failed"));
    pd.setTitle("Validation failed");

    List<Map<String, Object>> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
            .map(fe -> Map.<String, Object>of(
                    "field",   fe.getField(),
                    "message", Objects.requireNonNullElse(fe.getDefaultMessage(), "invalid")))
            .toList();

    List<String> globalErrors = ex.getBindingResult().getGlobalErrors().stream()
            .map(oe -> Objects.requireNonNullElse(oe.getDefaultMessage(), "invalid"))
            .toList();

    pd.setProperty("errors", fieldErrors);
    if (!globalErrors.isEmpty()) {
        pd.setProperty("globalErrors", globalErrors);
    }
    return handleExceptionInternal(ex, pd, headers, HttpStatus.BAD_REQUEST, request);
}
```

producing:

```json
{
  "type": "https://api.example.com/problems/validation-failed",
  "title": "Validation failed",
  "status": 400,
  "detail": "Request body failed validation.",
  "instance": "/orders",
  "errors": [
    { "field": "quantity",   "message": "must be greater than or equal to 1" },
    { "field": "customerId", "message": "must not be blank" }
  ]
}
```

🔴 **Notice what is deliberately absent: `rejectedValue`.** Echoing back what the
client sent is convenient for debugging and it is exactly how passwords, tokens
and card numbers end up in error bodies and log aggregators. Include it only for
fields you have explicitly classified as non-sensitive —
[chunk 13](13-never-reaches-the-client.md) argues it in full.

## The same shape for parameter validation

```java
@Override
protected ResponseEntity<Object> handleHandlerMethodValidationException(
        HandlerMethodValidationException ex, HttpHeaders headers,
        HttpStatusCode status, WebRequest request) {

    ProblemDetail pd = createProblemDetail(
            ex, HttpStatus.BAD_REQUEST, "Request parameters failed validation.", null, null, request);
    pd.setType(URI.create("https://api.example.com/problems/validation-failed"));
    pd.setTitle("Validation failed");

    List<Map<String, Object>> errors = new ArrayList<>();
    ex.visitResults(new HandlerMethodValidationException.Visitor() {
        // one visit* method per parameter kind; each yields the name and its errors
    });

    pd.setProperty("errors", errors);
    return handleExceptionInternal(ex, pd, headers, HttpStatus.BAD_REQUEST, request);
}
```

The point is not the visitor API — it is that **the `type`, the `title` and the
`errors` member name are identical to the body case.** A client writes one
parser. Emitting `errors` for body failures and `violations` for parameter
failures is the single most common way an API ends up with two validation
formats, and it is entirely self-inflicted.

## 🔴 Boot 4: Bean Validation is no longer transitive

In Boot 3, `spring-boot-starter-web` dragged in `spring-boot-starter-validation`.
**In Boot 4 it does not.** Without the explicit dependency, `@Valid` and every
constraint annotation are **silently inert** — no error, no warning, no
validation. An endpoint that used to reject a negative quantity now accepts it.

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

This is the highest-consequence item in the Boot 4 migration for error handling,
because the failure is invisible: everything compiles, everything starts,
nothing validates. The mechanics of validation itself — constraint annotations,
groups, custom validators — are **[Topic 08 — Validation](../08-validation/README.md)**;
what belongs here is only its mapping to a response.

⚠️ Related Boot 4 rename to expect in the same `pom.xml` edit:
`spring-boot-starter-web` is now **`spring-boot-starter-webmvc`**.

## Exceptions you do not own

Third-party and framework exceptions need a deliberate decision too, and the
default — let them reach the catch-all and become a 500 — is a major source of
misleading statuses.

| Exception | Sensible mapping | Why |
|---|---|---|
| `OptimisticLockingFailureException` | **409** | Concurrent modification of the addressed resource; retrying with a fresh version is the remedy |
| `DuplicateKeyException` | **409** | A state conflict, not malformed input |
| `DataIntegrityViolationException` (other) | **409** or **500** | 409 if it is a constraint the client can act on; 500 if it means your schema and your code disagree |
| `EmptyResultDataAccessException` | **404** — but better, do not let it out of the repository layer | It is a persistence detail leaking upward; translate it to a domain exception at the boundary |
| `HttpClientErrorException` from a downstream call | **502**, occasionally **503** | Your upstream's 404 does not mean *your* resource is missing |
| `HttpServerErrorException` from a downstream call | **502** | The dependency broke, not the client |
| `ResourceAccessException` / connect or read timeout | **503** or **504** | Availability, not a client error |
| `AccessDeniedException` | **403** | Leave it to Spring Security's own handling — see **[Topic 11 — Spring Security](../11-spring-security/README.md)** |
| `AuthenticationException` | **401**, with `WWW-Authenticate` | Same: Security owns this path, and it runs in the filter chain, *before* your advice |

🔴 **Never pass a downstream status through.** If your payment provider returns
400 because *you* sent it a malformed request, the caller's request was fine.
Their 400 is your **500**. Passing it through blames the client for your bug and
sends them into a debugging loop they cannot exit.

⚠️ Two of these rows — `AccessDeniedException` and `AuthenticationException` —
are a genuine trap: Spring Security handles them **inside the filter chain**, so
they frequently never reach your `@ControllerAdvice` at all. That is a special
case of [chunk 15](15-the-gaps.md).

## Translating at the boundary, not in the advice

The best place to map a foreign exception is often not the advice at all — it is
the layer that calls the foreign code:

```java
// Repository/adapter layer: the persistence exception never escapes.
public Order load(String id) {
    try {
        return jdbc.queryForObject(SQL, MAPPER, id);
    } catch (EmptyResultDataAccessException e) {
        throw new OrderNotFoundException(id);          // a domain exception, from here up
    }
}
```

This keeps the advice a table of *your* exceptions, keeps the persistence
technology invisible above the adapter, and means swapping JDBC for something
else does not change the error contract. Reserve advice-level mapping for
exceptions that genuinely have no natural boundary — Spring Security's, and
whatever a framework throws from inside its own machinery.

## The trade-off

Mapping foreign exceptions centrally is quick and keeps the knowledge in one
file; translating at the boundary is more code and keeps each layer's vocabulary
clean. The practical split is by *ownership*: if you call the library directly,
translate at the call site; if the framework throws it from somewhere you do not
call, map it in the advice. The thing to avoid is the third option — leaving it
unmapped and letting the catch-all decide, which silently turns every
unanticipated library failure into a 500.

## Gotchas

**Symptom** — `@Valid` produces no errors and invalid bodies are accepted.
**Cause** — Boot 4 removed Bean Validation from the web starter's transitive
dependencies.
**Fix** — add `spring-boot-starter-validation` explicitly. There is no warning;
the annotations are simply inert.

**Symptom** — body validation returns an `errors` array and query-parameter
validation returns something else entirely.
**Cause** — only `handleMethodArgumentNotValid` was overridden;
`HandlerMethodValidationException` still uses the default.
**Fix** — override both to the same `type`, `title` and member name.

**Symptom** — validation errors arrive as one long sentence.
**Cause** — the default handling produces a generic `detail` built from the
binding result's `toString`.
**Fix** — override and emit a structured `errors` member, as above.

**Symptom** — a `@Valid` failure on a nested object reports the field as
`items[0].quantity` and a client cannot map it to its form.
**Cause** — that *is* the field path, and it is correct — clients often just
have not planned for nesting.
**Fix** — keep the path; it is the only unambiguous identifier. Document the
path syntax next to the `validation-failed` problem type.

**Symptom** — `DataIntegrityViolationException` reaches the client as a 409 with
a `detail` containing a constraint name like `uk_orders_customer_ref`.
**Cause** — `ex.getMessage()` was used as the detail.
**Fix** — write your own detail text; never put a driver or constraint message
in the body. That is [chunk 13](13-never-reaches-the-client.md).

**Symptom** — a downstream service's 404 surfaces to your client as a 404.
**Cause** — an outbound HTTP error was rethrown or mapped by status.
**Fix** — map upstream failures to 502/503 by default and translate only the
specific cases where the upstream status genuinely describes *your* resource.

**Symptom** — a `@ControllerAdvice` handler for `AccessDeniedException` never
fires.
**Cause** — Spring Security handles it in the filter chain, before the
`DispatcherServlet`.
**Fix** — configure Security's `AccessDeniedHandler` / `AuthenticationEntryPoint`
to emit your problem shape. See [chunk 15](15-the-gaps.md).

## Interview questions

**★ Why are there two validation exceptions?**
Because two different mechanisms fail: `@Valid` on a `@RequestBody` produces
`MethodArgumentNotValidException` with a `BindingResult` of per-field errors,
while constraint annotations on method parameters produce
`HandlerMethodValidationException` with per-parameter failures. They are
genuinely different data, and if you only override one your API emits two
validation formats.

**★ What changed about validation in Spring Boot 4?**
Bean Validation is no longer a transitive dependency of the web starter. You must
add `spring-boot-starter-validation` explicitly, and if you do not, `@Valid` and
all constraint annotations are silently inert — the application starts, compiles
and validates nothing.

**★ Should the error body include the rejected value?**
Only for fields explicitly classified as safe. It is genuinely useful for
debugging and it is a direct route for passwords, tokens and card numbers into
error bodies and centralised logs. Default to omitting it and opt individual
fields in.

**★ A downstream service returns 400. What do you return?**
Almost always 500 — or 502 if you prefer to signal "upstream problem"
explicitly. A downstream 400 usually means *you* sent it a bad request, which is
your bug, not the caller's. Passing the status through blames the client for
something they cannot fix.

**★ Where should a persistence exception be translated?**
At the repository or adapter boundary, into a domain exception. That keeps the
advice a table of your own exceptions, keeps the persistence technology
invisible to the layers above, and means changing the data-access technology
does not change the API's error contract.

**★ Why does an `@ExceptionHandler` for `AccessDeniedException` often not
fire?**
Because Spring Security handles authentication and authorisation failures inside
the servlet filter chain, which runs before the `DispatcherServlet` — so the
exception never reaches the resolver chain your advice lives in. The fix is on
the Security side, configuring the entry point and access-denied handler to
produce the same problem shape.

---

← Prev: [Mapping domain exceptions](11-mapping-domain-exceptions.md) · Index: [Error handling](README.md) · Next → [What must never reach the client](13-never-reaches-the-client.md)
