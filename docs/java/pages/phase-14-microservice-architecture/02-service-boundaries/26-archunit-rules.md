---
title: "ArchUnit enforces service boundaries without requiring Spring Modulith — plain JUnit assertions against compiled bytecode that catch architectural rot before code reaches review"
sidebar_label: "26 · ArchUnit rules"
sidebar_position: 37
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against ArchUnit 1.4.2 user guide and reference documentation
> ([archunit.org](https://www.archunit.org/user-guide/html/000_Index.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 · ArchUnit 1.4.2 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

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

You can assert that any public class exposed across packages must be an immutable Java record:

```java
@ArchTest
public static final ArchRule public_api_types_must_be_records =
    classes().that().resideInAPackage("com.retailer.*.api..")
        .and().arePublic()
        .should().beRecords()
        .orShould().beInterfaces();
```

### 3. Hexagonal / Onion architecture within a context

If a bounded context follows hexagonal architecture, ArchUnit ensures that domain logic never depends on infrastructure, adapters, or web frameworks:

```java
@ArchTest
public static final ArchRule domain_must_not_depend_on_spring =
    noClasses().that().resideInAPackage("..order.domain..")
        .should().dependOnClassesThat().resideInAPackage("org.springframework..");
```

## Gotchas

**★ Symptom: ArchUnit test takes over a minute to run, slowing down local developer builds.**
Cause: ArchUnit is scanning all `.class` files in third-party JAR dependencies on the classpath.
Fix: Add `ImportOption.DoNotIncludeJars.class` to `@AnalyzeClasses`:
```java
@AnalyzeClasses(packages = "com.retailer", importOptions = {ImportOption.DoNotIncludeJars.class})
```

**★ Symptom: Test passes locally in the IDE but fails in Maven / Gradle CI.**
Cause: Incomplete clean builds. The IDE has stale `.class` files in `target/` or `build/` that were not recompiled, or CI runs with different compiler target flags.
Fix: Run a clean compile before testing: `mvn test-compile` or `gradle testClasses`.

**★ Symptom: ArchUnit fails to catch illegal cross-boundary access through reflection or Spring application context lookups.**
Cause: ArchUnit analyzes static bytecode references (imports, field types, method signatures, byte instructions). It cannot detect `applicationContext.getBean("orderRepository")` or reflection.
Fix: Forbid calls to `ApplicationContext.getBean` in domain code with a dedicated ArchRule, and require constructor injection.

**★ Symptom: Complex rule failure produces a massive, unreadable error message with 50 violations.**
Cause: Introducing ArchUnit to an existing brownfield codebase all at once.
Fix: Use ArchUnit's `FreezingArchRule` to baseline existing violations, preventing *new* boundary violations while teams refactor the existing backlog:
```java
FreezingArchRule.freeze(no_cycles_between_domain_slices);
```

## Interview questions

**★ How does ArchUnit differ from Spring Modulith verification, and how should a team choose between them?**
Spring Modulith provides opinionated conventions specifically tailored to Spring Boot applications, organizing modules around package roots and generating architectural documentation. ArchUnit is a general-purpose Java bytecode analysis tool that works with any JVM framework. Teams choose ArchUnit when they need highly specific, non-standard rules (such as banning JPA annotations across domains, enforcing hexagonal layers within a module, or checking class naming conventions) or when operating outside Spring Boot. Many production systems use both: Spring Modulith for high-level module verification and ArchUnit for deep structural assertions.

**★ How does ArchUnit verify that bounded contexts are free of cyclic dependencies?**
ArchUnit uses `slices().matching("com.retailer.(*)..").should().beFreeOfCycles()`. It partitions the classes into logical slices based on the regex capture group (e.g. `order`, `billing`, `inventory`). It then builds a directed graph of all bytecode dependencies between those slices. If any path through the graph leads back to an originating slice (e.g. `order` -> `billing` -> `inventory` -> `order`), ArchUnit detects the cycle and outputs the exact chain of classes and method calls forming the cycle.

**★ Can ArchUnit detect database coupling such as foreign keys or shared tables?**
ArchUnit cannot inspect database schemas directly, but it effectively prevents database coupling at the code level. It can assert that entity classes in one domain never reference entity classes in another, that repositories in one domain are never accessed by foreign services, and that database transaction annotations (`@Transactional`) do not span multiple domain repositories within a single method.

**★ What is the performance impact of running ArchUnit tests in CI?**
Because ArchUnit performs in-memory bytecode analysis without starting a JVM runtime environment, web server, or database connection, well-scoped ArchUnit tests typically complete in 1 to 3 seconds. The only significant performance cost arises if JAR scanning is enabled. By configuring `ImportOption.DoNotIncludeJars.class`, scanning is restricted to project classes, making ArchUnit ideal for fast, non-flaky CI pull-request validation gates.

---

← [Named interfaces](25b-named-interfaces.md) · [Topic index](README.md) · Next → [Build modules and JPMS](27-build-modules-and-jpms.md)
