---
title: "Extension members: adding your own fields"
sidebar_label: "7 · Extension members"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Error
> Responses*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html
> — the two ways to add non-standard fields, the exact wording on
> `ProblemDetailJacksonMixin` unwrapping the properties `Map` and re-inserting
> unknown properties on deserialization, and the copy constructor for
> subclasses). Boot 4 Jackson customiser rename confirmed against the **Spring
> Boot 4.0 Release Notes** (GitHub wiki). Spring Boot 4.1.0, Spring Framework
> 7.0.x, JDK 25.

**RFC 9457's five fields are a floor, not a ceiling — the spec expects services
to add their own members, and Spring gives you two mechanisms with genuinely
different use cases. The thing to internalise is that an extension member is a
public API field: adding one is a compatible change, renaming one is not.**

## The `properties` map

```java
ProblemDetail pd = ProblemDetail.forStatusAndDetail(
        HttpStatus.CONFLICT, "Only 3 units remain; 10 were requested.");
pd.setType(URI.create("https://api.example.com/problems/insufficient-stock"));
pd.setTitle("Insufficient stock");
pd.setProperty("sku", "SKU-4417");
pd.setProperty("available", 3);
pd.setProperty("requested", 10);
```

renders as **top-level** JSON properties, not a nested object:

```json
{
  "type": "https://api.example.com/problems/insufficient-stock",
  "title": "Insufficient stock",
  "status": 409,
  "detail": "Only 3 units remain; 10 were requested.",
  "instance": "/orders",
  "sku": "SKU-4417",
  "available": 3,
  "requested": 10
}
```

The flattening is not something Jackson does for a `Map` field by default — it
is a registered mixin. The reference: *"When using the Jackson library, the
Spring Framework registers `ProblemDetailJacksonMixin` that ensures this
'properties' `Map` is unwrapped and rendered as top level JSON properties in
the response, and likewise any unknown property during deserialization is
inserted into this `Map`."*

Two consequences fall out of that one sentence.

**It round-trips.** A client that is itself a Spring application can
deserialise another service's problem body into a `ProblemDetail` and find the
extension members in `getProperties()`. That makes `ProblemDetail` usable as a
*client-side* type as well as a server-side one, which is how you map an
upstream failure onto your own without inventing a second DTO — relevant when
you call other services (**Topic 12 — Outbound HTTP** *(not written yet)*).

**It is Jackson-specific and Jackson-version-specific.** Boot 4 ships Jackson 3,
with new package names and a new builder type. If you construct your own JSON
mapper from scratch you lose Spring's mixin registrations, including this one.
Customise the configured one instead — 🔴 in Boot 4 that means
`JsonMapperBuilderCustomizer`, which replaced
`Jackson2ObjectMapperBuilderCustomizer`. Details in
[Jackson 3: what changed](../07-rest-controllers/09-jackson-3-what-changed.md).

## Subclassing `ProblemDetail`

The reference's second mechanism: *"You can also extend `ProblemDetail` to add
dedicated non-standard properties. The copy constructor in `ProblemDetail`
allows a subclass to make it easy to be created from an existing
`ProblemDetail`."*

```java
public class ValidationProblemDetail extends ProblemDetail {

    private final List<FieldViolation> errors;

    public ValidationProblemDetail(ProblemDetail original, List<FieldViolation> errors) {
        super(original);                       // the copy constructor
        this.errors = errors;
    }

    public List<FieldViolation> getErrors() { return errors; }

    public record FieldViolation(String field, String message, Object rejectedValue) { }
}
```

Used from a handler:

```java
@ExceptionHandler
ResponseEntity<ValidationProblemDetail> handle(MethodArgumentNotValidException ex) {
    ProblemDetail base = ProblemDetail.forStatusAndDetail(
            HttpStatus.BAD_REQUEST, "Request body failed validation.");
    base.setType(URI.create("https://api.example.com/problems/validation-failed"));
    base.setTitle("Validation failed");

    List<ValidationProblemDetail.FieldViolation> errors = ex.getFieldErrors().stream()
            .map(fe -> new ValidationProblemDetail.FieldViolation(
                    fe.getField(), fe.getDefaultMessage(), fe.getRejectedValue()))
            .toList();

    return ResponseEntity.badRequest().body(new ValidationProblemDetail(base, errors));
}
```

⚠️ Note `getRejectedValue()` in that example: it echoes back what the client
sent. That is fine for a `quantity` field and **not** fine for a password or a
card number — [chunk 11](11-never-reaches-the-client.md) deals with it
properly.

## Choosing between the two

Decide on **typing and repetition**, not on taste:

