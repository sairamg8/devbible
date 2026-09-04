---
title: "Configuration and profiles"
sidebar_label: "06 · Configuration and profiles"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Boot reference *Externalized
> Configuration* and *Profiles*
> (docs.spring.io/spring-boot/reference/features/external-config.html and
> .../profiles.html), the Spring Framework reference for `@Profile`, `@Value`
> and the `Environment`
> (docs.spring.io/spring-framework/reference/core/beans/environment.html), the
> Spring Boot 4.0 release notes for `@ConfigurationPropertiesSource` and for
> Bean Validation no longer arriving transitively, and 12factor.net for the
> statement of factor III. Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Spring Boot does not have "a configuration file". It has an ordered stack of
property sources, a binder that maps names in those sources onto typed objects,
and a set of labels called profiles that two unrelated mechanisms consult. Every
question in this topic — why the environment variable is ignored, why the
default is invisible, why the list lost three entries, why the profile-specific
file will not activate a profile — is answered by knowing which of those three
things you are actually talking about.**

This topic runs to thirteen files. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The Environment and the precedence order](01-the-environment-and-precedence.md)** | The fifteen documented property sources and the principle behind their order, the config-data sub-order, why there is no merge and no error for a missing key, and `RandomValuePropertySource` |
| 2 | **[Config data: files, locations and imports](02-config-data-files-and-imports.md)** | The five default search locations, `spring.config.name` / `location` / `additional-location`, `spring.config.import` and its precedence rule, the `optional:` prefix and why strictness is the right default |
| 3 | **[Multi-document files and the YAML traps](03-multi-document-and-yaml-traps.md)** | `---` and `#---` separators and their exact rules, `spring.config.activate.on-profile` / `on-cloud-platform`, location groups with `;`, and SnakeYAML's YAML 1.1 implicit typing — the Norway problem, octal PINs, silent duplicate keys |
| 4 | **[Relaxed binding and environment variables](04-relaxed-binding-and-env-vars.md)** | The canonical form, the four accepted formats, the three exact environment-variable rules, why the lookup being pull-based makes the lossy mapping survivable, what `@Value` does and does not get, and where relaxed binding stops for map keys |
| 5 | **[Constructor binding and records](05-constructor-binding-and-validation.md)** | JavaBean versus constructor binding and the rule that decides, the three documented opt-outs, `@ConstructorBinding`, why `@Component` and `@Bean` cannot use it, the `-parameters` requirement, records, and what immutability costs |
| 6 | **[Defaults, absence and validation](06-defaults-and-validation.md)** | The two uses of `@DefaultValue`, why `Optional` is discouraged, `@Validated` with JSR-380 and nested `@Valid`, Boot 4's non-transitive Bean Validation, failing at startup rather than at first use, and the `static` `configurationPropertiesValidator` |
| 7 | **[Registering configuration properties](07-registering-and-structuring.md)** | Prefix rules, the four registration routes and which two disable constructor binding, why `@SpringBootApplication` does not enable scanning, the `<prefix>-<fqn>` bean name, and metadata with `@ConfigurationPropertiesSource` |
| 8 | **[Typed properties versus `@Value`](08-typed-properties-vs-value.md)** | What a `@Value` sprinkle costs, six things typed binding gives that `@Value` cannot, why a default in code is invisible to the `Environment` and to `@ConditionalOnProperty`, and the three places `@Value` still earns its keep |
| 9 | **[Nested types, collections and maps](09-nested-types-and-collections.md)** | Nesting as structure, `@Name` for reserved keywords, indexed lists and the contiguity rule, map keys as data and bracket notation, and the documented asymmetry — lists are replaced, maps are merged |
| 10 | **[Conversion, durations and data sizes](10-conversion-and-units.md)** | `ApplicationConversionService`, lenient enum matching, `Duration` / `Period` / `DataSize` and their suffixes, when `@DurationUnit` is a migration aid rather than a design choice, and custom converters with `@ConfigurationPropertiesBinding` |
| 11 | **[Profiles: activation, expressions and groups](11-profiles.md)** | Profiles as labels with two independent consumers, `@Profile` expressions and the parenthesis rule, `active` vs `default` vs `include`, profile groups, `setAdditionalProfiles`, name validation, and why profiles multiply |
| 12 | **[Profile-specific files and the traps](12-profile-files-and-traps.md)** | Where profile files sit in the order, the two-pass constraint that forbids a profile-specific document from changing the active profiles, and why `@Profile` on a `@ConfigurationProperties` type is usually the wrong tool |
| 13 | **[Twelve-factor configuration and secrets](13-twelve-factor-and-secrets.md)** | Factor III's test, one artifact many environments, `SPRING_APPLICATION_JSON`, why secrets do not belong in `application.yml`, configuration trees for Kubernetes and Docker secrets, and the honest list of what Boot does not do |

