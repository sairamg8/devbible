---
title: "Property and environment conditions"
sidebar_label: "6 · Property and environment conditions"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the `@ConditionalOnProperty` API javadoc
> (docs.spring.io/spring-boot/api — `prefix`, `name`, `value`, `havingValue`,
> `matchIfMissing`, the "must not be equal to `false`" rule and the
> all-names-must-pass rule) and the Spring Boot reference *Creating Your Own
> Auto-configuration · Condition Annotations* (the property, resource, web
> application, SpEL and platform condition families). Spring Boot 4.1.1,
> Spring Framework 7.0.x, JDK 25.

**Class and bean conditions fail loudly — a jar is present or it is not, a bean
exists or it does not, and both are visible in the build. Environment
conditions fail silently, because their input is a string in a YAML file that
nothing validates. A misspelled property key is not an error; it is a bean that
quietly does not exist, discovered later and somewhere else. That asymmetry is
why `@ConditionalOnProperty`'s two counter-intuitive defaults cause more
production incidents than the rest of the condition families put together.**

## `@ConditionalOnProperty` and its attributes

```java
@Bean
@ConditionalOnProperty(prefix = "acme.libx", name = "enabled", havingValue = "true")
LibXClient libXClient() { … }
```

| Attribute | Default | Meaning |
|---|---|---|
| `prefix` | `""` | Prepended to each name; the trailing dot is added for you if absent |
| `name` | `{}` | The property keys to test |
| `value` | `{}` | Alias for `name` |
| `havingValue` | `""` | The expected value |
| `matchIfMissing` | `false` | Whether an *absent* property matches |

### 🔴 `havingValue` left empty does not mean "any value"

The javadoc's rule is that the property must **not** be equal to `false`. So:

| Property value | Matches with no `havingValue`? |
|---|---|
| `true` | ✅ |
| `false` | ❌ |
| `banana` | ✅ |
| *absent* | ❌ — governed by `matchIfMissing`, not by this rule |

That is deliberate: it makes the everyday `enabled=true` / `enabled=false`
toggle work without configuring anything. It surprises everyone who expects
either a strict comparison or a presence check, and it means a typo in the
*value* (`ture`) silently enables the feature while a typo in the *key* silently
disables it.

**`@ConditionalOnBooleanProperty` exists to remove this ambiguity** and is the
better choice whenever the flag is genuinely a boolean:

```java
@Bean
@ConditionalOnBooleanProperty(name = "acme.libx.enabled")
LibXClient libXClient() { … }
```

### 🔴 `matchIfMissing` defaults to `false`

An absent property does not match, so the guarded bean is not created. That is
the right default for an opt-in feature and the wrong one for anything that
should be on unless explicitly disabled — which has to be stated:

```java
@ConditionalOnProperty(prefix = "acme.libx", name = "enabled", matchIfMissing = true)
```

The failure mode is nasty precisely because it is environment-shaped: the
feature works in the environment where somebody set the property, and is
silently missing in every environment where nobody did.

### All listed names must pass

```java
// BOTH acme.libx.enabled AND acme.libx.url must satisfy the test
@ConditionalOnProperty(prefix = "acme.libx", name = {"enabled", "url"})
```

The javadoc is explicit: *"If multiple names are specified, all of the
properties have to pass the test for the condition to match."* Nothing tells you
which one failed, so multi-name conditions are worth splitting unless the
settings are genuinely inseparable.

## The other environment families

**`@ConditionalOnExpression`** takes a SpEL expression and is the escape hatch
when no dedicated condition fits — combining two properties, or testing a
property against a range:

```java
@ConditionalOnExpression("${acme.libx.enabled:false} and ${acme.libx.pool-size:0} > 0")
```

Always supply a default inside the placeholder (`:false`). Without it, SpEL
throws when the property is absent, where a property condition would simply not
match — the same input producing an exception instead of a false.

**`@ConditionalOnResource`** asks whether a file or classpath resource exists,
using Spring's resource syntax:

```java
@ConditionalOnResource(resources = "classpath:acme-libx-overrides.properties")
```

**The web-application family** distinguishes deployment shapes rather than
configuration:

| Annotation | Matches when |
|---|---|
| `@ConditionalOnWebApplication` | The context is a web application (servlet or reactive; the `type` attribute narrows it) |
| `@ConditionalOnNotWebApplication` | It is not — a batch job, a CLI |
| `@ConditionalOnWarDeployment` | A traditional war in an external container |
| `@ConditionalOnNotWarDeployment` | An embedded server, which is the normal Boot case |

`@ConditionalOnWarDeployment` is how an auto-configuration avoids trying to
configure an embedded Tomcat that the deployment does not own.

