---
title: "The property that actually hurts is temporal — the callee has to be up right now — and it survives a message broker, a retry loop and a reactive client entirely intact"
sidebar_label: "03 · Temporal coupling"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io — "Pattern: Messaging"
> ([microservices.io](https://microservices.io/patterns/communication-style/messaging.html)),
> "Pattern: Remote Procedure Invocation (RPI)"
> ([microservices.io](https://microservices.io/patterns/communication-style/rpi.html)) — and
> Chris Richardson, "A phone company's customer experience: a great example of undesirable
> tight runtime coupling"
> ([microservices.io](https://microservices.io/post/architecture/2025/01/07/phone-company-cx-tight-runtime-coupling.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8. **No sandbox.**

**Runtime coupling is a degree; temporal coupling is the specific mechanism that produces
it. Two parties are temporally coupled when they must both be available *at the same
instant* for the work to proceed. That is the property, and it is the one to test for,
because it is invariant under every superficial change you might make: putting the call
behind an interface does not remove it, making the client non-blocking does not remove it,
adding retries does not remove it, and — the one that surprises people — routing the call
through a message broker does not remove it either. Only introducing something durable
between the two parties, that accepts the work on the callee's behalf, removes it.**

## The definition, and the test

Richardson's phone-company article states the shape in plain terms:

> *"service X (e.g. the `Order Service`) cannot respond to a request (e.g. `POST /orders`)
> until another service Y (e.g. `Customer Service`) has responded to it."*

and draws the human analogy that makes it stick — being kept on hold while the
representative calls another department:

> *"The end-to-end flow 'me -> customer service rep -> other departments' is an example of
> tight runtime coupling. We all needed to be available at the same time in order to make
> the changes."*

The article's image for the consequence is worth stealing for design reviews:

> *"behave like a string of Christmas tree lights: if one light goes out, they all go out."*

**The test is one question**: *if the callee were stopped for five minutes, what happens to
work the caller is asked to do during those five minutes?* Three possible answers:

| Answer | Coupling |
|---|---|
| It fails, and the user sees an error | Temporally coupled, hard |
| It succeeds with a reduced answer | Temporally coupled, soft — degraded |
| It succeeds fully, and the callee catches up later | Not temporally coupled |

Only the third row is decoupling. The second row is a mitigation, and a good one, but the
dependency is still there — you have merely decided what to do about it.

## Three couplings that get confused with it

**Spatial (location) coupling** — the caller needs to know *where* the callee is. This is
what service discovery removes: an address becomes a name, and instances come and go
without the caller changing. **08 · Service discovery** *(not written yet)* owns it. Removing
spatial coupling feels like a big architectural win and changes availability by exactly
nothing: you still need an instance to be up, you just no longer need to know its IP.

**Format (schema) coupling** — the caller and callee must agree on the shape of the payload.
Removing this is design-time work: tolerant readers, additive evolution, versioning.
**05 · Inter-service REST** *(not written yet)* owns it. Also changes availability by
nothing.

**Temporal coupling** — the callee must be running now. This is the only one of the three
that appears in the availability arithmetic, and it is the least likely of the three to
appear in an architecture diagram.

An architecture can be perfectly location-decoupled and format-decoupled and still be a
string of Christmas tree lights.

## Why a broker does not automatically remove it

This is the mistake worth naming loudly, because it is made by teams who have already done
the work of adopting messaging and therefore believe they are finished.

A broker removes temporal coupling **only when the caller stops needing the reply.** If the
caller publishes a request onto a queue and then blocks waiting for a correlated response on
a reply queue, then during those five minutes of consumer downtime:

- the caller's request thread is still occupied,
- the caller's operation still does not complete,
- the caller still times out and still returns an error to the user.

The broker has buffered the *message*. It has not buffered the *outcome*, and the outcome is
what the caller needed. The interaction is synchronous in spirit and only asynchronous in
transport. [05d · Request/reply over messaging](05d-request-reply-over-messaging.md) takes
this apart properly, including the cases where it is nonetheless the right design.

The messaging pattern's own benefit line is precise about where the improvement comes from:

> *"Improved availability since the message broker buffers messages until the consumer is
> able to process them"*

Buffering helps when nobody is waiting on the buffer to drain. If someone is waiting, you
have added a hop and kept the coupling.

## What durability buys, exactly

The thing that removes temporal coupling is **a durable handoff**: a store that accepts the
work, survives a crash, and is the caller's dependency instead of the callee. The caller is
then temporally coupled to *that store* and to nothing else downstream of it.

This reframing is the practically useful one, because it makes the trade explicit rather
than magical:

- You did not eliminate a dependency. You **swapped** a dependency on a business service
  (bespoke, changes weekly, owned by another team, one instance per environment in staging)
  for a dependency on infrastructure (boring, changes yearly, clustered, operated as a
  platform service).
- That swap is usually a very good deal, because infrastructure is easier to make highly
  available than an application is.
- It is not a free deal, and pretending it is leads to the surprise in
  [08d · The broker is a dependency too](08d-the-broker-is-a-dependency-too.md).

The store does not have to be a broker. A row in your own database, written in the same
transaction as the business change and drained by a poller, is a durable handoff with the
strongest possible availability property: **the caller depends only on its own database**,
which it already depended on. That is the transactional outbox, and **phase 15 owns its
mechanics** — see [Phase 15 · Messaging and event-driven
architecture](../../phase-15-messaging-event-driven/README.md). What belongs here is the
coupling consequence: an outbox makes the caller's availability independent of both the
callee *and* the broker.

## In-process async is not a durable handoff

Spring's own application events are the trap. This looks asynchronous:

```java
@Service
class OrderService {

    private final ApplicationEventPublisher events;
    private final OrderRepository orders;

    OrderService(ApplicationEventPublisher events, OrderRepository orders) {
        this.events = events;
        this.orders = orders;
    }

    @Transactional
    public Order place(PlaceOrder command) {
        Order order = orders.save(Order.of(command));
        events.publishEvent(new OrderPlaced(order.id(), order.total()));
        return order;
    }
}

@Component
class NotifyOnOrderPlaced {

    @Async
    @EventListener
    void on(OrderPlaced event) {
        // runs on a task executor thread
    }
}
```

And it does remove temporal coupling to the *notification work* — the caller returns without
waiting. But the Spring Framework reference is explicit that the default has no thread at
all:

> *"You can register as many event listeners as you wish, but note that, by default, event
> listeners receive events synchronously. This means that the `publishEvent()` method blocks
> until all listeners have finished processing the event."*

So without `@Async` this is not asynchronous in any sense. And *with* `@Async` it is
asynchronous but **not durable**: the event lives in a queue inside one JVM's heap. If the
pod is killed between the publish and the listener running, the event is gone, silently. The
reference also warns that failures do not come back to you:

> *"If an asynchronous event listener throws an `Exception`, it is not propagated to the
> caller."*

and that

> *"ThreadLocals and logging context are not propagated by default for the event
> processing."*

That last one is why an `@Async` listener loses your correlation ID unless you do something
about it — see **10 · Correlation across services** *(not written yet)*.

In-process events are an excellent tool for decoupling *modules* inside one deployable, and
Spring Modulith builds a durable event registry on top of exactly this mechanism. As a
substitute for a durable handoff between services, they are a way to lose work quietly.

## Gotchas

**★ A retry loop makes temporal coupling worse, not better.**
Retrying a call to a service that is down means the caller holds its request open longer,
occupying a thread, a connection and a request slot for the full retry schedule, and then
fails anyway. The user waited three times as long for the same error, and the caller's
capacity was consumed while doing it. Retries help with *transient* faults measured in
milliseconds; they do nothing for an outage measured in minutes, which is the case temporal
coupling is about.

**★ Non-blocking clients hide temporal coupling by making it cheap to hold.**
`WebClient` returning a `Mono` does not pin a platform thread while it waits, so a caller
with a dead dependency can hold tens of thousands of in-flight requests without exhausting a
pool. That sounds like resilience and is actually a queue of doomed work: every one of them
still fails at the deadline, and the memory they occupy is real. The failure got quieter,
not smaller.

**★ Health checks make temporal coupling contagious.**
If a service's readiness probe calls its dependencies, then a dependency outage makes the
caller's pods report not-ready, Kubernetes takes them out of service, and an outage in one
service becomes an outage in two. A readiness probe should answer "can this process serve
traffic", not "is the whole system healthy". This is a genuinely common production incident
and it is caused by encoding temporal coupling into the platform's control loop.

**★ Staging environments hide it because everything is always up.**
Every service runs as a single replica that nobody restarts during your test, so a chain of
six synchronous hops behaves perfectly. Temporal coupling is only visible when something
stops, and nothing stops in staging. This is why the arithmetic in
[03](03-availability-multiplication.md) matters — it is the only way to see the problem
before production shows it to you.

**★ Async does not remove temporal coupling if the consumer's queue has no dead-letter
path.** If the consumer fails permanently on a message and the broker redelivers forever,
the work is never done and nobody is told. The caller is decoupled; the *business outcome*
is not. Durable handoff removes the availability dependency and creates an obligation to
monitor completion — see [08 · Async is not free](08-async-is-not-free.md).

## Interview questions

**★ Define temporal coupling and give the one-sentence test for it.**
Two parties are temporally coupled when both must be available at the same instant for the
work to proceed. The test: if the callee were stopped for five minutes, would work the
caller is asked to do during those five minutes still complete? If it fails or degrades,
they are coupled; if it completes and the callee catches up afterwards, they are not.

**★ Does putting a message broker between two services remove temporal coupling?**
Only if the caller stops needing a reply. Fire-and-forget over a broker genuinely removes
it, because the broker's durable buffer completes the caller's obligation. Request/reply
over a broker does not: the caller still blocks on a correlated response, still times out
when the consumer is down, and has simply added a hop and a correlation mechanism to a
synchronous interaction. The buffer helps the *message* survive; it does not help the caller
that is waiting for the buffer to drain.

**★ You cannot introduce a broker. Can you still remove temporal coupling?**
Yes — the durable handoff does not have to be a broker. Write the intent into your own
database in the same transaction as the business change, return to the caller, and have a
scheduled poller or a change-data-capture process drain the table and perform the remote
call. The caller's availability then depends only on its own database, which it already
depended on, and that is strictly better than depending on a broker as well. The pattern is
the transactional outbox; phase 15 owns building one.

**★ Why is a readiness probe that checks dependencies a bad idea, in coupling terms?**
It converts your dependency's temporal coupling into a platform-level action. When the
dependency fails, the probe fails, the orchestrator removes your pods from the load
balancer, and requests that could have been served with a degraded response are not served
at all. You have taken a partial outage and escalated it to a total one, and you have done
so automatically, at the speed of the control loop. Readiness answers "is this process able
to serve", liveness answers "should this process be restarted"; neither should answer "is
the rest of the system healthy".

**★ Is `@Async @EventListener` in Spring an asynchronous integration between services?**
No, on two counts. It is not between services — it is inside one JVM. And it is not durable:
the event sits in an in-memory executor queue, so a pod restart between publish and handling
loses it, with no error anywhere because the reference states that exceptions from an
asynchronous listener are not propagated to the caller. It is a good tool for decoupling
modules in a deployable; used as a stand-in for a durable handoff it silently drops work.

**★ Location coupling, format coupling, temporal coupling — which one shows up in the
availability arithmetic?**
Only temporal. Service discovery removes location coupling and a tolerant reader removes
format coupling, and neither changes the probability that an instance is up when you call
it. Both are valuable; neither is an availability improvement. Conflating them is how a team
finishes a discovery migration believing they have improved resilience.

{/* FOOTER */}
