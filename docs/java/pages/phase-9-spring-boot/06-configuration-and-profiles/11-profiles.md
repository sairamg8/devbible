---
title: "Profiles: activation, expressions and groups"
sidebar_label: "11 · Profiles and groups"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Boot reference *Profiles*
> (docs.spring.io/spring-boot/reference/features/profiles.html —
> `spring.profiles.active`, `spring.profiles.default` and the implicit `default`
> profile, `spring.profiles.include`, `spring.profiles.group.*`,
> `SpringApplication.setAdditionalProfiles`, profile-name validation and
> `spring.profiles.validate`) and the Spring Framework reference for `@Profile`
> and profile expressions
> (docs.spring.io/spring-framework/reference/core/beans/environment.html).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**A profile is a label on the `Environment` and nothing more. Everything that
looks like profile machinery — `@Profile`, profile-specific files,
`spring.config.activate.on-profile` — is some other mechanism asking whether a
label is present. Holding that in mind is what stops profiles turning into a
second, undocumented configuration language, which is the state most codebases
with more than four of them have reached.**

## Two independent consumers of one label

The set of active profiles is consumed by two mechanisms that have nothing else
in common:

- **Bean selection.** `@Profile` on a `@Component`, `@Configuration`,
  `@ConfigurationProperties` type or `@Bean` method decides whether that bean
  definition is registered at all.
- **Config-data activation.** Profile-specific files and documents guarded by
  `spring.config.activate.on-profile` decide which *values* are loaded
  ([chunk 3](03-multi-document-and-yaml-traps.md)).

Almost every profile confusion is a mechanism mix-up: expecting `@Profile` to
change a property, or expecting a profile-specific file to remove a bean.

## `@Profile` and profile expressions

```java
@Configuration(proxyBeanMethods = false)
@Profile("production")
public class ProductionConfiguration { }
```

The argument is not just a name — it is an **expression**:

| Operator | Meaning | Example |
|---|---|---|
| `!` | not | `@Profile("!prod")` |
| `&` | and | `@Profile("prod & metrics")` |
| `\|` | or | `@Profile("staging \| prod")` |
| `( )` | grouping | `@Profile("(dev \| test) & !ci")` |

⚠️ **`&` and `|` cannot be mixed without parentheses.** `"a & b | c"` is not
accepted; the intent has to be written explicitly as `"(a & b) | c"`. That is a
deliberate refusal to guess at precedence, and it fails at parse time rather
than quietly choosing one reading.

`@Profile` also works on a `@Bean` method, which is the finer-grained form —
one configuration class, two implementations of the same bean:

```java
@Bean
@Profile("!cloud")
public StorageClient localStorage() { … }

@Bean
@Profile("cloud")
public StorageClient objectStorage() { … }
```

## Activating profiles

```yaml
spring:
  profiles:
    active: "dev,hsqldb"
```

```bash
java -jar app.jar --spring.profiles.active=dev,hsqldb
SPRING_PROFILES_ACTIVE=dev,hsqldb java -jar app.jar
```

`spring.profiles.active` obeys the ordinary precedence rules from
[chunk 1](01-the-environment-and-precedence.md) — the highest source wins, and
it **replaces** rather than adds. That is why setting it on the command line
overrides whatever `application.yml` declared, which is usually what you want
and occasionally a surprise.

**`spring.profiles.default`** names the profile to use when none is active. With
nothing configured, that implicit profile is called `default`, so an
`application-default.yml` is loaded on a plain local run — a fact worth knowing
before somebody's forgotten `application-default.yml` reaches a server.

**`spring.profiles.include`** adds profiles rather than replacing them:

```yaml
spring:
  profiles:
    include:
      - "common"
      - "local"
```

Included profiles are added **before** any `spring.profiles.active` profiles,
which matters because later-activated profiles' files are read later and
therefore win.

## Profile groups

A group turns one name into several:

```yaml
spring:
  profiles:
    group:
      production:
        - "proddb"
        - "prodmq"
```

`--spring.profiles.active=production` then activates `production`, `proddb` and
`prodmq` together.

Groups are the answer to the commonest profile smell: a deployment command that
has grown to `--spring.profiles.active=prod,proddb,prodmq,metrics,tracing`,
where nobody can say which of those five the application actually requires. The
group moves that knowledge into the artifact, where it is versioned and
reviewed, and leaves the operator with one name.

## Setting profiles from code

```java
public static void main(String[] args) {
    SpringApplication app = new SpringApplication(MyApplication.class);
    app.setAdditionalProfiles("embedded");
    app.run(args);
}
```

`setAdditionalProfiles` **adds** to whatever the environment supplies; the
`ConfigurableEnvironment` API can also set the active set outright. Both are
appropriate for a launcher that knows something the environment cannot — a test
harness, an embedded-mode entry point — and inappropriate as a way of choosing
production configuration, because it puts a deployment decision inside the
artifact.

## Profile names are validated

By default a profile name may contain letters, numbers and `-`, `_`, `.`, `+`,
`@`, and must start and end with a letter or number. `spring.profiles.validate=false`
relaxes it. The check exists because profile names become file names —
`application-{profile}.yml` — and a name that cannot be a filename produces a
profile whose configuration silently never loads.

## The trade-off

Profiles give you one artifact that behaves correctly in several environments
without a rebuild, and profile groups keep the operator's side of that down to a
single word. That is the entire premise of promoting a build through
environments.

