---
title: "Multi-module coverage: report-aggregate builds one number from the modules a project depends on, its scope rules are counter-intuitive, includeCurrentProject defaults to false, and the whole thing rests on the fact that a report needs only class files and execution data"
sidebar_label: "07 · Multi-module"
sidebar_position: 20
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against **JaCoCo 0.8.15**'s `report-aggregate-mojo.html` (quoted on module
> selection and scope semantics), `merge-mojo.html` behaviour as documented on `maven.html`, and
> the **Gradle user manual**'s JaCoCo page. Version spine from `spring-boot-dependencies:4.1.0`:
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.
> ⚠️ **No build and no test runs on this machine** — configuration and documented behaviour only.
> ⚠️ The Maven docs do **not** state which module should run the aggregate goal; that guidance
> below is presented as convention, not as documentation.

**Once a project is several modules, "our coverage" stops being a number the build produces and
becomes a number somebody has to construct. Each module reports on itself, cross-module tests
credit coverage to the wrong place, and a per-module gate and a project-wide gate say different
things. `report-aggregate` is the built-in answer, and it has three behaviours that surprise
people — one of which silently omits the module you ran it from.**

## Why per-module reports are not enough

The default arrangement gives every module its own report over its own classes and its own
execution data. Two problems follow immediately:

- **A test in module B that exercises module A's code records coverage for A's classes in B's
  execution data.** A's own report never sees it, so A reads as under-tested while B reads as
  covering classes it does not own. This is extremely common — a `service` module's tests are
  usually the best coverage a `domain` module has.
- **There is no project number**, and the one people compute — averaging the module percentages —
  is wrong twice over: it ignores module size, and line counts are not additive anyway
  ([chunk 03c](03c-line-coverage-needs-debug-info.md)).

Aggregation exists to fix the first, and the second follows from it.

## `report-aggregate`, and its three surprises

The goal *"Creates a structured code coverage report (HTML, XML, and CSV) from multiple projects
within reactor"*, built *"from all modules this project depends on, and optionally this project
itself."*

### Surprise 1 · Modules are selected by dependency, not by directory

The aggregate covers what the *aggregating module depends on*. A module that is in the reactor but
not a dependency of the aggregator is simply absent — silently, with no warning. So the aggregator
POM must declare a dependency on every module you want included, which is why the conventional
shape is a dedicated `coverage-report` module at the end of the reactor whose only purpose is to
list them all.

⚠️ Adding a new module to the build does **not** add it to the aggregate. That is a manual step,
it is easy to forget, and forgetting it makes the project number quietly better — a new
under-tested module is invisible until someone notices the aggregate omits it.

### Surprise 2 · Dependency scope changes what is contributed

Quoted from the mojo documentation:

- `compile`, `runtime`, `provided` scope → **source and execution data** included.
- `test` scope → **only execution data** considered.

So a module declared at `test` scope contributes its *tests' coverage of other modules* but its
own classes do not appear in the report. That is the correct behaviour for a shared test-fixtures
module, and a trap if you declared a production module at test scope by accident: its classes
vanish from the aggregate and the number improves.

### Surprise 3 · `includeCurrentProject` defaults to `false`

The aggregator's own classes and execution data are excluded unless you set it. For a dedicated
empty `coverage-report` module that is correct and invisible. But if you attach the goal to a
module that has real code — an `app` module aggregating its libraries, say — **that module's own
classes are missing from the report**, which is precisely the omission nobody checks for.

```xml
<configuration>
  <includeCurrentProject>true</includeCurrentProject>
</configuration>
```

⚠️ Note also that the docs describe this goal as one that *"should be used as a Maven report"*
rather than giving it a lifecycle phase binding — so bind it explicitly, at `verify`, and after
every module it depends on has run.

## The conventional shape

A dedicated module, last in the reactor:

