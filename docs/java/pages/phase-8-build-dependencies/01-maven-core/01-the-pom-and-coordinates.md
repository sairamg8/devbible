---
title: "The POM and coordinates"
sidebar_label: "1 · The POM and coordinates"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Apache Maven POM Reference
> (maven.apache.org/pom.html — coordinates, packaging values, classifier
> naming), the Maven download page (**3.9.16** stable, **4.0.0-rc-6** the
> current release candidate, not for production), and "What's new in
> Maven 4" (maven.apache.org/whatsnewinmaven4.html — model 4.1.0, the
> `bom` packaging, new artifact types, CI-friendly versions).

**Two artifacts are the same artifact if and only if their coordinates
match, and coordinates are the *only* identity the Java build ecosystem
has — no package-name check, no signature check, no namespace
enforcement at runtime. Mediation, exclusions, BOMs, CVE feeds and SBOMs
are all coordinate arithmetic on top of a string triple you chose once
and can never cheaply change.**

## What a POM actually is

`pom.xml` is XML that deserializes into a Maven **Model** object. It is
declarative: no statements, no conditionals, no loops, no function
calls. That single design decision explains most of Maven's character,
good and bad.

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>

  <groupId>com.acme.billing</groupId>
  <artifactId>invoice-service</artifactId>
  <version>2.4.0-SNAPSHOT</version>
  <packaging>jar</packaging>
</project>
```

`<modelVersion>4.0.0</modelVersion>` has been the only legal value since
Maven 2 and still is for the 3.9.x line. **Maven 4 introduces model
`4.1.0`** with a new namespace (`http://maven.apache.org/POM/4.1.0`) for
the *build* POM, while publishing a flattened, 4.0.0-shaped **consumer
POM** to repositories so the rest of the ecosystem keeps working
unchanged.

Because there is no `if`, everything conditional becomes a **profile**
and everything variable becomes a **property**. That is the trade: a POM
is machine-analysable — a tool can read your dependency graph without
executing anything, which is what makes Dependabot, SBOM generators and
IDE imports possible — at the cost of being clumsy the moment a build
genuinely needs logic. Gradle made the opposite trade ([Gradle](../04-gradle/README.md), topic 04).

## GAV: the identity

| Element | Meaning | Convention |
|---|---|---|
| `groupId` | the organisation/product namespace | reverse DNS on a domain you control — `com.acme.billing` |
| `artifactId` | the module name inside that group | lowercase, hyphenated, **no version in the name** |
| `version` | this incarnation | `MAJOR.MINOR.PATCH`, optionally `-SNAPSHOT` |

