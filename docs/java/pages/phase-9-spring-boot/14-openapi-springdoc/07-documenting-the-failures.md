---
title: "Documenting the failures, not just the happy path"
sidebar_label: "7 · Documenting the failures"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-20 against springdoc.org/properties.html
> (`springdoc.override-with-generic-response`, documented default `true`:
> "When true, automatically adds @ControllerAdvice responses to all the
> generated responses"), the springdoc-openapi README section *Error Handling
> for REST using @ControllerAdvice*, the `swagger-annotations-jakarta` 2.2.52
> annotation set, and RFC 9457 as covered in
> [topic 09](../09-error-handling/06-problemdetail-and-rfc-9457.md).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**A generated document describes the success response and, left alone, almost
nothing else — which makes it a description of what happens when everything
works, published to consumers whose main job is handling what happens when it
does not. Fixing that is the highest-value editing you will do to a springdoc
document, and it is harder than it looks for one specific reason: the error body
[topic 09](../09-error-handling/06-problemdetail-and-rfc-9457.md) tells you to
return carries its most useful fields in a map, and a schema generated from a
map describes nothing.**

## Two levers, and you want both

### The global one, which is on already

`springdoc.override-with-generic-response` defaults to `true`, and is documented
as: "automatically adds `@ControllerAdvice` responses to all the generated
responses". The springdoc README adds the condition — to have those responses
generated automatically, the advice's handler methods must declare their status,
"using the annotation: `@ResponseStatus`".

So an advice written the way
[topic 09 describes](../09-error-handling/05-controlleradvice.md) already
contributes its statuses to every operation, with no per-controller work. For an
internal service that is often enough on its own.

⚠️ **It is a blunt instrument.** It attaches *every* advice response to *every*
operation, so a read-only `GET` documents a `422` it can never return and a
`409` from a completely unrelated aggregate. If a code generator consumes your
document, that noise becomes generated error types nobody can trigger. The
precise alternative:

```yaml
springdoc:
  override-with-generic-response: false
```

…and then declare per operation, which is the second lever.

### The per-operation one

```java
@GetMapping("/orders/{id}")
@ApiResponses({
    @ApiResponse(responseCode = "200", description = "the order"),
    @ApiResponse(responseCode = "404", description = "no order with that id",
        content = @Content(mediaType = "application/problem+json",
                           schema = @Schema(implementation = ProblemDetail.class))),
    @ApiResponse(responseCode = "409", description = "the order is already cancelled",
        content = @Content(mediaType = "application/problem+json",
                           schema = @Schema(implementation = ProblemDetail.class)))
})
public OrderResponse get(@PathVariable UUID id) { ... }
```

Note the media type. RFC 9457 responses are **`application/problem+json`**, not
`application/json`. A document that claims `application/json` for a problem body
is describing a content type the service does not send, and a client that
switches on the response content type will fall through to its generic branch.

## The extension-member problem, which is the real one

`ProblemDetail` declares `type`, `title`, `status`, `detail` and `instance`, and
holds everything else — the per-field validation errors, the correlation id —
in a map of extension members. A schema generated from the class can only
describe the declared properties. So `@Schema(implementation = ProblemDetail.class)`
produces a document that describes five fields and omits precisely the two a
frontend needs.

**Describe the body you actually send.** Declare a record whose shape mirrors
the real response and point the `@ApiResponse` at that:

```java
@Schema(name = "ValidationProblem",
        description = "RFC 9457 problem detail with per-field errors")
public record ValidationProblem(
        URI type, String title, int status, String detail, URI instance,
        @Schema(description = "correlation id, also in the X-Request-Id header")
        String traceId,
        List<FieldError> errors) {

    @Schema(name = "FieldError")
    public record FieldError(String field, String message) { }
}
```

```java
@ApiResponse(responseCode = "400", description = "the request failed validation",
    content = @Content(mediaType = "application/problem+json",
                       schema = @Schema(implementation = ValidationProblem.class)))
```

This record exists purely to be a schema — the advice still builds a real
`ProblemDetail`. That duplication is uncomfortable and it is the honest price of
documenting a map-shaped body.

**The alternative removes the duplication entirely:** return your own error type
from the advice instead of `ProblemDetail`, in which case the schema is
generated from the thing you actually return and the two cannot diverge. That
trade — RFC-provided type versus generated-schema fidelity — is argued in
[topic 09's extension-members chunk](../09-error-handling/07-extension-members.md);
this chunk is the reason the fidelity side of it has teeth.

## What the validation failures look like in the document

The `400` from a failed `@Valid` is the response consumers hit most often, and
it is the one most likely to be undocumented, because it is thrown by the
framework rather than by your code. It comes from the advice, so
`override-with-generic-response` picks up its status — but only its status, not
its body shape. Describing the body is manual, and it is the single most useful
`@ApiResponse` in most APIs, because it is what lets a frontend map an error
onto a form field. Which constraint produced which message is
[topic 08's subject](../08-validation/08-reading-the-errors.md).

## Gotchas

**⚠️ Error responses documented as `application/json`**
**Symptom:** a generated client parses the error body against the wrong schema,
or does not recognise the response at all.
**Cause:** `@Content` defaulted, or copied from the success response.
**Fix:** state `mediaType = "application/problem+json"` on every problem
response.

**⚠️ `@ApiResponse` on a status the handler cannot return**
**Symptom:** the document promises a `403` from an endpoint with no
authorisation rule.
**Cause:** either a copy-pasted block, or
`springdoc.override-with-generic-response` attaching every advice response
globally.
**Fix:** turn the global behaviour off and declare per operation, or accept it
knowingly for an internal document where the noise costs nothing.

**⚠️ `@Schema(implementation = ProblemDetail.class)` and the missing fields**
**Symptom:** the generated client's error type has no `errors` array, so the
frontend hand-parses the JSON it was supposed to be generated for.
**Cause:** extension members are a map; a class-derived schema cannot see them.
**Fix:** the `ValidationProblem` record above, or return your own error type.

**⚠️ Advice handlers with no declared status**
**Symptom:** `override-with-generic-response` is on and still nothing appears.
**Cause:** the springdoc README's condition — the advice methods must declare
their HTTP status, e.g. with `@ResponseStatus`, for the response to be inferred.
A handler returning a bare `ResponseEntity` built at runtime has no static
status for springdoc to read.
**Fix:** declare it, and keep the runtime body construction as it was.

```java
@ExceptionHandler(OrderNotFoundException.class)
@ResponseStatus(HttpStatus.NOT_FOUND)
ProblemDetail notFound(OrderNotFoundException ex) { ... }
```

**⚠️ Documenting `500`**
**Symptom:** every operation lists a `500` with a `ProblemDetail` body.
**Cause:** completeness instinct.
**Fix:** think about whether you mean it. A documented `500` tells consumers
your service returns a structured body for unexpected failures — which is a
promise you then have to keep, including making sure nothing leaks into it.
[Topic 09 is explicit about what must never reach the client](../09-error-handling/13-never-reaches-the-client.md);
document the `500` only if you have actually built the safe body it describes.

## Interview questions

**★ How do you get error responses into the generated document?**
Two levers. `springdoc.override-with-generic-response`, on by default, attaches
the responses declared by your `@ControllerAdvice` handlers to every operation —
provided those handlers declare a status, typically with `@ResponseStatus`. And
`@ApiResponses` on individual handlers for the outcomes specific to that
endpoint, each with `content = @Content(mediaType = "application/problem+json",
schema = @Schema(implementation = …))`. The global lever is convenient and
imprecise; the per-operation one is what a published contract deserves.

**★ Why does documenting `ProblemDetail` not describe your actual error body?**
Because `ProblemDetail`'s extension members live in a map, and a schema derived
from the class can only describe its declared properties — `type`, `title`,
`status`, `detail`, `instance`. The `errors` array and the correlation id your
advice adds are invisible. The fix is a record that mirrors the body you really
send, or returning your own error type instead of `ProblemDetail` so the schema
comes from something real.

**★ Would you turn `override-with-generic-response` off?**
For a published contract, yes. It attaches every advice-declared response to
every operation, which produces a document claiming outcomes an endpoint cannot
produce — and a code generator will faithfully generate handling for all of
them. For an internal service where the document is read by humans in a UI, the
noise is cheap and leaving it on saves real annotation effort.

**★ What content type should error responses be documented as, and why does it matter?**
`application/problem+json`, per RFC 9457. It matters because content type is how
a client distinguishes a structured problem from an arbitrary error page, and
because generated clients branch on it. Documenting `application/json` for a
problem body is a contract statement that is simply false, and it is the most
common error-documentation mistake.

**★ Your API returns validation errors with a per-field array. How does that reach the contract?**
Not automatically. The status arrives via the advice, but the body shape does
not, because it is assembled into `ProblemDetail`'s extension members. You
declare a record mirroring it, annotate it with `@Schema(name = …)` so the key
is stable, and reference it from an `@ApiResponse` on the operations that
validate. It is the one place where hand-written schema work clearly pays for
itself, because it is what turns a generated client into something a form can
use.

---

← Prev: [The annotations](06-the-annotations.md) · Index: [OpenAPI with springdoc](README.md) · Next → [Security in the document, and in front of it](08-security-and-lockdown.md)
