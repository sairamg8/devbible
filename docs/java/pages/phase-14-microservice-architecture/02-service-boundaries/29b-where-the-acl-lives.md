---
title: "An Anticorruption Layer belongs inside the downstream service that depends on it, never in a centralised ESB or shared integration middleware — and it should be retired the moment upstream adopts a clean published language"
sidebar_label: "29b · Where the ACL lives"
sidebar_position: 47
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Eric Evans, *Domain-Driven Design* (Addison-Wesley), Chapter 14:
> Anticorruption Layer; Martin Fowler *Enterprise Service Bus*
> ([martinfowler.com](https://martinfowler.com/articles/enterpriseServiceBus.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**The most common architectural mistake when implementing an Anticorruption Layer is placing it into a centralized "integration service" or shared middleware proxy rather than inside the downstream bounded context. A translation layer is not shared infrastructure; it represents a specific downstream domain's unique conceptual interpretation of upstream facts. Moving translation into a standalone service creates an operational bottleneck, introduces an orphan repository with no domain owner, and adds unnecessary network hops and failure modes. An ACL belongs strictly inside the downstream deployable, owned by the team whose model is being protected. Furthermore, an ACL is not an eternal fixture: the moment an upstream provider modernizes its API to expose an Open Host Service or published language matching your domain needs, the ACL becomes technical debt and should be dismantled.**

## The architectural trap: The resurrected ESB

When organizations attempt to integrate a clean microservice with an unruly legacy system, the
proposal that surfaces in the design review is always a version of the same one — stated here as
it is usually argued, and **not a quotation from any source**:

**"Let's build a standalone Integration Proxy service between our modern Order Service and the
legacy Warehouse SAP system. That way, the Order team doesn't have to deal with SAP, and the SAP
team doesn't have to learn modern JSON."**

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

## When the "shared ACL" argument is actually right

The blanket rule above has one genuine exception, and refusing to acknowledge it is how the rule gets
ignored entirely. **Two downstream services with the *same* model of the upstream can share the
translation — as a library, never as a service.**

The test is whether the two downstreams agree about what the upstream's data *means*, not merely
about its shape:

| Situation | Share? | Form |
|---|---|---|
| Two services both need the vendor's wire types decoded, and each then interprets them differently | ✅ | A thin **client library**: HTTP plumbing, auth, retries, vendor DTOs. **No domain types.** |
| Two services translate the vendor into the same domain concepts because they are the same bounded context | ✅ | They are one module that was split by accident — see [15 · Too small](15-too-small.md) |
| Two services translate the vendor into *different* domain concepts | ❌ | Two ACLs. The translation is the part that differs, so sharing it forces one team's model onto the other |
| "It would be wasteful to write the mapping twice" | ❌ | The duplication is the point: two contexts having different words for the same upstream fact is what a bounded context *is* |

🔴 **The line to hold is between the client and the translation.** A shared `vendor-gateway-client`
JAR that speaks HTTP and hands back the vendor's own DTOs is a dependency on the *vendor*, which both
services already have. A shared `vendor-acl` JAR that hands back domain types is a
[16 · shared model jar](16-the-shared-model-jar.md) with a better name, and it couples the two
downstreams to each other through a third party neither of them owns.

```java
// Shared, and fine: the vendor's own shapes, no opinion about your domain
public interface LegacyGatewayClient {
    LegacyResponse authorise(String orderRef, long minorUnits);
    LegacyResponse capture(String authRef);
}

// NOT shared: this is billing's interpretation, and shipping's differs
class LegacyPaymentAdapter implements PaymentGatewayPort { /* billing's own translation */ }
```

## The ACL and the strangler are the same layer at different times

An ACL built against a permanent third party and one built during a migration look identical in
code and are completely different assets, which is why
[29c · Mapper or barrier](29c-mapper-or-barrier.md) insists on writing the retirement condition down.

During a [41 · strangler extraction](41-strangler-extraction.md) the ACL points **at the monolith**,
and the monolith is scheduled for demolition. Every line in that layer has a known end date. Treating
it as permanent infrastructure — giving it its own repository, its own team, its own roadmap — is how
a migration's temporary scaffolding outlives the building it was erected against, and the sign that
it happened is a service whose entire purpose is translating between two systems, one of which no
longer exists.

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

**★ Symptom: two teams share an "ACL library" and neither can change their own domain model without the other's approval.**
Cause: the shared artefact returns **domain** types. The translation — the part that encodes each
context's interpretation — was the thing extracted, so both contexts now share one interpretation.
Fix: split the artefact at the line between plumbing and meaning. The shared half speaks the
vendor's language; the translation stays in each service.
```java
// shared library: vendor types only
LegacyResponse r = legacyGatewayClient.authorise(orderRef, minorUnits);

// each service's own adapter, not shared: this is where meaning is assigned
PaymentResult result = translate(r);
```

**★ Symptom: the ACL is a separate deployable and every upstream change now needs two coordinated releases.**
Cause: the translation lives on the far side of a network boundary from the domain that owns it, so
a change to a downstream concept requires deploying a service the downstream team may not even own.
Fix: this is the ESB failure in its operational form. Move the adapter into the downstream
deployable, where a change to the domain and a change to its translation are the same pull request.

**★ Symptom: The legacy system was replaced two years ago, but the codebase still contains legacy translation code.**
Cause: Failing to treat the ACL as technical debt with a planned decommissioning phase.
Fix: Program strictly against domain interfaces; swap the legacy adapter for a direct modern client the moment the upstream migration completes.

## Interview questions

**★ Why should an Anticorruption Layer be deployed inside the downstream service rather than as a standalone proxy service?**
An ACL represents a specific downstream bounded context's semantic interpretation of an external model. Co-locating the ACL inside the downstream deployable ensures that the team owning the domain model also owns the translation logic. It avoids introducing an unowned intermediary repository, eliminates unnecessary network hops, removes coordinated deployment deadlocks between teams, and allows translation to execute with zero network latency.

**★ How does co-locating an ACL support the "Smart endpoints and dumb pipes" principle?**
In an ESB architecture, complex business transformation, message enrichment, and protocol translation are centralized in middle-tier middleware (the "smart pipe"). This concentrates domain logic in an unmaintainable central bottleneck. Placing the ACL in the downstream service pushes translation logic directly into the endpoint that requires it, keeping the underlying transport (HTTP, Kafka, RabbitMQ) purely focused on message delivery.

**★ How does an explicit domain port (interface) facilitate the eventual decommissioning of an ACL?**
By adhering to Dependency Inversion, the core domain service depends strictly on an interface expressed in its own ubiquitous language (e.g. `InventoryReservationPort`), never on the concrete `LegacyWarehouseAdapter`. When the legacy upstream is decommissioned or modernized, the team writes a new adapter fulfilling that same interface and deletes the legacy ACL package. The core domain logic is untouched.

**★ Two services integrate with the same vendor. What may they share, and what must they not?**
They may share the **client** — HTTP plumbing, authentication, retry policy, and the vendor's own DTO
types — because that is a dependency on the vendor which both services already have, and duplicating
it buys nothing. They must not share the **translation**, because the translation is where each
bounded context assigns its own meaning to the vendor's data, and extracting it into a common
artefact forces one team's domain model onto the other through a third party neither owns. The
practical line is the return type: a shared artefact returning vendor types is a client library, and
a shared artefact returning domain types is a shared model jar with a better name.

**★ Why is "we would otherwise write the mapping twice" a weak argument against two separate ACLs?**
Because the duplication it objects to is the pattern working. Two bounded contexts having different
words, different granularity and different rules for the same upstream fact is the definition of a
bounded context, not an accident to be normalised away. If the two translations really are identical
and stay identical under change, that is evidence the two services are one bounded context that was
split too finely — and the fix is to merge them, not to share a jar. Sharing the translation gets
you the coupling of one service with the operational cost of two.

**★ Can two different downstream microservices share an Anticorruption Layer JAR?**
Generally no. Two different downstream services belong to different bounded contexts with different ubiquitous languages. Sharing an ACL library forces both downstream services to agree on a single intermediate model, recreating the very coupling the ACL was designed to prevent. Each downstream service should maintain its own focused translator tailored to its specific needs.

---

← [Anticorruption layer](29-anticorruption-layer.md) · [Topic index](README.md) · Next → [Mapper or barrier](29c-mapper-or-barrier.md)
