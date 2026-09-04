---
title: "A service boundary is a package tree before it is a network hop — if the Java compiler cannot prevent one module from touching another's internals, a REST call will not create encapsulation, it will only distribute the coupling"
sidebar_label: "24 · Package structure is the boundary"
sidebar_position: 34
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against microservices.io *Decompose by business capability*
> ([microservices.io](https://microservices.io/patterns/decomposition/decompose-by-business-capability.html));
> Martin Fowler *Package by Feature* ([martinfowler.com](https://martinfowler.com/bliki/PackageByFeature.html));
> Spring Framework 7.0.9 documentation on component scanning and constructor injection.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. Documentation-validated; **no sandbox run**.

**A package in Java is not a folder for grouping similar technical artifacts; it is the primary encapsulation mechanism provided by the language. When a codebase is structured by layer—controllers, services, repositories—every single domain entity and repository interface must be declared `public`, destroying encapsulation and inviting any class in the system to bypass business invariants. Structuring packages by business feature or bounded context enables package-private visibility to hide internal entities, domain services, and database persistence behind a narrow, explicitly published API. If you cannot prevent illegal cross-boundary coupling using Java's package access modifier in-process, deploying services across a network will not solve the problem—it will merely turn compile-time errors into runtime distributed failures.**

## The fatal flaw of package-by-layer

Most monolithic applications begin with a package structure organized by technical tier:

```text
com.retailer.app
├── controller
│   ├── OrderController.java
│   └── PaymentController.java
├── service
│   ├── OrderService.java
│   └── PaymentService.java
├── repository
│   ├── OrderRepository.java
│   └── PaymentRepository.java
└── model
    ├── Order.java
    └── Payment.java
```

This structure appears tidy in an IDE tree view, but it actively destroys architectural boundaries. In Java, default package-private visibility restricts access strictly to classes residing in the exact same package. Because `OrderService` lives in `com.retailer.app.service` while `OrderRepository` lives in `com.retailer.app.repository` and `Order` lives in `com.retailer.app.model`, both `OrderRepository` and `Order` must be declared `public`.

Once `OrderRepository` and `Order` are `public`, they are accessible to every class in the entire application. Nothing prevents `PaymentService` or a reporting controller from injecting `OrderRepository` directly, querying raw database records, modifying order status without running domain validations, or persisting invalid entity states. The architectural boundary between the Order domain and the Payment domain ceases to exist. The compiler cannot help you because your own packaging forced every internal implementation detail into the public API.

## Package-by-feature: compiler-enforced boundaries

Package-by-feature (or package-by-component) groups all classes that implement a single bounded context or business capability into a single cohesive package:

```text
com.retailer.order
├── OrderPlacementApi.java       // public interface: entry point
├── PlaceOrderCommand.java       // public record: input DTO
├── OrderSummary.java            // public record: output DTO
├── OrderPlacedEvent.java        // public record: published event
├── OrderPlacementService.java   // package-private implementation
├── Order.java                   // package-private aggregate root
├── OrderItem.java               // package-private entity
├── OrderPricingService.java     // package-private domain logic
└── OrderRepository.java         // package-private Spring Data repository
```

In this structure, only the contracts intended for consumption by outside modules are marked `public`: the API interface, the command and summary records, and domain events. Everything else—the aggregate root, internal entities, domain pricing calculations, and repository interfaces—is declared package-private by omitting the access modifier.

If code inside `com.retailer.payment` attempts to import `com.retailer.order.Order` or `com.retailer.order.OrderRepository`, the Java compiler rejects the code with a compilation error. Encapsulation is enforced by the compiler on every developer keystroke, with zero runtime overhead and zero network latency.

```java
package com.retailer.order;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.repository.Repository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Public API surface exposed to other packages
public interface OrderPlacementApi {
    OrderSummary placeOrder(PlaceOrderCommand command);
}

public record PlaceOrderCommand(UUID customerId, List<OrderItemRequest> items) {}
public record OrderItemRequest(UUID productId, int quantity, BigDecimal unitPrice) {}
public record OrderSummary(UUID orderId, UUID customerId, BigDecimal totalAmount, Instant createdAt) {}
public record OrderPlacedEvent(UUID orderId, UUID customerId, BigDecimal totalAmount) {}

// Package-private implementation details hidden from other packages
@Service
class OrderPlacementService implements OrderPlacementApi {

    private final OrderRepository orderRepository;
    private final ApplicationEventPublisher eventPublisher;

    OrderPlacementService(OrderRepository orderRepository, ApplicationEventPublisher eventPublisher) {
        this.orderRepository = orderRepository;
        this.eventPublisher = eventPublisher;
    }

    @Override
    @Transactional
    public OrderSummary placeOrder(PlaceOrderCommand command) {
        Order order = new Order(UUID.randomUUID(), command.customerId());
        for (OrderItemRequest item : command.items()) {
            order.addItem(item.productId(), item.quantity(), item.unitPrice());
        }

        Order saved = orderRepository.save(order);
        eventPublisher.publishEvent(new OrderPlacedEvent(saved.getId(), saved.getCustomerId(), saved.getTotalAmount()));

        return new OrderSummary(saved.getId(), saved.getCustomerId(), saved.getTotalAmount(), saved.getCreatedAt());
    }
}

class Order {
    private final UUID id;
    private final UUID customerId;
    private final Instant createdAt;
    private BigDecimal totalAmount;

    Order(UUID id, UUID customerId) {
        this.id = id;
        this.customerId = customerId;
        this.createdAt = Instant.now();
        this.totalAmount = BigDecimal.ZERO;
    }

    void addItem(UUID productId, int quantity, BigDecimal unitPrice) {
        if (quantity <= 0) {
            throw new IllegalArgumentException("Quantity must be positive");
        }
        this.totalAmount = this.totalAmount.add(unitPrice.multiply(BigDecimal.valueOf(quantity)));
    }

    UUID getId() { return id; }
    UUID getCustomerId() { return customerId; }
    Instant getCreatedAt() { return createdAt; }
    BigDecimal getTotalAmount() { return totalAmount; }
}

interface OrderRepository extends Repository<Order, UUID> {
    Order save(Order order);
}
```

## The Java subpackage trap

A frequent mistake when transitioning to package-by-feature is introducing subpackages inside the feature:

```text
com.retailer.order
├── api
│   └── OrderPlacementApi.java
├── internal
│   ├── OrderPlacementService.java
│   ├── Order.java
│   └── OrderRepository.java
```

According to Java Language Specification §6.6.1, package-private access does not cross package boundaries. In Java, subpackages are strictly namespace conventions; `com.retailer.order.internal` is a completely separate package from `com.retailer.order`.

If `OrderPlacementService` in `.internal` implements `OrderPlacementApi` in `.api`, both the implementation and its internal dependencies must be declared `public` for the service to be instantiated and wired across packages. The moment you introduce technical subpackages, package-private encapsulation collapses and you recreate the problems of package-by-layer. Keep the package flat, or enforce boundaries using [25 · Verifying the boundary](25-verifying-the-boundary.md) or [26 · ArchUnit rules](26-archunit-rules.md).

## The extraction test

A package structured by feature provides an unambiguous test for microservice readiness:

1. **Inward dependencies:** Search for all references to `com.retailer.order` from outside packages. They should only touch `OrderPlacementApi`, input command records, and published event records.
2. **Outward dependencies:** Inspect the `import` statements within `com.retailer.order`. They should only reference external APIs or shared generic utility libraries.
3. **Database access:** All SQL queries and tables associated with the feature are manipulated exclusively through package-private repositories in this single package.

If a package passes this test in a monolith, extracting it into an independent microservice requires only wrapping the public Java interface in a REST controller or messaging listener, moving the package to its own Git repository, and provisioning its database schema. If a package fails this test in-process, extracting it across a network will produce a distributed monolith.

## Gotchas

**★ Symptom: Developer declares all Spring beans `public` under the belief that Spring requires public classes for component scanning.**
Cause: Historical habits from Spring Framework 2 and 3, where CGLIB proxies and reflection struggled with package-private classes.
Fix: Spring Framework 7 and Spring Boot 4 fully support package-private `@Component`, `@Service`, `@Repository`, and `@Configuration` classes. Omit the `public` modifier from bean classes and their constructors:
```java
@Service
class PaymentReconciliationService {
    private final LedgerRepository ledgerRepository;

    PaymentReconciliationService(LedgerRepository ledgerRepository) {
        this.ledgerRepository = ledgerRepository;
    }
}
```

**★ Symptom: Creating subpackages like `com.retailer.order.repository` forces repository interfaces to be declared `public`.**
Cause: Java subpackages do not inherit or share package-private visibility with parent packages.
Fix: Keep repository interfaces and entity definitions in the root feature package `com.retailer.order` alongside domain services, or enforce subpackage visibility rules using ArchUnit or Spring Modulith named interfaces.

**★ Symptom: Domain entities are declared `public` and returned directly from controller or service methods to save authoring DTO classes.**
Cause: Conflating the internal domain model with the public published language.
Fix: Keep domain entities package-private. Expose only immutable Java records as command parameters and result representations in the public API.

**★ Symptom: Cross-domain queries bypass service contracts to join tables across boundaries.**
Cause: Exposing JPA entities publicly allows other services to write `@ManyToOne` relationships referencing foreign aggregates.
Fix: Package-private entities cannot be referenced in another package's entity mapping, preventing JPA cross-boundary object graphs at compile time.

## Interview questions

**★ Why is package-by-layer considered an anti-pattern when preparing an architecture for microservices?**
Package-by-layer groups code by technical mechanisms (controllers, services, repositories) rather than business capabilities. Because Java's default access modifier limits visibility to the same package, placing repositories, entities, and services in separate packages forces every class to be marked `public`. This destroys encapsulation, allowing any part of the application to directly access, query, and mutate another domain's data model without traversing business invariants. When teams attempt to decompose a package-by-layer monolith into microservices, they discover that domain logic is tangled across the entire codebase, making extraction without distributed circular dependencies virtually impossible.

**★ How does Java's treatment of subpackages affect modular design?**
Unlike languages where namespaces or modules provide hierarchical encapsulation, the Java Language Specification treats package names as entirely flat. The package `com.app.order.internal` has no special visibility privileges into `com.app.order`; they are treated as two unrelated packages. Consequently, creating subpackages within a module forces any class that needs to be accessed across those subpackages to be declared `public`, exposing it to the rest of the application as well. Architectural boundaries that span subpackages must therefore be guarded by external tooling such as ArchUnit, Spring Modulith, or the Java Platform Module System (JPMS).

**★ What is the relationship between package-private visibility and microservice boundaries?**
Package-private visibility is the in-process precursor to a microservice network boundary. A well-designed microservice exposes only a small set of public HTTP endpoints or message schemas while keeping its persistence layer, internal state machines, and helper classes hidden inside the deployment unit. Package-by-feature achieves the exact same encapsulation within a monolithic JVM process: public interfaces and DTOs define the published API, while package-private classes prevent other modules from touching internal domain mechanics. A module that cannot maintain this separation in-process will inevitably fail to maintain it across microservices.

**★ Can Spring Data repositories be declared package-private?**
Yes. Spring Data and Spring Framework runtime reflection easily inspects and creates dynamic proxies for package-private repository interfaces. Declaring `interface OrderRepository extends Repository<Order, UUID>` without a `public` modifier ensures that only services located in that exact feature package can inject and execute database operations for that aggregate, guaranteeing single-service data ownership.

---

← [The monolith already told you](23-the-monolith-already-told-you.md) · [Topic index](README.md) · Next → [Verifying the boundary](25-verifying-the-boundary.md)
