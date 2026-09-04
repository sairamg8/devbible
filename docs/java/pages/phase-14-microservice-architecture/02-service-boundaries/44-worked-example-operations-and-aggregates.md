---
title: "Worked example: analyzing business operations, candidate aggregates, and transactional invariants in an e-commerce order system"
sidebar_label: "44 · Worked example: operations and aggregates"
sidebar_position: 62
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Eric Evans, *Domain-Driven Design* (Addison-Wesley), Chapter 6: The Life Cycle of
> an Object; Vaughn Vernon, *Implementing Domain-Driven Design* (Addison-Wesley), Chapter 10: Aggregates.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**Designing resilient microservice boundaries begins with deep domain modeling, not infrastructure diagrams. To demonstrate how domain boundaries are systematically derived from business realities, this worked example analyzes a realistic e-commerce order and fulfillment system. Before proposing any network boundaries, we map out the core business operations, identify candidate aggregate roots, and isolate strict transactional invariants. Identifying where transactional consistency is mandatory versus where eventual consistency is acceptable reveals the natural seams of the system and dictates where microservice boundaries can safely be cut.**

## The domain scenario: Retail order lifecycle

The system supports five critical business operations:
1. `PlaceOrder`: Customer selects items, calculates totals with taxes and discounts, and initiates an order intent.
2. `AuthorizePayment`: Validates payment credentials, checks fraud scores, and reserves funds with a payment processor.
3. `ReserveInventory`: Verifies real-time stock levels and places a hard hold on stock to prevent overselling.
4. `FulfillOrder`: Warehouse staff picks items, packs parcels, and prints courier shipping labels.
5. `CancelOrder`: Customer or support agent voids the order, releasing reserved stock and refunding authorization holds.

## Identifying candidate aggregates and invariants

An aggregate is a cluster of associated objects treated as a single unit for data changes. Every aggregate has a single Root Entity. External objects may only hold references to the Root Entity.

```
┌───────────────────────────────┐        ┌───────────────────────────────┐
│        Order Aggregate        │        │      Inventory Aggregate      │
│  [OrderRoot]                  │        │  [StockItemRoot]              │
│    ├── OrderId                │        │    ├── Sku                    │
│    ├── CustomerId             │        │    ├── QuantityOnHand         │
│    ├── List<OrderLine>        │        │    └── ReservedQuantity       │
│    └── OrderStatus            │        │  Invariant: Reserved <= Hand  │
│  Invariant: Valid totals,     │        └───────────────────────────────┘
│  immutable lines once placed  │
└───────────────────────────────┘
                │                                        │
                ▼                                        ▼
┌───────────────────────────────┐        ┌───────────────────────────────┐
│       Payment Aggregate       │        │      Shipment Aggregate       │
│  [PaymentTransactionRoot]     │        │  [ShipmentRoot]               │
│    ├── PaymentId              │        │    ├── ShipmentId             │
│    ├── OrderId (Scalar)       │        │    ├── OrderId (Scalar)       │
│    ├── AmountCents            │        │    ├── CarrierManifest        │
│    └── TokenizedCredentials   │        │    └── TrackingNumber         │
│  Invariant: PCI DSS isolation │        │  Invariant: Cannot ship       │
└───────────────────────────────┘        │  without tracking number      │
                                         └───────────────────────────────┘
```

### 1. The Order aggregate
- **Root**: `Order`
- **Internal Entities/Values**: `OrderLine`, `ShippingAddress`, `Money`, `OrderStatus`
- **Strict Invariants (Transactional)**:
  - An order must contain at least one line item.
  - Total amount must equal the sum of line items minus applied discounts plus tax.
  - Once transitioning to `PAID`, line items cannot be added, modified, or deleted.
  - Transitions must follow the state machine: `PENDING_PAYMENT` -> `PAID` -> `FULFILLING` -> `SHIPPED` (or `CANCELLED`).

```java
package com.example.ecommerce.order.domain;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

public class Order {

    public enum Status { PENDING_PAYMENT, PAID, FULFILLING, SHIPPED, CANCELLED }

    private final UUID id;
    private final UUID customerId;
    private final List<OrderLine> lines;
    private Status status;
    private final long totalCents;

    public Order(UUID id, UUID customerId, List<OrderLine> lines) {
        if (lines == null || lines.isEmpty()) {
            throw new IllegalArgumentException("An order must contain at least one line item");
        }
        this.id = id;
        this.customerId = customerId;
        this.lines = List.copyOf(lines);
        this.totalCents = this.lines.stream().mapToLong(OrderLine::totalCents).sum();
        this.status = Status.PENDING_PAYMENT;
    }

    public void markPaid() {
        if (this.status != Status.PENDING_PAYMENT) {
            throw new IllegalStateException("Cannot mark paid from status: " + this.status);
        }
        this.status = Status.PAID;
    }

    public void cancel() {
        if (this.status == Status.SHIPPED) {
            throw new IllegalStateException("Cannot cancel an order that has already shipped");
        }
        this.status = Status.CANCELLED;
    }

    public UUID getId() { return id; }
    public UUID getCustomerId() { return customerId; }
    public List<OrderLine> getLines() { return lines; }
    public Status getStatus() { return status; }
    public long getTotalCents() { return totalCents; }
}
```

