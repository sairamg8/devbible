---
title: "A single public API per module is a naive assumption — Spring Modulith's @NamedInterface allows a bounded context to publish distinct contracts for different consumers without exposing its internal implementation"
sidebar_label: "25b · Named interfaces"
sidebar_position: 36
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Spring Modulith 2.1.1 reference documentation, *Named Interfaces*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/fundamentals.html#named-interfaces)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. Documentation-validated; **no sandbox run**.

**Assuming every consumer of a domain module requires the exact same API contract is a design flaw that leads to bloated interfaces and leaky abstractions. In complex bounded contexts, a module often needs to expose one contract for customer-facing order operations, an administrative API for financial reconciliation, and a service-provider interface (SPI) for asynchronous integration. Spring Modulith's `@NamedInterface` allows packages or specific types within a module to declare explicit, named API slices while keeping internal domain logic strictly encapsulated. Consuming modules can then declare targeted dependencies on specific named interfaces (`order::admin`, `order::spi`), preventing downstream services from accumulating accidental coupling to capabilities they have no business invoking.**

## Beyond the default module API

By default, Spring Modulith assumes a simple two-tier visibility model:
1. The **root package** of a module (e.g. `com.retailer.order`) is the public API.
2. All **subpackages** (e.g. `com.retailer.order.internal`, `com.retailer.order.spi`) are internal and private.

This default works well for small modules. However, as a bounded context expands, two failure modes emerge:
- **Root package pollution:** Teams dump dozens of classes into the root package—client DTOs, reporting queries, payment listeners, and maintenance commands—creating an unwieldy god-package.
- **Accidental coupling:** A back-office billing module only needs to query completed order totals, but because `OrderService` exposes order placement, cancellation, and payment processing, the billing team begins invoking operational methods directly, creating hidden coupling.

Spring Modulith solves this with `@NamedInterface`. A named interface groups related types into an explicitly designated API slice that external modules can reference by name.

## Declaring named interfaces

A named interface can be declared in two ways:

### 1. On a package via `package-info.java`

Annotating a subpackage designates all public types inside that package as part of the named interface:

```java
@org.springframework.modulith.NamedInterface("spi")
package com.retailer.order.spi;
```

### 2. On individual classes or interfaces

If you wish to group specific types across packages into a single logical contract:

```java
package com.retailer.order;

import org.springframework.modulith.NamedInterface;

@NamedInterface("admin")
public interface OrderAdministrationApi {
    void archiveOrdersOlderThan(java.time.Instant threshold);
}
```

Types in the default root package form an unnamed interface that is accessible by default to any module declaring a dependency on the module name. Named interfaces, by contrast, are private by default and must be explicitly requested.

## Consuming a named interface

A consuming module declares which named interface it intends to use via the `allowedDependencies` attribute on `@ApplicationModule`:

```java
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = {"order::spi"}
)
package com.retailer.notification;
```

When `ApplicationModules.verify()` runs:
- `notification` is permitted to access public types in `com.retailer.order.spi`.
- If `notification` attempts to access `OrderPlacementApi` from the root `order` package, verification fails unless it also requests the default API via `"order"`.
- If another module (such as `billing`) declares `allowedDependencies = {"order"}`, it gets access *only* to the root package; any attempt by `billing` to import `com.retailer.order.spi` is rejected as an illegal access to module internals.

```java
package com.retailer.order.spi;

import java.math.BigDecimal;
import java.util.UUID;

// Public interface inside the named "spi" slice
// src/main/java/com/retailer/order/spi/OrderEventPublisherSpi.java
public interface OrderEventPublisherSpi {
    void publishOrderCompleted(OrderCompletedPayload payload);
}

// src/main/java/com/retailer/order/spi/OrderCompletedPayload.java
public record OrderCompletedPayload(UUID orderId, UUID customerId, BigDecimal totalAmount) {}
```

The consuming module implementation:

```java
package com.retailer.notification;

import com.retailer.order.spi.OrderCompletedPayload;
import com.retailer.order.spi.OrderEventPublisherSpi;
import org.springframework.stereotype.Component;

@Component
class NotificationOrderEventListener implements OrderEventPublisherSpi {

    @Override
    public void publishOrderCompleted(OrderCompletedPayload payload) {
        // Formats and sends push notification or customer email
    }
}
```

## Java visibility vs Modulith verification

A common point of confusion is the interplay between the Java compiler and Spring Modulith:

