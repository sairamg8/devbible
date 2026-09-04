---
title: "Nygard names the disease and explicitly leaves the cure to a later post — the replacement for an entity service is not a bigger entity service or a renamed one, it is the smallest unit that enforces a business rule without asking anybody's permission"
sidebar_label: "13c · What to build instead"
sidebar_position: 23
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Michael Nygard, *The Entity Service Antipattern* (2017), at
> [michaelnygard.com](https://www.michaelnygard.com/blog/2017/12/the-entity-service-antipattern/) —
> 🔴 **cited for the diagnosis only; that post proposes no replacement and says so.** The replacement
> argued here follows from Vaughn Vernon, *Effective Aggregate Design* Parts I and II (2011), at
> [dddcommunity.org](https://www.dddcommunity.org/library/vernon_2011/) (CC BY-ND 3.0), and
> microservices.io *Decompose by business capability*
> ([microservices.io](https://microservices.io/patterns/decomposition/decompose-by-business-capability.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. Documentation-validated; **no sandbox run**.

**[13 · Entity services](13-entity-services.md) establishes what goes wrong and why the pattern keeps being rediscovered. It stops there deliberately, because its source does: Nygard's post ends with *"In a future post, we'll look at what to do instead of entity services"*, and a page that attributes a replacement to him is citing something that does not exist. This chunk is the replacement, argued from the criterion this topic has been building since [06 · Invariants are the criterion](06-invariants-are-the-criterion.md) — and the two answers teams reach for first, merging entities into bigger services and renaming them into capability-sounding services, are both worth ruling out explicitly, because each one preserves exactly the property that made the original wrong.**

## The capability version

```java
package com.retailer.pricing;

/// One call. The rule about trade pricing, segment discounts, promotion stacking and
/// tax is inside the service that owns those rules and can change them alone.
public interface BasketPricing {

    PricedBasket price(PriceBasketCommand command);
}
```

```java
package com.retailer.pricing;

import java.util.List;

/// The command carries facts the caller legitimately knows: what is in the basket and
/// who is buying. It does not carry prices, because prices are Pricing's answer, not
/// Pricing's input.
public record PriceBasketCommand(
        CustomerId customer,
        Channel channel,
        List<BasketLine> lines,
        List<PromotionCode> codes) {

    public record BasketLine(Sku sku, int quantity) { }
}
```

Now the trade-pricing rule lives in one place. Adding "trade customers get free delivery over
£500" is a change to Pricing and to nothing else, which is the entire objective.

Note also that Pricing became *self-contained* in microservices.io's sense — it can answer a
synchronous request *"without waiting for the response from any other service"*, because it
holds replicas of the product prices and customer segments it needs, updated by events. The
availability arithmetic that motivates that pattern is topic 04's, but the boundary decision
that makes it possible is this one.

## Why the mistake is so attractive

It is worth being sympathetic, because "don't do the obvious thing" is unhelpful without
knowing why the obvious thing looks right.

- **The entities already exist.** No analysis required, no meetings with domain experts, no
  arguments. A decomposition you can derive from the schema in an afternoon.
- **It looks like single responsibility.** Each service handles one thing. The
  misapplication is that "one thing" is being measured as one noun rather than one reason to
  change.
- **Frameworks make it a ten-minute job.** Spring Data REST, JPA repositories and generated
  scaffolding will produce a complete entity service before lunch. Nygard notes exactly this:
  *"Spring may give us the absolute easiest way to create an entity service."* The ease is
  part of the trap.
- **It is symmetrical, so it looks like design.** Fifteen services, all the same shape, tidy
  diagram.

## The one place entity-shaped services are fine

A **generic subdomain** that genuinely is storage — a document store, a media library, a
key-value settings service — can legitimately have a CRUD-shaped API, because there are no
domain rules to hold. The distinguishing feature is not the shape of the API; it is whether
any business rule exists about that data. If nothing anywhere can refuse a change to it for a
business reason, then there is nothing to encapsulate and CRUD is honest.

The failure is exclusively about entities with rules, which is every entity in your core
domain.

## The same problem one layer in: the anaemic model

A capability service with an anaemic domain model has moved the defect rather than fixed it — the
network boundary is now right and the rules are still outside the thing that owns the data.

An entity with only getters and setters is a service with only CRUD, at class scope: the
rules cannot live there because there is nowhere for them to live, so they migrate to a
"service" class, and from there to callers.

```java
// Anaemic: every rule about an order must be enforced by whoever holds one.
public class Order {
    private OrderStatus status;
    public OrderStatus getStatus() { return status; }
    public void setStatus(OrderStatus status) { this.status = status; }
}
```

```java
// Behavioural: the rule cannot be bypassed, because there is no setter to bypass it with.
public final class Order {

    private OrderStatus status;

    public Cancellation cancel(CancellationReason reason, Clock clock) {
        if (!status.allowsCancellation()) {
            throw new IllegalOrderTransition(status, OrderStatus.CANCELLED);
        }
        this.status = OrderStatus.CANCELLED;
        return new Cancellation(reason, clock.instant());
    }
}
```

The link to boundaries is direct: an anaemic model cannot be moved behind a network boundary
without its rules, because it has none. The refactor from anaemic to behavioural is the
preparation for a split, and it can be done entirely in-process before any boundary is drawn.

## Gotchas

**★ Assuming the fix is fewer, larger entity services.** Merging `Customer` and `Address`
into one entity service produces a bigger entity service. The axis is wrong, not the
granularity; the fix is to reshape around capabilities.

**★ Renaming without reshaping.** `CustomerService` becoming `CustomerManagementService`, or
being described as "the customer capability", changes nothing. Judge the API, not the name.

**★ Accepting a CRUD API because it is "just for internal use".** Internal consumers
duplicate rules exactly as readily as external ones, and internal APIs are harder to remove
because nobody is versioning them.

**★ Symptom: the domain object is a record with all fields public and no methods.** Cause:
anaemic model. Fix: records are excellent for values and for events; an aggregate root with
rules needs behaviour and controlled mutation, and making it a record is choosing
serialisability over enforceability.

## Interview questions

**★ How do you tell an entity service from a legitimate capability service?**
Ask what it can refuse and why. A capability service can reject an operation for a business
reason it owns — a price below the margin floor, a reservation exceeding available stock, a
cancellation of an already-dispatched order. An entity service can only reject malformed
input. A related test is whether the callers contain business logic about the returned data:
if the checkout code decides which of two prices applies, the pricing rule is in checkout,
which means the pricing service does not own pricing.

**★ Why do good teams keep building entity services?**
Because the entities already exist, so the decomposition needs no analysis; because it looks
like single responsibility if you measure "responsibility" in nouns rather than in reasons to
change; because the frameworks make it a ten-minute job — Nygard points at Spring
specifically as the easiest way to create one; and because the result is symmetrical, which
reads as design. The counter is not to argue about naming but to apply the change test: take
three recent features and count how many entity services each touched.

**★ You have an entity-service architecture in production. What is the migration?**
Not a rewrite. Find the rules that are duplicated across consumers — those are the highest
value and the clearest evidence — and move each into the service that owns the corresponding
state, replacing the duplicates with one call. Each move makes one service more capable and
several consumers simpler, and each is independently shippable. Over time the entity services
absorb the rules and become capability services, and the ones left holding nothing but fields
get merged into whichever capability uses them most. The orchestrator, if there is one,
shrinks as the rules leave it and is deleted last.

**★ Is an anaemic domain model a boundary problem or a code-style problem?**
Both, and the boundary consequence is the one that costs money. An entity with only getters
and setters has nowhere for rules to live, so they migrate outward — first into a "service"
class, then into callers. That means the state and the rules about it are already separated
before any network is involved, so drawing a service boundary around the state moves the
data and leaves the rules behind. The refactor from anaemic to behavioural is therefore
preparation for a split, and it is entirely in-process, which makes it cheap and reversible.

---

← [Migrating a public CRUD API](13d-migrating-a-public-crud-api.md) · [Topic index](README.md) · Next → [Conway and the org chart](14-conway-and-the-org-chart.md)
