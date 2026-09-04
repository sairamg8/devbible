---
title: "A service boundary is a transaction boundary and an ownership boundary before it is a network boundary — every criterion in this topic is advisory except the invariant, which binds"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against Chris Richardson's *Microservices Patterns* site — *Decompose by
> business capability*, *Decompose by subdomain*, *Database per Service*, *Service per team*, the
> *dark energy / dark matter* force pages and the *Assemblage* series, at
> [microservices.io](https://microservices.io); Vaughn Vernon, *Effective Aggregate Design* Parts I
> and II (2011), at [dddcommunity.org](https://www.dddcommunity.org/library/vernon_2011/) (CC BY-ND
> 3.0); Martin Fowler, *BoundedContext*, at
> [martinfowler.com/bliki/BoundedContext.html](https://martinfowler.com/bliki/BoundedContext.html);
> Michael Nygard, *The Entity Service Antipattern* (2017); the ddd-crew *Context Mapping Guide*, at
> [github.com/ddd-crew/context-mapping](https://github.com/ddd-crew/context-mapping), which
> reproduces the *DDD Reference* (2015) pattern definitions verbatim; the Spring Modulith reference
> (*Fundamentals*, *Verification*, *Testing*) and the ArchUnit user guide; *The State of the Module
> System* at [openjdk.org](https://openjdk.org/projects/jigsaw/spec/sotms/); the Gradle
> `java-library` plugin documentation; the Spring Framework reference on `@Transactional`; and Martin
> Fowler's *StranglerFigApplication* and *ParallelChange*. Eric Evans, *Domain-Driven Design*
> (Addison-Wesley, 2003) and Sam Newman's *Building Microservices* / *Monolith to Microservices* are
> cited by chapter as further reading and are **not** independently verifiable here — see *What this
> topic stands on* below.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x
> "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. Documentation-validated; **no sandbox run**.

**A service boundary is not a box on a whiteboard and not a network convenience: it is a claim
that everything inside can change without asking anyone outside. That claim has exactly one hard
constraint — an invariant that must hold transactionally cannot be split across it — and a stack
of soft ones, which is why so much decomposition advice contradicts itself. This topic gives the
one binding criterion, the evidence-gathering techniques that find it, the in-process enforcement
that proves a boundary before it becomes a network hop, the nine relationship patterns for
boundaries you do not control, and the migrations for the boundaries you got wrong.**

## Chunks

Every chunk in this topic is **Master** tier. 🔴 marks the twenty that the rest depend on.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[What a boundary is](01-what-a-boundary-is.md)** | <span className="db-tier t-master">Master</span> | A boundary is a promise about independent change, not a line on a diagram — and the promise is what you are actually testing |
| 2 | **[Bounded context](02-bounded-context.md)** | <span className="db-tier t-master">Master</span> | There is no such thing as "the Customer model"; total unification of a large domain model is not feasible, and pretending otherwise is the root defect |
| 3 | **[The same word, two meanings](02b-the-same-word-two-meanings.md)** | <span className="db-tier t-master">Master</span> | Polysemy is the cheapest boundary detector there is: when one noun means different things to two groups, you have found the seam |
| 4 | **[The language tells you](02c-the-language-tells-you.md)** | <span className="db-tier t-master">Master</span> | Read your own code out loud before booking the workshop — the vocabulary already disagrees with itself in named places |
| 5 | **[Subdomain vs bounded context](03-subdomain-vs-bounded-context.md)** | <span className="db-tier t-master">Master</span> | A subdomain is a piece of the business; a bounded context is a piece of your solution. Used interchangeably everywhere, and the confusion produces boundaries drawn on the wrong axis |
| 6 | **[Core, supporting, generic](03b-core-supporting-generic.md)** | <span className="db-tier t-master">Master</span> | The classification decides where boundaries are worth paying for — you buy generic, you tolerate supporting, you invest only in core |
| 7 | **[A service is not a context](04-a-service-is-not-a-context.md)** | <span className="db-tier t-master">Master</span> | 🔴 "One service = one bounded context" is folklore, and the source everyone cites says the opposite: the mapping is a partition in one direction only |
| 8 | **[One service, one capability](05-one-service-one-capability.md)** | <span className="db-tier t-master">Master</span> | The fastest boundary check there is, and the precise conditions under which it gives the wrong answer |
| 9 | **[Invariants are the criterion](06-invariants-are-the-criterion.md)** | <span className="db-tier t-master">Master</span> | 🔴 Team size, org chart, change rate, capability — every other criterion is advisory. The transactional invariant is the only one that binds |
| 10 | **[Finding the invariants](07-finding-the-invariants.md)** | <span className="db-tier t-master">Master</span> | Nobody hands you the list; it is extracted from system operations, and the extraction is the highest-value artefact in the exercise |
| 11 | **[False invariants](07b-false-invariants.md)** | <span className="db-tier t-master">Master</span> | Half the rules that look like invariants are constraints nobody ever asked for — and a fake invariant is the most expensive mistake in the topic |
| 12 | **[Whose job is it?](08-whose-job-is-it.md)** | <span className="db-tier t-master">Master</span> | 🔴 The best tie-breaker is not technical: ask whether it is the job of the user executing this operation to make the other side consistent |
| 13 | **[The answer, in code](08b-the-answer-in-code.md)** | <span className="db-tier t-master">Master</span> | The tie-breaker's two answers land in Java as exactly two shapes — one transaction, or one event |
| 14 | **[The transaction boundary](09-the-transaction-boundary.md)** | <span className="db-tier t-master">Master</span> | 🔴 The hard floor: whatever must commit together must live together. No exception, no mitigation, no framework |
| 15 | **[Finding it in the code](09b-finding-it-in-the-code.md)** | <span className="db-tier t-master">Master</span> | The whole transaction map is extractable from a Spring codebase mechanically — `@Transactional` is a boundary declaration you already wrote |
| 16 | **[Who owns the data](10-who-owns-the-data.md)** | <span className="db-tier t-master">Master</span> | Ownership belongs to whoever enforces the rules about the data, not to whoever reads it most or stores it |
| 17 | **[The ownership register](10b-the-ownership-register.md)** | <span className="db-tier t-master">Master</span> | Write it down as facts, rules and owners — the argument recurs on every project and the table is what ends it |
| 18 | **[Reasons to break the rule](11-reasons-to-break-the-rule.md)** | <span className="db-tier t-master">Master</span> | One aggregate per transaction is a rule of thumb and Vernon says so, naming four sanctioned exceptions and closing the list |
| 19 | **[Splitting by layer](12-splitting-by-layer.md)** | <span className="db-tier t-master">Master</span> | The layered split is the first one teams reach for and it produces services that cannot change alone, because a business change crosses all of them |
| 20 | **[Why the layering comes back](12b-why-the-layering-comes-back.md)** | <span className="db-tier t-master">Master</span> | 🔴 Teams who know every argument still ship layered services, because the design is a copy of the communication structure — and re-drawing the services without re-drawing the teams reverts |
| 21 | **[Entity services](13-entity-services.md)** | <span className="db-tier t-master">Master</span> | `CustomerService`, `OrderService`, `ProductService` — the most obvious decomposition available, and Nygard named it an antipattern for reasons that are mechanical, not stylistic |
| 22 | **[CRUD is not a capability](13b-crud-is-not-a-capability.md)** | <span className="db-tier t-master">Master</span> | You can judge a boundary from the API alone: `PUT /orders/{id}` publishes that the service owns no rules |
| 23 | **[What to build instead](13c-what-to-build-instead.md)** | <span className="db-tier t-master">Master</span> | Nygard names the disease and explicitly leaves the cure to a later post; the two answers teams reach for first — bigger entity services, renamed ones — both preserve what made it wrong |
| 24 | **[Migrating a public CRUD API](13d-migrating-a-public-crud-api.md)** | <span className="db-tier t-master">Master</span> | 🔴 The callers are already performing intents with no vocabulary for them, so the operations the API should have offered are recoverable from its traffic |
| 25 | **[Conway and the org chart](14-conway-and-the-org-chart.md)** | <span className="db-tier t-master">Master</span> | Conway's 1968 paper is an observation, not advice — your architecture will match your communication structure whether or not you designed it to |
| 26 | **[One team per service](14b-one-team-per-service.md)** | <span className="db-tier t-master">Master</span> | An ownership rule quoted as a sizing ratio — the binding word is *sole*, and the constraint that arrives first is cognitive capacity, not headcount |
| 27 | **[Too small](15-too-small.md)** | <span className="db-tier t-master">Master</span> | Every service carries a fixed cost independent of the code in it; intuition about size consistently omits exactly that cost |
| 28 | **[The module is the alternative](15b-the-module-is-the-alternative.md)** | <span className="db-tier t-master">Master</span> | The answer to a service that is too small is not a bigger service: an enforced module gives you the boundary, the API and the ownership for none of the fixed costs |
| 29 | **[The shared model jar](16-the-shared-model-jar.md)** | <span className="db-tier t-master">Master</span> | 🔴 A common-domain jar cancels every boundary in the system at compile time — the one mistake that undoes all the others |
| 30 | **[What version skew does at runtime](16b-what-version-skew-does-at-runtime.md)** | <span className="db-tier t-master">Master</span> | 🔴 The argument that wins the room — five production failures from one shared jar, none caught at build time, and the worst happens inside a single deployable |
| 31 | **[The god service](17-the-god-service.md)** | <span className="db-tier t-master">Master</span> | The orchestrator that owns no data and calls everything arrives as a fix and is a boundary failure wearing a coordination costume |
| 32 | **[Composing is not deciding](17b-composing-is-not-deciding.md)** | <span className="db-tier t-master">Master</span> | Every system calls several services, so that cannot be the diagnostic — the line is assemble versus decide, and one deletion test separates them |
| 33 | **[Boundaries from a whiteboard](18-boundaries-from-a-whiteboard.md)** | <span className="db-tier t-master">Master</span> | Greenfield boundaries are guesses about a domain nobody understands yet; the honest move is to say so and defer the network hop |
| 34 | **[Change history as evidence](19-change-history-as-evidence.md)** | <span className="db-tier t-master">Master</span> | Version control is the only record of what actually changes together — runnable `git log` pipelines, no output reproduced |
| 35 | **[Reading the co-change matrix](19b-reading-the-co-change-matrix.md)** | <span className="db-tier t-master">Master</span> | The matrix has about six recognisable shapes, and each one names a different boundary defect |
| 36 | **[When a cell means nothing](19c-when-a-cell-means-nothing.md)** | <span className="db-tier t-master">Master</span> | 🔴 A ratio without its support invites the wrong decision, and co-change has four causes of which only one is a boundary finding |
| 37 | **[Event storming](20-event-storming.md)** | <span className="db-tier t-master">Master</span> | Gets a domain onto a wall in hours, in the one currency boundaries are actually made of: events, not entities |
| 38 | **[System operations first](21-system-operations-first.md)** | <span className="db-tier t-master">Master</span> | Start from what the system can be asked to do, never from what it stores — the single procedural change that most improves a decomposition |
| 39 | **[The ten forces](22-the-ten-forces.md)** | <span className="db-tier t-master">Master</span> | 🔴 Richardson's dark energy / dark matter is the only framework that names the arguments *against* splitting alongside the arguments for |
| 40 | **[Scoring one cut](22b-scoring-one-cut.md)** | <span className="db-tier t-master">Master</span> | A boundary decision worked end to end — including the candidate that scores badly and gets rejected |
| 41 | **[Proposal C, do nothing](22c-proposal-c-do-nothing.md)** | <span className="db-tier t-master">Master</span> | The option nobody writes up, scored properly — it wins every dark-matter force by construction, which makes it the baseline the others must beat |
| 42 | **[The monolith already told you](23-the-monolith-already-told-you.md)** | <span className="db-tier t-master">Master</span> | A monolith that has run for five years has already discovered most of its own seams; the evidence is in the repo, not the workshop |
| 43 | **[Package structure is the boundary](24-package-structure-is-the-boundary.md)** | <span className="db-tier t-master">Master</span> | A Java package is an encapsulation mechanism, not a folder — the boundary exists in the package tree before it exists on the network |
| 44 | **[When one flat package is not enough](24b-when-one-flat-package-is-not-enough.md)** | <span className="db-tier t-master">Master</span> | 🔴 javac's protection stops at one flat package, Spring Modulith inverts the sub-package rule, and JPMS is the only mechanism under which `public` means "public to my module" |
| 45 | **[Verifying the boundary](25-verifying-the-boundary.md)** | <span className="db-tier t-master">Master</span> | A drawn boundary is a hypothesis; `ApplicationModules.of(...).verify()` turns it into a CI gate that fails the build |
| 46 | **[Named interfaces](25b-named-interfaces.md)** | <span className="db-tier t-master">Master</span> | One public API per module is a naive assumption — Modulith `@NamedInterface` exposes different contracts to different consumers without opening the module |
| 47 | **[Can the module boot alone?](25c-can-the-module-boot-alone.md)** | <span className="db-tier t-master">Master</span> | 🔴 The question `verify()` never asks. The bootstrap mode you settle for is the finding, and the mock count is the honest coupling metric — the docs say so themselves |
| 48 | **[ArchUnit rules](26-archunit-rules.md)** | <span className="db-tier t-master">Master</span> | Boundary enforcement without Spring Modulith: bytecode-level rules for non-Spring and legacy codebases, including slice cycle detection |
| 49 | **[Making the rules stick](26b-making-the-rules-stick.md)** | <span className="db-tier t-master">Master</span> | A rule that cannot go green on day one gets deleted: `FreezingArchRule` with a baseline that can only shrink, and the default that refuses to pass a rule matching nothing |
| 50 | **[Build modules and JPMS](27-build-modules-and-jpms.md)** | <span className="db-tier t-master">Master</span> | Compiler-enforced boundaries that fail before a test runs — Maven/Gradle module scoping and `module-info.java` |
| 51 | **[Published language vs aggregate](28-published-language-vs-aggregate.md)** | <span className="db-tier t-master">Master</span> | The published language is a public contract; the aggregate is a private consistency device. Conflating them is how schemas leak |
| 52 | **[Never publish the aggregate](28b-never-publish-the-aggregate.md)** | <span className="db-tier t-master">Master</span> | Serialising a domain entity straight to JSON or Kafka turns your database schema into everybody else's compile-time dependency |
| 53 | **[Changing a published contract](28c-changing-a-published-contract.md)** | <span className="db-tier t-master">Master</span> | 🔴 The two changes that break consumers with no schema diff at all — tightening validation, and repurposing a field — plus expand/migrate/contract, whose skipped phase is the middle one |
| 54 | **[The event has a longer half-life](28d-the-event-has-a-longer-half-life.md)** | <span className="db-tier t-master">Master</span> | An HTTP response is discarded; an event is stored in other teams' databases, where no deployment of yours reaches it. Why a topic cannot be versioned like an endpoint |
| 55 | **[Anticorruption layer](29-anticorruption-layer.md)** | <span className="db-tier t-master">Master</span> | The isolating layer that gives you upstream functionality in *your* domain's terms — the pattern for boundaries you do not control |
| 56 | **[Where the ACL lives](29b-where-the-acl-lives.md)** | <span className="db-tier t-master">Master</span> | An ACL belongs inside the downstream deployable. Extracted into a shared proxy it is an ESB with a new name, and an orphan with no domain owner |
| 57 | **[Mapper or barrier](29c-mapper-or-barrier.md)** | <span className="db-tier t-master">Master</span> | Most ACLs are field-for-field mappers wearing the name — the three questions that tell them apart, and the default branch that decides whether the layer holds |
| 58 | **[Context mapping](30-context-mapping.md)** | <span className="db-tier t-master">Master</span> | The Context Map records political relationships, not just technical ones — leverage between teams is an architectural input |
| 59 | **[Customer-supplier](31-customer-supplier.md)** | <span className="db-tier t-master">Master</span> | Only real when downstream has genuine authority: downstream priorities factor into upstream planning, or it is not this pattern |
| 60 | **[Conformist](32-conformist.md)** | <span className="db-tier t-master">Master</span> | *Slavishly* adhering to the upstream model — giving up the right to disagree, deliberately, to make translation cost zero |
| 61 | **[Shared kernel](33-shared-kernel.md)** | <span className="db-tier t-master">Master</span> | An explicitly co-owned, deliberately small subset — and the four rules that stop it becoming the shared model jar of chunk 24 |
| 62 | **[Open host and published language](34-open-host-and-published-language.md)** | <span className="db-tier t-master">Master</span> | One documented protocol for all comers, instead of a bespoke endpoint per consumer and the combinatorial explosion that follows |
| 63 | **[Partnership and separate ways](35-partnership-and-separate-ways.md)** | <span className="db-tier t-master">Master</span> | The two poles of coupling — and 🔴 Partnership is a *DDD Reference* (2015) pattern, not a 2003 book pattern, however it is usually cited |
| 64 | **[Choosing a relationship](36-choosing-a-relationship.md)** | <span className="db-tier t-master">Master</span> | Selection is a function of organizational power and domain differentiation; an ACL where Conformist belonged is months of wasted mapping code |
| 65 | **[The tells of a wrong boundary](37-the-tells-of-a-wrong-boundary.md)** | <span className="db-tier t-master">Master</span> | A bad boundary announces itself: latency amplification, availability multiplied down, lockstep releases, and distributed debugging |
| 66 | **[Merging two services](38-merging-two-services.md)** | <span className="db-tier t-master">Master</span> | Collapsing two services is a disciplined migration, not an admission of defeat — and sunk cost is not an architectural argument |
| 67 | **[Moving a capability](39-moving-a-capability.md)** | <span className="db-tier t-master">Master</span> | Relocating an aggregate across a boundary with expand-and-contract, dual-write, parity verification, then contract |
| 68 | **[Splitting a service](40-splitting-a-service.md)** | <span className="db-tier t-master">Master</span> | 🔴 Split in-process first. If the boundary cannot survive as a module, it will not survive as a network hop — it will just fail more expensively |
| 69 | **[Ready to extract](40b-ready-to-extract.md)** | <span className="db-tier t-master">Master</span> | 🔴 Four checks instead of a feeling, two of them conclusive — and the four in-process guarantees that stop holding across a network and quietly break correct code |
| 70 | **[Strangler extraction](41-strangler-extraction.md)** | <span className="db-tier t-master">Master</span> | Fowler's Strangler Fig: intercept at the gateway, extract one capability, move traffic route by route, retire the legacy path |
| 71 | **[The cost of changing a boundary](42-the-cost-of-changing-a-boundary.md)** | <span className="db-tier t-master">Master</span> | Six concrete costs — data parity, consumer churn, observability rewiring, infrastructure, ownership, and the dual-run tax |
| 72 | **[When not to fix it](43-when-not-to-fix-it.md)** | <span className="db-tier t-master">Master</span> | Living with a wrong boundary is often the rational choice; containment patterns buy you the option to never pay for the migration |
| 73 | **[Worked example: operations and aggregates](44-worked-example-operations-and-aggregates.md)** | <span className="db-tier t-master">Master</span> | One domain taken from system operations to candidate aggregates to transactional invariants |
| 74 | **[Worked example: candidate cuts](44b-worked-example-candidate-cuts.md)** | <span className="db-tier t-master">Master</span> | The same domain scored against the ten forces, cut by cut, with the rejections shown |
| 75 | **[Worked example: two teams vs twelve](44c-worked-example-two-teams-and-twelve.md)** | <span className="db-tier t-master">Master</span> | The same domain produces two different correct architectures depending on team topology — the clearest demonstration that Conway is an input |
| 76 | **[The checklist](45-the-checklist.md)** | <span className="db-tier t-master">Master</span> | The review rubric to run against a proposed boundary before it becomes an irreversible operational commitment |

## Phase gate

You are done with this topic when you can:

- Derive bounded contexts from ubiquitous language and polysemic terms rather than from technical
  layers or database tables, and say why a subdomain and a bounded context are not the same object.
- State the one binding criterion from memory, name the four sanctioned reasons for breaking the
  one-aggregate-per-transaction rule, and recognise a false invariant before it costs you a service.
- Extract the transaction map and the co-change matrix from an existing Spring codebase, and read
  the six shapes the matrix comes in.
- Enforce a boundary in-process — Java package visibility, Spring Modulith `verify()` and
  `@NamedInterface`, ArchUnit slice rules, Maven/Gradle module scoping, JPMS — so that a violation
  fails the build rather than a code review.
- Choose the right context-mapping relationship from organizational leverage and domain
  differentiation, and say which source each pattern actually comes from.
- Score a candidate cut against the five dark-energy and five dark-matter forces, including the cut
  you decide to reject.
- Execute a merge, a capability move, a split and a strangler extraction with expand-and-contract
  and parity verification, and price the migration honestly before starting it.

## What this topic stands on

**Every chunk in this topic is built on a source that can be fetched and checked**, and the ones that
carry a verbatim quotation cite the URL it came from on their own `> Verified:` line. The sources are
microservices.io, Vernon's *Effective Aggregate Design* (CC BY-ND), Fowler's bliki
(*BoundedContext*, *StranglerFigApplication*, *ParallelChange*), Nygard's *Entity Service
Antipattern*, the ddd-crew *Context Mapping Guide*, the Spring Modulith and Spring Framework
references, the ArchUnit user guide, *The State of the Module System*, and the Gradle `java-library`
documentation.

🔴 **Every context-mapping pattern definition on these pages is the *DDD Reference* (2015) text**, as
reproduced verbatim by the ddd-crew guide — not a paraphrase, and not the 2003 book, which does not
contain Partnership or Big Ball of Mud at all. Evans, Newman, and Ford & Richards appear as further
reading; nothing is quoted from them, because a book chapter cannot be checked from here.

**Where a claim could not be settled, the page says so on the page** rather than asserting it. Three
worth knowing about before you rely on them:

- **Fowler's *StranglerFigApplication* does not discuss event interception or asset capture**, and the
  microservices.io *Strangler Application* page specifies **no** routing, glue-code or
  data-replication mechanics. Everything [41 · Strangler extraction](41-strangler-extraction.md) says
  about gateways and dual-run is engineering practice built on the pattern, and it is labelled as
  such rather than attributed to either source.
- **The ArchUnit user guide documents no `beRecords()` predicate**, so
  [26 · ArchUnit rules](26-archunit-rules.md) expresses shape rules as prohibitions and says why.
- **The Spring Modulith reference pages are served unversioned**, so they are cited as "the Spring
  Modulith reference" rather than as version-stamped 2.1.1 pages.

**Both depth passes are complete.** Chunks 34–67 were reworked first, then the head band 12–23 that
the first pass had disclosed as outstanding. No run of identical gotcha and question counts survives
in either band.

## Where this connects

- [01 · Monolith first](../01-monolith-first/01-the-question-behind-the-question.md) — when and
  why to build the monolith before splitting it at all.
- **03 · Database-per-service** *(not written yet)* — the data half of every boundary this topic
  draws: schema isolation, ownership and the queries that used to be joins.
- **04 · Sync vs async** *(not written yet)* — once the boundary exists, the coupling decision
  across it, and the availability arithmetic chunk 50 only gestures at.
- **12 · The distributed monolith** *(not written yet)* — what you get when every chunk here is
  ignored at once.

---

Start → [01 · What a boundary is](01-what-a-boundary-is.md)
