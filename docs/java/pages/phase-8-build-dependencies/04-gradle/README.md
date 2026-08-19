---
title: "Gradle"
sidebar_label: "04 · Gradle"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Gradle User Manual for 9.x
> (docs.gradle.org/current — *Gradle Wrapper*, *The Java Library Plugin*,
> *Version Catalogs*, *Build Cache*, *Configuration Cache*, *Build Scan
> Basics*), the **Gradle 9.7.0 release notes** (released 2026-08-07, the
> current version) and **9.0.0** release notes, gradle.org/whats-new/gradle-9,
> and — for the comparison — maven.apache.org's release history
> (**3.9.16**, 2026-05-13, is the current stable Maven; **4.0.0-rc-6**,
> 2026-08-04, is still a release candidate — Maven 4 is *not* GA).

**Maven asks "what is this project?" and runs a fixed lifecycle over the
answer. Gradle asks "what work exists, and what depends on what?" and runs a
task graph. Every real difference between the two tools falls out of that one
distinction: Gradle can skip, cache and parallelise work because it knows the
graph and the inputs of each node, and Gradle builds are harder to read
because that graph is produced by a program rather than declared in a
document. Both statements are true at once, and choosing between the tools
means deciding which of them costs you more.**

This topic runs well past one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The model: a task graph, and two phases](01-the-model-and-the-phases.md)** | Task graph vs Maven's lifecycle, the initialization/configuration/execution stages, why work in the configuration phase is a smell, configuration avoidance, inputs and outputs as the thing that makes the graph more than an order |
| 2 | **[The DSL and the script](02-the-dsl-and-the-script.md)** | Kotlin DSL vs Groovy DSL and why the Kotlin DSL won on tooling, `plugins {}` and why it is restricted, the anatomy of a `build.gradle.kts`, `settings.gradle.kts`, convention plugins instead of `subprojects {}` |
| 3 | **[Dependencies, configurations and version catalogs](03-dependencies-and-configurations.md)** | `implementation` vs `api` vs `compileOnly` vs `compileOnlyApi` vs `runtimeOnly` vs `testImplementation`, the ABI rule, why `implementation` is the real reason Gradle recompiles less, `libs.versions.toml` vs a platform/BOM, `dependencies` / `dependencyInsight` / `--scan` |
| 4 | **[What actually makes Gradle fast](04-what-makes-gradle-fast.md)** | Up-to-date checks, the build cache (local and remote), incremental compilation, the configuration cache, Isolated Projects, the daemon — four different mechanisms, not one |
| 5 | **[Maven vs Gradle, honestly](05-maven-vs-gradle-honestly.md)** | The comparison with an actual recommendation: where each genuinely wins, which to pick for a single service vs a monorepo, why "it's faster" is usually the wrong reason, and what bites during a migration |

## Why this topic runs long

- **The configurations are the concept, not the syntax.** `implementation`
  and `api` look like a naming convention and are actually a compile-classpath
  boundary that decides how much of your monorepo recompiles when one line
  changes. It is the single Gradle idea that Maven has no equivalent for.
- **"Gradle is faster" is four unrelated mechanisms.** Up-to-date checks, the
  build cache, incremental compilation and the configuration cache solve
  different problems, apply at different times, and are enabled differently.
  Saying "faster" without naming which one is how teams end up disappointed.
- **The comparison deserves an argument, not a table.** The honest answer is
  not "Gradle wins" — for a single Spring Boot service, Maven's stability and
  uniformity usually beat Gradle's speed, and speed is often the *wrong*
  reason to switch. That case is made in chunk 5.

## Where this connects

- **Maven core** *(not written yet)* — topic 01. Gradle's model is defined
  here by contrast with Maven's; read that first if you have not.
- **Dependency scopes** *(not written yet)* — topic 02. Gradle's
  configurations are the same problem with a finer-grained answer.
- **[Wrappers](../05-wrappers/README.md)** — `./gradlew` is how everyone actually
  invokes Gradle, and it pins the Gradle version the graph is built with.
- **[The classpath](../../phase-0-platform-jvm/05-packages-classpath/02-the-classpath.md)**
  — compile classpath vs runtime classpath is what the configurations are
  separating.
- **Toolchains** *(not written yet)* — topic 12. Gradle needs Java 17+ to
  *run*; that is independent of the JDK it *compiles with*.

---

← Prev: **Transitive dependencies and mediation** *(not written yet)* · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [The model: a task graph, and two phases](01-the-model-and-the-phases.md)
