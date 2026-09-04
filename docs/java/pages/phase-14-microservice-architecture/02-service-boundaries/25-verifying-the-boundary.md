---
title: "Boundary verification is a CI gate that turns architectural intent into an automated build failure — ApplicationModules.verify() proves a candidate service line holds before anyone spends months extracting it to Kubernetes"
sidebar_label: "25 · Verifying the boundary"
sidebar_position: 35
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Spring Modulith 2.1.1 reference documentation, *Verifying Application Module Structure*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/verification.html)) and *Fundamentals*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/fundamentals.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 · Spring Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. Documentation-validated; **no sandbox run**.

**A candidate service boundary drawn on a whiteboard or documented in an architectural wiki is a hypothesis, not an architecture. If a proposed service boundary cannot survive in-process without circular dependencies, illegal imports, or leaking internal models, extracting it into an independent microservice guarantees a distributed monolith with lockstep deployments. Spring Modulith's `ApplicationModules.verify()` enforces three strict architectural rules in a standard JUnit 5 test: no cyclic dependencies between modules, efferent access strictly via API packages, and adherence to explicitly declared allowed dependencies. Verifying candidate boundaries in-process before extraction provides definitive proof that a service boundary is viable before anyone provisions databases, networks, or CI pipelines.**

## The pre-extraction test

The fundamental question of service decomposition is: *can this boundary actually hold?*

In a monolithic codebase, developers routinely violate boundaries because the compiler permits cross-package imports when classes are marked `public`. When teams decide to decompose the monolith, they often begin by provisioning a new repository, a database, and a CI pipeline—only to discover halfway through extraction that the domain logic cannot be separated without creating cyclic network calls or distributed transactions.

Spring Modulith provides the litmus test for extraction. By declaring module boundaries in package structure and verifying them with `ApplicationModules.verify()`, the boundary is enforced by bytecode analysis in the regular build. If the verification test fails, the boundary is mathematically incapable of surviving as an independent microservice. Fix the domain model in-process first, where refactoring takes minutes, rather than in production, where refactoring takes quarters.

## The three rules, verbatim

Spring Modulith's verification engine parses application bytecode and checks three fundamental architectural invariants:

> *"The verification includes the following rules:"*
>
> *"No cycles on the application module level — the dependencies between modules have to form a directed acyclic graph."*
>
> *"Efferent module access via API packages only — all references to types that reside in application module internal packages are rejected. See Advanced Application Modules for details. Dependencies into internals of Open Application Modules are allowed."*
>
> *"Explicitly allowed application module dependencies only (optional) — an application module can optionally define allowed dependencies via `@ApplicationModule(allowedDependencies = …)`. If those are configured, dependencies to other application modules are rejected."*

### 1. No cycles (DAG)

If module `order` imports module `inventory`, and module `inventory` imports module `order`, the two modules cannot be deployed, versioned, or released independently. Across a network, this dependency cycle becomes a circular HTTP call chain or a distributed deadlock. Spring Modulith requires module dependencies to form a Directed Acyclic Graph (DAG). If a cycle exists, the build fails immediately.

### 2. API packages only

By default, Spring Modulith treats a module's root package (e.g. `com.retailer.order`) as its public API. Any subpackage (such as `com.retailer.order.internal` or `com.retailer.order.domain`) is strictly private to that module. If a class in `com.retailer.billing` references a type in `com.retailer.order.internal`, `verify()` fails the build. This guarantees that internal persistence details, JPA entities, and helper classes are invisible outside the module boundary.

### 3. Explicitly allowed dependencies

An architectural map specifies allowed relationship directions: Order may depend on Customer and Catalog, but Catalog must never depend on Order. Spring Modulith allows modules to declare their allowed dependencies explicitly in `package-info.java`. Any unlisted import fails the build.

## The verification test in code

The verification test requires no running application context, no database, and no mock server. It inspects compiled `.class` files using ArchUnit under the hood and executes in seconds.

```java
package com.retailer;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class BoundaryVerificationTests {

    // Scans bytecode once and caches the module model across test methods
    private static final ApplicationModules MODULES = ApplicationModules.of(RetailApplication.class);

    @Test
    void verifiesCandidateServiceBoundaries() {
        // Enforces the 3 rules: DAG, API-only access, and allowed dependencies
        MODULES.verify();
    }
}
```

To configure explicit dependency permissions on a module, declare `@ApplicationModule` in the module's `package-info.java`:

```java
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = {"catalog", "customer"}
)
package com.retailer.order;
```

If any class in `com.retailer.order` attempts to import a type from `com.retailer.payment` or `com.retailer.shipping`, `MODULES.verify()` rejects the commit. The boundary is maintained by the CI runner on every pull request.

