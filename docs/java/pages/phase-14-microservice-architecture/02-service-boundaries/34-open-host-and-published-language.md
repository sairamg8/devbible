---
title: "An Open Host Service exposes a standardized, public protocol that enables dozens of downstream consumers to integrate without bespoke upstream negotiations — paired with a Published Language to guarantee backwards compatibility"
sidebar_label: "34 · Open host and published language"
sidebar_position: 60
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Eric Evans, *Domain-Driven Design Reference* (2015), *Open Host
> Service* and *Published Language*, reproduced verbatim in the ddd-crew *Context Mapping Guide*
> ([github.com/ddd-crew/context-mapping](https://github.com/ddd-crew/context-mapping)); Eric Evans,
> *Domain-Driven Design* (Addison-Wesley, 2003), Chapter 14 *Maintaining Model Integrity*.
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

## The two definitions, and why they are two patterns

> **Open Host Service** — *"A protocol that gives access to your subsystem as a set of services. Open
> the protocol so that all who need to integrate with you can use it."*

> **Published Language** — *"Use a well-documented shared language that can express the necessary
> domain information as a common medium of communication."*

They are separable, and the pairs that are missing one are both recognisable failures:

| | Has a Published Language | No Published Language |
|---|---|---|
| **Has an Open Host Service** | ✅ The pattern, working | One public endpoint returning the internal model — a single door onto your database schema |
| **No Open Host Service** | Well-modelled contracts, one bespoke endpoint per consumer — the upstream's roadmap now belongs to its consumers | The default state: N endpoints, each shaped by whoever asked last |

🔴 **The interesting failure is the top-right cell**, because it looks like success. There is one
documented API, it is genuinely open to all comers, and what it publishes is the aggregate — so every
consumer is coupled to the internal model *and* the upstream can no longer change it, having promised
stability to everyone at once. Open Host without Published Language does not reduce coupling; it
industrialises it. That is why [28b · Never publish the aggregate](28b-never-publish-the-aggregate.md)
is a prerequisite for this pattern rather than an adjacent concern.

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

## What "open" commits you to

Opening a protocol *"so that all who need to integrate with you can use it"* is a promise with
consequences the upstream team usually discovers afterwards:

- **You no longer know all your consumers.** That is the point — it is what removes the negotiation
  cost — and it means you can never again establish that a field is unused by asking around. Evidence
  has to come from instrumentation, which is why the deprecation procedure in
  [28c · Changing a published contract](28c-changing-a-published-contract.md) requires logging on the
  field rather than a survey.
- **Compatibility becomes a policy, not a judgement call.** With three known consumers you can
  negotiate a breaking change. With unknown consumers you cannot, so the compatibility rules have to
  be written down and enforced mechanically.
- **The contract needs an owner who is not the busiest engineer.** An open protocol with no
  designated owner drifts back into bespoke endpoints within a year, because each individual
  exception is reasonable and nobody is accountable for the aggregate.

**The upside is exactly proportional:** the reason to accept all of that is that it converts an
O(consumers) integration cost into O(1). One contract, one compatibility promise, one place to change
— and consumers who need something different build their own
[29 · anticorruption layer](29-anticorruption-layer.md) rather than asking you to build it for them.

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

**★ Symptom: the API is documented, public and stable, and every consumer is still coupled to the internal schema.**
Cause: Open Host Service without Published Language. The protocol was opened; the vocabulary was
never authored, so what is published is the aggregate.
Fix: the two patterns are separable and you have adopted one of them. Author the contract types, and
recognise that the situation is worse than the bespoke-endpoint version it replaced — you have now
promised schema stability to consumers you cannot enumerate.

**★ Symptom: nobody can approve removing a field because nobody knows who reads it.**
Cause: this is not a defect, it is the pattern's defining property arriving. An open protocol means
the consumer list is unknown by design.
Fix: replace the survey with instrumentation. Log reads of the deprecated field, wait out a full
business cycle including monthly and quarterly jobs, and remove on evidence:
```java
if (request.fields().contains("legacyTotalAmount")) {
    log.info("deprecated-field-read field=legacyTotalAmount consumer={}", request.clientId());
}
```
🔴 A business cycle, not a sprint — the consumer that breaks is invariably the quarterly reconciliation
job nobody remembered.

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

**★ Open Host Service and Published Language are two patterns. What does having only one of them look like?**
Both single-pattern states are real and one of them is disguised as success. **Published Language
without Open Host** is well-modelled contracts served through a bespoke endpoint per consumer — the
vocabulary is right, the roadmap has been handed to the consumers, and the upstream maintains N
contracts. **Open Host without Published Language** is the dangerous one: a single documented API
genuinely open to all comers, publishing the internal aggregate. It passes every review — there is
one API, it is documented, it is stable — while coupling every consumer to the database schema and
simultaneously removing the upstream's ability to change it, because stability has now been promised
to consumers who cannot be enumerated. Open Host does not reduce coupling on its own; it
industrialises whatever coupling the contract already had.

**★ What does an upstream team give up by opening its protocol, and what does it get?**
It gives up knowing who its consumers are, which sounds abstract until the first deprecation: you can
no longer establish that a field is unused by asking around, so compatibility stops being a judgement
call and becomes a written policy enforced mechanically, and evidence for removal has to come from
instrumentation over a full business cycle. It also has to name an owner for the contract, because an
open protocol with no owner drifts back into bespoke endpoints within a year. What it gets in return
is exactly proportional: integration cost drops from O(consumers) to O(1) — one contract, one
compatibility promise, one place to change — and a consumer whose model differs builds its own
anticorruption layer instead of asking the upstream to build one for it.

**★ How does an Open Host Service handle breaking changes when additive evolution is no longer possible?**
When a breaking change is unavoidable, the OHS introduces a new major version path (e.g. `/public/v2/products`) or uses content negotiation (`Accept: application/vnd.retailer.catalog.v2+json`). Upstream runs both v1 and v2 simultaneously in production, using standard deprecation headers (`Sunset`) on v1 to give downstream consumers a multi-month window to migrate.

---

← [Shared kernel](33-shared-kernel.md) · [Topic index](README.md) · Next → [Partnership and separate ways](35-partnership-and-separate-ways.md)
