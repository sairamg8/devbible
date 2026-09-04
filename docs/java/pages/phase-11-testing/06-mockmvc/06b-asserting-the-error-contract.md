---
title: "Asserting the error contract rather than the framework — the field name and the constraint code are yours, the message text is Spring's, the ordering is nobody's, and a form controller answers a validation failure with 200"
sidebar_label: "06b · Asserting the contract"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the **Spring Framework 7.0.x** reference "Defining Expectations"
> (read as asciidoc at tag `v7.0.9`) for `model().attributeHasErrors` / `attributeHasFieldErrorCode`
> and the `ModelAssert` returned by `.model()`; and against **Jakarta Bean Validation 3.1**, which
> specifies no ordering for the `ConstraintViolation` set. Message interpolation and message codes
> belong to [08 · Validation](../../phase-9-spring-boot/08-validation/14-messages-and-interpolation.md).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9 (sources read at 7.0.9 / 4.1.1), JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> **No sandbox** — this page carries Java source and library source, never a fabricated test run.

**[06](06-validation-errors.md) established the mechanism: which exception each failure raises, why
a bare slice returns 400 with an empty body, and the three places a body could come from. This
chunk is the practice — what is actually worth asserting once you know that. The through-line is
ownership: the status, the field name and the constraint code are your published contract; the
message text belongs to Spring and to whatever locale the reader is in; the order belongs to
nobody at all.**

## Testing the contract rather than the framework

The failure mode to avoid is a test that pins Spring's default message. What is worth asserting:

- **the status**, and specifically which 4xx — 400 for a malformed request, 422 if that is what you
  publish for a semantically invalid one;
- **which field failed**, by name, because that is what a client uses to highlight an input;
- **a stable code**, not an interpolated message — `NotBlank`, `Size`, or your own code. Messages
  change with the locale and with a `messages.properties` edit;
  [16 · Message codes](../../phase-9-spring-boot/08-validation/16-message-codes.md) is the argument
  for codes;
- **that all the violated constraints are reported**, if your contract promises that rather than
  the first failure.

⚠️ **Do not assert an order for field errors.** Nothing in Bean Validation or in Spring's binding
result promises a stable ordering of violations across constraints — it follows the order the
provider discovered them in. Assert with a set-like matcher:

```java
assertThat(result).bodyJson()
    .extractingPath("$.errors[*].field").asArray()
    .containsExactlyInAnyOrder("reference", "quantity");
```

## Form controllers: the model is the observable outcome

For a controller that re-renders a form rather than returning JSON, the binding result *is* the
result, and the reference's own example is the right shape:

```java
mockMvc.perform(post("/persons"))
    .andExpect(status().isOk())
    .andExpect(model().attributeHasErrors("person"));
```

with `model().attributeHasFieldErrors("person", "email")` and
`model().attributeHasFieldErrorCode("person", "email", "Email")` for the specific cases. Note the
status: a form validation failure re-renders with **200**, not 400, because nothing was rejected
at the protocol level. Asserting 400 here is a common and confusing mistake.

The AssertJ equivalent is `.model()`, which returns a `ModelAssert`, and `.hasViewName("form")`.
This is the one case where [01b](01b-the-blank-request.md)'s warning about model assertions does
not apply — for a server-rendered form the model is not an internal, it is the output.

## The test that earns its place most

```java
@Test
void an_invalid_body_is_rejected_before_the_service_is_called() {
    assertThat(mvc.post().uri("/orders")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"reference\":\"\",\"quantity\":-1}"))
        .hasStatus(HttpStatus.BAD_REQUEST);

    verifyNoInteractions(orders);
}
```

The second assertion is the valuable one. A missing `@Valid` on the handler parameter compiles,
runs, returns 200 and passes every test that only checks the happy path — and the invalid data
reaches your service. `verifyNoInteractions` on the mocked collaborator proves the request was
rejected at the boundary rather than inside the domain, which is the whole point of validating at
the edge
([01 · Why validate at the edge](../../phase-9-spring-boot/08-validation/01-why-validate-at-the-edge.md)).

## Gotchas

**★ Asserting Spring's default validation message text.**
It is Spring's to change, it is interpolated from a `MessageSource`, and it varies by locale. Pin
the field name and the constraint code instead.

**★ Asserting the order of field errors.**
Violation ordering is not promised by Bean Validation or by Spring's binding result. Use
`containsExactlyInAnyOrder` or assert each field independently.

**★ Expecting 400 from a form controller's validation failure.**
A `BindingResult` parameter means the handler runs and re-renders, so the status is 200 and the
errors are in the model. Only an *unhandled* binding failure produces 400.

**★ Testing validation without proving the service was not called.**
A missing `@Valid` still returns 200 and still calls the service with invalid data.
`verifyNoInteractions(collaborator)` alongside the status assertion is what catches it.

**★ Writing one validation test per constraint on a large DTO.**
Twelve near-identical tests that all assert 400. A parameterized test over (payload, expected
field, expected code) says the same thing once —
[04 · @MethodSource](../03-parameterized-tests/04-methodsource.md).

**★ Testing validation through the controller when the rule is a domain invariant.**
If the rule is "an order cannot exceed the customer's credit limit", it is not a bean constraint
and a controller test is the wrong place. Validate at the edge for shape; keep invariants in the
domain and test them without HTTP.

## Interview questions

**★ What is wrong with asserting the default message text?**
It is not your contract. Spring owns the wording, it is interpolated through a `MessageSource` so
it changes with locale and with any `messages.properties` edit, and a client cannot rely on it. A
field name and a constraint code are stable and are what a client actually consumes.

**★ How do you prove that `@Valid` is actually wired?**
Post an invalid payload, assert the 4xx, and assert that the mocked collaborator was never
called — `verifyNoInteractions(orders)`. Without the second half, a handler missing its `@Valid`
annotation returns 200 and passes any test that only looks at the happy path, while invalid data
flows into the service.

**★ Why does a form controller return 200 on a validation failure?**
Because a `BindingResult` parameter next to the `@ModelAttribute` tells Spring to hand the errors
to the handler instead of raising an exception, so the handler runs and re-renders the form. The
errors are in the model — `model().attributeHasErrors("person")` — and the status is a perfectly
ordinary 200. A 400 would mean nothing handled the binding failure.

**★ Two of your validation tests assert on `$.errors[0].field` and one of them started failing
after an unrelated change. What is the likely cause?**
Ordering. Nothing promises a stable order for constraint violations, so adding a constraint or
changing a field's declaration can reorder them. Assert with `containsExactlyInAnyOrder` over the
field names, or select the error by field with a JSONPath filter rather than by index.

{/* FOOTER */}
