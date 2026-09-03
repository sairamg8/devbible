---
title: "The strongest argument against monolith-first is that in-process integration is so convenient that the parts become inseparable long before anyone tries to separate them — and both sides of the debate agree that this is what happens"
sidebar_label: "03b · The honest counterargument"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Stefan Tilkov, *Don't start with a monolith*, 9 June 2015
> ([martinfowler.com](https://martinfowler.com/articles/dont-start-monolith.html)); Martin
> Fowler, *Monolith First*
> ([martinfowler.com](https://martinfowler.com/bliki/MonolithFirst.html)); Sam Newman as
> quoted therein.
> Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Modulith 2.1.1. **No sandbox.**

**A reference page that only gives you the argument it agrees with has taught you a slogan,
not a decision. The counterargument to monolith-first is good, it was published on Fowler's
own site with his encouragement, and its central claim is one Fowler does not actually
dispute: monoliths become tightly coupled precisely because in-process integration is
frictionless. Everything in the second half of this topic — module verification, enforced
API packages, event-based integration — exists to answer this specific objection.**

## The claim

Tilkov's opening position:

> *"I'm firmly convinced that starting with a monolith is usually exactly the wrong thing
> to do."*
>
> *"Starting to build a new system is exactly the time when you should be thinking about
> carving it up into pieces."*

And the argument's core, which deserves to be read slowly:

> *"But if you start with a monolith, the parts will become extremely tightly coupled to
> each other. That's the very definition of a monolith. The parts will rely on features of
> the platform they all use. They'll communicate based on abstractions that are shared
> because they all use the same libraries. They'll communicate using means that are only
> available when they are hosted in the same process. And these are only the technical
> aspects! Far worse than that, the parts will (almost) freely share domain objects, rely on
> the same, shared persistence model, assume database transactions are readily available so
> that there's no need for compensation … Even the very fact that it's easy to refactor
> things and move them around – all in the convenience of your IDE's view of a single project
> – is what makes it extremely hard to cut things apart again. It's extremely hard to split
> up an existing monolith into separate pieces."*

That paragraph is a checklist of exactly what a modular monolith must prevent. Map each
clause onto the mechanism that answers it:

| Tilkov's coupling mechanism | What answers it in Spring Modulith |
|---|---|
| *"communicate based on abstractions that are shared because they all use the same libraries"* | Module-internal packages are unreachable; the module's API is its base package. [29 · API and internal packages](11c-api-and-internal-packages.md) |
| *"communicate using means that are only available when they are hosted in the same process"* | Prefer application events to bean references. **45 · Events instead of bean references** *(not written yet)* |
| *"freely share domain objects"* | `ApplicationModules.verify()` rejects references into another module's internals. [35 · Verifying the arrangement](12-verifying-the-arrangement.md) |
| *"rely on the same, shared persistence model"* | Nothing in Modulith prevents this — see the honest gap list, **55** *(not written yet)*, and [38 · What verification cannot see](12d-what-verification-cannot-see.md) |
| *"assume database transactions are readily available so that there's no need for compensation"* | Not prevented either — this is the real, unclosed gap |
| *"easy to refactor things and move them around"* | This one is a **feature** during the phase where boundaries are still being learned |

Two rows have no answer. Be honest about them; they are the reason extraction is still
work and not a button.

## The Simon Brown inversion, and why it cuts both ways

Tilkov opens by paraphrasing Simon Brown:

> *"If you can't build a well-structured monolith, what makes you think you can build a
> well-structured set of microservices?"*

And then makes the inversion that is the sharpest sentence in the piece:

> *"If you are actually able to build a well-structured monolith, you probably don't need
> microservices in the first place. Which is OK!"*

This is a genuine dilemma and you should sit with it rather than resolve it cheaply. If
your team has the discipline to keep module boundaries clean, that discipline would also
have kept service boundaries clean — and you would not have needed the network to enforce
them. If your team lacks that discipline, splitting does not grant it; it converts sloppy
coupling into sloppy *distributed* coupling, which is worse.

**The resolution this topic proposes is that discipline is the wrong variable.** Neither
horn of the dilemma survives if the boundary is enforced by a build failure rather than by
a person's judgement in a code review at 6pm on a Friday. That is not a rhetorical dodge;
it is a change in the mechanism. Fowler's 2015 unease — *"I'd feel much more comfortable
with this approach if I'd heard a decent number of stories where it worked out that way"* —
was written when the only available mechanism was discipline. `ApplicationModules.of(…).verify()`
is a different kind of thing.

## Newman's position, and Tilkov's disagreement with it

Tilkov quotes Sam Newman making the brownfield argument:

> *"I remain convinced that it is much easier to partition an existing, 'brownfield' system
> than to do so up front with a new, greenfield system. You have more to work with. You have
> code you can examine, you can speak to people who use and maintain the system. You also
> know what 'good' looks like — you have a working system to change, making it easier for you
> to know when you may have got something wrong or been too aggressive in your decision
> making process."*
>
> *"— Sam Newman"*

Tilkov's response:

> *"In the majority of cases, it will be awfully hard, if not outright impossible, to cut up
> an existing monolith this way."*

But note where they converge, because the converged position is the one you should
actually hold:

> *"There is some common ground in that I agree you should know the domain you're building a
> system for very well before trying to partition it, though: In my view, the ideal scenario
> is one where you're building a second version of an existing system."*

**Both sides agree the requirement is domain knowledge.** They disagree only about where it
comes from: Newman says from operating the monolith, Tilkov says from having already built
the previous system. If you are genuinely on version two of a system you operated, Tilkov's
position is strong and starting distributed is defensible. If you are on version one, both
positions reduce to "you do not know the boundaries yet".

## What Tilkov says microservices are actually for

This is the clearest statement of the benefit anywhere in the literature and it is worth
memorising:

> *"There are many, but to me the most important one is to allow for fast, independent
> delivery of individual parts within a larger system. Microservices' main benefit, in my
> view, is enabling parallel development by establishing a hard-to-cross boundary between
> different parts of your system. By doing this, you make it hard – or at least harder – to
> do the wrong thing: Namely, connecting parts that shouldn't be connected, and coupling
> those that need to be connected too tightly. In theory, you don't need microservices for
> this if you simply have the discipline to follow clear rules and establish clear
> boundaries within your monolithic application; in practice, I've found this to be the case
> only very rarely."*

Read the last sentence as a **testable prediction**, because that is what it is: *in
practice, discipline alone rarely holds boundaries.* Tilkov is right about that, and the
whole answer of this topic is that discipline is not the only in-process option available
in 2026. A network boundary is a hard-to-cross boundary. So is a failing build.

He also concedes the sizing point, which matters for how you read his advice:

> *"Of course you should only do this if you believe your system is large enough to warrant
> this. If it's just you and one of your co-workers building something over the course of a
> few weeks, it's entirely possible that you don't."*

And that what he is advocating is larger-grained than a microservice:

> *"provided you tolerate the fact that what I'm talking about is more likely bigger than
> your typical microservice"*

## The point where both sides agree, and it is the important one

> *"If you decide to build things using a microservices approach, you need to be aware that
> while it will be a lot easier to make localized decisions in each individual part, it will
> be much harder to change the very boundaries that enable this. Refactoring in the small
> becomes easier, refactoring in the large becomes much harder."*

Fowler's version of the same fact is *"Any refactoring of functionality between services is
much harder than it is in a monolith."* The two men disagree about the conclusion and agree
about the fact. **The fact is what you should take into your design review**: you are
choosing which kind of change you want to be cheap.

And Tilkov's closing warning applies to his own argument as much as to Fowler's:

> *"Beware of architectural recipes that are too simple and too obvious. This one – start by
> carving up your domain into separate, independent parts – is no exception. Sometimes a
> monolith is preferable, sometime it's not."*

## When starting distributed is the right call

Synthesising both articles, the defensible cases are narrow and specific:

1. **You are building version two of a system you operated.** Tilkov's own stated ideal
   scenario. The boundaries are not guesses; you have watched them.
2. **The organisation is already several autonomous teams and will not be reorganised.**
   Conway's law says you will get a distributed system whether you design one or not; better
   to design it.
3. **A subdomain has a hard non-functional requirement no shared process can meet** — a
   different language runtime, a regulatory isolation boundary, a data-residency
   requirement, a wildly different availability tier. [21 · What genuinely does not
   work](10-what-genuinely-does-not-work.md).
4. **The team has built a microservice system before.** Fowler's own concession: *"I feel
   that you shouldn't start with microservices unless you have reasonable experience of
   building a microservices system in the team."*
5. **You are replacing a system.** Fowler again: *"This is especially viable for system
   replacements where you have a better chance of coming up with stable-enough boundaries
   early."*

Absent one of those five, the prior is monolith-first with enforced modules.

## Gotchas

**★ The counterargument's core claim is empirically right, and pretending otherwise makes
you unpersuasive.** In-process integration *is* frictionless, and unenforced module
boundaries *do* erode. If you argue for the modular monolith without naming a mechanism —
a verification test in CI, from day one — you are arguing for the thing Tilkov correctly
says almost never works.

**★ Two of Tilkov's coupling mechanisms have no answer in any module framework: the shared
persistence model and the assumption that transactions are available.** Spring Modulith
verifies *type* references, not SQL, not table access, not `JOIN`s across module tables.
A module can query another module's table and every verification will pass. If you intend
to extract later, you must impose data ownership by convention and review — see
[38 · What verification cannot see](12d-what-verification-cannot-see.md) and
**03 · Database-per-service** *(not written yet)*.

**★ The Simon Brown dilemma is only a dilemma if discipline is the mechanism.** "If you
could build a well-structured monolith you would not need microservices" is unanswerable
when the only tool is willpower, and dissolves when the tool is a build failure. This is
the single most useful reframing in the whole debate, and it is the reason Spring Modulith
exists at all.

**★ Tilkov is arguing for something larger than microservices, and readers routinely miss
it.** He says explicitly that what he advocates is *"more likely bigger than your typical
microservice"* — self-contained systems, on the order of a handful of large deployables.
Citing him as support for a seven-service split of a small application misrepresents him.

**★ "Build version two as microservices" only counts if you actually operated version
one.** The defensible case is domain knowledge acquired from running a system, not from
reading a specification or interviewing users. A greenfield rewrite of somebody else's
system, by a team that never carried its pager, is a greenfield project wearing a rewrite's
clothes.

**★ Both articles were written in June 2015 and neither has a later revision resolving the
disagreement.** Treat the debate as open. What has changed since is the tooling: enforced
in-process modularity is a product now rather than an aspiration, which strengthens the
monolith-first side on exactly the axis where it was weakest.

## Interview questions

**★ What is the strongest argument against starting with a monolith?**
That in-process integration is so convenient it produces coupling faster than any team can
review it away. Tilkov's enumeration is the precise version: parts come to rely on shared
platform features, communicate through abstractions shared because everyone uses the same
libraries, use integration mechanisms that only exist in one process, freely share domain
objects, share a persistence model, and assume ambient database transactions so nobody ever
writes compensation logic. The ease of refactoring — normally an advantage — is itself part
of the mechanism, because it means nothing ever forces a boundary to be respected.

**★ How do you answer the objection "if you could build a well-structured monolith you
would not need microservices"?**
By changing the mechanism. The objection is sound if module boundaries are held by
discipline, because discipline that reliable would also have kept service boundaries clean.
It stops being sound when the boundary is held by a failing build: `ApplicationModules.of(Application.class).verify()`
in CI rejects references into another module's internal packages on the commit that
introduces them, with no human judgement involved. That is a hard-to-cross boundary in
Tilkov's own sense, and it costs one test class rather than a distributed system.

**★ Name the cases where starting with microservices is defensible.**
Building version two of a system your team actually operated, so the boundaries are
observed rather than guessed. An organisation that is already several autonomous teams and
will not be reorganised, since Conway's law guarantees a distributed result regardless. A
subdomain with a hard non-functional requirement no shared process can satisfy — a
different runtime, a regulatory isolation boundary, data residency, a different availability
tier. A team with prior experience building and operating a microservice system, which
Fowler names as a precondition. And system replacements, which Fowler also concedes have a
better chance of stable-enough boundaries early.

**★ What do Fowler and Tilkov agree on?**
That refactoring in the small becomes easier under microservices and refactoring in the
large becomes much harder — you are choosing which kind of change is cheap. That you should
not introduce distribution without a very good reason. That domain knowledge is the real
prerequisite for drawing boundaries. And that architectural recipes stated as simple rules
should be distrusted, including their own. They differ on where the domain knowledge comes
from: Newman and Fowler say from operating the monolith, Tilkov says from having built the
previous version.

**★ Which of Tilkov's coupling mechanisms does a modular monolith framework fail to
prevent, and what do you do about it?**
Two. The shared persistence model — Spring Modulith verifies type references between
packages, so nothing stops module A's repository from reading module B's table, or a query
from joining across both. And the ambient transaction — `@Transactional` still spans
everything, so nobody is ever forced to write compensation logic. Neither has a framework
answer. The practical mitigations are conventions with teeth: a table-name prefix per
module, a rule that a module's repositories may only touch its own tables enforced in
review or with a custom ArchUnit rule, no foreign keys across module boundaries, and
integrating across modules by application events rather than by shared reads — so the
extraction later is a schema split rather than a rewrite.

{/* FOOTER */}
