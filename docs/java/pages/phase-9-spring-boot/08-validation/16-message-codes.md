---
title: "Message codes: rewording one field without touching the constraint"
sidebar_label: "16 · Message codes"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework reference *Java Bean
> Validation → Customizing Validation Errors*
> (docs.spring.io/spring-framework/reference/core/validation/beanvalidation.html
> — the adapted-`FieldError` example, its four error codes and its message
> arguments) and the `DefaultMessageCodesResolver` javadoc
> (docs.spring.io/spring-framework/docs/7.0.8/javadoc-api/org/springframework/validation/DefaultMessageCodesResolver.html).
> Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**The second message system does not interpolate anything. It hands Spring a
*list of codes*, most-specific first, and lets a `MessageSource` pick the first
one it recognises. That is what makes it more powerful than the constraint's own
`message` attribute: you can reword one field on one object, or every field of a
type, or every occurrence of a constraint, without editing a single annotation —
and the field label itself is separately resolvable, which is the supported way
to stop your column names appearing in customer-facing copy.**

## An adapted violation becomes a `FieldError` with four codes

When a `ConstraintViolation` is adapted into Spring's `Errors` model — which is
what `@Valid @RequestBody` produces, and what method validation produces once
`setAdaptConstraintViolations(true)` is on
([chunk 13](13-beyond-the-controller.md)) — the reference documents the result
precisely. For a `@Size(min = 1, max = 10)` violation on `Person.name()`:

> *"Error codes `"Size.person.name"`, `"Size.name"`, `"Size.java.lang.String"`,
> and `"Size"`; message arguments `"name"`, `10`, and `1` (the field name and
> the constraint attributes); default message "size must be between 1 and 10"."*

So the properties file that rewords it is two lines:

```properties
# messages.properties
Size.person.name=Please, provide a {0} that is between {2} and {1} characters long
person.name=username
```

Both lines are worth slowing down for.

🔴 **The argument order is field name, then MAX, then MIN.** `{1}` is `10` and
`{2}` is `1`. It reads backwards, it is the order the reference documents, and
writing `between {1} and {2}` produces the confidently wrong sentence *"between
10 and 1"* — which no test catches, because tests assert that validation failed
on the right field, not that the English is right.

🔴 **The message argument is itself resolvable.** The reference notes that
*"the message argument `"name"` is itself a `MessageSourceResolvable` with error
codes `"person.name"` and `"name"` and can be customized too"*. That is why the
second line exists, and it is the real answer to "our error messages leak our
schema": rename the **argument**, not the field. `person.name=username` relabels
it everywhere a message interpolates `{0}`, and the wire contract is untouched.

## How the codes are built

The list comes from `DefaultMessageCodesResolver`, and the rules are the whole
reason this system beats per-annotation `message` attributes.

For a field error, four codes in order:

1. `code + "." + objectName + "." + field` — `Size.person.name`
2. `code + "." + field` — `Size.name`
3. `code + "." + fieldType` — `Size.java.lang.String`
4. `code` — `Size`

The javadoc's own framing of what that buys is a message *"at the object + field
level"*, *"at the field level (all `age` fields, no matter which object name)"*,
or *"at the general level (all fields, on any object)"*. Object-level errors get
two codes, `code + "." + objectName` and then `code`.

**Collections and arrays are resolved both indexed and whole.** For a field
`name` inside an array `groups` on object `user`, the javadoc lists
`typeMismatch.user.groups[0].name`, then `typeMismatch.user.groups.name`, then
`typeMismatch.groups[0].name`, `typeMismatch.groups.name`, `typeMismatch.name`,
`typeMismatch.java.lang.String`, `typeMismatch`. The practical consequence is
the point: you can word a message for *every* element of a collection without
writing one key per index — which you could not do anyway, because you do not
know the indexes in advance.

The default concatenation is `Format.PREFIX_ERROR_CODE` — *"by default the
`errorCode`s will be placed at the beginning of constructed message strings"*.
`Format.POSTFIX_ERROR_CODE` puts the code at the end and exists for legacy
bundles; there is no reason to pick it for a new application.

## Reading the codes rather than guessing them

The object name in code 1 is the one **Spring** derived, not the one you would
have chosen. For a body parameter it is normally the decapitalised type name, so
a `CreateOrderRequest` produces `Size.createOrderRequest.customerName`, not
`Size.order.customerName`. Guessing here wastes an afternoon, and there is no
need to: `FieldError.getCodes()` returns the exact list
([chunk 8](08-reading-the-errors.md)), so log it once in a test and key on what
you see.

## Where this hands off

Constraint messages are the *contents* of an error. The *envelope* — the
`ProblemDetail`, its `title` and `detail`, and their own entirely separate
`problemDetail.title.[FQCN]` scheme resolved by
`ResponseEntityExceptionHandler` — belongs to
[topic 09, chunk 9](../09-error-handling/09-message-codes-and-i18n.md). The two
look alike and are not: that one localises the *exception*, this one localises
the *field*. Confusing them is a common reason an override appears to be
ignored.

