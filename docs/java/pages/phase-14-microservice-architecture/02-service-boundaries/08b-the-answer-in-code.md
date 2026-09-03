---
title: "Once you know whose job it is, the answer lands in Java as one of exactly two shapes — a single transaction over one aggregate, or a domain event published on commit and consumed by a listener that runs in its own transaction"
sidebar_label: "13 · The answer, in code"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Vaughn Vernon, *Effective Aggregate Design, Part II* (2011)
> ([dddcommunity.org](https://www.dddcommunity.org/library/vernon_2011/), CC BY-ND 3.0);
> the Spring Modulith 2.1.1 reference, *Working with Application Events*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/events.html)) — which
> defines `@ApplicationModuleListener` as a shortcut combining `@Async`,
> `@Transactional(propagation = Propagation.REQUIRES_NEW)` and `@TransactionalEventListener`
> — and microservices.io *Self-contained Service*
> ([microservices.io](https://microservices.io/patterns/decomposition/self-contained-service.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**[12 · Whose job is it?](08-whose-job-is-it.md) produces one of two answers, and each answer
has exactly one honest implementation. "The acting user's job" is a `@Transactional` method
over a single aggregate, with no boundary inside it. "Another user's or the system's job" is
a domain event published inside the committing transaction and consumed by a listener that
runs afterwards, in its own transaction. Getting the second shape wrong — by publishing
before commit, or by consuming inside the publisher's transaction — recreates the coupling
you were trying to remove, silently, and it is the most common way an event-driven boundary
turns out to be no boundary at all.**

## The two shapes

**Answer: the acting user's job.** One transaction, one aggregate, no boundary between them.

```java
package com.retailer.fulfilment.internal;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class PickingService {

    private final ShipmentRepository shipments;

    PickingService(ShipmentRepository shipments) {
        this.shipments = shipments;
    }

    /// The picker is standing at the shelf. When they scan the last item they expect the
    /// shipment to be ready, immediately, because they are about to move the parcel.
    /// One aggregate, one transaction, no boundary here.
    @Transactional
    public void recordScan(ShipmentId id, Sku sku, int quantity) {
        var shipment = shipments.findById(id).orElseThrow();
        shipment.recordPick(sku, quantity);      // may transition to READY_TO_DISPATCH
    }
}
```

**Answer: the system's job.** Publish, and let the other side catch up on its own schedule
— which is what makes the two sides separable.

```java
package com.retailer.fulfilment.internal;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class DispatchService {

    private final ShipmentRepository shipments;
    private final ApplicationEventPublisher events;

    DispatchService(ShipmentRepository shipments, ApplicationEventPublisher events) {
        this.shipments = shipments;
        this.events = events;
    }

    /// Nobody is waiting for Sales to notice. The event is published inside the
    /// transaction that changed the shipment; delivery to listeners happens after
    /// commit, which is exactly the guarantee that lets Sales live elsewhere.
    @Transactional
    public void dispatch(ShipmentId id, CarrierConsignment consignment) {
        var shipment = shipments.findById(id).orElseThrow();
        shipment.dispatch(consignment);
        events.publishEvent(new ShipmentDispatched(id, shipment.salesOrder(), consignment));
    }
}
```

```java
package com.retailer.sales.internal;

import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
class SalesOrderProgressListener {

    private final SalesOrderRepository orders;

    SalesOrderProgressListener(SalesOrderRepository orders) {
        this.orders = orders;
    }

    /// @ApplicationModuleListener is @Async + @TransactionalEventListener +
    /// @Transactional(REQUIRES_NEW). Sales updates in its own transaction, after
    /// Fulfilment's committed. That separation is the boundary, in one annotation.
    @ApplicationModuleListener
    void on(ShipmentDispatched event) {
        orders.findById(event.salesOrder())
              .ifPresent(SalesOrder::markDispatched);
    }
}
```

While these two modules live in one deployable, that listener is an in-process boundary you
can verify with a test. When Fulfilment moves to its own service, the same event becomes a
message and the listener barely changes — which is the argument for drawing the boundary in
code first, made in **33 · Package structure is the
boundary** *(not written yet)*.

## When the answer is "it depends on who you ask"

Two stakeholders give different answers. That is not a failure of the question; it is a
finding, and it means one of two things.

**Two workflows.** The finance clerk capturing manually and the nightly batch capturing
automatically are different use cases with different consistency needs, and the model should
support both — which usually means the eventual path, with the synchronous path as an
optimisation for the clerk.

**A genuine policy gap.** Nobody has decided, and the software has been making the decision
implicitly for years. Escalate it. This is the single most valuable output of the exercise,
because an undecided policy is a defect generator: support handles the consequences manually
and nobody counts the cost.


## Gotchas

**★ Symptom: the listener runs, then the publisher's transaction rolls back.** Cause: a
plain `@EventListener`, which is synchronous and runs inside the publisher's transaction —
so a side effect can be performed for a state change that never commits. Fix:
`@TransactionalEventListener` (or `@ApplicationModuleListener`, which includes it), so the
listener runs on `AFTER_COMMIT`. This is not a boundary nicety; it is the difference between
"Sales was told about a dispatch that happened" and "Sales was told about a dispatch that
was rolled back".

**★ Symptom: the publisher's transaction rolls back because the listener threw.** Cause: a
synchronous listener without `REQUIRES_NEW`, so the consumer's failure destroys the
producer's write. That is the opposite of a boundary — the downstream now has veto power
over the upstream. Fix: `@ApplicationModuleListener` bundles
`@Transactional(propagation = Propagation.REQUIRES_NEW)` precisely for this.

**★ Symptom: an event is published, the process is killed, and the listener never runs.**
Cause: an in-memory `ApplicationEventPublisher` with an after-commit listener has a window
between commit and delivery, and nothing recovers it. Fix: Spring Modulith's event
publication registry, which writes an entry per listener *"as part of the original business
transaction"* and marks it completed on success, leaving failed entries for retry —
optionally re-publishing outstanding events at startup via
`spring.modulith.events.republish-outstanding-events-on-restart`. This is the in-process
form of the transactional outbox, and it is what makes the eventual answer honest rather
than best-effort.

**★ Publishing the aggregate inside the event.** `new ShipmentDispatched(shipment)` hands
the consumer your internal model and makes every field of it a public contract. Publish
identifiers and the few facts the event is about; see
**38 · Published language vs aggregate** *(not written yet)*.

**★ Symptom: the consumer needs three more fields, so the event grows every sprint.**
Cause: the event was designed as a data-transfer object rather than as a statement of what
happened. Fix: an event names a fact — `ShipmentDispatched`, with the ids and the
consignment. If the consumer needs more it can ask, or the fact was misidentified. An event
that accumulates fields on request is a shared model with a queue in front of it.

**★ Using an event for the case where the answer was "the acting user's job".** If the user
is watching and will act on the result, an asynchronous listener means they see stale state
and act on it. The event shape is not a general-purpose upgrade; it is the implementation of
one specific answer.

## Interview questions

**★ What is the difference between `@EventListener`, `@TransactionalEventListener` and
`@ApplicationModuleListener`, and why does it matter for a boundary?**
`@EventListener` runs synchronously in the publisher's thread and transaction: the consumer
can roll the producer back and can act on state that never commits. `@TransactionalEventListener`
defers to a transaction phase, by default after commit, which fixes the "acted on a rollback"
problem but by default still runs synchronously in the same thread. Spring Modulith's
`@ApplicationModuleListener` is documented as a shortcut for `@Async` plus
`@Transactional(propagation = Propagation.REQUIRES_NEW)` plus `@TransactionalEventListener`
— so the consumer runs after commit, on another thread, in its own transaction. That
combination is what an in-process module boundary actually requires: neither side can
corrupt or veto the other's transaction.

**★ If events are asynchronous, how do you avoid losing one when the process dies between
commit and delivery?**
You make the intent to deliver part of the same transaction as the state change. Spring
Modulith's event publication registry does this in-process: on publication it writes an
entry per interested transactional listener into an event publication log *as part of the
original business transaction*, marks it complete when the listener succeeds, and leaves
failed entries for retry, with optional re-publication of outstanding events on restart.
Across services the same idea is the transactional outbox with a relay, which belongs to
**phase 15** *(not written yet)*. The principle is identical and worth stating once: never
have a step where the state has committed and the record of what must happen next has not.

**★ Why does the choice between these two code shapes belong in a chapter about
boundaries?**
Because the shape decides whether a boundary is possible. If the correct implementation is a
single `@Transactional` method over one aggregate, then the state involved cannot be split
across services without building compensation, so no boundary goes there. If the correct
implementation is publish-and-consume, then the two sides are already communicating through
a contract that survives being turned into a message on a broker, and the boundary is
available whenever you want it. The code shape is not a consequence of the architecture; it
is the test of which architectures are reachable.

**★ What do you do when two stakeholders answer the question differently?**
Treat it as a finding rather than a dispute. Usually it means there are two workflows — a
manual one and an automated one — with genuinely different needs, and the model should
support both, typically by making the eventual path the general case and the synchronous
path an optimisation. Occasionally it means nobody has decided the policy and the software
has been deciding it implicitly for years, in which case the disagreement is the most useful
thing the exercise produced and it should be escalated rather than resolved by an architect.

{/* FOOTER */}
