---
title: "Independent deployability is the whole point of splitting and it is not a property you get by splitting — it is a property you have to keep earning on every change, and the day you stop earning it you own a distributed monolith"
sidebar_label: "06 · Deploy coordination"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Chris Richardson, *Pattern: Microservice Architecture* and
> *Pattern: Monolithic Architecture*
> ([microservices.io](https://microservices.io/patterns/microservices.html)); Martin Fowler,
> *Microservice Prerequisites*
> ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePrerequisites.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Modulith 2.1.1. **No sandbox.**

**A monolith has exactly one deploy artefact, so "which order do we release these in?" is
not a question anybody can ask. Splitting creates the question, and it has to be answered
correctly for every change that touches more than one service — forever, by whoever happens
to be shipping that day. Nothing about splitting makes the answer automatic. The teams that
end up with lockstep releases did not do anything unusual; they simply stopped paying the
tax that keeps deployments independent.**

## The tax, stated precisely

Richardson names the two coupling forces that this is about:

> *"Minimize design time coupling — reduce the likelihood of changing services in lockstep,
> which reduces productivity"*

> *"Risk of tight design-time coupling between services, which requires time consuming
> lockstep changes"*

Design-time coupling is what makes two services need to change together. It is not created
by the network; it is created by a **shared assumption**: a field's meaning, an enum's
member set, an implicit ordering, a shared library version, a database column. Splitting
does not remove shared assumptions. It removes the compiler's ability to tell you about
them.

In a monolith, a shared assumption that breaks is a **compile error** on the branch that
broke it. Across services it is a **runtime failure in production**, discovered by a
customer, at whatever moment the two versions happen to coexist.

## The deploy-order deadlock

The canonical shape, using the running commerce example. The ordering service is going to
start sending a new required field, `fulfilmentChannel`, and the shipping service must
read it.

- Deploy **shipping first**: shipping requires `fulfilmentChannel`, ordering is not sending
  it yet → every request fails.
- Deploy **ordering first**: ordering sends a field shipping does not know → depending on
  the deserialiser's configuration, either it is ignored (fine) or the request is rejected
  as unknown-property (broken).
- Deploy **simultaneously**: not a thing. There is always a window, and during a rolling
  update both versions of both services are live at once.

The escape is not a clever ordering; it is **making the change additively, in two
releases**:

1. **Release 1 — shipping becomes tolerant.** Accept `fulfilmentChannel` if present, fall
   back to the existing default when absent. Deploy. Nothing else changes.
2. **Release 2 — ordering starts sending it.** Deploy. Both versions of shipping work.
3. **Release 3, later — remove the fallback**, once no producer omits the field. This
   release is usually forgotten, and the fallback becomes permanent.

That is the expand/contract pattern, and **05 · Inter-service REST** *(not written yet)*
owns it in full — tolerant reader, additive-only evolution, and the deploy-order deadlock.
What belongs here is the *cost*: **one logical change became three releases across two
teams, with a coordination point between each.** Multiply by every cross-service change.

## The four things that quietly recouple your deploys

**1. A shared library with domain types in it.** The most common one by far. Somebody
factors `OrderDto` into `commerce-common`, both services depend on it, and now a change to
the DTO requires a library release plus two service releases in order. You have rebuilt the
monolith's compile-time coupling with worse ergonomics — and you cannot even see it,
because the dependency is in a POM rather than an import.

**2. A shared database or schema.** A column rename is now a coordinated release of every
service that reads the table. This is the shared-database anti-pattern and it is fatal to
independent deployment. **03 · Database-per-service** *(not written yet)* owns it.

**3. Synchronous chains for write operations.** If placing an order requires ordering →
inventory → pricing → catalogue, all synchronous, then a semantic change anywhere in that
chain propagates to everything upstream. **04 · Sync vs async** *(not written yet)* owns
the coupling analysis.

**4. An integration environment as the release gate.** If "ready to ship" means "the whole
system passed integration tests in staging", then releases are serialised by the staging
environment and independent deployment has been formally abolished by your process. The
replacement is consumer-driven contract testing — **11 · Contract testing** *(not written
yet)*.

Each of these is individually reasonable, cheap and locally sensible. That is why they all
happen.

## The capability you must have first

Fowler lists deployment as a prerequisite, and the phrase to notice is *"many services"*:

> *"Rapid application deployment: with many services to manage, you need to be able to
> quickly deploy them, both to test environments and to production. Usually this will
> involve a DeploymentPipeline that can execute in no more than a couple of hours. Some
> manual intervention is alright in the early stages, but you'll be looking to fully automate
> it soon."*

And the monitoring prerequisite closes the loop, because the reason you need it is
rollback:

> *"If a sudden problem appears then you need to ensure you can quickly rollback, hence…"*

Rollback is where the deploy-order problem reappears in its nastiest form. Rolling back
ordering to a version that does not send `fulfilmentChannel` is safe only because shipping
kept its fallback. **A rollback plan for a multi-service change is a plan for un-deploying
in the reverse order, and it only works if every intermediate combination was valid.** That
is the real reason the additive discipline is non-negotiable rather than merely tidy.

## What this costs in a monolith: nothing

There is no deploy order. There is one artefact. A change that touches ordering and shipping
is one commit, one build, one deploy, and the compiler verified the whole thing. A rollback
is one artefact version.

This is not an argument that the monolith is better — it is an argument that this line item
must appear on the split's bill, because it is a permanent, per-change tax paid by every
team, forever, and it is invisible in any architecture diagram.

The in-process rehearsal available to you: define your module boundaries as **events with
explicit payload types**, and treat those payload types as if they were already published
contracts — additive changes only, no enums you will extend, no domain entities embedded
whole. If a team cannot maintain that discipline when the compiler is still checking it,
they will not maintain it when the compiler is not.
**49 · Externalisation and the seam** *(not written yet)*.

## Gotchas

**★ "We'll deploy them together" is the moment independent deployability ends, and it is
always said as a temporary measure.** The first coordinated release is presented as a
one-off for a tricky change. The second is easier to justify because the first happened.
Within a quarter there is a release train. Treat any coordinated deploy as an incident with
a postmortem: which shared assumption forced it, and what would have made the change
additive?

**★ A shared library containing DTOs or domain types recouples every service that uses
it.** This is the single most common self-inflicted wound in a young microservice estate,
and it is invisible because it looks like good engineering — DRY, one definition, no
duplication. Shared libraries are fine for genuinely generic infrastructure (a logging
filter, a metrics config) and poisonous for anything domain-shaped. Duplicating a DTO across
two services is correct; it is what lets them evolve separately.

**★ The removal release never happens, so every compatibility shim is permanent.** Step 3
— delete the fallback once all producers send the field — has no business value, no
deadline and no advocate. Ten changes later you have ten shims, each with a branch nobody
tests. If you adopt expand/contract, put the contract step on a dated ticket at the moment
you write the expand step, and treat the date as real.

**★ Rollback is the case that actually breaks, and it is rarely tested.** Teams test
"deploy the new version" and not "deploy the new version, then go back". Every intermediate
combination of versions must be valid, in both directions, which is a stronger requirement
than "the new versions work together". Rehearse a rollback of a multi-service change before
you need one at 3am.

**★ An integration environment as the release gate abolishes independent deployment as a
matter of process, no matter how clean the code is.** If nothing ships until everything
passes together in staging, your release cadence is the slowest team's cadence and the
architecture's central benefit has been given back at the pipeline level. This is the most
common way an otherwise well-built microservice estate ends up with monolith release
dynamics.

**★ Rolling updates mean both versions are live simultaneously, always.** Even a
"simultaneous" deploy has a window of minutes where old and new pods of both services are
serving traffic in every combination. Any change that is only correct if the two versions
switch atomically is a change that will fail during its own deployment.

**★ Feature flags move the coordination problem rather than removing it.** Shipping code
dark and flipping a flag decouples *deployment* from *release*, which genuinely helps. But
the flag itself becomes a distributed shared assumption: two services must agree on its
state, and a flag flipped in one and not the other is exactly the failure the additive
discipline was preventing. Flags are a tool for the release step, not a substitute for
backwards compatibility.

## Interview questions

**★ Describe the deploy-order deadlock and how you escape it.**
Two services must change together — the producer starts sending a new required field and the
consumer must read it. Deploying the consumer first breaks it because the field is absent;
deploying the producer first breaks it if the consumer rejects unknown properties; and there
is no simultaneous deploy, because rolling updates always leave both versions live at once.
The escape is to make the change additive across three releases: first make the consumer
tolerant, accepting the field when present and defaulting when absent; then deploy the
producer; then, later, remove the fallback. The cost to state out loud is that one logical
change became three releases across two teams, and the third one usually never happens.

**★ Name four things that quietly recouple deployments after a split.**
A shared library containing domain types or DTOs, which reinstates compile-time coupling in
a POM where nobody sees it. A shared database or schema, where any column change is a
coordinated release of every reader. Synchronous write chains, where a semantic change
anywhere propagates to every caller upstream. And an integration environment used as the
release gate, which serialises releases by process regardless of how decoupled the code is.
Each is individually reasonable and locally sensible, which is exactly why all four are
common.

**★ Why is rollback the case that actually breaks?**
Because teams verify that the new versions work together and not that every intermediate
combination is valid in both directions. Rolling back the producer to a version that omits
the new field is safe only if the consumer still has its fallback — so if step three of
expand/contract was done eagerly, or the change was never made additive in the first place,
the rollback path is broken and you discover that during an incident. The rule is that a
multi-service change is only safe if you can un-deploy it in reverse order without any
combination failing, and that requirement should be tested, not assumed.

**★ How can a modular monolith rehearse this discipline?**
By treating inter-module events as if they were already external contracts: explicit payload
types, additive-only changes, no extensible enums, no domain entities embedded whole, and a
review rule that a change to a published event's shape needs the same scrutiny as a public
API change. The compiler is still checking you, so mistakes are cheap — which is precisely
what makes it a good rehearsal. If the team will not hold that discipline while the compiler
is helping, they will not hold it when the only feedback is a production failure. Spring
Modulith's `@Externalized` support makes the point concrete by letting you mark exactly
which events are intended to leave the process.

**★ Do feature flags solve the coordination problem?**
They solve part of it and introduce a smaller version of it. Separating deployment from
release lets you ship both sides dark and turn the behaviour on afterwards, which removes
the ordering constraint from the deploy step. But the flag's state is itself a shared
assumption across two services, so a flag enabled in one and not the other reproduces the
original failure — and flags accumulate, each one doubling the number of code paths that
are theoretically live. They are a useful tool for the release step and not a substitute
for making the wire format backwards compatible.

{/* FOOTER */}
