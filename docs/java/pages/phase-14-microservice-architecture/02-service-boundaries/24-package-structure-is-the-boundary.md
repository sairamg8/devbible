---
title: "A service boundary is a package tree before it is a network hop — if the Java compiler cannot prevent one module from touching another's internals, a REST call will not create encapsulation, it will only distribute the coupling"
sidebar_label: "24 · Package structure is the boundary"
sidebar_position: 43
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against microservices.io *Decompose by business capability*
> ([microservices.io](https://microservices.io/patterns/decomposition/decompose-by-business-capability.html));
> Martin Fowler *Package by Feature* ([martinfowler.com](https://martinfowler.com/bliki/PackageByFeature.html));
> the Spring Framework reference, *Using `@Transactional`*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html));
> the Spring Modulith reference, *Fundamentals*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/fundamentals.html));
> *The State of the Module System* ([openjdk.org](https://openjdk.org/projects/jigsaw/spec/sotms/)).
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
// src/main/java/com/retailer/order/OrderPlacementApi.java
public interface OrderPlacementApi {
    OrderSummary placeOrder(PlaceOrderCommand command);
}

// src/main/java/com/retailer/order/PlaceOrderCommand.java
public record PlaceOrderCommand(UUID customerId, List<OrderItemRequest> items) {}
// src/main/java/com/retailer/order/OrderItemRequest.java
public record OrderItemRequest(UUID productId, int quantity, BigDecimal unitPrice) {}
// src/main/java/com/retailer/order/OrderSummary.java
public record OrderSummary(UUID orderId, UUID customerId, BigDecimal totalAmount, Instant createdAt) {}
// src/main/java/com/retailer/order/OrderPlacedEvent.java
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
## The extraction test

A package structured by feature provides an unambiguous test for microservice readiness:

1. **Inward dependencies:** Search for all references to `com.retailer.order` from outside packages. They should only touch `OrderPlacementApi`, input command records, and published event records.
2. **Outward dependencies:** Inspect the `import` statements within `com.retailer.order`. They should only reference external APIs or shared generic utility libraries.
3. **Database access:** All SQL queries and tables associated with the feature are manipulated exclusively through package-private repositories in this single package.

If a package passes this test in a monolith, extracting it into an independent microservice requires only wrapping the public Java interface in a REST controller or messaging listener, moving the package to its own Git repository, and provisioning its database schema. If a package fails this test in-process, extracting it across a network will produce a distributed monolith.

What this chunk has described is javac's version of the boundary, and it holds for exactly one
flat package. [24b · When one flat package is not enough](24b-when-one-flat-package-is-not-enough.md)
picks up where that protection stops.

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

**★ Symptom: `@Transactional` on a package-private service method silently does nothing — the method runs, and nothing rolls back.**
Cause: proxy visibility, and the rule changed. The Spring Framework reference states it exactly:

> *"The `@Transactional` annotation is typically used on methods with `public` visibility. As of 6.0,
> `protected` or package-visible methods can also be made transactional for class-based proxies by
> default. Note that transactional methods in interface-based proxies must always be `public` and
> defined in the proxied interface."*

So on Framework **7.0.9** a package-private `@Transactional` method works — **but only behind a
class-based (CGLIB) proxy.** The moment the bean is proxied through an interface, the annotation on
a non-public method is not seen. A package-by-feature service implementing a public API interface is
exactly the shape that can end up interface-proxied.
Fix: keep the transactional method public **on the API interface** and let the implementation be
package-private, which is the shape this chunk already recommends — the method is public, the class
is not:
```java
public interface OrderPlacementApi {
    OrderSummary placeOrder(PlaceOrderCommand command);   // public, on the interface
}

@Service
class OrderPlacementService implements OrderPlacementApi {
    @Override
    @Transactional                                        // public method, package-private class
    public OrderSummary placeOrder(PlaceOrderCommand command) {
        return summarise(orderRepository.save(buildOrder(command)));
    }
}
```
If you deliberately want non-public transactional methods everywhere, the same page offers
`publicMethodsOnly` to force the stricter, proxy-independent rule back on.

**★ Symptom: `@Transactional` works when called from a controller and does nothing when called from the class next door in the same package.**
Cause: not visibility — self-invocation. Verbatim: *"only external method calls coming in through the
proxy are intercepted. This means that self-invocation … does not lead to an actual transaction at
runtime even if the invoked method is marked with `@Transactional`."* Package-by-feature makes this
**more** likely, because collaborators that used to live in another package and had to go through the
proxy are now sitting inside the same class.
Fix: keep the transaction boundary on the module's entry point and let internal helpers be plain
method calls inside it, rather than annotating helpers and hoping.
```java
@Service
class OrderPlacementService implements OrderPlacementApi {
    @Override
    @Transactional
    public OrderSummary placeOrder(PlaceOrderCommand command) {
        Order order = buildOrder(command);      // plain call: already inside the transaction
        return summarise(orderRepository.save(order));
    }

    private Order buildOrder(PlaceOrderCommand c) {   // NOT annotated. Annotating it would be a lie.
        Order order = new Order(UUID.randomUUID(), c.customerId());
        c.items().forEach(i -> order.addItem(i.productId(), i.quantity(), i.unitPrice()));
        return order;
    }
}
```

**★ Symptom: Jackson serialises an empty JSON object for a package-private domain type.**
Cause: neither the type nor its accessors are reachable under Jackson's default visibility rules, so
nothing is discovered to serialise.
Fix: do not solve this by making the aggregate public. It is the API boundary telling you the truth —
serialise a public record instead, which is exactly what the public `OrderSummary` in this chunk's
example is for.
```java
// wrong: reaching for @JsonAutoDetect to expose the aggregate
// right: the aggregate never leaves the package
return new OrderSummary(saved.getId(), saved.getCustomerId(), saved.getTotalAmount(), saved.getCreatedAt());
```

**★ Symptom: two features both need `Money`, and the proposed fix is a `com.retailer.common` package.**
Cause: a real shared concept, met with the one structure that cancels every boundary in the system at
compile time.
Fix: duplicate the small value type per package first, and promote it to a shared kernel only with an
explicit owner and the four rules in [33 · Shared kernel](33-shared-kernel.md).
[16 · The shared model jar](16-the-shared-model-jar.md) is the long version of why the `common`
package is never free.

**★ Symptom: Domain entities are declared `public` and returned directly from controller or service methods to save authoring DTO classes.**
Cause: Conflating the internal domain model with the public published language.
Fix: Keep domain entities package-private. Expose only immutable Java records as command parameters and result representations in the public API.

**★ Symptom: Cross-domain queries bypass service contracts to join tables across boundaries.**
Cause: Exposing JPA entities publicly allows other services to write `@ManyToOne` relationships referencing foreign aggregates.
Fix: Package-private entities cannot be referenced in another package's entity mapping, preventing JPA cross-boundary object graphs at compile time.

## Interview questions

**★ Why is package-by-layer considered an anti-pattern when preparing an architecture for microservices?**
Package-by-layer groups code by technical mechanisms (controllers, services, repositories) rather than business capabilities. Because Java's default access modifier limits visibility to the same package, placing repositories, entities, and services in separate packages forces every class to be marked `public`. This destroys encapsulation, allowing any part of the application to directly access, query, and mutate another domain's data model without traversing business invariants. When teams attempt to decompose a package-by-layer monolith into microservices, they discover that domain logic is tangled across the entire codebase, making extraction without distributed circular dependencies virtually impossible.

**★ What is the relationship between package-private visibility and microservice boundaries?**
Package-private visibility is the in-process precursor to a microservice network boundary. A well-designed microservice exposes only a small set of public HTTP endpoints or message schemas while keeping its persistence layer, internal state machines, and helper classes hidden inside the deployment unit. Package-by-feature achieves the exact same encapsulation within a monolithic JVM process: public interfaces and DTOs define the published API, while package-private classes prevent other modules from touching internal domain mechanics. A module that cannot maintain this separation in-process will inevitably fail to maintain it across microservices.

**★ Can Spring Data repositories be declared package-private?**
Yes. Spring Data and Spring Framework runtime reflection easily inspects and creates dynamic proxies for package-private repository interfaces. Declaring `interface OrderRepository extends Repository<Order, UUID>` without a `public` modifier ensures that only services located in that exact feature package can inject and execute database operations for that aggregate, guaranteeing single-service data ownership.

**★ Does `@Transactional` work on a non-public method?**
It depends on the proxy, and the answer changed at Framework 6.0. The reference says `protected` and
package-visible methods *"can also be made transactional for class-based proxies by default"*, while
*"transactional methods in interface-based proxies must always be `public` and defined in the proxied
interface."* So: on a CGLIB proxy, yes since 6.0; on a JDK interface proxy, never. The safe design
does not depend on knowing which one you got — put the transactional method on the public interface
and keep the implementing class package-private.

**★ What does package-by-feature cost, honestly?**
Three things. Navigation gets worse before it gets better, because a bounded context in one flat
package is a long file list with no visual grouping. Cross-cutting technical changes get more
tedious — "add a Micrometer timer to every repository" is one directory in package-by-layer and
twelve in package-by-feature. And the structure encodes a domain judgement, so a boundary you got
wrong is now expressed in the directory tree and costs a move to correct rather than a rename. The
first two are real and worth paying; the third is the point — the structure is *supposed* to make a
wrong boundary visible.

---

← [The monolith already told you](23-the-monolith-already-told-you.md) · [Topic index](README.md) · Next → [When one flat package is not enough](24b-when-one-flat-package-is-not-enough.md)
