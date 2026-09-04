---
title: "02 · Service boundaries"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Eric Evans, *Domain-Driven Design* (Addison-Wesley); Vaughn Vernon, *Implementing Domain-Driven Design* (Addison-Wesley); Sam Newman, *Building Microservices* (2nd ed., O'Reilly) & *Monolith to Microservices* (O'Reilly); Neal Ford & Mark Richards, *Software Architecture: The Hard Parts* (O'Reilly).
> Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**A service boundary is not an arbitrary box on a whiteboard or a network convenience; it is a profound organizational and transactional commitment that everything inside can change independently without cross-team negotiation. Deriving resilient service boundaries requires mapping bounded contexts and ubiquitous language, anchoring cuts to transactional aggregate invariants, enforcing seams in-process with Spring Modulith and ArchUnit, and balancing dark energy against dark matter forces. Getting boundaries wrong yields the distributed monolith; getting them right delivers genuine team autonomy, fault isolation, and independent deployability.**

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[01 · What a boundary is](./01-what-a-boundary-is.md)** | A service boundary is not a line on a diagram, it is a claim that everything on this si... |
| 2 | **[02 · Bounded context](./02-bounded-context.md)** | A bounded context is a region inside which one model and one vocabulary are true, and i... |
| 3 | **[03 · The same word, two meanings](./02b-the-same-word-two-meanings.md)** | When the same noun means different things to two groups of people, you have found a bou... |
| 4 | **[04 · The language tells you](./02c-the-language-tells-you.md)** | Before you draw anything, read your own code out loud |
| 5 | **[05 · Subdomain vs bounded context](./03-subdomain-vs-bounded-context.md)** | A subdomain is a piece of the business, a bounded context is a piece of your solution, ... |
| 6 | **[06 · Core, supporting, generic](./03b-core-supporting-generic.md)** | Classifying each subdomain as core, supporting or generic decides where boundaries are ... |
| 7 | **[07 · A service is not a context](./04-a-service-is-not-a-context.md)** | Everyone repeats that one service equals one bounded context, and the source everyone c... |
| 8 | **[08 · One service, one capability](./05-one-service-one-capability.md)** | The one service, one capability test is the fastest boundary check there is, and it wor... |
| 9 | **[09 · Invariants are the criterion](./06-invariants-are-the-criterion.md)** | Every other criterion for drawing a boundary is advisory; the invariant is the one that... |
| 10 | **[10 · Finding the invariants](./07-finding-the-invariants.md)** | Nobody hands you a list of invariants, so you have to extract them |
| 11 | **[11 · False invariants](./07b-false-invariants.md)** | Half the rules that look like invariants are constraints nobody in the business ever as... |
| 12 | **[12 · Whose job is it?](./08-whose-job-is-it.md)** | The single best tie-breaker in boundary design is not technical at all: ask whether it ... |
| 13 | **[13 · The answer, in code](./08b-the-answer-in-code.md)** | Once you know whose job it is, the answer lands in Java as one of exactly two shapes |
| 14 | **[14 · The transaction boundary](./09-the-transaction-boundary.md)** | The transaction boundary is the hard floor under every service boundary: whatever must ... |
| 15 | **[15 · Finding it in the code](./09b-finding-it-in-the-code.md)** | You can extract the whole transaction map from a Spring codebase mechanically, and then... |
| 16 | **[16 · Who owns the data](./10-who-owns-the-data.md)** | Ownership of a piece of data belongs to whoever enforces the rules about it, not to who... |
| 17 | **[17 · The ownership register](./10b-the-ownership-register.md)** | Write the ownership register down as a table of facts, rules and owners, because every ... |
| 18 | **[18 · Reasons to break the rule](./11-reasons-to-break-the-rule.md)** | One aggregate per transaction is a rule of thumb and its author says so, listing four s... |
| 19 | **[19 · Splitting by layer](./12-splitting-by-layer.md)** | Splitting by technical layer produces services that cannot change alone, because a busi... |
| 20 | **[20 · Entity services](./13-entity-services.md)** | A service per entity looks like the most obvious decomposition available and Michael Ny... |
| 21 | **[21 · CRUD is not a capability](./13b-crud-is-not-a-capability.md)** | The shape of a service's API is the most reliable public evidence about whether its bou... |
| 22 | **[22 · Conway and the org chart](./14-conway-and-the-org-chart.md)** | Conway's law is not advice, it is an observation that your architecture will end up mat... |
| 23 | **[23 · Too small](./15-too-small.md)** | Every service carries a fixed cost that is independent of how much code is in it, so a ... |
| 24 | **[24 · The shared model jar](./16-the-shared-model-jar.md)** | A common-domain jar cancels every service boundary in the system at compile time, becau... |
| 25 | **[25 · The god service](./17-the-god-service.md)** | The orchestrator that owns no data and calls everything is not a coordination layer, it... |
| 26 | **[26 · Boundaries from a whiteboard](./18-boundaries-from-a-whiteboard.md)** | A greenfield boundary is a guess about a domain nobody understands yet, and the honest ... |
| 27 | **[27 · Change history as evidence](./19-change-history-as-evidence.md)** | Your version control history is the only record of what actually changes together, whic... |
| 28 | **[28 · Reading the co-change matrix](./19b-reading-the-co-change-matrix.md)** | The co-change matrix has about six recognisable shapes, and the same technique run acro... |
| 29 | **[29 · Event storming](./20-event-storming.md)** | Event storming is the fastest way to get a room's model of a domain onto a wall, and it... |
| 30 | **[30 · System operations first](./21-system-operations-first.md)** | Start from what the system can be asked to do, never from what it stores |
| 31 | **[31 · The ten forces](./22-the-ten-forces.md)** | Chris Richardson's ten forces are the only decomposition framework that names the argum... |
| 32 | **[32 · Scoring one cut](./22b-scoring-one-cut.md)** | A boundary decision worked end to end, including the one that gets rejected |
| 33 | **[33 · The monolith already told you](./23-the-monolith-already-told-you.md)** | A monolith that has been running for five years has already discovered most of its own ... |
| 34 | **[34 · Package structure is the boundary](./24-package-structure-is-the-boundary.md)** | A service boundary is a package tree before it is a network hop |
| 35 | **[35 · Verifying the boundary](./25-verifying-the-boundary.md)** | Boundary verification is a CI gate that turns architectural intent into an automated bu... |
| 36 | **[36 · Named interfaces](./25b-named-interfaces.md)** | A single public API per module is a naive assumption |
| 37 | **[37 · ArchUnit rules](./26-archunit-rules.md)** | ArchUnit enforces service boundaries without requiring Spring Modulith |
| 38 | **[38 · Build modules and JPMS](./27-build-modules-and-jpms.md)** | Multi-module builds and JPMS module-info.java enforce boundaries at compile time |
| 39 | **[39 · Published language vs aggregate](./28-published-language-vs-aggregate.md)** | The published language is an explicit public contract while the aggregate is a private ... |
| 40 | **[40 · Never publish the aggregate](./28b-never-publish-the-aggregate.md)** | Serialising the domain entity directly into JSON or Kafka payloads turns database schem... |
| 41 | **[41 · Anticorruption layer](./29-anticorruption-layer.md)** | An Anticorruption Layer isolates a pure domain model from an unruly external service |
| 42 | **[42 · Where the ACL lives](./29b-where-the-acl-lives.md)** | An Anticorruption Layer belongs inside the downstream service that depends on it, never... |
| 43 | **[43 · Context mapping](./30-context-mapping.md)** | A Context Map records the political and technical relationships between bounded contexts |
| 44 | **[44 · Customer-supplier](./31-customer-supplier.md)** | In a Customer-Supplier relationship, the downstream customer has genuine leverage over ... |
| 45 | **[45 · Conformist](./32-conformist.md)** | In a Conformist relationship, the downstream team eliminates translation by adopting th... |
| 46 | **[46 · Shared kernel](./33-shared-kernel.md)** | A Shared Kernel is an explicit, co-owned subset of domain code and schema shared betwee... |
| 47 | **[47 · Open host and published language](./34-open-host-and-published-language.md)** | An Open Host Service exposes a standardized, public protocol that enables dozens of dow... |
| 48 | **[48 · Partnership and separate ways](./35-partnership-and-separate-ways.md)** | Partnership and Separate Ways represent the two extremes of context mapping |
| 49 | **[49 · Choosing a relationship](./36-choosing-a-relationship.md)** | Selecting a context mapping pattern is a function of organizational power, domain diffe... |
| 50 | **[50 · The tells of a wrong boundary](./37-the-tells-of-a-wrong-boundary.md)** | A bad service boundary announces itself through concrete operational pathology |
| 51 | **[51 · Merging two services](./38-merging-two-services.md)** | Merging two services is a disciplined engineering migration, not a defeat |
| 52 | **[52 · Moving a capability](./39-moving-a-capability.md)** | Moving an aggregate across service boundaries requires a zero-downtime expand-and-contr... |
| 53 | **[53 · Splitting a service](./40-splitting-a-service.md)** | Splitting a service must be executed in-process first |
| 54 | **[54 · Strangler extraction](./41-strangler-extraction.md)** | The Strangler Fig pattern enables incremental, zero-downtime service extraction from a ... |
| 55 | **[55 · The cost of changing a boundary](./42-the-cost-of-changing-a-boundary.md)** | Redrawing a service boundary incurs severe organizational and technical costs that must... |
| 56 | **[56 · When not to fix it](./43-when-not-to-fix-it.md)** | Living with an imperfect boundary is often the rational economic choice |
| 57 | **[57 · Worked example: operations and aggregates](./44-worked-example-operations-and-aggregates.md)** | Worked example: analyzing business operations, candidate aggregates, and transactional ... |
| 58 | **[58 · Worked example: candidate cuts](./44b-worked-example-candidate-cuts.md)** | Scoring candidate service cuts against dark energy and dark matter forces |
| 59 | **[59 · Worked example: two teams vs twelve](./44c-worked-example-two-teams-and-twelve.md)** | The same domain produces two radically different architectures depending on team topology |
| 60 | **[60 · The checklist](./45-the-checklist.md)** | The Service Boundary Review Checklist: a rigorous architecture rubric for evaluating pr... |

## Phase gate

You are done with this topic when you can:
- Derive bounded contexts from ubiquitous language and polysemic domain terms rather than technical layers or database tables.
- Identify aggregate roots and transactional invariants, ensuring a service boundary never splits an immediate consistency invariant across a network hop.
- Enforce in-process module encapsulation using Java visibility, Spring Modulith 2.1.1 verification, ArchUnit rules, and JPMS.
- Map strategic relationships using the nine Context Mapping patterns (ACL, Shared Kernel, Customer-Supplier, Conformist, OHS/PL, Partnership, Separate Ways).
- Score candidate boundaries objectively against the five Dark Matter and five Dark Energy architectural forces.
- Execute zero-downtime service splits, capability relocations, and service collapses (merges) using Expand-and-Contract and Strangler Fig patterns.

## Where this connects

- [01 · Monolith first](../01-monolith-first/01-the-question-behind-the-question.md) — when and why to build the monolith before splitting
- **03 · Database-per-service** *(not written yet)* — isolating storage schemas, transactions, and data ownership
- **04 · Sync vs async** *(not written yet)* — communication coupling, temporal decoupling, and availability arithmetic

---

Start → [01 · What a boundary is](01-what-a-boundary-is.md)
