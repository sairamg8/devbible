---
title: "A subdomain is a piece of the business, a bounded context is a piece of your solution, and treating them as synonyms is how teams end up defending an accident of history as if it were a domain truth"
sidebar_label: "03 · Subdomain vs bounded context"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io *Decompose by subdomain*
> ([microservices.io](https://microservices.io/patterns/decomposition/decompose-by-subdomain.html)),
> *Assemblage overview: Part 2 — Defining subdomains*
> ([microservices.io](https://microservices.io/post/architecture/2023/08/14/assemblage-overview-part-2-defining-subdomains.html))
> and the *Microservice Architecture* pattern
> ([microservices.io](https://microservices.io/patterns/microservices.html)); Eric Evans,
> *Domain-Driven Design* (2003), Part IV, cited by concept.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**Two words get used interchangeably in every microservices discussion and they mean
different things. A subdomain is part of the business — it exists whether or not you write
software, and you do not get to choose it. A bounded context is part of your software — a
region where one model holds, and you absolutely do choose it. The distinction matters
because it tells you which arguments are worth having: you can argue about a context, and
you cannot argue about a subdomain, only discover it. Most bad architecture meetings are
people arguing about one while believing they are discussing the other.**

## The two spaces

| | Subdomain | Bounded context |
|---|---|---|
| Lives in | The **problem space** — the business | The **solution space** — your system |
| Exists because | The business does this thing | You decided to model it this way |
| Discovered or decided | Discovered | Decided |
| Changes when | The business changes | You refactor, or the business changes |
| Example | "We take payments from customers" | The `billing` module, with its `Payer`, `Invoice` and `PaymentAttempt` model |

The ideal is a one-to-one mapping — one context per subdomain — and DDD literature
recommends aiming for it, because a mismatch means your software's seams do not line up
with the business's seams and every business change crosses several code boundaries.

The reality in any system older than two years is that the mapping is not one-to-one, and
the *shape* of the mismatch is diagnostic:

- **One subdomain, several contexts.** Usually a legacy split — an acquisition, a rewrite
  that stalled halfway, or a technical decomposition that happened before anyone thought
  about the domain. Symptom: one business change touches several modules every time.
- **Several subdomains, one context.** The normal starting state, and often fine. A single
  service can legitimately contain several subdomains — see [04 · A service is not a
  context](04-a-service-is-not-a-context.md).
- **A context that maps to no subdomain.** Almost always technical: a "reporting service",
  an "integration service", a "workflow engine". Sometimes correct as infrastructure,
  usually a boundary drawn along a layer. See [12 · Splitting by layer](12-splitting-by-layer.md).

## What microservices.io actually defines a subdomain to be

The Assemblage material is unusually precise, and its definition is the one to carry:

> *"A subdomain is a team-sized chunk of business functionality, a.k.a. business capability.
> It consists of the entities/aggregates acted upon by system operations."*

Three claims are packed in there and each one is useful.

**"Team-sized."** The size of a subdomain is defined by what a team can hold, not by
conceptual purity. This is a solution-space constraint smuggled into a problem-space
definition, and it is deliberate — the whole framework exists to produce an implementable
architecture, not a taxonomy.

**"A.k.a. business capability."** microservices.io treats *decompose by subdomain* and
*decompose by business capability* as two routes to the same place, and its own pattern
pages give the *same* worked example for both: Product Catalog, Inventory Management, Order
Management, Delivery Management. If you have been told these are rival techniques, they are
not; they are two vocabularies. Capability language comes from business architecture and
asks *"what does the business do to generate value"*; subdomain language comes from DDD and
asks what part of the domain this is. They converge because both are asking about behaviour
rather than data.

**"The entities/aggregates acted upon by system operations."** This is the operational
definition, and it is what makes the concept checkable. You do not find a subdomain by
staring at a domain model; you find it by listing what the system does and grouping the
aggregates each operation touches. That is [21 · System operations
first](21-system-operations-first.md).

## Why the distinction changes real decisions

**Decision 1 — is this boundary negotiable?**
If two teams disagree about a context boundary, that is a design argument and evidence can
settle it. If they disagree about a subdomain, one of them is wrong about the business, and
the resolution is a domain expert, not an architect.

**Decision 2 — what do you do when the business changes?**
A new subdomain appearing (the company starts offering subscriptions) means a new context
is warranted. A subdomain disappearing (the company stops selling through resellers) means
a context should be deleted rather than left to rot as a module nobody owns. Watching the
problem space tells you when the solution space is due for change.

**Decision 3 — where do you invest?**
Subdomains are classified as core, supporting or generic, and that classification drives
build-versus-buy and how much design effort each deserves. Contexts do not have that
classification; they inherit it. See [03b · Core, supporting,
generic](03b-core-supporting-generic.md).

**Decision 4 — how do you read a legacy system?**
The existing contexts are historical artefacts. The subdomains are not. When you inherit a
system with eleven services and want to know which are wrong, you enumerate the subdomains
independently — from the business, not the code — and then map the services onto them. The
services that map to half a subdomain, or to bits of three, are your candidates.

## The mapping written down

The single most useful artefact from this analysis is a two-column table, and it is
frequently the deliverable that ends an eight-week debate:

| Subdomain (problem space) | Context(s) implementing it (solution space) | Verdict |
|---|---|---|
| Order capture | `sales` module | 1:1, healthy |
| Pricing and promotions | `sales` module + `promo-engine` service + a spreadsheet | 1:3 — one business change, three artefacts |
| Inventory | `inventory` service | 1:1, healthy |
| Delivery | `fulfilment` service + `carrier-adapter` service | 1:2 — adapter is infrastructure, acceptable |
| Payment | `billing` service | 1:1, healthy |
| — | `reporting` service | Maps to no subdomain: cross-cutting read model |

The rows with a mismatch are the work. The rows without one are not, however loudly someone
wants to rewrite them.

## In Java: the subdomain is a package, until it earns more

The Assemblage model says a service groups subdomains. In Java that maps cleanly onto a
package-per-subdomain layout inside one deployable, which is a boundary you can enforce
with the compiler today and promote to a network boundary later, if it ever earns it:

```text
com.retailer
├── RetailerApplication.java
├── sales/                 ← subdomain: order capture
│   ├── Order.java              (public — the module's API)
│   ├── SalesOrderNumber.java   (public)
│   └── internal/
│       ├── OrderRepository.java
│       └── OrderPlacementService.java
├── pricing/               ← subdomain: pricing and promotions
├── inventory/             ← subdomain: inventory
└── fulfilment/            ← subdomain: delivery
```

That layout is exactly Spring Modulith's default convention — *"each direct sub-package of
the main package is considered an application module package"* — which means the boundary
is verifiable by a single test the day you create it. [25 · Verifying the boundary](25-verifying-the-boundary.md) shows the test; the framework tour belongs to
[01 · Monolith first](../01-monolith-first/11-spring-modulith-what-it-is.md).

## Gotchas

**★ Symptom: an architecture review that never converges.** Cause: half the room is
arguing about the business (subdomains) and half about the code (contexts), using the same
words. Fix: split the meeting. Enumerate subdomains with a domain expert and no
architecture diagram in the room; then map contexts onto them with no domain expert
present. The second meeting is much shorter.

**★ Naming a context after a technology.** `kafka-consumer-service`, `batch-service`,
`api-service`. A context is named after the part of the domain it models. A name with no
domain word in it is a boundary that was drawn along a technical axis, and it will fail the
Common Closure test the first time a business rule changes.

**★ Assuming the subdomain list is stable because the company is old.** Subdomains change
when the business model changes, not when the company grows. A retailer adding a
marketplace acquires a whole new subdomain — seller onboarding — and usually tries to bolt
it onto Catalogue for a year first.

**★ Deriving subdomains from the current database schema.** The schema encodes decisions
made by people who were solving a storage problem under time pressure, often before the
current business existed. It is evidence about the existing solution space and almost none
about the problem space.

**★ Treating "one context per subdomain" as a rule that must be satisfied immediately.**
It is the target shape, not an entry requirement. Getting from 1:3 to 1:1 is a migration
with real cost, priced in [42 · The cost of changing a boundary](42-the-cost-of-changing-a-boundary.md), and it is frequently not worth paying for
a subdomain nobody is currently blocked on.

## Interview questions

**★ What is the difference between a subdomain and a bounded context, and give an example
where they do not line up.**
A subdomain is part of the business problem; a bounded context is part of your solution — a
region where a single model and vocabulary hold. They fail to line up constantly. A common
example: "pricing" is one subdomain, but in a typical retailer it is implemented by list
prices in the catalogue service, promotional rules in a separate engine, and negotiated
contract rates in a spreadsheet the sales team maintains. One subdomain, three contexts;
every pricing change touches three artefacts owned by three groups. That mismatch is the
diagnosis, and it is invisible if you use the two words interchangeably.

**★ Is "decompose by subdomain" different from "decompose by business capability"?**
They are two vocabularies for the same move, and microservices.io gives the same worked
example — Product Catalog, Inventory, Order Management, Delivery — under both patterns.
Capability language comes from business architecture and asks what the business does to
generate value; subdomain language comes from DDD and asks what part of the domain a piece
of behaviour belongs to. Both produce behaviour-shaped boundaries rather than data-shaped
ones, which is the actual point. In practice, capability language communicates better with
executives and subdomain language communicates better with modellers, so use whichever the
room speaks.

**★ How do you find subdomains when there is no domain expert available?**
Start from system operations — every externally invokable behaviour the application
supports, which you can extract from the API surface, the scheduled jobs and the message
consumers. Group those operations by the aggregates they touch. That grouping is
microservices.io's operational definition of a subdomain and it needs no workshop. It is
weaker than talking to a domain expert, because it inherits every distortion in the current
implementation, but it is an evidence-based starting point rather than a guess.

**★ You have a "reporting service" that maps to no subdomain. Is it wrong?**
Not necessarily — it may be a legitimate cross-cutting read model serving queries that span
several contexts, which is exactly what API composition and CQRS read models exist for, and
that is **03 · Database-per-service** *(not written yet)*'s territory. It becomes wrong when
it starts containing business rules: a reporting service that decides what counts as an
active customer has taken ownership of a definition that belongs to a domain context, and
now that definition exists twice.

**★ Which comes first when you are designing from scratch — subdomains or contexts?**
Subdomains, because they constrain contexts and not the other way round. But the first pass
at subdomains will be wrong, because you learn the domain by building in it. That is
precisely why the first implementation should put several subdomains in one deployable with
enforced in-process boundaries: the package boundary is cheap to move when your subdomain
model improves, and a service boundary is not.

---

← [The language tells you](02c-the-language-tells-you.md) · [Topic index](README.md) · Next → [Core, supporting, generic](03b-core-supporting-generic.md)
