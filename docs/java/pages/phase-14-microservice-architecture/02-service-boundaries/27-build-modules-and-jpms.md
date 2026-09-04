---
title: "Multi-module builds and JPMS module-info.java enforce boundaries at compile time — Maven and Gradle isolate classpaths between modules while the Java module system eliminates package-private leakage and rogue reflection"
sidebar_label: "27 · Build modules and JPMS"
sidebar_position: 44
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

### 🔴 Gradle can express "depend on, but do not re-publish". Maven cannot.

This is the difference that decides how much a multi-module build is actually worth, and it is a
tooling difference, not an architectural one. The Gradle `java-library` documentation states it
directly:

> *"Dependencies appearing in the `api` configurations will be transitively exposed to consumers of
> the library, and as such will appear on the compile classpath of consumers. Dependencies found in
> the `implementation` configuration will, on the other hand, not be exposed to consumers, and
> therefore not leak into the consumers' compile classpath."*

The four benefits the documentation claims, and each one is a boundary property:

| Stated benefit | Why a boundary cares |
|---|---|
| *"you will never accidentally depend on a transitive dependency"* | Coupling has to be **declared** to exist, so the dependency graph in the build file is the real one |
| *"faster compilation thanks to reduced classpath size"* | — |
| *"less recompilations when implementation dependencies change: consumers would not need to be recompiled"* | A module can change its internals without rebuilding its consumers, which is the in-process version of independent deployability |
| *"cleaner publishing"* | The published contract is exactly what you meant to publish |

The rule for which configuration to use is mechanical: **only types appearing in your module's public
method signatures, superclasses, interfaces, fields and annotations go in `api`. Everything else is
`implementation`.**

```groovy
dependencies {
    // Order's API returns a CatalogProductRef, so catalog is part of Order's contract
    api project(':catalog-module')

    // Jackson is how Order talks to its own database. Nobody else needs to know.
    implementation 'com.fasterxml.jackson.core:jackson-databind'
}
```

⚠️ **Maven has no `implementation` scope.** Maven's `compile` scope is transitive onto consumers'
compile classpath, and the nearest approximations — `<optional>true</optional>` on the dependency, or
`<exclusions>` written by every consumer — put the burden in the wrong place: the first asks
consumers to re-declare what they need, the second asks each consumer to know what to exclude.
Neither gives you Gradle's guarantee. If encapsulation of transitive dependencies is a goal of your
modular monolith, that is a real argument for Gradle, and it is worth making explicitly rather than
discovering it after the modules are laid out.

## JPMS: strong encapsulation with `module-info.java`

Introduced in Java 9 (JSR 376) and refined through JDK 25, the Java Platform Module System brings true architectural encapsulation to the JVM.

The specification's own statements are short, and the third is the one the whole mechanism exists for:

> *"One or more `requires` clauses can be added to declare that the module depends, by name, upon
> some other modules, at both compile time and run time."*

> *"Finally, `exports` clauses can be added to declare that the module makes all, and only, the
> public types in specific packages available for use by other modules."*

> 🔴 *"Thus, even when a type is declared `public`, if its package is not exported in the declaration
> of its module then it will only be accessible to code in that module."*

⚠️ **A naming trap that outlives the documents that caused it.** *The State of the Module System*
notes it is *"slightly out of date"* on exactly one point: the directive was originally
`requires public` and was **renamed to `requires transitive`** before release. Any sample using
`requires public` predates Java 9's release and will not compile. `requires transitive` grants
*implied readability* — a module reading yours also reads what you have marked transitive — and it is
JPMS's equivalent of Gradle's `api`, with the same rule for when to use it: mark a dependency
transitive when it appears in your exported types' signatures, and not otherwise.

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

## 🔴 Where JPMS enforcement actually applies, and where it quietly does not

The strong-encapsulation guarantee is a statement about **modules**, and a type is only in a module
if it was loaded from the **module path**. Load the same JAR from the **classpath** and its types
land in the unnamed module, where `exports` means nothing and `module-info.class` is inert metadata.

That distinction matters more than it sounds, because of how the applications in this corpus are
launched. A Spring Boot executable JAR is started with `java -jar app.jar`, and its launcher loads
the application and its nested dependency JARs from the classpath — so at runtime the modules are
unnamed and the JVM enforces none of the boundaries you declared.

**What survives, and what does not:**

| Guarantee | Compiling on the module path | Running a Boot fat JAR from the classpath |
|---|---|---|
| `exports` blocks an illegal import | ✅ **at compile time — this is the one you were buying** | n/a, already compiled |
| `requires` cycle rejection | ✅ | n/a |
| Split-package rejection | ✅ | ❌ |
| `opens` gating `setAccessible(true)` | ✅ | ❌ nothing is gated |

🔴 **Read the table this way: the compile-time guarantee is the valuable one and you keep it.** An
illegal import is rejected by `javac` whatever the launch mode, so `module-info.java` still buys you
the boundary this topic cares about. What you do **not** get in a classpath-launched application is
the *runtime* half — reflective encapsulation. If your reason for adopting JPMS was "so nobody can
reflect into my internals in production", check how the application is launched before you count on
it. If your reason was "so nobody can import my internals", you are fine.

