---
title: "Typed properties versus @Value"
sidebar_label: "8 · Typed properties vs @Value"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Boot reference *Externalized
> Configuration · Type-safe Configuration Properties* (docs.spring.io/spring-boot/reference
> — the comparison of `@Value` with `@ConfigurationProperties`, relaxed binding,
> `SpEL` support in `@Value`, and the statement that defaults defined in a
> properties class are not reflected in the `Environment`) and the Spring
> Framework reference *Using `@Value`*
> (docs.spring.io/spring-framework/reference/core/beans/annotation-config/value-annotations.html).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**`@Value` is not a smaller version of `@ConfigurationProperties`. It is a
different mechanism with a different resolver, different naming rules and a
different failure mode, and the reason to prefer typed binding is not tidiness —
it is that a `@Value` sprinkle has no moment at which the application can notice
that its configuration is wrong. Which is also why the answer is "prefer typed
binding", not "never use `@Value`": there are three places where the annotation
is still the correct tool, and knowing them stops the rule becoming
superstition.**

## What a sprinkle looks like

Nobody decides to spread configuration across twenty classes. It accretes:

```java
@Service
public class InvoiceService {

    @Value("${invoice.api.url}")            private String url;
    @Value("${invoice.api.timeout:5000}")   private int timeoutMillis;
    @Value("${invoice.api.retries:3}")      private int retries;
}
```

Every one of those lines was reasonable when it was written. Together they have
four properties: the settings for one subsystem live in as many files as use
them; nothing lists what `invoice.api.*` accepts; the defaults are in three
places and disagree with the documentation; and no test can construct the
service without a Spring context or reflection.

## What typed binding gives you that `@Value` does not

**Relaxed binding.** `@ConfigurationProperties` accepts kebab-case, camelCase
and the environment-variable form for the same property. `@Value` resolves its
placeholder literally, so `${invoice.api.url}` and a YAML key `invoice.api.URL`
never meet ([chunk 4](04-relaxed-binding-and-env-vars.md)).

**Structured types.** Lists, maps, nested objects, `Duration`, `DataSize` and
custom converters all bind. `@Value` gives you conversion of a single string
through the conversion service and nothing structural.

**One discoverable place.** The type *is* the documentation of what the
subsystem accepts, and it is one file to read rather than a grep across the
module.

**Metadata.** The annotation processor turns the type into IDE completion and
inline docs. A `@Value` placeholder produces nothing for anyone else to find.

**Validation at startup.** `@Validated` plus constraints makes a wrong value a
refusal to start ([chunk 6](06-defaults-and-validation.md)). A `@Value` with no
default fails at context startup too — but only for *absence*, never for a value
that is present and nonsense.

**Testability.** `new InvoiceService(new InvoiceProperties("https://…", …))` is
an ordinary constructor call, which is the entire argument of
[dependency injection](../03-dependency-injection/03-setters-values-records.md)
applied to configuration.

## The default the `Environment` cannot see

A documented trap that sits exactly on the boundary between the two mechanisms:

> Default values defined in a `@ConfigurationProperties` class are **not
> reflected in the `Environment`**.

```java
@ConfigurationProperties("my.service")
public class MyProperties {
    private boolean enabled = false;      // default lives in the object only
}
```

`my.service.enabled` is not present in the `Environment` with the value `false`
unless somebody actually set it. Two consequences follow, and both look like
bugs elsewhere:

- `@Value("${my.service.enabled}")` in another class **fails to resolve**,
  because there is no such property. It needs its own default:
  `@Value("${my.service.enabled:false}")`.
- `@ConditionalOnProperty` and any `Condition` querying the `Environment` see
  the property as unset, so the condition behaves as if nothing was configured —
  which is why
  [topic 05 — auto-configuration](../05-auto-configuration/06-property-and-environment-conditions.md)
  insists on stating `matchIfMissing` deliberately.

The rule: **a default in code is a default for the object, not a value in the
environment.** If anything other than that object needs to see it, it belongs in
`application.yml` as a real property.

## Where `@Value` still earns its place

**SpEL.** `@Value` evaluates `#{…}` expressions; the binder does not. Anything
computed rather than configured needs it:

```java
@Value("#{systemProperties['user.region'] ?: 'eu-west-1'}")
private String region;
```

**Annotation attributes that must be a `String` literal.** `@Scheduled`,
`@ConditionalOnExpression`, `@RequestMapping` paths and similar take strings
resolved at annotation-processing time; there is no way to reach a bound object
from one:

```java
@Scheduled(cron = "${invoice.reconciliation.cron}")
public void reconcile() { … }
```

**One value, in one place, with no subsystem behind it.** A `@Bean` method that
needs a single URL to construct a third-party client does not deserve a
properties class of its own:

```java
@Bean
public HealthPinger healthPinger(@Value("${ops.ping.url}") String url) {
    return new HealthPinger(url);
}
```

Note the shape of that example: **`@Value` on a constructor or method
parameter**, not on a field. Field-level `@Value` re-introduces every problem
field injection has — the object cannot be constructed in a test, and the
dependency is invisible in the signature.

## The trade-off

Typed binding costs a class per subsystem, plus the registration decision from
[chunk 7](07-registering-and-structuring.md). For a service with two settings
that is genuine ceremony, and pretending otherwise is how the rule gets
ignored.

