---
title: "Inheritance and aggregation"
sidebar_label: "2 · Inheritance and aggregation"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Apache Maven POM Reference
> (maven.apache.org/pom.html — inheritance, the inherited-element list,
> `relativePath` default `../pom.xml`, aggregation and automatic module
> ordering) and "What's new in Maven 4"
> (maven.apache.org/whatsnewinmaven4.html — `<subprojects>`, parent and
> version inference, automatic subproject discovery,
> `${project.rootDirectory}`).

**`<parent>` and `<modules>` are two unrelated mechanisms that almost
always appear in the same file, which is why almost everyone believes
they are one thing. `<parent>` composes *configuration*: it is how a
child POM ends up with settings nobody wrote in it. `<modules>` composes
*a build*: it is how one command builds twelve artifacts in the right
order. Getting the distinction wrong produces the most common structural
defect in Java repositories — a parent POM that quietly puts a web
framework on the classpath of a module that should not know the web
exists.**

## `<parent>` is inheritance

"Take this POM's configuration as my baseline."

```xml
<parent>
  <groupId>com.acme</groupId>
  <artifactId>acme-parent</artifactId>
  <version>1.9.0</version>
  <relativePath>../pom.xml</relativePath>   <!-- this is the DEFAULT -->
</parent>

<artifactId>invoice-service</artifactId>
```

The child inherits `groupId` and `version` if it omits them — which is
why most modules in a multi-module repo declare only an `artifactId`.
The parent may itself have a parent; the chain is merged root-most
first, each level overriding the one above.

## `<modules>` is aggregation

"When you build me, also build these."

```xml
<packaging>pom</packaging>
<modules>
  <module>invoice-domain</module>
  <module>invoice-service</module>
  <module>invoice-api</module>
</modules>
```

The set of projects one Maven invocation builds is the **reactor**. The
order you list modules in is **irrelevant**: Maven topologically sorts
the reactor from the inter-module dependency edges, so writing
`invoice-api` last does not make it build last, and reordering the list
will never fix an ordering problem.

The two mechanisms are genuinely independent. A parent need not
aggregate — `spring-boot-starter-parent` is a parent you inherit over
the network and it aggregates nothing. An aggregator need not be the
parent, though it nearly always is, and keeping them in one file is the
right default because the alternative means maintaining two trees that
must agree.

## `relativePath`, and why Initializr POMs carry `<relativePath/>`

`relativePath` defaults to `../pom.xml`. Two consequences:

- If your parent is **not** one directory up, say so. Otherwise Maven
  reads whatever POM happens to be there, finds coordinates that do not
  match, and fails with a message about a non-resolvable parent rather
  than quietly falling through to the repository.
- If your parent lives **only** in a repository, write `<relativePath/>`
  — an empty element — to skip the filesystem probe entirely. That is
  why every Spring Initializr POM has it. Copying such a POM into a
  multi-module repo without removing the empty tag produces a network
  lookup for a parent sitting right there on disk.

## What is inherited

Inherited: `groupId`, `version`, `description`, `url`, `organization`,
`licenses`, `developers`, `contributors`, `scm`, `properties`,
`dependencyManagement`, **`dependencies`**, `repositories`,
`distributionManagement`, `build` (including `pluginManagement` and
`plugins`), and `reporting`.

Not inherited: `artifactId`, `name`, `prerequisites`, and `profiles`
themselves — although an active profile's *effect* on the merged model
is inherited along with everything else it changed.

Collections **merge**, they do not replace. A child's `<dependencies>`
are added to the parent's; a child's `<plugins>` are added to the
parent's; same-key entries are overridden element by element. This is
why "I removed it from my POM and it is still on the classpath" is
almost always inheritance, and never caching.

## 🔴 The one that bites: `<dependencies>` in a parent

