---
title: "Serialising the domain entity directly into JSON or Kafka payloads turns database schema into wire protocol — the moment an internal column migration breaks external consumers, your boundary has ceased to exist"
sidebar_label: "28b · Never publish the aggregate"
sidebar_position: 52
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Eric Evans, *Domain-Driven Design* (Addison-Wesley), Chapter 14:
> Context Map; Martin Fowler *Data Transfer Object*
> ([martinfowler.com](https://martinfowler.com/eaaCatalog/dataTransferObject.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**The fastest way to destroy a service boundary is to configure an HTTP controller or a message producer that serializes domain entities directly over the wire. What looks like developer convenience—saving the effort of writing explicit DTO records and mappers—silently binds every external consumer to your internal database schema, ORM annotations, and table relationships. The moment you rename an internal column, normalize a table, or introduce an internal state transition, you trigger cascading failures in downstream systems. A true service boundary demands that nothing leaves or enters the context except explicitly versioned, immutable transfer contracts, ensuring the internal domain model remains free to evolve without external negotiation.**
## The illusion of convenience

In Spring Boot, exposing domain entities directly is dangerously easy:

```java
// Anti-pattern: The entity IS the API contract
@RestController
@RequestMapping("/orders")
class DangerousOrderController {

    private final OrderRepository repository;

    DangerousOrderController(OrderRepository repository) {
        this.repository = repository;
    }

    @PostMapping
    Order createOrder(@RequestBody Order order) {
        return repository.save(order); // Invariants bypassed, schema leaked
    }
}
```

This pattern functions during initial development, leading teams into a false sense of productivity. However, as the system grows, it triggers four distinct architectural failure modes:

1. **Database schema becomes wire protocol:** Renaming `customer_num` to `customer_id` in the database changes the JSON field name, immediately breaking external clients.
2. **Security leaks via blacklisting:** Entities inevitably gain internal operational fields such as `fraudScore`, `retryCount`, or `internalApprovalNotes`. Hiding them requires annotating fields with `@JsonIgnore`—a fragile blacklist approach that fails the day a developer forgets to add the annotation to a new sensitive field.
3. **Lazy-loading crashes:** Jackson traverses every getter on the object graph. If child collections (`order.getItems()`) are lazily loaded, serialization outside the database transaction throws `LazyInitializationException`, or worse, triggers N+1 database queries that overwhelm the database.
4. **Bypassed business invariants:** When an incoming JSON body is deserialized directly into an entity, Jackson uses default constructors and setters. Business validation methods (such as verifying credit limits or state transition guards) are completely bypassed. The external caller dictates the entity's internal state.

## The solution: immutable records and explicit mappers

The clean alternative requires keeping the JPA entity package-private, declaring immutable public records for wire transport, and mapping between them explicitly:

```java
package com.retailer.order;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// 1. Published Request Contract: Whitelist of allowed input fields
// src/main/java/com/retailer/order/CreateOrderRequest.java
public record CreateOrderRequest(
    UUID customerId,
    BigDecimal totalAmount
) {
    public CreateOrderRequest {
        if (customerId == null) throw new IllegalArgumentException("Customer ID is required");
        if (totalAmount == null || totalAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Total amount must be positive");
        }
    }
}

// 2. Published Response Contract: Stable representation independent of database columns
// src/main/java/com/retailer/order/OrderResponse.java
public record OrderResponse(
    UUID orderId,
    UUID customerId,
    BigDecimal totalAmount,
    String status,
    Instant createdAt
) {
    static OrderResponse from(OrderEntity entity) {
        return new OrderResponse(
            entity.getId(),
            entity.getCustomerId(),
            entity.getTotalAmount(),
            entity.getStatus(),
            entity.getCreatedAt()
        );
    }
}

// 3. Controller enforcing the boundary
@RestController
@RequestMapping("/orders")
class OrderController {

    private final OrderService service;

    OrderController(OrderService service) {
        this.service = service;
    }

    @PostMapping
    OrderResponse createOrder(@RequestBody CreateOrderRequest request) {
        // Enforces domain constructor invariants before persistence
        OrderEntity entity = service.createOrder(request.customerId(), request.totalAmount());
        return OrderResponse.from(entity);
    }
}

// 4. Package-private JPA entity: Hidden from the rest of the application
@Entity
@Table(name = "orders")
class OrderEntity {

    @Id
    private UUID id;
    private UUID customerId;
    private BigDecimal totalAmount;
    private String status;
    private Instant createdAt;

    // Internal fields that MUST NEVER leak to the API
    private int internalAuditRetryCount;
    private boolean flaggedForManualReview;

    OrderEntity() {} // For JPA only

    OrderEntity(UUID id, UUID customerId, BigDecimal totalAmount) {
        this.id = id;
        this.customerId = customerId;
        this.totalAmount = totalAmount;
        this.status = "PENDING";
        this.createdAt = Instant.now();
        this.internalAuditRetryCount = 0;
        this.flaggedForManualReview = false;
    }

    UUID getId() { return id; }
    UUID getCustomerId() { return customerId; }
    BigDecimal getTotalAmount() { return totalAmount; }
    String getStatus() { return status; }
    Instant getCreatedAt() { return createdAt; }
}

interface OrderService {
    OrderEntity createOrder(UUID customerId, BigDecimal totalAmount);
}
```

## Mass assignment: the security failure, not the design failure

`@RequestBody Order` does not merely bypass invariants — it hands the caller a writeable copy of
every field on the aggregate, including the ones that encode privilege:

```java
// The client's payload. Nothing here is rejected.
// { "customerId": "...", "items": [...], "status": "PAID", "discountApproved": true }

@PostMapping
Order createOrder(@RequestBody Order order) {     // 🔴 the caller set status and discountApproved
    return repository.save(order);
}
```

**A whitelist is structural, not a matter of remembering.** The command record cannot express the
fields it does not declare, so there is no annotation to forget:

```java
// The contract admits exactly four things, and status is not one of them.
public record PlaceOrderCommand(UUID customerId, List<OrderItemDto> items) {
    public PlaceOrderCommand {
        if (customerId == null) throw new IllegalArgumentException("Customer ID is required");
        if (items == null || items.isEmpty()) throw new IllegalArgumentException("Items cannot be empty");
    }
}

@PostMapping
OrderResponse createOrder(@RequestBody PlaceOrderCommand command) {
    return OrderResponse.from(orderPlacement.placeOrder(command));   // status is set by the domain
}
```

⚠️ **`@JsonIgnore` and `@JsonView` are the trap here, not the fix.** Both are blacklists applied to
a type whose default answer is "expose it". They work perfectly until the day a field is added
without one, and the failure mode is silent disclosure rather than an error. A DTO's default answer
is "this field does not exist", which is why the two approaches are not equivalent even when they
produce identical JSON today.

## Surviving schema refactoring

With the boundary firmly established by `OrderResponse`:
- You can split the `orders` database table into `orders` and `order_financials` across multiple normalized tables.
- You can rename database columns or alter data types.
- The `OrderResponse.from(...)` method absorbs the translation logic internally.
- External clients observe zero broken contracts, zero altered JSON shapes, and zero downtime.

All of this concerns an HTTP response, which is the *transient* version of the mistake.
[28d · The event has a longer half-life](28d-the-event-has-a-longer-half-life.md) is the version
that gets stored in other people's databases.

## Gotchas

**★ Symptom: External clients discover and exploit hidden internal fields in JSON responses.**
Cause: Serializing the domain entity directly relies on `@JsonIgnore` to hide sensitive fields. When a new field is added, it defaults to exposed.
Fix: Use a whitelist approach with dedicated DTO records. A DTO record only exposes the exact fields explicitly authored into its constructor.

**★ Symptom: Hibernate throws `LazyInitializationException` when rendering HTTP response.**
Cause: The controller returns an entity, and Jackson accesses a lazy collection after the database transaction has committed and closed.
Fix: Project the entity into a DTO record inside the `@Transactional` service boundary before returning to the web controller.

**★ Symptom: Client request payload silently overwrites primary keys or modification timestamps.**
Cause: Binding incoming JSON directly to an `@Entity` allows malicious or malformed payloads containing `"id": "..."` or `"createdAt": "..."` to be applied by Hibernate.
Fix: Bind HTTP requests to dedicated command records that omit system-managed fields.

**★ Symptom: a caller sets a field they should never have been able to set, and the request succeeds.**
Cause: the entity is the `@RequestBody`, so every field on the aggregate is caller-writeable —
including `status`, `discountApproved`, or anything else that encodes a decision the domain was
supposed to make.
Fix: a command record that does not declare the field. There is nothing to forget, because the type
cannot carry the value:
```java
public record PlaceOrderCommand(UUID customerId, List<OrderItemDto> items) {}
```
`@JsonIgnore` on the entity is the blacklist version of the same idea, and it fails the day someone
adds a field without it.

**★ Symptom: the JSON contains a `@class` or `$type` field naming a Hibernate proxy.**
Cause: polymorphic type information is being written from the runtime class, and the runtime class of
a lazily-loaded entity is a generated proxy subclass rather than the entity itself.
Fix: do not serialise entities. A record's runtime class is the record, so the problem cannot arise —
which is a small illustration of a general point: most serialisation configuration in a Spring
codebase exists to compensate for serialising the wrong types.

**★ Symptom: Changing a database column type from `INTEGER` to `BIGINT` breaks downstream consumers.**
Cause: Entity serialization directly propagated the Java type change into the JSON wire format.
Fix: Maintain backwards-compatible data representations in the published DTO record while migrating the internal database column.

## Interview questions

**★ Why is publishing JPA entities over REST endpoints considered an architectural anti-pattern?**
Publishing JPA entities directly conflates data persistence with API design. It couples external clients to internal database schema, table relationships, and ORM lifecycle mechanisms. Any internal database refactoring (such as renaming columns, normalizing tables, or altering entity state transitions) becomes a breaking change for external callers. Additionally, it introduces severe security risks by exposing internal fields and causes runtime failures like `LazyInitializationException` and N+1 query performance degradation.

**★ How does using immutable Java records for DTOs enforce a whitelist security model?**
When using an entity directly, all fields are exposed by default unless explicitly hidden with annotations like `@JsonIgnore` (a blacklist model). This is inherently brittle because new sensitive fields added during development will leak by default. In contrast, a Java record defines an explicit, immutable whitelist: only the parameters explicitly declared in the record header are serialized over the wire. Internal entity state remains completely invisible.

**★ What happens to business invariants when an entity is used as a `@RequestBody` parameter?**
When Jackson deserializes JSON into an entity, it instantiates the class using reflection, default no-arg constructors, and setters. This completely circumvents any domain validation rules, invariant checks, or state transition guards written into domain constructors and factory methods. An external client can inject invalid state (e.g. negative prices, illegal statuses) directly into the entity, corrupting the database.

**★ What does DTO mapping cost, and is the cost ever the deciding factor?**
It costs short-lived heap allocations per request and the code to write and maintain the mapping. On
a modern JVM those allocations are the cheapest kind — small, immutable, thread-local — and are the
category escape analysis and generational collection handle best, but the honest answer is that the
size of the effect depends entirely on your workload and this page will not invent a number for it.
The reason it is rarely the deciding factor is different and stronger: the alternative does not
actually save the work, it defers it. A team that skips DTOs pays instead in `@JsonIgnore`
annotations, lazy-loading workarounds, serialisation configuration, and a schema it can no longer
change — and that bill arrives at a much worse time.

**★ Why is a DTO a whitelist and `@JsonIgnore` a blacklist, if they produce the same JSON today?**
Because they have opposite defaults, and the default is what decides what happens to the *next*
field somebody adds. A DTO's default is "this field does not exist" — a new column on the entity
changes nothing on the wire until a human adds it to the contract. `@JsonIgnore`'s default is
"expose it" — the new column ships to every consumer the moment it is added, and the failure mode is
silent disclosure rather than an error. Identical output today, opposite behaviour under change, and
the whole point of a boundary is behaviour under change.

---

← [Published language vs aggregate](28-published-language-vs-aggregate.md) · [Topic index](README.md) · Next → [Changing a published contract](28c-changing-a-published-contract.md)
