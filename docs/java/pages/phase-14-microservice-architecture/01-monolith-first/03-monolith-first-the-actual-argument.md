---
title: "The monolith-first argument is not that monoliths are good — it is that you cannot yet see the boundaries, and a network boundary is the most expensive place to discover you guessed wrong"
sidebar_label: "03 · Monolith first, the argument"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Martin Fowler, *Monolith First*, 3 June 2015
> ([martinfowler.com](https://martinfowler.com/bliki/MonolithFirst.html)) and *Microservice
> Premium* ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePremium.html));
> Stefan Tilkov, *Don't start with a monolith*, 9 June 2015
> ([martinfowler.com](https://martinfowler.com/articles/dont-start-monolith.html)).
> Version spine: JDK 25 · Spring Boot 4.1.1 · Spring Modulith 2.1.1. **No sandbox.**

**Monolith-first is stated as an empirical observation, not a preference, and it has
exactly two supporting arguments: you do not yet know whether the product is worth
building, and you do not yet know where the boundaries are. Both are arguments about
*information you do not have*, which is why "but we are sure our system will be big" is not
a rebuttal.**

## The observation

Fowler opens with a pattern, not an argument:

> *"As I hear stories about teams using a microservices architecture, I've noticed a common
> pattern."*
>
> *"Almost all the successful microservice stories have started with a monolith that got too
> big and was broken up"*
>
> *"Almost all the cases where I've heard of a system that was built as a microservice
> system from scratch, it has ended up in serious trouble."*

Note the epistemic honesty in the framing — these are stories he has heard, and he says so
repeatedly. He closes the piece by explicitly limiting the claim:

> *"I don't feel I have enough anecdotes yet to get a firm handle on how to decide whether
> to use a monolith-first strategy. These are early days in microservices, and there are
> relatively few anecdotes to learn from. So anybody's advice on these topics must be seen
> as tentative, however confidently they argue."*

Quote both halves when you use this argument. A page that quotes the first and hides the
second is doing advocacy, not engineering. Eleven years on, the observation has held up
well enough to be the industry default position, but the evidence base is still anecdote
rather than controlled study, and the honest version says so.

## Argument one: YAGNI

> *"The first reason for this is classic Yagni. When you begin a new application, how sure
> are you that it will be useful to your users? It may be hard to scale a poorly designed
> but successful software system, but that's still a better place to be than its inverse. As
> we're now recognizing, often the best way to find out if a software idea is useful is to
> build a simplistic version of it and see how well it works out. During this first phase
> you need to prioritize speed (and thus cycle time for feedback), so the premium of
> microservices is a drag you should do without."*

The load-bearing sentence is the middle one: *"It may be hard to scale a poorly designed
but successful software system, but that's still a better place to be than its inverse."*
It reframes the whole risk calculation. Teams evaluate the split as "what if we get big and
the monolith cannot cope?" — a real risk, but small compared to "what if we spend the first
year building distributed-systems infrastructure for a product nobody wants?"

Concretely, the premium you pay in phase one is: a service template, N pipelines, a
correlation strategy (the subject of **10 · Correlation across services**
*(not written yet)*), contract tests, a local-development story, and a distributed consistency model —
all of it before your first paying customer tells you the domain model is wrong.

## Argument two: you cannot see the boundaries yet

> *"The second issue with starting with microservices is that they only work well if you
> come up with good, stable boundaries between the services — which is essentially the task
> of drawing up the right set of BoundedContexts. Any refactoring of functionality between
> services is much harder than it is in a monolith. But even experienced architects working
> in familiar domains have great difficulty getting boundaries right at the beginning. By
> building a monolith first, you can figure out what the right boundaries are, before a
> microservices design brushes a layer of treacle over them. It also gives you time to
> develop the MicroservicePrerequisites you need for finer-grained services."*

Three separate claims, each worth its own attention:

**"Even experienced architects working in familiar domains have great difficulty getting
boundaries right at the beginning."** This is the sentence to deploy against "but we know
this domain". Familiarity does not help enough. The information you are missing is not
domain knowledge, it is *which changes will arrive together in the future*, and nobody has
that.

**"Any refactoring of functionality between services is much harder than it is in a
monolith."** Moving a class between packages is an IDE keystroke and a compile. Moving a
capability between services is: two deploys in a specific order, a data migration, a period
where both sides must accept both shapes, updated contract tests, and a rollback plan.
Call it two orders of magnitude and you are being generous to the distributed case.

**"Before a microservices design brushes a layer of treacle over them."** The treacle is
the point. A wrong boundary in a monolith is *visible* — you see the same concept in two
packages, the same table joined from two modules, a class that imports from three modules.
Across services the same wrongness manifests as chattiness, latency and coupled deploys,
which look like operational problems rather than design problems, and get "fixed" with
caches and retries.

## Argument two-and-a-half: the prerequisites need time to build

The last clause — *"It also gives you time to develop the MicroservicePrerequisites you need
for finer-grained services"* — is often skipped and is arguably the most actionable part.
Rapid provisioning, monitoring and rapid deployment are capabilities you can build *while*
running a monolith, and Fowler notes they are things *"you really ought to have for
monolithic systems too."* Which means monolith-first has a zero-waste property: the
platform work you do during the monolith phase is not thrown away if you later split, and
is still valuable if you never do. [18 · The prerequisites and the headcount](08b-the-prerequisites-and-the-headcount.md)
develops this.

## The footnote that is really the whole risk

> *"You cannot assume that you can take an arbitrary system and break it into microservices.
> Most systems acquire too many dependencies between their modules, and thus can't be
> sensibly broken apart. I've heard of plenty of cases where an attempt to decompose a
> monolith has quickly ended up in a mess. I've also heard of a few cases where a gradual
> route to microservices has been successful — but these cases required a relatively good
> modular design to start with."*

**"These cases required a relatively good modular design to start with."** That is the
condition on which the entire monolith-first strategy depends, and it does not happen by
accident. Fowler says as much about the disciplined version of the strategy:

> *"The logical way is to design a monolith carefully, paying attention to modularity within
> the software, both at the API boundaries and how the data is stored. Do this well, and
> it's a relatively simple matter to make the shift to microservices. However I'd feel much
> more comfortable with this approach if I'd heard a decent number of stories where it
> worked out that way."*

That unease — expressed in 2015, when there was no tooling for it — is exactly the gap
Spring Modulith addresses. "Pay attention to modularity" is a hope; `ApplicationModules.of(Application.class).verify()`
failing a build is a mechanism. The distinction is the reason the second half of this topic
exists.

## What monolith-first does *not* claim

- It does not claim monoliths are better. Fowler's own framing is that microservices are a
  *"useful architecture"* whose premium *"means they are only useful with more complex
  systems."*
- It does not claim you should never split. The observation is that the successful stories
  *started* as monoliths and *got broken up*.
- It does not claim modularity is optional. The opposite: modularity is the precondition
  that makes the strategy work at all.
- It does not claim the debate is settled. Fowler explicitly notes it *"is by no means
  unanimous"*, and [08 · The honest counterargument](03b-the-honest-counterargument.md) is
  the best statement of the other side.

## Gotchas

**★ "We know this domain, so we can draw the boundaries now" is the exact claim Fowler
rebuts by name.** *"Even experienced architects working in familiar domains have great
difficulty getting boundaries right at the beginning."* Domain familiarity does not supply
the missing information, which is which changes will co-occur in future. The cheapest way
to acquire that information is to build the thing where boundaries are cheap to move.

**★ Monolith-first without enforced modularity is not the strategy, it is the failure
mode.** The strategy's own footnote says the successful gradual decompositions *"required a
relatively good modular design to start with."* A team that hears "monolith first" as
permission to skip module boundaries has adopted the costs of the strategy — a large
codebase, a big pipeline — and destroyed its only benefit, which was a cheap place to
discover boundaries.

**★ A wrong boundary in a monolith is visible; across services it disguises itself as an
operations problem.** In-process, you see duplicated concepts and cross-module imports.
Distributed, you see p99 latency, retry storms and coupled release trains — which teams fix
with caches, circuit breakers and bigger instances rather than by redrawing the boundary.
The treacle is not a metaphor for difficulty; it is a metaphor for *concealment*.

**★ The strategy has an expiry date and nobody sets an alarm for it.** "Monolith first"
implies "and then, at some point, not". If nobody has written down the trigger condition —
team count, pipeline duration, an availability requirement one subdomain cannot meet — then
the strategy silently becomes "monolith forever", which is fine right up until it is not.
Write the trigger into a decision record: **56 · The decision record** *(not written yet)*.

**★ Quoting Fowler's observation without his caveat is misuse of the source.** He describes
the evidence as anecdotes and says *"anybody's advice on these topics must be seen as
tentative, however confidently they argue."* If you deploy the argument in a design review,
deploy the caveat with it — partly because it is honest, and partly because the person
across the table has probably read the same page.

## Interview questions

**★ State the monolith-first argument in two sentences.**
Almost all successful microservice systems began as monoliths that grew too big and were
broken up, while systems built as microservices from scratch tend to end up in trouble. The
two reasons are YAGNI — you do not yet know the product is worth building, and the premium
slows down the feedback loop you need most in phase one — and boundaries: microservices only
work with good, stable boundaries, even experienced architects get those wrong at the
start, and refactoring across a service boundary is far harder than inside a codebase.

**★ Why is "we understand our domain well" not a good enough reason to start with
microservices?**
Because the information a boundary needs is not domain knowledge, it is knowledge about
which parts of the system will change together in future — and no amount of domain
familiarity supplies that. Fowler addresses the claim directly: even experienced architects
working in familiar domains have great difficulty getting boundaries right at the
beginning. The asymmetry is what makes it decisive: a wrong boundary in a monolith costs an
IDE refactor, and a wrong boundary between services costs two coordinated deploys, a data
migration and a compatibility window.

**★ What condition must hold for the monolith-first strategy to actually work?**
The monolith must be modular, and modular in a way that is enforced rather than intended.
Fowler's own footnote says the successful gradual decompositions required a relatively good
modular design to start with, and that most systems acquire too many inter-module
dependencies to be sensibly broken apart. That is the whole reason for tooling like Spring
Modulith: "pay attention to modularity" is an aspiration that survives about two sprints of
delivery pressure, while a verification test in CI that fails when one module imports
another's internals is a mechanism.

**★ Is the monolith-first debate settled?**
No, and Fowler says so in the article itself — the position is *"by no means unanimous"* and
the evidence is anecdotal. The strongest counter-argument, made by Stefan Tilkov on
Fowler's own site, is that a monolith's parts become extremely tightly coupled precisely
because in-process integration is so easy, so the promised later extraction is usually
impossible in practice. Both sides agree on the underlying fact that makes the argument
hard: refactoring in the small becomes easier with a monolith, refactoring in the large
becomes much harder.

**★ How does the "prerequisites" clause change the cost calculation?**
It makes monolith-first zero-waste on the platform side. Rapid provisioning, monitoring and
rapid deployment are the three baseline competencies a microservice architecture requires,
and Fowler notes they are capabilities you ought to have for a monolith too. So the
platform work you do during the monolith phase is not sunk cost if you later split, and is
still valuable if you never do — which means the strategy is not "delay the investment", it
is "make the investment in the order where every increment pays off immediately".

{/* FOOTER */}
