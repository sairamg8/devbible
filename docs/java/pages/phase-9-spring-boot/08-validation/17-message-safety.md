---
title: "The expression language, and what a message is allowed to say"
sidebar_label: "17 · Message safety"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Hibernate Validator 9.1 javadoc for
> `ExpressionLanguageFeatureLevel` (including its `DEFAULT` constant) and
> `HibernateConstraintViolationBuilder.enableExpressionLanguage`
> (docs.hibernate.org/validator/9.1/api/), HV-1816 and the associated advisory
> for the change of default in 6.2/7.0, and the `LocalValidatorFactoryBean`
> javadoc for `setConfigurationInitializer`
> (docs.spring.io/spring-framework/docs/7.0.8/javadoc-api/). Spring Boot 4.1.1,
> Spring Framework 7.0.x, JDK 25.

**A constraint message is a template plus data, and on the wrong day the data is
attacker-controlled and the template is an evaluation engine. Hibernate
Validator draws that line for you with a deliberately asymmetric default:
expression language is **on** for the messages you wrote in your own source and
**off** for the violations your validators build at runtime. Understanding why
those two defaults differ is most of what you need to never write a dangerous
validator — and the rest is a short list of things a message must never say out
loud.**

## The four levels

A `${...}` in a message is evaluated by a real Expression Language engine, and
how much of that engine a message may reach is configurable. The levels, quoted
from the javadoc:

| Level | What it allows |
|---|---|
| `NONE` | *"Expression Language expressions are not interpolated."* |
| `VARIABLES` | only variables injected via `addExpressionVariable`, the specification's `formatter`, and `ResourceBundle`s |
| `BEAN_PROPERTIES` | the above plus bean properties — *"the minimal level to have a specification-compliant implementation"* |
| `BEAN_METHODS` | the above plus bean method execution, which *"can lead to serious security issues, including arbitrary code execution, if not very carefully handled"* |

The enum has existed since Hibernate Validator 6.2, which is also when the
defaults were tightened.

## 🔴 The asymmetric default, and why it is right

> *"The default Expression Language feature level. Depends on the context. For
> standard constraint messages, it is `BEAN_PROPERTIES`. For custom violations,
> the default is `NONE` and, if Expression Language is enabled for a given custom
> violation via the API, the default becomes `VARIABLES` in the context of this
> given custom violation."*

The asymmetry is not caution for its own sake. A **standard constraint message**
is a literal you typed into your own source or a key in your own bundle —
untrusted input never becomes part of the template, only of the value it
describes. A **custom violation** template is built at runtime inside `isValid`,
and the overwhelmingly common way people build one is by concatenating the value
that just failed. That makes the template itself attacker-controlled, which is
the class of problem HV-1816 closed by disabling expression language for custom
violations outright.

```java
// ⛔ The shape the default exists to defuse. The failing value becomes part of
//    the template, so anything EL-shaped inside it is a candidate for evaluation.
ctx.buildConstraintViolationWithTemplate("'" + value + "' is not a known currency")
   .addConstraintViolation();

// ✅ Never concatenate. Inject the value, and let the template stay a constant.
var hctx = ctx.unwrap(HibernateConstraintValidatorContext.class);
hctx.addExpressionVariable("supplied", value);
hctx.buildConstraintViolationWithTemplate("{com.example.CurrencyCode.message}")
    .addConstraintViolation();
```

Note that the safe version is also the version that survives translation: the
template is a key, so [chunk 14](14-messages-and-interpolation.md)'s resolution
applies to it and the sentence can be reworded in a bundle. The unsafe version
hard-codes English into a validator.

## Turning it on, deliberately

Per violation, on `HibernateConstraintViolationBuilder`:
`enableExpressionLanguage()` — *"Enable Expression Language with the default
Expression Language feature level for the constraint violation created by this
builder if the chosen `MessageInterpolator` supports it"* — or the overload
taking an explicit `ExpressionLanguageFeatureLevel`.

Globally, as provider properties passed through the validator factory
([chunk 15](15-wiring-the-message-source.md)):

```properties
hibernate.validator.constraint_expression_language_feature_level=bean-properties
hibernate.validator.custom_violation_expression_language_feature_level=none
```

The accepted values are `none`, `variables`, `bean-properties` and
`bean-methods`. Typed, the same thing goes through Framework 7's
`setConfigurationInitializer`, a callback *"for customizing the Bean Validation
`Configuration` instance"*:

```java
factory.setConfigurationInitializer(config -> {
    if (config instanceof HibernateValidatorConfiguration hv) {
        hv.constraintExpressionLanguageFeatureLevel(ExpressionLanguageFeatureLevel.NONE);
    }
});
```

⚠️ **`NONE` for constraint messages is stricter than the specification, and that
can be the right call.** It is reasonable hardening for a service whose messages
never use `${...}`, and it will silently stop `${validatedValue}` working
anywhere — a feature rather than a regression on an internet-facing API, and a
surprise if nobody wrote it down.

## What a message is allowed to say

Wording is a security decision wearing a copywriting hat. There are three rules
and they are short.

