---
title: "Splitting a service must be executed in-process first — extracting across the network only after module boundaries and data isolation hold"
sidebar_label: "40 · Splitting a service"
sidebar_position: 60
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Martin Fowler, *MonolithFirst* and *Refactoring to a Modular Monolith*;
> Oliver Drotbohm, *Spring Modulith Reference Documentation* (2.1.1).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**Splitting a large service directly into two separate networked microservices is one of the highest-risk operations in software engineering. If the boundary is misplaced, the team pays the full distributed systems tax — network latency, serialization overhead, eventual consistency edge cases, and distributed tracing complexity — while debugging an unstable boundary. The proven architectural methodology is to split in-process first: refactor the single deployable into strict, isolated logical modules using package encapsulation, decouple database schemas locally, eliminate cross-boundary transactions, and verify the seam with automated boundary tests. Only when the in-process boundary proves clean and stable over multiple production release cycles should physical network extraction be considered.**
## The Monolith-First and Module-First principle

Martin Fowler's *MonolithFirst* strategy emphasizes that domain boundaries are almost impossible to get right at the outset. When a service grows too large, the instinct is often to immediately spin up a new Git repository, a new Dockerfile, a CI/CD pipeline, and a network API.

This approach conflates two distinct concerns:
1. **Logical boundary definition**: Decoupling business logic, data models, and invariants.
2. **Physical deployment topology**: Packaging code into separate network-accessible processes.

Solving both simultaneously creates an intractable debugging environment. When an in-process boundary fails, the compiler or test suite flags it in milliseconds. When a network boundary fails, it manifests as distributed deadlocks, partial database states, and cascading timeouts in production.

```
Anti-Pattern: Immediate Network Split
[Service Monolith]  =======>  [Service A]  <--- HTTP/JSON --->  [Service B]
                     Direct     (Distributed transactions, network failures, latency)
                   Extraction

Recommended: In-Process Refactoring First
[Service Monolith]  =======>  [In-Process Module A] <-> [In-Process Module B]
                     Modular    - Verified by ArchUnit / Spring Modulith
                    Refactor    - Split database schemas in same instance
                                - Clean event-driven / DTO contracts
                                          ||
                                          \/ (Only if independent scale needed)
                              [Deployable A]  <--- Async/REST --->  [Deployable B]
```

## Step-by-step in-process splitting procedure

### Step 1: Package reorganization and visibility restriction
Reorganize packages by domain capability rather than technical tier. Make all domain entities, internal helpers, and Spring repositories package-private. Expose only explicit interfaces and immutable records:

```
src/main/java/com/example/monolith/
├── order/
│   ├── internal/                 <-- Package-private JPA entities, repositories
│   │   ├── OrderEntity.java
│   │   └── OrderRepository.java
│   ├── OrderPlacedEvent.java     <-- Public event record
│   └── OrderService.java         <-- Public API interface
└── billing/
    ├── internal/                 <-- Package-private billing logic
    │   ├── InvoiceEntity.java
    │   └── InvoiceRepository.java
    └── BillingListener.java      <-- Consumes OrderPlacedEvent
```

### Step 2: Eliminate shared database foreign keys
A foreign key across modules prevents physical extraction. Alter the schema so that Module B references Module A solely by scalar identifier (`UUID` or `String`), never with JPA relationships like `@ManyToOne` or `@JoinColumn`:

```java
package com.example.monolith.billing.internal;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "invoices", schema = "billing")
public class InvoiceEntity {

    @Id
    private UUID id;

    // SCALAR ID ONLY: Never map @ManyToOne to OrderEntity
    private UUID orderId;

    private long totalCents;

    protected InvoiceEntity() {}

    public InvoiceEntity(UUID id, UUID orderId, long totalCents) {
        this.id = id;
        this.orderId = orderId;
        this.totalCents = totalCents;
    }

    public UUID getId() { return id; }
    public UUID getOrderId() { return orderId; }
    public long getTotalCents() { return totalCents; }
}
```

### Step 3: Eliminate cross-module transactions
In a monolith, developers frequently rely on `@Transactional` spanning calls to multiple services. If `OrderService.createOrder()` calls `BillingService.generateInvoice()` in the same thread, both operations share the same database connection and commit together.

Before extraction, replace direct synchronous calls with Spring application events or transactional outbox events:

