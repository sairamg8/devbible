---
title: "ArchUnit enforces service boundaries without requiring Spring Modulith — plain JUnit assertions against compiled bytecode that catch architectural rot before code reaches review"
sidebar_label: "26 · ArchUnit rules"
sidebar_position: 43
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the ArchUnit user guide
> ([archunit.org](https://www.archunit.org/userguide/html/000_Index.html)) — the importer and
> `ImportOption`s, JUnit 5 support, `SlicesRuleDefinition`, `layeredArchitecture` /
> `onionArchitecture`, `FreezingArchRule` and its `archunit.properties` keys, and the
> empty-`should` rule. **`ArchUnit 1.4.2` is this project's pin; the user guide is served
> unversioned, so it is cited as the guide rather than as a version-stamped page.**
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · ArchUnit 1.4.2 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**Spring Modulith is not the only mechanism for verifying bounded contexts in-process, and for non-Spring projects or legacy codebases, it may not even be an option. ArchUnit inspects compiled JVM bytecode directly via a fluent Java DSL in standard JUnit 5 tests, providing boundary enforcement without requiring framework adoption. With ArchUnit, you can mechanically forbid circular dependencies between packages, ban cross-context persistence access, and prevent foreign domains from querying internal repositories. A team that writes their service boundaries into ArchUnit rules has converted architectural principles from human guidelines into an automated build gate.**
## Why ArchUnit for boundary enforcement

Architectural guidelines documented in wikis or discussed in design reviews suffer from inevitable erosion. Under deadline pressure, a developer imports an `OrderRepository` into `BillingService` because "it was just one quick query." Without automated enforcement, the boundary silently collapses.

ArchUnit acts as a static analysis engine executed during the test phase:
- It requires no runtime Spring context and boots in milliseconds.
- It parses compiled `.class` files, inspecting type references, method calls, field accesses, and annotations.
- It fails the test—and therefore the CI build—with a descriptive failure message detailing the exact file and line number where the illegal dependency was introduced.

## The core boundary rules in code

Here is a complete, runnable ArchUnit test class enforcing clean bounded context boundaries for an e-commerce system:

```java
package com.retailer.architecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

@AnalyzeClasses(
    packages = "com.retailer",
    importOptions = {ImportOption.DoNotIncludeTests.class, ImportOption.DoNotIncludeJars.class}
)
public class BoundedContextBoundaryTests {

    // 1. Enforce that top-level domain packages form a Directed Acyclic Graph
    @ArchTest
    public static final ArchRule no_cycles_between_domain_slices =
        slices().matching("com.retailer.(*)..")
            .should().beFreeOfCycles()
            .as("Bounded context packages must not have cyclic dependencies");

    // 2. Prevent downstream domains from depending on internal packages of another domain
    @ArchTest
    public static final ArchRule no_access_to_order_internals =
        noClasses().that().resideOutsideOfPackage("com.retailer.order..")
            .should().dependOnClassesThat().resideInAPackage("com.retailer.order.internal..")
            .as("Order internals must not be accessed from outside the order package");

    // 3. Prevent direct repository access across domain boundaries
    @ArchTest
    public static final ArchRule repositories_must_be_private_to_their_context =
        classes().that().haveSimpleNameEndingWith("Repository")
            .should().onlyBeAccessed().byClassesThat().resideInAnyPackage(
                "com.retailer.order..",
                "com.retailer.billing..",
                "com.retailer.catalog.."
            )
            .as("Repositories may only be accessed by classes within their own bounded context");

    // 4. Forbid foreign JPA entity references (prevents cross-boundary joins)
    @ArchTest
    public static final ArchRule no_cross_boundary_entity_dependencies =
        noClasses().that().resideInAPackage("com.retailer.billing..")
            .should().dependOnClassesThat().resideInAPackage("com.retailer.order.model..")
            .as("Billing must never directly reference Order entity models");
}
```

## Three patterns ArchUnit settles that Modulith leaves to you

While Spring Modulith focuses on modular structure conventions, ArchUnit allows fine-grained rules tailored to specific architectural dangers:

### 1. Banning cross-aggregate JPA relationships

In JPA, developers frequently place `@ManyToOne` relationships pointing directly from a `Payment` entity to an `Order` entity. This creates an implicit database foreign key constraint and allows Hibernate to traverse boundaries via lazy loading. ArchUnit can specifically ban entities in `billing` from referencing entities in `order`:

```java
@ArchTest
public static final ArchRule no_cross_boundary_jpa_relations =
    noClasses().that().areAnnotatedWith("jakarta.persistence.Entity")
        .and().resideInAPackage("com.retailer.billing..")
        .should().dependOnClassesThat().areAnnotatedWith("jakarta.persistence.Entity")
        .and().resideInAPackage("com.retailer.order..");
```

### 2. Guarding the published language

The rule you want is *"nothing in the published API may drag an internal type across the boundary"*,
and it is best expressed as a prohibition rather than a shape assertion:

```java
@ArchTest
public static final ArchRule api_packages_must_not_leak_internals =
    noClasses().that().resideInAPackage("com.retailer.*.api..")
        .should().dependOnClassesThat().resideInAPackage("com.retailer..internal..")
        .as("A published API type must not expose an internal type in its signature");

@ArchTest
public static final ArchRule api_packages_must_not_carry_persistence =
    noClasses().that().resideInAPackage("com.retailer.*.api..")
        .should().beAnnotatedWith("jakarta.persistence.Entity")
        .as("Published API types are contracts, not entities");
```

⚠️ **A note on shape assertions.** It is tempting to write *"every public API type must be a record
or an interface"*. ArchUnit's DSL is extensible enough to express that, but **the user guide does not
document a `beRecords()` predicate**, and predicate names differ between versions — so this page does
not put one in a copyable example. If you want the shape rule, write it as a custom
`ArchCondition` against `JavaClass`, or check the exact predicate name against the ArchUnit version
in your own build before relying on it. The prohibition rules above need no such check and catch the
defect that actually matters.

### 2b. The two library APIs this page would otherwise skip

`slices()` answers *"are my contexts acyclic"*. Two more library rules answer questions that come up
inside one context, and both are documented forms:

```java
@ArchTest
public static final ArchRule layers_are_respected =
    layeredArchitecture()
        .consideringAllDependencies()
        .layer("Controller").definedBy("..controller..")
        .layer("Service").definedBy("..service..")
        .whereLayer("Service").mayOnlyBeAccessedByLayers("Controller");

@ArchTest
public static final ArchRule the_domain_is_at_the_centre =
    onionArchitecture()
        .domainModels("com.retailer.order.domain.model..")
        .domainServices("com.retailer.order.domain.service..")
        .applicationServices("com.retailer.order.application..")
        .adapter("persistence", "com.retailer.order.adapter.persistence..");
```

🔴 **Note what `layeredArchitecture()` is for, and what it is not.** It governs layers *inside* one
bounded context. Using it to describe the whole application — a Controller layer, a Service layer and
a Repository layer spanning every domain — is [12 · Splitting by layer](12-splitting-by-layer.md)
expressed as an architecture test, and it will happily certify a codebase with no service boundaries
at all as compliant.

### 3. Hexagonal / Onion architecture within a context

If a bounded context follows hexagonal architecture, ArchUnit ensures that domain logic never depends on infrastructure, adapters, or web frameworks:

```java
@ArchTest
public static final ArchRule domain_must_not_depend_on_spring =
    noClasses().that().resideInAPackage("..order.domain..")
        .should().dependOnClassesThat().resideInAPackage("org.springframework..");
```

## The programmatic form, and why you sometimes need it

`@AnalyzeClasses` is the JUnit 5 entry point and takes `ImportOption` **classes**. The programmatic
importer takes `Predefined` **constants**, and the guide's form is:

```java
JavaClasses classes = new ClassFileImporter()
    .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_JARS)
    .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
    .importClasspath();

myRule.check(classes);
```

Also available: `.importPackages("com.mycompany.myapp")` and `.importPath("/some/path/to/classes")`.
Reach for this when the rule set is computed rather than declared — one rule per module read from a
manifest, for instance — or when you want to run the same rules from a build plugin rather than a
test.

Getting the rules right is half the job. Getting them **adopted** on a codebase that already
fails them is the other half, and it is where most ArchUnit suites die —
[26b · Making the rules stick](26b-making-the-rules-stick.md).

## Gotchas

**★ Symptom: the ArchUnit test dominates the local build, and it grows worse as dependencies are added.**
Cause: ArchUnit is scanning `.class` files in third-party JARs on the classpath, so the cost tracks
your dependency tree rather than your codebase.
Fix: exclude JARs at the importer. The scan then tracks your own class count, which is the thing you
control:
```java
@AnalyzeClasses(
    packages = "com.retailer",
    importOptions = {ImportOption.DoNotIncludeJars.class, ImportOption.DoNotIncludeTests.class})
```
⚠️ Exclude tests too, or a test class declared in a production package will be analysed as if it were
production code — see [24b · When one flat package is not enough](24b-when-one-flat-package-is-not-enough.md).

**★ Symptom: Test passes locally in the IDE but fails in Maven / Gradle CI.**
Cause: Incomplete clean builds. The IDE has stale `.class` files in `target/` or `build/` that were not recompiled, or CI runs with different compiler target flags.
Fix: Run a clean compile before testing: `mvn test-compile` or `gradle testClasses`.

**★ Symptom: ArchUnit fails to catch illegal cross-boundary access through reflection or Spring application context lookups.**
Cause: ArchUnit analyzes static bytecode references (imports, field types, method signatures, byte instructions). It cannot detect `applicationContext.getBean("orderRepository")` or reflection.
Fix: Forbid calls to `ApplicationContext.getBean` in domain code with a dedicated ArchRule, and require constructor injection.

**★ Symptom: the failure message names a rule but nobody can tell what architectural intent it protected.**
Cause: the generated description restates the DSL, which reads as machinery rather than as a reason.
Fix: `.as(...)` replaces it, and the guide's own example is exactly this use —
`classes().that(...).should(...).as("Payload may only be accessed in a secure way")`. Write the
sentence you would have said in the design review:
```java
noClasses().that().resideInAPackage("com.retailer.billing..")
    .should().dependOnClassesThat().resideInAPackage("com.retailer.order.internal..")
    .as("Billing reads order state through the order API, never through its internals — "
      + "this is the line that makes billing extractable");
```

**★ Symptom: `slices().matching("com.retailer.(*)..")` reports cycles between things that are not bounded contexts.**
Cause: the capture group decides what a slice *is*, and one placed at the wrong depth partitions on
the wrong axis. Capturing the segment after `com.retailer` gives you `order`, `billing`,
`inventory` — contexts. Capturing one level deeper gives you `order.internal` versus `order.api` and
reports intra-module structure as if it were an architecture violation.
Fix: match the capture group to the level your modules actually live at, and assert the slice names
you expect rather than trusting the regex.

**★ Symptom: two teams each add boundary rules and the suites contradict each other.**
Cause: rules were written per team rather than per boundary, so the same import is required by one
suite and forbidden by another.
Fix: one rule set per bounded context, owned by the context's team and living in that context's
package, plus a single shared cycle rule for the whole application. Ownership of a rule should match
ownership of the thing it protects.

## Interview questions

**★ How does ArchUnit differ from Spring Modulith verification, and how should a team choose between them?**
Spring Modulith provides opinionated conventions specifically tailored to Spring Boot applications, organizing modules around package roots and generating architectural documentation. ArchUnit is a general-purpose Java bytecode analysis tool that works with any JVM framework. Teams choose ArchUnit when they need highly specific, non-standard rules (such as banning JPA annotations across domains, enforcing hexagonal layers within a module, or checking class naming conventions) or when operating outside Spring Boot. Many production systems use both: Spring Modulith for high-level module verification and ArchUnit for deep structural assertions.

**★ How does ArchUnit verify that bounded contexts are free of cyclic dependencies?**
ArchUnit uses `slices().matching("com.retailer.(*)..").should().beFreeOfCycles()`. It partitions the classes into logical slices based on the regex capture group (e.g. `order`, `billing`, `inventory`). It then builds a directed graph of all bytecode dependencies between those slices. If any path through the graph leads back to an originating slice (e.g. `order` -> `billing` -> `inventory` -> `order`), ArchUnit detects the cycle and outputs the exact chain of classes and method calls forming the cycle.

**★ Can ArchUnit detect database coupling such as foreign keys or shared tables?**
ArchUnit cannot inspect database schemas directly, but it effectively prevents database coupling at the code level. It can assert that entity classes in one domain never reference entity classes in another, that repositories in one domain are never accessed by foreign services, and that database transaction annotations (`@Transactional`) do not span multiple domain repositories within a single method.

**★ What is the performance profile of running ArchUnit tests in CI?**
ArchUnit performs in-memory bytecode analysis and starts no Spring context, web server or database,
so the cost is dominated by how many `.class` files it reads rather than by anything at runtime. The
variable that matters is therefore whether JAR scanning is on: with `DoNotIncludeJars` the scan
tracks your own class count, and without it, it tracks your entire dependency tree. Measure it in
your own build rather than trusting a figure — the number depends entirely on codebase size, and
this page will not invent one for you.

**★ When would you reach for `layeredArchitecture()` and when is it the wrong tool?**
It is the right tool for describing layers *within* one bounded context — the adapters, the
application service and the domain model of the order module, where a dependency pointing the wrong
way is a genuine defect. It is the wrong tool for describing the application, because a Controller /
Service / Repository layering that spans every domain certifies a package-by-layer codebase as
architecturally sound while it has no service boundaries at all. If you want the whole-application
rule, that is `slices()` on contexts, not layers.


---

← [Can the module boot alone?](25c-can-the-module-boot-alone.md) · [Topic index](README.md) · Next → [Making the rules stick](26b-making-the-rules-stick.md)
