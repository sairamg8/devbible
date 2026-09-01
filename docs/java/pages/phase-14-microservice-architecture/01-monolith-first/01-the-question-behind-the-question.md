---
title: "\"Should we split this into microservices?\" is almost never a technical question — it is a question about how many teams you have and how they talk to each other, wearing a technical costume"
sidebar_label: "01 · The question behind the question"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Martin Fowler, *Microservice Premium*
> ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePremium.html)), *Monolith
> First* ([martinfowler.com](https://martinfowler.com/bliki/MonolithFirst.html)) and
> *Conway's Law* ([martinfowler.com](https://martinfowler.com/bliki/ConwaysLaw.html)); and
> Chris Richardson's *Pattern: Monolithic Architecture* and *Pattern: Microservice
> Architecture* ([microservices.io](https://microservices.io/patterns/monolithic.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8 · Spring Modulith
> **2.1.1**. **No sandbox** — these pages carry Java, Maven and YAML, never a fabricated
> run, log line or latency number.

**Every "should we split this?" conversation you will ever sit in has two layers. The top
layer is technical and is the one everybody argues about: scaling, deploy speed, blast
radius, the build taking too long. The bottom layer is organisational and is the one that
actually decides the answer: how many teams there are, how much they need to talk, and who
gets paged at 3am. Almost every failed split in the wild was a bottom-layer problem that
someone answered with a top-layer solution. This topic exists to teach you to notice which
layer you are standing on.**

## The default answer is "no", and it is not close

Fowler states the default with no hedging at all:

> *"So my primary guideline would be don't even consider microservices unless you have a
> system that's too complex to manage as a monolith. The majority of software systems
> should be built as a single monolithic application. Do pay attention to good modularity
> within that monolith, but don't try to separate it into separate services."*

Read the second half of that as carefully as the first. It is not "build a ball of mud and
worry later". It is *build a monolith and pay attention to modularity inside it*. That
second clause is the whole of the Spring Modulith half of this topic — chunks
[27](11-spring-modulith-what-it-is.md) onward are about how you make "pay attention to
good modularity" into something a build can fail on rather than something a senior
engineer nags about in code review.

The word Fowler uses for the cost of ignoring that guideline is **premium**:

> *"The microservices approach is all about handling a complex system, but in order to do
> so the approach introduces its own set of complexities. When you use microservices you
> have to work on automated deployment, monitoring, dealing with failure, eventual
> consistency, and other factors that a distributed system introduces. There are
> well-known ways to cope with all this, but it's extra effort, and nobody I know in
> software development seems to have acres of free time."*

A premium is a price you pay *whether or not you use the thing you bought*. If you split a
system into six services and only two of them ever needed to scale independently, you paid
the premium six times and collected the benefit twice.

## The three answers to "why are we splitting?", ranked by honesty

When you ask a team why they are splitting, you get one of these. They are not equally
good reasons and they are not equally honest.

**1. "Because the deploy pipeline takes ninety minutes and four teams are queued behind
it."** This is the honest one. It is an *organisational* reason expressed as a *measured*
constraint, and it is precisely the case microservices were invented for. It is also the
one you should try to fix inside the monolith first — see
[25 · The build and the pipeline](10e-the-build-and-the-pipeline.md), because build
parallelism and incremental testing are dramatically cheaper than a distributed system.

**2. "Because the codebase is a mess and we cannot find the boundaries."** This is the
dangerous one. Fowler's second argument against splitting first is exactly this:

> *"The second issue with starting with microservices is that they only work well if you
> come up with good, stable boundaries between the services — which is essentially the
> task of drawing up the right set of BoundedContexts. Any refactoring of functionality
> between services is much harder than it is in a monolith. But even experienced architects
> working in familiar domains have great difficulty getting boundaries right at the
> beginning."*

If you cannot find the boundary in a codebase where the compiler, the IDE and a single
`git grep` are all on your side, you will not find it once the wrong boundary is a network
hop and a deploy pipeline. Splitting does not reveal boundaries; it **freezes whatever
boundary you guessed**. The topic that owns getting that guess right is **02 · Service
boundaries from bounded contexts** *(not written yet)*.

**3. "Because that is how modern systems are built."** Fowler's colleagues named this one:
the ThoughtWorks radar called it *"Microservice Envy"*. There is nothing more to say about
it except that it is expensive.

## What "the complexity that drives us to microservices" actually is

Fowler enumerates the sources, and the list is worth memorising because none of the entries
is "the code is ugly":

> *"The complexity that drives us to microservices can come from many sources including
> dealing with large teams, multi-tenancy, supporting many user interaction models,
> allowing different business functions to evolve independently, and scaling. But the
> biggest factor is that of sheer size — people finding they have a monolith that's too big
> to modify and deploy."*

Four of the five are organisational or product-shaped. Only "scaling" is purely technical,
and it is listed last. And the footnote Fowler hangs on "large teams" is Conway's law —
which is the subject of [04](02-conways-law-is-the-real-driver.md), and the real engine
under this entire decision.

## Richardson frames it as forces, which is the more useful shape

Chris Richardson's pattern pages describe the same decision as a tug of war between two
sets of forces. He calls them **dark energy** (forces that push subdomains *apart*, into
separate services) and **dark matter** (forces that pull them *together*, into one
component). Verbatim, the dark energy forces are:

> *"Simple components — simple components consisting of few subdomains are easier to
> understand and maintain than complex components"*
>
> *"Team autonomy — a team needs to be able to develop, test and deploy their software
> independently of other teams"*
>
> *"Fast deployment pipeline — fast feedback and high deployment frequency are essential
> and are enabled by a fast deployment pipeline, which in turn requires components that are
> fast to build and test."*
>
> *"Support multiple technology stacks — subdomains are sometimes implemented using a
> variety of technologies; and developers need to evolve the application's technology
> stack, e.g. use current versions of languages and frameworks"*
>
> *"Segregate by characteristics — e.g. resource requirements to improve scalability, their
> availability requirements to improve availability, their security requirements to improve
> security, etc."*

And the dark matter forces, which are the ones the enthusiastic split proposal always
forgets:

> *"Simple interactions — an operation that's local to a component or consists of a few
> simple interactions between components is easier to understand and troubleshoot than a
> distributed operation, especially one consisting of complex interactions"*
>
> *"Efficient interactions — a distributed operation that involves lots of network round
> trips and large data transfers can be too inefficient"*
>
> *"Prefer ACID over BASE — it's easier to implement an operation as an ACID transaction
> rather than, for example, eventually consistent sagas"*
>
> *"Minimize runtime coupling — to maximize the availability and reduce the latency of an
> operation"*
>
> *"Minimize design time coupling — reduce the likelihood of changing services in lockstep,
> which reduces productivity"*

That is a genuinely good decision framework because it is symmetric: it gives the monolith
five arguments, not zero. [02 · What microservices actually buy](01b-what-microservices-actually-buy.md)
takes the dark energy list apart, one force at a time, and asks *who* receives each
benefit. [03 · Who pays for them](01c-who-pays-for-them.md) does the same for the bill.

## The shape of the rest of this topic

- Chunks 2–3 price the purchase: what you get, and out of whose budget.
- Chunks 4–6 are Conway's law, because the organisation is the actual independent variable.
- Chunks 7–9 are the monolith-first argument and its best rebuttal.
- Chunks 10–20 are the bill nobody itemises.
- Chunks 21–26 are the honest list of what a monolith genuinely cannot do — and the four
  widely-repeated claims that the primary sources contradict.
- Chunks 27–53 are **Spring Modulith 2.1.1**: the in-process answer, in enough detail to
  actually adopt it.
- Chunks 54–57 are the migration path and the decision record.

## Gotchas

**★ "We'll split it later" is a promise made by people who will not be there.** The
monolith-first strategy only works if somebody actually maintains the modularity while the
monolith grows. Fowler is explicitly uneasy about this: *"I'd feel much more comfortable
with this approach if I'd heard a decent number of stories where it worked out that way."*
The fix is not willpower, it is a failing test — `ApplicationModules.of(…).verify()` in
CI, from commit one. See [35 · Verifying the arrangement](12-verifying-the-arrangement.md).

**★ The split proposal is usually written by the person who feels the dark energy and read
by nobody who feels the dark matter.** The engineer whose build is slow feels "fast
deployment pipeline" every single day. Nobody feels "prefer ACID over BASE" until the first
order is charged twice. Force the proposal to name, for every one of Richardson's five dark
matter forces, which operations it makes worse. If it cannot, it is not a proposal, it is
a wish.

**★ "Too complex to manage as a monolith" is not the same as "large".** Fowler names the
biggest factor as *"sheer size — people finding they have a monolith that's too big to
modify and deploy"* — note the two verbs. A 400,000-line codebase that one team modifies
comfortably and deploys in eleven minutes is not the problem case. A 60,000-line codebase
that four teams queue behind is. Count the *teams that must coordinate to ship*, not the
lines.

**★ A split justified by "the code is a mess" makes the mess permanent.** Refactoring
across a network boundary requires a coordinated deploy of at least two services and
usually a data migration. Inside the monolith it is an IDE move-class refactor. If you have
not yet used the cheap tool, do not buy the expensive one.

**★ Microservice size varies by an order of magnitude between successful systems, so
"microservice" tells you almost nothing.** Fowler: *"I've seen microservice systems vary
from a team of 60 with 20 services to a team of 4 with 200 services. It's not clear to what
degree service size affects the premium."* When someone says "we should use microservices",
ask how many, and watch the number move around during the conversation.

## Interview questions

**★ Somebody proposes splitting your order system into six services. What do you ask
first?**
How many teams will own them, and how many of those teams exist today. The single strongest
predictor of whether a split helps is whether the service count and the team count match.
Six services owned by two teams is not six autonomous units; it is one unit with six deploy
pipelines and five network hops added to the critical path. The second question is which
operations become distributed — take the three highest-traffic user journeys and count how
many services each one now touches. The third is what specifically is broken today, stated
as a measurement rather than a feeling: pipeline duration, deploy queue depth, incidents
per week caused by one subdomain taking down another.

**★ What is the "microservice premium" and why is the word "premium" well chosen?**
It is the fixed cost a distributed architecture imposes regardless of whether you use the
capabilities it buys — automated deployment, monitoring, failure handling, eventual
consistency, and the operational competence to run all of it. "Premium" is well chosen
because insurance premiums are the same shape: you pay them up front, continuously, in
exchange for a capability you may or may not draw on. A team that splits into six services
but only needs independent scaling for one of them has paid six premiums and drawn one
claim.

**★ Give three technical-sounding reasons for splitting that are really organisational
reasons.**
"Our build takes ninety minutes" — the build is slow because many teams commit to it, and
the real complaint is that their release cadences are coupled. "We keep breaking each
other's features" — that is an ownership and test-coverage problem expressed as a
deployment problem. "We need to scale the checkout independently" — this one is *sometimes*
genuinely technical, but far more often the actual constraint is that the checkout team
cannot deploy a fix without the reporting team's release train. Each of these has a
cheaper, non-distributed fix that should be tried first, and each of them will still be
true after the split if the underlying coordination problem is not addressed.

**★ Richardson's model gives the monolith five arguments. Name them and say which one bites
first in an e-commerce system.**
Simple interactions, efficient interactions, prefer ACID over BASE, minimise runtime
coupling, minimise design-time coupling. In e-commerce, "prefer ACID over BASE" bites
first and hardest, because the checkout operation wants to reserve inventory, charge a
card and create an order atomically. In a monolith that is one `@Transactional` method. The
moment inventory and orders are separate services with separate databases, it is a saga
with compensating actions, an idempotency strategy and a state machine — and the business
now has to define what happens when the card is charged and the reservation fails.
[10 · The transaction you lose](04-the-transaction-you-lose.md) covers this.

**★ Is "monolith" an insult?**
No, and treating it as one is how teams end up with a distributed monolith. In
Richardson's taxonomy it is a *pattern* with an explicit benefit list and an explicit
drawback list, on equal footing with the microservice pattern. The insult people mean is
"big ball of mud", which is a description of *internal structure*, not of deployment
topology. The two are independent: you can have a beautifully modular monolith, and you can
absolutely have a big ball of mud spread across fourteen repositories —
**12 · The distributed monolith** *(not written yet)* is that page.

{/* FOOTER */}
