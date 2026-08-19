---
title: "The DSL and the script"
sidebar_label: "2 · The DSL and the script"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Gradle User Manual for 9.x
> (docs.gradle.org/current — *Kotlin DSL Primer*, *Using Plugins*, *Writing
> Build Scripts*, *Sharing Build Logic between Subprojects*, *Toolchains*),
> gradle.org/whats-new/gradle-9 (Kotlin DSL the default for new builds since
> 8.2; embedded Kotlin 2.2.x; Groovy 4.0; **Java 17 minimum to run Gradle**),
> and the Gradle 9.7.0 release notes.

**Both DSLs are current and Gradle has announced no plan to deprecate the
Groovy one — but the Kotlin DSL has been the default for new builds since
Gradle 8.2, and the reason is tooling, not taste. A Groovy build script is
dynamically typed, so the IDE cannot tell you whether `shadowJar` exists
until the line runs. A Kotlin script is compiled against generated,
plugin-derived accessors, so typos, wrong types and missing plugins fail
before anything is built.**

## Why the Kotlin DSL won on tooling

In Groovy, `implementation 'x:y:1.0'` is a method call resolved at runtime
against whatever the applied plugins added to the script's metaclass. Nothing
before execution knows that method exists. "Go to definition" on a build
script mostly does not work, completion is guesswork, and a misspelled
property is a runtime failure — sometimes a *silent* one, because Groovy will
happily set a dynamic property nobody reads.

The Kotlin DSL is statically typed and compiled. Applying a plugin generates
type-safe **accessors** for the extensions and configurations it contributes,
so the IDE gets real completion, real navigation into plugin sources, and
real errors at script-compile time.

| | Groovy DSL (`build.gradle`) | Kotlin DSL (`build.gradle.kts`) |
|---|---|---|
| Typing | dynamic | static, compiled |
| IDE completion | poor, guessy | genuine, from generated accessors |
| Errors surface | when that line executes | at script compile time |
| Syntax noise | lower — no quotes-vs-parens ceremony | higher — `=` for properties, `(...)` for calls |
| First build after a script edit | fast | slower — scripts compile (output is cached) |
| Where it hurts | large builds nobody can navigate | a failed script compile can produce a long error |

Two syntax rules cause most conversion errors. Property **assignment** needs
`=` in Kotlin where Groovy allowed a space-separated setter call, and a
**method call** needs parentheses.

```groovy
// Groovy
plugins { id 'java-library' }
dependencies { implementation 'com.google.guava:guava:33.4.0-jre' }
sourceCompatibility JavaVersion.VERSION_21
tasks.named('test') { useJUnitPlatform() }
```

```kotlin
// Kotlin
plugins { `java-library` }
dependencies { implementation("com.google.guava:guava:33.4.0-jre") }
sourceCompatibility = JavaVersion.VERSION_21
tasks.named<Test>("test") { useJUnitPlatform() }
```

Kotlin scripts are compiled, so the first build after editing one is slower.
It is amortised — compiled scripts are cached — but it is real, and it is why
a tiny single-module build can *feel* slower under the Kotlin DSL than under
Groovy. On a large build the trade is obviously worth it; on a three-file
project it is a matter of preference.

## Anatomy of a `build.gradle.kts`

```kotlin
plugins {
    `java-library`
    id("org.springframework.boot") version "3.5.4"
}

group = "com.example"
version = "1.0.0-SNAPSHOT"

java {
    toolchain { languageVersion = JavaLanguageVersion.of(25) }
}

repositories { mavenCentral() }

dependencies {
    api(libs.jackson.databind)
    implementation(libs.guava)
    compileOnly(libs.lombok)
    annotationProcessor(libs.lombok)
    runtimeOnly(libs.postgresql)
    testImplementation(libs.junit.jupiter)
}

tasks.named<Test>("test") { useJUnitPlatform() }
```

Four blocks carry the meaning:

- **`plugins {}`** — the modern plugin block, and it is *not* ordinary code.
  It is extracted and evaluated before the rest of the script so plugins can
  be resolved and their accessors generated; that is why it must sit near the
  top and may not contain arbitrary logic — no `if`, no variables computed
  elsewhere. The legacy `buildscript {}` plus `apply plugin:` form has no such
  restriction, and no accessors either.
- **`java { toolchain { ... } }`** — the JDK used to compile and test, which
  is a *different* decision from the JDK running Gradle. Gradle 9 requires
  **Java 17 or newer to run itself**; a toolchain is how you still compile
  for or with another JDK, and Gradle can provision it.
- **`repositories {}`** — there is no implicit Maven Central. Omit this and
  resolution fails, which surprises everyone arriving from Maven.
- **`dependencies {}`** — configurations, which is chunk 3's subject.

## `settings.gradle.kts` is not optional

The file people forget names the build and includes the subprojects. A
directory that is not `include`d is not a project.

```kotlin
rootProject.name = "shop"

include("domain", "service", "api")

dependencyResolutionManagement {
    repositories { mavenCentral() }        // one place, all projects
}
```

`dependencyResolutionManagement` is the modern way to declare repositories
once for the whole build instead of repeating a `repositories {}` block in
every module — and it is also where a version catalog is customised if you
do not use the default `gradle/libs.versions.toml` location.

## Sharing logic: convention plugins, not copy-paste

The first instinct in a multi-module Gradle build is `subprojects { ... }` or
`allprojects { ... }` in the root script. It works, and it is now considered
an anti-pattern: it configures projects from the outside, couples every
module to the root script, and is hostile to the configuration cache and to
Isolated Projects (incubating as of Gradle 9.7).

The supported answer is a **convention plugin** — a plugin you write, living
in `buildSrc` or an included build, that modules apply like any other:

```kotlin
// buildSrc/src/main/kotlin/shop.java-conventions.gradle.kts
plugins { `java-library` }

java { toolchain { languageVersion = JavaLanguageVersion.of(25) } }

tasks.named<Test>("test") { useJUnitPlatform() }
```

```kotlin
// service/build.gradle.kts
plugins { id("shop.java-conventions") }
```

Each module still declares what it is. The shared decisions live in one
typed, testable place instead of in a `subprojects` block that silently
applies to modules it was never designed for.

⚠️ `buildSrc` has one cost worth knowing: it is a separate build that is
compiled before the main build, and changing anything in it invalidates
downstream caching for the whole build. On large repos, an *included build*
(`includeBuild("build-logic")`) is preferred for exactly that reason.

## When the flexibility is the problem

Because a build script is a program, two modules can solve the same problem
two different ways, logic gets copy-pasted between them, and the only
reliable way to know what a build does is to run it. Gradle will not stop
any of that.

If your team has nobody who will own build scripts as code — review them,
keep shared logic in convention plugins, resist scripting around a plugin
rather than configuring it — then Gradle's flexibility is a liability, not an
asset. Maven cannot express those builds; that is a limitation and also a
guarantee. Chunk 5 turns this into an actual recommendation.

## Gotchas

**Symptom:** an `if` inside `plugins {}` fails with a script compile error
**Cause:** the block is restricted by design so plugins can be resolved before the script body runs
**Fix:** apply the plugin unconditionally and make the *behaviour* conditional, or move the decision into a convention plugin

**Symptom:** `Could not find com.google.guava:guava:33.4.0-jre` on a coordinate that is spelled correctly
**Cause:** no `repositories {}` — Gradle has no default repository — or it was declared only in the root project while resolution happens in a subproject
**Fix:** declare repositories centrally with `dependencyResolutionManagement` in `settings.gradle.kts`

**Symptom:** converting Groovy to Kotlin, `sourceCompatibility JavaVersion.VERSION_21` will not compile
**Cause:** that is Groovy's parenthesis-free setter call; Kotlin needs an assignment
**Fix:** `sourceCompatibility = JavaVersion.VERSION_21` — and prefer a toolchain to source/target compatibility anyway

