---
title: "VerificationOptions is how you replace, disable or extend the default rule set, and jMolecules is where the architecture rules you did not write come from — activated by classpath presence, which is why an unexplained failure after a dependency change is usually this"
sidebar_label: "12c · VerificationOptions and jMolecules"
sidebar_position: 37
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Spring Modulith reference, *Verifying Application Module
> Structure* — "Customizing the Verification"
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/verification.html));
> the published `spring-modulith-core:2.1.1` POM (`jmolecules-ddd` 2.0.1,
> `jmolecules-archunit` 0.33.0, `archunit` 1.4.2, all optional).
> Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Modulith **2.1.1**. **No sandbox** — the
> jMolecules rule set's exact contents are not enumerated in the Spring Modulith reference
> and are not reproduced from memory here.

**The three module rules are the defaults, not the limit. `VerificationOptions` lets you add
rules, replace the defaults, or turn off the automatic extras — and the automatic extras are
the part worth understanding first, because they switch on when a JAR appears on the
classpath rather than when you ask for them.**

## The automatic extras

> *"Spring Modulith optionally integrates with the jMolecules ArchUnit library and, if
> present, automatically triggers its Domain-Driven Design and architectural verification
> rules described here."*

And restated where it matters:

> *"As described above, by default, both the `ApplicationModules.verify(…)` and
> `….detectViolations(…)` automatically perform additional verifications depending on the
> classpath configuration."*

**"Depending on the classpath configuration."** `spring-modulith-core:2.1.1` declares
`org.jmolecules:jmolecules-ddd:2.0.1` and
`org.jmolecules.integrations:jmolecules-archunit:0.33.0` as *optional* dependencies — so they
are not pulled in transitively, and the moment something else in your build brings them in,
extra rules start running. That is a good default and a confusing one the first time.

**What jMolecules contributes:** DDD building-block annotations and interfaces —
aggregate roots, entities, value objects, repositories, domain events — and ArchUnit rules
that check their relationships, plus architecture-style rules for layered, onion and
hexagonal arrangements. The Spring Modulith reference links out to the jMolecules
documentation rather than enumerating them, so **consult the jMolecules ArchUnit
documentation for the exact rule set** rather than assuming; the shape of the rules is a
jMolecules concern that can change independently of Spring Modulith.

## Taking control

> *"To customize these, disable them or register additional verifications, both `verify(…)`
> and `detectVolations(…)` take a `VerificationOptions` instance."*

> ```java
> var hexagonal = JMoleculesArchitectureRules.ensureHexagonal(VerificationDepth.STRICT); (1)
> var options = VerificationOptions.defaults().withAdditionalVerifications(hexagonal); (2)
>
> ApplicationModules.of(…).verify(options); (3)
> ```
>
> *"(1) Set up the jMolecules Architecture verification for Hexagonal Architecture in strict
> mode."*
> *"(2) Create a VerificationOptions instance replacing the default verification with the one
> just set up."*
> *"(3) Execute the verification using the just configured options."*

⚠️ **Note the wording of annotation (2): "replacing the default verification".** The method is
named `withAdditionalVerifications`, and the documentation's own caption describes the result
as *replacing* the defaults. Those two readings differ, and the difference matters — one gives
you the automatic jMolecules rules plus hexagonal, the other gives you hexagonal instead of
the automatic ones. **The Spring Modulith reference does not settle this**, and this page
will not guess: if the distinction matters to your build, determine it empirically for your
version by introducing a violation of a rule you expect to still be active and checking
whether it fails. What is not in question is that the *three core module rules* — acyclicity,
internal access, allowed dependencies — are the subject of `ApplicationModules.verify` itself
rather than of the additional verifications, and continue to apply.

## When you would actually reach for this

**Adding a rule of your own.** The most common real use. Spring Modulith's three rules say
nothing about, for example, entities escaping into API packages, or a repository being used
outside its module's internals. Those are ordinary ArchUnit rules you already know how to
write, registered alongside the module verification so there is one failing test rather than
two.

**Enforcing an architecture style within modules.** Module verification governs relationships
*between* modules; it says nothing about the internal shape of one. If you want each module
to be hexagonal — domain at the centre, adapters at the edge — jMolecules' architecture rules
express that, and `VerificationDepth.STRICT` versus a looser depth is the dial.

**Turning the extras off.** A transitively acquired jMolecules on the classpath is enforcing
rules your team never agreed to. Either agree to them or configure them away, deliberately;
do not leave a build failing on a rule nobody can explain.

## The rules Spring Modulith will never check for you

Worth stating here because this is the chunk about extending the rule set — these are the
ones you must write yourself, and every one of them is load-bearing for a future extraction:

- **No JPA entity in a module's API package.**
  ([29 · API and internal packages](11c-api-and-internal-packages.md))
