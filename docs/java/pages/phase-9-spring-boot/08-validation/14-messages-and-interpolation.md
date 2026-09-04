---
title: "Where a constraint message actually comes from"
sidebar_label: "14 · Messages and interpolation"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Hibernate Validator 9.1.3.Final reference
> chapter *Interpolating constraint error messages*
> (docs.hibernate.org/validator/9.1/reference/en-US/html_single/), the Jakarta
> Validation 3.1 specification's message-interpolation section
> (jakarta.ee/specifications/bean-validation/3.1/), and the Spring Framework
> reference *Java Bean Validation*
> (docs.spring.io/spring-framework/reference/core/validation/beanvalidation.html).
> Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**A constraint's message is not a string, it is a *template*, and two entirely
separate machines can end up rendering it. Hibernate Validator interpolates the
template against `ValidationMessages.properties`; Spring resolves an *adapted*
error's message **codes** against `messages.properties`. Different bundle,
different placeholder syntax, different moment in the request. Almost every
"I put the text in a properties file and nothing changed" report is somebody
editing the bundle the other machine reads.**

## Two message systems, not one

| | Constraint interpolation | Message codes |
|---|---|---|
| Owned by | the provider — Hibernate Validator | Spring's `MessageSource` |
| Input | the `message` attribute of the annotation | `Size.person.name`, `Size.name`, … |
| Bundle | **`ValidationMessages.properties`** | **`messages.properties`** |
| Placeholders | `{min}`, `{max}`, `${validatedValue}` | `{0}`, `{1}`, `{2}` — `MessageFormat` |
| Runs | when the violation is created | when something *resolves* the error |
| Locale | the `Validator`'s locale | the request locale |

This chunk is the first column. The second is
[chunk 16](16-message-codes.md); [chunk 15](15-wiring-the-message-source.md) is
how you make the two columns read the same file, and
[chunk 17](17-message-safety.md) is why the first column's `${...}` syntax is a
security setting rather than a convenience.

## The default message is a key, not a sentence

Every built-in constraint's `message` default looks like this:

```java
public @interface Size {
    String message() default "{jakarta.validation.constraints.Size.message}";
    int min() default 0;
    int max() default Integer.MAX_VALUE;
}
```

The braces are not decoration. They mean *look this up*. The provider ships a
bundle containing `jakarta.validation.constraints.Size.message=size must be
between {min} and {max}`, and the text you see in a response is the result of
resolving that key and then substituting the annotation's own attributes.

So there are three places to put wording, in increasing order of how much you
should like them:

```java
// 1. A literal. Fast, and untranslatable forever.
@Size(max = 120, message = "Name is too long")
String customerName;

// 2. Your own key, resolved from ValidationMessages.properties.
@Size(max = 120, message = "{order.customerName.tooLong}")
String customerName;

// 3. Nothing at all — override the provider's key globally instead.
@Size(max = 120)
String customerName;
```

Option 3 is worth knowing about because it is the one nobody tries. Putting

```properties
# ValidationMessages.properties
jakarta.validation.constraints.Size.message=must be at most {max} characters
```

in **your own** bundle re-words *every* `@Size` in the application at once,
which is usually what a team means when it complains that the default wording is
unfriendly. It costs one line and touches no annotation.

## How the template is interpolated

The documented order of the default interpolator, given a message descriptor:

1. **Resolve `{...}` tokens against the user's `ValidationMessages` bundle** for
   the current locale. A hit is substituted, and **the substituted text is then
   interpolated again** — which is exactly how
   `{jakarta.validation.constraints.Size.message}` turns into a sentence that
   still contains `{min}`.
2. **Resolve remaining `{...}` tokens against the provider's own bundle**, again
   recursively. This is where the built-in English defaults come from.
3. **Substitute remaining `{...}` tokens that name a constraint attribute** —
   `{min}`, `{max}`, `{value}`, `{regexp}`, and any attribute you declared on a
   custom constraint.
4. **Evaluate `${...}` expressions** with the Expression Language engine.

Three consequences fall straight out of that ordering, and all three are things
people discover the hard way.

