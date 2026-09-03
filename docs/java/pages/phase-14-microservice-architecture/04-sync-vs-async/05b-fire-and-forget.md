---
title: "Fire-and-forget is the only shape that genuinely removes temporal coupling, and it does so by giving up the one thing every other shape keeps — knowing whether the work happened"
sidebar_label: "19 · Fire-and-forget"
sidebar_position: 19
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io "Pattern: Messaging"
> ([microservices.io](https://microservices.io/patterns/communication-style/messaging.html)),
> the Spring Framework 7.0.x reference on application events
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/core/beans/context-introduction.html)),
> and RFC 9110 §15.3.3
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9110.html#name-202-accepted)).
> 🔴 **No sandbox.** Version spine: JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Notification — "fire-and-forget" in everyday speech — is the shape where the sender's work is
complete the moment the message is durably accepted. It is the only interaction style that
removes temporal coupling outright rather than softening it, which makes it the most valuable
tool in this topic and also the most frequently mis-implemented. The two failure modes are
symmetrical: teams that use it where a result was needed, and teams that avoid it because they
mistake "I do not wait for the outcome" for "I do not know whether it was accepted".**

## What the sender actually gives up

Precisely one thing: **the outcome.** Everything else is negotiable and most of it is
recoverable.

| The sender gives up | Can it be recovered? |
|---|---|
| Knowing the work succeeded | Yes — via a status resource, an event back, or a reconciliation job |
| Knowing the work happened *yet* | No, by construction. That is the point |
| The ability to react to a business failure inline | No — the failure is handled by the consumer or by a compensating flow |
| Ordering relative to the sender's other work | Partially, at cost — see **40** *(not written yet)* |
| Knowing the message was accepted | **No.** This is not given up, and believing it is causes the mistake below |

That last row is the one to internalise. **Fire-and-forget does not mean "throw it and hope".**
The sender still gets a synchronous, immediate answer from the durable store — a publisher
confirm, a database commit, an HTTP 202 — and it must treat a failure of *that* as a failure of
its own operation. What it gives up is knowledge of what happens next, not knowledge of whether
the handoff occurred.

The messaging pattern's benefit line describes exactly this bargain:

> *"Improved availability since the message broker buffers messages until the consumer is able
> to process them"*

The buffer is what the sender is depending on, and the buffer is up.

## Where the boundary of the sender's responsibility sits

```text
[ sender's operation                              ]
  business change  →  durable accept  →  return
                                        ────────── boundary
                                                   consumer runs, eventually
```

The sender's operation succeeds if and only if both the business change and the durable accept
succeeded, **atomically**. If the business change commits and the publish fails, you have work
that will never happen. If the publish succeeds and the business change rolls back, you have
told the world about something that did not occur.

That atomicity problem is the transactional outbox, and **phase 15 owns building one** — see
[Phase 15 · Messaging and event-driven
architecture](../../phase-15-messaging-event-driven/README.md). The reason it appears here is
that **the coupling benefit of fire-and-forget is only real if the handoff is atomic with the
business change.** A `publishEvent` after a `commit` with no outbox is a shape that looks like
fire-and-forget and silently loses work, which is worse than the synchronous call it replaced.

## When it is the right shape

The test from [18](05-the-five-interaction-styles.md): the caller can finish its own work
without the callee's answer, and nobody needs the result inline.

Genuine cases, which are more common than teams assume:

- **Notifications to the outside world.** Email, SMS, push. The user does not need the email to
  have been delivered before their order is confirmed, and coupling order placement to an SMTP
  server's availability is indefensible.
- **Analytics, audit and search indexing.** By definition the result is not needed to answer the
  request.
- **Cache and read-model invalidation.** The read model can be a second behind. Making the write
  path wait for it is buying consistency the product does not need.
- **Telling another bounded context that something happened**, where that context decides for
  itself what to do about it. This is the pub/sub case and is
  [22 · Event notification](05e-event-notification.md).
- **Long-running work the user does not sit through.** Report generation, bulk import, media
  processing. `202 Accepted` and a status resource —
  [28 · The user who is waiting](06e-the-user-who-is-waiting.md).

## When it is the wrong shape, and the tell

The tell is that somebody, somewhere, is polling or asking "did it work?". If the sender's own
caller needs the outcome within the same interaction, fire-and-forget has not removed the
coupling — it has moved it into a loop.

Two specific anti-patterns:

**Publish, then poll for the result.** The sender publishes a command and then polls its own
database until the consumer has written the answer. This has all the coupling of request/reply,
plus a broker, plus polling load, plus a timeout that is now implemented by hand. If you need
the answer, ask for it.

**Publish and assume.** The sender publishes and updates its own state as though the work had
succeeded. When the consumer fails permanently, the two states diverge and nothing detects it.
Optimistic local state is defensible; optimistic local state with no reconciliation is a bug
with a delay fuse.

## The in-process trap, restated because it is common

```java
@Transactional
public Order place(PlaceOrder command) {
    Order order = orders.save(Order.of(command));
    events.publishEvent(new OrderPlaced(order.id(), order.total()));  // NOT fire-and-forget
    return order;
}
```

