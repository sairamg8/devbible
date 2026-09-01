---
title: "Conway proved in 1968 that the structure of a system is a homomorphic image of the communication structure of the organisation that built it, which means your service boundaries are already decided — by your org chart — before anyone opens a whiteboard"
sidebar_label: "02 · Conway's law is the driver"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Melvin E. Conway, *How Do Committees Invent?*, Datamation,
> April 1968, as published by the author
> ([melconway.com](https://www.melconway.com/Home/Committees_Paper.html)), and Martin
> Fowler, *Conway's Law*
> ([martinfowler.com](https://martinfowler.com/bliki/ConwaysLaw.html)) and *Microservice
> Premium* ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePremium.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Modulith 2.1.1. **No sandbox.**

**Almost every architecture debate about splitting is conducted as if the boundary were a
free variable that engineers get to choose. It is not. Conway's 1968 paper shows the
boundary is largely determined by who talks to whom, and Fowler — who is generally hostile
to laws in software architecture — singles this one out as the exception. If you take one
idea from this whole topic, take this: microservices are primarily a tool for structuring a
development organisation, and using them without a matching organisation gets you the
costs and none of the benefits.**

## The law, in Conway's own words

Conway's own informal restatement, from his 42-years-later author's note on the paper:

> *"Any organization that designs a system (defined more broadly here than just information
> systems) will inevitably produce a design whose structure is a copy of the organization's
> communication structure."*

And the paper's own thesis paragraph, which is sharper because it uses the word
*constrained*:

> *"The basic thesis of this article is that organizations which design systems (in the
> broad sense used here) are constrained to produce designs which are copies of the
> communication structures of these organizations."*

**Constrained.** Not "tend to", not "often". The mechanism is in the section Conway calls
*a basic relationship*:

> *"Roughly speaking, we have demonstrated that there is a very close relationship between
> the structure of a system and the structure of the organization which designed it. In the
> not unusual case where each subsystem had its own separate design group, we find that the
> structures (i.e., the linear graphs) of the design group and the system are identical. In
> the case where some group designed more than one subsystem we find that the structure of
> the design organization is a collapsed version of the structure of the system, with the
> subsystems having the same design group collapsing into one node representing that group."*
>
> *"This kind of a structure-preserving relationship between two sets of things is called a
> homomorphism. Speaking as a mathematician might, we would say that there is a
> homomorphism from the linear graph of a system to the linear graph of its design
> organization."*

Note the direction of the collapse, because it is the operationally useful part: **if one
group owns several subsystems, those subsystems collapse into one node.** Which is exactly
what happens to your six microservices when two teams own them: architecturally you drew
six nodes; Conway says the graph that governs the design has two. The extra four boundaries
are decoration, and decoration that costs you network hops.

## The reason it holds: communication paths grow quadratically

Conway is explicit about the mechanism, and it is arithmetic rather than sociology:

> *"Elementary probability theory tells us that the number of possible communication paths
> in an organization is approximately half the square of the number of people in the
> organization. Even in a moderately small organization it becomes necessary to restrict
> communication in order that people can get some 'work' done."*

The formula is `n(n−1)/2` — this is a calculation you can redo, not a measurement. Six
people have 15 possible pairs; twenty have 190; sixty have 1,770. Nobody sustains 1,770
relationships, so communication *gets restricted*, formally or informally, and the
restrictions become the seams in the design. Conway adds the reinforcing organisational
fact:

> *"Common management practice places certain numerical constraints on the complexity of
> the linear graph which represents the administrative structure of a military-style
> organization. Specifically, each individual must have at most one superior and at most
> approximately seven subordinates. To the extent that organizational protocol restricts
> communication along lines of command, the communication structure of an organization will
> resemble its administrative structure. This is one reason why military-style
> organizations design systems which look like their organization charts."*

Fowler's colleague Chris Ford compresses the whole mechanism into one sentence, which is
the version worth memorising:

> *"Conway understood that software coupling is enabled and encouraged by human
> communication."*

Coupling is not created by a bad developer. It is created by a good developer who sat next
to the author of the other module and therefore found it easy to understand and easy to
call.

## The consequence for the split decision

Fowler draws the conclusion for small organisations directly:

> *"A dozen or two people can have deep and informal communications, so Conways Law
> indicates they will create a monolith. That's fine — so Conway's Law doesn't impact our
> thinking for smaller teams. It's when the humans need organizing that Conway's Law should
> affect decision making."*

Read that as a threshold, because it is one. Under roughly 12–24 engineers, communication
is dense enough that the organisation *is* one node, and the system it produces will be one
node too, however many repositories you create. Above that, the organisation has already
fragmented into a graph, and the question stops being *whether* to have boundaries and
becomes *whether your service boundaries match the ones the org chart already imposed*.

The corollary is the sentence Fowler ends his Conway's law article's microservices
paragraph with, and it is the strongest single claim in this topic:

> *"This, indeed, is why I describe microservices as primarily a tool to structure a
> development organization."*

Not a scaling tool. Not a performance tool. An organisational tool.

## The failure mode: an architecture at odds with the communication structure

> *"We often see how inattention to the law can twist system architectures. If an
> architecture is designed at odds with the development organization's structure, then
> tensions appear in the software structure. Module interactions that were designed to be
> straightforward become complicated, because the teams responsible for them don't work
> together well. Beneficial design alternatives aren't even considered because the necessary
> development groups aren't talking to each other."*

This is the mechanism behind the distributed monolith. You draw six services along domain
lines; the organisation has two communication clusters; every change crosses the cluster
boundary; every release requires both clusters to agree; the six services deploy together.
The architecture diagram says six, the homomorphism says two, and the homomorphism wins.

Fowler names a specific common mismatch which is worth recognising by sight:

> *"A common mismatch with Conways Law is where an ActivityOriented team organization works
> at cross-purposes to feature development. Teams organized by software layer (eg
> front-end, back-end, and database) lead to dominant PresentationDomainDataLayering
> structures, which is problematic because each feature needs close collaboration between
> the layers."*

If your teams are "backend", "frontend" and "DBA", your system will be layered, not
domain-partitioned, no matter what the architecture document says — and splitting a layered
system into services gives you services that all have to change together, because a feature
crosses all of them.

## Reading your own org chart as an architecture diagram

The practical exercise takes twenty minutes and is more informative than most design
sessions:

1. Draw the teams as nodes.
2. Draw an edge wherever two teams **must** talk to ship a normal feature — not where they
   *could*, where they *must*.
3. Weight the edges by how easy that conversation is: same room, same timezone, different
   timezone, different company.
4. That graph is the architecture you are going to get.

Now compare it to the service diagram someone drew. Every service boundary that does not
correspond to a low-weight edge in that graph is a boundary you will be fighting for the
next two years. Fowler tells the story of the architect who understood this immediately:

> *"I made my first architectural decision" he told me. "There are going to be six major
> subsystems. I have no idea what they are going to be, but there are going to be six of
> them."*

Six teams in six cities, so six subsystems. He did not know what they did yet. He was still
right.

And the physical/temporal weighting matters more than people expect:

> *"Putting teams on separate floors of the same building is enough to significantly reduce
> communication. Putting teams in separate cities, and time zones, further gets in the way
> of regular conversation."*

With a footnote that updates it for how most teams now work:

> *"While location makes a big contribution to in-person communication patterns, one of the
> features of remote-first working, is that it reduces the role of distance, as everyone is
> communicating online. Conway's Law still applies, but it's based on the online
> communication patterns. Time zones still have a big effect, even online."*

## Where this leaves Spring Modulith

If you have one communication cluster, Conway says you will build one node — so build one
node **on purpose**, with internal structure you can verify. That is the whole pitch of the
modular monolith: it accepts the homomorphism instead of fighting it, and it makes the
internal boundaries real enough that when the organisation *does* fragment, the seams are
already where the fragmentation will happen. [27 · Spring Modulith, what it is](11-spring-modulith-what-it-is.md)
picks that up.

The three responses to the law, and what to do about deliberately changing your
organisation to get the architecture you want, are
[05 · The inverse Conway manoeuvre](02b-the-inverse-conway-maneuver.md).

## Gotchas

**★ The org chart is not the communication structure, and Conway's law is about the
latter.** Two teams on the same floor who eat lunch together are one node regardless of
what the chart says; two teams under the same manager in different time zones are two.
Draw the graph from observed behaviour — who is in whose Slack channel, who reviews whose
pull requests — not from the HR system.

**★ "One group designs several subsystems" collapses them into one node.** This is the
single most useful line in Conway's paper for evaluating a split, and it is the formal
statement of why six services owned by two teams behave like two components. If you cannot
staff one owner per service, you have not designed the architecture you drew.

**★ You cannot fight the law, only accept it or change the organisation.** Fowler:
*"powerful enough that you're doomed to defeat if you try to fight it."* Teams routinely
try anyway, by drawing the boundary they want and hoping process discipline will hold it.
It does not; the communication structure reasserts itself as coupling.

**★ Layer-shaped teams produce layer-shaped systems, and layers are the worst thing to
split into services.** Front-end / back-end / DBA teams produce a presentation-domain-data
layered structure where every feature crosses every layer. Turning those layers into
services produces services that must always deploy together — a distributed monolith by
construction. Fix the team shape first, or split along a different axis.

**★ Under about two dozen engineers, the law argues for the monolith, and that is not a
consolation prize.** Fowler says explicitly that Conway's law does not affect the decision
for smaller teams *because it says monolith*. If you are that size, the modular monolith is
not the compromise position, it is the position the strongest law in software architecture
recommends.

**★ Remote work changes the metric, not the law.** Distance matters less; time zones and
online communication patterns matter more. A fully remote org in one time zone may be a
denser communication graph than a co-located org spread over three floors. Measure the
right thing.

## Interview questions

**★ State Conway's law and explain the mechanism behind it.**
Any organisation that designs a system produces a design whose structure copies the
organisation's communication structure — Conway's paper puts it more strongly, that such
organisations are *constrained* to produce such designs. The mechanism is communication
bandwidth: possible communication paths grow as roughly `n²/2`, so beyond a small size an
organisation must restrict communication to get work done, and those restrictions become
the interfaces in the design. Conway formalises it as a homomorphism from the system's
graph to the organisation's graph — and crucially, when one group owns several subsystems,
those subsystems collapse to a single node in the organisation graph.

**★ Why does Fowler call microservices "primarily a tool to structure a development
organization"?**
Because the benefit that has no in-process substitute is team autonomy — the ability of one
team to develop, test and deploy without coordinating with another. Everything else a split
buys (cognitive load, pipeline speed, resource segregation) has a partial or complete
answer inside a single deployable. Autonomy does not. And autonomy is meaningless unless
there is more than one team, which makes the org chart, not the code, the deciding input.

**★ Six services, two teams. What does Conway's law predict?**
That the system will behave as two components. Conway's collapse rule says subsystems
designed by the same group collapse into one node, so the effective architecture is two,
not six. Practically: changes will cross the four intra-team boundaries freely — because
the same people write both sides and can just talk — so those boundaries will erode into
shared assumptions, shared libraries and shared data. Meanwhile the one boundary that
matters, the one between the two teams, gets the same amount of design attention as the
four that do not. You end up with four boundaries that cost network hops and buy nothing,
and one that is under-designed.

**★ What are the three responses to Conway's law?**
Ignore it, which does not work because the law applies whether you have heard of it or not.
Accept it — design an architecture that does not clash with the existing communication
patterns, which is the right default. Or the inverse Conway manoeuvre — deliberately change
the organisation's communication structure to induce the architecture you want. The third
is a real technique but it is slow, it is a management action rather than an engineering
one, and Fowler warns it is not a fix for an existing rigid architecture, where changing the
org first just creates friction between developers and code.

**★ Your architecture diagram and your org chart disagree. Which one is describing the
future?**
The org chart. The architecture diagram describes an intention; the communication structure
describes a constraint. Where they disagree you will observe the specific symptoms Fowler
names: interactions that were designed to be straightforward become complicated because the
responsible teams do not work together well, and better design alternatives never get
proposed because the relevant groups are not talking. The productive move is not to argue
for the diagram, it is to either redraw it along the communication seams or change the
communication structure — and to be honest about which of those two you actually have the
authority to do.

{/* FOOTER */}
