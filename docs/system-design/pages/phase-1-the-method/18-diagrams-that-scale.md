---
title: "One diagram per altitude — context at minute five, containers at fifteen, one component in the deep dive, never code — with a sequence diagram wherever the order of messages is the point, and diagrams-as-code for the written version so the picture is reviewed and versioned with the decision"
sidebar_label: "18 · Diagrams that scale with the conversation"
sidebar_position: 19
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07. The C4 model's four abstractions and four diagrams are summarised from
> [c4model.com](https://c4model.com/); the one quoted phrase is the site's own description of
> itself. Mermaid, PlantUML and the Structurizr DSL are named as tools for diagrams-as-code
> without version claims; **this site does not render Mermaid**, so the samples below are
> source, shown in text fences. Drawing conventions for the round are on
> [phase 0's tooling page](../phase-0-the-interview/11-whiteboard-and-remote-tooling.md).
> **No sandbox run.**

**A diagram has an altitude, and the round moves through three of them in order: the system as
one box among its users and neighbours at minute five, the containers that run at minute
fifteen, and the inside of one container in the deep dive.** The mistake is to mix altitudes —
a database table drawn next to a CDN — or to start low; the discipline is one altitude per
diagram, zoomed in as the conversation zooms, which is the idea the C4 model gives a name to.
Boxes and arrows show *topology*, and topology is what the failure walk and the scaling walk are
done against; where the point is *order* — what happens first, what waits, what is retried — a
sequence diagram says in six lines what boxes cannot say at all, and the write path of the
storefront's checkout is the standing example. In the written version the diagram is code:
text that renders, lives in the repository beside the design document and the decision records,
and is reviewed and versioned like everything else. This page is the altitudes and when each is
drawn, the sequence diagram and when it wins, the two other forms worth knowing, and
diagrams-as-code for the document.

## The altitudes, and when the round reaches each

The C4 model describes itself as *"an easy to learn, developer friendly approach to software
architecture diagramming"*, and its structure is four abstractions — software system, container,
component, code — each with a diagram, zooming in like maps at successive scales. The round uses
three of them:

| Altitude | When | What is on it | What is not |
|---|---|---|---|
| **System context** | minute five, with the requirements | the system as one box; its users (buyer, admin); the external systems it touches (payment provider, email gateway, courier) | anything inside the box |
| **Container** | minute fifteen — the diagram of [07](07-the-high-level-diagram.md) | the things that run and the stores: client, edge, gateway, services, databases, cache, log, workers | classes, tables, endpoints |
| **Component** | the deep dive of [09](09-choosing-the-deep-dives.md) | the inside of *one* container: the order service's handler, the reservation, the outbox writer, the tables they touch | any other container's insides |
| **Code** | never in a round | classes, functions | — |

The context diagram is often skipped, and it is the cheapest minute in the round: three boxes
around one, drawn while the requirements are being said, and it answers "what is in scope" in a
picture — the courier is on it or it is not. The container diagram is where the marks are. The
component diagram is drawn only for the box that was chosen, on a clean part of the board, with
the container diagram left intact so the walk can return to it.

## When a sequence diagram beats boxes

Boxes show what exists and what talks to what; they cannot show *when*. The moment the point is
ordering — a commit before a call, a retry with a key, a callback that may arrive twice — the
sequence diagram is the right picture, and it takes a minute:

```text
buyer        gateway        order svc          PostgreSQL           provider
  |  POST /orders (Idempotency-Key: k) |              |                   |
  |───────────►|─────────────►|                       |                   |
  |            |              | BEGIN                 |                   |
  |            |              | insert order(pending) |                   |
  |            |              | reserve inventory     |                   |
  |            |              | insert outbox row     |                   |
  |            |              | COMMIT ───────────────►|                   |
  |            |              |                        |                   |
  |            |              | charge(k) ────────────────────────────────►|
  |            |              |◄───────────────────────────────── ok / timeout
  |            |              | UPDATE order → paid | failed (2nd txn) ───►|
  |◄───────────|◄─────────────| 201 {orderId, status}  |                   |
  |            |              |                        |                   |
  |  retry with the same key  |                        |                   |
  |───────────►|─────────────►| lookup k → existing order, same 201       |
```

Six things are visible here that no box diagram carries: the transaction's boundary, the
provider call *outside* it, the second transaction for the result, the response carrying a
status rather than a promise, the retry hitting the idempotency lookup, and the place a crash
would land. That is the write path of [08](08-read-path-and-write-path.md) and the deep dive of
the inventory row, in one picture. Sequence diagrams for the round: the write path of the
main journey, the provider callback, and any flow where "what if it crashes here" is the
question — because the crash has a line to point at.

Boxes win everywhere else: the failure walk, the scaling walk, cost, and any "where does this
live" question. The tell for the wrong form is a box diagram with numbered arrows that loop
back and forth between two boxes — that is a sequence, drawn badly.

## Two more forms worth having

**A state diagram for a lifecycle.** The order has states — pending, paid, failed, expired,
fulfilled, refunded — and the transitions between them are decisions: who moves pending to
paid, what moves it to expired, whether failed can become paid. Drawn as a small state machine
during the deep dive, it exposes the transitions nobody had designed — the callback that arrives
after the expiry — and it is the picture the reconciliation job is written from.

```text
        ┌──────────┐  provider ok   ┌───────┐  shipped   ┌───────────┐
  ──►   │ pending  │───────────────►│ paid  │───────────►│ fulfilled │
        └──────────┘                └───────┘            └───────────┘
             │  provider failed          │ refund requested
             ▼                           ▼
        ┌──────────┐                ┌──────────┐
        │  failed  │                │ refunded │
        └──────────┘                └──────────┘
             ▲  15 min, no result
        ┌──────────┐   late callback: reconcile, never re-charge
        │ expired  │
        └──────────┘
```

**A table instead of a diagram.** Options considered, the failure walk, the cost ranking — each
is a table, and drawing them as pictures loses the columns. The senior board has one container
diagram, one sequence, one state machine, and several tables.

## Diagrams-as-code for the written version

In the document of [17](17-the-same-method-in-writing.md) the diagram should be text that
renders — for three reasons that a drawing tool cannot match: it is **diffed** in review like
the code, so a reviewer sees that the cache moved; it is **versioned** beside the decision
records, so the picture and the decision cannot drift apart; and it is **regenerated** from one
source, so the context and container views stay consistent when a box is renamed. Three tools
cover the need:

- **Mermaid** — a text syntax embedded directly in Markdown, rendered by many Markdown hosts and
  documentation sites; sequence, state, flowchart and C4-style diagrams. The lowest-friction
  choice for a design document that lives in a repository.
- **PlantUML** — an older text syntax with a broader diagram set and a C4 extension; rendered by
  a server or a plugin rather than natively by Markdown hosts.
- **Structurizr DSL** — models the C4 abstractions directly: one model of systems, containers and
  components, from which the context, container and component *views* are generated, so a
  rename in the model updates every diagram.

The storefront's write path as Mermaid source — shown as text here, since this site does not
render it:

```text
sequenceDiagram
    participant B as buyer
    participant G as gateway
    participant O as order svc
    participant P as PostgreSQL
    participant X as provider
    B->>G: POST /orders (Idempotency-Key k)
    G->>O: forward
    O->>P: BEGIN; insert order(pending); reserve; insert outbox; COMMIT
    O->>X: charge(k)
    X-->>O: ok | timeout
    O->>P: UPDATE order -> paid | failed
    O-->>B: 201 {orderId, status}
    B->>O: retry, same k
    O-->>B: 201, existing order
```

And the container view as a Mermaid flowchart, left to right, synchronous path above the
asynchronous row:

```text
flowchart LR
    client[web / mobile] --> cdn[CDN + TLS] --> gw[API gateway]
    gw --> cat[catalogue svc] --> cache[(product cache)] --> pg[(PostgreSQL)]
    gw --> cart[cart svc] --> redis[(Redis)]
    gw --> ord[order svc] --> pg
    ord --> pay[payment adapter] --> prov{{payment provider}}
    pg -. outbox .-> pub[outbox publisher] --> log[(order events)]
    log --> mail[notification worker] --> email{{email gateway}}
    log --> ful[fulfilment worker]
    log --> idx[search indexer] --> search[(search index)]
```

The conventions carry over from the board: one altitude per diagram, left to right in the
direction of a request, synchronous above and asynchronous below, distinct shapes for services,
stores and external systems, and a legend when the shapes are not self-evident. A diagram in the
document is captioned with its altitude — "container view" — so the reader knows what is
deliberately absent.

## Gotchas

**★ Symptom: a table's columns drawn next to a CDN.** Cause: altitudes mixed on one diagram.
Fix: one altitude per picture — context, container, component — and a fresh area of the board
for the zoom, with the container diagram left intact.

**★ Symptom: numbered arrows looping back and forth between two boxes.** Cause: a sequence
drawn as topology. Fix: a sequence diagram — participants across the top, time downward — for
the write path, the callback and any "what if it crashes here" flow.

**Symptom: the deep dive drawn over the container diagram.** Cause: no clean space kept. Fix:
the zoom on a separate area; the walk needs the container view back afterwards.

**Symptom: the order lifecycle never drawn; the late callback undesigned.** Cause: no state
diagram. Fix: a small state machine in the deep dive — pending, paid, failed, expired — with
the transition for a callback after expiry made explicit.

**Symptom: the design document's diagram is a screenshot from a drawing tool.** Cause: the
picture outside version control. Fix: diagrams-as-code — Mermaid in the Markdown, or a
Structurizr model — reviewed and versioned with the decision records.

**Symptom: the context diagram skipped, and "is the courier in scope?" at minute thirty.**
Cause: the cheapest altitude omitted. Fix: three boxes around one while the requirements are
being said; the externals on it are the scope.

**Symptom: the options comparison drawn as a picture.** Cause: everything forced into a
diagram. Fix: a table — options as rows, requirements as columns; several tables and three
diagrams is the senior board.

## Interview questions

**★ What are the C4 levels, and which do you draw in a round?**
Four abstractions, each with a diagram that zooms in on the previous: the software system in its
context — users and external systems; the containers that run — services, stores, the client;
the components inside one container; and code. A round draws the first three in order — context
at minute five while scoping, container at minute fifteen as the main diagram, one component
diagram in the deep dive for the chosen box — and never the fourth.

**★ When does a sequence diagram beat boxes?**
When the point is order rather than topology: a commit before an external call, a retry with an
idempotency key, a callback that may arrive twice, and any flow where the question is "what if
it crashes here" — because the sequence has a line to point at. Boxes win for the failure walk,
the scaling walk, cost and "where does this live". The tell for the wrong form is a box
diagram whose numbered arrows loop back and forth between the same two boxes.

**Why diagrams-as-code in the design document?**
Because a picture outside version control drifts from the decision it illustrates. Text that
renders — Mermaid in the Markdown, PlantUML, or a Structurizr model that generates the context,
container and component views from one source — is diffed in review, versioned beside the
decision records, and regenerated consistently when a box is renamed. The reviewer sees that the
cache moved; the engineer two years out finds the picture that matches the ADR.

**What does a state diagram expose that the sequence and the boxes do not?**
The transitions nobody designed. Drawing the order's states — pending, paid, failed, expired,
fulfilled, refunded — forces the question of who moves each one and what happens on the edges:
a provider callback arriving after the reservation expired, a refund on an order never
fulfilled. The reconciliation job is written from that picture, and the missing transition is
the bug that would otherwise ship.

---

← Prev: [17 · The same method in writing](17-the-same-method-in-writing.md) · Index: [Phase 1 — The method](README.md) · Next phase → [Part 2 of the syllabus — the network path and caching](../../syllabus/02-the-network-path-and-caching.md)