A dependency in the parent's `<dependencies>` lands on **every child,
unconditionally**. This is the most common structural defect in a
multi-module repository, and it always arrives with good intentions:
someone puts JUnit — or Lombok, or a JDBC driver, or all of Spring Web —
in the parent "so we don't repeat it". Now the pure-domain module
compiles against a web framework, its POM gives no hint of that, and the
architectural boundary the module structure was created to enforce is
gone.

The parent should carry **`<dependencyManagement>`** — versions and
scopes only, zero classpath effect — and each module should declare,
without a version, what it actually uses:

```xml
<!-- parent -->
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <version>5.14.0</version>
      <scope>test</scope>
    </dependency>
  </dependencies>
</dependencyManagement>

<!-- child: no version, no scope, and the choice is visible -->
<dependencies>
  <dependency>
    <groupId>org.junit.jupiter</groupId>
    <artifactId>junit-jupiter</artifactId>
  </dependency>
</dependencies>
```

**The honest exception**: a dependency every module truly needs and
whose presence carries no architectural meaning — an SLF4J API, an
annotations-only jar — is defensible in the parent's `<dependencies>`,
and plenty of good repositories do it. It is a judgement call, not a
law. What is not defensible is anything a reviewer would want to see
declared: a framework, a driver, a client library. Maven cannot enforce
the distinction, so `maven-enforcer-plugin`'s banned-dependency rules
plus review are what you actually have, and both work far better against
an explicit per-module list than against an inherited one.

## Maven 4: the same model with far less typing

Maven 4 **renames `<modules>` to `<subprojects>`** precisely because
"module" already means a JPMS module
([phase 0 topic 11](../../phase-0-platform-jvm/11-module-system.md)) and
the collision has confused readers for a decade. The old element still
works.

It also infers most of the boilerplate:

```xml
<!-- Maven 4: the parent is the POM in the parent directory -->
<parent/>

<artifactId>invoice-service</artifactId>
<!-- no groupId, no version: inherited -->

<dependencies>
  <dependency>
    <groupId>com.acme</groupId>
    <artifactId>invoice-domain</artifactId>
    <!-- no version: inferred from the sibling subproject -->
  </dependency>
</dependencies>
```

and a `pom`-packaged project with no `<subprojects>` element
**discovers** child directories that contain a `pom.xml`. Maven 4
additionally adds `${project.rootDirectory}`, `${session.topDirectory}`
and `${session.rootDirectory}`, which finally make "a file at the
repository root" addressable from a deeply nested module — the gap
people papered over with `../../..` chains that broke the moment anyone
rearranged the tree.

The trade in inference is real and worth naming: an inferred POM is
shorter to write and harder to read out of context, because the version
you are building against is no longer visible in the file. Maven 4's
flattened **consumer POM** covers the published side (downstream sees
resolved values), but a human opening one subproject file sees less than
they used to. Use inference for versions inside your own reactor, where
lock-step is the intent anyway; keep third-party versions written down.

## Gotchas

**Symptom:** "Non-resolvable parent POM ... Could not find artifact"
**Cause:** the parent is not at the default `../pom.xml` and no `<relativePath>` was given, or the parent was never installed to the local repository
**Fix:** point `<relativePath>` at the real location, or `<relativePath/>` plus a real install/deploy of the parent; building from the aggregator supplies it through the reactor instead

**Symptom:** a domain module compiles against a framework nobody declared in it
**Cause:** the dependency sits in the parent's `<dependencies>` and is inherited unconditionally
**Fix:** move it to `<dependencyManagement>` and declare it version-less in the modules that use it; add an enforcer ban so it cannot return

**Symptom:** you delete a dependency from a module's POM and it is still on the classpath
**Cause:** inheritance or transitivity — collections merge, they do not replace
**Fix:** `help:effective-pom` shows whether it is inherited, `dependency:tree` whether it is transitive; the two have different fixes and you must know which before editing

**Symptom:** a module builds "too early" and fails on a missing sibling artifact
**Cause:** a missing inter-module dependency declaration — reactor order comes from dependency edges, not from list order
**Fix:** declare the dependency; reordering `<modules>` cannot fix it and will hide the real problem next time the file is rearranged

