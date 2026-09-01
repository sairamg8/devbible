---
title: "Monolith-first is not one strategy but four, they have wildly different costs and success rates, and Fowler is openly more confident in the ones that involve throwing the monolith away than in the one everybody assumes he means"
sidebar_label: "03c · Four ways to execute it"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Martin Fowler, *Monolith First*
> ([martinfowler.com](https://martinfowler.com/bliki/MonolithFirst.html)); Stefan Tilkov,
> *Don't start with a monolith*
> ([martinfowler.com](https://martinfowler.com/articles/dont-start-monolith.html)); Chris
> Richardson, *Pattern: Monolithic Architecture*
> ([microservices.io](https://microservices.io/patterns/monolithic.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Modulith 2.1.1. **No sandbox.**

**"Monolith first" is a family of four distinct strategies with different prerequisites,
different costs and different track records. Fowler describes all four; most teams assume
he means the first, which is the one he is least confident about. Knowing which one you
have actually chosen — and saying so out loud — is what stops the strategy from decaying
into "we'll deal with it later".**

## Strategy 1 — the carefully modular monolith

> *"The logical way is to design a monolith carefully, paying attention to modularity within
> the software, both at the API boundaries and how the data is stored. Do this well, and it's
> a relatively simple matter to make the shift to microservices. However I'd feel much more
> comfortable with this approach if I'd heard a decent number of stories where it worked out
> that way."*

**Note the two clauses in "both at the API boundaries and how the data is stored."** Most
teams that attempt this do the first and not the second, and the second is the one that
makes extraction possible. A module with a clean Java API and a schema that other modules
join against is not extractable; it is a package rename away from where it started.

**Prerequisites:** enforced module boundaries (not intended ones), data ownership per
module, integration by events rather than direct calls where the call would not survive a
network.

**Fowler's confidence: openly low, in 2015.** He had not heard enough stories of it working.
The honest 2026 update is that the mechanism has changed — module boundaries are now
verifiable by a test, which they were not when he wrote that — but the *data* half is still
convention rather than tooling. Spring Modulith's application-module-aware Flyway support
([52](15c-module-aware-flyway.md)) is the closest anything comes, and it organises
migrations, not access.

This is the strategy the whole second half of this topic equips you to execute. Do not
choose it and then skip the enforcement; that is choosing strategy 5, "hope".

## Strategy 2 — peel services off the edges

> *"A more common approach is to start with a monolith and gradually peel off microservices
> at the edges. Such an approach can leave a substantial monolith at the heart of the
> microservices architecture, but with most new development occurring in the microservices
> while the monolith is relatively quiescent."*

Two things people get wrong about this one.

**"At the edges" is a technical criterion, not a metaphor.** An edge module is one with few
*inbound* dependencies — nothing else in the system needs to call into it synchronously.
Notifications, document generation, search indexing, recommendation, export, audit. These
extract cleanly because everything they need arrives as an event and nothing waits for
their answer. The core — ordering, inventory, pricing — is where every dependency converges
and is the last thing you extract, if ever. [54 · Choosing what to extract
first](16-choosing-what-to-extract-first.md) turns this into a scoring exercise.

**"The monolith is relatively quiescent" is the success condition, not a side effect.** If
the core monolith is still changing constantly, you have a distributed system *and* a big
shared codebase — every cost, both architectures. The strategy works when new development
moves outward and the core stops moving.

**Prerequisites:** the same as strategy 1 for the modules you intend to peel, plus the
platform capabilities for the first extracted service. Notably, you can start this without
a full modular monolith — you only need *the module you are extracting* to be clean.

## Strategy 3 — sacrificial architecture

> *"Another common approach is to just replace the monolith entirely. Few people look at
> this as an approach to be proud of, yet there are advantages to building a monolith as a
> SacrificialArchitecture. Don't be afraid of building a monolith that you will discard,
> particularly if a monolith can get you to market quickly."*

This is the strategy nobody puts in a slide deck and several successful companies actually
used. It changes the economics of the first version completely: if the monolith is
*explicitly* disposable, you stop paying for modularity you will throw away, you optimise
purely for learning speed, and the code's job is to teach you the domain rather than to
survive.

**The trap is that it requires being said out loud, in advance, and believed.** A monolith
declared sacrificial and then not sacrificed is the worst of every world: no modularity
because you were not going to keep it, and you kept it. If nobody with budget authority has
agreed to fund the replacement, you have not chosen this strategy.

It also pairs unusually well with Tilkov's position: his ideal scenario is *"one where
you're building a second version of an existing system"*. Sacrificial architecture is the
deliberate manufacture of that scenario.

**Prerequisites:** an explicit, funded, dated intent to replace; and a domain where
time-to-market genuinely dominates.

## Strategy 4 — the duolith (coarse-grained first)

> *"Another route I've run into is to start with just a couple of coarse-grained services,
> larger than those you expect to end up with. Use these coarse-grained services to get used
> to working with multiple services, while enjoying the fact that such coarse granularity
> reduces the amount of inter-service refactoring you have to do. Then as boundaries
> stabilize, break down into finer-grained services."*

With Fowler's own footnote:

> *"I suppose that strictly you should call this a 'duolith', but I think the approach
> follows the essence of monolith-first strategy: start with coarse-granularity to gain
> knowledge and split later."*

This is the strategy that answers the strongest objection to strategy 1 — that a team with
no distributed-systems experience will not have built the prerequisites by the time they
need them. Two or three coarse services force you to build correlation, contract testing,
independent pipelines and a local-development story *while the number of interactions is
still small enough to survive getting them wrong*. It is the honest middle of the debate,
and it is very close to what Tilkov actually advocates — he says explicitly that what he
proposes is *"more likely bigger than your typical microservice"*.

**Prerequisites:** two or three boundaries you are confident about (typically the ones that
already correspond to team boundaries), and the willingness to keep them coarse when
someone proposes splitting further.

## Choosing between them

| | Modular monolith | Peel the edges | Sacrificial | Duolith |
|---|---|---|---|---|
| Deployables in year one | 1 | 1, then 2–3 | 1 | 2–3 |
| Needs platform capability early | No | For the first extraction | No | Yes |
| Needs enforced module boundaries | **Yes, absolutely** | For the module being peeled | No | Within each service |
| Cost of a wrong boundary | IDE refactor | IDE refactor inside, deploy dance outside | Zero — it is going away | Moderate |
| Fails when | Nobody enforces modularity | The core never goes quiescent | Nobody funds the replacement | Someone splits further too early |
| Best when | 1–2 teams, uncertain domain | Monolith exists, some modules are clearly peripheral | Time-to-market dominates, replacement is funded | 2–3 teams, some boundaries certain |

## Two anti-strategies that pretend to be on this list

**"Monolith first, then we'll see."** No enforcement, no trigger condition, no owner. This
is strategy 1 with its prerequisite removed, and it produces exactly the outcome Tilkov
predicts. If you cannot name the CI job that fails when a boundary is crossed, you are
here.

**"Microservices, but we'll share a database at first."** This is not on Fowler's list and
it is the fastest route to a distributed monolith: you have taken on every cost of
distribution — network hops, deploy coordination, partial failure — while keeping the
coupling mechanism that makes independent deployment impossible. **03 · Database-per-service**
*(not written yet)* and **12 · The distributed monolith** *(not written yet)* own this.
If you want one database, keep one process.

## Gotchas

**★ Most teams say strategy 1 and execute "hope".** The difference is a single artefact: a
test in CI that fails when a module boundary is crossed. If the codebase does not contain
`ApplicationModules.of(Application.class).verify()` or an equivalent ArchUnit rule, the
strategy in operation is not strategy 1 regardless of what the design document says. See
[35 · Verifying the arrangement](12-verifying-the-arrangement.md).

**★ "Pay attention to modularity at the API boundaries *and how the data is stored*" — the
second half is where extraction actually dies.** Clean Java APIs plus a shared schema with
cross-module foreign keys and cross-module joins gives you a module you cannot extract
without a data migration nobody scoped. Tooling verifies types, not tables.

**★ Peeling the edges fails silently when the core never goes quiescent.** The success
condition is that new development moves into the extracted services and the monolith stops
changing. If the core is still absorbing most commits two years in, you are paying for both
architectures. Track commits-to-the-core as the actual health metric of this strategy.

**★ A sacrificial architecture that nobody has funded the replacement for is just a
monolith with the modularity deliberately removed.** The strategy's benefit — skipping
investment in structure — is only rational if the discard is real. Get the funding
commitment before you take the shortcut, not after.

**★ The duolith's failure mode is enthusiasm.** Its whole value is that coarse granularity
keeps inter-service refactoring cheap while you learn. The moment someone splits one of the
two into four because "these are really separate concerns", you have skipped to the
architecture you were trying to earn. Make "stay coarse until the boundary has not changed
in two quarters" an explicit rule.

**★ Strategies 2 and 4 look similar and have opposite prerequisites.** Peeling requires an
existing monolith and gives you time to build platform capability incrementally, one
service at a time. The duolith requires the platform capability up front, because you have
two services on day one. Choosing the duolith without a deployment pipeline, correlation and
contract tests already in place is choosing "microservices with extra steps".

## Interview questions

**★ Name the four ways to execute a monolith-first strategy.**
Design a carefully modular monolith and later shift it to services — Fowler's "logical way",
about which he expresses explicit unease. Start with a monolith and gradually peel services
off at the edges, leaving a substantial but quiescent core. Build the monolith as a
sacrificial architecture, explicitly intending to discard it once it has taught you the
domain and got you to market. Or start with two or three coarse-grained services — larger
than your eventual targets — to learn the operational rhythm cheaply, then subdivide as
boundaries stabilise. They differ in how many deployables exist in year one, when the
platform investment is required, and what happens when a boundary turns out to be wrong.

**★ Which strategy is Fowler least confident in, and why does that matter?**
The carefully modular monolith — the one everyone assumes he is recommending. He says he
would feel much more comfortable with it if he had heard a decent number of stories where
it worked out that way, and his footnote adds that most systems acquire too many
inter-module dependencies to be sensibly broken apart. It matters because teams cite
"monolith first" as authority for exactly the approach its author flagged as unproven. The
honest position is that the approach depends on a prerequisite — enforced modularity — that
was aspirational in 2015 and is tooling in 2026, which strengthens it but does not close
the data-ownership half of the gap.

**★ You have an eight-year-old monolith and two new teams. Which strategy?**
Peel the edges, and pick the first target by inbound dependency count rather than by
whichever module is most annoying. Something like notification, document generation or
search indexing: everything it needs arrives as an event, nothing blocks on its response,
and it owns no data anyone else reads. Extracting it forces you to build the pipeline, the
correlation, the contract test and the local-development story once, at low risk. Then
measure whether commits to the core actually decline — if they do not, the strategy is not
working and adding a second extraction will not fix it.

**★ What makes "monolith first, then we'll see" different from strategy 1?**
An enforcement mechanism and a trigger. Strategy 1 requires that boundary violations fail
the build, that each module owns its data, and that there is a written condition under
which extraction begins — team count, pipeline duration, a non-functional requirement one
subdomain cannot meet. "Then we'll see" has none of those, so module boundaries erode under
ordinary delivery pressure and no one ever declares the moment to split. It has the costs
of the monolith and none of the option value that was the entire point.

**★ Why is "microservices with a shared database" not one of these strategies?**
Because it takes on every cost of distribution — network hops, partial failure, deploy
coordination, distributed debugging — while retaining the coupling mechanism that makes
independent deployment impossible. Two services sharing a schema cannot change that schema
independently, so every schema change is a coordinated release, which is the defining
symptom of a distributed monolith. It is not a staging post on the way to microservices;
it is a stable, expensive local minimum. If you want one database, keep one process.

{/* FOOTER */}
