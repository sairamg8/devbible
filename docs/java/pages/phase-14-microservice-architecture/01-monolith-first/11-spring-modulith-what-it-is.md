---
title: "Spring Modulith is an opinion about how a Spring Boot application is structured functionally, plus a test that fails when the structure is violated — and that second half is the entire reason a modular monolith is a different proposition in 2026 than it was in 2015"
sidebar_label: "11 · Spring Modulith: what it is"
sidebar_position: 27
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Spring Modulith reference *Overview*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/index.html)) and
> *Fundamentals*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/fundamentals.html));
> the published `spring-modulith-core:2.1.1` and `spring-modulith-bom:2.1.1` POMs on Maven
> Central; the `spring-boot-dependencies:4.1.0` POM; the Spring Modulith 2.1 GA and
> 2.2 M1 / 2.1.1 release announcements on
> ([spring.io](https://spring.io/blog/2026/06/11/spring-modulith-2-1-ga-2-0-7-and-1-4-12-released/)).
> Version spine: JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8 · Spring Modulith
> **2.1.1**. **No sandbox** — every version below comes from a published POM or a release
> announcement, not from a build that was run here.

**The argument up to this point has been that the modular monolith is the right default and
that its historical failure mode was reliance on discipline. Spring Modulith is the answer
to that failure mode: a convention for where modules live, an in-memory model of them
derived from the bytecode, and an `ApplicationModules.verify()` call you put in a JUnit test
so a boundary violation is a red build rather than a code-review comment somebody was too
busy to leave.**

## What the project says it is

> *"Spring Modulith is an opinionated toolkit to build domain-driven, modular applications
> with Spring Boot. In the same way that Spring Boot has an opinion on the technical
> arrangement of an application, Spring Modulith implements an opinion on how to structure an
> app functionally and allows its individual, logical parts to interact with each other. As a
> result, Spring Modulith enables developers to build applications that are easier to update
> so they can accommodate changing business requirements over time."*

And what it offers, from the *Fundamentals* opening:

> *"Spring Modulith supports developers implementing logical modules in Spring Boot
> applications. It allows them to apply structural validation, document the module
> arrangement, run integration tests for individual modules, observe the modules' interaction
> at runtime, and generally implement module interaction in a loosely coupled way."*

Five capabilities, and they map exactly onto the costs this topic has been pricing:

| Capability | The cost it addresses | Chunks |
|---|---|---|
| Structural validation | Boundaries erode under delivery pressure | [35](12-verifying-the-arrangement.md)–[38](12d-what-verification-cannot-see.md) |
| Documentation of the arrangement | Architecture documents go stale silently | [50](15-documenter-and-the-canvas.md) |
| Per-module integration tests | Test isolation and build time | [39](13-the-module-test-slice.md)–[44](13f-change-aware-test-execution.md) |
| Runtime observation | Per-module attribution without distributed tracing | [51](15b-actuator-and-observability.md) |
| Loosely coupled interaction | Design-time coupling, the thing that blocks extraction | [45](14-events-instead-of-bean-references.md)–[49](14e-externalization-and-the-seam.md) |

## What an application module is, per the definition

> *"In a Spring Boot application, an application module is a unit of functionality that
> consists of the following parts:"*
>
> *"An API exposed to other modules implemented by Spring bean instances and application
> events published by the module, usually referred to as provided interface."*
>
> *"Internal implementation components that are not supposed to be accessed by other
> modules."*
>
> *"References to API exposed by other modules in the form of Spring bean dependencies,
> application events listened to and configuration properties exposed, usually referred to as
> required interface."*

Two things worth noticing. First, **application events are part of the provided interface**,
on equal footing with beans — the framework's model of a module treats "what I publish" as
part of "what I expose", which is why the event-based integration story in chunks
[45](14-events-instead-of-bean-references.md)–[49](14e-externalization-and-the-seam.md) is
not a side feature. Second, the required interface explicitly includes **configuration
properties**, which is a coupling channel most architecture diagrams ignore entirely.

## Getting it onto the classpath — and the fact that surprises people

🔴 **Spring Boot's dependency management does not include Spring Modulith.** The
`spring-boot-dependencies:4.1.0` BOM declares no `spring-modulith` version property and
manages none of its artefacts, so you must import Spring Modulith's own BOM. The reference
says to do exactly that:

> *"Spring Modulith consists of a set of libraries that can be used individually and
> depending on which features of it you would like to use. To ease the declaration of the
> individual modules, we recommend to declare the following BOM in your Maven POM"*

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.springframework.modulith</groupId>
      <artifactId>spring-modulith-bom</artifactId>
      <version>2.1.1</version>
      <scope>import</scope>
      <type>pom</type>
    </dependency>
  </dependencies>
</dependencyManagement>
```

Then the starter and the test starter:

```xml
<dependency>
  <groupId>org.springframework.modulith</groupId>
  <artifactId>spring-modulith-starter-core</artifactId>
</dependency>

<dependency>
  <groupId>org.springframework.modulith</groupId>
  <artifactId>spring-modulith-starter-test</artifactId>
  <scope>test</scope>
</dependency>
```

Gradle:

```groovy
dependencyManagement {
  imports {
    mavenBom 'org.springframework.modulith:spring-modulith-bom:2.1.1'
  }
}
```

## What 2.1.1 actually is, verified from the artefacts

The reference's **Appendix A** compatibility matrix is stale — at the time of writing it
stops at *"2.0 (snapshot) … 4.0 SNAPSHOT"* and does not list 2.1 at all. Do not use it. The
published `spring-modulith-core:2.1.1` POM is authoritative and declares:

| Dependency | Version in `spring-modulith-core:2.1.1` |
|---|---|
| `org.springframework:spring-core`, `spring-context` | **7.0.9** |
| `org.springframework.boot:spring-boot-autoconfigure` (optional) | **4.1.1** |
| `org.springframework.data:spring-data-commons` (optional) | **4.1.1** |
| `com.tngtech.archunit:archunit` | **1.4.2** |
| `org.jmolecules:jmolecules-ddd` (optional) | 2.0.1 |
| `org.jmolecules.integrations:jmolecules-archunit` (optional) | 0.33.0 |
| `org.jspecify:jspecify` | 1.0.1 |

So 2.1.1 is compiled against Boot 4.1.1 / Framework 7.0.9 and works on this phase's Boot
4.1.0 / Framework 7.0.8 spine. And the direction of travel is confirmed by the 2.2 M1
announcement: *"The first milestone of 2.2 moves to Spring Boot 4.2 M1 (GH-1799) and Spring
Framework 7.1 M1 (GH-1798)"* — 2.1.x is the Boot 4.1 line.

**ArchUnit is the engine.** Verification is ArchUnit rules over the bytecode, which is why
it is a test-time, not runtime, mechanism by default, and why the analysis sees *type
references* and nothing else — an important limitation covered in
[38 · What verification cannot see](12d-what-verification-cannot-see.md).

## What 2.1 added, from the GA announcement

> *"Support for an event externalization outbox with Namastack and JobRunr"*
>
> *"Support for application module testing in combination with Boot's slice test support"*
>
> *"Open up `PublishedEvents` and `Scenario` to see events from all threads by default"*
>
> *"Streamline observability infrastructure"*

The second is `@ModuleSlicing` — [42 · ModuleSlicing](13d-moduleslicing.md) — and it is the
one that most changes day-to-day work, because it lets a module test also be a `@DataJpaTest`
rather than a full application context.

## The three-line version of the whole facility

```java
package com.acme.commerce;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ModularityTests {

    @Test
    void verifiesModularStructure() {
        ApplicationModules.of(CommerceApplication.class).verify();
    }
}
```

That test is the mechanism the argument in [08 · The honest
counterargument](03b-the-honest-counterargument.md) turns on. Everything else in this band —
named interfaces, allowed dependencies, module tests, the canvas, the event registry — is
elaboration on making that test say something useful.

## Gotchas

**★ Spring Boot's BOM does not manage Spring Modulith versions, and people assume it does.**
`spring-boot-dependencies:4.1.0` declares no Modulith version property. Import
`spring-modulith-bom` explicitly and pin it, or you will be declaring versions on every
artefact by hand and eventually mixing them.

**★ The reference appendix's Spring Boot compatibility matrix is stale — use the published
POM instead.** It stops at 2.0-snapshot against Boot 4.0 and does not mention 2.1 at all.
The `spring-modulith-core:2.1.1` POM shows Boot 4.1.1 and Framework 7.0.9, and the 2.2 M1
announcement confirms 2.2 is the line that moves to Boot 4.2. Reading the artefact beats
reading a table someone forgot to update.

**★ Verification is ArchUnit over bytecode, which decides what it can and cannot see.** It
analyses type references between packages. It does not see reflection, Spring bean names,
SQL, table access or configuration property keys. Knowing the engine tells you the limits
before you are surprised by them.

**★ `spring-modulith-starter-core` is not enough for the runtime features.** Actuator,
observability and module initialisers need their own artefacts, and the reference is
explicit that customisations to module detection must live in *production* sources rather
than test sources if you use them. Getting this wrong produces a verification that passes in
tests and a runtime that models the modules differently.

**★ Adding Modulith to an existing codebase will fail on the first run, and that is the
point.** A codebase that has never had boundaries enforced has violations. The adoption path
is `detectViolations()` with a filter, not `verify()` on day one —
[36 · detectViolations and adoption](12b-detectviolations-and-adoption.md). Teams that run
`verify()` first, see hundreds of failures and delete the test are the common failure mode.

**★ The module model treats published events and consumed configuration properties as part
of the module interface, which is broader than most people's mental model.** Two modules
that share no types but both read `acme.commerce.tax.rate` are coupled through
configuration, and two modules connected only by an event are coupled through its payload
shape. Both channels are real and both are invisible on a package diagram.

## Interview questions

**★ What problem does Spring Modulith solve that a package structure does not?**
Enforcement. A package structure expresses an intention; nothing stops a developer importing
`inventory.internal.StockLedger` from the ordering module at 6pm on a Friday, and the
historical evidence — Fowler's "too easy for module boundaries to be breached", Tilkov's
"in practice, I've found this to be the case only very rarely" — is that intentions do not
hold. Spring Modulith derives a module model from the code and gives you
`ApplicationModules.of(Application.class).verify()`, which fails the build on the commit that
crosses a boundary. It also provides per-module test slicing, generated architecture
documentation, runtime observability per module, and an event-based integration mechanism
with a durable publication log.

**★ How do you add Spring Modulith to a Boot 4.1 project, and what is the trap?**
Import `spring-modulith-bom` under `dependencyManagement` — pinned at 2.1.1 for this spine —
then add `spring-modulith-starter-core` and `spring-modulith-starter-test` in test scope. The
trap is assuming Spring Boot's own BOM manages the versions; it does not, so without the
explicit BOM import you end up declaring versions per artefact and eventually mixing
incompatible ones. The second trap is running `verify()` immediately on an existing codebase,
which will fail with a long list; the adoption path is `detectViolations()` with a filter
that ignores the known violations while failing on new ones.

**★ What is Spring Modulith built on, and why does that matter?**
ArchUnit — `spring-modulith-core:2.1.1` declares `com.tngtech.archunit:archunit:1.4.2` as a
compile dependency — plus optional jMolecules integration for DDD and architecture rules. It
matters because it defines the boundary of what verification can detect: ArchUnit analyses
type references in bytecode, so it sees imports, field types, parameter types and method
calls between packages, and it does not see reflection, Spring bean lookups by name, SQL
strings, database table access or shared configuration keys. Everything the verification
misses falls into one of those categories, and the shared-database coupling that most
threatens a future extraction is entirely invisible to it.

**★ How would you establish which Spring Modulith version to use with Spring Boot 4.1?**
Not from the reference's compatibility appendix, which at the time of writing stops at
2.0-snapshot against Boot 4.0 and omits 2.1 entirely. Read the published POM: the
`spring-modulith-core:2.1.1` artefact on Maven Central declares `spring-boot-autoconfigure`
4.1.1 and `spring-core` 7.0.9, which puts 2.1.x on the Boot 4.1 line. Corroborate with the
release announcements — the 2.2 M1 post states that 2.2 moves to Spring Boot 4.2 M1 and
Spring Framework 7.1 M1, which confirms 2.1 as the preceding line. Two independent published
sources beat one table that may not have been regenerated.

{/* FOOTER */}
