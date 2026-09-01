---
title: "If the organisation determines the architecture, then the way to get the architecture you want is to change the organisation first — which is a real, named technique, and also the reason most architecture decisions are above your pay grade"
sidebar_label: "02b · The inverse Conway manoeuvre"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Martin Fowler, *Conway's Law*
> ([martinfowler.com](https://martinfowler.com/bliki/ConwaysLaw.html)) and *Microservice
> Premium* ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePremium.html));
> Melvin E. Conway, *How Do Committees Invent?* (1968)
> ([melconway.com](https://www.melconway.com/Home/Committees_Paper.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Modulith 2.1.1. **No sandbox.**

**There are exactly three things you can do about Conway's law, and only one of them
involves writing code. Knowing which of the three you are actually doing — and whether you
have the authority to do it — is the difference between an architecture decision that
sticks and one that gets quietly eroded over eighteen months by people who were never
consulted.**

## The three responses

Fowler tabulates them:

> *"Ignore — Don't take Conway's Law into account, because you've never heard of it, or you
> don't think it applies (narrator: it does)"*
>
> *"Accept — Recognize the impact of Conway's Law, and ensure your architecture doesn't
> clash with designers' communication patterns."*
>
> *"Inverse Conway Maneuver — Change the communication patterns of the designers to
> encourage the desired software architecture."*

**Ignore** is the default and it is not a decision, it is an absence of one. The tell is a
service diagram drawn purely from domain nouns with no reference to who will own each box.

**Accept** is the correct default for almost everyone reading this. It means: draw the
communication graph, then draw boundaries that match it. For a small organisation that
graph has one node, and accepting the law means building one deployable with good internal
structure — the modular monolith, which is what [27 · Spring Modulith, what it is](11-spring-modulith-what-it-is.md)
onwards is about.

**Inverse Conway** is the interesting one, and it is where microservices actually came
from.

## What the manoeuvre is, and where the term comes from

Fowler's footnote in *Microservice Premium*:

> *"Conway's Law says that the structure of a system follows the organization of the people
> that built it. Some examples of microservice usage had organizations deliberately split
> themselves into small, loosely coupled groups in order to push the software into a
> similar modular structure — a notion that's called the Inverse Conway Maneuver."*

And the attribution:

> *"The term 'inverse Conway maneuver' was coined by Jonny LeRoy and Matt Simons in an
> article published in the December 2010 issue of the Cutter IT journal."*

The full description in *Conway's Law*:

> *"Here we deliberately alter the development team's organization structure to encourage
> the desired software architecture … This approach is often talked about in the world of
> microservices, where advocates advise building small, long-lived BusinessCapabilityCentric
> teams that contain all the skills needed to deliver customer value. By organizing
> autonomous teams this way, we employ Conway's Law to encourage similarly autonomous
> services that can be enhanced and deployed independently of each other."*

Three constraints hide in that sentence and each one is a hiring and management commitment,
not an engineering one:

- **small** — small enough that the team's internal communication stays dense;
- **long-lived** — a team reassigned every quarter never develops the shared context that
  makes a boundary hold;
- **contain all the skills needed to deliver customer value** — cross-functional, including
  the ability to deploy and operate. A team that must file a ticket with a DBA to change a
  column is not autonomous, and its service will not be either.

## The three ways it fails

### 1. You do not have the authority to execute it

The inverse Conway manoeuvre is a reorganisation. Reorganisations are performed by people
who can move headcount, change reporting lines and change budgets. If you are the tech
lead proposing microservices and you cannot do those things, you are not performing the
manoeuvre — you are performing "ignore" with better vocabulary, and the communication
structure will reassert itself.

The honest form of the proposal is therefore not "let us split the system" but "let us form
four cross-functional teams with end-to-end ownership, and *then* split the system along the
lines that creates". If the organisation will not do the first half, do not do the second.

### 2. You apply it to an existing rigid architecture and get friction instead of change

Fowler's caveat is specific and it is the one people skip:

> *"While the inverse Conway maneuver is a useful tool, it isn't all-powerful. If you have
> an existing system with a rigid architecture that you want to change, changing the
> development organization isn't going to be an instant fix. Instead it's more likely to
> result in a mismatch between developers and code that adds friction to further
> enhancement. With an existing system like this, the point of Conway's Law is that we need
> to take into account its presence while changing both organization and code base. And as
> usual, I'd recommend taking small steps while being vigilant for feedback."*

Reorganising four teams around four bounded contexts on Monday, when the codebase has no
such boundaries, produces four teams who all edit the same files and block each other's
pull requests. The organisation changed; the architecture did not; the friction is the
cost. **The code and the org must move together, in small steps.**

This is precisely where the modular monolith earns its place in an inverse-Conway
programme: you can move the *code* into module boundaries and enforce them with
`ApplicationModules.of(…).verify()` (see [35](12-verifying-the-arrangement.md)) *while*
the reorganisation is happening, without a single deployment change. When the teams are
real, the seams already exist and the extraction is mechanical.

### 3. You reorganise for an architecture nobody has validated

The manoeuvre bakes your boundary guess into the org chart, which is far harder to change
than a package structure. Fowler's warning about boundaries applies doubly: if experienced
architects have *"great difficulty getting boundaries right at the beginning"*, then
committing your reporting lines to that guess is a bigger bet than committing your build
to it. Get the boundaries out of the code first — where a wrong guess costs an IDE refactor
— and reorganise around boundaries you have already proven stable.

## Bounded contexts are the bridge between the two graphs

Fowler ties the technique to DDD explicitly, and this is the practically useful mechanism:

> *"Domain-Driven Design plays a role with Conway's Law to help define organization
> structures, since a key part of DDD is to identify BoundedContexts. A key characteristic
> of a Bounded Context is that it has its own UbiquitousLanguage, defined and understood by
> the group of people working in that context. Such contexts form ways to group people
> around a subject matter that can then align with the flow of value."*

A bounded context is simultaneously a *language* boundary and a *people* boundary, which is
why it is the right unit for both graphs. When "order" means something different to the
fulfilment team than to the finance team, that is not a naming problem to be resolved — it
is the boundary announcing itself. **02 · Service boundaries from bounded contexts**
*(not written yet)* owns the technique.

## The rule that closes the chunk

> *"The key thing to remember about Conways Law is that the modular decomposition of a
> system and the decomposition of the development organization must be done together. This
> isn't just at the beginning, evolution of the architecture and reorganizing the human
> organization must go hand-in-hand throughout the life of an enterprise."*

**Together, and continuously.** Not "reorganise then split", not "split then reorganise",
and never "split and hope the organisation catches up".

## Gotchas

**★ Proposing a split without the authority to reorganise is performing "ignore" in
disguise.** The manoeuvre requires moving headcount, reporting lines and on-call rotations.
If the proposal does not include those, the communication structure is unchanged and Conway
guarantees the old shape survives — now spread across N repositories. Ask who is signing
the reorg before you ask which services there will be.

**★ Reorganising around a rigid existing architecture makes things worse before it makes
them better, and often instead of.** Fowler is explicit: it produces a mismatch between
developers and code that adds friction. Four teams that all edit the same tangled package
block each other more than one team did. Move the code into modules first — that part costs
nothing and is reversible.

**★ "Cross-functional" is a load-bearing word and the first one to get diluted.** A team
that cannot deploy its own service, cannot change its own schema, or has to ask a shared
QA group to test it is not autonomous. Its service will inherit whatever coordination those
dependencies impose, and the boundary will show up in the architecture as coupling to the
platform team's release calendar.

**★ "Long-lived" is the second one, and it is destroyed by ordinary project staffing.** If
teams re-form every quarter around projects, the communication structure is re-randomised
every quarter and no stable boundary can emerge from it. Project-shaped staffing and
service-shaped architecture are incompatible; pick one.

**★ The manoeuvre commits your boundary guess to the org chart, which is harder to undo
than code.** Getting a boundary wrong in a package is an IDE refactor; getting it wrong in
reporting lines is a reorganisation, a set of disappointed people, and usually a year.
Validate boundaries in the codebase before you validate them in the org chart.

**★ You can run the manoeuvre without splitting the deployable at all, and often should.**
Form the teams, give each one a Spring Modulith module with explicitly declared allowed
dependencies ([31](11e-explicit-allowed-dependencies.md)), and let them experience owning a
boundary while the deploy remains shared. If the boundaries survive six months of real
feature work, extract. If they do not, you moved some packages.

## Interview questions

**★ What is the inverse Conway manoeuvre and when is it appropriate?**
It is deliberately changing the organisation's communication structure to induce the
software architecture you want — typically forming small, long-lived, cross-functional
teams aligned to business capabilities so that Conway's law produces correspondingly
autonomous services. It is appropriate when you have the authority to actually reorganise,
when the target boundaries have been validated somewhere cheaper first, and when the code
can move in step with the org. It is inappropriate as a fix for an existing rigid
architecture, where Fowler warns it produces a mismatch between developers and code that
adds friction rather than removing it.

**★ Your CTO wants microservices; your company has one eight-person team. What do you
say?**
That the manoeuvre they are implicitly proposing is a reorganisation they have not
described, and that with one team Conway's law predicts a single component regardless of
how many repositories exist. The productive counter-proposal is a modular monolith with
enforced module boundaries — Spring Modulith's package conventions plus a verification test
in CI — which delivers the cognitive-load benefit immediately, costs nothing operationally,
keeps every boundary cheap to move while you are still learning the domain, and leaves the
extraction path open. Then name the trigger: when we have three teams that need independent
release cadence, we extract, starting with the module whose events are already its only
inbound dependency.

**★ Why does Fowler say the code and the organisation must change together?**
Because each constrains the other. Changing the org without changing the code gives you
teams fighting over the same files; changing the code without changing the org gives you
boundaries nobody is accountable for, which erode as soon as delivery pressure arrives. He
frames it as continuous rather than one-off — architectural evolution and organisational
evolution have to go hand in hand throughout the life of the system, which also means a
boundary that was correct two reorganisations ago is not automatically correct now.

**★ How does a modular monolith help an inverse Conway programme?**
It lets the code half of "change both together" run at essentially zero operational cost
and full reversibility. You can create the module boundaries, assign owners, enforce
allowed dependencies with a failing build, and give each new team the experience of owning
an API and a set of published events — all while there is still one deployable, one
database and one `@Transactional`. If the boundaries hold under six months of real feature
work, the extraction is mechanical; if they do not, you have learned that for the price of
moving some packages rather than the price of a distributed system.

{/* FOOTER */}