```java
package com.example.monolith.order.internal;

import com.example.monolith.order.OrderPlacedEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class DefaultOrderService {

    private final OrderRepository orderRepository;
    private final ApplicationEventPublisher eventPublisher;

    public DefaultOrderService(OrderRepository orderRepository, ApplicationEventPublisher eventPublisher) {
        this.orderRepository = orderRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public UUID placeOrder(UUID customerId, long totalCents) {
        UUID orderId = UUID.randomUUID();
        OrderEntity order = new OrderEntity(orderId, customerId, totalCents);
        orderRepository.save(order);

        // Decouple: Publish event instead of synchronously calling BillingService
        eventPublisher.publishEvent(new OrderPlacedEvent(orderId, customerId, totalCents));
        return orderId;
    }
}
```

In the billing module, listen asynchronously or transactionally after commit:
```java
package com.example.monolith.billing.internal;

import com.example.monolith.order.OrderPlacedEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class BillingEventListener {

    private final InvoiceRepository invoiceRepository;

    public BillingEventListener(InvoiceRepository invoiceRepository) {
        this.invoiceRepository = invoiceRepository;
    }

    @ApplicationModuleListener
    public void onOrderPlaced(OrderPlacedEvent event) {
        InvoiceEntity invoice = new InvoiceEntity(UUID.randomUUID(), event.orderId(), event.totalCents());
        invoiceRepository.save(invoice);
    }
}
```

### Step 4: Verify boundary isolation with Spring Modulith
Before extracting to a microservice, run Spring Modulith verification in your CI test suite:

```java
package com.example.monolith;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ModuleBoundaryTest {

    private static final ApplicationModules MODULES = ApplicationModules.of(MonolithApplication.class);

    @Test
    void verifyModularBoundaries() {
        MODULES.verify();
    }
}
```

`MODULES.verify()` automatically fails if:
1. An internal package in `order` is accessed by `billing`.
2. A cyclical dependency exists between modules.
3. Named interfaces are violated.

### Step 5: Physical extraction (only if justified)
Once the modules run independently in-process with separate database schemas and async event communication, physical extraction is trivial:
1. Move the `billing` package to a new Git repository or Gradle subproject.
2. Replace Spring's local `ApplicationEventPublisher` with an external message broker (Kafka, RabbitMQ).
3. Point `billing` to its own dedicated database server.

When the module is finally clean, one judgement remains — whether it is actually ready, and what
silently stops being true the moment it is on the far side of a network. That is
[40b · Ready to extract](40b-ready-to-extract.md).

## Gotchas

**★ Sharing a single `@Transactional` context across boundaries.**
If Module A calls Module B directly in Java, both run in the same thread. If an unhandled exception occurs in Module B, Spring rolls back Module A's database changes. When extracted across HTTP/Kafka, this automatic rollback vanishes, causing catastrophic partial failures. Test event-driven eventual consistency *before* extracting.

**★ In-memory object reference mutation.**
In Java, passing an object reference across module method calls allows the receiver to mutate the caller's internal state. Always pass immutable Java records (`record OrderPlacedEvent(...)`) across module boundaries.

**★ Extracting before database schema separation.**
Moving Java code into a separate container while leaving both containers querying the same PostgreSQL tables with foreign keys creates a distributed monolith. Always split database schemas into separate schemas or instances while still in-process.

**★ Extracting when team size does not justify it.**
If a single team of 4 engineers owns both modules, extracting them into separate microservices doubles deployment pipelines, multiplies monitoring endpoints, and complicates debugging with zero operational benefit. Keep it as an in-process modular monolith.

## Interview questions

**★ Why should an engineering team refactor to in-process modules before extracting a microservice?**
In-process refactoring isolates domain models, eliminates cyclic dependencies, and removes cross-table database foreign keys at the speed of the Java compiler and unit tests. Attempting this separation across the network conflates architectural boundary problems with distributed systems failure modes (latency, timeouts, partial failures).

**★ How does Spring Modulith's `@ApplicationModuleListener` prepare code for microservice extraction?**
`@ApplicationModuleListener` is transactional and asynchronous by default. It executes only after the publishing module's database transaction commits successfully. This mirrors the exact semantics of a distributed message broker (like Kafka with transactional outbox), ensuring that the code functions under eventual consistency before physical network extraction.

**★ What is the primary sign that an in-process module is NOT ready to be extracted into a microservice?**
The presence of synchronous bi-directional calls or direct database joins across modules. If Module A cannot complete a request without blocking synchronously on Module B, or if queries join tables across both boundaries, extracting them will produce a fragile, distributed monolith.

**★ What changes when moving from in-process Spring events to microservice events?**
The in-memory event bus is replaced with an external message broker (Kafka, RabbitMQ). Domain events must be serialized to a published language (JSON/Protobuf/Avro) with backward-compatibility guarantees, and consumers must implement idempotent message processing to handle at-least-once delivery.

---

← [Moving a capability](39-moving-a-capability.md) · [Topic index](README.md) · Next → [Ready to extract](40b-ready-to-extract.md)
