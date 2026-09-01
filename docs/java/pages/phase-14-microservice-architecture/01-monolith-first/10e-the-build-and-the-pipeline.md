---
title: "Build time is the most commonly cited reason to split and the one with the most untried cheaper answers — Richardson lists four of them himself, and Spring Modulith adds a fifth that runs only the modules a commit could have affected"
sidebar_label: "10e · The build and the pipeline"
sidebar_position: 25
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Chris Richardson, *Pattern: Monolithic Architecture*
> ([microservices.io](https://microservices.io/patterns/monolithic.html)); the Spring
> Modulith reference, *Integration Testing Application Modules* — "Change-Aware Test
> Execution" ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/testing.html));
> Martin Fowler, *Microservice Prerequisites*
> ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePrerequisites.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Modulith **2.1.1**. **No sandbox** —
> no build durations on this page were measured.

**"The build takes too long" is a genuine constraint, and it is also the one where the gap
between the cheapest fix and the most expensive fix is largest. Richardson lists four
mitigations in the monolith pattern itself; Spring Modulith adds change-aware test
execution; and the actual first step is a measurement almost nobody takes, because the two
things people call "slow build" have completely different remedies.**

## First, take the measurement that splits the problem in two

Two numbers, and they have nothing to do with each other:

**A. Compile-and-test duration.** How long one pipeline run takes, from commit to a
deployable artefact. This is a *technical* problem with technical fixes.

**B. Queue and coordination delay.** How long a commit waits: for other builds, for a merge
window, for a shared environment, for another team's approval, for a release train. This is
an *organisational* problem, and splitting is the architectural answer to it.

If B dominates, the split genuinely helps and the technical fixes will not. If A dominates,
splitting helps far less than people expect — each service builds faster, but you now run
twelve pipelines, and the wall-clock time from commit to production for a change spanning
two services may well go up because of the release ordering in
[14 · Deploy coordination](06-deploy-coordination.md).

**Measure before arguing.** Most teams have neither number.

## Richardson's four mitigations, verbatim

> *"Accelerate the deployment pipeline by"*
>
> *"apply physical design principles to the modular monolith in order to reduce build time
> coupling"*
>
> *"implementing an automated merge queue"*
>
> *"using a build tool that supports incremental building and testing"*
>
> *"parallelizing and clustering the build and test steps."*

Taking them one at a time:

**Reduce build-time coupling.** If every module depends on a shared `core` module, every
change to `core` rebuilds and retests everything. Splitting the build into Maven or Gradle
modules that mirror your application modules means a change to `inventory` only rebuilds
`inventory` and its dependents. Phase 8 topic 06 owns multi-module layout. Note the useful
symmetry: **the same boundaries that make your build incremental are the boundaries you
would extract**, so the work is not wasted either way.

**An automated merge queue.** This attacks number B directly. Instead of developers manually
serialising merges, the queue batches and tests them. This is often the single highest-value
change available and it is a CI configuration rather than an architecture.

**A build tool with incremental build and test.** Gradle's build cache and configuration
cache, or Maven with a remote cache, avoid recompiling and re-running what has not changed.
Phase 8 owns the mechanics.

**Parallelise and cluster.** Test execution across multiple agents. The most brute-force
option and frequently the fastest to implement.

## The fifth mitigation: change-aware test execution

Spring Modulith ships a JUnit Jupiter extension that skips tests unaffected by a change:

```xml
<dependency>
  <groupId>org.springframework.modulith</groupId>
  <artifactId>spring-modulith-junit</artifactId>
  <scope>test</scope>
</dependency>
```

> *"As of version 1.3, Spring Modulith ships with a JUnit Jupiter extension that will
> optimize the execution of tests, so that tests not affected by changes to the project will
> be skipped."*

> *"Tests will be selected for execution if they reside in either a root module, a module
> that has seen a change or one that transitively depends on one that has seen a change."*

Note *"or one that transitively depends on one that has seen a change"* — this is
dependency-aware, not merely file-touched, so it is safe in a way that naive "only run tests
for changed files" heuristics are not.

It backs off, deliberately, in four situations:

> *"The test execution originates from an IDE as we assume the execution is triggered
> explicitly."*
>
> *"The set of changes contains a change to a build system resource at the module root, i.e.
> pom.xml, build.gradle(.kts), settings.gradle(.kts), gradle.properties,
> gradle/libs.versions.toml, or gradle/wrapper/gradle-wrapper.properties."*
>
> *"The set of changes contains a change to any classpath resource."*
>
> *"The project does not contain a change at all."*

And the CI setup requires a reference point:

> *"To optimize the execution in a CI environment, you need to populate the
> spring.modulith.test.reference-commit property pointing to the commit of the last
> successful build and make sure that the build checks out all commits up to the reference
> one. The algorithm detecting changes to application modules will then consider all files
> changed in that delta."*

The no-change default is conservative and configurable:

> *"If no classpath or build resource changes are detected we will execute all tests by
> default. This can be customized by setting the spring.modulith.test.on-no-changes property
> to skip-all."*

[44 · Change-aware test execution](13f-change-aware-test-execution.md) covers the detail,
including the caveat about sibling sub-modules and build-logic directories.

**The point for this chunk:** a modular monolith can have a pipeline whose cost scales with
the *size of the change* rather than with the size of the codebase. That is the property
people believe only microservices provide.

## The order to try things in

1. **Measure A and B separately.** Without this, everything below is guessing.
2. **Merge queue**, if B dominates. Configuration, not architecture.
3. **Parallelise test execution.** Usually the fastest large win on A.
4. **Build cache / incremental build.** Phase 8.
5. **Split the build into modules mirroring the application modules.** This also gives you
   the extraction seams for free.
6. **Change-aware test execution** with `spring-modulith-junit` and a reference commit.
7. **Fix the slow tests.** There is almost always a small number of tests dominating the
   suite; phase 11 topic 07 owns container reuse and phase 11 topic 05 owns slice selection.
8. **Only then** consider splitting the artefact.

Steps 2 through 7 are days of work between them. Step 8 is a year.

## Gotchas

**★ "The build is slow" conflates compile time with queue time, and they have opposite
remedies.** Queue time is an organisational cost that splitting genuinely addresses; compile
and test time is a technical cost with much cheaper fixes. Take both measurements before the
design review, because the two arguments look identical when stated as "our build takes
ninety minutes".

**★ Splitting does not necessarily reduce end-to-end change lead time.** Each service builds
faster, and a change spanning two services now needs the expand/contract sequence across
three releases and two teams. For cross-cutting changes the wall-clock time from idea to
production can increase. Measure lead time for a *representative change*, not build duration
for one service.

**★ A shared `core` module makes every build a full build, and it is the first thing to
fix.** If everything depends on it, every commit to it rebuilds and retests everything —
which is exactly Richardson's "build time coupling". Splitting it up by module is
comparatively easy, delivers immediately, and produces the same seams you would need for
extraction.

**★ Change-aware execution backs off silently in four cases, and one of them is every
dependency bump.** IDE-originated runs, any change to a build file at the module root, any
classpath resource change, and no changes at all. So a Dependabot pull request runs
everything, which is correct and worth knowing before someone reports the optimisation as
broken.

**★ Change-aware execution in CI needs `spring.modulith.test.reference-commit` and a full
enough checkout.** Without the reference commit pointing at the last successful build, and
without the history back to it, the change detection has nothing to compute a delta from.
Shallow clones are the usual reason this silently does nothing.

**★ A small number of tests usually dominates the suite, and nobody has looked.** Before any
architectural change, sort test classes by duration. Container startup, full `@SpringBootTest`
contexts and sleeps are the usual culprits, and fixing the top ten often halves the suite.
Phase 11 owns the techniques.

**★ Twelve pipelines is twelve pipelines to maintain, which is a new recurring cost on the
other side of the ledger.** Base image updates, plugin breakage, credential rotation. If the
motivation was pipeline pain, note that you are trading one painful pipeline for twelve
smaller ones plus a template to keep them consistent.

**★ The build-splitting work is not wasted if you later split the system.** Maven or Gradle
modules mirroring your application modules, with the dependency graph made explicit, is the
same decomposition an extraction needs. This makes step 5 the highest-value item on the list
regardless of which way the split decision eventually goes.

## Interview questions

**★ Your build takes ninety minutes. What do you do before proposing a split?**
Separate the ninety minutes into compile-and-test duration and queue-and-coordination delay,
because they have opposite remedies. If queueing dominates, an automated merge queue often
fixes most of it as a CI configuration change. If compile-and-test dominates, parallelise
test execution across agents, enable a build cache, split the build into modules mirroring
the application modules so a change rebuilds only its dependents, adopt change-aware test
execution, and profile the test suite — there is nearly always a handful of tests dominating
it. Those are days of work; splitting the system is a year, and it does not help at all if
the problem was compile time.

**★ What is change-aware test execution and when does it back off?**
A JUnit Jupiter extension shipped with Spring Modulith that selects tests residing in a root
module, in a module that changed, or in a module that transitively depends on one that
changed — so it is dependency-aware rather than a naive file-to-test mapping. It deliberately
backs off and runs everything when the execution originates from an IDE, when any build
system resource at the module root changed (`pom.xml`, the Gradle build and settings files,
`gradle.properties`, the version catalogue, the wrapper properties), when any classpath
resource changed, or when there are no changes at all — though that last case can be set to
skip everything instead. In CI it needs `spring.modulith.test.reference-commit` pointing at
the last successful build, with enough history checked out to compute the delta.

**★ Why might splitting make lead time worse rather than better?**
Because build duration is not lead time. Each service builds faster in isolation, but a
change spanning two services now requires the expand/contract sequence — make the consumer
tolerant, deploy, then have the producer send the new shape, deploy — across two teams with
coordination between the steps, plus contract test updates on both sides. For a system where
most valuable changes are cross-cutting, that can easily exceed the single slow pipeline it
replaced. The metric to compare is end-to-end time for a representative change, not the
duration of one build.

**★ Which of the cheap mitigations is worth doing even if you are definitely going to
split?**
Splitting the build into modules that mirror the application modules. It reduces build-time
coupling so a change rebuilds and retests only its dependents, it makes the dependency graph
explicit and reviewable, and it is precisely the decomposition an extraction needs — so the
work carries over rather than being thrown away. A merge queue is a close second, because it
attacks queueing delay directly and remains useful per-repository afterwards.

{/* FOOTER */}
