---
title: "There are five interaction styles, not two, and the axis that matters is not the transport but whether the caller is waiting — which is why a queue can be synchronous and an HTTP call can be asynchronous"
sidebar_label: "18 · The five interaction styles"
sidebar_position: 18
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io "Pattern: Messaging"
> ([microservices.io](https://microservices.io/patterns/communication-style/messaging.html))
> and "Pattern: Remote Procedure Invocation (RPI)"
> ([microservices.io](https://microservices.io/patterns/communication-style/rpi.html)), and
> RFC 9110 §15.3.3 ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9110.html)).
> 🔴 **No sandbox.** Version spine: JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**"Sync or async" is a false binary that hides the decision you are actually making. The
messaging pattern page enumerates five distinct styles, and the useful way to arrange them is
along two independent questions: how many recipients, and does the sender wait for a result.
Only the second question determines coupling. Getting this taxonomy straight is what lets you
say the two most useful sentences in this topic — "this could be a notification" and "this is
request/reply wearing a queue" — and have people know exactly what you mean.**

## The five, verbatim

From the Messaging pattern's solution section:

> *"Request/response — a service sends a request message to a recipient and expects to receive
> a reply message promptly"*

> *"Notifications — a sender sends a message a recipient but does not expect a reply. Nor is
> one sent."*

> *"Request/asynchronous response — a service sends a request message to a recipient and
> expects to receive a reply message eventually"*

> *"Publish/subscribe — a service publishes a message to zero or more recipients"*

> *"Publish/asynchronous response — a service publishes a request to one or recipients, some of
> whom send back a reply"*

## The grid

| | One recipient | Zero or more recipients |
|---|---|---|
| **Sender waits for the result** | Request/response | Publish/asynchronous response |
| **Sender does not wait** | Notification · Request/asynchronous response | Publish/subscribe |

The row is the coupling axis. **The column is an addressing decision** — whether the sender
names the recipient — and it governs design-time coupling and extensibility, not availability.

Two things fall out of the grid immediately:

- **Request/response is not defined by HTTP.** It is defined by "the sender waits". You can do
  it over a broker, and microservices.io lists it under *asynchronous* messaging styles,
  because the *transport* is asynchronous even when the *interaction* is not. That distinction
  is the whole of [21 · Request/reply over
  messaging](05d-request-reply-over-messaging.md).
- **Request/asynchronous response is the interesting one and the one nobody uses.** The sender
  issues a request, does not wait, and receives the reply later on a separate channel. It is
  the shape behind `202 Accepted` plus a callback or a status resource, and it is the honest
  answer for most "but the user needs to know it worked" objections. See
  [28 · The user who is waiting](06e-the-user-who-is-waiting.md).

## RPI is one cell of the grid, and its page says so

The RPI pattern's drawbacks list names its own narrowness:

> *"Usually only supports request/reply and not other interaction patterns such as
> notifications, request/async response, publish/subscribe, publish/async response"*

alongside the availability cost:

> *"Reduced availability since the client and the service must be available for the duration of
> the interaction"*

and the benefits, which are real and are usually undersold by people arguing for events:

> *"Simple and familiar"* · *"Request/reply is easy"* · *"Simpler system since there in no
> intermediate broker"*

That third one deserves weight. A broker is an operational commitment: it must be clustered,
monitored, upgraded, capacity-planned and understood by whoever is on call. The messaging
pattern's own drawback line is *"Additional complexity of message broker, which must be highly
available"*. Choosing RPI for an interaction that genuinely needs a prompt answer is not a
failure of ambition; it is the correct application of the pattern.

## The single question that classifies any interaction

> **After this call, can the caller finish its own work without the callee's answer?**

- **No** → request/response. The caller is temporally coupled. Price it with the arithmetic in
  [05 · Availability multiplication](03-availability-multiplication.md).
- **Yes, and nobody needs a result** → notification. The cheapest shape there is.
- **Yes, but somebody needs the result later** → request/asynchronous response. The caller
  finishes now; the result arrives on another channel.
- **Yes, and several parties are interested** → publish/subscribe.

Notice that the question says nothing about HTTP, queues, brokers or annotations. It is
answerable from a requirements document, before any technology is chosen, which is exactly what
makes it useful in a design review.

## Where each style is implemented, and who owns it here

| Style | Typical implementation | Owned by |
|---|---|---|
| Request/response | HTTP with `RestClient`, gRPC | this topic · **05 · Inter-service REST** and **06 · gRPC** *(not written yet)* |
| Notification | publish to a topic and return | shape here; broker mechanics in [Phase 15](../../phase-15-messaging-event-driven/README.md) |
| Request/async response | `202 Accepted` + status resource, or a reply channel | shape here ([28](06e-the-user-who-is-waiting.md)) |
| Publish/subscribe | domain events on a topic | shape here ([22](05e-event-notification.md)); brokers in Phase 15 |
| Publish/async response | scatter-gather over a broker | rare; noted, not taught |

🔴 **Phase 15 owns the brokers.** Nothing in this band tells you how to configure RabbitMQ or
Kafka, how to bind a Spring Cloud Stream function, or how to build an outbox. What it does is
tell you which shape you should be asking phase 15 to implement.

## A note on the vocabulary people actually use

Real teams do not say "publish/asynchronous response". The words in circulation are
*fire-and-forget*, *request/reply*, *events*, *commands* and *pub/sub*, and they map onto the
grid imperfectly:

- **"Fire-and-forget"** usually means notification, and sometimes means "request/reply where we
  ignore the response", which is a completely different coupling and is a bug.
- **"Event"** usually means notification or publish/subscribe, and sometimes means a command
  addressed to exactly one consumer with a name like `ProcessPaymentRequested`, which is
  request/response with the reply omitted.
- **"Command"** means one recipient and an expectation that it happens; whether the sender waits
  is left unsaid, which is precisely the thing that matters.

**When someone says "we'll make it an event", ask who is expected to consume it and whether the
sender's work is complete without them.** The answer classifies it, and half the time the answer
reveals that the proposed "event" is a synchronous call in disguise.

## Gotchas

**★ "Asynchronous messaging" describes the transport, not the interaction.** microservices.io
lists request/response as one of the *asynchronous messaging* styles, which reads as a
contradiction until you notice it is classifying the channel. A request sent over a queue with
the sender blocked on a reply is temporally coupled exactly as an HTTP call is. Say "the caller
waits" rather than "it is synchronous" and the ambiguity disappears.

**★ Ignoring the response of a request/reply call is not fire-and-forget.** The request was
still issued now, the callee still had to be up, the caller still waited for the HTTP status,
and the connection was still held. All you gave up is the ability to react to failure. This is
the worst cell in the grid: full coupling cost, no result, and silent errors.

**★ A "notification" that the recipient must acknowledge is request/response.** If the sender
retries until acknowledged, or fails when there is no consumer, or blocks on a broker publish
confirm with a short timeout, the coupling is back. Publisher confirms are usually the right
choice — they are what makes the handoff durable — but they mean the *broker* must be up, which
is **41 · The broker is a dependency too** *(not written yet)*, not that the
consumer must be.

**★ Choosing pub/sub for a single known consumer buys extensibility you may never use and costs
you traceability today.** With one consumer, a directed notification is easier to reason about
and easier to debug. Pub/sub earns its keep when the set of consumers genuinely changes without
the producer's involvement — which is a real and valuable property, and is not every case.

**★ The style is per interaction, and one pair of services usually has several.** Order calls
Payment synchronously to authorise, notifies Payment asynchronously about a cancellation, and
subscribes to Payment's settlement events. "How do Order and Payment communicate" has three
answers, and picking one style for the pair is how the wrong one ends up on the write path.

## Interview questions

**★ Name the interaction styles and say which axis determines coupling.**
Request/response, notifications, request/asynchronous response, publish/subscribe and
publish/asynchronous response — microservices.io's list. Two axes organise them: the number of
recipients (one versus zero-or-more), and whether the sender waits for a result. Only the second
determines runtime coupling. The number of recipients is an addressing and extensibility
decision that affects design-time coupling, not availability.

**★ Is request/reply over RabbitMQ synchronous or asynchronous?**
The transport is asynchronous; the interaction is synchronous. The caller still cannot finish
until the consumer answers, so the consumer must be available now and the caller still times out
when it is not. microservices.io classifies request/response as one of the styles you can build
on asynchronous messaging, which is exactly this distinction. The useful phrasing in a design
review is "the caller waits", because it is unambiguous.

**★ What is "request/asynchronous response" and why is it under-used?**
The sender issues a request, does not block, and receives the answer later on a separate
channel — a callback, a reply queue, or a status resource the client polls. It is under-used
because it needs a correlation identifier, a place to deliver the answer, and a client willing
to handle a result that arrives later, all of which is more work than blocking. It is also the
honest answer to most "but the user needs to know it worked" objections, because the user
usually needs to know *eventually*, not *within the HTTP response*.

**★ A colleague proposes replacing a REST call with an event. What do you ask?**
Who consumes it, and whether the sender's own work is complete without them. If the sender still
cannot answer its caller until the consumer has processed the event, it is request/reply with a
broker in the middle, and the change has added a hop and a correlation mechanism without
reducing coupling. If the sender genuinely finishes and the consumer's work is independent, it
is a notification and the change is real.

**★ When is RPI the right choice rather than a compromise?**
When the caller genuinely cannot proceed without the answer — a payment authorisation, an
identity check, a decision that gates a write — and when the operational cost of a broker is not
justified. The RPI pattern lists real benefits: *"Simple and familiar"*, *"Request/reply is
easy"*, and *"Simpler system since there in no intermediate broker"*. A broker must itself be
highly available, monitored and operated, which is a genuine commitment. Choosing RPI
deliberately, having priced the availability, is a good decision; choosing it by default is not.

{/* FOOTER */}
