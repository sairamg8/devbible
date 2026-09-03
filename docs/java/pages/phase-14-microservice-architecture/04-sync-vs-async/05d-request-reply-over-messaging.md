---
title: "Sending a request over a broker and blocking on a reply queue is synchronous in every way that costs you anything, and it is the most expensive way to stay coupled because you have paid for a broker and kept the dependency"
sidebar_label: "21 · Request/reply over messaging"
sidebar_position: 21
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io "Pattern: Messaging"
> ([microservices.io](https://microservices.io/patterns/communication-style/messaging.html))
> and "Pattern: Remote Procedure Invocation (RPI)"
> ([microservices.io](https://microservices.io/patterns/communication-style/rpi.html)), and
> Chris Richardson, "Dark matter force: minimize runtime coupling"
> ([microservices.io](https://microservices.io/articles/dark-energy-dark-matter/dark-matter/minimize-runtime-coupling.html)).
> 🔴 **No sandbox, and no broker mechanics** — phase 15 owns those. Version spine: JDK 25 ·
> Spring Boot 4.1.0 / Spring Framework 7.0.8.

**This is the chunk that stops a team from declaring victory too early. Having adopted a
message broker, it is natural to route existing request/reply calls over it — the client sends
to a request queue, sets a reply-to address and a correlation identifier, and blocks. Every
availability property of the original synchronous call is preserved exactly. The broker has
buffered the message; nobody has buffered the *outcome*, and the outcome is what the caller was
waiting for. What you have bought is a hop, a correlation mechanism, and a new dependency.**

## Why microservices.io lists it under "messaging"

The Messaging pattern's solution section lists request/response first among the *asynchronous
messaging* styles:

> *"Request/response — a service sends a request message to a recipient and expects to receive
> a reply message promptly"*

Note the word **promptly**. That is doing all the work in that sentence. The classification is
about the channel, not the coupling — and the same page's issues section flags the cost:

> *"Request/reply-style communication is more complex"*

More complex than what? Than the same interaction over HTTP, which needs no correlation
identifier, no reply queue, no timeout-and-abandon logic for an orphaned correlation, and no
decision about what to do with a reply that arrives after the caller gave up.

## The coupling, line by line

| Property | HTTP request/reply | Request/reply over a broker |
|---|---|---|
| Consumer must be up now | Yes | **Yes** |
| Caller blocks | Yes | **Yes** |
| Caller times out when consumer is down | Yes | **Yes** |
| Availability term for the consumer | In the product | **In the product** |
| Consumer's latency is in your budget | Yes | **Yes, plus two queue transits** |
| Broker in the availability product | No | **Yes — added** |
| Correlation state to manage | No | **Yes — added** |
| Orphaned replies to handle | No | **Yes — added** |

**Six properties unchanged, three costs added.** That is the honest ledger, and it is why this
shape needs a positive justification rather than being a natural stop on the way to being
event-driven.

## When it is nonetheless right

There are real cases. They are narrower than the frequency of the pattern suggests.

**The consumer is not addressable.** It lives in another network, behind a firewall, or on a
network that dials out but cannot be dialled into. A broker both sides connect out to is a
legitimate rendezvous, and no amount of HTTP will substitute for it. This is genuinely common in
enterprise and industrial settings.

**You need competing consumers with a single logical address.** A queue distributes work across
whatever consumers exist, with no load balancer and no discovery, and a new consumer joins by
subscribing. HTTP needs discovery plus a load balancer for the same effect. If the deployment
model makes that hard, the broker is doing real work.

**The reply is genuinely eventual and you are calling it request/reply loosely.** If the caller
issues the request, returns to *its* caller, and processes the reply when it arrives, that is
request/asynchronous response and it is a different shape with genuinely different coupling.
See [28 · The user who is waiting](06e-the-user-who-is-waiting.md).

**You need the request to survive the consumer being down, and the caller can wait a long
time.** A batch or operator-initiated flow with a tolerance measured in minutes gets real value
from the buffer, because the consumer coming back within the window turns what would have been a
failure into a slow success.

Outside those, the question to ask is direct: *would this be simpler as an HTTP call, and if so,
what is the broker buying?*

## The specific mistake: "we removed the REST call"

The migration that looks like progress and is not:

```text
Before:  Order --HTTP--> Pricing         (Pricing must be up; Order blocks)
After:   Order --queue--> Pricing
         Order <--reply-- Pricing        (Pricing must be up; Order blocks;
                                          plus the broker must be up)
```

Richardson's definition applies unchanged: runtime coupling is *"the degree to which the
availability of one service is affected by the availability of another service"*, and Order's
availability is still a function of Pricing's. The architecture diagram changed and the
availability arithmetic did not — except for the extra term.

**The tell in a design review**: ask what the caller does between sending and receiving. If the
answer is "waits", the coupling is unchanged. If the answer is "returns to its own caller and
handles the reply later", it is a different shape and the change is real.

## What the shape costs that HTTP does not

Three things you now own and did not before, and each is a source of production defects:

**1 · Correlation identifiers and the map of outstanding requests.** The caller keeps state
associating a correlation id with something that is waiting. That state is in memory, so it does
not survive a restart: a caller that restarts between send and reply has orphaned the request
permanently, and the reply arrives for a correlation nobody remembers. HTTP has no equivalent
failure because the socket dies with the process and the client knows.

**2 · Reply routing across replicas.** With several caller instances, the reply must reach the
one that is waiting. That means either a per-instance reply queue — which multiplies queues and
complicates rolling deploys — or a shared reply topic that every instance filters, which is
wasteful. Neither is hard; both are work that HTTP does for free by virtue of a connection.

**3 · Timeout semantics you implement yourself.** When the reply does not arrive, the caller has
to give up, clean up the correlation entry, and decide what a late reply means. HTTP clients
give you this; here you build it, and getting it wrong leaks memory in exactly the incident where
memory matters.

🔴 **The mechanics of doing any of this — reply-to headers, correlation properties, request-reply
templates, consumer groups — belong to
[Phase 15 · Messaging and event-driven architecture](../../phase-15-messaging-event-driven/README.md).**
What belongs here is the decision, and the decision is that this shape must be justified rather
than adopted.

## Gotchas

**★ "We use a message broker, so we're loosely coupled" is a statement about a dependency you
added, not one you removed.** The consumer must still be up, the caller still blocks, the caller
still times out. The only thing that changed is that the broker joined the availability product.

**★ The caller's correlation state is in memory and does not survive a restart.** A rolling
deploy during a slow period orphans every in-flight request. With HTTP the connection breaks and
the client sees an error; here the caller has simply forgotten, and the reply arrives at a
process that has no idea what it is for.

**★ Late replies arrive after the caller has given up and must be discarded safely.** If the
consumer was slow rather than down, the reply shows up after the timeout. Discarding it is
usually right, and doing so requires the correlation entry to have been cleaned up in a way that
distinguishes "unknown correlation" from "corrupt message". Logging every late reply as an error
buries the real ones.

**★ A per-instance reply queue is a resource that scales with your replica count and outlives
your pods.** Auto-scaling and rolling deploys create queues faster than anything deletes them.
Whatever you build needs a lifecycle, or the broker slowly fills with abandoned reply queues.

**★ The reply path has its own latency and its own tail.** Two queue transits plus consumer
scheduling are added to the callee's own processing time, and every one of them is another draw
from a distribution — [17 · Tail latency under fan-out](04f-tail-latency-under-fan-out.md). A
shape adopted for resilience can measurably worsen the latency budget.

**★ Broker retries turn a request/reply timeout into duplicate work.** If the caller times out
and the broker redelivers the request to another consumer, the operation may execute twice while
the caller believes it failed. That makes idempotency mandatory here in a way it is not for a
plain HTTP call that failed to connect —
**34 · Idempotent consumers** *(not written yet)*.

**★ It is often adopted as a stepping stone and then never moved past.** "We'll start with
request/reply over the broker and make it event-driven later" is a plan that leaves the system
with the costs of both models and the benefits of neither. If the destination is a notification
or an event, go there directly; if it is not, use HTTP.

## Interview questions

**★ Is request/reply over a message broker asynchronous?**
The transport is; the interaction is not. The consumer must be available now, the caller blocks
until the reply arrives, and the caller times out when the consumer is down — which are exactly
the properties that define temporal coupling. What the broker buffers is the message, not the
outcome, and the outcome is what the caller was waiting for. The availability arithmetic is
unchanged except that the broker has been added as an extra term.

**★ When is this shape actually justified?**
When the consumer is not addressable over HTTP — behind a firewall or on a network that only
dials out — so a broker both sides connect to is the only rendezvous; when competing consumers
with a single logical address are needed and the deployment model makes discovery plus load
balancing awkward; or when the caller's tolerance is long enough that the buffer converts a
would-be failure into a slow success, as in an operator-initiated batch flow. Outside those, ask
what the broker is buying that HTTP was not already providing.

**★ What does the caller have to build here that HTTP gives it for free?**
Correlation identifiers and a map of outstanding requests; routing of replies back to the
specific replica that is waiting, via per-instance reply queues or a filtered shared topic;
timeout handling with cleanup of the correlation entry; and a policy for replies that arrive
after the caller gave up. Each is a source of production defects, and the correlation map in
particular is in-memory state that a restart destroys silently.

**★ Your team migrated a REST call to request/reply over RabbitMQ and reports improved decoupling.
How do you evaluate that?**
Ask what the caller does between sending the request and receiving the reply. If it waits, the
runtime coupling is identical by Richardson's definition — the caller's availability is still a
function of the consumer's — and a broker term has been added to the product, so the change is a
net regression on availability. If instead the caller returns to its own caller and handles the
reply asynchronously, the shape genuinely changed, and the correct name for it is
request/asynchronous response.

**★ Why does this shape make idempotency mandatory when a plain HTTP call might not?**
Because the broker will redeliver. If the caller times out and the consumer was merely slow, the
work may complete anyway; if the message is redelivered after a consumer crash, the work may
execute twice. The caller believes the operation failed while the system executed it once or
twice, which is the unknown-outcome problem with an added duplication risk. A deduplication key
carried on the message, checked by the consumer, is the minimum.

{/* FOOTER */}
