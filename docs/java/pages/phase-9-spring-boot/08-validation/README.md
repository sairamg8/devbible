---
title: "Validation"
sidebar_label: "08 · Validation"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework reference — *Validation,
> Data Binding, and Type Conversion*, *Java Bean Validation* and *Customizing
> Validation Errors*
> (docs.spring.io/spring-framework/reference/core/validation/) — the Spring Boot
> reference *Validation* (docs.spring.io/spring-boot/reference/io/validation.html)
> and *Application Properties* appendix, the `LocalValidatorFactoryBean` and
> `DefaultMessageCodesResolver` javadoc
> (docs.spring.io/spring-framework/docs/7.0.8/javadoc-api/), and the Hibernate
> Validator 9.1 reference and javadoc (docs.hibernate.org/validator/9.1/).
> Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Bean Validation is an allowlist you have to write, and everything difficult
about it follows from that one property. A field with no annotation is accepted
whatever it contains; a missing `@Valid` accepts the whole object; a constraint
on the wrong side of a cascade does nothing; an unresolved message key renders
as a brace-wrapped identifier. None of those throws, none of them logs, and none
of them fails a happy-path test. This topic is mostly about the failures that
look like success — which is also why it insists on the line between a
*constraint* (answerable from the object alone) and a *business rule* (which
needs the database, and is not validation at all).**

