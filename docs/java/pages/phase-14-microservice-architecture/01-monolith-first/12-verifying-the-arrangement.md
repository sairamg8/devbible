---
title: "Three rules, one JUnit test, and a red build: this is the single artefact that turns \"we'll keep it modular\" from an intention into a mechanism, and it is the reason the modular monolith is a different proposition than it was a decade ago"
sidebar_label: "12 · Verifying the arrangement"
sidebar_position: 35
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Spring Modulith reference, *Verifying Application Module
> Structure*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/verification.html)) and
> *Fundamentals*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/fundamentals.html)); the
> published `spring-modulith-core:2.1.1` POM (ArchUnit 1.4.2).
> Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Modulith **2.1.1**. **No sandbox** — no
> verification output on this page was produced by a run.

**Everything else in this topic is argument. This is the mechanism. One test class, three
rules, and the boundary that used to depend on a reviewer noticing an import now depends on
a build that goes red on the commit that introduced it.**

## The test

```java
package com.acme.commerce;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ModularityTests {

    static final ApplicationModules MODULES = ApplicationModules.of(CommerceApplication.class);

    @Test
    void verifiesModularStructure() {
        MODULES.verify();
    }
}
```

`ApplicationModules.of(…)` scans the bytecode once and builds the model; hold it in a static
field because building it is not free and several tests in this band reuse it.

## The three rules, verbatim

> *"The verification includes the following rules:"*
>
> *"No cycles on the application module level — the dependencies between modules have to form
> a directed acyclic graph."*
>
> *"Efferent module access via API packages only — all references to types that reside in
> application module internal packages are rejected. See Advanced Application Modules for
> details. Dependencies into internals of Open Application Modules are allowed."*
>
> *"Explicitly allowed application module dependencies only (optional) — an application module
> can optionally define allowed dependencies via `@ApplicationModule(allowedDependencies = …)`.
> If those are configured, dependencies to other application modules are rejected."*

### Rule 1 — no cycles. The one that pays for itself immediately

This is the highest-value rule and it is always on. It cannot be disabled by opening a
module, and it is the rule most likely to fail on an existing codebase.

Cycles are the thing that makes a monolith unsplittable. Fowler's footnote — *"Most systems
acquire too many dependencies between their modules, and thus can't be sensibly broken
apart"* — is a description of a cyclic module graph. If `ordering` references `inventory`
and `inventory` references `ordering`, neither can be extracted without the other, and the
"extraction" is really a merge.

The fix for a cycle is always one of three moves, and the third is usually right:

1. Move the shared type into a third module both may depend on.
2. Invert one direction with an interface — the SPI pattern from
   [30 · Named interfaces](11d-named-interfaces.md).
3. **Replace one direction with an event.** `ordering` publishes `OrderPlaced`; `inventory`
   listens. The compile-time edge disappears entirely, because the listener depends on the
   event type in ordering's API and ordering depends on nothing.
   **45 · Events instead of bean references** *(not written yet)*.

### Rule 2 — no reaching into internals

The rule that closes the gap opened by the advanced arrangement — sub-packages force types
public, and *"the Java compiler is not of much use to prevent these illegal references"*
([29 · API and internal packages](11c-api-and-internal-packages.md)). Note the exception
built into the rule: internals of **open** modules are fair game
([33 · Open modules](11g-open-modules.md)).

### Rule 3 — the declared whitelist, if you declared one

Optional, per module, opt-in. Covered in
[31 · Explicit allowed dependencies](11e-explicit-allowed-dependencies.md). The important
consequence: **without it, rules 1 and 2 permit any module to call any other module's API.**
So a codebase with only `verify()` and no `allowedDependencies` is protected against cycles
and internal access, and not against an arbitrary dependency graph.

## The fourth rule you get for free if jMolecules is present

> *"Spring Modulith optionally integrates with the jMolecules ArchUnit library and, if
> present, automatically triggers its Domain-Driven Design and architectural verification
> rules described here."*

`spring-modulith-core:2.1.1` declares `org.jmolecules.integrations:jmolecules-archunit` as an
optional dependency, so this activates by classpath presence. Worth knowing so that a rule
you did not write appearing in a failure message is not a mystery.
[37 · VerificationOptions and jMolecules](12c-verificationoptions-and-jmolecules.md).

## Where to run it

**In the normal test suite**, as an ordinary JUnit test. Not in a separate profile, not in a
nightly job, not as a warning. The entire value is that it fails the build on the commit
that introduced the violation — a check that runs later is a check that reports a violation
someone else has already built on top of.

It is fast, because it is bytecode analysis with no Spring context: this is not a
`@SpringBootTest` and it does not start the application.

## What a failure tells you, and what to do with it

A violation is a **design event**, not a build error to be routed around. The three
responses, in order of preference:

1. **The reference is wrong.** Move the call, publish an event, or use the API type instead
   of the internal one. This is the correct outcome most of the time.
2. **The API is wrong.** The type genuinely belongs in the other module's API package, or in
   a named interface. Promote it deliberately, which makes it a reviewed decision rather
   than an accident.
3. **The module boundary is wrong.** Two modules that constantly need each other's internals
   may be one module. This is real, and it is much better to discover it here than after
   extraction.

The responses that are **not** on the list: adding `@SuppressWarnings`, opening the module
([33](11g-open-modules.md) explains why not for new violations), or deleting the test.

## Gotchas

**★ The verification is only as strong as the module model, and the model comes from the
package layout.** If detection collapsed your seven feature packages into one module because
of an intermediate `core` package, `verify()` passes while enforcing nothing. Print the model
before you trust a green test — [34 · Module detection](11h-module-detection.md).

**★ Without `allowedDependencies`, `verify()` permits any module to call any other module's
API.** Rules 1 and 2 give you acyclicity and internal encapsulation, which is a lot; they do
not give you a controlled dependency graph. Teams frequently believe a green `verify()` means
the architecture is enforced, when what is enforced is that it is a DAG.

**★ Cycles are the failure that predicts unsplittability, so treat rule 1 as the most
important one.** A cyclic pair of modules cannot be extracted independently, ever. The
durable fix is almost always to replace one direction with an event, which removes the
compile-time edge entirely rather than relocating it.

**★ Run it in the ordinary test suite, on every commit.** A verification that runs nightly
reports violations that other code has already been built on top of, and the cost of fixing
one rises steeply with the number of commits since it landed. It is fast — bytecode analysis,
no Spring context — so there is no performance reason to defer it.

**★ Build the `ApplicationModules` model once and share it.** `ApplicationModules.of(…)`
scans the whole application's bytecode. A test class with five methods each calling
`of(…)` does that five times. A static field costs nothing and is the pattern the reference's
own documentation examples use.

**★ A jMolecules rule can fail your build without you having written it.** The integration
activates on classpath presence, so a transitive `jmolecules-archunit` turns on DDD and
architecture verification you did not configure. That is often desirable and it is
disorienting the first time. `VerificationOptions` is how you take control —
[37](12c-verificationoptions-and-jmolecules.md).

**★ A violation is a design question, and the failure message names the two types
involved.** The productive next step is to ask which of the three fixes applies — move the
call, promote the type, or merge the modules — not to look for a suppression mechanism.
Teams that treat the first few violations as bureaucracy end up deleting the test, which is
the only outcome that loses all the value.

**★ `verify()` throws on the first problem set; use `detectViolations()` when you need to
see or filter them.** On an existing codebase the first run produces a wall of failures, and
the adoption path runs through `detectViolations().filter(…).throwIfPresent()` rather than
through despair — [36 · detectViolations and adoption](12b-detectviolations-and-adoption.md).

## Interview questions

**★ What does `ApplicationModules.verify()` check?**
Three rules. That module dependencies form a directed acyclic graph — no cycles at the module
level. That references from one module into another only target API packages, with all
references into another module's internal packages rejected, except for modules explicitly
declared open. And, optionally and per module, that a module only depends on the modules it
declared in `@ApplicationModule(allowedDependencies = …)`. If jMolecules' ArchUnit
integration is on the classpath, its DDD and architecture rules are triggered automatically
as well.

**★ Which of those rules matters most, and why?**
Acyclicity. A cyclic dependency between two modules makes either one impossible to extract
without the other, which is exactly the condition Fowler describes when he says most systems
acquire too many inter-module dependencies to be sensibly broken apart. It is also always
on — opening a module does not disable it — so it is the one check that keeps working even
during a messy adoption. The durable fix for a cycle is to replace one direction with a
domain event, which removes the compile-time edge rather than relocating it.

**★ Your `verify()` test passes. What does that actually guarantee?**
Less than most people assume. It guarantees the module graph is acyclic and that nothing
references another module's internal packages — given the module model that detection
produced. It does not guarantee the model matches your intended architecture, since a
misconfigured detection strategy can collapse seven feature packages into one module while
the test stays green. It does not constrain which modules may call which, unless you declared
`allowedDependencies`. And it says nothing at all about data: one module's repository reading
another module's tables passes every rule.

**★ Where in the build should this test run, and why does it matter?**
In the ordinary unit test suite, on every commit, as a normal JUnit test. It is bytecode
analysis with no Spring context, so it is fast enough that there is no reason to defer it.
The reason it matters is that the entire value of the mechanism is failing on the commit that
introduces the violation: a nightly or pre-release check reports a violation that other code
has already been written against, and the cost of removing it grows with every commit since.
Deferring the check converts a mechanism back into a convention.

{/* FOOTER */}
