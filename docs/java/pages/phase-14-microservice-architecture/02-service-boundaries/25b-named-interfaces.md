---
title: "A single public API per module is a naive assumption — Spring Modulith's @NamedInterface allows a bounded context to publish distinct contracts for different consumers without exposing its internal implementation"
sidebar_label: "25b · Named interfaces"
sidebar_position: 38
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Spring Modulith reference, *Fundamentals* — *Named Interfaces*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/fundamentals.html)) and
> *Verifying Application Module Structure*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/verification.html)).
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

### 🔴 Naming an interface *replaces* the base package, it does not add to it

This is the single most surprising thing about the feature and the reference states the consequence
plainly. Given `allowedDependencies = "order :: spi"`:

> *"This allows `inventory` to access `order.spi` but not `OrderManagement` from the base package."*

**Requesting a slice is requesting only that slice.** A module that has always used `order`'s main
API and then adds the SPI must ask for both — the `::` form does not widen an existing grant, it
narrows the grant to what it names:

```java
// WRONG: notification silently loses access to everything in the order base package
@org.springframework.modulith.ApplicationModule(allowedDependencies = "order :: spi")
package com.retailer.notification;

// RIGHT: two grants, listed explicitly, each one visible in review
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = {"order", "order :: spi"})
package com.retailer.notification;
```

⚠️ **The spacing is cosmetic and both forms appear in the wild** — `"order::spi"` and `"order :: spi"`
are the same declaration. The documentation's own examples use the spaced form.

There is a wildcard, and it is worth understanding before reaching for it:

```java
@org.springframework.modulith.ApplicationModule(allowedDependencies = "order :: *")
package com.retailer.inventory;
```

`"order :: *"` allows **all declared named interfaces** of `order`. That is convenient and it costs
you the thing the feature was for: the moment `order` publishes a fourth slice, every module holding
the wildcard silently gains access to it, and no review ever sees the widening. Use the wildcard
when a module genuinely is a general-purpose consumer; enumerate slices everywhere else, and accept
the extra line as the price of the grant being visible.

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

## Choosing what a slice is *for*

Named interfaces reward being drawn along **consumer intent**, not along technical shape. Two slices
called `dto` and `api` are a layering of the same audience and buy nothing; two called `admin` and
`spi` are two audiences with genuinely different rights, and the split is load-bearing.

A test that works: **could you write a different SLA, a different deprecation policy, or a different
authentication rule for this slice than for the base API?** If yes, it deserves a name. If the honest
answer is that everything in it changes on the same schedule for the same people, it belongs in the
base package.

| Slice | Consumer | Why it is separable |
|---|---|---|
| base package | the operational callers | the module's reason to exist |
| `:: spi` | infrastructure and adapters | changes with integration needs, not with the domain |
| `:: admin` | back-office and reconciliation | privileged, low-traffic, and must not creep into the operational path |
| `:: events` | anything that listens | a **published language** with its own compatibility promise — see [34 · Open host and published language](34-open-host-and-published-language.md) |

🔴 **The `:: events` row is the one that survives extraction unchanged.** Every other slice becomes an
endpoint with an access rule after the module is lifted out; the event slice is already the wire
contract, which is why [28b · Never publish the aggregate](28b-never-publish-the-aggregate.md)
insists on what may be in it.

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

**★ Symptom: a module that worked yesterday now fails verification against the order module's main API, and the only change was adding the SPI dependency.**
Cause: `allowedDependencies = "order :: spi"` replaced the previous grant rather than extending it.
The documented behaviour is explicit — naming a slice allows that slice *"but not `OrderManagement`
from the base package"*.
Fix: list every grant the module needs, including the unqualified module name for the base package.
```java
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = {"order", "order :: spi"})
package com.retailer.notification;
```

**★ Symptom: a named interface's method signature exposes a type from the module's internal package, and verification passes.**
Cause: the slice's own types are checked for *location*, not for what their signatures drag along.
A public SPI method returning an internal aggregate is a legal type in a legal package referring to
an illegal one — and the consumer that calls it is now importing the internal type, which is where
the failure finally surfaces, in someone else's module.
Fix: keep slice signatures closed over the slice. Every parameter and return type in a named
interface is either a JDK type or a type declared in that same slice.
```java
// leaks: Order lives in com.retailer.order.internal
public interface OrderEventPublisherSpi { Order publishOrderCompleted(UUID id); }

// closed: the payload record is declared in the spi package itself
public interface OrderEventPublisherSpi { void publishOrderCompleted(OrderCompletedPayload payload); }
```

**★ Symptom: `"order :: *"` is on six modules, and nobody can say what any of them is allowed to use.**
Cause: the wildcard grants all declared named interfaces, now and in future. A slice added next
quarter is granted retroactively to every wildcard holder, and the widening appears in no diff.
Fix: enumerate. The wildcard is defensible for a genuine general-purpose consumer such as a
composition or reporting module; everywhere else the extra line is what makes the grant reviewable.

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

**★ A module declares `allowedDependencies = "order :: spi"`. What can it see?**
The `order` module's `spi` named interface, and nothing else from `order` — specifically **not** the
base package, which the reference spells out: the grant allows access to `order.spi` *"but not
`OrderManagement` from the base package"*. This surprises people because it reads like an addition
and behaves like a replacement. A module needing both writes both, and `"order :: *"` widens the
grant to every declared slice at the cost of making future slices automatic.

**★ How do you decide whether something deserves its own named interface or belongs in the base package?**
Ask whether you could write a different deprecation policy, a different access rule or a different
compatibility promise for it. Two slices that always change together for the same consumers are one
slice with extra ceremony. An administrative API that must never be reachable from the operational
path, or an event contract whose compatibility promise is stricter than the rest of the module's, are
genuinely separate audiences and the name earns its keep. Slicing by technical shape — `dto`,
`api`, `impl` — reproduces package-by-layer inside the module and buys nothing.

**★ How do named interfaces relate to the Interface Segregation Principle (ISP)?**
Named interfaces are an architectural realization of ISP at the module and bounded context level. Rather than forcing all external modules to depend on a monolithic module interface containing operations for ordering, auditing, reconciliation, and event handling, the module segregates its published surface into purpose-built contracts. Clients depend only on the operations relevant to their domain role, minimizing design-time coupling and blast radius during refactoring.

---

← [Verifying the boundary](25-verifying-the-boundary.md) · [Topic index](README.md) · Next → [Can the module boot alone?](25c-can-the-module-boot-alone.md)
