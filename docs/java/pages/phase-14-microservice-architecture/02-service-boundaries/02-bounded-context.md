---
title: "A bounded context is a region inside which one model and one vocabulary are true, and its real boundary is the point at which people start meaning different things by the same word"
sidebar_label: "02 · Bounded context"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Martin Fowler, *BoundedContext*
> ([martinfowler.com](https://martinfowler.com/bliki/BoundedContext.html)); Eric Evans,
> *Domain-Driven Design* (2003), Part IV "Strategic Design", cited by concept; and
> microservices.io *Decompose by subdomain*
> ([microservices.io](https://microservices.io/patterns/decomposition/decompose-by-subdomain.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**The single most useful idea in this topic is that there is no such thing as "the Customer
model". There are as many customer models as there are groups of people who use the word,
and the attempt to build one that satisfies all of them is the origin of most enterprise
software misery. A bounded context is the region — of code, of team, of conversation —
inside which one specific model of `Customer` is correct, complete and unambiguous. Outside
it, the model is not merely inconvenient; it is wrong, because the word means something
else there. Services fall out of contexts far more often than contexts fall out of
services.**

## The claim Evans is actually making

Domain-Driven Design's strategic half opens with a concession that most architecture
documents never make. Fowler states it directly:

> *"total unification of the domain model for a large system will not be feasible or
> cost-effective"*

That is a claim about *cost*, not about taste. Unifying a model across two groups who use
the same words differently does not fail because the modellers were lazy; it fails because
the unified model must carry every distinction both groups make, which means every field
one group needs is a field the other group must nonetheless understand, populate, migrate
and reason about. The cost grows with the product of the contexts, not the sum.

The alternative Fowler names is **multiple canonical models**:

> *"different contexts may have completely different models of common concepts with
> mechanisms to map between these polysemic concepts"*

Two things in that sentence are load-bearing. "Completely different models" — not
sub-classes, not optional fields, genuinely different types. And "mechanisms to map" — the
translation is a first-class piece of software you write and own, not an accident. That
mechanism is the anticorruption layer in [29 · Anticorruption
layer](29-anticorruption-layer.md).

## The boundary is drawn by language, and language is drawn by people

Fowler's line on where contexts come from is the one to remember:

> *"human culture, since models act as Ubiquitous Language, you need a different model when
> the language changes"*

This is why boundary-finding is an interviewing exercise before it is a modelling exercise.
You are not looking for entities. You are looking for the moment two people in the same
meeting use the same noun and mean different things, and neither notices because — again
Fowler —

> *"subtle polysemes could be smoothed over in conversation but not in the precise world of
> computers"*

Humans repair ambiguity automatically and continuously. Compilers do not. Every
`if (customer.getType() == CustomerType.LEGACY_B2B_MIGRATED)` in your codebase is the fossil
of a repair a human made in a meeting in 2019 and a Java class was made to carry forever.

## Ubiquitous language, stated as an engineering constraint

"Ubiquitous language" sounds like a poster. As an engineering constraint it is sharp:

**Inside a bounded context, every domain term has exactly one meaning, and that meaning is
identical in the conversation, the requirements, the class names, the database columns, the
API and the logs.**

The practical consequences are unglamorous and immediate:

- If the business says "cancel", the method is `cancel()`, not `setStatus(4)`.
- If the business distinguishes "reserved" from "allocated", two words exist in code. If it
  does not, only one does — and inventing the second is a *false* distinction that will
  confuse everyone forever.
- If a term needs a qualifier every time it is used in code (`orderForShipping`,
  `orderAsBilled`), you have found a context edge. See [02c · The language tells
  you](02c-the-language-tells-you.md).
- If the API's field name and the business's word disagree, one of them is wrong and it is
  usually the API — and it is now a versioning problem rather than a rename.

## A model is not a schema

The most common misreading of "bounded context" is that it means a database schema. It does
not. A context is defined by the **rules the model enforces and the meanings it assigns**;
the storage is downstream. Two contexts can share a physical database and still be two
contexts, if neither reads the other's tables and the shared instance is only an operational
choice. Two schemas can be one context, if both encode the same rules and always change
together.

Getting this the wrong way round is how teams end up believing they have four contexts
because they have four schemas, and then discovering they have one, because a change to a
`status` value ripples through all four.

## What it looks like in Java

The context boundary is visible in the package tree before it is visible anywhere else.
Under Spring Boot 4.1 and JDK 25, the honest shape is one top-level package per context,
with the model types package-private or confined to an internal sub-package:

```java
// com.retailer.sales — the Sales context.
package com.retailer.sales;

import java.time.Instant;
import java.util.List;

/// The Sales context's Order: what a customer committed to buy, at what price,
/// under which terms. It knows nothing about parcels, pick lists or tax filings.
public final class Order {

    private final OrderId id;
    private final CustomerId placedBy;
    private final List<OrderLine> lines;
    private OrderStatus status;
    private final Instant placedAt;

    // constructor and behaviour omitted for brevity in this excerpt only

    public Money total() {
        return lines.stream()
                .map(OrderLine::lineTotal)
                .reduce(Money.zero(), Money::plus);
    }

    public void cancel(CancellationReason reason) {
        if (status != OrderStatus.PLACED) {
            throw new IllegalStateException("only a placed order can be cancelled");
        }
        this.status = OrderStatus.CANCELLED;
    }
}
```

```java
// com.retailer.fulfilment — a different context, a different Order.
package com.retailer.fulfilment;

import java.util.List;

/// The Fulfilment context's Shipment. There is no "Order" type here at all: what
/// Fulfilment cares about is a set of physical things to pick, pack and hand to a
/// carrier. The Sales order id survives only as a correlation value.
public final class Shipment {

    private final ShipmentId id;
    private final SalesOrderRef salesOrder;   // an identifier, not the Sales Order type
    private final Address deliverTo;
    private final List<PickLine> pickLines;
    private ShipmentStatus status;

    public boolean isPickable() {
        return pickLines.stream().allMatch(PickLine::isInStock);
    }
}
```

Two things in that pair are deliberate and both are frequently violated.

**Fulfilment does not import `com.retailer.sales.Order`.** It holds a `SalesOrderRef`,
which wraps an identifier. This is Vernon's *Reference Other Aggregates By Identity* rule
applied one level up — see [10 · Who owns the data](10-who-owns-the-data.md).

**Fulfilment does not have a poorer version of the Sales model; it has a different one.**
`Shipment` is not `Order` minus some fields. It has `pickLines` where Sales has
`orderLines`, because a pick line is a physical quantity from a physical location and an
order line is a commercial commitment at a price. Merging them produces a class with both
sets of fields where half are null at any moment — the "unified model" failure in
miniature.

## Contexts are not always the same size

Nothing requires contexts to be balanced. A retailer typically has a very large Sales
context, a large Fulfilment context, a medium Pricing context and a tiny Notifications
context that consists of three templates and a queue. Balancing them — splitting Sales into
four for symmetry with the others — is aesthetic, not structural, and it is one of the
reliable ways to invent a boundary the domain does not have.

## Gotchas

**★ "We have a single source of truth for Customer."** In almost every organisation this
is false in a specific, checkable way: Support's idea of a customer includes people who have
never bought anything, Billing's excludes anyone without a valid payment instrument, and
Marketing's includes an email address that belongs to a household rather than a person. The
"single source" is normally the union of all three with a lot of nullable columns and an
undocumented rule about which subset each consumer must filter to. Ask each team to state
the criterion for a row *not* being a customer; if you get three answers, you have three
contexts.

**★ Treating a bounded context as a synonym for a service.** They correlate, they are not
equal, and the difference matters for real decisions. See [04 · A service is not a
context](04-a-service-is-not-a-context.md) — a service may legitimately contain several
subdomains, and early on it usually should.

**★ Inventing a context because a team wanted one.** Contexts are discovered from language
and rules. A team's *desire* to own something independently is evidence about org design,
not about the domain. Sometimes the right response is a new context; often it is a
`@NamedInterface` and a clearer module, which costs nothing.

**★ Defining the context boundary and then sharing the model across it anyway.** A
`common-domain` jar containing `Customer`, `Order` and `Money` cancels every context
boundary in the codebase at compile time, quietly. [16 · The shared model
jar](16-the-shared-model-jar.md) is the whole argument.

**★ Assuming the context boundary is stable.** Language moves. When a company starts
selling subscriptions alongside one-off orders, the word "order" acquires a second meaning
and a context that was coherent for five years stops being coherent. Boundaries need
re-examining when the business model changes, not when the traffic grows.

## Interview questions

**★ What is a bounded context, and how is it different from a module?**
A bounded context is the region within which a particular model and its vocabulary are
consistent and authoritative — outside it, the same words mean different things and the
model does not apply. A module is a code-organisation unit. The two often coincide, and
should, but a module is a decision you make about files, while a context is a fact you
discover about how people talk about the business. You can put two contexts in one module
(and you will regret it) or one context across four modules (which is merely untidy).

**★ Why can't you just build one unified `Customer` model and let each area use the parts
it needs?**
Because "the parts it needs" is not the hard part — the conflicting rules are. Billing
needs a customer to have a valid tax jurisdiction; Support needs to open a ticket for
someone who has not finished signing up. A unified model must either make the tax
jurisdiction nullable, which means Billing now carries a runtime check that used to be a
type guarantee, or must forbid Support's case, which means Support builds a workaround. Do
that across six areas and the model enforces nothing, every consumer re-implements
validation, and any change to the shared type requires sign-off from six teams. The cost is
in the coordination and the lost invariants, not in the extra columns.

**★ Where do bounded contexts actually come from — the data model or the organisation?**
From the language, which is heavily shaped by the organisation. Fowler names *"human
culture"* as the dominant factor: because the model serves as a ubiquitous language, the
boundary sits where the language changes, and language changes at the seams between groups
of people with different jobs. That is why the org chart is often a good first guess and
occasionally a terrible one — it is a proxy for the language, and proxies fail when the org
was drawn for other reasons, such as an acquisition or a headcount budget.

**★ Two contexts both have a `Customer`. Is that duplication you should eliminate?**
No — it is the design working. They are two different concepts that share a word. The thing
you must do is make the difference explicit: different types, in different packages, with
names that are honest inside their context (`Billing.Payer`, `Support.Contact`) if the
shared word is causing confusion, plus an explicit translation between them at the edge.
Eliminating the "duplication" merges the contexts and re-imports every problem the split
solved.

**★ Can two bounded contexts share a database instance?**
Physically, yes — sharing a Postgres cluster is an operations decision. What they must not
share is *the model*: neither may read or write the other's tables, because that makes the
other's schema a public API and every column rename a coordinated release. That distinction
between physical co-location and logical sharing is the crux of the shared-database
argument, and it belongs to **03 · Database-per-service** *(not written yet)*. For boundary
purposes the rule here is narrower: a context owns its tables, and "owns" means nobody else
knows they exist.

{/* FOOTER */}
