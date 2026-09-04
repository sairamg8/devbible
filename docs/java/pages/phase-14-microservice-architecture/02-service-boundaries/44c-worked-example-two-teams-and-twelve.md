---
title: "The same domain produces two radically different architectures depending on team topology — an honest comparison of two teams versus twelve teams"
sidebar_label: "44c · Worked example: two teams vs twelve"
sidebar_position: 67
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Melvin Conway, *How Do Committees Invent?* (1968);
> Matthew Skelton & Manuel Pais, *Team Topologies* (IT Revolution Press), Chapter 2: Conway's Law and
> Software Architecture; Sam Newman, *Monolith to Microservices* (O'Reilly).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**The ultimate lesson of service boundary design is that there is no single "correct" technical architecture for a given domain model. Melvin Conway demonstrated in 1968 that software architecture reflects the communication structures of the organization building it. Applying the exact same e-commerce requirements analyzed in previous chapters (`Order`, `Payment`, `Inventory`, and `Shipment`), the optimal boundary layout changes completely depending on team size. For an engineering organization of two teams, a modular monolith or a two-service split is the only sustainable choice. For an organization of twelve teams, a granular microservice architecture is essential to prevent deployment paralysis.**

## Scenario A: Two teams (10 to 12 engineers)

### The organizational reality
- **Team 1 (Commerce Squad)**: 5 engineers focused on the customer journey: storefront, shopping cart, checkout, promotions, and order placement.
- **Team 2 (Fulfillment Squad)**: 5 engineers focused on logistics: warehouse receiving, inventory counts, courier label generation, and order shipping.
- Payment processing is outsourced to a hosted gateway (Stripe/Adyen), meaning raw credit card tokens are never stored locally.

```
Scenario A: Two Teams -> Modular Monolith (or 2 Deployables max)
┌─────────────────────────────────────────────────────────────────┐
│                      MODULAR MONOLITH                           │
│  ┌─────────────────────────────┐   ┌──────────────────────────┐ │
│  │     Commerce Module         │   │   Fulfillment Module     │ │
│  │   (Owned by Team 1)         │   │   (Owned by Team 2)      │ │
│  │                             │   │                          │ │
│  │ - Order Placed Logic        │   │ - Warehouse Pick & Pack  │ │
│  │ - Price & Tax Calculation   │   │ - Inventory Stock Rows   │ │
│  │ - Third-party Stripe Client │   │ - Courier Tracking API   │ │
│  └──────────────┬──────────────┘   └──────────▲───────────────┘ │
│                 │                             │                 │
│                 └────── In-Process Event ─────┘                 │
│                 (Spring ApplicationModuleListener)             │
└─────────────────────────────────────────────────────────────────┘
```

### The honest architecture
A **Modular Monolith** built with Spring Modulith 2.1.1 or at most **Two Services** (`CommerceService` and `LogisticsService`):
- **Why this succeeds**:
  1. *Zero distributed systems tax*: Single Git repo, single CI/CD pipeline, single database instance with separate schemas.
  2. *High developer productivity*: Engineers make changes, run tests locally, and deploy to production in minutes. No Kubernetes service meshes or distributed tracing overhead.
  3. *Clean team boundaries*: Team 1 owns the `commerce` package; Team 2 owns the `logistics` package. Code reviews are simple, and boundaries are enforced by `ApplicationModules.verify()`.
- **Why 8 microservices would destroy this organization**:
  If 10 engineers are forced to maintain 8 microservices, each engineer is responsible for multiple production services, distinct CI/CD pipelines, independent database backups, and alert rotations. A single feature requires coordinating PRs across 4 repositories, grinding velocity to a halt.

---

## Scenario B: Twelve teams (80 to 100 engineers)

### The organizational reality
- Multiple specialized stream-aligned teams working concurrently:
  - Squad 1: Checkout & Cart Experience
  - Squad 2: Order Management & State Machine (OMS)
  - Squad 3: Payment Orchestration & Regulatory Ledger
  - Squad 4: Dynamic Promotions & Coupons
  - Squad 5: Real-Time Inventory Allocation
  - Squad 6: Warehouse Robotic Picking & Packing
  - Squad 7: Courier Carrier Integrations & Tracking
  - Squad 8: Returns & Customer Support Portal
  - Squads 9–12: Core Platform, Cloud Infrastructure, Data Engineering, and Search

```
Scenario B: Twelve Teams -> Fine-Grained Microservices
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Squad 1:    │   │  Squad 2:    │   │  Squad 3:    │   │  Squad 4:    │
│  Checkout    │   │  Order OMS   │   │  Payment     │   │  Promotions  │
│  Service     │   │  Service     │   │  Service     │   │  Service     │
└───────┬──────┘   └───────┬──────┘   └───────┬──────┘   └───────┬──────┘
        │                  │                  │                  │
════════╪══════════════════╪══════════════════╪══════════════════╪══════════
        │        EVENT STREAM (Apache Kafka / Pulsar)            │
════════╪══════════════════╪══════════════════╪══════════════════╪══════════
        │                  │                  │                  │
┌───────┴──────┐   ┌───────┴──────┐   ┌───────┴──────┐   ┌───────┴──────┐
│  Squad 5:    │   │  Squad 6:    │   │  Squad 7:    │   │  Squad 8:    │
│  Inventory   │   │  Warehouse   │   │  Courier     │   │  Returns     │
│  Service     │   │  Pick/Pack   │   │  Shipping    │   │  Service     │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

### The honest architecture
A **Decoupled Microservice Architecture** with 8 to 12 independent services communicating via Kafka and REST/gRPC:
- **Why this succeeds**:
  1. *Deployment autonomy*: Squad 5 (Inventory) can deploy 10 times a day to optimize concurrency during flash sales without coordinating with Squad 7 (Courier Shipping).
  2. *Independent blast radius*: A bug introduced by Squad 4 in coupon calculation does not bring down warehouse picking in Squad 6.
  3. *Isolated compliance*: Squad 3 runs its Payment service in a secured, hardened VPC subnet meeting strict PCI-DSS Level 1 audit standards without burdening the other 11 teams.
- **Why a monolith would destroy this organization**:
  If 100 engineers push commits into a single monolith repository, merge queues lock up, CI test runs take 45 minutes, flaky tests break the mainline build daily, and a release failure by one team rolls back features developed by 11 other teams.

## Comparison summary

| Dimension | Two Teams (10 Engineers) | Twelve Teams (100 Engineers) |
| :--- | :--- | :--- |
| **Recommended Topology** | Modular Monolith (Spring Modulith) | Fine-Grained Microservices |
| **Communication Seam** | In-memory Spring events / package APIs | Apache Kafka / REST / gRPC |
| **Deployment Cadence** | Single coordinated pipeline | 12+ independent CI/CD pipelines |
| **Database Architecture** | Single instance, separate schemas | Independent databases per service |
| **Primary Failure Mode** | Boundary erosion (prevented by Modulith)| Distributed latency, event out-of-order bugs |
| **DevOps Overhead** | Minimal (1 container, 1 monitoring target)| High (Service mesh, tracing, K8s operators)|

## The middle, which is where almost everybody actually is

Two teams and twelve teams are the easy cases precisely because they are extremes. The population of
real organisations sits between them — **four to six teams, thirty to sixty engineers** — and neither
answer above is right there. It is worth working, because it is the situation most readers of this
page are in.

**What is true at that size:**

- A single deployable is no longer comfortable. Release coordination between five teams on one
  artefact costs real time, and one team's bad afternoon blocks four others.
- A service per team is not yet affordable either. Five services means five pipelines, five on-call
  rotas, five sets of dashboards — and at thirty engineers those are the same people who were going
  to build features.
- 🔴 **The invariants have not changed at all.** The reservation invariant is the same at 10 engineers
  and at 100. Organisation size decides how *finely* you may cut; it never makes an illegal cut legal.

**What the middle actually looks like, and it is not a compromise between the two:**

| | Extract | Keep in the modular monolith |
|---|---|---|
| **Criterion** | The team's release cadence genuinely differs, or its scaling profile genuinely differs | Everything else |
| **Typical result** | One or two services out of a monolith that keeps the rest | Six or eight modules, one deployable |

The shape that works at this size is **a modular monolith with one or two things extracted**, not a
uniform architecture. Uniformity is the instinct — every capability treated the same way — and it is
what produces both failure modes: a monolith straining under five teams, or twelve services run by
thirty people.

**The two things worth extracting first, at this size, are usually not the interesting ones:**

1. Anything with a **different scaling profile** — the read-heavy catalogue, the batch reporting job.
   These are cheap to extract because they are usually read-only, and they remove the most load.
2. Anything with a **different compliance scope** — the payment path. Extracting it shrinks the audit
   boundary, which is a benefit no amount of module discipline provides.

Neither is the domain's core. That is the pattern: at this size you extract for **operational**
reasons, and you keep the core together for **correctness** reasons, until the organisation is large
enough for team autonomy to outweigh coordination cost.

## Gotchas

**★ Cargo Culting Netflix or Amazon at a 10-person startup.**
Adopting the architecture of an 80-team organization when you have 8 engineers is the number one cause of startup technical bankruptcy. The team spends the bulk of its engineering capacity maintaining distributed plumbing instead of shipping features.

**★ Resisting service extraction when crossing 50+ engineers.**
When an engineering department grows from 10 to 80 people, attempting to maintain a single monolithic deployable without modular enforcement creates severe release gridlock, long deployment queues, and cross-team developer resentment.

**★ A five-team organisation adopts a uniform architecture — either one deployable or one service per team — and both options hurt.**
Cause: uniformity was assumed. At this size neither extreme fits, and the instinct to treat every
capability the same way produces a monolith straining under five teams or twelve services run by
thirty people.
Fix: a modular monolith with one or two things extracted, chosen for operational reasons — a different
scaling profile or a different compliance scope — while the core stays together for correctness
reasons. The architecture is allowed to be non-uniform; that is what fits an organisation which is
itself non-uniform.

**★ Team growth is used to justify a cut that splits an invariant.**
Cause: "we are big enough for microservices now" was applied to a boundary that was never legal.
Organisation size changes what is affordable, not what is correct.
Fix: the invariants are identical at ten engineers and at a hundred. Size decides how finely you may
cut among the **legal** cuts; it never makes an illegal one legal. If the reservation invariant spans
the line, hiring does not fix it.

**★ Ignoring the "Inverse Conway Maneuver".**
If your current architecture is a tangled distributed monolith, attempting to fix it by writing technical tickets alone will fail. You must realign team structures (squad responsibilities and communication paths) to match the desired software boundaries.

## Interview questions

**★ How does Conway's Law influence microservice boundary decisions?**
Conway's Law states that a system's architecture mirrors the communication channels of the organization. Microservice boundaries are only sustainable when aligned with team boundaries: one team should ideally own one or more entire microservices. If a single microservice requires coordinated changes across three teams, or if one team must coordinate releases across ten microservices, Conway's Law is violated and velocity collapses.

**★ What is the "Inverse Conway Maneuver"?**
The Inverse Conway Maneuver is the practice of proactively restructuring engineering teams and organizational communication lines to encourage the emergence of the desired software architecture. Instead of waiting for architecture to organically follow broken organizational silos, leadership designs autonomous, cross-functional stream-aligned teams around bounded contexts to foster clean, decoupled service boundaries.

**★ Your organisation is five teams and thirty engineers — neither of this page's scenarios. What is the answer?**
A modular monolith with one or two things extracted, and deliberately **not** a uniform architecture.
At that size a single deployable has become uncomfortable — five teams coordinating releases on one
artefact loses real time, and one team's bad afternoon blocks four others — while a service per team
is not affordable, because five pipelines, five rotas and five dashboards are staffed by the same
thirty people who were going to build features. So you extract selectively, and the first candidates
are usually not the interesting parts of the domain: something with a different scaling profile
(read-heavy catalogue, batch reporting) because it is cheap to extract and removes the most load, and
something with a different compliance scope (the payment path) because extraction shrinks the audit
boundary in a way module discipline cannot. The core stays together.

**★ Does organisation size ever make a boundary correct that was not correct before?**
No — and this is the distinction that gets lost in Conway's-law discussions. Size changes what is
*affordable*: how many deployables you can operate, how much coordination cost you can absorb, whether
team autonomy is worth more than the overhead of achieving it. It does not change what is *legal*. The
reservation invariant spans the Order/Inventory line identically at ten engineers and at a hundred,
and no amount of hiring converts a distributed transaction into a local one. The correct reading is
that invariants filter the candidate cuts down to the legal ones, and organisation size then chooses
among those — which is why growing an organisation can justify splitting a service, and can never
justify splitting an aggregate.
A modular monolith becomes unsustainable when organizational scale creates developer contention: when dozens of teams compete for merge access to a shared repository, CI test execution takes too long, deploy queue delays paralyze release velocity, or when specific capabilities require radically distinct hardware profiles or strict regulatory isolation (such as PCI DSS).

---

← [Worked example: candidate cuts](44b-worked-example-candidate-cuts.md) · [Topic index](README.md) · Next → [The checklist](45-the-checklist.md)
