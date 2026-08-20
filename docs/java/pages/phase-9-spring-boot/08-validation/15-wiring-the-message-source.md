---
title: "Wiring the validator to Spring's MessageSource"
sidebar_label: "15 · Wiring the MessageSource"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the `LocalValidatorFactoryBean` javadoc
> (docs.spring.io/spring-framework/docs/7.0.8/javadoc-api/org/springframework/validation/beanvalidation/LocalValidatorFactoryBean.html
> — `setValidationMessageSource`, `setMessageInterpolator`,
> `setValidationPropertyMap`, `getValidationPropertyMap`,
> `setConfigurationInitializer`), the Spring Framework reference *Java Bean
> Validation*
> (docs.spring.io/spring-framework/reference/core/validation/beanvalidation.html),
> and the Spring Boot *Application Properties* appendix, `spring.messages.*`
> group. Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**Two bundles for one application is an accident, not a design. Your
translators are already working on `messages.properties`, and
`ValidationMessages.properties` is a second file with different tooling, a
different locale story and a different reviewer. Spring collapses them with one
setter — and that setter has a documented trap sharp enough that the javadoc
spends a paragraph on it: point it at a `MessageSource` that uses
`useCodeAsDefaultMessage` and *every* default message in the application turns
into a raw key.**

## One setter

```java
@Configuration
class ValidationConfig {

    @Bean
    LocalValidatorFactoryBean defaultValidator(MessageSource messageSource) {
        var factory = new LocalValidatorFactoryBean();
        factory.setValidationMessageSource(messageSource);   // not ValidationMessages.properties
        return factory;
    }
}
```

The javadoc says exactly what this buys: a custom `MessageSource` *"instead of
relying on JSR-303's default `ValidationMessages.properties` bundle in the
classpath"*, one that *"may refer to a Spring context's shared `messageSource`
bean, or to some special `MessageSource` setup for validation purposes only"*.
In a Boot application the shared bean is the one auto-configured over
`messages.properties` from the `spring.messages.*` group, so injecting it is the
whole change.

Declaring your own `Validator` bean makes Boot's auto-configured one back off —
the ordinary condition mechanism from
[bean conditions and back-off](../05-auto-configuration/04-bean-conditions-and-back-off.md),
and the same back-off [chunk 2](02-the-constraints.md) describes for the starter.

Two constraints ship with the feature, both stated in the same javadoc.

**It is implemented by borrowing Hibernate's interpolator.** The note reads
*"This feature requires Hibernate Validator 4.3 or higher on the classpath"* and
adds that with a different provider *"Hibernate Validator's
`ResourceBundleMessageInterpolator` class must be accessible during
configuration"*. On 9.x that is a non-event, but it explains the second
constraint.

**Specify either this or `messageInterpolator`, never both** — *"Specify either
this property or `"messageInterpolator"`, not both."* They configure the same
thing by two routes, so setting both means one silently wins and the
configuration no longer says what it does. If you genuinely need custom
interpolation *and* Spring bundles, the javadoc names the seam: derive from
`ResourceBundleMessageInterpolator` and construct it with a Spring-based
`ResourceBundleLocator`.

## 🔴 The trap: `useCodeAsDefaultMessage` destroys every default message

This is the non-obvious one, and it is in the javadoc precisely because people
hit it:

> *"In order for Hibernate's default validation messages to be resolved still,
> your `MessageSource` must be configured for optional resolution (usually the
> default). In particular, the `MessageSource` instance specified here should
> not apply `"useCodeAsDefaultMessage"` behavior. Please double-check your setup
> accordingly."*

The mechanism is worth understanding rather than memorising, because the
symptom looks nothing like the cause.

Interpolation step 1 ([chunk 14](14-messages-and-interpolation.md)) asks the
`MessageSource` for `jakarta.validation.constraints.Size.message`. A normal
`MessageSource` answers *"I do not have that"*; the interpolator falls through to
step 2 and Hibernate's own bundle supplies the sentence. A `MessageSource` with
`useCodeAsDefaultMessage` **never says no** — it answers with the code itself.
Step 2 therefore never runs, and every constraint you did not personally
translate now renders in your API responses as the literal string
`jakarta.validation.constraints.Size.message`.

In Boot the switch is a property, and its documented default is the safe one:

| Property | Default | Note |
|---|---|---|
| `spring.messages.basename` | `messages` | comma-separated, `ResourceBundle` convention |
| `spring.messages.use-code-as-default-message` | `false` | 🔴 *"Recommended during development only."* |
| `spring.messages.encoding` | `UTF-8` | |
| `spring.messages.fallback-to-system-locale` | `true` | the server's locale becomes the fallback |
| `spring.messages.always-use-message-format` | `false` | parse even messages with no arguments |
| `spring.messages.cache-duration` | *(cached forever)* | set it if the bundle is externalised |

⚠️ **The failure arrives from two individually reasonable changes.** Turning
`use-code-as-default-message` on is a genuinely useful development aid: a
missing key becomes visible instead of silently falling back. Wiring the shared
`MessageSource` into the validator is the right way to have one bundle. Do both
and every default constraint message breaks — in the dev profile only, which is
the worst place for it, because that is where people decide the messages are
fine. If you want both, **give validation its own `MessageSource`**:

```java
@Bean
MessageSource validationMessageSource() {
    var source = new ResourceBundleMessageSource();
    source.setBasename("validation-messages");
    source.setDefaultEncoding("UTF-8");
    source.setUseCodeAsDefaultMessage(false);   // explicit, because it is load-bearing
    return source;
}
```

## Where the bundle actually lives

`ValidationMessages.properties` is a **specification-fixed name at the root of
the classpath**, which has a consequence nobody plans for: two libraries can
each ship one, only one is found, and which one wins depends on classpath
ordering. The application's messages then change when somebody reorders a
dependency.

There is no configuration to fix that, because the name is not configurable —
which is a second, quieter argument for `setValidationMessageSource`. Once
messages come from a `MessageSource`, the basename **is** configurable
(`spring.messages.basename`), collisions become visible, and a library that
wants its own constraint copy contributes namespaced keys to a bundle you
control rather than shadowing a file you cannot see.

## The other knobs on the same bean

`LocalValidatorFactoryBean` is where provider-level configuration lands, and two
settings are worth knowing exist before you go looking for a Boot property that
does not.

```java
@Bean
LocalValidatorFactoryBean defaultValidator(MessageSource messageSource) {
    var factory = new LocalValidatorFactoryBean();
    factory.setValidationMessageSource(messageSource);
    factory.getValidationPropertyMap().put("hibernate.validator.fail_fast", "false");
    return factory;
}
```

`getValidationPropertyMap()` is documented as allowing *"Map access to the bean
validation properties to be passed to the validation provider, with the option
to add or override specific entries"*, so any `hibernate.validator.*` property
goes through it without a custom `Configuration`.

**Fail-fast** (`hibernate.validator.fail_fast`) stops evaluation at the first
violation instead of collecting them all. It is a real option and it is **the
wrong trade at an HTTP boundary**: the entire value of the field-by-field report
in [chunk 8](08-reading-the-errors.md) is that a client fixes its request once
rather than in six round trips. It is defensible where validation sits on a hot
path and the caller only needs to know *that* something failed — a batch loop
discarding bad records.

Settings that are typed rather than stringly — the Expression Language feature
level in particular — go through Framework 7's `setConfigurationInitializer`
instead, and that one has security consequences of its own:
[chunk 17](17-message-safety.md).

## The trade-off

Wiring validation into the application `MessageSource` is close to a free win,
and the two costs are real enough to name. **You take over a bean Boot was
configuring for you**, so any future Boot default for the validator is now yours
to notice and adopt; that is the standard price of back-off and it is why the
bean should be as small as the one above. And **you couple constraint messages
to request-scoped locale resolution**, which is what you wanted for a
browser-facing API and is arguably wrong for a machine-facing one, where the
sensible behaviour is a single stable language regardless of `Accept-Language`.
If your API is consumed by servers, one bundle and no translations is a
defensible end state.

## Gotchas

**Symptom** · Every constraint message becomes something like
`jakarta.validation.constraints.NotBlank.message`.
**Cause** · The wired `MessageSource` has `useCodeAsDefaultMessage` enabled, so
the interpolator never falls through to Hibernate's own bundle.
**Fix** · Set `spring.messages.use-code-as-default-message=false`, or give
validation a dedicated `MessageSource` that does not have it.

**Symptom** · It works in production and breaks in the dev profile only.
**Cause** · The same property, enabled in a profile-specific file as a
development aid.
**Fix** · Same fix, and treat it as a reason to keep validation's
`MessageSource` separate from the one developers experiment with.

