---
title: "Selecting a context mapping pattern is a function of organizational power, domain differentiation, and integration cost — a deterministic decision matrix matching technical architecture to team reality"
sidebar_label: "36 · Choosing a relationship"
sidebar_position: 61
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Eric Evans, *Domain-Driven Design* (Addison-Wesley), Chapter 14:
> Context Map; Alberto Brandolini and DDD-Crew *Context Mapping Guide*
> ([github.com/ddd-crew/context-mapping](https://github.com/ddd-crew/context-mapping)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**Choosing the wrong context mapping relationship is among the most expensive architectural mistakes in microservices: building an Anticorruption Layer where Conformist was appropriate wastes months authoring redundant translation mappers, while conforming to an uncooperative upstream poisons your core domain with external technical debt. Selecting the correct relationship pattern is not a matter of architectural taste; it is a deterministic calculation governed by three forces: organizational leverage between the teams, the strategic classification of the downstream domain (Core vs Supporting vs Generic), and the quality and stability of the upstream interface. A systematic decision matrix cuts through architectural dogma and matches pattern to operational reality.**

## The three deciding forces

Every boundary relationship is governed by three independent factors:

1. **Organizational Leverage:** Does downstream have the political, budgetary, or managerial authority to demand upstream modifications?
   - *High:* Customer-Supplier.
   - *Equal/Symmetric:* Partnership or Shared Kernel.
   - *None:* Conformist, Anticorruption Layer, or Separate Ways.
2. **Strategic Domain Classification:** Is the downstream context a Core Domain or a Supporting/Generic subdomain?
   - *Core Domain:* Must maintain linguistic purity; cannot be constrained by foreign models.
   - *Supporting / Generic:* Focus on cost efficiency and implementation velocity.
3. **Upstream Contract Quality:** Is the upstream interface clean, documented, and stable, or legacy, volatile, and tangled?
   - *High Quality / OHS:* Safe to consume directly.
   - *Legacy / Volatile:* Demands insulation.

## The Context Mapping Decision Matrix

| Downstream Leverage | Strategic Tier | Upstream Quality | Selected Pattern | Architectural Rationale |
|---|---|---|---|---|
| **High** | Core or Supporting | Any | **Customer-Supplier** | Downstream dictates contract requirements; upstream commits to backlog delivery |
| **Equal** | Core | High | **Partnership** | Symmetric co-dependence; both teams coordinate roadmaps and release together |
| **Equal** | Supporting | High | **Shared Kernel** | Small, co-owned subset of immutable value objects and domain identifiers |
| **None** | Core | Any | **Anticorruption Layer** | Downstream must protect its differentiating model from foreign contamination |
| **None** | Supporting | Legacy / Volatile | **Anticorruption Layer** | Protects downstream codebase from upstream bugs and volatile schema shifts |
| **None** | Supporting / Generic | High / Stable | **Conformist** | Eliminates translation boilerplate; upstream model meets domain needs |
| **None** | Low Business Value | Any | **Separate Ways** | Integration cost exceeds business value; duplicate data or handle manually |
| **Provider** | Fleet-wide Service | High | **Open Host Service + Published Language** | Standardize public protocol for dozens of consumers; reject bespoke endpoints |

## The decision process in practice

```text
                                [ New Integration Required ]
                                              │
                         Does business value exceed integration cost?
                                        ├── No ──► [ SEPARATE WAYS ]
                                        │
                                       Yes
                                        │
                     Does provider serve dozens of consumers?
                                        ├── Yes ─► [ OPEN HOST SERVICE + PUBLISHED LANGUAGE ]
                                        │
                                        No
                                        │
                       Do teams share equal, mutual dependency?
                                        ├── Yes ─► [ PARTNERSHIP / SHARED KERNEL ]
                                        │
                                        No
                                        │
                       Does downstream hold management leverage?
                                        ├── Yes ─► [ CUSTOMER-SUPPLIER ]
                                        │
                                        No
                                        │
                    Is downstream Core OR upstream legacy/unruly?
                                        ├── Yes ─► [ ANTICORRUPTION LAYER ]
                                        │
                                        No  ───► [ CONFORMIST ]
```

## Context maps evolve dynamically

Context relationships are not static contracts; they shift as organizations mature:

1. **Customer-Supplier to Open Host Service:** When an internal service expands from supporting two aligned internal teams to supporting thirty microservices across the company, it must terminate bespoke Customer-Supplier negotiations and publish an Open Host Service with strict backwards-compatibility guarantees.
2. **Conformist to Anticorruption Layer:** If a third-party SaaS vendor is acquired, suffers quality degradation, or announces an incompatible API overhaul, a downstream conformist team must immediately erect an Anticorruption Layer to insulate its business logic.
3. **Partnership to Service Merge:** When two teams in a Partnership realize that most of their pull requests require joint review and synchronized deployments, they should dissolve the artificial microservice boundary and merge into a single bounded context.

## The decision is the upstream's as well, and the two answers must match

Every framing above is from the downstream's point of view — *what do I do about them*. The upstream
is making a decision at the same time, from a different list, and a context map is only coherent when
the two agree.

| Downstream chooses | Upstream must be choosing | If it is not |
|---|---|---|
| Customer/Supplier | Customer/Supplier — it accepts downstream items in its plan | Downstream waits forever for a negotiation the upstream never agreed to |
| Conformist | Anything. Conformist requires no upstream cooperation at all | — |
| Anticorruption Layer | Anything, including nothing | — |
| Partnership | Partnership — symmetric by definition, or it is not this pattern | One team plans jointly, the other does not, and every release slips |

🔴 **Note which rows need no upstream agreement: Conformist and ACL.** That is their defining
advantage and the reason they are the right default when leverage is uncertain. Customer/Supplier and
Partnership are the only two patterns that require the other team to have chosen the same thing, and
they are precisely the two that get assigned optimistically in a workshop the other team was not in.

**A practical rule:** if you cannot name the person on the upstream team who agreed to the
relationship, choose a pattern that does not require their agreement. You can always upgrade later;
a downstream team blocked for a quarter waiting on an unagreed Customer/Supplier relationship cannot
get the quarter back.

## Relationships are per-edge, not per-team

One more distinction the matrix hides: **the pattern applies to an integration, not to a pair of
teams.** Two teams routinely hold different relationships in different directions at once —
billing may be a Conformist consumer of catalogue's product data while catalogue is a Customer of
billing's tax calculation. Recording a single pattern per team-pair loses that, and the loss matters
because the two edges have different owners, different obligations and different failure modes.

## Gotchas

**★ Symptom: Team spends six months building an Anticorruption Layer for Stripe or AWS S3.**
Cause: Dogmatic purity. Translating an industry-standard, world-class external API in a generic billing or storage subdomain wastes engineering capital.
Fix: Conform directly to the vendor's SDK/API in generic subdomains. Reserve ACLs for unruly legacy systems or core domains.

**★ Symptom: Core domain logic is littered with legacy SAP table codes (`VBELN`, `POSNR`).**
Cause: Defaulting to Conformist in a Core Domain due to deadline pressure.
Fix: Carve out an Anticorruption Layer. The core domain must speak the language of your business, not the schema of a 1990s ERP.

**★ Symptom: Assuming Customer-Supplier leverage exists simply because both teams share an engineering director.**
Cause: Ignoring organizational reality. If the upstream team's OKRs are tied to a different product launch, downstream has zero actual leverage.
Fix: Validate leverage before designing contracts. If upstream will not commit sprint capacity, design for Conformist or ACL.

**★ Symptom: the downstream team has planned around Customer/Supplier and the upstream team has never heard of it.**
Cause: the relationship was chosen unilaterally in a workshop the other team was not in.
Customer/Supplier and Partnership are the only two patterns that require the *upstream* to have
chosen them too.
Fix: name the person who agreed. If you cannot, pick a pattern that needs no agreement — Conformist
or an ACL — and upgrade later if the conversation happens. This costs a translation layer; the
alternative costs a quarter.

**★ Symptom: the context map records one relationship per pair of teams, and neither team recognises it.**
Cause: the pattern belongs to an **edge**, not to a team-pair, and the two directions between the
same teams are frequently different patterns with different owners.
Fix: one row per integration, with a direction. Billing conforming to catalogue's product data and
catalogue being a customer of billing's tax calculation are two facts, and collapsing them into "these
teams are Customer/Supplier" makes both of them wrong.

**★ Symptom: Attempting a three-way Partnership across distributed teams.**
Cause: Misunderstanding the communication overhead of symmetric coordination.
Fix: Decompose the three-way partnership into asymmetric Customer-Supplier or OHS relationships.

## Interview questions

**★ What are the three primary forces that determine the choice of a context mapping pattern?**
First, organizational leverage: whether downstream has the managerial or budgetary authority to influence upstream delivery. Second, strategic domain classification: whether downstream represents a Core Domain that must remain linguistically pure, or a Supporting/Generic domain focused on cost efficiency. Third, upstream contract quality: whether upstream exposes a clean, stable Published Language or an unruly legacy schema.

**★ Why should an organization avoid using the Conformist pattern in a Core Domain?**
A Core Domain represents the company's primary business differentiator. Conforming in a core domain binds your competitive capabilities to an external model designed by another team or third-party vendor. If that external model cannot accommodate new business models, pricing strategies, or customer workflows, your core business is constrained by foreign architecture.

**★ When is an Anticorruption Layer justified in a supporting subdomain?**
An ACL is justified in a supporting subdomain only when the upstream system is highly volatile, poorly designed, or slated for near-term replacement. In such cases, the cost of authoring a translation layer is lower than the ongoing cost of fixing downstream bugs caused by upstream instability, or the cost of rewriting the downstream domain when the legacy upstream is decommissioned.

**★ Which context-mapping patterns can a downstream team adopt unilaterally, and why does that matter more than it sounds?**
Conformist and Anticorruption Layer require nothing from the upstream — the downstream can adopt
either one this afternoon without anybody's agreement. Customer/Supplier and Partnership are
symmetric commitments that only exist if the other team has also chosen them: one means downstream
items appear in the upstream's plan, the other means joint planning and synchronised releases. This
matters because the two patterns needing agreement are exactly the two that get assigned
optimistically in a workshop the upstream was not in, and the failure is silent — the downstream team
plans around a field arriving next quarter and blocks, while the upstream has no idea it promised
anything. The rule that follows is simple: if you cannot name the person who agreed, choose a pattern
that does not need them.

**★ How does team topology and Conway's Law dictate the transition from Customer-Supplier to Open Host Service?**
As an upstream service scales to serve more consumers across an enterprise, team communication overhead explodes. A single upstream team cannot maintain multiple customer-supplier negotiations without stalling development. Upstream must transition to Open Host Service—providing a standardized, published protocol that treats all consumers as equal subscribers, decoupling upstream's release cycle from downstream demands.

---

← [Partnership and separate ways](35-partnership-and-separate-ways.md) · [Topic index](README.md) · Next → [The tells of a wrong boundary](37-the-tells-of-a-wrong-boundary.md)
