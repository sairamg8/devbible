---
title: "An Anticorruption Layer isolates a pure domain model from an unruly external service — a dedicated adapter and translator that translates foreign concepts into your ubiquitous language at the boundary"
sidebar_label: "29 · Anticorruption layer"
sidebar_position: 42
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Eric Evans, *Domain-Driven Design* (Addison-Wesley), Chapter 14:
> Anticorruption Layer; Martin Fowler *Anticorruption Layer Pattern*
> ([martinfowler.com](https://martinfowler.com/bliki/AntiCorruptionLayer.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**When a clean downstream domain must integrate with a legacy monolith, an external vendor API, or an upstream service whose model is incompatible, adopting the upstream vocabulary directly poisons the downstream domain. Evans' Anticorruption Layer (ACL) is an architectural barrier composed of an interface (port), an external client (adapter), and a translation mechanism (translator). The ACL translates incoming and outgoing data between the foreign schema and your internal ubiquitous language. By confining all foreign quirks, legacy integer codes, and external payload structures strictly to this boundary layer, the downstream domain remains pure, decoupled, and completely insulated from changes in upstream systems.**

## The danger of semantic pollution

Without an Anticorruption Layer, the vocabulary of an external system leaks directly into your core business logic:

```java
// Anti-pattern: Domain logic polluted by foreign vendor concepts
if (legacyPayment.getRET_CODE_INT() == 1002 && legacyPayment.getFLAG_BYTE_7().equals("Y")) {
    order.setStatus(OrderStatus.PAID);
}
```

When you allow foreign concepts into your domain:
- **Linguistic confusion:** Your team stops speaking its own ubiquitous language and starts using an external vendor's idiosyncratic terminology.
- **Cascading fragility:** When the upstream vendor changes an API field name or replaces an integer code, dozens of domain classes break.
- **Vendor lock-in:** Swapping the vendor or replacing the legacy system requires rewriting core domain logic across the entire application.

The Anticorruption Layer eliminates this coupling by guaranteeing that foreign models never cross the boundary into your domain.

## The three components of an ACL

An Anticorruption Layer consists of three collaborating components:

```text
[ Downstream Domain Service ]
              │ (calls)
              ▼
    [ Domain Port (Interface) ] ◄── (defined in domain terms)
              ▲
              │ (implements)
[ Infrastructure Adapter ] ─────► [ External System Client ]
              │ (uses)
              ▼
    [ Model Translator ]
```

1. **Domain Port (Interface):** An interface defined inside the downstream bounded context, expressed exclusively in terms of the downstream domain's ubiquitous language.
2. **Infrastructure Adapter:** A class residing in the infrastructure layer that implements the domain port and manages the technical protocol (HTTP, gRPC, messaging) to the external system.
3. **Model Translator:** A dedicated mapping component that converts downstream domain commands into foreign request payloads, and translates foreign response structures into pure domain objects.

## Runnable Java implementation of an ACL

In this implementation, the downstream billing domain needs payment authorization from a legacy banking mainframe. The billing domain requires a clean, typed `PaymentResult`, while the bank speaks cryptic integer status codes and raw string tokens:

```java
package com.retailer.billing.domain;

import java.math.BigDecimal;
import java.util.UUID;

// 1. Domain Port: Expressed exclusively in downstream ubiquitous language
// src/main/java/com/retailer/billing/domain/PaymentGatewayPort.java
public interface PaymentGatewayPort {
    PaymentResult authorizePayment(UUID customerId, BigDecimal amount);
}

// src/main/java/com/retailer/billing/domain/PaymentResult.java
public record PaymentResult(
    boolean approved,
    String authorizationCode,
    DeclineReason declineReason
) {
    public static PaymentResult success(String authCode) {
        return new PaymentResult(true, authCode, null);
    }

    public static PaymentResult declined(DeclineReason reason) {
        return new PaymentResult(false, null, reason);
    }
}

// src/main/java/com/retailer/billing/domain/DeclineReason.java
public enum DeclineReason {
    INSUFFICIENT_FUNDS,
    EXPIRED_CARD,
    SUSPECTED_FRAUD,
    GATEWAY_ERROR
}
```

The adapter and translator reside in the infrastructure package, completely hidden from domain logic:

```java
package com.retailer.billing.infrastructure.bank;

import com.retailer.billing.domain.DeclineReason;
import com.retailer.billing.domain.PaymentGatewayPort;
import com.retailer.billing.domain.PaymentResult;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

// 2. Infrastructure Adapter: Implements domain port, manages wire communication
@Component
class LegacyBankPaymentAdapter implements PaymentGatewayPort {

    private final RestClient restClient;
    private final LegacyBankTranslator translator;

    LegacyBankPaymentAdapter(RestClient restClient, LegacyBankTranslator translator) {
        this.restClient = restClient;
        this.translator = translator;
    }

    @Override
    public PaymentResult authorizePayment(UUID customerId, BigDecimal amount) {
        LegacyBankRequest request = translator.toLegacyRequest(customerId, amount);

        LegacyBankResponse response = restClient.post()
            .uri("/api/v1/acquirer/authorize")
            .body(request)
            .retrieve()
            .body(LegacyBankResponse.class);

        return translator.toDomainResult(response);
    }
}

// 3. Model Translator: Absorbs all foreign naming quirks and integer code translations
@Component
class LegacyBankTranslator {

    LegacyBankRequest toLegacyRequest(UUID customerId, BigDecimal amount) {
        // Formats cents integer and customer account token
        long amountCents = amount.multiply(BigDecimal.valueOf(100)).longValue();
        return new LegacyBankRequest(customerId.toString(), amountCents, "ECOM_TX");
    }

    PaymentResult toDomainResult(LegacyBankResponse response) {
        if (response == null) {
            return PaymentResult.declined(DeclineReason.GATEWAY_ERROR);
        }

        // Translates legacy integer return codes into clean domain enums
        return switch (response.RET_CODE_INT()) {
            case 1000 -> PaymentResult.success(response.AUTH_STR_TOKEN());
            case 2001 -> PaymentResult.declined(DeclineReason.INSUFFICIENT_FUNDS);
            case 2002 -> PaymentResult.declined(DeclineReason.EXPIRED_CARD);
            case 3005 -> PaymentResult.declined(DeclineReason.SUSPECTED_FRAUD);
            default -> PaymentResult.declined(DeclineReason.GATEWAY_ERROR);
        };
    }
}

record LegacyBankRequest(String CUST_ACCT_NO, long TX_AMT_CENTS, String TX_TYPE) {}
record LegacyBankResponse(int RET_CODE_INT, String AUTH_STR_TOKEN, String FLAG_BYTE_7) {}
```

## The architectural payoff

- **Swappable implementations:** When the company switches from the legacy bank to Stripe, zero lines of domain logic change. You simply implement a `StripePaymentAdapter` that fulfills `PaymentGatewayPort`.
- **Independent testability:** Domain unit tests mock `PaymentGatewayPort` using clean domain objects, never needing to construct bizarre foreign legacy JSON payloads.
- **Explicit boundary ownership:** The translator is the only class in the entire application that knows how the external system works.

## Gotchas

**★ Symptom: External vendor exceptions (`StripeException`, `HttpClientErrorException`) leak into domain services.**
Cause: The adapter failed to catch and translate infrastructure-level network or vendor exceptions.
Fix: Catch all vendor exceptions inside the adapter and translate them into domain result types or typed domain exceptions.

**★ Symptom: The ACL translator grows into a god-class containing business validation and billing rules.**
Cause: Placing domain logic inside the translator instead of keeping it strictly focused on model mapping.
Fix: The translator must remain a pure, stateless translation function. Any decision about what to do with the translated data belongs in the domain service.

**★ Symptom: Bidirectional ACLs created where downstream translates upstream, and upstream also translates downstream.**
Cause: Lack of clear upstream/downstream role clarity.
Fix: An ACL belongs strictly to the downstream consumer protecting its own model. Upstream exposes a published language or raw contract.

**★ Symptom: Performance bottleneck caused by complex reflection-based object mappers inside the ACL.**
Cause: Using generic dynamic reflection mappers on every high-throughput request.
Fix: Write explicit, hand-crafted Java switch expressions and record constructors for zero-allocation, JIT-optimized mapping.

## Interview questions

**★ What is an Anticorruption Layer in Domain-Driven Design, and what problem does it solve?**
An Anticorruption Layer (ACL) is an architectural pattern that translates between two different domain models to prevent concepts, semantics, and technical quirks from an upstream system from polluting a downstream domain. It solves the problem of semantic coupling when integrating with legacy applications, third-party vendors, or poorly structured services, ensuring the downstream model remains expressive, cohesive, and independent.

**★ Which side of a bounded context relationship owns the Anticorruption Layer?**
The downstream system always owns the Anticorruption Layer. The downstream context is the one whose domain model requires protection from the upstream system's semantics. The ACL lives inside the downstream codebase as part of its infrastructure adapter layer.

**★ How does the Anticorruption Layer pattern relate to the Ports and Adapters (Hexagonal) architecture?**
An ACL is a direct application of Ports and Adapters. The domain defines a port (a clean Java interface expressed in domain terms), while the ACL serves as the adapter implementing that port. The adapter handles external network transport and utilizes a translator to map foreign data into the port's domain types before returning control to the core domain.

**★ When should a team choose a Conformist relationship instead of building an Anticorruption Layer?**
A team should choose Conformist when the upstream model is well-designed, industry-standard, and matches the downstream context's conceptual needs, or when the cost of translating between models exceeds the benefit of maintaining a distinct ubiquitous language. An ACL is justified when the upstream model is legacy, unstable, poorly designed, or semantically misaligned with the downstream domain.

---

← [Never publish the aggregate](28b-never-publish-the-aggregate.md) · [Topic index](README.md) · Next → [Where the ACL lives](29b-where-the-acl-lives.md)
