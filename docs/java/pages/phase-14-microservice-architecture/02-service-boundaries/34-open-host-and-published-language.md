---
title: "An Open Host Service exposes a standardized, public protocol that enables dozens of downstream consumers to integrate without bespoke upstream negotiations — paired with a Published Language to guarantee backwards compatibility"
sidebar_label: "34 · Open host and published language"
sidebar_position: 49
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Eric Evans, *Domain-Driven Design* (Addison-Wesley), Chapter 14:
> Open Host Service & Published Language; Martin Fowler *Open Host Service Pattern*
> ([martinfowler.com](https://martinfowler.com/bliki/OpenHostService.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**When a bounded context must serve multiple downstream systems, attempting to customize endpoints for each individual consumer creates a combinatorial explosion that paralyzes upstream delivery. Evans' Open Host Service (OHS) pattern solves this by establishing a public, standardized protocol—a fixed set of endpoints and remote procedures—through which all downstream consumers interact with the service on equal terms. Paired with a Published Language (PL)—an open, documented schema such as OpenAPI, JSON Schema, or Protobuf—the provider decouples its development roadmap from consumers. An Open Host Service treats all callers as anonymous subscribers to a stable, versioned contract, trading custom accommodations for enterprise-scale integration velocity.**

## The scaling crisis: beyond Customer-Supplier

In [31 · Customer-supplier](31-customer-supplier.md), the upstream provider negotiates directly with a single downstream customer, modifying endpoints to meet the customer's specific needs.

This dynamic collapses when an upstream service becomes widely shared:
- If `CatalogService` or `IdentityService` serves forty downstream consumers, it cannot customize endpoints for each.
- Creating bespoke endpoints (`/products/for-mobile`, `/products/for-billing`, `/products/for-warehouse`) fragments the domain model and creates an unmaintainable codebase.
- A change requested by one customer inevitably breaks assumptions made by another.

The Open Host Service pattern inverts the negotiation:
- Upstream declares: *"Here is our public protocol. It is standardized, well-documented, and backwards-compatible. We will not build custom endpoints for individual teams; integrate against this contract or translate it in your own Anticorruption Layer."*

## The two pillars: Protocol (OHS) and Vocabulary (PL)

The pattern pairs two distinct architectural concepts:

1. **Open Host Service (The Protocol):** The set of network access mechanisms: HTTP REST endpoints, gRPC stubs, or Kafka topics. It defines authentication, rate limiting, error codes, and deprecation policies.
2. **Published Language (The Vocabulary):** The shared, documented data representation. It is expressed in a vendor-neutral schema format (OpenAPI, JSON Schema, Protobuf, Avro) that external consumers can parse into their own native programming languages.

## Runnable Java implementation: An Open Host Service in Spring Boot

In this implementation, the `Catalog` service acts as an Open Host Service, exposing product information to dozens of downstream consumers via an OpenAPI-documented Published Language:

```java
package com.retailer.catalog.web;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// 1. Open Host Service: Standardized public protocol for all consumers
@RestController
@RequestMapping("/public/v1/products")
// src/main/java/com/retailer/catalog/web/CatalogOpenHostController.java
public class CatalogOpenHostController {

    private final ProductCatalogQueryService queryService;

    public CatalogOpenHostController(ProductCatalogQueryService queryService) {
        this.queryService = queryService;
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProductPublishedRepresentation> getProduct(@PathVariable UUID id) {
        ProductView product = queryService.findById(id);
        if (product == null) {
            return ResponseEntity.notFound().build();
        }

        ProductPublishedRepresentation representation = new ProductPublishedRepresentation(
            product.id(),
            product.sku(),
            product.title(),
            product.basePrice(),
            product.active(),
            product.categories(),
            product.updatedAt()
        );

        return ResponseEntity.ok()
            .header(HttpHeaders.CACHE_CONTROL, "public, max-age=300")
            .header("X-Contract-Version", "1.4.0")
            .body(representation);
    }
}

// 2. Published Language: Stable, immutable contract independent of internal JPA entities
// src/main/java/com/retailer/catalog/web/ProductPublishedRepresentation.java
public record ProductPublishedRepresentation(
    UUID productId,
    String sku,
    String name,
    BigDecimal price,
    boolean available,
    List<String> categories,
    Instant lastModified
) {}

interface ProductCatalogQueryService { ProductView findById(UUID id); }
record ProductView(UUID id, String sku, String title, BigDecimal basePrice, boolean active, List<String> categories, Instant updatedAt) {}
```

## Governance rules for an Open Host Service

An Open Host Service succeeds only if consumers trust that upstream will not break them without warning. That trust requires three governance rules:

1. **Additive evolution only:** New fields added to the Published Language must be optional. Existing field names, data types, and enum values are never removed or altered within a major version.
2. **Formal deprecation headers:** When a field or endpoint is slated for removal, announce it using standard HTTP headers (e.g. RFC 8594 `Sunset: Wed, 11 Nov 2026 00:00:00 GMT`) and provide at least six months of transition time.
3. **No client-specific business logic:** The OHS delivers raw domain facts and capabilities. If a downstream consumer requires specialized business calculations, downstream must compute them in its own service or behind its own ACL.

## Gotchas

**★ Symptom: Upstream team creates bespoke endpoints (`/api/orders/for-billing`) whenever a consumer requests a tweak.**
Cause: Slipping from Open Host Service back into Customer-Supplier.
Fix: Reject client-specific endpoints. Expand the Published Language with additive optional fields, or advise the client to build a downstream translation layer.

**★ Symptom: Removing an "unused" field from a Published Language breaks three downstream services in production.**
Cause: Upstream made breaking contract changes based on assumptions rather than consumer contract tests.
Fix: Treat all published fields as permanent. Enforce additive evolution, and run consumer contract test suites (Pact or Spring Cloud Contract) in upstream CI.

**★ Symptom: Upstream exposes its internal JPA database entities as the Published Language.**
Cause: Conflating the internal domain model with the public contract.
Fix: Decouple the Published Language into dedicated Java records that map from internal domain models.

**★ Symptom: Performance degrades because downstream consumers repeatedly poll the OHS for small updates.**
Cause: Relying solely on synchronous request-response for an Open Host Service.
Fix: Complement the synchronous OHS with an asynchronous Published Language event stream (Kafka or RabbitMQ topics publishing `ProductUpdatedEvent`).

## Interview questions

**★ What is the difference between an Open Host Service and an ordinary REST API?**
An ordinary REST API is often an ad-hoc set of endpoints tailored to specific user interfaces or single consumers. An Open Host Service is a formalized architectural pattern where the provider explicitly commits to a standardized, public protocol and Published Language that treats all consumers as equal, anonymous subscribers. It includes formal versioning, additive-only evolution guarantees, and strict decoupling from internal domain models.

**★ How do Open Host Service and Published Language collaborate in Domain-Driven Design?**
They represent protocol versus vocabulary. The Open Host Service defines *how* consumers access the domain (endpoints, transport protocols, authentication, error handling). The Published Language defines *what* is being transmitted (the shared, documented schemas, records, and data models). Together, they enable seamless integration across disparate bounded contexts without bespoke negotiation.

**★ What should a downstream team do if an Open Host Service's Published Language does not fit its internal domain model?**
The downstream team must build an Anticorruption Layer (ACL). The ACL communicates with the upstream Open Host Service using the Published Language, but immediately translates the data into downstream's native ubiquitous language, ensuring the downstream domain model remains uncorrupted by upstream's conventions.

**★ How does an Open Host Service handle breaking changes when additive evolution is no longer possible?**
When a breaking change is unavoidable, the OHS introduces a new major version path (e.g. `/public/v2/products`) or uses content negotiation (`Accept: application/vnd.retailer.catalog.v2+json`). Upstream runs both v1 and v2 simultaneously in production, using standard deprecation headers (`Sunset`) on v1 to give downstream consumers a multi-month window to migrate.

---

← [Shared kernel](33-shared-kernel.md) · [Topic index](README.md) · Next → [Partnership and separate ways](35-partnership-and-separate-ways.md)
