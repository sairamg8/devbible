---
title: "Boot auto-configuration"
sidebar_label: "05 · Boot auto-configuration"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Boot reference *Using Spring Boot ·
> Auto-configuration*, *Build Systems · Starters* and *Creating Your Own
> Auto-configuration* (docs.spring.io/spring-boot/reference), the
> `@ConditionalOnMissingBean`, `@ConditionalOnProperty` and
> `ConditionEvaluationReport` API javadocs, the Actuator `conditions` endpoint
> documentation, and the **Spring Boot 4.0 Migration Guide** and 4.0.0 release
> announcement for the modularization and starter renames. Spring Boot 4.1.1,
> Spring Framework 7.0.x, JDK 25.

**Auto-configuration is not magic and it is not reflection over your code. It is
a plain list of class names, read from text files inside jars, whose entries are
ordinary `@Configuration` classes wrapped in guards that usually evaluate to
false. Every one of them is imported on every startup — all of them, always —
and what you end up with is whatever survived the conditions. Once that sentence
is concrete, "why is this bean not here" stops being a mystery and becomes a
lookup, because the framework computed the answer at startup and kept it.**

This topic runs to eight files. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What a starter actually is](01-what-a-starter-is.md)** | The empty jar; `spring-boot-starter-parent` vs the `spring-boot-dependencies` BOM; the naming convention; 🔴 Boot 4's modularization and the `web` → `webmvc` renames; `spring-boot-starter-classic` |
| 2 | **[What `@SpringBootApplication` triggers](02-what-springbootapplication-triggers.md)** | The three meta-annotations; the root-package rule; the exact `AutoConfiguration.imports` path and why `spring.factories` fails silently; `@AutoConfiguration` ordering and its caveat; Boot 4's package relocations |
| 3 | **[Class conditions](03-class-conditions.md)** | The condition families; how `@ConditionalOnClass` names a class it never loads; where the ASM trick stops working and the nested-`@Configuration` fix; `@ConditionalOnMissingClass` and its unvalidated strings |
| 4 | **[The back-off contract](04-bean-conditions-and-back-off.md)** | Why "define your own bean and Boot backs off" works; the ordering guarantee as the whole mechanism; the half of the javadoc warning about *other* auto-configurations; class-level vs method-level guards |
| 5 | **[The bean-condition attributes](05-bean-condition-attributes.md)** | `value`/`type`/`name`/`annotation`; `parameterizedContainer` and the generics blind spot; `search` and context hierarchies; `ignored`; `@ConditionalOnBean` and `@ConditionalOnSingleCandidate` |
| 6 | **[Property and environment conditions](06-property-and-environment-conditions.md)** | `@ConditionalOnProperty`'s two counter-intuitive defaults; the all-names-must-pass rule; `@ConditionalOnExpression`, resource, web-deployment and platform conditions |
| 7 | **[The conditions report](07-the-conditions-report.md)** | `--debug` and what it really enables; the four sections and their Actuator field names; why negative matches are where you look; reading it as a queryable artifact |
| 8 | **[Excluding it and writing your own](08-excluding-and-writing-your-own.md)** | `exclude` / `excludeName` / `spring.autoconfigure.exclude`; why exclusion is usually the wrong fix; the shape of an internal starter; testing every branch with `ApplicationContextRunner` and `FilteredClassLoader` |

## Why this runs to eight files

- **Starters and auto-configuration are two mechanisms that people fuse into
  one.** A starter is a POM full of dependencies; auto-configuration is a
  reaction to what those dependencies put on the classpath. They are shipped
  together and taught together, which is why "I added the starter and it worked"
  is such a common substitute for understanding either — and why Boot 4's
  modularization broke so many applications in ways nobody could explain.
- **The conditions divide by what they interrogate, and that decides how they
  fail.** Class conditions ask about the classpath, which is fixed at build time
  and visible in the dependency tree. Bean conditions ask about the registry *at
  that instant*, which makes ordering part of their meaning. Property conditions
  ask about a string in a YAML file that nothing validates. Three chunks,
  because three genuinely different debugging stories.
- **The back-off contract earns its own chunk, and its API earns another.** The
  contract is a consequence of ordering, not a feature — that is the idea. The
  attributes exist because the plain form silently fails in specific,
  well-documented ways (generics, hierarchies, self-registration), and those are
  reference material you return to rather than an argument you follow once.
- **Reading the report and writing your own are the two things that turn this
  from knowledge into a skill.** Everything before them explains what the
  framework does; these two are what you actually do on a Tuesday.

## Where this connects

- **[Dependency scopes](../../phase-8-build-dependencies/02-dependency-scopes/README.md)**
  — a starter is nothing but transitive dependencies, so what a starter *does*
  to your build is exactly the scope and transitivity rules from Phase 8.
- **[Transitive dependencies and mediation](../../phase-8-build-dependencies/03-transitive-and-mediation/README.md)**
  — the `spring-boot-dependencies` BOM is `import` scope, and "the dependency
  graph is your configuration" is why mediation matters more in a Boot service
  than anywhere else.
- **[The classpath](../../phase-0-platform-jvm/05-packages-classpath/02-the-classpath.md)**
  and
  **[classloaders and the two errors](../../phase-0-platform-jvm/05-packages-classpath/03-classloaders-and-the-two-errors.md)**
  — `@ConditionalOnClass` is a question about the classpath, and the
  `NoClassDefFoundError` it produces when the guard is misplaced is the same
  mechanism Phase 0 explains.
- **[Jar anatomy](../../phase-8-build-dependencies/08-jar-anatomy/01-the-format.md)**
  — the `AutoConfiguration.imports` file is a resource under `META-INF`, and a
  fat jar is where all the copies of it end up.
- **[Annotation processing](../../phase-8-build-dependencies/09-annotation-processing/01-how-processors-work.md)**
  — the configuration-metadata processor that gives IDEs completion for your
  `@ConfigurationProperties` is an ordinary annotation processor.
- **[Platform vs virtual threads](../../phase-6-concurrency/02-platform-vs-virtual-threads/README.md)**
  — `@ConditionalOnThreading` is how one auto-configuration ships sensible
  behaviour for both execution models.
- **[Phase 9 topic 06 — Configuration and profiles](../06-configuration-and-profiles/README.md)** — the
  properties that condition annotations read, bound properly and validated at
  startup instead of scattered as raw keys.
- **[Phase 9 topic 13 — Actuator](../13-actuator/README.md)** — the `conditions`
  endpoint is the production-safe way to read the report, and it needs locking
  down.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [What a starter actually is](01-what-a-starter-is.md)
