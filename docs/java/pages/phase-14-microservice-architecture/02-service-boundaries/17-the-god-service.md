---
title: "The orchestrator that owns no data and calls everything is not a coordination layer, it is every other service's business rules relocated into a component that cannot enforce any of them"
sidebar_label: "17 · The god service"
sidebar_position: 29
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Michael Nygard, *The Entity Service Antipattern* (2017)
> ([michaelnygard.com](https://www.michaelnygard.com/blog/2017/12/the-entity-service-antipattern/));
> microservices.io *Self-contained Service*
> ([microservices.io](https://microservices.io/patterns/decomposition/self-contained-service.html))
> and *Dark matter force: minimize runtime coupling*
> ([microservices.io](https://microservices.io/articles/dark-energy-dark-matter/dark-matter/minimize-runtime-coupling.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**The god service arrives as a fix. Someone notices that the business rules are scattered
across five consumers of five entity services, and proposes a single place to put them —
a process service, an orchestration layer, a workflow service. It is a genuine improvement
over five copies of the rule, and it is still wrong, because it puts the rules in a component
that holds none of the state they constrain. It cannot enforce them under concurrency, it
cannot fail without taking everything down, and it becomes the place every change has to go,
which is precisely the monolith the split was supposed to remove.**

## How to recognise it

- It owns no persistent business state of its own, or only workflow state.
- Its dependency list contains most of the other services.
- It appears in every feature ticket.
- Its release blocks other releases.
- Its incident is everyone's incident.
- Its team is described as "the integration team" or "the platform team", and has grown.
- Reading it is the fastest way to understand the business, which sounds like a compliment
  and means the rules are not where the data is.

## The three defects, in order of severity

**1. It cannot enforce anything.** A rule about state is enforceable only where the state is,
inside a transaction. An orchestrator reads from A, decides, and writes to B. Between the read
and the write, A changed. Every invariant it "enforces" is a check-then-act across a network
with no isolation, so under concurrency it is a race, and the race is invisible in testing.

**2. Its availability is the product of everyone's.** It must call several services to do
anything, so it is down whenever any of them is. Its own uptime is irrelevant. This is the
availability arithmetic of **04 · Sync vs async** *(not written yet)*; here it is enough to
note that the orchestrator is the component least able to be self-contained, by construction.

**3. It is where every change goes.** The rules live there, so the rule changes go there.
Five teams file tickets against one repository, and the queue that the split was supposed to
eliminate has reappeared with an extra network layer underneath it.

## The code

```java
// ANTI-PATTERN: an orchestrator holding rules about state it does not own.
package com.retailer.orchestration;

import org.springframework.stereotype.Service;

@Service
public class OrderOrchestrationService {

    private final CustomerClient customers;
    private final ProductClient products;
    private final PricingClient pricing;
    private final InventoryClient inventory;
    private final PaymentClient payments;
    private final OrderClient orders;
    private final NotificationClient notifications;

    // constructor omitted

    public OrderResult placeOrder(PlaceOrderRequest request) {

        var customer = customers.get(request.customerId());
        if (customer.status() != CustomerStatus.ACTIVE) {          // Identity's rule
            return OrderResult.rejected(Reason.INACTIVE_CUSTOMER);
        }
        if (customer.outstandingBalance() > customer.creditLimit()) {  // Credit's rule
            return OrderResult.rejected(Reason.CREDIT_LIMIT);
        }

        var stock = inventory.checkAvailability(request.lines());  // read
        if (!stock.allAvailable()) {                               // Inventory's rule
            return OrderResult.rejected(Reason.OUT_OF_STOCK);
        }

        var price = pricing.quote(request.lines(), customer.segment());
        var orderId = orders.create(request, price);               // write 1
        inventory.reserve(orderId, request.lines());               // write 2 — race with the read
        payments.authorise(orderId, price.total(), customer.paymentInstrument()); // write 3
        notifications.sendConfirmation(customer.email(), orderId);

        return OrderResult.accepted(orderId);
    }
}
```

Count the defects. Three departments' rules (Identity, Credit, Inventory) implemented here,
where none of those departments will find them. A check-then-act on stock across a network,
so two concurrent orders for the last item both pass. Three sequential writes with no
atomicity and no compensation, so a failure at the payment step leaves an order and a
reservation with nothing to pay for them. Seven synchronous dependencies for one operation.
And a notification send inside the request path, so an email provider's latency is checkout
latency.

## The correction

Push each rule to the service that owns the state it constrains, and reduce the coordinator
to sequencing that owns nothing.

```java
package com.retailer.sales;

/// Sales owns order placement. The rules it can enforce, it enforces in its own
/// transaction. The rules other contexts own, it asks them to enforce as operations
/// they can refuse — never by reading their data and deciding for them.
public interface OrderPlacement {

    /// Throws CreditRefusedException, StockUnavailableException etc. — refusals raised
    /// by the owner of the rule, not decided here.
    OrderId place(PlaceOrderCommand command);
}
```

```java
package com.retailer.sales.internal;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class OrderPlacementService implements OrderPlacement {

    private final OrderRepository orders;
    private final StockReservation stockReservation;    // Inventory's operation, not its data
    private final ApplicationEventPublisher events;

    // constructor omitted

    @Override
    @Transactional
    public OrderId place(PlaceOrderCommand command) {

        // Inventory decides, atomically, inside its own consistency boundary.
        // Sales never reads a stock level and never decides whether there is enough.
        var reservation = stockReservation.reserve(command.lines(), command.correlationId());

        var order = Order.place(command, reservation.id());
        orders.save(order);

        // Everything that is somebody else's job is stated as a fact and consumed
        // elsewhere: payment authorisation, loyalty points, the confirmation email.
        events.publishEvent(new OrderPlaced(order.id(), order.customerId(), order.total()));
        return order.id();
    }
}
```

The credit rule has gone entirely — it is enforced by Credit, either as a refusal on a
synchronous call that Sales makes and does not interpret, or, if the business tolerates it, as
an asynchronous check that can cancel a pending order. The stock rule has gone to Inventory,
where it is one transaction over one aggregate. The email has gone to a listener. Sales is
left with the rules Sales owns.

## Orchestration is not the enemy; ownerless orchestration is

There is a legitimate need for sequencing across services, and pretending otherwise pushes
teams into implicit choreography that nobody can trace. The distinction:

| Legitimate coordinator | God service |
|---|---|
| Owns the workflow as its domain — a fulfilment process, an onboarding journey | Owns nothing |
| Holds workflow state: which step, which attempt, what compensation is outstanding | Holds no state, or hides it in a cache |
| Contains rules **about the workflow** — retry policy, timeout, escalation | Contains rules about *other contexts'* data |
| Refuses things for workflow reasons — "this journey already completed" | Refuses things for other departments' reasons |
| Calls operations that can refuse | Reads data and decides |

The test in one line: **does it read other services' data and make decisions about it, or does
it call operations that decide for themselves?** The first is a god service. The second is a
coordinator, and the mechanics of doing it reliably — sagas, compensation, timeouts — belong
to **phase 15** *(not written yet)*.

## Gotchas

**★ Symptom: a service that appears in every feature ticket.** Cause: it holds the rules.
Fix: move each rule to the owner of the state it constrains, one rule at a time. Each move is
independently shippable and each makes the orchestrator smaller.

**★ Symptom: a check-then-act across a network.** Cause: reading another service's data and
deciding. Fix: replace it with a single operation on the owner that can refuse —
`reserve(...)` rather than `checkAvailability(...)` followed by `reserve(...)`. This is the
highest-value refactor in the whole pattern, because it converts a race into an enforceable
rule.

**★ Symptom: an orchestrator with no persistent state, holding a multi-step workflow.**
Cause: workflow state kept in memory or in the request. Fix: if it genuinely owns a workflow,
that workflow is state and must be durable — otherwise a restart mid-journey leaves the system
in a state nobody can resume or compensate.

**★ Sending notifications inside the request path.** The provider's latency becomes your
checkout latency and its outage becomes your outage, for a message that could have been sent a
second later. Publish an event.

**★ Symptom: the orchestrator's team keeps growing.** Cause: it is absorbing other teams'
work by absorbing their rules. Fix: this is an organisational signal that the boundary is
wrong, and it is usually visible in headcount before it is visible in code.

**★ Deleting the orchestrator without moving the rules.** The rules then scatter back into
consumers, which is where they were before somebody built the orchestrator. The order is:
move the rules first, then delete what is left.

**★ Assuming a "saga" is not a god service.** It can be. A saga that reads participants' data
and makes decisions about it has all three defects; a saga that invokes operations which
decide for themselves, and holds only its own workflow state, does not.

## Interview questions

**★ What is a god service and why is it worse than the problem it was built to solve?**
It is a service that owns no business state but holds business rules about other services'
state — typically built to consolidate rules that had been duplicated across consumers of
entity services. It is worse in three ways. It cannot enforce the rules it holds, because a
rule about state is enforceable only inside a transaction where that state lives, so every
check becomes a check-then-act race across a network. Its availability is the product of
everything it calls, so it is the least reliable component in the system by construction. And
because the rules are there, every rule change goes there, which recreates the release queue
the decomposition was meant to remove.

**★ How do you distinguish a legitimate coordinator from a god service?**
By whether it decides using other services' data. A legitimate coordinator owns a workflow as
its domain, holds durable workflow state, contains rules about the workflow itself — retry,
timeout, escalation, compensation — and calls operations that can refuse for their own
reasons. A god service reads other services' data, applies other departments' rules to it, and
issues writes. The one-line probe is whether it calls `checkAvailability()` and then decides,
or calls `reserve()` and lets Inventory decide.

**★ Show me the single most important refactor when dismantling one.**
Turning every read-then-decide into an operation the owner can refuse. `checkAvailability`
followed by `reserve` becomes a single `reserve` that either succeeds or throws, executed
inside Inventory's transaction over its own aggregate. That one change converts a race into an
enforceable invariant, removes a network round trip, and moves a rule from a component that
cannot own it to one that can. Every other step — moving the credit rule to Credit, pushing
notifications onto events — is the same move applied to a different rule.

**★ Why do god services form even in teams that know better?**
Because each step is locally correct. Entity services leave the rules in the consumers; the
rules get duplicated; someone notices the duplication and consolidates it; consolidation needs
a home and none of the entity services will take a rule about a different entity; so a new
service is created. Nobody makes a bad decision. The error was upstream — decomposing by
entity — and the orchestrator is the compensating structure the system grows to survive it.

**★ Can a saga be a god service?**
Yes, and it is the most common modern form. If the saga fetches participants' data and applies
business rules to it, it has all three defects wearing the name of a pattern. A saga that is
not a god service holds only its own workflow state — which step, which attempt, what
compensation is outstanding — and invokes participant operations that enforce their own rules
and can refuse. The distinction is not the technology or the framework; it is where the
decision is made.

---

← [The shared model jar](16-the-shared-model-jar.md) · [Topic index](README.md) · Next → [Boundaries from a whiteboard](18-boundaries-from-a-whiteboard.md)