**The platform family** — `@ConditionalOnJava` (a JDK version range),
`@ConditionalOnCloudPlatform` (Kubernetes, Cloud Foundry, Heroku, and so on),
`@ConditionalOnJndi`, `@ConditionalOnThreading` — answers questions about the
runtime. `@ConditionalOnThreading` is the modern one: it distinguishes platform
threads from virtual threads, which is how Boot switches an executor's
implementation when
[virtual threads](../../phase-6-concurrency/02-platform-vs-virtual-threads/README.md)
are enabled.

## Where this shows up as a bug

A bean that a property condition silently declined to create produces a
`NoSuchBeanDefinitionException` **somewhere else entirely** — in whatever tried
to inject it — and that message names the type it wanted, not the property that
was missing. The causal distance between *"I wrote `acme.libx.enabld` in
`application-prod.yml`"* and *"startup failed injecting `LibXClient` into
`InvoiceService`"* is the whole reason the conditions report exists, and that is
[chunk 7](07-the-conditions-report.md).

It is also the argument for binding configuration with
`@ConfigurationProperties` rather than scattering raw keys: typed configuration
can be validated and can fail at startup naming the property, which is covered
in **[Phase 9 topic 06 — Configuration and profiles](../06-configuration-and-profiles/README.md)**.

## The trade-off

Property conditions put the wiring decision in the hands of whoever edits the
configuration, which is exactly what you want for a feature flag and exactly
what you do not want for a structural choice. Every property condition is a code
path that some environment is not exercising, and a flag that has been `true`
everywhere for a year is a branch nobody has tested `false` in since it was
written. They are cheap to add and expensive to keep; each one deserves a
removal date.

## Gotchas

**Symptom:** you set `acme.feature.enabled=false` and the feature stays on
**Cause:** the value is not literally `false` — `False`, `FALSE`, or a trailing space from a Helm template will all fail the "must not be equal to `false`" test and therefore *match*
**Fix:** use the annotation that parses a boolean rather than comparing a string:
```java
@ConditionalOnBooleanProperty(name = "acme.feature.enabled")
```

**Symptom:** a feature flagged with `@ConditionalOnProperty` is off in every environment, including ones where nobody disabled it
**Cause:** `matchIfMissing` defaults to `false`, so an unset property means "do not create the bean". The team assumed the default was on
**Fix:** state the intent, and put the property in `application.properties` too so the answer is readable in the repository instead of implied by an annotation default:
```java
@ConditionalOnProperty(prefix = "acme.libx", name = "enabled", matchIfMissing = true)
```

**Symptom:** a `@ConditionalOnProperty` with several `name` entries never matches, though each property looks individually correct
**Cause:** all listed properties must pass; one is absent or fails, and the annotation reports nothing about which
**Fix:** split independent settings into separate conditions so the conditions report names the one that failed, and reserve multi-name conditions for genuinely inseparable properties

**Symptom:** `@ConditionalOnExpression` throws at startup where an equivalent `@ConditionalOnProperty` would simply not match
**Cause:** SpEL evaluates the placeholder eagerly, and `${acme.enabled}` with no default cannot be resolved when the property is absent
**Fix:** always supply a default inside the placeholder:
```java
@ConditionalOnExpression("${acme.enabled:false}")
```

**Symptom:** the same property key works when set as an environment variable but not in `application.yml`, or vice versa
**Cause:** condition annotations read the `Environment`, so relaxed binding applies to the *lookup* — but the `prefix` + `name` you wrote must still form the canonical key. `ACME_LIBX_ENABLED` binds to `acme.libx.enabled`, not to `acme.libxEnabled`
**Fix:** write the canonical kebab-case key in the annotation and let relaxed binding handle the environment-variable form; the mapping rules are in **[Phase 9 topic 06 — Configuration and profiles](../06-configuration-and-profiles/README.md)**

**Symptom:** an auto-configuration meant for embedded deployments tries to configure a server in a war deployed to an external container
**Cause:** it guards on `@ConditionalOnWebApplication`, which is true for both embedded and war deployments
**Fix:** use the deployment-shape condition instead:
```java
@ConditionalOnNotWarDeployment
```

**Symptom:** a feature flag has been `true` in production for a year and turning it off breaks the application
**Cause:** the `false` branch has not been exercised since it was written; the condition preserved dead code and gave everyone the impression it was still a live option
**Fix:** delete the condition and the unused branch. A flag with no plausible future flip is not configuration, it is an untested code path

