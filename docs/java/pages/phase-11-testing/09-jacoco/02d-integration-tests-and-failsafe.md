---
title: "Integration tests, Failsafe and merge: the moment a project has two kinds of test it has two execution data files, and the default report shows you only one of them — which is how a well-tested service reports as half-tested"
sidebar_label: "02d · Integration tests and merge"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against **JaCoCo 0.8.15**'s mojo documentation —
> `prepare-agent-mojo.html`, `prepare-agent-integration-mojo.html`, `report-mojo.html`,
> `maven.html` — and the **Gradle user manual**'s JaCoCo plugin page. Version spine from
> `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3,
> Testcontainers 2.0.5.
> ⚠️ **No Docker, no build and no test runs on this machine** — configuration and documented
> behaviour only, never output.

**Phase 11's whole argument is that a serious suite has layers: fast unit tests, slice tests,
and a smaller set of integration tests against real dependencies. Coverage does not
automatically understand that. Each test run writes its own execution data, the default report
reads one file, and the result is a report that credits your unit tests and silently ignores
everything the integration tests proved. The fix is three goals and one decision — and the
decision, whether to merge the two numbers at all, is more interesting than the wiring.**

## Two runs, two files

In Maven the split is explicit and the defaults are already designed for it:

| | Unit tests | Integration tests |
|---|---|---|
| Runner | Surefire | Failsafe |
| Agent goal | `prepare-agent` | `prepare-agent-integration` |
| Binds to | `initialize` | **`pre-integration-test`** |
| Writes | `target/jacoco.exec` | **`target/jacoco-it.exec`** |
| Report goal | `report` | `report-integration` |

Both agent goals set the **same `argLine` property** by default — there is no distinct
`failsafeArgLine`. That works because they bind to different phases: `prepare-agent-integration`
runs at `pre-integration-test`, after Surefire has finished and before Failsafe forks, so it
rewrites the property in time. It also means the [argLine trap](02b-the-argline-trap.md) applies
to Failsafe identically, and fixing one runner does not fix the other.

The wiring, in full:

```xml
<executions>
  <execution>
    <id>prepare-agent</id>
    <goals><goal>prepare-agent</goal></goals>
  </execution>
  <execution>
    <id>report</id>
    <goals><goal>report</goal></goals>
  </execution>
  <execution>
    <id>prepare-agent-integration</id>
    <goals><goal>prepare-agent-integration</goal></goals>
  </execution>
  <execution>
    <id>report-integration</id>
    <goals><goal>report-integration</goal></goals>
  </execution>
</executions>
```

No `<phase>` elements are needed; every one of those goals carries a default binding.

## Now you have two reports, and neither is the answer

`report` produces `target/site/jacoco`; `report-integration` produces a separate directory. Both
are honest, and **neither is the number you want to gate on**, because most classes are partly
covered by each:

- A domain class covered 90% by unit tests reads 90% in one report and perhaps 20% in the other.
- A controller covered by integration tests reads 0% in the unit-test report — which is the
  single most common way a team concludes its controllers are untested when they are not.
- Neither report knows the other exists, so neither can tell you a line is covered *somewhere*.

That last point is the one that matters. Coverage is a union operation across runs, and two
separate reports cannot compute a union. You need the exec files combined.

## `merge`, and the shape that actually works

The `merge` goal combines several execution data files into one:

```xml
<execution>
  <id>merge-results</id>
  <phase>post-integration-test</phase>
  <goals><goal>merge</goal></goals>
  <configuration>
    <fileSets>
      <fileSet>
        <directory>${project.build.directory}</directory>
        <includes><include>*.exec</include></includes>
      </fileSet>
    </fileSets>
    <destFile>${project.build.directory}/jacoco-merged.exec</destFile>
  </configuration>
</execution>
<execution>
  <id>merged-report</id>
  <phase>verify</phase>
  <goals><goal>report</goal></goals>
  <configuration>
    <dataFile>${project.build.directory}/jacoco-merged.exec</dataFile>
    <outputDirectory>${project.reporting.outputDirectory}/jacoco-merged</outputDirectory>
  </configuration>
