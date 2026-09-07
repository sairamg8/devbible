---
title: "One diagram first — client, edge, gateway, services, stores, async workers — with the main journeys numbered onto it, and only then a zoom into one box; a diagram that starts at the component level has skipped the part that is graded"
sidebar_label: "07 · The high-level diagram"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Method; the levels of zoom follow the C4 model's context → container →
> component progression ([c4model.com](https://c4model.com/), summarised — no verbatim quote).
> Drawing conventions are on [phase 0's tooling page](../phase-0-the-interview/11-whiteboard-and-remote-tooling.md).
> The diagrams below are text renderings, illustrative of shape. **No sandbox run.**

**The high-level diagram is drawn once, at one altitude, with every functional journey numbered
onto it — and then, and only then, one box is opened.** The altitude is the C4 model's container
level: the things that run — a client, an edge, a gateway, a handful of services, the stores, the
asynchronous workers — and the arrows between them. Not classes, not table columns, not the
internals of any one service; those belong to the zoom. The reason the order matters is that the
diagram is what the failure walk, the trade-off sentences and the deep-dive choice are made
*against*: an interviewer cannot ask "what if this box dies?" of a diagram that does not exist
yet, and a candidate who opens the inventory service's internals before the checkout flow is on
the board has produced depth with nothing to attach it to. Fifteen minutes: five for the boxes,
five for the numbered flows, five narrating why each box is there and what would break without
it.

## The layers, left to right

The diagram reads in the direction of a request, and the same skeleton fits almost every
product system:

| Layer | Boxes | What it is for |
|---|---|---|
| **Client** | web app, mobile app | where the journey starts; the only thing you do not control |
| **Edge** | DNS, CDN, TLS termination, WAF | the static and cacheable reads never go further; the first place to shed |
| **Gateway** | load balancer, API gateway (auth, rate limits, routing) | one entry point; where admission for a spike lives |
| **Services** | the few that own state or a boundary: catalogue, cart, order, inventory, payment adapter, notification | each owns one part of the data model and one part of the API |
| **Stores** | the primary database, the cache, the search index, object storage | derived from [06](06-the-data-model-from-access-patterns.md) — one per store family the patterns needed |
| **Async** | a queue or log, the workers that drain it, the outbox publisher | everything that does not have to happen before the response |
| **External** | the payment provider, the email gateway, the courier's API | the actors from [01](01-functional-requirements.md) that are systems |

Draw sparse — the deep dive will need room inside one box — and keep the asynchronous row
*below* the synchronous path, so the write path reads as a line and the fan-out reads as a
drop.

## The storefront's checkout, at the container level

```text
[web/mobile] ──► [CDN + TLS] ──► [API gateway: auth · rate limit · admission] ──┬─► [catalogue svc] ──► (product cache) ──► (PostgreSQL primary ⇄ replica)
                                                                               ├─► [cart svc] ──► (Redis: carts)
                                                                               ├─► [order svc] ──► (PostgreSQL primary: orders · items · inventory · idempotency · outbox)
                                                                               │        │
                                                                               │        └──► [payment adapter] ──► {payment provider}
                                                                               └─► [admin svc] ──► (PostgreSQL primary: inventory, versioned)

                          {payment provider} ──callback──► [API gateway] ──► [payment adapter] ──► (PostgreSQL: payments · orders.status)

   async, below the line:   (outbox) ──► [outbox publisher] ──► (log: order events) ──┬─► [notification worker] ──► {email gateway}
                                                                                     ├─► [fulfilment worker]
                                                                                     └─► [search indexer] ──► (search index)
```

Illustrative — a text rendering of what goes on a board. Each box is a container in the C4
sense: something that runs, that owns something, and that can be scaled, replaced or lost
independently. The provider appears twice, as a callee and as a caller, because its callback is
a separate flow.

## Numbering the flows

The functional journeys, each written as the sequence of boxes it crosses, with the number
placed on each arrow of the journey:

| # | Journey | Path across the diagram |
|---|---|---|
| **1** | browse the catalogue | client → CDN (hit: done) → gateway → catalogue service → product cache (hit: done) → primary/replica |
| **2** | view and edit the cart | client → gateway → cart service → Redis |
| **3** | place an order | client → gateway (idempotency key, admission) → order service → PostgreSQL primary: idempotency check, inventory decrement, order + items, outbox — one transaction → payment adapter → provider (synchronous call, timeout) → response `PENDING_PAYMENT` |
| **4** | payment confirmed | provider → gateway → payment adapter → PostgreSQL: payment row, order status → outbox → publisher → log → notification worker → email gateway |
| **5** | order status and history | client → gateway → order service → primary for the buyer's own fresh order (read-your-writes); replica for history |
| **6** | admin adjusts stock | admin client → gateway → admin service → PostgreSQL inventory with a version check |

The legend is written *first*, top-left, and the numbers go on the arrows as each flow is
traced aloud. From this point the conversation is addressable: "flow 3, from the order service
to the commit" is the deep dive; "if the primary dies, flows 3, 4 and 6 fail and 1, 2 and the
replica half of 5 keep working" is the failure walk.

## Why each box is there

The narration that accompanies drawing ([phase 0's communication page](../phase-0-the-interview/09-communication-mechanics.md)):
one sentence per box, naming the requirement it serves and what breaks without it. A few from
the storefront:

- **The CDN** — "serves flow 1's static and semi-static reads at the edge; without it the
  sale-day read spike lands on the catalogue service."
- **The gateway** — "one place for auth, rate limits and the checkout admission gate; without
  it every service re-implements them and the spike hits the order service directly."
- **The order service** — "owns the checkout transaction and the order state machine; the one
  box that must not be duplicated across services, because the transaction spans four tables."
- **The payment adapter** — "isolates the provider: the timeout, the idempotent call, the
  signature check on the callback, the fallback provider later; without it the order service
  carries provider-specific code."
- **The outbox and publisher** — "makes the order event atomic with the order; without it a
  crash between the commit and the publish loses the event."
- **The replica** — "serves history reads and reporting; the buyer's own fresh order is read
  from the primary to keep read-your-writes."

A box you cannot narrate is a box to remove ([phase 0, reasoned beats memorised](../phase-0-the-interview/08-reasoned-wrong-beats-memorised-right.md)).

## One diagram, then the zoom

The three levels of zoom the round can use, in the C4 progression:

| Level | What it shows | When to draw it |
|---|---|---|
| **Context** | the system as one box, its users and the external systems | the actors list from [01](01-functional-requirements.md) — usually written, not drawn |
| **Container** | the diagram above — what runs and what stores | always; this is the high-level diagram |
| **Component** | inside one container — the order service's transaction steps, the idempotency check, the outbox write | the deep dive, on one box only |

The failure mode is drawing at the component level from the start: the order service's
internals appear before the cart, the CDN or the callback exist, and the interviewer cannot see
the shape of the system or trace a journey across it. The other failure is never zooming: a
container diagram with no deep dive is breadth with nothing under it. The sequence — container
diagram, numbered flows, narration, *then* one component-level zoom — is what the rubric
rewards, and **09 · Choosing the deep dives** *(not written yet)*
is how the box is chosen.

## What stays off this diagram

- **Classes and interfaces** — the LLD round's altitude ([phase 0, the three rounds](../phase-0-the-interview/02-the-three-design-rounds.md)).
- **Table columns** — the schema was written in [06](06-the-data-model-from-access-patterns.md);
  the diagram names the store and what it holds.
- **Every microservice the product might one day have** — the boxes are the ones the journeys
  need; a service with no flow number on it is decoration.
- **Infrastructure detail** — regions, zones, pod counts — unless a requirement (residency,
  availability) put them there; the **scaling walk** *(not written yet)*
  adds them when a number forces them.
- **Monitoring, CI, secrets** — real, and belonging to a later part of the conversation
  (**14 · Evolution and operations** *(not written yet)*).

## Gotchas

**★ Symptom: the order service's internals on the board at minute twelve, and no cart, CDN or
callback anywhere.** Cause: starting at the component level. Fix: the container diagram first,
every journey numbered onto it, then one zoom; depth needs a shape to attach to.

**★ Symptom: a dozen boxes, no flow numbers, and "how does a checkout actually go?"** Cause: the
diagram drawn as an inventory of technologies. Fix: the legend of journeys first, each one
traced across the boxes with its number on every arrow; a box with no number is removed.

**Symptom: the provider drawn once, and the callback path missing.** Cause: external systems
treated as callees only. Fix: an external system that calls you appears as a caller too; the
callback is its own numbered flow.

**Symptom: the outbox publisher, the notification worker and the search indexer on the
synchronous line.** Cause: no async row. Fix: everything that does not have to happen before
the response goes below the line, fed by the outbox and the log.

**Symptom: a service per noun and a journey that crosses seven of them.** Cause: boxes chosen
by naming rather than by ownership. Fix: a service owns one part of the data model and one
part of the API; the checkout transaction's four tables belong to one service.

**Symptom: no room inside the box for the deep dive.** Cause: a dense diagram. Fix: draw sparse,
and zoom by redrawing the chosen box on fresh space.

**Symptom: regions and pod counts on the first diagram.** Cause: infrastructure detail before a
requirement asked for it. Fix: the container level is what runs and what stores; the scaling
walk adds infrastructure when a number forces it.

## Interview questions

**★ What is on the high-level diagram, and in what order do you draw it?**
The container level: client, edge (CDN, TLS), gateway (auth, rate limits, admission), the few
services that own state or a boundary, the stores derived from the data model, the asynchronous
row — outbox, publisher, log, workers — and the external systems. Order: the legend of journeys
first, then the boxes sparse and left to right with async below the line, then each journey
traced across the boxes with its number on every arrow, then one sentence per box naming the
requirement it serves. Only after that does one box get zoomed for the deep dive.

**★ Why number the flows, and what does it change about the rest of the round?**
It makes the diagram addressable. The deep dive becomes "flow 3, from the order service to the
commit"; the failure walk becomes "if the primary dies, flows 3, 4 and 6 fail and 1, 2 and the
replica half of 5 keep working"; the interviewer can write feedback against a numbered journey.
It also exposes decoration: a box no flow crosses has no requirement behind it and comes off.

**Which boxes does checkout need, and why each?**
The gateway, for auth, rate limits and the sale-day admission gate in one place; the order
service, owning the checkout transaction across idempotency, inventory, order and outbox; the
payment adapter, isolating the provider's timeout, idempotent call and signed callback; the
primary store for the transaction and a replica for history; the outbox and publisher so the
order event is atomic with the order; the log and its workers for notifications, fulfilment
and search indexing off the critical path; and the CDN and product cache so the read spike
never reaches the write path.

**How do the C4 levels map onto a design round?**
Context is the actors and external systems from the functional requirements — usually written,
not drawn. Container is the high-level diagram — what runs and what stores — and is always
drawn. Component is the inside of one container — the order service's transaction steps — and
is drawn once, for the deep dive. Starting at component skips the graded shape; never reaching
it leaves breadth with nothing beneath. The sequence container → flows → narration → one
component zoom is the method.

**What stays off the first diagram, and why?**
Classes and interfaces, which are the LLD round's altitude; table columns, which the schema
already holds; services no journey crosses; regions, zones and pod counts until a requirement
such as residency or an availability target puts them there; and monitoring, CI and secrets,
which belong to the evolution-and-operations part of the conversation. The diagram shows the
shape the journeys need, sparse enough that one box can be opened.

---

← Prev: [06 · The data model](06-the-data-model-from-access-patterns.md) · Index: [Phase 1 — The method](README.md) · Next → **Read path and write path, separately** *(not written yet)*
