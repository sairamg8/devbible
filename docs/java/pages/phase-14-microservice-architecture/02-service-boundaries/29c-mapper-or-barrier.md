---
title: "Most Anticorruption Layers are field-for-field mappers wearing the pattern's name — a real one translates the upstream's concepts and its process, not merely its shapes, and the line that proves it is the branch handling a code the upstream has not invented yet"
sidebar_label: "29c · Mapper or barrier"
sidebar_position: 57
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Eric Evans, *Domain-Driven Design Reference* (2015),
> *Anticorruption Layer* and *Conformist*, reproduced verbatim in the ddd-crew *Context Mapping Guide*
> ([github.com/ddd-crew/context-mapping](https://github.com/ddd-crew/context-mapping)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. Documentation-validated; **no sandbox run**.

**An Anticorruption Layer is easy to name and hard to actually build, because the thing most teams ship instead — a class that converts `VendorPaymentDto` into `PaymentDto` field by field — is indistinguishable from the real pattern in a code review and provides almost none of its value. The upstream's vocabulary survives under new names, replacing the vendor still means editing domain services, and the vendor's multi-step protocol is still being sequenced by your domain under different method names. This chunk is the three questions that separate a barrier from a rename, the single branch that decides whether the layer holds when the upstream changes, and the three situations in which the honest answer is not to build one at all.**

## The test that tells you the ACL is real

Field-for-field mappers are the common failure, and they pass every review because they look like the
pattern. Three questions separate a translation from a rename:

1. **Does a vendor concept appear in your domain's vocabulary anywhere past the layer?** Search for
   the vendor's nouns in your domain package. `SETTLEMENT_BATCH`, `RET_CODE`, `merchantRef` — one hit
   is a leak.
2. **Could you swap the upstream for a different vendor by writing one new adapter?** If replacing
   the vendor means touching domain services, the layer is a mapper, not a barrier.
3. **Does the layer collapse the upstream's *process* as well as its *shape*?** This is the one people
   miss. A vendor that requires authorise-then-capture, when your domain has one concept called
   "take payment", should have that sequencing hidden **inside** the adapter:

```java
// Leaked process: the domain now knows the vendor's two-step protocol
paymentPort.authorise(orderId, amount);
paymentPort.capture(orderId);

// Translated process: the domain has one concept; the adapter owns the sequence
paymentPort.charge(orderId, amount);
```

```java
// src/main/java/com/retailer/billing/adapter/LegacyPaymentAdapter.java
package com.retailer.billing.adapter;

import com.retailer.billing.domain.PaymentGatewayPort;
import com.retailer.billing.domain.PaymentResult;
import com.retailer.billing.domain.DeclineReason;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
class LegacyPaymentAdapter implements PaymentGatewayPort {

    private final LegacyGatewayClient legacy;

    LegacyPaymentAdapter(LegacyGatewayClient legacy) {
        this.legacy = legacy;
    }

    @Override
    public PaymentResult charge(UUID orderId, BigDecimal amount) {
        // The vendor's two-step protocol never leaves this method.
        LegacyResponse authorised = legacy.authorise(orderId.toString(), amount.movePointRight(2).longValueExact());
        if (authorised.getRET_CODE_INT() != 1002) {
            return PaymentResult.declined(translate(authorised.getRET_CODE_INT()));
        }
        LegacyResponse captured = legacy.capture(authorised.getAUTH_REF_STR());
        return captured.getRET_CODE_INT() == 1002
            ? PaymentResult.settled(captured.getAUTH_REF_STR())
            : PaymentResult.declined(translate(captured.getRET_CODE_INT()));
    }

    // The vendor's integer codes become domain reasons here, and nowhere else.
    private DeclineReason translate(int retCode) {
        return switch (retCode) {
            case 2001, 2004 -> DeclineReason.INSUFFICIENT_FUNDS;
            case 3010       -> DeclineReason.CARD_EXPIRED;
            case 4002       -> DeclineReason.SUSPECTED_FRAUD;
            default         -> DeclineReason.UNKNOWN;
        };
    }
}
```

🔴 **The `default -> UNKNOWN` branch is the ACL's most important line and the easiest to get wrong.**
An unrecognised upstream code must map to a domain concept, not propagate as an integer and not throw
a vendor exception. The alternative — letting the unknown code escape — reintroduces the coupling the
entire layer exists to prevent, at exactly the moment the upstream changed.

## When an ACL is the wrong answer

The pattern has a real cost, and it is not always the right trade. Three cases where it is not:

| Situation | Better answer | Why |
|---|---|---|
| Upstream is a well-designed industry standard, and downstream is a supporting subdomain | **Conformist** | Translating Stripe's `Charge` into your synonym for `Charge` is negative value — see [32 · Conformist](32-conformist.md) |
| You have genuine leverage over the upstream team | **Customer-supplier** | Get the contract changed instead of translating it forever — [31 · Customer-supplier](31-customer-supplier.md) |
| The integration exists to satisfy one monthly report | **Separate ways** | An ACL is a permanent asset with permanent maintenance; a scheduled export is not — [35 · Partnership and separate ways](35-partnership-and-separate-ways.md) |

And one case where the ACL is right but **temporary**: during a strangler migration, the ACL is what
lets the new service speak its own language while the monolith still speaks the old one. It is
scheduled for deletion the day the legacy path is retired — see
[41 · Strangler extraction](41-strangler-extraction.md). An ACL with no retirement condition written
down tends to acquire one by accident, usually a bad one.

## Gotchas

**★ Symptom: the upstream adds a status code, and the downstream domain starts throwing on it.**
Cause: the translator has no total mapping — an unrecognised code escapes as an integer, or as a
vendor exception, and reaches domain code that has no concept for it.
Fix: make the translation total. Every unknown upstream value maps to a domain value, and the fact
that it was unknown is logged at the boundary rather than thrown past it:
```java
default -> {
    log.warn("Unmapped upstream decline code {} — treating as UNKNOWN", retCode);
    yield DeclineReason.UNKNOWN;
}
```
🔴 A partial translation is worse than no ACL, because it works until the upstream changes and then
fails inside your domain, which is precisely the place the layer was built to protect.

**★ Symptom: the ACL translates the vendor's types faithfully and the domain still knows how the vendor works.**
Cause: shape was translated and *process* was not. The port exposes `authorise` and `capture` because
the vendor does, so the domain is sequencing the vendor's protocol under different names.
Fix: the port's methods are named for what the *domain* wants done. Multi-step upstream protocols
collapse into one domain operation inside the adapter:
```java
public interface PaymentGatewayPort {
    PaymentResult charge(UUID orderId, BigDecimal amount);   // one domain concept
}
```

**★ Symptom: the ACL is still there four years after the legacy system it insulated was decommissioned.**
Cause: nobody wrote down what would make it unnecessary, so nothing ever triggered its removal.
Fix: an ACL built for a migration gets a retirement condition recorded next to it — *"delete when the
last route leaves the monolith"* — and one built against a permanent third party gets an explicit
note that it is permanent. The two are different assets and confusing them is how a temporary layer
becomes a fixture with no owner.

## Interview questions

**★ What is the difference between an Anticorruption Layer and a mapper?**
A mapper translates *shapes*; an ACL translates *concepts*, and the distinction shows up in three
places. After a mapper the upstream's vocabulary still appears in your domain under new names; after
an ACL it appears nowhere past the boundary. After a mapper, replacing the vendor means touching
domain code; after an ACL it means writing one new adapter. And a mapper preserves the upstream's
process — if the vendor needs authorise-then-capture, your domain still performs two steps — where an
ACL collapses that sequence inside the adapter so the domain has the single concept it actually
wanted. A field-for-field mapper that passes review as an ACL is the most common way this pattern is
adopted in name only.

**★ Why is a total translation — every unknown upstream value mapped to a domain value — a hard requirement rather than a nicety?**
Because a partial translation defers the coupling to the worst possible moment. While the upstream is
stable it behaves exactly like a complete one, so nothing reveals the gap; the day the upstream adds
a status code, an unmapped integer or a vendor exception travels past the layer into domain code that
has no concept for it. The failure then happens inside the region the ACL exists to protect, which is
both the hardest place to diagnose it and the place you specifically paid to keep clean. Mapping the
unknown to an explicit `UNKNOWN` and logging it at the boundary turns an upstream change from an
incident into a warning line.

**★ When should a team choose a Conformist relationship instead of building an Anticorruption Layer?**
A team should choose Conformist when the upstream model is well-designed, industry-standard, and matches the downstream context's conceptual needs, or when the cost of translating between models exceeds the benefit of maintaining a distinct ubiquitous language. An ACL is justified when the upstream model is legacy, unstable, poorly designed, or semantically misaligned with the downstream domain.

---

← [Where the ACL lives](29b-where-the-acl-lives.md) · [Topic index](README.md) · Next → [Context mapping](30-context-mapping.md)
