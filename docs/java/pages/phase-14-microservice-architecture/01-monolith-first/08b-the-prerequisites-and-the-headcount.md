---
title: "Fowler's three microservice prerequisites read like a checklist and are actually a job description, and the honest version of a split proposal states how many people it needs — which is why so few proposals state it"
sidebar_label: "08b · Prerequisites and headcount"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Martin Fowler, *Microservice Prerequisites*
> ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePrerequisites.html));
> Team Topologies, *Key Concepts*
> ([teamtopologies.com](https://teamtopologies.com/key-concepts)); Chris Richardson,
> *Pattern: Monolithic Architecture*
> ([microservices.io](https://microservices.io/patterns/monolithic.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Modulith 2.1.1. **No sandbox** — no
> headcount figure here is measured; the argument is about which roles must exist, not how
> many FTE they cost at your company.

**Fowler's prerequisites list is short enough to feel like a checklist and is in fact a list
of standing capabilities that require people. The most useful thing you can do with it in a
design review is to read each item aloud and ask "who does that, and what will they stop
doing?" The proposals that survive that question are the ones worth approving.**

## The three, in full

> *"Rapid provisioning: you should be able to fire up a new server in a matter of hours.
> Naturally this fits in with CloudComputing, but it's also something that can be done
> without a full cloud service. To be able to do such rapid provisioning, you'll need a lot
> of automation - it may not have to be fully automated to start with, but to do serious
> microservices later it will need to get that way."*

> *"Basic Monitoring: with many loosely-coupled services collaborating in production, things
> are bound to go wrong in ways that are difficult to detect in test environments. As a
> result it's essential that a monitoring regime is in place to detect serious problems
> quickly. The baseline here is detecting technical issues (counting errors, service
> availability, etc) but it's also worth monitoring business issues (such as detecting a drop
> in orders). If a sudden problem appears then you need to ensure you can quickly rollback,
> hence…"*

> *"Rapid application deployment: with many services to manage, you need to be able to
> quickly deploy them, both to test environments and to production. Usually this will involve
> a DeploymentPipeline that can execute in no more than a couple of hours. Some manual
> intervention is alright in the early stages, but you'll be looking to fully automate it
> soon."*

Plus the organisational one, which is the expensive one:

> *"These capabilities imply an important organizational shift - close collaboration between
> developers and operations: the DevOpsCulture. This collaboration is needed to ensure that
> provisioning and deployment can be done rapidly, it's also important to ensure you can react
> quickly when your monitoring indicates a problem. In particular any incident management
> needs to involve the development team and operations, both in fixing the immediate problem
> and the root-cause analysis to ensure the underlying problems are fixed."*

## The staged version, which is the part people skip

Fowler is explicit that the three above get you to *"a first system using a handful of
microservices"* — and that going further needs more:

> *"With this kind of setup in place, you're ready for a first system using a handful of
> microservices. Deploy this system and use it in production, expect to learn a lot about
> keeping it healthy and ensuring the devops collaboration is working well. Give yourself time
> to do this, learn from it, and grow more capability before you ramp up your number of
> services."*

> *"Going beyond a handful of services requires more. You'll need to trace business
> transactions through multiple services and automate your provisioning and deployment by
> fully embracing ContinuousDelivery. There's also the shift to product centered teams that
> needs to be started. You'll need to organize your development environment so developers can
> easily swap between multiple repositories, libraries, and languages."*

Four additional capabilities for the second stage: **distributed tracing**, **full
continuous delivery**, **product-centred teams** (an organisational change), and **a
development environment that handles many repositories**. This is the staged plan that
"let's split the monolith into twelve services" skips entirely, and it maps directly onto
Fowler's four preferred execution strategies — see
[09 · Four ways to execute it](03c-four-ways-to-execute-monolith-first.md), where the
duolith exists precisely to make this staging possible.

## Turning the list into headcount questions

For each capability, the review question is not "do we have it?" but "who owns it, and what
will they stop doing?"

| Capability | Standing work it implies | The question to ask |
|---|---|---|
| Rapid provisioning | Infrastructure as code, image pipeline, environment templates | Who maintains the templates when the base image has a CVE? |
| Basic monitoring | Metric conventions, alert standards, dashboards, business alerts | Who tunes an alert that has been noisy for two weeks? |
| Rapid deployment | Pipeline templates, artefact registry, rollback rehearsal | Who fixes the pipeline when a plugin breaks it for all twelve services? |
| DevOps collaboration | Pager rotation, incident process, blameless postmortems | Who is on the rotation, and did they agree to it? |
| Distributed tracing | Propagation across HTTP and messaging, sampling policy, backend | Who owns the trace backend's cost and retention? |
| Continuous delivery | Trunk-based development, feature flags, automated release | Who removes stale flags? |
| Multi-repo dev environment | Tooling to check out, build and run N repositories | Who owns the local-development story as a product? |

In Team Topologies terms, this table describes a **platform team**:

> *"Platform team: a grouping of other team types that provide a compelling internal product
> to accelerate delivery by Stream-aligned teams"*

With the warning that platforms bloat:

> *"Thinnest Viable Platform (TVP) — Most internal platforms become bloated monstrosities
> that slow teams down rather than accelerate progress. The TVP approach creates platforms
> that provide just enough capability without unnecessary complexity. A good platform should
> make stream-aligned teams move faster, not generate more dependencies to manage."*

The point for the split decision is not how many people a platform team needs — that depends
entirely on your context and anyone quoting a number is guessing. The point is that **it is a
team type, not a rota**, and that its capacity comes out of feature delivery.

## The zero-waste property, which is the best argument in the whole topic

Fowler's closing observation about the prerequisites:

> *"Indeed these are capabilities that you really ought to have for monolithic systems too.
> While they aren't universally present across software organizations, there are very few
> places where they shouldn't be a high priority."*

Every one of these capabilities is valuable **while you are still a monolith**:

- Rapid provisioning makes your monolith's disaster recovery real rather than theoretical.
- Monitoring, including business-outcome monitoring, catches monolith bugs too.
- A fast deployment pipeline is the single biggest lever on a monolith's delivery speed —
  and Richardson lists exactly the mitigations that apply: *"apply physical design principles
  to the modular monolith in order to reduce build time coupling"*, *"implementing an
  automated merge queue"*, *"using a build tool that supports incremental building and
  testing"*, *"parallelizing and clustering the build and test steps"*.
- DevOps collaboration improves incident response regardless of topology.

This is what makes "build the prerequisites first" an unconditionally good recommendation
rather than a delaying tactic. Every increment pays off immediately, and none of it is wasted
whichever way the split decision eventually goes. It is also a genuine readiness test: an
organisation that will not invest in these for the monolith it already runs will not
suddenly acquire the discipline because there are twelve deployables.

## Gotchas

**★ The prerequisites are a description of standing capabilities, not a one-off project.**
"We built a pipeline" is not the same as "somebody keeps twelve pipelines working through
base-image upgrades, plugin breakage and credential rotation". Read each item as a recurring
commitment and name its owner.

**★ Fowler's list gets you to a *handful* of services, not to twelve.** He says so
explicitly, and prescribes running that handful in production and learning before ramping
up. A proposal that goes from one deployable to twelve in a quarter has skipped the stage
where you find out whether the capabilities actually work.

**★ The second-stage capabilities are the expensive ones and they are always omitted.**
Distributed tracing across HTTP *and* messaging, full continuous delivery, product-centred
teams, and a development environment that handles many repositories. Three of those four are
substantial engineering programmes and one is an organisational change.

**★ "We'll build it as we go" means operating a distributed system blind for the interval.**
The prerequisites exist because distributed failures are the ones test environments do not
reproduce. Building the monitoring after the first incident means the first incident is
diagnosed without it, which is the single most expensive state a system can be in.

**★ A platform team's capacity comes out of feature delivery, permanently.** In a large org
that is a budget line. In a small org it is one of your best engineers, not shipping
features, forever. Neither is wrong; both should be stated in the proposal rather than
discovered afterwards.

**★ Platforms bloat, and a bloated platform reintroduces the coordination you split to
escape.** Team Topologies' Thinnest Viable Platform exists because internal platforms tend
to grow until stream-aligned teams must file tickets against them — at which point you have
recreated the shared bottleneck with an extra layer of indirection. Judge the platform by
whether teams move faster, not by how much it does.

**★ Every prerequisite is worth building for the monolith, which makes "prerequisites first"
risk-free.** This is the strongest argument available for the modular-monolith path: the
investment is not deferred, it is sequenced so each increment pays off immediately and none
of it is wasted whichever way the decision goes.

**★ An organisation that will not fund these for its monolith will not fund them for
services.** Use it as a readiness test rather than an argument. If nobody will pay for
monitoring the one thing you have, the answer to "are we ready for twelve?" has already been
given.

## Interview questions

**★ What are the microservice prerequisites and why does Fowler insist they come first?**
Rapid provisioning — a new server in hours, which implies substantial automation. Basic
monitoring — detecting technical failures and business anomalies quickly, plus the ability to
roll back fast when they appear. Rapid application deployment — a pipeline that runs in no
more than a couple of hours to both test and production. And the organisational shift that
makes those work: close developer/operations collaboration including joint incident
management and root-cause analysis. They come first because distributed failures are
precisely the ones that test environments do not reproduce, so a team without them is not
running a microservice architecture badly, it is running one blind.

**★ What does Fowler say you need *beyond* the initial three?**
The first three get you to a handful of services, after which he prescribes running that
handful in production and learning from it before increasing the count. Going further needs
tracing business transactions through multiple services, fully embracing continuous
delivery, shifting to product-centred teams, and organising the development environment so
developers can move easily between multiple repositories, libraries and languages. Three of
those are substantial engineering programmes and one is an organisational change, and it is
this second list — not the first — that most proposals omit entirely.

**★ Why is "build the prerequisites first" not just a delaying tactic?**
Because every one of them is valuable while you are still a monolith, which Fowler says
directly: these are capabilities you ought to have for monolithic systems too. Rapid
provisioning makes disaster recovery real. Monitoring, including business-outcome alerting,
catches monolith bugs. A fast pipeline is the largest single lever on a monolith's delivery
speed, and the cheap accelerators — merge queues, incremental build tools, parallelised test
execution, reducing build-time coupling between modules — are exactly the ones a modular
monolith benefits from. So the sequence has no wasted work in either outcome, and it doubles
as a readiness test.

**★ Where does the platform work come from in a small organisation?**
Out of feature delivery, from one of your better engineers, permanently. Team Topologies
names platform as one of four fundamental team types precisely because this work is real and
ongoing rather than a project that finishes. The honest form of a split proposal states who
that person is and what they will stop doing. The counterweight to watch for is platform
bloat: if stream-aligned teams end up filing tickets against the platform to get anything
done, you have recreated the shared bottleneck you split to escape, which is why the
Thinnest Viable Platform framing judges a platform by whether teams move faster rather than
by how much it provides.

{/* FOOTER */}
