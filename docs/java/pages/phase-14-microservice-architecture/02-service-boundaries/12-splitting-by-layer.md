---
title: "Splitting by technical layer produces services that cannot change alone, because a business change is vertical and the boundaries are horizontal — every feature crosses every service, and the architecture has maximised exactly what it was supposed to minimise"
sidebar_label: "19 · Splitting by layer"
sidebar_position: 19
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io *Decompose by business capability*
> ([microservices.io](https://microservices.io/patterns/decomposition/decompose-by-business-capability.html))
> and *Decompose by subdomain*
> ([microservices.io](https://microservices.io/patterns/decomposition/decompose-by-subdomain.html)),
> both of which list the Common Closure Principle — *"things that change together should be
> packaged together"* — as a force; *Dark matter force: minimize design-time coupling*
> ([microservices.io](https://microservices.io/articles/dark-energy-dark-matter/dark-matter/minimize-design-time-coupling.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**The layered split is the first decomposition most teams reach for, because layers are the
structure they can already see in the codebase: a web tier, a service tier, a persistence
tier. Turning those into three deployables produces an architecture with a specific,
predictable and total failure — every business change touches all three services, in a
required order, so the coordination cost of a monolith is preserved exactly and the
operational cost of a distributed system is added on top. It is worth understanding in
detail, because the same mistake reappears in disguises that are much harder to spot.**

## Why it fails, stated precisely

Business changes are **vertical**. "Add a gift-message field to an order" needs a form field,
a validation rule, a service method, a column and a query. Layer boundaries are
**horizontal**. Therefore every change crosses every boundary.

That is the Common Closure Principle violated in the most complete way available: the things
that change together have been placed in different deployables, and the things that are
packaged together — all the persistence code for every subdomain — change for entirely
unrelated reasons.

Put in terms of design-time coupling, *"the likelihood that they need to change together for
the same reason"*: the layered split gives every pair of services a coupling of
approximately one. There is no configuration in which it is a good boundary.

## The deploy-order deadlock it creates

The consequence people actually feel is ordering. To add a field:

1. The persistence service must deploy first, or the service tier's new call has no target.
2. The persistence service's new API must be backward compatible, or the *old* service tier
   breaks between step 1 and step 3.
3. The service tier deploys second.
4. The web tier deploys third.
5. Roll back in reverse. If step 3 fails after step 1 succeeded, you are in a state that was
   never tested.

You have acquired the full ceremony of API versioning and compatibility windows — which is
**05 · Inter-service REST** *(not written yet)*'s subject — as the price for a boundary that
buys nothing, because none of the three can ever be deployed alone anyway.

## The disguises

The naked version — `web-service`, `business-service`, `dao-service` — is rare now. These
are the versions that survive:

**The "data service" or "persistence service".** One service owning all database access for
several subdomains, exposing generic CRUD. This is a layer split with one layer split off.
Every domain change still crosses it.

**The "orchestration" or "process service".** Business logic pulled out of the services that
own the data, into a service that owns none. See [25 · The god
service](17-the-god-service.md).

**The "API service" or "BFF that grew".** A backend-for-frontend is legitimate when it only
shapes and aggregates. Once it validates, decides or defaults, it is a layer holding business
rules, and every rule change is now a two-service release.

**The "integration service".** Everything that talks to the outside world in one deployable.
This one is genuinely tempting because vendor SDKs are messy and isolating them feels tidy —
but it puts every context's anticorruption layer in one place owned by nobody, and a change
to Pricing's vendor mapping now ships alongside Fulfilment's.

**The "validation service" or "rules engine".** Rules extracted from the contexts that own
them into a shared component. The rules change when the domain changes, in a different
deployable from the domain.

**Splitting by read and write.** CQRS is a pattern for separating models, and it can
legitimately mean separate deployables at large scale. Applied as a default boundary it is a
layer split: the read side and the write side of *one* subdomain change together, constantly.

## Java: the shape that shows it

```java
// service: retailer-data-service — owns persistence for every subdomain
package com.retailer.data.api;

/// A generic data API. Notice that it enforces nothing: every rule about what a valid
/// order is lives in the caller, so a rule change is a change here (new field) and a
/// change there (new validation), in two repositories, in a required order.
public interface OrderDataApi {

    OrderRow findById(String orderId);

    List<OrderRow> findByCustomer(String customerId, int limit, int offset);

    String insert(OrderRow row);

    void update(OrderRow row);
}
```

```java
// service: retailer-business-service — owns rules, owns no data
package com.retailer.business;

import org.springframework.stereotype.Service;

@Service
public class OrderBusinessService {

    private final OrderDataApi orderData;     // a network call
    private final StockDataApi stockData;     // another network call

    // constructor omitted

    /// Every invariant this method believes in is unenforceable: between the read and
    /// the write, anything can happen, and there is no transaction to protect it.
    /// The layered split did not merely fail to help — it removed the ability to
    /// enforce rules at all.
    public String placeOrder(PlaceOrderRequest request) {
        var stock = stockData.findBySku(request.sku());        // read over the network
        if (stock.available() < request.quantity()) {
            throw new InsufficientStockException(request.sku());
        }
        stock.setReserved(stock.reserved() + request.quantity());
        stockData.update(stock);                               // write over the network
        var row = new OrderRow(/* ... */);
        return orderData.insert(row);                          // second write, no atomicity
    }
}
```

The check-then-act across a network with no transaction is not incidental to the layered
split; it is the direct consequence. Every invariant in the system has been converted into a
race, and no amount of retry logic in the business service restores it, because the state and
the rule are in different processes.

## The correct shape, for comparison

```java
// service: retailer-sales — owns the orders subdomain, rules and storage together
package com.retailer.sales;

/// The API is the capability, not the table. The rule is enforced where the state is,
/// inside one transaction, and a rule change is a one-repository, one-deploy change.
public interface OrderPlacement {

    OrderId place(PlaceOrderCommand command);

    void cancel(OrderId id, CancellationReason reason);
}
```

The whole difference is that the persistence, the rules and the API for one subdomain are in
one deployable. Vertical, not horizontal.

## Where the layered instinct is right

Layers are an excellent *internal* structure and this chunk is not an argument against them.
Inside one service, separating a web adapter, a domain model and a persistence adapter is
hexagonal architecture and it is worth doing. The error is exclusively about promoting a
layer to a **deployment** boundary.

The test is the change test: a layer boundary inside a deployable costs nothing when a change
crosses it, because one build and one deploy cover all of it. The same boundary between
deployables costs an ordered multi-repository release. Same line, entirely different price.

## Gotchas

**★ Symptom: every feature ticket has subtasks in three repositories.** Cause: horizontal
boundaries. Fix: this is the diagnostic, and it is available from the ticket tracker without
any code analysis. Count the fraction of tickets touching more than one repository; if it is
most of them, the boundaries are along the wrong axis.

**★ Symptom: a documented deploy order.** Cause: services that are not independently
deployable. Fix: a runbook that says "deploy A, then B, then C" is a written admission that
A, B and C are one deployable unit. Merging them loses nothing and removes the runbook.

**★ Calling a data service "domain-driven" because its types have domain names.**
`OrderDataApi` returning `OrderRow` has domain nouns and no domain rules. The test is whether
the API can refuse anything for a business reason. Generic CRUD cannot.

**★ Symptom: a shared "validation" or "rules" component.** Cause: rules extracted from the
contexts that own them. Fix: rules belong with the state they constrain. A rules engine used
*within* one context is fine; a rules service shared across contexts is a layer.

**★ Splitting read from write as a default.** CQRS separates models and is sometimes worth a
separate deployable for scale. As a default boundary it is horizontal: the read and write
sides of one subdomain change together whenever the domain changes.

**★ Symptom: an integration service that everybody's changes go through.** Cause: all
anticorruption layers in one deployable. Fix: an ACL belongs to the downstream context that
needs the translation, in that context's service — see [41 · Where the ACL
lives](29b-where-the-acl-lives.md).

**★ Assuming the layered split is safe because it is easy to reverse.** It is easy to
reverse technically and hard to reverse politically, because by then three teams own three
layers and merging removes two team charters.

## Interview questions

**★ Why is splitting by technical layer the classic decomposition mistake?**
Because business changes are vertical and layer boundaries are horizontal, so every change
crosses every boundary. That maximises design-time coupling — the likelihood that two
components must change together for the same reason approaches one for every pair — which is
precisely what a boundary is supposed to minimise. You keep all the coordination cost of a
monolith, in the form of ordered multi-repository releases, and you add the operational cost
of a distributed system, plus you lose the transaction that used to enforce your invariants.
There is no team size or scale at which it becomes a good trade.

**★ What is the fastest way to detect it in an existing organisation?**
The ticket tracker, not the code. Take the last fifty feature tickets and count how many
required changes in more than one repository, and how many required a specific deploy order.
If most features are multi-repository and there is a written deploy order, the boundaries are
horizontal, whatever the services are named. This is faster than any code analysis and it is
evidence that non-engineers accept.

**★ Is a backend-for-frontend a layer split?**
It is legitimate while it only shapes and aggregates data for one client, because then it
changes when the client's screens change, which is its own reason to change and gives it real
cohesion. It becomes a layer split the moment it validates, defaults or decides — at that
point a business rule change requires a release of the BFF and a release of the owning
service, in order, and the rule now exists in two places with the usual consequence that they
drift. The test is whether the BFF can refuse a request for a business reason.

**★ You inherit `web-service`, `business-service` and `data-service`. What do you do
first?**
Merge them, before anything else. They are one deployable unit already — the deploy order
proves it — so merging removes the network hops, restores transactions and eliminates the
release choreography, without changing a single boundary that was doing any work. Once it is
one service again, do the real analysis: enumerate subdomains, find the invariants, look at
the change history, and then split vertically along whatever the evidence supports. Trying to
re-draw boundaries while maintaining three deployables means doing the hard work with both
hands tied.

**★ Are layers ever the right structure?**
Inside a service, yes, and they are the standard one — a web adapter, a domain model and a
persistence adapter, with dependencies pointing inward. That is hexagonal architecture and it
makes the domain testable and the infrastructure replaceable. The error is exclusively about
promoting a layer to a deployment boundary: the same line costs nothing when a change crosses
it inside one build, and costs an ordered multi-repository release when it crosses a network.

{/* FOOTER */}
