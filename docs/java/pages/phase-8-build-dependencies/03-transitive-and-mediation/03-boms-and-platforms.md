---
title: "BOMs and platforms"
sidebar_label: "3 · BOMs and platforms"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Maven guide *Introduction to the Dependency
> Mechanism* (`import` scope, dependency management precedence), the Spring
> Boot reference documentation (*Build* how-to — property overrides and the
> compatibility warning; the Maven plugin *Using the Plugin* page — importing
> `spring-boot-dependencies` and the ordering requirement), the Maven 4
> *What's new* page (`bom` packaging, `<bomClassifier>`, same-reactor imports),
> and the Gradle 9.7.0 user guide (*Platforms* — `platform()` vs
> `enforcedPlatform()`).

**A BOM is `<dependencyManagement>` you can import. That is the entire idea,
and it is why one line pins several hundred versions consistently — and why
overriding a single one of them is a fiddlier question than it looks, with two
different answers depending on whether you inherited the BOM or imported it.**

## A BOM is an importable `dependencyManagement`

[Chunk 2](02-reading-and-overriding.md) established that
`<dependencyManagement>` overrides mediation and adds nothing to the classpath.
A **Bill of Materials** is a POM that consists of almost nothing else —
hundreds of managed versions, no `<dependencies>` — and `<scope>import</scope>`
splices it into yours:

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-dependencies</artifactId>
      <version>4.1.0</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>

<dependencies>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>  <!-- no version -->
  </dependency>
</dependencies>
```

`import` is legal *only* on a `<type>pom</type>` dependency inside
`<dependencyManagement>`, and the guide is precise about the mechanism: the
dependency *"is to be replaced with the effective list of dependencies in the
specified POM's `<dependencyManagement>` section"*. Because they are replaced,
imported entries *"do not actually participate in limiting the transitivity of
a dependency"* — a BOM is not a scope. It constrains nothing about the graph's
shape, only its versions.

That is why `spring-boot-dependencies` works. It manages Jackson, Netty,
Hibernate, Micrometer, SLF4J, Tomcat, Kafka and hundreds more at versions that
were **tested together**. Your starters then declare no version at all, and
mediation has nothing left to decide across the managed set. The value is not
the pinning — you could do that yourself — it is that the *combination* has
been run against an integration suite.

## Two ways to consume it, and one real difference

`spring-boot-starter-parent` (as `<parent>`) inherits the BOM *plus* plugin
management, a Java version property, resource filtering and configured plugins.
Importing `spring-boot-dependencies` gets you the versions only — the option
when a corporate parent already occupies the `<parent>` slot.

The difference that bites: **property overrides work only with the parent.**
Under `spring-boot-starter-parent`, bumping one library is one line:

```xml
<properties>
  <slf4j.version>2.0.16</slf4j.version>
</properties>
```

With the *imported* BOM that does nothing — Spring Boot's own documentation
states the import setup *"does not let you override individual dependencies by
using properties"*, because those properties live in the parent you did not
inherit. There you override by declaring the artifact in your own
`<dependencyManagement>` **before** the `spring-boot-dependencies` import,
since inside that block the first declaration of a coordinate wins:

```xml
<dependencyManagement>
  <dependencies>
    <!-- overrides FIRST -->
    <dependency>
      <groupId>org.slf4j</groupId><artifactId>slf4j-api</artifactId>
      <version>2.0.16</version>
    </dependency>
    <!-- another BOM, also before Boot's -->
    <dependency>
      <groupId>org.springframework.data</groupId>
      <artifactId>spring-data-bom</artifactId>
      <version>2024.1.10</version><type>pom</type><scope>import</scope>
    </dependency>
    <!-- Spring Boot's BOM LAST -->
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-dependencies</artifactId>
      <version>4.1.0</version><type>pom</type><scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>