The honest threshold: **the moment a prefix has more than a couple of keys, or
any key is read in more than one class, the properties type is cheaper.** Below
that, a parameter-level `@Value` is fine and the sprinkle has not started.
What is never fine is the middle state — a properties class *and* scattered
`@Value`s reading the same prefix, so there are two sources of truth about what
the subsystem accepts and only one of them is documented.

## Gotchas

**Symptom:** `@Value("${my.service.url}")` fails at startup with an unresolvable placeholder although a properties class defines `url`
**Cause:** the properties class binds `my.service.url` into an object; it does not create the property in the `Environment` unless a source actually supplies it
**Fix:** inject the properties bean instead of duplicating the key, or set the property in `application.yml` so both mechanisms can see it

**Symptom:** `@Value("${my.first-name}")` is null while the typed binding of the same prefix works
**Cause:** `@Value` has no relaxed binding — the placeholder must match the key exactly, and the file uses a different spelling
**Fix:** make the spellings identical, or read the value from the bound object where kebab/camel equivalence applies

**Symptom:** the same default appears with three different values across the codebase
**Cause:** each `@Value` carries its own `:default`, and they drift independently
**Fix:** move the defaults into one properties type where a single `@DefaultValue` or field initialiser is the only place they can be written

**Symptom:** a unit test cannot construct a service without starting Spring
**Cause:** field-level `@Value` — the values arrive by reflection after construction, so there is no constructor that produces a usable object
**Fix:** bind the subsystem's settings into a properties record and take it as a constructor parameter, so the test passes a literal

**Symptom:** `@ConditionalOnProperty` never matches for a property the properties class defaults
**Cause:** conditions read the `Environment`, which never saw the code-level default
**Fix:** state the intent on the condition rather than relying on the default:
```java
@ConditionalOnProperty(name = "my.service.enabled", matchIfMissing = true)
```

**Symptom:** a value that needs to be computed cannot be expressed in a properties class
**Cause:** the binder does not evaluate SpEL — that is a `@Value` feature
**Fix:** keep the computed value in a `@Value("#{…}")` on a parameter, and leave the configured values in the properties type; mixing the two mechanisms is correct here because they are doing different jobs

**Symptom:** a cron expression cannot be read from a properties record
**Cause:** `@Scheduled` takes a `String` attribute resolved from the `Environment`; there is no way to reach a bound bean from an annotation attribute
**Fix:** use the placeholder form `@Scheduled(cron = "${…}")`, and if the schedule also needs to be validated, declare the same key in the properties type so it is documented and constrained

## Interview questions

**★ `@Value` or `@ConfigurationProperties` — how do you decide?**
By how much configuration the thing has and how many places read it. Typed
binding wins as soon as a prefix has more than a couple of keys or any key is
read from more than one class: it gives relaxed binding, structured types,
validation at startup, IDE metadata and a testable value object. `@Value` on a
*parameter* is fine for a single value with no subsystem behind it, and it is
the only option for SpEL and for annotation attributes such as
`@Scheduled(cron = …)`. The state to avoid is both at once on the same prefix.

**★ Name a difference between the two that is not about style.**
Relaxed binding. `@ConfigurationProperties` matches kebab-case, camelCase and
the uppercase environment-variable form of the same key, because the `Binder`
normalises names. `@Value` resolves its placeholder literally against the
`Environment`, so a placeholder written `${my.first-name}` will not find a key
written `my.firstName`. Two other non-style differences: `@Value` supports SpEL
and the binder does not, and only the binder can produce lists, maps and nested
objects.

**★ Why doesn't a default in a properties class satisfy a `@Value` placeholder for the same key?**
Because the default belongs to the object, not to the configuration. Binding
reads the `Environment` and populates the object; it never writes back, so the
key genuinely does not exist as far as any other reader is concerned. The
placeholder therefore fails to resolve unless it supplies its own default, and
`@ConditionalOnProperty` on the same key behaves as if it were unset — which is
why `matchIfMissing` has to be stated rather than assumed.

**★ Is field-level `@Value` ever acceptable?**
It is the form to avoid, for the same reasons field injection is: the value
arrives by reflection after construction, so the class cannot be built with
`new` in a test, and nothing in the signature says the object needs
configuration. Where a single value genuinely belongs in a `@Value`, put it on a
constructor or method parameter, which keeps the object constructible and the
dependency visible.

**★ What can `@Value` do that typed binding cannot?**
Evaluate expressions. `@Value` accepts `#{…}` SpEL alongside `${…}` placeholders,
so it can compute a value from system properties, other beans or a conditional
expression, and the binder has no equivalent. It is also the only mechanism
available inside annotation attributes — `@Scheduled(cron = "${…}")`,
`@ConditionalOnExpression` — because an annotation attribute is a compile-time
constant that cannot reach a bound bean.

**★ You inherit a service with fifteen `@Value` fields. What is the migration?**
Create one record per prefix with the properties as components, register it with
`@ConfigurationPropertiesScan`, and take it as a constructor parameter — then
delete the fields. The valuable ordering detail is to move the *defaults* first
and reconcile them, because a sprinkle almost always has the same key defaulted
differently in different classes, and that divergence is a live bug that the
migration surfaces rather than creates.

---

← Prev: [Registering configuration properties](07-registering-and-structuring.md) · Index: [Configuration and profiles](README.md) · Next → [Nested types, collections and maps](09-nested-types-and-collections.md)
