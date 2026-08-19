---
title: "Collections, parts and scalar inputs"
sidebar_label: "6 · Collections, parts, params"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Validation* for
> `@RequestMapping` methods
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-validation.html
> — individual-parameter validation applying "so long as it is a command object
> rather than a container such as a `Map` or `Collection`", and method
> validation supporting parameters that are collections, arrays or maps) — and
> the Spring Boot reference *Validation*
> (docs.spring.io/spring-boot/reference/io/validation.html). Spring Boot 4.1.0,
> Spring Framework 7.0.x, JDK 25.

**`@Valid` on a `@RequestBody` works because the parameter is a *command
object*. The moment the parameter is a `List`, a `Map` or a bare scalar, that
sentence stops applying and a different mechanism has to take over —
silently, with no error to tell you the switch happened. This chunk is the
three argument shapes where the obvious annotation does nothing.**

## Collections as the request body

A `List` is a container, and individual-parameter validation is specified to
apply only to command objects. So:

```java
// ⛔ @Valid does nothing here — the parameter is a container, not a command object
@PostMapping("/batch")
void batch(@Valid @RequestBody List<LineItem> lines) { }

// ✓ constraints on the type argument DO apply, via method validation
@PostMapping("/batch")
void batch(@RequestBody List<@Valid @NotNull LineItem> lines) { }
```

The second form works because the constraint is attached to the parameter's
**type argument**, which puts the method onto the **method-validation** path
instead. That path explicitly supports parameters that are collections, arrays
and maps — and it raises a *different* exception, which is
[chunk 7](07-the-failure.md).

### Wrapping the list is usually the better answer

```java
public record BatchRequest(
        @NotEmpty @Size(max = 500) List<@Valid @NotNull LineItem> lines) { }

@PostMapping("/batch")
void batch(@Valid @RequestBody BatchRequest request) { }
```

The parameter is a command object again, so the ordinary rules apply and the
exception is the ordinary one. You also gain three things that have nothing to
do with validation:

- **a place to bound the batch.** `@Size(max = 500)` on the list is the
  difference between a slow endpoint and an availability incident, and there is
  nowhere to write it in the bare-list form.
- **room to grow.** A JSON object can gain an `idempotencyKey` or a `dryRun`
  flag without breaking existing clients; a top-level array cannot gain
  anything at all.
- **a name in the error report.** Violations are addressed as
  `lines[3].quantity` rather than `[3].quantity`, which is easier for a client
  to map back to its own model.

A bare top-level JSON array is an awkward request contract for exactly the same
reasons it is an awkward parameter, and the validation behaviour is the tell.

## Multipart: `@Valid @RequestPart`

```java
@PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
void upload(@Valid @RequestPart("metadata") DocumentMetadata metadata,
            @RequestPart("file") MultipartFile file) { }
```

`@RequestPart` sits in the same list as `@RequestBody` and `@ModelAttribute`,
so a JSON part is converted by a message converter and then validated exactly
like a body — same rules, same exception. The binary part is not a command
object and carries no constraints.

⚠️ **File size is not a validation concern.** Multipart limits are enforced by
the servlet container while the request is being parsed, which is before any
constraint could run:

```yaml
spring:
  servlet:
    multipart:
      max-file-size: 10MB
      max-request-size: 12MB
```

Exceeding them produces a multipart exception that your error handler has to
translate. `@Size` cannot express it, and the reason is structural rather than
an oversight: rejecting a 2 GB upload is only useful if you reject it before
reading it.

## Scalar inputs: path variables and query parameters

There is no object to descend into, so constraints go **directly on the
parameter**:

```java
@GetMapping("/orders/{id}")
Order byId(@PathVariable @Positive Long id,
           @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
           @RequestParam(required = false) @Size(max = 64) String cursor) { }
```

This is method validation. Since Framework 6.1, Spring MVC applies it **with no
AOP proxy and no class-level annotation** — the presence of the constraints on
the parameters is itself the trigger.

Three conditions have to hold for it to work, and all three are easy to break:

1. the constraints are **directly on the method parameters**;
2. the configured `mvcValidator` is a `jakarta.validation.Validator` — which
   `LocalValidatorFactoryBean` is, and Boot configures it for you once the
   validation starter is present;
3. the controller class does **not** carry `@Validated`.

That third condition is the one that surprises people, because for years the
documented recipe was exactly the opposite. It, and the exception each path
throws, are [chunk 7](07-the-failure.md).

⚠️ Note `@Min(1) @Max(100) int size` on a primitive here. Unlike a body field,
that is fine — the parameter has a `defaultValue`, so absence is
representable by the default rather than by `null`, and there is no
"omitted became zero" ambiguity to worry about.

## The trade-off

**Constraints on a DTO are reusable; constraints on a method parameter are
not.** A `CreateOrderRequest` carries its rules to every entry point that
accepts it — the controller, a batch importer, a message consumer, a test. A
`@Min(1)` on a query parameter exists in exactly one method signature and has
to be repeated, correctly, on every endpoint that takes the same parameter.
Duplicated `@Min(1) @Max(100)` on six list endpoints is a real maintenance
cost, and the usual fix is to bind pagination into a small `@ModelAttribute`
command object that carries the constraints once.

