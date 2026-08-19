---
title: "Cross-field rules"
sidebar_label: "11 · Cross-field rules"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the **Hibernate Validator 9.1 reference** —
> *Class-level constraints*, *Custom property paths* and *Cross-parameter
> constraints* (docs.hibernate.org/stable/validator/reference/en-US/html_single/)
> — and the Spring Framework reference *Java Bean Validation*
> (docs.spring.io/spring-framework/reference/core/validation/beanvalidation.html).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**No field-level constraint can see a second field. "End must not be before
start", "if `channel` is `PARTNER` then `discountCode` is required", "at least
one contact method must be present" — every rule of that shape needs a
validator that receives the *whole object*, which means a class-level
constraint. The mechanism is straightforward; the two things that make it good
rather than merely working are a `null` guard and a property path.**

## A class-level constraint sees the whole object

```java
@Documented
@Constraint(validatedBy = DateRangeValidator.class)
@Target(ElementType.TYPE)                 // ← on the type, not a field
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidDateRange {
    String message() default "{com.example.validation.ValidDateRange.message}";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
```

```java
public class DateRangeValidator implements ConstraintValidator<ValidDateRange, BookingRequest> {

    @Override
    public boolean isValid(BookingRequest value, ConstraintValidatorContext context) {
        if (value == null || value.start() == null || value.end() == null) {
            return true;                  // ← @NotNull reports the missing parts
        }
        if (!value.end().isBefore(value.start())) {
            return true;
        }
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate("{com.example.validation.ValidDateRange.message}")
               .addPropertyNode("end")    // ← attach the error to a real field
               .addConstraintViolation();
        return false;
    }
}

@ValidDateRange
public record BookingRequest(@NotNull LocalDate start, @NotNull LocalDate end) { }
```

Three details carry the weight.

**The `null` guard is not defensive coding, it is correctness.** All
constraints are evaluated, so without the guard a request that omits `end`
produces *both* "must not be null" and "end must not be before start" — and the
second is nonsense the client cannot act on. A cross-field validator should
return `true` whenever the fields it compares are absent and let the field
constraints report absence.

**`addPropertyNode("end")` is what makes the error usable.** Without it the
violation has an empty property path and arrives as a *global* error with no
field attached — which a client cannot map onto a form, and which a handler
reading only `getFieldErrors()` will drop entirely
([chunk 8](08-reading-the-errors.md)).

**The second type parameter is the DTO**, so the validator is bound to that
one type. A generic "these two properties must be ordered" constraint is
possible via reflection over property names given as annotation attributes, and
it trades type-safety and clarity for reuse — worth it only if you genuinely
have several such pairs.

## The conditional-requirement shape

The other cross-field rule people meet is conditional presence, and it is the
one that makes a good argument for a class-level constraint over any
alternative:

```java
public class PartnerDiscountValidator
        implements ConstraintValidator<PartnerDiscountRequired, OrderRequest> {

    @Override
    public boolean isValid(OrderRequest value, ConstraintValidatorContext context) {
        if (value == null || value.channel() != Channel.PARTNER) {
            return true;                            // rule does not apply
        }
        if (value.discountCode() != null && !value.discountCode().isBlank()) {
            return true;
        }
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate("{order.discountCode.requiredForPartner}")
               .addPropertyNode("discountCode")
               .addConstraintViolation();
        return false;
    }
}
```

The pattern is always the same three steps: **decide whether the rule applies,
decide whether it is satisfied, and attach the violation to the field the user
must change.**

## The lightweight alternative: `@AssertTrue` on a derived getter

Because a constraint may sit on a property, a computed getter is a legitimate
cross-field check with no custom annotation at all:

```java
public record Booking(@NotNull LocalDate start, @NotNull LocalDate end) {

    @AssertTrue(message = "{booking.range.ordered}")
    public boolean isRangeOrdered() {
        return start == null || end == null || !end.isBefore(start);
    }
}
```

The `null` guards are there for the same reason as above. The catch is the
**property path**: the violation is reported against `rangeOrdered`, a property
the client has never heard of and cannot correct. Use this for small internal
DTOs; for a public API, the class-level constraint that can name `end` is worth
the extra file.

## Cross-parameter constraints exist too

The same problem appears at the method level — "these two *parameters* must
agree" — and Bean Validation covers it with **cross-parameter constraints**: a
constraint annotation targeting a method, whose validator receives an
`Object[]` of the arguments, declared with
`@SupportedValidationTarget(ValidationTarget.PARAMETERS)`.

It is worth knowing the mechanism exists and worth thinking twice before using
it: the validator loses all type-safety (it is handed an array), the argument
order becomes part of the contract, and the resulting violation is attached to
the method rather than to anything a caller can name. Binding the parameters
into a small command object and using an ordinary class-level constraint is
almost always clearer — the same conclusion as
[chunk 6](06-collections-parts-parameters.md) reached about repeated query
parameters.

## The trade-off

A class-level constraint is a file, a validator, a message key and a test — for
a rule that is often two lines in the service. What you buy is that the rule
runs at the edge, is reported through the same field-addressed channel as
everything else, and travels with the DTO to every entry point that accepts it.
What you pay is that a reader of the record sees `@ValidDateRange` and has to
open two files to learn what it means, and that the rule now lives away from
the code that depends on it.