```xml
<!-- coverage-report/pom.xml -->
<artifactId>coverage-report</artifactId>

<dependencies>
  <dependency><groupId>${project.groupId}</groupId><artifactId>domain</artifactId>  <version>${project.version}</version></dependency>
  <dependency><groupId>${project.groupId}</groupId><artifactId>service</artifactId> <version>${project.version}</version></dependency>
  <dependency><groupId>${project.groupId}</groupId><artifactId>web</artifactId>     <version>${project.version}</version></dependency>
</dependencies>

<build><plugins><plugin>
  <groupId>org.jacoco</groupId>
  <artifactId>jacoco-maven-plugin</artifactId>
  <executions><execution>
    <id>aggregate</id>
    <phase>verify</phase>
    <goals><goal>report-aggregate</goal></goals>
  </execution></executions>
</plugin></plugins></build>
```

⚠️ **This module must be built last**, or it aggregates execution data that does not exist yet and
succeeds with a partial report. Maven's reactor ordering follows the dependency graph, so
declaring the dependencies is what enforces the ordering — another reason the dependency list is
load-bearing rather than decorative.

⚠️ **The aggregate needs a full reactor build.** `mvn -pl web verify` builds one module; the
aggregate over a partial build reports on whatever exec files happen to be on disk, including
stale ones from previous runs ([chunk 02d](02d-integration-tests-and-failsafe.md)).

## Gradle

The equivalent is a report task over several projects' execution data and class directories:

```kotlin
tasks.register<JacocoReport>("codeCoverageReport") {
    subprojects.forEach { dependsOn("${it.path}:test") }
    executionData.setFrom(fileTree(rootDir) { include("**/build/jacoco/test.exec") })
    subprojects.forEach {
        sourceSets(it.extensions.getByType<SourceSetContainer>()["main"])
    }
    reports { xml.required = true; html.required = true }
}
```

⚠️ The `dependsOn` is not optional and is the same trap as everywhere else in Gradle's plugin:
the report task does not depend on the tests. A `fileTree` over `**/*.exec` will happily pick up
stale files, so a clean build matters more here than in the single-module case.

Newer Gradle lines ship a JVM test-suite aggregation plugin for this; ⚠️ **which of these is
current for your Gradle version was not verified for this page** — check the manual for the
version you are on rather than assuming the hand-rolled task is still the recommended route.

## Per-module gates, project gates, or both

Aggregation gives you a project number; it does not tell you what to enforce. Three positions:

- **Per-module only.** Each module carries its own floor. Catches regressions where they happen,
  names the owner, and is immune to a large module subsidising a small one. The weakness is the
  cross-module coverage problem — a `domain` module tested entirely from `service` looks bad
  against its own gate.
- **Aggregate only.** Solves the cross-module problem and reintroduces averaging: one badly
  tested module hides inside a well-tested project.
- **Both, differently.** The shape that usually works: a **per-module `MISSEDCOUNT` budget**
  ([chunk 04](04-thresholds.md)) that cannot be averaged away, plus an aggregate floor for the
  project trend. The per-module rule does the enforcing; the aggregate is for reporting.

## Where this connects

- **[02d · Integration tests and merge](02d-integration-tests-and-failsafe.md)** — the other
  dimension of the same problem: several runs rather than several modules.
- **[01b · How JaCoCo works](01b-how-jacoco-works.md)** — the two-input report structure (exec
  data plus class files) that makes aggregation possible at all.
- **[03c · Lines do not add up](03c-line-coverage-needs-debug-info.md)** — why averaging module
  percentages is wrong even before you consider module size.
- **[04 · Thresholds](04-thresholds.md)** — the per-module rules worth enforcing.
- **[Phase 8 · Layout and multi-module](../../phase-8-build-dependencies/06-layout-and-multi-module/README.md)**
  owns the reactor itself.

## Gotchas

**★ A module missing from the aggregator's dependency list is silently absent from the report.**
No warning, and the project number gets *better* — because the omitted module's uncovered code is
not in the denominator. A new, under-tested module is therefore invisible until someone compares
the aggregate's class list against the reactor. Adding a module to a build should include adding
it to the aggregator, and nothing enforces that.

**★ `includeCurrentProject` defaults to `false`, so an aggregating module with real code omits itself.**
Correct and invisible for a dedicated empty `coverage-report` module; wrong and invisible for an
`app` module that aggregates its libraries. Its own classes — often the least-tested in the
project — are simply not there.

