---
title: "Maven core"
sidebar_label: "01 · Maven core"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Apache Maven POM Reference
> (maven.apache.org/pom.html), the Introduction to the Build Lifecycle
> (maven.apache.org/guides/introduction/introduction-to-the-lifecycle.html),
> the Maven download page (**3.9.16** is the current recommended stable
> release; **4.0.0-rc-6** is the current Maven 4 release candidate and is
> explicitly *not* for production), "What's new in Maven 4"
> (maven.apache.org/whatsnewinmaven4.html), and the plugin sites for
> maven-compiler-plugin **3.15.0**, maven-surefire-plugin and
> maven-failsafe-plugin.

**A POM is not a build script — it is a *declaration of a project*, and
Maven's job is to derive one **effective model** from it by merging the
Super POM, the parent chain, the active profiles and every interpolated
property, then to run a fixed **lifecycle** whose phases are pre-bound to
plugin goals chosen by your `<packaging>`. Almost every "why is Maven
doing that?" has the same answer: something you never wrote is in the
effective POM, or a plugin goal you never named is bound to a phase you
did. Learn to read those two things and Maven stops being magic — which
matters because Spring Boot's starters, BOMs and executable jars are not
new machinery, they are these three mechanisms with a friendly name.**

This topic runs deeper than one file — nine chunks, split on concept
boundaries so no file passes the 300-line readability cap. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The POM and coordinates](01-the-pom-and-coordinates.md)** | What a POM actually is and what the declarative model costs, GAV as the ecosystem's only identity, how coordinates map to repository paths, `packaging` and `classifier`, `SNAPSHOT` vs release and why releases may not depend on snapshots, version ranges |
| 2 | **[Inheritance and aggregation](02-inheritance-and-aggregation.md)** | `<parent>` vs `<modules>` as two unrelated mechanisms, `relativePath` and `<relativePath/>`, what is and is not inherited, the parent-`<dependencies>` defect, reactor ordering, Maven 4's `<subprojects>` and POM inference |
| 3 | **[The effective POM and properties](03-effective-pom-and-properties.md)** | The Super POM, the merge order, `help:effective-pom` as the first debugging move, `settings.xml` as the other input, the five property kinds, `maven.compiler.release`, CI-friendly `${revision}`, profiles and when the declarative model is wrong |
| 4 | **[The lifecycle](04-the-lifecycle.md)** | The three lifecycles, all 23 default phases in order, invoking a phase runs everything before it, the packaging-driven default bindings, what `compile`/`test`/`package`/`verify`/`install`/`deploy` each really do, why `integration-test` and `verify` are two phases |
| 5 | **[Running the build](05-running-the-build.md)** | `mvn verify` vs the reflexive `mvn clean install`, when `clean` is actually needed, `-DskipTests` vs `-Dmaven.test.skip`, direct goal invocation and forked lifecycles, `-pl`/`-am`/`-T`, Maven 4's phase tree and `--resume` |
| 6 | **[Plugins vs dependencies](06-plugins-vs-dependencies.md)** | The distinction people conflate, mojos and goals, `<executions>` and the three configuration levels, `default-*` execution ids, plugin classloader isolation and a plugin's own `<dependencies>` |
| 7 | **[The management sections](07-the-management-sections.md)** | `<pluginManagement>` vs `<plugins>`, pinning every plugin version, `<dependencyManagement>` vs `<dependencies>`, managed versions pinning transitives, importing a BOM, and when management is the wrong answer |
| 8 | **[The plugins every build has](08-the-plugins-every-build-has.md)** | The core eight by phase, compiler (`release`, `-parameters`, processor paths), surefire vs failsafe, jar vs shade vs `spring-boot:repackage`, and why plugin configuration being untyped costs so much time |
| 9 | **[Diagnostics, governance and Maven 4](09-diagnostics-governance-maven4.md)** | `dependency:tree` and `analyze`, the `versions` plugin, enforcer rules worth having, the publishing plugins and the release profile, what Maven 4 demands of plugins, and the honest state of Maven 4 |

## Why this is a Master topic

- **It is the model every other Java tool is described against.** Gradle
  publishes Maven coordinates. Spring Initializr emits a POM. Nexus,
  Artifactory, Dependabot, SBOM scanners and CVE feeds all key on GAV.
  You cannot opt out of the model even by not using the tool.
- **Its failure modes are invisible in the file you are reading.** The
  version that lost, the plugin that ran, the property that resolved —
  none of them are in your `pom.xml`. They are in the *effective* POM,
  and reading that is a skill, not a command.
- **"Works on my machine" usually lives here.** A different local
  repository state, a snapshot that moved, a plugin version inherited
  from the Super POM instead of pinned — all reproducibility bugs that
  a build tool is supposed to have solved and hasn't unless you pin.
- **Spring Boot is this phase applied.** A starter is a dependency with
  transitive dependencies; the parent is inheritance; version-less
  dependency declarations are `<dependencyManagement>`; the executable
  jar is one plugin goal bound to `package`. **Phase 9 — Spring Boot and
  the web** *(not written yet)* is unreadable without this topic.

## Where this connects

- **[Packages and the classpath](../../phase-0-platform-jvm/05-packages-classpath/README.md)**
  — the classpath Maven assembles is the thing topic 05 explains; scopes
  (topic 02) are just *which* classpath an artifact lands on.
- **[The release model](../../phase-0-platform-jvm/03-release-model.md)**
  — `maven.compiler.release` is how the LTS/`--release` story reaches
  your build.
- **[The module system](../../phase-0-platform-jvm/11-module-system.md)**
  — Maven's `<modules>` are *not* JPMS modules, which is exactly why
  Maven 4 renames them to `<subprojects>`.
- [Dependency scopes](../02-dependency-scopes/README.md) and [Transitive dependencies
  and mediation](../03-transitive-and-mediation/README.md) take the dependency half of chunk 3
  and go one level down.

---

Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [The POM and coordinates](01-the-pom-and-coordinates.md)