**The honest boundary:** if the rule is about the *request being coherent*, it
belongs here. If it is about the *system's state* — the dates being free, the
partner being active, the code being redeemable — it is a business rule, it
needs the database, and it belongs in the service with a domain exception, per
[chunk 1](01-why-validate-at-the-edge.md). Conditional-requirement rules sit
right on that line, and the test is whether the condition can be evaluated from
the request alone.

## Gotchas

**Symptom** · A cross-field message appears alongside a "must not be null"
message and reads as nonsense.
**Cause** · The class-level validator did not guard against `null` fields, and
all constraints are evaluated regardless of each other.
**Fix** · Return `true` from the class-level validator whenever the fields it
compares are absent.

**Symptom** · A cross-field error has no field attached, and the client cannot
show it next to an input.
**Cause** · No `addPropertyNode(...)`, so the violation is a global/object
error.
**Fix** · `disableDefaultConstraintViolation()` then
`buildConstraintViolationWithTemplate(...).addPropertyNode("end").addConstraintViolation()`.

**Symptom** · A handler shows nothing for a request that clearly failed a
cross-field rule.
**Cause** · The handler reads only `getFieldErrors()`, and the violation is an
`ObjectError`.
**Fix** · Read global errors too — and attach the violation to a property, as
above. Doing both is the robust answer.

**Symptom** · A class-level constraint never fires.
**Cause** · Its `@Target` is not `ElementType.TYPE`, or it was placed on a
field.
**Fix** · `@Target(ElementType.TYPE)`, annotating the class or record
declaration.

**Symptom** · Two violations for one cross-field failure.
**Cause** · `buildConstraintViolationWithTemplate` without
`disableDefaultConstraintViolation()` — the same trap as any custom validator.
**Fix** · Disable the default first.

**Symptom** · An `@AssertTrue` cross-field check reports against a property
name that is not part of the API.
**Cause** · The violation path is the getter's property name.
**Fix** · Move to a class-level constraint with `addPropertyNode`, or accept it
for internal-only DTOs.

**Symptom** · A conditional rule fires for requests it should not apply to.
**Cause** · The "does the rule apply" test and the "is it satisfied" test were
collapsed into one boolean expression.
**Fix** · Write them as two separate early returns; it is also the shape that
makes the validator readable.

**Symptom** · A cross-parameter constraint's violation cannot be mapped to a
parameter in the error response.
**Cause** · It is attached to the method, and the argument array carries no
names.
**Fix** · Bind the parameters into a command object and use a class-level
constraint on it.

## Interview questions

**★ How do you validate that one field is consistent with another?**
With a class-level constraint: an annotation targeting `ElementType.TYPE` and a
`ConstraintValidator` whose second type parameter is the DTO itself, so
`isValid` receives the whole object. Guard against `null` fields so the
cross-field message does not pile on top of `@NotNull`, and use
`addPropertyNode` to attach the violation to a real field rather than leaving
it as a global error.

**★ Why does a cross-field violation often arrive with no field name?**
Because a class-level constraint's default violation is attached to the class,
producing an `ObjectError` with an empty property path. Handlers that read only
field errors drop it entirely. Building the violation explicitly with
`addPropertyNode("end")` gives it a path the client can act on.

**★ Why must a cross-field validator tolerate `null` fields?**
Because every constraint is evaluated independently — nothing stops the
cross-field check because `@NotNull` already failed. Without a guard, omitting
one date produces both "must not be null" and a comparison message derived from
a missing value, which is at best noise and at worst a false statement about
the request.

**★ How would you express "discountCode is required only when channel is
PARTNER"?**
A class-level constraint whose validator returns `true` when the channel is not
`PARTNER`, checks presence when it is, and attaches the violation to
`discountCode`. No field-level annotation can express it, because the decision
needs a second field. The three-step shape — does the rule apply, is it
satisfied, where does the error go — generalises to every conditional
requirement.

**★ Can you do cross-field validation without writing an annotation?**
Yes — `@AssertTrue` on a derived getter, guarded so it returns `true` when the
compared fields are absent. It is a real technique with one real weakness: the
violation's property path is the getter's name, which is not part of your API
contract. Fine for internal DTOs, poor for a public one.

**★ What are cross-parameter constraints, and would you use one?**
They are constraints declared on a *method*, whose validator is annotated
`@SupportedValidationTarget(ValidationTarget.PARAMETERS)` and receives the
arguments as an `Object[]` — the method-level analogue of a class-level
constraint. They work, and they cost type-safety, make argument order part of
the contract, and produce a violation attached to the method rather than to
anything the caller can name. Binding the parameters into a command object is
usually the better answer.

**★ When does a cross-field rule stop being validation?**
When answering it requires anything beyond the request. "End is not before
start" is coherence and belongs at the edge. "The room is free for those dates"
is state, needs the database, can change between the check and the write, and
belongs in the service as a business rule with its own exception and its own
status code.

---

← Prev: [Beans and composition](10-spring-managed-and-composition.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Validation groups](12-validation-groups.md)