**Never echo the rejected value.** `${validatedValue}` on a password, a token or
a card number writes the secret into the response body, the access log, and
every error tracker downstream that copies the message. It is the same class of
leak that
[topic 09's *what never reaches the client*](../09-error-handling/13-never-reaches-the-client.md)
deals with at length, and it is worse here because a validation message looks
harmless.

**Never expose internal identifiers.** Default messages plus DTO field names
that mirror your table columns hand a caller your schema for free. The fix is
not to rename the field — it is to relabel the message argument,
`person.name=username`, which [chunk 16](16-message-codes.md) covers.

**Say less on endpoints that handle credentials.** A precise field-by-field
report is excellent for a first-party form and a user-enumeration oracle on a
login endpoint. "Invalid email or password" is one message on purpose.

## The trade-off

Locking the expression language down costs you expressiveness that some teams
genuinely use: a message that formats a currency, or names a sibling property,
is legitimately easier with `${...}` than without. And a message that says less
is a message that helps a confused integrator less — every redaction is paid for
in support tickets. The resolution most APIs land on is **precise about the
path, vague about the value**: name the field and the rule, never the input, and
put the machine-readable discriminator in an error code rather than in prose so
that clients never need to read the sentence at all.

## Gotchas

**Symptom** · A custom violation's `${...}` expression appears literally in the
response.
**Cause** · The default feature level for custom violations is `NONE`, so it is
never evaluated.
**Fix** · Call `enableExpressionLanguage()` on the builder — and reconsider
first, because that default exists to stop user input reaching the engine.

**Symptom** · A penetration test reports expression-language injection through a
validation message.
**Cause** · A validator built its template by concatenating the value under
validation, and something raised the custom-violation level above `NONE`.
**Fix** · Keep the template constant and inject with `addExpressionVariable`.
Never build a template from input, at any level.

**Symptom** · `${validatedValue}` stops rendering after a configuration change
nobody connects to it.
**Cause** · The constraint level was set to `NONE` as hardening.
**Fix** · Intended behaviour — but record the decision next to the property, or
it is rediscovered as a bug every year.

**Symptom** · A secret turns up in the log aggregator, in a line nobody wrote a
logging statement for.
**Cause** · A message interpolating `${validatedValue}` on a credential field,
copied into a log by the error handler.
**Fix** · Remove it from the message. Redacting downstream is a filter you have
to maintain forever; not putting it in the message is one edit.

**Symptom** · A validator's messages cannot be translated.
**Cause** · The template was built by string concatenation inside `isValid`, so
there is no key for a bundle to resolve.
**Fix** · The safe pattern is the translatable one: a constant key plus injected
expression variables.

**Symptom** · Login shows "no account with that email" and support considers it
a feature.
**Cause** · Field-level validation applied to an authentication endpoint.
**Fix** · One generic message for the credential pair, and keep the precise
report for endpoints where the caller already owns the data.

## Interview questions

**★ Why is Hibernate Validator's expression language disabled by default for
custom violations but not for standard constraint messages?**
Because a standard message is a literal in your source and a custom-violation
template is built at runtime — usually by concatenating the value that just
failed. That makes the template a channel for attacker-controlled text into an
evaluation engine, so HV-1816 set the custom-violation default to `NONE` while
leaving standard messages at `BEAN_PROPERTIES`, the minimum needed to stay
specification-compliant.

**★ What does `BEAN_METHODS` allow, and when would you enable it?**
Bean method execution inside `${...}`, which the javadoc says *"can lead to
serious security issues, including arbitrary code execution, if not very
carefully handled"*. Realistically: never on a service that accepts external
input. If a message needs a computed value, compute it in the validator and
inject it as an expression variable.

**★ How do you write a custom violation message that includes the offending
value safely?**
Keep the template a constant key and inject the value with
`addExpressionVariable("supplied", value)` on
`HibernateConstraintValidatorContext`. Then decide separately whether that value
may appear in a client-facing response at all — for anything touching
credentials or personal data, the answer is no.

**★ Would you set the constraint level to `NONE`?**
On an internet-facing API with no `${...}` in any message, yes, as cheap
defence in depth — accepting that it is stricter than the specification and that
`${validatedValue}` stops working everywhere. The decision belongs in a comment
next to the configuration, because the symptom of forgetting it looks exactly
like a broken message.

**★ How much detail should a validation error give?**
Precise about the path, vague about the value: name the field and the rule so
the caller can fix the request, never the input, and never on a credential
endpoint. A precise report is a first-party front-end's best friend and a
reconnaissance aid for anyone probing you, and the two audiences share one
response body.

**★ Where should a client's *branching* logic get its information, if not from
the message?**
From a stable machine-readable code, which is the error envelope's job rather
than the constraint's. That separation is what lets you reword or translate
freely — nothing depends on the sentence — and it is
[topic 09](../09-error-handling/06-problemdetail-and-rfc-9457.md)'s design, not
this topic's.

---

← Prev: [Message codes](16-message-codes.md) · Index: [Validation](README.md) · Phase: [Phase 9 — Spring Boot and the web](../README.md)
