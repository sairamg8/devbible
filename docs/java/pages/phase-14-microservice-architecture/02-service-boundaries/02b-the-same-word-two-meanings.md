---
title: "When the same noun means different things to two groups of people, you have found a boundary that already exists — your only decision is whether the code admits it"
sidebar_label: "02b · The same word, two meanings"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Martin Fowler, *BoundedContext*
> ([martinfowler.com](https://martinfowler.com/bliki/BoundedContext.html)) and
> *MultipleCanonicalModels* as referenced there; Eric Evans, *Domain-Driven Design* (2003),
> Ch. 14, cited by concept. Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 ·
> Spring Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**Polysemy — one word, several meanings — is the cheapest and most reliable boundary
detector available, and it needs no tooling. Sit in two teams' stand-ups for a week and
write down every noun that appears in both. The ones where the two teams' definitions do
not match are context edges, and they are edges whether or not you draw them. The only
question is whether your type system reflects them or fights them.**

## The retailer's four `Product` types

A single mid-sized retailer, one product catalogue, four groups of people:

| Context | What "product" means | What identifies it | What must be true |
|---|---|---|---|
| **Catalogue** | A marketing entity: a name, images, copy, a category, an SEO slug | Catalogue id | It has publishable copy in every enabled locale |
| **Pricing** | A thing with a price list, per currency, per channel, with effective dates | SKU + channel | Exactly one price is effective at any instant per channel |
| **Inventory** | A physically countable item at a location | SKU + warehouse | On-hand minus reserved is never negative |
| **Fulfilment** | A thing with a weight, dimensions, and hazard class that constrains carriers | SKU | Every shippable item has dimensions and a hazard classification |

Four models, four identities, four invariants, and none of the invariants is expressible in
another context's model. Catalogue's rule about locale copy is meaningless to Inventory.
Inventory's non-negative rule is meaningless to Catalogue. And **the identity is not even
the same**: a Catalogue product is one row with many SKUs beneath it (colours, sizes), so
"the product" in Catalogue is a *parent* of "the product" in Inventory.

That last point is the giveaway that most often gets missed. When two groups disagree about
the *cardinality* of a concept — one thing here is three things there — no shared class can
be correct. A shared `Product` with a nullable `variantOf` field forces every consumer to
know which shape it is holding, at runtime, forever.

## The bundle case, which breaks every unified model

Add one realistic requirement: the retailer sells a bundle — a camera, a lens and a bag,
one price, one line on the order.

- **Catalogue** says a bundle is a product. It has a page, a name, images.
- **Pricing** says a bundle is a product with its own price, unrelated to the sum of its
  parts.
- **Inventory** says a bundle is *not* a product at all. There is no bundle on a shelf.
  There are three items, and the bundle is available if and only if all three are.
- **Fulfilment** says a bundle might be one parcel or three, depending on dimensions.

There is no set of fields that makes one class true in all four places. A unified `Product`
must carry `isBundle`, `bundleComponents`, and a documented rule saying "Inventory: ignore
rows where `isBundle` is true and expand `bundleComponents` instead". That documented rule
is a translation. You have written an anticorruption layer; you have merely written it as a
comment and put it in the wrong place.

## What this looks like in Java when you admit it

```java
package com.retailer.catalogue;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/// Catalogue's product: a marketed thing. It has variants; it does not have stock.
public record CatalogueProduct(
        CatalogueProductId id,
        Map<Locale, ProductCopy> copy,
        List<Sku> variants,
        CategoryPath category,
        PublicationState state) {

    public boolean publishableIn(Locale locale) {
        return state == PublicationState.APPROVED && copy.containsKey(locale);
    }
}
```

```java
package com.retailer.inventory;

/// Inventory's product: a countable thing at a place. It has no name and no pictures.
/// Note the invariant lives in the type, and only makes sense here.
public final class StockItem {

    private final Sku sku;
    private final WarehouseId warehouse;
    private int onHand;
    private int reserved;

    public void reserve(int quantity) {
        if (quantity <= 0) {
            throw new IllegalArgumentException("quantity must be positive");
        }
        if (available() < quantity) {
            throw new InsufficientStockException(sku, warehouse, quantity, available());
        }
        this.reserved += quantity;
    }

    public int available() {
        return onHand - reserved;
    }
}
```

`Sku` appears in both, and that is fine — it is an identifier, a shared *value*, not a
shared model. Sharing identifiers across contexts is normal and necessary; sharing
behaviour and rules across contexts is what destroys boundaries. The distinction is drawn
carefully in [28 · Published language vs aggregate](28-published-language-vs-aggregate.md).

## Where the shared identifier is also a lie

Occasionally the identifier itself is polysemic, and this is the nastiest version of the
problem because it looks like agreement. Two contexts both say "the order id", and one
means the id the customer sees on the confirmation email while the other means the id the
warehouse management system assigned. Both are strings. Both are called `orderId`. They are
not equal, and the code will happily compare them.

The fix is typed identifiers, not documentation:

```java
package com.retailer.sales;

/// A customer-facing sales order number. Not interchangeable with anything else,
/// because the compiler will not let it be.
public record SalesOrderNumber(String value) {
    public SalesOrderNumber {
        if (value == null || !value.matches("SO-\\d{9}")) {
            throw new IllegalArgumentException("not a sales order number: " + value);
        }
    }
}
```

```java
package com.retailer.fulfilment;

/// The warehouse system's own reference. Correlated with a SalesOrderNumber
/// by an explicit mapping, never by assignment.
public record WarehouseJobRef(String value) { }
```

Records with compact constructors are cheap enough on JDK 25 that there is no excuse for a
bare `String` identifier crossing a context edge. The moment both are `String`, a wrong
assignment is a runtime incident in a system nobody has looked at for eight months.

## The status field as a polysemy detector

If one concept has a single `status` enum with more than about eight values, read the values
out loud and ask who cares about each one. A real example shape:

```java
// A status enum that is three contexts wearing one hat.
public enum OrderStatus {
    DRAFT, PLACED, PAYMENT_PENDING, PAYMENT_FAILED, PAID,     // Sales + Billing
    AWAITING_STOCK, PICKING, PACKED, HANDED_TO_CARRIER,       // Fulfilment
    DELIVERED, RETURN_REQUESTED, RETURNED, REFUNDED           // Fulfilment + Billing
}
```

Nobody owns this enum. Adding a value requires a conversation with three teams, every
consumer's `switch` must handle it, and — the specific damage — every consumer must
*ignore* two thirds of the values, which means every consumer contains a mapping from this
enum to the two or three states it actually cares about. Those mappings are the translation
layers again, scattered and unnamed.

The version that admits the boundary:

```java
// com.retailer.sales
public enum SalesOrderStatus { DRAFT, PLACED, CANCELLED, COMPLETED }

// com.retailer.billing
public enum PaymentStatus { PENDING, AUTHORISED, CAPTURED, FAILED, REFUNDED }

// com.retailer.fulfilment
public enum ShipmentStatus { AWAITING_STOCK, PICKING, PACKED, DISPATCHED, DELIVERED }
```

Each is small, each is owned, each changes for one reason. Sales' `COMPLETED` is derived
from an event Fulfilment publishes; it is not the same value and it is not shared.

## Gotchas

**★ Symptom: a class whose fields are half null at any moment.** Cause: it is carrying two
contexts' worth of state. Fix: split the type along the null groups. If `shippedAt`,
`carrier` and `trackingNumber` are null for every unshipped order and `invoiceNumber` is
null for every unbilled one, those are two other contexts' fields sitting in your class.

**★ Symptom: a method with a comment explaining which callers should ignore the result.**
Cause: the method is correct in one context and misleading in another. Fix: it belongs in
one of them, and the other gets a translated view.

**★ Symptom: a `type` or `kind` discriminator that every consumer switches on.** Cause: one
class is impersonating several. Fix: sealed interface with distinct record implementations
inside the owning context, and a separate translation for each consumer — or, more often,
separate types in separate contexts entirely.

**★ The "we'll just add a field" reflex.** Every context edge you refuse to draw arrives as
a request to add one more field to a shared type. Individually each request is trivially
reasonable; the tenth one produces a class nobody understands. Count the fields added to
your core types over the last year and ask who asked for each. Requests clustering by
requester are a boundary.

**★ Assuming shared identifiers imply a shared model.** Two contexts referring to the same
SKU does not mean they should share a `Product` class, any more than two people referring
to the same person means they know the same facts about them. Identity is a correlation
mechanism; it is not a model.

**★ Renaming instead of splitting.** Teams sometimes "solve" polysemy by picking one
winning name — everybody must now say "commercial order". This does not work, because the
other team keeps saying "order" in every conversation, and now the code and the speech
disagree, which is the exact failure ubiquitous language is meant to prevent. Let each
context keep its natural word inside its own boundary, and translate at the edge.

## Interview questions

**★ How do you find bounded contexts without doing a six-week modelling exercise?**
Listen for polysemy. Collect the nouns two teams both use, and get each team to define them
and, more usefully, to name a case where the thing does *not* count. Where the definitions
or the exclusions differ, there is a context edge. It costs a few conversations and it finds
the real edges faster than an entity-relationship diagram, because an ERD flattens the
disagreement into nullable columns instead of surfacing it.

**★ Two teams disagree about what "active customer" means. What do you do?**
Not arbitration. Write down both definitions, confirm both are legitimate for their
purpose — Marketing's "bought in 90 days" and Support's "has an open contract" are both
correct — and then treat that as evidence of two contexts. Each owns its own predicate in
its own model, and if one needs the other's answer it asks across an explicit interface. The
failure mode is forcing a single definition, which means one team's reports silently become
wrong and they build a shadow query to fix it.

**★ Isn't having `Customer` in four packages just duplication that will drift?**
It will drift, and that is the point — they are supposed to drift, because they model
different things that change for different reasons. The duplication that hurts is duplicated
*rules*: two places both deciding whether an order can be cancelled. Duplicated *shape* —
four types that each happen to have a name and an email — is cheap and is the price of
independence. Judge duplication by whether a change to a business rule requires editing more
than one place, not by whether two classes look similar.

**★ When is a shared type across contexts actually correct?**
When it is a value with no behaviour that belongs to any context: `Money`, `Sku`,
`CountryCode`, `Instant`. These are candidates for a published language or a small shared
kernel, and even then they need a named owner and a versioning policy, because a change to
`Money`'s rounding rule is a change to everything. The rule of thumb: share vocabulary,
never share rules. Anything with an `if` in it that encodes a business decision is not
shareable.

**★ A single `OrderStatus` enum has 14 values and three teams need to add to it. What is
the actual problem and what is the fix?**
The problem is that the enum is a shared model with no owner, so adding a value is a
three-team change and every consumer must handle values that mean nothing to it — the
Common Closure Principle inverted. The fix is one status enum per context, each small and
owned, with the derived states computed from events at the edge: Fulfilment publishes
`ShipmentDispatched`, Sales maps that to its own `COMPLETED` when it also has payment
capture. Each team then adds values without asking anyone, which is precisely what the
boundary was supposed to buy.

---

← [Bounded context](02-bounded-context.md) · [Topic index](README.md) · Next → [The language tells you](02c-the-language-tells-you.md)
