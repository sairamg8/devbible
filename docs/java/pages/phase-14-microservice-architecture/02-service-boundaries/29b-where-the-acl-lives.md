---
title: "An Anticorruption Layer belongs inside the downstream service that depends on it, never in a centralised ESB or shared integration middleware — and it should be retired the moment upstream adopts a clean published language"
sidebar_label: "29b · Where the ACL lives"
sidebar_position: 42
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Eric Evans, *Domain-Driven Design* (Addison-Wesley), Chapter 14:
> Anticorruption Layer; Martin Fowler *Enterprise Service Bus*
> ([martinfowler.com](https://martinfowler.com/articles/enterpriseServiceBus.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**The most common architectural mistake when implementing an Anticorruption Layer is placing it into a centralized "integration service" or shared middleware proxy rather than inside the downstream bounded context. A translation layer is not shared infrastructure; it represents a specific downstream domain's unique conceptual interpretation of upstream facts. Moving translation into a standalone service creates an operational bottleneck, introduces an orphan repository with no domain owner, and adds unnecessary network hops and failure modes. An ACL belongs strictly inside the downstream deployable, owned by the team whose model is being protected. Furthermore, an ACL is not an eternal fixture: the moment an upstream provider modernizes its API to expose an Open Host Service or published language matching your domain needs, the ACL becomes technical debt and should be dismantled.**

## The architectural trap: The resurrected ESB

When organizations attempt to integrate a clean microservice with an unruly legacy system, someone inevitably proposes:

> *"Let's build a standalone Integration Proxy service between our modern Order Service and the legacy Warehouse SAP system. That way, the Order team doesn't have to deal with SAP, and the SAP team doesn't have to learn modern JSON."*

This proposal recreates the Enterprise Service Bus (ESB) under a new name, introducing severe systemic problems:

1. **A new distributed monolith:** The proxy service must be modified and deployed whenever *either* the Order Service or the Warehouse system changes. It becomes the bottleneck of every delivery sprint.
2. **Orphan domain ownership:** Who owns the proxy repository? The Order team avoids it because "it's just SAP integration," while the SAP team avoids it because "it's modern Java." The code degrades into unmaintained glue code.
3. **Double network hops and latency:** An operation that should have been an in-memory method call followed by a single external HTTP request now traverses two separate network hops across Kubernetes clusters.
4. **Generalized translations that satisfy nobody:** If a second downstream service (such as Billing) also needs warehouse data, developers are tempted to expand the proxy into a generic canonical model. As demonstrated across two decades of ESB failures, a universal enterprise model pleases everyone in theory and satisfies nobody in practice.

As Martin Fowler famously summarized the microservices philosophy: *"Smart endpoints and dumb pipes."* The translation intelligence belongs inside the smart endpoint that relies on the clean model.

## Physical location: inside the downstream deployable

An Anticorruption Layer belongs in the infrastructure package of the downstream service that requires the protection:

```text
order-service/
├── src/main/java/com/retailer/order/
│   ├── domain/
│   │   ├── Order.java                    // Core aggregate
│   │   ├── InventoryReservationPort.java // Domain port (interface)
│   │   └── ReservationResult.java        // Domain value object
│   └── infrastructure/
│       └── warehouse/                    // The ACL lives HERE
│           ├── LegacyWarehouseAdapter.java (implements InventoryReservationPort)
│           ├── LegacyWarehouseTranslator.java
│           └── LegacyWarehouseRestClient.java
```

### Why co-location is the only scalable pattern

- **Single team ownership:** The Order team owns the port, the adapter, and the domain logic. They modify the translator in the exact same pull request where they alter domain logic.
- **Zero extra network hops:** Translation between legacy payloads and domain records executes as in-memory CPU instructions inside the Order Service JVM process.
- **Context-specific mapping:** The Order team translates the warehouse concept of a "material bin" into an `OrderItemReservation`. If the Billing team also talks to the warehouse, Billing writes its own ACL translating that same bin into an `InventoryAssetValue`. Neither team is constrained by the other's translation choices.

## Runnable Java implementation: In-process ACL

```java
package com.retailer.order.infrastructure.warehouse;

import com.retailer.order.domain.InventoryReservationPort;
import com.retailer.order.domain.ReservationResult;
import java.util.UUID;
import org.springframework.stereotype.Component;

// The ACL lives inside the downstream deployable, implementing the domain port
@Component
class LegacyWarehouseAdapter implements InventoryReservationPort {

    private final LegacyWarehouseRestClient restClient;
    private final LegacyWarehouseTranslator translator;

    LegacyWarehouseAdapter(LegacyWarehouseRestClient restClient, LegacyWarehouseTranslator translator) {
        this.restClient = restClient;
        this.translator = translator;
    }

    @Override
    public ReservationResult reserveStock(UUID orderId, UUID sku, int quantity) {
        LegacyStockAllocationRequest request = translator.toLegacyRequest(orderId, sku, quantity);

        try {
            LegacyStockAllocationResponse response = restClient.allocate(request);
            return translator.toDomainResult(response);
        } catch (Exception ex) {
            // Isolates downstream domain from raw network and transport errors
            return ReservationResult.failed("Warehouse communication error: " + ex.getMessage());
        }
    }
}

@Component
class LegacyWarehouseTranslator {

    LegacyStockAllocationRequest toLegacyRequest(UUID orderId, UUID sku, int quantity) {
        return new LegacyStockAllocationRequest(orderId.toString(), sku.toString(), quantity);
    }

    ReservationResult toDomainResult(LegacyStockAllocationResponse response) {
        if (response != null && "ALLOCATED_OK".equals(response.STATUS_FLAG())) {
            return ReservationResult.confirmed(response.BIN_LOCATION_ID());
        }
        return ReservationResult.declined("Insufficient stock at warehouse");
    }
}

interface LegacyWarehouseRestClient {
    LegacyStockAllocationResponse allocate(LegacyStockAllocationRequest request);
}

record LegacyStockAllocationRequest(String ORD_REF, String MAT_NUM, int QTY) {}
record LegacyStockAllocationResponse(String STATUS_FLAG, String BIN_LOCATION_ID) {}
```

## The lifecycle of an ACL: knowing when to delete it

An Anticorruption Layer is not a permanent monument; it is a temporary structural brace designed to be removed when the upstream system matures.

### Three triggers to retire an ACL

1. **Upstream adopts a clean Published Language:** When the upstream warehouse system is modernized to expose a clean REST or gRPC service using standard domain concepts, the downstream team can retire the translator and adopt a direct, thin HTTP client.
2. **Upstream is decommissioned:** When the legacy mainframe is switched off and replaced by a modern SaaS or internal service, you delete `com.retailer.order.infrastructure.warehouse` and replace it with a new adapter implementing the existing `InventoryReservationPort`. Not a single line of domain code changes.
3. **Downstream domain merges with upstream:** If organizational restructuring merges the Order and Warehouse teams into a single bounded context, translation between them is no longer required.

## Gotchas

**★ Symptom: The team creates an independent Git repository and Kubernetes deployment for an "ACL Proxy".**
Cause: Misunderstanding the ACL as an infrastructure network proxy rather than a domain translation layer.
Fix: Move the ACL classes into the downstream service repository as an infrastructure adapter package.

**★ Symptom: An ACL adapter begins performing business validation, pricing calculations, and transaction orchestration.**
Cause: Architectural drift; business logic leaking into the translation adapter.
Fix: The ACL must strictly translate data between schemas and handle network communication. All business decisions belong in the core domain service.

**★ Symptom: Downstream domain logic breaks when the legacy upstream API changes.**
Cause: Leaky ACL; the adapter returned raw legacy objects or string status flags directly to domain services.
Fix: The adapter must only return pure domain value objects and enums defined in the downstream domain package.

**★ Symptom: The legacy system was replaced two years ago, but the codebase still contains legacy translation code.**
Cause: Failing to treat the ACL as technical debt with a planned decommissioning phase.
Fix: Program strictly against domain interfaces; swap the legacy adapter for a direct modern client the moment the upstream migration completes.

## Interview questions

**★ Why should an Anticorruption Layer be deployed inside the downstream service rather than as a standalone proxy service?**
An ACL represents a specific downstream bounded context's semantic interpretation of an external model. Co-locating the ACL inside the downstream deployable ensures that the team owning the domain model also owns the translation logic. It avoids introducing an unowned intermediary repository, eliminates unnecessary network hops, removes coordinated deployment deadlocks between teams, and allows translation to execute with zero network latency.

**★ How does co-locating an ACL support the "Smart endpoints and dumb pipes" principle?**
In an ESB architecture, complex business transformation, message enrichment, and protocol translation are centralized in middle-tier middleware (the "smart pipe"). This concentrates domain logic in an unmaintainable central bottleneck. Placing the ACL in the downstream service pushes translation logic directly into the endpoint that requires it, keeping the underlying transport (HTTP, Kafka, RabbitMQ) purely focused on message delivery.

**★ How does an explicit domain port (interface) facilitate the eventual decommissioning of an ACL?**
By adhering to Dependency Inversion, the core domain service depends strictly on an interface expressed in its own ubiquitous language (e.g. `InventoryReservationPort`), never on the concrete `LegacyWarehouseAdapter`. When the legacy upstream is decommissioned or modernized, the team writes a new adapter fulfilling that same interface and deletes the legacy ACL package. The core domain logic remains 100% untouched.

**★ Can two different downstream microservices share an Anticorruption Layer JAR?**
Generally no. Two different downstream services belong to different bounded contexts with different ubiquitous languages. Sharing an ACL library forces both downstream services to agree on a single intermediate model, recreating the very coupling the ACL was designed to prevent. Each downstream service should maintain its own focused translator tailored to its specific needs.

---

← [Anticorruption layer](29-anticorruption-layer.md) · [Topic index](README.md) · Next → [Context mapping](30-context-mapping.md)
