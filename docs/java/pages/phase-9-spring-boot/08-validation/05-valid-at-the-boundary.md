---
title: "`@Valid` at the controller boundary"
sidebar_label: "5 · @Valid at the boundary"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Validation* for
> `@RequestMapping` methods
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-validation.html
> — the two levels of validation, the command-object-versus-container rule, the
> `Errors`/`BindingResult` rule, and the note that class-level `@Validated`
> must be removed to use the built-in support added in Framework 6.1) — and
> *Java Bean Validation*
> (docs.spring.io/spring-framework/reference/core/validation/beanvalidation.html).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**`@Valid` is not a constraint. It is the instruction to *descend* — into a
method argument, or into a field — and run the constraints that are already
there. Nothing validates without it except constraints written directly on a
method parameter, and that exception is the source of most of the confusion in
this chunk.**

## The body: `@Valid @RequestBody`

```java
@RestController
@RequestMapping("/orders")
class OrderController {

    @PostMapping
    ResponseEntity<OrderResponse> create(@Valid @RequestBody CreateOrderRequest request) {
        // request is guaranteed to satisfy every constraint on CreateOrderRequest
    }
}
```

Spring MVC validates an `@ModelAttribute`, `@RequestBody` or `@RequestPart`
argument annotated with `@jakarta.validation.Valid` or Spring's `@Validated`,
**provided three things hold**:

1. the parameter is a **command object** rather than a container such as a
   `Map` or a `Collection`;
2. it is **not immediately followed by an `Errors` or `BindingResult`
   parameter**;
3. **method validation is not otherwise required** for the method — that is,
   no constraint annotations sit directly on any of its parameters.

Each of those three has a failure mode, and each is covered below or in
[chunk 6](06-the-failure.md).

⛔ **Remove `@Valid` and everything passes.** No warning, no log line, no
startup check. This is the single most common validation bug in Spring, and it
survives code review because the DTO is covered in annotations and *looks*
validated. A test per endpoint asserting one rejection is the only reliable
defence.

## `@Valid` versus `@Validated`

| | `@Valid` | `@Validated` |
|---|---|---|
| From | `jakarta.validation` | `org.springframework.validation.annotation` |
| Takes groups | no | **yes** — `@Validated(OnCreate.class)` |
| On a method parameter | descend and validate | descend and validate, with groups |
| On a **field** | cascade into the nested object | ⛔ **not supported for cascading** |
| On a **class** | not applicable | enables **AOP-based method validation** |

Two practical rules fall out. **On a parameter, use `@Valid` unless you need
groups**, in which case `@Validated(Something.class)` is the only option
([chunk 7](07-custom-validators.md)). **On a field, only `@Valid` cascades** —
`@Validated` is a Spring annotation and the provider does not read it when
walking an object graph.

The class-level use is a different feature altogether and it interacts badly
with controllers; that is [chunk 6](06-the-failure.md).

## Nested objects do not validate themselves

Cascading is opt-in at every level.

```java
public record CreateOrderRequest(
        @NotBlank String customerName,

        @NotNull @Valid Address shippingAddress,          // ← descends

        @NotEmpty List<@Valid LineItem> lines,            // ← descends per element

        @Valid Map<String, @Valid Attachment> files) { }  // ← descends per value

public record Address(@NotBlank String street, @NotBlank @Size(max = 2) String country) { }
```

Drop the `@Valid` on `shippingAddress` and the constraints inside `Address` are
never evaluated — the field is checked for `null` by `@NotNull` and then
ignored. This is the nested version of the "forgot `@Valid`" bug and it is
harder to spot, because the endpoint *does* reject some bad input, just not the
bad input inside the nested object.

Note the pairing on `shippingAddress`: **`@NotNull` and `@Valid` are
orthogonal**. `@Valid` on a `null` field validates nothing and reports nothing,
so if the nested object is required you must say so separately.

## The trade-off

`@Valid` is one token and its cost is that it is one token: an entirely
declarative, invisible switch whose absence has no symptom. The alternative
designs both cost more and buy something.

- **Validate explicitly in the controller** — inject `jakarta.validation.Validator`
  and call `validator.validate(request)` yourself. Now the call is visible in
  the method body and greppable, and you have paid for it with three lines per
  endpoint and a hand-rolled translation from `Set<ConstraintViolation<T>>` to
  a response.
