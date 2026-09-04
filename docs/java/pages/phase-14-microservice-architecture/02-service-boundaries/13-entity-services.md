---
title: "A service per entity looks like the most obvious decomposition available and Michael Nygard named it an anti-pattern for a precise reason: real features span entities, so entity services guarantee that every feature is a distributed operation across several of them"
sidebar_label: "13 · Entity services"
sidebar_position: 20
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Michael Nygard, *The Entity Service Antipattern* (2017)
> ([michaelnygard.com](https://www.michaelnygard.com/blog/2017/12/the-entity-service-antipattern/));
> microservices.io *Decompose by business capability*
> ([microservices.io](https://microservices.io/patterns/decomposition/decompose-by-business-capability.html))
> and *Self-contained Service*
> ([microservices.io](https://microservices.io/patterns/decomposition/self-contained-service.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**`CustomerService`, `OrderService`, `ProductService`, `AddressService`. It is the
decomposition that requires no analysis: you already have the entities, so make each one a
service. Nygard's argument against it is not aesthetic — it is that features are not shaped
like entities. Any interesting feature needs several of them, so an entity decomposition
converts every feature into a distributed operation, coupling the services both at runtime
and at design time, and delivering none of the independence the split was for.**

## The two couplings Nygard names

**Operational coupling.** A single request activates several services, so the request's
availability is the product of theirs and its latency is their sum. His worked example is
calculating the total price of a basket, which *"involves the cart, the products (for their
individual prices) and the account to find the applicable sales tax or VAT"* — three or four
services for one screen.

**Semantic coupling.** *"A change to any of the entity services has the potential to ripple
through into the online shopping service"*, because the consumer must understand each
entity's shape and must translate between them. The consumer accumulates the knowledge that
the entity services declined to hold.

The second is the one that kills you. Operational coupling shows up on a dashboard and can
be attacked with caching and batching. Semantic coupling shows up as a release calendar.

## The mechanism, in one sentence

An entity service exposes **fields** and no **decisions**. Every rule about those fields
therefore lives in the callers. With three callers, the rule exists three times. When it
changes, three teams change it, and one of them will be late.

That is the whole failure and it explains every symptom:

- Why entity services get chatty: callers must fetch everything, because the service cannot
  answer a question, only return rows.
- Why they never stabilise: every new consumer needs one more field, so the DTO grows
  forever.
- Why bugs cluster in consumers: the rules are there, duplicated, and the duplicates drift.
- Why the "orchestrator" appears: someone notices the rules are scattered and builds a
  service to hold them, which owns no data and can enforce nothing —
  [17 · The god service](17-the-god-service.md).

## The example, in Java

```java
// ANTI-PATTERN. Three entity services, and the pricing rule lives in the caller.
package com.retailer.checkout;

import org.springframework.stereotype.Service;

@Service
public class CheckoutService {

    private final CartClient carts;
    private final ProductClient products;
    private final AccountClient accounts;
    private final TaxClient tax;

    // constructor omitted

    /// Four remote calls, and — the real damage — the business rules about which price
    /// applies, whether the customer's segment discount stacks with a promotion, and
    /// how tax is computed for a mixed basket are all *here*, in a consumer that owns
    /// none of the data and speaks for none of the departments involved.
    public BasketTotal total(CartId cartId) {
        var cart = carts.get(cartId);
        var account = accounts.get(cart.accountId());
        var lines = cart.lines().stream()
                .map(line -> {
                    var product = products.get(line.productId());
                    var unit = account.segment() == Segment.TRADE
                            ? product.tradePrice()      // a pricing rule, in checkout
                            : product.listPrice();
                    return new PricedLine(line.productId(), line.quantity(), unit);
                })
                .toList();
        var net = lines.stream().map(PricedLine::lineTotal).reduce(Money.zero(), Money::plus);
        var vat = tax.calculate(net, account.taxJurisdiction());
        return new BasketTotal(net, vat, net.plus(vat));
    }
}
```

Count what is wrong. Four network calls per basket view. A pricing rule (`TRADE` uses trade
price) implemented in checkout, where Pricing cannot see it and will not know when it needs
changing. A tax jurisdiction read from an account entity, so the rule about which
jurisdiction applies is split between Accounts and Checkout. And a second consumer — the
mobile app's basket endpoint, or the quote generator, or the reorder flow — will implement
all of it again.

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

## Gotchas

**★ Symptom: a service whose API is a mirror of its table.** Cause: entity decomposition.
Fix: ask what the service can refuse, and why. If the answer is "nothing, except validation
of types", the rules are in the callers and the boundary is wrong.

**★ Symptom: the same business rule implemented in three consumers.** Cause: the service
that owns the data does not own the rule. Fix: move the rule into the owner and replace the
three implementations with one call. This is usually a bigger political change than a
technical one, because it removes autonomy from three teams.

**★ Symptom: a DTO that grows every sprint.** Cause: each new consumer needs a different
subset, so the response accretes fields. Fix: an entity service cannot escape this, because
it cannot know what the caller is asking; a capability service can, because the caller asks a
question rather than requesting a row.

**★ Renaming without reshaping.** `CustomerService` becoming `CustomerManagementService`, or
being described as "the customer capability", changes nothing. Judge the API, not the name.

**★ Symptom: an orchestrator appearing to hold rules that "do not fit anywhere".** Cause:
the entity services refused to hold them. Fix: the rules do fit somewhere — with the state
they constrain. The orchestrator is a symptom; deleting it without moving the rules just
scatters them again.

**★ Assuming the fix is fewer, larger entity services.** Merging `Customer` and `Address`
into one entity service produces a bigger entity service. The axis is wrong, not the
granularity; the fix is to reshape around capabilities.

**★ Accepting a CRUD API because it is "just for internal use".** Internal consumers
duplicate rules exactly as readily as external ones, and internal APIs are harder to remove
because nobody is versioning them.

## Interview questions

**★ What is the entity service anti-pattern and what specifically goes wrong?**
It is decomposing by data entity — a service per `Customer`, `Order`, `Product` — and the
problem is that features are not shaped like entities. Any real feature needs several, so
every feature becomes a distributed operation. Nygard names two consequences: operational
coupling, where one request activates several services so availability multiplies and latency
adds; and semantic coupling, where a change to any entity service ripples into its consumers.
The underlying mechanism is that an entity service exposes fields and no decisions, so the
rules about those fields live in the callers, duplicated once per caller, and they drift.

**★ How do you tell an entity service from a legitimate capability service?**
Ask what it can refuse and why. A capability service can reject an operation for a business
reason it owns — a price below the margin floor, a reservation exceeding available stock, a
cancellation of an already-dispatched order. An entity service can only reject malformed
input. A related test is whether the callers contain business logic about the returned data:
if the checkout code decides which of two prices applies, the pricing rule is in checkout,
which means the pricing service does not own pricing.

**★ Is a CRUD API ever acceptable for a service?**
Yes, when there genuinely are no domain rules — a media library, a document store, a settings
service. The test is whether anything anywhere can refuse a change for a business reason. If
nothing can, there is nothing to encapsulate and a CRUD API is honest rather than lazy. That
is essentially the definition of a generic subdomain, and those are usually bought rather
than built anyway. For anything in your core domain the answer is no, because core domains
are made of rules.

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

---

← [Splitting by layer](12-splitting-by-layer.md) · [Topic index](README.md) · Next → [CRUD is not a capability](13b-crud-is-not-a-capability.md)
