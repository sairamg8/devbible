---
title: "Dependencies, configurations and version catalogs"
sidebar_label: "3 · Dependencies and configurations"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Gradle User Manual for 9.x
> (docs.gradle.org/current — *The Java Library Plugin* for `api` vs
> `implementation` and the ABI rule, *Declaring Dependencies*, *Version
> Catalogs*, *Viewing and Debugging Dependencies*, *Build Scan Basics*) and
> the Gradle 9.7.0 release notes. Version catalogs have been the conventional
> mechanism since Gradle 7.0 and `gradle/libs.versions.toml` is detected
> automatically.

**Maven has four scopes that answer one question: is this dependency present
at compile time, at test time, at runtime, or supplied by the container?
Gradle's configurations answer a second question Maven never asks — *does
this dependency belong to my public API, or is it an internal detail?* That
`api` versus `implementation` split is not tidiness. It is a compile-classpath
boundary, and it is the real mechanism behind "Gradle recompiles less than
Maven" — far more than any cache.**

## The configurations you declare into

```kotlin
dependencies {
    api("com.fasterxml.jackson.core:jackson-databind:2.19.0")
    implementation("com.google.guava:guava:33.4.0-jre")
    compileOnly("org.projectlombok:lombok:1.18.34")
    annotationProcessor("org.projectlombok:lombok:1.18.34")
    runtimeOnly("org.postgresql:postgresql:42.7.4")
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.0")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}
```

| Configuration | On *my* compile classpath | On *my* runtime classpath | On a **consumer's** compile classpath | Maven's nearest equivalent |
|---|---|---|---|---|
| `api` | yes | yes | **yes** | `compile` — leaks by default |
| `implementation` | yes | yes | **no** | `compile` in the POM, `runtime` in the published metadata |
| `compileOnly` | yes | no | no | `provided` (roughly) |
| `compileOnlyApi` | yes | no | yes, compile only | `provided` that consumers also need |
| `runtimeOnly` | no | yes | no (runtime yes) | `runtime` |
| `testImplementation` | test only | test only | no | `test` |
| `annotationProcessor` | processor path, not classpath | no | no | `maven-compiler-plugin` `annotationProcessorPaths` |

Two entries deserve a note. `api` is only available when the
**`java-library`** plugin is applied — the plain `java` plugin does not
create it, which is why "`api` is not a function" is such a common first
error. And `compileOnly` is genuinely compile-only: Lombok appears twice
above because the *processor* runs from the annotation-processor path while
the *annotations* must be on the compile classpath, and neither should ship.

## The ABI rule

The test for `api` versus `implementation` is mechanical, and it is about
your **Application Binary Interface** — the types a consumer can see by
looking at your public signatures. Use `api` if a type from the dependency
appears in:

- a superclass or implemented interface of a public type;
- a public or protected method's parameter or return type, generics included;
- a public or protected field's type;
- a public annotation type you expose.

Everything else — types used only inside method bodies, in private members,
in package-private classes — is `implementation`.

```java
// api: the consumer needs JsonNode on their compile classpath to call this
public JsonNode parse(String body) { ... }

// implementation: Guava never surfaces; the consumer cannot see Multimap
public List<String> tags(String body) {
    Multimap<String, String> index = ArrayListMultimap.create();   // body only
    ...
}
```

## Why this is the recompilation story

Gradle's own documentation states the consequence directly: with
`implementation` there are "less recompilations when implementation
dependencies change: consumers would not need to be recompiled".

The mechanism is worth being precise about, because it is two effects, not
one:

1. **Smaller compile classpaths.** An `implementation` dependency is absent
   from every consumer's compile classpath. In a monorepo where `:api`
   depends on `:service` depends on `:domain`, a Maven-style transitive
   `compile` scope puts `:domain`'s entire dependency closure on `:api`'s
   compile classpath. Gradle puts only what `:service` declared as `api`.
   Less to resolve, less to fingerprint, less to load into `javac`.
2. **ABI-only change detection.** Gradle compares the *compile-time ABI* of a
   dependency, not its jar bytes. Change a method body in `:domain`,
   recompile it, and `:service`'s compile task is still `UP-TO-DATE` because
   the ABI it depends on did not change. Maven's model has no equivalent —
   the jar changed, so downstream modules recompile.

Together those mean a one-line change to an internal helper deep in a
monorepo can recompile one module in Gradle and a dozen in Maven. That is the
honest version of "Gradle is faster", and unlike the caching story it costs
nothing to obtain beyond declaring dependencies correctly.

