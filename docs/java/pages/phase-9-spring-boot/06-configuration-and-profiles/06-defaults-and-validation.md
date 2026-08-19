---
title: "Defaults, absence and validation"
sidebar_label: "6 · Defaults and validation"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Boot reference *Externalized
> Configuration · Type-safe Configuration Properties* (docs.spring.io/spring-boot/reference
> — `@DefaultValue` with and without a value, the note that `Optional` is not
> recommended, `@Validated` and nested `@Valid`, and the
> `configurationPropertiesValidator` bean and its `static` requirement), plus
> the Spring Boot 4.0 release notes for Bean Validation no longer arriving
> transitively. Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**A property that nobody set has exactly three legitimate answers, and choosing
between them is the whole of this chunk: give it a default, let it be null and
say so, or refuse to start. The one answer that is never legitimate is the one
you get by accident — a null that nothing declared, discovered on the first
request in production, six hours after the deployment that caused it. Typed
binding is only worth the ceremony if it converts that class of failure into a
startup failure, and that conversion is opt-in.**

## `@DefaultValue`

A constructor parameter has no field initialiser to fall back on, so defaults on
a constructor-bound type are expressed on the parameter:

```java
public record Security(
        String username,
        String password,
        @DefaultValue("USER") List<String> roles) {}
```

It has two distinct uses, and the second is easy to miss.

**With a value** — `@DefaultValue("USER")` — the string is put through the
conversion service and used when the property is absent. That is how you get a
default list, a default `Duration`, a default enum constant, without writing a
single null check.

**Without a value** — a bare `@DefaultValue` on a *nested type* — meaning "if
nothing under this prefix was set, still create the object, from its own
defaults":

```java
public record MyProperties(
        boolean enabled,
        @DefaultValue Security security) {}
```

Without it, a missing `my.service.security.*` block leaves `security` null and
every call site needs a null check. With it, you get a `Security` populated
entirely from its own `@DefaultValue`s. **Turning the absent case into a real
object rather than a null is the single highest-value habit in this topic.**

For JavaBean-bound classes the equivalent is an ordinary field initialiser, and
pre-initialising nested objects and collections is what lets them skip their
setters at all.

## Why not `Optional`

The reference states it directly: **using `Optional` with
`@ConfigurationProperties` is not recommended**, because a missing property
binds to `null` rather than to `Optional.empty()`. You take on the wrapper's
verbosity and still get a `NullPointerException`, in the one place the type
claimed one was impossible.

The alternatives, in order of preference: a `@DefaultValue` so the value is
never absent; a component documented and annotated as nullable; or a validated
constraint so the application refuses to start — which is the rest of this
chunk.

## Validating configuration

Add `@Validated` to the type and the binder runs Bean Validation over the bound
object, during binding:

```java
@Validated
@ConfigurationProperties("my.service")
public record MyProperties(

        @NotBlank
        String host,

        @Min(1) @Max(65535)
        int port,

        @NotNull
        Duration timeout,

        @Valid @DefaultValue
        Security security) {

    public record Security(@NotBlank String username, @NotBlank String password) {}
}
```

Four things are doing work there and each is worth stating separately.

**`@Validated` on the type is the switch.** Without it the constraint
annotations are inert metadata; the binder does not validate speculatively.

**The constraints are ordinary JSR-380** — `@NotNull`, `@NotBlank`, `@NotEmpty`,
`@Min`, `@Max`, `@Size`, `@Pattern`, `@Positive`, `@Email` — the same
annotations you would put on a request DTO, and custom constraints work exactly
the same way.

**`@Valid` is what makes validation recurse into a nested type.** This is the
one people leave off. Without `@Valid` on the `security` component, the
constraints inside `Security` are never evaluated and the nested object is
validated only for being non-null. The nested type does **not** need its own
`@Validated` — one on the root plus `@Valid` at each nesting point is the
correct arrangement.

**🔴 In Boot 4, Bean Validation is not transitive.** The web starters no longer
drag in an implementation, so `@Validated` on a properties class does nothing
at all until you add the starter yourself:

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

Silence is the symptom — no error, no warning, and constraints simply not
enforced. It is the first thing to check when validation "stops working" after
an upgrade.

## Failing at startup rather than at first use

This is the entire point, and it is worth being explicit about what changes.

Without validation, a blank `host` is a value like any other. It travels
through binding, through injection, through every component that holds the
properties object, and surfaces as a connection error or a malformed URL the
first time somebody exercises that path — possibly on a code path that only runs
at month-end.

With validation, binding fails, the context fails to refresh, and the process
exits. Boot's failure analyser reports the offending property in its canonical
name together with the constraint that was violated, so the message names the
key to fix rather than the class that happened to notice.

**The value is not that validation catches typos. It is that it moves the
detection to the one moment when a rollback is cheap and obvious.** A container
that will not start is a failed deployment; a container that starts and is
wrong is an incident.

## A programmatic validator

When a constraint cannot be expressed as an annotation — "either `url` or `host`
and `port`, but not both" — declare a Spring `Validator` bean under the exact
name `configurationPropertiesValidator`:

```java
@Configuration(proxyBeanMethods = false)
public class MyPropertiesValidationConfiguration {

    @Bean
    public static MyPropertiesValidator configurationPropertiesValidator() {
        return new MyPropertiesValidator();
    }
}
```

