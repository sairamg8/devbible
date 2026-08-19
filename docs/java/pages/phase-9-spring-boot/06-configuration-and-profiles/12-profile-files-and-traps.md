---
title: "Profile-specific files and the traps"
sidebar_label: "12 · Profile files and traps"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Boot reference *Profiles* and
> *Externalized Configuration · External Application Properties*
> (docs.spring.io/spring-boot/reference — profile-specific files, the
> config-data sub-order, and the documented restriction that
> `spring.profiles.active`, `spring.profiles.default`, `spring.profiles.include`
> and `spring.profiles.group` may be used only in non-profile-specific
> documents, enforced with `InvalidConfigDataPropertyException`). Spring Boot
> 4.1.0, Spring Framework 7.0.x, JDK 25.

**Profile-specific files are the good half of profiles: the variation lives in
one obvious place, named after the environment, and the precedence rules that
govern it are the ones you already know. The traps are all instances of a single
constraint — the set of active profiles must be completely decided before any
profile-specific document is read — plus one design mistake, which is reaching
for `@Profile` when the thing that varies is a value rather than a bean.**

## Where the files sit

`application-{profile}.yml` next to `application.yml` is loaded when that
profile is active, and it **sharpens rather than replaces** — the generic file
still supplies every key the profile-specific one does not mention.

The config-data sub-order from [chunk 1](01-the-environment-and-precedence.md)
governs it: packaged generic, packaged profile-specific, external generic,
external profile-specific. Two things follow that regularly surprise people:

- an **external** `application.yml` beats a **packaged** `application-prod.yml`,
  because inside/outside is the outer sort key and profile-specific is the
  inner one;
- with several profiles active, **the file of the profile activated later
  wins**, so activation order is part of the configuration.

## The constraint behind every profile-file trap

**A profile-specific document may not change which profiles are active.** These
four are rejected inside one:

- `spring.profiles.active`
- `spring.profiles.default`
- `spring.profiles.include`
- `spring.profiles.group`

and so is `spring.config.activate.on-profile` inside a file that is *already*
profile-specific. The failure is `InvalidConfigDataPropertyException` at
startup, which names the property — a good failure, loud and immediate.

```yaml
# application.yml — valid
spring:
  profiles:
    active: "prod"
---
# INVALID: a profile-activated document setting active profiles
spring:
  config:
    activate:
      on-profile: "prod"
  profiles:
    active: "metrics"
```

The reason is not arbitrary. Config data is processed in two passes: one to
discover which profiles are active, and one to load the documents those profiles
select. If a profile-selected document could add a profile, the first pass would
have to be re-run, and a file could activate a file that activates the first
file. Boot forbids the cycle rather than trying to converge on it.

**The consequence to plan around:** a profile cannot bootstrap its own
environment. `application-prod.yml` cannot say "and also turn on `metrics`" —
that composition belongs in `spring.profiles.group.prod` in the **generic**
file, where the first pass can see it.

## Why `@Profile` on a `@ConfigurationProperties` bean is usually wrong

This is the most common profile design mistake, and it is worth taking apart.

```java
@Profile("prod")                       // ⚠️ usually the wrong tool
@ConfigurationProperties("billing")
public record BillingProperties(URI endpoint, String apiKey) { }
```

Three things go wrong.

**Injection stops compiling in the other environments.** The bean does not exist
outside `prod`, so every component that injects it must also be `@Profile("prod")`,
and the annotation spreads until the profile is a parallel copy of the
application. The failure in a `dev` run is a `NoSuchBeanDefinitionException`
from a class that has nothing to do with profiles.

**It is the wrong axis.** What actually varies between environments is the
*values*, and profile-specific files already vary values. One properties type
plus `application-prod.yml` gives every environment a `BillingProperties` with
the right contents, which is what the calling code wanted.

**It is untestable.** A test that wants billing enabled has to activate a
profile, and a test that wants it disabled has to run in a context where the
bean is absent — so the two cases cannot share a context and slice tests need
per-profile variants.

**The property-driven alternative:**

```java
@ConfigurationProperties("billing")
public record BillingProperties(boolean enabled, URI endpoint, String apiKey) { }

@Bean
@ConditionalOnProperty(name = "billing.enabled", havingValue = "true")
public BillingClient billingClient(BillingProperties properties) { … }
```

Now the properties type always exists, the *client* is what appears and
disappears, the switch is a property that any test can set with
`@SpringBootTest(properties = "billing.enabled=true")`, and an operator can flip
it without a profile.

**When `@Profile` is right:** when the *implementation* genuinely differs — a
stub mailer in `dev`, an in-memory queue in `test`, a real client in `prod`. That
is bean selection, which is what `@Profile` is for. Varying a value is not.

## The trade-off

Profile-specific files are the cheapest possible mechanism for environment
variation: no annotations, no conditions, one file per environment named after
it. Their weakness is invisibility. The effective configuration of a running
instance is spread over the generic file plus one file per active profile, in an
order that depends on how the profiles were activated, and nothing in the
repository shows the result. That is precisely what the `env` and `configprops`
Actuator endpoints exist to answer, and why "how many profiles are active in
production" is a question with an operational cost attached.

