---
title: "Four things people say monoliths cannot do that the primary sources flatly contradict, and one they say microservices give you that the pattern never promised — because an argument built on a false premise loses to the first person who has read the source"
sidebar_label: "10f · What is not on the list"
sidebar_position: 26
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Martin Fowler, *Microservice Premium*
> ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePremium.html)) and *Monolith
> First* ([martinfowler.com](https://martinfowler.com/bliki/MonolithFirst.html)); Chris
> Richardson, *Pattern: Monolithic Architecture* and *Pattern: Microservice Architecture*
> ([microservices.io](https://microservices.io/patterns/monolithic.html)); Stefan Tilkov,
> *Don't start with a monolith*
> ([martinfowler.com](https://martinfowler.com/articles/dont-start-monolith.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Modulith 2.1.1. **No sandbox.**

**[21 · What genuinely does not work](10-what-genuinely-does-not-work.md) is the honest
list. This is the list of claims that get made anyway, each with the source that
contradicts it. They matter because a split justified by one of these is a split justified
by nothing, and because these are the four sentences you will actually hear in the meeting.**

## Myth 1 — "You cannot do continuous delivery with a monolith"

Fowler addresses this directly and names counter-examples:

> *"At this point I feel a certain frustration. Many of the problems ascribed to monoliths
> aren't essential to that style. I've heard people say that you need to use microservices
> because it's impossible to do ContinuousDelivery with monoliths - yet there are plenty of
> organizations that succeed with a cookie-cutter deployment approach: Facebook and Etsy are
> two well-known examples."*

**What is actually true:** continuous delivery of a monolith requires a fast pipeline, a good
test suite, trunk-based development and feature flags. Those are demanding, and they are not
architectural. The thing that genuinely does not exist in a monolith is *independent* release
cadence between teams — item 1 on the honest list — which is a different claim and should be
made as such.

## Myth 2 — "Monoliths cannot scale"

Richardson's monolith page:

> *"You can run multiple instances of the application behind a load balancer in order to
> scale and improve availability."*

**What is actually true:** a monolith scales horizontally. What it cannot do is give two
subdomains different resource characteristics, and even that has the two-deployables answer.
[22 · Independent scaling](10b-independent-scaling.md) is the full treatment. "Cannot scale"
as stated is false; "cannot scale *these two things differently*" is the real, narrower
claim.

## Myth 3 — "Monoliths cannot be modular"

Fowler:

> *"I've also heard arguments that say that as a system increases in size, you have to use
> microservices in order to have parts that are easy to modify and replace. Yet there's no
> reason why you can't make a single monolith with well defined module boundaries. At least
> there's no reason in theory, in practice it seems too easy for module boundaries to be
> breached and monoliths to get tangled as well as large."*

**What is actually true, and this is the important one:** the claim is false *in theory* and
was largely true *in practice* — and the practical objection is precisely a tooling gap that
has since been filled. Fowler's *"too easy for module boundaries to be breached"* and
Tilkov's *"in theory, you don't need microservices for this if you simply have the discipline
to follow clear rules … in practice, I've found this to be the case only very rarely"* are
the same observation: **discipline does not hold boundaries.**

A build failure does. `ApplicationModules.of(Application.class).verify()` in CI rejects a
reference into another module's internal package on the commit that introduces it. That does
not make the modular monolith automatically succeed — the data half remains convention, see
[38 · What verification cannot see](12d-what-verification-cannot-see.md) — but it changes the
mechanism from willpower to a red build, which is the entire reason the second half of this
topic exists.

So the honest version of myth 3 is: *"Monoliths were not reliably modular before there was a
way to fail the build."* Say that, not "monoliths can be modular", because the person
opposite you has watched one rot.

## Myth 4 — "Microservices are faster"

Nothing in either pattern page claims this, and the mechanics point the other way: an
in-process call becomes a network call with serialisation, and an operation spanning four
services accumulates four round trips. Richardson lists the opposite as a force:

> *"Efficient interactions - a distributed operation that involves lots of network round
> trips and large data transfers can be too inefficient"*

**What is actually true:** microservices can improve *throughput under specific conditions*
by letting you scale the bottleneck subdomain independently, and they reliably make
individual distributed operations slower. If someone claims a latency benefit, ask which
operation and what the current bottleneck is.

## Myth 5, running the other way — "A modular monolith is basically microservices"

This one is made by advocates of the position this topic argues for, and it is just as
wrong. A modular monolith does not give you: independent release cadence, independent
failure, different technology stacks, hard security isolation, data residency separation, or
different availability tiers. Tilkov's list of the coupling mechanisms it does not prevent —
the shared persistence model and ambient transactions — is in
[08 · The honest counterargument](03b-the-honest-counterargument.md), and the honest gap
list is **55 · What Modulith does not give you** *(not written yet)*.

Overstating the modular monolith is the fastest way to lose the argument, because everything
above is checkable in five minutes.

## Two claims that are true and get dismissed as myths

**"Monoliths get tangled."** They do. Fowler says so, Tilkov says so at length, and anybody
who has worked on a ten-year-old codebase has seen it. The correct response is not to deny
it but to name the mechanism that prevents it and show it running in CI.

**"Splitting is irreversible in practice."** Also true, and it is the strongest single
argument for delay. Merging services back requires a data migration and a project nobody has
an incentive to propose.

## Gotchas

**★ Arguing against a myth you have not sourced loses the room.** Every claim here has a
citation from Fowler or Richardson; use the citation. "Facebook and Etsy did continuous
delivery on monoliths, and Fowler names them" is an argument; "monoliths can do CD" is an
assertion that sounds like defensiveness.

**★ Myth 3 is the one you must concede half of.** Monoliths *were* unreliably modular,
because the only mechanism was discipline and discipline does not hold. Conceding that and
then producing the verification test is far more persuasive than denying the experience of
everyone who has maintained a large codebase.

**★ Overstating the modular monolith is the most damaging error in this topic.** It does not
give independent release, independent failure, polyglot stacks, security isolation, data
residency or separate availability tiers. Claiming otherwise gets the whole argument
discarded, including the parts that are correct.

**★ "Microservices are faster" is sometimes true about throughput and essentially never true
about latency.** Distributed operations add round trips and serialisation. If someone claims
a performance benefit, make them name the operation and the current bottleneck; usually the
bottleneck is the database, and the topology change does not touch it.

**★ Watch for the myth used as a *supporting* argument rather than the main one.** A proposal
whose real justification is "our build is slow" will often add "and monoliths don't scale"
as reinforcement. Correcting the padding without addressing the real claim is a debating win
and an engineering loss — deal with the build time, which is genuine.

**★ "That's not a real limitation any more" needs a version and a date.** Enforced module
verification is a real answer to myth 3 *because* Spring Modulith 2.1.1 exists, is
maintained, and works on Boot 4.1. In 2015 the objection was correct. Being precise about
what changed and when is what distinguishes an updated position from a contrarian one.

## Interview questions

**★ Someone says "we can't do continuous delivery with a monolith". Are they right?**
No, and Fowler addresses the claim directly, naming Facebook and Etsy as organisations that
succeeded with a cookie-cutter deployment approach on monolithic systems. Continuous delivery
of a monolith needs a fast pipeline, a good test suite, trunk-based development and feature
flags — demanding, but not architectural. The real, narrower claim underneath is that a
monolith cannot give two teams *independent* release cadence, because one artefact ships as
one unit. That is true, it is the strongest argument for splitting, and it should be made in
those words rather than as "monoliths can't do CD".

**★ Which anti-monolith claim should you partly concede?**
That monoliths get tangled. Fowler says there is no reason in theory you cannot build a
monolith with well-defined module boundaries, and then immediately adds that in practice it
seems too easy for those boundaries to be breached — and Tilkov says the same thing about
discipline rarely being sufficient. Denying that loses credibility with anyone who has
maintained a large codebase. The persuasive move is to concede the history and then change
the mechanism: enforced module verification failing the build on the commit that crosses a
boundary is a different thing from a code-review convention, and it did not exist when those
articles were written.

**★ What does a modular monolith not give you?**
Independent release cadence between teams, independent failure isolation between subdomains,
different technology stacks, hard security or regulatory isolation, data-residency
separation, and different availability tiers. It also does not prevent two of the coupling
mechanisms Tilkov identifies — a shared persistence model, since verification checks type
references rather than table access, and the ambient database transaction, since
`@Transactional` still spans everything so nobody is ever forced to write compensation
logic. Being precise about these is what makes the rest of the argument credible.

**★ How do you respond to "microservices will make it faster"?**
By asking which operation and what the current bottleneck is. The mechanics run the other
way for latency: in-process calls become network calls with serialisation, and an operation
spanning four services accumulates four round trips — Richardson lists inefficient
distributed interactions as one of the forces pulling *against* splitting. Microservices can
improve throughput when one subdomain is the bottleneck and can now be scaled independently,
which is a real but narrow benefit. In most systems that claim a performance motive, the
bottleneck is the database, and splitting the application layer does not move it.

{/* FOOTER */}