## Multi-module vs Microservices: the architectural sweet spot

A multi-module architecture with either Gradle `implementation` scoping or JPMS provides most of the operational benefits of microservices without the distributed systems penalty:

- **Compilation firewalls:** Accidental cross-domain coupling is rejected at compile time.
- **Independent team ownership:** Teams own their respective module directories and `pom.xml`/`build.gradle` definitions.
- **No network in the call path:** calls between modules are ordinary in-memory Java method invocations. There is no serialization, no socket, no timeout budget and no partial failure — the three things that make the same call across a service boundary a design problem rather than a method call.
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

**★ Symptom: `module-info.java` is in place, and a colleague still reflects into an internal package in production without an error.**
Cause: the application is launched from the classpath rather than the module path — a Spring Boot
executable JAR does exactly this — so every type is in the unnamed module and `opens` gates nothing.
Fix: there is no fix that preserves the fat-JAR launch; there is a correct expectation. Treat JPMS
here as a **compile-time** boundary, which it fully remains, and enforce the runtime half a different
way if you need it. Say so on the architecture page rather than letting the team believe in a
guarantee the launch mode has already removed.

**★ Symptom: adding `module-info.java` breaks the build because a dependency has no module name.**
Cause: a plain JAR with no `module-info.class` becomes an *automatic module* whose name is derived
from the filename unless the JAR sets `Automatic-Module-Name` in its manifest. A filename-derived
name is unstable — it changes when the artifact is renamed — and `requires` clauses that name it
break.
Fix: prefer dependencies that declare `Automatic-Module-Name`, and pin the ones that do not, because
a `requires` on a filename-derived name is a dependency on a filename. Where a library cannot be
named stably at all, that dependency is an argument for keeping the module boundary at the build
level rather than at JPMS.

**★ Symptom: the team adopts JPMS for the boundary, and spends the sprint on `opens` clauses instead.**
Cause: everything reflective in the stack — the DI container, the ORM, the JSON mapper, the test
framework — needs deep access to types it does not own, and each one needs naming.
Fix: this is the real cost of JPMS and it is worth pricing before starting. If the boundary you want
is "no illegal imports", a multi-module build plus [26 · ArchUnit rules](26-archunit-rules.md) gets
you there for a fraction of the work. Reach for JPMS when you are shipping a library whose internals
must stay internal to consumers you do not control — that is the case it repays.

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

**★ Gradle's `api` and `implementation`, and JPMS's `requires transitive` — what is the shared idea?**
All three answer *"is this dependency part of my contract, or part of how I am built?"* If a type
from the dependency appears in your public signatures, a consumer cannot compile against you without
it, so it is part of your contract: `api` in Gradle, `requires transitive` in JPMS. If the dependency
is purely internal, hiding it means consumers *"never accidentally depend on a transitive
dependency"* and *"would not need to be recompiled"* when it changes — which is exactly the property
that lets a module evolve without dragging its consumers along. Maven has no equivalent of the hiding
half, which is the single strongest technical argument for Gradle in a modular monolith.

**★ You add `module-info.java` and ship a Spring Boot fat JAR. Which of JPMS's guarantees do you actually still have?**
The compile-time ones, in full: an illegal import is rejected by `javac`, cycles are rejected, split
packages are rejected. The runtime ones, none — a Boot executable JAR launches from the classpath, so
the types land in the unnamed module, `exports` is not consulted and `opens` gates nothing. That is
usually an acceptable trade because the boundary this topic wants is the compile-time one, but it
matters enormously if the reason you adopted JPMS was reflective encapsulation. The honest version to
tell a team is: JPMS is buying you a compiler that says no, not a JVM that says no.

**★ What does adopting JPMS cost, in the specific case of a Spring application?**
Mostly `opens` clauses and dependency naming. Every reflective participant — the container, the ORM,
the serialiser, the test framework — needs deep access to packages it does not own, and each one has
to be named in the module declaration. Every dependency without a `module-info.class` becomes an
automatic module, named from its manifest's `Automatic-Module-Name` if it has one and from its
filename if it does not — and a `requires` on a filename-derived name breaks when the artifact is
renamed. None of that is unmanageable, but it is a sustained tax, and it buys a compile-time
guarantee that a multi-module build plus ArchUnit approximates for far less. The case where JPMS
clearly wins is a published library, not an application.

**★ Why does JPMS prohibit "split packages"?**
A split package occurs when two different modules declare types within the exact same package name (e.g. `com.retailer.common`). JPMS strictly disallows split packages to eliminate classpath shadowing, ambiguity in class resolution, and security vulnerabilities where a malicious JAR injects classes into a trusted package. This forces clean architectural separation: every package belongs exclusively to a single owning module.

---

← [ArchUnit rules](26-archunit-rules.md) · [Topic index](README.md) · Next → [Published language vs aggregate](28-published-language-vs-aggregate.md)