## Gotchas

**Symptom:** startup fails with `InvalidConfigDataPropertyException` naming `spring.profiles.active`
**Cause:** the property was set in a profile-specific file or in a document guarded by `spring.config.activate.on-profile`
**Fix:** move it to the generic `application.yml`, and express composition as a group there:
```yaml
spring.profiles.group.prod: "proddb,metrics"
```

**Symptom:** `application-prod.yml` cannot turn on an extra profile it needs
**Cause:** a profile-specific document may not change the active profile set — the two-pass processing forbids the cycle
**Fix:** declare the composition in the generic file with `spring.profiles.group`, where the first pass can see it

**Symptom:** a packaged `application-prod.yml` is overridden by a mounted `application.yml`
**Cause:** inside/outside is the outer sort key in the config-data order; any external file beats both packaged files
**Fix:** name the external file `application-prod.yml` so it occupies the highest config-data slot, or keep the external file to overrides only

**Symptom:** two active profiles both set a key and the winner changes between deployments
**Cause:** the file of the profile activated later wins, and activation order differs between the command line, the environment and a group
**Fix:** never let two profile files own the same key; give each profile a distinct concern, and use a group so the order is declared in the artifact rather than in a deployment command

**Symptom:** a `dev` run fails with `NoSuchBeanDefinitionException` for a properties type
**Cause:** the type is annotated `@Profile("prod")`, so it does not exist outside production, and something injects it unconditionally
**Fix:** remove `@Profile` from the properties type and put the condition on the client bean instead, with an `enabled` property that every environment can set

**Symptom:** a test cannot exercise both the enabled and disabled states of a feature
**Cause:** the feature is switched by a profile, so the two states need two contexts
**Fix:** switch it with a property so a single test class can vary it:
```java
@SpringBootTest(properties = "billing.enabled=false")
```

**Symptom:** nobody can say what configuration a production instance is running
**Cause:** the result is the generic file plus one file per active profile, combined in activation order, and no file shows the outcome
**Fix:** ask the instance — the `env` endpoint reports every source in order and `configprops` reports the bound result; keeping the number of active profiles small is what keeps that answer readable

## Interview questions

**★ Why can't `spring.profiles.active` be set in a profile-specific file?**
Because config data is processed in two passes — one to determine which profiles
are active, one to load the documents those profiles select — and a
profile-selected document that could add a profile would make the first pass's
result depend on its own output. Boot rejects it outright with
`InvalidConfigDataPropertyException` rather than trying to iterate to a fixed
point. The same restriction covers `spring.profiles.default`, `include` and
`group`, and `spring.config.activate.on-profile` inside an already
profile-specific file.

**★ Where does the composition of profiles belong, then?**
In the generic `application.yml`, as `spring.profiles.group.*`. The group is
visible to the first pass, so activating `prod` can bring in `proddb` and
`metrics` without any profile-specific document having to ask for them. That
also puts the composition in the artifact, where it is versioned and reviewed,
instead of in a deployment command where it is retyped.

**★ Two profiles are active and both set the same key. Which wins?**
The one whose file is read later, which is the profile activated later. That
makes activation order part of the configuration, and activation order is
decided partly by where the profiles came from — `include` entries are placed
before `active` ones, and a group expands in the order it was declared. The
robust answer is not to memorise the ordering but to avoid the situation: give
each profile a distinct concern so no key has two profile-specific owners.

**★ Why is `@Profile` on a `@ConfigurationProperties` type usually wrong?**
Because it deletes the bean rather than changing its values, and the values are
what actually vary between environments. Everything that injects the type then
has to be profiled too, so the annotation spreads until the profile is a
parallel copy of the application, and a missing bean in `dev` surfaces as a
`NoSuchBeanDefinitionException` from a class that has nothing to do with
profiles. The right shape is one properties type for every environment,
profile-specific *files* for the values, and a condition on the client bean if
something genuinely has to disappear.

**★ So when should `@Profile` be used?**
When the implementation differs, not the data: a stub mailer in `dev`, an
in-memory queue in `test`, the real client in `prod`. That is bean selection,
which is exactly what the annotation is for. The test that distinguishes the two
cases is whether the difference could be expressed as a value — if it could, it
belongs in a property or a profile-specific file, because those compose without
multiplying the number of possible applications.

**★ What is the operational cost of profile-specific files?**
That the effective configuration exists in no file. It is the generic file plus
one file per active profile, layered in activation order, and the repository
shows the inputs rather than the result. That is why the `env` and `configprops`
Actuator endpoints matter more in a profile-heavy application than anywhere
else, and why keeping the number of active profiles small is an operational
decision rather than an aesthetic one.

---

← Prev: [Profiles: activation, expressions and groups](11-profiles.md) · Index: [Configuration and profiles](README.md) · Next → [Twelve-factor configuration and secrets](13-twelve-factor-and-secrets.md)