⚠️ **The `@Bean` method must be `static`.** The validator is needed very early,
before the configuration class that declares it would ordinarily be
instantiated; a non-static method forces that class to be created too soon and
its own `@Autowired` dependencies will not have been applied. Making the method
static keeps the validator free of the enclosing instance's lifecycle, which is
exactly what the early call requires.

## The trade-off

Validated configuration converts a diffuse class of runtime failure into a
single deterministic startup failure, which is almost always the right trade.
The costs are honest ones: you need the validation starter on the classpath, the
annotations add noise to a type whose job was to be plain data, and a constraint
that is too strict becomes an outage of its own — an application that refuses to
start because an optional feature's credentials are absent is worse than one
that starts with the feature off.

The discipline that keeps it useful: **constrain what the application genuinely
cannot run without, and default everything else.** A `@NotNull` on a setting
that has a sensible default is not rigour, it is a landmine.

## Gotchas

**Symptom:** `@Validated` is on the class and nothing is ever rejected
**Cause:** no Bean Validation implementation on the classpath — in Boot 4 it is not pulled in transitively by the web starters
**Fix:** add it explicitly:
```xml
<artifactId>spring-boot-starter-validation</artifactId>
```

**Symptom:** constraints on a nested configuration record are ignored
**Cause:** the nesting point is missing `@Valid`, so validation does not recurse into it
**Fix:** annotate the component, not just the nested type:
```java
@Valid @DefaultValue Security security
```

**Symptom:** an `Optional<String>` component throws a `NullPointerException`
**Cause:** the documented behaviour — a missing property binds to `null`, not `Optional.empty()`
**Fix:** replace it with `@DefaultValue`, or make it a required, validated property so the application refuses to start without it

**Symptom:** the application refuses to start in a developer environment because a third-party integration's credentials are missing
**Cause:** `@NotBlank` applied to settings that the application can genuinely run without
**Fix:** constrain only what is truly required and default the rest; where a whole block is optional, validate it conditionally rather than making every field mandatory

**Symptom:** a custom `configurationPropertiesValidator` bean causes odd early-initialisation behaviour in its enclosing configuration class
**Cause:** the validator is required very early, so a non-static `@Bean` method forces its `@Configuration` class to be instantiated before its own dependencies are injected
**Fix:** declare the method `static`:
```java
@Bean
public static Validator configurationPropertiesValidator() { … }
```

**Symptom:** a nested object is null and validation reports nothing about it
**Cause:** a `@NotNull` on the nesting point catches a null nested object, but nothing was there to *create* it from defaults
**Fix:** create it and then validate its contents:
```java
@Valid @DefaultValue Security security
```

## Interview questions

**★ What are the two uses of `@DefaultValue`?**
With a value, it supplies the default for a missing property, run through the
conversion service — `@DefaultValue("USER") List<String> roles` yields a
one-element list when nothing is configured. Without a value, placed on a nested
type, it says "create this object even if no property under its prefix was
set", so the nested component arrives populated from its own defaults instead of
null. The second use is the more valuable one, because it removes null checks
from every call site rather than from one.

**★ Why is `Optional` discouraged on configuration properties?**
Because it does not do what it looks like it does: a missing property binds to
`null`, not `Optional.empty()`. You get the wrapper's verbosity together with a
`NullPointerException` in the one place the type claimed one was impossible. The
better answers are `@DefaultValue` so the value is never absent, or a validation
constraint so the application refuses to start when it is missing.

**★ How do you enable validation on a `@ConfigurationProperties` class, and what is easy to get wrong?**
Put `@Validated` on the type and JSR-380 constraints on the properties. Two
things are easy to get wrong. `@Valid` must appear at each nesting point or
constraints inside nested types are never evaluated — a nested `@Validated` does
not substitute for it. And in Boot 4 Bean Validation is no longer transitive, so
without `spring-boot-starter-validation` on the classpath the annotations are
inert and nothing is reported.

**★ Why validate configuration at all, when the same errors surface at runtime?**
Because *when* they surface is the whole point. A blank host or an out-of-range
port travels silently through binding and injection and shows up as a connection
error the first time that code path runs, which may be days later and on a
different shift. Validation makes it a refusal to refresh the context, so the
process exits and the deployment fails — and a failed deployment is a rollback,
while a started-but-wrong process is an incident.

**★ When do you need a `Validator` bean instead of annotations, and what is the catch?**
When the rule is relational rather than per-field: "exactly one of `url` or
`host`+`port`", "`retries` must be zero when `idempotent` is false". You declare
a Spring `Validator` bean under the exact name
`configurationPropertiesValidator`. The catch is that the `@Bean` method must be
`static` — the validator is needed very early, and a non-static method drags its
enclosing `@Configuration` class into existence before that class's own
dependencies have been injected.

**★ Can validation make things worse?**
Yes, and it is worth saying so. A constraint that is stricter than the
application's real requirement converts an optional feature into a startup
dependency: mark a third-party integration's credentials `@NotBlank` and every
developer machine and every environment that does not use that integration stops
booting. The discipline is to constrain what the application genuinely cannot
run without and default everything else, so validation buys certainty rather
than selling fragility.

---

← Prev: [Constructor binding and records](05-constructor-binding-and-validation.md) · Index: [Configuration and profiles](README.md) · Next → [Registering configuration properties](07-registering-and-structuring.md)