```

Either route, Spring's own warning applies: each release is designed and tested
against one specific set of third-party dependencies, and *"overriding versions
may cause compatibility issues."* A CVE fix is a good reason to override. A
preference is not.

## Maven 4 tidies the BOM up

Maven 4 (still **4.0.0-rc-6** as of 2026-08-04, not GA) adds a dedicated `bom`
**packaging type**, distinct from the `pom` packaging a parent uses, so a BOM
stops being indistinguishable from a parent POM in the repository. It also
allows importing a BOM with a `<bomClassifier>`, and — new and genuinely useful
— putting `<exclusions>` on dependencies a BOM declares. The generated consumer
POM stays on model 4.0.0, so Maven 3 consumers are unaffected.

One caution from the same page: imported BOMs are expected to be **external**.
Importing a BOM produced by the same reactor warns today and, the page says,
may become a build failure in a future release.

## Gradle: `platform()` and `enforcedPlatform()`

```kotlin
dependencies {
    implementation(platform("org.springframework.boot:spring-boot-dependencies:4.1.0"))
    implementation("org.springframework.boot:spring-boot-starter-web")   // no version
}
```

`platform()` turns the BOM's entries into **dependency constraints** —
recommendations that participate in Gradle's normal highest-wins resolution. If
anything else in the graph asks for a higher version, that higher version
still wins. `enforcedPlatform()` instead *"overrides any versions found in the
dependency graph"*, which is much closer to Maven's `dependencyManagement`
semantics.

The trade is documented and worth respecting: `enforcedPlatform()` is
transitive and exports its forced versions to every consumer, so a published
library that uses it hands downstream users conflicts they cannot resolve.
**Use `platform()` in libraries; reserve `enforcedPlatform()` for the top-level
application**, where you are the last consumer and nobody inherits your
opinion.

## When a BOM is more coupling than help

- **A BOM is an opinion about hundreds of artifacts**, including ones you have
  views on. Overriding a few entries is normal and supported. Overriding many
  means you disagree with the BOM, and fighting it entry by entry is worse than
  not importing it.
- **Two BOMs can disagree.** Import a vendor BOM and Spring's, and the
  ordering rule above silently decides every overlap. That is a decision made
  by line number, which is exactly the kind of thing this topic exists to
  eliminate — so pin the overlaps explicitly rather than relying on order.
- **`enforcedPlatform()` and inherited parents centralise decisions** away from
  module owners. In a large multi-module repo that is usually right; in a small
  one it is ceremony with a maintenance cost.
- **A BOM pins versions, not behaviour.** It cannot stop a library from
  arriving at a version *below* what something in your graph was compiled
  against, if that artifact is not in the managed set. That gap is what the
  guards in [chunk 4](04-the-guards.md) exist to close.

## Gotchas

**Symptom:** you import `spring-boot-dependencies` as a BOM, set `<jackson-bom.version>` in `<properties>`, and nothing changes
**Cause:** property overrides are a feature of *inheriting* `spring-boot-starter-parent` — the properties are defined in that parent. An imported BOM brings managed versions only, and Boot's documentation says so explicitly
**Fix:** declare the override as a `<dependencyManagement>` entry placed **before** the `spring-boot-dependencies` import; first declaration wins inside `dependencyManagement`

**Symptom:** an override in `<dependencyManagement>` is ignored, and moving it up the file fixes it
**Cause:** ordering inside `dependencyManagement` is significant when a BOM import supplies the same coordinates — whichever declaration comes first wins
**Fix:** keep every explicit override above every `<scope>import</scope>` entry, with a comment saying why, because the next person will "tidy" the order

**Symptom:** a published library forces its consumers onto specific versions and they cannot override them
**Cause:** the library used Gradle's `enforcedPlatform()`, or an over-broad `dependencyManagement` in a parent consumers inherit. Forced versions propagate
**Fix:** use `platform()` in libraries so BOM entries remain constraints that participate in resolution; reserve `enforcedPlatform()` for the top-level application

**Symptom:** a multi-module build starts warning about a BOM import after moving to a Maven 4 release candidate
**Cause:** Maven 4 expects imported BOMs to be external artifacts; importing one built in the same reactor is warned about and may become an error in a later release
**Fix:** publish the BOM as its own artifact and depend on a released version of it, rather than importing a module of the current build

## Interview questions

**★ What is a BOM, mechanically?**
A POM whose content is essentially just a `<dependencyManagement>` block,
consumed with `<scope>import</scope>` on a `<type>pom</type>` dependency —
legal only inside `dependencyManagement`. Maven replaces that entry with the
imported POM's effective managed-dependency list. It adds nothing to any
classpath and constrains nothing about the graph's shape; it supplies versions
only, which is why one import can pin hundreds of artifacts without changing
what you depend on.

**★ Why does `spring-boot-dependencies` solve a problem that pinning versions yourself does not?**
Because the value is not determinism, it is *tested* determinism. Boot
publishes a combination of Jackson, Netty, Hibernate, Micrometer, Tomcat and
hundreds more that its integration suite actually ran against. Pinning the same
artifacts by hand gives you a reproducible build of a combination nobody has
ever tested together.

**★ `spring-boot-starter-parent` versus importing `spring-boot-dependencies` — what do you lose?**
The parent gives dependency management *plus* plugin management, a Java version
property, resource filtering and pre-configured plugins. The import gives
versions only, and is what you use when a corporate parent already occupies
`<parent>`. The concrete loss is the property-override mechanism:
`<slf4j.version>` works under the parent and does nothing under the import,
where you instead declare the artifact in `dependencyManagement` above the
import.

**★ Why does ordering matter inside `<dependencyManagement>`?**
Because a BOM import contributes managed entries into the same block, and the
first declaration of a given `groupId:artifactId` wins. Put your explicit
overrides above the `<scope>import</scope>` entries and they take effect; put
them below and the BOM's versions stand. Together with the equal-depth
mediation tiebreak, it is one of the very few places where POM element order is
semantic — which is a good reason not to depend on it silently.

**★ `platform()` versus `enforcedPlatform()` in Gradle.**
`platform()` converts the BOM's entries into dependency constraints that take
part in normal resolution, so a higher version elsewhere in the graph still
wins — consistent with Gradle's highest-wins default. `enforcedPlatform()`
overrides any version found in the graph, which is much closer to Maven's
`dependencyManagement`. Because `enforcedPlatform()` is transitive and exports
forced versions to consumers, Gradle's docs warn against it in reusable
components: `platform()` in libraries, `enforcedPlatform()` only in an
application nobody depends on.

---

← Prev: [Reading the tree, and overriding it](02-reading-and-overriding.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [The guards that fail the build](04-the-guards.md)