Against that, parameter constraints are the only option for genuinely scalar
inputs, and they read well for one or two of them. The rule of thumb: **bodies
get DTO constraints; one or two scalars get parameter constraints; three or
more scalars want a command object.**

There is also a real cost to the two-mechanism design itself. Which exception
you get depends on the *shape of your method signature* rather than on anything
you declared, so a refactoring that wraps a list in a record or adds a
constrained query parameter can change the error contract of an endpoint
without touching a single annotation. That is not hypothetical and it is why
the next chunk exists.

## Gotchas

**Symptom** · `@Valid @RequestBody List<Item>` accepts anything.
**Cause** · A `List` is a container, not a command object, so
individual-parameter validation does not apply.
**Fix** · `@RequestBody List<@Valid @NotNull Item>` — or better, wrap it in a
request record with `@NotEmpty @Size(max = …)` on the list.

**Symptom** · A batch endpoint accepts an array of 200,000 elements and the
service falls over.
**Cause** · Nothing bounds a top-level array; there is no field to annotate.
**Fix** · The wrapper record, with `@Size(max = …)` on the list. This is the
strongest practical argument against bare-array request bodies.

**Symptom** · Elements are validated but a `null` element gets through.
**Cause** · `@Valid` on the type argument cascades into an element; it does not
require the element to exist.
**Fix** · `List<@NotNull @Valid Item>`.

**Symptom** · Validation of a multipart JSON part never runs.
**Cause** · The part was bound as a `String` or `MultipartFile` rather than to
a typed object, so there is nothing to descend into.
**Fix** · Declare the part as the DTO type and annotate it
`@Valid @RequestPart("metadata")`; the message converter selected by the part's
content type does the conversion.

**Symptom** · A large upload fails with something that is not a validation
error.
**Cause** · Multipart size limits are enforced by the container before any
validator sees the request.
**Fix** · Configure `spring.servlet.multipart.max-file-size` and handle the
resulting exception in the error handler.

**Symptom** · Query-parameter constraints are ignored entirely.
**Cause** · Usually `@Validated` on the controller class, which switches off
Spring MVC's built-in method validation in favour of the AOP path.
**Fix** · Remove the class-level `@Validated` from controllers — see
[chunk 7](07-the-failure.md).

**Symptom** · The same `@Min(1) @Max(100)` appears on eight endpoints and one
of them says `@Max(1000)`.
**Cause** · Parameter constraints cannot be shared.
**Fix** · A `PageRequest` command object bound with `@ModelAttribute`, carrying
the constraints once.

## Interview questions

**★ Why doesn't `@Valid @RequestBody List<Item>` validate the items?**
Because individual-parameter validation is specified to apply to a command
object rather than a container such as a `Map` or `Collection`. The list is a
container, so nothing descends into it. Moving the constraint onto the type
argument — `List<@Valid Item>` — puts the method onto the method-validation
path, which does support collection parameters but throws a different
exception. Wrapping the list in a request record avoids the question entirely.

**★ Beyond validation, why prefer a wrapper object to a top-level JSON array?**
Because an array has no room to grow — you cannot add a field to it without
breaking clients — no place to put a size bound, and no name to address
violations against. The wrapper gives you all three, and it costs one record
declaration.

**★ Can `@Size` limit an uploaded file?**
No. `@Size` applies to `CharSequence`, `Collection`, `Map` and arrays, and a
multipart file is none of them. The limit is a container setting
(`spring.servlet.multipart.max-file-size`) enforced while the request is parsed,
before any constraint runs — which is the only useful place to enforce it,
since the point is to avoid reading the bytes at all.

**★ Does `@Valid` on `@RequestPart` behave like `@RequestBody`?**
Yes. `@RequestPart` is in the same list as `@RequestBody` and
`@ModelAttribute`, so the part is converted by a message converter and then
validated as a command object, raising the same exception. Only the typed parts
participate; a `MultipartFile` has no constraints to evaluate.

**★ What are the three conditions for constraints on `@RequestParam` to be
enforced?**
The constraints must be directly on the method parameters; the configured
`mvcValidator` must be a `jakarta.validation.Validator`, which Boot arranges
via `LocalValidatorFactoryBean` once the validation starter is present; and the
controller class must **not** be annotated `@Validated`, because that switches
on the older AOP-based path instead of Framework 6.1's built-in support.

**★ When would you replace query parameters with an `@ModelAttribute` command
object?**
Once the same constraints start repeating across endpoints, or once there are
more than two or three of them. The command object carries the constraints in
one place, gives them names in the violation report, and can grow a
cross-parameter rule — "`from` must not be after `to`" — which is impossible to
express on separate parameters without a custom class-level constraint.

---

← Prev: [`@Valid` at the boundary](05-valid-at-the-boundary.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [What the failure looks like](07-the-failure.md)
