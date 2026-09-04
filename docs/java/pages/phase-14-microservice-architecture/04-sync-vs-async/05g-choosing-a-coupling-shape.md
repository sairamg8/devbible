---
title: "Put the shapes side by side against what each one removes and the choice stops being a preference — there is exactly one shape per interaction that removes the coupling you actually have without paying for one you do not"
sidebar_label: "24 · Choosing a shape"
sidebar_position: 24
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Martin Fowler, "What do you mean by 'Event-Driven'?"
> ([martinfowler.com](https://martinfowler.com/articles/201701-event-driven.html)),
> microservices.io "Pattern: Messaging"
> ([microservices.io](https://microservices.io/patterns/communication-style/messaging.html))
> and "Pattern: Remote Procedure Invocation (RPI)"
> ([microservices.io](https://microservices.io/patterns/communication-style/rpi.html)).
> 🔴 **No sandbox.** Version spine: JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Five chunks of shapes, one table. Each shape removes a specific coupling and charges a
specific price, and the shapes are not on a spectrum from bad to good — they are answers to
different questions. This chunk is the comparison, followed by the decision rule, followed by
the ways teams get it wrong in both directions: the team that keeps everything synchronous
because events are scary, and the team that makes everything an event because synchronous is
"tightly coupled".**

## The comparison

| | Request/reply | Fire-and-forget | Request/async response | Event notification | Event-carried state |
|---|---|---|---|---|---|
| Caller gets the result | inline | never | later, other channel | never | it already has the data |
| Callee must be up now | **yes** | no | no | no | **no callee at all** |
| Callee in availability product | yes | no | no | no | no |
| Callee's latency in your budget | yes | no | no | no | no |
| Broker required | no | yes¹ | yes¹ | yes | yes |
| Caller inherits timeouts/retries | yes | handoff only | handoff only | handoff only | none |
| Failure visible to caller | immediately | never | on the reply channel | never | n/a |
| Ordering | trivial | not guaranteed | not guaranteed | not guaranteed | version-guarded |
| Data duplication | none | none | none | none | **yes** |
| Consumers can be added freely | no | no | no | **yes** | yes |
| Business flow readable in one place | **yes** | mostly | partly | **no** | no |

¹ Or any durable handoff — an outbox table drained by a poller counts, and depends only on your
own database.

## The decision rule

Ask the questions in this order. The first "yes" is your answer.

**1 · Does the caller need the result to produce its own response?**
Yes → **request/reply**, and price it: [05](03-availability-multiplication.md) for the
availability, [11](04-the-latency-budget.md) for the budget,
[30](07-what-the-caller-inherits.md) for the obligations. Then go to question 1a.

**1a · Could the caller already have the data?**
If what it needs is reference data owned elsewhere but rarely changing, the answer to question 1
was a false positive: use **event-carried state transfer** and the call disappears. This is the
question that gets skipped, and it is the one with the largest payoff —
[26](06c-the-read-that-could-have-been-a-copy.md).

**2 · Does anyone need to know the outcome, eventually?**
Yes → **request/asynchronous response**. The caller returns now, the result arrives on a status
resource, a callback or a reply channel. [28](06e-the-user-who-is-waiting.md).

**3 · Does exactly one known party need to act, and the caller does not care about the result?**
Yes → **fire-and-forget / directed notification**. [19](05b-fire-and-forget.md).

**4 · Do several parties care, or might they in future?**
Yes → **event notification via publish/subscribe**. [22](05e-event-notification.md).

**5 · None of the above.**
Then the interaction probably should not exist. This happens more often than you would think —
"we call them to log that it happened" is frequently answered by the audit consumer subscribing
to an event that already exists.

## The two failure directions

**Everything synchronous.** The team never priced a hop, so hops accumulate: five clients on the
hottest endpoint, an availability ceiling below the SLO, an unallocatable latency budget, and an
incident profile where any dependency's bad day is everyone's bad day. The tells are in
**12 · The distributed monolith** *(not written yet)*. The fix is not a broker; it is
[26](06c-the-read-that-could-have-been-a-copy.md) and
[10](03e-hard-and-soft-dependencies.md), both of which are available without one.

**Everything asynchronous.** The team read that synchronous calls are harmful and made every
interaction an event. What they got:

- A business flow that exists in no artefact, only in the union of eleven subscriptions.
- Eventual consistency in places the product never asked for it — the user creates something and
  cannot see it, which is **39** *(not written yet)*.
- Request/reply reimplemented over queues wherever the answer was genuinely needed, which is
  [21](05d-request-reply-over-messaging.md) — the worst cell in the whole design space.
- A broker that must be clustered, monitored, upgraded and understood by whoever is on call.
- Debugging that requires correlating across services, which is why
  **10 · Correlation across services** *(not written yet)* becomes load-bearing.

**Both failures come from applying one answer to every interaction.** The correct output of this
band is a *table*, with a row per interaction and possibly five different shapes in it.

## Shapes you can adopt without a broker

Worth stating explicitly, because "we can't do async, we don't have Kafka" blocks a lot of easy
wins:

- **Delete the call.** Nothing needed. [26](06c-the-read-that-could-have-been-a-copy.md).
- **Make the dependency soft.** A defined degraded answer. Nothing needed.
  [10](03e-hard-and-soft-dependencies.md).
- **`202 Accepted` plus a status resource**, with the work queued in your own database table and
  drained by a scheduled poller. This is genuine fire-and-forget with a durable handoff, and the
  handoff is your own database — a strictly better dependency than a broker.
  [28](06e-the-user-who-is-waiting.md).
- **A local copy fed by polling** rather than by events. Cruder than event-carried state transfer,
  same availability property, no broker.

Three of the five decision-rule outcomes are reachable with a database table and a scheduler.
**Phase 15 is how you do this well; it is not a prerequisite for doing it at all.**

## Gotchas

**★ Picking one shape for a pair of services guarantees the wrong one on some interaction.**
Order and Payment need synchronous authorisation, asynchronous cancellation notice, and a
subscription to settlement events. One answer for the pair means at least two interactions are
badly shaped. Decide per interaction, always.

**★ "We might need more consumers later" is used to justify pub/sub for one known consumer.**
The extensibility is real and so is the cost — you lose the ability to read the flow in the
producer's code, today, in exchange for an option you may never exercise. Buy the option when
there is a second consumer, not before.

**★ The decision rule's question 1 produces false positives constantly.** "The caller needs the
customer's name to render the confirmation" reads as a yes, and it is a no: the caller needs the
*name*, not a *call*. Always follow a yes on question 1 with question 1a.

**★ Adopting a broker changes nothing about coupling on its own.** A broker is a mechanism for
durable handoff. If the shapes above it are all request/reply, you have added an operational
commitment and a dependency and changed no arithmetic. The shape is the decision; the broker is
an implementation.

**★ A shape chosen at design time gets silently changed by a feature request.** "Also show the
loyalty tier" adds a synchronous hop to an endpoint whose shape was carefully decided. Nothing in
review flags it as an architecture change. This is why the inventory in
**48** *(not written yet)* is a living document rather than a one-off exercise.

**★ Event-carried state transfer is skipped because it "duplicates data", as though that were
self-evidently disqualifying.** It is a cost, and it is usually a much smaller cost than a hard
synchronous dependency on the read path. Weigh it; do not treat "no duplication" as a principle
that outranks availability.

## Interview questions

**★ Walk through how you would choose an interaction shape.**
In order: does the caller need the result to produce its response — and if so, could it already
have the data, which converts many apparent yeses into event-carried state transfer. If not, does
anyone need the outcome eventually, which is request/asynchronous response. If not, does exactly
one known party need to act, which is a directed notification. If several might, publish/subscribe.
If none of those apply, the interaction probably should not exist. The order matters because the
early questions are the ones that eliminate hops rather than reshaping them.

**★ What goes wrong when a team makes everything asynchronous?**
The end-to-end business flow stops existing as a readable artefact and lives only in the union of
subscriptions; eventual consistency appears in places the product never asked for it, so users
create things they cannot immediately see; request/reply gets reimplemented over queues wherever
the answer was genuinely needed, which is the most expensive shape available; and the broker
becomes an operational commitment that has to be clustered, monitored and understood by whoever is
on call. It is the same mistake as making everything synchronous — one answer applied to every
interaction.

**★ You have no message broker and cannot get one this quarter. What can you still do?**
Most of it. Delete calls by copying reference data, maintained by polling if not by events. Convert
hard dependencies to soft ones by defining degraded answers, which needs no infrastructure at all.
Accept long-running work with `202 Accepted`, storing it in your own database and draining it with
a scheduled poller — that is a durable handoff whose only dependency is a database you already
have, which is a better dependency than a broker. Three of the five shapes are reachable without
any new infrastructure.

**★ Which shape would you pick for "notify the warehouse that an order was placed", and why?**
Event notification, published once by the order service, with enough state on the event that the
warehouse does not have to call back — so, in practice, sliding toward event-carried state
transfer. The order service's operation is complete once the event is durably accepted, so the
warehouse's availability leaves the order path entirely, and other consumers (analytics, customer
notifications) can subscribe without the order service changing. The obligations that come with it
are an outbox for atomicity, a version field for idempotent consumption, and an alarm on the
warehouse's consumer lag.

**★ Give an example where request/reply is right and the alternatives would be wrong.**
Authorising a card payment during checkout. The caller cannot produce its response without the
answer — an order accepted on the assumption of a successful authorisation is a business decision
somebody has to actually make, not a technical shortcut. The data cannot be copied, because
authorisation is a decision about the present made by a party you do not control. And nobody is
served by the user completing checkout and learning ten seconds later that their card was
declined. Here you accept the availability cost, budget the timeout tightly, decide explicitly
what a timeout means, and make the call idempotent so a retry cannot double-charge.

{/* FOOTER */}