- In Java, any class in a subpackage (such as `com.retailer.order.spi.OrderEventPublisherSpi`) must be declared `public` for a class in `com.retailer.notification` to import it.
- However, making a class `public` in standard Java makes it visible to *every* package in the JVM, including unauthorized callers like `com.retailer.inventory`.
- Spring Modulith bridges this gap: the class is `public` to satisfy the Java compiler, but `ApplicationModules.verify()` acts as an architectural compiler in CI, failing the build if any module other than designated consumers attempts to import it.

## The microservice correspondence

In a microservice architecture, publishing multiple contracts corresponds to exposing distinct ingress routes or API Gateway endpoints:
- A public mobile API via a Backend-For-Frontend (BFF).
- A private internal gRPC service for inter-service orchestration.
- An asynchronous event broker topic for streaming events.

Using `@NamedInterface` allows a monolith to mirror this exact separation in-process. When the time comes to extract the bounded context into a microservice, each named interface maps directly to an independent HTTP controller, gRPC service, or message channel without untangling internal classes.

## Gotchas

**★ Symptom: `MODULES.verify()` fails with "Access to internal package forbidden" even though the target subpackage has `@NamedInterface("spi")`.**
Cause: The consuming module declared `allowedDependencies = {"order"}` instead of referencing the named interface `allowedDependencies = {"order::spi"}`. Named interfaces are not included in the bare module name dependency.
Fix: Explicitly declare the named interface in the consumer's `package-info.java`:
```java
@ApplicationModule(allowedDependencies = {"order::spi"})
package com.retailer.notification;
```

**★ Symptom: Consuming module cannot compile because classes in `@NamedInterface("spi")` are package-private.**
Cause: Modulith verification governs architectural boundaries, but standard Java Language Specification access rules still apply. Types intended for cross-module consumption must be declared `public`.
Fix: Declare the specific interface and DTO types as `public`, while keeping internal implementation classes package-private.

**★ Symptom: Proliferation of fine-grained named interfaces creating maintenance overhead.**
Cause: Slicing named interfaces by technical type (e.g. `order::dtos`, `order::services`) rather than by business consumer capability.
Fix: Design named interfaces around cohesive client perspectives: `order::spi`, `order::admin`, or `order::reporting`.

**★ Symptom: Module author creates a named interface but forgets to add `@NamedInterface` annotation, causing build failure in consumer.**
Cause: Subpackages without `@NamedInterface` are treated as private internal packages by Spring Modulith.
Fix: Add `package-info.java` in the subpackage with `@NamedInterface("name")`.

## Interview questions

**★ What problem does Spring Modulith's `@NamedInterface` solve that standard Java package-private visibility cannot?**
Java package-private visibility is binary: either a class is in the same package and accessible, or it is in another package and must be `public` to be seen. As a domain grows, keeping all classes in a single flat package creates massive, unmaintainable directories. However, creating subpackages forces classes to become `public`, exposing them to the entire codebase. `@NamedInterface` allows developers to organize code into clean subpackages, expose public types specifically for cross-module consumption, and let Spring Modulith verify that only authorized consuming modules can import those types, preventing general architectural leakage.

**★ How does a consuming module bind to a specific named interface?**
In its `package-info.java`, the consuming module uses the `@ApplicationModule` annotation with `allowedDependencies = {"<module>::<interface>"}`. For example, `allowedDependencies = {"order::spi"}` grants access strictly to types belonging to the `"spi"` named interface of the `order` module. If the consuming module attempts to access the root `order` API or another named interface like `order::admin`, verification fails.

**★ Can a single application module expose multiple named interfaces?**
Yes. A single bounded context can define multiple named interfaces alongside its default unnamed root interface. For example, an `inventory` module can provide its default ordering API at the root, an `inventory::admin` interface for warehouse auditing, and an `inventory::events` interface for external event payload schemas. Each consumer requests only the exact slice of the module it requires.

**★ How do named interfaces relate to the Interface Segregation Principle (ISP)?**
Named interfaces are an architectural realization of ISP at the module and bounded context level. Rather than forcing all external modules to depend on a monolithic module interface containing operations for ordering, auditing, reconciliation, and event handling, the module segregates its published surface into purpose-built contracts. Clients depend only on the operations relevant to their domain role, minimizing design-time coupling and blast radius during refactoring.

---

← [Verifying the boundary](25-verifying-the-boundary.md) · [Topic index](README.md) · Next → [ArchUnit rules](26-archunit-rules.md)