The cost is combinatorial and it is paid later. **Every profile doubles the
number of configurations that exist and nobody tests them all.** Two profiles
give four combinations; five give thirty-two, of which perhaps three are ever
started. The failures that result are the worst kind — a bean that only exists
in a combination nobody ran, a property whose value depends on activation order.
The discipline that keeps profiles useful is to have **few of them, one per
environment, activated as a group**, and to express feature-level variation as
ordinary properties instead ([chunk 12](12-profile-files-and-traps.md)).

## Gotchas

**Symptom:** `@Profile("a & b | c")` fails at startup with a parse error
**Cause:** `&` and `|` may not be mixed without parentheses — the expression parser refuses to guess precedence
**Fix:** state the grouping:
```java
@Profile("(a & b) | c")
```

**Symptom:** setting `spring.profiles.active` on the command line loses the profiles declared in `application.yml`
**Cause:** the property replaces rather than adds, and the command line is a higher-priority source
**Fix:** put the always-on profiles in `spring.profiles.include`, which adds, and leave `active` for the environment-selecting one

**Symptom:** an `application-default.yml` written for local development is loaded on a server
**Cause:** when no profile is active the implicit `default` profile applies, so its file is read
**Fix:** always set `spring.profiles.active` in deployed environments, and treat `application-default.yml` as a local-only file that must never contain anything harmful

**Symptom:** the deployment command carries five profile names and nobody knows which are required
**Cause:** profile composition is being expressed by the operator instead of by the artifact
**Fix:** define a group and deploy with one name:
```yaml
spring.profiles.group.production: "proddb,prodmq,metrics"
```

**Symptom:** a profile-specific file is never loaded and no error appears
**Cause:** the profile name contains a character that is not permitted, so it was rejected — or it differs in case from the file name
**Fix:** keep profile names to lowercase letters, digits and dashes; `spring.profiles.validate=false` exists but removes the check that would have told you

**Symptom:** a bean annotated `@Profile("prod")` is missing in an environment where `prod` is genuinely active
**Cause:** the profile is active on a *different* `Environment` than expected — typically a test that builds its own context, or a child context
**Fix:** assert the active profiles rather than assuming them; in tests set them explicitly with `@ActiveProfiles`

**Symptom:** a bean exists in `dev` and `test` but the class carries three separate `@Profile` annotations across three classes
**Cause:** `@Profile` is being used as a feature flag, one class per combination
**Fix:** use one expression — `@Profile("dev | test")` — or better, a property-driven condition so the switch does not multiply profiles

## Interview questions

**★ What actually is a profile?**
A label on the `Environment` — a name in the set of active profiles, with no
behaviour of its own. Two independent mechanisms read that set: bean selection
via `@Profile`, which decides whether a bean definition is registered, and
config-data activation, which decides which files and documents contribute
values. Keeping those separate explains most profile confusion, because
expecting `@Profile` to change a property, or a profile-specific file to remove
a bean, is asking one mechanism to do the other's job.

**★ What can you write inside `@Profile`?**
A profile expression, not just a name: `!` for negation, `&` for and, `|` for
or, and parentheses for grouping — so `@Profile("(dev | test) & !ci")` is valid.
The rule to remember is that `&` and `|` cannot be mixed without parentheses;
the parser refuses to assume a precedence and fails instead, which is the right
trade for something that silently changes which beans exist.

**★ `spring.profiles.active` versus `spring.profiles.include` versus a group?**
`active` sets the active profiles and replaces any lower-priority value, so a
command-line setting discards what `application.yml` declared. `include` adds
profiles to whatever is active, and its additions are placed before the active
ones. A group maps one profile name onto several, so activating `production`
activates `proddb` and `prodmq` too. Use `active` for the single
environment-selecting name, groups for the composition that name implies, and
`include` for profiles that are always on regardless of environment.

**★ What is the `default` profile?**
The profile that applies when no other is active. It is implicitly named
`default`, so `application-default.yml` is loaded on a run with nothing set, and
`spring.profiles.default` renames it. The practical consequence is a trap:
`application-default.yml` is a local-development file by accident of naming, and
it will be read by any deployed instance that forgets to set
`spring.profiles.active`.

**★ Why are lots of profiles a problem?**
Because they multiply. Each profile doubles the number of possible
configurations, and only a handful are ever started, so the untested
combinations are where the failures live: a bean that exists only in a pairing
nobody ran, or a value whose result depends on activation order. Profiles are
for *environments*, of which there are few and each of which is exercised.
Feature-level variation belongs in ordinary properties, which compose without
multiplying and can be flipped without a redeploy.

**★ How do you activate a profile from code, and when is that appropriate?**
`SpringApplication.setAdditionalProfiles(…)` before `run`, which adds to what the
environment supplies, or the `ConfigurableEnvironment` API to set the active set
outright. It is appropriate when the launcher knows something the environment
cannot — an embedded-mode entry point, a test harness, an integration fixture.
It is inappropriate for choosing production configuration, because it moves a
deployment decision into the artifact and defeats the point of having one build
that runs everywhere.

**★ Do profile names have rules?**
Yes. By default a name may contain letters, digits and `-`, `_`, `.`, `+`, `@`,
and must begin and end with a letter or digit; `spring.profiles.validate=false`
turns the check off. The rule exists because profile names become file names in
`application-{profile}.yml`, so an unusable name yields a file that is never
loaded and no error — exactly the silent failure the validation was added to
prevent.

---

← Prev: [Conversion, durations and data sizes](10-conversion-and-units.md) · Index: [Configuration and profiles](README.md) · Next → [Profile-specific files and the traps](12-profile-files-and-traps.md)
