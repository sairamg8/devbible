---
title: "Scoring candidate service cuts against dark energy and dark matter forces — evaluating four architectures for the order system"
sidebar_label: "44b · Worked example: candidate cuts"
sidebar_position: 58
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Neal Ford & Mark Richards, *Software Architecture: The Hard Parts* (O'Reilly),
> Chapter 2: Architectural Quanta and Granularity; Sam Newman, *Building Microservices* (2nd ed., O'Reilly).
> Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**Architectural boundaries should never be chosen by subjective intuition or fashion. In *Software Architecture: The Hard Parts*, Neal Ford and Mark Richards introduce the framework of Dark Energy (repulsive forces pushing components into separate microservices) and Dark Matter (attractive forces pulling components together into a single deployable). Using the four domain aggregates established in the previous chapter (`Order`, `Payment`, `Inventory`, and `Shipment`), we evaluate four distinct candidate cuts against these competing forces to objectively determine where to draw the boundary.**

## The four candidate cuts

```
Cut 1: Single Modular Deployable
┌──────────────────────────────────────────────┐
│  Order  │  Payment  │  Inventory  │ Shipment │
└──────────────────────────────────────────────┘

Cut 2: Hyper-Granular (One Aggregate per Service)
┌─────────┐   ┌───────────┐   ┌─────────────┐   ┌────────────┐
│  Order  │   │  Payment  │   │  Inventory  │   │  Shipment  │
│ Service │   │  Service  │   │   Service   │   │  Service   │
└─────────┘   └───────────┘   └─────────────┘   └────────────┘

Cut 3: Business-Capability Cut (Two Services)
┌───────────────────────────┐   ┌───────────────────────────┐
│   Commercial / Checkout   │   │   Warehouse / Logistics   │
│   ( Order + Payment )     │   │   ( Inventory + Shipment) │
└───────────────────────────┘   └───────────────────────────┘

Cut 4: Compliance & Scale Cut (Three Services)
┌──────────────┐   ┌────────────────────────┐   ┌───────────────────────────┐
│ Core Commerce│   │ Compliance Gateway     │   │ Logistics Subsystem       │
│  ( Order )   │   │ ( Payment - PCI Zone ) │   │ ( Inventory + Shipment )  │
└──────────────┘   └────────────────────────┘   └───────────────────────────┘
```

## The Dark Energy vs Dark Matter forces

Before scoring, understand the countervailing forces acting on the aggregates:

- **Dark Matter Forces (Pulls Together — Pro-Monolith)**:
  1. *Simple Data Consistency*: Need for ACID atomicity across entities.
  2. *Low Latency*: Zero-overhead in-memory method invocation.
  3. *Operational Simplicity*: Single database connection pool, single artifact to deploy and monitor.
  4. *Transactional Boundaries*: Avoiding sagas and compensation logic.
- **Dark Energy Forces (Pushes Apart — Pro-Microservice)**:
  1. *Regulatory Compliance*: Isolating PCI-DSS cardholder data scope to minimize audit costs.
  2. *Independent Scalability*: Scaling high-throughput inventory reads during flash sales independently of shipment processing.
  3. *Team Autonomy*: Decoupling deploy cadences across independent development squads.
  4. *Fault Isolation (Blast Radius)*: Ensuring a crash in shipping label generation does not prevent customers from placing orders.

## Evaluation and scoring matrix

We score each candidate cut across the forces on a scale of 1 (Poor) to 5 (Excellent):

| Architectural Force | Cut 1 (Monolith) | Cut 2 (4 Microservices) | Cut 3 (2 Services) | Cut 4 (3 Services) |
| :--- | :---: | :---: | :---: | :---: |
| **Data Consistency (Dark Matter)** | 5 (ACID) | 2 (Sagas / 2PC) | 4 (Local within domains) | 4 (Local within domains) |
| **Operational Simplicity (Dark Matter)** | 5 (1 artifact) | 1 (4 pipelines, 4 DBs) | 4 (2 artifacts) | 3 (3 artifacts) |
| **Zero Network Latency (Dark Matter)** | 5 (In-memory) | 1 (3 network hops/order) | 3 (1 network hop) | 3 (1 network hop) |
| **PCI Compliance Blast Radius (Dark Energy)**| 1 (Entire app in audit) | 5 (Payment isolated) | 1 (Order app in audit) | 5 (Payment isolated) |
| **Independent Scalability (Dark Energy)** | 2 (Scale all or none) | 5 (Scale per SKU/ops) | 4 (Scale warehouse vs web)| 5 (Scale inventory independently) |
| **Fault Isolation (Dark Energy)** | 1 (App crash stops all) | 4 (Isolated processes) | 3 (Isolated by function) | 4 (Payment/Order isolated) |
| **Team Autonomy / Conway's Law** | 2 (Shared repo/deploy) | 4 (Independent teams) | 4 (2 teams mapped cleanly)| 5 (Payment/Order/Logistics teams)|
| **Total Score** | **21** | **21** | **23** | **29** |

## Analysis of the cuts

### Cut 1: The Single Modular Monolith
- **Pros**: Maximum data consistency and zero network latency. Ideal for a single small team (3 to 6 engineers).
- **Cons**: Severe compliance liability. Because `Payment` shares the codebase and database with `Order` and `Inventory`, the entire system falls within PCI-DSS audit scope. A memory leak in shipping label PDF generation can crash the entire checkout engine.

### Cut 2: The Hyper-Granular 4-Service Cut
- **Pros**: Perfect theoretical isolation. Each aggregate can scale independently.
- **Cons**: Distributed systems catastrophe for small organizations. Placing an order now requires a 4-step distributed saga across the network. If `InventoryService` is slow, `OrderService` times out. Every simple feature requires cross-repo pull requests and synchronized releases.

### Cut 3: The 2-Service Business-Capability Cut
- **Pros**: Natural divide between customer-facing checkout and warehouse operations. Reduces cross-service network calls to a single asynchronous event (`OrderPlacedEvent`).
- **Cons**: `Payment` remains co-located with `Order`, retaining high PCI audit exposure.

### Cut 4: The 3-Service Compliance & Scale Cut (The Winner)
- **Why it wins**: Cut 4 strikes the optimal balance between dark energy and dark matter:
  1. `Payment` is isolated into a dedicated service, reducing PCI-DSS compliance scope to a tiny, auditable footprint.
  2. `Inventory` and `Shipment` are co-located in the Logistics service, keeping high-frequency stock allocations and shipping label generations within the same warehouse data plane.
  3. `Order` acts as the lean commercial orchestrator, communicating asynchronously with Logistics via Kafka.

## Gotchas

**★ Selecting Cut 2 purely for "microservice purity".**
Teams often select Cut 2 because "microservices mean one service per aggregate." In practice, running 4 microservices for a 5-person engineering team introduces crushing DevOps overhead, distributed tracing requirements, and network latency penalties for zero business gain.

**★ Ignoring PCI DSS compliance scope when evaluating Cut 1 and Cut 3.**
Failing to isolate `Payment` into its own network and deployment boundary multiplies annual third-party compliance audit costs by tens of thousands of dollars, because every server, database, and log repository connected to `Order` becomes subject to rigorous PCI audits.

**★ Over-optimizing for theoretical scale instead of operational simplicity.**
Unless an e-commerce platform processes tens of thousands of concurrent checkouts per second, the data consistency benefits of Dark Matter (Cut 1 or Cut 3) frequently outweigh the theoretical scaling benefits of Dark Energy.

## Interview questions

**★ What is the difference between Dark Energy and Dark Matter in microservice boundary design?**
Dark Energy represents the forces that push components apart into separate microservices (independent scaling, fault isolation, team autonomy, regulatory compliance). Dark Matter represents the attractive forces that pull components together into a single monolithic deployable (simple ACID consistency, low operational overhead, zero network latency, simplified local transactions).

**★ Why does Cut 4 (isolating Payment, while keeping Inventory and Shipment together) score highest in enterprise environments?**
Cut 4 satisfies the most stringent Dark Energy force—regulatory PCI compliance—by walling off payment card handling in a dedicated microservice. Simultaneously, it honors Dark Matter by grouping warehouse operations (Inventory and Shipment) together, avoiding distributed network sagas between stock reservation and parcel packaging.

**★ When would Cut 1 (Modular Monolith) be superior to Cut 4?**
Cut 1 is superior when the engineering team is small (e.g., 2 to 5 engineers) and payment tokenization is fully outsourced to a hosted third-party gateway (like Stripe Checkout), meaning raw cardholder data never touches application memory. In that context, the operational simplicity and in-memory transactional speed of a modular monolith far outweigh microservice overhead.

---

← [Worked example: operations and aggregates](44-worked-example-operations-and-aggregates.md) · [Topic index](README.md) · Next → [Worked example: two teams vs twelve](44c-worked-example-two-teams-and-twelve.md)
