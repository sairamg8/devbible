---
title: "The transaction boundary is the hard floor under every service boundary: whatever must commit together must live together, so the real design question is not where to put the line but which transactions you are willing to give up"
sidebar_label: "14 · The transaction boundary"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Vaughn Vernon, *Effective Aggregate Design, Part I* (2011)
> ([dddcommunity.org](https://www.dddcommunity.org/library/vernon_2011/), CC BY-ND 3.0);
> microservices.io *Dark matter force: Prefer ACID over BASE*
> ([microservices.io](https://microservices.io/articles/dark-energy-dark-matter/dark-matter/prefer-acid-over-base.html));
> the Spring Framework 7.0.x reference on declarative transaction management, cited by
> concept. Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 · Spring Cloud
> train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**A service boundary is also a transaction boundary, always, with no exceptions and no
mitigations that restore what you gave up. Distributed transactions across services are not
a fallback you can reach for — two-phase commit across independently deployed services with
independent databases is not offered by any of the tooling in this phase, and where it is
technically possible it trades away exactly the availability the split was supposed to buy.
So the practical form of the boundary question is unusually blunt: which of your current
transactions are you prepared to stop having?**

## The chain, stated once

1. An invariant must hold atomically.
2. Atomically means one transaction.
3. One transaction means one database, in practice, in this architecture.
4. One database means one service.
5. Therefore state under one invariant lives in one service.

Step 3 is the one people try to escape, and the escape routes are worse than the
constraint. XA/two-phase commit requires a coordinator, blocks participants while it
decides, and turns two services' availability into a joint availability that is lower than
either — which is the failure mode topic 04 is about. It also requires every participant to
support XA, which rules out most of the datastores people actually use behind services.

microservices.io names the force honestly rather than pretending it away:

> *"it's easier to implement an operation as an ACID transaction rather than, for example,
> eventually consistent sagas"*

That is listed as a **dark matter** force — one of the attractive forces that resists
decomposition. It is not an argument against splitting. It is a cost you must put on the
other side of the ledger, and it is the cost most often left off.

## What you actually give up, itemised

Splitting a transaction removes four distinct guarantees, and teams usually only notice the
first:

**Atomicity.** Either both writes happen or neither. Gone; you now have partial states, and
every partial state is a state your code must handle and your support team must recognise.

**Isolation.** No other actor observes the intermediate state. Gone, and this one is subtle:
in a single transaction, a concurrent reader never saw the order without its reservation.
Across services, every reader can see it, including your own UI, your own reports, and your
own downstream services making decisions.

**Rollback.** A failure anywhere undoes everything. Gone, and its replacement is
compensation, which is not the same thing: a compensating action is a *new* business fact
("the reservation was released") rather than the erasure of an old one, and the difference
shows up in audit logs, customer emails and financial reports.

**Ordering.** Statements in one transaction have a defined order and a single commit point.
Across services you get partial ordering at best, and any consumer that assumes "I will see
`OrderPlaced` before `PaymentCaptured`" is asserting something the infrastructure does not
guarantee.

A design document that says "we will use a saga" has addressed atomicity and rollback and
usually not isolation or ordering.

## The `@Transactional` method is where the boundary is decided

The most useful artefact in a decomposition exercise is a list of every transactional method
and the aggregates it writes. It is a mechanical extraction from code you already have, and
it is far more reliable than any diagram, because it records what the system does rather
than what anyone believes.

```java
package com.retailer.sales.internal;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class OrderPlacementService {

    private final OrderRepository orders;
    private final StockItemRepository stockItems;      // ← a second aggregate root
    private final CustomerRepository customers;        // ← a third

    // constructor omitted

    /// This one method writes three aggregate roots in one transaction. It is,
    /// simultaneously: a violation of one-aggregate-per-transaction, a statement that
    /// orders, stock and customers cannot currently be separated, and a list of the
    /// three invariants somebody believed in when they wrote it.
    @Transactional
    public OrderId place(PlaceOrderCommand command) {
        var customer = customers.findById(command.customerId()).orElseThrow();
        customer.recordOrderPlaced();                          // write 1

        var order = Order.place(command.customerId(), command.lines());
        orders.save(order);                                    // write 2

        for (var line : command.lines()) {
            var item = stockItems.findBySku(line.sku()).orElseThrow();
            item.reserve(order.id().asRef(), line.quantity()); // write 3..n
        }
        return order.id();
    }
}
```

Three aggregate roots, one transaction. Every candidate boundary through this method must
answer for it:

- **Sales / Inventory split** — cuts between `orders` and `stockItems`. Costs the reserve
  invariant. Whether that is acceptable is the whose-job question from
  [12 · Whose job is it?](08-whose-job-is-it.md).
- **Sales / Customers split** — cuts between `orders` and `customers`. Look at
  `recordOrderPlaced()`: if it is maintaining a counter for a dashboard, it is a false
  invariant ([11 · False invariants](07b-false-invariants.md)) and this cut is free. If it
  is maintaining an outstanding-balance figure that a credit check rejects orders on, it is
  real and the cut is not free.

That distinction — free cut versus expensive cut, decided by inspecting one method call — is
the whole exercise in miniature, and it takes minutes per method.

## Rewriting the method so the boundary becomes available

If the customer counter is a false invariant and the reservation is the system's job, the
same operation becomes:

```java
package com.retailer.sales.internal;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class OrderPlacementService {

    private final OrderRepository orders;
    private final ApplicationEventPublisher events;

    // constructor omitted

    /// One aggregate, one transaction. Everything else that must happen is stated as a
    /// fact and consumed elsewhere. Sales is now separable from Inventory and from
    /// Customers without changing this method again.
    @Transactional
    public OrderId place(PlaceOrderCommand command) {
        var order = Order.place(command.customerId(), command.lines());
        orders.save(order);
        events.publishEvent(new OrderPlaced(
                order.id(), order.customerId(), order.lines(), order.placedAt()));
        return order.id();
    }
}
```

The order is created in a state that acknowledges the pending allocation — which is exactly
microservices.io's *Self-contained Service* description of the Order Service creating orders
*"in a PENDING state, immediately responding to clients"* and completing validation
asynchronously. The important property for this topic is narrower: **the method now writes
one aggregate, so any boundary drawn around it is affordable.**

## The rule to apply in review

> A `@Transactional` method that writes more than one aggregate root is either a false
> invariant to be removed, a real invariant that pins those aggregates into the same
> service, or one of the four documented exceptions. It is never "fine, we will sort it out
> later", because later is after the split.

The four documented exceptions are Vernon's, and they are in
[17 · Reasons to break the rule](11-reasons-to-break-the-rule.md).

## The read side is not exempt, and it is where isolation bites

Transactions are usually discussed as a write concern, but the guarantee people rely on
most is a read one. Inside a transaction, `SELECT` sees a consistent snapshot; a report that
sums orders and joins to payments sees a coherent picture. Split the two and that report
either accepts skew or needs a coordinated read that has no equivalent.

That is genuinely a data problem rather than a boundary problem, and it belongs to
**03 · Database-per-service** *(not written yet)*. It is named here only because it is the
guarantee most likely to be discovered *after* a split, by a finance team, in a meeting.

## Gotchas

**★ Symptom: a design document proposes distributed transactions across services.** Cause:
someone assumed XA is available. Fix: it usually is not, across service boundaries with
heterogeneous datastores, and where it is, it holds locks across a network and makes joint
availability worse than either service alone. The honest options are: keep them in one
service, or accept eventual consistency with compensation.

**★ Symptom: "the saga will handle it" with no further detail.** Cause: a saga is being
treated as a library rather than as a distributed workflow with state, retries, compensation
and its own failure modes. Fix: for boundary purposes, count a saga as a permanent new
component with an owner and an on-call burden, then re-ask whether the split earns it. The
mechanics belong to **phase 15** *(not written yet)*.

**★ Symptom: a compensating action that customers can see.** Cause: compensation is a new
business fact, not an undo. "Your order has been cancelled because the item was
unavailable" is the compensation, and it must be designed as a customer experience, not
discovered as an error path.

**★ Losing isolation without noticing.** Atomicity failures are loud; isolation failures are
quiet and show up as a report that does not tie out, or a downstream service acting on a
half-written state. When pricing a split, explicitly ask who reads across the proposed line
and what they will see mid-flight.

**★ `@Transactional` on a method that also makes a remote call.** The transaction is open
while the network call is in flight, so a slow remote service holds database locks and
connections. This is a defect in a monolith and a much worse one after a split. Publish an
event or use an outbox; never call a remote service inside a transaction.

**★ Assuming a single database means a single transaction.** Two modules writing the same
database in separate transactions have already lost atomicity, and their boundary is closer
to a service boundary than it looks. That is often good news — the split will be cheaper
than expected — but it must be checked rather than assumed.

**★ Counting only write transactions.** Long-running read transactions used for reports and
exports rely on isolation, and they are the ones that break loudest and latest.

## Interview questions

**★ Why can't you just use a distributed transaction across two services?**
Because the mechanism that would provide it — two-phase commit — requires a coordinator,
holds locks on every participant while the decision is made, and makes the joint operation
less available than either participant, which is precisely the property the split was meant
to improve. It also requires every datastore involved to support XA, which excludes most of
what sits behind services in practice. The honest choices are to keep the state in one
service, or to accept eventual consistency and build the compensation. Choosing the second
without saying so is how systems end up with unenforced invariants nobody documented.

**★ What exactly do you lose when a transaction is split across a boundary?**
Four things, and most designs address two. Atomicity: partial states become real and must be
modelled. Rollback: replaced by compensation, which is a new business fact rather than an
erasure, and therefore visible to customers and auditors. Isolation: intermediate states
become observable by other services, your UI and your reports. Ordering: consumers can no
longer assume they see events in the order the writes happened. A design that says "we'll
use a saga" has usually covered atomicity and rollback and has not thought about who reads
across the line while it is mid-flight.

**★ How do you find, in an existing codebase, which boundaries are cheap and which are
expensive?**
List every `@Transactional` method and the aggregate roots it writes. Any method writing one
root is a boundary that costs nothing to draw around. Any method writing several is either a
false invariant — check whether anything rejects an operation on the strength of the extra
write — or a real one that pins those aggregates together. It is mechanical, it uses the
code rather than anyone's memory, and it produces a ranked list of candidate cuts by cost in
about a day.

**★ A `@Transactional` method makes an HTTP call to another service. What is wrong with
that, and what changes after a split?**
The database transaction stays open for the duration of the remote call, so locks and
connections are held hostage by another system's latency, and a slow dependency turns into
connection-pool exhaustion in a service that is otherwise healthy. It is bad in a monolith
and worse after a split, because remote calls become more common and more variable. The
correct shape is to commit the local state and publish an event or write an outbox record in
the same transaction, then perform the remote interaction afterwards, where a failure is a
retry rather than a rollback.

**★ Is it ever right to draw a boundary that splits a real invariant?**
Yes, when availability is worth more than immediate consistency for that specific rule, and
someone with authority has said so. A retailer that would rather accept an order and
occasionally cancel it than fail a checkout has made exactly that trade, deliberately, and
it is the *Self-contained Service* pattern. What makes it legitimate is that the weakening
is explicit and the compensation is designed as a customer experience. What makes it a
defect is when it happens because nobody enumerated the invariants and the drift is
discovered later as a reconciliation job.

{/* FOOTER */}
