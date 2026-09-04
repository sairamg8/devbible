---
title: "A self-contained service answers with a partial outcome and finishes the job later, which is the general form of every remedy in this topic — and the reason it is not free is that somebody downstream now has to model 'not yet'"
sidebar_label: "30 · Self-contained services"
sidebar_position: 30
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Chris Richardson, "Dark matter force: minimize runtime coupling"
> ([microservices.io](https://microservices.io/articles/dark-energy-dark-matter/dark-matter/minimize-runtime-coupling.html)),
> "Microservice architecture essentials: loose coupling"
> ([microservices.io](https://microservices.io/post/architecture/2023/03/28/microservice-architecture-essentials-loose-coupling.html)),
> "Pattern: Saga" ([microservices.io](https://microservices.io/patterns/data/saga.html)), and
> RFC 9110 §15.3.3 ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9110.html)).
> 🔴 **No sandbox, and no saga implementation** — phase 15 topic 10 owns that. Version spine:
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**"Self-contained service" is the name for the endpoint of the argument this topic has been
making. A service is self-contained when it can answer a request using only what it owns: its own
data, its own copies, its own decisions. It is the general form of which the local copy, the soft
dependency and the `202 Accepted` are special cases, and the reason it deserves a name is that it
converts a scattered set of tactics into a single design goal you can hold a service to.**

## The definition

Richardson's, verbatim:

> *"A service self-contained is a service that respond to a synchronous request with a partial
> outcome and then asynchronously complete the operation."*

and the concrete illustration:

> *"the Order Service could respond to the HTTP POST /orders request with a 202 Accepted response
> and then initiate a Create Order Saga complete the operation"*

with the cost he names in the same breath: it improves availability **while adding client
complexity.**

The framing that makes it operationally useful is the one from the loose-coupling article, which
defines the problem it solves: runtime coupling is the degree to which the availability of one
service's operation is affected by another's, and the strongest remedy is for the operation not to
need the other service at all during the response.

## Degrees of self-containment

It is a spectrum, and knowing where an endpoint sits is more useful than a binary label:

| Level | The endpoint... | Availability |
|---|---|---|
| 0 | requires k services during the response | `pⁿ` over all of them |
| 1 | requires k services, but degrades past some | product over the hard ones only |
| 2 | requires only data it owns or copies, plus a durable accept | its own store, plus the handoff |
| 3 | requires only data it owns, and defers everything | its own store |

**Level 2 is the realistic target for most write endpoints** and level 3 for most read endpoints.
Level 3 on a write is rare, because the write itself needs somewhere durable to go — and if that
"somewhere" is your own database, level 2 and level 3 coincide, which is the strongest possible
result and the reason an outbox in your own database beats a broker on availability.

## Building one, in the order the work actually goes

**1 · Move reads to copies.** Every enrichment read becomes a local lookup —
[27](06c-the-read-that-could-have-been-a-copy.md). This alone often takes an endpoint from level 0
to level 1 with no change to the write path.

**2 · Classify the remaining hops hard or soft**, and give every soft one a defined degraded
answer — [10](03e-hard-and-soft-dependencies.md).

**3 · For each remaining hard hop, ask whether the decision could be made against a copy** with a
bounded staleness and confirmed later — [26](06b-the-decision-that-gates-a-write.md).

**4 · Make the accept durable and local.** Whatever is left of the operation gets recorded in your
own database in one transaction with the business change, and drained afterwards. This is the step
that makes the endpoint's availability equal to your own database's.

**5 · Return the partial outcome honestly.** `201` if you created something, `202` if you accepted
something — [29](06e-the-user-who-is-waiting.md) — with a status resource, so the client can find
out what happened.

**6 · Build the completion path**, whether that is a poller, a consumer or a saga. Phase 15 owns
this step's mechanics.

**7 · Monitor completion**, because from step 4 onward the caller no longer sees failures. This is
not optional and it is the step teams skip.

## The shape in code

```java
@PostMapping("/orders")
ResponseEntity<OrderResponse> place(@RequestBody PlaceOrder command,
                                    @AuthenticationPrincipal Principal caller) {

    // 1 — everything needed to decide comes from data we own or copy
    CustomerCopy customer = customerCopies.require(caller.customerId());
    Money total = pricing.priceFrom(localCatalogue, command);      // local price list

    // 2 — the business change and the outstanding work commit together
    Order order = orders.placeAndEnqueueFollowUp(command, customer, total);

    // 3 — an honest partial outcome, with somewhere to look
    return ResponseEntity.status(HttpStatus.ACCEPTED)
            .location(URI.create("/orders/" + order.id()))
            .body(OrderResponse.accepted(order));
}
```

Read what is absent: **no client fields, no timeouts, no retries, no circuit breakers, no
fallbacks.** The endpoint's availability is its process and its database. That absence is the
entire point, and it is what "self-contained" buys.

`placeAndEnqueueFollowUp` writing the order and the outstanding work in one transaction is doing
the load-bearing work here; **phase 15 owns how that outbox is drained** — see
[Phase 15 · Messaging and event-driven architecture](../../phase-15-messaging-event-driven/README.md).

## Who pays

Being explicit about this is what separates an honest design from a cost-shifting one.

| Party | What they gain | What they pay |
|---|---|---|
| This service | availability, latency, a much simpler failure model | building the completion path and its monitoring |
| The client | fewer errors, faster responses | modelling a pending state and discovering the outcome |
| The user | the operation nearly always succeeds | occasionally learning about a failure later |
| Operations | fewer correlated outages | new alarms: consumer lag, dead letters, stuck jobs |
| The business | fewer lost transactions during dependency outages | a compensation policy for the cases that fail after acceptance |

The bottom row is the one that requires a decision from outside engineering, and it is the one to
raise first. **"What do we do about the orders we accepted and cannot fulfil?"** has to have an
answer before this design ships, and it is the same question as
[26](06b-the-decision-that-gates-a-write.md)'s compensation question, arriving one level up.

## When not to

- **When there is no acceptable compensation.** If the operation cannot fail after acceptance
  without unacceptable consequence, the decision has to be made inside the response, and the
  endpoint cannot be self-contained on that hop.
- **When the client cannot model "pending".** A third-party integration with a fixed contract, or
  a UI that has no state for it.
- **When the volume does not justify it.** A low-traffic internal endpoint with a reliable
  dependency does not need a completion path, a status resource and three new alarms.
  Self-containment is an investment; spend it where the availability matters.

## Gotchas

**★ Self-containment moves failure from the response to the completion path, and nobody watches
the completion path.** The service reports success, the client sees success, and a stuck job
sits in a table for weeks. The alarm on incomplete work — count of jobs past their expected
completion time — is as important as the design itself and is routinely omitted.

**★ A partial outcome the client ignores is worse than a failure.** If the client treats `202` as
`200` and never checks the status, the user is told their order succeeded and nobody ever
discovers it did not. The client-side change is part of the design, not a follow-up ticket.

**★ The durable accept must be one transaction with the business change.** Writing the order and
then enqueuing the follow-up in a second transaction reintroduces the loss window this pattern
exists to close. If the follow-up cannot be in the same transaction, the endpoint is not
self-contained — it merely looks like it.

**★ "Partial outcome" is not a licence to accept anything.** Validation that can be performed
locally must still be performed before returning `202` — a request with a malformed payload should
get a `400`, not an accepted job that fails silently three seconds later. Accept what you can
plausibly complete; reject what you already know is wrong.

**★ Compensation policy is a business decision that engineering will otherwise invent.** If nobody
decides what happens to accepted-but-unfulfillable orders, the answer becomes whatever the code
does, which is usually "log an error". Get the policy before shipping.

**★ Self-containment can hide a bad boundary rather than fix it.** If an operation needs six
services' data, copying all six into one service is a symptom that the boundary is wrong, not a
triumph of decoupling. **02 · Service boundaries** *(not written yet)* owns the structural fix, and
the tell is that the copies are of *transactional* rather than *reference* data.

**★ It is an investment, and investments can be misallocated.** A completion path, a status
resource, a reconciliation job and three alarms is real work. On a low-traffic endpoint with a
reliable dependency it is worth less than the availability it buys. Spend it on the endpoints in
**48 · The interaction inventory** *(not written yet)* with the worst arithmetic.

## Interview questions

**★ What is a self-contained service?**
Richardson's definition is a service that responds to a synchronous request with a partial outcome
and then completes the operation asynchronously. Its availability for that operation depends only
on things it owns — its process, its database, its local copies — rather than on any other service
being up at the moment of the call. It is the general form of the specific remedies in this topic:
local copies, soft dependencies and `202 Accepted` are all ways of removing something from the
set of things that must be available during the response.

**★ What is the cost, and who pays it?**
Client complexity, primarily — the client must model a pending state and discover the outcome
later, which Richardson names explicitly as the trade. The service pays by building and monitoring
a completion path. Operations gains fewer correlated outages and takes on new alarms for consumer
lag, dead letters and stuck jobs. And the business has to decide what happens to work that was
accepted and later cannot be completed, which is a policy question engineering will otherwise
answer by default.

**★ How would you take an endpoint with five synchronous dependencies to self-contained?**
In order of payoff. Replace enrichment reads with local copies, which usually removes most of the
five. Classify what remains as hard or soft and give every soft one a defined degraded answer. For
each remaining hard hop, ask whether the decision could be made against a bounded-staleness copy
and confirmed later. Make whatever is left a durable local accept in the same transaction as the
business change. Return `202` with a status resource. Then build and — critically — monitor the
completion path.

**★ Why does an outbox in your own database beat a broker for availability?**
Because it introduces no new dependency. The endpoint already depends on its own database, so
committing the outstanding work as a row in the same transaction makes the endpoint's availability
exactly its own store's — no broker term in the product, and no failure mode where the business
change commits and the handoff does not. The broker is still involved downstream, when the drainer
publishes, but by then the caller has been answered and the work is durable, so the broker's
availability affects latency rather than availability of the response.

**★ When would you decline to make a service self-contained?**
When there is no acceptable compensation for accepting work you later cannot complete — a
sanctions check, an authorisation you must not fake. When the client cannot model a pending state,
which is common with fixed third-party contracts. And when the endpoint's volume or criticality
does not justify a completion path, a status resource and the monitoring that comes with them —
self-containment is an investment, and on a quiet internal endpoint with a reliable dependency it
can cost more than the availability it buys.

{/* FOOTER */}