- **Validate in the constructor of the DTO** — no way to produce a multi-field
  report, because the first failure throws.
- **An architecture test** — a rule asserting that every `@RequestBody`
  parameter carries `@Valid` costs one test for the whole codebase and closes
  the omission properly. This is the option most teams should take and most
  teams do not.

## Gotchas

**Symptom** · A DTO covered in constraints and every request accepted.
**Cause** · No `@Valid` on the `@RequestBody` parameter.
**Fix** · Add it, then add a test that asserts a rejection so it cannot silently
disappear again.

**Symptom** · Top-level fields are validated; fields of a nested object are
not.
**Cause** · Cascading is opt-in — no `@Valid` on the nested field.
**Fix** · `@NotNull @Valid Address shippingAddress`, and remember the two
annotations do different jobs.

**Symptom** · Constraints inside list elements are checked but a `null` element
gets through.
**Cause** · `@Valid` on the type argument cascades into an element; it does not
require the element to exist.
**Fix** · `List<@NotNull @Valid Item>`.

**Symptom** · `@Validated` on a nested field compiles and cascades nothing.
**Cause** · Only `@Valid` is recognised by the provider for cascading;
`@Validated` is a Spring annotation.
**Fix** · `@Valid` on the field. If you need groups on a nested object, that is
a class-level design problem, not something the field annotation can fix.

**Symptom** · A validation failure returns 200 and the handler runs with bad
data.
**Cause** · A `BindingResult`/`Errors` parameter immediately after the
validated one. That is a deliberate feature — it hands you the errors instead
of throwing — and it is a bug when nobody checks it.
**Fix** · Remove the parameter unless you are genuinely handling the errors
in-method; if you keep it, `if (errors.hasErrors())` must be the first
statement.

## Interview questions

**★ Is `@Valid` a constraint?**
No. It is a cascade instruction — "descend into this object and evaluate the
constraints declared on it". By itself it asserts nothing about the value, and
it does not even require the value to be non-null: `@Valid` on a `null` field
validates nothing. `@NotNull` and `@Valid` are routinely used together for that
reason.

**★ Where exactly does `@Valid` work on a controller method?**
On `@RequestBody`, `@ModelAttribute` and `@RequestPart` parameters, provided
the parameter is a command object rather than a container, has no `Errors` or
`BindingResult` immediately after it, and the method does not otherwise require
method validation. On a nested *field* it triggers cascading. On a plain
`@RequestParam` or `@PathVariable` it does nothing useful — those take
constraint annotations directly.

**★ `@Valid` or `@Validated` on a controller parameter?**
`@Valid` unless you need validation groups; `@Validated` is Spring's variant
and its distinguishing feature is that it takes group classes. On a nested
field the choice is not free: only `@Valid` cascades. And `@Validated` on the
*class* is a different feature entirely — AOP-based method validation — which
on a controller now suppresses Spring MVC's built-in support.

**★ What happens if you add a `BindingResult` parameter after a validated one?**
The exception is not thrown. Errors are collected into the `BindingResult` and
the handler method is invoked, on the assumption that you will inspect it. The
rule is positional — the `Errors` parameter must come **immediately after** the
parameter it belongs to — and if there are validation errors on any *other*
parameter, the exception is raised anyway.

**★ How do you validate a nested collection of objects inside a request body?**
`@NotEmpty List<@NotNull @Valid LineItem> lines`. Four independent statements:
the list is present, the list is non-empty, no element is `null`, and each
element's own constraints are evaluated. Omitting any one of them leaves a real
hole.

**★ How would you stop "someone forgot `@Valid`" from recurring?**
An architecture test — reflect over every `@RequestMapping` method in the
application and assert that each `@RequestBody` parameter whose type declares
constraints also carries `@Valid`. It is one test for the entire codebase and
it turns a silent, recurring, review-resistant omission into a build failure.
Per-endpoint rejection tests are the fallback and are worth having anyway.

---

← Prev: [Text, containers and placement](04-text-containers-placement.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Collections, parts and scalar inputs](06-collections-parts-parameters.md)
