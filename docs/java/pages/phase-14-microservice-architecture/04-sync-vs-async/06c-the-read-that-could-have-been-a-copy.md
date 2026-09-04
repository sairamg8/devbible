---
title: "The largest single availability win in most microservice systems is deleting the synchronous reads that fetch somebody else's display data, and the reason they survive is that nobody has ever been asked how stale that data is allowed to be"
sidebar_label: "27 · The read that could be a copy"
sidebar_position: 27
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Martin Fowler, "What do you mean by 'Event-Driven'?"
> ([martinfowler.com](https://martinfowler.com/articles/201701-event-driven.html)),
> microservices.io "Pattern: API Composition"
> ([microservices.io](https://microservices.io/patterns/data/api-composition.html)) and
> "Pattern: Event-driven architecture"
> ([microservices.io](https://microservices.io/patterns/data/event-driven-architecture.html)).
> 🔴 **No sandbox.** Version spine: JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**If you read one chunk of this topic, read this one. In a typical service, the majority of
outbound synchronous calls are reads that fetch reference data belonging to another service so
it can be displayed: a name, a title, a category, an address, a tier. Each one carries the full
availability cost of a hop, the full latency cost, the full tail exposure and the full inherited
obligation set. Almost none of them needs a live answer. Replacing them with a locally held copy
removes the dependency completely rather than softening it, and it is usually a week of work
rather than a quarter.**

## Why these reads exist

Not because anyone decided they should. They exist because of a sequence that is entirely
reasonable at every step:

1. Order Service owns orders. Customer Service owns customers. Correct boundary.
2. The order confirmation page shows the customer's name.
3. Order Service does not have the name, because it does not own customers.
4. Somebody adds `customerClient.byId(id)`. One line, obviously correct, ships that afternoon.

Nothing in that sequence is a mistake in isolation. The mistake is systemic: **step 4 is an
architectural decision that looks like a data-access decision**, and the tooling gives it the
same weight as a repository call.

Multiply by every display field in every response and you arrive at the endpoint with five
clients that this topic keeps returning to.

## What the copy actually removes

Restating the table from [23 · Event-carried state
transfer](05f-event-carried-state-transfer.md), because it is the whole justification:

- **Availability**: the owner leaves the product. Not softened — gone.
- **Latency**: the hop leaves the budget entirely, replaced by a local index lookup.
- **Tail**: one fewer independent draw from a latency distribution
  ([17](04f-tail-latency-under-fan-out.md)).
- **Capacity**: the owner no longer receives your read traffic, which is frequently the majority
  of its load.
- **Obligations**: no timeout to budget, no retry policy, no idempotency question, no circuit
  breaker, no fallback to test.

That last line is underrated. The engineering *work* removed is often larger than the work of
building the copy.

## The one question that decides it

> **How old is this value allowed to be before the answer is wrong?**

The answer is a business number, per field, and getting it is the whole exercise:

| Field | Typical tolerance | Verdict |
|---|---|---|
| Customer display name | days | copy |
| Product title, description, category | hours | copy |
| Product image URL | hours | copy |
| Shipping address on a *placed* order | must be point-in-time | **denormalise onto the order** |
| Customer tier used for display | minutes | copy |
| Customer tier used to compute a charge | seconds, or must be live | copy with a tight budget, or keep synchronous |
| Current account balance | must be live | keep synchronous |
| Live FX rate | must be live | keep synchronous |

Two rows deserve attention.

**"Shipping address on a placed order" is not a copy problem at all.** An order shipped to the
address the customer had *at the time* must record that address on the order. Fetching it live is
not merely a coupling problem — it is a **correctness bug**, because a later address change
retroactively rewrites history. This case appears constantly and is nearly always mis-diagnosed
as a caching question when it is a modelling question. **02 · Service boundaries**
*(not written yet)* and **03 · Database-per-service** *(not written yet)* own the modelling
argument; the coupling consequence is that a large fraction of "we must call them" reads are
really "we should have copied this value onto our own aggregate at the time".

**Tier used for display versus tier used to charge** shows that the same field can have two
answers depending on what it is for. Classify per *use*, not per field.

## Three ways to get the copy, in increasing order of goodness

**1 · Denormalise at write time.** When the order is placed, store the customer's name and address
on the order. No ongoing sync, no staleness question, and it is *more* correct because it captures
the point-in-time value. **This is the right answer for anything that describes a past event**, and
it is the cheapest of the three.

**2 · Poll and cache locally.** A scheduled job pulls the reference data — all products, all
categories, changed customers since a watermark — into a local table. No broker needed, so it is
available to every team today. Staleness is bounded by the poll interval, which is a number you
choose and can state.

**3 · Subscribe to events.** The owner publishes changes; you project them. Lowest lag, lowest
load on the owner, requires a broker and the atomicity work phase 15 owns. This is
[23](05f-event-carried-state-transfer.md).

**Option 1 handles more cases than people expect, and options 2 and 3 differ only in lag and
efficiency.** "We can't do this without Kafka" is false: option 2 has the same availability
property and needs a table and a `@Scheduled` method.

## What the local read looks like

The point is that the call site becomes boring, which is the entire objective:

```java
@Service
class OrderSummaryService {

    private final OrderRepository orders;
    private final CustomerCopyRepository customerCopies;   // our table, our transaction

    OrderSummaryService(OrderRepository orders, CustomerCopyRepository customerCopies) {
        this.orders = orders;
        this.customerCopies = customerCopies;
    }

    OrderSummary summarise(String orderId) {
        Order order = orders.findById(orderId).orElseThrow(OrderNotFound::new);
        String name = customerCopies.findById(order.customerId())
                                    .map(CustomerCopy::displayName)
                                    .orElse(order.customerEmail());   // defined, not accidental
        return new OrderSummary(order, name);
    }
}
```

Two details that are not incidental:

- **The `orElse` is a defined behaviour, not a defensive habit.** A customer we have never seen an
  event for — a brand new customer, or one created before the projection existed — has to render
  as something. Deciding what, once, beats a `NullPointerException` in production.
- **There is no client, no timeout, no retry and no circuit breaker.** That absence is the win.

## Objections, and which of them are real

**"We would be duplicating their data."** Yes. Fowler names the cost: *"There's lots of data
schlepped around and lots of copies"*. Weigh it against a hard dependency on the read path; for
reference data the copy nearly always wins.

**"Their model will change and our copy will break."** A copy of three named fields is *less*
coupled than an API call returning their whole DTO, because you have committed to an explicit,
minimal subset rather than to whatever they return this month.

**"We'd have to backfill."** True, and it must be built with the first consumer — see
[23](05f-event-carried-state-transfer.md). It is a day of work that is a month of work if deferred.

**"It's personal data and we'd be spreading it."** **This is the real objection.** Copies are a
data-protection obligation: erasure has to propagate, and you need an inventory of who holds
what. Sometimes it is decisive, and the correct response is then to keep the call and make the
dependency soft rather than to pretend the concern is not serious.

**"The data changes constantly."** Usually false for reference data, and easy to check: ask the
owner for the change rate. If a product title changes twice a year, "constantly" is not the word.

## Gotchas

**★ Nobody asks the staleness question, so the default is "must be live", which is never
justified.** The question takes one minute per field and has to be asked of the business rather
than of the code. Absent the question, the synchronous call is chosen by inertia and defended as
correctness.

**★ Fetching a customer's *current* address to describe a *past* shipment is a correctness bug,
not a coupling one.** The address must be captured on the order at the time. Teams reach for a
cache here and cache the wrong thing; the fix is denormalisation at write time, and it removes the
call as a side effect.

**★ The same field can need different treatment for different uses.** A tier shown on a page can
be minutes old; the same tier used to compute a charge may not be. Classify by use, and be
prepared for one field to appear twice in the inventory with different verdicts.

**★ A copy with no `orElse` policy fails on the entity it has never seen.** New customers, entities
created during a projection outage, and the entire population before the copy existed all produce
misses. Decide the fallback value once, at design time; discovering it via a
`NullPointerException` in production is the usual alternative.

**★ Teams block on "we don't have a broker" when polling would do.** A `@Scheduled` job and a table
gives the same availability property with a larger lag. If the tolerance is hours and the lag is
minutes, the crude option is entirely sufficient and it is available this sprint.

**★ Personal data in a copy is a compliance obligation, not a footnote.** Erasure must propagate
to every copy and you must be able to demonstrate it. That argues for copying the minimum set of
fields and for keeping the inventory of who holds what from day one — not for abandoning the
pattern, but for scoping it deliberately.

**★ The copy quietly acquires a write path.** Someone adds a field the owner does not have; someone
else updates the copy directly; now two services own the concept and disagree. The copy must be
read-only and derived, and the easiest enforcement is a schema and a code review rule, applied from
the beginning.

## Interview questions

**★ Why is replacing a synchronous read with a local copy stronger than adding a cache or a
circuit breaker?**
Because it removes the dependency rather than mitigating it. A cache helps only while warm — and a
freshly started pod during an incident has a cold one. A circuit breaker changes a slow failure
into a fast failure without producing a correct answer. A locally owned copy removes the owner from
the availability product, from the latency budget, from the tail exposure and from the caller's
obligation set entirely: there is no timeout to budget, no retry policy, no idempotency question
and no fallback to test.

**★ What single question decides whether a read can become a copy?**
How old the value is allowed to be before the answer is wrong — asked of the business, per use of
the field, not per field. Display names tolerate days; a balance used to authorise a payment
tolerates nothing. The reason synchronous reads survive is that this question is never asked, so
"must be live" becomes the default and then gets defended as a correctness requirement it was never
shown to be.

**★ A colleague says you cannot do this without a message broker. Are they right?**
No. Three mechanisms give the same availability property. Denormalising at write time — recording
the customer's name and address on the order when it is placed — needs nothing at all and is
*more* correct for anything describing a past event. Polling the owner on a schedule into a local
table needs a `@Scheduled` method and a table, and bounds staleness by the poll interval.
Subscribing to events has the lowest lag and the lowest load on the owner, and is the only one of
the three that needs a broker.

**★ Which objection to copying reference data is the strongest?**
The data-protection one. A copy of personal data is data you hold and must be able to delete and
account for, so erasure has to propagate to every copy and you need an inventory of who holds
which fields. That is real work with legal consequences, and it is sometimes decisive — in which
case the right answer is to keep the call and make the dependency soft, not to pretend the
concern is small. The other common objections — duplication, schema drift, "it changes
constantly" — are usually weaker than the availability cost they are being weighed against.

**★ Your team fetches the customer's shipping address live when rendering a past order. What is
wrong?**
It is a correctness bug before it is a coupling one. The order was shipped to the address the
customer had at the time, so reading the current address rewrites history whenever the customer
moves. The fix is to record the address on the order at write time, which also happens to delete
the synchronous call. This case is routinely misdiagnosed as a caching problem, and caching would
have preserved the bug while making it intermittent.

{/* FOOTER */}
