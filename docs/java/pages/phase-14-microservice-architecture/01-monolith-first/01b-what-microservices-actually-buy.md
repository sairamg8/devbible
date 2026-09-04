---
title: "A microservice architecture buys exactly five things, every one of them is real, and every one of them is delivered to a specific named party — so the first honest question is whether that party exists at your company"
sidebar_label: "01b · What they actually buy"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Chris Richardson, *Pattern: Microservice Architecture* and
> *Pattern: Monolithic Architecture*
> ([microservices.io](https://microservices.io/patterns/microservices.html)), and Martin
> Fowler, *Microservice Premium*
> ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePremium.html)) and
> *Conway's Law* ([martinfowler.com](https://martinfowler.com/bliki/ConwaysLaw.html)).
> Version spine: JDK 25 · Spring Boot 4.1.1 · Spring Modulith 2.1.1. **No sandbox.**

**The case against splitting is worthless if it is a case against benefits that are real.
They are real. Richardson's five "dark energy" forces are the honest, complete list of what
a microservice architecture delivers, and none of them is imaginary. What the enthusiastic
proposal leaves out is that each benefit is delivered to a specific party — a team, an
operator, a compliance officer — and if that party does not exist at your company, you have
bought a capability with no consumer.**

## The five, with the beneficiary named

### 1. Simple components

> *"Simple components — simple components consisting of few subdomains are easier to
> understand and maintain than complex components"*

**Beneficiary: the engineer onboarding onto one subdomain.** A service containing one
subdomain has a smaller thing to hold in your head than an application containing nine.
This is a genuine cognitive-load reduction and it is the benefit people feel most viscerally.

**But it is the benefit most easily obtained without splitting.** Cognitive load is bounded
by what you must *understand to change something safely*, not by what is in the deployment
artefact. If a module's API is five types and its internals are package-private and a
verification test fails when someone reaches inside, the fact that eight other modules are
in the same JAR costs you very little. That is precisely what Spring Modulith's package
conventions and `ApplicationModules.verify()` deliver — see
[28 · The package arrangement](11b-the-package-arrangement.md) and
[35 · Verifying the arrangement](12-verifying-the-arrangement.md). The split buys you a
guarantee you can get from a test.

Richardson himself lists modularising the monolith as the first mitigation:

> *"Increase maintainability and team autonomy by modularizing the monolith. Instead of the
> traditional layered architecture, the subdomains are organized into vertical slices
> consisting of presentation, business and persistent logic."*

### 2. Team autonomy

> *"Team autonomy — a team can develop, test and deploy their service independently of
> other teams"*

