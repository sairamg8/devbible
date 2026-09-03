---
title: "The single most under-priced cost of splitting is that one annotation stops working: @Transactional across two services does not exist, and everything it was silently doing becomes application code somebody has to write, test and explain to the business"
sidebar_label: "04 · The transaction you lose"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Chris Richardson, *Pattern: Microservice Architecture* and
> *Pattern: Monolithic Architecture*
> ([microservices.io](https://microservices.io/patterns/microservices.html)); Stefan Tilkov,
> *Don't start with a monolith*
> ([martinfowler.com](https://martinfowler.com/articles/dont-start-monolith.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8 · Spring Modulith
> **2.1.1**. **No sandbox** — Java and configuration only.

**A monolith gives you atomicity for free, across every subdomain, on every write path,
without anybody deciding to use it. Splitting takes it away everywhere at once. This is not
one of the costs of a microservice architecture — for a transactional business system it is
usually the largest one, and it is the only cost that converts an engineering decision into
a product decision.**

## What the annotation is actually buying

Here is a checkout in a monolith. Four subdomains, one method, one database transaction:

```java
package com.acme.commerce.ordering;

import com.acme.commerce.inventory.InventoryManagement;
import com.acme.commerce.payment.PaymentGateway;
import com.acme.commerce.shipping.ShipmentScheduler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class Checkout {

    private final Orders orders;
    private final InventoryManagement inventory;
    private final PaymentGateway payments;
    private final ShipmentScheduler shipping;

    Checkout(Orders orders, InventoryManagement inventory,
             PaymentGateway payments, ShipmentScheduler shipping) {
        this.orders = orders;
        this.inventory = inventory;
        this.payments = payments;
        this.shipping = shipping;
    }

    @Transactional
    public OrderId place(Cart cart, PaymentMethod method) {
        Order order = orders.create(cart);
        inventory.reserve(cart.lines());
        payments.charge(order.total(), method);
        shipping.schedule(order.id(), cart.address());
        return order.id();
    }
}
```

Everything that annotation is doing, itemised, because none of it is written down anywhere
in the method:

1. **Atomicity across four subdomains.** If `shipping.schedule` throws, the order row, the
   reservation and the payment record all disappear. No compensating code exists because
   none is needed.
2. **Isolation.** Two concurrent checkouts for the last unit of stock cannot both succeed —
   the database's locking, at whatever isolation level you configured, is doing the work.
   Nobody wrote a distributed lock.
3. **A single failure mode.** The caller gets an exception or an id. There is no third
   outcome.
4. **Read-your-own-writes.** Everything written earlier in the method is visible to
   everything later, in the same connection, with no replication lag and no cache
   invalidation.
5. **One place to look.** A bug in this flow is one stack trace, one transaction, one log
   correlation problem you do not have.

Phase 10 owns the mechanics of all of that:
[`@Transactional`](../../phase-10-data-access/04-spring-transactional/README.md) and
[JDBC transactions](../../phase-10-data-access/03-jdbc-transactions/README.md).

## What happens the moment `inventory` and `payment` are separate services

Richardson states the consequence as an unavoidable property of the pattern:

> *"Some operations might need to be implemented using complex, eventually consistent
> (non-ACID) transaction management since loose coupling requires each service to have its
> own database."*

Note the causal chain: loose coupling **requires** database-per-service, database-per-service
**removes** the shared transaction, and the removal **forces** eventual consistency onto
whichever operations span services. You do not get to opt out of the middle step and keep
the outcome; that is the shared-database anti-pattern, which
**03 · Database-per-service** *(not written yet)* owns.

The same method now looks structurally like this — and note that it is **pseudo-code for
the sequence**, not a recommendation:

```java
// pseudo-code — this is the naive translation, and it is wrong. See below.
public OrderId place(Cart cart, PaymentMethod method) {
    Order order = orders.create(cart);              // local transaction, service A
    inventoryClient.reserve(cart.lines());          // network call, service B
    paymentClient.charge(order.total(), method);    // network call, service C
    shippingClient.schedule(order.id(), address);   // network call, service D
    return order.id();
}
```

Enumerate the new outcomes that did not exist before:

- Reserve succeeds, charge fails → stock held for an order that will not happen.
- Reserve succeeds, charge succeeds, schedule fails → customer charged, nothing ships.
- Charge **times out** → you do not know whether the card was charged.
  [13 · The ambiguous outcome](05b-the-ambiguous-outcome.md) is entirely about this one.
- Any step succeeds and the process crashes before the next → partial state with no owner.
- Two concurrent checkouts both reserve the last unit, because the reservation is now two
  separate local transactions in two separate databases.

Five failure modes where there was one, and every one of them needs a defined customer-facing
behaviour.

## The part that is a product decision, not an engineering one

The question "what does the customer see when the card is charged and the reservation
fails?" has no technically correct answer. The options are all business policy:

- Refund automatically and show a failure. (Now you own refund reconciliation.)
- Keep the money, hold the order, alert an operator. (Now you own an operations queue.)
- Ship what you can, refund the difference. (Now you own partial fulfilment.)
- Oversell and back-order. (Now you own customer communication and a promise date.)

In a monolith none of these were decisions, because the transaction rolled back. **Splitting
is the act of asking the business a question it did not know it was being asked**, and
almost every split does it silently, at 4pm, in a pull request. That is the shape of the
cost described in [03 · Who pays for them](01c-who-pays-for-them.md).

## Where the sequel picks up

[11 · Which operations actually need atomicity](04b-which-operations-need-atomicity.md)
takes the other half: how to classify write paths by whether they need a transaction, what
you write in place of one, and the in-process discipline that removes the design-time
coupling without paying the distributed price yet.

## Gotchas

**★ The transaction cost is invisible in the design document because the annotation is
invisible in the design document.** Nobody draws `@Transactional` on an architecture
diagram. Make it explicit: for each proposed service boundary, list the write operations
that currently cross it inside one transaction. If the list is non-empty, that is the
boundary's real price, stated in operations rather than adjectives.

**★ Isolation disappears along with atomicity, and it is the half people forget.** Two
concurrent checkouts contending for the last unit of stock were serialised by the database.
As two services with two databases they are not, and you need a reservation model — a
row-level reservation with an expiry, or an idempotency-keyed hold — that somebody has to
design, implement and test under concurrency. "We'll add a distributed lock" is not that
design; it is a new availability dependency.

**★ "We'll use two-phase commit" is not a solution in practice.** XA across service-owned
databases reintroduces exactly the runtime coupling the split was meant to remove — every
participant must be available for any write to complete, so availability multiplies down
rather than staying independent, and the coordinator becomes a single point of failure with
in-doubt transactions to resolve. The availability arithmetic belongs to **04 · Sync vs
async** *(not written yet)*; the point here is that 2PC is a way of paying for the split
and then giving back the benefit.

**★ Read-your-own-writes goes too, and it breaks the UI before it breaks the backend.** In
one transaction, the confirmation page reads the order you just wrote. Across services, the
order service may not yet have processed the event, so the page renders "not found" for
some fraction of requests. Teams discover this in QA and fix it with a `sleep`. The real
fixes — returning the projection from the write, or a client-side retry with a version
token — need designing up front.

**★ The failure you must design for first is the timeout, not the exception.** An exception
tells you the operation did not happen. A timeout tells you nothing at all, and it is the
common case under load. Any design that only enumerates success and failure has enumerated
two of three outcomes. [13 · The ambiguous outcome](05b-the-ambiguous-outcome.md).

**★ The rollback also cleaned up your in-memory and cache state, and nothing replaces
that.** A transaction that rolls back leaves the database as it was; but a split flow that
half-completes may have already invalidated a cache entry, incremented a counter in Redis,
written an audit row through a separate connection, or emitted a metric. None of those
participate in the compensation you write unless you remember them. Enumerate the
non-database side effects of every step, not just the writes.

**★ Nested subdomain calls hide inside the transaction and only surface at extraction
time.** `inventory.reserve(…)` may itself call `pricing`, which may call `catalogue`. The
method you are looking at names three subdomains; the transaction actually spans six. Before
you price a boundary, walk the call graph one level deeper than feels necessary — a static
call-graph query or Spring Modulith's own module dependency output
(**51 · Actuator and observability** *(not written yet)*) is faster than
reading.

**★ A retry inside a transaction is safe; a retry across a service boundary is not.**
`@Retryable` on a method inside one transaction re-executes work that was rolled back.
Retrying a network call re-executes work that may have committed on the other side. The
same annotation, the same intent, opposite correctness properties — and this is the single
most common way a naive translation of a monolith method produces double charges.

## Interview questions

**★ What exactly do you lose when a single `@Transactional` method becomes two service
calls?**
Atomicity across the subdomains, so partial completion becomes a real state you must model
and clean up. Isolation, so concurrent operations that the database used to serialise now
race — the last-unit-of-stock case is the standard example. The binary outcome, because a
network call has three results rather than two: success, failure, and unknown.
Read-your-own-writes, which breaks confirmation screens and any read immediately following
a write. And single-place debuggability, because one stack trace becomes several logs that
you can only join if you built correlation first.

**★ Why is the loss of the transaction a product decision rather than an engineering one?**
Because the replacement behaviour is business policy with no technically correct answer.
When the card is charged and the reservation fails, the system can refund automatically,
hold the order and alert an operator, ship partially and refund the difference, or oversell
and back-order. Each has different customer-facing consequences, different operational
work, and possibly different regulatory implications. In a monolith none of this was
decided because the transaction rolled back. Splitting asks the business a question, and the
failure mode of most splits is that an engineer answers it silently.

**★ Why is two-phase commit not the answer?**
Because it gives back the benefit you paid for. XA requires every participant to be
available for any distributed write to succeed, so the operation's availability is the
product of the participants' availabilities rather than being independent — the coupling
the split was supposed to remove comes straight back at runtime, plus a coordinator that
can leave transactions in doubt and locks held across a network round trip. It also is not
supported by much of the infrastructure people actually split onto. The industry answer is
sagas: a series of local transactions with compensating actions, at the cost of eventual
consistency and explicit compensation logic.

**★ A junior engineer translates the monolith's `place(…)` method into four HTTP calls in
the same order and adds `@Retryable` to each. What goes wrong?**
Two distinct defects. First, the retry: a retried charge may execute twice, because the
first attempt can have committed on the payment side and failed on the way back — the
retry needs an idempotency key that the payment service honours, which is a protocol change,
not a client-side annotation. Second, the ordering: the method now holds an inventory
reservation across two more network calls, so under load the reservation hold time is
whatever the slowest downstream is, and stock availability collapses even though nothing has
failed. The monolith's ordering was free of both problems because the whole thing was one
short transaction against one connection.

**★ How would you demonstrate the transaction cost to a sceptical stakeholder in five
minutes?**
Show the four-line method, then show the outcome table: five distinct partial states where
there was previously one binary result. Then ask them, for each state, what the customer
should see and who cleans it up. The exercise is effective because it converts an abstract
architectural argument into four unanswered product questions with their name against them,
and because the natural response — "surely we just roll it back" — is exactly the capability
that has been removed.

{/* FOOTER */}
