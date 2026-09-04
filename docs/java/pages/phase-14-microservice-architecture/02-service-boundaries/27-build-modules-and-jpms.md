---
title: "Multi-module builds and JPMS module-info.java enforce boundaries at compile time — Maven and Gradle isolate classpaths between modules while the Java module system eliminates package-private leakage and rogue reflection"
sidebar_label: "27 · Build modules and JPMS"
sidebar_position: 38
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Java SE 25 Platform Module System specification (JSR 376);
> Apache Maven Dependency Mechanism reference; Gradle Multi-project builds documentation.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**Physical build modularity and runtime module systems provide hard compiler boundaries that prevent accidental architectural drift before a single test runs. A multi-module Maven or Gradle build creates distinct compilation units: module `order` cannot see classes in module `billing` unless a dependency is explicitly declared in `pom.xml` or `build.gradle`. The Java Platform Module System (JPMS, JSR 376) takes this further: `module-info.java` enforces strong encapsulation at the JVM level, allowing public classes to remain hidden unless their enclosing package is explicitly exported, and preventing reflective introspection into domain internals. Understanding the precise boundaries enforced by Maven and Gradle versus JPMS determines how cleanly a modular monolith can be developed, maintained, and eventually split into microservices.**

## The three levels of in-process encapsulation

When enforcing boundaries within a single monolithic codebase, Java provides three distinct levels of isolation:

| Level | Enforced by | Boundary mechanism | What it prevents |
|---|---|---|---|
| **Package-private** | Java Compiler (`javac`) | Default access modifier (no modifier) | Access to types outside the exact same package |
| **Build modules** | Maven / Gradle | Separate compilation tasks & distinct classpaths | Undeclared dependencies; cyclic module dependencies |
| **JPMS** | JVM & `javac` | `module-info.java` (`exports`, `opens`, `requires`) | Leaking public types across modules; unauthorized reflection |

## Multi-module builds: classpath isolation

In a single-module project, every source file compiles onto a single, flat classpath. Any class marked `public` anywhere in the project can be imported by any other class.

In a multi-module build, each bounded context is partitioned into an independent submodule:

```text
retail-parent/
├── pom.xml
├── order-module/
│   ├── pom.xml
│   └── src/main/java/com/retailer/order/
├── billing-module/
│   ├── pom.xml
│   └── src/main/java/com/retailer/billing/
└── inventory-module/
    ├── pom.xml
    └── src/main/java/com/retailer/inventory/
```

### What Maven and Gradle enforce

1. **Explicit dependency declaration:** For `billing-module` to reference a class in `order-module`, `billing-module/pom.xml` must explicitly declare:
   ```xml
   <dependency>
       <groupId>com.retailer</groupId>
       <artifactId>order-module</artifactId>
       <version>${project.version}</version>
   </dependency>
   ```
   If this `<dependency>` is omitted, `javac` fails with `cannot find symbol` or `package com.retailer.order does not exist`.
2. **Strict cycle rejection:** Maven reactor and Gradle execution graphs strictly forbid circular module dependencies. If `order-module` depends on `billing-module` and `billing-module` depends on `order-module`, the build fails before compilation begins:
   `[ERROR] The projects in the reactor contain a cycle`.
3. **Compilation isolation:** Submodules can be built, tested, and packaged in parallel.

### The limit of build modules alone

Build modules alone cannot solve the "public for the wrong caller" dilemma. If `order-module` exports an API, but also contains internal helper classes across multiple packages that must be marked `public` to collaborate with each other inside `order-module`, those public helper classes are also visible to `billing-module`.

## JPMS: strong encapsulation with `module-info.java`

Introduced in Java 9 (JSR 376) and refined through JDK 25, the Java Platform Module System brings true architectural encapsulation to the JVM.

A module declares its boundaries in `module-info.java` at the root of the source tree:

```java
module com.retailer.order {
    // 1. Declare which modules this module depends on
    requires com.retailer.catalog;
    requires spring.boot;
    requires spring.context;
    requires spring.data.commons;

    // 2. Export ONLY the public API packages to other modules
    exports com.retailer.order.api;

    // 3. Open internal packages to Spring for reflection/dependency injection
    opens com.retailer.order.internal to spring.core, spring.beans, org.hibernate.orm.core;
}
```

### The superpowers of `module-info.java`

