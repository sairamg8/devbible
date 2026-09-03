---
title: "Verification is ArchUnit over bytecode, so it sees type references and nothing else — which means the shared database table, the bean looked up by name and the reflective call are all invisible, and those are precisely the couplings that make an extraction impossible"
sidebar_label: "12d · What verification cannot see"
sidebar_position: 38
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Spring Modulith reference, *Verifying Application Module
> Structure*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/verification.html)) and
> *Fundamentals*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/fundamentals.html)); the
> published `spring-modulith-core:2.1.1` POM (`com.tngtech.archunit:archunit:1.4.2`); Stefan
> Tilkov, *Don't start with a monolith*
> ([martinfowler.com](https://martinfowler.com/articles/dont-start-monolith.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Modulith **2.1.1**. **No sandbox.**

**A green `verify()` is worth a lot and it is not what most teams think it is. The engine is
ArchUnit analysing bytecode, so the unit of analysis is a *type reference*. Everything that
couples two modules without one naming the other's type is invisible — and Tilkov's two
strongest objections to the modular monolith, the shared persistence model and the ambient
transaction, are both in that blind spot.**

## The blind spots, in order of how much damage they do

### 1. Shared database tables — the one that blocks extraction

`OrderRepository` in ordering and `ReportingQueries` in reporting can both read the `orders`
table. Neither names a type from the other module. Verification passes. Extraction is now
impossible without a data migration nobody has scoped.

This is Tilkov's objection stated as a mechanism:

> *"the parts will (almost) freely share domain objects, rely on the same, shared persistence
> model, assume database transactions are readily available so that there's no need for
> compensation …"*

**What to do instead**, since the framework will not:

- **Prefix every module's tables** — `ordering_orders`, `inventory_stock_items` — so
  ownership is legible in a `SHOW TABLES` and checkable by a rule.
- **Write the ArchUnit rule.** Entities carry `@Table(name = …)`, so a rule that asserts
  each module's entity table names start with that module's prefix is straightforward, and
  it catches the entity half.
- **No foreign keys across module boundaries.** A FK from `reporting_*` to `ordering_orders`
  is a physical dependency the database will enforce forever. Reference by id, not by
  constraint. **03 · Database-per-service** *(not written yet)* is the full treatment.
- **No cross-module joins in native queries.** This one needs human review; a native query
  is a string and no static analysis you will realistically write parses it.
- **Prefix per-module Flyway migrations** and use Spring Modulith's module-aware Flyway
  support, which physically separates them —
  **52 · Module-aware Flyway** *(not written yet)*.

### 2. Ambient transactions

`@Transactional` on a method in ordering spans the writes of every module reached from it.
Nothing warns you that a single transaction is writing through three modules' repositories,
and that is precisely the invariant an extraction breaks —
[10 · The transaction you lose](04-the-transaction-you-lose.md).

An ArchUnit rule can get part way: assert that no `@Transactional` method in module X calls a
repository type belonging to module Y. It will not catch the transitive case where X calls
Y's *service*, which is `@Transactional(REQUIRES_NEW)`-less and therefore joins the same
transaction. The reliable structural answer is
[31 · Explicit allowed dependencies](11e-explicit-allowed-dependencies.md) plus event-based
integration, which removes the call entirely.

### 3. Reflection and bean lookup by name

```java
// Invisible to verification. There is no type reference at all.
Object bean = applicationContext.getBean("stockLedger");
Class<?> type = Class.forName("com.acme.commerce.inventory.internal.StockLedger");
```

ArchUnit reads bytecode; a class name in a string is not a type reference. Neither call
produces a violation. This is rare enough to be a footnote in most codebases and is worth
knowing about for the one framework-integration corner where somebody did it.

### 4. Configuration properties

Two modules reading `acme.commerce.tax.rate` are coupled — a change to its meaning affects
both — and share no types. Note that the module definition in the reference explicitly counts
configuration properties as part of a module's *required interface*, so the model knows the
concept even though verification does not check the sharing. The Application Module Canvas
surfaces each module's properties, which is the practical mitigation
(**50 · Documenter and the canvas** *(not written yet)*).

### 5. HTTP paths, queue names, cache keys, file paths, scheduler expressions

Any coupling expressed as a **string** is invisible. Two modules writing to the same cache
key, consuming the same queue, or scheduling into the same lock table are coupled and will
verify clean.

### 6. Behavioural and temporal coupling

Module B works only if module A's listener ran first. Module B assumes A's data is present.
Module B breaks when A changes an event's *meaning* while keeping its shape. No structural
analysis detects semantic dependencies — this is what tests are for, and specifically what
module integration tests with the Scenario API are for
(**43 · The Scenario API** *(not written yet)*).

### 7. The size and shape of the API itself

Verification enforces that references target API packages. It does not care whether the API
package has three types or forty, whether those types are entities, or whether the API leaks
internal types through its signatures. A module with a huge API passes every rule and is
unextractable. The metric from
[29 · API and internal packages](11c-api-and-internal-packages.md) — count the public types
in each base package — exists because verification will not do it.

## The honest summary

| Coupling | Verification sees it? | What does |
|---|---|---|
| Import of another module's internal type | **Yes** | `verify()` |
| Bean injection across modules | **Yes** | `verify()` + `allowedDependencies` |
| Module dependency cycle | **Yes** | `verify()` |
| Shared table / cross-module join | No | Naming convention + custom ArchUnit rule + review |
| Cross-module foreign key | No | Migration review |
| Transaction spanning modules | No | Design discipline + events |
| Bean by name / reflection | No | Review |
| Shared configuration property | No | The canvas + review |
| Shared queue, cache key, path | No | Review |
| Temporal / semantic coupling | No | Module integration tests |
| API surface size | No | A counting rule you write |

**Roughly a third of the couplings that block extraction are enforced; the rest are
convention.** That is a large improvement on nothing and it is not the complete answer, and
saying so is what makes the rest of the argument credible —
[26 · What is not on the list](10f-what-is-not-on-the-list.md).

## Gotchas

**★ The shared database table is the coupling that actually blocks extraction, and it is
completely invisible to verification.** Two modules reading the same table name no types
belonging to each other. Impose table prefixes per module, write the rule over `@Table`
names, and review native queries by hand — nothing else will catch it.

**★ A cross-module foreign key is a physical dependency the database enforces, and it will
outlive your architecture.** It cannot be dropped without a migration, it forces insert
ordering between modules, and it makes a future data split a coordinated outage. Reference
other modules' aggregates by identifier, never by constraint.

**★ A `@Transactional` method spanning three modules' repositories passes every rule and is
exactly the invariant extraction destroys.** Verification has no concept of transaction
scope. The reliable structural answer is to remove the cross-module call — declare
`allowedDependencies` so the call cannot exist and integrate by events instead.

**★ Anything expressed as a string is invisible: bean names, class names, table names, queue
names, cache keys, HTTP paths.** ArchUnit sees type references in bytecode. This is not a
defect, it is the definition of the tool, and knowing it tells you exactly which review
checklists you still need.

**★ A module can have a forty-type API and pass every check.** Verification enforces that
references go through the API package, not that the API package is small. Extraction cost
scales with API surface, so count public types per base package and track the number — it is
the cheapest extraction-readiness metric available and nothing produces it for you.

**★ Semantic coupling is undetectable by any static tool.** A module that depends on
another's listener having run, or on an event field's *meaning* rather than its type, will
break silently when that meaning changes. Module integration tests using the Scenario API are
the mechanism; static analysis is not.

**★ Green verification creates confidence out of proportion to what it checks, which is its
one genuine risk.** Teams stop reviewing for exactly the couplings it cannot see, because a
test says the architecture is fine. Put the blind-spot list in the code-review checklist
alongside the test, or the tool will make you worse at the things it does not cover.

**★ Configuration properties are part of a module's required interface by the reference's own
definition, and no rule checks them.** Two modules reading the same key are coupled through
it. The Application Module Canvas lists each module's properties, which makes the overlap
visible if anyone looks — so generate the canvas and read it.

## Interview questions

**★ What can Spring Modulith's verification not detect?**
Anything not expressed as a type reference in bytecode, because the engine is ArchUnit. That
means: shared database tables and cross-module joins, cross-module foreign keys, transactions
spanning several modules' repositories, beans looked up by name, reflective class loading,
shared configuration properties, shared queue names and cache keys, temporal and semantic
coupling, and the size or shape of a module's own API. Several of those — the shared
persistence model and the ambient transaction in particular — are exactly the couplings
Tilkov identifies as the reason monoliths become inseparable, so the blind spot is aligned
with the risk.

**★ How do you enforce data ownership between modules if verification cannot see it?**
With conventions that have mechanical checks where possible and human review where not.
Prefix every module's tables with the module name so ownership is legible; write an ArchUnit
rule asserting each module's `@Table` names carry its prefix, which catches the entity half
automatically. Ban foreign keys across module boundaries and reference other modules'
aggregates by identifier instead, so no physical dependency exists. Review native queries by
hand, because a query is a string no realistic static analysis parses. And separate
migrations per module — Spring Modulith's module-aware Flyway support gives each module its
own migration folder and its own schema history table, which makes the ownership physical.

**★ Your `verify()` test is green. What is your remaining exposure before extracting a
module?**
The data first: does anything else read this module's tables, does any foreign key cross its
boundary, does any transaction that starts elsewhere write through its repositories. Then the
strings: shared configuration keys, queue names, cache keys, scheduled-job lock rows. Then
the surface: how many public types are in its base package, and are any of them entities or
repositories. Then the semantics: does anything depend on its listeners having run, or on the
meaning rather than the shape of its events. None of those is covered by a green
verification, and every one of them can turn an extraction from a sprint into a quarter.

**★ Does the blind-spot list undermine the case for Spring Modulith?**
No, and overstating either direction does. Roughly a third of the couplings that block
extraction — cross-module internal references, injected dependencies, cycles — are mechanically
enforced on the commit that introduces them, which is a large improvement over a review
convention that historically did not hold. The rest remain conventions, and the honest
position is to say which are which, keep the blind-spot list in the code-review checklist,
and add the custom ArchUnit rules for the parts that are checkable. The genuine risk is
complacency: a green build creating confidence out of proportion to what it verified.

{/* FOOTER */}
