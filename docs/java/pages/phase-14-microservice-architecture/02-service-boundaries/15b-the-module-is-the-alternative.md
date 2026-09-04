---
title: "When a component is too small to be a service the answer is not to make it a bigger service — an enforced in-process module gives you the boundary, the API and the ownership without any of the fixed costs, and treating it as a consolation prize is how teams end up paying for a split they did not need"
sidebar_label: "15b · The module is the alternative"
sidebar_position: 28
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against microservices.io — the dark energy and dark matter force descriptions
> ([microservices.io](https://microservices.io/post/architecture/2023/03/26/dark-energy-dark-matter-force-descriptions.html));
> the Spring Modulith reference, *Verifying Application Module Structure*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/verification.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. Documentation-validated; **no sandbox run**.

**[15 · Too small](15-too-small.md) prices what a service costs regardless of how little code is in it, and the usual conclusion drawn from that is "so make fewer, larger services". That is the wrong conclusion, because it accepts the premise that a boundary has to be a network boundary to be real. It does not. An in-process module with a build-enforced boundary delivers the thing the split was actually for — a published API, a private interior, and a team that owns it — for none of the fixed costs, and it leaves the extraction available later at a fraction of the price. Teams read that as settling for less, which is the mistake this chunk exists to argue against: the module is not the compromise between a monolith and a service, it is the option that dominates one of them.**

## The module is the alternative, and it is not a consolation prize

Everything a small service was supposed to give you — a clear boundary, an explicit API,
independent testability, a named owner — is available in-process, at close to zero fixed
cost:

```java
// src/main/java/com/retailer/notifications/package-info.java
//
// A module with an enforced boundary and a declared dependency list. It has an API,
// internals nobody may reach, its own tests, and a CODEOWNERS entry — everything the
// separate service would have given us, minus the pipeline, the dashboards, the
// on-call surface and the contract with every consumer.
@org.springframework.modulith.ApplicationModule(
        allowedDependencies = { "sales :: events", "shared" })
package com.retailer.notifications;
```

```java
// src/test/java/com/retailer/notifications/NotificationsModuleTest.java
package com.retailer.notifications;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.test.ApplicationModuleTest;

/// @ApplicationModuleTest bootstraps this module alone — the reference describes it as
/// running the test "with the bootstrap actually limited to the application module the
/// test resides in", STANDALONE by default. Independent testability without a network.
@ApplicationModuleTest
class NotificationsModuleTest {

    @Test
    void sendsOnOrderPlaced() {
        // exercise the module in isolation
    }
}
```

The one thing the module does not give you is independent *deployment*. If that is genuinely
what you need — because a different team must ship on a different schedule — then the service
is warranted and the fixed cost is the price of that. If it is not, the module is strictly
better.

## The other direction: too big is a real failure too

This chunk is not an argument for one large service. microservices.io lists *"Simple
components — simple components consisting of few subdomains are easier to understand and
maintain than complex components"* as a dark energy force, and the cognitive-capacity limit in
*Service per team* is a hard one: a codebase nobody on the team fully understands produces
slow changes and cautious ones.

The asymmetry worth remembering is in the cost of being wrong. Too big is uncomfortable and
cheap to fix — extract a module, then a service, incrementally. Too small is comfortable and
expensive to fix, because merging two services means merging two datastores, two pipelines,
two contracts and, usually, two teams' sense of ownership. **When uncertain, err large**, and
keep the internal boundaries enforced so that erring large stays cheap to correct.

## Gotchas

**★ Symptom: the split is justified as "simpler components" and the operations it touches all became distributed.**
Cause: the only dark-energy force this split wins is *simple components*, which benefits whoever
reads one component — while *simple interactions*, *efficient interactions* and *minimize runtime
coupling* are all costs paid by whoever operates the system.
Fix: count the forces on both sides explicitly before agreeing, and name who pays each one. A split
that improves one component's readability at the cost of three distributed operations has moved
complexity from where a compiler can see it to where only an incident can.

**★ Symptom: an argument about service size that neither side can end.**
Cause: both sides are right about different forces and neither has named which. "It is easier to
understand" and "it is harder to operate" are not contradictory claims.
Fix: make the disagreement concrete by listing which of the ten forces each side is invoking and who
bears each cost. The argument usually ends there, because the fixed-cost inventory earlier on this
page is the same list with numbers attached.

**★ Counting only the infrastructure cost.** Pipelines and pods are the cheap part. The
expensive part is human: onboarding, mental model, incident diagnosis across more hops, and
the coordination for every contract change.

**★ Treating the module option as a lesser outcome.** An enforced module gives you the API,
the isolation, the independent test slice and the ownership. It withholds exactly one thing —
independent deployment. If nobody needs to deploy it independently, it is the better answer,
not the compromise.

## Interview questions

**★ How do the ten decomposition forces adjudicate a "this service is too small" argument?**
They show it is not a close call, and they explain why both sides feel right. A very small service
wins exactly one dark-energy force — *simple components*, *"consisting of few subdomains are easier to
understand and maintain"* — and that benefit is genuine, which is why the proposal keeps coming back.
It wins none of the other four: a service nobody deploys independently is not delivering team
autonomy, it rarely needs its own technology stack, and it has no distinct scaling characteristics to
segregate. Against it sit three dark-matter forces — *simple interactions*, *efficient interactions*
and *minimize runtime coupling* — and the asymmetry that matters is who pays: the benefit accrues to
whoever reads one component, and the costs accrue to whoever operates every operation that now crosses
the boundary, compounding, and usually to people who were not in the design discussion.

**★ What costs do teams most often leave out when justifying a split?**
The per-consumer costs and the human ones. Every consumer needs a client, a timeout policy, a
retry policy and a degraded-behaviour path, and every breaking change must be coordinated
with all of them — so interfaces grow faster than services do. On the human side: the service
occupies a slot in every engineer's model of the system, appears in every incident review,
and adds a hop that has to be traversed during diagnosis. Infrastructure is the cheap part and
it is usually the only part in the estimate.

---

← [Too small](15-too-small.md) · [Topic index](README.md) · Next → [The shared model jar](16-the-shared-model-jar.md)