</execution>
```

`merge` at `post-integration-test` — after both runs have written — then a `report` execution
pointed at the merged file. The gate, if you have one, goes on this merged number.

The union is computed per probe: a probe that fired in *either* run is covered in the merged
result. This is exactly right, and it is why merging is not the same as averaging two
percentages — a class at 60% in one run and 60% in the other is somewhere between 60% and 100%
merged, and only the exec data knows where.

⚠️ **Watch the include pattern.** `*.exec` picks up any exec file in `target/`, which is usually
what you want and occasionally not — a stale file, or a third run you forgot about, gets folded
in silently. Listing the files explicitly is more verbose and more honest.

## The alternative: don't merge, and know why

Merging is not obligatory, and there is a real argument against it. A merged number answers
"was this code executed by anything at all", which is the weakest form of the already-weak
question coverage asks. Some teams deliberately keep the unit-test number separate and gate on
*that*, on the reasoning that:

- **Integration coverage is the easiest kind to inflate.** One end-to-end test drags hundreds of
  classes through its call path and marks them all covered, with a handful of assertions at the
  end. Merging that in makes the total look excellent while saying very little.
- **A unit-test-only number pressures the right layer.** It cannot be lifted by adding
  broad-brush tests, so raising it means testing units.

The counter-argument is equally real: a class genuinely and thoroughly tested through an
integration test reads as untested, and people then write pointless unit tests to satisfy the
gate. Neither position is obviously right; **what is wrong is not deciding, and then being
confused by whichever number happens to be on the dashboard.**

## Gradle: multiple `Test` tasks, one report task

Gradle expresses the same problem differently. A separate integration-test source set gives you
a second `Test` task, and therefore a second execution data file — and `jacocoTestReport` reads
only the one from `test`. The union is expressed by pointing the report at both:

```kotlin
tasks.jacocoTestReport {
    executionData(tasks.test, tasks.named<Test>("integrationTest"))
}
```

Remember Gradle's two documented traps still apply here and now bite harder: the report task
does not depend on `test`, and now it does not depend on `integrationTest` either, so a report
generated without running both silently reports the union of whatever happens to be on disk.
[Chunk 02c](02c-wiring-it-up-gradle.md) has the wiring.

## Testcontainers, and the coverage you will never get

Phase 11's topic 07 puts real dependencies in tests via Testcontainers. Coverage has a hard
boundary there, and it is worth stating so nobody spends an afternoon on it:

**Code running inside a container is not instrumented.** The agent is on your test JVM. A
PostgreSQL container, a Kafka broker, a WireMock image — none of it is your bytecode and none of
it is measured. What *is* measured is your repository, your entity mapping, your listener and
your client code, which is the part you wanted anyway.

The subtler case is an application started in a container *of your own image* — a full
end-to-end test against a packaged Boot application. That JVM has no agent, so none of that
execution is recorded, and the classes read 0% despite being exercised hard. Instrumenting it is
possible in principle (agent in the image, `dump` goal over TCP to pull data from the running
JVM) but it is a substantial piece of engineering for a number, and the honest recommendation is
usually not to. Say what the report does not cover rather than pretending it does.

## Where this connects

- **[02 · Wiring it up (Maven)](02-wiring-it-up-maven.md)** — the base goals and defaults.
- **[02b · The argLine trap](02b-the-argline-trap.md)** — which applies to Failsafe identically.
- **[02c · Wiring it up (Gradle)](02c-wiring-it-up-gradle.md)** — the two task-dependency traps.
- **[07 · Multi-module and aggregation](07-multi-module.md)** — the other dimension of the same
  problem: several modules rather than several runs.
- **Topic 05 · The test pyramid** and **topic 07 · Testcontainers** own the question of which
  tests to write at which level; this chunk only measures whatever you decided there.

## Gotchas

**★ `prepare-agent-integration` sets `argLine`, not `failsafeArgLine`.**
Verified against its mojo page. So a Failsafe `<argLine>` in plugin configuration breaks
integration coverage exactly as a Surefire one breaks unit coverage, and needs the same
`@{argLine}`. Teams fix Surefire, see unit coverage recover, and never notice that
`jacoco-it.exec` is still absent.

**★ The default report shows unit coverage only, so integration-tested classes read as untested.**
This is the most common cause of "our controllers have no coverage" in a project that tests its
controllers thoroughly at the integration layer. Before anyone writes tests to fix a hole, check
whether the hole is in the code or in the report's scope.

**★ Merging computes a union of probes, not an average of percentages.**
Two runs each at 60% do not merge to 60%, and they do not merge to 120% either. Anyone doing
arithmetic on the two report headlines to predict the merged number will be wrong, usually
low, and will then suspect the merge is broken.

**★ `merge` with `<include>*.exec</include>` folds in stale files.**
On a workspace that was not cleaned, an exec file from a previous commit is in `target/` and
matches the pattern. Combined with `append=true` on the agent itself, there are now two
independent ways for old coverage to inflate today's number.

**★ Merging at the wrong phase merges nothing, and succeeds.**
`merge` bound to `verify` alongside the report can run before or after `report` depending on
execution order in the POM, and `merge` bound before `post-integration-test` runs before Failsafe
has written its file. In both cases the goal succeeds — it merges the files that exist — and the
report is quietly unit-tests-only. There is no warning that a file you expected was not there.

**★ Code inside a Testcontainers container is never measured, including your own application image.**
A full end-to-end test against a packaged Boot app in a container exercises your code in a JVM
with no agent, so it contributes nothing. Those classes read 0% and are among the best-tested in
the system. This is a limitation to document, not to work around.

**★ Gradle's `executionData` is a set-or-add decision and it is easy to get backwards.**
`executionData(tasks.test, tasks.named<Test>("integrationTest"))` adds; `executionData.setFrom(...)`
replaces. Using the replacing form with only the integration task silently drops unit coverage,
producing a report that looks like a catastrophic regression.

**★ Deciding to merge is a policy choice about what you are pressuring, not a technical default.**
A merged number rewards broad end-to-end tests, which are the easiest coverage to buy and the
least informative. A unit-only number under-credits genuinely well-tested integration code. Pick
one deliberately, write down why, and put the same number on the dashboard and in the gate — the
common failure is gating on one and displaying the other.

**★ Two reports in `target/site` with similar names invite the wrong one being published.**
`jacoco`, `jacoco-it` and `jacoco-merged` all look plausible in a CI artifact list. Whichever one
the pipeline uploads becomes "the coverage number" for the whole organisation, regardless of what
the gate uses.

## Interview questions

**★ Your project runs unit tests with Surefire and integration tests with Failsafe. What does the default JaCoCo report show?**
Only the unit-test coverage. `prepare-agent` writes `target/jacoco.exec` and `report` reads that
file; the integration goals write and read `jacoco-it.exec` separately. Neither report knows about
the other, so a class covered entirely by integration tests reads as 0% in the default report.
To get a union you have to `merge` the exec files and run a report against the merged file.

**★ Why can't you just average the two coverage percentages?**
Because coverage is a union over probes, not a quantity that averages. The same probe may fire in
both runs — that is one covered probe, not two. A class at 60% in each run is somewhere between
60% and 100% merged depending on how much the two runs overlap, and only the execution data knows.
This is exactly what `merge` computes.

**★ Should integration test coverage count toward your threshold?**
It depends what you want the threshold to pressure, and it is a policy decision rather than a
technical default. Merging in integration coverage rewards broad end-to-end tests, which are the
cheapest coverage to buy and the least informative per unit of run time. Keeping the gate on unit
coverage pressures testing at the unit level but under-credits code genuinely well tested through
integration. The failure mode is not picking either — gating on one number while displaying the
other on a dashboard.

**★ Does Testcontainers give you coverage of the code inside the container?**
No. The JaCoCo agent runs on your test JVM; a database, broker or mock-server container is not
your bytecode and is not instrumented. What is measured is your side of the boundary — repository
code, mappings, listeners, clients — which is what you wanted. The genuinely awkward case is an
end-to-end test against a container running your *own* application image: that JVM has no agent,
so heavily-exercised code reads 0%. It can be instrumented with an agent in the image and the
`dump` goal, but the effort rarely justifies the number.

**★ What are the phase bindings you need to get integration coverage right in Maven?**
`prepare-agent` at `initialize` and `prepare-agent-integration` at `pre-integration-test` — that
ordering is what lets both set the same `argLine` property without clashing, since the second
rewrites it after Surefire is done. If you merge, `merge` belongs at `post-integration-test`,
after Failsafe has written its file, and the merged `report` execution after that. Binding merge
any earlier merges whatever exists and succeeds silently.

{/* FOOTER */}