1. **Selective package export (`exports`):** Even if a class in `com.retailer.order.internal` is declared `public`, a consuming module (`com.retailer.billing`) cannot import or compile against it. To the outside world, non-exported packages simply do not exist.
2. **Qualified exports (`exports ... to`):** A module can export an SPI package exclusively to designated partner modules:
   ```java
   exports com.retailer.order.spi to com.retailer.notification;
   ```
3. **Reflection protection (`opens`):** In modern Java, `setAccessible(true)` cannot bypass module encapsulation. External modules cannot reflectively access private fields or package-private classes unless the module explicitly opens the package.

## Multi-module vs Microservices: the architectural sweet spot

A multi-module architecture with either Gradle `implementation` scoping or JPMS provides most of the operational benefits of microservices without the distributed systems penalty:

- **Compilation firewalls:** Accidental cross-domain coupling is rejected at compile time.
- **Independent team ownership:** Teams own their respective module directories and `pom.xml`/`build.gradle` definitions.
- **Zero latency:** Calls between modules are standard in-memory Java method invocations with microsecond execution times.
- **Atomicity when needed:** Transactions can still span multiple local modules if business invariants demand it, without distributed 2PC or sagas.

When the time comes to extract a module into an independent microservice, the module is already a cleanly packaged JAR with explicit dependencies, making physical network extraction a straightforward packaging exercise.

## Gotchas

**★ Symptom: Maven build fails with `The projects in the reactor contain a cycle`.**
Cause: Submodule A depends on Submodule B, and Submodule B depends on Submodule A.
Fix: Break the cycle by publishing an asynchronous domain event, or extract common contracts to an independent `-api` module that both depend on.

**★ Symptom: Gradle consumer module accidentally inherits transitive dependencies from an upstream module.**
Cause: Upstream module declared dependencies using `api` configuration instead of `implementation`.
Fix: In `build.gradle`, use `implementation` for internal module libraries so they do not leak onto the consumer's compile classpath:
```groovy
dependencies {
    implementation project(':inventory-module')
}
```

**★ Symptom: JPMS fails at compile time with `Package com.retailer.util in both module A and module B`.**
Cause: Split packages. JPMS strictly forbids two modules on the module path from declaring the exact same package name.
Fix: Namespace common packages by domain: `com.retailer.order.util` and `com.retailer.billing.util`.

**★ Symptom: Spring Boot fails at startup with `IllegalAccessException` when attempting to inject or instantiate a bean in a JPMS module.**
Cause: The package containing the bean is neither exported nor opened to Spring in `module-info.java`.
Fix: Open the package reflectively to Spring:
```java
opens com.retailer.order.internal to spring.core, spring.beans;
```

## Interview questions

**★ What architectural guarantees does a multi-module Maven or Gradle build provide over a single-module project?**
A multi-module build enforces classpath boundaries at the compiler level. Code in one submodule cannot import classes from another submodule unless an explicit `<dependency>` is configured. Furthermore, build tools enforce a strict Directed Acyclic Graph (DAG) across modules, immediately halting compilation if a cyclic dependency is introduced. This prevents developers from casually introducing bi-directional coupling between domain boundaries.

**★ How does JPMS `module-info.java` resolve the "public but internal" problem?**
Before JPMS, Java's access modifiers were incomplete: a class needed by another package in the same module had to be declared `public`, which simultaneously made it accessible to every other package in the entire application classpath. JPMS separates package visibility from type visibility. A class can be `public` within its module, but if its enclosing package is not listed in an `exports` clause in `module-info.java`, external modules cannot import or access that class, achieving true encapsulation.

**★ What is the difference between `exports` and `opens` in JPMS?**
`exports` exposes a package's public types at compile time and runtime to other modules for direct invocation. `opens` allows deep reflective access (including inspection of non-public fields and methods via `setAccessible(true)`) at runtime, but does not allow compile-time access. In Spring Boot applications, domain internals are typically `opens` to `spring.core` and `spring.beans` to enable dependency injection while remaining completely unexported to other application modules.

**★ Why does JPMS prohibit "split packages"?**
A split package occurs when two different modules declare types within the exact same package name (e.g. `com.retailer.common`). JPMS strictly disallows split packages to eliminate classpath shadowing, ambiguity in class resolution, and security vulnerabilities where a malicious JAR injects classes into a trusted package. This forces clean architectural separation: every package belongs exclusively to a single owning module.

---

← [ArchUnit rules](26-archunit-rules.md) · [Topic index](README.md) · Next → [Published language vs aggregate](28-published-language-vs-aggregate.md)
