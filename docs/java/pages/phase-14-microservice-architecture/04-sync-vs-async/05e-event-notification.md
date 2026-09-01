---
title: "Event notification is the cheapest decoupling there is and the easiest to undo, because the moment a consumer calls back to the producer for the details it has restored every dependency the event removed"
sidebar_label: "22 · Event notification"
sidebar_position: 22
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Martin Fowler, "What do you mean by 'Event-Driven'?"
> ([martinfowler.com](https://martinfowler.com/articles/201701-event-driven.html)),
> microservices.io "Pattern: Event-driven architecture"
> ([microservices.io](https://microservices.io/patterns/data/event-driven-architecture.html))
> and "Pattern: Messaging"
> ([microservices.io](https://microservices.io/patterns/communication-style/messaging.html)).
> 🔴 **No sandbox, and no broker mechanics** — phase 15 owns those. Version spine: JDK 25 ·
> Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Event notification is the pattern where a service announces that something happened and does
not care who listens or what they do about it. Fowler's definition emphasises exactly that
indifference, and the indifference is the source of both its value and its failure modes. It is
the cheapest way to remove a dependency; it is also the shape that most easily degrades back
into coupling, because a thin event forces every consumer to come back and ask for details — and
that question is a synchronous call to the producer.**

## Fowler's definition, verbatim

> *"A system sends event messages to notify other systems of a change in its domain. A key
> element of event notification is that the source system doesn't really care much about the
> response."*

and on what it buys:

> *"It implies a low level of coupling, and is pretty simple to set up."*

and the cost, which is the one people discover in month three:

> *"the risk is that it's very easy to make nice decoupled programs without really realizing
> that you're losing sight of that larger-scale flow, and thus set yourself up for trouble in
> future years."*

That last point is the one that appears again in **12 · The distributed monolith**
*(not written yet)*: a business process that exists nowhere as a written artefact and only
emerges from the runtime behaviour of eleven listeners is a system nobody can reason about.

## What the shape removes

The producer's operation is complete once the event is durably accepted. From there:

- **No consumer needs to be up.** The availability term for every consumer leaves the producer's
  product entirely.
- **The producer does not know its consumers.** Adding a twelfth consumer is a change in one
  team's repository and requires no producer deploy — which is the design-time benefit and the
  reason pub/sub is chosen over a directed notification.
- **Fan-out is free at the producer.** One publish, n consumers, no change to the producer's
  latency budget as n grows.

Those are real and large. The rest of this chunk is about keeping them.

## The failure mode: the thin event and the callback

An event carrying only an identifier —

```json
{ "type": "OrderPlaced", "orderId": "ord_8f21", "occurredAt": "2026-09-01T09:14:02Z" }
```

— forces every consumer to call back to the producer for the details it needs. Now:

- The consumer is **synchronously coupled to the producer**, in the opposite direction from the
  original dependency, so you have not removed a dependency but rotated it.
- The producer receives one callback **per consumer per event**, so its read load scales with the
  number of subscribers — which is the extensibility benefit turning into a capacity liability.
- The callback returns the **current** state, not the state at the time of the event. If the
  order has since been amended, the consumer processes an event about one version of reality
  using the data of another. This is a genuine correctness bug and it is subtle enough to survive
  code review.

**That third point is the one to remember.** Event notification with a callback is not merely
inefficient; it is *incorrect* whenever the aggregate can change between publication and
consumption, which is always.

The remedies, in order:

1. **Put enough in the event.** Not the whole aggregate — the fields consumers actually need,
   captured at the moment the event occurred. This is the slide toward
   [23 · Event-carried state transfer](05f-event-carried-state-transfer.md), and where the line
   sits is a judgement about how many consumers there are and how much they need.
2. **Version the callback.** If consumers must fetch, let them fetch the version the event names
   (`GET /orders/ord_8f21?version=7`), so they see the state the event described. This costs the
   producer a history, which is a real commitment.
3. **Accept the staleness explicitly**, where the consumer's work is genuinely order-insensitive.
   That is a decision to write down, not to assume.

## Notification is not the same as pub/sub

Two independent choices that get conflated:

| | Directed notification | Publish/subscribe |
|---|---|---|
| Producer names the recipient | Yes | No |
| Adding a consumer needs a producer change | Yes | No |
| Where the flow is documented | In the producer | Nowhere, unless you document it |
| Debuggability | Good — the call graph is in the code | Poor — you must know the subscriptions |

Both remove temporal coupling equally. Pub/sub additionally removes design-time coupling to the
consumer list, and pays for it in traceability. **With one known consumer, a directed
notification is usually the better engineering choice**, and the argument that "we might have
more consumers later" should be weighed against the certainty of debugging it today.

## Events versus commands, and why the naming matters

The distinction that keeps the pattern honest:

- An **event** is a statement of fact in the past tense — `OrderPlaced`, `PaymentCaptured`. It
  makes no claim about what should happen next. The producer is indifferent to the response,
  which is Fowler's key element.
- A **command** is an instruction — `ProcessPayment`, `SendConfirmationEmail`. It has exactly one
  intended handler and it expects to be carried out.

A "notification" named `SendConfirmationEmail` is a command, and the producer *does* care whether
it is handled — it just has no way to find out. That is the worst combination: the semantics of
request/reply with the observability of fire-and-forget.

**The naming test**: if the message name contains a verb in the imperative, the producer has an
expectation, and that expectation needs a completion signal or a reconciliation.
[19 · Fire-and-forget](05b-fire-and-forget.md) covers the monitoring obligation.

## Where the data consistency argument lands

The Event-driven architecture pattern frames the whole thing as a consistency mechanism:

> *"Use an event-driven, eventually consistent approach. Each service publishes an event whenever
> it update its data. Other service subscribe to events. When an event is received, a service
> updates its data."*

with the benefit:

> *"It enables an application to maintain data consistency across multiple services without using
> distributed transactions"*

and the drawback stated in four words:

> *"The programming model is more complex"*

🔴 The atomicity problem it raises — updating your database and publishing an event as one unit —
is the transactional outbox, and **phase 15 owns it**. The saga, which is the multi-step version,
is **phase 15 topic 10**. What belongs here is that event notification is only as reliable as the
handoff underneath it, so the coupling benefit is contingent on solving that problem.

## Gotchas

**★ A thin event plus a callback is not decoupling, it is a rotated dependency.** The consumer now
depends synchronously on the producer, the producer's read load grows with the subscriber count,
and the consumer sees current state rather than the state the event described. All three are
worse than the direct call the event was meant to replace.

**★ Reading current state in response to a past event is a correctness bug, not an
inefficiency.** If the aggregate changed between publication and consumption, the consumer applies
logic for one version of reality to another version's data. It is intermittent, it depends on
timing, and it will not reproduce in a test.

**★ The business process disappears.** Fowler's warning is that you can lose sight of the
larger-scale flow entirely. With eleven listeners across six services, no artefact anywhere states
what happens when an order is placed. Write it down — a sequence diagram in the producing service's
README costs an hour and is the only defence.

**★ Adding a consumer is free for the producer's code and not free for its capacity.** Every new
subscriber that calls back adds read load; every new subscriber adds a partition of the broker's
throughput. "The producer doesn't need to change" is true of the source and false of the capacity
plan.

**★ An event named with an imperative verb is a command in disguise.** `SendWelcomeEmail` has one
intended handler and a producer that cares whether it ran. Publishing it to a topic gives you no
completion signal for something you are actually depending on. Either name it as a fact and stop
caring, or treat it as work that needs a completion channel.

**★ Consumers that fail are invisible to the producer, by design.** The producer's dashboards are
green regardless. If nobody owns the alarm on the consumer side — lag, dead-letter count, failure
rate — the flow is silently broken and stays that way. This is the standing operational tax of
event notification.

**★ Schema evolution failures land in other teams' logs, after your deploy has gone green.**
Adding a required field to an event breaks every consumer asynchronously, with no synchronous
error path back to you. Without consumer-driven contract tests, events remove the fast feedback
that used to enforce schema discipline — **11 · Contract testing** *(not written yet)*.

## Interview questions

**★ What is event notification, and what is the "key element" of it?**
A service announces that something happened in its domain and does not care what anyone does about
it — Fowler's key element is that *"the source system doesn't really care much about the
response"*. That indifference is what removes the coupling: the producer's operation is complete
once the event is durably accepted, so no consumer needs to be available, and the producer does
not even need to know the consumers exist.

**★ Why is a thin event carrying only an identifier often worse than the synchronous call it
replaced?**
Because every consumer has to call back to the producer for the details, which restores a
synchronous dependency in the opposite direction, multiplies the producer's read load by the
number of subscribers, and — the serious one — returns the *current* state rather than the state
at the time of the event. A consumer reacting to `OrderPlaced` by fetching an order that has since
been amended is applying the wrong logic to the wrong data, intermittently and untestably.

**★ You have exactly one known consumer. Directed notification or publish/subscribe?**
Directed notification, usually. Both remove temporal coupling equally; pub/sub additionally
removes the producer's design-time coupling to the consumer list, which is only worth something if
the list genuinely changes. What it costs immediately is traceability — with a directed
notification the flow is readable in the producer's code, and with pub/sub it exists only in the
broker's subscription state. Pay that cost when you are actually buying something with it.

**★ How do you tell an event from a command, and why does it matter?**
An event is a past-tense statement of fact with no expectation about what follows; a command is an
imperative with exactly one intended handler and an expectation that it happens. It matters
because a command published as an event gives you the semantics of request/reply — the producer
does depend on it being carried out — with the observability of fire-and-forget, which is the
worst combination available. The naming test catches it: an imperative verb in the message name
means the producer has an expectation, and an expectation needs a completion signal.

**★ What does event notification cost you that a direct call does not?**
The visibility of the end-to-end business flow, which Fowler names explicitly as the risk;
schema-evolution feedback, since a breaking change now fails in other teams' services after your
deploy succeeded; and an operational obligation on the consumer side, because the producer's
metrics are green whether or not anything was processed. Add to that the atomicity problem of
updating your data and publishing in one unit, which is real work that phase 15 owns.

{/* FOOTER */}