The corollary is uncomfortable: **a build that puts everything in `api` gets
none of this.** Teams that migrate from Maven by mechanically translating
`compile` to `api` keep the Maven recompilation profile and then wonder why
Gradle did not help.

## Version catalogs — `libs.versions.toml`

A catalog is Gradle's answer to "one place for versions". It lives at
`gradle/libs.versions.toml` and is detected automatically.

```toml
[versions]
jackson = "2.19.0"
junit   = "5.11.0"

[libraries]
jackson-databind = { module = "com.fasterxml.jackson.core:jackson-databind", version.ref = "jackson" }
guava            = { module = "com.google.guava:guava", version = "33.4.0-jre" }
junit-jupiter    = { module = "org.junit.jupiter:junit-jupiter", version.ref = "junit" }

[bundles]
jackson = ["jackson-databind", "jackson-annotations"]

[plugins]
spring-boot = { id = "org.springframework.boot", version = "3.5.4" }
```

Gradle generates type-safe accessors from the aliases, converting dashes to
dots: `jackson-databind` becomes `libs.jackson.databind`. So every module
writes `implementation(libs.jackson.databind)` and the version exists once.
Plugins come from the same file: `alias(libs.plugins.spring.boot)` inside
`plugins {}`.

**A catalog is not a BOM, and the difference matters.** A catalog is
build-local: it declares the versions you *request*, and generates accessors
for them. It has no effect on conflict resolution — if a transitive
dependency drags in a newer Jackson, the catalog does not override it. A
**platform** (Gradle's word for a BOM) does participate in resolution:

```kotlin
dependencies {
    implementation(platform("com.fasterxml.jackson:jackson-bom:2.19.0"))
    implementation("com.fasterxml.jackson.core:jackson-databind")   // version from the platform
}
```

Use both, for different jobs: the catalog so humans have one place to bump a
version, a platform so a coherent version set survives transitive resolution.
`enforcedPlatform` goes further and *forces* the versions — powerful, and a
good way to break a dependency that legitimately needs a newer transitive.

## Seeing what actually resolved

Three commands, in escalating order of usefulness. Command syntax only — the
output is yours to read, and nothing here reproduces it.

```bash
./gradlew :service:dependencies --configuration runtimeClasspath
./gradlew :service:dependencyInsight --dependency jackson-databind \
          --configuration runtimeClasspath
./gradlew build --scan
```

- **`dependencies`** prints the resolved graph per configuration. Always name
  the configuration; the unfiltered output covers a dozen of them.
- **`dependencyInsight`** is the one to reach for when a version is wrong. It
  works *backwards* from a module and reports why that version won and which
  paths requested it — the direct answer to "who is pulling in 2.15?".
- **`--scan`** publishes a build scan. It is free at scans.gradle.com and
  commercially part of Develocity; it shows the timeline, dependency
  resolution, configuration time and test results. For "why is my build slow"
  it beats guessing, and it is the fastest way to find configuration-phase
  work. ⚠️ It uploads build data to a third-party service — check that this
  is acceptable before running it on a private codebase.

Gradle's conflict resolution differs from Maven's and this is where people
get caught: **Gradle picks the highest requested version**, Maven picks the
nearest declaration in the tree. The same dependency set can therefore
resolve to different versions under the two tools, which is a genuine
migration hazard rather than a curiosity.

## Gotchas

**Symptom:** `Unresolved reference: api` in a `build.gradle.kts` that compiles otherwise
**Cause:** the `java` plugin is applied, not `java-library`; only the latter creates the `api` configuration
**Fix:** apply the `java-library` plugin for anything other modules depend on

**Symptom:** after a Maven-to-Gradle migration, nothing recompiles any less than it used to
**Cause:** every `compile`-scoped dependency was translated to `api`, so every compile classpath is as transitive as Maven's
**Fix:** default to `implementation` and promote to `api` only where a type appears in a public signature — the ABI rule, applied module by module

**Symptom:** a consumer module suddenly fails to compile after a "harmless" refactor in a library module
**Cause:** the consumer was relying on a type that leaked transitively; it kept compiling only because the library declared the dependency as `api`
**Fix:** the consumer declares its own dependency on that library explicitly — leaking is the bug, and the compile failure is Gradle telling you where

**Symptom:** Lombok annotations compile but generate nothing
**Cause:** it was declared as `implementation` (or only `compileOnly`) without `annotationProcessor`; the processor path is separate from the compile classpath
**Fix:** both lines — `compileOnly(lombok)` for the annotations, `annotationProcessor(lombok)` to actually run the processor

**Symptom:** the app runs in tests and fails at startup in production with `NoClassDefFoundError` on a JDBC driver
**Cause:** the driver was `compileOnly` (or omitted), so it was never on the runtime classpath of the packaged application
**Fix:** `runtimeOnly` — present at runtime, absent from compile classpaths so nobody imports it by accident

**Symptom:** the version catalog says 2.19.0 and the build resolves 2.20.0
**Cause:** a catalog declares a *requested* version; it does not participate in conflict resolution, and something transitive requested higher — Gradle picks the highest
**Fix:** add the platform/BOM (or a constraint) to actually pin it, and use `dependencyInsight` to identify who asked for higher

**Symptom:** a dependency resolves to a different version under Gradle than it did under Maven, with the same declarations
**Cause:** different mediation strategies — Gradle takes the highest requested version, Maven takes the nearest declaration
**Fix:** expect this during migration; pin the intended versions with a platform and verify with `dependencyInsight` rather than assuming parity

**Symptom:** `libs.jacksonDatabind` is not recognised, but the TOML clearly has that library
**Cause:** accessor names are derived by splitting on dashes — `jackson-databind` becomes `libs.jackson.databind`, not a camel-case identifier
**Fix:** use the dotted form; the IDE will complete it once the catalog parses

**Symptom:** `enforcedPlatform` fixed one version conflict and broke three other libraries
**Cause:** it forces versions rather than recommending them, overriding transitive requirements that were legitimate
**Fix:** prefer `platform` (a recommendation that still loses to a higher genuine requirement) and reserve `enforcedPlatform` for cases you have actually diagnosed

## Interview questions

**★ `api` vs `implementation` — state the rule and the consequence.**
Rule: `api` if a type from that dependency appears in your public ABI —
superclass or interface, public/protected method parameter or return type
including generics, public field type, exposed annotation. Otherwise
`implementation`. Consequence: `implementation` dependencies are absent from
consumers' compile classpaths, so consumers do not recompile when those
dependencies change, and they cannot accidentally use a type you never meant
to expose.

**★ Why does Gradle recompile less than Maven in a monorepo? Name both mechanisms.**
First, smaller compile classpaths: `implementation` stops transitive leakage,
so a downstream module compiles against far fewer types. Second, ABI-based
up-to-date checks: Gradle compares the compile-time ABI of a dependency, so
changing a method *body* upstream leaves downstream compile tasks
`UP-TO-DATE`. Neither is a cache — they are consequences of the dependency
model, which is why a build that puts everything in `api` gets neither.

**★ Where does Maven's `provided` scope map onto Gradle?**
Roughly `compileOnly`: present when compiling, absent at runtime and absent
from consumers. If consumers also need it at compile time, `compileOnlyApi`.
The mapping is not exact — Gradle deliberately splits "not at runtime" from
"not visible to consumers" into separate axes, which Maven's single scope
dimension conflates.

**★ Why is Lombok declared twice?**
The annotations must be on the compile classpath (`compileOnly`, since they
should not ship), and the processor must be on the annotation-processor path
(`annotationProcessor`), which is a separate path from the classpath. Declare
only one and you either get "cannot find symbol @Getter" or a silent no-op
where nothing is generated.

**★ Is a version catalog a replacement for a BOM?**
No, and treating it as one is a common mistake. A catalog is build-local: it
gives one place to declare versions and generates type-safe accessors, but it
takes no part in conflict resolution. A platform/BOM participates in
resolution and keeps a coherent version set even when transitives disagree.
They are complementary — catalog for authoring, platform for resolution.

**★ How do Gradle and Maven differ in resolving a version conflict?**
Gradle selects the **highest** requested version by default; Maven selects
the **nearest** declaration to the root. The same dependency declarations can
therefore produce different resolved versions in the two tools, which is a
real hazard during migration and a reason to pin with a platform and verify
with `dependencyInsight` rather than assume the graphs match.

**★ Something is pulling in the wrong Jackson. What do you run?**
`./gradlew :module:dependencyInsight --dependency jackson-databind
--configuration runtimeClasspath`. It reports the selected version, the
reason it was selected, and every requesting path — which is what you need,
whereas `dependencies` gives you the whole tree to search by eye. A build
scan gives the same information with a navigable UI.

**★ What are the costs of `--scan`?**
It uploads build data — task names, timings, dependency coordinates,
environment details — to scans.gradle.com or your Develocity instance. On a
private codebase that is a decision to make deliberately, not a flag to add
to CI reflexively. Self-hosted Develocity exists for organisations that
cannot send it out.

---

← Prev: [The DSL and the script](02-the-dsl-and-the-script.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [What actually makes Gradle fast](04-what-makes-gradle-fast.md)
