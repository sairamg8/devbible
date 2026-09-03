---
title: "Not every write path needs a transaction, and the ones that do are exactly the pairs of subdomains you must not put a network between — which makes the atomicity audit the cheapest and most concrete boundary-finding tool you have"
sidebar_label: "04b · Which operations need atomicity"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Chris Richardson, *Pattern: Microservice Architecture*
> ([microservices.io](https://microservices.io/patterns/microservices.html)); the Spring
> Modulith reference, *Working with Application Events*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/events.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8 · Spring Modulith
> **2.1.1**. **No sandbox** — Java and configuration only.

**[10 · The transaction you lose](04-the-transaction-you-lose.md) established that
splitting removes atomicity. This chunk is the practical follow-through: work out which
operations actually needed it, because that list is simultaneously the price list for a
proposed boundary and the strongest evidence for where the boundary should be. Then
practise the discipline in-process, where getting it wrong is free.**

## The audit

Go through every write path in the system and classify it. This takes an afternoon and it
is worth more than a week of whiteboarding.

| Operation | Needs atomicity across subdomains? | Why |
|---|---|---|
| Place order (reserve + charge) | **Yes** | Money and stock; the business will not accept "usually" |
| Cancel order (release stock + refund) | Yes, but tolerantly — minutes are fine | Compensation is natural here |
| Apply a promotion at checkout | Usually yes | Affects the amount charged |
| Adjust stock after a stock-take | Yes, within inventory only | Single subdomain |
| Update customer address | No | Single subdomain |
| Reindex search after a product change | No | Eventual by nature; nobody expects otherwise |
| Send order confirmation email | No | Already at-least-once and unreliable |
| Write an audit record | No | Append-only; late is fine, missing is not |
| Recalculate a loyalty balance | No | Nightly is acceptable to the business |

Three columns is enough, but add a fourth in practice: **what the business said when you
asked.** The rows where you had to guess are the rows that will hurt.

**Every "yes" row bonds two subdomains.** A boundary drawn through a "yes" row converts one
local transaction into a saga with compensations, an idempotency scheme and a partial-failure
policy. A boundary drawn through a "no" row costs you almost nothing. That is why "split
where you do not need a transaction" is close to being the entire boundary-finding
technique — **02 · Service boundaries from bounded contexts** *(not written yet)* owns the
full method, and **03 · Database-per-service** *(not written yet)* owns the data half.

The audit is also the honest version of the split proposal's cost section. "This boundary
crosses three operations that are currently atomic: checkout, cancellation and promotion
application" is a sentence a reviewer can act on. "There will be some eventual consistency"
is not.

## What replaces the transaction, named and handed off

The pattern is the **saga**: a sequence of local transactions where each step publishes an
event that triggers the next, and each step has a compensating action that semantically
undoes it. Richardson:

> *"Saga, which implements a distributed command as a series of local transactions"*

Sagas are **owned by phase 15 topic 10**, and the messaging infrastructure they run on is
owned by phase 15 generally. This topic's job is to make you price them before you commit,
not to teach them.

The related patterns you will also need, all named by Richardson and all owned elsewhere:

> *"Command-side replica, which replicas read-only data to the service that implements a
> command"*
>
> *"API composition, which implements a distributed query as a series of local queries"*
>
> *"CQRS, which implements a distributed query as a series of local queries"*
>
> *"Services typically need to use the Transaction Outbox pattern to atomically update
> persistent business entities and send a message."*

That last one matters for this topic specifically, because Spring Modulith's event
publication registry **is** a transaction outbox and it works inside the monolith — see
**47 · The event publication registry** *(not written yet)*.

### Sizing the work honestly

For **one** saga replacing **one** previously-atomic operation, the artefacts you now own:

1. A state machine with a persisted current state per instance.
2. A compensating action per step — semantic, not a rollback. `refund` is not `undo charge`.
3. An idempotency key per step, honoured by the receiving service, with storage and a
   retention policy.
4. A timeout and retry policy per step, and a definition of what happens when retries are
   exhausted.
5. A dead-letter path with a human process attached, because some instances will need an
   operator.
6. Observability: which sagas are in flight, which are stuck, how long each step takes.
7. Tests that exercise every partial-failure ordering, which is more test code than the
   happy path by a wide margin.

Seven artefacts, per saga. That is the number to put next to "we will use sagas" in a
design document.

## The in-process version of the same discipline

You can practise all of this without paying for it. Instead of injecting the other module's
bean and calling it inside the transaction, publish an event and let the other module react:

```java
package com.acme.commerce.ordering;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class Checkout {

    private final Orders orders;
    private final ApplicationEventPublisher events;

    Checkout(Orders orders, ApplicationEventPublisher events) {
        this.orders = orders;
        this.events = events;
    }

    @Transactional
    public OrderId place(Cart cart, PaymentMethod method) {
        Order order = orders.create(cart);
        events.publishEvent(new OrderPlaced(order.id(), cart.lines(), order.total()));
        return order.id();
    }
}
```

What that buys you in one deployable: the ordering module no longer references inventory,
payment or shipping at all, so the **design-time** coupling — the import, the constructor
parameter, the reason the two modules must change together — is already gone. That is the
coupling that makes extraction hard.

What it does **not** buy: distributed failure semantics. With Spring Modulith's
`@ApplicationModuleListener` the listener still runs in the same JVM against the same
database, and its failure is recorded in an event publication log you can resubmit from.
**45 · Events instead of bean references** *(not written yet)* through
**49 · Externalisation and the seam** *(not written yet)* develop this, and
**55 · What Modulith does not give you** *(not written yet)* states the
gap plainly.

The Spring Modulith reference is careful about exactly this trade, and the sentence is worth
having:

> *"As event publication happens synchronously by default, the transactional semantics of
> the overall arrangement stay the same as in the example above. Both for the good, as we
> get to a very simple consistency model (either both the status change of the order and the
> inventory update succeed or none of them does), but also for the bad as more triggered
> related functionality will widen the transaction boundary and potentially cause the entire
> transaction to fail, even if the functionality that is causing the error is not crucial."*

That is the in-process version of the same trade-off you are being asked to make at the
service level, available to you at a cost of one annotation instead of one deployment
pipeline — which makes it a cheap place to find out whether your team actually wants it.

## Gotchas

**★ Compensation is not rollback and the difference is customer-visible.** A rollback leaves
no trace. A compensation leaves a charge and a refund on the customer's statement, an audit
row, possibly an email. Business stakeholders who approve "we'll compensate" are often
approving something they have not visualised. Show them the statement.

**★ Some steps have no compensating action, and those are the ones that decide the step
order.** You cannot un-send an email, un-ship a parcel or un-publish to a partner. The rule
that follows is concrete: order the saga so that irreversible steps come last, after every
reversible step has committed. If two steps are both irreversible and both required, the
subdomains they belong to should not be separated by a network.

**★ The audit table's "no" rows are not free either — they are just cheaper.** "Eventual"
still means somebody must define *how* eventual, must alert when the lag exceeds it, and
must handle the case where the eventual step never happens. Search reindexing that silently
stops is a customer-visible outage that no health check will report.

**★ The most expensive rows are the ones you did not ask the business about.** Where the
audit says "yes, but tolerantly — minutes are fine", check that a person with authority
actually said "minutes". Engineers systematically over-estimate the business's tolerance for
inconsistency on money and under-estimate it on things like address changes, where a stale
read causes a mis-delivery.

**★ Publishing an event inside the transaction does not make the listener asynchronous.**
Spring's default event publication is synchronous and joins the caller's transaction, so a
listener that throws still fails the whole write. If you want the decoupled behaviour you
have to say so — `@ApplicationModuleListener`, which is `@Async` plus
`@TransactionalEventListener` plus `@Transactional(propagation = REQUIRES_NEW)`. Teams that
switch from bean calls to events and see no behaviour change have usually not made this
step yet. **46 · @ApplicationModuleListener** *(not written yet)*.

**★ Moving to events removes design-time coupling immediately and runtime coupling not at
all — say which one you meant.** In one process, if the listener runs synchronously the
availability and latency of the whole operation is still the sum of its parts. The win you
have banked is that ordering no longer imports inventory, which is the win that makes the
future extraction mechanical. Claiming the other win before it exists is how a modular
monolith gets described as "basically microservices already".

**★ An event-based seam has a schema, and nobody versions it while it is in-process.**
`OrderPlaced` is a Java record today and a JSON payload the day it crosses a wire. If the
listener and the publisher are compiled together, an incompatible change is a compile error
and everybody is happy; after extraction it is a runtime failure in production. Design the
event as if it were already external — additive fields, no enums you will extend, no
domain objects embedded whole. **05 · Inter-service REST** *(not written yet)* owns
tolerant-reader evolution and it applies to events too.

## Interview questions

**★ How does the transaction requirement inform where you draw service boundaries?**
It is close to being the technique. Enumerate the write operations, mark the ones that
require atomicity across two subdomains, and treat every such pair as strongly bonded — a
boundary drawn between them converts one local transaction into a saga with compensations
and a partial-failure policy. Operations that are naturally eventual (search indexing,
notification, reporting, analytics) mark the pairs that are cheap to split. In practice you
draw the line where you do not need a transaction, which is why "invariants" and
"transaction boundaries" appear in the bounded-context literature as the primary
boundary-finding tools.

**★ Can you get the design-time decoupling without paying the distributed-consistency
cost?**
Partly, and it is the most useful move available. Replace cross-module bean references with
application events: the ordering module publishes `OrderPlaced` and does not know inventory
exists. That removes the design-time coupling — the import, the constructor parameter, the
reason the two modules must change together — while the listener still runs in the same JVM
against the same database, so you keep local transactional semantics and a durable
publication log you can resubmit from. What you do not get is independent deployment or
independent failure. It is the right preparation for extraction and it is not extraction.

**★ What do you actually have to build for one saga?**
Seven things, and naming them is the point. A persisted state machine per saga instance. A
semantic compensating action per step, which is not the same as a rollback. An idempotency
key per step that the receiving service honours, with storage and a retention policy. A
timeout and retry policy per step plus a defined behaviour when retries are exhausted. A
dead-letter path with a human process attached. Observability for in-flight and stuck
instances. And tests covering every partial-failure ordering, which is usually more code
than the happy path. Multiply by the number of previously-atomic operations the boundary
crosses; that product is the real cost of the boundary.

**★ How do you order the steps of a saga?**
Reversible steps first, irreversible steps last, so that the compensations you might need
are all still available when a later step fails. Sending an email, shipping a parcel and
notifying a partner cannot be undone; creating an order, reserving stock and authorising —
rather than capturing — a payment can. If the design requires two irreversible steps that
must both happen, that is a signal the subdomains involved should not have a network
between them, and the audit table should have flagged it before anyone drew the boundary.

**★ Your team switched from cross-module bean calls to Spring application events and
reports that nothing changed operationally. Is that a problem?**
No, and it is the expected result if the listeners are plain `@EventListener` methods:
Spring publishes synchronously by default and the listener joins the caller's transaction,
so latency, availability and failure behaviour are all unchanged. What *has* changed is the
compile-time dependency graph — the publishing module no longer imports the consuming one —
which is the change that makes extraction mechanical later. If the team wants the failure
isolation as well, they need `@ApplicationModuleListener`, which runs the listener
asynchronously in its own new transaction and records the publication in a log that can be
resubmitted. Those are two separate decisions and it is worth being explicit about which
one has been made.

{/* FOOTER */}