## Why this runs to thirteen files

- **Three separate subsystems wear the same name.** "Configuration" here means
  the `Environment` (chunks 1–3), the `Binder` (chunks 4–10) and profiles
  (chunks 11–12), and they fail in different ways for different reasons. A
  property that is ignored because a higher source won is a precedence problem;
  the same symptom from a mangled variable name is a binding problem. Merging
  them into one narrative is what produces the folklore this topic exists to
  replace.
- **The binder's rules are individually small and collectively large.** Relaxed
  binding, constructor binding, defaults, validation, registration, collections
  and conversion are seven mechanisms with seven distinct failure modes, and
  each of them is the *only* explanation for a particular symptom. Compressing
  any of them into a bullet list is how "it just doesn't bind" becomes an
  afternoon.
- **Profiles are two mechanisms and one design mistake.** Chunk 11 is what a
  profile *is* and how it is activated; chunk 12 is the constraint that makes
  half the traps inevitable, plus the argument against using `@Profile` where a
  property belongs. Those are different enough that combining them buries the
  design argument under the mechanics.
- **Secrets are not configuration.** Chunk 13 is separate because the honest
  content is as much about what Boot does *not* do — rotation, encryption,
  audit — as about the configuration-tree mechanism it does provide.

## Where this connects

- **[Topic 05 — Auto-configuration](../05-auto-configuration/README.md)** — the
  conditions that decide what gets configured read the same `Environment`. The
  interaction that catches people is that a default defined in a properties
  class is invisible to `@ConditionalOnProperty`, which is why
  [property and environment conditions](../05-auto-configuration/06-property-and-environment-conditions.md)
  insists on stating `matchIfMissing`.
- **[Topic 03 — Dependency injection](../03-dependency-injection/README.md)** —
  [`@Value` and why it is not configuration](../03-dependency-injection/03-setters-values-records.md)
  is the same argument this topic makes at length in chunk 8, and constructor
  binding is dependency injection's immutability argument applied to settings.
- **[Topic 04 — Bean scopes and lifecycle](../04-bean-scopes-lifecycle/README.md)** —
  a configuration-properties bean is a singleton shared across every request
  thread, which is why constructor binding's `final` fields are doing real work
  rather than aesthetic work.
- **[Topic 02 — The IoC container](../02-the-ioc-container/09-configuration-classes.md)** —
  `@Configuration` classes are where `@EnableConfigurationProperties` and
  `@Bean`-method binding are declared, and `proxyBeanMethods = false` appears
  throughout this topic for the reasons given there.
- **[Immutable design](../../phase-2-classes-objects/12-immutable-design/README.md)**
  and **[records](../../phase-2-classes-objects/08-records/README.md)** — a
  constructor-bound properties type is an ordinary immutable value object, and
  everything those topics claim about `final` fields and safe publication
  applies to it unchanged.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The Environment and the precedence order](01-the-environment-and-precedence.md)
