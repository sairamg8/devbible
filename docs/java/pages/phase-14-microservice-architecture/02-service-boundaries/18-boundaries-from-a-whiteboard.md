---
title: "A greenfield boundary is a guess about a domain nobody understands yet, and the honest response is not better guessing — it is to make the guess cheap to be wrong about by drawing it in code before drawing it in infrastructure"
sidebar_label: "26 · Boundaries from a whiteboard"
sidebar_position: 26
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io *Decompose by business capability*
> ([microservices.io](https://microservices.io/patterns/decomposition/decompose-by-business-capability.html)),
> which notes that identifying capabilities *"requires deep business understanding and
> iterative analysis"*; *Assemblage overview: Part 3*
> ([microservices.io](https://microservices.io/post/architecture/2023/09/19/assemblage-part-3-whats-a-service-architecture.html));
> the Spring Modulith 2.1.1 reference, *Verifying Application Module Structure*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/verification.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**Every technique in this topic that produces good boundaries needs evidence: invariants
elicited from real operations, co-change from real commits, ownership from real teams. On a
greenfield project none of that exists. The whiteboard is not a lesser version of the
evidence — it is a different thing entirely, a set of hypotheses derived from what people
currently believe about a business they have not built software for. The mistake is not
drawing boundaries on a whiteboard; you have nothing else. The mistake is implementing them
as deployment boundaries, which converts a hypothesis into a commitment before you can test
it.**

## Why the greenfield guess is systematically wrong

Not randomly wrong — wrong in predictable directions, all of which you can anticipate.

**It reflects the current organisation.** The people in the room are the people who exist,
and they will describe the domain in terms of their departments. Conway's law applied
prospectively, to an organisation that will itself change.

**It reflects the analogous system.** Whoever has built something similar before will supply
the shape, and their previous employer's constraints come with it.

**It has no invariants in it.** Invariants come from operations, and on day one the operations
are aspirations. The whiteboard has entities and arrows, which is exactly the material that
produces entity services.

**It has no change data.** The Common Closure Principle needs history. On a greenfield project
the only available substitute is a guess about what will change together, and guesses about
future change are consistently wrong in the same way: people expect the interesting things to
change and the boring things to be stable, and it is usually the boring things that get
requirements.

**It is agreed, which feels like being right.** A room that converges quickly has usually
converged on a shared prior, not on the domain.

## What the whiteboard is genuinely good for

It produces the *vocabulary* and the *candidate list*, which are real deliverables:

- A list of candidate subdomains, which is the starting partition.
- The nouns and their disputed definitions, which is
  [03 · The same word, two meanings](02b-the-same-word-two-meanings.md) done early and
  cheaply.
- The system operations people expect to need, which is
  [29 · System operations first](21-system-operations-first.md)'s input.
- Disagreements between stakeholders, which are the most valuable output of the session and
  the one most likely to be smoothed over.

What it cannot produce is confidence about *where* the lines go, and treating its output as
if it could is the whole error.

## The strategy: modules now, services when the evidence arrives

Draw the boundaries you believe in. Implement them as enforced in-process modules. Deploy
one service. Wait for evidence. Split when a specific pressure appears.

This is not a compromise; it is the strategy with the best expected outcome under
uncertainty, because the two error costs are wildly asymmetric.

**Wrong module boundary:** move some packages, update the module declarations, run the test.
Hours, reversible, invisible to anyone outside the team.

**Wrong service boundary:** migrate data between databases, version and deprecate APIs,
coordinate with every consumer, run a dual-write window, change team ownership. Weeks to
quarters, and politically hard because someone's remit shrinks. Priced in
**54 · The cost of changing a boundary** *(not written yet)*.

The starting shape, with the guessed boundaries made real by the compiler and a test:

```text
com.retailer
├── RetailerApplication.java
├── catalogue/          ← guess
│   └── internal/
├── pricing/            ← guess
│   └── internal/
├── ordercapture/       ← guess
│   └── internal/
├── inventory/          ← guess
│   └── internal/
└── fulfilment/         ← guess
    └── internal/
```

```java
// src/test/java/com/retailer/ArchitectureTest.java
package com.retailer;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ArchitectureTest {

    /// Enforces the three rules the Spring Modulith reference states verify() applies:
    /// no cycles between modules, no access to another module's internal packages, and
    /// — where declared — only the dependencies a module explicitly allows.
    /// The guesses are now checkable, and a guess that turns out wrong fails a build
    /// rather than rotting quietly.
    @Test
    void modulesAreWellFormed() {
        ApplicationModules.of(RetailerApplication.class).verify();
    }
}
```

The verification is what makes this different from "we will keep it modular". Without it, six
months of deadline pressure erases the boundaries and the eventual split has to start from
nothing.

## The triggers that convert a module into a service

Wait for one of these, and name which one in the decision record:

1. **A team needs to ship independently and is blocked by another's release cadence.** The
   most common legitimate trigger, and it is organisational.
2. **A measured, current difference in scaling profile.** Not anticipated — measured.
3. **A different availability or security requirement.** Card data, a component that must
   survive when the rest is down, a regulated boundary.
4. **A different technology is genuinely required.** A model server, a native-image
   low-latency path.
5. **The module has become too large for the team's cognitive capacity, and the split follows
   a boundary the evidence supports.**

Absent any of these, splitting is buying the fixed cost in [23 · Too
small](15-too-small.md) for nothing.

## What to write down on day one

A short architecture decision record, kept in the repository, saying:

- The candidate subdomains and why each is believed to be one.
- The invariants believed to exist, marked as unverified.
- The disagreements that were not resolved in the session.
- **The specific observations that would falsify each boundary** — the most valuable line and
  the one nobody writes. "If catalogue and pricing turn out to change together in most
  releases, this boundary is wrong."

Six months later that document is worth more than the diagram, because it lets you check the
guess against what actually happened rather than rationalising the diagram you have.

## Gotchas

**★ Symptom: a greenfield project starting with eight services.** Cause: the whiteboard was
implemented as infrastructure. Fix: eight modules and one deployable. Nothing is lost — the
boundaries are enforced by the build — and everything stays cheap to move.

**★ Symptom: the boundaries were "kept modular" with no enforcement.** Cause: discipline
without a mechanism. Fix: `ApplicationModules.verify()` or ArchUnit, in the same test run as
everything else, from the first commit. A modular monolith without verification becomes a big
ball of mud on the same schedule as any other codebase.

**★ Treating fast agreement in a design session as confirmation.** A room that converges in
twenty minutes has usually agreed on a familiar shape. Deliberately ask each participant to
describe a case the proposed boundary handles badly; the absence of any such case means
nobody has looked.

**★ Symptom: no record of what would falsify the design.** Cause: the output was a diagram
rather than a set of hypotheses. Fix: write the falsifiers down. It costs ten minutes and it
is the only thing that lets a future team distinguish "this boundary is wrong" from "this
boundary is unfamiliar".

**★ Copying the boundaries from a previous employer's system.** They encode that company's
domain, org chart and constraints. The vocabulary may transfer; the lines almost never do.

**★ Waiting for perfect evidence.** The strategy is not paralysis — draw the boundaries,
implement them as modules, ship. The point is that the *deployment* commitment waits, not the
design.

**★ Splitting because the team wants microservices experience.** It is an honest motivation
and a bad reason, and it should at least be stated out loud so it can be weighed against the
fixed cost rather than dressed as domain analysis.

## Interview questions

**★ You are starting a greenfield project. How many services do you start with?**
One, with the boundaries you believe in implemented as enforced in-process modules. On day one
there is no evidence — no invariants elicited from real operations, no commit history, no
observed change coupling — so any boundary is a hypothesis about a domain nobody has built
software for yet. The asymmetry decides it: a wrong module boundary is hours of package moves,
and a wrong service boundary is data migration, API deprecation, consumer coordination and a
change of team ownership. Draw the lines, enforce them in the build, and convert one to a
service when a specific pressure appears.

**★ In what predictable ways is a greenfield boundary wrong?**
It reflects the current organisation rather than the domain, because the people in the room
describe the business in terms of their departments. It reflects whatever similar system
someone in the room built before. It has no invariants in it, because invariants come from
real operations and the operations are still aspirations — so what the whiteboard produces is
entities and arrows, which is the raw material of entity services. And it has no change data,
so the Common Closure Principle cannot be applied at all.

**★ What is the difference between "start with a monolith" and "start with a modular
monolith"?**
Enforcement. "We will keep it modular" without a mechanism decays at the usual rate, and when
the split eventually happens you start from an unstructured codebase with no seams. A modular
monolith has the boundaries as verified structure: on Spring Modulith,
`ApplicationModules.of(...).verify()` fails the build on a cycle between modules, on access to
another module's internal package, and on any dependency a module has not declared. That test
is the difference between a hypothesis you can test and an intention you will not keep.

**★ What triggers converting a module into a service?**
A named, current pressure — not the passage of time and not the module's size alone. A team
blocked by another team's release cadence, which is the most common and is organisational. A
measured difference in scaling profile. A different availability or security posture, such as
a component handling card data or one that must remain up when the rest is down. A genuinely
required different technology. Or cognitive capacity, where the split follows a boundary the
evidence supports. If none of these applies, the split buys the full per-service fixed cost
for nothing.

**★ What should a greenfield design session actually produce?**
Vocabulary, a candidate list of subdomains, the system operations people expect, and — most
valuably — the unresolved disagreements and the observations that would prove each boundary
wrong. That last item is what almost nobody writes and what makes the document useful in a
year: "if catalogue and pricing turn out to change together in most releases, this boundary
is wrong" is checkable against the commit log. A diagram is not checkable, so a year later the
team can only rationalise it.

{/* FOOTER */}