**Your bundle beats the provider's**, because step 1 runs before step 2. That is
the entire mechanism behind option 3 above, and it means a key you did not
intend to override — a typo that happens to collide — silently changes messages
across the whole application.

**Resolution is recursive, so a key may point at another key.** That is a
feature when you want one shared phrase in twenty messages, and a hang-shaped
foot-gun when two keys refer to each other.

**A `{...}` token that resolves to nothing is emitted verbatim.** There is no
exception, no warning and no log line; the response simply contains
`{com.example.validation.CurrencyCode.message}` where a sentence should be. This
is the same failure shape as the rest of this topic: forgetting produces silence,
not an error.

## Special characters

`{`, `}` and `$` carry meaning in a descriptor, so a message that wants them
literally has to escape them with a backslash — `\{`, `\}`, `\$`, and `\\` for a
backslash itself.

```properties
order.total.format=Amount must be written as \{currency\} \{amount\}, e.g. EUR 12.00
```

⚠️ **Stated with a caveat, per this project's evidence rule.** The Hibernate
Validator 9.1 reference does carry a *Special characters* subsection (§4.1.1)
inside the message-interpolation chapter, but the single-page rendering of that
manual truncates the subsection body, and the escape sequences above were
confirmed against an older rendering of the same section rather than against the
9.1 text itself. Treat them as very likely correct and re-check against your own
provider version before depending on them.

## `${validatedValue}` and the formatter

Inside a `${...}` expression the engine exposes the value that failed, under the
name `validatedValue`, plus a `formatter` bean with a var-arg
`format(String, Object...)` that behaves like `java.util.Formatter`:

```java
@Size(min = 2, max = 14,
      message = "The license plate '${validatedValue}' must be between {min} and {max} characters long")
String licensePlate;

@DecimalMax(value = "1000.00",
            message = "must not exceed ${formatter.format('%1$.2f', value)}")
BigDecimal total;
```

🔴 **`${validatedValue}` is a data-leak primitive and it belongs in almost no
production message.** It echoes whatever the client sent straight back into the
response body — and into every log line, metric label and error tracker that
copies that message. On a password field, a bearer token or a card number, that
is an exfiltration path you built yourself, and it will outlive the person who
wrote it. Reserve it for developer-facing validation of internal configuration,
where the reader is the person who supplied the value.

The deeper reason to be careful is that `${...}` is a *language*, not a
substitution, and how much of that language a message may reach is a
configurable security decision —
[chunk 17](17-message-safety.md).

## The trade-off

Externalising messages is the right default and it is not free. A literal in the
annotation is readable at the point of use, greppable, and impossible to get out
of sync with the constraint it describes; a key is none of those, and the day a
bundle entry is deleted the API starts answering with a brace-wrapped identifier
rather than an error. The honest rule is **externalise when someone other than
the developer owns the wording** — product, support, legal, or a translator —
and leave a literal in place when the message is developer-facing, such as a
`@ConfigurationProperties` constraint that fails at startup
([chunk 13](13-beyond-the-controller.md)) and is read by whoever is deploying.

## Gotchas

**Symptom** · A message override in `messages.properties` has no effect on
constraint violations.
**Cause** · Nothing wired that bundle into the validator. Constraint
interpolation reads `ValidationMessages.properties`; `messages.properties` is a
different file, read by a different component, at a different time.
**Fix** · Either move the key into `ValidationMessages.properties`, or wire the
`MessageSource` in — [chunk 15](15-wiring-the-message-source.md).

**Symptom** · The response contains a literal
`{com.example.validation.CurrencyCode.message}`.
**Cause** · A custom constraint's message key exists in no resolvable bundle,
and an unresolved token is emitted verbatim rather than raising an error.
**Fix** · Add the key to `ValidationMessages.properties`, and add a test that
asserts the rendered message contains no `{` — the cheapest possible guard
against a class of failure that is otherwise invisible.

**Symptom** · `{min}` renders as `{min}` in a custom constraint's message.
**Cause** · The annotation has no attribute called `min`. Step 3 substitutes
constraint attributes only, so a placeholder naming an attribute that does not
exist on *that* annotation is left alone.
**Fix** · Declare the attribute on your constraint, or reference the one it
actually has:

```java
public @interface MaxWeight {
    String message() default "{com.example.MaxWeight.message}";
    int kilograms();          // now {kilograms} interpolates
}
```

**Symptom** · Changing `ValidationMessages.properties` re-words a constraint you
never touched.
**Cause** · The key collides with the provider's own key, and the user bundle is
consulted first.
**Fix** · Namespace your keys with your own package prefix. `order.total.max` is
safe; `Size.message` is not.

**Symptom** · A message containing a currency symbol or a code sample renders
with characters missing.
**Cause** · Unescaped `{`, `}` or `$` in the descriptor.
**Fix** · Escape them — `\{`, `\}`, `\$` — and prefer to keep punctuation-heavy
copy out of constraint messages entirely; a constraint message is a sentence
about one field, not a document.

**Symptom** · A translated bundle is ignored and everything renders in English.
**Cause** · Constraint interpolation resolves against the `Validator`'s locale,
not the request's.
**Fix** · Wire a Spring `MessageSource` in so constraint messages fall under the
application's normal locale resolution — [chunk 15](15-wiring-the-message-source.md).

**Symptom** · Two libraries ship `ValidationMessages.properties` and messages
change when dependencies are reordered.
**Cause** · The bundle name is fixed by the specification and lives at the
classpath root, so only one copy is ever found.
**Fix** · One bundle per deployable; a library that needs its own constraint
copy contributes namespaced keys rather than shipping a second file with the
specification's name. Moving to a `MessageSource` with a basename you control
removes the problem entirely — [chunk 15](15-wiring-the-message-source.md).

## Interview questions

**★ Where does the text of a constraint violation message come from?**
From the constraint's `message` attribute, which by default is a *key* wrapped
in braces. The provider resolves it against the user's `ValidationMessages`
bundle first, then its own bundle, then substitutes the annotation's attributes
such as `{min}` and `{max}`, then evaluates any `${...}` expression. Nothing in
that chain touches `messages.properties` unless you deliberately wire it in.

**★ A team puts `NotBlank.customerName=Name is required` into
`messages.properties` and nothing changes. Why?**
Because they wrote a *message code* into the bundle the code-resolution path
reads, while the message they are looking at was produced by the *interpolation*
path, which reads `ValidationMessages.properties`. Both mechanisms are real; the
shape of the key tells you which one was meant. Either move it to the other
bundle, or make the validator read the application's `MessageSource`.

**★ How would you re-word every `@NotBlank` message in an application at once?**
Override the provider's own key — `jakarta.validation.constraints.NotBlank.message`
— in your `ValidationMessages.properties`. Because the user bundle is consulted
before the provider bundle, that entry wins everywhere, with no annotation
changes and no code.

**★ Why is message resolution recursive, and what does that buy?**
Because a resolved value is interpolated again, a key can expand into text that
itself contains keys or attribute placeholders. That is what lets the built-in
default `{jakarta.validation.constraints.Size.message}` expand to a sentence
which then picks up `{min}` and `{max}` from the annotation, and it lets you
factor a shared phrase — a brand name, a support URL — into one key referenced
by many messages.

**★ What does `${validatedValue}` do, and when would you use it?**
It interpolates the value that failed the constraint into the message. It is
excellent in a developer-facing context — a `@ConfigurationProperties` violation
at startup, where the person reading it supplied the value — and close to
indefensible in an API response, because it echoes untrusted input back into the
body and into every log that copies the message.

**★ An unresolved message key produces no error. Is that a bug?**
No, it is the specified behaviour: a token that resolves to nothing is left in
place. It is worth defending against anyway, because the failure survives
compilation, startup and every happy-path test. A rendered message containing
`{` is a cheap assertion to add to the validation test for each request type.

**★ When is a literal message in the annotation the right answer?**
When the audience is a developer or an operator rather than a customer: startup
configuration constraints, internal admin endpoints, assertions that should
never fire. Externalising those buys nothing — nobody translates them — and
costs the reader a hop to a properties file to find out what the rule is.

---

← Prev: [Validation beyond the controller](13-beyond-the-controller.md) · Index: [Validation](README.md) · Phase: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Wiring the validator to Spring's MessageSource](15-wiring-the-message-source.md)