### 2. The Inventory aggregate
- **Root**: `StockAllocation` (keyed by SKU or Warehouse/SKU)
- **Strict Invariants (Transactional)**:
  - `reservedQuantity` can never exceed `quantityOnHand`.
  - Concurrency control (optimistic locking `@Version`) must prevent overselling when 50 customers attempt to purchase the last remaining item simultaneously.
  - Reservation times out and expires if payment confirmation is not received within 15 minutes.

### 3. The Payment aggregate
- **Root**: `PaymentTransaction`
- **Strict Invariants**:
  - Payment authorization cannot exceed the total order amount.
  - Strict compliance boundary: PCI-DSS requires isolation of cardholder data environments (tokenized cards, auth secrets).
  - A captured transaction cannot be authorized again.

### 4. The Shipment aggregate
- **Root**: `Shipment`
- **Strict Invariants**:
  - A shipment cannot be dispatched without a valid carrier tracking number.
  - Items packed into parcels must match the lines requested in the fulfillment dispatch.

## Key architectural discovery: Invariant boundaries

Notice the crucial characteristic of these four aggregates:
- **Inside the aggregate**: Invariants require immediate, strict ACID transactional consistency. For example, `Order.totalCents` and `OrderLine` must always match. `StockAllocation.reservedQuantity` must never exceed `quantityOnHand`.
- **Between aggregates**: Invariants can be **eventually consistent**. When a customer places an order, reserving inventory and authorizing payment can happen sequentially via asynchronous events or a saga orchestrator. The business routinely tolerates a few seconds of delay between clicking "Place Order" and receiving payment confirmation.

This separation of immediate transactional invariants from eventual business workflows gives us the freedom to evaluate candidate service cuts in the next chapter.

## Gotchas

**★ Merging Order and Inventory into a single aggregate.**
Attempting to create an `Order` aggregate that directly contains `StockLevel` forces every order to lock the shared stock row in the database. When 100 customers order the same popular item simultaneously, 99 transactions fail or deadlock on optimistic locking conflicts. Inventory must be an independent aggregate with dedicated concurrency controls.

**★ Crossing aggregate boundaries with JPA `@OneToMany` references.**
If `Order` holds an `@OneToMany` mapping to `PaymentEntity`, Hibernate attempts to manage payment lifecycles inside the order transaction. This couples their persistence, prevents independent scaling, and leaks PCI-DSS compliance scope into the order domain. Reference external aggregates strictly by scalar ID (`UUID orderId`).

**★ Treating `LineItem` as an independent aggregate.**
A line item has no identity or purpose outside of its parent order. Splitting `LineItem` into its own aggregate creates pointless database queries and distributed consistency headaches. It is a classic internal entity within the `Order` aggregate boundary.

## Interview questions

**★ Why is identifying transactional invariants the first step in drawing microservice boundaries?**
Transactional invariants define what data must change together atomically (ACID). If an invariant requires two pieces of data to be immediately consistent under a single database lock, placing a network boundary between them forces distributed transactions (2PC) or complex compensation sagas. Aggregates define the smallest units of immediate consistency; service boundaries must never cut through an aggregate.

**★ Why should the Payment aggregate be isolated from the Order aggregate?**
Payment processing is governed by strict regulatory compliance frameworks (PCI-DSS). If Payment and Order share a database and codebase, the entire order processing infrastructure falls within PCI audit scope, drastically increasing compliance costs and audit overhead. Isolating Payment into a dedicated aggregate and service limits compliance scope to a single, tightly controlled service.

**★ How do high-concurrency write requirements influence aggregate boundaries in e-commerce?**
If multiple customers purchase the same product concurrently, updating an `inventory` column inside an `Order` transaction creates severe database row-lock contention. Isolating inventory into a dedicated `StockAllocation` aggregate allows specialized concurrency techniques (such as optimistic locking with retries, reservation pools, or in-memory redis tokens) without locking order records.

---

← [When not to fix it](43-when-not-to-fix-it.md) · [Topic index](README.md) · Next → [Worked example: candidate cuts](44b-worked-example-candidate-cuts.md)