The Spring Framework reference is unambiguous about the default:

> *"You can register as many event listeners as you wish, but note that, by default, event
> listeners receive events synchronously. This means that the `publishEvent()` method blocks
> until all listeners have finished processing the event."*

So without `@Async` this is a synchronous in-process call with extra indirection — and it
inherits the publisher's transaction, which the reference calls out as an advantage:

> *"One advantage of this synchronous and single-threaded approach is that, when a listener
> receives an event, it operates inside the transaction context of the publisher if a
> transaction context is available."*

Add `@Async` and it becomes genuinely non-blocking and **not durable**: the event is in an
executor queue in one JVM's heap, so a pod restart loses it, and the reference confirms nothing
will tell you:

> *"If an asynchronous event listener throws an `Exception`, it is not propagated to the
> caller."*

**In-process events are the right tool for decoupling modules inside a deployable, and the wrong
tool for a durable handoff between services.** Spring Modulith exists partly to close that gap
with a durable event registry — **01 · Monolith first** *(not written yet)* owns it.

## Gotchas

**★ Fire-and-forget with no durable accept is data loss with a nice name.** If the publish is
best-effort, or happens after the transaction commits with no outbox, then a broker blip or a
pod restart silently drops work. The sender must treat the durable accept as part of its own
transaction, or it has not implemented this pattern — it has implemented losing things.

**★ "We don't need the result" is often "we don't need it in this thread".** Those are different
statements. If somebody eventually needs to know the outcome, design the channel for it now — a
status resource, a completion event, a reconciliation report. Retrofitting outcome visibility
onto an established fire-and-forget flow means building it during the incident that revealed the
need.

**★ Nobody is watching the consumer.** The sender's dashboards are green because the sender
succeeded. If the consumer fails on every message and dead-letters them, the only signal is a
queue depth or DLQ count that nobody alarmed on. **A fire-and-forget flow needs an alarm on the
consumer side or it is unmonitored by construction.**

**★ Retrying the publish is safe; retrying the business change is not.** If the durable accept
fails and the sender retries the whole operation, it may repeat the business change. The
handoff must be idempotent (a message key) or transactional (an outbox row), or a transient
broker failure produces duplicate work. See
[33 · Idempotency on the wire](07d-idempotency-on-the-wire.md).

**★ Ordering is not preserved just because you sent in order.** Two notifications published a
millisecond apart can be processed in either order by a multi-consumer subscriber. If the
consumer's correctness depends on order, you have a requirement the shape does not provide —
**40 · Duplicates and ordering** *(not written yet)*.

**★ Fire-and-forget hides latency rather than removing work.** The consumer still does the work,
still needs capacity, and still falls behind under load. What changes is that the backlog is
visible and drainable instead of being a queue of blocked callers. That is a large improvement
and it requires you to alarm on lag, which is a new operational obligation.

## Interview questions

**★ What exactly does the sender give up in a fire-and-forget interaction?**
The outcome, and the ability to react to it inline. It does not give up knowledge that the
message was accepted — the durable handoff, whether that is a publisher confirm, an outbox row
committed in the business transaction, or a `202 Accepted`, is synchronous and its failure is
the sender's failure. Conflating "I don't wait for the result" with "I don't know if it was
accepted" is what turns the pattern into silent data loss.

**★ Why is fire-and-forget the only shape that truly removes temporal coupling?**
Because the sender's operation completes without any other service being available. Something
durable accepts the work on the consumer's behalf, so the consumer can be down for minutes or
hours and the sender is unaffected. Every other style — including request/reply over a broker —
leaves the sender waiting on a party that must be running now. The trade is that the sender
depends on the durable store instead, which is usually a much better dependency to have.

**★ You publish an event immediately after committing the business transaction. What can go
wrong?**
The commit succeeds and the publish fails, so the work is committed and nobody will ever be told
about it — silently, since the sender's own operation already succeeded. The reverse ordering
fails the other way: you publish, then the commit rolls back, and you have announced something
that did not happen. The fix is to make the handoff part of the same transaction, which is the
transactional outbox pattern; phase 15 owns building it.

**★ Is `@Async @EventListener` a fire-and-forget integration?**
No. It is in-process and non-durable. The event lives in an executor queue in one JVM's heap, so
a restart between publish and handling drops it, and the Spring reference states that exceptions
from an asynchronous listener are not propagated to the caller — so the loss is silent in both
directions. It is a good tool for decoupling modules inside a single deployable, and a way to
lose work if used as a substitute for a durable handoff between services.

**★ How do you monitor a fire-and-forget flow?**
On the consumer side, because the sender has no visibility by construction and its own metrics
will be green regardless. The minimum set is consumer lag or queue depth, dead-letter count with
an alarm on any non-zero value, processing failure rate, and — for anything that matters — a
reconciliation that compares the sender's view with the consumer's and reports divergence. If
none of those exist, the flow is unmonitored no matter how healthy the dashboards look.

{/* FOOTER */}