- **No repository outside its own module's internal packages.**
- **A module's repositories only touch tables with that module's prefix** — a rule over
  `@Table` and `@Entity` names, which is the closest anything gets to data ownership.
- **No `@Transactional` method spanning two modules' repositories** — hard, and worth
  attempting, because it is the invariant that decides whether the boundary survives
  extraction.
- **Event payload types are records containing only value types**, so the event contract can
  cross a wire later.

All of that is [38 · What verification cannot see](12d-what-verification-cannot-see.md)'s
territory, and ArchUnit is the tool for the first three.

## Gotchas

**★ jMolecules rules activate by classpath presence, not by configuration.** A transitive
dependency can start failing your build with rules nobody chose. The optional dependencies in
`spring-modulith-core` mean this will not happen from Spring Modulith itself, but any other
library or a shared parent POM can bring them in. If a verification failure names a rule you
did not write, check the dependency tree first.

**★ The reference's caption says "replacing the default verification" while the method is
`withAdditionalVerifications` — treat the semantics as unsettled until you check.** This page
does not resolve it, because the documentation does not. Determine it for your version by
experiment if the distinction matters, and write down what you found next to the call.

**★ Module verification says nothing about the internal structure of a module.** It governs
relationships between modules. If you also want a layering or hexagonal discipline inside
each module, that is a separate rule set — jMolecules' architecture rules, or your own
ArchUnit rules — and it does not come for free.

**★ The most valuable custom rules are about data, and Spring Modulith checks none of
them.** Entities in API packages, repositories used outside their module, tables read by more
than one module. These are the couplings that make an extraction impossible, and they are
plain ArchUnit rules you can write in an afternoon. Register them through
`VerificationOptions` so there is one architecture test rather than several.

**★ Adding rules is cheap; agreeing on them is not.** A strict hexagonal rule set applied to
an existing codebase produces the same wall of violations as the first `verify()`, with the
same risk of the test being deleted. Introduce additional verifications through the same
laddered adoption as everything else —
[36 · detectViolations and adoption](12b-detectviolations-and-adoption.md).

**★ Do not document a rule set from memory — link to the jMolecules documentation.** The
Spring Modulith reference deliberately links out rather than enumerating the DDD and
architecture rules, because they belong to another project and version independently. A page
that lists them as though they were fixed will be wrong within a release or two.

## Interview questions

**★ Where do verification rules you did not write come from?**
From jMolecules' ArchUnit integration, which Spring Modulith triggers automatically if it is
on the classpath — the reference says the extra verifications are performed depending on the
classpath configuration. `spring-modulith-core` declares `jmolecules-ddd` and
`jmolecules-archunit` as optional dependencies, so they do not arrive transitively from
Spring Modulith itself, but any other library or a shared parent POM can bring them in. It
contributes DDD building-block rules and architecture-style rules for layered, onion and
hexagonal arrangements. The practical consequence is that an unexplained verification failure
after a dependency change should send you to the dependency tree before the codebase.

**★ How do you add your own architecture rules to the module verification?**
Both `verify(…)` and `detectViolations(…)` accept a `VerificationOptions` instance, and
`VerificationOptions.defaults().withAdditionalVerifications(…)` registers extra checks —
ordinary ArchUnit rules, or jMolecules' prepared architecture rules such as
`JMoleculesArchitectureRules.ensureHexagonal(VerificationDepth.STRICT)`. Registering them
alongside the module verification means one architecture test rather than several, and one
failure message rather than a race between two tests. Be aware that the reference's own
caption describes this as replacing the default verification while the method name says
additional, so if the distinction matters, verify the behaviour for your version rather than
assuming.

**★ What important architectural rules does Spring Modulith not check?**
Everything about data, and everything inside a module. It does not stop a JPA entity being
placed in a module's API package, does not stop a repository being used from outside its
module's internals, does not know which tables a module's queries touch, and cannot see a
`@Transactional` method that writes through two modules' repositories. It also says nothing
about the internal structure of a module — layering, ports and adapters, dependency
direction inside the module. Those are the couplings that decide whether a future extraction
is feasible, and they are all expressible as ordinary ArchUnit rules you register through
`VerificationOptions`.

**★ Why should you not enumerate the jMolecules rule set in your own documentation?**
Because it belongs to a separate project on its own release cadence — `jmolecules-archunit`
0.33.0 in this spine — and the Spring Modulith reference deliberately links out to it rather
than reproducing it. A rule list copied into your own docs is a snapshot that will diverge
silently, and the failure mode is a team debugging a build against documentation that
describes a different version's rules. Link to the source, pin the version, and note in your
own docs only which rule sets you have chosen to enable.

{/* FOOTER */}