| | `properties` map | `ProblemDetail` subclass |
|---|---|---|
| Best for | A handful of ad-hoc scalars that differ per problem type | A rich, structured extension shared by a *family* of problems |
| Typing | `Object` values, no compile-time check | Real fields, real types |
| Schema/OpenAPI | Invisible to schema generation | Generates a proper schema |
| Cost | None | A class per family, and a return type per handler |
| Canonical example | `sku`, `retryAfterSeconds`, `correlationId` | The field-violation list on every validation error |

Mixing them is normal and correct: a `ValidationProblemDetail` with a typed
`errors` list that also carries `setProperty("correlationId", …)`.

## The contract implications, stated once

An extension member is not a debugging aid you can remove later. Once `sku` is
in a response, some client is switching on it. Practical rules:

- **Add freely, remove never** — a new member is backwards-compatible, a
  removal or rename is not. Removals belong at a version boundary
  ([API versioning](../07-rest-controllers/12-api-versioning.md)).
- **Attach members to the `type`, not to the endpoint.** Every occurrence of
  `insufficient-stock` should carry `sku`, `available` and `requested`,
  whichever endpoint raised it. A member that appears only sometimes is a member
  clients must null-check forever.
- **Document them where you document the `type`.** The `type` URI is the natural
  place — that is the one thing about it that benefits from dereferencing.

## The trade-off

Extension members are what make an error *actionable* rather than merely
*classified* — a client that receives `available: 3` can offer to order three
instead of failing. The cost is that the error contract stops being five known
fields and becomes an open set that grows, that nobody generates types for
unless you subclass, and that no compiler checks. Subclassing buys the compiler
back and costs you a class; for anything a client will code against
mechanically, that trade is worth taking.

## Gotchas

**Symptom** — extension members appear nested under a `properties` object
rather than flattened.
**Cause** — `ProblemDetailJacksonMixin` is not registered, because a custom
JSON mapper was constructed from scratch instead of customising Spring's.
**Fix** — customise via `JsonMapperBuilderCustomizer` (Boot 4) so the mixin
registrations survive:
```java
@Bean
JsonMapperBuilderCustomizer myJsonCustomizer() {
    return builder -> builder.changeDefaultPropertyInclusion(
            incl -> incl.withValueInclusion(JsonInclude.Include.NON_NULL));
}
```

**Symptom** — a `ProblemDetail` subclass serialises without its extra fields.
**Cause** — no accessors on the subclass, or the handler's declared return type
is the base `ProblemDetail` and serialisation used the declared type.
**Fix** — give the subclass real getters and declare the concrete type:
`ResponseEntity<ValidationProblemDetail>`, not `ResponseEntity<ProblemDetail>`.

**Symptom** — the same problem type carries `sku` from one endpoint and not
from another.
**Cause** — the member was attached at the handler that happened to have the
data, rather than at the exception.
**Fix** — carry the data on the exception so every throw site supplies it, and
build the member from the exception in one handler.

**Symptom** — an extension member is a `Map` or a deeply nested object and
clients complain they cannot generate types for it.
**Cause** — the `properties` map is untyped by design; anything you put in it
is opaque to schema generation.
**Fix** — promote it to a `ProblemDetail` subclass with declared types, which is
exactly what the subclassing mechanism is for.

**Symptom** — a `LocalDateTime` extension member serialises as an array of
numbers.
**Cause** — the same date/time serialisation configuration that governs the rest
of your API applies here; nothing about `ProblemDetail` changes it.
**Fix** — configure it once globally (ISO-8601 strings) as you would for any
response body — see
[customising serialisation](../07-rest-controllers/11-customising-serialisation.md).

## Interview questions

**★ How do you put your own field in an RFC 9457 body, and why does it come out
at the top level?**
`setProperty(name, value)` into the `ProblemDetail`'s properties map. It renders
flat because Spring registers `ProblemDetailJacksonMixin`, which unwraps the map
into top-level JSON properties — and on deserialisation puts unknown properties
back into it, so the type round-trips between services.

**★ When would you subclass `ProblemDetail` instead of using the map?**
When the extension is structured and recurring — a list of field violations on
every validation error, for example. Subclassing gives real types, real getters
and a generatable schema, at the cost of a class per family. The map is right
for one-off scalars.

**★ Is adding an extension member a breaking change?**
Adding one is compatible — a client ignoring unknown fields is unaffected.
Renaming or removing one is breaking, because clients branch on it exactly as
they branch on `type`. Treat extension member names with the same care as the
field names of a success response, and put removals at a version boundary.

---

← Prev: [ProblemDetail and RFC 9457](06-problemdetail-and-rfc-9457.md) · Index: [Error handling](README.md) · Next → [ErrorResponse and i18n](08-errorresponse-and-i18n.md)