**★ A `test`-scoped dependency contributes execution data but not its own classes.**
Right for a shared test-fixtures module; wrong if a production module ended up at test scope by
mistake, in which case its classes leave the report and the number improves for no reason anyone
will find.

**★ Averaging per-module coverage percentages is wrong twice.**
It ignores module size, and line counts are not additive across classes and modules anyway, per
JaCoCo's own documentation. A dashboard computing a project number that way will not match
`report-aggregate`, and the difference is not a bug in either.

**★ The aggregate is only valid after a full reactor build.**
`mvn -pl <module> verify` produces exec data for one module; the aggregate then reports over
whatever else happens to be on disk, which on an uncleaned workspace includes stale files from a
previous commit. The report is confidently wrong rather than obviously empty.

**★ A cross-module test credits coverage to the module whose exec file it is in, not the module that owns the class.**
This is the whole reason aggregation exists, and it also means per-module reports systematically
understate low-level modules and overstate the modules that test them. Judging a `domain` module by
its own report alone is judging it by the tests that happen to live beside it.

**★ Gradle's aggregate task needs an explicit `dependsOn` on every subproject's tests.**
Same trap as the single-module report, multiplied. Without it the aggregate reads whatever `.exec`
files exist, and a `fileTree` include pattern picks up stale ones from previous runs without
comment.

**★ Reactor ordering is enforced by the dependency graph, not by module order in the POM.**
The aggregator runs last because it depends on everything, not because it is listed last. If you
add a module to `<modules>` and forget the `<dependency>`, you have broken both the inclusion and
the ordering guarantee in one step.

**★ A project-wide gate lets one badly tested module hide inside a well-tested project.**
The same averaging argument as a bundle-level rule ([chunk 04](04-thresholds.md)), at a larger
scale. Per-module rules are what make a gate react to the module that actually regressed.

## Interview questions

**★ How do you get a single coverage number across a multi-module Maven build?**
With the `report-aggregate` goal, conventionally in a dedicated module at the end of the reactor
that declares a dependency on every module to be included. It builds a report from the modules the
aggregating project depends on, combining their class files and execution data. What you must not
do is average the per-module percentages — that ignores module size, and line counts are not
additive across modules in any case.

**★ What are the scope rules for `report-aggregate`?**
Modules are selected by the aggregator's dependencies, not by reactor membership. Dependencies at
`compile`, `runtime` or `provided` scope contribute both source and execution data; `test`-scope
dependencies contribute execution data only, so their own classes do not appear. And
`includeCurrentProject` defaults to `false`, so the aggregating module's own classes are excluded
unless you enable it — which matters if you attached the goal to a module that has real code.

**★ Why does a low-level `domain` module often show poor coverage in its own report?**
Because the tests that exercise it usually live in a higher module, and coverage is recorded into
that module's execution data. The `domain` classes are covered, but the credit lands in
`service`'s exec file, and `domain`'s own report never sees it. This is the main practical reason
to aggregate, and the reason a per-module gate on a low-level module can be unfairly hard to meet.

**★ Your aggregate report's number improved and nobody wrote a test. What do you check?**
Whether a module left the aggregate. The most likely causes are a module that was never added to
the aggregator's dependency list — new modules are not picked up automatically and nothing warns
you — or a dependency whose scope changed to `test`, which drops its classes from the report while
keeping its execution data. Also check whether the build was a full reactor build; a partial build
aggregates over whatever exec files are on disk.

**★ Per-module gates or a project-wide gate?**
Both, doing different jobs. A project-wide floor is fine for the trend but lets one badly tested
module hide inside a well-tested project, exactly as a bundle rule lets one class hide inside a
module. Per-module rules — ideally an absolute `MISSEDCOUNT` budget rather than a ratio — are what
make the gate react to the module that regressed and name its owner. The one thing to be careful
about is that a per-module ratio penalises low-level modules tested from above, which is an
argument for aggregating before judging them.

{/* FOOTER */}
