---
title: "Writing a custom constraint"
sidebar_label: "9 · Custom validators"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Java Bean
> Validation*
> (docs.spring.io/spring-framework/reference/core/validation/beanvalidation.html
> — the `@Constraint` / `ConstraintValidator` pair and
> `SpringConstraintValidatorFactory`, which *"uses Spring to create
> `ConstraintValidator` instances"* so that custom validators *"benefit from
> dependency injection like any other Spring bean"*) and the **Hibernate
> Validator 9.1 reference**, *Creating custom constraints* and *Constraint
> validator implementations*
> (docs.hibernate.org/stable/validator/reference/en-US/html_single/ — including
> that *"the validation of `null` is considered valid by default"*). Spring
> Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**A custom constraint is exactly two artifacts: an annotation that declares it
and a `ConstraintValidator` that decides it. Everything that makes a custom
constraint good rather than merely working is in the small print — the three
mandatory attributes, the obligation to treat `null` as valid, and the fact
that in Spring the validator is a bean and can therefore be injected, which is
both its most useful property and its most abused one.**

## The pair, in full

Nothing here is optional. `message`, `groups` and `payload` are required by the
specification, and omitting one is a compile-time failure at the *use* site,
not the declaration site, which is a confusing way to find out.

```java
@Documented
@Constraint(validatedBy = CurrencyCodeValidator.class)
@Target({ ElementType.FIELD, ElementType.PARAMETER, ElementType.TYPE_USE })
@Retention(RetentionPolicy.RUNTIME)
public @interface CurrencyCode {

    String message() default "{com.example.validation.CurrencyCode.message}";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    /** Restrict to a subset; empty means "any ISO 4217 code". */
    String[] allowed() default {};
}
```

```java
public class CurrencyCodeValidator implements ConstraintValidator<CurrencyCode, String> {

    private Set<String> allowed;

    @Override
    public void initialize(CurrencyCode annotation) {
        this.allowed = annotation.allowed().length == 0
                ? Currency.getAvailableCurrencies().stream()
                        .map(Currency::getCurrencyCode).collect(Collectors.toSet())
                : Set.of(annotation.allowed());
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null) {
            return true;                 // ← let @NotNull decide presence
        }
        return allowed.contains(value);
    }
}
```

**`initialize` runs once per constrained element**, not per validation, and its
job is to turn annotation attributes into whatever form `isValid` needs — a
compiled `Pattern`, a `Set`, a parsed `Duration`. Doing that work inside
`isValid` instead is a per-request cost for no reason.

**`@Target` decides where the annotation may be written.** Include
`TYPE_USE` if you want `List<@CurrencyCode String>` to be legal — it is a
common omission that makes a constraint mysteriously unusable on collection
elements. Include `ANNOTATION_TYPE` if you want the constraint to be composable
into other constraints.

## 🔴 `isValid` must return `true` for `null`

This is the rule that separates a reusable constraint from one that quietly
breaks every optional field it touches. The specification's position is that
*the validation of `null` is considered valid by default*: presence is
`@NotNull`'s single responsibility, and every other constraint answers only
"given a value, is it acceptable?".

A validator that returns `false` for `null` does two damaging things at once.
It makes its own constraint imply `@NotNull`, so `@CurrencyCode String
preferredCurrency` can no longer mean "optional, but valid if given". And it
produces the *wrong message* — the client is told the currency code is invalid
when in fact they omitted it.

```java
// ⛔ broken: this constraint can never be used on an optional field
public boolean isValid(String value, ConstraintValidatorContext ctx) {
    return allowed.contains(value);   // NPE-free, but false for null
}

// ✓ correct
public boolean isValid(String value, ConstraintValidatorContext ctx) {
    return value == null || allowed.contains(value);
}
```

The same rule applies to empty strings, and there the answer is less obvious:
`""` is a *value*, so a strict reading says reject it. In practice, pair the
constraint with `@NotBlank` at the use site rather than baking blankness into
your validator, for the same composability reason.

## Producing a better violation from the validator

The default violation is attached to the annotated element and carries the
annotation's `message`. Sometimes you want a different message per failure
reason, or you want to attach the violation to a specific property. The
`ConstraintValidatorContext` is the mechanism:

```java
@Override
public boolean isValid(String value, ConstraintValidatorContext context) {
    if (value == null) return true;
    if (value.length() != 3) {
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate("{com.example.validation.CurrencyCode.length}")
               .addConstraintViolation();
        return false;
    }
    if (!allowed.contains(value)) {
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate("{com.example.validation.CurrencyCode.unknown}")
               .addConstraintViolation();
        return false;
    }
    return true;
}
```

⚠️ **`disableDefaultConstraintViolation()` is not optional here.** Skip it and
you get *two* violations for one failure: your custom one and the default one
the provider adds because `isValid` returned `false`. That is the most common
bug in hand-written validators after the `null` rule.

Note that the template is a message **key**, not a sentence —
[chunk 12](12-messages-and-interpolation.md) explains why the literal belongs
in a properties file.

## The trade-off

A custom constraint is a small class, a small annotation, a message key and a
test — call it forty lines — to express a rule that is often four lines of Java
in a service. What you buy is placement: it runs at the edge, composes with
every other constraint, reports through the same field-addressed channel, and
is reusable across every entry point that accepts the DTO. What you pay is
indirection: the rule is no longer visible where the object is constructed, and
a reader has to open two more files to learn what `@CurrencyCode` means.

The line worth holding: **write a custom constraint when the rule is about the
shape of a value and will be reused.** A one-off conditional that applies to a
single endpoint is clearer as an explicit check in the service, with a domain
exception, than as an annotation nobody else will ever use.

## Gotchas

**Symptom** · A constraint annotation does not compile at the use site with a
message about missing attributes.
**Cause** · `message()`, `groups()` or `payload()` was omitted from the
annotation declaration; all three are mandatory.
**Fix** · Copy the three-attribute block verbatim into every constraint
annotation.

**Symptom** · A custom constraint on an optional field rejects requests that
simply omit it, with a confusing message.
**Cause** · `isValid` returns `false` for `null`.
**Fix** · `return value == null || …`. Presence is `@NotNull`'s job, and
breaking that rule makes the constraint unusable on any optional field.

**Symptom** · Two violations for one failure, one with your message and one
with the default.
**Cause** · `buildConstraintViolationWithTemplate(...)` without
`disableDefaultConstraintViolation()`.
**Fix** · Call `disableDefaultConstraintViolation()` first, every time you
build a custom violation.

**Symptom** · `List<@MyConstraint String>` will not compile.
**Cause** · The annotation's `@Target` does not include `TYPE_USE`.
**Fix** · Add it. Also add `ANNOTATION_TYPE` if the constraint should be
composable.

**Symptom** · An expensive computation happens on every request.
**Cause** · Pattern compilation or set construction inside `isValid` instead of
`initialize`.
**Fix** · Move it to `initialize`, which runs once per constrained element.

**Symptom** · Constraint violation messages appear as a literal
`{com.example.validation.CurrencyCode.message}` in the response.
**Cause** · The message key has no entry in any resolvable bundle.
**Fix** · Add it to `ValidationMessages.properties` or to the application's
`MessageSource` — [chunk 12](12-messages-and-interpolation.md).

## Interview questions

**★ What are the two pieces of a custom constraint?**
An annotation meta-annotated `@Constraint(validatedBy = …)` with the three
mandatory attributes `message`, `groups` and `payload`, and a
`ConstraintValidator<A, T>` implementation with `initialize(A)` and
`isValid(T, ConstraintValidatorContext)`. The annotation's `@Target` decides
where it may be written — `TYPE_USE` if it should work on collection elements.

**★ Why must `isValid` return `true` for `null`?**
Because presence is `@NotNull`'s single responsibility in this specification,
and every other constraint answers only "given a value, is it acceptable?". A
validator that rejects `null` implies `@NotNull`, so its constraint can never
be used on an optional field, and it produces a misleading message for a value
that was simply not supplied.

**★ What does `initialize` do, and what should not be in `isValid`?**
`initialize` receives the annotation instance and runs once per constrained
element; it is where annotation attributes become the runtime form the check
needs — a compiled pattern, a set, a parsed bound. `isValid` runs per value, so
anything expensive and value-independent that lives there is a per-request cost
for nothing.

**★ How do you emit a custom message from inside a validator?**
`context.disableDefaultConstraintViolation()`, then
`context.buildConstraintViolationWithTemplate("{key}")` and
`.addConstraintViolation()`. The first call is the one people forget, and
skipping it yields two violations for a single failure — yours plus the default
one.

**★ How do you unit-test a custom validator?**
Instantiate it directly, call `initialize` with an annotation instance, and
call `isValid` with the values you care about — including `null`, the empty
string, and the boundary. That is a plain unit test with no container. A
second, thinner test through the actual `Validator` bean is worth having to
confirm the annotation is wired and the message key resolves, but it should not
be where the logic is exercised.

---

← Prev: [Reading the errors](08-reading-the-errors.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Spring-managed validators and composition](10-spring-managed-and-composition.md)