**Symptom:** the IDE offers no completion at all inside a `build.gradle.kts`
**Cause:** accessors are generated from *successfully applied* plugins; if the script does not compile, or the plugin block failed to resolve, there is nothing to generate from
**Fix:** fix the first script error and re-sync — Kotlin DSL completion is all-or-nothing per script, so one broken line blanks the whole file

**Symptom:** every build recompiles everything after a one-line change to a helper class
**Cause:** the helper lives in `buildSrc`, which is a separate build compiled first; changing it invalidates downstream work across the whole build
**Fix:** move shared build logic to an included build (`includeBuild("build-logic")`), which is versioned and cached independently

**Symptom:** a `subprojects { }` block in the root script configures a module in a way that module's author never intended
**Cause:** cross-project configuration applies from the outside to everything, including modules added later
**Fix:** replace it with convention plugins each module applies explicitly — also the direction Gradle's Isolated Projects work requires

**Symptom:** a build works on JDK 21 and fails at startup on a machine with JDK 11 after the Gradle 9 upgrade
**Cause:** Gradle 9 requires Java 17+ to run the build tool itself
**Fix:** run Gradle on 17+ and use a toolchain to compile against the older JDK; the two JDKs are independent choices

## Interview questions

**★ Kotlin DSL or Groovy DSL — and is the reason really about the language?**
Kotlin for anything new, and the reason is tooling rather than syntax: the
script is statically typed and compiled, so plugin-generated accessors give
real IDE completion and navigation and typos fail at script-compile time
instead of when that line runs. Groovy's dynamic dispatch makes all of that
guesswork. Groovy remains fully supported with no deprecation planned, so an
existing Groovy build is not a defect to fix.

**★ What is special about the `plugins {}` block, and why the restriction?**
It is extracted and evaluated before the rest of the script so Gradle can
resolve the plugins and generate their type-safe accessors — which cannot
happen if the block's contents depend on running the script. Hence: near the
top, no arbitrary logic. `buildscript {}` plus `apply plugin:` is the legacy
form without the restriction and without the accessors.

**★ What does `settings.gradle.kts` do that `build.gradle.kts` cannot?**
It runs in the initialization stage, before any project exists, so it is the
only place that can decide *which projects there are* (`include`), name the
root project, wire included builds, and declare build-wide repository and
version-catalog policy via `dependencyResolutionManagement`.

**★ Why is `subprojects { }` discouraged now?**
It configures projects from outside themselves, so a module's behaviour is
not visible in its own script, later-added modules inherit configuration
silently, and every project is coupled to the root script. That coupling is
also what Isolated Projects — which configures projects in parallel and in
isolation — cannot allow. Convention plugins express the same sharing
without the cross-project reach.

**★ `buildSrc` or an included build for shared build logic?**
Both give you typed, reusable convention plugins. `buildSrc` is
zero-configuration and implicit, but it is one monolithic build compiled
before everything, so any change to it invalidates work across the whole
build. An included build (`includeBuild("build-logic")`) is explicit, can be
split into modules, and is cached independently — which is why large repos
prefer it.

**★ Gradle 9 needs Java 17 to run. Does that stop me building for Java 8?**
No. The JDK running Gradle and the JDK compiling your code are separate
decisions. Gradle's own process needs 17+; a Java toolchain selects — and can
auto-provision — a different JDK for compilation and test execution. Confusing
the two is the single most common Gradle-upgrade support question.

**★ Why does a Kotlin DSL build sometimes feel slower than the Groovy one?**
Because the scripts are compiled. After editing a build script, the next
invocation pays script compilation before doing any build work. The result is
cached, so it is a one-off per edit — but on a tiny project where the build
itself takes a second, that one-off is the thing you notice.

---

← Prev: [The model: a task graph, and two phases](01-the-model-and-the-phases.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [Dependencies, configurations and version catalogs](03-dependencies-and-configurations.md)