**Symptom:** a property is plainly present in `application-prod.yml`, the condition still does not match, and the same config works in staging
**Cause:** profile-specific documents are only loaded when that profile is active. If `prod` was never activated — a missing `SPRING_PROFILES_ACTIVE`, or a profile group that does not include it — the file is never read, so the property does not exist as far as the condition is concerned
**Fix:** confirm what is actually active before blaming the condition, and put the safe default in the non-profile-specific `application.yml` so an unactivated profile degrades rather than disappears:
```yaml
acme.libx.enabled: false          # application.yml — always loaded
```

## Interview questions

**★ `@ConditionalOnProperty` with no `havingValue` — when does it match?**
When the property is present and its value is **not** the string `false`. It is
not an exact match and not a presence check: `enabled=true` matches,
`enabled=false` does not, and `enabled=anything-else` does. The rule exists so
the everyday on/off toggle works without configuring the annotation, but it
means a typo in the value silently enables the feature while a typo in the key
silently disables it. For a plain boolean, `@ConditionalOnBooleanProperty` says
what you mean.

**★ What does `matchIfMissing` default to, and why does that default cause outages?**
`false` — an absent property does not match, so the guarded bean is not created.
That is correct for opt-in features and wrong for anything meant to be on unless
explicitly disabled. The failure is environment-shaped and therefore survives
review: it works in the environment where somebody set the property and is
silently missing everywhere else, surfacing much later as a
`NoSuchBeanDefinitionException` in an unrelated component that tried to inject
the bean.

**★ Why is a missing property harder to debug than a missing class?**
Because nothing validates it. A missing class fails the build, or fails
loudly at load time with a name you can search for. A missing property is
indistinguishable from a deliberate decision not to set it — the condition
returns false, no bean is registered, and no message is produced at the point
the decision is made. The exception surfaces later, in whatever tried to inject
the bean, naming a type rather than the property that actually caused it.

**★ You have three `@ConditionalOnProperty` names on one annotation and it never matches. What is going on?**
All of them must pass — the javadoc states that if multiple names are specified,
every property has to satisfy the test for the condition to match. The
annotation gives no indication which one failed, so the practical move is to
split independent settings into separate conditions, at which point the
conditions report names the specific failing one. Keep multiple names only where
the properties are genuinely inseparable and partial configuration would be
meaningless.

**★ When would you reach for `@ConditionalOnExpression` over `@ConditionalOnProperty`, and what is the catch?**
When the decision genuinely combines inputs — two properties together, or a
numeric comparison — since the property condition can only test values against
`havingValue`. The catch is that SpEL resolves placeholders eagerly, so
`${acme.enabled}` with no default throws when the property is absent, whereas
the property condition would simply not match. Always write the default inside
the placeholder, and prefer the dedicated condition whenever a single property
is all you are testing.

**★ What is the difference between `@ConditionalOnWebApplication` and `@ConditionalOnNotWarDeployment`?**
`@ConditionalOnWebApplication` asks what *kind of context* this is — a servlet
or reactive web application versus a batch job or CLI — and its `type` attribute
narrows which. `@ConditionalOnNotWarDeployment` asks about the *deployment
shape*: an embedded server rather than a war handed to an external container.
Both are true for an ordinary Boot service with embedded Tomcat, which is why
the distinction only shows up when someone deploys a traditional war and an
auto-configuration starts trying to configure a server it does not own.

**★ What is `@ConditionalOnThreading` for?**
It lets an auto-configuration branch on whether the application is running with
platform threads or virtual threads, so Boot can pick a different executor
implementation when virtual threads are enabled rather than handing you a
thread pool that defeats their purpose. It is a good example of a condition
whose input is neither the classpath nor configuration in the ordinary sense,
but a runtime capability — and of how conditions let one library ship sensible
behaviour for two very different execution models.

**★ How do profiles interact with condition annotations?**
Only through the `Environment` — condition annotations have no profile
awareness of their own. A profile decides which configuration documents are
loaded, and therefore which properties exist; the condition then reads whatever
the resulting `Environment` contains. The practical consequence is that a
property condition failing is frequently not a condition problem at all but an
activation problem: the profile-specific file holding the property was never
loaded because that profile was not active. It is why the first diagnostic step
is to establish which profiles are actually active rather than to re-read the
annotation.

**★ Why is `@ConditionalOnResource` risky for anything but classpath resources?**
Because a `file:` location is a claim about the filesystem of whatever machine
the process ends up on, and nothing verifies it at build time. A path that
exists on a developer's laptop and in a mounted volume during integration
testing may simply be absent in a container, and the failure is the usual silent
one — the condition returns false and the configuration is not applied. A
`classpath:` resource travels inside the artifact and is therefore the same
everywhere the artifact runs, which is the property you actually want from a
condition.

---

← Prev: [The bean-condition attributes](05-bean-condition-attributes.md) · Index: [Boot auto-configuration](README.md) · Next → [The conditions report](07-the-conditions-report.md)