## The trade-off

Message codes are the most flexible reworder in the framework and they pay for
it in indirection. A key like `Size.person.name` names an object and a field
that exist only in a compiled class, so a rename silently orphans the entry and
the default English quietly comes back — no error, no warning, no failing test.
There is also a real ceiling: codes reword, they do not restructure. A message
that needs a value the constraint never supplied, or a different shape of error
entirely, is a handler's job rather than a bundle's. The mitigation for both is
the same and it is boring: keep the override set small, and assert the rendered
text for the handful of fields whose wording anybody actually cares about.

## Gotchas

**Symptom** · The reworded message reads *"between 10 and 1"*.
**Cause** · The documented argument order is field name, **max**, **min** — so
`{1}` is the maximum.
**Fix** · `Please, provide a {0} that is between {2} and {1} characters long`.

**Symptom** · `Size.person.name` in `messages.properties` does nothing for a
`@Valid @RequestBody` failure.
**Cause** · The object name is Spring's, and for a body parameter it is usually
the decapitalised type name — `createOrderRequest`.
**Fix** · Read the real codes off the `FieldError` with `getCodes()` and key on
those.

**Symptom** · A method-validation failure ignores every message code.
**Cause** · Without `setAdaptConstraintViolations(true)` the failure is a raw
`ConstraintViolationException`, which carries no `FieldError` and therefore no
codes at all.
**Fix** · Configure the post-processor as in
[chunk 13](13-beyond-the-controller.md), or handle that exception explicitly.

**Symptom** · `{0}` renders as the raw field name rather than the friendly label
that was configured.
**Cause** · The `person.name=username` entry is missing, misspelled, or sitting
in a bundle the `MessageSource` does not read.
**Fix** · Add it to the same bundle. The argument resolves `person.name` then
`name`, so a bare `name=username` is a coarser fallback that covers every
object.

**Symptom** · A collection field's message can be reworded for element `[0]` and
for nothing else.
**Cause** · Someone keyed on the indexed code.
**Fix** · Use the non-indexed form — `typeMismatch.user.groups.name` — which the
resolver generates for exactly this case.

**Symptom** · A message key that worked stops working after a DTO or field
rename.
**Cause** · The code embeds both the object name and the field name.
**Fix** · Nothing prevents it. Keep the override set small and cover the
important ones with a test that asserts the rendered text, since the failure is
otherwise silent.

## Interview questions

**★ What are message codes, and how do they differ from the constraint's own
`message` attribute?**
The `message` attribute is a template the *provider* interpolates against
`ValidationMessages.properties`. Message codes are a list Spring attaches to an
adapted `FieldError` — `Size.person.name`, `Size.name`, `Size.java.lang.String`,
`Size` — which a `MessageSource` resolves most-specific-first against
`messages.properties`. The first lets you word a constraint; the second lets you
word one field of one object without touching the constraint at all.

**★ Why four codes rather than one?**
So one mechanism serves four granularities: this field on this object, this
field name anywhere, any field of this type, and every occurrence of the
constraint. You write the general entry once and override only the places that
need special wording, instead of annotating every field individually.

**★ What is the trap in the documented message arguments?**
The order is field name, maximum, minimum — so a message written as *"between
{1} and {2}"* renders the bounds backwards. It is a copywriting bug no
validation test catches, because the request still fails with the right code on
the right field; only a reader notices.

**★ How do you stop an internal field name appearing in customer-facing copy?**
Not by renaming the DTO field. The message argument is itself a
`MessageSourceResolvable` with codes `person.name` and `name`, so adding
`person.name=username` relabels it everywhere that message interpolates `{0}`,
while the wire contract stays exactly as clients already consume it.

**★ How would you find the right key for a field that is refusing to be
reworded?**
Read `FieldError.getCodes()` rather than deriving the object name from the class
name. The list Spring actually generated is authoritative, it is available in a
test in two lines, and the object name is the part people guess wrong.

**★ How are collection elements handled?**
The resolver emits both indexed and non-indexed codes — `groups[0].name` and
`groups.name` — precisely so a message can be written once for all elements. If
you key on the indexed form you have written a message for element zero and
nothing else.

**★ What can message codes *not* do?**
Restructure the error. They choose wording for a violation that already exists,
with the arguments that violation already carries. Adding a machine-readable
code per violation, changing the status, or emitting a different error shape are
all handler concerns, which is topic 09's territory rather than this one's.

**★ Where does message customisation stop being validation's problem?**
At the envelope. The `ProblemDetail`'s own `title`, `detail` and `type` resolve
through a different scheme — `problemDetail.title.[FQCN]`, applied by
`ResponseEntityExceptionHandler` — documented in
[topic 09, chunk 9](../09-error-handling/09-message-codes-and-i18n.md). Both are
message sources and they are not interchangeable.

---

← Prev: [Wiring the MessageSource](15-wiring-the-message-source.md) · Index: [Validation](README.md) · Phase: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The expression language, and what a message may say](17-message-safety.md)