**Symptom:** `${project.version}` in a child resolves to the parent's version, noticed at release time
**Cause:** `<version>` is inherited when the child omits it
**Fix:** lock-step versioning across a reactor is a legitimate and common choice — usually the right one. If a module genuinely must version independently, declare its `<version>` explicitly and accept that release automation gets harder

**Symptom:** a module builds fine standalone and fails inside the reactor, or vice versa
**Cause:** standalone resolution pulls the sibling from the local repository (possibly stale); the reactor uses the freshly built one
**Fix:** reproduce with `mvn -pl <module> -am verify` from the root, which builds the module *and* its reactor dependencies, instead of `cd`-ing into it

**Symptom:** a plugin configured in the aggregator POM's `<plugins>` never runs for the children
**Cause:** `<plugins>` in a `pom`-packaged aggregator is inherited, but the aggregator itself has almost no lifecycle bindings, so its own build does nothing visible
**Fix:** know which effect you want — `<pluginManagement>` to configure without enabling, `<plugins>` to enable for every child, and neither runs on the aggregator itself

## Interview questions

**★ `<parent>` vs `<modules>` — what is the difference?**
Inheritance versus aggregation. `<parent>` says "start from this
configuration"; `<modules>` says "build these too". They are
independent: `spring-boot-starter-parent` is a parent that aggregates
nothing, and you can aggregate modules that inherit from elsewhere. Same
file usually, entirely different mechanisms.

**★ A colleague adds a dependency to the parent POM "so we don't repeat it". What do you say?**
That `<dependencies>` is inherited by every module, so it lands on the
classpath of modules that neither need it nor should compile against it
— coupling that is invisible in those modules' own POMs.
`<dependencyManagement>` fixes the version for anyone who declares it
and has no classpath effect for anyone who doesn't. I'd allow the
exception for something like an SLF4J API, and not for a framework.

**★ Why does every Spring Initializr POM contain `<relativePath/>`?**
Because `relativePath` defaults to `../pom.xml`. The starter parent is
on Maven Central, not one directory up, so the empty element skips the
filesystem probe and resolves from the repository. Without it, Maven
reads whatever POM is in the parent directory and fails on the
coordinate mismatch.

**★ Does the order of `<modules>` control build order?**
No. Maven topologically sorts the reactor from inter-module
dependencies. A module building "too early" means a dependency
declaration is missing; reordering the list cannot fix it.

**★ Which POM elements are *not* inherited?**
`artifactId`, `name`, `prerequisites` and `profiles` themselves. Almost
everything else is, and collections merge rather than replace — which is
the mechanical reason a dependency you deleted can still be present.

**★ How do you build one module and only what it needs, from the repository root?**
`mvn -pl invoice-service -am verify` — `-pl` selects the project, `-am`
("also make") adds its reactor dependencies. It is the right way to
reproduce a module-scoped failure, because `cd`-ing into the module
resolves siblings from the local repository instead, which may be stale.

**★ What does Maven 4 change here?**
`<modules>` becomes `<subprojects>` to stop colliding with JPMS; a bare
`<parent/>` infers the parent from the parent directory; subprojects can
omit `groupId` and `version`; sibling dependency versions are inferred;
a `pom`-packaged project with no subprojects list discovers them from
child directories; and `${project.rootDirectory}` makes a repo-root file
addressable without `../../..`.

**★ What is the downside of Maven 4's POM inference?**
Readability out of context. An inferred POM no longer states the version
you build against, so a human opening one subproject file learns less
than before. The published consumer POM is flattened so downstream is
unaffected — the cost falls on your own reviewers. Infer inside your
reactor, where lock-step is the intent; keep third-party versions
written down.

---

← Prev: [The POM and coordinates](01-the-pom-and-coordinates.md) · Index: [Maven core](README.md) · Next → [The effective POM and properties](03-effective-pom-and-properties.md)