**Symptom** · Declaring a `LocalValidatorFactoryBean` breaks method validation
on `@Validated` beans, or produces two validators.
**Cause** · Boot backs off on the `Validator` type; declaring a second
validator-shaped bean rather than replacing the default leaves the container
choosing between them.
**Fix** · Declare exactly one, and let the back-off do its job — see
[bean conditions and back-off](../05-auto-configuration/04-bean-conditions-and-back-off.md).

**Symptom** · Both `messageInterpolator` and `validationMessageSource` are set,
and the behaviour differs between environments.
**Cause** · They configure the same thing; the javadoc says to specify one or
the other.
**Fix** · Pick one. For custom interpolation over Spring bundles, subclass
`ResourceBundleMessageInterpolator` with a Spring `ResourceBundleLocator`.

**Symptom** · A message reads correctly in a unit test of the validator and
wrongly through the API.
**Cause** · The test bootstraps a plain `Validator` from
`Validation.buildDefaultValidatorFactory()`, which reads
`ValidationMessages.properties`, while the application reads the wired
`MessageSource`. Two code paths, two bundles.
**Fix** · Inject the container's `Validator` into the test rather than building
one, so the test exercises the configuration you ship.

**Symptom** · Editing an externalised bundle changes nothing until a restart.
**Cause** · `spring.messages.cache-duration` is unset, and bundles are then
cached forever.
**Fix** · Set it — but only if the bundle really is externally editable;
re-reading a file on every message is not free.

**Symptom** · A German client gets English messages, and a French one gets
German.
**Cause** · `spring.messages.fallback-to-system-locale` is `true`, so the
server's own locale is the fallback rather than the default bundle.
**Fix** · Set it to `false` in a containerised deployment, where the host locale
is an accident of the base image rather than a decision anyone made.

## Interview questions

**★ How do you make constraint messages come from `messages.properties`?**
Declare a `LocalValidatorFactoryBean` and call
`setValidationMessageSource(messageSource)` with the context's shared
`MessageSource`. Boot's auto-configured validator backs off because you
supplied one, and constraint interpolation now resolves against your bundle
instead of `ValidationMessages.properties`.

**★ What is `useCodeAsDefaultMessage`, and why does it matter for validation
specifically?**
It makes a `MessageSource` return the code instead of throwing when a key is
missing. Wired into the validator it converts the interpolator's "not found,
fall through to the provider's defaults" step into a permanent hit, so every
message you have not translated yourself renders as a raw key. The javadoc calls
it out by name, which is unusual and tells you how often it bites.

**★ Why does the javadoc insist on `validationMessageSource` *or*
`messageInterpolator`, but not both?**
Because `setValidationMessageSource` is implemented *as* a message interpolator
built over a Spring-backed resource-bundle locator. Setting both is setting one
thing twice with different values; one wins, and which one is an implementation
detail rather than something your configuration states.

**★ You declare your own `LocalValidatorFactoryBean`. What did you just take
responsibility for?**
Everything Boot's `defaultValidator` would have configured, now and in future
releases. That is the general shape of auto-configuration back-off: the bean is
yours, so keep it minimal and revisit it at major upgrades, rather than copying
a large configuration you found online.

**★ Would you enable fail-fast on a validator serving HTTP?**
No. Collecting every violation is what lets a client fix its request in one
round trip, and the field-by-field report exists for exactly that. Fail-fast
belongs where validation is a hot-path gate and the caller only needs a
yes/no — a batch import discarding bad rows, for instance.

**★ Where does the locale for a constraint message come from, before and after
this change?**
Before, from the `Validator` — which is why `Accept-Language` frequently appears
to be ignored. After, from whatever the application's `MessageSource` and locale
resolution decide, which in MVC is the request locale. Note that
`spring.messages.fallback-to-system-locale` defaults to `true`, so the server's
own locale is part of the answer and is usually an accident of the container
image.

**★ Two libraries in your build each ship `ValidationMessages.properties`. What
happens, and what do you do?**
Only one is found — the name is fixed by the specification and lives at the
classpath root — so the effective messages depend on classpath ordering and can
change with a dependency bump. There is no property that fixes it; the fix is to
stop using that bundle in favour of a `MessageSource` with a basename you
control, and to have libraries contribute namespaced keys.

---

← Prev: [Messages and interpolation](14-messages-and-interpolation.md) · Index: [Validation](README.md) · Phase: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Message codes](16-message-codes.md)
