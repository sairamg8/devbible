---
title: "Partnership and Separate Ways represent the two extremes of context mapping — intense mutual coordination where failure of one is failure of both versus total disconnection where duplication is welcomed to preserve autonomy"
sidebar_label: "35 · Partnership and separate ways"
sidebar_position: 58
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Eric Evans, *Domain-Driven Design Reference* (2015), *Partnership*
> and *Separate Ways*, reproduced verbatim in the ddd-crew *Context Mapping Guide*
> ([github.com/ddd-crew/context-mapping](https://github.com/ddd-crew/context-mapping)). 🔴 *Partnership*
> is **not** in *Domain-Driven Design* (Addison-Wesley, 2003) — only *Separate Ways* is, in Chapter 14
> *Maintaining Model Integrity*.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**At the two outer poles of context mapping lie Partnership and Separate Ways—the maximum and minimum degrees of organizational coupling. In a Partnership, two teams bind their delivery roadmaps together: neither can succeed without the other, requiring synchronized sprint cadences, joint API design, and coordinated deployments. At the opposite extreme, Separate Ways is an intentional architectural decision to refuse technical integration altogether: teams determine that the operational, cognitive, and coordination costs of connecting their systems exceed the business value of shared data, choosing code duplication or manual handoffs to preserve absolute autonomy. Both patterns are legitimate architectural choices when chosen deliberately, and both become catastrophic failures when fallen into by accident.**

## The spectrum of coupling

Context mapping patterns exist on a spectrum defined by coordination cost:

```text
Maximum Coordination ◄────────────────────────────────────────► Zero Coordination
    [ Partnership ]    [ Customer-Supplier ]    [ Conformist / ACL ]    [ Separate Ways ]
   (Symmetric lock)      (Asymmetric power)      (Insulated translation)    (Zero contact)
```

Architects frequently resist both extremes:
- They resist **Separate Ways** due to an ideological obsession with DRY (Don't Repeat Yourself), believing that any duplicated concept across an enterprise represents an engineering failure.
- They resist **Partnership** because microservice dogma insists that services must always be autonomous and decoupled, refusing to admit when two teams are fundamentally co-dependent.

## Pattern 1: Partnership (Symmetric Co-dependence)

Evans defines Partnership as:

> *"Where development failure in either of two contexts would result in delivery failure for both, forge a partnership between the teams in charge of the two contexts."*

🔴 **Do not go looking for this one in the 2003 book — it is not there.** Partnership is one of
the patterns Evans added in the *Domain-Driven Design Reference* (2015), alongside Big Ball of
Mud. Chapter 14 of *Domain-Driven Design* has Shared Kernel, Customer/Supplier, Conformist,
Anticorruption Layer, Separate Ways, Open Host Service and Published Language, and no Partnership.
A great many context-mapping articles cite it to Chapter 14 anyway; if you are checking this page
against a source, check it against the Reference.

The Reference entry names the mechanism, and it is two obligations rather than a sentiment:
institute a process for **coordinated planning** of development, and **joint management of
integration**.

### Key dynamics of Partnership

1. **Equal authority:** Neither team is upstream. Neither team can unilaterally change an API, alter a data representation, or cancel a joint milestone.
2. **Synchronized sprint cycles:** Backlogs are refined together. If Team A cannot deliver its side of a feature in Sprint 24, Team B cannot ship its side either.
3. **Shared continuous integration:** Joint integration test suites run against both codebases in CI, guaranteeing that breaking interface changes are caught before merging.

### The scaling ceiling of Partnership

Partnership works effectively between **two** closely aligned teams within the same business unit. However, Partnership fails to scale to three or more teams. Because communication paths scale quadratically — `n(n-1)/2`, so two teams have one path, three have three, four have six — a three-way partnership requires continuous multi-team alignment meetings, paralyzing engineering velocity.

## Pattern 2: Separate Ways (Deliberate Independence)

Evans defines Separate Ways as:

> *"Declare a bounded context to have no connection to the others at all, allowing developers to find simple, specialized solutions."*

### When Separate Ways is the superior strategy

1. **Integration costs exceed business value:** Building, testing, and operating a distributed API integration (networks, retries, security, monitoring) costs tens of thousands of dollars annually. If data is shared once a month for a report, a manual CSV export is vastly cheaper.
2. **Specialized or regional tools:** A short-lived regional marketing campaign requires a bespoke customer entry form. Integrating it with the global enterprise Customer Service takes four months; building a standalone database with duplicate fields takes three days.
3. **Legacy integration deadlocks:** A legacy system is too fragile to modify, and building an Anticorruption Layer requires reverse-engineering undocumented binary formats. Going Separate Ways decouples modern services from the legacy risk.

## Runnable Java implementation: The contrast in code

In a **Partnership**, teams share explicit synchronized event contracts verified by joint contract tests:

```java
package com.retailer.partnership.contract;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

// Partnership: Jointly agreed, co-owned contract verified in both teams' CI
public record OrderFulfillmentHandshake(
    UUID orderId,
    UUID fulfillmentCenterId,
    BigDecimal totalWeightKg,
    Instant scheduledDispatch
) {
    public OrderFulfillmentHandshake {
        if (orderId == null || fulfillmentCenterId == null) {
            throw new IllegalArgumentException("Handshake identifiers cannot be null");
        }
    }
}
```

In **Separate Ways**, an independent marketing domain maintains its own specialized customer snapshot, intentionally refusing to query or integrate with the enterprise `Customer` service:

```java
package com.retailer.marketing.campaign;

import java.util.UUID;

// Separate Ways: Independent localized model. Zero network calls to Customer Service.
public record CampaignLead(
    UUID leadId,
    String email,
    String promoCode,
    boolean optedIn
) {
    // Localized logic: Marketing owns its own storage, lifecycle, and validation
    public boolean isValidForDiscount() {
        return optedIn && promoCode != null && promoCode.startsWith("FALL_");
    }
}
```

The Marketing service has zero dependencies, zero network latency and zero shared libraries, and its availability is entirely independent of whether the enterprise Customer service is up.

## Separate Ways has one precondition, and it is not "the data is unimportant"

The pattern reads as permission to duplicate, and teams reach for it when integration looks
expensive. The definition's actual permission is narrower — *"Declare a bounded context to have no
connection to the others at all"* — and "no connection" is a strong claim with a precondition:

🔴 **The two contexts must not need to agree.** Not "rarely need to agree", not "agree via a nightly
job". If a discrepancy between the two copies is ever an incident, you have not gone separate ways;
you have built an undocumented integration whose reconciliation mechanism is a human noticing.

| Situation | Separate Ways? | Why |
|---|---|---|
| A campaign micro-site's contact list vs the CRM | ✅ | Nobody reconciles them, and nobody would want to |
| Product names in a marketing page vs the catalogue | ✅ | Drift is visible, cosmetic and self-correcting |
| Customer address in billing vs in shipping | ❌ | A discrepancy is a misdelivered parcel — they must agree |
| A financial figure duplicated in two reports | 🔴 | Two numbers for one fact is the worst outcome available; someone will act on the wrong one |

**The tell that Separate Ways was misapplied** is a reconciliation report. The moment somebody builds
a job that compares the two copies and flags differences, the contexts *are* connected — badly,
asynchronously, and with no owner. That is the point to convert the relationship into a real one:
Customer/Supplier if leverage exists, ACL if it does not.

## Gotchas

**★ Symptom: Two teams in a "Partnership" spend more of every sprint coordinating with each other than delivering.**
Cause: The boundary was drawn in the wrong place. The two bounded contexts are actually a single aggregate or bounded context split across two teams.
Fix: Merge the teams or the services into a single deployable unit, eliminating the cross-boundary coordination penalty.

**★ Symptom: Building a complex REST and Kafka integration pipeline for a feature used once a quarter.**
Cause: Dogmatic avoidance of Separate Ways.
Fix: Sever the integration. Go Separate Ways, and satisfy the quarterly requirement with an automated file export or manual reconciliation.

**★ Symptom: Applying Separate Ways to core financial or compliance data.**
Cause: Misunderstanding the limits of Separate Ways. Financial ledger entries and regulatory compliance must be consistent across the enterprise.
Fix: Financial facts must be integrated via Open Host Service or Published Language.

**★ Symptom: a reconciliation report exists between two contexts that officially went Separate Ways.**
Cause: the two copies do need to agree after all, and the disagreement is being managed by a report
someone reads rather than by an integration someone owns.
Fix: the report is the evidence that the pattern was misapplied. Convert the relationship into one
that has an owner — Customer/Supplier if the downstream has leverage, an ACL if it does not — and
delete the report. 🔴 A reconciliation job is an integration with no contract, no compatibility
promise and no on-call, which is strictly worse than the integration it was avoiding.

**★ Symptom: two Separate Ways contexts hold a financial figure, and the two numbers differ.**
Cause: Separate Ways was applied to data where a discrepancy is not drift but a defect. Duplication is
safe for facts nobody reconciles; it is dangerous for facts somebody will act on.
Fix: one owner per fact, always — the ownership register in
[10b · The ownership register](10b-the-ownership-register.md). One context holds the number and the
other reads it or holds a clearly-labelled projection of it. Two authoritative copies of one figure
is the outcome the pattern is least suited to.

**★ Symptom: An executive declares a "Partnership" between a dominant internal team and a subordinate team.**
Cause: Pretending an asymmetric relationship is symmetric.
Fix: Recognize reality: if one team holds all the leverage, the relationship is Customer-Supplier or Conformist.

## Interview questions

**★ What is the Partnership pattern in Domain-Driven Design, and what are its operational costs?**
Partnership is a symmetric context mapping pattern where two teams coordinate their development roadmaps, release cadences, and interface contracts as equal partners. Its operational costs are high: neither team can deliver features independently, requiring joint sprint planning, synchronized deployments, and shared integration test pipelines. It should only be used between two closely aligned teams developing co-dependent core capabilities.

**★ Why is "Separate Ways" considered an intentional architectural pattern rather than an integration failure?**
Separate Ways acknowledges that integration is expensive, introducing network latency, failure modes, contract evolution costs, and operational coupling. When the business value of sharing data between two domains is negligible compared to the overhead of building and maintaining an API integration, choosing not to integrate preserves total team autonomy, simplifies codebases, and eliminates cross-service downtime.

**★ How do you determine whether two teams should form a Partnership or merge their codebases?**
If two teams find that almost every user story requires joint planning, synchronized pull requests, and lockstep deployments, the boundary between them is false. The two domains share invariants that cannot be separated. The correct solution is to merge the two teams and codebases into a single bounded context rather than maintaining the illusion of separate microservices.

**★ What is the precondition for Separate Ways, and what is the tell that it was misapplied?**
The precondition is that the two contexts genuinely do not need to agree — the definition's *"no
connection to the others at all"* is a strong claim, and it fails the moment a discrepancy between the
two copies would count as an incident. The tell is a **reconciliation report**: as soon as somebody
builds a job comparing the two copies and flagging differences, the contexts are connected after all,
just asynchronously and with nobody accountable for the connection. At that point the honest move is
to convert the edge into a real relationship with an owner, because a reconciliation job is an
integration with no contract, no compatibility promise and no on-call rota.

**★ What are the risks of using Separate Ways for domain data?**
The primary risk is data inconsistency and divergence. If both contexts duplicate mutable domain facts without a reconciliation mechanism, customer records or inventory figures can drift apart, leading to customer confusion or accounting discrepancies. Separate Ways is best suited for ephemeral, supporting, or read-only domain representations.

---

← [Open host and published language](34-open-host-and-published-language.md) · [Topic index](README.md) · Next → [Choosing a relationship](36-choosing-a-relationship.md)
