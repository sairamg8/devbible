---
title: "The costs that are neither code nor infrastructure: the shared library that recouples everything, the capability that belongs to nobody, the standard nobody enforces, and the coordination overhead that grows with every boundary you add"
sidebar_label: "09 · The organisational costs"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Chris Richardson, *Pattern: Microservice Architecture* and
> *Pattern: Monolithic Architecture*
> ([microservices.io](https://microservices.io/patterns/microservices.html)); Team
> Topologies, *Key Concepts* ([teamtopologies.com](https://teamtopologies.com/key-concepts));
> Melvin E. Conway, *How Do Committees Invent?* (1968)
> ([melconway.com](https://www.melconway.com/Home/Committees_Paper.html)); Martin Fowler,
> *Conway's Law* ([martinfowler.com](https://martinfowler.com/bliki/ConwaysLaw.html)).
> Version spine: JDK 25 · Spring Boot 4.1.1 · Spring Modulith 2.1.1. **No sandbox.**

**Some of a split's costs are not paid in code or in infrastructure. They are paid in
meetings, in things nobody owns, in standards that erode, and in the quadratic growth of
coordination that Conway described. These are the least visible costs and the ones most
likely to be dismissed as "process problems" when they turn up.**

## Cost 1 — the shared library, and the DRY instinct that produces it

Richardson allows for it in the pattern itself:

> *"Each subdomain is part of a single service except for shared library subdomains that are
> used by multiple services."*

Note the word **subdomain**. A shared library of genuinely generic infrastructure — a
logging filter, a metrics configuration, an HTTP client wrapper — is fine. A shared library
containing **domain types** is a rebuilt monolith with worse ergonomics: every change
requires a library release plus a coordinated upgrade of every consumer, and the coupling is
hidden in a POM where no architecture review will look at it.

The failure is caused by good instincts. Duplicating `Address` across three services feels
wrong to every engineer who has been taught DRY. But `Address` in ordering, `Address` in
shipping and `Address` in billing are **three different concepts that currently look
similar** — which is the whole content of the bounded-context idea. Unifying them means all
three must change together forever.

The rule that works: **shared libraries may contain no type that appears in a domain
model, and no type that crosses the wire.** Everything else is negotiable.

## Cost 2 — the capability that belongs to nobody

Splitting partitions the code, and the partition is never exhaustive. Things that end up
unowned:

- **Cross-service flows.** Checkout spans four services and has four owners, which is zero.
  [16 · The on-call surface](07-the-on-call-surface.md).
- **The API gateway's configuration.** Every team adds routes; nobody owns the whole. **07 ·
  API gateway** *(not written yet)*.
- **Shared reference data.** Countries, currencies, tax rates. Every service needs them,
  none wants to own them. **03 · Database-per-service** *(not written yet)* owns the
  duplication strategy.
- **The service template.** Whoever created it, unless a platform team exists.
- **Cross-cutting upgrades.** A framework major version means N pull requests; nobody's
  roadmap includes them.
- **The consumer registry.** Who calls what — a question with no authoritative answer unless
  contract tests provide one.

In a monolith every one of these is inside a single artefact with a single owning team.
That is not because the monolith is well organised; it is because there was nowhere else for
them to fall.

## Cost 3 — standards erode across boundaries, and the erosion is invisible

Twelve services means twelve chances to diverge on: error response shape, pagination style,
authentication handling, log format, metric naming, health-check semantics, timeout defaults,
retry policy, date and money representation.

Each divergence is individually defensible and locally correct. Collectively they mean a
developer moving between services relearns the conventions each time, a shared dashboard
cannot be built because metric names differ, and the gateway needs per-service special
cases. This is precisely Team Topologies' *"Respect Cognitive Limits"* problem arriving via
inconsistency rather than volume.

In a monolith the conventions are enforced by proximity: the class next to yours does it a
certain way, so you do too. That is a real, if accidental, enforcement mechanism, and
splitting removes it.

## Cost 4 — coordination grows quadratically, which is Conway's own arithmetic

> *"Elementary probability theory tells us that the number of possible communication paths in
> an organization is approximately half the square of the number of people in the
> organization. Even in a moderately small organization it becomes necessary to restrict
> communication in order that people can get some 'work' done."*

The same `n(n−1)/2` applies to teams and to services. Three teams have 3 possible pairs; six
have 15; ten have 45. Splitting does not reduce the number of things that must be
coordinated; it changes **how** the coordination happens — from an in-process call the
compiler checks, to a conversation between two teams.

Team Topologies' response is to restrict interaction to three defined modes and to prefer
the cheapest:

> *"Collaboration: Working closely together (high bandwidth, high cost)"*
>
> *"X-as-a-Service: Consuming or providing with minimal interaction (low cost, clear
> boundaries)"*
>
> *"Facilitating: Helping remove obstacles (temporary and focused)"*

And states the actual target plainly:

> *"Eliminate Team Dependencies — Nothing kills productivity faster than one team waiting on
> another team. Most companies obsess over making individual teams more efficient while
> ignoring the massive delays that happen between teams. I've watched organizations hire more
> people and ship less because their teams were still waiting for each other. Fix the
> handoffs, not just the teams."*

**Read "fix the handoffs, not just the teams" as the actual objective of a split.** If the
handoffs remain — a code review from another team, a schema change request, a shared release
train — you have added boundaries without removing waiting, which is the worst possible
outcome.

## Cost 5 — the reorganisation risk you inherit

Once services are aligned to teams, a reorganisation is an architectural event. Teams merge,
split or dissolve; their services do not automatically follow. What you get:

- **Orphaned services** with no owner, no alert watcher and no upgrade path.
- **Services owned by a team that inherited them** and does not know the domain.
- **A misalignment between the service graph and the communication graph**, which Fowler
  warns produces exactly the friction the alignment was meant to prevent.

In a monolith a reorganisation redistributes packages, which is free. This asymmetry is
rarely stated and it is one of the more durable arguments for delaying a split in an
organisation whose shape is still changing.

## What this looks like in the modular monolith

Every cost above has a cheaper in-process analogue, which is what makes the modular monolith
a genuine rehearsal rather than an evasion:

- **Shared types** are visible as cross-module imports and can be *banned by a test*:
  `ApplicationModules.of(Application.class).verify()` rejects references into another
  module's internals. [35 · Verifying the arrangement](12-verifying-the-arrangement.md).
- **Ownership** is recordable per module in `package-info.java`, next to the allowed
  dependencies. [31 · Explicit allowed dependencies](11e-explicit-allowed-dependencies.md).
- **Standards** are enforced by proximity and one build.
- **Coordination** is a pull request, not a cross-team negotiation.
- **Reorganisation** moves ownership annotations, not deployment topologies.

## Gotchas

**★ A shared library of domain types is a monolith with worse ergonomics, and it is built by
good engineers following good instincts.** DRY says unify `Address`; bounded contexts say
the three `Address` types are three concepts that currently resemble each other. The
enforceable rule is that shared libraries contain no type that appears in a domain model and
no type that crosses the wire; duplication across services is correct, and it is what lets
them evolve separately.

**★ Splitting creates categories of work that fall between services, and the partition is
never exhaustive.** Cross-service flows, gateway configuration, shared reference data, the
service template, framework-wide upgrades, and the consumer registry. Assign each explicitly
at split time, because the default owner is "whoever is most annoyed", which is not a
sustainable model.

**★ Standards erode across boundaries and the erosion is invisible until you try to build
something that spans them.** Twelve error formats, twelve pagination styles, twelve metric
naming schemes. Each is locally defensible; collectively they prevent a shared dashboard and
force per-service special cases in the gateway. Codify the conventions in a service template
and check them in CI, or accept the divergence as a cost.

**★ Coordination paths grow quadratically in teams, exactly as Conway computed for people.**
Ten teams have forty-five possible pairs. Splitting changes coordination from a
compiler-checked call into a conversation; it does not reduce the amount of coordination
required. That reduction only comes from getting the boundary right so most pairs never need
to talk.

**★ "Fix the handoffs, not just the teams" is the test for whether a split achieved
anything.** If a team still waits on another team's code review, schema change or release
train, the boundaries did not remove the waiting — they just made it cross a network.
Measure the waiting before and after; it is the only honest success metric for a split.

**★ Reorganisations become architectural events once services are team-aligned, and
organisations reorganise more often than they expect.** Orphaned services, services inherited
by teams that do not know the domain, and a service graph that no longer matches the
communication graph. In a monolith the same reorganisation redistributes packages, which
costs nothing. If your organisation's shape is still moving, that argues for delay.

**★ Duplicated reference data is a real and normal cost, not a design failure.** Countries,
currencies, tax rates and product categories will end up copied into several services, and
the copies will drift. The choices are a synchronising event stream, a scheduled refresh or
a shared read-only service — each with a staleness window somebody must specify. Deciding
this deliberately at split time is much cheaper than discovering it via a mismatched tax
calculation.

**★ The modular monolith can enforce the anti-shared-library rule mechanically, which no
multi-repo estate can.** A cross-module reference into internals fails the build on the
commit that introduces it. Across repositories the equivalent is a review convention plus
a dependency-analysis tool somebody has to maintain — which is why the discipline holds
in-process and erodes after extraction.

## Interview questions

**★ Why is a shared domain library between microservices an anti-pattern?**
Because it reinstates compile-time coupling in a place nobody reviews. Every change to a
shared domain type requires a library release plus a coordinated upgrade of every consumer,
so the services can no longer deploy independently — which was the entire point of splitting.
It is built by good engineers following DRY, and the correction is the bounded-context
insight: `Address` in ordering, shipping and billing are three concepts that currently look
alike, and unifying them means all three must change together forever. Shared libraries are
fine for generic infrastructure and poisonous for anything domain-shaped or anything that
crosses the wire.

**★ What work becomes unowned after a split?**
Cross-service flows, which have several service owners and therefore none. The API gateway's
aggregate configuration. Shared reference data such as countries, currencies and tax rates.
The service template. Cross-cutting framework upgrades, which turn into N pull requests on
nobody's roadmap. And the consumer registry — who calls what — which has no authoritative
answer unless contract tests happen to provide one. In a monolith these all sit inside one
artefact with one owning team, not because the monolith is well organised but because there
was nowhere else for them to fall.

**★ How do you measure whether a split actually helped?**
By measuring waiting, not deployments. The objective is eliminating team dependencies, so
the metric is how often a team is blocked on another team and for how long: waiting for a
code review from a different team, for a schema change, for a place on a shared release
train, for an integration environment. If those numbers did not fall, the split added
boundaries without removing coordination, which is strictly worse than before. Deployment
frequency is a good secondary metric and a poor primary one, because it can rise while
cross-team waiting stays constant.

**★ Why does a pending reorganisation argue against splitting?**
Because once services are team-aligned, reorganising becomes an architectural event. Teams
merge, split or dissolve, and their services do not follow automatically — you get orphaned
services with nobody watching their alerts, services inherited by teams that do not know the
domain, and a service graph that no longer matches the communication graph, which produces
exactly the friction Conway's law predicts. The same reorganisation in a monolith
redistributes package ownership at zero cost. If the organisation's shape is still moving,
delay the split until it settles, and use module boundaries in the meantime so the seams are
ready when it does.

{/* FOOTER */}