`groupId` + `artifactId` (**"GA"**) is the *project* identity; adding
`version` gives **"GAV"**, the *artifact* identity. Conflict mediation,
exclusions and `<dependencyManagement>` all key on **GA** — Maven puts
exactly one version of each GA on a classpath. That one fact is the
root of every dependency conflict you will ever debug, and the reason
two majors of a library cannot coexist unless one is relocated into a
different package and groupId (topic 08's shading).

Coordinates are also a **path**. A repository stores an artifact at the
groupId with dots turned into directory separators, then artifactId,
then version:

```text
org.apache.commons : commons-lang3 : 3.17.0
  → org/apache/commons/commons-lang3/3.17.0/commons-lang3-3.17.0.jar
                                            commons-lang3-3.17.0.pom
```

That mapping is practical, not trivia: you can check whether a version
exists on Central by constructing the URL, and you can find the cached
copy under `~/.m2/repository/` by the same rule when you need to see
what actually landed on disk rather than what you think you asked for.

## `packaging` — the coordinate that changes the build

`<packaging>` defaults to `jar` and is not merely a file extension: it
selects which plugin goals are bound to which lifecycle phases
([chunk 4](04-the-lifecycle.md)).

| Packaging | Produces | Notable |
|---|---|---|
| `jar` | a jar | the default; the full set of bindings |
| `pom` | only the POM | parents, aggregators, BOMs — no compile, no test, no jar |
| `war` | a web archive | binds `war:war` instead of `jar:jar` |
| `maven-plugin` | a plugin | additionally generates the plugin descriptor |
| `ejb`, `ear`, `rar` | Jakarta EE archives | legacy, still in the reference |
| `bom` | **Maven 4 only** | dedicated BOM packaging, so tooling can tell a BOM from a parent |

A `pom`-packaged project runs a nearly empty lifecycle — the documented
bindings are `install:install` at `install` and `deploy:deploy` at
`deploy`, and nothing else. That is why compiler configuration added to
an aggregator POM appears to do nothing: there is no `compile` execution
there to attach to.

Maven 4 additionally introduces artifact **types** that say where an
artifact belongs at compile time — `classpath-jar` and `modular-jar`
force the class path or module path unconditionally, and `processor` /
`classpath-processor` / `modular-processor` mark annotation processors.
On Maven 3 that distinction has to be made in compiler plugin
configuration instead.

## `classifier` — the fifth coordinate

A classifier distinguishes artifacts built from the *same* POM with
different content. The filename is
`artifactId-version-classifier.extension`:

```text
invoice-service-2.4.0.jar             (no classifier — the main artifact)
invoice-service-2.4.0-sources.jar     classifier: sources
invoice-service-2.4.0-javadoc.jar     classifier: javadoc
invoice-service-2.4.0-tests.jar       classifier: tests
```

```xml
<dependency>
  <groupId>com.acme.billing</groupId>
  <artifactId>invoice-service</artifactId>
  <version>2.4.0</version>
  <classifier>tests</classifier>
  <scope>test</scope>
</dependency>
```

Two things to hold onto. `sources` and `javadoc` are **conventions
enforced by tooling, not by Maven** — your IDE fetches them by guessing
those exact classifiers, which is why "attach sources" silently fails
for a library that never published them. And a classified artifact
still shares the GAV of the main one, so it gets no independent node in
the dependency graph and no independent version; if two things must
version separately, they need separate artifactIds.

## Versions, `SNAPSHOT` and reproducibility

A version ending in `-SNAPSHOT` is declared **mutable**, and Maven
treats the two kinds very differently:

- **Release version** — immutable by convention and enforced by every
  serious repository manager. Once `2.3.0` is in your local repository
  Maven never re-checks it. This is what makes a release build
  reproducible at all.
- **`-SNAPSHOT`** — re-checked against remote repositories on an update
  policy (`daily` by default; `-U` forces a check now). Deployed
  snapshots are normally stored *timestamped* on the remote
  (`invoice-service-2.4.0-20260819.101533-7.jar`) with metadata pointing
  at the newest. So the same build, run twice, can resolve different
  bytes.

The consequence is a rule, not a preference: **nothing released may
depend on a `-SNAPSHOT`.** A release built against one cannot be rebuilt
identically later — which is precisely when you need to, because a CVE
landed in a transitive dependency and someone is asking what shipped.
Maven's release plugin refuses such a build for this reason, and
`maven-enforcer-plugin`'s `requireReleaseDeps` rule is how you enforce
it without the release plugin.

**Version ranges** (`[1.0,2.0)`) are legal and you should use them for
nothing you care about. They make resolution a function of what Central
contains at build time rather than of your source tree, so the build
stops being reproducible and a range spanning a major becomes a
self-inflicted outage on some future Tuesday. The ecosystem has
effectively abandoned them; Gradle's dynamic versions carry the same
warning for the same reason.

## The honest cost of the model

Coordinates are global, permanent and unenforced. Nothing stops you
publishing `com.acme:common:1.0` from two teams; nothing stops a fork
publishing under the original groupId; nothing at runtime checks that
the jar named `commons-lang3-3.17.0.jar` contains Apache's bytes rather
than someone else's. Everything that makes this safe — signatures,
provenance, namespace verification on Central, SBOM attestation — is a
layer bolted on above coordinates, not a property of them. Treat
"the coordinate is correct" as an assumption you are choosing to make,
which is the whole subject of topic 07.

## Gotchas

**Symptom:** two teams' artifacts collide because both published `com.acme:common`
**Cause:** `groupId` chosen as a product name rather than a namespace you control
**Fix:** reverse DNS on a domain you own, one subgroup per product; renaming a published groupId later needs a relocation POM and a consumer migration

**Symptom:** a released artifact cannot be rebuilt byte-for-byte months later
**Cause:** it depended on a `-SNAPSHOT`, or on a version range, so its inputs were not fixed by the source tree
**Fix:** releases depend only on releases; enforce with `maven-enforcer-plugin`'s `requireReleaseDeps`; never use ranges

**Symptom:** a snapshot dependency does not pick up a colleague's fresh deploy
**Cause:** the default update policy for snapshots is `daily` — Maven already checked today
**Fix:** `mvn -U` to force a check; do not "fix" it by deleting `~/.m2`, which discards everything and hides the real cause

**Symptom:** the IDE cannot attach sources for one particular library
**Cause:** the `sources` classifier is a publishing convention, and that project never published one
**Fix:** nothing local will conjure it; decompile or read upstream. For your own artifacts, run `maven-source-plugin` so consumers do not hit this

**Symptom:** compiler or surefire configuration in the aggregator POM has no effect
**Cause:** `<packaging>pom</packaging>` binds essentially nothing — there is no `compile` or `test` execution there
**Fix:** put the configuration in `<pluginManagement>` in the parent so children inherit it, not in `<plugins>` on a POM that never compiles

**Symptom:** `artifactId` is `invoice-service-v2` and every tool now treats v1 and v2 as unrelated projects
**Cause:** version encoded in the artifactId, so mediation, `dependencyManagement` and CVE feeds see two different GAs
**Fix:** version goes in `<version>`. Encode a major in the artifactId only when you *deliberately* want both on one classpath — that is the Jackson `-2`/`-3` pattern, and it is a public API decision, not a naming habit

## Interview questions

**★ What are Maven coordinates, and which subset does Maven actually resolve on?**
`groupId:artifactId:version[:packaging][:classifier]`. Resolution and
conflict mediation key on **groupId:artifactId** — exactly one version
of each GA reaches a classpath. That single rule is why version
conflicts exist and why relocation (shading) is the only way to run two
majors of the same library side by side.

**★ Given `com.fasterxml.jackson.core:jackson-databind:2.22.0`, where is it on disk and on Central?**
`com/fasterxml/jackson/core/jackson-databind/2.22.0/jackson-databind-2.22.0.jar`
under `~/.m2/repository` and under Central's base URL — groupId dots
become path separators, then artifactId, then version, then
`artifactId-version.ext`. Being able to construct that path is how you
check what actually downloaded instead of guessing.

**★ What does `-SNAPSHOT` change, mechanically?**
It marks the version mutable: Maven re-checks it remotely on an update
policy instead of trusting the local cache forever, and remotes usually
store it timestamped. Two builds of identical source can therefore
resolve different bytes, which is why a released artifact must never
depend on one.

**★ Why is `<packaging>pom</packaging>` more than a formality?**
Packaging selects the lifecycle bindings. `pom` binds essentially only
`install` and `deploy`, so the project compiles nothing and produces no
archive. It is the right packaging for parents, aggregators and BOMs,
and it explains the classic "my plugin config in the root POM does
nothing".

**★ When is a classifier the right tool, and when is it not?**
Right when the artifacts genuinely come from one build of one project
and must version together — `sources`, `javadoc`, `tests`, a
platform-specific native bundle. Wrong whenever the two things could
ever need different versions or different dependencies, because a
classifier shares the GAV and gets no independent graph node. Then it
is a separate artifactId.

**★ Someone proposes version ranges so dependencies stay current automatically. Your response?**
That it moves the build's inputs outside the repository: resolution now
depends on what Central holds at build time, so the same commit builds
differently on different days and a range crossing a major can break
production without a code change. Currency is a *scheduled* concern —
Dependabot/Renovate raising a pull request against a pinned version
(topic 07) gives you the updates plus a review and a CI run.

**★ What does Maven 4 change about the POM itself?**
Model `4.1.0` for the build POM with a new namespace; a flattened
**consumer POM** published to repositories so downstream tooling still
sees a 4.0.0 model; a dedicated `bom` packaging; new artifact types
(`classpath-jar`, `modular-jar`, `processor`) that state class-path vs
module-path intent; `<subprojects>` replacing `<modules>`; and native
CI-friendly `${revision}` support that removes the Flatten Plugin
workaround.

---

Index: [Maven core](README.md) · Next → [Inheritance and aggregation](02-inheritance-and-aggregation.md)
