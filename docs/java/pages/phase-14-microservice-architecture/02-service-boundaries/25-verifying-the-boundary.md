---
title: "Boundary verification is a CI gate that turns architectural intent into an automated build failure — ApplicationModules.verify() proves a candidate service line holds before anyone spends months extracting it to Kubernetes"
sidebar_label: "25 · Verifying the boundary"
sidebar_position: 44
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Spring Modulith 2.1.1 reference documentation, *Verifying Application Module Structure*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/verification.html)) and *Fundamentals*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/fundamentals.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. Documentation-validated; **no sandbox run**.

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

## 🔴 Adopting this on a codebase that already exists

Everything above assumes a clean run. On a five-year-old monolith the first `verify()` returns
**hundreds** of violations, the test is disabled within a day, and nothing is ever enforced. That
outcome is so common it is worth planning around before you write the test, and Modulith ships two
mechanisms for it that most introductions skip.

### `detectViolations()` — the ratchet

`verify()` is all-or-nothing: it throws on the first violation set it finds. `detectViolations()`
hands you the violations as data instead, so you can fail on the ones you have already fixed and
ignore the ones you have not:

```java
package com.retailer;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class BoundaryRatchetTests {

    private static final ApplicationModules MODULES = ApplicationModules.of(RetailApplication.class);

    @Test
    void noNewViolationsInTheModulesWeHaveAlreadyCleaned() {
        MODULES.detectViolations()
            .filter(violation -> violation.getMessage().contains("com.retailer.order"))
            .throwIfPresent();
    }
}
```

The documented form is exactly this shape:

> ```java
> ApplicationModules.of(…)
>   .detectViolations()
>   .filter(violation -> …)
>   .throwIfPresent();
> ```

**The discipline that makes it work:** the filter is an allow-list of modules that are *already
clean*, and it only ever grows. A module joins the list the day its violations reach zero and never
leaves. That converts an unwinnable big-bang cleanup into a per-module one, and it is the difference
between a rule that survives contact with the codebase and a `@Disabled` annotation.

⚠️ ArchUnit's own answer to the same problem is `FreezingArchRule`, which records today's violations
to a store and fails only on new ones — see [26 · ArchUnit rules](26-archunit-rules.md). Modulith's
filter is coarser and needs no store; the freeze is finer and needs a file committed to the repo.

### Open modules — the deliberate, temporary exemption

The other lever is to declare a module **open**, which switches rule 2 off for it:

```java
// src/main/java/com/retailer/legacy/package-info.java
@org.springframework.modulith.ApplicationModule(type = Type.OPEN)
package com.retailer.legacy;
```

Under an open module, access to internals is *"generally allowed"* and every type in every
sub-package joins the unnamed named interface. The reference is explicit about who it is for —
*"Intended for legacy applications gradually adopting Spring Modulith"* — and equally explicit
about what it means if you leave it there:

> *"Using open modules in fully-modularized applications hints at sub-optimal modularization and
> packaging structures."*

🔴 **Read that as a countdown, not a setting.** An open module is a boundary you have declared you
are not enforcing yet. If one is still open a year later, the honest description of your
architecture is that the module has no boundary, and the annotation is the only thing recording
that you once intended it to have one.

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

**★ Symptom: the first `verify()` on the existing codebase produces hundreds of violations, and the team's response is to delete the test.**
Cause: `verify()` is all-or-nothing, and an unmodularised monolith fails it comprehensively. A rule
that cannot go green on day one does not get fixed; it gets removed.
Fix: start with `detectViolations()` filtered to the one module you have actually cleaned, and grow
the filter as modules come clean. Never start with `verify()` on a brownfield codebase.
```java
MODULES.detectViolations()
    .filter(v -> CLEAN_MODULES.stream().anyMatch(m -> v.getMessage().contains(m)))
    .throwIfPresent();
```

**★ Symptom: `verify()` is green and the two "independent" modules cannot be deployed separately, because they read each other's tables.**
Cause: verification is **static analysis of bytecode**. A shared database table is not an import, a
`@Query` naming another module's table is a string, and neither is a type reference. Modulith cannot
see either.
Fix: the boundary check for data is a different check, and it is manual — the ownership register in
[10b · The ownership register](10b-the-ownership-register.md), plus a schema-per-module convention so
that a cross-module read needs a grant somebody has to write down.

**★ Symptom: `verify()` is green and a module reaches another module's internals through Spring.**
Cause: bean lookup by type or name — `context.getBean(SomeInternalThing.class)`, a
`@Qualifier` string, an SpEL expression in a property — resolves at runtime and leaves no compile-time
reference for bytecode analysis to find.
Fix: constructor-inject the module's published API type instead of pulling beans from the context,
and treat any `getBean` call crossing a module line as the violation it is.
```java
// invisible to verify(): resolved by type at runtime
InventoryInternals internals = context.getBean(InventoryInternals.class);

// visible, and rejected at build time: a real import of an internal type
InventoryManagement inventory;   // injected via constructor, from inventory's API package
```

**★ Symptom: Modulith reports one giant module, or no modules at all.**
Cause: module detection is anchored on the package containing the `@SpringBootApplication` class —
*"Each direct sub-package of the main package is considered an application module package."* If the
application class sits at `com.retailer.app.RetailApplication` while the domain lives in
`com.retailer.order`, the domain packages are not sub-packages of the main package and are not
modules.
Fix: move the application class up to the common root package (`com.retailer`), which is what the
convention assumes. This is worth checking first whenever the module list looks wrong — a
misdetected root makes every subsequent rule meaningless while still reporting success.

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

**★ What can `ApplicationModules.verify()` not see?**
Everything that is not a compile-time type reference, which is a larger set than people expect. It
analyses bytecode, so it sees imports, field types, method signatures and call targets. It does not
see two modules sharing a database table, a `@Query` that names another module's table as a string,
a bean fetched by `context.getBean(...)`, a reflective lookup, an HTTP call to your own application,
or a message topic that two modules agree about by convention. A green `verify()` proves the *code*
boundary holds. It proves nothing about the *data* boundary, and the data boundary is the one that
decides whether the module can actually be extracted — see
[09 · The transaction boundary](09-the-transaction-boundary.md).

**★ How would you introduce boundary verification to a monolith that fails it in hundreds of places?**
Not with `verify()`. Start with `detectViolations()` filtered to a single module you have cleaned,
so the build is green on day one and stays green, then add modules to the filter as each reaches
zero — the filter only ever grows. Use `@ApplicationModule(type = Type.OPEN)` for modules you have
consciously deferred, and treat each one as a countdown rather than a configuration, because the
reference itself says an open module in a modularised application *"hints at sub-optimal
modularization"*. The alternative — turning on the full rule and asking the team to fix four hundred
violations before the next feature — reliably ends with the test disabled.

**★ How does boundary verification handle domain event listeners?**
Spring Modulith specifically accommodates event-driven decoupling. When Module A publishes a domain event using Spring's `ApplicationEventPublisher`, Module A has zero dependencies on any consumers. Module B can listen to the event using `@ApplicationModuleListener` by depending only on the public event record published in Module A's API package. The verification engine recognizes this as a clean one-way dependency from Module B to Module A, successfully eliminating the bi-directional cycle that synchronous method invocation would have created.

---

← [Package structure is the boundary](24-package-structure-is-the-boundary.md) · [Topic index](README.md) · Next → [Named interfaces](25b-named-interfaces.md)
