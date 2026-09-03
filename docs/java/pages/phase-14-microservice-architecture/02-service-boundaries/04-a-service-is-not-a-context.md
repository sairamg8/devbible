---
title: "Everyone repeats that one service equals one bounded context, and the source everyone cites says something different and more useful: a service is a grouping of one or more subdomains, and a monolith is simply the grouping with one member"
sidebar_label: "07 · A service is not a context"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io *Assemblage overview: Part 3 — What's a
> service architecture?*
> ([microservices.io](https://microservices.io/post/architecture/2023/09/19/assemblage-part-3-whats-a-service-architecture.html)),
> the *Microservice Architecture* pattern
> ([microservices.io](https://microservices.io/patterns/microservices.html)), *Service per
> team* ([microservices.io](https://microservices.io/patterns/decomposition/service-per-team.html))
> and the *Microservice Architecture Glossary*
> ([microservices.io](https://microservices.io/articles/glossary)).
> Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**🔴 The folk rule "one service = one bounded context" is repeated in almost every
microservices talk, and the primary sources it is attributed to do not say it. What Chris
Richardson's Assemblage material says is that a service architecture is a *partitioning* of
subdomains into services: each service holds one or more subdomains, and each subdomain
belongs to exactly one service. That is a materially different rule, and the difference is
the single most useful correction in this topic — because it makes "several subdomains, one
service" a legitimate, named design point rather than a compromise you apologise for, and
it makes the monolith the one-element case of the same model rather than a different kind of
thing.**

## What the source actually says

Assemblage's step 3 defines a service architecture in three sentences, and they are worth
reading exactly:

> *"The service architecture consists of one or more services. The services are a
> grouping/partitioning of the application's subdomains that were defined in step 2."*

> *"Each service consists of one or more subdomains. Each subdomain is in one and only one
> service."*

> *"If the service architecture consists of one service, it's a monolith and if there's
> more than one, it's a microservice architecture."*

And the *Microservice Architecture* pattern's own solution statement agrees:

> *"Structure the application as a set of two or more independently deployable, loosely
> coupled, components, a.k.a. services"* — each of which contains *"one or more
> subdomains"* and is *"owned by the team (or teams)"* responsible for those subdomains.

So the constraint is a partition in one direction only. Subdomain-to-service is
many-to-one. Service-to-subdomain is one-to-many.

## What that changes, concretely

**1. A service with four subdomains is not automatically wrong.** It is wrong if those four
subdomains have diverging change rates, need separate teams, or need different scaling or
security characteristics. It is right if they change together, are owned by one team, and
would only be talking to each other over a network to no purpose. "This service contains
four subdomains" is not a finding; it is a fact awaiting a judgement.

**2. The monolith is on the same axis, not on a different one.** Under this model you do
not choose between "monolith" and "microservices" as philosophies. You choose a
partitioning, and the number of parts is an output. That reframing kills a great deal of
unproductive argument, and it makes the migration path continuous: merging two services
moves you along the axis, it does not change what kind of system you have.

**3. The unit of ownership is the subdomain, not the service.** A subdomain is
*"team-sized"* and belongs to one service; several team-sized subdomains in one service
means either one team with a big remit or — the failure case — two teams sharing a
deployable, which *Service per team* warns against.

**4. Splitting is monotone but merging is not free.** Because each subdomain is in exactly
one service, splitting a service means partitioning its subdomains, which is clean if the
subdomains were properly separated inside it. That is the whole argument for enforcing
subdomain boundaries in-process before you consider network boundaries — see
**33 · Package structure is the boundary** *(not written yet)*.

## Where the folk rule comes from, and when it is right

The rule is not stupid; it is a heuristic that has been promoted to a law. Its logic:

- A bounded context has one model and one language.
- A service has one API and one datastore.
- Two contexts in one service means two models in one datastore, which tempts everyone into
  joining across them, which dissolves the boundary.

That last step is the real risk and it is why the heuristic exists. Two contexts sharing a
deployable *will* be joined together by someone under deadline pressure unless something
stops them. The answer is not necessarily a network boundary; it is an enforced in-process
boundary. `ApplicationModules.verify()` fails a build for exactly this, and it costs a test
rather than a service.

**When to follow the folk rule anyway:** when the two contexts are owned by different teams,
when one needs radically different availability or compliance treatment, or when your
organisation has no mechanism at all for enforcing in-process boundaries. In that last case
the network is being used as a discipline mechanism, which is expensive, and you should say
so out loud rather than dressing it as domain design.

## The counting exercise that makes this concrete

Take a retailer with these subdomains: order capture, pricing, promotions, inventory,
delivery scheduling, carrier integration, payment, invoicing, customer support, catalogue,
search. Eleven subdomains.

The folk rule says eleven services. The Assemblage model says: choose a partition. Three
defensible partitions for three different companies:

| Partition | Services | Fits a company that |
|---|---|---|
| **A — two teams** | `storefront` (catalogue, search, order capture, pricing, promotions), `operations` (inventory, delivery scheduling, carrier, payment, invoicing, support) | Has twelve engineers and needs to ship features, not operate a fleet |
| **B — growth stage** | `catalogue`, `pricing` (pricing + promotions), `orders` (capture + invoicing), `inventory`, `fulfilment` (delivery + carrier), `payments`, `support` | Has five or six teams with genuinely different roadmaps |
| **C — folk rule** | Eleven services | Has eleven teams, or is about to discover it does not |

Partition A is a microservice architecture with two services and it is a perfectly
legitimate output of the method. Partition C is not more "correct"; it is a different
trade-off, and for a twelve-engineer company it is a straightforward mistake — eleven
pipelines, eleven on-call surfaces, eleven dependency upgrade streams, and every feature
touching four of them.

## Reading the constraint the other way: what is genuinely forbidden

The model forbids one thing precisely: **a subdomain split across two services**. That is
the error, and it is the one people rarely name. If order capture lives partly in
`storefront` and partly in `orders`, then every change to order capture is a two-service
change, and you have paid for a boundary that buys nothing. This is the shape of most
distributed monoliths, and it is why the split-by-layer and split-by-entity mistakes in
[18 · Splitting by layer](12-splitting-by-layer.md) and [19 · Entity
services](13-entity-services.md) are so damaging: both of them split subdomains rather than
partitioning them.

Concretely, the checkable version of the rule:

> For every business capability, name the single service that owns it. If any capability
> needs two names, that is the defect.

## In Java: several subdomains, one deployable, real boundaries

```java
package com.retailer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class StorefrontApplication {

    public static void main(String[] args) {
        SpringApplication.run(StorefrontApplication.class, args);
    }
}
```

```text
com.retailer                 ← one service, four subdomains
├── catalogue/               ← subdomain, own model, own tables
│   └── internal/
├── search/
│   └── internal/
├── ordercapture/
│   └── internal/
└── pricing/
    └── internal/
```

```java
// src/main/java/com/retailer/catalogue/package-info.java
//
// Declaring dependencies explicitly turns "several subdomains in one service" from a
// risk into a checked structure: catalogue may use pricing, and nothing else.
@org.springframework.modulith.ApplicationModule(allowedDependencies = "pricing")
package com.retailer.catalogue;
```

```java
// src/test/java/com/retailer/ModularityTests.java
package com.retailer;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ModularityTests {

    @Test
    void subdomainsRemainSeparate() {
        ApplicationModules.of(StorefrontApplication.class).verify();
    }
}
```

That test enforces the partition. It is the difference between "four subdomains in one
service" as a design and "four subdomains in one service" as an accident.

## Gotchas

**★ Citing the folk rule in a design document.** If a document says "one service per bounded
context, per DDD", it is asserting something the cited sources do not say, and it usually
closes off the option that is right for the team's size. State the partition and its
reasons instead.

**★ Symptom: a capability that two services both claim.** Cause: a subdomain was split
rather than assigned. Fix: pick one owner and move the rest; there is no version of this
that works with shared ownership. Which owner is the subject of
**39 · Moving a capability** *(not written yet)*.

**★ Putting several subdomains in one service and then not enforcing the internal
boundary.** This is the failure the folk rule is defending against and it is real. Within
six months there will be a repository in one subdomain queried from another, and a join
across their tables. Without `ApplicationModules.verify()`, ArchUnit, or JPMS, "we will be
disciplined" is not a plan.

**★ Assuming that because a service holds several subdomains it must eventually split.**
Most will not, and should not. The trigger for splitting is a specific pressure — a team
that needs autonomy, a scaling characteristic that differs, a compliance boundary — not the
passage of time.

**★ Treating the count of services as a maturity metric.** It measures the partition, and a
partition is a trade-off, not a score. A team reporting "we are up to 40 services" has told
you nothing about whether any of them can be changed independently.

**★ Forgetting that a service is owned by a team.** microservices.io's *Service per team*
is explicit: *"Each service is owned by a team, which has sole responsibility for making
changes"*, and *"A team should have exactly one service unless there is a proven need"*. A
partition that produces more services than teams needs a stated reason.

## Interview questions

**★ Is it true that one microservice should equal one bounded context?**
It is a widely repeated heuristic, and the primary source usually invoked for it says
something looser and more useful. microservices.io's Assemblage material defines a service
architecture as a partitioning of subdomains: each service contains one or more subdomains,
and each subdomain sits in exactly one service. So several contexts in one service is a
legitimate design point — the constraint that actually matters is the other direction, that
no subdomain may be split across services. The heuristic is defending against a real risk:
two contexts in one deployable get merged by someone under pressure. The correct answer to
that risk is an enforced in-process boundary, not necessarily a network one.

**★ If a monolith is "one service", does the term microservices mean anything?**
Under that model it means "more than one", which sounds trivial until you notice how much
argument it dissolves. It reframes the question from "should we do microservices" — an
identity question with no answer — to "what is the right partition of our subdomains right
now", which has evidence attached: team count, change rates, scaling profiles, invariants.
It also makes the two directions symmetric: merging two services is a legitimate move along
the same axis, not an admission of failure.

**★ What is the one thing this model actually forbids?**
Splitting a subdomain across two services. Every other configuration is a trade-off you can
argue about; that one is a defect, because a single business capability now requires
coordinated changes to two deployables and the boundary between them buys nothing. It is
also the precise shape of the distributed monolith, which is why splitting by technical
layer or by entity is so reliably bad — both cut *through* subdomains rather than between
them.

**★ Your company has 12 engineers and an architect proposes 11 services. What is your
argument?**
That each service carries fixed costs — a pipeline, a deployment, dashboards, alerts,
dependency upgrades, an on-call surface, and a versioned contract with every consumer — and
those costs are paid per service per year regardless of size. With 12 engineers you cannot
staff 11 ownership boundaries, so services will be shared, which means the coordination cost
of a monolith plus the operational cost of a distributed system. The Assemblage model gives
me the constructive counter-proposal: keep the 11 subdomains as enforced modules, partition
them into two or three services aligned to the teams that exist, and let the partition change
when the team count does. The subdomain work is not wasted — it is exactly what makes a
later split cheap.

**★ How would you tell whether a service holding four subdomains is a problem?**
Look for evidence rather than counting. Do the four change on different schedules — check
the commit history for whether they co-change? Do they need different scaling or
availability treatment? Is more than one team making changes to them? Is any of them blocked
waiting on another's release? If the answers are no, the grouping is doing its job and
splitting would add cost. If a team is genuinely blocked by another team's release schedule
inside the same deployable, that is the signal, and it is an organisational one before it is
a technical one.

{/* FOOTER */}
