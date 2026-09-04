---
title: "One team can own several services but a service must not be owned by several teams, which turns the split decision into an arithmetic problem — and for a two-team shop the arithmetic almost always says no"
sidebar_label: "02c · Teams and the two-team shop"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Team Topologies, *Key Concepts*
> ([teamtopologies.com](https://teamtopologies.com/key-concepts)); Chris Richardson,
> *Pattern: Monolithic Architecture*
> ([microservices.io](https://microservices.io/patterns/monolithic.html)); Martin Fowler,
> *Conway's Law* ([martinfowler.com](https://martinfowler.com/bliki/ConwaysLaw.html)) and
> *Microservice Premium*
> ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePremium.html)); Melvin E.
> Conway, *How Do Committees Invent?* (1968)
> ([melconway.com](https://www.melconway.com/Home/Committees_Paper.html)).
> Version spine: JDK 25 · Spring Boot 4.1.1 · Spring Modulith 2.1.1. **No sandbox.**

**Conway's law tells you the shape of the system follows the shape of the organisation.
Team Topologies tells you what shape the organisation should be for fast delivery, and the
single constraint that matters most for the split decision falls straight out of it: a
service owned by two teams is not a service, it is a shared file with a network protocol in
front of it. Once you accept that constraint the whole decision becomes countable.**

## The ownership constraint

Richardson states the ownership rule as part of the microservice pattern itself:

> *"A service is owned by the team (or teams) that owns the (non-library) subdomains."*

And the pattern's context assumes the Team Topologies organisation up front:

> *"Consequently, your engineering organization is organized into small, loosely coupled,
> cross-functional teams as described by Team Topologies. Each team delivers software using
> DevOps practices as defined by the DevOps handbook. In particular, it practices continuous
> deployment."*

That is a *precondition* stated in the pattern's context section, not an aspiration. If
your organisation is not that, you are applying the pattern outside its stated context.

Team Topologies' four team types are worth knowing by name because they map cleanly onto
what a split actually demands:

> *"Stream-aligned team: aligned to a flow of work from (usually) a segment of the business
> domain"*
>
> *"Enabling team: helps a Stream-aligned team to overcome obstacles. Also detects missing
> capabilities."*
>
> *"Complicated Subsystem team: where significant mathematics/calculation/technical
> expertise is needed."*
>
> *"Platform team: a grouping of other team types that provide a compelling internal
> product to accelerate delivery by Stream-aligned teams"*

Services are owned by **stream-aligned** teams. The Team Topologies material describes them
as *"'You Built It, You Run It' teams"* with *"no hand-offs to other teams for any
purpose"* — which is the same three verbs as Richardson's team-autonomy force: develop,
test, deploy. If a hand-off is required to ship, the autonomy benefit is not being
delivered.

And the fourth type is a cost line most split proposals omit entirely: once you have more
than a handful of services, someone has to own the pipeline templates, the base images, the
deploy tooling, the service scaffolding and the observability stack. That is a **platform
team**, and it is headcount that produces no customer-facing features. See
**19 · The organisational costs** *(not written yet)*.

## Cognitive load is the constraint that sets team size and service count

Team Topologies' principle, verbatim:

> *"Respect Cognitive Limits — Teams can only handle so much complexity before breaking
> down. Each new tool, responsibility or domain your team is given taxes their mental
> bandwidth. Competent teams become ineffective when leaders keep adding to their plate
> without taking anything away."*

This cuts **both** ways in the split decision, which is what makes it interesting:

- A monolith that has grown past what one team can hold in its head is a cognitive-load
  failure, and splitting genuinely helps.
- Giving one team six services — six pipelines, six sets of dashboards, six on-call
  runbooks, six dependency-upgrade streams, and the interactions between them — is *also* a
  cognitive-load failure, and splitting caused it.

The second failure is much less discussed and just as common. The relevant question is
never "is the monolith too big?" but "which arrangement puts less in each team's head", and
the distributed arrangement is not automatically the smaller one, because the *interactions*
count too.

## The arithmetic

Take a system with `S` services and `T` teams.

**Case `S < T`.** Multiple teams own one service. Every release is a negotiation; the
service is a shared file. This is the monolith's problem, and it is the one case where
splitting reliably helps.

**Case `S = T`.** The design target. Each stream-aligned team owns one service end to end.
Conway's homomorphism is an identity map: the architecture graph and the team graph are the
same graph, and the system does what the diagram says.

**Case `S > T`.** One team owns several services. Conway's collapse rule applies:

> *"In the case where some group designed more than one subsystem we find that the structure
> of the design organization is a collapsed version of the structure of the system, with the
> subsystems having the same design group collapsing into one node representing that group."*

The boundaries *inside* one team's set of services are architecturally invisible — the same
people write both sides, so they will share code, share assumptions, deploy together and
eventually share data. What you have bought for those boundaries is: serialisation,
network failure modes, and two pipelines. What you have bought in exchange is nothing,
because the coordination those boundaries would have reduced was never happening.

**This is why `S > T` is the diagnostic for a distributed monolith in the making.** It is
countable, it is objective, and you can evaluate it before writing any code.
**12 · The distributed monolith** *(not written yet)* owns the symptoms; this is the
predictor.

## The two-team shop, worked through

Two teams, eight engineers, an order system with modules for customers, catalogue,
inventory, ordering, payment, shipping and reporting. Somebody proposes seven services.

- `S = 7`, `T = 2`. Conway's collapse says the effective architecture is two components.
  Five of the seven boundaries are decoration.
- Team-autonomy force: partially satisfied, at exactly one boundary — the one between the
  two teams. The other six boundaries deliver zero autonomy.
- Cognitive load: each team now holds three or four services, seven pipelines between them,
  seven deployment configurations, and — the killer — the interaction semantics of every
  pair of services that talk. That is more in each head, not less.
- Platform work: seven services need pipeline templates, base images, a service template,
  correlation across hops, contract tests. With eight engineers, that is roughly one
  engineer's full time, which is 12.5% of your capacity, permanently, producing no features.
- Dark-matter cost: checkout now spans ordering, inventory and payment. The atomic
  `@Transactional` becomes a saga with compensations. See
  [10 · The transaction you lose](04-the-transaction-you-lose.md).

The honest recommendation for that shop is **one deployable, seven verified modules, two
owners**. Assign each module an owner team in `package-info.java`, declare allowed
dependencies, and let a build failure — not a code review — be what stops the catalogue
team reaching into inventory's internals. That is
[31 · Explicit allowed dependencies](11e-explicit-allowed-dependencies.md) and
[35 · Verifying the arrangement](12-verifying-the-arrangement.md), and it costs one test
class.

Fowler's own threshold agrees: *"A dozen or two people can have deep and informal
communications, so Conways Law indicates they will create a monolith. That's fine."*

## The interaction modes tell you which boundaries are ready

Team Topologies limits inter-team interaction to three modes:

> *"Collaboration: working together for a defined period of time to discover new things
> (APIs, practices, technologies, etc.)"*
>
> *"X-as-a-Service: one team provides and one team consumes something 'as a Service'"*
>
> *"Facilitation: one team helps and mentors another team"*

The useful mapping: **a boundary is ready to become a service when the two teams' relationship
has settled into X-as-a-Service.** While the relationship is still Collaboration — the API
is being discovered, the semantics argued about, the fields renamed weekly — a network
boundary is exactly the wrong thing to put there, because every discovery now costs a
coordinated deploy. Collaboration mode is what an in-process module boundary is *for*.

That gives you a readiness test with no architecture in it: *have these two teams needed to
change the interface between them in the last quarter?* If yes, keep it in-process.

The related principle is blunt about the goal:

> *"Eliminate Team Dependencies — Nothing kills productivity faster than one team waiting
> on another team. Most companies obsess over making individual teams more efficient while
> ignoring the massive delays that happen between teams."*

Note what it targets: **the waiting**, not the deployment topology. If the waiting is for a
code review or a schema change, splitting the service does not remove it.

## Gotchas

**★ `S > T` is the single most reliable predictor of a distributed monolith, and you can
check it before writing any code.** More services than teams means Conway's collapse rule
applies, the intra-team boundaries are architecturally invisible, and they will erode into
shared libraries, shared assumptions and eventually shared data. Count the boxes, count the
teams, and if the first number is bigger, ask what each surplus boundary buys.

**★ Splitting can increase cognitive load rather than reduce it, and nobody measures it.**
Six services in one team's head is six pipelines, six alert sets, six dependency streams
plus the pairwise interaction semantics. The monolith was one of each. "Smaller components"
only reduces load if the component count per team does not go up proportionally.

**★ "One team owns several services" is fine; "several teams own one service" is not.**
The asymmetry matters and people get it backwards. A team owning three closely-related
services is a normal, workable arrangement — the boundaries just buy less than advertised.
A service with two owning teams has no owner: every change is a negotiation, nobody is
accountable for its latency budget, and it will be the service nobody upgrades.

**★ The platform team is a real headcount line and it is missing from every split
proposal.** Pipeline templates, base images, service scaffolding, correlation
infrastructure, contract-test tooling, a shared observability stack. Team Topologies names
platform teams as one of only four fundamental types for a reason. In a small org this cost
is paid by taking a stream-aligned engineer out of feature work, permanently.

**★ A boundary under active negotiation is the worst possible place for a network hop.**
If the two teams either side are still in Collaboration mode — discovering the API,
renaming fields, arguing about semantics — every discovery becomes a coordinated,
version-managed, deploy-ordered change. Wait until the relationship is X-as-a-Service.
An in-process module boundary is what you use during Collaboration.

**★ "Cross-functional" and "long-lived" are the two attributes that get quietly dropped,
and each one alone invalidates the design.** A team that cannot deploy or cannot change its
own schema is not autonomous no matter what it owns. A team re-formed every quarter around
projects never develops the stable communication structure a boundary needs, so the
boundaries re-randomise with the staffing.

## Interview questions

**★ How many services should a team own?**
Ideally one, and the reason is Conway's collapse rule rather than dogma: boundaries inside
a single team's ownership are architecturally invisible, because the same people write both
sides and can simply talk, so those boundaries erode into shared code and shared
assumptions while still charging you serialisation, network failure modes and an extra
pipeline. Owning two or three closely related services is workable in practice, but you
should be able to say what each of those boundaries buys. The absolute constraint runs the
other way: a service must have exactly one owning team, because a service with two owners
has none.

**★ Two teams, eight engineers, a proposal for seven services. What is your answer?**
No, and here is the counter-proposal. Seven services with two teams means five of the seven
boundaries deliver no team autonomy at all while charging full price. Cognitive load goes
up, not down: seven pipelines, seven alert sets and the pairwise interaction semantics land
in the same two teams' heads. You need platform capabilities — pipeline templates,
correlation, contract tests — which with eight engineers costs roughly one engineer
permanently. And checkout becomes a distributed operation, converting one `@Transactional`
method into a saga with compensations and a product decision about partial failure. The
counter-proposal is one deployable with seven verified modules, an owner team recorded per
module, explicitly declared allowed dependencies, and a CI test that fails when someone
crosses a boundary — and a written trigger for when to extract.

**★ How do you know when a module is ready to become a service?**
When the interaction between the owning teams has settled from Collaboration into
X-as-a-Service — the interface has stopped changing, the semantics are agreed, and the
consuming team can use it without asking questions. A concrete test: has the interface
between these two teams changed in the last quarter? If it has, a network boundary there
converts every future change into a coordinated, version-managed deploy. Add two more
conditions: the module's inbound dependencies are already only events or a narrow API, and
there is a team that will own it end to end afterwards.

**★ What does Team Topologies contribute that Conway's law does not?**
Conway's law is descriptive — it tells you the system will mirror the communication
structure, but not what structure to have. Team Topologies is prescriptive: four team types
(stream-aligned, enabling, complicated-subsystem, platform), three interaction modes
(collaboration, X-as-a-Service, facilitation), and cognitive load as the explicit constraint
that bounds how much any one team can own. For the split decision the two most useful
contributions are the cognitive-load constraint, which shows that splitting can make things
worse as well as better, and the platform team, which names the headcount cost that split
proposals routinely omit.

{/* FOOTER */}
