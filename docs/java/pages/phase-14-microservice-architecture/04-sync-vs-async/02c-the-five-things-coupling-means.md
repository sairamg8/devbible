---
title: "When two engineers disagree about whether a design is loosely coupled they are usually both right, because the word is doing five different jobs and only one of them wakes anybody up at night"
sidebar_label: "04 · The five couplings"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Chris Richardson, "Microservice architecture essentials:
> loose coupling"
> ([microservices.io](https://microservices.io/post/architecture/2023/03/28/microservice-architecture-essentials-loose-coupling.html)),
> the microservices.io RPI and Messaging patterns
> ([rpi](https://microservices.io/patterns/communication-style/rpi.html),
> [messaging](https://microservices.io/patterns/communication-style/messaging.html)), and
> Martin Fowler & James Lewis, "Microservices"
> ([martinfowler.com](https://martinfowler.com/articles/microservices.html)) for "smart
> endpoints and dumb pipes". Version spine: JDK 25 · Spring Boot 4.1.1 / Spring Framework
> 7.0.8. **No sandbox.**

**"Loosely coupled" is unfalsifiable as stated, which is why architecture debates about it
never converge. Split it into five named properties and every one of them becomes a yes/no
question with a concrete remedy and a concrete cost. Four of the five are worth engineering
effort. Exactly one of them — temporal — is the one that determines whether your endpoint
returns 200 while another team is deploying, and it is the one that gets the least
attention because it is invisible in every diagram anybody draws.**

## The five

| # | Coupling | The caller must… | Removed by | Shows up as |
|---|---|---|---|---|
| 1 | **Location** | know where the callee is | discovery, DNS, a gateway | a hard-coded host in a config file |
| 2 | **Format** | agree on the payload's shape | tolerant reader, additive evolution, versioning | a deploy-order deadlock |
| 3 | **Semantic** | agree on what the data *means* | a shared bounded context, or an anti-corruption layer | "their `status` field means something else" |
| 4 | **Temporal** | have the callee up right now | a durable handoff, or a local copy | an outage in someone else's service |
| 5 | **Capacity** | fit inside what the callee can serve | rate limits, backpressure, shedding, isolation | your traffic spike becoming their incident |

Two of these — format and semantic — are design-time properties in Richardson's sense: they
determine how often you have to change together. Two — temporal and capacity — are runtime
properties: they determine whether you fail together. Location is the odd one out; it is
mostly an operations concern and it is the one that architecture diagrams *do* show, which
is a large part of why the other four go unexamined.

## 1 · Location coupling

The caller needs an address. If that address is a hostname in a config file, moving the
callee means changing the caller's configuration and restarting it.

The remedy is well known and largely solved by the platform. **08 · Service discovery**
*(not written yet)* owns it, including the argument that on Kubernetes a `Service` plus DNS
has already done this and a client-side discovery server is often redundant.

**The cost of the remedy is nearly zero and so is the benefit to availability.** A perfectly
discovered instance that is down is exactly as down as a hard-coded one. Say this out loud
in reviews where a discovery migration is being presented as a resilience improvement.

## 2 · Format coupling

The caller parses what the callee produces. If the callee renames a field, the caller
breaks — at runtime, in production, on a payload it has never seen before.

Remedies: ignore unknown fields on the way in, never remove or rename a field, add new
fields as optional, and version the media type when you genuinely must break. **05 ·
Inter-service REST** *(not written yet)* owns all of it, and **11 · Contract testing**
*(not written yet)* owns proving it in CI.

The thing worth carrying into this topic: **format coupling exists identically on the async
side.** An event schema is a wire contract. A producer that adds a required field to
`OrderPlaced` breaks every consumer, and unlike an HTTP call there is no synchronous error
to tell it so — the failures happen in six other services' consumer threads, minutes later,
and land in six other teams' dead-letter queues. Choosing events does not exempt you from
schema discipline; it removes the fast feedback that used to enforce it.

## 3 · Semantic coupling

The subtlest one, and the one that survives every technical remedy. Both sides use the word
`Customer`, and it means "a billing account" on one side and "a person who has logged in" on
the other. The JSON parses. The types compile. The behaviour is wrong.

There is no protocol fix. The fixes are domain fixes: draw the boundary so that the concept
lives on one side of it, or accept the mismatch explicitly with a translation layer at the
edge of your service that maps their model into yours and refuses to leak their vocabulary
inward. **02 · Service boundaries** *(not written yet)* owns bounded contexts and where the
line goes.

The reason it belongs in a coupling list at all is that **semantic coupling is what makes
people reject the local-copy remedy** in [06c](06c-the-read-that-could-have-been-a-copy.md).
"We can't hold a copy of the customer, we'd be duplicating their model." Sometimes that is a
real objection — if you would be copying a concept you do not understand. Usually it is not:
you are copying three fields you already display, and holding them locally is *less*
semantically coupled than calling their API, because you have committed to a small, explicit
subset instead of whatever their DTO happens to contain this month.

## 4 · Temporal coupling

The subject of [02b](02b-temporal-coupling.md) and the reason this topic exists. The callee
must be up at the instant of the call.

It is the only one of the five that multiplies. Location, format and semantic coupling are
additive nuisances: two badly versioned dependencies are twice the work of one. Temporal
coupling **compounds**, because availabilities multiply, and that is what makes it
categorically different. Four dependencies at 99.9% each are not four times worse than one;
they are worse in a way you have to compute. [03 · Availability
multiplication](03-availability-multiplication.md) does the computation.

## 5 · Capacity coupling

The one that gets left off most lists, and the one behind a surprising share of real
incidents. The caller's load becomes the callee's load. Your batch job, your new feature's
extra call per page render, your retry policy — all of them arrive as traffic on a service
sized for the traffic it had last month.

This coupling is bidirectional in a way the others are not:

- **Downstream:** your spike overloads them. They shed load or slow down.
- **Upstream:** their slowdown consumes *your* threads, connections and memory, because
  every in-flight request holds resources until its deadline. This is the mechanism behind
  cascading failure, and the Google SRE book's worked bimodal-latency example in
  [04e](04e-bimodal-latency-and-exhaustion.md) shows how violently it can amplify.

Async changes capacity coupling in an interesting way rather than removing it: with a
durable buffer, a spike becomes a growing queue instead of a rejected request. The work
still has to be done, the consumer still has finite throughput, and the queue depth is now
the thing you must alarm on. **You converted a latency-and-error problem into a backlog
problem**, which is usually much better — a backlog is visible, drainable and does not
propagate — but it is a conversion, not a cure.

## Fowler's line, and which coupling it is about

The "smart endpoints and dumb pipes" principle from the Microservices article is a statement
about semantic and design-time coupling, not about availability:

> *"Applications built from microservices aim to be as decoupled and as cohesive as
> possible — they own their own domain logic and act more as filters in the classical Unix
> sense."*

The point being made is that intelligence belongs in the services, not in an ESB that knows
everybody's business rules — because an intelligent pipe is a place where every service's
semantics get entangled, and it changes whenever any of them changes. It is a good rule and
it says nothing at all about whether your calls are synchronous. A system of dumb pipes and
smart endpoints, all talking synchronous REST, has perfect pipe hygiene and full temporal
coupling.

## Reading a design document with the five in hand

For any proposed interaction, five questions:

1. **Where is it?** Is the address a name, and does the name survive a rescheduled pod?
2. **What shape?** Can the producer add a field on Tuesday without a coordinated release?
3. **What does it mean?** Are both sides using the word for the same concept, and if not, who
   translates?
4. **When?** If the other side is stopped, what happens to work arriving now?
5. **How much?** What is the worst rate this can generate, and what does the other side do
   when it exceeds what it can serve?

A design document that answers 1, 2 and 3 and skips 4 and 5 is the normal case, and the two
it skipped are the two that produce incidents.

## Gotchas

**★ A change that improves one coupling frequently worsens another, and nobody tracks the
trade.** Extracting a shared library into a service removes design-time coupling and adds
temporal and capacity coupling. Adding a gateway removes location coupling and adds a
capacity chokepoint. Caching a remote read removes temporal coupling and adds semantic risk
because you now hold a stale interpretation of somebody else's data. None of these are
wrong; all of them are trades that should be written down.

**★ Format coupling on the event side fails silently and in another team's logs.** With HTTP
the caller gets a deserialization error it can see. With events the consumer fails after the
producer's deploy is already green, in a different service, and the producer's team has no
signal at all. If you move to events without contract tests, you have traded loud coupling
for quiet coupling.

**★ Capacity coupling is invisible until someone adds a `for` loop.** An endpoint that made
one downstream call per request becomes an endpoint that makes one call per *item* when a
list view is added. Nothing in the caller's code review shows a hundredfold increase in
downstream load. This is the N+1 problem at the service boundary and it is the most common
way a healthy dependency is turned into an unhealthy one.

**★ "Anti-corruption layer" is sometimes used to mean "we mapped the DTO", which is not the
same thing.** Mapping their JSON to your record removes format coupling only. Semantic
decoupling means your domain does not adopt their *concepts* — their statuses, their
lifecycle, their identifiers as your identifiers. A mapper that copies `status` straight
across has left the semantic coupling entirely intact while looking like it solved it.

**★ Removing location coupling can hide temporal coupling from monitoring.** When calls go
through a gateway or a mesh sidecar, the caller's own metrics may show a healthy client and
the failure appears as a generic 503 from the proxy. The dependency is still there and is
now harder to attribute. Whatever the topology, the caller should record per-dependency
outcome — which is why the inventory in **10b** *(not written yet)* is worth
keeping current.

## Interview questions

**★ Someone says a design is "tightly coupled". What do you ask them?**
Which coupling. Location, format, semantic, temporal or capacity — the remedies are
completely different and four of the five have nothing to do with availability. Without that
question the conversation is two people defending different propositions with the same
words. In practice the useful follow-up is "if I stopped that service for five minutes, what
breaks?", because that isolates the temporal one, which is the only one that multiplies.

**★ Which of the five compounds, and why does that matter?**
Temporal. Availability of an operation with hard dependencies is the product of the
dependencies' availabilities, so each additional hop multiplies rather than adds. Format,
semantic and location coupling accumulate linearly — twice as many badly versioned
dependencies is twice the work. Compounding is what makes a five-hop chain qualitatively
different from a one-hop call rather than five times as annoying.

**★ Does moving from REST to events remove format coupling?**
No. It relocates it and removes the feedback. An event payload is a wire contract with the
same rules: additive changes are safe, removals and renames are not. What changes is that
HTTP gives the caller an immediate, attributable deserialization failure, whereas an event
consumer fails asynchronously in another service after the producer's deploy has succeeded.
Without consumer-driven contract tests the move makes schema discipline harder, not easier.

**★ What is capacity coupling and how does asynchrony change it?**
Capacity coupling is the degree to which the caller's load determines whether the callee can
serve. Asynchrony does not remove it — the same work still has to be executed by the same
finite consumer — but it changes its shape: instead of the callee rejecting requests and the
caller's threads piling up, the excess accumulates in a durable buffer, which is visible,
drainable and non-contagious. The obligation that comes with it is that queue depth and
consumer lag become first-class alarms, because a growing backlog is now the symptom that
used to be a 503.

**★ Give an example of a change that improves one coupling and worsens another, and say how
you would decide.**
Caching a remote read locally removes temporal coupling (you can answer while they are down)
and worsens semantic coupling (you now hold and interpret their data, and it can be stale or
misread). Decide by asking what the cost of staleness actually is for that field: a
customer's display name being ten minutes old is invisible; their credit limit being ten
minutes old may be a financial loss. The staleness budget is a business number, not an
engineering one, and it belongs in the design document beside the availability number.

{/* FOOTER */}