*(The full tour of Spring Modulith's framework capabilities—including domain event publishing, documentation generation, and module test slices—belongs to [01 · Monolith first](../01-monolith-first/11-spring-modulith-what-it-is.md). Here in topic 02, `verify()` is used strictly as the pre-extraction boundary audit tool.)*

## What verification failures tell you about your boundaries

When `MODULES.verify()` fails, it is not a lint error; it is a diagnosis of a broken boundary:

| Failure pattern | What it diagnosed | The architectural fix |
|---|---|---|
| **Cyclic dependency** between A and B | Bi-directional coupling; A and B cannot be separated into microservices | Decouple via asynchronous domain events, or merge A and B into one service |
| **Access to internal package** | Leaking implementation details; outside code touches internal aggregate state | Expose a command/query DTO in the root API package, or use a `@NamedInterface` |
| **Undeclared dependency** | Architecture drift; downstream module is silently coupling to an unrelated upstream | Evaluate if relationship is valid; if yes, add to `allowedDependencies`; if no, eliminate import |

## Gotchas

**★ Symptom: `MODULES.verify()` fails with a cycle between two candidate services.**
Cause: Module A calls Module B directly, and Module B calls Module A directly, creating bi-directional design-time coupling.
Fix: Invert one direction of the dependency using an in-process domain event (`ApplicationEventPublisher`), or merge the two modules if they share a common invariant:
```java
// Instead of Inventory calling OrderService directly:
// Order publishes OrderPlacedEvent, Inventory listens asynchronously
@ApplicationModuleListener
void on(OrderPlacedEvent event) {
    inventoryService.reserveStock(event.orderId(), event.items());
}
```

**★ Symptom: Legitimate subpackage access from external modules fails verification.**
Cause: Spring Modulith hides all subpackages by default, treating only the root module package as the public API.
Fix: Move the public interfaces/records to the module root package, or declare an explicit `@NamedInterface` on the subpackage (detailed in [25b · Named interfaces](25b-named-interfaces.md)).

**★ Symptom: Verification test runs slowly in CI when added to multiple test classes.**
Cause: Repeatedly invoking `ApplicationModules.of(...)` re-parses all classpath bytecode on every invocation.
Fix: Assign `ApplicationModules.of(...)` to a `private static final` field in a single test class or shared test base.

**★ Symptom: Generated code packages (e.g. OpenAPI, jOOQ, Protobuf) trigger spurious module violations.**
Cause: Modulith scans the entire package hierarchy under the application root and mistakes generated directories for application modules.
Fix: Filter out generated packages during module model creation using `JavaClass.Predicates`:
```java
ApplicationModules.of(
    RetailApplication.class,
    com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAPackage("com.retailer.generated..").negate()
).verify();
```

## Interview questions

**★ Why should candidate microservice boundaries be verified in-process before extraction?**
Decomposing a system into microservices across a network is an expensive, high-risk operational transformation involving network latency, independent data stores, eventual consistency, and distributed tracing. If candidate boundaries contain cyclic dependencies, leaking database entities, or tangled transaction boundaries, moving them to separate repositories across HTTP will produce a distributed monolith. Verifying boundaries in-process using `ApplicationModules.verify()` costs nothing in infrastructure and proves that components can be partitioned into a strict Directed Acyclic Graph with explicit APIs before any code moves across a network.

**★ What are the three architectural rules enforced by `ApplicationModules.verify()`?**
First, no cycles: module dependencies must form a strict directed acyclic graph, ensuring no circular dependencies exist between domains. Second, API packages only: external modules may only access types in an application module's designated API package (the root package by default), preventing access to internal implementation classes or persistence entities. Third, explicitly allowed dependencies: if a module defines `allowedDependencies` in its `@ApplicationModule` configuration, any reference to an unlisted module is rejected.

**★ How does Spring Modulith determine what constitutes an "internal" package?**
By default convention, Spring Modulith considers the base package of an application module (for example, `com.retailer.order`) as its public API package. All subpackages located beneath the base package (such as `com.retailer.order.internal` or `com.retailer.order.repository`) are automatically classified as internal. Any import of a class residing in an internal package by a class in another module (like `com.retailer.billing`) is treated as an architectural violation by `MODULES.verify()`.

**★ How does boundary verification handle domain event listeners?**
Spring Modulith specifically accommodates event-driven decoupling. When Module A publishes a domain event using Spring's `ApplicationEventPublisher`, Module A has zero dependencies on any consumers. Module B can listen to the event using `@ApplicationModuleListener` by depending only on the public event record published in Module A's API package. The verification engine recognizes this as a clean one-way dependency from Module B to Module A, successfully eliminating the bi-directional cycle that synchronous method invocation would have created.

---

← [Package structure is the boundary](24-package-structure-is-the-boundary.md) · [Topic index](README.md) · Next → [Named interfaces](25b-named-interfaces.md)