This topic runs to seventeen files. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Why validation belongs at the edge](01-why-validate-at-the-edge.md)** | The three different things called "invalid", why a constraint is not a business rule, DTO constraints versus domain invariants, and the honest costs of going declarative |
| 2 | **[The starter and the built-in catalogue](02-the-constraints.md)** | 🔴 Boot 4 no longer pulls validation in transitively; what `spring-boot-starter-validation` actually gives you, and every built-in constraint with the types it accepts |
| 3 | **[Null, empty and blank](03-null-empty-blank.md)** | The rule that almost every constraint treats `null` as valid, `@NotNull` vs `@NotEmpty` vs `@NotBlank` exactly, primitives that cannot be absent, and why constraints do not chain |
| 4 | **[Text, containers and placement](04-text-containers-placement.md)** | `@Email` being far weaker than its name, `@Pattern` matching the whole input, nothing being normalised before validation, container-element constraints, and where an annotation may legally sit |
| 5 | **[`@Valid` at the controller boundary](05-valid-at-the-boundary.md)** | The three conditions under which validation silently does not run, `@Valid` versus `@Validated`, and why nested objects do not validate themselves |
| 6 | **[Collections, parts and scalar inputs](06-collections-parts-parameters.md)** | Validating a list body, `@Valid @RequestPart`, and constraints on path variables and query parameters — which take a different path entirely |
| 7 | **[Which exception you get, and why](07-the-failure.md)** | `MethodArgumentNotValidException` vs `HandlerMethodValidationException` vs `ConstraintViolationException`, the decision table, and the signature that returns 200 with bad data |
| 8 | **[Reading the errors](08-reading-the-errors.md)** | `BindingResult`, `FieldError`, `getCodes()`, `ParameterValidationResult`, and how much of a violation is safe to hand back |
| 9 | **[Writing a custom constraint](09-custom-validators.md)** | The annotation/validator pair in full, the `null` rule that keeps composition working, and producing a better violation from inside `isValid` |
| 10 | **[Spring-managed validators and composition](10-spring-managed-and-composition.md)** | Validators are container-created beans; injecting a repository works and is usually wrong; composing constraints and what `@ReportAsSingleViolation` costs |
| 11 | **[Cross-field rules](11-cross-field-rules.md)** | The class-level constraint that sees the whole object, the conditional-requirement shape, `@AssertTrue` on a derived getter, and cross-parameter constraints |
| 12 | **[Validation groups](12-validation-groups.md)** | The mechanism, the `Default` trap, `@GroupSequence` ordering, why groups do not cross a cascade, and why two DTOs usually win |
| 13 | **[Validation beyond the controller](13-beyond-the-controller.md)** | `@Validated` on a service, what being AOP-based costs, `@ConfigurationProperties` failing at startup, and programmatic validation |
| 14 | **[Where a constraint message comes from](14-messages-and-interpolation.md)** | Two separate message systems; the default message is a *key*; the four-step interpolation order; escaping; `${validatedValue}` and the formatter |
| 15 | **[Wiring the validator to Spring's `MessageSource`](15-wiring-the-message-source.md)** | `setValidationMessageSource`, the `useCodeAsDefaultMessage` trap that breaks every default message, the `spring.messages.*` group, and fail-fast |
| 16 | **[Message codes](16-message-codes.md)** | The four codes on an adapted `FieldError`, the field-name/**max**/**min** argument-order trap, relabelling the argument rather than the field, and indexed versus whole-collection codes |
| 17 | **[The expression language, and what a message may say](17-message-safety.md)** | The four EL feature levels, why the default is `BEAN_PROPERTIES` for messages and `NONE` for custom violations, and the three rules for message content |

## Why this runs to seventeen files

- **The topic's central bug is silence, and silence has to be taught case by
  case.** There is no single "validation does not run" chunk, because there are
  at least five independent ways it does not run: no annotation on the field
  (chunk 3), no `@Valid` on the parameter (chunk 5), an `Errors` parameter
  swallowing the failure (chunk 7), no cascade into a nested object (chunk 5),
  and a group that excludes the constraint you were counting on (chunk 12). Each
  has a different cause and a different fix, and a reader who has only seen one
  of them will misdiagnose the other four.
- **"Which exception" and "reading the exception" are genuinely two topics.**
  Chunk 7 is about *why the signature you wrote decides the failure type* —
  three exceptions, two mechanisms, one of which returns 200. Chunk 8 is about
  the error objects themselves. Merging them buries the decision table under the
  API surface.
- **Custom constraints split four ways because the hard parts are not the
  syntax.** The annotation/validator pair is half a page (chunk 9). What takes
  the other three chunks is the `null` contract, the container's role in
  creating the validator, cross-field rules needing a class-level constraint with
  `addPropertyNode`, and groups — the parts that are wrong in most codebases.
- **🔴 Messages are four chunks because they are two systems that look like
  one.** Constraint interpolation reads `ValidationMessages.properties` and uses
  `{min}`/`${...}`; message codes read `messages.properties` and use
  `{0}`/`{1}`. Nearly every "I put the text in a properties file and nothing
  changed" report is somebody editing the bundle the other machine reads, and
  that confusion cannot be cleared up in a paragraph appended to another chunk.
- **Message *safety* earns its own file because the default is the lesson.**
  Hibernate Validator turns its expression engine off for custom violations and
  leaves it on for constraint messages, and the reason for that asymmetry —
  runtime-built templates carry user input, source literals do not — is the
  single most transferable idea in the topic. It also happens to be where the
  "never echo the rejected value" rule belongs, which is a wording decision with
  security consequences rather than a formatting preference.
- **Validation outside the controller is a different mechanism, not an
  extension.** Chunk 13 is AOP proxies, self-invocation, startup-time
  `@ConfigurationProperties` failures and programmatic `Validator` use. Filing it
  as a footnote to the controller chunks would teach the proxy limitation as
  trivia, when it is the reason a service-layer `@Validated` silently does
  nothing.

## Where this connects

- **[Topic 07 — REST controllers](../07-rest-controllers/README.md)** — `@Valid`
  sits on the `@RequestBody` parameter that
  [binding the body](../07-rest-controllers/04-binding-the-body.md) describes,
  and validation runs *after* Jackson has already built the object; a malformed
  document never reaches it.
- **[Records as DTOs](../07-rest-controllers/05-records-as-dtos.md)** and
  **[the absent field](../07-rest-controllers/06-the-absent-field.md)** — why the
  wire type takes `Integer` rather than `int`, which is what makes `@NotNull`
  meaningful at all.
- **[Topic 09 — Error handling](../09-error-handling/01-the-error-shape-is-a-contract.md)**
  — this topic produces the violations; that one decides the single error body
  every failure returns. The boundary is sharp: constraint messages are the
  *contents*, and
  [`ProblemDetail` and its own message codes](../09-error-handling/09-message-codes-and-i18n.md)
  are the *envelope*.
- **[What must never reach the client](../09-error-handling/13-never-reaches-the-client.md)**
  — the leak rules in chunk 17 are the validation-shaped case of that page.
- **[Topic 05 — Auto-configuration](../05-auto-configuration/04-bean-conditions-and-back-off.md)**
  — Boot's validator is a conditional bean, so declaring your own
  `LocalValidatorFactoryBean` (chunk 15) is ordinary back-off, not a special case.
- **[Topic 06 — Constructor binding and validation](../06-configuration-and-profiles/05-constructor-binding-and-validation.md)**
  and **[defaults and validation](../06-configuration-and-profiles/06-defaults-and-validation.md)**
  — the same annotations applied to `@ConfigurationProperties`, where the failure
  is a refused startup rather than a 400.
- **[Records](../../phase-2-classes-objects/08-records/README.md)** and
  **[immutable design](../../phase-2-classes-objects/12-immutable-design/README.md)**
  — the compact-constructor invariants chunk 1 contrasts with edge constraints.
- **[Custom exceptions and translation](../../phase-5-exceptions/04-custom-exceptions-translation.md)**
  — where a business rule that is *not* a constraint belongs, and how its failure
  becomes a status code.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Why validation belongs at the edge](01-why-validate-at-the-edge.md)
