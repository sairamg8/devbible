---
title: "The published language is an explicit public contract while the aggregate is a private implementation detail — conflating the two couples external callers directly to internal database schemas and domain refactorings"
sidebar_label: "28 · Published language vs aggregate"
sidebar_position: 49
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Eric Evans, *Domain-Driven Design* (Addison-Wesley), Chapter 14:
> Bounded Context & Published Language; Martin Fowler *Published Language*
> ([martinfowler.com](https://martinfowler.com/bliki/PublishedLanguage.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**In Domain-Driven Design, a Bounded Context exists to protect the conceptual integrity of an internal domain model, not to expose it nakedly to external callers. The aggregate root is designed exclusively to enforce transactional business invariants inside the boundary; it was never intended to be serialized over a network or shared across package boundaries. The published language is an explicitly authored, backwards-compatible contract—modeled as immutable Java records or schema definitions—optimized for external consumers. When teams confuse the two by exposing aggregate roots or entities directly as API representations, every internal database migration or domain refactoring becomes a breaking change for external clients, turning autonomous services back into a tightly coupled distributed monolith.**
## What "published language" actually names

The term is Evans's, and the *DDD Reference* definition is one sentence:

> *"Use a well-documented shared language that can express the necessary domain information as a
> common medium of communication."*

Two words in it are load-bearing and usually skipped. **Well-documented**: a published language that
exists only as whatever your serialiser happens to emit is not published, it is leaked. And **common
medium**: it belongs to the conversation between contexts, not to either side of it — which is why
it is not your aggregate and not the consumer's view model either.

Its partner pattern says who is allowed to speak it:

> *"A protocol that gives access to your subsystem as a set of services. Open the protocol so that
> all who need to integrate with you can use it."*

That is [34 · Open host and published language](34-open-host-and-published-language.md)'s subject.
The division of labour between them is worth holding onto: **Open Host Service is the decision to
serve all comers through one protocol; Published Language is the vocabulary that protocol speaks.**

## Two models for two distinct purposes

An application boundary separates two fundamentally different design concerns:

| Dimension | The Aggregate Root | The Published Language |
|---|---|---|
| **Location** | Private to the bounded context | Publicly exposed across modules or network |
| **Primary goal** | Enforce business invariants & transactional consistency | Provide stable, backwards-compatible communication |
| **Mutability** | Rich stateful behavior, internal mutations | Immutable data transfer objects (Java records) |
| **Lifespan** | Tied to database persistence & ORM lifecycle | Versioned contract independent of internal storage |
| **Audience** | Domain service and internal repository | Downstream services, BFFs, and external consumers |

When you treat the aggregate root as the API, you force a single Java class to satisfy two opposing masters: the internal need to evolve database structures freely and the external need to guarantee contract stability for clients.

## The failure of the shared aggregate

Consider what happens when a team exposes `Order` directly:

```java
// Anti-pattern: Returning the domain entity directly from the public API
public Order placeOrder(Order order) { ... }
```

1. **Schema lock-in:** If you rename a database column or split a table, the JSON output changes, breaking external clients. You cannot refactor your database without coordinating with every downstream team.
2. **Security vulnerabilities:** Internal flags such as `isFraudSuspicious` or `internalApprovalNotes` accidentally serialize into public responses unless developers remember to litter the entity with `@JsonIgnore`.
3. **Lazy-loading failures:** Serializing an entity outside an active `@Transactional` session triggers Hibernate `LazyInitializationException` when Jackson attempts to inspect uninitialized child collections.
4. **Bypassed validation:** Deserializing an incoming JSON payload directly into an entity creates an object with default constructors, completely bypassing business invariants and validation rules.

## The clean separation in code

In a properly encapsulated bounded context, the aggregate root is package-private. External modules interact exclusively through immutable command records, summary records, and published domain events:

```java
package com.retailer.order;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

// 1. Published Language: Public immutable command contract
// src/main/java/com/retailer/order/PlaceOrderCommand.java
public record PlaceOrderCommand(
    UUID customerId,
    List<OrderItemDto> items
) {
    public PlaceOrderCommand {
        if (customerId == null) throw new IllegalArgumentException("Customer ID is required");
        if (items == null || items.isEmpty()) throw new IllegalArgumentException("Items cannot be empty");
    }
}

// src/main/java/com/retailer/order/OrderItemDto.java
public record OrderItemDto(UUID productId, int quantity, BigDecimal unitPrice) {}

// 2. Published Language: Public immutable representation contract
// src/main/java/com/retailer/order/OrderSummary.java
public record OrderSummary(
    UUID orderId,
    UUID customerId,
    BigDecimal totalAmount,
    String status,
    Instant createdAt
) {}

// 3. Published Language: Public domain event
// src/main/java/com/retailer/order/OrderPlacedEvent.java
public record OrderPlacedEvent(
    UUID orderId,
    UUID customerId,
    BigDecimal totalAmount,
    Instant occurredAt
) {}

// 4. Private Domain Model: Package-private aggregate enforcing invariants
class Order {
    private final UUID id;
    private final UUID customerId;
    private final Instant createdAt;
    private OrderStatus status;
    private BigDecimal totalAmount;

    Order(UUID id, UUID customerId) {
        this.id = id;
        this.customerId = customerId;
        this.status = OrderStatus.PENDING_PAYMENT;
        this.createdAt = Instant.now();
        this.totalAmount = BigDecimal.ZERO;
    }

    void addItem(UUID productId, int quantity, BigDecimal unitPrice) {
        if (status != OrderStatus.PENDING_PAYMENT) {
            throw new IllegalStateException("Cannot add items to an order in status: " + status);
        }
        if (quantity <= 0) {
            throw new IllegalArgumentException("Quantity must be positive");
        }
        this.totalAmount = this.totalAmount.add(unitPrice.multiply(BigDecimal.valueOf(quantity)));
    }

    // Explicit projection from private aggregate to published contract
    OrderSummary toSummary() {
        return new OrderSummary(id, customerId, totalAmount, status.name(), createdAt);
    }

    OrderPlacedEvent toEvent() {
        return new OrderPlacedEvent(id, customerId, totalAmount, Instant.now());
    }
}

enum OrderStatus {
    PENDING_PAYMENT, PAID, SHIPPED, CANCELLED
}
```

## Evolution without breaking callers

Because `Order` is decoupled from `OrderSummary`:
- The internal status can be refactored into a full State pattern with five sub-states, while `OrderSummary` continues to emit the stable string `"PENDING_PAYMENT"` expected by downstream billing systems.
- You can normalize line items into separate database tables or migrate to a document store without altering a single byte of the published API.
- Wire evolution strategies (tolerant reader, additive fields) apply strictly to the published records, leaving domain logic clean and uncluttered.

What none of this settles is how you change a contract once other teams are reading it — that is
[28c · Changing a published contract](28c-changing-a-published-contract.md).

## Gotchas

**★ Symptom: Database schema migration breaks an external consumer's JSON parsing.**
Cause: The API controller returned the JPA `@Entity` directly, so a renamed column changed the JSON key name.
Fix: Map domain entities to dedicated Java records before serialization. Never return entity classes from API endpoints.

**★ Symptom: Jackson throws `LazyInitializationException: could not initialize proxy - no Session`.**
Cause: Jackson serialization occurs in the web layer after the `@Transactional` service method has completed and the Hibernate session has closed.
Fix: Extract all required data into an immutable DTO record *inside* the transactional service method.

**★ Symptom: External clients send JSON payloads that bypass domain constructor validations.**
Cause: Jackson deserializes incoming JSON directly into an entity using reflection and setters, creating invalid domain objects.
Fix: Require clients to send explicit command records (`PlaceOrderCommand`), and pass the validated record fields into the aggregate factory or constructor.

**★ Symptom: the DTOs are generated from the entities by a mapper, and every schema change still breaks clients.**
Cause: a one-to-one generated DTO is the entity with extra steps. The indirection exists in the code
and not in the design, so the coupling is unchanged — the contract still has exactly the shape of the
table.
Fix: the published language is authored, not derived. If the mapper is a field-for-field copy, the
question to ask is what the *consumer* needs, which is almost never every column and is often a
different shape entirely.
```java
// generated: 14 fields, one per column, and the contract changes when the table does
// authored: what a consumer actually asked for
public record OrderSummary(UUID orderId, BigDecimal totalAmount, String status, Instant createdAt) {}
```

**★ Symptom: Jackson throws `StackOverflowError` during serialization.**
Cause: Bidirectional JPA relationships (`Order` -> `List<OrderItem>` -> `Order`) create infinite recursion during Jackson reflection.
Fix: DTO records do not maintain bidirectional back-references; map entities into a clean hierarchical record structure.

## Interview questions

**★ What is the difference between an Aggregate Root and a Published Language in Domain-Driven Design?**
An Aggregate Root is a domain model pattern whose sole responsibility is to enforce business invariants and transactional consistency within a bounded context. It contains business logic, mutable state transitions, and persistence mappings. A Published Language is a well-documented, stable, versioned contract (typically DTOs or event schemas) designed for interoperability between different bounded contexts. Conflating the two binds external consumers to internal domain implementation details.

**★ Why does exposing an entity as an API contract violate the principle of bounded contexts?**
A bounded context establishes a linguistic and conceptual boundary inside which a domain model has a precise meaning. Exposing entities outside that boundary leaks internal ubiquitous language, database design quirks, and invariant rules into foreign contexts. External consumers become coupled to the entity's structure, preventing the context owners from refactoring their domain model without forcing coordinated releases across multiple teams.

**★ How does separating the published language from the aggregate support zero-downtime database migrations?**
When the published language is a decoupled record, the internal database schema and domain aggregate can undergo multi-phase schema migrations (e.g. expand-and-contract, renaming tables, decomposing columns) while the projection method (`toSummary()`) continues to translate internal state into the existing public contract. External clients observe zero breaking changes during or after the database migration.

**★ Why is a mapper that copies every entity field into a DTO not a published language?**
Because the contract still has the shape of the table; the mapper adds a layer of code without adding
a layer of decision. The published language is supposed to be *"a well-documented shared language …
as a common medium of communication"* — authored for what the consumers need, and therefore free to
stay stable while the table underneath it is renamed, split or normalised. A field-for-field DTO
gives up exactly that freedom, and you can tell you have one when every database migration still
produces a client-facing change.

**★ Can a bounded context have multiple published languages?**
Yes. A bounded context frequently publishes different languages for different communication mediums: an HTTP REST JSON schema for synchronous client queries, a Protobuf schema for high-performance internal RPC, and an Avro or JSON schema for asynchronous event publication over Kafka. All three contracts project from the same underlying domain aggregate.

---

← [Build modules and JPMS](27-build-modules-and-jpms.md) · [Topic index](README.md) · Next → [Never publish the aggregate](28b-never-publish-the-aggregate.md)
