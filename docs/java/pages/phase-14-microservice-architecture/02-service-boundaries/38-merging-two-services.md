---
title: "Merging two services is a disciplined engineering migration, not a defeat — a six-step procedure that collapses an artificial network boundary back into a modular in-process package without downtime"
sidebar_label: "38 · Merging two services"
sidebar_position: 57
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Sam Newman, *Monolith to Microservices* (O'Reilly), Chapter 5:
> Merging Services Together; Martin Fowler *Refactoring to a Modular Monolith*
> ([martinfowler.com](https://martinfowler.com/articles/modular-monolith.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**When an engineering organization discovers that two microservices suffer from lockstep deployments, chatty network dependencies, or split transactional invariants, the only responsible architectural remedy is to merge them. Sunk cost fallacy and cultural embarrassment often prevent teams from taking this step, leading to increasingly fragile workarounds like distributed transactions, cross-service caching, and multi-repo release trains. Merging two services is a routine, disciplined refactoring that restores high cohesion, simplifies deployment pipelines, and eliminates network latency. Executing a merge without production downtime requires a structured six-step migration: creating an in-process module, proxying traffic, replacing remote clients with local beans, consolidating databases, and retiring the redundant container.**

## Overcoming the psychological barrier

Merging services is frequently resisted because teams view it as "admitting failure." They spent two quarters extracting a service; merging it back feels like regression.

In reality, boundary refactoring is a hallmark of engineering maturity:
- You understand the domain today vastly better than when the initial whiteboard boundary was drawn.
- An artificial boundary that creates operational misery should be removed, not defended.
- As Martin Fowler notes, moving from microservices back to a modular monolith or collapsing two overly fine-grained services is a natural architectural correction.

## The six-step zero-downtime merge procedure

To merge a secondary service (`shipping-service`) into a surviving primary service (`order-service`) without downtime, follow this six-step sequence:

```text
Step 1: Move code to a new package in order-service (com.retailer.order.shipping)
Step 2: Proxy or dual-route external shipping requests to order-service
Step 3: Replace remote HTTP clients in order-service with local Spring bean injection
Step 4: Consolidate databases (migrate tables to order database)
Step 5: Repoint external consumers directly to order-service endpoints
Step 6: Decommission shipping-service containers and archive repository
```

### Step 1: In-process module creation

Copy the code from `shipping-service` into a distinct subpackage within `order-service`: `com.retailer.order.shipping`. Keep the packages cleanly separated using package-private visibility or Spring Modulith to prevent uncoordinated coupling during the merge.

### Step 2: Traffic proxying

Before migrating data, expose the existing shipping HTTP endpoints directly from `order-service`. Update your API Gateway or configure the old `shipping-service` to act as a dumb reverse proxy that forwards all incoming traffic to `order-service`.

### Step 3: Replace remote calls with local method invocations

Within `order-service`, locate the HTTP client (`ShippingRestClient`) previously used to call the remote service. Replace it with direct constructor injection of the local `ShippingService` Spring bean:

```java
package com.retailer.order.service;

import com.retailer.order.shipping.ShippingService;
import com.retailer.order.shipping.ShippingManifestRecord;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderFulfillmentCoordinator {

    private final ShippingService shippingService; // Direct in-memory bean injection

    public OrderFulfillmentCoordinator(ShippingService shippingService) {
        this.shippingService = shippingService;
    }

    @Transactional
    public void fulfillOrder(UUID orderId) {
        // Direct local Java method call: no serialization, no socket, no timeout budget
        ShippingManifestRecord manifest = shippingService.generateManifest(orderId);
        // Both operations now participate in a single local ACID transaction
    }
}
```

### Step 4: Database consolidation

Initially, `order-service` connects to both databases using dual datasources. Using a database migration tool (Flyway or Liquibase):
1. Create the shipping tables inside the order database (either in a `shipping` schema or prefixed with `ship_`).
2. Run an ETL migration or replication stream to copy historical shipping records.
3. Switch `order-service` to query the local shipping tables.
4. Drop the secondary datasource and decommission the standalone shipping database.

### Step 5: Repoint external consumers

Update external consumers (mobile apps, partner APIs) to call the consolidated endpoint on `order-service`.

### Step 6: Decommission the orphan service

Scale down the `shipping-service` Kubernetes deployment to zero replicas, verify logs and error metrics for forty-eight hours, archive the Git repository, and delete the CI/CD deployment pipeline.

## Managing class name collisions

When merging two independent codebases, name collisions are inevitable: both projects likely contain an `Address`, `Status`, or `User` class.

Do not attempt to merge these classes into a single unified type. That reintroduces the shared model anti-pattern. Keep the classes partitioned within their respective feature packages:
- `com.retailer.order.model.Address` (shipping destination)
- `com.retailer.order.shipping.model.Address` (carrier routing address)

Allowing distinct representations to coexist in separate packages honors their distinct bounded contexts while eliminating the network boundary between them.

## Gotchas

**★ Symptom: A "Big Bang" merge over a weekend results in severe data corruption and an emergency rollback.**
Cause: Attempting to merge code, database schemas, and networking in a single massive deployment.
Fix: Follow the six-step phased migration. Move code first while proxying, migrate data second, and decommission last.

**★ Symptom: Database connection pool exhaustion in the merged service under production load.**
Cause: The merged service handles the combined traffic of both previous services, but HikariCP pool sizes were not increased.
Fix: Recalculate `maximumPoolSize` in `application.yml` to accommodate the aggregate concurrent transaction volume.

**★ Symptom: Developers immediately begin cross-querying merged tables using raw SQL joins across boundaries.**
Cause: Failing to enforce module boundaries after merging into a single database.
Fix: Use Spring Modulith verification (`MODULES.verify()`) or ArchUnit tests to prevent classes in `order` from accessing repositories in `shipping`.

**★ Symptom: The old service cannot be decommissioned because an unknown external consumer is still calling it.**
Cause: Undocumented consumers bypassing API Gateways.
Fix: Inspect access logs on the old service container to identify caller IPs and headers, contact the consumer team, and enforce a hard deprecation deadline.

## Interview questions

**★ Why is merging two microservices considered an architectural refactoring rather than a failure?**
In software architecture, boundaries are hypotheses tested against operational reality. When monitoring reveals that two services are locked in synchronous call chains, require synchronized deployments, or violate transaction boundaries, the hypothesis has been disproven. Merging the services eliminates network latency, distributed deadlocks, and operational complexity, restoring high cohesion.

**★ What is the zero-downtime sequence for merging two microservices?**
The sequence consists of six steps: (1) copy the secondary service code into a distinct subpackage of the primary service; (2) proxy incoming external traffic to the primary service; (3) replace remote HTTP clients with direct in-memory Spring bean calls; (4) consolidate the databases into a single database instance; (5) repoint external consumers to the primary service; and (6) decommission the secondary service container and archive its repository.

**★ How should teams resolve domain model class collisions during a service merge?**
Teams should avoid creating a unified "shared" class. Instead, keep the models in their separate feature packages (`order.model.Address` vs `shipping.model.Address`). This preserves the distinct ubiquitous language of each context while removing the operational overhead of the network boundary.

**★ What happens to transaction boundaries when two services are merged?**
Before the merge, operations spanning both services required eventual consistency, sagas, or two-phase commit. After merging and consolidating the database schemas, the operations can execute within a single JVM thread and participate in a standard, local ACID database transaction (`@Transactional`), providing guaranteed atomicity with zero distributed failure modes.

---

← [The tells of a wrong boundary](37-the-tells-of-a-wrong-boundary.md) · [Topic index](README.md) · Next → [Moving a capability](39-moving-a-capability.md)
