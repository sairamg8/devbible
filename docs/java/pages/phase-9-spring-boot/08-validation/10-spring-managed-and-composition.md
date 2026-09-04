---
title: "Spring-managed validators, and composing constraints"
sidebar_label: "10 · Beans and composition"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Java Bean
> Validation*
> (docs.spring.io/spring-framework/reference/core/validation/beanvalidation.html
> — `SpringConstraintValidatorFactory`, which *"uses Spring to create
> `ConstraintValidator` instances"* so custom validators *"benefit from
> dependency injection like any other Spring bean"*) and the **Hibernate
> Validator 9.1 reference**, *Constraint composition* and *Creating custom
> constraints* (docs.hibernate.org/stable/validator/reference/en-US/html_single/).
> Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**A `ConstraintValidator` in a Spring application is a Spring bean, which means
it can be injected into — and that single fact is simultaneously the most
useful and the most misused thing about custom constraints. Composition is the
quieter feature and the one more codebases should use: it lets a recurring
combination of built-in constraints become one named annotation with no
validator at all.**

## Validators are created by the container

Spring installs a `SpringConstraintValidatorFactory`, so validator instances
are created through the `ApplicationContext`. Constructor injection works
exactly as it does anywhere else:

```java
@Component
public class SupportedLocaleValidator implements ConstraintValidator<SupportedLocale, String> {

    private final LocaleProperties properties;      // an @ConfigurationProperties bean

    public SupportedLocaleValidator(LocaleProperties properties) {
        this.properties = properties;
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        return value == null || properties.supported().contains(value);
    }
}
```

This is a good fit for **configuration-driven** constraints: a list of
supported locales, a tenant limit, a feature-flagged rule. The rule then lives
in configuration and changes with a profile rather than a release — see
[configuration and profiles](../06-configuration-and-profiles/01-the-environment-and-precedence.md).
The `@Component` is not strictly required for the factory to build the
instance, but declaring it makes the dependency explicit and keeps component
scanning honest; see
[the stereotypes](../02-the-ioc-container/06-the-stereotypes.md).

⚠️ **One instance serves every request, so `isValid` must be thread-safe.**
Validator instances are created per constrained element and reused; mutable
state on a validator field is shared across concurrent requests. Anything
computed in `initialize` must be effectively immutable afterwards — a `Set.of`,
a compiled `Pattern` (which is thread-safe), a parsed bound. A `Matcher` field,
a `SimpleDateFormat` field or a mutable counter is a data race, for the same
reasons as any other singleton
([singletons and statelessness](../04-bean-scopes-lifecycle/01-singleton-and-statelessness.md)).

## Injecting a repository: it works, and it is usually wrong

```java
// ⚠️ compiles, runs, and is the wrong shape for four separate reasons
public class UniqueEmailValidator implements ConstraintValidator<UniqueEmail, String> {
    private final UserRepository users;
    ...
    public boolean isValid(String value, ConstraintValidatorContext ctx) {
        return value == null || !users.existsByEmail(value);
    }
}
```

1. **Time-of-check to time-of-use.** Nothing holds a lock between the read and
   the eventual write, so the check can pass and the insert still fail. The
   race is small and it is real, and it is exactly the case that shows up under
   load or under a double-clicking user.
2. **It runs outside your transaction.** Validation happens during argument
   resolution at the web layer, before any `@Transactional` service method is
   entered, so the read gets its own connection and its own snapshot.
3. **It runs per element.** `List<@ExistingSku String>` with 500 entries is 500
   queries, and nothing warns you — the loop is inside the provider.
4. **It relocates a business rule.** "Does this entity exist" is the third
   category from [chunk 1](01-why-validate-at-the-edge.md), and putting it in
   an annotation buries a database dependency inside what reads like a shape
   check.

**What to do instead.** Keep the database's unique index or foreign key as the
actual enforcement, translate its failure into a proper response, and — if you
want the friendlier early error — do the lookup in the service where it can be
one query for the whole batch and can share the transaction. The validator
version is defensible only as a non-authoritative hint, and it must never be
the only thing standing between a duplicate and the table.

## Composing constraints

An annotation may itself be annotated with constraints, which names a recurring
combination once:

```java
@NotBlank
@Size(max = 32)
@Pattern(regexp = "[A-Z]{2}-[0-9]{4,10}")
@Documented
@Constraint(validatedBy = {})                    // no validator of its own
@Target({ ElementType.FIELD, ElementType.PARAMETER, ElementType.TYPE_USE })
@Retention(RetentionPolicy.RUNTIME)
@ReportAsSingleViolation
public @interface OrderReference {
    String message() default "{com.example.validation.OrderReference.message}";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
```

Three things are doing work here.

- **`@Constraint(validatedBy = {})`** declares this an official constraint with
  no validator of its own; the composed annotations do everything.
- **`@ReportAsSingleViolation`** collapses their failures into one violation
  carrying *this* annotation's message. Without it, one bad reference can
  report three violations for one field — accurate, and usually worse for a
  client than a single "not a valid order reference".
- **The `@Target` list** must be at least as wide as the places you intend to
  use it, and `TYPE_USE` is what makes `List<@OrderReference String>` legal.

Composition is underused. It is the cheapest way to stop the same
`@NotBlank @Size(max = 32) @Pattern(...)` triple from being copied — slightly
differently each time — onto nine DTOs.

## The trade-off

**Injection** buys you constraints that read configuration and constraints that
can consult the world; it costs you a validator that is no longer a pure
function, cannot be unit-tested without stubbing, and can perform I/O in a
place where nobody expects I/O. The discipline that keeps it sane: **injected
state is fine, injected I/O is not.**

**Composition** buys a single name for a recurring rule and one place to change
it; it costs a layer of indirection — a reader now has to open the annotation
to learn what it means — and `@ReportAsSingleViolation` deliberately discards
detail that might have helped somebody debug. Neither cost is large, which is
why composition is usually worth it and injection usually needs an argument.

## Gotchas

**Symptom** · A validator's injected dependency is `null`.
**Cause** · The validator was instantiated outside Spring — a hand-built
`ValidatorFactory`, or a test calling
`Validation.buildDefaultValidatorFactory()`, neither of which uses the
`SpringConstraintValidatorFactory`.
**Fix** · Obtain the `Validator` from the context
(`LocalValidatorFactoryBean`), or construct the validator yourself in a unit
test and call `initialize`/`isValid` directly.

**Symptom** · Intermittent, unreproducible validation results under load.
**Cause** · Mutable state on a validator field — a `Matcher`, a formatter, a
cached "last value" — shared across concurrent requests by a single instance.
**Fix** · Make everything set in `initialize` immutable and keep `isValid`
free of instance-level writes.

**Symptom** · A batch endpoint with a database-backed constraint becomes
extremely slow.
**Cause** · One query per container element, inside the provider's loop.
**Fix** · Move the existence check into the service, as a single query over all
identifiers.

**Symptom** · A uniqueness constraint passes and the insert then fails with a
database error.
**Cause** · Time-of-check to time-of-use.
**Fix** · Keep the index as the enforcement and translate its failure; the
validator is a hint, not a control.

**Symptom** · A validator's database read sees data the calling transaction has
not committed, or misses data it has written.
**Cause** · Validation runs before the service transaction begins, on its own
connection.
**Fix** · Do the check inside the transactional service method if it must be
consistent with it.

**Symptom** · A composed constraint reports three violations for one field.
**Cause** · No `@ReportAsSingleViolation`.
**Fix** · Add it if a single message is what the client should see — and leave
it off deliberately if the individual reasons are more useful.

**Symptom** · A composed annotation cannot be applied to a list element.
**Cause** · `TYPE_USE` missing from its `@Target`.
**Fix** · Add it to the composing annotation; the composed constraints' own
targets do not widen it.

## Interview questions

**★ Can a `ConstraintValidator` have dependencies injected?**
Yes. Spring registers a `SpringConstraintValidatorFactory`, so validator
instances are created through the container and constructor injection works
like any other bean. That makes configuration-driven constraints easy — the
rule comes from `@ConfigurationProperties` rather than from an annotation
attribute.

**★ What must be true of a validator's state?**
It must be thread-safe. One instance is reused for a constrained element across
every concurrent request, so whatever `initialize` computes must be effectively
immutable afterwards. A `Pattern` field is fine; a `Matcher`, a
`SimpleDateFormat` or any mutable accumulator is a race.

**★ You are asked to write `@UniqueEmail` that checks the users table. What do
you say?**
That it can be built and must not be the enforcement. It runs at the web layer
outside any transaction, so a duplicate can appear between the check and the
insert; on a batch it becomes one query per element; and it relocates a
business rule into the boundary. The unique index is the guarantee, its
violation has to be translated anyway, and at that point the annotation is a
nicety rather than a control.

**★ Where is the line on injecting things into validators?**
Injected **state** — configuration, a static lookup table, a clock — is fine
and often the point. Injected **I/O** — repositories, HTTP clients — is where
it goes wrong, because validation happens outside your transaction, once per
element, in a layer whose job is to check shape. If a rule needs the database,
it is a business rule and belongs in the service.

**★ What is constraint composition, and when would you reach for it?**
Annotating a constraint annotation with other constraints, with
`@Constraint(validatedBy = {})` so the composed parts do all the work. Reach
for it the second time you write the same `@NotBlank @Size @Pattern` triple —
it gives the rule a name, one definition and one message, and stops the copies
from drifting apart.

**★ What does `@ReportAsSingleViolation` change, and what does it cost?**
It collapses the composed constraints' failures into one violation carrying the
composing annotation's message. The client gets a single clear "not a valid
order reference" instead of three overlapping messages; the developer loses the
information about *which* part failed. It is a genuine trade and worth making
explicitly rather than by default.

---

← Prev: [Custom validators](09-custom-validators.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Cross-field rules](11-cross-field-rules.md)
