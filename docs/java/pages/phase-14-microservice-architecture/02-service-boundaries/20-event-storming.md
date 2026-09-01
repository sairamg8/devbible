---
title: "Event storming is the fastest way to get a room's model of a domain onto a wall, and its most valuable output is not the events — it is the pink stickers marking the places where the room disagreed"
sidebar_label: "29 · Event storming"
sidebar_position: 29
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the ddd-crew *EventStorming Glossary & Cheat Sheet*
> ([github.com/ddd-crew](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)),
> which defines a domain event as an *"Event that is relevant for the domain experts and
> contextual for the domain"*, a command as *"decisions, actions or intent"*, a policy as a
> *"Reaction that says 'whenever X happens, we do Y'"*, and a hot spot as a device to
> *"visualise and capture hot conflicts"*; Alberto Brandolini, *EventStorming*
> ([eventstorming.com](https://www.eventstorming.com/)), cited by concept.
> Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**Event storming gets a domain onto a wall in hours instead of weeks, and it does it in the
one currency that transfers cleanly into software: things that happened. It is genuinely good
at that, and it is routinely oversold as a boundary-finding technique. What it produces is a
timeline, a vocabulary, and a set of disagreements. What it cannot produce is evidence about
change frequency, team capacity or operational cost — so it generates candidates, and other
chunks in this topic decide between them.**

## The notation, briefly

The ddd-crew cheat sheet is the reference. The elements that matter for boundary work:

| Element | What it is | Colour |
|---|---|---|
| **Domain event** | Something that happened, past tense, that domain experts care about | Orange |
| **Command** | *"decisions, actions or intent"* — what someone or something did to cause the event | Blue |
| **Actor** | A person, team or department involved around some events | Small yellow |
| **Policy** | *"whenever X happens, we do Y"* — the reaction that turns an event into a command | Lilac |
| **Query model** | The information an actor needs to decide | Green |
| **External system** | A system outside the boundary of what you are modelling | Pink, wide |
| **Constraint** | A restriction that must hold when performing a command | Large yellow |
| **Hot spot** | A conflict, a question, an inconsistency, an objection | Neon pink, rotated |
| **Pivotal event** | The few most significant events in the flow | Orange |

Two of these do disproportionate work for boundaries, and both are frequently underused.

## Hot spots are the point

A hot spot marks a place where the room could not agree, or where nobody knew the answer. The
temptation in a workshop is to resolve them so the wall looks finished. Resist it, because the
unresolved ones are the most valuable artefact the session produces:

- **A disagreement about what a word means** is a bounded context edge, discovered in the
  cheapest possible way ([03 · The same word, two
  meanings](02b-the-same-word-two-meanings.md)).
- **A disagreement about who does something** is an ownership question, and it maps directly
  onto [16 · Who owns the data](10-who-owns-the-data.md).
- **"It depends"** is usually two workflows wearing one name, and it is the whose-job question
  in [12 · Whose job is it?](08-whose-job-is-it.md) arriving unprompted.
- **"Nobody knows"** is a policy gap: the software has been making a business decision
  implicitly, and no one has decided what the decision should be.

A workshop that produces forty events and no hot spots was either a trivially simple domain or
a room where one person talked.

## Pivotal events are where boundaries usually go

Brandolini's *pivotal events* — the few points in the timeline that everyone treats as
significant — are strong boundary candidates, and there is a mechanical reason why. A pivotal
event is where responsibility changes hands: `OrderPlaced`, `PaymentCaptured`,
`ShipmentDispatched`, `ReturnReceived`. Before it one group is accountable, after it another
is. That is exactly the shape of a context edge, and it is why the timeline decomposes
naturally at those points.

Two useful checks on a candidate pivotal event:

1. **Does the vocabulary change across it?** If the words on the stickers before and after are
   different, the edge is real.
2. **Does anything need to be transactionally consistent across it?** If yes, it is not a
   boundary, however pivotal it feels — the invariant wins.

## Policies are where the coupling lives

A lilac policy — *"whenever X happens, we do Y"* — is a piece of coupling made visible, and it
is precisely the thing that becomes an event subscription in code. Reading the policies is the
fastest way to see the future integration surface:

- A policy whose X and Y are in the same candidate context is internal; it costs nothing.
- A policy that crosses a candidate boundary is an event contract you will have to design,
  version and operate.
- A candidate boundary crossed by many policies is a boundary in the wrong place; you are
  proposing a lot of contract for a lot of traffic.

Counting policies per candidate boundary is a crude but genuinely useful pre-implementation
estimate of integration cost, and it takes five minutes with the wall already on it.

## From wall to code

The transfer is direct enough to be worth stating, because it is what makes the workshop more
than a nice afternoon:

```java
package com.retailer.sales;

import java.time.Instant;
import java.util.List;

/// A domain event straight off the wall: past tense, named in the domain's own words,
/// carrying identifiers and the facts the event is about — not the aggregate.
public record OrderPlaced(
        OrderId orderId,
        CustomerId customerId,
        List<OrderedLine> lines,
        Money total,
        Instant placedAt) {

    public record OrderedLine(Sku sku, int quantity, Money unitPrice) { }
}
```

```java
package com.retailer.fulfilment.internal;

import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/// A lilac policy, implemented. "Whenever an order is placed, we plan a shipment."
/// The policy crossed a candidate boundary on the wall, so here it is an event
/// subscription rather than a method call — which is what makes the boundary real.
@Component
class PlanShipmentOnOrderPlaced {

    private final ShipmentPlanning planning;

    PlanShipmentOnOrderPlaced(ShipmentPlanning planning) {
        this.planning = planning;
    }

    @ApplicationModuleListener
    void on(OrderPlaced event) {
        planning.planFor(event.orderId(), event.lines());
    }
}
```

The wall names the event and the policy; the code is a transcription. That correspondence is
worth protecting, because it means a domain expert can read the listener class names and
recognise their own process.

## What event storming cannot tell you

Be explicit about this in the room, because otherwise the wall gets treated as an
architecture.

- **Change frequency.** The wall shows what happens, not what changes. Common Closure needs
  history ([27 · Change history as evidence](19-change-history-as-evidence.md)).
- **Volume, latency and scale.** Nothing on the wall distinguishes an event that fires twice a
  year from one that fires ten thousand times a second.
- **Team capacity.** The wall has no headcount on it.
- **Operational cost.** Every candidate boundary looks free on paper
  ([23 · Too small](15-too-small.md)).
- **Whether the invariants are real.** The constraints on the wall are the room's beliefs;
  sorting true from false invariants is [11 · False invariants](07b-false-invariants.md).
- **What the current code does.** The wall is the domain as understood, which is frequently
  not the domain as implemented — and the difference is itself worth an afternoon.

## Gotchas

**★ Symptom: a wall with no hot spots.** Cause: the disagreements were resolved to make the
wall tidy, or one senior person supplied every answer. Fix: run it again with the loudest
person as an observer, and explicitly reward "I do not know" and "that is not what we call
it".

**★ Treating the wall as the design.** It is a shared model of the domain, produced by the
people in the room, in a few hours. It is a set of hypotheses with an unusually good
signal-to-noise ratio, not a decision.

**★ Symptom: events named in technical language — `OrderTableUpdated`, `MessagePublished`.**
Cause: engineers driving the naming. Fix: the domain expert must be able to read every sticker
aloud without translating. A technical event name means the wall has already drifted from the
ubiquitous language it was supposed to capture.

**★ Modelling only the happy path.** The interesting boundaries are around cancellation,
returns, corrections, partial fulfilment and refunds, because that is where responsibility
changes hands and where the disagreements are. A wall with no reversals is half a wall.

**★ Symptom: a candidate boundary crossed by a dozen policies.** Cause: the boundary is in the
wrong place. Fix: count policies per candidate cut before committing; a boundary with many
crossings is a lot of contract to design, version and operate.

**★ Running the workshop with only engineers.** Then it produces the engineers' existing model
of the system, which you could have obtained by reading the code. The domain experts are the
input; without them it is an expensive whiteboard session.

**★ Losing the wall.** Photograph it, transcribe the events and policies into the repository as
a markdown file, and record the hot spots with owners. A wall that exists only as a photograph
in someone's phone has a half-life of about a month.

## Interview questions

**★ What is event storming actually good for, and what is it not good for?**
It is good at getting a domain onto a wall quickly, in a currency that transfers to software —
things that happened, the commands that caused them, the policies that react to them, and the
actors involved. It surfaces vocabulary and, most valuably, disagreements. It is not good at
anything requiring measurement: change frequency, volume, latency, team capacity, operational
cost, or whether a stated constraint is a real transactional invariant. So it generates
boundary candidates and cannot rank them; the ranking comes from invariants, change history
and team structure.

**★ What is the most valuable output of an event storming session?**
The hot spots — the unresolved conflicts and questions. A disagreement about what a word means
is a bounded context edge found in the cheapest possible way. A disagreement about who does
something is an ownership question. An "it depends" is usually two workflows sharing a name.
And a "nobody knows" is a policy gap where the software has been making a business decision
implicitly for years. The temptation is to resolve them all so the wall looks complete, and
that destroys the main deliverable.

**★ How do pivotal events relate to service boundaries?**
A pivotal event is a point in the timeline everyone treats as significant, and the reason it
feels significant is usually that responsibility changes hands there — `OrderPlaced`,
`PaymentCaptured`, `ShipmentDispatched`. That is the same shape as a context edge, so pivotal
events are strong boundary candidates. Two checks keep it honest: does the vocabulary differ
on either side, and does anything need to be transactionally consistent across it? The second
overrules the first, because an invariant that spans the event means the boundary is not
available there whatever the wall looks like.

**★ Why are the lilac policy stickers worth counting?**
Because each one becomes an integration. A policy — "whenever X happens, we do Y" — that stays
inside a candidate context is a method call and costs nothing; one that crosses a candidate
boundary becomes an event contract to design, version, monitor and operate. So counting
policy crossings per candidate cut gives you a rough integration-cost estimate before writing
any code, and a boundary with a dozen crossings is telling you it is in the wrong place.

**★ Someone proposes an event storming session to decide a decomposition. What do you add to
the plan?**
Three things. Domain experts, not just engineers, or you will simply recover the engineers'
model of the existing code. Explicit modelling of the unhappy paths — cancellation, returns,
corrections, partial fulfilment — because that is where responsibility changes hands and where
the real disagreements live. And a follow-up step that is not a workshop: take the candidate
boundaries off the wall and test them against the invariants and the commit history, because
the wall cannot tell you which candidates are affordable.

{/* FOOTER */}
