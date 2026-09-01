---
title: "Choosing between a REST call and an event is not a protocol choice — it is a decision about which services have to be running at the moment your user presses the button"
sidebar_label: "01 · Coupling is the decision"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io — "Pattern: Remote Procedure Invocation (RPI)"
> ([microservices.io](https://microservices.io/patterns/communication-style/rpi.html)) and
> "Pattern: Messaging"
> ([microservices.io](https://microservices.io/patterns/communication-style/messaging.html)) —
> and Martin Fowler & James Lewis, "Microservices"
> ([martinfowler.com](https://martinfowler.com/articles/microservices.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8 · Spring Cloud train
> 2025.1.x (components 5.0.x). **No sandbox** — no measured latency, availability or
> throughput figure appears anywhere in this topic.

**The sync-versus-async argument is usually held as a technology argument: REST or Kafka,
`RestClient` or a listener, blocking or reactive. It is not. Every one of those is
downstream of a single architectural question — *at the instant a request arrives, which
other services must be alive and answering for it to succeed?* That question has an answer
per interaction, the answer is a number, and the number compounds. Pick "synchronous"
because it was easier to write, and you have not chosen a library; you have signed your
service up to be down whenever any of its dependencies is down. This topic is about making
that signature deliberate.**

## The question the code does not ask

Here is a controller that looks entirely reasonable in review:

```java
@RestController
class OrderController {

    private final OrderRepository orders;
    private final CustomerClient customers;
    private final InventoryClient inventory;
    private final PricingClient pricing;

    OrderController(OrderRepository orders, CustomerClient customers,
                    InventoryClient inventory, PricingClient pricing) {
        this.orders = orders;
        this.customers = customers;
        this.inventory = inventory;
        this.pricing = pricing;
    }

    @PostMapping("/orders")
    ResponseEntity<OrderResponse> place(@RequestBody PlaceOrder command) {
        Customer customer = customers.byId(command.customerId());
        StockLevel stock = inventory.check(command.sku(), command.quantity());
        Money total = pricing.quote(command.sku(), command.quantity(), customer.tier());

        Order order = orders.save(Order.of(command, customer, stock, total));
        return ResponseEntity.created(order.uri()).body(OrderResponse.from(order));
    }
}
```

Three fields, three calls, one save. Nothing here is badly written. But the code never
states the property that will define this endpoint's operational life: **`POST /orders`
now fails whenever Customer, Inventory *or* Pricing is unavailable.** Not degrades —
fails. The 500 goes to the user, and the on-call engineer for Order Service is paged for a
fault in a service they do not own.

That property is invisible in the source because Java gives a remote call the same syntax
as a local one. `customers.byId(...)` reads exactly like `orders.findById(...)`. The
difference — one is a method dispatch, the other is a network round trip to a process that
may be mid-deploy — is carried entirely by the type of the field, and nobody reads field
types in review.

## Coupling is the name for that property

Chris Richardson's formulation is the one worth memorising, from the dark-matter forces
article:

> *"Runtime coupling is the degree to which the availability of one service is affected by
> the availability of another service."*

Read it as a *degree*, not a boolean. It is not "these services are coupled"; it is "this
operation's availability is a function of that operation's availability, to this extent".
Two services can be tightly coupled on one endpoint and completely independent on every
other one. Coupling is a property of an **interaction**, not of a pair of services — which
is why the unit of decision in this topic is always one interaction, never one service.

The microservices.io RPI pattern names the cost in the drawbacks column, in one line:

> *"Reduced availability since the client and the service must be available for the
> duration"*

and the messaging pattern names the corresponding benefit:

> *"Loose runtime coupling since it decouples the message sender from the consumer"*

Those two sentences are the whole trade, stated by the same author on two facing pages.
Everything else in this topic is elaboration: how much availability, how much latency, what
you have to build to survive without the answer, and which interactions genuinely cannot
survive without it.

## Fowler said it as arithmetic

The "Microservices" article puts the consequence under a heading that reads like a warning
label — **"Synchronous calls considered harmful"** — and then states the mechanism:

> *"Any time you have a number of synchronous calls between services you will encounter the
> multiplicative effect of downtime. Simply, this is when the downtime of your system
> becomes the product of the downtimes of the individual components. You face a choice,
> making your calls asynchronous or managing the downtime."*

Note the last sentence. It does not say "make everything asynchronous". It says you have a
**choice**, and both branches are legitimate: change the shape of the interaction, or keep
the shape and pay for the downtime with redundancy, degradation and operational effort.
Most real systems do both, per interaction. What is never legitimate is not knowing which
branch you took.

The article also records what two teams actually did about it: The Guardian imposed *"one
synchronous call per user request"* on their platform, and Netflix *"built asynchronicity
into the API fabric"*. Two very different answers to the same arithmetic — which tells you
the arithmetic is real and the remedy is a design choice.

## What "async" is actually buying, and what it is not

It is worth killing a misconception before it costs you a rewrite. Asynchrony does not make
a slow thing fast, and it does not make a broken thing work. Its entire mechanical
contribution is this: **it removes the requirement that two parties be available at the
same instant.** The messaging pattern says so directly, listing among its benefits:

> *"Improved availability since the message broker buffers messages until the consumer is
> able to process them"*

The buffer is the product. Everything you like about async — the consumer can be down for
ten minutes, the producer's latency no longer includes the consumer's, you can add a second
consumer without telling the producer — falls out of the buffer. And everything you dislike
about it does too: the buffer holds state you now have to reason about, the work happens at
a time you did not choose, and "done" stops being a thing the caller can observe.

That is why the honest framing of this topic is not "async is better". It is: **a
synchronous hop buys you an immediate, ordered, observable answer, and charges you
availability; an asynchronous hop buys you availability, and charges you the answer.** You
are choosing which bill to pay, per interaction.

## Where each of the four costs lands

| You choose | You get | You pay |
|---|---|---|
| Synchronous request/reply | The result, now, in order, with errors you can react to | Availability multiplies · your latency includes theirs · you inherit timeouts, retries and idempotency |
| Asynchronous fire-and-forget | The caller finishes regardless of the callee | No result · no ordering guarantee · failure is invisible to the caller |
| Event notification | Fan-out without the producer knowing consumers | The flow is no longer readable in one place · debugging is cross-service |
| Event-carried state transfer | The read becomes local — no hop at all | Duplicated data · staleness · a second copy that can be wrong |

Each row is a chunk or a band later in this topic. The point of the table here is that
**none of the rows is free**, so "we'll just use events" is not an answer any more than
"we'll just call it" is.

## The one interaction that deserves the most attention

Of every interaction in a typical system, the one with the best return on redesign is not
the write. It is **the read that exists purely to decorate a response**: fetching the
customer's name to put on the order confirmation, fetching the product title for a line
item, fetching the warehouse's display address. These are usually the most numerous
synchronous hops in a codebase, they carry the full availability cost of a hop, and almost
none of them need a live answer — a locally held copy that is a few seconds stale would be
indistinguishable to the user. [06c · The read that could have been a
copy](06c-the-read-that-could-have-been-a-copy.md) is where that argument is made in full,
and it is the chunk to read if you only read one.

## Gotchas

**★ The coupling is invisible at the call site, so review never catches it.**
`customers.byId(id)` and `orders.findById(id)` are the same six tokens. Nothing in Java
marks one as a network boundary. The practical countermeasure is naming and packaging: put
every remote client in a package the whole team recognises (`…​.client`), name the types
`CustomerClient` rather than `CustomerService`, and make the code review question "how many
`Client` fields does this class have?" a habit. A class with four is an availability
liability regardless of how clean the code is.

**★ "We're asynchronous, we use a message broker" is not a coupling claim.**
Sending a request over a queue and blocking on a reply queue is temporally coupled in
exactly the way a REST call is — the consumer must be up now, or the caller times out.
The transport changed; the coupling did not. See [05d · Request/reply over
messaging](05d-request-reply-over-messaging.md).

**★ Coupling is per interaction, so "is Order Service coupled to Customer Service?" is an
unanswerable question.** It has a different answer for `POST /orders` (hard sync
dependency), for the nightly reconciliation (async, tolerant), and for the customer-name
lookup on a list page (could be a local copy). Teams that argue at service granularity
argue forever. Force the question down to one endpoint and it resolves in a minute.

**★ Making the call reactive does not reduce coupling.** Swapping `RestClient` for
`WebClient` and returning a `Mono` changes which thread waits, not who has to be up. A
non-blocking client with an unavailable server still produces an error for the user. This
confusion is common enough to be worth stating in a design review out loud: *reactive is a
concurrency decision; sync-versus-async here is an availability decision.* They are
orthogonal.

**★ The team that owns the caller pays for the callee's outage.** The pager fires on the
service returning 500s, which is the caller. This misalignment is why availability
arithmetic tends to be discovered by the wrong team at the wrong hour, and why the cost
belongs in the design document rather than in an incident review.

## Interview questions

**★ What is the actual difference between synchronous and asynchronous communication
between services — in terms of guarantees, not APIs?**
Synchronous means the caller's outcome is not determined until the callee responds, so both
must be available at the same moment; the caller receives the result, in order, and can
react to failure immediately. Asynchronous means the caller's outcome is determined without
the callee, because something durable — a broker, a queue, a table — accepts the work on
the callee's behalf; the callee may run seconds or hours later, the caller gets no result,
and failure is invisible to it. The API difference (return type, annotation, client class)
is a consequence. The guarantee difference is the decision.

**★ A colleague says "we made the call asynchronous by returning a `CompletableFuture`."
Have they reduced coupling?**
No. A `CompletableFuture` moves the wait off the calling thread; the request is still issued
now, the remote service still has to answer now, and the result is still needed before the
response is produced. Non-blocking and asynchronous-in-the-coupling-sense are different
words that happen to share a syllable. The coupling only changes when the caller can
complete its own work *without* the callee's answer.

**★ Why is coupling a property of an interaction rather than of a pair of services?**
Because availability is per operation. Order Service might be unable to accept an order
without Payment (hard), able to show an order list without Payment (soft — it can omit a
field), and able to run its nightly settlement job hours after Payment recovers (none).
Talking about "coupling between Order and Payment" averages three different answers into a
meaningless one. Richardson's definition is careful about this: it is the degree to which
the availability *of an operation implemented by one service* is affected by another.

**★ Fowler writes that synchronous calls give you "the multiplicative effect of downtime",
and then says you have a choice. What is the second branch of that choice?**
Managing the downtime rather than removing it: run the dependency with enough redundancy
that its availability is high enough for the product to be acceptable, degrade gracefully
when it is not (serve a cached or partial answer), and accept the residual. That is a
completely valid engineering answer, and for a dependency that is genuinely required — you
cannot take a payment without the payment processor — it is the only answer. What makes it
valid is that someone did the arithmetic and decided; what makes it negligent is arriving
there by default.

**★ Your service calls four others synchronously on its hottest endpoint. Before touching
any code, what do you ask?**
For each of the four, in order: (1) does the user's answer depend on this call's result, or
only on it having happened? (2) if the callee is down, is there an answer I could still
give that is better than a 500? (3) does the data I am fetching change often enough that a
copy would be wrong, or is it reference data? (4) does this call gate a write — is there an
invariant that would be violated if I proceeded without it? The calls that answer "only on
it having happened", "yes", "reference data" and "no" are the ones to change, and usually
at least two of the four do.

{/* FOOTER */}