**Beneficiary: the second, third and fourth team.** With one team this force has no
consumer at all — you cannot be autonomous from yourself. This is the force that most
strongly correlates with a successful split, and it is entirely a function of the org
chart. [04 · Conway's law is the real driver](02-conways-law-is-the-real-driver.md) is
about why.

Note the three verbs: **develop, test and deploy**. A split that gives you independent
*develop* but not independent *deploy* — because a release requires the order service and
the inventory service to ship together — has delivered none of this force. That failure
mode is the definition of the distributed monolith, which
**12 · The distributed monolith** *(not written yet)* owns.

### 3. Fast deployment pipeline

> *"Fast deployment pipeline — each service is fast to test since it's relatively small,
> and can be deployed independently"*

**Beneficiary: everybody, but only if the pipeline was actually the constraint.** This is
where measurement matters more than anywhere else in the decision. Two numbers: how long
does one commit take to reach production, and how much of that is compile-and-test versus
queueing behind other teams' commits. If it is queueing, splitting helps enormously. If it
is compile-and-test, splitting helps a bit and a build cache helps more, for a thousandth
of the cost. See [25 · The build and the pipeline](10e-the-build-and-the-pipeline.md).

Richardson lists the cheaper mitigations explicitly:

> *"Accelerate the deployment pipeline by … apply physical design principles to the modular
> monolith in order to reduce build time coupling … implementing an automated merge queue …
> using a build tool that supports incremental building and testing … parallelizing and
> clustering the build and test steps."*

Spring Modulith adds one more that is specific to this architecture: change-aware test
execution, which runs only the modules a commit could have affected — see
**44 · Change-aware test execution** *(not written yet)*.

### 4. Support multiple technology stacks

> *"Support multiple technology stacks — different services can use different technology
> stacks and can be upgraded independently"*

**Beneficiary: the team that genuinely cannot use your stack.** This one is either
overwhelming or worthless, with almost nothing in between. If your recommendation engine is
a Python model server and your fraud scoring is a Go binary, this force alone justifies at
least those boundaries, because there is no in-process arrangement that makes them work.
If every subdomain is a Spring Boot application written by Java developers, this force
scores zero and quoting it is decoration.

The second half — *"and can be upgraded independently"* — is the sneakier and more common
version. One module pinned to an old library version holds the whole monolith back. That is
real, and [24 · Technology heterogeneity](10d-technology-heterogeneity.md) takes it
seriously.

### 5. Segregate by characteristics

> *"Segregate subdomains by their characteristics into separate services in order to
> improve scalability, availability, security etc"*

**Beneficiary: the operator, the security reviewer and the auditor.** This is the force
that actually justifies more splits than people credit, because it is not only about
scaling:

- **Resource shape.** A report generator that allocates a 3 GB result set and a checkout
  API with a 50 ms latency budget want different heap sizes, different GC settings and
  different pod limits. In one process they share a heap and a garbage collector.
- **Availability tier.** Checkout must be up. The marketing CMS admin need not be. In one
  deployable, they have the same availability, which means the *lower* of the two teams'
  operational discipline sets the tier for both.
- **Security and blast radius.** The service that holds card data can live in a separate
  network segment with its own credentials, its own audit trail and a far smaller set of
  people who can deploy to it. This is a genuinely hard requirement in regulated
  environments and there is no in-process answer to it.
- **Data residency.** If EU customer records must not leave the EU and the rest of the
  system runs in `us-east`, a boundary that is also a deployment boundary is the only
  honest implementation.

[23 · Blast radius](10c-blast-radius.md) and [22 · Independent scaling](10b-independent-scaling.md)
go through the technical half of this in detail.

## The score sheet you should actually fill in

Do not argue about the forces in the abstract. Score them, per subdomain, with the party
named. A table like this, filled in honestly, ends most split arguments in ten minutes:

| Force | Consumer of the benefit | Does that consumer exist today? | Cheaper in-process option |
|---|---|---|---|
| Simple components | Engineer changing one subdomain | Always | Modulith package rules + `verify()` |
| Team autonomy | Team 2..N | Only if N ≥ 2 | None — this is the real one |
| Fast pipeline | Everyone, if queueing is the cost | Measure it | Build cache, merge queue, module tests |
| Multiple stacks | The non-JVM subdomain | Usually no | None if it is genuinely non-JVM |
| Segregate by characteristic | Operator / security / auditor | Sometimes | Separate the *deployable*, not the *codebase* |

That last cell is the most useful and least discussed option in the whole decision. You can
build **one codebase that produces two deployables** — the same Spring Boot application
started with different profiles, one running only the API, one running only the batch
workers — and get resource segregation, availability tiering and blast-radius reduction
without a single network hop between subdomains, without splitting the database, and
without giving up `@Transactional`. It is not a microservice architecture. It also is not
a monolith in the operational sense. It solves force 5 for a fraction of the price, and
almost nobody considers it.

## What none of the five forces says

None of them says "faster". None of them says "more scalable" in the raw throughput sense —
a monolith replicated behind a load balancer scales horizontally perfectly well, and
Richardson's own monolith page says so: *"You can run multiple instances of the application
behind a load balancer in order to scale and improve availability."* None of them says
"cleaner code". Those are the three things people most often expect from a split and the
three the pattern does not promise.

## Gotchas

**★ Buying a capability with no consumer is the single most common split error.** "Support
multiple technology stacks" in an all-Java shop, "team autonomy" with one team, "segregate
by characteristics" when every subdomain has identical resource and availability
requirements. Each is a real force, scored zero, quoted anyway. Make the proposal name a
person or a team for each force, by name.

**★ Force 1 and force 2 look like the same benefit and are not.** "Simple components" is
about what one person must understand; "team autonomy" is about what two groups must
coordinate. A modular monolith delivers the first almost completely and the second barely
at all. Conflating them is why teams believe modularity cannot substitute for splitting —
for cognitive load it substitutes almost perfectly, for coordination it does not
substitute at all.

**★ The fifth force is the one you can get without a microservice architecture, and the
one people forget you can.** Two deployables from one artefact — API pods and worker pods
from the same JAR, different `--spring.profiles.active`, different memory limits — gets you
resource segregation and blast-radius reduction for a Kubernetes manifest and no
architecture change. It fails to give you independent *release cadence*, which is the point
at which you have to make the real decision.

**★ "Independently deployable" quietly requires "independently testable in production-like
conditions".** Richardson's phrasing is *"In order to be independently deployable each
service typically has its own source code repository and its own deployment pipeline, which
builds, tests and deploys the service."* If your integration suite spins up all six
services, you have one pipeline wearing six hats, and force 3 evaporates. The answer is
consumer-driven contract tests, which **11 · Contract testing** *(not written yet)* owns —
and which is itself a nontrivial capability you must build before the split pays off.

**★ Force 4's second clause is the one that actually bites, and it bites monoliths that
have no non-Java code at all.** Independent *upgrade*, not independent *language*. One
module stuck on an old Jackson, an old Hibernate, an old JDK because a vendor library
requires it, pins all of them. That is a genuine and common monolith failure, and it is a
much better argument than "we might want to write something in Rust".

## Interview questions

**★ Name the five benefits of a microservice architecture, and for each say who receives
it.**
Simple components — the engineer changing one subdomain. Team autonomy — the second and
subsequent teams. Fast deployment pipeline — every committer, but only if pipeline queueing
rather than compile time is the constraint. Multiple technology stacks — the subdomain that
genuinely cannot run on the shared stack, and any module that needs to upgrade a dependency
independently. Segregate by characteristics — the operator, the security reviewer and the
auditor, covering resource shape, availability tier, security isolation and data residency.
The useful move in an interview is to add that four of the five have partial or complete
in-process substitutes, and only team autonomy has none.

**★ Which of these benefits can a modular monolith deliver, and which can it not?**
It delivers "simple components" almost completely, provided modularity is enforced by a
failing build rather than by convention. It delivers a large fraction of "fast deployment
pipeline" through incremental builds, merge queues and module-scoped tests. It can deliver
"segregate by characteristics" partially, by producing several deployables from one
codebase. It cannot deliver "multiple technology stacks" at all for a genuinely non-JVM
subdomain, and it cannot deliver "team autonomy" in the sense of independent release
cadence — every team ships when the shared artefact ships. That last one is the honest
boundary of the technique.

**★ A team says "we need microservices so we can scale". What is wrong with the sentence?**
Nothing, if they mean *segregate by characteristics* — one subdomain has a resource or
availability profile the rest of the system cannot accommodate. Everything, if they mean
raw throughput, because a monolith scales horizontally by running more instances behind a
load balancer, which is cheaper and simpler than splitting. The follow-up question is
"which subdomain, and what is different about its resource profile?" If the answer is "all
of it, under load", the fix is more instances, not more services.

**★ What does "independently deployable" require beyond having separate pipelines?**
It requires that you can ship service A without shipping service B, which requires that A
and B's contract can change without a coordinated release — additive, tolerant-reader
evolution, owned by **05 · Inter-service REST** *(not written yet)*. It also requires that
you can *verify* A alone, which means consumer-driven contract tests rather than an
integration environment where everything is deployed together. Teams that split without
building both of those get separate repositories and simultaneous releases, which is all
of the cost and none of the benefit.

{/* FOOTER */}
